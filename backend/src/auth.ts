import crypto from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './platform/jsonStore';
import {
  getAccessRecord,
  listAdminAccessRecords,
  recordAccessRequest,
} from './adminAccessStore';

export type AuthMethod = 'email' | 'google' | 'microsoft';
export type AccessRole = 'user' | 'admin';

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  role: AccessRole;
  method: AuthMethod;
  acceptedTerms: boolean;
  acceptedEducation: boolean;
  slackWorkspace?: string;
  slackChannelId?: string;
  slackDisplayTarget?: string;
  slackConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

const USERS_FILE = path.join(process.cwd(), 'auth-users.json');
const SESSIONS_FILE = path.join(process.cwd(), 'auth-sessions.json');
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_APPROVED_ACCESS_EMAILS = ['max@purpleorange.io', 'max@violema.com'];
const ACCESS_DENIED_MESSAGE =
  'Violema beta access is manually approved right now. Your request is recorded, but this email is not approved yet.';

export class AuthAccessDeniedError extends Error {
  statusCode = 403;
  code = 'access_not_approved';

  constructor(message = ACCESS_DENIED_MESSAGE) {
    super(message);
    this.name = 'AuthAccessDeniedError';
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseEmailList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function getApprovedAccessEmails() {
  return new Set([
    ...DEFAULT_APPROVED_ACCESS_EMAILS,
    ...parseEmailList(process.env.ADMIN_EMAILS),
    ...parseEmailList(process.env.TEST_CREDIT_ADMIN_EMAILS),
    ...parseEmailList(process.env.VIOLEMA_APPROVED_EMAILS),
    ...parseEmailList(process.env.AUTH_APPROVED_EMAILS),
    ...parseEmailList(process.env.BETA_ACCESS_EMAILS),
  ]);
}

export function getAdminAccessEmails() {
  const configured = [
    ...parseEmailList(process.env.ADMIN_EMAILS),
    ...parseEmailList(process.env.TEST_CREDIT_ADMIN_EMAILS),
  ];
  return new Set(configured.length > 0 ? configured : DEFAULT_APPROVED_ACCESS_EMAILS);
}

export function isEmailApprovedForAccess(email: string) {
  const normalized = normalizeEmail(email);
  let persistent: ReturnType<typeof getAccessRecord>;
  try {
    persistent = getAccessRecord(normalized);
  } catch {
    return false;
  }
  if (persistent?.status === 'revoked') return false;
  if (persistent?.status === 'approved') return true;
  return getApprovedAccessEmails().has(normalized);
}

export function resolveAuthRole(email: string): AccessRole {
  const normalized = normalizeEmail(email);

  try {
    const persistent = getAccessRecord(normalized);
    if (persistent?.status === 'approved') return persistent.role;
    if (persistent?.status === 'revoked') return 'user';
  } catch {
    return 'user';
  }

  return getAdminAccessEmails().has(normalized) ? 'admin' : 'user';
}

export function assertEmailApprovedForAccess(email: string) {
  if (!isEmailApprovedForAccess(email)) {
    throw new AuthAccessDeniedError();
  }
}

function readUsers() {
  return readJsonFile<AuthUserRecord[]>(USERS_FILE, []);
}

export function listAuthUsers() {
  return readUsers();
}

function writeUsers(users: AuthUserRecord[]) {
  writeJsonFile(USERS_FILE, users);
}

function readSessions() {
  return readJsonFile<AuthSessionRecord[]>(SESSIONS_FILE, []);
}

export function listAuthSessions() {
  return readSessions().filter((session) => session.expiresAt > new Date().toISOString());
}

function writeSessions(sessions: AuthSessionRecord[]) {
  writeJsonFile(SESSIONS_FILE, sessions);
}

export function requestBetaAccess(input: {
  email: string;
  name?: string;
  method?: AuthMethod;
  note?: string;
}) {
  return recordAccessRequest(input);
}

export function getPersistentApprovedAccessEmails() {
  return listAdminAccessRecords()
    .filter((record) => record.status === 'approved')
    .map((record) => record.email);
}

export function clearAuthSessionsForEmail(email: string) {
  const normalized = normalizeEmail(email);
  const users = readUsers();
  const user = users.find((item) => item.email === normalized);
  if (!user) return 0;
  const sessions = readSessions();
  const next = sessions.filter((session) => session.userId !== user.id);
  writeSessions(next);
  return sessions.length - next.length;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function upsertAuthUser(input: {
  email: string;
  name: string;
  role: AccessRole;
  method: AuthMethod;
  acceptedTerms: boolean;
  acceptedEducation: boolean;
  slackWorkspace?: string;
  slackChannelId?: string;
  slackDisplayTarget?: string;
  slackConnectedAt?: string;
}) {
  const users = readUsers();
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const existingIndex = users.findIndex((item) => item.email === email);
  const existing = existingIndex >= 0 ? users[existingIndex] : null;
  const nextName = input.name.trim() || existing?.name || email.split('@')[0];

  const next: AuthUserRecord = existingIndex >= 0
    ? {
        ...users[existingIndex],
        email,
        name: nextName,
        role: input.role,
        method: input.method,
        acceptedTerms: input.acceptedTerms || Boolean(existing?.acceptedTerms),
        acceptedEducation: input.acceptedEducation || Boolean(existing?.acceptedEducation),
        slackWorkspace: input.slackWorkspace ?? existing?.slackWorkspace,
        slackChannelId: input.slackChannelId ?? existing?.slackChannelId,
        slackDisplayTarget: input.slackDisplayTarget ?? existing?.slackDisplayTarget,
        slackConnectedAt: input.slackConnectedAt ?? existing?.slackConnectedAt,
        updatedAt: now,
      }
    : {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email,
        name: nextName,
        role: input.role,
        method: input.method,
        acceptedTerms: input.acceptedTerms,
        acceptedEducation: input.acceptedEducation,
        slackWorkspace: input.slackWorkspace,
        slackChannelId: input.slackChannelId,
        slackDisplayTarget: input.slackDisplayTarget,
        slackConnectedAt: input.slackConnectedAt,
        createdAt: now,
        updatedAt: now,
      };

  if (existingIndex >= 0) {
    users[existingIndex] = next;
  } else {
    users.unshift(next);
  }
  writeUsers(users);
  return next;
}

export function createAuthSession(userId: string) {
  const sessions = readSessions().filter((session) => session.expiresAt > new Date().toISOString());
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const record: AuthSessionRecord = {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + THIRTY_DAYS_MS).toISOString(),
  };

  sessions.unshift(record);
  writeSessions(sessions);
  return { token, session: record };
}

export function clearAuthSession(token: string) {
  const tokenHash = hashToken(token);
  const sessions = readSessions().filter((session) => session.tokenHash !== tokenHash);
  writeSessions(sessions);
}

export function getAuthUserByToken(token: string) {
  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();
  const sessions = readSessions();
  const session = sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > nowIso);
  if (!session) return null;

  const user = readUsers().find((item) => item.id === session.userId);
  if (!user) return null;
  return { user, session };
}
