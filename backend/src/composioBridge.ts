/**
 * Composio Bridge — turns Composio's pre-built integrations into tools
 * Violema can call. Activated by setting COMPOSIO_API_KEY in the environment.
 *
 * When inactive, every helper here returns false / null gracefully so the rest
 * of the backend keeps working with native + mock tools.
 *
 * See docs/INTEGRATIONS_ARCHITECTURE.md for the full strategy.
 */

const DEFAULT_COMPOSIO_BASE_URL = 'https://backend.composio.dev';

interface ComposioRequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | string[] | undefined>;
}

interface ComposioConnectedAccountListResponse {
  items?: Array<Record<string, unknown>>;
}

interface ComposioAuthConfigListResponse {
  items?: Array<Record<string, unknown>>;
}

interface ComposioLinkResponse {
  redirect_url?: string;
  redirectUrl?: string;
}

interface ComposioToolExecutionResponse {
  data?: unknown;
  error?: unknown;
  successful?: boolean;
}

const COMPOSIO_TOOLKIT_SLUG_ALIASES: Record<string, string> = {
  google_calendar: 'googlecalendar',
  googlecalendar: 'googlecalendar',
  calendar: 'googlecalendar',
  google_drive: 'googledrive',
  googledrive: 'googledrive',
  drive: 'googledrive',
  gmail: 'gmail',
  email: 'gmail',
};

const ACTION_TOOLKIT_ALIASES: Record<string, string> = {
  GMAIL: 'gmail',
  GOOGLECALENDAR: 'googlecalendar',
  GOOGLEDRIVE: 'googledrive',
};

function getComposioApiKey(): string | null {
  const apiKey = process.env.COMPOSIO_API_KEY;
  return typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : null;
}

function getComposioBaseUrl(): string {
  const configured = process.env.COMPOSIO_BASE_URL;
  return (typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : DEFAULT_COMPOSIO_BASE_URL).replace(/\/+$/, '');
}

function appendQueryParams(url: URL, query: NonNullable<ComposioRequestOptions['query']>) {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function composioRequest<T>(
  path: string,
  options: ComposioRequestOptions = {},
): Promise<T> {
  const apiKey = getComposioApiKey();
  if (!apiKey) {
    throw new Error('Composio is not configured. Set COMPOSIO_API_KEY to enable.');
  }

  const url = new URL(path, `${getComposioBaseUrl()}/`);
  if (options.query) appendQueryParams(url, options.query);

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`Composio request failed with HTTP ${response.status} for ${path}.`);
  }

  return data as T;
}

export function isComposioEnabled(): boolean {
  return getComposioApiKey() !== null;
}

/**
 * Composio actions are namespaced like `SLACK_SEND_MESSAGE`, `GITHUB_CREATE_ISSUE`,
 * etc. We treat any tool whose name matches this convention as a Composio call.
 */
export function isComposioToolName(name: string): boolean {
  return /^[A-Z][A-Z_]*_[A-Z][A-Z_]*$/.test(name);
}

export function normalizeComposioAppName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function toComposioToolkitSlug(value: string) {
  const normalized = normalizeComposioAppName(value);
  return COMPOSIO_TOOLKIT_SLUG_ALIASES[normalized] || normalized.replace(/_/g, '');
}

function getToolkitSlugForAction(actionName: string) {
  const prefix = actionName.split('_')[0] || '';
  return ACTION_TOOLKIT_ALIASES[prefix] || prefix.toLowerCase();
}

function getToolkitVersion(actionName: string) {
  const toolkitSlug = getToolkitSlugForAction(actionName);
  const envKey = `COMPOSIO_TOOLKIT_VERSION_${toolkitSlug.toUpperCase()}`;
  return process.env[envKey] || process.env.COMPOSIO_TOOLKIT_VERSION || 'latest';
}

function readStringField(record: Record<string, unknown>, ...fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readToolkitSlug(record: Record<string, unknown>) {
  const toolkit = record.toolkit;
  if (toolkit && typeof toolkit === 'object' && !Array.isArray(toolkit)) {
    const slug = readStringField(toolkit as Record<string, unknown>, 'slug', 'name');
    if (slug) return toComposioToolkitSlug(slug);
  }

  const slug = readStringField(record, 'toolkit_slug', 'toolkitSlug', 'appName', 'app_name');
  return slug ? toComposioToolkitSlug(slug) : null;
}

function unwrapToolExecutionResponse(response: unknown): unknown {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return response;
  }

  const execution = response as ComposioToolExecutionResponse;
  if (execution.successful === false || execution.error) {
    throw new Error('Composio action failed.');
  }

  return Object.prototype.hasOwnProperty.call(execution, 'data')
    ? execution.data
    : response;
}

function isActiveConnectedAccount(record: Record<string, unknown>) {
  const status = readStringField(record, 'status');
  const disabled = record.is_disabled ?? record.isDisabled;
  return status === 'ACTIVE' && disabled !== true;
}

async function getOrCreateAuthConfigId(toolkitSlug: string): Promise<string | null> {
  const existing = await composioRequest<ComposioAuthConfigListResponse>('/api/v3.1/auth_configs', {
    query: {
      toolkit_slug: toolkitSlug,
      is_composio_managed: true,
      show_disabled: false,
      limit: 10,
    },
  });

  const existingId = existing.items
    ?.map((item) => readStringField(item, 'id', 'nanoid'))
    .find(Boolean);
  if (existingId) return existingId;

  const created = await composioRequest<Record<string, unknown>>('/api/v3.1/auth_configs', {
    method: 'POST',
    body: {
      toolkit: { slug: toolkitSlug },
      auth_config: {
        type: 'use_composio_managed_auth',
        name: `${toolkitSlug} Auth Config`,
      },
    },
  });

  return readStringField(created, 'id', 'nanoid');
}

export interface ComposioExecutionContext {
  /** Stable per-workspace identifier — Composio uses this to look up OAuth credentials. */
  entityId: string;
}

/**
 * Execute a Composio action on behalf of the entity (user/workspace).
 * The entity must have already connected the relevant integration via Composio's
 * hosted OAuth flow.
 */
export async function executeComposioAction(
  actionName: string,
  input: Record<string, unknown>,
  ctx: ComposioExecutionContext,
): Promise<unknown> {
  const response = await composioRequest(`/api/v3.1/tools/execute/${encodeURIComponent(actionName)}`, {
    method: 'POST',
    body: {
      arguments: input,
      user_id: ctx.entityId,
      version: getToolkitVersion(actionName),
    },
  });
  return unwrapToolExecutionResponse(response);
}

/**
 * Build a stub OAuth-style URL where the user can connect a Composio integration.
 * Composio handles the actual OAuth UI — we just hand them the redirect.
 */
export async function getComposioConnectionUrl(
  appName: string,
  ctx: ComposioExecutionContext,
): Promise<string | null> {
  try {
    const toolkitSlug = toComposioToolkitSlug(appName);
    const authConfigId = await getOrCreateAuthConfigId(toolkitSlug);
    if (!authConfigId) return null;

    const connection = await composioRequest<ComposioLinkResponse>('/api/v3.1/connected_accounts/link', {
      method: 'POST',
      body: {
        auth_config_id: authConfigId,
        user_id: ctx.entityId,
      },
    });
    return connection.redirect_url ?? connection.redirectUrl ?? null;
  } catch (err) {
    console.error(`[composio] connection init failed for ${appName}:`, err);
    return null;
  }
}

/**
 * Returns the apps this entity has currently connected (active integrations).
 * Used by the /integrations page to show "Connected ✓" badges.
 */
export async function listConnectedApps(ctx: ComposioExecutionContext): Promise<string[]> {
  if (!isComposioEnabled()) return [];

  try {
    const connections = await composioRequest<ComposioConnectedAccountListResponse>(
      '/api/v3.1/connected_accounts',
      {
        query: {
          user_ids: [ctx.entityId],
          statuses: ['ACTIVE'],
          account_type: 'ALL',
          limit: 100,
        },
      },
    );

    const apps = new Set<string>();
    for (const item of connections.items || []) {
      if (!isActiveConnectedAccount(item)) continue;
      const slug = readToolkitSlug(item);
      if (slug) apps.add(slug);
    }

    return Array.from(apps);
  } catch (err) {
    console.error('[composio] listConnectedApps failed:', err);
    return [];
  }
}
