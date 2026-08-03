// Two-pass application honesty contract.
//
// Field observation, 2026-08-02 (tenant-journey run note, break #7): the
// signup OAuth bounce that actually COMPLETES an application rendered as a
// red `?error=` failure, and the email form's "recorded but not approved"
// response did too. Applicants — including the founder — could not tell
// whether anything had happened.
//
// Pinned here:
//   1. resolveSignupNotice: `applied` beats `error`, addresses are sanity
//      checked, blank errors collapse to none (behavioural).
//   2. The backend redirects an evidence-bearing signup bounce to
//      /signup?applied=1 and sends the one-shot confirmation email
//      (cross-tree composition).
//   3. Signup.tsx renders the shared applied/recorded copy and routes the
//      email-form `access_not_approved` code away from the red path
//      (render composition).

import { readFileSync } from 'node:fs';
import {
  APPLICATION_RECEIVED_TITLE,
  EMAIL_FORM_RECORDED_TITLE,
  resolveSignupNotice,
} from '../src/lib/signupApplication.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 1. Behaviour -----------------------------------------------------------

const applied = resolveSignupNotice('?applied=1&email=founder%40example.com&next=%2Fdashboard');
assert(applied.kind === 'applied', 'applied=1 must resolve to the applied outcome');
assert(applied.email === 'founder@example.com', 'the applicant email must survive the round-trip');

const appliedOverError = resolveSignupNotice('?applied=1&error=Something+broke');
assert(
  appliedOverError.kind === 'applied',
  'a stale error parameter must never repaint a received application as a failure',
);

const junkEmail = resolveSignupNotice('?applied=1&email=not-an-email');
assert(junkEmail.kind === 'applied' && junkEmail.email === null, 'a junk email renders the generic applied panel');

const error = resolveSignupNotice('?error=Sign-in+failed');
assert(error.kind === 'error' && error.message === 'Sign-in failed', 'error text must pass through trimmed');

assert(resolveSignupNotice('?error=+++').kind === 'none', 'blank errors collapse to none');
assert(resolveSignupNotice('').kind === 'none', 'no params, no notice');

// --- 2. Backend composition ---------------------------------------------------

const serverSource = readFileSync(
  new URL('../../backend/src/server.ts', import.meta.url),
  'utf8',
);
assert(
  serverSource.includes("applied: '1'"),
  'the OAuth callback must redirect an evidence-bearing signup bounce with applied=1',
);
assert(
  serverSource.includes('buildBetaApplicationReceivedEmail'),
  'the signup bounce must send the application-received confirmation email',
);
assert(
  serverSource.includes('shouldSendBetaApplicationReceivedEmail'),
  'the confirmation email must be gated on first identity verification, not sent per attempt',
);

// --- 3. Render composition ----------------------------------------------------

const signupSource = readFileSync(
  new URL('../src/pages/Signup.tsx', import.meta.url),
  'utf8',
);
assert(
  signupSource.includes('resolveSignupNotice('),
  'Signup must resolve the notice through the shared module, not ad-hoc query reads',
);
for (const pinned of [
  'APPLICATION_RECEIVED_TITLE',
  'APPLICATION_RECEIVED_STEPS',
  'APPLICATION_PENDING_NOTE',
  'EMAIL_FORM_RECORDED_TITLE',
  'EMAIL_FORM_RECORDED_BODY',
]) {
  assert(signupSource.includes(pinned), `Signup must render the shared ${pinned} copy`);
}
assert(
  signupSource.includes("error.code === 'access_not_approved'"),
  'the email-form recorded outcome must route on the machine-readable code, not message text',
);
assert(
  APPLICATION_RECEIVED_TITLE === 'Application received' &&
    EMAIL_FORM_RECORDED_TITLE.includes('one step left'),
  'applicant copy must state receipt plainly and name the remaining step',
);

const authSource = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8');
assert(
  authSource.includes('class AuthSessionRequestError'),
  'persistAuthSessionToBackend must surface the backend code via AuthSessionRequestError',
);

console.log(
  'signupApplication.contract: application receipt is legible on both applicant paths, never a red error',
);
