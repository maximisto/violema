/**
 * Email sign-in link — the browser-agnostic way back into an existing account.
 *
 * Exists because Safari's storage-access behaviour can strand the Google
 * account chooser when several Google accounts are signed in: the chooser
 * renders, an account is picked, and the OAuth flow never returns. Nothing is
 * wrong with the authorization request, so the fix is a second door rather than
 * a change to the first one.
 *
 * The one rule this module carries: the UI must never say anything the API
 * deliberately refuses to say. `/api/auth/magic-link/request` answers 200 with
 * one generic message for a real account, an unapproved account, a revoked
 * account, and an address that has never existed. If the client turned a
 * network hiccup, a 404, or a 500 into a different sentence, the API's
 * enumeration defence would be undone in the browser. Hence
 * `resolveMagicLinkFeedback`: one message for every outcome except a throttle,
 * which is about the caller's network and says nothing about any account.
 */

/**
 * The only confirmation shown after asking for a link. Mirrors the backend's
 * `MAGIC_LINK_GENERIC_MESSAGE`; the server's own wording wins when present.
 */
export const MAGIC_LINK_GENERIC_CONFIRMATION =
  'If that address has a Violema account, a sign-in link is on its way.';

/** About the caller's network, never about an account — safe to show verbatim. */
export const MAGIC_LINK_THROTTLED_MESSAGE =
  'Too many attempts from this network. Wait a few minutes and try again.';

/** Matches the backend's `MAGIC_LINK_RESEND_COOLDOWN_MS`. */
export const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = 60;

/** Sign-in links only work for accounts that already exist and are approved. */
export const MAGIC_LINK_ELIGIBILITY_NOTE =
  'For accounts that are already approved. Approval itself still runs through Google or Microsoft.';

export type MagicLinkFeedback = {
  kind: 'sent' | 'throttled';
  message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidMagicLinkEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Turn a response into what the visitor is told.
 *
 * Every status other than 429 collapses to the same confirmation — including
 * failures. That is deliberate: a distinguishable error is an oracle. The
 * server's message is preferred when it sent one, so the two stay in step
 * without the copy being maintained twice.
 */
export function resolveMagicLinkFeedback(input: {
  status: number;
  message?: string | null;
}): MagicLinkFeedback {
  if (input.status === 429) {
    return { kind: 'throttled', message: MAGIC_LINK_THROTTLED_MESSAGE };
  }
  return {
    kind: 'sent',
    message: input.message?.trim() || MAGIC_LINK_GENERIC_CONFIRMATION,
  };
}
