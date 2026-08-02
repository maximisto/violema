/**
 * Email magic-link RE-AUTHENTICATION for accounts that already exist.
 *
 * Why this module exists: Safari's storage-access behaviour can strand the
 * Google account chooser when several Google accounts are signed in — the
 * chooser renders, the account is picked, and the OAuth flow never returns. The
 * authorization request itself is correct, so the fix cannot live in the OAuth
 * code. This is the browser-agnostic way back in.
 *
 * WHAT THIS IS NOT, and must never become:
 *
 *   - It is NOT identity verification. A magic link proves control of a
 *     mailbox. Violema's participant rule requires a verified Google or
 *     Microsoft OAuth identity, and that evidence is only ever written by the
 *     OAuth callback. `resolveMagicLinkRecipient` REQUIRES that evidence to
 *     already exist (`identityVerifiedAt` + an OAuth `method` on the access
 *     record) and never writes it.
 *   - It is NOT consent. Nothing here calls `recordBetaConsent`,
 *     `requestBetaAccess`, `syncVerifiedAccessEvidence`, or `upsertAuthUser`.
 *     A stale-terms user signs in and is routed to re-acceptance by the same
 *     `requiresTermsAcceptance` path an OAuth login uses.
 *   - It is NOT enrolment. An address with no auth user gets no token, no
 *     email, and no record — and the caller cannot tell that from a hit.
 *
 * `auth.ts` already has `createAdminMagicLoginToken`. That one is a stateless
 * signed payload: replayable until expiry, unrevocable, admin-only. This store
 * exists because a participant-facing sign-in link has to be single-use,
 * hashed at rest, and killable.
 *
 * The store path is resolved lazily on every call, not frozen at module load,
 * so a test that `chdir`s into a temp directory cannot write to the real
 * `backend/*.json`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAccessRecord, type AdminAccessRecord } from './adminAccessStore';
import { listAuthUsers, type AuthUserRecord } from './auth';
import { writeJsonFile } from './platform/jsonStore';

/** A link is good for ten minutes and one use. */
export const MAGIC_LINK_TTL_MS = 10 * 60 * 1000;
/** Minimum gap between two links to the same address. Mirrored by the UI cooldown. */
export const MAGIC_LINK_RESEND_COOLDOWN_MS = 60 * 1000;
export const MAGIC_LINK_EMAIL_WINDOW_MS = 15 * 60 * 1000;
export const MAGIC_LINK_MAX_PER_EMAIL_PER_WINDOW = 5;
/** 32 bytes = 256 bits of entropy. Guessing is not a threat model at this size. */
export const MAGIC_LINK_TOKEN_BYTES = 32;
/** Consumed and expired rows are kept this long as an operational trail, then pruned. */
export const MAGIC_LINK_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * The ONLY thing `/request` ever says. Identical for a real account, a revoked
 * account, a typo, and an address we have never seen.
 */
export const MAGIC_LINK_GENERIC_MESSAGE =
  'If that address has a Violema account, a sign-in link is on its way.';

/**
 * The ONLY thing a failed `/consume` ever says. Expired, already used,
 * tampered, and "belongs to a revoked account" are one message on purpose.
 */
export const MAGIC_LINK_INVALID_MESSAGE =
  'That sign-in link is no longer valid. Request a new one.';

export const MAGIC_LINK_EMAIL_SUBJECT = 'Your Violema sign-in link';

export interface MagicLinkTokenRecord {
  id: string;
  email: string;
  /** sha256 of the plaintext token. The plaintext is never stored anywhere. */
  tokenHash: string;
  next: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  createdIp?: string;
  userAgent?: string;
}

export type MagicLinkIneligibleReason =
  | 'invalid_email'
  | 'no_auth_user'
  | 'no_access_record'
  | 'identity_not_verified'
  | 'not_approved'
  | 'access_store_unreadable';

export type MagicLinkRecipient =
  | { eligible: true; user: AuthUserRecord; access: AdminAccessRecord }
  | { eligible: false; reason: MagicLinkIneligibleReason };

export type MagicLinkConsumeFailure =
  | 'missing_token'
  | 'malformed_token'
  | 'not_found'
  | 'expired'
  | 'used';

export type MagicLinkConsumeResult =
  | { ok: true; record: MagicLinkTokenRecord }
  | { ok: false; reason: MagicLinkConsumeFailure };

export type MagicLinkRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'cooldown' | 'window' };

export type MagicLinkDeliveryOutcome =
  | { delivered: true; tokenId: string; email: string }
  | { delivered: false; reason: MagicLinkIneligibleReason | 'cooldown' | 'window' | 'send_failed' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_USER_AGENT_LENGTH = 200;
const MAX_NEXT_LENGTH = 512;

/**
 * Where a sign-in link is allowed to land. An allowlist rather than a
 * "starts with /" check: that alone would happily forward to `/\evil.com`,
 * which several browsers normalize into a protocol-relative URL. Every entry is
 * a real route in `frontend/src/App.tsx`.
 */
export const MAGIC_LINK_NEXT_ALLOWED_ROOTS: ReadonlySet<string> = new Set([
  'dashboard',
  'plans',
  'pricing',
  'settings',
  'integrations',
  'connect',
  'admin',
  'access-terms',
  'runs',
  'faq',
  'privacy',
  'terms',
]);

export const MAGIC_LINK_DEFAULT_NEXT = '/dashboard';

function getTokenFile() {
  return path.join(process.cwd(), 'auth-magic-link-tokens.json');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate a post-login destination against the internal-route allowlist.
 *
 * Rejects anything that is not an absolute in-app path: absolute URLs,
 * protocol-relative `//host`, backslash tricks, control characters, and any
 * first segment that is not a known route. Falls back to `/dashboard` rather
 * than failing the sign-in, because the destination is a convenience and the
 * session is the point.
 */
export function sanitizeMagicLinkNext(value: string | undefined, fallback = MAGIC_LINK_DEFAULT_NEXT): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_NEXT_LENGTH) return fallback;
  if (!trimmed.startsWith('/')) return fallback;
  // `//host` is protocol-relative; `\` is normalized to `/` by several browsers.
  if (trimmed.startsWith('//') || trimmed.includes('\\')) return fallback;
  // Control characters and embedded whitespace can smuggle a header or URL
  // break past a naive "starts with /" check. Checked by code point so no
  // control byte has to live in this source file.
  if (Array.from(trimmed).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  })) return fallback;

  const pathOnly = trimmed.split(/[?#]/)[0] || '/';
  const root = pathOnly.split('/').filter(Boolean)[0] || '';
  if (!MAGIC_LINK_NEXT_ALLOWED_ROOTS.has(root)) return fallback;
  return trimmed;
}

/**
 * Read the token store, failing CLOSED.
 *
 * Deliberately not `readJsonFile`. That helper quarantines a corrupt file and
 * restores the `.bak` snapshot — correct for a ledger, wrong for single-use
 * credentials: the backup is taken BEFORE each write, so restoring it would
 * resurrect the most recently consumed token as unused and hand back a replay
 * window. An unreadable store here means "no valid links exist"; the worst case
 * is that pending links stop working and users request another. Writes still go
 * through `writeJsonFile` for its atomic temp-file-and-rename durability.
 */
function readTokens(): MagicLinkTokenRecord[] {
  const filePath = getTokenFile();
  let rows: unknown;
  try {
    if (!fs.existsSync(filePath)) return [];
    rows = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  } catch (error) {
    console.error(
      '[magic-link] token store is unreadable; treating every link as invalid:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is MagicLinkTokenRecord => {
    if (!row || typeof row !== 'object') return false;
    const candidate = row as Partial<MagicLinkTokenRecord>;
    return typeof candidate.id === 'string'
      && typeof candidate.email === 'string'
      && typeof candidate.tokenHash === 'string'
      && typeof candidate.next === 'string'
      && typeof candidate.createdAt === 'string'
      && typeof candidate.expiresAt === 'string';
  });
}

function writeTokens(records: MagicLinkTokenRecord[]) {
  writeJsonFile(getTokenFile(), records);
}

function pruneTokens(records: MagicLinkTokenRecord[], nowMs: number) {
  return records.filter((record) => {
    const expiresAt = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresAt)) return false;
    return nowMs - expiresAt <= MAGIC_LINK_RETENTION_MS;
  });
}

/** Read-only view for tests and operational inspection. Never returns plaintext. */
export function listMagicLinkTokens(): MagicLinkTokenRecord[] {
  return readTokens();
}

export function clearMagicLinkTokens() {
  writeTokens([]);
}

/**
 * The gate. An address may only be sent a link when it ALREADY has:
 *
 *   1. an auth user record (it has signed in before), and
 *   2. an access record whose `identityVerifiedAt` was written by an OAuth
 *      callback, with an OAuth `method` — a magic link never establishes this,
 *      and
 *   3. `status === 'approved'` — a manual admin decision. `requested` and
 *      `revoked` are both refused.
 *
 * An unreadable access store fails closed: no link is issued.
 */
export function resolveMagicLinkRecipient(email: string): MagicLinkRecipient {
  const normalized = normalizeEmail(email || '');
  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return { eligible: false, reason: 'invalid_email' };
  }

  let user: AuthUserRecord | undefined;
  try {
    user = listAuthUsers().find((item) => item.email === normalized);
  } catch {
    return { eligible: false, reason: 'access_store_unreadable' };
  }
  if (!user) return { eligible: false, reason: 'no_auth_user' };

  let access: AdminAccessRecord | null;
  try {
    access = getAccessRecord(normalized);
  } catch {
    // A malformed admin-access store must not be a way to bypass approval.
    return { eligible: false, reason: 'access_store_unreadable' };
  }
  if (!access) return { eligible: false, reason: 'no_access_record' };

  // Identity verification is OAuth's to assert. This module only ever reads it.
  if (!access.identityVerifiedAt) return { eligible: false, reason: 'identity_not_verified' };
  if (access.method !== 'google' && access.method !== 'microsoft') {
    return { eligible: false, reason: 'identity_not_verified' };
  }

  if (access.status !== 'approved') return { eligible: false, reason: 'not_approved' };

  return { eligible: true, user, access };
}

/**
 * Per-address throttle, on top of the per-IP `sensitiveApiLimiter`. Counts
 * issued rows regardless of whether they were used, so a burst cannot be reset
 * by clicking a link.
 */
export function checkMagicLinkEmailRateLimit(
  email: string,
  options: { nowMs?: number } = {},
): MagicLinkRateLimitResult {
  const nowMs = options.nowMs ?? Date.now();
  const normalized = normalizeEmail(email || '');
  const issued = readTokens()
    .filter((record) => record.email === normalized)
    .map((record) => Date.parse(record.createdAt))
    .filter((value) => Number.isFinite(value));

  if (issued.some((createdAt) => nowMs - createdAt < MAGIC_LINK_RESEND_COOLDOWN_MS)) {
    return { allowed: false, reason: 'cooldown' };
  }
  const inWindow = issued.filter((createdAt) => nowMs - createdAt < MAGIC_LINK_EMAIL_WINDOW_MS);
  if (inWindow.length >= MAGIC_LINK_MAX_PER_EMAIL_PER_WINDOW) {
    return { allowed: false, reason: 'window' };
  }
  return { allowed: true };
}

/**
 * Mint a token. Returns the plaintext ONCE, to the caller that will put it in
 * the email; only the hash is persisted.
 *
 * Callers must have passed `resolveMagicLinkRecipient` first — this function
 * deliberately does not re-check eligibility, so that the check lives in exactly
 * one place and `deliverMagicLinkSignIn` is the only supported entry point.
 */
export function issueMagicLinkToken(input: {
  email: string;
  next?: string;
  nowMs?: number;
  ttlMs?: number;
  createdIp?: string;
  userAgent?: string;
}): { token: string; record: MagicLinkTokenRecord } {
  const email = normalizeEmail(input.email);
  if (!email || !EMAIL_PATTERN.test(email)) throw new Error('valid email is required');

  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = input.ttlMs ?? MAGIC_LINK_TTL_MS;
  const token = crypto.randomBytes(MAGIC_LINK_TOKEN_BYTES).toString('base64url');
  const record: MagicLinkTokenRecord = {
    id: `magiclink_${nowMs}_${crypto.randomBytes(4).toString('hex')}`,
    email,
    tokenHash: hashToken(token),
    next: sanitizeMagicLinkNext(input.next),
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
    ...(input.createdIp ? { createdIp: input.createdIp.slice(0, 64) } : {}),
    ...(input.userAgent ? { userAgent: input.userAgent.slice(0, MAX_USER_AGENT_LENGTH) } : {}),
  };

  writeTokens([record, ...pruneTokens(readTokens(), nowMs)]);
  return { token, record };
}

/**
 * Single-use consumption.
 *
 * The read, the validity check, and the `usedAt` write happen in one
 * synchronous turn with blocking fs calls, so two concurrent requests carrying
 * the same token cannot both observe it unused — the second sees `used`.
 */
export function consumeMagicLinkToken(
  token: string | undefined,
  options: { nowMs?: number } = {},
): MagicLinkConsumeResult {
  const nowMs = options.nowMs ?? Date.now();
  if (typeof token !== 'string' || !token.trim()) return { ok: false, reason: 'missing_token' };
  const trimmed = token.trim();
  // Cheap shape gate before hashing: a real token is base64url of 32 bytes.
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(trimmed)) return { ok: false, reason: 'malformed_token' };

  const tokenHash = hashToken(trimmed);
  const records = readTokens();
  const index = records.findIndex((record) => record.tokenHash === tokenHash);
  if (index < 0) return { ok: false, reason: 'not_found' };

  const record = records[index];
  if (record.usedAt) return { ok: false, reason: 'used' };

  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || nowMs > expiresAt) return { ok: false, reason: 'expired' };

  const consumed: MagicLinkTokenRecord = { ...record, usedAt: new Date(nowMs).toISOString() };
  const next = pruneTokens(records.map((item, position) => (position === index ? consumed : item)), nowMs);
  writeTokens(next);
  return { ok: true, record: consumed };
}

/**
 * Plain transactional copy. No tracking pixel, no HTML, no marketing — this is
 * a credential, and it should read like one.
 */
export function buildMagicLinkEmail(input: { link: string; name?: string }) {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi,';
  return {
    subject: MAGIC_LINK_EMAIL_SUBJECT,
    body: [
      greeting,
      '',
      'Here is your sign-in link for Violema:',
      '',
      input.link,
      '',
      'It expires in 10 minutes and can be used once.',
      '',
      'If you did not ask to sign in, you can ignore this email — nothing will happen.',
      '',
      '— Violema',
    ].join('\n'),
  };
}

export function buildMagicLinkUrl(origin: string, token: string) {
  return `${origin.replace(/\/+$/, '')}/api/auth/magic-link/consume?token=${encodeURIComponent(token)}`;
}

export interface MagicLinkDeliveryDeps {
  sendEmail: (input: { to: string; subject: string; body: string }) => Promise<unknown>;
  nowMs?: number;
}

/**
 * The single supported way to send a link: check eligibility, check the
 * per-address throttle, mint, send.
 *
 * The outcome is for logs and tests only. Route handlers must answer with
 * `MAGIC_LINK_GENERIC_MESSAGE` in every branch — the reason codes here are
 * exactly the facts a caller must not learn.
 */
export async function deliverMagicLinkSignIn(
  input: {
    email: string;
    next?: string;
    origin: string;
    createdIp?: string;
    userAgent?: string;
  },
  deps: MagicLinkDeliveryDeps,
): Promise<MagicLinkDeliveryOutcome> {
  const recipient = resolveMagicLinkRecipient(input.email);
  if (!recipient.eligible) return { delivered: false, reason: recipient.reason };

  const nowMs = deps.nowMs ?? Date.now();
  const throttle = checkMagicLinkEmailRateLimit(recipient.user.email, { nowMs });
  if (!throttle.allowed) return { delivered: false, reason: throttle.reason };

  const { token, record } = issueMagicLinkToken({
    email: recipient.user.email,
    next: input.next,
    nowMs,
    createdIp: input.createdIp,
    userAgent: input.userAgent,
  });

  const message = buildMagicLinkEmail({
    link: buildMagicLinkUrl(input.origin, token),
    name: recipient.user.name,
  });

  try {
    await deps.sendEmail({ to: recipient.user.email, subject: message.subject, body: message.body });
  } catch (error) {
    console.error('[magic-link] delivery failed', error instanceof Error ? error.message : error);
    return { delivered: false, reason: 'send_failed' };
  }

  return { delivered: true, tokenId: record.id, email: recipient.user.email };
}
