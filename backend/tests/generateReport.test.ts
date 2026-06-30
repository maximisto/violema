import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildGenerateReportResult } from '../src/platform/reportGeneration';

const bannedRevenueMarkers = /12745(?:0)|10823(?:0)|15294(?:00)|118(?:%)|\$12(?:7)/;

test('generate report refuses to invent report data', () => {
  const result = buildGenerateReportResult({
    report_type: 'executive_summary',
    title: 'Revenue watch',
    period: 'last_7_days',
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'source_data_required');
  assert.equal(result.message, 'Report generation requires source-backed query data. Run query_data first.');
  assert.doesNotMatch(JSON.stringify(result), bannedRevenueMarkers);
});

test('report generation source files do not contain canned revenue markers', () => {
  const files = [
    path.join(process.cwd(), 'src/server.ts'),
    path.join(process.cwd(), 'src/platform/reportGeneration.ts'),
  ];

  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), bannedRevenueMarkers);
  }
});
