# Agent Studio Adapter And Memory Strategy

## Core principle

Agent Studio should be runtime-agnostic at the product layer.

That means:

- the app should think in workflows, runs, phases, policies, and recommendations
- adapters should handle framework-specific translation

## Adapter strategy

### Native adapters first

These should be first-class packages:

- LangGraph
- OpenHands
- CrewAI
- Microsoft Agent Framework

Each adapter should translate:

- workflow identity
- run identity
- step and phase execution
- role routing
- cost and timing
- policy metadata when available

### Generic ingestion path

For custom systems, support:

- SDK event emission
- REST ingestion
- optional streaming later

This is the path that makes the product useful beyond named frameworks.

## Memory strategy

Do not center the product around generic RAG.

The right default is:

- operational memory

Meaning:

- past runs
- failures
- healthy baselines
- interventions
- policy changes
- rollout results

The memory system should answer:

- have we seen this before?
- what changed?
- what worked last time?
- why should we trust this recommendation?

## Recommended storage path

### MVP

- Postgres
- pgvector

Use this for:

- run storage
- similarity search
- baseline comparison
- evidence retrieval

### Later

Optional temporal graph memory:

- Graphiti-style relationship layer

Use this for:

- richer temporal relationships
- cross-run causal context
- higher-quality recommendation provenance

### Optional companion layer

Mem0-style memory can help with:

- agent/user/session memory
- personalized or scoped memory

But it should not be the central model for operational release decisions.

## Third-party tools

Third-party tools should be treated as workflow helpers, not product identity.

Good categories:

- GitHub
- Slack
- docs and wiki connectors
- issue trackers
- MCP tool surfaces

Use them to:

- enrich run context
- support actions
- add evidence

Do not let them redefine the core product.

## Auto-improvement strategy

Automatic improvement should build on memory and replay, not bypass them.

Recommended progression:

1. Manual recommendations
2. Assisted apply-to-branch
3. Guarded automatic rollout

Guardrails:

- opt-in
- confidence threshold
- scoped change
- canary path
- rollback path
- visible audit trail

## Recommendation

Build around:

- adapters
- operational memory
- evidence-backed recommendations

Not around:

- generic RAG chat
- framework lock-in
- magical self-evolving claims
