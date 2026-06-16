import { buildFounderOpsCalendar } from '../src/features/missions/missionCalendarSchedule';
import type { MissionWorkspaceView } from '../src/features/missions/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const mission: MissionWorkspaceView = {
  id: 'weekly_founder_update',
  title: 'Weekly founder update',
  description: 'Founder operating brief with revenue, product, and follow-up signals.',
  status: 'running',
  statusLabel: 'Running',
  nextRunLabel: 'Tue, 9:00 AM',
  lastRunLabel: 'Jun 15, 9:04 AM',
  scheduleLabel: 'Every Tuesday at 9:00 AM',
  deliveryLabel: '#founders',
  activeAgentId: 'researcher',
  steps: [],
  agents: [
    {
      id: 'researcher',
      label: 'Researcher',
      avatarLabel: 'RS',
      role: 'research',
      status: 'working',
      detail: 'Scanning market signals.',
    },
    {
      id: 'finance',
      label: 'Finance Analyst',
      avatarLabel: 'FA',
      role: 'finance',
      status: 'queued',
      detail: 'Checking revenue.',
    },
  ],
  evidence: [],
  metrics: [
    { label: 'Credits', value: '44 cr', detail: 'actual run cost', tone: 'violet' },
  ],
  controlPrimitives: [],
  integrations: [
    { id: 'slack', label: 'Slack', shortLabel: 'SL', category: 'Delivery' },
    { id: 'stripe', label: 'Stripe', shortLabel: 'S', category: 'Revenue' },
    { id: 'github', label: 'GitHub', shortLabel: 'GH', category: 'Product' },
  ],
  artifact: {
    title: 'Founder brief',
    kindLabel: 'Brief',
    sourceLabel: 'Run output',
    statusLabel: 'Living artifact',
    summary: 'Founder-ready update.',
    lastUpdatedLabel: 'Jun 15',
    primaryActionLabel: 'Open artifact',
    skills: [],
    sections: [],
  },
  lessons: [],
  reviewSummary: 'Review before delivery.',
  analyticsSummary: 'Tracked at 44 credits.',
};

const calendar = buildFounderOpsCalendar(mission, new Date('2026-06-16T12:00:00'));

assert(calendar.weekDays.length === 7, 'builds a seven day week rail');
assert(calendar.weekDays.some((day) => day.isToday), 'marks the current day');
assert(calendar.weekDays.some((day) => day.tones.includes('revenue')), 'week rail carries colorful workload tones');
assert(calendar.agenda.length >= 6, 'builds a full founder ops agenda');
assert(calendar.agenda[0].title === 'Weekly founder update', 'keeps the mission as the primary agenda item');
assert(calendar.agenda[0].status === 'live', 'maps running mission status to live calendar status');
assert(calendar.agenda[0].apps.some((app) => app.label === 'Slack'), 'primary item includes mission integrations');
assert(calendar.agenda[0].agents.some((agent) => agent.avatarLabel === 'RS'), 'primary item includes mission agent avatars');
assert(calendar.agenda.some((item) => item.title === 'Email + calendar follow-up'), 'includes future email and calendar automation');
assert(calendar.stack.some((app) => app.label === 'Google Calendar'), 'connected stack includes calendar integration logo');
assert(calendar.stack.some((app) => app.label === 'Gmail'), 'connected stack includes email integration logo');
