import fs from 'fs';
import path from 'path';
import cron, { ScheduledTask } from 'node-cron';

export interface AutomationRecord {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  cron_expression: string;
  actions: string[];
  notify?: string;
  condition?: string;
  status: 'active';
  created_at: string;
}

const AUTOMATIONS_FILE = path.join(process.cwd(), 'automations.json');
const scheduledTasks = new Map<string, ScheduledTask>();

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

function scheduleAutomationTask(record: AutomationRecord, onTrigger: (record: AutomationRecord) => Promise<void> | void) {
  const existing = scheduledTasks.get(record.id);
  existing?.stop();
  existing?.destroy();

  const task = cron.schedule(record.cron_expression, () => {
    void onTrigger(record);
  });

  scheduledTasks.set(record.id, task);
}

export function loadPersistedAutomations(onTrigger: (record: AutomationRecord) => Promise<void> | void) {
  const items = readAutomations();
  for (const item of items) {
    scheduleAutomationTask(item, onTrigger);
  }
  return items;
}

export function createAutomation(
  input: Omit<AutomationRecord, 'id' | 'cron_expression' | 'status' | 'created_at'>,
  onTrigger: (record: AutomationRecord) => Promise<void> | void
) {
  const cronExpression = normalizeSchedule(input.schedule);
  const record: AutomationRecord = {
    id: `auto_${Date.now()}`,
    name: input.name,
    description: input.description,
    schedule: input.schedule,
    cron_expression: cronExpression,
    actions: input.actions,
    notify: input.notify,
    condition: input.condition,
    status: 'active',
    created_at: new Date().toISOString(),
  };

  const items = readAutomations();
  items.push(record);
  writeAutomations(items);
  scheduleAutomationTask(record, onTrigger);
  return record;
}
