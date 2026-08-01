import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const ENV_KEYS = [
  'NODE_ENV',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_ID_STARTER',
  'STRIPE_PRICE_ID_PRO',
  'STRIPE_PRICE_ID_TEAM',
  'STRIPE_TOP_UP_PRICE_ID_TOPUP_500',
] as const;

const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-stripe-prod-'));
process.chdir(tempDir);

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function withEnv<T>(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string') process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const key of ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === 'string') process.env[key] = value;
    }
  }
}

function assertBillingNotConfigured(error: unknown) {
  assert.ok(error instanceof Error, 'expected an Error');
  assert.equal((error as Error & { code?: string }).code, 'billing_not_configured');
  assert.equal((error as Error & { statusCode?: number }).statusCode, 503);
  return true;
}

test('production subscription checkout fails closed instead of returning a mock session', async () => {
  const { createSubscriptionCheckoutSession } = await import('../src/platform/stripe');

  await withEnv({ NODE_ENV: 'production' }, async () => {
    await assert.rejects(
      () => createSubscriptionCheckoutSession('ws_test_billing', 'pro'),
      assertBillingNotConfigured,
    );
  });
});

test('production subscription checkout fails closed when the price exists but Stripe does not', async () => {
  const { createSubscriptionCheckoutSession } = await import('../src/platform/stripe');

  await withEnv({ NODE_ENV: 'production', STRIPE_PRICE_ID_PRO: 'price_configured' }, async () => {
    await assert.rejects(
      () => createSubscriptionCheckoutSession('ws_test_billing', 'pro'),
      assertBillingNotConfigured,
    );
  });
});

test('production top-up checkout fails closed instead of returning a mock session', async () => {
  const { createTopUpCheckoutSession } = await import('../src/platform/stripe');

  await withEnv({ NODE_ENV: 'production' }, async () => {
    await assert.rejects(
      () => createTopUpCheckoutSession('ws_test_billing', 'topup_500'),
      assertBillingNotConfigured,
    );
  });
});

test('non-production keeps the mock checkout session for local development', async () => {
  const { createSubscriptionCheckoutSession, createTopUpCheckoutSession } = await import('../src/platform/stripe');

  await withEnv({ NODE_ENV: 'test' }, async () => {
    const subscription = await createSubscriptionCheckoutSession('ws_test_billing', 'pro');
    assert.equal(subscription.provider, 'mock');
    assert.equal(subscription.status, 'mocked');

    const topUp = await createTopUpCheckoutSession('ws_test_billing', 'topup_500');
    assert.equal(topUp.provider, 'mock');
    assert.equal(topUp.status, 'mocked');
  });
});
