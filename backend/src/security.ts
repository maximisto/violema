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
]);

export function isRateLimitExempt(path: string): boolean {
  return RATE_LIMIT_EXEMPT_PATHS.has(path);
}

// Express path prefixes that get the stricter sensitive limiter. Scoped to the
// genuine unauthenticated abuse targets — the admin magic login (brute force)
// and the public waitlist (spam) — so it never false-positives on the OAuth
// flow or session reads, which the general limiter still protects.
export const SENSITIVE_RATE_LIMIT_PREFIXES: readonly string[] = [
  '/api/auth/admin',
  '/api/waitlist',
];

export function isSensitiveRateLimitPath(path: string): boolean {
  return SENSITIVE_RATE_LIMIT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
