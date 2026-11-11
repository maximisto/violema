import type { CreditLedgerEntry, CreditLedgerSummary, CreditReserve } from './types';

export interface CreditLedgerInput {
  workspaceId: string;
  direction: CreditLedgerEntry['direction'];
  source: CreditLedgerEntry['source'];
  deltaCredits: number;
  balanceAfterCredits: number;
  referenceType?: CreditLedgerEntry['referenceType'];
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  sequence: number;
  createdAt?: string;
}

export function normalizeCreditDelta(deltaCredits: number): number {
  if (!Number.isFinite(deltaCredits)) {
    throw new Error('Credit delta must be a finite number.');
  }

  return Math.trunc(deltaCredits);
}

export function createCreditLedgerEntry(input: CreditLedgerInput): CreditLedgerEntry {
  const deltaCredits = normalizeCreditDelta(input.deltaCredits);

  return {
    id: `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    workspaceId: input.workspaceId,
    direction: input.direction,
    source: input.source,
    deltaCredits,
    balanceAfterCredits: Math.trunc(input.balanceAfterCredits),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note,
    metadata: input.metadata,
    sequence: input.sequence,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

/** Entries written before sequences existed read as 0, ahead of every sequenced entry. */
function readCreditLedgerSequence(entry: CreditLedgerEntry): number {
  return typeof entry.sequence === 'number' && Number.isFinite(entry.sequence) ? entry.sequence : 0;
}

/** The `sequence` for the next entry appended to a workspace's ledger. */
export function nextCreditLedgerSequence(workspaceEntries: CreditLedgerEntry[]): number {
  return workspaceEntries.reduce((highest, entry) => Math.max(highest, readCreditLedgerSequence(entry)), 0) + 1;
}

/**
 * Oldest first by `createdAt`. Writes in the same millisecond share it, so ties
 * follow `sequence`. Two unsequenced entries compare equal and keep the order
 * they were passed in, which for the store is file order, the order they were
 * written. The id is never a tie-break: its suffix is random.
 */
export function compareCreditLedgerEntries(left: CreditLedgerEntry, right: CreditLedgerEntry): number {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return readCreditLedgerSequence(left) - readCreditLedgerSequence(right);
}

export function sortCreditLedgerEntries(entries: CreditLedgerEntry[]): CreditLedgerEntry[] {
  return [...entries].sort(compareCreditLedgerEntries);
}

export function summarizeCreditLedger(entries: CreditLedgerEntry[]): CreditLedgerSummary {
  const ordered = sortCreditLedgerEntries(entries);
  const last = ordered[ordered.length - 1];

  let grantedCredits = 0;
  let spentCredits = 0;

  for (const entry of ordered) {
    if (entry.deltaCredits >= 0) {
      grantedCredits += entry.deltaCredits;
    } else {
      spentCredits += Math.abs(entry.deltaCredits);
    }
  }

  return {
    workspaceId: last?.workspaceId || 'unknown',
    balanceCredits: last?.balanceAfterCredits || 0,
    grantedCredits,
    spentCredits,
    netCredits: grantedCredits - spentCredits,
    updatedAt: last?.createdAt || new Date().toISOString(),
  };
}

export function calculateAvailableCredits(workspaceId: string, balanceCredits: number, reservedCredits = 0): CreditReserve {
  const safeBalance = Math.trunc(balanceCredits);
  const safeReserved = Math.max(0, Math.trunc(reservedCredits));

  return {
    workspaceId,
    reservedCredits: safeReserved,
    availableCredits: Math.max(0, safeBalance - safeReserved),
    updatedAt: new Date().toISOString(),
  };
}

export function canSpendCredits(balanceCredits: number, amountCredits: number): boolean {
  return Math.trunc(balanceCredits) >= Math.max(0, Math.trunc(amountCredits));
}

export function applyCreditDelta(balanceCredits: number, deltaCredits: number): number {
  return Math.trunc(balanceCredits) + normalizeCreditDelta(deltaCredits);
}
