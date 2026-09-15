# Analysis output budget repair

## Observed failure

Production `c1e7dbe` stopped a Competitor monitor run at “Extract what changed” on
2026-09-15 at 22:18 UTC: “Generated analysis exceeded the output limit and was
withheld from review.” Library read and search had succeeded. The persisted
generation record showed Anthropic `claude-sonnet-5`, 4,370 input tokens and
exactly 500 output tokens against a 500-token request ceiling. The run cost
displayed 99 credits. Evidence was inspected read-only; no new run was triggered.

## Change

- Share a bounded 2,200-token analysis allowance between runtime and preflight.
- Give the analyst an explicit 350-word target, three prioritized findings and
  at most three evidence links, with lower-priority omissions stated briefly.
- Update downstream estimated evidence size to reflect the larger allowance.
- Preserve incomplete-stop rejection, the 16 KB output guard, per-attempt credit
  authorization and settlement. No retry or delivery behavior changes.

This increases estimated and maximum analysis costs; actual billing still uses
recorded usage. Operator-owned mission budgets remain unchanged and can block a
run whose revised estimate no longer fits.

## Verification

- New execution regression failed before the patch: a provider response modeled
  as requiring 900 tokens was truncated and blocked the run. After the patch it
  reaches summarization; forced truncation still fails and settles usage.
- Runtime and preflight output ceilings agree; estimates include the allowance.
- Existing next-call and retry budget tests retain their behavioral assertions,
  with fixture budgets adjusted from 150 to 180 to reach the runtime boundary
  after the increased estimate. Both still stop before an unauthorized call.
- Backend typecheck and build passed; full `npm test`: **893 passed, 0 failed**.
- `npm run test:platform`: **8 passed, 0 failed**; `git diff --check` passed.
- `graphify update .` completed, AST only.
- Independent scoped static review: no blockers. This was not a Fable model review.

## Boundary

Local only. No push, merge, deploy, production data edit, rerun, approval or send.
Provider output in the regression is synthetic; it does not prove every live
analysis will finish within 2,200 tokens. The guard still withholds incomplete
output. Production completion must be verified after an explicitly authorized
deploy and controlled mission run.
