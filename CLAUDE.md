# CLAUDE.md — Violema

This repo is the **Violema** application: the outcome-first AI operator for recurring founder/team workflows. Live at https://violema.com.

It is **not** standalone. It is one node in Max's operating system, and the Second Brain vault is the truth layer above it.

---

## The vault is the source of truth

**Vault:** `/Users/maximisto/SecondBrain/MySecondBrain`

Before substantial work here, read:

1. `10 Projects/Violema/Violema - Dashboard.md` — current status, next moves, open risks, local/prod state
2. `10 Projects/Violema/Violema - Runbook.md` — operational procedures
3. `70 Agents/Agent Operating Protocol.md` — how agents are expected to behave
4. `70 Agents/Source Truth Hierarchy.md` — what wins when sources disagree

**Rule:** when this repo's docs and the vault disagree about company facts — the raise, the entity, pricing, positioning, investor state — **the vault wins.** Repo docs go stale; the vault is maintained. Code and deployment truth run the other way: the repo wins, and the vault should be corrected to match.

### Company facts live in the vault, not here

Do not hardcode or restate these anywhere in the repo. Read them:

- Raise, cap, runway → `60 Decisions/Decided/Decision - Violema raises $1.5M pre-seed on a SAFE.md`
- Entity (Violema, Inc., Delaware C-corp) → same note, Entity section
- Pricing ladder → `60 Decisions/Decided/Decision - Keep Violema pricing at $79 and $249.md`
- Positioning and retired claims → `10 Projects/Violema/Violema - Chicago Tech Week 2026 Launch Week.md`

Retired claims matter: several marketing lines were killed deliberately. **"Everyone automates, nobody makes it reviewable" is false and retired** — do not reintroduce it into copy, meta tags, or the deck. Check the retired-claims list before writing any marketing surface.

---

## Update Contract — write back to the vault

After meaningful work in this repo:

1. Write a run note to `70 Agents/Agent Runs/YYYY-MM-DD <Title>.md`
2. Update `10 Projects/Violema/Violema - Dashboard.md` if status, risks, next moves, or local state changed
3. Record durable choices in `60 Decisions/`
4. Refresh the vault:

```bash
"/Users/maximisto/SecondBrain/MySecondBrain/99 System/Scripts/refresh_second_brain.sh"
```

⚠️ **The vault's dashboards, Risk Register, Decision Log, and Agent Run Index are GENERATED** by `99 System/Scripts/build_second_brain.py` from a hardcoded manifest. Editing those files directly works until the next refresh, then silently reverts. To change them durably, edit the generator, then refresh.

---

## Commands

```bash
npm run install:all        # install root + backend + frontend
npm run dev                # backend + frontend together
npm run dev:backend
npm run dev:frontend
npm run build

# backend
cd backend && npm run typecheck && npm test && npm run test:platform

# frontend
cd frontend && npm run lint && npm run build
cd frontend && npm run test:brand-bleed && npm run test:integrations
```

Run `typecheck` and the backend tests before proposing any backend change as done.

---

## graphify

This repo has a graphify knowledge graph at `graphify-out/`.

- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- For cross-module "how does X relate to Y", prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost)

The vault has its own separate graph. They are not merged — query whichever layer the question lives in.

---

## Safety and boundaries

**Never deploy without an explicit, separate deploy request from Max.** Production is `https://violema.com`, deployed from `main`. A passing build is not permission.

**Secrets.** `OpenRouter.env.md`, `Slack.env.rtf`, and `violema_auth.env.rtf` sit at the repo root and are gitignored. Never read, echo, copy, or paste their contents into any file, note, commit, or vault entry. Path-only awareness, per the vault's safety rule.

**Runtime data files are not source.** `backend/*.json` ledgers, `auth-users.json`, and their `.bak` variants hold real user records and run history.

> **Fixed 2026-07-27.** `.gitignore` previously covered the base filenames but not their `.bak` variants or `backend/workflow-ledger-events.json`, so a `git add -A` would have published real user records (`auth-users.json.bak` holds id/email/name/role/workspaceIds) to GitHub. Those patterns are now ignored. Still prefer staging explicit paths over `git add -A` — the next runtime file to appear won't be covered until someone adds a pattern for it.

**Real workflows send real things.** Approve and rerun actions trigger live sends. Use `dryRun: true` first; require explicit approval before any live run.

**Never let required workflow sources fall back to fake data**, and keep raw email bodies, full document text, secrets, and large provider payloads out of ledger metadata.

**Git remotes:** local `origin` is correctly `maximisto/violema`. The **VPS** remote still points at the old test-repo URL and works only via GitHub's redirect — an open hygiene item. Per vault rule, do not silently alter remotes.

---

## Regression-sensitive surfaces

`backend/src/server.ts` and `frontend/src/pages/Dashboard.tsx` are large and carry regression risk. Read before editing; prefer narrow changes.

`backend/src/composioBridge.ts` is scaffolded but dormant — it activates on `COMPOSIO_API_KEY` and exposes a 250+ app catalog per entity via OAuth. Enabling it needs UI wiring and a deliberate auth-surface review. **Treat as its own project, not a config flip.**

---

## Historical

`CLAUDE_HANDOFF.md` (2026-06-14) is a narrow homepage-revision brief, not a general operating doc. Its still-valid rules — don't touch the main header logo, don't deploy without an explicit request, keep desktop and mobile quality distinct rather than flattening into a generic responsive compromise — are carried above. Treat the rest as history.
