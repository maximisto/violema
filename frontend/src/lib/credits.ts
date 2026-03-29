import { useEffect, useState } from 'react';

export type CreditSource = 'mock' | 'api';

export interface CreditSnapshot {
  source: CreditSource;
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

const MOCK_CREDIT_SNAPSHOT: CreditSnapshot = {
  source: 'mock',
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

async function fetchCreditSnapshot(signal?: AbortSignal): Promise<CreditSnapshot> {
  for (const endpoint of CREDIT_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) continue;
      const data = await response.json() as unknown;
      if (isCreditSnapshot(data)) {
        return { ...data, source: 'api' };
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
  for (const endpoint of RECENT_USAGE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, { signal });
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
    `Current plan: ${snapshot.planName}`,
    `Suggested top-up: ${formatCredits(snapshot.topUpSuggestion)} credits`,
    `Current balance: ${formatCredits(snapshot.creditsRemaining)} / ${formatCredits(snapshot.creditsTotal)}`,
  ].join('\n');
}

export function buildReferralMessage(snapshot: CreditSnapshot) {
  return [
    'Try Nexus: an AI coworker for chat, research, automations, and delegated work.',
    `New users get a bonus, and I get ${formatCredits(snapshot.referralBonus)} credits when you join.`,
    'Start here: https://nexus.purpleorange.io',
  ].join('\n');
}
