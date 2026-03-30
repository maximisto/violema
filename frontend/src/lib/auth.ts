export type AccessRole = 'user' | 'tester' | 'investor';
export type AuthMethod = 'email' | 'google' | 'microsoft';

export interface AuthSession {
  email: string;
  name: string;
  role: AccessRole;
  method: AuthMethod;
  acceptedTerms: boolean;
  acceptedEducation: boolean;
  createdAt: string;
}

const SESSION_KEY = 'nexus_auth_session';

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
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
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function hasAcceptedAccess(): boolean {
  const session = getAuthSession();
  return Boolean(session?.acceptedTerms && session?.acceptedEducation);
}
