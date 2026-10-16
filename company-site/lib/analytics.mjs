// Visit statistics: Umami, self-hosted on the VPS that serves violema.com, shared with psychdoc.ai (runbook:
// maximisto/psychdoc-ai docs/analytics.md; nginx exposes /stats/script.js and /stats/api/send only).
//
// Committed, not read from the environment, so a release bundle stays byte-reproducible from its commit. Both values stay
// null until Max creates the violema.com website in Umami; then set them together in one commit. While websiteId is null,
// no tracker renders and the privacy page keeps its no-analytics wording (lib/legal.mjs reads the same switch).
export const analytics = Object.freeze({
  /** Umami's website ID for violema.com: public, it ships in every page. */
  websiteId: null,
  /** The date the analytics wording takes effect on the privacy page, as YYYY-MM-DD. */
  policyDate: null,
});

/** Shared with psychdoc.ai's Umami: its daily purge and 7-day backups (psychdoc-ai ops/analytics/). Change together. */
export const ANALYTICS_RETENTION_MONTHS = 24;
export const ANALYTICS_BACKUP_EXPIRY_DAYS = 8;

export const TRACKER_SRC = '/stats/script.js';
const DOMAINS = 'violema.com,www.violema.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the tracker is on. Throws at build time on a half-set or malformed switch rather than shipping one. */
export function analyticsEnabled(config = analytics) {
  if (config.websiteId === null && config.policyDate === null) return false;
  if (!UUID.test(config.websiteId ?? '')) throw new Error('analytics.websiteId must be a UUID from the Umami dashboard');
  if (!ISO_DATE.test(config.policyDate ?? '')) throw new Error('analytics.policyDate must be YYYY-MM-DD when websiteId is set');
  return true;
}

/**
 * Umami's tracker as a plain deferred script, or nothing. It runs only on violema.com, honours Do Not Track and drops
 * query strings and hashes (the evidence lab keeps selections in the fragment).
 */
export function analyticsScript(config = analytics) {
  if (!analyticsEnabled(config)) return '';
  return `<script defer src="${TRACKER_SRC}" data-website-id="${config.websiteId}" data-domains="${DOMAINS}" data-do-not-track="true" data-exclude-search="true" data-exclude-hash="true"></script>`;
}
