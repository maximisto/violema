# September 13 remaining review repairs

Status: LOCAL REPAIRS COMPLETE; full reviews and scoped blocker closure complete. Final source `f8a70b29ca4aaf3eb17069aa35882dae016aab40` is ready for a separately authorized release decision. Not deployed. Supersedes the open-backlog dispositions in `2026-09-13-high-severity-repair-evidence.md`; that earlier file remains a record of the first three repairs.

Worktree: `/Users/maximisto/Documents/New project/.worktrees/sept-review-repairs`, branch `codex/sept-review-repairs`. Original checkout and its four untracked September 8 reviewer handoffs are preserved. No push, merge, deploy, live mission, approve/rerun, send, or production-data mutation.

## Verified mechanisms

| Cluster | Reproduction and resulting behavior |
| --- | --- |
| Server/timeout accounting | Seven HTTP-status and three SDK-status regressions proved missing receipts were manufactured into zero. A real mocked HTTP 504 followed by HTTP 200 flowed through the real generator and automation accounting, incorrectly returning success before repair. Unknown attempts now require reconciliation even after successful retry; observed usage remains billable. |
| CJK fallback | Four failures reproduced: memo 607/350, summary 2400/400, mixed-script 11/9, oversized memo footer accepted. Counting and truncation now share the same Unicode units and preserve script order/punctuation. Memo final validation uses its 16 KB limit. |
| Assembled baseline bounds | Baselines of 8,000 and 8,001 bytes were accepted although the reader ceiling is 7,999. Digest budgets now reserve separators and all deterministic metadata; exact persisted bytes and 400 word units are checked. |
| Persistent omitted history | Omission metadata is retained outside generated prose, with a bounded v1 marker and disclosure. Legacy notices migrate. Repeated refreshes retain the warning delivered to mission reads. Parent review additionally reproduced multiline filename loss in both new bootstrap and legacy migration; both boundaries now retain provenance. |
| Drive pagination | Explicit short/empty token-bearing pages are traversed within 100 returned files and 10 recovery requests. Repeated tokens, an unfinished chain, and explicit incompleteSearch cannot certify safe history. Arbitrary adapter token stripping remains unproven and undetectable from an untyped response. |
| Platform versus grant failure | The actual disabled Composio bridge had produced 200/Connect Google Drive. It now remains 502. Thrown and envelope scope failures now give 200/Reauthorize Google Drive across all three folder-drop routes, with distinct Settings copy and repair action. Outages and quotas stay server failures. |
| CJK baseline policy | The existing 400-unit limit remains. The prompt now explains the same script and word-unit rules as validation; no silent capacity increase. |

The earlier predecessor-beyond 100 and transient-read-omission repairs remain in this release diff. Recovery is intentionally bounded and may refuse very large libraries; there is no automatic unbounded migration or recovery job.

## Accounting classification

A completed error body is not itself a usage receipt. Explicit request-rejection statuses may still infer zero, and the existing direct Anthropic 529 overload convention is retained only for that provider's standard endpoint. Generic 408/500/502/503/504/524/529 and custom-proxy server failures without receipts remain unknown. This changes the old NF-9 behavior: some transient server failures now pause accounting for reconciliation.

Primary references: [Cloudflare524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/) documents origin connection without a timely response; [Anthropic errors](https://platform.claude.com/docs/en/api/errors) distinguishes internal errors from overload. These support the conservative classification; they do not establish that any particular failed request was billed. No customer exposure or provider invoices were inspected. The initial integrated suite exposed one old mission-budget fixture that expected success after a receipt-less 502; it now uses 429 to exercise a known rejection retry. The separate real 504-then-success accounting regression continues to require reconciliation.

Pagination references: [Google Drive files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) and the [Composio Google Drive toolkit](https://docs.composio.dev/toolkits/googledrive). The toolkit input contract exposes pageToken and selectable nextPageToken/incompleteSearch; output data is untyped. Local bridge inspection found no token stripping. Live provider normalization was not tested.

## Verification and review

Source/test review range: `85579c812b6739c9ee13ba101268bc085742e966..76e513f6beaf534ce440c373c4874f5aa12e2ee8`; frozen diff SHA-256 `ad3b976b5e42e233872a7e228df5cbd73fb08400978161dcf95b1d0e5046d5a9`.

Executed after final source changes:
- Backend: `npm run typecheck`, `npm test` (883 passed; 856 top-level plus 27 nested), `npm run test:platform` (8 passed), `npm run build`.
- Frontend: `npm run lint`, `npm test` (all 16 contract groups), `npm run build`.
- `git diff --check`; `graphify update .` (2618 nodes, 5050 edges, 242 communities).
- Full test receipt: `2026-09-13-remaining-repair-test-receipt.txt`. Initial integrated run: 882 tests, 881 passed, 1 old 502 fixture failure; final run includes the final multiline coverage and corrected fixture.

Initial full-review verdicts on 76e513f: Fable 5.1 READY FOR SEPARATE RELEASE APPROVAL; Astra DO-NOT-SHIP with two accounting findings. Both were independently reproduced by the parent. The followup regression run had 34 tests, 29 passed, 5 failed (including the real automation path); after the narrow correction, 45 focused checks passed. See the separately preserved review responses.

The correction at bcf3402 requires JSON envelope completion before inferred zero and uses the bounded usage-preserving reader for every unsuccessful HTTP response. It was built in a separate temporary checkout to keep Fable's original review snapshot stable, then cherry-picked into the repair branch. That correction passed 888 full backend tests. Both scoped reviewers closed the two original blockers; Astra found one additional 408 retry regression. It reproduced in HTTP recovery and SDK retry tests. The correction at f8a70b2 explicitly classifies 408 as retryable through both retry and fallback predicates; 47 focused checks pass, and final full verification passed. Both final scoped reviewers cleared the timeout correction.

Fable low-severity dispositions:
- Larger never-baselined histories remain blocked by design; the existing retry-oriented remedy can mislead and needs a dedicated manual-recovery experience in followup. This release does not implement that workflow.
- Individual oversize versus exhausted shared-budget behavior depends on observed bytes and file order. Files outside the intentional omission window are disclosed; an independently observed source failure still blocks bootstrap.
- Listing changes between probe and recovery are a pre-existing consistency risk, not proven provider token stripping.
- The claimed CRLF notice limitation was checked with the actual exported parser: a legacy notice ending CRLF is recognized. Paraphrased historical notices remain unrecoverable without separate provenance.
- Platform-key 401 classification and browser-rendered CTA behavior remain unverified. No provider receipt/invoice or customer record was inspected. Focused fixtures use fake provider transports and temporary local workspace/auth stores. Real HTTP route and accounting implementations are exercised, but authenticated production UI and live provider behavior are unverified.

The two final review lanes receive the same frozen release diff, requirements and validation manifest. Both are restricted to file reading/search and code tracing, without executing reproductions or reading each other's verdicts. This is a fresh release review, not a controlled rerun of the September 8 experiment.

## Rollback and remaining boundary

Revert the explicit repair commits in reverse order if local rollback is needed. Never reset the original checkout or erase its untracked review evidence. Persistent omission metadata is additive and legacy-readable, but deploying old code later would again allow it to be lost on compaction. Deployment requires a separate explicit request.


## Final source receipt

Final source head: `f8a70b29ca4aaf3eb17069aa35882dae016aab40`. Final gates: 47 focused tests, 890 full backend tests (863 top-level + 27 nested), 8 platform tests, backend typecheck/build and graph refresh passed. Frontend lint, all 16 contracts and build passed on unchanged frontend code. Two new timeout-retry regressions were red before the explicit 408 predicate correction.

Final verdicts: Astra and Fable 5.1 both READY FOR SEPARATE RELEASE APPROVAL for the last correction. Combined with the earlier full reviews and blocker closures, no confirmed review blocker remains in this local repair batch. This is not a claim that both reran a fresh full review on the final head; full review was on 76e513f and subsequent passes checked each correction. Exact shared review inputs and manifests are archived in `2026-09-13-review-contracts-and-manifests.md`. All reviewer runs, including the initial disagreement and subsequent WITH FIXES response, remain separate historical records.

Final clearance records: `2026-09-13-astra-final-clearance.md` and `2026-09-13-fable-final-clearance.md`. Remaining low-severity followups and live-verification limits above are retained.
