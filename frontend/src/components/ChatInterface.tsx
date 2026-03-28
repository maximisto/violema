import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ChevronDown, AlertCircle } from 'lucide-react';
import type { Message, ToolCall, SSEEvent } from '../types';

// Simple markdown renderer
function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-3 mb-1.5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-200">$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre class="bg-navy-950 border border-navy-700 rounded-lg p-4 overflow-x-auto my-3"><code class="text-cyan-300 text-sm font-mono">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-navy-900 text-violet-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-violet-500 pl-4 text-slate-400 italic my-2">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-navy-700 my-4" />')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="text-slate-300 ml-4">$1</li>')
    .replace(/^• (.+)$/gm, '<li class="text-slate-300 ml-4">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="text-slate-300 ml-4 list-decimal">$1</li>')
    // Consecutive list items
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-5 my-2 space-y-1">${match}</ul>`)
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-400 hover:text-violet-300 underline underline-offset-2" target="_blank" rel="noopener">$1</a>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="mb-3 text-slate-300">')
    // Single newlines → <br>
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^/, '<p class="mb-3 text-slate-300">')
    .replace(/$/, '</p>');
}

const TOOL_ICONS: Record<string, string> = {
  web_search: '🔍',
  run_code: '⚡',
  create_task: '✅',
  send_message: '📨',
  query_data: '📊',
};

const TOOL_LABELS: Record<string, string> = {
  web_search: 'Searching the web',
  run_code: 'Running code',
  create_task: 'Creating task',
  send_message: 'Sending message',
  query_data: 'Querying data',
};

function ToolCallBlock({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[toolCall.name] || '🔧';
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;
  const isDone = toolCall.status === 'complete';

  return (
    <div className="my-2 bg-navy-950 border border-navy-700/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-navy-900/60 transition-colors text-left"
      >
        <span className="text-base">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            {isDone ? (
              <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Done</span>
            ) : (
              <span className="text-xs text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Running
              </span>
            )}
          </div>
          {toolCall.input && (
            <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
              {JSON.stringify(toolCall.input).slice(0, 80)}...
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-navy-800">
          {toolCall.input && (
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-3 mb-1.5">Input</p>
              <pre className="text-xs text-cyan-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1.5">Output</p>
              <pre className="text-xs text-green-300 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[70%] bg-violet-600/20 border border-violet-600/30 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center shadow-glow-violet mt-0.5">
        <span className="text-xs text-white font-bold">N</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-violet-300">Nexus</span>
          <span className="text-xs text-slate-600">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

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

        {/* Streaming cursor */}
        {message.isStreaming && !message.content && (
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

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

export default function ChatInterface({ conversationId, initialMessages = [], onMessagesChange }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  const adjustTextarea = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  };

  const updateStreamingMessage = useCallback((id: string, updater: (msg: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
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
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, conversationId }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

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

          if (event.type === 'text' && event.content) {
            updateStreamingMessage(assistantId, (m) => ({
              ...m,
              content: m.content + event.content!,
            }));
          } else if (event.type === 'tool_start') {
            const newTool: ToolCall = {
              id: event.tool_id!,
              name: event.tool_name!,
              status: 'running',
            };
            updateStreamingMessage(assistantId, (m) => ({
              ...m,
              toolCalls: [...(m.toolCalls || []), newTool],
            }));
          } else if (event.type === 'tool_input') {
            updateStreamingMessage(assistantId, (m) => ({
              ...m,
              toolCalls: (m.toolCalls || []).map((tc) =>
                tc.id === event.tool_id ? { ...tc, input: event.input } : tc
              ),
            }));
          } else if (event.type === 'tool_result') {
            updateStreamingMessage(assistantId, (m) => ({
              ...m,
              toolCalls: (m.toolCalls || []).map((tc) =>
                tc.id === event.tool_id ? { ...tc, result: event.result, status: 'complete' as const } : tc
              ),
            }));
          } else if (event.type === 'done') {
            updateStreamingMessage(assistantId, (m) => ({
              ...m,
              isStreaming: false,
            }));
          } else if (event.type === 'error') {
            setError(event.message || 'An error occurred');
            updateStreamingMessage(assistantId, (m) => ({
              ...m,
              isStreaming: false,
              content: m.content || 'Sorry, I encountered an error. Please try again.',
            }));
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Failed to connect to server';
      setError(errMsg);
      updateStreamingMessage(assistantId, (m) => ({
        ...m,
        isStreaming: false,
        content: 'Sorry, I encountered an error. Please check that the backend is running and try again.',
      }));
    } finally {
      setIsLoading(false);
      updateStreamingMessage(assistantId, (m) => ({ ...m, isStreaming: false }));
    }
  }, [messages, isLoading, conversationId, updateStreamingMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const SUGGESTIONS = [
    'Pull the MRR from Stripe and compare to last month',
    'Search for the latest AI news and summarize key trends',
    'Write a Python script to analyze CSV data',
    'Create a task: Review Q1 metrics by end of week',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-700 rounded-2xl flex items-center justify-center shadow-glow-violet mb-6">
              <span className="text-2xl font-bold text-white">N</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Hey, I'm Nexus</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Your AI coworker. I can execute tasks, search the web, run code, query your tools, and get things done. What should we work on?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(suggestion)}
                  className="text-left px-4 py-3 bg-navy-800/60 border border-navy-700/60 hover:border-violet-600/50 hover:bg-navy-700/60 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition-all duration-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-950/60 border border-red-800/60 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300 text-xs">Dismiss</button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 sm:px-6 pb-4 pt-2 border-t border-navy-800/60">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-navy-800/60 border border-navy-700/60 focus-within:border-violet-600/50 rounded-2xl px-4 py-3 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message Nexus... (Shift+Enter for new line)"
              className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 resize-none outline-none text-sm leading-relaxed chat-input"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-9 h-9 bg-violet-600 hover:bg-violet-500 disabled:bg-navy-700 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 shadow-glow-violet disabled:shadow-none"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-700 mt-2">
            Nexus can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
