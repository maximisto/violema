// Explicit `.ts` specifiers (allowed by `allowImportingTsExtensions` in
// tsconfig) so the Node contract test can import this module directly, the same
// convention `missions/reviewQueue.ts` follows.
import {
  isDeliveredReview,
  normalizeMissionStatus,
  type MissionStatusSource,
} from '../missions/missionStatus.ts';
import { buildMissionReviewQueue } from '../missions/reviewQueue.ts';

/**
 * Guided start: the five-step first-run checklist on the workspace home surface.
 *
 * The product problem it solves: a new tester lands in a workspace that can do
 * a great deal and shows no opinion about what to do first, so the walk from
 * zero to a first delivered mission depends on someone being available to
 * explain it.
 *
 * The design constraint it respects: a checklist is a promise that each row
 * tells the truth. So every done-state here is DERIVED from the same workspace
 * data the rest of the shell renders -- the automations feed, run records, the
 * Reviews-tab queue selector, delivery receipts -- and nothing in this module
 * can mark a step done on its own say-so. Two consequences follow:
 *
 *   - Unreadable state is its own state. A degraded or unreachable integrations
 *     catalog yields `statusUnknown`, never "not connected". Telling an operator
 *     their connected workspace is disconnected is worse than saying nothing.
 *   - No mission data means no panel. Steps 2-5 all hang off the automations
 *     feed; without it every row would be a guess, so `buildGuidedStartState`
 *     returns `null` and the surface renders nothing. (Connection state is the
 *     one signal allowed to be unknown while the panel still renders, because
 *     "unknown" is a row the panel can show honestly.)
 *
 * This module is deliberately a leaf: it imports two other leaf modules and
 * performs no IO, so persistence lives with the caller and the whole derivation
 * is directly testable in Node.
 */

export type GuidedStartStepId = 'connect' | 'choose' | 'run' | 'review' | 'deliver';

/**
 * `todo` is not `locked`. Every row stays clickable -- an operator who wants to
 * look at Reviews before their first run is allowed to, and a checklist that
 * gates navigation is a wizard tunnel wearing a checklist's clothes.
 */
export type GuidedStartStepState = 'done' | 'current' | 'todo';

/** Where a row sends the operator. The panel maps these to callbacks. */
export type GuidedStartActionKind = 'integrations' | 'collection' | 'run' | 'reviews';

export interface GuidedStartAction {
  kind: GuidedStartActionKind;
  label: string;
}

export interface GuidedStartStep {
  id: GuidedStartStepId;
  name: string;
  description: string;
  state: GuidedStartStepState;
  /** True only when live state could not be read. Never rendered as "not done". */
  statusUnknown: boolean;
  /** Verbatim preflight summary when the workspace's mission cannot run yet. */
  blockerSummary?: string;
  action: GuidedStartAction;
}

/**
 * Live connection state, with "we could not tell" kept distinct from "nothing
 * is connected". `degraded` is the catalog's own flag; `unknown` is the client
 * failing to reach or parse it.
 */
export type GuidedStartConnections =
  | { kind: 'unknown' }
  | { kind: 'degraded' }
  | { kind: 'ready'; connectedCount: number };

/** A row from the Dashboard automations feed, structurally. */
export interface GuidedStartMission extends MissionStatusSource {
  id: string | number;
  automationId?: string;
  taskRunId?: string;
  lastRunAt?: string;
  title?: string;
  /** `'live'` for API-backed rows; `'sample'` for preview furniture. */
  source?: string;
  preflight?: { ready?: boolean; summary?: string };
}

export interface GuidedStartInput {
  /** False until the automations feed has resolved one way or the other. */
  missionsLoaded: boolean;
  /** Null/undefined when the feed failed -- distinct from an empty workspace. */
  missions: readonly GuidedStartMission[] | null | undefined;
  connections: GuidedStartConnections;
}

export interface GuidedStartState {
  steps: GuidedStartStep[];
  doneCount: number;
  complete: boolean;
}

export type GuidedStartVisibility = 'hidden' | 'checklist' | 'operating';

export const GUIDED_START_STEP_IDS: GuidedStartStepId[] = [
  'connect',
  'choose',
  'run',
  'review',
  'deliver',
];

/** Dismissal is per workspace: finishing in one does not silence another. */
export function getGuidedStartDismissalKey(workspaceId: string) {
  return `violema_guided_start_dismissed_${workspaceId}`;
}

/**
 * Preview/sample rows are demo furniture that exists before a workspace owns
 * anything. Counting them would light up the checklist for an empty workspace,
 * which is the exact fake progress this panel must not invent.
 */
export function isLiveGuidedStartMission(mission: GuidedStartMission) {
  return mission.source === 'live';
}

/**
 * Evidence that this mission has actually been executed at least once. Any of
 * the three is a record the server wrote after a run: the latest run's id, the
 * automation's last-run timestamp, or a live run status.
 */
export function hasGuidedStartRun(mission: GuidedStartMission) {
  return Boolean(mission.taskRunId || mission.lastRunAt || mission.runStatus);
}

/**
 * "Reached the draft or beyond." A held approval counts, and so does a run that
 * already moved past the gate -- an operator who approved during their first
 * session should not be told they still have a draft to look at. A failed run
 * never counts: there is no draft behind it.
 */
export function hasReachedGuidedStartReview(mission: GuidedStartMission) {
  const status = normalizeMissionStatus(mission);
  return status === 'waiting_review' || status === 'completed';
}

function readBlockerSummary(missions: readonly GuidedStartMission[]) {
  for (const mission of missions) {
    if (!mission.preflight || mission.preflight.ready !== false) continue;
    const summary = typeof mission.preflight.summary === 'string' ? mission.preflight.summary.trim() : '';
    if (summary) return summary;
  }
  return undefined;
}

export function buildGuidedStartState(input: GuidedStartInput): GuidedStartState | null {
  // Steps 2-5 all derive from the automations feed. Without it the panel would
  // be guessing, so it renders nothing instead.
  if (!input.missionsLoaded) return null;
  if (!Array.isArray(input.missions)) return null;

  const missions = input.missions.filter(isLiveGuidedStartMission);

  const connectionsReadable = input.connections.kind === 'ready';
  const connectDone = input.connections.kind === 'ready' && input.connections.connectedCount > 0;
  const chooseDone = missions.length > 0;
  const runDone = missions.some(hasGuidedStartRun);
  // The Reviews tab's own selector answers "is an approval waiting?" so the two
  // surfaces can never disagree about it.
  const reviewDone =
    buildMissionReviewQueue(missions).length > 0 || missions.some(hasReachedGuidedStartReview);
  const deliverDone = missions.some((mission) => isDeliveredReview(mission));

  const blockerSummary = runDone ? undefined : readBlockerSummary(missions);
  const runnable = missions.some((mission) => Boolean(mission.automationId));
  // A run that preflight already says cannot succeed is not an action -- send
  // the operator to the mission where the blocker is fixable instead.
  const runAction: GuidedStartAction =
    runnable && !blockerSummary
      ? { kind: 'run', label: 'Run the mission' }
      : { kind: 'collection', label: 'Open the mission' };

  const done: Record<GuidedStartStepId, boolean> = {
    connect: connectDone,
    choose: chooseDone,
    run: runDone,
    review: reviewDone,
    deliver: deliverDone,
  };

  // The current step is the first unmet one. Later steps that are genuinely met
  // stay `done` -- the panel reports state, it does not impose an order.
  const currentId = GUIDED_START_STEP_IDS.find((id) => !done[id]);

  const stepState = (id: GuidedStartStepId): GuidedStartStepState => {
    if (done[id]) return 'done';
    return id === currentId ? 'current' : 'todo';
  };

  const steps: GuidedStartStep[] = [
    {
      id: 'connect',
      name: 'Connect your tools',
      description: connectionsReadable
        ? 'Link the tools your first mission reads from and delivers to.'
        : 'Live connection status could not be read just now. Nothing was changed.',
      state: stepState('connect'),
      statusUnknown: !connectionsReadable,
      action: { kind: 'integrations', label: 'Open integrations' },
    },
    {
      id: 'choose',
      name: 'Choose your first mission',
      description: 'Pick a mission from the collection and make it yours.',
      state: stepState('choose'),
      statusUnknown: false,
      action: { kind: 'collection', label: 'Browse the collection' },
    },
    {
      id: 'run',
      name: 'Run it',
      description: 'Start the first run. Violema does the work and drafts the output.',
      state: stepState('run'),
      statusUnknown: false,
      blockerSummary,
      action: runAction,
    },
    {
      id: 'review',
      name: 'Review the draft',
      description: 'Read the draft and the evidence behind it before anything ships.',
      state: stepState('review'),
      statusUnknown: false,
      action: { kind: 'reviews', label: 'Open Reviews' },
    },
    {
      id: 'deliver',
      name: 'First delivery',
      description: 'Approve once and the mission delivers to its destination.',
      state: stepState('deliver'),
      statusUnknown: false,
      action: { kind: 'reviews', label: 'Approve to deliver' },
    },
  ];

  const doneCount = steps.filter((step) => step.state === 'done').length;

  return { steps, doneCount, complete: currentId === undefined };
}

/**
 * Whether to show the checklist, the one-line completed state, or nothing.
 *
 * `everIncomplete` is what keeps an established workspace from being onboarded
 * at: a workspace whose loop was already closed when the surface mounted is
 * never told about a first delivery it made months ago. Only a loop that closed
 * while the operator was watching earns the collapsed "operating" line, and
 * dismissal retires that for good.
 */
export function resolveGuidedStartVisibility(input: {
  state: GuidedStartState | null;
  dismissed: boolean;
  everIncomplete: boolean;
}): GuidedStartVisibility {
  if (!input.state) return 'hidden';
  if (input.dismissed) return 'hidden';
  if (!input.state.complete) return 'checklist';
  return input.everIncomplete ? 'operating' : 'hidden';
}
