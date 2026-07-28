// ─── Markdown renderer ───────────────────────────────────────────────────────
// Shared by the chat surface and mission review panes so drafted deliveries
// render as structured output (headings, tables, stat tiles), not raw text.

const TOKEN_DELIMITER = '\u0000';
const TOKEN_PATTERN = /\u0000(\d+)\u0000/;
const TOKEN_PATTERN_GLOBAL = /\u0000(\d+)\u0000/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text: string) {
  // Finished HTML fragments are stashed behind NUL-delimited tokens so later
  // regex passes can never rewrite text inside an already-emitted attribute.
  const stashed: string[] = [];
  const stash = (html: string) => `${TOKEN_DELIMITER}${stashed.push(html) - 1}${TOKEN_DELIMITER}`;
  const stripMarkers = (value: string) => value.replace(/\*\*|\*|`/g, '');
  const formatText = (value: string) =>
    value
      .replace(/`([^`]+)`/g, (_match, code: string) => stash(`<code class="bg-navy-900 text-violet-300 px-1.5 py-0.5 rounded text-sm font-mono">${code}</code>`))
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic text-slate-200">$1</em>');

  let html = escapeHtml(text)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_match, alt: string, url: string) => {
      const cleanAlt = stripMarkers(alt);
      return stash(`<figure class="my-4 overflow-hidden rounded-2xl border border-navy-700/70 bg-navy-950/60"><img src="${url}" alt="${cleanAlt}" class="w-full object-cover" /><figcaption class="px-3 py-2 text-[11px] text-slate-500">${cleanAlt}</figcaption></figure>`);
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_match, label: string, url: string) =>
      stash(`<a href="${url}" class="text-violet-400 hover:text-violet-300 underline underline-offset-2" target="_blank" rel="noopener">${formatText(label)}</a>`))
    .replace(/(?<!["(])(https?:\/\/[^\s<]+?\.(?:png|jpe?g|gif|webp))(?![^<]*>)/gi, (_match, url: string) =>
      stash(`<figure class="my-4 overflow-hidden rounded-2xl border border-navy-700/70 bg-navy-950/60"><img src="${url}" alt="Shared image" class="w-full object-cover" /></figure>`));

  html = formatText(html);

  while (TOKEN_PATTERN.test(html)) {
    html = html.replace(TOKEN_PATTERN_GLOBAL, (_match, index: string) => stashed[Number(index)]);
  }
  return html;
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

export function renderMarkdown(text: string): string {
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

interface MarkdownContentProps {
  text: string;
  className?: string;
}

export default function MarkdownContent({ text, className }: MarkdownContentProps) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
