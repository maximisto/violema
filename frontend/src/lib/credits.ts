import { useCallback, useEffect, useState } from 'react';
import { resolveWorkspaceContext } from './workspace';

/**
 * A CreditSnapshot only ever exists when it came back from the billing API.
 * There is deliberately no 'mock' member: fabricated financial state must not
 * be representable on the authenticated product path.
 */
export type CreditSource = 'api';

/** Loading / resolved / could-not-reach-the-API. Never "here are some numbers anyway". */
export type CreditDataStatus = 'loading' | 'ready' | 'unavailable';

export const CREDITS_UNAVAILABLE_TITLE = 'Usage unavailable';
export const CREDITS_UNAVAILABLE_DETAIL =
  'We could not reach the billing service, so no balance is shown. Nothing here is estimated or assumed.';

export interface CreditSnapshot {
  source: CreditSource;
  workspaceId: string;
  workspaceName: string;
  planName: string;
  creditsRemaining: number;
  creditsTotal: number;
  estimatedTaskCost: number;
  automationBurnMonthly: number;
  referralBonus: number;
  topUpSuggestion: number;
  projectedDaysLeft: number;
  lastUpdatedAt: string;
}

export interface RecentCreditUsage {
  id: string;
  title: string;
  detail: string;
  credits: number;
  timestamp: string;
  tone: 'violet' | 'cyan' | 'amber';
  // enriched cost-visibility fields (optional — only present when token data exists)
  modelTier?: string;
  status?: string;
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  providerCostUsd?: number | null;
  modelRoutes?: string[];
  creditValueUsd?: number;
  marginPct?: number | null;
}

export interface CreditEstimateInput {
  taskKind?: 'chat' | 'research' | 'analysis' | 'engineering' | 'automation' | 'message' | 'report' | 'review' | 'scheduling';
  modelTier?: 'micro' | 'default' | 'hard' | 'critical' | 'ops';
  toolCalls?: number;
  automationRuns?: number;
  reviewRequired?: boolean;
  artifactCount?: number;
  complexity?: 'low' | 'medium' | 'high';
  durationSeconds?: number;
}

export interface CreditEstimate {
  estimatedCredits: number;
  breakdown: {
    baseCredits: number;
    modelCredits: number;
    toolCredits: number;
    automationCredits: number;
    reviewCredits: number;
    artifactCredits: number;
    durationCredits: number;
    complexityCredits: number;
  };
  rationale: string[];
}

export type TopUpOfferId = 'topup_500' | 'topup_1500' | 'topup_5000';

export interface TopUpOption {
  id: TopUpOfferId;
  credits: number;
  priceUsd: number;
  label: string;
  description: string;
}

export const TOP_UP_OPTIONS: TopUpOption[] = [
  {
    id: 'topup_500',
    credits: 500,
    priceUsd: 35,
    label: 'Light boost',
    description: 'Best for lighter weekly usage or a short burst of work.',
  },
  {
    id: 'topup_1500',
    credits: 1500,
    priceUsd: 99,
    label: 'Most flexible',
    description: 'Good for steady multi-step work without changing plans.',
  },
  {
    id: 'topup_5000',
    credits: 5000,
    priceUsd: 249,
    label: 'Heavy execution',
    description: 'Built for teams running more automations and delegated work.',
  },
];

const CREDIT_ENDPOINTS = ['/api/billing/usage', '/api/usage/credits'];
const RECENT_USAGE_ENDPOINTS = ['/api/billing/recent-usage', '/api/usage/recent', '/api/usage/activity'];

function isCreditSnapshot(value: unknown): value is CreditSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snap = value as Partial<CreditSnapshot>;
  return (
    typeof snap.planName === 'string' &&
    typeof snap.creditsRemaining === 'number' &&
    typeof snap.creditsTotal === 'number' &&
    typeof snap.estimatedTaskCost === 'number' &&
    typeof snap.automationBurnMonthly === 'number' &&
    typeof snap.referralBonus === 'number' &&
    typeof snap.topUpSuggestion === 'number' &&
    typeof snap.projectedDaysLeft === 'number' &&
    typeof snap.lastUpdatedAt === 'string'
  );
}

function buildWorkspaceRequest(endpoint: string, context: ReturnType<typeof resolveWorkspaceContext>) {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set('workspace_id', context.workspaceId);
  url.searchParams.set('workspace_name', context.workspaceName);
  return {
    url: url.toString(),
    headers: {
      'X-Workspace-Id': context.workspaceId,
      'X-Workspace-Name': context.workspaceName,
    },
  };
}

export function getWorkspaceRequest(endpoint: string) {
  return buildWorkspaceRequest(endpoint, resolveWorkspaceContext());
}

/** Returns null when no endpoint could produce a real snapshot. Never substitutes numbers. */
async function fetchCreditSnapshot(signal?: AbortSignal): Promise<CreditSnapshot | null> {
  const workspace = resolveWorkspaceContext();

  for (const endpoint of CREDIT_ENDPOINTS) {
    if (signal?.aborted) return null;
    try {
      const request = buildWorkspaceRequest(endpoint, workspace);
      const response = await fetch(request.url, { signal, headers: request.headers });
      if (!response.ok) continue;
      const data = await response.json() as unknown;
      if (isCreditSnapshot(data)) {
        return {
          ...data,
          source: 'api',
          workspaceId: data.workspaceId || workspace.workspaceId,
          workspaceName: data.workspaceName || workspace.workspaceName,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function isRecentCreditUsageList(value: unknown): value is RecentCreditUsage[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const usage = item as Partial<RecentCreditUsage>;
    return (
      typeof usage.id === 'string' &&
      typeof usage.title === 'string' &&
      typeof usage.detail === 'string' &&
      typeof usage.credits === 'number' &&
      typeof usage.timestamp === 'string' &&
      (usage.tone === 'violet' || usage.tone === 'cyan' || usage.tone === 'amber')
    );
  });
}

/** Returns null when no endpoint could produce a real usage list. Never substitutes events. */
async function fetchRecentUsage(signal?: AbortSignal): Promise<RecentCreditUsage[] | null> {
  const workspace = resolveWorkspaceContext();

  for (const endpoint of RECENT_USAGE_ENDPOINTS) {
    if (signal?.aborted) return null;
    try {
      const request = buildWorkspaceRequest(endpoint, workspace);
      const response = await fetch(request.url, { signal, headers: request.headers });
      if (!response.ok) continue;
      const data = await response.json() as unknown;
      if (isRecentCreditUsageList(data)) {
        return data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * `snapshot` is null until a real API response lands, and returns to null if a
 * later refresh fails. Consumers must render loading or "usage unavailable"
 * rather than any placeholder balance.
 */
export function useCreditSnapshot() {
  const [snapshot, setSnapshot] = useState<CreditSnapshot | null>(null);
  const [status, setStatus] = useState<CreditDataStatus>('loading');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    const nextSnapshot = await fetchCreditSnapshot(signal);
    if (signal?.aborted) return;
    setSnapshot(nextSnapshot);
    setStatus(nextSnapshot ? 'ready' : 'unavailable');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);

    return () => controller.abort();
  }, [refresh]);

  return { snapshot, status, isLoading: status === 'loading', refresh };
}

/** `items` is empty — not fabricated — whenever usage could not be read. */
export function useRecentCreditUsage() {
  const [items, setItems] = useState<RecentCreditUsage[]>([]);
  const [status, setStatus] = useState<CreditDataStatus>('loading');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    const next = await fetchRecentUsage(signal);
    if (signal?.aborted) return;
    setItems(next || []);
    setStatus(next ? 'ready' : 'unavailable');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);

    return () => controller.abort();
  }, [refresh]);

  return { items, status, isLoading: status === 'loading', refresh };
}

export async function fetchCreditEstimate(input: CreditEstimateInput): Promise<CreditEstimate | null> {
  try {
    const workspace = resolveWorkspaceContext();
    const response = await fetch('/api/billing/estimate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace.workspaceId,
        'X-Workspace-Name': workspace.workspaceName,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return await response.json() as CreditEstimate;
  } catch {
    return null;
  }
}

export function formatCredits(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatRelativeTime(isoString: string) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getCreditRecommendation(snapshot: CreditSnapshot) {
  if (snapshot.projectedDaysLeft <= 7) {
    return {
      tone: 'urgent' as const,
      title: 'Low runway',
      detail: 'Add credits or upgrade before automation burn becomes visible to users.',
    };
  }

  if (snapshot.projectedDaysLeft <= 18) {
    return {
      tone: 'watch' as const,
      title: 'Healthy, but watch burn',
      detail: 'You can keep the current plan, but a top-up would smooth the next two weeks.',
    };
  }

  return {
    tone: 'good' as const,
    title: 'Comfortable runway',
    detail: 'You have room to experiment. Referral credits and top-ups are optional for now.',
  };
}

export function buildTopUpRequest(snapshot: CreditSnapshot) {
  return [
    'Hi team, I would like to add credits to my Violema workspace.',
    `Workspace: ${snapshot.workspaceName} (${snapshot.workspaceId})`,
    `Current plan: ${snapshot.planName}`,
    `Suggested top-up: ${formatCredits(snapshot.topUpSuggestion)} credits`,
    `Current balance: ${formatCredits(snapshot.creditsRemaining)} / ${formatCredits(snapshot.creditsTotal)}`,
  ].join('\n');
}

export function buildReferralMessage(snapshot: CreditSnapshot) {
  return [
    'Try Violema: the reviewable AI operator for research, automations, and delegated work.',
    `Workspace: ${snapshot.workspaceName}`,
    `New users get a bonus, and I get ${formatCredits(snapshot.referralBonus)} credits when you join.`,
    'Start here: https://violema.com',
  ].join('\n');
}

export function getSuggestedTopUpOfferId(snapshot: CreditSnapshot): TopUpOfferId {
  if (snapshot.topUpSuggestion >= 5000) return 'topup_5000';
  if (snapshot.topUpSuggestion >= 1500) return 'topup_1500';
  return 'topup_500';
}

export function getSuggestedUpgradePlanId(planName: string): 'pro' | 'team' | null {
  if (planName === 'Starter' || planName === 'Legacy Starter') return 'pro';
  if (planName === 'Start' || planName === 'Founder') return 'team';
  return null;
}

export class BillingCheckoutError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'BillingCheckoutError';
  }
}

interface BillingCheckoutSessionResponse {
  checkoutUrl?: string;
  provider?: 'stripe' | 'mock';
  status?: 'ready' | 'mocked';
}

/**
 * A real, payable checkout, or an explicit refusal. There is no third shape:
 * a mocked session never carries a `checkoutUrl` out of this module, so no
 * caller can accidentally dress a simulated purchase up as a completed one.
 */
export type BillingCheckoutOutcome =
  | { kind: 'ready'; checkoutUrl: string }
  | { kind: 'unavailable'; reason: 'payments_not_configured' | 'no_session' };

/** Treat anything that is not provably a live Stripe session as simulated. */
function isSimulatedCheckoutSession(session: BillingCheckoutSessionResponse): boolean {
  return (
    session.provider === 'mock'
    || session.status === 'mocked'
    || session.provider !== 'stripe'
    || (session.checkoutUrl || '').includes('/mock-checkout/')
  );
}

export async function createBillingCheckout(input: {
  kind: 'subscription' | 'top-up';
  planId?: 'starter' | 'pro' | 'team';
  offerId?: TopUpOfferId | string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<BillingCheckoutOutcome> {
  const request = getWorkspaceRequest(
    input.kind === 'subscription'
      ? '/api/billing/stripe/checkout/subscription'
      : '/api/billing/stripe/checkout/top-up'
  );
  const billingReturnPath = window.location.pathname.startsWith('/dashboard')
    ? '/dashboard'
    : window.location.pathname.startsWith('/pricing')
      ? '/pricing'
      : '/plans';
  const successUrl = input.successUrl || `${window.location.origin}${billingReturnPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = input.cancelUrl
    || `${window.location.origin}${billingReturnPath}?checkout=cancel`;

  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...request.headers,
    },
    body: JSON.stringify(
      input.kind === 'subscription'
        ? { planId: input.planId, successUrl, cancelUrl }
        : { offerId: input.offerId, successUrl, cancelUrl }
    ),
  });

  const result = await response.json().catch(() => null) as {
    ok: boolean;
    error?: string;
    code?: string;
    session?: BillingCheckoutSessionResponse;
  } | null;

  if (!response.ok) {
    throw new BillingCheckoutError(
      result?.error || `Checkout failed with status ${response.status}.`,
      response.status,
      result?.code,
    );
  }
  if (!result) {
    throw new BillingCheckoutError('Checkout returned an invalid response.', response.status);
  }
  if (!result.session || !result.session.checkoutUrl) {
    return { kind: 'unavailable', reason: 'no_session' };
  }
  if (isSimulatedCheckoutSession(result.session)) {
    return { kind: 'unavailable', reason: 'payments_not_configured' };
  }
  return { kind: 'ready', checkoutUrl: result.session.checkoutUrl };
}

/** Redirects only for a live Stripe session. Returns false without navigating otherwise. */
export async function openBillingCheckout(input: {
  kind: 'subscription' | 'top-up';
  planId?: 'starter' | 'pro' | 'team';
  offerId?: TopUpOfferId | string;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const outcome = await createBillingCheckout(input);
  if (outcome.kind !== 'ready') return false;
  window.location.assign(outcome.checkoutUrl);
  return true;
}
