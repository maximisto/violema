/**
 * Capability, not just presence.
 *
 * THE INCIDENT THIS EXISTS FOR
 *
 * A tenant's Google Drive showed "connected" in the UI. It was connected — with
 * `drive.metadata.readonly`, which can list a file's name and nothing more. The
 * mission that writes the intelligence library therefore failed at run time,
 * after the expensive work, with a Drive permission error. "Connected" had
 * answered a question nobody was asking. What the founder needed to know was
 * "can this connection do the thing the mission needs?"
 *
 * So a connected toolkit now reports what it can actually DO:
 *
 *   { slug, connected, capabilities, missing, sufficientFor, scopeVisibility }
 *
 * ── The honesty rule ─────────────────────────────────────────────────────────
 *
 * Capabilities are derived from the scopes the provider actually granted. Where
 * a connection does not expose its scopes, `scopeVisibility` is `'unknown'` and
 * `capabilities`/`missing`/`sufficientFor` are all empty — we do not guess, in
 * either direction. Claiming a capability we cannot verify would recreate the
 * exact bug this module exists to kill; claiming one is *missing* when we simply
 * cannot see it would send a founder to re-authorise a connection that was fine.
 *
 * `unknown` therefore means "Violema cannot tell", and the UI must say so.
 *
 * ── Where the scope data comes from ──────────────────────────────────────────
 *
 * Verified against the installed `@composio/core` SDK
 * (`Oauth2ActiveConnectionDataSchema` in `BaseProvider-*.d.mts`): an ACTIVE
 * OAuth2 connected account carries `state.scope` (string | string[] | null) and,
 * for Slack, `state.authed_user.scope`. The raw REST wire nests the same data
 * under `state.val`. `readGrantedScopes` in `composioBridge.ts` reads both
 * shapes — and reads ONLY the scope field, because `state` is the live
 * credential blob.
 */

import type { ComposioConnectionRecord } from '../composioBridge';
import { COMPOSIO_PENDING_STATUSES } from '../composioBridge';
import { normalizeAppName } from './partnerAppMap';

/**
 * Product-level capability ids. Deliberately not raw OAuth scopes: the UI and
 * the readiness copy speak in terms of what a mission needs to do, and the
 * scope vocabulary differs per provider for the same underlying ability.
 */
export const PARTNER_CAPABILITIES = {
  DRIVE_METADATA: 'drive.metadata',
  DRIVE_READ: 'drive.read',
  DRIVE_WRITE: 'drive.write',
  SLACK_POST: 'slack.post',
  SLACK_CUSTOMIZE_IDENTITY: 'slack.customize_identity',
  SLACK_LIST_CHANNELS: 'slack.list_channels',
  GMAIL_READ: 'gmail.read',
  CALENDAR_READ: 'calendar.read',
} as const;

export type PartnerCapability = (typeof PARTNER_CAPABILITIES)[keyof typeof PARTNER_CAPABILITIES];

/**
 * Violema features a capability set can serve. These are what the connect
 * surface actually promises a founder, so they are named for the outcome
 * ("write the library") rather than for the API call behind it.
 */
export const PARTNER_FEATURES = {
  LIBRARY_WRITE: 'library_write',
  LIBRARY_READ: 'library_read',
  DRIVE_EVIDENCE: 'drive_evidence',
  SLACK_DELIVERY: 'slack_delivery',
  SLACK_BRANDED_DELIVERY: 'slack_branded_delivery',
  SLACK_CHANNEL_PICKER: 'slack_channel_picker',
  EMAIL_DIGEST: 'email_digest',
  CALENDAR_DIGEST: 'calendar_digest',
} as const;

export type PartnerFeature = (typeof PARTNER_FEATURES)[keyof typeof PARTNER_FEATURES];

/**
 * A capability is granted when the connection holds ANY of the listed scopes.
 *
 * Google's Drive scopes are a strict ladder and the order matters:
 *   drive                     full access            → metadata, read, write
 *   drive.file                app-created files      → metadata, read, write
 *   drive.readonly            read every file        → metadata, read
 *   drive.metadata.readonly   names and ids only     → metadata
 *
 * `drive.metadata.readonly` is the one the tenant actually had. It satisfies
 * `DRIVE_METADATA` and nothing else, which is precisely why the library write
 * failed while the UI said "connected".
 */
const CAPABILITY_SCOPES: Record<string, Partial<Record<PartnerCapability, string[]>>> = {
  googledrive: {
    [PARTNER_CAPABILITIES.DRIVE_METADATA]: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
    [PARTNER_CAPABILITIES.DRIVE_READ]: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    [PARTNER_CAPABILITIES.DRIVE_WRITE]: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  },
  gmail: {
    [PARTNER_CAPABILITIES.GMAIL_READ]: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://mail.google.com/',
    ],
  },
  googlecalendar: {
    [PARTNER_CAPABILITIES.CALENDAR_READ]: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ],
  },
  // Slack scopes are bare tokens rather than URLs. `chat:write.customize` is the
  // one that lets a bot override `username` and `icon_url` — without it a send
  // still succeeds, it just posts under the Composio app's identity.
  slackbot: {
    [PARTNER_CAPABILITIES.SLACK_POST]: ['chat:write', 'chat:write:bot'],
    [PARTNER_CAPABILITIES.SLACK_CUSTOMIZE_IDENTITY]: ['chat:write.customize'],
    [PARTNER_CAPABILITIES.SLACK_LIST_CHANNELS]: ['channels:read', 'groups:read'],
  },
  slack: {
    [PARTNER_CAPABILITIES.SLACK_POST]: ['chat:write', 'chat:write:user', 'chat:write:bot'],
    [PARTNER_CAPABILITIES.SLACK_CUSTOMIZE_IDENTITY]: ['chat:write.customize'],
    [PARTNER_CAPABILITIES.SLACK_LIST_CHANNELS]: ['channels:read', 'groups:read'],
  },
};

/** Every capability Violema knows how to derive for a toolkit. */
function knownCapabilitiesFor(toolkit: string): PartnerCapability[] {
  return Object.keys(CAPABILITY_SCOPES[toolkit] || {}) as PartnerCapability[];
}

/** Which features a toolkit can offer, and what each one requires. */
const FEATURE_REQUIREMENTS: Record<string, Partial<Record<PartnerFeature, PartnerCapability[]>>> = {
  googledrive: {
    [PARTNER_FEATURES.LIBRARY_WRITE]: [PARTNER_CAPABILITIES.DRIVE_WRITE],
    [PARTNER_FEATURES.LIBRARY_READ]: [PARTNER_CAPABILITIES.DRIVE_READ],
    [PARTNER_FEATURES.DRIVE_EVIDENCE]: [PARTNER_CAPABILITIES.DRIVE_METADATA],
  },
  gmail: {
    [PARTNER_FEATURES.EMAIL_DIGEST]: [PARTNER_CAPABILITIES.GMAIL_READ],
  },
  googlecalendar: {
    [PARTNER_FEATURES.CALENDAR_DIGEST]: [PARTNER_CAPABILITIES.CALENDAR_READ],
  },
  slackbot: {
    [PARTNER_FEATURES.SLACK_DELIVERY]: [PARTNER_CAPABILITIES.SLACK_POST],
    [PARTNER_FEATURES.SLACK_BRANDED_DELIVERY]: [
      PARTNER_CAPABILITIES.SLACK_POST,
      PARTNER_CAPABILITIES.SLACK_CUSTOMIZE_IDENTITY,
    ],
    [PARTNER_FEATURES.SLACK_CHANNEL_PICKER]: [PARTNER_CAPABILITIES.SLACK_LIST_CHANNELS],
  },
  slack: {
    [PARTNER_FEATURES.SLACK_DELIVERY]: [PARTNER_CAPABILITIES.SLACK_POST],
    [PARTNER_FEATURES.SLACK_BRANDED_DELIVERY]: [
      PARTNER_CAPABILITIES.SLACK_POST,
      PARTNER_CAPABILITIES.SLACK_CUSTOMIZE_IDENTITY,
    ],
    [PARTNER_FEATURES.SLACK_CHANNEL_PICKER]: [PARTNER_CAPABILITIES.SLACK_LIST_CHANNELS],
  },
};

/**
 * Whether Violema could read this connection's grants.
 *
 * - `granted`: the provider exposed scopes; capabilities are authoritative.
 * - `unknown`: it did not. Capabilities are empty and mean nothing.
 * - `not_connected`: there is no active connection to describe.
 */
export type ScopeVisibility = 'granted' | 'unknown' | 'not_connected';

export interface PartnerToolkitCapability {
  slug: string;
  connected: boolean;
  /** Product capabilities this connection demonstrably has. */
  capabilities: PartnerCapability[];
  /** Known capabilities for this toolkit that the connection demonstrably lacks. */
  missing: PartnerCapability[];
  /** Violema features this connection can serve today. */
  sufficientFor: PartnerFeature[];
  /** Whether `capabilities`/`missing` mean anything at all. */
  scopeVisibility: ScopeVisibility;
}

/** A connection the user started and never finished. */
export interface PendingPartnerConnection {
  slug: string;
  initiatedAt?: string;
  connectionRequestId?: string;
}

export interface PartnerCapabilityReport {
  /** Toolkits with at least one ACTIVE connection. */
  capabilities: PartnerToolkitCapability[];
  pending: PendingPartnerConnection[];
  /** Slugs with an ACTIVE connection — the existing "connected" notion. */
  connectedApps: string[];
}

function matchesScope(granted: Set<string>, candidates: string[]): boolean {
  return candidates.some((scope) => granted.has(scope));
}

/**
 * Derive one toolkit's capability picture from its ACTIVE connections.
 *
 * A workspace can hold several accounts for one toolkit (`allowMultiple: true`
 * on link). Their scopes are unioned: if any active connection can write to
 * Drive, the workspace can write to Drive. Visibility is `granted` as soon as
 * one connection reports scopes — a second connection that hides them cannot
 * retract what the first proved.
 */
export function describeToolkitCapability(
  slug: string,
  connections: ComposioConnectionRecord[],
): PartnerToolkitCapability {
  const active = connections.filter((connection) => connection.status === 'ACTIVE');

  if (active.length === 0) {
    return {
      slug,
      connected: false,
      capabilities: [],
      missing: [],
      sufficientFor: [],
      scopeVisibility: 'not_connected',
    };
  }

  const withScopes = active.filter((connection) => connection.grantedScopes !== null);
  if (withScopes.length === 0) {
    // Connected, but the provider told us nothing about grants. Say exactly
    // that rather than inventing either a capability or a gap.
    return {
      slug,
      connected: true,
      capabilities: [],
      missing: [],
      sufficientFor: [],
      scopeVisibility: 'unknown',
    };
  }

  const granted = new Set<string>();
  for (const connection of withScopes) {
    for (const scope of connection.grantedScopes || []) granted.add(scope);
  }

  const known = knownCapabilitiesFor(slug);
  const scopeMap = CAPABILITY_SCOPES[slug] || {};
  const capabilities = known.filter((capability) =>
    matchesScope(granted, scopeMap[capability] || []),
  );
  const held = new Set<PartnerCapability>(capabilities);
  const missing = known.filter((capability) => !held.has(capability));

  const featureMap = FEATURE_REQUIREMENTS[slug] || {};
  const sufficientFor = (Object.keys(featureMap) as PartnerFeature[]).filter((feature) =>
    (featureMap[feature] || []).every((capability) => held.has(capability)),
  );

  return {
    slug,
    connected: true,
    capabilities,
    missing,
    sufficientFor,
    scopeVisibility: 'granted',
  };
}

/**
 * Turn a raw Composio inventory into the capability + pending report the
 * catalog serves.
 *
 * Only `ACTIVE` counts as connected. `EXPIRED`, `FAILED`, `INACTIVE`, and
 * `REVOKED` are all reported as not connected — an expired Drive token can no
 * more write the library than an absent one, and showing it as connected is the
 * same lie in a different costume.
 */
export function buildPartnerCapabilityReport(
  connections: ComposioConnectionRecord[],
): PartnerCapabilityReport {
  const byToolkit = new Map<string, ComposioConnectionRecord[]>();
  for (const connection of connections) {
    const slug = normalizeAppName(connection.toolkit);
    if (!slug) continue;
    const bucket = byToolkit.get(slug);
    if (bucket) bucket.push(connection);
    else byToolkit.set(slug, [connection]);
  }

  const capabilities: PartnerToolkitCapability[] = [];
  const connectedApps: string[] = [];

  for (const [slug, toolkitConnections] of byToolkit) {
    const report = describeToolkitCapability(slug, toolkitConnections);
    if (!report.connected) continue;
    capabilities.push(report);
    connectedApps.push(slug);
  }

  const pending: PendingPartnerConnection[] = connections
    .filter((connection) => COMPOSIO_PENDING_STATUSES.includes(connection.status))
    .map((connection) => ({
      slug: normalizeAppName(connection.toolkit),
      ...(connection.createdAt ? { initiatedAt: connection.createdAt } : {}),
      // Composio's connected-account id is what `link()` hands back as the
      // connection request id, so it is the handle the UI already knows.
      ...(connection.id ? { connectionRequestId: connection.id } : {}),
    }))
    .filter((entry) => Boolean(entry.slug));

  return {
    capabilities: capabilities.sort((left, right) => left.slug.localeCompare(right.slug)),
    pending,
    connectedApps: connectedApps.sort(),
  };
}

/**
 * Does this workspace hold a specific capability?
 *
 * Returns `'yes' | 'no' | 'unknown'` rather than a boolean on purpose. Callers
 * that gate an expensive or destructive action (provisioning the library, say)
 * need to distinguish "we know it cannot" from "we cannot tell": the first
 * justifies refusing up front, the second means try and let the provider be the
 * authority.
 */
export function hasCapability(
  report: PartnerCapabilityReport,
  slug: string,
  capability: PartnerCapability,
): 'yes' | 'no' | 'unknown' {
  const toolkit = report.capabilities.find((entry) => entry.slug === normalizeAppName(slug));
  if (!toolkit || !toolkit.connected) return 'no';
  if (toolkit.scopeVisibility !== 'granted') return 'unknown';
  return toolkit.capabilities.includes(capability) ? 'yes' : 'no';
}
