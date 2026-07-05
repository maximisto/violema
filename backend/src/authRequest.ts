import type { Request } from 'express';
import type { AuthUserRecord } from './auth';
import type { AdminActor } from './adminRoutes';

export type AuthenticatedRequest = Request & { authUser?: AuthUserRecord };

export function getAuthenticatedUser(req: Request) {
  return (req as AuthenticatedRequest).authUser || null;
}

function createAdminAccessError(message = 'Admin access required') {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 403;
  return error;
}

export function getAuthenticatedAdminActor(req: Request): AdminActor {
  const user = getAuthenticatedUser(req);
  if (!user) {
    const error = createAdminAccessError('Admin session required');
    error.statusCode = 401;
    throw error;
  }

  return {
    email: user.email,
    role: user.role,
  };
}

export function assertAuthenticatedAdminAccess(req: Request) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    throw createAdminAccessError();
  }
  return user.email;
}
