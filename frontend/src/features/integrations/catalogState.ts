/**
 * One reader for `/api/integrations/catalog`, shared by the public connect page
 * and the in-workspace integrations command center.
 *
 * The catalog is the only endpoint that reports live connection state together
 * with the server's own "I could not tell" flag (`partner.degraded`), so both
 * surfaces must read it the same way — a second, subtly different parser is how
 * one surface ends up claiming a connection the other denies.
 *
 * FEATURE DETECTION IS THE POINT OF THIS FILE. A parallel backend lane is adding
 * per-source capability, pending connections, and the Drive library block. None
 * of them are deployed yet, so every reader here returns an explicit
 * "not reported" value rather than a fabricated one, and the UI renders those
 * sections only when the server actually speaks them. Shipping ahead of the
 * backend must never invent a green check.
 */

// Explicit `.ts` specifiers (allowed by `allowImportingTsExtensions` in
// tsconfig) so the Node contract test can import this module directly, the same
// convention `onboarding/guidedStart.ts` follows.
import { getWorkspaceRequest } from '../../lib/workspace.ts';
import { normalizeToolkitSlug, resolveToolkitSlug } from './partnerToolkits.ts';

export interface PartnerApp {
  name: string;
  label: string;
  detail: string;
  status?: string;
  /** Present on the newer catalog shape; absent on already-deployed servers. */
  partnerAppName?: string;
  sources?: string[];
}

/** `providers[]` — the full catalog including natively-connected systems. */
export interface CatalogProvider {
  id: string;
  label: string;
  detail?: string;
  description?: string;
  category?: string;
  status?: string;
  connectionMethod?: 'native' | 'partner' | 'manual' | 'internal';
  partnerAppName?: string;
  capabilities?: string[];
  boundaries?: string[];
}

/**
 * Per-source capability verdict. A source can be CONNECTED BUT INSUFFICIENT —
 * Drive connected with read-only scopes still fails a mission that writes — so
 * `connected` alone is never enough to render a green check.
 */
export interface SourceCapability {
  connected: boolean;
  capabilities: string[];
  missing: string[];
  sufficientFor: string[];
}

/** A connection the user started and abandoned before the OAuth tab finished. */
export interface PendingConnection {
  /** Stable id for cancelling; falls back to the app name when absent. */
  id: string;
  appName: string;
  label: string;
  /** Resume link when the server kept one; empty means "start a fresh connect". */
  redirectUrl: string;
  startedAt: string;
}

/** The Drive-backed intelligence library the recurring missions read and write. */
export interface IntegrationLibrary {
  provisioned: boolean;
  folderId: string;
  folderUrl: string;
  entryCount: number | null;
  lastEntryAt: string;
}

export type ConnectState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      enabled: boolean;
      degraded: boolean;
      connectedApps: string[];
      apps: PartnerApp[];
      providers: CatalogProvider[];
      /**
       * Keyed by BOTH the raw key the server used and its resolved toolkit
       * slug, so a lookup works whether the backend keys by source id
       * (`google_drive`) or toolkit slug (`googledrive`).
       * Empty map = the server does not report capability yet.
       */
      capability: Record<string, SourceCapability>;
      /** Empty = not reported. Never conflate with "no pending connections". */
      pending: PendingConnection[];
      /** null = not reported by this server. */
      library: IntegrationLibrary | null;
    };

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCapabilityEntry(value: unknown): SourceCapability | null {
  if (!isRecord(value)) return null;
  // `connected` is the one field that must be explicit. A capability block that
  // omits it says nothing usable, and guessing `true` is exactly the failure
  // this whole surface exists to prevent.
  if (typeof value.connected !== 'boolean') return null;
  return {
    connected: value.connected,
    capabilities: readStringArray(value.capabilities),
    missing: readStringArray(value.missing),
    sufficientFor: readStringArray(value.sufficientFor),
  };
}

/**
 * Capability may arrive keyed off `partner.capability`, `partner.capabilities`,
 * a top-level `capability`, or inline on each partner app. Every placement is
 * read into one map so the UI never has to know which deploy it is talking to.
 */
export function readCapabilityMap(payload: unknown): Record<string, SourceCapability> {
  const out: Record<string, SourceCapability> = {};
  if (!isRecord(payload)) return out;

  const partner = isRecord(payload.partner) ? payload.partner : {};
  const candidates: unknown[] = [
    partner.capability,
    partner.capabilities,
    payload.capability,
    payload.sourceCapabilities,
  ];

  const absorb = (key: string, raw: unknown) => {
    const entry = readCapabilityEntry(raw);
    if (!entry) return;
    for (const alias of [normalizeToolkitSlug(key), resolveToolkitSlug(key)]) {
      if (alias && !out[alias]) out[alias] = entry;
    }
  };

  for (const candidate of candidates) {
    // `providers[].capabilities` is a string[] of prose; only an object map is
    // a capability report.
    if (!isRecord(candidate)) continue;
    for (const [key, raw] of Object.entries(candidate)) absorb(key, raw);
  }

  const apps = Array.isArray(partner.apps) ? partner.apps : [];
  for (const app of apps) {
    if (!isRecord(app)) continue;
    if (!readCapabilityEntry(app.capability)) continue;
    absorb(readString(app.name), app.capability);
    for (const source of readStringArray(app.sources)) absorb(source, app.capability);
  }

  return out;
}

/** Pending connections, tolerant of the field names the backend lane may pick. */
export function readPendingConnections(payload: unknown): PendingConnection[] {
  if (!isRecord(payload)) return [];
  const partner = isRecord(payload.partner) ? payload.partner : {};
  const raw = Array.isArray(partner.pending)
    ? partner.pending
    : Array.isArray(payload.pending)
      ? payload.pending
      : [];

  return raw
    .map((entry): PendingConnection | null => {
      if (!isRecord(entry)) return null;
      const appName =
        readString(entry.appName) || readString(entry.toolkit) || readString(entry.name);
      if (!appName) return null;
      const id = readString(entry.id) || readString(entry.connectionRequestId) || appName;
      return {
        id,
        appName,
        label: readString(entry.label) || appName,
        redirectUrl: readString(entry.redirectUrl) || readString(entry.resumeUrl),
        startedAt: readString(entry.startedAt) || readString(entry.createdAt),
      };
    })
    .filter((entry): entry is PendingConnection => entry !== null);
}

const DRIVE_FOLDER_URL_PREFIX = 'https://drive.google.com/drive/folders/';

/** The Drive library block. `null` means the server does not report it yet. */
export function readLibrary(payload: unknown): IntegrationLibrary | null {
  if (!isRecord(payload)) return null;
  const partner = isRecord(payload.partner) ? payload.partner : {};
  const raw = isRecord(payload.library)
    ? payload.library
    : isRecord(partner.library)
      ? partner.library
      : null;
  if (!raw) return null;

  const folderId = readString(raw.folderId);
  const explicitUrl = readString(raw.folderUrl) || readString(raw.webViewLink);
  return {
    provisioned: raw.provisioned === true,
    folderId,
    folderUrl: explicitUrl || (folderId ? `${DRIVE_FOLDER_URL_PREFIX}${folderId}` : ''),
    entryCount: typeof raw.entryCount === 'number' ? raw.entryCount : null,
    lastEntryAt: readString(raw.lastEntryAt),
  };
}

export async function fetchConnectState(): Promise<ConnectState> {
  try {
    // Workspace-scoped: a multi-workspace operator must see the catalog for the
    // workspace they are actually in, not their default one.
    const request = getWorkspaceRequest('/api/integrations/catalog');
    const response = await fetch(request.url, { credentials: 'same-origin', headers: request.headers });
    if (response.status === 401 || response.status === 403) return { kind: 'anonymous' };
    if (!response.ok) return { kind: 'unavailable' };

    const data = await response.json() as {
      partner?: {
        enabled?: boolean;
        connectedApps?: string[];
        degraded?: boolean;
        apps?: PartnerApp[];
      };
      partnerApps?: PartnerApp[];
      providers?: CatalogProvider[];
    };

    // Feature-detect: the newer contract nests apps under `partner`, while
    // already-deployed servers return a top-level `partnerApps` array.
    const partner = data.partner;
    const apps = Array.isArray(partner?.apps)
      ? partner.apps
      : Array.isArray(data.partnerApps) ? data.partnerApps : [];

    return {
      kind: 'ready',
      enabled: Boolean(partner?.enabled),
      degraded: partner?.degraded === true,
      connectedApps: Array.isArray(partner?.connectedApps) ? partner.connectedApps : [],
      apps,
      providers: Array.isArray(data.providers) ? data.providers : [],
      capability: readCapabilityMap(data),
      pending: readPendingConnections(data),
      library: readLibrary(data),
    };
  } catch {
    return { kind: 'unavailable' };
  }
}
