/**
 * The tenant counterpart of the Slack review card.
 *
 * Field observation (2026-08-03): the Competitor monitor ran at 8:00 am,
 * parked a fully drafted memo at the review gate — and the founder found out
 * eight hours later, by accident. `postSlackReviewCard` returns early for
 * tenant workspaces (tenant review cards need Violema's own Slack app, a
 * separate build), so a tenant run entering `waiting_review` was announced
 * nowhere.
 *
 * This email is that announcement. It travels through Postmark from
 * hello@violema.com — Violema's own voice, never a customer connection — and
 * it deliberately contains NO draft content: the draft lives behind the
 * review gate, and an unapproved draft in an inbox reads like a delivery.
 */

export function buildReviewWaitingEmail(input: {
  missionName: string;
  ownerName?: string;
}) {
  const greeting = input.ownerName?.trim() ? `Hi ${input.ownerName.trim()},` : 'Hi,';
  return {
    subject: `${input.missionName} has a draft waiting for your review`,
    body: [
      greeting,
      '',
      `${input.missionName} just finished a run and prepared a draft. Nothing has been sent — it is holding for your approval.`,
      '',
      'Review it here: https://violema.com/dashboard — open the Reviews tab.',
      '',
      'Approve to deliver it as prepared, or request changes and it will redraft. If your browser fights the Google sign-in, use "Email me a sign-in link" on the login page.',
      '',
      '— Violema',
    ].join('\n'),
  };
}
