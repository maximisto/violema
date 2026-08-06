# Operator-Owned Business Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workspace-level, operator-owned business context that seeded workflow steps consume at run time, so a tenant's market survives seed version bumps and every seeded mission researches the tenant's business, not Violema's.

**Architecture:** A pure resolution module (`platform/businessContext.ts`) plus a typed `businessContext` field on `WorkspaceProfile`. Seed/template steps carry `use_business_context: true` + `query_suffix` instead of finished queries; the step-normalization choke point in `server.ts` resolves them per run. The run gate blocks honestly when context is missing. A one-shot idempotent boot migration rewrites legacy hardcoded queries and backfills the two live workspaces.

**Tech Stack:** TypeScript, Express, node:test + ts-node (backend), React + Vite + node contract scripts (frontend). JSON file stores bound to `process.cwd()` at import — tests chdir to a temp dir **before** dynamically importing modules.

**Spec:** `docs/superpowers/specs/2026-08-05-operator-owned-business-context-design.md`

## Global Constraints

- **Never deploy.** Production deploy needs Max's explicit, separate request. This plan ends at green gates + committed code.
- **Secrets:** never read/echo `OpenRouter.env.md`, `Slack.env.rtf`, `violema_auth.env.rtf`.
- **Runtime data is not source:** never commit `backend/*.json` ledgers, `auth-users.json`, or `.bak` variants. Stage explicit paths only — no `git add -A`.
- **Regression-sensitive:** `backend/src/server.ts`, `frontend/src/pages/Dashboard.tsx` — narrow, surgical edits only.
- **The seed-merge ownership contract is untouched:** `mergeSeedIntoStoredAutomation` keeps `steps`/`workflow_prompt` seed-owned. Do not add exceptions to it.
- Backend gates: `cd backend && npm run typecheck && npm test && npm run test:platform`. Frontend gates: `cd frontend && npm run lint && npm run build` + contract scripts.
- Backend test files MUST `process.chdir(tempDir)` at module scope (or inside a scaffold) **before** `await import(...)` of any store-touching module — store file paths bind to cwd at first import.
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Validation caps (exact, from spec): summary ≤ 300 chars; keywords ≤ 10 × 40 chars; competitors ≤ 20 × 100 chars; exclusions ≤ 10 × 60 chars; composed query ≤ 400 chars.

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/src/platform/types.ts` | `WorkspaceBusinessContext` type; field on `WorkspaceProfile` |
| `backend/src/platform/businessContext.ts` (new) | Pure: validation, is-set rule, query composition, preamble, step transform. No I/O. |
| `backend/src/platform/workspace.ts` | Store accessors `getBusinessContext` / `setBusinessContext` |
| `backend/src/integrationGateway/runReadinessGate.ts` | `business_context_missing` blocker rule (pure, injected boolean) |
| `backend/src/scheduler.ts` | Seed rewrites + version bumps; `runBusinessContextMigration()` |
| `backend/src/server.ts` | Gate wiring, plan-build resolution wiring, API routes, boot migration call |
| `backend/src/adminAccessStore.ts` | New audit action literal |
| `frontend/src/content/workflowTemplates.ts` | Template steps switch to reference form |
| `frontend/src/pages/SettingsPage.tsx` | "Your business" section (`id="business"`) |
| `frontend/src/features/integrations/workflowReadinessUi.ts` | Blocker→action case for `business_context_missing` |
| Tests | `backend/tests/businessContext.test.ts`, `backend/tests/businessContextStore.test.ts`, `backend/tests/businessContextGate.test.ts`, `backend/tests/businessContextApi.test.ts`, `backend/tests/businessContextPlan.test.ts`, `backend/tests/businessContextMigration.test.ts`, additions to `backend/tests/automationSeedMerge.test.ts`, `frontend/tests/businessContextSettings.contract.mjs` |

---

### Task 1: Pure business-context module

**Files:**
- Modify: `backend/src/platform/types.ts` (WorkspaceProfile is at :412)
- Create: `backend/src/platform/businessContext.ts`
- Test: `backend/tests/businessContext.test.ts`

**Interfaces:**
- Consumes: `PersistedAutomationStep`, `WorkspaceProfile` from `./types`.
- Produces (later tasks import these exact names from `../src/platform/businessContext`):
  - `interface WorkspaceBusinessContext { summary: string; marketKeywords: string[]; competitors: string[]; exclusions?: string[]; updatedAt: string; updatedBy?: string }` (defined in `types.ts`)
  - `validateBusinessContextInput(input: BusinessContextInput): { ok: true; value: BusinessContextValue } | { ok: false; errors: string[] }`
  - `isBusinessContextSet(ctx: WorkspaceBusinessContext | null | undefined): ctx is WorkspaceBusinessContext`
  - `composeSearchQuery(ctx: WorkspaceBusinessContext, querySuffix: string): string`
  - `contextPreamble(ctx: WorkspaceBusinessContext): string`
  - `applyBusinessContextToStep(step: PersistedAutomationStep, ctx: WorkspaceBusinessContext | null): PersistedAutomationStep`
  - `BUSINESS_CONTEXT_LIMITS` const

- [ ] **Step 1: Write the failing test**

Create `backend/tests/businessContext.test.ts` (pure module — no chdir needed):

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyBusinessContextToStep,
  composeSearchQuery,
  contextPreamble,
  isBusinessContextSet,
  validateBusinessContextInput,
} from '../src/platform/businessContext';
import type { WorkspaceBusinessContext } from '../src/platform/types';

const ESPRESSO: WorkspaceBusinessContext = {
  summary: 'An AI-powered espresso machine company.',
  marketKeywords: ['AI-powered espresso machine', 'smart coffee machine'],
  competitors: ['decenttespresso.com'],
  exclusions: ['agent automation platforms'],
  updatedAt: '2026-08-05T12:00:00.000Z',
};

test('isBusinessContextSet requires a summary and at least one keyword', () => {
  assert.equal(isBusinessContextSet(ESPRESSO), true);
  assert.equal(isBusinessContextSet(null), false);
  assert.equal(isBusinessContextSet({ ...ESPRESSO, summary: '  ' }), false);
  assert.equal(isBusinessContextSet({ ...ESPRESSO, marketKeywords: [] }), false);
});

test('validateBusinessContextInput trims, enforces caps, and reports every error', () => {
  const ok = validateBusinessContextInput({
    summary: '  An AI-powered espresso machine company.  ',
    marketKeywords: [' AI-powered espresso machine ', ''],
    competitors: ['decenttespresso.com'],
    exclusions: undefined,
  });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.summary, 'An AI-powered espresso machine company.');
    assert.deepEqual(ok.value.marketKeywords, ['AI-powered espresso machine']);
    assert.equal(ok.value.exclusions, undefined);
  }

  const bad = validateBusinessContextInput({
    summary: 'x'.repeat(301),
    marketKeywords: Array.from({ length: 11 }, (_, i) => `k${i}`),
    competitors: 'not-an-array',
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 3);

  const empty = validateBusinessContextInput({ summary: '', marketKeywords: [] });
  assert.equal(empty.ok, false);
});

test('composeSearchQuery joins keywords, suffix, and competitors, deduped and capped', () => {
  const query = composeSearchQuery(ESPRESSO, 'competitor pricing launches positioning');
  assert.equal(
    query,
    'AI-powered espresso machine smart coffee machine competitor pricing launches positioning decenttespresso.com',
  );

  const duped = composeSearchQuery(
    { ...ESPRESSO, competitors: ['AI-powered espresso machine'] },
    'competitor pricing',
  );
  assert.equal(duped, 'AI-powered espresso machine smart coffee machine competitor pricing');

  const long = composeSearchQuery(
    { ...ESPRESSO, marketKeywords: ['k'.repeat(40), 'm'.repeat(40)], competitors: ['c'.repeat(100)] },
    's'.repeat(200),
  );
  assert.ok(long.length <= 400);
});

test('contextPreamble states summary, market, competitors, and exclusions', () => {
  const preamble = contextPreamble(ESPRESSO);
  assert.match(preamble, /Business context for this account: An AI-powered espresso machine company\./);
  assert.match(preamble, /Market: AI-powered espresso machine, smart coffee machine\./);
  assert.match(preamble, /Named competitors: decenttespresso\.com\./);
  assert.match(preamble, /Avoid: agent automation platforms\./);

  const noExtras = contextPreamble({ ...ESPRESSO, competitors: [], exclusions: undefined });
  assert.doesNotMatch(noExtras, /Named competitors/);
  assert.doesNotMatch(noExtras, /Avoid:/);
});

test('applyBusinessContextToStep resolves opted-in steps and leaves everything else alone', () => {
  const searchStep = {
    id: 'step_competitor_search',
    kind: 'search' as const,
    title: 'Search competitor moves',
    objective: 'Find pricing, launch, and positioning changes from key competitors.',
    inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 },
  };
  const resolved = applyBusinessContextToStep(searchStep, ESPRESSO);
  assert.equal(
    resolved.inputs?.query,
    'AI-powered espresso machine smart coffee machine competitor pricing launches positioning decenttespresso.com',
  );
  assert.equal(resolved.inputs?.num_results, 8);
  assert.equal(resolved.inputs?.use_business_context, undefined, 'search inputs are replaced, not merged');

  const analyzeStep = {
    id: 'step_delta_analysis',
    kind: 'analyze' as const,
    title: 'Extract what changed',
    objective: 'Compare against the library.',
    inputs: { use_business_context: true, instruction: 'Compare the evidence.' },
  };
  const analyzed = applyBusinessContextToStep(analyzeStep, ESPRESSO);
  assert.match(String(analyzed.inputs?.instruction), /^Business context for this account:/);
  assert.match(String(analyzed.inputs?.instruction), /Compare the evidence\.$/);

  const unflagged = applyBusinessContextToStep({ ...searchStep, inputs: { query: 'plain', num_results: 6 } }, ESPRESSO);
  assert.equal(unflagged.inputs?.query, 'plain');

  const noContext = applyBusinessContextToStep(searchStep, null);
  assert.equal(noContext, searchStep, 'without context the step passes through untouched (gate blocks non-demo runs)');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContext.test.ts`
Expected: FAIL — cannot find module `../src/platform/businessContext`.

- [ ] **Step 3: Add the type to `types.ts`**

In `backend/src/platform/types.ts`, directly above `WorkspaceProfile` (:412):

```ts
export interface WorkspaceBusinessContext {
  summary: string;          // one sentence: what the business is
  marketKeywords: string[]; // category terms that build search queries
  competitors: string[];    // named rivals — names or domains
  exclusions?: string[];    // topics to keep out of research
  updatedAt: string;
  updatedBy?: string;
}
```

And inside `WorkspaceProfile`, after `metadata?: Record<string, unknown>;`:

```ts
  businessContext?: WorkspaceBusinessContext;
```

- [ ] **Step 4: Write the module**

Create `backend/src/platform/businessContext.ts`:

```ts
/**
 * Operator-owned business context: the workspace-level answer to "whose
 * business is this?" that seeded steps consume at run time.
 *
 * Seeds used to hardcode Violema's own market into search queries, and
 * `mergeSeedIntoStoredAutomation` keeps steps seed-owned on purpose — so any
 * operator edit to step content died at the next seed bump (proven live,
 * 2026-08-05). Steps now carry `use_business_context: true` + `query_suffix`
 * and this module composes the real query per workspace. Pure by design: the
 * store accessors live in workspace.ts, everything here is testable without
 * I/O.
 */
import type { PersistedAutomationStep, WorkspaceBusinessContext } from './types';

export const BUSINESS_CONTEXT_LIMITS = {
  summaryLength: 300,
  keywords: 10,
  keywordLength: 40,
  competitors: 20,
  competitorLength: 100,
  exclusions: 10,
  exclusionLength: 60,
  composedQueryLength: 400,
} as const;

export interface BusinessContextInput {
  summary?: unknown;
  marketKeywords?: unknown;
  competitors?: unknown;
  exclusions?: unknown;
}

export type BusinessContextValue = Pick<
  WorkspaceBusinessContext,
  'summary' | 'marketKeywords' | 'competitors' | 'exclusions'
>;

export function isBusinessContextSet(
  ctx: WorkspaceBusinessContext | null | undefined,
): ctx is WorkspaceBusinessContext {
  return Boolean(ctx && ctx.summary.trim() && ctx.marketKeywords.length >= 1);
}

function normalizeList(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
  errors: string[],
): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array of strings.`);
    return [];
  }
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  if (items.length > maxItems) {
    errors.push(`${field} allows at most ${maxItems} entries.`);
    return [];
  }
  const tooLong = items.find((item) => item.length > maxLength);
  if (tooLong) {
    errors.push(`${field} entries must be at most ${maxLength} characters.`);
    return [];
  }
  return items;
}

export function validateBusinessContextInput(
  input: BusinessContextInput,
): { ok: true; value: BusinessContextValue } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  if (!summary) errors.push('summary is required.');
  else if (summary.length > BUSINESS_CONTEXT_LIMITS.summaryLength) {
    errors.push(`summary must be at most ${BUSINESS_CONTEXT_LIMITS.summaryLength} characters.`);
  }

  const marketKeywords = normalizeList(
    input.marketKeywords, 'marketKeywords',
    BUSINESS_CONTEXT_LIMITS.keywords, BUSINESS_CONTEXT_LIMITS.keywordLength, errors,
  );
  if (marketKeywords.length === 0 && !errors.some((error) => error.startsWith('marketKeywords'))) {
    errors.push('marketKeywords needs at least one entry.');
  }

  const competitors = normalizeList(
    input.competitors, 'competitors',
    BUSINESS_CONTEXT_LIMITS.competitors, BUSINESS_CONTEXT_LIMITS.competitorLength, errors,
  );
  const exclusions = normalizeList(
    input.exclusions, 'exclusions',
    BUSINESS_CONTEXT_LIMITS.exclusions, BUSINESS_CONTEXT_LIMITS.exclusionLength, errors,
  );

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      summary,
      marketKeywords,
      competitors,
      exclusions: exclusions.length ? exclusions : undefined,
    },
  };
}

export function composeSearchQuery(ctx: WorkspaceBusinessContext, querySuffix: string): string {
  const parts = [...ctx.marketKeywords, querySuffix, ...ctx.competitors];
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept.join(' ').slice(0, BUSINESS_CONTEXT_LIMITS.composedQueryLength).trim();
}

export function contextPreamble(ctx: WorkspaceBusinessContext): string {
  const lines = [
    `Business context for this account: ${ctx.summary}`,
    `Market: ${ctx.marketKeywords.join(', ')}.`,
  ];
  if (ctx.competitors.length) lines.push(`Named competitors: ${ctx.competitors.join(', ')}.`);
  if (ctx.exclusions?.length) lines.push(`Avoid: ${ctx.exclusions.join(', ')}.`);
  return lines.join(' ');
}

/**
 * Resolve one persisted step against the workspace's context. Steps that did
 * not opt in pass through untouched — byte-identical behavior for everything
 * that exists today. With no context, opted-in steps also pass through: the
 * run gate blocks non-demo runs first, and demo workspaces deliberately fall
 * back to the objective-inferred query.
 */
export function applyBusinessContextToStep(
  step: PersistedAutomationStep,
  ctx: WorkspaceBusinessContext | null,
): PersistedAutomationStep {
  const inputs = step.inputs;
  if (!inputs || inputs.use_business_context !== true || !isBusinessContextSet(ctx)) return step;

  if (step.kind === 'search') {
    const suffix = typeof inputs.query_suffix === 'string' ? inputs.query_suffix : '';
    const numResults = typeof inputs.num_results === 'number' ? inputs.num_results : 6;
    return { ...step, inputs: { query: composeSearchQuery(ctx, suffix), num_results: numResults } };
  }

  if (step.kind === 'analyze' || step.kind === 'summarize') {
    const instruction = typeof inputs.instruction === 'string' && inputs.instruction.trim()
      ? inputs.instruction
      : step.objective;
    return { ...step, inputs: { ...inputs, instruction: `${contextPreamble(ctx)}\n\n${instruction}` } };
  }

  return step;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContext.test.ts`
Expected: PASS (5 tests). Also run `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/maximisto/Documents/New project"
git add backend/src/platform/types.ts backend/src/platform/businessContext.ts backend/tests/businessContext.test.ts
git commit -m "feat: pure business-context module — validation, query composition, step resolution

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Store accessors on the workspace profile

**Files:**
- Modify: `backend/src/platform/workspace.ts`
- Test: `backend/tests/businessContextStore.test.ts` (own file: needs its own temp cwd; the Task 1 file must stay cwd-free)

**Interfaces:**
- Consumes: `validateBusinessContextInput`, `isBusinessContextSet` from `./businessContext`; existing `listWorkspaces`, `getWorkspaceProfile`, private `saveWorkspaces`.
- Produces (imported by later tasks from `./platform/workspace`):
  - `getBusinessContext(workspaceId?: string): WorkspaceBusinessContext | null` — null unless the stored context passes `isBusinessContextSet`. **Read-only: must not create a profile** (avoids the known write-on-read wart on hot paths like plan building).
  - `setBusinessContext(workspaceId: string, input: BusinessContextInput, updatedBy?: string): { ok: true; context: WorkspaceBusinessContext } | { ok: false; errors: string[] }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/businessContextStore.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// WORKSPACES_FILE binds to process.cwd() at import, so claim a temp dir first.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-store-'));
process.chdir(tempDir);

test('setBusinessContext persists and getBusinessContext round-trips', async () => {
  const workspace = await import('../src/platform/workspace');

  assert.equal(workspace.getBusinessContext('workspace_test_espresso'), null);

  const result = workspace.setBusinessContext(
    'workspace_test_espresso',
    {
      summary: 'An AI-powered espresso machine company.',
      marketKeywords: ['AI-powered espresso machine'],
      competitors: ['decenttespresso.com'],
    },
    'user_123',
  );
  assert.ok(result.ok);

  const ctx = workspace.getBusinessContext('workspace_test_espresso');
  assert.ok(ctx);
  assert.equal(ctx.summary, 'An AI-powered espresso machine company.');
  assert.equal(ctx.updatedBy, 'user_123');
  assert.ok(Date.parse(ctx.updatedAt) > 0);
});

test('setBusinessContext rejects invalid input without writing', async () => {
  const workspace = await import('../src/platform/workspace');
  const result = workspace.setBusinessContext('workspace_test_invalid', {
    summary: '',
    marketKeywords: [],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.length >= 1);
  assert.equal(workspace.getBusinessContext('workspace_test_invalid'), null);
});

test('getBusinessContext never creates a workspace profile (no write-on-read)', async () => {
  const workspace = await import('../src/platform/workspace');
  workspace.getBusinessContext('workspace_never_written');
  assert.ok(
    !workspace.listWorkspaces().some((item) => item.id === 'workspace_never_written'),
    'a read must not mint a profile',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextStore.test.ts`
Expected: FAIL — `getBusinessContext` is not a function.

- [ ] **Step 3: Implement in `workspace.ts`**

Add imports at the top:

```ts
import {
  validateBusinessContextInput,
  isBusinessContextSet,
  type BusinessContextInput,
} from './businessContext';
import type { WorkspaceBusinessContext } from './types';
```

Append at the end of the file:

```ts
export function getBusinessContext(
  workspaceId = DEFAULT_WORKSPACE_ID,
): WorkspaceBusinessContext | null {
  // listWorkspaces, not getWorkspaceProfile: a read must never mint a profile.
  const profile = listWorkspaces().find((item) => item.id === workspaceId);
  const ctx = profile?.businessContext;
  return isBusinessContextSet(ctx) ? ctx : null;
}

export function setBusinessContext(
  workspaceId: string,
  input: BusinessContextInput,
  updatedBy?: string,
): { ok: true; context: WorkspaceBusinessContext } | { ok: false; errors: string[] } {
  const validation = validateBusinessContextInput(input);
  if (!validation.ok) return validation;

  const context: WorkspaceBusinessContext = {
    ...validation.value,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const current = getWorkspaceProfile(workspaceId);
  const items = listWorkspaces();
  const next = { ...current, businessContext: context, updatedAt: context.updatedAt };
  const index = items.findIndex((item) => item.id === workspaceId);
  if (index === -1) items.unshift(next);
  else items[index] = next;
  saveWorkspaces(items);
  return { ok: true, context };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextStore.test.ts`
Expected: PASS (3 tests). Also `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/platform/workspace.ts backend/tests/businessContextStore.test.ts
git commit -m "feat: workspace store accessors for operator-owned business context

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Run-gate blocker + gate wiring

**Files:**
- Modify: `backend/src/integrationGateway/runReadinessGate.ts` (`evaluateRunReadiness` at :269)
- Modify: `backend/src/server.ts` (`evaluateAutomationRunReadiness` at :4823 — narrow edit)
- Test: `backend/tests/businessContextGate.test.ts`

**Interfaces:**
- Consumes: `WorkflowReadinessBlocker` (shape `{ key, label, detail, route? }`), `RunReadinessStepLike`, `getBusinessContext` (Task 2).
- Produces:
  - `evaluateRunReadiness` input gains `businessContextSet?: boolean` (pure — the caller injects the fact).
  - Exported `BUSINESS_CONTEXT_BLOCKER: WorkflowReadinessBlocker` with `key: 'business_context_missing'`, `route: '/settings#business'`, label `'Tell Violema about your business'`.
  - Exported `stepsRequireBusinessContext(steps?: RunReadinessStepLike[]): boolean`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/businessContextGate.test.ts` (pure gate — no chdir needed):

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUSINESS_CONTEXT_BLOCKER,
  evaluateRunReadiness,
  stepsRequireBusinessContext,
} from '../src/integrationGateway/runReadinessGate';

const CONTEXT_STEPS = [
  {
    kind: 'search',
    title: 'Search competitor moves',
    inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 },
  },
];

test('stepsRequireBusinessContext detects the opt-in flag', () => {
  assert.equal(stepsRequireBusinessContext(CONTEXT_STEPS), true);
  assert.equal(stepsRequireBusinessContext([{ kind: 'search', inputs: { query: 'plain' } }]), false);
  assert.equal(stepsRequireBusinessContext(undefined), false);
});

test('a context-requiring run with no context blocks honestly on every tier', () => {
  // Tier 3 (custom workflow).
  const custom = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: CONTEXT_STEPS,
    businessContextSet: false,
  });
  assert.equal(custom.allowed, false);
  assert.equal(custom.blockers[0]?.key, 'business_context_missing');
  assert.equal(custom.blockers[0]?.route, '/settings#business');

  // Tier 2 (supported workflow table).
  const supported = evaluateRunReadiness({
    workflowId: 'weekly-founder-update',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: CONTEXT_STEPS,
    businessContextSet: false,
  });
  assert.equal(supported.allowed, false);
  assert.ok(supported.blockers.some((blocker) => blocker.key === 'business_context_missing'));
});

test('with context set the gate result carries no business-context blocker', () => {
  const decision = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: CONTEXT_STEPS,
    businessContextSet: true,
  });
  assert.ok(!decision.blockers.some((blocker) => blocker.key === 'business_context_missing'));
});

test('demo workspaces bypass the business-context rule like every other rule', () => {
  const demo = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_demo',
    isDemoWorkspace: true,
    steps: CONTEXT_STEPS,
    businessContextSet: false,
  });
  assert.equal(demo.allowed, true);
  assert.equal(demo.blockers.length, 0);
});

test('steps without the flag never trip the rule regardless of businessContextSet', () => {
  const decision = evaluateRunReadiness({
    workflowId: 'competitor-monitor',
    workspaceId: 'workspace_test',
    isDemoWorkspace: false,
    steps: [{ kind: 'summarize', inputs: { instruction: 'Draft memo.' } }],
    businessContextSet: false,
  });
  assert.ok(!decision.blockers.some((blocker) => blocker.key === 'business_context_missing'));
});

test('BUSINESS_CONTEXT_BLOCKER copy is honest and routed to settings', () => {
  assert.equal(BUSINESS_CONTEXT_BLOCKER.label, 'Tell Violema about your business');
  assert.match(BUSINESS_CONTEXT_BLOCKER.detail, /doesn't know your business yet/);
  assert.equal(BUSINESS_CONTEXT_BLOCKER.route, '/settings#business');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextGate.test.ts`
Expected: FAIL — `BUSINESS_CONTEXT_BLOCKER` not exported.

- [ ] **Step 3: Implement the gate rule**

In `runReadinessGate.ts`, above `evaluateRunReadiness`:

```ts
/** True when any step opted into workspace business context. */
export function stepsRequireBusinessContext(steps?: RunReadinessStepLike[]): boolean {
  return (steps || []).some((step) => step.inputs?.use_business_context === true);
}

/**
 * The honest empty state for context-requiring steps. Running anyway would
 * research a generic market and present it as this workspace's — the exact
 * 2026-08-05 demo-night failure — so the gate blocks before money is spent.
 */
export const BUSINESS_CONTEXT_BLOCKER: WorkflowReadinessBlocker = {
  key: 'business_context_missing',
  label: 'Tell Violema about your business',
  detail:
    "Violema doesn't know your business yet — tell it what you do and who you compete with, so this mission researches your market instead of a generic one.",
  route: '/settings#business',
};
```

In `evaluateRunReadiness`: add `businessContextSet?: boolean;` to the input type. Restructure the two non-demo returns so the rule applies to both tiers — assign each tier's decision to a local `decision` instead of returning directly, then end the function with:

```ts
  if (stepsRequireBusinessContext(input.steps) && !input.businessContextSet) {
    return {
      ...decision,
      allowed: false,
      summary: BUSINESS_CONTEXT_BLOCKER.detail,
      blockers: [BUSINESS_CONTEXT_BLOCKER, ...decision.blockers],
    };
  }
  return decision;
```

(The demo bypass early-return at the top stays exactly as-is.)

- [ ] **Step 4: Wire the fact in `server.ts`**

In `evaluateAutomationRunReadiness` (:4823), the non-demo `evaluateRunReadiness` call gains one line:

```ts
    businessContextSet: getBusinessContext(input.workspaceId) !== null,
```

Add `getBusinessContext` to the existing `./platform/workspace` import in `server.ts` (extend the existing import statement — do not add a duplicate).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextGate.test.ts` → PASS.
Then `npm run typecheck` and the full `npm test` (existing gate consumers must be unaffected — no existing automation has the flag yet).

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrationGateway/runReadinessGate.ts backend/src/server.ts backend/tests/businessContextGate.test.ts
git commit -m "feat: run gate blocks context-requiring steps until the workspace sets business context

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Runtime resolution at the plan-build choke point

**Files:**
- Modify: `backend/src/server.ts` — `createAutomationStepDefinitionFromPersisted` (:3501) and `buildAutomationExecutionPlan` (:4046). Narrow edits only.
- Test: `backend/tests/businessContextPlan.test.ts`

**Interfaces:**
- Consumes: `applyBusinessContextToStep` (Task 1), `getBusinessContext` (Task 2), `DEFAULT_WORKSPACE_ID` (already imported in server.ts).
- Produces: `buildAutomationExecutionPlan` becomes `export function` (precedent: `evaluateAutomationRunReadiness` is already exported for testability) and its input type gains `workspaceId?: string`. `createAutomationStepDefinitionFromPersisted` gains a 4th parameter `businessContext: WorkspaceBusinessContext | null`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/businessContextPlan.test.ts`. Importing `server.ts` builds the express app but does not listen (the rerun test calls `.listen` explicitly), so a direct function test works — with the temp-cwd scaffold because the import touches stores:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-plan-'));
process.chdir(tempDir);
process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

const CONTEXT_AUTOMATION = {
  id: 'auto_test_espresso',
  name: 'Competitor monitor',
  workspaceId: 'workspace_test_espresso',
  actions: [],
  notify: '#violema-demo',
  steps: [
    {
      id: 'step_competitor_search',
      kind: 'search' as const,
      title: 'Search competitor moves',
      objective: 'Find pricing, launch, and positioning changes from key competitors.',
      inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 },
    },
    {
      id: 'step_competitor_memo',
      kind: 'summarize' as const,
      title: 'Draft competitor memo',
      objective: 'Create a concise founder memo.',
      inputs: { use_business_context: true, instruction: 'Draft the competitor memo.' },
    },
  ],
};

test('plan building resolves opted-in steps from the workspace business context', async () => {
  const workspace = await import('../src/platform/workspace');
  const serverModule = await import('../src/server');

  workspace.setBusinessContext('workspace_test_espresso', {
    summary: 'An AI-powered espresso machine company.',
    marketKeywords: ['AI-powered espresso machine', 'smart coffee machine'],
    competitors: ['decenttespresso.com'],
  });

  const plan = serverModule.buildAutomationExecutionPlan(CONTEXT_AUTOMATION);
  const search = plan.steps.find((step) => step.id === 'step_competitor_search');
  assert.ok(search);
  assert.equal(
    search.inputs?.query,
    'AI-powered espresso machine smart coffee machine competitor pricing launches positioning decenttespresso.com',
  );

  const memo = plan.steps.find((step) => step.id === 'step_competitor_memo');
  assert.match(String(memo?.inputs?.instruction), /^Business context for this account:/);
});

test('without context the opted-in step falls back to the inferred query, not a hardcoded market', async () => {
  const serverModule = await import('../src/server');
  const plan = serverModule.buildAutomationExecutionPlan({
    ...CONTEXT_AUTOMATION,
    id: 'auto_test_no_context',
    workspaceId: 'workspace_without_context',
  });
  const search = plan.steps.find((step) => step.id === 'step_competitor_search');
  assert.ok(search);
  const query = String(search.inputs?.query || '');
  assert.ok(!query.includes('AI agent automation'), 'no hardcoded market can appear');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextPlan.test.ts`
Expected: FAIL — `buildAutomationExecutionPlan` is not exported.

- [ ] **Step 3: Implement the wiring**

In `server.ts`:

1. Import `applyBusinessContextToStep` from `./platform/businessContext` and add `WorkspaceBusinessContext` to the existing type import from `./platform/types`.
2. `createAutomationStepDefinitionFromPersisted` (:3501): rename the step parameter to `persistedStep`, add a 4th parameter, and resolve first — the body below is otherwise unchanged and keeps reading `step`:

```ts
function createAutomationStepDefinitionFromPersisted(
  automation: {
    id: string;
    name: string;
    description?: string;
    actions: string[];
    notify?: string;
    condition?: string;
  },
  persistedStep: PersistedAutomationStep,
  index: number,
  businessContext: WorkspaceBusinessContext | null,
): AutomationStepDefinition {
  // Resolve operator-owned business context BEFORE any kind-specific handling,
  // so the search/analyze/summarize branches below see concrete inputs.
  const step = applyBusinessContextToStep(persistedStep, businessContext);
  const baseId = step.id?.trim() || buildAutomationStepId(automation.id, index);
  // ... existing body unchanged from here
```

3. `buildAutomationExecutionPlan` (:4046): add `export`, add `workspaceId?: string;` to the param type, resolve once, and pass through:

```ts
export function buildAutomationExecutionPlan(automation: {
  id: string;
  name: string;
  workspaceId?: string;
  description?: string;
  actions: string[];
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
  studio_state?: AutomationStudioState;
  notify?: string;
  condition?: string;
}): AutomationExecutionPlan {
  // One context read per plan build; seed records with no workspaceId are
  // internal and resolve to the default workspace, matching run-time tenancy.
  const businessContext = getBusinessContext(automation.workspaceId ?? DEFAULT_WORKSPACE_ID);
  const baseSteps = automation.steps?.length
    ? automation.steps.map((step, index) =>
        createAutomationStepDefinitionFromPersisted(automation, step, index, businessContext))
    : automation.actions.map((action, index) => createAutomationStepDefinition(automation, action, index));
  // ... rest unchanged
```

- [ ] **Step 4: Run tests to verify they pass**

Run the new file, then `npm run typecheck`, then the FULL backend suite (`npm test && npm run test:platform`) — this is a regression-sensitive file; every existing test must stay green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/server.ts backend/tests/businessContextPlan.test.ts
git commit -m "feat: plan build resolves business-context step references per workspace

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Backend seeds switch to the reference form

**Files:**
- Modify: `backend/src/scheduler.ts` — competitor seed (:322-439), founder update seed (:194-207), version numbers (:110, :324)
- Test: append to `backend/tests/automationSeedMerge.test.ts`

**Interfaces:**
- Consumes: nothing new — seed literals only.
- Produces: competitor seed `version: 3`; founder seed `version: 6`. Steps carry `use_business_context: true`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/automationSeedMerge.test.ts`:

```ts
test('a seed bump replaces an operator-patched market query with the context reference form', async () => {
  const scheduler = await import('../src/scheduler');

  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const seeded = scheduler.listAutomations().find((item) => item.id === 'auto_competitor_monitor');
  assert.ok(seeded, 'Expected the competitor monitor seed.');

  // The 2026-08-05 live patch shape: operator-authored steps (version 2) with
  // the tenant's market written directly into the search query.
  writeAutomations([
    {
      ...seeded,
      version: 2,
      steps: seeded.steps?.map((step) =>
        step.id === 'step_competitor_search'
          ? { ...step, inputs: { query: 'AI-powered espresso machine competitors pricing', num_results: 8 } }
          : step,
      ),
    },
  ]);

  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const upgraded = scheduler.listAutomations().find((item) => item.id === 'auto_competitor_monitor');
  assert.ok(upgraded);
  assert.ok((upgraded.version || 0) >= 3, 'seed version must exceed the operator-authored 2');

  const search = upgraded.steps?.find((step) => step.id === 'step_competitor_search');
  assert.equal(search?.inputs?.use_business_context, true);
  assert.equal(search?.inputs?.query_suffix, 'competitor pricing launches positioning');
  assert.equal(search?.inputs?.query, undefined, 'no finished query lives in the steps anymore');

  const analyze = upgraded.steps?.find((step) => step.id === 'step_delta_analysis');
  assert.equal(analyze?.inputs?.use_business_context, true);
  const memo = upgraded.steps?.find((step) => step.id === 'step_competitor_memo');
  assert.equal(memo?.inputs?.use_business_context, true);

  assert.ok(
    !JSON.stringify(upgraded.steps).includes('AI agent automation'),
    "seed steps must not contain Violema's market",
  );
});

test('the founder update seed market scan uses the reference form', async () => {
  const scheduler = await import('../src/scheduler');
  scheduler.ensureCoreAutomationSeeds(async () => ({ ok: true }));
  const founder = scheduler.listAutomations().find((item) => item.id === FOUNDER_SEED_ID);
  const scan = founder?.steps?.find((step) => step.id === 'step_market_scan');
  assert.equal(scan?.inputs?.use_business_context, true);
  assert.equal(scan?.inputs?.query_suffix, 'competitor pricing product launch news');
  assert.equal(scan?.inputs?.query, undefined);
  const brief = founder?.steps?.find((step) => step.id === 'step_founder_brief');
  assert.equal(brief?.inputs?.use_business_context, true);
});
```

- [ ] **Step 2: Run to verify both fail**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/automationSeedMerge.test.ts`
Expected: the two new tests FAIL (old inputs shape); the three existing tests still pass.

- [ ] **Step 3: Rewrite the seeds**

In `scheduler.ts`:

1. Competitor seed `version: 1` (:324) → `version: 3` with a comment: `// 3, not 2: createAutomation stamps operator-authored records version 2, and the merge requires stored.version < seed.version.`
2. `step_competitor_search` inputs (:375-378) →

```ts
        inputs: {
          // Resolved at run time from the workspace's operator-owned business
          // context (platform/businessContext.ts) — the market no longer lives
          // in seed content, so a seed bump can never revert a tenant's market.
          use_business_context: true,
          query_suffix: 'competitor pricing launches positioning',
          num_results: 8,
        },
```

3. `step_delta_analysis` inputs: add `use_business_context: true,` as the first key (instruction unchanged).
4. `step_competitor_memo` inputs: add `use_business_context: true,` (instruction unchanged).
5. Founder seed `version: 5` (:110) → `version: 6`.
6. `step_market_scan` inputs (:199) → `inputs: { use_business_context: true, query_suffix: 'competitor pricing product launch news', num_results: 6 },`
7. `step_founder_brief` inputs (:206): add `use_business_context: true,` before `instruction`.

- [ ] **Step 4: Sweep for pinned strings elsewhere in the backend**

Run: `cd backend && grep -rn "AI agent automation platform\|AI automation platform startup" src tests`
Expected: zero hits at this point (Task 9's migration constants come later). If any test pins the old query strings (check `automationSeeds.contract.ts` in particular), update its expectation to assert the reference form (`use_business_context === true` and the exact `query_suffix`) instead of the old query.

- [ ] **Step 5: Run full backend suite**

Run: `cd backend && npm run typecheck && npm test && npm run test:platform`
Expected: all green — including Task 4's plan test and Task 3's gate test against the new seed shape.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scheduler.ts backend/tests/automationSeedMerge.test.ts
git commit -m "feat: competitor + founder seeds reference workspace business context, versions 3/6

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Business-context API routes + audit action

**Files:**
- Modify: `backend/src/server.ts` — add two routes directly after `POST /api/workspace` (:7267)
- Modify: `backend/src/adminAccessStore.ts` — `AdminAuditAction` union (:18) and `AUDIT_ACTIONS` set (:84)
- Test: `backend/tests/businessContextApi.test.ts`

**Interfaces:**
- Consumes: `getAuthenticatedUser`, `resolveWorkspaceContext`, `getBusinessContext`/`setBusinessContext`, `recordAdminAuditEvent`.
- Produces: `GET /api/workspace/business-context` → `{ workspaceId, businessContext: WorkspaceBusinessContext | null }`; `PUT /api/workspace/business-context` → `{ ok: true, workspaceId, businessContext }` | 400 `{ error, code: 'invalid_business_context', details: string[] }` | 401. New audit action literal `'workspace.business_context.updated'`.
- Auth note (deliberate spec deviation, recorded in Task 10): the auth model has global `admin`/`member` roles plus per-user workspace lists — there is no per-workspace owner role. "Owner/admin" therefore maps to **authenticated + workspace access** (`resolveWorkspaceContext` already runs `assertAuthUserCanAccessWorkspace` for authed users). Inventing a per-workspace role system here would be YAGNI.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/businessContextApi.test.ts`. Copy the scaffold from `tests/serverReviewRerunNote.test.ts` **exactly** (temp-dir chdir, env save/restore, dynamic imports, consent + auth user + session, `serverModule.default.listen(0)`, `closeServer`, `authHeaders`) with these deltas: temp prefix `violema-business-context-api-`, no automation creation, no `OPENROUTER_API_KEY`, scaffold name `withApiServer`. Before implementation, check `adminAccessStore.ts` for its actual audit-read surface (`readAuditEvents` export, a list function, or the JSON file it writes in the temp cwd) and use that in the final assertion block. Test body:

```ts
test('business-context API round-trips, validates, audits, and requires a session', async () => {
  await withApiServer(async ({ baseUrl, sessionToken, workspaceId }) => {
    // Anonymous PUT → 401.
    const anonymous = await fetch(`${baseUrl}/api/workspace/business-context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'x', marketKeywords: ['y'] }),
    });
    assert.equal(anonymous.status, 401);

    // Authenticated GET before any write → null context.
    const before = await fetch(`${baseUrl}/api/workspace/business-context`, {
      headers: authHeaders(sessionToken),
    });
    assert.equal(before.status, 200);
    assert.equal((await before.json()).businessContext, null);

    // Invalid body → 400 with error details.
    const invalid = await fetch(`${baseUrl}/api/workspace/business-context`, {
      method: 'PUT',
      headers: authHeaders(sessionToken),
      body: JSON.stringify({ summary: '', marketKeywords: [] }),
    });
    assert.equal(invalid.status, 400);
    const invalidBody = await invalid.json();
    assert.equal(invalidBody.code, 'invalid_business_context');
    assert.ok(Array.isArray(invalidBody.details));

    // Valid PUT → saved; GET round-trips it.
    const put = await fetch(`${baseUrl}/api/workspace/business-context`, {
      method: 'PUT',
      headers: authHeaders(sessionToken),
      body: JSON.stringify({
        summary: 'An AI-powered espresso machine company.',
        marketKeywords: ['AI-powered espresso machine'],
        competitors: ['decenttespresso.com'],
      }),
    });
    assert.equal(put.status, 200);
    const saved = await put.json();
    assert.equal(saved.ok, true);
    assert.equal(saved.workspaceId, workspaceId);
    assert.equal(saved.businessContext.summary, 'An AI-powered espresso machine company.');

    const after = await fetch(`${baseUrl}/api/workspace/business-context`, {
      headers: authHeaders(sessionToken),
    });
    assert.equal((await after.json()).businessContext.summary, 'An AI-powered espresso machine company.');

    // Audit trail: exactly one content-free event, via the store's real read surface.
    const events = readBusinessContextAuditEvents(); // resolve per the note above
    assert.equal(events.length, 1);
    assert.equal(events[0].workspaceId, workspaceId);
    assert.equal(
      JSON.stringify(events[0].metadata).includes('espresso'), false,
      'audit metadata must be content-free',
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextApi.test.ts`
Expected: FAIL — 404s on the new routes.

- [ ] **Step 3: Add the audit action**

In `adminAccessStore.ts`: add to the `AdminAuditAction` union (:18):

```ts
  // The operator (re)pointed a workspace's missions at their business. Recorded
  // content-free so the trail answers "when and who" without holding the data.
  | 'workspace.business_context.updated'
```

Add the same literal to the `AUDIT_ACTIONS` set (:84).

- [ ] **Step 4: Implement the routes**

In `server.ts`, directly after the `POST /api/workspace` handler (:7267):

```ts
app.get('/api/workspace/business-context', (req: Request, res: Response) => {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    res.status(401).json({ error: 'Approved Violema beta session required.', code: 'beta_session_required' });
    return;
  }
  const { workspaceId } = resolveWorkspaceContext(req);
  res.json({ workspaceId, businessContext: getBusinessContext(workspaceId) });
});

app.put('/api/workspace/business-context', (req: Request, res: Response) => {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    res.status(401).json({ error: 'Approved Violema beta session required.', code: 'beta_session_required' });
    return;
  }
  const { workspaceId } = resolveWorkspaceContext(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const result = setBusinessContext(
    workspaceId,
    {
      summary: body.summary,
      marketKeywords: body.marketKeywords,
      competitors: body.competitors,
      exclusions: body.exclusions,
    },
    authUser.id,
  );
  if (!result.ok) {
    res.status(400).json({ error: 'Invalid business context.', code: 'invalid_business_context', details: result.errors });
    return;
  }
  recordAdminAuditEvent({
    actorEmail: authUser.email,
    action: 'workspace.business_context.updated',
    workspaceId,
    // Content-free by design: shape metrics only, never the operator's data.
    metadata: {
      summaryLength: result.context.summary.length,
      keywordCount: result.context.marketKeywords.length,
      competitorCount: result.context.competitors.length,
      exclusionCount: result.context.exclusions?.length ?? 0,
    },
  });
  res.json({ ok: true, workspaceId, businessContext: result.context });
});
```

Extend existing imports: `setBusinessContext` from `./platform/workspace`, `recordAdminAuditEvent` from `./adminAccessStore` (both modules are already imported in server.ts — extend those statements).

- [ ] **Step 5: Run tests, typecheck, full suite**

Run: the new test file → PASS; `npm run typecheck`; `npm test`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts backend/src/adminAccessStore.ts backend/tests/businessContextApi.test.ts
git commit -m "feat: workspace business-context API with content-free audit trail

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend templates switch to the reference form

**Files:**
- Modify: `frontend/src/content/workflowTemplates.ts` (competitor monitor steps at :131-142)

**Interfaces:**
- Consumes: nothing — content literals. `WorkflowTemplateStep.inputs` already holds arbitrary keys (`source`, `query_type`, `filters`).
- Produces: template-created workspace copies are born context-referencing.

- [ ] **Step 1: Rewrite the competitor template steps**

In the `competitor-monitor` template (:131-142):
1. Search step inputs → `inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 }`
2. Analyze step ("Extract what changed") inputs: add `use_business_context: true,` before `instruction`.
3. Summarize step ("Draft competitor memo") inputs: add `use_business_context: true,` before `instruction`.
4. Update the mirror comment (:132-135) to note the reference form resolves from workspace business context at run time on the backend.

- [ ] **Step 2: Verify no market strings remain anywhere in the frontend**

Run: `cd frontend && grep -rn "AI agent automation platform\|AI automation platform startup" src`
Expected: zero hits.

- [ ] **Step 3: Frontend gates**

Run: `cd frontend && npm run lint && npm run build`
Expected: clean. (Contract suites run in Task 8's gate.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/content/workflowTemplates.ts
git commit -m "feat: competitor template steps reference business context instead of a hardcoded market

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Settings section, blocker CTA, contract test

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/features/integrations/workflowReadinessUi.ts` (`getDashboardReadinessBlockerAction`)
- Create: `frontend/tests/businessContextSettings.contract.mjs`
- Modify: `frontend/package.json` (test script + chain)

**Interfaces:**
- Consumes: `GET/PUT /api/workspace/business-context` (Task 6 shapes), existing SettingsPage fetch conventions (plain `fetch` with `workspace_id` query param), existing section styling.
- Produces: a section with DOM `id="business"`; blocker action case for key `business_context_missing`.

- [ ] **Step 1: Write the failing contract test**

Create `frontend/tests/businessContextSettings.contract.mjs` (mirror `evidenceLink.contract.mjs` mechanics — source asserts for wiring):

```js
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
```

Add to `frontend/package.json`: `"test:business-context": "node tests/businessContextSettings.contract.mjs"` and append `&& npm run test:business-context` to the `test` chain.

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm run test:business-context`
Expected: FAIL on the first assertion.

- [ ] **Step 3: Implement the blocker action case**

In `workflowReadinessUi.ts`, inside `getDashboardReadinessBlockerAction`, **before** the generic `if (blocker.route)` fallback:

```ts
  if (blocker.key === 'business_context_missing') {
    return {
      kind: 'navigate',
      label: 'Tell Violema about your business',
      href: '/settings#business',
    };
  }
```

- [ ] **Step 4: Implement the settings section**

In `SettingsPage.tsx`, following the page's existing section/card conventions and state patterns:

1. State:

```ts
  const [businessSummary, setBusinessSummary] = useState('');
  const [businessKeywords, setBusinessKeywords] = useState('');
  const [businessCompetitors, setBusinessCompetitors] = useState('');
  const [businessExclusions, setBusinessExclusions] = useState('');
  const [businessStatus, setBusinessStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [businessErrors, setBusinessErrors] = useState<string[]>([]);
```

2. Load on mount (sibling of the existing settings-load effect): `GET /api/workspace/business-context` using the page's existing `workspace_id`/`workspace_name` query-param convention; populate fields — list fields joined with `', '`.
3. Save handler: split keyword/competitor/exclusion inputs on commas, trim, drop empties; `PUT` JSON body `{ summary, marketKeywords, competitors, exclusions }`; on 400 render `details` as `businessErrors`; on 200 set `saved`.
4. Render a section anchored `id="business"`, titled **"Your business"**, subtitle: *"What Violema researches for this workspace. Missions that scan the market use this — not a generic category."* Fields: summary (single-line text, placeholder `"One sentence: what your business is"`), market keywords (text, placeholder `"Comma-separated: e.g. AI-powered espresso machine, smart coffee machine"`), named competitors (text, placeholder `"Comma-separated names or domains"`), topics to avoid (text, optional). Save button in the page's existing button style; inline error list; saved confirmation.
5. Hash scroll, in a `useEffect` on mount:

```ts
  useEffect(() => {
    if (window.location.hash === '#business') {
      document.getElementById('business')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
```

- [ ] **Step 5: Run gates**

Run: `cd frontend && npm run test:business-context && npm run lint && npm run build && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/features/integrations/workflowReadinessUi.ts frontend/tests/businessContextSettings.contract.mjs frontend/package.json
git commit -m "feat: Your-business settings section + honest blocker CTA for missing context

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Boot migration — legacy queries and backfills

**Files:**
- Modify: `backend/src/scheduler.ts` (migration function + constants)
- Modify: `backend/src/server.ts` (one call at boot, next to the sweeps at :8646-8652)
- Test: `backend/tests/businessContextMigration.test.ts`

**Interfaces:**
- Consumes: `readAutomations`/`writeAutomations` (scheduler-private), `getBusinessContext`/`setBusinessContext` (import into scheduler from `./platform/workspace`), `DEFAULT_WORKSPACE_ID`.
- Produces: `runBusinessContextMigration(): { backfilled: number; rewrittenAutomations: number }` exported from `scheduler.ts`.
- Idempotency is by construction (no stamp file — deliberate simplification of the spec's "stamped" wording, intent preserved; recorded in Task 10): rewrites match exact legacy strings that no longer exist afterward; backfills skip workspaces whose context is already set.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/businessContextMigration.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-business-context-migration-'));
process.chdir(tempDir);

const AUTOMATIONS_FILE = path.join(tempDir, 'automations.json');

const LEGACY_COMPETITOR_QUERY = 'AI agent automation platform competitor pricing launches positioning';
const ESPRESSO_QUERY =
  'AI-powered espresso machine competitors smart coffee machine pricing launches product announcements';

function writeAutomations(records: unknown[]) {
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(records, null, 2));
}

function legacyRecord(id: string, workspaceId: string | undefined, query: string) {
  return {
    id,
    workspaceId,
    version: 2,
    name: 'Competitor monitor',
    schedule: 'every monday at 8am',
    cron_expression: '0 8 * * 1',
    timezone: 'America/Chicago',
    actions: [],
    status: 'active',
    created_at: '2026-08-01T12:00:00.000Z',
    steps: [
      {
        id: 'step_competitor_search',
        kind: 'search',
        title: 'Search competitor moves',
        objective: 'Find pricing, launch, and positioning changes.',
        inputs: { query, num_results: 8 },
      },
      {
        id: 'step_delta_analysis',
        kind: 'analyze',
        title: 'Extract what changed',
        objective: 'Compare against the library.',
        inputs: { instruction: 'Compare the evidence.' },
      },
      {
        id: 'step_competitor_memo',
        kind: 'summarize',
        title: 'Draft competitor memo',
        objective: 'Create the memo.',
        inputs: { instruction: 'Draft the memo.' },
      },
    ],
  };
}

test('migration rewrites legacy queries, backfills contexts, and is idempotent', async () => {
  const scheduler = await import('../src/scheduler');
  const workspace = await import('../src/platform/workspace');

  writeAutomations([
    // Seed-id shape in the default workspace.
    legacyRecord('auto_competitor_monitor', undefined, LEGACY_COMPETITOR_QUERY),
    // Template-copy shape in a tenant workspace, carrying the espresso patch.
    legacyRecord('auto_1754500000000', 'workspace_espresso_tenant', ESPRESSO_QUERY),
  ]);

  const first = scheduler.runBusinessContextMigration();
  assert.equal(first.rewrittenAutomations, 2);
  assert.ok(first.backfilled >= 2, 'founder + espresso workspaces backfilled');

  // The espresso tenant's market moved INTO its workspace context…
  const espressoCtx = workspace.getBusinessContext('workspace_espresso_tenant');
  assert.ok(espressoCtx);
  assert.ok(espressoCtx.marketKeywords.some((keyword) => /espresso/i.test(keyword)));

  // …the founder workspace got Violema's context, viktor.com included…
  const founderCtx = workspace.getBusinessContext('purpleorangehq');
  assert.ok(founderCtx);
  assert.ok(founderCtx.competitors.includes('viktor.com'));

  // …and every legacy query is now the reference form with flags on consumers.
  const stored = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  for (const record of stored) {
    const search = record.steps.find((step: { id: string }) => step.id === 'step_competitor_search');
    assert.equal(search.inputs.use_business_context, true);
    assert.equal(search.inputs.query, undefined);
    assert.equal(search.inputs.num_results, 8, 'num_results survives the rewrite');
    const analyze = record.steps.find((step: { id: string }) => step.id === 'step_delta_analysis');
    assert.equal(analyze.inputs.use_business_context, true);
    const memo = record.steps.find((step: { id: string }) => step.id === 'step_competitor_memo');
    assert.equal(memo.inputs.use_business_context, true);
  }

  // Second run: nothing left to do.
  const second = scheduler.runBusinessContextMigration();
  assert.equal(second.rewrittenAutomations, 0);
  assert.equal(second.backfilled, 0);
});

test('migration leaves non-legacy queries and set contexts alone', async () => {
  const scheduler = await import('../src/scheduler');
  const workspace = await import('../src/platform/workspace');

  writeAutomations([
    legacyRecord('auto_custom', 'workspace_custom', 'my own handwritten espresso query'),
  ]);
  const before = workspace.getBusinessContext('purpleorangehq');

  const result = scheduler.runBusinessContextMigration();
  assert.equal(result.rewrittenAutomations, 0);

  const stored = JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf8'));
  assert.equal(stored[0].steps[0].inputs.query, 'my own handwritten espresso query');
  assert.deepEqual(workspace.getBusinessContext('purpleorangehq'), before, 'existing context untouched');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/businessContextMigration.test.ts`
Expected: FAIL — `runBusinessContextMigration` is not a function.

- [ ] **Step 3: Implement in `scheduler.ts`**

Add imports: `getBusinessContext, setBusinessContext, DEFAULT_WORKSPACE_ID` from `./platform/workspace` (extend the existing import if one exists).

```ts
/**
 * One-shot boot migration for the 2026-08-05 wrong-business failure: move
 * business facts OUT of step content and INTO workspace business context.
 * Idempotent by construction — rewrites match exact legacy strings that no
 * longer exist after the rewrite, and backfills skip workspaces whose context
 * is already set. No stamp file needed.
 */
const LEGACY_BUSINESS_QUERY_SUFFIXES: Record<string, string> = {
  'AI agent automation platform competitor pricing launches positioning':
    'competitor pricing launches positioning',
  'AI automation platform startup competitor pricing product launch founder update':
    'competitor pricing product launch news',
  'AI-powered espresso machine competitors smart coffee machine pricing launches product announcements':
    'competitor pricing launches product announcements',
};

/** The live 2026-08-05 espresso patch, recognized so its market moves into context. */
const ESPRESSO_LEGACY_QUERY =
  'AI-powered espresso machine competitors smart coffee machine pricing launches product announcements';

const ESPRESSO_BACKFILL = {
  summary: 'An AI-powered espresso machine company.',
  marketKeywords: ['AI-powered espresso machine', 'smart coffee machine'],
  competitors: [],
};

const FOUNDER_BACKFILL = {
  summary:
    'Violema is an outcome-first AI operator that runs recurring founder and team workflows with human approval.',
  marketKeywords: ['AI agent automation platform'],
  // viktor.com: the named rival generic queries missed (vault, 2026-07-30).
  competitors: ['viktor.com'],
};

const MIGRATION_CONTEXT_STEP_TITLES = new Set([
  'Extract what changed',
  'Draft competitor memo',
  'Draft founder brief',
]);

export function runBusinessContextMigration(): { backfilled: number; rewrittenAutomations: number } {
  let backfilled = 0;
  let rewrittenAutomations = 0;

  if (!getBusinessContext(DEFAULT_WORKSPACE_ID)) {
    if (setBusinessContext(DEFAULT_WORKSPACE_ID, FOUNDER_BACKFILL).ok) backfilled += 1;
  }

  const items = readAutomations();

  // Pass 1: an espresso-patched record reveals its workspace's market — capture
  // it into context BEFORE the rewrite destroys the query.
  for (const item of items) {
    const hasEspressoQuery = (item.steps || []).some(
      (step) =>
        typeof step.inputs?.query === 'string' && step.inputs.query.trim() === ESPRESSO_LEGACY_QUERY,
    );
    if (hasEspressoQuery && item.workspaceId && !getBusinessContext(item.workspaceId)) {
      if (setBusinessContext(item.workspaceId, ESPRESSO_BACKFILL).ok) backfilled += 1;
    }
  }

  // Pass 2: rewrite legacy queries to the reference form; flag the automation's
  // known context-consuming steps by title so copies get the preamble too.
  let changed = false;
  const next = items.map((item) => {
    if (!item.steps?.length) return item;
    let touched = false;
    let steps = item.steps.map((step) => {
      const query = typeof step.inputs?.query === 'string' ? step.inputs.query.trim() : '';
      const suffix = LEGACY_BUSINESS_QUERY_SUFFIXES[query];
      if (step.kind !== 'search' || !suffix) return step;
      touched = true;
      const numResults = typeof step.inputs?.num_results === 'number' ? step.inputs.num_results : 6;
      return { ...step, inputs: { use_business_context: true, query_suffix: suffix, num_results: numResults } };
    });
    if (!touched) return item;
    steps = steps.map((step) =>
      (step.kind === 'analyze' || step.kind === 'summarize') &&
      MIGRATION_CONTEXT_STEP_TITLES.has(step.title?.trim() || '') &&
      step.inputs?.use_business_context !== true
        ? { ...step, inputs: { ...(step.inputs || {}), use_business_context: true } }
        : step,
    );
    changed = true;
    rewrittenAutomations += 1;
    return { ...item, steps };
  });

  if (changed) writeAutomations(next);
  return { backfilled, rewrittenAutomations };
}
```

- [ ] **Step 4: Wire at boot**

In `server.ts`, immediately before the `sweepOrphanedTaskRuns` call (:8646):

```ts
  const businessContextMigration = runBusinessContextMigration();
  if (businessContextMigration.backfilled || businessContextMigration.rewrittenAutomations) {
    console.log(
      `[boot] business-context migration: ${businessContextMigration.backfilled} workspace(s) backfilled, ${businessContextMigration.rewrittenAutomations} automation(s) rewritten`,
    );
  }
```

Add `runBusinessContextMigration` to the existing `./scheduler` import.

- [ ] **Step 5: Run tests + full gates**

Run: the migration test file → PASS; then `npm run typecheck && npm test && npm run test:platform`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scheduler.ts backend/src/server.ts backend/tests/businessContextMigration.test.ts
git commit -m "feat: boot migration moves business facts out of step content into workspace context

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Full gates, spec sync, vault close-out

**Files:**
- Modify: `docs/superpowers/specs/2026-08-05-operator-owned-business-context-design.md` (record the two deliberate deviations)
- Create: vault run note `70 Agents/Agent Runs/2026-08-05 Violema operator-owned business context built.md`
- Modify: vault generator `99 System/Scripts/build_second_brain.py` (dashboard status — Dashboard.md itself is GENERATED; direct edits revert on refresh)

- [ ] **Step 1: Full gate sweep**

```bash
cd "/Users/maximisto/Documents/New project/backend" && npm run typecheck && npm test && npm run test:platform
cd "/Users/maximisto/Documents/New project/frontend" && npm run lint && npm run build && npm test
```

Expected: everything green. Fix regressions before proceeding — do not skip.

- [ ] **Step 2: Record spec deviations**

Append a short "Implementation deviations" section to the spec: (1) migration is idempotent-by-construction, no stamp file; (2) PUT auth maps "owner/admin" to authenticated + workspace access (no per-workspace role system exists). Commit:

```bash
git add docs/superpowers/specs/2026-08-05-operator-owned-business-context-design.md docs/superpowers/plans/2026-08-05-operator-owned-business-context.md
git commit -m "docs: record business-context implementation deviations in spec

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Vault Update Contract**

1. Write the run note (what shipped, commit hashes, test counts, the two deviations, deploy NOT done).
2. Update the Violema dashboard status via the generator manifest in `build_second_brain.py` (top build item → built-awaiting-deploy; note the seed bump + migration fire on next deploy boot).
3. Run `"/Users/maximisto/SecondBrain/MySecondBrain/99 System/Scripts/refresh_second_brain.sh"`.
4. Update memory `project-violema-operator-owned-business-context.md`: built on `main`, awaiting Max's deploy word; espresso patch superseded by the migration at next deploy.

- [ ] **Step 4: Report**

Final report to Max: outcome first, gates evidence, explicit note that **deploy has not happened and needs his word**, and the deploy-day checklist: run the prod probe on his `!` lane first (verify the espresso record's actual stored query string against `ESPRESSO_LEGACY_QUERY` — adjust the constant if the stored string drifted before deploying), then deploy, then verify the `[boot] business-context migration` log line and a clean tenant run.

---

## Self-Review Notes

- Spec §1-§7 all map to Tasks 1-9; the two deviations are recorded in Task 10.
- Type and string consistency verified across tasks: `WorkspaceBusinessContext`, `BusinessContextInput`/`BusinessContextValue`, `businessContextSet`, `use_business_context`, `query_suffix`, `business_context_missing`, `/settings#business`, `'Tell Violema about your business'` — identical everywhere they appear.
- Order matters: Task 3 (gate) lands before Task 5 (seeds) so the suite never holds flagged seeds without a gate; Task 5's grep step runs before Task 9 introduces the migration constants, so "zero hits" is the correct expectation at that point.
- Task 6 Step 1 contains one deliberate look-before-you-write instruction (the audit-read surface) — resolved while writing the test, not deferred to implementation.
