// Guided-start checklist contract.
//
// Why this gate exists: a new tester should reach a first delivered mission
// without a hand-hold, and the only honest way to do that is a checklist whose
// every row reflects real workspace state. The failure mode a checklist invites
// is exactly the one this pins shut -- a step that renders "done" because the
// panel felt like it, or "not connected" because an endpoint hiccuped.
//
// Three things are pinned:
//   1. Every done-state is DERIVED from the same data the rest of the workspace
//      reads (behavioural -- run against the real selector).
//   2. Unreadable connection state is neutral, never "not connected", and a
//      dead mission feed hides the panel instead of guessing at it.
//   3. Dashboard.tsx actually mounts the panel on the home surface and persists
//      dismissal under a workspace-scoped violema_* key (composition -- a
//      correct selector wired to nothing is the same bug).

import { readFileSync } from 'node:fs';
import {
  buildGuidedStartState,
  getGuidedStartDismissalKey,
  resolveGuidedStartVisibility,
  GUIDED_START_STEP_IDS,
} from '../src/features/onboarding/guidedStart.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

/** A live automation row shaped the way Dashboard builds them. */
const mission = (overrides = {}) => ({
  id: 'auto_1',
  automationId: 'auto_1',
  title: 'Weekly founder update',
  source: 'live',
  ...overrides,
});

const READY_NONE = { kind: 'ready', connectedCount: 0 };
const READY_ONE = { kind: 'ready', connectedCount: 1 };

const build = (overrides = {}) =>
  buildGuidedStartState({
    missionsLoaded: true,
    missions: [],
    connections: READY_NONE,
    ...overrides,
  });

const stepById = (state, id) => state.steps.find((step) => step.id === id);

// --- 0. Shape ---------------------------------------------------------------

assert(
  GUIDED_START_STEP_IDS.join(',') === 'connect,choose,run,review,deliver',
  `the checklist is the five approved steps in order (got ${GUIDED_START_STEP_IDS.join(',')})`,
);

const empty = build();
assert(empty !== null, 'a loaded, empty workspace still gets a checklist');
assert(empty.steps.length === 5, `the panel renders five rows (got ${empty.steps.length})`);
assert(
  empty.steps.every((step) => step.state === 'done' || step.state === 'current' || step.state === 'todo'),
  'no step is ever locked -- every row stays reachable',
);
assert(
  empty.steps.every((step) => step.action && typeof step.action.label === 'string' && step.action.label),
  'every step carries an action, so every row is clickable',
);
assert(
  empty.steps.filter((step) => step.state === 'current').length === 1,
  'exactly one step is current at a time',
);
assert(stepById(empty, 'connect').state === 'current', 'a fresh workspace starts on "connect your tools"');
assert(empty.doneCount === 0 && empty.complete === false, 'a fresh workspace has nothing done');

// --- 1. Connect your tools --------------------------------------------------

assert(
  stepById(build({ connections: READY_NONE }), 'connect').state !== 'done',
  'zero connected apps is not a completed connect step',
);
assert(
  stepById(build({ connections: READY_ONE }), 'connect').state === 'done',
  'one connected app completes the connect step',
);
assert(
  stepById(build({ connections: { kind: 'ready', connectedCount: 3 } }), 'connect').state === 'done',
  'several connected apps complete the connect step',
);

// Degraded means the catalog could not read connection state. Saying "not
// connected" there would be a lie about the operator's own workspace.
const degraded = stepById(build({ connections: { kind: 'degraded' } }), 'connect');
assert(degraded.statusUnknown === true, 'a degraded catalog marks connect status as unknown');
assert(degraded.state !== 'done', 'unknown connection status never counts as done');
assert(
  !/not connected/i.test(`${degraded.description} ${degraded.action.label}`),
  'a degraded catalog never claims the workspace is "not connected"',
);

const unreachable = stepById(build({ connections: { kind: 'unknown' } }), 'connect');
assert(unreachable.statusUnknown === true, 'an unreachable catalog marks connect status as unknown');
assert(unreachable.state !== 'done', 'an unreachable catalog never counts as done');

assert(
  stepById(build({ connections: READY_ONE }), 'connect').statusUnknown === false,
  'a readable catalog is never marked unknown',
);

// --- 2. Choose your first mission -------------------------------------------

assert(stepById(build(), 'choose').state !== 'done', 'no automations means no mission chosen');
assert(
  stepById(build({ missions: [mission()] }), 'choose').state === 'done',
  'one automation completes the choose step',
);

// Sample/preview rows are demo furniture. Counting them would mark a step done
// for a workspace that owns nothing.
assert(
  stepById(build({ missions: [mission({ source: 'sample' })] }), 'choose').state !== 'done',
  'a preview/sample mission never completes the choose step',
);

// --- 3. Run it --------------------------------------------------------------

assert(
  stepById(build({ missions: [mission()] }), 'run').state !== 'done',
  'a mission that has never run does not complete the run step',
);
assert(
  stepById(build({ missions: [mission({ taskRunId: 'run_1' })] }), 'run').state === 'done',
  'a recorded run id completes the run step',
);
assert(
  stepById(build({ missions: [mission({ lastRunAt: '2026-08-01T09:00:00.000Z' })] }), 'run').state === 'done',
  'a last-run timestamp completes the run step',
);
assert(
  stepById(build({ missions: [mission({ runStatus: 'running' })] }), 'run').state === 'done',
  'a live run status completes the run step',
);

// Readiness is reported honestly: a blocked mission says why, verbatim.
const blocked = stepById(
  build({
    missions: [
      mission({
        preflight: { ready: false, summary: 'Connect Stripe before this mission can run.' },
      }),
    ],
  }),
  'run',
);
assert(
  blocked.blockerSummary === 'Connect Stripe before this mission can run.',
  'a blocked mission surfaces its preflight summary verbatim',
);
assert(
  blocked.action.kind === 'collection',
  'a blocked run points at the mission rather than firing a run that cannot succeed',
);
assert(
  stepById(build({ missions: [mission()] }), 'run').action.kind === 'run',
  'a runnable mission gets a real Run action',
);
assert(
  stepById(build({ missions: [mission({ preflight: { ready: true, summary: 'Ready to run.' } })] }), 'run')
    .blockerSummary === undefined,
  'a ready mission reports no blocker',
);
assert(
  stepById(build(), 'run').action.kind === 'collection',
  'with no mission to run, the run step sends the operator to the collection',
);

// --- 4. Review the draft ----------------------------------------------------

assert(
  stepById(build({ missions: [mission({ runStatus: 'running' })] }), 'review').state !== 'done',
  'a run still in flight has not reached review',
);
assert(
  stepById(build({ missions: [mission({ runStatus: 'waiting_review' })] }), 'review').state === 'done',
  'a run holding at waiting_review completes the review step',
);
assert(
  stepById(build({ missions: [mission({ runStatus: 'succeeded' })] }), 'review').state === 'done',
  'a run that went past review still completes the review step',
);
assert(
  stepById(build({ missions: [mission({ runStatus: 'failed' })] }), 'review').state !== 'done',
  'a failed run never counts as reviewed',
);

// --- 5. First delivery ------------------------------------------------------

assert(
  stepById(build({ missions: [mission({ runStatus: 'waiting_review' })] }), 'deliver').state !== 'done',
  'a held delivery is not a delivery',
);
assert(
  stepById(
    build({ missions: [mission({ latestDelivery: { status: 'delivered', to: '#ops' } })] }),
    'deliver',
  ).state === 'done',
  'a delivered receipt completes the delivery step',
);
assert(
  stepById(
    build({ missions: [mission({ reviewReceipt: { status: 'delivered' } })] }),
    'deliver',
  ).state === 'done',
  'a delivered review receipt completes the delivery step',
);
assert(
  stepById(build({ missions: [mission({ runStatus: 'succeeded' })] }), 'deliver').state !== 'done',
  'a succeeded run with no delivery receipt is not a first delivery',
);

// --- 6. Nothing is hardcoded: each step moves only with its own evidence -----

const partial = build({
  connections: READY_ONE,
  missions: [mission({ taskRunId: 'run_1', runStatus: 'waiting_review' })],
});
assert(
  ['connect', 'choose', 'run', 'review'].every((id) => stepById(partial, id).state === 'done'),
  'the first four steps complete off real connection, mission, run, and review evidence',
);
assert(stepById(partial, 'deliver').state === 'current', 'the undelivered step becomes current');
assert(partial.doneCount === 4 && partial.complete === false, 'four of five done is not complete');

const finished = build({
  connections: READY_ONE,
  missions: [mission({ taskRunId: 'run_1', latestDelivery: { status: 'delivered', to: '#ops' } })],
});
assert(finished.complete === true, 'a connected, chosen, run, reviewed, delivered workspace is complete');
assert(finished.doneCount === 5, 'a complete loop reports five done');

// A later step that is genuinely done stays done even while an earlier one is
// current -- the panel reports state, it does not enforce an order.
const skipped = build({ missions: [mission({ latestDelivery: { status: 'delivered', to: '#ops' } })] });
assert(stepById(skipped, 'connect').state === 'current', 'the first unmet step is current');
assert(stepById(skipped, 'deliver').state === 'done', 'a met later step is not downgraded to todo');

// --- 7. Feature detection: no data means no panel ----------------------------

assert(build({ missionsLoaded: false }) === null, 'the panel renders nothing before mission data resolves');
assert(build({ missions: null }) === null, 'a failed mission feed renders nothing rather than a wrong state');
assert(build({ missions: undefined }) === null, 'a missing mission feed renders nothing');

// --- 8. Visibility, dismissal, and the historically-complete workspace -------

assert(
  resolveGuidedStartVisibility({ state: null, dismissed: false, everIncomplete: true }) === 'hidden',
  'no derivable state renders nothing',
);
assert(
  resolveGuidedStartVisibility({ state: empty, dismissed: false, everIncomplete: false }) === 'checklist',
  'an incomplete loop shows the checklist',
);
assert(
  resolveGuidedStartVisibility({ state: empty, dismissed: true, everIncomplete: true }) === 'hidden',
  'dismissal wins over an incomplete loop',
);
// A workspace that already operated never gets onboarded at it.
assert(
  resolveGuidedStartVisibility({ state: finished, dismissed: false, everIncomplete: false }) === 'hidden',
  'a workspace that was already complete on arrival never sees the panel',
);
assert(
  resolveGuidedStartVisibility({ state: finished, dismissed: false, everIncomplete: true }) === 'operating',
  'finishing the loop in session collapses the panel to the operating line',
);
assert(
  resolveGuidedStartVisibility({ state: finished, dismissed: true, everIncomplete: true }) === 'hidden',
  'a dismissed operating line never returns',
);

// --- 9. Dismissal persistence key -------------------------------------------

assert(
  getGuidedStartDismissalKey('purpleorangehq') === 'violema_guided_start_dismissed_purpleorangehq',
  `the dismissal key is workspace-scoped under the violema_ namespace (got ${getGuidedStartDismissalKey('purpleorangehq')})`,
);
assert(
  getGuidedStartDismissalKey('a') !== getGuidedStartDismissalKey('b'),
  'two workspaces cannot share one dismissal',
);

// --- 10. Composition: the panel is mounted, fed, and persisted ---------------

const panel = read('../src/features/onboarding/GuidedStartPanel.tsx');
const guidedStart = read('../src/features/onboarding/guidedStart.ts');
const dashboard = read('../src/pages/Dashboard.tsx');

// The done-states must be read off shared selectors, not re-derived here.
assert(
  guidedStart.includes("from '../missions/missionStatus.ts'"),
  'guided start reads mission status through the shared normalizer',
);
assert(
  guidedStart.includes("from '../missions/reviewQueue.ts'") && guidedStart.includes('buildMissionReviewQueue'),
  'the review step reuses the Reviews-tab queue selector instead of its own rule',
);

assert(dashboard.includes('<GuidedStartPanel'), 'Dashboard mounts the guided-start panel');
assert(
  dashboard.includes('buildGuidedStartState(') && dashboard.includes('resolveGuidedStartVisibility('),
  'Dashboard derives panel state and visibility from the shared module',
);
assert(
  dashboard.includes('getGuidedStartDismissalKey('),
  'Dashboard persists dismissal under the shared workspace-scoped key',
);
assert(
  /guidedStartVisibility === 'hidden'|guidedStartVisibility !== 'hidden'/.test(dashboard),
  'Dashboard honours the hidden visibility instead of always rendering',
);

// The panel belongs on the home surface an operator lands on, above the fold
// and outside the chat column so it can never block the composer.
assert(
  dashboard.includes("workspaceArea === 'home' && guidedStartPanel"),
  'the panel is scoped to the home surface',
);
// Ordering is checked only after both slots are proven present -- a missing
// slot yields indexOf === -1, which would otherwise satisfy "comes first".
const panelSlotIndex = dashboard.indexOf('{guidedStartPanel}');
const chatSlotIndex = dashboard.indexOf('{renderChatSurface()}');
assert(panelSlotIndex > -1, 'the guided-start element is actually rendered into the shell');
assert(chatSlotIndex > -1, 'the chat surface is still rendered into the shell');
assert(
  panelSlotIndex < chatSlotIndex,
  'the panel sits above the chat surface, not inside it',
);

// Live connection state is read from the same catalog contract the connect page
// uses, degraded flag included.
assert(
  dashboard.includes("'/api/integrations/catalog'"),
  'Dashboard reads the integrations catalog for live connection state',
);
// Scoped to the resolver so every failure path is checked individually --
// asserting the file merely *mentions* 'unknown' would pass while one branch
// quietly reported a readable zero.
const connectionsResolver =
  dashboard.split('const resolveConnections = async ()')[1]?.split('void resolveConnections()')[0] || '';
assert(connectionsResolver.length > 0, 'Dashboard resolves guided-start connection state in one place');
assert(
  connectionsResolver.includes("if (data.partner?.degraded === true) return { kind: 'degraded' };"),
  'a degraded catalog is carried through as its own state',
);
assert(
  connectionsResolver.includes("if (!response.ok) return { kind: 'unknown' };"),
  'a non-OK catalog response resolves to unknown, not to zero connections',
);
assert(
  connectionsResolver.includes("if (!Array.isArray(connectedApps)) return { kind: 'unknown' };"),
  'a catalog missing connectedApps resolves to unknown, not to zero connections',
);
assert(
  /catch\s*\{\s*return \{ kind: 'unknown' \};/.test(connectionsResolver),
  'a thrown or unparseable catalog response resolves to unknown',
);
assert(
  connectionsResolver.includes('connectedCount: connectedApps.length'),
  'a readable catalog reports its real connection count',
);
assert(
  !/connectedCount: 0\b/.test(connectionsResolver),
  'no failure path ever fabricates a zero-connection reading',
);

// Every step's action affordance renders only where it can be acted on, and the
// panel never invents progress theatre.
assert(
  panel.includes("step.state === 'current'"),
  'the action affordance is carried by the current step',
);
assert(!/\bprogress\b/i.test(panel), 'no progress-bar theatre in the panel');
assert(!/\d+\s*%|toFixed|Math\.round\(/.test(panel), 'no completion percentage in the panel');
assert(
  panel.includes('You’re operating.'),
  'the completed loop collapses to the operating line',
);
assert(
  panel.includes('Status unavailable'),
  'the panel has a neutral label for unreadable connection status',
);
assert(
  panel.includes('step.blockerSummary'),
  'the panel surfaces a blocked mission’s reason instead of a generic "not ready"',
);

console.log(
  'guidedStart.contract: five steps derive from live workspace state, unreadable status stays neutral, and a completed loop retires the panel',
);
