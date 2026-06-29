export interface WorkflowReadinessUiStep {
  kind?: string;
  inputs?: Record<string, unknown>;
}

export interface WorkflowReadinessUiBlocker {
  key: string;
  route?: string;
}

export type WorkflowReadinessBlockerAction =
  | { kind: 'navigate'; label: string; href: string }
  | { kind: 'editor'; label: string; section: 'setup' }
  | null;

export function inferEditorWorkflowId(steps: WorkflowReadinessUiStep[]): string {
  const querySteps = steps.filter((step) => step.kind === 'query');
  if (querySteps.length === 0) return '';

  const hasOnlyStripeQueries = querySteps.every((step) => step.inputs?.source === 'stripe');
  if (!hasOnlyStripeQueries) return '';

  const hasStripeRevenueQuery = querySteps.some(
    (step) =>
      step.inputs?.source === 'stripe' &&
      typeof step.inputs?.query_type === 'string' &&
      step.inputs.query_type.includes('revenue'),
  );

  return hasStripeRevenueQuery ? 'revenue-watch' : '';
}

function normalizeRunId(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getSelectedRunLedgerId(input: {
  selectedTaskRunId?: string | null;
  selectedMissionTaskRunId?: string | null;
}) {
  return normalizeRunId(input.selectedTaskRunId) || normalizeRunId(input.selectedMissionTaskRunId);
}

export function getDashboardReadinessBlockerAction(
  blocker: WorkflowReadinessUiBlocker,
): WorkflowReadinessBlockerAction {
  if (blocker.key === 'stripe' || blocker.route?.includes('provider=stripe')) {
    return {
      kind: 'navigate',
      label: 'Open Stripe settings',
      href: '/settings#integration-stripe',
    };
  }

  if (blocker.key === 'slack_target') {
    return {
      kind: 'editor',
      label: 'Set destination',
      section: 'setup',
    };
  }

  return null;
}
