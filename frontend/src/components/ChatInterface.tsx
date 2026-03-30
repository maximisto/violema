import { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  Send, ChevronDown, AlertCircle, Square, ChevronDownCircle,
  Copy, Check, Clock, Brain, ThumbsUp, ThumbsDown, Zap, Shield, Eye, RefreshCw, Sparkles,
} from 'lucide-react';
import type { Message, ToolCall, SSEEvent, AutonomyMode } from '../types';
import { fetchCreditEstimate, formatCredits, getSuggestedTopUpOfferId, openBillingCheckout, useCreditSnapshot } from '../lib/credits';
import { resolveWorkspaceContext } from '../lib/workspace';
import BillingGateBar from './BillingGateBar';

// ─── Markdown renderer ───────────────────────────────────────────────────────

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '<figure class="my-4 overflow-hidden rounded-2xl border border-navy-700/70 bg-navy-950/60"><img src="$2" alt="$1" class="w-full object-cover" /><figcaption class="px-3 py-2 text-[11px] text-slate-500">$1</figcaption></figure>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" class="text-violet-400 hover:text-violet-300 underline underline-offset-2" target="_blank" rel="noopener">$1</a>')
    .replace(/`([^`]+)`/g, '<code class="bg-navy-900 text-violet-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-200">$1</em>')
    .replace(/(?<!["(])(https?:\/\/[^\s<]+?\.(?:png|jpe?g|gif|webp))(?![^<]*>)/gi, '<figure class="my-4 overflow-hidden rounded-2xl border border-navy-700/70 bg-navy-950/60"><img src="$1" alt="Shared image" class="w-full object-cover" /></figure>');
}

function renderMarkdownTable(lines: string[]) {
  const rows = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => renderInlineMarkdown(cell.trim())));
  if (rows.length < 2) return '';
  const [header, , ...body] = rows;
  return `<div class="my-4 overflow-x-auto rounded-2xl border border-navy-700/70"><table class="min-w-full bg-navy-950/40"><thead><tr>${header.map((cell) => `<th class="border-b border-navy-700/70 bg-navy-900/85 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">${cell}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td class="border-t border-navy-800/60 px-3 py-2 text-sm text-slate-300">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let tableBuffer: string[] = [];
  let metricBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    html.push(`<p class="mb-3 text-slate-300 leading-relaxed">${renderInlineMarkdown(paragraphBuffer.join(' '))}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length || !listType) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    const classes = listType === 'ol' ? 'list-decimal' : 'list-disc';
    html.push(`<${tag} class="${classes} mb-3 space-y-1 pl-5">${listBuffer.map((item) => `<li class="text-slate-300">${renderInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
    listBuffer = [];
    listType = null;
  };

  const flushTable = () => {
    if (!tableBuffer.length) return;
    html.push(renderMarkdownTable(tableBuffer));
    tableBuffer = [];
  };

  const flushMetrics = () => {
    if (!metricBuffer.length) return;
    const metrics = metricBuffer
      .map((line) => {
        const match = line.match(/^([A-Za-z][A-Za-z0-9 /_-]{1,28}):\s+(.{1,72})$/);
        if (!match) return null;
        return {
          label: renderInlineMarkdown(match[1].trim()),
          value: renderInlineMarkdown(match[2].trim()),
        };
      })
      .filter((item): item is { label: string; value: string } => Boolean(item));

    if (metrics.length >= 2) {
      html.push(
        `<div class="my-4 grid gap-2 sm:grid-cols-2">${metrics
          .map(
            (metric) =>
              `<div class="rounded-2xl border border-navy-700/70 bg-navy-950/45 px-3 py-3"><p class="text-[10px] uppercase tracking-[0.18em] text-slate-600">${metric.label}</p><p class="mt-1 text-sm font-medium text-white">${metric.value}</p></div>`
          )
          .join('')}</div>`
      );
    } else {
      paragraphBuffer.push(...metricBuffer);
    }

    metricBuffer = [];
  };

  const flushCode = () => {
    const langLabel = codeLanguage ? `<span class="absolute right-3 top-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">${escapeHtml(codeLanguage)}</span>` : '';
    html.push(`<div class="relative my-4 overflow-hidden rounded-2xl border border-navy-700/70 bg-[#0d1117]"><pre class="overflow-x-auto p-4">${langLabel}<code class="text-sm leading-relaxed text-cyan-300">${escapeHtml(codeLines.join('\n'))}</code></pre></div>`);
    codeLines = [];
    codeLanguage = '';
  };

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      flushTable();
      flushMetrics();
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (/^\|.+\|$/.test(line.trim())) {
      flushParagraph();
      flushList();
      tableBuffer.push(line);
      return;
    }

    const metricMatch = line.trim().match(/^([A-Za-z][A-Za-z0-9 /_-]{1,28}):\s+(.{1,72})$/);
    if (metricMatch && !/^https?:\/\//.test(metricMatch[2])) {
      flushParagraph();
      flushList();
      flushTable();
      metricBuffer.push(line.trim());
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      flushMetrics();
      return;
    }

    flushTable();
    flushMetrics();

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushMetrics();
      html.push('<hr class="my-4 border-navy-700" />');
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== 'ol') flushList();
      flushMetrics();
      listType = 'ol';
      listBuffer.push(orderedMatch[1]);
      return;
    }

    const unorderedMatch = line.match(/^[-•]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== 'ul') flushList();
      flushMetrics();
      listType = 'ul';
      listBuffer.push(unorderedMatch[1]);
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushMetrics();
      const level = headingMatch[1].length;
      const tag = `h${level}`;
      const size = level === 1 ? 'text-xl font-bold' : level === 2 ? 'text-lg font-semibold' : 'text-base font-semibold';
      html.push(`<${tag} class="${size} mb-2 mt-5 text-white">${renderInlineMarkdown(headingMatch[2])}</${tag}>`);
      return;
    }

    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      flushMetrics();
      html.push(`<blockquote class="my-3 border-l-2 border-violet-500 pl-4 italic text-slate-400">${renderInlineMarkdown(quoteMatch[1])}</blockquote>`);
      return;
    }

    paragraphBuffer.push(line.trim());
  });

  flushParagraph();
  flushList();
  flushTable();
  flushMetrics();
  if (inCodeBlock) flushCode();

  return html.join('');
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

function formatJsonBlock(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function extractResultLinks(result?: Record<string, unknown>) {
  if (!result) return [];

  return Object.entries(result)
    .flatMap(([key, value]) => {
      if (typeof value === 'string' && /^https?:\/\//.test(value)) {
        return [{ label: key.replace(/_/g, ' '), href: value }];
      }

      if (Array.isArray(value)) {
        return value
          .filter((item): item is string => typeof item === 'string' && /^https?:\/\//.test(item))
          .map((href, index) => ({ label: `${key.replace(/_/g, ' ')} ${index + 1}`, href }));
      }

      return [];
    })
    .slice(0, 3);
}

function extractResultImages(result?: Record<string, unknown>) {
  if (!result) return [];

  return Object.values(result)
    .flatMap((value) => {
      if (typeof value === 'string' && /^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(value)) return [value];
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && /^https?:\/\/.+\.(png|jpe?g|gif|webp)$/i.test(item));
      }
      return [];
    })
    .slice(0, 3);
}

function extractResultMetrics(result?: Record<string, unknown>) {
  if (!result) return [];
  return Object.entries(result)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => ({
      label: key.replace(/_/g, ' '),
      value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
    }));
}

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
    'Pull MRR from Stripe and compare it to last month',
    'Search for AI agent trends and summarize the shifts',
    'Write a Python script to calculate CAC from HubSpot',
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
  const resultLinks = extractResultLinks(toolCall.result);
  const resultImages = extractResultImages(toolCall.result);
  const resultMetrics = extractResultMetrics(toolCall.result);

  const inputSummary = toolCall.input
    ? (Object.values(toolCall.input)[0] as string | undefined)
    : undefined;

  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-navy-700/70 bg-gradient-to-br from-navy-950/92 via-navy-950/84 to-navy-900/72 shadow-[0_14px_32px_rgba(2,6,23,0.18)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-800/80 text-base leading-none ring-1 ring-white/5">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{label}</span>
            {isDone ? (
              <span className="rounded-full border border-green-400/20 bg-green-400/10 px-2 py-0.5 text-[10px] text-green-400">
                ✓ Done
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-400">
                <span className="inline-block w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Running
              </span>
            )}
            {isDone && elapsed !== undefined && (
              <span className="flex items-center gap-1 text-[10px] text-slate-600">
                <Clock className="w-2.5 h-2.5" />
                {elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}
              </span>
            )}
            {isDone && confidence !== undefined && <ConfidenceBar score={confidence} />}
          </div>
          {inputSummary && typeof inputSummary === 'string' && (
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
              {inputSummary.slice(0, 72)}{inputSummary.length > 72 ? '…' : ''}
            </p>
          )}
          {!expanded && resultLinks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {resultLinks.map((link) => (
                <span key={link.href} className="ui-pill px-2 py-0.5 text-[9px] normal-case tracking-normal text-cyan-300">
                  {link.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-600 transition-transform duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
          {toolCall.input && (
            <div className="rounded-xl border border-navy-800/70 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Input</p>
                <CopyButton text={formatJsonBlock(toolCall.input)} />
              </div>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-cyan-300">
                {formatJsonBlock(toolCall.input)}
              </pre>
            </div>
          )}
          {toolCall.result && (
            <div className="rounded-xl border border-navy-800/70 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Result</p>
                <CopyButton text={formatJsonBlock(toolCall.result)} />
              </div>
              {resultMetrics.length > 0 && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {resultMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-navy-700/70 bg-navy-950/45 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">{metric.label}</p>
                      <p className="mt-1 text-sm font-medium text-white">{metric.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {resultImages.length > 0 && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  {resultImages.map((imageUrl) => (
                    <a
                      key={imageUrl}
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="overflow-hidden rounded-xl border border-navy-700/70 bg-navy-950/45"
                    >
                      <img src={imageUrl} alt="Tool result" className="h-40 w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <pre className="max-h-52 overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs text-green-300">
                {formatJsonBlock(toolCall.result)}
              </pre>
              {resultLinks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {resultLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-pill px-2.5 py-1 text-[10px] normal-case tracking-normal text-cyan-300 hover:border-cyan-500/30 hover:text-cyan-200"
                    >
                      Open {link.label}
                    </a>
                  ))}
                </div>
              )}
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
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-[1.35rem] rounded-tr-md border border-violet-500/25 bg-gradient-to-br from-violet-600/20 via-violet-600/16 to-fuchsia-500/10 px-4 py-3 shadow-[0_12px_30px_rgba(91,33,182,0.12)]">
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 shadow-glow-violet ring-1 ring-white/10">
        <span className="text-xs text-white font-bold">N</span>
      </div>

      <div className="min-w-0 flex-1 rounded-[1.45rem] border border-navy-800/75 bg-gradient-to-br from-navy-900/84 via-navy-900/60 to-navy-950/74 px-4 py-3.5 shadow-[0_16px_34px_rgba(2,6,23,0.18)]">
        {/* Header */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-violet-100">Nexus</span>
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
                    : 'text-slate-600 hover:bg-navy-800/80 hover:text-slate-300'
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
                    : 'text-slate-600 hover:bg-navy-800/80 hover:text-slate-300'
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
          <div className="mb-4">
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
  const [draftEstimate, setDraftEstimate] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  const { snapshot } = useCreditSnapshot();
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

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setDraftEstimate(null);
      return undefined;
    }

    const timeout = window.setTimeout(async () => {
      const lowered = trimmed.toLowerCase();
      const taskKind =
        /report|summary|brief/.test(lowered) ? 'report'
        : /analy|debug|investigate/.test(lowered) ? 'analysis'
        : /build|write code|implement|fix/.test(lowered) ? 'engineering'
        : /schedule|every hour|daily|automation/.test(lowered) ? 'automation'
        : /search|research|find/.test(lowered) ? 'research'
        : 'chat';
      const toolCalls =
        (/search|find|browser|screenshot|slack|email|schedule|report|data/.test(lowered) ? 1 : 0) +
        (/ and | then | compare | summarize /.test(lowered) ? 1 : 0);
      const complexity =
        trimmed.length > 320 || /step-by-step|multi-step|compare|debug|architecture/.test(lowered)
          ? 'high'
          : trimmed.length > 120 || toolCalls > 1
            ? 'medium'
            : 'low';
      const modelTier = complexity === 'high' ? 'hard' : taskKind === 'automation' ? 'ops' : 'default';
      const estimate = await fetchCreditEstimate({
        taskKind,
        modelTier,
        toolCalls,
        complexity,
      });
      setDraftEstimate(estimate?.estimatedCredits ?? null);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [input]);

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

  const handleUpgradeCheckout = useCallback(async () => {
    try {
      const opened = await openBillingCheckout({
        kind: 'subscription',
        planId: snapshot.planName === 'Starter' ? 'pro' : 'team',
      });
      if (opened) return;
    } catch {
      // fall through
    }
    window.location.assign('/#pricing');
  }, [snapshot.planName]);

  const handleTopUpCheckout = useCallback(async () => {
    try {
      const opened = await openBillingCheckout({
        kind: 'top-up',
        offerId: getSuggestedTopUpOfferId(snapshot),
      });
      if (opened) return;
    } catch {
      // fall through
    }
    window.location.assign('/#pricing');
  }, [snapshot]);

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
  const draftWillPressureCredits = draftEstimate !== null && draftEstimate > snapshot.creditsRemaining;
  const lowRunway = snapshot.projectedDaysLeft <= 7;

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
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
      {/* Agent status bar */}
      <div className="flex-shrink-0 border-b border-navy-800/40 bg-gradient-to-r from-navy-900/30 via-navy-900/20 to-violet-950/10 px-3 py-2 backdrop-blur-sm sm:px-4">
        <div className="mx-auto flex max-w-[72rem] items-center gap-2.5 rounded-2xl border border-white/5 bg-navy-950/35 px-3 py-2.5 shadow-[0_12px_34px_rgba(2,6,23,0.16)] backdrop-blur-sm sm:gap-3 sm:px-3.5">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${statusColor} ${agentStatus !== 'idle' ? 'animate-pulse' : ''}`} />
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-600">Session</p>
              <p className="text-xs font-medium text-slate-300">{statusText}</p>
            </div>
          </div>
          <div className="hidden min-[540px]:flex items-center gap-2 text-[10px] text-slate-600">
            <span className="text-slate-700">•</span>
            <span>{messages.length === 0 ? 'Fresh workspace' : `${messages.length} messages`}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500 sm:gap-2">
            <span className="hidden uppercase tracking-[0.24em] text-slate-700 sm:inline">Mode</span>
            <div className={`flex items-center gap-1 rounded-full border px-2 py-1 ${modeConfig.bg} ${modeConfig.color} shadow-sm sm:gap-1.5 sm:px-2.5`}>
              <ModeIcon className="w-3 h-3" />
              <span className="max-[420px]:hidden">{modeConfig.label}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pt-2 sm:px-6 sm:pt-2.5">
        <div className="mx-auto max-w-[72rem]">
          <BillingGateBar compact />
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 pb-16 sm:px-6 sm:py-5 sm:pb-20"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full items-start justify-center px-1 py-3 sm:py-5">
            <div className="ui-panel-strong relative w-full max-w-[72rem] overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_35%)]" />
              <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-8">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div className="ui-pill mb-4 px-3 py-1 text-violet-300">
                    <Sparkles className="h-3 w-3" />
                    Nexus workspace
                  </div>
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-violet-500 to-violet-700 shadow-glow-violet ring-1 ring-white/10 sm:h-16 sm:w-16">
                    <span className="text-xl font-bold text-white sm:text-2xl">N</span>
                  </div>
                  <h2 className="text-[1.8rem] font-bold text-white sm:text-[2.4rem]">Hey, I'm Nexus</h2>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.32em] text-violet-300/70 sm:text-[11px]">
                    by Purple Orange AI
                  </p>
                  <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">
                    Your AI coworker, tuned for{' '}
                    <span className={`font-semibold ${modeConfig.color}`}>{modeLabel.toLowerCase()}</span>
                    {' '}work. Ask for research, automations, screenshots, or just start with a task.
                  </p>
                  <p className="mt-2 max-w-xl text-sm text-slate-500">{modeConfig.description}. Switch modes in the sidebar.</p>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    <span className="ui-pill">Research</span>
                    <span className="ui-pill">Automate</span>
                    <span className="ui-pill">Inspect</span>
                    <span className="ui-pill">Draft</span>
                  </div>

                  <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="ui-panel p-4 text-left shadow-none">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/70">Start here</p>
                      <p className="mt-1 text-sm font-medium text-white">Ask for a search, a summary, or a plan.</p>
                    </div>
                    <div className="ui-panel p-4 text-left shadow-none">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">System state</p>
                      <p className="mt-1 text-sm font-medium text-white">Mode, credits, and automation gate are visible above.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-navy-700/60 bg-navy-950/35 px-4 py-3 text-left">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Suggested prompts</p>
                    <p className="mt-1 text-sm text-slate-400">Start with one strong prompt and Nexus will take it from there.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {suggestions.slice(0, 3).map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(suggestion)}
                        className="rounded-2xl border border-navy-700/60 bg-navy-800/60 px-4 py-3 text-left text-sm leading-snug text-slate-400 shadow-[0_12px_30px_rgba(2,6,23,0.16)] transition-all duration-200 hover:border-violet-600/50 hover:bg-navy-700/70 hover:text-slate-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[72rem] space-y-5 pb-2">
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
                  onClick={() => { void handleUpgradeCheckout(); }}
                  className="rounded-lg border border-red-800/50 px-2.5 py-1.5 text-[11px] text-red-200 hover:bg-red-900/30 transition-colors"
                >
                  Upgrade plan
                </button>
                <button
                  onClick={() => { void handleTopUpCheckout(); }}
                  className="rounded-lg border border-red-800/50 px-2.5 py-1.5 text-[11px] text-red-200 hover:bg-red-900/30 transition-colors"
                >
                  Top up credits
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
      <div className="sticky bottom-0 z-20 flex-shrink-0 border-t border-navy-800/60 bg-gradient-to-t from-navy-950/98 via-navy-950/94 to-navy-950/72 px-3 pt-1.5 pb-[calc(0.7rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-[72rem]">
          <div className="rounded-[1.45rem] border border-navy-700/60 bg-gradient-to-br from-navy-800/74 via-navy-800/60 to-navy-900/78 shadow-[0_14px_32px_rgba(2,6,23,0.2)] transition-all duration-200 focus-within:border-violet-600/50">
            {(draftEstimate !== null || lowRunway) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-[11px] sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  {draftEstimate !== null && (
                    <span className={`rounded-full border px-2 py-1 font-medium ${
                      draftWillPressureCredits
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        : 'border-violet-500/20 bg-violet-500/10 text-violet-200'
                    }`}>
                      Estimated run: {formatCredits(draftEstimate)} credits
                    </span>
                  )}
                  {lowRunway && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-medium text-amber-200">
                      Low runway: {snapshot.projectedDaysLeft} days left
                    </span>
                  )}
                </div>
                {(draftWillPressureCredits || lowRunway) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { void handleTopUpCheckout(); }}
                      className="text-[11px] font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                    >
                      Top up
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleUpgradeCheckout(); }}
                      className="text-[11px] font-medium text-violet-300 transition-colors hover:text-violet-200"
                    >
                      Upgrade
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-end gap-2 px-3 py-3 sm:gap-2.5 sm:px-4 sm:py-3.5">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  adjustTextarea();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message Nexus… (Shift+Enter for new line)"
                className="chat-input min-h-[2.65rem] flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-600"
                rows={1}
                disabled={isLoading}
              />
              {isLoading ? (
                <button
                  onClick={stopGeneration}
                  className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/80 shadow-sm transition-all duration-200 hover:bg-red-500 sm:h-10 sm:w-10"
                  aria-label="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-white text-white" />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-glow-violet ring-1 ring-white/10 transition-all duration-200 hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-navy-700 disabled:shadow-none sm:h-10 sm:w-10"
                >
                  <Send className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-3 py-2 text-[11px] text-slate-700 sm:px-4">
              <span className="max-[460px]:hidden">Nexus can make mistakes. Verify important information.</span>
              <span className="min-[461px]:hidden">Verify important information.</span>
              <span className="inline-flex items-center gap-2">
                <kbd className="text-[10px] bg-navy-800 border border-navy-700 px-1.5 py-0.5 rounded font-mono">
                  ⌘K
                </kbd>
                to focus
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
