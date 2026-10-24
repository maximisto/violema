import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKER_SRC } from '../lib/analytics.mjs';
import { FE4S4_ROUTE, FE4S4_RECORD_ROUTE } from '../lib/records.mjs';
import {
  ENERGIES, GAP, TRIMCI_GAIN, MATCH_DAYS, DETERMINANTS, ENUMERATION_YEARS, CLOCK, LEDGER, LEDGER_EVENTS, EVIDENCE, RESPONSE_ARCS,
  OUTCOMES, decide, verdict, raceSVG, RACE_SCALES, daysBetween,
} from '../lib/fe4s4-figures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const records = [[FE4S4_ROUTE, 'records/fe4s4-benchmark/index.html'], [FE4S4_RECORD_ROUTE, 'records/fe4s4-benchmark/record/index.html']];

for (const [route, file] of records) test(`${route} is an unlisted page in the site shell with no third-party requests`, async () => {
  const html = await readFile(join(dist, file), 'utf8');
  assert.match(html, /<!doctype html>/i);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="https://violema.com${route}"`));
  assert.ok(html.includes('<meta name="robots" content="noindex,follow">'));
  assert.ok(html.includes('<link rel="stylesheet" href="/company-assets/records.css">'));
  assert.ok(html.includes(`src="${TRACKER_SRC}"`), 'visit statistics run as on every other page');
  assert.match(html, /class="site-header"/);
  assert.match(html, /class="site-footer"/);
  assert.doesNotMatch(html, /—/, 'Public copy uses no em-dashes');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|claude\.ai|cdn\./, 'self-hosted fonts, no outside hosts');
  assert.doesNotMatch(html, /\b(curated|thought leaders|disrupt|game-changing|reimagining|seamless|delve|elevate)\b/i);
});

test('hypothesis records stay out of the sitemap and llms.txt', async () => {
  assert.doesNotMatch(await readFile(join(dist, 'sitemap.xml'), 'utf8'), /\/records\//);
  assert.doesNotMatch(await readFile(join(dist, 'llms.txt'), 'utf8'), /\/records\//);
});

test('the benchmark page renders every instrument at rest and links the full record on this site', async () => {
  const html = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  for (const marker of ['class="cluster-still"', 'data-race', 'data-evidence-chart', 'data-outcome-list', 'class="record-chart ledger-chart"']) assert.ok(html.includes(marker), marker);
  assert.ok(html.includes(`href="${FE4S4_RECORD_ROUTE}"`));
  assert.equal((html.match(/class="is-occupied"/g) || []).length, 54, 'the configuration at rest has 27 + 27 occupied orbitals');
  assert.ok(html.includes('data-fe4s4'), 'site.mjs loads the instruments only here');
});

test('the full record carries the checked v3 text inside the shell', async () => {
  const html = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  assert.match(html, /<h1 id="claim-h">Can quantum assistance halve the time to a verified iron-sulfur benchmark result\?<\/h1>/);
  assert.ok(html.includes('Load-bearing facts checked against primary sources on 24 October 2026.'));
  assert.doesNotMatch(html, /class="masthead"/);
});

test('posted energies and the pass line are derived, never typed', () => {
  assert.equal(GAP.quantum, 331.66);
  assert.equal(GAP.trimci, 69.66);
  assert.equal(GAP.bar, 1.6);
  assert.equal(TRIMCI_GAIN, 262);
  assert.equal(MATCH_DAYS, 9);
  assert.equal(ENERGIES.bar.eh, Math.round((ENERGIES.reference.eh + 0.0016) * 1e5) / 1e5);
});

test('the determinant count and the enumeration time are C(36, 27) squared at 0.15 s each', () => {
  assert.equal(DETERMINANTS, 94143280n ** 2n);
  assert.equal(DETERMINANTS, 8862957169158400n);
  assert.equal(Math.round(ENUMERATION_YEARS / 1e6), 42);
});

test('the clock, the response arcs and the ledger counts add up', () => {
  assert.equal(CLOCK.windowDays, 180);
  assert.equal(daysBetween(CLOCK.dossierBy, CLOCK.judged), 180);
  assert.deepEqual(RESPONSE_ARCS.map(arc => arc.lines[0]), ['12 and 14 days between posts', '9 days between posts']);
  assert.equal(LEDGER_EVENTS, 88);
  assert.equal(Object.values(LEDGER.kinds).reduce((a, b) => a + b, 0), LEDGER_EVENTS);
  assert.deepEqual([...EVIDENCE].map(item => item.d), [...EVIDENCE].map(item => item.d).sort(), 'evidence is in the order it became public');
  assert.equal(EVIDENCE.length, 19);
});

test('the outcome rule gives each of the six outcomes, and a contradiction outranks confirmations', () => {
  const seen = new Set();
  for (const dossier of ['none', 'fails', 'inconclusive', 'positive']) for (const confirmations of [0, 1, 2, 3]) for (const contradiction of [false, true]) seen.add(decide({ dossier, confirmations, contradiction }));
  assert.deepEqual([...seen].sort(), OUTCOMES.map(o => o.id).sort());
  assert.equal(decide({ dossier: 'positive', confirmations: 3, contradiction: true }), 'o-contested');
  assert.equal(decide({ dossier: 'positive', confirmations: 2, contradiction: false }), 'o-established-benchmark');
  assert.equal(decide({ dossier: 'positive', confirmations: 1, contradiction: false }), 'o-positive-awaiting-confirmation');
  assert.match(verdict({ dossier: 'positive', confirmations: 1, contradiction: false }).why, /Confirmations shown: 1\./);
  assert.throws(() => decide({ dossier: 'maybe', confirmations: 0, contradiction: false }), RangeError);
});

test('the race chart shows marks only, a one-sided pass line, and no verdict multiplier', async () => {
  for (const scale of RACE_SCALES) {
    const svg = raceSVG(scale.max);
    assert.doesNotMatch(svg, /classical-line|quantum-line/, 'no line joins posts from different methods or dates');
    assert.doesNotMatch(svg, /×|within 1\.6/);
  }
  const page = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  assert.doesNotMatch(page, /207×|207 times|decided now|whole contest/);
  assert.match(page, /at or below it passes/);
});
