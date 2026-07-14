import strictAssert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { AuthSession } from '../src/lib/auth';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const billingPage = readFileSync(new URL('../src/pages/Billing.tsx', import.meta.url), 'utf8');
const backendCatalog = readFileSync(new URL('../../backend/src/platform/billing.ts', import.meta.url), 'utf8');
const pricingAccessPath = new URL('../src/lib/pricingAccess.ts', import.meta.url);

assert(billingPage.includes('Best for 1–3 active missions'), 'Start mission guidance is present');
assert(billingPage.includes('Best for 5–10 active missions'), 'Pro mission guidance is present');
assert(billingPage.includes('Actual run volume depends on mission complexity and credit usage.'), 'workload caveat is present');
assert(!/5 seats|extra seat|Included seats/i.test(billingPage), 'public pricing has no unsupported seat claim');
assert(!/5 included seats|extraSeatPriceUsd:\s*29/.test(backendCatalog), 'backend Pro packaging has no unsupported seat claim');
assert(existsSync(pricingAccessPath), 'pricing uses an executable server-session access decision helper');

const { decidePricingAccess, checkoutErrorDecision } = await import('../src/lib/pricingAccess');
const currentUser = {
  email: 'founder@example.com',
  name: 'Founder',
  role: 'user',
  method: 'google',
  participantType: 'founder_operator',
  acceptedTerms: true,
  acceptedEducation: true,
  requiresTermsAcceptance: false,
  createdAt: '2026-07-11T12:00:00.000Z',
} satisfies AuthSession;

strictAssert.deepEqual(
  decidePricingAccess({ sessionResolved: false, session: currentUser, returnPath: '/pricing?plan=pro' }),
  { kind: 'pending' },
  'cached approval cannot enable checkout before the backend session resolves',
);
strictAssert.deepEqual(
  decidePricingAccess({ sessionResolved: true, session: null, returnPath: '/pricing?plan=pro' }),
  { kind: 'apply', href: '/signup?next=%2Fpricing%3Fplan%3Dpro' },
  'a missing or revoked backend session routes to the beta application',
);
strictAssert.deepEqual(
  decidePricingAccess({
    sessionResolved: true,
    session: { ...currentUser, requiresTermsAcceptance: true },
    returnPath: '/pricing?plan=pro',
  }),
  { kind: 'accept_terms', href: '/access-terms?next=%2Fpricing%3Fplan%3Dpro' },
  'an approved participant with stale Terms reaccepts before checkout',
);
strictAssert.deepEqual(
  decidePricingAccess({ sessionResolved: true, session: currentUser, returnPath: '/pricing?plan=pro' }),
  { kind: 'checkout' },
  'a fresh approved current session may checkout',
);
strictAssert.deepEqual(
  checkoutErrorDecision({ status: 403, code: 'terms_reacceptance_required' }, '/pricing?plan=team'),
  {
    message: 'Review the current beta terms before continuing to checkout.',
    action: { label: 'Review beta terms', href: '/access-terms?next=%2Fpricing%3Fplan%3Dteam' },
  },
  'checkout Terms errors provide a safe reacceptance route',
);
strictAssert.deepEqual(
  checkoutErrorDecision({ status: 401, code: 'beta_session_required' }, '/pricing?plan=team'),
  {
    message: 'Your approved session expired. Apply again or sign in before checkout.',
    action: { label: 'Apply for beta', href: '/signup?next=%2Fpricing%3Fplan%3Dteam' },
  },
  'checkout session errors provide an actionable beta application route',
);

console.log('pricingPackaging.contract: pricing packaging verified');
