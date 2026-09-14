# Fable 5.1 September repair release review

Frozen source head: `76e513f6beaf534ce440c373c4874f5aa12e2ee8`. Read-only code tracing, same source diff/requirements as Astra. No reproductions executed by this reviewer. Actual model metadata confirms `claude-fable-5-1`; auxiliary Haiku metadata is not a second reviewer.

## Verbatim response

Review complete. Everything below is code-traced from the frozen diff and the repository source at head 76e513f. I executed nothing; test claims come only from the manifest and the test source.

## Findings

No blocking defects. I found no reachable path in the changed surface that violates the stated requirements. The items below are low-severity behavior consequences and residual gaps, in priority order.

**1. Low. Never-baselined sections beyond the 100-file window are now permanently deadlocked, and the remedy text misdirects.**
- Where: `backend/src/integrationGateway/accountLibrary.ts:1335` sets `appBaselineListed` to undefined whenever `listingHasMore` is true. `backend/src/integrationGateway/libraryBaseline.ts:598` and `backend/src/integrationGateway/queryData.ts:352` both require it to be strictly false to bootstrap.
- Trigger: a section folder holding 101 or more app memos and no baseline anywhere, or 100 memos plus a trailing page token.
- Impact: every mission read stops with the "could not read the account library history completely" failure and a "Retry Google Drive" next action. Every write fails with "older unbaselined library history is outside the safe read window". No code path can ever create the first baseline, so retrying cannot help and the next action points at a Drive connection that is fine. Before this release such a section bootstrapped with an omission notice.
- Assessment: this is the fail-closed outcome the requirements demand, so I do not count it as a regression. The wrong remedy is the actionable part. A distinct message and next action for "history too large to compact safely" would fix it without weakening the gate.
- Synthetic repro: fake Drive with 101 memo files and no baseline, run a mission read then an append with baseline. Both fail with the messages above. The new test at `backend/tests/libraryBaseline.test.ts:980` already exercises this path and asserts the failure.

**2. Low. Classification of an individually oversized memo during bootstrap depends on where it sits relative to budget exhaustion.**
- Where: `accountLibrary.ts:1274` treats any truncated memo as budget-omitted when the per-file budget is already below the entry cap, regardless of the memo's own size. `accountLibrary.ts:1281` marks the same memo as a read failure when the budget is still full.
- Trigger: a memo larger than the recoverable entry cap placed after enough newer memos to shrink the budget below that cap.
- Impact: in one ordering the memo is named in the omission disclosure and bootstrap proceeds. In the other ordering bootstrap is blocked until the file is removed. Neither outcome is silent, so this satisfies the letter of the requirement, but the inconsistency means the same folder content can produce different provenance depending only on file order.
- Synthetic repro: two memos of 30,000 bytes followed by one of 40,000 bytes with the recovery budget. The third is disclosed as omitted. Reverse the order and the section is blocked with "could not be read completely".

**3. Low, pre-existing. The recovery listing replaces the initial listing without cross-checking.**
- Where: `accountLibrary.ts:1178` assigns the paginated recovery result over the initial page.
- Trigger: the initial page lists files but the recovery chain returns fewer or none with no token, which is only possible with an inconsistent provider.
- Impact: the read reports a complete, smaller history. The diff did not introduce this and the paginated loop behaves the same as the old single call. I note it because the new loop is the place a cross-check would go.

## What I verified as correct

- **Error-body usage parsing** in `backend/src/models.ts:195` only accepts a top-level `usage` object that closes inside the observed prefix, validates the prefix by parsing it, and refuses nested or mid-number cuts. The `complete` flag is only set on a clean stream end, so a body cut at the 64 KB cap or a socket death never yields inferred zero usage.
- **Zero-usage inference** at `models.ts:1110` is limited to explicit 4xx rejections plus direct Anthropic 529. Server and gateway statuses stay unknown on both the HTTP and SDK paths. The direct-Anthropic check uses the same base URL the SDK is constructed with.
- **Reconciliation** at `backend/src/server.ts:4249` treats a failed call with no usage as unaccounted regardless of later successes, so the retry-then-success case pauses the automation.
- **Baseline assembly** at `libraryBaseline.ts:470` budgets marker, separator and disclosure in both bytes and word units, validates the exact persisted body against the 7,999-byte reader ceiling, and keeps the 400-unit policy. Word units are additive across the blank-line separator, so the prompt limit and the final check agree.
- **Provenance** survives refreshes because the notice is stripped from the prompt and from model output, then re-appended once. Legacy notices without the marker are recognized and migrated. Mission reads surface the caveat through the structured warnings array, which `server.ts:6085` copies into step warnings independent of prose.
- **Word truncation** in `backend/src/platform/automationSummaryPolicy.ts:157` uses the same unit regex as the validator, preserves original text between units, and byte-bounds afterward. Re-stripping links in the final validator can only lower the count, so the fallback cannot fail its own check on words.
- **Pagination** follows raw opaque tokens, treats short and empty pages as non-terminal, caps both requests and files, detects repeated tokens, and never lets an unfinished chain prove absence. The full-page guard is retained on both the initial and recovery paths. `incompleteSearch` fails the read closed when present and not false, and is not assumed when absent.
- **Failure classification** at `backend/src/integrationGateway/adapters/partnerComposio.ts:345` catches the actual bridge-off message from `backend/src/composioBridge.ts:395` before the scope and connection heuristics. Rate-limit 403s remain platform failures. The folder-drop routes and Settings page map scope to a distinct reauthorization state and everything else to a 502.
- No tenant, readiness, or approval-gate code is touched. No other frontend consumer of the lane-state union exists, so the new state cannot reach an unmapped lookup table.

## Residual limitations

- I did not run tests, typecheck, or lint. The manifest reports them passing but I cannot confirm that.
- Legacy notices that an earlier model refresh paraphrased, or that were saved with CRLF line endings, are not detectable by the regex. Those baselines will not regain provenance and no code change can recover that.
- Text heuristics in `classifyFailure` cannot distinguish a platform-side Composio 401 from an invalid or rotated platform key from a customer-grant 401. The exact SDK message is not evidenced in the repository, so I list this as unverified rather than as a defect.
- HTTP 402 and other 4xx codes outside the rejection list remain unknown usage. That is conservative, but an OpenRouter insufficient-credit rejection will pause an automation for manual reconciliation.
- Word-unit truncation can cut between a base character and a following combining mark in Thai or Indic text. The count stays conservative and order is preserved. The cut is cosmetic.
- The frontend contract test is source-string matching, not a rendering check, and the manifest says no browser inspection was done.

VERDICT: READY FOR SEPARATE RELEASE APPROVAL

This is a bounded code review of the diff and its callers. It is not evidence of production health and not authorization to deploy.

## Run metadata

```json
{
  "subtype": "success",
  "is_error": false,
  "modelUsage": {
    "claude-haiku-4-5-20251001": {
      "inputTokens": 1581,
      "outputTokens": 15,
      "cacheReadInputTokens": 0,
      "cacheCreationInputTokens": 0,
      "webSearchRequests": 0,
      "costUSD": 0.001656,
      "contextWindow": 200000,
      "maxOutputTokens": 32000,
      "thinkingTokens": 0,
      "canonicalModel": "claude-haiku-4-5",
      "provider": "firstParty",
      "costBasis": "list"
    },
    "claude-fable-5-1": {
      "inputTokens": 258,
      "outputTokens": 50599,
      "cacheReadInputTokens": 712184,
      "cacheCreationInputTokens": 154993,
      "webSearchRequests": 0,
      "costUSD": 5.810436,
      "contextWindow": 1000000,
      "maxOutputTokens": 64000,
      "thinkingTokens": 42154,
      "canonicalModel": "claude-fable-5-1",
      "provider": "firstParty",
      "costBasis": "list"
    }
  },
  "permission_denials": [],
  "duration_ms": 678874
}
```
