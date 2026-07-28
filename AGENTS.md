# AGENTS.md — Violema

**Read `CLAUDE.md` in this directory first.** It is the full operating contract for this repo and applies to every agent, not just Claude. This file exists so Codex and other harnesses find it.

## The short version

- This repo is the **Violema** app (https://violema.com). It is one node in Max's operating system.
- The **Second Brain vault is the truth layer above it:** `/Users/maximisto/SecondBrain/MySecondBrain`
- Company facts — raise, entity, pricing, positioning — live in the vault. Read them there; never restate them in repo code or docs.
- Code and deploy truth lives here. When the vault is wrong about the repo, fix the vault.

## Before substantial work

1. `10 Projects/Violema/Violema - Dashboard.md` (in the vault)
2. `10 Projects/Violema/Violema - Runbook.md`
3. `70 Agents/Agent Operating Protocol.md`
4. `graphify-out/GRAPH_REPORT.md` (in this repo) for architecture questions

## After meaningful work

Write a run note to the vault's `70 Agents/Agent Runs/`, update the Violema dashboard if truth changed, then:

```bash
"/Users/maximisto/SecondBrain/MySecondBrain/99 System/Scripts/refresh_second_brain.sh"
```

The vault's dashboards, Risk Register, Decision Log, and Agent Run Index are **generated** from `99 System/Scripts/build_second_brain.py`. Direct edits to those files revert on the next refresh — edit the generator instead.

## Hard rules

- **Never deploy without an explicit, separate deploy request.** A green build is not permission.
- **Prefer staging explicit paths over `git add -A`.** Runtime `.bak` and ledger files hold real user records; the known ones are gitignored as of 2026-07-27, but new ones will not be until a pattern is added.
- **Never read, echo, or copy** `OpenRouter.env.md`, `Slack.env.rtf`, `violema_auth.env.rtf`. Path-only awareness.
- **Never silently alter git remotes.**
- Approve/rerun trigger real sends. Use `dryRun: true` first.
- Do not reintroduce the retired claim *"everyone automates, nobody makes it reviewable."* It is false and was killed deliberately.
