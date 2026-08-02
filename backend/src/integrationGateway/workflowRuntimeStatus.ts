import type { WorkflowRuntimeIntegrationStatus } from './workflowReadiness';
import {
  PARTNER_SOURCE_IDS,
  normalizeAppName,
  toolkitForPartnerSource,
  type PartnerSourceId,
} from './partnerAppMap';
import { SLACK_PARTNER_TOOLKITS } from './slackDelivery';
import { usesInternalDemoRouting } from '../platform/tenancy';

interface NativeIntegrationStatus {
  tavily: boolean;
  slack: boolean;
  postmark: boolean;
}

export interface BuildPartnerRuntimeStatusInput {
  connectedPartnerApps: string[];
  nativeStatus: NativeIntegrationStatus;
  /**
   * Whose workspace this status describes. Omitted means internal, which keeps
   * the pre-multi-tenant behavior for every existing caller.
   *
   * Slack readiness depends on it: our own and demo workspaces deliver through
   * the server bot token, while a tenant delivers through their own Composio
   * Slack connection, so "is Slack ready" is a different question for each.
   */
  workspaceId?: string;
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
 * Slack readiness for a tenant workspace.
 *
 * A tenant never delivers through `SLACK_BOT_TOKEN`, so the server's own Slack
 * configuration says nothing about whether their delivery can land. What
 * matters is whether they connected either Slack toolkit through Composio.
 */
function tenantSlackStatus(connected: Set<string>): WorkflowRuntimeIntegrationStatus {
  const hasSlack = SLACK_PARTNER_TOOLKITS.some((slug) => connected.has(normalizeAppName(slug)));
  return hasSlack
    ? { ready: true, detail: 'Slack is connected to this workspace.' }
    : {
        ready: false,
        code: 'integration_not_ready',
        detail:
          'Slack is not connected to this workspace. Violema delivers through your own Slack, '
          + 'never from its own workspace on your behalf.',
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
    slack: usesInternalDemoRouting(input.workspaceId)
      ? nativeStatus(input.nativeStatus.slack, 'Slack', 'delivery')
      : tenantSlackStatus(connected),
    postmark: nativeStatus(input.nativeStatus.postmark, 'Email', 'delivery'),
  };
}
