/**
 * Magic-link sign-in: the store, the eligibility gate, and the token lifecycle.
 *
 * The rule this suite exists to hold: a magic link is RE-AUTHENTICATION for an
 * account that an OAuth login already verified and an admin already approved.
 * It must never be a way to create an account, assert an identity, or record
 * consent.
 *
 * Sandbox hazard, found the hard way: several backend modules bind their store
 * path at MODULE LOAD (`auth.ts` does — `const USERS_FILE = path.join(process.cwd(), …)`).
 * A suite that imports one of those before `process.chdir` writes to the REAL
 * `backend/*.json`. This file therefore chdirs FIRST, uses `await import`
 * everywhere, and asserts the sandbox is actually in effect before writing.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const REPO_BACKEND_DIR = path.resolve(__dirname, '..');
const IDENTITY_VERIFIED_AT = '2026-07-11T12:00:00.000Z';

type SendEmailInput = { to: string; subject: string; body: string };

function recordingSender() {
  const sent: SendEmailInput[] = [];
  return {
    sent,
    sendEmail: async (input: SendEmailInput) => {
      sent.push(input);
      return { success: true };
    },
  };
}

function failingSender() {
  return {
    sendEmail: async () => {
      throw new Error('Postmark send failed: simulated outage');
    },
  };
}

/**
 * Enter a throwaway cwd BEFORE any store-touching import, and prove it took —
 * a silent chdir failure would send every write in this file at the real
 * `backend/auth-users.json`.
 */
async function withTempStores(run: (context: { tempDir: string }) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-magic-link-'));
  process.chdir(tempDir);
  delete process.env.VIOLEMA_APPROVED_EMAILS;
  delete process.env.ADMIN_EMAILS;

  // Sandbox assertion: cwd is the temp dir and is NOT the repo's backend dir.
  assert.equal(fs.realpathSync(process.cwd()), fs.realpathSync(tempDir));
  assert.notEqual(fs.realpathSync(process.cwd()), fs.realpathSync(REPO_BACKEND_DIR));

  try {
    await run({ tempDir });
  } finally {
    process.chdir(originalCwd);
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalAdminEmails === 'string') process.env.ADMIN_EMAILS = originalAdminEmails;
    else delete process.env.ADMIN_EMAILS;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Build the state an OAuth signup + admin approval leaves behind: a beta
 * consent receipt, an access record carrying `identityVerifiedAt` and an OAuth
 * method, an approved status, and an auth user.
 */
async function seedApprovedOAuthUser(input: {
  email: string;
  name?: string;
  status?: 'requested' | 'approved' | 'revoked';
  method?: 'google' | 'microsoft' | 'email';
  identityVerified?: boolean;
  currentTerms?: boolean;
}) {
  const { recordBetaConsent } = await import('../src/betaConsentStore');
  const { recordAccessRequest, setAccessStatus } = await import('../src/adminAccessStore');
  const { upsertAuthUser } = await import('../src/auth');
  const { CURRENT_BETA_TERMS_VERSION, CURRENT_BETA_TERMS_DIGEST } = await import('../src/betaProgram');

  const method = input.method ?? 'google';
  const currentTerms = input.currentTerms ?? true;
  const termsVersion = currentTerms ? CURRENT_BETA_TERMS_VERSION : 'stale-terms-v0';
  const acceptedTermsAt = '2026-07-11T12:01:00.000Z';

  recordBetaConsent({
    email: input.email,
    participantType: 'founder_operator',
    authMethod: method,
    acceptanceSource: 'oauth_callback',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: acceptedTermsAt,
  });
  recordAccessRequest({
    email: input.email,
    name: input.name || 'Seeded User',
    method,
    participantType: 'founder_operator',
    ...(input.identityVerified === false ? {} : { identityVerifiedAt: IDENTITY_VERIFIED_AT }),
    acceptedTermsVersion: CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt,
  });
  const status = input.status ?? 'approved';
  if (status !== 'requested') {
    setAccessStatus({
      email: input.email,
      status,
      role: 'user',
      updatedBy: 'admin@example.com',
    });
  }

  return upsertAuthUser({
    email: input.email,
    name: input.name || 'Seeded User',
    role: 'user',
    method,
    participantType: 'founder_operator',
    acceptedTerms: true,
    acceptedTermsVersion: termsVersion,
    acceptedTermsAt,
    acceptedEducation: true,
  });
}

// --- Eligibility: who may ever be sent a link -------------------------------

test('an unknown address is never issued a link, emailed, or turned into an account', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const { listAuthUsers } = await import('../src/auth');
  const { listAdminAccessRecords } = await import('../src/adminAccessStore');
  const sender = recordingSender();

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'stranger@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail },
  );

  assert.deepEqual(outcome, { delivered: false, reason: 'no_auth_user' });
  assert.equal(sender.sent.length, 0, 'no email is sent to an address we have never seen');
  assert.equal(magic.listMagicLinkTokens().length, 0, 'no token record is created');
  assert.equal(listAuthUsers().length, 0, 'no account is created');
  assert.equal(listAdminAccessRecords().length, 0, 'no access request is recorded');
}));

test('a known-but-unapproved account gets no link and no session material', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const sender = recordingSender();
  await seedApprovedOAuthUser({ email: 'pending@example.com', status: 'requested' });

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'pending@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail },
  );

  assert.deepEqual(outcome, { delivered: false, reason: 'not_approved' });
  assert.equal(sender.sent.length, 0);
  assert.equal(magic.listMagicLinkTokens().length, 0, 'an unapproved account has no token to consume');
}));

test('a revoked account gets no link', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const sender = recordingSender();
  await seedApprovedOAuthUser({ email: 'revoked@example.com', status: 'revoked' });

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'revoked@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail },
  );

  assert.deepEqual(outcome, { delivered: false, reason: 'not_approved' });
  assert.equal(sender.sent.length, 0);
  assert.equal(magic.listMagicLinkTokens().length, 0);
}));

test('an approved account whose identity was never OAuth-verified gets no link', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const { listAdminAccessRecords } = await import('../src/adminAccessStore');
  const sender = recordingSender();

  // Approval itself requires identity evidence, so the only way to reach this
  // state is a legacy or hand-edited record. Write it directly.
  await seedApprovedOAuthUser({ email: 'legacy@example.com' });
  const records = listAdminAccessRecords().map((record) => {
    if (record.email !== 'legacy@example.com') return record;
    const { identityVerifiedAt: _dropped, ...rest } = record;
    return rest;
  });
  fs.writeFileSync(path.join(process.cwd(), 'admin-access.json'), JSON.stringify(records, null, 2));

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'legacy@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail },
  );

  assert.deepEqual(outcome, { delivered: false, reason: 'identity_not_verified' });
  assert.equal(sender.sent.length, 0);
}));

test('an email-method access record is not an OAuth-verified identity', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const sender = recordingSender();
  await seedApprovedOAuthUser({ email: 'emailonly@example.com', method: 'email' });

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'emailonly@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail },
  );

  assert.deepEqual(outcome, { delivered: false, reason: 'identity_not_verified' });
  assert.equal(sender.sent.length, 0);
}));

test('an env-allowlisted address with no access record is still refused', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const { isEmailApprovedForAccess, upsertAuthUser } = await import('../src/auth');
  process.env.VIOLEMA_APPROVED_EMAILS = 'allowlisted@example.com';
  try {
    upsertAuthUser({
      email: 'allowlisted@example.com',
      name: 'Allowlisted',
      role: 'user',
      method: 'google',
      acceptedTerms: false,
      acceptedEducation: true,
    });
    // The env allowlist is enough for `isEmailApprovedForAccess`…
    assert.equal(isEmailApprovedForAccess('allowlisted@example.com'), true);
    // …and deliberately NOT enough for a magic link, which requires a real
    // access record carrying OAuth identity evidence.
    assert.deepEqual(
      magic.resolveMagicLinkRecipient('allowlisted@example.com'),
      { eligible: false, reason: 'no_access_record' },
    );
  } finally {
    delete process.env.VIOLEMA_APPROVED_EMAILS;
  }
}));

test('an unreadable access store fails closed', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'approved@example.com' });
  fs.writeFileSync(path.join(process.cwd(), 'admin-access.json'), '{malformed');

  assert.deepEqual(
    magic.resolveMagicLinkRecipient('approved@example.com'),
    { eligible: false, reason: 'access_store_unreadable' },
  );
}));

test('malformed addresses are refused', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  for (const value of ['', '   ', 'not-an-email', 'a@b', 'a b@example.com', '@example.com']) {
    assert.deepEqual(
      magic.resolveMagicLinkRecipient(value),
      { eligible: false, reason: 'invalid_email' },
      `"${value}" is not a deliverable address`,
    );
  }
}));

// --- The happy path ---------------------------------------------------------

test('an approved OAuth-verified account is emailed a single-use link', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const sender = recordingSender();
  await seedApprovedOAuthUser({ email: 'founder@example.com', name: 'Approved Founder' });

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: ' Founder@Example.com ', next: '/plans', origin: 'https://violema.com/' },
    { sendEmail: sender.sendEmail },
  );

  assert.equal(outcome.delivered, true);
  assert.equal(sender.sent.length, 1);
  const [message] = sender.sent;
  assert.equal(message.to, 'founder@example.com', 'the address is normalized before sending');
  assert.equal(message.subject, magic.MAGIC_LINK_EMAIL_SUBJECT);
  assert.match(message.body, /expires in 10 minutes and can be used once/);
  assert.match(message.body, /you can ignore this email/i);
  assert.match(message.body, /https:\/\/violema\.com\/api\/auth\/magic-link\/consume\?token=/);
  // Transactional only: no tracking pixel, no HTML, no marketing.
  assert.doesNotMatch(message.body, /<img|<html|<a\s|unsubscribe|utm_/i);

  const tokens = magic.listMagicLinkTokens();
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].email, 'founder@example.com');
  assert.equal(tokens[0].next, '/plans');
  assert.equal(tokens[0].usedAt, undefined);
}));

// --- Token security properties ---------------------------------------------

test('tokens are stored hashed — the plaintext never touches the store', async () => withTempStores(async ({ tempDir }) => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });

  const { token, record } = magic.issueMagicLinkToken({ email: 'founder@example.com' });

  // 32 random bytes, base64url. Long enough that guessing is not a threat.
  assert.ok(token.length >= 43, `token is at least 43 chars (got ${token.length})`);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(record.tokenHash, token);
  assert.match(record.tokenHash, /^[a-f0-9]{64}$/, 'the stored value is a sha256 digest');

  const storePath = path.join(tempDir, 'auth-magic-link-tokens.json');
  const raw = fs.readFileSync(storePath, 'utf-8');
  assert.ok(!raw.includes(token), 'the plaintext token does not appear anywhere in the store file');
  assert.ok(raw.includes(record.tokenHash), 'the hash does');
  assert.equal(JSON.stringify(magic.listMagicLinkTokens()).includes(token), false);

  // Two mints are never the same secret.
  const second = magic.issueMagicLinkToken({ email: 'founder@example.com' });
  assert.notEqual(second.token, token);
  assert.notEqual(second.record.tokenHash, record.tokenHash);
}));

test('a valid token is consumed exactly once', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { token } = magic.issueMagicLinkToken({ email: 'founder@example.com', next: '/settings' });

  const first = magic.consumeMagicLinkToken(token);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.record.email, 'founder@example.com');
    assert.equal(first.record.next, '/settings');
    assert.ok(first.record.usedAt, 'consumption stamps usedAt');
  }

  const second = magic.consumeMagicLinkToken(token);
  assert.deepEqual(second, { ok: false, reason: 'used' }, 'a second use fails');

  const stored = magic.listMagicLinkTokens();
  assert.equal(stored.length, 1);
  assert.ok(stored[0].usedAt, 'usedAt is persisted, not just returned');
}));

test('an expired token is rejected and stays rejected', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const issuedAt = Date.UTC(2026, 7, 2, 9, 0, 0);
  const { token } = magic.issueMagicLinkToken({ email: 'founder@example.com', nowMs: issuedAt });

  assert.equal(
    magic.consumeMagicLinkToken(token, { nowMs: issuedAt + magic.MAGIC_LINK_TTL_MS - 1_000 }).ok,
    true,
    'inside the ten-minute window it works',
  );

  const { token: second } = magic.issueMagicLinkToken({ email: 'founder@example.com', nowMs: issuedAt });
  assert.deepEqual(
    magic.consumeMagicLinkToken(second, { nowMs: issuedAt + magic.MAGIC_LINK_TTL_MS + 1_000 }),
    { ok: false, reason: 'expired' },
    'one second past the TTL it does not',
  );
}));

test('tampered, garbage, and absent tokens are all rejected', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { token } = magic.issueMagicLinkToken({ email: 'founder@example.com' });

  assert.deepEqual(magic.consumeMagicLinkToken(undefined), { ok: false, reason: 'missing_token' });
  assert.deepEqual(magic.consumeMagicLinkToken(''), { ok: false, reason: 'missing_token' });
  assert.deepEqual(magic.consumeMagicLinkToken('../../etc/passwd'), { ok: false, reason: 'malformed_token' });
  assert.deepEqual(magic.consumeMagicLinkToken('short'), { ok: false, reason: 'malformed_token' });
  assert.deepEqual(magic.consumeMagicLinkToken(`${token}x`), { ok: false, reason: 'not_found' });
  assert.deepEqual(magic.consumeMagicLinkToken(token.slice(0, -1)), { ok: false, reason: 'not_found' });
  // Presenting the stored hash is not presenting the token.
  const [stored] = magic.listMagicLinkTokens();
  assert.deepEqual(magic.consumeMagicLinkToken(stored.tokenHash), { ok: false, reason: 'not_found' });

  assert.equal(magic.listMagicLinkTokens()[0].usedAt, undefined, 'no failed attempt burned the real token');
  assert.equal(magic.consumeMagicLinkToken(token).ok, true, 'the real token still works afterwards');
}));

// --- Open redirect ----------------------------------------------------------

test('an off-site next is rejected at request time and at consume time', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });

  const hostile = [
    'https://evil.example.com/steal',
    '//evil.example.com',
    '/\\evil.example.com',
    '\\\\evil.example.com',
    'javascript:alert(1)',
    'http://violema.com.evil.example.com',
    '/unknown-route',
    '/../admin',
  ];
  for (const next of hostile) {
    assert.equal(
      magic.sanitizeMagicLinkNext(next),
      '/dashboard',
      `"${next}" must not survive as a redirect target`,
    );
    const { record } = magic.issueMagicLinkToken({ email: 'founder@example.com', next });
    assert.equal(record.next, '/dashboard', `"${next}" must not be persisted as a redirect target`);
  }

  // Internal routes survive intact, query string included.
  assert.equal(magic.sanitizeMagicLinkNext('/dashboard'), '/dashboard');
  assert.equal(magic.sanitizeMagicLinkNext('/plans'), '/plans');
  assert.equal(magic.sanitizeMagicLinkNext('/connect/slack?next=%2Fplans'), '/connect/slack?next=%2Fplans');
  assert.equal(magic.sanitizeMagicLinkNext('/access-terms?next=%2Fdashboard'), '/access-terms?next=%2Fdashboard');
  assert.equal(magic.sanitizeMagicLinkNext(undefined), '/dashboard');
}));

// --- Rate limiting ----------------------------------------------------------

test('a resend cooldown and a per-address window both hold', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const sender = recordingSender();
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const start = Date.UTC(2026, 7, 2, 9, 0, 0);

  const first = await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail, nowMs: start },
  );
  assert.equal(first.delivered, true);

  const tooSoon = await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail, nowMs: start + magic.MAGIC_LINK_RESEND_COOLDOWN_MS - 1 },
  );
  assert.deepEqual(tooSoon, { delivered: false, reason: 'cooldown' });
  assert.equal(sender.sent.length, 1, 'the throttled request sends nothing');

  // Fill the window, spacing each past the cooldown.
  let nowMs = start;
  for (let index = 1; index < magic.MAGIC_LINK_MAX_PER_EMAIL_PER_WINDOW; index += 1) {
    nowMs = start + index * (magic.MAGIC_LINK_RESEND_COOLDOWN_MS + 1_000);
    const outcome = await magic.deliverMagicLinkSignIn(
      { email: 'founder@example.com', origin: 'https://violema.com' },
      { sendEmail: sender.sendEmail, nowMs },
    );
    assert.equal(outcome.delivered, true, `request ${index + 1} is inside the window allowance`);
  }
  assert.equal(sender.sent.length, magic.MAGIC_LINK_MAX_PER_EMAIL_PER_WINDOW);

  const overflow = await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail, nowMs: nowMs + magic.MAGIC_LINK_RESEND_COOLDOWN_MS + 1_000 },
  );
  assert.deepEqual(overflow, { delivered: false, reason: 'window' });
  assert.equal(sender.sent.length, magic.MAGIC_LINK_MAX_PER_EMAIL_PER_WINDOW);

  // Once the window rolls past, the address is serviceable again.
  const recovered = await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail, nowMs: start + magic.MAGIC_LINK_EMAIL_WINDOW_MS + 60_000 },
  );
  assert.equal(recovered.delivered, true);
}));

test('the per-address throttle cannot be bypassed by casing or padding', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const sender = recordingSender();
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const start = Date.UTC(2026, 7, 2, 9, 0, 0);

  await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail, nowMs: start },
  );
  const disguised = await magic.deliverMagicLinkSignIn(
    { email: '  FOUNDER@Example.COM ', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail, nowMs: start + 1_000 },
  );

  assert.deepEqual(disguised, { delivered: false, reason: 'cooldown' });
  assert.equal(sender.sent.length, 1);
}));

// --- Delivery failure -------------------------------------------------------

test('a failed send is reported without leaking to the caller and without a usable token', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });

  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    failingSender(),
  );

  assert.deepEqual(outcome, { delivered: false, reason: 'send_failed' });
  // The token was minted before the send; nobody has the plaintext, so it is
  // inert, and it expires in ten minutes regardless.
  assert.equal(magic.listMagicLinkTokens().length, 1);
  assert.equal(magic.listMagicLinkTokens()[0].usedAt, undefined);
}));

// --- Re-authentication is not consent ---------------------------------------

test('issuing and consuming a link never records consent or identity evidence', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  const { getAccessRecord } = await import('../src/adminAccessStore');
  const { getCurrentBetaConsent } = await import('../src/betaConsentStore');
  const { listAuthUsers } = await import('../src/auth');
  await seedApprovedOAuthUser({ email: 'founder@example.com', currentTerms: false });

  const accessBefore = JSON.stringify(getAccessRecord('founder@example.com'));
  const consentBefore = JSON.stringify(getCurrentBetaConsent('founder@example.com'));
  const usersBefore = JSON.stringify(listAuthUsers());

  const sender = recordingSender();
  const outcome = await magic.deliverMagicLinkSignIn(
    { email: 'founder@example.com', origin: 'https://violema.com' },
    { sendEmail: sender.sendEmail },
  );
  assert.equal(outcome.delivered, true);
  const { token } = magic.issueMagicLinkToken({ email: 'founder@example.com' });
  assert.equal(magic.consumeMagicLinkToken(token).ok, true);

  assert.equal(JSON.stringify(getAccessRecord('founder@example.com')), accessBefore,
    'the access record — identityVerifiedAt, acceptedTermsVersion, status — is untouched');
  assert.equal(JSON.stringify(getCurrentBetaConsent('founder@example.com')), consentBefore,
    'no consent receipt is written or refreshed');
  assert.equal(JSON.stringify(listAuthUsers()), usersBefore,
    'the auth user record — including its OAuth method and stale terms version — is untouched');
}));

// --- Store hygiene ----------------------------------------------------------

test('the token store prunes long-dead rows and survives a corrupt file', async () => withTempStores(async () => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const start = Date.UTC(2026, 7, 2, 9, 0, 0);

  magic.issueMagicLinkToken({ email: 'founder@example.com', nowMs: start });
  assert.equal(magic.listMagicLinkTokens().length, 1);

  // A mint a day later drops the row that expired more than the retention
  // window ago, so the store cannot grow without bound.
  magic.issueMagicLinkToken({
    email: 'founder@example.com',
    nowMs: start + magic.MAGIC_LINK_RETENTION_MS + magic.MAGIC_LINK_TTL_MS + 60_000,
  });
  assert.equal(magic.listMagicLinkTokens().length, 1, 'the stale row is pruned');

  fs.writeFileSync(path.join(process.cwd(), 'auth-magic-link-tokens.json'), '{malformed');
  assert.deepEqual(magic.listMagicLinkTokens(), [], 'a corrupt store reads as empty, not as a crash');
  assert.deepEqual(
    magic.consumeMagicLinkToken('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    { ok: false, reason: 'not_found' },
    'and no token validates against it',
  );
}));

test('a corrupt store fails closed instead of restoring a consumed token from backup', async () => withTempStores(async ({ tempDir }) => {
  const magic = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const storePath = path.join(tempDir, 'auth-magic-link-tokens.json');

  const { token } = magic.issueMagicLinkToken({ email: 'founder@example.com' });
  assert.equal(magic.consumeMagicLinkToken(token).ok, true);

  // `writeJsonFile` snapshots the PRE-write state to `.bak`, so the backup here
  // still shows this token as unused. Reading that backup would be a replay
  // window; the store must refuse instead.
  assert.ok(fs.existsSync(`${storePath}.bak`), 'the durable write left a backup behind');
  assert.ok(
    !JSON.parse(fs.readFileSync(`${storePath}.bak`, 'utf-8'))[0]?.usedAt,
    'the backup genuinely predates consumption',
  );

  fs.writeFileSync(storePath, '{corrupted');
  assert.deepEqual(
    magic.consumeMagicLinkToken(token),
    { ok: false, reason: 'not_found' },
    'a consumed token is never resurrected by a corrupt-store fallback',
  );
}));
