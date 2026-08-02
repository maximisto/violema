/**
 * Account stage — where an account stands in its lifecycle with Violema.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO AXES, NOT ONE LIST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `participantType` (betaProgram.ts) answers WHO SOMEONE IS — founder/operator,
 * investor, partner, team member, advisor. It is classification only: it never
 * grants authority and never bypasses a gate. `role` (user | admin) remains the
 * sole authorization axis.
 *
 * `accountStage` (this module) answers WHERE THEY ARE WITH US — internal,
 * applicant, trial, paying, lapsed. It is likewise classification only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DERIVED, NOT HAND-SET
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * There is deliberately no "mark this account as paying" button. A manually
 * toggled flag drifts from reality within weeks, and then the admin dashboard is
 * lying to the operator who trusts it. Every stage here is computed from state
 * that some other system already owns:
 *
 *   - billing truth      → `WorkspaceBillingConfig.subscriptionStatus`, written
 *                          only by the Stripe webhook (platform/stripe.ts)
 *   - access truth       → `AdminAccessRecord.status` (adminAccessStore.ts) and
 *                          the approved-email configuration (auth.ts)
 *   - trial truth        → the one-time `trial_grant` credit ledger entry
 *                          (betaTrialCredits.ts)
 *   - tenancy truth      → DEFAULT_WORKSPACE_ID / demo workspaces
 *                          (platform/workspace.ts, platform/demoWorkspace.ts)
 *
 * The single admin-settable input is an `internal` override, for the case a real
 * teammate signs up through the normal funnel. It can only ever produce
 * `internal` — it can never claim revenue that Stripe does not know about.
 *
 * This module is PURE by construction: it imports no store and reads no file,
 * so it is testable without fixtures-in-fixtures — and so the access store,
 * which persists the override, can depend on it without a cycle. The impure
 * collector that gathers the signals lives in `../accountStageDirectory.ts`.
 *
 * Every result carries `reason` (a short human sentence) and `derivedFrom` (the
 * signals consulted) so the admin UI can show WHY a stage says what it says.
 * `reason` is composed exclusively from literals, closed-set enums, dates, and
 * counts — never from user-authored text, an email, or a workspace name.
 */

export type AccountStage = 'internal' | 'applicant' | 'trial' | 'paying' | 'lapsed';

/** Canonical order, used for stable funnel output week to week. */
export const ACCOUNT_STAGES: AccountStage[] = ['internal', 'applicant', 'trial', 'paying', 'lapsed'];

/** The only stage an admin may assert by hand. Revenue stages stay derived. */
export type AccountStageOverride = 'internal';
export const ACCOUNT_STAGE_OVERRIDES: AccountStageOverride[] = ['internal'];

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid';

export type AccessStatus = 'requested' | 'approved' | 'revoked';

/** Signals the derivation reads. Everything is passed in; nothing is looked up. */
export interface AccountStageInput {
  isDefaultWorkspace: boolean;
  isDemoWorkspace: boolean;
  /** Authorization axis. An admin is staff, wherever their workspace lives. */
  role: 'user' | 'admin';
  accessStatus: AccessStatus | null;
  /** Mirrors `isEmailApprovedForAccess`: record approval OR configured email. */
  approvedForAccess: boolean;
  subscriptionStatus?: SubscriptionStatus | null;
  /** When billing state last changed. We do not store a subscription start. */
  subscriptionStatusAt?: string | null;
  hasTrialGrant: boolean;
  trialGrantedAt?: string | null;
  trialCredits?: number | null;
  accessStatusAt?: string | null;
  stageOverride?: AccountStageOverride | null;
  stageOverrideAt?: string | null;
}

export interface AccountStageResolution {
  stage: AccountStage;
  reason: string;
  derivedFrom: string[];
}

/**
 * Activation predicate, single-sourced so the admin filter and the weekly brief
 * cannot drift. "Activated" means the account has completed at least one run —
 * a run that actually succeeded, not merely one that was started.
 */
export function isActivatingRunStatus(status: string | null | undefined): boolean {
  return status === 'succeeded';
}

const SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'unpaid',
]);

export function normalizeAccountStage(value: unknown): AccountStage | null {
  return typeof value === 'string' && ACCOUNT_STAGES.includes(value as AccountStage)
    ? (value as AccountStage)
    : null;
}

export function normalizeAccountStageOverride(value: unknown): AccountStageOverride | null {
  return typeof value === 'string' && ACCOUNT_STAGE_OVERRIDES.includes(value as AccountStageOverride)
    ? (value as AccountStageOverride)
    : null;
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus | null {
  return typeof value === 'string' && SUBSCRIPTION_STATUSES.has(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : null;
}

/** `2026-07-14` from an ISO timestamp, or null when it is not a real date. */
function formatDay(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function withDay(sentence: string, day: string | null, suffix = ''): string {
  return day ? `${sentence} on ${day}${suffix}.` : `${sentence}${suffix}.`;
}

function resolve(stage: AccountStage, reason: string, derivedFrom: string[]): AccountStageResolution {
  return { stage, reason, derivedFrom };
}

/**
 * Pure stage derivation. Evaluation order is load-bearing:
 *
 *   1. internal override, then admin role, then Violema's own/demo workspaces —
 *      staff and demo surfaces must never be counted as pipeline or revenue.
 *   2. billing truth (paying / lapsed) — an account Stripe is charging is a
 *      paying account even if its beta access was later revoked; that mismatch
 *      is exactly what an operator needs to see.
 *   3. access truth (revoked → lapsed, approved → trial).
 *   4. applicant as the honest default.
 *
 * `lapsed` means "the relationship ended": a subscription that is no longer
 * active, or beta access that was revoked. Both are real stored transitions, so
 * neither is fabricated, and `reason` always says which one happened.
 */
export function resolveAccountStage(input: AccountStageInput): AccountStageResolution {
  const subscriptionStatus = normalizeSubscriptionStatus(input.subscriptionStatus);
  const billingDay = formatDay(input.subscriptionStatusAt);
  const billingNote = billingDay ? ` (billing state as of ${billingDay})` : '';

  // ── 1. internal
  const override = normalizeAccountStageOverride(input.stageOverride);
  if (override === 'internal') {
    return resolve(
      'internal',
      withDay('Marked internal by an admin', formatDay(input.stageOverrideAt)),
      ['accountStage.override'],
    );
  }
  if (input.role === 'admin') {
    return resolve('internal', 'Admin role — Violema staff, not a customer.', ['authUser.role']);
  }
  if (input.isDefaultWorkspace) {
    return resolve('internal', "Runs in Violema's own default workspace.", ['workspace.isDefault']);
  }
  if (input.isDemoWorkspace) {
    return resolve('internal', 'Demo workspace — labeled sample surface.', ['workspace.isDemo']);
  }

  // ── 2. billing truth
  if (subscriptionStatus === 'active') {
    return resolve('paying', `Active subscription${billingNote}.`, ['billing.subscriptionStatus']);
  }
  if (subscriptionStatus === 'past_due') {
    return resolve(
      'paying',
      `Subscription is past due — payment is failing${billingNote}.`,
      ['billing.subscriptionStatus'],
    );
  }
  if (subscriptionStatus === 'canceled') {
    return resolve('lapsed', `Subscription canceled${billingNote}.`, ['billing.subscriptionStatus']);
  }
  if (subscriptionStatus === 'unpaid') {
    return resolve(
      'lapsed',
      `Subscription unpaid and no longer active${billingNote}.`,
      ['billing.subscriptionStatus'],
    );
  }

  // `incomplete` is a checkout that never finished: no money changed hands, so
  // it is not paying and it is not a lapse. It only annotates the stage below.
  const incompleteCheckout = subscriptionStatus === 'incomplete';
  const incompleteNote = incompleteCheckout ? ' Checkout was started but never completed.' : '';
  const billingSignals = incompleteCheckout ? ['billing.subscriptionStatus'] : [];

  // ── 3. access truth
  if (input.accessStatus === 'revoked') {
    return resolve(
      'lapsed',
      withDay('Beta access revoked', formatDay(input.accessStatusAt), '; no active subscription')
        + incompleteNote,
      ['access.status', ...billingSignals],
    );
  }

  if (subscriptionStatus === 'trialing') {
    return resolve(
      'trial',
      `Stripe trial period — no charge has been taken yet${billingNote}.`,
      ['billing.subscriptionStatus'],
    );
  }

  if (input.approvedForAccess) {
    if (input.hasTrialGrant) {
      const credits = typeof input.trialCredits === 'number' && Number.isFinite(input.trialCredits)
        ? `${Math.round(input.trialCredits)}-credit `
        : '';
      return resolve(
        'trial',
        withDay(
          `Approved for beta with a ${credits}trial grant`,
          formatDay(input.trialGrantedAt),
          '; no paid subscription',
        ) + incompleteNote,
        ['access.status', 'ledger.trial_grant', ...billingSignals],
      );
    }
    return resolve(
      'trial',
      `Approved for beta; trial credits not granted yet, no paid subscription.${incompleteNote}`,
      ['access.status', ...billingSignals],
    );
  }

  // ── 4. applicant
  if (input.accessStatus === 'requested') {
    return resolve(
      'applicant',
      `Applied for beta access; not approved yet.${incompleteNote}`,
      ['access.status', ...billingSignals],
    );
  }
  return resolve(
    'applicant',
    `No approved access and no billing relationship on record.${incompleteNote}`,
    ['access.status', ...billingSignals],
  );
}
