/**
 * The account directory: every known account, with its participant type (who
 * they are) and its DERIVED account stage (where they stand with us).
 *
 * `platform/accountStage.ts` holds the pure derivation. This module is the
 * impure half — it gathers the signals that derivation needs. It deliberately
 * lives outside `platform/` because the access store persists the stage
 * override and therefore imports the pure module; a collector inside
 * `platform/accountStage.ts` would close that loop into an import cycle.
 *
 * Reads are bounded: one read per store, not one per account. `buildAdminUsers`
 * and the weekly platform brief both consume this, so a per-account store read
 * would multiply across the whole user base on every admin page load.
 */

import { listAdminAccessRecords } from './adminAccessStore';
import { getApprovedAccessEmails, getAuthUserDefaultWorkspaceId, listAuthUsers } from './auth';
import { defaultParticipantType, type ParticipantType } from './betaProgram';
import {
  isActivatingRunStatus,
  normalizeAccountStageOverride,
  normalizeSubscriptionStatus,
  resolveAccountStage,
  type AccountStageOverride,
  type AccountStageResolution,
} from './platform/accountStage';
import { listBillingConfigs } from './platform/billing';
import { listDemoWorkspaceIds } from './platform/demoWorkspace';
import { getPlatformState } from './platform/store';
import { DEFAULT_WORKSPACE_ID, listWorkspaces } from './platform/workspace';

export interface AccountStageRecord {
  email: string;
  workspaceId: string;
  role: 'user' | 'admin';
  participantType: ParticipantType;
  accountStage: AccountStageResolution;
  /** Completed at least one successful run. See `isActivatingRunStatus`. */
  activated: boolean;
  hasTrialGrant: boolean;
  stageOverride: AccountStageOverride | null;
  stageOverrideBy: string | null;
  stageOverrideAt: string | null;
}

/**
 * Already-loaded stores, for a caller that has read them for its own reasons.
 *
 * The admin dashboard builds users, workspaces, and this directory from the
 * same page load; without this seam each of those re-reads every store. Every
 * field is optional and falls back to the live read, so the no-argument call
 * behaves exactly as before.
 */
export interface AccountStageDirectorySources {
  accessRecords?: ReturnType<typeof listAdminAccessRecords>;
  users?: ReturnType<typeof listAuthUsers>;
  billingConfigs?: ReturnType<typeof listBillingConfigs>;
  platformState?: Pick<ReturnType<typeof getPlatformState>, 'ledger' | 'taskRuns'>;
  workspaces?: ReturnType<typeof listWorkspaces>;
}

export function listAccountStageRecords(
  sources: AccountStageDirectorySources = {},
): AccountStageRecord[] {
  let accessRecords: ReturnType<typeof listAdminAccessRecords> = [];
  try {
    accessRecords = sources.accessRecords ?? listAdminAccessRecords();
  } catch {
    // A corrupt access store must not take down the weekly brief; every account
    // then resolves from auth + billing truth alone.
  }

  const users = sources.users ?? listAuthUsers();
  const approvedEmails = getApprovedAccessEmails();
  const billingByWorkspace = new Map(
    (sources.billingConfigs ?? listBillingConfigs()).map((config) => [config.workspaceId, config]),
  );

  const platformState = sources.platformState ?? getPlatformState();
  const trialGrantByWorkspace = new Map<string, { createdAt: string; deltaCredits: number }>();
  for (const entry of platformState.ledger) {
    if (entry.source !== 'trial_grant' || entry.deltaCredits <= 0) continue;
    const existing = trialGrantByWorkspace.get(entry.workspaceId);
    // The grant is one-time; if duplicates ever exist, the earliest is the real one.
    if (!existing || Date.parse(entry.createdAt) < Date.parse(existing.createdAt)) {
      trialGrantByWorkspace.set(entry.workspaceId, {
        createdAt: entry.createdAt,
        deltaCredits: entry.deltaCredits,
      });
    }
  }
  const activatedWorkspaces = new Set(
    platformState.taskRuns
      .filter((run) => isActivatingRunStatus(run.status))
      .map((run) => run.workspaceId),
  );

  const demoWorkspaceIds = new Set(listDemoWorkspaceIds());
  for (const profile of sources.workspaces ?? listWorkspaces()) {
    if (profile.metadata?.demo === true) demoWorkspaceIds.add(profile.id);
  }

  const emails = new Set([
    ...users.map((user) => user.email),
    ...accessRecords.map((record) => record.email),
  ]);

  return Array.from(emails).sort().map((email) => {
    const user = users.find((item) => item.email === email) || null;
    const access = accessRecords.find((item) => item.email === email) || null;
    // Same precedence `buildAdminUsers` uses, so a row and its stage agree.
    const role: 'user' | 'admin' = access?.status === 'requested' && user?.role === 'admin'
      ? 'admin'
      : access?.role || user?.role || 'user';
    const workspaceId = user ? getAuthUserDefaultWorkspaceId(user) : '';
    const config = workspaceId ? billingByWorkspace.get(workspaceId) : undefined;
    const trialGrant = workspaceId ? trialGrantByWorkspace.get(workspaceId) : undefined;
    // Mirrors `isEmailApprovedForAccess` without a store read per account.
    const approvedForAccess = access?.status === 'approved'
      || (access?.status !== 'revoked' && approvedEmails.has(email));
    const stageOverride = normalizeAccountStageOverride(access?.stageOverride);

    return {
      email,
      workspaceId,
      role,
      participantType: access?.participantType || user?.participantType || defaultParticipantType(),
      accountStage: resolveAccountStage({
        isDefaultWorkspace: Boolean(workspaceId) && workspaceId === DEFAULT_WORKSPACE_ID,
        isDemoWorkspace: Boolean(workspaceId) && demoWorkspaceIds.has(workspaceId),
        role,
        accessStatus: access?.status || null,
        approvedForAccess,
        subscriptionStatus: normalizeSubscriptionStatus(config?.subscriptionStatus),
        subscriptionStatusAt: config?.updatedAt || null,
        hasTrialGrant: Boolean(trialGrant),
        trialGrantedAt: trialGrant?.createdAt || null,
        trialCredits: trialGrant?.deltaCredits ?? null,
        accessStatusAt: access?.updatedAt || null,
        stageOverride,
        stageOverrideAt: access?.stageOverrideAt || null,
      }),
      activated: Boolean(workspaceId) && activatedWorkspaces.has(workspaceId),
      hasTrialGrant: Boolean(trialGrant),
      stageOverride,
      stageOverrideBy: access?.stageOverrideBy || null,
      stageOverrideAt: access?.stageOverrideAt || null,
    };
  });
}
