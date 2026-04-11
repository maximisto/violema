import type {
  AutomationExecutionPlan,
  AutomationStepKind,
} from '../platform';
import type { AutomationStudioState } from '../scheduler';

export function getAutomationScenarioLabel(id?: string) {
  switch (id) {
    case 'rush':
      return 'Rush mode';
    case 'deep_research':
      return 'Deep research';
    case 'monitoring':
      return 'Watch loop';
    case 'high_stakes':
      return 'High stakes';
    default:
      return 'Current workflow';
  }
}

export function getAutomationPresetLabel(id?: string) {
  switch (id) {
    case 'lean_ops':
      return 'Lean ops';
    case 'balanced':
      return 'Balanced';
    case 'high_assurance':
      return 'High assurance';
    case 'recommended':
    default:
      return 'System recommended';
  }
}

export function buildAutomationExperimentAttribution(studioState?: AutomationStudioState) {
  const scenarioId = studioState?.selectedScenarioId || 'baseline';
  const previewPresetId = studioState?.previewPresetId || 'recommended';
  const matchedExperiment = (studioState?.experimentHistory || [])
    .filter((experiment) => experiment.scenarioId === scenarioId && experiment.previewPresetId === previewPresetId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];

  return {
    scenarioId,
    scenarioLabel: getAutomationScenarioLabel(scenarioId),
    previewPresetId,
    previewPresetLabel: getAutomationPresetLabel(previewPresetId),
    experimentId: matchedExperiment?.id,
    experimentCreatedAt: matchedExperiment?.createdAt,
    experimentNotes: matchedExperiment?.notes,
    matchedSavedExperiment: Boolean(matchedExperiment),
  };
}

export function buildAutomationScenarioTelemetry(
  studioState: AutomationStudioState | undefined,
  executionPlan: AutomationExecutionPlan,
  experimentAttribution: ReturnType<typeof buildAutomationExperimentAttribution>,
) {
  return {
    scenarioId: experimentAttribution.scenarioId,
    scenarioLabel: experimentAttribution.scenarioLabel,
    previewPresetId: experimentAttribution.previewPresetId,
    previewPresetLabel: experimentAttribution.previewPresetLabel,
    matchedSavedExperiment: experimentAttribution.matchedSavedExperiment,
    experimentId: experimentAttribution.experimentId,
    workflowStepCount: executionPlan.steps.length,
    estimatedToolCalls: executionPlan.estimatedToolCalls,
    complexity: executionPlan.complexity,
    directedRoles: Object.entries(studioState?.roleDirectives || {}).map(([role, directive]) => ({
      role,
      mode: directive.mode,
      phases: (directive.phases || []) as AutomationStepKind[],
    })),
  };
}
