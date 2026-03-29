import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';

type Provider = 'anthropic' | 'minimax' | 'openai' | 'openrouter' | 'mistral';
type TextProfile = 'balanced' | 'frontier' | 'operations' | 'utility';
type EmbeddingProfile = 'memory';

interface ModelRoute {
  provider: Provider;
  model: string;
  apiKeyEnv: string;
  baseUrl?: string;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getTextRoute(profile: TextProfile): ModelRoute {
  const defaults: Record<TextProfile, ModelRoute> = {
    balanced: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      baseUrl: env('ANTHROPIC_BASE_URL'),
    },
    frontier: {
      provider: 'anthropic',
      model: 'claude-opus-4-1-20250805',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      baseUrl: env('ANTHROPIC_BASE_URL'),
    },
    operations: {
      provider: 'openrouter',
      model: 'minimax:minimax-2.7',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: env('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
    },
    utility: {
      provider: 'openai',
      model: 'gpt-5-mini',
      apiKeyEnv: 'OPENAI_API_KEY',
      baseUrl: env('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      reasoningEffort: 'minimal',
    },
  };

  const prefix = `MODEL_${profile.toUpperCase()}`;
  return {
    ...defaults[profile],
    provider: (env(`${prefix}_PROVIDER`) as Provider | undefined) || defaults[profile].provider,
    model: env(`${prefix}_MODEL`) || defaults[profile].model,
    apiKeyEnv: env(`${prefix}_API_KEY_ENV`) || defaults[profile].apiKeyEnv,
    baseUrl: env(`${prefix}_BASE_URL`) || defaults[profile].baseUrl,
    reasoningEffort: (env(`${prefix}_REASONING_EFFORT`) as ModelRoute['reasoningEffort'] | undefined) || defaults[profile].reasoningEffort,
  };
}

function getEmbeddingRoute(_profile: EmbeddingProfile): ModelRoute {
  return {
    provider: 'mistral',
    model: env('MODEL_MEMORY_MODEL') || 'mistral-embed',
    apiKeyEnv: env('MODEL_MEMORY_API_KEY_ENV') || 'MISTRAL_API_KEY',
    baseUrl: env('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1',
  };
}

function getAnthropicCompatibleClient(profile: 'balanced' | 'frontier' | 'operations') {
  const route = getTextRoute(profile);
  if (route.provider !== 'anthropic' && route.provider !== 'minimax') {
    throw new Error(`${profile} profile must use an Anthropic-compatible provider.`);
  }

  return {
    route,
    client: new Anthropic({
      apiKey: requireEnv(route.apiKeyEnv),
      baseURL: route.baseUrl,
    }),
  };
}

export function getChatModelConfig(profile: 'balanced' | 'frontier' | 'operations' = 'balanced') {
  return getTextRoute(profile);
}

export function getUtilityModelConfig() {
  return getTextRoute('utility');
}

export function getMemoryEmbeddingConfig() {
  return getEmbeddingRoute('memory');
}

export function getModelRoutingStatus() {
  const balanced = getTextRoute('balanced');
  const frontier = getTextRoute('frontier');
  const operations = getTextRoute('operations');
  const utility = getTextRoute('utility');
  const memory = getEmbeddingRoute('memory');

  return {
    balanced: { provider: balanced.provider, model: balanced.model, configured: Boolean(env(balanced.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(balanced.provider) },
    frontier: { provider: frontier.provider, model: frontier.model, configured: Boolean(env(frontier.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(frontier.provider) },
    operations: { provider: operations.provider, model: operations.model, configured: Boolean(env(operations.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(operations.provider) },
    utility: { provider: utility.provider, model: utility.model, configured: Boolean(env(utility.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(utility.provider) },
    memory: { provider: memory.provider, model: memory.model, configured: Boolean(env(memory.apiKeyEnv)), tool_loop_compatible: false },
  };
}

function isToolLoopCompatible(provider: Provider): boolean {
  return provider === 'anthropic' || provider === 'minimax';
}

function anthropicTextFromResponse(response: { content: Array<{ type: string; text?: string }> }): string {
  const parts = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean);
  return parts.join('\n\n').trim();
}

async function generateWithOpenAI(route: ModelRoute, system: string, messages: MessageParam[], maxTokens: number) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${requireEnv(route.apiKeyEnv)}`,
  };

  if (route.provider === 'openrouter') {
    headers['HTTP-Referer'] = env('OPENROUTER_SITE_URL') || 'https://nexus.purpleorange.io';
    headers['X-Title'] = env('OPENROUTER_APP_NAME') || 'Nexus';
  }

  const response = await fetch(`${route.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: route.model,
      max_completion_tokens: maxTokens,
      ...(route.reasoningEffort ? { reasoning_effort: route.reasoningEffort } : {}),
      messages: [
        { role: 'system', content: system },
        ...messages.map((message) => ({
          role: message.role,
          content: typeof message.content === 'string'
            ? message.content
            : message.content
                .map((item) => ('text' in item ? item.text : ''))
                .join('\n'),
        })),
      ],
    }),
  });

  const data = await response.json() as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${data.error?.message || response.statusText}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function generateWithAnthropicLike(profile: TextProfile, system: string, messages: MessageParam[], maxTokens: number) {
  if (profile !== 'balanced' && profile !== 'frontier' && profile !== 'operations') {
    throw new Error(`Unsupported Anthropic-compatible profile: ${profile}`);
  }

  const { client, route } = getAnthropicCompatibleClient(profile);
  const response = await client.messages.create({
    model: route.model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  return anthropicTextFromResponse(response);
}

export async function generateText(profile: TextProfile, system: string, messages: MessageParam[], maxTokens: number) {
  const route = getTextRoute(profile);

  if (route.provider === 'openai' || route.provider === 'openrouter') {
    return generateWithOpenAI(route, system, messages, maxTokens);
  }

  if (route.provider === 'anthropic' || route.provider === 'minimax') {
    return generateWithAnthropicLike(profile, system, messages, maxTokens);
  }

  throw new Error(`Unsupported text provider for ${profile}: ${route.provider}`);
}

export function getChatClient(profile: 'balanced' | 'frontier' | 'operations' = 'balanced') {
  const requestedRoute = getTextRoute(profile);
  if (isToolLoopCompatible(requestedRoute.provider)) {
    const resolved = getAnthropicCompatibleClient(profile);
    return {
      ...resolved,
      requestedRoute,
      executingRoute: resolved.route,
      fallbackApplied: false,
    };
  }

  const resolved = getAnthropicCompatibleClient('balanced');
  return {
    ...resolved,
    requestedRoute,
    executingRoute: resolved.route,
    fallbackApplied: true,
  };
}

export async function createMemoryEmbeddings(input: string | string[]) {
  const route = getEmbeddingRoute('memory');
  const response = await fetch(`${route.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv(route.apiKeyEnv)}`,
    },
    body: JSON.stringify({
      model: route.model,
      input,
    }),
  });

  const data = await response.json() as {
    data?: Array<{ embedding: number[]; index: number }>;
    model?: string;
    usage?: { total_tokens?: number };
    object?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(`Mistral embeddings request failed: ${data.message || response.statusText}`);
  }

  return data;
}
