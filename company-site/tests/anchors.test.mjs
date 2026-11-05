import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANCHOR } from '../lib/records.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const kept = join(root, 'data/anchors', ANCHOR.release);
const served = join(dist, 'company-assets/data/anchors', ANCHOR.release);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
// The tag OpenTimestamps writes before a Bitcoin block header attestation (opentimestamps/core/notary.py).
const BITCOIN_TAG = Buffer.from('0588960d73d71901', 'hex');

// A varuint as OpenTimestamps writes it: seven bits a byte, low bits first.
function varuint(bytes, at) {
  let value = 0, shift = 0, byte;
  do { byte = bytes[at++]; value += (byte & 0x7f) * 2 ** shift; shift += 7; } while (byte & 0x80);
  return [value, at];
}

// Every Bitcoin block height the proof attests, one per calendar that has confirmed.
function attestedHeights(proof) {
  const heights = [];
  for (let at = proof.indexOf(BITCOIN_TAG); at !== -1; at = proof.indexOf(BITCOIN_TAG, at + 1)) {
    const [, payload] = varuint(proof, at + BITCOIN_TAG.length);
    heights.push(varuint(proof, payload)[0]);
  }
  return heights;
}

const manifestLines = async () => new Map((await readFile(join(kept, ANCHOR.manifest), 'utf8')).trim().split('\n').map(line => line.split(/\s+/).reverse()));

test('the anchored manifest is the one whose hash was stamped, and lists every file of the release', async () => {
  const manifest = await readFile(join(kept, ANCHOR.manifest));
  assert.equal(sha256(manifest), ANCHOR.manifestSha256);
  const lines = await manifestLines();
  assert.equal(lines.size, ANCHOR.files);
  for (const page of ANCHOR.pages) assert.ok(lines.has(page), page);
  assert.deepEqual(await readFile(join(served, ANCHOR.manifest)), manifest, 'served byte for byte');
});

test('the stamped pages are kept byte for byte and match their manifest lines', async () => {
  const lines = await manifestLines();
  for (const page of ANCHOR.pages) {
    const bytes = await readFile(join(kept, 'release', page));
    assert.equal(sha256(bytes), lines.get(page), page);
    assert.deepEqual(await readFile(join(served, 'release', page)), bytes, `${page} is served as kept`);
  }
});

test('the timestamp proof commits to the manifest and is confirmed in the Bitcoin block the record names', async () => {
  const proof = await readFile(join(kept, `${ANCHOR.manifest}.ots`));
  assert.ok(proof.includes(Buffer.from(ANCHOR.manifestSha256, 'hex')), 'the proof starts from the manifest hash');
  const heights = attestedHeights(proof);
  assert.ok(heights.length > 0, 'the proof is upgraded: run ots upgrade, then ots verify, before publishing');
  assert.equal(ANCHOR.bitcoinBlock?.height, Math.min(...heights), 'the record names the earliest block the proof attests');
  assert.match(ANCHOR.bitcoinBlock.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(await readFile(join(served, `${ANCHOR.manifest}.ots`)), proof, 'served byte for byte');
});

test('the full record says what the timestamp covers and that it is not a registration', async () => {
  const record = await readFile(join(dist, 'records/fe4s4-benchmark/record/index.html'), 'utf8');
  const note = record.match(/<p class="caption record-status record-anchor">[\s\S]*?<\/p>/)?.[0] ?? '';
  assert.ok(note.includes('<strong>Timestamped, not registered.</strong>'));
  assert.ok(note.includes(`release ${ANCHOR.release}`) && note.includes(`each of the release’s ${ANCHOR.files} files`));
  assert.ok(note.includes(`<code>${ANCHOR.manifestSha256}</code>`));
  assert.ok(note.includes(`Bitcoin block ${ANCHOR.bitcoinBlock?.height.toLocaleString('en-US')} records it`));
  assert.ok(note.includes('It is not a registration: it does not make the protocol binding'));
  for (const href of [ANCHOR.manifest, `${ANCHOR.manifest}.ots`, 'release/records/fe4s4-benchmark/record/index.html']) {
    assert.ok(note.includes(`href="${ANCHOR.url}${href}" download`), href);
  }
});
