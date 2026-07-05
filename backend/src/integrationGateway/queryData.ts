import { queryStripeRevenue, type StripeLikeClient } from './adapters/nativeStripe';
import type { IntegrationQueryResult, IntegrationQuerySuccess } from './types';
import type { AutomationStepExecution } from '../platform/types';

export interface LegacyQueryDataSuccess<T = unknown>
  extends Omit<IntegrationQuerySuccess<T>, 'live' | 'cache_hit'> {
  cache_hit: boolean;
  live: false;
  simulated: true;
  message: string;
  nextAction: {
    label: string;
    route: string;
  };
}

export interface ExecuteQueryDataInput {
  workspaceId: string;
  source: string;
  queryType: string;
  filters?: Record<string, unknown>;
  limit?: number;
  now?: Date;
  clientOverrides?: {
    stripe?: StripeLikeClient;
  };
  credentialOverrides?: {
    stripeSecretKey?: string;
  };
}

export interface ApplyQueryStepPayloadToExecutionInput {
  stepTitle: string;
  payload: Record<string, unknown>;
  stepExecution: AutomationStepExecution;
  stepErrors: string[];
  artifactCount: number;
}

const LEGACY_MOCK_DATA: Record<string, Record<string, unknown>> = {
  hubspot: {
    contacts: { total: 12450, new_this_month: 234, qualified_leads: 89, mql: 156, sql: 43 },
    deals: { open: 67, won_this_month: 23, lost_this_month: 8, pipeline_value: 890000, avg_deal_size: 38700, close_rate: '34%' },
    campaigns: { active: 5, total_reach: 42000, avg_open_rate: '24.3%', avg_click_rate: '3.8%' },
  },
  github: {
    open_issues: { total: 34, critical: 2, high: 8, medium: 15, low: 9 },
    pull_requests: { open: 12, merged_this_week: 28, avg_review_time_hours: 6.4, oldest_open_days: 18 },
    activity: { commits_this_week: 147, contributors_active: 8, deployments_this_week: 12 },
    delivery_risk: { open_prs: 12, merged_this_week: 28, blockers: 2, stale_reviews: 4 },
  },
  linear: {
    sprint: { name: 'Sprint 23', open: 156, in_progress: 34, completed: 42, blocked: 7 },
    velocity: { this_sprint: 84, last_sprint: 76, avg_4_sprints: 79 },
    cycle_time_days: { p50: 2.1, p90: 5.8 },
  },
  posthog: {
    pageviews: { today: 8421, this_week: 48230, this_month: 182450 },
    active_users: { dau: 1247, wau: 6832, mau: 18940 },
    conversion: { signup_rate: '4.2%', activation_rate: '67%', retention_d30: '42%' },
    top_events: [
      { event: 'chat_sent', count: 45230, change: '+12%' },
      { event: 'tool_executed', count: 28410, change: '+34%' },
      { event: 'automation_created', count: 3210, change: '+89%' },
    ],
  },
  salesforce: {
    pipeline: { total: 2340000, opportunities: 87, avg_age_days: 34 },
    forecast: { commit: 340000, best_case: 520000, pipeline: 890000 },
    top_accounts: [
      { name: 'Acme Corp', arr: 120000, health: 'green', csm: 'Sarah K.' },
      { name: 'Globex Inc', arr: 84000, health: 'yellow', csm: 'Mike T.' },
    ],
  },
  google_analytics: {
    sessions: { today: 3421, this_week: 21450, this_month: 89230 },
    acquisition: { organic: '42%', direct: '28%', paid: '18%', referral: '12%' },
    top_pages: [
      { path: '/', sessions: 12450, bounce_rate: '34%' },
      { path: '/pricing', sessions: 8230, bounce_rate: '28%' },
      { path: '/features', sessions: 6710, bounce_rate: '41%' },
    ],
  },
};

function readQueryPayloadFailureMessage(payload: Record<string, unknown>, stepTitle: string) {
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload.code === 'string' && payload.code.trim()) {
    return `Query step "${stepTitle}" failed with ${payload.code.trim()}.`;
  }
  return `Query step "${stepTitle}" failed.`;
}

export function applyQueryStepPayloadToExecution(
  input: ApplyQueryStepPayloadToExecutionInput,
) {
  const { stepTitle, payload, stepExecution, stepErrors, artifactCount } = input;

  stepExecution.output = payload;
  stepExecution.artifactKind = 'query_data';
  stepExecution.toolCalls = 1;
  stepExecution.artifactCount = artifactCount;

  if (payload.ok === false) {
    const failureMessage = readQueryPayloadFailureMessage(payload, stepTitle);
    stepExecution.status = 'failed';
    stepExecution.summary = failureMessage;
    stepExecution.error = failureMessage;
    stepErrors.push(`${stepTitle}: ${failureMessage}`);
    return;
  }

  stepExecution.status = 'succeeded';
  if (payload.simulated === true || payload.live === false) {
    const source = typeof payload.source === 'string' && payload.source.trim()
      ? payload.source.trim()
      : 'integration';
    const sourceLabel = labelizeIntegrationSource(source);
    stepExecution.summary = `Pulled simulated ${sourceLabel} sample data. Connect ${sourceLabel} to query your live workspace data.`;
    stepExecution.error = undefined;
    return;
  }

  stepExecution.summary = 'Pulled the requested live data successfully.';
  stepExecution.error = undefined;
}

export async function executeQueryData(
  input: ExecuteQueryDataInput,
): Promise<IntegrationQueryResult | LegacyQueryDataSuccess> {
  const now = input.now || new Date();

  if (input.source === 'stripe') {
    return queryStripeRevenue({
      workspaceId: input.workspaceId,
      queryType: input.queryType,
      limit: input.limit,
      now,
      client: input.clientOverrides?.stripe,
      secretKey: input.credentialOverrides?.stripeSecretKey,
    });
  }

  const sourceData = LEGACY_MOCK_DATA[input.source] || {};
  const result = sourceData[input.queryType] || { note: `Data for "${input.queryType}" not found in ${input.source}` };

  return {
    ok: true,
    source: input.source,
    query_type: input.queryType,
    data: result,
    fetched_at: now.toISOString(),
    latency_ms: 80,
    cache_hit: false,
    live: false,
    simulated: true,
    message: `Simulated ${labelizeIntegrationSource(input.source)} sample data. Connect ${labelizeIntegrationSource(input.source)} to query your live workspace data.`,
    nextAction: {
      label: `Connect ${labelizeIntegrationSource(input.source)}`,
      route: `/integrations?provider=${encodeURIComponent(input.source)}`,
    },
  };
}

function labelizeIntegrationSource(source: string) {
  const knownLabels: Record<string, string> = {
    github: 'GitHub',
    google_analytics: 'Google Analytics',
    hubspot: 'HubSpot',
    posthog: 'PostHog',
    salesforce: 'Salesforce',
    linear: 'Linear',
    jira: 'Jira',
    notion: 'Notion',
  };
  if (knownLabels[source]) return knownLabels[source];

  return source
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Integration';
}
