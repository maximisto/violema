// Renders automation chart artifacts (built in automationArtifacts.ts and shown
// in the mission workspace) to branded PNG cards that Slack image blocks can
// display. Pure-SVG construction; rasterization via @resvg/resvg-js prebuilt
// binaries. Everything here is fail-soft: any miss returns [] and the brief
// ships without charts.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ChartSpecRow {
  label: string;
  value: number;
}

export interface ChartSpec {
  title?: string;
  subtitle?: string;
  yLabel?: string;
  data: ChartSpecRow[];
}

const WIDTH = 1080;
const HEIGHT = 620;
const MAX_ROWS = 8;
const PRUNE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const PALETTE = {
  page: '#faf7f2',
  card: '#ffffff',
  ink: '#14110e',
  muted: '#6b6253',
  hairline: '#e4daca',
  violet: '#7c3aed',
  violetSoft: '#a78bfa',
  orange: '#f59e0b',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateLabel(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

/** Horizontal bar card: readable at Slack sizes, branded, theme-independent. */
export function buildChartSvg(spec: ChartSpec): string | null {
  const rows = (spec.data || [])
    .filter((row) => typeof row.label === 'string' && Number.isFinite(row.value))
    .slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  const maxValue = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const chartTop = 150;
  const chartBottom = HEIGHT - 84;
  const rowGap = Math.min(64, Math.floor((chartBottom - chartTop) / rows.length));
  const labelWidth = 250;
  const barLeft = 64 + labelWidth + 18;
  const barMaxWidth = WIDTH - barLeft - 140;

  const bars = rows.map((row, index) => {
    const y = chartTop + index * rowGap;
    const width = Math.max(6, Math.round((Math.abs(row.value) / maxValue) * barMaxWidth));
    const barY = y + Math.round((rowGap - 26) / 2);
    return [
      `<text x="${64 + labelWidth}" y="${y + rowGap / 2 + 5}" text-anchor="end" font-size="22" fill="${PALETTE.ink}" font-weight="600">${escapeXml(truncateLabel(row.label, 24))}</text>`,
      `<rect x="${barLeft}" y="${barY}" width="${width}" height="26" rx="8" fill="url(#violemaBar)"/>`,
      `<text x="${barLeft + width + 14}" y="${y + rowGap / 2 + 5}" font-size="22" fill="${PALETTE.muted}" font-weight="600">${escapeXml(formatValue(row.value))}</text>`,
    ].join('');
  }).join('');

  const title = escapeXml(truncateLabel(spec.title || 'Run snapshot', 52));
  const subtitle = spec.subtitle ? escapeXml(truncateLabel(spec.subtitle, 76)) : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif">`,
    `<defs><linearGradient id="violemaBar" x1="0" y1="0" x2="1" y2="0">`,
    `<stop offset="0" stop-color="${PALETTE.violet}"/><stop offset="1" stop-color="${PALETTE.violetSoft}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${PALETTE.page}"/>`,
    `<rect x="24" y="24" width="${WIDTH - 48}" height="${HEIGHT - 48}" rx="24" fill="${PALETTE.card}" stroke="${PALETTE.hairline}"/>`,
    `<rect x="64" y="64" width="10" height="34" rx="5" fill="${PALETTE.violet}"/>`,
    `<rect x="64" y="64" width="10" height="17" rx="5" fill="${PALETTE.orange}"/>`,
    `<text x="90" y="90" font-size="30" font-weight="700" fill="${PALETTE.ink}">${title}</text>`,
    subtitle ? `<text x="90" y="122" font-size="20" fill="${PALETTE.muted}">${subtitle}</text>` : '',
    bars,
    `<text x="64" y="${HEIGHT - 44}" font-size="17" fill="${PALETTE.muted}">Violema · evidence-linked run data</text>`,
    `</svg>`,
  ].join('');
}

function rasterize(svg: string): Buffer | null {
  try {
    // Lazy require keeps startup and test runs independent of the native module.
    const { Resvg } = require('@resvg/resvg-js') as typeof import('@resvg/resvg-js');
    const renderer = new Resvg(svg, {
      fitTo: { mode: 'width', value: WIDTH },
      font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
    });
    return Buffer.from(renderer.render().asPng());
  } catch {
    return null;
  }
}

function pruneOldCharts(dir: string) {
  try {
    const cutoff = Date.now() - PRUNE_AFTER_MS;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      try {
        if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
      } catch {
        // Ignore races on individual files.
      }
    }
  } catch {
    // Pruning is best-effort.
  }
}

export function coerceChartSpec(value: unknown): ChartSpec | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const chart = (record.chart && typeof record.chart === 'object' && !Array.isArray(record.chart)
    ? record.chart
    : record) as Record<string, unknown>;
  const data = Array.isArray(chart.data)
    ? chart.data
        .map((row) => (row && typeof row === 'object'
          ? { label: String((row as Record<string, unknown>).label ?? ''), value: Number((row as Record<string, unknown>).value) }
          : null))
        .filter((row): row is ChartSpecRow => Boolean(row && row.label && Number.isFinite(row.value)))
    : [];
  if (data.length === 0) return null;
  return {
    title: typeof chart.title === 'string' ? chart.title : undefined,
    subtitle: typeof chart.subtitle === 'string' ? chart.subtitle : undefined,
    yLabel: typeof chart.y_label === 'string' ? chart.y_label : undefined,
    data,
  };
}

export function renderChartSpecsToFiles(input: {
  specs: unknown[];
  dir: string;
  baseUrl: string;
  limit?: number;
}): Array<{ url: string; alt: string }> {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  if (!/^https:\/\//.test(baseUrl)) return [];
  const limit = input.limit ?? 2;
  const images: Array<{ url: string; alt: string }> = [];

  try {
    fs.mkdirSync(input.dir, { recursive: true });
  } catch {
    return [];
  }
  pruneOldCharts(input.dir);

  for (const raw of input.specs) {
    if (images.length >= limit) break;
    const spec = coerceChartSpec(raw);
    if (!spec) continue;
    const svg = buildChartSvg(spec);
    if (!svg) continue;
    const png = rasterize(svg);
    if (!png) continue;
    const name = `${crypto.randomUUID()}.png`;
    try {
      fs.writeFileSync(path.join(input.dir, name), png);
    } catch {
      continue;
    }
    images.push({ url: `${baseUrl}/api/brief-charts/${name}`, alt: spec.title || 'Run chart' });
  }

  return images;
}
