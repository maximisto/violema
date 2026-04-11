# Violema Handoff

## What Violema is today

The repo already contains a real product:

- marketing site
- authenticated dashboard
- chat and workflow surfaces
- recurring automations
- Stripe billing
- Slack setup and outbound support
- an embedded Agent Studio surface

The problem is not lack of substance.

The problem is product blur.

## What has to happen

Violema needs to become more opinionated and less broad.

The key move:

- make Violema the outcome-first product
- stop making it explain or expose every layer of agent architecture

## Keep

- workflow execution
- runs and outcomes
- integrations
- billing and capacity model
- simple operator-facing dashboard
- recurring automation value

## Hide, reduce, or move out

- deep branch experimentation
- promotion and rollback mechanics
- topology language
- architecture comparison surfaces
- most of the current Agent Studio depth

Those belong in Agent Studio.

## Current strengths

- there is already a believable AI work product here
- the backend is not fake
- billing and execution are real enough to matter
- the app can plausibly become a daily operator tool

## Current weaknesses

- the product story is too wide
- the dashboard is still cognitively heavy
- workflow trust still needs to be earned
- some large files make regressions more likely than they should be

## Near-term priority order

1. Simplify the front-door message.
2. Stabilize the workflow creation and editing path.
3. Make runs and results easier to understand quickly.
4. Hide advanced agent machinery by default.
5. Refactor the biggest UI surfaces before more feature expansion.

## Product changes to make now

### Landing and messaging

- Sell recurring work execution.
- Cut generic “AI coworker that does everything” language.
- Lead with one clear category of useful work.

### Dashboard

- Make the dashboard about:
  - what is running
  - what finished
  - what needs attention
  - what to automate next
- remove equal visual weight from too many secondary surfaces

### Workflow editor

- keep it fast
- keep it stable
- avoid hidden reopen logic
- make cancel, save, and run-now paths boring and dependable

### Agent Studio relationship

- present it as:
  - advanced controls
  - optional optimization
  - external or secondary
- do not make it feel required for product success

## Technical cleanup that matters

### Frontend

Highest-risk files:

- `/Users/maximisto/Documents/New project/frontend/src/pages/Dashboard.tsx`
- `/Users/maximisto/Documents/New project/frontend/src/pages/AgentStudio.tsx`

Split those by responsibility before another major feature wave.

### Backend

Highest-risk file:

- `/Users/maximisto/Documents/New project/backend/src/server.ts`

Break it into clearer bounded modules:

- auth
- settings
- automations
- billing
- integrations
- runtime control

## What winning looks like

A strong Violema user should be able to:

- sign up
- connect one or two tools
- create one workflow
- see it run successfully
- trust the output
- want to add another workflow

If that loop is weak, nothing else matters.

## Immediate next moves

1. Reposition the landing page.
2. Simplify the dashboard.
3. Keep Agent Studio in the background.
4. Raise reliability everywhere users edit or launch workflows.
5. Refactor large surfaces so product iteration stops breaking core flows.
