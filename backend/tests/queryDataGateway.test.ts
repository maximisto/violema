import assert from 'node:assert/strict';
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

  if (!result.ok) throw new Error('expected GitHub mock success');
  assert.equal(result.source, 'github');
  assert.equal(result.live, false);
  assert.equal((result.data as { total: number }).total, 34);
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
