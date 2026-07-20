# TechChicago Week 2026 Demo Readiness

**Product:** Violema  
**Event window:** July 20–26, 2026  
**Flagship demo:** Weekly Founder Update  
**Workspace:** `purpleorangehq`  
**Primary delivery:** Slack `#all-purple-orange`  
**Production:** [violema.com](https://violema.com)  
**Current production code:** `571a563e339bf898aa2156aa055a689901b6c393`  
**Last updated:** 2026-07-20 03:44 UTC / 2026-07-19 22:44 CDT

## Executive Status

Violema is ready to demonstrate a real, reviewable founder-operations workflow across the frozen nine-integration set.

- All nine integration paths passed fresh production functional checks.
- The public integrations page renders exactly those nine systems as Active.
- The fixed Purple Orange half-logo is present, stationary, and inset 6 px from the page edge.
- The production workflow collected six live operating-data sources plus Tavily research.
- Every query artifact reported `live: true`.
- No required source returned simulated, mock, synthetic, or demo data.
- The workflow generated a complete founder brief and stopped at review.
- The review ledger contains six `data_read` events, `draft_created`, and `approval_requested`.
- The reviewed brief was delivered exactly once to Slack.
- A dry-run approval resolved the real Slack target and validated the delivery path without sending or changing state.
- Max approved the exact staged artifact for run `run_1784516726967_jl8atr`.
- Slack returned a real delivery receipt and the final ledger is complete.

## Frozen Integration Matrix

Functional checks completed at **2026-07-20 02:37 UTC / 2026-07-19 21:37 CDT**.

| Integration | Role | Production status | Functional evidence | Demo note |
|---|---|---:|---|---|
| Stripe | Workflow data | Active | Live revenue query succeeded | Zero current revenue records is a real result, not sample data |
| Gmail | Workflow data | Active | Three bounded metadata records returned | Metadata only; no message bodies or snippets in normalized output |
| Google Calendar | Workflow data | Active | Seven-day bounded read succeeded | Empty current window is a valid live result |
| Google Drive | Workflow data | Active | Three file-metadata records returned | Custom OAuth scope is `drive.metadata.readonly`; no file bodies |
| Linear | Workflow data | Active | Three bounded delivery records returned | Read-only |
| GitHub | Workflow data | Active | Authenticated bounded repository read succeeded | Read-only; workflow also returned current commits and PRs |
| Tavily web search | Workflow data | Active | Three current research results returned | Live external research |
| Slack | Reviewed delivery | Active | `#all-purple-orange` resolved; dry-run send path passed | Real send requires approval |
| Postmark email | Delivery fallback | Active | Server authentication returned HTTP 200 | Fallback only; no email sent in rehearsal |

Google and Microsoft sign-in are identity providers. They are not counted in the nine workflow-data and delivery integrations.

Deferred systems—Notion, HubSpot, Airtable, Figma, Vercel, and Microsoft Teams—must not be described as Active.

## Production Rehearsal Evidence

### Readiness

The authenticated runtime endpoint reported:

- workflow: `weekly-founder-update`;
- workspace: `purpleorangehq`;
- `ready: true`;
- zero blockers;
- zero warnings;
- first-run approval required;
- delivery target: `#all-purple-orange`.

### Clean production run

| Field | Evidence |
|---|---|
| Run ID | `run_1784516726967_jl8atr` |
| Task ID | `task_1784516726923_gzvq2r` |
| Started | 2026-07-20 03:05:26 UTC / 2026-07-19 22:05:26 CDT |
| Finished | 2026-07-20 03:05:46 UTC / 2026-07-19 22:05:46 CDT |
| Runtime | 19.1 seconds |
| Run status | `succeeded` |
| Task status | `waiting_review` |
| Review required | `true` |
| Step errors | none |
| External actions | zero |
| Simulated-data markers | zero |

The run produced:

- six `query_data` artifacts for Stripe, GitHub, Linear, Gmail, Calendar, and Drive;
- two supporting charts;
- one live Tavily `web_search` artifact;
- one complete summary;
- one `review_gate` artifact targeted to `#all-purple-orange`.

The brief ends cleanly with a `Next actions` section. A preceding rehearsal exposed a 900-token truncation failure. Production now records provider stop reasons, gives founder briefs a 1,400-token output budget, and withholds any provider-truncated draft from review.

### Approval-path verification

The review approval endpoint was called with `dryRun: true`.

- Slack target resolved to `#all-purple-orange`.
- Delivery channel resolved to `slack`.
- The simulated receipt reported a valid delivery path.
- The endpoint would append `approval_granted` and `external_action_executed`.
- The run remained `succeeded` and `reviewRequired: true`.
- The task remained `waiting_review`.
- The ledger remained unchanged.
- No Slack message or email was sent.

### Approved delivery

Max explicitly approved run `run_1784516726967_jl8atr` for `#all-purple-orange`.

| Field | Receipt |
|---|---|
| Artifact SHA-256 | `9f080bcb0cd7fa83e2de900e3cedea875aecb8bd7e75a74bcf6455421d4a5e4c` |
| Artifact length | 5,430 characters |
| Reviewer | Max Markovtsev |
| Reviewed at | 2026-07-20 03:44:19 UTC / 2026-07-19 22:44:19 CDT |
| Delivery status | `delivered` |
| Slack target | `#all-purple-orange` |
| Slack timestamp | `1784519059.952149` |
| Final task status | `completed` |
| Review required | `false` |

The final run ledger contains:

- six `data_read` events;
- one `draft_created`;
- one `approval_requested`;
- one `approval_granted`;
- one `external_action_executed`.

The approval and external-action counts are exactly one each.

## Exact 3–5 Minute Demo

### 0:00–0:40 — Establish the product boundary

Open `/integrations`.

Say:

> Violema is not a connector marketplace. This is one production workflow across nine verified systems: live company signals in, one founder-ready brief out, and explicit approval before anything is sent.

Point out:

- nine Active cards;
- Gmail and Drive metadata-only language;
- Slack as the reviewed primary delivery surface;
- Postmark as fallback;
- identity providers separated from workflow integrations.

### 0:40–1:15 — Show readiness

Sign in to the approved `purpleorangehq` workspace and open the Weekly Founder Update.

Confirm:

- readiness is green;
- no blockers are present;
- delivery target is `#all-purple-orange`;
- approval is required.

Say:

> Readiness is computed from the actual workspace connections. If a required source is missing, the workflow blocks instead of substituting sample data.

### 1:15–2:15 — Run the workflow

Click **Run now** once.

While it runs, explain the bounded reads:

- Stripe revenue;
- GitHub delivery;
- Linear delivery;
- Gmail commitment metadata;
- seven-day Calendar window;
- Drive file metadata;
- Tavily market research.

Do not click Run again. A normal production run should reach review in roughly 20–60 seconds.

### 2:15–3:15 — Inspect the evidence

Open the latest run and show:

- successful source steps;
- `live: true` source artifacts;
- the founder brief;
- review-required status;
- ledger entries for reads, draft, and approval request;
- no delivery receipt yet.

Say:

> This is real operating data. The system separates evidence collection, synthesis, review, and external action so each stage is inspectable.

Do not display raw Gmail or private payloads on a projector. Keep the demo on normalized summaries, source status, and ledger evidence.

### 3:15–4:15 — Demonstrate the human gate

Review the brief. If Max has approved that exact artifact, click **Approve and send** once.

Expected result:

- Slack delivery succeeds to `#all-purple-orange`;
- a delivery receipt appears;
- the task changes from `waiting_review` to completed;
- ledger adds `approval_granted` and `external_action_executed`.

If the artifact has not been approved, stop here and say:

> The external action is deliberately held. That is the product behavior, not a demo limitation.

### 4:15–5:00 — Close on commercial value

Return to the brief and say:

> The value is not another dashboard. Violema turns scattered operating systems into one reviewable decision artifact, with evidence and control built in.

## Exact Click Sequence

1. Open `https://violema.com/integrations`.
2. Confirm the nine Active integration cards.
3. Click **Sign in** and enter the approved workspace.
4. Open **Missions** or **Automations**.
5. Select **Weekly founder update**.
6. Confirm readiness and `#all-purple-orange`.
7. Click **Run now** once.
8. Open the new run when it reaches **Waiting review**.
9. Inspect source steps, summary, review gate, and ledger.
10. Only with artifact-specific approval, click **Approve and send**.
11. Open Slack and show the delivered message.
12. Return to the run and show the stored receipt and final ledger events.

## Evidence Expected at Each Stage

| Stage | Required evidence | Stop condition |
|---|---|---|
| Integrations page | Exactly nine Active workflow/delivery cards | Any deferred card shown Active |
| Readiness | `ready: true`, no blockers, approval required | Any required source missing |
| Collection | Six successful live query artifacts plus Tavily research | `simulated`, `mock`, or required-source failure |
| Draft | Complete brief ending with Next actions | Truncated sentence/table or missing review gate |
| Review | `waiting_review`, zero external actions | Delivery occurs before approval |
| Delivery | Slack receipt and completed task | No receipt, wrong channel, duplicate message |
| Ledger | Reads, draft, approval request, approval grant, external action | Raw private payloads or secrets in ledger |

## Pre-Demo Checklist

Run 30–60 minutes before each demo:

- [ ] Confirm production SHA matches the intended release.
- [ ] Confirm `violema-backend` is online with zero unexpected restarts.
- [ ] Run `nginx -t`.
- [ ] Confirm `/api/health` returns `status: ok`.
- [ ] Confirm `/integrations` returns HTTP 200.
- [ ] Confirm the nine public Active cards render.
- [ ] Sign in to `purpleorangehq` in a fresh browser session.
- [ ] Confirm Weekly Founder Update readiness has no blockers.
- [ ] Confirm Slack app access to `#all-purple-orange`.
- [ ] Confirm no older run is accidentally selected.
- [ ] Close private email/document views before screen sharing.
- [ ] Keep one previously approved successful run available as visual fallback.
- [ ] Do not approve delivery unless the exact visible artifact has been reviewed.

## Release Validation

Completed on 2026-07-19 CDT:

- backend build passed;
- backend suite passed: 155 tests, zero failures;
- brand-bleed contract passed;
- nine-integration public-claims contract passed;
- workflow-template contract passed: six templates;
- frontend TypeScript check passed;
- production frontend build passed: 1,579 modules transformed;
- production backend build passed;
- production nginx configuration test passed;
- production health endpoint returned `status: ok`;
- production `/integrations` returned HTTP 200;
- headless rendered-page acceptance found all nine intended public cards;
- fixed half-logo rendered from `/brand/po-half-logo.png` with `position: fixed` and a 6 px edge inset.

The local macOS checkout's Vite asset-emission rerun was interrupted while the on-demand synced Documents volume was hydrating `public/brand/P1.avif`. The same source and asset built successfully on the production VPS during deployment. This is a local filesystem-cache condition, not a production release failure.

## Failure Recovery

### Backend health

```bash
ssh root@187.77.220.60
cd /var/www/nexus
git rev-parse HEAD
pm2 status violema-backend --no-color
curl -fsS http://127.0.0.1:3001/api/health
pm2 logs violema-backend --lines 100
```

If the process is down:

```bash
cd /var/www/nexus/backend
npm run build
pm2 restart violema-backend --update-env
pm2 save
```

### Nginx or public route

```bash
nginx -t
systemctl status nginx --no-pager
curl -fsSI https://violema.com/integrations
```

If the config is valid but nginx is unhealthy:

```bash
systemctl restart nginx
```

### Redeploy the current main branch

```bash
ssh root@187.77.220.60
cd /var/www/nexus/deploy
bash deploy.sh --skip-deps
```

### Workflow run fails

1. Do not approve or rerun blindly.
2. Open the failed step and read the normalized error.
3. Recheck readiness.
4. Repair only the failed connection or scope.
5. Start one new run and verify the new run ID.

## Degraded Fallbacks

### Google Drive unavailable

Drive is supporting context, not a required delivery blocker.

- Show the readiness warning.
- State that Drive context is temporarily degraded.
- Run the workflow with Stripe, GitHub, Linear, Gmail, Calendar, and Tavily.
- Do not claim Drive evidence was included.
- Do not reconnect OAuth live on stage unless there is ample time.

### Postmark unavailable

Postmark is the email fallback.

- Keep Slack as the primary reviewed delivery path.
- State that email fallback is unavailable.
- Do not switch to an unverified email provider.
- Do not describe Postmark as operational until authentication passes again.

### Slack unavailable

- Stop at the review gate.
- Show the complete draft and ledger.
- Do not silently switch to email.
- Explain that Violema refuses an uncontrolled external action.

## Claims Max Can Make

- Violema runs a real production Weekly Founder Update across live company systems.
- The TechChicago workflow uses nine verified data and delivery integrations.
- Gmail and Drive use bounded metadata-only reads in this workflow.
- Required-source failures block the workflow instead of falling back to fake data.
- Every external delivery is held for human review.
- The run ledger records reads, drafting, approval, and delivery events without storing raw source payloads.
- Slack is the primary reviewed delivery path; Postmark is the verified fallback.
- The public Active matrix reflects production-verified paths as of the timestamp in this runbook.

## Claims Max Must Not Make

- Do not claim broad autonomous write access.
- Do not claim that Violema reads full Gmail bodies or Drive document contents.
- Do not claim deferred connectors are Active.
- Do not claim Microsoft is a workflow-data connector; it is identity only.
- Do not claim all possible accounts, repositories, channels, or folders are connected.
- Do not claim non-zero revenue, customer traction, or metrics not shown by live sources.
- Do not claim an approval or Slack delivery occurred unless the receipt exists.
- Do not describe a dry run as a real external send.
- Do not expose private email subjects, personal finance reminders, or private file names on a public screen.

## Unresolved Items

No integration, delivery, or infrastructure blocker remains.

The recurring operator responsibility is to use a fresh demo session, select the newest run ID, and approve only the exact artifact visible during that demo.
