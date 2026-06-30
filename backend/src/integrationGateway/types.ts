export interface IntegrationNextAction {
  label: string;
  route: string;
}

export interface IntegrationReadinessError {
  ok: false;
  code: 'integration_not_ready' | 'unsupported_query' | 'integration_query_failed';
  source: string;
  workflowId?: string;
  message: string;
  nextAction: IntegrationNextAction;
}

export interface IntegrationQuerySuccess<T = unknown> {
  ok: true;
  source: string;
  query_type: string;
  data: T;
  fetched_at: string;
  latency_ms: number;
  cache_hit: false;
  live: true;
}

export type IntegrationQueryResult<T = unknown> =
  | IntegrationQuerySuccess<T>
  | IntegrationReadinessError;

export type WorkflowLedgerEventType =
  | 'workflow_readiness_checked'
  | 'data_read'
  | 'draft_created'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'external_action_executed'
  | 'connector_failed';

export interface WorkflowLedgerEvent {
  id: string;
  workspaceId: string;
  workflowId: string;
  automationId?: string;
  taskId?: string;
  taskRunId?: string;
  type: WorkflowLedgerEventType;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
