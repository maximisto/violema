import assert from 'node:assert/strict';
import test from 'node:test';
import {
  queryStripeRevenue,
  type StripeLikeClient,
} from '../src/integrationGateway/adapters/nativeStripe';

const now = new Date('2026-06-29T12:00:00.000Z');

function fakeStripeClient(): StripeLikeClient {
  return {
    subscriptions: {
      async list() {
        return {
          data: [
            {
              id: 'sub_active_month',
              status: 'active',
              created: Math.floor(Date.parse('2026-06-15T12:00:00.000Z') / 1000),
              canceled_at: null,
              currency: 'usd',
              items: {
                data: [
                  {
                    quantity: 2,
                    price: {
                      unit_amount: 5000,
                      recurring: { interval: 'month', interval_count: 1 },
                    },
                  },
                ],
              },
            },
            {
              id: 'sub_active_year',
              status: 'active',
              created: Math.floor(Date.parse('2026-03-01T12:00:00.000Z') / 1000),
              canceled_at: null,
              currency: 'usd',
              items: {
                data: [
                  {
                    quantity: 1,
                    price: {
                      unit_amount: 120000,
                      recurring: { interval: 'year', interval_count: 1 },
                    },
                  },
                ],
              },
            },
            {
              id: 'sub_churned',
              status: 'canceled',
              created: Math.floor(Date.parse('2026-01-01T12:00:00.000Z') / 1000),
              canceled_at: Math.floor(Date.parse('2026-06-20T12:00:00.000Z') / 1000),
              currency: 'usd',
              items: {
                data: [
                  {
                    quantity: 1,
                    price: {
                      unit_amount: 2500,
                      recurring: { interval: 'month', interval_count: 1 },
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    },
    invoices: {
      async list() {
        return {
          data: [
            {
              id: 'in_failed_1',
              status: 'open',
              amount_remaining: 4200,
              currency: 'usd',
              created: Math.floor(Date.parse('2026-06-28T12:00:00.000Z') / 1000),
              attempt_count: 2,
              next_payment_attempt: Math.floor(Date.parse('2026-06-30T12:00:00.000Z') / 1000),
            },
          ],
        };
      },
    },
    charges: {
      async list() {
        return {
          data: [
            {
              id: 'ch_failed_1',
              status: 'failed',
              amount: 1800,
              currency: 'usd',
              created: Math.floor(Date.parse('2026-06-27T12:00:00.000Z') / 1000),
            },
          ],
        };
      },
    },
  };
}

test('queryStripeRevenue normalizes live Stripe revenue signals', async () => {
  const result = await queryStripeRevenue({
    workspaceId: 'workspace_test',
    queryType: 'revenue_summary',
    now,
    client: fakeStripeClient(),
    secretKey: 'sk_test_injected',
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.ok, true);

  assert.equal(result.source, 'stripe');
  assert.equal(result.query_type, 'revenue_summary');
  assert.equal(result.live, true);
  assert.equal(result.cache_hit, false);
  assert.equal(result.data.currency, 'USD');
  assert.equal(result.data.mrr, 20000);
  assert.equal(result.data.arr, 240000);
  assert.equal(result.data.active_subscriptions, 2);
  assert.equal(result.data.new_subscriptions, 1);
  assert.equal(result.data.churned, 1);
  assert.equal(result.data.failed_payments.count, 2);
  assert.equal(result.data.failed_payments.at_risk_revenue, 60);
});

test('queryStripeRevenue returns readiness error instead of fake data when credentials are missing', async () => {
  const result = await queryStripeRevenue({
    workspaceId: 'workspace_missing',
    queryType: 'revenue_summary',
    now,
  });

  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.ok, false);

  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.source, 'stripe');
  assert.equal(result.workflowId, 'revenue-watch');
  assert.match(result.message, /Stripe read access is required/);
  assert.equal(result.nextAction.route, '/integrations?provider=stripe&workflow=revenue-watch');
});
