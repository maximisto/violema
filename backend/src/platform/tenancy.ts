import { DEFAULT_WORKSPACE_ID, listWorkspaces } from './workspace';
import { isDemoWorkspace, listDemoWorkspaceIds } from './demoWorkspace';
import type { WorkspaceProfile } from './types';

/**
 * Tenancy boundary.
 *
 * Violema now runs workspaces that are not Max's. Several mechanisms in this
 * codebase were written when there was effectively one workspace, and they
 * therefore act globally: Slack channel reroutes, founder-report delivery
 * defaults, and the server's own integration credentials. Applied to a tenant,
 * each of those is a cross-tenant fault — a customer's delivery landing in our
 * demo channel, or a customer's "revenue" actually being ours.
 *
 * This module is the single place that answers "is this workspace us?", so the
 * answer cannot drift between the mechanisms that depend on it.
 *
 * There are deliberately TWO predicates, because the safe answer differs:
 *
 * - `usesInternalDemoRouting` governs presentation-level reroutes and defaults.
 *   Unattributed work (no workspaceId) is treated as internal, matching the
 *   `?? DEFAULT_WORKSPACE_ID` fallback used throughout the backend and
 *   preserving the behavior of the seeded automations, which carry no
 *   workspaceId at all.
 *
 * - `canUseServerIntegrationCredentials` governs whose data gets read. It is
 *   strictly the default workspace: demo workspaces are allowed to render
 *   labeled sample data, but they are never allowed to read our live Stripe
 *   account. There is no unattributed case — every caller has a concrete
 *   workspace id — and an empty id fails closed.
 */

function normalizeWorkspaceId(workspaceId: string | null | undefined): string {
  return typeof workspaceId === 'string' ? workspaceId.trim() : '';
}

/**
 * True when a workspace should receive Violema's internal/demo presentation
 * behavior: the `#violema-demo` channel reroutes and the founder-report
 * delivery defaults that exist for the raise period.
 *
 * Tenant workspaces must never match, or their deliveries land in our channel.
 */
export function usesInternalDemoRouting(workspaceId: string | null | undefined): boolean {
  const id = normalizeWorkspaceId(workspaceId);
  // Unattributed: seeded automations and internal call sites that predate
  // multi-tenancy. These are Max's, and the backend already resolves a missing
  // workspace to DEFAULT_WORKSPACE_ID everywhere else.
  if (!id) return true;
  if (id === DEFAULT_WORKSPACE_ID) return true;
  return isDemoWorkspace(id);
}

/** Inverse of `usesInternalDemoRouting`, for call sites that read better positively. */
export function isTenantWorkspace(workspaceId: string | null | undefined): boolean {
  return !usesInternalDemoRouting(workspaceId);
}

/**
 * The same predicate as `usesInternalDemoRouting`, resolved ONCE for a batch.
 *
 * `isDemoWorkspace` re-reads the whole workspace store on every call, which is
 * fine for a one-off check and quadratic in a loop: normalizing N automations or
 * rendering N workspace rows meant N full file reads. Callers that ask the
 * question repeatedly build a resolver first; callers that ask once keep using
 * `usesInternalDemoRouting`.
 *
 * The rule stays defined in exactly one module — this one — so the batch and
 * single-shot answers cannot drift.
 */
export function createInternalDemoRoutingResolver(
  /** Already-loaded profiles, for a caller that has read the store anyway. */
  workspaces?: WorkspaceProfile[],
): (workspaceId: string | null | undefined) => boolean {
  const demoIds = new Set(listDemoWorkspaceIds());
  try {
    for (const profile of workspaces ?? listWorkspaces()) {
      if (profile.metadata?.demo === true) demoIds.add(profile.id);
    }
  } catch {
    // Mirrors `isDemoWorkspace`, which treats an unreadable store as "not a demo
    // workspace" rather than failing the caller.
  }

  return (workspaceId) => {
    const id = normalizeWorkspaceId(workspaceId);
    if (!id) return true;
    if (id === DEFAULT_WORKSPACE_ID) return true;
    return demoIds.has(id);
  };
}

/**
 * True when a workspace may fall back to credentials configured on the SERVER
 * (env vars such as `STRIPE_SECRET_KEY`), which belong to Violema itself.
 *
 * Only the default workspace may. Every other workspace — tenants and demo
 * workspaces alike — must present its own workspace-configured credential, or
 * be told to connect one. Fabricating a labeled demo is allowed; reading our
 * real revenue and presenting it as theirs is not.
 */
export function canUseServerIntegrationCredentials(
  workspaceId: string | null | undefined,
): boolean {
  return normalizeWorkspaceId(workspaceId) === DEFAULT_WORKSPACE_ID;
}
