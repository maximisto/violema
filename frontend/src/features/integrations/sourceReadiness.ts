/**
 * Per-source verdicts: connected, connected-but-limited, missing, or unknown.
 *
 * "Connected" is not the same question as "can this mission run". Drive was
 * connected with read-only scopes and the mission still died at run time, so
 * this module keeps a distinct `limited` state and refuses to collapse it into
 * a green check. Every input is optional and every unreadable answer resolves
 * to `unknown` — never to `missing`, because telling a connected operator they
 * are disconnected is the worse of the two lies.
 *
 * Three signals feed it, in priority order:
 *   1. `capability[source]` from the catalog — the richest answer, and the only
 *      one that names WHAT is missing. Not deployed yet; feature-detected.
 *   2. One `/api/workflows/weekly-founder-update/readiness` probe. That
 *      workflow requires stripe, github, linear, email, calendar, tavily and
 *      slack, and optionally google_drive and postmark — a superset of every
 *      connectable source the six missions use. One request covers all of them,
 *      which is why this surface does not fan out per mission.
 *   3. The catalog's own `connectedApps` list, for anything the probe skipped.
 */

// Explicit `.ts` specifiers so the Node contract test can import this module
// directly and run these verdicts as behaviour, not as source text.
import {
  getPartnerAppSlugs,
  normalizeToolkitSlug,
  resolveToolkitSlug,
} from './partnerToolkits.ts';
import { BUILT_IN_SOURCE_IDS, getMissionSourceLabel } from './missionSources.ts';
import type { PartnerApp, SourceCapability } from './catalogState.ts';
import type { WorkflowReadinessReport } from './WorkflowReadinessPanel';

/** The one workflow whose requirement set is a superset of the others'. */
export const READINESS_PROBE_WORKFLOW_ID = 'weekly-founder-update';

export type SourceState =
  /** Connected and able to do the job. */
  | 'connected'
  /** Connected, but missing a capability the mission needs. */
  | 'limited'
  /** Not connected. */
  | 'missing'
  /** Violema operates this source; the operator connects nothing. */
  | 'builtin'
  /** Could not be read. Never rendered as disconnected. */
  | 'unknown';

export interface SourceVerdict {
  state: SourceState;
  /** Named capabilities the connection lacks, when the server reports them. */
  missing: string[];
  detail: string;
}

const UNKNOWN_VERDICT: SourceVerdict = {
  state: 'unknown',
  missing: [],
  detail: 'Connection status is temporarily unavailable.',
};

/** The backend's existing "connected but scopes are insufficient" wording. */
const REAUTHORIZE_LABEL_PREFIX = 'reauthorize';

export interface ResolveSourceStatesInput {
  /** The catalog could not read live connection state at all. */
  degraded: boolean;
  capability: Record<string, SourceCapability>;
  connectedApps: string[];
  apps: PartnerApp[];
  /** The single readiness probe, or null when it was unavailable. */
  readiness: WorkflowReadinessReport | null;
  /** The probe itself ran against unreadable connection state. */
  readinessDegraded?: boolean;
}

function lookupCapability(
  capability: Record<string, SourceCapability>,
  sourceId: string,
): SourceCapability | null {
  for (const key of [normalizeToolkitSlug(sourceId), resolveToolkitSlug(sourceId)]) {
    if (key && capability[key]) return capability[key];
  }
  return null;
}

function verdictFromCapability(sourceId: string, capability: SourceCapability): SourceVerdict {
  const label = getMissionSourceLabel(sourceId) || sourceId;
  if (!capability.connected) {
    return { state: 'missing', missing: [], detail: `${label} is not connected to this workspace.` };
  }
  if (capability.missing.length > 0) {
    return {
      state: 'limited',
      missing: capability.missing,
      detail: `${label} is connected but cannot ${capability.missing.join(', ')}.`,
    };
  }
  return { state: 'connected', missing: [], detail: `${label} is connected.` };
}

function findPartnerApp(apps: PartnerApp[], sourceId: string): PartnerApp | null {
  const wanted = resolveToolkitSlug(sourceId);
  const raw = normalizeToolkitSlug(sourceId);
  if (!wanted && !raw) return null;
  return (
    apps.find((app) => {
      const slugs = getPartnerAppSlugs(app);
      return slugs.includes(wanted) || slugs.includes(raw);
    }) || null
  );
}

/**
 * Resolve one source id. Exported so the contract can assert each branch
 * without rendering the whole section.
 */
export function resolveSourceVerdict(
  sourceId: string,
  input: ResolveSourceStatesInput,
): SourceVerdict {
  const id = typeof sourceId === 'string' ? sourceId.trim().toLowerCase() : '';
  if (!id) return UNKNOWN_VERDICT;

  if (BUILT_IN_SOURCE_IDS.has(id)) {
    return { state: 'builtin', missing: [], detail: 'Violema runs this for you.' };
  }

  // The server said it cannot see connection state. Nothing below is trustworthy.
  if (input.degraded) return UNKNOWN_VERDICT;

  const capability = lookupCapability(input.capability, id);
  if (capability) return verdictFromCapability(id, capability);

  const report = input.readiness;
  if (report && !input.readinessDegraded) {
    const blocker = report.blockers?.find((entry) => entry.key === id);
    if (blocker) {
      return { state: 'missing', missing: [], detail: blocker.detail || blocker.label };
    }
    const warning = report.warnings?.find((entry) => entry.key === id);
    if (warning) {
      const reauthorize = warning.label.trim().toLowerCase().startsWith(REAUTHORIZE_LABEL_PREFIX);
      return {
        state: reauthorize ? 'limited' : 'missing',
        missing: [],
        detail: warning.detail || warning.label,
      };
    }
    const covered =
      (report.requiredIntegrationIds || []).includes(id)
      || (report.optionalIntegrationIds || []).includes(id);
    if (covered) {
      const label = getMissionSourceLabel(id) || id;
      return { state: 'connected', missing: [], detail: `${label} passed its live readiness check.` };
    }
  }

  const app = findPartnerApp(input.apps, id);
  if (app) {
    const connected = new Set(input.connectedApps.map(resolveToolkitSlug).filter(Boolean));
    const isConnected = getPartnerAppSlugs(app).some((slug) => connected.has(slug));
    return isConnected
      ? { state: 'connected', missing: [], detail: `${app.label || app.name} is connected.` }
      : { state: 'missing', missing: [], detail: `${app.label || app.name} is not connected.` };
  }

  return UNKNOWN_VERDICT;
}

export function resolveSourceStates(
  sourceIds: string[],
  input: ResolveSourceStatesInput,
): Record<string, SourceVerdict> {
  const out: Record<string, SourceVerdict> = {};
  for (const id of sourceIds) {
    const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
    if (!key || out[key]) continue;
    out[key] = resolveSourceVerdict(key, input);
  }
  return out;
}

export interface MissionReadinessSummary {
  /** Nothing required is missing or limited, and nothing is unreadable. */
  ready: boolean;
  blocking: number;
  limited: number;
  unknown: number;
}

/**
 * A mission is only "ready" when its required sources are all usable. A limited
 * source counts against readiness, because that is precisely the case that
 * looked green and then failed mid-run.
 */
export function summarizeMissionReadiness(
  requirements: Array<{ id: string; optional: boolean }>,
  verdicts: Record<string, SourceVerdict>,
): MissionReadinessSummary {
  let blocking = 0;
  let limited = 0;
  let unknown = 0;

  for (const requirement of requirements) {
    const verdict = verdicts[requirement.id];
    if (!verdict) continue;
    if (verdict.state === 'unknown') unknown += 1;
    if (requirement.optional) continue;
    if (verdict.state === 'missing') blocking += 1;
    if (verdict.state === 'limited') limited += 1;
  }

  return { ready: blocking === 0 && limited === 0 && unknown === 0, blocking, limited, unknown };
}

export interface ReadinessProbeResult {
  report: WorkflowReadinessReport | null;
  degraded: boolean;
}

/**
 * One bounded readiness read. A failure resolves to `{ report: null }`, which
 * every consumer treats as "no extra signal", not as "nothing is connected".
 */
export async function fetchReadinessProbe(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<ReadinessProbeResult> {
  try {
    const params = new URLSearchParams({ workspaceId });
    const response = await fetch(
      `/api/workflows/${READINESS_PROBE_WORKFLOW_ID}/readiness?${params.toString()}`,
      { credentials: 'same-origin', signal },
    );
    if (!response.ok) return { report: null, degraded: false };
    const payload = await response.json().catch(() => null) as
      | { report?: WorkflowReadinessReport; degraded?: boolean }
      | null;
    return {
      report: payload?.report ?? null,
      degraded: payload?.degraded === true,
    };
  } catch {
    return { report: null, degraded: false };
  }
}
