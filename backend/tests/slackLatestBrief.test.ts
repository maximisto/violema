import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchAutomationForBrief, parseSlackOperatorIntent } from '../src/slack/intents';
import {
  buildAmbiguousLatestReply,
  buildHelpReply,
  buildLatestBriefReply,
  buildNoBriefReply,
  findLatestBrief,
  findLatestBriefAcross,
  type OperatorConsoleData,
} from '../src/slack/operatorConsole';
import type { TaskRunRecord } from '../src/platform/types';

// The message that exposed the gap, verbatim minus the bot mention.
const FIELD_ASK = 'can you send me the last competitive review pls?';

test('the ask that fell to the chat path now parses as a deterministic read', () => {
  assert.deepEqual(parseSlackOperatorIntent(FIELD_ASK), {
    kind: 'latest',
    missionQuery: 'competitive review',
  });
  assert.deepEqual(parseSlackOperatorIntent('latest competitor monitor'), {
    kind: 'latest',
    missionQuery: 'competitor monitor',
  });
  assert.deepEqual(parseSlackOperatorIntent('Show us the most recent founder brief'), {
    kind: 'latest',
    missionQuery: 'founder brief',
  });
});

test('the latest verb does not swallow neighbours', () => {
  assert.deepEqual(parseSlackOperatorIntent('run competitor monitor'), {
    kind: 'run',
    missionQuery: 'competitor monitor',
  });
  assert.equal(parseSlackOperatorIntent('status')?.kind, 'status');
  // No latest/last marker → conversational path, untouched.
  assert.equal(parseSlackOperatorIntent('can you send me the report?'), null);
  // Mid-sentence mention is a question about something else, not a command.
  assert.equal(parseSlackOperatorIntent('what did the last competitive review say about pricing?'), null);
});

const MISSIONS = [
  { id: 'auto_competitor', name: 'Competitor monitor' },
  { id: 'auto_revenue', name: 'Revenue watch' },
];

test('loose matcher bridges output words to mission names, strict still wins', () => {
  const bridged = matchAutomationForBrief('competitive review', MISSIONS);
  assert.equal(bridged.kind, 'match');
  assert.equal((bridged as { automation: { id: string } }).automation.id, 'auto_competitor');

  const strict = matchAutomationForBrief('competitor monitor', MISSIONS);
  assert.equal(strict.kind, 'match');

  const revenue = matchAutomationForBrief('revenue', MISSIONS);
  assert.equal((revenue as { automation: { id: string } }).automation.id, 'auto_revenue');

  // All-generic ask: one mission → obvious; several → ask, never guess.
  assert.equal(matchAutomationForBrief('review', MISSIONS).kind, 'ambiguous');
  assert.equal(matchAutomationForBrief('review', [MISSIONS[0]]).kind, 'match');
  assert.equal(matchAutomationForBrief('quarterly newsletter', MISSIONS).kind, 'none');
});

function runFixture(input: {
  id: string;
  startedAt: string;
  automationId?: string;
  markdown?: string;
  delivered?: boolean;
}): TaskRunRecord {
  return {
    id: input.id,
    taskId: `task_${input.id}`,
    startedAt: input.startedAt,
    status: 'succeeded',
    metadata: {
      automationId: input.automationId || 'auto_competitor',
      ...(input.markdown
        ? {
            artifacts: [
              { kind: 'note', title: 'scratch', payload: {} },
              {
                kind: 'review_gate',
                title: 'Competitive brief',
                payload: { markdown: input.markdown, deliveryTarget: '#violema-demo', approvalRequired: true },
              },
            ],
          }
        : { artifacts: [{ kind: 'note', title: 'scratch', payload: {} }] }),
      ...(input.delivered ? { reviewReceipt: { status: 'delivered' } } : {}),
    },
  } as unknown as TaskRunRecord;
}

function consoleData(taskRuns: TaskRunRecord[]): OperatorConsoleData {
  return { automations: MISSIONS, tasks: [], taskRuns };
}

test('findLatestBrief returns the newest run that actually kept a brief', () => {
  const data = consoleData([
    runFixture({ id: 'r_old', startedAt: '2026-08-01T10:00:00.000Z', markdown: 'OLD BRIEF', delivered: true }),
    runFixture({ id: 'r_newest_no_brief', startedAt: '2026-08-03T09:00:00.000Z' }),
    runFixture({ id: 'r_new', startedAt: '2026-08-02T10:00:00.000Z', markdown: 'NEW BRIEF' }),
    runFixture({ id: 'r_other_mission', startedAt: '2026-08-03T11:00:00.000Z', automationId: 'auto_revenue', markdown: 'REVENUE' }),
  ]);

  const brief = findLatestBrief(data, 'auto_competitor');
  assert.ok(brief);
  assert.equal(brief?.run.id, 'r_new', 'artifact-less newer run must be skipped, other missions ignored');
  assert.equal(brief?.markdown, 'NEW BRIEF');
  assert.equal(brief?.delivered, false);
  assert.equal(brief?.deliveryTarget, '#violema-demo');

  assert.equal(findLatestBrief(consoleData([]), 'auto_competitor'), null);
});

test('same-name duplicates resolve by recency, never by an unanswerable question', () => {
  // The prod shape that produced "listed twice": platform seed + workspace
  // copy, both literally named "Competitor monitor".
  const DUPLICATES = [
    { id: 'auto_seed', name: 'Competitor monitor' },
    { id: 'auto_workspace', name: 'Competitor monitor' },
  ];

  const grouped = matchAutomationForBrief('competitive review', DUPLICATES);
  assert.equal(grouped.kind, 'ambiguous', 'the matcher itself still reports both');

  const data: OperatorConsoleData = {
    automations: DUPLICATES,
    tasks: [],
    taskRuns: [
      runFixture({ id: 'r_seed', startedAt: '2026-08-01T10:00:00.000Z', automationId: 'auto_seed', markdown: 'SEED BRIEF' }),
      runFixture({ id: 'r_ws', startedAt: '2026-08-02T10:00:00.000Z', automationId: 'auto_workspace', markdown: 'WORKSPACE BRIEF' }),
    ],
  };
  const across = findLatestBriefAcross(data, ['auto_seed', 'auto_workspace']);
  assert.equal(across?.markdown, 'WORKSPACE BRIEF', 'newest brief across the group wins');
  assert.equal(across?.run.id, 'r_ws');

  // If the prompt ever renders for a mixed set, identical names collapse.
  const mixed = buildAmbiguousLatestReply('review', [...DUPLICATES, { id: 'auto_rev', name: 'Revenue watch' }]);
  assert.equal((mixed.match(/`latest Competitor monitor`/g) || []).length, 1, 'no duplicate suggestion lines');
  assert.ok(mixed.includes('matches 2 missions'), 'the count reflects answerable choices, not raw rows');
});

test('replies state provenance and never dress a repost as a fresh delivery', () => {
  const data = consoleData([
    runFixture({ id: 'r1', startedAt: '2026-08-02T10:00:00.000Z', markdown: 'BODY', delivered: true }),
  ]);
  const brief = findLatestBrief(data, 'auto_competitor');
  assert.ok(brief);

  const reply = buildLatestBriefReply(MISSIONS[0], brief!);
  assert.ok(reply.includes('Latest from Competitor monitor'));
  assert.ok(reply.includes('approved and delivered to #violema-demo'));
  assert.ok(reply.includes('BODY'));

  const undelivered = buildLatestBriefReply(MISSIONS[0], { ...brief!, delivered: false });
  assert.ok(undelivered.includes('not yet approved for delivery'));

  const empty = buildNoBriefReply(MISSIONS[0]);
  assert.ok(empty.includes('no stored brief yet'));
  assert.ok(empty.includes('`run Competitor monitor`'), 'the empty case must name the next step');

  const ambiguous = buildAmbiguousLatestReply('review', MISSIONS);
  assert.ok(ambiguous.includes('`latest Competitor monitor`'));
  assert.ok(ambiguous.includes('`latest Revenue watch`'));

  assert.ok(buildHelpReply(true).includes('`latest <mission name>`'), 'help must advertise the verb');
});
