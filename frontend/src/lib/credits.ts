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

const MOCK_CREDIT_SNAPSHOT: CreditSnapshot = {
  source: 'mock',
  workspaceId: 'workspace_default',
  workspaceName: 'Nexus HQ',
  planName: 'Growth',
  creditsRemaining: 684,
  creditsTotal: 1000,
  estimatedTaskCost: 18,
  automationBurnMonthly: 240,
  referralBonus: 2000,
  topUpSuggestion: 500,
  projectedDaysLeft: 22,
  lastUpdatedAt: new Date().toISOString(),
};

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

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    fetchCreditSnapshot(controller.signal)
      .then(setSnapshot)
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  return { snapshot, isLoading };
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
    'Hi team, I would like to add credits to my Nexus workspace.',
    `Workspace: ${snapshot.workspaceName} (${snapshot.workspaceId})`,
    `Current plan: ${snapshot.planName}`,
    `Suggested top-up: ${formatCredits(snapshot.topUpSuggestion)} credits`,
    `Current balance: ${formatCredits(snapshot.creditsRemaining)} / ${formatCredits(snapshot.creditsTotal)}`,
  ].join('\n');
}

export function buildReferralMessage(snapshot: CreditSnapshot) {
  return [
    'Try Nexus: an AI coworker for chat, research, automations, and delegated work.',
    `Workspace: ${snapshot.workspaceName}`,
    `New users get a bonus, and I get ${formatCredits(snapshot.referralBonus)} credits when you join.`,
    'Start here: https://nexus.purpleorange.io',
  ].join('\n');
}

export function getSuggestedTopUpOfferId(snapshot: CreditSnapshot) {
  if (snapshot.topUpSuggestion >= 5000) return 'topup_5000';
  if (snapshot.topUpSuggestion >= 1500) return 'topup_1500';
  return 'topup_500';
}

export async function createBillingCheckout(input: { kind: 'subscription' | 'top-up'; planId?: 'starter' | 'pro' | 'team'; offerId?: string }) {
  const request = getWorkspaceRequest(
    input.kind === 'subscription'
      ? '/api/billing/stripe/checkout/subscription'
      : '/api/billing/stripe/checkout/top-up'
  );

  const response = await fetch(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...request.headers,
    },
    body: JSON.stringify(input.kind === 'subscription' ? { planId: input.planId } : { offerId: input.offerId }),
  });

  if (!response.ok) {
    throw new Error(`Checkout failed: ${response.status}`);
  }

  return response.json() as Promise<{
    ok: boolean;
    session?: { checkoutUrl: string; provider: 'stripe' | 'mock'; status: 'ready' | 'mocked' };
  }>;
}
