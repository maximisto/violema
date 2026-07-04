import type { AutomationStepDefinition, PersistedAutomationStep } from '../platform/types';

type WorkflowStepLike = Pick<PersistedAutomationStep, 'kind' | 'title' | 'objective' | 'inputs' | 'deliveryTarget'> & {
  id?: PersistedAutomationStep['id'] | AutomationStepDefinition['id'];
};

export interface WorkflowAutomationLike {
  name?: string;
  workflowId?: string;
  workflow_id?: string;
  templateId?: string;
  template_id?: string;
  steps?: WorkflowStepLike[];
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWorkflowIdentifier(value: unknown) {
  const normalized = readString(value).toLowerCase();
  return normalized || '';
}

function readExplicitWorkflowId(automation: WorkflowAutomationLike) {
  return (
    normalizeWorkflowIdentifier(automation.workflowId) ||
    normalizeWorkflowIdentifier(automation.workflow_id) ||
    normalizeWorkflowIdentifier(automation.templateId) ||
    normalizeWorkflowIdentifier(automation.template_id)
  );
}

function readQuerySteps(automation: WorkflowAutomationLike) {
  return (automation.steps || []).filter((step) => step.kind === 'query');
}

function isStripeRevenueQueryStep(step: WorkflowStepLike) {
  return (
    step.kind === 'query' &&
    readString(step.inputs?.source).toLowerCase() === 'stripe' &&
    readString(step.inputs?.query_type).toLowerCase().includes('revenue')
  );
}

function isApprovalRequiredByStepMetadata(step: WorkflowStepLike) {
  const explicit = step.inputs?.approval_required;
  if (explicit === true) return true;
  if (typeof explicit === 'string' && explicit.trim().toLowerCase() === 'true') return true;
  return /(approval|required|reviewed|review before|after review|after approval|hold for approval)/i.test(
    `${step.title || ''} ${step.objective || ''}`,
  );
}

export function inferWorkflowIdFromAutomation(automation: WorkflowAutomationLike) {
  const explicitWorkflowId = readExplicitWorkflowId(automation);
  if (explicitWorkflowId) return explicitWorkflowId;

  const querySteps = readQuerySteps(automation);
  if (querySteps.length === 0) return 'custom-workflow';

  const hasOnlyStripeQueries = querySteps.every((step) => readString(step.inputs?.source).toLowerCase() === 'stripe');
  if (!hasOnlyStripeQueries) return 'custom-workflow';

  return querySteps.some(isStripeRevenueQueryStep) ? 'revenue-watch' : 'custom-workflow';
}

export function resolveWorkflowDeliveryTarget(input: {
  step: WorkflowStepLike;
  notify?: string | null;
}) {
  const target = readString(input.step.deliveryTarget?.target) || readString(input.notify);
  if (!target) return null;

  return {
    target,
    channel: input.step.deliveryTarget?.channel || (target.includes('@') ? 'email' as const : 'slack' as const),
  };
}

export function isWorkflowDeliveryApprovalRequired(input: {
  workflowId: string;
  step: WorkflowStepLike;
  notify?: string | null;
}) {
  if (isApprovalRequiredByStepMetadata(input.step)) return true;

  const delivery = resolveWorkflowDeliveryTarget({
    step: input.step,
    notify: input.notify,
  });

  return input.workflowId === 'revenue-watch' && delivery?.channel === 'slack';
}
