import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

/**
 * The workspace business-context API: the operator-owned "whose business is
 * this?" record that seeded steps compose search queries from (businessContext.ts).
 *
 * Pinned here: the routes require a session (401 anonymous), round-trip a
 * valid context, reject an invalid one with structured details, and leave a
 * content-free audit trail — never the operator's summary/keyword/competitor
 * strings, only shape metrics (see server.ts's PUT handler and the global
 * "audit metadata must be content-free" constraint).
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

// Set inside withApiServer once ../src/adminAccessStore is dynamically
// imported (after chdir into the temp dir), so the module-cache instance the
// server itself uses is the same one this helper reads from.
let adminAccessStoreModule: typeof import('../src/adminAccessStore') | null = null;

/**
 * The store's real audit-read surface (`listAdminAuditEvents`), scoped to
 * this endpoint's action so the assertion doesn't depend on ordering or on
 * other admin events sharing the fresh temp-dir store.
 */
function readBusinessContextAuditEvents() {
  if (!adminAccessStoreModule) throw new Error('adminAccessStore module not loaded yet.');
  return adminAccessStoreModule
    .listAdminAuditEvents()
    // Cast rather than narrow on the union member: this helper must keep
    // compiling in the RED phase, before the literal exists in AdminAuditAction.
    .filter((event) => (event.action as string) === 'workspace.business_context.updated');
}

async function withApiServer(run: (context: TestServerContext) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-api-'));

  process.chdir(tempDir);
  process.env.VIOLEMA_APPROVED_EMAILS = 'qa@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;

  try {
    const serverModule = await import('../src/server');
    const auth = await import('../src/auth');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const adminAccessStore = await import('../src/adminAccessStore');
    adminAccessStoreModule = adminAccessStore;
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
    adminAccessStoreModule = null;
    process.chdir(originalCwd);
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalDisableScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function authHeaders(sessionToken: string) {
  return {
    cookie: `violema_session=${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

test('business-context API round-trips, validates, audits, and requires a session', async () => {
  await withApiServer(async ({ baseUrl, sessionToken, workspaceId }) => {
    // Anonymous PUT → 401.
    const anonymous = await fetch(`${baseUrl}/api/workspace/business-context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'x', marketKeywords: ['y'] }),
    });
    assert.equal(anonymous.status, 401);

    // Authenticated GET before any write → null context.
    const before = await fetch(`${baseUrl}/api/workspace/business-context`, {
      headers: authHeaders(sessionToken),
    });
    assert.equal(before.status, 200);
    const beforeBody = await before.json() as Record<string, unknown>;
    assert.equal(beforeBody.businessContext, null);

    // Invalid body → 400 with error details.
    const invalid = await fetch(`${baseUrl}/api/workspace/business-context`, {
      method: 'PUT',
      headers: authHeaders(sessionToken),
      body: JSON.stringify({ summary: '', marketKeywords: [] }),
    });
    assert.equal(invalid.status, 400);
    const invalidBody = await invalid.json() as Record<string, unknown>;
    assert.equal(invalidBody.code, 'invalid_business_context');
    assert.ok(Array.isArray(invalidBody.details));

    // Valid PUT → saved; GET round-trips it.
    const put = await fetch(`${baseUrl}/api/workspace/business-context`, {
      method: 'PUT',
      headers: authHeaders(sessionToken),
      body: JSON.stringify({
        summary: 'An AI-powered espresso machine company.',
        marketKeywords: ['AI-powered espresso machine'],
        competitors: ['decenttespresso.com'],
      }),
    });
    assert.equal(put.status, 200);
    const saved = await put.json() as Record<string, unknown>;
    assert.equal(saved.ok, true);
    assert.equal(saved.workspaceId, workspaceId);
    assert.equal((saved.businessContext as Record<string, unknown>).summary, 'An AI-powered espresso machine company.');

    const after = await fetch(`${baseUrl}/api/workspace/business-context`, {
      headers: authHeaders(sessionToken),
    });
    const afterBody = await after.json() as Record<string, unknown>;
    assert.equal((afterBody.businessContext as Record<string, unknown>).summary, 'An AI-powered espresso machine company.');

    // Audit trail: exactly one content-free event, via the store's real read surface.
    const events = readBusinessContextAuditEvents(); // resolve per the note above
    assert.equal(events.length, 1);
    assert.equal(events[0].workspaceId, workspaceId);
    assert.equal(
      JSON.stringify(events[0].metadata).includes('espresso'), false,
      'audit metadata must be content-free',
    );
  });
});
