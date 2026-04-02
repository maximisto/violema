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
