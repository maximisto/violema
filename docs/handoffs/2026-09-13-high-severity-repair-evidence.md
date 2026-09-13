# September 13 — high-severity repair evidence

Base: `85579c812b6739c9ee13ba101268bc085742e966`.
Worktree: `/Users/maximisto/Documents/New project/.worktrees/sept-review-repairs`.
Branch: `codex/sept-review-repairs`.

## Scope and release status

This is the first repair batch: the three high-severity September 8 Astra findings recommended as the next step and authorized by Max on September 13. It is not closure of the complete two-reviewer backlog. No production deployment, live workflow, approve/rerun action, or outbound send occurred. Production impact has not been assessed from live telemetry in this session.

## Reproduced and repaired

| Finding | Executed failure | Result required by the repair |
| --- | --- | --- |
| Incomplete error-body accounting | A 502 response hides usage after 66,000 diagnostic characters; alternatively the stream fails before or after observed usage. The old code reports zero. | Preserve a complete observed usage object. Unread or incomplete usage remains unknown so accounting requires reconciliation. Complete ordinary rejection behavior stays covered. |
| Baseline outside metadata window | 100 small memos precede a healthy baseline at position 101. The old updater writes a replacement without the predecessor. | Bounded metadata cannot prove absence. Refuse mission reads, append, and compaction until history can be recovered; no replacement is written. |
| Transient source omission | Newest memo download fails; three older 30 KB memos also exhaust the history budget. The old bootstrap succeeds without the newest finding. | A source read failure remains distinct from permitted history-budget truncation. Refuse the read/write paths; after the download recovers, the retry includes that finding. |

The original two focused files passed **37/37**. Five new regressions then failed on the unchanged implementation. After the first repair they passed with the original tests, **42/42**.

## Fresh review changed the repair

The independent reviewer was a fresh agent in this session, not a rerun of the frozen Astra/Fable comparison.

1. First verdict: **WITH FIXES**. A token count cut mid-number (`total_tokens:123` of a possible `12345`) was accepted as authoritative usage. Two new tests reproduced the residual before its fix.
2. Second verdict: **WITH FIXES**. The first parsing fix discarded a valid usage object containing nested provider cache details. A new paired regression reproduced that compatibility failure.
3. The amended parser follows string and bracket boundaries inside the already bounded body, accepts a complete top-level usage object, validates its prefix as JSON, and preserves only the existing usage fields. It does not infer a completed number from a digit prefix or use a nested diagnostic usage object.

The focused suite now has **47 passing tests**: the original 37 plus 10 new cases. Final scoped verdict: **READY TO MERGE — no confirmed blockers remain in the three repairs.** The final reviewer inspected the amended parser and regression assertions; the passing test count is execution evidence from the parent session, not a claim that the final review reran it.

These WITH FIXES responses do **not** increment the historic flat DO-NOT-SHIP refusal count.

## Remaining September 8 triage

| Cluster | Current disposition |
| --- | --- |
| Incomplete error-body usage | Reproduced and repaired locally, including numeric-prefix and nested-detail followups. The adjacent HTTP-timeout zero-usage assumption remains unresolved. |
| Predecessor beyond 100 files | Reproduced; data-loss path closed by refusal at the existing bound. Larger automatic recovery is not implemented. |
| Transient memo omitted in bootstrap | Reproduced and repaired locally through read, preappend, and update paths. |
| Bootstrap omission notice lost on refresh | Still a September 8 reviewer claim; no independent reproduction or repair in this batch. |
| Notice breaks byte/word budgets | Still a September 8 reviewer claim; no independent reproduction or repair in this batch. |
| CJK deterministic fallback mismatch | Still a September 8 reviewer claim; no independent reproduction or repair in this batch. |
| Missing platform configuration shown as customer disconnection | Still a September 8 reviewer claim; no independent reproduction or repair in this batch. |
| CJK baseline limit/recovery behavior | Still a September 8 reviewer claim; no independent reproduction or repair in this batch. |
| Short listing page as completeness proof | Provider-boundary hypothesis remains to be verified. |
| Insufficient scope shown as platform error | Classification hypothesis remains to be verified. |

The original release gate remains closed: resolve the remaining findings and run both original review lanes before considering a separately authorized deployment. A scoped green review is not whole-release clearance.

## Validation

- Full backend `npm test`: **851 passed, 0 failed**, final run approximately 71.8 seconds. The top-level TAP plan is 824; 851 includes nested tests.
- Backend `npm run test:platform`: **8 passed, 0 failed**.
- Backend `npm run typecheck` and `npm run build`: passed on the final implementation.
- Root `npm run build`: backend and frontend passed before the final backend parser refinement; the final backend build was rerun afterward. An initial frontend build lacked dependencies in the new worktree; sharing the existing installed dependencies resolved setup without lockfile changes.
- `git diff --check`: passed.
- `graphify update .`: completed with AST-only extraction; graph updated to 2,614 nodes / 5,041 edges.
- Source-boundary behavior was exercised through real generation/retry hooks and library read/query/append/update functions with controlled HTTP/Drive fixtures. No authenticated production UX, live provider billing, customer data, GitHub CI, or production deployment was verified.
- Final scoped independent reviewer: **READY TO MERGE**, both review followups closed. Whole-release gate remains closed for the outstanding backlog.

## Reproduction handles

- `backend/tests/modelProviderErrors.test.ts`: bounded body, interrupted stream, completed usage, nested metadata, numeric cut, and non-authoritative diagnostic object cases.
- `backend/tests/libraryBaseline.test.ts`: predecessor outside metadata window and transient-source/budget combination, including mission and preappend gates.
- No provider credentials or real customer content are needed by these fixtures.

## Rollback

Changes are local to the isolated worktree. Main and production were not changed. Before any future release, preserve the existing deployment backup/approval process; this document authorizes no deployment or runtime-data migration.
