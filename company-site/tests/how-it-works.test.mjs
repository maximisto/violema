import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { howItWorks as f } from '../data/how-it-works.mjs';
import { howItWorksSection, crossFieldSection, loopDiagram, crossFieldDiagram, wrapText } from '../lib/how-it-works.mjs';
import { escapeHTML } from '../lib/render.mjs';

const method = await readFile(new URL('../dist/method/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../browser/site.css', import.meta.url), 'utf8');
const section = id => method.match(new RegExp(`<section class="[^"]*" id="${id}"[\\s\\S]*?</section>`))[0];

test('the version 2.2 figures add up the way PsychDoc reports them', () => {
  const s = f.screening;
  assert.equal(s.fromScan + s.fromSearch, s.records, 'scan candidates from 2024 to 2026 plus search records were screened');
  assert.equal(s.fromScan + s.unscreened, f.scan.candidates, 'the rest of the scan has no verdict');
  assert.equal(s.included + s.excluded + s.pending, s.records);
  assert.equal(s.foundBySearch + s.scanOnly, s.included, 'every included record was found by the searches or by the scan alone');
  assert.ok(s.foundByScan >= s.scanOnly && s.foundByScan <= s.included);
  assert.ok(f.claims.preliminary <= f.claims.total && f.claims.posed <= f.claims.relations);
  assert.ok(f.independence.programs <= f.independence.papers);
  assert.ok(f.scan.multiSeed < f.scan.candidates);
  assert.equal(f.converging.length, 3);
  assert.equal(f.expertReviews, 0);
});

test('the method page explains the system after the six stations and before the trace', () => {
  const order = ['class="protocol"', 'id="how-it-works"', 'id="cross-field"', 'id="trace"'].map(marker => method.indexOf(marker));
  assert.ok(order.every(index => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const how = section('how-it-works');
  assert.match(how, /a snapshot of PsychDoc’s psilocybin synthesis, version 2\.2 of 11 October 2026: a provisional synthesis that has not had signed expert review/);
  // Release order publishes PsychDoc first, so the page must not call the version unpublished or in review.
  assert.doesNotMatch(how, /not yet published|in review/);
  assert.match(how, /the first application of this method/);
  assert.ok(how.includes(`href="${f.synthesis.walkthrough}"`), 'links the detailed PsychDoc page');
  for (const text of [`${f.scan.seeds} seeds, ${f.scan.candidates} candidates`, `${f.screening.records} records: ${f.screening.included} included,`, `${f.claims.total} claims, ${f.claims.preliminary} preliminary`, `${f.independence.programs} research programs`, `the searches found ${f.screening.foundBySearch} and the citation scan ${f.screening.foundByScan}`, `The other ${f.screening.unscreened} scan candidates have no verdict yet`, `keeps the ${f.scan.citingKept} most cited`])
    assert.ok(how.includes(text), text);
  assert.match(how, /Signed expert review is invited and has not been done/);
  assert.match(how, /adding them automatically is planned/);
  assert.match(how, /Running the searches on a schedule is planned/);
  const next = section('cross-field');
  assert.match(next, /<span class="pill">Planned<\/span>/);
  assert.match(next, /Nothing is agreed yet/);
});

test('the method page states where AI is used, quoting PsychDoc’s AI policy', () => {
  const how = section('how-it-works');
  const ai = f.aiPolicy;
  assert.equal(ai.url, 'https://psychdoc.ai/policies/ai-use');
  assert.ok(how.includes(`href="${ai.url}"`), 'links the policy');
  assert.match(how, /<h3>Where AI is used in this method<\/h3><p>PsychDoc, its first application, states this in its AI policy, updated 11 October 2026: “/);
  for (const line of [ai.intro, ...ai.helps, ai.decides]) assert.ok(how.includes(escapeHTML(line)), line);
  assert.ok(ai.helps[0].startsWith('Searching for candidate papers'), 'searching comes first');
  assert.ok(ai.helps[1].startsWith('Screening candidate papers'));
  assert.match(ai.helps[0], /The weekly citation scan is code, not an AI model\./);
  assert.ok(!ai.helps.some(line => /this site/.test(line)), 'on violema.com "this site" would name the wrong site');
});

test('each diagram is an accessible figure that scrolls inside its own region', () => {
  const figures = [...method.matchAll(/<figure class="diagram diagram-(\w+)">([\s\S]*?)<\/figure>/g)];
  assert.deepEqual(figures.map(m => m[1]), ['loop', 'cross']);
  for (const [, , body] of figures) {
    assert.match(body, /<div class="diagram-scroll" tabindex="0" role="region" aria-label="[^"]{20,}"><svg class="dg [^"]+" viewBox="0 0 \d+ \d+" role="img" focusable="false" aria-label="[^"]{80,}">/);
    assert.match(body, /<figcaption>[^<]{80,}<\/figcaption>$/);
  }
  assert.match(css, /\.diagram-scroll \{[^}]*overflow-x: auto;/);
});

test('the planned diagram carries the open question verbatim and the rats claim as a nondetection, not split by drug', () => {
  const cross = crossFieldDiagram(f);
  const text = [...cross.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(' ');
  assert.ok(text.includes(wrapText(f.openQuestion, 33).join(' ')), 'every word of the open question, in order');
  assert.match(f.openQuestion, /no structural difference detected at the sampled follow-up/);
  assert.match(text, /No synaptic density change detected; not reported per drug\./);
  assert.doesNotMatch(text, /without spine growth|did not differ/);
});

test('planned parts are drawn as planned', () => {
  const cross = crossFieldDiagram(f);
  assert.equal((cross.match(/class="dg-box"/g) || []).length, 3, 'only the three real claims are solid');
  assert.equal((cross.match(/class="dg-box-planned"/g) || []).length, 4, 'other fields, checked, offered to labs, contribution record');
  assert.equal((cross.match(/class="dg-edge"/g) || []).length, 0, 'every link in the cross-field figure is planned');
  assert.match(cross, /Planned links/);
  const loop = loopDiagram(f);
  assert.match(loop, /Added studies become seeds/);
  assert.doesNotMatch(loop, /Included papers become seeds/);
});

test('the copy keeps the house voice', () => {
  const copy = [section('how-it-works'), section('cross-field')].join(' ').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(copy, /—/);
  assert.doesNotMatch(copy, /\b(revolutionary|groundbreaking|cutting-edge|unprecedented|powerful|seamless(ly)?|game-changing|world-class|state-of-the-art|disrupt\w*|delve|elevate|nobody has asked)\b/i);
  assert.doesNotMatch(copy, /Astra|reviewed by an expert|peer[- ]reviewed/i);
});

test('the diagrams use only colour tokens', () => {
  for (const svg of [loopDiagram(f), crossFieldDiagram(f)]) {
    assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(| (fill|stroke|style)="/i, 'no literal colours or presentation attributes in the markup');
  }
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, selector]) => /\.(dg|diagram|how-|role-chip|outline-key)/.test(selector));
  assert.ok(rules.length > 20);
  for (const [, selector, body] of rules) assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, selector.trim());
});

test('diagram text never renders under 12 px', () => {
  const minWidth = Number(css.match(/\.diagram-scroll > svg \{[^}]*min-width: (\d+)px/)[1]);
  const sizes = [...css.matchAll(/(\.dg[^{]*)\{([^}]*)\}/g)].flatMap(([, , body]) => [...body.matchAll(/font-size: ([\d.]+)px/g)].map(m => Number(m[1])));
  for (const svg of [loopDiagram(f), crossFieldDiagram(f)]) {
    const viewBoxWidth = Number(svg.match(/viewBox="0 0 (\d+) /)[1]);
    assert.ok(Math.min(...sizes) * minWidth / viewBoxWidth >= 12, `smallest text at ${minWidth}px of ${viewBoxWidth}`);
  }
});

test('a recorded expert review cannot ship under copy that says there is none', () => {
  assert.throws(() => howItWorksSection({ ...f, expertReviews: 1 }), /expert review copy/);
  assert.doesNotThrow(() => crossFieldSection(f));
});

test('the method page figures agree with the frozen version 2.2 evidence map', async () => {
  const map = JSON.parse(await readFile(new URL('../data/evidence-map.json', import.meta.url), 'utf8'));
  assert.equal(map.papers.length, f.independence.papers);
  assert.equal(map.claims.length, f.claims.total);
  assert.equal(map.claims.filter(claim => claim.tier === 'preliminary').length, f.claims.preliminary);
  assert.equal(map.relations.length, f.claims.relations);
  assert.equal(map.relations.filter(relation => relation.posedAsQuestion).length, f.claims.posed);
  assert.equal(map.scan.candidates, f.scan.candidates);
  assert.equal(map.scan.seedCount, f.scan.seeds);
  assert.equal(map.scan.scannedAt.slice(0, 10), f.scan.date);
  assert.equal(map.scan.currentSeedCount, f.independence.papers, 'every study in the synthesis is a seed for the next scan');
  assert.equal(map.synthesis.updatedAt, f.synthesis.updatedAt, 'the snapshot date the page prints is the map\'s');
  for (const item of f.converging) {
    const claim = map.claims.find(entry => entry.id === item.claimId);
    assert.ok(claim, item.claimId);
    const paper = map.papers.find(entry => entry.id === claim.sourceIds[0]);
    assert.equal(paper.venue, item.venue);
    assert.equal(paper.year, Number(item.source.slice(-4)));
    assert.equal(paper.authors.at(-1).split(',')[0].trim(), item.lab, 'last author names the lab');
  }
});
