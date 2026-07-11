import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  getCurrentBetaConsent,
  hasCurrentBetaConsent,
  listBetaConsentReceipts,
  recordBetaConsent,
} from '../src/betaConsentStore';
import {
  CURRENT_BETA_TERMS_DIGEST,
  CURRENT_BETA_TERMS_VERSION,
  defaultParticipantType,
  normalizeParticipantType,
} from '../src/betaProgram';

function withTempConsentStore(run: () => void) {
  const originalCwd = process.cwd();
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-beta-consent-'));
  process.chdir(tempDirectory);

  try {
    run();
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

test('participant types reject unknown and missing values unless explicitly defaulted', () => {
  assert.equal(normalizeParticipantType('investor'), 'investor');
  assert.equal(normalizeParticipantType('tester'), null);
  assert.equal(normalizeParticipantType(undefined), null);
  assert.equal(defaultParticipantType(), 'founder_operator');
});

test('beta consent receipts are append-only and current-version aware', () => withTempConsentStore(() => {
  const first = recordBetaConsent({
    email: 'INVESTOR@example.com',
    participantType: 'investor',
    authMethod: 'google',
    acceptanceSource: 'oauth_callback',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: '2026-07-11T12:00:00.000Z',
  });

  assert.equal(first.email, 'investor@example.com');
  assert.equal(hasCurrentBetaConsent('investor@example.com'), true);
  assert.equal(getCurrentBetaConsent('investor@example.com')?.id, first.id);

  const repeated = recordBetaConsent({
    email: first.email,
    participantType: first.participantType,
    authMethod: first.authMethod,
    acceptanceSource: first.acceptanceSource,
    termsVersion: first.termsVersion,
    termsDigest: first.termsDigest,
    acceptedAt: '2026-07-11T12:01:00.000Z',
  });
  assert.notEqual(repeated.id, first.id);
  assert.equal(listBetaConsentReceipts('INVESTOR@example.com').length, 2);
  assert.deepEqual(
    listBetaConsentReceipts('investor@example.com').map((receipt) => receipt.id),
    [repeated.id, first.id],
  );
}));

test('beta consent rejects invalid receipt evidence', () => withTempConsentStore(() => {
  const validInput = {
    email: 'partner@example.com',
    participantType: 'partner' as const,
    authMethod: 'microsoft' as const,
    acceptanceSource: 'signup' as const,
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: '2026-07-11T12:00:00.000Z',
  };

  assert.throws(
    () => recordBetaConsent({ ...validInput, email: 'not-an-email' }),
    /invalid email/i,
  );
  assert.throws(
    () => recordBetaConsent({ ...validInput, participantType: 'tester' as never }),
    /invalid participant type/i,
  );
  assert.throws(
    () => recordBetaConsent({ ...validInput, acceptedAt: 'yesterday' }),
    /invalid acceptedAt/i,
  );
  assert.throws(
    () => recordBetaConsent({ ...validInput, termsDigest: 'not-a-digest' }),
    /invalid termsDigest/i,
  );
  assert.throws(
    () => recordBetaConsent({ ...validInput, authMethod: 'github' as never }),
    /invalid auth method/i,
  );
  assert.throws(
    () => recordBetaConsent({ ...validInput, acceptanceSource: 'admin' as never }),
    /invalid acceptance source/i,
  );
}));

test('malformed beta consent stores fail closed', () => withTempConsentStore(() => {
  const storePath = path.join(process.cwd(), 'beta-consent-receipts.json');
  fs.writeFileSync(storePath, '{malformed');

  assert.throws(
    () => listBetaConsentReceipts(),
    /Invalid beta consent receipts store/,
  );
  assert.equal(fs.readFileSync(storePath, 'utf-8'), '{malformed');
}));

test('beta consent stores reject duplicate receipt ids', () => withTempConsentStore(() => {
  const receipt = recordBetaConsent({
    email: 'founder@example.com',
    participantType: 'founder_operator',
    authMethod: 'email',
    acceptanceSource: 'reauthorization',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: '2026-07-11T12:00:00.000Z',
  });
  fs.writeFileSync(
    path.join(process.cwd(), 'beta-consent-receipts.json'),
    JSON.stringify([receipt, receipt]),
  );

  assert.throws(
    () => listBetaConsentReceipts(),
    /duplicates receipt id/,
  );
}));
