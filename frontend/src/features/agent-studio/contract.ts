export type AgentStudioPhaseKind = 'search' | 'query' | 'capture' | 'analyze' | 'summarize' | 'deliver' | 'note';
export type AgentStudioDirectiveMode = 'cheaper' | 'review' | 'promote';
export type AgentStudioExecutionMode = 'recommended' | 'custom';
export type AgentStudioOptimizationGoal = 'balanced' | 'cost_saver' | 'quality_first';
export type AgentStudioReviewPolicy = 'lean' | 'standard' | 'strict';
export type AgentStudioRunStatus = 'planned' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface AgentStudioIntegrationWorkflowStep {
  stepId: string;
  kind: AgentStudioPhaseKind;
  title: string;
  objective: string;
  assignedRole: string;
  dependsOnStepIds?: string[];
  modelTier?: string;
  toolName?: string;
}

export interface AgentStudioIntegrationPolicySnapshot {
  mode: AgentStudioExecutionMode;
  optimizationGoal: AgentStudioOptimizationGoal;
  reviewPolicy: AgentStudioReviewPolicy;
  maxElasticLanes: number;
}

export interface AgentStudioIntegrationDirective {
  role: string;
  mode: AgentStudioDirectiveMode;
  phases?: AgentStudioPhaseKind[];
}

export interface AgentStudioIntegrationStepExecution {
  stepId: string;
  kind: AgentStudioPhaseKind;
  title: string;
  assignedRole: string;
  status: AgentStudioRunStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  modelTier?: string;
  modelSource?: string;
  directiveMode?: AgentStudioDirectiveMode;
  directivePhases?: AgentStudioPhaseKind[];
  toolCalls?: number;
  actualCredits?: number;
  summary?: string;
  error?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface AgentStudioIntegrationRun {
  runId: string;
  workflowId: string;
  status: AgentStudioRunStatus | string;
  startedAt: string;
  finishedAt?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  durationMs?: number;
  experimentId?: string;
  experimentLabel?: string;
  branchName?: string;
  parentExperimentId?: string;
  scenarioId?: string;
  previewPresetId?: string;
}

export interface AgentStudioIntegrationWorkflow {
  workspaceId: string;
  workflowId: string;
  name: string;
  description?: string;
  status: string;
  schedule?: string;
  createdAt?: string;
  updatedAt?: string;
  steps: AgentStudioIntegrationWorkflowStep[];
  policy?: AgentStudioIntegrationPolicySnapshot;
}

export interface AgentStudioPromotionEvent {
  eventId: string;
  appliedAt: string;
  mode: 'preset' | 'steering' | 'full' | 'phase' | 'preset_phase' | 'learning' | 'graduation' | 'rollback';
  summary: string;
  sourceExperimentId?: string;
  sourceExperimentLabel?: string;
  planId?: string;
  parentPlanId?: string;
  phase?: AgentStudioPhaseKind;
  autoApplied?: boolean;
  confidence?: number;
  successDelta?: number;
  creditsDelta?: number;
  durationDelta?: number;
}

export interface AgentStudioOperationalContextSimilarRun {
  runId: string;
  label: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  actualCredits?: number;
  durationMs?: number;
  similarityScore: number;
  matchedSignals: string[];
}

export interface AgentStudioOperationalContextHealthyComparison {
  runId: string;
  label: string;
  startedAt: string;
  finishedAt?: string;
  creditsDelta?: number;
  durationDelta?: number;
  changedSignals: string[];
  summary: string;
}

export interface AgentStudioOperationalContextEvidenceItem {
  evidenceId: string;
  title: string;
  body: string;
  sourceLabel: string;
  phase?: AgentStudioPhaseKind;
  relatedRunIds?: string[];
}

export interface AgentStudioOperationalContext {
  workflowId: string;
  runId?: string;
  generatedAt: string;
  similarRuns: AgentStudioOperationalContextSimilarRun[];
  lastHealthyComparison?: AgentStudioOperationalContextHealthyComparison;
  recommendationEvidence: AgentStudioOperationalContextEvidenceItem[];
}
