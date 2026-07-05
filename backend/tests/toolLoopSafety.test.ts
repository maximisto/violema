import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildToolLoopCapMessage,
  parseToolResultPayload,
  readPositiveIntegerEnv,
} from '../src/toolLoopSafety';

test('tool result payload parsing preserves malformed tool output as raw text', () => {
  assert.deepEqual(parseToolResultPayload('{"ok":true,"count":2}'), { ok: true, count: 2 });
  assert.deepEqual(parseToolResultPayload('not json'), {
    raw: 'not json',
    parse_error: true,
  });
});

test('tool loop safety config sanitizes env values and builds capped message', () => {
  const original = process.env.MAX_TOOL_ITERATIONS;
  try {
    process.env.MAX_TOOL_ITERATIONS = '0';
    assert.equal(readPositiveIntegerEnv('MAX_TOOL_ITERATIONS', 24), 24);

    process.env.MAX_TOOL_ITERATIONS = '7.8';
    assert.equal(readPositiveIntegerEnv('MAX_TOOL_ITERATIONS', 24), 7);

    assert.match(buildToolLoopCapMessage(7), /7-step tool limit/);
  } finally {
    if (typeof original === 'string') process.env.MAX_TOOL_ITERATIONS = original;
    else delete process.env.MAX_TOOL_ITERATIONS;
  }
});
