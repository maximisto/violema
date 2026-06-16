export type MissionWorkspaceTab =
  | 'mission'
  | 'artifact'
  | 'agents'
  | 'board'
  | 'map'
  | 'reviews'
  | 'lessons'
  | 'calendar'
  | 'analytics';

export type MissionStatus =
  | 'planned'
  | 'running'
  | 'waiting_review'
  | 'failed'
  | 'completed'
  | 'paused';

export interface MissionStepView {
  id: string;
  title: string;
  objective: string;
  kind: string;
  status: MissionStatus;
  agentLabel: string;
  toolLabel?: string;
  estimatedCredits?: number;
  actualCredits?: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  summary?: string;
  error?: string;
}

export type MissionStep = MissionStepView;

export interface MissionAgentView {
  id: string;
  label: string;
  avatarLabel: string;
  role: string;
  status: 'done' | 'working' | 'queued' | 'waiting' | 'review' | 'ready';
  detail: string;
  creditsLabel?: string;
  sourceLabel?: string;
}

export type MissionAgent = MissionAgentView;

export interface MissionEvidenceItem {
  id: string;
  label: string;
  source: string;
  detail: string;
}

export interface MissionMetricView {
  label: string;
  value: string;
  detail: string;
  tone: 'violet' | 'cyan' | 'green' | 'amber' | 'slate';
}

export type MissionCreditMetric = MissionMetricView;

export interface MissionControlPrimitiveView {
  id: 'plan' | 'trust' | 'trace' | 'playbook' | 'delivery' | 'cost';
  label: string;
  value: string;
  detail: string;
  tone: 'violet' | 'cyan' | 'green' | 'amber' | 'slate';
}

export interface MissionIntegrationView {
  id: string;
  label: string;
  shortLabel: string;
  category: string;
}

export type MissionIntegration = MissionIntegrationView;

export interface MissionBoardColumn {
  id: string;
  label: string;
  steps: MissionStepView[];
  emptyLabel?: string;
}

export interface MissionCalendarItem {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  status: MissionStatus;
  detail?: string;
}

export interface MissionArtifactSectionView {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: 'violet' | 'cyan' | 'green' | 'amber' | 'slate';
}

export interface MissionArtifactView {
  title: string;
  kindLabel: string;
  sourceLabel: string;
  statusLabel: string;
  summary: string;
  lastUpdatedLabel: string;
  primaryActionLabel: string;
  skills: string[];
  sections: MissionArtifactSectionView[];
}

export type MissionLessonStatus = 'saved' | 'proposed' | 'waiting';

export interface MissionLessonView {
  id: string;
  title: string;
  detail: string;
  status: MissionLessonStatus;
  sourceLabel: string;
  actionLabel?: string;
}

export interface MissionWorkspaceView {
  id: string;
  title: string;
  description: string;
  status: MissionStatus;
  statusLabel: string;
  nextRunLabel: string;
  lastRunLabel: string;
  scheduleLabel: string;
  deliveryLabel: string;
  activeAgentId?: string;
  steps: MissionStepView[];
  agents: MissionAgentView[];
  evidence: MissionEvidenceItem[];
  metrics: MissionMetricView[];
  controlPrimitives: MissionControlPrimitiveView[];
  integrations: MissionIntegrationView[];
  artifact: MissionArtifactView;
  lessons: MissionLessonView[];
  reviewSummary: string;
  analyticsSummary: string;
}
