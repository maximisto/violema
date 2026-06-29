import path from 'path';
import { readJsonFile, writeJsonFile } from '../platform/jsonStore';
import type { WorkflowLedgerEvent, WorkflowLedgerEventType } from './types';

const WORKFLOW_LEDGER_FILE = path.join(process.cwd(), 'workflow-ledger-events.json');

function safeTimestampId(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/g, '');
}

function readEvents() {
  return readJsonFile<WorkflowLedgerEvent[]>(WORKFLOW_LEDGER_FILE, []);
}

function writeEvents(events: WorkflowLedgerEvent[]) {
  writeJsonFile(WORKFLOW_LEDGER_FILE, events);
}

export function appendWorkflowLedgerEvent(input: {
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  type: WorkflowLedgerEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  now?: () => string;
}) {
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
