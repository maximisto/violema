import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('analysis has room to finish while truncated responses still fail closed and retain usage', async (t) => {
  const originalCwd = process.cwd();
  const envKeys = ['VIOLEMA_DISABLE_AUTOMATION_SCHEDULER', 'DEMO_WORKSPACE_IDS', 'OPENROUTER_API_KEY'] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-analysis-budget-'));

  try {
    process.chdir(tempDir);
    process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';
    process.env.DEMO_WORKSPACE_IDS = 'workspace_analysis_budget';
    process.env.OPENROUTER_API_KEY = 'test-key-route-readiness';

    const models = await import('../src/models');
    const server = await import('../src/server');
    const store = await import('../src/platform/store');
    store.addLedgerEntry({
      workspaceId: 'workspace_analysis_budget', source: 'manual_adjustment',
      deltaCredits: 10_000, referenceType: 'manual', referenceId: 'analysis_budget_test',
    });

    for (const forceTruncation of [false, true]) {
      await t.test(forceTruncation ? 'truncated analysis is withheld and charged' : 'complete analysis reaches the next step', async (st) => {
        // Model the provider's token ceiling at the external boundary. The
        // live failure used all 500 tokens. A 900-token response must be able
        // to complete, without dropping the stop-reason or accounting guards.
        const analysisTokens = 900;
        let runtimeLimit = 0;
        const analysis = 'Three changes are supported by the supplied evidence. Pricing is unchanged; the launch needs confirmation; positioning shifted toward teams.';
        st.mock.method(models, 'generateTextDetailed', async (...args: Parameters<typeof models.generateTextDetailed>) => {
          const isAnalysis = args[1].includes('internal VIOLEMA analyst');
          const limit = args[3]!;
          if (isAnalysis) runtimeLimit = limit;
          const truncated = isAnalysis && (forceTruncation || limit < analysisTokens);
          const outputTokens = isAnalysis ? (truncated ? limit : analysisTokens) : 50;
          return {
            text: isAnalysis ? (truncated ? 'Three changes are supported, beginning with' : analysis) : 'A complete reviewed brief.',
            stopReason: truncated ? 'max_tokens' : 'end_turn',
            usage: {
              inputTokens: 4_370, outputTokens, totalTokens: 4_370 + outputTokens,
              provider: 'anthropic' as const, model: 'analysis-budget-fixture',
            },
          };
        });
        const automation = {
          id: `auto_analysis_budget_${forceTruncation}`,
          workspaceId: 'workspace_analysis_budget', name: 'Analysis output budget', actions: [],
          steps: [
            { id: 'analysis', kind: 'analyze' as const, title: 'Extract what changed', objective: 'Compare this run against the prior library entries and separate genuine change from noise.' },
            { id: 'summary', kind: 'summarize' as const, title: 'Draft memo', objective: 'Draft the memo from the completed analysis.' },
          ],
        };
        const result = await server.runAutomation(automation);
        assert.equal(result.ok, !forceTruncation, JSON.stringify(result));
        const run = store.listTaskRuns('workspace_analysis_budget').find((row) => row.metadata?.automationId === automation.id);
        assert.ok(run);
        const calls = run.metadata?.generationCalls as Array<{ purpose: string; status: string; usage: { outputTokens: number } }>;
        const call = calls.find((row) => row.purpose === 'analysis');
        assert.ok(call);
        assert.equal(call.status, forceTruncation ? 'rejected' : 'succeeded');
        assert.equal(call.usage.outputTokens, forceTruncation ? runtimeLimit : analysisTokens);
        const steps = run.metadata?.stepExecutions as Array<{ kind: string; status: string; output?: { markdown?: string } }>;
        if (forceTruncation) {
          assert.equal(steps.find((row) => row.kind === 'analyze')?.status, 'failed');
          assert.ok(!steps.some((row) => row.kind === 'summarize' && row.status === 'succeeded'));
        } else {
          assert.equal(steps.find((row) => row.kind === 'analyze')?.output?.markdown, analysis);
          assert.equal(steps.find((row) => row.kind === 'summarize')?.status, 'succeeded');
        }
        const projection = server.buildAutomationExecutionPlan(automation).generationProjections.find((row) => row.purpose === 'analysis');
        assert.ok(projection);
        assert.equal(projection.maxOutputTokens, runtimeLimit, 'preflight must authorize the full runtime ceiling');
        assert.equal(projection.estimatedMaxOutputTokens, runtimeLimit, 'displayed estimates must account for the larger analysis allowance');
        assert.ok(store.listLedgerEntries('workspace_analysis_budget').some((entry) =>
          entry.referenceId === automation.id && entry.metadata?.holdStatus === 'settled' && entry.deltaCredits < 0
        ), 'both accepted and rejected provider usage is settled');
      });
    }
  } finally {
    process.chdir(originalCwd);
    for (const key of envKeys) {
      if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
      else delete process.env[key];
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
