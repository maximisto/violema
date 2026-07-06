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
    fallbackModel: process.env.MODEL_DEFAULT_FALLBACK_MODEL,
    fallbackProvider: process.env.MODEL_DEFAULT_FALLBACK_PROVIDER,
    modelRetryDelays: process.env.MODEL_RETRY_DELAYS_MS,
    openai: process.env.OPENAI_API_KEY,
  };
  let anthropicCalls = 0;
  let fetchCalls = 0;

  try {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MODEL_RETRY_DELAYS_MS = '0';
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
    delete require.cache[require.resolve('../src/models')];
  }
});
