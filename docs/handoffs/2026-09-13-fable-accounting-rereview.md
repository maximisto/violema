# Fable 5.1 accounting correction re-review

Range: `76e513f..bcf3402`. Same scoped prompt, source diff and manifest as Astra. Read-only code tracing; the parent separately verified source hashes. One attempt to read the worktree administrative HEAD outside the permitted directory was denied; source/diff access succeeded and the result was not an error.

## Verbatim response

Both blockers trace closed. Here is the review of the corrective accounting diff (base 76e513f to head bcf3402, matching the worktree's top commit in the session snapshot; I could not recompute the diff SHA-256 without a shell).

**Blocker 1 (malformed 429 certified as zero usage): closed by code trace.**
- `backend/src/models.ts:288-291` now forces `complete = false` whenever the bounded body fails to parse, so a normally closed transport EOF no longer certifies the envelope.
- `backend/src/models.ts:1192` only calls the zero-inference helper when the reader reports a complete parse. For the body ending inside `total_tokens`, the prefix scanner at `backend/src/models.ts:195-243` never sees the usage object close, returns undefined, and the thrown error carries no usage.
- The retry wrapper passes that error unchanged through the failure hook (`backend/src/models.ts:567-570`, `1081-1086`), so the automation event at `backend/src/server.ts:5721` records undefined usage. The accounted check at `backend/src/server.ts:4249-4254` then rejects it, and the successful retry hits the reconciliation throw at `server.ts:5745-5751` instead of settling. That is exactly the previously missing quarantine.

**Blocker 2 (400/408 interruption lost observed usage): closed by code trace.**
- The generator now routes every non-ok status through the bounded reader (`backend/src/models.ts:1186`) and the old post-parse rejection branch is deleted. Previously a 400 whose body died mid-stream threw a retryable read error with no usage.
- For the interrupted body, the read loop catches the stream error, the JSON parse fails, and the prefix scanner recovers the complete top-level usage object before the truncated error message. The error is constructed with that usage, and the hook receives it. Status 400 and 408 remain non-retryable, 429 retries with the same preserved usage each attempt.

**Adjacent behavior checks, all traced as sensible.**
- Valid complete rejections: a fully parsed JSON body keeps `complete = true`, so a 400/429 with a proper envelope and no usage still infers zero, and observed usage in a valid body still wins.
- Sanitization: the prefix path extracts only the allowlisted message and usage fields, and the cause passes through the sanitizer twice (reader and error constructor). No raw bytes reach the error.
- Bounded bytes: a body that hits the 64 KB cap breaks without `done`, leaving `complete = false`, so a truncated oversize body can never certify zero.
- Successful responses and OpenRouter 200-wrapped errors are untouched by the diff.
- The other reader caller at `backend/src/models.ts:609-629` only consumes the cause and is unaffected.

**Tests assert the real public paths.** The provider tests call `generateTextDetailed` with a mocked fetch and inspect the failure hook, and the automation scenario runs `server.runAutomation` through the real generator and asserts failed status, reconciliation flag, and the `[undefined, 800]` per-attempt usage sequence.

**One non-blocking behavior change to note.** Any non-JSON complete rejection body, such as an empty body or a proxy HTML page on 429 or 4xx, now yields unknown usage rather than inferred zero. If a retry then succeeds, the automation is quarantined for reconciliation where it previously settled. This follows directly from the stated requirement to demand a valid envelope before zero inference, so I treat it as a conservative trade-off, not a regression. No remaining blockers found in the corrected scope.

**Evidence split.** Everything above is code-traced. The manifest states the parent ran the focused provider, accounting, and budget checks, the full backend suite, platform tests, typecheck, build, and both standalone reproductions, all passing after the correction. I did not execute any of that and cannot independently confirm those results.

VERDICT: READY FOR SEPARATE RELEASE APPROVAL for the corrected accounting scope. This is not a production health claim and does not authorize deploy.

## Run metadata

```json
{
  "subtype": "success",
  "is_error": false,
  "modelUsage": {
    "claude-haiku-4-5-20251001": {
      "inputTokens": 1326,
      "outputTokens": 18,
      "cacheReadInputTokens": 0,
      "cacheCreationInputTokens": 0,
      "webSearchRequests": 0,
      "costUSD": 0.001416,
      "contextWindow": 200000,
      "maxOutputTokens": 32000,
      "thinkingTokens": 0,
      "canonicalModel": "claude-haiku-4-5",
      "provider": "firstParty",
      "costBasis": "list"
    },
    "claude-fable-5-1": {
      "inputTokens": 162,
      "outputTokens": 11525,
      "cacheReadInputTokens": 132526,
      "cacheCreationInputTokens": 42688,
      "webSearchRequests": 0,
      "costUSD": 1.4647615,
      "contextWindow": 1000000,
      "maxOutputTokens": 64000,
      "thinkingTokens": 7801,
      "canonicalModel": "claude-fable-5-1",
      "provider": "firstParty",
      "costBasis": "list"
    }
  },
  "permission_denials": [
    {
      "tool_name": "Read",
      "tool_use_id": "toolu_01AgZJLC5H49Vs5yoLV7JYAQ",
      "tool_input": {
        "file_path": "/Users/maximisto/Documents/New project/.git/worktrees/sept-review-repairs/HEAD"
      }
    }
  ],
  "duration_ms": 149983
}
```
