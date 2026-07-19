import type { WorkflowRuntimeIntegrationStatus } from './workflowReadiness';

interface NativeIntegrationStatus {
  tavily: boolean;
  slack: boolean;
  postmark: boolean;
}

export interface BuildWeeklyFounderRuntimeStatusInput {
  connectedPartnerApps: string[];
  nativeStatus: NativeIntegrationStatus;
}

function normalizeAppName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function partnerStatus(
  connected: Set<string>,
  toolkit: string,
  label: string,
): WorkflowRuntimeIntegrationStatus {
  if (connected.has(normalizeAppName(toolkit))) {
    return {
      ready: true,
      detail: `${label} is connected to this workspace.`,
    };
  }
  return {
    ready: false,
    code: 'integration_not_ready',
    detail: `${label} is not connected to this workspace.`,
  };
}

function nativeStatus(
  ready: boolean,
  label: string,
  capability: string,
): WorkflowRuntimeIntegrationStatus {
  const subject = [label, capability].filter(Boolean).join(' ');
  return ready
    ? {
        ready: true,
        detail: `${subject} is configured on the server.`,
      }
    : {
        ready: false,
        code: 'integration_not_ready',
        detail: `${subject} is not configured on the server.`,
      };
}

export function buildWeeklyFounderRuntimeStatus(
  input: BuildWeeklyFounderRuntimeStatusInput,
): Record<string, WorkflowRuntimeIntegrationStatus> {
  const connected = new Set(input.connectedPartnerApps.map(normalizeAppName));
  return {
    email: partnerStatus(connected, 'gmail', 'Gmail'),
    calendar: partnerStatus(connected, 'googlecalendar', 'Google Calendar'),
    google_drive: partnerStatus(connected, 'googledrive', 'Google Drive'),
    linear: partnerStatus(connected, 'linear', 'Linear'),
    github: partnerStatus(connected, 'github', 'GitHub'),
    tavily: nativeStatus(input.nativeStatus.tavily, 'Web search', ''),
    slack: nativeStatus(input.nativeStatus.slack, 'Slack', 'delivery'),
    postmark: nativeStatus(input.nativeStatus.postmark, 'Email', 'delivery'),
  };
}
