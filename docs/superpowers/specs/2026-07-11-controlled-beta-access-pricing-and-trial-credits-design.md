# Violema Controlled Beta Access, Pricing, and Trial Credits Design

Date: 2026-07-11
Status: implemented and verified at application head `3c25c28`
Owner: Max Markovtsev

## Objective

Keep Violema commercially legible while preserving a controlled beta. The public site should disclose the $79 Start and $249 Pro anchors without implying instant self-serve access. Every participant must pass verified identity, current beta confidentiality acceptance, and manual approval before entering a workspace. Approved beta participants receive one auditable 500-credit trial grant.

## Decisions

### Public pricing posture

The homepage keeps a compact pricing anchor:

- Start: $79/month.
- Pro: $249/month.
- Enterprise: custom.
- Approved beta participants receive 500 trial credits.

The homepage does not render full plan cards or purchase buttons. The pricing message sits inside the controlled-beta section and states that access requires identity verification, beta confidentiality acceptance, and manual approval.

Primary CTA: `Apply for beta`.

Secondary CTA: `Book workflow audit`.

`/pricing` remains publicly readable and shareable. Selecting a plan never bypasses access approval. An unapproved visitor is routed into the application flow. An approved participant may proceed to Stripe only after the current access terms have been accepted.

### Package presentation

Remove the inherited `5 seats + $29 per extra seat` claim. Violema does not yet have tenant member invitations, seat enforcement, or extra-seat Stripe billing.

Use capacity guidance rather than unsupported mission entitlements:

- Start: `Best for 1–3 active missions`.
- Pro: `Best for 5–10 active missions`.
- Supporting note: `Actual run volume depends on mission complexity and credit usage.`

The values remain guidance. Credits, approval features, and supported operating surfaces remain the enforceable package mechanics.

## Participant model

Authentication authorization remains separate from commercial participant classification.

Authorization roles:

- `user`
- `admin`

Participant types:

- `founder_operator`
- `investor`
- `partner`

Do not add investor or partner as privileged auth roles. Participant type controls onboarding language and trial-entitlement reporting, not authorization. Admin remains the only privileged role.

The application captures participant type before OAuth. The verified OAuth callback records the request against the verified email address. The admin dashboard displays participant type and permits correction before approval.

## Controlled access state machine

```text
application_started
  -> identity_verified
  -> terms_accepted
  -> access_requested
  -> manually_approved
  -> workspace_created
  -> trial_granted
  -> active_beta

manually_approved or active_beta
  -> revoked
```

Rules:

1. Unknown and requested participants cannot access protected APIs or workspaces.
2. OAuth identity verification must complete before a request becomes approval-ready.
3. Current-version terms acceptance must exist before approval.
4. Approval remains an explicit admin action.
5. Revocation invalidates active sessions.
6. Trial credits are granted only after identity verification, terms acceptance, approval, and workspace creation.
7. Repeated logins, OAuth callbacks, approval clicks, and service restarts cannot repeat the trial grant.

## Beta confidentiality and electronic acceptance

Add a clearly titled `Beta Confidentiality and Evaluation Terms` section to the Terms of Service. It should cover:

- pre-release product behavior, interfaces, documentation, benchmarks, roadmaps, pricing experiments, and nonpublic commercial or technical information;
- evaluation-only use and no disclosure to third parties without written permission;
- reasonable protection of confidential beta information;
- standard exclusions for information already public, previously known without restriction, independently developed, or lawfully received from another source;
- legally compelled disclosure with advance notice when permitted;
- no public screenshots, recordings, benchmarks, or product claims without written approval during the confidential beta;
- survival for two years after the participant's last beta access, except trade secrets remain protected while qualifying as trade secrets;
- Purple Orange AI's continuing obligation to protect participant workspace data under the Privacy Policy and applicable onboarding terms.

The signup checkbox must say that the applicant agrees to the Terms of Service, including the Beta Confidentiality and Evaluation Terms, and the Privacy Policy. The confidentiality language must be visible through a direct anchor link from the checkbox.

This implementation is a clickwrap evidence system, not a representation that legal counsel approved the substance. Counsel should review the final confidentiality text before broad external onboarding.

Federal law states that contracts and signatures cannot be denied effect solely because they are electronic, and retained electronic records must remain accurately reproducible. Delaware's Uniform Electronic Transactions Act also recognizes electronic records and signatures attributable to a person's act. Sources:

- [15 U.S.C. § 7001](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A7001+edition%3Aprelim%29)
- [15 U.S.C. § 7006](https://uscode.house.gov/view.xhtml?req=%28title%3A15+section%3A7006+edition%3Aprelim%29)
- [Delaware Uniform Electronic Transactions Act](https://delcode.delaware.gov/title6/c012a/index.html)

## Consent records

Introduce a current terms version constant. Initial version: `2026-07-11-beta-confidentiality-v1`.

Persist an append-only consent receipt containing:

- verified email;
- participant type;
- terms version;
- acceptance timestamp;
- authentication method;
- acceptance source (`signup`, `oauth_callback`, or `reauthorization`);
- exact Terms path or document identifier;
- a SHA-256 digest of the rendered legal text or canonical Terms payload.

Do not rely only on mutable booleans such as `acceptedTerms`. Existing boolean fields may remain during migration, but protected access checks use current-version acceptance.

The system does not need to retain an IP address for this release. Verified OAuth identity, explicit checkbox intent, timestamp, version, and reproducible text digest provide the required operational evidence while avoiding extra personal-data collection.

## Reacceptance

Login must not silently set Terms acceptance to true.

When an approved participant has no current-version receipt:

1. Authentication may establish verified identity.
2. The participant is redirected to `/access-terms`.
3. Protected workspace routes remain blocked.
4. The participant reviews and accepts the current Terms.
5. The consent receipt is appended.
6. Access continues to the original safe local destination.

Admin recovery remains separate. Admin magic login may establish the admin session, but current Terms status should still be visible in the admin session record. Admin access must never be blocked in a way that removes the only recovery path; instead, the admin receives an immediate reacceptance prompt after authentication.

## Trial-credit entitlement

Every manually approved non-admin beta participant receives one 500-credit trial grant. This explicitly includes founders/operators, investors, and partners.

Grant properties:

- amount: `500` credits;
- source: `trial_grant`;
- stable reference type: `beta_trial`;
- stable reference ID: `beta_trial_2026_07_v1:<workspaceId>`;
- metadata: participant type, approval actor if available, terms version, and `oneTime: true`;
- note: `Controlled beta trial grant`.

The grant is created after the approved participant's workspace exists. Before appending, the ledger checks for the stable reference ID. If it already exists, return the existing grant without changing the balance.

Replace implicit `Legacy Starter monthly credit grant` seeding for new participant workspaces. A missing ledger must no longer create 500 credits merely because a task or billing endpoint was opened.

Existing ledger entries are preserved. No historical credit balance is rewritten or removed.

Admin test-credit grants remain a separate manual tool and source. Stripe subscription credits remain granted only by verified Stripe events. A trial grant does not mark a workspace as subscribed.

## Admin approval surface

The Users panel shows:

- verified email and name;
- participant type;
- access status;
- current Terms status and version;
- trial status: pending, granted, spent/remaining, or not applicable;
- OAuth method;
- approve and revoke controls.

The Approve control is disabled until verified identity and current Terms acceptance are present. The disabled state explains the missing requirement.

Approval response includes the updated access record but does not fabricate a workspace or grant credits. Trial fulfillment occurs on the participant's first approved authenticated session after workspace creation. This keeps workspace ownership server-derived.

## Data model changes

`AdminAccessRecord` gains:

- `participantType`;
- `identityVerifiedAt`;
- `acceptedTermsVersion`;
- `acceptedTermsAt`.

`AuthUserRecord` gains:

- `participantType`;
- `acceptedTermsVersion`;
- `acceptedTermsAt`.

Add an append-only consent-event store with strict validation and atomic writes. Malformed consent state fails closed for participant workspace access but must not destroy the admin recovery path.

Add `trial_grant` to the credit-source union and expose trial provenance in billing/admin summaries without exposing confidential approval notes publicly.

## API behavior

Public beta API access remains limited to health, application/waitlist, OAuth, and signed provider webhooks.

Application and OAuth state accept a bounded participant type.

Admin access approval rejects records lacking:

- verified identity;
- current Terms receipt;
- valid participant type.

Protected API middleware checks:

- approved access;
- current Terms receipt;
- workspace ownership.

Revocation continues to clear sessions.

## Migration and compatibility

- Existing `user` and `admin` authorization roles remain valid.
- Stale frontend-only `tester` and `investor` auth roles are removed.
- Existing access records without participant type normalize to `founder_operator` for display but remain approval-ineligible until current Terms are accepted.
- Existing auth users keep their workspaces and balances.
- Existing approved users are prompted to accept the current Terms version on next login.
- Existing env allowlists remain an access approval source, but they do not bypass current Terms acceptance or the one-time trial-grant check.
- Admin recovery remains available even when consent or access stores are malformed.

## Test strategy

All behavior changes follow red-green-refactor.

### Public surface contracts

- Homepage retains `$79` and `$249` only inside controlled-beta pricing context.
- Homepage contains no purchase or instant-access promise.
- Homepage states 500 trial credits, confidentiality acceptance, and manual approval.
- Pricing cards contain no seat claim.
- Pricing cards use `Best for 1–3 active missions` and `Best for 5–10 active missions`.
- Pricing page explains workload variability.

### Access contracts

- Unverified identity cannot become approval-ready.
- Current Terms acceptance is required for approval.
- Login does not synthesize Terms acceptance.
- An old Terms version routes to reacceptance and cannot access protected APIs.
- A current receipt unlocks an already-approved participant.
- Revocation invalidates the session.
- Admin recovery remains possible.

### Credit contracts

- Approved founder/operator, investor, and partner each receive 500 credits.
- Unapproved or non-current-Terms participants receive zero.
- Repeated fulfillment returns the original grant and does not change balance.
- Existing balances are preserved.
- Opening billing/task endpoints does not create an implicit Legacy Starter grant.
- Stripe subscription grants remain independent.

### Validation

- Focused backend contracts.
- Focused frontend contracts.
- Full backend test suite.
- Frontend typecheck/build.
- Public-page rendered-text smoke.
- Auth flow smoke for requested, approved, current-Terms, stale-Terms, investor, partner, and revoked states.

## Security and legal boundaries

- No applicant gains workspace access from a client-side role or participant-type value.
- All authorization decisions are server-owned.
- Participant type never grants admin privileges.
- Trial credits cannot be granted from a public endpoint.
- Consent records contain no secrets or integration data.
- NDA/clickwrap language receives counsel review before broad onboarding; implementation tests evidence capture and gating, not legal enforceability.

## Success criteria

The work is complete when:

1. The homepage transparently anchors $79/$249 while unmistakably presenting controlled beta.
2. Seat and mission copy matches real product behavior.
3. Verified identity, current beta confidentiality acceptance, and manual approval are all independently enforced.
4. Investor and partner applicants are first-class participant types without privileged auth roles.
5. Every approved non-admin beta workspace receives exactly one auditable 500-credit trial grant.
6. No legacy implicit grant remains for new workspaces.
7. Revocation and admin recovery remain safe.
8. Focused tests, full backend tests, and the frontend build pass.
9. The final decision and verification evidence are mirrored into the Second Brain.
