import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERAL_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  SENSITIVE_RATE_LIMIT_MAX,
  SENSITIVE_RATE_LIMIT_PREFIXES,
  isRateLimitExempt,
  isSensitiveRateLimitPath,
} from '../src/security';

test('rate limit window and ceilings are sane', () => {
  assert.equal(RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.ok(GENERAL_RATE_LIMIT_MAX > 0);
  assert.ok(SENSITIVE_RATE_LIMIT_MAX > 0);
  assert.ok(
    SENSITIVE_RATE_LIMIT_MAX < GENERAL_RATE_LIMIT_MAX,
    'sensitive endpoints must be stricter than the general ceiling',
  );
});

test('the SSE stream and signed webhooks are exempt from the general limiter', () => {
  assert.equal(isRateLimitExempt('/api/platform/stream'), true);
  assert.equal(isRateLimitExempt('/api/billing/stripe/webhook'), true);
  assert.equal(isRateLimitExempt('/api/slack/events'), true);
});

test('normal API paths are NOT exempt from the general limiter', () => {
  assert.equal(isRateLimitExempt('/api/missions'), false);
  assert.equal(isRateLimitExempt('/api/automations/abc/run'), false);
  assert.equal(isRateLimitExempt('/api/auth/session'), false);
});

test('the strict limiter targets only magic login and the public waitlist', () => {
  assert.equal(isSensitiveRateLimitPath('/api/auth/admin/magic'), true);
  assert.equal(isSensitiveRateLimitPath('/api/waitlist'), true);
});

test('the strict limiter covers the magic-link request route but not the consume route', () => {
  // Requesting a link is unauthenticated, accepts an arbitrary address, and
  // sends real mail — the classic spray target.
  assert.equal(isSensitiveRateLimitPath('/api/auth/magic-link/request'), true);
  assert.ok(SENSITIVE_RATE_LIMIT_PREFIXES.includes('/api/auth/magic-link/request'));
  // Consuming carries a 256-bit token, so brute force is not the threat;
  // throttling it would lock out everyone behind one office NAT.
  assert.equal(isSensitiveRateLimitPath('/api/auth/magic-link/consume'), false);
});

test('the strict limiter covers the Composio connect and disconnect routes', () => {
  // Each call hits a third-party API and mutates live integration state, so
  // they belong on the tight ceiling rather than the general one.
  assert.equal(isSensitiveRateLimitPath('/api/integrations/composio/connect'), true);
  assert.equal(isSensitiveRateLimitPath('/api/integrations/composio/disconnect'), true);
  assert.ok(SENSITIVE_RATE_LIMIT_PREFIXES.includes('/api/integrations/composio/connect'));
  assert.ok(SENSITIVE_RATE_LIMIT_PREFIXES.includes('/api/integrations/composio/disconnect'));
  // Read-only integration surfaces stay on the general limiter.
  assert.equal(isSensitiveRateLimitPath('/api/integrations/catalog'), false);
  assert.equal(isSensitiveRateLimitPath('/api/integrations/composio/status'), false);
  assert.equal(isSensitiveRateLimitPath('/api/integrations/composio/connections'), false);
});

test('the strict limiter covers the outbound-fetch and Drive-write library routes', () => {
  // /library/url makes up to 4 outbound fetches (10s, 500 KB each) to an
  // arbitrary attacker-chosen host and then writes a Drive file — the same
  // profile as the Composio connect routes, but it sat at 1200/15min on the
  // general limiter. /folder-drop/share mutates a real Drive permission per
  // call.
  assert.equal(isSensitiveRateLimitPath('/api/workspace/library/url'), true);
  assert.equal(isSensitiveRateLimitPath('/api/workspace/library/folder-drop/share'), true);
  assert.ok(SENSITIVE_RATE_LIMIT_PREFIXES.includes('/api/workspace/library/url'));
  assert.ok(SENSITIVE_RATE_LIMIT_PREFIXES.includes('/api/workspace/library/folder-drop/share'));

  // The read-only status route stays on the general limiter — the settings
  // page polls it on every load.
  assert.equal(isSensitiveRateLimitPath('/api/workspace/library/folder-drop'), false);
  assert.equal(isSensitiveRateLimitPath('/api/workspace/library'), false);
});

test('the strict limiter never catches the OAuth flow or session reads', () => {
  // These stay on the general limiter so logins and session polling are not throttled.
  assert.equal(isSensitiveRateLimitPath('/api/auth/session'), false);
  assert.equal(isSensitiveRateLimitPath('/api/auth/google/start'), false);
  assert.equal(isSensitiveRateLimitPath('/api/auth/google/callback'), false);
  assert.equal(isSensitiveRateLimitPath('/api/missions'), false);
});
