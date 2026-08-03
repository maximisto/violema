// Deterministic intent routing for the Slack operating surface.
//
// These four verbs are the operating contract, so they must NEVER depend on a
// model call: an operator typing "run founder update" gets the same behavior
// every time, and a model outage degrades Violema-on-Slack to a chat bot rather
// than to a bot that silently stops executing. Anything that does not match
// falls through to the existing conversational reply path unchanged.
//
// Patterns anchor at the START of the message. "Summarize the status of the
// market" is a question about the market, not a status request.

export type SlackOperatorIntent =
  | { kind: 'status' }
  | { kind: 'reviews' }
  | { kind: 'help' }
  | { kind: 'run'; missionQuery: string }
  | { kind: 'latest'; missionQuery: string };

const STATUS_PATTERN = /^(?:status|what(?:'|’)?s\s+running|what\s+is\s+running|what(?:'|’)?s\s+the\s+status)\b/i;
const REVIEWS_PATTERN = /^(?:reviews?|approvals?|pending\s+approvals?|what\s+needs\s+(?:approval|approving|review)|anything\s+to\s+approve)\b/i;
const HELP_PATTERN = /^(?:help|commands?|what\s+can\s+you\s+do|how\s+do\s+i\s+use\s+you)\b/i;
const RUN_PATTERN = /^(?:run|start|trigger|kick\s+off)\s+(.+)$/i;
// Born from the first real ask this surface fumbled: "can you send me the last
// competitive review pls?" fell to the chat path, which has no run history and
// answered like a stranger. Courtesy framing ("can you", "please") is part of
// the pattern because operators type it; the anchor still holds — a send-verb
// plus a latest/last marker is required, so ordinary questions pass through.
const LATEST_PATTERN = /^(?:(?:hey|hi)[\s,]+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+|pls\s+)?(?:send|show|share|give|post|resend|get|pull\s+up)(?:\s+(?:me|us))?\s+(?:the\s+)?(?:latest|last|most\s+recent|newest)\s+(.+)$/i;
const LATEST_BARE_PATTERN = /^(?:latest|last|most\s+recent|newest)\s+(.+)$/i;

function normalizeMessage(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/** Strips the framing operators actually type: "run the X", trailing punctuation, wrapping quotes. */
function normalizeMissionQuery(raw: string) {
  return raw
    .trim()
    .replace(/^(?:the|my|our)\s+/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/(?:\s+(?:now|please|pls))+$/i, '')
    .trim();
}

export function parseSlackOperatorIntent(text: string): SlackOperatorIntent | null {
  const message = normalizeMessage(text);
  if (!message) return null;

  // Ordered by specificity. `run` is last because it is the only verb that
  // consumes an argument, and an argument-less "run" is not an instruction.
  if (HELP_PATTERN.test(message)) return { kind: 'help' };
  if (STATUS_PATTERN.test(message)) return { kind: 'status' };
  if (REVIEWS_PATTERN.test(message)) return { kind: 'reviews' };

  const latestMatch = message.match(LATEST_PATTERN) || message.match(LATEST_BARE_PATTERN);
  if (latestMatch) {
    const missionQuery = normalizeMissionQuery(latestMatch[1]);
    if (missionQuery) return { kind: 'latest', missionQuery };
  }

  const runMatch = message.match(RUN_PATTERN);
  if (runMatch) {
    const missionQuery = normalizeMissionQuery(runMatch[1]);
    if (missionQuery) return { kind: 'run', missionQuery };
  }

  return null;
}

export type AutomationNameMatch<T> =
  | { kind: 'match'; automation: T }
  | { kind: 'ambiguous'; options: T[] }
  | { kind: 'none' };

function normalizeName(value: string) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a typed mission name against the workspace's automations.
 *
 * Tiers are evaluated strictly in order — exact, then prefix, then contains —
 * and the FIRST tier with any hit decides. A tier with more than one hit is
 * ambiguous and performs no action: running the wrong mission is worse than
 * asking which one.
 */
export function matchAutomationByName<T extends { name: string }>(
  query: string,
  automations: readonly T[],
): AutomationNameMatch<T> {
  const needle = normalizeName(query);
  if (!needle) return { kind: 'none' };

  const candidates = automations.map((automation) => ({
    automation,
    name: normalizeName(automation.name),
  }));

  const tiers = [
    candidates.filter((item) => item.name === needle),
    candidates.filter((item) => item.name.startsWith(needle)),
    candidates.filter((item) => item.name.includes(needle)),
  ];

  for (const tier of tiers) {
    if (tier.length === 1) return { kind: 'match', automation: tier[0].automation };
    if (tier.length > 1) return { kind: 'ambiguous', options: tier.map((item) => item.automation) };
  }

  return { kind: 'none' };
}

/**
 * Words that describe the OUTPUT, not the mission. "The last competitive
 * review" names the Competitor monitor's brief, not a mission called
 * "review" — these carry no identity, so they never count toward a match.
 */
const GENERIC_BRIEF_TOKENS = new Set([
  'review', 'reviews', 'brief', 'briefs', 'report', 'reports',
  'update', 'updates', 'summary', 'summaries', 'analysis', 'one',
]);

/** "competitive" and "competitor" share a root; full-token equality misses it. */
function tokenRoot(token: string) {
  return token.length > 6 ? token.slice(0, 6) : token;
}

/**
 * Looser resolution for READ requests about a mission's output.
 *
 * Strict tiers run first — an exact name always wins. The fallback scores
 * shared token roots so "competitive review" reaches "Competitor monitor".
 * This looseness is deliberately NOT shared with `run`: showing the wrong
 * brief costs a correction, running the wrong mission costs credits and can
 * queue a real delivery.
 */
export function matchAutomationForBrief<T extends { name: string }>(
  query: string,
  automations: readonly T[],
): AutomationNameMatch<T> {
  const strict = matchAutomationByName(query, automations);
  if (strict.kind !== 'none') return strict;

  const needleTokens = normalizeName(query)
    .split(' ')
    .filter((token) => token && !GENERIC_BRIEF_TOKENS.has(token));

  // An all-generic ask ("the last review") names no mission. With exactly one
  // mission there is nothing to confuse; with more, asking is the only honest
  // answer.
  if (needleTokens.length === 0) {
    if (automations.length === 1) return { kind: 'match', automation: automations[0] };
    if (automations.length > 1) return { kind: 'ambiguous', options: [...automations] };
    return { kind: 'none' };
  }

  const scored = automations
    .map((automation) => {
      const nameRoots = new Set(normalizeName(automation.name).split(' ').map(tokenRoot));
      const score = needleTokens.filter((token) => nameRoots.has(tokenRoot(token))).length;
      return { automation, score };
    })
    .filter((item) => item.score > 0);

  if (scored.length === 0) return { kind: 'none' };

  const top = Math.max(...scored.map((item) => item.score));
  const best = scored.filter((item) => item.score === top);
  if (best.length === 1) return { kind: 'match', automation: best[0].automation };
  return { kind: 'ambiguous', options: best.map((item) => item.automation) };
}
