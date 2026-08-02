/**
 * `GET /api/admin/operations`, section by section.
 *
 * These are the questions the dashboard could not answer before: who is stuck
 * behind a missing connection, which reviews nobody has approved, which
 * scheduled mission is failing quietly, who is on stale terms, and which
 * workspaces have nothing connected. Each subtest pins one of them against
 * fixtures, and the partner lookup is injected so nothing reaches a live API.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { automationFixture, enterTempStores, writeAutomations } from './support/adminFixtures';

const stores = enterTempStores('admin-operations');
process.env.WORKSPACE_SETTINGS_SECRET = 'operations-suite-test-secret';

const NOW = new Date('2026-08-01T12:00:00.000Z');

test('the operations snapshot answers the operator questions', async (t) => {
  try {
    const workspaceModule = await import('../src/platform/workspace');
    const store = await import('../src/platform/store');
    const settings = await import('../src/settingsStore');
    const access = await import('../src/adminAccessStore');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const operations = await import('../src/adminOperations');

    workspaceModule.upsertWorkspaceProfile('tenant-alpha', {
      name: 'Alpha',
      ownerEmail: 'alpha@example.com',
      slug: 'alpha',
    });
    workspaceModule.upsertWorkspaceProfile('tenant-beta', {
      name: 'Beta',
      ownerEmail: 'beta@example.com',
      slug: 'beta',
    });

    writeAutomations(stores.tempDir, [
      automationFixture({
        id: 'auto_alpha_healthy',
        name: 'Alpha weekly',
        workspaceId: 'tenant-alpha',
        nextRunAt: '2026-08-03T09:00:00.000Z',
        lastRunStatus: 'succeeded',
      }),
      automationFixture({
        id: 'auto_alpha_failing',
        name: 'Alpha revenue watch',
        workspaceId: 'tenant-alpha',
        consecutiveFailures: 4,
        lastRunStatus: 'failed',
        nextRunAt: '2026-08-02T09:00:00.000Z',
      }),
      automationFixture({
        id: 'auto_beta_paused',
        name: 'Beta digest',
        workspaceId: 'tenant-beta',
        status: 'paused',
      }),
    ]);

    // ── a blocked mission, still blocked ──────────────────────────────────
    const blockedTask = store.createTask({
      workspaceId: 'tenant-alpha',
      title: 'Alpha revenue watch',
      kind: 'automation',
      metadata: {
        automationId: 'auto_alpha_failing',
        readinessBlock: {
          code: 'workflow_not_ready',
          workflowId: 'revenue-watch',
          blockers: [
            { key: 'stripe', label: 'Connect Stripe', detail: 'Stripe is not connected.' },
            { key: 'slack', label: 'Connect Slack', detail: 'Slack is not connected.' },
          ],
          blockedAt: '2026-08-01T08:00:00.000Z',
        },
      },
    });
    const blockedRun = store.createTaskRun({
      workspaceId: 'tenant-alpha',
      taskId: blockedTask.id,
      agentRole: 'operator',
      modelTier: 'default',
      estimatedCredits: 0,
      // `recordBlockedAutomationRun` writes the block onto BOTH records, so the
      // fixture does too: the task answers "still blocked", the run answers
      // "which class of failure was this".
      metadata: {
        automationId: 'auto_alpha_failing',
        readinessBlock: {
          code: 'workflow_not_ready',
          workflowId: 'revenue-watch',
          blockers: [
            { key: 'stripe', label: 'Connect Stripe', detail: 'Stripe is not connected.' },
            { key: 'slack', label: 'Connect Slack', detail: 'Slack is not connected.' },
          ],
          blockedAt: '2026-08-01T08:00:00.000Z',
        },
      },
    });
    store.updateTaskRun(blockedRun.id, {
      status: 'failed',
      finishedAt: '2026-08-01T08:00:00.000Z',
    });
    store.updateTask(blockedTask.id, { status: 'blocked' });

    // A mission that WAS blocked and has since been rerun must not read as open.
    const resolvedTask = store.createTask({
      workspaceId: 'tenant-beta',
      title: 'Beta digest',
      kind: 'automation',
      metadata: {
        automationId: 'auto_beta_paused',
        readinessBlock: {
          code: 'workflow_not_ready',
          blockers: [{ key: 'stripe', label: 'Connect Stripe', detail: 'x' }],
          blockedAt: '2026-07-25T08:00:00.000Z',
        },
      },
    });
    store.updateTask(resolvedTask.id, { status: 'completed' });

    // ── a review waiting on the operator ──────────────────────────────────
    const reviewTask = store.createTask({
      workspaceId: 'tenant-alpha',
      title: 'Alpha weekly',
      kind: 'automation',
      metadata: { automationId: 'auto_alpha_healthy' },
    });
    const reviewRun = store.createTaskRun({
      workspaceId: 'tenant-alpha',
      taskId: reviewTask.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 12,
      metadata: { automationId: 'auto_alpha_healthy', reviewRequired: true },
    });
    store.updateTaskRun(reviewRun.id, {
      status: 'succeeded',
      actualCredits: 12,
      finishedAt: '2026-08-01T06:00:00.000Z',
    });
    store.updateTask(reviewTask.id, { status: 'waiting_review' });

    // ── a connector failure inside the window ─────────────────────────────
    const failedTask = store.createTask({
      workspaceId: 'tenant-beta',
      title: 'Beta digest',
      kind: 'automation',
      metadata: { automationId: 'auto_beta_paused' },
    });
    const failedRun = store.createTaskRun({
      workspaceId: 'tenant-beta',
      taskId: failedTask.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 8,
      metadata: {
        automationId: 'auto_beta_paused',
        stepExecutions: [
          { kind: 'query', status: 'failed', output: { ok: false, source: 'stripe' } },
        ],
      },
    });
    store.updateTaskRun(failedRun.id, {
      status: 'failed',
      actualCredits: 2,
      finishedAt: '2026-08-01T10:00:00.000Z',
      error: 'Stripe returned 401 Unauthorized',
    });

    // ── terms state ───────────────────────────────────────────────────────
    const acceptedAt = '2026-07-20T09:00:00.000Z';
    consent.recordBetaConsent({
      email: 'current@example.com',
      participantType: 'founder_operator',
      authMethod: 'email',
      acceptanceSource: 'signup',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
    });
    access.recordAccessRequest({
      email: 'current@example.com',
      method: 'email',
      identityVerifiedAt: '2026-07-20T08:00:00.000Z',
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
    });
    access.recordAccessRequest({
      email: 'stale@example.com',
      method: 'email',
      acceptedTermsVersion: '2025-01-01-old-terms',
      acceptedTermsAt: '2025-01-02T00:00:00.000Z',
    });
    access.recordAccessRequest({ email: 'never@example.com', method: 'email' });

    // ── native credentials, workspace-owned ───────────────────────────────
    settings.upsertWorkspaceSettings({
      workspaceId: 'tenant-alpha',
      integrationCredentials: { stripe: { secretKey: 'sk_test_synthetic_value' } },
    });

    const buildOps = (overrides: Parameters<typeof operations.buildAdminOperations>[0] = {}) =>
      operations.buildAdminOperations({
        now: NOW,
        windowHours: 24,
        partnerEnabled: true,
        readPartnerConnections: async (workspaceId: string) => ({
          apps: workspaceId === 'tenant-alpha' ? ['slack', 'github'] : [],
          ok: true,
        }),
        ...overrides,
      });

    await t.test('blockedNow lists only missions that are still blocked', async () => {
      const ops = await buildOps();
      assert.equal(ops.blockedNow.length, 1, 'the reran Beta mission is no longer open');
      const [blocked] = ops.blockedNow;
      assert.equal(blocked.workspaceId, 'tenant-alpha');
      assert.equal(blocked.workspaceName, 'Alpha');
      assert.equal(blocked.automationName, 'Alpha revenue watch');
      assert.equal(blocked.taskId, blockedTask.id);
      assert.equal(blocked.runId, blockedRun.id);
      assert.deepEqual(blocked.blockerKeys, ['stripe', 'slack']);
      assert.deepEqual(blocked.blockerLabels, ['Stripe', 'Slack']);
      assert.equal(blocked.blockedAt, '2026-08-01T08:00:00.000Z');
    });

    await t.test('waitingReviews is cross-workspace and oldest first', async () => {
      const ops = await buildOps();
      assert.equal(ops.waitingReviews.length, 1);
      const [review] = ops.waitingReviews;
      assert.equal(review.workspaceId, 'tenant-alpha');
      assert.equal(review.missionName, 'Alpha weekly');
      assert.equal(review.runId, reviewRun.id);
      assert.equal(review.waitingSince, '2026-08-01T06:00:00.000Z');
      assert.equal(review.waitingHours, 6, 'six hours unreviewed at the fixture clock');
    });

    await t.test('recentFailures is windowed and grouped by kind', async () => {
      const ops = await buildOps();
      assert.equal(ops.recentFailures.windowHours, 24);
      assert.equal(ops.recentFailures.from, '2026-07-31T12:00:00.000Z');
      assert.equal(ops.recentFailures.to, '2026-08-01T12:00:00.000Z');
      assert.equal(ops.recentFailures.total, 2, 'the blocked run and the connector failure');
      assert.deepEqual(ops.recentFailures.countsByKind, {
        fabricated_evidence: 0,
        readiness_blocked: 1,
        connector: 1,
        other: 0,
      });
      const connector = ops.recentFailures.items.find((row) => row.runId === failedRun.id);
      assert.equal(connector?.failureKind, 'connector');
      assert.equal(connector?.failureSummary, 'Connector could not be read');
      assert.equal(
        JSON.stringify(connector).includes('401'),
        false,
        'the provider error text classifies the failure but never ships',
      );
    });

    await t.test('automationHealth surfaces failing and paused automations only', async () => {
      const ops = await buildOps();
      assert.deepEqual(
        ops.automationHealth.map((row) => row.automationId),
        ['auto_alpha_failing', 'auto_beta_paused'],
        'healthy automations are not noise on this surface; worst first',
      );
      const failing = ops.automationHealth[0];
      assert.equal(failing.workspaceId, 'tenant-alpha');
      assert.equal(failing.workspaceName, 'Alpha');
      assert.equal(failing.name, 'Alpha revenue watch');
      assert.equal(failing.consecutiveFailures, 4);
      assert.equal(failing.status, 'active');
      assert.equal(failing.paused, false);
      assert.equal(failing.lastRunStatus, 'failed');
      assert.equal(failing.nextRunAt, '2026-08-02T09:00:00.000Z');

      const paused = ops.automationHealth[1];
      assert.equal(paused.paused, true);
      assert.equal(paused.status, 'paused');
      assert.equal(paused.consecutiveFailures, 0, 'paused alone is enough to be listed');
    });

    await t.test('termsStaleness separates current, stale, and never-accepted', async () => {
      const ops = await buildOps();
      assert.equal(ops.termsStaleness.currentVersion, betaProgram.CURRENT_BETA_TERMS_VERSION);
      assert.equal(ops.termsStaleness.currentCount, 1);
      assert.equal(ops.termsStaleness.staleCount, 1);
      assert.equal(ops.termsStaleness.neverAcceptedCount, 1);
      assert.equal(ops.termsStaleness.totalAccounts, 3);
    });

    await t.test('integrations report partner and native state per workspace', async () => {
      const ops = await buildOps();
      const alpha = ops.integrations.byWorkspace.find((row) => row.workspaceId === 'tenant-alpha');
      const beta = ops.integrations.byWorkspace.find((row) => row.workspaceId === 'tenant-beta');

      assert.deepEqual(alpha?.connectedToolkits, ['github', 'slack']);
      assert.deepEqual(
        alpha?.workspaceConfiguredIntegrations,
        ['stripe'],
        'only credentials the WORKSPACE owns count — server credentials are ours',
      );
      assert.equal(alpha?.degraded, false);
      assert.deepEqual(beta?.connectedToolkits, []);
      assert.deepEqual(beta?.workspaceConfiguredIntegrations, []);
      assert.equal(ops.integrations.partnerEnabled, true);
      assert.equal(ops.integrations.degradedWorkspaces, 0);
    });

    await t.test('one workspace degrading does not take the endpoint down', async () => {
      const ops = await buildOps({
        readPartnerConnections: async (workspaceId: string) => {
          if (workspaceId === 'tenant-beta') throw new Error('composio unreachable');
          return { apps: ['slack'], ok: true };
        },
      });

      const alpha = ops.integrations.byWorkspace.find((row) => row.workspaceId === 'tenant-alpha');
      const beta = ops.integrations.byWorkspace.find((row) => row.workspaceId === 'tenant-beta');
      assert.equal(alpha?.degraded, false);
      assert.deepEqual(alpha?.connectedToolkits, ['slack']);
      assert.equal(beta?.degraded, true, 'cannot tell is not the same as nothing connected');
      assert.deepEqual(beta?.connectedToolkits, []);
      assert.equal(ops.integrations.degradedWorkspaces, 1);
      // Everything else still answered.
      assert.equal(ops.blockedNow.length, 1);
      assert.equal(ops.waitingReviews.length, 1);
    });

    await t.test('telemetry is embedded and stays privacy-projected', async () => {
      const ops = await buildOps();
      assert.equal(ops.telemetry.schemaVersion, 1);
      assert.ok(ops.telemetry.activation, 'the activation funnel is the highest-value unlock');
      assert.ok(ops.telemetry.reliability.byWorkflowId);
      assert.ok(ops.telemetry.creditBurn);
      assert.ok(ops.telemetry.stageFunnel);
      // Telemetry deliberately covers every workspace, unlike the scoped sections.
      assert.ok(
        ops.telemetry.workspaces.total >= ops.scope.workspaceCount,
        'platform self-observation is not workspace-scoped',
      );
    });

    // Kept last: it adds workspaces, which would change the counts above.
    await t.test('partner lookups are one per workspace and capped in flight', async () => {
      const calls: string[] = [];
      let inFlight = 0;
      let peakInFlight = 0;

      // Enough workspaces to exceed the concurrency cap.
      for (let index = 0; index < 12; index += 1) {
        workspaceModule.upsertWorkspaceProfile(`tenant-load-${index}`, {
          name: `Load ${index}`,
          slug: `load-${index}`,
        });
      }

      const ops = await buildOps({
        readPartnerConnections: async (workspaceId: string) => {
          calls.push(workspaceId);
          inFlight += 1;
          peakInFlight = Math.max(peakInFlight, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 5));
          inFlight -= 1;
          return { apps: [], ok: true };
        },
      });

      assert.equal(
        calls.length,
        ops.integrations.byWorkspace.length,
        'exactly one lookup per workspace — no repeats',
      );
      assert.equal(new Set(calls).size, calls.length);
      assert.ok(calls.length > 4, 'the fixture must actually exceed the cap to test it');
      assert.ok(
        peakInFlight <= 4,
        `partner lookups must stay capped; peaked at ${peakInFlight}`,
      );
    });
  } finally {
    stores.cleanup();
    delete process.env.WORKSPACE_SETTINGS_SECRET;
  }
});
