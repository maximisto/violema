import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function withTempPlatformStore(run: (directory: string) => Promise<void> | void) {
  const originalCwd = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-credit-holds-'));

  try {
    process.chdir(directory);
    await run(directory);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('active credit holds reduce available balance until released or expired', async () => withTempPlatformStore(async () => {
  const store = await import('../src/platform/store');
  const workspaceId = 'workspace_holds';
  const now = new Date('2099-07-04T18:00:00.000Z');

  store.ensureWorkspaceCredits(workspaceId, 'Starter', 20);

  const firstHold = store.acquireCreditHold({
    workspaceId,
    amountCredits: 10,
    referenceType: 'task',
    referenceId: 'run_first',
    now,
    ttlMs: 60_000,
  });

  assert.equal(store.getWorkspaceCreditReserve(workspaceId, now).availableCredits, 10);
  assert.throws(
    () => store.acquireCreditHold({
      workspaceId,
      amountCredits: 11,
      referenceType: 'task',
      referenceId: 'run_too_large',
      now,
      ttlMs: 60_000,
    }),
    /Insufficient credits/,
  );

  store.releaseCreditHold(firstHold.holdId, {
    workspaceId,
    referenceType: 'task',
    referenceId: 'run_first',
    now: new Date('2099-07-04T18:00:10.000Z'),
  });
  assert.equal(store.getWorkspaceCreditReserve(workspaceId, new Date('2099-07-04T18:00:10.000Z')).availableCredits, 20);

  store.acquireCreditHold({
    workspaceId,
    amountCredits: 18,
    referenceType: 'task',
    referenceId: 'run_expiring',
    now,
    ttlMs: 60_000,
  });
  assert.equal(store.getWorkspaceCreditReserve(workspaceId, now).availableCredits, 2);
  assert.equal(store.getWorkspaceCreditReserve(workspaceId, new Date('2099-07-04T18:02:00.000Z')).availableCredits, 20);
}));

test('settling a credit hold debits once and releases the held balance', async () => withTempPlatformStore(async () => {
  const store = await import('../src/platform/store');
  const workspaceId = 'workspace_settle_hold';
  const now = new Date('2099-07-04T19:00:00.000Z');

  store.ensureWorkspaceCredits(workspaceId, 'Starter', 20);
  const hold = store.acquireCreditHold({
    workspaceId,
    amountCredits: 12,
    referenceType: 'task',
    referenceId: 'task_one',
    now,
    ttlMs: 60_000,
  });

  const debit = store.settleCreditHold(hold.holdId, {
    workspaceId,
    actualCredits: 7,
    source: 'task_run',
    referenceType: 'task',
    referenceId: 'task_one',
    note: 'Task completed',
    now: new Date('2099-07-04T19:00:15.000Z'),
  });

  assert.equal(debit.deltaCredits, -7);
  assert.equal(store.getWorkspaceLedgerSummary(workspaceId).balanceCredits, 13);
  assert.equal(store.getWorkspaceCreditReserve(workspaceId, new Date('2099-07-04T19:00:15.000Z')).availableCredits, 13);
  assert.throws(
    () => store.settleCreditHold(hold.holdId, {
      workspaceId,
      actualCredits: 1,
      source: 'task_run',
      referenceType: 'task',
      referenceId: 'task_one',
      now: new Date('2099-07-04T19:00:20.000Z'),
    }),
    /already settled/,
  );
}));

test('billing spend checks fail against active held credits', async () => withTempPlatformStore(async () => {
  const store = await import('../src/platform/store');
  const billing = await import('../src/platform/billing');
  const workspaceId = 'workspace_billing_holds';
  const now = new Date('2099-07-04T20:00:00.000Z');

  store.ensureWorkspaceCredits(workspaceId, 'Starter', 20);
  store.acquireCreditHold({
    workspaceId,
    amountCredits: 18,
    referenceType: 'task',
    referenceId: 'task_active',
    now,
    ttlMs: 60_000,
  });

  assert.throws(
    () => billing.assertCanSpendCredits(workspaceId, 3, now),
    /2 available/,
  );
  assert.doesNotThrow(() => billing.assertCanSpendCredits(workspaceId, 2, now));
}));
