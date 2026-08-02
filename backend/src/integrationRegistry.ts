import {
  listPartnerConnectOptions,
  normalizeAppName,
  resolvePartnerToolkit,
  sourcesForPartnerToolkit,
} from './integrationGateway/partnerAppMap';

export type IntegrationConnectionMethod = 'native' | 'partner' | 'manual' | 'internal';
export type IntegrationReadinessStatus = 'ready' | 'next' | 'planned';

export interface IntegrationCredentialField {
  name: string;
  label: string;
  help: string;
  secret: boolean;
  envKeys: string[];
}

export interface IntegrationDefinition {
  id: string;
  label: string;
  detail: string;
  description: string;
  category: 'core' | 'long_tail' | 'custom';
  status: IntegrationReadinessStatus;
  connectionMethod: IntegrationConnectionMethod;
  partnerAppName?: string;
  credentialFields: IntegrationCredentialField[];
  capabilities: string[];
  boundaries: string[];
}

export const INTEGRATION_DEFINITIONS = {
  github: {
    id: 'github',
    label: 'GitHub',
    detail: 'Issues, PRs, repositories, and engineering context',
    description: 'Let Violema inspect repositories, summarize pull requests, create issues, and turn engineering signals into recurring updates.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'manual',
    partnerAppName: 'github',
    credentialFields: [
      {
        name: 'token',
        label: 'GitHub access token',
        help: 'Used to read repositories, issues, and pull requests for approved workflows.',
        secret: true,
        envKeys: ['GITHUB_TOKEN'],
      },
    ],
    capabilities: ['Read repository context', 'List issues and pull requests', 'Create issues after approval'],
    boundaries: ['No repository deletion', 'No secret exposure', 'Writes should require approval in founder workflows'],
  },
  linear: {
    id: 'linear',
    label: 'Linear',
    detail: 'Tasks, cycles, sprint reports, and blockers',
    description: 'Let Violema turn recurring operating work into Linear issues and summarize team delivery health.',
    category: 'core',
    status: 'next',
    connectionMethod: 'manual',
    partnerAppName: 'linear',
    credentialFields: [
      {
        name: 'apiKey',
        label: 'Linear API key',
        help: 'Used to read issues and create approved tasks for selected teams.',
        secret: true,
        envKeys: ['LINEAR_API_KEY'],
      },
    ],
    capabilities: ['Read issues and teams', 'Create approved tasks', 'Summarize blockers'],
    boundaries: ['No broad workspace edits by default', 'Team/project selection should be scoped per workflow'],
  },
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    detail: 'Inbox commitments, replies owed, and follow-up threads',
    description: 'Let Violema read recent inbox activity so the Weekly Founder Update can cite the commitments you made by email.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'gmail',
    credentialFields: [],
    capabilities: ['Read recent inbox activity', 'Extract commitments and replies owed', 'Cite the source thread in an update'],
    boundaries: ['Read-only — Violema never sends, archives, or deletes mail through this connection', 'Raw email bodies never enter the run ledger'],
  },
  googlecalendar: {
    id: 'googlecalendar',
    label: 'Google Calendar',
    detail: 'The week ahead: meetings, reviews, and committed time',
    description: 'Let Violema read the coming week of events so recurring updates reflect the schedule you actually committed to.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'googlecalendar',
    credentialFields: [],
    capabilities: ['Read events in the next 7 days', 'Summarize the week ahead', 'Match meetings against stated commitments'],
    boundaries: ['Read-only — Violema never creates, moves, or cancels events', 'Only the forward 7-day window is read'],
  },
  googledrive: {
    id: 'googledrive',
    label: 'Google Drive',
    detail: 'Recently changed documents used as update evidence',
    description: 'Let Violema list recently modified documents so a founder update can point at the artifacts behind the work.',
    category: 'long_tail',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'googledrive',
    credentialFields: [],
    capabilities: ['List recently modified files', 'Report file names and modified times', 'Link documents as supporting evidence'],
    boundaries: ['Read-only — Violema never edits, moves, or deletes files', 'File metadata only; document contents are not copied into the ledger', 'Supporting integration — a Weekly Founder Update still runs without it'],
  },
  slack: {
    id: 'slack',
    label: 'Slack',
    detail: 'Where your recurring updates get delivered',
    description: 'Connect your own Slack so Violema delivers approved updates into your workspace, posting as an app you authorized.',
    category: 'core',
    status: 'ready',
    // Composio ships `slack` (posts as the connected user) and `slackbot`
    // (posts as the connected app). Violema delivers as an app, so the connect
    // flow offers `slackbot`; `slackDelivery` still accepts either if a
    // workspace already connected one.
    connectionMethod: 'partner',
    partnerAppName: 'slackbot',
    credentialFields: [],
    capabilities: ['Deliver approved updates to a channel you choose', 'Thread long briefs under one message'],
    boundaries: [
      'Delivery only — Violema never reads your Slack history through this connection',
      'Violema never posts from its own Slack workspace on your behalf',
      'Nothing is sent until the run is approved',
    ],
  },
  notion: {
    id: 'notion',
    label: 'Notion',
    detail: 'Pages, databases, notes, and workspace memory',
    description: 'Let Violema pull operating context from approved Notion pages and draft updates back into selected workspaces.',
    category: 'long_tail',
    status: 'next',
    connectionMethod: 'manual',
    partnerAppName: 'notion',
    credentialFields: [
      {
        name: 'token',
        label: 'Notion integration token',
        help: 'Used to access the Notion pages and databases shared with the integration.',
        secret: true,
        envKeys: ['NOTION_API_KEY', 'NOTION_TOKEN'],
      },
    ],
    capabilities: ['Read approved pages', 'Query selected databases', 'Draft structured updates'],
    boundaries: ['Only pages/databases explicitly shared with the integration', 'Writes should start as drafts'],
  },
  stripe: {
    id: 'stripe',
    label: 'Stripe',
    detail: 'Revenue, subscriptions, failed payments, and customer risk',
    description: 'Let Violema read revenue signals and prepare monitored founder updates without changing money movement.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'manual',
    credentialFields: [
      {
        name: 'secretKey',
        label: 'Stripe restricted key',
        help: 'Used to read revenue and customer data for approved workflows. Prefer restricted read-only keys.',
        secret: true,
        envKeys: ['STRIPE_SECRET_KEY'],
      },
    ],
    capabilities: ['Read subscription and customer data', 'Summarize MRR and churn signals', 'Flag failed payments'],
    boundaries: ['No refunds', 'No billing setting changes', 'No customer-facing action without approval'],
  },
  hubspot: {
    id: 'hubspot',
    label: 'HubSpot',
    detail: 'Contacts, companies, deals, and pipeline follow-up',
    description: 'Let Violema prepare CRM follow-up and pipeline summaries from approved HubSpot objects.',
    category: 'core',
    status: 'next',
    connectionMethod: 'manual',
    partnerAppName: 'hubspot',
    credentialFields: [
      {
        name: 'token',
        label: 'HubSpot private app token',
        help: 'Used to read CRM records and draft approved follow-up workflows.',
        secret: true,
        envKeys: ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_PRIVATE_APP_TOKEN'],
      },
    ],
    capabilities: ['Read contacts and deals', 'Summarize pipeline movement', 'Draft follow-up tasks'],
    boundaries: ['No broad list exports by default', 'No customer messaging without approval'],
  },
  airtable: {
    id: 'airtable',
    label: 'Airtable',
    detail: 'Bases, tables, lightweight CRM, and operating trackers',
    description: 'Let Violema read selected Airtable records and prepare workflow updates from operating tables.',
    category: 'long_tail',
    status: 'next',
    connectionMethod: 'manual',
    credentialFields: [
      {
        name: 'token',
        label: 'Airtable token',
        help: 'Used to read selected bases and tables for approved workflows.',
        secret: true,
        envKeys: ['AIRTABLE_ACCESS_TOKEN', 'AIRTABLE_API_KEY'],
      },
    ],
    capabilities: ['Read selected bases', 'Summarize records', 'Prepare update drafts'],
    boundaries: ['Base/table selection should be explicit', 'Writes should require approval'],
  },
  figma: {
    id: 'figma',
    label: 'Figma',
    detail: 'Design files, comments, and product review context',
    description: 'Let Violema inspect approved design files and pull product/design context into operating reviews.',
    category: 'long_tail',
    status: 'planned',
    connectionMethod: 'manual',
    credentialFields: [
      {
        name: 'token',
        label: 'Figma access token',
        help: 'Used to read approved design files and comments.',
        secret: true,
        envKeys: ['FIGMA_ACCESS_TOKEN'],
      },
    ],
    capabilities: ['Read approved files', 'Summarize design context', 'Inspect comments'],
    boundaries: ['No file mutation by default', 'Design writes require explicit approval'],
  },
  vercel: {
    id: 'vercel',
    label: 'Vercel',
    detail: 'Deployments, projects, and frontend release state',
    description: 'Let Violema inspect deployment state and summarize release health for approved projects.',
    category: 'long_tail',
    status: 'planned',
    connectionMethod: 'manual',
    credentialFields: [
      {
        name: 'token',
        label: 'Vercel token',
        help: 'Used to read deployment and project status for approved workflows.',
        secret: true,
        envKeys: ['VERCEL_TOKEN'],
      },
    ],
    capabilities: ['Read deployment status', 'Summarize release health', 'Flag failed builds'],
    boundaries: ['No deploy deletion', 'No environment variable reads by default'],
  },
} as const satisfies Record<string, IntegrationDefinition>;

export type IntegrationProvider = keyof typeof INTEGRATION_DEFINITIONS;

export const INTEGRATION_PROVIDERS = Object.keys(INTEGRATION_DEFINITIONS) as IntegrationProvider[];

const WORKFLOW_READINESS_STAGES = [
  {
    title: 'Choose the outcome',
    body: 'Start with the recurring work Violema should handle, not a connector list.',
  },
  {
    title: 'Connect only what is needed',
    body: 'Violema recommends the tools required for that workflow and hides provider plumbing.',
  },
  {
    title: 'Approve the boundaries',
    body: 'Plain-language access rules explain what Violema can read, draft, post, or never touch.',
  },
  {
    title: 'Run a sandbox test',
    body: 'Dry runs show inputs, planned actions, and output preview before anything goes live.',
  },
  {
    title: 'Promote to live',
    body: 'The first live run requires approval, then the workflow can be scheduled or kept manual.',
  },
];

export function getIntegrationFields(provider: IntegrationProvider): string[] {
  return INTEGRATION_DEFINITIONS[provider].credentialFields.map((field) => field.name);
}

export function getIntegrationEnvKeys(provider: IntegrationProvider, field: string): string[] {
  return INTEGRATION_DEFINITIONS[provider].credentialFields.find((item) => item.name === field)?.envKeys || [];
}

export function isIntegrationProvider(value: string | undefined): value is IntegrationProvider {
  return Boolean(value && (INTEGRATION_PROVIDERS as readonly string[]).includes(value));
}

/**
 * Every toolkit slug the catalog offers as a one-click connection. Wider than
 * `partnerAppMap` on purpose: Notion and HubSpot are connectable even though no
 * workflow reads from them yet.
 */
const PARTNER_APP_SLUGS: string[] = INTEGRATION_PROVIDERS.map(
  (provider) => INTEGRATION_DEFINITIONS[provider],
)
  .map((definition) => ('partnerAppName' in definition ? definition.partnerAppName : undefined))
  .filter((slug): slug is NonNullable<typeof slug> => Boolean(slug));

/**
 * Catalog id → toolkit slug, for providers whose public id differs from the
 * Composio toolkit behind it. `slack` is the first: the product says "Slack",
 * Composio wants `slackbot`. For every other provider the two coincide, so this
 * lookup is a no-op that keeps `resolvePartnerAppSlug` honest as they diverge.
 */
const PARTNER_APP_SLUG_BY_PROVIDER_ID = new Map<string, string>(
  INTEGRATION_PROVIDERS.map((provider) => INTEGRATION_DEFINITIONS[provider])
    .filter((definition) => 'partnerAppName' in definition && definition.partnerAppName)
    .map((definition) => [
      normalizeAppName(definition.id),
      ('partnerAppName' in definition ? definition.partnerAppName : '') as string,
    ]),
);

/**
 * Resolve whatever the client sent — a Violema source id, a toolkit slug, or a
 * punctuated variant — to the toolkit slug the connect/disconnect endpoints
 * should act on. Returns `null` for anything not in the catalog so the caller
 * can 400 instead of forwarding an unknown app to Composio.
 */
export function resolvePartnerAppSlug(input: string | null | undefined): string | null {
  const mapped = resolvePartnerToolkit(input);
  if (mapped) return mapped;
  if (typeof input !== 'string') return null;
  const key = normalizeAppName(input);
  if (!key) return null;
  // A catalog id wins over a raw slug match so `slack` connects the `slackbot`
  // toolkit Violema actually delivers through.
  const byProviderId = PARTNER_APP_SLUG_BY_PROVIDER_ID.get(key);
  if (byProviderId) return byProviderId;
  return PARTNER_APP_SLUGS.find((slug) => normalizeAppName(slug) === key) ?? null;
}

/** Sorted list of accepted connect/disconnect identifiers, for 400 responses. */
export function listPartnerAppOptions(): string[] {
  return Array.from(
    new Set<string>([
      ...listPartnerConnectOptions(),
      ...PARTNER_APP_SLUGS,
      ...PARTNER_APP_SLUG_BY_PROVIDER_ID.keys(),
    ]),
  ).sort();
}

/**
 * Library provisioning state for the connect surface.
 *
 * `status` exists beside `provisioned` because a boolean cannot distinguish
 * "no library yet" from "we could not look". The first invites the founder to
 * provision; the second must not, because the button would fail.
 */
export interface IntegrationCatalogLibrary {
  provisioned: boolean;
  status: 'provisioned' | 'not_provisioned' | 'unavailable' | 'unknown';
  folderId?: string;
  entryCount?: number;
  lastEntryAt?: string;
  entryCountCapped?: boolean;
}

export function buildIntegrationCatalog(input: {
  partnerEnabled: boolean;
  connectedPartnerApps?: string[];
  /** True when the Composio lookup threw — "cannot tell", not "nothing connected". */
  partnerDegraded?: boolean;
  /**
   * Per-toolkit capability, derived from granted scopes. Empty when Composio is
   * off or unreachable — in which case the UI must fall back to presence and
   * say it cannot verify capability, rather than claim there is none.
   */
  partnerCapabilities?: unknown[];
  /** Connections the user started and never finished. */
  partnerPending?: unknown[];
  library?: IntegrationCatalogLibrary;
}) {
  const connectedPartnerApps = Array.from(
    new Set((input.connectedPartnerApps || []).map(normalizeAppName).filter(Boolean)),
  );
  const partnerApps = INTEGRATION_PROVIDERS.map((provider) => INTEGRATION_DEFINITIONS[provider])
    .filter((definition) => 'partnerAppName' in definition && definition.partnerAppName)
    .map((definition) => {
      const name = 'partnerAppName' in definition ? definition.partnerAppName : '';
      return {
        name,
        label: definition.label,
        detail: definition.detail,
        status: definition.status,
        // Which workflow data sources this toolkit feeds; [] when it is
        // connectable but nothing reads from it yet.
        sources: sourcesForPartnerToolkit(name) as string[],
      };
    });
  return {
    readiness: {
      headline: 'Workflow readiness, not connector setup',
      body: 'Connect the tools this workflow needs, approve the boundaries, run a dry test, then let Violema operate with a record you can inspect.',
      stages: WORKFLOW_READINESS_STAGES,
    },
    partner: {
      enabled: input.partnerEnabled,
      connectedApps: connectedPartnerApps,
      degraded: Boolean(input.partnerDegraded),
      apps: partnerApps,
      // What each connected toolkit can actually DO, not merely that it exists.
      // A Drive connection with only `drive.metadata.readonly` appears in
      // `connectedApps` above and still cannot write the library — that gap is
      // what this array closes.
      capabilities: input.partnerCapabilities || [],
      // OAuth flows the user abandoned. Surfaced so a stranded connection can be
      // cancelled and retried instead of silently accumulating.
      pending: input.partnerPending || [],
      unavailableMessage: 'Some one-click connectors are temporarily unavailable. Violema can still run native and sample-data workflows while we finish the connector layer.',
    },
    library: input.library || { provisioned: false, status: 'unknown' },
    providers: INTEGRATION_PROVIDERS.map((provider) => {
      const definition = INTEGRATION_DEFINITIONS[provider];
      return {
        id: definition.id,
        label: definition.label,
        detail: definition.detail,
        description: definition.description,
        category: definition.category,
        status: definition.status,
        connectionMethod: definition.connectionMethod,
        partnerAppName: 'partnerAppName' in definition ? definition.partnerAppName : undefined,
        capabilities: definition.capabilities,
        boundaries: definition.boundaries,
        credentialFields: definition.credentialFields.map((field) => ({
          name: field.name,
          label: field.label,
          help: field.help,
          secret: field.secret,
        })),
      };
    }),
    // Kept alongside `partner.apps` (same array) so existing clients that read
    // the top-level list do not break.
    partnerApps,
  };
}
