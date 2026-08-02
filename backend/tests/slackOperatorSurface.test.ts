import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  SLACK_SIGNATURE_MAX_AGE_SECONDS,
  signSlackRequest,
  verifySlackRequestSignature,
} from '../src/slack/signature';
import {
  SLACK_READ_ONLY_NOTICE,
  isSlackOperator,
  parseSlackOperatorIds,
} from '../src/slack/operators';
import { matchAutomationByName, parseSlackOperatorIntent } from '../src/slack/intents';
import {
  SLACK_CHANGE_REQUEST_TTL_MS,
  clearPendingChangeRequests,
  consumePendingChangeRequest,
  registerPendingChangeRequest,
} from '../src/slack/pendingChangeRequests';
import {
  SLACK_APPROVE_ACTION_ID,
  SLACK_REQUEST_CHANGES_ACTION_ID,
  buildReviewActionValue,
  buildReviewRequestBlocks,
  buildReviewResolvedBlocks,
  parseReviewActionValue,
} from '../src/slack/reviewCard';

const SECRET = 'test-signing-secret';

function sign(body: string, timestamp: string, secret = SECRET) {
  return signSlackRequest({ rawBody: body, timestamp, signingSecret: secret });
}

test('slack signature verification accepts a correctly signed, fresh request', () => {
  const body = '{"type":"event_callback"}';
  const timestamp = '1700000000';
  assert.doesNotThrow(() => verifySlackRequestSignature({
    rawBody: Buffer.from(body, 'utf8'),
    signature: sign(body, timestamp),
    timestamp,
    signingSecret: SECRET,
    now: () => 1700000000 * 1000,
  }));
});

test('slack signature verification rejects a forged signature', () => {
  const body = '{"type":"event_callback"}';
  const timestamp = '1700000000';
  const forged = `v0=${crypto.randomBytes(32).toString('hex')}`;
  assert.throws(
    () => verifySlackRequestSignature({
      rawBody: body,
      signature: forged,
      timestamp,
      signingSecret: SECRET,
      now: () => 1700000000 * 1000,
    }),
    /Invalid Slack signature/,
  );
});

test('slack signature verification rejects a body tampered after signing', () => {
  const timestamp = '1700000000';
  const signature = sign('{"type":"event_callback"}', timestamp);
  assert.throws(
    () => verifySlackRequestSignature({
      rawBody: '{"type":"event_callback","injected":true}',
      signature,
      timestamp,
      signingSecret: SECRET,
      now: () => 1700000000 * 1000,
    }),
    /Invalid Slack signature/,
  );
});

test('slack signature verification rejects a stale timestamp beyond the replay window', () => {
  const body = '{"type":"event_callback"}';
  const timestamp = '1700000000';
  const signature = sign(body, timestamp);
  const staleNow = (1700000000 + SLACK_SIGNATURE_MAX_AGE_SECONDS + 1) * 1000;
  assert.throws(
    () => verifySlackRequestSignature({
      rawBody: body,
      signature,
      timestamp,
      signingSecret: SECRET,
      now: () => staleNow,
    }),
    /too old/,
  );
});

test('slack signature verification rejects a non-numeric timestamp and a missing secret', () => {
  assert.throws(
    () => verifySlackRequestSignature({
      rawBody: '{}',
      signature: 'v0=abc',
      timestamp: 'not-a-number',
      signingSecret: SECRET,
    }),
    /timestamp/i,
  );
  assert.throws(
    () => verifySlackRequestSignature({
      rawBody: '{}',
      signature: 'v0=abc',
      timestamp: '1700000000',
      signingSecret: '   ',
      now: () => 1700000000 * 1000,
    }),
    /SLACK_SIGNING_SECRET/,
  );
});

test('slack operator ids parse from a comma separated env value', () => {
  assert.deepEqual(parseSlackOperatorIds(' U123 , U456,,u789 '), ['U123', 'U456', 'U789']);
  assert.deepEqual(parseSlackOperatorIds(undefined), []);
  assert.deepEqual(parseSlackOperatorIds('   '), []);
});

test('slack operator authorization fails closed when no operators are configured', () => {
  assert.equal(isSlackOperator('U123', ''), false);
  assert.equal(isSlackOperator('U123', undefined), false);
  assert.equal(isSlackOperator(undefined, 'U123'), false);
  assert.equal(isSlackOperator('U123', 'U123,U456'), true);
  assert.equal(isSlackOperator('u123', 'U123'), true, 'slack member ids compare case-insensitively');
  assert.equal(isSlackOperator('U999', 'U123,U456'), false);
  assert.match(SLACK_READ_ONLY_NOTICE, /workspace operators/);
});

test('deterministic intent parsing recognises the four operating verbs', () => {
  assert.deepEqual(parseSlackOperatorIntent('status'), { kind: 'status' });
  assert.deepEqual(parseSlackOperatorIntent("  What's running?  "), { kind: 'status' });
  assert.deepEqual(parseSlackOperatorIntent('what is running'), { kind: 'status' });
  assert.deepEqual(parseSlackOperatorIntent('reviews'), { kind: 'reviews' });
  assert.deepEqual(parseSlackOperatorIntent('what needs approval?'), { kind: 'reviews' });
  assert.deepEqual(parseSlackOperatorIntent('help'), { kind: 'help' });
  assert.deepEqual(parseSlackOperatorIntent('what can you do'), { kind: 'help' });
  assert.deepEqual(parseSlackOperatorIntent('run Founder Update'), {
    kind: 'run',
    missionQuery: 'Founder Update',
  });
  assert.deepEqual(parseSlackOperatorIntent('run the founder update.'), {
    kind: 'run',
    missionQuery: 'founder update',
  });
});

test('deterministic intent parsing falls through for conversational prompts', () => {
  assert.equal(parseSlackOperatorIntent('what do you think about our pricing?'), null);
  assert.equal(parseSlackOperatorIntent('run'), null, 'run with no mission name is not an action');
  assert.equal(parseSlackOperatorIntent(''), null);
  assert.equal(
    parseSlackOperatorIntent('summarize the status of the market'),
    null,
    'status must anchor at the start, not match mid-sentence',
  );
});

test('mission fuzzy matching prefers exact, then prefix, then contains', () => {
  const automations = [
    { id: 'a1', name: 'Founder Update' },
    { id: 'a2', name: 'Founder Update Weekly' },
    { id: 'a3', name: 'Competitor Watch' },
  ];

  assert.deepEqual(matchAutomationByName('founder update', automations), {
    kind: 'match',
    automation: automations[0],
  });
  assert.deepEqual(matchAutomationByName('competitor', automations), {
    kind: 'match',
    automation: automations[2],
  });
  assert.deepEqual(matchAutomationByName('watch', automations), {
    kind: 'match',
    automation: automations[2],
  });
});

test('mission fuzzy matching reports ambiguity instead of guessing', () => {
  const automations = [
    { id: 'a1', name: 'Founder Update Monday' },
    { id: 'a2', name: 'Founder Update Friday' },
  ];
  const result = matchAutomationByName('founder update', automations);
  assert.equal(result.kind, 'ambiguous');
  assert.deepEqual(
    result.kind === 'ambiguous' ? result.options.map((item) => item.id) : [],
    ['a1', 'a2'],
  );
});

test('mission fuzzy matching returns none when nothing resembles the query', () => {
  assert.deepEqual(matchAutomationByName('payroll', [{ id: 'a1', name: 'Founder Update' }]), {
    kind: 'none',
  });
  assert.deepEqual(matchAutomationByName('   ', [{ id: 'a1', name: 'Founder Update' }]), {
    kind: 'none',
  });
});

test('pending change requests are consumable once and expire honestly', () => {
  clearPendingChangeRequests();
  const base = Date.parse('2026-08-01T10:00:00.000Z');
  const entry = {
    automationId: 'auto_1',
    runId: 'run_1',
    workspaceId: 'ws_1',
    channel: 'C123',
    threadTs: '111.222',
    reviewMessageTs: '111.222',
    requestedBySlackUserId: 'U123',
  };

  registerPendingChangeRequest(entry, () => base);
  const first = consumePendingChangeRequest({ channel: 'C123', threadTs: '111.222' }, () => base + 1000);
  assert.equal(first?.runId, 'run_1');
  assert.equal(
    consumePendingChangeRequest({ channel: 'C123', threadTs: '111.222' }, () => base + 2000),
    null,
    'a consumed request cannot be replayed',
  );

  registerPendingChangeRequest(entry, () => base);
  assert.equal(
    consumePendingChangeRequest(
      { channel: 'C123', threadTs: '111.222' },
      () => base + SLACK_CHANGE_REQUEST_TTL_MS + 1,
    ),
    null,
    'an expired request is dropped rather than silently applied',
  );
  assert.equal(
    consumePendingChangeRequest({ channel: 'C123', threadTs: '111.222' }, () => base),
    null,
    'expiry also evicts the entry',
  );
  clearPendingChangeRequests();
});

test('pending change requests are scoped to their own thread', () => {
  clearPendingChangeRequests();
  const now = () => Date.parse('2026-08-01T10:00:00.000Z');
  registerPendingChangeRequest({
    automationId: 'auto_1',
    runId: 'run_1',
    workspaceId: 'ws_1',
    channel: 'C123',
    threadTs: '111.222',
    reviewMessageTs: '111.222',
    requestedBySlackUserId: 'U123',
  }, now);

  assert.equal(consumePendingChangeRequest({ channel: 'C123', threadTs: '333.444' }, now), null);
  assert.equal(consumePendingChangeRequest({ channel: 'C999', threadTs: '111.222' }, now), null);
  assert.equal(consumePendingChangeRequest({ channel: 'C123', threadTs: '111.222' }, now)?.runId, 'run_1');
  clearPendingChangeRequests();
});

test('review request blocks carry both operator actions with a routable value', () => {
  const blocks = buildReviewRequestBlocks({
    missionName: 'Founder Update',
    deliveryTarget: '#violema-demo',
    summary: 'Weekly founder update is drafted and waiting.',
    automationId: 'auto_1',
    runId: 'run_1',
    workspaceId: 'ws_1',
  });

  const actions = blocks.find((block) => block.type === 'actions');
  assert.ok(actions && actions.type === 'actions', 'the card must expose an actions block');
  assert.deepEqual(actions.elements.map((element) => element.action_id), [
    SLACK_APPROVE_ACTION_ID,
    SLACK_REQUEST_CHANGES_ACTION_ID,
  ]);
  assert.ok(actions.elements[0].confirm, 'approving sends for real, so it must confirm first');

  const parsed = parseReviewActionValue(actions.elements[0].value);
  assert.deepEqual(parsed, { automationId: 'auto_1', runId: 'run_1', workspaceId: 'ws_1' });
});

test('review action values round-trip and reject malformed input', () => {
  const value = buildReviewActionValue({ automationId: 'a', runId: 'r', workspaceId: 'w' });
  assert.deepEqual(parseReviewActionValue(value), { automationId: 'a', runId: 'r', workspaceId: 'w' });
  assert.equal(parseReviewActionValue('not json'), null);
  assert.equal(parseReviewActionValue(JSON.stringify({ a: 'x' })), null);
  assert.equal(parseReviewActionValue(undefined), null);
});

test('resolved review blocks drop the buttons and name the actor and time', () => {
  const blocks = buildReviewResolvedBlocks({
    missionName: 'Founder Update',
    outcome: 'approved',
    detail: 'Delivered to #violema-demo.',
    actorLabel: '<@U123>',
    resolvedAt: '2026-08-01T10:00:00.000Z',
  });

  assert.equal(blocks.some((block) => block.type === 'actions'), false, 'buttons must not survive an outcome');
  const rendered = JSON.stringify(blocks);
  assert.match(rendered, /Founder Update/);
  assert.match(rendered, /<@U123>/);
  assert.match(rendered, /Delivered to #violema-demo/);
});
