import path from 'path';
import { readJsonFile, upsertJsonRecord, writeJsonFile } from './jsonStore';

export type ReferralEventStatus = 'pending' | 'qualified' | 'rewarded' | 'rejected';

export interface ReferralEvent {
  id: string;
  workspaceId: string;
  referrerWorkspaceId?: string;
  referrerEmail?: string;
  referredEmail: string;
  referralCode: string;
  status: ReferralEventStatus;
  rewardCredits: number;
  friendRewardCredits: number;
  source: 'invite' | 'manual' | 'campaign';
  metadata?: Record<string, unknown>;
  createdAt: string;
  qualifiedAt?: string;
  rewardedAt?: string;
}

export interface ReferralRewardSummary {
  workspaceId: string;
  pendingCount: number;
  rewardedCount: number;
  totalRewardCredits: number;
  totalFriendCredits: number;
  updatedAt: string;
}

export interface ReferralProgramConfig {
  enabled: boolean;
  rewardCredits: number;
  friendRewardCredits: number;
  codePrefix: string;
}

export const REFERRALS_FILE = path.join(process.cwd(), 'platform-referrals.json');
export const REFERRAL_PROGRAM_FILE = path.join(process.cwd(), 'platform-referral-program.json');

const DEFAULT_PROGRAM: ReferralProgramConfig = {
  enabled: true,
  rewardCredits: 2000,
  friendRewardCredits: 500,
  codePrefix: 'NEXUS',
};

function readReferrals(): ReferralEvent[] {
  return readJsonFile<ReferralEvent[]>(REFERRALS_FILE, []);
}

function saveReferrals(items: ReferralEvent[]) {
  writeJsonFile(REFERRALS_FILE, items);
}

export function getReferralProgramConfig(): ReferralProgramConfig {
  return readJsonFile<ReferralProgramConfig>(REFERRAL_PROGRAM_FILE, DEFAULT_PROGRAM);
}

export function upsertReferralProgramConfig(patch: Partial<ReferralProgramConfig>): ReferralProgramConfig {
  const next = { ...getReferralProgramConfig(), ...patch };
  writeJsonFile(REFERRAL_PROGRAM_FILE, next);
  return next;
}

export function createReferralCode(workspaceId: string, suffix?: string): string {
  const program = getReferralProgramConfig();
  const base = `${program.codePrefix}-${workspaceId.slice(0, 4).toUpperCase()}`;
  const unique = suffix || Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${base}-${unique}`;
}

export function recordReferralEvent(input: {
  workspaceId: string;
  referredEmail: string;
  referrerWorkspaceId?: string;
  referrerEmail?: string;
  source?: ReferralEvent['source'];
  referralCode?: string;
  metadata?: Record<string, unknown>;
}): ReferralEvent {
  const program = getReferralProgramConfig();
  const event: ReferralEvent = {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: input.workspaceId,
    referrerWorkspaceId: input.referrerWorkspaceId,
    referrerEmail: input.referrerEmail,
    referredEmail: input.referredEmail,
    referralCode: input.referralCode || createReferralCode(input.workspaceId),
    status: 'pending',
    rewardCredits: program.rewardCredits,
    friendRewardCredits: program.friendRewardCredits,
    source: input.source || 'invite',
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };

  const next = upsertJsonRecord(readReferrals(), event);
  saveReferrals(next);
  return event;
}

export function listReferralEvents(workspaceId: string): ReferralEvent[] {
  return readReferrals()
    .filter((event) => event.workspaceId === workspaceId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function summarizeReferralRewards(workspaceId: string): ReferralRewardSummary {
  const items = listReferralEvents(workspaceId);
  let pendingCount = 0;
  let rewardedCount = 0;
  let totalRewardCredits = 0;
  let totalFriendCredits = 0;

  for (const item of items) {
    if (item.status === 'pending') pendingCount += 1;
    if (item.status === 'rewarded') rewardedCount += 1;
    if (item.status === 'rewarded' || item.status === 'qualified') {
      totalRewardCredits += item.rewardCredits;
      totalFriendCredits += item.friendRewardCredits;
    }
  }

  return {
    workspaceId,
    pendingCount,
    rewardedCount,
    totalRewardCredits,
    totalFriendCredits,
    updatedAt: new Date().toISOString(),
  };
}

export function markReferralQualified(referralId: string) {
  const items = readReferrals();
  const next = items.map((item) =>
    item.id === referralId
      ? { ...item, status: 'qualified' as const, qualifiedAt: new Date().toISOString() }
      : item
  );
  saveReferrals(next);
  return next.find((item) => item.id === referralId) || null;
}

export function markReferralRewarded(referralId: string) {
  const items = readReferrals();
  const next = items.map((item) =>
    item.id === referralId
      ? { ...item, status: 'rewarded' as const, rewardedAt: new Date().toISOString() }
      : item
  );
  saveReferrals(next);
  return next.find((item) => item.id === referralId) || null;
}
