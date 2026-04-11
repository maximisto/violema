# Agent Studio Setup

## One-line definition

Agent Studio is the control room for tuning agent architectures against cost, speed, reliability, and review pressure.

## Product job

Agent Studio should help teams improve existing agent systems, not replace them.

The core promise is:

- bring your current runtime
- measure what is happening
- compare architecture choices
- promote winners
- roll back losers

## Who it is for

Primary user:

- AI-native engineer
- platform or infra lead
- coding-agent power user
- agency team running repeated agent workflows

Best fit:

- teams already using agent systems
- users who care about performance tuning
- people willing to run experiments and compare outcomes

Worst fit:

- users who just want an assistant to do work
- beginners who do not yet have an agent workflow
- users looking for a chat-first product

## What it is not

Agent Studio is not:

- another generic workflow app
- another agent runtime
- another visual flow builder
- another chat product

It wins only if it becomes the optimization layer.

## Product thesis

The strongest wedge is runtime-agnostic agent optimization.

That means:

- Violema can be one integration
- Claude Code-style setups can be another
- OpenHands-style systems can be another
- custom MCP or multi-agent stacks can be another

The product should sit above the runtime and answer:

- what configuration performs better
- what should change next
- which branch should become the new default

## Core objects

- workspace
- runtime integration
- workflow
- phase
- role
- run
- architecture policy
- experiment branch
- promotion event
- rollback event

## MVP wedge

Start with coding-agent teams.

Why:

- they already care about reliability, latency, and cost
- they already have multi-step workflows
- they already compare models and policies
- they feel the pain of weak architecture decisions faster

## Core user loop

1. Connect an existing agent runtime.
2. Ingest runs, traces, and policies.
3. Detect weak spots and improvement candidates.
4. Run or simulate an experiment.
5. Compare against baseline.
6. Promote or roll back based on evidence.

## Product surfaces

Keep these first-class:

- live topology view
- experiment branch comparison
- run replay
- promotion and rollback history
- recommendation engine
- policy control and governance

## UX principles

- Evidence first.
- One clear recommendation at a time.
- Advanced depth, but orderly.
- Promotion and rollback should feel trustworthy.
- Visual richness should explain the system, not decorate it.

## Monetization

Likely pricing axes:

- connected runtimes
- retained run history
- experiment volume
- team seats
- governance and audit depth
- enterprise controls

## 30 / 60 / 90 day focus

### 30 days

- define integration contract
- choose one runtime wedge
- simplify the current Studio surface into a cleaner standalone story

### 60 days

- build runtime ingestion and baseline comparison
- make promotion and rollback logic dependable
- add one sharp recommendation loop

### 90 days

- expand to more runtimes
- deepen experiment management
- add stronger reporting and governance

## Success metrics

- connected workspaces
- runs ingested per workspace
- experiments created per active team
- promotion rate
- rollback detection quality
- improvement in cost, latency, or success after adopted changes

## Relationship to Violema

Violema should be:

- a first integration
- a strong showcase
- not the whole product

Agent Studio needs to stand on its own with a clean integration model.
