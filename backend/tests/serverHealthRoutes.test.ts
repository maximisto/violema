import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const FIXTURE_ACCEPTED_AT = '2026-08-01T12:00:00.000Z';

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function withTempServer(run: (context: { baseUrl: string }) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-server-health-'));

  process.chdir(tempDir);
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.VIOLEMA_APPROVED_EMAILS = 'user@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;

  try {
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({ baseUrl: `http://127.0.0.1:${address.port}` });
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (typeof originalAdminEmails === 'string') process.env.ADMIN_EMAILS = originalAdminEmails;
    else delete process.env.ADMIN_EMAILS;
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalDisableScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('public health stays a minimal liveness probe and diagnostics require admin', async () => withTempServer(async ({ baseUrl }) => {
  const auth = await import('../src/auth');
  const consent = await import('../src/betaConsentStore');
  const betaProgram = await import('../src/betaProgram');

  // Deploy smoke test curls this anonymously — it must stay 200 and stay boring.
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(healthBody).sort(), ['service', 'status', 'timestamp']);
  assert.equal(healthBody.status, 'ok');
  assert.equal(healthBody.service, 'violema-by-purple-orange-ai');
  assert.equal(typeof healthBody.timestamp, 'string');
  // No model ids, providers, base URLs, fallback chains, or integration booleans.
  assert.doesNotMatch(
    JSON.stringify(healthBody),
    /model|provider|base_url|integrations|fallback/i,
  );

  const anonymousDiagnostics = await fetch(`${baseUrl}/api/admin/health`);
  assert.equal(anonymousDiagnostics.status, 401);

  consent.recordBetaConsent({
    email: 'user@example.com',
    participantType: 'founder_operator',
    termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
    termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: FIXTURE_ACCEPTED_AT,
    authMethod: 'email',
    acceptanceSource: 'signup',
  });
  const user = auth.upsertAuthUser({
    email: 'user@example.com',
    name: 'Normal User',
    role: 'user',
    method: 'email',
    participantType: 'founder_operator',
    acceptedTerms: true,
    acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: FIXTURE_ACCEPTED_AT,
    acceptedEducation: true,
  });
  const admin = auth.upsertAuthUser({
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
    method: 'email',
    participantType: 'founder_operator',
    acceptedTerms: true,
    acceptedEducation: true,
  });

  const userSession = auth.createAuthSession(user.id);
  const adminSession = auth.createAuthSession(admin.id);

  const userDiagnostics = await fetch(`${baseUrl}/api/admin/health`, {
    headers: { cookie: `violema_session=${userSession.token}` },
  });
  assert.equal(userDiagnostics.status, 403);

  const adminDiagnostics = await fetch(`${baseUrl}/api/admin/health`, {
    headers: { cookie: `violema_session=${adminSession.token}` },
  });
  assert.equal(adminDiagnostics.status, 200);
  const adminBody = await adminDiagnostics.json() as Record<string, unknown>;
  assert.equal(adminBody.status, 'ok');
  assert.ok(adminBody.models, 'admin diagnostics still expose the model map');
  assert.ok(adminBody.model_routing, 'admin diagnostics still expose model routing');
  assert.ok(adminBody.integrations, 'admin diagnostics still expose integration status');
}));
