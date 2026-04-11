import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';
import type { AutomationExecutionPolicy, AutomationStepKind, PersistedAutomationStep } from './platform/types';

export interface AutomationStudioExperimentRecord {
  id: string;
  scenarioId: string;
  previewPresetId: string;
  createdAt: string;
  notes?: string;
}

export interface AutomationRoleDirective {
  mode: 'cheaper' | 'review' | 'promote';
  phases?: AutomationStepKind[];
  updatedAt: string;
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
  next_run_at?: string;
  created_at: string;
}

const AUTOMATIONS_FILE = path.join(process.cwd(), 'automations.json');
const scheduledTasks = new Map<string, ScheduledTask>();
const DEFAULT_AUTOMATION_TIMEZONE = process.env.DEFAULT_AUTOMATION_TIMEZONE || 'UTC';

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
  const next = updater(items[index]);
  items[index] = next;
  writeAutomations(items);
  return next;
}

function withAutomationDefaults(record: AutomationRecord): AutomationRecord {
  const timezone = normalizeTimeZone(record.timezone);
  return {
    ...record,
    timezone,
    next_run_at: record.status === 'paused'
      ? undefined
      : record.next_run_at || computeNextRunAt(record.cron_expression, timezone),
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

  if (cron.validate(normalized)) {
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

async function executeAutomation(
  record: AutomationRecord,
  onTrigger: (record: AutomationRecord) => Promise<{ ok: boolean; error?: string } | void>
) {
  const startedAt = new Date().toISOString();
  const timezone = normalizeTimeZone(record.timezone);
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
  const task = cron.schedule(record.cron_expression, () => {
    void executeAutomation({ ...record, timezone }, onTrigger);
  }, { timezone });

  scheduledTasks.set(record.id, task);
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
  const record: AutomationRecord = {
    id: `auto_${Date.now()}`,
    version: input.steps?.length ? 2 : undefined,
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
  };

  const items = readAutomations();
  items.push(record);
  writeAutomations(items);
  scheduleAutomationTask(record, onTrigger);
  return record;
}
