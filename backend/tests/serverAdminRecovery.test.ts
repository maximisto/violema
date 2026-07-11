import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test('configured admin magic recovery survives a malformed access store', async () => {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-admin-recovery-'));
  let server: http.Server | null = null;

  try {
    process.chdir(tempDir);
    process.env.ADMIN_EMAILS = 'recovery@example.com';
    process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';
    fs.writeFileSync(path.join(tempDir, 'admin-access.json'), '{malformed');

    const auth = await import('../src/auth');
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = auth.createAdminMagicLoginToken({
      email: 'recovery@example.com',
      name: 'Recovery Admin',
      next: '/admin',
    });

    const response = await fetch(
      `${baseUrl}/api/auth/admin/magic?token=${encodeURIComponent(token)}`,
      { redirect: 'manual' },
    );

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), `${baseUrl}/admin`);
    assert.ok(response.headers.get('set-cookie'));
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    if (originalDisableScheduler === undefined) delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    else process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('configured admin magic recovery survives requested evidence promotion', async () => {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-admin-requested-recovery-'));
  let server: http.Server | null = null;

  try {
    process.chdir(tempDir);
    process.env.ADMIN_EMAILS = 'recovery@example.com';
    process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

    const auth = await import('../src/auth');
    const access = await import('../src/adminAccessStore');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const acceptedAt = '2026-07-11T17:01:00.000Z';
    consent.recordBetaConsent({
      email: 'recovery@example.com',
      participantType: 'founder_operator',
      authMethod: 'google',
      acceptanceSource: 'oauth_callback',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
    });
    const requested = access.recordAccessRequest({
      email: 'recovery@example.com',
      method: 'google',
      participantType: 'founder_operator',
      identityVerifiedAt: '2026-07-11T17:00:00.000Z',
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
    });
    assert.equal(requested.status, 'requested');
    assert.equal(requested.role, 'user');
    const synced = access.syncVerifiedAccessEvidence({
      email: 'recovery@example.com',
      method: 'google',
      participantType: 'founder_operator',
      identityVerifiedAt: '2026-07-11T17:00:00.000Z',
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
      approvedIfMissing: true,
      role: auth.resolveAuthRole('recovery@example.com'),
    });
    assert.equal(synced.status, 'approved');
    assert.equal(synced.role, 'admin');
    assert.equal(auth.resolveAuthRole('recovery@example.com'), 'admin');
    assert.equal(auth.isEmailAdminForAccess('recovery@example.com'), true);

    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const token = auth.createAdminMagicLoginToken({
      email: 'recovery@example.com',
      name: 'Recovery Admin',
      next: '/admin',
    });
    const response = await fetch(
      `${baseUrl}/api/auth/admin/magic?token=${encodeURIComponent(token)}`,
      { redirect: 'manual' },
    );

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), `${baseUrl}/admin`);
    assert.ok(response.headers.get('set-cookie'));
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
    if (originalDisableScheduler === undefined) delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    else process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
