import type { WorkflowRuntimeIntegrationStatus } from './workflowReadiness';
import {
  PARTNER_SOURCE_IDS,
  normalizeAppName,
  toolkitForPartnerSource,
  type PartnerSourceId,
} from './partnerAppMap';

interface NativeIntegrationStatus {
  tavily: boolean;
  slack: boolean;
  postmark: boolean;
}

export interface BuildPartnerRuntimeStatusInput {
  connectedPartnerApps: string[];
  nativeStatus: NativeIntegrationStatus;
}

const PARTNER_SOURCE_LABELS: Record<PartnerSourceId, string> = {
  email: 'Gmail',
  calendar: 'Google Calendar',
  google_drive: 'Google Drive',
  linear: 'Linear',
  github: 'GitHub',
};

function partnerStatus(
  connected: Set<string>,
  source: PartnerSourceId,
): WorkflowRuntimeIntegrationStatus {
  const label = PARTNER_SOURCE_LABELS[source];
  if (connected.has(normalizeAppName(toolkitForPartnerSource(source)))) {
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

/**
 * Turn a workspace's connected Composio toolkits plus the server's native
 * integration state into the per-source readiness map the readiness report
 * consumes. Partner slugs come from `partnerAppMap`, so a toolkit rename is a
 * one-line change there rather than a silent mismatch here.
 */
export function buildPartnerRuntimeStatus(
  input: BuildPartnerRuntimeStatusInput,
): Record<string, WorkflowRuntimeIntegrationStatus> {
  const connected = new Set(input.connectedPartnerApps.map(normalizeAppName));
  const partner = Object.fromEntries(
    PARTNER_SOURCE_IDS.map((source) => [source, partnerStatus(connected, source)]),
  );
  return {
    ...partner,
    tavily: nativeStatus(input.nativeStatus.tavily, 'Web search', ''),
    slack: nativeStatus(input.nativeStatus.slack, 'Slack', 'delivery'),
    postmark: nativeStatus(input.nativeStatus.postmark, 'Email', 'delivery'),
  };
}
