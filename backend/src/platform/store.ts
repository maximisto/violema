import fs from 'fs';
import path from 'path';
import { createCreditLedgerEntry, summarizeCreditLedger } from './ledger';
import type {
  AgentRole,
  CreditLedgerEntry,
  CreditSource,
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

interface JsonStoreShape {
  tasks: TaskRecord[];
  taskRuns: TaskRunRecord[];
  ledger: CreditLedgerEntry[];
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, value: T) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
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

export function ensureWorkspaceCredits(
  workspaceId: string,
  planName = 'Pro',
  monthlyCredits = 1000
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
    budgetCredits: input.budgetCredits,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
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
  modelTier: ModelTier;
  estimatedCredits: number;
  metadata?: Record<string, unknown>;
}): TaskRunRecord {
  const state = getPlatformState();
  const taskRun: TaskRunRecord = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    agentRole: input.agentRole,
    modelTier: input.modelTier,
    status: 'running',
    estimatedCredits: input.estimatedCredits,
    startedAt: new Date().toISOString(),
    metadata: input.metadata,
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
