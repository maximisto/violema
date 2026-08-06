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

console.log('businessContextSettings.contract: all assertions passed');
