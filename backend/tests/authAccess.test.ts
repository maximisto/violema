import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertEmailApprovedForAccess,
  createAdminMagicLoginToken,
  isEmailAdminForAccess,
  isEmailApprovedForAccess,
  isDirectAdminEmailLoginAllowed,
  isUnverifiedEmailSessionAllowed,
  resolveAuthRole,
  verifyAdminMagicLoginToken,
} from '../src/auth';
import {
  clearAdminAccessRecords,
  getAccessRecord,
  listAdminAuditEvents,
  recordAccessRequest,
  setAccessStatus,
} from '../src/adminAccessStore';
import { isPublicBetaApiPath } from '../src/betaAccess';

function withTempAdminStore(run: () => void) {
  const originalCwd = process.cwd();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-auth-access-'));
  process.chdir(tempDirectory);

  try {
    run();
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test('auth access defaults to manual approval', () => withTempAdminStore(() => {
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalLegacyApproved = process.env.AUTH_APPROVED_EMAILS;
  const originalBetaApproved = process.env.BETA_ACCESS_EMAILS;
  delete process.env.VIOLEMA_APPROVED_EMAILS;
  delete process.env.AUTH_APPROVED_EMAILS;
  delete process.env.BETA_ACCESS_EMAILS;

  try {
    assert.equal(isEmailApprovedForAccess('stranger@example.com'), false);
    assert.equal(isEmailApprovedForAccess('max@violema.com'), true);
    assert.equal(isEmailApprovedForAccess('MAX@PURPLEORANGE.IO'), true);
    assert.throws(
      () => assertEmailApprovedForAccess('stranger@example.com'),
      /Violema beta access is manually approved/,
    );
  } finally {
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    if (originalLegacyApproved === undefined) delete process.env.AUTH_APPROVED_EMAILS;
    else process.env.AUTH_APPROVED_EMAILS = originalLegacyApproved;
    if (originalBetaApproved === undefined) delete process.env.BETA_ACCESS_EMAILS;
    else process.env.BETA_ACCESS_EMAILS = originalBetaApproved;
  }
}));

test('auth access accepts explicit beta allowlist entries', () => withTempAdminStore(() => {
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  process.env.VIOLEMA_APPROVED_EMAILS = 'founder@example.com, investor@example.com';

  try {
    assert.equal(isEmailApprovedForAccess('founder@example.com'), true);
    assert.equal(isEmailApprovedForAccess('INVESTOR@example.com'), true);
    assert.equal(isEmailApprovedForAccess('outsider@example.com'), false);
  } finally {
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
  }
}));

test('malformed admin access store fails closed for default and env allowlists', () => withTempAdminStore(() => {
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  process.env.VIOLEMA_APPROVED_EMAILS = 'founder@example.com';

  try {
    fs.writeFileSync(path.join(process.cwd(), 'admin-access.json'), '{malformed');

    assert.equal(isEmailApprovedForAccess('max@violema.com'), false);
    assert.equal(isEmailApprovedForAccess('founder@example.com'), false);
  } finally {
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
  }
}));

test('invalid admin access row fails closed for default and env allowlists', () => withTempAdminStore(() => {
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  process.env.VIOLEMA_APPROVED_EMAILS = 'founder@example.com';

  try {
    fs.writeFileSync(path.join(process.cwd(), 'admin-access.json'), JSON.stringify([
      {
        email: 'max@violema.com',
        status: 'invalid',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]));

    assert.equal(isEmailApprovedForAccess('max@violema.com'), false);
    assert.equal(isEmailApprovedForAccess('founder@example.com'), false);
  } finally {
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
  }
}));

test('production blocks unverified email session minting unless explicitly enabled', () => {
  assert.equal(isUnverifiedEmailSessionAllowed({ NODE_ENV: 'development' }), true);
  assert.equal(isUnverifiedEmailSessionAllowed({ NODE_ENV: 'test' }), true);
  assert.equal(isUnverifiedEmailSessionAllowed({ NODE_ENV: 'production' }), false);
  assert.equal(
    isUnverifiedEmailSessionAllowed({
      NODE_ENV: 'production',
      VIOLEMA_ALLOW_UNVERIFIED_EMAIL_SESSIONS: 'true',
    }),
    true,
  );
});

test('production direct email login is restricted to admins', () => withTempAdminStore(() => {
  clearAdminAccessRecords();
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  process.env.VIOLEMA_APPROVED_EMAILS = 'approved-user@example.com';

  try {
    assert.equal(
      isDirectAdminEmailLoginAllowed('max@purpleorange.io', { NODE_ENV: 'production' }),
      true,
    );
    assert.equal(
      isDirectAdminEmailLoginAllowed('approved-user@example.com', { NODE_ENV: 'production' }),
      false,
    );
    assert.equal(
      isDirectAdminEmailLoginAllowed('max@purpleorange.io', { NODE_ENV: 'development' }),
      false,
    );
  } finally {
    clearAdminAccessRecords();
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
  }
}));

test('admin magic login tokens are signed and expire', () => {
  const secret = 'test-admin-magic-secret';
  const issuedAt = Date.UTC(2026, 5, 14, 1, 0, 0);
  const token = createAdminMagicLoginToken({
    email: ' MAX@PurpleOrange.IO ',
    name: ' Max ',
    next: '/admin',
    secret,
    nowMs: issuedAt,
    ttlMs: 60_000,
  });

  assert.deepEqual(
    verifyAdminMagicLoginToken(token, { secret, nowMs: issuedAt + 30_000 }),
    {
      email: 'max@purpleorange.io',
      name: 'Max',
      next: '/admin',
    },
  );
  assert.equal(verifyAdminMagicLoginToken(`${token}x`, { secret, nowMs: issuedAt + 30_000 }), null);
  assert.equal(verifyAdminMagicLoginToken(token, { secret, nowMs: issuedAt + 61_000 }), null);
});

test('persistent admin access records requests, approvals, revokes, and audit events', () => withTempAdminStore(() => {
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  delete process.env.VIOLEMA_APPROVED_EMAILS;
  clearAdminAccessRecords();

  try {
    const requested = recordAccessRequest({
      email: 'founder@example.com',
      name: 'Founder Example',
      method: 'email',
      note: 'Signup request',
    });
    assert.equal(requested.status, 'requested');
    assert.equal(isEmailApprovedForAccess('founder@example.com'), false);

    const approved = setAccessStatus({
      email: 'founder@example.com',
      status: 'approved',
      role: 'user',
      note: 'Approved for beta',
      updatedBy: 'max@violema.com',
    });
    assert.equal(approved.status, 'approved');
    assert.equal(isEmailApprovedForAccess('FOUNDER@example.com'), true);

    const revoked = setAccessStatus({
      email: 'founder@example.com',
      status: 'revoked',
      note: 'No longer in beta',
      updatedBy: 'max@violema.com',
    });
    assert.equal(revoked.status, 'revoked');
    assert.equal(isEmailApprovedForAccess('founder@example.com'), false);

    const record = getAccessRecord('founder@example.com');
    assert.equal(record?.name, 'Founder Example');
    assert.equal(record?.status, 'revoked');
    assert.ok(listAdminAuditEvents().some((event) => event.action === 'access.revoked'));
  } finally {
    clearAdminAccessRecords();
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
  }
}));

test('malformed audit store prevents access status mutation', () => withTempAdminStore(() => {
  clearAdminAccessRecords();

  try {
    recordAccessRequest({
      email: 'founder@example.com',
      name: 'Founder Example',
      method: 'email',
      note: 'Signup request',
    });
    fs.writeFileSync(path.join(process.cwd(), 'admin-audit-events.json'), '{malformed');

    assert.throws(
      () => setAccessStatus({
        email: 'founder@example.com',
        status: 'approved',
        role: 'admin',
        updatedBy: 'max@violema.com',
      }),
      /Invalid admin audit events store/,
    );
    assert.equal(getAccessRecord('founder@example.com')?.status, 'requested');
  } finally {
    clearAdminAccessRecords();
  }
}));

test('malformed audit store prevents new access request creation', () => withTempAdminStore(() => {
  clearAdminAccessRecords();

  try {
    fs.writeFileSync(path.join(process.cwd(), 'admin-audit-events.json'), '{malformed');

    assert.throws(
      () => recordAccessRequest({
        email: 'founder@example.com',
        name: 'Founder Example',
        method: 'email',
        note: 'Signup request',
      }),
      /Invalid admin audit events store/,
    );
    assert.equal(getAccessRecord('founder@example.com'), null);
  } finally {
    clearAdminAccessRecords();
  }
}));

test('requested access records dedupe audit events and bound user text', () => withTempAdminStore(() => {
  clearAdminAccessRecords();

  try {
    const requested = recordAccessRequest({
      email: 'waiter@example.com',
      name: 'A'.repeat(300),
      method: 'email',
      note: 'B'.repeat(5000),
    });
    assert.ok((requested.name?.length || 0) <= 160);
    assert.ok((requested.note?.length || 0) <= 1000);

    const updated = recordAccessRequest({
      email: 'WAITER@example.com',
      name: 'Updated Waiter',
      method: 'email',
      note: 'Updated note',
    });
    assert.equal(updated.name, 'Updated Waiter');

    const requestedEvents = listAdminAuditEvents().filter(
      (event) => event.action === 'access.requested' && event.targetEmail === 'waiter@example.com',
    );
    assert.equal(requestedEvents.length, 1);

    const approved = setAccessStatus({
      email: 'waiter@example.com',
      status: 'approved',
      note: 'C'.repeat(5000),
      updatedBy: 'max@violema.com',
    });
    assert.ok((approved.note?.length || 0) <= 1000);
  } finally {
    clearAdminAccessRecords();
  }
}));

test('persistent approved role overrides default role resolution', () => withTempAdminStore(() => {
  clearAdminAccessRecords();

  try {
    assert.equal(resolveAuthRole('max@violema.com'), 'admin');
    assert.equal(isEmailAdminForAccess('max@violema.com'), true);
    assert.equal(resolveAuthRole('founder@example.com'), 'user');
    assert.equal(isEmailAdminForAccess('founder@example.com'), false);

    setAccessStatus({
      email: 'founder@example.com',
      status: 'approved',
      role: 'admin',
      updatedBy: 'max@violema.com',
    });
    assert.equal(resolveAuthRole('founder@example.com'), 'admin');
    assert.equal(isEmailAdminForAccess('founder@example.com'), true);

    setAccessStatus({
      email: 'max@violema.com',
      status: 'approved',
      role: 'user',
      updatedBy: 'max@violema.com',
    });
    assert.equal(resolveAuthRole('max@violema.com'), 'user');
    assert.equal(isEmailAdminForAccess('max@violema.com'), false);

    setAccessStatus({
      email: 'founder@example.com',
      status: 'revoked',
      updatedBy: 'max@violema.com',
    });
    assert.equal(isEmailAdminForAccess('founder@example.com'), false);
  } finally {
    clearAdminAccessRecords();
  }
}));

test('beta API protection only leaves auth and signed webhook surfaces public', () => {
  assert.equal(isPublicBetaApiPath('GET', '/api/health'), true);
  assert.equal(isPublicBetaApiPath('POST', '/api/waitlist'), true);
  assert.equal(isPublicBetaApiPath('GET', '/api/auth/session'), true);
  assert.equal(isPublicBetaApiPath('POST', '/api/auth/session'), true);
  assert.equal(isPublicBetaApiPath('POST', '/api/billing/stripe/webhook'), true);
  assert.equal(isPublicBetaApiPath('POST', '/api/slack/events'), true);
  assert.equal(isPublicBetaApiPath('OPTIONS', '/api/chat'), true);

  assert.equal(isPublicBetaApiPath('POST', '/api/chat'), false);
  assert.equal(isPublicBetaApiPath('GET', '/api/integrations/catalog'), false);
  assert.equal(isPublicBetaApiPath('GET', '/api/generated-screenshots/test.png'), false);
  assert.equal(isPublicBetaApiPath('POST', '/api/billing/stripe/checkout/subscription'), false);
  assert.equal(isPublicBetaApiPath('GET', '/api/studio/workflows'), false);
});
