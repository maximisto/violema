/**
 * Account memory — the intelligence library.
 *
 * A mission that researches the same question every week and starts from a
 * blank page every week is a search box on a timer. The library is what turns
 * repetition into compounding: each run READS what Violema already knows about
 * this account, reasons about the delta, and WRITES back what it learned.
 *
 * THE DAY-ONE ONBOARDING STORY
 *
 *   1. The customer connects Google Drive (one OAuth, on /integrations).
 *   2. Their first mission run reads the library, finds it empty, and says so
 *      honestly — no prior findings, so this run is the baseline.
 *   3. That run appends its findings, creating `Violema Library/<Section>/` in
 *      the customer's own Drive.
 *   4. Every run after that opens with real prior context: "here is what we
 *      knew, here is what changed." By week four the mission is reasoning
 *      about a trend line no fresh web search could reconstruct.
 *
 * WHY THE CUSTOMER'S DRIVE, NOT OUR DATABASE
 *
 * The library is the customer's own institutional memory, so it lives in
 * storage they own, can read without us, can audit, and can take with them if
 * they leave. That is a deliberate trust position, not a storage shortcut. It
 * also means the folder is a product surface: a founder can open
 * `Violema Library/Competitive Intelligence/` and read the whole history as
 * plain markdown files, with no Violema login.
 *
 * WHY NO CACHED FOLDER ID
 *
 * The obvious optimization is to cache the folder id in workspace settings.
 * This module deliberately does not, and resolves the folder against Drive on
 * every call instead. Drive is the system of record here — the customer can
 * rename, move, or delete the folder at any time, and a cached id that has
 * quietly gone stale is the single most dangerous state this module could
 * hold, because the operation it feeds is a WRITE. Resolution costs one extra
 * find per call on a weekly mission, which is not a price worth paying a
 * correctness risk to avoid. If that ever shows up in latency, the right fix
 * is a short-lived in-process memo (the `readConnectedAppsWithCache` pattern
 * in composioBridge), not durable persistence of another system's id.
 *
 * MISSION-AGNOSTIC BY CONSTRUCTION
 *
 * Nothing here knows what a competitor is. A "section" is just a named
 * subfolder, so any mission — weekly founder update, customer health, hiring
 * pipeline — adopts the library by naming a section in its step inputs. No new
 * code is required to add one.
 *
 * NOTION / STRUCTURED BACKENDS — deliberately not built
 *
 * Notion is a credible second backend behind this same interface: sections map
 * to databases and entries to pages, which would buy queryable structure that
 * flat markdown files do not have. It is not built because Drive is the
 * connected surface today and a second backend before the first one has users
 * is speculative. Note also what is explicitly OUT of scope: coupling this to
 * any personal knowledge vault. The library is customer-owned storage for a
 * customer's own account memory — it must never read from, write to, or depend
 * on an operator's private notes.
 *
 * TRUST FLOOR
 *
 * - Fails closed. Drive not connected means an honest blocker naming Google
 *   Drive, never a silently skipped step and never invented library content.
 * - Reads never write. `readLibrary` only ever looks; the folder is created by
 *   `appendLibraryEntry`, which is already an audited external action. A read
 *   step must not mutate the customer's Drive as a side effect.
 * - Writes stay inside the library. Every create is parented to a folder id
 *   this module resolved under `Violema Library`; a write is refused outright
 *   rather than falling back to the Drive root.
 * - Bounded. Reads cap entry count, per-entry bytes, and total bytes, so a
 *   large library can never flood a model prompt or this process's memory.
 *
 * VERIFIED COMPOSIO ACTIONS (checked against the live tool registry, not docs —
 * all present and non-deprecated on toolkit `googledrive`):
 *
 *   GOOGLEDRIVE_FIND_FILE           q, fields, orderBy, pageSize, spaces
 *                                   -> { files: [{ id, name, ... }] }
 *   GOOGLEDRIVE_CREATE_FOLDER       name (required), parent_id
 *                                   -> { id }
 *   GOOGLEDRIVE_CREATE_FILE_FROM_TEXT
 *                                   file_name + text_content (required),
 *                                   mime_type, parent_id  -> { id, name }
 *   GOOGLEDRIVE_DOWNLOAD_FILE       fileId (required), mime_type
 *                                   -> { downloaded_file_content: { s3url } }
 *
 * Note `GOOGLEDRIVE_DOWNLOAD_FILE` does NOT return file text inline — it
 * returns a presigned S3 URL that must be fetched separately. That is why this
 * module carries a bounded `fetchText` dependency at all.
 */

import {
  classifyFailure as classifyPartnerFailure,
  type PartnerComposioExecutor,
} from './adapters/partnerComposio';
import { executeComposioAction } from '../composioBridge';
import type { IntegrationQuerySuccess, IntegrationReadinessError } from './types';

/** The query-step source name a mission uses to reach the library. */
export const ACCOUNT_LIBRARY_SOURCE = 'account_library';

/**
 * The integration the library is actually built on. Readiness blockers,
 * provenance, and connect routes all name Google Drive rather than the
 * `account_library` capability, because Google Drive is the thing a founder
 * connects and the thing that genuinely holds the data.
 */
export const ACCOUNT_LIBRARY_BACKING_SOURCE = 'google_drive';

export const ACCOUNT_LIBRARY_READ_QUERY_TYPE = 'read';
export const ACCOUNT_LIBRARY_WRITE_QUERY_TYPE = 'write';

/** Root folder created in the customer's Drive. One per workspace. */
export const LIBRARY_ROOT_FOLDER_NAME = 'Violema Library';

/** The section the competitor monitor writes to. Sections are just subfolders. */
export const COMPETITIVE_INTELLIGENCE_SECTION = 'Competitive Intelligence';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const ENTRY_MIME_TYPE = 'text/markdown';
const ENTRY_FILE_EXTENSION = '.md';

const FIND_FILE_ACTION = 'GOOGLEDRIVE_FIND_FILE';
const CREATE_FOLDER_ACTION = 'GOOGLEDRIVE_CREATE_FOLDER';
const CREATE_FILE_FROM_TEXT_ACTION = 'GOOGLEDRIVE_CREATE_FILE_FROM_TEXT';
const DOWNLOAD_FILE_ACTION = 'GOOGLEDRIVE_DOWNLOAD_FILE';

export const DEFAULT_LIBRARY_READ_LIMIT = 3;
export const MAX_LIBRARY_READ_LIMIT = 10;

/** Per-entry and whole-response ceilings on extracted text. */
export const MAX_ENTRY_CONTENT_BYTES = 8_000;
export const MAX_TOTAL_CONTENT_BYTES = 24_000;

/** Upper bound on a single appended entry, well under Drive's 10MB text limit. */
export const MAX_ENTRY_MARKDOWN_BYTES = 200_000;

const DOWNLOAD_TIMEOUT_MS = 10_000;

/** Bounded text fetch for a presigned download URL. */
export type LibraryFetchText = (url: string, maxBytes: number) => Promise<string>;

export interface AccountLibraryDeps {
  /** Composio executor seam. Defaults to the real bridge; tests inject a fake. */
  execute?: PartnerComposioExecutor;
  /** Presigned-URL reader seam. Defaults to a bounded global fetch. */
  fetchText?: LibraryFetchText;
  now?: () => Date;
}

export interface AccountLibraryEntry {
  fileId: string;
  fileName: string;
  /** Entry date parsed from the file name, when it follows the dated convention. */
  entryDate?: string;
  modifiedTime?: string;
  webViewLink?: string;
  /** Extracted text, truncated to the byte ceilings. Null when unreadable. */
  content: string | null;
  truncated: boolean;
  /** Set when this entry's body could not be read, so the gap is visible. */
  contentError?: string;
}

export interface AccountLibrarySnapshot {
  section: string;
  rootFolderName: string;
  /** False on the very first run, before any entry has created the folder. */
  libraryInitialized: boolean;
  folderId: string | null;
  entryCount: number;
  entries: AccountLibraryEntry[];
}

export interface AccountLibraryAppendResult {
  ok: true;
  section: string;
  folderId: string;
  fileId: string;
  fileName: string;
  /** False when an identical entry already existed — a rerun, not a duplicate. */
  created: boolean;
}

export interface EnsureLibraryFolderResult {
  ok: true;
  rootFolderId: string;
  folderId: string;
  /** True when this call created either folder. */
  createdFolder: boolean;
}

type LibraryFailure = IntegrationReadinessError;

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

/**
 * Every failure exits through here, so the customer always gets the same
 * honest instruction: connect Google Drive. `can_continue` is false because a
 * library step that silently no-ops would leave the mission reasoning against
 * context it never actually read.
 */
function libraryFailure(
  code: IntegrationReadinessError['code'],
  detail?: string,
): LibraryFailure {
  const scopeFailure = code === 'integration_scope_insufficient';
  const notReady = code === 'integration_not_ready' || code === 'integration_not_connected';

  return {
    ok: false,
    code,
    source: ACCOUNT_LIBRARY_BACKING_SOURCE,
    message: notReady
      ? "Google Drive must be connected before Violema can read or update this account's intelligence library."
      : scopeFailure
        ? 'Google Drive is connected but needs file read and write access to maintain the intelligence library.'
        : detail
          ? `Violema could not reach the intelligence library in Google Drive right now. ${detail}`
          : 'Violema could not reach the intelligence library in Google Drive right now.',
    can_continue: false,
    nextAction: {
      label: notReady
        ? 'Connect Google Drive'
        : scopeFailure
          ? 'Reauthorize Google Drive'
          : 'Retry Google Drive',
      route: `/integrations?provider=${ACCOUNT_LIBRARY_BACKING_SOURCE}`,
    },
  };
}

export function isLibraryFailure(
  value: EnsureLibraryFolderResult | AccountLibraryAppendResult | LibraryFailure,
): value is LibraryFailure {
  return value.ok === false;
}

/**
 * Run one Drive action. Never throws: a rejected promise, a malformed
 * response, or `successful !== true` all become a classified failure, so no
 * caller can mistake an outage for an empty library.
 */
async function runDriveAction(
  execute: PartnerComposioExecutor,
  workspaceId: string,
  actionName: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; failure: LibraryFailure }> {
  try {
    const response = await execute(actionName, input, { entityId: workspaceId });
    if (!isRecord(response)) {
      return { ok: false, failure: libraryFailure('integration_query_failed') };
    }
    const envelope = response as ComposioEnvelope;
    if (envelope.successful !== true) {
      return {
        ok: false,
        failure: libraryFailure(classifyPartnerFailure(envelope.error ?? 'drive action failed')),
      };
    }
    return { ok: true, data: envelope.data };
  } catch (error) {
    return { ok: false, failure: libraryFailure(classifyPartnerFailure(error)) };
  }
}

/** Drive query strings are single-quoted, so quotes and backslashes must escape. */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function readDriveFiles(payload: unknown): Record<string, unknown>[] {
  const container = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  const raw = Array.isArray(container)
    ? container
    : isRecord(container) && Array.isArray(container.files)
      ? container.files
      : [];
  return raw.filter(isRecord);
}

/**
 * Find one folder by exact name, optionally within a parent.
 *
 * Uses FIND_FILE rather than FIND_FOLDER deliberately: FIND_FILE takes a raw
 * Drive `q`, which lets us pin mimeType, parent, and trashed state exactly.
 * FIND_FOLDER's name matching is looser, and "loose" is the wrong property for
 * the lookup that decides where we are about to write.
 */
async function findFolderByName(
  execute: PartnerComposioExecutor,
  workspaceId: string,
  name: string,
  parentId?: string,
): Promise<{ ok: true; folderId: string | null } | { ok: false; failure: LibraryFailure }> {
  const clauses = [
    `mimeType = '${FOLDER_MIME_TYPE}'`,
    `name = '${escapeDriveQueryValue(name)}'`,
    'trashed = false',
  ];
  if (parentId) clauses.push(`'${escapeDriveQueryValue(parentId)}' in parents`);

  const result = await runDriveAction(execute, workspaceId, FIND_FILE_ACTION, {
    q: clauses.join(' and '),
    fields: 'files(id,name,createdTime)',
    // Oldest first: if a customer ever ends up with two same-named folders,
    // every run must keep choosing the same one.
    orderBy: 'createdTime',
    pageSize: 10,
    spaces: 'drive',
  });
  if (!result.ok) return result;

  const folderId = readDriveFiles(result.data)
    .map((file) => asString(file.id))
    .find((id): id is string => Boolean(id));

  return { ok: true, folderId: folderId ?? null };
}

async function createFolder(
  execute: PartnerComposioExecutor,
  workspaceId: string,
  name: string,
  parentId?: string,
): Promise<{ ok: true; folderId: string } | { ok: false; failure: LibraryFailure }> {
  const input: Record<string, unknown> = { name };
  if (parentId) input.parent_id = parentId;

  const result = await runDriveAction(execute, workspaceId, CREATE_FOLDER_ACTION, input);
  if (!result.ok) return result;

  const container =
    isRecord(result.data) && isRecord(result.data.data) ? result.data.data : result.data;
  const folderId = isRecord(container) ? asString(container.id) : undefined;
  if (!folderId) {
    return {
      ok: false,
      failure: libraryFailure('integration_query_failed', 'Drive did not return a folder id.'),
    };
  }
  return { ok: true, folderId };
}

async function findOrCreateFolder(
  execute: PartnerComposioExecutor,
  workspaceId: string,
  name: string,
  parentId?: string,
): Promise<
  { ok: true; folderId: string; created: boolean } | { ok: false; failure: LibraryFailure }
> {
  const found = await findFolderByName(execute, workspaceId, name, parentId);
  if (!found.ok) return found;
  if (found.folderId) return { ok: true, folderId: found.folderId, created: false };

  const created = await createFolder(execute, workspaceId, name, parentId);
  if (!created.ok) return created;
  return { ok: true, folderId: created.folderId, created: true };
}

function normalizeSection(section: string): string {
  return section.trim().replace(/\s+/g, ' ');
}

/**
 * Resolve `Violema Library/<section>/` in this workspace's Drive, creating
 * either folder if missing.
 *
 * `entityId` is the workspaceId, so Composio resolves the OAuth credential of
 * the workspace that owns the run. One tenant can never resolve into another
 * tenant's Drive.
 */
export async function ensureLibraryFolder(
  workspaceId: string,
  section: string,
  deps: AccountLibraryDeps = {},
): Promise<EnsureLibraryFolderResult | LibraryFailure> {
  const normalizedSection = normalizeSection(section);
  if (!workspaceId.trim()) {
    return libraryFailure('integration_not_connected');
  }
  if (!normalizedSection) {
    return libraryFailure('unsupported_query', 'No library section was named.');
  }

  const execute = deps.execute ?? executeComposioAction;

  const root = await findOrCreateFolder(execute, workspaceId, LIBRARY_ROOT_FOLDER_NAME);
  if (!root.ok) return root.failure;

  const sectionFolder = await findOrCreateFolder(
    execute,
    workspaceId,
    normalizedSection,
    root.folderId,
  );
  if (!sectionFolder.ok) return sectionFolder.failure;

  return {
    ok: true,
    rootFolderId: root.folderId,
    folderId: sectionFolder.folderId,
    createdFolder: root.created || sectionFolder.created,
  };
}

function clampReadLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_LIBRARY_READ_LIMIT;
  return Math.min(MAX_LIBRARY_READ_LIMIT, Math.max(1, Math.trunc(limit)));
}

/**
 * Read a presigned download URL, stopping at `maxBytes`.
 *
 * Streamed rather than buffered: a library entry should be a few kilobytes,
 * but nothing about a URL guarantees that, and this process must not be
 * forced to hold an arbitrary file in memory to find out.
 */
async function defaultFetchText(url: string, maxBytes: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`download responded ${response.status}`);
    }
    const body = response.body;
    if (!body) return '';

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - total;
      if (remaining <= 0) break;
      const slice = value.length > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      total += slice.length;
      if (total >= maxBytes) break;
    }
    await reader.cancel().catch(() => undefined);

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(merged);
  } finally {
    clearTimeout(timer);
  }
}

/** `2026-08-02 — Competitor snapshot.md` -> `2026-08-02`. */
function readEntryDate(fileName: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(fileName);
  return match ? match[1] : undefined;
}

async function readEntryContent(
  execute: PartnerComposioExecutor,
  fetchText: LibraryFetchText,
  workspaceId: string,
  fileId: string,
  budgetBytes: number,
): Promise<{ content: string | null; truncated: boolean; contentError?: string }> {
  if (budgetBytes <= 0) {
    return { content: null, truncated: true, contentError: 'content budget exhausted' };
  }

  const download = await runDriveAction(execute, workspaceId, DOWNLOAD_FILE_ACTION, { fileId });
  if (!download.ok) {
    return { content: null, truncated: false, contentError: 'download unavailable' };
  }

  const container =
    isRecord(download.data) && isRecord(download.data.data) ? download.data.data : download.data;
  const downloadable =
    isRecord(container) && isRecord(container.downloaded_file_content)
      ? container.downloaded_file_content
      : null;
  const s3url = downloadable ? asString(downloadable.s3url) : undefined;
  if (!s3url) {
    return { content: null, truncated: false, contentError: 'download url unavailable' };
  }

  const limit = Math.min(MAX_ENTRY_CONTENT_BYTES, budgetBytes);
  try {
    const text = await fetchText(s3url, limit);
    // Byte length, not character count — the ceiling is about transport size.
    const truncated = Buffer.byteLength(text, 'utf8') >= limit;
    return { content: text, truncated };
  } catch {
    return { content: null, truncated: false, contentError: 'content unreadable' };
  }
}

/**
 * Read the most recent entries in a section.
 *
 * Deliberately never creates anything. On a workspace that has never written
 * an entry the section folder does not exist yet, and the honest answer is an
 * initialized-false snapshot with zero entries — not a folder conjured as a
 * side effect of reading.
 */
export async function readLibrary(
  workspaceId: string,
  section: string,
  options: { limit?: number } = {},
  deps: AccountLibraryDeps = {},
): Promise<IntegrationQuerySuccess<AccountLibrarySnapshot> | LibraryFailure> {
  const normalizedSection = normalizeSection(section);
  if (!workspaceId.trim()) return libraryFailure('integration_not_connected');
  if (!normalizedSection) return libraryFailure('unsupported_query', 'No library section was named.');

  const execute = deps.execute ?? executeComposioAction;
  const fetchText = deps.fetchText ?? defaultFetchText;
  const now = deps.now ? deps.now() : new Date();
  const startedAt = Date.now();
  const limit = clampReadLimit(options.limit);

  const root = await findFolderByName(execute, workspaceId, LIBRARY_ROOT_FOLDER_NAME);
  if (!root.ok) return root.failure;

  let folderId: string | null = null;
  if (root.folderId) {
    const sectionFolder = await findFolderByName(
      execute,
      workspaceId,
      normalizedSection,
      root.folderId,
    );
    if (!sectionFolder.ok) return sectionFolder.failure;
    folderId = sectionFolder.folderId;
  }

  if (!folderId) {
    return librarySnapshotResult(
      {
        section: normalizedSection,
        rootFolderName: LIBRARY_ROOT_FOLDER_NAME,
        libraryInitialized: false,
        folderId: null,
        entryCount: 0,
        entries: [],
      },
      now,
      startedAt,
    );
  }

  const listing = await runDriveAction(execute, workspaceId, FIND_FILE_ACTION, {
    q: `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false`,
    fields: 'files(id,name,modifiedTime,createdTime,webViewLink),nextPageToken',
    orderBy: 'createdTime desc',
    pageSize: limit,
    spaces: 'drive',
  });
  if (!listing.ok) return listing.failure;

  const files = readDriveFiles(listing.data).slice(0, limit);
  const entries: AccountLibraryEntry[] = [];
  let remainingBudget = MAX_TOTAL_CONTENT_BYTES;

  for (const file of files) {
    const fileId = asString(file.id);
    const fileName = asString(file.name);
    if (!fileId || !fileName) continue;

    const body = await readEntryContent(execute, fetchText, workspaceId, fileId, remainingBudget);
    if (body.content) {
      remainingBudget -= Buffer.byteLength(body.content, 'utf8');
    }

    entries.push({
      fileId,
      fileName,
      entryDate: readEntryDate(fileName),
      modifiedTime: asString(file.modifiedTime),
      webViewLink: asString(file.webViewLink),
      content: body.content,
      truncated: body.truncated,
      ...(body.contentError ? { contentError: body.contentError } : {}),
    });
  }

  return librarySnapshotResult(
    {
      section: normalizedSection,
      rootFolderName: LIBRARY_ROOT_FOLDER_NAME,
      libraryInitialized: true,
      folderId,
      entryCount: entries.length,
      entries,
    },
    now,
    startedAt,
  );
}

/**
 * Provenance: the payload names `google_drive`, because that is where the
 * bytes genuinely came from. The `account_library` capability is how a mission
 * asks for the data; Google Drive is what answers, and the ledger, the origin
 * record, and the connect route should all agree on the real system.
 */
function librarySnapshotResult(
  snapshot: AccountLibrarySnapshot,
  now: Date,
  startedAt: number,
): IntegrationQuerySuccess<AccountLibrarySnapshot> {
  return {
    ok: true,
    source: ACCOUNT_LIBRARY_BACKING_SOURCE,
    query_type: 'account_library_read',
    data: snapshot,
    fetched_at: now.toISOString(),
    latency_ms: Math.max(0, Date.now() - startedAt),
    cache_hit: false,
    live: true,
  };
}

/** Drive rejects these in file names; collapse them rather than fail the run. */
function sanitizeEntryTitle(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function formatEntryDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function buildLibraryEntryFileName(title: string, now: Date): string {
  const safeTitle = sanitizeEntryTitle(title) || 'Entry';
  return `${formatEntryDate(now)} — ${safeTitle}${ENTRY_FILE_EXTENSION}`;
}

/**
 * Append one dated entry to a section, creating the library if needed.
 *
 * IDEMPOTENT per (section, date, title): the file name is derived from those
 * three, and an existing file with that name short-circuits the write. A
 * rerun of the same mission on the same day updates nothing and duplicates
 * nothing — it returns the entry that is already there with `created: false`.
 * Rerunning a mission is a normal operator action, and it must not litter a
 * customer's Drive.
 */
export async function appendLibraryEntry(
  workspaceId: string,
  section: string,
  entry: { title: string; markdown: string },
  deps: AccountLibraryDeps = {},
): Promise<AccountLibraryAppendResult | LibraryFailure> {
  const normalizedSection = normalizeSection(section);
  if (!workspaceId.trim()) return libraryFailure('integration_not_connected');
  if (!normalizedSection) return libraryFailure('unsupported_query', 'No library section was named.');

  const markdown = typeof entry.markdown === 'string' ? entry.markdown : '';
  if (!markdown.trim()) {
    // Writing an empty entry would corrupt the delta context every later run
    // reads. Better to fail the step and say why.
    return libraryFailure('unsupported_query', 'There was no drafted content to record.');
  }

  const execute = deps.execute ?? executeComposioAction;
  const now = deps.now ? deps.now() : new Date();

  const folder = await ensureLibraryFolder(workspaceId, normalizedSection, deps);
  if (isLibraryFailure(folder)) return folder;

  // Belt and braces: never issue a create without a parent resolved under
  // `Violema Library`. An unparented create would land in the customer's Drive
  // root, which is exactly the "wrote outside the library" failure.
  if (!folder.folderId) {
    return libraryFailure('integration_query_failed', 'The library folder could not be resolved.');
  }

  const fileName = buildLibraryEntryFileName(entry.title, now);

  const existing = await runDriveAction(execute, workspaceId, FIND_FILE_ACTION, {
    q: [
      `'${escapeDriveQueryValue(folder.folderId)}' in parents`,
      `name = '${escapeDriveQueryValue(fileName)}'`,
      'trashed = false',
    ].join(' and '),
    fields: 'files(id,name)',
    orderBy: 'createdTime',
    pageSize: 5,
    spaces: 'drive',
  });
  if (!existing.ok) return existing.failure;

  const existingId = readDriveFiles(existing.data)
    .map((file) => asString(file.id))
    .find((id): id is string => Boolean(id));

  if (existingId) {
    return {
      ok: true,
      section: normalizedSection,
      folderId: folder.folderId,
      fileId: existingId,
      fileName,
      created: false,
    };
  }

  const body =
    Buffer.byteLength(markdown, 'utf8') > MAX_ENTRY_MARKDOWN_BYTES
      ? `${markdown.slice(0, MAX_ENTRY_MARKDOWN_BYTES)}\n\n_[truncated by Violema]_`
      : markdown;

  const created = await runDriveAction(execute, workspaceId, CREATE_FILE_FROM_TEXT_ACTION, {
    file_name: fileName,
    text_content: body,
    mime_type: ENTRY_MIME_TYPE,
    parent_id: folder.folderId,
  });
  if (!created.ok) return created.failure;

  const container =
    isRecord(created.data) && isRecord(created.data.data) ? created.data.data : created.data;
  const fileId = isRecord(container) ? asString(container.id) : undefined;
  if (!fileId) {
    return libraryFailure('integration_query_failed', 'Drive did not return a file id.');
  }

  return {
    ok: true,
    section: normalizedSection,
    folderId: folder.folderId,
    fileId,
    fileName,
    created: true,
  };
}

/**
 * Render a library snapshot as prompt context.
 *
 * The wording matters as much as the data: an empty library must read as "this
 * is the baseline", never as an absence the model might paper over with
 * plausible-sounding history.
 */
export function renderLibraryContextMarkdown(snapshot: AccountLibrarySnapshot): string {
  if (!snapshot.libraryInitialized || snapshot.entries.length === 0) {
    return [
      `No prior ${snapshot.section} entries exist in this account's library yet.`,
      'Treat this run as the baseline: record what is true now, and do not describe changes you cannot evidence.',
    ].join(' ');
  }

  const rendered = snapshot.entries
    .map((item) => {
      const heading = `### ${item.entryDate || item.fileName}`;
      const content = item.content?.trim()
        ? item.content.trim()
        : `_(content unavailable: ${item.contentError || 'unreadable'})_`;
      return `${heading}\n${content}`;
    })
    .join('\n\n');

  return `Prior ${snapshot.section} findings already recorded for this account, newest first:\n\n${rendered}`;
}

/** True when a query step's inputs address the account library. */
export function isAccountLibraryRequest(
  inputs: Record<string, unknown> | undefined | null,
): boolean {
  const source = inputs?.source;
  return typeof source === 'string' && source.trim().toLowerCase() === ACCOUNT_LIBRARY_SOURCE;
}

/** True when a query step's inputs ask the library to record this run. */
export function isAccountLibraryWriteRequest(
  inputs: Record<string, unknown> | undefined | null,
): boolean {
  if (!isAccountLibraryRequest(inputs)) return false;
  const queryType = inputs?.query_type;
  return (
    typeof queryType === 'string'
    && queryType.trim().toLowerCase() === ACCOUNT_LIBRARY_WRITE_QUERY_TYPE
  );
}

/** Section named by a step, falling back to the competitive-intelligence default. */
export function readAccountLibrarySection(
  inputs: Record<string, unknown> | undefined | null,
): string {
  const section = inputs?.section;
  if (typeof section === 'string' && section.trim()) return normalizeSection(section);
  return COMPETITIVE_INTELLIGENCE_SECTION;
}

/** Entry title named by a step, falling back to a section-derived default. */
export function readAccountLibraryEntryTitle(
  inputs: Record<string, unknown> | undefined | null,
): string {
  const title = inputs?.entry_title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return `${readAccountLibrarySection(inputs)} snapshot`;
}
