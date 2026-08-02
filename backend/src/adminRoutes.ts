import type { Express, Request, Response } from 'express';
import {
  buildAdminAudit,
  buildAdminOverview,
  buildAdminUsers,
  buildAdminWorkspaces,
  buildWorkspaceAdminDetail,
  filterAdminUsers,
  summarizeAdminUserFacets,
} from './adminDashboard';
import { buildAdminOperations, type PartnerConnectionReader } from './adminOperations';
import {
  setAccessParticipantType,
  setAccessRole,
  setAccessStageOverride,
  setAccessStatus,
  type AdminAccessRole,
  type AdminAccessStatus,
} from './adminAccessStore';
import { loadAdminDataset, scopeWorkspaces } from './adminDataset';
import { clearAuthSessionsForEmail } from './auth';
import { PARTICIPANT_TYPES, normalizeParticipantType, type ParticipantType } from './betaProgram';
import {
  ACCOUNT_STAGES,
  ACCOUNT_STAGE_OVERRIDES,
  normalizeAccountStage,
  normalizeAccountStageOverride,
  type AccountStage,
  type AccountStageOverride,
} from './platform/accountStage';

export interface AdminActor {
  email: string;
  role: 'user' | 'admin';
}

export function assertAdminActor(actor: AdminActor) {
  if (actor.role !== 'admin') {
    const error = new Error('Admin access required') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
  return actor.email;
}

export function parseAdminAccessStatus(value: unknown): AdminAccessStatus {
  if (value === 'approved' || value === 'revoked') return value;
  throw new Error('status must be approved or revoked');
}

export function parseAdminAccessRole(value: unknown): AdminAccessRole | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'admin' || value === 'user') return value;
  throw new Error('role must be admin or user');
}

export function parseRequiredAdminAccessRole(value: unknown): AdminAccessRole {
  if (value === 'admin' || value === 'user') return value;
  throw new Error('role must be admin or user');
}

function listOptions(values: readonly string[]) {
  if (values.length < 2) return values.join('');
  return `${values.slice(0, -1).join(', ')}, or ${values[values.length - 1]}`;
}

export function parseParticipantType(value: unknown): ParticipantType | undefined {
  if (value === undefined) return undefined;
  const participantType = normalizeParticipantType(value);
  if (!participantType) {
    // Generated from the canonical set so adding a type cannot leave the error
    // message advertising a stale list.
    throw new Error(`participant type must be ${listOptions(PARTICIPANT_TYPES)}`);
  }
  return participantType;
}

/**
 * Query filters arrive as `?stage=trial,paying` or as repeated `?stage=` params.
 * An absent filter yields `undefined` — "no constraint" — while an unrecognized
 * value is a 400 rather than a silent empty table.
 */
function parseEnumFilter<T extends string>(
  value: unknown,
  normalize: (candidate: unknown) => T | null,
  label: string,
  allowed: readonly string[],
): T[] | undefined {
  if (value === undefined) return undefined;
  const raw = (Array.isArray(value) ? value : [value])
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : [entry]))
    .map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
    .filter((entry) => entry !== '');
  if (raw.length === 0) return undefined;

  return raw.map((entry) => {
    const normalized = normalize(entry);
    if (!normalized) throw new Error(`${label} must be one of ${allowed.join(', ')}`);
    return normalized;
  });
}

export function parseAccountStageFilter(value: unknown): AccountStage[] | undefined {
  return parseEnumFilter(value, normalizeAccountStage, 'stage', ACCOUNT_STAGES);
}

export function parseParticipantTypeFilter(value: unknown): ParticipantType[] | undefined {
  return parseEnumFilter(value, normalizeParticipantType, 'participantType', PARTICIPANT_TYPES);
}

export function parseActivatedFilter(value: unknown): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw new Error('activated must be true or false');
}

export function parseAccountStageOverride(value: unknown): AccountStageOverride | null {
  if (value === null || value === undefined || value === '') return null;
  const override = normalizeAccountStageOverride(value);
  if (!override) {
    throw new Error(`stage override must be null or ${ACCOUNT_STAGE_OVERRIDES.join(', ')}`);
  }
  return override;
}

/**
 * Account stage is derived from billing, access, and ledger truth. A dashboard
 * whose stages can be hand-set drifts from reality and then lies to the
 * operator who trusts it, so an attempt to write one is refused loudly rather
 * than quietly ignored — a silently dropped field is how a caller comes to
 * believe it worked.
 */
export function assertNoDerivedStageWrite(body: unknown) {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  if (!record) return;
  if (record.accountStage !== undefined || record.stage !== undefined) {
    throw new Error(
      'accountStage is derived from billing, access, and ledger truth and cannot be set. '
      + 'Use the stage-override endpoint to mark an account internal.',
    );
  }
}

/**
 * Trailing window for the failure feed. Absent means the 24h default; a value
 * that is not a positive number is a 400 rather than a silent fallback, because
 * a silently ignored window makes the UI state a period it is not showing.
 */
export function parseWindowHours(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('windowHours must be a positive number of hours');
  }
  return parsed;
}

/**
 * Whether Violema's own default and demo workspaces count toward headline
 * numbers. Off by default: our demo runs are not customer reliability.
 */
export function parseIncludeInternal(value: unknown): boolean {
  if (value === undefined || value === '' || value === 'false' || value === false) return false;
  if (value === 'true' || value === true || value === '1') return true;
  throw new Error('includeInternal must be true or false');
}

/**
 * Refuse an admin's attempt to remove their own admin role.
 *
 * Violema has exactly one admin. A mis-click here is not a bad row in a table —
 * it locks the only operator out of his own dashboard, recoverable only by
 * editing `ADMIN_EMAILS` on the VPS and restarting. The guard is server-side on
 * purpose: a disabled button in the UI is not a control.
 */
export function assertNotSelfDemotion(
  actorEmail: string,
  targetEmail: string,
  next: { role?: AdminAccessRole; status?: AdminAccessStatus },
) {
  if (actorEmail.trim().toLowerCase() !== targetEmail.trim().toLowerCase()) return;
  if (next.role === 'user') {
    throw new Error(
      'You cannot remove your own admin role. Ask another admin, or change ADMIN_EMAILS on the server.',
    );
  }
  // Revoking your own access clears your sessions and fails the admin check on
  // the next request — the same lockout by a different door.
  if (next.status === 'revoked') {
    throw new Error(
      'You cannot revoke your own access. Ask another admin, or change ADMIN_EMAILS on the server.',
    );
  }
}

export function parseAdminEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) throw new Error('valid email is required');
  return email;
}

function sendAdminError(res: Response, error: unknown) {
  const statusCode = error instanceof Error && typeof (error as Error & { statusCode?: number }).statusCode === 'number'
    ? (error as Error & { statusCode: number }).statusCode
    : 400;
  res.status(statusCode).json({
    error: error instanceof Error ? error.message : 'Admin request failed',
  });
}

export function registerAdminRoutes(
  app: Express,
  options: {
    getAdminActor: (req: Request) => AdminActor;
    /** Overridable so a test server never reaches a live partner API. */
    readPartnerConnections?: PartnerConnectionReader;
  },
) {
  app.get('/api/admin/overview', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      res.json(buildAdminOverview({
        windowHours: parseWindowHours(req.query.windowHours),
        includeInternal: parseIncludeInternal(req.query.includeInternal),
      }));
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  /**
   * What to do right now, across every workspace. Metadata only, same
   * discipline as the overview — see `adminProjection.ts`.
   */
  app.get('/api/admin/operations', async (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      const snapshot = await buildAdminOperations({
        windowHours: parseWindowHours(req.query.windowHours),
        includeInternal: parseIncludeInternal(req.query.includeInternal),
        readPartnerConnections: options.readPartnerConnections,
      });
      res.json(snapshot);
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.get('/api/admin/users', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      const filters = {
        stage: parseAccountStageFilter(req.query.stage),
        participantType: parseParticipantTypeFilter(req.query.participantType),
        activated: parseActivatedFilter(req.query.activated),
      };
      const all = buildAdminUsers();
      const items = filterAdminUsers(all, filters);
      res.json({
        items,
        matched: items.length,
        // Facets are counted over the unfiltered set so narrowing to one stage
        // still shows where the rest of the base sits.
        counts: summarizeAdminUserFacets(all),
        filters: {
          stage: filters.stage ?? null,
          participantType: filters.participantType ?? null,
          activated: filters.activated ?? null,
        },
        catalog: {
          participantTypes: PARTICIPANT_TYPES,
          accountStages: ACCOUNT_STAGES,
        },
      });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.patch('/api/admin/users/:email/access', (req, res) => {
    try {
      const actorEmail = assertAdminActor(options.getAdminActor(req));
      assertNoDerivedStageWrite(req.body);
      const email = parseAdminEmail(req.params.email);
      const status = req.body?.status === undefined ? undefined : parseAdminAccessStatus(req.body.status);
      const role = parseAdminAccessRole(req.body?.role);
      const participantType = parseParticipantType(req.body?.participantType);
      assertNotSelfDemotion(actorEmail, email, { role, status });
      const record = status === undefined
        ? (() => {
            if (role !== undefined || participantType === undefined) {
              throw new Error('status or participant type is required');
            }
            return setAccessParticipantType({ email, participantType, updatedBy: actorEmail });
          })()
        : setAccessStatus({
            email,
            status,
            role,
            participantType,
            note: typeof req.body?.note === 'string' ? req.body.note : undefined,
            updatedBy: actorEmail,
          });
      if (status === 'revoked') clearAuthSessionsForEmail(email);
      res.json({ ok: true, record, users: buildAdminUsers() });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.patch('/api/admin/users/:email/role', (req, res) => {
    try {
      const actorEmail = assertAdminActor(options.getAdminActor(req));
      const email = parseAdminEmail(req.params.email);
      const role = parseRequiredAdminAccessRole(req.body?.role);
      assertNotSelfDemotion(actorEmail, email, { role });
      const record = setAccessRole({
        email,
        role,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
        updatedBy: actorEmail,
      });
      res.json({ ok: true, record, users: buildAdminUsers() });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  /**
   * The only writable input to account stage. `internal` or nothing — the
   * revenue stages stay derived from Stripe, and the actor is recorded.
   */
  app.patch('/api/admin/users/:email/stage-override', (req, res) => {
    try {
      const actorEmail = assertAdminActor(options.getAdminActor(req));
      const email = parseAdminEmail(req.params.email);
      const override = parseAccountStageOverride(req.body?.override);
      const record = setAccessStageOverride({ email, override, updatedBy: actorEmail });
      res.json({ ok: true, record, users: buildAdminUsers() });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.get('/api/admin/workspaces', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      const includeInternal = parseIncludeInternal(req.query.includeInternal);
      const dataset = loadAdminDataset();
      const scope = scopeWorkspaces(dataset, { includeInternal });
      res.json({
        items: buildAdminWorkspaces({ dataset, includeInternal }),
        includeInternal,
        excludedInternalWorkspaces: scope.excludedInternalWorkspaces,
      });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.get('/api/admin/workspaces/:workspaceId', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      res.json(buildWorkspaceAdminDetail(req.params.workspaceId));
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.get('/api/admin/audit', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      res.json({ items: buildAdminAudit(200) });
    } catch (error) {
      sendAdminError(res, error);
    }
  });
}
