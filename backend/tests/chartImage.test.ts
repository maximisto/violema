import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildChartSvg, coerceChartSpec, renderChartSpecsToFiles } from '../src/chartImage';

const SPEC = {
  chart: {
    type: 'bar',
    title: 'Stripe revenue snapshot',
    subtitle: 'stripe / revenue_summary',
    y_label: 'USD',
    data: [
      { label: 'MRR', value: 8200 },
      { label: 'Expansion', value: 1400 },
      { label: 'Churn', value: -300 },
    ],
  },
};

test('coerceChartSpec unwraps the artifact chart payload and drops bad rows', () => {
  const spec = coerceChartSpec({
    chart: { title: 'T', data: [{ label: 'ok', value: '12' }, { label: '', value: 3 }, { label: 'nan', value: 'x' }] },
  });
  assert.ok(spec);
  assert.equal(spec!.title, 'T');
  assert.deepEqual(spec!.data, [{ label: 'ok', value: 12 }]);
  assert.equal(coerceChartSpec({ chart: { data: [] } }), null);
  assert.equal(coerceChartSpec('nope'), null);
});

test('buildChartSvg renders branded bars with escaped labels', () => {
  const svg = buildChartSvg({
    title: 'A&B <Competitors>',
    data: [
      { label: 'Acme & Co', value: 5 },
      { label: 'Relay', value: 3 },
    ],
  });
  assert.ok(svg);
  assert.match(svg!, /A&amp;B &lt;Competitors&gt;/);
  assert.match(svg!, /Acme &amp; Co/);
  assert.equal((svg!.match(/url\(#violemaBar\)/g) || []).length, 2, 'one gradient bar per row');
  assert.match(svg!, /Violema · evidence-linked run data/);
  assert.equal(buildChartSvg({ data: [] }), null);
});

test('renderChartSpecsToFiles refuses non-https bases and writes PNGs otherwise', () => {
  assert.deepEqual(
    renderChartSpecsToFiles({ specs: [SPEC], dir: path.join(os.tmpdir(), 'no-write'), baseUrl: 'http://localhost:3001' }),
    [],
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-charts-'));
  try {
    const images = renderChartSpecsToFiles({ specs: [SPEC, { junk: true }], dir, baseUrl: 'https://violema.com/' });
    assert.equal(images.length, 1);
    assert.match(images[0].url, /^https:\/\/violema\.com\/api\/brief-charts\/[0-9a-f-]+\.png$/);
    assert.equal(images[0].alt, 'Stripe revenue snapshot');
    const file = path.join(dir, images[0].url.split('/').pop()!);
    const bytes = fs.readFileSync(file);
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'PNG signature');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
