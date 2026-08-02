// Run-warning contract.
//
// A run can succeed at its job and still fail at something beside it -- the
// delivery went out, but the Drive archive write did not. The backend severity
// lane reports those as `runWarnings: [{stepId, title, message}]` on run/task
// metadata and on the review-gate artifact.
//
// Two properties matter, and both are easy to lose:
//
//   1. FEATURE DETECTION. This build must work against a server that does not
//      send the field at all. Absent means render nothing -- never an empty
//      amber banner, and never a crash.
//   2. POSITION. The warning is only useful BEFORE the decision. Rendered under
//      the approve button, an approver has already clicked past it.
//
// `missionPresenter.ts` cannot be imported here (it pulls in a .tsx component
// that Node's type stripping cannot parse), so its half is asserted on source.

import { readFileSync } from 'node:fs';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const reviews = read('../src/features/missions/MissionReviews.tsx');
const presenter = read('../src/features/missions/missionPresenter.ts');
const types = read('../src/features/missions/types.ts');
const dashboard = read('../src/pages/Dashboard.tsx');

// ── 1. The shape is modelled ───────────────────────────────────────────────

check(
  types.includes('export interface MissionRunWarning'),
  'MissionRunWarning is a declared type, not an inline anonymous shape',
);
for (const field of ['stepId: string;', 'title: string;', 'message: string;']) {
  check(types.includes(field), `MissionRunWarning declares ${field}`);
}
check(
  types.includes('runWarnings: MissionRunWarning[];'),
  'the mission view always carries a warnings array, so no consumer has to null-check it',
);

// ── 2. Feature detection ───────────────────────────────────────────────────

check(
  presenter.includes('runWarnings?: unknown;'),
  'the source task types runWarnings as optional and unvalidated -- the server may not send it',
);
check(
  presenter.includes('export function readMissionRunWarnings'),
  'there is one place that decides what counts as a usable warning',
);

const reader = presenter.slice(
  presenter.indexOf('export function readMissionRunWarnings'),
  presenter.indexOf('function collectRunWarnings'),
);
check(reader.length > 0, 'the reader body is identifiable');
check(
  reader.includes('if (!Array.isArray(value)) return [];'),
  'a missing or non-array runWarnings yields an empty list rather than throwing',
);
check(
  reader.includes('if (!title || !message) continue;'),
  'a warning without both a title and a message is dropped, so no empty banner can render',
);

const collector = presenter.slice(
  presenter.indexOf('function collectRunWarnings'),
  presenter.indexOf('function readRecordValue'),
);
check(collector.length > 0, 'the collector body is identifiable');
check(
  collector.includes('readMissionRunWarnings(task.runWarnings)'),
  'warnings are read from the task/run record',
);
check(
  collector.includes('readMissionRunWarnings(reviewArtifact?.payload?.runWarnings)'),
  'warnings are also read from the review-gate artifact the approver is looking at',
);
check(
  collector.includes('seen.has(key)') && collector.includes('${warning.stepId}::${warning.title}'),
  'a warning written to both places is shown once, not twice',
);
check(
  presenter.includes('runWarnings: collectRunWarnings(task),'),
  'the mission view is populated with the collected warnings',
);

// The Dashboard normalizer has to pass the raw field through, or the presenter
// never sees it.
check(
  dashboard.includes('function getTaskRunWarnings('),
  'Dashboard reads runWarnings off the platform run/task records',
);
check(
  dashboard.includes('if (Array.isArray(run?.metadata?.runWarnings)) return run.metadata.runWarnings;')
    && dashboard.includes('if (Array.isArray(task?.metadata?.runWarnings)) return task.metadata.runWarnings;'),
  'the run record wins over the task record, and both are shape-checked',
);
check(
  dashboard.includes('runWarnings: getTaskRunWarnings(task, run) || item.runWarnings,'),
  'the run snapshot carries runWarnings onto the mission item',
);

// ── 3. Nothing renders when there is nothing to say ───────────────────────

check(
  reviews.includes('const runWarnings = mission.runWarnings || [];'),
  'MissionReviews defends against a mission view built without the field',
);
check(
  reviews.includes('{runWarnings.length > 0 ? ('),
  'the warning block is gated on there being at least one warning',
);
check(
  /\{runWarnings\.length > 0 \? \([\s\S]*?\) : null\}/.test(reviews),
  'the empty case renders null, not an empty container',
);

// ── 4. Position: above the approve controls ───────────────────────────────

const warningBlockIndex = reviews.indexOf('{runWarnings.length > 0 ? (');
const approveButtonIndex = reviews.indexOf("{busyAction === 'approve' ? 'Approving...' : 'Approve delivery'}");
const requestChangesIndex = reviews.indexOf("{busyAction === 'changes' ? 'Saving...' : 'Request changes'}");

check(warningBlockIndex > 0, 'the warning block is present');
check(approveButtonIndex > 0, 'the approve control is present');
check(requestChangesIndex > 0, 'the request-changes control is present');
check(
  warningBlockIndex < approveButtonIndex,
  'run warnings render ABOVE the approve button -- an approver must see them before deciding',
);
check(
  warningBlockIndex < requestChangesIndex,
  'run warnings render above the request-changes control too',
);

// It must also be visually loud, not a grey footnote.
const warningBlock = reviews.slice(warningBlockIndex, approveButtonIndex);
check(
  warningBlock.includes('border-amber-400/30') && warningBlock.includes('bg-amber-400/10'),
  'the warning block uses the warning tone rather than a muted one',
);
check(
  warningBlock.includes('Read before approving'),
  'the warning block tells the approver what to do with it',
);
check(
  warningBlock.includes('{warning.title}') && warningBlock.includes('{warning.message}'),
  'each warning renders both its title and its message',
);
check(
  warningBlock.includes('Part of this run did not complete'),
  'the heading says what happened without implying the whole run failed',
);
check(
  warningBlock.includes('does not retry'),
  'the copy states that approving will not retry the failed steps',
);

console.log(
  'runWarnings.contract: feature-detected, validated, deduped, and rendered above the approve controls',
);
