interface SendMessageInput {
  to: string;
  subject?: string;
  body: string;
  channel?: string;
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

function inferMessageChannel(input: SendMessageInput): 'slack' | 'email' | 'teams' {
  if (input.channel === 'slack' || input.channel === 'email' || input.channel === 'teams') {
    return input.channel;
  }

  if (input.to.includes('@') && !input.to.startsWith('@')) {
    return 'email';
  }

  return 'slack';
}

async function sendSlackMessage(input: SendMessageInput) {
  const token = getRequiredEnv('SLACK_BOT_TOKEN');
  const text = input.subject ? `${input.subject}\n\n${input.body}` : input.body;

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      channel: input.to,
      text,
      mrkdwn: true,
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
    to: input.to,
    status: 'delivered',
    sent_at: new Date().toISOString(),
    slack_channel: data.channel || input.to,
    slack_ts: data.ts || null,
  };
}

async function sendEmailMessage(input: SendMessageInput) {
  const apiKey = getRequiredEnv('SENDGRID_API_KEY');
  const fromEmail = getRequiredEnv('SENDGRID_FROM_EMAIL');

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: input.to }],
          subject: input.subject || 'Message from Nexus',
        },
      ],
      from: {
        email: fromEmail,
      },
      content: [
        {
          type: 'text/plain',
          value: input.body,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`SendGrid send failed: ${await parseErrorResponse(response)}`);
  }

  return {
    success: true,
    channel: 'email',
    to: input.to,
    subject: input.subject || 'Message from Nexus',
    status: 'delivered',
    sent_at: new Date().toISOString(),
    provider: 'sendgrid',
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
    sendgrid: Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL),
    slack: Boolean(process.env.SLACK_BOT_TOKEN),
  };
}
