import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertEmailApprovedForAccess,
  isEmailApprovedForAccess,
} from '../src/auth';

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
