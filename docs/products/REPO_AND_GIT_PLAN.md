# Repo And Git Plan

## Target repos

Create two repos:

- `violema`
- `agent-studio`

Optional third repo later:

- `agent-studio-contracts` or `agent-runtime-contracts`

Do not create the third repo first.

## Recommended short-term structure

### Repo 1: `violema`

Contains:

- marketing site
- main app shell
- workflows
- runs
- integrations
- billing
- settings
- Violema-side integration adapter to Agent Studio

### Repo 2: `agent-studio`

Contains:

- Studio web app
- Studio API
- runtime integration adapters
- replay, experiments, promotion, rollback, governance

## Current extraction rule

Before creating the new repos, isolate these boundaries here first:

- frontend Studio feature folder
- backend Studio route/service folder
- shared Studio contract types
- Violema adapter

That work has already started.
Finish it before moving files.

## Practical repo split order

### Step 1: create the repos

Create empty GitHub repos:

- `maximisto/violema`
- `maximisto/agent-studio`

### Step 2: make this repo the Violema base

This repo should become the `violema` repo lineage.

Reason:

- it already contains the main product
- it already contains billing, workflows, integrations, and app shell

### Step 3: extract Agent Studio into a new repo

Start the new `agent-studio` repo by copying only:

- `frontend/src/features/agent-studio/*`
- `backend/src/agent-studio/*`
- contract files
- minimal app shell

Do not copy:

- Violema landing
- billing UI
- workflow builder UI
- unrelated dashboard code

## Git workflow

### Violema repo setup

```bash
git remote rename origin legacy-monorepo
git remote add origin git@github.com:maximisto/violema.git
git push -u origin main
```

If you want to preserve the old remote too, keep both remotes.

### Agent Studio repo bootstrap

Recommended:

1. create a fresh local directory
2. copy the extracted Studio boundary only
3. initialize a new git repo
4. push to `maximisto/agent-studio`

```bash
mkdir ../agent-studio
cd ../agent-studio
git init
git branch -M main
git remote add origin git@github.com:maximisto/agent-studio.git
```

Then copy the Studio app and commit the first standalone baseline.

## Branching rules

### Violema

Use branches for:

- workflow product changes
- dashboard simplification
- auth, billing, integrations
- Studio link-out integration

### Agent Studio

Use branches for:

- adapters
- replay
- policy tuning
- experiments
- promotion/rollback
- governance

## Shared code rule

Do not create hidden cross-repo coupling.

If something is shared, it must be one of:

- copied temporarily and intentionally
- published as a package later
- kept behind a network API contract

Prefer the API contract first.

## What not to do

- do not use `git filter-repo` unless preserving deep history is mission-critical
- do not try to preserve every commit as if this were a legal archive
- do not keep one repo pretending to be two products
- do not keep one shared frontend app with domain flags forever

## Recommended first milestone

Ship this order:

1. `violema.com` running from the Violema repo
2. `nexus.purpleorange.io` still served from the current codebase if needed
3. standalone `agent-studio` repo bootstrapped privately
4. Studio shell connected back to Violema through `/api/studio/*`
