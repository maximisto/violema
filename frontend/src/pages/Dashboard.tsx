import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Settings, ChevronRight, Zap, LogOut,
  X, CheckSquare, Clock, AlertCircle, Sparkles, PanelLeftClose, PanelLeftOpen, Trash2,
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import type { Conversation, Message } from '../types';

// Serialise/deserialise conversations for localStorage (dates need special handling)
function saveConvos(convos: Conversation[]) {
  try {
    localStorage.setItem('nexus_convos', JSON.stringify(convos));
  } catch { /* ignore quota errors */ }
}

function loadConvos(): Conversation[] {
  try {
    const raw = localStorage.getItem('nexus_convos');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Conversation & { timestamp: string; messages: Array<Message & { timestamp: string }> }>;
    return parsed.map((c) => ({
      ...c,
      timestamp: new Date(c.timestamp),
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch { return []; }
}

const SAMPLE_CONVOS: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Q1 revenue analysis',
    lastMessage: 'Sent summary to #revenue-team',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    messages: [],
  },
  {
    id: 'conv-2',
    title: 'GitHub PR triage',
    lastMessage: 'Found 3 PRs needing review',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    messages: [],
  },
  {
    id: 'conv-3',
    title: 'HubSpot lead enrichment',
    lastMessage: 'Enriched 47 new leads',
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

function formatTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = loadConvos();
    return saved.length > 0 ? saved : SAMPLE_CONVOS;
  });
  const [activeConvoId, setActiveConvoId] = useState<string>('new');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);
  const [newConvoMessages, setNewConvoMessages] = useState<Message[]>([]);
  const [hoveredConvoId, setHoveredConvoId] = useState<string | null>(null);

  // Persist conversations on change
  useEffect(() => {
    saveConvos(conversations);
  }, [conversations]);

  const handleNewChat = () => {
    setActiveConvoId('new');
    setNewConvoMessages([]);
  };

  const handleDeleteConvo = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvoId === id) {
      setActiveConvoId('new');
      setNewConvoMessages([]);
    }
  }, [activeConvoId]);

  const handleMessagesChange = useCallback(
    (messages: Message[]) => {
      if (activeConvoId === 'new' && messages.length > 0) {
        setNewConvoMessages(messages);
        // Auto-title from first user message
        const firstUserMsg = messages.find((m) => m.role === 'user');
        if (firstUserMsg && messages.length === 2) {
          const title = firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '…' : '');
          const newConvo: Conversation = {
            id: `conv-${Date.now()}`,
            title,
            lastMessage: messages[messages.length - 1]?.content?.slice(0, 60),
            timestamp: new Date(),
            messages,
          };
          setConversations((prev) => [newConvo, ...prev]);
          setActiveConvoId(newConvo.id);
        }
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvoId
              ? { ...c, messages, lastMessage: messages[messages.length - 1]?.content?.slice(0, 60), timestamp: new Date() }
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

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="w-64 flex-shrink-0 bg-navy-900 border-r border-navy-800 flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-navy-800">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-glow-violet">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white group-hover:text-violet-300 transition-colors">Nexus</span>
            </button>
            <span className="ml-auto text-[10px] bg-violet-900/50 text-violet-300 border border-violet-800/50 rounded-full px-2 py-0.5 font-medium">
              Beta
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-1 text-slate-600 hover:text-slate-400 transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New chat */}
          <div className="px-3 py-3">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors shadow-glow-violet"
            >
              <Plus className="w-4 h-4" />
              New conversation
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            <p className="px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Recent</p>
            {conversations.map((convo) => (
              <div
                key={convo.id}
                onMouseEnter={() => setHoveredConvoId(convo.id)}
                onMouseLeave={() => setHoveredConvoId(null)}
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
                  <div className="flex items-start gap-2 pr-5">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{convo.title}</p>
                      {convo.lastMessage && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{convo.lastMessage}</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-0.5">{formatTime(convo.timestamp)}</p>
                    </div>
                  </div>
                </button>
                {hoveredConvoId === convo.id && (
                  <button
                    onClick={(e) => handleDeleteConvo(convo.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-red-400 transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* User / settings */}
          <div className="border-t border-navy-800 px-3 py-3 space-y-1">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-navy-800 hover:text-slate-200 text-sm transition-colors">
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-navy-800 hover:text-slate-200 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Back to home
            </button>
            <div className="flex items-center gap-2 px-3 py-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">You</p>
                <p className="text-[10px] text-slate-500 truncate">Free plan</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-navy-800 bg-navy-900/50 backdrop-blur-sm flex-shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors mr-1"
              title="Open sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{convoTitle}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-slate-500">Nexus is ready</span>
              {currentMessages.length > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500">{currentMessages.length} messages</span>
                </>
              )}
            </div>
          </div>

          {/* Tool indicators */}
          <div className="hidden md:flex items-center gap-1.5">
            {['Web Search', 'Code', 'Tasks', 'Messaging'].map((tool) => (
              <span
                key={tool}
                className="text-[10px] bg-navy-800 border border-navy-700 text-slate-400 rounded-md px-2 py-1"
              >
                {tool}
              </span>
            ))}
          </div>

          <button
            onClick={() => setTaskPanelOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              taskPanelOpen
                ? 'bg-violet-900/30 border-violet-700/50 text-violet-300'
                : 'bg-navy-800 border-navy-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Tasks
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
            />
          </div>

          {/* Task panel */}
          {taskPanelOpen && (
            <aside className="w-72 flex-shrink-0 border-l border-navy-800 bg-navy-900/30 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-navy-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Scheduled tasks</h3>
                </div>
                <button
                  onClick={() => setTaskPanelOpen(false)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
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
                          className={`mt-0.5 ${
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
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 mt-0.5 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add task */}
              <div className="p-3 border-t border-navy-800">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-navy-700 text-slate-500 hover:border-violet-700 hover:text-violet-400 text-sm transition-colors">
                  <Plus className="w-4 h-4" />
                  Schedule a task
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
