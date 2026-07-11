import type { AuthSession } from './auth';

export type PricingAccessDecision =
  | { kind: 'pending' }
  | { kind: 'apply'; href: string }
  | { kind: 'accept_terms'; href: string }
  | { kind: 'checkout' };

function safePricingReturnPath(value: string) {
  if (value.startsWith('//') || !value.startsWith('/')) return '/pricing';
  try {
    const url = new URL(value, 'https://violema.com');
    if (url.origin !== 'https://violema.com') return '/pricing';
    if (url.pathname !== '/pricing' && url.pathname !== '/plans') return '/pricing';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/pricing';
  }
}

function applicationHref(returnPath: string) {
  return `/signup?next=${encodeURIComponent(safePricingReturnPath(returnPath))}`;
}

function termsHref(returnPath: string) {
  return `/access-terms?next=${encodeURIComponent(safePricingReturnPath(returnPath))}`;
}

export function decidePricingAccess(input: {
  sessionResolved: boolean;
  session: AuthSession | null;
  returnPath: string;
}): PricingAccessDecision {
  if (!input.sessionResolved) return { kind: 'pending' };
  if (!input.session) return { kind: 'apply', href: applicationHref(input.returnPath) };
  if (input.session.role !== 'admin' && input.session.requiresTermsAcceptance) {
    return { kind: 'accept_terms', href: termsHref(input.returnPath) };
  }
  return { kind: 'checkout' };
}

export function checkoutErrorDecision(
  error: { status?: number; code?: string },
  returnPath: string,
) {
  if (error.code === 'terms_reacceptance_required') {
    return {
      message: 'Review the current beta terms before continuing to checkout.',
      action: { label: 'Review beta terms', href: termsHref(returnPath) },
    };
  }
  if (error.status === 401 || error.status === 403 || error.code === 'access_not_approved') {
    return {
      message: 'Your approved session expired. Apply again or sign in before checkout.',
      action: { label: 'Apply for beta', href: applicationHref(returnPath) },
    };
  }
  return {
    message: 'Checkout could not start. Review your selection and try again.',
    action: { label: 'Return to pricing', href: safePricingReturnPath(returnPath) },
  };
}
