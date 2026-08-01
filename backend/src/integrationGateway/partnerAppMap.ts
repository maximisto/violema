/**
 * The single source of truth for how Violema's workflow source ids relate to
 * Composio toolkit slugs.
 *
 * Two vocabularies meet here:
 *
 * - **Source ids** (`email`, `calendar`, `google_drive`, …) are what workflow
 *   steps, readiness blockers, and `/integrations?provider=…` routes speak.
 * - **Toolkit slugs** (`gmail`, `googlecalendar`, `googledrive`, …) are what
 *   the Composio API speaks.
 *
 * Before this module the mapping was re-derived from string literals in
 * `workflowRuntimeStatus.ts` and the connect endpoint, which meant a rename in
 * one place silently broke connection detection in the other. Everything that
 * needs to cross the boundary should go through `resolvePartnerToolkit`.
 */

export const PARTNER_SOURCE_TO_TOOLKIT = {
  email: 'gmail',
  calendar: 'googlecalendar',
  google_drive: 'googledrive',
  linear: 'linear',
  github: 'github',
} as const;

export type PartnerSourceId = keyof typeof PARTNER_SOURCE_TO_TOOLKIT;
export type PartnerToolkitSlug = (typeof PARTNER_SOURCE_TO_TOOLKIT)[PartnerSourceId];

export const PARTNER_SOURCE_IDS = Object.keys(PARTNER_SOURCE_TO_TOOLKIT) as PartnerSourceId[];

export const PARTNER_TOOLKIT_SLUGS = Array.from(
  new Set(Object.values(PARTNER_SOURCE_TO_TOOLKIT)),
) as PartnerToolkitSlug[];

/**
 * Collapse a user- or provider-supplied app name to a comparable key:
 * lowercase, with every non-alphanumeric character removed. `Google Drive`,
 * `google-drive`, and `google_drive` all land on `googledrive`.
 */
export function normalizeAppName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Normalized lookup covering both vocabularies. `google_drive` (source) and
// `googledrive` (toolkit) normalize to the same key and to the same toolkit,
// so the collision is intentional and harmless.
const NORMALIZED_TO_TOOLKIT = new Map<string, PartnerToolkitSlug>([
  ...PARTNER_TOOLKIT_SLUGS.map(
    (slug) => [normalizeAppName(slug), slug] as [string, PartnerToolkitSlug],
  ),
  ...PARTNER_SOURCE_IDS.map(
    (source) =>
      [normalizeAppName(source), PARTNER_SOURCE_TO_TOOLKIT[source]] as [string, PartnerToolkitSlug],
  ),
]);

/**
 * Resolve a source id, a toolkit slug, or a punctuated/cased variant of either
 * to the canonical Composio toolkit slug. Returns `null` for anything Violema
 * does not map — callers must fail closed rather than guess a toolkit.
 */
export function resolvePartnerToolkit(
  input: string | null | undefined,
): PartnerToolkitSlug | null {
  if (typeof input !== 'string') return null;
  const key = normalizeAppName(input);
  if (!key) return null;
  return NORMALIZED_TO_TOOLKIT.get(key) ?? null;
}

/** Forward lookup for a known source id. */
export function toolkitForPartnerSource(source: PartnerSourceId): PartnerToolkitSlug {
  return PARTNER_SOURCE_TO_TOOLKIT[source];
}

/**
 * Reverse lookup: which Violema source ids read their data from this toolkit.
 * Returns `[]` for toolkits that are connectable but not a workflow data
 * source (Notion, HubSpot, …), which is what the catalog reports.
 */
export function sourcesForPartnerToolkit(
  toolkit: string | null | undefined,
): PartnerSourceId[] {
  const slug = resolvePartnerToolkit(toolkit);
  if (!slug) return [];
  return PARTNER_SOURCE_IDS.filter((source) => PARTNER_SOURCE_TO_TOOLKIT[source] === slug);
}

/**
 * Every string the connect/disconnect endpoints accept, sorted, for 400
 * responses that tell the caller what would have worked.
 */
export function listPartnerConnectOptions(): string[] {
  return Array.from(new Set<string>([...PARTNER_SOURCE_IDS, ...PARTNER_TOOLKIT_SLUGS])).sort();
}
