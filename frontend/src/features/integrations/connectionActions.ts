/**
 * Transport for every integration mutation, shared by the public connect page
 * and the in-workspace command center.
 *
 * What is shared is the part that is easy to get subtly wrong on a second
 * surface: workspace scoping, session credentials, the 401/403 -> "sign in"
 * branch, and pulling the server's own error text out of the body instead of
 * showing a generic failure. The endpoint paths stay at the call sites so each
 * surface is greppable for exactly what it hits.
 */

// Explicit `.ts` specifier so the Node contract test can import this directly.
import { getWorkspaceRequest } from '../../lib/workspace.ts';

export type IntegrationActionResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; kind: 'unauthorized'; message: string }
  /** The endpoint answered 404: either "already gone" or "not deployed yet". */
  | { ok: false; kind: 'missing'; message: string }
  | { ok: false; kind: 'error'; message: string };

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({})) as { error?: string };
  return typeof data.error === 'string' && data.error.trim() ? data.error.trim() : fallback;
}

/**
 * POST a workspace-scoped integration action. Never throws: every failure comes
 * back as a typed result so callers cannot accidentally render a rejected
 * promise as a success.
 */
export async function postIntegrationAction<T = Record<string, unknown>>(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackMessage = 'That action did not complete. Try again in a moment.',
): Promise<IntegrationActionResult<T>> {
  try {
    const request = getWorkspaceRequest(endpoint);
    const response = await fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...request.headers },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, kind: 'unauthorized', message: 'Sign in to manage connections.' };
    }
    if (response.status === 404) {
      return { ok: false, kind: 'missing', message: await readErrorMessage(response, fallbackMessage) };
    }
    if (!response.ok) {
      return { ok: false, kind: 'error', message: await readErrorMessage(response, fallbackMessage) };
    }

    const data = await response.json().catch(() => ({})) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, kind: 'error', message: fallbackMessage };
  }
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  /** Whether the Violema app is already a member — an invite is needed if not. */
  isMember: boolean;
}

export type SlackChannelsResult =
  /** The server does not expose a channel directory: fall back to a text input. */
  | { kind: 'unsupported' }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; channels: SlackChannel[] };

function readChannels(payload: unknown): SlackChannel[] {
  const raw = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null
      ? (payload as { channels?: unknown; items?: unknown }).channels
        ?? (payload as { items?: unknown }).items
      : null;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry): SlackChannel | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!id || !name) return null;
      return {
        id,
        name,
        isPrivate: record.isPrivate === true,
        // Absent membership is rendered as "invite required", never as joined.
        isMember: record.isMember === true,
      };
    })
    .filter((entry): entry is SlackChannel => entry !== null);
}

/**
 * Feature-detected: a 404 means this deployment has no channel directory yet,
 * which is a different answer from "your Slack has no channels" and must not be
 * rendered as an empty picker.
 */
export async function fetchSlackChannels(signal?: AbortSignal): Promise<SlackChannelsResult> {
  try {
    const request = getWorkspaceRequest('/api/integrations/slack/channels');
    const response = await fetch(request.url, {
      credentials: 'same-origin',
      headers: request.headers,
      signal,
    });
    if (response.status === 404) return { kind: 'unsupported' };
    if (response.status === 401 || response.status === 403) return { kind: 'unauthorized' };
    if (!response.ok) return { kind: 'unavailable' };
    const payload = await response.json().catch(() => null);
    // A 200 that does not parse to a channel list is not a directory either.
    if (!Array.isArray(payload) && readChannels(payload).length === 0) return { kind: 'unsupported' };
    return { kind: 'ready', channels: readChannels(payload) };
  } catch {
    return { kind: 'unavailable' };
  }
}
