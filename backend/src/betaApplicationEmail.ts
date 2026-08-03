/**
 * The "application received" confirmation for the controlled beta.
 *
 * Field observation (2026-08-02 tenant-journey run note, break #7): applying is
 * a two-pass flow — the OAuth sign-in that BOUNCES is what lands identity and
 * terms evidence, and only then can an admin approve. The bounce rendered as a
 * red error with no follow-up, so applicants (including the founder) could not
 * tell whether anything had happened. This module is the applicant-facing half
 * of the fix: one plain transactional email, sent exactly once, at the moment
 * the application actually becomes approvable.
 *
 * Two rules this module carries:
 *
 * 1. The email goes ONLY to an address a provider just verified. The OAuth
 *    callback is the single call site — Google or Microsoft proved mailbox
 *    ownership seconds earlier. The email-form path never sends: its address is
 *    unverified caller input on an unauthenticated endpoint, which would be an
 *    open relay for one-shot spam to any inbox.
 *
 * 2. Once per application, not per attempt. A bounced sign-in can repeat any
 *    number of times while approval is pending; only the attempt that first
 *    attaches identity evidence sends mail. Derived from the prior access
 *    record instead of new stored state — `identityVerifiedAt` is exactly the
 *    fact "a verified application already existed".
 */

export const BETA_APPLICATION_RECEIVED_SUBJECT = 'Your Violema beta application is in';

export function buildBetaApplicationReceivedEmail(input: { email: string; name?: string }) {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi,';
  return {
    subject: BETA_APPLICATION_RECEIVED_SUBJECT,
    body: [
      greeting,
      '',
      `Your application for the Violema controlled beta is complete — your identity is verified for ${input.email} and there is nothing more you need to do.`,
      '',
      'What happens next:',
      '',
      '1. A human reviews every application. There is no automated approval.',
      '2. You will get an email at this address when you are approved.',
      '3. After approval, sign in at https://violema.com/login with the same account you applied with. If your browser fights the Google sign-in flow, use "Email me a sign-in link" on the same page.',
      '',
      'Until then, signing in will keep telling you the application is under review — that is expected, not an error.',
      '',
      'If you did not apply for Violema, you can ignore this email.',
      '',
      '— Violema',
    ].join('\n'),
  };
}

export interface PriorAccessEvidence {
  identityVerifiedAt?: string;
}

/**
 * True only at the moment a signup attempt turns into a complete, approvable
 * application: signup intent, current terms accepted at the provider redirect,
 * and no previously verified application on file.
 */
export function shouldSendBetaApplicationReceivedEmail(input: {
  intent: string;
  acceptedTerms: boolean;
  priorAccess: PriorAccessEvidence | null | undefined;
}): boolean {
  if (input.intent !== 'signup') return false;
  if (!input.acceptedTerms) return false;
  return !input.priorAccess?.identityVerifiedAt?.trim();
}
