// Offline, optional development check. Requires an existing PsychDoc checkout
// and its installed tsx. It never changes that checkout or calls the network.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { corpora, stressTest } from './corpora.mjs';
import { toPsychDocObject, validateCorpora } from './contract.mjs';

const root = process.argv[2];
if (!root) throw new Error('Pass the read-only PsychDoc checkout path');
const commit = '3001296325cb95d64fcca6e412eb10b48264144a';
const hashes = {
  'lib/content/schema.ts': '95ed8614c1d4e9be9f79f6c96a855c2ea70d212c03fafe6cd3f3b2ad73caeb5d',
  'lib/synthesis/trust.ts': '4b6bf1d8ff931496ae1ff69950cf78d91f0f8d3a61ac200a5315364b2b0fbdb8',
  'lib/synthesis/corpus.ts': 'e07f56ef2eff364d5de80da1f3478121c2dcdf884b0d4e986ab95ba6754c3955',
  'analysis/stage_b/results/stability.json': '7289ec7d89f6df0061d2aa7508f58c4d46c37a611a5838162470596ff1e1ace1',
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const [path, hash] of Object.entries(hashes)) {
  assert.equal(sha256(await readFile(join(root, path))), hash, `Changed local source: ${path}`);
  assert.equal(sha256(execFileSync('git', ['show', `${commit}:${path}`], { cwd: root })), hash, `Pinned source mismatch: ${path}`);
}
const schema = await import(pathToFileURL(resolve(root, 'lib/content/schema.ts')).href);
const { computeTrust } = await import(pathToFileURL(resolve(root, 'lib/synthesis/trust.ts')).href);
validateCorpora();
const results = corpora.map((corpus) => {
  const object = toPsychDocObject(corpus);
  assert.deepEqual(schema.danglingClaims(object), []);
  assert.deepEqual(schema.danglingRelations(object), []);
  assert.deepEqual(schema.danglingEntities(object), []);
  const trust = computeTrust(object);
  assert.equal(trust.coverage.basis, 'none');
  assert.equal(trust.coverage.ratio, null);
  assert.equal(trust.living.scan, null);
  assert.equal(trust.fragility.length, 0);
  assert.deepEqual(object.claims.map((claim) => claim.basis), corpus.claims.map((claim) => claim.caveat));
  // Author data are deliberately absent: never export independence scores or tiers.
  const broken = structuredClone(object);
  broken.claims[0].sources.push('missing-source');
  assert.equal(schema.danglingClaims(broken).length, 1);
  return { corpusId: corpus.id, sources: corpus.sources.length, claims: corpus.claims.length, danglingReferences: 0, missingReferenceProbeDetected: true, coverageBasis: trust.coverage.basis, coverageRatio: trust.coverage.ratio, scan: trust.living.scan, authoredFragilityEntries: trust.fragility.length, caveatsPreserved: object.claims.length };
});
const saved = JSON.parse(await readFile(join(root, 'analysis/stage_b/results/stability.json'), 'utf8'));
const primary = saved.scenarios.find((s) => s.id === 'primary');
const subgroup = saved.scenarios.find((s) => s.id === 'mdd-trd');
assert.equal(primary.g, stressTest.estimate);
assert.deepEqual(primary.ci, [stressTest.lower, stressTest.upper]);
assert.deepEqual([saved.delta_g, saved.secondary_delta_g], stressTest.thresholds);
assert.equal(Math.max(...saved.scenarios.filter((s) => s.kind === 'bias').map((s) => s.shift)), stressTest.biasRange[1]);
const receipt = {
  schemaVersion: '1.0.0', checkedAt: '2026-10-10', psychdocCommit: commit,
  sourceHashes: hashes,
  packetModuleSha256: sha256(await readFile(new URL('./corpora.mjs', import.meta.url))),
  adapterSha256: sha256(await readFile(new URL('./contract.mjs', import.meta.url))),
  execution: 'Existing tsx executes unchanged, hash-checked PsychDoc schema.ts and trust.ts with the same new presentation adapter for both packets.',
  coreEdits: 0,
  results,
  limits: [
    'Only generic source-reference integrity and no-snapshot coverage/living states were exercised. Caveats survive the adapter; no authored fragility rules were supplied.',
    'No discovery, automated extraction, field coverage estimate, statistical refit or quantitative portability was demonstrated.',
    'Author metadata were not collected; author-cluster independence output and provisional adapter tiers are not published.',
    'No qualified human scientific review was performed during this check.',
  ],
};
await writeFile(new URL('./portability-receipt.json', import.meta.url), `${JSON.stringify(receipt, null, 2)}\n`);
await writeFile(new URL('./stage-b-snapshot.json', import.meta.url), `${JSON.stringify({ psychdocCommit: commit, sourceArtifact: 'analysis/stage_b/results/stability.json', sourceSha256: hashes['analysis/stage_b/results/stability.json'], declarationSha256: saved.declaration_sha256, dataSha256: saved.data_sha256, primary, subgroup, thresholds: stressTest.thresholds, biasRange: stressTest.biasRange, replayOnly: true }, null, 2)}\n`);
console.log(JSON.stringify({ psychdocCommit: commit, coreEdits: 0, results }, null, 2));
