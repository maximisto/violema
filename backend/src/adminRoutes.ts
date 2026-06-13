import type { Express, Request, Response } from 'express';
import {
  buildAdminAudit,
  buildAdminOverview,
  buildAdminUsers,
  buildAdminWorkspaces,
  buildWorkspaceAdminDetail,
} from './adminDashboard';
import { setAccessStatus, type AdminAccessRole, type AdminAccessStatus } from './adminAccessStore';
import { clearAuthSessionsForEmail } from './auth';

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

export function parseAdminAccessRole(value: unknown): AdminAccessRole {
  if (value === undefined || value === null || value === '') return 'user';
  if (value === 'admin' || value === 'user') return value;
  throw new Error('role must be admin or user');
}

export function parseAdminEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || !/\S+@\S+\.\S+/.test(email)) throw new Error('valid email is required');
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
  },
) {
  app.get('/api/admin/overview', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      res.json(buildAdminOverview());
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.get('/api/admin/users', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      res.json({ items: buildAdminUsers() });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.patch('/api/admin/users/:email/access', (req, res) => {
    try {
      const actorEmail = assertAdminActor(options.getAdminActor(req));
      const email = parseAdminEmail(req.params.email);
      const status = parseAdminAccessStatus(req.body?.status);
      const role = parseAdminAccessRole(req.body?.role);
      const record = setAccessStatus({
        email,
        status,
        role,
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
      const role = parseAdminAccessRole(req.body?.role);
      const record = setAccessStatus({
        email,
        status: 'approved',
        role,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
        updatedBy: actorEmail,
      });
      res.json({ ok: true, record, users: buildAdminUsers() });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.get('/api/admin/workspaces', (req, res) => {
    try {
      assertAdminActor(options.getAdminActor(req));
      res.json({ items: buildAdminWorkspaces() });
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
