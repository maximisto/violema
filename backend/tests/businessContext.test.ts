import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyBusinessContextToStep,
  composeSearchQuery,
  contextPreamble,
  isBusinessContextSet,
  validateBusinessContextInput,
} from '../src/platform/businessContext';
import type { WorkspaceBusinessContext } from '../src/platform/types';

const ESPRESSO: WorkspaceBusinessContext = {
  summary: 'An AI-powered espresso machine company.',
  marketKeywords: ['AI-powered espresso machine', 'smart coffee machine'],
  competitors: ['decenttespresso.com'],
  exclusions: ['agent automation platforms'],
  updatedAt: '2026-08-05T12:00:00.000Z',
};

test('isBusinessContextSet requires a summary and at least one keyword', () => {
  assert.equal(isBusinessContextSet(ESPRESSO), true);
  assert.equal(isBusinessContextSet(null), false);
  assert.equal(isBusinessContextSet({ ...ESPRESSO, summary: '  ' }), false);
  assert.equal(isBusinessContextSet({ ...ESPRESSO, marketKeywords: [] }), false);
});

test('validateBusinessContextInput trims, enforces caps, and reports every error', () => {
  const ok = validateBusinessContextInput({
    summary: '  An AI-powered espresso machine company.  ',
    marketKeywords: [' AI-powered espresso machine ', ''],
    competitors: ['decenttespresso.com'],
    exclusions: undefined,
  });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.summary, 'An AI-powered espresso machine company.');
    assert.deepEqual(ok.value.marketKeywords, ['AI-powered espresso machine']);
    assert.equal(ok.value.exclusions, undefined);
  }

  const bad = validateBusinessContextInput({
    summary: 'x'.repeat(301),
    marketKeywords: Array.from({ length: 11 }, (_, i) => `k${i}`),
    competitors: 'not-an-array',
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 3);

  const empty = validateBusinessContextInput({ summary: '', marketKeywords: [] });
  assert.equal(empty.ok, false);
});

test('composeSearchQuery joins keywords, suffix, and competitors, deduped and capped', () => {
  const query = composeSearchQuery(ESPRESSO, 'competitor pricing launches positioning');
  assert.equal(
    query,
    'AI-powered espresso machine smart coffee machine competitor pricing launches positioning decenttespresso.com',
  );

  const duped = composeSearchQuery(
    { ...ESPRESSO, competitors: ['AI-powered espresso machine'] },
    'competitor pricing',
  );
  assert.equal(duped, 'AI-powered espresso machine smart coffee machine competitor pricing');

  const long = composeSearchQuery(
    { ...ESPRESSO, marketKeywords: ['k'.repeat(40), 'm'.repeat(40)], competitors: ['c'.repeat(100)] },
    's'.repeat(200),
  );
  assert.ok(long.length <= 400);
});

test('contextPreamble states summary, market, competitors, and exclusions', () => {
  const preamble = contextPreamble(ESPRESSO);
  assert.match(preamble, /Business context for this account: An AI-powered espresso machine company\./);
  assert.match(preamble, /Market: AI-powered espresso machine, smart coffee machine\./);
  assert.match(preamble, /Named competitors: decenttespresso\.com\./);
  assert.match(preamble, /Avoid: agent automation platforms\./);

  const noExtras = contextPreamble({ ...ESPRESSO, competitors: [], exclusions: undefined });
  assert.doesNotMatch(noExtras, /Named competitors/);
  assert.doesNotMatch(noExtras, /Avoid:/);
});

test('applyBusinessContextToStep resolves opted-in steps and leaves everything else alone', () => {
  const searchStep = {
    id: 'step_competitor_search',
    kind: 'search' as const,
    title: 'Search competitor moves',
    objective: 'Find pricing, launch, and positioning changes from key competitors.',
    inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 },
  };
  const resolved = applyBusinessContextToStep(searchStep, ESPRESSO);
  assert.equal(
    resolved.inputs?.query,
    'AI-powered espresso machine smart coffee machine competitor pricing launches positioning decenttespresso.com',
  );
  assert.equal(resolved.inputs?.num_results, 8);
  assert.equal(resolved.inputs?.use_business_context, undefined, 'search inputs are replaced, not merged');

  const analyzeStep = {
    id: 'step_delta_analysis',
    kind: 'analyze' as const,
    title: 'Extract what changed',
    objective: 'Compare against the library.',
    inputs: { use_business_context: true, instruction: 'Compare the evidence.' },
  };
  const analyzed = applyBusinessContextToStep(analyzeStep, ESPRESSO);
  assert.match(String(analyzed.inputs?.instruction), /^Business context for this account:/);
  assert.match(String(analyzed.inputs?.instruction), /Compare the evidence\.$/);

  const unflagged = applyBusinessContextToStep({ ...searchStep, inputs: { query: 'plain', num_results: 6 } }, ESPRESSO);
  assert.equal(unflagged.inputs?.query, 'plain');

  const noContext = applyBusinessContextToStep(searchStep, null);
  assert.equal(noContext, searchStep, 'without context the step passes through untouched (gate blocks non-demo runs)');
});
