// Explicit `.ts` specifier allowed here (allowImportingTsExtensions) so the
// Node contract test can import this module directly, matching reviewQueue.ts.

/**
 * Whether a mission has a delivery lane at all.
 *
 * Why this exists: the Reviews surface rendered "Approve delivery" and
 * "Request changes" for every selected mission, including missions whose
 * workflow never sends anything (library-only or analysis-only runs). An
 * approve button on a mission with nothing to send implies a send that does
 * not exist — the exact kind of quiet dishonesty the review gate is supposed
 * to prevent.
 *
 * Two independent signals, either one is enough:
 * - the automation has a `notify` target configured, or
 * - the mission's step lane contains a `deliver` step (real executions from
 *   `latestStepExecutions`, or action-inferred steps for missions that have
 *   not run yet).
 *
 * Erring on `true` is deliberate: showing an approval that turns out to send
 * nothing is confusing, but hiding the approval on a mission that WOULD send
 * is a trust failure. Any hint of a delivery lane keeps the controls.
 */
export interface DeliveryLaneStep {
  kind?: string;
}

export interface DeliveryLaneSource {
  notify?: string | null;
  steps?: readonly DeliveryLaneStep[] | null;
}

export function missionHasDeliveryLane(source: DeliveryLaneSource | null | undefined): boolean {
  if (!source) return false;
  if (source.notify?.trim()) return true;
  return Boolean(source.steps?.some((step) => step.kind === 'deliver'));
}

/** Tile copy for a mission with no delivery lane — pinned by the contract. */
export const NO_DELIVERY_TILE_VALUE = 'No delivery step';
export const NO_DELIVERY_TILE_DETAIL = 'This mission stores its output. Nothing is sent anywhere.';
export const NO_DELIVERY_NEXT_VALUE = 'No approval needed';
export const NO_DELIVERY_NEXT_DETAIL = 'Without a delivery step there is nothing to approve or hold.';
export const NO_DELIVERY_CONTROLS_NOTE =
  'This mission has no delivery step, so there is no send to approve or hold. Rerun is still available.';
