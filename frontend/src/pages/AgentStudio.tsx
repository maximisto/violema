import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Brain,
  ChevronRight,
  Clock3,
  Cpu,
  Gauge,
  Orbit,
  RotateCcw,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { formatCredits } from '../lib/credits';
import { resolveWorkspaceContext } from '../lib/workspace';

type WorkflowBlockKind = 'search' | 'query' | 'capture' | 'analyze' | 'summarize' | 'deliver' | 'note';
type ExecutionMode = 'recommended' | 'custom';
type OptimizationGoal = 'balanced' | 'cost_saver' | 'quality_first';
type ReviewPolicy = 'lean' | 'standard' | 'strict';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<AgentStudioRow[]>([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string>('');
  const [actionBusy, setActionBusy] = useState(false);
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

  const patchExecutionPolicy = useCallback(async (next: AutomationExecutionPolicyDraft) => {
    if (!selectedRow) return;
    setActionBusy(true);
    try {
      const response = await fetch(`/api/automations/${selectedRow.automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionPolicy: next }),
      });
      if (!response.ok) throw new Error('Could not update execution policy');
      await loadData(true);
      setNotice({ tone: 'success', message: 'Updated agent policy.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not update agent policy.' });
    } finally {
      setActionBusy(false);
    }
  }, [loadData, selectedRow]);

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
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300/80">Agent system for this workflow</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{selectedRow.automation.name}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                        Separate the worker system from schedule tracking. Tune routing here, then jump back to the dashboard only when you want to inspect runs and delivery.
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
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next run</p>
                      <p className="mt-1 text-sm font-medium text-white">{formatAutomationRunTime(selectedRow.automation.next_run_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Last outcome</p>
                      <p className="mt-1 text-sm font-medium text-white">{selectedRow.latestRun?.status || selectedRow.automation.last_run_status || 'Pending'}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Average run cost</p>
                      <p className="mt-1 text-sm font-medium text-white">{selectedRow.averageCredits ? `${formatCredits(selectedRow.averageCredits)} cr` : '—'}</p>
                    </div>
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Success rate</p>
                      <p className="mt-1 text-sm font-medium text-white">{Math.round(selectedRow.successRate * 100)}%</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(22rem,0.95fr)]">
                  <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-cyan-300" />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Workflow benchmarks</p>
                        <h3 className="text-sm font-semibold text-white">How this schedule compares</h3>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      Success and spend should be legible at a glance. This keeps Agent Studio grounded in outcome quality, not just worker-theater.
                    </p>
                    <div className="mt-4 space-y-3">
                      {workflowBenchmarks.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => setSelectedAutomationId(row.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                            row.isSelected
                              ? 'border-violet-500/25 bg-violet-500/8'
                              : 'border-navy-700/70 bg-navy-950/40 hover:border-violet-500/18 hover:bg-navy-900/55'
                          }`}
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

                  <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-amber-300" />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Run curve</p>
                        <h3 className="text-sm font-semibold text-white">Recent cost and outcome trend</h3>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      The last few runs should tell you whether this workflow is getting cleaner, cheaper, or noisier.
                    </p>
                    {selectedRunTrend.length > 0 ? (
                      <>
                        <div className="mt-4 flex h-36 items-end gap-2">
                          {selectedRunTrend.map((run) => (
                            <div key={run.id} className="flex min-w-0 flex-1 flex-col items-center">
                              <div className="flex h-28 w-full items-end">
                                <div
                                  className={`w-full rounded-t-2xl border border-white/8 bg-gradient-to-t ${
                                    run.status === 'failed'
                                      ? 'from-red-500/20 to-red-400/65'
                                      : run.status === 'succeeded'
                                        ? 'from-emerald-500/18 to-cyan-400/70'
                                        : 'from-violet-500/16 to-violet-400/65'
                                  }`}
                                  style={{ height: run.height }}
                                />
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
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr),minmax(20rem,0.8fr)]">
                  <div className="space-y-6">
                    <div className="rounded-[1.8rem] border border-cyan-500/15 bg-gradient-to-br from-cyan-500/8 via-navy-900/72 to-navy-950/90 p-5">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-cyan-300" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Interactive system map</p>
                          <h3 className="text-sm font-semibold text-white">Worker architecture</h3>
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        This is the dedicated room for agent management. It shows the manager, resident specialists, and elastic lanes without burying them under scheduling controls.
                      </p>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
                        <div className="rounded-[1.6rem] border border-violet-500/16 bg-violet-500/6 p-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80">Manager</p>
                          {selectedTopology.workers
                            .filter((worker) => worker.role === 'nexus')
                            .map((worker) => (
                              <div key={worker.role} className="mt-3 rounded-2xl border border-violet-500/18 bg-navy-950/45 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{worker.label}</p>
                                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{worker.modelLabel}</p>
                                  </div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-violet-500/20 bg-violet-500/10 text-violet-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                    {worker.status}
                                  </span>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed text-slate-300">{worker.reason}</p>
                              </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-violet-300" />
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Six specialists</p>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {selectedTopology.workers
                                .filter((worker) => worker.laneType === 'core' && worker.role !== 'nexus')
                                .map((worker) => (
                                  <div key={worker.role} className={`rounded-2xl border p-3 ${worker.status === 'active' ? 'border-violet-500/18 bg-violet-500/8' : 'border-navy-700/70 bg-navy-950/42'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-medium text-white">{worker.label}</p>
                                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{worker.band} band</p>
                                      </div>
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-violet-500/20 bg-violet-500/10 text-violet-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                        {worker.status}
                                      </span>
                                    </div>
                                    <p className="mt-3 text-[12px] leading-relaxed text-slate-400">{worker.summary}</p>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <Orbit className="h-4 w-4 text-cyan-300" />
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Four elastic lanes</p>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {selectedTopology.workers
                                .filter((worker) => worker.laneType === 'elastic')
                                .map((worker) => (
                                  <div key={worker.role} className={`rounded-2xl border p-3 ${worker.status === 'active' ? 'border-cyan-500/18 bg-cyan-500/8' : 'border-navy-700/70 bg-navy-950/42'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-medium text-white">{worker.label}</p>
                                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{worker.modelLabel}</p>
                                      </div>
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${worker.status === 'active' ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200' : 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                                        {worker.status}
                                      </span>
                                    </div>
                                    <p className="mt-3 text-[12px] leading-relaxed text-slate-400">{worker.reason}</p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-amber-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Why this configuration</p>
                            <h3 className="text-sm font-semibold text-white">Routing math</h3>
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
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommended elastic lanes</p>
                            <p className="mt-1 text-lg font-semibold text-white">{selectedMath.recommendedElasticLanes}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-relaxed text-slate-400">
                          The system should keep harder reasoning on stronger models only when the workflow complexity and failure risk justify it. Everything else should stay cheap, fast, and operational.
                        </p>
                      </div>

                      <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization loop</p>
                            <h3 className="text-sm font-semibold text-white">What to change next</h3>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {optimizationRecommendations.map((recommendation) => (
                            <div key={recommendation.title} className="rounded-2xl border border-cyan-500/14 bg-cyan-500/6 p-3">
                              <p className="text-sm font-medium text-white">{recommendation.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-400">{recommendation.body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-violet-300" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role performance</p>
                          <h3 className="text-sm font-semibold text-white">Which workers are actually doing the work</h3>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {rolePerformance.length > 0 ? rolePerformance.map((role) => (
                          <div key={role.role} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-white">{role.role}</p>
                              <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                                {role.steps} steps
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <p className="text-slate-500">Failures</p>
                                <p className="mt-1 text-white">{role.failures}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Credits</p>
                                <p className="mt-1 text-white">{formatCredits(role.credits)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Tokens</p>
                                <p className="mt-1 text-white">{formatTokenCount(role.tokens)}</p>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                            No recorded worker performance yet. Run the workflow once and the loop will start to fill in.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[1.8rem] border border-violet-500/15 bg-gradient-to-b from-violet-500/8 via-navy-900/70 to-navy-950/92 p-5">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-violet-300" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80">Controls</p>
                          <h3 className="text-sm font-semibold text-white">Execution policy</h3>
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">
                        Most users should leave this on system recommendation. Custom policy exists for the workflows where cost, latency, or assurance matter enough to justify tuning.
                      </p>

                      <div className="mt-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Preset comparison</p>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                          Compare cost pressure, assurance, and fit before you apply anything. The goal is better outcomes with less unnecessary reasoning spend.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {presetComparisons.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              disabled={actionBusy}
                              onClick={() => void patchExecutionPolicy(preset.policy)}
                              className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                                preset.isActive
                                  ? 'border-violet-500/30 bg-violet-500/10'
                                  : 'border-navy-700/70 bg-navy-950/42 hover:border-violet-500/18 hover:bg-navy-900/60'
                              } disabled:opacity-60`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{preset.label}</p>
                                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{preset.summary}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  preset.isActive
                                    ? 'border-violet-500/20 bg-violet-500/10 text-violet-200'
                                    : 'border-navy-700 bg-navy-900 text-slate-400'
                                }`}>
                                  {preset.policy.mode === 'recommended' ? 'Auto' : 'Custom'}
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
                                  { label: 'Spend', value: preset.spendIndex, color: 'from-amber-300 to-violet-400' },
                                  { label: 'Assurance', value: preset.assuranceIndex, color: 'from-cyan-300 to-emerald-400' },
                                  { label: 'Fit', value: preset.fitIndex, color: 'from-violet-300 to-fuchsia-400' },
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

                      <div className="mt-5 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Advanced overrides</p>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                          Start from a preset unless you have a real reason to override the routing math manually.
                        </p>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mode</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              { value: 'recommended' as const, label: 'System recommended' },
                              { value: 'custom' as const, label: 'Custom policy' },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: option.value })}
                                className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${
                                  selectedPolicy.mode === option.value
                                    ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                                    : 'text-slate-300'
                                } disabled:opacity-60`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Optimization goal</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              { value: 'balanced' as const, label: 'Balanced' },
                              { value: 'cost_saver' as const, label: 'Cost Saver' },
                              { value: 'quality_first' as const, label: 'Quality First' },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', optimizationGoal: option.value })}
                                className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${
                                  selectedPolicy.optimizationGoal === option.value
                                    ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                                    : 'text-slate-300'
                                } disabled:opacity-60`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Review policy</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              { value: 'lean' as const, label: 'Lean' },
                              { value: 'standard' as const, label: 'Standard' },
                              { value: 'strict' as const, label: 'Strict' },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void patchExecutionPolicy({ ...selectedPolicy, mode: 'custom', reviewPolicy: option.value })}
                                className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${
                                  selectedPolicy.reviewPolicy === option.value
                                    ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                                    : 'text-slate-300'
                                } disabled:opacity-60`}
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
                                className={`ui-pill px-3 py-1.5 text-[11px] normal-case tracking-normal ${
                                  selectedPolicy.maxElasticLanes === count
                                    ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                                    : 'text-slate-300'
                                } disabled:opacity-60`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
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

                    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-amber-300" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recent runs</p>
                          <h3 className="text-sm font-semibold text-white">What actually happened</h3>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {selectedRow.runs.slice(0, 5).map((run) => (
                          <div key={run.id} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">{run.status}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{formatRelativeTimeFromIso(run.finishedAt || run.startedAt)}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(run.status)}`}>
                                {run.modelTier || 'auto'}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <p className="text-slate-500">Credits</p>
                                <p className="mt-1 text-white">{typeof run.actualCredits === 'number' ? formatCredits(run.actualCredits) : '—'}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Duration</p>
                                <p className="mt-1 text-white">{formatCompactDuration(
                                  Number.isNaN(Date.parse(run.startedAt || '')) || Number.isNaN(Date.parse(run.finishedAt || ''))
                                    ? undefined
                                    : Math.max(0, Date.parse(run.finishedAt || '') - Date.parse(run.startedAt || ''))
                                )}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Role</p>
                                <p className="mt-1 text-white">{run.agentRole || 'manager'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {selectedRow.runs.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                            No runs recorded yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1.8rem] border border-navy-800/80 bg-gradient-to-b from-navy-900/72 via-navy-900/56 to-navy-950/88 p-5">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-cyan-300" />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recent handoffs</p>
                          <h3 className="text-sm font-semibold text-white">Latest step activity</h3>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {selectedRow.stepExecutions.slice(0, 6).map((step, index) => (
                          <div key={step.stepId} className="rounded-2xl border border-navy-700/70 bg-navy-950/45 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{index + 1}. {step.title}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{step.assignedRole} · {step.kind}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusTone(step.status)}`}>
                                {step.status}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
                              {step.modelTier ? (
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.modelTier}</span>
                              ) : null}
                              {typeof step.actualCredits === 'number' ? (
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatCredits(step.actualCredits)} cr</span>
                              ) : null}
                              {step.toolCalls ? (
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{step.toolCalls} tools</span>
                              ) : null}
                              {step.tokenUsage?.totalTokens ? (
                                <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">{formatTokenCount(step.tokenUsage.totalTokens)} tokens</span>
                              ) : null}
                            </div>
                            {step.summary || step.error ? (
                              <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.error || formatSummaryPreview(step.summary, 140)}</p>
                            ) : null}
                          </div>
                        ))}
                        {selectedRow.stepExecutions.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/35 p-4 text-sm text-slate-500">
                            No step history yet. Once the workflow runs, handoffs will appear here instead of being buried in the schedule drawer.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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
