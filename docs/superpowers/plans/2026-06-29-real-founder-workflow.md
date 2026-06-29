# Real Founder Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real founder workflow: Stripe revenue read -> Revenue Watch draft -> human approval -> Slack delivery -> inspectable run ledger.

**Architecture:** Reuse the existing automation engine, mission/review UI, workspace settings store, and Slack delivery path. Add a small integration gateway for read-only Stripe, workflow readiness, and ledger events, then route the existing `query_data` step through that gateway. Do not build a parallel workflow runtime.

**Tech Stack:** TypeScript, Express, React/Vite, Node test runner, existing `stripe` dependency, existing encrypted `settingsStore`, existing JSON-backed platform storage.

## Global Constraints

- No fake data fallback for Stripe once this workflow is active.
- Stripe access is read-only; never mutate Stripe state.
- Missing Stripe credentials return a structured `integration_not_ready` response.
- First live Slack delivery for Revenue Watch requires approval.
- Use existing automation review endpoints where practical.
- Use JSON-backed ledger storage for this proof; no database migration.
- Keep Composio/Pipedream bakeoff out of this slice.
- Keep non-Stripe mock sources temporarily, but isolate them outside Stripe.

---

## File Structure

- Create `backend/src/integrationGateway/types.ts`
  - Shared gateway result types, readiness errors, and ledger event types.
- Create `backend/src/integrationGateway/adapters/nativeStripe.ts`
  - Read-only Stripe revenue adapter with injectable fake client for tests.
- Create `backend/src/integrationGateway/queryData.ts`
  - Workspace-aware `query_data` router. Stripe goes real; legacy non-Stripe mocks remain isolated here.
- Create `backend/src/integrationGateway/workflowReadiness.ts`
  - Maps workflow ids to required integrations and delivery readiness.
- Create `backend/src/integrationGateway/auditLog.ts`
  - JSON-backed run ledger.
- Create `backend/tests/nativeStripe.test.ts`
  - Adapter behavior and no-credential readiness tests.
- Create `backend/tests/queryDataGateway.test.ts`
  - Stripe routing and no mock fallback tests.
- Create `backend/tests/workflowReadiness.test.ts`
  - Revenue Watch readiness tests.
- Create `backend/tests/integrationAuditLog.test.ts`
  - Ledger persistence tests.
- Modify `backend/src/server.ts`
  - Replace inline Stripe mock branch with gateway call.
  - Pass workspace id into automation tool execution.
  - Record ledger events during read, draft, approval, and delivery.
  - Expose readiness and ledger endpoints.
- Modify `backend/src/scheduler.ts`
  - Add optional `workspaceId` to automations; default old records to `purpleorangehq`.
- Modify `backend/src/platform/automationLifecycle.ts`
  - Emit ledger-compatible receipt metadata from approval/rejection path.
- Modify `frontend/src/content/workflowTemplates.ts`
  - Add readiness metadata; mark Revenue Watch as first real workflow.
- Modify `frontend/tests/workflowTemplates.contract.ts`
  - Assert Revenue Watch readiness metadata.
- Modify `frontend/src/pages/Dashboard.tsx`
  - Fetch/show workflow readiness in the automation editor.
  - Show run ledger near existing review/artifact surfaces.
- Create `frontend/src/features/integrations/WorkflowReadinessPanel.tsx`
  - Compact readiness panel reused in Dashboard.
- Create `frontend/src/features/missions/RunLedgerPanel.tsx`
  - Ledger viewer for selected mission/run.
- Create `frontend/tests/workflowReadiness.contract.ts`
  - Contract-level readiness metadata checks.

---

### Task 1: Native Stripe Revenue Adapter

**Files:**
- Create: `backend/src/integrationGateway/types.ts`
- Create: `backend/src/integrationGateway/adapters/nativeStripe.ts`
- Create: `backend/tests/nativeStripe.test.ts`

**Interfaces:**
- Produces:
  - `IntegrationReadinessError`
  - `IntegrationQuerySuccess<T>`
  - `IntegrationQueryResult<T>`
  - `StripeRevenueSummary`
  - `queryStripeRevenue(input: QueryStripeRevenueInput): Promise<IntegrationQueryResult<StripeRevenueSummary>>`
- Consumes:
  - `getIntegrationCredential(workspaceId, 'stripe', 'secretKey')` from `backend/src/settingsStore.ts`

- [ ] **Step 1: Write the failing adapter tests**

Create `backend/tests/nativeStripe.test.ts`:

```ts
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

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);

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

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');

  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.source, 'stripe');
  assert.equal(result.workflowId, 'revenue-watch');
  assert.match(result.message, /Stripe read access is required/);
  assert.equal(result.nextAction.route, '/integrations?provider=stripe&workflow=revenue-watch');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/nativeStripe.test.ts
```

Expected: FAIL because `backend/src/integrationGateway/adapters/nativeStripe.ts` does not exist.

- [ ] **Step 3: Add shared gateway types**

Create `backend/src/integrationGateway/types.ts`:

```ts
export interface IntegrationNextAction {
  label: string;
  route: string;
}

export interface IntegrationReadinessError {
  ok: false;
  code: 'integration_not_ready' | 'unsupported_query' | 'integration_query_failed';
  source: string;
  workflowId?: string;
  message: string;
  nextAction: IntegrationNextAction;
}

export interface IntegrationQuerySuccess<T = unknown> {
  ok: true;
  source: string;
  query_type: string;
  data: T;
  fetched_at: string;
  latency_ms: number;
  cache_hit: false;
  live: true;
}

export type IntegrationQueryResult<T = unknown> =
  | IntegrationQuerySuccess<T>
  | IntegrationReadinessError;

export type WorkflowLedgerEventType =
  | 'workflow_readiness_checked'
  | 'data_read'
  | 'draft_created'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'external_action_executed'
  | 'connector_failed';

export interface WorkflowLedgerEvent {
  id: string;
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  type: WorkflowLedgerEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

- [ ] **Step 4: Add native Stripe adapter**

Create `backend/src/integrationGateway/adapters/nativeStripe.ts`:

```ts
import type Stripe from 'stripe';
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
    return sum + centsToDollars(unitAmount * quantity) * monthlyMultiplier(recurring?.interval, recurring?.interval_count);
  }, 0);
}

function createStripeClient(secretKey: string): StripeLikeClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('stripe') as { default?: typeof import('stripe').default };
  const StripeCtor = loaded.default || (loaded as typeof import('stripe').default);
  return new StripeCtor(secretKey) as unknown as StripeLikeClient;
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
  const client = input.client || createStripeClient(secretKey!);
  const limit = Math.min(Math.max(input.limit || 100, 1), 100);

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
      Boolean(subscription.canceled_at && subscription.canceled_at >= windowStartSeconds)
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
```

- [ ] **Step 5: Run adapter tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/nativeStripe.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit adapter slice**

```bash
cd /Users/maximisto/Documents/New\ project
git add backend/src/integrationGateway/types.ts backend/src/integrationGateway/adapters/nativeStripe.ts backend/tests/nativeStripe.test.ts
git commit -m "feat(integrations): add read-only Stripe revenue adapter"
```

---

### Task 2: Workspace-Aware Query Data Routing

**Files:**
- Create: `backend/src/integrationGateway/queryData.ts`
- Create: `backend/tests/queryDataGateway.test.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/scheduler.ts`

**Interfaces:**
- Consumes:
  - `queryStripeRevenue(input)` from Task 1.
  - `IntegrationQueryResult<T>` from Task 1.
- Produces:
  - `executeQueryData(input: ExecuteQueryDataInput): Promise<IntegrationQueryResult | LegacyQueryDataSuccess>`
  - Workspace-aware automation execution path: `runAutomation` uses `automation.workspaceId || DEFAULT_WORKSPACE_ID`.

- [ ] **Step 1: Write failing query gateway tests**

Create `backend/tests/queryDataGateway.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeQueryData } from '../src/integrationGateway/queryData';
import type { StripeLikeClient } from '../src/integrationGateway/adapters/nativeStripe';

function emptyStripeClient(): StripeLikeClient {
  return {
    subscriptions: { async list() { return { data: [] }; } },
    invoices: { async list() { return { data: [] }; } },
    charges: { async list() { return { data: [] }; } },
  };
}

test('executeQueryData routes Stripe through native adapter', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'stripe',
    queryType: 'revenue_summary',
    clientOverrides: { stripe: emptyStripeClient() },
    credentialOverrides: { stripeSecretKey: 'sk_test_injected' },
    now: new Date('2026-06-29T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'stripe');
  assert.equal(result.live, true);
  assert.equal(result.data.mrr, 0);
});

test('executeQueryData never returns fake Stripe revenue when Stripe is missing', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_missing',
    source: 'stripe',
    queryType: 'revenue_summary',
    now: new Date('2026-06-29T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.doesNotMatch(JSON.stringify(result), /127450|108230|1529400/);
});

test('executeQueryData keeps legacy non-Stripe mock data isolated', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'github',
    queryType: 'open_issues',
    now: new Date('2026-06-29T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'github');
  assert.equal(result.live, false);
  assert.equal(result.data.total, 34);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Expected: FAIL because `backend/src/integrationGateway/queryData.ts` does not exist.

- [ ] **Step 3: Add query data gateway**

Create `backend/src/integrationGateway/queryData.ts`:

```ts
import { queryStripeRevenue, type StripeLikeClient } from './adapters/nativeStripe';
import type { IntegrationQueryResult, IntegrationQuerySuccess } from './types';

export interface LegacyQueryDataSuccess<T = unknown> extends Omit<IntegrationQuerySuccess<T>, 'live' | 'cache_hit'> {
  cache_hit: boolean;
  live: false;
}

export interface ExecuteQueryDataInput {
  workspaceId: string;
  source: string;
  queryType: string;
  filters?: Record<string, unknown>;
  limit?: number;
  now?: Date;
  clientOverrides?: {
    stripe?: StripeLikeClient;
  };
  credentialOverrides?: {
    stripeSecretKey?: string;
  };
}

const LEGACY_MOCK_DATA: Record<string, Record<string, unknown>> = {
  hubspot: {
    contacts: { total: 12450, new_this_month: 234, qualified_leads: 89, mql: 156, sql: 43 },
    deals: { open: 67, won_this_month: 23, lost_this_month: 8, pipeline_value: 890000, avg_deal_size: 38700, close_rate: '34%' },
    campaigns: { active: 5, total_reach: 42000, avg_open_rate: '24.3%', avg_click_rate: '3.8%' },
  },
  github: {
    open_issues: { total: 34, critical: 2, high: 8, medium: 15, low: 9 },
    pull_requests: { open: 12, merged_this_week: 28, avg_review_time_hours: 6.4, oldest_open_days: 18 },
    activity: { commits_this_week: 147, contributors_active: 8, deployments_this_week: 12 },
    delivery_risk: { open_prs: 12, merged_this_week: 28, blockers: 2, stale_reviews: 4 },
  },
  linear: {
    sprint: { name: 'Sprint 23', open: 156, in_progress: 34, completed: 42, blocked: 7 },
    velocity: { this_sprint: 84, last_sprint: 76, avg_4_sprints: 79 },
    cycle_time_days: { p50: 2.1, p90: 5.8 },
  },
  posthog: {
    pageviews: { today: 8421, this_week: 48230, this_month: 182450 },
    active_users: { dau: 1247, wau: 6832, mau: 18940 },
    conversion: { signup_rate: '4.2%', activation_rate: '67%', retention_d30: '42%' },
    top_events: [
      { event: 'chat_sent', count: 45230, change: '+12%' },
      { event: 'tool_executed', count: 28410, change: '+34%' },
      { event: 'automation_created', count: 3210, change: '+89%' },
    ],
  },
  salesforce: {
    pipeline: { total: 2340000, opportunities: 87, avg_age_days: 34 },
    forecast: { commit: 340000, best_case: 520000, pipeline: 890000 },
    top_accounts: [
      { name: 'Acme Corp', arr: 120000, health: 'green', csm: 'Sarah K.' },
      { name: 'Globex Inc', arr: 84000, health: 'yellow', csm: 'Mike T.' },
    ],
  },
  google_analytics: {
    sessions: { today: 3421, this_week: 21450, this_month: 89230 },
    acquisition: { organic: '42%', direct: '28%', paid: '18%', referral: '12%' },
    top_pages: [
      { path: '/', sessions: 12450, bounce_rate: '34%' },
      { path: '/pricing', sessions: 8230, bounce_rate: '28%' },
      { path: '/features', sessions: 6710, bounce_rate: '41%' },
    ],
  },
};

export async function executeQueryData(
  input: ExecuteQueryDataInput,
): Promise<IntegrationQueryResult | LegacyQueryDataSuccess> {
  const now = input.now || new Date();

  if (input.source === 'stripe') {
    return queryStripeRevenue({
      workspaceId: input.workspaceId,
      queryType: input.queryType,
      limit: input.limit,
      now,
      client: input.clientOverrides?.stripe,
      secretKey: input.credentialOverrides?.stripeSecretKey,
    });
  }

  const sourceData = LEGACY_MOCK_DATA[input.source] || {};
  const result = sourceData[input.queryType] || { note: `Data for "${input.queryType}" not found in ${input.source}` };

  return {
    ok: true,
    source: input.source,
    query_type: input.queryType,
    data: result,
    fetched_at: now.toISOString(),
    latency_ms: 80,
    cache_hit: false,
    live: false,
  };
}
```

- [ ] **Step 4: Add workspace id to automations**

Modify `backend/src/scheduler.ts`:

```ts
export interface AutomationRecord {
  id: string;
  version?: 2;
  workspaceId?: string;
  name: string;
  description?: string;
  authoring_mode?: 'guided' | 'describe';
  workflow_prompt?: string;
  schedule: string;
  cron_expression: string;
  timezone?: string;
  actions: string[];
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
  studio_state?: AutomationStudioState;
  notify?: string;
  condition?: string;
  status: 'active' | 'paused';
  last_run_at?: string;
  last_run_status?: 'succeeded' | 'failed';
  consecutive_failures?: number;
  next_run_at?: string;
  created_at: string;
}
```

In `withAutomationDefaults`, preserve old records by adding:

```ts
return {
  ...normalized,
  workspaceId: normalized.workspaceId,
  timezone,
  next_run_at: normalized.status === 'paused'
    ? undefined
    : normalized.next_run_at || computeNextRunAt(normalized.cron_expression, timezone),
};
```

In `createAutomation`, include:

```ts
workspaceId: input.workspaceId,
```

The `createAutomation` `input` type should now allow `workspaceId?: string` through its existing `Omit<AutomationRecord, ...>` shape because `workspaceId` is not omitted.

- [ ] **Step 5: Route server `query_data` through gateway**

Modify `backend/src/server.ts` imports:

```ts
import { executeQueryData } from './integrationGateway/queryData';
```

Change `executeToolCall` `query_data` case to:

```ts
case 'query_data': {
  const source = String(toolInput.source || '');
  const queryType = String(toolInput.query_type || '');
  return JSON.stringify(await executeQueryData({
    workspaceId: ctx?.workspaceId || DEFAULT_WORKSPACE_ID,
    source,
    queryType,
    filters: isObjectRecord(toolInput.filters) ? toolInput.filters : undefined,
    limit: typeof toolInput.limit === 'number' ? toolInput.limit : undefined,
  }));
}
```

Delete the inline `mockData` object from `backend/src/server.ts`.

- [ ] **Step 6: Pass workspace id into automation execution**

Modify `runAutomation` in `backend/src/server.ts`:

```ts
const workspaceId = automation.workspaceId || DEFAULT_WORKSPACE_ID;
ensureWorkspaceCredits(workspaceId);
```

Then replace only the automation-run-local `DEFAULT_WORKSPACE_ID` uses in `runAutomation` and `executeAutomationCore` calls with `workspaceId` where they refer to task creation, task run creation, model config, credit checks, ledger entries, and broadcasts.

Modify `executeAutomationCore` signature:

```ts
async function executeAutomationCore(
  automation: {
    id: string;
    name: string;
    description?: string;
    actions: string[];
    steps?: PersistedAutomationStep[];
    execution_policy?: AutomationExecutionPolicy;
    notify?: string;
    condition?: string;
    timezone?: string;
  },
  plan: AutomationExecutionPlan,
  workspaceId: string,
  onProgress?: (state: {
    artifacts: AutomationExecutionArtifact[];
    summaryText: string;
    stepErrors: string[];
    stepExecutions: AutomationStepExecution[];
    delivery: Record<string, unknown> | null;
    deliveryError: string | null;
    workerTopology: AutomationExecutionPlan['topology'];
  }) => Promise<void> | void,
) {
```

Inside the query step, pass context:

```ts
const payload = JSON.parse(await runAutomationStepWithTimeout(
  `Query step "${step.title}"`,
  executeToolCall('query_data', step.inputs || {}, { workspaceId }),
)) as Record<string, unknown>;
```

Update the caller:

```ts
const execution = await executeAutomationCore(automation, executionPlan, workspaceId, persistProgress);
```

- [ ] **Step 7: Pass workspace id when creating automations**

Modify `app.post('/api/automations')` in `backend/src/server.ts`:

```ts
const { workspaceId } = resolveWorkspaceContext(req);
```

Pass it into `createAutomation`:

```ts
workspaceId,
```

Change `broadcastTaskPanelEvent(DEFAULT_WORKSPACE_ID, ...)` in this route to `broadcastTaskPanelEvent(workspaceId, ...)`.

Do the same in `PATCH`, `DELETE`, and `POST /api/automations/:id/run` where the request has a workspace context.

- [ ] **Step 8: Run query gateway tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run existing focused backend tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/nativeStripe.test.ts tests/integrationRegistry.test.ts tests/settingsStore.test.ts tests/automationLifecycle.contract.ts
```

Expected: PASS. If the combined runner hangs, run each file individually and note it in validation.

- [ ] **Step 10: Commit query routing slice**

```bash
cd /Users/maximisto/Documents/New\ project
git add backend/src/integrationGateway/queryData.ts backend/tests/queryDataGateway.test.ts backend/src/server.ts backend/src/scheduler.ts
git commit -m "feat(integrations): route Stripe data through real gateway"
```

---

### Task 3: Revenue Watch Readiness

**Files:**
- Create: `backend/src/integrationGateway/workflowReadiness.ts`
- Create: `backend/tests/workflowReadiness.test.ts`
- Modify: `backend/src/server.ts`
- Modify: `frontend/src/content/workflowTemplates.ts`
- Modify: `frontend/tests/workflowTemplates.contract.ts`
- Create: `frontend/tests/workflowReadiness.contract.ts`

**Interfaces:**
- Consumes:
  - `getWorkspaceSettingsView(workspaceId)` from `settingsStore`.
- Produces:
  - `checkWorkflowReadiness(input): WorkflowReadinessReport`
  - `GET /api/workflows/:workflowId/readiness`
  - Template fields: `requiredIntegrationIds`, `optionalIntegrationIds`, `firstRunRequiresApproval`

- [ ] **Step 1: Write failing backend readiness tests**

Create `backend/tests/workflowReadiness.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkWorkflowReadiness } from '../src/integrationGateway/workflowReadiness';

test('Revenue Watch readiness blocks missing Stripe and missing Slack target', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: 'workspace_test',
    deliveryTarget: '',
    settingsView: {
      integrations: {
        stripe: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe']);
  assert.equal(report.firstRunRequiresApproval, true);
  assert.ok(report.blockers.some((item) => item.key === 'stripe'));
  assert.ok(report.blockers.some((item) => item.key === 'slack_target'));
});

test('Revenue Watch readiness passes with Stripe and Slack target', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'revenue-watch',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    settingsView: {
      integrations: {
        stripe: { configured: true },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.summary, 'Revenue Watch is ready for a sandbox run. First live delivery requires approval.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts
```

Expected: FAIL because `workflowReadiness.ts` does not exist.

- [ ] **Step 3: Add readiness module**

Create `backend/src/integrationGateway/workflowReadiness.ts`:

```ts
import { getWorkspaceSettingsView, type WorkspaceSettingsView } from '../settingsStore';

export interface WorkflowReadinessBlocker {
  key: string;
  label: string;
  detail: string;
  route?: string;
}

export interface WorkflowReadinessReport {
  workflowId: string;
  workspaceId: string;
  ready: boolean;
  summary: string;
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
  blockers: WorkflowReadinessBlocker[];
}

interface MinimalSettingsView {
  integrations?: Record<string, { configured?: boolean }>;
}

function isConfigured(settingsView: WorkspaceSettingsView | MinimalSettingsView, id: string) {
  return Boolean(settingsView.integrations?.[id]?.configured);
}

function readWorkflowRequirements(workflowId: string) {
  if (workflowId === 'revenue-watch') {
    return {
      requiredIntegrationIds: ['stripe'],
      optionalIntegrationIds: [],
      firstRunRequiresApproval: true,
    };
  }

  return {
    requiredIntegrationIds: [],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: false,
  };
}

export function checkWorkflowReadiness(input: {
  workflowId: string;
  workspaceId: string;
  deliveryTarget?: string | null;
  settingsView?: WorkspaceSettingsView | MinimalSettingsView;
}): WorkflowReadinessReport {
  const settingsView = input.settingsView || getWorkspaceSettingsView(input.workspaceId);
  const requirements = readWorkflowRequirements(input.workflowId);
  const blockers: WorkflowReadinessBlocker[] = [];

  if (requirements.requiredIntegrationIds.includes('stripe') && !isConfigured(settingsView, 'stripe')) {
    blockers.push({
      key: 'stripe',
      label: 'Connect Stripe',
      detail: 'Stripe read access is required before Revenue Watch can run with real data.',
      route: '/integrations?provider=stripe&workflow=revenue-watch',
    });
  }

  if (input.workflowId === 'revenue-watch' && !input.deliveryTarget?.trim()) {
    blockers.push({
      key: 'slack_target',
      label: 'Add Slack destination',
      detail: 'Revenue Watch needs a Slack target before it can be promoted to live delivery.',
    });
  }

  return {
    workflowId: input.workflowId,
    workspaceId: input.workspaceId,
    ready: blockers.length === 0,
    summary: blockers.length === 0
      ? 'Revenue Watch is ready for a sandbox run. First live delivery requires approval.'
      : `${blockers.length} readiness item${blockers.length === 1 ? '' : 's'} must be fixed before this workflow can run with real data.`,
    ...requirements,
    blockers,
  };
}
```

- [ ] **Step 4: Expose readiness endpoint**

Modify `backend/src/server.ts` imports:

```ts
import { checkWorkflowReadiness } from './integrationGateway/workflowReadiness';
```

Add this route near integration endpoints:

```ts
app.get('/api/workflows/:workflowId/readiness', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const deliveryTarget = typeof req.query.deliveryTarget === 'string' ? req.query.deliveryTarget : '';
  res.json({
    ok: true,
    report: checkWorkflowReadiness({
      workspaceId,
      workflowId: req.params.workflowId,
      deliveryTarget,
    }),
  });
});
```

- [ ] **Step 5: Add frontend template readiness metadata**

Modify `frontend/src/content/workflowTemplates.ts`:

```ts
export interface WorkflowTemplateDefinition {
  id: string;
  slug: string;
  title: string;
  category: WorkflowTemplateCategory;
  outcome: string;
  description: string;
  cadence: string;
  destination: 'slack' | 'email' | 'none';
  notify: string;
  integrations: string[];
  requiredIntegrationIds?: string[];
  optionalIntegrationIds?: string[];
  firstRunRequiresApproval?: boolean;
  steps: WorkflowTemplateStep[];
}
```

Update the `revenue-watch` object:

```ts
requiredIntegrationIds: ['stripe'],
optionalIntegrationIds: [],
firstRunRequiresApproval: true,
```

- [ ] **Step 6: Update frontend contract tests**

Modify `frontend/tests/workflowTemplates.contract.ts` after the existing `getWorkflowTemplateById` assertions:

```ts
const revenueWatch = getWorkflowTemplateById('revenue-watch');
assert(Boolean(revenueWatch), 'Revenue Watch template exists');
assert(
  revenueWatch?.requiredIntegrationIds?.includes('stripe'),
  'Revenue Watch requires Stripe',
);
assert(
  revenueWatch?.firstRunRequiresApproval === true,
  'Revenue Watch first run requires approval',
);
```

Create `frontend/tests/workflowReadiness.contract.ts`:

```ts
import { getWorkflowTemplateById } from '../src/content/workflowTemplates';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const revenueWatch = getWorkflowTemplateById('revenue-watch');

assert(Boolean(revenueWatch), 'revenue-watch template exists');
assert(revenueWatch?.destination === 'slack', 'Revenue Watch delivers to Slack');
assert(revenueWatch?.requiredIntegrationIds?.join(',') === 'stripe', 'Revenue Watch only requires Stripe in first proof');
assert(revenueWatch?.optionalIntegrationIds?.length === 0, 'Revenue Watch keeps optional integrations out of first proof');
assert(revenueWatch?.firstRunRequiresApproval === true, 'Revenue Watch approval gate is explicit');

console.log('workflowReadiness.contract: Revenue Watch metadata verified');
```

- [ ] **Step 7: Run readiness tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts

cd /Users/maximisto/Documents/New\ project/frontend
npx tsx tests/workflowTemplates.contract.ts
npx tsx tests/workflowReadiness.contract.ts
```

Expected: PASS.

- [ ] **Step 8: Commit readiness slice**

```bash
cd /Users/maximisto/Documents/New\ project
git add backend/src/integrationGateway/workflowReadiness.ts backend/tests/workflowReadiness.test.ts backend/src/server.ts frontend/src/content/workflowTemplates.ts frontend/tests/workflowTemplates.contract.ts frontend/tests/workflowReadiness.contract.ts
git commit -m "feat(workflows): add Revenue Watch readiness"
```

---

### Task 4: Run Ledger And Approval Events

**Files:**
- Create: `backend/src/integrationGateway/auditLog.ts`
- Create: `backend/tests/integrationAuditLog.test.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/platform/automationLifecycle.ts`

**Interfaces:**
- Consumes:
  - `WorkflowLedgerEvent` and `WorkflowLedgerEventType` from Task 1.
  - Existing automation review endpoints.
- Produces:
  - `appendWorkflowLedgerEvent(input): WorkflowLedgerEvent`
  - `listWorkflowLedgerEvents(input): WorkflowLedgerEvent[]`
  - `GET /api/workflows/runs/:runId/ledger`

- [ ] **Step 1: Write failing audit log tests**

Create `backend/tests/integrationAuditLog.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('workflow ledger persists and filters run events', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-ledger-'));
  process.chdir(tempDir);

  try {
    const audit = await import('../src/integrationGateway/auditLog');
    const first = audit.appendWorkflowLedgerEvent({
      workspaceId: 'workspace_test',
      workflowId: 'revenue-watch',
      automationId: 'auto_revenue',
      taskId: 'task_revenue',
      taskRunId: 'run_revenue',
      type: 'data_read',
      summary: 'Read Stripe revenue summary.',
      metadata: { source: 'stripe', queryType: 'revenue_summary' },
      now: () => '2026-06-29T12:00:00.000Z',
    });
    audit.appendWorkflowLedgerEvent({
      workspaceId: 'workspace_test',
      workflowId: 'revenue-watch',
      taskRunId: 'run_other',
      type: 'draft_created',
      summary: 'Other run.',
      now: () => '2026-06-29T12:01:00.000Z',
    });

    const items = audit.listWorkflowLedgerEvents({
      workspaceId: 'workspace_test',
      taskRunId: 'run_revenue',
    });

    assert.equal(first.id, 'ledger_run_revenue_data_read_2026-06-29T12-00-00-000Z');
    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'data_read');
    assert.equal(items[0].metadata?.source, 'stripe');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationAuditLog.test.ts
```

Expected: FAIL because `auditLog.ts` does not exist.

- [ ] **Step 3: Add audit log module**

Create `backend/src/integrationGateway/auditLog.ts`:

```ts
import path from 'path';
import { readJsonFile, writeJsonFile } from '../platform/jsonStore';
import type { WorkflowLedgerEvent, WorkflowLedgerEventType } from './types';

const WORKFLOW_LEDGER_FILE = path.join(process.cwd(), 'workflow-ledger-events.json');

function safeTimestampId(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/g, '');
}

function readEvents() {
  return readJsonFile<WorkflowLedgerEvent[]>(WORKFLOW_LEDGER_FILE, []);
}

function writeEvents(events: WorkflowLedgerEvent[]) {
  writeJsonFile(WORKFLOW_LEDGER_FILE, events);
}

export function appendWorkflowLedgerEvent(input: {
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  type: WorkflowLedgerEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  now?: () => string;
}) {
  const createdAt = input.now ? input.now() : new Date().toISOString();
  const idBase = input.taskRunId || input.automationId || input.workflowId;
  const event: WorkflowLedgerEvent = {
    id: `ledger_${idBase}_${input.type}_${safeTimestampId(createdAt)}`,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    automationId: input.automationId,
    taskId: input.taskId,
    taskRunId: input.taskRunId,
    type: input.type,
    summary: input.summary,
    metadata: input.metadata,
    createdAt,
  };
  writeEvents([event, ...readEvents()]);
  return event;
}

export function listWorkflowLedgerEvents(input: {
  workspaceId: string;
  workflowId?: string;
  automationId?: string;
  taskRunId?: string;
}) {
  return readEvents()
    .filter((event) => event.workspaceId === input.workspaceId)
    .filter((event) => !input.workflowId || event.workflowId === input.workflowId)
    .filter((event) => !input.automationId || event.automationId === input.automationId)
    .filter((event) => !input.taskRunId || event.taskRunId === input.taskRunId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
```

- [ ] **Step 4: Record ledger events in automation execution**

Modify `backend/src/server.ts` imports:

```ts
import { appendWorkflowLedgerEvent, listWorkflowLedgerEvents } from './integrationGateway/auditLog';
```

Add helper near automation helpers:

```ts
function inferWorkflowIdFromAutomation(automation: { name: string; steps?: PersistedAutomationStep[] }) {
  const text = [
    automation.name,
    ...(automation.steps || []).map((step) => `${step.title || ''} ${step.objective || ''} ${JSON.stringify(step.inputs || {})}`),
  ].join('\n').toLowerCase();
  if (text.includes('revenue watch') || (text.includes('"source":"stripe"') && text.includes('revenue'))) {
    return 'revenue-watch';
  }
  return 'custom-workflow';
}
```

Inside `runAutomation`, after `const workspaceId = ...`:

```ts
const workflowId = inferWorkflowIdFromAutomation(automation);
```

Inside the query step after a successful payload is parsed:

```ts
if (payload.source === 'stripe') {
  appendWorkflowLedgerEvent({
    workspaceId,
    workflowId,
    automationId: automation.id,
    taskId: task.id,
    taskRunId: taskRun.id,
    type: payload.ok === false ? 'connector_failed' : 'data_read',
    summary: payload.ok === false
      ? `Stripe read blocked: ${String(payload.message || 'integration not ready')}`
      : 'Read Stripe revenue summary.',
    metadata: {
      source: 'stripe',
      queryType: step.inputs?.query_type,
      ok: payload.ok,
    },
  });
}
```

Inside the summarize step after summary artifact push:

```ts
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId,
  automationId: automation.id,
  taskId: task.id,
  taskRunId: taskRun.id,
  type: 'draft_created',
  summary: `Drafted ${step.title}.`,
  metadata: { artifactKind: 'summary', stepId: step.id },
});
```

Inside the review-gated delivery branch after pushing `review_gate` artifact:

```ts
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId,
  automationId: automation.id,
  taskId: task.id,
  taskRunId: taskRun.id,
  type: 'approval_requested',
  summary: `Prepared delivery for approval before sending to ${deliveryTarget}.`,
  metadata: { deliveryTarget, channel: delivery.channel },
});
```

Inside direct delivery branch after delivery:

```ts
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId,
  automationId: automation.id,
  taskId: task.id,
  taskRunId: taskRun.id,
  type: 'external_action_executed',
  summary: `Delivered workflow output to ${deliveryTarget}.`,
  metadata: { deliveryTarget, delivery },
});
```

- [ ] **Step 5: Record approval and rejection events**

In `app.post('/api/automations/:id/reviews/:runId/approve')`, after `approveAutomationReview` succeeds:

```ts
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId: inferWorkflowIdFromAutomation(context.automation),
  automationId: context.automation.id,
  taskId: context.task.id,
  taskRunId: context.taskRun.id,
  type: 'approval_granted',
  summary: `Approved delivery to ${result.receipt.deliveryTarget || 'configured destination'}.`,
  metadata: { receipt: result.receipt },
});
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId: inferWorkflowIdFromAutomation(context.automation),
  automationId: context.automation.id,
  taskId: context.task.id,
  taskRunId: context.taskRun.id,
  type: 'external_action_executed',
  summary: `Delivered approved workflow output to ${result.receipt.deliveryTarget || 'configured destination'}.`,
  metadata: { delivery: result.delivery },
});
```

In `request-changes`, after `requestAutomationChanges` succeeds:

```ts
appendWorkflowLedgerEvent({
  workspaceId,
  workflowId: inferWorkflowIdFromAutomation(context.automation),
  automationId: context.automation.id,
  taskId: context.task.id,
  taskRunId: context.taskRun.id,
  type: 'approval_denied',
  summary: 'Reviewer requested changes before delivery.',
  metadata: { reviewRequest: result.reviewRequest },
});
```

- [ ] **Step 6: Add ledger endpoint**

Add near platform routes in `backend/src/server.ts`:

```ts
app.get('/api/workflows/runs/:runId/ledger', (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({
    ok: true,
    items: listWorkflowLedgerEvents({
      workspaceId,
      taskRunId: req.params.runId,
    }),
  });
});
```

- [ ] **Step 7: Run ledger tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationAuditLog.test.ts tests/automationLifecycle.contract.ts
```

Expected: PASS.

- [ ] **Step 8: Commit ledger slice**

```bash
cd /Users/maximisto/Documents/New\ project
git add backend/src/integrationGateway/auditLog.ts backend/tests/integrationAuditLog.test.ts backend/src/server.ts backend/src/platform/automationLifecycle.ts
git commit -m "feat(workflows): record Revenue Watch run ledger"
```

---

### Task 5: Dashboard Readiness And Ledger UI

**Files:**
- Create: `frontend/src/features/integrations/WorkflowReadinessPanel.tsx`
- Create: `frontend/src/features/missions/RunLedgerPanel.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/workflows/:workflowId/readiness`
  - `GET /api/workflows/runs/:runId/ledger`
  - Template readiness fields from Task 3.
- Produces:
  - Editor readiness panel for Revenue Watch.
  - Run ledger panel in mission/review workspace.

- [ ] **Step 1: Add readiness panel component**

Create `frontend/src/features/integrations/WorkflowReadinessPanel.tsx`:

```tsx
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import { Link } from 'react-router-dom';

export interface WorkflowReadinessBlocker {
  key: string;
  label: string;
  detail: string;
  route?: string;
}

export interface WorkflowReadinessReport {
  workflowId: string;
  ready: boolean;
  summary: string;
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
  blockers: WorkflowReadinessBlocker[];
}

export function WorkflowReadinessPanel({ report }: { report: WorkflowReadinessReport | null }) {
  if (!report) return null;

  return (
    <div className={`rounded-2xl border p-3 ${
      report.ready
        ? 'border-green-500/20 bg-green-500/8'
        : 'border-amber-500/20 bg-amber-500/8'
    }`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 ${report.ready ? 'text-green-300' : 'text-amber-300'}`}>
          {report.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow readiness</p>
          <p className="mt-1 text-sm font-semibold text-white">{report.summary}</p>
          {report.firstRunRequiresApproval ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              First live delivery stays behind approval.
            </p>
          ) : null}
          {report.blockers.length > 0 ? (
            <div className="mt-3 space-y-2">
              {report.blockers.map((blocker) => (
                <div key={blocker.key} className="rounded-xl border border-white/8 bg-navy-950/35 px-3 py-2">
                  <p className="text-xs font-semibold text-white">{blocker.label}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">{blocker.detail}</p>
                  {blocker.route ? (
                    <Link to={blocker.route} className="mt-2 inline-flex text-[11px] font-semibold text-cyan-200 hover:text-cyan-100">
                      Open setup
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add run ledger panel**

Create `frontend/src/features/missions/RunLedgerPanel.tsx`:

```tsx
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import XCircle from 'lucide-react/dist/esm/icons/x-circle.js';

export interface WorkflowLedgerEvent {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
}

function EventIcon({ type }: { type: string }) {
  const className = 'h-4 w-4';
  if (type === 'connector_failed' || type === 'approval_denied') return <XCircle className={className} />;
  if (type === 'approval_requested' || type === 'approval_granted') return <ShieldCheck className={className} />;
  if (type === 'external_action_executed') return <Send className={className} />;
  if (type === 'draft_created') return <Clock3 className={className} />;
  return <CheckCircle2 className={className} />;
}

export function RunLedgerPanel({ events }: { events: WorkflowLedgerEvent[] }) {
  return (
    <section className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Run ledger</p>
          <h3 className="mt-1 text-sm font-semibold text-white">What Violema read, drafted, approved, and sent</h3>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">No ledger events are attached to this run yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <span className="mt-0.5 text-cyan-200">
                <EventIcon type={event.type} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{event.summary}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-600">{event.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Fetch readiness in Dashboard editor**

Modify imports in `frontend/src/pages/Dashboard.tsx`:

```tsx
import { WorkflowReadinessPanel, type WorkflowReadinessReport } from '../features/integrations/WorkflowReadinessPanel';
import { RunLedgerPanel, type WorkflowLedgerEvent } from '../features/missions/RunLedgerPanel';
```

Add state:

```tsx
const [workflowReadiness, setWorkflowReadiness] = useState<WorkflowReadinessReport | null>(null);
const [runLedgerEvents, setRunLedgerEvents] = useState<WorkflowLedgerEvent[]>([]);
```

Add helper:

```tsx
function inferEditorWorkflowId(editor: AutomationEditorDraft | null) {
  if (!editor) return '';
  if (editor.name.toLowerCase().includes('revenue watch')) return 'revenue-watch';
  if (editor.steps.some((step) => step.inputs?.source === 'stripe' && String(step.inputs?.query_type || '').includes('revenue'))) {
    return 'revenue-watch';
  }
  return '';
}
```

Add effect:

```tsx
useEffect(() => {
  const workflowId = inferEditorWorkflowId(automationEditor);
  if (!workflowId || !automationEditor) {
    setWorkflowReadiness(null);
    return;
  }

  const controller = new AbortController();
  const params = new URLSearchParams({
    deliveryTarget: automationEditor.notify,
    workspaceId: workspace.workspaceId,
  });
  fetch(`/api/workflows/${workflowId}/readiness?${params.toString()}`, {
    signal: controller.signal,
    credentials: 'same-origin',
  })
    .then((response) => response.json())
    .then((payload) => {
      if (payload?.report) setWorkflowReadiness(payload.report);
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setWorkflowReadiness(null);
    });

  return () => controller.abort();
}, [automationEditor?.name, automationEditor?.notify, automationEditor?.steps, workspace.workspaceId]);
```

Render the panel inside the editor setup section below destination:

```tsx
<WorkflowReadinessPanel report={workflowReadiness} />
```

- [ ] **Step 4: Fetch ledger for selected run**

In `Dashboard.tsx`, add effect near selected mission/task effects:

```tsx
useEffect(() => {
  const runId = selectedTask?.taskRunId || selectedMission?.activeRunId;
  if (!runId) {
    setRunLedgerEvents([]);
    return;
  }

  const controller = new AbortController();
  const params = new URLSearchParams({ workspaceId: workspace.workspaceId });
  fetch(`/api/workflows/runs/${runId}/ledger?${params.toString()}`, {
    signal: controller.signal,
    credentials: 'same-origin',
  })
    .then((response) => response.json())
    .then((payload) => {
      setRunLedgerEvents(Array.isArray(payload?.items) ? payload.items : []);
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setRunLedgerEvents([]);
    });

  return () => controller.abort();
}, [selectedTask?.taskRunId, selectedMission?.activeRunId, workspace.workspaceId]);
```

Render the ledger in `renderMissionReviewsView` after `MissionReviews`:

```tsx
<RunLedgerPanel events={runLedgerEvents} />
```

- [ ] **Step 5: Run frontend checks**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx tsx tests/workflowTemplates.contract.ts
npx tsx tests/workflowReadiness.contract.ts
```

Expected: PASS.

- [ ] **Step 6: Commit UI slice**

```bash
cd /Users/maximisto/Documents/New\ project
git add frontend/src/features/integrations/WorkflowReadinessPanel.tsx frontend/src/features/missions/RunLedgerPanel.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat(ui): show workflow readiness and run ledger"
```

---

### Task 6: Final Verification And Trust Boundary Audit

**Files:**
- Modify only if verification exposes a focused defect.

**Interfaces:**
- Consumes all previous tasks.
- Produces a verified branch ready for review.

- [ ] **Step 1: Search for fake Stripe revenue leftovers**

Run:

```bash
cd /Users/maximisto/Documents/New\ project
rg -n "127450|108230|1529400|monthly_revenue|fake Stripe|mock Stripe|stripe: \\{" backend/src backend/tests frontend/src frontend/tests
```

Expected: no fake Stripe revenue remains in runtime code. `monthly_revenue` may remain only as an alias in tests or adapter routing, not as canned revenue.

- [ ] **Step 2: Run backend targeted tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/nativeStripe.test.ts
node --test -r ts-node/register tests/queryDataGateway.test.ts
node --test -r ts-node/register tests/workflowReadiness.test.ts
node --test -r ts-node/register tests/integrationAuditLog.test.ts
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
node --test -r ts-node/register tests/automationLifecycle.contract.ts
```

Expected: all PASS.

- [ ] **Step 3: Run frontend targeted tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx tsx tests/workflowTemplates.contract.ts
npx tsx tests/workflowReadiness.contract.ts
```

Expected: all PASS.

- [ ] **Step 4: Run diff and builds**

Run:

```bash
cd /Users/maximisto/Documents/New\ project
git diff --check
cd backend && npm run build
cd ../frontend && npm run build
```

Expected: `git diff --check` passes. Builds should complete; if either hangs, record the exact command, elapsed time, and last output.

- [ ] **Step 5: Manual smoke with missing Stripe**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node -r ts-node/register -e "require('./src/integrationGateway/queryData').executeQueryData({ workspaceId: 'missing', source: 'stripe', queryType: 'revenue_summary' }).then((x) => { console.log(JSON.stringify(x)); process.exit(x.ok === false && x.code === 'integration_not_ready' ? 0 : 1); })"
```

Expected: JSON contains `"code":"integration_not_ready"` and no fake revenue numbers.

- [ ] **Step 6: Commit verification fixes only when files changed**

If verification required any fixes:

```bash
cd /Users/maximisto/Documents/New\ project
git status --short
git add backend/src/integrationGateway backend/tests backend/src/server.ts backend/src/scheduler.ts backend/src/platform/automationLifecycle.ts frontend/src/content/workflowTemplates.ts frontend/src/pages/Dashboard.tsx frontend/src/features/integrations frontend/src/features/missions frontend/tests
git commit -m "fix(workflows): tighten Revenue Watch verification"
```

If no fixes were needed, do not create an empty commit.
