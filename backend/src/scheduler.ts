import fs from 'fs';
import path from 'path';
import type { ScheduledTask } from 'node-cron';
import type { AutomationExecutionPolicy, AutomationStepKind, PersistedAutomationStep } from './platform/types';

export interface AutomationRoleDirective {
  mode: 'cheaper' | 'review' | 'promote';
  phases?: AutomationStepKind[];
  updatedAt: string;
}

export interface AutomationStudioExperimentRecord {
  id: string;
  scenarioId: string;
  previewPresetId: string;
  createdAt: string;
  notes?: string;
  roleDirectives?: Record<string, AutomationRoleDirective>;
}

export interface AutomationStudioState {
  selectedScenarioId?: string;
  previewPresetId?: string;
  experimentHistory?: AutomationStudioExperimentRecord[];
  roleDirectives?: Record<string, AutomationRoleDirective>;
}

export interface AutomationRecord {
  id: string;
  version?: 2;
  workspaceId?: string;
  name: string;
  description?: string;
  authoring_mode?: 'guided' | 'describe';
  workflow_prompt?: string;
  schedule: string;
  cron_expression: string;
  timezone?: string;
  actions: string[];
  steps?: PersistedAutomationStep[];
  execution_policy?: AutomationExecutionPolicy;
  studio_state?: AutomationStudioState;
  notify?: string;
  condition?: string;
  status: 'active' | 'paused';
  last_run_at?: string;
  last_run_status?: 'succeeded' | 'failed';
  consecutive_failures?: number;
  next_run_at?: string;
  created_at: string;
}

const AUTOMATIONS_FILE = path.join(process.cwd(), 'automations.json');
const scheduledTasks = new Map<string, ScheduledTask>();
const DEFAULT_AUTOMATION_TIMEZONE = process.env.DEFAULT_AUTOMATION_TIMEZONE || 'UTC';
let cronModule: typeof import('node-cron') | null = null;

function getCron() {
  if (!cronModule) {
    // Lazy-load node-cron so read-only automation imports do not keep test workers alive.
    cronModule = require('node-cron') as typeof import('node-cron');
  }
  return cronModule;
}

function shouldScheduleAutomationTasks() {
  return process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER !== '1';
}

const LEGACY_DELIVERY_TARGETS: Record<string, string> = {
  '#founders': '#all-purple-orange',
};
type AutomationSeed = Omit<
  AutomationRecord,
  'created_at' | 'last_run_at' | 'last_run_status' | 'consecutive_failures' | 'next_run_at'
>;

const CORE_AUTOMATION_SEEDS: AutomationSeed[] = [
  {
    id: 'auto_weekly_founder_update',
    version: 2,
    name: 'Weekly founder update',
    description: 'A source-linked operating brief that rolls up revenue, product, customer, calendar, email, market, and decision signals for founder review.',
    authoring_mode: 'guided',
    workflow_prompt: [
      'Create the weekly founder update from connected company systems.',
      'Pull revenue, delivery, customer, calendar, email, and market signals.',
      'Draft the brief with source-backed evidence and wait for human approval before delivery.',
    ].join('\n'),
    schedule: 'every monday at 9am',
    cron_expression: '0 9 * * 1',
    timezone: 'America/Chicago',
    actions: [
      'Check Stripe revenue, churn, expansion, and failed-payment signals',
      'Scan GitHub delivery progress, blockers, and unreviewed pull requests',
      'Review founder-critical email commitments and unanswered threads',
      'Review calendar for investor, customer, and team commitments this week',
      'Scan market and competitor changes since the last update',
      'Draft the weekly founder update with key decisions, risks, and next actions',
      'Deliver latest result to #all-purple-orange after approval',
    ],
    steps: [
      {
        id: 'step_stripe_revenue',
        kind: 'query',
        title: 'Check Stripe revenue',
        objective: 'Pull MRR movement, failed payments, churn, expansion, and customer revenue signals from Stripe.',
        inputs: { source: 'stripe', query_type: 'revenue_summary' },
      },
      {
        id: 'step_github_delivery',
        kind: 'query',
        title: 'Scan GitHub delivery',
        objective: 'Pull merged pull requests, blocked issues, stale reviews, and release risk from GitHub.',
        inputs: { source: 'github', query_type: 'delivery_risk' },
      },
      {
        id: 'step_email_commitments',
        kind: 'query',
        title: 'Review email commitments',
        objective: 'Find founder-critical follow-ups, investor/customer commitments, and unanswered priority threads.',
        inputs: { source: 'email', providers: ['google_workspace', 'microsoft_365'], query_type: 'commitments' },
      },
      {
        id: 'step_calendar_commitments',
        kind: 'query',
        title: 'Review calendar commitments',
        objective: 'Review upcoming meetings, deadlines, and relationship commitments for the next seven days.',
        inputs: { source: 'calendar', providers: ['google_workspace', 'microsoft_365'], query_type: 'weekly_commitments' },
      },
      {
        id: 'step_market_scan',
        kind: 'search',
        title: 'Scan market signals',
        objective: 'Research meaningful customer, competitor, pricing, platform, and AI automation changes since the last update.',
        inputs: { query: 'AI automation platform startup competitor pricing product launch founder update', num_results: 6 },
      },
      {
        id: 'step_founder_brief',
        kind: 'summarize',
        title: 'Draft founder brief',
        objective: 'Synthesize a concise founder-ready brief with revenue movement, product progress, customer signals, market context, risks, decisions needed, and next actions.',
        inputs: { instruction: 'Draft the weekly founder update with source-linked evidence, clear risks, decisions, and next actions.' },
      },
      {
        id: 'step_slack_delivery',
        kind: 'deliver',
        title: 'Deliver to Slack',
        objective: 'Send the reviewed weekly founder update to the founder channel after approval.',
        inputs: { approval_required: true },
        deliveryTarget: { channel: 'slack', target: '#all-purple-orange' },
      },
    ],
    execution_policy: {
      mode: 'recommended',
      optimizationGoal: 'balanced',
      reviewPolicy: 'standard',
      maxElasticLanes: 2,
    },
    notify: '#all-purple-orange',
    status: 'active',
  },
];

function readAutomations(): AutomationRecord[] {
  try {
    if (!fs.existsSync(AUTOMATIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(AUTOMATIONS_FILE, 'utf-8')) as AutomationRecord[];
  } catch {
    return [];
  }
}

function writeAutomations(items: AutomationRecord[]) {
  fs.writeFileSync(AUTOMATIONS_FILE, JSON.stringify(items, null, 2));
}

function isValidTimeZone(timezone?: string): boolean {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(timezone?: string): string {
  return isValidTimeZone(timezone) ? timezone! : DEFAULT_AUTOMATION_TIMEZONE;
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    minute: Number(values.minute),
    hour: Number(values.hour),
    dayOfMonth: Number(values.day),
    month: Number(values.month),
    dayOfWeek: weekdayMap[values.weekday] ?? 0,
  };
}

function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  if (/^\*\/\d+$/.test(field)) {
    const step = Number(field.slice(2));
    return value % step === 0;
  }
  if (field.includes(',')) {
    return field.split(',').some((part) => fieldMatches(part, value));
  }
  return Number(field) === value;
}

function cronMatchesDate(cronExpression: string, date: Date, timezone: string): boolean {
  const [minuteField, hourField, dayField, monthField, weekdayField] = cronExpression.trim().split(/\s+/);
  if (!minuteField || !hourField || !dayField || !monthField || !weekdayField) return false;

  const zoned = getZonedParts(date, timezone);
  return (
    fieldMatches(minuteField, zoned.minute) &&
    fieldMatches(hourField, zoned.hour) &&
    fieldMatches(dayField, zoned.dayOfMonth) &&
    fieldMatches(monthField, zoned.month) &&
    fieldMatches(weekdayField, zoned.dayOfWeek)
  );
}

function computeNextRunAt(cronExpression: string, timezone: string, fromDate = new Date()): string | undefined {
  const start = Math.floor(fromDate.getTime() / 60000) * 60000;
  const maxMinutesAhead = 60 * 24 * 32;
  for (let minuteOffset = 1; minuteOffset <= maxMinutesAhead; minuteOffset += 1) {
    const candidate = new Date(start + minuteOffset * 60000);
    if (cronMatchesDate(cronExpression, candidate, timezone)) {
      return candidate.toISOString();
    }
  }
  return undefined;
}

function updateAutomationRecord(id: string, updater: (record: AutomationRecord) => AutomationRecord): AutomationRecord | null {
  const items = readAutomations();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const next = withAutomationDefaults(updater(items[index]));
  items[index] = next;
  writeAutomations(items);
  return next;
}

function normalizeDeliveryTargetText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return LEGACY_DELIVERY_TARGETS[trimmed.toLowerCase()] || trimmed;
}

function normalizeAutomationText(value: string) {
  return value
    .replace(/#founders\b/gi, '#all-purple-orange')
    .replace(/#all-purple-orange\s+channel/gi, '#all-purple-orange channel');
}

function normalizeAutomationRecord(record: AutomationRecord): AutomationRecord {
  return {
    ...record,
    actions: record.actions.map(normalizeAutomationText),
    workflow_prompt: record.workflow_prompt ? normalizeAutomationText(record.workflow_prompt) : record.workflow_prompt,
    notify: normalizeDeliveryTargetText(record.notify),
    steps: record.steps?.map((step) => ({
      ...step,
      objective: normalizeAutomationText(step.objective),
      deliveryTarget: step.deliveryTarget
        ? {
            ...step.deliveryTarget,
            target: normalizeDeliveryTargetText(step.deliveryTarget.target) || step.deliveryTarget.target,
          }
        : step.deliveryTarget,
    })),
  };
}

function withAutomationDefaults(record: AutomationRecord): AutomationRecord {
  const normalized = normalizeAutomationRecord(record);
  const timezone = normalizeTimeZone(normalized.timezone);
  return {
    ...normalized,
    workspaceId: normalized.workspaceId,
    timezone,
    next_run_at: normalized.status === 'paused'
      ? undefined
      : normalized.next_run_at || computeNextRunAt(normalized.cron_expression, timezone),
  };
}

function parseTime(value?: string): { hour: number; minute: number } {
  if (!value) return { hour: 9, minute: 0 };

  const trimmed = value.trim().toLowerCase();
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]) % 12;
    if (ampmMatch[3] === 'pm') hour += 12;
    return { hour, minute: Number(ampmMatch[2] || '0') };
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    return {
      hour: Math.min(Number(twentyFourHourMatch[1]), 23),
      minute: Math.min(Number(twentyFourHourMatch[2]), 59),
    };
  }

  throw new Error(`Unsupported time format: ${value}`);
}

export function normalizeSchedule(schedule: string): string {
  const normalized = schedule.trim().toLowerCase();

  if (getCron().validate(normalized)) {
    return normalized;
  }

  if (normalized === 'hourly' || normalized === 'every hour') {
    return '0 * * * *';
  }

  const everyHours = normalized.match(/^every\s+(\d+)\s+hours?$/);
  if (everyHours) {
    const hours = Number(everyHours[1]);
    if (hours < 1 || hours > 23) {
      throw new Error('Hour interval must be between 1 and 23.');
    }
    return `0 */${hours} * * *`;
  }

  const dailyMatch = normalized.match(/^(daily|every day)(?:\s+at\s+(.+))?$/);
  if (dailyMatch) {
    const { hour, minute } = parseTime(dailyMatch[2]);
    return `${minute} ${hour} * * *`;
  }

  const weeklyMatch = normalized.match(
    /^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+(.+))?$/
  );
  if (weeklyMatch) {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const { hour, minute } = parseTime(weeklyMatch[2]);
    return `${minute} ${hour} * * ${dayMap[weeklyMatch[1]]}`;
  }

  throw new Error('Unsupported schedule format. Use cron, "hourly", "every 4 hours", "daily at 6pm", or "every monday at 9am".');
}

/**
 * Evaluate a human-written condition string against the automation's current state.
 * Returns true (should run) or false (should skip this run).
 *
 * Supported patterns (case-insensitive):
 *   "only if last run failed"         → skip if last run succeeded
 *   "only if last run succeeded"      → skip if last run failed
 *   "if failure count exceeds N"      → skip if consecutive_failures <= N
 *   "only if consecutive failures > N"
 *   "skip if last run succeeded"      → same as "only if last run failed"
 */
function evaluateCondition(condition: string, record: AutomationRecord): { pass: boolean; reason: string } {
  const norm = condition.trim().toLowerCase();

  const lastStatus = record.last_run_status;
  const failures = record.consecutive_failures ?? 0;

  if (/only if last run failed|skip if last run succeeded/.test(norm)) {
    if (!lastStatus) return { pass: true, reason: 'No previous run — allowing first run.' };
    const pass = lastStatus === 'failed';
    return { pass, reason: pass ? 'Last run failed — condition met.' : `Skipped: last run succeeded.` };
  }

  if (/only if last run succeeded|skip if last run failed/.test(norm)) {
    if (!lastStatus) return { pass: true, reason: 'No previous run — allowing first run.' };
    const pass = lastStatus === 'succeeded';
    return { pass, reason: pass ? 'Last run succeeded — condition met.' : `Skipped: last run failed.` };
  }

  const failThresholdMatch = norm.match(/(?:if failure count exceeds|if consecutive failures[^>]*>)\s*(\d+)/);
  if (failThresholdMatch) {
    const threshold = Number(failThresholdMatch[1]);
    const pass = failures > threshold;
    return {
      pass,
      reason: pass
        ? `Failure count ${failures} exceeds threshold ${threshold} — condition met.`
        : `Skipped: failure count ${failures} does not exceed ${threshold}.`,
    };
  }

  // Unknown pattern — fail closed so the user notices the condition needs fixing
  return {
    pass: false,
    reason: `Condition not recognised: "${condition.trim()}". Supported patterns: "only if last run failed", "only if last run succeeded", "if consecutive failures > N". Leave blank to always run.`,
  };
}

async function executeAutomation(
  record: AutomationRecord,
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const startedAt = new Date().toISOString();
  const timezone = normalizeTimeZone(record.timezone);

  // Evaluate condition before running
  if (record.condition?.trim()) {
    const { pass, reason } = evaluateCondition(record.condition, record);
    if (!pass) {
      console.log(`[scheduler] automation ${record.id} skipped: ${reason}`);
      updateAutomationRecord(record.id, (current) => ({
        ...current,
        timezone,
        next_run_at: computeNextRunAt(current.cron_expression, timezone, new Date(startedAt)),
      }));
      return;
    }
    console.log(`[scheduler] automation ${record.id} condition passed: ${reason}`);
  }

  updateAutomationRecord(record.id, (current) => ({
    ...current,
    timezone,
    last_run_at: startedAt,
  }));

  let result: { ok: boolean; error?: string } | void;

  try {
    result = await onTrigger({ ...record, timezone, last_run_at: startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown automation error';
    console.error(`[scheduler] automation ${record.id} failed`, error);
    result = { ok: false, error: message };
  }

  const ok = typeof result === 'object' && result !== null && 'ok' in result ? Boolean(result.ok) : true;

  updateAutomationRecord(record.id, (current) => ({
    ...current,
    timezone,
    last_run_at: startedAt,
    last_run_status: ok ? 'succeeded' : 'failed',
    consecutive_failures: ok ? 0 : (current.consecutive_failures ?? 0) + 1,
    next_run_at: computeNextRunAt(current.cron_expression, timezone, new Date(startedAt)),
  }));
}

function scheduleAutomationTask(
  record: AutomationRecord,
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const existing = scheduledTasks.get(record.id);
  existing?.stop();
  existing?.destroy();

  if (record.status === 'paused') {
    updateAutomationRecord(record.id, (current) => ({
      ...current,
      timezone: normalizeTimeZone(current.timezone),
      next_run_at: undefined,
    }));
    scheduledTasks.delete(record.id);
    return;
  }

  const timezone = normalizeTimeZone(record.timezone);
  if (shouldScheduleAutomationTasks()) {
    const task = getCron().schedule(record.cron_expression, () => {
      void executeAutomation({ ...record, timezone }, onTrigger);
    }, { timezone });

    scheduledTasks.set(record.id, task);
  } else {
    scheduledTasks.delete(record.id);
  }

  updateAutomationRecord(record.id, (current) => ({
    ...current,
    timezone,
    next_run_at: computeNextRunAt(current.cron_expression, timezone),
  }));
}

export function loadPersistedAutomations(
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const items = readAutomations().map(withAutomationDefaults);
  writeAutomations(items);
  for (const item of items) {
    if (item.status !== 'paused') {
      scheduleAutomationTask(item, onTrigger);
      if (item.next_run_at && Date.parse(item.next_run_at) <= Date.now()) {
        void executeAutomation(item, onTrigger);
      }
    }
  }
  return items;
}

export function ensureCoreAutomationSeeds(
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const current = readAutomations();
  const existingIds = new Set(current.map((item) => item.id));
  const now = new Date().toISOString();
  const additions = CORE_AUTOMATION_SEEDS
    .filter((seed) => !existingIds.has(seed.id))
    .map((seed) => withAutomationDefaults({
      ...seed,
      timezone: normalizeTimeZone(seed.timezone),
      created_at: now,
    }));

  if (additions.length > 0) {
    writeAutomations([...current, ...additions]);
  }

  const seeded = readAutomations()
    .map(withAutomationDefaults)
    .filter((item) => CORE_AUTOMATION_SEEDS.some((seed) => seed.id === item.id));

  for (const item of seeded) {
    if (item.status !== 'paused') {
      scheduleAutomationTask(item, onTrigger);
    }
  }

  return seeded;
}

export function listAutomations() {
  return readAutomations()
    .map(withAutomationDefaults)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

export function getAutomationById(id: string) {
  const record = readAutomations().find((item) => item.id === id) || null;
  return record ? withAutomationDefaults(record) : null;
}

export function updateAutomation(
  id: string,
  patch: Partial<Omit<AutomationRecord, 'id' | 'created_at'>>,
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const items = readAutomations();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const current = items[index];
  const nextSchedule = patch.schedule ?? current.schedule;
  const nextCronExpression =
    patch.cron_expression ??
    (patch.schedule && patch.schedule !== current.schedule ? normalizeSchedule(nextSchedule) : current.cron_expression);
  const timezone = normalizeTimeZone(typeof patch.timezone === 'string' ? patch.timezone : current.timezone);

  const updated: AutomationRecord = {
    ...current,
    ...patch,
    schedule: nextSchedule,
    cron_expression: nextCronExpression,
    timezone,
    status: patch.status ?? current.status,
  };

  updated.next_run_at = updated.status === 'paused'
    ? undefined
    : computeNextRunAt(updated.cron_expression, timezone);

  items[index] = updated;
  writeAutomations(items);
  scheduleAutomationTask(updated, onTrigger);
  return updated;
}

export function deleteAutomation(id: string) {
  const items = readAutomations();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const [removed] = items.splice(index, 1);
  writeAutomations(items);

  const existing = scheduledTasks.get(id);
  existing?.stop();
  existing?.destroy();
  scheduledTasks.delete(id);

  return removed;
}

export function triggerAutomationNow(
  id: string,
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const record = getAutomationById(id);
  if (!record) return null;
  void executeAutomation(record, onTrigger).catch((error) => {
    console.error(`[scheduler] manual trigger failed for ${id}`, error);
  });
  return record;
}

export function createAutomation(
  input: Omit<AutomationRecord, 'id' | 'cron_expression' | 'status' | 'created_at' | 'last_run_at' | 'last_run_status' | 'next_run_at'>,
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const cronExpression = normalizeSchedule(input.schedule);
  const timezone = normalizeTimeZone(input.timezone);
  const record = withAutomationDefaults({
    id: `auto_${Date.now()}`,
    version: input.steps?.length ? 2 : undefined,
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
    authoring_mode: input.authoring_mode,
    workflow_prompt: input.workflow_prompt,
    schedule: input.schedule,
    cron_expression: cronExpression,
    timezone,
    actions: input.actions,
    steps: input.steps,
    execution_policy: input.execution_policy,
    notify: input.notify,
    condition: input.condition,
    status: 'active',
    next_run_at: computeNextRunAt(cronExpression, timezone),
    created_at: new Date().toISOString(),
  });

  const items = readAutomations();
  items.push(record);
  writeAutomations(items);
  scheduleAutomationTask(record, onTrigger);
  return record;
}
