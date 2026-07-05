import { selectDimaStudioAdvice } from '../src/features/agent-studio/agentStudioDimaAdvisor';
import type { AgentStudioOperationalContext } from '../src/features/agent-studio/contract';
import type { AgentStudioRow, AutomationApiRecord, PlatformTaskRunRecord } from '../src/features/agent-studio/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function workflow(overrides: Partial<AutomationApiRecord> = {}): AutomationApiRecord {
  return {
    id: 'workflow-1',
    name: 'Investor signal briefing',
    schedule: 'Every weekday at 8:00 AM',
    actions: ['Send Slack update'],
    steps: [
      { id: 'step-1', kind: 'search', title: 'Find signals', objective: 'Find market updates' },
      { id: 'step-2', kind: 'deliver', title: 'Send update', objective: 'Send Slack update', deliveryTarget: { channel: 'slack', target: '#founder' } },
    ],
    execution_policy: { mode: 'custom', optimizationGoal: 'balanced', reviewPolicy: 'standard', maxElasticLanes: 2 },
    status: 'active',
    created_at: '2026-07-04T12:00:00.000Z',
    ...overrides,
  };
}

function run(overrides: Partial<PlatformTaskRunRecord> = {}): PlatformTaskRunRecord {
  return {
    id: 'run-1',
    taskId: 'task-1',
    status: 'succeeded',
    modelTier: 'balanced',
    agentRole: 'manager',
    startedAt: '2026-07-04T12:00:00.000Z',
    finishedAt: '2026-07-04T12:04:00.000Z',
    actualCredits: 18,
    ...overrides,
  };
}

function row(overrides: Partial<AgentStudioRow> = {}): AgentStudioRow {
  const automation = overrides.automation || workflow();
  const runs = overrides.runs || [run()];
  return {
    automation,
    runs,
    latestRun: overrides.latestRun || runs[0],
    stepExecutions: [],
    workflowSteps: automation.steps || [],
    successRate: 1,
    averageCredits: 18,
    averageDurationMs: 240000,
    ...overrides,
  };
}

function context(overrides: Partial<AgentStudioOperationalContext> = {}): AgentStudioOperationalContext {
  return {
    workflowId: 'workflow-1',
    runId: 'run-1',
    generatedAt: '2026-07-04T12:05:00.000Z',
    similarRuns: [],
    recommendationEvidence: [],
    ...overrides,
  };
}

const emptyAdvice = selectDimaStudioAdvice({});
assert(emptyAdvice.tone === 'neutral', 'empty Studio state keeps Dima neutral');
assert(emptyAdvice.sprite === 'thinking', 'empty Studio state uses thinking sprite');
assert(emptyAdvice.nextAction.includes('Select a workflow'), 'empty Studio state tells the user to select a workflow');

const failedRunAdvice = selectDimaStudioAdvice({
  row: row({
    latestRun: run({
      status: 'failed',
      error: 'Slack delivery token expired',
    }),
    successRate: 0.45,
  }),
});
assert(failedRunAdvice.tone === 'warning', 'failed runs create warning advice');
assert(failedRunAdvice.sprite === 'chew', 'failed runs use the chew sprite');
assert(failedRunAdvice.message.includes('Fix the failed run'), 'failed runs block policy tuning');
assert(failedRunAdvice.evidence.some((item) => item.includes('Slack delivery token expired')), 'failed run advice includes the error');

const leanDeliveryAdvice = selectDimaStudioAdvice({
  row: row({
    automation: workflow({
      execution_policy: { mode: 'custom', optimizationGoal: 'cost_saver', reviewPolicy: 'lean', maxElasticLanes: 1 },
    }),
  }),
});
assert(leanDeliveryAdvice.tone === 'warning', 'lean external delivery creates warning advice');
assert(leanDeliveryAdvice.sprite === 'mark', 'lean external delivery uses marker sprite');
assert(leanDeliveryAdvice.nextAction.includes('review'), 'lean external delivery recommends review');

const evidenceAdvice = selectDimaStudioAdvice({
  row: row(),
  operationalContext: context({
    recommendationEvidence: [
      {
        evidenceId: 'evidence-1',
        title: 'Summarize step is expensive',
        body: 'Summarize used 44 credits on the last run while healthy runs used 19.',
        sourceLabel: 'Replay',
        phase: 'summarize',
        relatedRunIds: ['run-1'],
      },
    ],
    similarRuns: [
      {
        runId: 'run-healthy',
        label: 'Healthy briefing run',
        status: 'succeeded',
        startedAt: '2026-07-03T12:00:00.000Z',
        similarityScore: 0.84,
        matchedSignals: ['same workflow', 'same delivery channel'],
      },
    ],
  }),
});
assert(evidenceAdvice.tone === 'action', 'recommendation evidence creates action advice');
assert(evidenceAdvice.sprite === 'action', 'recommendation evidence uses action sprite');
assert(evidenceAdvice.message.includes('Summarize step is expensive'), 'recommendation advice names the evidence');
assert(evidenceAdvice.evidence.some((item) => item.includes('Healthy briefing run')), 'recommendation advice includes similar run context');

const stableAdvice = selectDimaStudioAdvice({
  row: row({
    runs: [
      run({ id: 'run-1' }),
      run({ id: 'run-2' }),
      run({ id: 'run-3' }),
      run({ id: 'run-4' }),
    ],
    successRate: 0.92,
    averageCredits: 12,
  }),
  activeRoom: 'optimize',
});
assert(stableAdvice.tone === 'success', 'stable workflows create success advice');
assert(stableAdvice.sprite === 'kiss', 'stable workflows use approval sprite');
assert(stableAdvice.nextAction.includes('candidate'), 'stable workflows suggest release candidate review');

console.log('agentStudioDimaAdvisor.contract: Dima Studio advice verified');
