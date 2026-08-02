/**
 * The Slack channel picker.
 *
 * THE INCIDENT THIS EXISTS FOR
 *
 * Setting up a mission, the founder had to type a channel name from memory.
 * They guessed, saved, ran — and only discovered the bot was not a member of
 * that channel when the send failed, after the run had already done its work.
 * Two guesses were being asked of a customer at once: does this channel exist,
 * and can Violema post in it. Slack can answer both, so it should.
 *
 * `is_member` is the field that matters. A channel Violema can see but has not
 * been invited to will reject the post, so listing it without that flag would
 * just move the surprise rather than remove it.
 *
 * ── Two paths, deliberately ──────────────────────────────────────────────────
 *
 * - Tenants read through their OWN Composio connection
 *   (`SLACKBOT_LIST_ALL_CHANNELS`). Their channels, their grant.
 * - The internal/demo workspace keeps the native `SLACK_BOT_TOKEN` path, the
 *   same split `sendMessage` already makes via `usesInternalDemoRouting`.
 *   Reading a tenant's channels with our bot token would list OUR workspace's
 *   channels — confidently, and entirely wrongly.
 *
 * Note this is a different job from `integrations.findSlackChannelIdByName`,
 * which resolves one already-typed name to an id on the native token at send
 * time and drops `is_member`. That resolver is the silence this module fixes.
 *
 * ── Failure is reported, never thrown or invented ────────────────────────────
 *
 * Every failure returns `{ ok: false, code, reason }`. A picker that renders an
 * empty list on an outage teaches a founder they have no channels; one that
 * invents plausible names is worse. There is no fallback list and no default
 * channel anywhere in this module.
 */

import { executeComposioAction, listConnectedAppsDetailed } from '../composioBridge';
import { usesInternalDemoRouting } from '../platform/tenancy';
import { normalizeAppName } from './partnerAppMap';
import { SLACK_CONNECT_ROUTE, SLACK_PARTNER_TOOLKITS } from './slackDelivery';

/** Composio action verified present and non-deprecated on toolkit `slackbot`. */
const LIST_CHANNELS_ACTION = 'SLACKBOT_LIST_ALL_CHANNELS';

/**
 * Upper bound on channels returned. A large Slack has thousands; a picker needs
 * enough to choose from, not all of them, and an unbounded read would blow both
 * the response size and Slack's rate limit.
 */
export const MAX_SLACK_CHANNELS = 200;

export interface SlackChannelOption {
  id: string;
  name: string;
  isPrivate: boolean;
  /** False means Violema can see the channel but cannot post until invited. */
  isMember: boolean;
}

export type SlackChannelFailureCode =
  | 'slack_not_connected'
  | 'slack_lookup_unavailable'
  | 'slack_scope_insufficient'
  | 'slack_not_configured';

export type SlackChannelsResult =
  | {
      ok: true;
      channels: SlackChannelOption[];
      source: 'composio' | 'native';
      /** True when Slack had more channels than `MAX_SLACK_CHANNELS`. */
      truncated: boolean;
      fetchedAt: string;
    }
  | {
      ok: false;
      code: SlackChannelFailureCode;
      reason: string;
      nextAction?: { label: string; route: string };
    };

export interface SlackChannelDeps {
  listConnectedApps?: (ctx: { entityId: string }) => Promise<{ apps: string[]; ok: boolean }>;
  execute?: (
    actionName: string,
    input: Record<string, unknown>,
    ctx: { entityId: string },
  ) => Promise<unknown>;
  /** Native Slack Web API reader, injected in tests so no live call is made. */
  fetchNativeChannels?: (token: string) => Promise<unknown>;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Pull the channel array out of whatever nesting the caller handed back.
 *
 * Composio wraps results as `{ successful, data }`, and the Slack payload may
 * sit at `data.channels` or one level deeper at `data.data.channels`. Both are
 * accepted; anything else yields `[]`, which the caller reports as a failure
 * rather than as "no channels".
 */
function readChannelArray(payload: unknown): Record<string, unknown>[] {
  const candidates: unknown[] = [];
  if (Array.isArray(payload)) candidates.push(payload);
  if (isRecord(payload)) {
    candidates.push(payload.channels);
    if (isRecord(payload.data)) {
      candidates.push(payload.data.channels, payload.data);
    }
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

/**
 * Normalise Slack's channel objects.
 *
 * `is_member` is read strictly: only an explicit `true` counts. Slack omits the
 * field on some conversation types, and defaulting a missing value to "member"
 * would reintroduce exactly the failed send this picker exists to prevent.
 */
export function normalizeSlackChannels(payload: unknown): {
  channels: SlackChannelOption[];
  truncated: boolean;
} {
  const raw = readChannelArray(payload);
  const channels: SlackChannelOption[] = [];

  for (const entry of raw) {
    const id = asString(entry.id);
    const name = asString(entry.name);
    if (!id || !name) continue;
    // An archived channel cannot receive messages, so offering one guarantees a
    // failure later.
    if (entry.is_archived === true) continue;

    channels.push({
      id,
      name,
      isPrivate: entry.is_private === true || entry.is_group === true,
      isMember: entry.is_member === true,
    });
    if (channels.length >= MAX_SLACK_CHANNELS) {
      return { channels, truncated: raw.length > channels.length };
    }
  }

  return { channels, truncated: false };
}

function failure(
  code: SlackChannelFailureCode,
  reason: string,
  withConnectRoute = false,
): SlackChannelsResult {
  return {
    ok: false,
    code,
    reason,
    ...(withConnectRoute
      ? { nextAction: { label: 'Connect Slack', route: SLACK_CONNECT_ROUTE } }
      : {}),
  };
}

/**
 * Slack rejects a call whose token lacks `channels:read` / `groups:read` with a
 * `missing_scope` error. That is a re-authorisation problem, not an outage, and
 * saying so saves a founder from retrying a call that can never succeed.
 */
function classifySlackError(detail: string): SlackChannelsResult {
  const normalized = detail.toLowerCase();
  if (normalized.includes('missing_scope') || normalized.includes('not_allowed_token_type')) {
    return failure(
      'slack_scope_insufficient',
      'Slack is connected but this connection cannot list channels. Reconnect Slack and grant '
      + 'channel access (channels:read, and groups:read for private channels).',
      true,
    );
  }
  return failure(
    'slack_lookup_unavailable',
    `Violema could not read the channel list from Slack right now. ${detail}`,
  );
}

async function readTenantChannels(
  workspaceId: string,
  deps: SlackChannelDeps,
): Promise<SlackChannelsResult> {
  const readConnections = deps.listConnectedApps ?? listConnectedAppsDetailed;
  const connections = await readConnections({ entityId: workspaceId });

  if (!connections.ok) {
    return failure(
      'slack_lookup_unavailable',
      "Violema could not verify this workspace's Slack connection. Try again in a moment.",
    );
  }

  const connected = new Set(connections.apps.map(normalizeAppName));
  const toolkit = SLACK_PARTNER_TOOLKITS.find((slug) => connected.has(normalizeAppName(slug)));
  if (!toolkit) {
    return failure(
      'slack_not_connected',
      'Slack is not connected for this workspace, so Violema cannot list its channels.',
      true,
    );
  }

  const execute = deps.execute ?? executeComposioAction;
  let response: unknown;
  try {
    response = await execute(
      LIST_CHANNELS_ACTION,
      { limit: MAX_SLACK_CHANNELS, exclude_archived: true },
      { entityId: workspaceId },
    );
  } catch (error) {
    return classifySlackError(error instanceof Error ? error.message : 'Slack call failed.');
  }

  if (!isRecord(response)) {
    return failure('slack_lookup_unavailable', 'Slack returned an unreadable channel list.');
  }
  if (response.successful !== true) {
    const detail = response.error ?? 'no detail provided';
    return classifySlackError(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  const { channels, truncated } = normalizeSlackChannels(response.data);
  return {
    ok: true,
    channels,
    source: 'composio',
    truncated,
    fetchedAt: (deps.now ? deps.now() : new Date()).toISOString(),
  };
}

/** Native Slack Web API read, for the internal/demo workspace only. */
async function defaultFetchNativeChannels(token: string): Promise<unknown> {
  const url = new URL('https://slack.com/api/conversations.list');
  url.searchParams.set('limit', String(MAX_SLACK_CHANNELS));
  url.searchParams.set('exclude_archived', 'true');
  url.searchParams.set('types', 'public_channel,private_channel');

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return await response.json();
}

async function readNativeChannels(deps: SlackChannelDeps): Promise<SlackChannelsResult> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) {
    return failure(
      'slack_not_configured',
      'Slack is not configured on this server, so Violema cannot list channels.',
    );
  }

  const read = deps.fetchNativeChannels ?? defaultFetchNativeChannels;
  let payload: unknown;
  try {
    payload = await read(token);
  } catch (error) {
    return classifySlackError(error instanceof Error ? error.message : 'Slack call failed.');
  }

  if (!isRecord(payload)) {
    return failure('slack_lookup_unavailable', 'Slack returned an unreadable channel list.');
  }
  if (payload.ok !== true) {
    const detail = asString(payload.error) || 'no detail provided';
    return classifySlackError(detail);
  }

  const { channels, truncated } = normalizeSlackChannels(payload);
  return {
    ok: true,
    channels,
    source: 'native',
    truncated,
    fetchedAt: (deps.now ? deps.now() : new Date()).toISOString(),
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const DEFAULT_CHANNEL_CACHE_MS = 20_000;

type ChannelCacheEntry = { result: SlackChannelsResult; expiresAt: number };

const channelCache = new Map<string, ChannelCacheEntry>();

/**
 * Same knob and default as the Composio connection memo. A picker gets opened
 * and re-opened while a founder decides, and each open would otherwise be a
 * live Slack call against a shared rate limit.
 */
function channelCacheTtlMs(): number {
  const raw = process.env.COMPOSIO_STATUS_CACHE_MS?.trim();
  if (!raw) return DEFAULT_CHANNEL_CACHE_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CHANNEL_CACHE_MS;
  return parsed;
}

export function invalidateSlackChannelCache(workspaceId?: string): void {
  if (workspaceId === undefined) channelCache.clear();
  else channelCache.delete(workspaceId);
}

/**
 * List the Slack channels this workspace can choose from.
 *
 * Only successful reads are cached: a cached outage would keep the picker
 * broken after Slack recovered, and a cached "not connected" would survive the
 * user connecting.
 */
export async function listSlackChannels(
  workspaceId: string,
  deps: SlackChannelDeps = {},
): Promise<SlackChannelsResult> {
  const ttlMs = channelCacheTtlMs();
  const cached = ttlMs > 0 ? channelCache.get(workspaceId) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = usesInternalDemoRouting(workspaceId)
    ? await readNativeChannels(deps)
    : await readTenantChannels(workspaceId, deps);

  if (result.ok && ttlMs > 0) {
    channelCache.set(workspaceId, { result, expiresAt: Date.now() + ttlMs });
  }

  return result;
}
