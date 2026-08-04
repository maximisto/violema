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

test('sweepZombieTasks closes running tasks whose runs are all terminal — and nothing else', async () => {
  const originalCwd = process.cwd();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-zombie-tasks-'));
  process.chdir(tempDir);

  try {
    const store = await import('../src/platform/store');
    const runInput = (taskId: string) => ({
      workspaceId: 'workspace_demo',
      taskId,
      agentRole: 'operator' as const,
      modelTier: 'default' as const,
      estimatedCredits: 10,
    });
    const makeTask = (status: 'running' | 'waiting_review') => {
      const task = store.createTask({ workspaceId: 'workspace_demo', title: 'QA task', kind: 'automation' });
      store.updateTask(task.id, { status });
      return task;
    };

    // The 2026-08-03 zombie shape: task running, run long since succeeded.
    const zombie = makeTask('running');
    const zombieOldRun = store.createTaskRun(runInput(zombie.id));
    store.finalizeTaskRun(zombieOldRun.id, { status: 'failed' });
    const zombieNewRun = store.createTaskRun(runInput(zombie.id));
    store.finalizeTaskRun(zombieNewRun.id, { status: 'succeeded' });

    // Live work: run still in flight — closing this would race the scheduler.
    const live = makeTask('running');
    store.createTaskRun(runInput(live.id));

    // Never ran: not this sweep's story.
    const runless = makeTask('running');

    // Open review gate: not in scope, must never be touched at boot.
    const waiting = makeTask('waiting_review');
    const waitingRun = store.createTaskRun(runInput(waiting.id));
    store.finalizeTaskRun(waitingRun.id, { status: 'succeeded' });

    const bootTime = new Date(Date.now() + 5);
    const swept = store.sweepZombieTasks(bootTime);

    assert.deepEqual(swept.map((task) => task.id), [zombie.id], 'Only the zombie is swept.');

    const tasks = new Map(store.listTasks('workspace_demo').map((task) => [task.id, task]));
    const closed = tasks.get(zombie.id);
    assert.equal(closed?.status, 'completed', 'The NEWEST run outcome wins — succeeded maps to completed.');
    assert.equal(closed?.metadata?.zombieSweptFromRun, zombieNewRun.id, 'The sweep records which run decided the outcome.');
    assert.ok(closed?.metadata?.zombieSweptAt, 'The sweep stamps when it acted.');
    assert.equal(tasks.get(live.id)?.status, 'running', 'A task with an in-flight run stays running.');
    assert.equal(tasks.get(runless.id)?.status, 'running', 'A running task with no runs is left for a human.');
    assert.equal(tasks.get(waiting.id)?.status, 'waiting_review', 'An open review gate is never closed by a boot.');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
