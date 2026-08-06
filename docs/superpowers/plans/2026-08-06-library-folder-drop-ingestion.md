# Library Folder-Drop Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operator-dropped files (pdf/md/doc/gdoc) in the Violema Library folder — plus pasted URLs — become sweepable evidence for every library-reading mission, via a platform service-account reader.

**Architecture:** A zero-dependency service-account Drive reader lists the library tree; operator files = SA listing minus Composio listing (the `drive.file` scope itself is the discriminator); a parser turns them into text; `readLibrary` returns them as virtual entries under the existing byte budgets. Nothing persists except URL-paste snapshots written through the existing audited library write. Sweep warnings ride the existing run-warnings surface via a small collector extension.

**Tech Stack:** TypeScript/Express, node:test + ts-node, node:crypto (RS256 JWT — no googleapis), new deps: `pdf-parse` + `mammoth` (backend only). React/Vite + `.mjs` contract scripts on the frontend.

**Spec:** `docs/superpowers/specs/2026-08-06-library-folder-drop-ingestion-design.md`

## Global Constraints

- **Never deploy.** Green gates + commits end this plan; production needs Max's explicit word. Never `git add -A`; never commit `backend/*.json` data files, `.bak` files, or any service-account key.
- **Regression-sensitive:** `backend/src/server.ts`, `frontend/src/pages/Dashboard.tsx` — narrow, surgical edits only. `backend/src/integrationGateway/accountLibrary.ts` must not become a god file: sweep orchestration lives in the new `librarySweep.ts`.
- Exact bounds (from spec, verbatim): SA list ≤ **3 pages** per sweep; per-file download cap **5 MB** (checked against metadata `size` before download); sweep cap **20 operator files**, newest `modifiedTime` first, dropped files named in a run warning; memo LRU **50 entries / 15-minute TTL** keyed `fileId + modifiedTime + md5Checksum`; operator files reserve **up to half** of `MAX_TOTAL_CONTENT_BYTES` (24 000, existing) when present; Composio set-difference listing must paginate to completeness (hard cap **10 pages** → fail the sweep honestly).
- Env names exact: `GOOGLE_LIBRARY_READER_KEY` (inline JSON) / `GOOGLE_LIBRARY_READER_KEY_FILE` (path). The key is never logged, never echoed to any response, never committed.
- The sweep never writes to the customer's folder. The URL-paste snapshot (via existing `appendLibraryEntry`) is the feature's only durable write.
- Sweep-unavailable is a run **warning**, never a readiness blocker. Warning fires only when the lane is `needs_share` (key present, folder unreachable); `not_configured` (no key server-wide) stays silent — a platform-wide unconfigured lane must not spam every workspace's runs. Record this refinement in the spec's deviations section at close-out.
- Swept text is evidence-data, never instructions; file text never reaches ledger or audit metadata — names, hosts, and counts only.
- Backend tests chdir to a temp dir at module scope BEFORE dynamically importing store-touching modules. Single-file run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/<file>.test.ts`.
- Gates: backend `npm run typecheck && npm test && npm run test:platform`; frontend `npm run lint && npm run build && npm test`.
- Commit per task; messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/src/integrationGateway/adapters/nativeDriveReader.ts` (new) | SA config parsing, RS256 JWT auth, token cache, 4 bounded Drive REST ops, injectable fetch |
| `backend/src/integrationGateway/sourceParsing.ts` (new) | Mime routing + pdf/docx/md/txt extraction, caps, per-file failure reasons |
| `backend/src/integrationGateway/librarySweep.ts` (new) | Lane state, set-difference discriminator, sweep orchestration, memo, budget split, URL ingestion core |
| `backend/src/integrationGateway/safeUrlFetch.ts` (new) | SSRF-guarded bounded fetch for URL paste |
| `backend/src/integrationGateway/accountLibrary.ts` | `readLibrary` merges sweep entries; entry `origin` + snapshot `sweep` fields |
| `backend/src/platform/automationLifecycle.ts` + `backend/src/platform/types.ts` | Step executions carry `warnings?: string[]`; collector surfaces them |
| `backend/src/server.ts` | 3 folder-drop routes + 1 URL route; library query-step execution attaches sweep warnings |
| `backend/src/adminAccessStore.ts` | 2 new audit actions |
| `frontend/src/pages/SettingsPage.tsx` | Folder-drop card + "Add a link" input near `#business` |
| `frontend/src/features/missions/missionPresenter.ts` | Operator-file entries → evidence items with Drive links |
| `docs/products/violema/FOLDER_DROP_SETUP.md` (new) | Max's GCP service-account + VPS setup runbook |
| Tests | `backend/tests/nativeDriveReader.test.ts`, `sourceParsing.test.ts`, `librarySweep.test.ts`, `librarySweepRead.test.ts`, `libraryUrlIngest.test.ts`, `folderDropApi.test.ts`, `backend/tests/fixtures/minimal.docx`, `frontend/tests/folderDrop.contract.mjs`, additions to `frontend/tests/evidenceLink.contract.mjs` |

---

### Task 1: Native Drive reader (service-account lane)

**Files:**
- Create: `backend/src/integrationGateway/adapters/nativeDriveReader.ts`
- Test: `backend/tests/nativeDriveReader.test.ts`

**Interfaces:**
- Consumes: nothing internal — `node:crypto`, `node:fs`, `process.env`, injected fetch.
- Produces (later tasks import these exact names):

```ts
export interface DriveReaderConfig { clientEmail: string; privateKey: string; }
export function readDriveReaderConfig(env?: NodeJS.ProcessEnv): DriveReaderConfig | null;
export interface DriveFileMeta {
  id: string; name: string; mimeType: string;
  modifiedTime?: string; md5Checksum?: string; size?: number; webViewLink?: string;
}
export interface DriveReader {
  listFolderTree(rootFolderId: string): Promise<DriveFileMeta[]>;   // ≤3 pages total, folders recursed breadth-first within the page budget
  downloadFile(fileId: string): Promise<Buffer>;                    // refuses > 5 MB via Content-Length and buffered running count
  exportDoc(fileId: string): Promise<string>;                       // files.export text/plain
}
export class DriveReaderError extends Error { code: 'auth_failed' | 'http_error' | 'too_large' | 'timeout'; status?: number; }
export const DRIVE_READER_MAX_LIST_PAGES = 3;
export const DRIVE_READER_MAX_DOWNLOAD_BYTES = 5_000_000;
export type DriveReaderFetch = typeof fetch;
export function createDriveReader(config: DriveReaderConfig, fetchImpl?: DriveReaderFetch): DriveReader;
```

- [ ] **Step 1: Write the failing test**

`backend/tests/nativeDriveReader.test.ts` — no chdir needed (no store I/O). Generate a throwaway RSA keypair with `crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })`. Build a fake fetch that: (a) on `oauth2.googleapis.com/token` verifies the form body has `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` and an `assertion` whose base64url header decodes to `{ alg: 'RS256', typ: 'JWT' }`, whose claims carry `iss` = the test client email, `scope` = `https://www.googleapis.com/auth/drive.readonly`, `aud` = the token URL, and whose signature verifies with `crypto.verify('RSA-SHA256', ...)` against the test public key; responds `{ access_token: 'tok', expires_in: 3600 }`; (b) serves `files.list` responses with `nextPageToken` chains so the page cap is observable; (c) serves `alt=media` bytes and export text. Tests:

```ts
test('readDriveReaderConfig: inline key wins over file path; file path read from disk; absent/malformed → null', ...);
test('token request is a valid RS256 JWT for drive.readonly and is cached across calls', ...);
// two listFolderTree calls → fake fetch saw exactly ONE token exchange
test('listFolderTree paginates and recurses but never fetches more than 3 pages', ...);
// fake serves a root with a subfolder and 4 pages available; assert ≤3 list requests, results reflect fetched pages only
test('downloadFile refuses oversized content with DriveReaderError too_large', ...);
// Content-Length 6_000_000 → rejects before buffering
test('exportDoc returns the exported plain text', ...);
test('errors never contain the private key', ...);
// force an http 500; assert error.message and stack exclude the PEM body
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && NODE_ENV=test VIOLEMA_DISABLE_AUTOMATION_SCHEDULER=1 node --test -r ts-node/register tests/nativeDriveReader.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

JWT: `base64url(header) + '.' + base64url(claims)` with claims `{ iss, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }`, signed via `crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey)`; normalize `\\n` escapes in keys arriving through env JSON. Token cached module-level per clientEmail until 60 s before expiry. `listFolderTree`: iterative BFS over folder ids; per call `files.list` with `q='<id>' in parents and trashed = false`, `fields=files(id,name,mimeType,modifiedTime,md5Checksum,size,webViewLink),nextPageToken`, `pageSize=100`; children with the folder mime enqueue; stop when total pages fetched reaches 3. All requests use `AbortSignal.timeout(10_000)`. Every failure becomes `DriveReaderError` with a message that never embeds the key material. `readDriveReaderConfig`: `GOOGLE_LIBRARY_READER_KEY` (JSON.parse → `{ client_email, private_key }`) takes precedence; else `GOOGLE_LIBRARY_READER_KEY_FILE` read via `fs.readFileSync`; any parse failure returns null (the lane is simply not configured — never a boot crash).

- [ ] **Step 4: Run tests + typecheck**

Run: the test file, then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrationGateway/adapters/nativeDriveReader.ts backend/tests/nativeDriveReader.test.ts
git commit -m "feat: native service-account Drive reader with zero-dep RS256 auth

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Source parsing

**Files:**
- Create: `backend/src/integrationGateway/sourceParsing.ts`
- Create: `backend/tests/fixtures/minimal.docx` (generated once in Step 1, committed)
- Modify: `backend/package.json` — add `pdf-parse` and `mammoth` (check current versions with `npm view pdf-parse version` / `npm view mammoth version`, pin caret ranges; both are the maintained, production-proven choices for text extraction)
- Test: `backend/tests/sourceParsing.test.ts`

**Interfaces:**
- Produces:

```ts
export const PARSEABLE_SOURCE_MIME_TYPES: Record<string, 'text' | 'pdf' | 'docx'> = {
  'text/markdown': 'text',
  'text/plain': 'text',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};
// Google Docs never reach the parser — the sweep exports them to text upstream.
export function isParseableSourceMime(mimeType: string): boolean;
export type ParseSourceResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; reason: 'unsupported_type' | 'parse_failed' };
export async function parseSourceBuffer(
  input: { fileName: string; mimeType: string; buffer: Buffer },
  maxBytes: number,
): Promise<ParseSourceResult>;
```

- [ ] **Step 1: Create the docx fixture** (deterministic, committed once):

```bash
cd "/Users/maximisto/Documents/New project/backend/tests" && mkdir -p fixtures && python3 - <<'EOF'
import zipfile
with zipfile.ZipFile('fixtures/minimal.docx', 'w') as z:
    z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Beandjinn roadmap docx fixture</w:t></w:r></w:p></w:body></w:document>')
EOF
```

- [ ] **Step 2: Write the failing test**

The PDF fixture is an inline minimal one-page PDF `Buffer` in the test file (catalog → pages → page → contents stream `BT /F1 12 Tf 72 712 Td (Beandjinn pdf fixture) Tj ET` with a Helvetica font resource and a correct xref table — the classic ~600-byte hand-written PDF; write it as a template literal). Tests:

```ts
test('markdown and plain text pass through, byte-capped with a truncated flag', ...);
test('pdf text extraction finds the fixture sentence', ...);          // contains 'Beandjinn pdf fixture'
test('docx extraction via the committed fixture', ...);               // contains 'Beandjinn roadmap docx fixture'
test('unknown mime → unsupported_type', ...);                         // image/png
test('corrupt pdf bytes → parse_failed, never a throw', ...);
test('every ok result respects maxBytes', ...);
```

- [ ] **Step 3: Run to verify failure**, then install deps: `cd backend && npm install pdf-parse mammoth` (lockfile changes are expected and committed).
- [ ] **Step 4: Implement** — route on `PARSEABLE_SOURCE_MIME_TYPES`; `pdf-parse(buffer)` → `.text`; `mammoth.extractRawText({ buffer })` → `.value`; text passthrough decodes utf8; cap with the same byte-slice approach `accountLibrary` uses for its ceilings (`Buffer.byteLength` check + slice, `truncated` flag). Wrap each parser in try/catch → `parse_failed`.
- [ ] **Step 5: Run the test file, then the FULL backend suite + typecheck** (new deps must not break anything). Expected: green.
- [ ] **Step 6: Commit**

```bash
git add backend/src/integrationGateway/sourceParsing.ts backend/tests/sourceParsing.test.ts backend/tests/fixtures/minimal.docx backend/package.json backend/package-lock.json
git commit -m "feat: bounded source parsing for pdf/docx/text library files

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Sweep orchestrator — discriminator, memo, bounds

**Files:**
- Create: `backend/src/integrationGateway/librarySweep.ts`
- Test: `backend/tests/librarySweep.test.ts`

**Interfaces:**
- Consumes: Task 1 (`createDriveReader`, `readDriveReaderConfig`, `DriveReader`, `DriveFileMeta`, `DriveReaderError`), Task 2 (`parseSourceBuffer`, `isParseableSourceMime`), `PartnerComposioExecutor` + `executeComposioAction` (existing), `GOOGLEDRIVE_FIND_FILE` action.
- Produces:

```ts
export type FolderDropLaneState = 'not_configured' | 'needs_share' | 'active';
export interface LibrarySweepDeps {
  reader?: DriveReader | null;          // test seam; default: built from readDriveReaderConfig(), null when unconfigured
  execute?: PartnerComposioExecutor;    // default executeComposioAction
  now?: () => Date;
}
export interface OperatorSourceEntry {
  fileId: string; fileName: string; mimeType: string;
  modifiedTime?: string; webViewLink?: string;
  content: string | null; truncated: boolean; contentError?: string;
}
export interface LibrarySweepResult {
  laneState: FolderDropLaneState;
  entries: OperatorSourceEntry[];
  warnings: string[];                   // named skips: unsupported type, too large, over-cap drops
}
export class LibrarySweepError extends Error { code: 'listing_failed'; }
export function getFolderDropReaderEmail(): string | null;
export async function getFolderDropLaneState(rootFolderId: string | null, deps?: LibrarySweepDeps): Promise<FolderDropLaneState>;
export async function sweepOperatorFiles(
  input: { workspaceId: string; rootFolderId: string; budgetBytes: number },
  deps?: LibrarySweepDeps,
): Promise<LibrarySweepResult>;   // throws LibrarySweepError when the Composio listing cannot complete
export function setLibrarySweepOverridesForTests(overrides: { laneState?: FolderDropLaneState; sweep?: LibrarySweepResult } | null): void;
export function clearSweepMemoForTests(): void;
export const MAX_OPERATOR_FILES_PER_SWEEP = 20;
export const SWEEP_COMPOSIO_MAX_PAGES = 10;
export const SWEEP_MEMO_MAX_ENTRIES = 50;
export const SWEEP_MEMO_TTL_MS = 15 * 60 * 1000;
```

- [ ] **Step 1: Write the failing test** — fakes only, no chdir. A fake `DriveReader` whose `listFolderTree` returns a fixed tree (operator pdf w/ metadata size 1200, operator `.md`, one `.md` that ALSO appears in the fake Composio listing, an `image/png`, a pdf with `size: 6_000_000`, a Google Doc mime entry) and whose `downloadFile` increments a call counter; a fake executor answering `GOOGLEDRIVE_FIND_FILE` with two pages chained by `nextPageToken`. Tests:

```ts
test('set difference: Composio-visible files are never operator files, even .md', ...);
test('Composio listing paginates to completeness; failure mid-listing throws LibrarySweepError', ...);
// executor rejects on page 2 → assert.rejects with code 'listing_failed'; nothing classified
test('unsupported and oversized files are skipped with warnings naming the file', ...);
test('newest-first cap at 20 with a warning naming the drop count', ...);   // fake tree with 22 operator files
test('google docs go through exportDoc, never downloadFile', ...);
test('memo: unchanged fileId+modifiedTime+md5 parses once across two sweeps', ...);  // downloadFile counter stays flat on sweep #2; clearSweepMemoForTests() in a before hook
test('entries stop accumulating at budgetBytes', ...);
test('lane state: null reader → not_configured; reader http_error on root list → needs_share; list ok → active', ...);
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** — Composio listing loops `GOOGLEDRIVE_FIND_FILE` (`q` on the root + each section folder is unnecessary — list by `'<rootFolderId>' in parents` is NOT sufficient for nested sections, so reuse the SA tree's folder ids: for each folder id in the SA tree, list Composio-visible children, accumulating pages across calls with the 10-page total cap). Operator set = SA file ids minus Composio-visible ids (folders excluded from entries). Sort newest `modifiedTime` first; cap 20 with warning `"Folder drop: N more file(s) were not read this run (20-file cap): name1, name2, …"`. Per file: Google Doc mime → `exportDoc`; unparseable mime → warning `"Folder drop: '<name>' skipped (unsupported type <mime>)"`; `size > DRIVE_READER_MAX_DOWNLOAD_BYTES` → warning naming the cap; else `downloadFile` → `parseSourceBuffer(..., remainingBudget)`; parse failure → entry with `content: null, contentError: 'content unreadable'` (visible gap, same semantics as `AccountLibraryEntry`). Memo: module-level `Map<string, { text: string; truncated: boolean; at: number }>` with TTL check + LRU eviction at 50. `setLibrarySweepOverridesForTests` short-circuits `getFolderDropLaneState`/`sweepOperatorFiles` when set (guard with `NODE_ENV === 'test'`).
- [ ] **Step 4: Run tests + typecheck** — PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/src/integrationGateway/librarySweep.ts backend/tests/librarySweep.test.ts
git commit -m "feat: library sweep — scope-based discriminator, bounded parsing, in-process memo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `readLibrary` augmentation + run-warning pipeline

**Files:**
- Modify: `backend/src/integrationGateway/accountLibrary.ts` (`AccountLibraryEntry` :157, `AccountLibrarySnapshot` :171, `readLibrary` :716-809 — the hook is ~25 lines; orchestration stays in librarySweep)
- Modify: `backend/src/platform/types.ts` — `AutomationStepExecution` gains `warnings?: string[]` (locate the interface, add the optional field)
- Modify: `backend/src/platform/automationLifecycle.ts` — `collectAutomationRunWarnings` (:~573 area) + its `ClassifiableStep` input type
- Modify: `backend/src/server.ts` — in the step-execution loop (after the search branch at :4337), the branch handling `account_library` query results: after a successful read, set `stepExecution.warnings = snapshot.data.sweep?.warnings` when non-empty
- Test: `backend/tests/librarySweepRead.test.ts`

**Interfaces:**
- `AccountLibraryEntry` gains `origin?: 'operator_file' | 'app_entry'` (absent = legacy; every existing consumer unchanged).
- `AccountLibrarySnapshot` gains `sweep?: { laneState: FolderDropLaneState; warnings: string[] }`.
- `readLibrary`: after resolving the root folder — when `getFolderDropLaneState(root.folderId)` is `'active'`, call `sweepOperatorFiles({ workspaceId, rootFolderId: root.folderId, budgetBytes: Math.floor(MAX_TOTAL_CONTENT_BYTES / 2) })`; map `OperatorSourceEntry` → `AccountLibraryEntry` with `origin: 'operator_file'`; these entries go FIRST; app entries fill the remaining total budget as today, tagged `origin: 'app_entry'`. `laneState === 'needs_share'` appends warning `"Folder drop is enabled but Violema's reader can no longer see your Violema Library folder — re-share it to include your dropped files."`; `not_configured` adds no sweep warnings. `LibrarySweepError` maps to the existing `libraryFailure('integration_query_failed', 'Folder-drop listing could not complete.')` — never misclassification, never a silent skip.
- `collectAutomationRunWarnings` additionally emits `{ stepId, title, message }` for each string in `step.warnings ?? []` (dedupe identical messages per step); existing failed-auxiliary behavior byte-identical.

- [ ] **Step 1: Write the failing test** — `librarySweepRead.test.ts` with the temp-cwd scaffold + dynamic imports. Use `setLibrarySweepOverridesForTests` to steer lane state and sweep results; drive `readLibrary('ws_test', 'Competitive Intelligence', {}, { execute: fakeExecutor, fetchText: fakeFetchText })` where the fake executor serves the root/section folder lookups and one app entry file. Tests: operator entries precede app entries and both carry `origin`; total content ≤ `MAX_TOTAL_CONTENT_BYTES`; `needs_share` produces the exact warning string in `snapshot.data.sweep.warnings` with zero operator entries; `not_configured` produces no `sweep.warnings`; `LibrarySweepError` (override throws) → result is a library failure with code `integration_query_failed`. Collector test (same file, pure): a step with `warnings: ['a', 'a', 'b']` → exactly 2 run warnings; a failed auxiliary step still produces its warning.
- [ ] **Step 2: Run to verify failure**, **Step 3: Implement.**
- [ ] **Step 4: FULL backend suite** — `npm run typecheck && npm test && npm run test:platform`. Regression-sensitive files touched; everything stays green.
- [ ] **Step 5: Commit**

```bash
git add backend/src/integrationGateway/accountLibrary.ts backend/src/integrationGateway/librarySweep.ts backend/src/platform/types.ts backend/src/platform/automationLifecycle.ts backend/src/server.ts backend/tests/librarySweepRead.test.ts
git commit -m "feat: library reads sweep operator files; sweep warnings ride run warnings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Folder-drop lane routes + share + audit

**Files:**
- Modify: `backend/src/server.ts` — three routes directly after `PUT /api/workspace/business-context`
- Modify: `backend/src/adminAccessStore.ts` — `AdminAuditAction` union + `AUDIT_ACTIONS` set: add `'workspace.library_folder_share.enabled'`
- Modify: `backend/src/integrationGateway/librarySweep.ts` — `shareLibraryFolderWithReader`
- Modify: `backend/src/integrationGateway/accountLibrary.ts` — export `findLibraryRootFolderId(workspaceId, deps?)` (thin wrapper over the existing internal `findFolderByName(execute, workspaceId, LIBRARY_ROOT_FOLDER_NAME)`) if no equivalent export exists
- Test: `backend/tests/folderDropApi.test.ts`

**Interfaces:**
- `GET /api/workspace/library/folder-drop` (401-first like business-context) → `{ laneState: FolderDropLaneState, readerEmail: string | null, rootFolderId: string | null }`.
- `POST /api/workspace/library/folder-drop/verify` (401-first) → same shape; on the FIRST transition to `active`, records `recordAdminAuditEvent({ actorEmail: authUser.email, action: 'workspace.library_folder_share.enabled', workspaceId, metadata: { folderId: rootFolderId } })`. First-transition detection: a `folderDropEnabledAt` ISO stamp in the workspace profile's existing `metadata` bag via `upsertWorkspaceProfile(workspaceId, { metadata: { ...current, folderDropEnabledAt } })`.
- `POST /api/workspace/library/folder-drop/share` (401-first) → calls `shareLibraryFolderWithReader`, then behaves as verify; when sharing is manual-only, responds `{ manualShare: true, readerEmail }` plus the verify-shape fields.

- [ ] **Step 1: Build-time registry verification (both outcomes fully specified — no TBD):** write a scratchpad script (NOT committed) that lists toolkit `googledrive` tools through `composioBridge`'s existing client access, filtered on `/PERMISSION|SHARE|ACCESS/i`, and run it only if `COMPOSIO_API_KEY` is already present in the loaded dev environment — never read or echo the secrets files themselves. Record the exact action list in your task report. **Branch A (an add-permission action exists, e.g. `GOOGLEDRIVE_ADD_FILE_SHARING`):** implement `shareLibraryFolderWithReader(workspaceId, folderId, readerEmail, deps)` to invoke it with role `reader` + the reader email, returning `{ ok: true }` or a classified failure. **Branch B (none exists):** implement it as `async () => ({ ok: false as const, reason: 'manual_share_required' as const })` with a comment naming the registry check date; the share route then always returns `{ manualShare: true, readerEmail }`.
- [ ] **Step 2: Write the failing test** — HTTP scaffold copied from `tests/serverReviewRerunNote.test.ts` conventions (temp dir, env save/restore, consent + auth user + session, `serverModule.default.listen(0)`, `closeServer`, `authHeaders`), prefix `violema-folder-drop-api-`. Cases: anonymous GET → 401; with no reader key in env: GET → `{ laneState: 'not_configured', readerEmail: null }`, POST verify → still `not_configured`, no audit event; with `setLibrarySweepOverridesForTests({ laneState: 'active' })` and a synthetic `GOOGLE_LIBRARY_READER_KEY` (built from a test keypair JSON `{ client_email: 'reader@test.iam', private_key: <pem> }`): POST verify twice → `laneState: 'active'`, and exactly ONE `workspace.library_folder_share.enabled` audit event across both calls (read via `listAdminAuditEvents()` as in `businessContextApi.test.ts`).
- [ ] **Step 3: Run to verify failure**, **Step 4: Implement** (routes mirror the business-context handlers' 401-first shape exactly; `readerEmail` from `getFolderDropReaderEmail()`), **Step 5: Full backend suite green**, **Step 6: Commit**

```bash
git add backend/src/server.ts backend/src/adminAccessStore.ts backend/src/integrationGateway/librarySweep.ts backend/src/integrationGateway/accountLibrary.ts backend/tests/folderDropApi.test.ts
git commit -m "feat: folder-drop lane API — status, verify, share, audited enablement

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: SSRF-guarded URL ingestion

**Files:**
- Create: `backend/src/integrationGateway/safeUrlFetch.ts`
- Modify: `backend/src/integrationGateway/librarySweep.ts` — add `ingestUrlIntoLibrary`
- Modify: `backend/src/server.ts` — `POST /api/workspace/library/url` after the folder-drop routes
- Modify: `backend/src/adminAccessStore.ts` — add `'workspace.library_url.added'` to union + set
- Test: `backend/tests/libraryUrlIngest.test.ts`

**Interfaces:**

```ts
// safeUrlFetch.ts
export type SafeUrlFetchResult =
  | { ok: true; finalUrl: string; contentType: string; body: string }
  | { ok: false; reason: 'invalid_url' | 'blocked_address' | 'too_many_redirects' | 'too_large' | 'fetch_failed' };
export async function safeUrlFetch(
  rawUrl: string,
  options?: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; lookup?: (host: string) => Promise<Array<{ address: string; family: number }>> },
): Promise<SafeUrlFetchResult>;
// librarySweep.ts
export async function ingestUrlIntoLibrary(
  input: { workspaceId: string; url: string },
  deps?: LibrarySweepDeps & { fetchUrl?: typeof safeUrlFetch },
): Promise<{ ok: true; fileName: string; sourceUrl: string } | { ok: false; code: 'invalid_url' | 'fetch_blocked' | 'fetch_failed' | 'write_failed'; message: string }>;
```

- [ ] **Step 1: Write the failing test** — `safeUrlFetch` cases with an injected fake `lookup` and a local `http.createServer` target: `ftp://` and `javascript:` → `invalid_url`; hosts resolving to `127.0.0.1`, `10.1.2.3`, `172.16.0.1`, `192.168.1.1`, `169.254.169.254`, `::1`, `fd00::1` → `blocked_address` (one assertion each); a public-resolving hop that 302s to `http://127.0.0.1/` → `blocked_address`; four chained redirects → `too_many_redirects`; a response streaming past `maxBytes` → `too_large`. `ingestUrlIntoLibrary` happy path: local server serving `<html><head><title>Beandjinn pricing</title></head><body><script>evil()</script><p>Espresso subscriptions from $49.</p></body></html>` with lookup faked public → fake executor receives a `GOOGLEDRIVE_CREATE_FILE_FROM_TEXT` write to section `Sources` whose file name is dated and contains `Beandjinn pricing`, whose text contains `source_url:` front matter and `Espresso subscriptions` and NOT `evil()`.
- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** — `safeUrlFetch`: URL parse (http/https only) → `lookup(host)` (default `dns.promises.lookup(host, { all: true })`) → refuse when ANY address matches loopback (`127.0.0.0/8`, `::1`), private (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, `fe80::/10`), or ULA (`fc00::/7`); fetch with `redirect: 'manual'` + `AbortSignal.timeout`; each 3xx hop re-runs the full validation; read the body with a running byte count against `maxBytes` (default 500 000). `ingestUrlIntoLibrary`: fetch → strip `<script>`/`<style>` blocks (regex over the two tag pairs), strip remaining tags, decode the five basic entities + `&nbsp;`, collapse whitespace; entry name `<title>` text (fallback: the URL host); markdown body = front matter (`source_url`, `fetched_at`) + extracted text capped at `MAX_ENTRY_CONTENT_BYTES`; write via `appendLibraryEntry(workspaceId, 'Sources', …)` — conform to its exact existing signature at `accountLibrary.ts:862`. Route: 401-first, body `{ url }` required, maps `ingestUrlIntoLibrary` results to 200/400/502, and on success records `recordAdminAuditEvent({ actorEmail, action: 'workspace.library_url.added', workspaceId, metadata: { host: new URL(url).host } })` — host only, never the full URL, never content.
- [ ] **Step 4: Full backend suite green**, **Step 5: Commit**

```bash
git add backend/src/integrationGateway/safeUrlFetch.ts backend/src/integrationGateway/librarySweep.ts backend/src/server.ts backend/src/adminAccessStore.ts backend/tests/libraryUrlIngest.test.ts
git commit -m "feat: SSRF-guarded URL paste snapshots links into the library Sources section

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Evidence receipts in the presenter

**Files:**
- Modify: `frontend/src/features/missions/missionPresenter.ts` (+ the feature's `types.ts` if the evidence item type needs a label change)
- Test: extend `frontend/tests/evidenceLink.contract.mjs`

**Interfaces:**
- Consumes: run artifacts whose payload is an `AccountLibrarySnapshot` (`entries[]` carrying `fileName`, `webViewLink`, `origin`).
- Produces: for each entry with `origin === 'operator_file'`, an evidence item whose label contains the file name plus `(your Violema Library)` and whose `href` is the entry's `webViewLink` (a real URL — `evidenceHref` passes it through).

- [ ] **Step 1: Read `missionPresenter.ts`'s existing artifact→evidence mapping** and find where library/query artifacts become evidence items today. Extend that mapping in place — do not fork a parallel path.
- [ ] **Step 2: Write the failing contract additions** in `evidenceLink.contract.mjs`: import the presenter's mapping function directly (as the file already imports `evidenceHref`); feed it a fixture artifact containing an `operator_file` entry (`fileName: 'beandjinn-competitors.pdf'`, `webViewLink: 'https://drive.google.com/file/d/abc/view'`) and an `app_entry`; assert the operator item's label contains `beandjinn-competitors.pdf` and `your Violema Library`, its `href` equals the webViewLink, and the app entry lacks the library suffix. Add source-wiring asserts: presenter source contains `operator_file` and `your Violema Library`.
- [ ] **Step 3: Run to verify failure** (`cd frontend && npm run test:evidence-link`), **Step 4: Implement**, **Step 5: Gates** (`npm run test:evidence-link && npm run lint && npm run build`), **Step 6: Commit**

```bash
git add frontend/src/features/missions/missionPresenter.ts frontend/src/features/missions/types.ts frontend/tests/evidenceLink.contract.mjs
git commit -m "feat: swept operator files appear as linked evidence receipts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Settings folder-drop card + URL input

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx` (directly below the `#business` section)
- Create: `frontend/tests/folderDrop.contract.mjs`
- Modify: `frontend/package.json` — `"test:folder-drop": "node tests/folderDrop.contract.mjs"` + append `&& npm run test:folder-drop` to the `test` chain

**Interfaces:**
- Consumes: Task 5 routes (incl. `{ manualShare: true, readerEmail }`) and Task 6's `POST /api/workspace/library/url`.

- [ ] **Step 1: Write the failing contract test** (source-assert style mirroring `businessContextSettings.contract.mjs`): SettingsPage source includes `id="folder-drop"`, `/api/workspace/library/folder-drop`, `/api/workspace/library/url`, all three lane-state copies — `not_configured`: `Folder drop isn't configured on this server yet.`; `needs_share`: `Share your Violema Library folder with the reader address below, then verify.`; `active`: `Violema can see files you drop in your Violema Library folder.` — plus a reader-email copy control and a Verify control. Run: `cd frontend && npm run test:folder-drop` → FAIL.
- [ ] **Step 2: Implement the card** — section anchored `id="folder-drop"`, titled **"Folder drop"**, following the page's existing card/pill/button conventions (the business-context section is the visual template): status pill driven by the fetched `laneState` with a loading state first (mirror the business pill's server-snapshot pattern — never derive status from anything but the fetched state); reader-email row with a copy-to-clipboard button when `readerEmail` is present; Verify button → POST verify → re-render from the response; Share button when not active → POST share → when `manualShare`, show the guided instructions using the `needs_share` copy. Below it, "Add a link to your library": URL input + Add button → POST → on 200 show `Added "<fileName>" to your library.`, on error render the server message inline. All fetches follow the page's existing conventions.
- [ ] **Step 3: Full frontend gates** (`npm run test:folder-drop && npm run lint && npm run build && npm test`), **Step 4: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/tests/folderDrop.contract.mjs frontend/package.json
git commit -m "feat: folder-drop card and library link input in settings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Setup runbook, spec deviations, vault close-out

**Files:**
- Create: `docs/products/violema/FOLDER_DROP_SETUP.md`
- Modify: `docs/superpowers/specs/2026-08-06-library-folder-drop-ingestion-design.md`
- Vault: run note + dashboard generator + refresh + memory

- [ ] **Step 1: Write the runbook** — complete `!`-lane steps for Max: (1) GCP: create/reuse a project; enable the Drive API (`gcloud services enable drive.googleapis.com`); create the service account (`gcloud iam service-accounts create violema-library-reader --display-name="Violema Library Reader"`) — **no IAM roles needed**: Drive access comes entirely from folder sharing; create a JSON key (`gcloud iam service-accounts keys create reader-key.json --iam-account=violema-library-reader@<project>.iam.gserviceaccount.com`); console-click equivalents listed alongside. (2) VPS: `scp` the key to `/root/violema-secrets/library-reader.json`, `chmod 600`, append `GOOGLE_LIBRARY_READER_KEY_FILE=/root/violema-secrets/library-reader.json` to `backend/.env`, restart on the next deploy — never commit the key anywhere. (3) Local dev: same env var pointing at a local copy. (4) In-product: Settings → Folder drop → Share (or manual share to the shown reader address as Viewer) → Verify. (5) Rollback: delete the key in GCP, remove the env var; workspaces revert to app-created entries only.
- [ ] **Step 2: Record spec deviations** — (a) run warning only on `needs_share`, silent on `not_configured` (anti-noise rationale); (b) the Task 5 Step 1 registry outcome (which share branch shipped).
- [ ] **Step 3: Full gate sweep** — backend `npm run typecheck && npm test && npm run test:platform`; frontend `npm run lint && npm run build && npm test`. Fix regressions before proceeding.
- [ ] **Step 4: Vault Update Contract** — run note `70 Agents/Agent Runs/2026-08-06 Violema library folder-drop ingestion built.md` (what shipped, commits, gates, deploy-day note: the SA key + env must land on the VPS before or with deploy, else the lane sits `not_configured` — safe but inert); dashboard status via the `build_second_brain.py` manifest; run the refresh script; update the memory file (folder-drop built; SA setup pending on Max; deploy still gated on the business-context probe checklist too).
- [ ] **Step 5: Commit**

```bash
git add docs/products/violema/FOLDER_DROP_SETUP.md docs/superpowers/specs/2026-08-06-library-folder-drop-ingestion-design.md docs/superpowers/plans/2026-08-06-library-folder-drop-ingestion.md
git commit -m "docs: folder-drop setup runbook + spec deviations

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- Spec coverage: §1→T1, §2→T5+T8+T9, §3→T3, §4→T3+T4, §5→T7, §6→T6+T8, §7 woven through T5/T6 (content-free audit) + Global Constraints, §8→every task's tests. No gaps.
- Type consistency: `FolderDropLaneState`, `LibrarySweepResult`, `OperatorSourceEntry`, `origin: 'operator_file' | 'app_entry'`, `setLibrarySweepOverridesForTests`, `LibrarySweepError('listing_failed')`, route paths, audit literals — identical across tasks.
- Deliberate look-before-you-write points, both bounded with every outcome specified: T5 Step 1 (live Composio registry check, branches A/B both implemented-as-written) and T7 Step 1 (read the presenter's existing mapping before extending it).
- Ordering: T1→T3 is a strict dependency chain; T4 touches regression-sensitive files and runs the full suite; T5 and T6 both extend the audit union — plan order keeps them sequential.
