export type SampleRunPlanId = 'pro' | 'team' | 'enterprise';

export interface SampleRunStep {
  title: string;
  detail: string;
  credits: number;
}

export interface SampleRun {
  id: string;
  planId: SampleRunPlanId;
  planLabel: string;
  title: string;
  summary: string;
  cadence: string;
  runCredits: number;
  monthlyRuns: number;
  providerCostUsd: number;
  approvalState: string;
  sources: string[];
  ledger: string[];
  steps: SampleRunStep[];
  deliverable: string;
  recommendedPlan: string;
  buyerTakeaway: string;
}

export const CREDIT_VALUE_USD = 0.0395;

export const SAMPLE_RUNS: SampleRun[] = [
  {
    id: 'pricing-proof-founder-brief',
    planId: 'pro',
    planLabel: 'Start sample',
    title: 'Founder market brief',
    summary: 'Weekly competitor and pricing scan with sources, a draft founder note, review, and Slack delivery.',
    cadence: 'Weekly',
    runCredits: 56,
    monthlyRuns: 4,
    providerCostUsd: 0.74,
    approvalState: 'Reviewed',
    sources: ['Pricing pages', 'Launch notes', 'Funding coverage'],
    ledger: ['Source scan completed', 'Brief drafted', 'Founder approval recorded', 'Slack update sent'],
    steps: [
      {
        title: 'Search market signals',
        detail: 'Check pricing pages, launch notes, and funding coverage for material changes.',
        credits: 16,
      },
      {
        title: 'Draft founder brief',
        detail: 'Turn evidence into a short decision memo with suggested sales language.',
        credits: 22,
      },
      {
        title: 'Review and deliver',
        detail: 'Hold the draft for approval, then post the final note into Slack.',
        credits: 18,
      },
    ],
    deliverable: 'Source-linked weekly note for the founder or operator.',
    recommendedPlan: 'Start at $79/month',
    buyerTakeaway: 'A focused weekly mission fits inside Start with room for iteration.',
  },
  {
    id: 'pricing-proof-operating-cadence',
    planId: 'team',
    planLabel: 'Pro sample',
    title: 'Revenue and delivery monitor',
    summary: 'Twice-weekly Stripe, GitHub, and Slack check that flags revenue movement, blockers, and follow-up work.',
    cadence: 'Twice weekly',
    runCredits: 72,
    monthlyRuns: 8,
    providerCostUsd: 1.08,
    approvalState: 'Approval gate',
    sources: ['Stripe snapshot', 'GitHub blockers', 'Slack queue'],
    ledger: ['Data read completed', 'Exceptions detected', 'Review requested', 'Digest delivered'],
    steps: [
      {
        title: 'Read operating sources',
        detail: 'Pull revenue movement, delivery blockers, and open team follow-ups.',
        credits: 24,
      },
      {
        title: 'Detect exceptions',
        detail: 'Compare current signals against the prior digest and mark what changed.',
        credits: 20,
      },
      {
        title: 'Prepare review digest',
        detail: 'Create the operator-ready update and wait for approval before sending.',
        credits: 28,
      },
    ],
    deliverable: 'Twice-weekly operating digest with owner-ready follow-ups.',
    recommendedPlan: 'Pro at $249/month',
    buyerTakeaway: 'Recurring multi-source cadence belongs in Pro once the workflow runs every week.',
  },
  {
    id: 'pricing-proof-enterprise-readiness',
    planId: 'enterprise',
    planLabel: 'Enterprise sample',
    title: 'Executive operating digest',
    summary: 'Daily multi-workspace digest with evidence links, owner routing, budget pressure, and admin visibility.',
    cadence: 'Daily weekday',
    runCredits: 118,
    monthlyRuns: 22,
    providerCostUsd: 2.05,
    approvalState: 'Policy reviewed',
    sources: ['Workspace metrics', 'CRM activity', 'Support risk'],
    ledger: ['Admin scope checked', 'Digest assembled', 'Policy review passed', 'Owners notified'],
    steps: [
      {
        title: 'Check admin scope',
        detail: 'Confirm workspace and role boundaries before reading cross-team signals.',
        credits: 30,
      },
      {
        title: 'Assemble executive digest',
        detail: 'Summarize operating movement, risks, owners, and evidence links.',
        credits: 48,
      },
      {
        title: 'Route by policy',
        detail: 'Apply review policy, route owners, and log the delivery proof.',
        credits: 40,
      },
    ],
    deliverable: 'Daily executive digest with policy review and owner routing.',
    recommendedPlan: 'Enterprise custom',
    buyerTakeaway: 'Daily cross-workspace proof needs custom controls, mission volume, and security review.',
  },
];

export function getMonthlyCredits(run: SampleRun) {
  return run.runCredits * run.monthlyRuns;
}

export function getCreditValueUsd(run: SampleRun) {
  return run.runCredits * CREDIT_VALUE_USD;
}

export function getSampleRunById(id: string | undefined) {
  return SAMPLE_RUNS.find((run) => run.id === id) || null;
}

export function getSampleRunPath(runId: string) {
  return `/runs/${runId}`;
}

export function formatSampleUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
