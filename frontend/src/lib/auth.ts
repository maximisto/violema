import { resolveMagicLinkFeedback, type MagicLinkFeedback } from './magicLink';
import { adoptAuthWorkspace, isFounderWorkspace } from './workspace';

export type AccessRole = 'user' | 'admin';
export type AuthMethod = 'email' | 'google' | 'microsoft';
/**
 * Who someone is. Classification only — `role` remains the sole authorization
 * axis. Mirrors `backend/src/betaProgram.ts`; `team_member` and `advisor` were
 * added 2026-08-02.
 */
export type ParticipantType =
  | 'founder_operator'
  | 'investor'
  | 'partner'
  | 'team_member'
  | 'advisor';

export const PARTICIPANT_TYPES: ParticipantType[] = [
  'founder_operator',
  'investor',
  'partner',
  'team_member',
  'advisor',
];

const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  founder_operator: 'Founder / operator',
  investor: 'Investor',
  partner: 'Partner',
  team_member: 'Team member',
  advisor: 'Advisor',
};

/**
 * A readable label for any participant value, including one this build does not
 * know about yet — the backend is the catalog's owner and may ship a new type
 * first.
 */
export function participantTypeLabel(value: string): string {
  return PARTICIPANT_TYPE_LABELS[value as ParticipantType]
    || value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export interface AuthSession {
  email: string;
  name: string;
  role: AccessRole;
  method: AuthMethod;
  participantType: ParticipantType;
  acceptedTerms: boolean;
  acceptedTermsVersion?: string;
  acceptedTermsAt?: string;
  acceptedEducation: boolean;
  requiresTermsAcceptance: boolean;
  createdAt: string;
  slackWorkspace?: string;
  slackChannelId?: string;
  slackDisplayTarget?: string;
  slackConnectedAt?: string;
}

const SESSION_KEY = 'violema_auth_session';
const LEGACY_SESSION_KEY = 'nexus_auth_session';

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    return hydrateCachedSession(parsed);
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  const displaySession = {
    email: session.email,
    name: session.name,
    method: session.method,
    participantType: session.participantType,
    acceptedTerms: session.acceptedTerms,
    acceptedTermsVersion: session.acceptedTermsVersion,
    acceptedTermsAt: session.acceptedTermsAt,
    acceptedEducation: session.acceptedEducation,
    requiresTermsAcceptance: session.requiresTermsAcceptance,
    createdAt: session.createdAt,
    slackWorkspace: session.slackWorkspace,
    slackChannelId: session.slackChannelId,
    slackDisplayTarget: session.slackDisplayTarget,
    slackConnectedAt: session.slackConnectedAt,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(displaySession));
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function hasAcceptedAccess(): boolean {
  const session = getAuthSession();
  return Boolean(session?.acceptedTerms && session?.acceptedEducation);
}

export function hasSlackConnection(): boolean {
  const session = getAuthSession();
  return Boolean(session?.slackWorkspace && session?.slackChannelId);
}

export function isAdminSession(session: AuthSession | null | undefined): boolean {
  if (!session) return false;
  return session.role === 'admin';
}

function normalizeSessionRole(role?: string): AccessRole {
  if (role === 'admin') return 'admin';
  return 'user';
}

/**
 * A missing participant type still invalidates the session — that field is part
 * of the contract and its absence means the payload is not a session.
 *
 * An UNRECOGNIZED one does not. The backend owns this catalog and can ship a new
 * type before the frontend knows it (exactly what happened when `team_member`
 * and `advisor` landed), and the old strict check turned that into a silent
 * logout for those accounts. Bucketing to the default matches the backend's own
 * `defaultParticipantType()` and is safe: this axis is classification only.
 */
function normalizeParticipantType(value?: string): ParticipantType | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return PARTICIPANT_TYPES.includes(value as ParticipantType)
    ? value as ParticipantType
    : 'founder_operator';
}

function hydrateSession(value: Partial<AuthSession>): AuthSession | null {
  const participantType = normalizeParticipantType(value.participantType);
  if (
    !value.email
    || !value.name
    || !value.method
    || !participantType
    || typeof value.acceptedTerms !== 'boolean'
    || typeof value.acceptedEducation !== 'boolean'
    || typeof value.requiresTermsAcceptance !== 'boolean'
  ) {
    return null;
  }

  return {
    email: value.email,
    name: value.name,
    role: normalizeSessionRole(value.role),
    method: value.method,
    participantType,
    acceptedTerms: value.acceptedTerms,
    acceptedTermsVersion: value.acceptedTermsVersion,
    acceptedTermsAt: value.acceptedTermsAt,
    acceptedEducation: value.acceptedEducation,
    requiresTermsAcceptance: value.requiresTermsAcceptance,
    createdAt: value.createdAt || new Date().toISOString(),
    slackWorkspace: value.slackWorkspace,
    slackChannelId: value.slackChannelId,
    slackDisplayTarget: value.slackDisplayTarget,
    slackConnectedAt: value.slackConnectedAt,
  };
}

function hydrateCachedSession(value: Partial<AuthSession>): AuthSession | null {
  const session = hydrateSession({
    ...value,
    role: 'user',
  });
  return session ? { ...session, role: 'user' } : null;
}

// The session payload spreads the full backend user record, so it carries the
// server-assigned default workspace even though AuthSession does not model it.
function adoptWorkspaceFromAuthPayload(user: Partial<AuthSession>, session: AuthSession) {
  const workspaceId = typeof (user as { defaultWorkspaceId?: unknown }).defaultWorkspaceId === 'string'
    ? ((user as { defaultWorkspaceId: string }).defaultWorkspaceId).trim()
    : '';
  if (!workspaceId) return;
  const firstName = session.name?.trim().split(/\s+/)[0] || '';
  const fallbackName = isFounderWorkspace(workspaceId)
    ? 'Purple Orange HQ'
    : firstName
      ? `${firstName}'s workspace`
      : 'My workspace';
  adoptAuthWorkspace(workspaceId, fallbackName);
}

export type PersistAuthSessionResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'verification_sent'; message: string };

export type AuthSessionRequest = Pick<AuthSession, 'email' | 'name' | 'role' | 'method' | 'createdAt'>
  & Partial<Pick<AuthSession, 'participantType' | 'acceptedTerms' | 'acceptedEducation' | 'slackWorkspace' | 'slackChannelId' | 'slackDisplayTarget' | 'slackConnectedAt'>>
  & { intent: 'signup' | 'login'; termsVersion?: string };

/**
 * Session-request failure that keeps the backend's machine-readable `code`.
 * Lets the signup page distinguish "your request is recorded, finish with
 * OAuth" (`access_not_approved`) from a real failure without matching on
 * message text.
 */
export class AuthSessionRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthSessionRequestError';
    this.code = code;
  }
}

export async function persistAuthSessionToBackend(
  session: AuthSessionRequest,
  options: { next?: string } = {},
): Promise<PersistAuthSessionResult> {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      intent: session.intent,
      email: session.email,
      name: session.name,
      method: session.method,
      participantType: session.participantType,
      acceptedTerms: session.acceptedTerms,
      termsVersion: session.termsVersion,
      acceptedEducation: session.acceptedEducation,
      slackWorkspace: session.slackWorkspace,
      slackChannelId: session.slackChannelId,
      slackDisplayTarget: session.slackDisplayTarget,
      slackConnectedAt: session.slackConnectedAt,
      next: options.next,
    }),
  });

  const payload = await response.json().catch(() => null) as {
    error?: string;
    code?: string;
    user?: Partial<AuthSession>;
    verificationRequired?: boolean;
    message?: string;
  } | null;
  if (response.status === 202 && payload?.verificationRequired) {
    return {
      status: 'verification_sent',
      message: payload.message || 'Check your email to finish signing in.',
    };
  }

  if (!response.ok || !payload?.user) {
    throw new AuthSessionRequestError(
      payload?.error || 'Could not create auth session',
      typeof payload?.code === 'string' ? payload.code : undefined,
    );
  }

  const nextSession = hydrateSession(payload.user);
  if (!nextSession) {
    throw new Error('Auth session response was incomplete');
  }

  saveAuthSession(nextSession);
  adoptWorkspaceFromAuthPayload(payload.user, nextSession);
  return { status: 'authenticated', session: nextSession };
}

export async function fetchBackendAuthSession() {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
  });

  if (response.status === 401) {
    clearAuthSession();
    return null;
  }
  const payload = await response.json().catch(() => null) as { user?: Partial<AuthSession> } | null;
  if (!response.ok || !payload?.user) {
    clearAuthSession();
    return null;
  }
  const session = hydrateSession(payload.user);
  if (!session) {
    clearAuthSession();
    return null;
  }
  saveAuthSession(session);
  adoptWorkspaceFromAuthPayload(payload.user, session);
  return session;
}

export async function updateBackendAuthSession(patch: Partial<AuthSession>) {
  const response = await fetch('/api/auth/session', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(patch),
  });

  if (response.status === 401) {
    clearAuthSession();
    throw new Error('Session expired');
  }

  const payload = await response.json().catch(() => null) as { error?: string; user?: Partial<AuthSession> } | null;
  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || 'Could not update auth session');
  }

  const session = hydrateSession(payload.user);
  if (!session) {
    throw new Error('Updated auth session response was incomplete');
  }

  saveAuthSession(session);
  return session;
}

export async function logoutBackendAuthSession() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } finally {
    clearAuthSession();
  }
}

/**
 * Ask for an email sign-in link.
 *
 * Never throws and never distinguishes outcomes: the endpoint answers 200 with
 * one generic message whatever the address is, and a client that turned a
 * transport failure into a different sentence would leak exactly what the
 * server hides. A thrown fetch is therefore treated as an unremarkable send.
 *
 * Creates no local session — a request is only a request. The session arrives
 * later, as the HttpOnly cookie set by the consume redirect, and is hydrated by
 * `fetchBackendAuthSession` like any other login.
 */
export async function requestMagicLinkSignIn(
  email: string,
  options: { next?: string } = {},
): Promise<MagicLinkFeedback> {
  try {
    const response = await fetch('/api/auth/magic-link/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email.trim(), next: options.next }),
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    return resolveMagicLinkFeedback({ status: response.status, message: payload?.message });
  } catch {
    return resolveMagicLinkFeedback({ status: 0 });
  }
}

export function beginOAuthFlow(
  provider: Exclude<AuthMethod, 'email'>,
  options: {
    intent: 'signup';
    next: string;
    acceptedTerms: boolean;
    acceptedEducation: boolean;
    participantType: ParticipantType;
    termsVersion: string;
  } | {
    intent: 'login';
    next: string;
  },
) {
  const params = new URLSearchParams({
    intent: options.intent,
    next: options.next,
  });
  if (options.intent === 'signup') {
    params.set('acceptedTerms', options.acceptedTerms ? '1' : '0');
    params.set('acceptedEducation', options.acceptedEducation ? '1' : '0');
    params.set('participantType', options.participantType);
    params.set('termsVersion', options.termsVersion);
  }
  window.location.assign(`/api/auth/${provider}/start?${params.toString()}`);
}
