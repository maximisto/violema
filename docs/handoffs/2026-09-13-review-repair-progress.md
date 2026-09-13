# September review repair — progress

Scope: independently reproduce and repair the three high-severity September 8 Astra findings on base `85579c8`; triage related findings; capture verified implications for the September 15 DO-NOT-SHIP talk. No deployment, live workflow, approval, rerun, or outbound send.

1. Inspect source, existing regressions, and the frozen talk materials.
2. Reproduce incomplete-error-body usage loss, baseline outside the recovery window, and transient memo omission with failing behavioral tests.
3. Apply narrow repairs; test relevant adjacent boundaries and record remaining findings explicitly.
4. Run backend typecheck, full backend suite, platform checks, and independent review. Preserve the existing two-provider release gate; a local review is not equivalent to both original reviewers.
5. Update the Second Brain run record and generated project status; add a rehearsable talk evidence addendum without rewriting frozen reviewer outputs.

Budget: at most three attempts per failing approach; instrument after two unexplained failures. No model/spend override requested. Router decision `c65bf360-889e-4b20-b885-b263d5ef60ef` recommends an unavailable Claude Fable 5 lane; execution stays in the current session.

Initial state: main and remote main `85579c812b6739c9ee13ba101268bc085742e966`. Four pre-existing untracked September 8 handoffs preserved in the original checkout. Isolated branch `codex/sept-review-repairs`.

Status: first three high-severity repairs complete locally; no deployment.

1. Intake/source/talk inspection complete. Original reviewer outputs and desktop script preserved.
2. Three findings reproduced through five failing tests; original 37 focused tests green.
3. Narrow repairs and read/query/append boundary coverage complete. Fresh review found a numeric-prefix accounting residual, then nested-provider-metadata compatibility loss; both reproduced and repaired. Focused suite now 47/47.
4. Final backend suite 851/851; platform 8/8; backend typecheck/build and frontend build passed; diff check clean; final scoped reviewer READY TO MERGE. AST graph refresh complete. Original two-provider whole-release gate remains open, with seven other clusters and the timeout assumption listed in the evidence handoff.
5. Second Brain run note, Violema generator correction, and a 45-second talk insert with rehearsal corrections written. Final refresh/commit receipt follows in the vault run note.

Deliberate boundary: recovery beyond 100 metadata records refuses instead of overwriting history. No unbounded pagination, API/billing policy redesign, original experiment rerun, or change to the historical refusal count.
