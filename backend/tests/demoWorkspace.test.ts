import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import type { AutomationStepExecution } from '../src/platform/types';

// The workspace store resolves its file path from process.cwd() at import time,
// so the temp workspace has to be in place before any platform module loads.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-demo-workspace-'));
process.chdir(tempDir);

const FIXTURE_TIMESTAMP = '2026-08-01T12:00:00.000Z';

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeWorkspaces(items: Array<Record<string, unknown>>) {
  fs.writeFileSync(path.join(tempDir, 'platform-workspaces.json'), JSON.stringify(items, null, 2));
}

function workspaceFixture(id: string, metadata?: Record<string, unknown>) {
  return {
    id,
    slug: id.replace(/_/g, '-'),
    name: `Workspace ${id}`,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...(metadata ? { metadata } : {}),
  };
}

async function withDemoEnv<T>(value: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const previous = process.env.DEMO_WORKSPACE_IDS;
  if (typeof value === 'string') process.env.DEMO_WORKSPACE_IDS = value;
  else delete process.env.DEMO_WORKSPACE_IDS;
  try {
    return await run();
  } finally {
    if (typeof previous === 'string') process.env.DEMO_WORKSPACE_IDS = previous;
    else delete process.env.DEMO_WORKSPACE_IDS;
  }
}

test('no workspace is a demo workspace by default', async () => {
  writeWorkspaces([]);
  const { isDemoWorkspace } = await import('../src/platform/demoWorkspace');
  const { DEFAULT_WORKSPACE_ID } = await import('../src/platform/workspace');

  await withDemoEnv(undefined, () => {
    assert.equal(isDemoWorkspace(DEFAULT_WORKSPACE_ID), false);
    assert.equal(isDemoWorkspace('workspace_customer'), false);
    assert.equal(isDemoWorkspace(''), false);
  });
});

test('DEMO_WORKSPACE_IDS marks workspaces demo, trimmed and case-sensitive', async () => {
  writeWorkspaces([]);
  const { isDemoWorkspace } = await import('../src/platform/demoWorkspace');

  await withDemoEnv(' demo_alpha , demo_beta ,,', () => {
    assert.equal(isDemoWorkspace('demo_alpha'), true);
    assert.equal(isDemoWorkspace('demo_beta'), true);
    assert.equal(isDemoWorkspace('DEMO_ALPHA'), false);
    assert.equal(isDemoWorkspace('demo_gamma'), false);
  });
});

test('workspace profile metadata.demo === true marks a demo workspace', async () => {
  writeWorkspaces([
    workspaceFixture('ws_demo', { demo: true }),
    workspaceFixture('ws_real', { demo: 'true' }),
  ]);
  const { isDemoWorkspace } = await import('../src/platform/demoWorkspace');

  await withDemoEnv(undefined, () => {
    assert.equal(isDemoWorkspace('ws_demo'), true);
    assert.equal(isDemoWorkspace('ws_real'), false);
  });
});

test('reading demo status never creates a workspace record', async () => {
  writeWorkspaces([]);
  const { isDemoWorkspace } = await import('../src/platform/demoWorkspace');

  await withDemoEnv(undefined, () => {
    isDemoWorkspace('workspace_should_not_be_created');
  });

  const stored = JSON.parse(fs.readFileSync(path.join(tempDir, 'platform-workspaces.json'), 'utf-8'));
  assert.deepEqual(stored, []);
});

test('a real workspace querying an unconnected source fails closed with connect guidance', async () => {
  writeWorkspaces([]);
  const { executeQueryData } = await import('../src/integrationGateway/queryData');

  const result = await withDemoEnv(undefined, () => executeQueryData({
    workspaceId: 'workspace_customer',
    source: 'posthog',
    queryType: 'active_users',
    now: new Date(FIXTURE_TIMESTAMP),
  }));

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected a fail-closed integration error');
  assert.equal(result.code, 'integration_not_connected');
  assert.equal(result.source, 'posthog');
  assert.equal(result.message, 'PostHog is not connected. Connect it to query live workspace data.');
  assert.deepEqual(result.nextAction, {
    label: 'Connect PostHog',
    route: '/integrations?provider=posthog',
  });
  // No fabricated numbers may reach a real workspace.
  assert.doesNotMatch(JSON.stringify(result), /1247|6832|18940|simulated/);
});

test('a real workspace fallthrough query fails the automation step with connect guidance', async () => {
  writeWorkspaces([]);
  const { executeQueryData, applyQueryStepPayloadToExecution } = await import('../src/integrationGateway/queryData');
  const payload = await withDemoEnv(undefined, () => executeQueryData({
    workspaceId: 'workspace_customer',
    source: 'hubspot',
    queryType: 'deals',
  })) as unknown as Record<string, unknown>;

  const stepExecution: AutomationStepExecution = {
    stepId: 'step_query',
    kind: 'query',
    title: 'Pull HubSpot pipeline',
    assignedRole: 'analyst',
    status: 'running',
  };
  const stepErrors: string[] = [];

  applyQueryStepPayloadToExecution({
    stepTitle: 'Pull HubSpot pipeline',
    payload,
    stepExecution,
    stepErrors,
    artifactCount: 1,
  });

  assert.equal(stepExecution.status, 'failed');
  assert.equal(stepExecution.error, 'HubSpot is not connected. Connect it to query live workspace data.');
  assert.deepEqual(stepErrors, [
    'Pull HubSpot pipeline: HubSpot is not connected. Connect it to query live workspace data.',
  ]);
});

test('a flagged demo workspace keeps labeled simulated sample data', async () => {
  writeWorkspaces([]);
  const { executeQueryData } = await import('../src/integrationGateway/queryData');

  const result = await withDemoEnv('demo_workspace', () => executeQueryData({
    workspaceId: 'demo_workspace',
    source: 'posthog',
    queryType: 'active_users',
    now: new Date(FIXTURE_TIMESTAMP),
  }));

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected demo sample data');
  assert.equal((result as { live: boolean }).live, false);
  assert.equal((result as { simulated?: boolean }).simulated, true);
  assert.match(String((result as { message?: string }).message), /Simulated PostHog sample data/);
});

test('the delivery provenance gate names the simulated artifact it blocked', async () => {
  const { findFabricatedEvidence, buildFabricatedEvidenceDeliveryError } = await import('../src/platform/provenance');

  const finding = findFabricatedEvidence({
    artifacts: [
      { kind: 'web_search', title: 'Scan the market', payload: { results: [] } },
      { kind: 'query_data', title: 'Pull PostHog usage', payload: { ok: true, source: 'posthog', live: false, simulated: true } },
    ],
    stepExecutions: [],
  });

  assert.ok(finding, 'expected the simulated query artifact to be caught');
  assert.equal(finding?.source, 'posthog');
  assert.match(String(finding?.detail), /Pull PostHog usage/);
  assert.match(
    buildFabricatedEvidenceDeliveryError(finding!),
    /^Delivery blocked: .*simulated posthog data/,
  );
});

test('the delivery provenance gate catches simulated step output and passes clean live runs', async () => {
  const { findFabricatedEvidence } = await import('../src/platform/provenance');

  assert.ok(findFabricatedEvidence({
    artifacts: [],
    stepExecutions: [{ title: 'Run the model', output: { simulated: true, stdout: 'fabricated' } }],
  }));

  assert.equal(
    findFabricatedEvidence({
      artifacts: [
        { kind: 'query_data', title: 'Pull GitHub delivery risk', payload: { ok: true, source: 'github', live: true }, origin: { live: true, simulated: false, source: 'github' } },
        { kind: 'summary', title: 'Weekly summary', payload: { markdown: '# Weekly' } },
      ],
      stepExecutions: [
        { title: 'Pull GitHub delivery risk', output: { ok: true, source: 'github', live: true }, dataOrigin: 'live' },
        { title: 'Draft the summary', output: { markdown: '# Weekly' } },
      ],
    }),
    null,
  );
});

test('a failed read is honest failure, not fabricated evidence — its error report still delivers', async () => {
  const { findFabricatedEvidence } = await import('../src/platform/provenance');

  assert.equal(
    findFabricatedEvidence({
      artifacts: [
        {
          kind: 'query_data',
          title: 'Pull Stripe revenue',
          payload: { ok: false, code: 'integration_query_failed', source: 'stripe' },
          origin: { live: false, simulated: false, source: 'stripe' },
        },
      ],
      stepExecutions: [
        { title: 'Pull Stripe revenue', output: { ok: false, source: 'stripe' }, dataOrigin: 'none' },
      ],
    }),
    null,
  );
});

test('provenance origin records mirror the query payload without copying provider data', async () => {
  const { readQueryPayloadOrigin, readQueryPayloadDataOrigin } = await import('../src/platform/provenance');

  const livePayload = {
    ok: true,
    source: 'github',
    live: true,
    fetched_at: FIXTURE_TIMESTAMP,
    data: { openIssues: 12 },
  };
  assert.deepEqual(readQueryPayloadOrigin(livePayload), {
    live: true,
    simulated: false,
    source: 'github',
    fetchedAt: FIXTURE_TIMESTAMP,
  });
  assert.equal(readQueryPayloadDataOrigin(livePayload), 'live');

  assert.equal(readQueryPayloadDataOrigin({ ok: false, code: 'integration_not_connected', source: 'posthog' }), 'none');
  assert.equal(readQueryPayloadDataOrigin({ ok: true, source: 'posthog', live: false, simulated: true }), 'simulated');
});

test('a metadata-flagged demo workspace keeps labeled simulated sample data', async () => {
  writeWorkspaces([workspaceFixture('ws_demo', { demo: true })]);
  const { executeQueryData } = await import('../src/integrationGateway/queryData');

  const result = await withDemoEnv(undefined, () => executeQueryData({
    workspaceId: 'ws_demo',
    source: 'salesforce',
    queryType: 'pipeline',
  }));

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('expected demo sample data');
  assert.equal((result as { simulated?: boolean }).simulated, true);
});
