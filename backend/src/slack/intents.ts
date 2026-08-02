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
  | { kind: 'run'; missionQuery: string };

const STATUS_PATTERN = /^(?:status|what(?:'|’)?s\s+running|what\s+is\s+running|what(?:'|’)?s\s+the\s+status)\b/i;
const REVIEWS_PATTERN = /^(?:reviews?|approvals?|pending\s+approvals?|what\s+needs\s+(?:approval|approving|review)|anything\s+to\s+approve)\b/i;
const HELP_PATTERN = /^(?:help|commands?|what\s+can\s+you\s+do|how\s+do\s+i\s+use\s+you)\b/i;
const RUN_PATTERN = /^(?:run|start|trigger|kick\s+off)\s+(.+)$/i;

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
    .replace(/\s+(?:now|please)$/i, '')
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
