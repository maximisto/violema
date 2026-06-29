import { getWorkspaceSettingsView, type WorkspaceSettingsView } from '../settingsStore';

export interface WorkflowReadinessBlocker {
  key: string;
  label: string;
  detail: string;
  route?: string;
}

export interface WorkflowReadinessReport {
  workflowId: string;
  workspaceId: string;
  ready: boolean;
  summary: string;
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
  blockers: WorkflowReadinessBlocker[];
}

type MinimalIntegrationReadiness =
  | boolean
  | {
      configured?: boolean;
      workspaceConfigured?: boolean;
      envConfigured?: boolean;
      serverConfigured?: boolean;
      fields?: Record<string, {
        configured?: boolean;
        workspaceConfigured?: boolean;
        envConfigured?: boolean;
        serverConfigured?: boolean;
      }>;
    };

interface MinimalSettingsView {
  integrations?: Record<string, MinimalIntegrationReadiness>;
}

interface WorkflowRequirements {
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
}

function readConfiguredFlag(
  value:
    | {
        configured?: boolean;
        workspaceConfigured?: boolean;
        envConfigured?: boolean;
        serverConfigured?: boolean;
      }
    | undefined,
): boolean {
  return Boolean(
    value?.configured ||
    value?.workspaceConfigured ||
    value?.envConfigured ||
    value?.serverConfigured,
  );
}

function isConfigured(
  settingsView: WorkspaceSettingsView | MinimalSettingsView,
  id: string,
): boolean {
  const integrations = settingsView.integrations as Record<string, MinimalIntegrationReadiness | undefined> | undefined;
  const integration = integrations?.[id];

  if (!integration) return false;
  if (typeof integration === 'boolean') return integration;

  if (readConfiguredFlag(integration)) {
    return true;
  }

  if (!integration.fields) return false;

  return Object.values(integration.fields).some((field) => readConfiguredFlag(field));
}

function readWorkflowRequirements(workflowId: string): WorkflowRequirements {
  if (workflowId === 'revenue-watch') {
    return {
      requiredIntegrationIds: ['stripe'],
      optionalIntegrationIds: [],
      firstRunRequiresApproval: true,
    };
  }

  return {
    requiredIntegrationIds: [],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: false,
  };
}

export function checkWorkflowReadiness(input: {
  workflowId: string;
  workspaceId: string;
  deliveryTarget?: string | null;
  settingsView?: WorkspaceSettingsView | MinimalSettingsView;
}): WorkflowReadinessReport {
  const settingsView = input.settingsView || getWorkspaceSettingsView(input.workspaceId);
  const requirements = readWorkflowRequirements(input.workflowId);
  const blockers: WorkflowReadinessBlocker[] = [];

  if (requirements.requiredIntegrationIds.includes('stripe') && !isConfigured(settingsView, 'stripe')) {
    blockers.push({
      key: 'stripe',
      label: 'Connect Stripe',
      detail: 'Stripe read access is required before Revenue Watch can run with real data.',
      route: '/integrations?provider=stripe&workflow=revenue-watch',
    });
  }

  if (input.workflowId === 'revenue-watch' && !input.deliveryTarget?.trim()) {
    blockers.push({
      key: 'slack_target',
      label: 'Add Slack destination',
      detail: 'Revenue Watch needs a Slack target before it can be promoted to live delivery.',
    });
  }

  return {
    workflowId: input.workflowId,
    workspaceId: input.workspaceId,
    ready: blockers.length === 0,
    summary: blockers.length === 0
      ? 'Revenue Watch is ready for a sandbox run. First live delivery requires approval.'
      : `${blockers.length} readiness item${blockers.length === 1 ? '' : 's'} must be fixed before this workflow can run with real data.`,
    requiredIntegrationIds: requirements.requiredIntegrationIds,
    optionalIntegrationIds: requirements.optionalIntegrationIds,
    firstRunRequiresApproval: requirements.firstRunRequiresApproval,
    blockers,
  };
}
