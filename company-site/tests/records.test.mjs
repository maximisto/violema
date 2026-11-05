import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKER_SRC } from '../lib/analytics.mjs';
import { FE4S4_RECORD_ROUTE, PAGES } from '../lib/routes.mjs';
import {
  ENERGIES, GAP, TRIMCI_GAIN, MATCH_DAYS, DETERMINANTS, SINGLETS, FLASH_MS, CLOCK, LEDGER, LEDGER_EVENTS, EVIDENCE, RESPONSE_ARCS,
  OUTCOMES, decide, resolve as resolveOutcome, parseInstant, compareInstants, verdict, raceSVG, RACE_SCALES, daysBetween, SQD_QPU_USD, BUDGET_USD,
  QUANTUM_GAP_BY_YEAR, RESPONSE_DAYS, ceilingRule, CEILING_RULE_MAX_QUANTUM_HOURS, ELAPSED_CEILING_HOURS,
} from '../lib/fe4s4-figures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
// Every registered page that sits under a field is a record page.
const records = PAGES.filter(page => page.field).map(page => [page.route, page.file]);

for (const [route, file] of records) test(`${route} is a public page in the site shell with no third-party requests`, async () => {
  const html = await readFile(join(dist, file), 'utf8');
  assert.match(html, /<!doctype html>/i);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="https://violema.com${route}"`));
  assert.ok(html.includes('<meta name="robots" content="index,follow">'));
  assert.ok(html.includes('<meta name="googlebot" content="max-image-preview:large">'));
  assert.ok(html.includes('<meta property="og:type" content="article">'));
  assert.ok(html.includes(`<meta property="og:url" content="https://violema.com${route}">`));
  assert.ok(html.includes('<link rel="stylesheet" href="/company-assets/records.css">'));
  assert.ok(html.includes(`src="${TRACKER_SRC}"`), 'visit statistics run as on every other page');
  assert.match(html, /class="site-header"/);
  assert.match(html, /class="site-footer"/);
  assert.doesNotMatch(html, /—/, 'Public copy uses no em-dashes');
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|claude\.ai|cdn\./, 'self-hosted fonts, no outside hosts');
  assert.doesNotMatch(html, /\b(curated|thought leaders|disrupt|game-changing|reimagining|seamless|delve|elevate)\b/i);
});

test('hypothesis records are listed in the sitemap and llms.txt', async () => {
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
  const llms = await readFile(join(dist, 'llms.txt'), 'utf8');
  for (const [route] of records) {
    assert.ok(sitemap.includes(`<loc>https://violema.com${route}</loc>`), route);
    assert.ok(llms.includes(`(https://violema.com${route})`), route);
  }
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
  assert.ok(html.includes('team binding, the ablation requirement, the ceiling rule, the frozen price table, the singlet tolerance and tier moves are Violema'));
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
  assert.match(record, /checked against primary sources <[^>]*>2026-10-24<\/[^>]*>/);
  assert.ok(record.includes('amended'), 'the record status names the amendment');
});

test('Amendment 2: the ceiling rule credits the 168-hour ceiling only with every family qualified and no documented classical success', () => {
  const applies = { everyFamilyQualifies: true, publicClassicalWithinCeilings: false };
  assert.equal(CEILING_RULE_MAX_QUANTUM_HOURS, 84);
  assert.equal(ceilingRule({ ...applies, slowestQuantumHours: 84 }), 'positive');
  assert.equal(ceilingRule({ ...applies, slowestQuantumHours: 84.001 }), 'inconclusive');
  assert.equal(ceilingRule({ ...applies, slowestQuantumHours: 1 }), 'positive');
  // A weak or early-stopped contender leaves its family unqualified, so even a fast quantum dossier stays inconclusive.
  assert.equal(ceilingRule({ ...applies, everyFamilyQualifies: false, slowestQuantumHours: 1 }), 'inconclusive');
  // A public classical calculation documented within both ceilings means the ceiling would overstate classical time.
  assert.equal(ceilingRule({ ...applies, publicClassicalWithinCeilings: true, slowestQuantumHours: 1 }), 'inconclusive');
  assert.equal(ceilingRule({ slowestQuantumHours: 1 }), 'inconclusive', 'unknown prerequisites never credit the ceiling');
  assert.throws(() => ceilingRule({ ...applies, slowestQuantumHours: 0 }), RangeError);
});

test('Amendment 2 is on the record: ceiling rule, frozen prices, a Not met tier and the singlet check', async () => {
  const html = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  assert.doesNotMatch(html, /If no classical contender reaches the target, the comparison is inconclusive/, 'B1: the trap is gone');
  assert.ok(html.includes(`the classical time is taken as the ${ELAPSED_CEILING_HOURS}-hour elapsed ceiling`));
  assert.ok(html.includes(`every quantum execution finishes within ${CEILING_RULE_MAX_QUANTUM_HOURS} hours`));
  assert.ok(html.includes('a run that ends earlier for any other reason earns no ceiling credit'), 'B1: early stops earn nothing');
  assert.ok(html.includes('its protocol must name, before its counted runs, the strongest published calculation in its family on this input and use settings no weaker'));
  assert.ok(html.includes('When the rule does not apply, the comparison is inconclusive: a missing or unqualified comparator family makes it so'));
  assert.doesNotMatch(html, /on the comparison date/, 'B2: prices no longer float to the comparison date');
  assert.ok(html.includes('one price table, frozen and published when this record is registered'));
  assert.doesNotMatch(html, /listed class that the team names|list no rental price/, 'B2: teams no longer pick their own valuation, and Fugaku does publish a price');
  assert.ok(html.includes('Violema adds a line by the same rule'), 'B2: one valuation rule, including for runs before registration');
  assert.ok(html.includes('a quantum dossier that relies on it cannot be positive'), 'B2: an unresolved valuation never shows budget compliance');
  const notMet = OUTCOMES.find(item => item.id === 'o-threshold-not-met');
  assert.equal(notMet.tier, 'Moves to Not met under this test (2027), for this benchmark only', 'B3');
  assert.ok(html.includes(`<span class="to to-tier">${notMet.tier}</span>`), 'the record and the picker give the same tier');
  assert.equal(OUTCOMES.filter(item => item.short === 'Speculation').length, 3, 'three outcomes stay at Speculation, not four');
  assert.ok(html.includes('taken as ⟨Ψ|S²|Ψ⟩ / ⟨Ψ|Ψ⟩ and evaluated exactly by the verifier in at least double precision, is at most 1 × 10⁻³'), 'B4');
  assert.ok(html.includes('a determinant expansion with zero spin projection or time-reversal symmetry does not qualify by construction'));
  assert.doesNotMatch(html, /normalized singlet/, 'the endpoint no longer says normalized; the Rayleigh quotient handles it');
  assert.ok(html.includes('whether it failed on speed or on the ten-run requirement'), 'B3');
  assert.ok(html.includes('Amendment 2, before registration.'), 'a dated history row');
});

test('the full record header leads with its status and a reviewer call; AI reviews live in the history', async () => {
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  const header = record.slice(0, record.indexOf('<article class="record-doc">'));
  assert.doesNotMatch(header, /AI model|AI reviewer/, 'the header no longer leads with AI review');
  assert.ok(header.includes('Reviewer sought.') && header.includes('has run DMRG or SQD on iron-sulfur clusters, and anyone can challenge a rule'));
  assert.ok(header.includes('<a href="/#briefing">Offer a review or challenge a rule</a>'), 'a route to challenge a rule');
  assert.ok(header.includes('“To review the science”'), 'the route names a choice the briefing form offers');
  const history = record.slice(record.indexOf('id="map-h"'));
  assert.ok(history.includes('Revised after reviews by two AI models from different providers'), 'the history keeps the reviews');
});

test('section 04 shows dated readings and no probabilities, from the record’s own sources', async () => {
  const page = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  assert.doesNotMatch(page, /This is not a forecast|Not a forecast/);
  assert.ok(page.includes('Two dated readings, and no probabilities yet.'));
  // -326.635 Eh (2024, as Shirakawa et al. quote it) and -326.913 Eh (2025, the tracker entry), against -327.247036 Eh.
  assert.deepEqual(QUANTUM_GAP_BY_YEAR, [{ year: 2024, mEh: 612.04 }, { year: 2025, mEh: 334.04 }]);
  assert.equal(Math.round((QUANTUM_GAP_BY_YEAR[0].mEh - QUANTUM_GAP_BY_YEAR[1].mEh) * 10) / 10, 278, 'the 278 mEh step Shirakawa et al. report');
  assert.deepEqual({ ...RESPONSE_DAYS }, { spin2023: 12, spin2023Second: 14, fe4s4Preprint2025: 18, fe4s4Tracker2025: 20 });
  // Year-labelled values, not arrows: two dated points on different problems are not a trajectory.
  assert.ok(page.includes('2024: 612 mEh · 2025: 334 mEh'));
  assert.ok(page.includes('2023: 12 days · 2025: 18 days'));
  assert.doesNotMatch(page.match(/<dl class="record-facts future-readings">[\s\S]*?<\/dl>/)[0], /→/);
  assert.ok(page.includes('lowest non-extrapolated SQD energy from quantum-hardware samples'), 'the 2025 paper also reports a lower extrapolated estimate');
  assert.ok(page.includes('reached the tracker 20 days after the quantum preprint'), 'the reading names the arc’s 20 days, so the two counts do not conflict');
  assert.ok(RESPONSE_ARCS[1].lines[0].startsWith('20 days'), 'the evidence arc still counts to the tracker entry');
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  assert.ok(record.includes('came 18 days after the quantum preprint'), 'the record’s indicator gives the same 2025 count');
});

test('registration, not a timestamp alone, makes the draft a commitment', async () => {
  const page = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  for (const html of [page, record]) assert.doesNotMatch(html, /commitment (only )?when (its|the) full text (receives|has) a public timestamp/);
  assert.ok(page.includes('It becomes a commitment only when its final text is registered.'));
  assert.ok(record.includes('A timestamp alone, like the one in the header, does not register it.'));
  assert.doesNotMatch(record, /No outside timestamp yet/);
});

test('the ledger section says the map events are live, and the participation line is plain', async () => {
  const page = await readFile(join(dist, 'records/fe4s4-benchmark/index.html'), 'utf8');
  assert.doesNotMatch(page, /not yet on psychdoc\.ai|release being prepared/);
  assert.match(page, /Live on psychdoc\.ai since <span class="date">2026-10-26<\/span>/);
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  assert.ok(record.includes('No team has agreed to take part, and nobody outside Violema funds this record.'));
  assert.doesNotMatch(record, /No team is represented as having agreed/);
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
