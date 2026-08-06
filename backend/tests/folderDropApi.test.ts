import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

/**
 * The folder-drop lane API: status (GET), verify (POST), and share (POST).
 *
 * Pinned here: all three routes are 401-first like the business-context
 * handlers; an unconfigured lane (no platform reader key) reports
 * `not_configured` and never audits; and the FIRST transition to `active`
 * fires exactly one `workspace.library_folder_share.enabled` audit event —
 * a second `verify` on an already-active lane must not fire a second one
 * (the `folderDropEnabledAt` stamp in the workspace profile's metadata bag
 * is what makes that idempotent, per server.ts's verify/share handlers).
 */

type TestServerContext = {
  baseUrl: string;
  sessionToken: string;
  workspaceId: string;
};

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

// Set inside withApiServer once the relevant modules are dynamically imported
// (after chdir into the temp dir), so the module-cache instance the server
// itself uses is the same one these helpers read/write through.
let adminAccessStoreModule: typeof import('../src/adminAccessStore') | null = null;
let librarySweepModule: typeof import('../src/integrationGateway/librarySweep') | null = null;

/** Scoped to this endpoint's action, so assertions never depend on event ordering. */
function readFolderDropShareAuditEvents() {
  if (!adminAccessStoreModule) throw new Error('adminAccessStore module not loaded yet.');
  return adminAccessStoreModule
    .listAdminAuditEvents()
    .filter((event) => (event.action as string) === 'workspace.library_folder_share.enabled');
}

function generateTestKeypair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

/** A synthetic `GOOGLE_LIBRARY_READER_KEY` value — never a real credential. */
function buildTestReaderKeyEnvValue(clientEmail: string): string {
  const { privateKey } = generateTestKeypair();
  return JSON.stringify({ client_email: clientEmail, private_key: privateKey });
}

async function withApiServer(
  options: { readerKeyEnvValue?: string },
  run: (context: TestServerContext) => Promise<void>,
) {
  const originalCwd = process.cwd();
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const originalReaderKey = process.env.GOOGLE_LIBRARY_READER_KEY;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-folder-drop-api-'));

  process.chdir(tempDir);
  process.env.VIOLEMA_APPROVED_EMAILS = 'qa@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';
  if (options.readerKeyEnvValue) {
    process.env.GOOGLE_LIBRARY_READER_KEY = options.readerKeyEnvValue;
  } else {
    delete process.env.GOOGLE_LIBRARY_READER_KEY;
  }

  let server: http.Server | null = null;

  try {
    const serverModule = await import('../src/server');
    const auth = await import('../src/auth');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const adminAccessStore = await import('../src/adminAccessStore');
    const librarySweep = await import('../src/integrationGateway/librarySweep');
    adminAccessStoreModule = adminAccessStore;
    librarySweepModule = librarySweep;
    const acceptedAt = '2026-07-11T12:01:00.000Z';

    consent.recordBetaConsent({
      email: 'qa@example.com',
      participantType: 'founder_operator',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
      authMethod: 'email',
      acceptanceSource: 'signup',
    });

    const user = auth.upsertAuthUser({
      email: 'qa@example.com',
      name: 'QA Operator',
      role: 'admin',
      method: 'email',
      participantType: 'founder_operator',
      acceptedTerms: true,
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
      acceptedEducation: true,
    });
    const session = auth.createAuthSession(user.id);

    server = await new Promise<http.Server>((resolve) => {
      const listening = serverModule.default.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      sessionToken: session.token,
      workspaceId: user.defaultWorkspaceId,
    });

    auth.clearAuthSession(session.token);
  } finally {
    await closeServer(server);
    // The lane-state override is a module-level singleton (librarySweep.ts) —
    // it must never bleed from one test into the next.
    librarySweepModule?.setLibrarySweepOverridesForTests(null);
    adminAccessStoreModule = null;
    librarySweepModule = null;
    process.chdir(originalCwd);
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalDisableScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    if (typeof originalReaderKey === 'string') process.env.GOOGLE_LIBRARY_READER_KEY = originalReaderKey;
    else delete process.env.GOOGLE_LIBRARY_READER_KEY;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function authHeaders(sessionToken: string) {
  return {
    cookie: `violema_session=${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

test('folder-drop status/verify/share all require a session', async () => {
  await withApiServer({}, async ({ baseUrl }) => {
    const status = await fetch(`${baseUrl}/api/workspace/library/folder-drop`);
    assert.equal(status.status, 401);

    const verify = await fetch(`${baseUrl}/api/workspace/library/folder-drop/verify`, { method: 'POST' });
    assert.equal(verify.status, 401);

    const share = await fetch(`${baseUrl}/api/workspace/library/folder-drop/share`, { method: 'POST' });
    assert.equal(share.status, 401);
  });
});

test('an unconfigured folder-drop lane reports not_configured and never audits', async () => {
  await withApiServer({}, async ({ baseUrl, sessionToken }) => {
    const status = await fetch(`${baseUrl}/api/workspace/library/folder-drop`, {
      headers: authHeaders(sessionToken),
    });
    assert.equal(status.status, 200);
    const statusBody = await status.json() as Record<string, unknown>;
    assert.equal(statusBody.laneState, 'not_configured');
    assert.equal(statusBody.readerEmail, null);
    assert.equal(statusBody.rootFolderId, null);

    const verify = await fetch(`${baseUrl}/api/workspace/library/folder-drop/verify`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    assert.equal(verify.status, 200);
    const verifyBody = await verify.json() as Record<string, unknown>;
    assert.equal(verifyBody.laneState, 'not_configured');
    assert.equal(verifyBody.readerEmail, null);

    assert.equal(readFolderDropShareAuditEvents().length, 0, 'an unconfigured lane must never audit an enablement.');

    // Sharing with no reader configured must not attempt a live Composio
    // call, and must not claim manual-share is required either — there is
    // nothing to share to.
    const share = await fetch(`${baseUrl}/api/workspace/library/folder-drop/share`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    assert.equal(share.status, 200);
    const shareBody = await share.json() as Record<string, unknown>;
    assert.equal(shareBody.laneState, 'not_configured');
    assert.equal(shareBody.manualShare, undefined);
    assert.equal(readFolderDropShareAuditEvents().length, 0);
  });
});

test('the first transition to active audits exactly once, even across repeated verify calls', async () => {
  const readerKeyEnvValue = buildTestReaderKeyEnvValue('reader@test.iam');

  await withApiServer({ readerKeyEnvValue }, async ({ baseUrl, sessionToken, workspaceId }) => {
    if (!librarySweepModule) throw new Error('librarySweep module not loaded yet.');
    librarySweepModule.setLibrarySweepOverridesForTests({ laneState: 'active' });

    const first = await fetch(`${baseUrl}/api/workspace/library/folder-drop/verify`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    assert.equal(first.status, 200);
    const firstBody = await first.json() as Record<string, unknown>;
    assert.equal(firstBody.laneState, 'active');
    assert.equal(firstBody.readerEmail, 'reader@test.iam');

    const second = await fetch(`${baseUrl}/api/workspace/library/folder-drop/verify`, {
      method: 'POST',
      headers: authHeaders(sessionToken),
    });
    assert.equal(second.status, 200);
    const secondBody = await second.json() as Record<string, unknown>;
    assert.equal(secondBody.laneState, 'active');

    const events = readFolderDropShareAuditEvents();
    assert.equal(events.length, 1, 'exactly one enablement event across both verify calls.');
    assert.equal(events[0].workspaceId, workspaceId);
    assert.deepEqual(Object.keys(events[0].metadata ?? {}), ['folderId'], 'audit metadata is content-free: folderId only.');
  });
});
