# Agent Studio Open Source Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the separate open-source Agent Studio repository, public legal/docs surface, seeded demo, and first runtime-agnostic contract layer.

**Architecture:** Start with a boring monorepo containing a web app, API, shared contracts, SDK skeletons, and a seeded demo. Keep Violema-specific assumptions out of the public repo and make the first release useful with demo mode plus one or two adapters instead of trying to support every framework immediately.

**Tech Stack:** TypeScript, React, Node, Postgres, pgvector, pnpm workspaces, Vercel for site/demo hosting, MIT license.

---

## File Structure

Planned public repo structure:

- `agent-studio/README.md`
- `agent-studio/LICENSE`
- `agent-studio/TRADEMARKS.md`
- `agent-studio/CONTRIBUTING.md`
- `agent-studio/CODE_OF_CONDUCT.md`
- `agent-studio/SECURITY.md`
- `agent-studio/package.json`
- `agent-studio/pnpm-workspace.yaml`
- `agent-studio/apps/web/*`
- `agent-studio/apps/api/*`
- `agent-studio/packages/contracts/*`
- `agent-studio/packages/sdk-js/*`
- `agent-studio/packages/sdk-python/*`
- `agent-studio/packages/adapters/langgraph/*`
- `agent-studio/packages/adapters/openhands/*`
- `agent-studio/packages/demo/*`
- `agent-studio/docs/*`

### Task 1: Create the public repo skeleton

**Files:**
- Create: `agent-studio/README.md`
- Create: `agent-studio/package.json`
- Create: `agent-studio/pnpm-workspace.yaml`
- Create: `agent-studio/apps/web/package.json`
- Create: `agent-studio/apps/api/package.json`
- Create: `agent-studio/packages/contracts/package.json`
- Create: `agent-studio/packages/sdk-js/package.json`
- Create: `agent-studio/packages/sdk-python/README.md`
- Create: `agent-studio/packages/demo/README.md`

- [ ] Create the repository and default branch.
- [ ] Scaffold the workspace directories exactly as listed above.
- [ ] Add root package metadata with workspace scripts for install, dev, build, lint, and test.
- [ ] Add minimal package manifests for `apps/web`, `apps/api`, and `packages/contracts`.
- [ ] Run install and verify the workspace resolves cleanly.
- [ ] Commit with a message like `chore: scaffold agent studio monorepo`.

### Task 2: Add legal and governance files

**Files:**
- Create: `agent-studio/LICENSE`
- Create: `agent-studio/TRADEMARKS.md`
- Create: `agent-studio/CONTRIBUTING.md`
- Create: `agent-studio/CODE_OF_CONDUCT.md`
- Create: `agent-studio/SECURITY.md`

- [ ] Add the MIT license text to `LICENSE`.
- [ ] Write `TRADEMARKS.md` clarifying that code is MIT while product names and logos are reserved.
- [ ] Add lightweight contribution instructions focused on local demo, contracts, and adapters.
- [ ] Add code of conduct and security policy.
- [ ] Review all files for clarity and simplicity.
- [ ] Commit with a message like `docs: add public repo legal and governance files`.

### Task 3: Move the shared runtime contract into the new repo

**Files:**
- Create: `agent-studio/packages/contracts/src/index.ts`
- Create: `agent-studio/packages/contracts/src/types.ts`
- Create: `agent-studio/packages/contracts/src/schemas.ts`
- Reference: `/Users/maximisto/Documents/New project/docs/products/agent-studio/INTEGRATION_CONTRACT.md`

- [ ] Port the current integration contract into code-first shared types.
- [ ] Keep the contract runtime-agnostic and avoid Violema-specific field names.
- [ ] Add schema validation for core payloads.
- [ ] Add example payload fixtures for workflows, runs, replay, and policies.
- [ ] Run the package build and verify exports resolve.
- [ ] Commit with a message like `feat: add shared runtime contract package`.

### Task 4: Build the seeded demo dataset

**Files:**
- Create: `agent-studio/packages/demo/src/workflows.ts`
- Create: `agent-studio/packages/demo/src/runs.ts`
- Create: `agent-studio/packages/demo/src/recommendations.ts`
- Create: `agent-studio/packages/demo/src/index.ts`

- [ ] Add one seeded workflow with realistic steps.
- [ ] Add at least three runs: healthy baseline, degraded run, candidate-improved run.
- [ ] Add recommendation evidence and historical similarity data for the seeded runs.
- [ ] Verify the demo can support `Live`, `Replay`, and `Optimize` views without placeholder data.
- [ ] Commit with a message like `feat: add seeded demo dataset`.

### Task 5: Stand up the web app shell

**Files:**
- Create: `agent-studio/apps/web/src/app/*`
- Create: `agent-studio/apps/web/src/features/live/*`
- Create: `agent-studio/apps/web/src/features/replay/*`
- Create: `agent-studio/apps/web/src/features/optimize/*`
- Create: `agent-studio/apps/web/src/features/onboarding/*`

- [ ] Port the minimal room shell pattern from the embedded Studio.
- [ ] Start with demo mode only.
- [ ] Add a runtime selector and workflow selector.
- [ ] Add a first-run onboarding panel explaining the control loop.
- [ ] Build and verify the web app renders the seeded demo data.
- [ ] Commit with a message like `feat: add web app shell and demo control loop`.

### Task 6: Stand up the API and ingestion path

**Files:**
- Create: `agent-studio/apps/api/src/server.ts`
- Create: `agent-studio/apps/api/src/routes/workflows.ts`
- Create: `agent-studio/apps/api/src/routes/runs.ts`
- Create: `agent-studio/apps/api/src/routes/replay.ts`
- Create: `agent-studio/apps/api/src/routes/ingest.ts`

- [ ] Add basic API routes for workflows, runs, replay, and demo data.
- [ ] Add ingest endpoints that accept shared contract payloads.
- [ ] Validate incoming data against the shared schemas.
- [ ] Keep storage simple at first.
- [ ] Verify the web app can read from the API instead of hardcoded demo data.
- [ ] Commit with a message like `feat: add api and ingestion surface`.

### Task 7: Add the JS SDK

**Files:**
- Create: `agent-studio/packages/sdk-js/src/index.ts`
- Create: `agent-studio/packages/sdk-js/src/client.ts`
- Create: `agent-studio/packages/sdk-js/src/events.ts`
- Create: `agent-studio/packages/sdk-js/examples/basic.ts`

- [ ] Add a minimal JS client for sending workflow, run, and replay events.
- [ ] Keep the API small and obvious.
- [ ] Add one basic instrumentation example.
- [ ] Verify the example payload matches the shared contract.
- [ ] Commit with a message like `feat: add js sdk`.

### Task 8: Add the first adapter(s)

**Files:**
- Create: `agent-studio/packages/adapters/langgraph/*`
- Create: `agent-studio/packages/adapters/openhands/*`

- [ ] Implement one adapter fully before starting the second.
- [ ] Map native runtime data into the shared contract.
- [ ] Document setup and limits for each adapter.
- [ ] Add one example per adapter.
- [ ] Verify at least one adapter works against the local demo/API stack.
- [ ] Commit with messages like:
- [ ] `feat: add langgraph adapter`
- [ ] `feat: add openhands adapter`

### Task 9: Add docs and public website content

**Files:**
- Create: `agent-studio/docs/quickstart.md`
- Create: `agent-studio/docs/install.md`
- Create: `agent-studio/docs/demo.md`
- Create: `agent-studio/docs/adapters/langgraph.md`
- Create: `agent-studio/docs/adapters/openhands.md`
- Modify: `agent-studio/README.md`

- [ ] Write a README that explains what Agent Studio is in one screen.
- [ ] Add quickstart, install, and demo docs.
- [ ] Add adapter setup guides.
- [ ] Make sure a new user can understand the product and run the demo without watching a video.
- [ ] Commit with a message like `docs: add public launch docs`.

### Task 10: Prepare the first public release

**Files:**
- Create: `.github/workflows/*`
- Create: release checklist doc if needed

- [ ] Add CI for install, build, and lint.
- [ ] Publish a first GitHub release tag.
- [ ] Deploy the docs/demo site on Vercel.
- [ ] Attach screenshots or short demo clips to the release.
- [ ] Verify the public installation path from a clean machine.
- [ ] Commit with a message like `chore: prepare first public release`.

## Self-Review

- Spec coverage:
  - separate repo shape: covered
  - MIT and trademark structure: covered
  - demo architecture: covered
  - adapter SDK path: covered
  - launch plan: covered
- Placeholder scan:
  - no `TBD` or `TODO` placeholders remain
- Type consistency:
  - all references consistently use workflows, runs, replay, policies, recommendations, and adapters
