# Controlled Beta Access, Pricing, and Trial Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a transparent but approval-gated beta flow with versioned confidentiality acceptance, explicit participant types, accurate pricing copy, and one idempotent 500-credit trial grant for every approved non-admin participant.

**Architecture:** Keep authorization roles (`user`, `admin`) separate from participant classification (`founder_operator`, `investor`, `partner`). Add a strict append-only consent store and an idempotent beta-entitlement service, then wire them into verified OAuth callbacks, admin approval, protected API middleware, and a reacceptance page. Preserve `/pricing` as a public qualification surface while the homepage uses a compact controlled-beta price anchor.

**Tech Stack:** TypeScript, Node.js, Express, React 18, React Router, JSON atomic stores, Node test runner with `ts-node/register`, frontend contract tests through `npx --yes tsx`, Stripe checkout/webhooks.

## Global Constraints

- Start remains `$79/month` with `2,000` credits; Pro remains `$249/month` with `7,500` credits; Enterprise remains custom.
- Homepage pricing must be framed as controlled-beta pricing, not instant self-serve checkout.
- Every approved non-admin participant receives exactly one `500`-credit trial grant.
- Authorization roles remain only `user` and `admin`.
- Participant types are exactly `founder_operator`, `investor`, and `partner`.
- Current Terms version is exactly `2026-07-11-beta-confidentiality-v1`.
- No new runtime dependency is allowed.
- Existing ledger balances and unrelated dirty worktree files must be preserved.
- Normal users continue to authenticate through Google or Microsoft; the admin magic-link path remains separate.
- Client-supplied participant type, acceptance state, or role never grants protected access without server verification.
- Legal copy must retain the explicit counsel-review boundary from the approved design.

---

## File Structure

### New backend units

- `backend/src/betaProgram.ts`: participant-type normalization, current Terms version, canonical confidentiality text, and SHA-256 digest.
- `backend/src/betaConsentStore.ts`: strict append-only consent receipts and current-version queries.
- `backend/src/betaTrialCredits.ts`: one-time beta trial entitlement and stable ledger reference.
- `backend/tests/betaConsentStore.test.ts`: consent validation, append-only behavior, and malformed-store failure.
- `backend/tests/betaTrialCredits.test.ts`: trial eligibility, idempotency, and legacy-seed removal.

### New frontend unit

- `frontend/src/pages/AccessTerms.tsx`: current-version review and reacceptance page.
- `frontend/tests/betaAccess.contract.ts`: signup participant classification, Terms messaging, access-term route, and protected-route behavior.

### Existing files with focused changes

- `backend/src/adminAccessStore.ts`: application evidence and participant classification.
- `backend/src/adminRoutes.ts`: approval-readiness enforcement and participant updates.
- `backend/src/adminDashboard.ts`: participant, Terms, and trial status projection.
- `backend/src/auth.ts`: user participant/consent fields and current-Terms helpers.
- `backend/src/server.ts`: OAuth state, verified application capture, consent receipt, reacceptance endpoint, access middleware, and trial fulfillment.
- `backend/src/betaAccess.ts`: keep Terms/session endpoints publicly routable while handlers authenticate sensitive operations.
- `backend/src/platform/types.ts`: trial credit source/reference types.
- `backend/src/platform/store.ts`: remove implicit Legacy Starter credit creation.
- `backend/src/platform/billing.ts`: remove unsupported seat packaging.
- `backend/tests/authAccess.test.ts`: approval readiness and role/participant separation.
- `backend/tests/adminDashboard.test.ts`: admin projection and mutation validation.
- `backend/tests/serverAdminRoutes.test.ts`: approval API rejects incomplete applicants.
- `backend/tests/serverTenantRoutes.test.ts`: stale Terms and revocation remain fail-closed.
- `backend/tests/stripeBillingConfig.test.ts`: plan credits stay fixed and Pro no longer advertises five seats.
- `frontend/src/content/homepage.ts`: controlled-beta pricing language.
- `frontend/src/components/BetaAccess.tsx`: compact price anchor and approval language.
- `frontend/src/pages/Billing.tsx`: accurate mission guidance and no seat claim.
- `frontend/src/pages/Signup.tsx`: participant type and explicit confidentiality acceptance.
- `frontend/src/pages/Login.tsx`: stop synthesizing Terms acceptance.
- `frontend/src/pages/TermsOfService.tsx`: Beta Confidentiality and Evaluation Terms.
- `frontend/src/lib/auth.ts`: backend-owned participant and current-Terms state.
- `frontend/src/components/ProtectedRoute.tsx`: redirect stale Terms to `/access-terms`.
- `frontend/src/App.tsx`: register `/access-terms`.
- `frontend/src/pages/AdminDashboard.tsx`: participant/Terms/trial visibility and approval readiness.
- `frontend/tests/publicLaunchSurface.contract.ts`: transparent controlled-beta price posture.
- `frontend/tests/pricingPackaging.contract.ts`: plan copy contract.

---

### Task 1: Make Public Pricing and Packaging Honest

**Files:**
- Modify: `frontend/tests/publicLaunchSurface.contract.ts`
- Create: `frontend/tests/pricingPackaging.contract.ts`
- Modify: `frontend/src/content/homepage.ts`
- Modify: `frontend/src/components/BetaAccess.tsx`
- Modify: `frontend/src/pages/Billing.tsx`
- Modify: `backend/src/platform/billing.ts`
- Modify: `backend/tests/stripeBillingConfig.test.ts`

**Interfaces:**
- Consumes: existing `betaAccessSteps`, `betaAccessSignals`, and `PLANS` page model.
- Produces: controlled-beta homepage copy and package copy used by later end-to-end smoke checks.

- [ ] **Step 1: Change the public launch contract first**

Replace the price-hiding assertions with controlled-beta assertions:

```ts
const controlledBetaCopy = [...visibleLaunchCopy, betaAccessComponent].join(' ');

assert(controlledBetaCopy.includes('$79'), 'homepage anchors Start at $79');
assert(controlledBetaCopy.includes('$249'), 'homepage anchors Pro at $249');
assert(/500 trial credits/i.test(controlledBetaCopy), 'homepage states the beta trial amount');
assert(/manual approval/i.test(controlledBetaCopy), 'homepage states manual approval');
assert(/confidential/i.test(controlledBetaCopy), 'homepage states beta confidentiality');
assert(!/buy now|instant access|start checkout/i.test(controlledBetaCopy), 'homepage does not promise self-serve access');
```

- [ ] **Step 2: Add the package-copy contract**

Create `frontend/tests/pricingPackaging.contract.ts`:

```ts
import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const billingPage = readFileSync(new URL('../src/pages/Billing.tsx', import.meta.url), 'utf8');
const backendCatalog = readFileSync(new URL('../../backend/src/platform/billing.ts', import.meta.url), 'utf8');

assert(billingPage.includes('Best for 1–3 active missions'), 'Start mission guidance is present');
assert(billingPage.includes('Best for 5–10 active missions'), 'Pro mission guidance is present');
assert(billingPage.includes('Actual run volume depends on mission complexity and credit usage.'), 'workload caveat is present');
assert(!/5 seats|extra seat|Included seats/i.test(billingPage), 'public pricing has no unsupported seat claim');
assert(!/5 included seats|extraSeatPriceUsd:\s*29/.test(backendCatalog), 'backend Pro packaging has no unsupported seat claim');

console.log('pricingPackaging.contract: pricing packaging verified');
```

- [ ] **Step 3: Run both contracts and verify RED**

Run:

```bash
cd frontend
npx --yes tsx tests/publicLaunchSurface.contract.ts
npx --yes tsx tests/pricingPackaging.contract.ts
```

Expected: both fail because the homepage does not state the full controlled-beta conditions and the pricing page still uses the old mission/seat copy.

- [ ] **Step 4: Implement the minimum public copy**

Use these exact homepage signals:

```ts
export const betaAccessSignals: BetaAccessSignal[] = [
  { label: 'Beta access', value: 'Manual approval' },
  { label: 'Trial', value: '500 credits' },
  { label: 'Start', value: '$79/mo' },
  { label: 'Pro', value: '$249/mo' },
];
```

Use this exact BetaAccess price paragraph:

```tsx
<p className="mt-2 max-w-3xl text-sm leading-6 text-[#aeb7cd]">
  Approved participants receive 500 trial credits. Paid access starts at $79 per month; Pro is $249 per month. Identity verification, beta confidentiality terms, and manual approval are required.
</p>
```

Change the pricing plan model to:

```ts
missions: 'Best for 1–3 active missions',
// ...
missions: 'Best for 5–10 active missions',
```

Remove `seats` and the seat block. Add below the plan metrics:

```tsx
<p className="mt-3 text-xs leading-5 text-slate-500">
  Actual run volume depends on mission complexity and credit usage.
</p>
```

In the backend Pro catalogue, set `includedSeats: 1`, remove `extraSeatPriceUsd`, and remove `5 included seats` from `features`. Preserve Start/Pro prices and credits.

- [ ] **Step 5: Run GREEN checks**

Run:

```bash
cd frontend
npx --yes tsx tests/publicLaunchSurface.contract.ts
npx --yes tsx tests/pricingPackaging.contract.ts
cd ../backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/stripeBillingConfig.test.ts
```

Expected: all three pass.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add frontend/tests/publicLaunchSurface.contract.ts frontend/tests/pricingPackaging.contract.ts frontend/src/content/homepage.ts frontend/src/components/BetaAccess.tsx frontend/src/pages/Billing.tsx backend/src/platform/billing.ts backend/tests/stripeBillingConfig.test.ts
git commit -m "fix(pricing): align beta packaging with product access"
```

---

### Task 2: Add Participant Types and Versioned Consent Receipts

**Files:**
- Create: `backend/src/betaProgram.ts`
- Create: `backend/src/betaConsentStore.ts`
- Create: `backend/tests/betaConsentStore.test.ts`
- Modify: `backend/src/adminAccessStore.ts`
- Modify: `backend/tests/authAccess.test.ts`

**Interfaces:**
- Produces: `ParticipantType`, `CURRENT_BETA_TERMS_VERSION`, `CURRENT_BETA_TERMS_DIGEST`, `recordBetaConsent()`, `getCurrentBetaConsent()`, and `hasCurrentBetaConsent()`.
- Later tasks consume these exact exports.

- [ ] **Step 1: Write the failing consent-store test**

Create a temporary-directory test covering normalization, append-only receipts, current-version lookup, and malformed-store failure:

```ts
test('beta consent receipts are append-only and current-version aware', () => withTempConsentStore(() => {
  const first = recordBetaConsent({
    email: 'INVESTOR@example.com',
    participantType: 'investor',
    authMethod: 'google',
    acceptanceSource: 'oauth_callback',
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt: '2026-07-11T12:00:00.000Z',
  });

  assert.equal(first.email, 'investor@example.com');
  assert.equal(hasCurrentBetaConsent('investor@example.com'), true);
  assert.equal(getCurrentBetaConsent('investor@example.com')?.id, first.id);

  const repeated = recordBetaConsent({
    email: first.email,
    participantType: first.participantType,
    authMethod: first.authMethod,
    acceptanceSource: first.acceptanceSource,
    termsVersion: first.termsVersion,
    termsDigest: first.termsDigest,
    acceptedAt: '2026-07-11T12:01:00.000Z',
  });
  assert.notEqual(repeated.id, first.id);
  assert.equal(listBetaConsentReceipts('investor@example.com').length, 2);
}));
```

Also assert `normalizeParticipantType('tester')` returns `null` and missing values default only through `defaultParticipantType()`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd backend
NODE_ENV=test node --test -r ts-node/register tests/betaConsentStore.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the beta program constants**

Create `backend/src/betaProgram.ts`:

```ts
import crypto from 'crypto';

export type ParticipantType = 'founder_operator' | 'investor' | 'partner';
export const PARTICIPANT_TYPES: ParticipantType[] = ['founder_operator', 'investor', 'partner'];
export const CURRENT_BETA_TERMS_VERSION = '2026-07-11-beta-confidentiality-v1';
export const BETA_TERMS_PATH = '/terms#beta-confidentiality';
export const CURRENT_BETA_TERMS_CANONICAL_TEXT = `Beta Confidentiality and Evaluation Terms

Beta information. "Beta Information" means nonpublic information disclosed through or about the controlled beta, including pre-release product behavior, interfaces, documentation, benchmarks, roadmaps, pricing experiments, and nonpublic commercial or technical information.

Evaluation-only use. You may use Beta Information only to evaluate VIOLEMA and provide feedback during your approved participation. You may not use Beta Information for any other purpose without Purple Orange AI's written permission.

Protection and disclosure. You must use reasonable care to protect Beta Information and may not disclose it to any third party without Purple Orange AI's written permission.

Exclusions. Beta Information does not include information that you can document was already public through no breach of these Terms, previously known to you without restriction, independently developed without use of Beta Information, or lawfully received from another source without a duty of confidentiality.

Required disclosure. If law or valid legal process requires disclosure, you may disclose only what is legally required and, when permitted, must give Purple Orange AI prompt advance notice and reasonable assistance in seeking protective treatment.

Publicity restrictions. During the confidential beta, you may not publish screenshots, recordings, benchmarks, roadmaps, or public claims about the product without Purple Orange AI's written approval.

Duration. These obligations continue for two years after your last beta access. Information qualifying as a trade secret remains protected for as long as it qualifies as a trade secret under applicable law.

Participant data. Purple Orange AI's obligation to protect participant workspace data continues under the Privacy Policy and applicable onboarding terms.

Counsel-review notice. This beta confidentiality language should be reviewed by qualified counsel before broad external onboarding.`;
export const CURRENT_BETA_TERMS_DIGEST = crypto
  .createHash('sha256')
  .update(CURRENT_BETA_TERMS_CANONICAL_TEXT)
  .digest('hex');

export function normalizeParticipantType(value: unknown): ParticipantType | null {
  return typeof value === 'string' && PARTICIPANT_TYPES.includes(value as ParticipantType)
    ? value as ParticipantType
    : null;
}

export function defaultParticipantType(): ParticipantType {
  return 'founder_operator';
}
```

- [ ] **Step 4: Implement the strict append-only store**

Create `backend/src/betaConsentStore.ts` using `readJsonFile` only for absence and a strict local reader for existing files. Export:

```ts
export interface BetaConsentReceipt {
  id: string;
  email: string;
  participantType: ParticipantType;
  termsVersion: string;
  termsDigest: string;
  acceptedAt: string;
  authMethod: 'google' | 'microsoft' | 'email';
  acceptanceSource: 'signup' | 'oauth_callback' | 'reauthorization';
  termsPath: string;
}

export function recordBetaConsent(input: Omit<BetaConsentReceipt, 'id' | 'termsPath'>): BetaConsentReceipt;
export function listBetaConsentReceipts(email?: string): BetaConsentReceipt[];
export function getCurrentBetaConsent(email: string): BetaConsentReceipt | null;
export function hasCurrentBetaConsent(email: string): boolean;
```

Write with `writeJsonFile()` and prepend new receipts. Validate email normalization, participant type, ISO timestamp, 64-character digest, known auth method/source, and uniqueness of receipt IDs. Never update or delete an earlier receipt.

- [ ] **Step 5: Extend access records without changing authorization roles**

Add to `AdminAccessRecord`:

```ts
participantType: ParticipantType;
identityVerifiedAt?: string;
acceptedTermsVersion?: string;
acceptedTermsAt?: string;
```

Extend `recordAccessRequest()` input with the same optional evidence. Normalize legacy records to `founder_operator`. Preserve stronger existing evidence when a duplicate request arrives.

- [ ] **Step 6: Run GREEN checks**

```bash
cd backend
NODE_ENV=test node --test -r ts-node/register tests/betaConsentStore.test.ts tests/authAccess.test.ts
```

Expected: all consent and existing access tests pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add backend/src/betaProgram.ts backend/src/betaConsentStore.ts backend/src/adminAccessStore.ts backend/tests/betaConsentStore.test.ts backend/tests/authAccess.test.ts
git commit -m "feat(auth): record versioned beta consent"
```

---

### Task 3: Enforce Approval Readiness and Project It to Admin

**Files:**
- Modify: `backend/src/adminAccessStore.ts`
- Modify: `backend/src/adminRoutes.ts`
- Modify: `backend/src/adminDashboard.ts`
- Modify: `backend/tests/adminDashboard.test.ts`
- Modify: `backend/tests/serverAdminRoutes.test.ts`

**Interfaces:**
- Consumes: `ParticipantType`, `CURRENT_BETA_TERMS_VERSION`, and consent queries from Task 2.
- Produces: `isAccessRecordApprovalReady()`, `assertAccessRecordApprovalReady()`, `parseParticipantType()`, and admin user fields used by Task 7.

- [ ] **Step 1: Write failing approval-readiness tests**

Add assertions:

```ts
const incomplete = recordAccessRequest({
  email: 'partner@example.com',
  participantType: 'partner',
  method: 'google',
});
assert.equal(isAccessRecordApprovalReady(incomplete), false);
assert.throws(() => setAccessStatus({
  email: incomplete.email,
  status: 'approved',
  updatedBy: 'max@violema.com',
}), /verified identity and current beta terms/i);
```

Then create a receipt, update the access record with `identityVerifiedAt`, `acceptedTermsVersion`, and `acceptedTermsAt`, and assert approval succeeds.

- [ ] **Step 2: Run RED**

```bash
cd backend
NODE_ENV=test node --test -r ts-node/register tests/authAccess.test.ts tests/adminDashboard.test.ts tests/serverAdminRoutes.test.ts
```

Expected: FAIL because approval readiness and participant parsing are absent.

- [ ] **Step 3: Implement readiness enforcement**

Export:

```ts
export function isAccessRecordApprovalReady(record: AdminAccessRecord) {
  return Boolean(
    record.identityVerifiedAt &&
    record.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION &&
    record.acceptedTermsAt &&
    hasCurrentBetaConsent(record.email)
  );
}

export function assertAccessRecordApprovalReady(record: AdminAccessRecord) {
  if (!isAccessRecordApprovalReady(record)) {
    throw new Error('Verified identity and current beta terms are required before approval.');
  }
}
```

Call the assertion only when changing status to `approved`. Revocation remains available even when consent evidence is malformed.

- [ ] **Step 4: Parse and expose participant type**

Add `parseParticipantType(value)` to `adminRoutes.ts`. Extend the access mutation to accept a valid participant type and reject unknown values.

Extend each admin user row with:

```ts
participantType: access?.participantType || user?.participantType || 'founder_operator',
identityVerified: Boolean(access?.identityVerifiedAt),
termsCurrent: access?.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION && hasCurrentBetaConsent(email),
termsVersion: access?.acceptedTermsVersion || null,
approvalReady: access ? isAccessRecordApprovalReady(access) : false,
```

- [ ] **Step 5: Run GREEN**

Run the same three-test command. Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/src/adminAccessStore.ts backend/src/adminRoutes.ts backend/src/adminDashboard.ts backend/tests/authAccess.test.ts backend/tests/adminDashboard.test.ts backend/tests/serverAdminRoutes.test.ts
git commit -m "feat(admin): require verified beta approval evidence"
```

---

### Task 4: Replace Implicit Credits With an Idempotent Trial Grant

**Files:**
- Modify: `backend/src/platform/types.ts`
- Modify: `backend/src/platform/store.ts`
- Create: `backend/src/betaTrialCredits.ts`
- Create: `backend/tests/betaTrialCredits.test.ts`
- Modify: `backend/tests/creditHolds.test.ts`

**Interfaces:**
- Produces: `ensureBetaTrialCredits(input): { entry: CreditLedgerEntry; created: boolean }`.
- Consumes: `ParticipantType`, current Terms version, `listLedgerEntries()`, and `addLedgerEntry()`.

- [ ] **Step 1: Write failing trial-credit tests**

Cover all participant types and idempotency:

```ts
for (const participantType of ['founder_operator', 'investor', 'partner'] as const) {
  test(`${participantType} receives one 500-credit beta grant`, () => withTempPlatformStore(() => {
    const first = ensureBetaTrialCredits({
      workspaceId: `workspace_${participantType}`,
      participantType,
      termsVersion: CURRENT_BETA_TERMS_VERSION,
    });
    const second = ensureBetaTrialCredits({
      workspaceId: `workspace_${participantType}`,
      participantType,
      termsVersion: CURRENT_BETA_TERMS_VERSION,
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.entry.deltaCredits, 500);
    assert.equal(getWorkspaceLedgerSummary(`workspace_${participantType}`).balanceCredits, 500);
  }));
}
```

Add a regression asserting `addLedgerEntry()` on an empty workspace adds only the requested entry and `ensureWorkspaceCredits()` does not create a Legacy Starter grant.

- [ ] **Step 2: Run RED**

```bash
cd backend
NODE_ENV=test node --test -r ts-node/register tests/betaTrialCredits.test.ts tests/creditHolds.test.ts
```

Expected: FAIL because trial grants do not exist and the store still seeds Legacy Starter credits.

- [ ] **Step 3: Extend credit types**

Add `'trial_grant'` to `CreditSource` and `'beta_trial'` to `referenceType`.

- [ ] **Step 4: Remove implicit grants**

Change `addLedgerEntry()`, `acquireCreditHold()`, and `ensureWorkspaceCredits()` so an empty workspace begins at zero. Do not delete existing entries.

`ensureWorkspaceCredits()` becomes a compatibility read:

```ts
export function ensureWorkspaceCredits(workspaceId: string) {
  const entries = getPlatformState().ledger.filter((entry) => entry.workspaceId === workspaceId);
  const summary = summarizeCreditLedger(entries);
  return { ...summary, workspaceId };
}
```

- [ ] **Step 5: Implement the entitlement service**

```ts
export const BETA_TRIAL_CREDITS = 500;
export const BETA_TRIAL_CAMPAIGN = 'beta_trial_2026_07_v1';

export function ensureBetaTrialCredits(input: {
  workspaceId: string;
  participantType: ParticipantType;
  termsVersion: string;
}) {
  const referenceId = `${BETA_TRIAL_CAMPAIGN}:${input.workspaceId}`;
  const existing = listLedgerEntries(input.workspaceId).find(
    (entry) => entry.source === 'trial_grant' && entry.referenceId === referenceId,
  );
  if (existing) return { entry: existing, created: false };

  const entry = addLedgerEntry({
    workspaceId: input.workspaceId,
    source: 'trial_grant',
    deltaCredits: BETA_TRIAL_CREDITS,
    referenceType: 'beta_trial',
    referenceId,
    note: 'Controlled beta trial grant',
    metadata: { participantType: input.participantType, termsVersion: input.termsVersion, oneTime: true },
  });
  return { entry, created: true };
}
```

- [ ] **Step 6: Run GREEN and the platform regression tests**

```bash
cd backend
NODE_ENV=test node --test -r ts-node/register tests/betaTrialCredits.test.ts tests/creditHolds.test.ts tests/jsonStore.test.ts
```

Expected: PASS with no Legacy Starter seed assertion failures.

- [ ] **Step 7: Commit Task 4**

```bash
git add backend/src/platform/types.ts backend/src/platform/store.ts backend/src/betaTrialCredits.ts backend/tests/betaTrialCredits.test.ts backend/tests/creditHolds.test.ts
git commit -m "feat(billing): grant one-time beta trial credits"
```

---

### Task 5: Wire Verified OAuth, Current Terms, and Trial Fulfillment

**Files:**
- Modify: `backend/src/auth.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/src/betaAccess.ts`
- Modify: `backend/tests/authWorkspace.test.ts`
- Modify: `backend/tests/serverTenantRoutes.test.ts`
- Modify: `backend/tests/authAccess.test.ts`

**Interfaces:**
- Consumes: consent, participant, readiness, and trial services from Tasks 2–4.
- Produces: session fields `participantType`, `acceptedTermsVersion`, `acceptedTermsAt`, and `requiresTermsAcceptance`; public `GET /api/auth/terms`; authenticated `POST /api/auth/terms/accept`.

- [ ] **Step 1: Write failing OAuth/session policy tests**

Add tests proving:

```ts
assert.equal(session.user.requiresTermsAcceptance, true);
assert.equal(staleTermsProtectedResponse.status, 403);
assert.equal(staleTermsProtectedBody.code, 'terms_reacceptance_required');
assert.equal(unapprovedWorkspaceLedger.balanceCredits, 0);
assert.equal(approvedInvestorWorkspaceLedger.balanceCredits, 500);
```

Add a test that a login-intent OAuth state with `acceptedTerms: false` does not turn acceptance on.

- [ ] **Step 2: Run RED**

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/authAccess.test.ts tests/authWorkspace.test.ts tests/serverTenantRoutes.test.ts
```

Expected: FAIL on missing current-Terms/session/trial behavior.

- [ ] **Step 3: Extend auth user records**

Add:

```ts
participantType: ParticipantType;
acceptedTermsVersion?: string;
acceptedTermsAt?: string;
```

`upsertAuthUser()` receives server-derived values. Remove the `input.acceptedTerms || existing.acceptedTerms` shortcut for current-version access; preserve legacy booleans only as migration data.

Export:

```ts
export function authUserHasCurrentTerms(user: AuthUserRecord) {
  return user.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION && hasCurrentBetaConsent(user.email);
}
```

- [ ] **Step 4: Extend signed OAuth state**

Add bounded fields:

```ts
participantType: ParticipantType;
termsVersion: string;
```

For signup, reject a missing/invalid participant type or mismatched Terms version. For login, derive participant type from the stored access record and do not mark Terms accepted from intent alone.

- [ ] **Step 5: Record verified applications and consent**

After Google/Microsoft returns a verified email and before access assertion:

```ts
if (state.intent === 'signup' && state.acceptedTerms) {
  const acceptedAt = new Date().toISOString();
  recordBetaConsent({
    email,
    participantType: state.participantType,
    termsVersion: CURRENT_BETA_TERMS_VERSION,
    termsDigest: CURRENT_BETA_TERMS_DIGEST,
    acceptedAt,
    authMethod: provider,
    acceptanceSource: 'oauth_callback',
  });
  requestBetaAccess({
    email,
    name,
    method: provider,
    participantType: state.participantType,
    identityVerifiedAt: acceptedAt,
    acceptedTermsVersion: CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: acceptedAt,
    note: 'Verified OAuth beta application',
  });
}
```

Then assert approval. This records a denied but verified application without granting a session.

- [ ] **Step 6: Fulfill the trial after approved user creation**

After `upsertAuthUser()` returns an approved non-admin user with current Terms:

```ts
if (user.role !== 'admin' && authUserHasCurrentTerms(user)) {
  ensureBetaTrialCredits({
    workspaceId: getAuthUserDefaultWorkspaceId(user),
    participantType: user.participantType,
    termsVersion: CURRENT_BETA_TERMS_VERSION,
  });
}
```

Do this for OAuth and the explicitly allowed non-production email flow. Never call it for denied requests.

- [ ] **Step 7: Add terms endpoints and middleware**

`GET /api/auth/terms` returns version, digest, path, canonical text, and participant types. The canonical text must be the exact text hashed by `CURRENT_BETA_TERMS_DIGEST`; never return a summary under that digest.

`POST /api/auth/terms/accept` authenticates the cookie inside the handler, records a `reauthorization` receipt, updates the user, fulfills a missing trial only when access is approved, and returns the updated session.

Protected API middleware returns:

```ts
res.status(403).json({
  error: 'Current beta terms must be accepted before workspace access.',
  code: 'terms_reacceptance_required',
  termsVersion: CURRENT_BETA_TERMS_VERSION,
});
```

Skip this Terms block for `admin` so a malformed consent store cannot remove the recovery path. Return `requiresTermsAcceptance` in the admin session so the frontend can prompt without denying recovery.

- [ ] **Step 8: Run GREEN**

Run the three-test command from Step 2. Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add backend/src/auth.ts backend/src/server.ts backend/src/betaAccess.ts backend/tests/authAccess.test.ts backend/tests/authWorkspace.test.ts backend/tests/serverTenantRoutes.test.ts
git commit -m "feat(auth): enforce current beta terms before access"
```

---

### Task 6: Add Confidentiality Terms, Participant Application, and Reacceptance UI

**Files:**
- Modify: `frontend/src/pages/TermsOfService.tsx`
- Modify: `frontend/src/pages/Signup.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/lib/auth.ts`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/pages/AccessTerms.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/tests/betaAccess.contract.ts`

**Interfaces:**
- Consumes: backend terms/session fields from Task 5.
- Produces: participant application and reacceptance UI.

- [ ] **Step 1: Write the failing frontend contract**

Create `betaAccess.contract.ts` that reads the relevant files and asserts:

```ts
assert(signup.includes('founder_operator'), 'signup captures founder/operator');
assert(signup.includes('investor'), 'signup captures investor');
assert(signup.includes('partner'), 'signup captures partner');
assert(signup.includes('Beta Confidentiality and Evaluation Terms'), 'signup names confidentiality terms');
assert(terms.includes("id: 'beta-confidentiality'"), 'terms expose a confidentiality anchor');
assert(accessTerms.includes('/api/auth/terms/accept'), 'reacceptance posts to the backend');
assert(app.includes('path="/access-terms"'), 'app registers reacceptance route');
assert(protectedRoute.includes('requiresTermsAcceptance'), 'protected route uses server-owned current Terms state');
assert(!login.includes('acceptedTerms: true'), 'login does not synthesize acceptance');
```

- [ ] **Step 2: Run RED**

```bash
cd frontend
npx --yes tsx tests/betaAccess.contract.ts
```

Expected: FAIL on all new flow assertions.

- [ ] **Step 3: Add the confidentiality section**

Insert section 7 and renumber following sections. Use the approved design language with these exact operative headings inside the content:

```text
Beta information; Evaluation-only use; Protection and disclosure; Exclusions; Required disclosure; Publicity restrictions; Duration; Participant data.
```

State the two-year duration and ongoing trade-secret protection. Add: `This beta confidentiality language should be reviewed by qualified counsel before broad external onboarding.`

- [ ] **Step 4: Add participant type and explicit clickwrap**

Signup state defaults to `founder_operator`. Render three radio-card options. Pass `participantType` and `termsVersion` through `beginOAuthFlow()`.

Use exact checkbox copy:

```tsx
I agree to the Terms of Service, including the Beta Confidentiality and Evaluation Terms, and the Privacy Policy.
```

Link `Beta Confidentiality and Evaluation Terms` to `/terms#beta-confidentiality`.

- [ ] **Step 5: Make auth state backend-owned**

Change frontend `AccessRole` to `'user' | 'admin'`. Add:

```ts
export type ParticipantType = 'founder_operator' | 'investor' | 'partner';

participantType: ParticipantType;
acceptedTermsVersion?: string;
acceptedTermsAt?: string;
requiresTermsAcceptance: boolean;
```

Remove normalization for `tester` and `investor` auth roles. `beginOAuthFlow()` adds participant type and current Terms version only for signup.

- [ ] **Step 6: Add the reacceptance page**

`AccessTerms.tsx` loads `/api/auth/terms`, displays the version and direct Terms link, requires the confidentiality and action-awareness checkboxes, posts to `/api/auth/terms/accept`, then returns to a sanitized local `next` path.

Do not accept `//`, absolute URLs, or non-leading-slash paths as `next`.

- [ ] **Step 7: Redirect stale sessions**

`ProtectedRoute` sends an authenticated non-admin session with `requiresTermsAcceptance` to:

```tsx
<Navigate to={`/access-terms?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
```

Unauthenticated users still go to signup/login. Admin sessions must not be redirected away from recovery/admin surfaces; show a non-blocking reacceptance prompt for admins instead.

- [ ] **Step 8: Run GREEN and build**

```bash
cd frontend
npx --yes tsx tests/betaAccess.contract.ts
npx --yes tsx tests/publicLaunchSurface.contract.ts
npx --yes tsx tests/pricingPackaging.contract.ts
npm run build
```

Expected: all contracts and production build pass.

- [ ] **Step 9: Commit Task 6**

```bash
git add frontend/src/pages/TermsOfService.tsx frontend/src/pages/Signup.tsx frontend/src/pages/Login.tsx frontend/src/lib/auth.ts frontend/src/components/ProtectedRoute.tsx frontend/src/pages/AccessTerms.tsx frontend/src/App.tsx frontend/tests/betaAccess.contract.ts
git commit -m "feat(auth): add beta confidentiality reacceptance"
```

---

### Task 7: Make Approval and Trial State Operable in Admin

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.tsx`
- Modify: `backend/src/adminDashboard.ts`
- Modify: `backend/tests/adminDashboard.test.ts`
- Create: `frontend/tests/adminBetaAccess.contract.ts`

**Interfaces:**
- Consumes: admin user projection from Task 3 and ledger trial source from Task 4.
- Produces: operator-visible approval readiness and trial status.

- [ ] **Step 1: Write failing admin contracts**

Backend expected row:

```ts
assert.equal(investor.participantType, 'investor');
assert.equal(investor.identityVerified, true);
assert.equal(investor.termsCurrent, true);
assert.equal(investor.approvalReady, true);
assert.equal(investor.trialStatus, 'granted');
assert.equal(investor.trialCredits, 500);
```

Frontend file contract asserts participant, Terms, and trial labels plus disabled approval explanation.

- [ ] **Step 2: Run RED**

```bash
cd backend
NODE_ENV=test node --test -r ts-node/register tests/adminDashboard.test.ts
cd ../frontend
npx --yes tsx tests/adminBetaAccess.contract.ts
```

Expected: FAIL on missing admin fields/UI.

- [ ] **Step 3: Project trial status**

Find the auth user's default workspace. Locate a ledger entry where `source === 'trial_grant'`. Return:

```ts
trialStatus: trialEntry ? 'granted' : approvedAccess ? 'pending' : 'not_applicable',
trialCredits: trialEntry?.deltaCredits || 0,
trialGrantedAt: trialEntry?.createdAt || null,
```

- [ ] **Step 4: Render admin evidence**

Add columns/cards for `Participant`, `Terms`, and `Trial`. Disable Approve when `!user.approvalReady`. Use the title:

```text
Verified OAuth identity and current beta confidentiality acceptance are required before approval.
```

Permit participant-type correction through the existing access PATCH route before approval.

- [ ] **Step 5: Run GREEN and frontend build**

Run both focused commands and `cd frontend && npm run build`. Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add backend/src/adminDashboard.ts backend/tests/adminDashboard.test.ts frontend/src/pages/AdminDashboard.tsx frontend/tests/adminBetaAccess.contract.ts
git commit -m "feat(admin): show beta approval and trial state"
```

---

### Task 8: Full Verification, Documentation, and Second Brain Closeout

**Files:**
- Modify: `docs/superpowers/specs/2026-07-11-controlled-beta-access-pricing-and-trial-credits-design.md` only if implementation evidence requires a factual clarification.
- Modify: `/Users/maximisto/SecondBrain/MySecondBrain/99 System/Scripts/build_second_brain.py`
- Modify: `/Users/maximisto/SecondBrain/MySecondBrain/10 Projects/Violema/Violema - Runbook.md`
- Generate: Second Brain dashboard, decision, run-note, index, and graph outputs through the refresh script.

**Interfaces:**
- Consumes: all shipped behavior and verification evidence.
- Produces: reproducible completion evidence and durable pricing/access policy.

- [ ] **Step 1: Run focused beta contracts**

```bash
cd backend
NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register \
  tests/betaConsentStore.test.ts \
  tests/betaTrialCredits.test.ts \
  tests/authAccess.test.ts \
  tests/authWorkspace.test.ts \
  tests/adminDashboard.test.ts \
  tests/serverAdminRoutes.test.ts \
  tests/serverTenantRoutes.test.ts \
  tests/stripeBillingConfig.test.ts

cd ../frontend
npx --yes tsx tests/publicLaunchSurface.contract.ts
npx --yes tsx tests/pricingPackaging.contract.ts
npx --yes tsx tests/betaAccess.contract.ts
npx --yes tsx tests/adminBetaAccess.contract.ts
```

Expected: all pass without warnings from application code.

- [ ] **Step 2: Run full deterministic validation**

```bash
cd backend
npm test
npm run build
cd ../frontend
npm run build
cd ..
git diff --check
```

Expected: backend suite passes, both builds pass, and diff check is clean. Frontend lint remains unavailable until the project adds a compatible local ESLint dependency; do not install a new lint dependency in this feature.

- [ ] **Step 3: Exercise the built public surface**

Run:

```bash
cd frontend
npm run preview -- --host 127.0.0.1
```

Verify from the rendered page or built assets:

- homepage contains `$79`, `$249`, `500 trial credits`, `manual approval`, and `beta confidentiality`;
- homepage has no purchase button;
- `/pricing` has no seat claim and shows both mission ranges plus the variability note;
- `/signup` shows participant types and confidentiality checkbox;
- `/access-terms` renders and rejects unsafe return paths.

- [ ] **Step 4: Update the Second Brain generator-owned decision**

Extend the existing Violema pricing decision with:

- compact homepage price anchor retained;
- controlled-beta identity, confidentiality, and manual-approval sequence;
- participant types remain non-privileged classification;
- 500-credit one-time grant for all approved non-admin participants;
- seat claim removed;
- mission guidance wording;
- exact tests/build evidence.

Add a dated Violema run note and relationship links in `build_second_brain.py`. Update the runbook guardrail directly.

- [ ] **Step 5: Refresh and validate the Second Brain**

```bash
cd "/Users/maximisto/SecondBrain/MySecondBrain"
python3 -m py_compile "99 System/Scripts/build_second_brain.py"
"99 System/Scripts/refresh_second_brain.sh"
jq -e . graphify-out/graph.json >/dev/null
jq -e . "99 System/Graph/vault_index.json" >/dev/null
graphify explain "Decision - Keep Violema pricing at $79 and $249" --graph graphify-out/graph.json
```

Expected: the decision remains typed as `decision`, sourced from its decided note, and linked to Violema plus Decision Log.

- [ ] **Step 6: Review the complete diff against the approved spec**

```bash
cd "/Users/maximisto/Documents/New project"
git status --short
git diff --stat b6e6f86..HEAD
git diff --check b6e6f86..HEAD
rg -n "Legacy Starter monthly credit grant|5 included seats|5 seats \+ \$29|role === 'investor'|role === 'tester'" backend/src frontend/src
```

Expected: no new legacy seed, seat promise, or privileged investor/tester role remains. Preserve unrelated untracked files.

- [ ] **Step 7: Commit the Second Brain closeout in the application repo only if repo documentation changed**

If the design spec is unchanged, skip this commit. If implementation evidence required a factual spec clarification, run:

```bash
git add docs/superpowers/specs/2026-07-11-controlled-beta-access-pricing-and-trial-credits-design.md
git commit -m "docs(auth): record controlled beta verification"
```

Do not commit the external Second Brain vault from this repository. Report its absolute note paths separately.

---

## Final Review Checklist

- [ ] Homepage retains transparent `$79` and `$249` anchors inside controlled-beta framing.
- [ ] No unsupported seat promise remains.
- [ ] Mission guidance is `1–3` and `5–10`, with variability disclosure.
- [ ] Participant type cannot grant authorization.
- [ ] Verified OAuth identity is recorded before approval.
- [ ] Current Terms receipt is required before approval and protected access.
- [ ] Login never synthesizes acceptance.
- [ ] Admin recovery remains available.
- [ ] Every approved non-admin participant gets exactly one 500-credit grant.
- [ ] No new workspace receives an implicit Legacy Starter grant.
- [ ] Revocation invalidates sessions.
- [ ] Stripe subscription grants remain independent.
- [ ] Full tests/builds and Second Brain refresh pass.
