# TechChicago Week Demo Integrations Design

**Date:** 2026-07-19
**Event window:** TechChicago Week, July 20–26, 2026
**Event source:** https://gotechchicago.com/week/
**Goal:** Make Violema's Weekly Founder Update run on a frozen set of real, verified integrations before the TechChicago Week demos, with no simulated source data and no uncontrolled external actions.

## Decision

The approved direction combines both strong options:

1. Keep and wire the integrations already verified in production.
2. Add GitHub as the final new pre-demo connector.

After GitHub, the integration scope is frozen until the demos are complete.

The demo integration set is:

- Stripe
- Gmail
- Google Calendar
- Google Drive
- Linear
- GitHub
- Tavily web search
- Slack
- Postmark email

Google and Microsoft sign-in remain part of the product's identity layer, but they are not counted as workflow data integrations in the demo.

The following integrations are explicitly deferred until after the demos:

- Notion
- HubSpot
- Airtable
- Figma
- Vercel
- Microsoft Outlook
- Microsoft Calendar
- Microsoft Teams
- OneDrive / SharePoint
- Salesforce
- Jira
- Intercom
- Zendesk
- custom MCP or customer-specific systems

## Fresh Production Audit

The audit on 2026-07-19 checked real production credentials and performed non-mutating calls without printing user content or secrets.

| Integration | Connection state | Functional state | Demo decision |
| --- | --- | --- | --- |
| Stripe | Native workspace credential configured | Live read passed | Required |
| Gmail | Active Composio account for `purpleorangehq` | Metadata-only fetch passed | Required |
| Google Calendar | Active Composio account for `purpleorangehq` | Seven-day event read passed | Required |
| Google Drive | Active Composio account for `purpleorangehq` | Failed with insufficient OAuth scope | Repair; supporting source |
| Linear | Active Composio account for `purpleorangehq` | Current-user read passed | Required |
| GitHub | Not connected | Current workflow branch is simulated | Connect and make live |
| Tavily web search | Server credential configured | Live search passed | Required |
| Slack | Native bot configured | Target resolution passed | Required primary delivery |
| Postmark email | Server credential configured | Server authentication passed | Supporting fallback delivery |

The existing four Composio accounts are correctly attached to Violema's default workspace entity, `purpleorangehq`.

## Demo Story

The flagship demo remains **Weekly Founder Update**.

The story is:

> Violema reads the operating systems a founder has approved, assembles a source-backed weekly brief, waits for review, and then delivers the approved result with an inspectable record.

The live collection sequence is:

1. Read Stripe revenue, subscription, churn, expansion, and failed-payment signals.
2. Read GitHub delivery activity, open risks, pull requests, and issues.
3. Read Linear delivery status, active work, and blockers.
4. Read Gmail commitment metadata for priority follow-ups without ingesting full message bodies.
5. Read the next seven days of Google Calendar commitments.
6. Read Google Drive file metadata for recently changed operating documents after Drive is reauthorized.
7. Run a Tavily market and competitor scan.
8. Draft one concise founder brief with evidence grouped by source.
9. Hold the draft for explicit human review.
10. Deliver to Slack after approval, with Postmark email available as a fallback.
11. Persist the read, draft, approval, delivery, and failure events in the run ledger.

Google Drive is a supporting source, not a critical-path blocker. If its OAuth scope cannot be repaired before a specific demo, the workflow must disclose that Drive was skipped and continue with the other verified sources. It must not substitute fake Drive data.

## Product Boundaries

### Read-only collection

The demo may:

- read Stripe revenue and risk signals;
- read GitHub repositories, pull requests, issues, commits, and release context;
- read Linear issues, projects, and delivery status;
- read Gmail message metadata needed to identify commitments;
- read Google Calendar event metadata for the next seven days;
- read Google Drive file metadata;
- search the public web through Tavily.

The demo must not:

- send or delete Gmail messages;
- create, update, or delete calendar events;
- change Google Drive files, permissions, comments, or folders;
- create or update Linear issues;
- create or modify GitHub issues, pull requests, repositories, or settings;
- refund charges or modify Stripe billing state;
- post to Slack or send email before approval.

### Data minimization

- Gmail defaults to subject, sender, recipient, time, labels, message ID, and thread ID. Full body content is excluded.
- Google Drive defaults to file name, type, modified time, parent reference, and safe link metadata. File bodies are excluded.
- Calendar collection uses only the demo-relevant time window.
- GitHub and Linear use bounded result limits and workflow-specific read actions.
- Raw provider responses are normalized before they reach the summarization step.
- Secrets, access tokens, provider authorization payloads, and private response dumps never enter logs, artifacts, or prompts.

### External-action control

- Slack and Postmark delivery remain approval-gated.
- The first production run after this change must use sandbox/review mode.
- A failed source creates a visible readiness or connector error.
- A failed source never silently becomes simulated data.

## Architecture

### Curated Composio adapter

Add a focused partner adapter under `backend/src/integrationGateway/adapters/partnerComposio.ts`.

It owns:

- workspace-scoped connection lookup;
- curated read-action execution;
- normalized success and readiness errors;
- bounded timeouts and result limits;
- safe error translation;
- source-specific payload normalization.

The adapter exposes only the actions required by the demo. It does not expose the full Composio catalog to the model.

Initial curated actions:

- Gmail: `GMAIL_FETCH_EMAILS`
- Google Calendar: `GOOGLECALENDAR_EVENTS_LIST_ALL_CALENDARS`
- Google Drive: `GOOGLEDRIVE_FIND_FILE`
- Linear: `LINEAR_SEARCH_ISSUES`
- GitHub identity: `GITHUB_GET_THE_AUTHENTICATED_USER`
- GitHub repository: `GITHUB_GET_A_REPOSITORY`
- GitHub pull requests: `GITHUB_LIST_PULL_REQUESTS`
- GitHub issues: `GITHUB_LIST_REPOSITORY_ISSUES`
- GitHub commits: `GITHUB_LIST_COMMITS`

### Query gateway

Extend `backend/src/integrationGateway/queryData.ts` so these sources route to real adapters:

- `stripe`
- `github`
- `linear`
- `email`
- `calendar`
- `google_drive`

Stripe stays on the native adapter. The other five sources use the curated Composio adapter.

Every result uses the existing integration query contract and declares:

- `ok`
- `source`
- `query_type`
- `live`
- `fetched_at`
- normalized `data`
- safe source evidence

Connection, scope, or provider failures return a structured readiness error with a repair action. The gateway must not return legacy sample payloads for any demo source.

### Readiness

The Weekly Founder Update readiness report checks:

Required:

- Stripe
- Gmail
- Google Calendar
- Linear
- GitHub
- Tavily
- Slack target

Supporting:

- Google Drive
- Postmark email fallback

The UI distinguishes:

- connected and verified;
- connected but missing scope;
- not connected;
- temporarily unavailable;
- ready for sandbox;
- ready for approved delivery.

Provider names may appear. Internal vendor plumbing, environment variable names, API keys, and raw callback details remain out of the normal user experience.

### Workflow definition

Update the backend automation seed and frontend workflow template together.

The canonical source sequence becomes:

1. Stripe
2. GitHub
3. Linear
4. Gmail
5. Google Calendar
6. Google Drive
7. Tavily
8. summarize
9. approval
10. delivery

The backend seed remains the execution source of truth. The frontend template must describe the same sources and boundaries without claiming unsupported behavior.

### Public website integration status

Update the public integrations page so the frozen demo set is visible and accurately labeled.

The page may show an integration as **Active** only when its final production smoke test passes. Until then:

- GitHub is labeled `Connecting`;
- Google Drive is labeled `Needs reauthorization`;
- any provider that fails a fresh functional check is labeled `Unavailable` or removed from the active group.

After final verification, the Active group contains:

- Stripe
- Gmail
- Google Calendar
- Google Drive
- Linear
- GitHub
- Web search
- Slack
- Email

The page must distinguish:

- **Workflow data:** Stripe, Gmail, Google Calendar, Google Drive, Linear, GitHub, and web search;
- **Delivery:** Slack and email;
- **Identity:** Google and Microsoft sign-in.

The public page must not claim that deferred integrations are active. Notion, HubSpot, Airtable, Figma, Vercel, Microsoft workflow-data tools, and other deferred systems remain outside the active group.

## Connection Repairs

### Google Drive

Reauthorize the `purpleorangehq` Google Drive connection with a scope that permits read-only file listing.

Acceptance check:

- `GOOGLEDRIVE_FIND_FILE` with `trashed = false`, a one-item limit, and metadata-only fields returns successfully.

### GitHub

Connect GitHub to Composio under user ID `purpleorangehq`.

The authorization should request only scopes required to read the selected repositories, pull requests, issues, and commits.

Acceptance checks:

- the account appears as active for `purpleorangehq`;
- a read-only identity or repository-list action succeeds;
- a bounded read against the selected demo repository succeeds;
- no write action is included in the curated adapter.

## Error Handling

Each integration failure maps to one of:

- `integration_not_ready`
- `integration_scope_insufficient`
- `integration_query_failed`
- `unsupported_query`

The error includes:

- safe source label;
- concise explanation;
- whether the workflow can continue;
- exact user-facing repair action;
- no provider token, raw authorization response, or private source payload.

Critical-source policy:

- Stripe, GitHub, Gmail, Calendar, Linear, Tavily, or Slack failure blocks the canonical full demo.
- Drive failure degrades the demo and is disclosed.
- Postmark failure removes email fallback but does not block Slack delivery.

## Testing

### Unit and contract tests

- Curated Composio adapter executes only allowlisted read actions.
- Each source uses bounded, privacy-safe arguments.
- Normalizers return stable workflow payloads.
- Missing connection returns `integration_not_ready`.
- Missing Drive scope returns `integration_scope_insufficient`.
- No demo source returns `simulated: true`.
- Weekly Founder Update readiness reflects required and supporting sources.
- Delivery remains approval-gated.
- Backend seed and frontend template contain the same canonical source set.

### Production smoke tests

Without outputting private content:

- Stripe read succeeds.
- Gmail metadata fetch succeeds.
- Calendar seven-day read succeeds.
- Drive metadata search succeeds after reauthorization.
- Linear read succeeds.
- GitHub bounded repository read succeeds after connection.
- Tavily search succeeds.
- Slack target resolution succeeds.
- Postmark authentication succeeds.

### End-to-end demo rehearsal

Run the Weekly Founder Update in production:

1. confirm readiness;
2. collect all required live sources;
3. verify every source artifact says `live: true`;
4. verify no artifact says `simulated: true`;
5. generate the founder brief;
6. stop at review;
7. approve;
8. verify Slack delivery receipt;
9. inspect the run ledger;
10. repeat once from a clean demo session.

## Demo Write-up

Create `docs/products/violema/TECHCHICAGO_WEEK_2026_DEMO_READINESS.md`.

It must contain:

- the frozen integration matrix;
- verified production status and last check time;
- the exact flagship demo script;
- pre-demo checklist;
- expected evidence at each stage;
- failure recovery steps;
- claims Max can make;
- claims Max must not make;
- fallback path if Drive or Postmark is unavailable;
- owner and status for every unresolved item.

## Non-goals

- No new integration beyond the frozen set.
- No Microsoft workflow-data integration before the demos.
- No CRM connector before the demos.
- No generic tool marketplace.
- No autonomous external writes.
- No full-email-body ingestion.
- No Drive document-body ingestion.
- No broad refactor of `server.ts` or `Dashboard.tsx`.
- No replacement of the existing approval, ledger, Slack, Postmark, or Stripe paths.

## Success Criteria

The pre-demo work is complete only when:

- Google Drive has working read scope or is explicitly marked degraded in the runbook;
- GitHub is connected to `purpleorangehq` and passes a bounded read;
- Stripe, Gmail, Calendar, Linear, GitHub, Tavily, Slack, and Postmark pass fresh functional checks;
- the Weekly Founder Update uses live source payloads for every required source;
- no required source returns mock or simulated data;
- the workflow stops for review before delivery;
- approved Slack delivery succeeds and creates a receipt;
- the run ledger explains every read, draft, approval, delivery, and failure;
- backend tests, frontend tests, backend build, frontend build, and diff checks pass;
- production is healthy after deployment;
- the TechChicago Week demo-readiness write-up is current and usable without reading the code.
- the public integrations page lists the frozen demo set as Active only after the corresponding production checks pass.
