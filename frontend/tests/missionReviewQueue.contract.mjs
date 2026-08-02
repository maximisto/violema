// Reviews-tab queue contract.
//
// Field regression, 2026-07-31: a mission in `waiting_review` -- served FIRST by
// /api/missions -- never appeared under the Dashboard's Reviews tab. The tab
// rendered <MissionReviews mission={selectedMission} /> for the ONE selected
// mission, and the selection pointer had resolved to a different mission from
// the persisted `violema_selected_mission_<workspaceId>` key. The approval was
// only reachable by hand-navigating into mission detail.
//
// Two things are pinned here:
//   1. buildMissionReviewQueue lists every awaiting mission regardless of which
//      one is selected (behavioural).
//   2. Dashboard.tsx actually renders that queue on the Reviews surface
//      (composition -- a correct selector wired to nothing is the same bug).

import { readFileSync } from 'node:fs';
import {
  buildMissionReviewQueue,
  resolveReviewQueueFocus,
} from '../src/features/missions/reviewQueue.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 1. Behaviour -----------------------------------------------------------

const awaitingFirst = {
  id: 'task_awaiting',
  automationId: 'auto_awaiting',
  title: 'Weekly founder update',
  notify: '#all-purple-orange',
  runStatus: 'waiting_review',
};
const selectedElsewhere = {
  id: 'task_other',
  automationId: 'auto_other',
  title: 'Competitor watch',
  runStatus: 'succeeded',
};

const queue = buildMissionReviewQueue([awaitingFirst, selectedElsewhere]);

assert(queue.length === 1, `exactly one mission awaits review (got ${queue.length})`);
assert(
  queue[0].id === 'task_awaiting',
  'a waiting_review mission appears in the Reviews queue even when another mission is selected',
);
assert(
  queue[0].title === 'Weekly founder update' && queue[0].deliveryLabel === '#all-purple-orange',
  'the queue entry carries the mission title and its held delivery target',
);

assert(
  buildMissionReviewQueue([{ id: 'r', runStatus: 'review' }]).length === 1,
  "the legacy 'review' run status normalizes into the queue",
);

assert(
  buildMissionReviewQueue([
    {
      id: 'delivered',
      runStatus: 'waiting_review',
      latestDelivery: { status: 'delivered', to: '#all-purple-orange' },
    },
  ]).length === 0,
  'an already-delivered receipt drops out of the queue',
);

assert(
  buildMissionReviewQueue([
    { id: 'a', automationId: 'auto_dupe', runStatus: 'waiting_review' },
    { id: 'b', automationId: 'auto_dupe', runStatus: 'waiting_review' },
  ]).length === 1,
  'two task rows for one automation collapse to a single queue entry',
);

assert(buildMissionReviewQueue(undefined).length === 0, 'a missing task list yields an empty queue');
assert(
  buildMissionReviewQueue([]).length === 0 && buildMissionReviewQueue([selectedElsewhere]).length === 0,
  'nothing awaiting review yields an empty queue',
);

// --- 2. Focus resolution ----------------------------------------------------

assert(
  resolveReviewQueueFocus(queue, 'task_other') === 'task_awaiting',
  'opening Reviews with an unrelated mission selected moves focus to the pending approval',
);
assert(
  resolveReviewQueueFocus(queue, 'task_awaiting') === null,
  'a selection that is already awaiting review is left alone',
);
assert(resolveReviewQueueFocus([], 'task_other') === null, 'an empty queue never steals focus');

// --- 3. Composition: the Dashboard renders the queue on the Reviews surface --

const dashboard = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');

assert(
  dashboard.includes("from '../features/missions/reviewQueue'"),
  'Dashboard imports the review-queue selector',
);
assert(
  dashboard.includes('<MissionReviewQueue'),
  'Dashboard renders the MissionReviewQueue list component',
);

const reviewsView =
  dashboard.split('const renderMissionReviewsView')[1]?.split('const renderMissionWorkspaceContent')[0] || '';
assert(
  reviewsView.includes('<MissionReviewQueue'),
  'the Reviews view renders the queue alongside the selected mission gate',
);
assert(
  reviewsView.includes('<MissionReviews'),
  'the Reviews view still renders the approval gate for the focused mission',
);

console.log('missionReviewQueue.contract: waiting_review missions are listed and reachable in the Reviews tab');
