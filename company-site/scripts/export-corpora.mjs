import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { corpora } from '../data/corpora.mjs';
import { packetFor, validateCorpora } from '../data/contract.mjs';

export async function exportCorpora(destination = fileURLToPath(new URL('../data/', import.meta.url)), { check = false } = {}) {
  validateCorpora(corpora);
  if (!check) await mkdir(destination, { recursive: true });
  for (const corpus of corpora) {
    const path = join(destination, `${corpus.id}.json`);
    const expected = `${JSON.stringify(packetFor(corpus), null, 2)}\n`;
    if (check) {
      if (await readFile(path, 'utf8') !== expected) throw new Error(`Stale packet: ${corpus.id}`);
    } else await writeFile(path, expected);
  }
  return corpora.map((corpus) => `${corpus.id}.json`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/export-corpora.mjs [--check]');
  console.log((await exportCorpora(undefined, { check: args.includes('--check') })).join('\n'));
}
