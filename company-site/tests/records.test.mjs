import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKER_SRC } from '../lib/analytics.mjs';
import { FE4S4_ROUTE, FE4S4_RECORD_ROUTE } from '../lib/records.mjs';
import {
  ENERGIES, GAP, TRIMCI_GAIN, MATCH_DAYS, DETERMINANTS, SINGLETS, FLASH_MS, CLOCK, LEDGER, LEDGER_EVENTS, EVIDENCE, RESPONSE_ARCS,
  OUTCOMES, decide, resolve as resolveOutcome, parseInstant, compareInstants, verdict, raceSVG, RACE_SCALES, daysBetween, SQD_QPU_USD, BUDGET_USD,
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
  assert.equal(GAP.quantum, 334.04);
  assert.equal(GAP.trimci, 72.04);
  assert.equal(GAP.bar, 1.6);
  assert.equal(GAP.dmrg2017, 7.4);
  assert.equal(GAP.legeza, 2.38);
  assert.equal(TRIMCI_GAIN, 262);
  assert.equal(MATCH_DAYS, 9);
  assert.equal(ENERGIES.bar.eh, Math.round((ENERGIES.reference.eh + 0.0016) * 1e6) / 1e6);
});

test('the determinant and singlet counts are exact, and the strip stays under three flashes a second', () => {
  assert.equal(DETERMINANTS, 94143280n ** 2n);
  assert.equal(DETERMINANTS, 8862957169158400n);
  assert.equal(SINGLETS, 8862957169158400n - 7691780686091040n);
  assert.equal(SINGLETS, 1171176483067360n);
  assert.ok(1000 / FLASH_MS <= 2, 'a cell can change at most twice a second');
});

test('every evidence mark links to its source over https', () => {
  for (const item of EVIDENCE) assert.match(item.url, /^https:\/\/[a-z0-9.-]+\//, item.who);
});

test('the clock, the response arcs and the ledger counts add up', () => {
  assert.equal(CLOCK.windowDays, 180);
  assert.equal(daysBetween(CLOCK.dossierBy, CLOCK.judged), 180);
  assert.deepEqual(RESPONSE_ARCS.map(arc => arc.lines[0]), ['12 and 14 days between posts', '20 days from the preprint']);
  assert.equal(LEDGER_EVENTS, 88);
  assert.equal(Object.values(LEDGER.kinds).reduce((a, b) => a + b, 0), LEDGER_EVENTS);
  assert.deepEqual([...EVIDENCE].map(item => item.d), [...EVIDENCE].map(item => item.d).sort(), 'evidence is in the order it became public');
  assert.equal(EVIDENCE.length, 21);
});

test('the outcome rule gives each of the six outcomes, and a contradiction outranks confirmations', () => {
  const seen = new Set();
  for (const dossier of ['none', 'fails', 'inconclusive', 'positive']) for (const confirmations of [0, 1, 2, 3]) for (const contradiction of [false, true]) seen.add(decide({ dossier, confirmations, contradiction }));
  assert.deepEqual([...seen].sort(), OUTCOMES.map(o => o.id).sort());
  assert.equal(decide({ dossier: 'positive', confirmations: 3, contradiction: true }), 'o-contested');
  assert.equal(decide({ dossier: 'positive', confirmations: 2, contradiction: false }), 'o-established-benchmark');
  assert.equal(decide({ dossier: 'positive', confirmations: 1, contradiction: false }), 'o-positive-awaiting-confirmation');
  assert.match(verdict({ dossier: 'positive', confirmations: 1, contradiction: false }).why, /Confirmations shown:\u00a01\./, 'the count stays on the line of its label');
  assert.throws(() => decide({ dossier: 'maybe', confirmations: 0, contradiction: false }), RangeError);
});

test('Amendment 1: resolve() picks among bound dossiers by the stated order, and an earlier failing dossier no longer blocks a later positive one', () => {
  const d = (dossier, extra = {}) => ({ dossier, confirmations: 0, contradiction: false, publicAt: '2027-04-01T00:00:00Z', sourceId: 'x', speedLower: 2.2, ...extra });
  assert.equal(resolveOutcome([]).outcome, 'o-lapsed');
  assert.equal(resolveOutcome([d('none')]).outcome, 'o-lapsed');
  assert.equal(resolveOutcome([d('fails', { sourceId: 'a' }), d('fails', { sourceId: 'b' })]).outcome, 'o-threshold-not-met');
  assert.equal(resolveOutcome([d('fails', { sourceId: 'a' }), d('inconclusive', { sourceId: 'b' })]).outcome, 'o-otherwise');
  const griefer = d('fails', { publicAt: '2027-03-01T00:00:00Z', sourceId: 'a' });
  const real = d('positive', { publicAt: '2027-06-01T00:00:00Z', sourceId: 'b' });
  assert.equal(resolveOutcome([griefer, real]).outcome, 'o-positive-awaiting-confirmation', 'an earlier failing dossier from another team no longer locks the test');
  const contested = d('positive', { confirmations: 3, contradiction: true, sourceId: 'c' });
  const established = d('positive', { confirmations: 2, sourceId: 'd' });
  const awaiting = d('positive', { confirmations: 1, sourceId: 'e' });
  assert.equal(resolveOutcome([contested, established]).outcome, 'o-established-benchmark', 'a confirmed result is not outranked by another team’s contradicted one');
  assert.equal(resolveOutcome([contested, awaiting]).outcome, 'o-contested', 'a contested positive outranks an unconfirmed one, as the record states');
  assert.equal(resolveOutcome([awaiting, d('positive', { confirmations: 0, sourceId: 'f' })]).resolving.sourceId, 'e', 'same outcome: more confirmations resolves');
  const slower = d('positive', { confirmations: 1, speedLower: 2.1, publicAt: '2027-02-01T00:00:00Z', sourceId: 'g' });
  const faster = d('positive', { confirmations: 1, speedLower: 3.4, publicAt: '2027-05-01T00:00:00Z', sourceId: 'h' });
  assert.equal(resolveOutcome([slower, faster]).resolving.sourceId, 'h', 'same outcome and confirmations: the higher speed-score lower bound resolves');
  const later = d('positive', { confirmations: 1, speedLower: 2.5, publicAt: '2027-05-01T00:00:00.100Z', sourceId: 'i' });
  const earlier = d('positive', { confirmations: 1, speedLower: 2.5, publicAt: '2027-05-01T00:00:00Z', sourceId: 'j' });
  assert.equal(resolveOutcome([later, earlier]).resolving.sourceId, 'j', 'instants are compared as times, not strings: 100 ms later loses');
  const offset = d('positive', { confirmations: 1, speedLower: 2.5, publicAt: '2027-05-01T02:00:00+02:00', sourceId: 'B' });
  const utc = d('positive', { confirmations: 1, speedLower: 2.5, publicAt: '2027-05-01T00:00:00Z', sourceId: 'a' });
  assert.equal(resolveOutcome([offset, utc]).resolving.sourceId, 'B', 'equal instants in different offsets tie; identifiers then order by code unit, not locale');
  assert.throws(() => resolveOutcome([d('positive', { publicAt: 'May 2027' })]), RangeError, 'a bound dossier needs a valid instant');
  assert.throws(() => resolveOutcome([d('positive', { publicAt: '2027-02-30T00:00:00Z' })]), RangeError, 'an impossible date is refused, not normalized');
  assert.throws(() => resolveOutcome([d('positive', { publicAt: '20270501T000000Z' })]), RangeError, 'basic format is outside the accepted profile');
  assert.throws(() => resolveOutcome([d('positive', { publicAt: '2027-05-01T00:00:00,5Z' })]), RangeError, 'comma fractions are outside the accepted profile');
  const fine1 = d('positive', { confirmations: 1, speedLower: 2.5, publicAt: '2027-05-01T00:00:00.0002Z', sourceId: 'a' });
  const fine2 = d('positive', { confirmations: 1, speedLower: 2.5, publicAt: '2027-05-01T00:00:00.0001Z', sourceId: 'z' });
  assert.equal(resolveOutcome([fine1, fine2]).resolving.sourceId, 'z', 'fractional digits beyond milliseconds still order the instants');
  assert.equal(compareInstants(parseInstant('2027-05-01T00:00:00.10Z'), parseInstant('2027-05-01T00:00:00.1Z')), 0, 'trailing zeros do not change an instant');
  assert.equal(compareInstants(parseInstant('2027-05-01T02:00:00+02:00'), parseInstant('2027-05-01T00:00:00Z')), 0, 'offsets normalize to the same instant');
  assert.equal(parseInstant('2027-12-31T23:59:60Z'), null, 'leap seconds are outside the accepted profile');
  assert.equal(parseInstant('2028-02-29T12:00:00Z') === null, false, 'a real leap day parses');
  assert.throws(() => resolveOutcome([d('positive', { sourceId: '' })]), RangeError, 'a bound dossier needs an identifier');
  assert.throws(() => resolveOutcome([d('positive', { speedLower: undefined })]), RangeError, 'a positive dossier needs its speed-score lower bound');
  assert.throws(() => resolveOutcome([d('maybe')]), RangeError);
});

test('Amendment 1 is on the record page: per-team binding, the ablation, the team declaration and a dated revision row', async () => {
  const html = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  assert.ok(html.includes('Each team\'s earliest eligible quantum dossier binds for that team'));
  assert.ok(html.includes('A dossier from one team never prevents another team\'s dossier from binding.'));
  assert.ok(html.includes('Every quantum dossier also includes an ablation'));
  assert.ok(html.includes('the ten ablation outcomes with their declared classical source'));
  assert.ok(html.includes('and a team declaration'));
  assert.ok(html.includes('Amendment 1, before registration'));
  assert.doesNotMatch(html, /The bound dossier/, 'outcomes name the resolving dossier');
  assert.ok(html.includes('team binding, the ablation requirement and tier moves are Violema'));
  assert.ok(html.includes('within a team, identical public timestamps are ordered by permanent source identifier'));
  assert.ok(html.includes('ascending UTF-16 code-unit order, without locale collation'));
  assert.ok(html.includes('whether or not any of its runs succeeds'));
  assert.ok(html.includes('no decisive contradictory reproduction of it exists'));
  assert.ok(html.includes('Every bound dossier stays on the record'));
  assert.ok(html.includes('unresolved accounting that affects one dossier does not veto another'));
  const benchmark = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  assert.ok(benchmark.includes('At the cutoff, taken across every bound dossier, the test'), 'the scenario box describes aggregate states, not a global first dossier');
  assert.ok(benchmark.includes('of the resolving dossier by the cutoff'));
  assert.doesNotMatch(benchmark, /the earliest complete quantum dossier/);
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  assert.match(record, /fact-checked <[^>]*>2026-10-24<\/[^>]*>|fact-checked 2026-10-24/);
  assert.ok(record.includes('amended'), 'the record status names the amendment');
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

test('a simulated reading’s fixes hold: no identifying line, no sales button, no visible rule ids, and the comparisons point the right way', async () => {
  const page = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  for (const html of [page, record]) assert.doesNotMatch(html, /Cleveland Clinic researcher/, 'the record never says whom it was prepared for');
  const close = page.slice(page.indexOf('class="section record-close"'));
  assert.doesNotMatch(close.slice(0, close.indexOf('</section>')), /#briefing/, 'the closing section has no briefing button');
  assert.doesNotMatch(page, /<code>o-/, 'rule ids stay out of the reader-facing outcome list');
  assert.equal(ENERGIES.reference.eh, -327.247036, 'the reference is the lowest published variational S = 0 bound on the pinned file');
  assert.ok(ENERGIES.bar.eh < ENERGIES.legeza.eh && ENERGIES.bar.eh < -327.244733, 'the GPU DMRG run and the BS1 spin-coupling bounds sit above the pass line');
  assert.match(page + record, /frozen (when the test is|at) registration/);
  assert.doesNotMatch(page + record, /open for (the record’s )?review|independent model review/);
  assert.doesNotMatch(page + record, /integrals (were|are) not checked|has not been checked/, 'Zhai et al. name the pinned file as their input');
  assert.equal(SQD_QPU_USD, 57600);
  assert.ok(SQD_QPU_USD > BUDGET_USD / 2, 'the posted run’s quantum time alone is over half the per-run ceiling');
  assert.doesNotMatch(page + record, /in parallel/, 'the overlap of phases is the preprint’s description, not the tracker’s');
});
