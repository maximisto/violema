import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

// The scheduler module resolves its JSON store paths from process.cwd() at
// import time, so the whole file shares one temp dir and one import.
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-automation-dedupe-'));
process.chdir(tempDir);

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('createAutomation reuses an existing active automation with the same workspace and name', async () => {
  const scheduler = await import('../src/scheduler');
  const input = {
    workspaceId: 'workspace_demo',
    name: 'Competitor monitor',
    schedule: 'every monday at 8am',
    actions: ['Research competitor moves'],
  };

  const first = scheduler.createAutomation(input, async () => ({ ok: true }));
  const second = scheduler.createAutomation(input, async () => ({ ok: true }));

  assert.equal(second.id, first.id, 'Expected the second create to return the existing automation.');
  const matching = scheduler
    .listAutomations()
    .filter((item) => item.workspaceId === 'workspace_demo' && item.name === 'Competitor monitor');
  assert.equal(matching.length, 1, 'Expected exactly one automation for the workspace/name pair.');
});

test('createAutomation dedupe is scoped to the workspace and skips paused automations', async () => {
  const scheduler = await import('../src/scheduler');
  const base = {
    name: 'Competitor monitor',
    schedule: 'every monday at 8am',
    actions: ['Research competitor moves'],
  };

  const wsA = scheduler.createAutomation({ ...base, workspaceId: 'workspace_a' }, async () => ({ ok: true }));
  const wsB = scheduler.createAutomation({ ...base, workspaceId: 'workspace_b' }, async () => ({ ok: true }));
  assert.notEqual(wsA.id, wsB.id, 'Different workspaces must keep independent automations.');

  scheduler.updateAutomation(wsA.id, { status: 'paused' }, async () => ({ ok: true }));
  const replacement = scheduler.createAutomation({ ...base, workspaceId: 'workspace_a' }, async () => ({ ok: true }));
  assert.notEqual(replacement.id, wsA.id, 'A paused automation must not swallow a new create.');

  const caseInsensitive = scheduler.createAutomation(
    { ...base, name: '  competitor MONITOR ', workspaceId: 'workspace_b' },
    async () => ({ ok: true }),
  );
  assert.equal(caseInsensitive.id, wsB.id, 'Name matching must be trim + case insensitive.');
});
