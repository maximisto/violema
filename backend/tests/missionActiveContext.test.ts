import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMissionRecords } from '../src/platform/missions';
import type { TaskRecord, TaskRunRecord } from '../src/platform/types';

// The 2026-08-04 prod shape, verbatim: supersession closed the 04:29 task at
// 04:44:47 — AFTER the 04:44:07 replacement task was created — so the corpse
// carried the newest updatedAt. Time-only context selection then reported the
// mission `completed` while a review sat waiting, and the approval queue
// rendered empty. An open task must outrank any closed one, always.

const AUTOMATION = {
  id: 'auto_comp',
  name: 'Competitor monitor',
  description: 'watch rivals',
  actions: ['research', 'deliver'],
  status: 'active',
} as never;

function task(input: { id: string; status: string; createdAt: string; updatedAt: string }): TaskRecord {
  return {
    id: input.id,
    workspaceId: 'ws_tenant',
    title: 'Competitor monitor',
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    metadata: { automationId: 'auto_comp' },
  } as unknown as TaskRecord;
}

function run(input: { id: string; taskId: string; startedAt: string }): TaskRunRecord {
  return {
    id: input.id,
    taskId: input.taskId,
    workspaceId: 'ws_tenant',
    status: 'succeeded',
    startedAt: input.startedAt,
    metadata: { automationId: 'auto_comp' },
  } as unknown as TaskRunRecord;
}

test('an open review outranks a superseded corpse with a newer timestamp', () => {
  const superseded = task({
    id: 't_superseded',
    status: 'completed',
    createdAt: '2026-08-04T04:29:00.000Z',
    // The supersession write — LATER than the open task's timestamps.
    updatedAt: '2026-08-04T04:44:47.000Z',
  });
  const waiting = task({
    id: 't_waiting',
    status: 'waiting_review',
    createdAt: '2026-08-04T04:44:07.000Z',
    updatedAt: '2026-08-04T04:44:46.000Z',
  });

  const records = buildMissionRecords({
    workspaceId: 'ws_tenant',
    automations: [AUTOMATION],
    tasks: [superseded, waiting],
    taskRuns: [
      run({ id: 'r_old', taskId: 't_superseded', startedAt: '2026-08-04T04:29:00.000Z' }),
      run({ id: 'r_new', taskId: 't_waiting', startedAt: '2026-08-04T04:44:07.000Z' }),
    ],
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'waiting_review', 'the mission must surface the open review');
  assert.equal(records[0].activeTaskId, 't_waiting', 'active context must be the open task');
});

test('with no open task, plain recency still decides', () => {
  const older = task({ id: 't_a', status: 'completed', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T01:00:00.000Z' });
  const newer = task({ id: 't_b', status: 'completed', createdAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T01:00:00.000Z' });

  const records = buildMissionRecords({
    workspaceId: 'ws_tenant',
    automations: [AUTOMATION],
    tasks: [older, newer],
    taskRuns: [],
  });
  assert.equal(records[0].activeTaskId, 't_b');
});

test('two open tasks: the newer one is the context', () => {
  const olderOpen = task({ id: 't_open_old', status: 'waiting_review', createdAt: '2026-08-03T00:00:00.000Z', updatedAt: '2026-08-03T00:10:00.000Z' });
  const newerOpen = task({ id: 't_open_new', status: 'waiting_review', createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:10:00.000Z' });

  const records = buildMissionRecords({
    workspaceId: 'ws_tenant',
    automations: [AUTOMATION],
    tasks: [olderOpen, newerOpen],
    taskRuns: [],
  });
  assert.equal(records[0].activeTaskId, 't_open_new');
});
