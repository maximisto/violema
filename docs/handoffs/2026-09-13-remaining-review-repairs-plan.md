# Remaining September review repairs

User authorization: proceed using all current information, including Fable 5.1's September 13 prioritization. Continue on `codex/sept-review-repairs` from `61f2890`. No deploy, push/merge, live mission, approve/rerun, outbound, or production-data mutation.

## Work and ownership

1. Parent: reproduce timeout/error-status zero-usage behavior through HTTP and SDK paths; repair proven gaps in `backend/src/models.ts` and provider/accounting tests. Preserve completed observed usage and complete overload/rejection behavior only where justified.
2. CJK worker: reproduce and fix deterministic fallback counting/truncation in `backend/src/platform/automationSummaryPolicy.ts` and `backend/tests/automationSummaryPolicy.test.ts`. Keep baseline word-limit policy separate; do not change its 400-unit limit.
3. Library worker: owns `backend/src/integrationGateway/libraryBaseline.ts`, `accountLibrary.ts`, library/query tests, and necessary narrow `queryData.ts` changes. First fix assembled word/byte limits; then separately preserve omission provenance across successor baselines with a backward-compatible marker. Verify pagination at the actual provider boundary against primary documentation. Preserve bounded reads and fail closed on unproven history.
4. Drive worker: owns `backend/src/server.ts`, `composioBridge.ts`, partner failure classification and corresponding route/bridge tests. Reproduce missing platform configuration versus customer grant absence, and insufficient-scope repair handling. Coordinate rather than editing the library worker's files.
5. Parent integrates separate patches and reviews regression evidence. Run backend typecheck/full suite/platform, frontend lint/build and relevant contracts, graph update, diff checks. Run fresh Astra and Fable reviews on the complete release diff `85579c8..HEAD`, with identical read-only review instructions and access to tests/reproductions.
6. Repair confirmed review blockers, repeat scoped review, save exact evidence and remaining limitations. Update Second Brain and the existing talk addendum without inflating claims or changing the frozen comparison/refusal count. Keep deployment separate even if both reviews clear.

## Gates and constraints

- Record red-before-green evidence, real behavior assertions, command/result, and code-read versus executed evidence.
- CJK policy remains fail-closed; improving prompt/validator consistency is allowed, silently raising limits is not.
- Unbounded pagination or growing baseline provenance is not an acceptable repair.
- No workspace identity/customer-impact assumptions: live exposure was not checked.
- Workers are not alone; do not revert others' changes. No staging/commits by workers; parent freezes conceptual commits with explicit paths.
- Maximum three attempts per failing approach; instrument after two unexplained failures. Budget is task scope, with no requested token/spend limit.

## Progress

Intake verified: isolated worktree clean at `61f2890`; original checkout remains main `85579c8` with its four original untracked review documents.


1. Accounting: complete at 517054d; 10new HTTP/SDK red cases plus real 504-then-success automation reproduction. 39focused checks passed. Existing budget-retry fixture corrected at 76e513f after the full suite exposed its incompatible 502 assumption; successful rate-limit rejection is 429, and timeout reconciliation remains separately asserted.
2. CJK fallback: complete at 5dfa19c; 4reproductions, 19focused checks passed.
3. Library bounds at c81c8fe, persistent provenance at d902465, pagination at 1f2cc17: complete. 65focused checks passed, including two parent-discovered multiline filename regressions. Existing 400-unit policy retained. Arbitrary token stripping remains an unproven provider-normalization hypothesis.
4. Drive classification/UI: complete at c7bf662; 47backend checks and frontend contract/build passed.
5. Integrated verification: 883backend tests, 8 platform tests, backend typecheck/build, frontend lint/all 16 contract groups/build passed. AST refresh: 2618 nodes / 5050 edges. Source frozen at 76e513f6beaf534ce440c373c4874f5aa12e2ee8 for fresh Astra/Fable read-only reviews.
6. Complete. Initial full review disagreed: Astra found two reproduced accounting blockers while Fable cleared the snapshot. Both closed at bcf3402; a subsequent 408 retry regression reproduced and was repaired at f8a70b2. Final gates: 890 backend tests, 8 platform tests, 47 focused checks, required builds/typecheck/lint/contracts and graph refresh pass. Both final scoped review verdicts: READY FOR SEPARATE RELEASE APPROVAL. Vault/talk writeback completed; no external release authorized.
