import fs from 'fs';
import path from 'path';
import { hasCurrentBetaConsent } from './betaConsentStore';
import {
  CURRENT_BETA_TERMS_VERSION,
  ParticipantType,
  defaultParticipantType,
  normalizeParticipantType,
} from './betaProgram';
import { writeJsonFile } from './platform/jsonStore';

export type AdminAccessStatus = 'requested' | 'approved' | 'revoked';
export type AdminAccessRole = 'user' | 'admin';
export type AdminAuditAction =
  | 'access.requested'
  | 'access.approved'
  | 'access.revoked'
  | 'role.promoted'
  | 'role.demoted'
  | 'credits.adjusted';

export interface AdminAccessRecord {
  email: string;
  name?: string;
  method?: 'email' | 'google' | 'microsoft';
  participantType: ParticipantType;
  identityVerifiedAt?: string;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
  status: AdminAccessStatus;
  role: AdminAccessRole;
  note?: string;
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
  'role.promoted',
  'role.demoted',
  'credits.adjusted',
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
    if (!optionalString(row.note)) throw new Error(`row ${index} has invalid note`);
    if (!optionalString(row.updatedBy)) throw new Error(`row ${index} has invalid updatedBy`);
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

export function isAccessRecordApprovalReady(record: AdminAccessRecord) {
  return Boolean(
    record.identityVerifiedAt
    && record.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION
    && record.acceptedTermsAt
    && hasCurrentBetaConsent(record.email),
  );
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

  const next: AdminAccessRecord = {
    email,
    name: trimBounded(input.name, MAX_NAME_LENGTH) || existing?.name,
    method,
    participantType,
    identityVerifiedAt: existing?.identityVerifiedAt || input.identityVerifiedAt,
    acceptedTermsVersion: existing?.acceptedTermsVersion || input.acceptedTermsVersion,
    acceptedTermsAt: existing?.acceptedTermsAt || input.acceptedTermsAt,
    status: 'requested',
    role: existing?.role || 'user',
    note: trimBounded(input.note, MAX_NOTE_LENGTH) || existing?.note,
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
  const next: AdminAccessRecord = {
    email,
    name: existing?.name,
    method: existing?.method || 'email',
    participantType,
    identityVerifiedAt: existing?.identityVerifiedAt,
    acceptedTermsVersion: existing?.acceptedTermsVersion,
    acceptedTermsAt: existing?.acceptedTermsAt,
    status: input.status,
    role: input.role || existing?.role || 'user',
    note,
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

export function clearAdminAccessRecords() {
  fs.rmSync(getAccessFile(), { force: true });
  fs.rmSync(getAuditFile(), { force: true });
}
