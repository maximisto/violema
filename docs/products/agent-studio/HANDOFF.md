# Agent Studio Handoff

## What Agent Studio is today

Agent Studio currently lives inside the Violema codebase as:

- `/Users/maximisto/Documents/New project/frontend/src/pages/AgentStudio.tsx`
- supporting backend logic in:
  - `/Users/maximisto/Documents/New project/backend/src/server.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/topology.ts`
  - `/Users/maximisto/Documents/New project/backend/src/platform/types.ts`
  - `/Users/maximisto/Documents/New project/backend/src/scheduler.ts`

It already contains real product energy:

- live topology
- replay
- experiment branches
- promotion and rollback logic
- saved plans
- branch families
- workspace policy controls

That is enough to justify a separate product.

## Current split assets

The first clean split assets now exist:

- product setup:
  - `/Users/maximisto/Documents/New project/docs/products/agent-studio/SETUP.md`
- integration contract:
  - `/Users/maximisto/Documents/New project/docs/products/agent-studio/INTEGRATION_CONTRACT.md`
- backend contract types:
  - `/Users/maximisto/Documents/New project/backend/src/agent-studio/contract.ts`
- first-party Violema adapter:
  - `/Users/maximisto/Documents/New project/backend/src/agent-studio/adapters/violema.ts`

## What has to happen

Agent Studio needs to stop behaving like “advanced settings for Violema.”

It should become:

- a standalone optimization product
- with Violema as the first integration
- and a runtime-agnostic data model

## Keep

- replay and paired comparison
- promotion and rollback logic
- phase and role analysis
- branch experiments
- policy and governance controls
- strong visual system map

## Drop or reduce

- Violema-specific copy inside the core product story
- product assumptions that the user came from Violema
- outcome-app concerns like onboarding, billing story, or workflow management UI

## Immediate extraction principles

### Product

- Rename the primary story around optimization, not execution.
- Default to one recommendation path, not a wall of control surfaces.
- Treat experiment, promotion, and rollback as the main loop.

### Technical

- separate reusable Studio types from Violema workflow types
- extract run and policy data contracts
- remove UI coupling to Violema-only route state
- define an integration adapter boundary early

## Integration contract to define

Every integration should ideally provide:

- workflow id and metadata
- run id and timestamps
- phase and role breakdown
- model lane and routing data
- tool calls
- cost and latency
- success outcome
- branch or policy identity when available

If an integration cannot provide all of that, Agent Studio should degrade gracefully.

## What to build first

1. Violema adapter.
2. One external coding-agent adapter.
3. Standalone landing and product shell.
4. Shared experiment and policy model.
5. Promotion and rollback engine that works without Violema UI assumptions.

## What to avoid

- do not ship it as another general visual builder
- do not build a new runtime before proving the optimization wedge
- do not keep every existing panel open by default
- do not make it feel like internal tooling dressed up as a SaaS

## Product quality bar

Users should be able to:

- connect an existing system
- see what is weak
- run one experiment
- understand whether it won
- adopt the winner safely

If that loop is not strong, the rest is noise.

## Immediate next moves

1. Clean the current Studio story around one wedge.
2. Define the standalone data model and adapter contract.
3. Simplify the first-run UX.
4. Keep the strongest current ideas:
   - branching
   - replay
   - promotion
   - rollback
5. Remove product assumptions that only make sense inside Violema.
