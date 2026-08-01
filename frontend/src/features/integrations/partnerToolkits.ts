/**
 * Toolkit-slug normalisation for the partner (Composio) connection surface.
 *
 * Three vocabularies meet on the integrations page and they do not agree:
 *   - workflow readiness blockers deep-link with the *source* id (`email`,
 *     `calendar`, `google_drive`)
 *   - the partner catalog lists apps by partner app name / label
 *   - the backend reports connections as normalised toolkit slugs
 *     (`gmail`, `googlecalendar`, `googledrive`)
 *
 * Folding every side through the same normaliser is what keeps a connected app
 * from rendering as "Connect" — the previous raw `toLowerCase()` comparison
 * missed every slug whose punctuation differed.
 */

export interface PartnerAppLike {
  name: string;
  label?: string;
  partnerAppName?: string;
  sources?: string[];
}

/** Backend-compatible fold: lowercase, strip everything that is not a-z0-9. */
export function normalizeToolkitSlug(value: string | null | undefined): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

/**
 * Workflow source ids that do not normalise to their own toolkit slug.
 * Anything absent from this map is assumed to already be a slug.
 */
const SOURCE_TOOLKIT_SLUGS: Record<string, string> = {
  email: 'gmail',
  calendar: 'googlecalendar',
  googledrive: 'googledrive',
  github: 'github',
  linear: 'linear',
};

/** Resolve a source id, partner app name, or raw slug to a toolkit slug. */
export function resolveToolkitSlug(value: string | null | undefined): string {
  const normalized = normalizeToolkitSlug(value);
  if (!normalized) return '';
  return SOURCE_TOOLKIT_SLUGS[normalized] || normalized;
}

/**
 * Every toolkit slug a catalog entry can legitimately answer to. Labels are
 * only normalised (never source-mapped) so a delivery entry labelled "Email"
 * can never claim a Gmail connection.
 */
export function getPartnerAppSlugs(app: PartnerAppLike): string[] {
  const slugs = [
    resolveToolkitSlug(app.name),
    resolveToolkitSlug(app.partnerAppName),
    ...(Array.isArray(app.sources) ? app.sources.map(resolveToolkitSlug) : []),
    normalizeToolkitSlug(app.label),
  ].filter(Boolean);

  return Array.from(new Set(slugs));
}

export function isPartnerAppConnected(app: PartnerAppLike, connectedApps: string[]): boolean {
  if (!Array.isArray(connectedApps) || connectedApps.length === 0) return false;
  const connected = new Set(connectedApps.map(resolveToolkitSlug).filter(Boolean));
  return getPartnerAppSlugs(app).some((slug) => connected.has(slug));
}

export function isSlugConnected(slug: string, connectedApps: string[]): boolean {
  if (!slug || !Array.isArray(connectedApps)) return false;
  return connectedApps.some((connectedApp) => resolveToolkitSlug(connectedApp) === slug);
}
