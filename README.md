# Purple Orange Product Workspace

This repo currently holds the live `Violema` app and the embedded `Agent Studio` surface that is being split into its own product.

## Product split

- [Product split overview](/Users/maximisto/Documents/New%20project/docs/products/README.md)
- [Violema setup](/Users/maximisto/Documents/New%20project/docs/products/violema/SETUP.md)
- [Violema handoff](/Users/maximisto/Documents/New%20project/docs/products/violema/HANDOFF.md)
- [Agent Studio setup](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/SETUP.md)
- [Agent Studio handoff](/Users/maximisto/Documents/New%20project/docs/products/agent-studio/HANDOFF.md)

## Current repo truth

- `Violema` is the live outcome product.
- `Agent Studio` still lives inside the Violema codebase today.
- The docs above define the clean conceptual split before code extraction.

## Direction

- `Violema` should become the AI operator for recurring team workflows.
- `Agent Studio` should become the control room for tuning agent architectures across runtimes.
- The integration boundary should be shared run data, policies, traces, experiments, and outcomes, not shared UI confusion.
