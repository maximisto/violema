import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CURRENT_BETA_TERMS_VERSION } from '../src/betaProgram';

async function withTempPlatformStore(run: (modules: {
  trialCredits: typeof import('../src/betaTrialCredits');
  store: typeof import('../src/platform/store');
}) => Promise<void> | void) {
  const originalCwd = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-beta-trial-'));

  try {
    process.chdir(directory);
    const trialCreditsPath = require.resolve('../src/betaTrialCredits');
    const storePath = require.resolve('../src/platform/store');
    delete require.cache[trialCreditsPath];
    delete require.cache[storePath];
    const trialCredits = await import('../src/betaTrialCredits');
    const store = await import('../src/platform/store');
    await run({ trialCredits, store });
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const participantType of ['founder_operator', 'investor', 'partner'] as const) {
  test(`${participantType} receives one 500-credit beta grant`, () => withTempPlatformStore(({ trialCredits, store }) => {
    const workspaceId = `workspace_${participantType}`;
    const first = trialCredits.ensureBetaTrialCredits({
      workspaceId,
      participantType,
      termsVersion: CURRENT_BETA_TERMS_VERSION,
    });
    const second = trialCredits.ensureBetaTrialCredits({
      workspaceId,
      participantType,
      termsVersion: CURRENT_BETA_TERMS_VERSION,
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.entry.id, first.entry.id);
    assert.equal(first.entry.deltaCredits, 500);
    assert.equal(first.entry.source, 'trial_grant');
    assert.equal(first.entry.referenceType, 'beta_trial');
    assert.deepEqual(first.entry.metadata, {
      participantType,
      termsVersion: CURRENT_BETA_TERMS_VERSION,
      oneTime: true,
    });
    assert.equal(store.listLedgerEntries(workspaceId).length, 1);
    assert.equal(store.getWorkspaceLedgerSummary(workspaceId).balanceCredits, 500);
  }));
}

test('empty workspaces receive only explicitly requested ledger entries', () => withTempPlatformStore(({ store }) => {
  const workspaceId = 'workspace_explicit_entry';
  const entry = store.addLedgerEntry({
    workspaceId,
    source: 'manual_adjustment',
    deltaCredits: 25,
    referenceType: 'manual',
    referenceId: 'manual_initial_grant',
  });

  assert.equal(entry.balanceAfterCredits, 25);
  assert.deepEqual(store.listLedgerEntries(workspaceId).map((item) => item.id), [entry.id]);
  assert.equal(store.getWorkspaceLedgerSummary(workspaceId).balanceCredits, 25);
}));

test('ensureWorkspaceCredits is a zero-balance compatibility read for empty workspaces', () => withTempPlatformStore(({ store }) => {
  const workspaceId = 'workspace_empty_compatibility';

  const summary = store.ensureWorkspaceCredits(workspaceId);

  assert.equal(summary.workspaceId, workspaceId);
  assert.equal(summary.balanceCredits, 0);
  assert.deepEqual(store.listLedgerEntries(workspaceId), []);
}));

test('a beta grant preserves existing ledger entries and adds to their balance', () => withTempPlatformStore(({ trialCredits, store }) => {
  const workspaceId = 'workspace_existing_ledger';
  const existing = store.addLedgerEntry({
    workspaceId,
    source: 'manual_adjustment',
    deltaCredits: 7,
    referenceType: 'manual',
    referenceId: 'existing_adjustment',
  });

  const result = trialCredits.ensureBetaTrialCredits({
    workspaceId,
    participantType: 'founder_operator',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
  });
  const entries = store.listLedgerEntries(workspaceId);

  assert.equal(result.created, true);
  assert.equal(entries.length, 2);
  assert.ok(entries.some((entry) => entry.id === existing.id));
  assert.equal(store.getWorkspaceLedgerSummary(workspaceId).balanceCredits, 507);
}));

test('beta grant metadata includes an available approval actor', () => withTempPlatformStore(({ trialCredits }) => {
  const ensureWithActor = trialCredits.ensureBetaTrialCredits as (
    input: Parameters<typeof trialCredits.ensureBetaTrialCredits>[0] & { approvalActor?: string },
  ) => ReturnType<typeof trialCredits.ensureBetaTrialCredits>;
  const result = ensureWithActor({
    workspaceId: 'workspace_with_approval_actor',
    participantType: 'partner',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    approvalActor: 'max@violema.com',
  });

  assert.deepEqual(result.entry.metadata, {
    participantType: 'partner',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    approvalActor: 'max@violema.com',
    oneTime: true,
  });
}));

test('an existing beta grant is unchanged when a later call supplies an approval actor', () => withTempPlatformStore(({ trialCredits }) => {
  const ensureWithActor = trialCredits.ensureBetaTrialCredits as (
    input: Parameters<typeof trialCredits.ensureBetaTrialCredits>[0] & { approvalActor?: string },
  ) => ReturnType<typeof trialCredits.ensureBetaTrialCredits>;
  const first = trialCredits.ensureBetaTrialCredits({
    workspaceId: 'workspace_actor_idempotency',
    participantType: 'founder_operator',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
  });
  const second = ensureWithActor({
    workspaceId: 'workspace_actor_idempotency',
    participantType: 'founder_operator',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    approvalActor: 'max@violema.com',
  });

  assert.equal(second.created, false);
  assert.deepEqual(second.entry, first.entry);
  assert.equal(second.entry.metadata?.approvalActor, undefined);
}));
