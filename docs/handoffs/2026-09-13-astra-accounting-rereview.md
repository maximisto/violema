# Astra accounting correction re-review

Range:`76e513f..bcf3402`; read-only code tracing.

Both original accounting blockers are closed at `bcf3402a7fbd8d80fd213594b55849613a5d48f2`. One retry regression remains.

**P2 — Interrupted HTTP 408 responses can lose retry and fallback eligibility.**

**Location:** `backend/src/models.ts:1186`, interacting with `backend/src/models.ts:418`.

All unsuccessful responses now become `ModelRequestError`. For HTTP 408 with empty `statusText` and an interrupted diagnostic message, the bounded reader supplies the generic cause `provider request failed`. The retry classifier recognizes neither status 408 nor that generic cause; fallback also refuses it. Previously, interruption produced an explicitly retryable `ModelResponseReadError`.

**Impact:** A transient request timeout that previously retried now terminates generation immediately, even when another attempt would succeed.

**Synthetic reproduction:** Return the new interrupted-408 fixture—with its complete 21-token usage object and empty `statusText`—on the first fetch, then a valid successful response. The corrected code preserves the 21 tokens but stops after one fetch. The added test checks usage preservation, so it misses this recovery regression.

**Correction:** Classify HTTP 408 explicitly as retryable while retaining the observed usage.

The two original fixes otherwise trace correctly:
- Malformed JSON clears `complete`, preventing inferred zeros while retaining complete usage found in a valid prefix.
- HTTP 400/408 now pass through the bounded usage-preserving reader.
- The malformed-429 accounting test invokes the real generator and checks separate failed/successful attempts, blocked task state, paused automation, and reconciliation-required settlement.
- Valid complete rejection handling, sanitization, byte bounds, and successful-response processing remain intact.

This is code-traced evidence. I ran no tests; the manifest reports the parent’s passing checks. The verdict covers only the corrective accounting scope and does not establish production health or authorize deployment.

VERDICT: WITH FIXES
