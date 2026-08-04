// Mission-collection collapse contract.
//
// Field observation, 2026-08-04 (mission-run scare run note): the founder
// workspace held two automations both named "Competitor monitor" (platform
// seed + workspace copy). Only one claimed the template card; the other fell
// through to "Your missions" as a duplicate, and the six-mission collection
// read as eight.
//
// Pinned here:
//   1. Same-name missions fold into one claim — the newest (last in API
//      order) fronts the card, no same-titled sibling renders separately.
//   2. Missions matching no template (e.g. the Platform learning brief) still
//      render as custom cards.
//   3. The legacy title alias keeps claiming across the rename.
//   4. WorkflowTemplateGallery actually delegates to the helper (render
//      composition — a correct helper wired to nothing is the bug surviving
//      with better paperwork).

import { readFileSync } from 'node:fs';
import {
  normalizeMissionTitle,
  partitionCollectionMissions,
} from '../src/features/templates/galleryCollection.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const TEMPLATE_TITLES = [
  'Weekly founder brief',
  'Revenue watch',
  'Competitor monitor',
];

// --- 1. Same-name missions fold into one claim ------------------------------

const seedFirst = [
  { key: 'auto_competitor_monitor', title: 'Competitor monitor' },
  { key: 'auto_1785390121831', title: 'Competitor monitor' },
];
let result = partitionCollectionMissions(TEMPLATE_TITLES, seedFirst);
assert(
  result.customMissions.length === 0,
  'both same-named missions must fold into the claimed template card — none render as custom',
);
assert(
  result.liveByTitle.get('competitor monitor')?.key === 'auto_1785390121831',
  'the newest same-named mission (last in API order) must front the card',
);

// --- 2. Non-template missions stay custom -----------------------------------

result = partitionCollectionMissions(TEMPLATE_TITLES, [
  ...seedFirst,
  { key: 'auto_platform_learning_brief', title: 'Platform learning brief' },
]);
assert(
  result.customMissions.length === 1 &&
    result.customMissions[0].key === 'auto_platform_learning_brief',
  'a mission matching no template must still render as a custom card',
);

// --- 3. The legacy alias keeps claiming across the rename --------------------

assert(
  normalizeMissionTitle('Weekly founder update') === 'weekly founder brief',
  'the legacy founder-update title must normalize onto the founder-brief card',
);
result = partitionCollectionMissions(TEMPLATE_TITLES, [
  { key: 'auto_weekly_founder_update', title: 'Weekly founder update' },
]);
assert(
  result.customMissions.length === 0 &&
    result.liveByTitle.get('weekly founder brief')?.key === 'auto_weekly_founder_update',
  'an aliased live mission must claim its template card, not render as custom',
);

// --- 4. The gallery actually delegates to the helper -------------------------

const gallerySource = readFileSync(
  new URL('../src/features/templates/WorkflowTemplateGallery.tsx', import.meta.url),
  'utf8',
);
assert(
  gallerySource.includes("from './galleryCollection'"),
  'WorkflowTemplateGallery must import the collapse helper',
);
assert(
  gallerySource.includes('partitionCollectionMissions('),
  'WorkflowTemplateGallery must call partitionCollectionMissions for its card partition',
);
assert(
  !gallerySource.includes('claimedKeys'),
  'the per-key claim (the duplicate-card bug) must not survive in the component',
);

console.log('mission-collection collapse contract: all assertions passed');
