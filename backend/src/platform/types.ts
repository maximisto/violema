export type CreditSource =
  | 'monthly_subscription'
  | 'top_up'
  | 'referral_bonus'
  | 'task_run'
  | 'automation_run'
  | 'credit_hold'
  | 'manual_adjustment'
  | 'refund'
  | 'promo'
  | 'trial_grant';

export type CreditDirection = 'grant' | 'debit';
export type ModelTier = 'micro' | 'default' | 'hard' | 'critical' | 'ops';
export type IntelligenceBand = 'micro' | 'default' | 'hard' | 'critical';
export type WorkerLaneType = 'core' | 'elastic';
export type AutomationExecutionMode = 'recommended' | 'custom';
export type AutomationOptimizationGoal = 'balanced' | 'cost_saver' | 'quality_first';
export type AutomationReviewPolicy = 'lean' | 'standard' | 'strict';
export type AgentRole =
  | 'nexus'
  | 'researcher'
  | 'operator'
  | 'engineer'
  | 'reviewer'
  | 'analyst'
  | 'scheduler'
  | 'writer'
  | 'messenger'
  | 'monitor';
export type TaskKind = 'chat' | 'research' | 'analysis' | 'engineering' | 'automation' | 'message' | 'report' | 'review' | 'scheduling';
export type TaskStatus = 'queued' | 'running' | 'waiting_review' | 'blocked' | 'completed' | 'failed' | 'canceled';
export type TaskRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'retrying';
export type UsageEventKind =
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_reviewed'
  | 'automation_scheduled'
  | 'automation_triggered'
  | 'automation_completed'
  | 'automation_failed'
  | 'tool_called'
  | 'model_routed'
  | 'delegation_planned'
  | 'delegation_assigned'
  | 'delegation_handed_off'
  | 'delegation_reviewed'
  | 'credit_granted'
  | 'credit_spent'
  | 'credit_reserved'
  | 'credit_released'
  | 'referral_redeemed';

export interface CreditLedgerEntry {
  id: string;
  workspaceId: string;
  direction: CreditDirection;
  source: CreditSource;
  deltaCredits: number;
  balanceAfterCredits: number;
  referenceType?: 'subscription' | 'task' | 'automation' | 'referral' | 'manual' | 'promotion' | 'beta_trial';
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreditLedgerSummary {
  workspaceId: string;
  balanceCredits: number;
  grantedCredits: number;
  spentCredits: number;
  netCredits: number;
  updatedAt: string;
}

export interface CreditReserve {
  workspaceId: string;
  reservedCredits: number;
  availableCredits: number;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  workspaceId: string;
  objectiveId?: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  kind: TaskKind;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  autonomyMode?: 'autonomous' | 'cautious' | 'supervised';
  budgetCredits?: number;
  assigneeRole?: AgentRole;
  ownerRole?: AgentRole;
  executorRole?: AgentRole;
  reviewerRole?: AgentRole;
  supportingRoles?: AgentRole[];
  delegationState?: 'unassigned' | 'planned' | 'delegated' | 'in_progress' | 'review' | 'completed';
  delegationPlanId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface TaskDelegationStep {
  id: string;
  role: AgentRole;
  objective: string;
  status: 'planned' | 'running' | 'completed' | 'blocked';
}

export interface TaskDelegationPlan {
  mode: 'solo' | 'delegated';
  primaryRole: AgentRole;
  supportingRoles: AgentRole[];
  rationale: string;
  steps: TaskDelegationStep[];
}

export interface WorkerDefinition {
  role: AgentRole;
  label: string;
  laneType: WorkerLaneType;
  preferredBand: IntelligenceBand;
  fallbackBands: IntelligenceBand[];
  summary: string;
}

export interface WorkerSnapshotCard {
  role: AgentRole;
  label: string;
  laneType: WorkerLaneType;
  assignedRole: AgentRole;
  band: IntelligenceBand;
  modelLabel: string;
  status: 'active' | 'standby';
  summary: string;
  reason: string;
}

export interface WorkerTopologySnapshot {
  version: 'violema-10';
  primaryRole: AgentRole;
  primaryBand: IntelligenceBand;
  coreWorkers: AgentRole[];
  elasticLanes: AgentRole[];
  activeRoles: AgentRole[];
  bandByRole: Partial<Record<AgentRole, IntelligenceBand>>;
  workers: WorkerSnapshotCard[];
  summary: string;
}

export interface AutomationExecutionPolicy {
  mode: AutomationExecutionMode;
  optimizationGoal: AutomationOptimizationGoal;
  reviewPolicy: AutomationReviewPolicy;
  maxElasticLanes: number;
}

export type AutomationStepKind = 'search' | 'query' | 'summarize' | 'deliver' | 'capture' | 'analyze' | 'note';
export type AutomationStepStatus = 'planned' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface AutomationStepDeliveryTarget {
  channel: 'slack' | 'email';
  target: string;
}

export interface PersistedAutomationStep {
  id: string;
  kind: AutomationStepKind;
  title?: string;
  objective: string;
  inputs?: Record<string, unknown>;
  deliveryTarget?: AutomationStepDeliveryTarget | null;
}

export interface AutomationStepDefinition {
  id: string;
  kind: AutomationStepKind;
  title: string;
  objective: string;
  assignedRole: AgentRole;
  directiveMode?: 'cheaper' | 'review' | 'promote';
  directivePhases?: AutomationStepKind[];
  modelTier?: ModelTier;
  estimatedCredits?: number;
  dependsOnStepIds?: string[];
  toolName?: 'web_search' | 'query_data' | 'browser_screenshot' | 'send_message' | 'generate_text';
  inputs?: Record<string, unknown>;
  deliveryTarget?: AutomationStepDeliveryTarget | null;
}

export interface AutomationStepExecution {
  stepId: string;
  kind: AutomationStepKind;
  title: string;
  assignedRole: AgentRole;
  directiveMode?: 'cheaper' | 'review' | 'promote';
  directivePhases?: AutomationStepKind[];
  modelTier?: ModelTier;
  modelSource?: 'server_default' | 'workspace_override' | 'workspace_token';
  modelSourceLabel?: string;
  status: AutomationStepStatus;
  startedAt?: string;
  finishedAt?: string;
  summary?: string;
  error?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  toolCalls?: number;
  artifactCount?: number;
  durationMs?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    provider?: string;
    model?: string;
    baseUrl?: string;
  };
  charge?: {
    actualCredits: number;
    tokenCredits: number;
    toolCredits: number;
    artifactCredits: number;
    durationCredits: number;
    complexityCredits: number;
    baseCredits: number;
    rationale: string[];
  };
  output?: Record<string, unknown>;
  artifactKind?: string;
}

export interface AutomationRolePlan {
  primaryRole: AgentRole;
  supportingRoles: AgentRole[];
  rationale: string;
  elasticLanes?: AgentRole[];
  primaryBand?: IntelligenceBand;
}

export interface AutomationExecutionPlan {
  primaryRole: AgentRole;
  supportingRoles: AgentRole[];
  rationale: string;
  elasticLanes?: AgentRole[];
  primaryBand?: IntelligenceBand;
  suggestedModelTier: ModelTier;
  complexity: 'low' | 'medium' | 'high';
  estimatedToolCalls: number;
  estimatedCredits: number;
  steps: AutomationStepDefinition[];
  topology: WorkerTopologySnapshot;
}

export type MissionStatus =
  | 'planned'
  | 'running'
  | 'waiting_review'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'canceled';

export type MissionReviewPolicy = 'none' | 'before_delivery' | 'strict';
export type MissionSource = 'chat' | 'workflow_template' | 'automation' | 'manual';
export type MissionPlanStepStatus = AutomationStepStatus | 'waiting_review';

export interface MissionReviewSettings {
  policy: MissionReviewPolicy;
  requiredRoles?: AgentRole[];
  approvalChannel?: 'slack' | 'email' | 'app' | string;
}

export interface MissionPlanStep {
  id: string;
  title: string;
  objective: string;
  kind: AutomationStepKind;
  assignedRole: AgentRole;
  toolName?: AutomationStepDefinition['toolName'];
  integrationId?: string;
  dependencies?: string[];
  condition?: string;
  inputs?: Record<string, unknown>;
  deliveryTarget?: AutomationStepDeliveryTarget | null;
  reviewGate?: boolean;
  estimatedCredits?: number;
  currentStatus: MissionPlanStepStatus;
}

export interface MissionPlan {
  steps: MissionPlanStep[];
  primaryRole: AgentRole;
  supportingRoles: AgentRole[];
  estimatedCredits?: number;
  executionPolicy?: AutomationExecutionPolicy;
  automationPlan?: AutomationExecutionPlan;
}

export interface MissionRecord {
  id: string;
  workspaceId: string;
  title: string;
  goal: string;
  status: MissionStatus;
  ownerRole?: AgentRole;
  source?: MissionSource;
  sourcePrompt?: string;
  workflowTemplateId?: string;
  scheduleId?: string;
  automationId?: string;
  activeTaskId?: string;
  activeRunId?: string;
  creditBudget?: number;
  review: MissionReviewSettings;
  plan: MissionPlan;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface TaskRunRecord {
  id: string;
  workspaceId: string;
  taskId: string;
  agentRole: AgentRole;
  ownerRole?: AgentRole;
  executorRole?: AgentRole;
  reviewerRole?: AgentRole;
  supportingRoles?: AgentRole[];
  modelTier: ModelTier;
  status: TaskRunStatus;
  estimatedCredits: number;
  actualCredits?: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface DelegationPlan {
  id: string;
  workspaceId: string;
  taskKind: TaskKind;
  ownerRole: AgentRole;
  executorRole: AgentRole;
  reviewerRole?: AgentRole;
  supportingRoles: AgentRole[];
  delegationDepth: number;
  requiresReview: boolean;
  suggestedModelTier: ModelTier;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface TaskOwnershipMetadata {
  planId: string;
  ownerRole: AgentRole;
  executorRole: AgentRole;
  reviewerRole?: AgentRole;
  supportingRoles: AgentRole[];
  delegationDepth: number;
  requiresReview: boolean;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  elasticLanes?: AgentRole[];
  primaryBand?: IntelligenceBand;
}

export interface WorkspaceProfile {
  id: string;
  slug: string;
  name: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface UsageEvent {
  id: string;
  workspaceId: string;
  kind: UsageEventKind;
  taskId?: string;
  taskRunId?: string;
  automationId?: string;
  modelTier?: ModelTier;
  agentRole?: AgentRole;
  source?: CreditSource;
  deltaCredits?: number;
  toolName?: string;
  toolCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export interface PlatformPlan {
  workspaceId: string;
  subscriptionName: string;
  monthlyPriceUsd: number;
  includedCredits: number;
  autoTopUpEnabled: boolean;
  autoTopUpThresholdCredits?: number;
  autoTopUpAmountCredits?: number;
  createdAt: string;
  updatedAt: string;
}

export type BillingPlanId = 'starter' | 'pro' | 'team';

export interface PlanDefinition {
  id: BillingPlanId;
  name: string;
  stripeProductKey: string;
  monthlyPriceUsd: number;
  includedCredits: number;
  maxAutomations: number;
  includedSeats: number;
  extraSeatPriceUsd?: number;
  supportTier: 'email' | 'slack_email' | 'priority';
  supportsMultiAgent: boolean;
  supportsApprovals: boolean;
  supportsSharedWorkspace: boolean;
  supportsLongTermMemory: boolean;
  supportsAnalyticsDashboard: boolean;
  features: string[];
  topUpEnabled: boolean;
}

export interface WorkspaceBillingConfig {
  workspaceId: string;
  planId: BillingPlanId;
  seatCount: number;
  autoTopUpEnabled: boolean;
  autoTopUpThresholdCredits?: number;
  autoTopUpAmountCredits?: number;
  referralCode: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';
  createdAt: string;
  updatedAt: string;
}

export interface TopUpOffer {
  id: string;
  stripeProductKey: string;
  credits: number;
  priceUsd: number;
  bonusCredits?: number;
}
