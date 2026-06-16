export type HomepageNavItem = {
  label: string;
  href: string;
};

export type WorkflowExample = {
  title: string;
  cadence: string;
  input: string;
  action: string;
  approval: string;
  output: string;
};

export type IntegrationItem = {
  name: string;
  category: string;
  status: 'live' | 'ready' | 'planned';
};

export type ConnectedSystem = IntegrationItem & {
  shortName: string;
  description: string;
  lane: 'input' | 'operator' | 'delivery';
  tone: 'violet' | 'cyan' | 'emerald' | 'amber' | 'slate';
};

export type GovernanceSignal = {
  label: string;
  value: string;
  body: string;
};

export type PricingPlan = {
  id: 'starter' | 'pro' | 'team';
  name: string;
  price: string;
  period: string;
  description: string;
  capacity: string;
  cta: string;
  featured?: boolean;
  features: string[];
  footnote?: string;
};

export type WorkflowDemoMessage = {
  from: 'violema' | 'human' | 'system';
  label: string;
  body: string;
  meta?: string;
};

export type WorkflowDemo = {
  id: string;
  title: string;
  shortTitle: string;
  channel: string;
  cadence: string;
  trigger: string;
  cost: string;
  accent: 'violet' | 'green' | 'amber';
  artifact: string;
  sources: string[];
  approval: string;
  delivery: string;
  messages: WorkflowDemoMessage[];
  runLog: string[];
};

export type HeroBullet = {
  label: string;
};

export type ControlRoomWorker = {
  name: string;
  role: string;
  state: string;
};

export type HeroChannelSurface = {
  id: 'slack' | 'discord' | 'telegram' | 'imessage';
  label: string;
  status: string;
  headline: string;
  body: string;
  primaryAction: string;
  secondaryAction: string;
};

export const homepageNav: HomepageNavItem[] = [
  { label: 'Product', href: '#features' },
  { label: 'Use cases', href: '#how-it-works' },
  { label: 'Integrations', href: '/integrations' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '/blog/' },
];

export const heroCopy = {
  eyebrow: 'AI operations for founder-led teams',
  headline: 'AI agents for founder work.',
  subhead:
    'Violema turns weekly updates, revenue checks, research briefs, and follow-up into monitored runs your team can review, approve, and schedule.',
  primaryCta: 'Set up beta access',
  secondaryCta: 'See a workflow run',
  surfaceNote: 'Slack ready today. Discord, Telegram, and iMessage coming soon.',
};

export const heroBullets: HeroBullet[] = [
  { label: 'Recurring work on autopilot' },
  { label: 'Human approvals before delivery' },
  { label: 'Source-linked output and audit trail' },
  { label: 'Cost and policy controls' },
];

export const proofPoints = [
  {
    title: 'Schedule with confidence',
    body: 'Set once. Run on time.',
  },
  {
    title: 'Approve with control',
    body: 'You stay in the loop.',
  },
  {
    title: 'Deliver with proof',
    body: 'Sources, logs, and outputs.',
  },
  {
    title: 'Spend with clarity',
    body: 'Policies, budgets, and costs.',
  },
];

export const controlRoomWorkers: ControlRoomWorker[] = [
  { name: 'Web researcher', role: 'Gathering market updates', state: 'Working' },
  { name: 'Finance checker', role: 'Checking revenue metrics', state: 'Working' },
  { name: 'News monitor', role: 'Scanning sources', state: 'Working' },
  { name: 'Brief writer', role: 'Drafting key insights', state: 'Working' },
  { name: 'Summarizer', role: 'Compiling final update', state: 'Queued' },
  { name: 'Slack messenger', role: 'Delivery and notification', state: 'Queued' },
];

export const heroChannelSurfaces: HeroChannelSurface[] = [
  {
    id: 'slack',
    label: 'Slack',
    status: 'Ready today',
    headline: 'Weekly founder update ready',
    body: 'Run #7241 reviewed revenue, usage, risks, and follow-up owners. Approve delivery to #founder-updates.',
    primaryAction: 'Approve and deliver',
    secondaryAction: 'Request changes',
  },
  {
    id: 'discord',
    label: 'Discord',
    status: 'Planned',
    headline: 'Community brief queued',
    body: 'Summarize release feedback, top questions, and replies before posting to the product room.',
    primaryAction: 'Approve draft',
    secondaryAction: 'Open proof',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    status: 'Planned',
    headline: 'Market monitor found a change',
    body: 'A competitor changed pricing. Violema prepared a source-linked note and suggested sales language.',
    primaryAction: 'Send note',
    secondaryAction: 'Revise',
  },
  {
    id: 'imessage',
    label: 'iMessage',
    status: 'Planned',
    headline: 'Follow-up needs approval',
    body: 'Drafted a warm reply for a founder intro and attached the relevant brief from the workspace.',
    primaryAction: 'Send',
    secondaryAction: 'Edit',
  },
];

export const workflowDemos: WorkflowDemo[] = [
  {
    id: 'revenue',
    title: 'Weekly founder update',
    shortTitle: 'Revenue',
    channel: '#founder-ops',
    cadence: 'Monday 9:00 AM',
    trigger: 'Scheduled run',
    cost: '38 credits',
    accent: 'violet',
    artifact: 'Revenue brief with risks and next actions',
    sources: ['Stripe subscriptions', 'PostHog activation', 'Slack sales notes'],
    approval: 'Approve churn language before delivery?',
    delivery: 'Posted to #founder-ops with source links',
    messages: [
      {
        from: 'system',
        label: 'Violema',
        body: 'Weekly revenue run started. Pulling Stripe, PostHog, and sales notes.',
        meta: '9:00 AM',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Draft ready. New MRR is up, but two expansion accounts show payment risk.',
        meta: 'Sources attached',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Approval needed: include the churn risk note in the exec summary?',
        meta: 'Waiting',
      },
      {
        from: 'human',
        label: 'Max',
        body: 'Approve. Keep it direct and add the failed payment list.',
        meta: 'Approved',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Brief posted with evidence links, payment list, and follow-up owners.',
        meta: 'Delivered',
      },
    ],
    runLog: [
      'Checked Stripe subscriptions',
      'Matched activation changes',
      'Paused for churn wording',
      'Delivered approved brief',
    ],
  },
  {
    id: 'risk',
    title: 'Customer risk digest',
    shortTitle: 'Risk',
    channel: '#customer-room',
    cadence: 'Every weekday',
    trigger: 'Usage drop detected',
    cost: '24 credits',
    accent: 'green',
    artifact: 'Priority account list and follow-up drafts',
    sources: ['Support tickets', 'Product events', 'Account notes'],
    approval: 'Send the escalation drafts to CS?',
    delivery: 'Queued 4 follow-ups for team review',
    messages: [
      {
        from: 'system',
        label: 'Violema',
        body: 'Customer risk run started. Looking for sharp usage drops and unresolved tickets.',
        meta: '8:30 AM',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Found 4 accounts with declining usage and open blockers older than 72 hours.',
        meta: '4 accounts',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Approval needed: send human follow-up drafts to the CS lead?',
        meta: 'Waiting',
      },
      {
        from: 'human',
        label: 'Ops lead',
        body: 'Revise account 3. Too sharp. Then queue the rest.',
        meta: 'Revision',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Revised tone and queued follow-ups with source notes.',
        meta: 'Delivered',
      },
    ],
    runLog: [
      'Scanned support tickets',
      'Grouped usage drops',
      'Rewrote account 3',
      'Queued follow-up drafts',
    ],
  },
  {
    id: 'market',
    title: 'Competitor monitor',
    shortTitle: 'Market',
    channel: '#market-watch',
    cadence: 'Twice weekly',
    trigger: 'New source found',
    cost: '31 credits',
    accent: 'amber',
    artifact: 'Competitive memo with source links',
    sources: ['Pricing pages', 'Launch notes', 'Funding coverage'],
    approval: 'Publish the positioning note to leadership?',
    delivery: 'Memo saved and summarized in Slack',
    messages: [
      {
        from: 'system',
        label: 'Violema',
        body: 'Market monitor started. Checking pricing pages, launch notes, and funding coverage.',
        meta: '2:15 PM',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Found a pricing change and one product launch that affects the sales narrative.',
        meta: '2 changes',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Approval needed: add a recommended response for next sales call?',
        meta: 'Waiting',
      },
      {
        from: 'human',
        label: 'Founder',
        body: 'Approve. Keep claims source-linked.',
        meta: 'Approved',
      },
      {
        from: 'violema',
        label: 'Violema',
        body: 'Memo saved with source links and a short Slack summary.',
        meta: 'Delivered',
      },
    ],
    runLog: [
      'Checked source freshness',
      'Compared price movement',
      'Drafted sales response',
      'Saved leadership memo',
    ],
  },
];

export const workflowPreview = {
  title: 'Weekly revenue brief',
  status: 'Sample run',
  trigger: 'Monday 9:00 AM',
  cost: '38 credits',
  evidence: ['Stripe subscriptions', 'PostHog activation', 'Slack sales notes'],
  steps: [
    { label: 'Trigger', detail: 'Revenue workflow starts on schedule', state: 'Done' },
    { label: 'Inputs', detail: 'Stripe, PostHog, and Slack evidence collected', state: 'Done' },
    { label: 'Approval', detail: 'Founder reviews churn note before delivery', state: 'Needs review' },
    { label: 'Delivery', detail: 'Approved brief posts to the revenue channel', state: 'Queued' },
  ],
  log: [
    'Checked source freshness before drafting.',
    'Flagged one churn note for human review.',
    'Prepared Slack delivery with evidence links.',
  ],
};

export const workflowExamples: WorkflowExample[] = [
  {
    title: 'Revenue operating brief',
    cadence: 'Weekly',
    input: 'Stripe, CRM notes, sales channel',
    action: 'Compare new revenue, churn, failed payments, and open risks.',
    approval: 'Founder approves the written summary and risk framing.',
    output: 'Revenue brief with evidence links and next actions.',
  },
  {
    title: 'Customer risk digest',
    cadence: 'Daily',
    input: 'Support tickets, product events, account notes',
    action: 'Find accounts with sharp usage drops or unresolved blockers.',
    approval: 'CS lead approves escalation language.',
    output: 'Priority account list and follow-up drafts.',
  },
  {
    title: 'Competitor monitor',
    cadence: 'Twice weekly',
    input: 'Web sources, pricing pages, launch notes',
    action: 'Check for product, pricing, positioning, and funding moves.',
    approval: 'Operator reviews source quality before it enters the memo.',
    output: 'Brief with source links, implications, and recommended response.',
  },
  {
    title: 'Release note pass',
    cadence: 'Per release',
    input: 'GitHub changes, Linear issues, product notes',
    action: 'Turn shipped work into customer-safe release notes.',
    approval: 'Product lead approves what is public.',
    output: 'Release note draft plus internal change summary.',
  },
];

export const controls = [
  {
    title: 'Human-in-the-loop by default',
    body: 'Violema can run routine steps alone, then stops at approval gates for sensitive judgment calls.',
  },
  {
    title: 'Evidence before delivery',
    body: 'Each output keeps the sources, inputs, and steps close enough to audit without rebuilding the run.',
  },
  {
    title: 'Retries without mystery',
    body: 'Failed runs surface what broke, what was retried, and what needs a human decision.',
  },
  {
    title: 'Private operating context',
    body: 'Workspace memory and tool access stay scoped to the work you intentionally connect.',
  },
];

export const governanceSignals: GovernanceSignal[] = [
  {
    label: 'Review state',
    value: 'Waiting on founder',
    body: 'Approval is explicit before sensitive wording, posts, or outbound follow-up leave the workspace.',
  },
  {
    label: 'Evidence quality',
    value: '12 sources linked',
    body: 'Outputs stay attached to the source trail so a human can inspect the basis of the work.',
  },
  {
    label: 'Retry path',
    value: '1 revision queued',
    body: 'Rejected or failed steps show what changed, who decided, and what will run again.',
  },
  {
    label: 'Run budget',
    value: '38 credits',
    body: 'Teams see estimated usage before workflows quietly become expensive background jobs.',
  },
];

export const integrations: IntegrationItem[] = [
  { name: 'Slack', category: 'Delivery', status: 'live' },
  { name: 'Web app', category: 'Control surface', status: 'live' },
  { name: 'Email', category: 'Delivery', status: 'ready' },
  { name: 'Stripe', category: 'Revenue', status: 'ready' },
  { name: 'GitHub', category: 'Engineering', status: 'ready' },
  { name: 'Linear', category: 'Product', status: 'ready' },
  { name: 'PostHog', category: 'Product analytics', status: 'ready' },
  { name: 'Google Drive', category: 'Knowledge', status: 'planned' },
  { name: 'Notion', category: 'Knowledge', status: 'planned' },
  { name: 'HubSpot', category: 'CRM', status: 'planned' },
  { name: 'Salesforce', category: 'CRM', status: 'planned' },
  { name: 'Discord', category: 'Delivery', status: 'planned' },
  { name: 'Telegram', category: 'Delivery', status: 'planned' },
  { name: 'iMessage', category: 'Delivery', status: 'planned' },
];

export const connectedSystems: ConnectedSystem[] = [
  {
    name: 'Violema Web',
    shortName: 'V',
    category: 'Control room',
    status: 'live',
    description: 'Build, replay, approve, and inspect runs.',
    lane: 'operator',
    tone: 'violet',
  },
  {
    name: 'Slack',
    shortName: 'SL',
    category: 'Delivery',
    status: 'live',
    description: 'Approve and receive workflow output where the team already works.',
    lane: 'delivery',
    tone: 'violet',
  },
  {
    name: 'Email',
    shortName: 'EM',
    category: 'Delivery',
    status: 'ready',
    description: 'Route reviewed briefs and follow-up drafts to inbox workflows.',
    lane: 'delivery',
    tone: 'amber',
  },
  {
    name: 'Stripe',
    shortName: 'ST',
    category: 'Revenue',
    status: 'ready',
    description: 'Bring subscription, failed payment, and revenue signals into recurring runs.',
    lane: 'input',
    tone: 'emerald',
  },
  {
    name: 'PostHog',
    shortName: 'PH',
    category: 'Product analytics',
    status: 'ready',
    description: 'Connect activation and usage patterns to founder briefs.',
    lane: 'input',
    tone: 'cyan',
  },
  {
    name: 'GitHub',
    shortName: 'GH',
    category: 'Engineering',
    status: 'ready',
    description: 'Turn shipped work and code changes into release intelligence.',
    lane: 'input',
    tone: 'slate',
  },
  {
    name: 'Linear',
    shortName: 'LN',
    category: 'Product',
    status: 'ready',
    description: 'Use issues, cycles, and release notes as structured product context.',
    lane: 'input',
    tone: 'violet',
  },
  {
    name: 'Google Drive',
    shortName: 'GD',
    category: 'Knowledge',
    status: 'planned',
    description: 'Pull approved docs, research, and operating context into runs.',
    lane: 'input',
    tone: 'amber',
  },
  {
    name: 'Notion',
    shortName: 'NO',
    category: 'Knowledge',
    status: 'planned',
    description: 'Use team knowledge bases as source material for reviewed work.',
    lane: 'input',
    tone: 'slate',
  },
  {
    name: 'HubSpot',
    shortName: 'HS',
    category: 'CRM',
    status: 'planned',
    description: 'Connect pipeline context to follow-up and account monitoring.',
    lane: 'input',
    tone: 'amber',
  },
  {
    name: 'Salesforce',
    shortName: 'SF',
    category: 'CRM',
    status: 'planned',
    description: 'Bring enterprise account context into governed workflow runs.',
    lane: 'input',
    tone: 'cyan',
  },
  {
    name: 'Discord',
    shortName: 'DC',
    category: 'Delivery',
    status: 'planned',
    description: 'Route reviewed community work into team and customer channels.',
    lane: 'delivery',
    tone: 'violet',
  },
  {
    name: 'Telegram',
    shortName: 'TG',
    category: 'Delivery',
    status: 'planned',
    description: 'Approve briefs and alerts from mobile-first team workflows.',
    lane: 'delivery',
    tone: 'cyan',
  },
  {
    name: 'iMessage',
    shortName: 'IM',
    category: 'Delivery',
    status: 'planned',
    description: 'Bring lightweight founder approvals to personal work channels later.',
    lane: 'delivery',
    tone: 'emerald',
  },
];

export const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: 'per month',
    description: 'For one operator proving the first recurring workflow.',
    capacity: '3 active workflows',
    cta: 'Select Starter',
    features: [
      '500 Violema credits',
      'Web research and scheduled runs',
      'Email support',
      'Basic run history',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$79',
    period: 'per month',
    description: 'For founders running recurring reports, monitors, and follow-up.',
    capacity: '20 active workflows',
    cta: 'Select Pro',
    featured: true,
    features: [
      '2,000 Violema credits',
      'Multi-step workflow runs',
      'Slack and email delivery',
      'Approval gates and run logs',
      'Long-term workspace memory',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$249',
    period: 'per month',
    description: 'For teams that need shared control, review, and higher volume.',
    capacity: '100 active workflows',
    cta: 'Select Team',
    features: [
      '7,500 Violema credits',
      '5 included seats',
      'Shared workspace memory',
      'Admin visibility',
      'Priority support',
    ],
    footnote: 'Extra seats default to $29 per seat per month.',
  },
];

export const pricingSignals = [
  { label: 'Active workflows', value: '3 to 100' },
  { label: 'Run credits', value: '500 to 7,500' },
  { label: 'Approvals', value: 'Built in' },
  { label: 'Run history', value: 'Auditable' },
];

export const comparisonRows = [
  {
    label: 'Primary promise',
    violema: 'Recurring work with review, delivery, and proof',
    aiEmployee: 'Broad agent support for ad hoc tasks',
    automation: 'Rules that run when inputs are predictable',
  },
  {
    label: 'Best fit',
    violema: 'Founder, ops, revenue, research, and product workflows',
    aiEmployee: 'General requests inside chat',
    automation: 'Stable deterministic processes',
  },
  {
    label: 'Control model',
    violema: 'Approvals, run logs, source links, retries, and credits',
    aiEmployee: 'Conversation history and workspace permissions',
    automation: 'Trigger logic and error notifications',
  },
  {
    label: 'Violema advantage',
    violema: 'Inspectability for work that repeats',
    aiEmployee: 'Breadth',
    automation: 'Predictability',
  },
];
