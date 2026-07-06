import assert from 'node:assert/strict';
import Module = require('node:module');
import test from 'node:test';

type ModuleLoader = (request: string, parent: NodeModule | null, isMain: boolean) => unknown;
const moduleWithLoader = Module as unknown as { _load: ModuleLoader };

test('generateTextDetailed falls back to OpenAI after retryable Anthropic failure', async () => {
  const originalLoad = moduleWithLoader._load;
  const originalFetch = global.fetch;
  const originalEnv = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    fallbackApiKeyEnv: process.env.MODEL_FALLBACK_API_KEY_ENV,
    fallbackBaseUrl: process.env.MODEL_FALLBACK_BASE_URL,
    fallbackModel: process.env.MODEL_DEFAULT_FALLBACK_MODEL,
    fallbackOpenRouterModel: process.env.MODEL_FALLBACK_OPENROUTER_MODEL,
    fallbackProvider: process.env.MODEL_DEFAULT_FALLBACK_PROVIDER,
    globalFallbackModel: process.env.MODEL_FALLBACK_MODEL,
    globalFallbackProvider: process.env.MODEL_FALLBACK_PROVIDER,
    modelRetryDelays: process.env.MODEL_RETRY_DELAYS_MS,
    openai: process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  let anthropicCalls = 0;
  let fetchCalls = 0;

  try {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MODEL_RETRY_DELAYS_MS = '0';
    delete process.env.MODEL_FALLBACK_API_KEY_ENV;
    delete process.env.MODEL_FALLBACK_BASE_URL;
    delete process.env.MODEL_FALLBACK_MODEL;
    delete process.env.MODEL_FALLBACK_OPENROUTER_MODEL;
    delete process.env.MODEL_FALLBACK_PROVIDER;
    delete process.env.MODEL_DEFAULT_FALLBACK_PROVIDER;
    delete process.env.MODEL_DEFAULT_FALLBACK_MODEL;
    delete process.env.OPENROUTER_API_KEY;

    moduleWithLoader._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
      if (request === '@anthropic-ai/sdk') {
        return {
          default: class FakeAnthropic {
            messages = {
              create: async () => {
                anthropicCalls += 1;
                throw new TypeError('Invalid response body while trying to fetch https://api.anthropic.com/v1/messages: Premature close');
              },
            };
          },
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    global.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      fetchCalls += 1;
      assert.equal(String(input), 'https://api.openai.com/v1/chat/completions');
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string; messages?: Array<{ role: string; content: string }> };
      assert.equal(body.model, 'gpt-4.1-mini');
      assert.equal(body.messages?.[0]?.role, 'system');
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Fallback founder brief' } }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    };

    delete require.cache[require.resolve('../src/models')];
    const { generateTextDetailed } = require('../src/models') as typeof import('../src/models');
    const result = await generateTextDetailed(
      'default',
      'Write a concise founder brief.',
      [{ role: 'user', content: 'Summarize the run.' }],
      300,
      'test-workspace',
    );

    assert.equal(result.text, 'Fallback founder brief');
    assert.equal(result.usage?.totalTokens, 18);
    assert.equal(anthropicCalls, 2);
    assert.equal(fetchCalls, 1);
  } finally {
    moduleWithLoader._load = originalLoad;
    global.fetch = originalFetch;
    if (typeof originalEnv.anthropic === 'string') process.env.ANTHROPIC_API_KEY = originalEnv.anthropic;
    else delete process.env.ANTHROPIC_API_KEY;
    if (typeof originalEnv.openai === 'string') process.env.OPENAI_API_KEY = originalEnv.openai;
    else delete process.env.OPENAI_API_KEY;
    if (typeof originalEnv.modelRetryDelays === 'string') process.env.MODEL_RETRY_DELAYS_MS = originalEnv.modelRetryDelays;
    else delete process.env.MODEL_RETRY_DELAYS_MS;
    if (typeof originalEnv.fallbackProvider === 'string') process.env.MODEL_DEFAULT_FALLBACK_PROVIDER = originalEnv.fallbackProvider;
    else delete process.env.MODEL_DEFAULT_FALLBACK_PROVIDER;
    if (typeof originalEnv.fallbackModel === 'string') process.env.MODEL_DEFAULT_FALLBACK_MODEL = originalEnv.fallbackModel;
    else delete process.env.MODEL_DEFAULT_FALLBACK_MODEL;
    if (typeof originalEnv.globalFallbackProvider === 'string') process.env.MODEL_FALLBACK_PROVIDER = originalEnv.globalFallbackProvider;
    else delete process.env.MODEL_FALLBACK_PROVIDER;
    if (typeof originalEnv.globalFallbackModel === 'string') process.env.MODEL_FALLBACK_MODEL = originalEnv.globalFallbackModel;
    else delete process.env.MODEL_FALLBACK_MODEL;
    if (typeof originalEnv.fallbackBaseUrl === 'string') process.env.MODEL_FALLBACK_BASE_URL = originalEnv.fallbackBaseUrl;
    else delete process.env.MODEL_FALLBACK_BASE_URL;
    if (typeof originalEnv.fallbackApiKeyEnv === 'string') process.env.MODEL_FALLBACK_API_KEY_ENV = originalEnv.fallbackApiKeyEnv;
    else delete process.env.MODEL_FALLBACK_API_KEY_ENV;
    if (typeof originalEnv.fallbackOpenRouterModel === 'string') process.env.MODEL_FALLBACK_OPENROUTER_MODEL = originalEnv.fallbackOpenRouterModel;
    else delete process.env.MODEL_FALLBACK_OPENROUTER_MODEL;
    if (typeof originalEnv.openrouter === 'string') process.env.OPENROUTER_API_KEY = originalEnv.openrouter;
    else delete process.env.OPENROUTER_API_KEY;
    delete require.cache[require.resolve('../src/models')];
  }
});

test('generateTextDetailed keeps walking backup route chain when the first fallback fails', async () => {
  const originalLoad = moduleWithLoader._load;
  const originalFetch = global.fetch;
  const originalEnv = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    fallbackApiKeyEnv: process.env.MODEL_FALLBACK_API_KEY_ENV,
    fallbackBaseUrl: process.env.MODEL_FALLBACK_BASE_URL,
    fallbackModel: process.env.MODEL_DEFAULT_FALLBACK_MODEL,
    fallbackOpenRouterModel: process.env.MODEL_FALLBACK_OPENROUTER_MODEL,
    fallbackProvider: process.env.MODEL_DEFAULT_FALLBACK_PROVIDER,
    globalFallbackModel: process.env.MODEL_FALLBACK_MODEL,
    globalFallbackProvider: process.env.MODEL_FALLBACK_PROVIDER,
    modelRetryDelays: process.env.MODEL_RETRY_DELAYS_MS,
    openai: process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  let anthropicCalls = 0;
  let openaiCalls = 0;
  let openrouterCalls = 0;

  try {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.MODEL_RETRY_DELAYS_MS = '0';
    delete process.env.MODEL_FALLBACK_API_KEY_ENV;
    delete process.env.MODEL_FALLBACK_BASE_URL;
    delete process.env.MODEL_FALLBACK_MODEL;
    delete process.env.MODEL_FALLBACK_OPENROUTER_MODEL;
    delete process.env.MODEL_FALLBACK_PROVIDER;
    delete process.env.MODEL_DEFAULT_FALLBACK_PROVIDER;
    delete process.env.MODEL_DEFAULT_FALLBACK_MODEL;

    moduleWithLoader._load = function patchedLoad(request: string, parent: NodeModule | null, isMain: boolean) {
      if (request === '@anthropic-ai/sdk') {
        return {
          default: class FakeAnthropic {
            messages = {
              create: async () => {
                anthropicCalls += 1;
                throw new TypeError('Invalid response body while trying to fetch https://api.anthropic.com/v1/messages: Premature close');
              },
            };
          },
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    global.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string };
      if (url === 'https://api.openai.com/v1/chat/completions') {
        openaiCalls += 1;
        assert.equal(body.model, 'gpt-4.1-mini');
        return new Response(JSON.stringify({ error: { message: 'OpenAI temporarily unavailable' } }), {
          headers: { 'content-type': 'application/json' },
          status: 503,
        });
      }
      if (url === 'https://openrouter.ai/api/v1/chat/completions') {
        openrouterCalls += 1;
        assert.equal(body.model, 'z-ai/glm-5.2');
        return new Response(JSON.stringify({
          choices: [{ message: { content: 'GLM fallback founder brief' } }],
          usage: { prompt_tokens: 13, completion_tokens: 8, total_tokens: 21 },
        }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        });
      }
      throw new Error(`Unexpected fallback URL: ${url}`);
    };

    delete require.cache[require.resolve('../src/models')];
    const { generateTextDetailed } = require('../src/models') as typeof import('../src/models');
    const result = await generateTextDetailed(
      'default',
      'Write a concise founder brief.',
      [{ role: 'user', content: 'Summarize the run.' }],
      300,
      'test-workspace',
    );

    assert.equal(result.text, 'GLM fallback founder brief');
    assert.equal(result.usage?.totalTokens, 21);
    assert.equal(anthropicCalls, 2);
    assert.equal(openaiCalls, 2);
    assert.equal(openrouterCalls, 1);
  } finally {
    moduleWithLoader._load = originalLoad;
    global.fetch = originalFetch;
    if (typeof originalEnv.anthropic === 'string') process.env.ANTHROPIC_API_KEY = originalEnv.anthropic;
    else delete process.env.ANTHROPIC_API_KEY;
    if (typeof originalEnv.openai === 'string') process.env.OPENAI_API_KEY = originalEnv.openai;
    else delete process.env.OPENAI_API_KEY;
    if (typeof originalEnv.openrouter === 'string') process.env.OPENROUTER_API_KEY = originalEnv.openrouter;
    else delete process.env.OPENROUTER_API_KEY;
    if (typeof originalEnv.modelRetryDelays === 'string') process.env.MODEL_RETRY_DELAYS_MS = originalEnv.modelRetryDelays;
    else delete process.env.MODEL_RETRY_DELAYS_MS;
    if (typeof originalEnv.fallbackProvider === 'string') process.env.MODEL_DEFAULT_FALLBACK_PROVIDER = originalEnv.fallbackProvider;
    else delete process.env.MODEL_DEFAULT_FALLBACK_PROVIDER;
    if (typeof originalEnv.fallbackModel === 'string') process.env.MODEL_DEFAULT_FALLBACK_MODEL = originalEnv.fallbackModel;
    else delete process.env.MODEL_DEFAULT_FALLBACK_MODEL;
    if (typeof originalEnv.globalFallbackProvider === 'string') process.env.MODEL_FALLBACK_PROVIDER = originalEnv.globalFallbackProvider;
    else delete process.env.MODEL_FALLBACK_PROVIDER;
    if (typeof originalEnv.globalFallbackModel === 'string') process.env.MODEL_FALLBACK_MODEL = originalEnv.globalFallbackModel;
    else delete process.env.MODEL_FALLBACK_MODEL;
    if (typeof originalEnv.fallbackBaseUrl === 'string') process.env.MODEL_FALLBACK_BASE_URL = originalEnv.fallbackBaseUrl;
    else delete process.env.MODEL_FALLBACK_BASE_URL;
    if (typeof originalEnv.fallbackApiKeyEnv === 'string') process.env.MODEL_FALLBACK_API_KEY_ENV = originalEnv.fallbackApiKeyEnv;
    else delete process.env.MODEL_FALLBACK_API_KEY_ENV;
    if (typeof originalEnv.fallbackOpenRouterModel === 'string') process.env.MODEL_FALLBACK_OPENROUTER_MODEL = originalEnv.fallbackOpenRouterModel;
    else delete process.env.MODEL_FALLBACK_OPENROUTER_MODEL;
    delete require.cache[require.resolve('../src/models')];
  }
});
