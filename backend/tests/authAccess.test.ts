import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertEmailApprovedForAccess,
  isEmailApprovedForAccess,
} from '../src/auth';
import {
  clearAdminAccessRecords,
  getAccessRecord,
  listAdminAuditEvents,
  recordAccessRequest,
  setAccessStatus,
} from '../src/adminAccessStore';
import { isPublicBetaApiPath } from '../src/betaAccess';

test('auth access defaults to manual approval', async () => {
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
});

test('auth access accepts explicit beta allowlist entries', async () => {
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
});

test('persistent admin access records requests, approvals, revokes, and audit events', () => {
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
});

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
