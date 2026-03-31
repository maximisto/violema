import path from 'path';
import { canSpendCredits } from './ledger';
import { readJsonFile, writeJsonFile } from './jsonStore';
import { getWorkspaceLedgerSummary, listLedgerEntries, addLedgerEntry } from './store';
import type { BillingPlanId, PlanDefinition, TopUpOffer, WorkspaceBillingConfig } from './types';

export type BillingPlanTier = BillingPlanId;
export type PlanLimitKind = 'credits' | 'automations' | 'multi_agent' | 'approvals';
export type EnforcementSeverity = 'ok' | 'warning' | 'blocked';

export interface PlanLimitState {
  kind: PlanLimitKind;
  severity: EnforcementSeverity;
  current: number | boolean;
  limit?: number | boolean;
  message: string;
}

export interface BillingEnforcementCheck {
  allowed: boolean;
  severity: EnforcementSeverity;
  limits: PlanLimitState[];
  topUpOffer?: TopUpOffer;
}

export interface BillingStatus {
  config: WorkspaceBillingConfig;
  plan: PlanDefinition;
  summary: ReturnType<typeof getWorkspaceLedgerSummary>;
  offers: TopUpOffer[];
  topUpOffer: TopUpOffer;
  sourceHint: string;
  updatedAt: string;
}

export type BillingConfigPatch = Partial<
  Pick<
    WorkspaceBillingConfig,
    | 'planId'
    | 'seatCount'
    | 'autoTopUpEnabled'
    | 'autoTopUpThresholdCredits'
    | 'autoTopUpAmountCredits'
    | 'referralCode'
    | 'stripeCustomerId'
    | 'stripeSubscriptionId'
    | 'subscriptionStatus'
  >
>;

export const BILLING_CONFIG_FILE = path.join(process.cwd(), 'platform-billing-config.json');
export const TOP_UP_OFFERS_FILE = path.join(process.cwd(), 'platform-top-up-offers.json');

const DEFAULT_PLAN_CATALOG: Record<BillingPlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    stripeProductKey: 'nexus_starter_monthly',
    monthlyPriceUsd: 29,
    includedCredits: 500,
    maxAutomations: 3,
    includedSeats: 1,
    extraSeatPriceUsd: 29,
    supportTier: 'email',
    supportsMultiAgent: false,
    supportsApprovals: false,
    supportsSharedWorkspace: false,
    supportsLongTermMemory: false,
    supportsAnalyticsDashboard: false,
    features: [
      '500 Violema credits',
      '3 active automations',
      'Web research',
      'Code execution',
      'Email support',
    ],
    topUpEnabled: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    stripeProductKey: 'nexus_pro_monthly',
    monthlyPriceUsd: 79,
    includedCredits: 2000,
    maxAutomations: 20,
    includedSeats: 1,
    extraSeatPriceUsd: 29,
    supportTier: 'slack_email',
    supportsMultiAgent: true,
    supportsApprovals: false,
    supportsSharedWorkspace: false,
    supportsLongTermMemory: true,
    supportsAnalyticsDashboard: true,
    features: [
      '2,000 Violema credits',
      '20 active automations',
      'Multi-agent orchestration',
      'Task automation',
      'Long-term memory',
      'Slack + email support',
      'Analytics dashboard',
    ],
    topUpEnabled: true,
  },
  team: {
    id: 'team',
    name: 'Team',
    stripeProductKey: 'nexus_team_monthly',
    monthlyPriceUsd: 249,
    includedCredits: 7500,
    maxAutomations: 100,
    includedSeats: 5,
    extraSeatPriceUsd: 29,
    supportTier: 'priority',
    supportsMultiAgent: true,
    supportsApprovals: true,
    supportsSharedWorkspace: true,
    supportsLongTermMemory: true,
    supportsAnalyticsDashboard: true,
    features: [
      '7,500 Violema credits',
      '100 active automations',
      '5 included seats',
      'Approvals / review gates',
      'Admin visibility',
      'Shared workspace / shared memory',
      'Priority support',
    ],
    topUpEnabled: true,
  },
};

const DEFAULT_TOP_UP_OFFERS: TopUpOffer[] = [
  { id: 'topup_500', stripeProductKey: 'nexus_topup_500', credits: 500, priceUsd: 35 },
  { id: 'topup_1500', stripeProductKey: 'nexus_topup_1500', credits: 1500, priceUsd: 99 },
  { id: 'topup_5000', stripeProductKey: 'nexus_topup_5000', credits: 5000, priceUsd: 249 },
];

export function getDefaultPlanCatalog(): PlanDefinition[] {
  return Object.values(DEFAULT_PLAN_CATALOG);
}

export function listPlanDefinitions(): PlanDefinition[] {
  return getDefaultPlanCatalog();
}

export function getPlanDefinition(planId: BillingPlanId): PlanDefinition {
  return DEFAULT_PLAN_CATALOG[planId];
}

export function getDefaultBillingConfig(workspaceId: string): WorkspaceBillingConfig {
  return {
    workspaceId,
    planId: 'starter',
    seatCount: 1,
    autoTopUpEnabled: false,
    autoTopUpThresholdCredits: 100,
    autoTopUpAmountCredits: 500,
    referralCode: `VIOLEMA-${workspaceId.slice(-4).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function listBillingConfigs(): WorkspaceBillingConfig[] {
  return readJsonFile<WorkspaceBillingConfig[]>(BILLING_CONFIG_FILE, []);
}

function writeBillingConfigs(items: WorkspaceBillingConfig[]) {
  writeJsonFile(BILLING_CONFIG_FILE, items);
}

export function getBillingConfig(workspaceId: string): WorkspaceBillingConfig {
  const existing = listBillingConfigs().find((item) => item.workspaceId === workspaceId);
  if (existing) {
    return existing;
  }

  const created = getDefaultBillingConfig(workspaceId);
  const items = [created, ...listBillingConfigs()];
  writeBillingConfigs(items);
  return created;
}

export function getBillingConfigSnapshot(workspaceId: string): WorkspaceBillingConfig {
  const existing = listBillingConfigs().find((item) => item.workspaceId === workspaceId);
  return existing || getDefaultBillingConfig(workspaceId);
}

export function upsertBillingConfig(workspaceId: string, patch: BillingConfigPatch): WorkspaceBillingConfig {
  const current = getBillingConfig(workspaceId);
  const next: WorkspaceBillingConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const items = listBillingConfigs();
  const index = items.findIndex((item) => item.workspaceId === workspaceId);
  if (index === -1) {
    items.unshift(next);
  } else {
    items[index] = next;
  }
  writeBillingConfigs(items);
  return next;
}

export function listTopUpOffers(): TopUpOffer[] {
  const persisted = readJsonFile<TopUpOffer[]>(TOP_UP_OFFERS_FILE, []);
  const byId = new Map(persisted.map((offer) => [offer.id, offer]));
  return DEFAULT_TOP_UP_OFFERS.map((offer) => ({
    ...byId.get(offer.id),
    ...offer,
  }));
}

export function getApplicableTopUpOffer(balanceCredits: number, requiredCredits = 0): TopUpOffer {
  const neededCredits = Math.max(0, requiredCredits - balanceCredits);
  const offers = listTopUpOffers();
  return (
    offers.find((offer) => offer.credits + (offer.bonusCredits || 0) >= neededCredits) ||
    offers[offers.length - 1]
  );
}

export function getBillingSourceHint(status: Pick<BillingStatus, 'summary' | 'plan'>): string {
  if (status.summary.balanceCredits <= 0) {
    return `Credits exhausted. Upgrade to ${status.plan.name} or add a top-up.`;
  }
  if (status.summary.balanceCredits < Math.ceil(status.plan.includedCredits * 0.15)) {
    return 'Low balance. A top-up will keep automations from running into limits.';
  }
  return 'Healthy balance.';
}

export function buildPlanSummary(workspaceId: string, options?: { seedCredits?: boolean }): BillingStatus {
  const config = options?.seedCredits === false
    ? getBillingConfigSnapshot(workspaceId)
    : getBillingConfig(workspaceId);
  const plan = DEFAULT_PLAN_CATALOG[config.planId];
  const summary = getWorkspaceLedgerSummary(workspaceId);
  const statusBase = { summary, plan };

  return {
    config,
    plan,
    summary,
    offers: listTopUpOffers(),
    topUpOffer: getApplicableTopUpOffer(summary.balanceCredits),
    sourceHint: getBillingSourceHint(statusBase),
    updatedAt: new Date().toISOString(),
  };
}

export function calculatePlanLimitState(input: {
  plan: PlanDefinition;
  balanceCredits: number;
  automationCount?: number;
  needsMultiAgent?: boolean;
  needsApprovals?: boolean;
}): PlanLimitState[] {
  const states: PlanLimitState[] = [];

  states.push({
    kind: 'credits',
    severity: input.balanceCredits <= 0 ? 'blocked' : input.balanceCredits < Math.ceil(input.plan.includedCredits * 0.15) ? 'warning' : 'ok',
    current: input.balanceCredits,
    limit: input.plan.includedCredits,
    message:
      input.balanceCredits <= 0
        ? 'No credits remaining.'
        : input.balanceCredits < Math.ceil(input.plan.includedCredits * 0.15)
          ? 'Credits are running low.'
          : 'Credits are healthy.',
  });

  if (typeof input.automationCount === 'number') {
    states.push({
      kind: 'automations',
      severity: input.automationCount > input.plan.maxAutomations ? 'blocked' : input.automationCount === input.plan.maxAutomations ? 'warning' : 'ok',
      current: input.automationCount,
      limit: input.plan.maxAutomations,
      message:
        input.automationCount > input.plan.maxAutomations
          ? `Plan allows ${input.plan.maxAutomations} active automations.`
          : 'Automation count is within plan.',
    });
  }

  if (input.needsMultiAgent) {
    states.push({
      kind: 'multi_agent',
      severity: input.plan.supportsMultiAgent ? 'ok' : 'blocked',
      current: input.needsMultiAgent,
      limit: input.plan.supportsMultiAgent,
      message: input.plan.supportsMultiAgent ? 'Multi-agent available.' : 'Multi-agent requires Pro or Team.',
    });
  }

  if (input.needsApprovals) {
    states.push({
      kind: 'approvals',
      severity: input.plan.supportsApprovals ? 'ok' : 'blocked',
      current: input.needsApprovals,
      limit: input.plan.supportsApprovals,
      message: input.plan.supportsApprovals ? 'Approvals available.' : 'Approval workflows require Team.',
    });
  }

  return states;
}

export function evaluatePlanEnforcement(input: {
  workspaceId: string;
  requiredCredits?: number;
  automationCount?: number;
  needsMultiAgent?: boolean;
  needsApprovals?: boolean;
}): BillingEnforcementCheck {
  const status = buildPlanSummary(input.workspaceId);
  const limits = calculatePlanLimitState({
    plan: status.plan,
    balanceCredits: status.summary.balanceCredits - (input.requiredCredits || 0),
    automationCount: input.automationCount,
    needsMultiAgent: input.needsMultiAgent,
    needsApprovals: input.needsApprovals,
  });

  const severity = limits.some((item) => item.severity === 'blocked')
    ? 'blocked'
    : limits.some((item) => item.severity === 'warning')
      ? 'warning'
      : 'ok';

  return {
    allowed: severity !== 'blocked',
    severity,
    limits,
    topUpOffer: getApplicableTopUpOffer(status.summary.balanceCredits, input.requiredCredits || 0),
  };
}

export function shouldGrantMonthlyCredits(workspaceId: string, now = new Date()): boolean {
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return !listLedgerEntries(workspaceId).some((entry) => {
    if (entry.source !== 'monthly_subscription') return false;
    const entryMonth = `${new Date(entry.createdAt).getUTCFullYear()}-${String(new Date(entry.createdAt).getUTCMonth() + 1).padStart(2, '0')}`;
    return entryMonth === monthKey;
  });
}

export function purchaseTopUp(
  workspaceId: string,
  offerId: string,
  options?: {
    referenceId?: string;
    note?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const offer = listTopUpOffers().find((item) => item.id === offerId);
  if (!offer) {
    throw new Error(`Unknown top-up offer: ${offerId}`);
  }

  const credits = offer.credits + (offer.bonusCredits || 0);
  const entry = addLedgerEntry({
    workspaceId,
    source: 'top_up',
    deltaCredits: credits,
    referenceType: 'promotion',
    referenceId: options?.referenceId || offer.id,
    note: options?.note || `Top-up purchase: ${offer.credits} credits`,
    metadata: {
      priceUsd: offer.priceUsd,
      type: 'topup',
      credits: offer.credits,
      stripeProductKey: offer.stripeProductKey,
      ...(options?.metadata || {}),
    },
  });

  return { offer, entry, status: buildPlanSummary(workspaceId) };
}

export function getBillingStatus(workspaceId: string): BillingStatus {
  return buildPlanSummary(workspaceId);
}

export function getBillingStatusSnapshot(workspaceId: string): BillingStatus {
  return buildPlanSummary(workspaceId, { seedCredits: false });
}

export function assertCanSpendCredits(workspaceId: string, estimatedCredits: number) {
  const status = buildPlanSummary(workspaceId);
  if (!canSpendCredits(status.summary.balanceCredits, estimatedCredits)) {
    const offer = getApplicableTopUpOffer(status.summary.balanceCredits, estimatedCredits);
    throw new Error(
      `Insufficient credits. ${status.summary.balanceCredits} remaining, ${estimatedCredits} required. Add ${offer.credits} credits or upgrade your plan.`
    );
  }
}
