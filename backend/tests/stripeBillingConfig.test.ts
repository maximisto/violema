import assert from 'node:assert/strict';
import test from 'node:test';

const ENV_KEYS = [
  'PUBLIC_APP_URL',
  'APP_BASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_SUCCESS_URL',
  'STRIPE_CANCEL_URL',
  'STRIPE_PRICE_ID_PRO',
  'STRIPE_PRICE_ID_TEAM',
] as const;

test('Stripe billing config maps the public pricing ladder and return URLs', async () => {
  const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  process.env.PUBLIC_APP_URL = 'https://violema.com';
  process.env.STRIPE_PRICE_ID_PRO = 'price_start_79';
  process.env.STRIPE_PRICE_ID_TEAM = 'price_pro_249';

  try {
    const { getStripeBillingConfig } = await import('../src/platform/stripe');
    const config = getStripeBillingConfig('stripe_contract_workspace');
    const start = config.plans.find((plan) => plan.id === 'pro');
    const pro = config.plans.find((plan) => plan.id === 'team');

    assert.equal(config.successUrl, 'https://violema.com/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    assert.equal(config.cancelUrl, 'https://violema.com/pricing?checkout=cancel');
    assert.equal(config.subscriptionPriceIds.pro, 'price_start_79');
    assert.equal(config.subscriptionPriceIds.team, 'price_pro_249');
    assert.equal(start?.name, 'Start');
    assert.equal(start?.monthlyPriceUsd, 79);
    assert.equal(start?.includedCredits, 2000);
    assert.equal(pro?.name, 'Pro');
    assert.equal(pro?.monthlyPriceUsd, 249);
    assert.equal(pro?.includedCredits, 7500);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'string') {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  }
});
