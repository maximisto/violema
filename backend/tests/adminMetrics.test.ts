/**
 * The four wrong numbers.
 *
 * Each assertion here corresponds to a metric the audit found dishonest:
 *
 *   - `automationCount` printed the GLOBAL count on every workspace row
 *   - `recentUsers` sliced an alphabetical array and called it latest activity
 *   - the failure feed was all-time, so a fixed bug looked like a live one
 *   - demo/internal workspaces counted as customers
 *   - `averageRunCredits` presented estimates as actuals
 *   - readiness blocks counted as product failures
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { automationFixture, enterTempStores, writeAutomations } from './support/adminFixtures';

const stores = enterTempStores('admin-metrics');

const NOW = new Date('2026-08-01T12:00:00.000Z');

test('admin metrics are scoped, windowed, and honest about estimates', async (t) => {
  try {
    const workspaceModule = await import('../src/platform/workspace');
    const store = await import('../src/platform/store');
    const dashboard = await import('../src/adminDashboard');
    const dataset = await import('../src/adminDataset');

    const DEFAULT_WORKSPACE_ID = workspaceModule.DEFAULT_WORKSPACE_ID;

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
    // Violema's own workspace, and a flagged demo one.
    workspaceModule.upsertWorkspaceProfile(DEFAULT_WORKSPACE_ID, {
      name: 'Violema',
      ownerEmail: 'max@example.com',
      slug: 'violema',
    });
    workspaceModule.upsertWorkspaceProfile('demo-tour', {
      name: 'Demo Tour',
      slug: 'demo-tour',
      metadata: { demo: true },
    });

    writeAutomations(stores.tempDir, [
      automationFixture({ id: 'auto_alpha_1', name: 'Alpha weekly', workspaceId: 'tenant-alpha' }),
      automationFixture({
        id: 'auto_alpha_2',
        name: 'Alpha revenue',
        workspaceId: 'tenant-alpha',
        status: 'paused',
      }),
      automationFixture({ id: 'auto_beta_1', name: 'Beta weekly', workspaceId: 'tenant-beta' }),
      // Legacy record: no workspaceId at all. It RUNS as the default workspace,
      // so it must be counted there and reported as unattributed.
      automationFixture({ id: 'auto_legacy', name: 'Seeded internal mission' }),
    ]);

    const readinessBlock = (blockedAt: string) => ({
      code: 'workflow_not_ready',
      blockers: [{ key: 'stripe', label: 'Connect Stripe', detail: 'Stripe is not connected.' }],
      blockedAt,
    });

    const seedRun = (input: {
      workspaceId: string;
      status: 'succeeded' | 'failed';
      finishedAt: string;
      actualCredits?: number;
      estimatedCredits?: number;
      blocked?: boolean;
    }) => {
      const metadata = input.blocked ? { readinessBlock: readinessBlock(input.finishedAt) } : {};
      const task = store.createTask({
        workspaceId: input.workspaceId,
        title: 'Fixture mission',
        kind: 'automation',
        metadata,
      });
      const run = store.createTaskRun({
        workspaceId: input.workspaceId,
        taskId: task.id,
        agentRole: 'analyst',
        modelTier: 'default',
        estimatedCredits: input.estimatedCredits ?? 10,
        metadata,
      });
      store.updateTaskRun(run.id, {
        status: input.status,
        finishedAt: input.finishedAt,
        ...(input.actualCredits === undefined ? {} : { actualCredits: input.actualCredits }),
      });
      if (input.blocked) store.updateTask(task.id, { status: 'blocked' });
      return { taskId: task.id, runId: run.id };
    };

    // Alpha: 3 succeeded (one estimate-only), 1 genuine failure, 1 readiness block.
    seedRun({ workspaceId: 'tenant-alpha', status: 'succeeded', finishedAt: '2026-08-01T09:00:00.000Z', actualCredits: 20 });
    seedRun({ workspaceId: 'tenant-alpha', status: 'succeeded', finishedAt: '2026-08-01T09:30:00.000Z', actualCredits: 30 });
    const alphaFailure = seedRun({ workspaceId: 'tenant-alpha', status: 'failed', finishedAt: '2026-08-01T10:00:00.000Z', actualCredits: 10 });
    const alphaBlocked = seedRun({ workspaceId: 'tenant-alpha', status: 'failed', finishedAt: '2026-08-01T10:30:00.000Z', actualCredits: 0, blocked: true });
    seedRun({ workspaceId: 'tenant-alpha', status: 'succeeded', finishedAt: '2026-08-01T11:00:00.000Z', estimatedCredits: 99 });

    // Beta: one failure, six weeks old.
    const staleFailure = seedRun({ workspaceId: 'tenant-beta', status: 'failed', finishedAt: '2026-06-20T10:00:00.000Z', actualCredits: 5 });

    // Internal noise that must not reach the headline numbers.
    seedRun({ workspaceId: DEFAULT_WORKSPACE_ID, status: 'failed', finishedAt: '2026-08-01T11:45:00.000Z', actualCredits: 3 });
    seedRun({ workspaceId: 'demo-tour', status: 'failed', finishedAt: '2026-08-01T11:50:00.000Z', actualCredits: 3 });

    // Alpha is funded, so its row state reports run health rather than billing —
    // the balance check takes precedence by design.
    store.addLedgerEntry({
      workspaceId: 'tenant-alpha',
      source: 'monthly_subscription',
      deltaCredits: 5000,
      referenceType: 'subscription',
      referenceId: 'alpha-plan',
    });

    await t.test('automation counts are per workspace, with legacy records named', () => {
      const rows = dashboard.buildAdminWorkspaces();
      const alpha = rows.find((row) => row.workspaceId === 'tenant-alpha');
      const beta = rows.find((row) => row.workspaceId === 'tenant-beta');

      assert.equal(alpha?.automationCount, 2, 'Alpha owns two automations, not the global four');
      assert.equal(beta?.automationCount, 1, 'Beta owns one');
      assert.notEqual(
        alpha?.automationCount,
        beta?.automationCount,
        'the bug was every row printing the same number',
      );
      assert.equal(alpha?.automationScope, 'workspace');
      assert.equal(alpha?.globalAutomationCount, 4);
      assert.equal(alpha?.unattributedAutomationCount, 1, 'the seeded legacy record is disclosed');

      // The unattributed record is attributed to the default workspace, which is
      // where it actually runs.
      const internal = dashboard.buildAdminWorkspaces({ includeInternal: true })
        .find((row) => row.workspaceId === DEFAULT_WORKSPACE_ID);
      assert.equal(internal?.automationCount, 1);
      assert.equal(
        dataset.resolveAutomationWorkspaceId({ workspaceId: undefined }),
        DEFAULT_WORKSPACE_ID,
      );
    });

    await t.test('internal and demo workspaces are excluded by default', () => {
      const scoped = dashboard.buildAdminWorkspaces();
      assert.deepEqual(
        scoped.map((row) => row.workspaceId).sort(),
        ['tenant-alpha', 'tenant-beta'],
      );

      const all = dashboard.buildAdminWorkspaces({ includeInternal: true });
      assert.equal(all.length, 4);
      assert.equal(all.find((row) => row.workspaceId === 'demo-tour')?.internal, true);
      assert.equal(all.find((row) => row.workspaceId === 'tenant-alpha')?.internal, false);

      const overview = dashboard.buildAdminOverview({ now: NOW });
      assert.equal(overview.metrics.workspaces, 2);
      assert.equal(overview.metrics.excludedInternalWorkspaces, 2);
      assert.equal(overview.scope.includeInternal, false);

      const withInternal = dashboard.buildAdminOverview({ now: NOW, includeInternal: true });
      assert.equal(withInternal.metrics.workspaces, 4);
      assert.equal(withInternal.scope.includeInternal, true);

      // Automations follow the same scope, so the headline cannot count our own
      // seeded missions while the table below excludes them.
      assert.equal(overview.metrics.activeAutomations, 2, 'Alpha weekly + Beta weekly');
      assert.equal(overview.metrics.totalAutomations, 4);
      assert.equal(overview.metrics.unattributedAutomationCount, 1);
    });

    await t.test('readiness blocks are not counted as product failures', () => {
      const alpha = dashboard.buildAdminWorkspaces()
        .find((row) => row.workspaceId === 'tenant-alpha');
      assert.equal(alpha?.succeededRuns, 3);
      assert.equal(alpha?.failedRuns, 1, 'the readiness block is not a genuine failure');
      assert.equal(alpha?.blockedRuns, 1);
      assert.equal(alpha?.totalRuns, 5);
      assert.equal(alpha?.runSuccessRate, 75, '3 succeeded / (3 succeeded + 1 failed)');
      assert.equal(alpha?.rowState, 'failed_runs');

      const overview = dashboard.buildAdminOverview({ now: NOW });
      assert.equal(overview.metrics.succeededRuns, 3);
      assert.equal(overview.metrics.failedRuns, 2, 'Alpha genuine + Beta stale');
      assert.equal(overview.metrics.blockedRuns, 1);
      assert.equal(overview.metrics.runSuccessRate, 60, '3 / (3 + 2)');
    });

    await t.test('estimated credits are reported separately from actuals', () => {
      const alpha = dashboard.buildAdminWorkspaces()
        .find((row) => row.workspaceId === 'tenant-alpha');
      // Actuals: 20, 30, 10, 0 → 60 over 4 runs = 15.
      assert.equal(alpha?.averageActualRunCredits, 15);
      assert.equal(alpha?.estimatedOnlyRuns, 1, 'one run never reported an actual');
      // The blended figure folds the 99-credit estimate in, which is why it is
      // no longer the number the UI should lead with.
      assert.equal(alpha?.averageRunCredits, 32);
      assert.notEqual(alpha?.averageRunCredits, alpha?.averageActualRunCredits);
    });

    await t.test('the failure feed is windowed and states its window', () => {
      const day = dashboard.buildAdminOverview({ now: NOW });
      assert.equal(day.windowHours, 24);
      assert.deepEqual(
        day.recentFailedRuns.map((row) => row.runId).sort(),
        [alphaFailure.runId, alphaBlocked.runId].sort(),
        'the six-week-old Beta failure is outside 24h; the internal ones are out of scope',
      );
      // Both are `status: failed` in the store; the feed still tells the
      // operator which one is a bug and which one is a missing connection.
      assert.equal(
        day.recentFailedRuns.find((row) => row.runId === alphaBlocked.runId)?.failureKind,
        'readiness_blocked',
      );
      assert.equal(
        day.recentFailedRuns.find((row) => row.runId === alphaFailure.runId)?.failureKind,
        'other',
      );

      const quarter = dashboard.buildAdminOverview({ now: NOW, windowHours: 24 * 60 });
      assert.equal(quarter.windowHours, 1440);
      assert.deepEqual(
        quarter.recentFailedRuns.map((row) => row.runId).sort(),
        [alphaFailure.runId, alphaBlocked.runId, staleFailure.runId].sort(),
      );

      // A widened window still respects the workspace scope.
      const internalToo = dashboard.buildAdminOverview({
        now: NOW,
        windowHours: 24 * 60,
        includeInternal: true,
      });
      assert.equal(internalToo.recentFailedRuns.length, 5);
    });

    await t.test('recent users are ordered by recency, not by alphabet', async () => {
      const auth = await import('../src/auth');
      // Deliberately alphabetical in creation order, so an alphabetical "recent"
      // list and a real one cannot agree.
      for (const email of ['aaa@example.com', 'mmm@example.com', 'zzz@example.com']) {
        auth.upsertAuthUser({
          email,
          name: email,
          role: 'user',
          method: 'email',
          acceptedTerms: true,
          acceptedEducation: true,
        });
      }
      // Touch the middle one last: it is now the most recently updated.
      auth.upsertAuthUser({
        email: 'mmm@example.com',
        name: 'Middle, touched last',
        role: 'user',
        method: 'email',
        acceptedTerms: true,
        acceptedEducation: true,
      });

      const overview = dashboard.buildAdminOverview({ now: NOW });
      assert.ok(
        Object.prototype.hasOwnProperty.call(overview, 'recentlyUpdatedUsers'),
        'the field is named for what it measures',
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(overview, 'recentUsers'),
        false,
        'the mislabeled field is gone, so the UI cannot keep calling it latest activity',
      );
      assert.equal(overview.recentlyUpdatedUsers[0].email, 'mmm@example.com');
      assert.notEqual(
        overview.recentlyUpdatedUsers[0].email,
        'aaa@example.com',
        'alphabetical order must not masquerade as recency',
      );
    });

    await t.test('window and scope parsing rejects nonsense instead of ignoring it', async () => {
      const routes = await import('../src/adminRoutes');
      assert.equal(routes.parseWindowHours(undefined), undefined);
      assert.equal(routes.parseWindowHours('48'), 48);
      assert.throws(() => routes.parseWindowHours('soon'), /windowHours must be a positive number/);
      assert.throws(() => routes.parseWindowHours('-3'), /windowHours must be a positive number/);

      assert.equal(routes.parseIncludeInternal(undefined), false);
      assert.equal(routes.parseIncludeInternal('true'), true);
      assert.throws(() => routes.parseIncludeInternal('yes'), /includeInternal must be true or false/);

      // An absent or absurd window normalizes rather than throwing in the builder.
      assert.equal(dashboard.normalizeWindowHours(undefined), 24);
      assert.equal(dashboard.normalizeWindowHours(0), 24);
      assert.equal(dashboard.normalizeWindowHours(1_000_000), 24 * 365);
    });
  } finally {
    stores.cleanup();
  }
});
