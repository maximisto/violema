import assert from 'node:assert/strict';
import test from 'node:test';
import { isRetryableModelError, withModelRetry } from '../src/models';

test('withModelRetry retries transient model failures and returns the eventual result', async () => {
  const originalDelays = process.env.MODEL_RETRY_DELAYS_MS;
  const originalWarn = console.warn;
  process.env.MODEL_RETRY_DELAYS_MS = '0,0,0';
  let attempts = 0;

  try {
    console.warn = () => {};
    const result = await withModelRetry('test model call', async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('rate limited') as Error & { status?: number };
        error.status = 429;
        throw error;
      }
      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(attempts, 3);
  } finally {
    console.warn = originalWarn;
    process.env.MODEL_RETRY_DELAYS_MS = originalDelays;
  }
});

test('withModelRetry does not retry non-transient model failures', async () => {
  const originalDelays = process.env.MODEL_RETRY_DELAYS_MS;
  process.env.MODEL_RETRY_DELAYS_MS = '0,0,0';
  let attempts = 0;

  try {
    await assert.rejects(
      () => withModelRetry('test model call', async () => {
        attempts += 1;
        const error = new Error('bad request') as Error & { status?: number };
        error.status = 400;
        throw error;
      }),
      /bad request/,
    );

    assert.equal(attempts, 1);
    assert.equal(isRetryableModelError({ status: 500 }), true);
    assert.equal(isRetryableModelError({ status: 400 }), false);
  } finally {
    process.env.MODEL_RETRY_DELAYS_MS = originalDelays;
  }
});
