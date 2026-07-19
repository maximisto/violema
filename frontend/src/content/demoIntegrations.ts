export type DemoIntegrationCategory = 'Workflow data' | 'Delivery';

export interface DemoIntegration {
  id: string;
  name: string;
  category: DemoIntegrationCategory;
  detail: string;
  description: string;
  status: 'active';
}

export interface IdentityIntegration {
  id: string;
  name: string;
  category: 'Identity';
  detail: string;
  status: 'available';
}

export interface DeferredIntegration {
  id: string;
  name: string;
  detail: string;
  status: 'deferred';
}

export const DEMO_INTEGRATIONS: DemoIntegration[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Workflow data',
    detail: 'Revenue, subscriptions, churn, and payment risk',
    description: 'Read live revenue and billing signals without changing money movement.',
    status: 'active',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Workflow data',
    detail: 'Commitment and follow-up metadata',
    description: 'Read bounded message metadata for priority follow-ups without ingesting full email bodies.',
    status: 'active',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Workflow data',
    detail: 'Meetings, deadlines, and relationship commitments',
    description: 'Read a bounded seven-day event window for operating and relationship commitments.',
    status: 'active',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Workflow data',
    detail: 'Recently changed operating documents',
    description: 'Read file metadata for approved operating context without downloading document bodies.',
    status: 'active',
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Workflow data',
    detail: 'Delivery status, active work, and blockers',
    description: 'Read bounded product and delivery signals without creating or changing issues.',
    status: 'active',
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Workflow data',
    detail: 'Repositories, pull requests, issues, and commits',
    description: 'Read bounded engineering activity and delivery risk without modifying repositories.',
    status: 'active',
  },
  {
    id: 'web-search',
    name: 'Web search',
    category: 'Workflow data',
    detail: 'Current market and competitor research',
    description: 'Use live Tavily research to add current external evidence to recurring workflows.',
    status: 'active',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Delivery',
    detail: 'Primary approval and delivery surface',
    description: 'Hold drafts for review, then deliver approved updates to the selected team channel.',
    status: 'active',
  },
  {
    id: 'email',
    name: 'Email',
    category: 'Delivery',
    detail: 'Postmark delivery fallback',
    description: 'Send approved operator updates by email when Slack is not the right destination.',
    status: 'active',
  },
];

export const IDENTITY_INTEGRATIONS: IdentityIntegration[] = [
  {
    id: 'google-sign-in',
    name: 'Google sign-in',
    category: 'Identity',
    detail: 'Secure workspace access with Google',
    status: 'available',
  },
  {
    id: 'microsoft-sign-in',
    name: 'Microsoft sign-in',
    category: 'Identity',
    detail: 'Secure workspace access with Microsoft',
    status: 'available',
  },
];

export const DEFERRED_INTEGRATIONS: DeferredIntegration[] = [
  { id: 'notion', name: 'Notion', detail: 'Workspace knowledge and databases', status: 'deferred' },
  { id: 'hubspot', name: 'HubSpot', detail: 'CRM contacts, deals, and pipeline', status: 'deferred' },
  { id: 'airtable', name: 'Airtable', detail: 'Operating bases and records', status: 'deferred' },
  { id: 'figma', name: 'Figma', detail: 'Design files and review context', status: 'deferred' },
  { id: 'vercel', name: 'Vercel', detail: 'Deployments and release state', status: 'deferred' },
  { id: 'microsoft-teams', name: 'Microsoft Teams', detail: 'Team messaging and delivery', status: 'deferred' },
];
