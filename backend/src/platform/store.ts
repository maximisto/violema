import path from 'path';
import { calculateAvailableCredits, createCreditLedgerEntry, normalizeCreditDelta, summarizeCreditLedger } from './ledger';
import { readJsonFile, writeJsonFile } from './jsonStore';
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

export function ensureWorkspaceCredits(
  workspaceId: string,
  planName = 'Starter',
  monthlyCredits = 500
) {
  const state = getPlatformState();
  const existing = state.ledger.filter((entry) => entry.workspaceId === workspaceId);
  if (existing.length > 0) return summarizeCreditLedger(existing);

  const initialEntry = createCreditLedgerEntry({
    workspaceId,
    direction: 'grant',
    source: 'monthly_subscription',
    deltaCredits: monthlyCredits,
    balanceAfterCredits: monthlyCredits,
    referenceType: 'subscription',
    referenceId: `plan_${planName.toLowerCase()}`,
    note: `${planName} monthly credit grant`,
  });

  state.ledger.push(initialEntry);
  savePlatformState({ ledger: state.ledger });
  return summarizeCreditLedger([initialEntry]);
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
  const state = getPlatformState();
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

  state.tasks.unshift(task);
  savePlatformState({ tasks: state.tasks });
  return task;
}

export function updateTask(taskId: string, patch: Partial<TaskRecord>) {
  const state = getPlatformState();
  const tasks = state.tasks.map((task) =>
    task.id === taskId
      ? { ...task, ...patch, updatedAt: new Date().toISOString() }
      : task
  );
  savePlatformState({ tasks });
  return tasks.find((task) => task.id === taskId) || null;
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
  const state = getPlatformState();
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

  state.taskRuns.unshift(taskRun);
  savePlatformState({ taskRuns: state.taskRuns });
  return taskRun;
}

export function finalizeTaskRun(taskRunId: string, patch: {
  status: TaskRunStatus;
  actualCredits?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  const state = getPlatformState();
  const taskRuns = state.taskRuns.map((run) =>
    run.id === taskRunId
      ? {
          ...run,
          ...patch,
          finishedAt: new Date().toISOString(),
          metadata: { ...run.metadata, ...patch.metadata },
        }
      : run
  );
  savePlatformState({ taskRuns });
  return taskRuns.find((run) => run.id === taskRunId) || null;
}

export function updateTaskRun(taskRunId: string, patch: Partial<Omit<TaskRunRecord, 'id' | 'workspaceId' | 'taskId' | 'startedAt'>>) {
  const state = getPlatformState();
  const taskRuns = state.taskRuns.map((run) =>
    run.id === taskRunId
      ? {
          ...run,
          ...patch,
          metadata: patch.metadata ? { ...run.metadata, ...patch.metadata } : run.metadata,
        }
      : run
  );
  savePlatformState({ taskRuns });
  return taskRuns.find((run) => run.id === taskRunId) || null;
}

export function addLedgerEntry(input: {
  workspaceId: string;
  source: CreditSource;
  deltaCredits: number;
  referenceType?: CreditLedgerEntry['referenceType'];
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}) {
  const state = getPlatformState();
  const workspaceEntries = state.ledger.filter((entry) => entry.workspaceId === input.workspaceId);
  const summary = workspaceEntries.length > 0
    ? summarizeCreditLedger(workspaceEntries)
    : ensureWorkspaceCredits(input.workspaceId);
  const balanceAfterCredits = summary.balanceCredits + Math.trunc(input.deltaCredits);

  const entry = createCreditLedgerEntry({
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

  state.ledger.push(entry);
  savePlatformState({ ledger: state.ledger });
  return entry;
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

  let state = getPlatformState();
  let workspaceEntries = state.ledger.filter((entry) => entry.workspaceId === input.workspaceId);
  if (workspaceEntries.length === 0) {
    ensureWorkspaceCredits(input.workspaceId);
    state = getPlatformState();
    workspaceEntries = state.ledger.filter((entry) => entry.workspaceId === input.workspaceId);
  }

  const now = input.now || new Date();
  const summary = summarizeCreditLedger(workspaceEntries);
  const reserve = getWorkspaceCreditReserve(input.workspaceId, now);
  if (reserve.availableCredits < amountCredits) {
    throw new Error(
      `Insufficient credits. ${reserve.availableCredits} available, ${amountCredits} required.`
    );
  }

  const holdId = input.holdId || createStoreId('hold');
  const expiresAt = new Date(now.getTime() + Math.max(1, input.ttlMs || DEFAULT_CREDIT_HOLD_TTL_MS)).toISOString();
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

  state.ledger.push(entry);
  savePlatformState({ ledger: state.ledger });

  return {
    holdId,
    heldCredits: amountCredits,
    expiresAt,
    availableCredits: Math.max(0, reserve.availableCredits - amountCredits),
    entry,
  };
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
  const state = getPlatformState();
  const workspaceEntries = state.ledger.filter((entry) => entry.workspaceId === input.workspaceId);
  const hold = findCreditHold(workspaceEntries, holdId);
  assertCreditHoldOpen(workspaceEntries, holdId);
  const summary = summarizeCreditLedger(workspaceEntries);
  const now = input.now || new Date();
  const heldCredits = readCreditHoldCredits(hold);
  const entry = createCreditLedgerEntry({
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

  state.ledger.push(entry);
  savePlatformState({ ledger: state.ledger });
  return entry;
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
  const state = getPlatformState();
  const workspaceEntries = state.ledger.filter((entry) => entry.workspaceId === input.workspaceId);
  const hold = findCreditHold(workspaceEntries, holdId);
  assertCreditHoldOpen(workspaceEntries, holdId);
  const heldCredits = readCreditHoldCredits(hold);
  const now = input.now || new Date();
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

  const entry = createCreditLedgerEntry({
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

  state.ledger.push(entry);
  savePlatformState({ ledger: state.ledger });
  return entry;
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
