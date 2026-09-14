# Fable 5.1 final timeout correction clearance

Source head: `f8a70b29ca4aaf3eb17069aa35882dae016aab40`. Read-only code tracing; actual model metadata confirms `claude-fable-5-1`, with no permission denials. Hashes were independently computed by the parent; reviewer tracing is separate from parent-executed validation.

## Verbatim response

Tracing is complete. I have followed the 408 path through the HTTP route, the SDK route, the retry loop, and the fallback predicate, and I am writing up the verdict now.

**Scope reviewed:** the one-line predicate change at `backend/src/models.ts:422` plus the two new test assertions. Diff SHA matches the manifest. Everything below is my own code trace unless labelled as parent evidence.

**HTTP 408 with complete usage and truncated message (the regression):**

- `generateWithOpenAI` (`models.ts:1186-1193`) sees a non-OK 408 and calls `readBoundedModelError`. The stream read throws on pull, is swallowed, and `complete` stays false. Full JSON parse fails, so the fallback path runs. The message regex requires a closing quote, so the truncated `"interrupted` yields no cause. `readCompleteErrorUsagePrefix` walks the prefix, finds the closed usage object at depth 1, and returns 21 tokens.
- The thrown `ModelRequestError` carries status 408 and the observed usage. `failure.usage` is set, so `rejectedRequestUsage` is never consulted.
- In `withModelRetry` (`models.ts:552-583`), `requestStarted` is true, `sanitizeModelAttemptError` returns the error unchanged, and `onAttemptFailure` receives `error.usage` via `generationRetryOptions` (`models.ts:1085`). The raw error then hits `isRetryableModelError`, where the new 408 branch returns true and the loop sleeps and retries. Second fetch returns 200 with a terminal finish reason, so the result is returned with 5 tokens.
- Before this diff the same error fell through to the message regex, which does not match the sanitized message, and the call stopped after one fetch. The new test at `modelProviderErrors.test.ts:557` would fail on the base commit and passes on head by trace.

**Fallback eligibility:** `isFallbackableModelError` (`models.ts:437-442`) delegates to `isRetryableModelError` first, so 408 is now fallback-eligible through the same predicate. No separate status list to drift.

**Unknown usage stays unknown:** `rejectedRequestUsage` (`models.ts:1113-1119`) does not list 408, so a complete 408 body with no usage yields `undefined`, and an incomplete body yields `undefined` via the `complete` guard at line 1192. The SDK path (`sanitizeModelAttemptError`, `models.ts:183-188`) reaches the same helper and also returns `undefined` for 408. The widened SDK test at `modelFallback.test.ts:535` asserts exactly that and asserts at least two calls. By trace: status 408 makes `retryable` true, the raw error is retried, two calls occur, and each failure usage is `undefined`.

**400 remains non-retryable:** a `ModelRequestError` for 400 has no `retryable` flag, no code, name `Error`, and a message of the form "request failed (400): provider request failed" that does not match the transport regex. The swallowed body-read error never becomes a cause, so the existing 400 case in the `[400, 408, 429]` loop still rejects after one attempt with usage 21. The 408 member of that loop now retries once and still rejects, so the loop assertions hold.

**Non-blocking observations, both pre-existing and out of scope:**

- `fetchModelResponseWithRetry` (`models.ts:617`) still checks only 429 and 5xx inline, so 408 responses there are returned rather than retried. It is not on the text generation path.
- A 400 whose provider message happens to contain a word like "timeout" would match the message regex and retry. That predates this diff.

**Parent evidence, not verified by me:** the manifest reports 47 focused checks and 890 backend tests passing after the change, and that both new tests failed before it. I did not execute anything.

The HTTP 408 timeout regression is closed by code trace. No blocker remains in this correction.

VERDICT: READY FOR SEPARATE RELEASE APPROVAL

## Run metadata

```json
{
  "subtype": "success",
  "is_error": false,
  "modelUsage": {
    "claude-haiku-4-5-20251001": {
      "inputTokens": 1259,
      "outputTokens": 15,
      "cacheReadInputTokens": 0,
      "cacheCreationInputTokens": 0,
      "webSearchRequests": 0,
      "costUSD": 0.001334,
      "contextWindow": 200000,
      "maxOutputTokens": 32000,
      "thinkingTokens": 0,
      "canonicalModel": "claude-haiku-4-5",
      "provider": "firstParty",
      "costBasis": "list"
    },
    "claude-fable-5-1": {
      "inputTokens": 194,
      "outputTokens": 7735,
      "cacheReadInputTokens": 140140,
      "cacheCreationInputTokens": 33653,
      "webSearchRequests": 0,
      "costUSD": 1.0967850000000001,
      "contextWindow": 1000000,
      "maxOutputTokens": 64000,
      "thinkingTokens": 3770,
      "canonicalModel": "claude-fable-5-1",
      "provider": "firstParty",
      "costBasis": "list"
    }
  },
  "permission_denials": [],
  "duration_ms": 98008
}
```
