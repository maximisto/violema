// In-dashboard integrations command center contract.
//
// Why this gate exists: the workspace Integrations tab used to render a static
// chip list ("Available integrations": Slack, Stripe, GitHub, Gmail, Google
// Calendar, Outlook) and a paragraph of copy, so the only place a connection
// could actually be made was the public /integrations page. Two failures came
// out of the same founder session: a Drive connection that read as green but
// was scoped read-only and killed a mission mid-run, and two OAuth tabs
// abandoned halfway, leaving connections stuck with nothing in the product
// acknowledging them.
//
// Three things are pinned:
//   1. Verdicts are BEHAVIOUR, run against the real resolver: connected,
//      connected-but-limited, missing, and unknown are four different answers,
//      and unreadable state resolves to unknown -- never to "not connected".
//   2. Every field the parallel backend lane is adding is FEATURE-DETECTED:
//      absent capability/pending/library data yields empty, not fabricated.
//   3. Dashboard.tsx actually mounts the live section on both integrations
//      branches, and the mutations it calls are workspace-scoped (composition --
//      a correct resolver wired to nothing is the same bug).

import { readFileSync } from 'node:fs';
import {
  readCapabilityMap,
  readLibrary,
  readPendingConnections,
} from '../src/features/integrations/catalogState.ts';
import {
  buildMissionSourceSubjects,
  collectStepSourceIds,
  getTemplateRequirements,
} from '../src/features/integrations/missionSources.ts';
import {
  resolveSourceVerdict,
  summarizeMissionReadiness,
} from '../src/features/integrations/sourceReadiness.ts';
import { WORKFLOW_TEMPLATES } from '../src/content/workflowTemplates.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const dashboard = read('../src/pages/Dashboard.tsx');
const commandCenter = read('../src/features/integrations/IntegrationsCommandCenter.tsx');
const catalogState = read('../src/features/integrations/catalogState.ts');
const actions = read('../src/features/integrations/connectionActions.ts');
const picker = read('../src/features/integrations/SlackChannelPicker.tsx');
const shell = read('../src/features/missions/workspaceShell.ts');
const packageJson = JSON.parse(read('../package.json'));

/** The catalog shape deployed servers return today: no capability, no pending. */
const TODAYS_CATALOG = {
  partner: {
    enabled: true,
    degraded: false,
    connectedApps: ['gmail', 'slackbot'],
    apps: [
      { name: 'gmail', label: 'Gmail', detail: 'Email metadata', sources: ['email'] },
      { name: 'googledrive', label: 'Google Drive', detail: 'Docs', sources: ['google_drive'] },
      { name: 'slackbot', label: 'Slack', detail: 'Delivery', sources: [] },
    ],
  },
  providers: [
    { id: 'stripe', label: 'Stripe', capabilities: ['Read revenue', 'Read customers'] },
  ],
};

const baseInput = (overrides = {}) => ({
  degraded: false,
  capability: {},
  connectedApps: [],
  apps: [],
  readiness: null,
  readinessDegraded: false,
  ...overrides,
});

// --- 1. Feature detection: absent data is absent, never invented -------------

assert(
  Object.keys(readCapabilityMap(TODAYS_CATALOG)).length === 0,
  'a catalog without capability data yields no capability verdicts',
);
assert(
  readPendingConnections(TODAYS_CATALOG).length === 0,
  'a catalog without pending data yields no pending connections',
);
assert(
  readLibrary(TODAYS_CATALOG) === null,
  'a catalog without a library block yields null, so the library section stays unrendered',
);
assert(
  Object.keys(readCapabilityMap({ providers: [{ id: 'stripe', capabilities: ['Read revenue'] }] })).length === 0,
  'the prose `providers[].capabilities` list is never mistaken for a capability report',
);
assert(
  Object.keys(readCapabilityMap({
    partner: { capability: { google_drive: { capabilities: ['read'], missing: ['write'] } } },
  })).length === 0,
  'a capability entry without an explicit boolean `connected` is discarded rather than guessed',
);

// Capability is read wherever the backend lane puts it, and is addressable by
// both the source id and the toolkit slug.
for (const [placement, payload] of [
  ['partner.capability', { partner: { capability: { google_drive: { connected: true, missing: ['write'] } } } }],
  ['partner.capabilities', { partner: { capabilities: { googledrive: { connected: true, missing: ['write'] } } } }],
  ['top-level capability', { capability: { google_drive: { connected: true, missing: ['write'] } } }],
  ['inline on the app', {
    partner: {
      apps: [{
        name: 'googledrive',
        label: 'Google Drive',
        sources: ['google_drive'],
        capability: { connected: true, missing: ['write'] },
      }],
    },
  }],
]) {
  const map = readCapabilityMap(payload);
  assert(map.googledrive?.connected === true, `capability is read from ${placement}`);
  assert(map.googledrive?.missing.join(',') === 'write', `capability missing[] survives ${placement}`);
}

// --- 2. Pending connections --------------------------------------------------

const pending = readPendingConnections({
  partner: {
    pending: [
      {
        connectionRequestId: 'req_1',
        toolkit: 'googledrive',
        label: 'Google Drive',
        createdAt: '2026-08-02T09:15:00.000Z',
      },
      { appName: 'notion' },
      { label: 'no app name here' },
    ],
  },
});
assert(pending.length === 2, 'pending entries without any app name are dropped');
assert(pending[0].id === 'req_1', 'connectionRequestId is accepted as the cancellation id');
assert(pending[0].appName === 'googledrive', '`toolkit` is accepted as the app name');
assert(pending[1].id === 'notion', 'an entry with no id falls back to its app name');
assert(
  readPendingConnections({ pending: [{ appName: 'github' }] }).length === 1,
  'a top-level `pending` array is read too',
);

// --- 3. Library --------------------------------------------------------------

const library = readLibrary({
  library: {
    provisioned: true,
    folderId: 'SYNTHETIC_FOLDER',
    entryCount: 12,
    lastEntryAt: '2026-08-01T17:04:00.000Z',
  },
});
assert(library?.provisioned === true, 'a reported library keeps its provisioned flag');
assert(
  library?.folderUrl === 'https://drive.google.com/drive/folders/SYNTHETIC_FOLDER',
  'a folder link is derived from the folder id',
);
assert(
  readLibrary({ library: { folderId: '' } })?.provisioned === false,
  'a library block without an explicit provisioned:true is treated as not provisioned',
);

// --- 4. Verdicts: four distinct answers, run as behaviour --------------------

const limited = resolveSourceVerdict('google_drive', baseInput({
  capability: { googledrive: { connected: true, capabilities: ['read'], missing: ['write'], sufficientFor: [] } },
}));
const connected = resolveSourceVerdict('email', baseInput({
  capability: { gmail: { connected: true, capabilities: ['read'], missing: [], sufficientFor: [] } },
}));
assert(limited.state === 'limited', 'a connection missing a capability is LIMITED');
assert(connected.state === 'connected', 'a connection with nothing missing is CONNECTED');
assert(
  limited.state !== connected.state,
  'connected-but-insufficient is a different state from connected -- never a bare green check',
);
assert(
  limited.missing.join(',') === 'write',
  'the limited verdict names what is missing so the UI can say it',
);
assert(
  resolveSourceVerdict('github', baseInput({
    capability: { github: { connected: false, capabilities: [], missing: [], sufficientFor: [] } },
  })).state === 'missing',
  'capability connected:false is MISSING',
);

// The unreadable case. This is the assertion the whole surface exists for.
const degradedInput = baseInput({
  degraded: true,
  connectedApps: [],
  apps: [{ name: 'gmail', label: 'Gmail', detail: '', sources: ['email'] }],
  readiness: {
    workflowId: 'weekly-founder-update',
    ready: false,
    summary: '',
    requiredIntegrationIds: ['email'],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: true,
    blockers: [{ key: 'email', label: 'Connect Gmail', detail: 'Gmail is not connected.' }],
    warnings: [],
  },
});
assert(
  resolveSourceVerdict('email', degradedInput).state === 'unknown',
  'a degraded catalog resolves to UNKNOWN even when every other signal says disconnected',
);
assert(
  resolveSourceVerdict('email', degradedInput).state !== 'missing',
  'degraded is never rendered as "not connected"',
);
assert(
  resolveSourceVerdict('anything-unheard-of', baseInput()).state === 'unknown',
  'a source with no signal at all is unknown, not missing',
);

// --- 5. Verdicts from the readiness probe ------------------------------------

const probe = (overrides = {}) => ({
  workflowId: 'weekly-founder-update',
  ready: false,
  summary: '',
  requiredIntegrationIds: ['stripe', 'email'],
  optionalIntegrationIds: ['google_drive'],
  firstRunRequiresApproval: true,
  blockers: [],
  warnings: [],
  ...overrides,
});

assert(
  resolveSourceVerdict('stripe', baseInput({
    readiness: probe({ blockers: [{ key: 'stripe', label: 'Connect Stripe', detail: 'Stripe read access is required.' }] }),
  })).state === 'missing',
  'a readiness blocker means the source is missing',
);
assert(
  resolveSourceVerdict('google_drive', baseInput({
    readiness: probe({ warnings: [{ key: 'google_drive', label: 'Reauthorize Google Drive', detail: 'Scopes are insufficient.' }] }),
  })).state === 'limited',
  'the backend "Reauthorize" warning is the connected-but-insufficient signal available today',
);
assert(
  resolveSourceVerdict('google_drive', baseInput({
    readiness: probe({ warnings: [{ key: 'google_drive', label: 'Connect Google Drive', detail: 'Not connected.' }] }),
  })).state === 'missing',
  'a "Connect" warning is still a missing connection, not a limited one',
);
assert(
  resolveSourceVerdict('stripe', baseInput({ readiness: probe() })).state === 'connected',
  'a required source with no blocker and no warning passed its readiness check',
);
assert(
  resolveSourceVerdict('google_drive', baseInput({
    capability: { googledrive: { connected: true, capabilities: [], missing: [], sufficientFor: [] } },
    readiness: probe({ warnings: [{ key: 'google_drive', label: 'Reauthorize Google Drive', detail: '' }] }),
  })).state === 'connected',
  'capability outranks the readiness probe when both speak',
);
assert(
  resolveSourceVerdict('email', baseInput({
    readiness: probe({ blockers: [{ key: 'email', label: 'Connect Gmail', detail: '' }] }),
    readinessDegraded: true,
  })).state === 'unknown',
  'a probe that itself ran degraded cannot produce a "missing" verdict',
);

// --- 6. The three-vocabulary trap --------------------------------------------

assert(
  resolveSourceVerdict('slack', baseInput({
    apps: [{ name: 'slackbot', label: 'Slack', detail: '', sources: [] }],
    connectedApps: ['slackbot'],
  })).state === 'connected',
  'the source id "slack" resolves through the "slackbot" toolkit, not against it',
);
assert(
  resolveSourceVerdict('google_drive', baseInput({
    apps: [{ name: 'googledrive', label: 'Google Drive', detail: '', sources: ['google_drive'] }],
    connectedApps: ['gmail'],
  })).state === 'missing',
  'an app absent from connectedApps is missing when the catalog is readable',
);
assert(
  resolveSourceVerdict('tavily', baseInput({ degraded: true })).state === 'builtin',
  'a source Violema operates itself is never offered a dead Connect button',
);

// --- 7. Mission readiness summary -------------------------------------------

const verdicts = {
  stripe: { state: 'connected', missing: [], detail: '' },
  google_drive: { state: 'limited', missing: ['write'], detail: '' },
  linear: { state: 'missing', missing: [], detail: '' },
  postmark: { state: 'unknown', missing: [], detail: '' },
};

assert(
  summarizeMissionReadiness([{ id: 'google_drive', optional: false }], verdicts).ready === false,
  'a LIMITED required source blocks readiness -- the case that looked green and failed mid-run',
);
assert(
  summarizeMissionReadiness([{ id: 'linear', optional: true }], verdicts).ready === true,
  'a missing OPTIONAL source does not block readiness',
);
assert(
  summarizeMissionReadiness([{ id: 'postmark', optional: true }], verdicts).unknown === 1,
  'an unreadable source is counted even when optional, so the pill can say "unavailable"',
);
assert(
  summarizeMissionReadiness([{ id: 'stripe', optional: false }], verdicts).ready === true,
  'a connected required source is ready',
);

// --- 8. Requirements are derived locally, not fetched per mission ------------

const weekly = WORKFLOW_TEMPLATES.find((template) => template.id === 'weekly-founder-brief');
const weeklyRequirements = getTemplateRequirements(weekly);
for (const id of ['stripe', 'github', 'linear', 'email', 'calendar', 'tavily', 'slack']) {
  assert(
    weeklyRequirements.some((requirement) => requirement.id === id && !requirement.optional),
    `the weekly founder brief lists ${id} as required`,
  );
}
assert(
  weeklyRequirements.some((requirement) => requirement.id === 'google_drive' && requirement.optional),
  'curated optional sources stay marked optional',
);

const competitor = WORKFLOW_TEMPLATES.find((template) => template.id === 'competitor-monitor');
assert(
  competitor.requiredIntegrationIds === undefined,
  'the fallback path is exercised by a template that really has no curated requirement list',
);
const competitorIds = getTemplateRequirements(competitor).map((requirement) => requirement.id);
assert(
  competitorIds.includes('tavily') && competitorIds.includes('slack'),
  'a template without curated ids derives its requirements from its own steps',
);

assert(
  collectStepSourceIds([
    { kind: 'query', inputs: { source: 'stripe' } },
    { kind: 'summarize' },
    { kind: 'deliver', deliveryTarget: { channel: 'slack', target: '#founders' } },
  ]).join(',') === 'stripe,slack',
  'step derivation reads query sources and the delivery channel, and ignores the rest',
);

const subjects = buildMissionSourceSubjects({
  liveMissions: [{
    key: 'auto_SYNTHETIC',
    title: 'Weekly founder brief',
    notify: '#founders',
    steps: [{ kind: 'query', inputs: { source: 'stripe' } }],
  }],
  templates: WORKFLOW_TEMPLATES,
});
assert(
  subjects[0].origin === 'live',
  'live missions lead the readiness list -- real runs ride on them',
);
assert(
  subjects.filter((subject) => subject.title === 'Weekly founder brief').length === 1,
  'a template already running as a live mission is not double-counted',
);
assert(
  subjects[0].requirements.map((requirement) => requirement.id).join(',') === 'stripe,slack',
  'a live mission derives its requirements from its own steps and destination',
);

// --- 9. Composition: the tab renders the live section, not the chip list -----

assert(
  dashboard.includes('<IntegrationsCommandCenter'),
  'Dashboard mounts the live integrations section',
);
assert(
  (dashboard.match(/\{renderIntegrationsCommandCenter\(\)\}/g) || []).length === 2,
  'both integrations branches (mission selected or not) render the same live section',
);
assert(
  !dashboard.includes('Core founder stack'),
  'the decorative "Core founder stack" copy block is gone',
);
assert(
  !dashboard.includes('integrations stay visible here as activation comes online'),
  'the "activation comes online" placeholder copy is gone',
);
assert(
  !/workspaceArea === 'integrations'[\s\S]{0,900}?MissionIntegrationsStrip/.test(dashboard),
  'no integrations branch falls back to the static "Available integrations" chip strip',
);
assert(
  dashboard.includes('workspaceId={workspace.workspaceId}')
    && dashboard.includes('liveMissions={taskItems'),
  "the section is scoped to the active workspace and fed that workspace's own missions",
);

// Anchored on `shortLabel`, not `id`, because the Map area carries its own
// `{ id: 'integrations' }` TAB and would otherwise win the split.
const integrationsArea = shell.split("shortLabel: 'Integrations',")[1]?.split("id: 'advanced',")[0] || '';
assert(integrationsArea.length > 0, 'the integrations workspace area is defined');
assert(
  integrationsArea.includes("{ id: 'core', label: 'Connections' }")
    && !integrationsArea.includes("{ id: 'suites'")
    && !integrationsArea.includes("{ id: 'mcp'"),
  'the area is one live surface, not a live tab sitting beside two decorative ones',
);

// --- 10. Mutations: in place, workspace-scoped, and honest ------------------

assert(
  commandCenter.includes("'/api/integrations/composio/connect'"),
  'the section connects from inside the workspace',
);
assert(
  commandCenter.includes("'/api/integrations/composio/disconnect'"),
  'the section disconnects from the same surface that connects',
);
assert(
  actions.includes('const request = getWorkspaceRequest(endpoint);')
    && actions.includes('...request.headers')
    && actions.includes("credentials: 'same-origin'"),
  'every mutation is workspace-scoped and carries the session',
);
assert(
  catalogState.includes("getWorkspaceRequest('/api/integrations/catalog')"),
  'the catalog read is workspace-scoped too',
);
assert(
  commandCenter.includes("const oauthTab = window.open('', '_blank');")
    && commandCenter.includes('oauthTab.location.href = redirectUrl;'),
  'connecting opens a provider tab instead of navigating the workspace away',
);
assert(
  commandCenter.includes('if (oauthTab) oauthTab.opener = null;'),
  'the OAuth tab cannot reach back into the workspace',
);
assert(
  commandCenter.includes("const mutationsBlocked = state.kind === 'ready' && state.degraded")
    && (commandCenter.match(/if \(mutationsBlocked\) return;/g) || []).length === 2,
  'connect and disconnect both refuse to run while connection state is degraded',
);
assert(
  commandCenter.includes("COMMAND_CENTER_DEGRADED_NOTICE = 'Connection status is temporarily unavailable'")
    && commandCenter.includes('{state.degraded ? <StatusNotice'),
  'a degraded catalog says so and offers a retry instead of reporting disconnection',
);
assert(
  !/window\.confirm\(/.test(commandCenter) && !/(?<![.\w])confirm\(/.test(commandCenter),
  'destructive confirmation is inline, not a blocking browser dialog',
);

// --- 11. Pending connections render with resume and cancel ------------------

assert(
  commandCenter.includes('{state.pending.length > 0 ? ('),
  'the pending block renders only when the server actually reports pending work',
);
assert(
  commandCenter.includes('Finish connecting')
    && commandCenter.includes('Resume')
    && commandCenter.includes('handleCancelPending'),
  'an abandoned OAuth tab is surfaced as "Finish connecting" with both Resume and Cancel',
);
assert(
  commandCenter.includes("'/api/integrations/composio/cancel-pending'"),
  'a stuck pending connection can be cancelled, not just stared at',
);
assert(
  commandCenter.includes("'/api/integrations/library/provision'")
    && commandCenter.includes('Set up library folder')
    && commandCenter.includes('{state.library ? ('),
  'the library block offers provisioning and renders only when the server reports a library',
);

// --- 12. Bounded reads: no per-mission readiness fan-out --------------------

assert(
  (commandCenter.match(/fetchReadinessProbe\(/g) || []).length === 1,
  'readiness is read once, not once per mission',
);
assert(
  !commandCenter.includes('/api/workflows/'),
  'the section never builds its own readiness URLs -- the single bounded probe owns that',
);

// --- 13. The Slack picker feature-detects -----------------------------------

assert(
  actions.includes("if (response.status === 404) return { kind: 'unsupported' };"),
  'a 404 from the channel directory is "this server has no directory", not "you have no channels"',
);
assert(
  picker.includes("if (result.kind !== 'ready' || result.channels.length === 0) {")
    && picker.includes('{children}'),
  'any non-ready directory answer falls back to the existing text input',
);
assert(
  picker.includes('Violema is in this channel') && picker.includes('Invite required'),
  'the picker reports membership so a delivery cannot be aimed at a channel Violema cannot post to',
);
assert(
  dashboard.includes('<SlackChannelPicker')
    && dashboard.includes("active={automationEditor.destinationType === 'slack'}")
    && /<SlackChannelPicker[\s\S]{0,900}?aria-label="Result destination"/.test(dashboard),
  'the automation editor wraps its destination input in the picker rather than replacing it outright',
);

// --- 14. Wiring -------------------------------------------------------------

assert(
  packageJson.scripts?.['test:dashboard-integrations'] === 'node tests/dashboardIntegrations.contract.mjs',
  'the frontend exposes this contract as its own script',
);
assert(
  packageJson.scripts?.test?.includes('test:dashboard-integrations'),
  'the contract runs as part of `npm test`',
);

console.log(
  'dashboardIntegrations.contract: live per-source state, connected-but-limited kept distinct, '
  + 'pending resumable, degraded never disconnected, mutations workspace-scoped, picker feature-detected',
);
