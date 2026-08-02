/**
 * Destructive-action safety on the admin surface.
 *
 * Two gaps the audit found:
 *
 *   - The sole admin could demote or revoke HIMSELF. That is not a bad row in a
 *     table; it locks the only operator out of his own dashboard, recoverable
 *     only by editing `ADMIN_EMAILS` on the VPS and restarting.
 *   - Granting credits — a privileged mutation of a tenant's balance — left no
 *     audit trail at all, even though `credits.adjusted` already existed in the
 *     action union.
 *
 * Both are asserted over HTTP against the real app, because a guard that only
 * exists in a helper is not a control.
 */

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
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withAdminServer(run: (baseUrl: string) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-admin-guards-'));

  process.chdir(tempDir);
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.VIOLEMA_APPROVED_EMAILS = 'admin@example.com,other@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;
  try {
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (typeof originalAdminEmails === 'string') process.env.ADMIN_EMAILS = originalAdminEmails;
    else delete process.env.ADMIN_EMAILS;
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalScheduler === 'string') {
      process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalScheduler;
    } else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('an admin cannot lock themselves out, and credit grants are audited', async (t) => {
  await withAdminServer(async (baseUrl) => {
    const auth = await import('../src/auth');
    const access = await import('../src/adminAccessStore');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const routes = await import('../src/adminRoutes');

    const acceptedAt = '2026-07-20T09:00:00.000Z';
    for (const email of ['admin@example.com', 'other@example.com']) {
      consent.recordBetaConsent({
        email,
        participantType: 'founder_operator',
        authMethod: 'email',
        acceptanceSource: 'signup',
        termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
        termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
        acceptedAt,
      });
      access.recordAccessRequest({
        email,
        method: 'email',
        identityVerifiedAt: '2026-07-20T08:00:00.000Z',
        acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
        acceptedTermsAt: acceptedAt,
      });
      access.setAccessStatus({
        email,
        status: 'approved',
        role: email === 'admin@example.com' ? 'admin' : 'user',
        updatedBy: 'system@example.com',
      });
    }

    const adminUser = auth.upsertAuthUser({
      email: 'admin@example.com',
      name: 'Sole Admin',
      role: 'admin',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });
    auth.upsertAuthUser({
      email: 'other@example.com',
      name: 'Other User',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });
    const session = auth.createAuthSession(adminUser.id);
    const adminHeaders = {
      cookie: `violema_session=${session.token}`,
      'Content-Type': 'application/json',
    };

    await t.test('the guard itself refuses self-demotion and self-revocation', () => {
      assert.throws(
        () => routes.assertNotSelfDemotion('max@violema.com', 'max@violema.com', { role: 'user' }),
        /cannot remove your own admin role/,
      );
      assert.throws(
        () => routes.assertNotSelfDemotion('max@violema.com', 'MAX@Violema.com', { role: 'user' }),
        /cannot remove your own admin role/,
        'email comparison is case-insensitive, like every other email path',
      );
      assert.throws(
        () => routes.assertNotSelfDemotion('max@violema.com', 'max@violema.com', { status: 'revoked' }),
        /cannot revoke your own access/,
      );
      // Promoting yourself, or demoting somebody else, is untouched.
      routes.assertNotSelfDemotion('max@violema.com', 'max@violema.com', { role: 'admin' });
      routes.assertNotSelfDemotion('max@violema.com', 'someone@example.com', { role: 'user' });
    });

    await t.test('the role route answers 400 and leaves the role intact', async () => {
      const response = await fetch(`${baseUrl}/api/admin/users/admin@example.com/role`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ role: 'user' }),
      });
      assert.equal(response.status, 400);
      const payload = await response.json() as { error?: string };
      assert.match(String(payload.error), /cannot remove your own admin role/);
      assert.equal(
        access.getAccessRecord('admin@example.com')?.role,
        'admin',
        'the mis-click must not have taken effect',
      );

      // Changing someone else's role still works: the guard is about self, not
      // about making roles immutable.
      const other = await fetch(`${baseUrl}/api/admin/users/other@example.com/role`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ role: 'admin' }),
      });
      assert.equal(other.status, 200);
      assert.equal(access.getAccessRecord('other@example.com')?.role, 'admin');
    });

    await t.test('the access route refuses self-revocation and keeps the session', async () => {
      const response = await fetch(`${baseUrl}/api/admin/users/admin@example.com/access`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'revoked' }),
      });
      assert.equal(response.status, 400);
      const payload = await response.json() as { error?: string };
      assert.match(String(payload.error), /cannot revoke your own access/);
      assert.equal(access.getAccessRecord('admin@example.com')?.status, 'approved');
      assert.ok(
        auth.listAuthSessions().some((item) => item.userId === adminUser.id),
        'the admin must still be signed in after a refused self-revocation',
      );
    });

    await t.test('the operations endpoint is admin-gated and honors query scope', async () => {
      const anonymous = await fetch(`${baseUrl}/api/admin/operations`);
      assert.equal(anonymous.status, 401, 'the operational picture is not public');

      // Composio is disabled without an API key, so this never leaves the process.
      const response = await fetch(`${baseUrl}/api/admin/operations`, { headers: adminHeaders });
      assert.equal(response.status, 200);
      const snapshot = await response.json() as Record<string, unknown>;
      for (const section of [
        'blockedNow',
        'waitingReviews',
        'recentFailures',
        'automationHealth',
        'termsStaleness',
        'integrations',
        'telemetry',
      ]) {
        assert.ok(section in snapshot, `the operations payload must carry ${section}`);
      }
      assert.equal(snapshot.windowHours, 24, 'the default window is stated in the payload');
      assert.equal((snapshot.scope as { includeInternal?: boolean }).includeInternal, false);

      const widened = await fetch(
        `${baseUrl}/api/admin/operations?windowHours=72&includeInternal=true`,
        { headers: adminHeaders },
      );
      assert.equal(widened.status, 200);
      const widenedSnapshot = await widened.json() as Record<string, unknown>;
      assert.equal(widenedSnapshot.windowHours, 72);
      assert.equal((widenedSnapshot.scope as { includeInternal?: boolean }).includeInternal, true);

      // A bad window is a 400, not a silently ignored parameter.
      const bad = await fetch(`${baseUrl}/api/admin/operations?windowHours=soon`, {
        headers: adminHeaders,
      });
      assert.equal(bad.status, 400);
    });

    await t.test('granting test credits emits a credits.adjusted audit row', async () => {
      const before = access.listAdminAuditEvents(200)
        .filter((event) => event.action === 'credits.adjusted').length;

      const response = await fetch(`${baseUrl}/api/admin/test-credits`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ amount: 2500 }),
      });
      assert.equal(response.status, 200);

      const events = access.listAdminAuditEvents(200)
        .filter((event) => event.action === 'credits.adjusted');
      assert.equal(events.length, before + 1, 'exactly one audit row per grant');

      const [event] = events;
      assert.equal(event.actorEmail, 'admin@example.com');
      assert.ok(event.workspaceId, 'the audit row names the workspace that was credited');
      assert.equal((event.metadata as { amount?: number })?.amount, 2500);
      assert.equal((event.metadata as { source?: string })?.source, 'admin_test_credits');
      assert.ok(
        (event.metadata as { ledgerEntryId?: string })?.ledgerEntryId,
        'the row points at the ledger entry it created',
      );
      // Metadata is identifiers and a number. Nothing else.
      assert.deepEqual(
        Object.keys(event.metadata || {}).sort(),
        ['amount', 'ledgerEntryId', 'source', 'testingOnly'],
      );
    });
  });
});
