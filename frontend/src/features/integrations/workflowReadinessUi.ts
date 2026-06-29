export interface WorkflowReadinessUiStep {
  kind?: string;
  inputs?: Record<string, unknown>;
}

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
