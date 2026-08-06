# Operator-Owned Business Context — Design

- **Date:** 2026-08-05
- **Status:** Approved by Max (design review, 2026-08-05)
- **Origin:** 2026-08-05 demo night — a tenant (demo business: AI-powered espresso machines) could not point Violema at their own business. See vault run note `2026-08-04 Violema demo breakage - viktor note replay and rerun zombie factory`.

## Problem

Seeded missions research **Violema's** market, not the tenant's:

1. The competitor monitor seed hardcodes `query: 'AI agent automation platform competitor pricing launches positioning'` (`backend/src/scheduler.ts:376`); the weekly founder update seed hardcodes `'AI automation platform startup competitor pricing product launch founder update'` (`backend/src/scheduler.ts:199`).
2. The frontend template gallery mirrors the same query (`frontend/src/content/workflowTemplates.ts:137`, "keep in sync" comment), so tenant copies created via `createAutomation` are **born** with Violema's market baked in.
3. `mergeSeedIntoStoredAutomation` (`backend/src/scheduler.ts:866`) makes `steps`/`workflow_prompt` seed-owned **by design** — improvements propagate via version bumps. Any operator edit to step content (like the live espresso PATCH, version 2, operator-authored) is reverted at the next seed bump. The ownership model is correct; the business facts inside the steps are what's wrong.

## Decisions (brainstorm outcomes)

| Question | Decision |
| --- | --- |
| Context shape | Small structured profile: summary, market keywords, named competitors, optional exclusions |
| Entry surface | Settings section + first-run nudge via run-gate blocker CTA; no onboarding wizard |
| Empty state | Fail closed: honest readiness blocker, no generic fallback, no inferred guess |
| Mechanism | Semantic context resolution at run time (steps reference context; resolver composes) |

## 1. Data model

New typed optional field on `WorkspaceProfile` (`backend/src/platform/types.ts:412`), **not** the untyped `metadata` bag:

```ts
export interface WorkspaceBusinessContext {
  summary: string;          // one sentence: what the business is
  marketKeywords: string[]; // category terms that build search queries
  competitors: string[];    // named rivals — names or domains (the viktor.com fix)
  exclusions?: string[];    // topics to keep out of research
  updatedAt: string;
  updatedBy?: string;       // user id
}

// on WorkspaceProfile:
businessContext?: WorkspaceBusinessContext;
```

New module `backend/src/platform/businessContext.ts` owns:

- `getBusinessContext(workspaceId)` — returns the context or `null`. A context "counts as set" only when `summary` is non-empty and `marketKeywords` has ≥ 1 entry; anything less is `null` to the gate and resolver.
- `setBusinessContext(workspaceId, input, userId)` — dedicated setter (does not widen `upsertWorkspaceProfile`'s patch surface). Validates and trims; caps: summary ≤ 300 chars, keywords ≤ 10 × 40 chars, competitors ≤ 20 × 100 chars, exclusions ≤ 10 × 60 chars. Writes an audit event `workspace.business_context.updated` (no full-body dumps in ledger metadata, per house rule).
- `composeSearchQuery(ctx, querySuffix)` — `marketKeywords + querySuffix + competitors`, deduped, trimmed, composed query capped ~400 chars. Exclusions are **not** appended as negative search operators (unreliable across providers); they ride in the preamble instead.
- `contextPreamble(ctx)` — compact block: `Business context for this account: {summary}. Market: {keywords}. Named competitors: {competitors}. Avoid: {exclusions}.`

## 2. Seeds and templates stop knowing Violema's market

Search steps switch from a finished query to a reference form:

```ts
inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 }
```

- Backend: competitor monitor `step_competitor_search`, and the founder update's market-research step (`scheduler.ts:199`).
- Context-consuming `analyze`/`summarize` steps in those seeds opt in with `use_business_context: true`; the resolver prepends `contextPreamble` to their `instruction`.
- Frontend: the same steps in `frontend/src/content/workflowTemplates.ts` (competitor monitor at minimum; audit the other templates for the same pattern) so new tenant copies are context-referencing from birth.
- Seed version bumps: competitor monitor 1→**3** (not 2 — `createAutomation` stamps operator-authored records `version: 2` at `scheduler.ts:1036`, and the merge requires `stored.version < seed.version`, so a v2 seed would silently skip any same-id record already at v2), weekly founder update 5→6. Existing seed-id records pick up the reference-form steps through the normal `mergeSeedIntoStoredAutomation` path.
- The `deliver` steps and the seed-merge ownership contract are untouched.

## 3. Runtime resolution

At the existing step-normalization choke point in `backend/src/server.ts` (~3569 for `search`, ~3552/`analyze`, ~3603/`summarize`) — the function already holds the automation record and its `workspaceId`:

- `search` + `use_business_context`: final query = `composeSearchQuery(ctx, inputs.query_suffix)`.
- `analyze`/`summarize` + `use_business_context`: `instruction` = `contextPreamble(ctx) + '\n\n' + instruction`.
- Steps **without** the flag behave byte-identically to today, including the `inferAutomationSearchQuery` fallback (`server.ts:3582`).

Stored automation records keep the reference form. A seed bump can no longer revert a tenant's market because the market is not in the steps.

## 4. Fail-closed empty state

`backend/src/integrationGateway/runReadinessGate.ts` gains one rule: any step with `use_business_context: true` while `getBusinessContext(workspaceId)` is `null` → blocker:

- id: `business_context_missing`
- copy: "Violema doesn't know your business yet — tell it what you do and who you compete with."
- CTA: link to the settings business section (`/settings#business`).

No generic fallback query, no inference. Runs blocked at every entry point that already consults the gate (HTTP, Slack verb, cron).

## 5. API + UI

**API** (in `server.ts`, following existing workspace-scoped route patterns):

- `GET /api/workspaces/:id/business-context` — workspace members.
- `PUT /api/workspaces/:id/business-context` — workspace owner/admin; body validated by `setBusinessContext`; returns the saved context.

**UI** (`frontend/src/pages/SettingsPage.tsx`): new "Your business" section — summary text field, chip inputs for market keywords / competitors / exclusions, save with inline validation errors. First-run nudge = the §4 blocker CTA surfacing through existing blocker rendering on mission cards and run entry points; no separate wizard.

## 6. Migration — one idempotent boot sweep

Stamped and skipped on re-run, in the style of the existing zombie sweeps. Three parts:

1. **Founder backfill** — `purpleorangehq` gets Violema's real context: summary + market keywords (AI agent automation platform space) + named competitors **including viktor.com** (the named-rival gap generic queries missed).
2. **Tenant backfill** — the espresso workspace (`workspace_0f87e43d83f39e70`) gets its context derived from the live v2 patched query (espresso-machine market). Exact prod values confirmed at deploy time via a probe script on Max's `!` lane before the sweep runs.
3. **Legacy-query rewrite** — any automation step (seed-id record **or** `auto_<timestamp>` copy) whose `inputs.query` exactly matches a known legacy hardcoded string is rewritten to the reference form. Known strings: the two seed queries in the Problem section, plus the espresso patched query (its content moves into the tenant's context first). In the same automation, `analyze`/`summarize` steps whose titles match the seed's known context-consuming steps ("Extract what changed", "Draft competitor memo") get `use_business_context: true` so copies receive the preamble too — title-matching is acceptable for a one-time stamped sweep with backups, and the worst miss is a copy lacking the preamble while its search query is still correct. Covers whichever shape the tenant's record turns out to be.

Data files get `.bak` backups per house pattern; every rewrite emits an audit event. Workspaces that end the sweep without context simply hit the honest §4 blocker — correct by decision.

## 7. Testing (TDD throughout)

- `businessContext` unit tests: validation caps, "counts as set" rule, `composeSearchQuery` (empty ctx, dedupe, cap, domain handling), `contextPreamble` (with/without exclusions).
- Seed-merge test: a version bump over an operator record preserves the tenant's market end-to-end (context referenced, not contained).
- Run-gate test: opted-in step + null context → `business_context_missing`; unopted steps unaffected.
- API tests: auth (member vs owner vs anonymous), validation failures, happy path.
- Migration tests: idempotency, legacy-query rewrite on both record shapes, backfill stamps.
- Frontend contract test for the settings section; existing suites stay green: backend 550/550 + 7/7 platform, frontend lint/build/contracts.

## Out of scope

Separate items on the outstanding list, not this build: library ingestion for user files (`drive.file` picker/upload), review-card provenance, in-product Slack delivery receipt, Violema-branded tenant posts, stale `waiting_review` queue hygiene.

## Implementation deviations (recorded 2026-08-05, post-build)

1. **Migration is idempotent by construction, with no stamp file.** Rewrites match exact legacy query strings that no longer exist after the rewrite, and backfills skip workspaces whose context is already set — a second run finds nothing to do. The spec's "stamped" wording described the intent (safe re-runs), which this achieves without the extra state.
2. **PUT auth maps "owner/admin" to authenticated + workspace access.** The auth model has global `admin`/`member` roles plus per-user workspace lists — no per-workspace owner role exists. `resolveWorkspaceContext` already asserts workspace access for authenticated users; inventing a per-workspace role system for this endpoint would be YAGNI.
3. **The weekly-founder-brief frontend template was also converted** to the reference form (`query_suffix: 'competitor pricing product launch news'`) — the spec's "audit the other templates for the same pattern" clause found the same hardcoded market string there.

## Risks

- `server.ts` and `runReadinessGate.ts` are regression-sensitive; every change is narrow and behind the `use_business_context` opt-in, so unopted steps are byte-identical.
- The migration touches prod data files; mitigated by idempotent stamping, `.bak` backups, audit events, and the pre-deploy probe of actual record shapes.
- Composed queries could degrade search quality if operators enter noisy keywords; caps + dedupe bound the damage, and the review gate means a bad memo is caught before delivery.
