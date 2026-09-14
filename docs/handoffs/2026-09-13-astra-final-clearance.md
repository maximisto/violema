# Astra final timeout correction clearance

Source head: `f8a70b29ca4aaf3eb17069aa35882dae016aab40`. Read-only code tracing. This scoped pass closes the last blocker from the earlier full release and accounting correction reviews; those earlier responses remain unchanged.

The timeout retry regression is closed at `f8a70b29ca4aaf3eb17069aa35882dae016aab40`. No remaining blockers or concrete regressions were found in this correction.

- `backend/src/models.ts:422` now explicitly recognizes HTTP 408 as retryable, independent of diagnostic text. The shared predicate also restores fallback eligibility.
- Usage handling remains separate: an observed receipt survives, while HTTP 408 without usage remains unknown. Status 400 remains non-retryable absent another retryable cause.
- The new HTTP test invokes the real generator and asserts exactly two requests, retention of the failed attempt’s 21 tokens, and a successful result reporting 5 tokens.
- The SDK test invokes the real generator with a synthetic SDK boundary and checks repeated attempts without inferred zero usage.

This verdict is based on code tracing; I executed no tests. The manifest reports 47 focused checks, 890 backend tests, 8 platform tests, typecheck/build, and diff validation passing.

The verdict covers this final accounting correction only. It does not establish production health or authorize deployment.

VERDICT: READY FOR SEPARATE RELEASE APPROVAL
