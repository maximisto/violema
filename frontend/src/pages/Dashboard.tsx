import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Settings, ChevronRight, Zap, LogOut,
  X, CheckSquare, Clock, AlertCircle, Sparkles, PanelLeftClose, PanelLeftOpen, Trash2,
  Eye, Shield, Search, CreditCard, ArrowUpRight, Pin, Archive, RotateCcw, ChevronUp, ChevronDown,
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import TopUpChooser from '../components/TopUpChooser';
import { fetchCreditEstimate, formatCredits, getSuggestedTopUpOfferId, getSuggestedUpgradePlanId, openBillingCheckout, useCreditSnapshot } from '../lib/credits';
import { resolveWorkspaceContext } from '../lib/workspace';
import type { Conversation, Message, AutonomyMode } from '../types';

const PO_LOGO = '/po-logo.png';

// ─── Persistence ──────────────────────────────────────────────────────────────

function saveConvos(convos: Conversation[]) {
  try {
    localStorage.setItem('nexus_convos', JSON.stringify(convos));
  } catch { /* ignore quota errors */ }
}

function loadConvos(): Conversation[] {
  try {
    const raw = localStorage.getItem('nexus_convos');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Conversation & {
      timestamp: string;
      messages: Array<Message & { timestamp: string }>;
    }>;
    return parsed.map((c) => ({
      ...c,
      pinned: Boolean(c.pinned),
      archived: Boolean(c.archived),
      tags: Array.isArray(c.tags) ? c.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      timestamp: new Date(c.timestamp),
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch { return []; }
}

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_CONVOS: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Q1 revenue analysis',
    lastMessage: 'Sent MRR summary to #revenue-team — growth +17.8%',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    messages: [],
  },
  {
    id: 'conv-2',
    title: 'GitHub PR triage',
    lastMessage: 'Found 3 PRs needing review, 2 auto-merged',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    messages: [],
  },
  {
    id: 'conv-3',
    title: 'HubSpot lead enrichment',
    lastMessage: 'Enriched 47 new leads from LinkedIn data',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    messages: [],
  },
];

const SAMPLE_TASKS = [
  { id: 1, title: 'Weekly revenue report', status: 'scheduled', time: 'Mon 9am', icon: Clock },
  { id: 2, title: 'PR review digest', status: 'scheduled', time: 'Daily 5pm', icon: Clock },
  { id: 3, title: 'Lead enrichment batch', status: 'complete', time: 'Just now', icon: CheckSquare },
  { id: 4, title: 'Anomaly alert: CAC spike', status: 'alert', time: '2h ago', icon: AlertCircle },
];

const SCHEDULE_PRESETS = [
  { label: 'Hourly', value: 'every hour' },
  { label: 'Every 4 hours', value: 'every 4 hours' },
  { label: 'Daily 9am', value: 'daily at 9am' },
  { label: 'Every monday', value: 'every monday at 9am' },
];

const ACTION_TEMPLATES = [
  'Query Stripe failed payments',
  'Query PostHog funnel',
  'Search the web for competitor moves',
  'Capture a browser screenshot',
  'Generate summary',
  'Send alert to Slack',
  'Send email digest',
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
  startedAt: string;
  finishedAt?: string;
  metadata?: Record<string, unknown>;
}

interface AutomationApiRecord {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  actions: string[];
  notify?: string;
  condition?: string;
  status: 'active' | 'paused';
  created_at: string;
}

interface DashboardTaskItem {
  id: string | number;
  title: string;
  status: DashboardTaskStatus;
  time: string;
  icon: typeof Clock;
  description?: string;
  source: 'sample' | 'live';
  modelTier?: string;
  agentRole?: string;
  runStatus?: string;
  automationId?: string;
  schedule?: string;
  notify?: string;
  condition?: string;
  actions?: string[];
  automationStatus?: 'active' | 'paused';
}

interface AutomationEditorDraft {
  mode: 'create' | 'edit';
  id: string;
  name: string;
  schedule: string;
  description: string;
  notify: string;
  condition: string;
  actions: string[];
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

function formatRelativeTimeFromIso(iso: string) {
  return formatTime(new Date(iso));
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
  const navigate = useNavigate();
  const [isMobileSidebar, setIsMobileSidebar] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadConvos();
    return saved.length > 0 ? saved : SAMPLE_CONVOS;
  });
  const [activeConvoId, setActiveConvoId] = useState<string>('new');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [taskPanelOpen, setTaskPanelOpen] = useState(false); // hidden by default on mobile feel
  const [selectedTaskId, setSelectedTaskId] = useState<string | number>(SAMPLE_TASKS[0]?.id ?? 0);
  const [newConvoMessages, setNewConvoMessages] = useState<Message[]>([]);
  const [hoveredConvoId, setHoveredConvoId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('cautious');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('all');
  const [platformTasks, setPlatformTasks] = useState<DashboardTaskItem[]>([]);
  const [liveAutomations, setLiveAutomations] = useState<DashboardTaskItem[]>([]);
  const [uiNotice, setUiNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [actionBusy, setActionBusy] = useState<'run' | 'pause' | 'edit' | 'save' | null>(null);
  const [automationEditor, setAutomationEditor] = useState<AutomationEditorDraft | null>(null);
  const [automationEstimate, setAutomationEstimate] = useState<CreditEstimatePreview | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [topUpChooserOpen, setTopUpChooserOpen] = useState(false);
  const [topUpBusyOfferId, setTopUpBusyOfferId] = useState<ReturnType<typeof getSuggestedTopUpOfferId> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { snapshot } = useCreditSnapshot();

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
  useEffect(() => { saveConvos(conversations); }, [conversations]);

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
    const controller = new AbortController();
    const workspace = resolveWorkspaceContext();
    const headers = {
      'X-Workspace-Id': workspace.workspaceId,
      'X-Workspace-Name': workspace.workspaceName,
    };

    Promise.all([
      fetch('/api/automations', {
        headers,
        signal: controller.signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('automations')))),
      fetch(`/api/platform/tasks?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, {
        headers,
        signal: controller.signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('tasks')))),
      fetch(`/api/platform/task-runs?workspace_id=${encodeURIComponent(workspace.workspaceId)}&workspace_name=${encodeURIComponent(workspace.workspaceName)}`, {
        headers,
        signal: controller.signal,
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error('runs')))),
    ])
      .then(([automationPayload, taskPayload, runPayload]) => {
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

        const liveTasks = tasks
          .slice(0, 12)
          .map((task) => {
            const latestRun = latestRunByTask.get(task.id);
            const status = mapPlatformStatus(latestRun?.status || task.status);
            return {
              id: task.id,
              title: task.title,
              status,
              time: formatRelativeTimeFromIso(latestRun?.finishedAt || latestRun?.startedAt || task.updatedAt),
              icon: mapTaskIcon(status),
              description: task.description,
              source: 'live' as const,
              modelTier: latestRun?.modelTier,
              agentRole: latestRun?.agentRole,
              runStatus: latestRun?.status,
            };
          });

        const automationItems = automations
          .slice(0, 12)
          .map((automation) => ({
            id: automation.id,
            title: automation.name,
            status: automation.status === 'paused' ? 'alert' as DashboardTaskStatus : 'scheduled' as DashboardTaskStatus,
            time: automation.schedule,
            icon: automation.status === 'paused' ? AlertCircle : Clock,
            description: automation.description,
            source: 'live' as const,
            automationId: automation.id,
            schedule: automation.schedule,
            notify: automation.notify,
            condition: automation.condition,
            actions: automation.actions,
            automationStatus: automation.status,
          }));

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
      })
      .catch(() => {
        setLiveAutomations([]);
        setPlatformTasks([]);
      });

    return () => controller.abort();
  }, []);

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

  useEffect(() => {
    if (!automationEditor) {
      setAutomationEstimate(null);
      return undefined;
    }

    const timeout = window.setTimeout(async () => {
      const actionCount = automationEditor.actions.filter((item) => item.trim()).length;
      const estimate = await fetchCreditEstimate({
        taskKind: 'automation',
        modelTier: actionCount > 3 ? 'ops' : 'default',
        toolCalls: Math.max(1, actionCount),
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

  const refreshAutomations = useCallback(async () => {
    const workspace = resolveWorkspaceContext();
    const headers = {
      'X-Workspace-Id': workspace.workspaceId,
      'X-Workspace-Name': workspace.workspaceName,
    };
    const response = await fetch('/api/automations', { headers });
    if (!response.ok) throw new Error('Could not refresh automations');
    const payload = await response.json() as { items?: AutomationApiRecord[] };
    const items = Array.isArray(payload.items) ? payload.items : [];
    const mapped = items.slice(0, 12).map((automation) => ({
      id: automation.id,
      title: automation.name,
      status: automation.status === 'paused' ? 'alert' as DashboardTaskStatus : 'scheduled' as DashboardTaskStatus,
      time: automation.schedule,
      icon: automation.status === 'paused' ? AlertCircle : Clock,
      description: automation.description,
      source: 'live' as const,
      automationId: automation.id,
      schedule: automation.schedule,
      notify: automation.notify,
      condition: automation.condition,
      actions: automation.actions,
      automationStatus: automation.status,
    }));
    setLiveAutomations(mapped);
    setSelectedTaskId((current) => {
      if (!mapped.length) return current;
      return mapped.some((item) => item.id === current) ? current : mapped[0].id;
    });
  }, []);

  const showNotice = useCallback((tone: 'success' | 'error', message: string) => {
    setUiNotice({ tone, message });
  }, []);

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

  const handleAutomationEdit = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    setAutomationEditor({
      mode: 'edit',
      id: task.automationId,
      name: task.title,
      schedule: task.schedule || task.time,
      description: task.description || '',
      notify: task.notify || '',
      condition: task.condition || '',
      actions: Array.isArray(task.actions) && task.actions.length > 0 ? task.actions : ['Generate summary'],
      destinationType: task.notify?.startsWith('#') ? 'slack' : task.notify?.includes('@') ? 'email' : task.notify ? 'custom' : 'none',
    });
  }, []);

  const handleAutomationCreate = useCallback(() => {
    setAutomationEditor({
      mode: 'create',
      id: `draft-${Date.now()}`,
      name: '',
      schedule: 'every monday at 9am',
      description: '',
      notify: '#ops-alerts',
      condition: '',
      actions: ['Query Stripe failed payments', 'Generate summary', 'Send alert to Slack'],
      destinationType: 'slack',
    });
  }, []);

  const handleAutomationEditorSave = useCallback(async () => {
    if (!automationEditor) return;
    setActionBusy('save');
    try {
      const actions = automationEditor.actions
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch(
        automationEditor.mode === 'create' ? '/api/automations' : `/api/automations/${automationEditor.id}`,
        {
        method: automationEditor.mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: automationEditor.name.trim(),
          schedule: automationEditor.schedule.trim(),
          description: automationEditor.description.trim() || null,
          notify: automationEditor.notify.trim() || null,
          condition: automationEditor.condition.trim() || null,
          actions,
        }),
      });
      if (!response.ok) throw new Error('Could not save automation');
      const payload = await response.json() as { item?: { id?: string } };
      await refreshAutomations();
      if (automationEditor.mode === 'create' && payload.item?.id) {
        setSelectedTaskId(payload.item.id);
      }
      setAutomationEditor(null);
      showNotice('success', `${automationEditor.mode === 'create' ? 'Created' : 'Updated'} "${automationEditor.name.trim() || 'automation'}"`);
    } catch {
      showNotice('error', automationEditor.mode === 'create' ? 'Could not create automation' : 'Could not save automation changes');
    } finally {
      setActionBusy(null);
    }
  }, [automationEditor, refreshAutomations, showNotice]);

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

  const taskItems: DashboardTaskItem[] = liveAutomations.length > 0
    ? liveAutomations
    : platformTasks.length > 0
    ? platformTasks
    : SAMPLE_TASKS.map((task) => ({
        ...task,
        status: task.status as DashboardTaskStatus,
        description: undefined,
        source: 'sample' as const,
      }));

  const taskSummary = taskItems.reduce(
    (acc, task) => {
      acc[task.status as DashboardTaskStatus] += 1;
      return acc;
    },
    { scheduled: 0, complete: 0, alert: 0 }
  );
  const selectedTask = taskItems.find((task) => task.id === selectedTaskId) ?? taskItems[0];
  const selectedTaskMeta = selectedTask ? getTaskStatusMeta(selectedTask.status as 'scheduled' | 'complete' | 'alert') : null;
  const lowCreditRunway = snapshot.projectedDaysLeft <= 7;
  const automationActionCount = useMemo(() => {
    if (!automationEditor) return 0;
    return automationEditor.actions
      .map((item) => item.trim())
      .filter(Boolean).length;
  }, [automationEditor]);
  const hasAutomationSteps = automationActionCount > 0;

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
      const actions = [...current.actions];
      actions[index] = value;
      return { ...current, actions };
    });
  }, []);

  const moveAutomationStep = useCallback((index: number, direction: -1 | 1) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.actions.length) return current;
      const actions = [...current.actions];
      const [item] = actions.splice(index, 1);
      actions.splice(nextIndex, 0, item);
      return { ...current, actions };
    });
  }, []);

  const removeAutomationStep = useCallback((index: number) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      const actions = current.actions.filter((_, actionIndex) => actionIndex !== index);
      return { ...current, actions: actions.length > 0 ? actions : [''] };
    });
  }, []);

  const appendAutomationStep = useCallback((value = '') => {
    setAutomationEditor((current) => {
      if (!current) return current;
      return { ...current, actions: [...current.actions, value] };
    });
  }, []);

  const handleAutomationStepDrop = useCallback((targetIndex: number) => {
    setAutomationEditor((current) => {
      if (!current || draggedStepIndex === null || draggedStepIndex === targetIndex) return current;
      const actions = [...current.actions];
      const [draggedAction] = actions.splice(draggedStepIndex, 1);
      actions.splice(targetIndex, 0, draggedAction);
      return { ...current, actions };
    });
    setDraggedStepIndex(null);
  }, [draggedStepIndex]);

  const addAutomationTemplate = useCallback((template: string) => {
    setAutomationEditor((current) => {
      if (!current) return current;
      if (current.actions.includes(template)) return current;
      return { ...current, actions: [...current.actions.filter(Boolean), template] };
    });
  }, []);

  useEffect(() => {
    if (!selectedTask && taskItems[0]) {
      setSelectedTaskId(taskItems[0].id);
    }
  }, [selectedTask, taskItems]);

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
    setTopUpChooserOpen(true);
  };

  const handleTopUpSelect = async (offerId: ReturnType<typeof getSuggestedTopUpOfferId>) => {
    setTopUpBusyOfferId(offerId);
    try {
      const opened = await openBillingCheckout({ kind: 'top-up', offerId });
      if (opened) return;
    } catch {
      // fall through
    } finally {
      setTopUpBusyOfferId(null);
      setTopUpChooserOpen(false);
    }
    window.location.assign('/#pricing');
  };

  const openUpgrade = async () => {
    const nextPlanId = getSuggestedUpgradePlanId(snapshot.planName);
    if (!nextPlanId) {
      window.location.assign('mailto:sales@purpleorange.io?subject=Nexus%20Enterprise');
      return;
    }
    try {
      const opened = await openBillingCheckout({
        kind: 'subscription',
        planId: nextPlanId,
      });
      if (opened) return;
    } catch {
      // fall through
    }
    window.location.assign('/#pricing');
  };

  const duplicateSelectedAutomation = useCallback(() => {
    if (!selectedTask) return;
    setAutomationEditor({
      mode: 'create',
      id: `draft-${Date.now()}`,
      name: `${selectedTask.title} copy`,
      schedule: selectedTask.schedule || selectedTask.time || 'every monday at 9am',
      description: selectedTask.description || '',
      notify: selectedTask.notify || '#ops-alerts',
      condition: selectedTask.condition || '',
      actions: Array.isArray(selectedTask.actions) && selectedTask.actions.length > 0 ? selectedTask.actions : ['Generate summary'],
      destinationType: selectedTask.notify?.startsWith('#') ? 'slack' : selectedTask.notify?.includes('@') ? 'email' : selectedTask.notify ? 'custom' : 'none',
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

      <TopUpChooser
        open={topUpChooserOpen}
        recommendedOfferId={getSuggestedTopUpOfferId(snapshot)}
        busyOfferId={topUpBusyOfferId}
        onClose={() => {
          if (!topUpBusyOfferId) setTopUpChooserOpen(false);
        }}
        onSelect={(offerId) => { void handleTopUpSelect(offerId); }}
      />

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
              ? 'fixed inset-y-2 left-2 z-40 w-[calc(100vw-1rem)] max-w-[19.75rem] rounded-[1.5rem] shadow-[0_24px_64px_rgba(2,6,23,0.55)]'
              : 'w-72 flex-shrink-0'
          } border-r border-navy-800 bg-navy-900 flex flex-col sidebar-enter`}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-navy-800">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl pr-1"
              aria-label="Go to Nexus home"
            >
              <div className="w-9 h-9 overflow-hidden flex-shrink-0">
                <img src={PO_LOGO} alt="Purple Orange AI" className="po-logo w-full h-full object-contain" />
              </div>
              <div className="brand-lockup w-[10rem]">
                <span className="brand-wordmark text-[1.02rem]">
                  NEXUS
                </span>
                <span className="brand-submark text-[7.9px]">
                  by Purple Orange AI
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
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
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
                  onClick={() => {/* settings panel placeholder */}}
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
              <span className="text-xs text-slate-500">Nexus ready</span>
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
            <span className="hidden lg:inline">Tasks</span>
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
                Automations
              </button>
            </div>
          </div>
        )}

        {/* Chat body */}
        <div className="flex flex-1 min-h-0">
          <div className="flex min-h-0 flex-1 min-w-0">
            <ChatInterface
              key={activeConvoId}
              conversationId={activeConvoId}
              initialMessages={currentMessages}
              onMessagesChange={handleMessagesChange}
              autonomyMode={autonomyMode}
            />
          </div>

      {/* Task panel */}
      {taskPanelOpen && (
            <aside
              className={`${
                isMobileSidebar
                  ? 'fixed inset-x-2 bottom-2 top-20 z-40 rounded-[1.5rem] shadow-[0_24px_64px_rgba(2,6,23,0.58)]'
                  : 'w-72 flex-shrink-0'
              } border-l border-navy-800/80 bg-gradient-to-b from-navy-900/60 via-navy-900/36 to-navy-950/60 flex flex-col overflow-hidden backdrop-blur-md shadow-[inset_1px_0_0_rgba(255,255,255,0.03)]`}
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-navy-800/80 bg-gradient-to-r from-violet-500/8 via-navy-950/30 to-cyan-500/6">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-violet-500/15 bg-violet-500/8 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-600">Workspace</p>
                    <h3 className="text-sm font-semibold text-white">Automations</h3>
                  </div>
                </div>
                <button
                  onClick={() => setTaskPanelOpen(false)}
                  aria-label="Close tasks panel"
                  className="text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-3 pt-3">
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

              <div className="px-3 pt-3">
                <div className="rounded-[1.4rem] border border-violet-500/15 bg-gradient-to-br from-violet-500/8 via-navy-900/70 to-navy-950/92 p-3.5 shadow-[0_16px_34px_rgba(2,6,23,0.16)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Selected automation</p>
                      <h4 className="mt-1 text-sm font-semibold leading-snug text-white">{selectedTask?.title}</h4>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${selectedTaskMeta?.chip ?? 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                      {selectedTaskMeta?.label ?? 'Scheduled'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                      <p className="uppercase tracking-[0.18em] text-slate-600">Cadence</p>
                      <p className="mt-1 text-slate-200">{selectedTask?.time}</p>
                    </div>
                    <div className="rounded-xl border border-navy-700/60 bg-navy-950/45 px-2.5 py-2.5">
                      <p className="uppercase tracking-[0.18em] text-slate-600">Status</p>
                      <p className="mt-1 text-slate-200">{selectedTaskMeta?.label ?? 'Scheduled'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                      {selectedTask?.source === 'live' ? 'Live task' : 'Preview task'}
                    </span>
                    {selectedTask?.agentRole && (
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {selectedTask.agentRole}
                      </span>
                    )}
                    {selectedTask?.modelTier && (
                      <span className="ui-pill px-2 py-0.5 normal-case tracking-normal text-slate-300">
                        {selectedTask.modelTier}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    {selectedTask?.description
                      ? selectedTask.description
                      : selectedTask?.status === 'alert'
                      ? 'This automation needs attention. Use the controls below to inspect, pause, or update it before the next run.'
                      : selectedTask?.status === 'complete'
                        ? 'This workflow is running cleanly. Keep it active or copy the pattern into another workflow.'
                        : 'This workflow is on schedule. Open it for details or tweak the cadence before the next run.'}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => { void handleAutomationRun(selectedTask); }}
                      disabled={selectedTask?.source !== 'live' || actionBusy !== null}
                      className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300 transition-colors hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionBusy === 'run' ? 'Running…' : 'Run now'}
                    </button>
                    <button
                      onClick={() => { void handleAutomationPauseToggle(selectedTask); }}
                      disabled={selectedTask?.source !== 'live' || actionBusy !== null}
                      className="flex-1 rounded-xl border border-navy-700/70 bg-navy-950/35 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-navy-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionBusy === 'pause' ? 'Saving…' : selectedTask?.automationStatus === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={() => { void handleAutomationEdit(selectedTask); }}
                      disabled={selectedTask?.source !== 'live' || actionBusy !== null}
                      className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300 transition-colors hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                  </div>
                  {selectedTask?.source === 'live' && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={duplicateSelectedAutomation}
                        className="flex-1 rounded-xl border border-navy-700/70 bg-navy-950/35 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-navy-900/70"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={handleAutomationCreate}
                        className="flex-1 rounded-xl border border-cyan-500/20 bg-cyan-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:bg-cyan-500/12"
                      >
                        New from template
                      </button>
                    </div>
                  )}
                  {selectedTask?.source === 'live' && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Tune cadence, workflow steps, delivery, and burn without leaving the dashboard.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {taskItems.map((task) => {
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
                      className={`border rounded-2xl p-3.5 transition-all cursor-pointer group shadow-[0_12px_28px_rgba(2,6,23,0.14)] hover:shadow-[0_16px_34px_rgba(2,6,23,0.22)] ${
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
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 mt-0.5 transition-all flex-shrink-0 ${
                          isSelected ? 'text-violet-300 rotate-0' : 'text-slate-600 group-hover:text-slate-300'
                        }`} />
                      </div>
                    </div>
                  );
                })}
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
          )}
        </div>
      </div>

      {automationEditor && (
        <>
          <button
            type="button"
            aria-label="Close automation editor"
            onClick={() => setAutomationEditor(null)}
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          />
          <aside className="absolute right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-navy-700/80 bg-gradient-to-b from-navy-900/98 via-navy-900/96 to-navy-950/98 shadow-[0_24px_64px_rgba(2,6,23,0.58)]">
            <div className="flex items-center justify-between border-b border-navy-800/80 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600">Automation editor</p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  {automationEditor.mode === 'create' ? 'Create workflow' : 'Edit workflow'}
                </h3>
              </div>
              <button
                onClick={() => setAutomationEditor(null)}
                className="rounded-xl border border-navy-700/80 bg-navy-900/55 p-2 text-slate-400 transition-colors hover:text-white"
                aria-label="Close automation editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Builder</p>
                <p className="mt-1 text-sm text-white">Set the cadence, stack the steps, pick the destination, and watch the credit pressure update.</p>
              </div>

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

              <label className="block">
                <span className="ui-section-label px-1">Workflow steps</span>
                <div className="mt-1 flex flex-wrap gap-2 px-1">
                  {ACTION_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => addAutomationTemplate(template)}
                      className="ui-pill px-2.5 py-1 text-[10px] normal-case tracking-normal text-slate-300"
                    >
                      + {template}
                    </button>
                  ))}
                </div>
                <div className="mt-2 space-y-2">
                  {automationEditor.actions.map((action, index) => (
                    <div
                      key={`${automationEditor.id}-${index}`}
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
                            disabled={index === automationEditor.actions.length - 1}
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
                      <div className="ui-input-shell mt-2">
                        <input
                          value={action}
                          onChange={(event) => updateAutomationStep(index, event.target.value)}
                          className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 outline-none"
                          placeholder="Generate summary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => appendAutomationStep('')}
                    className="ui-button-ghost"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add step
                  </button>
                </div>
                <p className="mt-1 px-1 text-[11px] text-slate-500">Build the workflow one step at a time, then reorder or trim as needed.</p>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="ui-section-label px-1">Notify</span>
                  <div className="mt-1 flex flex-wrap gap-2 px-1">
                    {[
                      { label: 'Slack', value: 'slack', placeholder: '#ops-alerts' },
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
                      placeholder="#ops-alerts or max@purpleorange.io"
                      disabled={automationEditor.destinationType === 'none'}
                    />
                  </div>
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-navy-700/70 bg-navy-950/35 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Actions</p>
                  <p className="mt-1 text-lg font-semibold text-white">{automationActionCount}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Each line becomes a live automation step.</p>
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
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setAutomationEditor(null)}
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
