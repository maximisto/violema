# Agent Studio Standalone Repo Spec

## Goal

Define the separate public repository for `Purple Orange AI Agent Studio`.

This doc describes:

- repo structure
- technical boundaries
- initial file set
- adapter layout
- demo architecture
- installation story

## Repo identity

Recommended:

- org: `purpleorangeai`
- repo: `agent-studio`

Public product name:

- `Purple Orange AI Agent Studio`

Public category:

- open-source control room for multi-agent systems

## Recommended top-level structure

```text
agent-studio/
  apps/
    web/
    api/
  packages/
    contracts/
    sdk-js/
    sdk-python/
    adapters/
      langgraph/
      openhands/
      crewai/
      agent-framework/
    demo/
  docs/
  .github/
  LICENSE
  README.md
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md
  SECURITY.md
  TRADEMARKS.md
  pnpm-workspace.yaml
  package.json
```

## App responsibilities

### `apps/web`

Purpose:

- public app shell
- Live, Replay, Optimize UI
- onboarding
- demo mode

Should include:

- runtime selector
- workflow selector
- read-only public demo
- local dev auth story if needed later

### `apps/api`

Purpose:

- ingest runtime data
- expose Studio API
- run recommendation engine
- shape replay and comparison data

Should include:

- REST endpoints
- adapter registration
- event ingestion
- policy and experiment storage

## Package responsibilities

### `packages/contracts`

Purpose:

- single source of truth for runtime integration types

Should include:

- workflow types
- run types
- replay types
- policy snapshot types
- recommendation types
- experiment and rollback event types

### `packages/sdk-js`

Purpose:

- JS/TS instrumentation path

Should include:

- client for ingestion API
- event helpers
- example wrappers

### `packages/sdk-python`

Purpose:

- Python instrumentation path

Should include:

- ingest client
- typed event helpers
- adapter examples

### `packages/adapters/*`

Purpose:

- framework-specific conversion into the shared contract

Each adapter should:

- map native runtime data into Studio contract
- expose setup steps
- degrade gracefully when runtime data is partial

### `packages/demo`

Purpose:

- seeded demo dataset and helper utilities

Should include:

- one demo workflow
- several demo runs
- one healthy baseline
- one degraded run
- one candidate policy change

## Initial legal files

The standalone repo should include:

- `LICENSE`
- `TRADEMARKS.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

The code license should be MIT.

`TRADEMARKS.md` should make clear:

- code is MIT licensed
- product names, logos, and branding are not automatically granted for derivative commercial use

## Demo architecture

The demo should have two modes.

### Public read-only demo

Purpose:

- prove the product instantly

Should include:

- seeded workflows
- seeded runs
- Live, Replay, Optimize flow
- no destructive actions

### Local writable demo

Purpose:

- let developers test the product

Should include:

- local API
- local seeded database
- simulated run ingestion
- ability to try recommendations and rollbacks

## Installation story

Installation must be simple.

Recommended first-run paths:

### Path 1: local demo

- clone repo
- install dependencies
- run demo stack
- open app

### Path 2: connect an existing runtime

- choose adapter
- configure endpoint or token
- ingest workflows and runs
- open Studio

### Path 3: instrument a custom runtime

- install SDK
- emit contract events
- view them in Studio

## Adapter priority

First wave:

- LangGraph
- OpenHands
- CrewAI

Second wave:

- Microsoft Agent Framework
- Mastra

Why:

- first wave covers strong existing communities with clear runtime and workflow models
- second wave expands reach after the contract and SDK are proven

## Data storage recommendation

Recommended early stack:

- Postgres
- pgvector

Optional later layer:

- temporal graph memory

Reason:

- strong enough for run history, retrieval, and similarity
- easy to self-host
- familiar open-source stack

## Technical boundaries

The public repo should avoid:

- Violema-specific route state
- Violema-specific auth assumptions
- product assumptions tied to Purple Orange internal workflows

The public repo should preserve:

- room model
- replay logic
- release logic
- evidence-driven control loop

## MVP success bar

The standalone repo is ready when a user can:

1. install it locally
2. load the demo
3. connect one runtime or custom event feed
4. inspect a weak run
5. compare a candidate change
6. understand whether the change should ship

If that loop is not working, the repo is not ready.
