import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Settings, ChevronRight, Zap, LogOut,
  X, CheckSquare, Clock, AlertCircle, Sparkles, PanelLeftClose, PanelLeftOpen, Trash2,
  Eye, Shield, Search, CreditCard, ArrowUpRight, Pin, Archive, RotateCcw, ChevronUp, ChevronDown, Bot,
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import { fetchCreditEstimate, formatCredits, getSuggestedUpgradePlanId, useCreditSnapshot } from '../lib/credits';
import { resolveWorkspaceContext } from '../lib/workspace';
import { getAuthSession, hasSlackConnection, isAdminSession } from '../lib/auth';
import type { Conversation, Message, AutonomyMode } from '../types';

const VIOLEMA_MARK = '/po-logo.png';
const LEGACY_CONVOS_KEY = 'nexus_convos';

// ─── Persistence ──────────────────────────────────────────────────────────────

function getConversationsStorageKey(workspaceId: string) {
  return `violema_convos_${workspaceId}`;
}

function saveConvos(workspaceId: string, convos: Conversation[]) {
  try {
    localStorage.setItem(getConversationsStorageKey(workspaceId), JSON.stringify(convos));
  } catch { /* ignore quota errors */ }
}

function buildConversationSignature(convo: Conversation) {
  return convo.messages
    .map((message) => `${message.role}:${message.content.trim().replace(/\s+/g, ' ')}`)
    .join('\n');
}

function dedupeLoadedConversations(convos: Conversation[]) {
  const seenUntitled = new Map<string, number>();
  const deduped: Conversation[] = [];

  convos.forEach((convo) => {
    const hasDefaultTitle = convo.title.trim().toLowerCase() === 'new conversation';
    if (!hasDefaultTitle || convo.pinned || convo.archived) {
      deduped.push(convo);
      return;
    }

    const signature = buildConversationSignature(convo);
    const key = `${convo.title.trim().toLowerCase()}::${signature}`;
    const existingIndex = seenUntitled.get(key);

    if (existingIndex === undefined) {
      seenUntitled.set(key, deduped.length);
      deduped.push(convo);
      return;
    }

    const existing = deduped[existingIndex];
    const withinDuplicateWindow =
      Math.abs(existing.timestamp.getTime() - convo.timestamp.getTime()) <= 2 * 60 * 1000;

    if (!withinDuplicateWindow) {
      seenUntitled.set(`${key}::${convo.timestamp.getTime()}`, deduped.length);
      deduped.push(convo);
      return;
    }

    if (convo.timestamp.getTime() > existing.timestamp.getTime()) {
      deduped[existingIndex] = convo;
    }
  });

  return deduped;
}

function loadConvos(workspaceId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(getConversationsStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Conversation & {
      timestamp: string;
      messages: Array<Message & { timestamp: string }>;
    }>;
    return dedupeLoadedConversations(parsed.map((c) => ({
      ...c,
      pinned: Boolean(c.pinned),
      archived: Boolean(c.archived),
      tags: Array.isArray(c.tags) ? c.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      timestamp: new Date(c.timestamp),
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    })));
  } catch { return []; }
}

const SCHEDULE_PRESETS = [
  { label: 'Hourly', value: 'every hour' },
  { label: 'Every 4 hours', value: 'every 4 hours' },
  { label: 'Daily 9am', value: 'daily at 9am' },
  { label: 'Every monday', value: 'every monday at 9am' },
];

type WorkflowBlockKind = 'search' | 'query' | 'capture' | 'analyze' | 'summarize' | 'deliver' | 'note';
type ExecutionMode = 'recommended' | 'custom';
type OptimizationGoal = 'balanced' | 'cost_saver' | 'quality_first';
type ReviewPolicy = 'lean' | 'standard' | 'strict';
type AutomationEditorSection = 'setup' | 'workflow' | 'agents';

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

const WORKFLOW_BLOCK_OPTIONS: Array<{ kind: WorkflowBlockKind; label: string; description: string }> = [
  { kind: 'search', label: 'Search', description: 'Research current web information.' },
  { kind: 'query', label: 'Query', description: 'Pull structured live data from an integration.' },
  { kind: 'capture', label: 'Capture', description: 'Grab a page or screenshot as evidence.' },
  { kind: 'analyze', label: 'Analyze', description: 'Compare, diagnose, or interpret findings.' },
  { kind: 'summarize', label: 'Summarize', description: 'Turn evidence into a readable output.' },
  { kind: 'deliver', label: 'Deliver', description: 'Send the latest result to the configured destination.' },
  { kind: 'note', label: 'Note', description: 'Store a workflow instruction with no direct tool call.' },
];

const ACTION_TEMPLATES: Array<{ label: string; block: WorkflowBlockDraft }> = [
  {
    label: 'Stripe failed payments',
    block: { id: 'template-query-stripe', kind: 'query', title: 'Query Stripe failed payments', objective: 'Stripe failed payments' },
  },
  {
    label: 'PostHog funnel',
    block: { id: 'template-query-posthog', kind: 'query', title: 'Query PostHog funnel', objective: 'PostHog funnel' },
  },
  {
    label: 'Competitor moves',
    block: { id: 'template-search-competitor', kind: 'search', title: 'Search competitor moves', objective: 'Competitor pricing changes and product moves this month' },
  },
  {
    label: 'Browser screenshot',
    block: { id: 'template-capture', kind: 'capture', title: 'Capture a browser screenshot', objective: 'Capture the latest page state', inputs: { url: '' } },
  },
  {
    label: 'Summary',
    block: { id: 'template-summary', kind: 'summarize', title: 'Generate summary', objective: 'Generate a concise summary from the gathered evidence' },
  },
  {
    label: 'Slack alert',
    block: { id: 'template-deliver-slack', kind: 'deliver', title: 'Send alert to Slack', objective: 'Deliver the latest result to Slack', deliveryTarget: { channel: 'slack', target: '' } },
  },
  {
    label: 'Email digest',
    block: { id: 'template-deliver-email', kind: 'deliver', title: 'Send email digest', objective: 'Deliver the latest result by email', deliveryTarget: { channel: 'email', target: '' } },
  },
];

const DEFAULT_EXECUTION_POLICY: AutomationExecutionPolicyDraft = {
  mode: 'recommended',
  optimizationGoal: 'balanced',
  reviewPolicy: 'standard',
  maxElasticLanes: 2,
};

type DashboardTaskStatus = 'scheduled' | 'complete' | 'alert';

interface PlatformTaskRecord {
  id: string;
  title: string;
  description?: string;
  status: string;
  kind: string;
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

interface DashboardTaskItem {
  id: string | number;
  taskId?: string;
  taskRunId?: string;
  title: string;
  status: DashboardTaskStatus;
  time: string;
  icon: typeof Clock;
  description?: string;
  authoringMode?: 'guided' | 'describe';
  workflowPrompt?: string;
  source: 'sample' | 'live';
  modelTier?: string;
  modelSource?: string;
  agentRole?: string;
  runStatus?: string;
  automationId?: string;
  schedule?: string;
  notify?: string;
  condition?: string;
  actions?: string[];
  steps?: WorkflowBlockDraft[];
  executionPolicy?: AutomationExecutionPolicyDraft;
  automationStatus?: 'active' | 'paused';
  timezone?: string;
  lastRunAt?: string;
  lastRunStatus?: 'succeeded' | 'failed';
  nextRunAt?: string;
  latestSummary?: string;
  latestArtifacts?: DashboardTaskArtifact[];
  latestStepExecutions?: DashboardTaskStepExecution[];
  workerTopology?: DashboardWorkerTopology;
  taskUpdatedAt?: string;
  failureReason?: string;
  actualCredits?: number;
  estimatedCredits?: number;
}

interface DashboardTaskArtifact {
  kind: string;
  title: string;
  payload: Record<string, unknown>;
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
  artifactCount?: number;
  durationMs?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
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

interface DashboardEvidenceLink {
  href: string;
  label: string;
  source: string;
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

interface AutomationEditorDraft {
  mode: 'create' | 'edit';
  id: string;
  name: string;
  schedule: string;
  description: string;
  notify: string;
  condition: string;
  authoringMode: 'guided' | 'describe';
  workflowPrompt: string;
  steps: WorkflowBlockDraft[];
  executionPolicy: AutomationExecutionPolicyDraft;
  destinationType: 'slack' | 'email' | 'custom' | 'none';
}

type ThreadFilter = 'all' | 'active' | 'pinned' | 'archived';

interface CreditEstimatePreview {
  estimatedCredits: number;
  monthlyCredits: number;
}

// ─── Mode config (single source of truth) ────────────────────────────────────

const MODE_BUTTONS = [
  {
    mode: 'autonomous' as AutonomyMode,
    label: 'Auto',
    fullLabel: 'Autonomous',
    icon: Zap,
    activeClass: 'bg-green-900/50 text-green-300 border-green-800/50',
    statusColor: 'text-green-500',
    statusIcon: '⚡',
    tooltip: 'Acts immediately without confirmation',
  },
  {
    mode: 'cautious' as AutonomyMode,
    label: 'Cautious',
    fullLabel: 'Cautious',
    icon: Shield,
    activeClass: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
    statusColor: 'text-yellow-500',
    statusIcon: '🛡',
    tooltip: 'Explains intent before each major action',
  },
  {
    mode: 'supervised' as AutonomyMode,
    label: '',
    fullLabel: 'Supervised',
    icon: Eye,
    activeClass: 'bg-red-950/60 text-red-300 border-red-800/60',
    statusColor: 'text-red-400',
    statusIcon: '👁',
    tooltip: 'Full reasoning visible at every step',
  },
] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatAutomationRunTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRelativeTimeFromIso(iso: string) {
  return formatTime(new Date(iso));
}

function formatCompactDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTokenCount(value?: number) {
  if (!value || value <= 0) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k tokens`;
  return `${value} tokens`;
}

function formatStepOutputPreview(step: DashboardTaskStepExecution) {
  if (step.error) return step.error;
  if (step.output?.markdown && typeof step.output.markdown === 'string') {
    return formatSummaryPreview(step.output.markdown, 220);
  }
  if (typeof step.output?.query === 'string') {
    const resultCount = typeof step.output.resultCount === 'number' ? `${step.output.resultCount} results` : null;
    return [step.output.query, resultCount].filter(Boolean).join(' · ');
  }
  if (typeof step.output?.url === 'string') {
    return step.output.url;
  }
  if (typeof step.output?.channel === 'string') {
    return step.output.channel;
  }
  if (typeof step.summary === 'string' && step.summary.trim()) {
    return step.summary.trim();
  }
  return null;
}

function createWorkflowBlock(kind: WorkflowBlockKind, overrides?: Partial<WorkflowBlockDraft>): WorkflowBlockDraft {
  const defaults: Record<WorkflowBlockKind, WorkflowBlockDraft> = {
    search: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'search',
      title: 'Search the web',
      objective: 'Current AI agent news',
      inputs: { query: 'Current AI agent news', num_results: 6 },
    },
    query: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'query',
      title: 'Query live data',
      objective: 'Stripe failed payments',
      inputs: { source: 'stripe', query_type: 'failed_payments' },
    },
    capture: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'capture',
      title: 'Capture browser screenshot',
      objective: 'Capture the latest page state',
      inputs: { url: '' },
    },
    analyze: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'analyze',
      title: 'Analyze findings',
      objective: 'Analyze the gathered evidence and extract the important signal',
    },
    summarize: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'summarize',
      title: 'Generate summary',
      objective: 'Generate a concise summary from the gathered evidence',
    },
    deliver: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'deliver',
      title: 'Deliver latest result',
      objective: 'Deliver the latest result to the configured destination',
      deliveryTarget: null,
    },
    note: {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'note',
      title: 'Workflow note',
      objective: 'Keep this workflow instruction as context',
    },
  };

  return {
    ...defaults[kind],
    ...overrides,
    id: overrides?.id || defaults[kind].id,
    inputs: overrides?.inputs ?? defaults[kind].inputs,
    deliveryTarget: overrides?.deliveryTarget ?? defaults[kind].deliveryTarget,
  };
}

function parseLegacyActionToWorkflowBlock(action: string): WorkflowBlockDraft {
  const trimmed = action.trim();
  const normalized = trimmed.toLowerCase();
  if (/query|stripe|posthog|github|linear|notion/.test(normalized)) {
    const lower = trimmed.toLowerCase();
    const source =
      lower.includes('posthog') ? 'posthog' :
      lower.includes('github') ? 'github' :
      lower.includes('linear') ? 'linear' :
      lower.includes('notion') ? 'notion' :
      'stripe';
    const queryType =
      lower.includes('failed payments') ? 'failed_payments' :
      lower.includes('funnel') ? 'funnel_analysis' :
      lower.includes('issues') ? 'open_issues' :
      'custom';
    return createWorkflowBlock('query', {
      title: trimmed,
      objective: trimmed.replace(/^query\s+/i, '') || trimmed,
      inputs: { source, query_type: queryType },
    });
  }
  if (/screenshot|capture/.test(normalized)) {
    const urlMatch = trimmed.match(/https?:\/\/[^\s)]+/i);
    return createWorkflowBlock('capture', {
      title: trimmed,
      objective: trimmed,
      inputs: { url: urlMatch?.[0] || '' },
    });
  }
  if (/(analy[sz]e|diagnos|compare|inspect|audit|review)/.test(normalized)) {
    return createWorkflowBlock('analyze', { title: trimmed, objective: trimmed.replace(/^(analy[sz]e)\s+/i, '') || trimmed });
  }
  if (/(send|post|slack|email|deliver|notify|message)/.test(normalized)) {
    return createWorkflowBlock('deliver', {
      title: trimmed,
      objective: trimmed,
      deliveryTarget: trimmed.includes('@')
        ? { channel: 'email', target: '' }
        : { channel: 'slack', target: '' },
    });
  }
  if (/(summary|digest|report|golden nuggets|nuggets|briefing|recap|share with the team)/.test(normalized)) {
    return createWorkflowBlock('summarize', { title: trimmed, objective: trimmed });
  }
  if (/(search|scan internet|scan the internet|scan web|research|news|competitor)/.test(normalized)) {
    const objective = trimmed.replace(/^(search|research)\s+/i, '') || trimmed;
    return createWorkflowBlock('search', { title: trimmed, objective, inputs: { query: objective, num_results: 6 } });
  }
  return createWorkflowBlock('note', { title: trimmed, objective: trimmed });
}

function serializeWorkflowBlockToAction(block: WorkflowBlockDraft): string {
  const objective = block.objective.trim() || block.title.trim();
  switch (block.kind) {
    case 'search':
      return /^search|^research/i.test(objective) ? objective : `Search the web for ${objective}`;
    case 'query':
      return /^query/i.test(objective) ? objective : `Query ${objective}`;
    case 'capture': {
      const url = typeof block.inputs?.url === 'string' ? block.inputs.url.trim() : '';
      return url ? `Capture a browser screenshot of ${url}` : (objective || 'Capture a browser screenshot');
    }
    case 'analyze':
      return /^analy[sz]e/i.test(objective) ? objective : `Analyze ${objective}`;
    case 'summarize':
      return /(summary|digest|report|golden nuggets|briefing|recap)/i.test(objective) ? objective : `Generate summary for ${objective}`;
    case 'deliver':
      return block.deliveryTarget?.target
        ? `Deliver latest result to ${block.deliveryTarget.target}`
        : objective || 'Deliver latest result';
    case 'note':
    default:
      return objective;
  }
}

function serializeWorkflowBlocks(blocks: WorkflowBlockDraft[]) {
  return blocks
    .map((block) => serializeWorkflowBlockToAction(block).trim())
    .filter(Boolean);
}

function buildWorkflowPromptFromBlocks(blocks: WorkflowBlockDraft[]) {
  return serializeWorkflowBlocks(blocks).join('\n');
}

function buildWorkflowBlocksFromPrompt(prompt: string) {
  const normalized = prompt
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const sentenceParts = line.includes('\n')
        ? [line]
        : line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g);
      return sentenceParts.map((part) => part.trim()).filter(Boolean);
    });

  const uniqueParts = normalized.filter((part, index) => normalized.indexOf(part) === index);
  const blocks = uniqueParts.map((part) => parseLegacyActionToWorkflowBlock(part));
  return blocks.length > 0 ? blocks : [createWorkflowBlock('note', { objective: prompt.trim(), title: 'Workflow brief' })];
}

function workflowBlockHasContent(block: WorkflowBlockDraft) {
  if (block.kind === 'deliver') return true;
  if (block.kind === 'capture') {
    const url = typeof block.inputs?.url === 'string' ? block.inputs.url.trim() : '';
    return Boolean(block.title.trim() || block.objective.trim() || url);
  }
  return Boolean(block.title.trim() || block.objective.trim());
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

function getOptimizationGoalLabel(value: OptimizationGoal) {
  if (value === 'cost_saver') return 'Cost Saver';
  if (value === 'quality_first') return 'Quality First';
  return 'Balanced';
}

function getExecutionModeLabel(value: ExecutionMode) {
  return value === 'custom' ? 'Custom policy' : 'System recommended';
}

function getReviewPolicyLabel(value: ReviewPolicy) {
  if (value === 'lean') return 'Lean review';
  if (value === 'strict') return 'Strict review';
  return 'Standard review';
}

function getConversationSectionLabel(date: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

function mapPlatformStatus(status: string): DashboardTaskStatus {
  if (status === 'failed' || status === 'blocked' || status === 'canceled') return 'alert';
  if (status === 'completed' || status === 'succeeded') return 'complete';
  return 'scheduled';
}

function mapTaskIcon(status: DashboardTaskStatus) {
  if (status === 'alert') return AlertCircle;
  if (status === 'complete') return CheckSquare;
  return Clock;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readArtifacts(value: unknown): DashboardTaskArtifact[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const title = readString(item.title);
      const kind = readString(item.kind);
      const payload = isRecord(item.payload) ? item.payload : {};
      if (!title || !kind) return null;
      return { title, kind, payload };
    })
    .filter((item): item is DashboardTaskArtifact => Boolean(item));
}

function getTaskMetadataSummary(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return readString(run?.metadata?.summary) || readString(task?.metadata?.latestSummary);
}

function getTaskMetadataArtifacts(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  const runArtifacts = readArtifacts(run?.metadata?.artifacts);
  if (runArtifacts.length > 0) return runArtifacts;
  return readArtifacts(task?.metadata?.latestArtifacts);
}

function getTaskModelSource(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return (
    readString(run?.metadata?.modelSourceLabel) ||
    readString(run?.metadata?.modelSource) ||
    readString(task?.metadata?.modelSourceLabel) ||
    readString(task?.metadata?.modelSource)
  );
}

function readStepExecutions(value: unknown): DashboardTaskStepExecution[] {
  if (!Array.isArray(value)) return [];

  const items: Array<DashboardTaskStepExecution | null> = value.map((item) => {
    if (!isRecord(item)) return null;
    const stepId = readString(item.stepId);
    const kind = readString(item.kind);
    const title = readString(item.title);
    const assignedRole = readString(item.assignedRole);
    const status = readString(item.status);
    if (!stepId || !kind || !title || !assignedRole || !status) return null;
    const stepExecution: DashboardTaskStepExecution = {
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
      artifactCount: typeof item.artifactCount === 'number' ? item.artifactCount : undefined,
      durationMs: typeof item.durationMs === 'number' ? item.durationMs : undefined,
      tokenUsage: isRecord(item.tokenUsage)
        ? {
            inputTokens: typeof item.tokenUsage.inputTokens === 'number' ? item.tokenUsage.inputTokens : undefined,
            outputTokens: typeof item.tokenUsage.outputTokens === 'number' ? item.tokenUsage.outputTokens : undefined,
            totalTokens: typeof item.tokenUsage.totalTokens === 'number' ? item.tokenUsage.totalTokens : undefined,
          }
        : undefined,
      charge: isRecord(item.charge)
        ? {
            actualCredits: typeof item.charge.actualCredits === 'number' ? item.charge.actualCredits : 0,
            tokenCredits: typeof item.charge.tokenCredits === 'number' ? item.charge.tokenCredits : 0,
            toolCredits: typeof item.charge.toolCredits === 'number' ? item.charge.toolCredits : 0,
            artifactCredits: typeof item.charge.artifactCredits === 'number' ? item.charge.artifactCredits : 0,
            durationCredits: typeof item.charge.durationCredits === 'number' ? item.charge.durationCredits : 0,
            complexityCredits: typeof item.charge.complexityCredits === 'number' ? item.charge.complexityCredits : 0,
            baseCredits: typeof item.charge.baseCredits === 'number' ? item.charge.baseCredits : 0,
            rationale: Array.isArray(item.charge.rationale)
              ? item.charge.rationale.filter((entry): entry is string => typeof entry === 'string')
              : [],
          }
        : undefined,
      output: isRecord(item.output) ? item.output : undefined,
      artifactKind: readString(item.artifactKind),
    };
    return stepExecution;
  });

  return items.filter(Boolean) as DashboardTaskStepExecution[];
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

function readPlannedSteps(value: unknown): DashboardTaskStepExecution[] {
  if (!Array.isArray(value)) return [];

  const items: Array<DashboardTaskStepExecution | null> = value.map((item) => {
    if (!isRecord(item)) return null;
    const stepId = readString(item.id);
    const kind = readString(item.kind);
    const title = readString(item.title);
    const assignedRole = readString(item.assignedRole);
    if (!stepId || !kind || !title || !assignedRole) return null;
    return {
      stepId,
      kind,
      title,
      assignedRole,
      status: 'planned',
      summary: readString(item.objective),
    };
  });

  return items.filter(Boolean) as DashboardTaskStepExecution[];
}

function getTaskStepExecutions(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  const runSteps = readStepExecutions(run?.metadata?.stepExecutions);
  if (runSteps.length > 0) return runSteps;
  const taskSteps = readStepExecutions(task?.metadata?.latestStepExecutions);
  if (taskSteps.length > 0) return taskSteps;
  const plannedRunSteps = readPlannedSteps(run?.metadata?.plannedSteps);
  if (plannedRunSteps.length > 0) return plannedRunSteps;
  return readPlannedSteps(task?.metadata?.plannedSteps);
}

function getTaskWorkerTopology(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return (
    readWorkerTopology(run?.metadata?.topology) ||
    readWorkerTopology(run?.metadata?.workerTopology) ||
    readWorkerTopology(task?.metadata?.workerTopology) ||
    readWorkerTopology(isRecord(task?.metadata?.automationPlan) ? task?.metadata?.automationPlan.topology : undefined)
  );
}

function getTaskFailureReason(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return (
    readString(run?.error) ||
    readString(run?.metadata?.deliveryError) ||
    readString(task?.metadata?.deliveryError) ||
    readString(task?.metadata?.error)
  );
}

function getTaskAutomationId(task?: PlatformTaskRecord, run?: PlatformTaskRunRecord) {
  return readString(run?.metadata?.automationId) || readString(task?.metadata?.automationId);
}

function applyTaskRunSnapshot(item: DashboardTaskItem, task?: PlatformTaskRecord, run?: PlatformTaskRunRecord): DashboardTaskItem {
  const status = item.automationStatus === 'paused'
    ? 'alert'
    : mapPlatformStatus(run?.status || item.runStatus || item.lastRunStatus || task?.status || 'queued');

  return {
    ...item,
    taskId: task?.id || item.taskId,
    taskRunId: run?.id || item.taskRunId,
    status,
    modelTier: run?.modelTier || item.modelTier,
    modelSource: getTaskModelSource(task, run) || item.modelSource,
    agentRole: run?.agentRole || item.agentRole,
    runStatus: run?.status || item.runStatus,
    lastRunAt: run?.finishedAt || run?.startedAt || item.lastRunAt,
    lastRunStatus:
      run?.status === 'succeeded' || run?.status === 'failed'
        ? run.status
        : item.lastRunStatus,
    latestSummary: getTaskMetadataSummary(task, run) || item.latestSummary,
    latestArtifacts: getTaskMetadataArtifacts(task, run) || item.latestArtifacts,
    latestStepExecutions: getTaskStepExecutions(task, run),
    workerTopology: getTaskWorkerTopology(task, run) || item.workerTopology,
    failureReason: getTaskFailureReason(task, run) || undefined,
    taskUpdatedAt: task?.updatedAt || item.taskUpdatedAt,
    actualCredits: typeof run?.actualCredits === 'number' ? run.actualCredits : item.actualCredits,
    estimatedCredits: typeof run?.estimatedCredits === 'number' ? run.estimatedCredits : item.estimatedCredits,
  };
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

function formatSummaryPreview(value?: string, maxLength = 260) {
  const normalized = stripMarkdownPreview(value);
  if (!normalized) return '';
  return truncateText(normalized, maxLength);
}

function getHostnameLabel(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

function collectEvidenceLinks(
  value: unknown,
  links: DashboardEvidenceLink[],
  seen: Set<string>,
  source: string,
  depth = 0,
) {
  if (depth > 4 || value == null) return;

  if (Array.isArray(value)) {
    value.forEach((entry) => collectEvidenceLinks(entry, links, seen, source, depth + 1));
    return;
  }

  if (!isRecord(value)) return;

  const href =
    readString(value.url) ||
    readString(value.href) ||
    readString(value.link) ||
    readString(value.sourceUrl) ||
    readString(value.source_url);

  if (href && /^https?:\/\//i.test(href) && !seen.has(href)) {
    const label =
      readString(value.title) ||
      readString(value.name) ||
      readString(value.label) ||
      getHostnameLabel(href);
    links.push({ href, label, source });
    seen.add(href);
  }

  Object.values(value).forEach((entry) => collectEvidenceLinks(entry, links, seen, source, depth + 1));
}

function extractEvidenceLinks(artifacts?: DashboardTaskArtifact[]) {
  if (!artifacts?.length) return [];
  const links: DashboardEvidenceLink[] = [];
  const seen = new Set<string>();

  artifacts.forEach((artifact) => {
    collectEvidenceLinks(artifact.payload, links, seen, artifact.title);
  });

  return links.slice(0, 4);
}

function getTaskRunOutcome(task?: DashboardTaskItem) {
  if (!task) {
    return {
      label: 'No runs yet',
      tone: 'border-navy-700/70 bg-navy-950/50 text-slate-300',
      detail: 'This automation has not produced a result yet.',
    };
  }

  if (task.automationStatus === 'paused') {
    return {
      label: 'Paused',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      detail: 'Runs are paused until you resume this automation.',
    };
  }

  if (task.runStatus === 'running' || task.runStatus === 'retrying') {
    return {
      label: task.runStatus === 'retrying' ? 'Retrying' : 'Running',
      tone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
      detail: 'A fresh run is currently in progress.',
    };
  }

  if (task.runStatus === 'failed' || task.lastRunStatus === 'failed' || task.status === 'alert') {
    return {
      label: 'Last run failed',
      tone: 'border-red-500/20 bg-red-500/10 text-red-300',
      detail: 'The most recent run did not complete cleanly.',
    };
  }

  if (task.runStatus === 'succeeded' || task.lastRunStatus === 'succeeded' || task.status === 'complete') {
    return {
      label: 'Last run succeeded',
      tone: 'border-green-500/20 bg-green-500/10 text-green-300',
      detail: 'The latest run completed and produced usable output.',
    };
  }

  return {
    label: 'Waiting for first result',
    tone: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    detail: 'This automation is scheduled but has not finished a run yet.',
  };
}

function summarizeWorkerLanes(task?: DashboardTaskItem) {
  if (!task) {
    return { manager: null as DashboardWorkerCard | null, core: [] as DashboardWorkerCard[], elastic: [] as DashboardWorkerCard[], totalActiveLanes: 0, summary: '' };
  }

  if (task.workerTopology?.workers?.length) {
    const workers = task.workerTopology.workers;
    const manager = workers.find((worker) => worker.role === 'nexus') || null;
    const activeWorkers = workers.filter((worker) => worker.status === 'active').length;
    return {
      manager,
      core: workers.filter((worker) => worker.laneType === 'core' && worker.role !== 'nexus'),
      elastic: workers.filter((worker) => worker.laneType === 'elastic'),
      totalActiveLanes: activeWorkers,
      summary: task.workerTopology.summary || '',
    };
  }

  return { manager: null as DashboardWorkerCard | null, core: [] as DashboardWorkerCard[], elastic: [] as DashboardWorkerCard[], totalActiveLanes: 0, summary: '' };
}
function inferConversationTags(conversation: Conversation) {
  if (conversation.tags?.length) return conversation.tags.slice(0, 2);

  const text = `${conversation.title} ${conversation.lastMessage || ''}`.toLowerCase();
  const inferred: string[] = [];

  if (/(stripe|mrr|revenue|billing|finance|payments)/.test(text)) inferred.push('Revenue');
  if (/(github|pr|bug|code|debug|build|deploy)/.test(text)) inferred.push('Build');
  if (/(automation|workflow|slack|email|schedule)/.test(text)) inferred.push('Ops');
  if (/(research|search|competitor|analysis|summary|report)/.test(text)) inferred.push('Research');

  return inferred.slice(0, 2);
}

function estimateMonthlyRunsFromSchedule(schedule: string) {
  const normalized = schedule.trim().toLowerCase();
  if (!normalized) return 0;
  if (normalized === 'hourly' || normalized === 'every hour') return 24 * 30;

  const everyHours = normalized.match(/^every\s+(\d+)\s+hours?$/);
  if (everyHours) {
    const interval = Number(everyHours[1]) || 1;
    return Math.ceil((24 / interval) * 30);
  }

  if (normalized.startsWith('daily') || normalized.startsWith('every day')) return 30;
  if (normalized.startsWith('every monday')) return 4;
  return 12;
}

const getTaskStatusMeta = (status: 'scheduled' | 'complete' | 'alert') => {
  if (status === 'alert') {
    return {
      label: 'Needs attention',
      accent: 'from-red-950/28 via-navy-900/85 to-navy-950/92',
      iconColor: 'text-red-400',
      chip: 'border-red-900/70 bg-red-950/45 text-red-300',
      dot: 'bg-red-400',
    };
  }

  if (status === 'complete') {
    return {
      label: 'Completed',
      accent: 'from-green-950/24 via-navy-900/84 to-navy-950/92',
      iconColor: 'text-green-400',
      chip: 'border-green-900/70 bg-green-950/35 text-green-300',
      dot: 'bg-green-400',
    };
  }

  return {
    label: 'On schedule',
    accent: 'from-violet-950/24 via-navy-900/84 to-navy-950/92',
    iconColor: 'text-violet-400',
    chip: 'border-violet-900/70 bg-violet-950/35 text-violet-300',
    dot: 'bg-violet-400',
  };
};

const fetchSmartTitle = async (messages: { role: string; content: string }[]): Promise<string> => {
  try {
    const workspace = resolveWorkspaceContext();
    const res = await fetch('/api/title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace.workspaceId,
        'X-Workspace-Name': workspace.workspaceName,
      },
      body: JSON.stringify({
        messages,
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName,
      }),
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json() as { title: string };
    return data.title || 'New conversation';
  } catch {
    return messages[0]?.content?.slice(0, 45) || 'New conversation';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const workspace = useMemo(() => resolveWorkspaceContext(), []);
  const [isMobileSidebar, setIsMobileSidebar] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadConvos(resolveWorkspaceContext().workspaceId);
    return saved;
  });
  const [activeConvoId, setActiveConvoId] = useState<string>('new');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [taskPanelOpen, setTaskPanelOpen] = useState(false); // hidden by default on mobile feel
  const [selectedTaskId, setSelectedTaskId] = useState<string | number>('');
  const [newConvoMessages, setNewConvoMessages] = useState<Message[]>([]);
  const [hoveredConvoId, setHoveredConvoId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('cautious');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
  const [platformTasks, setPlatformTasks] = useState<DashboardTaskItem[]>([]);
  const [liveAutomations, setLiveAutomations] = useState<DashboardTaskItem[]>([]);
  const [taskPanelLoaded, setTaskPanelLoaded] = useState(false);
  const [taskPanelRefreshing, setTaskPanelRefreshing] = useState(false);
  const [uiNotice, setUiNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [actionBusy, setActionBusy] = useState<'run' | 'pause' | 'edit' | 'save' | 'delete' | 'grant' | null>(null);
  const [automationEditor, setAutomationEditor] = useState<AutomationEditorDraft | null>(null);
  const [automationEditorSection, setAutomationEditorSection] = useState<AutomationEditorSection>('setup');
  const [automationEstimate, setAutomationEstimate] = useState<CreditEstimatePreview | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { snapshot, refresh: refreshCredits } = useCreditSnapshot();
  const authSession = getAuthSession();
  const canLoadTestCredits = isAdminSession(authSession);

  const activeMode = MODE_BUTTONS.find((m) => m.mode === autonomyMode)!;

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const { history } = window;
    const previousScrollRestoration = 'scrollRestoration' in history ? history.scrollRestoration : null;

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    return () => {
      if (previousScrollRestoration) {
        history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  // Persist conversations
  useEffect(() => { saveConvos(workspace.workspaceId, conversations); }, [conversations, workspace.workspaceId]);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_CONVOS_KEY);
    } catch {
      // ignore localStorage failures
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileSidebar(mobile);
      if (!mobile) setSidebarOpen(true);
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConvoId('new');
    setNewConvoMessages([]);
    setSearchQuery('');
    if (isMobileSidebar) setSidebarOpen(false);
  }, []);

  const handleDeleteConvo = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmId(null);
      if (activeConvoId === id) {
        setActiveConvoId('new');
        setNewConvoMessages([]);
      }
    },
    [activeConvoId, isMobileSidebar]
  );

  const loadTaskPanelData = useCallback(async (signal?: AbortSignal) => {
    const workspace = resolveWorkspaceContext();
    const headers = {
      'X-Workspace-Id': workspace.workspaceId,
      'X-Workspace-Name': workspace.workspaceName,
    };
    const [automationPayload, taskPayload, runPayload] = await Promise.all([
      fetch('/api/automations', { headers, signal }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('automations')))),
      fetch(`/api/platform/tasks?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, {
        headers,
        signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('tasks')))),
      fetch(`/api/platform/task-runs?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, {
        headers,
        signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('runs')))),
    ]);

    const automations = Array.isArray(automationPayload?.items) ? automationPayload.items as AutomationApiRecord[] : [];
    const tasks = Array.isArray(taskPayload?.items) ? taskPayload.items as PlatformTaskRecord[] : [];
    const runs = Array.isArray(runPayload?.items) ? runPayload.items as PlatformTaskRunRecord[] : [];
    const latestRunByTask = new Map<string, PlatformTaskRunRecord>();

    runs.forEach((run) => {
      const existing = latestRunByTask.get(run.taskId);
      const runTime = Date.parse(run.finishedAt || run.startedAt || '');
      const existingTime = existing ? Date.parse(existing.finishedAt || existing.startedAt || '') : 0;
      if (!existing || runTime > existingTime) latestRunByTask.set(run.taskId, run);
    });

    const taskContextByAutomationId = new Map<string, { task: PlatformTaskRecord; latestRun?: PlatformTaskRunRecord }>();

    tasks.forEach((task) => {
      const latestRun = latestRunByTask.get(task.id);
      const context = { task, latestRun };
      const automationId = getTaskAutomationId(task, latestRun);
      if (automationId) taskContextByAutomationId.set(automationId, context);
    });

    const liveTasks = tasks
      .slice(0, 12)
      .map((task) => {
        const latestRun = latestRunByTask.get(task.id);
        const status = mapPlatformStatus(latestRun?.status || task.status);
        return {
          id: task.id,
          taskId: task.id,
          taskRunId: latestRun?.id,
          title: task.title,
          status,
          time: formatRelativeTimeFromIso(latestRun?.finishedAt || latestRun?.startedAt || task.updatedAt),
          icon: mapTaskIcon(status),
          description: task.description,
          source: 'live' as const,
          modelTier: latestRun?.modelTier,
          modelSource: getTaskModelSource(task, latestRun),
          agentRole: latestRun?.agentRole,
          runStatus: latestRun?.status,
          lastRunAt: latestRun?.finishedAt || latestRun?.startedAt,
          latestSummary: getTaskMetadataSummary(task, latestRun),
          latestArtifacts: getTaskMetadataArtifacts(task, latestRun),
          latestStepExecutions: getTaskStepExecutions(task, latestRun),
          workerTopology: getTaskWorkerTopology(task, latestRun),
          executionPolicy: normalizeExecutionPolicy(task?.metadata?.executionPolicy),
          failureReason: getTaskFailureReason(task, latestRun),
          taskUpdatedAt: task.updatedAt,
          actualCredits: latestRun?.actualCredits,
          estimatedCredits: latestRun?.estimatedCredits,
        };
      });

    const automationItems = automations
      .slice(0, 12)
      .map((automation) => {
        const taskContext = taskContextByAutomationId.get(automation.id);
        const latestRun = taskContext?.latestRun;
        const task = taskContext?.task;
        const status = automation.status === 'paused'
          ? 'alert' as DashboardTaskStatus
          : mapPlatformStatus(latestRun?.status || automation.last_run_status || task?.status || 'queued');

        return {
          id: automation.id,
          taskId: task?.id,
          taskRunId: latestRun?.id,
          title: automation.name,
          status,
          time: automation.next_run_at ? `Next ${formatAutomationRunTime(automation.next_run_at)}` : automation.schedule,
          icon: status === 'alert' ? AlertCircle : mapTaskIcon(status),
          description: automation.description || task?.description,
          authoringMode: automation.authoring_mode,
          workflowPrompt: automation.workflow_prompt,
          source: 'live' as const,
          modelTier: latestRun?.modelTier,
          modelSource: getTaskModelSource(task, latestRun),
          agentRole: latestRun?.agentRole,
          runStatus: latestRun?.status,
          automationId: automation.id,
          schedule: automation.schedule,
          notify: automation.notify,
          condition: automation.condition,
          actions: automation.actions,
          steps: automation.steps,
          executionPolicy: normalizeExecutionPolicy(
            automation.execution_policy || task?.metadata?.executionPolicy
          ),
          automationStatus: automation.status,
          timezone: automation.timezone,
          lastRunAt: latestRun?.finishedAt || latestRun?.startedAt || automation.last_run_at,
          lastRunStatus: latestRun?.status === 'succeeded' || latestRun?.status === 'failed'
            ? latestRun.status
            : automation.last_run_status,
          nextRunAt: automation.next_run_at,
          latestSummary: getTaskMetadataSummary(task, latestRun),
          latestArtifacts: getTaskMetadataArtifacts(task, latestRun),
          latestStepExecutions: getTaskStepExecutions(task, latestRun),
          workerTopology: getTaskWorkerTopology(task, latestRun),
          failureReason: getTaskFailureReason(task, latestRun),
          taskUpdatedAt: task?.updatedAt,
          actualCredits: latestRun?.actualCredits,
          estimatedCredits: latestRun?.estimatedCredits,
        };
      });

    if (automationItems.length > 0) {
      setLiveAutomations(automationItems);
      setSelectedTaskId((current) => current || automationItems[0].id);
    } else {
      setLiveAutomations([]);
    }

    if (liveTasks.length > 0) {
      setPlatformTasks(liveTasks);
    } else {
      setPlatformTasks([]);
    }
    setTaskPanelLoaded(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadTaskPanelData(controller.signal)
      .catch(() => {
        setLiveAutomations([]);
        setPlatformTasks([]);
        setTaskPanelLoaded(true);
      });

    return () => controller.abort();
  }, [loadTaskPanelData]);

  // Close delete confirm on outside activity
  useEffect(() => {
    if (deleteConfirmId) {
      const t = setTimeout(() => setDeleteConfirmId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [deleteConfirmId]);

  useEffect(() => {
    if (!uiNotice) return undefined;
    const timeout = window.setTimeout(() => setUiNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [uiNotice]);

  const showNotice = useCallback((tone: 'success' | 'error', message: string) => {
    setUiNotice({ tone, message });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get('checkout');
    if (!checkoutState) return;

    if (checkoutState === 'success') {
      showNotice('success', 'Stripe checkout completed. Refreshing credits…');
      void refreshCredits();
      return;
    }

    if (checkoutState === 'cancel') {
      showNotice('error', 'Stripe checkout was canceled.');
    }
  }, [location.search, refreshCredits, showNotice]);

  useEffect(() => {
    if (!automationEditor) {
      setAutomationEstimate(null);
      return undefined;
    }

    const timeout = window.setTimeout(async () => {
      const estimateSteps = automationEditor.authoringMode === 'describe'
        ? buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt)
        : automationEditor.steps;
      const actionCount = estimateSteps.filter((item) => workflowBlockHasContent(item)).length;
      const toolCallCount = estimateSteps.filter((item) => ['search', 'query', 'capture', 'deliver'].includes(item.kind)).length;
      const estimate = await fetchCreditEstimate({
        taskKind: 'automation',
        modelTier: actionCount > 3 ? 'ops' : 'default',
        toolCalls: Math.max(1, toolCallCount),
        automationRuns: 1,
        complexity: actionCount > 4 ? 'high' : actionCount > 2 ? 'medium' : 'low',
      });
      if (!estimate) {
        setAutomationEstimate(null);
        return;
      }

      setAutomationEstimate({
        estimatedCredits: estimate.estimatedCredits,
        monthlyCredits: estimate.estimatedCredits * estimateMonthlyRunsFromSchedule(automationEditor.schedule),
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [automationEditor]);

  const refreshTaskPanel = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setTaskPanelRefreshing(true);
    try {
      await loadTaskPanelData();
    } finally {
      if (!silent) setTaskPanelRefreshing(false);
    }
  }, [loadTaskPanelData]);

  const refreshAutomations = useCallback(async () => {
    await refreshTaskPanel();
  }, [refreshTaskPanel]);

  const handleTaskPanelStreamMessage = useCallback((raw: string) => {
    try {
      const payload = JSON.parse(raw) as unknown;
      if (!isRecord(payload)) return;

      if (readString(payload.type) === 'task_run_snapshot') {
        const task = isRecord(payload.task) ? payload.task as unknown as PlatformTaskRecord : undefined;
        const run = isRecord(payload.run) ? payload.run as unknown as PlatformTaskRunRecord : undefined;
        const automationId = readString(payload.automationId);
        const taskId = readString(payload.taskId);
        const taskRunId = readString(payload.taskRunId);

        if (!run) return;

        setLiveAutomations((current) => current.map((item) => {
          const matches =
            (automationId && item.automationId === automationId) ||
            (taskId && item.taskId === taskId) ||
            (taskRunId && item.taskRunId === taskRunId);
          return matches ? applyTaskRunSnapshot(item, task, run) : item;
        }));

        setPlatformTasks((current) => current.map((item) => {
          const matches =
            (taskId && item.taskId === taskId) ||
            (taskRunId && item.taskRunId === taskRunId);
          return matches ? applyTaskRunSnapshot(item, task, run) : item;
        }));
        return;
      }

      const type = readString(payload.type);
      if (
        type === 'automation_created' ||
        type === 'automation_updated' ||
        type === 'automation_deleted' ||
        type === 'automation_triggered' ||
        type === 'automation_run_started' ||
        type === 'automation_run_finished'
      ) {
        void refreshTaskPanel({ silent: true }).catch(() => {});
      }
    } catch {
      // ignore malformed stream payloads
    }
  }, [refreshTaskPanel]);

  useEffect(() => {
    if (!taskPanelOpen) return undefined;

    const streamUrl = `/api/platform/stream?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      handleTaskPanelStreamMessage(event.data);
    };

    source.onerror = () => {
      // EventSource retries by default. Keep the poller as the recovery path.
    };

    return () => {
      source.close();
    };
  }, [handleTaskPanelStreamMessage, taskPanelOpen, workspace.workspaceId, workspace.workspaceName]);

  const hasRunningAutomation = useMemo(
    () => liveAutomations.some((task) => task.runStatus === 'running'),
    [liveAutomations]
  );

  useEffect(() => {
    if (!taskPanelOpen) return undefined;

    const refreshSilently = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshTaskPanel({ silent: true }).catch(() => {});
    };

    const intervalId = window.setInterval(refreshSilently, hasRunningAutomation ? 3000 : 15000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasRunningAutomation, taskPanelOpen, refreshTaskPanel]);

  const handleAutomationRun = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    setActionBusy('run');
    try {
      const response = await fetch(`/api/automations/${task.automationId}/run`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not run automation');
      await refreshAutomations();
      showNotice('success', `Started "${task.title}"`);
    } catch {
      showNotice('error', `Could not run "${task.title}"`);
    } finally {
      setActionBusy(null);
    }
  }, [refreshAutomations, showNotice]);

  const handleAutomationPauseToggle = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    setActionBusy('pause');
    try {
      const nextStatus = task.automationStatus === 'paused' ? 'active' : 'paused';
      const response = await fetch(`/api/automations/${task.automationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error('Could not update automation');
      await refreshAutomations();
      showNotice('success', `${nextStatus === 'paused' ? 'Paused' : 'Resumed'} "${task.title}"`);
    } catch {
      showNotice('error', `Could not update "${task.title}"`);
    } finally {
      setActionBusy(null);
    }
  }, [refreshAutomations, showNotice]);

  const handleAutomationDelete = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    setActionBusy('delete');
    try {
      const response = await fetch(`/api/automations/${task.automationId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete automation');
      setLiveAutomations((current) => {
        const next = current.filter((item) => item.automationId !== task.automationId);
        setSelectedTaskId((selected) => {
          if (selected !== task.id) return selected;
          return next[0]?.id ?? '';
        });
        return next;
      });
      await refreshAutomations();
      showNotice('success', `Deleted "${task.title}"`);
    } catch {
      showNotice('error', `Could not delete "${task?.title || 'automation'}"`);
    } finally {
      setActionBusy(null);
    }
  }, [refreshAutomations, showNotice]);

  const confirmAutomationDelete = useCallback((task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (!confirmed) return;
    void handleAutomationDelete(task);
  }, [handleAutomationDelete]);

  const handleAutomationEdit = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    const nextSteps = Array.isArray(task.steps) && task.steps.length > 0
      ? task.steps.map((step) => createWorkflowBlock(step.kind, step))
      : Array.isArray(task.actions) && task.actions.length > 0
        ? task.actions.map((action) => parseLegacyActionToWorkflowBlock(action))
        : [createWorkflowBlock('summarize')];
    setAutomationEditorSection('setup');
    setAutomationEditor({
      mode: 'edit',
      id: task.automationId,
      name: task.title,
      schedule: task.schedule || task.time,
      description: task.description || '',
      notify: task.notify || '',
      condition: task.condition || '',
      authoringMode: task.authoringMode === 'describe' ? 'describe' : 'guided',
      workflowPrompt: task.workflowPrompt || buildWorkflowPromptFromBlocks(nextSteps),
      steps: nextSteps,
      executionPolicy: normalizeExecutionPolicy(task.executionPolicy),
      destinationType:
        task.notify?.startsWith('C') || task.notify?.startsWith('G') || task.notify?.startsWith('D') || task.notify?.startsWith('#')
          ? 'slack'
          : task.notify?.includes('@')
            ? 'email'
            : task.notify
              ? 'custom'
              : 'none',
    });
  }, []);

  const handleAutomationCreate = useCallback(() => {
    setAutomationEditorSection('setup');
    setAutomationEditor({
      mode: 'create',
      id: `draft-${Date.now()}`,
      name: '',
      schedule: 'every monday at 9am',
      description: '',
      notify: '',
      condition: '',
      authoringMode: 'guided',
      workflowPrompt: 'Query Stripe failed payments\nGenerate summary',
      steps: [
        createWorkflowBlock('query', { title: 'Query Stripe failed payments', objective: 'Stripe failed payments' }),
        createWorkflowBlock('summarize'),
      ],
      executionPolicy: { ...DEFAULT_EXECUTION_POLICY },
      destinationType: 'slack',
    });
  }, []);

  const closeAutomationEditor = useCallback(() => {
    setAutomationEditor(null);
    setAutomationEditorSection('setup');
    setDraggedStepIndex(null);
    setActionBusy((current) => (current === 'save' || current === 'edit' ? null : current));

    const params = new URLSearchParams(location.search);
    const hadEditState = params.has('edit') || params.has('panel') || params.has('automation');
    if (!hadEditState) return;

    params.delete('edit');
    params.delete('create');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate]);

  const handleAutomationEditorSave = useCallback(async () => {
    if (!automationEditor) return;
    setActionBusy('save');
    try {
      const sourceSteps = automationEditor.authoringMode === 'describe'
        ? buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt)
        : automationEditor.steps;
      const steps = sourceSteps
        .map((step) => ({
          ...step,
          title: step.title.trim(),
          objective: step.objective.trim(),
          deliveryTarget: step.kind === 'deliver' && automationEditor.notify.trim()
            ? {
                channel: automationEditor.destinationType === 'email' ? 'email' as const : 'slack' as const,
                target: automationEditor.notify.trim(),
              }
            : (step.deliveryTarget || null),
        }))
        .filter((step) => workflowBlockHasContent(step));
      const actions = serializeWorkflowBlocks(steps);
      const response = await fetch(
        automationEditor.mode === 'create' ? '/api/automations' : `/api/automations/${automationEditor.id}`,
        {
        method: automationEditor.mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: automationEditor.name.trim(),
          schedule: automationEditor.schedule.trim(),
          timezone: getLocalTimeZone(),
          description: automationEditor.description.trim() || null,
          authoringMode: automationEditor.authoringMode,
          workflowPrompt: automationEditor.workflowPrompt.trim() || null,
          notify: automationEditor.notify.trim() || null,
          condition: automationEditor.condition.trim() || null,
          steps,
          actions,
          executionPolicy: automationEditor.executionPolicy,
        }),
      });
      if (!response.ok) throw new Error('Could not save automation');
      const payload = await response.json() as { item?: { id?: string } };
      await refreshAutomations();
      if (automationEditor.mode === 'create' && payload.item?.id) {
        setSelectedTaskId(payload.item.id);
      }
      closeAutomationEditor();
      showNotice('success', `${automationEditor.mode === 'create' ? 'Created' : 'Updated'} "${automationEditor.name.trim() || 'automation'}"`);
    } catch {
      showNotice('error', automationEditor.mode === 'create' ? 'Could not create automation' : 'Could not save automation changes');
    } finally {
      setActionBusy(null);
    }
  }, [automationEditor, closeAutomationEditor, refreshAutomations, showNotice]);

  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      if (activeConvoId === 'new' && messages.length > 0) {
        setNewConvoMessages(messages);

        // After first exchange, create a conversation with a Haiku-generated smart title
        if (messages.length === 2) {
          const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
          const fallbackTitle =
            messages[0]?.content?.slice(0, 45) + (messages[0]?.content?.length > 45 ? '…' : '');
          const newId = `conv-${Date.now()}`;

          const newConvo: Conversation = {
            id: newId,
            title: fallbackTitle,
            lastMessage: messages[messages.length - 1]?.content?.slice(0, 72),
            timestamp: new Date(),
            messages,
          };
          setConversations((prev) => [newConvo, ...prev]);
          setActiveConvoId(newId);

          // Upgrade title async via Haiku (cheap model)
          fetchSmartTitle(apiMessages).then((smartTitle) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === newId ? { ...c, title: smartTitle } : c))
            );
          });
        }
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvoId
              ? {
                  ...c,
                  messages,
                  lastMessage: messages[messages.length - 1]?.content?.slice(0, 72),
                  timestamp: new Date(),
                }
              : c
          )
        );
      }
    },
    [activeConvoId]
  );

  const activeConvo = conversations.find((c) => c.id === activeConvoId);
  const currentMessages = activeConvoId === 'new' ? newConvoMessages : activeConvo?.messages ?? [];
  const convoTitle = activeConvoId === 'new' ? 'New conversation' : activeConvo?.title ?? 'Conversation';

  const filteredConvos = conversations.filter(
    (c) =>
      !c.archived &&
      (
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const archivedConversations = useMemo(
    () =>
      conversations
        .filter((conversation) =>
          conversation.archived &&
          (!searchQuery ||
            conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (conversation.lastMessage ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [conversations, searchQuery]
  );

  const visibleFilteredConvos = useMemo(() => {
    if (threadFilter === 'all') return filteredConvos;
    if (threadFilter === 'active') {
      return filteredConvos.filter((conversation) => conversation.id === activeConvoId);
    }
    if (threadFilter === 'pinned') {
      return filteredConvos.filter((conversation) => conversation.pinned);
    }
    return [];
  }, [activeConvoId, filteredConvos, threadFilter]);

  const groupedConversations = useMemo(() => {
    const sorted = [...visibleFilteredConvos].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const active = activeConvoId !== 'new' ? sorted.find((convo) => convo.id === activeConvoId) : undefined;
    const remaining = active ? sorted.filter((convo) => convo.id !== active.id) : sorted;
    const pinned = remaining.filter((convo) => convo.pinned);
    const sectionItems = remaining.filter((convo) => !convo.pinned);

    const sections = sectionItems.reduce<Array<{ label: string; items: Conversation[] }>>((acc, convo) => {
      const label = getConversationSectionLabel(convo.timestamp);
      const existing = acc.find((section) => section.label === label);
      if (existing) existing.items.push(convo);
      else acc.push({ label, items: [convo] });
      return acc;
    }, []);

    return { active, pinned, sections };
  }, [activeConvoId, visibleFilteredConvos]);

  const taskItems: DashboardTaskItem[] = liveAutomations;
  const hasAutomationHistory = platformTasks.length > 0;
  const showTaskPanelEmptyState = taskPanelLoaded && taskItems.length === 0;

  const taskSummary = taskItems.reduce(
    (acc, task) => {
      acc[task.status as DashboardTaskStatus] += 1;
      return acc;
    },
    { scheduled: 0, complete: 0, alert: 0 }
  );
  const selectedTask = taskItems.find((task) => task.id === selectedTaskId) ?? taskItems[0];
  const selectedTaskMeta = selectedTask ? getTaskStatusMeta(selectedTask.status as 'scheduled' | 'complete' | 'alert') : null;
  const selectedTaskOutcome = useMemo(() => getTaskRunOutcome(selectedTask), [selectedTask]);
  const selectedTaskSummary = useMemo(() => formatSummaryPreview(selectedTask?.latestSummary, 360), [selectedTask?.latestSummary]);
  const selectedTaskEvidenceLinks = useMemo(() => extractEvidenceLinks(selectedTask?.latestArtifacts), [selectedTask?.latestArtifacts]);
  const selectedTaskStepExecutions = useMemo(() => selectedTask?.latestStepExecutions || [], [selectedTask?.latestStepExecutions]);
  const selectedTaskWorkflowSteps = useMemo(() => {
    if (!selectedTask) return [];
    if (Array.isArray(selectedTask.steps) && selectedTask.steps.length > 0) {
      return selectedTask.steps.map((step) => createWorkflowBlock(step.kind, step));
    }
    if (Array.isArray(selectedTask.actions) && selectedTask.actions.length > 0) {
      return selectedTask.actions.map((action) => parseLegacyActionToWorkflowBlock(action));
    }
    return [];
  }, [selectedTask]);
  const selectedTaskExecutionPolicy = useMemo(
    () => normalizeExecutionPolicy(selectedTask?.executionPolicy),
    [selectedTask?.executionPolicy]
  );
  const selectedTaskPolicyMath = useMemo(
    () => inferExecutionPolicyMath(selectedTaskExecutionPolicy, selectedTaskWorkflowSteps),
    [selectedTaskExecutionPolicy, selectedTaskWorkflowSteps]
  );
  const selectedTaskWorkerView = useMemo(() => summarizeWorkerLanes(selectedTask), [selectedTask]);
  const selectedTaskRunEconomics = useMemo(() => {
    const steps = selectedTask?.latestStepExecutions || [];
    const actualCredits = typeof selectedTask?.actualCredits === 'number'
      ? selectedTask.actualCredits
      : steps.reduce((total, step) => total + Math.max(0, step.actualCredits || 0), 0);
    const estimatedCredits = typeof selectedTask?.estimatedCredits === 'number' ? selectedTask.estimatedCredits : null;
    const totalTokens = steps.reduce((total, step) => total + Math.max(0, step.tokenUsage?.totalTokens || 0), 0);
    const totalToolCalls = steps.reduce((total, step) => total + Math.max(0, step.toolCalls || 0), 0);
    return { actualCredits, estimatedCredits, totalTokens, totalToolCalls };
  }, [selectedTask]);
  const selectedTaskWorkflowPreview = useMemo(() => {
    if (!selectedTask) return [];
    if (selectedTask.authoringMode === 'describe' && selectedTask.workflowPrompt) {
      return buildWorkflowBlocksFromPrompt(selectedTask.workflowPrompt).slice(0, 4);
    }
    return selectedTaskWorkflowSteps.slice(0, 4);
  }, [selectedTask, selectedTaskWorkflowSteps]);
  const lowCreditRunway = snapshot.projectedDaysLeft <= 7;
  const automationActionCount = useMemo(() => {
    if (!automationEditor) return 0;
    const sourceSteps = automationEditor.authoringMode === 'describe'
      ? buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt)
      : automationEditor.steps;
    return sourceSteps.filter((item) => workflowBlockHasContent(item)).length;
  }, [automationEditor]);
  const hasAutomationSteps = automationActionCount > 0;
  const automationEditorPolicyMath = useMemo(
    () => inferExecutionPolicyMath(automationEditor?.executionPolicy || DEFAULT_EXECUTION_POLICY, automationEditor?.steps || []),
    [automationEditor]
  );

  const updateConversationMeta = useCallback((id: string, updater: (conversation: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((conversation) => (conversation.id === id ? updater(conversation) : conversation)));
  }, []);

  const toggleConversationPinned = useCallback((id: string) => {
    updateConversationMeta(id, (conversation) => ({ ...conversation, pinned: !conversation.pinned, archived: false }));
  }, [updateConversationMeta]);

  const toggleConversationArchived = useCallback((id: string) => {
    updateConversationMeta(id, (conversation) => {
      const archived = !conversation.archived;
      return {
        ...conversation,
        archived,
        pinned: archived ? false : conversation.pinned,
      };
    });
    if (activeConvoId === id) {
      setActiveConvoId('new');
      setNewConvoMessages([]);
    }
  }, [activeConvoId]);

  const updateAutomationStep = useCallback((index: number, value: string) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const steps = [...current.steps];
      const step = steps[index];
      steps[index] = { ...step, objective: value, title: step.title || value };
      return { ...current, steps };
    });
  }, []);

  const moveAutomationStep = useCallback((index: number, direction: -1 | 1) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.steps.length) return current;
      const steps = [...current.steps];
      const [item] = steps.splice(index, 1);
      steps.splice(nextIndex, 0, item);
      return { ...current, steps };
    });
  }, []);

  const removeAutomationStep = useCallback((index: number) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const steps = current.steps.filter((_, actionIndex) => actionIndex !== index);
      return { ...current, steps: steps.length > 0 ? steps : [createWorkflowBlock('note')] };
    });
  }, []);

  const appendAutomationStep = useCallback((block?: WorkflowBlockDraft) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      return { ...current, steps: [...current.steps, block ? createWorkflowBlock(block.kind, block) : createWorkflowBlock('note')] };
    });
  }, []);

  const handleAutomationStepDrop = useCallback((targetIndex: number) => {
    setAutomationEditor((current) => {
      if (!current || draggedStepIndex === null || draggedStepIndex === targetIndex) return current;
      const steps = [...current.steps];
      const [draggedStep] = steps.splice(draggedStepIndex, 1);
      steps.splice(targetIndex, 0, draggedStep);
      return { ...current, steps };
    });
    setDraggedStepIndex(null);
  }, [draggedStepIndex]);

  const addAutomationTemplate = useCallback((template: WorkflowBlockDraft) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const exists = current.steps.some((step) => step.kind === template.kind && step.objective.trim() === template.objective.trim());
      if (exists) return current;
      return { ...current, steps: [...current.steps.filter((step) => workflowBlockHasContent(step)), createWorkflowBlock(template.kind, template)] };
    });
  }, []);

  useEffect(() => {
    if (!selectedTask && taskItems[0]) {
      setSelectedTaskId(taskItems[0].id);
      return;
    }

    if (taskItems.length === 0 && selectedTaskId !== '') {
      setSelectedTaskId('');
    }
  }, [selectedTask, selectedTaskId, taskItems]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const automationId = params.get('automation');
    const panel = params.get('panel');
    const editTarget = params.get('edit');
    const createTarget = params.get('create');

    if (panel === 'schedules') {
      setTaskPanelOpen(true);
    }

    if (createTarget === 'workflow' && !automationEditor) {
      handleAutomationCreate();
      return;
    }

    if (automationId) {
      const match = taskItems.find((task) => task.automationId === automationId || String(task.id) === automationId);
      if (match) {
        setSelectedTaskId(match.id);
      }
    }

    if (editTarget === 'workflow' && automationId && !automationEditor) {
      const match = taskItems.find((task) => task.automationId === automationId || String(task.id) === automationId);
      if (match) {
        setAutomationEditorSection('workflow');
        void handleAutomationEdit(match);
      }
    }
  }, [automationEditor, handleAutomationCreate, handleAutomationEdit, location.search, taskItems]);

  const ModeSelector = ({ compact = false }: { compact?: boolean }) => (
    <div className={`ui-input-shell flex items-center gap-1 p-1 ${compact ? 'w-full' : ''}`}>
      {MODE_BUTTONS.map(({ mode, label, icon: Icon, activeClass, tooltip }) => (
        <button
          key={mode}
          onClick={() => setAutonomyMode(mode)}
          title={tooltip}
          aria-label={tooltip}
          aria-pressed={autonomyMode === mode}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
            compact ? 'flex-1 justify-center' : ''
          } ${
            autonomyMode === mode
              ? `${activeClass} border shadow-[0_8px_18px_rgba(2,6,23,0.18)]`
              : 'text-slate-500 border-transparent hover:bg-navy-800/80 hover:text-slate-300'
          }`}
        >
          <Icon className={mode === 'supervised' ? 'w-5 h-5 text-red-400' : 'w-3 h-3'} />
          {label && <span>{label}</span>}
        </button>
      ))}
    </div>
  );

  const openTopUp = () => {
    navigate('/plans?section=topups');
  };

  const openUpgrade = () => {
    const nextPlanId = getSuggestedUpgradePlanId(snapshot.planName);
    if (!nextPlanId) {
      window.location.assign('mailto:sales@purpleorange.io?subject=Violema%20Enterprise');
      return;
    }
    navigate(`/plans?plan=${nextPlanId}`);
  };

  const grantTestCredits = useCallback(async () => {
    if (!authSession?.email || !canLoadTestCredits) return;

    setActionBusy('grant');
    try {
      const response = await fetch('/api/admin/test-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': workspace.workspaceId,
          'X-Workspace-Name': workspace.workspaceName,
          'X-Admin-Email': authSession.email,
        },
        body: JSON.stringify({
          amount: 5000,
        }),
      });

      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not load test credits');
      }

      await refreshCredits();
      showNotice('success', 'Loaded 5,000 founder test credits.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Could not load test credits');
    } finally {
      setActionBusy(null);
    }
  }, [authSession?.email, canLoadTestCredits, refreshCredits, showNotice, workspace.workspaceId, workspace.workspaceName]);

  const duplicateSelectedAutomation = useCallback(() => {
    if (!selectedTask) return;
    const nextSteps = Array.isArray(selectedTask.steps) && selectedTask.steps.length > 0
      ? selectedTask.steps.map((step) => createWorkflowBlock(step.kind, step))
      : Array.isArray(selectedTask.actions) && selectedTask.actions.length > 0
        ? selectedTask.actions.map((action) => parseLegacyActionToWorkflowBlock(action))
        : [createWorkflowBlock('summarize')];
    setAutomationEditorSection('setup');
    setAutomationEditor({
      mode: 'create',
      id: `draft-${Date.now()}`,
      name: `${selectedTask.title} copy`,
      schedule: selectedTask.schedule || selectedTask.time || 'every monday at 9am',
      description: selectedTask.description || '',
      notify: selectedTask.notify || '',
      condition: selectedTask.condition || '',
      authoringMode: selectedTask.authoringMode === 'describe' ? 'describe' : 'guided',
      workflowPrompt: selectedTask.workflowPrompt || buildWorkflowPromptFromBlocks(nextSteps),
      steps: nextSteps,
      executionPolicy: normalizeExecutionPolicy(selectedTask.executionPolicy),
      destinationType:
        selectedTask.notify?.startsWith('C') || selectedTask.notify?.startsWith('G') || selectedTask.notify?.startsWith('D') || selectedTask.notify?.startsWith('#')
          ? 'slack'
          : selectedTask.notify?.includes('@')
            ? 'email'
            : selectedTask.notify
              ? 'custom'
              : 'none',
    });
  }, [selectedTask]);

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] overflow-hidden bg-navy-950 md:h-screen md:min-h-screen">
      {uiNotice && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-50 flex justify-center">
          <div
            className={`pointer-events-auto max-w-md rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(2,6,23,0.42)] backdrop-blur-md ${
              uiNotice.tone === 'success'
                ? 'border-green-500/20 bg-green-500/12 text-green-100'
                : 'border-red-500/20 bg-red-500/12 text-red-100'
            }`}
          >
            <p className="text-sm font-medium">{uiNotice.message}</p>
          </div>
        </div>
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {sidebarOpen && isMobileSidebar && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
          className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {sidebarOpen && (
        <aside
          className={`${
            isMobileSidebar
              ? 'fixed inset-y-2 left-2 z-40 w-[calc(100vw-1rem)] max-w-[19.75rem] rounded-[1.5rem] shadow-[0_24px_64px_rgba(2,6,23,0.55)] [touch-action:pan-y]'
              : 'w-72 flex-shrink-0'
          } min-h-0 overflow-hidden border-r border-navy-800 bg-navy-900 flex flex-col sidebar-enter`}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-navy-800">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl pr-1"
              aria-label="Go to Violema home"
            >
              <div className="w-9 h-9 overflow-hidden flex-shrink-0">
                <img src={VIOLEMA_MARK} alt="Violema" className="po-logo w-full h-full object-contain" />
              </div>
              <div className="brand-lockup w-[10rem]">
                <span className="brand-wordmark text-[1.02rem]">
                  VIOLEMA
                </span>
                <span className="brand-submark text-[7.9px]">
                  Your AI coworker
                </span>
              </div>
            </button>
            <span className="ml-auto text-[10px] bg-violet-900/50 text-violet-300 border border-violet-800/50 rounded-full px-2 py-0.5 font-medium flex-shrink-0 shadow-sm">
              Beta
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-1 text-slate-600 hover:text-slate-400 transition-colors p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New chat + Mode selector */}
          <div className="px-4 pt-4 pb-3 space-y-2.5">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-glow-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>
            <ModeSelector compact />
          </div>

          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-navy-700 bg-navy-950/42 px-3.5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Credits</p>
                  <p className="mt-1 text-[1.35rem] font-semibold leading-none text-white">{formatCredits(snapshot.creditsRemaining)}</p>
                  <p className="text-[11px] text-slate-500">{snapshot.planName} plan</p>
                </div>
                <div className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                  lowCreditRunway
                    ? 'border border-amber-500/25 bg-amber-500/10 text-amber-200'
                    : 'border border-violet-500/20 bg-violet-500/10 text-violet-200'
                }`}>
                  {snapshot.projectedDaysLeft}d left
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={openTopUp}
                  className="flex-1 rounded-lg border border-navy-700 bg-navy-900/70 px-2.5 py-2 text-[11px] font-medium text-slate-300 transition-colors hover:border-violet-700 hover:text-white"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Top up
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { void openUpgrade(); }}
                  className="flex-1 rounded-lg border border-violet-700/40 bg-violet-500/10 px-2.5 py-2 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/16"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Upgrade
                  </span>
                </button>
              </div>
              {canLoadTestCredits ? (
                <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">Founder testing</p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-300">
                        Load a private 5k credit grant for admin-only testing on this workspace.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { void grantTestCredits(); }}
                      disabled={actionBusy === 'grant'}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/16 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionBusy === 'grant' ? 'Loading…' : 'Load 5k'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="w-full rounded-lg border border-navy-700 bg-navy-800 text-xs text-slate-300 placeholder-slate-600 pl-8 pr-3 py-1.5 outline-none transition-colors focus:border-violet-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div className="panel-scroll flex-1 min-h-0 px-3 pb-3 space-y-1">
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                {threadFilter === 'archived'
                  ? `${archivedConversations.length} archived`
                  : searchQuery
                    ? `${visibleFilteredConvos.length} result${visibleFilteredConvos.length !== 1 ? 's' : ''}`
                    : 'Threads'}
              </p>
              <div className="flex items-center gap-1 rounded-full border border-navy-700/80 bg-navy-950/55 p-1">
                {([
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Now' },
                  { value: 'pinned', label: 'Pinned' },
                  { value: 'archived', label: 'Archived' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setThreadFilter(option.value)}
                    className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                      threadFilter === option.value
                        ? 'bg-violet-500/14 text-violet-200'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {threadFilter !== 'archived' && filteredConvos.length === 0 && searchQuery && (
              <p className="px-3 py-4 text-center text-xs text-slate-600">No conversations found</p>
            )}

            {threadFilter !== 'archived' && groupedConversations.active && (
              <div className="space-y-1">
                <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">Active now</p>
                {[groupedConversations.active].map((convo) => (
                  <div
                    key={convo.id}
                    onMouseEnter={() => setHoveredConvoId(convo.id)}
                    onMouseLeave={() => {
                      setHoveredConvoId(null);
                    }}
                    className="relative"
                  >
                    <button
                      onClick={() => {
                        setActiveConvoId(convo.id);
                        if (isMobileSidebar) setSidebarOpen(false);
                      }}
                      className="w-full rounded-xl bg-navy-800 text-left text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)] transition-all px-3.5 py-2.5 ring-1 ring-violet-500/20"
                    >
                      <div className="flex items-start gap-2.5 pr-12">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-300" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium leading-snug">{convo.title}</p>
                            <span className="flex-shrink-0 text-[10px] text-slate-500">{formatTime(convo.timestamp)}</span>
                          </div>
                          {convo.lastMessage && (
                            <p className="mt-1 truncate text-[10px] leading-snug text-slate-400">{convo.lastMessage}</p>
                          )}
                          {inferConversationTags(convo).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {inferConversationTags(convo).map((tag) => (
                                <span key={tag} className="rounded-full border border-violet-500/15 bg-violet-500/10 px-2 py-0.5 text-[9px] font-medium text-violet-100/80">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    {hoveredConvoId === convo.id && (
                      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-xl border border-navy-700/80 bg-navy-950/92 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.32)]">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleConversationPinned(convo.id);
                          }}
                          className={`rounded-lg p-1 transition-colors hover:bg-navy-800 ${
                            convo.pinned ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'
                          }`}
                          aria-label={convo.pinned ? 'Unpin conversation' : 'Pin conversation'}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleConversationArchived(convo.id);
                          }}
                          className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-navy-800 hover:text-slate-200"
                          aria-label="Archive conversation"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {threadFilter !== 'archived' && groupedConversations.pinned.length > 0 && (
              <div className="space-y-1">
                <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300/70">Pinned</p>
                {groupedConversations.pinned.map((convo) => {
                  const tags = inferConversationTags(convo);
                  return (
                    <div
                      key={convo.id}
                      onMouseEnter={() => setHoveredConvoId(convo.id)}
                      onMouseLeave={() => setHoveredConvoId(null)}
                      className="relative"
                    >
                      <button
                        onClick={() => {
                          setActiveConvoId(convo.id);
                          if (isMobileSidebar) setSidebarOpen(false);
                        }}
                        className="w-full rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/8 to-navy-950/30 px-3.5 py-2.5 text-left text-slate-200 transition-all hover:border-amber-400/25 hover:bg-amber-500/[0.09]"
                      >
                        <div className="flex items-start gap-2.5 pr-12">
                          <Pin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium leading-snug">{convo.title}</p>
                              <span className="flex-shrink-0 text-[10px] text-slate-500">{formatTime(convo.timestamp)}</span>
                            </div>
                            {convo.lastMessage && (
                              <p className="mt-1 truncate text-[10px] leading-snug text-slate-400">{convo.lastMessage}</p>
                            )}
                            {tags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {tags.map((tag) => (
                                  <span key={tag} className="rounded-full border border-amber-500/15 bg-amber-500/8 px-2 py-0.5 text-[9px] font-medium text-amber-100/80">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                      {hoveredConvoId === convo.id && (
                        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-xl border border-navy-700/80 bg-navy-950/92 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.32)]">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleConversationPinned(convo.id);
                            }}
                            className="rounded-lg p-1 text-amber-300 transition-colors hover:bg-navy-800"
                            aria-label="Unpin conversation"
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleConversationArchived(convo.id);
                            }}
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-navy-800 hover:text-slate-200"
                            aria-label="Archive conversation"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {threadFilter !== 'archived' && groupedConversations.sections.map((section) => (
              <div key={section.label} className="space-y-1">
                <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">{section.label}</p>
                {section.items.map((convo) => (
                  <div
                    key={convo.id}
                    onMouseEnter={() => setHoveredConvoId(convo.id)}
                    onMouseLeave={() => {
                      setHoveredConvoId(null);
                    }}
                    className="relative"
                  >
                    <button
                      onClick={() => {
                        setActiveConvoId(convo.id);
                        if (isMobileSidebar) setSidebarOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl transition-all text-slate-400 hover:bg-navy-800/60 hover:text-slate-200"
                    >
                      <div className="flex items-start gap-2.5 pr-6">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 opacity-45" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium leading-snug">{convo.title}</p>
                            <span className="flex-shrink-0 text-[10px] text-slate-700">{formatTime(convo.timestamp)}</span>
                          </div>
                          {convo.lastMessage && (
                            <p className="mt-1 truncate text-[10px] leading-snug text-slate-500">{convo.lastMessage}</p>
                          )}
                          {inferConversationTags(convo).length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {inferConversationTags(convo).map((tag) => (
                                <span key={tag} className="rounded-full border border-navy-700/80 bg-navy-900/60 px-2 py-0.5 text-[9px] font-medium text-slate-400">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    {hoveredConvoId === convo.id && (
                      deleteConfirmId === convo.id ? (
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-navy-950 border border-red-800/60 rounded-xl px-2.5 py-1.5 shadow-[0_10px_24px_rgba(2,6,23,0.32)] z-10">
                          <span className="text-[10px] text-red-400 font-medium">Delete?</span>
                          <button
                            onClick={(e) => handleDeleteConvo(convo.id, e)}
                            className="text-[10px] text-red-400 hover:text-red-300 font-semibold ml-1 px-1"
                            aria-label="Confirm delete"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="text-[10px] text-slate-500 hover:text-slate-300 px-1"
                            aria-label="Cancel delete"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-xl border border-navy-700/80 bg-navy-950/92 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.32)]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleConversationPinned(convo.id);
                            }}
                            className={`rounded-lg p-1 transition-colors hover:bg-navy-800 ${
                              convo.pinned ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'
                            }`}
                            aria-label={convo.pinned ? 'Unpin conversation' : 'Pin conversation'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleConversationArchived(convo.id);
                            }}
                            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-navy-800 hover:text-slate-200"
                            aria-label={`Archive conversation "${convo.title}"`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(convo.id); }}
                            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-navy-800 hover:text-red-400"
                            aria-label={`Delete conversation "${convo.title}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            ))}

            {archivedConversations.length > 0 && (
              <div className="space-y-1">
                {threadFilter === 'archived' ? archivedConversations.map((convo) => (
                  <div key={convo.id} className="relative">
                    <button
                      onClick={() => {
                        setActiveConvoId(convo.id);
                        if (isMobileSidebar) setSidebarOpen(false);
                      }}
                      className="w-full rounded-xl border border-navy-800/80 bg-navy-950/30 px-3.5 py-2.5 text-left text-slate-500 transition-all hover:border-navy-700 hover:text-slate-300"
                    >
                      <div className="flex items-start gap-2.5 pr-12">
                        <Archive className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium leading-snug">{convo.title}</p>
                            <span className="flex-shrink-0 text-[10px] text-slate-700">{formatTime(convo.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-xl border border-navy-700/80 bg-navy-950/92 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.32)]">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleConversationArchived(convo.id);
                        }}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-navy-800 hover:text-slate-200"
                        aria-label="Restore conversation"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <button
                    type="button"
                    onClick={() => setShowArchived((current) => !current)}
                    className="flex w-full items-center justify-between px-1 pt-2 text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600"
                  >
                    <span>Archived</span>
                    <span className="inline-flex items-center gap-1">
                      {archivedConversations.length}
                      {showArchived ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                )}
                {threadFilter !== 'archived' && showArchived && archivedConversations.map((convo) => (
                  <div key={convo.id} className="relative">
                    <button
                      onClick={() => {
                        setActiveConvoId(convo.id);
                        if (isMobileSidebar) setSidebarOpen(false);
                      }}
                      className="w-full rounded-xl border border-navy-800/80 bg-navy-950/30 px-3.5 py-2.5 text-left text-slate-500 transition-all hover:border-navy-700 hover:text-slate-300"
                    >
                      <div className="flex items-start gap-2.5 pr-12">
                        <Archive className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium leading-snug">{convo.title}</p>
                            <span className="flex-shrink-0 text-[10px] text-slate-700">{formatTime(convo.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-xl border border-navy-700/80 bg-navy-950/92 p-1 shadow-[0_10px_24px_rgba(2,6,23,0.32)]">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleConversationArchived(convo.id);
                        }}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-navy-800 hover:text-slate-200"
                        aria-label="Restore conversation"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User / settings */}
          <div className="border-t border-navy-800 px-4 py-3">
            <div className="mb-3 rounded-2xl border border-navy-700/80 bg-navy-950/38 px-3.5 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.14)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Slack</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {hasSlackConnection() ? authSession?.slackDisplayTarget || authSession?.slackChannelId : 'Not connected'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {hasSlackConnection()
                      ? `${authSession?.slackWorkspace || 'Slack'} is ready for alerts and approvals.`
                      : 'Save one Slack channel during onboarding so automations have a real destination.'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/connect/slack?next=%2Fdashboard')}
                  className="ui-button-ghost px-3 py-2 text-[11px]"
                >
                  {hasSlackConnection() ? 'Edit' : 'Connect'}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-navy-700/80 bg-navy-950/38 px-3.5 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.14)]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-violet-800/40 bg-gradient-to-br from-violet-700/35 to-navy-700 text-xs font-bold text-violet-300">
                  U
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">You</p>
                  <p className="truncate text-[11px] text-slate-500">{snapshot.planName} plan · claude-opus-4-6</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-violet-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-navy-700 bg-navy-900/72 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-violet-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Home
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main chat area ───────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-navy-800/80 bg-gradient-to-r from-navy-950/92 via-navy-900/70 to-navy-950/92 px-3 py-2.5 shadow-[0_12px_30px_rgba(2,6,23,0.16)] backdrop-blur-md flex-shrink-0 sm:px-5">
          {(!sidebarOpen || isMobileSidebar) && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded p-0.5"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white sm:text-sm">{convoTitle}</h1>
              <span className="rounded-full border border-green-500/15 bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-green-300">
                Ready
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_0_4px_rgba(74,222,128,0.08)]" />
              <span className="text-xs text-slate-500">Violema ready</span>
              {currentMessages.length > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-600">{currentMessages.length} msgs</span>
                </>
              )}
            </div>
          </div>

          {/* Mode selector — desktop only (mobile uses sidebar) */}
          <div className="hidden xl:block">
            <ModeSelector />
          </div>

          <button
            onClick={() => setTaskPanelOpen((v) => !v)}
            aria-pressed={taskPanelOpen}
            aria-label="Toggle tasks panel"
            className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              taskPanelOpen
                ? 'bg-violet-900/30 border-violet-700/50 text-violet-300 shadow-sm'
                : 'bg-navy-800/80 border-navy-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Schedules</span>
          </button>
          <button
            onClick={() => navigate('/dashboard/agents')}
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-800/80 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Agent Studio</span>
          </button>
        </header>

        {isMobileSidebar && (
          <div className="border-b border-navy-800/70 bg-navy-950/55 px-3 py-2 backdrop-blur-sm sm:hidden">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="ui-button-ghost flex-1 justify-center py-2 text-[11px]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Conversations
              </button>
              <button
                onClick={() => setTaskPanelOpen(true)}
                className="ui-button-ghost flex-1 justify-center py-2 text-[11px]"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Schedules
              </button>
              <button
                onClick={() => navigate('/dashboard/agents')}
                className="ui-button-ghost flex-1 justify-center py-2 text-[11px]"
              >
                <Bot className="h-3.5 w-3.5" />
                Agent Studio
              </button>
            </div>
          </div>
        )}

        {/* Chat body */}
        <div className="flex flex-1 min-h-0">
          <div className="flex min-h-0 flex-1 min-w-0">
            <ChatInterface
              conversationId={activeConvoId}
              initialMessages={currentMessages}
              onMessagesChange={handleMessagesChange}
              autonomyMode={autonomyMode}
            />
          </div>

      {/* Task panel */}
      {taskPanelOpen && (
            <>
            {isMobileSidebar && (
              <button
                type="button"
                onClick={() => setTaskPanelOpen(false)}
                aria-label="Close automations overlay"
                className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[1px] lg:hidden"
              />
            )}
            <aside
              className={`${
                isMobileSidebar
                  ? 'fixed inset-x-2 bottom-2 top-20 z-40 rounded-[1.5rem] shadow-[0_24px_64px_rgba(2,6,23,0.58)] [touch-action:pan-y]'
                  : 'w-[22rem] flex-shrink-0'
              } min-h-0 border-l border-navy-800/80 bg-gradient-to-b from-navy-900/60 via-navy-900/36 to-navy-950/60 flex flex-col overflow-hidden backdrop-blur-md shadow-[inset_1px_0_0_rgba(255,255,255,0.03)]`}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-navy-800/80 bg-gradient-to-r from-violet-500/8 via-navy-950/30 to-cyan-500/6">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-violet-500/15 bg-violet-500/8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Workspace</p>
                    <h3 className="text-sm font-semibold text-white">Schedules</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { void refreshTaskPanel(); }}
                    aria-label="Refresh automations"
                    className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-navy-900/70 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${taskPanelRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setTaskPanelOpen(false)}
                    aria-label="Close tasks panel"
                    className="text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="panel-scroll flex-1 min-h-0 pb-3">
              <div className="px-3 pt-3 sm:px-3.5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Scheduled', value: taskSummary.scheduled, tone: 'violet' },
                    { label: 'Done', value: taskSummary.complete, tone: 'green' },
                    { label: 'Alerts', value: taskSummary.alert, tone: 'amber' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-2xl border px-2.5 py-2 ${
                        stat.tone === 'violet'
                          ? 'border-violet-500/15 bg-gradient-to-br from-violet-500/10 to-navy-950/20'
                          : stat.tone === 'green'
                            ? 'border-green-500/15 bg-gradient-to-br from-green-500/10 to-navy-950/20'
                            : 'border-amber-500/15 bg-gradient-to-br from-amber-500/10 to-navy-950/20'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{stat.label}</p>
                      <p className="mt-1 text-lg font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-3 pt-3 sm:px-3.5">
                <div className="rounded-[1.4rem] border border-violet-500/15 bg-gradient-to-br from-violet-500/8 via-navy-900/70 to-navy-950/92 p-3.5 shadow-[0_16px_34px_rgba(2,6,23,0.16)]">
                  {selectedTask ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Selected workflow</p>
                          <h4 className="mt-1 text-sm font-semibold leading-snug text-white">{selectedTask.title}</h4>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${selectedTaskMeta?.chip ?? 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                          {selectedTaskMeta?.label ?? 'Scheduled'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                          <p className="uppercase tracking-[0.18em] text-slate-600">Next run</p>
                          <p className="mt-1 text-slate-200">{selectedTask.nextRunAt ? formatAutomationRunTime(selectedTask.nextRunAt) : selectedTask.time}</p>
                        </div>
                        <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                          <p className="uppercase tracking-[0.18em] text-slate-600">Last outcome</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${selectedTaskOutcome.tone}`}>
                              {selectedTaskOutcome.label}
                            </span>
                            {selectedTask.lastRunAt ? (
                              <span className="text-[10px] text-slate-500">{formatRelativeTimeFromIso(selectedTask.lastRunAt)}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                          {selectedTask.source === 'live' ? 'Live task' : 'Preview task'}
                        </span>
                        {selectedTask.agentRole && (
                          <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                            {selectedTask.agentRole}
                          </span>
                        )}
                        {selectedTask.modelTier && (
                          <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                            {selectedTask.modelTier}
                          </span>
                        )}
                        {selectedTask.modelSource && (
                          <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                            {selectedTask.modelSource}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 rounded-2xl border border-navy-700/60 bg-navy-950/42 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Agent policy</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                              Workflow lives here. The full worker system lives in Agent Studio, where you can compare presets, inspect performance, and tune routing without burying it under schedule tracking.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/agents?automation=${selectedTask.automationId || selectedTask.id}`)}
                            className="ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200"
                          >
                            Open Agent Studio
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Mode</p>
                            <p className="mt-1 text-slate-100">{getExecutionModeLabel(selectedTaskExecutionPolicy.mode)}</p>
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Preset bias</p>
                            <p className="mt-1 text-slate-100">{getOptimizationGoalLabel(selectedTaskExecutionPolicy.optimizationGoal)}</p>
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Review</p>
                            <p className="mt-1 text-slate-100">{getReviewPolicyLabel(selectedTaskExecutionPolicy.reviewPolicy)}</p>
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Lane demand</p>
                            <p className="mt-1 text-slate-100">{selectedTaskPolicyMath.recommendedElasticLanes} recommended</p>
                          </div>
                        </div>
                        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                          {selectedTaskWorkerView.summary || `Math: ${selectedTaskPolicyMath.stepCount} workflow steps, ${selectedTaskPolicyMath.toolCalls} tool calls, reasoning load ${selectedTaskPolicyMath.reasoningLoad}.`}
                        </p>
                      </div>
                      <div className="mt-3 rounded-2xl border border-navy-700/60 bg-navy-950/42 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Latest result</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {selectedTask.lastRunAt
                                ? `${selectedTaskOutcome.detail} Last run ${formatAutomationRunTime(selectedTask.lastRunAt)}.`
                                : selectedTaskOutcome.detail}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500 xl:grid-cols-4">
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Run cost</p>
                            <p className="mt-1 text-slate-100">
                              {selectedTaskRunEconomics.actualCredits > 0 ? `${formatCredits(selectedTaskRunEconomics.actualCredits)} cr` : '—'}
                            </p>
                            {selectedTaskRunEconomics.estimatedCredits ? (
                              <p className="mt-1 text-[10px] text-slate-500">Est. {formatCredits(selectedTaskRunEconomics.estimatedCredits)} cr</p>
                            ) : null}
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Tokens</p>
                            <p className="mt-1 text-slate-100">{formatTokenCount(selectedTaskRunEconomics.totalTokens) || '—'}</p>
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Tool calls</p>
                            <p className="mt-1 text-slate-100">{selectedTaskRunEconomics.totalToolCalls || '—'}</p>
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Step count</p>
                            <p className="mt-1 text-slate-100">{selectedTaskStepExecutions.length || '—'}</p>
                          </div>
                          <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5 xl:col-span-2">
                            <p className="uppercase tracking-[0.18em] text-slate-600">Model source</p>
                            <p className="mt-1 text-slate-100">{selectedTask.modelSource || '—'}</p>
                          </div>
                        </div>
                        {selectedTask.failureReason ? (
                          <div className="mt-3 rounded-xl border border-red-500/18 bg-red-500/8 px-3 py-2.5 text-[11px] leading-relaxed text-red-200">
                            {selectedTask.failureReason}
                          </div>
                        ) : null}
                        {selectedTaskSummary ? (
                          <p className="mt-3 text-[13px] leading-6 text-slate-100">
                            {selectedTaskSummary}
                          </p>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-navy-700/70 bg-navy-950/25 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                            {selectedTaskOutcome.label === 'Last run failed'
                              ? 'The last run failed before it produced a concise summary. Check the workflow steps or delivery target and run it again.'
                              : selectedTask.lastRunAt
                                ? 'The latest run finished, but it did not store a summary preview yet.'
                                : 'No run output yet. Start the automation manually or wait for the next scheduled run.'}
                          </div>
                        )}
                        {selectedTaskEvidenceLinks.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Evidence</p>
                            <div className="mt-2 space-y-1.5">
                              {selectedTaskEvidenceLinks.map((link) => (
                                <a
                                  key={`${link.href}-${link.label}`}
                                  href={link.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group flex items-center justify-between rounded-xl border border-cyan-500/12 bg-cyan-500/6 px-3 py-2 text-left transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/10"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-medium text-slate-100">{link.label}</p>
                                    <p className="truncate text-[10px] text-slate-500">Source: {link.source}</p>
                                  </div>
                                  <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-cyan-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : selectedTask.lastRunAt ? (
                          <div className="mt-3 rounded-xl border border-dashed border-navy-700/70 bg-navy-950/25 px-3 py-2.5 text-[11px] text-slate-500">
                            No evidence links were attached to the latest run.
                          </div>
                        ) : null}
                        <div className="mt-3 rounded-xl border border-violet-500/12 bg-violet-500/6 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.18em] text-violet-300/80">Workflow design</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                                {selectedTask.authoringMode === 'describe'
                                  ? 'This workflow is written as a plain-language brief and translated into runnable steps.'
                                  : 'This workflow is defined as explicit steps you can inspect and reorder.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAutomationEditorSection('workflow');
                                void handleAutomationEdit(selectedTask);
                              }}
                              className="ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal text-violet-200"
                            >
                              Edit workflow
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                              {selectedTask.authoringMode === 'describe' ? 'Natural-language brief' : 'Guided steps'}
                            </span>
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                              {selectedTaskWorkflowPreview.length} visible steps
                            </span>
                          </div>
                          {selectedTask.authoringMode === 'describe' && selectedTask.workflowPrompt ? (
                            <div className="mt-3 rounded-lg border border-white/6 bg-white/4 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300">
                              {selectedTask.workflowPrompt}
                            </div>
                          ) : null}
                          {selectedTaskWorkflowPreview.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {selectedTaskWorkflowPreview.map((step, index) => (
                                <div key={`${step.id}-${index}`} className="rounded-lg border border-navy-700/70 bg-navy-950/45 px-3 py-2.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-medium text-white">{index + 1}. {step.title}</p>
                                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-[10px] text-slate-300">
                                      {step.kind}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{step.objective}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {selectedTask.description && (
                        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                          {selectedTask.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => { void handleAutomationRun(selectedTask); }}
                          disabled={selectedTask.source !== 'live' || actionBusy !== null}
                          className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300 transition-colors hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionBusy === 'run' ? 'Running…' : 'Run now'}
                        </button>
                        <button
                          onClick={() => { void handleAutomationPauseToggle(selectedTask); }}
                          disabled={selectedTask.source !== 'live' || actionBusy !== null}
                          className="flex-1 rounded-xl border border-navy-700/70 bg-navy-950/35 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-navy-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionBusy === 'pause' ? 'Saving…' : selectedTask.automationStatus === 'paused' ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={() => {
                            setAutomationEditorSection('setup');
                            void handleAutomationEdit(selectedTask);
                          }}
                          disabled={selectedTask.source !== 'live' || actionBusy !== null}
                          className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300 transition-colors hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit schedule
                        </button>
                      </div>
                      {selectedTask.source === 'live' && (
                        <button
                          onClick={() => confirmAutomationDelete(selectedTask)}
                          disabled={actionBusy !== null}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/18 bg-red-500/6 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {actionBusy === 'delete' ? 'Deleting…' : 'Delete automation'}
                        </button>
                      )}
                      {selectedTask.source === 'live' && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={duplicateSelectedAutomation}
                            className="flex-1 rounded-xl border border-navy-700/70 bg-transparent px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-navy-600 hover:bg-navy-950/35 hover:text-slate-200"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={handleAutomationCreate}
                            className="flex-1 rounded-xl border border-navy-700/70 bg-transparent px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-navy-600 hover:bg-navy-950/35 hover:text-cyan-200"
                          >
                            New from template
                          </button>
                        </div>
                      )}
                    </>
                  ) : taskItems.length > 0 ? (
                    <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/25 px-3 py-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Selected workflow</p>
                      <p className="mt-2 text-sm font-medium text-white">Choose a scheduled workflow</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Pick one schedule from the list below to inspect its tracking folder or agent setup folder.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2 px-3 pt-0 sm:px-3.5">
                {showTaskPanelEmptyState ? (
                  <div className="rounded-2xl border border-dashed border-navy-700/70 bg-navy-950/25 px-4 py-5 text-center">
                    <p className="text-sm font-medium text-white">No active schedules</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {hasAutomationHistory
                        ? 'Deleted or completed workflow runs remain in task history, but only active automations appear in this panel.'
                        : 'Start with a scheduled automation and the latest result will appear here automatically.'}
                    </p>
                  </div>
                ) : taskItems.map((task) => {
                  const Icon = task.icon;
                  const meta = getTaskStatusMeta(task.status as 'scheduled' | 'complete' | 'alert');
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedTaskId(task.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedTaskId(task.id);
                        }
                      }}
                      className={`relative border rounded-2xl p-3.5 transition-all cursor-pointer group shadow-[0_12px_28px_rgba(2,6,23,0.14)] hover:shadow-[0_16px_34px_rgba(2,6,23,0.22)] ${
                        isSelected
                          ? `bg-gradient-to-br ${meta.accent} border-violet-500/40 ring-1 ring-violet-500/20 translate-y-[-1px]`
                          : 'border-navy-700/70 bg-navy-950/34 hover:border-violet-600/30 hover:bg-navy-900/55'
                      }`}
                    >
                  <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex-shrink-0 ${meta.iconColor}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-slate-100 font-medium truncate">{task.title}</p>
                            <span className={`text-[10px] flex-shrink-0 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{task.time}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${meta.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                            {task.source === 'live' && (
                              <span className="text-[10px] text-slate-600">Live</span>
                            )}
                          </div>
                          <p className={`mt-2 truncate text-[11px] leading-relaxed ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {formatSummaryPreview(task.latestSummary, 90)
                              || (task.failureReason ? truncateText(task.failureReason, 90) : '')
                              || (task.lastRunAt
                                ? task.status === 'alert'
                                  ? 'Latest run needs attention.'
                                  : 'Latest run completed without a saved preview.'
                                : task.description
                                  ? truncateText(task.description, 90)
                                  : 'No run result yet.')}
                          </p>
                        </div>
                        {task.source === 'live' && task.automationId ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTaskId(task.id);
                              confirmAutomationDelete(task);
                            }}
                            className="rounded-lg p-1 text-slate-600 transition-colors hover:bg-navy-900/80 hover:text-red-300"
                            aria-label={`Delete ${task.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <ChevronRight className={`w-3.5 h-3.5 mt-0.5 transition-all flex-shrink-0 ${
                          isSelected ? 'text-violet-300 rotate-0' : 'text-slate-600 group-hover:text-slate-300'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              <div className="p-3 border-t border-navy-800/80 bg-gradient-to-r from-navy-950/35 via-violet-500/6 to-navy-950/35">
                <button
                  onClick={handleAutomationCreate}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border border-dashed border-violet-500/25 text-slate-300 hover:border-violet-400/50 hover:text-white text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 bg-navy-950/30 shadow-[0_8px_24px_rgba(2,6,23,0.12)]"
                >
                  <Plus className="w-4 h-4" />
                  Schedule automation
                </button>
                <p className="mt-2 text-center text-[10px] text-slate-600">
                  Recurring work stays visible, metered, and easy to adjust.
                </p>
              </div>
            </aside>
          </>
          )}
        </div>
      </div>

      {automationEditor && (
        <>
          <button
            type="button"
            aria-label="Close automation editor"
            onClick={closeAutomationEditor}
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          />
            <aside className="absolute right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-navy-700/80 bg-gradient-to-b from-navy-900/98 via-navy-900/96 to-navy-950/98 shadow-[0_24px_64px_rgba(2,6,23,0.58)] [touch-action:pan-y]">
            <div className="flex items-center justify-between border-b border-navy-800/80 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">Automation editor</p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  {automationEditor.mode === 'create' ? 'Create workflow' : 'Edit workflow'}
                </h3>
              </div>
              <button
                onClick={closeAutomationEditor}
                className="rounded-xl border border-navy-700/80 bg-navy-900/55 p-2 text-slate-400 transition-colors hover:text-white"
                aria-label="Close automation editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="panel-scroll flex-1 space-y-4 px-5 py-5 pb-8">
              <div className="rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Builder</p>
                <p className="mt-1 text-sm text-white">Set the cadence, design the workflow here, and keep agent policy in Agent Studio.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'setup' as const, label: 'Setup' },
                  { id: 'workflow' as const, label: 'Workflow' },
                  { id: 'agents' as const, label: 'Agent setup' },
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setAutomationEditorSection(section.id)}
                    className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                      automationEditorSection === section.id
                        ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                        : 'text-slate-300'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              {automationEditorSection === 'setup' && (
                <>
              <label className="block">
                <span className="ui-section-label px-1">Name</span>
                <div className="ui-input-shell mt-1">
                  <input
                    value={automationEditor.name}
                    onChange={(event) => setAutomationEditor((current) => current ? { ...current, name: event.target.value } : current)}
                    className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                    placeholder="Stripe failed payments monitor"
                  />
                </div>
              </label>

                <label className="block">
                <span className="ui-section-label px-1">Schedule</span>
                <div className="mt-1 flex flex-wrap gap-2 px-1">
                  {SCHEDULE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setAutomationEditor((current) => current ? { ...current, schedule: preset.value } : current)}
                      className={`ui-pill px-2.5 py-1 text-[10px] normal-case tracking-normal ${
                        automationEditor.schedule.trim().toLowerCase() === preset.value
                          ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                          : 'text-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="ui-input-shell mt-1">
                  <input
                    value={automationEditor.schedule}
                    onChange={(event) => setAutomationEditor((current) => current ? { ...current, schedule: event.target.value } : current)}
                    className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                    placeholder="Every monday at 9am"
                  />
                </div>
                <p className="mt-1 px-1 text-[11px] text-slate-500">Use plain language like “every hour”, “daily at 6pm”, or “every monday at 9am”.</p>
              </label>

                <label className="block">
                <span className="ui-section-label px-1">Description</span>
                <div className="ui-input-shell mt-1">
                  <textarea
                    value={automationEditor.description}
                    onChange={(event) => setAutomationEditor((current) => current ? { ...current, description: event.target.value } : current)}
                    rows={3}
                    className="w-full resize-none bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                    placeholder="What this workflow is responsible for."
                  />
                </div>
              </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="ui-section-label px-1">Notify</span>
                    <div className="mt-1 flex flex-wrap gap-2 px-1">
                      {[
                        { label: 'Slack', value: 'slack', placeholder: 'C0123456789' },
                        { label: 'Email', value: 'email', placeholder: 'max@purpleorange.io' },
                        { label: 'Custom', value: 'custom', placeholder: '' },
                        { label: 'None', value: 'none', placeholder: '' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAutomationEditor((current) => {
                            if (!current) return current;
                            return {
                              ...current,
                              destinationType: option.value as AutomationEditorDraft['destinationType'],
                              notify: option.value === 'none'
                                ? ''
                                : current.notify || option.placeholder,
                            };
                          })}
                          className={`ui-pill px-2.5 py-1 text-[10px] normal-case tracking-normal ${
                            automationEditor.destinationType === option.value
                              ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                              : 'text-slate-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="ui-input-shell mt-1">
                      <input
                        value={automationEditor.notify}
                        onChange={(event) => setAutomationEditor((current) => current ? { ...current, notify: event.target.value } : current)}
                        className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                        placeholder="Slack channel ID (C...) or email"
                        disabled={automationEditor.destinationType === 'none'}
                      />
                    </div>
                    <p className="mt-1 px-1 text-[11px] text-slate-500">
                      Slack is most reliable with a channel ID like <span className="font-mono text-slate-400">C0123456789</span>. Channel names like <span className="font-mono text-slate-400">#ops-alerts</span> need extra Slack scopes or alias mapping.
                    </p>
                  </label>

                  <label className="block">
                    <span className="ui-section-label px-1">Condition</span>
                    <div className="ui-input-shell mt-1">
                      <input
                        value={automationEditor.condition}
                        onChange={(event) => setAutomationEditor((current) => current ? { ...current, condition: event.target.value } : current)}
                        className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                        placeholder="Only if failure count exceeds 3"
                      />
                    </div>
                  </label>
                </div>
                </>
              )}

              {automationEditorSection === 'workflow' && (
                <>
              <div className="rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Workflow authoring</p>
                <p className="mt-1 text-sm text-white">Use guided steps when you want precise control. Use a natural-language brief when you want speed. Keep the workflow here and tune the worker system in Agent Studio.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAutomationEditor((current) => current ? {
                      ...current,
                      authoringMode: 'guided',
                      steps: current.steps.length > 0 ? current.steps : buildWorkflowBlocksFromPrompt(current.workflowPrompt),
                    } : current)}
                    className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                      automationEditor.authoringMode === 'guided'
                        ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                        : 'text-slate-300'
                    }`}
                  >
                    Guided steps
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutomationEditor((current) => current ? {
                      ...current,
                      authoringMode: 'describe',
                      workflowPrompt: current.workflowPrompt.trim() || buildWorkflowPromptFromBlocks(current.steps),
                    } : current)}
                    className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                      automationEditor.authoringMode === 'describe'
                        ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                        : 'text-slate-300'
                    }`}
                  >
                    Describe it
                  </button>
                </div>
              </div>
              {automationEditor.authoringMode === 'guided' ? (
              <label className="block">
                <span className="ui-section-label px-1">Workflow steps</span>
                <div className="mt-1 flex flex-wrap gap-2 px-1">
                  {ACTION_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => addAutomationTemplate(template.block)}
                      className="ui-pill px-2.5 py-1 text-[10px] normal-case tracking-normal text-slate-300"
                    >
                      + {template.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 space-y-2">
                  {automationEditor.steps.map((step, index) => (
                    <div
                      key={step.id}
                      draggable
                      onDragStart={() => setDraggedStepIndex(index)}
                      onDragEnd={() => setDraggedStepIndex(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleAutomationStepDrop(index)}
                      className={`rounded-2xl border bg-navy-950/36 p-3 transition-all ${
                        draggedStepIndex === index
                          ? 'border-violet-500/40 shadow-[0_14px_28px_rgba(91,33,182,0.18)]'
                          : 'border-navy-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-[11px] font-semibold text-violet-200">
                            {index + 1}
                          </span>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Step</p>
                          <span className="rounded-full border border-navy-700/80 bg-navy-900/70 px-2 py-0.5 text-[9px] font-medium text-slate-500">
                            drag to reorder
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveAutomationStep(index, -1)}
                            disabled={index === 0}
                            className="rounded-lg border border-navy-700/70 bg-navy-900/60 p-1 text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Move step up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAutomationStep(index, 1)}
                            disabled={index === automationEditor.steps.length - 1}
                            className="rounded-lg border border-navy-700/70 bg-navy-900/60 p-1 text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Move step down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAutomationStep(index)}
                            className="rounded-lg border border-navy-700/70 bg-navy-900/60 p-1 text-slate-400 transition-colors hover:text-red-300"
                            aria-label="Remove step"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-[180px,minmax(0,1fr)]">
                        <div className="ui-input-shell">
                          <select
                            value={step.kind}
                            onChange={(event) => {
                              const nextKind = event.target.value as WorkflowBlockKind;
                              setAutomationEditor((current) => {
                                if (!current) return current;
                                const steps = [...current.steps];
                                steps[index] = createWorkflowBlock(nextKind, { ...steps[index], kind: nextKind });
                                return { ...current, steps };
                              });
                            }}
                            className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                          >
                            {WORKFLOW_BLOCK_OPTIONS.map((option) => (
                              <option key={option.kind} value={option.kind} className="bg-slate-950 text-slate-100">
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <div className="ui-input-shell">
                            <input
                              value={step.title}
                              onChange={(event) => {
                                const value = event.target.value;
                                setAutomationEditor((current) => {
                                  if (!current) return current;
                                  const steps = [...current.steps];
                                  steps[index] = { ...steps[index], title: value };
                                  return { ...current, steps };
                                });
                              }}
                              className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                              placeholder="Step title"
                            />
                          </div>
                          <div className="ui-input-shell">
                            <input
                              value={step.objective}
                              onChange={(event) => updateAutomationStep(index, event.target.value)}
                              className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                              placeholder="What this step should do"
                            />
                          </div>
                          {step.kind === 'search' && (
                            <div className="ui-input-shell">
                              <input
                                value={typeof step.inputs?.query === 'string' ? step.inputs.query : ''}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setAutomationEditor((current) => {
                                    if (!current) return current;
                                    const steps = [...current.steps];
                                    steps[index] = {
                                      ...steps[index],
                                      inputs: {
                                        ...(steps[index].inputs || {}),
                                        query: value,
                                        num_results: 6,
                                      },
                                    };
                                    return { ...current, steps };
                                  });
                                }}
                                className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                placeholder="Search query"
                              />
                            </div>
                          )}
                          {step.kind === 'query' && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="ui-input-shell">
                                <select
                                  value={typeof step.inputs?.source === 'string' ? step.inputs.source : 'stripe'}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setAutomationEditor((current) => {
                                      if (!current) return current;
                                      const steps = [...current.steps];
                                      steps[index] = {
                                        ...steps[index],
                                        inputs: {
                                          ...(steps[index].inputs || {}),
                                          source: value,
                                        },
                                      };
                                      return { ...current, steps };
                                    });
                                  }}
                                  className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                >
                                  {['stripe', 'posthog', 'github', 'linear', 'notion', 'custom'].map((option) => (
                                    <option key={option} value={option} className="bg-slate-950 text-slate-100">
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="ui-input-shell">
                                <input
                                  value={typeof step.inputs?.query_type === 'string' ? step.inputs.query_type : ''}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setAutomationEditor((current) => {
                                      if (!current) return current;
                                      const steps = [...current.steps];
                                      steps[index] = {
                                        ...steps[index],
                                        inputs: {
                                          ...(steps[index].inputs || {}),
                                          query_type: value,
                                        },
                                      };
                                      return { ...current, steps };
                                    });
                                  }}
                                  className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                  placeholder="failed_payments"
                                />
                              </div>
                            </div>
                          )}
                          {step.kind === 'capture' && (
                            <div className="ui-input-shell">
                              <input
                                value={typeof step.inputs?.url === 'string' ? step.inputs.url : ''}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setAutomationEditor((current) => {
                                    if (!current) return current;
                                    const steps = [...current.steps];
                                    steps[index] = {
                                      ...steps[index],
                                      inputs: {
                                        ...(steps[index].inputs || {}),
                                        url: value,
                                      },
                                    };
                                    return { ...current, steps };
                                  });
                                }}
                                className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                placeholder="https://example.com"
                              />
                            </div>
                          )}
                          <p className="px-1 text-[11px] text-slate-500">
                            {WORKFLOW_BLOCK_OPTIONS.find((option) => option.kind === step.kind)?.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => appendAutomationStep()}
                    className="ui-button-ghost"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add step
                  </button>
                </div>
                <p className="mt-1 px-1 text-[11px] text-slate-500">Build the workflow one step at a time, then reorder or trim as needed.</p>
              </label>
              ) : (
                <label className="block">
                  <span className="ui-section-label px-1">Workflow brief</span>
                  <div className="ui-input-shell mt-1">
                    <textarea
                      value={automationEditor.workflowPrompt}
                      onChange={(event) => setAutomationEditor((current) => current ? { ...current, workflowPrompt: event.target.value } : current)}
                      rows={8}
                      className="w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-slate-100 outline-none"
                      placeholder={'Monitor Stripe failed payments every morning.\nIf there are any, summarize the issue patterns and send the result to Slack.\nKeep the report concise.'}
                    />
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-slate-500">
                    Write one instruction per line, or describe the workflow in plain language. Violema will turn it into a runnable plan.
                  </p>
                  <div className="mt-3 rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Planner preview</p>
                    <div className="mt-2 space-y-2">
                      {buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt).slice(0, 5).map((step, index) => (
                        <div key={`${step.id}-${index}`} className="rounded-xl border border-navy-700/70 bg-navy-950/45 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-medium text-white">{index + 1}. {step.title}</p>
                            <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-[10px] text-slate-300">
                              {step.kind}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{step.objective}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </label>
              )}
                </>
              )}

              {automationEditorSection === 'agents' && (
                <>
              <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/6 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Agent setup</p>
                <p className="mt-1 text-sm text-white">This is the lightweight policy view. Use the system recommendation by default. Go to Agent Studio for the full worker map, performance trends, and preset comparison.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Execution mode</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: 'recommended' as const, label: 'System recommended' },
                      { value: 'custom' as const, label: 'Custom policy' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAutomationEditor((current) => current ? {
                          ...current,
                          executionPolicy: {
                            ...current.executionPolicy,
                            mode: option.value,
                          },
                        } : current)}
                        className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                          automationEditor.executionPolicy.mode === option.value
                            ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                            : 'text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Optimization goal</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: 'balanced' as const, label: 'Balanced' },
                      { value: 'cost_saver' as const, label: 'Cost Saver' },
                      { value: 'quality_first' as const, label: 'Quality First' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAutomationEditor((current) => current ? {
                          ...current,
                          executionPolicy: {
                            ...current.executionPolicy,
                            mode: 'custom',
                            optimizationGoal: option.value,
                          },
                        } : current)}
                        className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                          automationEditor.executionPolicy.optimizationGoal === option.value
                            ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                            : 'text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Review policy</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { value: 'lean' as const, label: 'Lean' },
                      { value: 'standard' as const, label: 'Standard' },
                      { value: 'strict' as const, label: 'Strict' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAutomationEditor((current) => current ? {
                          ...current,
                          executionPolicy: {
                            ...current.executionPolicy,
                            mode: 'custom',
                            reviewPolicy: option.value,
                          },
                        } : current)}
                        className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                          automationEditor.executionPolicy.reviewPolicy === option.value
                            ? 'border-violet-500/30 bg-violet-500/12 text-violet-200'
                            : 'text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Elastic lane cap</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[0, 1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setAutomationEditor((current) => current ? {
                          ...current,
                          executionPolicy: {
                            ...current.executionPolicy,
                            mode: 'custom',
                            maxElasticLanes: count,
                          },
                        } : current)}
                        className={`ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal ${
                          automationEditor.executionPolicy.maxElasticLanes === count
                            ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200'
                            : 'text-slate-300'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Why this setup</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Math: {automationEditorPolicyMath.stepCount} workflow steps, {automationEditorPolicyMath.toolCalls} tool calls, lane demand {automationEditorPolicyMath.recommendedElasticLanes}. This keeps heavyweight reasoning on stronger models only when the run complexity justifies the extra spend.
                </p>
              </div>
                </>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Steps</p>
                  <p className="mt-1 text-lg font-semibold text-white">{automationActionCount}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Each block maps to a typed automation step at runtime.</p>
                </div>
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Per run</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {automationEstimate ? `${formatCredits(automationEstimate.estimatedCredits)} cr` : '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Estimate based on model tier, tools, and complexity.</p>
                </div>
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Monthly burn</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {automationEstimate ? `${formatCredits(automationEstimate.monthlyCredits)} cr` : '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Cadence-aware pressure against the current credit balance.</p>
                </div>
              </div>

              {automationEstimate && automationEstimate.monthlyCredits > 600 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">Budget pressure</p>
                  <p className="mt-1 text-sm text-white">This workflow is expensive relative to a normal workspace run rate.</p>
                  <p className="mt-1 text-[11px] text-amber-200/90">Reduce cadence, cut action count, or expect a top-up or upgrade prompt soon.</p>
                </div>
              )}
            </div>

            <div className="border-t border-navy-800/80 px-5 py-4">
              <div className="mb-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Control split</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      Workflow lives here. Agent policy, preset comparison, and worker tuning live in Agent Studio.
                    </p>
                  </div>
                  {automationEditor.mode === 'edit' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/agents?automation=${automationEditor.id}`)}
                      className="ui-pill shrink-0 px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200"
                    >
                      Open Agent Studio
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Create first, tune after
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={closeAutomationEditor}
                  className="ui-button-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleAutomationEditorSave(); }}
                  disabled={actionBusy === 'save' || !automationEditor.name.trim() || !automationEditor.schedule.trim() || !hasAutomationSteps}
                  className="ui-button-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionBusy === 'save' ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
