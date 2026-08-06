// Business-context settings contract.
//
// Field observation, 2026-08-05 (demo night): a tenant could not point Violema
// at their own business — the market lived in seed-owned step content. The
// durable product fix is an operator-owned workspace field. Pinned here:
//   1. SettingsPage carries a "Your business" section anchored at id="business"
//      (the run gate's blocker routes to /settings#business).
//   2. The section round-trips through the business-context API.
//   3. The dashboard blocker action for business_context_missing navigates to
//      the settings anchor with honest, specific copy — not the generic
//      "Open integration setup".
//   4. That action is REACHABLE: a refused run's blockers render with their
//      fix affordance, not as a bare message string. Before this, the only
//      surfaces that could emit business_context_missing showed a plain toast.
//   5. The mission editor never offers an editable query field on a step whose
//      query the run composes from business context and discards.
//   6. No tenant-visible sample carries Violema's own market as if it were the
//      tenant's.

import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const settingsSource = readFileSync(new URL('../src/pages/SettingsPage.tsx', import.meta.url), 'utf8');
assert(settingsSource.includes('id="business"'), 'SettingsPage anchors the business section at #business.');
assert(settingsSource.includes('/api/workspace/business-context'), 'SettingsPage talks to the business-context API.');
assert(settingsSource.includes("method: 'PUT'"), 'SettingsPage saves via PUT.');
assert(settingsSource.includes('marketKeywords'), 'SettingsPage sends structured keywords.');
assert(settingsSource.includes('competitors'), 'SettingsPage sends named competitors.');

const readinessUiSource = readFileSync(new URL('../src/features/integrations/workflowReadinessUi.ts', import.meta.url), 'utf8');
assert(readinessUiSource.includes('business_context_missing'), 'Blocker mapping knows the business-context blocker.');
assert(readinessUiSource.includes('/settings#business'), 'Blocker action routes to the settings anchor.');
assert(readinessUiSource.includes('Tell Violema about your business'), 'Blocker action label is specific, not generic.');

const dashboardSource = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');

// 4. A refused run carries its blockers into the notice, and the notice renders
//    each one through the same mapping the readiness panel uses.
assert(
  dashboardSource.includes('readRunBlockers(payload?.blockers)'),
  'A refused run reads the blockers off the 409 body.',
);
assert(
  dashboardSource.includes('uiNotice.blockers') && dashboardSource.includes('getReadinessBlockerAction(blocker)'),
  'The run-refused notice renders each blocker through the shared blocker-action mapping.',
);

// 5. Business-context search steps show what will be composed, not an input
//    whose value the run throws away.
assert(
  dashboardSource.includes("step.kind === 'search' && step.inputs?.use_business_context === true"),
  'The mission editor branches search-step rendering on the business-context flag.',
);
assert(
  dashboardSource.includes('Composed from your business context at run time'),
  'The flagged search step explains where its query comes from.',
);
assert(
  dashboardSource.includes("step.kind === 'search' && step.inputs?.use_business_context !== true"),
  'The editable query override survives for steps that do not use business context.',
);

// 6. Retired market strings must not reappear in tenant-visible samples.
assert(
  !dashboardSource.includes('AI agent workflow competitors pricing product launch this week'),
  "No sample shows Violema's market as if it were the tenant's.",
);

console.log('businessContextSettings.contract: all assertions passed');
