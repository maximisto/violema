import fs from 'fs';
import path from 'path';
import { getCurrentBetaConsent, hasCurrentBetaConsent } from './betaConsentStore';
import {
  CURRENT_BETA_TERMS_VERSION,
  ParticipantType,
  defaultParticipantType,
  normalizeParticipantType,
} from './betaProgram';
import {
  normalizeAccountStageOverride,
  type AccountStageOverride,
} from './platform/accountStage';
import { writeJsonFile } from './platform/jsonStore';

export type AdminAccessStatus = 'requested' | 'approved' | 'revoked';
export type AdminAccessRole = 'user' | 'admin';
export type AdminAuditAction =
  | 'access.requested'
  | 'access.approved'
  | 'access.revoked'
  // The one-shot "application received" confirmation email went out after a
  // signup bounce attached identity evidence. Recorded so the admin trail can
  // answer "was this applicant told their application is in".
  | 'access.application_confirmed'
  | 'participant.updated'
  | 'stage.override.updated'
  | 'role.promoted'
  | 'role.demoted'
  | 'credits.adjusted'
  // Review decisions taken outside the dashboard. A Slack button click sends
  // something real; without these the admin trail cannot answer "who approved
  // this delivery" for anything approved from chat.
  | 'review.approved'
  | 'review.changes_requested'
  // Email magic-link RE-authentication of an already-verified, already-approved
  // account. Recorded because a credential was minted and then spent, and
  // "which sessions were created without an OAuth round-trip" has to be
  // answerable. Neither event asserts identity or consent — see authMagicLink.ts.
  | 'auth.magic_link.requested'
  | 'auth.magic_link.signed_in'
  // The operator (re)pointed a workspace's missions at their business. Recorded
  // content-free so the trail answers "when and who" without holding the data.
  | 'workspace.business_context.updated'
  // The 2026-08-05 boot migration rewrote an automation's step content — an
  // edit no operator asked for. One event per rewritten record so "why does my
  // mission look different" has an answer.
  | 'automation.business_context_migrated'
  // The folder-drop lane's FIRST transition to `active` for a workspace —
  // the operator's `Violema Library` Drive folder became readable by the
  // platform's service-account reader. Recorded once per workspace (guarded
  // by the `folderDropEnabledAt` stamp in the workspace profile's metadata),
  // content-free: `{ folderId }` only, never folder contents.
  | 'workspace.library_folder_share.enabled'
  // An operator pasted a URL into the library's "paste a link" ingestion
  // route and the SSRF-guarded fetch + write succeeded. Recorded host-only —
  // `{ host }` — never the full URL and never the fetched page content.
  | 'workspace.library_url.added';

export interface AdminAccessRecord {
  email: string;
  name?: string;
  method?: 'email' | 'google' | 'microsoft';
  participantType: ParticipantType;
  identityVerifiedAt?: string;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  status: AdminAccessStatus;
  role: AdminAccessRole;
  note?: string;
  /**
   * The one hand-settable input to the otherwise-derived account stage, for a
   * real teammate who signed up through the normal funnel. It can only ever
   * produce `internal` — no admin can assert revenue Stripe does not know about.
   */
  stageOverride?: AccountStageOverride;
  stageOverrideBy?: string;
  stageOverrideAt?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AdminAuditEvent {
  id: string;
  actorEmail: string;
  action: AdminAuditAction;
  targetEmail?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const MAX_NAME_LENGTH = 160;
const MAX_NOTE_LENGTH = 1000;
const ACCESS_STATUSES = new Set<AdminAccessStatus>(['requested', 'approved', 'revoked']);
const ACCESS_ROLES = new Set<AdminAccessRole>(['user', 'admin']);
const AUTH_METHODS = new Set<NonNullable<AdminAccessRecord['method']>>(['email', 'google', 'microsoft']);
const AUDIT_ACTIONS = new Set<AdminAuditAction>([
  'access.requested',
  'access.approved',
  'access.revoked',
  'access.application_confirmed',
  'participant.updated',
  'stage.override.updated',
  'role.promoted',
  'role.demoted',
  'credits.adjusted',
  'review.approved',
  'review.changes_requested',
  'auth.magic_link.requested',
  'auth.magic_link.signed_in',
  'workspace.business_context.updated',
  'automation.business_context_migrated',
  'workspace.library_folder_share.enabled',
  'workspace.library_url.added',
]);

function getAccessFile() {
  return path.join(process.cwd(), 'admin-access.json');
}

function getAuditFile() {
  return path.join(process.cwd(), 'admin-audit-events.json');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function trimBounded(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function optionalMetadata(value: unknown) {
  return value === undefined || isPlainRecord(value);
}

function readJsonArrayStrict<T>(
  filePath: string,
  label: string,
  validate: (row: unknown, index: number) => T,
): T[] {
  if (!fs.existsSync(filePath)) return [];

  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    if (!Array.isArray(value)) {
      throw new Error(`${label} must contain a JSON array`);
    }
    return value.map((row, index) => validate(row, index));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown read error';
    throw new Error(`Invalid ${label} store at ${filePath}: ${detail}`);
  }
}

function readAccessRecords() {
  const seenEmails = new Set<string>();
  return readJsonArrayStrict<AdminAccessRecord>(getAccessFile(), 'admin access', (row, index) => {
    if (!isPlainRecord(row)) throw new Error(`row ${index} must be an object`);
    const email = typeof row.email === 'string' ? row.email : '';
    if (!email || email !== normalizeEmail(email)) throw new Error(`row ${index} has invalid email`);
    if (seenEmails.has(email)) throw new Error(`row ${index} duplicates email ${email}`);
    seenEmails.add(email);
    if (!ACCESS_STATUSES.has(row.status as AdminAccessStatus)) throw new Error(`row ${index} has invalid status`);
    if (!ACCESS_ROLES.has(row.role as AdminAccessRole)) throw new Error(`row ${index} has invalid role`);
    if (typeof row.createdAt !== 'string') throw new Error(`row ${index} has invalid createdAt`);
    if (typeof row.updatedAt !== 'string') throw new Error(`row ${index} has invalid updatedAt`);
    if (!optionalString(row.name)) throw new Error(`row ${index} has invalid name`);
    if (row.method !== undefined && !AUTH_METHODS.has(row.method as NonNullable<AdminAccessRecord['method']>)) {
      throw new Error(`row ${index} has invalid method`);
    }
    const participantType = row.participantType === undefined
      ? defaultParticipantType()
      : normalizeParticipantType(row.participantType);
    if (!participantType) throw new Error(`row ${index} has invalid participantType`);
    if (!optionalString(row.identityVerifiedAt)) throw new Error(`row ${index} has invalid identityVerifiedAt`);
    if (!optionalString(row.acceptedTermsVersion)) throw new Error(`row ${index} has invalid acceptedTermsVersion`);
    if (!optionalString(row.acceptedTermsAt)) throw new Error(`row ${index} has invalid acceptedTermsAt`);
    if (!optionalString(row.approvedBy)) throw new Error(`row ${index} has invalid approvedBy`);
    if (!optionalString(row.approvedAt)) throw new Error(`row ${index} has invalid approvedAt`);
    if (!optionalString(row.note)) throw new Error(`row ${index} has invalid note`);
    if (!optionalString(row.updatedBy)) throw new Error(`row ${index} has invalid updatedBy`);
    // An unknown override must fail loudly rather than silently degrade: a
    // stored `"paying"` here would be somebody trying to hand-set revenue.
    if (row.stageOverride !== undefined && !normalizeAccountStageOverride(row.stageOverride)) {
      throw new Error(`row ${index} has invalid stageOverride`);
    }
    if (!optionalString(row.stageOverrideBy)) throw new Error(`row ${index} has invalid stageOverrideBy`);
    if (!optionalString(row.stageOverrideAt)) throw new Error(`row ${index} has invalid stageOverrideAt`);
    return { ...row, participantType } as unknown as AdminAccessRecord;
  });
}

function writeAccessRecords(records: AdminAccessRecord[]) {
  writeJsonFile(getAccessFile(), records);
}

function readAuditEvents() {
  return readJsonArrayStrict<AdminAuditEvent>(getAuditFile(), 'admin audit events', (row, index) => {
    if (!isPlainRecord(row)) throw new Error(`row ${index} must be an object`);
    if (typeof row.id !== 'string' || !row.id) throw new Error(`row ${index} has invalid id`);
    if (typeof row.actorEmail !== 'string' || !row.actorEmail) throw new Error(`row ${index} has invalid actorEmail`);
    if (!AUDIT_ACTIONS.has(row.action as AdminAuditAction)) throw new Error(`row ${index} has invalid action`);
    if (typeof row.createdAt !== 'string') throw new Error(`row ${index} has invalid createdAt`);
    if (!optionalString(row.targetEmail)) throw new Error(`row ${index} has invalid targetEmail`);
    if (!optionalString(row.workspaceId)) throw new Error(`row ${index} has invalid workspaceId`);
    if (!optionalMetadata(row.metadata)) throw new Error(`row ${index} has invalid metadata`);
    return row as unknown as AdminAuditEvent;
  });
}

function writeAuditEvents(events: AdminAuditEvent[]) {
  writeJsonFile(getAuditFile(), events);
}

export function listAdminAccessRecords() {
  return readAccessRecords();
}

export function getAccessRecord(email: string) {
  const normalized = normalizeEmail(email);
  return readAccessRecords().find((record) => record.email === normalized) || null;
}

/**
 * The approval-readiness rule with the consent lookup already performed.
 *
 * Callers that resolve consent for many accounts at once (the admin
 * participants table) pass a set membership instead of paying a store read per
 * row. The rule itself lives here so the two call paths cannot drift.
 */
export function isAccessRecordApprovalReadyGiven(
  record: Pick<AdminAccessRecord, 'identityVerifiedAt' | 'acceptedTermsVersion' | 'acceptedTermsAt'>,
  hasCurrentConsent: boolean,
) {
  return Boolean(
    record.identityVerifiedAt
    && record.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION
    && record.acceptedTermsAt
    && hasCurrentConsent,
  );
}

export function isAccessRecordApprovalReady(record: AdminAccessRecord) {
  return isAccessRecordApprovalReadyGiven(record, hasCurrentBetaConsent(record.email));
}

export function assertAccessRecordApprovalReady(record: AdminAccessRecord) {
  if (!isAccessRecordApprovalReady(record)) {
    throw new Error('Verified identity and current beta terms are required before approval.');
  }
}

export function listAdminAuditEvents(limit = 100) {
  return readAuditEvents()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function recordAdminAuditEvent(input: Omit<AdminAuditEvent, 'id' | 'createdAt'>) {
  const event: AdminAuditEvent = {
    ...input,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  writeAuditEvents([event, ...readAuditEvents()]);
  return event;
}

function selectRequestTermsEvidence(
  existing: Pick<AdminAccessRecord, 'acceptedTermsVersion' | 'acceptedTermsAt'> | null,
  input: { acceptedTermsVersion?: string; acceptedTermsAt?: string },
) {
  const existingEvidence = existing?.acceptedTermsVersion && existing.acceptedTermsAt
    ? { version: existing.acceptedTermsVersion, acceptedAt: existing.acceptedTermsAt }
    : null;
  const inputEvidence = input.acceptedTermsVersion && input.acceptedTermsAt
    ? { version: input.acceptedTermsVersion, acceptedAt: input.acceptedTermsAt }
    : null;
  const existingIsCurrent = existingEvidence?.version === CURRENT_BETA_TERMS_VERSION;
  const inputIsCurrent = inputEvidence?.version === CURRENT_BETA_TERMS_VERSION;

  if (inputEvidence && inputIsCurrent) {
    if (!existingEvidence || !existingIsCurrent) return inputEvidence;
    const existingTime = Date.parse(existingEvidence.acceptedAt);
    const inputTime = Date.parse(inputEvidence.acceptedAt);
    if (!Number.isFinite(existingTime) || (Number.isFinite(inputTime) && inputTime > existingTime)) {
      return inputEvidence;
    }
  }
  if (existingEvidence) return existingEvidence;
  if (inputEvidence) return inputEvidence;
  return {
    version: existing?.acceptedTermsVersion || input.acceptedTermsVersion,
    acceptedAt: existing?.acceptedTermsAt || input.acceptedTermsAt,
  };
}

export function recordAccessRequest(input: {
  email: string;
  name?: string;
  method?: 'email' | 'google' | 'microsoft';
  participantType?: ParticipantType;
  identityVerifiedAt?: string;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
  note?: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;
  const isNewRequest = !existing;

  if (existing && existing.status !== 'requested') {
    return existing;
  }

  const participantType = input.participantType === undefined
    ? existing?.participantType || defaultParticipantType()
    : normalizeParticipantType(input.participantType);
  if (!participantType) throw new Error('invalid participantType');

  const existingMethod = existing?.method;
  const method = existingMethod && existingMethod !== 'email'
    ? existingMethod
    : input.method || existingMethod || 'email';
  const termsEvidence = selectRequestTermsEvidence(existing, input);

  const next: AdminAccessRecord = {
    email,
    name: trimBounded(input.name, MAX_NAME_LENGTH) || existing?.name,
    method,
    participantType,
    identityVerifiedAt: existing?.identityVerifiedAt || input.identityVerifiedAt,
    acceptedTermsVersion: termsEvidence.version,
    acceptedTermsAt: termsEvidence.acceptedAt,
    approvedBy: existing?.approvedBy,
    approvedAt: existing?.approvedAt,
    status: 'requested',
    role: existing?.role || 'user',
    note: trimBounded(input.note, MAX_NOTE_LENGTH) || existing?.note,
    // These builders assemble `next` field by field rather than spreading, so
    // the override has to be carried forward explicitly or a later re-request
    // would silently erase an operator's decision.
    stageOverride: existing?.stageOverride,
    stageOverrideBy: existing?.stageOverrideBy,
    stageOverrideAt: existing?.stageOverrideAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: existing?.updatedBy,
  };

  if (isNewRequest) {
    recordAdminAuditEvent({
      actorEmail: 'system',
      action: 'access.requested',
      targetEmail: email,
      metadata: { method: next.method, name: next.name },
    });
  }

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  return next;
}

export function setAccessStatus(input: {
  email: string;
  status: AdminAccessStatus;
  role?: AdminAccessRole;
  participantType?: ParticipantType;
  note?: string;
  updatedBy: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;
  const participantType = input.participantType === undefined
    ? existing?.participantType || defaultParticipantType()
    : normalizeParticipantType(input.participantType);
  if (!participantType) throw new Error('invalid participantType');
  const note = trimBounded(input.note, MAX_NOTE_LENGTH);
  const isApprovalTransition = input.status === 'approved' && existing?.status !== 'approved';
  const next: AdminAccessRecord = {
    email,
    name: existing?.name,
    method: existing?.method || 'email',
    participantType,
    identityVerifiedAt: existing?.identityVerifiedAt,
    acceptedTermsVersion: existing?.acceptedTermsVersion,
    acceptedTermsAt: existing?.acceptedTermsAt,
    approvedBy: isApprovalTransition ? normalizeEmail(input.updatedBy) : existing?.approvedBy,
    approvedAt: isApprovalTransition ? now : existing?.approvedAt,
    status: input.status,
    role: input.role || existing?.role || 'user',
    note,
    stageOverride: existing?.stageOverride,
    stageOverrideBy: existing?.stageOverrideBy,
    stageOverrideAt: existing?.stageOverrideAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };

  if (input.status === 'approved') {
    assertAccessRecordApprovalReady(next);
  }

  if (
    existing
    && existing.status === next.status
    && existing.role === next.role
    && existing.participantType === next.participantType
    && existing.note === next.note
  ) {
    return existing;
  }

  recordAdminAuditEvent({
    actorEmail: input.updatedBy,
    action: input.status === 'approved' ? 'access.approved' : input.status === 'revoked' ? 'access.revoked' : 'access.requested',
    targetEmail: email,
    metadata: { note: next.note, role: next.role },
  });

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  return next;
}

export function syncVerifiedAccessEvidence(input: {
  email: string;
  name?: string;
  method: 'google' | 'microsoft';
  participantType: ParticipantType;
  identityVerifiedAt: string;
  acceptedTermsVersion: string;
  acceptedTermsAt: string;
  approvedIfMissing: boolean;
  role: AdminAccessRole;
}) {
  const email = normalizeEmail(input.email);
  const participantType = normalizeParticipantType(input.participantType);
  if (!participantType) throw new Error('invalid participantType');
  const consent = getCurrentBetaConsent(email);
  if (
    !consent
    || input.acceptedTermsVersion !== CURRENT_BETA_TERMS_VERSION
    || consent.termsVersion !== CURRENT_BETA_TERMS_VERSION
    || consent.acceptedAt !== input.acceptedTermsAt
  ) {
    throw new Error('Current server-owned beta consent evidence is required.');
  }

  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;
  if (!existing && !input.approvedIfMissing) {
    throw new Error('existing access record required');
  }

  const now = new Date().toISOString();
  const preservesAccessDecision = existing?.status === 'approved' || existing?.status === 'revoked';
  const projectsConfiguredApproval = input.approvedIfMissing && !preservesAccessDecision;
  const next: AdminAccessRecord = {
    email,
    name: trimBounded(input.name, MAX_NAME_LENGTH) || existing?.name,
    method: input.method,
    participantType,
    identityVerifiedAt: existing?.identityVerifiedAt || input.identityVerifiedAt,
    acceptedTermsVersion: CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: consent.acceptedAt,
    approvedBy: existing?.approvedBy,
    approvedAt: existing?.approvedAt,
    status: preservesAccessDecision
      ? existing.status
      : projectsConfiguredApproval ? 'approved' : 'requested',
    role: preservesAccessDecision
      ? existing.role
      : projectsConfiguredApproval ? input.role : existing?.role || input.role,
    note: existing?.note,
    stageOverride: existing?.stageOverride,
    stageOverrideBy: existing?.stageOverrideBy,
    stageOverrideAt: existing?.stageOverrideAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: existing?.updatedBy,
  };

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  return next;
}

export function setAccessRole(input: {
  email: string;
  role: AdminAccessRole;
  note?: string;
  updatedBy: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  if (index < 0) {
    throw new Error('existing access record required');
  }

  const existing = records[index];
  const next: AdminAccessRecord = {
    ...existing,
    role: input.role,
    note: trimBounded(input.note, MAX_NOTE_LENGTH) || existing.note,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };

  if (existing.role !== input.role) {
    recordAdminAuditEvent({
      actorEmail: input.updatedBy,
      action: input.role === 'admin' ? 'role.promoted' : 'role.demoted',
      targetEmail: email,
      metadata: {
        previousRole: existing.role,
        role: next.role,
        status: next.status,
        note: trimBounded(input.note, MAX_NOTE_LENGTH),
      },
    });
  }

  records[index] = next;
  writeAccessRecords(records);
  return next;
}

export function setAccessParticipantType(input: {
  email: string;
  participantType: ParticipantType;
  updatedBy: string;
}) {
  const email = normalizeEmail(input.email);
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  if (index < 0) {
    throw new Error('existing access record required');
  }

  const participantType = normalizeParticipantType(input.participantType);
  if (!participantType) throw new Error('invalid participantType');

  const existing = records[index];
  if (existing.participantType === participantType) return existing;

  const next: AdminAccessRecord = {
    ...existing,
    participantType,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  recordAdminAuditEvent({
    actorEmail: input.updatedBy,
    action: 'participant.updated',
    targetEmail: email,
    metadata: {
      previousParticipantType: existing.participantType,
      participantType,
      status: existing.status,
      role: existing.role,
    },
  });
  records[index] = next;
  writeAccessRecords(records);
  return next;
}

/**
 * Set or clear the `internal` account-stage override.
 *
 * This is the ONLY writable input to account stage, and it is deliberately
 * one-valued: `internal`, or nothing. Every other stage stays derived from
 * billing, access, and ledger truth, so no admin can make the dashboard claim a
 * paying customer that Stripe has never heard of. Who set it and when are
 * recorded on the record and in the audit log.
 */
export function setAccessStageOverride(input: {
  email: string;
  override: AccountStageOverride | null;
  updatedBy: string;
}) {
  const email = normalizeEmail(input.email);
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  if (index < 0) {
    throw new Error('existing access record required');
  }

  const override = input.override === null ? null : normalizeAccountStageOverride(input.override);
  if (input.override !== null && !override) throw new Error('invalid stage override');

  const existing = records[index];
  if ((existing.stageOverride || null) === override) return existing;

  const now = new Date().toISOString();
  const next: AdminAccessRecord = {
    ...existing,
    stageOverride: override || undefined,
    stageOverrideBy: override ? normalizeEmail(input.updatedBy) : undefined,
    stageOverrideAt: override ? now : undefined,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };

  recordAdminAuditEvent({
    actorEmail: input.updatedBy,
    action: 'stage.override.updated',
    targetEmail: email,
    metadata: {
      previousStageOverride: existing.stageOverride || null,
      stageOverride: override,
      status: existing.status,
      role: existing.role,
    },
  });

  records[index] = next;
  writeAccessRecords(records);
  return next;
}

export function clearAdminAccessRecords() {
  fs.rmSync(getAccessFile(), { force: true });
  fs.rmSync(getAuditFile(), { force: true });
}
