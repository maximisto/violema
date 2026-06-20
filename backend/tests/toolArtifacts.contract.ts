import assert from 'node:assert/strict';
import test from 'node:test';
import { extractToolArtifactsFromResult } from '../src/platform/toolArtifacts';

test('extractToolArtifactsFromResult stores render_chart output as a reusable chart artifact', () => {
  const artifacts = extractToolArtifactsFromResult('render_chart', {
    success: true,
    artifact_type: 'chart',
    chart: {
      type: 'bar',
      title: 'Weekly revenue',
      subtitle: 'Stripe',
      insight: 'Revenue rose for three straight weeks.',
      data: [
        { label: 'Week 1', value: 12000 },
        { label: 'Week 2', value: 15000 },
      ],
    },
  });

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0]?.kind, 'chart');
  assert.equal(artifacts[0]?.title, 'Weekly revenue');
  assert.equal(artifacts[0]?.summary, 'Revenue rose for three straight weeks.');
  assert.equal(artifacts[0]?.payload?.artifact_type, 'chart');
});

test('extractToolArtifactsFromResult ignores non-renderable tool results', () => {
  const artifacts = extractToolArtifactsFromResult('query_data', {
    source: 'stripe',
    query_type: 'not_found',
    data: { note: 'No chartable data.' },
  });

  assert.deepEqual(artifacts, []);
});
