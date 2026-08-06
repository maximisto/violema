// Centralized, testable configuration for HTTP hardening (helmet + rate limiting).
// The middleware itself is wired in server.ts; the values and the skip predicate
// live here so they can be unit-tested without standing up the HTTP server.

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Generous ceiling for authenticated dashboard traffic. The long-lived SSE
// stream and provider webhooks are exempt (see RATE_LIMIT_EXEMPT_PATHS), so this
// guards against floods and abusive sessions without breaking normal use.
export const GENERAL_RATE_LIMIT_MAX = 1200;

// Tight ceiling for unauthenticated / abuse-sensitive endpoints: the waitlist,
// the admin magic login, and the OAuth + session routes. Per client IP.
export const SENSITIVE_RATE_LIMIT_MAX = 30;

// Paths that must NOT be counted by the general limiter:
// - the SSE stream is a single long-lived connection
// - provider webhooks are signature-verified and can legitimately burst
export const RATE_LIMIT_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/platform/stream',
  '/api/billing/stripe/webhook',
  '/api/slack/events',
  // Slack interactivity shares the events path's protection model: every
  // request is signature-verified before it is read, and a burst of button
  // clicks during a review sweep is legitimate traffic.
  '/api/slack/interactions',
]);

export function isRateLimitExempt(path: string): boolean {
  return RATE_LIMIT_EXEMPT_PATHS.has(path);
}

// Express path prefixes that get the stricter sensitive limiter. Scoped to the
// genuine abuse targets — the admin magic login (brute force), the public
// waitlist (spam), and the Composio connect/disconnect routes (each call hits a
// third-party API and mutates a workspace's live integration state) — so it
// never false-positives on the OAuth flow or session reads, which the general
// limiter still protects.
export const SENSITIVE_RATE_LIMIT_PREFIXES: readonly string[] = [
  '/api/auth/admin',
  // The magic-link request route: unauthenticated, takes an arbitrary address,
  // and each accepted call sends real mail. The per-IP ceiling here is the
  // outer bound; a per-address cooldown and window live in authMagicLink.ts, so
  // one IP cannot spray many addresses and one address cannot be flooded from
  // many IPs. The consume route is deliberately NOT here: its tokens carry 256
  // bits of entropy, and throttling it would lock out an office behind one NAT.
  '/api/auth/magic-link/request',
  '/api/waitlist',
  '/api/integrations/composio/connect',
  '/api/integrations/composio/disconnect',
  // The library URL paste: one call makes up to four outbound fetches (10s,
  // 500 KB each) to a host the CALLER chooses, then writes a Drive file. That
  // is a server-side request amplifier aimed at arbitrary targets — the SSRF
  // guard decides WHERE it may go, and this decides HOW OFTEN.
  '/api/workspace/library/url',
  // Folder-drop share: each call mutates a real Drive permission through a
  // third-party API — the same profile as the Composio routes above. The
  // read-only `/folder-drop` status route is deliberately NOT here; the
  // settings page polls it on every load.
  '/api/workspace/library/folder-drop/share',
];

export function isSensitiveRateLimitPath(path: string): boolean {
  return SENSITIVE_RATE_LIMIT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
