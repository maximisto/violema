# Final review fixes report

Date: 2026-07-11

Branch: `codex/controlled-beta-access`

Starting head: `6fa7245`

## Outcome

All final whole-branch review findings were closed in one test-driven wave:

- Pricing checkout readiness now depends only on a freshly resolved backend session. Cached access cannot authorize checkout, and null, denied, malformed, or invalid refreshes clear stale local readiness.
- Non-admin sessions with stale Terms route through `/access-terms` with a sanitized local pricing return path and preserved plan intent. No-session or revoked access routes to the beta application. Current approved sessions may checkout.
- Checkout errors now preserve backend status/code, render a visible alert, and offer an actionable Terms, beta-application, or pricing retry route. Click handlers contain all promise rejections.
- Verified OAuth and reacceptance now have a server-owned evidence-sync path. It refreshes identity and current Terms evidence while preserving approved/revoked state, role, immutable approval provenance, and prior identity timestamps.
- Verified current env/default allowlist users receive a coherent approved access projection only after a current server receipt. The projection preserves the server-resolved role, including default admins.
- Access records now carry optional immutable `approvedBy` and `approvedAt`. Actual approval transitions set them; participant, role, evidence, and revocation changes preserve them. Trial metadata reads `approvedBy` only; legacy records without provenance omit `approvalActor`.
- Trial usage is formalized as trial-first attribution in a pure backend helper and explicitly labeled in both desktop/mobile admin UI.
- Public CTA copy now uses the approved primary `Apply for beta`, secondary `Book workflow audit` hierarchy. Pricing remains anchored at $79/$249, 500 trial credits, manual approval, and confidentiality without instant-free promises.

## RED evidence

The regressions were written and observed failing before production changes:

1. `cd frontend && npx --yes tsx tests/pricingPackaging.contract.ts`
   - Failed: `pricing uses an executable server-session access decision helper`.
2. `cd frontend && npx --yes tsx tests/publicLaunchSurface.contract.ts`
   - Failed: `public surfaces do not promise immediate free product access`.
3. `cd frontend && npx --yes tsx tests/betaAccess.contract.ts`
   - Failed: `revoked backend refresh removes stale cached readiness`.
4. `cd frontend && npx --yes tsx tests/adminBetaAccess.contract.ts`
   - Failed: expected `Trial-first · Spent 125 · 375 remaining`, received the unlabeled legacy string.
5. Focused backend tests initially failed to compile because `syncVerifiedAccessEvidence`, `approvedBy`, `approvedAt`, and `attributeTrialFirstUsage` did not exist.
6. Adversarial migration review added a second RED regression: a default-admin evidence projection rejected the new `role` input, proving the projection could otherwise persist an admin as a user.

## GREEN evidence

- Focused backend:
  - `tests/authAccess.test.ts`: 21/21 passed.
  - `tests/adminDashboard.test.ts` + `tests/serverTenantRoutes.test.ts`: 6/6 passed.
  - `tests/serverAdminRoutes.test.ts`: 1/1 passed.
  - `tests/serverAdminRecovery.test.ts`: 1/1 passed.
  - `tests/betaTrialCredits.test.ts`: 8/8 passed.
- Four frontend contracts passed:
  - `publicLaunchSurface.contract.ts`
  - `pricingPackaging.contract.ts`
  - `betaAccess.contract.ts`
  - `adminBetaAccess.contract.ts`
- Full backend: `cd backend && npm test` — 130/130 passed.
- Backend build: `cd backend && npm run build` — passed.
- Frontend build: `cd frontend && npm run build` — passed (1,580 modules transformed).
- Repository whitespace validation: `git diff --check` — passed.
- Source sweep: no `Start free`, `free preview`, or case variants remain under `frontend/src`.

## Commits

- `8442072` — `fix(auth): preserve beta evidence and approval provenance`
- `66b85c8` — `fix(pricing): gate checkout on current beta access`

## Files

Backend:

- `backend/src/adminAccessStore.ts`
- `backend/src/adminDashboard.ts`
- `backend/src/server.ts`
- `backend/tests/adminDashboard.test.ts`
- `backend/tests/authAccess.test.ts`
- `backend/tests/serverTenantRoutes.test.ts`

Frontend:

- `frontend/src/lib/pricingAccess.ts`
- `frontend/src/lib/auth.ts`
- `frontend/src/lib/credits.ts`
- `frontend/src/pages/Billing.tsx`
- `frontend/src/pages/AdminDashboard.tsx`
- `frontend/src/content/homepage.ts`
- `frontend/src/components/BetaAccess.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/components/Hero.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/pages/FAQ.tsx`
- `frontend/src/pages/IntegrationsPage.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/RunProof.tsx`
- `frontend/src/pages/Signup.tsx`
- `frontend/src/pages/SlackSetup.tsx`
- `frontend/tests/adminBetaAccess.contract.ts`
- `frontend/tests/betaAccess.contract.ts`
- `frontend/tests/pricingPackaging.contract.ts`
- `frontend/tests/publicLaunchSurface.contract.ts`

## Security and migration review

- Revoked records remain revoked during evidence sync, including when `approvedIfMissing` is true.
- Existing approved/revoked roles are never changed by evidence sync; new projections take the already-resolved server role.
- New approved projections require verified Google/Microsoft identity plus an exact current server-owned consent receipt.
- Admin recovery remains available if the access store is malformed; ordinary users still fail closed.
- Evidence sync never derives immutable approval provenance from mutable `updatedBy`.
- Legacy records with no immutable actor remain readable and omit trial `approvalActor` rather than inventing one.
- Pricing return paths accept only local `/pricing` or `/plans` destinations.

## Concerns

No blocking concerns. By design, a legacy approval actor remains unavailable until a future explicit approval transition records immutable provenance; it is not backfilled from mutable fields. Existing modified task reports in `.superpowers/sdd/` were preserved and not staged.
