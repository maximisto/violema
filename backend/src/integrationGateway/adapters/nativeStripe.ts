import { getIntegrationCredential } from '../../settingsStore';
import type { IntegrationQueryResult, IntegrationReadinessError } from '../types';

type StripeInterval = 'day' | 'week' | 'month' | 'year';

export interface StripeLikePrice {
  unit_amount?: number | null;
  recurring?: {
    interval?: StripeInterval | null;
    interval_count?: number | null;
  } | null;
}

export interface StripeLikeSubscription {
  id: string;
  status?: string | null;
  created?: number | null;
  canceled_at?: number | null;
  currency?: string | null;
  items?: {
    data?: Array<{
      quantity?: number | null;
      price?: StripeLikePrice | null;
    }>;
  } | null;
}

export interface StripeLikeInvoice {
  id: string;
  status?: string | null;
  amount_remaining?: number | null;
  currency?: string | null;
  created?: number | null;
  attempt_count?: number | null;
  next_payment_attempt?: number | null;
}

export interface StripeLikeCharge {
  id: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  created?: number | null;
}

export interface StripeLikeClient {
  subscriptions: {
    list(params: Record<string, unknown>): Promise<{ data: StripeLikeSubscription[] }>;
  };
  invoices: {
    list(params: Record<string, unknown>): Promise<{ data: StripeLikeInvoice[] }>;
  };
  charges: {
    list(params: Record<string, unknown>): Promise<{ data: StripeLikeCharge[] }>;
  };
}

export interface StripeRevenueSummary {
  period: 'last_30_days';
  currency: string;
  mrr: number;
  arr: number;
  active_subscriptions: number;
  new_subscriptions: number;
  churned: number;
  upgrades: number | null;
  downgrades: number | null;
  failed_payments: {
    count: number;
    at_risk_revenue: number;
    invoice_count: number;
    charge_count: number;
  };
  generated_at: string;
  notes: string[];
}

export interface QueryStripeRevenueInput {
  workspaceId: string;
  queryType: string;
  limit?: number;
  now?: Date;
  client?: StripeLikeClient;
  secretKey?: string;
}

function readinessError(): IntegrationReadinessError {
  return {
    ok: false,
    code: 'integration_not_ready',
    source: 'stripe',
    workflowId: 'revenue-watch',
    message: 'Stripe read access is required before Revenue Watch can run with real data.',
    nextAction: {
      label: 'Connect Stripe',
      route: '/integrations?provider=stripe&workflow=revenue-watch',
    },
  };
}

function unsupportedQuery(queryType: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'unsupported_query',
    source: 'stripe',
    workflowId: 'revenue-watch',
    message: `Stripe query "${queryType}" is not supported yet. Use "revenue_summary".`,
    nextAction: {
      label: 'Review Revenue Watch setup',
      route: '/integrations?provider=stripe&workflow=revenue-watch',
    },
  };
}

function centsToDollars(value?: number | null) {
  return Math.round(((value || 0) / 100) * 100) / 100;
}

function monthlyMultiplier(interval?: StripeInterval | null, intervalCount?: number | null) {
  const count = Math.max(1, intervalCount || 1);
  if (interval === 'year') return 1 / (12 * count);
  if (interval === 'week') return 52 / (12 * count);
  if (interval === 'day') return 365 / (12 * count);
  return 1 / count;
}

function subscriptionMonthlyRevenue(subscription: StripeLikeSubscription) {
  return (subscription.items?.data || []).reduce((sum, item) => {
    const unitAmount = item.price?.unit_amount || 0;
    const quantity = item.quantity || 1;
    const recurring = item.price?.recurring;
    return sum + unitAmount * quantity * monthlyMultiplier(recurring?.interval, recurring?.interval_count);
  }, 0);
}

function createStripeClient(secretKey: string): StripeLikeClient {
  // Delay runtime loading until we actually have credentials and need live Stripe reads.
  const loaded = require('stripe') as { default?: new (secretKey: string) => unknown };
  const StripeCtor = loaded.default || (loaded as new (secretKey: string) => unknown);
  return new StripeCtor(secretKey) as StripeLikeClient;
}

function normalizeCurrency(values: Array<string | null | undefined>) {
  return (values.find(Boolean) || 'usd').toUpperCase();
}

export async function queryStripeRevenue(
  input: QueryStripeRevenueInput,
): Promise<IntegrationQueryResult<StripeRevenueSummary>> {
  if (!['revenue_summary', 'monthly_revenue', 'failed_payments'].includes(input.queryType)) {
    return unsupportedQuery(input.queryType);
  }

  const secretKey = input.secretKey || getIntegrationCredential(input.workspaceId, 'stripe', 'secretKey');
  if (!secretKey && !input.client) return readinessError();

  const startedAt = Date.now();
  const now = input.now || new Date();
  const windowStartSeconds = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const limit = Math.min(Math.max(input.limit || 100, 1), 100);
  const client = input.client || createStripeClient(secretKey as string);

  try {
    const [subscriptions, invoices, charges] = await Promise.all([
      client.subscriptions.list({
        limit,
        status: 'all',
        expand: ['data.items.data.price'],
      }),
      client.invoices.list({
        limit,
        created: { gte: windowStartSeconds },
      }),
      client.charges.list({
        limit,
        created: { gte: windowStartSeconds },
      }),
    ]);

    const activeStatuses = new Set(['active', 'trialing', 'past_due']);
    const activeSubscriptions = subscriptions.data.filter((subscription) => activeStatuses.has(subscription.status || ''));
    const newSubscriptions = subscriptions.data.filter((subscription) => (subscription.created || 0) >= windowStartSeconds);
    const churned = subscriptions.data.filter((subscription) =>
      subscription.status === 'canceled' &&
      Boolean(subscription.canceled_at && subscription.canceled_at >= windowStartSeconds),
    );
    const failedInvoices = invoices.data.filter((invoice) => ['open', 'uncollectible'].includes(invoice.status || ''));
    const failedCharges = charges.data.filter((charge) => charge.status === 'failed');
    const mrr = Math.round(activeSubscriptions.reduce((sum, subscription) => sum + subscriptionMonthlyRevenue(subscription), 0) * 100) / 100;
    const atRiskRevenue = Math.round((
      failedInvoices.reduce((sum, invoice) => sum + centsToDollars(invoice.amount_remaining), 0) +
      failedCharges.reduce((sum, charge) => sum + centsToDollars(charge.amount), 0)
    ) * 100) / 100;

    return {
      ok: true,
      source: 'stripe',
      query_type: 'revenue_summary',
      data: {
        period: 'last_30_days',
        currency: normalizeCurrency([
          activeSubscriptions[0]?.currency,
          failedInvoices[0]?.currency,
          failedCharges[0]?.currency,
        ]),
        mrr,
        arr: Math.round(mrr * 12 * 100) / 100,
        active_subscriptions: activeSubscriptions.length,
        new_subscriptions: newSubscriptions.length,
        churned: churned.length,
        upgrades: null,
        downgrades: null,
        failed_payments: {
          count: failedInvoices.length + failedCharges.length,
          at_risk_revenue: atRiskRevenue,
          invoice_count: failedInvoices.length,
          charge_count: failedCharges.length,
        },
        generated_at: now.toISOString(),
        notes: [
          'Stripe read is live and read-only.',
          'Upgrades and downgrades are not inferred until subscription-change event history is added.',
        ],
      },
      fetched_at: now.toISOString(),
      latency_ms: Date.now() - startedAt,
      cache_hit: false,
      live: true,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'integration_query_failed',
      source: 'stripe',
      workflowId: 'revenue-watch',
      message: error instanceof Error ? error.message : 'Stripe revenue query failed.',
      nextAction: {
        label: 'Check Stripe connection',
        route: '/integrations?provider=stripe&workflow=revenue-watch',
      },
    };
  }
}
