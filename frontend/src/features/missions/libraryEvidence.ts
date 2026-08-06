// Explicit `.ts` specifier (allowed here by `allowImportingTsExtensions` in
// tsconfig) so the Node contract test can import this module directly,
// matching reviewQueue.ts and evidenceLink.ts.
import { evidenceHref } from './evidenceLink.ts';
import type { MissionEvidenceItem } from './types';

/**
 * Evidence receipts for the account library's swept files.
 *
 * Library-read query artifacts carry an `AccountLibrarySnapshot` (see
 * `backend/src/integrationGateway/accountLibrary.ts`): `entries[]` with
 * `fileName`, `webViewLink`, and an `origin` that is `operator_file` for
 * files the folder-drop sweep pulled from the customer's own Drive folder,
 * or `app_entry` for files surfaced through the workspace's own
 * Composio-connected Drive integration. `origin` is absent on entries read
 * before the sweep existed (legacy). Only an operator-swept file earns the
 * "your Violema Library" suffix -- it is the one kind of evidence a reviewer
 * would not otherwise know Violema itself filed away, rather than a
 * connected integration surfacing it.
 */

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function librarySlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'file';
}

/**
 * Recognizes an `AccountLibrarySnapshot`-shaped record, whether passed
 * directly or nested under a query payload's `data` key (the shape
 * `executeQueryData` returns for `account_library` reads). `rootFolderName`
 * plus an `entries` array is treated as the fingerprint, so an unrelated
 * payload that merely happens to carry some other `entries` array is not
 * misread as a library snapshot. Returns `undefined` when the value is not
 * library-shaped.
 */
export function readLibrarySnapshotEntries(value: unknown): unknown[] | undefined {
  const record = readRecord(value);
  if (!record) return undefined;

  if (Array.isArray(record.entries) && readString(record.rootFolderName)) {
    return record.entries;
  }

  const nested = readRecord(record.data);
  if (nested && Array.isArray(nested.entries) && readString(nested.rootFolderName)) {
    return nested.entries;
  }

  return undefined;
}

/**
 * Maps one library entry to an evidence item. A `fileName`-less entry is
 * dropped -- it cannot even be labeled, so it is not usable evidence.
 */
export function libraryEvidenceItem(
  entry: unknown,
  fallbackSource: string,
  idPrefix: string,
  index: number,
): MissionEvidenceItem | undefined {
  const record = readRecord(entry);
  const fileName = record ? readString(record.fileName) : undefined;
  if (!fileName) return undefined;

  const isOperatorFile = record?.origin === 'operator_file';
  const label = isOperatorFile ? `${fileName} (your Violema Library)` : fileName;
  const webViewLink = readString(record?.webViewLink);

  return {
    id: `${idPrefix}-${index + 1}-${librarySlug(fileName)}`,
    label,
    source: fallbackSource,
    detail: isOperatorFile
      ? 'Swept from your Violema Library folder-drop.'
      : 'Read from the connected account library.',
    href: evidenceHref(webViewLink) ?? undefined,
  };
}

/** Every named library entry as an evidence item, in sweep order. */
export function libraryEvidenceItems(
  entries: readonly unknown[],
  fallbackSource: string,
  idPrefix: string,
): MissionEvidenceItem[] {
  return entries
    .map((entry, index) => libraryEvidenceItem(entry, fallbackSource, idPrefix, index))
    .filter((item): item is MissionEvidenceItem => Boolean(item));
}
