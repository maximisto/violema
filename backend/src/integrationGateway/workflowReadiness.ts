import { getWorkspaceSettingsView, type WorkspaceSettingsView } from '../settingsStore';
import {
  canUseServerIntegrationCredentials,
  usesInternalDemoRouting,
} from '../platform/tenancy';
import { listWorkspaces } from '../platform/workspace';

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
  /**
   * Where this workflow would actually deliver: the caller's explicit target,
   * or the resolved default for this workspace — the demo channel for internal
   * and demo workspaces, the workspace owner's email for a tenant. `null` when
   * there is none, which is always accompanied by a delivery blocker.
   *
   * Surfaced so the destination is inspectable rather than implicit; a tenant
   * should be able to see that their brief goes to their own address.
   */
  deliveryTarget: string | null;
  blockers: WorkflowReadinessBlocker[];
  warnings: WorkflowReadinessBlocker[];
}

export interface WorkflowRuntimeIntegrationStatus {
  ready: boolean;
  detail?: string;
  code?:
    | 'integration_not_ready'
    | 'integration_scope_insufficient'
    | 'integration_query_failed';
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

export interface MinimalSettingsView {
  integrations?: Record<string, MinimalIntegrationReadiness>;
}

interface WorkflowRequirements {
  supported: boolean;
  requiredIntegrationIds: string[];
  optionalIntegrationIds: string[];
  firstRunRequiresApproval: boolean;
  defaultDeliveryTarget?: string;
}

// Raise-period reroute: founder-report defaults land in the demo channel
// until the pre-seed closes. Revert to '#all-purple-orange' after.
//
// These are OUR channels, so they default only for our own and demo workspaces.
// A tenant defaults to their owner's email instead — see `defaultDeliveryTarget`.
const REVENUE_WATCH_DEFAULT_DELIVERY_TARGET = '#violema-demo';
const WEEKLY_FOUNDER_UPDATE_DEFAULT_DELIVERY_TARGET = '#violema-demo';

/**
 * Where a workspace's report goes when the automation names no destination.
 *
 * Internal and demo workspaces keep the demo channel. A tenant has no Slack
 * story until they connect one, so the honest default is the address we already
 * know reaches them: the workspace owner's email. With no owner on file we
 * return nothing, and the caller raises the delivery-target blocker rather than
 * inventing a destination.
 *
 * Read-only lookup on purpose — `getWorkspaceProfile` would create and persist a
 * missing profile, and a readiness check must never write.
 */
function defaultDeliveryTarget(workspaceId: string, internalDefault: string): string | undefined {
  if (usesInternalDemoRouting(workspaceId)) return internalDefault;
  return resolveTenantDefaultDeliveryTarget(workspaceId);
}

/**
 * The delivery destination a tenant workspace falls back to when a mission has
 * no explicit target: the workspace owner's email. Exported because EXECUTION
 * must apply the same default the readiness report advertises — a mission that
 * reads "delivers to founder@…" and then silently skips delivery is a lie.
 * Internal/demo workspaces return nothing here; their defaults are workflow-
 * specific and stay in this module's requirements table.
 */
export function resolveTenantDefaultDeliveryTarget(workspaceId: string): string | undefined {
  if (usesInternalDemoRouting(workspaceId)) return undefined;

  try {
    const ownerEmail = listWorkspaces().find((item) => item.id === workspaceId)?.ownerEmail;
    return ownerEmail?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Configured by THIS workspace, ignoring anything the server provides.
 *
 * `isConfigured` accepts `envConfigured`/`serverConfigured`, which are Violema's
 * own credentials. For a tenant that is the difference between "you connected
 * Stripe" and "we connected Stripe", and only the first may satisfy readiness.
 */
export function isWorkspaceConfigured(
  settingsView: WorkspaceSettingsView | MinimalSettingsView,
  id: string,
): boolean {
  const integrations = settingsView.integrations as Record<string, MinimalIntegrationReadiness | undefined> | undefined;
  const integration = integrations?.[id];

  if (!integration) return false;
  if (typeof integration === 'boolean') return integration;
  if (integration.workspaceConfigured) return true;

  return Object.values(integration.fields || {}).some((field) => Boolean(field.workspaceConfigured));
}

/**
 * Whether Stripe may be read for this workspace.
 *
 * The default workspace may use the server's key; everyone else — tenants and
 * demo workspaces alike — must have connected their own. This mirrors
 * `getWorkspaceScopedIntegrationCredential`, so readiness and execution cannot
 * disagree about whose Stripe account is in play.
 */
function isStripeReadable(
  settingsView: WorkspaceSettingsView | MinimalSettingsView,
  workspaceId: string,
): boolean {
  return canUseServerIntegrationCredentials(workspaceId)
    ? isConfigured(settingsView, 'stripe')
    : isWorkspaceConfigured(settingsView, 'stripe');
}

const INTEGRATION_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  github: 'GitHub',
  linear: 'Linear',
  email: 'Gmail',
  calendar: 'Google Calendar',
  google_drive: 'Google Drive',
  tavily: 'Web search',
  slack: 'Slack',
  postmark: 'Email',
};

/**
 * Human label for an integration id. Falls back to title-casing the id so an
 * unknown source still reads as a product name inside a blocker.
 */
export function labelIntegrationId(id: string): string {
  if (INTEGRATION_LABELS[id]) return INTEGRATION_LABELS[id];

  return (
    id
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Integration'
  );
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

export function isConfigured(
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

function readWorkflowRequirements(workflowId: string, workspaceId: string): WorkflowRequirements {
  if (workflowId === 'revenue-watch') {
    return {
      supported: true,
      requiredIntegrationIds: ['stripe'],
      optionalIntegrationIds: [],
      firstRunRequiresApproval: true,
      defaultDeliveryTarget: defaultDeliveryTarget(workspaceId, REVENUE_WATCH_DEFAULT_DELIVERY_TARGET),
    };
  }

  if (workflowId === 'weekly-founder-update') {
    return {
      supported: true,
      requiredIntegrationIds: [
        'stripe',
        'github',
        'linear',
        'email',
        'calendar',
        'tavily',
        'slack',
      ],
      optionalIntegrationIds: ['google_drive', 'postmark'],
      firstRunRequiresApproval: true,
      defaultDeliveryTarget: defaultDeliveryTarget(
        workspaceId,
        WEEKLY_FOUNDER_UPDATE_DEFAULT_DELIVERY_TARGET,
      ),
    };
  }

  return {
    supported: false,
    requiredIntegrationIds: [],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: false,
  };
}

/**
 * Require the transport that will actually carry the delivery.
 *
 * `weekly-founder-update` hardcodes Slack as required, which was right when
 * every delivery went to a Violema channel. A tenant now defaults to their
 * owner's email, and blocking them on a Slack connection their delivery never
 * touches would make the workflow unrunnable for no reason.
 *
 * Slack stays required whenever the destination really is a Slack target, which
 * covers the internal and demo workspaces unchanged.
 */
function applyDeliveryChannelRequirements(
  requirements: WorkflowRequirements,
  deliveryTarget: string | undefined,
): WorkflowRequirements {
  const target = deliveryTarget?.trim();
  if (!requirements.supported || !target) return requirements;
  if (!target.includes('@') || target.startsWith('@')) return requirements;
  if (!requirements.requiredIntegrationIds.includes('slack')) return requirements;

  return {
    ...requirements,
    requiredIntegrationIds: Array.from(
      new Set(requirements.requiredIntegrationIds.map((id) => (id === 'slack' ? 'postmark' : id))),
    ),
    // Email delivery promotes Postmark from supporting to required, so it must
    // not also be reported as an optional warning.
    optionalIntegrationIds: requirements.optionalIntegrationIds.filter((id) => id !== 'postmark'),
  };
}

export function checkWorkflowReadiness(input: {
  workflowId: string;
  workspaceId: string;
  deliveryTarget?: string | null;
  settingsView?: WorkspaceSettingsView | MinimalSettingsView;
  runtimeStatus?: Record<string, WorkflowRuntimeIntegrationStatus>;
}): WorkflowReadinessReport {
  const settingsView = input.settingsView || getWorkspaceSettingsView(input.workspaceId);
  const baseRequirements = readWorkflowRequirements(input.workflowId, input.workspaceId);
  const blockers: WorkflowReadinessBlocker[] = [];
  const warnings: WorkflowReadinessBlocker[] = [];
  const deliveryTarget =
    input.deliveryTarget === undefined || input.deliveryTarget === null
      ? baseRequirements.defaultDeliveryTarget
      : input.deliveryTarget;
  const requirements = applyDeliveryChannelRequirements(baseRequirements, deliveryTarget);

  if (!requirements.supported) {
    blockers.push({
      key: 'unsupported_workflow',
      label: 'Unsupported workflow',
      detail: `Workflow "${input.workflowId}" is not supported by the readiness service.`,
    });
  }

  if (
    requirements.requiredIntegrationIds.includes('stripe')
    && !isStripeReadable(settingsView, input.workspaceId)
  ) {
    blockers.push({
      key: 'stripe',
      label: 'Connect Stripe',
      detail: 'Stripe read access is required before Revenue Watch can run with real data.',
      route: '/integrations?provider=stripe&workflow=revenue-watch',
    });
  }

  if (requirements.supported && input.workflowId === 'weekly-founder-update') {
    for (const integrationId of requirements.requiredIntegrationIds.filter(
      (id) => id !== 'stripe',
    )) {
      const status = input.runtimeStatus?.[integrationId];
      if (status?.ready) continue;
      const label = INTEGRATION_LABELS[integrationId] || integrationId;
      blockers.push({
        key: integrationId,
        label: integrationId === 'slack' ? 'Connect Slack' : `Connect ${label}`,
        detail: status?.detail || `${label} has not passed a live readiness check.`,
        route: `/integrations?provider=${integrationId}&workflow=weekly-founder-update`,
      });
    }

    for (const integrationId of requirements.optionalIntegrationIds) {
      const status = input.runtimeStatus?.[integrationId];
      if (status?.ready) continue;
      const label = INTEGRATION_LABELS[integrationId] || integrationId;
      warnings.push({
        key: integrationId,
        label: status?.code === 'integration_scope_insufficient'
          ? `Reauthorize ${label}`
          : `Connect ${label}`,
        detail: status?.detail || `${label} is unavailable as a supporting integration.`,
        route: `/integrations?provider=${integrationId}&workflow=weekly-founder-update`,
      });
    }
  }

  if (requirements.supported && !deliveryTarget?.trim()) {
    if (usesInternalDemoRouting(input.workspaceId)) {
      // Internal/demo workspaces only reach here for Revenue Watch, since the
      // other supported workflow always has a channel default.
      if (input.workflowId === 'revenue-watch') {
        blockers.push({
          key: 'slack_target',
          label: 'Add Slack destination',
          detail: 'Revenue Watch needs a Slack target before it can be promoted to live delivery.',
        });
      }
    } else {
      // A tenant with no destination and no owner email on file. Ask, rather
      // than defaulting into one of our own channels.
      blockers.push({
        key: 'delivery_target',
        label: 'Add a delivery destination',
        detail:
          'This workflow has nowhere to deliver. Add an email address, or connect Slack to '
          + 'deliver into your own workspace.',
        route: '/integrations?provider=slack',
      });
    }
  }

  return {
    workflowId: input.workflowId,
    workspaceId: input.workspaceId,
    ready: blockers.length === 0,
    summary: !requirements.supported
      ? `Unsupported workflow: ${input.workflowId}.`
      : blockers.length === 0
        ? input.workflowId === 'weekly-founder-update'
          ? warnings.length > 0
            ? `Weekly Founder Update is ready for a sandbox run with ${warnings.length} supporting integration warning${warnings.length === 1 ? '' : 's'}. Delivery requires approval.`
            : 'Weekly Founder Update is ready for a sandbox run. Delivery requires approval.'
          : 'Revenue Watch is ready for a sandbox run. First live delivery requires approval.'
        : `${blockers.length} readiness item${blockers.length === 1 ? '' : 's'} must be fixed before this workflow can run with real data.`,
    requiredIntegrationIds: requirements.requiredIntegrationIds,
    optionalIntegrationIds: requirements.optionalIntegrationIds,
    firstRunRequiresApproval: requirements.firstRunRequiresApproval,
    deliveryTarget: deliveryTarget?.trim() || null,
    blockers,
    warnings,
  };
}
