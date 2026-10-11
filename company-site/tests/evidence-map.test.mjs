import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { escapeHTML } from '../lib/render.mjs';
import { evidenceMapSection, filterEvidenceMap, renderMapDetail, renderMapField } from '../lib/evidence-map.mjs';

const bytes = await readFile(new URL('../data/evidence-map.json', import.meta.url));
const data = JSON.parse(bytes);
const hash = createHash('sha256').update(bytes).digest('hex');

test('the homepage includes the exact versioned map and keeps the 12-trial hero separate', async () => {
  const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const served = await readFile(new URL('../dist/company-assets/data/evidence-map.json', import.meta.url));
  assert.ok(bytes.equals(served));
  assert.ok(home.includes(`data-map-sha256="${hash}"`));
  assert.match(home, /href="https:\/\/psychdoc.ai\/evidence\/psilocybin-rewiring\/map"/);
  assert.equal((home.match(/class="evidence-hero instrument"/g) || []).length, 1);
  assert.equal((home.match(/data-trial="/g) || []).length, 12);
  assert.ok(home.indexOf('id="evidence-map"') > home.indexOf('class="evidence-hero instrument"'));
  const embedded = JSON.parse(home.match(/<script type="application\/json" data-map-data>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embedded, data);
});

test('study and method filters keep only matching claims and their declared edges', () => {
  const studies = [...new Set(data.claims.flatMap(claim => claim.studyTypes))];
  const methods = [...new Set(data.claims.flatMap(claim => claim.methods.map(method => method.id)))];
  for (const study of ['all', ...studies]) for (const method of ['all', ...methods]) {
    const filtered = filterEvidenceMap(data, study, method);
    for (const claim of filtered.claims) {
      assert.ok(study === 'all' || claim.studyTypes.includes(study));
      assert.ok(method === 'all' || claim.methods.some(item => item.id === method));
    }
    const claimIds = new Set(filtered.claims.map(claim => claim.id));
    const paperIds = new Set(filtered.papers.map(paper => paper.id));
    for (const edge of filtered.sourceLinks) assert.ok(paperIds.has(edge.from) && claimIds.has(edge.to));
    for (const edge of filtered.relations) assert.ok(claimIds.has(edge.from) && claimIds.has(edge.to));
  }
  assert.equal(filterEvidenceMap(data, 'missing').claims.length, 0);
  assert.match(renderMapField(filterEvidenceMap(data, 'missing'), { id: '', type: 'claim' }), /No claims match both filters/);
});

test('resetting filters preserves sources without a claim-level link', () => {
  const orphan = { ...data.papers[0], id: 'unlinked-paper', claimIds: [] };
  const extended = { ...data, papers: [...data.papers, orphan] };
  assert.equal(filterEvidenceMap(extended).papers.length, data.papers.length + 1);
  assert.ok(!filterEvidenceMap(extended, 'animal').papers.some(paper => paper.id === orphan.id));
});

test('every real source, claim and authored relationship has a readable record', () => {
  const rendered = evidenceMapSection(data, hash);
  for (const paper of data.papers) {
    assert.ok(rendered.includes(escapeHTML(paper.title)));
    assert.ok(renderMapDetail(data, { type: 'paper', id: paper.id }).includes(escapeHTML(paper.title)));
  }
  for (const claim of data.claims) {
    const detail = renderMapDetail(data, { type: 'claim', id: claim.id });
    assert.ok(rendered.includes(escapeHTML(claim.text)));
    assert.ok(detail.includes(escapeHTML(claim.basis)));
    for (const edge of data.sourceLinks.filter(item => item.to === claim.id)) {
      assert.ok(detail.includes(`data-map-id="${edge.id}"`), 'source lines have a keyboard-accessible inspection button');
    }
  }
  for (const relation of data.relations) {
    const detail = renderMapDetail(data, { type: 'edge', id: relation.id });
    assert.ok(detail.includes(escapeHTML(relation.statement)));
    assert.ok(detail.includes(escapeHTML(relation.basis)));
    assert.match(detail, /Authored relationship/);
    if (relation.posedAsQuestion) assert.match(detail, /Question for review/);
  }
  for (const edge of data.sourceLinks) assert.match(renderMapDetail(data, { type: 'edge', id: edge.id }), /Source-to-claim connection/);
  assert.match(rendered, /Paper-to-paper citations and model similarity are not shown/);
  assert.match(rendered, /<details class="map-text-alternative">/);
});

test('the field draws only declared edges and uses ordinary links before enhancement', () => {
  const field = renderMapField(data, { type: 'claim', id: data.claims[0].id });
  assert.equal((field.match(/data-map-select="paper"/g) || []).length, data.papers.length);
  assert.equal((field.match(/data-map-select="claim"/g) || []).length, data.claims.length);
  assert.equal((field.match(/data-map-select="edge"/g) || []).length, data.sourceLinks.length + data.relations.length);
  assert.equal((field.match(/map-edge-question/g) || []).length, data.relations.filter(item => item.posedAsQuestion).length);
  assert.doesNotMatch(field, /tabindex="-1"/);
  for (const paper of data.papers) assert.ok(field.includes(`href="${escapeHTML(paper.href)}"`));
});

test('map text and embedded JSON cannot escape their HTML contexts', () => {
  const malicious = structuredClone(data);
  malicious.claims[0].text = '</script><script>alert(1)</script>';
  malicious.papers[0].title = '<img src=x onerror=alert(1)>';
  const html = evidenceMapSection(malicious, hash);
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /\\u003c\/script>/);
  assert.throws(() => evidenceMapSection({ ...data, schemaVersion: 2 }, hash), /versioned evidence map/);
});

test('the README records the version and hash of the map it ships', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(readme.includes(`The source synthesis was updated on ${data.synthesis.updatedAt}`));
  assert.ok(readme.includes(`SHA-256 \`${hash}\``), 'README hash matches data/evidence-map.json');
});
