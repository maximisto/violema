import { useEffect, useState } from 'react';
import { resolveWorkspaceContext } from './workspace';

export type CreditSource = 'mock' | 'api';

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

const MOCK_CREDIT_SNAPSHOT: CreditSnapshot = {
  source: 'mock',
  workspaceId: 'purpleorangehq',
  workspaceName: 'Purple Orange HQ',
  planName: 'Pro',
  creditsRemaining: 1684,
  creditsTotal: 2000,
  estimatedTaskCost: 18,
  automationBurnMonthly: 420,
  referralBonus: 2000,
  topUpSuggestion: 500,
  projectedDaysLeft: 18,
  lastUpdatedAt: new Date().toISOString(),
};

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

const MOCK_RECENT_USAGE: RecentCreditUsage[] = [
  {
    id: 'usage-1',
    title: 'Revenue research brief',
    detail: 'Search + synthesis + report',
    credits: 28,
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    tone: 'violet',
  },
  {
    id: 'usage-2',
    title: 'Hourly Stripe monitor',
    detail: 'Automation run + Slack digest',
    credits: 16,
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    tone: 'cyan',
  },
  {
    id: 'usage-3',
    title: 'Browser screenshot audit',
    detail: 'Capture + visual check',
    credits: 8,
    timestamp: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    tone: 'amber',
  },
];

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

async function fetchCreditSnapshot(signal?: AbortSignal): Promise<CreditSnapshot> {
  const workspace = resolveWorkspaceContext();

  for (const endpoint of CREDIT_ENDPOINTS) {
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
  return MOCK_CREDIT_SNAPSHOT;
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

async function fetchRecentUsage(signal?: AbortSignal): Promise<RecentCreditUsage[]> {
  const workspace = resolveWorkspaceContext();

  for (const endpoint of RECENT_USAGE_ENDPOINTS) {
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

  return MOCK_RECENT_USAGE;
}

export function useCreditSnapshot() {
  const [snapshot, setSnapshot] = useState<CreditSnapshot>(MOCK_CREDIT_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh(signal?: AbortSignal) {
    setIsLoading(true);
    try {
      const nextSnapshot = await fetchCreditSnapshot(signal);
      setSnapshot(nextSnapshot);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);

    return () => controller.abort();
  }, []);

  return { snapshot, isLoading, refresh };
}

export function useRecentCreditUsage() {
  const [items, setItems] = useState<RecentCreditUsage[]>(MOCK_RECENT_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    fetchRecentUsage(controller.signal)
      .then(setItems)
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  return { items, isLoading };
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
    'Try Violema: an AI coworker for chat, research, automations, and delegated work.',
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
  if (planName === 'Starter') return 'pro';
  if (planName === 'Pro') return 'team';
  return null;
}

export async function createBillingCheckout(input: {
  kind: 'subscription' | 'top-up';
  planId?: 'starter' | 'pro' | 'team';
  offerId?: TopUpOfferId | string;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const request = getWorkspaceRequest(
    input.kind === 'subscription'
      ? '/api/billing/stripe/checkout/subscription'
      : '/api/billing/stripe/checkout/top-up'
  );
  const successUrl = input.successUrl || `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = input.cancelUrl
    || `${window.location.origin}${window.location.pathname.startsWith('/dashboard') ? '/dashboard?checkout=cancel' : '/plans?checkout=cancel'}`;

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

  if (!response.ok) {
    throw new Error(`Checkout failed: ${response.status}`);
  }

  return response.json() as Promise<{
    ok: boolean;
    session?: { checkoutUrl: string; provider: 'stripe' | 'mock'; status: 'ready' | 'mocked' };
  }>;
}

export async function openBillingCheckout(input: {
  kind: 'subscription' | 'top-up';
  planId?: 'starter' | 'pro' | 'team';
  offerId?: TopUpOfferId | string;
  successUrl?: string;
  cancelUrl?: string;
}) {
  const result = await createBillingCheckout(input);
  if (result.session?.checkoutUrl) {
    window.location.assign(result.session.checkoutUrl);
    return true;
  }
  return false;
}
