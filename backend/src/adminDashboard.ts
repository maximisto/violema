import {
  isAccessRecordApprovalReady,
  listAdminAccessRecords,
  listAdminAuditEvents,
} from './adminAccessStore';
import { getAuthUserDefaultWorkspaceId, isEmailApprovedForAccess, listAuthSessions, listAuthUsers } from './auth';
import { hasCurrentBetaConsent } from './betaConsentStore';
import { CURRENT_BETA_TERMS_VERSION, type ParticipantType } from './betaProgram';
import { listAutomations } from './scheduler';
import { getBillingStatusSnapshot } from './platform/billing';
import { listLedgerEntries, listTaskRuns, listTasks } from './platform/store';
import { getDefaultWorkspaceProfile, listWorkspaces } from './platform/workspace';

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function lastActivity(values: Array<string | undefined>) {
  const sorted = values.filter(Boolean).sort();
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function hasCurrentBetaConsentForAdmin(email: string) {
  try {
    return hasCurrentBetaConsent(email);
  } catch {
    return false;
  }
}

function isAccessRecordApprovalReadyForAdmin(record: Parameters<typeof isAccessRecordApprovalReady>[0]) {
  try {
    return isAccessRecordApprovalReady(record);
  } catch {
    return false;
  }
}

type TrialAttributionEntry = Pick<ReturnType<typeof listLedgerEntries>[number], 'deltaCredits' | 'createdAt'>;

export function attributeTrialFirstUsage(
  entries: TrialAttributionEntry[],
  trialEntry: TrialAttributionEntry,
) {
  const trialCredits = Math.max(0, trialEntry.deltaCredits);
  const trialGrantedAtMs = Date.parse(trialEntry.createdAt);
  const spentCredits = Math.min(
    trialCredits,
    entries.reduce((spent, entry) => {
      if (entry.deltaCredits >= 0 || Date.parse(entry.createdAt) < trialGrantedAtMs) return spent;
      return spent + Math.abs(entry.deltaCredits);
    }, 0),
  );
  return {
    trialCredits,
    spentCredits,
    remainingCredits: Math.max(0, trialCredits - spentCredits),
  };
}

export function buildAdminUsers() {
  const users = listAuthUsers();
  const sessions = listAuthSessions();
  const accessRecords = listAdminAccessRecords();
  const emails = new Set([...users.map((user) => user.email), ...accessRecords.map((record) => record.email)]);

  return Array.from(emails).sort().map((email) => {
    const user = users.find((item) => item.email === email) || null;
    const access = accessRecords.find((item) => item.email === email) || null;
    const userParticipantType = (user as (typeof user & { participantType?: ParticipantType }) | null)?.participantType;
    const role = access?.status === 'requested' && user?.role === 'admin'
      ? 'admin'
      : access?.role || user?.role || 'user';
    const approvedAccess = access?.status === 'approved' || isEmailApprovedForAccess(email);
    const accessStatus = access?.status || (approvedAccess ? 'approved' : 'requested');
    const ledgerEntries = user ? listLedgerEntries(getAuthUserDefaultWorkspaceId(user)) : [];
    const trialEntry = ledgerEntries.find((entry) => entry.source === 'trial_grant' && entry.deltaCredits > 0) || null;
    const trialUsage = trialEntry
      ? attributeTrialFirstUsage(ledgerEntries, trialEntry)
      : { trialCredits: 0, spentCredits: 0, remainingCredits: 0 };
    return {
      email,
      name: user?.name || access?.name || email.split('@')[0],
      role,
      method: user?.method || access?.method || 'email',
      accessStatus,
      approvedAccess,
      hasAccessRecord: Boolean(access),
      participantType: access?.participantType || userParticipantType || 'founder_operator',
      identityVerified: Boolean(access?.identityVerifiedAt),
      termsCurrent: access?.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION
        && hasCurrentBetaConsentForAdmin(email),
      termsVersion: access?.acceptedTermsVersion || null,
      approvalReady: access ? isAccessRecordApprovalReadyForAdmin(access) : false,
      trialStatus: trialEntry ? 'granted' : role === 'admin' ? 'not_applicable' : approvedAccess ? 'pending' : 'not_applicable',
      trialCredits: trialUsage.trialCredits,
      trialSpentCredits: trialUsage.spentCredits,
      trialRemainingCredits: trialUsage.remainingCredits,
      trialGrantedAt: trialEntry?.createdAt || null,
      slackConnected: Boolean(user?.slackWorkspace && user?.slackChannelId),
      slackDisplayTarget: user?.slackDisplayTarget || null,
      activeSessionCount: user ? sessions.filter((session) => session.userId === user.id).length : 0,
      createdAt: user?.createdAt || access?.createdAt || null,
      updatedAt: user?.updatedAt || access?.updatedAt || null,
    };
  });
}

export function buildWorkspacePerformanceSummary(workspaceId: string) {
  const runs = listTaskRuns(workspaceId);
  const succeeded = runs.filter((run) => run.status === 'succeeded').length;
  const failed = runs.filter((run) => run.status === 'failed').length;
  const totalCredits = runs.reduce((sum, run) => sum + Math.max(0, run.actualCredits ?? run.estimatedCredits ?? 0), 0);
  return {
    totalRuns: runs.length,
    succeededRuns: succeeded,
    failedRuns: failed,
    runSuccessRate: pct(succeeded, runs.length),
    averageRunCredits: runs.length > 0 ? Math.round(totalCredits / runs.length) : 0,
    creditsFromRuns: totalCredits,
    lastActivityAt: lastActivity(runs.map((run) => run.finishedAt || run.startedAt)),
  };
}

export function buildAdminWorkspaces() {
  const workspaces = listWorkspaces();
  return workspaces.map((workspace) => {
    const billing = getBillingStatusSnapshot(workspace.id);
    const tasks = listTasks(workspace.id);
    const runs = listTaskRuns(workspace.id);
    const performance = buildWorkspacePerformanceSummary(workspace.id);
    const automations = listAutomations();
    const rowState =
      billing.summary.balanceCredits <= 0 ? 'billing_issue'
      : billing.summary.balanceCredits < 100 ? 'low_credits'
      : performance.failedRuns > 0 ? 'failed_runs'
      : performance.totalRuns === 0 ? 'no_activity'
      : 'healthy';

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      slug: workspace.slug,
      ownerEmail: workspace.ownerEmail || null,
      planId: billing.config.planId,
      planName: billing.plan.name,
      subscriptionStatus: billing.config.subscriptionStatus || 'none',
      creditBalance: billing.summary.balanceCredits,
      creditsSpent: billing.summary.spentCredits,
      taskCount: tasks.length,
      runCount: runs.length,
      automationCount: automations.length,
      automationScope: 'global',
      globalAutomationCount: automations.length,
      rowState,
      ...performance,
    };
  });
}

export function buildWorkspaceAdminDetail(workspaceId: string) {
  const workspace = listWorkspaces().find((item) => item.id === workspaceId) || getDefaultWorkspaceProfile(workspaceId);
  const automations = listAutomations();
  return {
    workspace,
    billing: getBillingStatusSnapshot(workspaceId),
    performance: buildWorkspacePerformanceSummary(workspaceId),
    tasks: listTasks(workspaceId).slice(0, 100),
    runs: listTaskRuns(workspaceId).slice(0, 100),
    ledger: listLedgerEntries(workspaceId).slice(0, 100),
    automationScope: 'global',
    globalAutomationCount: automations.length,
    automations,
  };
}

export function buildAdminOverview() {
  const users = buildAdminUsers();
  const workspaces = buildAdminWorkspaces();
  const totalRuns = workspaces.reduce((sum, workspace) => sum + workspace.totalRuns, 0);
  const succeededRuns = workspaces.reduce((sum, workspace) => sum + workspace.succeededRuns, 0);
  const failedRuns = workspaces.reduce((sum, workspace) => sum + workspace.failedRuns, 0);
  return {
    metrics: {
      approvedUsers: users.filter((user) => user.approvedAccess).length,
      pendingUsers: users.filter((user) => user.accessStatus === 'requested' && !user.approvedAccess).length,
      workspaces: workspaces.length,
      activeAutomations: listAutomations().filter((item) => item.status === 'active').length,
      totalRuns,
      runSuccessRate: pct(succeededRuns, totalRuns),
      failedRuns,
      creditsSpent: workspaces.reduce((sum, workspace) => sum + workspace.creditsSpent, 0),
    },
    recentUsers: users.slice(0, 8),
    workspacesNeedingAttention: workspaces.filter((workspace) => workspace.rowState !== 'healthy').slice(0, 8),
    recentFailedRuns: workspaces.flatMap((workspace) =>
      listTaskRuns(workspace.workspaceId)
        .filter((run) => run.status === 'failed')
        .map((run) => ({ ...run, workspaceName: workspace.workspaceName }))
    )
      .sort((left, right) =>
        Date.parse(right.finishedAt ?? right.startedAt) - Date.parse(left.finishedAt ?? left.startedAt)
      )
      .slice(0, 8),
  };
}

export function buildAdminAudit(limit = 100) {
  return listAdminAuditEvents(limit);
}
