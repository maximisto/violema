import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Flame,
  Gauge,
  Layers3,
  LineChart,
  Orbit,
  Radar,
  RotateCcw,
  Sparkles,
  Target,
  Workflow,
} from 'lucide-react';
import { formatCredits } from '../lib/credits';
import { resolveWorkspaceContext } from '../lib/workspace';

type WorkflowBlockKind = 'search' | 'query' | 'capture' | 'analyze' | 'summarize' | 'deliver' | 'note';
type ExecutionMode = 'recommended' | 'custom';
type OptimizationGoal = 'balanced' | 'cost_saver' | 'quality_first';
type ReviewPolicy = 'lean' | 'standard' | 'strict';
type StudioRoom = 'live' | 'optimize' | 'replay';
type ScenarioPresetId = 'baseline' | 'rush' | 'deep_research' | 'monitoring' | 'high_stakes';
type TrendMetric = 'credits' | 'duration' | 'success';
type GateLearningWindow = 'recent' | 'deep' | 'all';
type BranchRunFilter = 'all' | 'succeeded' | 'failed';

interface StudioExperimentRecord {
  id: string;
  scenarioId: string;
  previewPresetId: string;
  createdAt: string;
  notes?: string;
  branchName?: string;
  parentExperimentId?: string;
  roleDirectives?: Record<string, StudioRoleDirective>;
}

interface StudioRoleDirective {
  mode: 'cheaper' | 'review' | 'promote';
  phases?: WorkflowBlockKind[];
  updatedAt: string;
}

interface StudioOperatingPlan {
  id: string;
  name: string;
  createdAt: string;
  scenarioId: string;
  previewPresetId: string;
  executionPolicy: AutomationExecutionPolicyDraft;
  roleDirectives?: Record<string, StudioRoleDirective>;
  sourceExperimentId?: string;
  sourceExperimentLabel?: string;
  notes?: string;
}

interface AutomationStudioStateDraft {
  activeRoom?: StudioRoom;
  selectedScenarioId?: string;
  previewPresetId?: string;
  selectedPlanId?: string;
  selectedReplayPhase?: 'all' | WorkflowBlockKind;
  selectedWorkerRole?: string;
  selectedDirectivePhase?: 'all' | WorkflowBlockKind;
  selectedComparisonExperimentId?: string;
  selectedCohortRunId?: string;
  selectedBranchRootId?: string;
  comparedBranchRootId?: string;
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

interface StudioPromotionRecord {
  id: string;
  appliedAt: string;
  mode: 'preset' | 'steering' | 'full' | 'phase' | 'preset_phase' | 'learning';
  summary: string;
  actor: 'manual';
  sourceExperimentId?: string;
  sourceExperimentLabel?: string;
  phase?: WorkflowBlockKind;
}

interface WorkflowBlockDraft {
  id: string;
  kind: WorkflowBlockKind;
  title: string;
  objective: string;
  inputs?: Record<string, unknown>;
  deliveryTarget?: { channel: 'slack' | 'email'; target: string } | null;
}

interface AutomationExecutionPolicyDraft {
  mode: ExecutionMode;
  optimizationGoal: OptimizationGoal;
  reviewPolicy: ReviewPolicy;
  maxElasticLanes: number;
}

interface PlatformTaskRecord {
  id: string;
  title: string;
  description?: string;
  status: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface PlatformTaskRunRecord {
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

interface AutomationApiRecord {
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

interface DashboardTaskStepExecution {
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

interface DashboardWorkerCard {
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

interface DashboardWorkerTopology {
  version: string;
  primaryRole: string;
  primaryBand: string;
  workers: DashboardWorkerCard[];
  summary?: string;
}

interface RunExperimentAttribution {
  experimentId?: string;
  experimentCreatedAt?: string;
  experimentNotes?: string;
  matchedSavedExperiment?: boolean;
  scenarioId?: string;
  scenarioLabel?: string;
  previewPresetId?: string;
  previewPresetLabel?: string;
}

interface RunScenarioTelemetry {
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

interface AgentStudioRow {
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

const VIOLEMA_MARK = '/po-logo.png';

const DEFAULT_EXECUTION_POLICY: AutomationExecutionPolicyDraft = {
  mode: 'recommended',
  optimizationGoal: 'balanced',
  reviewPolicy: 'standard',
  maxElasticLanes: 2,
};

const POLICY_PRESETS: Array<{
  id: string;
  label: string;
  summary: string;
  policy: AutomationExecutionPolicyDraft;
}> = [
  {
    id: 'recommended',
    label: 'System recommended',
    summary: 'Best default. Lets Violema route heavy reasoning only when the run justifies it.',
    policy: { mode: 'recommended', optimizationGoal: 'balanced', reviewPolicy: 'standard', maxElasticLanes: 2 },
  },
  {
    id: 'lean_ops',
    label: 'Lean ops',
    summary: 'Prefer cheaper lanes for operational work, recurring research, and tool-heavy flows.',
    policy: { mode: 'custom', optimizationGoal: 'cost_saver', reviewPolicy: 'lean', maxElasticLanes: 1 },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    summary: 'Good middle ground when the workflow needs some parallelism without over-spending.',
    policy: { mode: 'custom', optimizationGoal: 'balanced', reviewPolicy: 'standard', maxElasticLanes: 2 },
  },
  {
    id: 'high_assurance',
    label: 'High assurance',
    summary: 'Spend more when correctness matters. Better for sensitive reporting and higher-risk outputs.',
    policy: { mode: 'custom', optimizationGoal: 'quality_first', reviewPolicy: 'strict', maxElasticLanes: 3 },
  },
];

const PROMOTION_GATE_PROFILES = [
  { id: 'conservative', label: 'Conservative', global: 85, archetype: 85, scenario: 85, summary: 'Only promote when evidence is very strong.' },
  { id: 'balanced', label: 'Balanced', global: 70, archetype: 70, scenario: 70, summary: 'Good default when you want measured adaptation.' },
  { id: 'aggressive', label: 'Aggressive', global: 55, archetype: 55, scenario: 55, summary: 'Move faster when the goal is rapid iteration.' },
] as const;

const WORKER_DEFINITIONS: Array<{
  role: string;
  label: string;
  laneType: 'core' | 'elastic';
  preferredBand: string;
  modelLabel: string;
  summary: string;
}> = [
  {
    role: 'nexus',
    label: 'Violema Manager',
    laneType: 'core',
    preferredBand: 'default',
    modelLabel: 'Claude Sonnet / orchestration',
    summary: 'Owns decomposition, routing, quality thresholds, and worker handoffs.',
  },
  {
    role: 'researcher',
    label: 'Research Lead',
    laneType: 'core',
    preferredBand: 'default',
    modelLabel: 'Sonnet / Qwen-class reasoning',
    summary: 'Finds external evidence, current sources, and context.',
  },
  {
    role: 'analyst',
    label: 'Analysis Lead',
    laneType: 'core',
    preferredBand: 'hard',
    modelLabel: 'GPT-5.4 / deep reasoning',
    summary: 'Interprets tradeoffs, metrics, and patterns into decisions.',
  },
  {
    role: 'operator',
    label: 'Operations Lead',
    laneType: 'core',
    preferredBand: 'default',
    modelLabel: 'Sonnet / MiniMax hybrid',
    summary: 'Handles tools, delivery, and workflow orchestration.',
  },
  {
    role: 'engineer',
    label: 'Build Lead',
    laneType: 'core',
    preferredBand: 'hard',
    modelLabel: 'GPT-5.4 / implementation',
    summary: 'Takes technical tasks that require structured implementation.',
  },
  {
    role: 'reviewer',
    label: 'Review Lead',
    laneType: 'core',
    preferredBand: 'critical',
    modelLabel: 'Opus / high-assurance review',
    summary: 'Applies final risk checks when a workflow justifies stricter review.',
  },
  {
    role: 'writer',
    label: 'Elastic lane 01',
    laneType: 'elastic',
    preferredBand: 'critical',
    modelLabel: 'Opus / difficult finish work',
    summary: 'Opens for hard synthesis, difficult framing, and polished final output.',
  },
  {
    role: 'scheduler',
    label: 'Elastic lane 02',
    laneType: 'elastic',
    preferredBand: 'hard',
    modelLabel: 'GPT-5.4 / parallel reasoning',
    summary: 'Opens for decomposition, extra reasoning depth, and parallel analysis.',
  },
  {
    role: 'messenger',
    label: 'Elastic lane 03',
    laneType: 'elastic',
    preferredBand: 'micro',
    modelLabel: 'MiniMax / low-cost throughput',
    summary: 'Opens for delivery, operational overflow, and tool-heavy work.',
  },
  {
    role: 'monitor',
    label: 'Elastic lane 04',
    laneType: 'elastic',
    preferredBand: 'micro',
    modelLabel: 'Low-cost memory routing',
    summary: 'Opens for watch conditions, context compaction, and background support.',
  },
];

const SCENARIO_PRESETS: Array<{
  id: ScenarioPresetId;
  label: string;
  summary: string;
  stepMultiplier: number;
  toolMultiplier: number;
  reasoningDelta: number;
}> = [
  {
    id: 'baseline',
    label: 'Current workflow',
    summary: 'Use the workflow exactly as saved right now.',
    stepMultiplier: 1,
    toolMultiplier: 1,
    reasoningDelta: 0,
  },
  {
    id: 'rush',
    label: 'Rush mode',
    summary: 'Shorter turnaround and lighter review pressure.',
    stepMultiplier: 0.85,
    toolMultiplier: 0.85,
    reasoningDelta: -1.1,
  },
  {
    id: 'deep_research',
    label: 'Deep research',
    summary: 'More search, more synthesis, more reasoning weight.',
    stepMultiplier: 1.25,
    toolMultiplier: 1.35,
    reasoningDelta: 1.8,
  },
  {
    id: 'monitoring',
    label: 'Watch loop',
    summary: 'Frequent checks, light reasoning, heavier tool usage.',
    stepMultiplier: 1.1,
    toolMultiplier: 1.45,
    reasoningDelta: -0.6,
  },
  {
    id: 'high_stakes',
    label: 'High stakes',
    summary: 'Higher review pressure and more expensive fallback tolerance.',
    stepMultiplier: 1.15,
    toolMultiplier: 1,
    reasoningDelta: 2.2,
  },
];

const DIRECTIVE_PHASE_OPTIONS: Array<{ value: 'all' | WorkflowBlockKind; label: string }> = [
  { value: 'all', label: 'All phases' },
  { value: 'search', label: 'Search' },
  { value: 'query', label: 'Query' },
  { value: 'capture', label: 'Capture' },
  { value: 'analyze', label: 'Analyze' },
  { value: 'summarize', label: 'Summarize' },
  { value: 'deliver', label: 'Deliver' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatRelativeTimeFromIso(iso?: string) {
  if (!iso) return '—';
  return formatTime(new Date(iso));
}

function formatAutomationRunTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatCompactDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTokenCount(value?: number) {
  if (!value || value <= 0) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `${value}`;
}

function stripMarkdownPreview(value?: string) {
  if (!value) return '';
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatSummaryPreview(value?: string, maxLength = 180) {
  const normalized = stripMarkdownPreview(value);
  if (!normalized) return '';
  return truncateText(normalized, maxLength);
}

function normalizeExecutionPolicy(value: unknown): AutomationExecutionPolicyDraft {
  if (!isRecord(value)) return { ...DEFAULT_EXECUTION_POLICY };
  return {
    mode: value.mode === 'custom' ? 'custom' : 'recommended',
    optimizationGoal:
      value.optimizationGoal === 'cost_saver' || value.optimizationGoal === 'quality_first'
        ? value.optimizationGoal
        : 'balanced',
    reviewPolicy:
      value.reviewPolicy === 'lean' || value.reviewPolicy === 'strict'
        ? value.reviewPolicy
        : 'standard',
    maxElasticLanes:
      typeof value.maxElasticLanes === 'number'
        ? Math.max(0, Math.min(4, Math.trunc(value.maxElasticLanes)))
        : DEFAULT_EXECUTION_POLICY.maxElasticLanes,
  };
}

function parseLegacyActionToWorkflowBlock(action: string): WorkflowBlockDraft {
  const trimmed = action.trim();
  const normalized = trimmed.toLowerCase();
  const id = `step-${Math.random().toString(36).slice(2, 8)}`;

  if (/(summary|digest|report|golden nuggets|briefing|recap)/.test(normalized)) {
    return { id, kind: 'summarize', title: trimmed, objective: trimmed };
  }
  if (/(deliver|send|slack|email|notify|message)/.test(normalized)) {
    return { id, kind: 'deliver', title: trimmed, objective: trimmed };
  }
  if (/(analy[sz]e|diagnos|compare|review|audit)/.test(normalized)) {
    return { id, kind: 'analyze', title: trimmed, objective: trimmed };
  }
  if (/(query|stripe|posthog|github|linear|notion)/.test(normalized)) {
    return { id, kind: 'query', title: trimmed, objective: trimmed };
  }
  if (/(capture|screenshot)/.test(normalized)) {
    return { id, kind: 'capture', title: trimmed, objective: trimmed };
  }
  if (/(search|scan|research|news|look up|find)/.test(normalized)) {
    return { id, kind: 'search', title: trimmed, objective: trimmed };
  }
  return { id, kind: 'note', title: trimmed, objective: trimmed };
}

function buildWorkflowBlocksFromPrompt(prompt?: string) {
  if (!prompt?.trim()) return [];
  return prompt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseLegacyActionToWorkflowBlock(line));
}

function workflowBlockHasContent(block: WorkflowBlockDraft) {
  return Boolean(block.title?.trim() || block.objective?.trim());
}

function countWorkflowToolCalls(steps: WorkflowBlockDraft[]) {
  return steps.filter((step) => ['search', 'query', 'capture', 'deliver'].includes(step.kind)).length;
}

function estimateRecommendedElasticLanes(steps: WorkflowBlockDraft[]) {
  const weightedStepCount = steps.reduce((total, step) => {
    if (step.kind === 'analyze' || step.kind === 'capture') return total + 2;
    return total + 1;
  }, 0);
  if (weightedStepCount >= 8) return 3;
  if (weightedStepCount >= 5) return 2;
  return 1;
}

function inferExecutionPolicyMath(policy: AutomationExecutionPolicyDraft, steps: WorkflowBlockDraft[]) {
  const workflowSteps = steps.filter((step) => workflowBlockHasContent(step));
  const stepCount = workflowSteps.length;
  const toolCalls = countWorkflowToolCalls(workflowSteps);
  const recommendedElasticLanes = estimateRecommendedElasticLanes(workflowSteps);
  const activeElasticLanes = policy.mode === 'recommended'
    ? recommendedElasticLanes
    : Math.min(policy.maxElasticLanes, recommendedElasticLanes);
  const reasoningLoad =
    stepCount * 1.15 +
    toolCalls * 0.85 +
    (workflowSteps.some((step) => step.kind === 'analyze') ? 1.75 : 0) +
    (workflowSteps.some((step) => step.kind === 'summarize') ? 0.9 : 0);
  const estimatedBands =
    policy.mode === 'recommended'
      ? 'Auto'
      : policy.optimizationGoal === 'cost_saver'
        ? 'Bias lower'
        : policy.optimizationGoal === 'quality_first'
          ? 'Bias higher'
          : 'Balanced';

  return {
    stepCount,
    toolCalls,
    reasoningLoad: reasoningLoad.toFixed(1),
    recommendedElasticLanes,
    activeElasticLanes,
    estimatedBands,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimatePolicySpendIndex(policy: AutomationExecutionPolicyDraft, steps: WorkflowBlockDraft[]) {
  const math = inferExecutionPolicyMath(policy, steps);
  let score =
    math.stepCount * 7 +
    math.toolCalls * 11 +
    Number(math.reasoningLoad) * 4 +
    math.activeElasticLanes * 9;

  if (policy.mode === 'recommended') score += 6;
  if (policy.optimizationGoal === 'cost_saver') score -= 16;
  if (policy.optimizationGoal === 'quality_first') score += 14;
  if (policy.reviewPolicy === 'lean') score -= 8;
  if (policy.reviewPolicy === 'strict') score += 12;

  return clampNumber(Math.round(score), 15, 95);
}

function estimatePolicyAssuranceIndex(policy: AutomationExecutionPolicyDraft, steps: WorkflowBlockDraft[]) {
  const math = inferExecutionPolicyMath(policy, steps);
  let score =
    math.stepCount * 5 +
    Number(math.reasoningLoad) * 6 +
    math.activeElasticLanes * 7;

  if (policy.mode === 'recommended') score += 8;
  if (policy.optimizationGoal === 'cost_saver') score -= 12;
  if (policy.optimizationGoal === 'quality_first') score += 18;
  if (policy.reviewPolicy === 'lean') score -= 10;
  if (policy.reviewPolicy === 'strict') score += 16;

  return clampNumber(Math.round(score), 20, 98);
}

function estimatePolicyFitIndex(policy: AutomationExecutionPolicyDraft, steps: WorkflowBlockDraft[]) {
  const math = inferExecutionPolicyMath(policy, steps);
  let score = 74 - Math.abs(math.activeElasticLanes - math.recommendedElasticLanes) * 12;

  if (policy.optimizationGoal === 'cost_saver' && math.toolCalls >= 2) score += 8;
  if (policy.optimizationGoal === 'quality_first' && steps.some((step) => step.kind === 'analyze' || step.kind === 'summarize')) score += 10;
  if (policy.reviewPolicy === 'strict' && steps.some((step) => step.kind === 'analyze')) score += 6;
  if (policy.reviewPolicy === 'strict' && math.stepCount <= 2 && math.toolCalls <= 1) score -= 8;
  if (policy.reviewPolicy === 'lean' && steps.some((step) => step.kind === 'deliver')) score += 5;

  return clampNumber(Math.round(score), 25, 96);
}

function readStepExecutions(value: unknown): DashboardTaskStepExecution[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const stepId = readString(item.stepId);
      const kind = readString(item.kind);
      const title = readString(item.title);
      const assignedRole = readString(item.assignedRole);
      const status = readString(item.status);
      if (!stepId || !kind || !title || !assignedRole || !status) return null;
      return {
        stepId,
        kind,
        title,
        assignedRole,
        status,
        summary: readString(item.summary),
        error: readString(item.error),
        startedAt: readString(item.startedAt),
        finishedAt: readString(item.finishedAt),
        modelTier: readString(item.modelTier),
        directiveMode: item.directiveMode === 'cheaper' || item.directiveMode === 'review' || item.directiveMode === 'promote' ? item.directiveMode : undefined,
        directivePhases: normalizeDirectivePhases(item.directivePhases),
        modelSource: readString(item.modelSourceLabel) || readString(item.modelSource),
        actualCredits: typeof item.actualCredits === 'number' ? item.actualCredits : undefined,
        toolCalls: typeof item.toolCalls === 'number' ? item.toolCalls : undefined,
        durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
        tokenUsage: isRecord(item.tokenUsage) ? {
          totalTokens: typeof item.tokenUsage.totalTokens === 'number' ? item.tokenUsage.totalTokens : undefined,
        } : undefined,
      } as DashboardTaskStepExecution;
    })
    .filter((item): item is DashboardTaskStepExecution => Boolean(item));
}

function readWorkerTopology(value: unknown): DashboardWorkerTopology | undefined {
  if (!isRecord(value)) return undefined;
  const version = readString(value.version);
  const primaryRole = readString(value.primaryRole);
  const primaryBand = readString(value.primaryBand);
  if (!version || !primaryRole || !primaryBand) return undefined;
  const workers = Array.isArray(value.workers)
    ? value.workers
        .map((item) => {
          if (!isRecord(item)) return null;
          const role = readString(item.role);
          const label = readString(item.label);
          const laneType = readString(item.laneType);
          const assignedRole = readString(item.assignedRole);
          const band = readString(item.band);
          const modelLabel = readString(item.modelLabel);
          const status = readString(item.status);
          const summary = readString(item.summary);
          const reason = readString(item.reason);
          if (
            !role ||
            !label ||
            (laneType !== 'core' && laneType !== 'elastic') ||
            !assignedRole ||
            !band ||
            !modelLabel ||
            (status !== 'active' && status !== 'standby') ||
            !summary ||
            !reason
          ) {
            return null;
          }
          return { role, label, laneType, assignedRole, band, modelLabel, status, summary, reason } as DashboardWorkerCard;
        })
        .filter((item): item is DashboardWorkerCard => Boolean(item))
    : [];

  return {
    version,
    primaryRole,
    primaryBand,
    workers,
    summary: readString(value.summary),
  };
}

function getTaskAutomationId(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return readString(run?.metadata?.automationId) || readString(task?.metadata?.automationId);
}

function getTaskModelSource(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return (
    readString(run?.metadata?.modelSourceLabel) ||
    readString(run?.metadata?.modelSource) ||
    readString(task?.metadata?.modelSourceLabel) ||
    readString(task?.metadata?.modelSource)
  );
}

function getStatusTone(status: string) {
  if (status === 'failed' || status === 'alert' || status === 'paused') return 'border-red-500/18 bg-red-500/8 text-red-200';
  if (status === 'succeeded' || status === 'complete' || status === 'completed') return 'border-green-500/18 bg-green-500/8 text-green-200';
  if (status === 'running') return 'border-cyan-500/18 bg-cyan-500/8 text-cyan-200';
  return 'border-violet-500/18 bg-violet-500/8 text-violet-200';
}

function getExecutionModeLabel(value: ExecutionMode) {
  return value === 'custom' ? 'Custom policy' : 'System recommended';
}

function getOptimizationGoalLabel(value: OptimizationGoal) {
  if (value === 'cost_saver') return 'Cost Saver';
  if (value === 'quality_first') return 'Quality First';
  return 'Balanced';
}

function getReviewPolicyLabel(value: ReviewPolicy) {
  if (value === 'lean') return 'Lean review';
  if (value === 'strict') return 'Strict review';
  return 'Standard review';
}

function formatSignedDelta(value: number) {
  if (value === 0) return 'No change';
  return `${value > 0 ? '+' : ''}${value}`;
}

function getScenarioPreset(id: ScenarioPresetId) {
  return SCENARIO_PRESETS.find((scenario) => scenario.id === id) || SCENARIO_PRESETS[0];
}

function getRunStudioState(run?: PlatformTaskRunRecord) {
  return normalizeStudioState(run?.metadata?.studioState);
}

function getScenarioLabelFromId(id?: string) {
  if (!id) return 'Baseline';
  return getScenarioPreset(id as ScenarioPresetId).label;
}

function getPresetLabelFromId(id?: string) {
  if (!id) return 'System recommended';
  return POLICY_PRESETS.find((preset) => preset.id === id)?.label || id;
}

function getExperimentDisplayLabel(experiment: StudioExperimentRecord) {
  return experiment.branchName || experiment.notes || `${getScenarioLabelFromId(experiment.scenarioId)} · ${getPresetLabelFromId(experiment.previewPresetId)}`;
}

function getExperimentRootId(experiment: StudioExperimentRecord, experiments: StudioExperimentRecord[]) {
  const byId = new Map(experiments.map((item) => [item.id, item] as const));
  let current: StudioExperimentRecord | undefined = experiment;
  const visited = new Set<string>();

  while (current?.parentExperimentId && !visited.has(current.parentExperimentId)) {
    visited.add(current.id);
    const parent = byId.get(current.parentExperimentId);
    if (!parent) break;
    current = parent;
  }

  return current?.id || experiment.id;
}

function getExperimentPhaseList(experiment: StudioExperimentRecord) {
  const phases = Object.values(experiment.roleDirectives || {}).flatMap((directive) => directive.phases || []);
  return [...new Set(phases)];
}

function extractPhaseDirectiveSnapshot(
  roleDirectives: Record<string, StudioRoleDirective> | undefined,
  phase: WorkflowBlockKind,
) {
  if (!roleDirectives) return undefined;
  const next = Object.entries(roleDirectives).reduce<Record<string, StudioRoleDirective>>((acc, [role, directive]) => {
    if (!directive.phases || directive.phases.length === 0 || directive.phases.includes(phase)) {
      acc[role] = {
        mode: directive.mode,
        phases: [phase],
        updatedAt: new Date().toISOString(),
      };
    }
    return acc;
  }, {});
  return Object.keys(next).length > 0 ? next : undefined;
}

function getTrendMetricLabel(metric: TrendMetric) {
  if (metric === 'duration') return 'Duration';
  if (metric === 'success') return 'Success';
  return 'Credits';
}

function getTrendMetricValue(run: PlatformTaskRunRecord, metric: TrendMetric) {
  if (metric === 'success') return run.status === 'succeeded' ? 100 : run.status === 'failed' ? 24 : 56;
  if (metric === 'duration') {
    const started = Date.parse(run.startedAt || '');
    const finished = Date.parse(run.finishedAt || '');
    return Number.isNaN(started) || Number.isNaN(finished) ? 0 : Math.max(0, finished - started) / 1000;
  }
  return run.actualCredits || 0;
}

function formatTrendMetricValue(run: PlatformTaskRunRecord, metric: TrendMetric) {
  if (metric === 'success') return run.status === 'succeeded' ? 'Pass' : run.status === 'failed' ? 'Fail' : 'Live';
  if (metric === 'duration') return formatCompactDuration(
    Number.isNaN(Date.parse(run.startedAt || '')) || Number.isNaN(Date.parse(run.finishedAt || ''))
      ? undefined
      : Math.max(0, Date.parse(run.finishedAt || '') - Date.parse(run.startedAt || ''))
  );
  return run.actualCredits ? `${formatCredits(run.actualCredits)} cr` : '—';
}

function getExperimentTags(
  experiment: StudioExperimentRecord,
  stats?: { count: number; successRate: number; averageCredits: number },
  winning = false,
) {
  const tags = [getScenarioLabelFromId(experiment.scenarioId), getPresetLabelFromId(experiment.previewPresetId)];
  const directiveCount = Object.keys(experiment.roleDirectives || {}).length;
  if (directiveCount > 0) tags.push(`${directiveCount} directed role${directiveCount === 1 ? '' : 's'}`);
  if (winning) tags.push('Winning setup');
  if ((stats?.count || 0) >= 3) tags.push('Observed');
  if ((stats?.successRate || 0) >= 0.8 && (stats?.count || 0) >= 2) tags.push('Reliable');
  if ((stats?.averageCredits || 0) > 0 && (stats?.averageCredits || 0) <= 45) tags.push('Lean spend');
  return tags.slice(0, 4);
}

function normalizeDirectivePhases(value: unknown): WorkflowBlockKind[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const phases = value
    .filter((phase): phase is WorkflowBlockKind => (
      phase === 'search' ||
      phase === 'query' ||
      phase === 'capture' ||
      phase === 'analyze' ||
      phase === 'summarize' ||
      phase === 'deliver' ||
      phase === 'note'
    ));
  return phases.length > 0 ? [...new Set(phases)] : undefined;
}

function formatDirectivePhaseScope(phases?: WorkflowBlockKind[]) {
  if (!phases || phases.length === 0) return 'All phases';
  if (phases.length === 1) return `${phases[0][0].toUpperCase()}${phases[0].slice(1)} only`;
  return phases.map((phase) => `${phase[0].toUpperCase()}${phase.slice(1)}`).join(' + ');
}

function formatDirectivePhaseShort(phase: WorkflowBlockKind) {
  switch (phase) {
    case 'search': return 'S';
    case 'query': return 'Q';
    case 'capture': return 'C';
    case 'analyze': return 'A';
    case 'summarize': return 'Sum';
    case 'deliver': return 'D';
    case 'note': return 'N';
    default: return '';
  }
}

function getPreferredRoleForPhase(phase: WorkflowBlockKind) {
  switch (phase) {
    case 'search':
    case 'query':
    case 'capture':
      return 'researcher';
    case 'analyze':
      return 'analyst';
    case 'summarize':
      return 'reviewer';
    case 'deliver':
    case 'note':
    default:
      return 'operator';
  }
}

function matchesExperimentRun(run: PlatformTaskRunRecord, experiment: StudioExperimentRecord) {
  const attribution = getRunExperimentAttribution(run);
  if (attribution.experimentId) return attribution.experimentId === experiment.id;
  return attribution.scenarioId === experiment.scenarioId && attribution.previewPresetId === experiment.previewPresetId;
}

function summarizeRunCollection(runs: PlatformTaskRunRecord[]) {
  if (runs.length === 0) {
    return {
      count: 0,
      successRate: 0,
      averageCredits: 0,
      averageDurationMs: 0,
      latestStatus: undefined as string | undefined,
    };
  }
  const succeeded = runs.filter((run) => run.status === 'succeeded').length;
  const totalCredits = runs.reduce((sum, run) => sum + (run.actualCredits || 0), 0);
  const totalDuration = runs.reduce((sum, run) => {
    const started = Date.parse(run.startedAt || '');
    const finished = Date.parse(run.finishedAt || '');
    return sum + (Number.isNaN(started) || Number.isNaN(finished) ? 0 : Math.max(0, finished - started));
  }, 0);
  return {
    count: runs.length,
    successRate: succeeded / runs.length,
    averageCredits: totalCredits / runs.length,
    averageDurationMs: totalDuration / runs.length,
    latestStatus: runs[0]?.status,
  };
}

function scoreObservedPerformance(
  stats: ReturnType<typeof summarizeRunCollection>,
  latestAt?: string,
) {
  const confidence = clampNumber(Math.round((Math.min(stats.count, 12) / 12) * 100), 8, 100);
  const latestTime = latestAt ? Date.parse(latestAt) : Number.NaN;
  const recencyDays = Number.isNaN(latestTime) ? 30 : Math.max(0, (Date.now() - latestTime) / 86400000);
  const recencyBoost = clampNumber(Math.round(18 - recencyDays), 0, 18);
  const score = clampNumber(
    Math.round(
      stats.successRate * 72 +
      confidence * 0.18 +
      recencyBoost * 0.1 -
      stats.averageCredits / 4 -
      stats.averageDurationMs / 20000
    ),
    0,
    99,
  );

  return { score, confidence, recencyBoost };
}

function countDirectiveEntries(roleDirectives?: Record<string, StudioRoleDirective>) {
  return Object.values(roleDirectives || {}).reduce((sum, directive) => sum + (directive.phases?.length || 1), 0);
}

function cloneRoleDirectives(roleDirectives?: Record<string, StudioRoleDirective>) {
  if (!roleDirectives) return undefined;
  return Object.entries(roleDirectives).reduce<Record<string, StudioRoleDirective>>((acc, [role, directive]) => {
    acc[role] = {
      mode: directive.mode,
      phases: directive.phases ? [...directive.phases] : undefined,
      updatedAt: directive.updatedAt,
    };
    return acc;
  }, {});
}

function clonePromotionHistory(history?: StudioPromotionRecord[]) {
  if (!history) return undefined;
  return history.map((entry) => ({ ...entry }));
}

function cloneOperatingPlans(plans?: StudioOperatingPlan[]) {
  if (!plans) return undefined;
  return plans.map((plan) => ({
    ...plan,
    executionPolicy: { ...plan.executionPolicy },
    roleDirectives: cloneRoleDirectives(plan.roleDirectives),
  }));
}

function appendPromotionHistory(
  history: StudioPromotionRecord[] | undefined,
  entry: Omit<StudioPromotionRecord, 'id' | 'appliedAt' | 'actor'>,
) {
  return [
    {
      id: `promo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      appliedAt: new Date().toISOString(),
      actor: 'manual' as const,
      ...entry,
    },
    ...(clonePromotionHistory(history) || []),
  ].slice(0, 14);
}

function buildBranchName(sourceLabel: string, index: number) {
  return `${sourceLabel} branch ${index}`;
}

function getPromotionGateProfileById(id?: string) {
  return PROMOTION_GATE_PROFILES.find((profile) => profile.id === id);
}

function getEffectiveAutoPromotionThreshold(
  studioState: AutomationStudioStateDraft | undefined,
  scenarioId: string,
  archetypeId: string,
) {
  const scenarioThreshold = studioState?.autoPromotionScenarioThresholds?.[scenarioId];
  if (typeof scenarioThreshold === 'number') return scenarioThreshold;
  const archetypeThreshold = studioState?.autoPromotionArchetypeThresholds?.[archetypeId];
  if (typeof archetypeThreshold === 'number') return archetypeThreshold;
  return studioState?.autoPromotionMinConfidence ?? 55;
}

function inferPromotionGateProfileId(
  studioState: AutomationStudioStateDraft | undefined,
  scenarioId: string,
  archetypeId: string,
) {
  const threshold = getEffectiveAutoPromotionThreshold(studioState, scenarioId, archetypeId);
  return PROMOTION_GATE_PROFILES
    .map((profile) => ({
      profile,
      delta:
        Math.abs(profile.global - threshold) +
        Math.abs(profile.archetype - threshold) * 0.6 +
        Math.abs(profile.scenario - threshold) * 0.9,
    }))
    .sort((left, right) => left.delta - right.delta)[0]?.profile.id || 'balanced';
}

function normalizeThresholdMap(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const next = Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, raw]) => {
    if (typeof raw !== 'number') return acc;
    acc[key] = clampNumber(Math.round(raw), 40, 95);
    return acc;
  }, {});
  return Object.keys(next).length > 0 ? next : undefined;
}

function omitThresholdKey(map: Record<string, number> | undefined, key: string) {
  if (!map) return undefined;
  const next = { ...map };
  delete next[key];
  return Object.keys(next).length > 0 ? next : undefined;
}

function mergeRoleDirectiveSnapshots(
  base?: Record<string, StudioRoleDirective>,
  incoming?: Record<string, StudioRoleDirective>
) {
  return {
    ...(cloneRoleDirectives(base) || {}),
    ...(cloneRoleDirectives(incoming) || {}),
  };
}

function buildPhaseActivitySeries(runs: PlatformTaskRunRecord[], role: string) {
  const relevantRuns = runs.filter((run) => run.status === 'succeeded' || run.status === 'failed').slice(0, 8).reverse();
  const phaseOrder: WorkflowBlockKind[] = ['search', 'query', 'capture', 'analyze', 'summarize', 'deliver'];
  const series = relevantRuns.map((run, index) => {
    const stepExecutions = readStepExecutions(run.metadata?.stepExecutions).filter((step) => step.assignedRole === role);
    const phases = phaseOrder.map((phase) => {
      const phaseSteps = stepExecutions.filter((step) => step.kind === phase);
      const credits = phaseSteps.reduce((sum, step) => sum + (step.actualCredits || 0), 0);
      return {
        phase,
        count: phaseSteps.length,
        failed: phaseSteps.some((step) => step.status === 'failed'),
        succeeded: phaseSteps.some((step) => step.status === 'succeeded'),
        credits,
      };
    }).filter((phase) => phase.count > 0);
    return {
      id: run.id,
      label: `R${index + 1}`,
      phases,
    };
  });
  return series;
}

function buildTrendSeries(
  runs: PlatformTaskRunRecord[],
  metric: TrendMetric,
  width = 320,
  height = 130,
  maxPoints = 8,
) {
  const ordered = runs.slice(0, maxPoints).reverse();
  if (ordered.length === 0) return null;
  const paddingX = 18;
  const paddingY = 14;
  const values = ordered.map((run) => getTrendMetricValue(run, metric));
  const minValue = metric === 'success' ? 0 : Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const range = Math.max(maxValue - minValue, 1);

  const points = ordered.map((run, index) => {
    const ratio = ordered.length === 1 ? 0.5 : index / (ordered.length - 1);
    const x = paddingX + ratio * (width - paddingX * 2);
    const y = height - paddingY - (((getTrendMetricValue(run, metric) - minValue) / range) * (height - paddingY * 2));
    return {
      run,
      x,
      y,
      label: ordered.length === 1 ? 'Latest' : `R${index + 1}`,
      metricLabel: formatTrendMetricValue(run, metric),
    };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return { width, height, points, linePath, areaPath, minValue, maxValue };
}

function getDirectiveModeLabel(mode: 'cheaper' | 'review' | 'promote') {
  if (mode === 'cheaper') return 'Cheaper bias';
  if (mode === 'review') return 'Review bias';
  return 'Promoted lane';
}

function getPromotionModeLabel(mode: StudioPromotionRecord['mode']) {
  switch (mode) {
    case 'preset':
      return 'Preset promoted';
    case 'steering':
      return 'Steering promoted';
    case 'full':
      return 'Full setup promoted';
    case 'phase':
      return 'Phase promoted';
    case 'preset_phase':
      return 'Preset + phase promoted';
    case 'learning':
    default:
      return 'Learning action';
  }
}

function getPromotionModeTone(mode: StudioPromotionRecord['mode']) {
  switch (mode) {
    case 'full':
    case 'preset_phase':
      return 'border-emerald-500/18 bg-emerald-500/8 text-emerald-100';
    case 'preset':
    case 'phase':
      return 'border-cyan-500/18 bg-cyan-500/8 text-cyan-100';
    case 'steering':
      return 'border-violet-500/18 bg-violet-500/8 text-violet-100';
    case 'learning':
    default:
      return 'border-amber-500/18 bg-amber-500/8 text-amber-100';
  }
}

function getDirectiveActionLabel(mode: 'cheaper' | 'review' | 'promote') {
  if (mode === 'cheaper') return 'Promote steering only';
  if (mode === 'review') return 'Promote steering only';
  return 'Promote steering only';
}

function getRunExperimentAttribution(run?: PlatformTaskRunRecord): RunExperimentAttribution {
  const raw = isRecord(run?.metadata?.experimentAttribution) ? run?.metadata?.experimentAttribution : undefined;
  const fallbackStudioState = getRunStudioState(run);
  const scenarioId = readString(raw?.scenarioId) || fallbackStudioState.selectedScenarioId || 'baseline';
  const previewPresetId = readString(raw?.previewPresetId) || fallbackStudioState.previewPresetId || 'recommended';
  return {
    experimentId: readString(raw?.experimentId),
    experimentCreatedAt: readString(raw?.experimentCreatedAt),
    experimentNotes: readString(raw?.experimentNotes),
    matchedSavedExperiment: raw?.matchedSavedExperiment === true,
    scenarioId,
    scenarioLabel: readString(raw?.scenarioLabel) || getScenarioLabelFromId(scenarioId),
    previewPresetId,
    previewPresetLabel: readString(raw?.previewPresetLabel) || getPresetLabelFromId(previewPresetId),
  };
}

function getRunScenarioTelemetry(run?: PlatformTaskRunRecord): RunScenarioTelemetry {
  const raw = isRecord(run?.metadata?.scenarioTelemetry) ? run?.metadata?.scenarioTelemetry : undefined;
  const attribution = getRunExperimentAttribution(run);
  const directedRoles = Array.isArray(raw?.directedRoles)
    ? raw.directedRoles
        .map((item) => {
          if (!isRecord(item)) return null;
          const role = readString(item.role);
          if (!role) return null;
          const mode = item.mode === 'cheaper' || item.mode === 'review' || item.mode === 'promote' ? item.mode : undefined;
          if (!mode) return null;
          return {
            role,
            mode: mode as 'cheaper' | 'review' | 'promote',
            phases: normalizeDirectivePhases(item.phases),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  return {
    scenarioId: readString(raw?.scenarioId) || attribution.scenarioId,
    scenarioLabel: readString(raw?.scenarioLabel) || attribution.scenarioLabel,
    previewPresetId: readString(raw?.previewPresetId) || attribution.previewPresetId,
    previewPresetLabel: readString(raw?.previewPresetLabel) || attribution.previewPresetLabel,
    matchedSavedExperiment: raw?.matchedSavedExperiment === true || attribution.matchedSavedExperiment,
    experimentId: readString(raw?.experimentId) || attribution.experimentId,
    workflowStepCount: typeof raw?.workflowStepCount === 'number' ? raw.workflowStepCount : undefined,
    estimatedToolCalls: typeof raw?.estimatedToolCalls === 'number' ? raw.estimatedToolCalls : undefined,
    complexity: readString(raw?.complexity),
    directedRoles,
  };
}

function buildRadarPolygon(values: number[], radius: number, cx: number, cy: number) {
  return values
    .map((value, index) => {
      const angle = (-Math.PI / 2) + (index / values.length) * Math.PI * 2;
      const scaled = (Math.max(0, Math.min(100, value)) / 100) * radius;
      const x = cx + Math.cos(angle) * scaled;
      const y = cy + Math.sin(angle) * scaled;
      return `${x},${y}`;
    })
    .join(' ');
}

function simulateScenarioMath(
  base: ReturnType<typeof inferExecutionPolicyMath>,
  scenario: (typeof SCENARIO_PRESETS)[number]
) {
  const stepCount = Math.max(1, Math.round(base.stepCount * scenario.stepMultiplier));
  const toolCalls = Math.max(0, Math.round(base.toolCalls * scenario.toolMultiplier));
  const reasoningLoad = Math.max(0.5, Number(base.reasoningLoad) + scenario.reasoningDelta);
  const recommendedElasticLanes = stepCount >= 8 || reasoningLoad >= 8 ? 3 : stepCount >= 5 || toolCalls >= 3 ? 2 : 1;
  return {
    stepCount,
    toolCalls,
    reasoningLoad: reasoningLoad.toFixed(1),
    recommendedElasticLanes,
  };
}

function classifyWorkflowArchetype(steps: WorkflowBlockDraft[]) {
  const kinds = new Set(steps.filter((step) => workflowBlockHasContent(step)).map((step) => step.kind));
  if (kinds.has('deliver') && (kinds.has('search') || kinds.has('query'))) {
    return {
      id: 'briefing',
      label: 'Briefing and delivery',
      summary: 'Research-heavy workflows that need a polished output and a final delivery step.',
    };
  }
  if (kinds.has('search') || kinds.has('query')) {
    return {
      id: 'research',
      label: 'Research and monitoring',
      summary: 'Source gathering, scanning, and current-state intelligence work.',
    };
  }
  if (kinds.has('capture') || kinds.has('analyze')) {
    return {
      id: 'analysis',
      label: 'Analysis and diagnosis',
      summary: 'Workflows that turn findings into decisions, comparisons, or technical diagnosis.',
    };
  }
  if (kinds.has('deliver')) {
    return {
      id: 'ops',
      label: 'Ops and follow-through',
      summary: 'Operational loops focused on delivery, alerts, and recurring follow-through.',
    };
  }
  return {
    id: 'general',
    label: 'General execution',
    summary: 'Mixed workflow with a blend of reasoning, coordination, and output generation.',
  };
}

function normalizeStudioState(value: unknown): AutomationStudioStateDraft {
  if (!isRecord(value)) return {};
  const savedPlans = Array.isArray(value.savedPlans)
    ? value.savedPlans
        .map((item) => {
          if (!isRecord(item)) return null;
          const id = readString(item.id);
          const name = readString(item.name);
          const createdAt = readString(item.createdAt);
          const scenarioId = readString(item.scenarioId);
          const previewPresetId = readString(item.previewPresetId);
          if (!id || !name || !createdAt || !scenarioId || !previewPresetId) return null;
          const plan: StudioOperatingPlan = {
            id,
            name,
            createdAt,
            scenarioId,
            previewPresetId,
            executionPolicy: normalizeExecutionPolicy(item.executionPolicy),
            roleDirectives: isRecord(item.roleDirectives)
              ? Object.entries(item.roleDirectives).reduce<Record<string, StudioRoleDirective>>((directiveAcc, [role, directive]) => {
                  if (!isRecord(directive)) return directiveAcc;
                  if (directive.mode !== 'cheaper' && directive.mode !== 'review' && directive.mode !== 'promote') return directiveAcc;
                  const updatedAt = readString(directive.updatedAt);
                  if (!updatedAt) return directiveAcc;
                  directiveAcc[role] = { mode: directive.mode, phases: normalizeDirectivePhases(directive.phases), updatedAt };
                  return directiveAcc;
                }, {})
              : undefined,
            sourceExperimentId: readString(item.sourceExperimentId),
            sourceExperimentLabel: readString(item.sourceExperimentLabel),
            notes: readString(item.notes),
          };
          return plan;
        })
        .filter((item): item is StudioOperatingPlan => Boolean(item))
    : undefined;

  const experimentHistory = Array.isArray(value.experimentHistory)
    ? value.experimentHistory
        .map((item) => {
          if (!isRecord(item)) return null;
          const id = readString(item.id);
          const scenarioId = readString(item.scenarioId);
          const previewPresetId = readString(item.previewPresetId);
          const createdAt = readString(item.createdAt);
          if (!id || !scenarioId || !previewPresetId || !createdAt) return null;
          return {
            id,
            scenarioId,
            previewPresetId,
            createdAt,
            notes: readString(item.notes),
            branchName: readString(item.branchName),
            parentExperimentId: readString(item.parentExperimentId),
            roleDirectives: isRecord(item.roleDirectives)
              ? Object.entries(item.roleDirectives).reduce<Record<string, StudioRoleDirective>>((directiveAcc, [role, directive]) => {
                  if (!isRecord(directive)) return directiveAcc;
                  if (directive.mode !== 'cheaper' && directive.mode !== 'review' && directive.mode !== 'promote') return directiveAcc;
                  const updatedAt = readString(directive.updatedAt);
                  if (!updatedAt) return directiveAcc;
                  directiveAcc[role] = { mode: directive.mode, phases: normalizeDirectivePhases(directive.phases), updatedAt };
                  return directiveAcc;
                }, {})
              : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  const promotionHistory = Array.isArray(value.promotionHistory)
    ? value.promotionHistory
        .map((item) => {
          if (!isRecord(item)) return null;
          const id = readString(item.id);
          const appliedAt = readString(item.appliedAt);
          const summary = readString(item.summary);
          const actor = readString(item.actor);
          const mode = readString(item.mode);
          if (
            !id ||
            !appliedAt ||
            !summary ||
            actor !== 'manual' ||
            !mode ||
            !['preset', 'steering', 'full', 'phase', 'preset_phase', 'learning'].includes(mode)
          ) {
            return null;
          }
          const phaseValue = readString(item.phase);
          return {
            id,
            appliedAt,
            summary,
            actor: 'manual' as const,
            mode: mode as StudioPromotionRecord['mode'],
            sourceExperimentId: readString(item.sourceExperimentId),
            sourceExperimentLabel: readString(item.sourceExperimentLabel),
            phase: phaseValue && ['search', 'query', 'capture', 'analyze', 'summarize', 'deliver', 'note'].includes(phaseValue)
              ? phaseValue as WorkflowBlockKind
              : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  const roleDirectives = isRecord(value.roleDirectives)
    ? Object.entries(value.roleDirectives).reduce<Record<string, StudioRoleDirective>>((acc, [role, directive]) => {
        if (!isRecord(directive)) return acc;
        if (directive.mode !== 'cheaper' && directive.mode !== 'review' && directive.mode !== 'promote') return acc;
        const updatedAt = readString(directive.updatedAt);
        if (!updatedAt) return acc;
        acc[role] = { mode: directive.mode, phases: normalizeDirectivePhases(directive.phases), updatedAt };
        return acc;
      }, {})
    : undefined;

  return {
    activeRoom: value.activeRoom === 'live' || value.activeRoom === 'optimize' || value.activeRoom === 'replay'
      ? value.activeRoom
      : undefined,
    selectedScenarioId: readString(value.selectedScenarioId),
    previewPresetId: readString(value.previewPresetId),
    selectedPlanId: readString(value.selectedPlanId),
    selectedReplayPhase:
      value.selectedReplayPhase === 'all' ||
      value.selectedReplayPhase === 'search' ||
      value.selectedReplayPhase === 'query' ||
      value.selectedReplayPhase === 'capture' ||
      value.selectedReplayPhase === 'analyze' ||
      value.selectedReplayPhase === 'summarize' ||
      value.selectedReplayPhase === 'deliver' ||
      value.selectedReplayPhase === 'note'
        ? value.selectedReplayPhase
        : undefined,
    selectedWorkerRole: readString(value.selectedWorkerRole),
    selectedDirectivePhase:
      value.selectedDirectivePhase === 'all' ||
      value.selectedDirectivePhase === 'search' ||
      value.selectedDirectivePhase === 'query' ||
      value.selectedDirectivePhase === 'capture' ||
      value.selectedDirectivePhase === 'analyze' ||
      value.selectedDirectivePhase === 'summarize' ||
      value.selectedDirectivePhase === 'deliver' ||
      value.selectedDirectivePhase === 'note'
        ? value.selectedDirectivePhase
        : undefined,
    selectedComparisonExperimentId: readString(value.selectedComparisonExperimentId),
    selectedCohortRunId: readString(value.selectedCohortRunId),
    selectedBranchRootId: readString(value.selectedBranchRootId),
    comparedBranchRootId: readString(value.comparedBranchRootId),
    trendMetric:
      value.trendMetric === 'credits' || value.trendMetric === 'duration' || value.trendMetric === 'success'
        ? value.trendMetric
        : undefined,
    gateLearningWindow:
      value.gateLearningWindow === 'recent' || value.gateLearningWindow === 'deep' || value.gateLearningWindow === 'all'
        ? value.gateLearningWindow
        : undefined,
    branchRunFilter:
      value.branchRunFilter === 'all' || value.branchRunFilter === 'succeeded' || value.branchRunFilter === 'failed'
        ? value.branchRunFilter
        : undefined,
    phaseSimulation:
      isRecord(value.phaseSimulation) &&
      (value.phaseSimulation.phase === 'search' ||
        value.phaseSimulation.phase === 'query' ||
        value.phaseSimulation.phase === 'capture' ||
        value.phaseSimulation.phase === 'analyze' ||
        value.phaseSimulation.phase === 'summarize' ||
        value.phaseSimulation.phase === 'deliver' ||
        value.phaseSimulation.phase === 'note') &&
      (value.phaseSimulation.mode === 'cheaper' || value.phaseSimulation.mode === 'review' || value.phaseSimulation.mode === 'promote')
        ? { phase: value.phaseSimulation.phase, mode: value.phaseSimulation.mode }
        : undefined,
    experimentHistory,
    roleDirectives,
    promotionHistory,
    autoPromotionMinConfidence:
      typeof value.autoPromotionMinConfidence === 'number'
        ? clampNumber(Math.round(value.autoPromotionMinConfidence), 40, 95)
        : undefined,
    autoPromotionScenarioThresholds: normalizeThresholdMap(value.autoPromotionScenarioThresholds),
    autoPromotionArchetypeThresholds: normalizeThresholdMap(value.autoPromotionArchetypeThresholds),
    savedPlans,
  };
}

function deriveFallbackWorkerTopology(steps: WorkflowBlockDraft[], policy: AutomationExecutionPolicyDraft): DashboardWorkerTopology {
  const math = inferExecutionPolicyMath(policy, steps);
  const activeRoles = new Set<string>(['nexus', 'operator']);

  if (steps.some((step) => step.kind === 'search' || step.kind === 'query' || step.kind === 'capture')) activeRoles.add('researcher');
  if (steps.some((step) => step.kind === 'analyze')) activeRoles.add('analyst');
  if (steps.some((step) => step.kind === 'summarize')) activeRoles.add('reviewer');
  if (steps.some((step) => step.kind === 'deliver')) activeRoles.add('messenger');

  const elasticToActivate = ['writer', 'scheduler', 'messenger', 'monitor'].slice(0, math.activeElasticLanes);
  elasticToActivate.forEach((role) => activeRoles.add(role));

  const workers = WORKER_DEFINITIONS.map((worker) => ({
    role: worker.role,
    label: worker.label,
    laneType: worker.laneType,
    assignedRole: worker.role === 'nexus' ? 'manager' : worker.role,
    band: worker.preferredBand,
    modelLabel: worker.modelLabel,
    status: activeRoles.has(worker.role) ? 'active' : 'standby',
    summary: worker.summary,
    reason: activeRoles.has(worker.role)
      ? worker.laneType === 'elastic'
        ? 'Activated by the current workflow math and cost policy.'
        : 'Resident specialist engaged for this workflow.'
      : 'Standing by until the manager needs more depth or throughput.',
  })) as DashboardWorkerCard[];

  return {
    version: 'violema-10',
    primaryRole: 'nexus',
    primaryBand: 'default',
    workers,
    summary: 'Fallback topology preview based on workflow math. Live runs will replace this with actual worker activation history.',
  };
}

export default function AgentStudio() {
  const navigate = useNavigate();
  const location = useLocation();
  const workspace = useMemo(() => resolveWorkspaceContext(), []);
  const [activeRoom, setActiveRoom] = useState<StudioRoom>('live');
  const [selectedWorkerRole, setSelectedWorkerRole] = useState<string>('nexus');
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioPresetId>('baseline');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedReplayPhase, setSelectedReplayPhase] = useState<'all' | WorkflowBlockKind>('all');
  const [selectedDirectivePhase, setSelectedDirectivePhase] = useState<'all' | WorkflowBlockKind>('all');
  const [selectedComparisonExperimentId, setSelectedComparisonExperimentId] = useState<string>('');
  const [selectedBranchRootId, setSelectedBranchRootId] = useState<string>('');
  const [comparedBranchRootId, setComparedBranchRootId] = useState<string>('');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('credits');
  const [gateLearningWindow, setGateLearningWindow] = useState<GateLearningWindow>('deep');
  const [branchRunFilter, setBranchRunFilter] = useState<BranchRunFilter>('all');
  const [selectedCohortRunId, setSelectedCohortRunId] = useState<string>('');
  const [hoveredCohortRunId, setHoveredCohortRunId] = useState<string>('');
  const [phaseSimulation, setPhaseSimulation] = useState<{ phase: WorkflowBlockKind; mode: 'cheaper' | 'review' | 'promote' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<AgentStudioRow[]>([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string>('');
  const [previewPresetId, setPreviewPresetId] = useState<string>('recommended');
  const [actionBusy, setActionBusy] = useState(false);
  const [studioBusy, setStudioBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const headers = {
        'X-Workspace-Id': workspace.workspaceId,
        'X-Workspace-Name': workspace.workspaceName,
      };

      const [automationPayload, taskPayload, runPayload] = await Promise.all([
        fetch('/api/automations', { headers }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('automations')))),
        fetch(`/api/platform/tasks?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, { headers }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('tasks')))),
        fetch(`/api/platform/task-runs?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, { headers }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('runs')))),
      ]);

      const automations = Array.isArray(automationPayload?.items) ? automationPayload.items as AutomationApiRecord[] : [];
      const tasks = Array.isArray(taskPayload?.items) ? taskPayload.items as PlatformTaskRecord[] : [];
      const runs = Array.isArray(runPayload?.items) ? runPayload.items as PlatformTaskRunRecord[] : [];

      const taskByAutomationId = new Map<string, PlatformTaskRecord>();
      const automationIdByTaskId = new Map<string, string>();
      tasks.forEach((task) => {
        const automationId = getTaskAutomationId(task);
        if (automationId) {
          taskByAutomationId.set(automationId, task);
          automationIdByTaskId.set(task.id, automationId);
        }
      });

      const runsByAutomationId = new Map<string, PlatformTaskRunRecord[]>();
      runs.forEach((run) => {
        const automationId = readString(run.metadata?.automationId) || automationIdByTaskId.get(run.taskId);
        if (!automationId) return;
        const existing = runsByAutomationId.get(automationId) || [];
        existing.push(run);
        runsByAutomationId.set(automationId, existing);
      });

      const nextRows = automations
        .map((automation) => {
          const task = taskByAutomationId.get(automation.id);
          const workflowSteps = Array.isArray(automation.steps) && automation.steps.length > 0
            ? automation.steps
            : automation.authoring_mode === 'describe'
              ? buildWorkflowBlocksFromPrompt(automation.workflow_prompt)
              : (automation.actions || []).map((action) => parseLegacyActionToWorkflowBlock(action));
          const runsForAutomation = (runsByAutomationId.get(automation.id) || [])
            .slice()
            .sort((a, b) => {
              const aTime = Date.parse(a.finishedAt || a.startedAt || '');
              const bTime = Date.parse(b.finishedAt || b.startedAt || '');
              return bTime - aTime;
            });
          const latestRun = runsForAutomation[0];
          const latestRunSteps = readStepExecutions(latestRun?.metadata?.stepExecutions);
          const stepExecutions = latestRunSteps.length > 0
            ? latestRunSteps
            : readStepExecutions(task?.metadata?.latestStepExecutions);
          const workerTopology =
            readWorkerTopology(latestRun?.metadata?.topology) ||
            readWorkerTopology(latestRun?.metadata?.workerTopology) ||
            readWorkerTopology(task?.metadata?.workerTopology);

          const completedRuns = runsForAutomation.filter((run) => run.status === 'succeeded' || run.status === 'failed');
          const succeededRuns = completedRuns.filter((run) => run.status === 'succeeded');
          const averageCredits = completedRuns.length > 0
            ? completedRuns.reduce((sum, run) => sum + (run.actualCredits || 0), 0) / completedRuns.length
            : 0;
          const averageDurationMs = completedRuns.length > 0
            ? completedRuns.reduce((sum, run) => {
                const started = Date.parse(run.startedAt || '');
                const finished = Date.parse(run.finishedAt || '');
                return sum + (Number.isNaN(started) || Number.isNaN(finished) ? 0 : Math.max(0, finished - started));
              }, 0) / completedRuns.length
            : 0;

          return {
            automation,
            task,
            runs: runsForAutomation,
            latestRun,
            workerTopology,
            stepExecutions,
            workflowSteps,
            successRate: completedRuns.length > 0 ? succeededRuns.length / completedRuns.length : 0,
            averageCredits,
            averageDurationMs,
          } satisfies AgentStudioRow;
        })
        .sort((a, b) => {
          const aTime = Date.parse(a.automation.next_run_at || a.latestRun?.finishedAt || a.automation.created_at || '');
          const bTime = Date.parse(b.automation.next_run_at || b.latestRun?.finishedAt || b.automation.created_at || '');
          return bTime - aTime;
        });

      setRows(nextRows);
      setSelectedAutomationId((current) => {
        const params = new URLSearchParams(location.search);
        const fromQuery = params.get('automation');
        if (fromQuery && nextRows.some((row) => row.automation.id === fromQuery)) return fromQuery;
        if (current && nextRows.some((row) => row.automation.id === current)) return current;
        return nextRows[0]?.automation.id || '';
      });
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [location.search, workspace.workspaceId, workspace.workspaceName]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const streamUrl = `/api/platform/stream?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`;
    const source = new EventSource(streamUrl);
    source.onmessage = () => {
      void loadData(true);
    };
    return () => source.close();
  }, [loadData, workspace.workspaceId, workspace.workspaceName]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.automation.id === selectedAutomationId) || rows[0],
    [rows, selectedAutomationId]
  );

  const selectedPolicy = useMemo(
    () => normalizeExecutionPolicy(selectedRow?.automation.execution_policy),
    [selectedRow]
  );

  const selectedStudioState = useMemo(
    () => normalizeStudioState(selectedRow?.automation.studio_state),
    [selectedRow]
  );

  const selectedMath = useMemo(
    () => inferExecutionPolicyMath(selectedPolicy, selectedRow?.workflowSteps || []),
    [selectedPolicy, selectedRow]
  );

  const selectedTopology = useMemo(
    () => selectedRow?.workerTopology || deriveFallbackWorkerTopology(selectedRow?.workflowSteps || [], selectedPolicy),
    [selectedPolicy, selectedRow]
  );

  const workflowBenchmarks = useMemo(() => {
    const maxAverageCredits = Math.max(...rows.map((row) => row.averageCredits || 0), 1);
    const selectedId = selectedRow?.automation.id;
    const ordered = rows.slice().sort((a, b) => {
      if (a.automation.id === selectedId) return -1;
      if (b.automation.id === selectedId) return 1;
      return b.successRate - a.successRate || a.averageCredits - b.averageCredits;
    });

    return ordered.slice(0, 6).map((row) => ({
      id: row.automation.id,
      name: row.automation.name,
      successRate: Math.round(row.successRate * 100),
      costWidth: `${Math.max(8, ((row.averageCredits || 0) / maxAverageCredits) * 100)}%`,
      averageCredits: row.averageCredits,
      lastStatus: row.latestRun?.status || row.automation.last_run_status || row.automation.status,
      stepCount: row.workflowSteps.length,
      isSelected: row.automation.id === selectedId,
    }));
  }, [rows, selectedRow]);

  const selectedRunTrend = useMemo(() => {
    if (!selectedRow) return [];
    const recentRuns = selectedRow.runs.slice(0, 6).reverse();
    const maxValue = Math.max(...recentRuns.map((run) => getTrendMetricValue(run, trendMetric)), 1);

    return recentRuns.map((run, index) => ({
      id: run.id,
      label: recentRuns.length === 1 ? 'Latest' : `Run ${index + 1}`,
      credits: run.actualCredits || 0,
      metricValue: getTrendMetricValue(run, trendMetric),
      metricLabel: formatTrendMetricValue(run, trendMetric),
      height: `${Math.max(18, (getTrendMetricValue(run, trendMetric) / maxValue) * 100)}%`,
      status: run.status,
      statusTone: getStatusTone(run.status),
      duration: formatCompactDuration(
        Number.isNaN(Date.parse(run.startedAt || '')) || Number.isNaN(Date.parse(run.finishedAt || ''))
          ? undefined
          : Math.max(0, Date.parse(run.finishedAt || '') - Date.parse(run.startedAt || ''))
      ),
    }));
  }, [selectedRow, trendMetric]);


  const presetComparisons = useMemo(() => {
    const steps = selectedRow?.workflowSteps || [];
    return POLICY_PRESETS.map((preset) => {
      const math = inferExecutionPolicyMath(preset.policy, steps);
      return {
        ...preset,
        math,
        spendIndex: estimatePolicySpendIndex(preset.policy, steps),
        assuranceIndex: estimatePolicyAssuranceIndex(preset.policy, steps),
        fitIndex: estimatePolicyFitIndex(preset.policy, steps),
        isActive:
          preset.policy.mode === selectedPolicy.mode &&
          preset.policy.optimizationGoal === selectedPolicy.optimizationGoal &&
          preset.policy.reviewPolicy === selectedPolicy.reviewPolicy &&
          preset.policy.maxElasticLanes === selectedPolicy.maxElasticLanes,
      };
    });
  }, [selectedPolicy, selectedRow]);

  const activePresetId = useMemo(() => {
    const match = POLICY_PRESETS.find((preset) =>
      preset.policy.mode === selectedPolicy.mode &&
      preset.policy.optimizationGoal === selectedPolicy.optimizationGoal &&
      preset.policy.reviewPolicy === selectedPolicy.reviewPolicy &&
      preset.policy.maxElasticLanes === selectedPolicy.maxElasticLanes
    );
    return match?.id || 'custom_live';
  }, [selectedPolicy]);

  useEffect(() => {
    setPreviewPresetId(activePresetId === 'custom_live' ? 'recommended' : activePresetId);
  }, [activePresetId, selectedRow?.automation.id]);

  useEffect(() => {
    setActiveRoom(selectedStudioState.activeRoom || 'live');
    setSelectedPlanId(selectedStudioState.selectedPlanId || '');
    setSelectedReplayPhase(selectedStudioState.selectedReplayPhase || 'all');
    setSelectedWorkerRole(selectedStudioState.selectedWorkerRole || 'nexus');
    setSelectedDirectivePhase(selectedStudioState.selectedDirectivePhase || 'all');
    setHoveredCohortRunId('');
    setPhaseSimulation(selectedStudioState.phaseSimulation || null);
    setSelectedComparisonExperimentId(selectedStudioState.selectedComparisonExperimentId || '');
    setSelectedCohortRunId(selectedStudioState.selectedCohortRunId || '');
    setSelectedBranchRootId(selectedStudioState.selectedBranchRootId || '');
    setComparedBranchRootId(selectedStudioState.comparedBranchRootId || '');
    setTrendMetric(selectedStudioState.trendMetric || 'credits');
    setGateLearningWindow(selectedStudioState.gateLearningWindow || 'deep');
    setBranchRunFilter(selectedStudioState.branchRunFilter || 'all');
    setSelectedScenarioId(
      selectedStudioState.selectedScenarioId && SCENARIO_PRESETS.some((scenario) => scenario.id === selectedStudioState.selectedScenarioId)
        ? selectedStudioState.selectedScenarioId as ScenarioPresetId
        : 'baseline'
    );
    if (selectedStudioState.previewPresetId && POLICY_PRESETS.some((preset) => preset.id === selectedStudioState.previewPresetId)) {
      setPreviewPresetId(selectedStudioState.previewPresetId);
    }
  }, [
    selectedStudioState.activeRoom,
    selectedStudioState.branchRunFilter,
    selectedStudioState.gateLearningWindow,
    selectedStudioState.phaseSimulation,
    selectedStudioState.selectedPlanId,
    selectedStudioState.selectedComparisonExperimentId,
    selectedStudioState.selectedCohortRunId,
    selectedStudioState.selectedDirectivePhase,
    selectedStudioState.selectedReplayPhase,
    selectedRow?.automation.id,
    selectedStudioState.comparedBranchRootId,
    selectedStudioState.previewPresetId,
    selectedStudioState.selectedBranchRootId,
    selectedStudioState.selectedScenarioId,
    selectedStudioState.selectedWorkerRole,
    selectedStudioState.trendMetric,
  ]);

  const previewPreset = useMemo(
    () => POLICY_PRESETS.find((preset) => preset.id === previewPresetId) || POLICY_PRESETS[0],
    [previewPresetId]
  );

  const selectedScenario = useMemo(
    () => getScenarioPreset(selectedScenarioId),
    [selectedScenarioId]
  );

  const runComparison = useMemo(() => {
    if (!selectedRow) return null;
    const completedRuns = selectedRow.runs.filter((run) => run.status === 'succeeded' || run.status === 'failed');
    const current = completedRuns[0];
    if (!current) return null;

    const selectedExperiment = (selectedStudioState.experimentHistory || []).find((experiment) => experiment.id === selectedComparisonExperimentId);
    const matchesExperiment = (run: PlatformTaskRunRecord, experiment: StudioExperimentRecord) => {
      const attribution = getRunExperimentAttribution(run);
      if (attribution.experimentId) return attribution.experimentId === experiment.id;
      return attribution.scenarioId === experiment.scenarioId && attribution.previewPresetId === experiment.previewPresetId;
    };

    const previous = selectedExperiment
      ? completedRuns.find((run) => run.id !== current.id && matchesExperiment(run, selectedExperiment)) || completedRuns[1]
      : completedRuns[1];
    const currentAttribution = getRunExperimentAttribution(current);
    const previousAttribution = previous ? getRunExperimentAttribution(previous) : undefined;
    const currentDuration = Number.isNaN(Date.parse(current.startedAt || '')) || Number.isNaN(Date.parse(current.finishedAt || ''))
      ? undefined
      : Math.max(0, Date.parse(current.finishedAt || '') - Date.parse(current.startedAt || ''));
    const previousDuration = !previous || Number.isNaN(Date.parse(previous.startedAt || '')) || Number.isNaN(Date.parse(previous.finishedAt || ''))
      ? undefined
      : Math.max(0, Date.parse(previous.finishedAt || '') - Date.parse(previous.startedAt || ''));

    return {
      comparisonMode: selectedExperiment ? 'saved_experiment' : 'previous_run',
      comparisonLabel: selectedExperiment
        ? selectedExperiment.notes || `${getScenarioLabelFromId(selectedExperiment.scenarioId)} · ${getPresetLabelFromId(selectedExperiment.previewPresetId)}`
        : 'Previous run',
      current: {
        id: current.id,
        status: current.status,
        credits: current.actualCredits || 0,
        durationMs: currentDuration,
        scenarioLabel: currentAttribution.scenarioLabel || getScenarioLabelFromId(selectedStudioState.selectedScenarioId || 'baseline'),
        presetLabel: currentAttribution.previewPresetLabel || getPresetLabelFromId(selectedStudioState.previewPresetId || activePresetId),
        experimentLabel: currentAttribution.experimentNotes,
      },
      previous: previous ? {
        id: previous.id,
        status: previous.status,
        credits: previous.actualCredits || 0,
        durationMs: previousDuration,
        scenarioLabel: previousAttribution?.scenarioLabel || getScenarioLabelFromId('baseline'),
        presetLabel: previousAttribution?.previewPresetLabel || getPresetLabelFromId('recommended'),
        experimentLabel: previousAttribution?.experimentNotes,
      } : null,
    };
  }, [activePresetId, selectedComparisonExperimentId, selectedRow, selectedStudioState.experimentHistory, selectedStudioState.previewPresetId, selectedStudioState.selectedScenarioId]);

  const currentSpendIndex = useMemo(
    () => estimatePolicySpendIndex(selectedPolicy, selectedRow?.workflowSteps || []),
    [selectedPolicy, selectedRow]
  );

  const currentAssuranceIndex = useMemo(
    () => estimatePolicyAssuranceIndex(selectedPolicy, selectedRow?.workflowSteps || []),
    [selectedPolicy, selectedRow]
  );

  const currentFitIndex = useMemo(
    () => estimatePolicyFitIndex(selectedPolicy, selectedRow?.workflowSteps || []),
    [selectedPolicy, selectedRow]
  );

  const rolePerformance = useMemo(() => {
    const stats = new Map<string, { steps: number; failures: number; credits: number; tokens: number }>();
    (selectedRow?.runs || []).forEach((run) => {
      readStepExecutions(run.metadata?.stepExecutions).forEach((step) => {
        const current = stats.get(step.assignedRole) || { steps: 0, failures: 0, credits: 0, tokens: 0 };
        current.steps += 1;
        current.failures += step.status === 'failed' ? 1 : 0;
        current.credits += step.actualCredits || 0;
        current.tokens += step.tokenUsage?.totalTokens || 0;
        stats.set(step.assignedRole, current);
      });
    });
    return Array.from(stats.entries())
      .map(([role, value]) => ({ role, ...value }))
      .sort((a, b) => b.steps - a.steps);
  }, [selectedRow]);

  const optimizationRecommendations = useMemo(() => {
    if (!selectedRow) return [];
    const items: Array<{ title: string; body: string; action: 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none' }> = [];
    if (selectedRow.successRate > 0 && selectedRow.successRate < 0.7) {
      items.push({
        title: 'Increase review pressure',
        body: 'This workflow is missing too often. Move review toward Standard or Strict so heavier reasoning is only added where it reduces failures.',
        action: 'raise_review',
      });
    }
    if (selectedMath.toolCalls >= 3 && selectedPolicy.optimizationGoal !== 'cost_saver') {
      items.push({
        title: 'Route tool-heavy work down-market',
        body: 'Most of the work here is tool orchestration. Cost Saver keeps scheduling and delivery steps cheap without flattening the whole workflow.',
        action: 'lean_ops',
      });
    }
    if (selectedPolicy.mode === 'custom' && selectedPolicy.maxElasticLanes < selectedMath.recommendedElasticLanes) {
      items.push({
        title: 'Raise lane cap for this workflow',
        body: `The workflow math wants ${selectedMath.recommendedElasticLanes} elastic lanes. Your cap is probably slowing completion and creating avoidable queues.`,
        action: 'match_lanes',
      });
    }
    if (selectedPolicy.mode === 'custom' && selectedPolicy.maxElasticLanes > selectedMath.recommendedElasticLanes + 1) {
      items.push({
        title: 'Trim excess elastic capacity',
        body: 'The current lane cap is richer than this workflow needs. Reducing it should lower spend without hurting reliability.',
        action: 'trim_lanes',
      });
    }
    if (items.length === 0) {
      items.push({
        title: 'Current configuration is healthy',
        body: 'This workflow is aligned with its complexity. The next gains will come from tightening the workflow itself, not from adding more agent structure.',
        action: 'none',
      });
    }
    return items.slice(0, 4);
  }, [selectedMath, selectedPolicy, selectedRow]);

  const studioStats = useMemo(() => {
    const completedRuns = rows.flatMap((row) => row.runs).filter((run) => run.status === 'succeeded' || run.status === 'failed');
    const succeededRuns = completedRuns.filter((run) => run.status === 'succeeded');
    const runsWithElastic = rows.filter((row) =>
      (row.workerTopology?.workers || []).some((worker) => worker.laneType === 'elastic' && worker.status === 'active')
    ).length;
    return {
      workflowCount: rows.length,
      runSuccessRate: completedRuns.length ? succeededRuns.length / completedRuns.length : 0,
      avgRunCredits: completedRuns.length
        ? completedRuns.reduce((sum, run) => sum + (run.actualCredits || 0), 0) / completedRuns.length
        : 0,
      elasticCoverage: rows.length ? runsWithElastic / rows.length : 0,
    };
  }, [rows]);

  const liveRun = useMemo(
    () => selectedRow?.runs.find((run) => run.status === 'running') || selectedRow?.latestRun,
    [selectedRow]
  );

  const liveActivationTrail = useMemo(() => {
    const trail = (selectedRow?.stepExecutions || []).slice(0, 8).map((step, index, source) => ({
      id: step.stepId,
      title: step.title,
      role: step.assignedRole,
      status: step.status,
      summary: step.error || formatSummaryPreview(step.summary, 120) || 'Step executed without a stored summary.',
      modelSource: step.modelSource,
      connector:
        index < source.length - 1
          ? `${step.assignedRole} -> ${source[index + 1].assignedRole}`
          : 'Final handoff',
    }));

    if (trail.length > 0) return trail;

    return (selectedTopology.workers || [])
      .filter((worker) => worker.status === 'active')
      .slice(0, 4)
      .map((worker, index, source) => ({
        id: `${worker.role}-${index}`,
        title: worker.label,
        role: worker.assignedRole,
        status: worker.status,
        summary: worker.reason,
        modelSource: worker.modelLabel,
        connector: index < source.length - 1 ? `${worker.assignedRole} -> ${source[index + 1].assignedRole}` : 'Standing by',
      }));
  }, [selectedRow, selectedTopology]);

  const workerMapNodes = useMemo(() => {
    const layout: Record<string, string> = {
      researcher: 'left-[6%] top-[14%]',
      analyst: 'right-[8%] top-[12%]',
      reviewer: 'right-[4%] top-[46%]',
      operator: 'left-[8%] top-[48%]',
      engineer: 'left-[18%] bottom-[10%]',
      writer: 'left-[44%] bottom-[4%]',
      scheduler: 'right-[28%] bottom-[7%]',
      messenger: 'right-[6%] bottom-[19%]',
      monitor: 'left-[42%] top-[8%]',
    };

    return selectedTopology.workers
      .filter((worker) => worker.role !== 'nexus')
      .map((worker) => ({
        ...worker,
        positionClass: layout[worker.role] || 'left-[8%] top-[8%]',
      }));
  }, [selectedTopology]);

  const frontierPoints = useMemo(
    () =>
      presetComparisons.map((preset) => ({
        ...preset,
        x: preset.spendIndex,
        y: preset.assuranceIndex,
        size: 16 + Math.round(preset.fitIndex / 7),
      })),
    [presetComparisons]
  );


  const replayTimeline = useMemo(() => {
    const latest = selectedRow?.runs[0];
    const runSteps = readStepExecutions(latest?.metadata?.stepExecutions);
    const fallback = selectedRow?.stepExecutions || [];
    const source = runSteps.length > 0 ? runSteps : fallback;
    return source.map((step, index) => ({
      ...step,
      marker: index + 1,
      duration: formatCompactDuration(step.durationMs),
      tokens: formatTokenCount(step.tokenUsage?.totalTokens),
    }));
  }, [selectedRow]);

  const replayInsights = useMemo(() => {
    const insights: Array<{ title: string; body: string; tone: string }> = [];
    const topCostStep = replayTimeline
      .filter((step) => typeof step.actualCredits === 'number')
      .sort((a, b) => (b.actualCredits || 0) - (a.actualCredits || 0))[0];
    const failedStep = replayTimeline.find((step) => step.status === 'failed');

    if (topCostStep) {
      insights.push({
        title: 'Highest spend step',
        body: `${topCostStep.title} consumed ${formatCredits(topCostStep.actualCredits || 0)} credits on ${topCostStep.assignedRole}. This is the first place to route down-market if quality allows.`,
        tone: 'border-amber-500/18 bg-amber-500/8 text-amber-100',
      });
    }

    if (failedStep) {
      insights.push({
        title: 'Failure choke point',
        body: `${failedStep.title} failed on ${failedStep.assignedRole}. Tighten review or move this class of work to a stronger lane before changing the whole topology.`,
        tone: 'border-red-500/18 bg-red-500/8 text-red-100',
      });
    }

    if (!failedStep && replayTimeline.length > 0) {
      insights.push({
        title: 'Stable recent execution',
        body: 'Recent handoffs completed without a visible failure. Optimize for spend or speed now rather than adding more review pressure.',
        tone: 'border-emerald-500/18 bg-emerald-500/8 text-emerald-100',
      });
    }

    if (selectedMath.toolCalls >= 2 && selectedPolicy.optimizationGoal !== 'cost_saver') {
      insights.push({
        title: 'Tool-heavy workflow',
        body: 'This run leans on tools. Leaner presets should preserve outcome quality while cutting token burn on orchestration steps.',
        tone: 'border-cyan-500/18 bg-cyan-500/8 text-cyan-100',
      });
    }

    return insights.slice(0, 3);
  }, [replayTimeline, selectedMath.toolCalls, selectedPolicy.optimizationGoal]);

  const roleHeatmap = useMemo(() => {
    const maxSteps = Math.max(...rolePerformance.map((role) => role.steps), 1);
    return rolePerformance.map((role) => ({
      ...role,
      activityWidth: `${Math.max(12, (role.steps / maxSteps) * 100)}%`,
      failureRate: role.steps ? Math.round((role.failures / role.steps) * 100) : 0,
    }));
  }, [rolePerformance]);

  const selectedWorkerDetail = useMemo(() => {
    const worker =
      selectedTopology.workers.find((item) => item.role === selectedWorkerRole || item.assignedRole === selectedWorkerRole)
      || selectedTopology.workers.find((item) => item.role === 'nexus');
    const performance = roleHeatmap.find((item) => item.role === (worker?.assignedRole || worker?.role));
    const recentSteps = (selectedRow?.stepExecutions || [])
      .filter((step) => step.assignedRole === (worker?.assignedRole || worker?.role))
      .slice(0, 3);
    return { worker, performance, recentSteps };
  }, [roleHeatmap, selectedRow, selectedTopology, selectedWorkerRole]);

  const selectedArchetype = useMemo(
    () => classifyWorkflowArchetype(selectedRow?.workflowSteps || []),
    [selectedRow]
  );

  const scenarioComparisons = useMemo(() => {
    const simulated = simulateScenarioMath(selectedMath, selectedScenario);
    return presetComparisons.map((preset) => {
      const spend = clampNumber(
        Math.round(preset.spendIndex + (simulated.toolCalls - selectedMath.toolCalls) * 6 + (simulated.stepCount - selectedMath.stepCount) * 2),
        10,
        99
      );
      const assurance = clampNumber(
        Math.round(preset.assuranceIndex + (Number(simulated.reasoningLoad) - Number(selectedMath.reasoningLoad)) * 5),
        15,
        99
      );
      const fit = clampNumber(
        Math.round(preset.fitIndex - Math.abs(simulated.recommendedElasticLanes - preset.math.activeElasticLanes) * 10 + (selectedScenario.id === 'baseline' ? 0 : 4)),
        10,
        99
      );
      return { ...preset, scenarioSpend: spend, scenarioAssurance: assurance, scenarioFit: fit, simulated };
    });
  }, [presetComparisons, selectedMath, selectedScenario]);

  const previewScenarioComparison = useMemo(
    () => scenarioComparisons.find((preset) => preset.id === previewPreset.id) || scenarioComparisons[0],
    [previewPreset.id, scenarioComparisons]
  );

  const policyRadarMetrics = useMemo(
    () => ([
      { label: 'Spend', live: currentSpendIndex, preview: previewScenarioComparison?.scenarioSpend ?? currentSpendIndex },
      { label: 'Assurance', live: currentAssuranceIndex, preview: previewScenarioComparison?.scenarioAssurance ?? currentAssuranceIndex },
      { label: 'Fit', live: currentFitIndex, preview: previewScenarioComparison?.scenarioFit ?? currentFitIndex },
    ]),
    [currentAssuranceIndex, currentFitIndex, currentSpendIndex, previewScenarioComparison?.scenarioAssurance, previewScenarioComparison?.scenarioFit, previewScenarioComparison?.scenarioSpend]
  );

  const selectedRoleDirective = useMemo(
    () => selectedStudioState.roleDirectives?.[selectedWorkerDetail.worker?.role || ''],
    [selectedStudioState.roleDirectives, selectedWorkerDetail.worker?.role]
  );

  const workerPhaseActivity = useMemo(
    () => buildPhaseActivitySeries(selectedRow?.runs || [], selectedWorkerDetail.worker?.assignedRole || selectedWorkerDetail.worker?.role || ''),
    [selectedRow?.runs, selectedWorkerDetail.worker?.assignedRole, selectedWorkerDetail.worker?.role]
  );

  const liveScenarioTelemetry = useMemo(() => {
    const telemetry = getRunScenarioTelemetry(liveRun);
    const directedRoles = telemetry.directedRoles && telemetry.directedRoles.length > 0
      ? telemetry.directedRoles
      : Object.entries(selectedStudioState.roleDirectives || {}).map(([role, directive]) => ({
          role,
          mode: directive.mode as 'cheaper' | 'review' | 'promote',
          phases: directive.phases,
        }));

    return {
      scenarioLabel: telemetry.scenarioLabel || getScenarioLabelFromId(selectedStudioState.selectedScenarioId || 'baseline'),
      presetLabel: telemetry.previewPresetLabel || getPresetLabelFromId(selectedStudioState.previewPresetId || activePresetId),
      complexity: telemetry.complexity || (Number(selectedMath.reasoningLoad) >= 8 ? 'high' : Number(selectedMath.reasoningLoad) >= 5 ? 'moderate' : 'light'),
      workflowStepCount: telemetry.workflowStepCount || selectedMath.stepCount,
      estimatedToolCalls: telemetry.estimatedToolCalls || selectedMath.toolCalls,
      matchedSavedExperiment: telemetry.matchedSavedExperiment,
      experimentId: telemetry.experimentId,
      directedRoles,
    };
  }, [activePresetId, liveRun, selectedMath.reasoningLoad, selectedMath.stepCount, selectedMath.toolCalls, selectedStudioState.previewPresetId, selectedStudioState.roleDirectives, selectedStudioState.selectedScenarioId]);

  const phaseDirectiveMatrix = useMemo(() => {
    const source = liveScenarioTelemetry.directedRoles || [];
    const phases: WorkflowBlockKind[] = ['search', 'query', 'capture', 'analyze', 'summarize', 'deliver'];
    return phases.map((phase) => ({
      phase,
      directives: source.filter((directive) => !directive.phases || directive.phases.includes(phase)),
    }));
  }, [liveScenarioTelemetry.directedRoles]);

  const experimentHistory = useMemo(
    () => (selectedStudioState.experimentHistory || []).slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [selectedStudioState.experimentHistory]
  );

  const savedOperatingPlans = useMemo(
    () => (selectedStudioState.savedPlans || []).slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [selectedStudioState.savedPlans]
  );

  const phaseEvidence = useMemo(() => {
    if (!selectedRow) return [] as Array<{ phase: WorkflowBlockKind; runs: number; successRate: number; averageCredits: number; averageDurationMs: number; directiveModes: string[] }>;
    const aggregate = new Map<WorkflowBlockKind, { runs: number; success: number; credits: number; durationMs: number; directiveModes: Set<string> }>();
    selectedRow.runs
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .forEach((run) => {
        readStepExecutions(run.metadata?.stepExecutions).forEach((step) => {
          if (!(step.kind === 'search' || step.kind === 'query' || step.kind === 'capture' || step.kind === 'analyze' || step.kind === 'summarize' || step.kind === 'deliver' || step.kind === 'note')) return;
          const current = aggregate.get(step.kind) || { runs: 0, success: 0, credits: 0, durationMs: 0, directiveModes: new Set<string>() };
          current.runs += 1;
          current.success += step.status === 'succeeded' ? 1 : 0;
          current.credits += step.actualCredits || 0;
          current.durationMs += step.durationMs || 0;
          if (step.directiveMode) current.directiveModes.add(step.directiveMode);
          aggregate.set(step.kind, current);
        });
      });

    return Array.from(aggregate.entries()).map(([phase, value]) => ({
      phase,
      runs: value.runs,
      successRate: value.runs ? value.success / value.runs : 0,
      averageCredits: value.runs ? value.credits / value.runs : 0,
      averageDurationMs: value.runs ? value.durationMs / value.runs : 0,
      directiveModes: Array.from(value.directiveModes),
    })).sort((a, b) => b.runs - a.runs);
  }, [selectedRow]);

  const workflowDiagnostics = useMemo(() => {
    const riskItems: Array<{ title: string; body: string; severity: 'low' | 'medium' | 'high'; action: 'raise_review' | 'none' }> = [];
    const wasteItems: Array<{ title: string; body: string; severity: 'low' | 'medium' | 'high'; action: 'lean_ops' | 'trim_lanes' | 'match_lanes' | 'none' }> = [];

    if (selectedRow) {
      const weakestPhase = phaseEvidence
        .filter((phase) => phase.runs >= 2)
        .sort((a, b) => a.successRate - b.successRate || b.runs - a.runs)[0];
      const costlyPhase = phaseEvidence
        .filter((phase) => phase.runs >= 2)
        .sort((a, b) => b.averageCredits - a.averageCredits || b.runs - a.runs)[0];

      if (selectedRow.successRate > 0 && selectedRow.successRate < 0.7) {
        riskItems.push({
          title: 'Reliability is below target',
          body: 'Recent runs are failing often enough that this workflow is under-protected. The fix is stricter review where the final reasoning happens, not more lanes everywhere.',
          severity: 'high',
          action: 'raise_review',
        });
      }
      if (weakestPhase && weakestPhase.successRate < 0.7) {
        riskItems.push({
          title: `${formatDirectivePhaseScope([weakestPhase.phase])} is the weak phase`,
          body: `Across ${weakestPhase.runs} recent step executions, this phase is only landing ${Math.round(weakestPhase.successRate * 100)}% of the time. Tighten review here before changing the entire workflow posture.`,
          severity: weakestPhase.successRate < 0.55 ? 'high' : 'medium',
          action: 'raise_review',
        });
      }
      if (costlyPhase && costlyPhase.averageCredits >= 18) {
        wasteItems.push({
          title: `${formatDirectivePhaseScope([costlyPhase.phase])} is burning budget`,
          body: `This phase averages ${formatCredits(costlyPhase.averageCredits)} credits across ${costlyPhase.runs} executions. That is the best candidate for cheaper routing or tighter instructions.`,
          severity: costlyPhase.averageCredits >= 28 ? 'high' : 'medium',
          action: costlyPhase.phase === 'deliver' || costlyPhase.phase === 'search' ? 'lean_ops' : 'none',
        });
      }
      if (selectedPolicy.maxElasticLanes > selectedMath.recommendedElasticLanes + 1) {
        wasteItems.push({
          title: 'Elastic capacity is over-provisioned',
          body: `Live cap is ${selectedPolicy.maxElasticLanes}, but the workflow math only justifies about ${selectedMath.recommendedElasticLanes}.`,
          severity: 'medium',
          action: 'trim_lanes',
        });
      }
      if (selectedPolicy.maxElasticLanes < selectedMath.recommendedElasticLanes) {
        riskItems.push({
          title: 'Parallel depth is constrained',
          body: 'The workflow needs more elastic headroom than the current cap allows, which can create slower runs and overloaded core roles.',
          severity: 'medium',
          action: 'none',
        });
        wasteItems.push({
          title: 'Queueing is likely hurting throughput',
          body: 'This is one of the few workflows where spending a bit more on lane capacity is likely to return better cycle time.',
          severity: 'low',
          action: 'match_lanes',
        });
      }
      if (riskItems.length === 0) {
        riskItems.push({
          title: 'No dominant risk signal',
          body: 'Nothing here is screaming for heavier review. Preserve speed and focus on workflow quality or experiment learning.',
          severity: 'low',
          action: 'none',
        });
      }
      if (wasteItems.length === 0) {
        wasteItems.push({
          title: 'Spend profile looks disciplined',
          body: 'The current setup is not obviously wasting tokens or elastic capacity. Improvements will likely come from sharper experiments, not blanket cost cutting.',
          severity: 'low',
          action: 'none',
        });
      }
    }

    return { riskItems: riskItems.slice(0, 3), wasteItems: wasteItems.slice(0, 3) };
  }, [phaseEvidence, selectedMath.recommendedElasticLanes, selectedPolicy.maxElasticLanes, selectedRow, selectedRow?.successRate]);

  const optimizationScorecard = useMemo(() => {
    const spendPressure = clampNumber(Math.round((currentSpendIndex * 0.55) + (selectedMath.toolCalls * 6) + (selectedMath.activeElasticLanes * 5)), 10, 99);
    const riskPressure = clampNumber(Math.round((100 - Math.round(selectedRow?.successRate ? selectedRow.successRate * 100 : 72)) * 0.55 + currentAssuranceIndex * 0.35), 10, 99);
    const leverageScore = clampNumber(Math.round(currentFitIndex + Math.max(0, 18 - spendPressure / 6) + (selectedMath.recommendedElasticLanes >= selectedMath.activeElasticLanes ? 6 : -4)), 10, 99);
    const verdict = leverageScore >= 78 ? 'Strong operating setup' : leverageScore >= 58 ? 'Good with room to tune' : 'Needs a sharper policy';
    const nextMove = workflowDiagnostics.riskItems[0]?.severity === 'high'
      ? 'Tighten review around the highest-risk phase.'
      : workflowDiagnostics.wasteItems[0]?.action === 'lean_ops'
        ? 'Route more operational work down-market.'
        : workflowDiagnostics.wasteItems[0]?.action === 'trim_lanes'
          ? 'Trim elastic capacity before adding more logic.'
          : 'Keep testing saved experiments and promote only what consistently wins.';
    return { spendPressure, riskPressure, leverageScore, verdict, nextMove };
  }, [currentAssuranceIndex, currentFitIndex, currentSpendIndex, selectedMath.activeElasticLanes, selectedMath.recommendedElasticLanes, selectedMath.toolCalls, selectedRow?.successRate, workflowDiagnostics.riskItems, workflowDiagnostics.wasteItems]);

  const experimentRunMatches = useMemo(() => {
    const matches = new Map<string, PlatformTaskRunRecord | undefined>();
    if (!selectedRow) return matches;
    const completedRuns = selectedRow.runs.filter((run) => run.status === 'succeeded' || run.status === 'failed');
    for (const experiment of experimentHistory) {
      const matchingRun = completedRuns.find((run) => matchesExperimentRun(run, experiment));
      matches.set(experiment.id, matchingRun);
    }
    return matches;
  }, [experimentHistory, selectedRow]);

  const experimentPerformance = useMemo(() => {
    if (!selectedRow) return [] as Array<{
      experiment: StudioExperimentRecord;
      runs: PlatformTaskRunRecord[];
      stats: ReturnType<typeof summarizeRunCollection>;
      score: number;
      confidence: number;
      recencyBoost: number;
      latestAt?: string;
    }>;

    const completedRuns = selectedRow.runs.filter((run) => run.status === 'succeeded' || run.status === 'failed');
    return experimentHistory.map((experiment) => {
      const runs = completedRuns.filter((run) => matchesExperimentRun(run, experiment));
      const stats = summarizeRunCollection(runs);
      const latestAt = runs[0]?.finishedAt || runs[0]?.startedAt;
      const weighted = scoreObservedPerformance(stats, latestAt);
      return { experiment, runs, stats, latestAt, ...weighted };
    }).sort((left, right) => right.score - left.score || right.confidence - left.confidence || right.stats.count - left.stats.count);
  }, [experimentHistory, selectedRow]);

  const winningExperiment = useMemo(
    () => experimentPerformance.find((item) => item.stats.count > 0),
    [experimentPerformance]
  );

  const winningExperimentPhases = useMemo(
    () => (winningExperiment ? getExperimentPhaseList(winningExperiment.experiment) : []),
    [winningExperiment]
  );

  const selectedExperimentPerformance = useMemo(
    () => experimentPerformance.find((item) => item.experiment.id === selectedComparisonExperimentId),
    [experimentPerformance, selectedComparisonExperimentId]
  );

  const currentCohortPerformance = useMemo(() => {
    if (!selectedRow) return null;
    const completedRuns = selectedRow.runs.filter((run) => run.status === 'succeeded' || run.status === 'failed');
    const latest = completedRuns[0];
    if (!latest) return null;
    const attribution = getRunExperimentAttribution(latest);
    const cohortRuns = completedRuns.filter((run) => {
      const candidate = getRunExperimentAttribution(run);
      if (attribution.experimentId && candidate.experimentId) return candidate.experimentId === attribution.experimentId;
      return candidate.scenarioId === attribution.scenarioId && candidate.previewPresetId === attribution.previewPresetId;
    });
    return {
      label: attribution.experimentNotes || `${attribution.scenarioLabel} · ${attribution.previewPresetLabel}`,
      stats: summarizeRunCollection(cohortRuns),
      runs: cohortRuns,
    };
  }, [selectedRow]);

  useEffect(() => {
    setSelectedComparisonExperimentId((current) => {
      if (current && experimentHistory.some((experiment) => experiment.id === current)) return current;
      return experimentHistory[0]?.id || '';
    });
  }, [experimentHistory, selectedRow?.automation.id]);

  useEffect(() => {
    setSelectedPlanId((current) => {
      if (current && savedOperatingPlans.some((plan) => plan.id === current)) return current;
      return savedOperatingPlans[0]?.id || '';
    });
  }, [savedOperatingPlans, selectedRow?.automation.id]);

  useEffect(() => {
    const candidate = currentCohortPerformance?.runs[0]?.id || selectedExperimentPerformance?.runs[0]?.id || '';
    setSelectedCohortRunId((current) => current || candidate);
  }, [currentCohortPerformance?.runs, selectedExperimentPerformance?.runs, selectedRow?.automation.id]);

  const selectedCohortRun = useMemo(() => {
    const allRuns = [...(currentCohortPerformance?.runs || []), ...(selectedExperimentPerformance?.runs || [])];
    return allRuns.find((run) => run.id === selectedCohortRunId) || currentCohortPerformance?.runs[0] || selectedExperimentPerformance?.runs[0];
  }, [currentCohortPerformance?.runs, selectedCohortRunId, selectedExperimentPerformance?.runs]);

  const focusedCohortRun = useMemo(() => {
    const allRuns = [...(currentCohortPerformance?.runs || []), ...(selectedExperimentPerformance?.runs || [])];
    return allRuns.find((run) => run.id === hoveredCohortRunId)
      || allRuns.find((run) => run.id === selectedCohortRunId)
      || allRuns[0];
  }, [currentCohortPerformance?.runs, hoveredCohortRunId, selectedCohortRunId, selectedExperimentPerformance?.runs]);

  const cohortTrendSeries = useMemo(
    () => [
      {
        label: 'Current',
        tone: {
          stroke: '#22d3ee',
          fill: 'rgba(34, 211, 238, 0.14)',
          dot: 'rgba(103, 232, 249, 0.95)',
          grid: 'rgba(34, 211, 238, 0.18)',
        },
        chart: buildTrendSeries(currentCohortPerformance?.runs || [], trendMetric),
      },
      {
        label: 'Experiment',
        tone: {
          stroke: '#a78bfa',
          fill: 'rgba(167, 139, 250, 0.14)',
          dot: 'rgba(196, 181, 253, 0.95)',
          grid: 'rgba(167, 139, 250, 0.18)',
        },
        chart: buildTrendSeries(selectedExperimentPerformance?.runs || [], trendMetric),
      },
    ],
    [currentCohortPerformance?.runs, selectedExperimentPerformance?.runs, trendMetric],
  );

  const phaseSimulationPreview = useMemo(() => {
    if (!phaseSimulation) return null;
    const targetRole = getPreferredRoleForPhase(phaseSimulation.phase);
    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      optimizationGoal:
        phaseSimulation.mode === 'cheaper'
          ? 'cost_saver'
          : phaseSimulation.mode === 'review'
            ? (selectedPolicy.optimizationGoal === 'cost_saver' ? 'balanced' : selectedPolicy.optimizationGoal)
            : 'quality_first',
      reviewPolicy:
        phaseSimulation.mode === 'review'
          ? 'strict'
          : phaseSimulation.mode === 'cheaper' && selectedPolicy.reviewPolicy === 'strict'
            ? 'standard'
            : selectedPolicy.reviewPolicy,
      maxElasticLanes:
        phaseSimulation.mode === 'promote'
          ? Math.min(4, Math.max(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes) + 1)
          : phaseSimulation.mode === 'cheaper'
            ? Math.max(1, Math.min(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes))
            : selectedPolicy.maxElasticLanes,
    };

    const nextSpend = estimatePolicySpendIndex(nextPolicy, selectedRow?.workflowSteps || []);
    const nextAssurance = estimatePolicyAssuranceIndex(nextPolicy, selectedRow?.workflowSteps || []);
    const nextFit = estimatePolicyFitIndex(nextPolicy, selectedRow?.workflowSteps || []);

    return {
      ...phaseSimulation,
      targetRole,
      nextPolicy,
      nextSpend,
      nextAssurance,
      nextFit,
      spendDelta: nextSpend - currentSpendIndex,
      assuranceDelta: nextAssurance - currentAssuranceIndex,
      fitDelta: nextFit - currentFitIndex,
    };
  }, [currentAssuranceIndex, currentFitIndex, currentSpendIndex, phaseSimulation, selectedMath.recommendedElasticLanes, selectedPolicy, selectedRow?.workflowSteps]);

  const selectedRunDelta = useMemo(() => {
    if (!selectedCohortRun) return null;
    const source = (currentCohortPerformance?.runs || []).some((run) => run.id === selectedCohortRun.id)
      ? currentCohortPerformance
      : selectedExperimentPerformance
        ? { label: getExperimentDisplayLabel(selectedExperimentPerformance.experiment), stats: selectedExperimentPerformance.stats }
        : null;
    if (!source) return null;
    const runDuration = Number.isNaN(Date.parse(selectedCohortRun.startedAt || '')) || Number.isNaN(Date.parse(selectedCohortRun.finishedAt || ''))
      ? 0
      : Math.max(0, Date.parse(selectedCohortRun.finishedAt || '') - Date.parse(selectedCohortRun.startedAt || ''));
    return {
      label: source.label,
      creditDelta: (selectedCohortRun.actualCredits || 0) - (source.stats.averageCredits || 0),
      durationDelta: runDuration - (source.stats.averageDurationMs || 0),
      successDelta: (selectedCohortRun.status === 'succeeded' ? 100 : selectedCohortRun.status === 'failed' ? 0 : 50) - Math.round((source.stats.successRate || 0) * 100),
    };
  }, [currentCohortPerformance, selectedCohortRun, selectedExperimentPerformance]);

  const policyDiffRows = useMemo(
    () => [
      {
        label: 'Optimization goal',
        current: getOptimizationGoalLabel(selectedPolicy.optimizationGoal),
        next: getOptimizationGoalLabel(previewPreset.policy.optimizationGoal),
      },
      {
        label: 'Review',
        current: getReviewPolicyLabel(selectedPolicy.reviewPolicy),
        next: getReviewPolicyLabel(previewPreset.policy.reviewPolicy),
      },
      {
        label: 'Elastic lane cap',
        current: `${selectedPolicy.maxElasticLanes}`,
        next: `${previewPreset.policy.maxElasticLanes}`,
      },
      {
        label: 'Spend score',
        current: `${currentSpendIndex}`,
        next: `${previewScenarioComparison?.scenarioSpend ?? currentSpendIndex}`,
      },
      {
        label: 'Assurance score',
        current: `${currentAssuranceIndex}`,
        next: `${previewScenarioComparison?.scenarioAssurance ?? currentAssuranceIndex}`,
      },
    ].filter((row) => row.current !== row.next),
    [
      currentAssuranceIndex,
      currentSpendIndex,
      previewPreset.policy.maxElasticLanes,
      previewPreset.policy.optimizationGoal,
      previewPreset.policy.reviewPolicy,
      previewScenarioComparison?.scenarioAssurance,
      previewScenarioComparison?.scenarioSpend,
      selectedPolicy.maxElasticLanes,
      selectedPolicy.optimizationGoal,
      selectedPolicy.reviewPolicy,
    ]
  );

  const phaseLearningByArchetype = useMemo(() => {
    const scopedRows = rows.filter((row) => classifyWorkflowArchetype(row.workflowSteps).id === selectedArchetype.id);
    const aggregate = new Map<string, { phase: WorkflowBlockKind; mode: string; runs: number; success: number; credits: number }>();

    scopedRows.forEach((row) => {
      row.runs
        .filter((run) => run.status === 'succeeded' || run.status === 'failed')
        .forEach((run) => {
          readStepExecutions(run.metadata?.stepExecutions).forEach((step) => {
            if (!(step.kind === 'search' || step.kind === 'query' || step.kind === 'capture' || step.kind === 'analyze' || step.kind === 'summarize' || step.kind === 'deliver' || step.kind === 'note')) return;
            const mode = step.directiveMode || 'baseline';
            const key = `${step.kind}:${mode}`;
            const current = aggregate.get(key) || { phase: step.kind, mode, runs: 0, success: 0, credits: 0 };
            current.runs += 1;
            current.success += step.status === 'succeeded' ? 1 : 0;
            current.credits += step.actualCredits || 0;
            aggregate.set(key, current);
          });
        });
    });

    return Array.from(aggregate.values())
      .filter((item) => item.runs >= 2)
      .map((item) => ({
        ...item,
        successRate: item.success / item.runs,
        averageCredits: item.credits / item.runs,
        confidence: clampNumber(Math.round((Math.min(item.runs, 10) / 10) * 100), 10, 100),
        score: clampNumber(Math.round((item.success / item.runs) * 76 + (Math.min(item.runs, 10) / 10) * 18 - (item.credits / item.runs) / 4), 0, 99),
      }))
      .sort((a, b) => b.score - a.score || b.runs - a.runs)
      .slice(0, 6);
  }, [rows, selectedArchetype.id]);

  const learnedPresetLearning = useMemo(() => {
    const scoredRuns = rows.flatMap((row) => {
      const archetype = classifyWorkflowArchetype(row.workflowSteps);
      if (archetype.id !== selectedArchetype.id) return [];
      const policy = normalizeExecutionPolicy(row.automation.execution_policy);
      const presetMatch = POLICY_PRESETS.find((preset) =>
        preset.policy.mode === policy.mode &&
        preset.policy.optimizationGoal === policy.optimizationGoal &&
        preset.policy.reviewPolicy === policy.reviewPolicy &&
        preset.policy.maxElasticLanes === policy.maxElasticLanes
      );
      const automationStudio = normalizeStudioState(row.automation.studio_state);

      return row.runs
        .filter((run) => run.status === 'succeeded' || run.status === 'failed')
        .map((run) => {
          const attribution = getRunExperimentAttribution(run);
          const scenarioId = attribution.scenarioId || automationStudio.selectedScenarioId || 'baseline';
          const presetId = attribution.previewPresetId || presetMatch?.id || 'custom_live';
          return {
            workflowId: row.automation.id,
            scenarioId,
            scenarioLabel: attribution.scenarioLabel || getScenarioLabelFromId(scenarioId),
            presetId,
            presetLabel: attribution.previewPresetLabel || presetMatch?.label || 'Custom live policy',
            run,
          };
        });
    });

    const scenarioScoped = scoredRuns.filter((item) => item.scenarioId === selectedScenario.id);
    const scopedItems = scenarioScoped.length >= 3 ? scenarioScoped : scoredRuns;
    const aggregate = new Map<string, { label: string; workflows: Set<string>; runs: PlatformTaskRunRecord[]; latestAt?: string }>();
    scopedItems.forEach((item) => {
      const current = aggregate.get(item.presetId) || { label: item.presetLabel, workflows: new Set<string>(), runs: [], latestAt: undefined };
      current.workflows.add(item.workflowId);
      current.runs.push(item.run);
      const candidateAt = item.run.finishedAt || item.run.startedAt;
      if (candidateAt && (!current.latestAt || Date.parse(candidateAt) > Date.parse(current.latestAt))) {
        current.latestAt = candidateAt;
      }
      aggregate.set(item.presetId, current);
    });

    return {
      scenarioMatched: scenarioScoped.length >= 3,
      scopeLabel: scenarioScoped.length >= 2 ? `${selectedArchetype.label.toLowerCase()} in ${selectedScenario.label.toLowerCase()}` : selectedArchetype.label.toLowerCase(),
      items: Array.from(aggregate.entries())
        .map(([presetId, value]) => ({
          ...scoreObservedPerformance(summarizeRunCollection(value.runs), value.latestAt),
          presetId,
          label: value.label,
          workflowCount: value.workflows.size,
          runCount: value.runs.length,
          averageSuccess: Math.round(summarizeRunCollection(value.runs).successRate * 100),
          averageCredits: summarizeRunCollection(value.runs).averageCredits,
        }))
        .sort((a, b) => b.score - a.score || b.runCount - a.runCount)
        .slice(0, 4),
    };
  }, [rows, selectedArchetype.id, selectedArchetype.label, selectedScenario.id, selectedScenario.label]);

  const evidenceFreshness = useMemo(() => {
    const latestRunAt = selectedRow?.runs[0]?.finishedAt || selectedRow?.runs[0]?.startedAt;
    const latestExperimentAt = experimentPerformance[0]?.latestAt || experimentHistory[0]?.createdAt;
    const runCount = selectedRow?.runs.filter((run) => run.status === 'succeeded' || run.status === 'failed').length || 0;
    const experimentCount = experimentPerformance.filter((entry) => entry.stats.count > 0).length;
    const freshnessDays = latestRunAt ? Math.max(0, (Date.now() - Date.parse(latestRunAt)) / 86400000) : 999;
    const tone = freshnessDays <= 2 && runCount >= 3 ? 'fresh' : freshnessDays <= 7 && runCount >= 2 ? 'warm' : 'stale';
    return {
      runCount,
      experimentCount,
      latestRunAt,
      latestExperimentAt,
      tone,
      confidence:
        runCount >= 6 && experimentCount >= 2
          ? 'High-confidence learning'
          : runCount >= 3
            ? 'Useful but still maturing'
            : 'Thin evidence',
    };
  }, [experimentHistory, experimentPerformance, selectedRow]);

  const winnerCausalReport = useMemo(() => {
    if (!winningExperiment) return [] as Array<{ title: string; body: string; tone: string }>;
    const insights: Array<{ title: string; body: string; tone: string }> = [];
    if (winningExperiment.stats.successRate >= 0.85) {
      insights.push({
        title: 'It is winning on reliability',
        body: `This setup is landing ${Math.round(winningExperiment.stats.successRate * 100)}% success across ${winningExperiment.stats.count} observed runs, which is strong enough to trust more than a one-off spike.`,
        tone: 'border-emerald-500/18 bg-emerald-500/8 text-emerald-100',
      });
    }
    if (winningExperiment.stats.averageCredits > 0 && currentCohortPerformance && winningExperiment.stats.averageCredits < currentCohortPerformance.stats.averageCredits) {
      insights.push({
        title: 'It is cheaper than the live cohort',
        body: `Average spend is ${formatCredits(winningExperiment.stats.averageCredits)} credits versus ${formatCredits(currentCohortPerformance.stats.averageCredits || 0)} on the live cohort, so the gain is not just cosmetic.`,
        tone: 'border-cyan-500/18 bg-cyan-500/8 text-cyan-100',
      });
    }
    const strongestPhase = phaseLearningByArchetype.find((item) => item.mode !== 'baseline');
    if (strongestPhase) {
      insights.push({
        title: `${formatDirectivePhaseScope([strongestPhase.phase])} carries the edge`,
        body: `${strongestPhase.mode} bias is the strongest observed non-baseline move for this workflow class. That is the best place to apply pressure before changing the whole policy.`,
        tone: 'border-violet-500/18 bg-violet-500/8 text-violet-100',
      });
    }
    if (insights.length === 0) {
      insights.push({
        title: 'The winner is still forming',
        body: 'There is enough signal to rank setups, but not enough to claim a single causal advantage yet. Keep running comparisons before locking the policy.',
        tone: 'border-amber-500/18 bg-amber-500/8 text-amber-100',
      });
    }
    return insights.slice(0, 3);
  }, [currentCohortPerformance, phaseLearningByArchetype, winningExperiment]);

  const phaseCostConfidenceMap = useMemo(() => {
    const maxCredits = Math.max(...phaseEvidence.map((phase) => phase.averageCredits || 0), 1);
    return phaseEvidence.map((phase) => {
      const confidence = clampNumber(Math.round(phase.successRate * 100 * Math.min(1, phase.runs / 5)), 8, 100);
      const costPressure = clampNumber(Math.round(((phase.averageCredits || 0) / maxCredits) * 100), 0, 100);
      const recommendation =
        confidence < 55
          ? 'Needs stronger review or clearer instructions'
          : costPressure > 70
            ? 'Candidate for cheaper routing'
            : 'Healthy phase economics';
      return {
        ...phase,
        confidence,
        costPressure,
        recommendation,
      };
    });
  }, [phaseEvidence]);

  const autoPromotionThreshold = useMemo(() => {
    const scenarioThreshold = selectedStudioState.autoPromotionScenarioThresholds?.[selectedScenario.id];
    if (typeof scenarioThreshold === 'number') return scenarioThreshold;
    const archetypeThreshold = selectedStudioState.autoPromotionArchetypeThresholds?.[selectedArchetype.id];
    if (typeof archetypeThreshold === 'number') return archetypeThreshold;
    return selectedStudioState.autoPromotionMinConfidence ?? 55;
  }, [
    selectedArchetype.id,
    selectedScenario.id,
    selectedStudioState.autoPromotionArchetypeThresholds,
    selectedStudioState.autoPromotionMinConfidence,
    selectedStudioState.autoPromotionScenarioThresholds,
  ]);

  const autoPromotionSuggestion = useMemo(() => {
    if (!winningExperiment || !currentCohortPerformance || winningExperiment.experiment.id === selectedComparisonExperimentId) return null;
    const beatsCurrentOnSuccess = winningExperiment.stats.successRate >= currentCohortPerformance.stats.successRate + 0.08;
    const beatsCurrentOnSpend = winningExperiment.stats.averageCredits > 0 && winningExperiment.stats.averageCredits <= currentCohortPerformance.stats.averageCredits - 6;
    const confidenceStrong = winningExperiment.confidence >= autoPromotionThreshold && evidenceFreshness.tone !== 'stale';
    if (!confidenceStrong || (!beatsCurrentOnSuccess && !beatsCurrentOnSpend)) return null;
    return {
      tone: beatsCurrentOnSuccess ? 'quality' : 'efficiency',
      title: beatsCurrentOnSuccess ? 'Auto-promotion candidate for quality' : 'Auto-promotion candidate for efficiency',
      body: beatsCurrentOnSuccess
        ? `${getExperimentDisplayLabel(winningExperiment.experiment)} is beating the live cohort on success with enough evidence to justify a promotion review.`
        : `${getExperimentDisplayLabel(winningExperiment.experiment)} is running cheaper than the live cohort without losing quality, and the evidence is now strong enough to act on.`,
      experiment: winningExperiment.experiment,
      threshold: autoPromotionThreshold,
    };
  }, [autoPromotionThreshold, currentCohortPerformance, evidenceFreshness.tone, selectedComparisonExperimentId, winningExperiment]);

  const experimentBranches = useMemo(() => {
    const branchCountByParent = new Map<string, number>();
    experimentHistory.forEach((experiment) => {
      if (experiment.parentExperimentId) {
        branchCountByParent.set(experiment.parentExperimentId, (branchCountByParent.get(experiment.parentExperimentId) || 0) + 1);
      }
    });
    return branchCountByParent;
  }, [experimentHistory]);

  const branchFamilyPerformance = useMemo(() => {
    const observedRuns = rows.flatMap((row) => row.runs);
    const families = new Map<string, {
      rootExperiment: StudioExperimentRecord;
      experiments: StudioExperimentRecord[];
      runs: PlatformTaskRunRecord[];
      latestAt?: string;
    }>();

    experimentHistory.forEach((experiment) => {
      const rootId = getExperimentRootId(experiment, experimentHistory);
      const rootExperiment = experimentHistory.find((item) => item.id === rootId) || experiment;
      const current = families.get(rootId) || {
        rootExperiment,
        experiments: [],
        runs: [],
        latestAt: undefined,
      };
      current.experiments.push(experiment);
      const matchedRuns = observedRuns.filter((run) => matchesExperimentRun(run, experiment));
      current.runs.push(...matchedRuns);
      matchedRuns.forEach((run) => {
        const candidateAt = run.finishedAt || run.startedAt;
        if (candidateAt && (!current.latestAt || Date.parse(candidateAt) > Date.parse(current.latestAt))) {
          current.latestAt = candidateAt;
        }
      });
      families.set(rootId, current);
    });

    return Array.from(families.values())
      .map((family) => {
        const uniqueRuns = Array.from(new Map(family.runs.map((run) => [run.id, run])).values());
        const stats = summarizeRunCollection(uniqueRuns);
        const scoring = scoreObservedPerformance(stats, family.latestAt);
        return {
          ...family,
          stats,
          ...scoring,
        };
      })
      .filter((family) => family.experiments.length > 0)
      .sort((a, b) => b.score - a.score || b.stats.count - a.stats.count)
      .slice(0, 6);
  }, [experimentHistory, rows]);

  const selectedBranchFamily = useMemo(() => {
    if (branchFamilyPerformance.length === 0) return undefined;
    return branchFamilyPerformance.find((family) => family.rootExperiment.id === selectedBranchRootId) || branchFamilyPerformance[0];
  }, [branchFamilyPerformance, selectedBranchRootId]);

  const comparedBranchFamily = useMemo(() => {
    if (branchFamilyPerformance.length < 2) return undefined;
    if (comparedBranchRootId) {
      const explicit = branchFamilyPerformance.find((family) => family.rootExperiment.id === comparedBranchRootId);
      if (explicit && explicit.rootExperiment.id !== selectedBranchFamily?.rootExperiment.id) return explicit;
    }
    return branchFamilyPerformance.find((family) => family.rootExperiment.id !== selectedBranchFamily?.rootExperiment.id) || undefined;
  }, [branchFamilyPerformance, comparedBranchRootId, selectedBranchFamily?.rootExperiment.id]);

  const branchTrendSeries = useMemo(() => {
    if (!selectedBranchFamily) return null;
    const orderedRuns = selectedBranchFamily.runs
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .sort((left, right) => Date.parse(right.finishedAt || right.startedAt || '') - Date.parse(left.finishedAt || left.startedAt || ''));
    return buildTrendSeries(orderedRuns, trendMetric, 360, 140, 12);
  }, [selectedBranchFamily, trendMetric]);

  const selectedBranchMemberPerformance = useMemo(() => {
    if (!selectedBranchFamily) return [];
    return selectedBranchFamily.experiments
      .map((experiment) => {
        const matched = experimentPerformance.find((entry) => entry.experiment.id === experiment.id);
        if (matched) return matched;
        const matchedRuns = selectedBranchFamily.runs.filter((run) => matchesExperimentRun(run, experiment));
        const stats = summarizeRunCollection(matchedRuns);
        const latestAt = matchedRuns[0]?.finishedAt || matchedRuns[0]?.startedAt;
        const scoring = scoreObservedPerformance(stats, latestAt);
        return {
          experiment,
          stats,
          latestAt,
          ...scoring,
        };
      })
      .sort((a, b) => b.score - a.score || b.stats.count - a.stats.count);
  }, [experimentPerformance, selectedBranchFamily]);

  const filteredBranchRuns = useMemo(() => {
    if (!selectedBranchFamily) return [];
    return selectedBranchFamily.runs
      .filter((run) => branchRunFilter === 'all' || run.status === branchRunFilter)
      .slice(0, 6);
  }, [branchRunFilter, selectedBranchFamily]);

  const selectedBranchCausalReport = useMemo(() => {
    if (!selectedBranchFamily) return [] as Array<{ title: string; body: string; tone: string }>;
    const items: Array<{ title: string; body: string; tone: string }> = [];
    const stats = selectedBranchFamily.stats;
    if (stats.successRate >= 0.8 && stats.count >= 3) {
      items.push({
        title: 'This branch family is reliably converting',
        body: `${getExperimentDisplayLabel(selectedBranchFamily.rootExperiment)} is holding ${Math.round(stats.successRate * 100)}% success across ${stats.count} observed runs, which is enough to treat it as a meaningful operating line.`,
        tone: 'border-emerald-500/18 bg-emerald-500/8 text-emerald-100',
      });
    }
    if ((stats.averageCredits || 0) > 0 && selectedRow?.averageCredits && stats.averageCredits < selectedRow.averageCredits) {
      items.push({
        title: 'This line is outperforming the workflow average on spend',
        body: `${formatCredits(stats.averageCredits)} credits on average versus ${formatCredits(selectedRow.averageCredits)} across the workflow means this branch is compounding more efficiently than the baseline path.`,
        tone: 'border-cyan-500/18 bg-cyan-500/8 text-cyan-100',
      });
    }
    const strongestMember = selectedBranchMemberPerformance[0];
    if (strongestMember && strongestMember.stats.count >= 2) {
      items.push({
        title: `${getExperimentDisplayLabel(strongestMember.experiment)} is carrying the line`,
        body: `This member currently leads the branch with score ${strongestMember.score}, ${Math.round(strongestMember.stats.successRate * 100)}% success, and ${strongestMember.confidence}% confidence.`,
        tone: 'border-violet-500/18 bg-violet-500/8 text-violet-100',
      });
    }
    if (items.length === 0) {
      items.push({
        title: 'This branch still needs more evidence',
        body: 'The structure is there, but there are not enough branch-specific runs yet to say what is truly compounding. Keep the line alive and compare a few more runs before promoting it.',
        tone: 'border-amber-500/18 bg-amber-500/8 text-amber-100',
      });
    }
    return items.slice(0, 3);
  }, [selectedBranchFamily, selectedBranchMemberPerformance, selectedRow?.averageCredits]);

  const branchFamilyComparison = useMemo(() => {
    if (!selectedBranchFamily || !comparedBranchFamily) return null;
    const leader = selectedBranchFamily.score >= comparedBranchFamily.score ? selectedBranchFamily : comparedBranchFamily;
    const challenger = leader.rootExperiment.id === selectedBranchFamily.rootExperiment.id ? comparedBranchFamily : selectedBranchFamily;
    return {
      leader,
      challenger,
      successDelta: Math.round((leader.stats.successRate - challenger.stats.successRate) * 100),
      creditsDelta: Math.round((leader.stats.averageCredits || 0) - (challenger.stats.averageCredits || 0)),
      confidenceDelta: leader.confidence - challenger.confidence,
    };
  }, [comparedBranchFamily, selectedBranchFamily]);

  const branchComparisonCharts = useMemo(() => {
    if (!branchFamilyComparison) return null;
    const leaderRuns = branchFamilyComparison.leader.runs
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .sort((left, right) => Date.parse(right.finishedAt || right.startedAt || '') - Date.parse(left.finishedAt || left.startedAt || ''));
    const challengerRuns = branchFamilyComparison.challenger.runs
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .sort((left, right) => Date.parse(right.finishedAt || right.startedAt || '') - Date.parse(left.finishedAt || left.startedAt || ''));
    return {
      leader: buildTrendSeries(leaderRuns, trendMetric, 260, 120, 10),
      challenger: buildTrendSeries(challengerRuns, trendMetric, 260, 120, 10),
    };
  }, [branchFamilyComparison, trendMetric]);

  const promotionAudit = useMemo(() => {
    const completedRuns = (selectedRow?.runs || [])
      .filter((run) => run.status === 'succeeded' || run.status === 'failed')
      .sort((left, right) => Date.parse(right.finishedAt || right.startedAt || '') - Date.parse(left.finishedAt || left.startedAt || ''));

    return (selectedStudioState.promotionHistory || [])
      .map((entry) => {
        const appliedAt = Date.parse(entry.appliedAt);
        if (Number.isNaN(appliedAt)) return null;
        const subsequentRuns = completedRuns
          .filter((run) => Date.parse(run.finishedAt || run.startedAt || '') >= appliedAt)
          .slice(0, 3);
        const stats = summarizeRunCollection(subsequentRuns);
        return {
          ...entry,
          subsequentRuns,
          stats,
          outcome:
            subsequentRuns.length === 0
              ? 'No evidence yet'
              : stats.successRate >= 0.8
                ? 'Positive'
                : stats.successRate >= 0.5
                  ? 'Mixed'
                  : 'Weak',
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 8);
  }, [selectedRow?.runs, selectedStudioState.promotionHistory]);

  const gateProfileLearning = useMemo(() => {
    const scopedRows = rows.filter((row) => classifyWorkflowArchetype(row.workflowSteps).id === selectedArchetype.id);
    const now = Date.now();
    const maxAgeDays = gateLearningWindow === 'recent' ? 14 : gateLearningWindow === 'deep' ? 45 : Infinity;
    const runRecords = scopedRows.flatMap((row) => {
      const rowStudioState = normalizeStudioState(row.automation.studio_state);
      return row.runs
        .filter((run) => run.status === 'succeeded' || run.status === 'failed')
        .filter((run) => {
          if (!Number.isFinite(maxAgeDays)) return true;
          const runAt = Date.parse(run.finishedAt || run.startedAt || '');
          if (Number.isNaN(runAt)) return false;
          return ((now - runAt) / 86400000) <= maxAgeDays;
        })
        .map((run) => {
          const attribution = getRunExperimentAttribution(run);
          const scenarioId = attribution.scenarioId || rowStudioState.selectedScenarioId || 'baseline';
          const profileId = inferPromotionGateProfileId(rowStudioState, scenarioId, selectedArchetype.id);
          return {
            workflowId: row.automation.id,
            scenarioId,
            profileId,
            run,
          };
        });
    });

    const scenarioScopedRuns = runRecords.filter((item) => item.scenarioId === selectedScenario.id);
    const scopedRecords = scenarioScopedRuns.length >= 3 ? scenarioScopedRuns : runRecords;
    const aggregate = new Map<string, { runs: PlatformTaskRunRecord[]; workflows: Set<string>; latestAt?: string }>();

    scopedRecords.forEach((item) => {
      const current = aggregate.get(item.profileId) || { runs: [], workflows: new Set<string>(), latestAt: undefined };
      current.runs.push(item.run);
      current.workflows.add(item.workflowId);
      const candidateAt = item.run.finishedAt || item.run.startedAt;
      if (candidateAt && (!current.latestAt || Date.parse(candidateAt) > Date.parse(current.latestAt))) {
        current.latestAt = candidateAt;
      }
      aggregate.set(item.profileId, current);
    });

    const items = Array.from(aggregate.entries())
      .map(([profileId, value]) => {
        const profile = getPromotionGateProfileById(profileId);
        if (!profile) return null;
        const stats = summarizeRunCollection(value.runs);
        const scoring = scoreObservedPerformance(stats, value.latestAt);
        return {
          profile,
          stats,
          latestAt: value.latestAt,
          workflowCount: value.workflows.size,
          ...scoring,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.score - left.score || right.confidence - left.confidence || right.stats.count - left.stats.count);

    return {
      scenarioMatched: scenarioScopedRuns.length >= 3,
      scopeLabel: scenarioScopedRuns.length >= 3
        ? `${selectedArchetype.label.toLowerCase()} in ${selectedScenario.label.toLowerCase()}`
        : selectedArchetype.label.toLowerCase(),
      windowLabel: gateLearningWindow === 'recent' ? 'last 14 days' : gateLearningWindow === 'deep' ? 'last 45 days' : 'all observed history',
      items: items.slice(0, 3),
      recommendedProfile: items[0]?.profile,
    };
  }, [gateLearningWindow, rows, selectedArchetype.id, selectedArchetype.label, selectedScenario.id, selectedScenario.label]);

  const rollbackSuggestion = useMemo(() => {
    const weak = promotionAudit.find((entry) => entry.outcome === 'Weak');
    if (!weak) return null;
    const weakIndex = promotionAudit.findIndex((entry) => entry.id === weak.id);
    const priorPromotionTarget = promotionAudit
      .slice(weakIndex + 1)
      .map((entry) => experimentHistory.find((experiment) => experiment.id === entry.sourceExperimentId))
      .find((experiment): experiment is StudioExperimentRecord => Boolean(experiment));
    const alternateWinningTarget = experimentPerformance.find((entry) => entry.experiment.id !== weak.sourceExperimentId && entry.stats.count > 0)?.experiment;
    const restoreExperiment = priorPromotionTarget || alternateWinningTarget || (winningExperiment?.experiment.id !== weak.sourceExperimentId ? winningExperiment?.experiment : undefined);
    return {
      title: 'Rollback candidate detected',
      body: restoreExperiment
        ? `${weak.summary} has weak follow-through across ${weak.subsequentRuns.length} subsequent runs. Best restore target right now is ${getExperimentDisplayLabel(restoreExperiment)}.`
        : `${weak.summary} has weak follow-through across ${weak.subsequentRuns.length} subsequent runs. This is a good candidate to unwind or retest before it hardens into the live policy.`,
      entry: weak,
      restoreExperiment,
    };
  }, [experimentHistory, experimentPerformance, promotionAudit, winningExperiment]);

  const replayWeakSpot = useMemo(() => {
    const failingPhase = phaseEvidence
      .filter((phase) => phase.runs >= 2)
      .sort((left, right) => left.successRate - right.successRate || right.runs - left.runs)[0];
    if (!failingPhase) return null;
    const recommendedMode: 'review' | 'cheaper' | 'promote' =
      failingPhase.successRate < 0.65 ? 'review' : failingPhase.averageCredits > 18 ? 'cheaper' : 'promote';
    return {
      phase: failingPhase.phase,
      title: `${formatDirectivePhaseScope([failingPhase.phase])} is the weak link`,
      body: `${formatDirectivePhaseScope([failingPhase.phase])} is only landing ${Math.round(failingPhase.successRate * 100)}% of the time across ${failingPhase.runs} observed steps. Best next move is ${getDirectiveModeLabel(recommendedMode).toLowerCase()} on ${getPreferredRoleForPhase(failingPhase.phase)}.`,
      recommendedMode,
    };
  }, [phaseEvidence]);

  const nextExperimentQueue = useMemo(() => {
    const queue: Array<{
      id: string;
      title: string;
      body: string;
      sourceLabel: string;
      phase?: WorkflowBlockKind;
      mode?: 'cheaper' | 'review' | 'promote';
      action?: 'simulate_phase' | 'focus_phase' | 'apply_policy';
      policyAction?: 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none';
    }> = [];

    if (replayWeakSpot) {
      queue.push({
        id: `weak-${replayWeakSpot.phase}`,
        title: `Stress-test ${formatDirectivePhaseScope([replayWeakSpot.phase])}`,
        body: replayWeakSpot.body,
        sourceLabel: 'Replay weak spot',
        phase: replayWeakSpot.phase,
        mode: replayWeakSpot.recommendedMode,
        action: 'simulate_phase',
      });
    }

    workflowDiagnostics.wasteItems
      .filter((item) => item.action !== 'none')
      .slice(0, 1)
      .forEach((item, index) => {
        queue.push({
          id: `waste-${index}`,
          title: item.title,
          body: item.body,
          sourceLabel: 'Waste diagnostic',
          action: 'apply_policy',
          policyAction: item.action,
        });
      });

    workflowDiagnostics.riskItems
      .filter((item) => item.action !== 'none')
      .slice(0, 1)
      .forEach((item, index) => {
        queue.push({
          id: `risk-${index}`,
          title: item.title,
          body: item.body,
          sourceLabel: 'Risk diagnostic',
          action: 'apply_policy',
          policyAction: item.action,
        });
      });

    phaseLearningByArchetype
      .filter((item) => item.mode !== 'baseline')
      .slice(0, 2)
      .forEach((item) => {
        queue.push({
          id: `learn-${item.phase}-${item.mode}`,
          title: `Replay-test ${formatDirectivePhaseScope([item.phase])}`,
          body: `${getDirectiveModeLabel(item.mode as 'cheaper' | 'review' | 'promote')} is outperforming baseline for this workflow class with ${item.confidence}% confidence.`,
          sourceLabel: 'Phase learning',
          phase: item.phase,
          mode: item.mode as 'cheaper' | 'review' | 'promote',
          action: 'focus_phase',
        });
      });

    if (selectedBranchFamily && selectedBranchFamily.stats.count >= 2) {
      const weakestBranchPhase = phaseEvidence
        .filter((phase) => phase.runs >= 2)
        .sort((left, right) => left.successRate - right.successRate || right.averageCredits - left.averageCredits)[0];
      if (weakestBranchPhase) {
        queue.push({
          id: `branch-${selectedBranchFamily.rootExperiment.id}-${weakestBranchPhase.phase}`,
          title: `Fork a fix for ${formatDirectivePhaseScope([weakestBranchPhase.phase])}`,
          body: `${getExperimentDisplayLabel(selectedBranchFamily.rootExperiment)} has enough evidence to branch. Best next test is a targeted ${getDirectiveModeLabel(weakestBranchPhase.successRate < 0.68 ? 'review' : 'cheaper').toLowerCase()} on ${formatDirectivePhaseScope([weakestBranchPhase.phase])}.`,
          sourceLabel: 'Branch opportunity',
          phase: weakestBranchPhase.phase,
          mode: weakestBranchPhase.successRate < 0.68 ? 'review' : 'cheaper',
          action: 'simulate_phase',
        });
      }
    }

    return queue.slice(0, 5);
  }, [phaseEvidence, phaseLearningByArchetype, replayWeakSpot, selectedBranchFamily, workflowDiagnostics.riskItems, workflowDiagnostics.wasteItems]);

  const gateLearningComparison = useMemo(() => {
    const windows: GateLearningWindow[] = ['recent', 'deep', 'all'];
    const computeWindow = (window: GateLearningWindow) => {
      const now = Date.now();
      const maxAgeDays = window === 'recent' ? 14 : window === 'deep' ? 45 : Infinity;
      const scopedRows = rows.filter((row) => classifyWorkflowArchetype(row.workflowSteps).id === selectedArchetype.id);
      const runs = scopedRows.flatMap((row) => {
        const rowStudioState = normalizeStudioState(row.automation.studio_state);
        return row.runs
          .filter((run) => run.status === 'succeeded' || run.status === 'failed')
          .filter((run) => {
            if (!Number.isFinite(maxAgeDays)) return true;
            const runAt = Date.parse(run.finishedAt || run.startedAt || '');
            return !Number.isNaN(runAt) && ((now - runAt) / 86400000) <= maxAgeDays;
          })
          .map((run) => {
            const attribution = getRunExperimentAttribution(run);
            const scenarioId = attribution.scenarioId || rowStudioState.selectedScenarioId || 'baseline';
            const profileId = inferPromotionGateProfileId(rowStudioState, scenarioId, selectedArchetype.id);
            return { profileId, run, workflowId: row.automation.id, scenarioId };
          });
      });
      const scenarioScoped = runs.filter((item) => item.scenarioId === selectedScenario.id);
      const active = scenarioScoped.length >= 3 ? scenarioScoped : runs;
      const aggregate = new Map<string, { runs: PlatformTaskRunRecord[]; workflows: Set<string>; latestAt?: string }>();
      active.forEach((item) => {
        const current = aggregate.get(item.profileId) || { runs: [], workflows: new Set<string>(), latestAt: undefined };
        current.runs.push(item.run);
        current.workflows.add(item.workflowId);
        const candidateAt = item.run.finishedAt || item.run.startedAt;
        if (candidateAt && (!current.latestAt || Date.parse(candidateAt) > Date.parse(current.latestAt))) {
          current.latestAt = candidateAt;
        }
        aggregate.set(item.profileId, current);
      });
      const leader = Array.from(aggregate.entries())
        .map(([profileId, value]) => {
          const profile = getPromotionGateProfileById(profileId);
          if (!profile) return null;
          return {
            profile,
            workflowCount: value.workflows.size,
            stats: summarizeRunCollection(value.runs),
            ...scoreObservedPerformance(summarizeRunCollection(value.runs), value.latestAt),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((left, right) => right.score - left.score || right.confidence - left.confidence)[0];
      return {
        window,
        label: window === 'recent' ? 'Recent' : window === 'deep' ? 'Deep' : 'All',
        leader,
      };
    };

    const windowsResult = windows.map(computeWindow);
    const uniqueLeaders = [...new Set(windowsResult.map((item) => item.leader?.profile.id).filter(Boolean))];
    return {
      windows: windowsResult,
      stability: uniqueLeaders.length <= 1 ? 'Stable' : uniqueLeaders.length === 2 ? 'Mixed' : 'Diverging',
    };
  }, [rows, selectedArchetype.id, selectedScenario.id]);

  const recommendedGateProfile = useMemo(() => {
    if (gateProfileLearning.recommendedProfile && gateProfileLearning.items[0]?.stats.count >= 2) {
      return gateProfileLearning.recommendedProfile;
    }
    if (selectedScenario.id === 'high_stakes' || selectedPolicy.reviewPolicy === 'strict') {
      return PROMOTION_GATE_PROFILES.find((item) => item.id === 'conservative');
    }
    if (evidenceFreshness.tone === 'stale' || (selectedRow?.successRate || 0) < 0.65) {
      return PROMOTION_GATE_PROFILES.find((item) => item.id === 'conservative');
    }
    if (selectedScenario.id === 'monitoring' || selectedPolicy.optimizationGoal === 'cost_saver') {
      return PROMOTION_GATE_PROFILES.find((item) => item.id === 'aggressive');
    }
    return PROMOTION_GATE_PROFILES.find((item) => item.id === 'balanced');
  }, [evidenceFreshness.tone, gateProfileLearning.items, gateProfileLearning.recommendedProfile, selectedPolicy.optimizationGoal, selectedPolicy.reviewPolicy, selectedRow?.successRate, selectedScenario.id]);

  const activeGateScope = useMemo(() => {
    if (selectedStudioState.autoPromotionScenarioThresholds?.[selectedScenario.id]) {
      return { scope: 'Scenario gate', label: selectedScenario.label };
    }
    if (selectedStudioState.autoPromotionArchetypeThresholds?.[selectedArchetype.id]) {
      return { scope: 'Workflow-class gate', label: selectedArchetype.label };
    }
    return { scope: 'Global gate', label: 'All workflows' };
  }, [
    selectedArchetype.id,
    selectedArchetype.label,
    selectedScenario.id,
    selectedScenario.label,
    selectedStudioState.autoPromotionArchetypeThresholds,
    selectedStudioState.autoPromotionScenarioThresholds,
  ]);

  const replayPhaseOverlay = useMemo(() => {
    const run = focusedCohortRun || selectedCohortRun;
    if (!run) return [];
    const phaseOrder: WorkflowBlockKind[] = ['search', 'query', 'capture', 'analyze', 'summarize', 'deliver', 'note'];
    const grouped = phaseOrder
      .map((phase) => {
        const steps = readStepExecutions(run.metadata?.stepExecutions).filter((step) => step.kind === phase);
        if (steps.length === 0) return null;
        const credits = steps.reduce((sum, step) => sum + (step.actualCredits || 0), 0);
        const durationMs = steps.reduce((sum, step) => sum + (step.durationMs || 0), 0);
        const tokens = steps.reduce((sum, step) => sum + (step.tokenUsage?.totalTokens || 0), 0);
        const failed = steps.some((step) => step.status === 'failed');
        const succeeded = steps.some((step) => step.status === 'succeeded');
        const primaryStep = steps
          .slice()
          .sort((left, right) => (right.actualCredits || 0) - (left.actualCredits || 0))[0];
        return {
          phase,
          steps,
          credits,
          durationMs,
          tokens,
          failed,
          succeeded,
          primaryRole: primaryStep?.assignedRole || getPreferredRoleForPhase(phase),
          modelSource: primaryStep?.modelSource,
          directiveMode: primaryStep?.directiveMode,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const maxCredits = Math.max(...grouped.map((item) => item.credits || 0), 1);
    return grouped.map((item) => ({
      ...item,
      costWidth: `${Math.max(16, ((item.credits || 0) / maxCredits) * 100)}%`,
    }));
  }, [focusedCohortRun, selectedCohortRun]);

  const selectedReplayPhaseDetail = useMemo(() => {
    if (selectedReplayPhase === 'all') return replayPhaseOverlay[0];
    return replayPhaseOverlay.find((entry) => entry.phase === selectedReplayPhase) || replayPhaseOverlay[0];
  }, [replayPhaseOverlay, selectedReplayPhase]);

  const branchOpportunityMap = useMemo(() => {
    const baselineCredits = selectedRow?.averageCredits || 0;
    return branchFamilyPerformance.slice(0, 4).map((family) => {
      const weakestPhase = phaseEvidence
        .filter((phase) => phase.runs >= 2)
        .sort((left, right) => left.successRate - right.successRate || right.averageCredits - left.averageCredits)[0];
      return {
        id: family.rootExperiment.id,
        label: getExperimentDisplayLabel(family.rootExperiment),
        score: family.score,
        confidence: family.confidence,
        successRate: Math.round(family.stats.successRate * 100),
        spendDelta: Math.round((family.stats.averageCredits || 0) - baselineCredits),
        focusPhase: weakestPhase?.phase,
      };
    });
  }, [branchFamilyPerformance, phaseEvidence, selectedRow?.averageCredits]);

  const savedPlanSummaries = useMemo(() => {
    return savedOperatingPlans.map((plan) => {
      const spendIndex = estimatePolicySpendIndex(plan.executionPolicy, selectedRow?.workflowSteps || []);
      const assuranceIndex = estimatePolicyAssuranceIndex(plan.executionPolicy, selectedRow?.workflowSteps || []);
      const fitIndex = estimatePolicyFitIndex(plan.executionPolicy, selectedRow?.workflowSteps || []);
      const sourceExperiment = plan.sourceExperimentId
        ? experimentHistory.find((experiment) => experiment.id === plan.sourceExperimentId)
        : undefined;
      return {
        plan,
        spendIndex,
        assuranceIndex,
        fitIndex,
        steeringCount: countDirectiveEntries(plan.roleDirectives),
        sourceExperiment,
      };
    });
  }, [experimentHistory, savedOperatingPlans, selectedRow?.workflowSteps]);

  const activeSavedPlan = useMemo(
    () => savedPlanSummaries.find((entry) => entry.plan.id === selectedPlanId) || savedPlanSummaries[0],
    [savedPlanSummaries, selectedPlanId]
  );

  const patchAutomationConfig = useCallback(async (patch: {
    executionPolicy?: AutomationExecutionPolicyDraft;
    studioState?: AutomationStudioStateDraft;
  }, options?: { successMessage?: string; suppressBusy?: boolean }) => {
    if (!selectedRow) return;
    if (options?.suppressBusy) {
      setStudioBusy(true);
    } else {
      setActionBusy(true);
    }
    try {
      const response = await fetch(`/api/automations/${selectedRow.automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionPolicy: patch.executionPolicy,
          studioState: patch.studioState,
        }),
      });
      if (!response.ok) throw new Error('Could not update execution policy');
      await loadData(true);
      if (options?.successMessage) {
        setNotice({ tone: 'success', message: options.successMessage });
      }
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not update agent policy.' });
    } finally {
      if (options?.suppressBusy) {
        setStudioBusy(false);
      } else {
        setActionBusy(false);
      }
    }
  }, [loadData, selectedRow]);

  const patchExecutionPolicy = useCallback(async (next: AutomationExecutionPolicyDraft) => {
    await patchAutomationConfig({ executionPolicy: next }, { successMessage: 'Updated agent policy.' });
  }, [patchAutomationConfig]);

  const updateStudioState = useCallback(async (next: AutomationStudioStateDraft, successMessage?: string) => {
    await patchAutomationConfig({ studioState: next }, { successMessage, suppressBusy: !successMessage });
  }, [patchAutomationConfig]);

  const handleSetScopedAutoPromotionThreshold = useCallback((
    scope: 'global' | 'scenario' | 'archetype',
    threshold: number,
  ) => {
    const nextState: AutomationStudioStateDraft = { ...selectedStudioState };
    let message = `Auto-promotion gate set to ${threshold}% confidence.`;

    if (scope === 'scenario') {
      nextState.autoPromotionScenarioThresholds = {
        ...(selectedStudioState.autoPromotionScenarioThresholds || {}),
        [selectedScenario.id]: threshold,
      };
      message = `${selectedScenario.label} gate set to ${threshold}% confidence.`;
    } else if (scope === 'archetype') {
      nextState.autoPromotionArchetypeThresholds = {
        ...(selectedStudioState.autoPromotionArchetypeThresholds || {}),
        [selectedArchetype.id]: threshold,
      };
      message = `${selectedArchetype.label} gate set to ${threshold}% confidence.`;
    } else {
      nextState.autoPromotionMinConfidence = threshold;
      message = `Global auto-promotion gate set to ${threshold}% confidence.`;
    }

    void updateStudioState(nextState, message);
  }, [selectedArchetype.id, selectedArchetype.label, selectedScenario.id, selectedScenario.label, selectedStudioState, updateStudioState]);

  const handleClearScopedAutoPromotionThreshold = useCallback((scope: 'global' | 'scenario' | 'archetype') => {
    const nextState: AutomationStudioStateDraft = { ...selectedStudioState };
    let message = 'Reset auto-promotion gate.';

    if (scope === 'scenario') {
      nextState.autoPromotionScenarioThresholds = omitThresholdKey(selectedStudioState.autoPromotionScenarioThresholds, selectedScenario.id);
      message = `Reset ${selectedScenario.label} back to the inherited gate.`;
    } else if (scope === 'archetype') {
      nextState.autoPromotionArchetypeThresholds = omitThresholdKey(selectedStudioState.autoPromotionArchetypeThresholds, selectedArchetype.id);
      message = `Reset ${selectedArchetype.label} back to the inherited gate.`;
    } else {
      nextState.autoPromotionMinConfidence = undefined;
      message = 'Reset the global auto-promotion gate to the default.';
    }

    void updateStudioState(nextState, message);
  }, [
    selectedArchetype.id,
    selectedArchetype.label,
    selectedScenario.id,
    selectedScenario.label,
    selectedStudioState,
    updateStudioState,
  ]);

  const handleApplyGateProfile = useCallback((profileId: typeof PROMOTION_GATE_PROFILES[number]['id']) => {
    const profile = PROMOTION_GATE_PROFILES.find((item) => item.id === profileId);
    if (!profile) return;
    void updateStudioState({
      ...selectedStudioState,
      autoPromotionMinConfidence: profile.global,
      autoPromotionArchetypeThresholds: {
        ...(selectedStudioState.autoPromotionArchetypeThresholds || {}),
        [selectedArchetype.id]: profile.archetype,
      },
      autoPromotionScenarioThresholds: {
        ...(selectedStudioState.autoPromotionScenarioThresholds || {}),
        [selectedScenario.id]: profile.scenario,
      },
    }, `Applied the ${profile.label.toLowerCase()} gate profile.`);
  }, [selectedArchetype.id, selectedScenario.id, selectedStudioState, updateStudioState]);

  useEffect(() => {
    if (!selectedRow?.automation.id) return undefined;
    const currentScenarioId = selectedStudioState.selectedScenarioId || 'baseline';
    const currentPresetId = selectedStudioState.previewPresetId || (activePresetId === 'custom_live' ? 'recommended' : activePresetId);
    if (currentScenarioId === selectedScenarioId && currentPresetId === previewPresetId) return undefined;
    const timeout = window.setTimeout(() => {
      void updateStudioState({
        ...selectedStudioState,
        selectedScenarioId,
        previewPresetId,
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    activePresetId,
    previewPresetId,
    selectedRow?.automation.id,
    selectedScenarioId,
    selectedStudioState,
    updateStudioState,
  ]);

  useEffect(() => {
    if (!selectedRow?.automation.id) return undefined;
    const nextRoom = activeRoom || undefined;
    const nextPlanId = selectedPlanId || undefined;
    const nextReplayPhase = selectedReplayPhase || undefined;
    const nextWorkerRole = selectedWorkerRole || undefined;
    const nextDirectivePhase = selectedDirectivePhase || undefined;
    const nextPhaseSimulation = phaseSimulation || undefined;
    const nextExperimentId = selectedComparisonExperimentId || undefined;
    const nextRunId = selectedCohortRunId || undefined;
    const nextMetric = trendMetric || undefined;
    const nextGateWindow = gateLearningWindow || undefined;
    const nextBranchFilter = branchRunFilter || undefined;
    if (
      (selectedStudioState.activeRoom || undefined) === nextRoom &&
      (selectedStudioState.selectedPlanId || undefined) === nextPlanId &&
      (selectedStudioState.selectedReplayPhase || undefined) === nextReplayPhase &&
      (selectedStudioState.selectedWorkerRole || undefined) === nextWorkerRole &&
      (selectedStudioState.selectedDirectivePhase || undefined) === nextDirectivePhase &&
      JSON.stringify(selectedStudioState.phaseSimulation || undefined) === JSON.stringify(nextPhaseSimulation) &&
      (selectedStudioState.selectedComparisonExperimentId || undefined) === nextExperimentId &&
      (selectedStudioState.selectedCohortRunId || undefined) === nextRunId &&
      (selectedStudioState.trendMetric || undefined) === nextMetric &&
      (selectedStudioState.gateLearningWindow || undefined) === nextGateWindow &&
      (selectedStudioState.branchRunFilter || undefined) === nextBranchFilter
    ) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      void updateStudioState({
        ...selectedStudioState,
        activeRoom: nextRoom,
        selectedPlanId: nextPlanId,
        selectedReplayPhase: nextReplayPhase,
        selectedWorkerRole: nextWorkerRole,
        selectedDirectivePhase: nextDirectivePhase,
        phaseSimulation: nextPhaseSimulation,
        selectedComparisonExperimentId: nextExperimentId,
        selectedCohortRunId: nextRunId,
        trendMetric: nextMetric,
        gateLearningWindow: nextGateWindow,
        branchRunFilter: nextBranchFilter,
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    activeRoom,
    branchRunFilter,
    gateLearningWindow,
    phaseSimulation,
    selectedPlanId,
    selectedComparisonExperimentId,
    selectedCohortRunId,
    selectedDirectivePhase,
    selectedReplayPhase,
    selectedRow?.automation.id,
    selectedWorkerRole,
    selectedStudioState,
    trendMetric,
    updateStudioState,
  ]);

  useEffect(() => {
    if (!selectedRow?.automation.id) return undefined;
    const nextPrimary = selectedBranchRootId || undefined;
    const nextCompared = comparedBranchRootId && comparedBranchRootId !== selectedBranchRootId ? comparedBranchRootId : undefined;
    if ((selectedStudioState.selectedBranchRootId || undefined) === nextPrimary && (selectedStudioState.comparedBranchRootId || undefined) === nextCompared) {
      return undefined;
    }
    if (!nextPrimary && !nextCompared) return undefined;
    const timeout = window.setTimeout(() => {
      void updateStudioState({
        ...selectedStudioState,
        selectedBranchRootId: nextPrimary,
        comparedBranchRootId: nextCompared,
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    comparedBranchRootId,
    selectedBranchRootId,
    selectedRow?.automation.id,
    selectedStudioState,
    updateStudioState,
  ]);

  useEffect(() => {
    if (branchFamilyPerformance.length === 0) return;
    if (selectedBranchRootId && branchFamilyPerformance.some((family) => family.rootExperiment.id === selectedBranchRootId)) return;
    setSelectedBranchRootId(branchFamilyPerformance[0].rootExperiment.id);
  }, [branchFamilyPerformance, selectedBranchRootId]);

  useEffect(() => {
    if (branchFamilyPerformance.length < 2) return;
    if (comparedBranchRootId && branchFamilyPerformance.some((family) => family.rootExperiment.id === comparedBranchRootId && family.rootExperiment.id !== selectedBranchRootId)) return;
    const fallback = branchFamilyPerformance.find((family) => family.rootExperiment.id !== selectedBranchRootId);
    if (fallback) setComparedBranchRootId(fallback.rootExperiment.id);
  }, [branchFamilyPerformance, comparedBranchRootId, selectedBranchRootId]);

  const handleRouteCheaper = useCallback(() => {
    const nextLaneCap =
      selectedWorkerDetail.worker?.laneType === 'elastic'
        ? Math.max(1, Math.min(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes))
        : selectedPolicy.maxElasticLanes;
    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      optimizationGoal: 'cost_saver',
      reviewPolicy: selectedPolicy.reviewPolicy === 'strict' ? 'standard' : selectedPolicy.reviewPolicy,
      maxElasticLanes: nextLaneCap,
    };
    const role = selectedWorkerDetail.worker?.role;
    const directivePhases = selectedDirectivePhase === 'all' ? undefined : [selectedDirectivePhase];
    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: role
          ? {
              ...(selectedStudioState.roleDirectives || {}),
              [role]: { mode: 'cheaper', phases: directivePhases, updatedAt: new Date().toISOString() },
            }
          : selectedStudioState.roleDirectives,
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'learning',
          summary: `Shifted ${role || 'this role'} cheaper for ${formatDirectivePhaseScope(directivePhases)}.`,
          phase: directivePhases?.[0],
        }),
      },
    }, { successMessage: `Shifted this role toward cheaper routing for ${formatDirectivePhaseScope(directivePhases)}.` });
  }, [patchAutomationConfig, selectedDirectivePhase, selectedMath.recommendedElasticLanes, selectedPolicy, selectedStudioState, selectedWorkerDetail.worker?.laneType, selectedWorkerDetail.worker?.role]);

  const handleIncreaseReview = useCallback(() => {
    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      reviewPolicy: 'strict',
      optimizationGoal: selectedPolicy.optimizationGoal === 'cost_saver' ? 'balanced' : selectedPolicy.optimizationGoal,
    };
    const role = selectedWorkerDetail.worker?.role;
    const directivePhases = selectedDirectivePhase === 'all' ? undefined : [selectedDirectivePhase];
    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: role
          ? {
              ...(selectedStudioState.roleDirectives || {}),
              [role]: { mode: 'review', phases: directivePhases, updatedAt: new Date().toISOString() },
            }
          : selectedStudioState.roleDirectives,
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'learning',
          summary: `Raised review on ${role || 'this role'} for ${formatDirectivePhaseScope(directivePhases)}.`,
          phase: directivePhases?.[0],
        }),
      },
    }, { successMessage: `Raised review pressure for ${formatDirectivePhaseScope(directivePhases)}.` });
  }, [patchAutomationConfig, selectedDirectivePhase, selectedPolicy, selectedStudioState, selectedWorkerDetail.worker?.role]);

  const handlePromoteLane = useCallback(() => {
    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      optimizationGoal: 'quality_first',
      maxElasticLanes: Math.min(4, Math.max(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes) + 1),
    };
    const role = selectedWorkerDetail.worker?.role;
    const directivePhases = selectedDirectivePhase === 'all' ? undefined : [selectedDirectivePhase];
    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: role
          ? {
              ...(selectedStudioState.roleDirectives || {}),
              [role]: { mode: 'promote', phases: directivePhases, updatedAt: new Date().toISOString() },
            }
          : selectedStudioState.roleDirectives,
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'learning',
          summary: `Promoted ${role || 'this role'} for ${formatDirectivePhaseScope(directivePhases)}.`,
          phase: directivePhases?.[0],
        }),
      },
    }, { successMessage: `Promoted this lane for ${formatDirectivePhaseScope(directivePhases)}.` });
  }, [patchAutomationConfig, selectedDirectivePhase, selectedMath.recommendedElasticLanes, selectedPolicy, selectedStudioState, selectedWorkerDetail.worker?.role]);

  const handleClearRoleDirective = useCallback(() => {
    const role = selectedWorkerDetail.worker?.role;
    if (!role || !selectedStudioState.roleDirectives?.[role]) return;
    const nextDirectives = { ...(selectedStudioState.roleDirectives || {}) };
    delete nextDirectives[role];
    void updateStudioState({
      ...selectedStudioState,
      roleDirectives: Object.keys(nextDirectives).length > 0 ? nextDirectives : undefined,
      promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
        mode: 'learning',
        summary: `Cleared steering on ${role}.`,
        phase: selectedDirectivePhase === 'all' ? undefined : selectedDirectivePhase,
      }),
    }, `Cleared steering on ${role}.`);
  }, [selectedDirectivePhase, selectedStudioState, selectedWorkerDetail.worker?.role, updateStudioState]);

  const applyRecommendationAction = useCallback((action: 'lean_ops' | 'raise_review' | 'match_lanes' | 'trim_lanes' | 'none') => {
    if (action === 'none') return;
    if (action === 'lean_ops') {
      void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', optimizationGoal: 'cost_saver', reviewPolicy: selectedPolicy.reviewPolicy === 'strict' ? 'standard' : selectedPolicy.reviewPolicy, maxElasticLanes: Math.min(selectedPolicy.maxElasticLanes, Math.max(1, selectedMath.recommendedElasticLanes)) });
      return;
    }
    if (action === 'raise_review') {
      void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', optimizationGoal: selectedPolicy.optimizationGoal === 'cost_saver' ? 'balanced' : selectedPolicy.optimizationGoal, reviewPolicy: 'strict' });
      return;
    }
    if (action === 'match_lanes') {
      void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', maxElasticLanes: selectedMath.recommendedElasticLanes });
      return;
    }
    if (action === 'trim_lanes') {
      void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', maxElasticLanes: Math.max(0, selectedMath.recommendedElasticLanes) });
    }
  }, [patchExecutionPolicy, selectedMath.recommendedElasticLanes, selectedPolicy]);

  const handlePromoteExperimentPresetAndPhase = useCallback((experiment: StudioExperimentRecord, phase: WorkflowBlockKind) => {
    const preset = POLICY_PRESETS.find((item) => item.id === experiment.previewPresetId);
    const phaseDirectives = extractPhaseDirectiveSnapshot(experiment.roleDirectives, phase);
    if (!preset) {
      setNotice({ tone: 'error', message: 'This experiment no longer matches an available preset.' });
      return;
    }
    if (!phaseDirectives) {
      setNotice({ tone: 'error', message: `No saved steering for ${formatDirectivePhaseScope([phase])} in this experiment.` });
      return;
    }
    setSelectedComparisonExperimentId(experiment.id);
    void patchAutomationConfig({
      executionPolicy: preset.policy,
      studioState: {
        ...selectedStudioState,
        selectedScenarioId: experiment.scenarioId,
        previewPresetId: experiment.previewPresetId,
        roleDirectives: mergeRoleDirectiveSnapshots(selectedStudioState.roleDirectives, phaseDirectives),
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'preset_phase',
          summary: `Promoted ${formatDirectivePhaseScope([phase])} plus preset from ${getExperimentDisplayLabel(experiment)}.`,
          sourceExperimentId: experiment.id,
          sourceExperimentLabel: getExperimentDisplayLabel(experiment),
          phase,
        }),
      },
    }, { successMessage: `Promoted ${formatDirectivePhaseScope([phase])} plus the experiment preset.` });
  }, [patchAutomationConfig, selectedStudioState]);

  const handlePromoteExperimentPhase = useCallback((experiment: StudioExperimentRecord, phase: WorkflowBlockKind) => {
    const phaseDirectives = extractPhaseDirectiveSnapshot(experiment.roleDirectives, phase);
    if (!phaseDirectives) {
      setNotice({ tone: 'error', message: `No saved steering for ${formatDirectivePhaseScope([phase])} in this experiment.` });
      return;
    }
    setSelectedComparisonExperimentId(experiment.id);
    void updateStudioState({
      ...selectedStudioState,
      selectedScenarioId: experiment.scenarioId,
      previewPresetId: experiment.previewPresetId,
      roleDirectives: mergeRoleDirectiveSnapshots(selectedStudioState.roleDirectives, phaseDirectives),
      promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
        mode: 'phase',
        summary: `Promoted ${formatDirectivePhaseScope([phase])} steering from ${getExperimentDisplayLabel(experiment)}.`,
        sourceExperimentId: experiment.id,
        sourceExperimentLabel: getExperimentDisplayLabel(experiment),
        phase,
      }),
    }, `Promoted ${formatDirectivePhaseScope([phase])} steering from this experiment.`);
  }, [selectedStudioState, updateStudioState]);

  const handleApplyPhaseLearning = useCallback((phase: WorkflowBlockKind, mode: 'cheaper' | 'review' | 'promote') => {
    const role = getPreferredRoleForPhase(phase);
    setSelectedDirectivePhase(phase);
    setSelectedWorkerRole(role);
    setActiveRoom('live');

    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      optimizationGoal:
        mode === 'cheaper'
          ? 'cost_saver'
          : mode === 'review'
            ? (selectedPolicy.optimizationGoal === 'cost_saver' ? 'balanced' : selectedPolicy.optimizationGoal)
            : 'quality_first',
      reviewPolicy:
        mode === 'review'
          ? 'strict'
          : mode === 'cheaper' && selectedPolicy.reviewPolicy === 'strict'
            ? 'standard'
            : selectedPolicy.reviewPolicy,
      maxElasticLanes:
        mode === 'promote'
          ? Math.min(4, Math.max(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes) + 1)
          : mode === 'cheaper'
            ? Math.max(1, Math.min(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes))
            : selectedPolicy.maxElasticLanes,
    };

    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: {
          ...(selectedStudioState.roleDirectives || {}),
          [role]: { mode, phases: [phase], updatedAt: new Date().toISOString() },
        },
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'learning',
          summary: `Applied ${getDirectiveModeLabel(mode).toLowerCase()} to ${formatDirectivePhaseScope([phase])} on ${role}.`,
          phase,
        }),
      },
    }, {
      successMessage: `Applied ${getDirectiveModeLabel(mode).toLowerCase()} to ${formatDirectivePhaseScope([phase])} on ${role}.`,
    });
  }, [patchAutomationConfig, selectedMath.recommendedElasticLanes, selectedPolicy, selectedStudioState]);

  const handleExecuteNextExperiment = useCallback((item: NonNullable<typeof nextExperimentQueue[number]>) => {
    if (item.action === 'simulate_phase' && item.phase && item.mode) {
      setPhaseSimulation({ phase: item.phase, mode: item.mode });
      setActiveRoom('optimize');
      return;
    }
    if (item.action === 'focus_phase' && item.phase) {
      setSelectedDirectivePhase(item.phase);
      setSelectedWorkerRole(getPreferredRoleForPhase(item.phase));
      setActiveRoom('live');
      return;
    }
    if (item.action === 'apply_policy' && item.policyAction) {
      applyRecommendationAction(item.policyAction);
    }
  }, [applyRecommendationAction, nextExperimentQueue]);

  const handleSaveExperiment = useCallback(() => {
    const nextHistory = [
      {
        id: `exp_${Date.now()}`,
        scenarioId: selectedScenarioId,
        previewPresetId,
        createdAt: new Date().toISOString(),
        notes: `${selectedScenario.label} · ${previewPreset.label}${countDirectiveEntries(selectedStudioState.roleDirectives) ? ` · ${countDirectiveEntries(selectedStudioState.roleDirectives)} steering signals` : ''}`,
        roleDirectives: cloneRoleDirectives(selectedStudioState.roleDirectives),
      },
      ...(selectedStudioState.experimentHistory || []),
    ].slice(0, 8);

    void updateStudioState({
      ...selectedStudioState,
      selectedScenarioId,
      previewPresetId,
      experimentHistory: nextHistory,
    }, 'Saved experiment snapshot.');
  }, [previewPreset.label, previewPresetId, selectedScenario.label, selectedScenarioId, selectedStudioState, updateStudioState]);

  const handleSaveOperatingPlan = useCallback((source?: { experiment?: StudioExperimentRecord; namePrefix?: string }) => {
    const experiment = source?.experiment;
    const planName = `${source?.namePrefix || 'Operating plan'} · ${experiment ? getExperimentDisplayLabel(experiment) : `${selectedScenario.label} · ${previewPreset.label}`}`;
    const nextPlans = [
      {
        id: `plan_${Date.now()}`,
        name: planName,
        createdAt: new Date().toISOString(),
        scenarioId: experiment?.scenarioId || selectedScenarioId,
        previewPresetId: experiment?.previewPresetId || previewPresetId,
        executionPolicy: experiment
          ? normalizeExecutionPolicy(POLICY_PRESETS.find((preset) => preset.id === experiment.previewPresetId)?.policy || selectedPolicy)
          : { ...selectedPolicy },
        roleDirectives: cloneRoleDirectives(experiment?.roleDirectives || selectedStudioState.roleDirectives),
        sourceExperimentId: experiment?.id,
        sourceExperimentLabel: experiment ? getExperimentDisplayLabel(experiment) : undefined,
        notes: experiment ? `Saved from ${getExperimentDisplayLabel(experiment)}.` : `Saved from live setup with ${countDirectiveEntries(selectedStudioState.roleDirectives)} steering signals.`,
      },
      ...(selectedStudioState.savedPlans || []),
    ].slice(0, 10);

    void updateStudioState({
      ...selectedStudioState,
      selectedPlanId: nextPlans[0].id,
      savedPlans: nextPlans,
    }, 'Saved operating plan.');
  }, [previewPreset.label, previewPresetId, selectedPolicy, selectedScenario.label, selectedScenarioId, selectedStudioState, updateStudioState]);

  const handleRestoreOperatingPlan = useCallback((plan: StudioOperatingPlan) => {
    setSelectedPlanId(plan.id);
    setSelectedScenarioId(plan.scenarioId as ScenarioPresetId);
    setPreviewPresetId(plan.previewPresetId);
    void patchAutomationConfig({
      executionPolicy: plan.executionPolicy,
      studioState: {
        ...selectedStudioState,
        selectedPlanId: plan.id,
        selectedScenarioId: plan.scenarioId,
        previewPresetId: plan.previewPresetId,
        roleDirectives: cloneRoleDirectives(plan.roleDirectives),
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'full',
          summary: `Restored saved operating plan ${plan.name}.`,
          sourceExperimentId: plan.sourceExperimentId,
          sourceExperimentLabel: plan.sourceExperimentLabel || plan.name,
        }),
      },
    }, { successMessage: `Restored ${plan.name}.` });
  }, [patchAutomationConfig, selectedStudioState]);

  const handleComparePlan = useCallback((plan: StudioOperatingPlan) => {
    setSelectedPlanId(plan.id);
    if (plan.sourceExperimentId) {
      setSelectedComparisonExperimentId(plan.sourceExperimentId);
    }
    setActiveRoom('optimize');
    setNotice({ tone: 'success', message: `Loaded ${plan.name} for comparison.` });
  }, []);

  const handleRestoreExperiment = useCallback((experiment: StudioExperimentRecord) => {
    if (SCENARIO_PRESETS.some((scenario) => scenario.id === experiment.scenarioId)) {
      setSelectedScenarioId(experiment.scenarioId as ScenarioPresetId);
    }
    if (POLICY_PRESETS.some((preset) => preset.id === experiment.previewPresetId)) {
      setPreviewPresetId(experiment.previewPresetId);
    }
    setSelectedComparisonExperimentId(experiment.id);
    void updateStudioState({
      ...selectedStudioState,
      selectedScenarioId: experiment.scenarioId,
      previewPresetId: experiment.previewPresetId,
      roleDirectives: cloneRoleDirectives(experiment.roleDirectives) || selectedStudioState.roleDirectives,
    });
    setNotice({ tone: 'success', message: 'Restored saved experiment.' });
  }, [selectedStudioState, updateStudioState]);

  const handleCompareExperiment = useCallback((experiment: StudioExperimentRecord) => {
    setSelectedComparisonExperimentId(experiment.id);
    setActiveRoom('replay');
    setNotice({ tone: 'success', message: 'Loaded this experiment into the comparison lab.' });
  }, []);

  const handleOpenRunInReplay = useCallback((run: PlatformTaskRunRecord, sourceLabel = 'replay') => {
    const attribution = getRunExperimentAttribution(run);
    const dominantPhase = readStepExecutions(run.metadata?.stepExecutions)
      .filter((step) => step.kind === 'search' || step.kind === 'query' || step.kind === 'capture' || step.kind === 'analyze' || step.kind === 'summarize' || step.kind === 'deliver' || step.kind === 'note')
      .sort((left, right) => (right.actualCredits || 0) - (left.actualCredits || 0))[0]?.kind;
    if (attribution.experimentId) {
      setSelectedComparisonExperimentId(attribution.experimentId);
    }
    if (dominantPhase && dominantPhase !== 'note') {
      setSelectedReplayPhase(dominantPhase as WorkflowBlockKind);
    }
    setHoveredCohortRunId(run.id);
    setSelectedCohortRunId(run.id);
    setActiveRoom('replay');
    setNotice({ tone: 'success', message: `Opened the exact run in replay from ${sourceLabel}.` });
  }, []);

  const handleForkCurrentSetup = useCallback(() => {
    const sourceLabel = getPresetLabelFromId(previewPresetId);
    const siblingCount = experimentHistory.filter((experiment) => !experiment.parentExperimentId).length + 1;
    const nextHistory = [
      {
        id: `exp_${Date.now()}`,
        scenarioId: selectedScenarioId,
        previewPresetId,
        createdAt: new Date().toISOString(),
        branchName: buildBranchName(sourceLabel, siblingCount),
        notes: `Forked from live setup · ${selectedScenario.label}`,
        roleDirectives: cloneRoleDirectives(selectedStudioState.roleDirectives),
      },
      ...(selectedStudioState.experimentHistory || []),
    ].slice(0, 12);

    void updateStudioState({
      ...selectedStudioState,
      selectedScenarioId,
      previewPresetId,
      experimentHistory: nextHistory,
    }, 'Forked the current live setup into a new experiment branch.');
  }, [experimentHistory, previewPresetId, selectedScenario.label, selectedScenarioId, selectedStudioState, updateStudioState]);

  const handleForkWinningSetup = useCallback((experiment: StudioExperimentRecord) => {
    const siblingCount = (experimentBranches.get(experiment.id) || 0) + 1;
    const nextHistory = [
      {
        id: `exp_${Date.now()}`,
        scenarioId: experiment.scenarioId,
        previewPresetId: experiment.previewPresetId,
        createdAt: new Date().toISOString(),
        branchName: buildBranchName(getExperimentDisplayLabel(experiment), siblingCount),
        parentExperimentId: experiment.id,
        notes: `Forked from ${getExperimentDisplayLabel(experiment)}`,
        roleDirectives: cloneRoleDirectives(experiment.roleDirectives),
      },
      ...(selectedStudioState.experimentHistory || []),
    ].slice(0, 12);

    void updateStudioState({
      ...selectedStudioState,
      experimentHistory: nextHistory,
    }, 'Forked the winning setup into a new branch.');
  }, [experimentBranches, selectedStudioState, updateStudioState]);

  const handlePromoteExperimentPreset = useCallback((experiment: StudioExperimentRecord) => {
    const preset = POLICY_PRESETS.find((item) => item.id === experiment.previewPresetId);
    if (!preset) {
      setNotice({ tone: 'error', message: 'This experiment no longer matches an available preset.' });
      return;
    }
    setSelectedScenarioId(experiment.scenarioId as ScenarioPresetId);
    setPreviewPresetId(experiment.previewPresetId);
    setSelectedComparisonExperimentId(experiment.id);
    void patchAutomationConfig({
      executionPolicy: preset.policy,
      studioState: {
        ...selectedStudioState,
        selectedScenarioId: experiment.scenarioId,
        previewPresetId: experiment.previewPresetId,
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'preset',
          summary: `Promoted preset from ${getExperimentDisplayLabel(experiment)}.`,
          sourceExperimentId: experiment.id,
          sourceExperimentLabel: getExperimentDisplayLabel(experiment),
        }),
      },
    }, { successMessage: 'Promoted the winning preset into the live policy.' });
  }, [patchAutomationConfig, selectedStudioState]);

  const handlePromoteExperimentSteering = useCallback((experiment: StudioExperimentRecord) => {
    setSelectedScenarioId(experiment.scenarioId as ScenarioPresetId);
    setPreviewPresetId(experiment.previewPresetId);
    setSelectedComparisonExperimentId(experiment.id);
    void updateStudioState({
      ...selectedStudioState,
      selectedScenarioId: experiment.scenarioId,
      previewPresetId: experiment.previewPresetId,
      roleDirectives: mergeRoleDirectiveSnapshots(selectedStudioState.roleDirectives, experiment.roleDirectives),
      promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
        mode: 'steering',
        summary: `Promoted steering from ${getExperimentDisplayLabel(experiment)}.`,
        sourceExperimentId: experiment.id,
        sourceExperimentLabel: getExperimentDisplayLabel(experiment),
      }),
    }, 'Promoted steering from this saved experiment.');
  }, [selectedStudioState, updateStudioState]);

  const handlePromoteExperimentFull = useCallback((experiment: StudioExperimentRecord) => {
    const preset = POLICY_PRESETS.find((item) => item.id === experiment.previewPresetId);
    if (!preset) {
      setNotice({ tone: 'error', message: 'This experiment no longer matches an available preset.' });
      return;
    }
    setSelectedScenarioId(experiment.scenarioId as ScenarioPresetId);
    setPreviewPresetId(experiment.previewPresetId);
    setSelectedComparisonExperimentId(experiment.id);
    void patchAutomationConfig({
      executionPolicy: preset.policy,
      studioState: {
        ...selectedStudioState,
        selectedScenarioId: experiment.scenarioId,
        previewPresetId: experiment.previewPresetId,
        roleDirectives: mergeRoleDirectiveSnapshots(selectedStudioState.roleDirectives, experiment.roleDirectives),
        promotionHistory: appendPromotionHistory(selectedStudioState.promotionHistory, {
          mode: 'full',
          summary: `Promoted full setup from ${getExperimentDisplayLabel(experiment)}.`,
          sourceExperimentId: experiment.id,
          sourceExperimentLabel: getExperimentDisplayLabel(experiment),
        }),
      },
    }, { successMessage: 'Promoted the full winning setup into the live policy.' });
  }, [patchAutomationConfig, selectedStudioState]);

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {notice && (
        <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex justify-center">
          <div
            className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(2,6,23,0.42)] backdrop-blur-md ${
              notice.tone === 'success'
                ? 'border-green-500/20 bg-green-500/12 text-green-100'
                : 'border-red-500/20 bg-red-500/12 text-red-100'
            }`}
          >
            <p className="text-sm font-medium">{notice.message}</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-navy-800/80 bg-gradient-to-r from-navy-950/96 via-navy-900/92 to-navy-950/96 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-violet-600/50 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
              <img src={VIOLEMA_MARK} alt="Violema" className="h-8 w-8 object-contain" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Separate control room</p>
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-white">Agent Studio</h1>
              <p className="mt-1 text-sm text-slate-400">Configure worker strategy, inspect performance, and keep the schedule view clean.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-violet-600/50 hover:text-white"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.6rem] border border-violet-500/15 bg-gradient-to-br from-violet-500/10 via-navy-900/84 to-navy-950/94 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Workflows watched</p>
            <p className="mt-2 text-3xl font-semibold text-white">{studioStats.workflowCount}</p>
            <p className="mt-2 text-sm text-slate-400">Dedicated space for orchestration, not hidden inside the schedule rail.</p>
          </div>
          <div className="rounded-[1.6rem] border border-cyan-500/15 bg-gradient-to-br from-cyan-500/10 via-navy-900/84 to-navy-950/94 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">Run success rate</p>
            <p className="mt-2 text-3xl font-semibold text-white">{Math.round(studioStats.runSuccessRate * 100)}%</p>
            <p className="mt-2 text-sm text-slate-400">Tracks whether the current worker policy is improving reliability or just adding noise.</p>
          </div>
          <div className="rounded-[1.6rem] border border-amber-500/15 bg-gradient-to-br from-amber-500/10 via-navy-900/84 to-navy-950/94 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">Average run cost</p>
            <p className="mt-2 text-3xl font-semibold text-white">{studioStats.avgRunCredits ? `${formatCredits(studioStats.avgRunCredits)} cr` : '—'}</p>
            <p className="mt-2 text-sm text-slate-400">Use custom policy only when the extra spend is justified by real outcome quality.</p>
          </div>
          <div className="rounded-[1.6rem] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 via-navy-900/84 to-navy-950/94 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">Elastic lane usage</p>
            <p className="mt-2 text-3xl font-semibold text-white">{Math.round(studioStats.elasticCoverage * 100)}%</p>
            <p className="mt-2 text-sm text-slate-400">Keeps extra lanes available without treating expensive reasoning as the default path.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[22rem,minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/52 to-navy-950/84 p-4">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-violet-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow selector</p>
                  <h2 className="text-sm font-semibold text-white">Connected schedules</h2>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Choose a workflow here, then tune or inspect the agent system without losing the scheduling context.</p>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="rounded-[1.6rem] border border-dashed border-navy-700/70 bg-navy-950/35 px-4 py-8 text-sm text-slate-500">
                  Loading workflows…
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-navy-700/70 bg-navy-950/35 px-4 py-8 text-sm text-slate-500">
                  No scheduled workflows yet. Create one from the dashboard, then come back here to tune the agent system.
                </div>
              ) : rows.map((row) => {
                const isSelected = row.automation.id === selectedRow?.automation.id;
                const latestStatus = row.latestRun?.status || row.automation.last_run_status || row.automation.status;
                return (
                  <button
                    key={row.automation.id}
                    type="button"
                    onClick={() => setSelectedAutomationId(row.automation.id)}
                    className={`w-full rounded-[1.4rem] border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-violet-500/30 bg-gradient-to-br from-violet-500/12 to-cyan-500/6 shadow-[0_18px_44px_rgba(76,29,149,0.18)]'
                        : 'border-navy-700/80 bg-navy-950/45 hover:border-violet-500/18 hover:bg-navy-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{row.automation.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.automation.schedule}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(latestStatus)}`}>
                        {latestStatus}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {row.automation.authoring_mode === 'describe' ? 'Describe it' : 'Guided steps'}
                      </span>
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {row.workflowSteps.length} steps
                      </span>
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {Math.round(row.successRate * 100)}% success
                      </span>
                    </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                      {formatSummaryPreview(readString(row.latestRun?.metadata?.summary), 120)
                        || row.automation.description
                        || 'No recent summary yet.'}
                      </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-6">
            {selectedRow ? (
              <>
                <div className="rounded-[2rem] border border-navy-800/80 bg-gradient-to-br from-navy-900/84 via-navy-900/56 to-navy-950/92 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Agent system for this workflow</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{selectedRow.automation.name}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                        Agent Studio is now split into Live, Optimize, and Replay so users can understand the system instantly: what is running, what to change, and what actually worked.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard?automation=${selectedRow.automation.id}&panel=schedules`)}
                        className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/12"
                      >
                        Open schedule
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard?automation=${selectedRow.automation.id}&panel=schedules&edit=workflow`)}
                        className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white"
                      >
                        Edit workflow
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow shape</p>
                      <p className="mt-1 text-sm font-medium text-white">{selectedRow.automation.authoring_mode === 'describe' ? 'Natural-language brief' : 'Guided steps'}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{selectedRow.workflowSteps.length} workflow blocks</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Current policy</p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {activePresetId === 'custom_live' ? 'Custom live policy' : POLICY_PRESETS.find((preset) => preset.id === activePresetId)?.label || 'System recommended'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">{getReviewPolicyLabel(selectedPolicy.reviewPolicy)}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next run</p>
                      <p className="mt-1 text-sm font-medium text-white">{formatAutomationRunTime(selectedRow.automation.next_run_at)}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{liveRun?.status === 'running' ? 'Live run in progress' : 'Standing by'}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Result health</p>
                      <p className="mt-1 text-sm font-medium text-white">{Math.round(selectedRow.successRate * 100)}% success</p>
                      <p className="mt-1 text-[11px] text-slate-500">{selectedRow.averageCredits ? `${formatCredits(selectedRow.averageCredits)} cr average spend` : 'No completed runs yet'}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {[
                      { id: 'live' as const, label: 'Live', summary: 'Operating picture, active lanes, current handoffs', icon: Activity },
                      { id: 'optimize' as const, label: 'Optimize', summary: 'Preset sandbox, routing math, policy changes', icon: Target },
                      { id: 'replay' as const, label: 'Replay', summary: 'Run timeline, role heatmap, outcome review', icon: LineChart },
                    ].map((room) => {
                      const Icon = room.icon;
                      const active = activeRoom === room.id;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => setActiveRoom(room.id)}
                          className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                            active
                              ? 'border-violet-500/28 bg-violet-500/10 shadow-[0_18px_48px_rgba(76,29,149,0.16)]'
                              : 'border-navy-700/70 bg-navy-950/36 hover:border-violet-500/20 hover:bg-navy-900/55'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${active ? 'text-violet-200' : 'text-slate-400'}`} />
                            <p className="text-sm font-medium text-white">{room.label}</p>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{room.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeRoom === 'live' ? (
                  <>
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),minmax(22rem,0.85fr)]">
                      <div className="rounded-[1.9rem] border border-cyan-500/15 bg-gradient-to-br from-cyan-500/8 via-navy-900/72 to-navy-950/92 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Live system map</p>
                              <h3 className="text-sm font-semibold text-white">Manager and worker lanes</h3>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                            {liveRun?.status === 'running' ? 'Live now' : 'Preview from latest run'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          One manager in the center, resident specialists around it, and elastic lanes appearing only when the workflow math or live execution justify them.
                        </p>
                        <div className="relative mt-5 h-[30rem] overflow-hidden rounded-[1.8rem] border border-white/6 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.10),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.74),rgba(2,6,23,0.96))]">
                          <div className="absolute inset-[14%] rounded-full border border-violet-500/10" />
                          <div className="absolute inset-[25%] rounded-full border border-cyan-500/10" />
                          <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.30),rgba(8,47,73,0.04))] blur-2xl" />
                          <button
                            type="button"
                            onClick={() => setSelectedWorkerRole('nexus')}
                            className={`absolute left-1/2 top-1/2 z-10 w-[12rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] border bg-navy-950/82 p-4 text-left shadow-[0_24px_80px_rgba(76,29,149,0.28)] transition-colors ${
                              selectedWorkerDetail.worker?.role === 'nexus' ? 'border-violet-300/34' : 'border-violet-400/24'
                            }`}
                          >
                            {selectedTopology.workers.filter((worker) => worker.role === 'nexus').map((worker) => (
                              <div key={worker.role}>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300/80">Manager</p>
                                    <p className="mt-1 text-sm font-semibold text-white">{worker.label}</p>
                                  </div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-violet-500/20 bg-violet-500/10 text-violet-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                    {worker.status}
                                  </span>
                                </div>
                                <p className="mt-3 text-[12px] leading-relaxed text-slate-300">{worker.reason}</p>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedTopology.primaryBand} band</span>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{worker.modelLabel}</span>
                                </div>
                              </div>
                            ))}
                          </button>
                          {workerMapNodes.map((worker) => (
                            <button
                              type="button"
                              key={worker.role}
                              onClick={() => setSelectedWorkerRole(worker.role)}
                              className={`absolute z-[5] w-[10.5rem] rounded-[1.2rem] border p-3 shadow-[0_14px_40px_rgba(2,6,23,0.28)] ${worker.positionClass} ${
                                worker.status === 'active'
                                  ? worker.laneType === 'elastic'
                                    ? 'border-cyan-500/25 bg-cyan-500/10'
                                    : 'border-violet-500/25 bg-violet-500/10'
                                  : 'border-navy-700/70 bg-navy-950/72'
                              } ${selectedWorkerDetail.worker?.role === worker.role ? 'ring-2 ring-violet-400/45' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">{worker.label}</p>
                                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{worker.band} band</p>
                                </div>
                                <span className={`mt-0.5 inline-flex h-2.5 w-2.5 rounded-full ${worker.status === 'active' ? 'animate-pulse bg-emerald-300' : 'bg-slate-600'}`} />
                              </div>
                              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{truncateText(worker.reason, 84)}</p>
                              {selectedStudioState.roleDirectives?.[worker.role] ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="inline-flex rounded-full border border-cyan-500/18 bg-cyan-500/8 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                                    {selectedStudioState.roleDirectives[worker.role].mode === 'cheaper'
                                      ? 'Cheaper'
                                      : selectedStudioState.roleDirectives[worker.role].mode === 'review'
                                        ? 'Review'
                                        : 'Promoted'}
                                  </span>
                                  {(selectedStudioState.roleDirectives[worker.role].phases || []).slice(0, 3).map((phase) => (
                                    <span key={`${worker.role}-${phase}`} className="inline-flex rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
                                      {formatDirectivePhaseShort(phase)}
                                    </span>
                                  ))}
                                  {(selectedStudioState.roleDirectives[worker.role].phases || []).length > 3 ? (
                                    <span className="inline-flex rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-slate-300">
                                      +{(selectedStudioState.roleDirectives[worker.role].phases || []).length - 3}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active specialists</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedTopology.workers.filter((worker) => worker.laneType === 'core' && worker.status === 'active').length}</p>
                          </div>
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Elastic lanes open</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedTopology.workers.filter((worker) => worker.laneType === 'elastic' && worker.status === 'active').length}</p>
                          </div>
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization bias</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedMath.estimatedBands}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected worker</p>
                              <h3 className="text-sm font-semibold text-white">Node inspector</h3>
                            </div>
                          </div>
                          {selectedWorkerDetail.worker ? (
                            <>
                              <div className="mt-4 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{selectedWorkerDetail.worker.label}</p>
                                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{selectedWorkerDetail.worker.modelLabel}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${selectedWorkerDetail.worker.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                  {selectedWorkerDetail.worker.status}
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-relaxed text-slate-400">{selectedWorkerDetail.worker.reason}</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Steps handled</p>
                                  <p className="mt-1 text-lg font-semibold text-white">{selectedWorkerDetail.performance?.steps || 0}</p>
                                </div>
                                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Failure rate</p>
                                  <p className="mt-1 text-lg font-semibold text-white">{selectedWorkerDetail.performance?.failureRate || 0}%</p>
                                </div>
                                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Credits</p>
                                  <p className="mt-1 text-lg font-semibold text-white">{formatCredits(selectedWorkerDetail.performance?.credits || 0)}</p>
                                </div>
                                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tokens</p>
                                  <p className="mt-1 text-lg font-semibold text-white">{formatTokenCount(selectedWorkerDetail.performance?.tokens || 0)}</p>
                                </div>
                              </div>
                              {selectedRoleDirective ? (
                                <div className="mt-4 rounded-2xl border border-cyan-500/16 bg-cyan-500/8 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">Active directive</p>
                                      <p className="mt-1 text-sm font-medium text-white">
                                        {selectedRoleDirective.mode === 'cheaper'
                                          ? 'Favor cheaper routing'
                                          : selectedRoleDirective.mode === 'review'
                                            ? 'Escalate review'
                                            : 'Promote stronger lane'}
                                      </p>
                                      <p className="mt-1 text-[12px] text-slate-400">Set {formatRelativeTimeFromIso(selectedRoleDirective.updatedAt)} for {formatDirectivePhaseScope(selectedRoleDirective.phases)}.</p>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={actionBusy}
                                      onClick={handleClearRoleDirective}
                                      className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300 disabled:opacity-60"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase drilldown</p>
                                  <span className="text-[11px] text-slate-500">Last {workerPhaseActivity.length} runs</span>
                                </div>
                                <div className="mt-3 space-y-3">
                                  {workerPhaseActivity.length > 0 ? workerPhaseActivity.map((run) => (
                                    <div key={run.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{run.label}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {run.phases.map((phase) => (
                                          <span key={`${run.id}-${phase.phase}`} className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${phase.failed ? 'text-red-200' : phase.succeeded ? 'text-emerald-200' : 'text-slate-300'}`}>
                                            {formatDirectivePhaseScope([phase.phase])} · {phase.count} · {phase.credits ? `${formatCredits(phase.credits)} cr` : '—'}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )) : (
                                    <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                                      No phase-specific run history for this worker yet.
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recent work</p>
                                <div className="mt-2 space-y-2">
                                  {selectedWorkerDetail.recentSteps.length > 0 ? selectedWorkerDetail.recentSteps.map((step) => (
                                    <div key={step.stepId} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                      <p className="text-sm font-medium text-white">{step.title}</p>
                                      <p className="mt-1 text-[11px] text-slate-500">{step.modelSource || step.modelTier || 'Auto route'}</p>
                                    </div>
                                  )) : (
                                    <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                                      No recent step history for this worker yet.
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mt-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Steer this role</p>
                                  <span className="text-[11px] text-slate-500">Scope: {formatDirectivePhaseScope(selectedDirectivePhase === 'all' ? undefined : [selectedDirectivePhase])}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {DIRECTIVE_PHASE_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => setSelectedDirectivePhase(option.value)}
                                      className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedDirectivePhase === option.value ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {phaseEvidence.slice(0, 3).map((phase) => (
                                    <button
                                      key={`focus-${phase.phase}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedDirectivePhase(phase.phase);
                                        setSelectedWorkerRole(getPreferredRoleForPhase(phase.phase));
                                      }}
                                      className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                    >
                                      Focus {formatDirectivePhaseScope([phase.phase])}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 grid gap-2">
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={handleRouteCheaper}
                                    className="rounded-2xl border border-cyan-500/18 bg-cyan-500/8 px-4 py-3 text-left transition-colors hover:bg-cyan-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <p className="text-sm font-medium text-white">Route this role cheaper</p>
                                    <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Bias the workflow toward lower-cost lanes and trim excess elastic capacity where the math allows it.</p>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={handleIncreaseReview}
                                    className="rounded-2xl border border-violet-500/18 bg-violet-500/8 px-4 py-3 text-left transition-colors hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <p className="text-sm font-medium text-white">Increase review here</p>
                                    <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Raise review pressure when this role is touching higher-risk reasoning, outputs, or decision steps.</p>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={handlePromoteLane}
                                    className="rounded-2xl border border-amber-500/18 bg-amber-500/8 px-4 py-3 text-left transition-colors hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <p className="text-sm font-medium text-white">Promote this lane</p>
                                    <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Give the workflow more headroom when this role should stay active longer or escalate into stronger reasoning.</p>
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live pulse</p>
                              <h3 className="text-sm font-semibold text-white">What the system is doing now</h3>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Status</p>
                              <p className="mt-1 text-sm font-medium text-white">{liveRun?.status || selectedRow.automation.last_run_status || 'Standby'}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Model source</p>
                              <p className="mt-1 text-sm font-medium text-white">{getTaskModelSource(selectedRow.task, liveRun) || 'Server default'}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Current cost</p>
                              <p className="mt-1 text-sm font-medium text-white">{typeof liveRun?.actualCredits === 'number' ? `${formatCredits(liveRun.actualCredits)} cr` : '—'}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Elapsed</p>
                              <p className="mt-1 text-sm font-medium text-white">
                                {liveRun
                                  ? formatCompactDuration(Number.isNaN(Date.parse(liveRun.startedAt || '')) ? undefined : Math.max(0, Date.now() - Date.parse(liveRun.startedAt || '')))
                                  : '—'}
                              </p>
                            </div>
                          </div>
                          <p className="mt-4 text-sm leading-relaxed text-slate-400">{selectedTopology.summary || 'The manager is routing work based on workflow complexity, tool count, and review pressure.'}</p>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active scenario</p>
                              <h3 className="text-sm font-semibold text-white">What policy is live right now</h3>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario</p>
                              <p className="mt-1 text-sm font-medium text-white">{liveScenarioTelemetry.scenarioLabel}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preset</p>
                              <p className="mt-1 text-sm font-medium text-white">{liveScenarioTelemetry.presetLabel}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Complexity</p>
                              <p className="mt-1 text-sm font-medium capitalize text-white">{liveScenarioTelemetry.complexity}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Directed roles</p>
                              <p className="mt-1 text-sm font-medium text-white">{liveScenarioTelemetry.directedRoles.length}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400">
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{liveScenarioTelemetry.workflowStepCount} steps</span>
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{liveScenarioTelemetry.estimatedToolCalls} tool calls</span>
                            <span className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${liveScenarioTelemetry.matchedSavedExperiment ? 'text-cyan-200' : 'text-slate-300'}`}>
                              {liveScenarioTelemetry.matchedSavedExperiment ? 'Matched saved experiment' : 'Ad hoc live posture'}
                            </span>
                          </div>
                          {selectedCohortRun ? (
                            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected run</p>
                                  <p className="mt-1 text-sm font-medium text-white">{getRunExperimentAttribution(selectedCohortRun).experimentNotes || `${getRunExperimentAttribution(selectedCohortRun).scenarioLabel} · ${getRunExperimentAttribution(selectedCohortRun).previewPresetLabel}`}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{formatAutomationRunTime(selectedCohortRun.finishedAt || selectedCohortRun.startedAt)}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(selectedCohortRun.status)}`}>{selectedCohortRun.status}</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedCohortRun.actualCredits ? `${formatCredits(selectedCohortRun.actualCredits)} cr` : '—'}</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatCompactDuration(Number.isNaN(Date.parse(selectedCohortRun.startedAt || '')) || Number.isNaN(Date.parse(selectedCohortRun.finishedAt || '')) ? undefined : Math.max(0, Date.parse(selectedCohortRun.finishedAt || '') - Date.parse(selectedCohortRun.startedAt || '')))}</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{getTrendMetricLabel(trendMetric)}: {formatTrendMetricValue(selectedCohortRun, trendMetric)}</span>
                              </div>
                              {selectedRunDelta ? (
                                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                    <p className="text-slate-500">vs {selectedRunDelta.label}</p>
                                    <p className={`mt-1 ${selectedRunDelta.creditDelta <= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{formatSignedDelta(Math.round(selectedRunDelta.creditDelta))} cr</p>
                                  </div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                    <p className="text-slate-500">Duration</p>
                                    <p className={`mt-1 ${selectedRunDelta.durationDelta <= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{formatSignedDelta(Math.round(selectedRunDelta.durationDelta / 1000))}s</p>
                                  </div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                    <p className="text-slate-500">Outcome</p>
                                    <p className={`mt-1 ${selectedRunDelta.successDelta >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{formatSignedDelta(selectedRunDelta.successDelta)} pts</p>
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveRoom('replay')}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Open in replay
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const attribution = getRunExperimentAttribution(selectedCohortRun);
                                    if (attribution.experimentId) setSelectedComparisonExperimentId(attribution.experimentId);
                                  }}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Sync comparison target
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase steering</p>
                              <h3 className="text-sm font-semibold text-white">Where directives are applied</h3>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-2">
                            {phaseDirectiveMatrix.map((row) => (
                              <div key={row.phase} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-white">{formatDirectivePhaseScope([row.phase])}</p>
                                  <span className="text-[11px] text-slate-500">{row.directives.length} directive{row.directives.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {row.directives.length > 0 ? row.directives.map((directive) => (
                                    <span key={`${row.phase}-${directive.role}-${directive.mode}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                      {directive.role} · {directive.mode}
                                    </span>
                                  )) : <span className="text-[12px] text-slate-500">No steering on this phase.</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live handoffs</p>
                              <h3 className="text-sm font-semibold text-white">Activation trail</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {liveActivationTrail.map((item, index) => (
                              <div key={item.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className={`mt-1 h-3 w-3 rounded-full ${index === 0 ? 'bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.6)]' : 'bg-violet-300'}`} />
                                  {index < liveActivationTrail.length - 1 ? <div className="mt-2 h-full w-px bg-gradient-to-b from-cyan-400/50 to-transparent" /> : null}
                                </div>
                                <div className="flex-1 rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium text-white">{item.title}</p>
                                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.connector}</p>
                                    </div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(item.status)}`}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.summary}</p>
                                  {item.modelSource ? <p className="mt-2 text-[11px] text-slate-500">{item.modelSource}</p> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr),minmax(0,1.08fr)]">
                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-violet-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Lane roster</p>
                            <h3 className="text-sm font-semibold text-white">Who is resident vs elastic</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {(['core', 'elastic'] as const).map((laneType) => (
                            <div key={laneType}>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{laneType === 'core' ? 'Resident specialists' : 'Elastic lanes'}</p>
                              <div className="mt-2 space-y-2">
                                {selectedTopology.workers.filter((worker) => worker.laneType === laneType && worker.role !== 'nexus').map((worker) => (
                                  <div key={worker.role} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-medium text-white">{worker.label}</p>
                                        <p className="mt-1 text-[11px] text-slate-500">{worker.modelLabel}</p>
                                      </div>
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                        {worker.status}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{worker.reason}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-violet-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization loop</p>
                            <h3 className="text-sm font-semibold text-white">What to change next</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {optimizationRecommendations.map((item) => (
                            <div key={item.title} className="rounded-2xl border border-violet-500/14 bg-violet-500/6 p-4">
                              <p className="text-sm font-medium text-white">{item.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                              {item.action !== 'none' ? (
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => applyRecommendationAction(item.action)}
                                  className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-violet-100 disabled:opacity-60"
                                >
                                  Apply recommendation
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next experiments</p>
                            <h3 className="text-sm font-semibold text-white">Best next moves from live evidence</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {nextExperimentQueue.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{item.sourceLabel}</span>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleExecuteNextExperiment(item)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                                >
                                  {item.action === 'simulate_phase'
                                    ? 'Simulate first'
                                    : item.action === 'focus_phase'
                                      ? 'Open in node inspector'
                                      : 'Apply now'}
                                </button>
                                {item.phase ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDirectivePhase(item.phase!);
                                      setActiveRoom('replay');
                                    }}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    View evidence
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleSaveOperatingPlan({ namePrefix: item.sourceLabel })}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Save as plan
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeRoom === 'optimize' ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)]">
                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-emerald-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization scorecard</p>
                            <h3 className="text-sm font-semibold text-white">How healthy this operating setup is</h3>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">This is the compact read: how much pressure the workflow is putting on spend and risk, and whether the current policy is actually earning its complexity.</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {[
                            { label: 'Spend pressure', value: optimizationScorecard.spendPressure, tone: 'text-amber-300' },
                            { label: 'Risk pressure', value: optimizationScorecard.riskPressure, tone: 'text-rose-300' },
                            { label: 'Leverage score', value: optimizationScorecard.leverageScore, tone: 'text-emerald-300' },
                          ].map((item) => (
                            <div key={item.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                              <p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 rounded-2xl border border-emerald-500/16 bg-emerald-500/8 p-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/80">Verdict</p>
                          <p className="mt-1 text-sm font-semibold text-white">{optimizationScorecard.verdict}</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-300">{optimizationScorecard.nextMove}</p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-amber-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Waste diagnostics</p>
                              <h3 className="text-sm font-semibold text-white">Where the setup is overspending</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {workflowDiagnostics.wasteItems.map((item) => (
                              <div key={item.title} className="rounded-2xl border border-amber-500/14 bg-amber-500/6 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">{item.title}</p>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.body}</p>
                                  </div>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-amber-200">{item.severity}</span>
                                </div>
                                {item.action !== 'none' ? (
                                  <button type="button" disabled={actionBusy} onClick={() => applyRecommendationAction(item.action)} className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-amber-100 disabled:opacity-60">
                                    Apply fix
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-rose-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Risk diagnostics</p>
                              <h3 className="text-sm font-semibold text-white">Where the workflow needs protection</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {workflowDiagnostics.riskItems.map((item) => (
                              <div key={item.title} className="rounded-2xl border border-rose-500/14 bg-rose-500/6 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">{item.title}</p>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.body}</p>
                                  </div>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-rose-200">{item.severity}</span>
                                </div>
                                {item.action !== 'none' ? (
                                  <button type="button" disabled={actionBusy} onClick={() => applyRecommendationAction(item.action)} className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-rose-100 disabled:opacity-60">
                                    Tighten policy
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-cyan-300" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario simulator</p>
                          <h3 className="text-sm font-semibold text-white">Stress-test the policy before you change it</h3>
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        Simulate the same workflow under different operating conditions. This gives users a reason for the configuration, not just a list of knobs.
                      </p>
                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
                        <div className="grid gap-3 md:grid-cols-2">
                          {SCENARIO_PRESETS.map((scenario) => (
                            <button
                              key={scenario.id}
                              type="button"
                              onClick={() => setSelectedScenarioId(scenario.id)}
                              className={`rounded-2xl border p-4 text-left transition-all ${
                                selectedScenario.id === scenario.id
                                  ? 'border-cyan-500/28 bg-cyan-500/10 shadow-[0_18px_44px_rgba(8,145,178,0.16)]'
                                  : 'border-navy-700/70 bg-navy-950/42 hover:border-cyan-500/18 hover:bg-navy-900/55'
                              }`}
                            >
                              <p className="text-sm font-semibold text-white">{scenario.label}</p>
                              <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{scenario.summary}</p>
                            </button>
                          ))}
                        </div>
                        <div className="rounded-[1.6rem] border border-white/6 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Saved experiment</p>
                              <p className="mt-1 text-sm font-medium text-white">{selectedScenario.label}</p>
                            </div>
                            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                              {previewPreset.label}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario steps</p>
                              <p className="mt-1 text-lg font-semibold text-white">{scenarioComparisons[0]?.simulated.stepCount || selectedMath.stepCount}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scenario tools</p>
                              <p className="mt-1 text-lg font-semibold text-white">{scenarioComparisons[0]?.simulated.toolCalls || selectedMath.toolCalls}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reasoning load</p>
                              <p className="mt-1 text-lg font-semibold text-white">{scenarioComparisons[0]?.simulated.reasoningLoad || selectedMath.reasoningLoad}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Suggested lanes</p>
                              <p className="mt-1 text-lg font-semibold text-white">{scenarioComparisons[0]?.simulated.recommendedElasticLanes || selectedMath.recommendedElasticLanes}</p>
                            </div>
                          </div>
                          <p className="mt-4 text-sm leading-relaxed text-slate-400">
                            {selectedScenario.summary}
                          </p>
                          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                            This scenario is remembered per workflow, so when you come back to this automation the same test setup is waiting for you.
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={studioBusy}
                              onClick={handleSaveExperiment}
                              className="rounded-xl border border-cyan-500/24 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {studioBusy ? 'Saving…' : 'Save experiment snapshot'}
                            </button>
                            <p className="text-[11px] leading-relaxed text-slate-500">Save strong scenario and preset pairings so the workflow can be compared and restored later.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(22rem,0.95fr)]">
                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preset sandbox</p>
                            <h3 className="text-sm font-semibold text-white">Preview before you apply</h3>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          Compare presets against this workflow first. The goal is to make cost-quality tradeoffs obvious before you commit the system to a new posture.
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {scenarioComparisons.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setPreviewPresetId(preset.id)}
                              className={`rounded-[1.5rem] border p-4 text-left transition-all ${
                                previewPreset.id === preset.id
                                  ? 'border-violet-500/30 bg-violet-500/10 shadow-[0_18px_44px_rgba(76,29,149,0.16)]'
                                  : 'border-navy-700/70 bg-navy-950/42 hover:border-violet-500/20 hover:bg-navy-900/55'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white">{preset.label}</p>
                                  <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{preset.summary}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${preset.isActive ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                  {preset.isActive ? 'Live' : 'Preview'}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                                <div>
                                  <p className="text-slate-500">Lanes</p>
                                  <p className="mt-1 text-white">{preset.math.activeElasticLanes}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Review</p>
                                  <p className="mt-1 text-white">{preset.policy.reviewPolicy}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Bias</p>
                                  <p className="mt-1 text-white">{preset.math.estimatedBands}</p>
                                </div>
                              </div>
                              <div className="mt-3 space-y-2">
                                {[
                                  { label: 'Spend', value: preset.scenarioSpend, color: 'from-amber-300 to-violet-400' },
                                  { label: 'Assurance', value: preset.scenarioAssurance, color: 'from-cyan-300 to-emerald-400' },
                                  { label: 'Fit', value: preset.scenarioFit, color: 'from-violet-300 to-fuchsia-400' },
                                ].map((metric) => (
                                  <div key={metric.label}>
                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                      <span>{metric.label}</span>
                                      <span>{metric.value}</span>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded-full bg-navy-950/70">
                                      <div className={`h-full rounded-full bg-gradient-to-r ${metric.color}`} style={{ width: `${metric.value}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-amber-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preset preview</p>
                              <h3 className="text-sm font-semibold text-white">What changes if you switch</h3>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preview preset</p>
                              <p className="mt-1 text-sm font-medium text-white">{previewPreset.label}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Active preset</p>
                              <p className="mt-1 text-sm font-medium text-white">{activePresetId === 'custom_live' ? 'Custom live policy' : POLICY_PRESETS.find((preset) => preset.id === activePresetId)?.label || 'System recommended'}</p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            {[
                              { label: 'Spend', current: currentSpendIndex, next: previewScenarioComparison?.scenarioSpend ?? currentSpendIndex },
                              { label: 'Assurance', current: currentAssuranceIndex, next: previewScenarioComparison?.scenarioAssurance ?? currentAssuranceIndex },
                              { label: 'Fit', current: currentFitIndex, next: previewScenarioComparison?.scenarioFit ?? currentFitIndex },
                            ].map((metric) => (
                              <div key={metric.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                                <p className="mt-1 text-lg font-semibold text-white">{metric.next}</p>
                                <p className={`mt-1 text-[11px] ${metric.next === metric.current ? 'text-slate-500' : metric.next > metric.current ? 'text-emerald-300' : 'text-amber-300'}`}>
                                  {formatSignedDelta(metric.next - metric.current)} vs live
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={actionBusy || previewPreset.id === activePresetId}
                              onClick={() => void patchExecutionPolicy(previewPreset.policy)}
                              className="rounded-xl border border-violet-500/24 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-500/14 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {previewPreset.id === activePresetId ? 'Already applied' : `Apply ${previewPreset.label}`}
                            </button>
                            <p className="text-[11px] leading-relaxed text-slate-500">Use presets first. Only drop into advanced overrides if you have a real reason to outsmart the system math.</p>
                          </div>
                          <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Before / after policy diff</p>
                            <div className="mt-3 space-y-2">
                              {policyDiffRows.length > 0 ? policyDiffRows.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-navy-700/70 bg-navy-950/45 px-3 py-2 text-sm">
                                  <span className="text-slate-400">{row.label}</span>
                                  <div className="flex items-center gap-2 text-white">
                                    <span className="text-slate-500">{row.current}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                    <span>{row.next}</span>
                                  </div>
                                </div>
                              )) : (
                                <div className="rounded-xl border border-dashed border-navy-700/70 bg-navy-950/35 px-3 py-2 text-sm text-slate-500">
                                  This preview matches the active policy.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Orbit className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live vs preview</p>
                              <h3 className="text-sm font-semibold text-white">Policy radar</h3>
                            </div>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            The preview should earn its extra cost. This chart makes the tradeoff visible before you apply the policy.
                          </p>
                          <div className="mt-4 grid gap-4 lg:grid-cols-[13rem,minmax(0,1fr)]">
                            <div className="flex items-center justify-center rounded-[1.6rem] border border-white/6 bg-white/[0.03] p-4">
                              <svg viewBox="0 0 220 220" className="h-48 w-48" aria-hidden="true">
                                {[1, 2, 3, 4].map((ring) => (
                                  <polygon
                                    key={ring}
                                    points={buildRadarPolygon([25 * ring, 25 * ring, 25 * ring], 72, 110, 110)}
                                    fill="none"
                                    stroke="rgba(148,163,184,0.14)"
                                    strokeWidth="1"
                                  />
                                ))}
                                {policyRadarMetrics.map((metric, index) => {
                                  const angle = (-Math.PI / 2) + (index / policyRadarMetrics.length) * Math.PI * 2;
                                  const x = 110 + Math.cos(angle) * 84;
                                  const y = 110 + Math.sin(angle) * 84;
                                  return (
                                    <g key={metric.label}>
                                      <line x1="110" y1="110" x2={x} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
                                      <text x={x} y={y} fill="rgba(226,232,240,0.88)" fontSize="11" textAnchor="middle" dominantBaseline="middle">
                                        {metric.label}
                                      </text>
                                    </g>
                                  );
                                })}
                                <polygon
                                  points={buildRadarPolygon(policyRadarMetrics.map((metric) => metric.live), 72, 110, 110)}
                                  fill="rgba(56,189,248,0.16)"
                                  stroke="rgba(34,211,238,0.9)"
                                  strokeWidth="2"
                                />
                                <polygon
                                  points={buildRadarPolygon(policyRadarMetrics.map((metric) => metric.preview), 72, 110, 110)}
                                  fill="rgba(168,85,247,0.16)"
                                  stroke="rgba(192,132,252,0.92)"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <div className="space-y-3">
                              {policyRadarMetrics.map((metric) => (
                                <div key={metric.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-white">{metric.label}</p>
                                    <p className={`text-[11px] ${metric.preview === metric.live ? 'text-slate-500' : metric.preview > metric.live ? 'text-emerald-300' : 'text-amber-300'}`}>
                                      {formatSignedDelta(metric.preview - metric.live)}
                                    </p>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                                    <div className="rounded-xl border border-cyan-500/18 bg-cyan-500/8 px-3 py-2">
                                      <p className="text-slate-400">Live</p>
                                      <p className="mt-1 text-white">{metric.live}</p>
                                    </div>
                                    <div className="rounded-xl border border-violet-500/18 bg-violet-500/8 px-3 py-2">
                                      <p className="text-slate-400">Preview</p>
                                      <p className="mt-1 text-white">{metric.preview}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Radar className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cost-quality frontier</p>
                              <h3 className="text-sm font-semibold text-white">See the tradeoff, don’t guess it</h3>
                            </div>
                          </div>
                          <div className="relative mt-4 h-72 rounded-[1.6rem] border border-white/6 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.96))]">
                            <div className="absolute inset-x-4 bottom-4 top-4">
                              <div className="absolute inset-0 rounded-[1.2rem] border border-dashed border-white/8" />
                              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/6" />
                              <div className="absolute left-1/2 inset-y-0 border-l border-dashed border-white/6" />
                              {frontierPoints.map((point) => (
                                <button
                                  key={point.id}
                                  type="button"
                                  onClick={() => setPreviewPresetId(point.id)}
                                  className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full border text-[10px] font-medium text-white transition-transform hover:scale-105 ${
                                    point.id === previewPreset.id
                                      ? 'border-violet-200 bg-violet-500/80 shadow-[0_0_30px_rgba(139,92,246,0.45)]'
                                      : point.isActive
                                        ? 'border-emerald-200 bg-emerald-500/70'
                                        : 'border-cyan-200 bg-cyan-500/70'
                                  }`}
                                  style={{ left: `${point.x}%`, bottom: `${point.y}%`, width: `${point.size}px`, height: `${point.size}px` }}
                                  aria-label={point.label}
                                />
                              ))}
                              <div className="absolute -bottom-2 left-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">Lower spend</div>
                              <div className="absolute -bottom-2 right-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">Higher spend</div>
                              <div className="absolute left-0 top-0 text-[10px] uppercase tracking-[0.16em] text-slate-500">Higher assurance</div>
                              <div className="absolute left-0 bottom-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">Lower assurance</div>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400">
                            {frontierPoints.map((point) => (
                              <span key={`${point.id}-legend`} className={`rounded-full border px-2 py-0.5 ${
                                point.id === previewPreset.id
                                  ? 'border-violet-500/20 bg-violet-500/10 text-violet-200'
                                  : point.isActive
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                    : 'border-navy-700 bg-navy-900 text-slate-300'
                              }`}>
                                {point.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-amber-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow fingerprint</p>
                            <h3 className="text-sm font-semibold text-white">Why the system recommends what it does</h3>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow steps</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedMath.stepCount}</p>
                          </div>
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tool calls</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedMath.toolCalls}</p>
                          </div>
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reasoning load</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedMath.reasoningLoad}</p>
                          </div>
                          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommended lanes</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedMath.recommendedElasticLanes}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-relaxed text-slate-400">
                          Harder reasoning should only climb to stronger lanes when workflow complexity and failure risk justify it. Everything else should stay cheap, fast, and operational.
                        </p>
                        <div className="mt-4 space-y-3">
                          {optimizationRecommendations.map((item) => (
                            <div key={item.title} className="rounded-2xl border border-violet-500/14 bg-violet-500/6 p-4">
                              <p className="text-sm font-medium text-white">{item.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
                              {item.action !== 'none' ? (
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => applyRecommendationAction(item.action)}
                                  className="mt-3 ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-violet-100 disabled:opacity-60"
                                >
                                  Apply recommendation
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-violet-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Advanced overrides</p>
                            <h3 className="text-sm font-semibold text-white">Use only when the preset isn’t enough</h3>
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mode</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[{ value: 'recommended' as const, label: 'System recommended' }, { value: 'custom' as const, label: 'Custom policy' }].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: option.value })}
                                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.mode === option.value ? 'border-violet-500/30 bg-violet-500/12 text-violet-200' : 'text-slate-300'} disabled:opacity-60`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization goal</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[{ value: 'balanced' as const, label: 'Balanced' }, { value: 'cost_saver' as const, label: 'Cost Saver' }, { value: 'quality_first' as const, label: 'Quality First' }].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', optimizationGoal: option.value })}
                                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.optimizationGoal === option.value ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'} disabled:opacity-60`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Review policy</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[{ value: 'lean' as const, label: 'Lean' }, { value: 'standard' as const, label: 'Standard' }, { value: 'strict' as const, label: 'Strict' }].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', reviewPolicy: option.value })}
                                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.reviewPolicy === option.value ? 'border-violet-500/30 bg-violet-500/12 text-violet-200' : 'text-slate-300'} disabled:opacity-60`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Elastic lane cap</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[0, 1, 2, 3, 4].map((count) => (
                                <button
                                  key={count}
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', maxElasticLanes: count })}
                                  className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedPolicy.maxElasticLanes === count ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'} disabled:opacity-60`}
                                >
                                  {count}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Policy snapshot</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-sm text-slate-400">Mode</p>
                                <p className="mt-1 text-sm font-medium text-white">{getExecutionModeLabel(selectedPolicy.mode)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-400">Optimization</p>
                                <p className="mt-1 text-sm font-medium text-white">{getOptimizationGoalLabel(selectedPolicy.optimizationGoal)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-400">Review</p>
                                <p className="mt-1 text-sm font-medium text-white">{getReviewPolicyLabel(selectedPolicy.reviewPolicy)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-400">Active lanes</p>
                                <p className="mt-1 text-sm font-medium text-white">{selectedMath.activeElasticLanes} / {selectedPolicy.maxElasticLanes}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Layers3 className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Saved operating plans</p>
                            <h3 className="text-sm font-semibold text-white">Reusable setups worth keeping close</h3>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          Plans let us save strong operating postures, compare them later, and restore them without rebuilding the whole Studio state by hand.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveOperatingPlan()}
                            className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                          >
                            Save live setup as plan
                          </button>
                          {winningExperiment ? (
                            <button
                              type="button"
                              onClick={() => handleSaveOperatingPlan({ experiment: winningExperiment.experiment, namePrefix: 'Winning plan' })}
                              className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                            >
                              Save winning setup
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-4 space-y-3">
                          {savedPlanSummaries.length > 0 ? savedPlanSummaries.map((entry) => (
                            <div
                              key={entry.plan.id}
                              className={`rounded-2xl border p-4 ${activeSavedPlan?.plan.id === entry.plan.id ? 'border-cyan-500/22 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/45'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{entry.plan.name}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {getScenarioLabelFromId(entry.plan.scenarioId)} · {getPresetLabelFromId(entry.plan.previewPresetId)} · saved {formatRelativeTimeFromIso(entry.plan.createdAt)}
                                  </p>
                                </div>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                  {entry.steeringCount} steering
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                  <p className="text-slate-500">Spend</p>
                                  <p className="mt-1 text-white">{entry.spendIndex}</p>
                                </div>
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                  <p className="text-slate-500">Assurance</p>
                                  <p className="mt-1 text-white">{entry.assuranceIndex}</p>
                                </div>
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                  <p className="text-slate-500">Fit</p>
                                  <p className="mt-1 text-white">{entry.fitIndex}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleComparePlan(entry.plan)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Compare
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => handleRestoreOperatingPlan(entry.plan)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                                >
                                  Restore
                                </button>
                                {entry.sourceExperiment ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCompareExperiment(entry.sourceExperiment!)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Open source experiment
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Save a live setup or a winning experiment and it will show up here as a reusable operating plan.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">What Violema is learning</p>
                            <h3 className="text-sm font-semibold text-white">Best presets for {learnedPresetLearning.scopeLabel}</h3>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          {selectedArchetype.summary}
                        </p>
                        <div className="mt-4 space-y-3">
                          {learnedPresetLearning.items.map((item, index) => (
                            <div key={item.presetId} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{index + 1}. {item.label}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{item.runCount} observed runs across {item.workflowCount} workflows</p>
                                </div>
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                                  Score {item.score}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                                <div>
                                  <p className="text-slate-500">Success</p>
                                  <p className="mt-1 text-white">{item.averageSuccess}%</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Spend</p>
                                  <p className="mt-1 text-white">{item.averageCredits ? `${formatCredits(item.averageCredits)} cr` : '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Confidence</p>
                                  <p className="mt-1 text-white">{item.confidence}%</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Position</p>
                                  <p className="mt-1 text-white">{index === 0 ? 'Best current fit' : 'Observed alternative'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {learnedPresetLearning.items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Not enough live history yet to rank presets for this workflow class.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase learning</p>
                            <h3 className="text-sm font-semibold text-white">What wins by phase for this workflow class</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {phaseLearningByArchetype.length > 0 ? phaseLearningByArchetype.map((item) => (
                            <div key={`${item.phase}-${item.mode}`} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{formatDirectivePhaseScope([item.phase])} · {item.mode === 'baseline' ? 'Baseline' : item.mode}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{item.runs} observed step runs in {selectedArchetype.label.toLowerCase()} · steer {getPreferredRoleForPhase(item.phase)}</p>
                                </div>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {item.score}</span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-4 text-[11px]">
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Success</p><p className="mt-1 text-white">{Math.round(item.successRate * 100)}%</p></div>
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Avg credits</p><p className="mt-1 text-white">{item.averageCredits ? `${formatCredits(item.averageCredits)} cr` : '—'}</p></div>
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Best use</p><p className="mt-1 text-white">{item.mode === 'baseline' ? 'Default posture' : `${item.mode} bias`}</p></div>
                                <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Confidence</p><p className="mt-1 text-white">{item.confidence}%</p></div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.mode === 'baseline' ? (
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => {
                                      setSelectedDirectivePhase(item.phase);
                                      setSelectedWorkerRole(getPreferredRoleForPhase(item.phase));
                                      setActiveRoom('live');
                                      setNotice({ tone: 'success', message: `Focused Agent Studio on ${formatDirectivePhaseScope([item.phase])} for ${getPreferredRoleForPhase(item.phase)}.` });
                                    }}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300 disabled:opacity-60"
                                  >
                                    Inspect this phase
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPhaseSimulation({ phase: item.phase, mode: item.mode as 'cheaper' | 'review' | 'promote' })}
                                      className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                    >
                                      Simulate first
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionBusy}
                                      onClick={() => handleApplyPhaseLearning(item.phase, item.mode as 'cheaper' | 'review' | 'promote')}
                                      className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                                    >
                                      Apply {item.mode} here
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDirectivePhase(item.phase);
                                    setSelectedWorkerRole(getPreferredRoleForPhase(item.phase));
                                    setActiveRoom('live');
                                  }}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Open in node inspector
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDirectivePhase(item.phase);
                                    setActiveRoom('replay');
                                  }}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  View evidence in replay
                                </button>
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Not enough phase-level history yet to say which steering wins for this workflow class.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-amber-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase cost map</p>
                            <h3 className="text-sm font-semibold text-white">Where spend is actually buying confidence</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {phaseCostConfidenceMap.length > 0 ? phaseCostConfidenceMap.map((phase) => (
                            <div key={`phase-map-${phase.phase}`} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{formatDirectivePhaseScope([phase.phase])}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{phase.runs} observed executions</p>
                                </div>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{phase.recommendation}</span>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                    <span>Confidence</span>
                                    <span>{phase.confidence}%</span>
                                  </div>
                                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.max(10, phase.confidence)}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                    <span>Cost pressure</span>
                                    <span>{phase.costPressure}%</span>
                                  </div>
                                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-300" style={{ width: `${Math.max(10, phase.costPressure)}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Not enough phase evidence yet to map cost against confidence.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Orbit className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch opportunity map</p>
                            <h3 className="text-sm font-semibold text-white">Which branch lines deserve the next experiment</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {branchOpportunityMap.length > 0 ? branchOpportunityMap.map((branch) => (
                            <div key={branch.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{branch.label}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {branch.successRate}% success · confidence {branch.confidence}% · spend {branch.spendDelta > 0 ? '+' : ''}{branch.spendDelta} cr vs workflow baseline
                                  </p>
                                </div>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {branch.score}</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBranchRootId(branch.id);
                                    setActiveRoom('replay');
                                  }}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Inspect branch
                                </button>
                                {branch.focusPhase ? (
                                  <button
                                    type="button"
                                    onClick={() => setPhaseSimulation({ phase: branch.focusPhase!, mode: branch.successRate < 70 ? 'review' : 'cheaper' })}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                                  >
                                    Simulate {formatDirectivePhaseScope([branch.focusPhase])}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Branch opportunity mapping unlocks once there are enough saved experiments and runs to compare real branch lines.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-violet-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase simulation</p>
                            <h3 className="text-sm font-semibold text-white">Preview the move before you apply it</h3>
                          </div>
                        </div>
                        {phaseSimulationPreview ? (
                          <div className="mt-4 space-y-4">
                            <div className="rounded-2xl border border-violet-500/16 bg-violet-500/8 p-4">
                              <p className="text-sm font-medium text-white">
                                {getDirectiveModeLabel(phaseSimulationPreview.mode)} on {formatDirectivePhaseScope([phaseSimulationPreview.phase])}
                              </p>
                              <p className="mt-1 text-[12px] text-slate-400">
                                This would steer {phaseSimulationPreview.targetRole} and rebalance the workflow policy before you commit it.
                              </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3 text-[11px]">
                              <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                <p className="text-slate-500">Spend delta</p>
                                <p className={`mt-1 ${phaseSimulationPreview.spendDelta <= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{formatSignedDelta(phaseSimulationPreview.spendDelta)}</p>
                              </div>
                              <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                <p className="text-slate-500">Assurance delta</p>
                                <p className={`mt-1 ${phaseSimulationPreview.assuranceDelta >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{formatSignedDelta(phaseSimulationPreview.assuranceDelta)}</p>
                              </div>
                              <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                <p className="text-slate-500">Fit delta</p>
                                <p className={`mt-1 ${phaseSimulationPreview.fitDelta >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{formatSignedDelta(phaseSimulationPreview.fitDelta)}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleApplyPhaseLearning(phaseSimulationPreview.phase, phaseSimulationPreview.mode)}
                                className="rounded-xl border border-cyan-500/24 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/14 disabled:opacity-60"
                              >
                                Apply simulated move
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDirectivePhase(phaseSimulationPreview.phase);
                                  setSelectedWorkerRole(phaseSimulationPreview.targetRole);
                                  setActiveRoom('live');
                                }}
                                className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                              >
                                Open target role
                              </button>
                              <button
                                type="button"
                                onClick={() => setPhaseSimulation(null)}
                                className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                              >
                                Clear preview
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                            Pick a non-baseline phase-learning move and preview it here before pushing it into the live policy.
                          </div>
                        )}
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Saved experiments</p>
                              <h3 className="text-sm font-semibold text-white">Restore strong operating setups</h3>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleForkCurrentSetup}
                            className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                          >
                            Fork live policy
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          {experimentHistory.length > 0 ? experimentHistory.map((experiment) => {
                            const matchedRun = experimentRunMatches.get(experiment.id);
                            const matchedAttribution = matchedRun ? getRunExperimentAttribution(matchedRun) : undefined;
                            return (
                              <div
                                key={experiment.id}
                                className={`rounded-2xl border p-4 transition-colors ${selectedComparisonExperimentId === experiment.id ? 'border-cyan-500/22 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/45'}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">{getExperimentDisplayLabel(experiment)}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{POLICY_PRESETS.find((preset) => preset.id === experiment.previewPresetId)?.label || experiment.previewPresetId}</p>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                      {getExperimentTags(experiment).map((tag) => (
                                        <span key={`${experiment.id}-${tag}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{tag}</span>
                                      ))}
                                      {experiment.parentExperimentId ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">Branch</span> : null}
                                      {(experimentBranches.get(experiment.id) || 0) > 0 ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{experimentBranches.get(experiment.id)} child branches</span> : null}
                                    </div>
                                  </div>
                                  <span className="rounded-full border border-navy-700 bg-navy-900 px-2 py-0.5 text-[10px] text-slate-300">
                                    {formatRelativeTimeFromIso(experiment.createdAt)}
                                  </span>
                                </div>
                                {experiment.notes ? <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{experiment.notes}</p> : null}
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                    {matchedRun ? `${matchedAttribution?.previewPresetLabel || 'Observed'} observed` : 'No attributed run yet'}
                                  </span>
                                  {matchedRun ? <span className={`rounded-full border px-2 py-0.5 font-medium ${getStatusTone(matchedRun.status)}`}>{matchedRun.status}</span> : null}
                                  {matchedRun && typeof matchedRun.actualCredits === 'number' ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatCredits(matchedRun.actualCredits)} cr</span> : null}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCompareExperiment(experiment)}
                                    className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedComparisonExperimentId === experiment.id ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                                  >
                                    Compare this experiment
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreExperiment(experiment)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Restore setup
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleForkWinningSetup(experiment)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Branch from here
                                  </button>
                                </div>
                              </div>
                            );
                          }) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Save a few strong simulations here so you can compare and restore them later.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeRoom === 'replay' ? (
                  <>
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr),minmax(22rem,0.92fr)]">
                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <LineChart className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Run replay</p>
                            <h3 className="text-sm font-semibold text-white">Step-by-step timeline</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-4">
                          {replayTimeline.length > 0 ? replayTimeline.map((step, index) => (
                            <div key={step.stepId} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${step.status === 'failed' ? 'border-red-500/25 bg-red-500/10 text-red-200' : step.status === 'succeeded' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-violet-500/25 bg-violet-500/10 text-violet-200'}`}>
                                  {step.marker}
                                </div>
                                {index < replayTimeline.length - 1 ? <div className="mt-2 h-full w-px bg-gradient-to-b from-violet-400/50 to-transparent" /> : null}
                              </div>
                              <div className="flex-1 rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-white">{step.title}</p>
                                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{step.assignedRole} · {step.kind}</p>
                                  </div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(step.status)}`}>
                                    {step.status}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                                  {step.modelTier ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.modelTier}</span> : null}
                                  {step.modelSource ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.modelSource}</span> : null}
                                  {step.directiveMode ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-cyan-200">{`${step.directiveMode === 'cheaper' ? 'Cheaper bias' : step.directiveMode === 'review' ? 'Review bias' : 'Promoted lane'}${step.directivePhases?.length ? ` · ${formatDirectivePhaseScope(step.directivePhases)}` : ''}`}</span> : null}
                                  {typeof step.actualCredits === 'number' ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatCredits(step.actualCredits)} cr</span> : null}
                                  {step.toolCalls ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.toolCalls} tools</span> : null}
                                  {step.tokenUsage?.totalTokens ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.tokens}</span> : null}
                                  {step.duration && step.duration !== '—' ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.duration}</span> : null}
                                </div>
                                {step.summary || step.error ? <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.error || formatSummaryPreview(step.summary, 180)}</p> : null}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              No step history yet. Once the workflow runs, replay will show the full handoff story instead of burying it in the schedule drawer.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Layers3 className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Run comparison lab</p>
                              <h3 className="text-sm font-semibold text-white">{runComparison?.comparisonMode === 'saved_experiment' ? 'Latest run vs saved experiment' : 'Latest vs previous operating setup'}</h3>
                            </div>
                          </div>
                          {runComparison ? (
                            <div className="mt-4 space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-cyan-500/18 bg-cyan-500/8 p-4">
                                  <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/80">Latest run</p>
                                  <p className="mt-2 text-sm font-semibold text-white">{runComparison.current.presetLabel}</p>
                                  <p className="mt-1 text-[12px] text-slate-300">{runComparison.current.scenarioLabel}</p>
                                  {runComparison.current.experimentLabel ? <p className="mt-1 text-[11px] text-cyan-200/85">{runComparison.current.experimentLabel}</p> : null}
                                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-200">
                                    <span className={`rounded-full border px-2 py-0.5 font-medium ${getStatusTone(runComparison.current.status)}`}>{runComparison.current.status}</span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">{formatCredits(runComparison.current.credits)} cr</span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">{formatCompactDuration(runComparison.current.durationMs)}</span>
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{runComparison?.comparisonMode === 'saved_experiment' ? 'Saved experiment' : 'Previous run'}</p>
                                  {runComparison.previous ? (<>
                                    <p className="mt-2 text-sm font-semibold text-white">{runComparison.previous.presetLabel}</p>
                                    <p className="mt-1 text-[12px] text-slate-400">{runComparison.previous.scenarioLabel}</p>
                                    <p className="mt-1 text-[11px] text-cyan-200/75">{runComparison.previous.experimentLabel || runComparison.comparisonLabel}</p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                      <span className={`rounded-full border px-2 py-0.5 font-medium ${getStatusTone(runComparison.previous.status)}`}>{runComparison.previous.status}</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatCredits(runComparison.previous.credits)} cr</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatCompactDuration(runComparison.previous.durationMs)}</span>
                                    </div>
                                  </>) : <p className="mt-2 text-sm text-slate-500">No comparable run yet for this setup.</p>}
                                </div>
                              </div>
                              {runComparison.previous ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Credit delta</p>
                                    <p className={`mt-1 text-lg font-semibold ${runComparison.current.credits <= runComparison.previous.credits ? 'text-emerald-300' : 'text-amber-300'}`}>
                                      {formatSignedDelta(Math.round(runComparison.current.credits - runComparison.previous.credits))} cr
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Duration delta</p>
                                    <p className={`mt-1 text-lg font-semibold ${((runComparison.current.durationMs || 0) <= (runComparison.previous.durationMs || 0)) ? 'text-emerald-300' : 'text-amber-300'}`}>
                                      {formatSignedDelta(Math.round(((runComparison.current.durationMs || 0) - (runComparison.previous.durationMs || 0)) / 1000))}s
                                    </p>
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-cyan-500/16 bg-cyan-500/8 p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/80">Current setup cohort</p>
                                  <p className="mt-1 text-sm font-medium text-white">{currentCohortPerformance?.label || 'No cohort yet'}</p>
                                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-200">
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">{currentCohortPerformance?.stats.count || 0} runs</span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">{Math.round((currentCohortPerformance?.stats.successRate || 0) * 100)}% success</span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-200">{currentCohortPerformance?.stats.averageCredits ? `${formatCredits(currentCohortPerformance.stats.averageCredits)} cr avg` : '—'}</span>
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Compared experiment cohort</p>
                                  <p className="mt-1 text-sm font-medium text-white">{selectedExperimentPerformance ? (selectedExperimentPerformance.experiment.notes || `${getScenarioLabelFromId(selectedExperimentPerformance.experiment.scenarioId)} · ${getPresetLabelFromId(selectedExperimentPerformance.experiment.previewPresetId)}`) : 'No saved experiment selected'}</p>
                                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedExperimentPerformance?.stats.count || 0} runs</span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{Math.round((selectedExperimentPerformance?.stats.successRate || 0) * 100)}% success</span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedExperimentPerformance?.stats.averageCredits ? `${formatCredits(selectedExperimentPerformance.stats.averageCredits)} cr avg` : '—'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Run this workflow twice and this lab will compare the operating setups side by side.
                            </div>
                          )}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Evidence freshness</p>
                              <h3 className="text-sm font-semibold text-white">How strong the current learning loop is</h3>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Completed runs</p>
                              <p className="mt-1 text-lg font-semibold text-white">{evidenceFreshness.runCount}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Observed experiments</p>
                              <p className="mt-1 text-lg font-semibold text-white">{evidenceFreshness.experimentCount}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Latest run</p>
                              <p className="mt-1 text-sm font-medium text-white">{formatRelativeTimeFromIso(evidenceFreshness.latestRunAt)}</p>
                            </div>
                            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Learning strength</p>
                              <p className={`mt-1 text-sm font-medium ${evidenceFreshness.tone === 'fresh' ? 'text-emerald-200' : evidenceFreshness.tone === 'warm' ? 'text-cyan-200' : 'text-amber-200'}`}>
                                {evidenceFreshness.confidence}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-slate-400">
                            Fresh, repeated evidence is what makes promotion decisions trustworthy. Thin or stale evidence means simulate more before locking policy.
                          </p>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase overlay</p>
                              <h3 className="text-sm font-semibold text-white">Where this exact run spent time, credits, and confidence</h3>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedReplayPhase('all')}
                              className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedReplayPhase === 'all' ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                            >
                              All phases
                            </button>
                            {replayPhaseOverlay.map((phase) => (
                              <button
                                key={`replay-phase-${phase.phase}`}
                                type="button"
                                onClick={() => setSelectedReplayPhase(phase.phase)}
                                className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedReplayPhase === phase.phase ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                              >
                                {formatDirectivePhaseScope([phase.phase])}
                              </button>
                            ))}
                          </div>
                          <div className="mt-4 space-y-3">
                            {replayPhaseOverlay.length > 0 ? replayPhaseOverlay.map((phase) => (
                              <button
                                key={`overlay-${phase.phase}`}
                                type="button"
                                onClick={() => setSelectedReplayPhase(phase.phase)}
                                className={`block w-full rounded-2xl border p-4 text-left ${selectedReplayPhaseDetail?.phase === phase.phase ? 'border-cyan-500/22 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/45'}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">{formatDirectivePhaseScope([phase.phase])}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{phase.primaryRole} · {phase.steps.length} steps · {phase.modelSource || 'Server default'}</p>
                                  </div>
                                  <span className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${phase.failed ? 'text-red-200' : phase.succeeded ? 'text-emerald-200' : 'text-slate-300'}`}>
                                    {phase.failed ? 'Failure surfaced' : phase.succeeded ? 'Landed cleanly' : 'No result'}
                                  </span>
                                </div>
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                    <span>Credit weight</span>
                                    <span>{phase.credits ? `${formatCredits(phase.credits)} cr` : '—'}</span>
                                  </div>
                                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: phase.costWidth }} />
                                  </div>
                                </div>
                              </button>
                            )) : (
                              <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                                Replay overlay appears once the selected run has phase-level step evidence.
                              </div>
                            )}
                          </div>
                          {selectedReplayPhaseDetail ? (
                            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected phase</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <div>
                                  <p className="text-[11px] text-slate-500">Credits</p>
                                  <p className="mt-1 text-sm font-medium text-white">{selectedReplayPhaseDetail.credits ? `${formatCredits(selectedReplayPhaseDetail.credits)} cr` : '—'}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-slate-500">Duration</p>
                                  <p className="mt-1 text-sm font-medium text-white">{formatCompactDuration(selectedReplayPhaseDetail.durationMs)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-slate-500">Tokens</p>
                                  <p className="mt-1 text-sm font-medium text-white">{formatTokenCount(selectedReplayPhaseDetail.tokens)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-slate-500">Directive</p>
                                  <p className="mt-1 text-sm font-medium text-white">{selectedReplayPhaseDetail.directiveMode ? getDirectiveModeLabel(selectedReplayPhaseDetail.directiveMode) : 'Baseline'}</p>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cohort trend</p>
                              <h3 className="text-sm font-semibold text-white">Current vs selected experiment over time</h3>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {(['credits', 'duration', 'success'] as TrendMetric[]).map((metric) => (
                              <button
                                key={metric}
                                type="button"
                                onClick={() => setTrendMetric(metric)}
                                className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${trendMetric === metric ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                              >
                                {getTrendMetricLabel(metric)}
                              </button>
                            ))}
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {cohortTrendSeries.map((series) => (
                              <div key={series.label} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium text-white">{series.label}</p>
                                  <span className="text-[11px] text-slate-500">{series.chart?.points.length || 0} runs</span>
                                </div>
                                {series.chart ? (() => {
                                  const chart = series.chart;
                                  const highlightedPoint = focusedCohortRun ? chart.points.find((point) => point.run.id === focusedCohortRun.id) : undefined;
                                  return (
                                    <div className="mt-3">
                                      <div className="relative overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02] px-2 py-3">
                                        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-32 w-full">
                                          {[0.25, 0.5, 0.75].map((ratio) => {
                                            const y = chart.height - 14 - (ratio * (chart.height - 28));
                                            return <line key={`${series.label}-${ratio}`} x1="18" x2={chart.width - 18} y1={y} y2={y} stroke={series.tone.grid} strokeDasharray="4 6" />;
                                          })}
                                          <path d={chart.areaPath} fill={series.tone.fill} />
                                          <path d={chart.linePath} fill="none" stroke={series.tone.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                          {chart.points.map((point) => (
                                            <circle
                                              key={`${series.label}-${point.run.id}`}
                                              cx={point.x}
                                              cy={point.y}
                                              r={selectedCohortRunId === point.run.id ? 6 : 4}
                                              fill={series.tone.dot}
                                              stroke={selectedCohortRunId === point.run.id ? '#e2e8f0' : 'rgba(15,23,42,0.9)'}
                                              strokeWidth={selectedCohortRunId === point.run.id ? 2 : 1.5}
                                              onMouseEnter={() => setHoveredCohortRunId(point.run.id)}
                                              onMouseLeave={() => setHoveredCohortRunId('')}
                                            />
                                          ))}
                                        </svg>
                                        {highlightedPoint ? (
                                          <div
                                            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-2xl border border-white/10 bg-navy-950/96 px-3 py-3 text-left shadow-[0_16px_40px_rgba(2,6,23,0.42)]"
                                            style={{
                                              left: `${(highlightedPoint.x / chart.width) * 100}%`,
                                              top: `${Math.max(12, ((highlightedPoint.y / chart.height) * 100) - 4)}%`,
                                            }}
                                          >
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{highlightedPoint.label}</p>
                                            <p className="mt-1 text-sm font-medium text-white">{highlightedPoint.metricLabel}</p>
                                            <p className="mt-1 text-[11px] text-slate-400">{series.label}</p>
                                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                              <span className={`rounded-full border px-2 py-0.5 font-medium ${getStatusTone(highlightedPoint.run.status)}`}>
                                                {highlightedPoint.run.status}
                                              </span>
                                              <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                                {highlightedPoint.run.actualCredits ? `${formatCredits(highlightedPoint.run.actualCredits)} cr` : '—'}
                                              </span>
                                              <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                                {formatAutomationRunTime(highlightedPoint.run.finishedAt || highlightedPoint.run.startedAt)}
                                              </span>
                                            </div>
                                            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                                              {getRunExperimentAttribution(highlightedPoint.run).experimentNotes || `${getRunExperimentAttribution(highlightedPoint.run).scenarioLabel} · ${getRunExperimentAttribution(highlightedPoint.run).previewPresetLabel}`}
                                            </p>
                                          </div>
                                        ) : null}
                                        <div className="mt-3 flex items-start justify-between gap-2">
                                          {chart.points.map((point) => (
                                            <button
                                              key={`${series.label}-${point.run.id}-label`}
                                              type="button"
                                              onClick={() => handleOpenRunInReplay(point.run, `${series.label.toLowerCase()} cohort`)}
                                              onMouseEnter={() => setHoveredCohortRunId(point.run.id)}
                                              onMouseLeave={() => setHoveredCohortRunId('')}
                                              className={`flex flex-1 min-w-0 flex-col rounded-xl border px-2 py-2 text-left transition-colors ${
                                                selectedCohortRunId === point.run.id
                                                  ? 'border-cyan-500/30 bg-cyan-500/10'
                                                  : 'border-transparent bg-white/[0.02] hover:border-white/8'
                                              }`}
                                            >
                                              <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{point.label}</span>
                                              <span className="mt-1 text-[11px] text-white">{point.metricLabel}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                                        <span>Older → newer evidence on the left-to-right curve</span>
                                        <span>{getTrendMetricLabel(trendMetric)} window</span>
                                      </div>
                                      {focusedCohortRun ? (
                                        <div className="mt-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-300">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="font-medium text-white">
                                              Focus run: {getRunExperimentAttribution(focusedCohortRun).experimentNotes || `${getRunExperimentAttribution(focusedCohortRun).scenarioLabel} · ${getRunExperimentAttribution(focusedCohortRun).previewPresetLabel}`}
                                            </span>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(focusedCohortRun.status)}`}>
                                              {focusedCohortRun.status}
                                            </span>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatTrendMetricValue(focusedCohortRun, trendMetric)}</span>
                                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{focusedCohortRun.actualCredits ? `${formatCredits(focusedCohortRun.actualCredits)} cr` : '—'}</span>
                                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatAutomationRunTime(focusedCohortRun.finishedAt || focusedCohortRun.startedAt)}</span>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })() : (
                                  <div className="mt-3 rounded-xl border border-dashed border-navy-700/70 bg-navy-950/35 p-3 text-sm text-slate-500">
                                    No run cohort yet for this setup.
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-amber-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Experiment history</p>
                              <h3 className="text-sm font-semibold text-white">Recent cost and outcome trend</h3>
                            </div>
                          </div>
                          {selectedRunTrend.length > 0 ? (
                            <>
                              <div className="mt-4 flex h-36 items-end gap-2">
                                {selectedRunTrend.map((run) => (
                                  <div key={run.id} className="flex min-w-0 flex-1 flex-col items-center">
                                    <div className="flex h-28 w-full items-end">
                                      <div className={`w-full rounded-t-2xl border border-white/8 bg-gradient-to-t ${run.status === 'failed' ? 'from-red-500/20 to-red-400/65' : run.status === 'succeeded' ? 'from-emerald-500/18 to-cyan-400/70' : 'from-violet-500/16 to-violet-400/65'}`} style={{ height: run.height }} />
                                    </div>
                                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">{run.label}</p>
                                    <p className="mt-1 text-[11px] text-white">{run.credits ? `${formatCredits(run.credits)} cr` : '—'}</p>
                                    <p className="text-[10px] text-slate-500">{run.duration}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                                {selectedRunTrend.map((run) => (
                                  <span key={`${run.id}-pill`} className={`rounded-full border px-2 py-0.5 font-medium ${run.statusTone}`}>
                                    {run.label}: {run.status}
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              No completed runs yet. Once this workflow runs, the trend will show whether the policy is buying real outcomes or just extra spend.
                            </div>
                          )}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Replay findings</p>
                              <h3 className="text-sm font-semibold text-white">What this run teaches</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {replayInsights.map((item) => (
                              <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{item.body}</p>
                              </div>
                            ))}
                            {replayWeakSpot ? (
                              <div className="rounded-2xl border border-cyan-500/16 bg-cyan-500/8 p-4">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Weak spot spotlight</p>
                                <p className="mt-2 text-sm font-medium text-white">{replayWeakSpot.title}</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-300">{replayWeakSpot.body}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPhaseSimulation({ phase: replayWeakSpot.phase, mode: replayWeakSpot.recommendedMode });
                                      setActiveRoom('optimize');
                                    }}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                                  >
                                    Simulate fix
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDirectivePhase(replayWeakSpot.phase);
                                      setSelectedWorkerRole(getPreferredRoleForPhase(replayWeakSpot.phase));
                                      setActiveRoom('live');
                                    }}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Open in node inspector
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr),minmax(0,1.08fr)]">
                      <div className="space-y-6">
                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          {autoPromotionSuggestion ? (
                            <div className={`mb-4 rounded-2xl border p-4 ${autoPromotionSuggestion.tone === 'quality' ? 'border-emerald-500/18 bg-emerald-500/8' : 'border-cyan-500/18 bg-cyan-500/8'}`}>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Automatic promotion suggestion</p>
                              <p className="mt-2 text-sm font-medium text-white">{autoPromotionSuggestion.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-300">{autoPromotionSuggestion.body}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">gate {autoPromotionSuggestion.threshold}% confidence</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{evidenceFreshness.confidence}</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{winningExperiment?.stats.count || 0} observed runs</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{gateProfileLearning.windowLabel}</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => handlePromoteExperimentFull(autoPromotionSuggestion.experiment)}
                                  className="rounded-xl border border-emerald-500/24 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/14 disabled:opacity-60"
                                >
                                  Promote recommended winner
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCompareExperiment(autoPromotionSuggestion.experiment)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Review in comparison lab
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div className="mb-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Promotion gate</p>
                                <p className="mt-1 text-sm font-medium text-white">Only auto-suggest winners when confidence clears this threshold</p>
                              </div>
                              <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{autoPromotionThreshold}%</span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                              <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{activeGateScope.scope}</span>
                              <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{activeGateScope.label}</span>
                            </div>
                            {recommendedGateProfile ? (
                              <div className="mt-3 rounded-xl border border-cyan-500/16 bg-cyan-500/8 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recommended profile</p>
                                    <p className="mt-1 text-sm font-medium text-white">{recommendedGateProfile.label}</p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={studioBusy}
                                    onClick={() => handleApplyGateProfile(recommendedGateProfile.id)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                                  >
                                    Apply recommendation
                                  </button>
                                </div>
                                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{recommendedGateProfile.summary}</p>
                                {gateProfileLearning.items.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                      Best by {gateProfileLearning.scopeLabel}
                                    </span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                      {gateProfileLearning.items[0].stats.count} observed runs
                                    </span>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                      {gateProfileLearning.items[0].confidence}% confidence
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {gateProfileLearning.items.length > 0 ? (
                              <div className="mt-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Gate profile learning</p>
                                    <p className="mt-1 text-sm font-medium text-white">What works best for this workflow class</p>
                                  </div>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                    {gateProfileLearning.scopeLabel}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                    {gateProfileLearning.windowLabel}
                                  </span>
                                  {(['recent', 'deep', 'all'] as GateLearningWindow[]).map((windowId) => (
                                    <button
                                      key={`gate-window-${windowId}`}
                                      type="button"
                                      onClick={() => setGateLearningWindow(windowId)}
                                      className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${
                                        gateLearningWindow === windowId
                                          ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {windowId === 'recent' ? 'Recent' : windowId === 'deep' ? 'Deep' : 'All'}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                  {gateProfileLearning.items.map((item) => (
                                    <div key={`gate-learning-${item.profile.id}`} className={`rounded-xl border px-3 py-3 ${recommendedGateProfile?.id === item.profile.id ? 'border-cyan-500/24 bg-cyan-500/8' : 'border-white/6 bg-white/[0.02]'}`}>
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-medium text-white">{item.profile.label}</p>
                                          <p className="mt-1 text-[11px] text-slate-500">{item.workflowCount} workflows · {item.stats.count} runs</p>
                                        </div>
                                        <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {item.score}</span>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                        <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{Math.round(item.stats.successRate * 100)}% success</span>
                                        <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{item.stats.averageCredits ? `${formatCredits(item.stats.averageCredits)} cr avg` : '—'}</span>
                                        <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{item.confidence}% confidence</span>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={studioBusy}
                                          onClick={() => handleApplyGateProfile(item.profile.id)}
                                          className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                                        >
                                          Apply {item.profile.label}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <div className="mt-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Window comparison</p>
                                  <p className="mt-1 text-sm font-medium text-white">How stable the gate recommendation is</p>
                                </div>
                                <span className={`ui-pill px-2 py-0.5 normal-case tracking-normal ${
                                  gateLearningComparison.stability === 'Stable'
                                    ? 'text-emerald-200'
                                    : gateLearningComparison.stability === 'Mixed'
                                      ? 'text-cyan-200'
                                      : 'text-amber-200'
                                }`}>
                                  {gateLearningComparison.stability}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                {gateLearningComparison.windows.map((window) => (
                                  <div key={`window-compare-${window.window}`} className={`rounded-xl border px-3 py-3 ${gateLearningWindow === window.window ? 'border-cyan-500/24 bg-cyan-500/8' : 'border-white/6 bg-white/[0.02]'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium text-white">{window.label}</p>
                                      <button
                                        type="button"
                                        onClick={() => setGateLearningWindow(window.window)}
                                        className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                      >
                                        Use
                                      </button>
                                    </div>
                                    <p className="mt-2 text-sm text-white">{window.leader?.profile.label || 'No leader yet'}</p>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{window.leader?.stats.count || 0} runs</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{window.leader ? `${Math.round(window.leader.stats.successRate * 100)}% success` : '—'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                              {PROMOTION_GATE_PROFILES.map((profile) => (
                                <button
                                  key={profile.id}
                                  type="button"
                                  disabled={studioBusy}
                                  onClick={() => handleApplyGateProfile(profile.id)}
                                  className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-cyan-500/18 hover:bg-white/[0.04] disabled:opacity-60"
                                >
                                  <p className="text-sm font-medium text-white">{profile.label}</p>
                                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{profile.summary}</p>
                                </button>
                              ))}
                            </div>
                            <div className="mt-3 space-y-3">
                              {[
                                { scope: 'global' as const, label: 'Global default', value: selectedStudioState.autoPromotionMinConfidence ?? 55 },
                                { scope: 'archetype' as const, label: `${selectedArchetype.label}`, value: selectedStudioState.autoPromotionArchetypeThresholds?.[selectedArchetype.id] ?? autoPromotionThreshold },
                                { scope: 'scenario' as const, label: `${selectedScenario.label}`, value: selectedStudioState.autoPromotionScenarioThresholds?.[selectedScenario.id] ?? autoPromotionThreshold },
                              ].map((scopeItem) => (
                                <div key={`gate-${scopeItem.scope}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-medium text-white">{scopeItem.label}</p>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{scopeItem.value}%</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {[55, 70, 85].map((threshold) => (
                                      <button
                                        key={`threshold-${scopeItem.scope}-${threshold}`}
                                        type="button"
                                        disabled={studioBusy}
                                        onClick={() => handleSetScopedAutoPromotionThreshold(scopeItem.scope, threshold)}
                                        className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${scopeItem.value === threshold ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'} disabled:opacity-60`}
                                      >
                                        {threshold}% confidence
                                      </button>
                                    ))}
                                  </div>
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      disabled={studioBusy}
                                      onClick={() => handleClearScopedAutoPromotionThreshold(scopeItem.scope)}
                                      className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300 disabled:opacity-60"
                                    >
                                      Reset {scopeItem.label}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-emerald-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Best operating setup</p>
                              <h3 className="text-sm font-semibold text-white">What is actually winning</h3>
                            </div>
                          </div>
                          {winningExperiment ? (
                            <>
                              <p className="mt-3 text-sm font-medium text-white">{getExperimentDisplayLabel(winningExperiment.experiment)}</p>
                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{winningExperiment.stats.count} runs</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{Math.round(winningExperiment.stats.successRate * 100)}% success</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{winningExperiment.stats.averageCredits ? `${formatCredits(winningExperiment.stats.averageCredits)} cr avg` : '—'}</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {winningExperiment.score}</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{winningExperiment.confidence}% confidence</span>
                                {winningExperiment.latestAt ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">seen {formatRelativeTimeFromIso(winningExperiment.latestAt)}</span> : null}
                              </div>
                              <p className="mt-3 text-sm leading-relaxed text-slate-400">This is the strongest observed setup for this workflow right now. Promote it when you want the live policy to match what is already working in practice.</p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCompareExperiment(winningExperiment.experiment)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Compare winner
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => handlePromoteExperimentPreset(winningExperiment.experiment)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-emerald-200"
                                >
                                  Promote preset
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => handlePromoteExperimentSteering(winningExperiment.experiment)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                                >
                                  Promote steering
                                </button>
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => handlePromoteExperimentFull(winningExperiment.experiment)}
                                  className="rounded-xl border border-emerald-500/24 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Promote full setup
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleForkWinningSetup(winningExperiment.experiment)}
                                  className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                >
                                  Branch winner
                                </button>
                              </div>
                              {winningExperimentPhases.length > 0 ? (
                                <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Phase-level adoption</p>
                                      <p className="mt-1 text-sm font-medium text-white">Promote only the part that is winning</p>
                                    </div>
                                    <span className="text-[11px] text-slate-500">Useful when one phase is clearly better than the rest</span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {winningExperimentPhases.map((phase) => (
                                      <div key={`winning-${phase}`} className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={actionBusy}
                                          onClick={() => handlePromoteExperimentPhase(winningExperiment.experiment, phase)}
                                          className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                                        >
                                          Adopt {formatDirectivePhaseScope([phase])}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={actionBusy}
                                          onClick={() => handlePromoteExperimentPresetAndPhase(winningExperiment.experiment, phase)}
                                          className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-emerald-200 disabled:opacity-60"
                                        >
                                          Add preset + {formatDirectivePhaseScope([phase])}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Save and run a few experiments first. This card promotes the strongest observed setup once there is evidence.
                            </div>
                          )}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-4 w-4 text-cyan-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch families</p>
                              <h3 className="text-sm font-semibold text-white">Which experiment lines are compounding</h3>
                            </div>
                          </div>
                          {branchFamilyComparison ? (
                            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch vs branch</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {[
                                  { slot: 'left', family: selectedBranchFamily, label: 'Primary branch' },
                                  { slot: 'right', family: comparedBranchFamily, label: 'Compare against' },
                                ].map((slot) => (
                                  <div key={`branch-slot-${slot.slot}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                    <p className="text-[11px] text-slate-400">{slot.label}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {branchFamilyPerformance.map((family) => (
                                        <button
                                          key={`${slot.slot}-${family.rootExperiment.id}`}
                                          type="button"
                                          onClick={() => slot.slot === 'left' ? setSelectedBranchRootId(family.rootExperiment.id) : setComparedBranchRootId(family.rootExperiment.id)}
                                          className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${
                                            slot.family?.rootExperiment.id === family.rootExperiment.id
                                              ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                                              : 'text-slate-300'
                                          }`}
                                        >
                                          {getExperimentDisplayLabel(family.rootExperiment)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-emerald-500/16 bg-emerald-500/8 px-3 py-3">
                                  <p className="text-[11px] text-slate-400">Leader</p>
                                  <p className="mt-1 text-sm font-medium text-white">{getExperimentDisplayLabel(branchFamilyComparison.leader.rootExperiment)}</p>
                                </div>
                                <div className="rounded-xl border border-cyan-500/16 bg-cyan-500/8 px-3 py-3">
                                  <p className="text-[11px] text-slate-400">Challenger</p>
                                  <p className="mt-1 text-sm font-medium text-white">{getExperimentDisplayLabel(branchFamilyComparison.challenger.rootExperiment)}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{branchFamilyComparison.successDelta >= 0 ? '+' : ''}{branchFamilyComparison.successDelta} pts success</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{branchFamilyComparison.creditsDelta <= 0 ? '' : '+'}{branchFamilyComparison.creditsDelta} credits</span>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{branchFamilyComparison.confidenceDelta >= 0 ? '+' : ''}{branchFamilyComparison.confidenceDelta}% confidence</span>
                                {selectedStudioState.selectedBranchRootId || selectedStudioState.comparedBranchRootId ? (
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">Saved compare pair</span>
                                ) : null}
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {[
                                  { label: 'Leader line', family: branchFamilyComparison.leader, chart: branchComparisonCharts?.leader, tone: 'rgba(16,185,129,0.9)', fill: 'rgba(16,185,129,0.14)' },
                                  { label: 'Challenger line', family: branchFamilyComparison.challenger, chart: branchComparisonCharts?.challenger, tone: 'rgba(34,211,238,0.95)', fill: 'rgba(34,211,238,0.12)' },
                                ].map((item) => (
                                  <div key={`branch-compare-${item.label}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                    <p className="text-[11px] font-medium text-white">{item.label}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{getExperimentDisplayLabel(item.family.rootExperiment)}</p>
                                    {item.chart ? (
                                      <svg viewBox={`0 0 ${item.chart.width} ${item.chart.height}`} className="mt-3 h-28 w-full">
                                        <path d={item.chart.areaPath} fill={item.fill} />
                                        <path d={item.chart.linePath} fill="none" stroke={item.tone} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                        {item.chart.points.map((point) => (
                                          <circle key={`branch-compare-${item.label}-${point.run.id}`} cx={point.x} cy={point.y} r="3.5" fill={item.tone} />
                                        ))}
                                      </svg>
                                    ) : (
                                      <div className="mt-3 rounded-xl border border-dashed border-white/6 bg-white/[0.02] p-3 text-[11px] text-slate-500">
                                        Not enough runs yet for this line.
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-4 space-y-3">
                            {branchFamilyPerformance.length > 0 ? branchFamilyPerformance.map((family) => (
                              <div
                                key={`branch-family-${family.rootExperiment.id}`}
                                className={`rounded-2xl border p-4 transition-colors ${selectedBranchFamily?.rootExperiment.id === family.rootExperiment.id ? 'border-cyan-500/22 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/45'}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">{getExperimentDisplayLabel(family.rootExperiment)}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {family.experiments.length} branch {family.experiments.length === 1 ? 'member' : 'members'} · {family.stats.count} observed {family.stats.count === 1 ? 'run' : 'runs'}
                                    </p>
                                  </div>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {family.score}</span>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                    <p className="text-slate-500">Success</p>
                                    <p className="mt-1 text-white">{Math.round(family.stats.successRate * 100)}%</p>
                                  </div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                    <p className="text-slate-500">Avg credits</p>
                                    <p className="mt-1 text-white">{family.stats.averageCredits ? `${formatCredits(family.stats.averageCredits)} cr` : '—'}</p>
                                  </div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2">
                                    <p className="text-slate-500">Confidence</p>
                                    <p className="mt-1 text-white">{family.confidence}%</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                  {family.latestAt ? <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">seen {formatRelativeTimeFromIso(family.latestAt)}</span> : null}
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                    {family.confidence >= 70 ? 'Strong branch evidence' : family.confidence >= 50 ? 'Building branch evidence' : 'Thin branch evidence'}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedBranchRootId(family.rootExperiment.id);
                                      handleCompareExperiment(family.rootExperiment);
                                    }}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Compare branch family
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleForkWinningSetup(family.rootExperiment)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Fork this line
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedBranchRootId(family.rootExperiment.id)}
                                    className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${selectedBranchFamily?.rootExperiment.id === family.rootExperiment.id ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                                  >
                                    Inspect branch replay
                                  </button>
                                </div>
                              </div>
                            )) : (
                              <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                                Branch families will appear once you start forking experiments and collecting a few runs against them.
                              </div>
                            )}
                          </div>
                          {selectedBranchFamily ? (
                            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Selected branch replay</p>
                                  <p className="mt-1 text-sm font-medium text-white">{getExperimentDisplayLabel(selectedBranchFamily.rootExperiment)}</p>
                                </div>
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{selectedBranchFamily.runs.length} runs in branch line</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                {selectedBranchFamily.experiments.slice(0, 5).map((experiment) => (
                                  <button
                                    key={`member-${experiment.id}`}
                                    type="button"
                                    onClick={() => handleCompareExperiment(experiment)}
                                    className={`ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal ${selectedComparisonExperimentId === experiment.id ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'}`}
                                  >
                                    {getExperimentDisplayLabel(experiment)}
                                  </button>
                                ))}
                                {selectedBranchFamily.experiments.length > 5 ? (
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                    +{selectedBranchFamily.experiments.length - 5} more
                                  </span>
                                ) : null}
                                {(['all', 'succeeded', 'failed'] as BranchRunFilter[]).map((filter) => (
                                  <button
                                    key={`branch-filter-${filter}`}
                                    type="button"
                                    onClick={() => setBranchRunFilter(filter)}
                                    className={`ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal ${
                                      branchRunFilter === filter ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200' : 'text-slate-300'
                                    }`}
                                  >
                                    {filter === 'all' ? 'All runs' : filter === 'succeeded' ? 'Succeeded' : 'Failed'}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-3 space-y-2">
                                {filteredBranchRuns.slice(0, 6).map((run, index) => (
                                  <button
                                    key={`branch-run-${run.id}`}
                                    type="button"
                                    onClick={() => handleOpenRunInReplay(run, 'branch replay')}
                                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${selectedCohortRunId === run.id ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/6 bg-white/[0.02] hover:border-white/10'}`}
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-white">Branch run {index + 1}</p>
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        {getRunExperimentAttribution(run).experimentNotes || `${getRunExperimentAttribution(run).scenarioLabel} · ${getRunExperimentAttribution(run).previewPresetLabel}`}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-slate-300">
                                      <span className={`rounded-full border px-2 py-0.5 font-medium ${getStatusTone(run.status)}`}>{run.status}</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{run.actualCredits ? `${formatCredits(run.actualCredits)} cr` : '—'}</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatAutomationRunTime(run.finishedAt || run.startedAt)}</span>
                                    </div>
                                  </button>
                                ))}
                                {filteredBranchRuns.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-white/6 bg-white/[0.02] px-3 py-3 text-sm text-slate-500">
                                    No branch runs match this filter yet.
                                  </div>
                                ) : null}
                              </div>
                              <div className="mt-4 grid gap-3 sm:grid-cols-3 text-[11px]">
                                <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                  <p className="text-slate-500">Branch score</p>
                                  <p className="mt-1 text-white">{selectedBranchFamily.score}</p>
                                </div>
                                <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                  <p className="text-slate-500">Avg duration</p>
                                  <p className="mt-1 text-white">{formatCompactDuration(selectedBranchFamily.stats.averageDurationMs)}</p>
                                </div>
                                <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                  <p className="text-slate-500">Vs workflow spend</p>
                                  <p className="mt-1 text-white">
                                    {selectedRow?.averageCredits
                                      ? `${Math.round(selectedBranchFamily.stats.averageCredits - selectedRow.averageCredits)} cr`
                                      : '—'}
                                  </p>
                                </div>
                              </div>
                              {branchTrendSeries ? (
                                <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-4">
                                  <svg viewBox={`0 0 ${branchTrendSeries.width} ${branchTrendSeries.height}`} className="h-36 w-full">
                                    {[0.25, 0.5, 0.75].map((ratio) => {
                                      const y = branchTrendSeries.height - 14 - (ratio * (branchTrendSeries.height - 28));
                                      return <line key={`branch-grid-${ratio}`} x1="18" x2={branchTrendSeries.width - 18} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" strokeDasharray="4 6" />;
                                    })}
                                    <path d={branchTrendSeries.areaPath} fill="rgba(34,211,238,0.12)" />
                                    <path d={branchTrendSeries.linePath} fill="none" stroke="rgba(34,211,238,0.95)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    {branchTrendSeries.points.map((point) => (
                                      <circle
                                        key={`branch-point-${point.run.id}`}
                                        cx={point.x}
                                        cy={point.y}
                                        r={selectedCohortRunId === point.run.id ? 6 : 4}
                                        fill="rgba(103,232,249,1)"
                                        stroke={selectedCohortRunId === point.run.id ? '#e2e8f0' : 'rgba(15,23,42,0.9)'}
                                        strokeWidth={selectedCohortRunId === point.run.id ? 2 : 1.5}
                                        onMouseEnter={() => setHoveredCohortRunId(point.run.id)}
                                        onMouseLeave={() => setHoveredCohortRunId('')}
                                        onClick={() => handleOpenRunInReplay(point.run, 'branch trend')}
                                      />
                                    ))}
                                  </svg>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                                    <span>Longer branch evidence window</span>
                                    <span>{getTrendMetricLabel(trendMetric)} over up to 12 runs</span>
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch member leaderboard</p>
                                <div className="mt-3 space-y-3">
                                  {selectedBranchMemberPerformance.slice(0, 4).map((member) => (
                                    <div key={`branch-member-${member.experiment.id}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-medium text-white">{getExperimentDisplayLabel(member.experiment)}</p>
                                          <p className="mt-1 text-[11px] text-slate-500">{member.stats.count} runs · {Math.round(member.stats.successRate * 100)}% success</p>
                                        </div>
                                        <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {member.score}</span>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleCompareExperiment(member.experiment)}
                                          className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                        >
                                          Compare member
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRestoreExperiment(member.experiment)}
                                          className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200"
                                        >
                                          Restore member
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Branch causal report</p>
                                <div className="mt-3 space-y-3">
                                  {selectedBranchCausalReport.map((item) => (
                                    <div key={`branch-causal-${item.title}`} className={`rounded-2xl border p-4 ${item.tone}`}>
                                      <p className="text-sm font-medium text-white">{item.title}</p>
                                      <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{item.body}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Causal report</p>
                              <h3 className="text-sm font-semibold text-white">Why the current winner is winning</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {winnerCausalReport.map((item) => (
                              <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-200/90">{item.body}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Experiment scorecards</p>
                              <h3 className="text-sm font-semibold text-white">How saved setups perform over time</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {experimentPerformance.length > 0 ? experimentPerformance.map((entry) => (
                              <div key={entry.experiment.id} className={`rounded-2xl border p-3 ${selectedComparisonExperimentId === entry.experiment.id ? 'border-cyan-500/24 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/45'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{getExperimentDisplayLabel(entry.experiment)}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">Saved {formatRelativeTimeFromIso(entry.experiment.createdAt)}{entry.latestAt ? ` · observed ${formatRelativeTimeFromIso(entry.latestAt)}` : ''}</p>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                      {getExperimentTags(entry.experiment, { count: entry.stats.count, successRate: entry.stats.successRate, averageCredits: entry.stats.averageCredits }, winningExperiment?.experiment.id === entry.experiment.id).map((tag) => (
                                        <span key={`${entry.experiment.id}-${tag}`} className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{tag}</span>
                                      ))}
                                    </div>
                                  </div>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">score {entry.score}</span>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-4 text-[11px]">
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Runs</p><p className="mt-1 text-white">{entry.stats.count}</p></div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Success</p><p className="mt-1 text-white">{Math.round(entry.stats.successRate * 100)}%</p></div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Avg credits</p><p className="mt-1 text-white">{entry.stats.averageCredits ? `${formatCredits(entry.stats.averageCredits)} cr` : '—'}</p></div>
                                  <div className="rounded-xl border border-navy-700/70 bg-navy-950/55 px-3 py-2"><p className="text-slate-500">Confidence</p><p className="mt-1 text-white">{entry.confidence}%</p></div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">recency +{entry.recencyBoost}</span>
                                  <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{entry.stats.count >= 4 ? 'Deep evidence' : entry.stats.count >= 2 ? 'Moderate evidence' : 'Thin evidence'}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button type="button" onClick={() => handleCompareExperiment(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300">Compare</button>
                                  <button type="button" disabled={actionBusy} onClick={() => handlePromoteExperimentPreset(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-emerald-200">Preset</button>
                                  <button type="button" disabled={actionBusy} onClick={() => handlePromoteExperimentSteering(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200">Steering</button>
                                  <button type="button" disabled={actionBusy} onClick={() => handlePromoteExperimentFull(entry.experiment)} className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300">Full</button>
                                </div>
                              </div>
                            )) : (
                              <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                                No saved experiment performance yet.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-amber-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Promotion history</p>
                              <h3 className="text-sm font-semibold text-white">How the live policy got here</h3>
                            </div>
                          </div>
                          {rollbackSuggestion ? (
                            <div className="mt-4 rounded-2xl border border-amber-500/18 bg-amber-500/8 p-4">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Rollback suggestion</p>
                              <p className="mt-2 text-sm font-medium text-white">{rollbackSuggestion.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-300">{rollbackSuggestion.body}</p>
                              {rollbackSuggestion.restoreExperiment ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => handlePromoteExperimentPreset(rollbackSuggestion.restoreExperiment!)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-emerald-200 disabled:opacity-60"
                                  >
                                    Restore preset only
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => handlePromoteExperimentSteering(rollbackSuggestion.restoreExperiment!)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-cyan-200 disabled:opacity-60"
                                  >
                                    Restore steering only
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => handlePromoteExperimentFull(rollbackSuggestion.restoreExperiment!)}
                                    className="rounded-xl border border-amber-500/24 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/14 disabled:opacity-60"
                                  >
                                    Restore recommended setup
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCompareExperiment(rollbackSuggestion.restoreExperiment!)}
                                    className="ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal text-slate-300"
                                  >
                                    Review target
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {promotionAudit.length > 0 ? (
                            <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Promotion audit</p>
                              <div className="mt-3 space-y-3">
                                {promotionAudit.slice(0, 4).map((entry) => (
                                  <div key={`audit-${entry.id}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-medium text-white">{getPromotionModeLabel(entry.mode)}</p>
                                        <p className="mt-1 text-[11px] text-slate-500">{entry.summary}</p>
                                      </div>
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${entry.outcome === 'Positive' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : entry.outcome === 'Mixed' ? 'border-amber-500/25 bg-amber-500/10 text-amber-200' : 'border-slate-600 bg-slate-800/60 text-slate-300'}`}>
                                        {entry.outcome}
                                      </span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300">
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{entry.subsequentRuns.length} subsequent runs</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{Math.round(entry.stats.successRate * 100)}% success</span>
                                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{entry.stats.averageCredits ? `${formatCredits(entry.stats.averageCredits)} cr avg` : '—'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-4 space-y-3">
                            {selectedStudioState.promotionHistory?.length ? selectedStudioState.promotionHistory.map((entry) => (
                              <div key={entry.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getPromotionModeTone(entry.mode)}`}>
                                        {getPromotionModeLabel(entry.mode)}
                                      </span>
                                      {entry.phase ? (
                                        <span className="ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300">
                                          {formatDirectivePhaseScope([entry.phase])}
                                        </span>
                                      ) : null}
                                      {entry.sourceExperimentLabel ? (
                                        <span className="ui-pill px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-300">
                                          {entry.sourceExperimentLabel}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{entry.summary}</p>
                                  </div>
                                  <span className="text-[11px] text-slate-500">{formatRelativeTimeFromIso(entry.appliedAt)}</span>
                                </div>
                              </div>
                            )) : (
                              <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                                No promotions yet. Once you start promoting winners, steering phases, or branching live policy, the decision trail will show up here.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-violet-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role heatmap</p>
                              <h3 className="text-sm font-semibold text-white">Which specialists are earning their keep</h3>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                          {roleHeatmap.length > 0 ? roleHeatmap.map((role) => (
                            <div key={role.role} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium capitalize text-white">{role.role}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{role.steps} handoffs · {formatCredits(role.credits)} cr</p>
                                </div>
                                <div className="text-right text-[11px] text-slate-400">
                                  <p>{role.failureRate}% fail rate</p>
                                  <p className="mt-1">{formatTokenCount(role.tokens)} tokens</p>
                                </div>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-navy-950/70">
                                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: role.activityWidth }} />
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              No role performance data yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow benchmarks</p>
                            <h3 className="text-sm font-semibold text-white">How this workflow compares</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {workflowBenchmarks.map((row) => (
                            <button
                              key={row.id}
                              type="button"
                              onClick={() => setSelectedAutomationId(row.id)}
                              className={`w-full rounded-2xl border p-3 text-left transition-colors ${row.isSelected ? 'border-violet-500/25 bg-violet-500/8' : 'border-navy-700/70 bg-navy-950/40 hover:border-violet-500/18 hover:bg-navy-900/55'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">{row.name}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{row.stepCount} steps</p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(row.lastStatus)}`}>
                                  {row.lastStatus}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div>
                                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                    <span>Success</span>
                                    <span>{row.successRate}%</span>
                                  </div>
                                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" style={{ width: `${Math.max(10, row.successRate)}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                    <span>Spend</span>
                                    <span>{row.averageCredits ? `${formatCredits(row.averageCredits)} cr` : '—'}</span>
                                  </div>
                                  <div className="mt-1 h-2 rounded-full bg-navy-950/70">
                                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-violet-400" style={{ width: row.costWidth }} />
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="rounded-[1.8rem] border border-dashed border-navy-700/70 bg-navy-950/35 px-5 py-12 text-center">
                <p className="text-lg font-medium text-white">No workflows available</p>
                <p className="mt-2 text-sm text-slate-500">Create a scheduled workflow first, then come back here to manage the agent system behind it.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
