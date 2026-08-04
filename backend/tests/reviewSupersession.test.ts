import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSupersededReviewTasks } from '../src/platform/automationLifecycle';

// The prod shape that broke revisions (2026-08-03): six same-named tasks for
// one automation — stale waiting reviews, a changes-requested block, live
// runs — and the operator unable to tell the revised draft from the rest.
const TASKS = [
  { id: 't_new_gate', status: 'waiting_review', delegationState: 'review', metadata: { automationId: 'auto_comp' } },
  { id: 't_stale_morning', status: 'waiting_review', delegationState: 'review', metadata: { automationId: 'auto_comp' } },
  { id: 't_changes_requested', status: 'blocked', delegationState: 'review', metadata: { automationId: 'auto_comp' } },
  { id: 't_running', status: 'running', delegationState: 'in_progress', metadata: { automationId: 'auto_comp' } },
  { id: 't_done', status: 'completed', delegationState: 'completed', metadata: { automationId: 'auto_comp' } },
  { id: 't_other_mission', status: 'waiting_review', delegationState: 'review', metadata: { automationId: 'auto_rev' } },
  { id: 't_blocked_not_review', status: 'blocked', delegationState: 'in_progress', metadata: { automationId: 'auto_comp' } },
];

test('supersession closes exactly the stale open gates, nothing else', () => {
  const superseded = selectSupersededReviewTasks(TASKS, {
    automationId: 'auto_comp',
    keepTaskId: 't_new_gate',
  });
  assert.deepEqual(
    superseded.map((task) => task.id).sort(),
    ['t_changes_requested', 't_stale_morning'],
  );
});

test('the surviving gate is never its own victim', () => {
  const superseded = selectSupersededReviewTasks(TASKS, {
    automationId: 'auto_comp',
    keepTaskId: 't_stale_morning',
  });
  assert.ok(!superseded.some((task) => task.id === 't_stale_morning'));
  assert.ok(superseded.some((task) => task.id === 't_new_gate'), 'a different keeper supersedes the rest');
});

test('running work and other missions are untouchable', () => {
  const superseded = selectSupersededReviewTasks(TASKS, {
    automationId: 'auto_comp',
    keepTaskId: 't_new_gate',
  });
  for (const forbidden of ['t_running', 't_done', 't_other_mission', 't_blocked_not_review']) {
    assert.ok(!superseded.some((task) => task.id === forbidden), `${forbidden} must not be closed`);
  }
  assert.deepEqual(selectSupersededReviewTasks([], { automationId: 'auto_comp', keepTaskId: 'x' }), []);
});
