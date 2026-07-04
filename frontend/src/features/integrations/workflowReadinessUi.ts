export interface WorkflowReadinessUiStep {
  kind?: string;
  inputs?: Record<string, unknown>;
  deliveryTarget?: {
    channel?: 'slack' | 'email';
    target?: string;
  } | null;
}

export interface WorkflowReadinessUiBlocker {
  key: string;
  route?: string;
}

export type WorkflowReadinessBlockerAction =
  | { kind: 'navigate'; label: string; href: string }
  | { kind: 'editor'; label: string; section: 'setup' }
  | null;

export function inferEditorWorkflowId(
  steps: WorkflowReadinessUiStep[],
  explicitWorkflowId?: string | null,
): string {
  const explicit = typeof explicitWorkflowId === 'string' ? explicitWorkflowId.trim() : '';
  if (explicit) return explicit;

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

function readTrimmed(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getWorkflowReadinessDeliveryTarget(input: {
  notify?: string | null;
  steps: WorkflowReadinessUiStep[];
}) {
  const notifyTarget = readTrimmed(input.notify);
  if (notifyTarget) return notifyTarget;

  for (const step of input.steps) {
    if (step.kind !== 'deliver') continue;
    const stepTarget = readTrimmed(step.deliveryTarget?.target);
    if (stepTarget) return stepTarget;
  }

  return '';
}

function normalizeRunId(value?: string | null) {
  return readTrimmed(value);
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

  if (blocker.key === 'github' || blocker.route?.includes('integration-github')) {
    return {
      kind: 'navigate',
      label: 'Open GitHub settings',
      href: blocker.route || '/settings#integration-github',
    };
  }

  if (
    blocker.key === 'gmail' ||
    blocker.key === 'google_calendar' ||
    blocker.key === 'google_drive' ||
    blocker.route?.includes('/integrations?provider=')
  ) {
    return {
      kind: 'navigate',
      label: blocker.key === 'google_calendar'
        ? 'Connect Calendar'
        : blocker.key === 'google_drive'
          ? 'Connect Drive'
          : 'Connect Gmail',
      href: blocker.route || '/integrations',
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
