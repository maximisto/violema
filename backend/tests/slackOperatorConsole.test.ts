import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAmbiguousRunReply,
  buildHelpReply,
  buildReviewsReply,
  buildStatusReply,
  buildUnknownMissionReply,
  collectWaitingReviews,
  readReviewCardLocation,
} from '../src/slack/operatorConsole';
import type { TaskRecord, TaskRunRecord } from '../src/platform/types';

function task(overrides: Partial<TaskRecord> & { id: string }): TaskRecord {
  return {
    workspaceId: 'ws_1',
    title: 'Untitled',
    kind: 'automation',
    status: 'queued',
    priority: 'medium',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
  } as TaskRecord;
}

function taskRun(overrides: Partial<TaskRunRecord> & { id: string; taskId: string }): TaskRunRecord {
  return {
    workspaceId: 'ws_1',
    status: 'succeeded',
    agentRole: 'analyst',
    modelTier: 'default',
    estimatedCredits: 10,
    startedAt: '2026-08-01T09:00:00.000Z',
    ...overrides,
  } as TaskRunRecord;
}

const AUTOMATIONS = [
  { id: 'auto_1', name: 'Founder Update', next_run_at: '2026-08-03T09:00:00.000Z', status: 'active' },
  { id: 'auto_2', name: 'Competitor Watch', next_run_at: '2026-08-02T09:00:00.000Z', status: 'active' },
  { id: 'auto_3', name: 'Paused Digest', next_run_at: '2026-08-01T09:00:00.000Z', status: 'paused' },
];

test('status counts real task state and names what is waiting', () => {
  const reply = buildStatusReply({
    automations: AUTOMATIONS,
    tasks: [
      task({ id: 'task_1', status: 'running' }),
      task({ id: 'task_2', status: 'waiting_review', metadata: { automationId: 'auto_1' } }),
      task({ id: 'task_3', status: 'blocked' }),
    ],
    taskRuns: [
      taskRun({
        id: 'run_2',
        taskId: 'task_2',
        metadata: { slackReviewMessage: { channel: 'C0123456789', ts: '111.222' } },
      }),
    ],
  });

  assert.match(reply, /1 running · 1 waiting review · 1 blocked/);
  assert.match(reply, /Founder Update/);
  assert.match(reply, /<#C0123456789>/, 'a posted card should be pointed at');
  // Soonest first, and a paused mission is not "next scheduled".
  assert.ok(
    reply.indexOf('Competitor Watch') < reply.indexOf('Founder Update — 2026-08-03'),
    'upcoming runs sort soonest first',
  );
  assert.equal(reply.includes('Paused Digest'), false, 'paused missions are not scheduled');
});

test('status is honest when there is nothing to report', () => {
  const reply = buildStatusReply({ automations: [], tasks: [], taskRuns: [] });
  assert.match(reply, /0 running · 0 waiting review · 0 blocked/);
  assert.match(reply, /Nothing is running and nothing is scheduled/);
});

test('reviews lists what is waiting and says so plainly when nothing is', () => {
  assert.match(
    buildReviewsReply({ automations: AUTOMATIONS, tasks: [], taskRuns: [] }),
    /Nothing is waiting for approval/,
  );

  const reply = buildReviewsReply({
    automations: AUTOMATIONS,
    tasks: [task({ id: 'task_2', status: 'waiting_review', metadata: { automationId: 'auto_2' } })],
    taskRuns: [taskRun({ id: 'run_2', taskId: 'task_2' })],
  });
  assert.match(reply, /1 waiting for approval/);
  assert.match(reply, /Competitor Watch/);
  assert.match(reply, /approve from the dashboard/, 'with no card posted, it must not invent one');
});

test('a waiting review with no run is not reported as reviewable', () => {
  const waiting = collectWaitingReviews({
    automations: AUTOMATIONS,
    tasks: [task({ id: 'task_9', status: 'waiting_review', metadata: { automationId: 'auto_1' } })],
    taskRuns: [],
  });
  assert.deepEqual(waiting, []);
});

test('help scopes itself honestly to what the reader may actually do', () => {
  const operatorHelp = buildHelpReply(true);
  for (const verb of ['status', 'reviews', 'run <mission name>', 'help']) {
    assert.ok(operatorHelp.includes(verb), `help must list ${verb}`);
  }
  assert.equal(operatorHelp.includes('limited to workspace operators'), false);

  const readerHelp = buildHelpReply(false);
  assert.match(readerHelp, /limited to workspace operators/);
});

test('an ambiguous run lists the options and states that nothing started', () => {
  const reply = buildAmbiguousRunReply('founder update', [
    { id: 'a1', name: 'Founder Update Monday' },
    { id: 'a2', name: 'Founder Update Friday' },
  ]);
  assert.match(reply, /matches 2 missions/);
  assert.match(reply, /Founder Update Monday/);
  assert.match(reply, /Founder Update Friday/);
  assert.match(reply, /Nothing started/);
});

test('an unknown mission offers the real mission list', () => {
  assert.match(buildUnknownMissionReply('payroll', AUTOMATIONS), /could not find a mission matching "payroll"/);
  assert.match(buildUnknownMissionReply('payroll', AUTOMATIONS), /Founder Update/);
  assert.match(buildUnknownMissionReply('payroll', []), /no missions yet/);
});

test('review card locations are only read when fully formed', () => {
  assert.deepEqual(
    readReviewCardLocation(taskRun({
      id: 'r', taskId: 't', metadata: { slackReviewMessage: { channel: 'C1', ts: '1.2' } },
    })),
    { channel: 'C1', ts: '1.2' },
  );
  assert.equal(readReviewCardLocation(taskRun({ id: 'r', taskId: 't' })), null);
  assert.equal(
    readReviewCardLocation(taskRun({ id: 'r', taskId: 't', metadata: { slackReviewMessage: { channel: 'C1' } } })),
    null,
    'a half-written location must not be treated as postable',
  );
});
