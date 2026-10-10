import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { corpora, stressTest } from '../data/corpora.mjs';
import { canonicalSource, validateCorpus, validateCorpora, packetFor, analysisForCorpus, toPsychDocObject } from '../data/contract.mjs';
import { exportCorpora } from '../scripts/export-corpora.mjs';

const load = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const copy = (value) => structuredClone(value);

test('both manually curated packets resolve all local claim and lineage references', () => {
  assert.equal(validateCorpora().length, 2);
  const materials = corpora.find((c) => c.id === 'perovskite-stability');
  assert.equal(materials.sources.filter((s) => s.kind.startsWith('Primary report')).length, 4);
  assert.equal(materials.sources.filter((s) => s.kind.startsWith('Reporting guidance')).length, 1);
});

test('a missing or cross-corpus reference fails closed', () => {
  const corpus = copy(corpora[1]);
  corpus.claims[0].sourceIds.push(corpora[0].sources[0].id);
  assert.throws(() => validateCorpus(corpus), /Unresolved source reference/);
  corpus.claims[0].sourceIds = [];
  assert.throws(() => validateCorpus(corpus), /Missing source references/);
});

test('duplicate insertion cannot increase evidence counts', () => {
  const corpus = copy(corpora[1]);
  corpus.sources.push(copy(corpus.sources[0]));
  assert.throws(() => validateCorpus(corpus), /Duplicate source id/);
  corpus.sources.at(-1).id = 'duplicate-alias';
  assert.throws(() => validateCorpus(corpus), /Duplicate source identity/);
});

test('DOI identity normalizes host, casing and fragment', () => {
  assert.equal(canonicalSource('https://dx.doi.org/10.1038/S41560-019-0529-5#section'), canonicalSource('https://doi.org/10.1038/s41560-019-0529-5'));
});

test('duplicate claims, corpus ids and source edges are rejected', () => {
  const corpus = copy(corpora[0]);
  corpus.claims.push(copy(corpus.claims[0]));
  assert.throws(() => validateCorpus(corpus), /Duplicate claim id/);
  assert.throws(() => validateCorpora([corpora[0], corpora[0]]), /Duplicate corpus id/);
  corpus.claims.pop();
  corpus.claims[0].sourceIds.push(corpus.claims[0].sourceIds[0]);
  assert.throws(() => validateCorpus(corpus), /Duplicate source reference/);
});

test('unsafe URLs and ids are rejected before serialization', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) {
    const corpus = copy(corpora[0]);
    corpus.sources[0].url = url;
    assert.throws(() => validateCorpus(corpus), /public HTTPS/);
  }
  const corpus = copy(corpora[0]);
  corpus.id = '../psychdoc';
  assert.throws(() => validateCorpus(corpus), /Unsafe corpus id/);
});

test('materials and unknown corpus never inherit clinical statistics', () => {
  assert.equal(analysisForCorpus('perovskite-stability'), null);
  assert.equal(analysisForCorpus('unknown'), null);
  const packet = packetFor(corpora[1]);
  assert.equal(packet.analysis, null);
  assert.doesNotMatch(JSON.stringify(packet), /Hedges|psilocybin|-0\.9030829/);
  assert.equal(analysisForCorpus('psychdoc').corpusId, 'psychdoc');
});

test('returned packets and analyses cannot mutate the shared source', () => {
  const packet = packetFor(corpora[0]);
  packet.corpus.claims[0].sourceIds.length = 0;
  packet.analysis.estimate = 999;
  assert.ok(corpora[0].claims[0].sourceIds.length > 0);
  assert.equal(stressTest.estimate, -0.9030829073153204);
});

test('downloadable JSON packets match the module exactly', async () => {
  await exportCorpora(undefined, { check: true });
  for (const corpus of corpora) assert.deepEqual(await load(`${corpus.id}.json`), packetFor(corpus));
});

test('stress replay preserves the pinned artifact precision and declaration', async () => {
  const saved = await load('stage-b-snapshot.json');
  assert.equal(saved.psychdocCommit, '3001296325cb95d64fcca6e412eb10b48264144a');
  assert.equal(saved.primary.k, 12);
  assert.equal(saved.primary.g, stressTest.estimate);
  assert.deepEqual(saved.primary.ci, [stressTest.lower, stressTest.upper]);
  assert.deepEqual(saved.thresholds, stressTest.thresholds);
  assert.deepEqual(saved.biasRange, stressTest.biasRange);
  assert.equal(saved.subgroup.id, 'mdd-trd');
  assert.ok(saved.subgroup.ci[0] < 0 && saved.subgroup.ci[1] > 0);
});

test('portability receipt is current and makes no field-coverage claim', async () => {
  const receipt = await load('portability-receipt.json');
  const hash = async (name) => createHash('sha256').update(await readFile(new URL(`../data/${name}`, import.meta.url))).digest('hex');
  assert.equal(receipt.packetModuleSha256, await hash('corpora.mjs'));
  assert.equal(receipt.adapterSha256, await hash('contract.mjs'));
  assert.equal(receipt.coreEdits, 0);
  assert.equal(receipt.results.length, corpora.length);
  for (const result of receipt.results) {
    assert.equal(result.coverageBasis, 'none');
    assert.equal(result.coverageRatio, null);
    assert.equal(result.scan, null);
    assert.equal(result.danglingReferences, 0);
    assert.equal(result.missingReferenceProbeDetected, true);
    assert.equal(result.authoredFragilityEntries, 0);
  }
});

test('adapter preserves claim provenance and does not invent expert review', () => {
  for (const corpus of corpora) {
    const adapted = toPsychDocObject(corpus);
    assert.deepEqual(adapted.claims.map((c) => c.sources), corpus.claims.map((c) => c.sourceIds));
    assert.equal(adapted.provenance.reviewedBy, undefined);
    assert.equal(adapted.corpus, undefined);
    assert.deepEqual(adapted.assets, []);
  }
});
