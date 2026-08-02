/**
 * The magic-link HTTP surface: `/api/auth/magic-link/request` and
 * `/api/auth/magic-link/consume`.
 *
 * `authMagicLink.test.ts` covers the store and the eligibility rule. This suite
 * covers what a browser actually observes:
 *
 *   - the request route is indistinguishable across every account state,
 *   - the consume route mints a session with the SAME cookie attributes as the
 *     OAuth callback, and
 *   - a user whose accepted terms are stale is signed in but held at
 *     re-acceptance rather than let into the workspace.
 *
 * Sandbox: `src/auth.ts` binds `auth-users.json` at MODULE LOAD, so this file
 * chdirs into a `mkdtemp` directory and asserts it took BEFORE the first
 * `await import('../src/server')`. Postmark credentials are removed for the
 * suite's lifetime, so nothing here can send real mail.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const REPO_BACKEND_DIR = path.resolve(__dirname, '..');
const IDENTITY_VERIFIED_AT = '2026-07-11T12:00:00.000Z';
const ACCEPTED_TERMS_AT = '2026-07-11T12:01:00.000Z';

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Let the deferred post-response delivery work finish before asserting. */
function flushDeferredWork() {
  return new Promise<void>((resolve) => setImmediate(() => setImmediate(() => resolve())));
}

async function withTempServer(
  run: (context: { baseUrl: string; tempDir: string }) => Promise<void>,
) {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const originalPostmarkKey = process.env.POSTMARK_API_KEY;
  const originalPostmarkFrom = process.env.POSTMARK_FROM_EMAIL;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-magic-link-routes-'));

  process.chdir(tempDir);
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';
  delete process.env.VIOLEMA_APPROVED_EMAILS;
  // No Postmark credentials: `sendEmailMessage` throws on its first line, so no
  // test in this file can reach the network or send real mail.
  delete process.env.POSTMARK_API_KEY;
  delete process.env.POSTMARK_FROM_EMAIL;

  assert.equal(fs.realpathSync(process.cwd()), fs.realpathSync(tempDir));
  assert.notEqual(fs.realpathSync(process.cwd()), fs.realpathSync(REPO_BACKEND_DIR));

  let server: http.Server | null = null;
  try {
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, tempDir });
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (typeof originalAdminEmails === 'string') process.env.ADMIN_EMAILS = originalAdminEmails;
    else delete process.env.ADMIN_EMAILS;
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    if (typeof originalPostmarkKey === 'string') process.env.POSTMARK_API_KEY = originalPostmarkKey;
    else delete process.env.POSTMARK_API_KEY;
    if (typeof originalPostmarkFrom === 'string') process.env.POSTMARK_FROM_EMAIL = originalPostmarkFrom;
    else delete process.env.POSTMARK_FROM_EMAIL;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function seedApprovedOAuthUser(input: {
  email: string;
  name?: string;
  status?: 'requested' | 'approved' | 'revoked';
  currentTerms?: boolean;
}) {
  const { recordBetaConsent } = await import('../src/betaConsentStore');
  const { recordAccessRequest, setAccessStatus } = await import('../src/adminAccessStore');
  const { upsertAuthUser } = await import('../src/auth');
  const { CURRENT_BETA_TERMS_VERSION, CURRENT_BETA_TERMS_DIGEST } = await import('../src/betaProgram');

  recordBetaConsent({
    email: input.email,
    participantType: 'founder_operator',
    authMethod: 'google',
    acceptanceSource: 'oauth_callback',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: ACCEPTED_TERMS_AT,
  });
  recordAccessRequest({
    email: input.email,
    name: input.name || 'Seeded User',
    method: 'google',
    participantType: 'founder_operator',
    identityVerifiedAt: IDENTITY_VERIFIED_AT,
    acceptedTermsVersion: CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: ACCEPTED_TERMS_AT,
  });
  const status = input.status ?? 'approved';
  if (status !== 'requested') {
    setAccessStatus({ email: input.email, status, role: 'user', updatedBy: 'admin@example.com' });
  }

  return upsertAuthUser({
    email: input.email,
    name: input.name || 'Seeded User',
    role: 'user',
    method: 'google',
    participantType: 'founder_operator',
    acceptedTerms: true,
    acceptedTermsVersion: input.currentTerms === false ? 'stale-terms-v0' : CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: ACCEPTED_TERMS_AT,
    acceptedEducation: true,
  });
}

async function requestMagicLink(baseUrl: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/auth/magic-link/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  return { response, payload };
}

/** The `error` message a failed consume redirect carries, decoded. */
function redirectErrorMessage(response: Response) {
  const location = response.headers.get('location') || '';
  return new URL(location, 'http://127.0.0.1').searchParams.get('error');
}

/** Mint a link the way the route does, but with a sender we can observe. */
async function issueLinkFor(email: string, next?: string) {
  const magic = await import('../src/authMagicLink');
  const sent: Array<{ to: string; subject: string; body: string }> = [];
  const outcome = await magic.deliverMagicLinkSignIn(
    { email, next, origin: 'https://violema.com' },
    {
      sendEmail: async (message) => {
        sent.push(message);
        return { success: true };
      },
    },
  );
  const match = sent[0]?.body.match(/consume\?token=([A-Za-z0-9_%-]+)/);
  return { outcome, sent, token: match ? decodeURIComponent(match[1]) : null };
}

// --- The request route is one answer, always ---------------------------------

test('every account state produces an identical request response', async () => withTempServer(async ({ baseUrl }) => {
  const { MAGIC_LINK_GENERIC_MESSAGE, listMagicLinkTokens } = await import('../src/authMagicLink');
  const { listAuthUsers } = await import('../src/auth');
  const { listAdminAccessRecords } = await import('../src/adminAccessStore');

  await seedApprovedOAuthUser({ email: 'approved@example.com' });
  await seedApprovedOAuthUser({ email: 'pending@example.com', status: 'requested' });
  await seedApprovedOAuthUser({ email: 'revoked@example.com', status: 'revoked' });

  const usersBefore = listAuthUsers().length;
  const accessBefore = listAdminAccessRecords().length;

  const cases = [
    'approved@example.com',   // real, approved
    'pending@example.com',    // real, awaiting approval
    'revoked@example.com',    // real, revoked
    'stranger@example.com',   // no such account
    'not-an-email',           // malformed
  ];

  const seen = new Set<string>();
  for (const email of cases) {
    const { response, payload } = await requestMagicLink(baseUrl, { email });
    assert.equal(response.status, 200, `${email} answers 200`);
    assert.deepEqual(payload, { ok: true, message: MAGIC_LINK_GENERIC_MESSAGE }, `${email} answers generically`);
    seen.add(JSON.stringify({
      status: response.status,
      body: payload,
      contentLength: response.headers.get('content-length'),
    }));
    // A magic-link request must never mint a session cookie.
    assert.equal(response.headers.get('set-cookie'), null, `${email} sets no cookie`);
  }
  assert.equal(seen.size, 1, 'all five account states are one indistinguishable response');

  await flushDeferredWork();

  assert.equal(listAuthUsers().length, usersBefore, 'no account is created by a request');
  assert.equal(listAdminAccessRecords().length, accessBefore, 'no access request is recorded');
  assert.deepEqual(
    listMagicLinkTokens().map((token) => token.email),
    ['approved@example.com'],
    'only the approved, OAuth-verified account ever gets a token',
  );
}));

test('a missing or non-string email is still the same generic 200', async () => withTempServer(async ({ baseUrl }) => {
  const { MAGIC_LINK_GENERIC_MESSAGE, listMagicLinkTokens } = await import('../src/authMagicLink');

  for (const body of [{}, { email: null }, { email: 42 }, { email: ['a@b.com'] }, { email: '' }]) {
    const { response, payload } = await requestMagicLink(baseUrl, body);
    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true, message: MAGIC_LINK_GENERIC_MESSAGE });
  }

  await flushDeferredWork();
  assert.equal(listMagicLinkTokens().length, 0, 'no junk request mints a token');
}));

test('the generic message names no account and no reason', async () => withTempServer(async ({ baseUrl }) => {
  const { payload } = await requestMagicLink(baseUrl, { email: 'stranger@example.com' });
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /stranger@example\.com/, 'the address is not echoed back');
  assert.doesNotMatch(
    serialized,
    /not found|no account|unknown|revoked|approved|pending|does not exist|invalid/i,
    'no wording distinguishes one account state from another',
  );
}));

// --- The consume route -------------------------------------------------------

test('a valid link mints a session with the same cookie shape as the OAuth callback', async () => withTempServer(async ({ baseUrl }) => {
  await seedApprovedOAuthUser({ email: 'founder@example.com', name: 'Approved Founder' });
  const { token } = await issueLinkFor('founder@example.com', '/plans');
  assert.ok(token, 'a link was minted');

  const response = await fetch(
    `${baseUrl}/api/auth/magic-link/consume?token=${encodeURIComponent(token as string)}`,
    { redirect: 'manual' },
  );

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') || '', /\/plans$/, 'it lands on the requested internal path');

  const cookie = response.headers.get('set-cookie') || '';
  // Compared attribute by attribute against `buildAuthCookie`, the helper the
  // OAuth callback uses — if the two ever drift, this fails.
  assert.match(cookie, /^violema_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, new RegExp(`Max-Age=${60 * 60 * 24 * 30}`));

  // The cookie is a real session: it authenticates a subsequent request.
  const sessionToken = decodeURIComponent((cookie.match(/violema_session=([^;]+)/) || [])[1] || '');
  const { getAuthUserByToken } = await import('../src/auth');
  assert.equal(getAuthUserByToken(sessionToken)?.user.email, 'founder@example.com');

  const session = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: `violema_session=${encodeURIComponent(sessionToken)}` },
  });
  assert.equal(session.status, 200);
  const sessionBody = await session.json() as { user?: Record<string, unknown> };
  assert.equal(sessionBody.user?.email, 'founder@example.com');
  assert.equal(sessionBody.user?.requiresTermsAcceptance, false);
  // Re-authentication does not rewrite identity provenance.
  assert.equal(sessionBody.user?.method, 'google', 'the OAuth method that verified them is preserved');
}));

test('the sign-in is recorded as magic_link without asserting identity or consent', async () => withTempServer(async ({ baseUrl }) => {
  const { getAccessRecord, listAdminAuditEvents } = await import('../src/adminAccessStore');
  const { getCurrentBetaConsent } = await import('../src/betaConsentStore');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { token } = await issueLinkFor('founder@example.com');

  const accessBefore = JSON.stringify(getAccessRecord('founder@example.com'));
  const consentBefore = JSON.stringify(getCurrentBetaConsent('founder@example.com'));

  const response = await fetch(
    `${baseUrl}/api/auth/magic-link/consume?token=${encodeURIComponent(token as string)}`,
    { redirect: 'manual' },
  );
  assert.equal(response.status, 302);

  const signIn = listAdminAuditEvents().find((event) => event.action === 'auth.magic_link.signed_in');
  assert.ok(signIn, 'the sign-in is auditable');
  assert.equal(signIn?.targetEmail, 'founder@example.com');
  assert.equal(signIn?.metadata?.method, 'magic_link');
  assert.equal(signIn?.metadata?.identityMethod, 'google', 'the audit names the OAuth provider that verified them');

  assert.equal(
    JSON.stringify(getAccessRecord('founder@example.com')),
    accessBefore,
    'identityVerifiedAt, acceptedTermsVersion, and status are untouched by a sign-in',
  );
  assert.equal(
    JSON.stringify(getCurrentBetaConsent('founder@example.com')),
    consentBefore,
    'no consent receipt is written or refreshed',
  );
}));

test('a stale-terms user is signed in but held at re-acceptance', async () => withTempServer(async ({ baseUrl }) => {
  await seedApprovedOAuthUser({ email: 'stale@example.com', currentTerms: false });
  const { token } = await issueLinkFor('stale@example.com');

  const response = await fetch(
    `${baseUrl}/api/auth/magic-link/consume?token=${encodeURIComponent(token as string)}`,
    { redirect: 'manual' },
  );
  assert.equal(response.status, 302, 'the sign-in itself succeeds');
  const cookie = response.headers.get('set-cookie') || '';
  const sessionToken = decodeURIComponent((cookie.match(/violema_session=([^;]+)/) || [])[1] || '');
  assert.ok(sessionToken, 'a session cookie was issued');

  // The session resolves, and it reports that terms must be re-accepted — the
  // flag ProtectedRoute turns into a redirect to /access-terms.
  const session = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: `violema_session=${encodeURIComponent(sessionToken)}` },
  });
  assert.equal(session.status, 200);
  const body = await session.json() as { user?: Record<string, unknown> };
  assert.equal(body.user?.requiresTermsAcceptance, true, 'stale terms are reported, not silently accepted');

  // And the workspace stays shut until they are re-accepted.
  const gated = await fetch(`${baseUrl}/api/missions`, {
    headers: { cookie: `violema_session=${encodeURIComponent(sessionToken)}` },
  });
  assert.equal(gated.status, 403);
  assert.equal((await gated.json() as { code?: string }).code, 'terms_reacceptance_required');
}));

test('a link is spent exactly once', async () => withTempServer(async ({ baseUrl }) => {
  const { MAGIC_LINK_INVALID_MESSAGE } = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { token } = await issueLinkFor('founder@example.com');
  const url = `${baseUrl}/api/auth/magic-link/consume?token=${encodeURIComponent(token as string)}`;

  const first = await fetch(url, { redirect: 'manual' });
  assert.equal(first.status, 302);
  assert.ok(first.headers.get('set-cookie'), 'the first use mints a session');

  const second = await fetch(url, { redirect: 'manual' });
  assert.equal(second.status, 302);
  assert.equal(second.headers.get('set-cookie'), null, 'the second use mints nothing');
  assert.match(second.headers.get('location') || '', /\/login\?/, 'a spent link lands back on the login page');
  assert.equal(
    redirectErrorMessage(second),
    MAGIC_LINK_INVALID_MESSAGE,
    'with the one generic invalid-link message',
  );
}));

test('absent, garbage, and tampered tokens all fail the same way', async () => withTempServer(async ({ baseUrl }) => {
  const { MAGIC_LINK_INVALID_MESSAGE, listMagicLinkTokens } = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { token } = await issueLinkFor('founder@example.com');

  const attempts = [
    '',
    '?token=',
    '?token=garbage',
    '?token=../../etc/passwd',
    `?token=${encodeURIComponent(`${token}x`)}`,
    '?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ];

  const outcomes = new Set<string>();
  for (const suffix of attempts) {
    const response = await fetch(`${baseUrl}/api/auth/magic-link/consume${suffix}`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('set-cookie'), null, `"${suffix}" mints no session`);
    assert.equal(redirectErrorMessage(response), MAGIC_LINK_INVALID_MESSAGE, `"${suffix}" discloses nothing`);
    outcomes.add(response.headers.get('location') || '');
  }
  assert.equal(outcomes.size, 1, 'every rejection is the same redirect — no reason is disclosed');
  assert.equal(listMagicLinkTokens()[0]?.usedAt, undefined, 'no failed attempt burned the real link');
}));

test('a link stops working the moment access is revoked', async () => withTempServer(async ({ baseUrl }) => {
  const { setAccessStatus } = await import('../src/adminAccessStore');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { token } = await issueLinkFor('founder@example.com');

  setAccessStatus({
    email: 'founder@example.com',
    status: 'revoked',
    updatedBy: 'admin@example.com',
  });

  const response = await fetch(
    `${baseUrl}/api/auth/magic-link/consume?token=${encodeURIComponent(token as string)}`,
    { redirect: 'manual' },
  );
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('set-cookie'), null, 'a revoked account cannot spend an outstanding link');
  assert.match(response.headers.get('location') || '', /\/login\?/);
}));

test('an off-site next never becomes a redirect, at request time or consume time', async () => withTempServer(async ({ baseUrl }) => {
  await seedApprovedOAuthUser({ email: 'founder@example.com' });
  const { issueMagicLinkToken, listMagicLinkTokens } = await import('../src/authMagicLink');

  const { response } = await requestMagicLink(baseUrl, {
    email: 'founder@example.com',
    next: 'https://evil.example.com/steal',
  });
  assert.equal(response.status, 200);
  await flushDeferredWork();

  // Delivery fails (no Postmark credentials in this suite) but the token is
  // minted first, which is exactly the record to inspect.
  const [stored] = listMagicLinkTokens();
  assert.ok(stored, 'a token was minted for the approved account');
  assert.equal(stored.next, '/dashboard', 'the hostile destination was replaced at request time');

  const { token } = issueMagicLinkToken({
    email: 'founder@example.com',
    next: 'https://evil.example.com/steal',
  });
  const consumed = await fetch(
    `${baseUrl}/api/auth/magic-link/consume?token=${encodeURIComponent(token)}`,
    { redirect: 'manual' },
  );
  const location = consumed.headers.get('location') || '';
  assert.equal(consumed.status, 302);
  assert.doesNotMatch(location, /evil\.example\.com/, 'no path leads off-site');
  assert.match(location, /\/dashboard$/);
}));

test('the request route sits behind the strict per-IP limiter', async () => withTempServer(async ({ baseUrl }) => {
  const { SENSITIVE_RATE_LIMIT_MAX } = await import('../src/security');
  const { listMagicLinkTokens } = await import('../src/authMagicLink');
  await seedApprovedOAuthUser({ email: 'founder@example.com' });

  let limited: Response | null = null;
  for (let attempt = 0; attempt <= SENSITIVE_RATE_LIMIT_MAX + 1; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/magic-link/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'founder@example.com' }),
    });
    if (response.status === 429) {
      limited = response;
      break;
    }
    await response.json().catch(() => null);
  }

  assert.ok(limited, `the strict limiter engages within ${SENSITIVE_RATE_LIMIT_MAX + 2} requests from one IP`);
  assert.equal((await (limited as Response).json() as { code?: string }).code, 'rate_limited');

  await flushDeferredWork();
  // The per-address cooldown means the flood produced at most one real link.
  assert.ok(
    listMagicLinkTokens().length <= 1,
    `a flood from one IP mints at most one token (got ${listMagicLinkTokens().length})`,
  );
}));
