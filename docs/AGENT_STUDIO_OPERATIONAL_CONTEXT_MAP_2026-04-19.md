# Agent Studio Operational Context Map

## Decision

Do not add a generic RAG chat panel to Agent Studio.

Add an **Operational Context Map** instead: a temporal memory layer that helps the system retrieve similar runs, explain recommendations with evidence, and compare current failures against prior healthy states.

## Why this matters

Agent Studio is already strong at:

- showing the current run
- replaying a run
- comparing setups

The missing capability is **cross-run operational memory with provenance**.

Right now the product can say:

- what is happening
- what changed in one run

It is weaker at saying:

- where we have seen this before
- what intervention worked last time
- what changed between healthy and degraded states
- why a recommendation should be trusted

That is the gap an Operational Context Map closes.

## Product shape

The map should power a few concrete surfaces, not become a new conceptual burden.

First user-facing surfaces:

- `Similar runs`
  - Find past runs with similar failure, cost spike, or handoff pattern.
- `Why this recommendation`
  - Show the evidence behind a suggested routing, review, or policy change.
- `What changed since last healthy state`
  - Compare current setup against the last stable window.
- `Related failures`
  - Group incidents by phase, role, tool, and policy.
- `Evidence trail`
  - Show the runs, interventions, and outcomes supporting a conclusion.

## Data model

Treat these as first-class entities:

- workflow
- run
- phase
- agent role
- tool call
- directive
- policy version
- intervention
- artifact
- outcome
- incident

Treat these as first-class events:

- run started / completed / failed
- phase failure
- policy change
- promotion
- rollback
- human intervention
- delivery result

## Recommendation

Best long-term fit:

- **Graphiti**
  - Best if we want temporal agent memory and relationship-aware retrieval.
  - Strongest match for Agent Studio as a control room.

Fastest lower-risk first version:

- **Mem0 with graph memory**
  - Better if we want a lighter memory layer and faster integration.
  - Good first step if we want signal quickly without committing to a heavier graph stack.

Not the right centerpiece:

- generic document RAG
- static doc Q&A as the main surface
- making retrieval look like “chat with the system”

## Recommended rollout

### Phase 1

Ship retrieval-backed evidence surfaces using data we already own:

- similar runs
- last healthy comparison
- recommendation evidence

### Phase 2

Add a true temporal context layer behind the scenes:

- event ingestion
- relationship indexing
- hybrid retrieval

### Phase 3

Use the map to improve recommendations:

- evidence-backed review pressure suggestions
- evidence-backed cheaper routing suggestions
- promotion and rollback with historical support

## Practical call

If we invest here, the right bet is:

**temporal operational memory for multi-agent workflows**

not:

**generic RAG over docs**

That keeps Agent Studio aligned with the real job:

helping users operate, debug, and improve evolving multi-agent systems.
