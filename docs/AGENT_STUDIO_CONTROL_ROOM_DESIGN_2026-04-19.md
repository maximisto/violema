# Agent Studio Control Room Redesign

## Goal

Turn Agent Studio from a concept-heavy dashboard into a usable control room for managing multi-agent workflows in production.

The product should help users answer four questions fast:

1. What is happening right now?
2. Why did that run succeed or fail?
3. What should I change?
4. Should I release that change?

## Product Thesis

Agent Studio is a general-purpose control plane for multi-agent workflows.

It is not:

- a visual builder
- an eval lab first
- a policy DSL
- an architecture playground for its own sake

It is the operating surface for real workflows with real runs, real failures, and real release decisions.

## Core Product Objects

The first-class product objects are:

- Workflow
- Run
- Replay
- Release

Everything else is secondary.

The current concepts still exist, but they should move behind advanced surfaces:

- experiments
- plans
- branch families
- promotion history
- graduation
- rollback
- gates
- archetype learning

## Room Model

### Live

Purpose: operate the system in the moment.

Primary questions:

- Is this workflow healthy?
- Where is it stuck?
- Which worker needs attention?
- What is the next intervention?

Primary surfaces:

- workflow status summary
- full-width system map
- worker inspector
- activation trail
- next recommended action

Advanced surfaces:

- lane roster
- scenario telemetry
- phase steering matrix
- optimization loop diagnostics

### Replay

Purpose: understand exactly what happened in a run.

Primary questions:

- What changed the outcome?
- Which phase got slower, more expensive, or failed?
- What should we test next?

Primary surfaces:

- selected run timeline
- run comparison
- paired replay canvas
- phase overlay
- replay findings

Advanced surfaces:

- auto-promotion suggestions
- branch families
- promotion history
- graduation history
- rollback history
- replay governance

### Optimize

Purpose: prepare and release a better operating setup.

Primary questions:

- What are we optimizing for?
- What changes if we switch this setup?
- Is this candidate better enough to ship?

Primary surfaces:

- current release health
- scenario simulator
- preset sandbox
- release candidate diff

Advanced surfaces:

- custom policy controls
- saved plans
- plan families
- branch-vs-parent logic
- causal reports
- saved experiments and scorecards

## UX Principles

### 1. Progressive disclosure must be real

The page cannot expose all of its ontology at once.

Default view:

- one workflow
- one room
- one main decision path

Advanced concepts should require an explicit reveal.

### 2. Runs over abstractions

Users understand real runs faster than they understand systems theory.

The UI should bias toward:

- selected workflow
- selected run
- selected phase
- selected release candidate

Not toward:

- generalized governance objects
- taxonomies
- meta-analysis

### 3. Intervention should feel local

When the system suggests a change, that action should feel tied to:

- a worker
- a phase
- a run
- a release candidate

It should not feel like editing a distant abstract policy object.

### 4. Release decisions need a clear before/after

Users should be able to see:

- current operating setup
- candidate setup
- expected cost delta
- expected reliability delta
- whether to apply, canary, or hold

## Product Differentiation

The strongest wedge is the closed operator loop:

bad live run -> replay -> identify failing phase -> simulate or patch -> compare candidate -> release or roll back

Most current tools split this across observability, evals, and deployment surfaces.

Agent Studio should make it one loop.

## Implementation Direction

### Shell

Compress the top shell so users reach the active room faster.

Keep:

- selected workflow summary
- room switcher

Reduce:

- stacked explanatory chrome
- equal-weight setup cards

### Live

Make the system map the hero.

Under it, surface only:

- worker inspector
- activation trail
- next experiments / recommended action

Everything else moves into an explicit advanced section.

### Replay

Default to:

- selected run timeline
- comparison
- phase overlay
- findings

Governance and history move behind advanced replay controls.

### Optimize

Lead with:

- scenario
- preset comparison
- release diff

Move diagnostics and governance deeper unless they directly support the current release decision.

## Technical Direction

Current frontend structure is still mostly one page:

- `/Users/maximisto/Documents/New project/frontend/src/pages/AgentStudio.tsx`

Current room files are only wrappers:

- `/Users/maximisto/Documents/New project/frontend/src/features/agent-studio/rooms/LiveRoom.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/features/agent-studio/rooms/OptimizeRoom.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/features/agent-studio/rooms/ReplayRoom.tsx`

The redesign should begin by:

1. making room boundaries real
2. moving advanced sections behind explicit toggles
3. reducing equal-priority card sprawl
4. tightening the core operator path around Workflow / Run / Replay / Release

## Near-Term Success Criteria

The redesign is successful when:

- the first screen of each room has one obvious purpose
- a user can understand what to do next without reading every card
- advanced governance no longer competes with the main decision path
- the backend’s existing orchestration strength becomes visible instead of buried

## Non-Goals For This Pass

- full backend model redesign
- multi-repo split
- new runtime frameworks
- complete eval system buildout
- replacing all existing Agent Studio logic

This pass is about product shape and operator usability first.
