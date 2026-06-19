import { buildAutomationChartArtifactFromQueryPayload, selectReviewGateVisualArtifacts } from '../src/automationArtifacts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const chartArtifact = buildAutomationChartArtifactFromQueryPayload({
  stepTitle: 'Stripe revenue pull',
  payload: {
    source: 'stripe',
    query_type: 'monthly_revenue',
    data: {
      mrr: 127450,
      prev_mrr: 108230,
      change_pct: 17.77,
      arr: 1529400,
      currency: 'USD',
    },
  },
});

assert(chartArtifact?.kind === 'chart', 'numeric query payload creates a chart artifact');
assert(chartArtifact.title === 'Stripe revenue pull chart', 'chart artifact title follows the step');
assert(chartArtifact.payload.artifact_type === 'chart', 'chart artifact uses the shared chart payload contract');

const chart = chartArtifact.payload.chart as {
  type?: string;
  title?: string;
  subtitle?: string;
  y_label?: string;
  data?: Array<{ label: string; value: number }>;
};

assert(chart.type === 'bar', 'automation charts default to bar charts');
assert(chart.title === 'Stripe revenue pull snapshot', 'chart title is user-facing and specific');
assert(chart.subtitle === 'stripe / monthly_revenue', 'chart subtitle preserves source and query type');
assert(chart.y_label === 'Value', 'chart includes a y-axis label');
assert(Array.isArray(chart.data) && chart.data.length >= 4, 'chart keeps multiple numeric data points');
assert(chart.data?.some((row) => row.label === 'MRR' && row.value === 127450), 'chart labels key metrics cleanly');
assert(chart.data?.some((row) => row.label === 'Previous MRR' && row.value === 108230), 'chart expands previous metric names');

const reviewVisuals = selectReviewGateVisualArtifacts([
  { kind: 'query_data', title: 'Raw data', payload: { data: { mrr: 1 } } },
  chartArtifact,
]);

assert(reviewVisuals.length === 1, 'review gates keep only visual artifacts');
assert(reviewVisuals[0]?.title === 'Stripe revenue pull chart', 'review visual keeps source artifact title');

const noteOnlyArtifact = buildAutomationChartArtifactFromQueryPayload({
  stepTitle: 'Unknown query',
  payload: {
    source: 'stripe',
    query_type: 'not_found',
    data: { note: 'No matching data' },
  },
});

assert(noteOnlyArtifact === null, 'non-numeric payloads do not create fake charts');
