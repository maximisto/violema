import { buildAutomationChartArtifactFromQueryPayload, selectReviewGateVisualArtifacts } from '../src/automationArtifacts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const chartArtifact = buildAutomationChartArtifactFromQueryPayload({
  stepTitle: 'GitHub issue pull',
  payload: {
    source: 'github',
    query_type: 'open_issues',
    data: {
      total: 34,
      critical: 2,
      high: 8,
      medium: 15,
    },
  },
});

assert(chartArtifact?.kind === 'chart', 'numeric query payload creates a chart artifact');
assert(chartArtifact.title === 'GitHub issue pull chart', 'chart artifact title follows the step');
assert(chartArtifact.payload.artifact_type === 'chart', 'chart artifact uses the shared chart payload contract');

const chart = chartArtifact.payload.chart as {
  type?: string;
  title?: string;
  subtitle?: string;
  y_label?: string;
  data?: Array<{ label: string; value: number }>;
};

assert(chart.type === 'bar', 'automation charts default to bar charts');
assert(chart.title === 'GitHub issue pull snapshot', 'chart title is user-facing and specific');
assert(chart.subtitle === 'github / open_issues', 'chart subtitle preserves source and query type');
assert(chart.y_label === 'Value', 'chart includes a y-axis label');
assert(Array.isArray(chart.data) && chart.data.length >= 4, 'chart keeps multiple numeric data points');
assert(chart.data?.some((row) => row.label === 'Total' && row.value === 34), 'chart labels key metrics cleanly');
assert(chart.data?.some((row) => row.label === 'Critical' && row.value === 2), 'chart includes severity metrics');

const reviewVisuals = selectReviewGateVisualArtifacts([
  { kind: 'query_data', title: 'Raw data', payload: { data: { mrr: 1 } } },
  chartArtifact,
]);

assert(reviewVisuals.length === 1, 'review gates keep only visual artifacts');
assert(reviewVisuals[0]?.title === 'GitHub issue pull chart', 'review visual keeps source artifact title');

const noteOnlyArtifact = buildAutomationChartArtifactFromQueryPayload({
  stepTitle: 'Unknown query',
  payload: {
    source: 'github',
    query_type: 'not_found',
    data: { note: 'No matching data' },
  },
});

assert(noteOnlyArtifact === null, 'non-numeric payloads do not create fake charts');
