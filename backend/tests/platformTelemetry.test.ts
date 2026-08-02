import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Every store module binds its file path from `process.cwd()` at import time,
// so the chdir has to happen before the first dynamic import. Static imports
// are hoisted, which is why nothing from `src/` is imported at the top.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-platform-telemetry-'));
process.chdir(tempDir);

/**
 * One recognizable token, planted in every field a workspace's owner could
 * have authored or received. It appears in slug-shaped, sentence-shaped, and
 * address-shaped variants so the test proves an ALLOWLIST is in force rather
 * than a character filter a well-formed slug would slip through.
 */
const SENTINEL = 'ZZQXLEAKSENTINELZZ';
const SENTINEL_TEXT = `${SENTINEL} customer content that must never leave the workspace`;
const SENTINEL_SLUG = `${SENTINEL.toLowerCase()}_slug`;
const SENTINEL_EMAIL = `${SENTINEL.toLowerCase()}@example.invalid`;

const NOW = new Date('2026-08-01T12:00:00.000Z');
const DEFAULT_WORKSPACE = 'purpleorangehq';

function poisonedWorkspaces() {
  return [
    {
      id: DEFAULT_WORKSPACE,
      slug: SENTINEL_SLUG,
      name: SENTINEL_TEXT,
      ownerEmail: SENTINEL_EMAIL,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      metadata: { notes: SENTINEL_TEXT },
    },
    {
      id: 'workspace_acme',
      slug: 'acme',
      name: SENTINEL_TEXT,
      ownerEmail: SENTINEL_EMAIL,
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    },
    {
      id: 'workspace_stalled',
      slug: 'stalled',
      name: SENTINEL_TEXT,
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
    },
  ];
}

function poisonedTasks() {
  return [
    {
      id: 'task_1',
      workspaceId: DEFAULT_WORKSPACE,
      title: SENTINEL_TEXT,
      description: SENTINEL_TEXT,
      kind: 'automation',
      status: 'completed',
      priority: 'medium',
      createdAt: '2026-07-29T00:00:00.000Z',
      updatedAt: '2026-07-29T01:00:00.000Z',
      metadata: {
        latestSummary: SENTINEL_TEXT,
        latestArtifacts: [{ kind: 'summary', title: SENTINEL_TEXT, payload: { markdown: SENTINEL_TEXT } }],
      },
    },
    {
      id: 'task_2',
      workspaceId: 'workspace_acme',
      title: SENTINEL_TEXT,
      kind: 'automation',
      status: 'canceled',
      priority: 'medium',
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T01:00:00.000Z',
    },
    {
      id: 'task_3',
      workspaceId: 'workspace_acme',
      title: SENTINEL_TEXT,
      kind: 'automation',
      status: 'waiting_review',
      priority: 'medium',
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T01:00:00.000Z',
    },
  ];
}

function poisonedTaskRuns(fabricatedEvidenceError: string) {
  return [
    {
      id: 'run_1',
      workspaceId: DEFAULT_WORKSPACE,
      taskId: 'task_1',
      agentRole: 'operator',
      modelTier: 'default',
      status: 'succeeded',
      estimatedCredits: 10,
      actualCredits: 12,
      startedAt: '2026-07-29T00:00:00.000Z',
      finishedAt: '2026-07-29T00:05:00.000Z',
      metadata: {
        summary: SENTINEL_TEXT,
        artifacts: [{ kind: 'summary', title: SENTINEL_TEXT, payload: { markdown: SENTINEL_TEXT } }],
        reviewRequired: false,
        reviewReceipt: { status: 'delivered', note: SENTINEL_TEXT, artifactTitle: SENTINEL_TEXT },
        delivery: { to: `#${SENTINEL_SLUG}`, body: SENTINEL_TEXT },
        stepExecutions: [
          {
            stepId: 'step_a',
            kind: 'query',
            title: SENTINEL_TEXT,
            summary: SENTINEL_TEXT,
            status: 'succeeded',
            dataOrigin: 'live',
            output: { source: 'stripe', ok: true, live: true, data: { mrr: 1234, note: SENTINEL_TEXT } },
          },
          { stepId: 'step_b', kind: 'deliver', title: SENTINEL_TEXT, status: 'succeeded', dataOrigin: 'none' },
        ],
      },
    },
    {
      id: 'run_2',
      workspaceId: 'workspace_acme',
      taskId: 'task_2',
      agentRole: 'operator',
      modelTier: 'default',
      status: 'failed',
      estimatedCredits: 4,
      actualCredits: 4,
      startedAt: '2026-07-30T00:00:00.000Z',
      metadata: {
        summary: SENTINEL_TEXT,
        reviewRequired: true,
        readinessBlock: {
          code: 'workflow_not_ready',
          tier: 'step_sources',
          summary: SENTINEL_TEXT,
          blockers: [
            { key: 'stripe', label: SENTINEL_TEXT, detail: SENTINEL_TEXT },
            { key: SENTINEL_SLUG, label: SENTINEL_TEXT, detail: SENTINEL_TEXT },
          ],
        },
        stepExecutions: [
          {
            stepId: 'step_c',
            kind: 'query',
            title: SENTINEL_TEXT,
            status: 'failed',
            dataOrigin: 'none',
            error: SENTINEL_TEXT,
            output: { source: SENTINEL_TEXT, ok: false, message: SENTINEL_TEXT },
          },
        ],
      },
    },
    {
      id: 'run_3',
      workspaceId: 'workspace_acme',
      taskId: 'task_3',
      agentRole: 'operator',
      modelTier: 'default',
      status: 'succeeded',
      estimatedCredits: 25,
      actualCredits: 30,
      startedAt: '2026-07-31T00:00:00.000Z',
      metadata: {
        stepExecutions: [
          {
            stepId: 'step_d',
            kind: 'deliver',
            title: SENTINEL_TEXT,
            status: 'failed',
            dataOrigin: 'none',
            error: fabricatedEvidenceError,
          },
        ],
      },
    },
    {
      id: 'run_prior',
      workspaceId: DEFAULT_WORKSPACE,
      taskId: 'task_1',
      agentRole: 'operator',
      modelTier: 'default',
      status: 'succeeded',
      estimatedCredits: 8,
      actualCredits: 8,
      startedAt: '2026-07-20T00:00:00.000Z',
      metadata: { stepExecutions: [] },
    },
  ];
}

function poisonedCreditLedger() {
  return [
    {
      id: 'credit_1',
      workspaceId: DEFAULT_WORKSPACE,
      direction: 'debit',
      source: 'automation_run',
      deltaCredits: -12,
      balanceAfterCredits: 988,
      note: SENTINEL_TEXT,
      metadata: { title: SENTINEL_TEXT },
      createdAt: '2026-07-29T00:05:00.000Z',
    },
    {
      id: 'credit_2',
      workspaceId: 'workspace_acme',
      direction: 'debit',
      source: 'automation_run',
      deltaCredits: -4,
      balanceAfterCredits: 496,
      note: SENTINEL_TEXT,
      createdAt: '2026-07-30T00:05:00.000Z',
    },
  ];
}

function poisonedLedgerEvents() {
  return [
    {
      id: 'ledger_1',
      workspaceId: DEFAULT_WORKSPACE,
      workflowId: 'weekly-founder-update',
      taskRunId: 'run_1',
      type: 'data_read',
      summary: SENTINEL_TEXT,
      metadata: { source: 'stripe', queryType: SENTINEL_TEXT, ok: true, live: true },
      createdAt: '2026-07-29T00:01:00.000Z',
    },
    {
      id: 'ledger_2',
      workspaceId: DEFAULT_WORKSPACE,
      workflowId: 'weekly-founder-update',
      taskRunId: 'run_1',
      type: 'external_action_executed',
      summary: SENTINEL_TEXT,
      metadata: { deliveryTarget: `#${SENTINEL_SLUG}`, delivery: { body: SENTINEL_TEXT } },
      createdAt: '2026-07-29T00:04:00.000Z',
    },
    {
      id: 'ledger_3',
      workspaceId: DEFAULT_WORKSPACE,
      workflowId: 'weekly-founder-update',
      taskRunId: 'run_1',
      type: 'approval_granted',
      summary: SENTINEL_TEXT,
      createdAt: '2026-07-29T00:03:00.000Z',
    },
    {
      id: 'ledger_4',
      workspaceId: 'workspace_acme',
      workflowId: 'custom-workflow',
      taskRunId: 'run_2',
      type: 'connector_failed',
      summary: SENTINEL_TEXT,
      metadata: { source: 'stripe', ok: false, live: false },
      createdAt: '2026-07-30T00:01:00.000Z',
    },
    {
      id: 'ledger_5',
      workspaceId: 'workspace_acme',
      workflowId: 'custom-workflow',
      type: 'approval_denied',
      summary: SENTINEL_TEXT,
      createdAt: '2026-07-30T02:00:00.000Z',
    },
    {
      id: 'ledger_6',
      workspaceId: 'workspace_acme',
      workflowId: 'custom-workflow',
      type: 'data_read',
      summary: SENTINEL_TEXT,
      metadata: { source: 'github', ok: true, live: false },
      createdAt: '2026-07-30T00:02:00.000Z',
    },
    {
      // Unknown workflow id AND unknown source, both slug-shaped: the allowlist
      // must bucket them rather than echo them.
      id: 'ledger_7',
      workspaceId: 'workspace_acme',
      workflowId: SENTINEL_SLUG,
      type: 'data_read',
      summary: SENTINEL_TEXT,
      metadata: { source: SENTINEL_SLUG, ok: true, live: false },
      createdAt: '2026-07-30T00:03:00.000Z',
    },
  ];
}

/**
 * An account record carries two things a workspace record does not: an email
 * address, and an operator-written rationale for its stage. Both are poisoned
 * here, alongside slug-shaped unknowns on each closed-set axis, so the
 * projection has to prove it reads neither and buckets rather than echoes.
 */
function poisonedAccounts() {
  return [
    {
      email: SENTINEL_EMAIL,
      workspaceId: DEFAULT_WORKSPACE,
      role: 'user',
      participantType: 'team_member',
      accountStage: { stage: 'paying', reason: SENTINEL_TEXT, derivedFrom: [SENTINEL_TEXT] },
      activated: true,
      hasTrialGrant: true,
      stageOverride: null,
      stageOverrideBy: SENTINEL_EMAIL,
      stageOverrideAt: '2026-07-29T00:00:00.000Z',
    },
    {
      email: SENTINEL_EMAIL,
      workspaceId: 'workspace_acme',
      role: 'user',
      participantType: SENTINEL_SLUG,
      accountStage: { stage: SENTINEL_SLUG, reason: SENTINEL_TEXT, derivedFrom: [SENTINEL_SLUG] },
      activated: false,
      hasTrialGrant: true,
      stageOverride: null,
      stageOverrideBy: null,
      stageOverrideAt: null,
    },
    {
      email: SENTINEL_EMAIL,
      workspaceId: 'workspace_stalled',
      role: 'user',
      participantType: 'advisor',
      accountStage: { stage: 'applicant', reason: SENTINEL_TEXT, derivedFrom: [SENTINEL_TEXT] },
      activated: false,
      hasTrialGrant: false,
      stageOverride: null,
      stageOverrideBy: null,
      stageOverrideAt: null,
    },
  ];
}

async function buildPoisonedSnapshot() {
  const telemetry = await import('../src/platform/platformTelemetry');
  const { buildFabricatedEvidenceDeliveryError } = await import('../src/platform/provenance');
  const fabricatedError = buildFabricatedEvidenceDeliveryError({
    label: SENTINEL_TEXT,
    source: SENTINEL_SLUG,
    detail: `"${SENTINEL_TEXT}" carries simulated data`,
  });

  return telemetry.composePlatformTelemetrySnapshot({
    workspaces: poisonedWorkspaces() as never,
    tasks: poisonedTasks() as never,
    taskRuns: poisonedTaskRuns(fabricatedError) as never,
    ledger: poisonedCreditLedger() as never,
    ledgerEvents: poisonedLedgerEvents() as never,
    accounts: poisonedAccounts() as never,
    now: NOW,
  });
}

test('poisoned store records cannot leak into the telemetry snapshot', async () => {
  const snapshot = await buildPoisonedSnapshot();
  const serialized = JSON.stringify(snapshot);

  assert.equal(
    serialized.toLowerCase().includes(SENTINEL.toLowerCase()),
    false,
    'A sentinel planted in artifact payloads, summaries, titles, review notes, blocker labels, workspace names, emails, or source/workflow slugs reached the serialized snapshot. The aggregation must read an allowlist of operational metadata only.',
  );

  // The sentinel is absent because unknown identifiers BUCKET, not because the
  // records were dropped: the aggregation still saw and counted them.
  const sources = snapshot.reliability.bySource.map((entry) => entry.source);
  assert.ok(sources.includes('unrecognized_source'), 'Expected an unknown source slug to bucket.');
  const workflowIds = snapshot.reliability.byWorkflowId.map((entry) => entry.workflowId);
  assert.ok(workflowIds.includes('unrecognized_workflow'), 'Expected an unknown workflow id to bucket.');
  assert.ok(
    snapshot.reliability.topBlockers.some((blocker) => blocker.key === 'unrecognized_blocker'),
    'Expected an unknown blocker key to bucket.',
  );
  const stages = snapshot.stageFunnel.byStage.map((bucket) => bucket.stage);
  assert.ok(stages.includes('unrecognized_stage'), 'Expected an unknown account stage to bucket.');
  assert.ok(
    snapshot.stageFunnel.byParticipantType.some(
      (bucket) => bucket.participantType === 'unrecognized_participant_type',
    ),
    'Expected an unknown participant type to bucket.',
  );
  // The account fixtures were counted, not dropped — the sentinel is absent
  // because only three allowlisted fields crossed the boundary.
  assert.equal(snapshot.stageFunnel.totalAccounts, 3);
});

test('telemetry snapshot aggregates the window into a well-formed shape', async () => {
  const snapshot = await buildPoisonedSnapshot();

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.window.trailingDays, 7);
  assert.equal(snapshot.window.from, '2026-07-25T12:00:00.000Z');
  assert.equal(snapshot.window.to, '2026-08-01T12:00:00.000Z');
  assert.equal(snapshot.window.priorFrom, '2026-07-18T12:00:00.000Z');

  assert.deepEqual(snapshot.workspaces, {
    total: 3,
    createdInWindow: 2,
    activeInWindow: 2,
    activeCumulative: 2,
    deliveredInWindow: 1,
    deliveredCumulative: 1,
  });

  assert.equal(snapshot.activation.signedUp, 3);
  // Only a successful LIVE read counts as a proven connection.
  assert.equal(snapshot.activation.connectedAtLeastOneSource, 1);
  assert.equal(snapshot.activation.reachedFirstRun, 2);
  assert.equal(snapshot.activation.reachedFirstDelivery, 1);
  assert.equal(snapshot.activation.firstRunRatePct, 66.7);
  // Signed up 2026-06-01T00:00, first delivery event 2026-07-29T00:04:
  // 58 days plus 4 minutes, rounded to one decimal.
  assert.equal(snapshot.activation.medianHoursToFirstDelivery, 1392.1);
  assert.deepEqual(snapshot.activation.stalledWorkspaceIds, ['workspace_acme', 'workspace_stalled']);

  // Stage funnel. Every known stage is emitted, including zeroes, so the weekly
  // brief keeps a stable shape; the bucket appears only because a fixture
  // carried an unknown stage.
  assert.deepEqual(
    snapshot.stageFunnel.byStage.map((bucket) => bucket.stage),
    ['internal', 'applicant', 'trial', 'paying', 'lapsed', 'unrecognized_stage'],
  );
  const payingBucket = snapshot.stageFunnel.byStage.find((bucket) => bucket.stage === 'paying');
  // The paying account sits on the default workspace, which has a succeeded run.
  assert.deepEqual(payingBucket, { stage: 'paying', accounts: 1, activated: 1, activationRatePct: 100 });
  const applicantBucket = snapshot.stageFunnel.byStage.find((bucket) => bucket.stage === 'applicant');
  // workspace_stalled never ran, so its account is in-stage but not activated.
  assert.deepEqual(applicantBucket, { stage: 'applicant', accounts: 1, activated: 0, activationRatePct: 0 });
  assert.deepEqual(
    snapshot.stageFunnel.byStage.find((bucket) => bucket.stage === 'trial'),
    { stage: 'trial', accounts: 0, activated: 0, activationRatePct: 0 },
  );
  // Activation is recomputed from run status, not trusted from the account
  // record: the acme fixture claims `activated: false` while its workspace has
  // a succeeded run, and the funnel follows the run.
  assert.deepEqual(
    snapshot.stageFunnel.byStage.find((bucket) => bucket.stage === 'unrecognized_stage'),
    { stage: 'unrecognized_stage', accounts: 1, activated: 1, activationRatePct: 100 },
  );

  // Two accounts hold a trial grant; one of them is now paying.
  assert.equal(snapshot.stageFunnel.trialGranted, 2);
  assert.equal(snapshot.stageFunnel.trialConvertedToPaying, 1);
  assert.equal(snapshot.stageFunnel.trialToPayingConversionPct, 50);
  assert.deepEqual(
    [...snapshot.stageFunnel.byParticipantType].map((bucket) => bucket.participantType).sort(),
    ['advisor', 'team_member', 'unrecognized_participant_type'],
  );

  const founder = snapshot.reliability.byWorkflowId.find(
    (entry) => entry.workflowId === 'weekly-founder-update',
  );
  assert.deepEqual(founder, {
    workflowId: 'weekly-founder-update',
    runs: 1,
    succeeded: 1,
    failed: 0,
    blocked: 0,
    successRatePct: 100,
    blockedRatePct: 0,
  });
  const custom = snapshot.reliability.byWorkflowId.find((entry) => entry.workflowId === 'custom-workflow');
  assert.equal(custom?.failed, 1);
  assert.equal(custom?.blocked, 1);

  const stripe = snapshot.reliability.bySource.find((entry) => entry.source === 'stripe');
  assert.deepEqual(stripe, {
    source: 'stripe',
    reads: 2,
    ok: 1,
    failed: 1,
    liveReads: 1,
    simulatedReads: 0,
    okRatePct: 50,
  });

  const query = snapshot.reliability.byStepKind.find((entry) => entry.kind === 'query');
  assert.equal(query?.executions, 2);
  assert.equal(query?.succeeded, 1);
  assert.equal(query?.failed, 1);
  assert.equal(query?.liveDataSteps, 1);

  assert.deepEqual(
    snapshot.reliability.topBlockers.map((blocker) => blocker.key).sort(),
    ['stripe', 'unrecognized_blocker'],
  );

  assert.deepEqual(snapshot.review, {
    approved: 1,
    changesRequested: 1,
    rejected: 1,
    blockedFabricated: 1,
    awaitingReview: 1,
    correctionRatePct: 66.7,
  });

  assert.equal(snapshot.creditBurn.chargedRuns, 3);
  assert.equal(snapshot.creditBurn.p50CreditsPerRun, 12);
  assert.equal(snapshot.creditBurn.p90CreditsPerRun, 30);
  assert.equal(snapshot.creditBurn.totalSpentCredits, 16);

  const runsDelta = snapshot.deltasVsPriorWeek.find((entry) => entry.metric === 'runs');
  assert.deepEqual(runsDelta, { metric: 'runs', current: 3, prior: 1, delta: 2 });
});

test('platform_telemetry is refused for a tenant workspace and served to the default workspace', async () => {
  const { executeQueryData } = await import('../src/integrationGateway/queryData');
  const { PLATFORM_TELEMETRY_SOURCE } = await import('../src/platform/platformTelemetry');

  const denied = await executeQueryData({
    workspaceId: 'workspace_acme',
    source: PLATFORM_TELEMETRY_SOURCE,
    queryType: 'platform_learning_snapshot',
    now: NOW,
  });

  assert.equal(denied.ok, false);
  assert.equal(denied.ok === false && denied.code, 'integration_not_connected');
  assert.match(
    denied.ok === false ? denied.message : '',
    /internal operating data/i,
    'The denial must name this as internal Violema data, not pretend it is connectable.',
  );

  // A demo workspace gets the same refusal — labeled sample data is allowed for
  // integrations, never as a stand-in for another workspace's aggregate.
  const originalDemoIds = process.env.DEMO_WORKSPACE_IDS;
  process.env.DEMO_WORKSPACE_IDS = 'workspace_demo';
  try {
    const demoDenied = await executeQueryData({
      workspaceId: 'workspace_demo',
      source: PLATFORM_TELEMETRY_SOURCE,
      queryType: 'platform_learning_snapshot',
      now: NOW,
    });
    assert.equal(demoDenied.ok, false);
  } finally {
    if (originalDemoIds === undefined) delete process.env.DEMO_WORKSPACE_IDS;
    else process.env.DEMO_WORKSPACE_IDS = originalDemoIds;
  }

  const allowed = await executeQueryData({
    workspaceId: DEFAULT_WORKSPACE,
    source: PLATFORM_TELEMETRY_SOURCE,
    queryType: 'platform_learning_snapshot',
    now: NOW,
  });

  assert.equal(allowed.ok, true);
  const success = allowed as unknown as {
    live: boolean;
    simulated: boolean;
    fetched_at: string;
    data: { schemaVersion: number; window: { trailingDays: number }; notes: string[] };
  };
  assert.equal(success.live, true);
  assert.equal(success.simulated, false);
  assert.equal(success.fetched_at, NOW.toISOString());
  assert.equal(success.data.schemaVersion, 1);
  assert.equal(success.data.window.trailingDays, 7);
  assert.ok(success.data.notes.length > 0, 'Expected the snapshot to carry its own definitions.');
});

test('the readiness gate blocks a tenant telemetry step and passes the default workspace', async () => {
  const { evaluateRunReadiness, listLiveCapableQuerySourcesForWorkspace, LIVE_CAPABLE_QUERY_SOURCES } =
    await import('../src/integrationGateway/runReadinessGate');
  const { PLATFORM_TELEMETRY_SOURCE, PLATFORM_LEARNING_BRIEF_WORKFLOW_ID } =
    await import('../src/platform/platformTelemetry');

  const steps = [
    { kind: 'query', title: 'Read platform telemetry', inputs: { source: PLATFORM_TELEMETRY_SOURCE } },
  ];

  const tenant = evaluateRunReadiness({
    workflowId: PLATFORM_LEARNING_BRIEF_WORKFLOW_ID,
    workspaceId: 'workspace_acme',
    isDemoWorkspace: false,
    steps,
  });
  assert.equal(tenant.allowed, false);
  assert.equal(tenant.tier, 'step_sources');
  assert.deepEqual(tenant.blockers.map((blocker) => blocker.key), [PLATFORM_TELEMETRY_SOURCE]);
  // Nothing to connect, so the blocker must not offer a connect route.
  assert.equal(tenant.blockers[0].route, undefined);

  const internal = evaluateRunReadiness({
    workflowId: PLATFORM_LEARNING_BRIEF_WORKFLOW_ID,
    workspaceId: DEFAULT_WORKSPACE,
    isDemoWorkspace: false,
    steps,
  });
  assert.equal(internal.allowed, true);
  assert.equal(internal.tier, 'step_sources');
  assert.deepEqual(internal.blockers, []);

  // The tenant-facing live-capable set must not widen.
  assert.equal(LIVE_CAPABLE_QUERY_SOURCES.includes(PLATFORM_TELEMETRY_SOURCE), false);
  assert.equal(
    listLiveCapableQuerySourcesForWorkspace('workspace_acme').includes(PLATFORM_TELEMETRY_SOURCE),
    false,
  );
  assert.equal(
    listLiveCapableQuerySourcesForWorkspace(DEFAULT_WORKSPACE).includes(PLATFORM_TELEMETRY_SOURCE),
    true,
  );
});

test('platform_telemetry never appears on a tenant-facing surface', async () => {
  const { buildIntegrationCatalog, INTEGRATION_PROVIDERS } = await import('../src/integrationRegistry');
  const { PLATFORM_TELEMETRY_SOURCE } = await import('../src/platform/platformTelemetry');

  const catalog = buildIntegrationCatalog({ partnerEnabled: true, connectedPartnerApps: [] });
  assert.equal(
    JSON.stringify(catalog).includes(PLATFORM_TELEMETRY_SOURCE),
    false,
    'Internal telemetry must never be offered as a connectable integration.',
  );
  assert.equal((INTEGRATION_PROVIDERS as string[]).includes(PLATFORM_TELEMETRY_SOURCE), false);

  // The chat agent's query_data tool enum is the other place a tenant could
  // name a source. It is a literal in server.ts, so assert on the declaration.
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.ts'), 'utf-8');
  const toolIndex = serverSource.indexOf("name: 'query_data'");
  assert.ok(toolIndex > 0, 'Expected to find the query_data tool declaration.');
  const toolDeclaration = serverSource.slice(toolIndex, toolIndex + 900);
  assert.equal(
    toolDeclaration.includes(PLATFORM_TELEMETRY_SOURCE),
    false,
    'The query_data tool enum is tenant-facing; the internal telemetry source must not be listed there.',
  );
});
