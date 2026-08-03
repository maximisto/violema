import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BETA_APPLICATION_RECEIVED_SUBJECT,
  buildBetaApplicationReceivedEmail,
  shouldSendBetaApplicationReceivedEmail,
} from '../src/betaApplicationEmail';

test('application-received email is plain, personal, and states the whole path', () => {
  const message = buildBetaApplicationReceivedEmail({ email: 'founder@example.com', name: 'Ada' });
  assert.equal(message.subject, BETA_APPLICATION_RECEIVED_SUBJECT);
  assert.ok(message.body.startsWith('Hi Ada,'));
  assert.ok(message.body.includes('founder@example.com'));
  // The three facts an applicant needs: review is human, approval arrives by
  // email, and the repeated under-review bounce is expected behaviour.
  assert.ok(message.body.includes('human reviews every application'));
  assert.ok(message.body.includes('when you are approved'));
  assert.ok(message.body.includes('expected, not an error'));
  // Browser-agnostic re-entry is part of the promise.
  assert.ok(message.body.includes('Email me a sign-in link'));
  assert.ok(message.body.includes('you can ignore this email'));
  // A credential-adjacent transactional email: no HTML, no tracking.
  assert.ok(!/</.test(message.body));
});

test('greeting degrades cleanly without a name', () => {
  const message = buildBetaApplicationReceivedEmail({ email: 'a@b.co' });
  assert.ok(message.body.startsWith('Hi,'));
  const padded = buildBetaApplicationReceivedEmail({ email: 'a@b.co', name: '   ' });
  assert.ok(padded.body.startsWith('Hi,'));
});

test('sends exactly once: only a first identity-verified signup qualifies', () => {
  const base = { intent: 'signup', acceptedTerms: true };

  assert.equal(
    shouldSendBetaApplicationReceivedEmail({ ...base, priorAccess: null }),
    true,
    'first application ever must send',
  );
  assert.equal(
    shouldSendBetaApplicationReceivedEmail({ ...base, priorAccess: {} }),
    true,
    'an email-form request without identity evidence is not yet an application — verifying completes it',
  );
  assert.equal(
    shouldSendBetaApplicationReceivedEmail({ ...base, priorAccess: { identityVerifiedAt: '   ' } }),
    true,
    'whitespace identityVerifiedAt is no evidence',
  );
  assert.equal(
    shouldSendBetaApplicationReceivedEmail({
      ...base,
      priorAccess: { identityVerifiedAt: '2026-08-01T00:00:00.000Z' },
    }),
    false,
    'a repeat bounce on an already-verified application must stay silent',
  );
  assert.equal(
    shouldSendBetaApplicationReceivedEmail({ intent: 'login', acceptedTerms: true, priorAccess: null }),
    false,
    'login denials are not applications',
  );
  assert.equal(
    shouldSendBetaApplicationReceivedEmail({ intent: 'signup', acceptedTerms: false, priorAccess: null }),
    false,
    'no accepted terms, no application',
  );
});
