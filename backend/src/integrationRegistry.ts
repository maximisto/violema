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
    boundaries: ['No repository deletion', 'No secret or workflow environment reads', 'No commits, branch deletion, or release mutation', 'Writes require approval in founder workflows'],
  },
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    detail: 'Threads, replies, commitments, and founder-critical follow-up',
    description: 'Let Violema read selected Gmail threads and prepare follow-up queues without sending messages automatically.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'gmail',
    credentialFields: [],
    capabilities: ['Search recent threads', 'Identify unreplied conversations', 'Extract commitments and promised materials'],
    boundaries: ['Narrow query windows by default', 'No inbox-wide export', 'No sending without approval', 'Ledger stores summaries and ids instead of raw bodies'],
  },
  google_calendar: {
    id: 'google_calendar',
    label: 'Google Calendar',
    detail: 'Meetings, deadlines, attendees, and relationship commitments',
    description: 'Let Violema read selected calendar windows for meeting prep, weekly briefs, and investor follow-up.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'google_calendar',
    credentialFields: [],
    capabilities: ['Read upcoming meetings', 'Read recent meetings', 'Extract deadlines and relationship commitments'],
    boundaries: ['No event creation or edits', 'No attendee spam', 'No broad historical calendar scan by default'],
  },
  google_drive: {
    id: 'google_drive',
    label: 'Google Drive',
    detail: 'Docs, files, board materials, and investor update source material',
    description: 'Let Violema search selected Drive files and normalize source material for reviewed drafts.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'google_drive',
    credentialFields: [],
    capabilities: ['Search selected docs', 'Read allowed document text and metadata', 'Identify recently changed investor, customer, and board files'],
    boundaries: ['No broad Drive crawl by default', 'No permission changes', 'No file deletion', 'No raw large-document dumping into Slack or email'],
  },
  linear: {
    id: 'linear',
    label: 'Linear',
    detail: 'Tasks, cycles, sprint reports, and blockers',
    description: 'Let Violema read Linear issues and summarize team delivery health, blockers, and backlog risk.',
    category: 'core',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'linear',
    credentialFields: [],
    capabilities: ['Read issues and teams', 'Summarize blockers', 'Surface delivery backlog context'],
    boundaries: ['Read-only by default', 'No issue creation or comments without approval', 'Team/project selection should be scoped per workflow'],
  },
  notion: {
    id: 'notion',
    label: 'Notion',
    detail: 'Pages, databases, notes, and workspace memory',
    description: 'Let Violema pull operating context from approved Notion pages and databases for founder briefs and investor prep.',
    category: 'long_tail',
    status: 'ready',
    connectionMethod: 'partner',
    partnerAppName: 'notion',
    credentialFields: [],
    capabilities: ['Search approved pages', 'Find investor notes', 'Pull operating context metadata'],
    boundaries: ['Only pages/databases explicitly shared with the integration', 'No page creation or edits without approval', 'No raw large-page dumps into Slack or email'],
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

export function buildIntegrationCatalog(input: {
  partnerEnabled: boolean;
  connectedPartnerApps?: string[];
}) {
  const connectedPartnerApps = input.connectedPartnerApps || [];
  return {
    readiness: {
      headline: 'Workflow readiness, not connector setup',
      body: 'Connect the tools this workflow needs, approve the boundaries, run a dry test, then let Violema operate with a record you can inspect.',
      stages: WORKFLOW_READINESS_STAGES,
    },
    partner: {
      enabled: input.partnerEnabled,
      connectedApps: connectedPartnerApps,
      unavailableMessage: 'Some one-click connectors are temporarily unavailable. Violema can still run native and sample-data workflows while we finish the connector layer.',
    },
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
    partnerApps: INTEGRATION_PROVIDERS
      .map((provider) => INTEGRATION_DEFINITIONS[provider])
      .filter((definition) => 'partnerAppName' in definition && definition.partnerAppName)
      .map((definition) => ({
        name: 'partnerAppName' in definition ? definition.partnerAppName : '',
        label: definition.label,
        detail: definition.detail,
        status: definition.status,
      })),
  };
}
