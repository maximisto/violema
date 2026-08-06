// Single source of truth for Violema's founder workflow templates.
//
// These power both the discoverable template gallery (home activity surface) and
// the in-editor "start from a template" list. Each definition prefills the
// automation editor via applyFounderWorkflowTemplate in Dashboard.tsx, so the
// `steps` shape stays structurally identical to Omit<WorkflowBlockDraft, 'id'>.

export type WorkflowTemplateStepKind =
  | 'search'
  | 'query'
  | 'capture'
  | 'analyze'
  | 'summarize'
  | 'deliver'
  | 'note';

export interface WorkflowTemplateStep {
  kind: WorkflowTemplateStepKind;
  title: string;
  objective: string;
  inputs?: Record<string, unknown>;
  deliveryTarget?: { channel: 'slack' | 'email'; target: string } | null;
}

export type WorkflowTemplateCategory =
  | 'Operating cadence'
  | 'Revenue & risk'
  | 'Market intelligence'
  | 'Customer & growth'
  | 'Relationships';

export interface WorkflowTemplateDefinition {
  id: string;
  slug: string;
  title: string;
  category: WorkflowTemplateCategory;
  /** One-line payoff: what the founder gets each run. */
  outcome: string;
  description: string;
  cadence: string;
  destination: 'slack' | 'email' | 'none';
  notify: string;
  /** Human-readable systems this loop reads from, for the gallery card. */
  integrations: string[];
  requiredIntegrationIds?: string[];
  optionalIntegrationIds?: string[];
  firstRunRequiresApproval?: boolean;
  steps: WorkflowTemplateStep[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateDefinition[] = [
  {
    id: 'weekly-founder-brief',
    slug: 'weekly-founder-update',
    title: 'Weekly founder brief',
    category: 'Operating cadence',
    outcome: 'A reviewed Monday brief across revenue, delivery, and market — ready to share.',
    cadence: 'every monday at 9am',
    destination: 'slack',
    notify: '#violema-demo',
    integrations: [
      'Stripe',
      'GitHub',
      'Linear',
      'Gmail',
      'Google Calendar',
      'Google Drive',
      'Web search',
      'Slack',
      'Email',
    ],
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
    description: 'Roll up revenue, delivery, customers, calendar, email, and market signals into a reviewed founder update.',
    steps: [
      { kind: 'query', title: 'Check Stripe revenue', objective: 'Pull MRR movement, failed payments, churn, expansion, and customer revenue signals from Stripe.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
      { kind: 'query', title: 'Scan GitHub delivery', objective: 'Pull merged pull requests, blocked issues, stale reviews, and release risk from GitHub.', inputs: { source: 'github', query_type: 'delivery_risk', limit: 10 } },
      { kind: 'query', title: 'Review Linear delivery', objective: 'Pull recently updated work, active delivery status, and blockers from Linear.', inputs: { source: 'linear', query_type: 'delivery_status', limit: 10 } },
      { kind: 'query', title: 'Review email commitments', objective: 'Find founder-critical follow-ups and unanswered priority threads from Gmail metadata.', inputs: { source: 'email', query_type: 'commitments', limit: 10 } },
      { kind: 'query', title: 'Review calendar commitments', objective: 'Review meetings and relationship commitments for the next seven days.', inputs: { source: 'calendar', query_type: 'weekly_commitments', limit: 10 } },
      // Mirrors the backend seed: reads the briefs Violema filed rather than
      // scanning the founder's Drive, which the drive.file scope cannot see.
      { kind: 'query', title: 'Read prior founder briefs', objective: 'Load the briefs already filed for this account so this week reports what changed rather than restating the standing picture.', inputs: { source: 'account_library', query_type: 'read', filters: { section: 'Founder Briefs' }, limit: 2 } },
      { kind: 'search', title: 'Scan market signals', objective: 'Research customer, competitor, pricing, platform, and AI automation changes since the last update.', inputs: { query: 'AI automation platform startup competitor pricing product launch founder update', num_results: 6 } },
      { kind: 'summarize', title: 'Draft founder brief', objective: 'Synthesize a founder-ready brief with signals, risks, decisions needed, and next actions. When prior briefs are in the evidence, lead with what changed since the last one.' },
      { kind: 'query', title: 'File this brief in the library', objective: "Append this week's founder brief to the account library so the next run can report the delta.", inputs: { source: 'account_library', query_type: 'write', section: 'Founder Briefs', entry_title: 'Weekly founder brief' } },
      { kind: 'deliver', title: 'Hold for approval and deliver', objective: 'Send the reviewed weekly founder update after approval.', inputs: { approval_required: true }, deliveryTarget: { channel: 'slack', target: '#violema-demo' } },
    ],
  },
  {
    id: 'revenue-watch',
    slug: 'revenue-watch',
    title: 'Revenue watch',
    category: 'Revenue & risk',
    outcome: "A daily heads-up on revenue movement and churn risk before it's a surprise.",
    cadence: 'daily at 9am',
    destination: 'slack',
    notify: '#violema-demo',
    integrations: ['Stripe'],
    requiredIntegrationIds: ['stripe'],
    optionalIntegrationIds: [],
    firstRunRequiresApproval: true,
    description: 'Monitor revenue movement, failed payments, churn risk, and expansion signals before they become surprises.',
    steps: [
      { kind: 'query', title: 'Pull Stripe revenue pulse', objective: 'Check revenue, failed payments, churn events, and upgrades.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
      { kind: 'analyze', title: 'Analyze revenue risk', objective: 'Identify what changed, what matters, and where founder attention is needed.' },
      { kind: 'summarize', title: 'Create revenue brief', objective: 'Write a short risk/opportunity brief with next actions.' },
      { kind: 'deliver', title: 'Send revenue watch', objective: 'Send the reviewed revenue watch to the founder channel.', inputs: { approval_required: true }, deliveryTarget: { channel: 'slack', target: '#violema-demo' } },
    ],
  },
  {
    id: 'competitor-monitor',
    slug: 'competitor-intelligence',
    title: 'Competitor monitor',
    category: 'Market intelligence',
    outcome: 'A weekly memo on competitor pricing, launches, and positioning shifts.',
    cadence: 'every monday at 8am',
    destination: 'slack',
    notify: '#violema-demo',
    integrations: ['Web search', 'Google Drive'],
    description: 'Track pricing, launches, positioning changes, and messaging shifts across key competitors.',
    steps: [
      // Mirrors the backend competitor seed: read the account's intelligence
      // library first so analysis reports what CHANGED, and record findings
      // back so every run inherits the last one. Search and analysis steps
      // reference the workspace's business context at run time (resolved by backend).
      // Keep in sync with backend/src/scheduler.ts auto_competitor_monitor.
      { kind: 'query', title: 'Read the competitive library', objective: 'Load prior competitive findings recorded for this account so this run can report changes rather than restate what is already known.', inputs: { source: 'account_library', query_type: 'read', filters: { section: 'Competitive Intelligence' }, limit: 3 } },
      { kind: 'search', title: 'Search competitor moves', objective: 'Find pricing, launch, and positioning changes from key competitors.', inputs: { use_business_context: true, query_suffix: 'competitor pricing launches positioning', num_results: 8 } },
      { kind: 'analyze', title: 'Extract what changed', objective: 'Compare this run against the prior library entries and separate genuine change from noise.', inputs: { use_business_context: true, instruction: 'Compare the search evidence against the prior library entries in the evidence block. Report NEW (absent from the library), CHANGED (present but different — say what it was and what it is now), and UNCHANGED (confirmed still true, one line). When the library is empty, say plainly that this run is the baseline and describe only what the evidence shows. Never describe a change you cannot evidence from both sides of the comparison.' } },
      { kind: 'summarize', title: 'Draft competitor memo', objective: 'Create a concise founder memo leading with what changed since the last run, with implications and recommended action.', inputs: { use_business_context: true, instruction: 'Draft the competitor memo. Lead with what changed since the last run, then implications, then recommended action.' } },
      { kind: 'query', title: 'Record findings in the library', objective: "Append this run's competitive findings to the account intelligence library so the next run starts from them.", inputs: { source: 'account_library', query_type: 'write', section: 'Competitive Intelligence', entry_title: 'Competitor snapshot' } },
      { kind: 'deliver', title: 'Deliver competitor memo', objective: 'Send the reviewed competitor memo after approval.', inputs: { approval_required: true }, deliveryTarget: { channel: 'slack', target: '#violema-demo' } },
    ],
  },
  {
    id: 'customer-risk-digest',
    slug: 'customer-risk-monitoring',
    title: 'Customer risk digest',
    category: 'Customer & growth',
    outcome: 'A daily read on the accounts and product friction that threaten retention.',
    cadence: 'daily at 8am',
    destination: 'slack',
    notify: '#violema-demo',
    integrations: ['PostHog', 'GitHub'],
    description: 'Watch customer signals, product friction, unanswered threads, and usage changes that could affect retention.',
    steps: [
      { kind: 'query', title: 'Check product usage', objective: 'Pull usage, activation, and retention signals.', inputs: { source: 'posthog', query_type: 'active_users' } },
      { kind: 'query', title: 'Review open customer issues', objective: 'Find customer-facing bugs, stale tickets, and blocked support work.', inputs: { source: 'github', query_type: 'open_issues' } },
      { kind: 'analyze', title: 'Score customer risk', objective: 'Identify the accounts or themes that need attention today.' },
      { kind: 'summarize', title: 'Draft customer risk digest', objective: 'Write a practical digest with owners and recommended follow-up.' },
    ],
  },
  {
    id: 'investor-follow-up',
    slug: 'investor-follow-up-queue',
    title: 'Investor follow-up queue',
    category: 'Relationships',
    outcome: 'A prioritized queue of investor commitments and replies that need a founder.',
    cadence: 'daily at 4pm',
    destination: 'email',
    notify: '',
    integrations: ['Email', 'Calendar'],
    description: 'Collect investor commitments, open replies, meeting notes, and follow-up actions into a founder-ready queue.',
    steps: [
      { kind: 'query', title: 'Review email commitments', objective: 'Find investor follow-ups, unanswered threads, and promised materials.', inputs: { source: 'email', query_type: 'commitments' } },
      { kind: 'query', title: 'Review calendar commitments', objective: 'Find upcoming investor meetings and relationship deadlines.', inputs: { source: 'calendar', query_type: 'weekly_commitments' } },
      { kind: 'summarize', title: 'Draft follow-up queue', objective: 'Turn commitments into a prioritized queue with next messages to send.' },
    ],
  },
  {
    id: 'monthly-investor-update',
    slug: 'monthly-investor-update',
    title: 'Monthly investor update',
    category: 'Relationships',
    outcome: 'A draft monthly investor update built from real revenue and delivery data.',
    cadence: 'on the 1st at 9am',
    destination: 'email',
    notify: '',
    integrations: ['Stripe', 'GitHub', 'Email'],
    description: 'Turn the month’s revenue movement, product delivery, and key wins/risks into a draft investor update you review before sending.',
    steps: [
      { kind: 'query', title: 'Pull monthly revenue', objective: 'Summarize MRR movement, new revenue, churn, and expansion for the month.', inputs: { source: 'stripe', query_type: 'revenue_summary' } },
      { kind: 'query', title: 'Summarize delivery', objective: 'Pull shipped work, releases, and notable engineering progress from GitHub.', inputs: { source: 'github', query_type: 'delivery_risk' } },
      { kind: 'analyze', title: 'Identify wins and asks', objective: 'Separate the month into wins, risks, metrics, and specific asks for investors.' },
      { kind: 'summarize', title: 'Draft investor update', objective: 'Write a concise, honest monthly update with metrics, narrative, risks, and asks for review before sending.' },
    ],
  },
];

export function getWorkflowTemplateById(id: string): WorkflowTemplateDefinition | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}
