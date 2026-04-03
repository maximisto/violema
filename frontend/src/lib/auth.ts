export type AccessRole = 'user' | 'tester' | 'investor' | 'admin';
export type AuthMethod = 'email' | 'google' | 'microsoft';

export interface AuthSession {
  email: string;
  name: string;
  role: AccessRole;
  method: AuthMethod;
  acceptedTerms: boolean;
  acceptedEducation: boolean;
  createdAt: string;
  slackWorkspace?: string;
  slackChannelId?: string;
  slackDisplayTarget?: string;
  slackConnectedAt?: string;
}

const SESSION_KEY = 'violema_auth_session';
const LEGACY_SESSION_KEY = 'nexus_auth_session';
const ADMIN_EMAILS = new Set([
  'max@purpleorange.io',
  'max@violema.com',
]);

function normalizeEmail(value: string | undefined | null) {
  return (value || '').trim().toLowerCase();
}

export function isAdminEmail(email: string | undefined | null) {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.role !== 'string' ||
      typeof parsed.method !== 'string' ||
      typeof parsed.acceptedTerms !== 'boolean' ||
      typeof parsed.acceptedEducation !== 'boolean' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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

export function isAdminSession(session: AuthSession | null = getAuthSession()): boolean {
  if (!session) return false;
  return session.role === 'admin' || isAdminEmail(session.email);
}

function normalizeSessionRole(email: string, role?: string): AccessRole {
  if (role === 'admin' || isAdminEmail(email)) return 'admin';
  if (role === 'tester') return 'tester';
  if (role === 'investor') return 'investor';
  return 'user';
}

function isAuthSessionShape(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return (
    typeof session.email === 'string' &&
    typeof session.name === 'string' &&
    typeof session.role === 'string' &&
    typeof session.method === 'string' &&
    typeof session.acceptedTerms === 'boolean' &&
    typeof session.acceptedEducation === 'boolean' &&
    typeof session.createdAt === 'string'
  );
}

function hydrateSession(value: Partial<AuthSession>): AuthSession | null {
  if (!value.email || !value.name || !value.method || typeof value.acceptedTerms !== 'boolean' || typeof value.acceptedEducation !== 'boolean') {
    return null;
  }

  return {
    email: value.email,
    name: value.name,
    role: normalizeSessionRole(value.email, value.role),
    method: value.method,
    acceptedTerms: value.acceptedTerms,
    acceptedEducation: value.acceptedEducation,
    createdAt: value.createdAt || new Date().toISOString(),
    slackWorkspace: value.slackWorkspace,
    slackChannelId: value.slackChannelId,
    slackDisplayTarget: value.slackDisplayTarget,
    slackConnectedAt: value.slackConnectedAt,
  };
}

export async function persistAuthSessionToBackend(session: AuthSession) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      email: session.email,
      name: session.name,
      method: session.method,
      acceptedTerms: session.acceptedTerms,
      acceptedEducation: session.acceptedEducation,
    }),
  });

  const payload = await response.json().catch(() => null) as { error?: string; user?: Partial<AuthSession> } | null;
  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || 'Could not create auth session');
  }

  const nextSession = hydrateSession(payload.user);
  if (!nextSession) {
    throw new Error('Auth session response was incomplete');
  }

  saveAuthSession(nextSession);
  return nextSession;
}

export async function fetchBackendAuthSession() {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
  });

  if (response.status === 401) return null;
  const payload = await response.json().catch(() => null) as { user?: Partial<AuthSession> } | null;
  if (!response.ok || !payload?.user) return null;
  const session = hydrateSession(payload.user);
  if (!session) return null;
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
