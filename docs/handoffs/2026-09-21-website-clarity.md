# Website clarity changes — September 21, 2026

Status: proposed changes for review; not deployed.

## Changes

- Lead with the weekly brief outcome and make pricing and a worked example easier to find.
- Derive homepage integration claims from the existing integration catalog; show PostHog as deferred.
- Label illustrative activity, costs, approval states and delivery examples clearly. Add a full editorial brief with public sources, interpretation, recommendations and uncertainties.
- Explain the existing founding tester offer and application steps consistently across signup, pricing and FAQ.
- Put plan cards before estimated run examples, improve contrast, and show the account panel only to approved users.
- Align resource-page branding and application CTAs with the main site.
- Draft corrections to legal entity, AI-provider and security disclosures. These are not counsel-approved policies.

Backend authorization, billing amounts, plan IDs, checkout behavior and approval requirements are unchanged.

## Release holds

1. Owner/counsel must verify actual processing providers, gateway recipients, embedding routes, provider agreements, training settings, retention and deletion commitments. Supported code routes are not proof of production configuration.
2. Confirm business postal contact details, privacy/security/legal mailboxes, and any required representative disclosures. Removing placeholder text does not establish disclosure compliance.
3. Review beta confidentiality language before broad onboarding. Its former public editorial warning has moved into this internal release checklist.
4. Set approved legal effective dates and implement any required change notices or acceptance-version updates. Old dates were deliberately retained pending that decision; do not release the draft legal pages as-is.
5. Perform desktop/mobile browser review of the changed pages and beta application path before deployment. This implementation session verified build, lint and contracts, but did not visually verify a running build.
6. Deployment requires a separate explicit request under AGENTS.md/CLAUDE.md.

## Validation

- Frontend production build: passed.
- Frontend ESLint: passed.
- All 16 frontend npm test suites: passed.
- Additional publicLaunchSurface TypeScript contract: passed; navigation assertion now expects informational pricing while preserving controlled-beta assertions.
- git diff --check: passed.
- No live checkout, application submission, mission delivery or production deployment performed.

Graphify is unavailable in this environment. The required vault refresh script targets Max's local macOS checkout and also syncs Capital OS; it cannot be truthfully reported as run here. Record the branch/PR in an agent run note and refresh from that checkout.
