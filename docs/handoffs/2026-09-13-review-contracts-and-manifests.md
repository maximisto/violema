# September repair review contracts and manifests

All reviews are read-only code tracing. Parent-executed checks are separate evidence. Source/test diffs can be reconstructed from the exact git ranges below.

## Initial full review

### Shared instructions

```text
Perform an independent adversarial code review of the Violema September repair release. Read-only review: no edits, commits, memory/vault updates, router calls, delegation, network calls, tests or shell execution. This explicit review scope overrides repository instructions to perform routine writes. Use only file reading/searching. You may inspect source and tests under the repository, plus the supplied frozen diff and requirements. Do not read author handoffs, other reviewers, session history, secrets, environment files, or runtime/customer data.

Repository: /Users/maximisto/Documents/New project/.worktrees/sept-review-repairs
Frozen diff: /tmp/violema-sept-release-review.diff
Exact base/head and deterministic validation: /tmp/violema-sept-release-review-manifest.txt

Requirements:
- Incomplete/truncated provider error bodies and ambiguous server/gateway failures without receipts must retain unknown usage. Complete observed usage must survive. A retry success must not erase an unknown physical attempt; automation accounting must require reconciliation.
- A baseline beyond the bounded metadata window must not be mistaken for confirmed absence. Failed/empty/individually oversized source reads must not be silently converted into permanent bootstrap omission. Existing finite recovery limits and fail-closed behavior remain.
- Every successor of an omitted-history baseline must retain bounded machine-readable provenance and a human disclosure, including existing legacy baselines; mission reads must communicate this caveat independently of generated prose.
- The exact persisted baseline (digest, separator, marker and disclosure) must satisfy both byte and word-unit ceilings. The existing 400-unit multilingual baseline policy is retained; prompt expectations must match it.
- Deterministic memo and summary fallbacks must use the same multilingual counting/truncation definition as final validation, preserve readable script order, and respect bytes including the complete required footer.
- Short/empty Drive pages with explicit nextPageToken must not establish exhaustion. Traverse bounded opaque tokens or fail closed. incompleteSearch must not certify complete history. Full-page and cap behavior must stay conservative. Do not invent a provider guarantee where absent; distinguish an evidenced defect from hypothetical adapter token stripping.
- Missing platform configuration must be surfaced as platform failure. Missing customer grant and insufficient scope must expose distinct actionable connection/reauthorization states across folder-drop routes and Settings. Outages/rate limits must not prompt customer reauthorization.
- Preserve tenant isolation, existing readiness/approval gates and unrelated behavior. No deployment or production workflows are authorized.

Find concrete reachable correctness/regression defects in the full changed surface; follow relevant callers. Do not infer customer exposure. For each finding give severity, exact file/line, trigger, impact, and a minimal synthetic reproduction description. Distinguish code-traced evidence from executed tests (you are not executing). If there are no blockers, say so explicitly; include residual limitations. End with VERDICT: READY FOR SEPARATE RELEASE APPROVAL, WITH FIXES, or DO-NOT-SHIP. A ready verdict is a bounded code review, not evidence of production health or authorization to deploy.
```

### Manifest

```text
Base:85579c812b6739c9ee13ba101268bc085742e966
Head:76e513f6beaf534ce440c373c4874f5aa12e2ee8
Diff SHA-256: ad3b976b5e42e233872a7e228df5cbd73fb08400978161dcf95b1d0e5046d5a9
Diff includes all changed backend/frontend source and test files in this range. Documentation-only handoffs are intentionally excluded to keep review independent of author reasoning.
Verified by parent after final source changes:
- Backend typecheck: passed.
- Backend full suite:883passed,0failed (856top-level plus27nested).
- Backend platform suite:8passed,0failed.
- Backend build: passed.
- Frontend lint: passed.
- Frontend all16contract groups: passed.
- Frontend typecheck/build: passed.
- git diff --check: passed.
- AST graph refresh:2618nodes,5050edges.
Tests use synthetic provider transports and isolated local workspace/auth fixtures. Real HTTP handlers and automation accounting are exercised, but no live provider call or production mission was performed. Browser visual inspection was not performed.
This manifest reports checks, not proof that there are no defects. Your task is to find defects through independent code tracing.
```

## Accounting correction

### Shared instructions

```text
Review only the corrective accounting diff since the prior full review, then state whether the two specific blockers are closed without introducing a regression. Scope is deliberately narrow; do not repeat the unchanged library/Drive/Unicode review.

Read-only, code-tracing-only: no edits, commits, router/vault actions, tests, network, delegation, or reading other reviewers/author handoffs. Use file reading/search only. This scope overrides routine repository writeback instructions. Independent checks were executed by the parent; see the manifest, not assumptions about their success.

Repository: /Users/maximisto/Documents/New project/.worktrees/sept-review-repairs
Correction diff: /tmp/violema-sept-refinement-review.diff
Exact range/check manifest: /tmp/violema-sept-refinement-review-manifest.txt

Blocker 1: HTTP 429 normal EOF with malformed JSON ending inside total_tokens was treated as complete and given inferred zero usage, allowing a successful retry to settle without reconciliation. Require valid envelope completion before zero inference; preserve complete observed usage from a valid top-level prefix even when the remainder is malformed.
Blocker 2: HTTP 400/408 body interruption after a complete usage object lost the observed receipt because those statuses bypassed the bounded error reader. Require consistent usage preservation across unsuccessful HTTP responses.

Trace the correction through retry/failure hooks and accounting. Check that valid complete rejections, observed error usage, sanitization, bounded bytes, and successful response behavior remain sensible. The added tests must assert the actual public generator/accounting paths. Report concrete remaining blockers with path/line, trigger, impact and a synthetic reproduction; otherwise explicitly say both blockers are closed. Distinguish code-traced evidence from parent-executed tests. End VERDICT: READY FOR SEPARATE RELEASE APPROVAL, WITH FIXES, or DO-NOT-SHIP for the corrected accounting scope. Do not claim production health or authorize deploy.
```

### Manifest

```text
Base:76e513f6beaf534ce440c373c4874f5aa12e2ee8
Head:bcf3402a7fbd8d80fd213594b55849613a5d48f2
Diff SHA-256:a882267e150e034d5041b5f5c5b2ef6b3b4a1781b31240276d2ea12adcf449c5
Parent-executed validation after final correction:45focused provider/accounting/budget checks,888full backend tests (861top-level plus27nested),8platform tests, backend typecheck and build, git diff --check all passed. AST graph refreshed. Both original standalone reproductions now pass against this checkout. Frontend unchanged since passing lint, all16contract groups and build.
Both blockers were independently reproduced before correction. New focused regression run before fix:34tests,29passed,5failed. This includes the normally closed malformed429followed by known-success through real generation and automation accounting. Corrected status400/408usage observations are asserted through the real generator failure hook.
These are synthetic local checks, not production health evidence. Your review is code-trace-only.
```

## Final timeout correction

### Shared instructions

```text
Perform a narrow final re-review of the HTTP 408 retry correction. The previous two accounting blockers were already closed; review only this remaining regression and the small new diff, not unchanged library/Drive/Unicode work.

Read-only code tracing only. No writes, tests, shell execution other than file reading/search, network, router/vault actions or delegation. Do not read other reviewer responses or author handoffs. These restrictions override routine repository writeback rules.

Repository: /Users/maximisto/Documents/New project/.worktrees/sept-review-repairs
Diff: /tmp/violema-sept-timeout-final-review.diff
Manifest: /tmp/violema-sept-timeout-final-review-manifest.txt

Requirement: An interrupted HTTP 408 error with complete observed usage and an incomplete diagnostic message must retain that usage AND retry rather than stop after one fetch. Status-based retry must also keep fallback eligibility; unknown usage must not be converted into zero. Valid 400 rejections must remain non-retryable absent an independent retryable transport cause. Inspect the new HTTP recovery and SDK retry assertions against the real generator and the common retry/fallback predicates. Assess only concrete regressions introduced by this correction.

Return a concise code-traced verdict (ideally under 500 words). If any blocker remains, supply path/line, trigger, impact and reproduction. Otherwise explicitly state the timeout regression is closed. Distinguish parent test evidence from your trace. End VERDICT: READY FOR SEPARATE RELEASE APPROVAL, WITH FIXES, or DO-NOT-SHIP for this final accounting correction. No production-health or deployment authorization claim.
```

### Manifest

```text
Base: bcf3402a7fbd8d80fd213594b55849613a5d48f2
Head: f8a70b29ca4aaf3eb17069aa35882dae016aab40
Diff SHA-256: a7cf38240a5292bb2ca855c344f332dd90dc5501c747c01c866f964d452e750b
Source changes: one retry predicate adds explicit status408; tests assert real interrupted408then success keeps21failed tokens and5successful tokens; SDK408retries without inferring zero. The same retry predicate governs fallback eligibility.
Parent-executed validation after final correction:47focused checks,890full backend tests (863top-level plus27nested),8platform tests, backend typecheck/build, git diff --check and AST refresh passed. Frontend unchanged since passing lint/all16contract groups/build.
Before this last change the HTTP recovery test and SDK408retry test both failed (44tests/42pass/2fail). Earlier accounting correction already passed888tests and both reviewers closed its two original blockers.
No live provider, production mission, or visual browser checks. Reviewer uses code tracing only.
```
