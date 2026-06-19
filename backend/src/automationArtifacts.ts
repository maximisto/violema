export interface AutomationArtifactRecord {
  kind: string;
  title: string;
  payload: Record<string, unknown>;
}

export interface AutomationChartArtifactRecord extends AutomationArtifactRecord {
  kind: 'chart';
}

interface AutomationChartInput {
  stepTitle: string;
  payload: Record<string, unknown>;
}

interface ChartRow {
  label: string;
  value: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[%,$]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function labelizeKey(key: string) {
  const canonical: Record<string, string> = {
    arr: 'ARR',
    mrr: 'MRR',
    nrr: 'NRR',
    prev_mrr: 'Previous MRR',
    previous_mrr: 'Previous MRR',
    change_pct: 'Change %',
    net_revenue_retention: 'Net Revenue Retention',
  };
  if (canonical[key]) return canonical[key];
  return key
    .replace(/_/g, ' ')
    .replace(/\bpct\b/gi, '%')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readRowLabel(record: Record<string, unknown>, fallback: string) {
  const candidates = [record.label, record.name, record.title, record.event, record.path, record.period];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 48);
  }
  return labelizeKey(fallback).slice(0, 48);
}

function readPreferredRecordMetric(record: Record<string, unknown>) {
  const preferredKeys = ['value', 'count', 'sessions', 'revenue', 'mrr', 'arr', 'total', 'volume', 'open', 'completed'];
  for (const key of preferredKeys) {
    const value = readFiniteNumber(record[key]);
    if (value !== null) return value;
  }
  for (const value of Object.values(record)) {
    const parsed = readFiniteNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function collectChartRows(value: unknown, prefix = ''): ChartRow[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const numericValue = readPreferredRecordMetric(item);
      if (numericValue === null) return [];
      return [{ label: readRowLabel(item, `${prefix || 'item'}_${index + 1}`), value: numericValue }];
    });
  }

  if (!isRecord(value)) return [];

  const directRows: ChartRow[] = [];
  const nestedRows: ChartRow[] = [];

  Object.entries(value).forEach(([key, nestedValue]) => {
    const numericValue = readFiniteNumber(nestedValue);
    if (numericValue !== null) {
      directRows.push({ label: labelizeKey(key), value: numericValue });
      return;
    }

    if (isRecord(nestedValue) || Array.isArray(nestedValue)) {
      nestedRows.push(...collectChartRows(nestedValue, key).map((row) => ({
        label: row.label === labelizeKey(key) ? row.label : `${labelizeKey(key)} ${row.label}`,
        value: row.value,
      })));
    }
  });

  return directRows.length > 0 ? directRows : nestedRows;
}

export function buildAutomationChartArtifactFromQueryPayload(input: AutomationChartInput): AutomationChartArtifactRecord | null {
  const data = input.payload.data;
  const rows = collectChartRows(data)
    .filter((row) => Number.isFinite(row.value))
    .slice(0, 8);

  if (rows.length < 2) return null;

  const source = typeof input.payload.source === 'string' && input.payload.source.trim()
    ? input.payload.source.trim()
    : 'query';
  const queryType = typeof input.payload.query_type === 'string' && input.payload.query_type.trim()
    ? input.payload.query_type.trim()
    : 'data';

  return {
    kind: 'chart',
    title: `${input.stepTitle} chart`,
    payload: {
      success: true,
      artifact_type: 'chart',
      chart: {
        type: 'bar',
        title: `${input.stepTitle} snapshot`,
        subtitle: `${source} / ${queryType}`,
        y_label: 'Value',
        insight: `Visual snapshot generated from ${input.stepTitle}.`,
        data: rows,
        generated_at: new Date().toISOString(),
      },
      row_count: rows.length,
      render_target: 'mission_workspace_artifact',
    },
  };
}

export function selectReviewGateVisualArtifacts(artifacts: AutomationArtifactRecord[]) {
  return artifacts
    .filter((artifact) => artifact.kind === 'chart' && isRecord(artifact.payload.chart))
    .map((artifact) => ({
      title: artifact.title,
      payload: artifact.payload,
    }));
}
