import path from 'path';
import { calculateAvailableCredits, createCreditLedgerEntry, normalizeCreditDelta, summarizeCreditLedger } from './ledger';
import { readJsonFile, updateJsonFile, writeJsonFile } from './jsonStore';
import type {
  AgentRole,
  CreditLedgerEntry,
  CreditSource,
  DelegationPlan,
  ModelTier,
  TaskKind,
  TaskRecord,
  TaskRunRecord,
  TaskRunStatus,
  TaskStatus,
} from './types';

const TASKS_FILE = path.join(process.cwd(), 'platform-tasks.json');
const TASK_RUNS_FILE = path.join(process.cwd(), 'platform-task-runs.json');
const LEDGER_FILE = path.join(process.cwd(), 'platform-credit-ledger.json');
const DEFAULT_CREDIT_HOLD_TTL_MS = 15 * 60 * 1000;
const TERMINAL_CREDIT_HOLD_STATUSES = new Set(['released', 'settled', 'expired']);

interface JsonStoreShape {
  tasks: TaskRecord[];
  taskRuns: TaskRunRecord[];
  ledger: CreditLedgerEntry[];
}

export function getPlatformState(): JsonStoreShape {
  return {
    tasks: readJsonFile<TaskRecord[]>(TASKS_FILE, []),
    taskRuns: readJsonFile<TaskRunRecord[]>(TASK_RUNS_FILE, []),
    ledger: readJsonFile<CreditLedgerEntry[]>(LEDGER_FILE, []),
  };
}

function savePlatformState(state: Partial<JsonStoreShape>) {
  if (state.tasks) writeJsonFile(TASKS_FILE, state.tasks);
  if (state.taskRuns) writeJsonFile(TASK_RUNS_FILE, state.taskRuns);
  if (state.ledger) writeJsonFile(LEDGER_FILE, state.ledger);
}

function createStoreId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readCreditHoldId(entry: CreditLedgerEntry) {
  const value = entry.metadata?.holdId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readCreditHoldStatus(entry: CreditLedgerEntry) {
  const value = entry.metadata?.holdStatus;
  return typeof value === 'string' ? value : undefined;
}

function readCreditHoldCredits(entry: CreditLedgerEntry) {
  const value = entry.metadata?.heldCredits;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function readCreditHoldExpiresAt(entry: CreditLedgerEntry) {
  const value = entry.metadata?.expiresAt;
  if (typeof value !== 'string') return Number.NaN;
  return Date.parse(value);
}

function listActiveHoldEntries(entries: CreditLedgerEntry[], now = new Date()) {
  const nowMs = now.getTime();
  const terminalHoldIds = new Set<string>();

  for (const entry of entries) {
    const holdId = readCreditHoldId(entry);
    if (!holdId) continue;
    if (TERMINAL_CREDIT_HOLD_STATUSES.has(readCreditHoldStatus(entry) || '')) {
      terminalHoldIds.add(holdId);
    }
  }

  return entries.filter((entry) => {
    if (entry.source !== 'credit_hold') return false;
    const holdId = readCreditHoldId(entry);
    if (!holdId || terminalHoldIds.has(holdId)) return false;
    if (readCreditHoldStatus(entry) !== 'active') return false;
    if (readCreditHoldCredits(entry) <= 0) return false;
    const expiresAt = readCreditHoldExpiresAt(entry);
    return Number.isFinite(expiresAt) && expiresAt > nowMs;
  });
}

function findCreditHold(entries: CreditLedgerEntry[], holdId: string) {
  const hold = entries.find((entry) => readCreditHoldId(entry) === holdId && entry.source === 'credit_hold');
  if (!hold) throw new Error(`Unknown credit hold: ${holdId}`);
  return hold;
}

function assertCreditHoldOpen(entries: CreditLedgerEntry[], holdId: string) {
  const terminal = entries.find((entry) =>
    readCreditHoldId(entry) === holdId &&
    TERMINAL_CREDIT_HOLD_STATUSES.has(readCreditHoldStatus(entry) || '')
  );
  if (terminal) {
    throw new Error(`Credit hold ${holdId} is already settled or released.`);
  }
}

export function ensureWorkspaceCredits(workspaceId: string) {
  const entries = getPlatformState().ledger.filter((entry) => entry.workspaceId === workspaceId);
  const summary = summarizeCreditLedger(entries);
  return { ...summary, workspaceId };
}

export function createTask(input: {
  workspaceId: string;
  title: string;
  description?: string;
  kind: TaskKind;
  priority?: TaskRecord['priority'];
  autonomyMode?: TaskRecord['autonomyMode'];
  assigneeRole?: AgentRole;
  ownerRole?: AgentRole;
  executorRole?: AgentRole;
  reviewerRole?: AgentRole;
  supportingRoles?: AgentRole[];
  delegationState?: TaskRecord['delegationState'];
  delegationPlanId?: string;
  delegationPlan?: DelegationPlan;
  budgetCredits?: number;
  metadata?: Record<string, unknown>;
}): TaskRecord {
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: input.workspaceId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    status: 'queued',
    priority: input.priority || 'medium',
    autonomyMode: input.autonomyMode,
    assigneeRole: input.assigneeRole,
    ownerRole: input.ownerRole,
    executorRole: input.executorRole,
    reviewerRole: input.reviewerRole,
    supportingRoles: input.supportingRoles,
    delegationState: input.delegationState || (input.delegationPlan ? 'planned' : undefined),
    delegationPlanId: input.delegationPlanId || input.delegationPlan?.id,
    budgetCredits: input.budgetCredits,
    createdAt: now,
    updatedAt: now,
    metadata: {
      ...input.metadata,
      delegationPlan: input.delegationPlan || undefined,
    },
  };

  updateJsonFile<TaskRecord[]>(TASKS_FILE, [], (tasks) => [task, ...tasks]);
  return task;
}

export function updateTask(taskId: string, patch: Partial<TaskRecord>) {
  let updatedTask: TaskRecord | null = null;

  updateJsonFile<TaskRecord[]>(TASKS_FILE, [], (tasks) => tasks.map((task) => {
    if (task.id !== taskId) return task;
    updatedTask = { ...task, ...patch, updatedAt: new Date().toISOString() };
    return updatedTask;
  }));

  return updatedTask;
}

export function createTaskRun(input: {
  workspaceId: string;
  taskId: string;
  agentRole: AgentRole;
  ownerRole?: AgentRole;
  executorRole?: AgentRole;
  reviewerRole?: AgentRole;
  supportingRoles?: AgentRole[];
  modelTier: ModelTier;
  estimatedCredits: number;
  delegationPlan?: DelegationPlan;
  metadata?: Record<string, unknown>;
}): TaskRunRecord {
  const taskRun: TaskRunRecord = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    agentRole: input.agentRole,
    ownerRole: input.ownerRole,
    executorRole: input.executorRole,
    reviewerRole: input.reviewerRole,
    supportingRoles: input.supportingRoles,
    modelTier: input.modelTier,
    status: 'running',
    estimatedCredits: input.estimatedCredits,
    startedAt: new Date().toISOString(),
    metadata: {
      ...input.metadata,
      delegationPlan: input.delegationPlan || undefined,
    },
  };

  updateJsonFile<TaskRunRecord[]>(TASK_RUNS_FILE, [], (taskRuns) => [taskRun, ...taskRuns]);
  return taskRun;
}

export function finalizeTaskRun(taskRunId: string, patch: {
  status: TaskRunStatus;
  actualCredits?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  let updatedRun: TaskRunRecord | null = null;

  updateJsonFile<TaskRunRecord[]>(TASK_RUNS_FILE, [], (taskRuns) => taskRuns.map((run) => {
    if (run.id !== taskRunId) return run;
    updatedRun = {
      ...run,
      ...patch,
      finishedAt: new Date().toISOString(),
      metadata: { ...run.metadata, ...patch.metadata },
    };
    return updatedRun;
  }));

  return updatedRun;
}

export function updateTaskRun(taskRunId: string, patch: Partial<Omit<TaskRunRecord, 'id' | 'workspaceId' | 'taskId' | 'startedAt'>>) {
  let updatedRun: TaskRunRecord | null = null;

  updateJsonFile<TaskRunRecord[]>(TASK_RUNS_FILE, [], (taskRuns) => taskRuns.map((run) => {
    if (run.id !== taskRunId) return run;
    updatedRun = {
      ...run,
      ...patch,
      metadata: patch.metadata ? { ...run.metadata, ...patch.metadata } : run.metadata,
    };
    return updatedRun;
  }));

  return updatedRun;
}

export function addLedgerEntry(input: {
  workspaceId: string;
  source: CreditSource;
  deltaCredits: number;
  referenceType?: CreditLedgerEntry['referenceType'];
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}): CreditLedgerEntry {
  const createdEntryRef: { value?: CreditLedgerEntry } = {};

  updateJsonFile<CreditLedgerEntry[]>(LEDGER_FILE, [], (entries) => {
    const workspaceEntries = entries.filter((entry) => entry.workspaceId === input.workspaceId);
    const summary = summarizeCreditLedger(workspaceEntries);
    const balanceAfterCredits = summary.balanceCredits + Math.trunc(input.deltaCredits);
    createdEntryRef.value = createCreditLedgerEntry({
      workspaceId: input.workspaceId,
      direction: input.deltaCredits >= 0 ? 'grant' : 'debit',
      source: input.source,
      deltaCredits: input.deltaCredits,
      balanceAfterCredits,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      metadata: input.metadata,
    });

    return [...entries, createdEntryRef.value];
  });

  if (!createdEntryRef.value) throw new Error('Could not add ledger entry.');
  return createdEntryRef.value;
}

export function getWorkspaceCreditReserve(workspaceId: string, now = new Date()) {
  const state = getPlatformState();
  const workspaceEntries = state.ledger.filter((entry) => entry.workspaceId === workspaceId);
  const summary = summarizeCreditLedger(workspaceEntries);
  const reservedCredits = listActiveHoldEntries(workspaceEntries, now)
    .reduce((total, entry) => total + readCreditHoldCredits(entry), 0);

  return calculateAvailableCredits(workspaceId, summary.balanceCredits, reservedCredits);
}

export function acquireCreditHold(input: {
  workspaceId: string;
  amountCredits: number;
  referenceType?: CreditLedgerEntry['referenceType'];
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  holdId?: string;
  now?: Date;
  ttlMs?: number;
}) {
  const amountCredits = Math.max(0, normalizeCreditDelta(input.amountCredits));
  if (amountCredits <= 0) {
    throw new Error('Credit hold amount must be greater than zero.');
  }

  const now = input.now || new Date();
  const holdId = input.holdId || createStoreId('hold');
  const expiresAt = new Date(now.getTime() + Math.max(1, input.ttlMs || DEFAULT_CREDIT_HOLD_TTL_MS)).toISOString();
  type CreditHoldResult = {
    holdId: string;
    heldCredits: number;
    expiresAt: string;
    availableCredits: number;
    entry: CreditLedgerEntry;
  };
  const resultRef: { value?: CreditHoldResult } = {};

  updateJsonFile<CreditLedgerEntry[]>(LEDGER_FILE, [], (entries) => {
    const workspaceEntries = entries.filter((entry) => entry.workspaceId === input.workspaceId);
    const summary = summarizeCreditLedger(workspaceEntries);
    const reservedCredits = listActiveHoldEntries(workspaceEntries, now)
      .reduce((total, entry) => total + readCreditHoldCredits(entry), 0);
    const reserve = calculateAvailableCredits(input.workspaceId, summary.balanceCredits, reservedCredits);
    if (reserve.availableCredits < amountCredits) {
      throw new Error(
        `Insufficient credits. ${reserve.availableCredits} available, ${amountCredits} required.`
      );
    }

    const entry = createCreditLedgerEntry({
      workspaceId: input.workspaceId,
      direction: 'debit',
      source: 'credit_hold',
      deltaCredits: 0,
      balanceAfterCredits: summary.balanceCredits,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note || `Held ${amountCredits} credits`,
      metadata: {
        ...(input.metadata || {}),
        holdId,
        holdStatus: 'active',
        heldCredits: amountCredits,
        expiresAt,
      },
      createdAt: now.toISOString(),
    });

    resultRef.value = {
      holdId,
      heldCredits: amountCredits,
      expiresAt,
      availableCredits: Math.max(0, reserve.availableCredits - amountCredits),
      entry,
    };

    return [...entries, entry];
  });

  if (!resultRef.value) throw new Error('Could not acquire credit hold.');
  return resultRef.value;
}

export function releaseCreditHold(
  holdId: string,
  input: {
    workspaceId: string;
    referenceType?: CreditLedgerEntry['referenceType'];
    referenceId?: string;
    note?: string;
    metadata?: Record<string, unknown>;
    now?: Date;
  },
) {
  const now = input.now || new Date();
  const releasedEntryRef: { value?: CreditLedgerEntry } = {};

  updateJsonFile<CreditLedgerEntry[]>(LEDGER_FILE, [], (entries) => {
    const workspaceEntries = entries.filter((entry) => entry.workspaceId === input.workspaceId);
    const hold = findCreditHold(workspaceEntries, holdId);
    assertCreditHoldOpen(workspaceEntries, holdId);
    const summary = summarizeCreditLedger(workspaceEntries);
    const heldCredits = readCreditHoldCredits(hold);

    releasedEntryRef.value = createCreditLedgerEntry({
      workspaceId: input.workspaceId,
      direction: 'grant',
      source: 'credit_hold',
      deltaCredits: 0,
      balanceAfterCredits: summary.balanceCredits,
      referenceType: input.referenceType || hold.referenceType,
      referenceId: input.referenceId || hold.referenceId,
      note: input.note || `Released ${heldCredits} held credits`,
      metadata: {
        ...(input.metadata || {}),
        holdId,
        holdStatus: 'released',
        heldCredits,
        releasedAt: now.toISOString(),
      },
      createdAt: now.toISOString(),
    });

    return [...entries, releasedEntryRef.value];
  });

  if (!releasedEntryRef.value) throw new Error(`Could not release credit hold: ${holdId}`);
  return releasedEntryRef.value;
}

export function settleCreditHold(
  holdId: string,
  input: {
    workspaceId: string;
    actualCredits: number;
    source: Exclude<CreditSource, 'credit_hold'>;
    referenceType?: CreditLedgerEntry['referenceType'];
    referenceId?: string;
    note?: string;
    metadata?: Record<string, unknown>;
    now?: Date;
  },
) {
  const actualCredits = Math.max(0, normalizeCreditDelta(input.actualCredits));
  const now = input.now || new Date();
  const settledEntryRef: { value?: CreditLedgerEntry } = {};

  updateJsonFile<CreditLedgerEntry[]>(LEDGER_FILE, [], (entries) => {
    const workspaceEntries = entries.filter((entry) => entry.workspaceId === input.workspaceId);
    const hold = findCreditHold(workspaceEntries, holdId);
    assertCreditHoldOpen(workspaceEntries, holdId);
    const heldCredits = readCreditHoldCredits(hold);
    const summary = summarizeCreditLedger(workspaceEntries);
    const reservedForOtherHolds = listActiveHoldEntries(workspaceEntries, now)
      .filter((entry) => readCreditHoldId(entry) !== holdId)
      .reduce((total, entry) => total + readCreditHoldCredits(entry), 0);
    const spendableCredits = Math.max(0, summary.balanceCredits - reservedForOtherHolds);
    if (actualCredits > spendableCredits) {
      throw new Error(
        `Insufficient credits. ${spendableCredits} available, ${actualCredits} required.`
      );
    }

    settledEntryRef.value = createCreditLedgerEntry({
      workspaceId: input.workspaceId,
      direction: actualCredits > 0 ? 'debit' : 'grant',
      source: input.source,
      deltaCredits: -actualCredits,
      balanceAfterCredits: summary.balanceCredits - actualCredits,
      referenceType: input.referenceType || hold.referenceType,
      referenceId: input.referenceId || hold.referenceId,
      note: input.note || `Settled ${actualCredits} credits from hold`,
      metadata: {
        ...(input.metadata || {}),
        holdId,
        holdStatus: 'settled',
        heldCredits,
        actualCredits,
        settledAt: now.toISOString(),
      },
      createdAt: now.toISOString(),
    });

    return [...entries, settledEntryRef.value];
  });

  if (!settledEntryRef.value) throw new Error(`Could not settle credit hold: ${holdId}`);
  return settledEntryRef.value;
}

export function getWorkspaceLedgerSummary(workspaceId: string) {
  const state = getPlatformState();
  const entries = state.ledger.filter((entry) => entry.workspaceId === workspaceId);
  return summarizeCreditLedger(entries);
}

export function listTasks(workspaceId: string) {
  return getPlatformState().tasks.filter((task) => task.workspaceId === workspaceId);
}

export function listTaskRuns(workspaceId: string) {
  return getPlatformState().taskRuns.filter((run) => run.workspaceId === workspaceId);
}

export function listLedgerEntries(workspaceId: string) {
  return getPlatformState().ledger
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function mapTaskRunToStatus(status: TaskRunStatus): TaskStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    case 'retrying':
      return 'blocked';
    default:
      return 'queued';
  }
}
