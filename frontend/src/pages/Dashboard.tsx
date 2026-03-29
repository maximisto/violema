import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Settings, ChevronRight, Zap, LogOut,
  X, CheckSquare, Clock, AlertCircle, Sparkles, PanelLeftClose, PanelLeftOpen, Trash2,
  Eye, Shield, Search,
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import CreditSurface from '../components/CreditSurface';
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
  const [platformTasks, setPlatformTasks] = useState<DashboardTaskItem[]>([]);
  const [liveAutomations, setLiveAutomations] = useState<DashboardTaskItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeMode = MODE_BUTTONS.find((m) => m.mode === autonomyMode)!;

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
  }, []);

  const handleAutomationRun = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    await fetch(`/api/automations/${task.automationId}/run`, { method: 'POST' });
  }, []);

  const handleAutomationPauseToggle = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    const nextStatus = task.automationStatus === 'paused' ? 'active' : 'paused';
    const response = await fetch(`/api/automations/${task.automationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) throw new Error('Could not update automation');
    await refreshAutomations();
  }, [refreshAutomations]);

  const handleAutomationEdit = useCallback(async (task: DashboardTaskItem | undefined) => {
    if (!task?.automationId) return;
    const nextSchedule = window.prompt('Update schedule', task.schedule || task.time);
    if (!nextSchedule || nextSchedule === task.schedule) return;
    const response = await fetch(`/api/automations/${task.automationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: nextSchedule }),
    });
    if (!response.ok) throw new Error('Could not update schedule');
    await refreshAutomations();
  }, [refreshAutomations]);

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
      !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastMessage ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] bg-navy-950 overflow-hidden">
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
              ? 'fixed inset-y-2 left-2 z-40 w-[calc(100vw-1rem)] max-w-[19rem] rounded-[1.5rem] shadow-[0_24px_64px_rgba(2,6,23,0.55)]'
              : 'w-[15.25rem] xl:w-[15.75rem] flex-shrink-0'
          } bg-gradient-to-b from-navy-900/98 via-navy-900/96 to-navy-950/98 border-r border-navy-800 flex flex-col sidebar-enter backdrop-blur-sm`}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-navy-800/80 bg-navy-950/25">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl pr-1"
              aria-label="Go to Nexus home"
            >
              <div className="w-8 h-8 overflow-hidden flex-shrink-0">
                <img src={PO_LOGO} alt="Purple Orange AI" className="po-logo w-full h-full object-contain" />
              </div>
              <div className="brand-lockup w-[8rem]">
                <span className="brand-wordmark text-[0.9rem]">
                  NEXUS
                </span>
                <span className="brand-submark text-[7.2px]">
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

          <div className="px-2.5 pt-2.5">
            <CreditSurface compact={isMobileSidebar} />
          </div>

          {/* New chat + Mode selector */}
          <div className="px-2.5 pt-2.5 pb-2 space-y-2">
            <button
              onClick={handleNewChat}
              className="ui-button-surface w-full justify-start"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>
            {/* Mode selector visible on ALL screen sizes via sidebar */}
            <div className="px-1.5 ui-section-label">
              Autonomy
            </div>
            <ModeSelector compact />
          </div>

          {/* Search */}
          <div className="px-2.5 pb-2">
            <div className="px-1.5 mb-1 ui-section-label">
              Search
            </div>
            <div className="ui-input-shell relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="w-full bg-transparent text-xs text-slate-300 placeholder-slate-600 pl-8 pr-3 py-2 outline-none"
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
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            <div className="px-2 pt-1 pb-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-600">
                  {searchQuery ? 'Search results' : 'Recent conversations'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {searchQuery
                    ? `${filteredConvos.length} match${filteredConvos.length !== 1 ? 'es' : ''}`
                    : 'Active threads and recent work'}
                </p>
              </div>
              <span className="rounded-full border border-navy-700/70 bg-navy-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {conversations.length} total
              </span>
            </div>

            {filteredConvos.length === 0 && searchQuery && (
              <div className="mx-2 rounded-2xl border border-dashed border-navy-700/70 bg-navy-900/35 px-3 py-5 text-center">
                <p className="text-xs text-slate-500">No conversations found</p>
                <p className="mt-1 text-[11px] text-slate-600">Try a shorter or different search term.</p>
              </div>
            )}

            {filteredConvos.map((convo) => (
              <div
                key={convo.id}
                onMouseEnter={() => setHoveredConvoId(convo.id)}
                onMouseLeave={() => {
                  setHoveredConvoId(null);
                  // don't clear deleteConfirmId here — let timeout handle it
                }}
                className="relative"
              >
                <button
                  onClick={() => {
                    setActiveConvoId(convo.id);
                    if (isMobileSidebar) setSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
                    activeConvoId === convo.id
                      ? 'bg-gradient-to-r from-violet-500/15 via-navy-800/95 to-navy-800/90 text-white border border-violet-500/25 shadow-[0_12px_28px_rgba(2,6,23,0.24)]'
                      : 'text-slate-400 border border-transparent bg-navy-900/20 hover:bg-navy-800/65 hover:text-slate-200 hover:border-navy-700/70'
                  }`}
                >
                  <div className="flex items-start gap-2.5 pr-7">
                    <div
                      className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                        activeConvoId === convo.id ? 'bg-violet-400 shadow-[0_0_0_4px_rgba(168,85,247,0.12)]' : 'bg-slate-700'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium truncate leading-snug tracking-[-0.01em]">{convo.title}</p>
                        <span className="text-[10px] text-slate-600 flex-shrink-0">{formatTime(convo.timestamp)}</span>
                      </div>
                      {convo.lastMessage && (
                        <p className="text-[10px] text-slate-500 truncate mt-1 leading-snug">{convo.lastMessage}</p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Delete button / confirm */}
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
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(convo.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-700 hover:text-red-400 transition-colors rounded"
                      aria-label={`Delete conversation "${convo.title}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>

          {/* User / settings */}
          <div className="border-t border-navy-800/80 px-2.5 py-2 space-y-1.5 bg-navy-950/15">
            <button
              onClick={() => {/* settings panel placeholder */}}
              className="ui-button-ghost w-full justify-start"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => navigate('/')}
              className="ui-button-ghost w-full justify-start"
            >
              <LogOut className="w-4 h-4" />
              Back to home
            </button>
            <div className="ui-panel mt-1 flex items-center gap-2.5 px-3 py-2.5 border-navy-800/60 shadow-none">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-700/40 to-navy-700 border border-violet-800/40 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">You</p>
                <p className="text-[10px] text-slate-600 truncate">Free plan · claude-opus-4-6</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main chat area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-3 sm:px-5 py-2.5 border-b border-navy-800/80 bg-gradient-to-r from-navy-950/92 via-navy-900/70 to-navy-950/92 backdrop-blur-md flex-shrink-0 shadow-[0_12px_30px_rgba(2,6,23,0.16)]">
          {(!sidebarOpen || isMobileSidebar) && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded p-0.5"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[13px] sm:text-sm font-semibold text-white truncate tracking-[-0.01em]">{convoTitle}</h1>
              <span className="rounded-full border border-green-500/15 bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-green-300">
                Ready
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_0_4px_rgba(74,222,128,0.08)]" />
              <span className="text-xs text-slate-500">Nexus ready</span>
              {currentMessages.length > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-600">{currentMessages.length} messages</span>
                </>
              )}
              <span className="text-slate-700">·</span>
              <span className={`text-xs ${activeMode.statusColor}`}>
                {activeMode.statusIcon} {activeMode.fullLabel}
              </span>
            </div>
          </div>

          {/* Mode selector — desktop only (mobile uses sidebar) */}
          <div className="hidden md:block">
            <ModeSelector />
          </div>

          <button
            onClick={() => setTaskPanelOpen((v) => !v)}
            aria-pressed={taskPanelOpen}
            aria-label="Toggle tasks panel"
            className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              taskPanelOpen
                ? 'bg-violet-900/30 border-violet-700/50 text-violet-300 shadow-sm'
                : 'bg-navy-800/80 border-navy-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tasks</span>
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
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0">
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
                          ? 'border-violet-500/15 bg-violet-500/6'
                          : stat.tone === 'green'
                            ? 'border-green-500/15 bg-green-500/6'
                            : 'border-amber-500/15 bg-amber-500/6'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{stat.label}</p>
                      <p className="mt-1 text-lg font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-3 pt-3">
                <div className="rounded-2xl border border-violet-500/15 bg-violet-500/6 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Selected automation</p>
                      <h4 className="mt-1 text-sm font-semibold text-white">{selectedTask?.title}</h4>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${selectedTaskMeta?.chip ?? 'border-navy-700 bg-navy-900 text-slate-400'}`}>
                      {selectedTaskMeta?.label ?? 'Scheduled'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div className="rounded-xl border border-navy-700/60 bg-navy-950/40 px-2.5 py-2">
                      <p className="uppercase tracking-[0.18em] text-slate-600">Cadence</p>
                      <p className="mt-1 text-slate-200">{selectedTask?.time}</p>
                    </div>
                    <div className="rounded-xl border border-navy-700/60 bg-navy-950/40 px-2.5 py-2">
                      <p className="uppercase tracking-[0.18em] text-slate-600">Next action</p>
                      <p className="mt-1 text-slate-200">Review / run / pause</p>
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
                      disabled={selectedTask?.source !== 'live'}
                      className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300 transition-colors hover:bg-violet-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Run now
                    </button>
                    <button
                      onClick={() => { void handleAutomationPauseToggle(selectedTask); }}
                      disabled={selectedTask?.source !== 'live'}
                      className="flex-1 rounded-xl border border-navy-700/70 bg-navy-950/35 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-navy-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selectedTask?.automationStatus === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={() => { void handleAutomationEdit(selectedTask); }}
                      disabled={selectedTask?.source !== 'live'}
                      className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300 transition-colors hover:bg-amber-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                  </div>
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
                      className={`bg-gradient-to-br ${meta.accent} border rounded-2xl p-3.5 transition-all cursor-pointer group shadow-[0_12px_28px_rgba(2,6,23,0.14)] hover:shadow-[0_16px_34px_rgba(2,6,23,0.22)] ${
                        isSelected
                          ? 'border-violet-500/40 ring-1 ring-violet-500/20 translate-y-[-1px]'
                          : 'border-navy-700/70 hover:border-violet-600/30'
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
                            <span className="text-[10px] text-slate-600">Automation pulse</span>
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
                <button className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border border-dashed border-violet-500/25 text-slate-300 hover:border-violet-400/50 hover:text-white text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 bg-navy-950/30 shadow-[0_8px_24px_rgba(2,6,23,0.12)]">
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
    </div>
  );
}
