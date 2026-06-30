import { getIntegrationCredential } from '../../settingsStore';
import type {
  IntegrationQueryResult,
  IntegrationReadinessError,
} from '../types';

export type GoogleDriveQueryType = 'recent_docs' | 'investor_materials' | 'board_packet_sources';

export type GoogleDriveFetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface QueryGoogleDriveInput {
  workspaceId: string;
  workflowId?: string;
  queryType: string;
  filters?: Record<string, unknown>;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  fetchLike?: GoogleDriveFetchLike;
  now?: Date;
}

export interface GoogleDriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  modifiedTime: string | null;
}

export interface GoogleDriveQueryData {
  providerRoute: string;
  total: number;
  items: GoogleDriveFileItem[];
  warnings?: string[];
}

interface GoogleDriveApiFile {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
}

const DRIVE_METADATA_FIELDS = 'files(id,name,mimeType,webViewLink,modifiedTime),nextPageToken';

const DRIVE_QUERY_HINTS: Record<GoogleDriveQueryType, string> = {
  recent_docs: [
    "mimeType = 'application/vnd.google-apps.document'",
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "mimeType = 'application/vnd.google-apps.presentation'",
  ].join(' or '),
  investor_materials: [
    'name contains "investor"',
    'name contains "fundraising"',
    'name contains "deck"',
    'name contains "metrics"',
    'name contains "update"',
  ].join(' or '),
  board_packet_sources: [
    'name contains "board packet"',
    'name contains "board deck"',
    'name contains "investor update"',
    'name contains "meeting prep"',
  ].join(' or '),
};

function readWorkflowId(value?: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'weekly-founder-brief';
}

function providerRoute(workflowId = 'weekly-founder-brief') {
  return `/integrations?provider=google_drive&workflow=${encodeURIComponent(readWorkflowId(workflowId))}`;
}

function readinessError(message: string, workflowId?: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'integration_not_ready',
    source: 'google_drive',
    workflowId: readWorkflowId(workflowId),
    message,
    nextAction: {
      label: 'Connect Google Drive',
      route: providerRoute(workflowId),
    },
  };
}

function unsupportedQuery(queryType: string, workflowId?: string): IntegrationReadinessError {
  return {
    ok: false,
    code: 'unsupported_query',
    source: 'google_drive',
    workflowId: readWorkflowId(workflowId),
    message: `Google Drive query "${queryType}" is not supported yet. Use "recent_docs", "investor_materials", or "board_packet_sources".`,
    nextAction: {
      label: 'Connect Google Drive',
      route: providerRoute(workflowId),
    },
  };
}

function driveHttpError(status: number, workflowId?: string): IntegrationReadinessError {
  if (status === 401) {
    return {
      ok: false,
      code: 'integration_auth_expired',
      source: 'google_drive',
      workflowId: readWorkflowId(workflowId),
      message: 'Google Drive credentials are no longer valid for this workspace.',
      nextAction: { label: 'Reconnect Google Drive', route: providerRoute(workflowId) },
    };
  }

  if (status === 403) {
    return {
      ok: false,
      code: 'integration_scope_missing',
      source: 'google_drive',
      workflowId: readWorkflowId(workflowId),
      message: 'Google Drive access does not include the metadata scope required for this read.',
      nextAction: { label: 'Reconnect Google Drive', route: providerRoute(workflowId) },
    };
  }

  if (status === 429) {
    return {
      ok: false,
      code: 'integration_rate_limited',
      source: 'google_drive',
      workflowId: readWorkflowId(workflowId),
      message: 'Google Drive rate limit reached. Please retry after the window resets.',
      nextAction: { label: 'Review Google Drive', route: providerRoute(workflowId) },
    };
  }

  if (status >= 500) {
    return {
      ok: false,
      code: 'integration_unavailable',
      source: 'google_drive',
      workflowId: readWorkflowId(workflowId),
      message: 'Google Drive is temporarily unavailable.',
      nextAction: { label: 'Review Google Drive', route: providerRoute(workflowId) },
    };
  }

  return {
    ok: false,
    code: 'integration_query_failed',
    source: 'google_drive',
    workflowId: readWorkflowId(workflowId),
    message: 'Google Drive request failed. Review the integration connection and try again.',
    nextAction: { label: 'Review Google Drive', route: providerRoute(workflowId) },
  };
}

function readPositiveInteger(value: unknown, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined;
  return Math.min(value, max);
}

function buildDriveUrl(queryType: GoogleDriveQueryType, filters?: Record<string, unknown>) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('pageSize', String(readPositiveInteger(filters?.pageSize ?? filters?.limit, 50) || 25));
  url.searchParams.set('fields', DRIVE_METADATA_FIELDS);
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('q', `(${DRIVE_QUERY_HINTS[queryType]}) and trashed = false`);
  return url.toString();
}

function normalizeFile(item: GoogleDriveApiFile): GoogleDriveFileItem {
  return {
    id: item.id || '',
    name: item.name || '',
    mimeType: item.mimeType || '',
    url: item.webViewLink || '',
    modifiedTime: item.modifiedTime || null,
  };
}

function parseFiles(payload: unknown) {
  if (!payload || typeof payload !== 'object') return [];
  const files = (payload as { files?: unknown[] }).files;
  if (!Array.isArray(files)) return [];
  return files.map((item) => normalizeFile(item as GoogleDriveApiFile));
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveCredential(input: QueryGoogleDriveInput, field: 'accessToken' | 'refreshToken' | 'clientId' | 'clientSecret') {
  if (input[field]?.trim()) return input[field]?.trim();

  if (field === 'clientId') return getEnv('GOOGLE_DRIVE_CLIENT_ID') || getEnv('GOOGLE_CLIENT_ID');
  if (field === 'clientSecret') return getEnv('GOOGLE_DRIVE_CLIENT_SECRET') || getEnv('GOOGLE_CLIENT_SECRET');

  return getIntegrationCredential(input.workspaceId, 'google_drive', field);
}

async function refreshAccessToken(input: QueryGoogleDriveInput, fetchLike: GoogleDriveFetchLike) {
  const refreshToken = resolveCredential(input, 'refreshToken');
  const clientId = resolveCredential(input, 'clientId');
  const clientSecret = resolveCredential(input, 'clientSecret');
  if (!refreshToken || !clientId || !clientSecret) return undefined;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetchLike('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) return undefined;

  const payload = await response.json();
  const accessToken = (payload as { access_token?: unknown }).access_token;
  return typeof accessToken === 'string' && accessToken.trim() ? accessToken.trim() : undefined;
}

async function resolveAccessToken(input: QueryGoogleDriveInput, fetchLike: GoogleDriveFetchLike) {
  const accessToken = resolveCredential(input, 'accessToken');
  if (accessToken) return accessToken;
  return refreshAccessToken(input, fetchLike);
}

const defaultFetch: GoogleDriveFetchLike = (url, init) => fetch(url, init);

export async function queryGoogleDrive(
  input: QueryGoogleDriveInput,
): Promise<IntegrationQueryResult<GoogleDriveQueryData>> {
  const queryType = input.queryType as GoogleDriveQueryType;
  if (!DRIVE_QUERY_HINTS[queryType]) return unsupportedQuery(input.queryType, input.workflowId);

  const now = input.now || new Date();
  const startedAt = Date.now();
  const fetchLike = input.fetchLike || defaultFetch;
  const accessToken = await resolveAccessToken(input, fetchLike);
  if (!accessToken) {
    return readinessError('Google Drive read credentials are required before this workflow can read selected document source material.', input.workflowId);
  }

  try {
    const response = await fetchLike(buildDriveUrl(queryType, input.filters), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return driveHttpError(response.status, input.workflowId);

    const items = parseFiles(await response.json());
    return {
      ok: true,
      source: 'google_drive',
      query_type: input.queryType,
      data: {
        providerRoute: providerRoute(input.workflowId),
        total: items.length,
        items,
      },
      fetched_at: now.toISOString(),
      latency_ms: Date.now() - startedAt,
      cache_hit: false,
      live: true,
    };
  } catch {
    return {
      ok: false,
      code: 'integration_query_failed',
      source: 'google_drive',
      workflowId: readWorkflowId(input.workflowId),
      message: 'Google Drive request failed. Review the integration connection and try again.',
      nextAction: { label: 'Review Google Drive', route: providerRoute(input.workflowId) },
    };
  }
}
