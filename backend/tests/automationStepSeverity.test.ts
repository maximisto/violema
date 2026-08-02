/**
 * Run-outcome severity.
 *
 * The incident this locks down: a tenant's Competitor monitor read the library,
 * searched the web live, analysed, and drafted a fully source-backed memo — and
 * then failed on "Record findings in the library" because Google Drive lacked
 * write scope. One failed step marked the whole run failed, the task went
 * `blocked`, `reviewRequired` went false, and the approval queue told the
 * founder nothing was waiting. A good memo became unreachable because a
 * bookkeeping write failed.
 *
 * The rule these tests enforce: evidence-integrity failures block, auxiliary
 * side-effect failures warn. Anything not explicitly classified blocks.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRunWarningsToReviewGate,
  classifyAutomationRunOutcome,
  collectAutomationRunWarnings,
} from '../src/platform/automationLifecycle';
import { resolveAutomationStepSeverity } from '../src/platform/stepSeverity';
import { findFabricatedEvidence } from '../src/platform/provenance';
import {
  ACCOUNT_LIBRARY_READ_QUERY_TYPE,
  ACCOUNT_LIBRARY_SOURCE,
  ACCOUNT_LIBRARY_WRITE_QUERY_TYPE,
  COMPETITIVE_INTELLIGENCE_SECTION,
} from '../src/integrationGateway/accountLibrary';
import type { AutomationStepExecution } from '../src/platform/types';

/** The exact message the founder's run produced. */
const SCOPE_FAILURE_MESSAGE =
  'Google Drive is connected but needs file read and write access to maintain the intelligence library.';

type StepInput = Parameters<typeof classifyAutomationRunOutcome>[0]['stepExecutions'][number];

function libraryWriteFailure(): StepInput {
  return {
    stepId: 'step_library_record',
    kind: 'query',
    title: 'Record findings in the library',
    status: 'failed',
    error: SCOPE_FAILURE_MESSAGE,
    stepSeverity: 'auxiliary',
  };
}

function deliverWaitingForReview(): StepInput {
  return {
    stepId: 'step_competitor_delivery',
    kind: 'deliver',
    title: 'Deliver competitor memo',
    status: 'succeeded',
    stepSeverity: 'critical',
  };
}

test('the account library WRITE is the only step classified auxiliary', () => {
  assert.equal(
    resolveAutomationStepSeverity({
      kind: 'query',
      inputs: {
        source: ACCOUNT_LIBRARY_SOURCE,
        query_type: ACCOUNT_LIBRARY_WRITE_QUERY_TYPE,
        section: COMPETITIVE_INTELLIGENCE_SECTION,
      },
    }),
    'auxiliary',
  );

  // The READ is the delta baseline. Losing it does not merely skip bookkeeping,
  // it removes the thing the memo compares against, so it stays blocking.
  assert.equal(
    resolveAutomationStepSeverity({
      kind: 'query',
      inputs: {
        source: ACCOUNT_LIBRARY_SOURCE,
        query_type: ACCOUNT_LIBRARY_READ_QUERY_TYPE,
        filters: { section: COMPETITIVE_INTELLIGENCE_SECTION },
      },
    }),
    'critical',
  );
});

test('every unclassified step defaults to critical', () => {
  const cases: Array<Parameters<typeof resolveAutomationStepSeverity>[0]> = [
    { kind: 'query', inputs: { source: 'stripe', query_type: 'revenue' } },
    { kind: 'query', inputs: undefined },
    { kind: 'query', inputs: {} },
    // Same source, no query type: a write must be named explicitly to be excused.
    { kind: 'query', inputs: { source: ACCOUNT_LIBRARY_SOURCE } },
    { kind: 'search', inputs: { query: 'competitor pricing' } },
    { kind: 'analyze', inputs: { instruction: 'compare' } },
    { kind: 'summarize', inputs: { instruction: 'draft' } },
    { kind: 'deliver', inputs: {} },
    { kind: 'capture', inputs: { url: 'https://example.com' } },
    { kind: 'note', inputs: { note: 'reminder' } },
  ];

  for (const step of cases) {
    assert.equal(
      resolveAutomationStepSeverity(step),
      'critical',
      `${step.kind} with inputs ${JSON.stringify(step.inputs)} must fail closed`,
    );
  }
});

test('an auxiliary library-write failure leaves the run deliverable and review-gated', () => {
  const outcome = classifyAutomationRunOutcome({
    deliveryWaitingForReview: true,
    stepExecutions: [
      { stepId: 'step_library_context', kind: 'query', title: 'Read the competitive library', status: 'succeeded', stepSeverity: 'critical' },
      { stepId: 'step_competitor_search', kind: 'search', title: 'Search competitor moves', status: 'succeeded', stepSeverity: 'critical' },
      { stepId: 'step_delta_analysis', kind: 'analyze', title: 'Extract what changed', status: 'succeeded', stepSeverity: 'critical' },
      { stepId: 'step_competitor_memo', kind: 'summarize', title: 'Draft competitor memo', status: 'succeeded', stepSeverity: 'critical' },
      libraryWriteFailure(),
      deliverWaitingForReview(),
    ],
  });

  // This is the whole point: the founder can approve the memo.
  assert.equal(outcome.taskStatus, 'waiting_review');
  assert.equal(outcome.runStatus, 'succeeded');
  assert.equal(outcome.delegationState, 'review');
  assert.equal(outcome.reviewRequired, true);
  assert.equal(outcome.schedulerOk, true);

  // And it is never swallowed.
  assert.deepEqual(outcome.runWarnings, [
    {
      stepId: 'step_library_record',
      title: 'Record findings in the library',
      message: SCOPE_FAILURE_MESSAGE,
    },
  ]);
  assert.match(String(outcome.reviewSummary), /waiting for approval/i);
  assert.match(String(outcome.reviewSummary), /Record findings in the library/);
  assert.match(String(outcome.reviewSummary), /file read and write access/);
});

test('an auxiliary failure on an ungated run still completes, carrying its warning', () => {
  const outcome = classifyAutomationRunOutcome({
    stepExecutions: [
      { stepId: 'step_search', kind: 'search', title: 'Search', status: 'succeeded', stepSeverity: 'critical' },
      libraryWriteFailure(),
      { stepId: 'step_deliver', kind: 'deliver', title: 'Deliver', status: 'succeeded', stepSeverity: 'critical' },
    ],
  });

  assert.equal(outcome.taskStatus, 'completed');
  assert.equal(outcome.runStatus, 'succeeded');
  assert.equal(outcome.delegationState, 'completed');
  assert.equal(outcome.schedulerOk, true);
  assert.equal(outcome.runWarnings.length, 1);
  assert.match(String(outcome.reviewSummary), /Record findings in the library/);
});

test('a step that failed without a declared severity still blocks the run', () => {
  const outcome = classifyAutomationRunOutcome({
    deliveryWaitingForReview: true,
    stepExecutions: [
      {
        // No stepSeverity at all — an older ledger record, or a step kind nobody
        // has classified yet. Fail closed.
        stepId: 'step_unclassified',
        kind: 'query',
        title: 'Some future step',
        status: 'failed',
        error: 'Something went wrong.',
      },
      deliverWaitingForReview(),
    ],
  });

  assert.equal(outcome.taskStatus, 'blocked');
  assert.equal(outcome.runStatus, 'failed');
  assert.equal(outcome.reviewRequired, false);
  assert.equal(outcome.schedulerOk, false);
  assert.deepEqual(outcome.runWarnings, []);
});

test('a critical failure keeps blocking even when an auxiliary step also failed', () => {
  const outcome = classifyAutomationRunOutcome({
    deliveryWaitingForReview: true,
    stepExecutions: [
      {
        stepId: 'step_library_context',
        kind: 'query',
        title: 'Read the competitive library',
        status: 'failed',
        error: 'Google Drive must be connected before Violema can read this library.',
        stepSeverity: 'critical',
      },
      libraryWriteFailure(),
      deliverWaitingForReview(),
    ],
  });

  assert.equal(outcome.taskStatus, 'blocked');
  assert.equal(outcome.runStatus, 'failed');
  assert.equal(outcome.reviewRequired, false);
  assert.equal(outcome.schedulerOk, false);
  assert.match(String(outcome.reviewSummary), /Google Drive must be connected/);
  // The auxiliary failure is still reported — a blocked run does not hide it.
  assert.equal(outcome.runWarnings.length, 1);
  assert.equal(outcome.runWarnings[0]?.stepId, 'step_library_record');
});

test('a failed delivery still blocks regardless of any auxiliary warning', () => {
  const outcome = classifyAutomationRunOutcome({
    deliveryError: 'Slack target "#violema-demo" is not visible to Violema.',
    stepExecutions: [
      libraryWriteFailure(),
      { stepId: 'step_deliver', kind: 'deliver', title: 'Deliver', status: 'failed', stepSeverity: 'critical' },
    ],
  });

  assert.equal(outcome.taskStatus, 'blocked');
  assert.equal(outcome.runStatus, 'failed');
  assert.match(String(outcome.reviewSummary), /Slack target/);
});

test('collectAutomationRunWarnings reports only tolerated failures, in step order', () => {
  const warnings = collectAutomationRunWarnings([
    { stepId: 'step_a', kind: 'query', title: 'Succeeded', status: 'succeeded', stepSeverity: 'auxiliary' },
    { stepId: 'step_b', kind: 'query', title: 'Skipped', status: 'skipped', stepSeverity: 'auxiliary' },
    { stepId: 'step_c', kind: 'query', title: 'Archive one', status: 'failed', error: 'first', stepSeverity: 'auxiliary' },
    { stepId: 'step_d', kind: 'search', title: 'Critical', status: 'failed', error: 'blocking', stepSeverity: 'critical' },
    { stepId: 'step_e', kind: 'query', title: 'Archive two', status: 'failed', stepSeverity: 'auxiliary' },
  ]);

  assert.deepEqual(warnings, [
    { stepId: 'step_c', title: 'Archive one', message: 'first' },
    // No error recorded still produces an honest, non-empty message.
    { stepId: 'step_e', title: 'Archive two', message: 'Archive two did not complete.' },
  ]);
});

test('the review gate artifact carries the warning so an approver sees it first', () => {
  const artifacts: unknown[] = [
    { kind: 'web_search', title: 'Search competitor moves', payload: { results: [] } },
    {
      kind: 'review_gate',
      title: 'Ready for review: Competitor monitor',
      payload: {
        markdown: '## Competitor monitor\nPricing moved.',
        deliveryTarget: '#violema-demo',
        approvalRequired: true,
      },
    },
  ];

  const warnings = [
    { stepId: 'step_library_record', title: 'Record findings in the library', message: SCOPE_FAILURE_MESSAGE },
  ];
  applyRunWarningsToReviewGate(artifacts, warnings);

  const gate = artifacts[1] as { payload: { runWarnings?: unknown; markdown?: string } };
  assert.deepEqual(gate.payload.runWarnings, warnings);
  // The brief itself is untouched — the warning is metadata around it.
  assert.equal(gate.payload.markdown, '## Competitor monitor\nPricing moved.');
  assert.equal((artifacts[0] as { payload: { runWarnings?: unknown } }).payload.runWarnings, undefined);
});

test('applyRunWarningsToReviewGate writes nothing when there is nothing to warn about', () => {
  const gate = {
    kind: 'review_gate',
    title: 'Ready for review',
    payload: { markdown: '# Brief', deliveryTarget: '#ops', approvalRequired: true },
  };
  applyRunWarningsToReviewGate([gate], []);
  assert.equal('runWarnings' in gate.payload, false);
});

test('a failed auxiliary write is invisible to the fabricated-evidence scan', () => {
  // A failed WRITE produces no artifact and no output — there is no payload to
  // scan, so tolerating it cannot weaken the provenance floor.
  const stepExecutions: AutomationStepExecution[] = [
    {
      stepId: 'step_library_record',
      kind: 'query',
      title: 'Record findings in the library',
      assignedRole: 'analyst',
      status: 'failed',
      error: SCOPE_FAILURE_MESSAGE,
      summary: SCOPE_FAILURE_MESSAGE,
      dataOrigin: 'none',
      stepSeverity: 'auxiliary',
    },
  ];

  assert.equal(stepExecutions[0]?.output, undefined, 'a failed library write must record no output');
  assert.equal(findFabricatedEvidence({ artifacts: [], stepExecutions }), null);
});

test('severity never excuses fabricated evidence', () => {
  const simulatedArtifact = findFabricatedEvidence({
    artifacts: [
      {
        kind: 'query_data',
        title: 'Check revenue',
        payload: { ok: true, source: 'stripe', simulated: true, live: false },
        origin: { live: false, simulated: true, source: 'stripe' },
      },
    ],
    stepExecutions: [],
  });
  assert.ok(simulatedArtifact, 'simulated artifacts must still be caught');
  assert.equal(simulatedArtifact?.source, 'stripe');

  // Even when the step carrying it is marked auxiliary, the scan is unchanged:
  // it reads provenance, never severity.
  const auxiliaryButSimulated: AutomationStepExecution[] = [
    {
      stepId: 'step_library_record',
      kind: 'query',
      title: 'Record findings in the library',
      assignedRole: 'analyst',
      status: 'succeeded',
      output: { ok: true, source: 'google_drive', simulated: true },
      dataOrigin: 'simulated',
      stepSeverity: 'auxiliary',
    },
  ];
  const simulatedStep = findFabricatedEvidence({
    artifacts: [],
    stepExecutions: auxiliaryButSimulated,
  });
  assert.ok(simulatedStep, 'a simulated auxiliary step must still block delivery');
  assert.equal(simulatedStep?.source, 'google_drive');
});
