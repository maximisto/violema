interface SendMessageInput {
  to: string;
  subject?: string;
  body: string;
  channel?: string;
  threadTs?: string;
}

type MessageChannel = 'slack' | 'email' | 'teams';

interface ValidatedMessageTarget {
  channel: MessageChannel;
  target: string;
  normalizedTarget: string;
}

interface SlackConversation {
  id?: string;
  name?: string;
  name_normalized?: string;
}

interface SlackConversationListResponse {
  ok?: boolean;
  error?: string;
  needed?: string;
  channels?: SlackConversation[];
  response_metadata?: {
    next_cursor?: string;
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function parseErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `HTTP ${response.status}`;

  try {
    const data = JSON.parse(text) as {
      error?: string;
      detail?: string;
      errors?: Array<{ message?: string }>;
    };

    if (data.error) return data.error;
    if (data.detail) return data.detail;
    if (data.errors?.length) {
      return data.errors.map((item) => item.message).filter(Boolean).join('; ');
    }
  } catch {
    return text;
  }

  return text;
}

export async function searchWeb(query: string, numResults = 5) {
  const apiKey = getRequiredEnv('TAVILY_API_KEY');
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      topic: 'general',
      include_answer: false,
      include_raw_content: false,
      include_favicon: true,
      max_results: Math.min(Math.max(numResults || 5, 1), 10),
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${await parseErrorResponse(response)}`);
  }

  const data = await response.json() as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
      favicon?: string;
    }>;
    response_time?: string;
  };

  const results = (data.results || []).map((item) => ({
    title: item.title || 'Untitled result',
    url: item.url || '',
    snippet: item.content || '',
    score: item.score ?? null,
    favicon: item.favicon || null,
  }));

  return {
    query,
    results,
    total_results: results.length,
    search_time_ms: data.response_time ? Math.round(Number(data.response_time) * 1000) : null,
    provider: 'tavily',
  };
}

function inferMessageChannel(input: SendMessageInput): MessageChannel {
  if (input.channel === 'slack' || input.channel === 'email' || input.channel === 'teams') {
    return input.channel;
  }

  if (input.to.includes('@') && !input.to.startsWith('@')) {
    return 'email';
  }

  return 'slack';
}

function isSlackChannelId(value: string) {
  return /^[CGD][A-Z0-9]{8,}$/.test(value);
}

function isSlackUserId(value: string) {
  return /^U[A-Z0-9]{8,}$/.test(value);
}

function toSlackAliasEnvName(target: string) {
  const normalized = target
    .trim()
    .replace(/^#/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return normalized ? `SLACK_CHANNEL_${normalized}` : '';
}

function normalizeSlackChannelName(target: string) {
  return target.trim().replace(/^#/, '').toLowerCase();
}

function readSlackAliasMap() {
  const raw = process.env.SLACK_CHANNEL_ALIASES?.trim();
  if (!raw) return {} as Record<string, string>;

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
        .map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
        .filter(([, value]) => Boolean(value)),
    );
  } catch {
    return {};
  }
}

async function findSlackChannelIdByName(target: string) {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  const targetName = normalizeSlackChannelName(target);
  if (!token || !targetName) return null;

  let cursor = '';
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      types: 'public_channel,private_channel',
      exclude_archived: 'true',
      limit: '200',
    });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json().catch(() => null) as SlackConversationListResponse | null;

    if (!response.ok || !payload?.ok) {
      if (payload?.error === 'missing_scope') {
        const needed = payload.needed ? ` Missing scope: ${payload.needed}.` : '';
        throw new Error(`Slack channel names need channels:read/groups:read access, or use a channel ID like C0123456789.${needed}`);
      }
      return null;
    }

    const match = (payload.channels || []).find((channel) => {
      const names = [channel.name, channel.name_normalized].filter((name): name is string => Boolean(name));
      return names.some((name) => normalizeSlackChannelName(name) === targetName);
    });

    if (match?.id && isSlackChannelId(match.id)) {
      return match.id;
    }

    cursor = payload.response_metadata?.next_cursor || '';
    if (!cursor) break;
  }

  return null;
}

async function resolveSlackTarget(target: string) {
  const normalizedTarget = target.trim();
  if (!normalizedTarget) {
    throw new Error('Slack target is required.');
  }

  if (isSlackChannelId(normalizedTarget) || isSlackUserId(normalizedTarget)) {
    return normalizedTarget;
  }

  const aliasKey = normalizedTarget.startsWith('#') ? normalizedTarget.toLowerCase() : `#${normalizedTarget.toLowerCase()}`;
  const aliasMap = readSlackAliasMap();
  const mappedTarget = aliasMap[aliasKey];
  if (mappedTarget && (isSlackChannelId(mappedTarget) || isSlackUserId(mappedTarget))) {
    return mappedTarget;
  }

  const aliasEnv = process.env[toSlackAliasEnvName(aliasKey)];
  if (aliasEnv && (isSlackChannelId(aliasEnv.trim()) || isSlackUserId(aliasEnv.trim()))) {
    return aliasEnv.trim();
  }

  const resolvedChannelId = await findSlackChannelIdByName(normalizedTarget);
  if (resolvedChannelId) {
    return resolvedChannelId;
  }

  throw new Error(
    `Slack target "${normalizedTarget}" is not visible to Violema. Use a visible channel name like #project-nexus, a channel ID like C0123456789, or invite the Violema Slack app to private channels. ` +
    `Admins can also set ${toSlackAliasEnvName(aliasKey)} or SLACK_CHANNEL_ALIASES.`,
  );
}

export async function validateMessageTarget(input: { to: string; channel?: string }) {
  const channel = inferMessageChannel({ ...input, body: '' });
  const target = input.to.trim();

  if (!target) {
    throw new Error('Message target is required.');
  }

  if (channel === 'email') {
    if (!target.includes('@')) {
      throw new Error('Email target must be a valid email address.');
    }

    return {
      channel,
      target,
      normalizedTarget: target.toLowerCase(),
    } satisfies ValidatedMessageTarget;
  }

  if (channel === 'slack') {
    return {
      channel,
      target,
      normalizedTarget: await resolveSlackTarget(target),
    } satisfies ValidatedMessageTarget;
  }

  return {
    channel,
    target,
    normalizedTarget: target,
  } satisfies ValidatedMessageTarget;
}

async function sendSlackMessage(input: SendMessageInput) {
  const token = getRequiredEnv('SLACK_BOT_TOKEN');
  const text = input.subject ? `${input.subject}\n\n${input.body}` : input.body;
  const validated = await validateMessageTarget({ to: input.to, channel: 'slack' });

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: validated.normalizedTarget,
      text,
      mrkdwn: true,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    }),
  });

  const data = await response.json() as {
    ok?: boolean;
    error?: string;
    ts?: string;
    channel?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(`Slack send failed: ${data.error || response.statusText}`);
  }

  return {
    success: true,
    channel: 'slack',
    to: validated.target,
    status: 'delivered',
    sent_at: new Date().toISOString(),
    slack_channel: data.channel || validated.normalizedTarget,
    slack_ts: data.ts || null,
  };
}

async function sendEmailMessage(input: SendMessageInput) {
  const apiKey = getRequiredEnv('POSTMARK_API_KEY');
  const fromEmail = getRequiredEnv('POSTMARK_FROM_EMAIL');

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': apiKey,
    },
    body: JSON.stringify({
      From: fromEmail,
      To: input.to,
      Subject: input.subject || 'Message from Violema',
      TextBody: input.body,
    }),
  });

  if (!response.ok) {
    throw new Error(`Postmark send failed: ${await parseErrorResponse(response)}`);
  }

  return {
    success: true,
    channel: 'email',
    to: input.to,
    subject: input.subject || 'Message from Violema',
    status: 'delivered',
    sent_at: new Date().toISOString(),
    provider: 'postmark',
  };
}

export async function sendMessage(input: SendMessageInput) {
  const channel = inferMessageChannel(input);

  if (channel === 'slack') {
    return sendSlackMessage({ ...input, channel });
  }

  if (channel === 'email') {
    return sendEmailMessage({ ...input, channel });
  }

  throw new Error('Microsoft Teams is not configured in this demo yet.');
}

export function getIntegrationStatus() {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    postmark: Boolean(process.env.POSTMARK_API_KEY && process.env.POSTMARK_FROM_EMAIL),
    slack: Boolean(process.env.SLACK_BOT_TOKEN),
  };
}
