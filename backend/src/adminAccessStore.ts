import path from 'path';
import { readJsonFile, writeJsonFile } from './platform/jsonStore';

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

const ACCESS_FILE = path.join(process.cwd(), 'admin-access.json');
const AUDIT_FILE = path.join(process.cwd(), 'admin-audit-events.json');

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function readAccessRecords() {
  return readJsonFile<AdminAccessRecord[]>(ACCESS_FILE, []);
}

function writeAccessRecords(records: AdminAccessRecord[]) {
  writeJsonFile(ACCESS_FILE, records);
}

function readAuditEvents() {
  return readJsonFile<AdminAuditEvent[]>(AUDIT_FILE, []);
}

function writeAuditEvents(events: AdminAuditEvent[]) {
  writeJsonFile(AUDIT_FILE, events);
}

export function listAdminAccessRecords() {
  return readAccessRecords();
}

export function getAccessRecord(email: string) {
  const normalized = normalizeEmail(email);
  return readAccessRecords().find((record) => record.email === normalized) || null;
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
  note?: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;

  if (existing && existing.status !== 'requested') {
    return existing;
  }

  const next: AdminAccessRecord = {
    email,
    name: input.name?.trim() || existing?.name,
    method: input.method || existing?.method || 'email',
    status: 'requested',
    role: existing?.role || 'user',
    note: input.note || existing?.note,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: existing?.updatedBy,
  };

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  recordAdminAuditEvent({
    actorEmail: 'system',
    action: 'access.requested',
    targetEmail: email,
    metadata: { method: next.method, name: next.name },
  });
  return next;
}

export function setAccessStatus(input: {
  email: string;
  status: AdminAccessStatus;
  role?: AdminAccessRole;
  note?: string;
  updatedBy: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;
  const next: AdminAccessRecord = {
    email,
    name: existing?.name,
    method: existing?.method || 'email',
    status: input.status,
    role: input.role || existing?.role || 'user',
    note: input.note,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  recordAdminAuditEvent({
    actorEmail: input.updatedBy,
    action: input.status === 'approved' ? 'access.approved' : input.status === 'revoked' ? 'access.revoked' : 'access.requested',
    targetEmail: email,
    metadata: { note: input.note, role: next.role },
  });
  return next;
}

export function clearAdminAccessRecords() {
  writeAccessRecords([]);
  writeAuditEvents([]);
}
