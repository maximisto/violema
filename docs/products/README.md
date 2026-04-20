# Product Split

This repo is moving toward two distinct products.

## Decision

- `Violema` is the outcome product.
- `Agent Studio` is the optimization product.

That separation is not branding theater. It fixes a real product problem:

- Violema should sell completed work.
- Agent Studio should sell better agent-system performance.

## Product roles

### Violema

Violema should answer:

- What work can I hand off?
- What ran?
- What succeeded?
- What needs attention?
- What should I automate next?

Violema should not require users to think about:

- branch promotion logic
- topology tuning
- review-pressure experiments
- architecture comparisons

### Agent Studio

Agent Studio should answer:

- Which architecture performs better?
- Where is cost wasted?
- Where is reliability weak?
- Should this branch be promoted or rolled back?
- What policy should we run next?

Agent Studio should not try to be:

- another chat product
- another workflow automation frontend
- another generic visual builder

## Shared integration boundary

The two products should connect through a stable data boundary.

Agent Studio should ingest:

- workflow definitions
- role and phase topology
- run traces
- cost data
- success and failure outcomes
- policy state
- promotion and rollback history

Violema should receive back:

- recommended policies
- branch experiments
- promotion or rollback decisions
- evaluation summaries
- safe defaults for execution

## Separation rules

### For Violema

- Keep the UX outcome-first.
- Hide architecture depth unless the user explicitly wants it.
- Make reliability and completed work the retention loop.

### For Agent Studio

- Keep it runtime-agnostic.
- Do not make it depend on Violema-only UI metaphors.
- Treat Violema as one integration, not the whole product.

## Files in this docs area

- [Violema setup](/Users/maximisto/Documents/New%20project/docs/products/violema/SETUP.md)
- [Violema handoff](/Users/maximisto/Documents/New%20project/docs/products/violema/HANDOFF.md)
- [Agent Studio setup](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/SETUP.md)
- [Agent Studio handoff](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/HANDOFF.md)
- [Agent Studio integration contract](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/INTEGRATION_CONTRACT.md)
- [Agent Studio open source plan](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/OPEN_SOURCE_PLAN.md)
- [Agent Studio market and positioning](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/MARKET_AND_POSITIONING.md)
- [Agent Studio standalone repo spec](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/STANDALONE_REPO_SPEC.md)
- [Agent Studio legal files guide](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/REPO_LEGAL_FILES.md)
- [Agent Studio adapter and memory strategy](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/ADAPTER_AND_MEMORY_STRATEGY.md)
- [Split execution plan](/Users/maximisto/Documents/New%20project/docs/products/SPLIT_EXECUTION_PLAN.md)
- [Repo and git plan](/Users/maximisto/Documents/New%20project/docs/products/REPO_AND_GIT_PLAN.md)
- [Domain and DNS instructions](/Users/maximisto/Documents/New%20project/docs/products/DOMAIN_AND_DNS.md)
- [Deployment and auth plan](/Users/maximisto/Documents/New%20project/docs/products/DEPLOYMENT_AND_AUTH_PLAN.md)
- [Rollout checklist](/Users/maximisto/Documents/New%20project/docs/products/ROLLOUT_CHECKLIST.md)
