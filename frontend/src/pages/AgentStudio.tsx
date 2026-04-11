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

interface StudioExperimentRecord {
  id: string;
  scenarioId: string;
  previewPresetId: string;
  createdAt: string;
  notes?: string;
}

interface StudioRoleDirective {
  mode: 'cheaper' | 'review' | 'promote';
  updatedAt: string;
}

interface AutomationStudioStateDraft {
  selectedScenarioId?: string;
  previewPresetId?: string;
  experimentHistory?: StudioExperimentRecord[];
  roleDirectives?: Record<string, StudioRoleDirective>;
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
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : undefined;

  const roleDirectives = isRecord(value.roleDirectives)
    ? Object.fromEntries(
        Object.entries(value.roleDirectives)
          .map(([role, directive]) => {
            if (!isRecord(directive)) return null;
            if (directive.mode !== 'cheaper' && directive.mode !== 'review' && directive.mode !== 'promote') return null;
            const updatedAt = readString(directive.updatedAt);
            if (!updatedAt) return null;
            return [role, { mode: directive.mode, updatedAt }] satisfies [string, StudioRoleDirective];
          })
          .filter((entry): entry is [string, StudioRoleDirective] => Boolean(entry))
      )
    : undefined;

  return {
    selectedScenarioId: readString(value.selectedScenarioId),
    previewPresetId: readString(value.previewPresetId),
    experimentHistory,
    roleDirectives,
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
    const maxCredits = Math.max(...recentRuns.map((run) => run.actualCredits || 0), 1);

    return recentRuns.map((run, index) => ({
      id: run.id,
      label: recentRuns.length === 1 ? 'Latest' : `Run ${index + 1}`,
      credits: run.actualCredits || 0,
      height: `${Math.max(18, ((run.actualCredits || 0) / maxCredits) * 100)}%`,
      status: run.status,
      statusTone: getStatusTone(run.status),
      duration: formatCompactDuration(
        Number.isNaN(Date.parse(run.startedAt || '')) || Number.isNaN(Date.parse(run.finishedAt || ''))
          ? undefined
          : Math.max(0, Date.parse(run.finishedAt || '') - Date.parse(run.startedAt || ''))
      ),
    }));
  }, [selectedRow]);

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
    setSelectedWorkerRole('nexus');
    setSelectedScenarioId(
      selectedStudioState.selectedScenarioId && SCENARIO_PRESETS.some((scenario) => scenario.id === selectedStudioState.selectedScenarioId)
        ? selectedStudioState.selectedScenarioId as ScenarioPresetId
        : 'baseline'
    );
    if (selectedStudioState.previewPresetId && POLICY_PRESETS.some((preset) => preset.id === selectedStudioState.previewPresetId)) {
      setPreviewPresetId(selectedStudioState.previewPresetId);
    }
  }, [selectedRow?.automation.id, selectedStudioState.previewPresetId, selectedStudioState.selectedScenarioId]);

  const previewPreset = useMemo(
    () => POLICY_PRESETS.find((preset) => preset.id === previewPresetId) || POLICY_PRESETS[0],
    [previewPresetId]
  );

  const selectedScenario = useMemo(
    () => getScenarioPreset(selectedScenarioId),
    [selectedScenarioId]
  );

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
    const items: Array<{ title: string; body: string }> = [];
    if (selectedRow.successRate > 0 && selectedRow.successRate < 0.7) {
      items.push({
        title: 'Increase review pressure',
        body: 'This workflow is missing too often. Move review toward Standard or Strict so heavier reasoning is only added where it reduces failures.',
      });
    }
    if (selectedMath.toolCalls >= 3 && selectedPolicy.optimizationGoal !== 'cost_saver') {
      items.push({
        title: 'Route tool-heavy work down-market',
        body: 'Most of the work here is tool orchestration. Cost Saver will keep delivery and watch tasks on cheaper lanes without sacrificing output quality.',
      });
    }
    if (selectedPolicy.mode === 'custom' && selectedPolicy.maxElasticLanes < selectedMath.recommendedElasticLanes) {
      items.push({
        title: 'Raise lane cap for this workflow',
        body: `The current workflow math wants ${selectedMath.recommendedElasticLanes} elastic lanes. Your cap is constraining parallel work and likely slowing completion.`,
      });
    }
    if (selectedPolicy.mode === 'custom' && selectedPolicy.maxElasticLanes > selectedMath.recommendedElasticLanes + 1) {
      items.push({
        title: 'Trim excess elastic capacity',
        body: 'This workflow does not justify the current lane cap. Reducing it should lower spend without hurting reliability.',
      });
    }
    if (items.length === 0) {
      items.push({
        title: 'Current configuration is healthy',
        body: 'This workflow is aligned with its complexity. The next gains will come from tightening the workflow itself, not from more agent complexity.',
      });
    }
    return items.slice(0, 3);
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

  const selectedRoleDirective = useMemo(
    () => selectedStudioState.roleDirectives?.[selectedWorkerDetail.worker?.role || ''],
    [selectedStudioState.roleDirectives, selectedWorkerDetail.worker?.role]
  );

  const experimentHistory = useMemo(
    () => (selectedStudioState.experimentHistory || []).slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [selectedStudioState.experimentHistory]
  );

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

  const learnedPresetLeaderboard = useMemo(() => {
    const scored = rows.map((row) => {
      const policy = normalizeExecutionPolicy(row.automation.execution_policy);
      const archetype = classifyWorkflowArchetype(row.workflowSteps);
      const presetMatch = POLICY_PRESETS.find((preset) =>
        preset.policy.mode === policy.mode &&
        preset.policy.optimizationGoal === policy.optimizationGoal &&
        preset.policy.reviewPolicy === policy.reviewPolicy &&
        preset.policy.maxElasticLanes === policy.maxElasticLanes
      );
      const score = Math.round(row.successRate * 70 + Math.max(0, 30 - row.averageCredits / 4));
      return {
        workflowId: row.automation.id,
        workflowName: row.automation.name,
        archetypeId: archetype.id,
        archetypeLabel: archetype.label,
        presetId: presetMatch?.id || 'custom_live',
        presetLabel: presetMatch?.label || 'Custom live policy',
        score,
        successRate: Math.round(row.successRate * 100),
        averageCredits: row.averageCredits,
        averageDurationMs: row.averageDurationMs,
      };
    }).filter((item) => item.archetypeId === selectedArchetype.id);

    const aggregate = new Map<string, { label: string; workflows: number; score: number; success: number; credits: number }>();
    scored.forEach((item) => {
      const current = aggregate.get(item.presetId) || { label: item.presetLabel, workflows: 0, score: 0, success: 0, credits: 0 };
      current.workflows += 1;
      current.score += item.score;
      current.success += item.successRate;
      current.credits += item.averageCredits;
      aggregate.set(item.presetId, current);
    });

    return Array.from(aggregate.entries())
      .map(([presetId, value]) => ({
        presetId,
        label: value.label,
        workflowCount: value.workflows,
        averageScore: Math.round(value.score / value.workflows),
        averageSuccess: Math.round(value.success / value.workflows),
        averageCredits: value.workflows ? value.credits / value.workflows : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 4);
  }, [rows, selectedArchetype.id]);

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
    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: role
          ? {
              ...(selectedStudioState.roleDirectives || {}),
              [role]: { mode: 'cheaper', updatedAt: new Date().toISOString() },
            }
          : selectedStudioState.roleDirectives,
      },
    }, { successMessage: 'Shifted this role toward cheaper routing.' });
  }, [patchAutomationConfig, selectedMath.recommendedElasticLanes, selectedPolicy, selectedStudioState, selectedWorkerDetail.worker?.laneType, selectedWorkerDetail.worker?.role]);

  const handleIncreaseReview = useCallback(() => {
    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      reviewPolicy: 'strict',
      optimizationGoal: selectedPolicy.optimizationGoal === 'cost_saver' ? 'balanced' : selectedPolicy.optimizationGoal,
    };
    const role = selectedWorkerDetail.worker?.role;
    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: role
          ? {
              ...(selectedStudioState.roleDirectives || {}),
              [role]: { mode: 'review', updatedAt: new Date().toISOString() },
            }
          : selectedStudioState.roleDirectives,
      },
    }, { successMessage: 'Raised review pressure for this workflow.' });
  }, [patchAutomationConfig, selectedPolicy, selectedStudioState, selectedWorkerDetail.worker?.role]);

  const handlePromoteLane = useCallback(() => {
    const nextPolicy: AutomationExecutionPolicyDraft = {
      ...selectedPolicy,
      mode: 'custom',
      optimizationGoal: 'quality_first',
      maxElasticLanes: Math.min(4, Math.max(selectedPolicy.maxElasticLanes, selectedMath.recommendedElasticLanes) + 1),
    };
    const role = selectedWorkerDetail.worker?.role;
    void patchAutomationConfig({
      executionPolicy: nextPolicy,
      studioState: {
        ...selectedStudioState,
        roleDirectives: role
          ? {
              ...(selectedStudioState.roleDirectives || {}),
              [role]: { mode: 'promote', updatedAt: new Date().toISOString() },
            }
          : selectedStudioState.roleDirectives,
      },
    }, { successMessage: 'Promoted this lane for stronger routing.' });
  }, [patchAutomationConfig, selectedMath.recommendedElasticLanes, selectedPolicy, selectedStudioState, selectedWorkerDetail.worker?.role]);

  const handleSaveExperiment = useCallback(() => {
    const nextHistory = [
      {
        id: `exp_${Date.now()}`,
        scenarioId: selectedScenarioId,
        previewPresetId,
        createdAt: new Date().toISOString(),
        notes: `${selectedScenario.label} -> ${previewPreset.label}`,
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

  const handleRestoreExperiment = useCallback((experiment: StudioExperimentRecord) => {
    if (SCENARIO_PRESETS.some((scenario) => scenario.id === experiment.scenarioId)) {
      setSelectedScenarioId(experiment.scenarioId as ScenarioPresetId);
    }
    if (POLICY_PRESETS.some((preset) => preset.id === experiment.previewPresetId)) {
      setPreviewPresetId(experiment.previewPresetId);
    }
    setNotice({ tone: 'success', message: 'Restored saved experiment.' });
  }, []);

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
                                <span className="mt-2 inline-flex rounded-full border border-cyan-500/18 bg-cyan-500/8 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                                  {selectedStudioState.roleDirectives[worker.role].mode === 'cheaper'
                                    ? 'Cheaper'
                                    : selectedStudioState.roleDirectives[worker.role].mode === 'review'
                                      ? 'Review'
                                      : 'Promoted'}
                                </span>
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
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">Active directive</p>
                                  <p className="mt-1 text-sm font-medium text-white">
                                    {selectedRoleDirective.mode === 'cheaper'
                                      ? 'Favor cheaper routing'
                                      : selectedRoleDirective.mode === 'review'
                                        ? 'Escalate review'
                                        : 'Promote stronger lane'}
                                  </p>
                                  <p className="mt-1 text-[12px] text-slate-400">Set {formatRelativeTimeFromIso(selectedRoleDirective.updatedAt)} for this workflow.</p>
                                </div>
                              ) : null}
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
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Steer this role</p>
                                <div className="mt-2 grid gap-2">
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
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeRoom === 'optimize' ? (
                  <>
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
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">What Violema is learning</p>
                            <h3 className="text-sm font-semibold text-white">Best presets for {selectedArchetype.label.toLowerCase()}</h3>
                          </div>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          {selectedArchetype.summary}
                        </p>
                        <div className="mt-4 space-y-3">
                          {learnedPresetLeaderboard.map((item, index) => (
                            <div key={item.presetId} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{index + 1}. {item.label}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{item.workflowCount} workflows using this posture</p>
                                </div>
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                                  Score {item.averageScore}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                <div>
                                  <p className="text-slate-500">Success</p>
                                  <p className="mt-1 text-white">{item.averageSuccess}%</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Spend</p>
                                  <p className="mt-1 text-white">{item.averageCredits ? `${formatCredits(item.averageCredits)} cr` : '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Position</p>
                                  <p className="mt-1 text-white">{index === 0 ? 'Best current fit' : 'Observed alternative'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {learnedPresetLeaderboard.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                              Not enough live history yet to rank presets for this workflow class.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Saved experiments</p>
                            <h3 className="text-sm font-semibold text-white">Restore strong operating setups</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {experimentHistory.length > 0 ? experimentHistory.map((experiment) => (
                            <button
                              key={experiment.id}
                              type="button"
                              onClick={() => handleRestoreExperiment(experiment)}
                              className="w-full rounded-2xl border border-navy-700/70 bg-navy-950/45 p-4 text-left transition-colors hover:border-cyan-500/18 hover:bg-navy-900/55"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{getScenarioPreset(experiment.scenarioId as ScenarioPresetId).label}</p>
                                  <p className="mt-1 text-[11px] text-slate-500">{POLICY_PRESETS.find((preset) => preset.id === experiment.previewPresetId)?.label || experiment.previewPresetId}</p>
                                </div>
                                <span className="rounded-full border border-navy-700 bg-navy-900 px-2 py-0.5 text-[10px] text-slate-300">
                                  {formatRelativeTimeFromIso(experiment.createdAt)}
                                </span>
                              </div>
                              {experiment.notes ? <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{experiment.notes}</p> : null}
                            </button>
                          )) : (
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
                            <Clock3 className="h-4 w-4 text-amber-300" />
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Run curve</p>
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
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr),minmax(0,1.08fr)]">
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
