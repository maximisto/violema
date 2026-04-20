# Agent Studio Open Source Plan

## Decision

Build `Purple Orange AI Agent Studio` as a separate open-source product.

Recommendation:

- open-source the core under MIT
- keep the product runtime-agnostic
- ship a hosted demo website and a local demo stack
- make `bring your own agents` a first-class path
- keep automatic improvement gated, evidence-based, and reversible

This should not be another visual builder.

It should be the open control room for inspecting, replaying, testing, and improving multi-agent systems.

## Product thesis

Agent Studio should win as:

- observability for multi-agent systems
- replay for multi-agent systems
- optimization and release control for multi-agent systems

It should not try to win as:

- a new default agent runtime
- a generic flowchart builder
- a chat-first assistant product

Core promise:

- connect your existing agent system
- ingest workflows, runs, and replay data
- surface what changed
- recommend a better setup
- let the user ship it manually or enable guarded automatic improvement

## What we should open-source

Open-source:

- the core web app
- the ingestion API
- the shared contract and SDK
- adapter packages
- the local demo
- the install docs
- the evaluation and recommendation loop

Do not mix in:

- Violema-specific private product concerns
- proprietary brand assets from the main app
- workspace-specific credentials or internal workflows
- non-portable deployment assumptions

## License recommendation

Recommended license:

- MIT for the codebase

Reason:

- fastest adoption
- easiest commercial use
- easiest community contribution path
- matches the distribution style of several strong agent-framework projects

Important product recommendation:

- keep the code MIT
- keep the `Purple Orange` and `Agent Studio` trademarks reserved

That means:

- `LICENSE` for code
- `NOTICE` if needed
- `TRADEMARKS.md` explaining that the code is MIT but the brand names and logos are not automatically granted for derivative products

## Best website and demo option

Recommendation:

- host the website and demo frontend on Vercel
- use a custom domain for the public site
- keep docs, demo, and GitHub repo clearly linked

Why Vercel:

- fastest public demo path
- easiest custom-domain setup
- good fit for a docs site plus React app
- easiest preview deployment loop for open-source contributors

GitHub Pages is acceptable for static docs only, but it is weaker for the interactive demo we actually need.

## Recommended public shape

### GitHub

Recommended repo shape:

- org: `purpleorangeai`
- repo: `agent-studio`

Recommended public repo contents:

- `apps/web`
- `apps/api`
- `packages/contracts`
- `packages/sdk`
- `packages/adapters/langgraph`
- `packages/adapters/openhands`
- `packages/adapters/crewai`
- `packages/adapters/agent-framework`
- `packages/demo`
- `docs`

### Website

Recommended website shape:

- landing page
- interactive read-only demo
- installation guide
- adapter docs
- quickstart
- screenshots and short videos
- open-source contribution docs

### Demo

The demo should be:

- real enough to prove the product
- safe enough to run publicly
- read-only by default

Recommended demo contents:

- one seeded workflow
- a few seeded runs
- one healthy baseline
- one weak run
- one candidate optimization
- visible `Live`, `Replay`, and `Optimize` flow

## Bring-your-own-agent strategy

This is the most important architectural decision.

Users should be able to connect their own systems in three ways.

### Level 1: Native adapters

Best first experience.

Target first:

- LangGraph
- OpenHands SDK / Agent Server
- CrewAI
- Microsoft Agent Framework

Why these first:

- they already expose real workflows, agents, or run structures
- they have active official docs and install paths
- they are good representatives of serious multi-agent usage

Important exclusion:

- do not make AutoGen a first-class new-user target
- it is now in maintenance mode and points new users to Microsoft Agent Framework instead

### Level 2: Generic runtime contract

For users with custom systems.

They should be able to POST or stream:

- workflow metadata
- run metadata
- phase and step execution data
- costs and durations
- policy snapshots
- recommendation outcomes

This makes Agent Studio useful even when the runtime is homegrown.

### Level 3: Local wrapper / SDK

For teams that want instrumentation with minimal friction.

Provide:

- JS/TS SDK
- Python SDK
- a simple event emitter contract
- example wrappers for common orchestrators

## Recommended adapter order

### First wave

- LangGraph
- OpenHands
- CrewAI

Why:

- LangGraph already has a local server story and a strong debugging model
- OpenHands already has an SDK and agent server story
- CrewAI has a large multi-agent audience and observability expectations

### Second wave

- Microsoft Agent Framework
- Mastra

Why second:

- worth supporting
- but the first wave gives us a cleaner cross-section of current open ecosystems faster

## Core open-source product loop

The open-source product should revolve around this loop:

1. Connect or instrument a runtime.
2. Ingest workflows and runs.
3. Inspect the current system in `Live`.
4. Replay a weak run in `Replay`.
5. Generate or author a candidate change in `Optimize`.
6. Ship manually or run guarded automation.
7. Validate the next run.

That loop is the product.

## Manual improvement vs automatic improvement

Agent Studio should support both, but in the right order.

### Manual mode

This should be the default.

User flow:

- Studio recommends a change
- user reviews evidence
- user applies candidate manually

This keeps the product trustworthy early.

### Assisted mode

Second layer:

- Studio prepares a candidate policy
- Studio can apply the candidate to a branch or preview environment
- user approves rollout

### Automatic improvement mode

This should exist, but be gated hard.

Recommended rules:

- opt-in only
- no silent mutation of production defaults on day one
- require minimum evidence thresholds
- apply via canary or branch first
- auto-rollback on regression
- always keep a human-readable audit trail

In plain terms:

- no magical self-improving agent mythology
- yes to measured, reversible, evidence-backed adaptation

## Recommended first automatic behaviors

Safe early candidates:

- raise review pressure on a weak phase
- lower spend on a repeatedly over-provisioned phase
- increase elastic lanes for a consistently saturated workflow
- route a single role differently under a specific scenario

Unsafe early candidates:

- rewriting the whole topology automatically
- mutating prompts and policies with no comparison window
- changing everything at once

## Website messaging

Recommended headline direction:

- `The control room for multi-agent systems`

Subhead:

- `Inspect runs, replay failures, compare operating setups, and improve your agent system over time.`

Key claims should be:

- runtime-agnostic
- evidence-backed
- replay-first
- open-source

Avoid claiming:

- universal self-improving AGI ops
- zero-setup for every framework
- autonomous improvement without human tradeoffs

## Recommended repo contents at launch

### Root

- `README.md`
- `LICENSE`
- `TRADEMARKS.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `.github/`

### Web app

- Live room
- Replay room
- Optimize room
- demo workspace
- onboarding

### API

- ingestion endpoints
- adapter auth
- run storage
- recommendation engine
- replay shaping

### Packages

- contract types
- SDK
- adapters

### Docs

- install
- quickstart
- adapter guides
- self-host guide
- demo guide
- architecture overview

## Installation story

The install story must be boring and fast.

Recommended paths:

### Quickstart

- `git clone`
- `pnpm install`
- `pnpm dev`
- `docker compose up` for local services if needed

### Demo mode

- one command to run the seeded local demo

### Adapter mode

- choose an adapter
- add credentials or runtime endpoint
- ingest sample runs

### Bring-your-own mode

- install SDK
- emit contract events
- see them in Studio

If the install story is messy, the open-source project will not spread.

## Best initial launch wedge

Recommendation:

- open-source control room for coding-agent and workflow-agent teams

Why:

- they already care about traces, replay, cost, and reliability
- they already run multi-step systems
- they already feel the pain of weak orchestration
- they are likely to share and contribute if the install path is good

## Suggested roadmap

### Phase 0: carve the product correctly

- remove Violema-specific assumptions from the public story
- formalize the runtime contract
- define what is core vs adapter-specific

### Phase 1: public repo bootstrap

- create separate repo
- add MIT license
- add trademark note
- add README and install docs
- publish seeded local demo

### Phase 2: first usable product

- ship Live, Replay, Optimize
- ship generic ingestion API
- ship one local demo workspace
- ship one or two real adapters

### Phase 3: recommendation credibility

- improve replay evidence
- improve historical similarity
- improve release recommendation quality

### Phase 4: guarded automation

- canary mode
- approval gates
- rollback automation
- audit history

## What not to do

- do not launch as another visual graph builder
- do not make it Violema-only
- do not depend on hidden internal metadata
- do not promise autonomous self-healing before the evidence engine is strong
- do not ship a demo that looks pretty but cannot teach the product

## Immediate next moves

1. Keep improving the embedded Agent Studio until the core loop is undeniable.
2. Finalize the public runtime contract.
3. Define the first two adapter targets.
4. Create the separate repo.
5. Publish the MIT license and contribution surface.
6. Launch a Vercel-hosted site with docs and a read-only demo.

## Concrete recommendation

If we do this, the strongest version is:

`Purple Orange AI Agent Studio`

- open-source core
- MIT licensed code
- runtime-agnostic adapters
- manual optimization first
- guarded auto-improvement second
- docs and demo live from day one

That is a real project with a chance to matter.
