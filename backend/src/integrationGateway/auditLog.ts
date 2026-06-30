import path from 'path';
import { readJsonFile, writeJsonFile } from '../platform/jsonStore';
import type { WorkflowLedgerEvent, WorkflowLedgerEventType } from './types';

const WORKFLOW_LEDGER_FILE = path.join(process.cwd(), 'workflow-ledger-events.json');

export interface AppendWorkflowLedgerEventInput {
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  type: WorkflowLedgerEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  now?: () => string;
}

function safeTimestampId(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/g, '');
}

function readEvents() {
  return readJsonFile<WorkflowLedgerEvent[]>(WORKFLOW_LEDGER_FILE, []);
}

function writeEvents(events: WorkflowLedgerEvent[]) {
  writeJsonFile(WORKFLOW_LEDGER_FILE, events);
}

export function buildSafeDataReadLedgerMetadata(payload: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const items = Array.isArray(data.items) ? data.items : undefined;
  const total = typeof data.total === 'number' ? data.total : items?.length;

  if (typeof payload.source === 'string') {
    metadata.source = payload.source;
  }
  if (typeof payload.query_type === 'string') {
    metadata.queryType = payload.query_type;
  }
  if (typeof total === 'number') {
    metadata.resultCount = total;
  }
  if (data.window && typeof data.window === 'object') {
    metadata.window = data.window;
  }
  metadata.live = payload.live === true;
  if (typeof data.providerRoute === 'string') {
    metadata.providerRoute = data.providerRoute;
  }

  return metadata;
}

export function appendWorkflowLedgerEvent(input: AppendWorkflowLedgerEventInput) {
  const createdAt = input.now ? input.now() : new Date().toISOString();
  const idBase = input.taskRunId || input.automationId || input.workflowId;
  const event: WorkflowLedgerEvent = {
    id: `ledger_${idBase}_${input.type}_${safeTimestampId(createdAt)}`,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    automationId: input.automationId,
    taskId: input.taskId,
    taskRunId: input.taskRunId,
    type: input.type,
    summary: input.summary,
    metadata: input.metadata,
    createdAt,
  };
  writeEvents([...readEvents(), event]);
  return event;
}

export function listWorkflowLedgerEvents(input: {
  workspaceId: string;
  workflowId?: string;
  automationId?: string;
  taskRunId?: string;
}) {
  return readEvents()
    .filter((event) => event.workspaceId === input.workspaceId)
    .filter((event) => !input.workflowId || event.workflowId === input.workflowId)
    .filter((event) => !input.automationId || event.automationId === input.automationId)
    .filter((event) => !input.taskRunId || event.taskRunId === input.taskRunId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
