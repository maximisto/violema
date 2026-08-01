import { existsSync, readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const contentUrl = new URL('../src/content/demoIntegrations.ts', import.meta.url);
const pageUrl = new URL('../src/pages/IntegrationsPage.tsx', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);

assert(existsSync(contentUrl), 'demo integrations source of truth exists');

const content = readFileSync(contentUrl, 'utf8');
const page = readFileSync(pageUrl, 'utf8');
const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
const activeSection = content
  .split('export const DEMO_INTEGRATIONS')[1]
  ?.split('export const IDENTITY_INTEGRATIONS')[0] || '';
const identitySection = content
  .split('export const IDENTITY_INTEGRATIONS')[1]
  ?.split('export const DEFERRED_INTEGRATIONS')[0] || '';

const activeNames = [
  'Stripe',
  'Gmail',
  'Google Calendar',
  'Google Drive',
  'Linear',
  'GitHub',
  'Web search',
  'Slack',
  'Email',
];

for (const name of activeNames) {
  assert(
    content.includes(`name: '${name}'`),
    `active matrix lists ${name}`,
  );
}

assert(
  (activeSection.match(/status: 'active'/g) || []).length === 9,
  'active matrix contains exactly nine production integrations',
);
assert(
  (activeSection.match(/category: 'Workflow data'/g) || []).length === 7,
  'active matrix contains seven workflow-data integrations',
);
assert(
  (activeSection.match(/category: 'Delivery'/g) || []).length === 2,
  'active matrix contains two delivery integrations',
);
assert(
  identitySection.includes("name: 'Google sign-in'") &&
    identitySection.includes("name: 'Microsoft sign-in'") &&
    (identitySection.match(/category: 'Identity'/g) || []).length === 2,
  'identity providers are listed separately from the nine demo integrations',
);

const deferredSection = content.split('export const DEFERRED_INTEGRATIONS')[1] || '';
for (const name of ['Notion', 'HubSpot', 'Airtable', 'Figma', 'Vercel', 'Microsoft Teams']) {
  assert(
    deferredSection.includes(`name: '${name}'`),
    `deferred matrix lists ${name}`,
  );
}
assert(
  !deferredSection.includes("status: 'active'"),
  'no deferred integration is marked Active',
);

assert(
  page.includes("import { DEMO_INTEGRATIONS, IDENTITY_INTEGRATIONS, DEFERRED_INTEGRATIONS }"),
  'public page imports the verified integration source of truth',
);
assert(
  page.includes('DEMO_INTEGRATIONS.map'),
  'public page renders every verified integration',
);
assert(
  page.includes('>Active<'),
  'public page renders an Active badge',
);
assert(
  !page.includes('NATIVE_NOW') && !page.includes('NEXT_UP'),
  'legacy availability lists are removed',
);
assert(
  !page.toLowerCase().includes('sample-data') &&
    !page.toLowerCase().includes('sample data'),
  'public integration page does not advertise simulated workflows',
);
assert(
  packageJson.scripts?.['test:integrations'] === 'node tests/demoIntegrations.contract.mjs',
  'frontend exposes the integrations claims contract',
);

// --- Connect surface: every "not connected" moment must be actionable, and no
// --- surface may claim a connection it has not verified against live state.

const toolkitsUrl = new URL('../src/features/integrations/partnerToolkits.ts', import.meta.url);
assert(existsSync(toolkitsUrl), 'partner toolkit slug normalisation has a single source of truth');
const toolkits = readFileSync(toolkitsUrl, 'utf8');

assert(
  toolkits.includes(".replace(/[^a-z0-9]/g, '')"),
  'toolkit slugs are folded the same way the backend folds them',
);

assert(
  page.includes('isPartnerAppConnected(app, state.connectedApps)'),
  'partner cards derive "Connected" from live catalog state, never from a static list',
);
assert(
  !/connectedApp\.toLowerCase\(\) === app\.name\.toLowerCase\(\)/.test(page),
  'partner connection matching no longer relies on raw case-only equality',
);

assert(
  !page.includes('Connection setup lives inside approved workspaces'),
  'signed-out visitors are no longer told connections live somewhere they cannot reach',
);
assert(
  page.includes('Sign in to connect your tools') && page.includes('/login?next='),
  'the anonymous connect state offers a sign-in route back to this page',
);
assert(
  page.includes('Connections are not enabled on this server'),
  'a server without partner connections says so honestly',
);
assert(
  page.includes('Connection status is temporarily unavailable') && page.includes('Retry'),
  'unreadable connection status is reported as unknown and retryable, not as disconnected',
);

assert(
  page.includes("params.get('provider')")
    && page.includes("params.get('connected')")
    && page.includes("params.getAll('status')"),
  'the connect surface honours provider deep links and reads every status the OAuth return leg carries',
);
assert(
  !/params\.get\('status'\)/.test(page),
  'a single-value status read cannot let a pre-seeded success mask a refused grant',
);
assert(
  /returnFailed\s*=\s*statusValues\.includes\('failed'\)/.test(page)
    && /returnSucceeded\s*=\s*!returnFailed\s*&&\s*statusValues\.includes\('success'\)/.test(page),
  'any failed status wins over a success that arrived alongside it',
);
assert(
  page.includes('Connection didn’t complete — try again')
    && page.includes('isFailedReturn'),
  'a failed OAuth return is reported per card instead of rendering as success',
);
assert(
  /isFinishing\s*=\s*!statusUnknown\s*&&\s*!connected\s*&&\s*isReturnTarget/.test(page),
  'the "Finishing connection…" retry loop is reserved for returns that actually succeeded',
);
assert(
  page.includes('window.history.replaceState'),
  'the OAuth return leg is cleared from the URL so a refresh cannot replay it',
);
assert(
  /if \(statusValues\.length > 0\) \{[\s\S]{0,400}?window\.history\.replaceState/.test(page),
  'a failed return leg is cleaned out of the URL just like a successful one',
);

// --- Degraded connection state: unknown is not "disconnected", and nothing
// --- mutable stays clickable while the server cannot see the truth.

assert(
  page.includes("const statusUnknown = state.degraded")
    && page.includes('Status unavailable'),
  'a degraded catalog renders neutral per-card status instead of "not connected"',
);
assert(
  /connected\s*=\s*!statusUnknown\s*&&\s*isPartnerAppConnected/.test(page),
  'no card claims a connection derived from a catalog that could not be read',
);
assert(
  page.includes("const mutationsBlocked = state.kind === 'ready' && state.degraded")
    && (page.match(/if \(mutationsBlocked\) return;/g) || []).length === 2,
  'connect and disconnect both refuse to run while connection state is degraded',
);

const readinessPanel = readFileSync(
  new URL('../src/features/integrations/WorkflowReadinessPanel.tsx', import.meta.url),
  'utf8',
);
assert(
  readinessPanel.includes('Connection status is temporarily unavailable — these blockers may be stale.')
    && readinessPanel.includes('degraded?: boolean'),
  'workflow readiness distinguishes an unreadable provider from a missing connection',
);

const dashboard = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');
assert(
  dashboard.includes('setWorkflowReadinessDegraded(payload?.degraded === true)')
    && dashboard.includes('degraded={workflowReadinessDegraded}'),
  'the dashboard forwards the readiness degraded flag instead of dropping it',
);
assert(
  dashboard.includes('const READINESS_DEBOUNCE_MS = 600')
    && dashboard.includes('window.setTimeout(run, READINESS_DEBOUNCE_MS)'),
  'the readiness read is debounced so typing does not fire one request per keystroke',
);
assert(
  page.includes('/api/integrations/composio/disconnect'),
  'connected apps can be disconnected from the same surface that connects them',
);
assert(
  !/window\.confirm\(/.test(page) && !/(?<![.\w])confirm\(/.test(page),
  'destructive confirmation is inline, not a blocking browser dialog',
);

// Static template chips must not read as verified connections.
const staticStackFiles = [
  new URL('../src/features/missions/MissionDetailView.tsx', import.meta.url),
  new URL('../src/features/missions/MissionCalendar.tsx', import.meta.url),
].map((url) => readFileSync(url, 'utf8')).join('\n');

assert(
  !staticStackFiles.includes('Connected stack'),
  'mission surfaces do not label static integration lists as connected',
);

console.log('demoIntegrations.contract: nine active integrations, deferred claims, and connect-surface honesty verified');
