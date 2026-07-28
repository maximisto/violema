// Pulls preview images (og:image / twitter:image) from the evidence links in a
// delivered brief so Slack shows real article graphics without Violema hosting
// anything. Fail-soft by design: any fetch or parse miss just means the brief
// ships without that image.

import type { SlackBlock } from './slackBlocks';

const MAX_HTML_BYTES = 400_000;

export interface BriefLink {
  url: string;
  label: string;
}

// SSRF guard: only public https hosts — no IP literals, localhost, or internal suffixes.
export function isFetchableHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(':') || /^\[/.test(host)) return false;
  return host.includes('.');
}

export function extractBriefLinks(markdown: string, limit: number): BriefLink[] {
  const links: BriefLink[] = [];
  const seenHosts = new Set<string>();
  const pattern = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) && links.length < limit) {
    try {
      const parsed = new URL(match[2]);
      if (!isFetchableHost(parsed.hostname) || seenHosts.has(parsed.hostname)) continue;
      seenHosts.add(parsed.hostname);
      links.push({ url: match[2], label: match[1].trim() || parsed.hostname });
    } catch {
      continue;
    }
  }

  return links;
}

export function parseOgImageFromHtml(html: string): string | null {
  const metaTags = html.match(/<meta\s[^>]*>/gi) || [];
  let fallback: string | null = null;

  for (const tag of metaTags) {
    const nameMatch = tag.match(/(?:property|name)\s*=\s*["'](og:image|twitter:image)(?::src)?["']/i);
    if (!nameMatch) continue;
    const contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    if (!contentMatch) continue;
    const url = contentMatch[1].trim();
    if (!/^https:\/\//.test(url)) continue;
    if (nameMatch[1].toLowerCase() === 'og:image') return url;
    fallback = fallback || url;
  }

  return fallback;
}

async function fetchOgImage(
  link: BriefLink,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ link: BriefLink; imageUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(link.url, {
      signal: controller.signal,
      headers: { Accept: 'text/html', 'User-Agent': 'ViolemaBriefBot/1.0 (+https://violema.com)' },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('html')) return null;
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const imageUrl = parseOgImageFromHtml(html);
    return imageUrl ? { link, imageUrl } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectLinkImageBlocks(
  markdown: string,
  options?: { limit?: number; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<SlackBlock[]> {
  const limit = options?.limit ?? 3;
  const timeoutMs = options?.timeoutMs ?? 3500;
  const fetchImpl = options?.fetchImpl ?? fetch;

  const links = extractBriefLinks(markdown, limit);
  if (links.length === 0) return [];

  const results = await Promise.all(links.map((link) => fetchOgImage(link, timeoutMs, fetchImpl)));
  const found = results.filter((result): result is { link: BriefLink; imageUrl: string } => result !== null);
  if (found.length === 0) return [];

  const blocks: SlackBlock[] = [{ type: 'divider' }];
  for (const { link, imageUrl } of found) {
    blocks.push({ type: 'image', image_url: imageUrl, alt_text: link.label });
  }
  return blocks;
}
