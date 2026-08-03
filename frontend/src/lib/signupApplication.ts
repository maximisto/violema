/**
 * Applicant-side truth for the two-pass beta application.
 *
 * The flow that confused even the founder (2026-08-02 tenant-journey run
 * note, break #7): a signup OAuth attempt that BOUNCES is the application
 * *succeeding* — identity and terms evidence land on the bounce, and only
 * then can an admin approve. Until this module, that success came back as
 * `?error=` and rendered in red, indistinguishable from a real failure.
 *
 * The backend now redirects an evidence-bearing signup bounce to
 * `/signup?applied=1&email=…`. This module turns the query string into one
 * of three explicit outcomes so the page never has to guess from message
 * text, and keeps the applicant-facing copy in one place, shared with the
 * contract test.
 */

export const APPLICATION_RECEIVED_TITLE = 'Application received';

export const APPLICATION_RECEIVED_STEPS: readonly string[] = [
  'A human reviews every application — there is no automated approval.',
  'You will get an email when you are approved. We just sent a confirmation so you know this worked.',
  'After approval, sign in with the same account you applied with — or use the email sign-in link if your browser fights the account chooser.',
];

/** Shown when a repeat sign-in bounces while approval is still pending. */
export const APPLICATION_PENDING_NOTE =
  'Until approval lands, signing in will keep bringing you back here. That is expected, not an error.';

/**
 * The email form records interest but cannot verify identity, so it cannot
 * complete an application. Amber guidance, not a red failure.
 */
export const EMAIL_FORM_RECORDED_TITLE = 'Request recorded — one step left';
export const EMAIL_FORM_RECORDED_BODY =
  'To complete your application, continue with Google or Microsoft above. That verifies your identity, which approval requires. You will get a confirmation email once it is done.';

export type SignupNotice =
  | { kind: 'applied'; email: string | null }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

/**
 * `applied` wins over `error`: if the backend said the application landed,
 * no stale error parameter may repaint it as a failure.
 */
export function resolveSignupNotice(search: string): SignupNotice {
  const params = new URLSearchParams(search);
  if (params.get('applied') === '1') {
    const email = params.get('email');
    return { kind: 'applied', email: email && email.includes('@') ? email : null };
  }
  const error = params.get('error');
  if (error?.trim()) {
    return { kind: 'error', message: error.trim() };
  }
  return { kind: 'none' };
}
