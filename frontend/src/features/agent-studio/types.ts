export type WorkflowBlockKind = 'search' | 'query' | 'capture' | 'analyze' | 'summarize' | 'deliver' | 'note';
export type ExecutionMode = 'recommended' | 'custom';
export type OptimizationGoal = 'balanced' | 'cost_saver' | 'quality_first';
export type ReviewPolicy = 'lean' | 'standard' | 'strict';
export type StudioRoom = 'live' | 'optimize' | 'replay';
export type ScenarioPresetId = 'baseline' | 'rush' | 'deep_research' | 'monitoring' | 'high_stakes';
export type TrendMetric = 'credits' | 'duration' | 'success';
export type GateLearningWindow = 'recent' | 'deep' | 'all';
export type BranchRunFilter = 'all' | 'succeeded' | 'failed';

export interface StudioExperimentRecord {
  id: string;
  scenarioId: string;
  previewPresetId: string;
  createdAt: string;
  notes?: string;
  branchName?: string;
  parentExperimentId?: string;
  roleDirectives?: Record<string, StudioRoleDirective>;
}

export interface StudioRoleDirective {
  mode: 'cheaper' | 'review' | 'promote';
  phases?: WorkflowBlockKind[];
  updatedAt: string;
}

export interface StudioOperatingPlan {
  id: string;
  name: string;
  createdAt: string;
  scenarioId: string;
  previewPresetId: string;
  executionPolicy: AutomationExecutionPolicyDraft;
  roleDirectives?: Record<string, StudioRoleDirective>;
  intentLabel?: string;
  parentPlanId?: string;
  sourceExperimentId?: string;
  sourceExperimentLabel?: string;
  notes?: string;
}

export interface AutomationStudioStateDraft {
  activeRoom?: StudioRoom;
  selectedScenarioId?: string;
  previewPresetId?: string;
  selectedPlanId?: string;
  selectedPlanCompareId?: string;
  selectedPlanFamilyRootId?: string;
  selectedPlanIntentFilter?: string;
  selectedReplayPhase?: 'all' | WorkflowBlockKind;
  selectedWorkerRole?: string;
  selectedDirectivePhase?: 'all' | WorkflowBlockKind;
  selectedComparisonExperimentId?: string;
  selectedCohortRunId?: string;
  selectedReplayCompareRunId?: string;
  selectedBranchRootId?: string;
  comparedBranchRootId?: string;
  pinnedSuggestedPlanId?: string;
  dismissedSuggestedPlanId?: string;
  autoGraduateEnabled?: boolean;
  autoGraduateMinConfidence?: number;
  autoGraduateScenarioThresholds?: Record<string, number>;
  autoGraduateArchetypeThresholds?: Record<string, number>;
  lastAutoGraduatedPlanId?: string;
  autoRollbackEnabled?: boolean;
  autoRollbackWeaknessThreshold?: number;
  lastAutoRolledBackPlanId?: string;
  trendMetric?: TrendMetric;
  gateLearningWindow?: GateLearningWindow;
  branchRunFilter?: BranchRunFilter;
  phaseSimulation?: {
    phase: WorkflowBlockKind;
    mode: 'cheaper' | 'review' | 'promote';
  };
  experimentHistory?: StudioExperimentRecord[];
  roleDirectives?: Record<string, StudioRoleDirective>;
  promotionHistory?: StudioPromotionRecord[];
  autoPromotionMinConfidence?: number;
  autoPromotionScenarioThresholds?: Record<string, number>;
  autoPromotionArchetypeThresholds?: Record<string, number>;
  savedPlans?: StudioOperatingPlan[];
}

export interface StudioPromotionRecord {
  id: string;
  appliedAt: string;
  mode: 'preset' | 'steering' | 'full' | 'phase' | 'preset_phase' | 'learning' | 'graduation' | 'rollback';
  summary: string;
  actor: 'manual';
  sourceExperimentId?: string;
  sourceExperimentLabel?: string;
  phase?: WorkflowBlockKind;
  planId?: string;
  parentPlanId?: string;
  autoApplied?: boolean;
  confidence?: number;
  successDelta?: number;
  creditsDelta?: number;
  durationDelta?: number;
}

export interface WorkflowBlockDraft {
  id: string;
  kind: WorkflowBlockKind;
  title: string;
  objective: string;
  inputs?: Record<string, unknown>;
  deliveryTarget?: { channel: 'slack' | 'email'; target: string } | null;
}

export interface AutomationExecutionPolicyDraft {
  mode: ExecutionMode;
  optimizationGoal: OptimizationGoal;
  reviewPolicy: ReviewPolicy;
  maxElasticLanes: number;
}

export interface PlatformTaskRecord {
  id: string;
  title: string;
  description?: string;
  status: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformTaskRunRecord {
  id: string;
  taskId: string;
  status: string;
  modelTier: string;
  agentRole: string;
  estimatedCredits?: number;
  actualCredits?: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AutomationApiRecord {
  id: string;
  name: string;
  description?: string;
  authoring_mode?: 'guided' | 'describe';
  workflow_prompt?: string;
  schedule: string;
  timezone?: string;
  actions: string[];
  steps?: WorkflowBlockDraft[];
  execution_policy?: AutomationExecutionPolicyDraft;
  studio_state?: AutomationStudioStateDraft;
  notify?: string;
  condition?: string;
  status: 'active' | 'paused';
  last_run_at?: string;
  last_run_status?: 'succeeded' | 'failed';
  next_run_at?: string;
  created_at: string;
}

export interface DashboardTaskStepExecution {
  stepId: string;
  kind: string;
  title: string;
  assignedRole: string;
  status: string;
  summary?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  modelTier?: string;
  directiveMode?: 'cheaper' | 'review' | 'promote';
  directivePhases?: WorkflowBlockKind[];
  modelSource?: string;
  actualCredits?: number;
  toolCalls?: number;
  durationMs?: number;
  tokenUsage?: {
    totalTokens?: number;
  };
}

export interface DashboardWorkerCard {
  role: string;
  label: string;
  laneType: 'core' | 'elastic';
  assignedRole: string;
  band: string;
  modelLabel: string;
  status: 'active' | 'standby';
  summary: string;
  reason: string;
}

export interface DashboardWorkerTopology {
  version: string;
  primaryRole: string;
  primaryBand: string;
  workers: DashboardWorkerCard[];
  summary?: string;
}

export interface RunExperimentAttribution {
  experimentId?: string;
  experimentCreatedAt?: string;
  experimentNotes?: string;
  matchedSavedExperiment?: boolean;
  scenarioId?: string;
  scenarioLabel?: string;
  previewPresetId?: string;
  previewPresetLabel?: string;
}

export interface RunScenarioTelemetry {
  scenarioId?: string;
  scenarioLabel?: string;
  previewPresetId?: string;
  previewPresetLabel?: string;
  matchedSavedExperiment?: boolean;
  experimentId?: string;
  workflowStepCount?: number;
  estimatedToolCalls?: number;
  complexity?: string;
  directedRoles?: Array<{
    role: string;
    mode: 'cheaper' | 'review' | 'promote';
    phases?: WorkflowBlockKind[];
  }>;
}

export interface AgentStudioRow {
  automation: AutomationApiRecord;
  task?: PlatformTaskRecord;
  runs: PlatformTaskRunRecord[];
  latestRun?: PlatformTaskRunRecord;
  workerTopology?: DashboardWorkerTopology;
  stepExecutions: DashboardTaskStepExecution[];
  workflowSteps: WorkflowBlockDraft[];
  successRate: number;
  averageCredits: number;
  averageDurationMs: number;
}

export interface AgentStudioSettingsPayload {
  workspaceId: string;
  settings?: {
    agentStudio?: {
      autoGraduationProfiles?: Record<string, string>;
      autoRollbackEnabled?: boolean;
      autoRollbackWeaknessThreshold?: number;
      autoRollbackMomentumThreshold?: number;
    };
  };
}

export interface ReplayPhaseOverlayEntry {
  phase: WorkflowBlockKind;
  steps: DashboardTaskStepExecution[];
  credits: number;
  durationMs: number;
  tokens: number;
  failed: boolean;
  succeeded: boolean;
  primaryRole: string;
  modelSource?: string;
  directiveMode?: 'cheaper' | 'review' | 'promote';
  baselineCredits: number;
  baselineDurationMs: number;
  baselineSuccessRate: number;
  costWidth: string;
}
