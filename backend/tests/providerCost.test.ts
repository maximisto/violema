import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateProviderCostUsdForUsage } from '../src/platform/cost';

test('estimateProviderCostUsdForUsage prices OpenRouter GLM 5.2 from input and output tokens', () => {
  const cost = estimateProviderCostUsdForUsage('default', {
    provider: 'openrouter',
    model: 'z-ai/glm-5.2',
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    totalTokens: 2_000_000,
  });

  assert.equal(cost, 3.7646);
});
