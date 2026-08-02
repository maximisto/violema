// Injectable Slack Web API transport for the internal operating surface.
//
// `integrations.ts` owns DELIVERY sends — the tenant-aware path that routes a
// customer's workflow output through their own Slack connection. This is a
// different job: control-plane messages posted by OUR bot into OUR workspace
// (the review card, and the chat.update that closes it). Routing those through
// the tenant path would be wrong in both directions, so they are separate.
//
// The interface exists so tests can assert on what would be sent without a bot
// token and without a live call. `resolveSlackOperatorTransport` returns null
// when no token is configured, which callers treat as "Slack is not wired up"
// rather than as an error — the dashboard remains the source of truth.

export interface SlackPostMessageInput {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
}

export interface SlackUpdateMessageInput {
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}

export interface SlackApiResult {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export interface SlackApiTransport {
  postMessage(input: SlackPostMessageInput): Promise<SlackApiResult>;
  updateMessage(input: SlackUpdateMessageInput): Promise<SlackApiResult>;
}

async function callSlack(
  token: string,
  method: 'chat.postMessage' | 'chat.update',
  body: Record<string, unknown>,
): Promise<SlackApiResult> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json() as SlackApiResult;
  if (!response.ok || !data.ok) {
    return { ok: false, error: data.error || response.statusText };
  }
  return data;
}

export function createSlackBotTransport(token: string): SlackApiTransport {
  return {
    postMessage: (input) => callSlack(token, 'chat.postMessage', {
      channel: input.channel,
      text: input.text,
      ...(input.blocks ? { blocks: input.blocks, unfurl_links: false, unfurl_media: false } : {}),
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    }),
    updateMessage: (input) => callSlack(token, 'chat.update', {
      channel: input.channel,
      ts: input.ts,
      text: input.text,
      ...(input.blocks ? { blocks: input.blocks } : {}),
    }),
  };
}

let transportOverride: SlackApiTransport | null = null;

/** Test hook. Passing null restores the real, token-backed transport. */
export function setSlackOperatorTransport(transport: SlackApiTransport | null) {
  transportOverride = transport;
}

export function resolveSlackOperatorTransport(): SlackApiTransport | null {
  if (transportOverride) return transportOverride;
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return null;
  return createSlackBotTransport(token);
}
