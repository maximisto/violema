import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Settings, ChevronRight, Zap, LogOut,
  X, CheckSquare, Clock, AlertCircle, Sparkles, PanelLeftClose, PanelLeftOpen, Trash2,
  Eye, Shield, Search,
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import type { Conversation, Message, AutonomyMode } from '../types';

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

async function fetchSmartTitle(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const res = await fetch('/api/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json() as { title: string };
    return data.title || 'New conversation';
  } catch {
    return messages[0]?.content?.slice(0, 45) || 'New conversation';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadConvos();
    return saved.length > 0 ? saved : SAMPLE_CONVOS;
  });
  const [activeConvoId, setActiveConvoId] = useState<string>('new');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false); // hidden by default on mobile feel
  const [newConvoMessages, setNewConvoMessages] = useState<Message[]>([]);
  const [hoveredConvoId, setHoveredConvoId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('cautious');
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const activeMode = MODE_BUTTONS.find((m) => m.mode === autonomyMode)!;

  // Persist conversations
  useEffect(() => { saveConvos(conversations); }, [conversations]);

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
    [activeConvoId]
  );

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

  const ModeSelector = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-1 bg-navy-800 border border-navy-700 rounded-xl p-1 ${compact ? 'w-full' : ''}`}>
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
              ? `${activeClass} border`
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          <Icon className={mode === 'supervised' ? 'w-5 h-5 text-red-400' : 'w-3 h-3'} />
          {label && <span>{label}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="w-64 flex-shrink-0 bg-navy-900 border-r border-navy-800 flex flex-col sidebar-enter">
          {/* Logo */}
          <div className="flex items-center gap-2 px-4 py-4 border-b border-navy-800">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg"
              aria-label="Go to Nexus home"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-glow-violet">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm leading-tight group-hover:text-violet-300 transition-colors">
                  Nexus
                </span>
                <span className="text-[8px] text-violet-400/60 leading-none font-medium tracking-widest uppercase">
                  by Purple Orange AI
                </span>
              </div>
            </button>
            <span className="ml-auto text-[10px] bg-violet-900/50 text-violet-300 border border-violet-800/50 rounded-full px-2 py-0.5 font-medium flex-shrink-0">
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
          <div className="px-3 pt-3 pb-2 space-y-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-glow-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>
            {/* Mode selector visible on ALL screen sizes via sidebar */}
            <ModeSelector compact />
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="w-full bg-navy-800 border border-navy-700 focus:border-violet-700 rounded-lg text-xs text-slate-300 placeholder-slate-600 pl-8 pr-3 py-1.5 outline-none transition-colors"
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
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            <p className="px-2 py-1 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              {searchQuery ? `${filteredConvos.length} result${filteredConvos.length !== 1 ? 's' : ''}` : 'Recent'}
            </p>

            {filteredConvos.length === 0 && searchQuery && (
              <p className="px-3 py-4 text-xs text-slate-600 text-center">No conversations found</p>
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
                  onClick={() => setActiveConvoId(convo.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                    activeConvoId === convo.id
                      ? 'bg-navy-800 text-white'
                      : 'text-slate-400 hover:bg-navy-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2 pr-6">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-snug">{convo.title}</p>
                      {convo.lastMessage && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 leading-snug">
                          {convo.lastMessage}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-700 mt-0.5">{formatTime(convo.timestamp)}</p>
                    </div>
                  </div>
                </button>

                {/* Delete button / confirm */}
                {hoveredConvoId === convo.id && (
                  deleteConfirmId === convo.id ? (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-navy-900 border border-red-800/60 rounded-lg px-2 py-1 shadow-lg z-10">
                      <span className="text-[10px] text-red-400 font-medium">Delete?</span>
                      <button
                        onClick={(e) => handleDeleteConvo(convo.id, e)}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold ml-1"
                        aria-label="Confirm delete"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
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
          <div className="border-t border-navy-800 px-3 py-3 space-y-1">
            <button
              onClick={() => {/* settings panel placeholder */}}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-navy-800 hover:text-slate-200 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-navy-800 hover:text-slate-200 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <LogOut className="w-4 h-4" />
              Back to home
            </button>
            <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
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
        <header className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-navy-800 bg-navy-900/50 backdrop-blur-sm flex-shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded p-0.5"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{convoTitle}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
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
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              taskPanelOpen
                ? 'bg-violet-900/30 border-violet-700/50 text-violet-300'
                : 'bg-navy-800 border-navy-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tasks</span>
          </button>
        </header>

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
            <aside className="w-72 flex-shrink-0 border-l border-navy-800 bg-navy-900/30 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-navy-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Automations</h3>
                </div>
                <button
                  onClick={() => setTaskPanelOpen(false)}
                  aria-label="Close tasks panel"
                  className="text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {SAMPLE_TASKS.map((task) => {
                  const Icon = task.icon;
                  return (
                    <div
                      key={task.id}
                      className="bg-navy-800 border border-navy-700 rounded-xl p-3 hover:border-navy-600 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex-shrink-0 ${
                            task.status === 'alert'
                              ? 'text-red-400'
                              : task.status === 'complete'
                              ? 'text-green-400'
                              : 'text-violet-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                task.status === 'alert'
                                  ? 'bg-red-950 text-red-400 border border-red-900'
                                  : task.status === 'complete'
                                  ? 'bg-green-950 text-green-400 border border-green-900'
                                  : 'bg-violet-950 text-violet-400 border border-violet-900'
                              }`}
                            >
                              {task.status}
                            </span>
                            <span className="text-[10px] text-slate-500">{task.time}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 mt-0.5 transition-colors flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-navy-800">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-navy-700 text-slate-500 hover:border-violet-700 hover:text-violet-400 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  <Plus className="w-4 h-4" />
                  Schedule automation
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
