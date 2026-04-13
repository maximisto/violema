# Product Split Execution Plan

## Decision

Run two products:

- `Violema` on `violema.com`
- `Agent Studio` on `nexus.purpleorange.io`

Keep them technically connected.
Do not keep them product-blurred.

## End state

### Violema

- domain: `violema.com`
- purpose: recurring work execution
- user promise: set up workflows, run them, trust the output
- repo: `violema`

### Agent Studio

- domain: `nexus.purpleorange.io`
- purpose: agent architecture optimization
- user promise: compare, tune, promote, and roll back agent-team configurations
- repo: `agent-studio`

## Execution order

### Phase 1: finish the product boundary inside this repo

1. Keep extracting Agent Studio behind the integration contract.
2. Stop adding mixed Violema + Studio features.
3. Keep Violema outcome-first and Studio optimization-first.

### Phase 2: separate surface ownership

1. `violema.com` becomes the main app shell.
2. `nexus.purpleorange.io` becomes the Agent Studio shell.
3. Shared auth stays centralized at first.

### Phase 3: separate repos

1. Create `violema` repo.
2. Create `agent-studio` repo.
3. Move code only after the adapter boundary is stable.

### Phase 4: separate deployment pipelines

1. Violema deploys independently to `violema.com`.
2. Agent Studio deploys independently to `nexus.purpleorange.io`.
3. Shared backend services can remain centralized temporarily if the contract is clean.

## Non-negotiable rules

- Do not split repos before the integration boundary is real.
- Do not let Violema depend on Agent Studio to feel complete.
- Do not let Agent Studio depend on Violema-only UX assumptions.
- Do not reuse the same copy and nav on both domains.
- Do not move DNS before route ownership is clear.

## What success looks like

### Violema

A new user can:

1. sign in
2. connect tools
3. create one workflow
4. run it
5. trust the result

### Agent Studio

A power user can:

1. connect a runtime
2. inspect recent runs
3. compare policies or branches
4. promote or roll back safely
5. see evidence for why

## Working principle

This is not a brand exercise.
It is a product separation exercise.

If the user experience is still confusing after the split, the split failed.
