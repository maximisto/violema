import { existsSync, readFileSync } from 'node:fs';
import { sanitizeLocalNextPath } from '../src/pages/AccessTerms';
import { fetchBackendAuthSession } from '../src/lib/auth';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function readSource(path: URL) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const signup = readSource(new URL('../src/pages/Signup.tsx', import.meta.url));
const login = readSource(new URL('../src/pages/Login.tsx', import.meta.url));
const terms = readSource(new URL('../src/pages/TermsOfService.tsx', import.meta.url));
const accessTerms = readSource(new URL('../src/pages/AccessTerms.tsx', import.meta.url));
const auth = readSource(new URL('../src/lib/auth.ts', import.meta.url));
const protectedRoute = readSource(new URL('../src/components/ProtectedRoute.tsx', import.meta.url));
const app = readSource(new URL('../src/App.tsx', import.meta.url));

assert(signup.includes('founder_operator'), 'signup captures founder/operator');
assert(signup.includes('investor'), 'signup captures investor');
assert(signup.includes('partner'), 'signup captures partner');
assert(signup.includes('Beta Confidentiality and Evaluation Terms'), 'signup names confidentiality terms');
assert(terms.includes("id: 'beta-confidentiality'"), 'terms expose a confidentiality anchor');
assert(accessTerms.includes('/api/auth/terms/accept'), 'reacceptance posts to the backend');
assert(
  /<pre[^>]*>[\s\S]*\{terms\.canonicalText\}[\s\S]*<\/pre>/.test(accessTerms),
  'reacceptance visibly renders the exact backend canonical text',
);
assert(app.includes('path="/access-terms"'), 'app registers reacceptance route');
assert(protectedRoute.includes('requiresTermsAcceptance'), 'protected route uses server-owned current Terms state');
assert(!login.includes('acceptedTerms: true'), 'login does not synthesize acceptance');
assert(/const session = \{[\s\S]*intent: 'signup'/.test(signup), 'direct signup identifies its bounded intent');
assert(/const session = \{[\s\S]*intent: 'login'/.test(login), 'direct login identifies its bounded intent');
assert(auth.includes('intent: session.intent'), 'direct-session request sends its bounded intent');
assert(auth.includes('clearAuthSession();\n    return null;'), 'failed backend session refresh clears stale local readiness');

const storage = new Map<string, string>([['violema_auth_session', JSON.stringify({ acceptedTerms: true })]]);
const originalLocalStorage = globalThis.localStorage;
const originalFetch = globalThis.fetch;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  },
});
globalThis.fetch = async () => new Response(JSON.stringify({ code: 'access_not_approved' }), {
  status: 403,
  headers: { 'Content-Type': 'application/json' },
});
try {
  assert(await fetchBackendAuthSession() === null, 'revoked backend refresh returns no usable session');
  assert(!storage.has('violema_auth_session'), 'revoked backend refresh removes stale cached readiness');
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage });
}

for (const heading of [
  'Beta information',
  'Evaluation-only use',
  'Protection and disclosure',
  'Exclusions',
  'Required disclosure',
  'Publicity restrictions',
  'Duration',
  'Participant data',
]) {
  assert(terms.includes(`**${heading}.**`), `terms include the ${heading} operative heading`);
}
assert(terms.includes('two years after your last beta access'), 'terms state the two-year confidentiality duration');
assert(terms.includes('trade secret remains protected'), 'terms preserve ongoing trade-secret protection');
assert(terms.includes('should be reviewed by qualified counsel'), 'terms include the explicit counsel-review notice');

assert(auth.includes("export type AccessRole = 'user' | 'admin'"), 'frontend roles match production roles');
assert(auth.includes("export type ParticipantType = 'founder_operator' | 'investor' | 'partner'"), 'frontend models participant types');
assert(auth.includes('termsVersion'), 'signup OAuth flow carries the current Terms version');
assert(accessTerms.includes("startsWith('//')"), 'reacceptance rejects protocol-relative next paths');
assert(accessTerms.includes("startsWith('/')"), 'reacceptance requires a leading slash for next paths');
assert(protectedRoute.includes("role === 'admin'"), 'admin reacceptance remains non-blocking');

const origin = 'https://violema.com';
assert(sanitizeLocalNextPath('/settings?tab=profile#security', origin) === '/settings?tab=profile#security', 'sanitizer preserves safe local next paths');
for (const unsafeNext of [
  'https://evil.example/path',
  '//evil.example/path',
  'dashboard',
  '/access-terms',
  '/access-terms/',
  '/access-terms/repeat',
  '/access-terms?next=%2Faccess-terms',
  '/access-terms#review',
  '/ACCESS-TERMS',
  '/Access-Terms?next=%2Fdashboard',
  '/aCcEsS-tErMs/repeat#review',
]) {
  assert(sanitizeLocalNextPath(unsafeNext, origin) === '/dashboard', `sanitizer rejects unsafe next path: ${unsafeNext}`);
}

console.log('betaAccess.contract: participant application and reacceptance verified');
