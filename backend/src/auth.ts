import crypto from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './platform/jsonStore';

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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readUsers() {
  return readJsonFile<AuthUserRecord[]>(USERS_FILE, []);
}

function writeUsers(users: AuthUserRecord[]) {
  writeJsonFile(USERS_FILE, users);
}

function readSessions() {
  return readJsonFile<AuthSessionRecord[]>(SESSIONS_FILE, []);
}

function writeSessions(sessions: AuthSessionRecord[]) {
  writeJsonFile(SESSIONS_FILE, sessions);
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
