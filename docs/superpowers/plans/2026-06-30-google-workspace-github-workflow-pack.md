# Google Workspace and GitHub Workflow Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub, Gmail, Google Calendar, and Google Drive as workflow-ready founder operating sources behind readiness checks, approval gates, and safe run-ledger evidence.

**Architecture:** Keep Violema's workflow runtime, review gate, and ledger as the product-owned trust layer. Use manual/native GitHub access first, use the existing Composio-style partner bridge for Google Workspace, normalize every provider response into Violema DTOs, and keep provider payloads out of workflow templates and mission UI.

**Tech Stack:** TypeScript, Express, React/Vite, Node `node:test`, existing Composio bridge, existing encrypted `settingsStore`, existing JSON-backed scheduler and workflow ledger.

## Global Constraints

- No broad OAuth marketplace rewrite in this slice.
- No replacement of Google/Microsoft auth login flows.
- No automatic Gmail sending without explicit approval.
- No Drive document mutation in the first pass.
- No GitHub writes except approved issue creation, and only after the read path is proven.
- No inbox-wide exports or broad Drive crawling by default.
- No "all Google data" claim; scopes and workflow source filters must be explicit.
- No database migration unless JSON-backed storage blocks a required contract.
- Google Workspace operational access stays separate from Google/Microsoft login and admin recovery flows.
- Backend source ids stay stable as `gmail`, `google_calendar`, and `google_drive`.
- Missing required sources return structured readiness errors and must not fall back to fake data.
- Ledger metadata stores source ids, counts, windows, provider routes, ids, and short summaries; it must not store raw email bodies, full Drive document text, or large GitHub payloads.

---

## File Structure

- Modify `backend/src/integrationRegistry.ts`
  - Add `gmail`, `google_calendar`, and `google_drive` definitions.
  - Keep GitHub manual-token first and add stricter boundaries.
  - Expose partner app metadata without leaking env keys.
- Modify `backend/src/settingsStore.ts`
  - Let fieldless partner integrations appear in settings views without breaking credential loops.
- Modify `frontend/src/pages/SettingsPage.tsx`
  - Add Google Workspace provider rows and anchors.
  - Support partner-only rows with a connect action instead of a password input.
- Modify `frontend/src/pages/IntegrationsPage.tsx`
  - Present Google Workspace as a workflow pack while preserving separate Gmail, Calendar, and Drive permission surfaces.
- Modify `backend/src/scheduler.ts`
  - Persist `workflowId` and `templateId` on automation records.
- Modify `backend/src/server.ts`
  - Accept workflow/template ids from the dashboard.
  - Pass partner connection state into readiness checks.
  - Record safe ledger metadata for all live source reads.
- Modify `frontend/src/pages/Dashboard.tsx`
  - Carry explicit `workflowId`/`templateId` from templates to saved automations.
  - Use explicit workflow identity for readiness instead of mixed-step inference.
- Modify `backend/src/integrationGateway/types.ts`
  - Add provider error codes and normalized provider DTO types.
- Create `backend/src/integrationGateway/adapters/nativeGithub.ts`
  - Read-only GitHub issue and pull-request adapter with injectable fetch for tests.
- Create `backend/src/integrationGateway/adapters/partnerGoogleWorkspace.ts`
  - Partner-action wrapper and normalizer for Gmail, Calendar, and Drive reads.
- Modify `backend/src/integrationGateway/queryData.ts`
  - Route GitHub and Google Workspace sources through real adapters.
  - Keep legacy sample data only for unsupported/non-required sources.
- Modify `backend/src/integrationGateway/workflowReadiness.ts`
  - Add five workflow-specific readiness rules.
  - Support partner connection aliases for Google Workspace.
- Modify `backend/src/integrationGateway/workflowPolicy.ts`
  - Keep explicit workflow/template ids authoritative and expand approval policy for the new pack.
- Modify `backend/src/integrationGateway/auditLog.ts`
  - Add a helper for safe `data_read` metadata.
- Modify `frontend/src/content/workflowTemplates.ts`
  - Add required/optional integration metadata.
  - Add Shipping and Revenue Pulse and Board Packet Prep templates.
- Modify `frontend/src/features/integrations/workflowReadinessUi.ts`
  - Route new blockers to real setup surfaces.
  - Prefer explicit workflow ids when present.
- Add or modify tests:
  - `backend/tests/integrationRegistry.test.ts`
  - `backend/tests/settingsStore.test.ts`
  - `backend/tests/workflowIdentity.test.ts`
  - `backend/tests/workflowReadiness.test.ts`
  - `backend/tests/nativeGithub.test.ts`
  - `backend/tests/partnerGoogleWorkspace.test.ts`
  - `backend/tests/queryDataGateway.test.ts`
  - `backend/tests/approvalLedger.test.ts`
  - `backend/tests/workflowPolicy.test.ts`
  - `frontend/tests/workflowTemplates.contract.ts`
  - `frontend/tests/workflowReadinessUi.contract.ts`

---

## Execution Order

1. Registry/settings surfaces.
2. Workflow/template identity persistence.
3. Workflow readiness rules.
4. GitHub read adapter.
5. Google Workspace partner adapter.
6. Gateway routing and safe ledger metadata.
7. Frontend template/readiness UI.
8. Staging smoke and PR update.

---

### Task 1: Registry and Settings Surfaces

**Files:**
- Modify: `backend/src/integrationRegistry.ts`
- Modify: `backend/src/settingsStore.ts`
- Modify: `backend/tests/integrationRegistry.test.ts`
- Modify: `backend/tests/settingsStore.test.ts`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/IntegrationsPage.tsx`

**Interfaces:**
- Produces:
  - `IntegrationProvider` includes `gmail | google_calendar | google_drive`.
  - `buildIntegrationCatalog({ partnerEnabled, connectedPartnerApps })` returns partner-app entries for `gmail`, `google_calendar`, and `google_drive`.
  - `WorkspaceSettingsView.integrations.gmail.fields` is an empty object when the integration is partner-only.
- Consumes:
  - Existing `getIntegrationFields(provider)` and `getIntegrationEnvKeys(provider, field)`.
  - Existing `/api/integrations/catalog` and `/api/integrations/composio/connect` routes.

- [ ] **Step 1: Add failing registry tests**

Append to `backend/tests/integrationRegistry.test.ts`:

```ts
test('integration catalog exposes Google Workspace as separate provider surfaces', async () => {
  const registry = await import('../src/integrationRegistry');

  const catalog = registry.buildIntegrationCatalog({
    partnerEnabled: true,
    connectedPartnerApps: ['gmail'],
  });

  assert.equal(registry.isIntegrationProvider('gmail'), true);
  assert.equal(registry.isIntegrationProvider('google_calendar'), true);
  assert.equal(registry.isIntegrationProvider('google_drive'), true);
  assert.deepEqual(registry.getIntegrationFields('gmail'), []);
  assert.deepEqual(registry.getIntegrationFields('google_calendar'), []);
  assert.deepEqual(registry.getIntegrationFields('google_drive'), []);

  const gmail = catalog.providers.find((provider) => provider.id === 'gmail');
  const calendar = catalog.providers.find((provider) => provider.id === 'google_calendar');
  const drive = catalog.providers.find((provider) => provider.id === 'google_drive');

  assert.equal(gmail?.connectionMethod, 'partner');
  assert.equal(calendar?.connectionMethod, 'partner');
  assert.equal(drive?.connectionMethod, 'partner');
  assert.ok(catalog.partnerApps.some((app) => app.name === 'gmail'));
  assert.ok(catalog.partnerApps.some((app) => app.name === 'google_calendar'));
  assert.ok(catalog.partnerApps.some((app) => app.name === 'google_drive'));

  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /GMAIL_/);
  assert.doesNotMatch(serialized, /GOOGLE_/);
});
```

- [ ] **Step 2: Add failing fieldless settings test**

Append to `backend/tests/settingsStore.test.ts` inside the existing temp-dir test after the first `view` assertion block:

```ts
    assert.equal(view.integrations.gmail.configured, false);
    assert.equal(view.integrations.gmail.activeSource, 'none');
    assert.deepEqual(Object.keys(view.integrations.gmail.fields), []);
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts tests/settingsStore.test.ts
```

Expected: fails because `gmail`, `google_calendar`, and `google_drive` are not valid integration providers yet.

- [ ] **Step 4: Add provider definitions**

In `backend/src/integrationRegistry.ts`, add the three definitions immediately after `github`:

```ts
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    detail: 'Threads, replies, commitments, and founder-critical follow-up',
    description: 'Let Violema read selected Gmail threads and prepare follow-up queues without sending messages automatically.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'gmail',
    credentialFields: [],
    capabilities: ['Search recent threads', 'Identify unreplied conversations', 'Extract commitments and promised materials'],
    boundaries: ['Narrow query windows by default', 'No inbox-wide export', 'No sending without approval', 'Ledger stores summaries and ids instead of raw bodies'],
  },
  google_calendar: {
    id: 'google_calendar',
    label: 'Google Calendar',
    detail: 'Meetings, deadlines, attendees, and relationship commitments',
    description: 'Let Violema read selected calendar windows for meeting prep, weekly briefs, and investor follow-up.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'google_calendar',
    credentialFields: [],
    capabilities: ['Read upcoming meetings', 'Read recent meetings', 'Extract deadlines and relationship commitments'],
    boundaries: ['No event creation or edits', 'No attendee spam', 'No broad historical calendar scan by default'],
  },
  google_drive: {
    id: 'google_drive',
    label: 'Google Drive',
    detail: 'Docs, files, board materials, and investor update source material',
    description: 'Let Violema search selected Drive files and normalize source material for reviewed drafts.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'google_drive',
    credentialFields: [],
    capabilities: ['Search selected docs', 'Read allowed document text and metadata', 'Identify recently changed investor, customer, and board files'],
    boundaries: ['No broad Drive crawl by default', 'No permission changes', 'No file deletion', 'No raw large-document dumping into Slack or email'],
  },
```

Tighten the existing GitHub `boundaries` to:

```ts
boundaries: ['No repository deletion', 'No secret or workflow environment reads', 'No commits, branch deletion, or release mutation', 'Writes require approval in founder workflows'],
```

- [ ] **Step 5: Make settings tolerate fieldless providers**

In `backend/src/settingsStore.ts`, keep the existing `getIntegrationFields(provider).map` loop. No special branching is needed once the registry returns an empty list. Confirm this expression remains valid:

```ts
const workspaceConfigured = Object.values(fields).some((field) => field.workspaceConfigured);
const serverConfigured = Object.values(fields).some((field) => field.serverConfigured);
```

The expected result for fieldless partner providers is `configured: false`, `activeSource: 'none'`, and `fields: {}`.

- [ ] **Step 6: Update Settings UI types and partner-only rows**

In `frontend/src/pages/SettingsPage.tsx`, update the provider union:

```ts
type IntegrationProvider =
  | 'github'
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'linear'
  | 'notion'
  | 'stripe'
  | 'hubspot'
  | 'airtable'
  | 'figma'
  | 'vercel';
```

Change `field` to optional:

```ts
const INTEGRATION_COPY: Array<{
  id: IntegrationProvider;
  label: string;
  field?: IntegrationCredentialField;
  fieldLabel?: string;
  placeholder?: string;
  help: string;
  use: string;
  setupRoute?: string;
}> = [
```

Add the rows after GitHub:

```ts
  {
    id: 'gmail',
    label: 'Gmail',
    help: 'Threads, replies, commitments, and investor/customer follow-up source material.',
    use: 'Google Workspace',
    setupRoute: '/integrations?provider=gmail',
  },
  {
    id: 'google_calendar',
    label: 'Google Calendar',
    help: 'Meetings, deadlines, attendees, and weekly founder commitments.',
    use: 'Google Workspace',
    setupRoute: '/integrations?provider=google_calendar',
  },
  {
    id: 'google_drive',
    label: 'Google Drive',
    help: 'Docs, board packets, investor materials, and reviewed source files.',
    use: 'Google Workspace',
    setupRoute: '/integrations?provider=google_drive',
  },
```

In the card loop, compute the anchor once:

```ts
const anchorId = `integration-${integration.id.replace(/_/g, '-')}`;
const fieldStatus = integration.field ? status?.fields?.[integration.field] : undefined;
```

Set:

```tsx
id={anchorId}
```

Render the credential input only when `integration.field` exists. For partner-only rows, render:

```tsx
<button
  type="button"
  onClick={() => navigate(integration.setupRoute || '/integrations')}
  className="ui-pill shrink-0 px-3 py-1.5 text-[10px] normal-case tracking-normal text-cyan-200"
>
  Connect
</button>
```

- [ ] **Step 7: Update Integrations page copy**

In `frontend/src/pages/IntegrationsPage.tsx`, add a `GOOGLE_WORKSPACE_PACK` array near `NATIVE_NOW`:

```ts
const GOOGLE_WORKSPACE_PACK = [
  { name: 'Gmail', provider: 'gmail', detail: 'Commitments, unreplied threads, and investor follow-up' },
  { name: 'Google Calendar', provider: 'google_calendar', detail: 'Meetings, deadlines, and relationship context' },
  { name: 'Google Drive', provider: 'google_drive', detail: 'Docs, packets, and source material' },
];
```

In `ComposioConnectSection`, render these three providers first when they appear in `catalog.partnerApps`. Use the existing `handleConnect(app.name)` path; do not add custom OAuth code.

- [ ] **Step 8: Run tests and build check**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts tests/settingsStore.test.ts
npm run build

cd /Users/maximisto/Documents/New\ project/frontend
npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit Task 1**

```bash
git add backend/src/integrationRegistry.ts backend/src/settingsStore.ts backend/tests/integrationRegistry.test.ts backend/tests/settingsStore.test.ts frontend/src/pages/SettingsPage.tsx frontend/src/pages/IntegrationsPage.tsx
git commit -m "feat(integrations): add Google Workspace surfaces"
```

---

### Task 2: Workflow and Template Identity Persistence

**Files:**
- Modify: `backend/src/scheduler.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/integrationGateway/workflowPolicy.ts`
- Create: `backend/tests/workflowIdentity.test.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/tests/workflowReadinessUi.contract.ts`

**Interfaces:**
- Produces:
  - `AutomationRecord.workflowId?: string`
  - `AutomationRecord.templateId?: string`
  - `AutomationEditorDraft.workflowId?: string`
  - `AutomationEditorDraft.templateId?: string`
  - `inferEditorWorkflowId(steps, explicitWorkflowId?)`
- Consumes:
  - Existing `inferWorkflowIdFromAutomation(automation)` already prefers explicit ids.

- [ ] **Step 1: Add failing persistence test**

Create `backend/tests/workflowIdentity.test.ts`:

```ts
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inferWorkflowIdFromAutomation } from '../src/integrationGateway/workflowPolicy';

test('automation records persist explicit workflow and template identity', async () => {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(tmpdir(), 'violema-workflow-identity-'));

  try {
    process.chdir(tempDir);
    const scheduler = await import('../src/scheduler');
    const record = scheduler.createAutomation({
      workspaceId: 'workspace_test',
      workflowId: 'weekly-founder-brief',
      templateId: 'weekly-founder-brief',
      name: 'Weekly founder brief',
      description: 'Founder operating brief',
      authoring_mode: 'guided',
      workflow_prompt: 'Check Stripe\nCheck GitHub\nDraft brief',
      schedule: 'every monday at 9am',
      timezone: 'America/Chicago',
      actions: ['Check Stripe revenue', 'Scan GitHub delivery', 'Draft founder brief'],
      steps: [
        { id: 'step_stripe', kind: 'query', title: 'Check Stripe', objective: 'Read revenue.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
        { id: 'step_github', kind: 'query', title: 'Check GitHub', objective: 'Read delivery.', inputs: { source: 'github', query_type: 'delivery_risk' } },
      ],
      notify: '#all-purple-orange',
    }, async () => ({ ok: true }));

    assert.equal(record.workflowId, 'weekly-founder-brief');
    assert.equal(record.templateId, 'weekly-founder-brief');
    assert.equal(inferWorkflowIdFromAutomation(record), 'weekly-founder-brief');
    assert.equal(scheduler.getAutomationById(record.id)?.workflowId, 'weekly-founder-brief');
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowIdentity.test.ts
```

Expected: TypeScript fails because `workflowId` and `templateId` are not accepted by `createAutomation` yet.

- [ ] **Step 3: Persist ids in scheduler**

In `backend/src/scheduler.ts`, add fields to `AutomationRecord`:

```ts
  workflowId?: string;
  templateId?: string;
```

Add the same fields to `AutomationSeed`.

In `CORE_AUTOMATION_SEEDS[0]`, add:

```ts
    workflowId: 'weekly-founder-brief',
    templateId: 'weekly-founder-brief',
```

In `createAutomation(input)`, write:

```ts
    workflowId: input.workflowId?.trim() || undefined,
    templateId: input.templateId?.trim() || undefined,
```

In `normalizeAutomationRecord(record)`, preserve normalized fields:

```ts
    workflowId: record.workflowId?.trim() || undefined,
    templateId: record.templateId?.trim() || undefined,
```

- [ ] **Step 4: Accept ids in server create/update**

In `backend/src/server.ts`, extend the automation body shape for POST and PATCH:

```ts
    workflowId?: string | null;
    templateId?: string | null;
```

Pass into `createAutomation`:

```ts
      workflowId: typeof body.workflowId === 'string' ? body.workflowId.trim() || undefined : undefined,
      templateId: typeof body.templateId === 'string' ? body.templateId.trim() || undefined : undefined,
```

In PATCH, include:

```ts
      workflowId: typeof body.workflowId === 'string' ? body.workflowId.trim() || undefined : undefined,
      templateId: typeof body.templateId === 'string' ? body.templateId.trim() || undefined : undefined,
```

Do not alter old records that omit these fields.

- [ ] **Step 5: Carry ids through the dashboard editor**

In `frontend/src/pages/Dashboard.tsx`, add to `AutomationEditorDraft`:

```ts
  workflowId?: string;
  templateId?: string;
```

When applying a template, set:

```ts
        workflowId: template.id,
        templateId: template.id,
```

When saving, include:

```ts
          workflowId: automationEditor.workflowId || null,
          templateId: automationEditor.templateId || null,
```

When editing an existing automation, read the fields from the selected task/automation record:

```ts
workflowId: task.workflowId,
templateId: task.templateId,
```

If the current `DashboardTaskItem` and automation list types do not expose these fields yet, add `workflowId?: string` and `templateId?: string` to both local interfaces and mapping code.

- [ ] **Step 6: Prefer explicit workflow identity in readiness UI**

In `frontend/src/features/integrations/workflowReadinessUi.ts`, change:

```ts
export function inferEditorWorkflowId(steps: WorkflowReadinessUiStep[]): string {
```

to:

```ts
export function inferEditorWorkflowId(steps: WorkflowReadinessUiStep[], explicitWorkflowId?: string | null): string {
  const explicit = typeof explicitWorkflowId === 'string' ? explicitWorkflowId.trim() : '';
  if (explicit) return explicit;
```

In `Dashboard.tsx`, call:

```ts
() => inferEditorWorkflowId(automationEditorSourceSteps, automationEditor?.workflowId)
```

- [ ] **Step 7: Add frontend contract assertion**

Append to `frontend/tests/workflowReadinessUi.contract.ts`:

```ts
assert(
  inferEditorWorkflowId([
    { kind: 'query', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'query', inputs: { source: 'github', query_type: 'delivery_risk' } },
  ], 'weekly-founder-brief') === 'weekly-founder-brief',
  'explicit workflow identity wins over mixed-step inference',
);
```

- [ ] **Step 8: Run tests and build check**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowIdentity.test.ts tests/workflowPolicy.test.ts
npm run build

cd /Users/maximisto/Documents/New\ project/frontend
npx ts-node tests/workflowReadinessUi.contract.ts
npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit Task 2**

```bash
git add backend/src/scheduler.ts backend/src/server.ts backend/src/integrationGateway/workflowPolicy.ts backend/tests/workflowIdentity.test.ts frontend/src/pages/Dashboard.tsx frontend/src/features/integrations/workflowReadinessUi.ts frontend/tests/workflowReadinessUi.contract.ts
git commit -m "feat(workflows): persist template identity"
```

---

### Task 3: Workflow-Specific Readiness Rules

**Files:**
- Modify: `backend/src/integrationGateway/workflowReadiness.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/workflowReadiness.test.ts`

**Interfaces:**
- Produces:
  - `checkWorkflowReadiness({ connectedPartnerApps?: string[] })`
  - Readiness reports for:
    - `weekly-founder-brief`
    - `investor-follow-up`
    - `monthly-investor-update`
    - `shipping-revenue-pulse`
    - `board-packet-prep`
- Consumes:
  - `getWorkspaceSettingsView(workspaceId)`
  - `listConnectedApps({ entityId: workspaceId })`

- [ ] **Step 1: Add failing readiness tests**

Append to `backend/tests/workflowReadiness.test.ts`:

```ts
test('Weekly Founder Brief requires Stripe GitHub Gmail and Calendar with Drive optional', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'weekly-founder-brief',
    workspaceId: 'workspace_test',
    deliveryTarget: '#all-purple-orange',
    connectedPartnerApps: ['gmail', 'google_calendar'],
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_calendar: { configured: false },
        google_drive: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe', 'github', 'gmail', 'google_calendar']);
  assert.deepEqual(report.optionalIntegrationIds, ['google_drive', 'web_search']);
  assert.equal(report.firstRunRequiresApproval, true);
});

test('Investor Follow-up blocks missing Gmail and routes to partner setup', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'investor-follow-up',
    workspaceId: 'workspace_test',
    connectedPartnerApps: ['google_calendar'],
    settingsView: {
      integrations: {
        gmail: { configured: false },
        google_calendar: { configured: false },
        google_drive: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  const gmail = report.blockers.find((item) => item.key === 'gmail');
  assert.equal(gmail?.label, 'Connect Gmail');
  assert.equal(gmail?.route, '/integrations?provider=gmail&workflow=investor-follow-up');
});

test('Monthly Investor Update requires Stripe GitHub and Drive', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'monthly-investor-update',
    workspaceId: 'workspace_test',
    connectedPartnerApps: ['google_drive'],
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: true },
        gmail: { configured: false },
        google_drive: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe', 'github', 'google_drive']);
  assert.deepEqual(report.optionalIntegrationIds, ['gmail']);
});

test('Shipping and Revenue Pulse requires Stripe and GitHub', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'shipping-revenue-pulse',
    workspaceId: 'workspace_test',
    settingsView: {
      integrations: {
        stripe: { configured: true },
        github: { configured: false },
      },
    },
  });

  assert.equal(report.ready, false);
  assert.deepEqual(report.requiredIntegrationIds, ['stripe', 'github']);
  assert.equal(report.blockers.find((item) => item.key === 'github')?.route, '/settings#integration-github');
});

test('Board Packet Prep requires Drive and Calendar while Stripe and GitHub are optional', () => {
  const report = checkWorkflowReadiness({
    workflowId: 'board-packet-prep',
    workspaceId: 'workspace_test',
    connectedPartnerApps: ['google_drive', 'google_calendar'],
    settingsView: {
      integrations: {
        google_drive: { configured: false },
        google_calendar: { configured: false },
        stripe: { configured: false },
        github: { configured: false },
      },
    },
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.requiredIntegrationIds, ['google_drive', 'google_calendar']);
  assert.deepEqual(report.optionalIntegrationIds, ['stripe', 'github']);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts
```

Expected: new workflows are unsupported and `connectedPartnerApps` is not accepted.

- [ ] **Step 3: Replace single-workflow requirement branch with a map**

In `backend/src/integrationGateway/workflowReadiness.ts`, add:

```ts
const WORKFLOW_REQUIREMENTS: Record<string, WorkflowRequirements> = {
  'revenue-watch': {
    supported: true,
    requiredIntegrationIds: ['stripe'],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: true,
    defaultDeliveryTarget: REVENUE_WATCH_DEFAULT_DELIVERY_TARGET,
  },
  'weekly-founder-brief': {
    supported: true,
    requiredIntegrationIds: ['stripe', 'github', 'gmail', 'google_calendar'],
    optionalIntegrationIds: ['google_drive', 'web_search'],
    firstRunRequiresApproval: true,
    defaultDeliveryTarget: REVENUE_WATCH_DEFAULT_DELIVERY_TARGET,
  },
  'investor-follow-up': {
    supported: true,
    requiredIntegrationIds: ['gmail', 'google_calendar'],
    optionalIntegrationIds: ['google_drive'],
    firstRunRequiresApproval: true,
  },
  'monthly-investor-update': {
    supported: true,
    requiredIntegrationIds: ['stripe', 'github', 'google_drive'],
    optionalIntegrationIds: ['gmail'],
    firstRunRequiresApproval: true,
  },
  'shipping-revenue-pulse': {
    supported: true,
    requiredIntegrationIds: ['stripe', 'github'],
    optionalIntegrationIds: ['web_search'],
    firstRunRequiresApproval: true,
    defaultDeliveryTarget: REVENUE_WATCH_DEFAULT_DELIVERY_TARGET,
  },
  'board-packet-prep': {
    supported: true,
    requiredIntegrationIds: ['google_drive', 'google_calendar'],
    optionalIntegrationIds: ['stripe', 'github'],
    firstRunRequiresApproval: true,
  },
};
```

Change `readWorkflowRequirements(workflowId)` to:

```ts
function readWorkflowRequirements(workflowId: string): WorkflowRequirements {
  return WORKFLOW_REQUIREMENTS[workflowId] || {
    supported: false,
    requiredIntegrationIds: [],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: false,
  };
}
```

- [ ] **Step 4: Add setup route and label helpers**

In `workflowReadiness.ts`, add:

```ts
const INTEGRATION_SETUP: Record<string, { label: string; route: (workflowId: string) => string; detail: string }> = {
  stripe: {
    label: 'Connect Stripe',
    route: () => '/integrations?provider=stripe&workflow=revenue-watch',
    detail: 'Stripe read access is required before this workflow can run with real revenue data.',
  },
  github: {
    label: 'Connect GitHub',
    route: () => '/settings#integration-github',
    detail: 'GitHub repository access is required before this workflow can read delivery and issue signals.',
  },
  gmail: {
    label: 'Connect Gmail',
    route: (workflowId) => `/integrations?provider=gmail&workflow=${workflowId}`,
    detail: 'Gmail access is required before this workflow can identify commitments and unreplied threads.',
  },
  google_calendar: {
    label: 'Connect Google Calendar',
    route: (workflowId) => `/integrations?provider=google_calendar&workflow=${workflowId}`,
    detail: 'Google Calendar access is required before this workflow can read meeting and deadline context.',
  },
  google_drive: {
    label: 'Connect Google Drive',
    route: (workflowId) => `/integrations?provider=google_drive&workflow=${workflowId}`,
    detail: 'Google Drive access is required before this workflow can read selected document source material.',
  },
};
```

- [ ] **Step 5: Support partner app aliases**

Add to `checkWorkflowReadiness` input:

```ts
  connectedPartnerApps?: string[];
```

Add helpers:

```ts
const PARTNER_ALIASES: Record<string, string[]> = {
  gmail: ['gmail'],
  google_calendar: ['google_calendar', 'googlecalendar'],
  google_drive: ['google_drive', 'googledrive'],
};

function hasPartnerConnection(provider: string, connectedPartnerApps: string[] = []) {
  const normalized = new Set(connectedPartnerApps.map((item) => item.toLowerCase()));
  return (PARTNER_ALIASES[provider] || []).some((alias) => normalized.has(alias));
}

function isRequirementConfigured(input: {
  settingsView: WorkspaceSettingsView | MinimalSettingsView;
  id: string;
  connectedPartnerApps?: string[];
}) {
  if (isConfigured(input.settingsView, input.id)) return true;
  return hasPartnerConnection(input.id, input.connectedPartnerApps);
}
```

Replace the hard-coded Stripe blocker branch with a loop over `requirements.requiredIntegrationIds`.

- [ ] **Step 6: Make readiness route include partner connection state**

In `backend/src/server.ts`, change the readiness route to async:

```ts
app.get('/api/workflows/:workflowId/readiness', async (req: Request, res: Response) => {
  const { workspaceId } = resolveWorkspaceContext(req);
  const deliveryTarget = typeof req.query.deliveryTarget === 'string' ? req.query.deliveryTarget : undefined;
  const connectedPartnerApps = await listConnectedApps({ entityId: workspaceId });

  res.json({
    ok: true,
    report: checkWorkflowReadiness({
      workspaceId,
      workflowId: req.params.workflowId,
      deliveryTarget,
      connectedPartnerApps,
    }),
  });
});
```

- [ ] **Step 7: Run tests and build check**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowReadiness.test.ts
npm run build
```

Expected: all pass.

- [ ] **Step 8: Commit Task 3**

```bash
git add backend/src/integrationGateway/workflowReadiness.ts backend/src/server.ts backend/tests/workflowReadiness.test.ts
git commit -m "feat(workflows): add founder pack readiness rules"
```

---

### Task 4: Native GitHub Read Adapter

**Files:**
- Modify: `backend/src/integrationGateway/types.ts`
- Create: `backend/src/integrationGateway/adapters/nativeGithub.ts`
- Create: `backend/tests/nativeGithub.test.ts`

**Interfaces:**
- Produces:
  - `GithubQueryType = 'delivery_risk' | 'open_issues' | 'merged_prs'`
  - `queryGithub(input: QueryGithubInput): Promise<IntegrationQueryResult<GithubQueryData>>`
  - `GithubDeliveryRiskSummary`
  - `GithubOpenIssuesSummary`
  - `GithubMergedPullRequestsSummary`
- Consumes:
  - `getIntegrationCredential(workspaceId, 'github', 'token')`
  - `fetch` or injected `fetchLike`.

- [ ] **Step 1: Add failing adapter tests**

Create `backend/tests/nativeGithub.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  queryGithub,
  type GithubFetchLike,
} from '../src/integrationGateway/adapters/nativeGithub';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test('queryGithub returns readiness error when token is missing', async () => {
  const result = await queryGithub({
    workspaceId: 'workspace_test',
    queryType: 'delivery_risk',
    filters: { repository: 'maximisto/violema' },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.nextAction.route, '/settings#integration-github');
});

test('queryGithub normalizes open issue data without code or secrets', async () => {
  const fetchLike: GithubFetchLike = async (url) => {
    assert.match(String(url), /issues/);
    return jsonResponse([
      {
        id: 1,
        number: 42,
        title: 'Fix billing smoke',
        html_url: 'https://github.com/maximisto/violema/issues/42',
        state: 'open',
        labels: [{ name: 'high' }],
        user: { login: 'max' },
        created_at: '2026-06-20T12:00:00.000Z',
        updated_at: '2026-06-29T12:00:00.000Z',
      },
      {
        id: 2,
        number: 43,
        title: 'PR shaped as issue should be ignored',
        html_url: 'https://github.com/maximisto/violema/pull/43',
        pull_request: {},
        state: 'open',
        labels: [],
        user: { login: 'bot' },
        created_at: '2026-06-21T12:00:00.000Z',
        updated_at: '2026-06-29T12:00:00.000Z',
      },
    ]);
  };

  const result = await queryGithub({
    workspaceId: 'workspace_test',
    queryType: 'open_issues',
    filters: { repository: 'maximisto/violema' },
    token: 'ghp_test',
    fetchLike,
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.live, true);
  assert.equal(result.source, 'github');
  assert.equal(result.query_type, 'open_issues');
  assert.equal(result.data.repository, 'maximisto/violema');
  assert.equal(result.data.total, 1);
  assert.equal(result.data.items[0].number, 42);
  assert.doesNotMatch(JSON.stringify(result), /secret|contents|patch|diff/i);
});

test('queryGithub derives delivery risk from issues and pull requests', async () => {
  const fetchLike: GithubFetchLike = async (url) => {
    const value = String(url);
    if (value.includes('/issues')) {
      return jsonResponse([
        { number: 1, title: 'Blocked onboarding', html_url: 'https://github.com/maximisto/violema/issues/1', labels: [{ name: 'blocker' }], updated_at: '2026-06-01T12:00:00.000Z', created_at: '2026-05-25T12:00:00.000Z' },
      ]);
    }
    return jsonResponse([
      { number: 7, title: 'Ship founder brief', html_url: 'https://github.com/maximisto/violema/pull/7', state: 'closed', merged_at: '2026-06-29T12:00:00.000Z', updated_at: '2026-06-29T12:00:00.000Z', user: { login: 'max' } },
    ]);
  };

  const result = await queryGithub({
    workspaceId: 'workspace_test',
    queryType: 'delivery_risk',
    filters: { repository: 'maximisto/violema' },
    token: 'ghp_test',
    fetchLike,
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.data.blockers, 1);
  assert.equal(result.data.merged_this_week, 1);
  assert.equal(result.data.risk_level, 'medium');
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/nativeGithub.test.ts
```

Expected: fails because `nativeGithub.ts` does not exist.

- [ ] **Step 3: Extend error codes**

In `backend/src/integrationGateway/types.ts`, change the error code union to:

```ts
  code:
    | 'integration_not_ready'
    | 'integration_auth_expired'
    | 'integration_scope_missing'
    | 'integration_rate_limited'
    | 'integration_unavailable'
    | 'unsupported_query'
    | 'integration_query_failed';
```

- [ ] **Step 4: Implement `nativeGithub.ts`**

Create `backend/src/integrationGateway/adapters/nativeGithub.ts` with these exported shapes:

```ts
import { getIntegrationCredential } from '../../settingsStore';
import type { IntegrationQueryResult } from '../types';

export type GithubQueryType = 'delivery_risk' | 'open_issues' | 'merged_prs';

export type GithubFetchLike = (url: string, init?: {
  headers?: Record<string, string>;
}) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface QueryGithubInput {
  workspaceId: string;
  queryType: string;
  filters?: Record<string, unknown>;
  token?: string;
  fetchLike?: GithubFetchLike;
  now?: Date;
}
```

Use `filters.repository` first and `process.env.GITHUB_DEFAULT_REPOSITORY` second. If neither exists, return:

```ts
{
  ok: false,
  code: 'integration_not_ready',
  source: 'github',
  message: 'GitHub repository scope is required before this workflow can read delivery signals.',
  nextAction: { label: 'Connect GitHub', route: '/settings#integration-github' },
}
```

Fetch only GitHub issue and pull-request list endpoints:

```ts
const url = `https://api.github.com/repos/${repository}/issues?state=open&per_page=50`;
const prUrl = `https://api.github.com/repos/${repository}/pulls?state=closed&sort=updated&direction=desc&per_page=50`;
```

Set headers:

```ts
{
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'Violema-Workflow-Gateway',
  'X-GitHub-Api-Version': '2022-11-28',
}
```

Normalize only safe fields:

```ts
{
  number,
  title,
  url: html_url,
  labels,
  author,
  created_at,
  updated_at,
}
```

- [ ] **Step 5: Run adapter tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/nativeGithub.test.ts
npm run build
```

Expected: pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add backend/src/integrationGateway/types.ts backend/src/integrationGateway/adapters/nativeGithub.ts backend/tests/nativeGithub.test.ts
git commit -m "feat(integrations): add read-only GitHub gateway"
```

---

### Task 5: Google Workspace Partner Adapter

**Files:**
- Modify: `backend/src/composioBridge.ts`
- Create: `backend/src/integrationGateway/adapters/partnerGoogleWorkspace.ts`
- Create: `backend/tests/partnerGoogleWorkspace.test.ts`

**Interfaces:**
- Produces:
  - `GoogleWorkspaceSource = 'gmail' | 'google_calendar' | 'google_drive'`
  - `GoogleWorkspaceQueryType`
  - `queryGoogleWorkspace(input): Promise<IntegrationQueryResult<GoogleWorkspaceQueryData>>`
  - `GOOGLE_WORKSPACE_PROVIDER_ALIASES`
- Consumes:
  - `executeComposioAction(actionName, input, { entityId })`
  - `listConnectedApps({ entityId })`

- [ ] **Step 1: Add failing adapter tests**

Create `backend/tests/partnerGoogleWorkspace.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { queryGoogleWorkspace } from '../src/integrationGateway/adapters/partnerGoogleWorkspace';

test('queryGoogleWorkspace returns readiness error for missing partner connection', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: [],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => {
      throw new Error('should not execute');
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.nextAction.route, '/integrations?provider=gmail&workflow=weekly-founder-brief');
});

test('queryGoogleWorkspace normalizes Gmail commitments without raw email bodies', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: ['gmail'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => ({
      threads: [
        {
          id: 'thread_1',
          subject: 'Investor materials',
          from: 'investor@example.com',
          snippet: 'Following up on the deck and June metrics.',
          body: 'Long raw body that should not be returned in the normalized payload.',
          date: '2026-06-29T15:00:00.000Z',
        },
      ],
    }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'gmail');
  assert.equal(result.query_type, 'commitments');
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, 'thread_1');
  assert.doesNotMatch(JSON.stringify(result), /Long raw body/);
});

test('queryGoogleWorkspace normalizes Calendar meeting windows', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'google_calendar',
    queryType: 'weekly_commitments',
    connectedPartnerApps: ['googlecalendar'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => ({
      events: [
        {
          id: 'event_1',
          summary: 'Investor sync',
          start: { dateTime: '2026-07-01T15:00:00.000Z' },
          end: { dateTime: '2026-07-01T15:30:00.000Z' },
          attendees: [{ email: 'investor@example.com' }],
        },
      ],
    }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.data.items[0].title, 'Investor sync');
  assert.equal(result.data.items[0].attendee_count, 1);
});

test('queryGoogleWorkspace normalizes Drive docs without full document text', async () => {
  const result = await queryGoogleWorkspace({
    workspaceId: 'workspace_test',
    source: 'google_drive',
    queryType: 'board_packet_sources',
    connectedPartnerApps: ['googledrive'],
    now: new Date('2026-06-30T12:00:00.000Z'),
    executor: async () => ({
      files: [
        {
          id: 'doc_1',
          name: 'Board packet draft',
          mimeType: 'application/vnd.google-apps.document',
          webViewLink: 'https://docs.google.com/document/d/doc_1',
          modifiedTime: '2026-06-28T12:00:00.000Z',
          text: 'Full private board packet text should not be returned.',
        },
      ],
    }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.data.items[0].id, 'doc_1');
  assert.doesNotMatch(JSON.stringify(result), /Full private board packet/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/partnerGoogleWorkspace.test.ts
```

Expected: fails because the adapter does not exist.

- [ ] **Step 3: Add connection helper in Composio bridge only if needed**

If `partnerGoogleWorkspace.ts` needs to test connection state without importing `listConnectedApps` directly, export this helper from `backend/src/composioBridge.ts`:

```ts
export function normalizeComposioAppName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
```

Keep the bridge as a thin wrapper. Do not add workflow-specific logic to `composioBridge.ts`.

- [ ] **Step 4: Implement `partnerGoogleWorkspace.ts`**

Create `backend/src/integrationGateway/adapters/partnerGoogleWorkspace.ts` with:

```ts
import { executeComposioAction } from '../../composioBridge';
import type { IntegrationQueryResult } from '../types';

export type GoogleWorkspaceSource = 'gmail' | 'google_calendar' | 'google_drive';
export type GoogleWorkspaceQueryType =
  | 'commitments'
  | 'unreplied_threads'
  | 'investor_threads'
  | 'weekly_commitments'
  | 'upcoming_meetings'
  | 'recent_meetings'
  | 'recent_docs'
  | 'investor_materials'
  | 'board_packet_sources';

export const GOOGLE_WORKSPACE_PROVIDER_ALIASES: Record<GoogleWorkspaceSource, string[]> = {
  gmail: ['gmail'],
  google_calendar: ['google_calendar', 'googlecalendar'],
  google_drive: ['google_drive', 'googledrive'],
};
```

Use an isolated action map:

```ts
const GOOGLE_WORKSPACE_ACTIONS: Record<GoogleWorkspaceSource, Partial<Record<GoogleWorkspaceQueryType, string>>> = {
  gmail: {
    commitments: 'GMAIL_FETCH_EMAILS',
    unreplied_threads: 'GMAIL_FETCH_EMAILS',
    investor_threads: 'GMAIL_FETCH_EMAILS',
  },
  google_calendar: {
    weekly_commitments: 'GOOGLECALENDAR_FIND_EVENT',
    upcoming_meetings: 'GOOGLECALENDAR_FIND_EVENT',
    recent_meetings: 'GOOGLECALENDAR_FIND_EVENT',
  },
  google_drive: {
    recent_docs: 'GOOGLEDRIVE_SEARCH_FILES',
    investor_materials: 'GOOGLEDRIVE_SEARCH_FILES',
    board_packet_sources: 'GOOGLEDRIVE_SEARCH_FILES',
  },
};
```

Define `executor` as injectable:

```ts
type GoogleWorkspaceExecutor = (actionName: string, input: Record<string, unknown>, ctx: { entityId: string }) => Promise<unknown>;
```

Default executor:

```ts
const defaultExecutor: GoogleWorkspaceExecutor = (actionName, input, ctx) =>
  executeComposioAction(actionName, input, ctx);
```

Normalize to one shape:

```ts
{
  window: { start: string; end: string };
  providerRoute: string;
  total: number;
  items: Array<Record<string, unknown>>;
  warnings?: string[];
}
```

For Gmail items, include only:

```ts
{ id, subject, from, date, snippet }
```

For Calendar items, include only:

```ts
{ id, title, start, end, attendee_count }
```

For Drive items, include only:

```ts
{ id, name, mimeType, url, modifiedTime }
```

- [ ] **Step 5: Run adapter tests**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/partnerGoogleWorkspace.test.ts
npm run build
```

Expected: pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add backend/src/composioBridge.ts backend/src/integrationGateway/adapters/partnerGoogleWorkspace.ts backend/tests/partnerGoogleWorkspace.test.ts
git commit -m "feat(integrations): add Google Workspace gateway"
```

---

### Task 6: Gateway Routing and Safe Ledger Metadata

**Files:**
- Modify: `backend/src/integrationGateway/queryData.ts`
- Modify: `backend/src/integrationGateway/auditLog.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/queryDataGateway.test.ts`
- Modify: `backend/tests/approvalLedger.test.ts`

**Interfaces:**
- Produces:
  - `executeQueryData` routes `github`, `gmail`, `email`, `google_calendar`, `calendar`, `google_drive`, and `drive`.
  - `buildSafeDataReadLedgerMetadata(payload)` returns safe metadata for `data_read` and `connector_failed`.
- Consumes:
  - `queryGithub`
  - `queryGoogleWorkspace`
  - Existing `appendWorkflowLedgerEvent`

- [ ] **Step 1: Add failing gateway tests**

Append to `backend/tests/queryDataGateway.test.ts`:

```ts
test('executeQueryData routes GitHub through the native adapter when repository scope exists', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'github',
    queryType: 'open_issues',
    filters: { repository: 'maximisto/violema' },
    credentialOverrides: { githubToken: 'ghp_test' },
    clientOverrides: {
      githubFetch: async () => ({
        ok: true,
        status: 200,
        async json() {
          return [{ number: 5, title: 'Real issue', html_url: 'https://github.com/maximisto/violema/issues/5', labels: [], created_at: '2026-06-29T12:00:00.000Z', updated_at: '2026-06-29T12:00:00.000Z' }];
        },
        async text() {
          return '[]';
        },
      }),
    },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.live, true);
  assert.equal(result.source, 'github');
  assert.notDeepEqual(result.data, { total: 34, critical: 2, high: 8, medium: 15, low: 9 });
});

test('executeQueryData returns readiness error for required Google Workspace source without connection', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: [],
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error('expected readiness error');
  assert.equal(result.code, 'integration_not_ready');
  assert.equal(result.source, 'gmail');
});

test('executeQueryData accepts legacy email and calendar aliases but normalizes sources', async () => {
  const result = await executeQueryData({
    workspaceId: 'workspace_test',
    source: 'email',
    queryType: 'commitments',
    connectedPartnerApps: ['gmail'],
    clientOverrides: {
      googleWorkspaceExecutor: async () => ({ threads: [] }),
    },
    now: new Date('2026-06-30T12:00:00.000Z'),
  });

  if (!result.ok) throw new Error(result.message);
  assert.equal(result.source, 'gmail');
  assert.equal(result.live, true);
});
```

- [ ] **Step 2: Add failing safe ledger metadata test**

Append to `backend/tests/approvalLedger.test.ts`:

```ts
test('data_read metadata helper redacts raw provider payloads', async () => {
  const auditLog = await import('../src/integrationGateway/auditLog');

  const metadata = auditLog.buildSafeDataReadLedgerMetadata({
    ok: true,
    source: 'gmail',
    query_type: 'commitments',
    live: true,
    data: {
      total: 1,
      window: { start: '2026-06-23T00:00:00.000Z', end: '2026-06-30T00:00:00.000Z' },
      providerRoute: 'gmail.commitments',
      items: [
        { id: 'thread_1', subject: 'Investor update', body: 'private raw body' },
      ],
    },
  });

  assert.deepEqual(metadata, {
    source: 'gmail',
    queryType: 'commitments',
    resultCount: 1,
    window: { start: '2026-06-23T00:00:00.000Z', end: '2026-06-30T00:00:00.000Z' },
    live: true,
    providerRoute: 'gmail.commitments',
  });
  assert.doesNotMatch(JSON.stringify(metadata), /private raw body/);
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts tests/approvalLedger.test.ts
```

Expected: gateway still returns legacy GitHub sample data and `buildSafeDataReadLedgerMetadata` does not exist.

- [ ] **Step 4: Extend query input type**

In `backend/src/integrationGateway/queryData.ts`, extend imports and input:

```ts
import { queryGithub, type GithubFetchLike } from './adapters/nativeGithub';
import { queryGoogleWorkspace, type GoogleWorkspaceExecutor } from './adapters/partnerGoogleWorkspace';
```

Add:

```ts
  connectedPartnerApps?: string[];
```

Extend overrides:

```ts
    githubFetch?: GithubFetchLike;
    googleWorkspaceExecutor?: GoogleWorkspaceExecutor;
```

Extend credentials:

```ts
    githubToken?: string;
```

- [ ] **Step 5: Route new sources**

Add a source normalizer:

```ts
function normalizeQuerySource(source: string) {
  if (source === 'email') return 'gmail';
  if (source === 'calendar') return 'google_calendar';
  if (source === 'drive') return 'google_drive';
  return source;
}
```

At the top of `executeQueryData`, compute:

```ts
const source = normalizeQuerySource(input.source);
```

Route:

```ts
  if (source === 'github') {
    return queryGithub({
      workspaceId: input.workspaceId,
      queryType: input.queryType,
      filters: input.filters,
      token: input.credentialOverrides?.githubToken,
      fetchLike: input.clientOverrides?.githubFetch,
      now,
    });
  }

  if (source === 'gmail' || source === 'google_calendar' || source === 'google_drive') {
    return queryGoogleWorkspace({
      workspaceId: input.workspaceId,
      source,
      queryType: input.queryType,
      filters: input.filters,
      connectedPartnerApps: input.connectedPartnerApps,
      executor: input.clientOverrides?.googleWorkspaceExecutor,
      now,
    });
  }
```

Use `source` instead of `input.source` for the legacy lookup.

- [ ] **Step 6: Add safe ledger metadata helper**

In `backend/src/integrationGateway/auditLog.ts`, export:

```ts
export function buildSafeDataReadLedgerMetadata(payload: Record<string, unknown>) {
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const items = Array.isArray(data.items) ? data.items : undefined;
  const total = typeof data.total === 'number' ? data.total : items?.length;

  return {
    source: typeof payload.source === 'string' ? payload.source : undefined,
    queryType: typeof payload.query_type === 'string' ? payload.query_type : undefined,
    resultCount: total,
    window: data.window,
    live: payload.live === true,
    providerRoute: typeof data.providerRoute === 'string' ? data.providerRoute : undefined,
  };
}
```

Do not include `payload.data.items`, `body`, `text`, `content`, `diff`, `patch`, or raw provider responses.

- [ ] **Step 7: Record ledger events for all live provider reads**

In `backend/src/server.ts`, replace the Stripe-only ledger branch in `executeAutomationCore` with:

```ts
        if (payloadSource) {
          const liveRead = payload.live === true;
          const shouldLedger = liveRead || ['stripe', 'github', 'gmail', 'google_calendar', 'google_drive'].includes(payloadSource);
          if (shouldLedger) {
            appendWorkflowLedgerEvent({
              workspaceId,
              workflowId: runContext.workflowId,
              automationId: automation.id,
              taskId: runContext.taskId,
              taskRunId: runContext.taskRunId,
              type: payload.ok === false ? 'connector_failed' : 'data_read',
              summary: payload.ok === false
                ? `${payloadSource} read blocked: ${String(payload.message || 'integration not ready')}`
                : `Read ${payloadSource} ${queryType || 'data'}.`,
              metadata: buildSafeDataReadLedgerMetadata(payload),
            });
          }
        }
```

Import `buildSafeDataReadLedgerMetadata` from `auditLog.ts`.

- [ ] **Step 8: Pass partner connection state into tool execution**

In the server query-data execution path, add `connectedPartnerApps` to the call into `executeQueryData`. If the current function is synchronous around `executeQueryData`, call `listConnectedApps({ entityId: workspaceId })` before executing query steps and pass the array through.

The expected call shape is:

```ts
executeQueryData({
  workspaceId,
  source,
  queryType,
  filters,
  limit,
  connectedPartnerApps,
})
```

- [ ] **Step 9: Run tests and build check**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/queryDataGateway.test.ts tests/approvalLedger.test.ts tests/nativeGithub.test.ts tests/partnerGoogleWorkspace.test.ts
npm run build
```

Expected: all pass.

- [ ] **Step 10: Commit Task 6**

```bash
git add backend/src/integrationGateway/queryData.ts backend/src/integrationGateway/auditLog.ts backend/src/server.ts backend/tests/queryDataGateway.test.ts backend/tests/approvalLedger.test.ts
git commit -m "feat(workflows): route founder pack source reads"
```

---

### Task 7: Workflow Templates and Readiness UI

**Files:**
- Modify: `frontend/src/content/workflowTemplates.ts`
- Modify: `frontend/src/features/integrations/workflowReadinessUi.ts`
- Modify: `frontend/tests/workflowTemplates.contract.ts`
- Modify: `frontend/tests/workflowReadinessUi.contract.ts`
- Modify: `backend/src/integrationGateway/workflowPolicy.ts`
- Modify: `backend/tests/workflowPolicy.test.ts`

**Interfaces:**
- Produces:
  - Template metadata for all five new workflows.
  - Dashboard blocker actions for GitHub and Google Workspace.
  - Approval policy that requires review for these workflow-pack deliveries.
- Consumes:
  - `WorkflowTemplateDefinition.requiredIntegrationIds`
  - `WorkflowTemplateDefinition.optionalIntegrationIds`
  - `WorkflowTemplateDefinition.firstRunRequiresApproval`

- [ ] **Step 1: Add failing template contract assertions**

Append to `frontend/tests/workflowTemplates.contract.ts`:

```ts
const weeklyFounderBrief = getWorkflowTemplateById('weekly-founder-brief');
assert(Boolean(weeklyFounderBrief), 'Weekly founder brief template exists');
assert(
  JSON.stringify(weeklyFounderBrief?.requiredIntegrationIds) === JSON.stringify(['stripe', 'github', 'gmail', 'google_calendar']),
  'Weekly founder brief declares required founder-pack integrations',
);
assert(
  weeklyFounderBrief?.optionalIntegrationIds?.includes('google_drive'),
  'Weekly founder brief declares Drive optional',
);

const investorFollowUp = getWorkflowTemplateById('investor-follow-up');
assert(
  JSON.stringify(investorFollowUp?.requiredIntegrationIds) === JSON.stringify(['gmail', 'google_calendar']),
  'Investor follow-up declares Gmail and Calendar requirements',
);

const monthlyInvestorUpdate = getWorkflowTemplateById('monthly-investor-update');
assert(
  JSON.stringify(monthlyInvestorUpdate?.requiredIntegrationIds) === JSON.stringify(['stripe', 'github', 'google_drive']),
  'Monthly investor update declares Stripe GitHub and Drive requirements',
);

const shippingRevenuePulse = getWorkflowTemplateById('shipping-revenue-pulse');
assert(Boolean(shippingRevenuePulse), 'Shipping and Revenue Pulse template exists');
assert(
  JSON.stringify(shippingRevenuePulse?.requiredIntegrationIds) === JSON.stringify(['stripe', 'github']),
  'Shipping and Revenue Pulse declares Stripe and GitHub requirements',
);

const boardPacketPrep = getWorkflowTemplateById('board-packet-prep');
assert(Boolean(boardPacketPrep), 'Board Packet Prep template exists');
assert(
  JSON.stringify(boardPacketPrep?.requiredIntegrationIds) === JSON.stringify(['google_drive', 'google_calendar']),
  'Board Packet Prep declares Drive and Calendar requirements',
);
```

- [ ] **Step 2: Add failing readiness UI blocker assertions**

Append to `frontend/tests/workflowReadinessUi.contract.ts`:

```ts
const githubAction = getDashboardReadinessBlockerAction({ key: 'github', route: '/settings#integration-github' });
assert(githubAction?.kind === 'navigate', 'GitHub blocker maps to navigation');
assert(githubAction?.kind === 'navigate' && githubAction.href === '/settings#integration-github', 'GitHub blocker points to settings anchor');

const gmailAction = getDashboardReadinessBlockerAction({ key: 'gmail', route: '/integrations?provider=gmail&workflow=investor-follow-up' });
assert(gmailAction?.kind === 'navigate', 'Gmail blocker maps to navigation');
assert(gmailAction?.kind === 'navigate' && gmailAction.href === '/integrations?provider=gmail&workflow=investor-follow-up', 'Gmail blocker preserves partner setup route');

const driveAction = getDashboardReadinessBlockerAction({ key: 'google_drive', route: '/integrations?provider=google_drive&workflow=board-packet-prep' });
assert(driveAction?.kind === 'navigate', 'Drive blocker maps to navigation');
assert(driveAction?.kind === 'navigate' && driveAction.href.includes('provider=google_drive'), 'Drive blocker points to Drive setup');
```

- [ ] **Step 3: Add failing workflow policy assertion**

Append to `backend/tests/workflowPolicy.test.ts`:

```ts
test('founder workflow pack deliveries require approval', () => {
  for (const workflowId of ['weekly-founder-brief', 'investor-follow-up', 'monthly-investor-update', 'shipping-revenue-pulse', 'board-packet-prep']) {
    assert.equal(
      isWorkflowDeliveryApprovalRequired({
        workflowId,
        notify: '',
        step: {
          kind: 'deliver',
          title: 'Deliver workflow output',
          objective: 'Send the reviewed workflow output.',
          inputs: {},
          deliveryTarget: { channel: 'slack', target: '#all-purple-orange' },
        },
      }),
      true,
      `${workflowId} requires approval`,
    );
  }
});
```

- [ ] **Step 4: Run tests and verify failure**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx ts-node tests/workflowTemplates.contract.ts
npx ts-node tests/workflowReadinessUi.contract.ts

cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowPolicy.test.ts
```

Expected: template metadata/new templates/blocker mappings/approval policy are missing.

- [ ] **Step 5: Update existing template metadata**

In `frontend/src/content/workflowTemplates.ts`, update `weekly-founder-brief`:

```ts
integrations: ['Stripe', 'GitHub', 'Gmail', 'Google Calendar', 'Google Drive', 'Web search'],
requiredIntegrationIds: ['stripe', 'github', 'gmail', 'google_calendar'],
optionalIntegrationIds: ['google_drive', 'web_search'],
firstRunRequiresApproval: true,
```

Add these steps between GitHub and market scan:

```ts
{ kind: 'query', title: 'Review Gmail commitments', objective: 'Find founder-critical follow-ups, investor/customer commitments, and unanswered priority threads.', inputs: { source: 'gmail', query_type: 'commitments' } },
{ kind: 'query', title: 'Review calendar commitments', objective: 'Review upcoming meetings, deadlines, and relationship commitments for the next seven days.', inputs: { source: 'google_calendar', query_type: 'weekly_commitments' } },
{ kind: 'query', title: 'Scan Drive source material', objective: 'Find recently changed investor, customer, and board source files that should inform the brief.', inputs: { source: 'google_drive', query_type: 'recent_docs' } },
```

Update `investor-follow-up`:

```ts
integrations: ['Gmail', 'Google Calendar', 'Google Drive'],
requiredIntegrationIds: ['gmail', 'google_calendar'],
optionalIntegrationIds: ['google_drive'],
firstRunRequiresApproval: true,
```

Use stable source ids:

```ts
inputs: { source: 'gmail', query_type: 'commitments' }
inputs: { source: 'google_calendar', query_type: 'weekly_commitments' }
```

Update `monthly-investor-update`:

```ts
integrations: ['Stripe', 'GitHub', 'Google Drive', 'Gmail'],
requiredIntegrationIds: ['stripe', 'github', 'google_drive'],
optionalIntegrationIds: ['gmail'],
firstRunRequiresApproval: true,
```

Add Drive and optional Gmail query steps:

```ts
{ kind: 'query', title: 'Collect investor source docs', objective: 'Find source docs, metrics notes, and materials for the monthly investor update.', inputs: { source: 'google_drive', query_type: 'investor_materials' } },
{ kind: 'query', title: 'Review investor email threads', objective: 'Find open investor questions and promised updates that should shape the monthly update.', inputs: { source: 'gmail', query_type: 'investor_threads' } },
```

- [ ] **Step 6: Add two new templates**

In `WORKFLOW_TEMPLATES`, add `shipping-revenue-pulse`:

```ts
{
  id: 'shipping-revenue-pulse',
  slug: 'shipping-revenue-pulse',
  title: 'Shipping and revenue pulse',
  category: 'Revenue & risk',
  outcome: 'A weekly read on whether product delivery and revenue movement are reinforcing each other.',
  cadence: 'every friday at 3pm',
  destination: 'slack',
  notify: '#all-purple-orange',
  integrations: ['Stripe', 'GitHub', 'Web search'],
  requiredIntegrationIds: ['stripe', 'github'],
  optionalIntegrationIds: ['web_search'],
  firstRunRequiresApproval: true,
  description: 'Combine Stripe movement with GitHub delivery signals to surface growth, execution, and reliability risks before the weekly review.',
  steps: [
    { kind: 'query', title: 'Pull Stripe revenue pulse', objective: 'Read MRR movement, failed payments, churn, and expansion signals from Stripe.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'query', title: 'Read GitHub delivery risk', objective: 'Read merged PRs, open issues, stale reviews, and blocker labels from GitHub.', inputs: { source: 'github', query_type: 'delivery_risk' } },
    { kind: 'analyze', title: 'Compare shipping and revenue signals', objective: 'Identify whether product delivery is creating, protecting, or risking revenue momentum.' },
    { kind: 'summarize', title: 'Draft shipping and revenue pulse', objective: 'Write a concise founder pulse with signal, risk, and next action.' },
    { kind: 'deliver', title: 'Hold for approval and deliver', objective: 'Send the reviewed shipping and revenue pulse after approval.', inputs: { approval_required: true }, deliveryTarget: { channel: 'slack', target: '#all-purple-orange' } },
  ],
}
```

Add `board-packet-prep`:

```ts
{
  id: 'board-packet-prep',
  slug: 'board-packet-prep',
  title: 'Board packet prep',
  category: 'Operating cadence',
  outcome: 'A source-linked board packet draft and open-questions list before the meeting.',
  cadence: 'every month on monday at 9am',
  destination: 'email',
  notify: '',
  integrations: ['Google Drive', 'Google Calendar', 'Stripe', 'GitHub'],
  requiredIntegrationIds: ['google_drive', 'google_calendar'],
  optionalIntegrationIds: ['stripe', 'github'],
  firstRunRequiresApproval: true,
  description: 'Prepare board materials from selected documents, meeting context, revenue movement, and shipping state for founder review.',
  steps: [
    { kind: 'query', title: 'Collect board packet sources', objective: 'Find board docs, investor materials, and recently changed packet source files.', inputs: { source: 'google_drive', query_type: 'board_packet_sources' } },
    { kind: 'query', title: 'Review board calendar context', objective: 'Find upcoming board meetings, prep deadlines, and recent meeting context.', inputs: { source: 'google_calendar', query_type: 'upcoming_meetings' } },
    { kind: 'query', title: 'Pull Stripe board metrics', objective: 'Read revenue movement and failed-payment signals for the board packet.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
    { kind: 'query', title: 'Read GitHub delivery state', objective: 'Read shipping progress and open delivery risk from GitHub.', inputs: { source: 'github', query_type: 'delivery_risk' } },
    { kind: 'summarize', title: 'Draft board packet outline', objective: 'Draft a source-linked board packet outline with metrics, wins, risks, decisions, and open questions.' },
  ],
}
```

If the schedule parser cannot support `"every month on monday at 9am"`, use `cadence: 'every monday at 9am'` for now and keep the title/description monthly.

- [ ] **Step 7: Route blockers in frontend readiness UI**

In `frontend/src/features/integrations/workflowReadinessUi.ts`, add after the Stripe branch:

```ts
  if (blocker.key === 'github' || blocker.route?.includes('integration-github')) {
    return {
      kind: 'navigate',
      label: 'Open GitHub settings',
      href: blocker.route || '/settings#integration-github',
    };
  }

  if (
    blocker.key === 'gmail' ||
    blocker.key === 'google_calendar' ||
    blocker.key === 'google_drive' ||
    blocker.route?.includes('/integrations?provider=')
  ) {
    return {
      kind: 'navigate',
      label: blocker.key === 'google_calendar'
        ? 'Connect Calendar'
        : blocker.key === 'google_drive'
          ? 'Connect Drive'
          : 'Connect Gmail',
      href: blocker.route || '/integrations',
    };
  }
```

- [ ] **Step 8: Expand workflow approval policy**

In `backend/src/integrationGateway/workflowPolicy.ts`, add:

```ts
const REVIEW_GATED_WORKFLOWS = new Set([
  'revenue-watch',
  'weekly-founder-brief',
  'investor-follow-up',
  'monthly-investor-update',
  'shipping-revenue-pulse',
  'board-packet-prep',
]);
```

Change the final return in `isWorkflowDeliveryApprovalRequired` to:

```ts
  return REVIEW_GATED_WORKFLOWS.has(input.workflowId) && Boolean(delivery);
```

This keeps explicit approval metadata working for all workflows and review-gates the new pack.

- [ ] **Step 9: Run tests and build check**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/frontend
npx ts-node tests/workflowTemplates.contract.ts
npx ts-node tests/workflowReadinessUi.contract.ts
npm run build

cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/workflowPolicy.test.ts
npm run build
```

Expected: all pass.

- [ ] **Step 10: Commit Task 7**

```bash
git add frontend/src/content/workflowTemplates.ts frontend/src/features/integrations/workflowReadinessUi.ts frontend/tests/workflowTemplates.contract.ts frontend/tests/workflowReadinessUi.contract.ts backend/src/integrationGateway/workflowPolicy.ts backend/tests/workflowPolicy.test.ts
git commit -m "feat(workflows): ship founder workflow pack templates"
```

---

### Task 8: Staging Smoke and PR Handoff

**Files:**
- Modify: pull request description only after smoke evidence exists.
- Do not commit environment files, smoke temp dirs, or credentials.

**Interfaces:**
- Produces:
  - Smoke evidence for readiness, gateway reads, approval gate, delivery, and ledger.
- Consumes:
  - Existing VPS/staging backend path from the Revenue Watch smoke process.
  - Existing Slack delivery setup where available.

- [ ] **Step 1: Run full focused validation locally**

Run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
node --test -r ts-node/register tests/workflowIdentity.test.ts
node --test -r ts-node/register tests/workflowReadiness.test.ts
node --test -r ts-node/register tests/nativeGithub.test.ts
node --test -r ts-node/register tests/partnerGoogleWorkspace.test.ts
node --test -r ts-node/register tests/queryDataGateway.test.ts
node --test -r ts-node/register tests/approvalLedger.test.ts
node --test -r ts-node/register tests/workflowPolicy.test.ts
npm run build

cd /Users/maximisto/Documents/New\ project/frontend
npx ts-node tests/workflowTemplates.contract.ts
npx ts-node tests/workflowReadinessUi.contract.ts
npm run build

cd /Users/maximisto/Documents/New\ project
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Smoke missing-readiness behavior**

Against staging or an isolated local backend, request:

```bash
curl -sS "http://127.0.0.1:8000/api/workflows/weekly-founder-brief/readiness?workspaceId=purpleorangehq&deliveryTarget=%23all-purple-orange" | jq .
curl -sS "http://127.0.0.1:8000/api/workflows/investor-follow-up/readiness?workspaceId=purpleorangehq" | jq .
curl -sS "http://127.0.0.1:8000/api/workflows/board-packet-prep/readiness?workspaceId=purpleorangehq" | jq .
```

Expected: missing required providers return blockers with exact routes:

```txt
/settings#integration-github
/integrations?provider=gmail&workflow=weekly-founder-brief
/integrations?provider=google_calendar&workflow=weekly-founder-brief
/integrations?provider=google_drive&workflow=board-packet-prep
```

- [ ] **Step 3: Smoke GitHub live read**

Use a test workspace with a GitHub token and a scoped repository:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node -r ts-node/register <<'NODE'
const { executeQueryData } = require('./src/integrationGateway/queryData');

(async () => {
  const result = await executeQueryData({
    workspaceId: process.env.SMOKE_WORKSPACE_ID || 'purpleorangehq',
    source: 'github',
    queryType: 'delivery_risk',
    filters: { repository: process.env.GITHUB_DEFAULT_REPOSITORY || 'maximisto/violema' },
  });
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Expected:

```txt
ok=true
source=github
query_type=delivery_risk
live=true
data.repository=maximisto/violema
```

The payload must not include code contents, patch, diff, secrets, or workflow env values.

- [ ] **Step 4: Smoke Google Workspace missing connection**

If Google partner connections are not configured, run:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node -r ts-node/register <<'NODE'
const { executeQueryData } = require('./src/integrationGateway/queryData');

(async () => {
  const result = await executeQueryData({
    workspaceId: process.env.SMOKE_WORKSPACE_ID || 'purpleorangehq',
    source: 'gmail',
    queryType: 'commitments',
    connectedPartnerApps: [],
  });
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Expected:

```txt
ok=false
code=integration_not_ready
source=gmail
nextAction.route=/integrations?provider=gmail&workflow=weekly-founder-brief
```

- [ ] **Step 5: Smoke Google Workspace live reads when credentials exist**

If partner credentials are connected, run the three reads:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node -r ts-node/register <<'NODE'
const { listConnectedApps } = require('./src/composioBridge');
const { executeQueryData } = require('./src/integrationGateway/queryData');

(async () => {
  const workspaceId = process.env.SMOKE_WORKSPACE_ID || 'purpleorangehq';
  const connectedPartnerApps = await listConnectedApps({ entityId: workspaceId });
  for (const [source, queryType] of [
    ['gmail', 'commitments'],
    ['google_calendar', 'weekly_commitments'],
    ['google_drive', 'recent_docs'],
  ]) {
    const result = await executeQueryData({ workspaceId, source, queryType, connectedPartnerApps });
    console.log(JSON.stringify({ source, result }, null, 2));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Expected:

```txt
ok=true
live=true
data.total is a number
data.items contain ids and safe summaries only
```

If the partner action names are wrong, record the exact error and update only the action map in `partnerGoogleWorkspace.ts`.

- [ ] **Step 6: Smoke full workflow review gate**

Create or trigger a `shipping-revenue-pulse` automation with:

```json
{
  "workflowId": "shipping-revenue-pulse",
  "templateId": "shipping-revenue-pulse",
  "name": "Shipping and revenue pulse",
  "schedule": "every friday at 3pm",
  "notify": "#all-purple-orange",
  "steps": [
    { "id": "step_stripe", "kind": "query", "title": "Pull Stripe revenue pulse", "objective": "Read revenue movement.", "inputs": { "source": "stripe", "query_type": "revenue_summary" } },
    { "id": "step_github", "kind": "query", "title": "Read GitHub delivery risk", "objective": "Read delivery risk.", "inputs": { "source": "github", "query_type": "delivery_risk", "filters": { "repository": "maximisto/violema" } } },
    { "id": "step_summary", "kind": "summarize", "title": "Draft pulse", "objective": "Draft the pulse." },
    { "id": "step_deliver", "kind": "deliver", "title": "Hold for approval and deliver", "objective": "Deliver after approval.", "inputs": { "approval_required": true }, "deliveryTarget": { "channel": "slack", "target": "#all-purple-orange" } }
  ]
}
```

Expected:

```txt
review gate appears before Slack delivery
approval_required=true
delivery.status=waiting_review
```

- [ ] **Step 7: Smoke approval and ledger**

Approve the pending review through the existing automation review endpoint, then fetch:

```bash
curl -sS "http://127.0.0.1:8000/api/workflows/runs/<taskRunId>/ledger?workspaceId=purpleorangehq" | jq .
```

Expected ledger event types include:

```txt
data_read for stripe
data_read for github
draft_created
approval_requested
approval_granted
external_action_executed
```

Check every `data_read.metadata` object. It may include `source`, `queryType`, `resultCount`, `window`, `live`, and `providerRoute`. It must not include raw email bodies, full Drive text, GitHub diffs, patches, code contents, or secrets.

- [ ] **Step 8: Update PR body**

Use this structure in the PR description:

```md
## Summary
- Adds GitHub, Gmail, Calendar, and Drive as workflow-ready sources.
- Persists workflow/template identity for template-created automations.
- Adds founder workflow readiness rules, safe source-read ledger metadata, and review-gated delivery.

## Validation
- `node --test -r ts-node/register tests/integrationRegistry.test.ts tests/settingsStore.test.ts tests/workflowIdentity.test.ts tests/workflowReadiness.test.ts tests/nativeGithub.test.ts tests/partnerGoogleWorkspace.test.ts tests/queryDataGateway.test.ts tests/approvalLedger.test.ts tests/workflowPolicy.test.ts`
- `cd backend && npm run build`
- `cd frontend && npm run build`
- Staging smoke: readiness, GitHub read, Google Workspace read or readiness error, review gate, approval, ledger.

## Risks / follow-ups
- Google Workspace action names are isolated in `partnerGoogleWorkspace.ts`; adjust there if Composio names differ in staging.
- GitHub reads require a scoped repository through filters or `GITHUB_DEFAULT_REPOSITORY`.
- Gmail sending, Drive mutation, and GitHub writes remain outside this read-first pack.
```

- [ ] **Step 9: Commit any smoke-script or doc-only changes**

Only commit if code/docs changed during smoke. Use a focused message:

```bash
git add <changed-files>
git commit -m "test(workflows): document founder pack smoke"
```

Do not commit local environment files, generated ledgers, `automations.json`, `workspace-settings.json`, temp clones, or captured credentials.

---

## Final Validation Matrix

Run before requesting review:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
node --test -r ts-node/register tests/workflowIdentity.test.ts
node --test -r ts-node/register tests/workflowReadiness.test.ts
node --test -r ts-node/register tests/nativeGithub.test.ts
node --test -r ts-node/register tests/partnerGoogleWorkspace.test.ts
node --test -r ts-node/register tests/queryDataGateway.test.ts
node --test -r ts-node/register tests/approvalLedger.test.ts
node --test -r ts-node/register tests/workflowPolicy.test.ts
npm run build

cd /Users/maximisto/Documents/New\ project/frontend
npx ts-node tests/workflowTemplates.contract.ts
npx ts-node tests/workflowReadinessUi.contract.ts
npm run build

cd /Users/maximisto/Documents/New\ project
git diff --check
```

Expected: all tests and builds pass.

---

## Self-Review

**Spec coverage:** Covered integration definitions, query contracts, readiness rules, data flow, ledger metadata, frontend settings/integrations/templates/dashboard routing, backend adapters, error handling, security boundaries, validation, rollout, and success criteria.

**Placeholder scan:** Passed. Partner action names are isolated in a map with smoke instructions for correction.

**Type consistency:** Backend source ids are `gmail`, `google_calendar`, and `google_drive`; aliases normalize `email`, `calendar`, and `drive` at the gateway only. Workflow/template ids use camel-cased record fields `workflowId` and `templateId`, while `workflowPolicy.ts` continues accepting snake-case legacy ids.
