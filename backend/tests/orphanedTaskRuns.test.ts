import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('sweepOrphanedTaskRuns fails runs stranded in running/retrying from before boot', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-orphaned-runs-'));
  process.chdir(tempDir);

  try {
    const store = await import('../src/platform/store');
    const baseInput = {
      workspaceId: 'workspace_demo',
      taskId: 'task_demo',
      agentRole: 'operator' as const,
      modelTier: 'default' as const,
      estimatedCredits: 10,
    };

    const orphanRunning = store.createTaskRun(baseInput);
    const orphanRetrying = store.createTaskRun(baseInput);
    store.updateTaskRun(orphanRetrying.id, { status: 'retrying' });
    const finished = store.createTaskRun(baseInput);
    store.finalizeTaskRun(finished.id, { status: 'succeeded' });

    // Boot happens after all three runs started.
    const bootTime = new Date(Date.now() + 5);
    const freshAfterBoot = store.createTaskRun(baseInput);
    store.updateTaskRun(freshAfterBoot.id, { startedAt: new Date(bootTime.getTime() + 1000).toISOString() } as never);

    const swept = store.sweepOrphanedTaskRuns(bootTime);
    const sweptIds = swept.map((run) => run.id).sort();
    assert.deepEqual(sweptIds, [orphanRunning.id, orphanRetrying.id].sort(), 'Only pre-boot running/retrying runs are swept.');

    const runs = store.listTaskRuns('workspace_demo');
    const byId = new Map(runs.map((run) => [run.id, run]));
    assert.equal(byId.get(orphanRunning.id)?.status, 'failed');
    assert.ok(byId.get(orphanRunning.id)?.finishedAt, 'Swept run must carry finishedAt.');
    assert.match(String(byId.get(orphanRunning.id)?.error), /restart/i);
    assert.equal(byId.get(orphanRetrying.id)?.status, 'failed');
    assert.equal(byId.get(finished.id)?.status, 'succeeded', 'Finished runs stay untouched.');
    assert.equal(byId.get(freshAfterBoot.id)?.status, 'running', 'Post-boot runs stay untouched.');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
