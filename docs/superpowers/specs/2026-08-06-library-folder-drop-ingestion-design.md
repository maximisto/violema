# Library Folder-Drop Ingestion — Design

- **Date:** 2026-08-06
- **Status:** Approved by Max (design review, 2026-08-06)
- **Origin:** 2026-08-05 demo night — an operator's hand-dropped `.md` in the app-created Violema Library folder was invisible to missions (`drive.file`-class scope sees only app-created files). Max's thesis: operators won't type much at onboarding, but they will drop pdf/md/doc/url into a folder the platform sets up — that is the leverage.

## Problem

Missions read the account library (`backend/src/integrationGateway/accountLibrary.ts`) through the workspace's Composio `googledrive` connection. That grant only surfaces files the app itself created, so operator-dropped files — the highest-signal business context available — are unreachable. The business-context feature (2026-08-05 spec) covers the *typed* context; this feature covers the *file* context.

## Decisions (brainstorm outcomes)

| Question | Decision |
| --- | --- |
| Intake door (v1) | Folder-drop via a platform service-account reader shared on the app-created folder, plus in-app URL paste |
| Organization | One shared pool: anything anywhere in the Violema Library tree; missions filter at analysis time; operators never categorize |
| Sweep timing + visibility | At mission run, with evidence receipts naming (and linking) each swept file; in-process memo for unchanged files |
| Architecture | Approach A: virtual entries through the existing `readLibrary` path — no copies written, no new evidence channel |

## 1. Service-account lane

The one new auth surface.

- One GCP service account for the platform (created by Max; setup steps documented in the plan). Its JSON key reaches the backend via env — `GOOGLE_LIBRARY_READER_KEY` (inline JSON) or `GOOGLE_LIBRARY_READER_KEY_FILE` (path) — gitignored, never logged, path-only awareness in vault notes. The reader's email is derived from the key (`client_email`).
- New adapter `backend/src/integrationGateway/adapters/nativeDriveReader.ts`:
  - Zero-dependency auth: RS256 JWT signed with `node:crypto`, exchanged at `oauth2.googleapis.com/token` for a scoped access token (`https://www.googleapis.com/auth/drive.readonly`), cached until expiry. If real-world token edge cases bite during implementation, `google-auth-library` is the approved fallback dependency — nothing heavier.
  - Four Drive v3 REST operations, all via fetch: `files.list` (q on parents, pagination), `files.get` (metadata incl. `mimeType`, `modifiedTime`, `md5Checksum`, `webViewLink`), `files.get?alt=media` (binary download), `files.export` (Google Docs → `text/plain`).
  - Bounds owned by the adapter: max 3 list pages per sweep, per-file download cap 5 MB (checked against metadata `size` before download), request timeouts.
- Lane state is tri-valued and surfaced honestly: `not_configured` (no key on the server), `needs_share` (key present, folder not visible to the reader), `active` (reader lists the folder successfully).

## 2. Folder share + setup flow

- On Drive connect or from the settings card, the app shares its own `Violema Library` root folder with the reader as **viewer**. Primary path: a Composio `googledrive` permissions action (exact slug verified against the live tool registry at build time — the accountLibrary header documents the verified-actions pattern). Fallback if no such action exists: a guided one-time manual share — the card shows the reader email with a copy button and Drive instructions.
- Either way, a **Verify** button proves the share: the reader attempts to list the folder; success flips the card to `active`.
- Enabling shows consent copy — "Violema's reader will see everything inside your Violema Library folder — and only that folder." — and records an audit event `workspace.library_folder_share.enabled` (content-free: workspaceId, folderId only). Drive folder permissions inherit to files dropped later, which is exactly why this works where `drive.file` could not.
- Revocation is honest: the operator unshares in Drive; the next verify/sweep sees nothing; the card flips to `needs_share`; runs carry a warning. Nothing breaks, nothing blocks.

## 3. Operator-file discriminator

Operators can drop `.md` files, so naming conventions cannot distinguish operator files from app-created entries. The scope itself is the discriminator:

> The Composio lane can only see app-created files. Therefore: **(SA listing of the tree) minus (Composio `FIND_FILE` listing) = operator-dropped files, exactly.**

No naming rules, no persisted tracking state, no false positives — **provided the Composio listing is complete**: the `FIND_FILE` call used for the set difference must paginate to completeness (or hit a hard page cap and fail the sweep honestly). A truncated app-file listing would misclassify app entries as operator files and double-count them in evidence.

## 4. Sweep inside `readLibrary`

- When the lane is `active` for the workspace, every existing library **read** step also: lists the tree via the SA reader, computes the operator-file set (§3), parses new/changed files, and returns them as entries alongside app-created ones — same entry shape, same total byte budget.
- Entry shape gains `origin: 'operator_file' | 'app_entry'` and provenance fields (`sourceName`, `modifiedTime`, `webViewLink`).
- **Budget split:** operator files take priority — up to half the total byte budget is reserved for them when present (they are fresher operator ground truth); app entries fill the remainder; existing caps (entry count, per-entry bytes, total bytes) govern everything.
- **Parsing** (`backend/src/integrationGateway/sourceParsing.ts`): `.md`/`.txt` passthrough; Google Docs via `files.export text/plain` (no dependency); PDF via a vetted maintained parser dependency (candidate `pdf-parse`/`pdfjs-dist` — pick at plan time per the maintained-deps rule); DOCX via `mammoth` (`extractRawText`). Any other mime (images, sheets, slides) is skipped and named in a run warning — v1 does not pretend to read what it cannot.
- **Memo:** in-process LRU keyed `fileId + modifiedTime + md5Checksum` → extracted text; 50 entries max, 15-minute TTL, following the Composio-bridge short-lived-memo precedent. Nothing persists to disk; nothing is ever written to the customer's folder by the sweep.
- **Cap:** max 20 operator files per sweep, newest `modifiedTime` first; files dropped by the cap are named in a run warning (no silent truncation).
- **No seed changes, no migration, no new step flags.** `readLibrary` augments internally, so every mission with a library read step sweeps automatically once the lane is active. Sweep-unavailable degrades to today's behavior plus a run warning ("folder drop not active") through the existing run-warnings surface — never a readiness blocker, because absent extra sources are not fabricated data.

## 5. Evidence receipts

Operator-file entries flow into the run's evidence with their `sourceName` and `webViewLink`; the evidence-link work (`253f218`) renders real URLs as safe new-tab anchors, so the review's Evidence cards name each swept file and link to it in Drive. The demo-night complaint — "did it even read my file?" — is answered exactly where the operator reviews.

## 6. URL paste

- A small "Add a link to your library" input beside the Your business section on `SettingsPage` (`/settings#business` area).
- `POST /api/workspace/library/url` `{ url }` — authenticated + workspace-scoped like the business-context routes. SSRF-guarded fetch: `http(s)` only, DNS-resolved private/loopback/link-local address ranges refused, redirect depth capped, response size capped.
- Extraction v1: strip `script`/`style`, collapse tags to text, cap at the per-entry byte bound. No readability dependency until quality demands it.
- The snapshot is written as a dated `.md` entry (front matter: source URL, fetched-at) into a `Sources` section via the existing audited `appendLibraryEntry` path — the feature's only durable write. Re-paste refreshes (new dated entry).

## 7. Trust posture

- Swept content is **evidence-data, never instructions** — same framing the prompts already apply to web-search results; the review gate is the human backstop. File text must never reach ledger metadata (existing rule): sweep reporting carries names and counts only.
- The SA key is env-only, never logged, never echoed to any surface.
- Consent + revocation per §2; every share/enable is audited.
- Fails honest everywhere: unparseable file → named warning; over-cap files → named warning; lane down → warning + today's behavior.

## 8. Testing

- Unit: parser caps and mime routing; §3 set-difference discriminator (incl. operator-dropped `.md`); budget split; memo keying/TTL; JWT construction (static key fixture, no network).
- Integration: `readLibrary` with an injected fake SA reader + the existing fake Composio executor seam (the reader gets an equivalent injection seam); lane-state transitions (`not_configured` / `needs_share` / `active`).
- API: URL-paste endpoint — SSRF refusals (private IP, redirect trap), auth, caps, happy path writing through a fake executor.
- Frontend: contract test for the folder-drop card states + URL input wiring; full existing suites stay green (backend typecheck + tests + platform; frontend lint/build + contract chain).

## Out of scope

Notion/structured backends (documented non-goal in accountLibrary.ts), background/scheduled sweeps, a dedicated Library page, per-mission file pinning, sheets/slides/image parsing, OCR. The remaining demo-night follow-ups (review-card provenance, Slack delivery receipt, branded tenant posts, waiting_review hygiene) stay separate items.

## Risks

- **Composio permissions action may not exist** — mitigated by the guided manual-share fallback (§2), which is functionally identical because folder permissions inherit.
- **`readLibrary` grows** — it gains sweep orchestration; the SA reader and parser live in their own modules with injected seams to keep `accountLibrary.ts` from becoming a god file. If it tips past readability during implementation, extracting a `librarySweep.ts` orchestrator is the sanctioned split.
- **Parser dependencies** (pdf, docx) are the feature's only new packages; chosen at plan time under the maintained/production-proven rule, and every parse is size-capped before it starts.
- **Set-difference discriminator depends on both listings succeeding** — if the Composio listing fails mid-sweep, the sweep must fail the read step honestly (existing library failure semantics), never classify all files as operator files.
