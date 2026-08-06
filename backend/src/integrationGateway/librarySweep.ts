/**
 * Library sweep — the operator-file discriminator.
 *
 * The account library (`accountLibrary.ts`) reads Drive through the
 * workspace's Composio `googledrive` connection, which is scoped to
 * `drive.file`: it only ever sees files the app itself created. An operator
 * who hand-drops a `.md`, `.pdf`, or `.docx` into the app-created
 * `Violema Library` folder is therefore invisible to every mission — the
 * highest-signal context available, unreachable by the grant that reads
 * everything else.
 *
 * THE DISCRIMINATOR
 *
 * This module adds a second, platform-owned reader: a Google service account
 * shared on the folder as a Viewer (see `adapters/nativeDriveReader.ts`),
 * which sees the whole tree — everything, operator-dropped or app-created.
 * The Composio lane still only sees app-created files. So:
 *
 *   (service-account listing of the tree) minus (Composio listing) = operator files, exactly
 *
 * No naming convention, no persisted tracking flag, no per-file provenance
 * write — the two grants' scopes are the discriminator. The one thing that
 * must hold for this to be correct is that the Composio listing is COMPLETE:
 * a truncated app-file listing would misclassify app entries as operator
 * files and duplicate them into evidence. `listComposioVisibleFileIds` below
 * pages every folder in the SA tree to completion, or throws
 * `LibrarySweepError` rather than ever guessing.
 *
 * WHY THE PAGE BUDGET IS SHARED ACROSS FOLDERS, NOT PER FOLDER
 *
 * The SA tree can contain many section folders (each mission section is a
 * subfolder). `SWEEP_COMPOSIO_MAX_PAGES` bounds the total number of
 * `GOOGLEDRIVE_FIND_FILE` calls this sweep is allowed to make across every
 * folder combined — a workspace with many sections must not multiply the
 * cap, it must share it, or one sweep could make an unbounded number of
 * partner calls.
 *
 * FAILS HONEST, NEVER SILENT
 *
 * Every skip is named in `warnings`: unsupported mime, oversized file, files
 * dropped by the 20-file cap. A file whose bytes cannot be parsed still
 * becomes an entry — `content: null, contentError: 'content unreadable'` —
 * the same visible-gap semantics `accountLibrary`'s `AccountLibraryEntry`
 * already uses, rather than disappearing without a trace.
 *
 * MEMO
 *
 * A module-level, in-process LRU (`SWEEP_MEMO_MAX_ENTRIES` entries,
 * `SWEEP_MEMO_TTL_MS` TTL) keyed on `fileId + modifiedTime + md5Checksum`
 * skips re-downloading and re-parsing a file that has not changed since the
 * last sweep that read it. The memo stores the text already capped to the
 * budget it was parsed under; since every call site currently passes the
 * same fixed `budgetBytes`, this never under-serves a later sweep with more
 * room — if that ever changes, the cached text is re-clamped (never
 * re-expanded) to whatever budget the current sweep has left, via the same
 * byte-cap path `sourceParsing.parseSourceBuffer` uses for a fresh file, so a
 * memo hit can never hand back more bytes than the caller asked for.
 *
 * NOTHING WRITES
 *
 * This module only ever reads. The SA reader's Drive scope is
 * `drive.readonly`; no code path here ever calls a Drive write action.
 */

import {
  createDriveReader,
  readDriveReaderConfig,
  DriveReaderError,
  DRIVE_READER_MAX_DOWNLOAD_BYTES,
  type DriveFileMeta,
  type DriveReader,
} from './adapters/nativeDriveReader';
import { isParseableSourceMime, parseSourceBuffer } from './sourceParsing';
import { executeComposioAction } from '../composioBridge';
import { classifyFailure, type PartnerComposioExecutor } from './adapters/partnerComposio';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const FIND_FILE_ACTION = 'GOOGLEDRIVE_FIND_FILE';
const CREATE_PERMISSION_ACTION = 'GOOGLEDRIVE_CREATE_PERMISSION';

export const MAX_OPERATOR_FILES_PER_SWEEP = 20;
export const SWEEP_COMPOSIO_MAX_PAGES = 10;
export const SWEEP_MEMO_MAX_ENTRIES = 50;
export const SWEEP_MEMO_TTL_MS = 15 * 60 * 1000;

export type FolderDropLaneState = 'not_configured' | 'needs_share' | 'active';

export interface LibrarySweepDeps {
  /** Test seam. Default: built from `readDriveReaderConfig()`; `null` when the lane is unconfigured. */
  reader?: DriveReader | null;
  /** Composio executor seam. Default: the real bridge. */
  execute?: PartnerComposioExecutor;
  now?: () => Date;
}

export interface OperatorSourceEntry {
  fileId: string;
  fileName: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  /** Extracted text, byte-capped. Null when the file could not be read. */
  content: string | null;
  truncated: boolean;
  /** Set when this entry's body could not be read, so the gap stays visible. */
  contentError?: string;
}

export interface LibrarySweepResult {
  laneState: FolderDropLaneState;
  entries: OperatorSourceEntry[];
  /** Named skips: unsupported type, too large, over-cap drops. */
  warnings: string[];
}

export class LibrarySweepError extends Error {
  code: 'listing_failed' = 'listing_failed';

  constructor(message: string) {
    super(message);
    this.name = 'LibrarySweepError';
  }
}

// --- test overrides -----------------------------------------------------------

interface LibrarySweepTestOverrides {
  laneState?: FolderDropLaneState;
  sweep?: LibrarySweepResult;
}

let testOverrides: LibrarySweepTestOverrides | null = null;

/**
 * Short-circuits `getFolderDropLaneState`/`sweepOperatorFiles` with a fixed
 * answer, for callers (Task 4/5's API and read-path tests) that want to
 * steer lane state without wiring a fake reader end to end. Guarded so a
 * stray call outside a test process can never silently rewrite production
 * behavior.
 */
export function setLibrarySweepOverridesForTests(overrides: LibrarySweepTestOverrides | null): void {
  if (process.env.NODE_ENV !== 'test') return;
  testOverrides = overrides;
}

// --- reader email + resolution -------------------------------------------------

/** The email a founder shares their `Violema Library` folder with. Null when the lane is unconfigured. */
export function getFolderDropReaderEmail(): string | null {
  return readDriveReaderConfig()?.clientEmail ?? null;
}

function resolveReader(deps: LibrarySweepDeps): DriveReader | null {
  if (deps.reader !== undefined) return deps.reader;
  const config = readDriveReaderConfig();
  return config ? createDriveReader(config) : null;
}

// --- share --------------------------------------------------------------------

export type ShareLibraryFolderResult =
  | { ok: true }
  | { ok: false; reason: ReturnType<typeof classifyFailure> | 'manual_share_required' };

/**
 * Share the workspace's `Violema Library` root folder with the platform's
 * read-only Drive reader, so the folder-drop lane can move out of
 * `needs_share`.
 *
 * BRANCH A. Registry-verified 2026-08-06 against the live Composio tool
 * registry (not docs) on toolkit `googledrive`: `GOOGLEDRIVE_CREATE_PERMISSION`
 * is present, with `file_id`, `type`, `role` required and `email_address`
 * required when `type` is `user` — see Task 5's report for the full
 * registry-check output. `send_notification_email: false` because the
 * grantee here is the platform's own service-account reader, never a human
 * inbox, so a share notification would just bounce.
 */
export async function shareLibraryFolderWithReader(
  workspaceId: string,
  folderId: string,
  readerEmail: string,
  deps: LibrarySweepDeps = {},
): Promise<ShareLibraryFolderResult> {
  const execute = deps.execute ?? executeComposioAction;

  try {
    const response = await execute(
      CREATE_PERMISSION_ACTION,
      {
        file_id: folderId,
        type: 'user',
        role: 'reader',
        email_address: readerEmail,
        send_notification_email: false,
      },
      { entityId: workspaceId },
    );
    if (!isRecord(response) || (response as ComposioEnvelope).successful !== true) {
      const failureDetail = isRecord(response) ? (response as ComposioEnvelope).error : 'share failed';
      return { ok: false, reason: classifyFailure(failureDetail ?? 'share failed') };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: classifyFailure(error) };
  }
}

// --- lane state -----------------------------------------------------------------

/**
 * The three buckets, named explicitly:
 *
 * - `not_configured`: either no reader key is present on this server at all,
 *   OR `rootFolderId` is null (the workspace's `Violema Library` folder does
 *   not exist yet — nothing has ever been shared, so there is nothing to
 *   warn about "re-sharing"), OR the key IS present but unusable
 *   (`DriveReaderError.code === 'auth_failed'` — a malformed/expired/revoked
 *   platform credential). That last case is deliberately folded into
 *   `not_configured` rather than `needs_share`: it is a Violema-side
 *   incident, not something the operator re-sharing their folder could ever
 *   fix, and telling them to "share your folder" for a broken platform key
 *   would hide our own outage behind onboarding UI.
 * - `needs_share`: a working key, but the reader could not list the root
 *   folder for any OTHER reason (typically `http_error` from a 403/404 —
 *   the folder is not shared with the reader, or was unshared later).
 * - `active`: the reader listed the folder successfully.
 */
function laneStateForDriveReaderError(error: DriveReaderError): FolderDropLaneState {
  return error.code === 'auth_failed' ? 'not_configured' : 'needs_share';
}

export async function getFolderDropLaneState(
  rootFolderId: string | null,
  deps: LibrarySweepDeps = {},
): Promise<FolderDropLaneState> {
  if (process.env.NODE_ENV === 'test' && testOverrides?.laneState !== undefined) {
    return testOverrides.laneState;
  }

  const reader = resolveReader(deps);
  if (!reader || !rootFolderId) return 'not_configured';

  try {
    await reader.listFolderTree(rootFolderId);
    return 'active';
  } catch (error) {
    if (!(error instanceof DriveReaderError)) throw error;
    return laneStateForDriveReaderError(error);
  }
}

// --- Composio-visible listing (the other half of the set difference) ------------

interface ComposioEnvelope {
  successful?: boolean;
  data?: unknown;
  error?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Same double-wrap defense `accountLibrary`'s `readDriveFiles` uses for Composio's envelope shapes. */
function readListingContainer(payload: unknown): Record<string, unknown> | unknown[] {
  return isRecord(payload) && isRecord(payload.data)
    ? (payload.data as Record<string, unknown>)
    : (payload as Record<string, unknown> | unknown[]);
}

function readListingFiles(payload: unknown): Record<string, unknown>[] {
  const container = readListingContainer(payload);
  const raw = Array.isArray(container)
    ? container
    : isRecord(container) && Array.isArray(container.files)
      ? container.files
      : [];
  return raw.filter(isRecord);
}

function readListingNextPageToken(payload: unknown): string | undefined {
  const container = readListingContainer(payload);
  return isRecord(container) ? asString(container.nextPageToken) : undefined;
}

/** Drive query strings are single-quoted, so quotes and backslashes must escape. */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Composio-visible file ids across every folder id in the SA tree (root +
 * every nested section folder discovered by the SA reader). Paginates each
 * folder to completeness; the page budget (`SWEEP_COMPOSIO_MAX_PAGES`) is
 * shared across every folder in this call, never per-folder. Throws
 * `LibrarySweepError` on any failure — a rejected call, a malformed
 * response, or the shared page budget running out — because a truncated
 * listing here would misclassify app-created files as operator files.
 */
async function listComposioVisibleFileIds(
  execute: PartnerComposioExecutor,
  workspaceId: string,
  folderIds: Iterable<string>,
): Promise<Set<string>> {
  const visible = new Set<string>();
  let pagesUsed = 0;

  for (const folderId of folderIds) {
    let pageToken: string | undefined;
    do {
      if (pagesUsed >= SWEEP_COMPOSIO_MAX_PAGES) {
        throw new LibrarySweepError(
          `Folder drop: the Composio listing did not complete within the ${SWEEP_COMPOSIO_MAX_PAGES}-page budget.`,
        );
      }
      pagesUsed += 1;

      const input: Record<string, unknown> = {
        q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`,
        fields: 'files(id,name),nextPageToken',
        pageSize: 100,
        spaces: 'drive',
      };
      if (pageToken) input.pageToken = pageToken;

      let response: unknown;
      try {
        response = await execute(FIND_FILE_ACTION, input, { entityId: workspaceId });
      } catch {
        throw new LibrarySweepError('Folder drop: the Composio listing failed.');
      }

      if (!isRecord(response) || (response as ComposioEnvelope).successful !== true) {
        throw new LibrarySweepError('Folder drop: the Composio listing failed.');
      }

      const envelope = response as ComposioEnvelope;
      for (const file of readListingFiles(envelope.data)) {
        const id = asString(file.id);
        if (id) visible.add(id);
      }
      pageToken = readListingNextPageToken(envelope.data);
    } while (pageToken);
  }

  return visible;
}

// --- memo -------------------------------------------------------------------------

interface SweepMemoEntry {
  text: string;
  truncated: boolean;
  at: number;
}

const sweepMemo = new Map<string, SweepMemoEntry>();

function memoKeyFor(file: DriveFileMeta): string {
  return `${file.id}::${file.modifiedTime ?? ''}::${file.md5Checksum ?? ''}`;
}

function readSweepMemo(key: string, nowMs: number): SweepMemoEntry | null {
  const entry = sweepMemo.get(key);
  if (!entry) return null;
  if (nowMs - entry.at > SWEEP_MEMO_TTL_MS) {
    sweepMemo.delete(key);
    return null;
  }
  // Bump recency: delete + re-set moves this key to the end of Map's
  // insertion order, which is what the LRU eviction below walks from.
  sweepMemo.delete(key);
  sweepMemo.set(key, entry);
  return entry;
}

function writeSweepMemo(key: string, entry: SweepMemoEntry): void {
  sweepMemo.delete(key);
  sweepMemo.set(key, entry);
  while (sweepMemo.size > SWEEP_MEMO_MAX_ENTRIES) {
    const oldestKey = sweepMemo.keys().next().value;
    if (oldestKey === undefined) break;
    sweepMemo.delete(oldestKey);
  }
}

/** Test-only escape hatch: the memo is module-level and must not leak content across independent test runs. */
export function clearSweepMemoForTests(): void {
  sweepMemo.clear();
}

// --- per-file body resolution -----------------------------------------------------

/**
 * Resolve one file's extracted text, honoring the memo. Never throws: a
 * `DriveReaderError` from the download/export call, or a parse failure,
 * both collapse to `contentError: 'content unreadable'` — the visible-gap
 * semantics `AccountLibraryEntry` already uses. Any OTHER kind of error
 * (a bug, not an expected failure mode) is rethrown rather than swallowed.
 */
async function resolveFileText(
  reader: DriveReader,
  file: DriveFileMeta,
  maxBytes: number,
  isGoogleDoc: boolean,
  nowMs: number,
): Promise<{ text: string | null; truncated: boolean; contentError?: string }> {
  const key = memoKeyFor(file);
  const cached = readSweepMemo(key, nowMs);
  if (cached) {
    // Re-clamp to the CURRENT budget without re-downloading or re-exporting.
    // `cached.truncated` is carried forward with OR, never discarded: the
    // cached text is itself already a possibly-partial view of the real
    // file (it was capped to whatever budget the sweep that wrote it had
    // left). A later sweep with more remainingBudget can re-clamp that
    // partial text and find it fits under the new, larger ceiling — but
    // "fits under a bigger ceiling" is not the same fact as "this is the
    // whole file". A file once known-partial must never later report
    // complete without an actual re-download/re-export.
    const reclamped = await parseSourceBuffer(
      { fileName: file.name, mimeType: 'text/plain', buffer: Buffer.from(cached.text, 'utf8') },
      maxBytes,
    );
    return reclamped.ok
      ? { text: reclamped.text, truncated: cached.truncated || reclamped.truncated }
      : { text: null, truncated: false, contentError: 'content unreadable' };
  }

  let parsed;
  try {
    if (isGoogleDoc) {
      const exported = await reader.exportDoc(file.id);
      parsed = await parseSourceBuffer(
        { fileName: file.name, mimeType: 'text/plain', buffer: Buffer.from(exported, 'utf8') },
        maxBytes,
      );
    } else {
      const buffer = await reader.downloadFile(file.id);
      parsed = await parseSourceBuffer({ fileName: file.name, mimeType: file.mimeType, buffer }, maxBytes);
    }
  } catch (error) {
    if (!(error instanceof DriveReaderError)) throw error;
    return { text: null, truncated: false, contentError: 'content unreadable' };
  }

  if (!parsed.ok) {
    return { text: null, truncated: false, contentError: 'content unreadable' };
  }

  writeSweepMemo(key, { text: parsed.text, truncated: parsed.truncated, at: nowMs });
  return { text: parsed.text, truncated: parsed.truncated };
}

function modifiedTimeValue(file: DriveFileMeta): number {
  if (!file.modifiedTime) return 0;
  const parsed = Date.parse(file.modifiedTime);
  return Number.isFinite(parsed) ? parsed : 0;
}

// --- sweep ------------------------------------------------------------------------

/**
 * Sweep the operator-file set out of a workspace's `Violema Library` tree.
 *
 * Throws `LibrarySweepError` when the Composio listing cannot complete —
 * never returns a result built on a partial listing, since that would
 * misclassify app-created files as operator files.
 */
export async function sweepOperatorFiles(
  input: { workspaceId: string; rootFolderId: string; budgetBytes: number },
  deps: LibrarySweepDeps = {},
): Promise<LibrarySweepResult> {
  if (process.env.NODE_ENV === 'test' && testOverrides?.sweep !== undefined) {
    return testOverrides.sweep;
  }

  const reader = resolveReader(deps);
  if (!reader) {
    return { laneState: 'not_configured', entries: [], warnings: [] };
  }

  const execute = deps.execute ?? executeComposioAction;
  const nowFn = deps.now ?? (() => new Date());

  let tree: DriveFileMeta[];
  try {
    tree = await reader.listFolderTree(input.rootFolderId);
  } catch (error) {
    if (!(error instanceof DriveReaderError)) throw error;
    return { laneState: laneStateForDriveReaderError(error), entries: [], warnings: [] };
  }

  const folderIds = new Set<string>([input.rootFolderId]);
  for (const file of tree) {
    if (file.mimeType === FOLDER_MIME_TYPE) folderIds.add(file.id);
  }

  // Throws LibrarySweepError on any incomplete/failed listing — never a
  // silent skip, never a misclassification.
  const composioVisible = await listComposioVisibleFileIds(execute, input.workspaceId, folderIds);

  const operatorFiles = tree.filter(
    (file) => file.mimeType !== FOLDER_MIME_TYPE && !composioVisible.has(file.id),
  );
  operatorFiles.sort((a, b) => modifiedTimeValue(b) - modifiedTimeValue(a));

  const warnings: string[] = [];
  let selected = operatorFiles;
  if (operatorFiles.length > MAX_OPERATOR_FILES_PER_SWEEP) {
    const dropped = operatorFiles.slice(MAX_OPERATOR_FILES_PER_SWEEP);
    selected = operatorFiles.slice(0, MAX_OPERATOR_FILES_PER_SWEEP);
    warnings.push(
      `Folder drop: ${dropped.length} more file(s) were not read this run (${MAX_OPERATOR_FILES_PER_SWEEP}-file cap): ${dropped
        .map((file) => file.name)
        .join(', ')}`,
    );
  }

  const entries: OperatorSourceEntry[] = [];
  let remainingBudget = input.budgetBytes;
  const nowMs = nowFn().getTime();

  for (const file of selected) {
    if (remainingBudget <= 0) break;

    const isGoogleDoc = file.mimeType === GOOGLE_DOC_MIME_TYPE;

    if (!isGoogleDoc && !isParseableSourceMime(file.mimeType)) {
      warnings.push(`Folder drop: '${file.name}' skipped (unsupported type ${file.mimeType})`);
      continue;
    }

    if (!isGoogleDoc && typeof file.size === 'number' && file.size > DRIVE_READER_MAX_DOWNLOAD_BYTES) {
      warnings.push(
        `Folder drop: '${file.name}' skipped (exceeds the ${DRIVE_READER_MAX_DOWNLOAD_BYTES}-byte cap)`,
      );
      continue;
    }

    const body = await resolveFileText(reader, file, remainingBudget, isGoogleDoc, nowMs);
    if (body.text !== null) {
      remainingBudget -= Buffer.byteLength(body.text, 'utf8');
    }

    entries.push({
      fileId: file.id,
      fileName: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      content: body.text,
      truncated: body.truncated,
      ...(body.contentError ? { contentError: body.contentError } : {}),
    });
  }

  return { laneState: 'active', entries, warnings };
}
