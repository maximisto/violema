// Renders automation memo markdown as Slack Block Kit so deliveries arrive as
// titled, structured briefs instead of raw markdown text. Slack does not render
// GitHub markdown: headings, pipe tables, **bold**, and [links](url) all show
// as literal characters in a plain chat.postMessage text payload.

interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export type SlackBlock =
  | { type: 'header'; text: SlackTextObject }
  | { type: 'section'; text: SlackTextObject }
  | { type: 'divider' }
  | { type: 'image'; image_url: string; alt_text: string }
  | { type: 'context'; elements: SlackTextObject[] };

// Slack hard limits: 3000 chars per section text, 150 per header, 50 blocks.
const SECTION_TEXT_LIMIT = 2900;
const HEADER_TEXT_LIMIT = 148;
const MAX_CONTENT_BLOCKS = 45;

function escapeSlackText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function toSlackMrkdwn(value: string): string {
  let text = escapeSlackText(value);
  // Inline images degrade to links; standalone images become image blocks upstream.
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) =>
    /^https?:\/\//.test(url) ? `<${url}|${alt || 'image'}>` : alt);
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) =>
    /^https?:\/\//.test(url) ? `<${url}|${label}>` : label);
  text = text.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  text = text.replace(/__([^_]+)__/g, '*$1*');
  text = text.replace(/~~([^~]+)~~/g, '~$1~');
  return text;
}

function truncateForSection(text: string): string {
  if (text.length <= SECTION_TEXT_LIMIT) return text;
  return `${text.slice(0, SECTION_TEXT_LIMIT - 2)}…`;
}

function sectionBlock(text: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text: truncateForSection(text) } };
}

function headerBlock(text: string): SlackBlock {
  const plain = stripInlineMarkdown(text).slice(0, HEADER_TEXT_LIMIT);
  return { type: 'header', text: { type: 'plain_text', text: plain, emoji: true } };
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

// Slack has no table block. Each data row renders as a bullet with the first
// column bolded, the second appended after an em dash, and any further columns
// on labelled follow-up lines so a competitor matrix stays scannable.
function tableToText(headerCells: string[], rows: string[][]): string {
  const lines: string[] = [];
  for (const row of rows) {
    if (row.every((cell) => !cell)) continue;
    const lead = row[0] ? `*${toSlackMrkdwn(stripInlineMarkdown(row[0]))}*` : '';
    const second = row[1] ? toSlackMrkdwn(stripInlineMarkdown(row[1])) : '';
    lines.push(['•', lead, lead && second ? '—' : '', second].filter(Boolean).join(' '));
    for (let i = 2; i < row.length; i += 1) {
      if (!row[i]) continue;
      const label = headerCells[i] ? `${stripInlineMarkdown(headerCells[i])}: ` : '';
      lines.push(`    _${toSlackMrkdwn(label + stripInlineMarkdown(row[i]))}_`);
    }
  }
  return lines.join('\n');
}

export function markdownToSlackBlocks(markdown: string): SlackBlock[] {
  const blocks: SlackBlock[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(sectionBlock(paragraph.join('\n')));
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      if (heading[1].length === 1) {
        blocks.push(headerBlock(heading[2]));
      } else {
        blocks.push(sectionBlock(`*${toSlackMrkdwn(stripInlineMarkdown(heading[2]))}*`));
      }
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: 'divider' });
      continue;
    }

    const standaloneImage = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);
    if (standaloneImage) {
      flushParagraph();
      blocks.push({ type: 'image', image_url: standaloneImage[2], alt_text: standaloneImage[1] || 'image' });
      continue;
    }

    if (trimmed.startsWith('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      flushParagraph();
      const headerCells = parseTableRow(trimmed);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[j].trim()));
        j += 1;
      }
      const tableText = tableToText(headerCells, rows);
      if (tableText) blocks.push(sectionBlock(tableText));
      i = j - 1;
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      paragraph.push(`• ${toSlackMrkdwn(bullet[1])}`);
      continue;
    }

    paragraph.push(toSlackMrkdwn(trimmed));
  }

  flushParagraph();

  if (blocks.length > MAX_CONTENT_BLOCKS) {
    const kept = blocks.slice(0, MAX_CONTENT_BLOCKS);
    kept.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_Brief truncated for Slack — open the run in Violema for the full version._' }],
    });
    return kept;
  }

  return blocks;
}

// Blocks are only worth building when the body actually carries markdown
// structure; short conversational sends stay as plain text.
export function hasMarkdownStructure(body: string): boolean {
  return (
    /^#{1,6}\s+\S/m.test(body) ||
    /^\s*\|.+\|\s*$/m.test(body) ||
    /^[-*+]\s+\S/m.test(body) ||
    /\*\*[^*]+\*\*/.test(body) ||
    /\[[^\]]+\]\(https?:\/\/[^)\s]+\)/.test(body)
  );
}

export function buildSlackMessagePayload(input: { subject?: string; body: string }): {
  text: string;
  blocks?: SlackBlock[];
} {
  const fallbackText = input.subject ? `${input.subject}\n\n${input.body}` : input.body;
  if (!hasMarkdownStructure(input.body)) {
    return { text: fallbackText };
  }

  const bodyBlocks = markdownToSlackBlocks(input.body);
  if (bodyBlocks.length === 0) {
    return { text: fallbackText };
  }

  const blocks: SlackBlock[] = [];
  const bodyLeadsWithHeader = bodyBlocks[0]?.type === 'header';
  if (input.subject && !bodyLeadsWithHeader) {
    blocks.push(headerBlock(input.subject));
  }
  blocks.push(...bodyBlocks);
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Violema · reviewed & approved in the run gate · violema.com' }],
  });

  return { text: fallbackText, blocks };
}
