import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import type { AuthUserRecord } from '../src/auth';
import {
  assertAuthenticatedAdminAccess,
  getAuthenticatedAdminActor,
  type AuthenticatedRequest,
} from '../src/authRequest';

function makeUser(role: AuthUserRecord['role'], email = `${role}@example.com`): AuthUserRecord {
  return {
    id: `user_${role}`,
    email,
    name: `${role} user`,
    role,
    method: 'email',
    workspaceIds: [`workspace_${role}`],
    defaultWorkspaceId: `workspace_${role}`,
    participantType: 'founder_operator',
    acceptedTerms: true,
    acceptedEducation: true,
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-04T00:00:00.000Z',
  };
}

function makeRequest(user?: AuthUserRecord): Request {
  return { authUser: user } as AuthenticatedRequest;
}

test('authenticated admin actor comes from the request user role only', () => {
  assert.deepEqual(getAuthenticatedAdminActor(makeRequest(makeUser('admin', 'founder@example.com'))), {
    email: 'founder@example.com',
    role: 'admin',
  });

  assert.deepEqual(getAuthenticatedAdminActor(makeRequest(makeUser('user', 'max@violema.com'))), {
    email: 'max@violema.com',
    role: 'user',
  });
});

test('admin-only request guard rejects missing and non-admin request users', () => {
  assert.equal(assertAuthenticatedAdminAccess(makeRequest(makeUser('admin', 'founder@example.com'))), 'founder@example.com');

  assert.throws(
    () => assertAuthenticatedAdminAccess(makeRequest(makeUser('user', 'max@violema.com'))),
    (error) => error instanceof Error && /Admin access required/.test(error.message) && (error as Error & { statusCode?: number }).statusCode === 403,
  );
  assert.throws(
    () => assertAuthenticatedAdminAccess(makeRequest()),
    (error) => error instanceof Error && /Admin access required/.test(error.message) && (error as Error & { statusCode?: number }).statusCode === 403,
  );
});
