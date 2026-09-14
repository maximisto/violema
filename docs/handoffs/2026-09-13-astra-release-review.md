# Astra September repair release review

Frozen head: `76e513f6beaf534ce440c373c4874f5aa12e2ee8`; base `85579c812b6739c9ee13ba101268bc085742e966`. Independent code-trace-only review. Parent reproduced the first finding separately after it was reported; this is not reviewer-executed evidence.

## Review response

Two accounting defects remain in frozen head `76e513f6beaf534ce440c373c4874f5aa12e2ee8`.

1. **P1 — Normal stream EOF can falsely certify a truncated error body as zero usage.**
   **Location:** `backend/src/models.ts:257`, consumed at `backend/src/models.ts:1189`.
   `complete` becomes true when the stream closes normally, even when subsequent JSON parsing proves the envelope unfinished. For HTTP 429, missing extracted usage then becomes an explicit zero tuple. The automation’s `isGenerationCallAccounted` accepts that failed attempt as settled; a successful retry therefore bypasses reconciliation.
   **Synthetic reproduction:** Return HTTP 429 with a normally closed body containing `{"error":{"message":"limit"},"usage":{"total_tokens":12` and then a successful response with valid usage. The first failure reports zeros rather than unknown usage.
   **Required correction:** Distinguish transport EOF from a complete error envelope before inferring zero usage.

2. **P2 — Interrupted non-429 client-error bodies still discard complete observed usage.**
   **Location:** `backend/src/models.ts:1183`, `backend/src/models.ts:1199`.
   The new usage-preserving reader handles only 429 and statuses ≥500. Other unsuccessful responses use `response.json()`. If their diagnostic tail is interrupted after a complete top-level usage object, the catch constructs `ModelResponseReadError` without retaining that usage. This loses observed charges and unnecessarily requires accounting reconciliation.
   **Synthetic reproduction:** Return HTTP 408 whose stream first supplies `{"usage":{"prompt_tokens":19,"completion_tokens":2,"total_tokens":21},"error":{"message":"interrupted`, then errors. The failure hook receives undefined usage rather than the observed 21 tokens.
   **Required correction:** Apply usage-preserving error-body handling to the remaining unsuccessful HTTP responses.

These findings are code-traced; I executed no reproductions or tests. The manifest’s passing checks are reported evidence, not independently rerun validation. I established no additional blockers in the changed provenance, assembled-output limits, multilingual fallback, pagination, or folder-drop lookup changes. Live provider behavior, browser rendering, customer exposure, and production health remain unverified.

VERDICT: DO-NOT-SHIP
