/**
 * Affordability check that runs *before* a run spends anything.
 *
 * THE INCIDENT THIS EXISTS FOR
 *
 * A tenant triggered a mission with 105 credits available against a 200-credit
 * plan. `acquireCreditHold` is meant to be the gate, but the hold is taken only
 * after the task and task-run records exist, and the run then did all of its
 * expensive work — model calls, tool calls, a Drive write — before
 * `settleCreditHold` finally threw `Insufficient credits. 105 available, 200
 * required.` The customer paid for that work in wall-clock time and provider
 * spend, and the exception unwound into a catch block that overwrote the run's
 * artifacts, so the run appeared to vanish.
 *
 * `billing.assertCanSpendCredits` already encoded the right question, but
 * nothing in the run path ever asked it — it had no production caller. This
 * module is the non-throwing form of that question, placed at the one point
 * where the answer is still free: after the execution plan is built (so the
 * estimate is real) and before any record, hold, or model call.
 *
 * A workspace that cannot afford the plan gets the same treatment as one that
 * is not connected — a visible, zero-credit blocked run naming exactly what is
 * short and what to do about it.
 *
 * Both reads are injectable so the arithmetic and the wording can be tested
 * without a platform store on disk.
 */

import { getApplicableTopUpOffer } from './billing';
import { getWorkspaceCreditReserve } from './store';

/** The shortfall math, independent of how the numbers were obtained. */
export interface RunAffordability {
  affordable: boolean;
  /** Credits the workspace can spend right now, net of other active holds. */
  availableCredits: number;
  /** What this run's plan is estimated to cost. */
  requiredCredits: number;
  /** `requiredCredits - availableCredits`, floored at 0. */
  shortfallCredits: number;
}

export interface RunAffordabilityInput {
  workspaceId: string;
  estimatedCredits: number;
  now?: Date;
  /** Injected in tests; defaults to the real ledger read. */
  readAvailableCredits?: (workspaceId: string, now: Date) => number;
}

/**
 * Can this workspace pay for a run estimated at `estimatedCredits`?
 *
 * Reads the same reserve figure `acquireCreditHold` compares against, so a
 * `true` here and a hold taken immediately afterwards agree unless a concurrent
 * run grabs credits in between — in which case `acquireCreditHold` still
 * refuses and the existing failure path handles it. This check makes the common
 * case honest and cheap; it does not replace the hold as the authority.
 */
export function checkRunAffordability(input: RunAffordabilityInput): RunAffordability {
  const now = input.now || new Date();
  const read = input.readAvailableCredits
    ?? ((workspaceId: string, at: Date) => getWorkspaceCreditReserve(workspaceId, at).availableCredits);

  const requiredCredits = Math.max(0, Math.trunc(input.estimatedCredits));
  const availableCredits = Math.max(0, Math.trunc(read(input.workspaceId, now)));

  return {
    affordable: availableCredits >= requiredCredits,
    availableCredits,
    requiredCredits,
    shortfallCredits: Math.max(0, requiredCredits - availableCredits),
  };
}

/** The stable code every credit-block surface uses — HTTP, ledger, and run metadata. */
export const INSUFFICIENT_CREDITS_CODE = 'insufficient_credits';

/** Where a founder goes to fix it. Matches the connect-route convention. */
export const CREDITS_ROUTE = '/billing';

/**
 * A blocker in the shape the readiness panel already renders, so a credit block
 * and a connection block look and behave the same in the UI.
 */
export interface CreditBlocker {
  code: typeof INSUFFICIENT_CREDITS_CODE;
  source: 'credits';
  message: string;
  can_continue: false;
  nextAction: { label: string; route: string };
}

export interface CreditBlockDescriptor {
  code: typeof INSUFFICIENT_CREDITS_CODE;
  summary: string;
  blockers: CreditBlocker[];
  availableCredits: number;
  requiredCredits: number;
  shortfallCredits: number;
  /** Credits the smallest sufficient top-up would add, when one is offered. */
  suggestedTopUpCredits?: number;
  blockedAt: string;
}

/**
 * Build the human summary and blocker for a run that could not be afforded.
 *
 * The summary names all three numbers on purpose. "Insufficient credits" alone
 * sent the founder digging through the ledger; "105 available, 200 required —
 * 95 short" is something they can act on without leaving the run. It also
 * states plainly that nothing was spent and nothing was sent, because the whole
 * point of blocking here rather than at settle time is that both are true.
 */
export function buildInsufficientCreditsBlock(input: {
  automationName: string;
  affordability: RunAffordability;
  now?: Date;
  /** Injected in tests; defaults to the real top-up catalog. */
  readTopUpCredits?: (availableCredits: number, requiredCredits: number) => number | undefined;
}): CreditBlockDescriptor {
  const { availableCredits, requiredCredits, shortfallCredits } = input.affordability;

  const readTopUp = input.readTopUpCredits
    ?? ((available: number, required: number) => {
      try {
        const offer = getApplicableTopUpOffer(available, required);
        const credits = offer.credits + (offer.bonusCredits || 0);
        return Number.isFinite(credits) && credits > 0 ? credits : undefined;
      } catch {
        // A missing or malformed offer catalog must not turn a clean block into
        // a crash — the numbers above are already actionable without it.
        return undefined;
      }
    });

  const suggestedTopUpCredits = readTopUp(availableCredits, requiredCredits);

  const summary = [
    `"${input.automationName}" did not run: this workspace does not have enough credits for it.`,
    `${availableCredits} available, ${requiredCredits} required — ${shortfallCredits} short.`,
    'Nothing was spent and nothing was sent.',
    suggestedTopUpCredits
      ? `Add ${suggestedTopUpCredits} credits or upgrade the plan, then run it again.`
      : 'Add credits or upgrade the plan, then run it again.',
  ].join(' ');

  return {
    code: INSUFFICIENT_CREDITS_CODE,
    summary,
    blockers: [
      {
        code: INSUFFICIENT_CREDITS_CODE,
        source: 'credits',
        message: summary,
        can_continue: false,
        nextAction: { label: 'Add credits', route: CREDITS_ROUTE },
      },
    ],
    availableCredits,
    requiredCredits,
    shortfallCredits,
    ...(suggestedTopUpCredits ? { suggestedTopUpCredits } : {}),
    blockedAt: (input.now || new Date()).toISOString(),
  };
}

/**
 * The honest reason recorded on a run whose actual cost exceeded what the
 * workspace could pay at settle time.
 *
 * The run is marked failed, but its artifacts stay: the work happened, the
 * customer can still read what came out of it, and hiding it would be the
 * second bug rather than the fix.
 */
export function buildCreditOverrunReason(input: {
  automationName: string;
  settledCredits: number;
  requestedCredits: number;
  overrunCredits: number;
}): string {
  return [
    `"${input.automationName}" finished its work but cost more credits than this workspace could cover.`,
    `${input.requestedCredits} credits were used, ${input.settledCredits} could be charged — ${input.overrunCredits} short.`,
    'The run and everything it produced are kept below.',
    'Add credits before the next run so it is not interrupted.',
  ].join(' ');
}
