/**
 * Which step failures are allowed to cost a run its delivery.
 *
 * THE INCIDENT
 *
 * A tenant ran the Competitor monitor. It read the library, searched the web
 * live, analysed the delta, and drafted a fully source-backed memo. Then
 * "Record findings in the library" failed — Google Drive was connected but
 * lacked write scope. Because one step failed, the run was marked failed, the
 * task went `blocked`, `reviewRequired` went false, and the approval queue told
 * the founder "Nothing is waiting for approval." A perfectly good memo became
 * unreachable because a filing cabinet was locked.
 *
 * THE RULE
 *
 * Not all step failures are equal, and the dividing line is evidence integrity,
 * not convenience:
 *
 *   - If the failure means the output might not be TRUE, block. A required
 *     source that failed, a required query that failed, fabricated evidence —
 *     none of that may reach a customer. This is the trust floor.
 *
 *   - If the failure means something was not FILED, warn. The memo's evidence
 *     came from live reads that already succeeded; a failed archival write
 *     removes nothing from it. The founder must still be able to approve, with
 *     the run honestly flagged as not archived.
 *
 * WHY THE DEFAULT IS `critical`
 *
 * This module answers "may this failure be tolerated", and the safe answer to a
 * question you cannot answer is no. A step earns `auxiliary` by being named
 * here. Anything else — a new step kind, a query against a source nobody has
 * classified, an older persisted record from before severity existed — blocks
 * exactly as it does today. Adding a step must never silently widen what can be
 * delivered past a failure.
 *
 * WHY THE LIBRARY *READ* IS NOT HERE
 *
 * The read is deliberately absent, and that is the load-bearing asymmetry.
 * A failed WRITE loses bookkeeping the next run can re-derive. A failed READ
 * removes the baseline the memo is compared against, so the very claim the
 * mission exists to make ("here is what CHANGED") loses its other side. Worse,
 * `renderLibraryContextMarkdown` renders an unreachable library the same way it
 * renders an empty one — "treat this run as the baseline" — so tolerating a
 * failed read would have the analysis assert a fresh start for an account with
 * months of history. That is a quiet lie, which is the failure mode this
 * codebase exists to prevent. Separating "unavailable" from "empty" in the
 * library context is the precondition for ever revisiting this.
 */

import { isAccountLibraryWriteRequest } from '../integrationGateway/accountLibrary';
import type { AutomationStepKind, AutomationStepSeverity } from './types';

/**
 * Classify one step. Pure, and driven only by what the step IS — its kind and
 * its inputs — so a plan and its executions can never disagree about severity.
 */
export function resolveAutomationStepSeverity(step: {
  kind: AutomationStepKind;
  inputs?: Record<string, unknown> | null;
}): AutomationStepSeverity {
  // The account library WRITE: archival bookkeeping into the customer's own
  // Drive, run after the memo is already drafted from evidence that stands on
  // its own. Requires BOTH the library source and an explicit write query type,
  // so a library step that merely omits its query type is not excused.
  if (step.kind === 'query' && isAccountLibraryWriteRequest(step.inputs ?? undefined)) {
    return 'auxiliary';
  }

  return 'critical';
}
