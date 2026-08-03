// Delivery-lane honesty contract.
//
// Field observation, 2026-08-02 (tenant-journey run note): missions whose
// workflow has no delivery step — library-only or analysis-only runs — still
// rendered "Approve delivery" and "Request changes" on the Reviews surface.
// An approve control on a mission with nothing to send implies a send that
// does not exist.
//
// Three things are pinned here:
//   1. missionHasDeliveryLane: notify target OR a deliver step keeps the
//      controls; neither hides them (behavioural).
//   2. buildMissionWorkspaceView actually derives hasDeliveryLane from the
//      task (presenter composition).
//   3. MissionReviews gates the decision pair and tile copy on the field
//      (render composition — a correct helper wired to nothing is the bug
//      surviving with better paperwork).

import { readFileSync } from 'node:fs';
import {
  missionHasDeliveryLane,
  NO_DELIVERY_CONTROLS_NOTE,
  NO_DELIVERY_NEXT_VALUE,
  NO_DELIVERY_TILE_VALUE,
} from '../src/features/missions/deliveryLane.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 1. Behaviour -----------------------------------------------------------

assert(
  missionHasDeliveryLane({ notify: '#violema-reviews', steps: [] }) === true,
  'a notify target alone must keep the delivery lane',
);
assert(
  missionHasDeliveryLane({ notify: '', steps: [{ kind: 'deliver' }] }) === true,
  'a deliver step alone must keep the delivery lane',
);
assert(
  missionHasDeliveryLane({
    notify: '   ',
    steps: [{ kind: 'search' }, { kind: 'analyze' }, { kind: 'summarize' }],
  }) === false,
  'whitespace notify plus a lane with no deliver step must report no delivery lane',
);
assert(
  missionHasDeliveryLane({ steps: [{ kind: 'note' }, {}] }) === false,
  'kindless steps must not count as delivery',
);
assert(
  missionHasDeliveryLane(null) === false && missionHasDeliveryLane(undefined) === false,
  'missing source must fail closed to no-lane, never throw',
);

// --- 2. Presenter composition ------------------------------------------------

const presenterSource = readFileSync(
  new URL('../src/features/missions/missionPresenter.ts', import.meta.url),
  'utf8',
);
assert(
  presenterSource.includes('hasDeliveryLane: missionHasDeliveryLane('),
  'buildMissionWorkspaceView must derive hasDeliveryLane via missionHasDeliveryLane',
);

// --- 3. Render composition ---------------------------------------------------

const reviewsSource = readFileSync(
  new URL('../src/features/missions/MissionReviews.tsx', import.meta.url),
  'utf8',
);
assert(
  reviewsSource.includes('mission.hasDeliveryLane'),
  'MissionReviews must read mission.hasDeliveryLane',
);
assert(
  /const canApprove = hasDeliveryLane &&/.test(reviewsSource),
  'canApprove must be gated on the delivery lane before any other condition',
);
for (const pinned of [
  'NO_DELIVERY_CONTROLS_NOTE',
  'NO_DELIVERY_TILE_VALUE',
  'NO_DELIVERY_NEXT_VALUE',
]) {
  assert(
    reviewsSource.includes(pinned),
    `MissionReviews must render the shared ${pinned} copy, not a local variant`,
  );
}
assert(
  NO_DELIVERY_CONTROLS_NOTE.toLowerCase().includes('no delivery step') &&
    NO_DELIVERY_TILE_VALUE === 'No delivery step' &&
    NO_DELIVERY_NEXT_VALUE === 'No approval needed',
  'no-delivery copy must say plainly that nothing is sent and nothing needs approval',
);

console.log(
  'missionDeliveryLane.contract: approve controls provably absent for missions without a delivery lane',
);
