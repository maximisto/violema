import { normalizeComposioAppName } from '../composioBridge';
import { getWorkspaceSettingsView, type WorkspaceSettingsView } from '../settingsStore';
import { isValidGithubRepository } from './adapters/nativeGithub';

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
  supported: boolean;
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
  defaultDeliveryTarget?: string;
}

const REVENUE_WATCH_DEFAULT_DELIVERY_TARGET = '#all-purple-orange';
const WORKFLOW_REQUIREMENTS: Record<string, WorkflowRequirements> = {
  'revenue-watch': {
    supported: true,
    requiredIntegrationIds: ['stripe'],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: true,
    defaultDeliveryTarget: REVENUE_WATCH_DEFAULT_DELIVERY_TARGET,
  },
  'weekly-founder-brief': {
    supported: true,
    requiredIntegrationIds: ['stripe', 'github', 'gmail', 'google_calendar'],
    optionalIntegrationIds: ['google_drive', 'linear', 'notion', 'web_search'],
    firstRunRequiresApproval: true,
    defaultDeliveryTarget: REVENUE_WATCH_DEFAULT_DELIVERY_TARGET,
  },
  'investor-follow-up': {
    supported: true,
    requiredIntegrationIds: ['gmail', 'google_calendar'],
    optionalIntegrationIds: ['google_drive'],
    firstRunRequiresApproval: true,
  },
  'monthly-investor-update': {
    supported: true,
    requiredIntegrationIds: ['stripe', 'github', 'google_drive'],
    optionalIntegrationIds: ['gmail'],
    firstRunRequiresApproval: true,
  },
  'shipping-revenue-pulse': {
    supported: true,
    requiredIntegrationIds: ['stripe', 'github'],
    optionalIntegrationIds: ['linear', 'web_search'],
    firstRunRequiresApproval: true,
    defaultDeliveryTarget: REVENUE_WATCH_DEFAULT_DELIVERY_TARGET,
  },
  'board-packet-prep': {
    supported: true,
    requiredIntegrationIds: ['google_drive', 'google_calendar'],
    optionalIntegrationIds: ['stripe', 'github'],
    firstRunRequiresApproval: true,
  },
};

const WORKFLOW_DISPLAY_NAMES: Record<string, string> = {
  'revenue-watch': 'Revenue Watch',
  'weekly-founder-brief': 'Weekly Founder Brief',
  'investor-follow-up': 'Investor Follow-up',
  'monthly-investor-update': 'Monthly Investor Update',
  'shipping-revenue-pulse': 'Shipping Revenue Pulse',
  'board-packet-prep': 'Board Packet Prep',
};

const INTEGRATION_SETUP: Record<string, { label: string; route: (workflowId: string) => string; detail: string }> = {
  stripe: {
    label: 'Connect Stripe',
    route: () => '/integrations?provider=stripe&workflow=revenue-watch',
    detail: 'Stripe read access is required before this workflow can run with real revenue data.',
  },
  github: {
    label: 'Connect GitHub',
    route: () => '/settings#integration-github',
    detail: 'GitHub repository access is required before this workflow can read delivery and issue signals.',
  },
  gmail: {
    label: 'Connect Gmail',
    route: (workflowId) => `/integrations?provider=gmail&workflow=${workflowId}`,
    detail: 'Gmail access is required before this workflow can identify commitments and unreplied threads.',
  },
  google_calendar: {
    label: 'Connect Google Calendar',
    route: (workflowId) => `/integrations?provider=google_calendar&workflow=${workflowId}`,
    detail: 'Google Calendar access is required before this workflow can read meeting and deadline context.',
  },
  google_drive: {
    label: 'Connect Google Drive',
    route: (workflowId) => `/integrations?provider=google_drive&workflow=${workflowId}`,
    detail: 'Google Drive access is required before this workflow can read selected document source material.',
  },
};

const PARTNER_ALIASES: Record<string, string[]> = {
  gmail: ['gmail'],
  google_calendar: ['google_calendar', 'googlecalendar'],
  google_drive: ['google_drive', 'googledrive'],
  linear: ['linear'],
  notion: ['notion'],
};

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
  return WORKFLOW_REQUIREMENTS[workflowId] || {
    supported: false,
    requiredIntegrationIds: [],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: false,
  };
}

function getWorkflowDisplayName(workflowId: string): string {
  return WORKFLOW_DISPLAY_NAMES[workflowId] || workflowId;
}

function hasPartnerConnection(provider: string, connectedPartnerApps: string[] = []) {
  const normalized = new Set(connectedPartnerApps.map((item) => normalizeComposioAppName(item)));
  return (PARTNER_ALIASES[provider] || []).some((alias) => normalized.has(alias));
}

function isRequirementConfigured(input: {
  settingsView: WorkspaceSettingsView | MinimalSettingsView;
  id: string;
  connectedPartnerApps?: string[];
}) {
  if (isConfigured(input.settingsView, input.id)) return true;
  return hasPartnerConnection(input.id, input.connectedPartnerApps);
}

export function checkWorkflowReadiness(input: {
  workflowId: string;
  workspaceId: string;
  deliveryTarget?: string | null;
  settingsView?: WorkspaceSettingsView | MinimalSettingsView;
  connectedPartnerApps?: string[];
  env?: Record<string, string | undefined>;
}): WorkflowReadinessReport {
  const settingsView = input.settingsView || getWorkspaceSettingsView(input.workspaceId);
  const requirements = readWorkflowRequirements(input.workflowId);
  const env = input.env || process.env;
  const blockers: WorkflowReadinessBlocker[] = [];
  const deliveryTarget =
    input.deliveryTarget === undefined || input.deliveryTarget === null
      ? requirements.defaultDeliveryTarget
      : input.deliveryTarget;

  if (!requirements.supported) {
    blockers.push({
      key: 'unsupported_workflow',
      label: 'Unsupported workflow',
      detail: `Workflow "${input.workflowId}" is not supported by the readiness service.`,
    });
  }

  for (const integrationId of requirements.requiredIntegrationIds) {
    if (isRequirementConfigured({
      settingsView,
      id: integrationId,
      connectedPartnerApps: input.connectedPartnerApps,
    })) {
      if (integrationId === 'github') {
        const repository = env.GITHUB_DEFAULT_REPOSITORY?.trim() || '';
        if (!repository || !isValidGithubRepository(repository)) {
          blockers.push({
            key: 'github_repository',
            label: 'Select GitHub repository',
            detail: 'GitHub repository scope is required before this workflow can read delivery and issue signals.',
            route: INTEGRATION_SETUP.github.route(input.workflowId),
          });
        }
      }
      continue;
    }

    const setup = INTEGRATION_SETUP[integrationId];
    blockers.push({
      key: integrationId,
      label: setup?.label || `Configure ${integrationId}`,
      detail: setup?.detail || `${integrationId} access is required before this workflow can run.`,
      route: setup?.route(input.workflowId),
    });
  }

  if (requirements.supported && input.workflowId === 'revenue-watch' && !deliveryTarget?.trim()) {
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
    summary: !requirements.supported
      ? `Unsupported workflow: ${input.workflowId}.`
      : blockers.length === 0
        ? `${getWorkflowDisplayName(input.workflowId)} is ready for a sandbox run. First live delivery requires approval.`
        : `${blockers.length} readiness item${blockers.length === 1 ? '' : 's'} must be fixed before this workflow can run with real data.`,
    requiredIntegrationIds: requirements.requiredIntegrationIds,
    optionalIntegrationIds: requirements.optionalIntegrationIds,
    firstRunRequiresApproval: requirements.firstRunRequiresApproval,
    blockers,
  };
}
