import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readJsonFile, updateJsonFile, writeJsonFile } from '../src/platform/jsonStore';

function withTempDirectory(run: (directory: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-json-store-'));

  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('writeJsonFile atomically replaces the store and preserves the previous valid backup', () => withTempDirectory((directory) => {
  const filePath = path.join(directory, 'store.json');

  writeJsonFile(filePath, { version: 1 });
  assert.deepEqual(readJsonFile(filePath, { version: 0 }), { version: 1 });
  assert.equal(fs.existsSync(`${filePath}.bak`), false);

  writeJsonFile(filePath, { version: 2 });

  assert.deepEqual(readJsonFile(filePath, { version: 0 }), { version: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${filePath}.bak`, 'utf-8')), { version: 1 });
}));

test('readJsonFile quarantines corrupt stores and falls back to the last valid backup', () => withTempDirectory((directory) => {
  const filePath = path.join(directory, 'store.json');
  const originalConsoleError = console.error;
  const errors: string[] = [];

  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    writeJsonFile(filePath, { version: 'backup' });
    writeJsonFile(filePath, { version: 'main' });
    fs.writeFileSync(filePath, '{not-valid-json');

    assert.deepEqual(readJsonFile(filePath, { version: 'fallback' }), { version: 'backup' });
    assert.equal(fs.existsSync(filePath), false);
    assert.equal(
      fs.readdirSync(directory).filter((fileName) => fileName.startsWith('store.json.corrupt.')).length,
      1,
    );
    assert.match(errors.join('\n'), /Corrupt JSON store moved/);
  } finally {
    console.error = originalConsoleError;
  }
}));

test('updateJsonFile performs a read-modify-write against the latest stored value', () => withTempDirectory((directory) => {
  const filePath = path.join(directory, 'store.json');

  writeJsonFile(filePath, { items: ['first'] });
  const firstUpdate = updateJsonFile(filePath, { items: [] as string[] }, (current) => ({
    items: [...current.items, 'second'],
  }));
  const secondUpdate = updateJsonFile(filePath, { items: [] as string[] }, (current) => ({
    items: [...current.items, 'third'],
  }));

  assert.deepEqual(firstUpdate, { items: ['first', 'second'] });
  assert.deepEqual(secondUpdate, { items: ['first', 'second', 'third'] });
  assert.deepEqual(readJsonFile(filePath, { items: [] as string[] }), {
    items: ['first', 'second', 'third'],
  });
}));
