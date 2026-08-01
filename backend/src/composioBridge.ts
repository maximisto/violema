/**
 * Composio Bridge — turns Composio's pre-built integrations into tools
 * Claude can call. Activated by setting COMPOSIO_API_KEY in the environment.
 *
 * When inactive, every helper here returns false / null gracefully so the rest
 * of the backend keeps working with native + mock tools.
 *
 * See docs/INTEGRATIONS_ARCHITECTURE.md for the full strategy.
 */

export interface ComposioClientAdapter {
  tools: {
    execute(
      slug: string,
      body: {
        userId: string;
        arguments: Record<string, unknown>;
        dangerouslySkipVersionCheck: true;
      },
    ): Promise<unknown>;
  };
  authConfigs: {
    list(query: { toolkit: string }): Promise<{ items: Array<{ id: string }> }>;
    create(
      toolkitSlug: string,
      options: {
        type: 'use_composio_managed_auth';
        name: string;
      },
    ): Promise<{ id: string }>;
  };
  connectedAccounts: {
    link(
      userId: string,
      authConfigId: string,
      options: { allowMultiple: true; callbackUrl?: string },
    ): Promise<{ id?: string | null; redirectUrl?: string | null }>;
    list(query: {
      userIds: string[];
      statuses: Array<'ACTIVE'>;
      /** Page token from the previous response's `nextCursor`. Omit for page 1. */
      cursor?: string;
    }): Promise<{
      items: Array<{ id?: string | null; toolkit?: { slug?: string } | null }>;
      /** Present while more pages remain (`ConnectedAccountListResponseSchema`). */
      nextCursor?: string | null;
      totalPages?: number;
    }>;
    delete(nanoid: string): Promise<unknown>;
  };
}

/** A workspace's live connection to one toolkit, as Composio reports it. */
export interface ComposioConnectedAccount {
  id: string;
  toolkit: string;
}

/** What `link()` hands back: where to send the user, and the request to poll. */
export interface ComposioConnectionInit {
  redirectUrl: string | null;
  connectionRequestId?: string;
}

/**
 * Connected apps plus whether the lookup actually succeeded. An empty list with
 * `ok: false` means Composio was unreachable, which the UI must render as
 * "temporarily unavailable" rather than "nothing connected".
 */
export interface ComposioConnectedAppsResult {
  apps: string[];
  ok: boolean;
}

export type ComposioDisconnectResult =
  | { status: 'disconnected'; toolkit: string; removed: number }
  | { status: 'not_connected'; toolkit: string }
  | { status: 'failed'; toolkit: string; message: string };

export interface ComposioBridge {
  isEnabled(): boolean;
  executeAction(
    actionName: string,
    input: Record<string, unknown>,
    ctx: ComposioExecutionContext,
  ): Promise<unknown>;
  startConnection(
    appName: string,
    ctx: ComposioExecutionContext,
    options?: { callbackUrl?: string },
  ): Promise<ComposioConnectionInit>;
  listConnectedAccounts(
    ctx: ComposioExecutionContext,
  ): Promise<ComposioConnectedAccount[]>;
  listConnectedApps(ctx: ComposioExecutionContext): Promise<string[]>;
  disconnectApp(
    appName: string,
    ctx: ComposioExecutionContext,
  ): Promise<ComposioDisconnectResult>;
}

/** Composio toolkit slugs are lowercase alphanumeric; normalize loosely to match. */
function toToolkitSlug(appName: string): string {
  return appName.trim().toLowerCase();
}

/**
 * Upper bound on cursor pages walked for one connected-accounts read.
 *
 * A real workspace holds tens of accounts, not thousands, so this only trips on
 * a cursor that never terminates. Exceeding it throws rather than returning a
 * partial list: a truncated read is exactly the bug this pagination fixes —
 * it would let "disconnect all" leave an account behind while reporting
 * success, and would under-report readiness. Every caller already treats a
 * thrown lookup as fail-closed (degraded / `failed` / no connections).
 */
const MAX_CONNECTED_ACCOUNT_PAGES = 25;

export function createComposioBridge(
  client: ComposioClientAdapter | null,
): ComposioBridge {
  // Shared by listConnectedApps and disconnectApp. A free function rather than
  // `this.listConnectedAccounts` so a destructured method still works.
  //
  // Walks the cursor to exhaustion. `connectedAccounts.list` is paginated, and
  // reading only page one silently drops accounts: with `allowMultiple: true`
  // a second Gmail account can sit on page two, survive a "disconnect all",
  // and still authorise runs while the route answers `ok: true`.
  async function readConnectedAccounts(
    ctx: ComposioExecutionContext,
  ): Promise<ComposioConnectedAccount[]> {
    if (!client) return [];

    const accounts: ComposioConnectedAccount[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_CONNECTED_ACCOUNT_PAGES; page += 1) {
      const connections = await client.connectedAccounts.list({
        userIds: [ctx.entityId],
        statuses: ['ACTIVE'],
        ...(cursor ? { cursor } : {}),
      });

      for (const connection of connections.items) {
        const toolkit = connection.toolkit?.slug ?? '';
        if (!toolkit) continue;
        accounts.push({ id: connection.id ?? '', toolkit });
      }

      const nextCursor = connections.nextCursor ?? undefined;
      if (!nextCursor) return accounts;
      cursor = nextCursor;
    }

    throw new Error(
      `Composio returned more than ${MAX_CONNECTED_ACCOUNT_PAGES} pages of connected accounts; refusing to act on a partial list.`,
    );
  }

  return {
    isEnabled() {
      return client !== null;
    },

    async executeAction(actionName, input, ctx) {
      if (!client) {
        throw new Error('Composio is not configured. Set COMPOSIO_API_KEY to enable.');
      }

      return await client.tools.execute(actionName, {
        userId: ctx.entityId,
        arguments: input,
        // Violema accepts dynamic partner-tool names, so there is no single
        // toolkit version to pin at this boundary.
        dangerouslySkipVersionCheck: true,
      });
    },

    async startConnection(appName, ctx, options) {
      if (!client) return { redirectUrl: null };

      const toolkitSlug = toToolkitSlug(appName);
      const authConfigs = await client.authConfigs.list({ toolkit: toolkitSlug });
      let authConfigId = authConfigs.items[0]?.id;

      if (!authConfigId) {
        const authConfig = await client.authConfigs.create(toolkitSlug, {
          type: 'use_composio_managed_auth',
          name: `${toolkitSlug} Auth Config`,
        });
        authConfigId = authConfig.id;
      }

      const connection = await client.connectedAccounts.link(ctx.entityId, authConfigId, {
        allowMultiple: true,
        // Where Composio returns the user after their OAuth round trip. Always
        // a server-derived origin — never anything taken from the request.
        ...(options?.callbackUrl ? { callbackUrl: options.callbackUrl } : {}),
      });
      return {
        redirectUrl: connection.redirectUrl ?? null,
        ...(connection.id ? { connectionRequestId: connection.id } : {}),
      };
    },

    listConnectedAccounts: readConnectedAccounts,

    async listConnectedApps(ctx) {
      return (await readConnectedAccounts(ctx)).map((connection) => connection.toolkit);
    },

    async disconnectApp(appName, ctx) {
      const toolkit = toToolkitSlug(appName);
      if (!client) {
        return { status: 'failed', toolkit, message: 'Composio is not configured.' };
      }

      const matches = (await readConnectedAccounts(ctx)).filter(
        (connection) => connection.toolkit === toolkit && connection.id,
      );
      if (matches.length === 0) {
        return { status: 'not_connected', toolkit };
      }

      // A workspace can hold more than one active account per toolkit
      // (`allowMultiple: true` on link), so disconnect means all of them —
      // leaving one behind would keep the workflow silently readable.
      for (const match of matches) {
        await client.connectedAccounts.delete(match.id);
      }
      return { status: 'disconnected', toolkit, removed: matches.length };
    },
  };
}

type ComposioModule = {
  Composio: new (config: { apiKey: string }) => unknown;
};

// The backend compiles to CommonJS while the supported Composio SDK is
// ESM-only. Using native import here preserves lazy loading without converting
// the entire backend module system.
const importEsmModule = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<ComposioModule>;

let clientPromise: Promise<ComposioClientAdapter | null> | null = null;
let clientLoadFailed = false;

async function getClient(): Promise<ComposioClientAdapter | null> {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return null;
  if (clientPromise) return await clientPromise;

  clientPromise = (async () => {
    try {
      const { Composio } = await importEsmModule('@composio/core');
      const client = new Composio({ apiKey }) as ComposioClientAdapter;
      console.log('[composio] enabled');
      return client;
    } catch (err) {
      clientLoadFailed = true;
      console.error('[composio] failed to initialise:', err instanceof Error ? err.message : err);
      return null;
    }
  })();

  return await clientPromise;
}

export function isComposioEnabled(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY) && !clientLoadFailed;
}

/**
 * Composio actions are namespaced like `SLACK_SEND_MESSAGE`, `GITHUB_CREATE_ISSUE`,
 * etc. We treat any tool whose name matches this convention as a Composio call.
 */
export function isComposioToolName(name: string): boolean {
  return /^[A-Z][A-Z_]*_[A-Z][A-Z_]*$/.test(name);
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
  const bridge = createComposioBridge(await getClient());
  return await bridge.executeAction(actionName, input, ctx);
}

/**
 * Start a Composio OAuth flow for this entity. Composio hosts the consent UI —
 * we hand the caller the redirect plus the connection request id so a caller
 * that wants to can poll for completion.
 *
 * `callbackUrl` must always be derived from server configuration. Deriving it
 * from request headers would turn this endpoint into an open redirect.
 */
export async function startComposioConnection(
  appName: string,
  ctx: ComposioExecutionContext,
  options?: { callbackUrl?: string },
): Promise<ComposioConnectionInit> {
  try {
    const bridge = createComposioBridge(await getClient());
    return await bridge.startConnection(appName, ctx, options);
  } catch (err) {
    console.error(`[composio] connection init failed for ${appName}:`, err);
    return { redirectUrl: null };
  } finally {
    // The workspace's connection set is about to change. Drop the memo now so
    // the refetch that follows the OAuth round trip reads Composio, not a
    // snapshot taken before the user ever left for the consent screen.
    invalidatePartnerConnectionCache(ctx.entityId);
  }
}

const DEFAULT_PARTNER_CONNECTION_CACHE_MS = 20_000;

type PartnerConnectionCacheEntry = { apps: string[]; expiresAt: number };

/**
 * Per-workspace memo of the connected-toolkit read, keyed by `entityId`.
 *
 * The Dashboard editor refires `GET /api/workflows/:id/readiness` on every
 * keystroke of a mission name, and each of those used to become a live
 * Composio call on one shared API key. A few seconds of memoisation collapses
 * a burst of typing into one upstream request.
 *
 * Deliberately small in scope:
 * - only successful reads are stored; an outage is never memoised, so a
 *   `degraded` response cannot outlive the outage that caused it
 * - `disconnectApp` enumerates accounts through the bridge directly, so a
 *   revocation always acts on a fresh list
 * - connect and disconnect both invalidate the entry they affect
 *
 * `COMPOSIO_STATUS_CACHE_MS=0` disables it entirely.
 */
const partnerConnectionCache = new Map<string, PartnerConnectionCacheEntry>();

function partnerConnectionCacheTtlMs(): number {
  const raw = process.env.COMPOSIO_STATUS_CACHE_MS?.trim();
  if (!raw) return DEFAULT_PARTNER_CONNECTION_CACHE_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PARTNER_CONNECTION_CACHE_MS;
  return parsed;
}

/** Drop one workspace's memo, or every workspace's when called with no id. */
export function invalidatePartnerConnectionCache(entityId?: string): void {
  if (entityId === undefined) partnerConnectionCache.clear();
  else partnerConnectionCache.delete(entityId);
}

/**
 * Returns the apps this entity has currently connected (active integrations).
 * Swallows failures to `[]` for runtime callers that treat "not connected" and
 * "cannot tell" the same way — the run gate fails closed on both.
 *
 * The run gate reads through the same short-lived memo as the preview surfaces.
 * That is a deliberate judgment: the only staleness it can admit is a
 * connection revoked in the last `COMPOSIO_STATUS_CACHE_MS` (20s by default)
 * *from another session*, since a disconnect made through this server
 * invalidates the entry synchronously. A run that slips through that window
 * still fails at execution — Composio rejects the revoked credential — so the
 * cache can delay a block by seconds, never convert one into a completed send.
 */
export async function listConnectedApps(ctx: ComposioExecutionContext): Promise<string[]> {
  return (await listConnectedAppsDetailed(ctx)).apps;
}

/**
 * Same lookup, but surfaces whether Composio actually answered. Endpoints that
 * render connection state use this so an outage shows as degraded instead of
 * as a workspace that disconnected everything.
 */
export async function listConnectedAppsDetailed(
  ctx: ComposioExecutionContext,
): Promise<ComposioConnectedAppsResult> {
  return await readConnectedAppsWithCache(ctx, async (entity) => {
    const bridge = createComposioBridge(await getClient());
    return await bridge.listConnectedApps(entity);
  });
}

/**
 * The memo policy itself, with the underlying read injected — exported so the
 * caching rules can be exercised against a counting fake, the same way
 * `createComposioBridge` is exercised against a fake client adapter.
 */
export async function readConnectedAppsWithCache(
  ctx: ComposioExecutionContext,
  read: (ctx: ComposioExecutionContext) => Promise<string[]>,
): Promise<ComposioConnectedAppsResult> {
  const ttlMs = partnerConnectionCacheTtlMs();
  const cached = ttlMs > 0 ? partnerConnectionCache.get(ctx.entityId) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return { apps: [...cached.apps], ok: true };
  }

  try {
    const apps = await read(ctx);
    if (ttlMs > 0) {
      partnerConnectionCache.set(ctx.entityId, { apps: [...apps], expiresAt: Date.now() + ttlMs });
    }
    return { apps, ok: true };
  } catch (err) {
    console.error('[composio] listConnectedApps failed:', err);
    // An outage is never memoised — a cached "unreachable" would keep the UI
    // degraded after Composio recovered.
    invalidatePartnerConnectionCache(ctx.entityId);
    return { apps: [], ok: false };
  }
}

/**
 * Revoke this entity's active connection(s) to one toolkit. Reports
 * `not_connected` and `failed` distinctly so the caller can answer 404 vs 502
 * rather than claiming a disconnect that never happened.
 */
export async function disconnectComposioApp(
  appName: string,
  ctx: ComposioExecutionContext,
): Promise<ComposioDisconnectResult> {
  try {
    const bridge = createComposioBridge(await getClient());
    return await bridge.disconnectApp(appName, ctx);
  } catch (err) {
    console.error(`[composio] disconnect failed for ${appName}:`, err);
    return {
      status: 'failed',
      toolkit: toToolkitSlug(appName),
      message: err instanceof Error ? err.message : 'Composio disconnect failed.',
    };
  } finally {
    // Unconditional: even a failed disconnect may have deleted some accounts
    // before it threw, so the memo can no longer be trusted either way.
    invalidatePartnerConnectionCache(ctx.entityId);
  }
}
