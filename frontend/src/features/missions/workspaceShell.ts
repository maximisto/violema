import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square.js';
import Kanban from 'lucide-react/dist/esm/icons/kanban.js';
import Network from 'lucide-react/dist/esm/icons/network.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import Plug from 'lucide-react/dist/esm/icons/plug.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';

export type WorkspaceAreaId =
  | 'home'
  | 'missions'
  | 'board'
  | 'map'
  | 'reviews'
  | 'calendar'
  | 'analytics'
  | 'integrations'
  | 'advanced';

export type WorkspaceTabId =
  | 'chat'
  | 'activity'
  | 'overview'
  | 'artifact'
  | 'agents'
  | 'steps'
  | 'evidence'
  | 'lessons'
  | 'controls'
  | 'active'
  | 'waiting'
  | 'review'
  | 'done'
  | 'workflow'
  | 'integrations'
  | 'tools'
  | 'mcp'
  | 'approvals'
  | 'outputs'
  | 'upcoming'
  | 'recurring'
  | 'history'
  | 'credits'
  | 'efficiency'
  | 'run-cost'
  | 'forecast'
  | 'core'
  | 'suites'
  | 'debug'
  | 'replay'
  | 'optimize';

export interface WorkspaceAreaConfig {
  id: WorkspaceAreaId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof MessageSquare;
  defaultTab: WorkspaceTabId;
  tabs: Array<{ id: WorkspaceTabId; label: string }>;
}

export const WORKSPACE_AREAS: WorkspaceAreaConfig[] = [
  {
    id: 'home',
    label: 'Home / Chat',
    shortLabel: 'Chat',
    description: 'Command Violema and keep the current conversation clean.',
    icon: MessageSquare,
    defaultTab: 'chat',
    tabs: [
      { id: 'chat', label: 'Chat' },
      { id: 'activity', label: 'Activity' },
    ],
  },
  {
    id: 'missions',
    label: 'Missions',
    shortLabel: 'Missions',
    description: 'See the active automation as a mission with steps, agents, evidence, and controls.',
    icon: CheckSquare,
    defaultTab: 'overview',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'artifact', label: 'Artifact' },
      { id: 'agents', label: 'Agents' },
      { id: 'steps', label: 'Steps' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'lessons', label: 'Lessons' },
      { id: 'controls', label: 'Schedule' },
    ],
  },
  {
    id: 'board',
    label: 'Board',
    shortLabel: 'Board',
    description: 'Manage mission work by status.',
    icon: Kanban,
    defaultTab: 'active',
    tabs: [
      { id: 'active', label: 'Active' },
      { id: 'waiting', label: 'Waiting' },
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done' },
    ],
  },
  {
    id: 'map',
    label: 'Map',
    shortLabel: 'Map',
    description: 'Inspect workflow steps, tools, integrations, and future MCP connections.',
    icon: Network,
    defaultTab: 'workflow',
    tabs: [
      { id: 'workflow', label: 'Workflow' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'tools', label: 'Tools' },
      { id: 'mcp', label: 'MCP' },
    ],
  },
  {
    id: 'reviews',
    label: 'Reviews',
    shortLabel: 'Reviews',
    description: 'Review outputs, approvals, and source-linked evidence.',
    icon: Eye,
    defaultTab: 'approvals',
    tabs: [
      { id: 'approvals', label: 'Approvals' },
      { id: 'evidence', label: 'Evidence' },
      { id: 'outputs', label: 'Outputs' },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    shortLabel: 'Calendar',
    description: 'Schedule recurring work and review upcoming runs.',
    icon: CalendarDays,
    defaultTab: 'upcoming',
    tabs: [
      { id: 'upcoming', label: 'Upcoming' },
      { id: 'recurring', label: 'Recurring' },
      { id: 'history', label: 'History' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    description: 'Understand credit use, efficiency, run cost, and forecast.',
    icon: CreditCard,
    defaultTab: 'credits',
    tabs: [
      { id: 'credits', label: 'Credits' },
      { id: 'efficiency', label: 'Efficiency' },
      { id: 'run-cost', label: 'Run cost' },
      { id: 'forecast', label: 'Forecast' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    shortLabel: 'Integrations',
    description: 'Connect the founder stack and prepare future suite/MCP expansion.',
    icon: Plug,
    defaultTab: 'core',
    tabs: [
      { id: 'core', label: 'Core' },
      { id: 'suites', label: 'Suites' },
      { id: 'mcp', label: 'MCP' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    shortLabel: 'Advanced',
    description: 'Open the deeper replay, optimization, and diagnostics layer.',
    icon: Bot,
    defaultTab: 'debug',
    tabs: [
      { id: 'debug', label: 'Debug' },
      { id: 'replay', label: 'Replay' },
      { id: 'optimize', label: 'Optimize' },
    ],
  },
];

export function getWorkspaceArea(id: WorkspaceAreaId) {
  return WORKSPACE_AREAS.find((area) => area.id === id) || WORKSPACE_AREAS[0];
}
