/**
 * Composio Bridge — turns Composio's 250+ pre-built integrations into tools
 * Claude can call. Activated by setting COMPOSIO_API_KEY in the environment.
 *
 * When inactive, every helper here returns false / null gracefully so the rest
 * of the backend keeps working with native + mock tools.
 *
 * See docs/INTEGRATIONS_ARCHITECTURE.md for the full strategy.
 */

import type { ComposioToolSet as ComposioToolSetType } from 'composio-core';

let toolset: ComposioToolSetType | null = null;
let initAttempted = false;

function getToolset(): ComposioToolSetType | null {
  if (initAttempted) return toolset;
  initAttempted = true;

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.log('[composio] disabled (set COMPOSIO_API_KEY to enable)');
    return null;
  }

  try {
    // Lazy import so the SDK never loads when Composio isn't configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ComposioToolSet } = require('composio-core') as typeof import('composio-core');
    toolset = new ComposioToolSet({ apiKey });
    console.log('[composio] enabled');
    return toolset;
  } catch (err) {
    console.error('[composio] failed to initialise:', err instanceof Error ? err.message : err);
    return null;
  }
}

export function isComposioEnabled(): boolean {
  return getToolset() !== null;
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
  const ts = getToolset();
  if (!ts) {
    throw new Error('Composio is not configured. Set COMPOSIO_API_KEY to enable.');
  }

  return await ts.executeAction({
    action: actionName,
    params: input,
    entityId: ctx.entityId,
  });
}

/**
 * Build a stub OAuth-style URL where the user can connect a Composio integration.
 * Composio handles the actual OAuth UI — we just hand them the redirect.
 */
export async function getComposioConnectionUrl(
  appName: string,
  ctx: ComposioExecutionContext,
): Promise<string | null> {
  const ts = getToolset();
  if (!ts) return null;

  try {
    const entity = await ts.client.getEntity(ctx.entityId);
    const connection = await entity.initiateConnection({ appName });
    return connection.redirectUrl ?? null;
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
  const ts = getToolset();
  if (!ts) return [];

  try {
    const entity = await ts.client.getEntity(ctx.entityId);
    const connections = await entity.getConnections();
    return connections.map((c) => c.appName ?? '').filter(Boolean);
  } catch (err) {
    console.error('[composio] listConnectedApps failed:', err);
    return [];
  }
}
