// Email sign-in link contract.
//
// Why this gate exists: Safari can strand the Google account chooser when
// several Google accounts are signed in -- the chooser renders, an account is
// picked, and the OAuth flow never returns. The email link is the way back in,
// so it has to be a peer of the provider buttons rather than a fallback someone
// has to go looking for. And because the endpoint deliberately answers
// identically for a real account, a revoked one, and an address that never
// existed, the UI is the last place that defence can be undone.
//
// Four things are pinned:
//   1. The option EXISTS on the login surface and renders through the same
//      component as Google and Microsoft (equal weight, structurally).
//   2. The confirmation is generic and reveals nothing (behavioural -- run
//      against the real mapper, for every status a browser can see).
//   3. A resend cooldown exists and matches the server's.
//   4. The copy says who the link is for, and never promises what it cannot do.

import { readFileSync } from 'node:fs';
import {
  isValidMagicLinkEmail,
  resolveMagicLinkFeedback,
  MAGIC_LINK_ELIGIBILITY_NOTE,
  MAGIC_LINK_GENERIC_CONFIRMATION,
  MAGIC_LINK_RESEND_COOLDOWN_SECONDS,
  MAGIC_LINK_THROTTLED_MESSAGE,
} from '../src/lib/magicLink.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const login = read('../src/pages/Login.tsx');
const providerButton = read('../src/components/AuthProviderButton.tsx');
const authLib = read('../src/lib/auth.ts');

// --- 1. The option exists, and is a peer of the OAuth buttons ---------------

assert(
  login.includes('provider="email"'),
  'the login surface offers an email sign-in option',
);
assert(
  /<AuthProviderButton[\s\S]{0,400}provider="email"/.test(login),
  'the email option renders through AuthProviderButton -- the same component, and therefore the same visual weight, as the OAuth buttons',
);
assert(
  providerButton.includes("'google' | 'microsoft' | 'email'"),
  'AuthProviderButton accepts email as a first-class kind rather than special-casing it',
);
assert(
  /email:\s*\{[\s\S]{0,600}?label:\s*'Email me a sign-in link'/.test(providerButton),
  'the email card carries the "Email me a sign-in link" label',
);

// Equal weight is structural, not a claim: all three cards must sit in ONE
// container, with no divider between the providers and the email option. A
// divider above it is exactly how this degrades into a hidden fallback.
const primaryGroup = login.split('Continue with</p>')[1]?.split('Admin direct access')[0] || '';
assert(primaryGroup.length > 0, 'the login surface has a primary "Continue with" group');
const providerCardIndex = primaryGroup.indexOf('PROVIDER_METHODS.map');
const emailCardIndex = primaryGroup.indexOf('provider="email"');
assert(providerCardIndex > -1, 'the OAuth cards render inside the primary group');
assert(emailCardIndex > -1, 'the email card renders inside the same primary group');
assert(
  providerCardIndex < emailCardIndex,
  'the email option follows the providers inside one group, rather than living in a separate section',
);
assert(
  !/Or use email/.test(login),
  'the old "or use email" demotion is gone -- the email link is not an afterthought',
);

// The email card must not borrow a provider's identity. It re-authenticates an
// account Google or Microsoft already verified; dressing it as a third vendor
// would misstate what it proves.
assert(
  /email:\s*\{[\s\S]{0,600}?halo:\s*'from-violet/.test(providerButton),
  'the email card uses Violema violet, not a borrowed vendor brand',
);
assert(
  /email:\s*'Works in any browser'/.test(providerButton),
  'the email card names its actual advantage: it works in any browser',
);

// --- 2. The confirmation never reveals account existence --------------------

// One message for every status a browser can observe. A distinguishable error
// is an enumeration oracle, so failures collapse into the same sentence.
const observableStatuses = [0, 200, 201, 301, 400, 401, 403, 404, 409, 500, 502, 503, 504];
const messages = new Set(
  observableStatuses.map((status) => resolveMagicLinkFeedback({ status }).message),
);
assert(
  messages.size === 1,
  `every non-throttle status yields one identical message (got ${messages.size}: ${[...messages].join(' | ')})`,
);
assert(
  [...messages][0] === MAGIC_LINK_GENERIC_CONFIRMATION,
  'and that message is the generic confirmation',
);
assert(
  observableStatuses.every((status) => resolveMagicLinkFeedback({ status }).kind === 'sent'),
  'no status is reported to the visitor as a failure',
);

// A 429 is about the caller's network, not any account, so it may differ --
// but it still must not describe an account.
const throttled = resolveMagicLinkFeedback({ status: 429 });
assert(throttled.kind === 'throttled', 'a rate-limited request is reported as a throttle');
assert(throttled.message === MAGIC_LINK_THROTTLED_MESSAGE, 'with the shared throttle message');

// The server's own wording wins when it sends one, so the two repos cannot
// drift.
assert(
  resolveMagicLinkFeedback({ status: 200, message: 'Server copy wins.' }).message === 'Server copy wins.',
  'a server-supplied message is preferred over the local default',
);
assert(
  resolveMagicLinkFeedback({ status: 200, message: '   ' }).message === MAGIC_LINK_GENERIC_CONFIRMATION,
  'a blank server message falls back to the generic confirmation rather than an empty state',
);

// Nothing anywhere in this feature may name an account state.
const forbidden = /no account|not found|unknown (?:user|email|address)|does not exist|never registered|already registered|account exists|not approved|revoked|awaiting approval/i;
for (const [label, source] of [
  ['the generic confirmation', MAGIC_LINK_GENERIC_CONFIRMATION],
  ['the throttle message', MAGIC_LINK_THROTTLED_MESSAGE],
  ['the eligibility note', MAGIC_LINK_ELIGIBILITY_NOTE],
]) {
  assert(!forbidden.test(source), `${label} does not disclose whether an account exists`);
}

// The confirmation is conditional by construction -- "if that address has".
assert(
  /^if that address has/i.test(MAGIC_LINK_GENERIC_CONFIRMATION),
  'the confirmation is phrased conditionally, so it asserts nothing about the address',
);

// --- 3. The client cannot leak what the mapper hides ------------------------

assert(
  authLib.includes("fetch('/api/auth/magic-link/request'"),
  'the request goes to the magic-link endpoint',
);
assert(
  /catch\s*\{\s*return resolveMagicLinkFeedback\(\{ status: 0 \}\);/.test(authLib),
  'a thrown fetch resolves to the same generic feedback instead of a distinguishable error',
);
assert(
  /return resolveMagicLinkFeedback\(\{ status: response\.status/.test(authLib),
  'every response is funnelled through the one mapper rather than branched on inline',
);

const requestHelper = authLib.split('export async function requestMagicLinkSignIn')[1]
  ?.split('export function beginOAuthFlow')[0] || '';
assert(requestHelper.length > 0, 'the request helper exists in lib/auth');
assert(
  !/throw new Error/.test(requestHelper),
  'the request helper never throws -- a rejected promise is itself a signal',
);
// A magic-link REQUEST must not mint or mutate a local session; the session
// arrives later as the HttpOnly cookie from the consume redirect.
assert(
  !/saveAuthSession|localStorage/.test(requestHelper),
  'asking for a link stores no session -- only the consume redirect can authenticate',
);

// --- 4. Resend cooldown -----------------------------------------------------

assert(
  MAGIC_LINK_RESEND_COOLDOWN_SECONDS === 60,
  `the cooldown matches the backend's MAGIC_LINK_RESEND_COOLDOWN_MS (got ${MAGIC_LINK_RESEND_COOLDOWN_SECONDS}s)`,
);
assert(
  login.includes('MAGIC_LINK_RESEND_COOLDOWN_SECONDS'),
  'the login surface uses the shared cooldown rather than a second hardcoded number',
);
assert(
  /Resend in \$\{cooldownSeconds\}s/.test(login),
  'the cooldown counts down in the resend control, so the wait is visible',
);
assert(
  /disabled=\{cooldownSeconds > 0/.test(login),
  'the resend control is actually disabled during the cooldown',
);
assert(
  /if \(cooldownTimer\.current\) clearInterval\(cooldownTimer\.current\);/.test(login),
  'the cooldown timer is cleared on unmount and on restart, so it cannot leak',
);

// --- 5. Copy: honest about what this is and who it is for -------------------

assert(
  login.includes('MAGIC_LINK_ELIGIBILITY_NOTE'),
  'the surface explains who the link works for',
);
assert(
  /already approved/i.test(MAGIC_LINK_ELIGIBILITY_NOTE),
  'the note says the link is for accounts that are already approved',
);
assert(
  /Google or Microsoft/i.test(MAGIC_LINK_ELIGIBILITY_NOTE),
  'and that approval itself still runs through a verified provider -- the link never replaces identity verification',
);
assert(
  login.includes('Check your inbox'),
  'the confirmation state tells the visitor where to look',
);
assert(
  /expires in 10 minutes and works once/.test(login),
  'the surface states the link is short-lived and single-use, matching the token it describes',
);
// The email link is re-authentication. It must never be sold as a way in for
// someone who does not have an account yet.
assert(
  !/sign up|create (?:an )?account|get started free/i.test(
    `${MAGIC_LINK_ELIGIBILITY_NOTE} ${MAGIC_LINK_GENERIC_CONFIRMATION}`,
  ),
  'the email link is never presented as a way to create an account',
);

// --- 6. Email validation is shared, not re-implemented ----------------------

assert(isValidMagicLinkEmail('founder@example.com'), 'a normal address is accepted');
assert(isValidMagicLinkEmail('  founder@example.com  '), 'surrounding whitespace is tolerated');
assert(!isValidMagicLinkEmail(''), 'an empty address is rejected');
assert(!isValidMagicLinkEmail('not-an-email'), 'a non-address is rejected');
assert(!isValidMagicLinkEmail('a@b'), 'an address with no TLD is rejected');
assert(!isValidMagicLinkEmail('a b@example.com'), 'an address with a space is rejected');
assert(
  login.includes('isValidMagicLinkEmail'),
  'the surface gates submission on the shared validator rather than its own regex',
);
assert(
  /disabled=\{!isValidMagicLinkEmail\(magicLinkEmail\) \|\| magicLinkSending\}/.test(login),
  'the send control is disabled until the address is plausible and while a send is in flight',
);

console.log(
  'magicLinkSignIn.contract: the email link is a peer of the OAuth buttons, every response collapses to one generic confirmation, and the cooldown and copy match the server',
);
