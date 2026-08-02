// Slack request signing, isolated from the HTTP layer so it can be tested
// without standing up the server.
//
// This is the only thing standing between a public URL and an endpoint that can
// approve and send real deliveries. Slack signs `v0:<timestamp>:<raw body>` with
// the app's signing secret; we recompute it over the EXACT bytes received (never
// a re-serialized body, which would silently drift) and compare in constant
// time. Requests older than the replay window are refused even when the
// signature is valid.
//
// https://api.slack.com/authentication/verifying-requests-from-slack

import crypto from 'crypto';

export const SLACK_SIGNATURE_MAX_AGE_SECONDS = 60 * 5;

export interface SlackSignatureInput {
  rawBody: Buffer | string;
  signature: string;
  timestamp: string;
  signingSecret: string;
  /** Epoch milliseconds. Injectable so replay-window tests are deterministic. */
  now?: () => number;
}

function computeDigest(input: { rawBody: Buffer | string; timestamp: string; signingSecret: string }) {
  const body = typeof input.rawBody === 'string' ? input.rawBody : input.rawBody.toString('utf8');
  const base = `v0:${input.timestamp}:${body}`;
  return `v0=${crypto.createHmac('sha256', input.signingSecret).update(base).digest('hex')}`;
}

/** Test/helper counterpart to `verifySlackRequestSignature`; never used in the request path. */
export function signSlackRequest(input: {
  rawBody: Buffer | string;
  timestamp: string;
  signingSecret: string;
}) {
  return computeDigest(input);
}

/** Throws with a specific reason when the request is not a fresh, authentic Slack call. */
export function verifySlackRequestSignature(input: SlackSignatureInput): void {
  const signingSecret = input.signingSecret?.trim();
  if (!signingSecret) {
    throw new Error('SLACK_SIGNING_SECRET is not configured, so Slack requests cannot be verified.');
  }

  const requestTime = Number(input.timestamp);
  if (!Number.isFinite(requestTime)) {
    throw new Error('Invalid Slack request timestamp');
  }

  const nowSeconds = Math.floor((input.now ? input.now() : Date.now()) / 1000);
  if (Math.abs(nowSeconds - requestTime) > SLACK_SIGNATURE_MAX_AGE_SECONDS) {
    throw new Error('Slack request timestamp is too old');
  }

  const expected = Buffer.from(computeDigest({ ...input, signingSecret }), 'utf8');
  const actual = Buffer.from(input.signature || '', 'utf8');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('Invalid Slack signature');
  }
}
