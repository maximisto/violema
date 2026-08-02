/**
 * Which auth config a new Composio connection is opened against.
 *
 * A Composio account can hold several auth configs for the same toolkit, and
 * `authConfigs.list({ toolkit })` returns them in no guaranteed order. Taking
 * `items[0]` therefore picks an arbitrary one — which is how a Google Drive
 * connection ended up on a *custom* auth config scoped to
 * `drive.metadata.readonly`: it could neither read file contents nor create
 * files, and because its consent screen was a personal Google Cloud client in
 * Testing mode, only allowlisted Google accounts could authorise at all.
 *
 * So selection is deterministic and explicit:
 *
 *   1. `COMPOSIO_AUTH_CONFIG_<TOOLKIT>` — an operator escape hatch, pinned by
 *      id. Set-but-missing fails closed; falling back would reintroduce the bug.
 *   2. A Composio-managed config — Composio's own verified OAuth app, so any
 *      account can authorise, and it carries the toolkit's full default scopes.
 *   3. Otherwise the first available, preserving prior behaviour for toolkits
 *      that only ever have custom configs.
 *   4. Nothing at all — the caller creates a managed config.
 *
 * Within tiers 2 and 3 an ENABLED config beats a DISABLED one. That only ever
 * reorders candidates, never removes one, so it cannot turn "use an existing
 * config" into "create a new config".
 *
 * Pure and I/O-free on purpose: the environment is a parameter, so the whole
 * precedence table is testable without a Composio client or real env vars.
 */

/**
 * The subset of an SDK auth-config list item that selection depends on.
 *
 * Deliberately a structural narrowing rather than the SDK's exported type,
 * matching the hand-rolled adapter in `composioBridge.ts`. Extra fields the SDK
 * returns — notably `credentials` — are permitted by the index signature but
 * are never read, never returned, and never logged.
 */
export interface ComposioAuthConfigSummary {
  id: string;
  name?: string | null;
  status?: string | null;
  /**
   * Composio's TS SDK maps the API's `is_composio_managed` onto this camelCase
   * key (`transformAuthConfigRetrieveResponse`, `@composio/core`), so this is
   * the spelling a live client actually returns.
   */
  isComposioManaged?: boolean | null;
  /**
   * The raw REST spelling, accepted as a fallback. The SDK's transformer reads
   * the snake_case key off the raw payload; if that mapping ever changes or a
   * caller passes an untransformed response, honouring both spellings keeps a
   * managed config from being silently demoted to "custom" — which would put us
   * straight back on the read-only config this module exists to avoid.
   */
  is_composio_managed?: boolean | null;
  [extraField: string]: unknown;
}

/** Why a given auth config was chosen — carried into logs and the connect response. */
export type ComposioAuthConfigReason =
  | 'env_override'
  | 'composio_managed'
  | 'first_available'
  | 'created';

/**
 * The chosen auth config, reduced to what is safe to log and return.
 *
 * Structurally incapable of carrying credentials: it holds an id, a name, and
 * two flags, and is built field by field rather than spread from the SDK item.
 */
export interface ComposioAuthConfigChoice {
  id: string;
  name: string | null;
  managed: boolean;
  reason: ComposioAuthConfigReason;
}

/** A minimal environment view, so tests never mutate `process.env`. */
export type EnvLike = Record<string, string | undefined>;

/**
 * The per-toolkit override variable, e.g. `googledrive` →
 * `COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE`. Slug separators (`google-calendar`)
 * become underscores because they are not legal in an env var name.
 */
export function authConfigOverrideEnvVar(toolkitSlug: string): string {
  const normalized = toolkitSlug.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return `COMPOSIO_AUTH_CONFIG_${normalized}`;
}

function isManaged(item: ComposioAuthConfigSummary): boolean {
  return item.isComposioManaged === true || item.is_composio_managed === true;
}

function isDisabled(item: ComposioAuthConfigSummary): boolean {
  return typeof item.status === 'string' && item.status.trim().toUpperCase() === 'DISABLED';
}

function nameOf(item: ComposioAuthConfigSummary): string | null {
  return typeof item.name === 'string' && item.name.length > 0 ? item.name : null;
}

/**
 * Higher wins, ties broken by list order so the choice stays stable across
 * calls. Managed is weighted above enabled: the verified OAuth app and the
 * toolkit's full default scopes matter more than a status flag an operator can
 * flip back on.
 */
function rank(item: ComposioAuthConfigSummary): number {
  return (isManaged(item) ? 2 : 0) + (isDisabled(item) ? 0 : 1);
}

/**
 * Pick the auth config a new connection should be opened against, or `null`
 * when the toolkit has none and one must be created.
 *
 * Throws when the override is set to an id this toolkit does not have. That is
 * the one case where failing the connect outright beats succeeding, because the
 * alternative — quietly using a different auth config — is the production
 * defect itself, and it surfaces days later as a permission error.
 */
export function selectComposioAuthConfig(
  toolkitSlug: string,
  items: readonly ComposioAuthConfigSummary[],
  env: EnvLike = process.env,
): ComposioAuthConfigChoice | null {
  const candidates = items.filter((item) => typeof item.id === 'string' && item.id.length > 0);

  const overrideVar = authConfigOverrideEnvVar(toolkitSlug);
  const override = env[overrideVar]?.trim();
  if (override) {
    const pinned = candidates.find((item) => item.id === override);
    if (!pinned) {
      throw new Error(
        `${overrideVar} is set to "${override}", but the ${toolkitSlug} toolkit has no auth config with that id ` +
          `(${candidates.length} available). Refusing to connect against a different auth config — ` +
          `correct or unset ${overrideVar}.`,
      );
    }
    return {
      id: pinned.id,
      name: nameOf(pinned),
      managed: isManaged(pinned),
      reason: 'env_override',
    };
  }

  let best: ComposioAuthConfigSummary | null = null;
  let bestRank = -1;
  for (const item of candidates) {
    const itemRank = rank(item);
    if (itemRank > bestRank) {
      best = item;
      bestRank = itemRank;
    }
  }
  if (!best) return null;

  const managed = isManaged(best);
  return {
    id: best.id,
    name: nameOf(best),
    managed,
    reason: managed ? 'composio_managed' : 'first_available',
  };
}

/**
 * The log/telemetry view of a choice. Every key is written out explicitly —
 * never spread from the SDK item, which carries a `credentials` object holding
 * the OAuth client id and secret of custom auth configs.
 */
export function describeAuthConfigChoice(
  toolkitSlug: string,
  choice: ComposioAuthConfigChoice,
): {
  toolkit: string;
  authConfigId: string;
  authConfigName: string | null;
  composioManaged: boolean;
  reason: ComposioAuthConfigReason;
} {
  return {
    toolkit: toolkitSlug,
    authConfigId: choice.id,
    authConfigName: choice.name,
    composioManaged: choice.managed,
    reason: choice.reason,
  };
}
