import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Settings from 'lucide-react/dist/esm/icons/settings.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import PanelLeftClose from 'lucide-react/dist/esm/icons/panel-left-close.js';
import PanelLeftOpen from 'lucide-react/dist/esm/icons/panel-left-open.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.js';
import Pin from 'lucide-react/dist/esm/icons/pin.js';
import Archive from 'lucide-react/dist/esm/icons/archive.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import Layers3 from 'lucide-react/dist/esm/icons/layers-3.js';
import ChatInterface from '../components/ChatInterface';
import { MissionWorkspacePanel } from '../features/missions/MissionWorkspacePanel';
import { MissionOverview } from '../features/missions/MissionOverview';
import { MissionBoard } from '../features/missions/MissionBoard';
import { MissionCalendar } from '../features/missions/MissionCalendar';
import { MissionMap } from '../features/missions/MissionMap';
import { MissionReviews } from '../features/missions/MissionReviews';
import { MissionAnalytics } from '../features/missions/MissionAnalytics';
import { MissionIntegrationsStrip } from '../features/missions/MissionIntegrationsStrip';
import { MissionArtifact } from '../features/missions/MissionArtifact';
import { MissionLessons } from '../features/missions/MissionLessons';
import { MissionCommandDashboard } from '../features/missions/MissionCommandDashboard';
import { MissionProgressRail } from '../features/missions/MissionProgressRail';
import { MissionDetailView } from '../features/missions/MissionDetailView';
import { MissionCreditDrawer } from '../features/missions/MissionCreditDrawer';
import { DashboardGuardian } from '../features/guardian/DimaDashboardGuardian';
import { DimaSidebarNote } from '../features/guardian/DimaSidebarNote';
import { WorkflowReadinessPanel, type WorkflowReadinessReport } from '../features/integrations/WorkflowReadinessPanel';
import {
  getDashboardReadinessBlockerAction,
  getSelectedRunLedgerId,
  getWorkflowReadinessDeliveryTarget,
  inferEditorWorkflowId,
} from '../features/integrations/workflowReadinessUi';
import { RunLedgerPanel, type WorkflowLedgerEvent } from '../features/missions/RunLedgerPanel';
import { WorkflowTemplateGallery } from '../features/templates/WorkflowTemplateGallery';
import { WORKFLOW_TEMPLATES, getWorkflowTemplateById } from '../content/workflowTemplates';
import { buildMissionWorkspaceView, type MissionSourceTask } from '../features/missions/missionPresenter';
import { mapMissionRecordToSourceTask, type MissionApiRecord } from '../features/missions/missionApi';
import {
  applyMissionAction,
  findMissionAction,
  getMissionActionsStorageKey,
  normalizeMissionActions,
  type MissionActionKind,
  type MissionActionRecord,
} from '../features/missions/missionActions';
import {
  WORKSPACE_AREAS,
  getWorkspaceArea,
  type WorkspaceAreaId,
  type WorkspaceTabId,
} from '../features/missions/workspaceShell';
import {
  getDefaultMissionSelection,
  isMissionSelectionAvailable,
  type MissionSelection,
} from '../features/missions/missionDetail';
import {
  buildSelectedMissionSearch,
  findTaskByMissionTarget,
  getMissionSelectionStorageKey,
  getMissionTargetFromSearch,
  getPreferredMissionTarget,
  resolveInitialSelectedTaskId,
  type MissionSelectableTask,
} from '../features/missions/missionSelectionState';
import { fetchCreditEstimate, formatCredits, getSuggestedUpgradePlanId, useCreditSnapshot } from '../lib/credits';
import { resolveWorkspaceContext } from '../lib/workspace';
import { getAuthSession, hasSlackConnection, isAdminSession } from '../lib/auth';
import ViolemaLogo from '../components/ViolemaLogo';
import type { Conversation, Message, AutonomyMode } from '../types';
import type { MissionLessonView, MissionWorkspaceTab } from '../features/missions/types';

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

function trimConversationText(value: string, limit: number) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function deriveConversationTitle(messages: Message[], fallback = 'New conversation') {
  const primary = messages.find((message) => message.role === 'user' && message.content.trim())
    ?? messages.find((message) => message.content.trim());
  const title = primary ? trimConversationText(primary.content, 45) : '';
  return title || fallback;
}

function deriveConversationLastMessage(messages: Message[]) {
  const latest = [...messages].reverse().find((message) => message.content.trim());
  return latest ? trimConversationText(latest.content, 72) : undefined;
}

function shouldUpgradeConversationTitle(currentTitle: string, candidateTitle: string) {
  const current = currentTitle.trim();
  const candidate = candidateTitle.trim();

  if (!candidate) return false;
  if (candidate.toLowerCase() === 'new conversation') return false;
  if (candidate.toLowerCase() === current.toLowerCase()) return false;

  const candidateWords = candidate.split(/\s+/).filter(Boolean);
  const candidateHasGoodLength = candidate.length >= 12 && candidate.length <= 45;
  const candidateIsMoreSpecific = candidateWords.length >= 3;
  const candidateIsMeaningfullyShorter = candidate.length + 6 < current.length;

  return candidateHasGoodLength && candidateIsMoreSpecific && candidateIsMeaningfullyShorter;
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
      title: c.title?.trim().toLowerCase() === 'new conversation'
        ? deriveConversationTitle(c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })))
        : c.title,
      lastMessage: c.lastMessage || deriveConversationLastMessage(c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))),
      pinned: Boolean(c.pinned),
      archived: Boolean(c.archived),
      tags: Array.isArray(c.tags) ? c.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      timestamp: new Date(c.timestamp),
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    })));
  } catch { return []; }
}

function loadMissionActions(workspaceId: string): MissionActionRecord[] {
  try {
    const raw = localStorage.getItem(getMissionActionsStorageKey(workspaceId));
    if (!raw) return [];
    return normalizeMissionActions(JSON.parse(raw));
  } catch {
    return [];
  }
}

function loadStoredMissionTarget(workspaceId: string) {
  try {
    return localStorage.getItem(getMissionSelectionStorageKey(workspaceId)) || undefined;
  } catch {
    return undefined;
  }
}

function saveStoredMissionTarget(workspaceId: string, task: MissionSelectableTask) {
  try {
    localStorage.setItem(getMissionSelectionStorageKey(workspaceId), getPreferredMissionTarget(task));
  } catch {
    // Keep the selection usable even when storage is unavailable.
  }
}

const SCHEDULE_PRESETS = [
  { label: 'Hourly', value: 'every hour' },
  { label: 'Every 4 hours', value: 'every 4 hours' },
  { label: 'Daily 9am', value: 'daily at 9am' },
  { label: 'Every Monday', value: 'every monday at 9am' },
];

type WorkflowBlockKind = 'search' | 'query' | 'capture' | 'analyze' | 'summarize' | 'deliver' | 'note';

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Sao_Paulo', label: 'Brasília (BRT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

const QUERY_TYPE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  stripe: [
    { value: 'revenue_summary', label: 'Revenue summary' },
    { value: 'failed_payments', label: 'Failed payments' },
    { value: 'new_customers', label: 'New customers' },
    { value: 'churn_events', label: 'Churn / cancellations' },
    { value: 'mrr_change', label: 'MRR change' },
    { value: 'subscription_status', label: 'Subscription status' },
  ],
  github: [
    { value: 'open_issues', label: 'Open issues' },
    { value: 'open_prs', label: 'Open pull requests' },
    { value: 'recent_commits', label: 'Recent commits' },
    { value: 'failing_checks', label: 'Failing CI checks' },
    { value: 'release_notes', label: 'Release notes' },
  ],
  linear: [
    { value: 'open_issues', label: 'Open issues' },
    { value: 'in_progress', label: 'In-progress issues' },
    { value: 'overdue', label: 'Overdue issues' },
    { value: 'recent_completions', label: 'Recently completed' },
    { value: 'cycle_status', label: 'Current cycle status' },
  ],
  posthog: [
    { value: 'active_users', label: 'Active users (DAU/WAU)' },
    { value: 'top_events', label: 'Top events' },
    { value: 'funnel_drop', label: 'Funnel drop-off' },
    { value: 'feature_flags', label: 'Feature flag status' },
    { value: 'error_rate', label: 'Error rate' },
  ],
  notion: [
    { value: 'database_rows', label: 'Database rows' },
    { value: 'recent_pages', label: 'Recently updated pages' },
    { value: 'tagged_items', label: 'Items by tag/status' },
  ],
  custom: [
    { value: 'custom', label: 'Custom query' },
  ],
};
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
  optional?: boolean;
}

type WorkflowDeliveryTargetDraft = NonNullable<WorkflowBlockDraft['deliveryTarget']>;

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

const AUTOMATION_EDITOR_SECTIONS = [
  {
    id: 'setup' as const,
    label: 'Setup',
    eyebrow: '01',
    description: 'Name, cadence, timezone, and delivery target.',
    Icon: Settings,
  },
  {
    id: 'workflow' as const,
    label: 'Workflow',
    eyebrow: '02',
    description: 'The actual instructions and runnable steps.',
    Icon: CheckSquare,
  },
  {
    id: 'agents' as const,
    label: 'Agent setup',
    eyebrow: '03',
    description: 'Cost, quality, review depth, and worker lanes.',
    Icon: Bot,
  },
];

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
  workflowId?: string;
  templateId?: string;
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
  preflight?: AutomationPreflightReport;
}

interface AutomationPreflightBlocker {
  key: string;
  label: string;
  detail: string;
  severity: 'blocking' | 'warning';
}

interface AutomationPreflightReport {
  ready: boolean;
  summary: string;
  blockers: AutomationPreflightBlocker[];
  warnings: AutomationPreflightBlocker[];
}

interface DashboardTaskItem {
  id: string | number;
  taskId?: string;
  taskRunId?: string;
  workflowId?: string;
  templateId?: string;
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
  preflight?: AutomationPreflightReport;
}

interface DashboardTaskArtifact {
  id?: string;
  kind: string;
  title: string;
  source?: string;
  summary?: string;
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
  workflowId?: string;
  templateId?: string;
  name: string;
  schedule: string;
  timezone: string;
  description: string;
  notify: string;
  condition: string;
  authoringMode: 'guided' | 'describe';
  workflowPrompt: string;
  steps: WorkflowBlockDraft[];
  executionPolicy: AutomationExecutionPolicyDraft;
  destinationType: 'slack' | 'email' | 'none';
}

function normalizeEditorDestinationTarget(value: string) {
  return value.trim();
}

function inferDeliveryTargetFromText(value: string): WorkflowDeliveryTargetDraft | null {
  const email = value.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  if (email) return { channel: 'email', target: email };

  const slack = value.match(/(^|[\s([{"'])#([a-z0-9][a-z0-9_-]{1,79})\b/i)?.[2];
  if (slack) return { channel: 'slack', target: `#${slack}` };

  return null;
}

function readWorkflowDeliveryTarget(step: WorkflowBlockDraft): WorkflowDeliveryTargetDraft | null {
  const explicitTarget = step.deliveryTarget?.target?.trim();
  if (step.deliveryTarget && explicitTarget) {
    return {
      channel: step.deliveryTarget.channel,
      target: explicitTarget,
    };
  }

  return inferDeliveryTargetFromText(`${step.objective} ${step.title}`);
}

function getEditorCanonicalDeliveryTarget(
  editor: AutomationEditorDraft,
  sourceSteps: WorkflowBlockDraft[],
): WorkflowDeliveryTargetDraft | null {
  if (editor.destinationType === 'none') return null;

  const stepTarget = sourceSteps
    .filter((step) => step.kind === 'deliver')
    .map(readWorkflowDeliveryTarget)
    .find((target): target is WorkflowDeliveryTargetDraft => Boolean(target?.target));

  if (stepTarget) return stepTarget;

  const target = normalizeEditorDestinationTarget(editor.notify);
  if (!target) return null;

  return {
    channel: editor.destinationType === 'email' || target.includes('@') ? 'email' : 'slack',
    target,
  };
}

function applyAutomationEditorDestination(
  editor: AutomationEditorDraft,
  destinationType: AutomationEditorDraft['destinationType'],
  notify: string,
): AutomationEditorDraft {
  const target = normalizeEditorDestinationTarget(notify);
  const deliveryTarget: WorkflowDeliveryTargetDraft | null = destinationType === 'none' || !target
    ? null
    : {
        channel: destinationType === 'email' ? 'email' : 'slack',
        target,
      };

  return {
    ...editor,
    destinationType,
    notify: destinationType === 'none' ? '' : target,
    steps: editor.steps.map((step) => step.kind === 'deliver'
      ? { ...step, deliveryTarget }
      : step),
  };
}

type ThreadFilter = 'all' | 'active' | 'pinned' | 'archived';

interface CreditEstimatePreview {
  estimatedCredits: number;
  monthlyCredits: number;
}

function buildLocalPreviewAutomationItems(): DashboardTaskItem[] {
  const nextRun = new Date();
  nextRun.setHours(9, 0, 0, 0);
  const daysUntilMonday = (8 - nextRun.getDay()) % 7;
  nextRun.setDate(nextRun.getDate() + (daysUntilMonday === 0 && nextRun.getTime() <= Date.now() ? 7 : daysUntilMonday));

  const lastRun = new Date(nextRun);
  lastRun.setDate(lastRun.getDate() - 7);
  lastRun.setMinutes(3);

  const lastRunAt = lastRun.toISOString();
  const nextRunAt = nextRun.toISOString();

  return [
    {
      id: 'preview-weekly-founder-update',
      automationId: 'preview-weekly-founder-update',
      workflowId: 'weekly-founder-brief',
      templateId: 'weekly-founder-brief',
      title: 'Weekly founder update',
      status: 'complete',
      time: 'Every Monday at 9am',
      icon: CheckSquare,
      description: 'Collect Stripe, GitHub, and market signals, synthesize the operator brief, then hold delivery for founder review.',
      authoringMode: 'guided',
      workflowPrompt: [
        'Query Stripe revenue, churn, and failed-payment movement.',
        'Query GitHub open issues and recently merged work.',
        'Search competitor pricing and product moves this week.',
        'Analyze the signal and identify founder-level decisions.',
        'Generate the weekly founder update.',
        'Deliver latest result to #all-purple-orange after review.',
      ].join('\n'),
      source: 'sample',
      modelTier: 'balanced',
      modelSource: 'Violema routing',
      agentRole: 'operator_manager',
      runStatus: 'waiting_review',
      schedule: 'Every Monday at 9am',
      notify: '#all-purple-orange',
      condition: 'Only deliver after the evidence trail and summary are reviewed.',
      actions: [
        'Query Stripe revenue movement',
        'Query GitHub open issues and merged work',
        'Search competitor pricing changes',
        'Analyze founder-level risks and opportunities',
        'Generate the weekly founder update',
        'Deliver latest result to #all-purple-orange after review',
      ],
      steps: [
        {
          id: 'preview-step-stripe',
          kind: 'query',
          title: 'Query Stripe revenue movement',
          objective: 'Pull revenue, churn, expansion, and failed-payment signals.',
          inputs: { source: 'stripe', query_type: 'revenue_summary' },
        },
        {
          id: 'preview-step-github',
          kind: 'query',
          title: 'Query GitHub workstream',
          objective: 'Summarize open issues, recently merged work, and release blockers.',
          inputs: { source: 'github', query_type: 'open_issues' },
        },
        {
          id: 'preview-step-market',
          kind: 'search',
          title: 'Search competitor moves',
          objective: 'Find pricing, launch, and positioning changes relevant to founders.',
          inputs: { query: 'AI agent workflow competitors pricing product launch this week', num_results: 8 },
        },
        {
          id: 'preview-step-brief',
          kind: 'summarize',
          title: 'Generate founder brief',
          objective: 'Turn the evidence into a concise update with risks, decisions, and next actions.',
        },
        {
          id: 'preview-step-deliver',
          kind: 'deliver',
          title: 'Hold for approval and deliver',
          objective: 'Send the reviewed update to the founder channel.',
          deliveryTarget: { channel: 'slack', target: '#all-purple-orange' },
        },
      ],
      executionPolicy: { ...DEFAULT_EXECUTION_POLICY },
      automationStatus: 'active',
      timezone: getLocalTimeZone(),
      lastRunAt,
      lastRunStatus: 'succeeded',
      nextRunAt,
      latestSummary: 'Revenue is steady, one GitHub blocker needs owner attention, and two competitor pricing shifts are worth watching before the next campaign.',
      latestArtifacts: [
        {
          id: 'preview-artifact-founder-update',
          kind: 'brief',
          title: 'Weekly founder update',
          source: 'Mission artifact',
          summary: 'Founder-ready brief with revenue movement, product blockers, competitor changes, and recommended next actions.',
          payload: {
            markdown: 'Revenue grew 18% WoW, churn stayed flat, and expansion seats are driving most of the movement. GitHub shows one release blocker and two ready-to-ship fixes. Competitor pricing shifted upward on implementation support, which creates room to emphasize reviewable operations.',
            links: [
              { title: 'Stripe revenue summary', href: 'https://stripe.com' },
              { title: 'GitHub issues', href: 'https://github.com' },
              { title: 'Competitor pricing scan', href: 'https://www.gumloop.com' },
            ],
          },
        },
      ],
      latestStepExecutions: [
        {
          stepId: 'preview-step-stripe',
          kind: 'query',
          title: 'Stripe revenue movement',
          assignedRole: 'finance_checker',
          status: 'succeeded',
          summary: 'Revenue up 18% WoW with stable churn and stronger expansion seats.',
          modelTier: 'fast',
          modelSource: 'Stripe',
          actualCredits: 18,
          toolCalls: 1,
          artifactCount: 1,
          durationMs: 38000,
          tokenUsage: { inputTokens: 2100, outputTokens: 620, totalTokens: 2720 },
          output: { query: 'revenue_summary', resultCount: 18 },
        },
        {
          stepId: 'preview-step-github',
          kind: 'query',
          title: 'GitHub workstream',
          assignedRole: 'build_monitor',
          status: 'succeeded',
          summary: 'One release blocker needs owner attention; two fixes are ready to merge.',
          modelTier: 'fast',
          modelSource: 'GitHub',
          actualCredits: 14,
          toolCalls: 1,
          durationMs: 29000,
          tokenUsage: { inputTokens: 1640, outputTokens: 410, totalTokens: 2050 },
          output: { query: 'open_issues', resultCount: 7 },
        },
        {
          stepId: 'preview-step-market',
          kind: 'search',
          title: 'Competitor pricing scan',
          assignedRole: 'market_researcher',
          status: 'succeeded',
          summary: 'Two competitors moved implementation support into higher-paid tiers.',
          modelTier: 'balanced',
          modelSource: 'Web search',
          actualCredits: 24,
          toolCalls: 3,
          durationMs: 72000,
          tokenUsage: { inputTokens: 4300, outputTokens: 980, totalTokens: 5280 },
          output: { query: 'AI workflow pricing changes', resultCount: 12 },
        },
        {
          stepId: 'preview-step-brief',
          kind: 'summarize',
          title: 'Founder brief synthesis',
          assignedRole: 'brief_writer',
          status: 'waiting_review',
          summary: 'Draft is ready with revenue, build, market, and next-action sections.',
          modelTier: 'balanced',
          modelSource: 'Violema',
          actualCredits: 28,
          toolCalls: 0,
          artifactCount: 1,
          durationMs: 64000,
          tokenUsage: { inputTokens: 5200, outputTokens: 1260, totalTokens: 6460 },
          output: { markdown: 'Draft founder update is ready for review.' },
        },
        {
          stepId: 'preview-step-deliver',
          kind: 'deliver',
          title: 'Deliver to #all-purple-orange',
          assignedRole: 'slack_messenger',
          status: 'planned',
          summary: 'Waiting for review approval before delivery.',
          modelTier: 'fast',
          modelSource: 'Slack',
          actualCredits: 0,
          toolCalls: 0,
        },
      ],
      workerTopology: {
        version: 'preview',
        primaryRole: 'operator_manager',
        primaryBand: 'balanced',
        summary: 'One manager coordinates finance, build, research, writing, and delivery roles; delivery is gated until review.',
        workers: [
          {
            role: 'operator_manager',
            label: 'Operator Manager',
            laneType: 'core',
            assignedRole: 'operator_manager',
            band: 'balanced',
            modelLabel: 'Balanced',
            status: 'active',
            summary: 'Owns the mission plan and review state.',
            reason: 'Keeps the whole workflow accountable.',
          },
          {
            role: 'finance_checker',
            label: 'Finance Checker',
            laneType: 'core',
            assignedRole: 'finance_checker',
            band: 'fast',
            modelLabel: 'Fast',
            status: 'active',
            summary: 'Reads revenue and churn signals.',
            reason: 'Stripe data drives founder priorities.',
          },
          {
            role: 'market_researcher',
            label: 'Market Researcher',
            laneType: 'elastic',
            assignedRole: 'market_researcher',
            band: 'balanced',
            modelLabel: 'Balanced',
            status: 'active',
            summary: 'Scans competitor changes.',
            reason: 'External motion changes what matters in the brief.',
          },
          {
            role: 'brief_writer',
            label: 'Brief Writer',
            laneType: 'core',
            assignedRole: 'brief_writer',
            band: 'balanced',
            modelLabel: 'Balanced',
            status: 'active',
            summary: 'Turns evidence into a reviewable artifact.',
            reason: 'Founder work needs a useful output, not raw logs.',
          },
          {
            role: 'slack_messenger',
            label: 'Slack Messenger',
            laneType: 'core',
            assignedRole: 'slack_messenger',
            band: 'fast',
            modelLabel: 'Fast',
            status: 'standby',
            summary: 'Delivers after approval.',
            reason: 'Delivery should not run before trust is cleared.',
          },
        ],
      },
      taskUpdatedAt: lastRunAt,
      actualCredits: 84,
      estimatedCredits: 96,
    },
  ];
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

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
  return readString(payload?.error) || readString(payload?.message) || fallback;
}

function isLikelySlackTarget(value: string) {
  const target = value.trim();
  if (!target) return true;
  if (/^[CGD][A-Z0-9]{8,}$/i.test(target)) return true;
  return /^#?[a-z0-9][a-z0-9_-]{1,79}$/i.test(target);
}

function readArtifacts(value: unknown): DashboardTaskArtifact[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = readString(item.id);
      const title = readString(item.title);
      const kind = readString(item.kind);
      const source = readString(item.source);
      const summary = readString(item.summary) || readString(item.detail);
      const payload = isRecord(item.payload) ? item.payload : {};
      if (!title || !kind) return null;
      const artifact: DashboardTaskArtifact = { title, kind, payload };
      if (id) artifact.id = id;
      if (source) artifact.source = source;
      if (summary) artifact.summary = summary;
      return artifact;
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
    const charge = isRecord(item.charge) ? item.charge : undefined;
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
      actualCredits: typeof item.actualCredits === 'number'
        ? item.actualCredits
        : typeof charge?.actualCredits === 'number'
          ? charge.actualCredits
          : undefined,
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
      charge: charge
        ? {
            actualCredits: typeof charge.actualCredits === 'number' ? charge.actualCredits : 0,
            tokenCredits: typeof charge.tokenCredits === 'number' ? charge.tokenCredits : 0,
            toolCredits: typeof charge.toolCredits === 'number' ? charge.toolCredits : 0,
            artifactCredits: typeof charge.artifactCredits === 'number' ? charge.artifactCredits : 0,
            durationCredits: typeof charge.durationCredits === 'number' ? charge.durationCredits : 0,
            complexityCredits: typeof charge.complexityCredits === 'number' ? charge.complexityCredits : 0,
            baseCredits: typeof charge.baseCredits === 'number' ? charge.baseCredits : 0,
            rationale: Array.isArray(charge.rationale)
              ? charge.rationale.filter((entry): entry is string => typeof entry === 'string')
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
  const [missionActions, setMissionActions] = useState<MissionActionRecord[]>(() =>
    loadMissionActions(resolveWorkspaceContext().workspaceId)
  );
  const [activeConvoId, setActiveConvoId] = useState<string>('new');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [taskPanelOpen, setTaskPanelOpen] = useState(false); // hidden by default on mobile feel
  const [missionWorkspaceOpen, setMissionWorkspaceOpen] = useState(false);
  const [missionWorkspaceTab, setMissionWorkspaceTab] = useState<MissionWorkspaceTab>('mission');
  const [workspaceArea, setWorkspaceArea] = useState<WorkspaceAreaId>('home');
  const [workspaceTabs, setWorkspaceTabs] = useState<Record<WorkspaceAreaId, WorkspaceTabId>>(() => {
    const initialTabs = {} as Record<WorkspaceAreaId, WorkspaceTabId>;
    WORKSPACE_AREAS.forEach((area) => {
      initialTabs[area.id] = area.defaultTab;
    });
    return initialTabs;
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | number>('');
  const [missionSelection, setMissionSelection] = useState<MissionSelection | null>(null);
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);
  const [creditDrawerOpen, setCreditDrawerOpen] = useState(false);
  const [newConvoMessages, setNewConvoMessages] = useState<Message[]>([]);
  const [hoveredConvoId, setHoveredConvoId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('cautious');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
  const [platformTasks, setPlatformTasks] = useState<DashboardTaskItem[]>([]);
  const [liveAutomations, setLiveAutomations] = useState<DashboardTaskItem[]>([]);
  const [missionSourceTasks, setMissionSourceTasks] = useState<MissionSourceTask[]>([]);
  const [taskPanelLoaded, setTaskPanelLoaded] = useState(false);
  const [taskPanelRefreshing, setTaskPanelRefreshing] = useState(false);
  const [uiNotice, setUiNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [actionBusy, setActionBusy] = useState<'run' | 'pause' | 'edit' | 'save' | 'delete' | 'grant' | 'review-approve' | 'review-change' | 'review-rerun' | null>(null);
  const [automationEditor, setAutomationEditor] = useState<AutomationEditorDraft | null>(null);
  const [automationEditorError, setAutomationEditorError] = useState<string | null>(null);
  const [automationEditorSection, setAutomationEditorSection] = useState<AutomationEditorSection>('setup');
  const [automationSetupOptionalOpen, setAutomationSetupOptionalOpen] = useState(false);
  const [automationEstimate, setAutomationEstimate] = useState<CreditEstimatePreview | null>(null);
  const [workflowReadiness, setWorkflowReadiness] = useState<WorkflowReadinessReport | null>(null);
  const [runLedgerEvents, setRunLedgerEvents] = useState<WorkflowLedgerEvent[]>([]);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { snapshot, refresh: refreshCredits } = useCreditSnapshot();
  const authSession = getAuthSession();
  const canLoadTestCredits = isAdminSession(authSession);

  const activeMode = MODE_BUTTONS.find((m) => m.mode === autonomyMode)!;
  const activeWorkspaceArea = getWorkspaceArea(workspaceArea);
  const activeWorkspaceTab = workspaceTabs[workspaceArea] || activeWorkspaceArea.defaultTab;
  const activeWorkspaceTabElementId = `workspace-tab-${workspaceArea}-${activeWorkspaceTab}`;
  const activeWorkspacePanelId = `workspace-panel-${workspaceArea}`;
  const isLocalDashboardPreview = location.pathname === '/dashboard-preview';

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
      localStorage.setItem(getMissionActionsStorageKey(workspace.workspaceId), JSON.stringify(missionActions));
    } catch {
      // ignore localStorage failures
    }
  }, [missionActions, workspace.workspaceId]);

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

  useEffect(() => {
    if (!missionWorkspaceOpen || !isMobileSidebar) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMissionWorkspaceOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isMobileSidebar, missionWorkspaceOpen]);

  const setHomeChatTab = useCallback(() => {
    setWorkspaceArea('home');
    setWorkspaceTabs((current) => ({ ...current, home: 'chat' }));
  }, []);

  const openHomeChat = useCallback(() => {
    setHomeChatTab();
    setMissionWorkspaceOpen(false);
    setTaskPanelOpen(false);
    if (isMobileSidebar) setSidebarOpen(false);
  }, [isMobileSidebar, setHomeChatTab]);

  const handleNewChat = useCallback(() => {
    openHomeChat();
    setActiveConvoId('new');
    setNewConvoMessages([]);
    setSearchQuery('');
  }, [openHomeChat]);

  const selectWorkspaceArea = useCallback((areaId: WorkspaceAreaId) => {
    setWorkspaceArea(areaId);
    setWorkspaceTabs((current) => ({
      ...current,
      [areaId]: current[areaId] || getWorkspaceArea(areaId).defaultTab,
    }));
    setTaskPanelOpen(false);
    if (areaId !== 'home') {
      setMissionWorkspaceOpen(false);
    }
    if (isMobileSidebar) setSidebarOpen(false);
  }, [isMobileSidebar]);

  const selectWorkspaceTab = useCallback((tabId: WorkspaceTabId) => {
    setWorkspaceTabs((current) => ({
      ...current,
      [workspaceArea]: tabId,
    }));
  }, [workspaceArea]);

  const openWorkspaceTarget = useCallback((areaId: WorkspaceAreaId, tabId?: WorkspaceTabId) => {
    setWorkspaceArea(areaId);
    setWorkspaceTabs((current) => ({
      ...current,
      [areaId]: tabId || current[areaId] || getWorkspaceArea(areaId).defaultTab,
    }));
    setTaskPanelOpen(false);
    setMissionWorkspaceOpen(false);
    if (isMobileSidebar) setSidebarOpen(false);
  }, [isMobileSidebar]);

  const selectDashboardTask = useCallback((taskId: string | number, task?: MissionSelectableTask) => {
    setSelectedTaskId(taskId);
    setMissionSelection(null);
    setSelectedCalendarItemId(null);
    setCreditDrawerOpen(false);

    if (!task) return;

    const nextSearch = buildSelectedMissionSearch(location.search, task);
    if (nextSearch !== location.search) {
      navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const openMissionDetail = useCallback((selection?: MissionSelection) => {
    if (selection) {
      setMissionSelection(selection);
    }
    openWorkspaceTarget('missions', 'overview');
  }, [openWorkspaceTarget]);

  const openMissionInspector = useCallback((tab: MissionWorkspaceTab = 'mission') => {
    setMissionWorkspaceTab(tab);
    setMissionWorkspaceOpen(true);
    setTaskPanelOpen(false);
  }, []);

  const openConversation = useCallback((conversationId: string) => {
    openHomeChat();
    setActiveConvoId(conversationId);
  }, [openHomeChat]);

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
    const [missionPayload, automationPayload, taskPayload, runPayload] = await Promise.all([
      fetch(`/api/missions?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, {
        headers,
        signal,
      }).then((res) => (res.ok ? res.json() : { items: [] })).catch(() => ({ items: [] })),
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

    const missionRecords = Array.isArray(missionPayload?.items) ? missionPayload.items as MissionApiRecord[] : [];
    const automations = Array.isArray(automationPayload?.items) ? automationPayload.items as AutomationApiRecord[] : [];
    const tasks = Array.isArray(taskPayload?.items) ? taskPayload.items as PlatformTaskRecord[] : [];
    const runs = Array.isArray(runPayload?.items) ? runPayload.items as PlatformTaskRunRecord[] : [];
    setMissionSourceTasks(missionRecords.map(mapMissionRecordToSourceTask));
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
          workflowId: automation.workflowId,
          templateId: automation.templateId,
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
          preflight: automation.preflight,
        };
      });

    const previewItems = isLocalDashboardPreview ? buildLocalPreviewAutomationItems() : [];
    const visibleAutomationItems = automationItems.length > 0 ? automationItems : previewItems;
    const storedMissionTarget = loadStoredMissionTarget(workspace.workspaceId);
    const currentMissionSearch = typeof window !== 'undefined' ? window.location.search : '';

    if (visibleAutomationItems.length > 0) {
      setLiveAutomations(visibleAutomationItems);
      setSelectedTaskId((current) =>
        current || resolveInitialSelectedTaskId(visibleAutomationItems, {
          search: currentMissionSearch,
          storedTaskId: storedMissionTarget,
        })
      );
    } else {
      setLiveAutomations([]);
    }

    if (liveTasks.length > 0) {
      setPlatformTasks(liveTasks);
    } else {
      setPlatformTasks([]);
    }
    setTaskPanelLoaded(true);
  }, [isLocalDashboardPreview]);

  useEffect(() => {
    const controller = new AbortController();
    loadTaskPanelData(controller.signal)
      .catch(() => {
        const previewItems = isLocalDashboardPreview ? buildLocalPreviewAutomationItems() : [];
        setMissionSourceTasks([]);
        setLiveAutomations(previewItems);
        if (previewItems[0]) {
          setSelectedTaskId((current) =>
            current || resolveInitialSelectedTaskId(previewItems, {
              search: typeof window !== 'undefined' ? window.location.search : '',
              storedTaskId: loadStoredMissionTarget(workspace.workspaceId),
            })
          );
        }
        setPlatformTasks([]);
        setTaskPanelLoaded(true);
      });

    return () => controller.abort();
  }, [isLocalDashboardPreview, loadTaskPanelData, workspace.workspaceId]);

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

  const taskDataActive = taskPanelOpen || missionWorkspaceOpen || workspaceArea !== 'home' || activeWorkspaceTab === 'activity';

  useEffect(() => {
    if (!taskDataActive) return;
    void refreshTaskPanel({ silent: true }).catch(() => {});
  }, [taskDataActive, refreshTaskPanel]);

  useEffect(() => {
    if (!taskDataActive) return undefined;

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
  }, [handleTaskPanelStreamMessage, taskDataActive, workspace.workspaceId, workspace.workspaceName]);

  const hasRunningAutomation = useMemo(
    () => liveAutomations.some((task) => task.runStatus === 'running'),
    [liveAutomations]
  );

  useEffect(() => {
    if (!taskDataActive) return undefined;

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
  }, [hasRunningAutomation, taskDataActive, refreshTaskPanel]);

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

  const handleAutomationEdit = useCallback(async (
    task: DashboardTaskItem | undefined,
    initialSection: AutomationEditorSection = 'setup',
  ) => {
    if (!task?.automationId) return;
    const nextSteps = Array.isArray(task.steps) && task.steps.length > 0
      ? task.steps.map((step) => createWorkflowBlock(step.kind, step))
      : Array.isArray(task.actions) && task.actions.length > 0
        ? task.actions.map((action) => parseLegacyActionToWorkflowBlock(action))
        : [createWorkflowBlock('summarize')];
    setAutomationEditorSection(initialSection);
    setAutomationSetupOptionalOpen(Boolean(task.description || task.condition));
    setAutomationEditor({
      mode: 'edit',
      id: task.automationId,
      workflowId: task.workflowId,
      templateId: task.templateId,
      name: task.title,
      schedule: task.schedule || task.time,
      timezone: task.timezone || getLocalTimeZone(),
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
              ? 'slack'
              : 'none',
    });
    setAutomationEditorError(null);
  }, []);

  const handleAutomationCreate = useCallback(() => {
    setAutomationEditorSection('setup');
    setAutomationSetupOptionalOpen(false);
    setAutomationEditorError(null);
    setAutomationEditor({
      mode: 'create',
      id: `draft-${Date.now()}`,
      workflowId: undefined,
      templateId: undefined,
      name: '',
      schedule: 'every monday at 9am',
      timezone: getLocalTimeZone(),
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

  const applyFounderWorkflowTemplate = useCallback((templateId: string) => {
    const template = getWorkflowTemplateById(templateId);
    if (!template) return;

    setAutomationEditorSection('workflow');
    setAutomationSetupOptionalOpen(false);
    setAutomationEditorError(null);
    setAutomationEditor((current) => {
      const timezone = current?.timezone || getLocalTimeZone();
      const steps = template.steps.map((step, index) =>
        createWorkflowBlock(step.kind, {
          ...step,
          id: `${template.id}-step-${index + 1}`,
          deliveryTarget: step.kind === 'deliver'
            ? step.deliveryTarget || (template.notify
              ? { channel: template.destination === 'email' ? 'email' : 'slack', target: template.notify }
              : null)
            : step.deliveryTarget || null,
        })
      );

      return {
        mode: 'create',
        id: current?.id || `draft-${Date.now()}`,
        workflowId: template.id,
        templateId: template.id,
        name: template.title,
        schedule: template.cadence,
        timezone,
        description: template.description,
        notify: template.notify,
        condition: current?.condition || '',
        authoringMode: 'guided',
        workflowPrompt: buildWorkflowPromptFromBlocks(steps),
        steps,
        executionPolicy: current?.executionPolicy || { ...DEFAULT_EXECUTION_POLICY },
        destinationType: template.destination,
      };
    });
  }, []);

  const closeAutomationEditor = useCallback(() => {
    setAutomationEditor(null);
    setAutomationEditorError(null);
    setAutomationEditorSection('setup');
    setAutomationSetupOptionalOpen(false);
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

  const getReadinessBlockerAction = useCallback((blocker: { key: string; route?: string }) => {
    const action = getDashboardReadinessBlockerAction(blocker);
    if (!action) return null;

    if (action.kind === 'navigate') {
      return {
        label: action.label,
        onClick: () => {
          closeAutomationEditor();
          navigate(action.href);
        },
      };
    }

    return {
      label: action.label,
      onClick: () => {
        setAutomationEditorSection(action.section);
      },
    };
  }, [closeAutomationEditor, navigate]);

  const pendingRunAfterSave = useRef(false);

  const handleAutomationEditorSave = useCallback(async () => {
    if (!automationEditor) return;
    const shouldRun = pendingRunAfterSave.current;
    pendingRunAfterSave.current = false;
    setActionBusy('save');
    setAutomationEditorError(null);
    try {
      const sourceSteps = automationEditor.authoringMode === 'describe'
        ? buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt)
        : automationEditor.steps;
      const deliveryTarget = getEditorCanonicalDeliveryTarget(automationEditor, sourceSteps);
      const notifyTarget = deliveryTarget?.target || '';
      const steps = sourceSteps
        .map((step) => ({
          ...step,
          title: step.title.trim(),
          objective: step.objective.trim(),
          deliveryTarget: step.kind === 'deliver'
            ? (readWorkflowDeliveryTarget(step) || deliveryTarget)
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
          timezone: automationEditor.timezone || getLocalTimeZone(),
          description: automationEditor.description.trim() || null,
          authoringMode: automationEditor.authoringMode,
          workflowPrompt: automationEditor.workflowPrompt.trim() || null,
          workflowId: automationEditor.workflowId || null,
          templateId: automationEditor.templateId || null,
          notify: notifyTarget || null,
          condition: automationEditor.condition.trim() || null,
          steps,
          actions,
          executionPolicy: automationEditor.executionPolicy,
        }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not save automation'));
      }
      const payload = await response.json() as { item?: { id?: string } };
      await refreshAutomations();
      const savedId = automationEditor.mode === 'create' ? (payload.item?.id as string | undefined) : automationEditor.id;
      if (automationEditor.mode === 'create' && savedId) {
        setSelectedTaskId(savedId);
      }
      closeAutomationEditor();
      if (shouldRun && savedId) {
        try {
          const runResponse = await fetch(`/api/automations/${savedId}/run`, { method: 'POST' });
          if (!runResponse.ok) {
            throw new Error(await readApiError(runResponse, 'Could not start run'));
          }
          showNotice('success', `Saved and started "${automationEditor.name.trim() || 'automation'}"`);
        } catch (error) {
          showNotice('error', `Saved "${automationEditor.name.trim() || 'automation'}" — ${error instanceof Error ? error.message : 'could not start run'}`);
        }
      } else {
        showNotice('success', `${automationEditor.mode === 'create' ? 'Created' : 'Updated'} "${automationEditor.name.trim() || 'automation'}"`);
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : automationEditor.mode === 'create'
          ? 'Could not create automation'
          : 'Could not save automation changes';
      setAutomationEditorError(message);
      if (/slack|message target|email/i.test(message)) {
        setAutomationEditorSection('setup');
      }
      showNotice('error', message);
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
          const fallbackTitle = deriveConversationTitle(messages);
          const newId = `conv-${Date.now()}`;

          const newConvo: Conversation = {
            id: newId,
            title: fallbackTitle,
            lastMessage: deriveConversationLastMessage(messages),
            timestamp: new Date(),
            messages,
          };
          setConversations((prev) => [newConvo, ...prev]);
          setActiveConvoId(newId);

          // Upgrade title async via Haiku (cheap model)
          fetchSmartTitle(apiMessages).then((smartTitle) => {
            const upgradedTitle = trimConversationText(smartTitle, 45);
            if (!shouldUpgradeConversationTitle(fallbackTitle, upgradedTitle)) return;
            setConversations((prev) =>
              prev.map((c) => (c.id === newId ? { ...c, title: upgradedTitle } : c))
            );
          });
        }
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvoId
              ? {
                  ...c,
                  title: c.title.trim().toLowerCase() === 'new conversation'
                    ? deriveConversationTitle(messages)
                    : c.title,
                  messages,
                  lastMessage: deriveConversationLastMessage(messages),
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
  useEffect(() => {
    if (!selectedTask) return;
    saveStoredMissionTarget(workspace.workspaceId, selectedTask);
  }, [selectedTask, workspace.workspaceId]);

  const selectedMissionSource = useMemo(() => {
    if (!selectedTask) return missionSourceTasks[0];

    return missionSourceTasks.find((mission) =>
      mission.automationId === selectedTask.automationId ||
      mission.automationId === String(selectedTask.id) ||
      mission.taskId === selectedTask.taskId ||
      mission.taskRunId === selectedTask.taskRunId ||
      mission.id === selectedTask.id
    ) || selectedTask;
  }, [missionSourceTasks, selectedTask]);
  const selectedMission = useMemo(
    () => buildMissionWorkspaceView(selectedMissionSource),
    [selectedMissionSource],
  );
  const selectedReviewTarget = useMemo(() => ({
    automationId: selectedMission.automationId || selectedTask?.automationId,
    taskRunId: selectedMission.taskRunId || selectedTask?.taskRunId,
  }), [selectedMission.automationId, selectedMission.taskRunId, selectedTask?.automationId, selectedTask?.taskRunId]);
  useEffect(() => {
    const runId = getSelectedRunLedgerId({
      selectedTaskRunId: selectedTask?.taskRunId,
      selectedMissionTaskRunId: selectedMission.taskRunId,
    });
    if (!runId) {
      setRunLedgerEvents([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ workspaceId: workspace.workspaceId });
    fetch(`/api/workflows/runs/${runId}/ledger?${params.toString()}`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load run ledger');
        return response.json();
      })
      .then((payload) => {
        setRunLedgerEvents(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRunLedgerEvents([]);
      });

    return () => controller.abort();
  }, [selectedTask?.taskRunId, selectedMission.taskRunId, workspace.workspaceId]);
  const activeMissionSelection = useMemo<MissionSelection>(() => {
    if (isMissionSelectionAvailable(selectedMission, missionSelection)) {
      return missionSelection as MissionSelection;
    }
    return getDefaultMissionSelection(selectedMission);
  }, [missionSelection, selectedMission]);
  const selectedBoardStepId = activeMissionSelection.kind === 'step' ? activeMissionSelection.id : undefined;
  const selectedBoardEvidenceId = activeMissionSelection.kind === 'evidence' ? activeMissionSelection.id : undefined;
  const selectedAgendaId = activeMissionSelection.kind === 'calendar'
    ? activeMissionSelection.id
    : selectedCalendarItemId || undefined;
  useEffect(() => {
    setMissionSelection((current) => (
      isMissionSelectionAvailable(selectedMission, current) ? current : null
    ));
    setSelectedCalendarItemId(null);
  }, [selectedMission.id]);
  const reviewerLabel = authSession?.email || authSession?.name || 'Violema reviewer';
  const handleReviewApprove = useCallback(async () => {
    if (!selectedReviewTarget.automationId || !selectedReviewTarget.taskRunId) {
      showNotice('error', 'No reviewable run is selected.');
      return;
    }
    setActionBusy('review-approve');
    try {
      const response = await fetch(
        `/api/automations/${selectedReviewTarget.automationId}/reviews/${selectedReviewTarget.taskRunId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': workspace.workspaceId,
            'X-Workspace-Name': workspace.workspaceName,
          },
          body: JSON.stringify({ reviewer: reviewerLabel }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response, 'Could not approve delivery'));
      await refreshAutomations();
      showNotice('success', 'Approved and delivered.');
    } catch (error) {
      await refreshAutomations();
      showNotice('error', error instanceof Error ? error.message : 'Could not approve delivery');
    } finally {
      setActionBusy(null);
    }
  }, [refreshAutomations, reviewerLabel, selectedReviewTarget.automationId, selectedReviewTarget.taskRunId, showNotice, workspace.workspaceId, workspace.workspaceName]);
  const handleReviewRequestChanges = useCallback(async () => {
    if (!selectedReviewTarget.automationId || !selectedReviewTarget.taskRunId) {
      showNotice('error', 'No reviewable run is selected.');
      return;
    }
    const note = window.prompt('What should Violema change before delivery?');
    if (!note?.trim()) return;
    setActionBusy('review-change');
    try {
      const response = await fetch(
        `/api/automations/${selectedReviewTarget.automationId}/reviews/${selectedReviewTarget.taskRunId}/request-changes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': workspace.workspaceId,
            'X-Workspace-Name': workspace.workspaceName,
          },
          body: JSON.stringify({ reviewer: reviewerLabel, note }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response, 'Could not request changes'));
      await refreshAutomations();
      showNotice('success', 'Change request saved.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Could not request changes');
    } finally {
      setActionBusy(null);
    }
  }, [refreshAutomations, reviewerLabel, selectedReviewTarget.automationId, selectedReviewTarget.taskRunId, showNotice, workspace.workspaceId, workspace.workspaceName]);
  const handleReviewRerun = useCallback(async () => {
    if (!selectedReviewTarget.automationId || !selectedReviewTarget.taskRunId) {
      showNotice('error', 'No reviewable run is selected.');
      return;
    }
    setActionBusy('review-rerun');
    try {
      const response = await fetch(
        `/api/automations/${selectedReviewTarget.automationId}/reviews/${selectedReviewTarget.taskRunId}/rerun`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': workspace.workspaceId,
            'X-Workspace-Name': workspace.workspaceName,
          },
          body: JSON.stringify({ reviewer: reviewerLabel }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response, 'Could not rerun mission'));
      await refreshAutomations();
      showNotice('success', 'Fresh run requested.');
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Could not rerun mission');
    } finally {
      setActionBusy(null);
    }
  }, [refreshAutomations, reviewerLabel, selectedReviewTarget.automationId, selectedReviewTarget.taskRunId, showNotice, workspace.workspaceId, workspace.workspaceName]);
  const selectedArtifactActionKind: MissionActionKind =
    selectedMission.status === 'waiting_review' ? 'artifact_reviewed' : 'artifact_opened';
  const selectedArtifactTargetId = useMemo(() => {
    const artifact = selectedTask?.latestArtifacts?.[0];
    return String(artifact?.id || artifact?.title || selectedMission.id);
  }, [selectedMission.id, selectedTask?.latestArtifacts]);
  const selectedArtifactAction = useMemo(
    () => findMissionAction(missionActions, {
      workspaceId: workspace.workspaceId,
      missionId: selectedMission.id,
      kind: selectedArtifactActionKind,
      targetId: selectedArtifactTargetId,
    }),
    [missionActions, selectedArtifactActionKind, selectedArtifactTargetId, selectedMission.id, workspace.workspaceId],
  );
  const savedMissionLessonIds = useMemo(
    () => new Set(
      missionActions
        .filter((action) =>
          action.workspaceId === workspace.workspaceId &&
          action.missionId === selectedMission.id &&
          action.kind === 'lesson_saved'
        )
        .map((action) => action.targetId)
    ),
    [missionActions, selectedMission.id, workspace.workspaceId],
  );
  const recordMissionAction = useCallback((kind: MissionActionKind, targetId: string, label: string) => {
    setMissionActions((current) =>
      applyMissionAction(current, {
        workspaceId: workspace.workspaceId,
        missionId: selectedMission.id,
        kind,
        targetId,
        label,
      })
    );
  }, [selectedMission.id, workspace.workspaceId]);
  const handleArtifactPrimaryAction = useCallback(() => {
    if (!selectedTask) {
      setTaskPanelOpen(true);
      setMissionWorkspaceOpen(false);
      showNotice('success', 'Schedule controls opened.');
      return;
    }

    const label = selectedArtifactActionKind === 'artifact_reviewed'
      ? 'Artifact reviewed'
      : 'Artifact opened';
    recordMissionAction(selectedArtifactActionKind, selectedArtifactTargetId, label);
    showNotice('success', selectedArtifactActionKind === 'artifact_reviewed'
      ? 'Artifact marked reviewed for this mission.'
      : 'Artifact action saved for this mission.');
  }, [recordMissionAction, selectedArtifactActionKind, selectedArtifactTargetId, selectedTask, showNotice]);
  const handleLessonAction = useCallback((lesson: MissionLessonView) => {
    recordMissionAction('lesson_saved', lesson.id, lesson.title);
    showNotice('success', `${lesson.title} saved to mission memory.`);
  }, [recordMissionAction, showNotice]);
  const renderMissionArtifact = () => (
    <MissionArtifact
      mission={selectedMission}
      actionSaved={Boolean(selectedArtifactAction)}
      savedActionLabel={selectedArtifactActionKind === 'artifact_reviewed' ? 'Reviewed' : 'Opened'}
      onPrimaryAction={handleArtifactPrimaryAction}
    />
  );
  const renderMissionLessons = () => (
    <MissionLessons
      mission={selectedMission}
      savedLessonIds={savedMissionLessonIds}
      onLessonAction={handleLessonAction}
    />
  );
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
  const hasUnconfiguredDelivery = useMemo(() => {
    if (!automationEditor) return false;
    const steps = automationEditor.authoringMode === 'describe'
      ? buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt)
      : automationEditor.steps;
    const hasDeliverStep = steps.some((s) => s.kind === 'deliver');
    return hasDeliverStep && !automationEditor.notify.trim() && automationEditor.destinationType === 'none';
  }, [automationEditor]);
  const automationEditorPolicyMath = useMemo(
    () => inferExecutionPolicyMath(automationEditor?.executionPolicy || DEFAULT_EXECUTION_POLICY, automationEditor?.steps || []),
    [automationEditor]
  );
  const automationEditorSourceSteps = useMemo(() => {
    if (!automationEditor) return [];
    return automationEditor.authoringMode === 'describe'
      ? buildWorkflowBlocksFromPrompt(automationEditor.workflowPrompt)
      : automationEditor.steps;
  }, [automationEditor?.authoringMode, automationEditor?.steps, automationEditor?.workflowPrompt]);
  const automationEditorWorkflowId = useMemo(
    () => inferEditorWorkflowId(automationEditorSourceSteps, automationEditor?.workflowId),
    [automationEditor?.workflowId, automationEditorSourceSteps],
  );
  const automationReadinessTarget = useMemo(
    () => getWorkflowReadinessDeliveryTarget({
      notify: automationEditor?.notify,
      steps: automationEditorSourceSteps,
    }),
    [automationEditor?.notify, automationEditorSourceSteps],
  );
  const automationReadinessFetchKey = useMemo(() => JSON.stringify({
    workflowId: automationEditorWorkflowId,
    name: automationEditor?.name || '',
    notify: automationReadinessTarget,
    destinationType: automationEditor?.destinationType || 'none',
    authoringMode: automationEditor?.authoringMode || 'guided',
    workflowPrompt: automationEditor?.authoringMode === 'describe' ? automationEditor?.workflowPrompt || '' : '',
    steps: automationEditorSourceSteps.map((step) => ({
      kind: step.kind,
      source: step.inputs?.source,
      queryType: step.inputs?.query_type,
      target: step.deliveryTarget?.target || '',
    })),
  }), [
    automationEditor?.authoringMode,
    automationEditor?.destinationType,
    automationEditor?.name,
    automationReadinessTarget,
    automationEditor?.workflowPrompt,
    automationEditorSourceSteps,
    automationEditorWorkflowId,
  ]);

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

  useEffect(() => {
    if (!automationEditorWorkflowId || !automationEditor) {
      setWorkflowReadiness(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      deliveryTarget: automationReadinessTarget,
      workspaceId: workspace.workspaceId,
    });
    fetch(`/api/workflows/${automationEditorWorkflowId}/readiness?${params.toString()}`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load workflow readiness');
        return response.json();
      })
      .then((payload) => {
        setWorkflowReadiness(payload?.report ? payload.report : null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setWorkflowReadiness(null);
      });

    return () => controller.abort();
  }, [automationEditorWorkflowId, automationReadinessFetchKey, automationReadinessTarget, workspace.workspaceId]);

  const updateAutomationStep = useCallback((index: number, value: string) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const steps = [...current.steps];
      const step = steps[index];
      const inferredTarget = step.kind === 'deliver' ? inferDeliveryTargetFromText(value) : null;
      steps[index] = {
        ...step,
        objective: value,
        title: step.title || value,
        deliveryTarget: inferredTarget || step.deliveryTarget,
      };

      if (inferredTarget) {
        return {
          ...current,
          steps,
          destinationType: inferredTarget.channel,
          notify: inferredTarget.target,
        };
      }

      return { ...current, steps };
    });
  }, []);

  const updateAutomationDestination = useCallback((
    destinationType: AutomationEditorDraft['destinationType'],
    notify: string,
  ) => {
    setAutomationEditor((current) => current
      ? applyAutomationEditorDestination(current, destinationType, notify)
      : current);
  }, []);

  const updateAutomationStepDeliveryTarget = useCallback((
    index: number,
    destinationType: AutomationEditorDraft['destinationType'],
    notify: string,
  ) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const target = normalizeEditorDestinationTarget(notify);
      const steps = [...current.steps];
      const step = steps[index];
      const deliveryTarget: WorkflowDeliveryTargetDraft | null = destinationType === 'none' || !target
        ? null
        : {
            channel: destinationType === 'email' ? 'email' : 'slack',
            target,
          };

      steps[index] = { ...step, deliveryTarget };
      return {
        ...current,
        destinationType,
        notify: destinationType === 'none' ? '' : target,
        steps,
      };
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
    const missionTarget = getMissionTargetFromSearch(location.search);
    const panel = params.get('panel');
    const editTarget = params.get('edit');
    const createTarget = params.get('create');

    if (panel === 'schedules') {
      setMissionWorkspaceOpen(false);
      setTaskPanelOpen(true);
    }

    if (createTarget === 'workflow' && !automationEditor) {
      handleAutomationCreate();
      return;
    }

    if (missionTarget) {
      const match = findTaskByMissionTarget(taskItems, missionTarget);
      if (match) {
        setSelectedTaskId(match.id);
      }
    }

    if (editTarget === 'workflow' && missionTarget && !automationEditor) {
      const match = findTaskByMissionTarget(taskItems, missionTarget);
      if (match) {
        void handleAutomationEdit(match, 'workflow');
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
              : 'border-navy-800/60 bg-navy-950/25 text-slate-400 hover:border-navy-700 hover:bg-navy-800/80 hover:text-slate-100'
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
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': workspace.workspaceId,
          'X-Workspace-Name': workspace.workspaceName,
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
    setAutomationSetupOptionalOpen(Boolean(selectedTask.description || selectedTask.condition));
    setAutomationEditorError(null);
    setAutomationEditor({
      mode: 'create',
      id: `draft-${Date.now()}`,
      workflowId: selectedTask.workflowId,
      templateId: selectedTask.templateId,
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
              ? 'slack'
              : 'none',
      timezone: selectedTask.timezone || getLocalTimeZone(),
    });
  }, [selectedTask]);

  const openScheduleControls = (
    <button
      type="button"
      onClick={() => {
        setMissionWorkspaceOpen(false);
        setTaskPanelOpen(true);
      }}
      className="w-full rounded-lg border border-navy-700/80 bg-navy-950/55 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-violet-500/30 hover:bg-navy-900/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      Open schedule controls
    </button>
  );

  const noActiveMissionCard = (
    <div className="rounded-lg border border-dashed border-navy-700/80 bg-navy-950/40 p-4">
      <p className="text-[10px] font-medium text-violet-300/80">No active mission</p>
      <h3 className="mt-2 text-base font-semibold leading-snug text-white">
        Create a scheduled automation
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Mission steps, artifacts, lessons, evidence, and credit analytics will appear here after a workflow exists.
      </p>
    </div>
  );

  const renderMissionBoardView = () => (
    <MissionBoard
      mission={selectedMission}
      selectedStepId={selectedBoardStepId}
      selectedEvidenceId={selectedBoardEvidenceId}
      onSelectStep={(step) => openMissionDetail({ kind: 'step', id: step.id })}
      onSelectEvidence={(item) => openMissionDetail({ kind: 'evidence', id: item.id })}
    />
  );

  const renderMissionCalendarView = () => (
    <MissionCalendar
      mission={selectedMission}
      selectedAgendaId={selectedAgendaId}
      onSelectAgenda={(item) => {
        setSelectedCalendarItemId(item.id);
        openMissionDetail({ kind: 'calendar', id: item.id });
      }}
      onRunNow={() => {
        if (selectedTask) void handleAutomationRun(selectedTask);
      }}
      onPauseToggle={() => {
        if (selectedTask) void handleAutomationPauseToggle(selectedTask);
      }}
      disabled={!selectedTask || selectedTask.source !== 'live' || actionBusy !== null}
    />
  );

  const renderMissionReviewsView = () => (
    <div className="space-y-4">
      <MissionReviews
        mission={selectedMission}
        preflight={selectedTask?.preflight}
        busyAction={
          actionBusy === 'review-approve'
            ? 'approve'
            : actionBusy === 'review-change'
              ? 'changes'
              : actionBusy === 'review-rerun'
                ? 'rerun'
                : null
        }
        onApproveDelivery={handleReviewApprove}
        onRequestChanges={handleReviewRequestChanges}
        onRerunFailedStep={handleReviewRerun}
      />
      <RunLedgerPanel events={runLedgerEvents} />
    </div>
  );

  const renderMissionWorkspaceContent = () => {
    if (!selectedTask) {
      if (missionWorkspaceTab === 'artifact') {
        return (
          <div className="space-y-3">
            {renderMissionArtifact()}
            {openScheduleControls}
          </div>
        );
      }

      if (missionWorkspaceTab === 'lessons') {
        return (
          <div className="space-y-3">
            {renderMissionLessons()}
            {openScheduleControls}
          </div>
        );
      }

      return (
        <div className="space-y-3">
          {noActiveMissionCard}
          {openScheduleControls}
        </div>
      );
    }

    const scheduleControlsFooter = openScheduleControls;
    const missionSourcesFooter = (
      <>
        <MissionIntegrationsStrip integrations={selectedMission.integrations} />
        {openScheduleControls}
      </>
    );

    if (missionWorkspaceTab === 'mission' || missionWorkspaceTab === 'agents') {
      return (
        <div className="space-y-3">
          <MissionOverview
            mission={selectedMission}
            focus={missionWorkspaceTab === 'agents' ? 'agents' : 'mission'}
          />
          {missionSourcesFooter}
        </div>
      );
    }

    if (missionWorkspaceTab === 'artifact') {
      return (
        <div className="space-y-3">
          {renderMissionArtifact()}
          {missionSourcesFooter}
        </div>
      );
    }

    if (missionWorkspaceTab === 'board') {
      return (
        <div className="space-y-3">
          {renderMissionBoardView()}
          {scheduleControlsFooter}
        </div>
      );
    }

    if (missionWorkspaceTab === 'map') {
      return (
        <div className="space-y-3">
          <MissionMap mission={selectedMission} />
          {missionSourcesFooter}
        </div>
      );
    }

    if (missionWorkspaceTab === 'reviews') {
      return (
        <div className="space-y-3">
          {renderMissionReviewsView()}
          {scheduleControlsFooter}
        </div>
      );
    }

    if (missionWorkspaceTab === 'lessons') {
      return (
        <div className="space-y-3">
          {renderMissionLessons()}
          {scheduleControlsFooter}
        </div>
      );
    }

    if (missionWorkspaceTab === 'calendar') {
      return (
        <div className="space-y-3">
          {renderMissionCalendarView()}
          {scheduleControlsFooter}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <MissionAnalytics mission={selectedMission} />
        {scheduleControlsFooter}
      </div>
    );
  };

  const renderChatSurface = () => (
    <ChatInterface
      conversationId={activeConvoId}
      initialMessages={currentMessages}
      onMessagesChange={handleMessagesChange}
      autonomyMode={autonomyMode}
      missionTitle={selectedTask ? selectedMission.title : 'Open Mission'}
      missionStatusLabel={selectedTask ? selectedMission.statusLabel : undefined}
      onOpenMissionWorkspace={() => {
        setMissionWorkspaceOpen(true);
        setTaskPanelOpen(false);
      }}
    />
  );

  const renderCommandDashboard = () => (
    <MissionCommandDashboard
      mission={selectedMission}
      creditBalanceLabel={`${formatCredits(snapshot.creditsRemaining)} cr`}
      creditRunwayLabel={`${snapshot.projectedDaysLeft}d runway · ${snapshot.planName}`}
      lowCreditRunway={lowCreditRunway}
      onOpenWorkspace={() => {
        setMissionWorkspaceOpen(true);
        setTaskPanelOpen(false);
      }}
      onOpenSchedule={() => {
        setMissionWorkspaceOpen(false);
        setTaskPanelOpen(true);
      }}
      onOpenArea={openWorkspaceTarget}
      onOpenCredits={() => setCreditDrawerOpen(true)}
    />
  );

  const workspaceSurface = (children: React.ReactNode) => (
    <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.92))] px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {children}
      </div>
    </div>
  );

  const workspaceHeaderCard = (
    <div className="rounded-2xl border border-navy-800/80 bg-navy-900/48 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
        {activeWorkspaceArea.label}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
            {activeWorkspaceArea.shortLabel}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            {activeWorkspaceArea.description}
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-navy-700 bg-navy-950/55 px-3 py-1 text-[11px] font-medium text-slate-400">
          {activeWorkspaceArea.tabs.find((tab) => tab.id === activeWorkspaceTab)?.label || activeWorkspaceTab}
        </span>
      </div>
      {selectedMission.steps.length > 0 ? (
        <MissionProgressRail mission={selectedMission} className="mt-4" />
      ) : null}
    </div>
  );

  const renderEmptyWorkspaceSurface = (detail?: React.ReactNode) => workspaceSurface(
    <>
      {workspaceHeaderCard}
      {noActiveMissionCard}
      {detail}
      {openScheduleControls}
    </>
  );
  const tabFocusCard = (title: string, body: string, tone: 'violet' | 'cyan' | 'amber' | 'slate' = 'violet') => {
    const toneClass = {
      violet: 'border-violet-500/18 bg-violet-500/8 text-violet-200',
      cyan: 'border-cyan-500/18 bg-cyan-500/8 text-cyan-200',
      amber: 'border-amber-500/18 bg-amber-500/8 text-amber-200',
      slate: 'border-navy-800/80 bg-navy-900/45 text-slate-300',
    }[tone];

    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
      </div>
    );
  };

  const renderStepFocusList = (title: string, steps: typeof selectedMission.steps, emptyLabel: string) => (
    <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 space-y-2">
        {steps.length > 0 ? steps.map((step) => (
          <div key={step.id} className="rounded-xl border border-navy-800/80 bg-navy-950/45 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{step.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{step.objective}</p>
                <MissionProgressRail steps={[step]} variant="compact" className="mt-2" />
              </div>
              <span className="flex-shrink-0 rounded-full border border-navy-700 bg-navy-950/65 px-2 py-1 text-[10px] font-medium text-slate-400">
                {step.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        )) : (
          <p className="rounded-xl border border-dashed border-navy-800/80 bg-navy-950/35 px-3 py-3 text-sm text-slate-500">
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );

  const renderEvidenceList = () => (
    <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
      <p className="text-sm font-semibold text-white">Evidence</p>
      <div className="mt-3 space-y-2">
        {selectedMission.evidence.length > 0 ? selectedMission.evidence.map((item) => (
          <div key={item.id} className="rounded-xl border border-navy-800/80 bg-navy-950/45 px-3 py-2.5">
            <p className="text-sm font-medium text-slate-100">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.source} · {item.detail}</p>
          </div>
        )) : (
          <p className="rounded-xl border border-dashed border-navy-800/80 bg-navy-950/35 px-3 py-3 text-sm text-slate-500">
            Source-linked evidence appears after a mission produces artifacts.
          </p>
        )}
      </div>
    </div>
  );

  const renderMetricsGrid = (title: string) => (
    <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {selectedMission.metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-navy-800/80 bg-navy-950/45 px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">{metric.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{metric.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEmptyWorkspaceMain = () => {
    if (workspaceArea === 'home') {
      return workspaceSurface(renderCommandDashboard());
    }

    if (workspaceArea === 'missions') {
      const title = activeWorkspaceTab === 'artifact'
        ? 'Living artifact'
        : activeWorkspaceTab === 'agents'
        ? 'Agent roster'
        : activeWorkspaceTab === 'steps'
          ? 'Mission steps'
          : activeWorkspaceTab === 'evidence'
            ? 'Evidence trail'
            : activeWorkspaceTab === 'lessons'
              ? 'Learning loop'
            : activeWorkspaceTab === 'controls'
              ? 'Mission schedule'
              : 'Mission overview';
      return renderEmptyWorkspaceSurface(
        <>
          {activeWorkspaceTab === 'artifact' ? renderMissionArtifact() : null}
          {activeWorkspaceTab === 'lessons' ? renderMissionLessons() : null}
          {tabFocusCard(title, 'Create a scheduled workflow and Violema will turn it into a mission with a living artifact, workers, evidence, learning loop, and schedule controls.', 'violet')}
        </>
      );
    }

    if (workspaceArea === 'board') {
      const title = activeWorkspaceTab === 'waiting'
        ? 'Waiting work'
        : activeWorkspaceTab === 'review'
          ? 'Review queue'
          : activeWorkspaceTab === 'done'
            ? 'Completed work'
            : 'Active work';
      return renderEmptyWorkspaceSurface(
        tabFocusCard(title, 'Kanban lanes fill in once a mission has runnable steps.', 'violet')
      );
    }

    if (workspaceArea === 'map') {
      if (activeWorkspaceTab === 'tools') {
        return renderEmptyWorkspaceSurface(
          tabFocusCard('Tools by step', 'Tool usage appears here after a mission defines executable steps.', 'cyan')
        );
      }
      if (activeWorkspaceTab === 'mcp') {
        return renderEmptyWorkspaceSurface(
          tabFocusCard('MCP extension layer', 'Custom MCP tools belong here when Violema needs a founder-specific connector.', 'amber')
        );
      }
      if (activeWorkspaceTab === 'integrations') {
        return renderEmptyWorkspaceSurface(
          <>
            <MissionIntegrationsStrip integrations={selectedMission.integrations} />
            {tabFocusCard('Integration line', 'Slack, Stripe, GitHub, Google, Microsoft, email, calendar, and custom MCP connectors stay visible without crowded status badges.', 'cyan')}
          </>
        );
      }
      return renderEmptyWorkspaceSurface(
        tabFocusCard('Workflow map', 'Visual workflow steps appear here after the first automation is created.', 'violet')
      );
    }

    if (workspaceArea === 'reviews') {
      const title = activeWorkspaceTab === 'evidence'
        ? 'Evidence trail'
        : activeWorkspaceTab === 'outputs'
          ? 'Output review'
          : 'Approval queue';
      return renderEmptyWorkspaceSurface(
        tabFocusCard(title, 'Approvals, outputs, and source-linked evidence appear after a mission produces work.', 'slate')
      );
    }

    if (workspaceArea === 'calendar') {
      const title = activeWorkspaceTab === 'recurring'
        ? 'Recurring cadence'
        : activeWorkspaceTab === 'history'
          ? 'Run history'
          : 'Upcoming runs';
      return renderEmptyWorkspaceSurface(
        tabFocusCard(title, 'Schedule a workflow and its next runs, cadence, and history will appear here.', 'violet')
      );
    }

    if (workspaceArea === 'analytics') {
      const title = activeWorkspaceTab === 'efficiency'
        ? 'Efficiency signals'
        : activeWorkspaceTab === 'run-cost'
          ? 'Run cost by step'
          : activeWorkspaceTab === 'forecast'
            ? 'Credit forecast'
            : 'Credit usage';
      return renderEmptyWorkspaceSurface(
        tabFocusCard(title, 'Credit analytics appear after Violema has a mission to run and measure.', 'amber')
      );
    }

    if (workspaceArea === 'integrations') {
      const title = activeWorkspaceTab === 'suites'
        ? 'Google and Microsoft suites'
        : activeWorkspaceTab === 'mcp'
          ? 'Custom MCP tools'
          : 'Core founder stack';
      return renderEmptyWorkspaceSurface(
        <>
          <MissionIntegrationsStrip integrations={selectedMission.integrations} />
          {tabFocusCard(title, 'Slack, Stripe, GitHub, Google, Microsoft, email, calendar, and MCP integrations stay visible here as activation comes online.', 'cyan')}
        </>
      );
    }

    const title = activeWorkspaceTab === 'replay'
      ? 'Replay important runs.'
      : activeWorkspaceTab === 'optimize'
        ? 'Optimize routing and cost.'
        : 'Debug the mission system.';
    return renderEmptyWorkspaceSurface(
      tabFocusCard(title, 'Advanced controls stay available without making Agent Studio the default daily workspace.', 'cyan')
    );
  };

  const renderWorkspaceMain = () => {
    if (workspaceArea === 'home') {
      if (activeWorkspaceTab === 'activity') {
        return workspaceSurface(
          <>
            {renderCommandDashboard()}
            <WorkflowTemplateGallery templates={WORKFLOW_TEMPLATES} onUse={applyFounderWorkflowTemplate} />
          </>
        );
      }
      return renderChatSurface();
    }

    if (!selectedTask) return renderEmptyWorkspaceMain();

    if (workspaceArea === 'missions') {
      if (activeWorkspaceTab === 'artifact') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionArtifact()}
            <MissionIntegrationsStrip integrations={selectedMission.integrations} />
          </>
        );
      }
      if (activeWorkspaceTab === 'agents') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            <MissionOverview mission={selectedMission} focus="agents" />
            <MissionIntegrationsStrip integrations={selectedMission.integrations} />
          </>
        );
      }
      if (activeWorkspaceTab === 'evidence') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionReviewsView()}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'lessons') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionLessons()}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'controls') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionCalendarView()}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'steps') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionBoardView()}
            {openScheduleControls}
          </>
        );
      }
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          <MissionDetailView
            mission={selectedMission}
            selection={activeMissionSelection}
            onSelect={setMissionSelection}
            onOpenInspector={openMissionInspector}
            onOpenArea={openWorkspaceTarget}
            onOpenCredits={() => setCreditDrawerOpen(true)}
            onRunNow={() => {
              if (selectedTask) void handleAutomationRun(selectedTask);
            }}
            onPauseToggle={() => {
              if (selectedTask) void handleAutomationPauseToggle(selectedTask);
            }}
            disabled={!selectedTask || selectedTask.source !== 'live' || actionBusy !== null}
          />
        </>
      );
    }

    if (workspaceArea === 'board') {
      if (activeWorkspaceTab === 'waiting') {
        const waitingSteps = selectedMission.steps.filter((step) => step.status === 'paused' || step.status === 'planned');
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionBoardView()}
            {renderStepFocusList('Waiting work', waitingSteps, 'No waiting steps for the selected mission.')}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'review') {
        const reviewSteps = selectedMission.steps.filter((step) => step.status === 'waiting_review');
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionBoardView()}
            {renderStepFocusList('Review queue', reviewSteps, 'No steps are waiting for review.')}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'done') {
        const doneSteps = selectedMission.steps.filter((step) => step.status === 'completed');
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMissionBoardView()}
            {renderStepFocusList('Completed work', doneSteps, 'Completed steps appear here after a mission runs.')}
            {openScheduleControls}
          </>
        );
      }
      const activeSteps = selectedMission.steps.filter((step) => step.status === 'running');
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          {renderMissionBoardView()}
          {renderStepFocusList('Active work', activeSteps, 'No steps are actively running right now.')}
          {openScheduleControls}
        </>
      );
    }

    if (workspaceArea === 'map') {
      if (activeWorkspaceTab === 'integrations') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            <MissionIntegrationsStrip integrations={selectedMission.integrations} />
            {tabFocusCard('Integration line', 'Slack, Stripe, GitHub, Google, Microsoft, email, calendar, and custom MCP connectors stay visible without status badges until they are activated.', 'cyan')}
          </>
        );
      }
      if (activeWorkspaceTab === 'tools') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderStepFocusList('Tools by step', selectedMission.steps.filter((step) => Boolean(step.toolLabel)), 'Tool usage appears here after a mission defines executable steps.')}
            <MissionMap mission={selectedMission} />
          </>
        );
      }
      if (activeWorkspaceTab === 'mcp') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('MCP extension layer', 'Custom MCP tools belong here when Violema needs to connect to a founder-specific system without waiting for a packaged integration.', 'amber')}
            <MissionIntegrationsStrip integrations={selectedMission.integrations} />
          </>
        );
      }
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          <MissionMap mission={selectedMission} />
          <MissionIntegrationsStrip integrations={selectedMission.integrations} />
        </>
      );
    }

    if (workspaceArea === 'reviews') {
      if (activeWorkspaceTab === 'evidence') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderEvidenceList()}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'outputs') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('Output review', selectedMission.reviewSummary || 'Mission outputs appear here once a run produces a draft, delivery, or source-linked artifact.', 'slate')}
            {renderEvidenceList()}
          </>
        );
      }
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          {renderMissionReviewsView()}
          {openScheduleControls}
        </>
      );
    }

    if (workspaceArea === 'calendar') {
      if (activeWorkspaceTab === 'recurring') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('Recurring cadence', `${selectedMission.scheduleLabel}. ${selectedMission.deliveryLabel}.`, 'violet')}
            {openScheduleControls}
          </>
        );
      }
      if (activeWorkspaceTab === 'history') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('Run history', `${selectedMission.lastRunLabel}. ${selectedMission.analyticsSummary}`, 'slate')}
            {renderEvidenceList()}
          </>
        );
      }
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          {renderMissionCalendarView()}
          {openScheduleControls}
        </>
      );
    }

    if (workspaceArea === 'analytics') {
      if (activeWorkspaceTab === 'efficiency') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderMetricsGrid('Efficiency signals')}
          </>
        );
      }
      if (activeWorkspaceTab === 'run-cost') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {renderStepFocusList('Run cost by step', selectedMission.steps, 'Step-level run cost appears after a mission runs.')}
          </>
        );
      }
      if (activeWorkspaceTab === 'forecast') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('Credit forecast', selectedMission.analyticsSummary, 'amber')}
            {openScheduleControls}
          </>
        );
      }
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          <MissionAnalytics mission={selectedMission} />
          <button
            type="button"
            onClick={() => setCreditDrawerOpen(true)}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-violet-300/24 bg-violet-300/10 px-3 py-2 text-sm font-semibold text-violet-50 transition-colors hover:bg-violet-300/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <CreditCard className="h-4 w-4" />
            Open compact credits drawer
          </button>
          {openScheduleControls}
        </>
      );
    }

    if (workspaceArea === 'integrations') {
      if (activeWorkspaceTab === 'suites') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('Google and Microsoft suites', 'Email, calendar, Drive, Docs, Outlook, and Teams belong in the same clean integration line as the core founder stack.', 'cyan')}
            <MissionIntegrationsStrip integrations={selectedMission.integrations} />
          </>
        );
      }
      if (activeWorkspaceTab === 'mcp') {
        return workspaceSurface(
          <>
            {workspaceHeaderCard}
            {tabFocusCard('Custom MCP tools', 'Founder-specific systems can become Violema tools without waiting for a first-party integration.', 'amber')}
            {openScheduleControls}
          </>
        );
      }
      return workspaceSurface(
        <>
          {workspaceHeaderCard}
          <MissionIntegrationsStrip integrations={selectedMission.integrations} />
          <div className="rounded-2xl border border-navy-800/80 bg-navy-900/45 p-4">
            <p className="text-sm font-semibold text-white">Core founder stack</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Keep the list elegant in the app now; activate Slack, Stripe, GitHub, Google, Microsoft, email, calendar, and custom MCP tools as their connectors come online.
            </p>
          </div>
        </>
      );
    }

    const advancedCopy = {
      debug: {
        title: 'Debug the mission system.',
        body: 'Inspect run analysis, routing, worker behavior, and failures without making that depth the default daily workspace.',
      },
      replay: {
        title: 'Replay important runs.',
        body: 'Review the path a mission took, compare decisions, and understand what changed before you trust the next automation.',
      },
      optimize: {
        title: 'Optimize routing and cost.',
        body: 'Tune presets, model paths, policy controls, and scenario behavior after the workflow proves it deserves deeper work.',
      },
    }[activeWorkspaceTab as 'debug' | 'replay' | 'optimize'] || {
      title: 'Replay, optimize, and debug when the mission needs depth.',
      body: 'This keeps daily work in the Agent Office while preserving the full Agent Studio for run analysis, routing, scenario replay, and optimization.',
    };

    return workspaceSurface(
      <>
        {workspaceHeaderCard}
        <div className="rounded-2xl border border-cyan-500/18 bg-cyan-500/8 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
            Advanced layer
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
            {advancedCopy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {advancedCopy.body}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/agents')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-500/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Bot className="h-3.5 w-3.5" />
            Open Advanced
          </button>
        </div>
      </>
    );
  };

  const chatTabActive = workspaceArea === 'home' && activeWorkspaceTab === 'chat';

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
              className="flex min-w-0 items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl pr-1"
              aria-label="Go to Violema home"
            >
              <ViolemaLogo className="h-10 w-[11.25rem]" />
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
              <div className="flex items-center gap-1 rounded-full border border-navy-600/80 bg-navy-900/75 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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
                    aria-pressed={threadFilter === option.value}
                    className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                      threadFilter === option.value
                        ? 'bg-violet-500/22 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-navy-800/80 hover:text-white'
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
                        openConversation(convo.id);
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
                          openConversation(convo.id);
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
                <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{section.label}</p>
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
                        openConversation(convo.id);
                      }}
                      className="w-full rounded-xl border border-navy-800/60 bg-navy-950/18 px-3.5 py-2.5 text-left text-slate-300 transition-all hover:border-navy-700 hover:bg-navy-800/70 hover:text-white"
                    >
                      <div className="flex items-start gap-2.5 pr-6">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
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
                        openConversation(convo.id);
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
                        openConversation(convo.id);
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

          <DimaSidebarNote />

	          <div className="border-t border-navy-800 px-3 py-2">
	            <div className="rounded-xl border border-navy-800/80 bg-navy-950/45 px-2.5 py-2">
	              <div className="flex items-center gap-2">
	                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border ${
	                  lowCreditRunway
	                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
	                    : 'border-navy-700 bg-navy-900/80 text-slate-400'
	                }`}>
	                  <CreditCard className="h-3.5 w-3.5" />
	                </div>
	                <button
	                  type="button"
	                  onClick={() => setCreditDrawerOpen(true)}
	                  className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
	                >
	                  <p className="truncate text-[12px] font-medium leading-none text-slate-300">
	                    {formatCredits(snapshot.creditsRemaining)} cr
	                  </p>
	                  <p className={`mt-0.5 truncate text-[10px] leading-none ${
	                    lowCreditRunway ? 'text-amber-300/80' : 'text-slate-600'
	                  }`}>
	                    {snapshot.projectedDaysLeft}d runway · {snapshot.planName}
	                  </p>
	                </button>
	                <button
	                  type="button"
	                  onClick={openTopUp}
	                  aria-label="Top up credits"
	                  title="Top up credits"
	                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-navy-700 bg-navy-900/60 text-slate-500 transition-colors hover:border-violet-500/30 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
	                >
	                  <Plus className="h-3.5 w-3.5" />
	                </button>
	                <button
	                  type="button"
	                  onClick={() => { void openUpgrade(); }}
	                  aria-label="Upgrade plan"
	                  title="Upgrade plan"
	                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-navy-700 bg-navy-900/60 text-slate-500 transition-colors hover:border-violet-500/30 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
	                >
	                  <ArrowUpRight className="h-3.5 w-3.5" />
	                </button>
	              </div>
	              {canLoadTestCredits ? (
	                <div className="mt-2 flex items-center justify-between gap-2 border-t border-navy-800/70 pt-2">
	                  <p className="truncate text-[10px] font-medium text-emerald-300/80">Founder testing</p>
	                  <button
	                    type="button"
	                    onClick={() => { void grantTestCredits(); }}
	                    disabled={actionBusy === 'grant'}
	                    className="rounded-md border border-emerald-500/25 bg-emerald-500/8 px-2 py-1 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/14 disabled:cursor-not-allowed disabled:opacity-60"
	                  >
	                    {actionBusy === 'grant' ? 'Loading...' : 'Load 5k'}
	                  </button>
	                </div>
	              ) : null}
	            </div>
	          </div>

	          {/* Compact user footer */}
	          <div className="border-t border-navy-800 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              {/* Avatar */}
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-violet-800/40 bg-gradient-to-br from-violet-700/35 to-navy-700 text-[10px] font-bold text-violet-300">
                {authSession?.name ? authSession.name[0].toUpperCase() : 'U'}
              </div>

              {/* Name + plan */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium leading-none text-slate-200">
                  {authSession?.name || authSession?.email || 'You'}
                </p>
                <p className="mt-0.5 text-[10px] leading-none text-slate-600">{snapshot.planName} plan</p>
              </div>

              {/* Slack status dot */}
              <button
                onClick={() => navigate('/connect/slack?next=%2Fdashboard')}
                aria-label={hasSlackConnection() ? 'Slack connected — click to edit' : 'Connect Slack'}
                title={hasSlackConnection() ? `Slack: ${authSession?.slackDisplayTarget || authSession?.slackChannelId || 'connected'}` : 'Slack not connected'}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-navy-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span className={`h-2 w-2 rounded-full ${hasSlackConnection() ? 'bg-green-400' : 'bg-slate-600'}`} />
              </button>

              {/* Settings */}
              <button
                onClick={() => navigate('/settings')}
                aria-label="Settings"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-navy-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>

              {/* Home */}
              <button
                onClick={() => navigate('/')}
                aria-label="Back to home"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-navy-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main chat area ───────────────────────────────────────────── */}
	      <div className="flex min-h-0 flex-1 flex-col min-w-0">
	        {/* Top bar */}
	        <header className="flex flex-shrink-0 flex-col gap-2 border-b border-navy-800/80 bg-gradient-to-r from-navy-950/94 via-navy-900/72 to-navy-950/94 px-3 py-2.5 shadow-[0_12px_30px_rgba(2,6,23,0.16)] backdrop-blur-md sm:px-5">
	          <div className="flex min-w-0 items-center gap-2">
	            {(!sidebarOpen || isMobileSidebar) && (
	              <button
	                onClick={() => setSidebarOpen(true)}
	                className="mr-1 rounded p-0.5 text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
	                aria-label="Open sidebar"
	              >
	                <PanelLeftOpen className="w-4 h-4" />
	              </button>
	            )}

	            <nav
	              aria-label="Workspace areas"
              className="panel-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5"
	            >
	              {WORKSPACE_AREAS.map((area) => {
	                const Icon = area.icon;
	                const isActive = workspaceArea === area.id;
	                return (
	                  <button
	                    key={area.id}
	                    type="button"
	                    onClick={() => selectWorkspaceArea(area.id)}
	                    aria-pressed={isActive}
                    className={`inline-flex min-w-fit items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:px-3.5 ${
                      isActive
                        ? 'border-violet-400/60 bg-violet-500/22 text-white shadow-[0_10px_26px_rgba(124,58,237,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'border-navy-700/80 bg-navy-900/62 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-navy-600 hover:bg-navy-800/88 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-violet-200' : 'text-slate-400'}`} />
                    <span>{area.shortLabel}</span>
                  </button>
	                );
	              })}
	            </nav>

	            {/* Mode selector lives in the sidebar on common laptop widths so the area nav stays readable. */}
	            <div className="hidden 2xl:block">
	              <ModeSelector />
	            </div>

	            <button
	              onClick={() => {
	                const next = !missionWorkspaceOpen;
	                setMissionWorkspaceOpen(next);
	                if (next) setTaskPanelOpen(false);
	              }}
	              aria-pressed={missionWorkspaceOpen}
	              aria-label="Toggle contextual inspector"
	              className={`hidden shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:flex ${
	                missionWorkspaceOpen
	                  ? 'border-violet-700/50 bg-violet-900/30 text-violet-300 shadow-sm'
	                  : 'border-navy-700 bg-navy-800/80 text-slate-400 hover:text-slate-200'
	              }`}
	            >
	              <Eye className="w-3.5 h-3.5" />
	              <span className="hidden 2xl:inline">Inspector</span>
	            </button>
	          </div>

	          <div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-end lg:justify-between">
	            <div className="min-w-0">
	              <div className="flex flex-wrap items-center gap-2">
	                <h1 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white sm:text-sm">
	                  {workspaceArea === 'home' ? convoTitle : activeWorkspaceArea.label}
	                </h1>
	                <span className="hidden rounded-full border border-green-500/15 bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-green-300 sm:inline-flex">
	                  Ready
	                </span>
	              </div>
	              <div className="mt-1 hidden flex-wrap items-center gap-2 sm:flex">
	                <div className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_0_4px_rgba(74,222,128,0.08)]" />
	                <span className="truncate text-xs text-slate-500">
	                  {workspaceArea === 'home' ? 'Violema ready' : activeWorkspaceArea.description}
	                </span>
	                {currentMessages.length > 0 && (
	                  <>
	                    <span className="text-slate-700">·</span>
	                    <span className="text-xs text-slate-600">{currentMessages.length} msgs</span>
	                  </>
	                )}
	              </div>
	            </div>

	            <div
	              role="tablist"
	              aria-label={`${activeWorkspaceArea.label} workspace tabs`}
              className="panel-scroll flex max-w-full gap-1.5 overflow-x-auto pb-0.5 lg:justify-end"
	            >
	              {activeWorkspaceArea.tabs.map((tab) => {
	                const isActive = activeWorkspaceTab === tab.id;
	                return (
	                  <button
	                    key={`${activeWorkspaceArea.id}-${tab.id}`}
	                    id={`workspace-tab-${activeWorkspaceArea.id}-${tab.id}`}
	                    type="button"
	                    onClick={() => selectWorkspaceTab(tab.id)}
	                    role="tab"
	                    aria-selected={isActive}
	                    aria-controls={activeWorkspacePanelId}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      isActive
                        ? 'border-violet-400/55 bg-violet-500/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'border-navy-700/60 bg-navy-950/34 text-slate-300 hover:border-navy-600 hover:bg-navy-800/78 hover:text-white'
                    }`}
	                  >
	                    {tab.label}
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        </header>

        {isMobileSidebar && (
          <div className="border-b border-navy-800/70 bg-navy-950/55 px-3 py-2 backdrop-blur-sm sm:hidden">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-expanded={sidebarOpen}
                className="ui-button-ghost flex-1 justify-center py-2 text-[11px]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Workspace
              </button>
              <button
                onClick={() => {
                  openHomeChat();
                  setTaskPanelOpen(false);
                }}
                aria-pressed={workspaceArea === 'home' && activeWorkspaceTab === 'chat'}
                className="ui-button-ghost flex-1 justify-center py-2 text-[11px]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </button>
              <button
                onClick={() => {
                  setMissionWorkspaceOpen(true);
                  setTaskPanelOpen(false);
                }}
                aria-pressed={missionWorkspaceOpen}
                className="ui-button-ghost flex-1 justify-center py-2 text-[11px]"
              >
                <Eye className="h-3.5 w-3.5" />
                Inspector
              </button>
            </div>
          </div>
        )}

        {/* Workspace body */}
        <div className="flex flex-1 min-h-0">
          <div
            id={chatTabActive ? activeWorkspacePanelId : undefined}
            role={chatTabActive ? 'tabpanel' : undefined}
            aria-labelledby={chatTabActive ? activeWorkspaceTabElementId : undefined}
            aria-hidden={chatTabActive && missionWorkspaceOpen && isMobileSidebar ? true : !chatTabActive ? true : undefined}
            className={`${chatTabActive ? 'flex' : 'hidden'} min-h-0 flex-1 min-w-0`}
          >
            {renderChatSurface()}
          </div>

          <div
            id={!chatTabActive ? activeWorkspacePanelId : undefined}
            role={!chatTabActive ? 'tabpanel' : undefined}
            aria-labelledby={!chatTabActive ? activeWorkspaceTabElementId : undefined}
            aria-hidden={!chatTabActive && missionWorkspaceOpen && isMobileSidebar ? true : chatTabActive ? true : undefined}
            className={`${chatTabActive ? 'hidden' : 'flex'} min-h-0 flex-1 min-w-0`}
          >
            {chatTabActive ? null : renderWorkspaceMain()}
          </div>

          {missionWorkspaceOpen && isMobileSidebar && (
            <button
              type="button"
              onClick={() => setMissionWorkspaceOpen(false)}
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[1px] lg:hidden"
            />
          )}

          {missionWorkspaceOpen && (
            <MissionWorkspacePanel
              mission={selectedMission}
              activeTab={missionWorkspaceTab}
              onTabChange={setMissionWorkspaceTab}
              onClose={() => setMissionWorkspaceOpen(false)}
              isModal={isMobileSidebar}
            >
              {renderMissionWorkspaceContent()}
            </MissionWorkspacePanel>
          )}

          {creditDrawerOpen && (
            <MissionCreditDrawer
              mission={selectedMission}
              snapshot={snapshot}
              onClose={() => setCreditDrawerOpen(false)}
              onTopUp={openTopUp}
              onUpgrade={() => { void openUpgrade(); }}
              onOpenAnalytics={() => {
                setCreditDrawerOpen(false);
                openWorkspaceTarget('analytics', 'credits');
              }}
            />
          )}

          <DashboardGuardian
            workspaceId={workspace.workspaceId}
            area={workspaceArea}
            tab={activeWorkspaceTab}
            mission={selectedMission}
            lowCreditRunway={lowCreditRunway}
            panelOffset={taskPanelOpen || missionWorkspaceOpen || creditDrawerOpen}
          />

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
                              Mission work stays in this workspace. Advanced controls open the underlying run analysis, replay, and routing tools when you need deeper debugging.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/agents?automation=${selectedTask.automationId || selectedTask.id}`)}
                            className="ui-pill px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200"
                          >
                            Open Advanced
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
                        {selectedTaskStepExecutions.length > 0 && selectedTask.lastRunAt ? (
                          <div className="mt-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Run steps</p>
                            <div className="mt-2 space-y-1">
                              {selectedTaskStepExecutions.map((step, i) => {
                                const isOk = step.status === 'succeeded';
                                const isFail = step.status === 'failed';
                                const statusSymbol = isOk ? '✓' : isFail ? '✗' : step.status === 'skipped' ? '—' : '…';
                                const statusColor = isOk ? 'text-emerald-400' : isFail ? 'text-red-400' : 'text-slate-500';
                                const snippet = step.summary || step.error;
                                return (
                                  <div key={step.stepId} className="rounded-lg border border-navy-700/60 bg-navy-950/45 px-2.5 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span className={`flex-shrink-0 text-[11px] font-bold ${statusColor}`}>{statusSymbol}</span>
                                        <p className="truncate text-[11px] font-medium text-white">{i + 1}. {step.title}</p>
                                      </div>
                                      <div className="flex flex-shrink-0 items-center gap-2">
                                        {step.durationMs != null && (
                                          <span className="text-[10px] text-slate-600">
                                            {step.durationMs >= 1000 ? `${(step.durationMs / 1000).toFixed(1)}s` : `${step.durationMs}ms`}
                                          </span>
                                        )}
                                        {step.actualCredits != null && (
                                          <span className="text-[10px] text-slate-600">{step.actualCredits} cr</span>
                                        )}
                                        <span className="ui-pill px-1.5 py-0.5 normal-case tracking-normal text-[9px] text-slate-400">{step.kind}</span>
                                      </div>
                                    </div>
                                    {snippet ? (
                                      <p className={`mt-1 text-[10px] leading-relaxed ${isFail ? 'text-red-300' : 'text-slate-500'}`}>
                                        {snippet}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
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
                                void handleAutomationEdit(selectedTask, 'workflow');
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
                          type="button"
                          onClick={() => { void handleAutomationRun(selectedTask); }}
                          disabled={selectedTask.source !== 'live' || actionBusy !== null}
                          className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300 transition-colors hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionBusy === 'run' ? 'Running…' : 'Run now'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleAutomationPauseToggle(selectedTask); }}
                          disabled={selectedTask.source !== 'live' || actionBusy !== null}
                          className="flex-1 rounded-xl border border-navy-700/70 bg-navy-950/35 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-navy-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actionBusy === 'pause' ? 'Saving…' : selectedTask.automationStatus === 'paused' ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleAutomationEdit(selectedTask, 'setup');
                          }}
                          disabled={selectedTask.source !== 'live' || actionBusy !== null}
                          className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300 transition-colors hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit schedule
                        </button>
                      </div>
                      {selectedTask.source === 'live' && (
                        <button
                          type="button"
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
                            type="button"
                            onClick={duplicateSelectedAutomation}
                            className="flex-1 rounded-xl border border-navy-700/70 bg-transparent px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-navy-600 hover:bg-navy-950/35 hover:text-slate-200"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
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
                    {!hasAutomationHistory ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTaskPanelOpen(false);
                          window.setTimeout(() => {
                            const ta = document.querySelector<HTMLTextAreaElement>('textarea');
                            if (ta) { ta.focus(); ta.placeholder = 'Try: "Set up a weekly Slack digest automation"'; }
                          }, 50);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/18"
                      >
                        Set up first automation
                      </button>
                    ) : null}
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
                      onClick={() => selectDashboardTask(task.id, task)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          selectDashboardTask(task.id, task);
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
                              selectDashboardTask(task.id, task);
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
                type="button"
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
                  <p className="mt-1 text-sm text-white">Set the cadence, design the workflow here, and keep deeper agent controls in Advanced.</p>
                </div>

                {automationEditorError ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                      <div>
                        <p className="text-sm font-semibold text-red-100">Save needs attention</p>
                        <p className="mt-1 text-xs leading-5 text-red-100/80">{automationEditorError}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

              <div className="grid gap-2 sm:grid-cols-3">
                {AUTOMATION_EDITOR_SECTIONS.map((section) => {
                  const Icon = section.Icon;
                  const isActive = automationEditorSection === section.id;
                  const isReady = section.id === 'setup'
                    ? Boolean(automationEditor.name.trim() && automationEditor.schedule.trim())
                    : section.id === 'workflow'
                      ? hasAutomationSteps
                      : true;
                  const statusText = isReady
                    ? section.id === 'agents' && automationEditor.executionPolicy.mode === 'recommended'
                      ? 'Default ready'
                      : 'Ready'
                    : section.id === 'setup'
                      ? 'Needs name + cadence'
                      : 'Needs steps';

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setAutomationEditorSection(section.id)}
                      aria-pressed={isActive}
                      className={`group rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        isActive
                          ? 'border-violet-400/45 bg-violet-500/12 shadow-[0_18px_38px_rgba(91,33,182,0.22)]'
                          : 'border-navy-700/80 bg-navy-950/35 hover:border-violet-500/28 hover:bg-navy-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold ${
                          isActive
                            ? 'border-violet-300/35 bg-violet-400/16 text-violet-100'
                            : 'border-white/10 bg-white/[0.03] text-slate-400'
                        }`}>
                          {section.eyebrow}
                        </span>
                        <Icon className={`h-4 w-4 ${isActive ? 'text-violet-200' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{section.label}</p>
                      <p className="mt-1 min-h-[2.4rem] text-xs leading-5 text-slate-400">{section.description}</p>
                      <p className={`mt-2 text-xs font-medium ${isReady ? 'text-cyan-200' : 'text-amber-200'}`}>
                        {statusText}
                      </p>
                    </button>
                  );
                })}
              </div>

              {automationEditorSection === 'setup' && (
                <>
                  <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/6 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/90">Founder templates</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          Start from a proven operating loop, then edit the cadence, destination, and steps.
                        </p>
                      </div>
                      <Layers3 className="h-4 w-4 flex-shrink-0 text-cyan-200/80" />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {WORKFLOW_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyFounderWorkflowTemplate(template.id)}
                          className="rounded-xl border border-white/10 bg-navy-950/45 p-3 text-left transition-colors hover:border-cyan-400/35 hover:bg-cyan-500/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">{template.title}</p>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                              {template.steps.length} steps
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">{template.description}</p>
                          <p className="mt-2 text-[10px] font-medium text-cyan-200/80">{template.cadence}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/90">Required setup</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Name and cadence are required. Timezone protects the schedule. Everything else is optional.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="ui-section-label px-1">Workflow name</span>
                      <div className="ui-input-shell mt-1">
                        <input
                          value={automationEditor.name}
                          onChange={(event) => setAutomationEditor((current) => current ? { ...current, name: event.target.value } : current)}
                          className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                          placeholder="Stripe failed payments monitor"
                        />
                      </div>
                    </label>

                    <div className="block">
                      <p className="ui-section-label px-1">Cadence</p>
                      <div className="mt-1 flex flex-wrap gap-2 px-1">
                        {SCHEDULE_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setAutomationEditor((current) => current ? { ...current, schedule: preset.value } : current)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              automationEditor.schedule.trim().toLowerCase() === preset.value
                                ? 'border-violet-500/35 bg-violet-500/14 text-violet-100'
                                : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-violet-500/25 hover:text-white'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="ui-input-shell mt-2">
                        <input
                          value={automationEditor.schedule}
                          onChange={(event) => setAutomationEditor((current) => current ? { ...current, schedule: event.target.value } : current)}
                          aria-label="Cadence"
                          className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                          placeholder="Every Monday at 9am"
                        />
                      </div>
                      <p className="mt-1 px-1 text-xs leading-5 text-slate-400">Plain language works: every hour, daily at 6pm, every Monday at 9am.</p>
                    </div>

                    <label className="block sm:col-span-2">
                      <span className="ui-section-label px-1">Timezone</span>
                      <div className="ui-input-shell mt-1">
                        <select
                          value={automationEditor.timezone || getLocalTimeZone()}
                          onChange={(event) => setAutomationEditor((current) => current ? { ...current, timezone: event.target.value } : current)}
                          className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                        >
                          {COMMON_TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value} className="bg-slate-950 text-slate-100">
                              {tz.label}{tz.value === getLocalTimeZone() ? ' (your device)' : ''}
                            </option>
                          ))}
                          {!COMMON_TIMEZONES.some((tz) => tz.value === (automationEditor.timezone || getLocalTimeZone())) && (
                            <option value={automationEditor.timezone || getLocalTimeZone()} className="bg-slate-950 text-slate-100">
                              {automationEditor.timezone || getLocalTimeZone()}
                            </option>
                          )}
                        </select>
                      </div>
                      <p className="mt-1 px-1 text-xs leading-5 text-slate-400">Schedule times are evaluated in this timezone.</p>
                    </label>
                  </div>

                  <div className="block rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                    <p className="ui-section-label px-1">Result destination</p>
                    <div className="mt-2 flex flex-wrap gap-2 px-1">
                      {[
                        { label: 'Slack', value: 'slack', placeholder: '#all-purple-orange or C0APS37V8V8' },
                        { label: 'Email', value: 'email', placeholder: 'max@purpleorange.io' },
                        { label: 'None', value: 'none', placeholder: '' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateAutomationDestination(
                            option.value as AutomationEditorDraft['destinationType'],
                            option.value === 'none' ? '' : automationEditor.notify || option.placeholder,
                          )}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            automationEditor.destinationType === option.value
                              ? 'border-cyan-500/35 bg-cyan-500/14 text-cyan-100'
                              : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-cyan-500/25 hover:text-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="ui-input-shell mt-2">
                      <input
                        value={automationEditor.notify}
                        onChange={(event) => updateAutomationDestination(automationEditor.destinationType, event.target.value)}
	                        aria-label="Result destination"
	                        className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none disabled:text-slate-600"
	                        placeholder={automationEditor.destinationType === 'email' ? 'max@purpleorange.io' : 'Slack channel name or ID'}
	                        disabled={automationEditor.destinationType === 'none'}
	                      />
	                    </div>
	                    {automationEditor.destinationType === 'slack' && automationEditor.notify && !isLikelySlackTarget(automationEditor.notify) ? (
	                      <p className="mt-2 px-1 text-xs leading-5 text-amber-300">
	                        Use a Slack channel name like <span className="font-mono">#all-purple-orange</span> or an ID like <span className="font-mono">C0APS37V8V8</span>.
	                      </p>
	                    ) : (
	                      <p className="mt-2 px-1 text-xs leading-5 text-slate-400">
	                        {automationEditor.destinationType === 'slack'
	                          ? <>Slack names and IDs work when the Violema app can see the channel. Invite it to private channels first.</>
	                          : automationEditor.destinationType === 'email'
	                            ? 'Email delivery uses the configured Postmark sender.'
	                            : 'No delivery target will be attached until you add one.'}
	                      </p>
	                    )}
                  </div>

                  <WorkflowReadinessPanel report={workflowReadiness} getBlockerAction={getReadinessBlockerAction} />

                  <details
                    className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3"
                    open={automationSetupOptionalOpen}
                    onToggle={(event) => setAutomationSetupOptionalOpen(event.currentTarget.open)}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100 [&::-webkit-details-marker]:hidden">
                      Optional context and run guard
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="ui-section-label px-1">Context</span>
                        <div className="ui-input-shell mt-1">
                          <textarea
                            value={automationEditor.description}
                            onChange={(event) => setAutomationEditor((current) => current ? { ...current, description: event.target.value } : current)}
                            rows={3}
                            className="w-full resize-none bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                            placeholder="What should someone know when reviewing this later?"
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="ui-section-label px-1">Run guard</span>
                        <div className="ui-input-shell mt-1">
                          <input
                            value={automationEditor.condition}
                            onChange={(event) => setAutomationEditor((current) => current ? { ...current, condition: event.target.value } : current)}
                            className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                            placeholder="Only if failure count exceeds 3"
                          />
                        </div>
                        <p className="mt-1 px-1 text-xs leading-5 text-slate-400">Leave empty when the schedule should run every time.</p>
                      </label>
                    </div>
                  </details>
                </>
              )}

              {automationEditorSection === 'workflow' && (
                <>
              <div className="rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/90">Workflow authoring</p>
                <p className="mt-1 text-sm leading-6 text-slate-200">Use guided steps for a precise runbook, or describe the whole workflow in plain language for speed.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAutomationEditor((current) => current ? {
                      ...current,
                      authoringMode: 'guided',
                      steps: current.steps.length > 0 ? current.steps : buildWorkflowBlocksFromPrompt(current.workflowPrompt),
                    } : current)}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                      automationEditor.authoringMode === 'guided'
                        ? 'border-violet-500/35 bg-violet-500/14 text-violet-100'
                        : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-violet-500/25 hover:text-white'
                    }`}
                  >
                    Guided steps
                    <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">Best when each action should be explicit.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutomationEditor((current) => current ? {
                      ...current,
                      authoringMode: 'describe',
                      workflowPrompt: current.workflowPrompt.trim() || buildWorkflowPromptFromBlocks(current.steps),
                    } : current)}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                      automationEditor.authoringMode === 'describe'
                        ? 'border-cyan-500/35 bg-cyan-500/14 text-cyan-100'
                        : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-cyan-500/25 hover:text-white'
                    }`}
                  >
                    Describe it
                    <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">Best when you know the outcome, not every tool call.</span>
                  </button>
                </div>
              </div>
              {automationEditor.authoringMode === 'guided' ? (
              <div className="block">
                <div className="flex items-end justify-between gap-3 px-1">
                  <div>
                    <p className="ui-section-label">Workflow steps</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">One clear instruction per step. Display labels are optional.</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 px-1">
                  {ACTION_TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => addAutomationTemplate(template.block)}
                      className="rounded-full border border-white/10 bg-navy-950/45 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-violet-500/25 hover:text-white"
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
                      <div className="mt-3 grid gap-2 md:grid-cols-[180px,minmax(0,1fr)]">
                        <div>
                          <p className="mb-1 px-1 text-xs font-medium text-slate-400">Step type</p>
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
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="mb-1 px-1 text-xs font-medium text-slate-400">Instruction</p>
                            <div className="ui-input-shell">
                              <input
                                value={step.objective}
                                onChange={(event) => updateAutomationStep(index, event.target.value)}
                                className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                placeholder="What should Violema do in this step?"
                              />
                            </div>
                          </div>
                          <details className="rounded-xl border border-navy-700/70 bg-navy-900/35 px-3 py-2">
                            <summary className="cursor-pointer list-none text-xs font-medium text-slate-400 [&::-webkit-details-marker]:hidden">
                              Optional display label
                            </summary>
                            <div className="ui-input-shell mt-2">
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
                                placeholder="Short label for run history"
                              />
                            </div>
                          </details>
                          {step.kind === 'deliver' && (() => {
                            const stepTarget = step.deliveryTarget || (
                              automationEditor.destinationType !== 'none' && automationEditor.notify
                                ? {
                                    channel: automationEditor.destinationType === 'email' ? 'email' as const : 'slack' as const,
                                    target: automationEditor.notify,
                                  }
                                : null
                            );
                            const deliveryType = stepTarget?.channel || automationEditor.destinationType;
                            const deliveryValue = stepTarget?.target || '';
                            return (
                              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="px-1 text-xs font-medium text-cyan-100">Delivery destination</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[
                                      { label: 'Slack', value: 'slack' },
                                      { label: 'Email', value: 'email' },
                                      { label: 'None', value: 'none' },
                                    ].map((option) => (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => updateAutomationStepDeliveryTarget(
                                          index,
                                          option.value as AutomationEditorDraft['destinationType'],
                                          option.value === 'none' ? '' : deliveryValue || (option.value === 'email' ? 'max@purpleorange.io' : '#all-purple-orange'),
                                        )}
                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                          deliveryType === option.value
                                            ? 'border-cyan-400/35 bg-cyan-400/15 text-cyan-100'
                                            : 'border-white/10 bg-navy-950/45 text-slate-400 hover:border-cyan-500/25 hover:text-white'
                                        }`}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="ui-input-shell mt-2">
                                  <input
                                    value={deliveryValue}
                                    onChange={(event) => updateAutomationStepDeliveryTarget(
                                      index,
                                      deliveryType === 'none' ? 'slack' : deliveryType,
                                      event.target.value,
                                    )}
                                    className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none disabled:text-slate-600"
                                    placeholder={deliveryType === 'email' ? 'max@purpleorange.io' : '#all-purple-orange or C0APS37V8V8'}
                                    disabled={deliveryType === 'none'}
                                  />
                                </div>
                                {deliveryType === 'slack' && deliveryValue && !isLikelySlackTarget(deliveryValue) ? (
                                  <p className="mt-2 px-1 text-xs leading-5 text-amber-300">
                                    Use a Slack channel like <span className="font-mono">#all-purple-orange</span> or a channel ID.
                                  </p>
                                ) : (
                                  <p className="mt-2 px-1 text-xs leading-5 text-slate-400">
                                    This stays synced with the workflow result destination, so saving from this tab sends the channel you see here.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {step.kind === 'search' && (
                            <div>
                              <p className="mb-1 px-1 text-xs font-medium text-slate-400">Search query override</p>
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
                                  placeholder="Leave empty to use the instruction"
                                />
                              </div>
                            </div>
                          )}
                          {step.kind === 'query' && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <p className="mb-1 px-1 text-xs font-medium text-slate-400">Data source</p>
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
                              </div>
                              <div>
                                <p className="mb-1 px-1 text-xs font-medium text-slate-400">Query name</p>
                                <div className="ui-input-shell">
                                {(() => {
                                  const src = typeof step.inputs?.source === 'string' ? step.inputs.source : 'stripe';
                                  const opts = QUERY_TYPE_OPTIONS[src] ?? QUERY_TYPE_OPTIONS.custom;
                                  const currentVal = typeof step.inputs?.query_type === 'string' ? step.inputs.query_type : '';
                                  const isCustom = src === 'custom' || !opts.some((o) => o.value === currentVal);
                                  return (
                                    <>
                                      <select
                                        value={isCustom && src !== 'custom' ? '__custom__' : currentVal || opts[0]?.value || ''}
                                        onChange={(event) => {
                                          const value = event.target.value === '__custom__' ? '' : event.target.value;
                                          setAutomationEditor((current) => {
                                            if (!current) return current;
                                            const steps = [...current.steps];
                                            steps[index] = { ...steps[index], inputs: { ...(steps[index].inputs || {}), query_type: value } };
                                            return { ...current, steps };
                                          });
                                        }}
                                        className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                                      >
                                        {opts.map((o) => (
                                          <option key={o.value} value={o.value} className="bg-slate-950 text-slate-100">{o.label}</option>
                                        ))}
                                        {src !== 'custom' && <option value="__custom__" className="bg-slate-950 text-slate-400">Custom…</option>}
                                      </select>
                                      {(src === 'custom' || (isCustom && src !== 'custom')) && (
                                        <input
                                          value={currentVal}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            setAutomationEditor((current) => {
                                              if (!current) return current;
                                              const steps = [...current.steps];
                                              steps[index] = { ...steps[index], inputs: { ...(steps[index].inputs || {}), query_type: value } };
                                              return { ...current, steps };
                                            });
                                          }}
                                          className="mt-1 w-full bg-transparent px-3 py-2 text-sm text-slate-100 outline-none border-t border-navy-700/60"
                                          placeholder="e.g. failed_payments"
                                        />
                                      )}
                                    </>
                                  );
                                })()}
                                </div>
                              </div>
                            </div>
                          )}
                          {step.kind === 'capture' && (
                            <div>
                              <p className="mb-1 px-1 text-xs font-medium text-slate-400">Page or asset URL</p>
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
              </div>
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
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/90">Agent setup</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      Keep this on system recommended unless the workflow has a clear reason to spend more, review harder, or run extra worker lanes.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value: 'recommended' as const,
                        label: 'System recommended',
                        description: 'Violema balances quality, cost, and review depth from the workflow complexity.',
                      },
                      {
                        value: 'custom' as const,
                        label: 'Custom policy',
                        description: 'Manually tune optimization goal, review strictness, and extra worker lanes.',
                      },
                    ].map((option) => {
                      const isSelected = automationEditor.executionPolicy.mode === option.value;
                      return (
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
                          className={`rounded-2xl border p-3 text-left transition-colors ${
                            isSelected
                              ? 'border-cyan-500/35 bg-cyan-500/14 text-cyan-100'
                              : 'border-white/10 bg-navy-950/35 text-slate-300 hover:border-cyan-500/25 hover:text-white'
                          }`}
                        >
                          <span className="text-sm font-semibold">{option.label}</span>
                          <span className="mt-1 block text-xs font-normal leading-5 text-slate-400">{option.description}</span>
                        </button>
                      );
                    })}
                  </div>

                  {automationEditor.executionPolicy.mode === 'recommended' ? (
                    <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                      <p className="text-sm font-semibold text-white">Recommended policy is active</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        The system will use balanced quality, standard review, and up to {automationEditorPolicyMath.recommendedElasticLanes} extra worker lanes for this workflow shape.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                        <p className="ui-section-label">Optimization goal</p>
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
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                automationEditor.executionPolicy.optimizationGoal === option.value
                                  ? 'border-violet-500/35 bg-violet-500/14 text-violet-100'
                                  : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-violet-500/25 hover:text-white'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                        <p className="ui-section-label">Review policy</p>
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
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                automationEditor.executionPolicy.reviewPolicy === option.value
                                  ? 'border-violet-500/35 bg-violet-500/14 text-violet-100'
                                  : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-violet-500/25 hover:text-white'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3 sm:col-span-2">
                        <p className="ui-section-label">Extra worker lanes</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Higher lanes can finish broad workflows faster, but they increase credit pressure.</p>
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
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                automationEditor.executionPolicy.maxElasticLanes === count
                                  ? 'border-cyan-500/35 bg-cyan-500/14 text-cyan-100'
                                  : 'border-white/10 bg-navy-950/45 text-slate-300 hover:border-cyan-500/25 hover:text-white'
                              }`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                    <p className="ui-section-label">Why this setup</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      This workflow has {automationEditorPolicyMath.stepCount} steps, {automationEditorPolicyMath.toolCalls} expected tool calls, and lane demand {automationEditorPolicyMath.recommendedElasticLanes}. Stronger reasoning is reserved for workflows where the complexity justifies the extra spend.
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
                      Mission work stays here. Advanced holds run analysis, replay, preset comparison, and worker tuning.
                    </p>
                  </div>
                  {automationEditor.mode === 'edit' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/agents?automation=${automationEditor.id}`)}
                      className="ui-pill shrink-0 px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200"
                    >
                      Open Advanced
                    </button>
                  ) : (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                      Create first, tune after
                    </span>
                  )}
                </div>
              </div>
              {hasUnconfiguredDelivery ? (
                <p className="mb-2 text-right text-[11px] text-amber-400">
                  Add a notification target in Setup before saving — your workflow has a Deliver step with no destination.
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAutomationEditor}
                  className="ui-button-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    pendingRunAfterSave.current = true;
                    void handleAutomationEditorSave();
                  }}
                  disabled={actionBusy === 'save' || !automationEditor.name.trim() || !automationEditor.schedule.trim() || !hasAutomationSteps || hasUnconfiguredDelivery}
                  className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionBusy === 'save' && pendingRunAfterSave.current ? 'Saving…' : 'Save & run'}
                </button>
                <button
                  type="button"
                  onClick={() => { void handleAutomationEditorSave(); }}
                  disabled={actionBusy === 'save' || !automationEditor.name.trim() || !automationEditor.schedule.trim() || !hasAutomationSteps || hasUnconfiguredDelivery}
                  className="ui-button-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionBusy === 'save' ? 'Saving…' : automationEditor.mode === 'create' ? 'Create schedule' : 'Save changes'}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
