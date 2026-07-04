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

export function isAdminSession(session: AuthSession | null | undefined): boolean {
  if (!session) return false;
  return session.role === 'admin';
}

function normalizeSessionRole(_email: string, role?: string): AccessRole {
  if (role === 'admin') return 'admin';
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

export type PersistAuthSessionResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'verification_sent'; message: string };

export async function persistAuthSessionToBackend(
  session: AuthSession,
  options: { next?: string } = {},
): Promise<PersistAuthSessionResult> {
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
    intent: 'signup' | 'login';
    next: string;
    acceptedTerms?: boolean;
    acceptedEducation?: boolean;
  },
) {
  const params = new URLSearchParams({
    intent: options.intent,
    next: options.next,
  });
  if (typeof options.acceptedTerms === 'boolean') {
    params.set('acceptedTerms', options.acceptedTerms ? '1' : '0');
  }
  if (typeof options.acceptedEducation === 'boolean') {
    params.set('acceptedEducation', options.acceptedEducation ? '1' : '0');
  }
  window.location.assign(`/api/auth/${provider}/start?${params.toString()}`);
}
