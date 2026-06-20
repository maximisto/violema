import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERAL_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  SENSITIVE_RATE_LIMIT_MAX,
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

test('the strict limiter never catches the OAuth flow or session reads', () => {
  // These stay on the general limiter so logins and session polling are not throttled.
  assert.equal(isSensitiveRateLimitPath('/api/auth/session'), false);
  assert.equal(isSensitiveRateLimitPath('/api/auth/google/start'), false);
  assert.equal(isSensitiveRateLimitPath('/api/auth/google/callback'), false);
  assert.equal(isSensitiveRateLimitPath('/api/missions'), false);
});
