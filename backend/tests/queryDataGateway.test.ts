import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyQueryStepPayloadToExecution, executeQueryData } from '../src/integrationGateway/queryData';
import type { StripeLikeClient } from '../src/integrationGateway/adapters/nativeStripe';
import type { AutomationStepExecution } from '../src/platform/types';

interface StripeRevenueLike {
  mrr: number;
}

function emptyStripeClient(): StripeLikeClient {
  return {
    subscriptions: { async list() { return { data: [] }; } },
    invoices: { async list() { return { data: [] }; } },
    charges: { async list() { return { data: [] }; } },
  };
}

function makeQueryStepExecution(): AutomationStepExecution {
  return {
    stepId: 'step_query',
    kind: 'query',
    title: 'Check Stripe revenue',
    assignedRole: 'analyst',
    status: 'running',
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

  if (!result.ok) throw new Error('expected Stripe success');
  assert.equal(result.source, 'stripe');
  assert.equal(result.live, true);
  assert.equal((result.data as StripeRevenueLike).mrr, 0);
});

test('executeQueryData never returns placeholder Stripe revenue when Stripe is missing', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_missing',
    source: 'stripe',
    queryType: 'revenue_summary',
    now: new Date('2026-06-29T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.doesNotMatch(JSON.stringify(result), /12745(?:0)|10823(?:0)|15294(?:00)/);
});

test('executeQueryData keeps legacy non-routed sample data isolated', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'posthog',
    queryType: 'active_users',
    now: new Date('2026-06-29T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error('expected PostHog mock success');
  assert.equal(result.source, 'posthog');
  assert.equal(result.live, false);
  assert.equal((result.data as { dau: number }).dau, 1247);
});

test('executeQueryData routes GitHub through the native adapter when repository scope exists', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'github',
    queryType: 'open_issues',
    filters: { repository: 'maximisto/violema' },
    credentialOverrides: { githubToken: 'ghp_test' },
    clientOverrides: {
      githubFetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          return [{
            number: 5,
            title: 'Real issue',
            html_url: 'https://github.com/maximisto/violema/issues/5',
            labels: [],
            created_at: '2026-06-29T12:00:00.000Z',
            updated_at: '2026-06-29T12:00:00.000Z',
          }];
        },
        async text() {
          return '[]';
        },
      }),
    },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.live, true);
  assert.equal(result.source, 'github');
  assert.notDeepEqual(result.data, { total: 34, critical: 2, high: 8, medium: 15, low: 9 });
});

test('executeQueryData returns readiness error for required Google Workspace source without connection', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: [],
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.source, 'gmail');
});

test('executeQueryData returns readiness error for Linear without partner connection', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'linear',
    queryType: 'delivery_backlog',
    connectedPartnerApps: [],
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.source, 'linear');
});

test('executeQueryData routes Linear through the partner adapter when connected', async () => {
  let receivedActionName = '';
  let receivedInput: Record<string, unknown> | undefined;
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'linear',
    queryType: 'delivery_backlog',
    connectedPartnerApps: ['linear'],
    clientOverrides: {
      partnerToolExecutor: async (actionName: string, input: Record<string, unknown>) => {
        receivedActionName = actionName;
        receivedInput = input;
        return {
          issues: [
            {
              id: 'issue_1',
              identifier: 'ENG-7',
              title: 'Fix onboarding activation',
              url: 'https://linear.app/acme/issue/ENG-7',
              state: { name: 'In Progress' },
              priority: 2,
              assignee: { name: 'Avery' },
              updatedAt: '2026-06-29T12:00:00.000Z',
              description: 'Private customer context should not be returned.',
            },
          ],
        };
      },
    } as Parameters<typeof executeQueryData>[0]['clientOverrides'] & {
      partnerToolExecutor: (actionName: string, input: Record<string, unknown>) => Promise<unknown>;
    },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'linear');
  assert.equal(result.live, true);
  assert.equal(receivedActionName, 'LINEAR_LIST_LINEAR_ISSUES');
  assert.equal(receivedInput?.first, 25);
  assert.equal(result.data && typeof result.data === 'object' && (result.data as { total?: number }).total, 1);
  assert.match(JSON.stringify(result), /ENG-7/);
  assert.doesNotMatch(JSON.stringify(result), /Private customer context/);
});

test('executeQueryData routes Notion through the partner adapter when connected', async () => {
  let receivedActionName = '';
  let receivedInput: Record<string, unknown> | undefined;
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'notion',
    queryType: 'investor_notes',
    connectedPartnerApps: ['notion'],
    filters: { pageSize: 5, includeContent: true },
    clientOverrides: {
      partnerToolExecutor: async (actionName: string, input: Record<string, unknown>) => {
        receivedActionName = actionName;
        receivedInput = input;
        return {
          results: [
            {
              id: 'page_1',
              object: 'page',
              title: 'June investor update notes',
              url: 'https://notion.so/page_1',
              last_edited_time: '2026-06-28T12:00:00.000Z',
              content: 'Raw Notion page body should not be returned.',
            },
          ],
        };
      },
    } as Parameters<typeof executeQueryData>[0]['clientOverrides'] & {
      partnerToolExecutor: (actionName: string, input: Record<string, unknown>) => Promise<unknown>;
    },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'notion');
  assert.equal(result.live, true);
  assert.equal(receivedActionName, 'NOTION_SEARCH_NOTION_PAGE');
  assert.equal(receivedInput?.query, 'investor update board fundraising');
  assert.equal(receivedInput?.page_size, 5);
  assert.equal(receivedInput?.filter_value, 'page');
  assert.equal(Object.prototype.hasOwnProperty.call(receivedInput || {}, 'includeContent'), false);
  assert.match(JSON.stringify(result), /June investor update notes/);
  assert.doesNotMatch(JSON.stringify(result), /Raw Notion page body/);
});

test('executeQueryData accepts legacy email and calendar aliases but normalizes sources', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'email',
    queryType: 'commitments',
    connectedPartnerApps: ['gmail'],
    clientOverrides: {
      googleWorkspaceExecutor: async () => ({ threads: [] }),
    },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'gmail');
  assert.equal(result.live, true);
});

test('query_data tool schema exposes Google Workspace sources and aliases', () => {
  const serverSource = readFileSync('src/server.ts', 'utf8');
  const schemaMatch = serverSource.match(/name: 'query_data'[\s\S]*?enum: \[([^\]]+)\]/);
  assert.ok(schemaMatch, 'query_data schema enum should be present');

  const enumSource = schemaMatch[1];
  for (const source of ['gmail', 'google_calendar', 'google_drive', 'email', 'calendar', 'drive']) {
    assert.match(enumSource, new RegExp(`'${source}'`), `${source} should be exposed in query_data source enum`);
  }
});

test('applyQueryStepPayloadToExecution marks readiness errors as failed automation steps', () => {
  const stepExecution = makeQueryStepExecution();
  const stepErrors: string[] = [];

  applyQueryStepPayloadToExecution({
    stepTitle: 'Check Stripe revenue',
    payload: {
      ok: false,
      code: 'integration_not_ready',
      source: 'stripe',
      message: 'Stripe read access is required before Revenue Watch can run with real data.',
    },
    stepExecution,
    stepErrors,
    artifactCount: 1,
  });

  assert.equal(stepExecution.status, 'failed');
  assert.equal(stepExecution.summary, 'Stripe read access is required before Revenue Watch can run with real data.');
  assert.equal(stepExecution.error, 'Stripe read access is required before Revenue Watch can run with real data.');
  assert.equal(stepExecution.artifactKind, 'query_data');
  assert.equal(stepExecution.toolCalls, 1);
  assert.equal(stepExecution.artifactCount, 1);
  assert.deepEqual(stepExecution.output, {
    ok: false,
    code: 'integration_not_ready',
    source: 'stripe',
    message: 'Stripe read access is required before Revenue Watch can run with real data.',
  });
  assert.deepEqual(stepErrors, [
    'Check Stripe revenue: Stripe read access is required before Revenue Watch can run with real data.',
  ]);
});

test('applyQueryStepPayloadToExecution skips unavailable optional query sources', () => {
  const stepExecution = makeQueryStepExecution();
  const stepErrors: string[] = [];

  applyQueryStepPayloadToExecution({
    stepTitle: 'Review optional Gmail threads',
    payload: {
      ok: false,
      code: 'integration_not_ready',
      source: 'gmail',
      message: 'Gmail is required before this workflow can read live partner data.',
    },
    stepExecution,
    stepErrors,
    artifactCount: 1,
    optional: true,
  });

  assert.equal(stepExecution.status, 'skipped');
  assert.equal(stepExecution.summary, 'Skipped optional gmail read because the integration is not available.');
  assert.equal(stepExecution.error, undefined);
  assert.equal(stepExecution.artifactKind, 'query_data');
  assert.equal(stepExecution.toolCalls, 1);
  assert.equal(stepExecution.artifactCount, 1);
  assert.deepEqual(stepErrors, []);
});

test('applyQueryStepPayloadToExecution still fails unsupported optional queries', () => {
  const stepExecution = makeQueryStepExecution();
  const stepErrors: string[] = [];

  applyQueryStepPayloadToExecution({
    stepTitle: 'Review optional custom source',
    payload: {
      ok: false,
      code: 'unsupported_query',
      source: 'gmail',
      message: 'Google Workspace query "everything" is not supported for gmail.',
    },
    stepExecution,
    stepErrors,
    artifactCount: 1,
    optional: true,
  });

  assert.equal(stepExecution.status, 'failed');
  assert.equal(stepExecution.summary, 'Google Workspace query "everything" is not supported for gmail.');
  assert.deepEqual(stepErrors, [
    'Review optional custom source: Google Workspace query "everything" is not supported for gmail.',
  ]);
});

test('applyQueryStepPayloadToExecution keeps successful query payloads successful', () => {
  const stepExecution = makeQueryStepExecution();
  const stepErrors: string[] = [];

  applyQueryStepPayloadToExecution({
    stepTitle: 'Check GitHub delivery',
    payload: {
      ok: true,
      source: 'github',
      query_type: 'open_issues',
      data: { total: 34 },
    },
    stepExecution,
    stepErrors,
    artifactCount: 1,
  });

  assert.equal(stepExecution.status, 'succeeded');
  assert.equal(stepExecution.summary, 'Pulled the requested live data successfully.');
  assert.equal(stepExecution.error, undefined);
  assert.equal(stepExecution.artifactKind, 'query_data');
  assert.equal(stepExecution.toolCalls, 1);
  assert.equal(stepExecution.artifactCount, 1);
  assert.deepEqual(stepExecution.output, {
    ok: true,
    source: 'github',
    query_type: 'open_issues',
    data: { total: 34 },
  });
  assert.deepEqual(stepErrors, []);
});
