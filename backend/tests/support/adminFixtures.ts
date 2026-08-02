/**
 * Shared fixture builder for the admin-surface suites.
 *
 * Not a test file — the `npm test` glob only picks up `*.test.ts` and
 * `*.contract.ts`, so this module is imported, never executed as a suite.
 *
 * Two constraints it exists to enforce:
 *
 *   - Every store path in the backend is a module-level
 *     `path.join(process.cwd(), …)`, frozen at first import. A suite must
 *     `chdir` into its temp directory BEFORE importing anything, and all
 *     store-touching tests in one file must share that one directory.
 *   - Nothing here may touch a real `backend/*.json`. Everything is written
 *     into a `mkdtemp` scratch directory.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Planted in every content-bearing field the stores accept. */
export const SENTINELS = {
  artifactTitle: 'POISON_ARTIFACT_TITLE_zqx1',
  artifactBody: 'POISON_ARTIFACT_BODY_zqx2',
  summary: 'POISON_SUMMARY_zqx3',
  stepOutput: 'POISON_STEP_OUTPUT_zqx4',
  stepTitle: 'POISON_STEP_TITLE_zqx5',
  delivery: 'POISON_DELIVERY_BODY_zqx6',
  reviewNote: 'POISON_REVIEW_NOTE_zqx7',
  ledgerNote: 'POISON_LEDGER_NOTE_zqx8',
  runError: 'POISON_RUN_ERROR_zqx9',
  taskDescription: 'POISON_TASK_DESCRIPTION_zqxa',
  blockerLabel: 'POISON_BLOCKER_LABEL_zqxb',
  blockerKey: 'poison_blocker_key_zqxc',
  workspaceMetadata: 'POISON_WORKSPACE_METADATA_zqxd',
  automationPrompt: 'POISON_AUTOMATION_PROMPT_zqxe',
} as const;

export function allSentinels(): string[] {
  return Object.values(SENTINELS);
}

export interface TempStoreContext {
  tempDir: string;
  cleanup: () => void;
}

/**
 * Enter a throwaway cwd. Call BEFORE the first `await import` of anything that
 * resolves a store path, and keep it for the whole file.
 */
export function enterTempStores(label: string): TempStoreContext {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(tmpdir(), `violema-${label}-`));
  process.chdir(tempDir);
  return {
    tempDir,
    cleanup: () => {
      process.chdir(originalCwd);
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

/** Write an automations store directly: `createAutomation` rewrites schedules. */
export function writeAutomations(
  tempDir: string,
  automations: Array<Record<string, unknown>>,
) {
  writeFileSync(path.join(tempDir, 'automations.json'), JSON.stringify(automations, null, 2));
}

export function automationFixture(input: {
  id: string;
  name: string;
  workspaceId?: string;
  status?: 'active' | 'paused';
  consecutiveFailures?: number;
  lastRunStatus?: 'succeeded' | 'failed';
  nextRunAt?: string;
  createdAt?: string;
}): Record<string, unknown> {
  return {
    id: input.id,
    name: input.name,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    description: 'Fixture automation',
    workflow_prompt: SENTINELS.automationPrompt,
    schedule: 'every monday at 9am',
    cron_expression: '0 9 * * 1',
    actions: ['Do the thing'],
    status: input.status || 'active',
    consecutive_failures: input.consecutiveFailures ?? 0,
    ...(input.lastRunStatus ? { last_run_status: input.lastRunStatus } : {}),
    ...(input.nextRunAt ? { next_run_at: input.nextRunAt } : {}),
    created_at: input.createdAt || '2026-07-01T00:00:00.000Z',
  };
}

/**
 * The readiness block the server writes onto a blocked task and run
 * (`recordBlockedAutomationRun` in `server.ts`). One blocker carries a poisoned
 * label AND a poisoned key, because the gate mints keys straight from a custom
 * automation's own `inputs.source` — tenant-controlled text.
 */
export function poisonedReadinessBlock(blockedAt: string) {
  return {
    code: 'workflow_not_ready' as const,
    tier: 'step_sources',
    workflowId: 'custom-workflow',
    summary: `Cannot run: ${SENTINELS.summary}`,
    blockers: [
      {
        key: 'stripe',
        label: 'Connect Stripe',
        detail: `Stripe is not connected. ${SENTINELS.summary}`,
      },
      {
        key: SENTINELS.blockerKey,
        label: SENTINELS.blockerLabel,
        detail: SENTINELS.summary,
      },
    ],
    blockedAt,
  };
}

/** Run metadata carrying every content field a real run produces. */
export function poisonedRunMetadata(automationId: string) {
  return {
    automationId,
    title: 'Weekly founder update',
    reviewRequired: true,
    summary: SENTINELS.summary,
    artifacts: [
      {
        kind: 'report',
        title: SENTINELS.artifactTitle,
        payload: { body: SENTINELS.artifactBody, live: true, source: 'stripe' },
      },
    ],
    stepExecutions: [
      {
        kind: 'query',
        title: SENTINELS.stepTitle,
        status: 'succeeded',
        dataOrigin: 'live',
        output: { ok: true, source: 'stripe', data: SENTINELS.stepOutput },
      },
    ],
    delivery: { to: '#founders', body: SENTINELS.delivery, status: 'sent' },
    reviewReceipt: { status: 'delivered', reviewer: 'Max', note: SENTINELS.reviewNote },
  };
}

/** Task metadata mirrors the run's, which is how the real writer leaves it. */
export function poisonedTaskMetadata(automationId: string) {
  return {
    automationId,
    latestSummary: SENTINELS.summary,
    latestArtifacts: [
      {
        kind: 'report',
        title: SENTINELS.artifactTitle,
        payload: { body: SENTINELS.artifactBody },
      },
    ],
    latestStepExecutions: [
      { kind: 'query', title: SENTINELS.stepTitle, output: { data: SENTINELS.stepOutput } },
    ],
    reviewRequest: { status: 'changes_requested', note: SENTINELS.reviewNote },
  };
}
