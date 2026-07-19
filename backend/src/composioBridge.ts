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
      options: { allowMultiple: true },
    ): Promise<{ redirectUrl?: string | null }>;
    list(query: {
      userIds: string[];
      statuses: Array<'ACTIVE'>;
    }): Promise<{
      items: Array<{ toolkit?: { slug?: string } | null }>;
    }>;
  };
}

export interface ComposioBridge {
  isEnabled(): boolean;
  executeAction(
    actionName: string,
    input: Record<string, unknown>,
    ctx: ComposioExecutionContext,
  ): Promise<unknown>;
  getConnectionUrl(
    appName: string,
    ctx: ComposioExecutionContext,
  ): Promise<string | null>;
  listConnectedApps(ctx: ComposioExecutionContext): Promise<string[]>;
}

export function createComposioBridge(
  client: ComposioClientAdapter | null,
): ComposioBridge {
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

    async getConnectionUrl(appName, ctx) {
      if (!client) return null;

      const toolkitSlug = appName.trim().toLowerCase();
      const authConfigs = await client.authConfigs.list({ toolkit: toolkitSlug });
      let authConfigId = authConfigs.items[0]?.id;

      if (!authConfigId) {
        const authConfig = await client.authConfigs.create(toolkitSlug, {
          type: 'use_composio_managed_auth',
          name: `${toolkitSlug} Auth Config`,
        });
        authConfigId = authConfig.id;
      }

      const connection = await client.connectedAccounts.link(
        ctx.entityId,
        authConfigId,
        { allowMultiple: true },
      );
      return connection.redirectUrl ?? null;
    },

    async listConnectedApps(ctx) {
      if (!client) return [];

      const connections = await client.connectedAccounts.list({
        userIds: [ctx.entityId],
        statuses: ['ACTIVE'],
      });
      return connections.items
        .map((connection) => connection.toolkit?.slug ?? '')
        .filter(Boolean);
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
 * Build a stub OAuth-style URL where the user can connect a Composio integration.
 * Composio handles the actual OAuth UI — we just hand them the redirect.
 */
export async function getComposioConnectionUrl(
  appName: string,
  ctx: ComposioExecutionContext,
): Promise<string | null> {
  try {
    const bridge = createComposioBridge(await getClient());
    return await bridge.getConnectionUrl(appName, ctx);
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
  try {
    const bridge = createComposioBridge(await getClient());
    return await bridge.listConnectedApps(ctx);
  } catch (err) {
    console.error('[composio] listConnectedApps failed:', err);
    return [];
  }
}
