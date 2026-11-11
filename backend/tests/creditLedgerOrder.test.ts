import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sortCreditLedgerEntries, summarizeCreditLedger } from '../src/platform/ledger';
import type { CreditLedgerEntry } from '../src/platform/types';

const TIED_AT = '2026-11-11T12:00:00.000Z';
const TIED_MS = Date.parse(TIED_AT);

function ledgerEntry(
  fields: Partial<CreditLedgerEntry> & Pick<CreditLedgerEntry, 'id' | 'deltaCredits' | 'balanceAfterCredits'>,
): CreditLedgerEntry {
  return {
    workspaceId: 'workspace_ledger_order',
    direction: fields.deltaCredits >= 0 ? 'grant' : 'debit',
    source: 'manual_adjustment',
    createdAt: TIED_AT,
    ...fields,
  };
}

// Two writes in the same millisecond share `createdAt` and the `ledger_<ms>_`
// id prefix, so only the random suffix differs. These suffixes put the earlier
// write last by id, which is how CI once reported 7 instead of 507.
const earlierWrite = ledgerEntry({ id: `ledger_${TIED_MS}_zzzzzzzz`, deltaCredits: 7, balanceAfterCredits: 7 });
const laterWrite = ledgerEntry({ id: `ledger_${TIED_MS}_00000000`, deltaCredits: 500, balanceAfterCredits: 507 });

async function withTempPlatformStore(run: (store: typeof import('../src/platform/store')) => Promise<void> | void) {
  const originalCwd = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-ledger-order-'));

  try {
    process.chdir(directory);
    delete require.cache[require.resolve('../src/platform/store')];
    const store = await import('../src/platform/store');
    await run(store);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('same-millisecond entries without a sequence keep the order they were written in', () => {
  assert.ok(earlierWrite.id.localeCompare(laterWrite.id) > 0, 'precondition: the earlier write sorts last by id');

  assert.deepEqual(sortCreditLedgerEntries([earlierWrite, laterWrite]).map((entry) => entry.id), [earlierWrite.id, laterWrite.id]);
  assert.equal(summarizeCreditLedger([earlierWrite, laterWrite]).balanceCredits, 507);
});

test('a sequence orders same-millisecond entries whatever order they arrive in', () => {
  const earlier = { ...earlierWrite, sequence: 1 };
  const later = { ...laterWrite, sequence: 2 };

  for (const entries of [[earlier, later], [later, earlier]]) {
    assert.deepEqual(sortCreditLedgerEntries(entries).map((entry) => entry.id), [earlier.id, later.id]);
    assert.equal(summarizeCreditLedger(entries).balanceCredits, 507);
  }
});

test('entries written before sequences existed come before sequenced entries at the same time', () => {
  const later = { ...laterWrite, sequence: 1 };

  assert.equal(summarizeCreditLedger([later, earlierWrite]).balanceCredits, 507);
});

test('createdAt still decides between entries at different times', () => {
  const earlier = { ...earlierWrite, sequence: 1 };
  const backdated = { ...laterWrite, sequence: 2, createdAt: '2026-11-11T11:59:59.000Z' };

  assert.deepEqual(sortCreditLedgerEntries([earlier, backdated]).map((entry) => entry.id), [backdated.id, earlier.id]);
  assert.equal(summarizeCreditLedger([earlier, backdated]).balanceCredits, 7);
});

test('two store writes in the same millisecond report the later balance', (t) => withTempPlatformStore((store) => {
  const workspaceId = 'workspace_same_millisecond';
  t.mock.timers.enable({ apis: ['Date'], now: TIED_MS });
  // Each id suffix sorts below the one before it, so an id tie-break would
  // always put the earliest write last.
  let nextRandom = 0.99;
  t.mock.method(Math, 'random', () => {
    nextRandom -= 0.01;
    return nextRandom;
  });

  const first = store.addLedgerEntry({ workspaceId, source: 'manual_adjustment', deltaCredits: 7 });
  const second = store.addLedgerEntry({ workspaceId, source: 'trial_grant', deltaCredits: 500 });

  assert.equal(first.createdAt, second.createdAt);
  assert.ok(first.id.localeCompare(second.id) > 0, 'precondition: the earlier write sorts last by id');
  assert.equal(second.balanceAfterCredits, 507);
  assert.equal(store.getWorkspaceLedgerSummary(workspaceId).balanceCredits, 507);
  assert.deepEqual(store.listLedgerEntries(workspaceId).map((entry) => entry.id), [second.id, first.id]);

  const third = store.addLedgerEntry({ workspaceId, source: 'manual_adjustment', deltaCredits: -5 });
  assert.equal(third.balanceAfterCredits, 502);
  assert.equal(store.getWorkspaceLedgerSummary(workspaceId).balanceCredits, 502);
}));

test('each workspace numbers its own ledger writes', () => withTempPlatformStore((store) => {
  const first = store.addLedgerEntry({ workspaceId: 'workspace_a', source: 'manual_adjustment', deltaCredits: 1 });
  const other = store.addLedgerEntry({ workspaceId: 'workspace_b', source: 'manual_adjustment', deltaCredits: 1 });
  const second = store.addLedgerEntry({ workspaceId: 'workspace_a', source: 'manual_adjustment', deltaCredits: 1 });

  assert.deepEqual([first.sequence, second.sequence], [1, 2]);
  assert.equal(other.sequence, 1);
}));
