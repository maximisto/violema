/**
 * Postmark bounce/complaint suppressions.
 *
 * Promised to Postmark during account approval (2026-08-02): when they tell us
 * an address hard-bounced or complained, we stop mailing it. This module is
 * that promise made mechanical — the webhook records the fact, and the ONE
 * outbound email path (`sendEmailMessage` in integrations.ts) refuses
 * suppressed recipients before touching the API.
 *
 * Design choices, stated because they are deliberate:
 *
 * - Suppress on HardBounce and on spam complaints (both the `SpamComplaint`
 *   record type and the `SpamNotification` bounce type). Transient bounces,
 *   auto-responders, deliveries, opens: acknowledged and ignored — retrying a
 *   full mailbox tomorrow is correct behaviour.
 *
 * - An unreadable store logs loudly and lets mail flow. The opposite default
 *   (fail closed) would turn one corrupt write into "every delivery, every
 *   magic link, every approval email silently stops". Suppression protects
 *   sender reputation; it is not an access-control boundary like the admin
 *   access store, so it does not inherit that store's fail-closed rule.
 *
 * - Suppressions never expire on their own. Postmark can reactivate a bounce
 *   on their side; on ours, removal is a deliberate operator edit of the
 *   store, not a timeout.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type EmailSuppressionReason = 'hard_bounce' | 'spam_complaint';

export interface EmailSuppressionRecord {
  email: string;
  reason: EmailSuppressionReason;
  /** Postmark's RecordType, kept verbatim for the audit trail. */
  recordType: string;
  /** Postmark's bounce Type when present (e.g. HardBounce, SpamNotification). */
  bounceType?: string;
  /** Postmark's human-readable Description/Details — no message bodies. */
  detail?: string;
  messageId?: string;
  suppressedAt: string;
}

export type PostmarkWebhookDecision =
  | { action: 'suppress'; email: string; reason: EmailSuppressionReason; recordType: string; bounceType?: string; detail?: string; messageId?: string }
  | { action: 'ignore'; recordType: string };

function getSuppressionsFile() {
  return path.join(process.cwd(), 'email-suppressions.json');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readRecords(): EmailSuppressionRecord[] {
  const filePath = getSuppressionsFile();
  try {
    if (!fs.existsSync(filePath)) return [];
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    if (!Array.isArray(rows)) throw new Error('suppression store must be a JSON array');
    return rows.filter((row): row is EmailSuppressionRecord => {
      if (!row || typeof row !== 'object') return false;
      const record = row as Record<string, unknown>;
      return typeof record.email === 'string'
        && (record.reason === 'hard_bounce' || record.reason === 'spam_complaint')
        && typeof record.suppressedAt === 'string';
    });
  } catch (error) {
    // Deliberate fail-open — see the module header for why. Loud, per-call.
    console.error(
      '[email-suppressions] store unreadable; treating as empty and NOT blocking sends',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function writeRecords(records: EmailSuppressionRecord[]) {
  fs.writeFileSync(getSuppressionsFile(), JSON.stringify(records, null, 2));
}

/**
 * Map a Postmark webhook payload to a decision. Pure — the webhook route owns
 * auth and persistence, this owns the (small) policy.
 */
export function classifyPostmarkWebhook(payload: unknown): PostmarkWebhookDecision {
  const record = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const recordType = typeof record.RecordType === 'string' ? record.RecordType : 'unknown';
  const email = typeof record.Email === 'string' ? normalizeEmail(record.Email)
    : typeof record.Recipient === 'string' ? normalizeEmail(record.Recipient)
      : '';
  const bounceType = typeof record.Type === 'string' ? record.Type : undefined;
  const detail = typeof record.Description === 'string' ? record.Description.slice(0, 300)
    : typeof record.Details === 'string' ? record.Details.slice(0, 300)
      : undefined;
  const messageId = typeof record.MessageID === 'string' ? record.MessageID : undefined;

  if (!email || !email.includes('@')) return { action: 'ignore', recordType };

  if (recordType === 'SpamComplaint') {
    return { action: 'suppress', email, reason: 'spam_complaint', recordType, bounceType, detail, messageId };
  }
  if (recordType === 'Bounce') {
    if (bounceType === 'HardBounce') {
      return { action: 'suppress', email, reason: 'hard_bounce', recordType, bounceType, detail, messageId };
    }
    if (bounceType === 'SpamComplaint' || bounceType === 'SpamNotification') {
      return { action: 'suppress', email, reason: 'spam_complaint', recordType, bounceType, detail, messageId };
    }
  }
  return { action: 'ignore', recordType };
}

/** Append-once: a second event for the same address updates nothing. */
export function recordEmailSuppression(
  decision: Extract<PostmarkWebhookDecision, { action: 'suppress' }>,
  options: { now?: () => string } = {},
): { recorded: boolean } {
  const records = readRecords();
  if (records.some((row) => normalizeEmail(row.email) === decision.email)) {
    return { recorded: false };
  }
  const record: EmailSuppressionRecord = {
    email: decision.email,
    reason: decision.reason,
    recordType: decision.recordType,
    ...(decision.bounceType ? { bounceType: decision.bounceType } : {}),
    ...(decision.detail ? { detail: decision.detail } : {}),
    ...(decision.messageId ? { messageId: decision.messageId } : {}),
    suppressedAt: options.now ? options.now() : new Date().toISOString(),
  };
  writeRecords([...records, record]);
  return { recorded: true };
}

export function isEmailSuppressed(email: string): EmailSuppressionRecord | null {
  const normalized = normalizeEmail(email || '');
  if (!normalized) return null;
  return readRecords().find((row) => normalizeEmail(row.email) === normalized) || null;
}

export function listEmailSuppressions(): EmailSuppressionRecord[] {
  return readRecords();
}

/**
 * Shared-secret check for the webhook route. Accepts the secret either as
 * Basic auth password or as a bearer-style token value; constant-time compare
 * so the route cannot be probed byte by byte.
 */
export function verifyPostmarkWebhookSecret(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
