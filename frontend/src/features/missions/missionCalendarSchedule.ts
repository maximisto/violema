import type { MissionAgentView, MissionStatus, MissionWorkspaceView } from './types';

export type FounderCalendarTone =
  | 'strategy'
  | 'research'
  | 'revenue'
  | 'product'
  | 'delivery'
  | 'approval'
  | 'people';

export type FounderCalendarStatus = 'live' | 'queued' | 'review' | 'scheduled' | 'done' | 'paused';

export interface FounderCalendarApp {
  id: string;
  label: string;
  logoLabel: string;
  tone: FounderCalendarTone;
}

export interface FounderCalendarAgent {
  id: string;
  label: string;
  avatarLabel: string;
  tone: FounderCalendarTone;
}

export interface FounderCalendarAgendaItem {
  id: string;
  title: string;
  detail: string;
  dayOffset: number;
  timeLabel: string;
  durationLabel: string;
  recurrenceLabel: string;
  status: FounderCalendarStatus;
  tone: FounderCalendarTone;
  apps: FounderCalendarApp[];
  agents: FounderCalendarAgent[];
  creditLabel: string;
  actionLabel: string;
}

export interface FounderCalendarDay {
  id: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  loadLabel: string;
  tones: FounderCalendarTone[];
}

export interface FounderOpsCalendar {
  weekDays: FounderCalendarDay[];
  agenda: FounderCalendarAgendaItem[];
  stack: FounderCalendarApp[];
}

const APP_TONES: Record<string, FounderCalendarTone> = {
  slack: 'delivery',
  stripe: 'revenue',
  github: 'product',
  linear: 'product',
  gmail: 'people',
  outlook: 'people',
  googlecalendar: 'strategy',
  calendar: 'strategy',
  googledrive: 'research',
  drive: 'research',
  notion: 'strategy',
  hubspot: 'revenue',
};

const FALLBACK_STACK: FounderCalendarApp[] = [
  { id: 'stripe', label: 'Stripe', logoLabel: 'S', tone: 'revenue' },
  { id: 'github', label: 'GitHub', logoLabel: 'GH', tone: 'product' },
  { id: 'slack', label: 'Slack', logoLabel: 'SL', tone: 'delivery' },
  { id: 'gmail', label: 'Gmail', logoLabel: 'G', tone: 'people' },
  { id: 'google-calendar', label: 'Google Calendar', logoLabel: 'Cal', tone: 'strategy' },
  { id: 'drive', label: 'Google Drive', logoLabel: 'D', tone: 'research' },
  { id: 'notion', label: 'Notion', logoLabel: 'N', tone: 'strategy' },
  { id: 'hubspot', label: 'HubSpot', logoLabel: 'H', tone: 'revenue' },
];

function normalizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function appFromLabel(label: string, fallbackLabel?: string): FounderCalendarApp {
  const id = normalizeId(label);
  return {
    id,
    label,
    logoLabel: fallbackLabel || label.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(),
    tone: APP_TONES[id] || 'research',
  };
}

function uniqueApps(apps: FounderCalendarApp[]) {
  const seen = new Set<string>();
  return apps.filter((app) => {
    if (seen.has(app.id)) return false;
    seen.add(app.id);
    return true;
  });
}

function statusFromMission(status: MissionStatus): FounderCalendarStatus {
  if (status === 'running') return 'live';
  if (status === 'waiting_review') return 'review';
  if (status === 'completed') return 'done';
  if (status === 'paused') return 'paused';
  return 'scheduled';
}

function agentTone(index: number): FounderCalendarTone {
  const tones: FounderCalendarTone[] = ['strategy', 'research', 'product', 'revenue', 'delivery', 'approval'];
  return tones[index % tones.length];
}

function missionAgents(mission: MissionWorkspaceView, fallback: FounderCalendarAgent[]) {
  const agents = mission.agents.slice(0, 4).map((agent, index) => ({
    id: agent.id,
    label: agent.label,
    avatarLabel: agent.avatarLabel,
    tone: agentTone(index),
  }));
  return agents.length > 0 ? agents : fallback;
}

function fallbackAgent(id: string, label: string, avatarLabel: string, tone: FounderCalendarTone): FounderCalendarAgent {
  return { id, label, avatarLabel, tone };
}

function buildWeekDays(agenda: FounderCalendarAgendaItem[], now: Date): FounderCalendarDay[] {
  const start = new Date(now);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const items = agenda.filter((item) => item.dayOffset === index);
    const tones = Array.from(new Set(items.map((item) => item.tone)));
    const isToday = day.toDateString() === now.toDateString();

    return {
      id: `day_${index}`,
      weekdayLabel: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day),
      dateLabel: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(day),
      isToday,
      loadLabel: items.length === 1 ? '1 run' : `${items.length} runs`,
      tones,
    };
  });
}

export function buildFounderOpsCalendar(mission: MissionWorkspaceView, now = new Date()): FounderOpsCalendar {
  const integrationApps = mission.integrations.map((integration) => appFromLabel(integration.label, integration.shortLabel));
  const stack = uniqueApps([...integrationApps, ...FALLBACK_STACK]).slice(0, 8);
  const primaryApps = uniqueApps([...integrationApps, ...FALLBACK_STACK]).slice(0, 4);
  const creditMetricValue = mission.metrics.find((metric) => metric.label === 'Credits')?.value;
  const missionCreditLabel = creditMetricValue
    ? /\bcr\b/i.test(creditMetricValue) ? creditMetricValue : `${creditMetricValue} cr`
    : 'est. 48 cr';
  const primaryAgents = missionAgents(mission, [
    fallbackAgent('operator', 'Operator', 'OP', 'strategy'),
    fallbackAgent('research', 'Research', 'RS', 'research'),
    fallbackAgent('review', 'Reviewer', 'RV', 'approval'),
  ]);

  const agenda: FounderCalendarAgendaItem[] = [
    {
      id: `${mission.id}_primary`,
      title: mission.title,
      detail: mission.description || mission.reviewSummary,
      dayOffset: 1,
      timeLabel: mission.nextRunLabel,
      durationLabel: '38 min',
      recurrenceLabel: mission.scheduleLabel,
      status: statusFromMission(mission.status),
      tone: 'strategy',
      apps: primaryApps,
      agents: primaryAgents,
      creditLabel: missionCreditLabel,
      actionLabel: mission.status === 'waiting_review' ? 'Review' : 'Run',
    },
    {
      id: 'stripe_revenue_check',
      title: 'Stripe revenue check',
      detail: 'Revenue, churn movement, plan mix, and invoice exceptions before the founder brief.',
      dayOffset: 1,
      timeLabel: '9:35 AM',
      durationLabel: '12 min',
      recurrenceLabel: 'Weekdays',
      status: 'queued',
      tone: 'revenue',
      apps: [appFromLabel('Stripe', 'S'), appFromLabel('HubSpot', 'H')],
      agents: [
        fallbackAgent('finance', 'Finance', 'FA', 'revenue'),
        fallbackAgent('reviewer', 'Reviewer', 'RV', 'approval'),
      ],
      creditLabel: '18 cr',
      actionLabel: 'Open',
    },
    {
      id: 'github_issue_triage',
      title: 'GitHub issue triage',
      detail: 'Cluster issues, identify blockers, and draft a product priority note.',
      dayOffset: 2,
      timeLabel: '10:10 AM',
      durationLabel: '22 min',
      recurrenceLabel: 'Tue / Thu',
      status: 'scheduled',
      tone: 'product',
      apps: [appFromLabel('GitHub', 'GH'), appFromLabel('Linear', 'L')],
      agents: [
        fallbackAgent('product', 'Product', 'PM', 'product'),
        fallbackAgent('engineer', 'Engineer', 'EN', 'research'),
      ],
      creditLabel: '31 cr',
      actionLabel: 'Plan',
    },
    {
      id: 'slack_digest',
      title: 'Slack team digest',
      detail: 'Summarize team threads, extract decisions, and prep follow-up tasks.',
      dayOffset: 3,
      timeLabel: '4:30 PM',
      durationLabel: '16 min',
      recurrenceLabel: 'Daily',
      status: 'scheduled',
      tone: 'delivery',
      apps: [appFromLabel('Slack', 'SL'), appFromLabel('Notion', 'N')],
      agents: [
        fallbackAgent('messenger', 'Messenger', 'MS', 'delivery'),
        fallbackAgent('writer', 'Writer', 'WR', 'strategy'),
      ],
      creditLabel: '24 cr',
      actionLabel: 'Draft',
    },
    {
      id: 'email_calendar_followup',
      title: 'Email + calendar follow-up',
      detail: 'Find unanswered founder threads, propose replies, and schedule next touchpoints.',
      dayOffset: 4,
      timeLabel: '11:45 AM',
      durationLabel: '20 min',
      recurrenceLabel: 'Mon / Wed / Fri',
      status: 'review',
      tone: 'people',
      apps: [appFromLabel('Gmail', 'G'), appFromLabel('Outlook', 'O'), appFromLabel('Google Calendar', 'Cal')],
      agents: [
        fallbackAgent('scheduler', 'Scheduler', 'SC', 'people'),
        fallbackAgent('operator', 'Operator', 'OP', 'strategy'),
      ],
      creditLabel: '27 cr',
      actionLabel: 'Review',
    },
    {
      id: 'investor_update_prep',
      title: 'Investor update prep',
      detail: 'Pull wins, risks, asks, runway notes, and proof links into a clean draft.',
      dayOffset: 5,
      timeLabel: '2:00 PM',
      durationLabel: '45 min',
      recurrenceLabel: 'Monthly',
      status: 'scheduled',
      tone: 'approval',
      apps: [appFromLabel('Google Drive', 'D'), appFromLabel('Notion', 'N'), appFromLabel('Gmail', 'G')],
      agents: [
        fallbackAgent('research', 'Research', 'RS', 'research'),
        fallbackAgent('writer', 'Writer', 'WR', 'strategy'),
        fallbackAgent('reviewer', 'Reviewer', 'RV', 'approval'),
      ],
      creditLabel: '62 cr',
      actionLabel: 'Queue',
    },
  ];

  return {
    weekDays: buildWeekDays(agenda, now),
    agenda,
    stack,
  };
}
