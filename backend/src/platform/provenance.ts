/**
 * Run provenance.
 *
 * Every artifact a run produces should be able to answer "where did this number
 * come from". These helpers derive that answer from tool payloads and provide
 * the last-line-of-defense scan that stops fabricated evidence from being
 * delivered to a real workspace.
 */

export interface DataOriginRecord {
  live: boolean;
  simulated: boolean;
  source?: string;
  fetchedAt?: string;
}

export type StepDataOrigin = 'live' | 'simulated' | 'none';

interface ProvenanceArtifactLike {
  kind?: string;
  title?: string;
  payload?: Record<string, unknown> | null;
  origin?: DataOriginRecord;
}

interface ProvenanceStepLike {
  title?: string;
  output?: Record<string, unknown> | null;
  dataOrigin?: StepDataOrigin;
}

export interface FabricatedEvidenceFinding {
  label: string;
  source?: string;
  detail: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** True when a tool payload explicitly declares itself simulated or non-live. */
export function isFabricatedPayload(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  return payload.simulated === true || payload.live === false;
}

/** Origin record for a query_data payload returned by executeQueryData. */
export function readQueryPayloadOrigin(payload: Record<string, unknown>): DataOriginRecord {
  return {
    live: payload.live === true,
    simulated: payload.simulated === true || payload.live === false,
    source: readString(payload.source),
    fetchedAt: readString(payload.fetched_at),
  };
}

/** Step-level origin for a query_data payload: failed reads carry no data at all. */
export function readQueryPayloadDataOrigin(payload: Record<string, unknown>): StepDataOrigin {
  if (payload.ok === false) return 'none';
  if (payload.simulated === true || payload.live === false) return 'simulated';
  if (payload.live === true) return 'live';
  return 'none';
}

/** Origin record for a tool that only ever reads live sources (search, capture). */
export function liveOrigin(source: string, fetchedAt?: string): DataOriginRecord {
  return { live: true, simulated: false, source, fetchedAt };
}

/**
 * Scan a run for evidence that must never be delivered to a real workspace.
 * Returns the first offender so the delivery step can name it in its error.
 */
export function findFabricatedEvidence(input: {
  artifacts?: ProvenanceArtifactLike[];
  stepExecutions?: ProvenanceStepLike[];
}): FabricatedEvidenceFinding | null {
  for (const artifact of input.artifacts || []) {
    if (!artifact || typeof artifact !== 'object') continue;
    // A failed read (ok:false) delivers no data at all — it is honest failure,
    // not fabricated evidence, so it must not block the run's error report.
    if (artifact.payload?.ok === false) continue;
    const flaggedOrigin = artifact.origin?.simulated === true;
    if (!flaggedOrigin && !isFabricatedPayload(artifact.payload)) continue;

    const source = readString(artifact.payload?.source) || artifact.origin?.source;
    const label = readString(artifact.title) || readString(artifact.kind) || 'a run artifact';
    return {
      label,
      source,
      detail: source
        ? `"${label}" carries simulated ${source} data`
        : `"${label}" carries simulated data`,
    };
  }

  for (const step of input.stepExecutions || []) {
    if (!step || typeof step !== 'object') continue;
    if (step.output?.ok === false) continue;
    const flaggedOrigin = step.dataOrigin === 'simulated';
    if (!flaggedOrigin && !isFabricatedPayload(step.output)) continue;

    const source = readString(step.output?.source);
    const label = readString(step.title) || 'a workflow step';
    return {
      label,
      source,
      detail: source
        ? `step "${label}" produced simulated ${source} data`
        : `step "${label}" produced simulated data`,
    };
  }

  return null;
}

/**
 * Stable marker inside the fabricated-evidence delivery error. Kept beside the
 * builder so the message and its detector cannot drift apart.
 */
const FABRICATED_EVIDENCE_ERROR_MARKER = 'does not send simulated data to a live workspace';

/** Human-readable delivery failure message for a fabricated-evidence finding. */
export function buildFabricatedEvidenceDeliveryError(finding: FabricatedEvidenceFinding): string {
  return `Delivery blocked: ${finding.detail}. Connect the required integration and rerun — Violema ${FABRICATED_EVIDENCE_ERROR_MARKER}.`;
}

/**
 * Whether a recorded step error is the fabricated-evidence block.
 *
 * Platform telemetry uses this to COUNT these blocks without emitting the error
 * text, which names the workspace's own artifacts.
 */
export function isFabricatedEvidenceDeliveryError(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes(FABRICATED_EVIDENCE_ERROR_MARKER);
}
