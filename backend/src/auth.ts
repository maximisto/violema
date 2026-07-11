import crypto from 'crypto';
import path from 'path';
import { readJsonFile, writeJsonFile } from './platform/jsonStore';
import { DEFAULT_WORKSPACE_ID } from './platform/workspace';
import {
  getAccessRecord,
  listAdminAccessRecords,
  recordAccessRequest,
} from './adminAccessStore';
import { hasCurrentBetaConsent } from './betaConsentStore';
import {
  CURRENT_BETA_TERMS_VERSION,
  defaultParticipantType,
  normalizeParticipantType,
  type ParticipantType,
} from './betaProgram';

export type AuthMethod = 'email' | 'google' | 'microsoft';
export type AccessRole = 'user' | 'admin';

export interface AuthUserRecord {
  id: string;
  email: string;
  name: string;
  role: AccessRole;
  method: AuthMethod;
  workspaceIds: string[];
  defaultWorkspaceId: string;
  participantType: ParticipantType;
  acceptedTerms: boolean;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
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
const ADMIN_MAGIC_LOGIN_TTL_MS = 1000 * 60 * 10;
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

export class WorkspaceAccessDeniedError extends Error {
  statusCode = 403;
  code = 'workspace_access_denied';

  constructor(message = 'Workspace access denied.') {
    super(message);
    this.name = 'WorkspaceAccessDeniedError';
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function deriveUserWorkspaceId(userId: string) {
  return `workspace_${crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16)}`;
}

function normalizeWorkspaceIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
    .filter(Boolean)));
}

function normalizeAuthUserRecord(user: AuthUserRecord): AuthUserRecord {
  const fallbackWorkspaceId = user.role === 'admin' ? DEFAULT_WORKSPACE_ID : deriveUserWorkspaceId(user.id);
  const workspaceIds = normalizeWorkspaceIds(user.workspaceIds);
  const defaultWorkspaceId =
    typeof user.defaultWorkspaceId === 'string' && user.defaultWorkspaceId.trim()
      ? user.defaultWorkspaceId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : fallbackWorkspaceId;
  const nextWorkspaceIds = workspaceIds.includes(defaultWorkspaceId)
    ? workspaceIds
    : [defaultWorkspaceId, ...workspaceIds];
  let accessParticipantType: ParticipantType | null = null;
  try {
    accessParticipantType = getAccessRecord(user.email)?.participantType || null;
  } catch {
    // Legacy user migration must remain available if the access store is unavailable.
  }
  const participantType = normalizeParticipantType(user.participantType)
    || accessParticipantType
    || defaultParticipantType();

  return {
    ...user,
    workspaceIds: nextWorkspaceIds,
    defaultWorkspaceId,
    participantType,
  };
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

export function isEmailAdminForAccess(email: string) {
  return isEmailApprovedForAccess(email) && resolveAuthRole(email) === 'admin';
}

export function isUnverifiedEmailSessionAllowed(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== 'production';
}

export function isDirectAdminEmailLoginAllowed(
  email: string,
  env: Record<string, string | undefined> = process.env,
) {
  return !isUnverifiedEmailSessionAllowed(env) && isEmailAdminForAccess(email);
}

function getAdminMagicLoginSecret(secret?: string) {
  const resolved =
    secret?.trim() ||
    process.env.AUTH_MAGIC_LINK_SECRET?.trim() ||
    process.env.AUTH_STATE_SECRET?.trim() ||
    process.env.SLACK_SIGNING_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (resolved) return resolved;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_MAGIC_LINK_SECRET or AUTH_STATE_SECRET is required for admin magic login.');
  }

  return 'violema-admin-magic-login-dev-secret';
}

function sanitizeMagicLoginNext(value: string | undefined) {
  const next = value?.trim() || '/admin';
  if (!next.startsWith('/') || next.startsWith('//')) return '/admin';
  return next;
}

function signAuthPayload(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('hex');
  return `${encoded}.${signature}`;
}

function verifySignedAuthPayload(token: string | undefined, secret: string) {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createAdminMagicLoginToken(input: {
  email: string;
  name?: string;
  next?: string;
  ttlMs?: number;
  nowMs?: number;
  secret?: string;
}) {
  const email = normalizeEmail(input.email);
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error('valid email is required');
  }

  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = input.ttlMs ?? ADMIN_MAGIC_LOGIN_TTL_MS;
  const payload = {
    purpose: 'admin_magic',
    email,
    name: input.name?.trim() || email.split('@')[0],
    next: sanitizeMagicLoginNext(input.next),
    issuedAt: nowMs,
    expiresAt: nowMs + ttlMs,
  };
  return signAuthPayload(payload, getAdminMagicLoginSecret(input.secret));
}

export function verifyAdminMagicLoginToken(
  token: string | undefined,
  options: { nowMs?: number; secret?: string } = {},
) {
  const payload = verifySignedAuthPayload(token, getAdminMagicLoginSecret(options.secret)) as Partial<{
    purpose: string;
    email: string;
    name: string;
    next: string;
    issuedAt: number;
    expiresAt: number;
  }> | null;
  if (!payload) return null;

  try {
    if (
      payload.purpose !== 'admin_magic' ||
      typeof payload.email !== 'string' ||
      !/\S+@\S+\.\S+/.test(payload.email) ||
      typeof payload.next !== 'string' ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      return null;
    }
    if ((options.nowMs ?? Date.now()) > payload.expiresAt) return null;

    return {
      email: normalizeEmail(payload.email),
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : normalizeEmail(payload.email).split('@')[0],
      next: sanitizeMagicLoginNext(payload.next),
    };
  } catch {
    return null;
  }
}

export function assertEmailApprovedForAccess(email: string) {
  if (!isEmailApprovedForAccess(email)) {
    throw new AuthAccessDeniedError();
  }
}

function readUsers() {
  const users = readJsonFile<AuthUserRecord[]>(USERS_FILE, []);
  const normalized = users.map(normalizeAuthUserRecord);
  const needsMigration = JSON.stringify(users) !== JSON.stringify(normalized);
  if (needsMigration) writeUsers(normalized);
  return normalized;
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
  participantType?: ParticipantType;
  identityVerifiedAt?: string;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
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
  participantType?: ParticipantType;
  acceptedTerms: boolean;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
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
  let accessParticipantType: ParticipantType | null = null;
  try {
    accessParticipantType = getAccessRecord(email)?.participantType || null;
  } catch {
    // Preserve admin recovery and legacy user updates when the access store is unavailable.
  }
  const participantType = normalizeParticipantType(input.participantType)
    || accessParticipantType
    || existing?.participantType
    || defaultParticipantType();
  const nextName = input.name.trim() || existing?.name || email.split('@')[0];
  const id = existing?.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fallbackWorkspaceId = input.role === 'admin' ? DEFAULT_WORKSPACE_ID : deriveUserWorkspaceId(id);
  const defaultWorkspaceId = existing?.defaultWorkspaceId || fallbackWorkspaceId;
  const workspaceIds = normalizeWorkspaceIds(existing?.workspaceIds);
  if (!workspaceIds.includes(defaultWorkspaceId)) workspaceIds.unshift(defaultWorkspaceId);

  const next: AuthUserRecord = existingIndex >= 0
    ? {
        ...users[existingIndex],
        email,
        name: nextName,
        role: input.role,
        method: input.method,
        workspaceIds,
        defaultWorkspaceId,
        participantType,
        acceptedTerms: input.acceptedTerms,
        acceptedTermsVersion: input.acceptedTermsVersion ?? existing?.acceptedTermsVersion,
        acceptedTermsAt: input.acceptedTermsAt ?? existing?.acceptedTermsAt,
        acceptedEducation: input.acceptedEducation || Boolean(existing?.acceptedEducation),
        slackWorkspace: input.slackWorkspace ?? existing?.slackWorkspace,
        slackChannelId: input.slackChannelId ?? existing?.slackChannelId,
        slackDisplayTarget: input.slackDisplayTarget ?? existing?.slackDisplayTarget,
        slackConnectedAt: input.slackConnectedAt ?? existing?.slackConnectedAt,
        updatedAt: now,
      }
    : {
        id,
        email,
        name: nextName,
        role: input.role,
        method: input.method,
        workspaceIds,
        defaultWorkspaceId,
        participantType,
        acceptedTerms: input.acceptedTerms,
        acceptedTermsVersion: input.acceptedTermsVersion,
        acceptedTermsAt: input.acceptedTermsAt,
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

export function authUserHasCurrentTerms(user: AuthUserRecord) {
  return user.acceptedTermsVersion === CURRENT_BETA_TERMS_VERSION
    && hasCurrentBetaConsent(user.email);
}

export function getAuthUserDefaultWorkspaceId(user: AuthUserRecord) {
  return normalizeAuthUserRecord(user).defaultWorkspaceId;
}

export function getAuthUserWorkspaceIds(user: AuthUserRecord) {
  return normalizeAuthUserRecord(user).workspaceIds;
}

export function canAuthUserAccessWorkspace(user: AuthUserRecord, workspaceId: string) {
  if (user.role === 'admin') return true;
  return getAuthUserWorkspaceIds(user).includes(workspaceId);
}

export function assertAuthUserCanAccessWorkspace(user: AuthUserRecord, workspaceId: string) {
  if (!canAuthUserAccessWorkspace(user, workspaceId)) {
    throw new WorkspaceAccessDeniedError();
  }
}

function normalizeSlackLookupValue(value: string | undefined) {
  return value?.trim().toLowerCase() || '';
}

export function resolveSlackEventWorkspace(input: {
  teamId?: string;
  channelId?: string;
  allowTeamFallback?: boolean;
}): { workspaceId: string; userId: string; match: 'team_channel' | 'channel' | 'team' } | null {
  const channelId = normalizeSlackLookupValue(input.channelId);
  if (!channelId) return null;

  const teamId = normalizeSlackLookupValue(input.teamId);
  let channelMatch: AuthUserRecord | null = null;
  let teamMatch: AuthUserRecord | null = null;

  for (const user of listAuthUsers()) {
    const workspaceId = getAuthUserDefaultWorkspaceId(user);
    const userSlackWorkspace = normalizeSlackLookupValue(user.slackWorkspace);
    if (input.allowTeamFallback && teamId && userSlackWorkspace === teamId && !teamMatch) {
      teamMatch = user;
    }
    if (normalizeSlackLookupValue(user.slackChannelId) !== channelId) continue;
    if (teamId && userSlackWorkspace === teamId) {
      return { workspaceId, userId: user.id, match: 'team_channel' };
    }
    if (!channelMatch) channelMatch = user;
  }

  if (channelMatch) {
    return {
      workspaceId: getAuthUserDefaultWorkspaceId(channelMatch),
      userId: channelMatch.id,
      match: 'channel',
    };
  }

  return teamMatch
    ? {
        workspaceId: getAuthUserDefaultWorkspaceId(teamMatch),
        userId: teamMatch.id,
        match: 'team',
      }
    : null;
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
