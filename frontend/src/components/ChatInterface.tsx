import { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Send, ChevronDown, AlertCircle, Square, ChevronDownCircle,
  Copy, Check, Clock, Brain, ThumbsUp, ThumbsDown, Zap, Shield, Eye, RefreshCw, Sparkles,
} from 'lucide-react';
import type { Message, ToolCall, SSEEvent, AutonomyMode } from '../types';
import { resolveWorkspaceContext } from '../lib/workspace';
import BillingGateBar from './BillingGateBar';

// ─── Markdown renderer ───────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-200">$1</em>')
    .replace(/```(\w+)?\n([\s\S]+?)```/g, (_, lang, code) => {
      const langLabel = lang ? `<span class="absolute top-2 right-3 text-[10px] text-slate-500 font-mono uppercase tracking-wider">${lang}</span>` : '';
      return `<div class="relative my-3"><pre class="bg-[#0d1117] border border-navy-700 rounded-xl p-4 overflow-x-auto">${langLabel}<code class="text-cyan-300 text-sm font-mono leading-relaxed">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
    })
    .replace(/`([^`]+)`/g, '<code class="bg-navy-900 text-violet-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-violet-500 pl-4 text-slate-400 italic my-2">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="border-navy-700 my-4" />')
    .replace(/^- (.+)$/gm, '<li class="text-slate-300 ml-4">$1</li>')
    .replace(/^• (.+)$/gm, '<li class="text-slate-300 ml-4">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="text-slate-300 ml-4 list-decimal">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="list-disc pl-5 my-2 space-y-1">${m}</ul>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-400 hover:text-violet-300 underline underline-offset-2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-3 text-slate-300 leading-relaxed">')
    .replace(/\n/g, '<br />')
    .replace(/^/, '<p class="mb-3 text-slate-300 leading-relaxed">')
    .replace(/$/, '</p>');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, string> = {
  web_search: '🔍',
  browser_screenshot: '📸',
  run_code: '⚡',
  create_task: '✅',
  send_message: '📨',
  query_data: '📊',
  generate_report: '📋',
  schedule_automation: '🔁',
};

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Searching the web',
  browser_screenshot: 'Capturing screenshot',
  run_code: 'Running code',
  create_task: 'Creating task',
  send_message: 'Sending message',
  query_data: 'Querying data',
  generate_report: 'Generating report',
  schedule_automation: 'Scheduling automation',
};

const MODE_CONFIG = {
  autonomous: {
    label: 'Autonomous',
    icon: Zap,
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-800/40',
    description: 'Full auto — acts without confirmation',
  },
  cautious: {
    label: 'Cautious',
    icon: Shield,
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/20 border-yellow-800/40',
    description: 'Explains before acting',
  },
  supervised: {
    label: 'Supervised',
    icon: Eye,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20 border-cyan-800/40',
    description: 'Step-by-step with full reasoning',
  },
} as const;

const SUGGESTIONS_BY_MODE: Record<AutonomyMode, string[]> = {
  autonomous: [
    'Pull MRR from Stripe and compare to last month',
    'Search for AI agent trends and summarize key insights',
    'Write a Python script to calculate CAC from HubSpot',
    'Create a task: Review Q1 metrics by end of week',
  ],
  cautious: [
    'What are the open GitHub issues and their priorities?',
    'Generate a weekly digest from Stripe and Linear',
    'Search for competitor pricing changes this month',
    'Schedule a daily standup summary automation',
  ],
  supervised: [
    'Walk me through setting up a revenue dashboard',
    'Analyze our funnel step-by-step using PostHog data',
    'Debug why our CAC increased this month',
    'Build a competitive analysis for our pricing page',
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CopyButton = memo(function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-all duration-150 ${
        copied
          ? 'bg-green-900/40 border-green-700/50 text-green-400'
          : 'bg-navy-800 border-navy-700 text-slate-500 hover:text-slate-300 hover:border-navy-600'
      } ${className}`}
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
});

const ConfidenceBar = memo(function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 90 ? 'bg-green-400' : score >= 75 ? 'bg-yellow-400' : 'bg-red-400';
  const label =
    score >= 90 ? 'High confidence' : score >= 75 ? 'Moderate confidence' : 'Low confidence';
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <div className="w-14 h-1 bg-navy-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-600">{score}%</span>
    </div>
  );
});

function ThinkingBlock({
  content,
  isStreaming,
  defaultExpanded = false,
}: {
  content: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || isStreaming || false);
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-violet-900/30 bg-violet-950/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-violet-950/20 transition-colors text-left"
      >
        <Brain
          className={`w-3.5 h-3.5 flex-shrink-0 ${isStreaming ? 'text-violet-400 animate-pulse' : 'text-violet-500'}`}
        />
        <span className={`text-xs font-medium ${isStreaming ? 'text-violet-400' : 'text-violet-500'}`}>
          {isStreaming ? 'Thinking…' : 'Reasoning'}
        </span>
        {isStreaming && (
          <span className="flex gap-1 ml-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="w-1 h-1 bg-violet-400 rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        )}
        {!isStreaming && (
          <>
            <span className="ml-auto text-[10px] text-slate-700">{wordCount} words</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-700 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>
      {expanded && content && (
        <div className="px-3.5 pb-3 border-t border-violet-900/20">
          <p className="thinking-text text-[11px] font-mono leading-relaxed mt-2.5 whitespace-pre-wrap">
            {content}
            {isStreaming && (
              <span className="inline-block w-1 h-3 bg-violet-400 ml-0.5 animate-pulse" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}

const ToolCallBlock = memo(function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[toolCall.name] || '🔧';
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;
  const isDone = toolCall.status === 'complete';
  const elapsed = toolCall.elapsedMs;
  const confidence = toolCall.confidence;

  const inputSummary = toolCall.input
    ? (Object.values(toolCall.input)[0] as string | undefined)
    : undefined;

  return (
    <div className="my-2 bg-navy-950 border border-navy-700/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-900/60 transition-colors text-left"
      >
        <span className="text-base leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            {isDone ? (
              <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                ✓ Done
              </span>
            ) : (
              <span className="text-[10px] text-violet-400 bg-violet-400/10 border border-violet-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Running
              </span>
            )}
            {isDone && elapsed !== undefined && (
              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}
              </span>
            )}
            {isDone && confidence !== undefined && <ConfidenceBar score={confidence} />}
          </div>
          {inputSummary && typeof inputSummary === 'string' && (
            <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
              {inputSummary.slice(0, 72)}{inputSummary.length > 72 ? '…' : ''}
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-600 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-navy-800/60">
          {toolCall.input && (
            <div>
              <div className="flex items-center justify-between mt-3 mb-1.5">
                <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Input</p>
                <CopyButton text={JSON.stringify(toolCall.input, null, 2)} />
              </div>
              <pre className="text-xs text-cyan-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Output</p>
                <CopyButton text={JSON.stringify(toolCall.result, null, 2)} />
              </div>
              <pre className="text-xs text-green-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto max-h-52">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function MessageBubble({
  message,
  autonomyMode,
  onReaction,
}: {
  message: Message;
  autonomyMode: AutonomyMode;
  onReaction?: (id: string, r: 'positive' | 'negative') => void;
}) {
  const isUser = message.role === 'user';
  const [hovered, setHovered] = useState(false);
  const showThinkingExpanded = autonomyMode === 'supervised';

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%] bg-violet-600/20 border border-violet-600/30 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-3 mb-6 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center shadow-glow-violet mt-0.5">
        <span className="text-xs text-white font-bold">N</span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-violet-300">Nexus</span>
          {!message.isStreaming && <ModelBadge />}
          <span className="text-xs text-slate-600">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.content && !message.isStreaming && hovered && (
            <CopyButton text={message.content} className="ml-1" />
          )}
          {/* Reactions */}
          {!message.isStreaming && message.content && (
            <div
              className={`flex items-center gap-0.5 ml-auto transition-opacity duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}
            >
              <button
                onClick={() => onReaction?.(message.id, 'positive')}
                className={`p-1.5 rounded-lg transition-colors ${
                  message.reaction === 'positive'
                    ? 'bg-green-900/40 text-green-400'
                    : 'text-slate-600 hover:bg-navy-800 hover:text-slate-300'
                }`}
                title="Good response"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onReaction?.(message.id, 'negative')}
                className={`p-1.5 rounded-lg transition-colors ${
                  message.reaction === 'negative'
                    ? 'bg-red-900/40 text-red-400'
                    : 'text-slate-600 hover:bg-navy-800 hover:text-slate-300'
                }`}
                title="Bad response"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Thinking block */}
        {message.thinking && (
          <ThinkingBlock
            content={message.thinking}
            isStreaming={message.isThinking}
            defaultExpanded={showThinkingExpanded}
          />
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-3">
            {message.toolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div
            className="prose-nexus text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}

        {/* Loading state */}
        {message.isStreaming && !message.content && !message.thinking && !message.toolCalls?.length && (
          <div className="flex items-center gap-1.5 py-2">
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  autonomyMode?: AutonomyMode;
}

// Model tier badge shown on assistant messages
function ModelBadge() {
  return (
    <span className="model-badge-opus" title="Powered by claude-opus-4-6">
      opus-4
    </span>
  );
}

export default function ChatInterface({
  conversationId,
  initialMessages = [],
  onMessagesChange,
  autonomyMode = 'cautious',
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'working'>('idle');
  const [lastUserInput, setLastUserInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }, []);

  useEffect(() => {
    if (onMessagesChange) onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  };

  const updateMessage = useCallback((id: string, updater: (msg: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const handleReaction = useCallback((msgId: string, reaction: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, reaction: m.reaction === reaction ? null : reaction }
          : m
      )
    );
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setError(null);
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      const assistantId = `assistant-${Date.now()}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        toolCalls: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setLastUserInput(text.trim());
      setIsLoading(true);
      setAgentStatus('thinking');

      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const allMessages = [
        ...messagesRef.current.filter((m) => !m.isStreaming),
        userMsg,
      ].map((m) => ({ role: m.role, content: m.content }));

      abortControllerRef.current = new AbortController();

      try {
        const workspace = resolveWorkspaceContext();
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Workspace-Id': workspace.workspaceId,
            'X-Workspace-Name': workspace.workspaceName,
          },
          body: JSON.stringify({
            messages: allMessages,
            conversationId,
            autonomyMode,
            workspaceId: workspace.workspaceId,
            workspaceName: workspace.workspaceName,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            let event: SSEEvent;
            try {
              event = JSON.parse(data);
            } catch {
              continue;
            }

            if (event.type === 'thinking_start') {
              setAgentStatus('thinking');
              updateMessage(assistantId, (m) => ({ ...m, isThinking: true, thinking: m.thinking ?? '' }));
            } else if (event.type === 'thinking' && event.content) {
              updateMessage(assistantId, (m) => ({
                ...m,
                thinking: (m.thinking ?? '') + event.content!,
              }));
            } else if (event.type === 'text' && event.content) {
              setAgentStatus('working');
              updateMessage(assistantId, (m) => ({
                ...m,
                isThinking: false,
                content: m.content + event.content!,
              }));
            } else if (event.type === 'tool_start') {
              setAgentStatus('working');
              updateMessage(assistantId, (m) => ({
                ...m,
                isThinking: false,
                toolCalls: [
                  ...(m.toolCalls || []),
                  {
                    id: event.tool_id!,
                    name: event.tool_name!,
                    status: 'running' as const,
                    startedAt: event.started_at ?? Date.now(),
                  },
                ],
              }));
            } else if (event.type === 'tool_input') {
              updateMessage(assistantId, (m) => ({
                ...m,
                toolCalls: (m.toolCalls || []).map((tc) =>
                  tc.id === event.tool_id ? { ...tc, input: event.input } : tc
                ),
              }));
            } else if (event.type === 'tool_result') {
              updateMessage(assistantId, (m) => ({
                ...m,
                toolCalls: (m.toolCalls || []).map((tc) =>
                  tc.id === event.tool_id
                    ? {
                        ...tc,
                        result: event.result,
                        status: 'complete' as const,
                        elapsedMs: event.elapsed_ms,
                        confidence: event.confidence,
                      }
                    : tc
                ),
              }));
            } else if (event.type === 'done') {
              setAgentStatus('idle');
              updateMessage(assistantId, (m) => ({ ...m, isStreaming: false, isThinking: false }));
            } else if (event.type === 'error') {
              setAgentStatus('idle');
              setError(event.message || 'An error occurred');
              updateMessage(assistantId, (m) => ({
                ...m,
                isStreaming: false,
                isThinking: false,
                content: m.content || 'Sorry, I encountered an error. Please try again.',
              }));
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setAgentStatus('idle');
          return;
        }
        const errMsg = err instanceof Error ? err.message : 'Failed to connect to server';
        setError(errMsg);
        updateMessage(assistantId, (m) => ({
          ...m,
          isStreaming: false,
          isThinking: false,
          content: 'Sorry, I encountered an error. Please check that the backend is running and try again.',
        }));
      } finally {
        setIsLoading(false);
        setAgentStatus('idle');
        updateMessage(assistantId, (m) => ({ ...m, isStreaming: false, isThinking: false }));
      }
    },
    [isLoading, conversationId, autonomyMode, updateMessage]
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setAgentStatus('idle');
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false, isThinking: false } : m))
    );
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const suggestions = SUGGESTIONS_BY_MODE[autonomyMode];
  const modeConfig = MODE_CONFIG[autonomyMode];
  const modeLabel = modeConfig.label || 'Supervised';
  const ModeIcon = modeConfig.icon;
  const isCreditError = Boolean(error && /insufficient credits|credits exhausted|add a top-up|upgrade your plan/i.test(error));

  const statusText = {
    idle: 'Ready',
    thinking: 'Reasoning…',
    working: 'Working…',
  }[agentStatus];

  const statusColor = {
    idle: 'bg-green-400',
    thinking: 'bg-violet-400',
    working: 'bg-cyan-400',
  }[agentStatus];

  return (
    <div className="flex flex-col h-full relative">
      {/* Agent status bar */}
      <div className="flex items-center gap-2 px-3.5 sm:px-4 py-2 border-b border-navy-800/40 bg-gradient-to-r from-navy-900/30 via-navy-900/20 to-violet-950/10 backdrop-blur-sm">
        <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${agentStatus !== 'idle' ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-slate-500">{statusText}</span>
        <div className={`ml-auto flex items-center gap-1.5 text-[10px] border rounded-full px-2.5 py-1 ${modeConfig.bg} ${modeConfig.color} shadow-sm`}>
          <ModeIcon className="w-3 h-3" />
          {modeConfig.label}
        </div>
      </div>

      <div className="px-3 sm:px-6 pt-2 sm:pt-3">
        <div className="max-w-3xl mx-auto">
          <BillingGateBar compact />
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full items-center justify-center px-1 py-6 sm:py-10">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[1.8rem] border border-violet-500/12 bg-gradient-to-br from-navy-900/86 via-navy-900/72 to-navy-950/94 px-4 py-5 sm:px-6 sm:py-7 shadow-[0_24px_64px_rgba(2,6,23,0.34)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_35%)]" />
              <div className="relative flex flex-col items-center text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/15 bg-violet-500/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300">
                  <Sparkles className="h-3 w-3" />
                  Nexus workspace
                </div>
                <div className="mb-5 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-violet-500 to-violet-700 rounded-[1.15rem] flex items-center justify-center shadow-glow-violet ring-1 ring-white/10">
                  <span className="text-xl sm:text-2xl font-bold text-white">N</span>
                </div>
                <h2 className="text-[1.55rem] sm:text-2xl font-bold text-white">Hey, I'm Nexus</h2>
                <p className="mt-1 text-[10px] sm:text-[11px] text-violet-400/60 font-medium tracking-[0.28em] uppercase">by Purple Orange AI</p>
                <p className="mt-4 max-w-xl text-slate-300 leading-relaxed">
                  Your AI coworker, tuned for{' '}
                  <span className={`font-semibold ${modeConfig.color}`}>{modeLabel.toLowerCase()}</span>
                  {' '}work. Ask for research, automations, screenshots, or just start with a task.
                </p>
                <p className="mt-2 text-slate-500 text-sm">{modeConfig.description}. Switch modes in the sidebar.</p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-navy-700/80 bg-navy-950/60 px-3 py-1 text-[10px] font-medium text-slate-400">Research</span>
                  <span className="rounded-full border border-navy-700/80 bg-navy-950/60 px-3 py-1 text-[10px] font-medium text-slate-400">Automate</span>
                  <span className="rounded-full border border-navy-700/80 bg-navy-950/60 px-3 py-1 text-[10px] font-medium text-slate-400">Inspect</span>
                  <span className="rounded-full border border-navy-700/80 bg-navy-950/60 px-3 py-1 text-[10px] font-medium text-slate-400">Draft</span>
                </div>

                <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                  <div className="rounded-2xl border border-navy-700/70 bg-navy-950/50 p-3 text-left">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/70">Start here</p>
                    <p className="mt-1 text-sm font-medium text-white">Ask for a search, a summary, or a plan.</p>
                  </div>
                  <div className="rounded-2xl border border-navy-700/70 bg-navy-950/50 p-3 text-left">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">System state</p>
                    <p className="mt-1 text-sm font-medium text-white">Mode, credits, and automation gate are visible above.</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(suggestion)}
                  className="text-left px-4 py-3 bg-navy-800/60 border border-navy-700/60 hover:border-violet-600/50 hover:bg-navy-700/70 rounded-2xl text-sm text-slate-400 hover:text-slate-200 transition-all duration-200 leading-snug shadow-[0_12px_30px_rgba(2,6,23,0.16)]"
                >
                  {suggestion}
                </button>
              ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                autonomyMode={autonomyMode}
                onReaction={handleReaction}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {!isAtBottom && (
        <button
          onClick={() => {
            setIsAtBottom(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          aria-label="Scroll to bottom"
          className="absolute bottom-24 right-6 w-9 h-9 bg-navy-800/90 border border-navy-700/80 hover:border-violet-600 rounded-full flex items-center justify-center shadow-[0_12px_28px_rgba(2,6,23,0.28)] transition-all duration-200 z-10 backdrop-blur-sm"
        >
          <ChevronDownCircle className="w-5 h-5 text-slate-400" />
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 sm:mx-4 mb-2 px-4 py-3 bg-red-950/60 border border-red-800/60 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm">{error}</p>
            {isCreditError && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => window.location.assign('/#pricing')}
                  className="rounded-lg border border-red-800/50 px-2.5 py-1.5 text-[11px] text-red-200 hover:bg-red-900/30 transition-colors"
                >
                  Upgrade plan
                </button>
                <button
                  onClick={() => window.location.assign('/dashboard')}
                  className="rounded-lg border border-red-800/50 px-2.5 py-1.5 text-[11px] text-red-200 hover:bg-red-900/30 transition-colors"
                >
                  Open billing
                </button>
              </div>
            )}
          </div>
          {lastUserInput && (
            <button
              onClick={() => { setError(null); sendMessage(lastUserInput); }}
              className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200 border border-red-800/50 rounded-lg px-2.5 py-1.5 hover:bg-red-900/30 transition-colors flex-shrink-0"
              aria-label="Retry last message"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-300 text-xs ml-1 flex-shrink-0"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-6 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2 border-t border-navy-800/60 bg-gradient-to-t from-navy-950/40 to-transparent">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2.5 rounded-[1.35rem] border border-navy-700/60 bg-gradient-to-br from-navy-800/72 via-navy-800/58 to-navy-900/72 px-3.5 py-2.5 shadow-[0_18px_42px_rgba(2,6,23,0.24)] transition-all duration-200 focus-within:border-violet-600/50 sm:px-4 sm:py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Nexus… (Shift+Enter for new line)"
              className="flex-1 bg-transparent text-slate-100 placeholder-slate-600 resize-none outline-none text-sm leading-relaxed chat-input"
              rows={1}
              disabled={isLoading}
            />
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-red-600/80 hover:bg-red-500 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm"
                aria-label="Stop generating"
              >
                <Square className="w-3.5 h-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-violet-600 hover:bg-violet-500 disabled:bg-navy-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 shadow-glow-violet disabled:shadow-none ring-1 ring-white/10"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-700 leading-tight">
            Nexus can make mistakes. Verify important information.
            <kbd className="ml-2 text-[10px] bg-navy-800 border border-navy-700 px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>{' '}
            to focus
          </div>
        </div>
      </div>
    </div>
  );
}
