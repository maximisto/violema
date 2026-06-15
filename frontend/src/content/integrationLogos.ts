import { brandMarks } from './brandMarks';

export type IntegrationAppIcon =
  | 'browser'
  | 'calendar'
  | 'mail'
  | 'mcp'
  | 'message'
  | 'search'
  | 'team'
  | 'web'
  | 'workflow';

export type IntegrationLogoResolution =
  | { kind: 'brand'; label: string; path: string; icon?: undefined }
  | { kind: 'app'; label: string; icon: IntegrationAppIcon; path?: undefined }
  | { kind: 'initial'; label: string; icon?: undefined; path?: undefined };

export function normalizeIntegrationLogoName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const brandByKey = new Map(
  brandMarks.flatMap((mark) => [
    [normalizeIntegrationLogoName(mark.name), mark],
    [normalizeIntegrationLogoName(mark.name.replace(/^Google\s+/, '')), mark],
  ])
);

const brandAliases: Record<string, string> = {
  googleworkspace: 'gmail',
  googlemail: 'gmail',
  slackapp: 'slack',
  githubissues: 'github',
  githubrepos: 'github',
  stripebilling: 'stripe',
  stripepayments: 'stripe',
  posthoganalytics: 'posthog',
  hubspotcrm: 'hubspot',
};

function resolveAppIcon(normalized: string): IntegrationAppIcon | undefined {
  if (normalized.includes('mcp') || normalized.includes('connector')) return 'mcp';
  if (normalized.includes('calendar')) return 'calendar';
  if (normalized.includes('outlook') || normalized.includes('email') || normalized.includes('mail')) return 'mail';
  if (normalized.includes('teams') || normalized.includes('team')) return 'team';
  if (normalized.includes('imessage') || normalized.includes('message') || normalized.includes('discord')) return 'message';
  if (normalized.includes('browser') || normalized.includes('screenshot') || normalized.includes('capture')) return 'browser';
  if (normalized.includes('search') || normalized.includes('research')) return 'search';
  if (normalized.includes('workflow') || normalized.includes('automation')) return 'workflow';
  if (normalized === 'web' || normalized.includes('webapp') || normalized.includes('platform')) return 'web';
  return undefined;
}

export function resolveIntegrationLogo(name: string): IntegrationLogoResolution {
  const trimmed = name.trim();
  const normalized = normalizeIntegrationLogoName(trimmed);
  const brandKey = brandAliases[normalized] || normalized;
  const brand = brandByKey.get(brandKey);

  if (brand) {
    return { kind: 'brand', label: brand.name, path: brand.path };
  }

  if (normalized.includes('violema')) {
    return { kind: 'initial', label: 'V' };
  }

  const icon = resolveAppIcon(normalized);
  if (icon) {
    return { kind: 'app', label: trimmed || icon, icon };
  }

  return { kind: 'initial', label: (trimmed || '?').slice(0, 1).toUpperCase() };
}
