import type { AutomationRunOutcome } from '../platform/automationLifecycle';
import type { AppendWorkflowLedgerEventInput } from './auditLog';

export interface PendingApprovalRequestedLedgerEvent {
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  deliveryTarget: string;
  channel?: string;
  preparedAt: string;
}

export function buildPendingApprovalRequestedLedgerEvent(input: {
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  deliveryTarget: string;
  channel?: string;
  preparedAt: string;
}): PendingApprovalRequestedLedgerEvent {
  return {
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    automationId: input.automationId,
    taskId: input.taskId,
    taskRunId: input.taskRunId,
    deliveryTarget: input.deliveryTarget,
    channel: input.channel,
    preparedAt: input.preparedAt,
  };
}

export function finalizePendingApprovalRequestedLedgerEvents(input: {
  outcome: Pick<AutomationRunOutcome, 'reviewRequired'>;
  pendingEvents: PendingApprovalRequestedLedgerEvent[];
}): AppendWorkflowLedgerEventInput[] {
  if (!input.outcome.reviewRequired) return [];

  return input.pendingEvents.map((event) => ({
    workspaceId: event.workspaceId,
    workflowId: event.workflowId,
    automationId: event.automationId,
    taskId: event.taskId,
    taskRunId: event.taskRunId,
    type: 'approval_requested',
    summary: `Prepared delivery for approval before sending to ${event.deliveryTarget}.`,
    metadata: {
      deliveryTarget: event.deliveryTarget,
      channel: event.channel,
    },
    now: () => event.preparedAt,
  }));
}
