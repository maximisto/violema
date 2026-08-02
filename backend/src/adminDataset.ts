/**
 * One page load, one read per store.
 *
 * The admin dashboard is the only surface that walks EVERY workspace and EVERY
 * account at once. Built naively, that shape multiplies: a per-workspace
 * `listTaskRuns()` re-parses the whole run file per workspace, a per-account
 * `hasCurrentBetaConsent()` re-parses the whole consent file per account, and
 * `buildAdminOverview` used to run both builders and then read the runs again.
 * With a handful of internal workspaces that was invisible. With testers it is
 * the first thing that gets slow, and it gets slow quadratically.
 *
 * This module reads each JSON store exactly once and hands back indexes. Every
 * admin builder takes an optional dataset, so a caller that needs more than one
 * of them (the overview, the operations endpoint) shares a single load while a
 * lone builder call still works with no arguments.
 *
 * It holds NO cache and NO memo: a dataset is a snapshot for one request. Two
 * requests read the stores twice, which is correct — an admin refreshing after
 * a change must see the change.
 */

import { listAdminAccessRecords, type AdminAccessRecord } from './adminAccessStore';
import {
  getApprovedAccessEmails,
  listAuthSessions,
  listAuthUsers,
  type AuthSessionRecord,
  type AuthUserRecord,
} from './auth';
import { listCurrentBetaConsentEmails } from './betaConsentStore';
import { listAccountStageRecords, type AccountStageRecord } from './accountStageDirectory';
import { listAutomations, type AutomationRecord } from './scheduler';
import { listBillingConfigs, listTopUpOffers } from './platform/billing';
import { getPlatformState } from './platform/store';
import { DEFAULT_WORKSPACE_ID, listWorkspaces } from './platform/workspace';
import { createInternalDemoRoutingResolver, usesInternalDemoRouting } from './platform/tenancy';
import type {
  CreditLedgerEntry,
  TaskRecord,
  TaskRunRecord,
  TopUpOffer,
  WorkspaceBillingConfig,
  WorkspaceProfile,
} from './platform/types';

/**
 * An automation with no `workspaceId` predates multi-tenancy — the seeded core
 * automations carry none. Everywhere else in the backend those resolve to the
 * default workspace (`getAutomationWorkspaceId` in `server.ts` and
 * `reviewActions.ts`, `usesInternalDemoRouting` in `platform/tenancy.ts`), so
 * attributing them anywhere else here would make the admin count disagree with
 * the code that actually runs them.
 */
export function resolveAutomationWorkspaceId(
  automation: Pick<AutomationRecord, 'workspaceId'>,
): string {
  const raw = typeof automation.workspaceId === 'string' ? automation.workspaceId.trim() : '';
  return raw || DEFAULT_WORKSPACE_ID;
}

/** True for an automation record that never got a workspace stamped on it. */
export function isUnattributedAutomation(
  automation: Pick<AutomationRecord, 'workspaceId'>,
): boolean {
  return !(typeof automation.workspaceId === 'string' && automation.workspaceId.trim());
}

/**
 * Consent receipts, degrading to "nobody is current" if the store is
 * unreadable.
 *
 * An unavailable consent store must not take the admin dashboard down, and it
 * must not silently mark accounts as consented either. Empty is the honest
 * failure: `termsCurrent` and `approvalReady` both read false, which is what an
 * operator should see when the evidence cannot be produced.
 */
function readCurrentConsentEmails(): Set<string> {
  try {
    return listCurrentBetaConsentEmails();
  } catch {
    return new Set<string>();
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const bucketKey = key(item);
    const bucket = grouped.get(bucketKey);
    if (bucket) bucket.push(item);
    else grouped.set(bucketKey, [item]);
  }
  return grouped;
}

export interface AdminDataset {
  loadedAt: string;
  workspaces: WorkspaceProfile[];
  tasks: TaskRecord[];
  taskRuns: TaskRunRecord[];
  ledger: CreditLedgerEntry[];
  automations: AutomationRecord[];
  authUsers: AuthUserRecord[];
  authSessions: AuthSessionRecord[];
  accessRecords: AdminAccessRecord[];
  accountStageRecords: AccountStageRecord[];
  billingConfigs: WorkspaceBillingConfig[];
  topUpOffers: TopUpOffer[];
  /** Emails holding consent to the CURRENT beta terms. */
  currentConsentEmails: Set<string>;
  /** Env-allowlisted emails, mirroring the fallback in `isEmailApprovedForAccess`. */
  envApprovedEmails: Set<string>;

  tasksByWorkspace: Map<string, TaskRecord[]>;
  taskRunsByWorkspace: Map<string, TaskRunRecord[]>;
  /** Newest first, matching `listLedgerEntries`. */
  ledgerByWorkspace: Map<string, CreditLedgerEntry[]>;
  automationsByWorkspace: Map<string, AutomationRecord[]>;
  automationById: Map<string, AutomationRecord>;
  sessionCountByUserId: Map<string, number>;
  billingConfigByWorkspace: Map<string, WorkspaceBillingConfig>;
  accessRecordByEmail: Map<string, AdminAccessRecord>;
  authUserByEmail: Map<string, AuthUserRecord>;
  accountStageByEmail: Map<string, AccountStageRecord>;
  /**
   * Violema's own workspaces: the default one plus every demo workspace.
   *
   * Resolved once. `isDemoWorkspace` re-reads the entire workspace file on every
   * call, so asking it per row turned a workspace table into an O(n²) file read.
   */
  internalWorkspaceIds: Set<string>;
  /** Automations carrying no workspaceId at all — legacy records. */
  unattributedAutomationCount: number;
}

/**
 * Internal-workspace ids, resolved through the tenancy module's batch resolver
 * so this file never restates the "is this workspace us?" rule.
 */
function resolveInternalWorkspaceIds(workspaces: WorkspaceProfile[]): Set<string> {
  const usesInternalRouting = createInternalDemoRoutingResolver(workspaces);
  const internal = new Set<string>([DEFAULT_WORKSPACE_ID]);
  for (const profile of workspaces) {
    if (usesInternalRouting(profile.id)) internal.add(profile.id);
  }
  return internal;
}

export function loadAdminDataset(): AdminDataset {
  const platformState = getPlatformState();
  const workspaces = listWorkspaces();
  const automations = listAutomations();
  const authUsers = listAuthUsers();
  const authSessions = listAuthSessions();
  const billingConfigs = listBillingConfigs();
  const accessRecords = listAdminAccessRecords();

  // Handed the stores it would otherwise re-read; the derivation is unchanged.
  const accountStageRecords = listAccountStageRecords({
    accessRecords,
    users: authUsers,
    billingConfigs,
    platformState,
    workspaces,
  });

  const sessionCountByUserId = new Map<string, number>();
  for (const session of authSessions) {
    sessionCountByUserId.set(session.userId, (sessionCountByUserId.get(session.userId) || 0) + 1);
  }

  const ledgerByWorkspace = groupBy(platformState.ledger, (entry) => entry.workspaceId);
  // `listLedgerEntries` returns newest-first; preserve that so callers that used
  // to go through the store see the same order.
  for (const entries of ledgerByWorkspace.values()) {
    entries.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  return {
    loadedAt: new Date().toISOString(),
    workspaces,
    tasks: platformState.tasks,
    taskRuns: platformState.taskRuns,
    ledger: platformState.ledger,
    automations,
    authUsers,
    authSessions,
    accessRecords,
    accountStageRecords,
    billingConfigs,
    topUpOffers: listTopUpOffers(),
    currentConsentEmails: readCurrentConsentEmails(),
    envApprovedEmails: getApprovedAccessEmails(),

    tasksByWorkspace: groupBy(platformState.tasks, (task) => task.workspaceId),
    taskRunsByWorkspace: groupBy(platformState.taskRuns, (run) => run.workspaceId),
    ledgerByWorkspace,
    automationsByWorkspace: groupBy(automations, resolveAutomationWorkspaceId),
    automationById: new Map(automations.map((automation) => [automation.id, automation])),
    sessionCountByUserId,
    billingConfigByWorkspace: new Map(
      billingConfigs.map((config) => [config.workspaceId, config]),
    ),
    accessRecordByEmail: new Map(accessRecords.map((record) => [record.email, record])),
    authUserByEmail: new Map(authUsers.map((user) => [user.email, user])),
    accountStageByEmail: new Map(accountStageRecords.map((record) => [record.email, record])),
    internalWorkspaceIds: resolveInternalWorkspaceIds(workspaces),
    unattributedAutomationCount: automations.filter(isUnattributedAutomation).length,
  };
}

/**
 * Workspaces that are Violema's own — the default workspace plus any demo
 * workspace. Headline metrics exclude these by default: counting our demo runs
 * as customer reliability is how a dashboard starts lying to the operator who
 * trusts it.
 *
 * Prefer `isInternalWorkspaceIn` when a dataset is in hand; this variant reads
 * the workspace store on every call.
 */
export function isInternalWorkspace(workspaceId: string): boolean {
  return usesInternalDemoRouting(workspaceId);
}

/** Same predicate, answered from the dataset's precomputed set. */
export function isInternalWorkspaceIn(dataset: AdminDataset, workspaceId: string): boolean {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : '';
  if (!id) return true;
  return dataset.internalWorkspaceIds.has(id);
}

export interface WorkspaceScope {
  includeInternal: boolean;
  workspaces: WorkspaceProfile[];
  excludedInternalWorkspaces: number;
}

export function scopeWorkspaces(
  dataset: AdminDataset,
  options: { includeInternal?: boolean } = {},
): WorkspaceScope {
  const includeInternal = options.includeInternal === true;
  const internalCount = dataset.workspaces.filter((workspace) =>
    isInternalWorkspaceIn(dataset, workspace.id),
  ).length;
  return {
    includeInternal,
    workspaces: includeInternal
      ? dataset.workspaces
      : dataset.workspaces.filter((workspace) => !isInternalWorkspaceIn(dataset, workspace.id)),
    excludedInternalWorkspaces: internalCount,
  };
}
