// Native, zero-dependency Google Drive reader for the platform service-account
// lane. Operators share a Drive folder with a service account Violema
// controls; this module authenticates as that account (RS256 JWT bearer
// grant, hand-rolled — no googleapis, no google-auth-library) and performs a
// small, bounded set of read-only Drive REST calls.
//
// Deliberately dependency-free: node:crypto, node:fs, process.env, and an
// injectable fetch only. Every failure mode collapses into DriveReaderError
// with a message that never embeds key material — the private key is used
// solely as an argument to crypto.sign and is never interpolated into any
// string this module produces.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

export interface DriveReaderConfig {
  clientEmail: string;
  privateKey: string;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: number;
  webViewLink?: string;
  /**
   * The folder this file was listed under. Attribution, not decoration: a
   * caller that can only reconcile SOME folders against a second listing
   * needs to know which files it is entitled to judge.
   */
  parentFolderId?: string;
}

/**
 * `truncated` is true when the page budget cut the walk short — either a
 * folder's own pagination stopped mid-way, or folders were still queued when
 * the budget ran out. Callers must be able to tell "the operator has no other
 * files" apart from "we did not look".
 */
export interface DriveFolderTree {
  files: DriveFileMeta[];
  truncated: boolean;
}

export interface DriveReader {
  /** ≤3 pages total across the whole call; folders recursed breadth-first within the page budget. Reports its own truncation. */
  listFolderTree(rootFolderId: string): Promise<DriveFolderTree>;
  /** Refuses > 5 MB via Content-Length and a buffered running count. */
  downloadFile(fileId: string): Promise<Buffer>;
  /** files.export as text/plain (for Google Docs/Sheets/Slides). Same 5 MB ceiling as `downloadFile`. */
  exportDoc(fileId: string): Promise<string>;
}

type DriveReaderErrorCode = 'auth_failed' | 'http_error' | 'too_large' | 'timeout';

export class DriveReaderError extends Error {
  code: DriveReaderErrorCode;
  status?: number;

  constructor(code: DriveReaderErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'DriveReaderError';
    this.code = code;
    this.status = status;
  }
}

export const DRIVE_READER_MAX_LIST_PAGES = 3;
export const DRIVE_READER_MAX_DOWNLOAD_BYTES = 5_000_000;

export type DriveReaderFetch = typeof fetch;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_SKEW_MS = 60_000;
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

// --- config -----------------------------------------------------------------

interface RawServiceAccountKey {
  client_email?: unknown;
  private_key?: unknown;
}

/** Escaped `\n` sequences arrive when a key is hand-pasted into env JSON rather than round-tripped through JSON.stringify. */
function normalizePrivateKey(key: string): string {
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

function configFromRaw(raw: unknown): DriveReaderConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const { client_email, private_key } = raw as RawServiceAccountKey;
  if (typeof client_email !== 'string' || !client_email.trim()) return null;
  if (typeof private_key !== 'string' || !private_key.trim()) return null;
  return { clientEmail: client_email, privateKey: normalizePrivateKey(private_key) };
}

/**
 * Never throws. `GOOGLE_LIBRARY_READER_KEY` (inline JSON) wins over
 * `GOOGLE_LIBRARY_READER_KEY_FILE` (a path read via fs.readFileSync). Any
 * missing, malformed, or incomplete config simply means the lane is not
 * configured — this returns null, never a boot crash.
 */
export function readDriveReaderConfig(env: NodeJS.ProcessEnv = process.env): DriveReaderConfig | null {
  const inline = env.GOOGLE_LIBRARY_READER_KEY?.trim();
  if (inline) {
    try {
      return configFromRaw(JSON.parse(inline));
    } catch {
      return null;
    }
  }

  const filePath = env.GOOGLE_LIBRARY_READER_KEY_FILE?.trim();
  if (filePath) {
    try {
      const contents = fs.readFileSync(filePath, 'utf-8');
      return configFromRaw(JSON.parse(contents));
    } catch {
      return null;
    }
  }

  return null;
}

// --- JWT + token exchange ----------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Module-level so a single warm token is reused across every DriveReader
// instance for the same service account, not just within one instance.
const tokenCache = new Map<string, CachedToken>();

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64url');
}

function signAssertion(config: DriveReaderConfig, iat: number): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: config.clientEmail,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + DEFAULT_TOKEN_TTL_SECONDS,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  // config.privateKey is consumed only here; never placed into a string we throw or log.
  // crypto.sign throws a raw OpenSSL error (e.g. "error:1E08010C:DECODER
  // routines::unsupported") for a malformed/truncated PEM — that must never
  // escape as-is, since some OpenSSL error variants can echo fragments of
  // the input. Collapse to a generic, key-free DriveReaderError instead.
  let signature: Buffer;
  try {
    signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf-8'), config.privateKey);
  } catch {
    throw new DriveReaderError(
      'auth_failed',
      'Drive service-account private key could not be used to sign the auth token (check its format)',
    );
  }
  return `${signingInput}.${base64url(signature)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchAccessToken(config: DriveReaderConfig, fetchImpl: DriveReaderFetch): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(config.clientEmail);
  if (cached && cached.expiresAt - TOKEN_EXPIRY_SKEW_MS > now) {
    return cached.accessToken;
  }

  const iat = Math.floor(now / 1000);
  const assertion = signAssertion(config, iat);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new DriveReaderError('timeout', `Drive service-account token request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new DriveReaderError('auth_failed', `Drive service-account token request failed: ${messageOf(error)}`);
  }

  if (!response.ok) {
    throw new DriveReaderError(
      'auth_failed',
      `Drive service-account token request failed with status ${response.status}`,
      response.status,
    );
  }

  let payload: { access_token?: string; expires_in?: number };
  try {
    payload = (await response.json()) as { access_token?: string; expires_in?: number };
  } catch (error) {
    throw new DriveReaderError('auth_failed', `Drive service-account token response was not valid JSON: ${messageOf(error)}`);
  }
  if (!payload.access_token) {
    throw new DriveReaderError('auth_failed', 'Drive service-account token response did not include an access_token');
  }

  const ttlSeconds = payload.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS;
  tokenCache.set(config.clientEmail, {
    accessToken: payload.access_token,
    expiresAt: now + ttlSeconds * 1000,
  });

  return payload.access_token;
}

// --- bounded HTTP helper ------------------------------------------------------

async function timedFetch(
  fetchImpl: DriveReaderFetch,
  url: string,
  accessToken: string,
  contextLabel: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new DriveReaderError('timeout', `${contextLabel} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new DriveReaderError('http_error', `${contextLabel} failed: ${messageOf(error)}`);
  }

  if (!response.ok) {
    throw new DriveReaderError('http_error', `${contextLabel} failed with status ${response.status}`, response.status);
  }

  return response;
}

// --- listFolderTree ------------------------------------------------------------

interface RawDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: string; // Drive API returns size as a decimal string.
  webViewLink?: string;
}

interface RawFilesListResponse {
  files?: RawDriveFile[];
  nextPageToken?: string;
}

function toFileMeta(file: RawDriveFile, parentFolderId: string): DriveFileMeta {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    md5Checksum: file.md5Checksum,
    size: file.size !== undefined ? Number(file.size) : undefined,
    webViewLink: file.webViewLink,
    parentFolderId,
  };
}

async function fetchFolderPage(
  fetchImpl: DriveReaderFetch,
  accessToken: string,
  folderId: string,
  pageToken: string | undefined,
): Promise<RawFilesListResponse> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,modifiedTime,md5Checksum,size,webViewLink),nextPageToken',
    pageSize: '100',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const response = await timedFetch(fetchImpl, `${DRIVE_FILES_BASE}?${params.toString()}`, accessToken, 'Drive files.list request');
  try {
    return (await response.json()) as RawFilesListResponse;
  } catch (error) {
    throw new DriveReaderError('http_error', `Drive files.list response was not valid JSON: ${messageOf(error)}`);
  }
}

async function listFolderTreeImpl(
  fetchImpl: DriveReaderFetch,
  accessToken: string,
  rootFolderId: string,
): Promise<DriveFolderTree> {
  const files: DriveFileMeta[] = [];
  const queue: string[] = [rootFolderId];
  let pagesFetched = 0;
  let truncated = false;

  while (queue.length > 0 && pagesFetched < DRIVE_READER_MAX_LIST_PAGES) {
    const folderId = queue.shift() as string;
    let pageToken: string | undefined;

    do {
      const page = await fetchFolderPage(fetchImpl, accessToken, folderId, pageToken);
      pagesFetched += 1;

      for (const file of page.files || []) {
        files.push(toFileMeta(file, folderId));
        if (file.mimeType === FOLDER_MIME_TYPE) queue.push(file.id);
      }

      pageToken = page.nextPageToken;
    } while (pageToken && pagesFetched < DRIVE_READER_MAX_LIST_PAGES);

    // This folder still had pages left when the budget ran out.
    if (pageToken) truncated = true;
  }

  // Folders discovered but never visited.
  if (queue.length > 0) truncated = true;

  return { files, truncated };
}

// --- bounded body reading ---------------------------------------------------------

/**
 * `timedFetch` guarantees a DriveReaderError for anything that goes wrong
 * before the headers land. This is the same guarantee for everything that goes
 * wrong AFTER them.
 */
function asDriveReaderError(error: unknown, contextLabel: string): DriveReaderError {
  if (error instanceof DriveReaderError) return error;
  if (isAbortError(error)) {
    return new DriveReaderError(
      'timeout',
      `${contextLabel} timed out after ${REQUEST_TIMEOUT_MS}ms while reading the response body`,
    );
  }
  return new DriveReaderError(
    'http_error',
    `${contextLabel} failed while reading the response body: ${messageOf(error)}`,
  );
}

/**
 * Read a response body into a Buffer, bounded by
 * `DRIVE_READER_MAX_DOWNLOAD_BYTES`, with every failure collapsed into a
 * DriveReaderError.
 *
 * WHY THE CATCH IS LOAD-BEARING, NOT DEFENSIVE DECORATION
 *
 * `AbortSignal.timeout` covers body STREAMING, not merely the headers — so a
 * slow 4 MB PDF, or a connection dropped mid-body, throws HERE, long after
 * `timedFetch` handed back a perfectly healthy Response. A raw
 * `AbortError`/`TypeError: terminated` escaping this module reaches
 * `librarySweep.resolveFileText`, which deliberately RETHROWS anything that is
 * not a DriveReaderError (it treats those as bugs, not expected failure
 * modes). `sweepOperatorFiles` has no per-file catch, `readLibrary` catches
 * only LibrarySweepError, and the library-read step is `critical` severity —
 * so one unlucky dropped file would block an entire mission run instead of
 * degrading to a visible `contentError: 'content unreadable'` gap.
 */
async function readBoundedBody(
  response: Response,
  subject: string,
  contextLabel: string,
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > DRIVE_READER_MAX_DOWNLOAD_BYTES) {
    throw new DriveReaderError(
      'too_large',
      `${subject} declares ${declaredLength} bytes, exceeding the ${DRIVE_READER_MAX_DOWNLOAD_BYTES}-byte limit`,
    );
  }

  if (!response.body) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw asDriveReaderError(error, contextLabel);
    }
    if (buffer.byteLength > DRIVE_READER_MAX_DOWNLOAD_BYTES) {
      throw new DriveReaderError(
        'too_large',
        `${subject} is ${buffer.byteLength} bytes, exceeding the ${DRIVE_READER_MAX_DOWNLOAD_BYTES}-byte limit`,
      );
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.byteLength;
      if (total > DRIVE_READER_MAX_DOWNLOAD_BYTES) {
        throw new DriveReaderError(
          'too_large',
          `${subject} exceeded the ${DRIVE_READER_MAX_DOWNLOAD_BYTES}-byte limit while streaming`,
        );
      }
      chunks.push(chunk);
    }
  } catch (error) {
    // The `too_large` throw above lands here too. `asDriveReaderError` passes
    // an existing DriveReaderError through untouched, so the size verdict is
    // never re-labelled as a generic transport failure.
    throw asDriveReaderError(error, contextLabel);
  } finally {
    reader.cancel().catch(() => {});
  }

  return Buffer.concat(chunks);
}

// --- downloadFile --------------------------------------------------------------

async function downloadFileImpl(fetchImpl: DriveReaderFetch, accessToken: string, fileId: string): Promise<Buffer> {
  const contextLabel = 'Drive files.get (alt=media) request';
  const response = await timedFetch(
    fetchImpl,
    `${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}?alt=media`,
    accessToken,
    contextLabel,
  );
  return readBoundedBody(response, `Drive file ${fileId}`, contextLabel);
}

// --- exportDoc -------------------------------------------------------------------

async function exportDocImpl(fetchImpl: DriveReaderFetch, accessToken: string, fileId: string): Promise<string> {
  const contextLabel = 'Drive files.export request';
  const params = new URLSearchParams({ mimeType: 'text/plain' });
  const response = await timedFetch(
    fetchImpl,
    `${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}/export?${params.toString()}`,
    accessToken,
    contextLabel,
  );
  // Exports get the same byte ceiling downloads do: a Google Doc has no
  // Drive-reported `size`, so the pre-flight size check in the sweep cannot
  // screen it — this is the only bound on how much text an export can return.
  const buffer = await readBoundedBody(response, `Drive export of file ${fileId}`, contextLabel);
  return buffer.toString('utf8');
}

// --- factory ----------------------------------------------------------------

export function createDriveReader(config: DriveReaderConfig, fetchImpl: DriveReaderFetch = fetch): DriveReader {
  const getAccessToken = () => fetchAccessToken(config, fetchImpl);

  return {
    async listFolderTree(rootFolderId: string): Promise<DriveFolderTree> {
      const accessToken = await getAccessToken();
      return listFolderTreeImpl(fetchImpl, accessToken, rootFolderId);
    },

    async downloadFile(fileId: string): Promise<Buffer> {
      const accessToken = await getAccessToken();
      return downloadFileImpl(fetchImpl, accessToken, fileId);
    },

    async exportDoc(fileId: string): Promise<string> {
      const accessToken = await getAccessToken();
      return exportDocImpl(fetchImpl, accessToken, fileId);
    },
  };
}
