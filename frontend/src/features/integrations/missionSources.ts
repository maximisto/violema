/**
 * What each mission needs, derived locally.
 *
 * The command center has to answer "will my missions actually run?" for every
 * mission in the workspace. The obvious implementation — one
 * `/api/workflows/:id/readiness` call per mission on mount — costs N requests
 * on a surface the operator opens constantly, and it would still only cover the
 * two workflow ids the readiness service supports; every other mission comes
 * back `unsupported_workflow`. So requirements are derived from data the
 * dashboard already holds (template definitions and each live mission's own
 * steps), and the verdict comes from the catalog read the section already does
 * plus one superset readiness call.
 *
 * Nothing here touches the network, so it stays a pure unit under test.
 */

// Explicit `.ts` specifier so the Node contract test can import this directly.
import type { WorkflowTemplateDefinition } from '../../content/workflowTemplates.ts';

/** A step shape both live missions and template definitions satisfy. */
export interface MissionSourceStep {
  kind?: string;
  inputs?: Record<string, unknown> | null;
  deliveryTarget?: { channel?: 'slack' | 'email'; target?: string } | null;
}

export interface MissionSourceRequirement {
  /** Workflow source id as it appears in step inputs: 'stripe', 'email', 'google_drive'. */
  id: string;
  label: string;
  /** Optional sources never block a run; they thin the output. */
  optional: boolean;
}

export interface MissionSourceSubject {
  key: string;
  title: string;
  /** 'live' when the workspace already runs this mission; 'template' otherwise. */
  origin: 'live' | 'template';
  requirements: MissionSourceRequirement[];
}

/**
 * Sources Violema operates itself. They are real dependencies of a run, but the
 * operator cannot connect them and must never be offered a Connect button for
 * one — a dead button on a readiness list reads as a broken product.
 */
export const BUILT_IN_SOURCE_IDS = new Set([
  'tavily',
  'web_search',
  'websearch',
  'account_library',
  'platform_telemetry',
]);

const SOURCE_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  github: 'GitHub',
  linear: 'Linear',
  email: 'Gmail',
  gmail: 'Gmail',
  calendar: 'Google Calendar',
  googlecalendar: 'Google Calendar',
  google_drive: 'Google Drive',
  googledrive: 'Google Drive',
  posthog: 'PostHog',
  slack: 'Slack',
  slackbot: 'Slack',
  postmark: 'Email delivery',
  notion: 'Notion',
  hubspot: 'HubSpot',
  tavily: 'Web research',
  web_search: 'Web research',
  websearch: 'Web research',
  account_library: 'Intelligence library',
  platform_telemetry: 'Platform telemetry',
};

export function getMissionSourceLabel(id: string): string {
  const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
  if (!key) return '';
  return (
    SOURCE_LABELS[key]
    || SOURCE_LABELS[key.replace(/[^a-z0-9]/g, '')]
    || key.replace(/[_-]+/g, ' ')
  );
}

function readSource(step: MissionSourceStep): string {
  const raw = step.inputs?.source;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Source ids a step list depends on, in first-appearance order: every `query`
 * step's source, web research for any `search` step, and the delivery channel
 * of any `deliver` step.
 */
export function collectStepSourceIds(steps: MissionSourceStep[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const step of Array.isArray(steps) ? steps : []) {
    if (step?.kind === 'query') push(readSource(step));
    if (step?.kind === 'search') push('tavily');
    if (step?.kind === 'deliver') {
      const channel = step.deliveryTarget?.channel;
      if (channel === 'slack') push('slack');
      if (channel === 'email') push('postmark');
    }
  }

  return ids;
}

function toRequirements(ids: string[], optionalIds: Set<string>): MissionSourceRequirement[] {
  const seen = new Set<string>();
  return ids
    .map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => ({ id, label: getMissionSourceLabel(id), optional: optionalIds.has(id) }));
}

/**
 * Template requirements prefer the curated `requiredIntegrationIds`, because an
 * author can mark a source optional in a way a step list cannot express. The
 * four templates that predate those fields fall back to their steps.
 */
export function getTemplateRequirements(template: WorkflowTemplateDefinition): MissionSourceRequirement[] {
  const optionalIds = new Set((template.optionalIntegrationIds || []).map((id) => id.toLowerCase()));
  const required = (template.requiredIntegrationIds || []).map((id) => id.toLowerCase());

  if (required.length > 0) {
    return toRequirements([...required, ...optionalIds], optionalIds);
  }

  return toRequirements(collectStepSourceIds(template.steps), optionalIds);
}

export interface LiveMissionSourceInput {
  key: string;
  title: string;
  steps?: MissionSourceStep[] | null;
  /** Free-text delivery destination; an address implies email, anything else Slack. */
  notify?: string | null;
}

function inferNotifySource(notify?: string | null): string {
  const value = typeof notify === 'string' ? notify.trim() : '';
  if (!value) return '';
  return value.includes('@') ? 'postmark' : 'slack';
}

/**
 * One readiness subject per mission the workspace can run: live missions first
 * (real runs ride on them), then the templates not yet started. A template
 * whose title matches a live mission is dropped — the mission collection
 * already treats those as one loop, and listing both would double-count the
 * same requirement in the summary.
 */
export function buildMissionSourceSubjects(input: {
  liveMissions: LiveMissionSourceInput[];
  templates: WorkflowTemplateDefinition[];
}): MissionSourceSubject[] {
  const liveTitles = new Set(
    input.liveMissions.map((mission) => mission.title.trim().toLowerCase()).filter(Boolean),
  );

  const live: MissionSourceSubject[] = input.liveMissions.map((mission) => {
    const ids = collectStepSourceIds(mission.steps || []);
    const notifySource = inferNotifySource(mission.notify);
    if (notifySource) ids.push(notifySource);
    return {
      key: mission.key,
      title: mission.title,
      origin: 'live' as const,
      requirements: toRequirements(ids, new Set<string>()),
    };
  });

  const templates: MissionSourceSubject[] = input.templates
    .filter((template) => !liveTitles.has(template.title.trim().toLowerCase()))
    .map((template) => ({
      key: template.id,
      title: template.title,
      origin: 'template' as const,
      requirements: getTemplateRequirements(template),
    }));

  return [...live, ...templates];
}
