// Thread-scoped state for the v1 "request changes" flow.
//
// Slack's button click carries no free text, so the change note arrives as the
// operator's NEXT message in that thread. This holds the small amount of state
// that links the two, keyed by channel + thread.
//
// Deliberately in-memory and deliberately expiring:
//  - in-memory, because a restart losing a 15-minute-old prompt is honest
//    (the operator retries) whereas persisting it would create a durable
//    record whose staleness we would then have to explain;
//  - expiring, because a note typed an hour later is a new thought, not an
//    answer to a question the thread has forgotten.
//
// No message content is ever stored here — only the routing identifiers.

export const SLACK_CHANGE_REQUEST_TTL_MS = 15 * 60 * 1000;

export interface PendingChangeRequest {
  automationId: string;
  runId: string;
  workspaceId: string;
  channel: string;
  threadTs: string;
  /** ts of the review card, so the outcome updates the right message. */
  reviewMessageTs: string;
  requestedBySlackUserId: string;
  /** Epoch milliseconds. */
  requestedAt: number;
}

export type PendingChangeRequestInput = Omit<PendingChangeRequest, 'requestedAt'>;

const pending = new Map<string, PendingChangeRequest>();

function keyFor(input: { channel: string; threadTs: string }) {
  return `${input.channel}:${input.threadTs}`;
}

function prune(nowMs: number) {
  for (const [key, entry] of pending.entries()) {
    if (nowMs - entry.requestedAt > SLACK_CHANGE_REQUEST_TTL_MS) {
      pending.delete(key);
    }
  }
}

export function registerPendingChangeRequest(
  input: PendingChangeRequestInput,
  now: () => number = Date.now,
): PendingChangeRequest {
  const nowMs = now();
  prune(nowMs);
  const entry: PendingChangeRequest = { ...input, requestedAt: nowMs };
  pending.set(keyFor(input), entry);
  return entry;
}

/**
 * Returns the pending request for a thread and removes it, so a single prompt
 * consumes exactly one reply. Expired entries are evicted and reported as
 * absent rather than applied late.
 */
export function consumePendingChangeRequest(
  key: { channel: string; threadTs: string; slackUserId?: string },
  now: () => number = Date.now,
): PendingChangeRequest | null {
  const nowMs = now();
  prune(nowMs);
  const entry = pending.get(keyFor(key));
  if (!entry) return null;
  // A note belongs to the operator who asked for changes. Someone else typing
  // in the thread leaves the request open for its owner rather than speaking
  // for them.
  if (key.slackUserId && entry.requestedBySlackUserId && entry.requestedBySlackUserId !== key.slackUserId) {
    return null;
  }
  pending.delete(keyFor(key));
  if (nowMs - entry.requestedAt > SLACK_CHANGE_REQUEST_TTL_MS) return null;
  return entry;
}

export function hasPendingChangeRequest(
  key: { channel: string; threadTs: string },
  now: () => number = Date.now,
): boolean {
  prune(now());
  return pending.has(keyFor(key));
}

/** Test hook: the map is process-global, so suites must be able to reset it. */
export function clearPendingChangeRequests() {
  pending.clear();
}
