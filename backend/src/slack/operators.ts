// Slack member id → Violema operating authority.
//
// Phase A scope: the internal workspace only. A Slack identity is not a Violema
// session, so it cannot inherit dashboard permissions — it is granted
// explicitly, by member id, through SLACK_OPERATOR_USER_IDS.
//
// The list is read at call time rather than module load so adding an operator is
// a config change rather than a redeploy, and so tests can set it per case.
//
// Fails CLOSED: an unset or empty list means nobody can operate from Slack.
// Reading status stays open to the workspace; executing does not.

export const SLACK_OPERATOR_ENV_VAR = 'SLACK_OPERATOR_USER_IDS';

export const SLACK_READ_ONLY_NOTICE =
  'I can show status, reviews, and what is scheduled. Operating Violema from Slack — running missions, approving, requesting changes — is enabled for workspace operators.';

export function parseSlackOperatorIds(raw: string | undefined | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

export function isSlackOperator(
  slackUserId: string | undefined | null,
  raw: string | undefined | null = process.env[SLACK_OPERATOR_ENV_VAR],
): boolean {
  const id = typeof slackUserId === 'string' ? slackUserId.trim().toUpperCase() : '';
  if (!id) return false;
  return parseSlackOperatorIds(raw).includes(id);
}
