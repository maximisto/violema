// Explicit `.ts` specifier allowed here (allowImportingTsExtensions) so the
// Node contract test can import this module directly, matching deliveryLane.ts.

/**
 * Turn an evidence source string into a clickable href, or nothing.
 *
 * Evidence source values are a grab bag: full URLs from web search results,
 * bare domains, provider slugs ("google_drive"), and prose ("Run output").
 * Only the first two are genuinely openable; rendering the rest as anchors
 * would manufacture destinations that do not exist. Any scheme other than
 * http(s) is rejected outright — an evidence card must never smuggle
 * javascript: or data: into an anchor.
 */
const BARE_DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/\S*)?$/i;

export function evidenceHref(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || /\s/.test(raw)) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!/^https?:\/\//i.test(raw)) return null;
    try {
      new URL(raw);
      return raw;
    } catch {
      return null;
    }
  }

  if (!BARE_DOMAIN.test(raw)) return null;
  try {
    new URL(`https://${raw}`);
    return `https://${raw}`;
  } catch {
    return null;
  }
}
