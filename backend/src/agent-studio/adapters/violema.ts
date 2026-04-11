import type {
  AgentStudioPhaseKind,
  AgentStudioIntegrationPolicySnapshot,
  AgentStudioIntegrationRun,
  AgentStudioIntegrationStepExecution,
  AgentStudioIntegrationWorkflow,
  AgentStudioIntegrationWorkflowStep,
} from '../contract';
import type {
  AgentRole,
  AutomationExecutionPolicy,
  AutomationStepExecution,
  PersistedAutomationStep,
} from '../../platform';

interface ViolemaAutomationRecord {
  id: string;
  name: string;
  description?: string;
  status: string;
  schedule?: string;
  created_at?: string;
  updated_at?: string;
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
}

interface ViolemaTaskRunRecord {
  id: string;
  taskId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  metadata?: Record<string, unknown>;
}

export function mapViolemaPolicyToAgentStudioPolicy(
  policy?: AutomationExecutionPolicy,
): AgentStudioIntegrationPolicySnapshot | undefined {
  if (!policy) return undefined;
  return {
    mode: policy.mode,
    optimizationGoal: policy.optimizationGoal,
    reviewPolicy: policy.reviewPolicy,
    maxElasticLanes: policy.maxElasticLanes,
  };
}

export function mapViolemaStepToAgentStudioStep(
  step: PersistedAutomationStep,
): AgentStudioIntegrationWorkflowStep {
  return {
    stepId: step.id,
    kind: step.kind,
    title: step.title || step.objective,
    objective: step.objective,
    assignedRole: inferViolemaAssignedRole(step.kind),
  };
}

export function mapViolemaWorkflowToAgentStudioWorkflow(
  workspaceId: string,
  automation: ViolemaAutomationRecord,
): AgentStudioIntegrationWorkflow {
  return {
    workspaceId,
    workflowId: automation.id,
    name: automation.name,
    description: automation.description,
    status: automation.status,
    schedule: automation.schedule,
    createdAt: automation.created_at,
    updatedAt: automation.updated_at,
    steps: (automation.steps || []).map(mapViolemaStepToAgentStudioStep),
    policy: mapViolemaPolicyToAgentStudioPolicy(automation.execution_policy),
  };
}

export function mapViolemaStepExecutionToAgentStudioStepExecution(
  step: AutomationStepExecution,
): AgentStudioIntegrationStepExecution {
  return {
    stepId: step.stepId,
    kind: step.kind,
    title: step.title,
    assignedRole: step.assignedRole,
    status: step.status,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    durationMs: step.durationMs,
    modelTier: step.modelTier,
    modelSource: step.modelSource,
    directiveMode: step.directiveMode,
    directivePhases: step.directivePhases,
    toolCalls: step.toolCalls,
    actualCredits: step.actualCredits,
    summary: step.summary,
    error: step.error,
    tokenUsage: step.tokenUsage,
  };
}

export function mapViolemaRunToAgentStudioRun(
  workflowId: string,
  run: ViolemaTaskRunRecord,
): AgentStudioIntegrationRun {
  const metadata = run.metadata || {};
  return {
    runId: run.id,
    workflowId,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    estimatedCredits: run.estimatedCredits,
    actualCredits: run.actualCredits,
    durationMs: typeof metadata.durationMs === 'number' ? metadata.durationMs : undefined,
    experimentId: typeof metadata.experimentId === 'string' ? metadata.experimentId : undefined,
    experimentLabel: typeof metadata.experimentLabel === 'string' ? metadata.experimentLabel : undefined,
    branchName: typeof metadata.branchName === 'string' ? metadata.branchName : undefined,
    parentExperimentId: typeof metadata.parentExperimentId === 'string' ? metadata.parentExperimentId : undefined,
    scenarioId: typeof metadata.scenarioId === 'string' ? metadata.scenarioId : undefined,
    previewPresetId: typeof metadata.previewPresetId === 'string' ? metadata.previewPresetId : undefined,
  };
}

function inferViolemaAssignedRole(kind: AgentStudioPhaseKind): AgentRole {
  switch (kind) {
    case 'search':
    case 'capture':
      return 'researcher';
    case 'query':
    case 'analyze':
      return 'analyst';
    case 'summarize':
      return 'writer';
    case 'deliver':
      return 'messenger';
    case 'note':
    default:
      return 'operator';
  }
}
