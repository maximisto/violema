# Google Workspace and GitHub Workflow Pack Design

**Date:** 2026-06-30
**Goal:** Turn the Revenue Watch trust loop into a broader founder operating pack by adding Gmail, Google Calendar, Google Drive, and GitHub as workflow-ready sources behind readiness checks, approval gates, and run ledger events.

## Problem

PR #2 proves the core trust contract:

- real source data beats mock data
- readiness must happen before run
- external writes need approval
- every meaningful read, draft, approval, and delivery needs a ledger event

The next credibility gap is breadth. Violema already talks like it can build founder briefs across revenue, delivery, email, calendar, and files. The templates reference GitHub, email, calendar, and Drive-like work, but only Stripe has been made real in the workflow gateway.

The next move is not "add four connectors." It is a workflow pack that can answer founder-grade questions using the systems founders actually live in:

- What shipped?
- Who needs a reply?
- What meetings or commitments are coming up?
- What documents should be reviewed before the next investor, customer, or board interaction?

## Approved Direction

Build the next pack as:

**Google Workspace + GitHub -> founder workflow sources -> deterministic/readiness-safe summaries -> approval-gated delivery -> run ledger**

This pack includes:

- GitHub
- Gmail
- Google Calendar
- Google Drive

Google Workspace operational access stays separate from Google/Microsoft login. Existing normal-user OAuth and admin recovery flows remain identity/auth paths. This pack is for workspace data access.

## Product Shape

The user-facing promise:

> Connect the systems founders already operate from, then let Violema prepare the brief, queue, packet, or pulse with evidence, approval, and a ledger.

Initial workflows:

- **Weekly founder brief**
  - Reads Stripe, GitHub, Gmail, Calendar, Drive, and web search.
  - Produces a reviewed Monday operating brief.
- **Investor follow-up queue**
  - Reads Gmail, Calendar, and Drive.
  - Produces prioritized follow-ups, promised materials, and meeting prep.
- **Monthly investor update**
  - Reads Stripe, GitHub, Drive, and Gmail.
  - Drafts a founder-reviewed investor update.
- **Shipping and revenue pulse**
  - Reads Stripe and GitHub.
  - Produces a weekly signal on revenue movement and product delivery risk.
- **Board packet prep**
  - Reads Drive, Calendar, Stripe, and GitHub.
  - Produces a source-linked board packet draft and open-questions list.

## Strategic Point

This should make Violema feel less like "AI with integrations" and more like a founder operations layer.

The wedge is:

> Violema prepares the operating surface founders should have had before the meeting, update, or decision.

The commercially useful demo is not a connector screen. It is:

1. Connect Stripe, GitHub, Gmail, Calendar, and Drive.
2. Pick "Weekly founder brief" or "Investor follow-up queue."
3. See readiness and exact read/write boundaries.
4. Run a sandbox preview.
5. Approve the draft.
6. Send to Slack or email.
7. Inspect the ledger.

## Non-Goals

- No broad OAuth marketplace rewrite in this slice.
- No replacement of Google/Microsoft auth login flows.
- No automatic Gmail sending without explicit approval.
- No Drive document mutation in the first pass.
- No GitHub writes except approved issue creation, and only after the read path is proven.
- No inbox-wide exports or broad Drive crawling by default.
- No "all Google data" claim; scopes and workflow source filters must be explicit.
- No database migration unless JSON-backed storage blocks a required contract.

## Recommended Architecture

Use a **connector-first, native-normalized** architecture.

That means:

- Use the existing Composio-style connector path where OAuth coverage exists.
- Normalize each provider result into Violema-owned gateway DTOs.
- Keep workflow readiness, run ledger, approval, and UI behavior owned by Violema.
- Do not let provider-specific payloads leak into workflow templates or mission UI.

Why this is the right tradeoff now:

- It avoids spending weeks on Google OAuth and GitHub OAuth before the workflow value is proven.
- It lets us validate founder workflows quickly.
- It preserves a future path to native OAuth for the highest-value integrations.
- It keeps the trust layer proprietary and product-defining.

## Integration Definitions

Extend `backend/src/integrationRegistry.ts` with:

- `gmail`
- `google_calendar`
- `google_drive`

GitHub already exists as a manual core integration. Keep it core, but upgrade its gateway behavior.

Recommended provider metadata:

### GitHub

- Category: `core`
- Method: manual token first, partner OAuth when available
- Read capabilities:
  - repositories
  - issues
  - pull requests
  - review state
  - release tags
- Write capabilities:
  - create issue only after approval
- Boundaries:
  - no repo deletion
  - no secret/code exfiltration
  - no workflow/environment variable reads
  - no commits, branch deletion, or release mutation in this pack

### Gmail

- Category: `core`
- Method: partner OAuth first
- Read capabilities:
  - search recent threads
  - identify unreplied threads
  - extract commitments and promised materials
  - summarize selected threads
- Write capabilities:
  - draft replies later; no send in first implementation unless explicitly approved
- Boundaries:
  - default query windows are narrow
  - no bulk export
  - no sending without approval
  - sensitive thread snippets should be summarized in ledger, not dumped verbatim

### Google Calendar

- Category: `core`
- Method: partner OAuth first
- Read capabilities:
  - upcoming meetings
  - recently completed meetings
  - attendee and title metadata
  - commitment/deadline extraction from event context
- Write capabilities:
  - none in first implementation
- Boundaries:
  - no event creation or edits
  - no attendee spam
  - no broad historical calendar scan by default

### Google Drive

- Category: `core`
- Method: partner OAuth first
- Read capabilities:
  - search selected docs/files
  - read allowed document text/metadata
  - identify recently changed investor/customer/board files
- Write capabilities:
  - draft file creation later; no mutation in first implementation
- Boundaries:
  - no broad Drive crawl by default
  - no permission changes
  - no file deletion
  - no raw large-document dumping into Slack/email

## Query Gateway

Extend `backend/src/integrationGateway/queryData.ts` to route new source/query pairs.

Initial query contracts:

```ts
source: 'github'
query_type: 'delivery_risk' | 'open_issues' | 'merged_prs'
```

```ts
source: 'gmail' | 'email'
query_type: 'commitments' | 'unreplied_threads' | 'investor_threads'
```

```ts
source: 'calendar'
query_type: 'weekly_commitments' | 'upcoming_meetings' | 'recent_meetings'
```

```ts
source: 'drive'
query_type: 'recent_docs' | 'investor_materials' | 'board_packet_sources'
```

Each gateway result should include:

- `ok`
- `source`
- `query_type`
- `live`
- `workspaceId`
- `fetched_at`
- `latency_ms`
- `data`
- `warnings`
- `nextAction` when not ready

Each missing credential or unconnected provider returns:

```ts
{
  ok: false,
  code: 'integration_not_ready',
  source: '<source>',
  workflowId: '<workflow-id>',
  message: '<plain-language blocker>',
  nextAction: {
    label: 'Connect <Provider>',
    route: '/integrations?provider=<provider>&workflow=<workflow-id>'
  }
}
```

No new source in this pack should silently fall back to fake data once it is marked required by a workflow.

## Workflow Readiness

Extend `backend/src/integrationGateway/workflowReadiness.ts` so readiness is workflow-specific, not connector-generic.

Initial required integrations:

### `weekly-founder-brief`

- Required:
  - `stripe`
  - `github`
  - `gmail`
  - `google_calendar`
- Optional:
  - `google_drive`
  - web search
- First run requires approval: true

### `investor-follow-up`

- Required:
  - `gmail`
  - `google_calendar`
- Optional:
  - `google_drive`
- First run requires approval: true

### `monthly-investor-update`

- Required:
  - `stripe`
  - `github`
  - `google_drive`
- Optional:
  - `gmail`
- First run requires approval: true

### `shipping-revenue-pulse`

- Required:
  - `stripe`
  - `github`
- Optional:
  - web search
- First run requires approval: true

### `board-packet-prep`

- Required:
  - `google_drive`
  - `google_calendar`
- Optional:
  - `stripe`
  - `github`
- First run requires approval: true

Readiness blockers should point to real setup surfaces:

- GitHub: `/settings#integration-github`
- Gmail: `/integrations?provider=gmail&workflow=<workflow-id>`
- Calendar: `/integrations?provider=google_calendar&workflow=<workflow-id>`
- Drive: `/integrations?provider=google_drive&workflow=<workflow-id>`

## Data Flow

1. Founder selects a workflow template.
2. Frontend asks the readiness endpoint for that workflow.
3. Backend checks workspace/server/partner connection state.
4. UI shows:
   - ready sources
   - missing required sources
   - optional enhancements
   - approval policy
5. User runs a sandbox preview.
6. Gateway reads each source through native/manual credentials or partner connector.
7. Each successful read records `data_read`.
8. Each missing or failed connector records `connector_failed`.
9. Violema drafts a summary or queue.
10. Delivery is held at a review gate.
11. User approves, requests changes, or rejects.
12. Approved output is sent to Slack/email.
13. Ledger records approval and delivery.

## Ledger Events

Reuse existing event types and add provider metadata:

- `data_read`
- `connector_failed`
- `draft_created`
- `approval_requested`
- `approval_granted`
- `approval_denied`
- `external_action_executed`

Every `data_read` event should include safe metadata:

- `source`
- `queryType`
- `resultCount`
- `window`
- `live`
- `providerRoute`

Do not store raw email bodies, full document text, or large GitHub payloads in ledger metadata. Store IDs, counts, summaries, and redacted excerpts only when useful.

## Frontend Changes

### Settings

Extend `frontend/src/pages/SettingsPage.tsx`:

- Add Gmail, Google Calendar, and Google Drive integration rows.
- Add anchors:
  - `integration-gmail`
  - `integration-google-calendar`
  - `integration-google-drive`
- Keep GitHub anchor behavior consistent with Stripe.

### Integrations Page

Extend `frontend/src/pages/IntegrationsPage.tsx`:

- Show Google Workspace as a workflow pack, not a generic "Google" tile.
- Present Gmail, Calendar, and Drive as separate permission surfaces.
- Show partner OAuth status when available.
- Keep copy grounded: "connect for this workflow" rather than "unlock everything."

### Workflow Templates

Update `frontend/src/content/workflowTemplates.ts`:

- Add required/optional integration metadata to:
  - `weekly-founder-brief`
  - `investor-follow-up`
  - `monthly-investor-update`
- Add new templates if needed:
  - `shipping-revenue-pulse`
  - `board-packet-prep`

### Dashboard

Reuse the existing readiness panel:

- Missing GitHub should route to `/settings#integration-github`.
- Missing Gmail/Calendar/Drive should route to `/integrations?provider=...`.
- Approval copy should explain that Gmail/Drive outputs are drafts until approved.

## Backend Changes

Create adapters:

- `backend/src/integrationGateway/adapters/nativeGithub.ts`
  - manual token support
  - repository issue/PR query helpers
  - no write path in the first read-only pass
- `backend/src/integrationGateway/adapters/partnerGoogleWorkspace.ts`
  - connector action wrapper for Gmail, Calendar, and Drive
  - normalizes partner payloads into Violema DTOs
  - handles unconnected app errors as `integration_not_ready`

Modify:

- `backend/src/integrationRegistry.ts`
- `backend/src/settingsStore.ts` via registry only
- `backend/src/integrationGateway/queryData.ts`
- `backend/src/integrationGateway/workflowReadiness.ts`
- `backend/src/server.ts` only where tool execution and routes require it
- `backend/src/composioBridge.ts` only if app-name mapping or error normalization is missing

## Error Handling

Provider errors should be boring and inspectable.

- Missing connection: `integration_not_ready`
- Expired/revoked OAuth: `integration_auth_expired`
- Scope missing: `integration_scope_missing`
- Rate limit: `integration_rate_limited`
- Provider outage: `integration_unavailable`
- Unsupported query: `unsupported_query`

Workflow behavior:

- Required source missing: block run before starting.
- Optional source missing: warn and continue.
- Required source fails during run: block delivery and record `connector_failed`.
- System-generated summary degrades: deterministic summary can proceed to review.
- External write fails: block completion and keep the run reviewable.

## Security Boundaries

Google Workspace and GitHub are more sensitive than Stripe revenue summaries.

Rules:

- Read only by default.
- Prefer narrow query windows.
- Never store full raw email bodies or Drive docs in ledger.
- Never send Gmail messages without explicit approval.
- Never mutate Drive files in this pack.
- Never read repository secrets or workflow environment variables.
- Never create GitHub issues without approval.
- Make all provider writes visible in the review gate before execution.

## Testing

Backend tests:

- `integrationRegistry.test.ts`
  - Gmail, Calendar, Drive definitions exist with fields/boundaries.
- `settingsStore.test.ts`
  - Google Workspace credentials show configured state through registry fields.
- `queryDataGateway.test.ts`
  - GitHub route returns real-normalized payload or readiness error.
  - Gmail/Calendar/Drive routes return normalized partner payloads or readiness errors.
  - Required sources do not fall back to fake data.
- `workflowReadiness.test.ts`
  - Weekly Founder Brief, Investor Follow-up, Monthly Investor Update, Shipping/Revenue Pulse, and Board Packet readiness rules are correct.
- `approvalLedger.test.ts`
  - New provider reads record safe ledger metadata.
- `workflowPolicy.test.ts`
  - Google Workspace/GitHub workflows requiring approval keep approval gates.

Frontend tests:

- `workflowTemplates.contract.ts`
  - templates declare required/optional integrations.
- `workflowReadinessUi.contract.ts`
  - blockers route to the right setup screens.
- Settings/UI tests if existing harness supports them:
  - Gmail/Calendar/Drive rows render and accept connection state.

Validation commands:

```bash
cd /Users/maximisto/Documents/New\ project/backend
node --test -r ts-node/register tests/integrationRegistry.test.ts
node --test -r ts-node/register tests/settingsStore.test.ts
node --test -r ts-node/register tests/queryDataGateway.test.ts
node --test -r ts-node/register tests/workflowReadiness.test.ts
node --test -r ts-node/register tests/approvalLedger.test.ts
node --test -r ts-node/register tests/workflowPolicy.test.ts
npm run build

cd /Users/maximisto/Documents/New\ project/frontend
node --test -r ts-node/register tests/workflowTemplates.contract.ts
node --test -r ts-node/register tests/workflowReadinessUi.contract.ts
npm run build

cd /Users/maximisto/Documents/New\ project
git diff --check
```

## Rollout

### Phase 1: Definitions and Readiness

- Add Gmail, Calendar, and Drive registry definitions.
- Add workflow readiness rules for the five templates.
- Update frontend template metadata and readiness routing.
- No live provider calls yet.

### Phase 2: GitHub Read Path

- Add read-only GitHub adapter using manual token credentials.
- Support `delivery_risk`, `open_issues`, and `merged_prs`.
- Record ledger events with safe metadata.

### Phase 3: Google Workspace Partner Read Path

- Add partner connector wrapper for Gmail, Calendar, and Drive.
- Normalize commitment, meeting, and document results.
- Treat missing partner connections as readiness errors.

### Phase 4: Workflow Pack UI

- Update dashboard/readiness panels and integration setup routes.
- Make the templates feel like complete founder workflows.
- Keep Gmail/Drive outputs draft-only.

### Phase 5: Staging Smoke

- Run isolated smoke for:
  - Weekly Founder Brief readiness
  - Investor Follow-up Queue readiness
  - GitHub read
  - Gmail/Calendar/Drive partner read where credentials exist
  - approval gate
  - delivery
  - ledger

## Success Criteria

- Weekly Founder Brief can declare and verify Stripe, GitHub, Gmail, Calendar, and optional Drive readiness.
- Investor Follow-up Queue can declare and verify Gmail/Calendar readiness.
- Monthly Investor Update can declare and verify Stripe/GitHub/Drive readiness.
- GitHub reads no longer come from mock data when required by a workflow.
- Gmail/Calendar/Drive missing connections return structured readiness errors.
- No Gmail send, Drive mutation, or GitHub write occurs without explicit approval.
- Ledger remains useful and safe: source metadata, counts, IDs, and summaries instead of sensitive raw dumps.
- The implementation creates a reusable pattern for future Microsoft 365, Notion, Linear, HubSpot, and Airtable workflow packs.

## Implementation Defaults

- Use a provider alias layer for partner app names. Backend source ids stay stable as `gmail`, `google_calendar`, and `google_drive`; the adapter maps those ids to whatever Composio/partner app names are actually supported.
- Represent Google Workspace as a grouped UI concept with three separate backend providers. This keeps permissions understandable while preserving precise readiness and source metadata.
- Keep GitHub manual-token first in this pack. Partner OAuth can be added behind the same adapter later, but should not block the read path.
- Include typed `workflowId` / `templateId` persistence for new automations created from these templates. Existing inference remains as backward compatibility, but new workflow-pack runs should not depend on text inference.
