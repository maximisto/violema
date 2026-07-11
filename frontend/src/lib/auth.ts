export type AccessRole = 'user' | 'admin';
export type AuthMethod = 'email' | 'google' | 'microsoft';
export type ParticipantType = 'founder_operator' | 'investor' | 'partner';

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

function normalizeParticipantType(value?: string): ParticipantType | null {
  if (value === 'founder_operator' || value === 'investor' || value === 'partner') return value;
  return null;
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

export type PersistAuthSessionResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'verification_sent'; message: string };

export type AuthSessionRequest = Pick<AuthSession, 'email' | 'name' | 'role' | 'method' | 'createdAt'>
  & Partial<Pick<AuthSession, 'participantType' | 'acceptedTerms' | 'acceptedEducation' | 'slackWorkspace' | 'slackChannelId' | 'slackDisplayTarget' | 'slackConnectedAt'>>
  & { intent: 'signup' | 'login'; termsVersion?: string };

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
    throw new Error(payload?.error || 'Could not create auth session');
  }

  const nextSession = hydrateSession(payload.user);
  if (!nextSession) {
    throw new Error('Auth session response was incomplete');
  }

  saveAuthSession(nextSession);
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
  if (!response.ok || !payload?.user) return null;
  const session = hydrateSession(payload.user);
  if (!session) return null;
  saveAuthSession(session);
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
