export interface StoredToolArtifact {
  kind: 'chart' | 'report' | 'screenshot';
  title: string;
  source?: string;
  summary?: string;
  payload: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function extractToolArtifactsFromResult(toolName: string, result: unknown): StoredToolArtifact[] {
  if (!isRecord(result)) return [];

  const chart = isRecord(result.chart) ? result.chart : null;
  if ((toolName === 'render_chart' || result.artifact_type === 'chart') && chart) {
    const title = readString(chart.title) || 'Generated chart';
    return [{
      kind: 'chart',
      title,
      source: toolName,
      summary: readString(chart.insight) || undefined,
      payload: result,
    }];
  }

  if (toolName === 'generate_report' && isRecord(result.report)) {
    return [{
      kind: 'report',
      title: readString(result.report.title) || 'Generated report',
      source: toolName,
      payload: result,
    }];
  }

  if (toolName === 'browser_screenshot' && (readString(result.path) || readString(result.url))) {
    return [{
      kind: 'screenshot',
      title: readString(result.title) || 'Browser screenshot',
      source: toolName,
      payload: result,
    }];
  }

  return [];
}
