// Admin surface contract.
//
// The backend's admin read model was rebuilt (adminDashboard.ts /
// adminProjection.ts / adminOperations.ts). Fields the dashboard used to render
// no longer exist, and several of the new ones are dangerous to render bare:
//
//   - `recentUsers` was alphabetical and labelled "recent". Gone, replaced by
//     `recentlyUpdatedUsers`, which is sorted by a real recency signal.
//   - `recentFailedRuns[].error` carried tenant artifact titles and provider
//     payloads across the privacy boundary. Gone, replaced by a constant
//     `failureSummary` plus a `failureKind` classification.
//   - `accountStage.stage` alone is ambiguous: `lapsed` means EITHER
//     "subscription canceled" OR "beta access revoked". Only `reason` says which.
//
// Mostly composition assertions on source text, in the same shape as the
// brand-bleed and workspace-surface gates, because what regresses here is
// wiring. The pure helpers are imported and exercised for real.

import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  accountStageClasses,
  buildAdminUsersQuery,
  describeApprovalReadiness,
  failureKindLabel,
  formatWindowLabel,
  statusClasses,
} from '../src/features/admin/adminFormat.ts';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const admin = read('../src/pages/AdminDashboard.tsx');
const adminTypes = read('../src/features/admin/adminTypes.ts');
const operations = read('../src/features/admin/AdminOperationsPanel.tsx');
const auth = read('../src/lib/auth.ts');
const dashboard = read('../src/pages/Dashboard.tsx');

/** Source between two markers, so an assertion is scoped to one function. */
function slice(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  check(start >= 0, `${label}: start marker "${startMarker}" is present`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  check(end > start, `${label}: end marker "${endMarker}" follows the start`);
  return source.slice(start, end);
}

const count = (source, pattern) => (source.match(pattern) || []).length;

// ── 1. Removed fields are gone, renamed fields are read ──────────────────────

check(
  !admin.includes('recentUsers'),
  'the admin dashboard no longer reads the removed `recentUsers` field',
);
check(
  admin.includes('recentlyUpdatedUsers'),
  'the admin dashboard reads `recentlyUpdatedUsers`',
);
check(
  admin.includes('Sorted by when the account record last changed'),
  'the recency panel says what its ordering actually is, rather than implying sign-up order',
);

const failedRunRow = slice(admin, 'function FailedRunRow(', 'function OverviewPanel(', 'FailedRunRow');
check(
  failedRunRow.includes('run.failureSummary'),
  'the failures panel renders `failureSummary`',
);
check(
  !failedRunRow.includes('run.error'),
  'the failures panel never reads `run.error` -- the field is gone and carried tenant content',
);
check(
  !admin.includes('run.error'),
  'no admin surface reads `run.error` anywhere',
);
check(
  failedRunRow.includes('failureKindLabel(run.failureKind)')
    && failedRunRow.includes('failureKindClasses(run.failureKind)'),
  'each failure carries a tone-coded `failureKind` label',
);

// The workspaces response is an object now, not a bare `{items}`.
check(
  admin.includes('AdminWorkspacesResponse')
    && admin.includes('workspacesPayload.excludedInternalWorkspaces'),
  'the workspaces response is read as {items, includeInternal, excludedInternalWorkspaces}',
);
check(
  adminTypes.includes("automationScope: 'workspace'"),
  'automationScope is typed as the per-workspace literal the backend now returns',
);
check(
  adminTypes.includes("| 'readiness_blocked'"),
  'the workspace row state union includes the new readiness_blocked state',
);

// ── 2. Honest numbers carry their qualifier ─────────────────────────────────

const overviewPanel = slice(admin, 'function OverviewPanel(', 'function ConfirmStrip(', 'OverviewPanel');

check(
  overviewPanel.includes('formatWindowLabel(overview?.windowHours)'),
  'the overview derives its window label from the response, not a hardcoded period',
);
check(
  overviewPanel.includes('Snapshot taken {formatDate(overview?.generatedAt)}'),
  'the overview says how fresh its numbers are',
);
check(
  overviewPanel.includes('overview?.scope?.includeInternal')
    && overviewPanel.includes('internal Violema workspace(s)'),
  'the overview states whether internal workspaces are counted',
);
check(
  overviewPanel.includes('Failed runs in the ${windowLabel}'),
  'the "Recent failures" panel states the window it is showing',
);
check(
  overviewPanel.includes('metrics?.blockedRuns') && overviewPanel.includes('metrics?.failedRuns'),
  'blocked runs are shown distinctly from failed runs',
);
check(
  /blockedRuns[\s\S]{0,400}not connected yet/i.test(overviewPanel),
  'the blocked-runs metric explains that blocked means not connected, not broken',
);
check(
  overviewPanel.includes('metrics?.averageActualRunCredits'),
  'the credits-per-run metric reads the actuals-only average',
);
check(
  /averageActualRunCredits[\s\S]{0,400}Actuals only/.test(overviewPanel),
  'the credits-per-run metric is labelled as actuals',
);
check(
  /estimatedOnlyRuns > 0[\s\S]{0,200}estimate but no actual/.test(overviewPanel),
  'when runs are estimate-only, the overview says how many',
);
check(
  overviewPanel.includes('metrics?.succeededRuns')
    && overviewPanel.includes('Blocked runs are excluded from both'),
  'the success rate states that blocked runs sit outside its numerator and denominator',
);

// Per-workspace automation counts, with unattributed legacy records called out.
const automationCell = slice(admin, 'function AutomationCountCell(', 'function ClientsPanel(', 'AutomationCountCell');
check(
  automationCell.includes('workspace.unattributedAutomationCount > 0')
    && automationCell.includes('unattributed'),
  'a workspace with unattributed automations shows them separately as "+N unattributed"',
);
check(
  automationCell.includes('title="Legacy automations stored with no workspaceId'),
  'the unattributed badge explains itself on hover',
);
check(
  automationCell.includes('this workspace only'),
  'the automation count says it is scoped to this workspace',
);

// ── 3. A stage is never rendered without its reason ─────────────────────────

check(
  adminTypes.includes('reason: string;'),
  'AccountStageResolution requires a reason, so a stage cannot be typed without one',
);

const stageBadge = slice(admin, 'function StageBadge(', 'function StageCell(', 'StageBadge');
check(
  stageBadge.includes('stage: AccountStageResolution'),
  'StageBadge takes the whole resolution, not a bare stage string',
);
check(
  stageBadge.includes('title={stage.reason}'),
  'StageBadge always exposes the reason as a tooltip',
);
check(
  stageBadge.includes('${stage.reason}') && stageBadge.includes('aria-label'),
  'the reason is reachable to assistive tech, not only on hover',
);

const stageCell = slice(admin, 'function StageCell(', 'function effectiveAccessStatus(', 'StageCell');
check(
  stageCell.includes('<StageBadge stage={stage} />') && stageCell.includes('{stage.reason}'),
  'StageCell renders the reason inline beside the badge',
);

// Nothing may pull the enum out and render it on its own.
check(
  count(admin, /accountStage\.stage/g) === 0,
  'no admin surface renders `accountStage.stage` detached from its reason',
);
check(
  count(admin, /<StageBadge /g) >= 2 && count(admin, /<StageCell /g) === 2,
  'stage rendering goes through the reason-carrying components on desktop and mobile',
);

// ── 4. Applicant clarity ───────────────────────────────────────────────────

check(
  admin.includes('describeApprovalReadiness(user)'),
  'the user row explains its own approval state',
);
check(
  count(admin, /<TermsEvidence user=/g) === 2,
  'the readiness explanation renders on both the desktop and mobile user surfaces',
);
assert.equal(
  describeApprovalReadiness({
    approvalReady: true,
    identityVerified: true,
    termsCurrent: true,
    accessStatus: 'requested',
    approvedAccess: false,
    hasAccessRecord: true,
  }).message,
  'Ready to approve — identity and terms verified.',
);
assert.equal(
  describeApprovalReadiness({
    approvalReady: false,
    identityVerified: false,
    termsCurrent: true,
    accessStatus: 'requested',
    approvedAccess: false,
    hasAccessRecord: true,
  }).message,
  'Waiting on applicant sign-in — identity not verified yet.',
);
assert.equal(
  describeApprovalReadiness({
    approvalReady: false,
    identityVerified: true,
    termsCurrent: false,
    accessStatus: 'requested',
    approvedAccess: false,
    hasAccessRecord: true,
  }).message,
  'Waiting on current beta terms acceptance.',
);
assert.equal(
  describeApprovalReadiness({
    approvalReady: false,
    identityVerified: false,
    termsCurrent: false,
    accessStatus: 'requested',
    approvedAccess: false,
    hasAccessRecord: false,
  }).message,
  'Waiting on applicant sign-in — no access record yet.',
);

// ── 5. Participant options come from the catalog, never a hardcoded list ────

check(
  !admin.includes('<option value="founder_operator">'),
  'the participant select no longer hardcodes its options',
);
check(
  !admin.includes('<option value="investor">') && !admin.includes('<option value="partner">'),
  'no participant option is written as literal markup',
);

const participantControl = slice(admin, 'function ParticipantControl(', 'function TermsEvidence(', 'ParticipantControl');
check(
  participantControl.includes('options.map((participantType)')
    && participantControl.includes('<option key={participantType} value={participantType}>'),
  'the participant options are rendered from an array, not written as literal markup',
);
check(
  /const options = participantTypes/.test(participantControl),
  'that array is derived from the catalog the backend sent',
);
check(
  participantControl.includes('participantTypes.includes(user.participantType)'),
  "a stored participant type outside this build's catalog stays selectable rather than being silently rewritten",
);
check(
  count(admin, /participantTypes=\{catalog\.participantTypes\}/g) === 2,
  'both the desktop and mobile participant controls are fed from the response catalog',
);
check(
  admin.includes('if (payload.catalog?.participantTypes?.length) setCatalog(payload.catalog)'),
  'the catalog is adopted from the users response',
);

// The five backend participant types must all be known to the frontend, or a
// team_member/advisor session fails to hydrate and the user is logged out.
for (const participantType of ['founder_operator', 'investor', 'partner', 'team_member', 'advisor']) {
  check(auth.includes(`'${participantType}'`), `lib/auth knows the ${participantType} participant type`);
}
check(
  auth.includes("PARTICIPANT_TYPES.includes(value as ParticipantType)")
    && auth.includes(": 'founder_operator';"),
  'an unrecognized participant type buckets to the default instead of invalidating the session',
);

// ── 6. Server-side filters, with unfiltered counts still visible ────────────

assert.equal(buildAdminUsersQuery({ stage: [], participantType: [], activated: null }), '');
assert.equal(
  buildAdminUsersQuery({ stage: ['trial', 'paying'], participantType: ['advisor'], activated: true }),
  '?stage=trial%2Cpaying&participantType=advisor&activated=true',
);
assert.equal(
  buildAdminUsersQuery({ stage: [], participantType: [], activated: false }),
  '?activated=false',
);

const filterBar = slice(admin, 'function UserFilterBar(', 'function UsersPanel(', 'UserFilterBar');
check(
  filterBar.includes('counts.byStage?.[stage]') && filterBar.includes('counts.byParticipantType?.[participantType]'),
  'each filter chip shows its count from the unfiltered facet set',
);
check(
  filterBar.includes('formatNumber(counts.total)')
    && filterBar.includes('formatNumber(counts.activated)')
    && filterBar.includes('formatNumber(counts.notActivated)'),
  'the base totals stay on screen while a filter is applied',
);
check(
  filterBar.includes('catalog.accountStages.map') && filterBar.includes('catalog.participantTypes.map'),
  'filter chips are generated from the catalog, not a hardcoded list',
);
check(
  admin.includes('`/api/admin/users${buildAdminUsersQuery(filters)}`'),
  'filters are sent to the server as query params rather than applied client-side',
);

// ── 7. Destructive actions require a second, deliberate click ──────────────

// `window.confirm` blocks automation and cannot state a consequence in the
// product's voice. No admin action may use it.
//
// NOTE: `confirmAutomationDelete` in Dashboard.tsx still uses window.confirm.
// That predates this work and is deliberately out of scope here; it is asserted
// as the ONLY remaining occurrence so a new one cannot be added unnoticed.
check(
  !/window\.confirm\(/.test(admin),
  'no admin action uses window.confirm',
);
check(
  (dashboard.match(/window\.confirm\(/g) || []).length === 1
    && dashboard.includes('const confirmed = window.confirm(`Delete "${task.title}"?`);'),
  'the only window.confirm left in Dashboard is the pre-existing automation delete',
);

const userActions = slice(admin, 'function UserActions(', 'function ParticipantControl(', 'UserActions');
const unconfirmedStart = userActions.indexOf('return (\n    <div className="flex flex-wrap');
check(unconfirmedStart > 0, 'the un-confirmed UserActions branch is identifiable');
const unconfirmedActions = userActions.slice(unconfirmedStart);
check(
  !unconfirmedActions.includes("onAccessChange(user, 'revoked')"),
  'the Revoke button cannot call the revoke mutation on its first click',
);
check(
  !unconfirmedActions.includes('onRoleChange(user,'),
  'the role button cannot call the role mutation on its first click',
);
check(
  unconfirmedActions.includes("onRequestConfirm(user.email, 'revoke')")
    && unconfirmedActions.includes('onRequestConfirm(user.email, roleAction)'),
  'both destructive buttons open a confirmation instead of mutating',
);
check(
  userActions.includes("if (confirming === 'revoke') onAccessChange(user, 'revoked')")
    && userActions.includes("onRoleChange(user, confirming === 'promote' ? 'admin' : 'user')"),
  'the mutation is reachable only from the confirmation branch',
);

const confirmCopy = slice(admin, 'const CONFIRM_COPY', 'const CATALOG_FALLBACK', 'CONFIRM_COPY');
check(
  /revoke:[\s\S]{0,300}every active session is cleared/.test(confirmCopy),
  'the revoke confirmation states that it kills all active sessions',
);
check(
  /promote:[\s\S]{0,300}cross-workspace access/.test(confirmCopy),
  'the promote confirmation states that it grants cross-workspace access',
);
check(
  /demote:[\s\S]{0,300}Removes admin access/.test(confirmCopy),
  'the demote confirmation states what it removes',
);

// The backend 400s on self-demotion and self-revocation with an actionable
// message. A generic "could not update" would send the operator bug-hunting.
check(
  admin.includes("actionError instanceof Error ? actionError.message : 'Could not update access.'")
    && admin.includes("actionError instanceof Error ? actionError.message : 'Could not update role.'"),
  'the server error message is surfaced verbatim rather than replaced by a generic failure',
);

// The founder credit grant writes a real ledger entry.
check(
  dashboard.includes('setConfirmGrantCredits(true)'),
  'the founder credit grant opens a confirmation',
);
check(
  !/onClick=\{\(\) => \{ void grantTestCredits\(\); \}\}/.test(dashboard),
  'the grant button no longer fires the grant directly on click',
);
check(
  /confirmGrantCredits \?[\s\S]{0,1600}void grantTestCredits\(\);/.test(dashboard),
  'the grant mutation is reachable only from inside the confirmation branch',
);
check(
  dashboard.includes('Grant 5,000 credits to this workspace?')
    && dashboard.includes('Writes a real ledger entry against'),
  'the grant confirmation states the amount and that it writes a real ledger entry',
);

// ── 8. The Operations tab is lazy ──────────────────────────────────────────

const loadDashboardBody = slice(
  admin,
  'const loadDashboard = useCallback',
  'const loadOperations = useCallback',
  'loadDashboard',
);
check(
  !loadDashboardBody.includes('/api/admin/operations'),
  'the operations snapshot is NOT fetched by the mount-time fan-out',
);
check(
  loadDashboardBody.includes('/api/admin/overview')
    && loadDashboardBody.includes('/api/admin/users')
    && loadDashboardBody.includes('/api/admin/workspaces')
    && loadDashboardBody.includes('/api/admin/audit'),
  'the mount-time fan-out still loads the always-on surfaces',
);
check(
  admin.includes("if (activeTab !== 'operations') return;")
    && admin.includes('void loadOperations();'),
  'operations loads only once its tab is opened',
);
check(
  admin.includes('if (operations || operationsLoading || operationsError) return;'),
  'the lazy fetch does not refire while it is in flight, loaded, or errored',
);
check(
  admin.includes('/api/admin/operations${includeInternal'),
  'the operations request carries the current internal-workspace scope',
);

// ── 9. The Operations tab answers operator questions, and states its caveats ─

check(
  operations.includes('telemetry.notes.map((note)'),
  'the operations tab renders the telemetry notes',
);
check(
  operations.indexOf('telemetry.notes.map') < operations.indexOf('Blocked right now'),
  'the snapshot caveats appear above the numbers they qualify',
);
for (const [marker, label] of [
  ['Blocked right now', 'what is blocked'],
  ['Reviews waiting', 'what is waiting on a human'],
  ['What broke', 'what failed'],
  ['Degrading automations', 'what is quietly degrading'],
  ['Activation funnel', 'the activation funnel'],
  ['Stage funnel', 'the stage funnel'],
  ['Reliability by workflow', 'reliability'],
  ['Beta terms coverage', 'terms staleness'],
  ['Connections by workspace', 'integrations'],
]) {
  check(operations.includes(marker), `the operations tab reports ${label}`);
}
check(
  operations.indexOf('Blocked right now') < operations.indexOf('Activation funnel'),
  'what needs a human comes before the slower-moving funnel numbers',
);
check(
  operations.includes('Connect {label}') && operations.includes('row.blockerLabels'),
  'a blocked mission names the exact connection that is missing',
);
check(
  operations.includes('Oldest first'),
  'the review queue states its ordering',
);
check(
  operations.includes('row.degraded') && operations.includes('not that nothing is connected'),
  'a degraded connection lookup is reported as unknown rather than as "nothing connected"',
);
check(
  operations.includes('snapshot.recentFailures.countsByKind'),
  'failures are bucketed by kind',
);

// ── 10. Tone mapping reuses the existing status palette ────────────────────

assert.equal(accountStageClasses('trial'), statusClasses('trialing'));
assert.equal(accountStageClasses('paying'), statusClasses('active'));
assert.equal(accountStageClasses('lapsed'), statusClasses('blocked'));
assert.equal(accountStageClasses('applicant'), statusClasses('pending'));

assert.equal(formatWindowLabel(24), 'last 24h');
assert.equal(formatWindowLabel(168), 'last 7d');
assert.equal(formatWindowLabel(undefined), 'last 24h');

// "Not connected" must not read as a breakage.
assert.equal(failureKindLabel('readiness_blocked'), 'Not connected');
assert.equal(failureKindLabel('fabricated_evidence'), 'Simulated evidence');

console.log(
  'adminSurface.contract: migrated fields verified; stages carry their reason; participant options come from the catalog; destructive actions confirm; operations is lazy',
);
