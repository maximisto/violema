/**
 * The admin privacy boundary, proved the way the telemetry boundary is: plant
 * sentinel strings in every content-bearing field the stores accept, then
 * assert none of them can reach any serialized admin payload.
 *
 * The leak this guards was real. `buildAdminOverview` shipped
 * `{ ...run, workspaceName }`, which carried the whole run `metadata` — draft
 * bodies, step outputs, delivery text — to the admin browser on every load.
 * A reader added to any admin builder without a projection should fail here.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SENTINELS,
  allSentinels,
  enterTempStores,
  poisonedReadinessBlock,
  poisonedRunMetadata,
  poisonedTaskMetadata,
  writeAutomations,
} from './support/adminFixtures';

// chdir BEFORE any src import: store paths are frozen at module load.
const stores = enterTempStores('admin-privacy');

function assertNoSentinels(label: string, payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const sentinel of allSentinels()) {
    assert.equal(
      serialized.includes(sentinel),
      false,
      `${label} leaked planted content (${sentinel})`,
    );
  }
}

test('no admin payload can carry planted tenant content', async () => {
  try {
    const workspace = await import('../src/platform/workspace');
    const store = await import('../src/platform/store');
    const provenance = await import('../src/platform/provenance');
    const access = await import('../src/adminAccessStore');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const dashboard = await import('../src/adminDashboard');
    const operations = await import('../src/adminOperations');

    const now = new Date('2026-08-01T12:00:00.000Z');
    const acceptedAt = '2026-07-20T09:00:00.000Z';

    workspace.upsertWorkspaceProfile('tenant-poison', {
      name: 'Poison Tenant',
      ownerEmail: 'tenant@example.com',
      slug: 'poison-tenant',
      metadata: { note: SENTINELS.workspaceMetadata },
    });

    writeAutomations(stores.tempDir, [
      {
        id: 'auto_poison',
        workspaceId: 'tenant-poison',
        name: 'Weekly founder update',
        description: SENTINELS.taskDescription,
        workflow_prompt: SENTINELS.automationPrompt,
        schedule: 'every monday at 9am',
        cron_expression: '0 9 * * 1',
        actions: [SENTINELS.summary],
        status: 'paused',
        consecutive_failures: 3,
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ]);

    consent.recordBetaConsent({
      email: 'tenant@example.com',
      participantType: 'founder_operator',
      authMethod: 'email',
      acceptanceSource: 'signup',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
    });
    access.recordAccessRequest({
      email: 'tenant@example.com',
      method: 'email',
      note: SENTINELS.reviewNote,
      identityVerifiedAt: '2026-07-20T08:00:00.000Z',
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
    });

    // 1. A delivered run: artifacts, step outputs, delivery body, review note.
    const deliveredTask = store.createTask({
      workspaceId: 'tenant-poison',
      title: 'Weekly founder update',
      description: SENTINELS.taskDescription,
      kind: 'automation',
      metadata: poisonedTaskMetadata('auto_poison'),
    });
    const deliveredRun = store.createTaskRun({
      workspaceId: 'tenant-poison',
      taskId: deliveredTask.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 20,
      metadata: poisonedRunMetadata('auto_poison'),
    });
    store.updateTaskRun(deliveredRun.id, {
      status: 'succeeded',
      actualCredits: 18,
      finishedAt: '2026-08-01T09:00:00.000Z',
    });
    store.updateTask(deliveredTask.id, { status: 'waiting_review' });

    // 2. A fabricated-evidence failure. Its error text embeds the workspace's
    //    own artifact title — the specific leak item 2 exists for.
    const fabricatedTask = store.createTask({
      workspaceId: 'tenant-poison',
      title: 'Revenue watch',
      kind: 'automation',
      metadata: poisonedTaskMetadata('auto_poison'),
    });
    const fabricatedRun = store.createTaskRun({
      workspaceId: 'tenant-poison',
      taskId: fabricatedTask.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 10,
      metadata: poisonedRunMetadata('auto_poison'),
    });
    store.updateTaskRun(fabricatedRun.id, {
      status: 'failed',
      actualCredits: 4,
      finishedAt: '2026-08-01T10:00:00.000Z',
      error: provenance.buildFabricatedEvidenceDeliveryError({
        label: SENTINELS.artifactTitle,
        source: 'stripe',
        detail: `"${SENTINELS.artifactTitle}" carries simulated stripe data`,
      }),
    });

    // 3. A readiness-blocked run, with a poisoned blocker key AND label.
    const blockedTask = store.createTask({
      workspaceId: 'tenant-poison',
      title: 'Blocked mission',
      kind: 'automation',
      metadata: {
        automationId: 'auto_poison',
        readinessBlock: poisonedReadinessBlock('2026-08-01T11:00:00.000Z'),
      },
    });
    const blockedRun = store.createTaskRun({
      workspaceId: 'tenant-poison',
      taskId: blockedTask.id,
      agentRole: 'operator',
      modelTier: 'default',
      estimatedCredits: 0,
      metadata: {
        automationId: 'auto_poison',
        readinessBlock: poisonedReadinessBlock('2026-08-01T11:00:00.000Z'),
      },
    });
    store.updateTaskRun(blockedRun.id, {
      status: 'failed',
      actualCredits: 0,
      finishedAt: '2026-08-01T11:00:00.000Z',
      error: `This automation cannot run yet — ${SENTINELS.summary}`,
    });
    store.updateTask(blockedTask.id, { status: 'blocked' });

    // 4. A plain failure whose error text is raw provider output.
    const plainTask = store.createTask({
      workspaceId: 'tenant-poison',
      title: 'Plain failure',
      kind: 'report',
    });
    const plainRun = store.createTaskRun({
      workspaceId: 'tenant-poison',
      taskId: plainTask.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 6,
    });
    store.updateTaskRun(plainRun.id, {
      status: 'failed',
      actualCredits: 6,
      finishedAt: '2026-08-01T11:30:00.000Z',
      error: SENTINELS.runError,
    });

    // 5. A ledger entry with a poisoned note and metadata.
    store.addLedgerEntry({
      workspaceId: 'tenant-poison',
      source: 'manual_adjustment',
      deltaCredits: 500,
      referenceType: 'manual',
      referenceId: 'poison-grant',
      note: SENTINELS.ledgerNote,
      metadata: { rationale: SENTINELS.ledgerNote },
    });

    // ── the fixture is genuinely poisoned ───────────────────────────────────
    //
    // Without this the suite could pass by reading nothing at all. Every
    // sentinel must be present in the RAW stores, so the assertions below are
    // testing projection rather than absence of data.
    const scheduler = await import('../src/scheduler');
    const rawState = JSON.stringify(store.getPlatformState())
      + JSON.stringify(workspace.listWorkspaces())
      + JSON.stringify(access.listAdminAccessRecords())
      + JSON.stringify(scheduler.listAutomations());
    for (const sentinel of allSentinels()) {
      assert.equal(
        rawState.includes(sentinel),
        true,
        `fixture is not actually poisoned with ${sentinel}; the leak test would be vacuous`,
      );
    }

    // ── every admin payload, serialized exactly as the browser receives it ──

    const overview = dashboard.buildAdminOverview({ now, windowHours: 24 });
    assertNoSentinels('overview', overview);
    assert.equal(overview.recentFailedRuns.length, 3, 'all three failures are inside the window');

    assertNoSentinels('users', dashboard.buildAdminUsers());
    assertNoSentinels('workspaces', dashboard.buildAdminWorkspaces());
    assertNoSentinels('workspace detail', dashboard.buildWorkspaceAdminDetail('tenant-poison'));
    assertNoSentinels('audit', dashboard.buildAdminAudit(100));

    const ops = await operations.buildAdminOperations({
      now,
      windowHours: 24,
      partnerEnabled: true,
      // Composio is injected: this suite never reaches a live API.
      readPartnerConnections: async () => ({ apps: ['stripe', 'slack'], ok: true }),
    });
    assertNoSentinels('operations', ops);

    // The classification still has to be USEFUL, not merely safe.
    const fabricated = overview.recentFailedRuns.find((row) => row.runId === fabricatedRun.id);
    assert.equal(fabricated?.failureKind, 'fabricated_evidence');
    assert.equal(fabricated?.failureSummary, 'Blocked: simulated evidence');

    const blocked = overview.recentFailedRuns.find((row) => row.runId === blockedRun.id);
    assert.equal(blocked?.failureKind, 'readiness_blocked');
    assert.equal(
      blocked?.failureSummary,
      'Blocked: connect Stripe, An unrecognized connection',
      'a known blocker is named; an unrecognized one buckets instead of echoing',
    );
    assert.deepEqual(blocked?.blockerKeys, ['stripe', 'unrecognized_blocker']);

    const plain = overview.recentFailedRuns.find((row) => row.runId === plainRun.id);
    assert.equal(plain?.failureKind, 'other');
    assert.equal(plain?.failureSummary, 'Run failed');

    // Mission labels ARE admissible — the operator cannot act without them.
    assert.equal(fabricated?.automationName, 'Weekly founder update');

    // The blocked mission is what `blockedNow` exists to surface.
    assert.equal(ops.blockedNow.length, 1);
    assert.deepEqual(ops.blockedNow[0].blockerKeys, ['stripe', 'unrecognized_blocker']);
    assert.deepEqual(
      ops.blockedNow[0].blockerLabels,
      ['Stripe', 'An unrecognized connection'],
      'labels are derived from the allowlisted key, never echoed from the record',
    );
  } finally {
    stores.cleanup();
  }
});
