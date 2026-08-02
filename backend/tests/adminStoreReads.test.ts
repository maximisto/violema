/**
 * Store-read regression for the admin builders.
 *
 * The shape the audit found was quadratic, not slow-in-general:
 *
 *   - `buildAdminUsers` read the WHOLE credit ledger once per account, and the
 *     whole consent receipt file once per account on top of that
 *   - `buildAdminWorkspaces` read the whole automations file once per workspace
 *   - `buildAdminOverview` ran both, then read every run again
 *
 * At four internal workspaces that is invisible. At forty testers it is the
 * first thing that falls over, and adding testers makes it worse faster than
 * linearly. This suite counts actual `fs.readFileSync` calls per store file, so
 * a reintroduced per-row read fails here rather than on Monday morning.
 *
 * Counts are asserted as "does not grow with the fixture" rather than as exact
 * numbers: pinning an exact count would break on any unrelated refactor and
 * teach the next person to bump the number instead of reading the test.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { automationFixture, enterTempStores, writeAutomations } from './support/adminFixtures';

const stores = enterTempStores('admin-store-reads');

/** Store files whose read count must not scale with rows. */
const COUNTED_STORES = [
  'platform-credit-ledger.json',
  'platform-task-runs.json',
  'platform-tasks.json',
  'platform-workspaces.json',
  'automations.json',
  'auth-users.json',
  'admin-access.json',
  'beta-consent-receipts.json',
  'platform-billing-config.json',
];

type ReadCounts = Record<string, number>;

/** Count reads per store basename while `run` executes. */
function countStoreReads<T>(run: () => T): { result: T; counts: ReadCounts } {
  const counts: ReadCounts = Object.fromEntries(COUNTED_STORES.map((file) => [file, 0]));
  const originalReadFileSync = fs.readFileSync;

  (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = ((
    file: Parameters<typeof fs.readFileSync>[0],
    options?: Parameters<typeof fs.readFileSync>[1],
  ) => {
    if (typeof file === 'string') {
      const name = path.basename(file);
      if (name in counts) counts[name] += 1;
    }
    return (originalReadFileSync as (...args: unknown[]) => unknown)(file, options);
  }) as typeof fs.readFileSync;

  try {
    return { result: run(), counts };
  } finally {
    (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = originalReadFileSync;
  }
}

test('admin builders read each store a bounded number of times', async (t) => {
  try {
    const workspaceModule = await import('../src/platform/workspace');
    const store = await import('../src/platform/store');
    const auth = await import('../src/auth');
    const access = await import('../src/adminAccessStore');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const dashboard = await import('../src/adminDashboard');

    const SMALL = 3;
    const LARGE = 18;

    const emailFor = (index: number) => `user-${String(index).padStart(2, '0')}@example.com`;
    const workspaceIdFor = (index: number) => `tenant-${String(index).padStart(2, '0')}`;

    const seedAccounts = (from: number, to: number) => {
      for (let index = from; index < to; index += 1) {
        const email = emailFor(index);
        const acceptedAt = '2026-07-20T09:00:00.000Z';
        consent.recordBetaConsent({
          email,
          participantType: 'founder_operator',
          authMethod: 'email',
          acceptanceSource: 'signup',
          termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
          termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
          acceptedAt,
        });
        access.recordAccessRequest({
          email,
          method: 'email',
          identityVerifiedAt: '2026-07-20T08:00:00.000Z',
          acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
          acceptedTermsAt: acceptedAt,
        });
        auth.upsertAuthUser({
          email,
          name: `User ${index}`,
          role: 'user',
          method: 'email',
          acceptedTerms: true,
          acceptedEducation: true,
        });
      }
    };

    const seedWorkspaces = (from: number, to: number) => {
      for (let index = from; index < to; index += 1) {
        const workspaceId = workspaceIdFor(index);
        workspaceModule.upsertWorkspaceProfile(workspaceId, {
          name: `Tenant ${index}`,
          ownerEmail: emailFor(index),
          slug: `tenant-${index}`,
        });
        const task = store.createTask({
          workspaceId,
          title: 'Fixture mission',
          kind: 'automation',
        });
        const run = store.createTaskRun({
          workspaceId,
          taskId: task.id,
          agentRole: 'analyst',
          modelTier: 'default',
          estimatedCredits: 5,
        });
        store.updateTaskRun(run.id, {
          status: 'succeeded',
          actualCredits: 5,
          finishedAt: '2026-08-01T09:00:00.000Z',
        });
        store.addLedgerEntry({
          workspaceId,
          source: 'trial_grant',
          deltaCredits: 500,
          referenceType: 'beta_trial',
          referenceId: `trial:${workspaceId}`,
        });
      }
    };

    const seedAutomations = (count: number) => {
      writeAutomations(
        stores.tempDir,
        Array.from({ length: count }, (_, index) => automationFixture({
          id: `auto_${index}`,
          name: `Automation ${index}`,
          workspaceId: workspaceIdFor(index),
        })),
      );
    };

    seedAccounts(0, SMALL);
    seedWorkspaces(0, SMALL);
    seedAutomations(SMALL);

    const small = {
      users: countStoreReads(() => dashboard.buildAdminUsers()).counts,
      workspaces: countStoreReads(() => dashboard.buildAdminWorkspaces()).counts,
      overview: countStoreReads(() => dashboard.buildAdminOverview()).counts,
    };

    seedAccounts(SMALL, LARGE);
    seedWorkspaces(SMALL, LARGE);
    seedAutomations(LARGE);

    const large = {
      users: countStoreReads(() => dashboard.buildAdminUsers()).counts,
      workspaces: countStoreReads(() => dashboard.buildAdminWorkspaces()).counts,
      overview: countStoreReads(() => dashboard.buildAdminOverview()).counts,
    };

    // The fixture really did grow six-fold, so a flat read count means bounded
    // reads rather than an empty store. Workspaces exceed LARGE because signing
    // a user up materializes their own workspace alongside the seeded tenant.
    assert.equal(dashboard.buildAdminUsers().length, LARGE);
    assert.ok(
      dashboard.buildAdminWorkspaces().length >= LARGE,
      'the workspace fixture must actually be large for the bound to mean anything',
    );

    const assertBounded = (builder: keyof typeof small) => {
      for (const file of COUNTED_STORES) {
        assert.equal(
          large[builder][file],
          small[builder][file],
          `${builder} read ${file} ${large[builder][file]} times at ${LARGE} rows vs `
          + `${small[builder][file]} at ${SMALL} — reads must not scale with the fixture`,
        );
        assert.ok(
          large[builder][file] <= 2,
          `${builder} read ${file} ${large[builder][file]} times; one read per store is the target`,
        );
      }
    };

    await t.test('buildAdminUsers does not re-read per account', () => {
      assertBounded('users');
      assert.ok(
        small.users['platform-credit-ledger.json'] > 0,
        'the ledger IS read — a zero here would make the bound meaningless',
      );
      assert.ok(small.users['beta-consent-receipts.json'] > 0, 'consent receipts ARE read');
    });

    await t.test('buildAdminWorkspaces does not re-read per workspace', () => {
      assertBounded('workspaces');
      assert.ok(small.workspaces['automations.json'] > 0, 'automations ARE read');
    });

    await t.test('buildAdminOverview shares one load across both builders', () => {
      assertBounded('overview');
      // The overview runs users AND workspaces AND the failure feed. Loading
      // independently would push its counts past either builder's.
      for (const file of COUNTED_STORES) {
        assert.ok(
          large.overview[file] <= Math.max(large.users[file], large.workspaces[file]) + 1,
          `overview read ${file} ${large.overview[file]} times — it must share one dataset`,
        );
      }
    });

    await t.test('a preloaded dataset is reused rather than re-read', async () => {
      const dataset = await import('../src/adminDataset');
      const loaded = dataset.loadAdminDataset();
      const { counts } = countStoreReads(() => {
        dashboard.buildAdminUsers(loaded);
        dashboard.buildAdminWorkspaces({ dataset: loaded });
        dashboard.buildAdminOverview({ dataset: loaded });
        dashboard.buildWorkspaceAdminDetail(workspaceIdFor(0), { dataset: loaded });
      });

      for (const file of COUNTED_STORES) {
        assert.equal(
          counts[file],
          0,
          `${file} was re-read despite a preloaded dataset (${counts[file]} reads)`,
        );
      }
    });
  } finally {
    stores.cleanup();
  }
});
