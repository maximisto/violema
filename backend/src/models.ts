import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { getWorkspaceProviderToken, getWorkspaceSettings } from './settingsStore';

type Provider = 'anthropic' | 'minimax' | 'openai' | 'openrouter' | 'mistral';
type CanonicalTextProfile = 'micro' | 'default' | 'hard' | 'critical' | 'ops';
type LegacyTextProfile = 'balanced' | 'frontier' | 'operations' | 'utility';
export type TextProfile = CanonicalTextProfile | LegacyTextProfile;
type CanonicalEmbeddingProfile = 'memory_text' | 'memory_code';
type LegacyEmbeddingProfile = 'memory';
type EmbeddingProfile = CanonicalEmbeddingProfile | LegacyEmbeddingProfile;

interface ModelRoute {
  provider: Provider;
  model: string;
  apiKeyEnv: string;
  baseUrl?: string;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
}

export interface RoutingDecision {
  profile: CanonicalTextProfile;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  needsTools: boolean;
}

export interface TextGenerationUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface TextGenerationResult {
  text: string;
  usage?: TextGenerationUsage;
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function resolveTextProfile(profile: TextProfile): CanonicalTextProfile {
  switch (profile) {
    case 'balanced':
      return 'default';
    case 'frontier':
      return 'critical';
    case 'operations':
      return 'ops';
    case 'utility':
      return 'micro';
    default:
      return profile;
  }
}

function resolveEmbeddingProfile(profile: EmbeddingProfile): CanonicalEmbeddingProfile {
  if (profile === 'memory') return 'memory_text';
  return profile;
}

function getTextRoute(profile: TextProfile, workspaceId?: string): ModelRoute {
  const resolvedProfile = resolveTextProfile(profile);
  const defaults: Record<CanonicalTextProfile, ModelRoute> = {
    micro: {
      provider: 'openai',
      model: 'gpt-5.4-nano',
      apiKeyEnv: 'OPENAI_API_KEY',
      baseUrl: env('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      reasoningEffort: 'minimal',
    },
    default: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      baseUrl: env('ANTHROPIC_BASE_URL'),
    },
    hard: {
      provider: 'openai',
      model: 'gpt-5.4',
      apiKeyEnv: 'OPENAI_API_KEY',
      baseUrl: env('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      reasoningEffort: 'medium',
    },
    critical: {
      provider: 'anthropic',
      model: 'claude-opus-4-1-20250805',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      baseUrl: env('ANTHROPIC_BASE_URL'),
    },
    ops: {
      provider: 'openrouter',
      model: 'minimax/minimax-m2.7',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrl: env('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
    },
  };

  const legacyOverrides: Partial<Record<LegacyTextProfile, Partial<ModelRoute>>> = {
    balanced: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    },
    frontier: {
      provider: 'anthropic',
      model: 'claude-opus-4-1-20250805',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
    },
    operations: {
      provider: 'openrouter',
      model: 'minimax/minimax-m2.7',
      apiKeyEnv: 'OPENROUTER_API_KEY',
    },
    utility: {
      provider: 'openai',
      model: 'gpt-5.4-nano',
      apiKeyEnv: 'OPENAI_API_KEY',
      baseUrl: env('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      reasoningEffort: 'minimal',
    },
  };

  const prefix = `MODEL_${resolvedProfile.toUpperCase()}`;
  const route = {
    ...defaults[resolvedProfile],
    provider: (env(`${prefix}_PROVIDER`) as Provider | undefined) || defaults[resolvedProfile].provider,
    model: env(`${prefix}_MODEL`) || defaults[resolvedProfile].model,
    apiKeyEnv: env(`${prefix}_API_KEY_ENV`) || defaults[resolvedProfile].apiKeyEnv,
    baseUrl: env(`${prefix}_BASE_URL`) || defaults[resolvedProfile].baseUrl,
    reasoningEffort: (env(`${prefix}_REASONING_EFFORT`) as ModelRoute['reasoningEffort'] | undefined) || defaults[resolvedProfile].reasoningEffort,
  };

  if (profile === resolvedProfile) {
    const override = workspaceId ? getWorkspaceSettings(workspaceId)?.modelOverrides?.[resolvedProfile] : undefined;
    return {
      ...route,
      provider: override?.provider || route.provider,
      model: override?.model || route.model,
      baseUrl: override?.baseUrl || route.baseUrl,
      reasoningEffort: override?.reasoningEffort || route.reasoningEffort,
    };
  }

  const legacyPrefix = `MODEL_${profile.toUpperCase()}`;
  const legacyRoute = {
    ...route,
    ...legacyOverrides[profile as LegacyTextProfile],
    provider: (env(`${legacyPrefix}_PROVIDER`) as Provider | undefined) || route.provider,
    model: env(`${legacyPrefix}_MODEL`) || route.model,
    apiKeyEnv: env(`${legacyPrefix}_API_KEY_ENV`) || route.apiKeyEnv,
    baseUrl: env(`${legacyPrefix}_BASE_URL`) || route.baseUrl,
    reasoningEffort: (env(`${legacyPrefix}_REASONING_EFFORT`) as ModelRoute['reasoningEffort'] | undefined) || route.reasoningEffort,
  };
  const override = workspaceId ? getWorkspaceSettings(workspaceId)?.modelOverrides?.[resolvedProfile] : undefined;
  return {
    ...legacyRoute,
    provider: override?.provider || legacyRoute.provider,
    model: override?.model || legacyRoute.model,
    baseUrl: override?.baseUrl || legacyRoute.baseUrl,
    reasoningEffort: override?.reasoningEffort || legacyRoute.reasoningEffort,
  };
}

function getEmbeddingRoute(profile: EmbeddingProfile, workspaceId?: string): ModelRoute {
  const resolvedProfile = resolveEmbeddingProfile(profile);
  const defaults: Record<CanonicalEmbeddingProfile, ModelRoute> = {
    memory_text: {
      provider: 'mistral',
      model: env('MODEL_MEMORY_TEXT_MODEL') || env('MODEL_MEMORY_MODEL') || 'mistral-embed',
      apiKeyEnv: env('MODEL_MEMORY_TEXT_API_KEY_ENV') || env('MODEL_MEMORY_API_KEY_ENV') || 'MISTRAL_API_KEY',
      baseUrl: env('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1',
    },
    memory_code: {
      provider: 'mistral',
      model: env('MODEL_MEMORY_CODE_MODEL') || 'codestral-embed',
      apiKeyEnv: env('MODEL_MEMORY_CODE_API_KEY_ENV') || 'MISTRAL_API_KEY',
      baseUrl: env('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1',
    },
  };

  const prefix = `MODEL_${resolvedProfile.toUpperCase()}`;
  const route = {
    ...defaults[resolvedProfile],
    provider: (env(`${prefix}_PROVIDER`) as Provider | undefined) || defaults[resolvedProfile].provider,
    model: env(`${prefix}_MODEL`) || defaults[resolvedProfile].model,
    apiKeyEnv: env(`${prefix}_API_KEY_ENV`) || defaults[resolvedProfile].apiKeyEnv,
    baseUrl: env(`${prefix}_BASE_URL`) || defaults[resolvedProfile].baseUrl,
    reasoningEffort: (env(`${prefix}_REASONING_EFFORT`) as ModelRoute['reasoningEffort'] | undefined) || defaults[resolvedProfile].reasoningEffort,
  };
  const override = workspaceId ? getWorkspaceSettings(workspaceId)?.modelOverrides?.[resolvedProfile] : undefined;
  return {
    ...route,
    provider: override?.provider || route.provider,
    model: override?.model || route.model,
    baseUrl: override?.baseUrl || route.baseUrl,
    reasoningEffort: override?.reasoningEffort || route.reasoningEffort,
  };
}

function resolveProviderApiKey(route: ModelRoute, workspaceId?: string): string {
  const workspaceToken = workspaceId ? getWorkspaceProviderToken(workspaceId, route.provider) : undefined;
  if (workspaceToken) return workspaceToken;
  return requireEnv(route.apiKeyEnv);
}

function getAnthropicCompatibleClient(profile: TextProfile, workspaceId?: string) {
  const route = getTextRoute(profile, workspaceId);
  if (route.provider !== 'anthropic' && route.provider !== 'minimax') {
    throw new Error(`${profile} profile must use an Anthropic-compatible provider.`);
  }

  return {
    route,
    client: new Anthropic({
      apiKey: resolveProviderApiKey(route, workspaceId),
      baseURL: route.baseUrl,
    }),
  };
}

export function getChatModelConfig(profile: TextProfile = 'default', workspaceId?: string) {
  return getTextRoute(profile, workspaceId);
}

export function getUtilityModelConfig(workspaceId?: string) {
  return getTextRoute('micro', workspaceId);
}

export function getMicroModelConfig(workspaceId?: string) {
  return getTextRoute('micro', workspaceId);
}

export function getMemoryEmbeddingConfig(workspaceId?: string) {
  return getEmbeddingRoute('memory_text', workspaceId);
}

export function getCodeEmbeddingConfig(workspaceId?: string) {
  return getEmbeddingRoute('memory_code', workspaceId);
}

export function getModelRoutingStatus(workspaceId?: string) {
  const micro = getTextRoute('micro', workspaceId);
  const defaultRoute = getTextRoute('default', workspaceId);
  const hard = getTextRoute('hard', workspaceId);
  const critical = getTextRoute('critical', workspaceId);
  const ops = getTextRoute('ops', workspaceId);
  const memoryText = getEmbeddingRoute('memory_text', workspaceId);
  const memoryCode = getEmbeddingRoute('memory_code', workspaceId);

  return {
    micro: { provider: micro.provider, model: micro.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, micro.provider) || env(micro.apiKeyEnv) : env(micro.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(micro.provider) },
    default: { provider: defaultRoute.provider, model: defaultRoute.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, defaultRoute.provider) || env(defaultRoute.apiKeyEnv) : env(defaultRoute.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(defaultRoute.provider) },
    hard: { provider: hard.provider, model: hard.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, hard.provider) || env(hard.apiKeyEnv) : env(hard.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(hard.provider) },
    critical: { provider: critical.provider, model: critical.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, critical.provider) || env(critical.apiKeyEnv) : env(critical.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(critical.provider) },
    ops: { provider: ops.provider, model: ops.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, ops.provider) || env(ops.apiKeyEnv) : env(ops.apiKeyEnv)), tool_loop_compatible: isToolLoopCompatible(ops.provider) },
    memory_text: { provider: memoryText.provider, model: memoryText.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, memoryText.provider) || env(memoryText.apiKeyEnv) : env(memoryText.apiKeyEnv)), tool_loop_compatible: false },
    memory_code: { provider: memoryCode.provider, model: memoryCode.model, configured: Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, memoryCode.provider) || env(memoryCode.apiKeyEnv) : env(memoryCode.apiKeyEnv)), tool_loop_compatible: false },
  };
}

function isToolLoopCompatible(provider: Provider): boolean {
  return provider === 'anthropic' || provider === 'minimax' || provider === 'openrouter' || provider === 'openai';
}

function anthropicTextFromResponse(response: { content: Array<{ type: string; text?: string }> }): string {
  const parts = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean);
  return parts.join('\n\n').trim();
}

async function generateWithOpenAI(route: ModelRoute, system: string, messages: MessageParam[], maxTokens: number, workspaceId?: string): Promise<TextGenerationResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${resolveProviderApiKey(route, workspaceId)}`,
  };

  if (route.provider === 'openrouter') {
    headers['HTTP-Referer'] = env('OPENROUTER_SITE_URL') || 'https://violema.com';
    headers['X-Title'] = env('OPENROUTER_APP_NAME') || 'Violema';
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
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${data.error?.message || response.statusText}`);
  }

  return {
    text: data.choices?.[0]?.message?.content?.trim() || '',
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

async function generateWithAnthropicLike(profile: TextProfile, system: string, messages: MessageParam[], maxTokens: number, workspaceId?: string): Promise<TextGenerationResult> {
  const resolvedProfile = resolveTextProfile(profile);
  if (resolvedProfile !== 'default' && resolvedProfile !== 'critical' && resolvedProfile !== 'ops') {
    throw new Error(`Unsupported Anthropic-compatible profile: ${profile}`);
  }

  const { client, route } = getAnthropicCompatibleClient(profile, workspaceId);
  const response = await client.messages.create({
    model: route.model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  const usage = 'usage' in response && response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          (response.usage.input_tokens || 0) +
          (response.usage.output_tokens || 0),
      }
    : undefined;

  return {
    text: anthropicTextFromResponse(response),
    usage,
  };
}

export async function generateTextDetailed(profile: TextProfile, system: string, messages: MessageParam[], maxTokens: number, workspaceId?: string): Promise<TextGenerationResult> {
  const route = getTextRoute(profile, workspaceId);

  if (route.provider === 'openai' || route.provider === 'openrouter') {
    return generateWithOpenAI(route, system, messages, maxTokens, workspaceId);
  }

  if (route.provider === 'anthropic' || route.provider === 'minimax') {
    return generateWithAnthropicLike(profile, system, messages, maxTokens, workspaceId);
  }

  throw new Error(`Unsupported text provider for ${profile}: ${route.provider}`);
}

export async function generateText(profile: TextProfile, system: string, messages: MessageParam[], maxTokens: number, workspaceId?: string) {
  const result = await generateTextDetailed(profile, system, messages, maxTokens, workspaceId);
  return result.text;
}

export function getChatClient(profile: TextProfile = 'default', workspaceId?: string) {
  const requestedRoute = getTextRoute(profile, workspaceId);
  if (requestedRoute.provider === 'anthropic' || requestedRoute.provider === 'minimax') {
    const resolved = getAnthropicCompatibleClient(profile, workspaceId);
    return {
      ...resolved,
      requestedRoute,
      executingRoute: resolved.route,
      fallbackApplied: false,
    };
  }

  return {
    client: null,
    route: requestedRoute,
    requestedRoute,
    executingRoute: requestedRoute,
    fallbackApplied: false,
  };
}

function truncateForRouting(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function heuristicRoute(messages: Array<{ role: string; content: string }>): RoutingDecision {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => truncateForRouting(message.content))
    .join('\n\n');
  const text = userText.toLowerCase();

  const needsTools = /(search|latest|current|news|price|email|slack|screenshot|screen shot|browser|schedule|automation|report|github|jira|linear|hubspot|stripe|salesforce|ga4|google analytics|run code|write code|debug)/.test(text);
  const highRisk = /(legal|medical|financial|security|production|incident|outage|migration|contract|board|investor|customer-facing|root cause|architecture)/.test(text);
  const heavyOps = /(batch|bulk|pipeline|queue|throughput|monitor|cron|scheduler|automation|backfill|process thousands|large volume|operational)/.test(text);
  const complex = /(design|plan|strategy|compare|tradeoff|root cause|refactor|debug|implement|analyze|investigate|architecture|system prompt|multi-step)/.test(text) || userText.length > 1800;

  if (highRisk) {
    return { profile: 'critical', reason: 'high_risk_task', risk: 'high', needsTools };
  }

  if (heavyOps && needsTools) {
    return { profile: 'ops', reason: 'operational_workload', risk: 'medium', needsTools };
  }

  if (complex || (needsTools && userText.length > 600)) {
    return { profile: 'hard', reason: 'complex_multi_step_request', risk: 'medium', needsTools };
  }

  if (!needsTools && userText.length < 240) {
    return { profile: 'micro', reason: 'small_text_task', risk: 'low', needsTools: false };
  }

  return { profile: 'default', reason: needsTools ? 'tool_using_default' : 'general_default', risk: 'low', needsTools };
}

export async function routeChatProfile(messages: Array<{ role: string; content: string }>, workspaceId?: string): Promise<RoutingDecision> {
  const microRoute = getTextRoute('micro', workspaceId);
  const microConfigured = Boolean(workspaceId ? getWorkspaceProviderToken(workspaceId, microRoute.provider) || env(microRoute.apiKeyEnv) : env(microRoute.apiKeyEnv));
  const promptMessages = messages
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: truncateForRouting(message.content),
    }))
    .filter((message) => message.content);

  if (!microConfigured || promptMessages.length === 0) {
    return heuristicRoute(messages);
  }

  try {
    const response = await generateText(
      'micro',
      'Classify the task for routing. Return JSON only with keys: profile, reason, risk, needsTools. Valid profile values: micro, default, hard, critical, ops. Valid risk values: low, medium, high.',
      [{
        role: 'user',
        content: JSON.stringify({
          messages: promptMessages,
          instructions: 'Choose the cheapest model that can reliably complete the task. Use ops for long-running or operational workloads, critical for high-stakes work, hard for complex reasoning or coding, default for normal tool-using chat, micro for short low-risk text tasks.',
        }),
      }],
      120,
      workspaceId,
    );

    const parsed = JSON.parse(response) as Partial<RoutingDecision>;
    if (
      parsed.profile &&
      ['micro', 'default', 'hard', 'critical', 'ops'].includes(parsed.profile) &&
      parsed.reason &&
      parsed.risk &&
      ['low', 'medium', 'high'].includes(parsed.risk)
    ) {
      return {
        profile: parsed.profile as CanonicalTextProfile,
        reason: String(parsed.reason),
        risk: parsed.risk as RoutingDecision['risk'],
        needsTools: Boolean(parsed.needsTools),
      };
    }
  } catch {
    // Fall back to deterministic routing if the cheap router fails.
  }

  return heuristicRoute(messages);
}

export async function createMemoryEmbeddings(input: string | string[], workspaceId?: string) {
  const route = getEmbeddingRoute('memory', workspaceId);
  const response = await fetch(`${route.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolveProviderApiKey(route, workspaceId)}`,
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
