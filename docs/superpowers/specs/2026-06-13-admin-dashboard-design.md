# Violema Admin Dashboard Design

## Purpose

Build an internal admin dashboard for Violema operators to manage beta access, inspect users, understand client/workspace health, and see operational performance without touching server files or JSON stores directly.

The first version is internal-only. It should be designed so the same backend summary layer can later power a client-facing analytics page filtered to a single workspace.

## Goals

- Give admins a single place to approve and revoke beta access.
- Show user, workspace, billing, task, run, automation, and credit health in one control surface.
- Make client/workspace performance legible enough to support beta operations and investor/customer conversations.
- Preserve the current JSON-backed storage model for speed.
- Keep all sensitive admin capabilities server-gated, not only hidden in the frontend.

## Non-Goals

- No database migration in V1.
- No client-facing analytics route in V1.
- No full CRM, support inbox, or team membership model yet.
- No destructive user deletion in V1.
- No arbitrary impersonation in V1.

## Product Shape

Route: `/admin`

Audience: Violema admins only.

Backend namespace: `/api/admin/*`

Admin access requires:

- an active Violema session cookie,
- approved beta access,
- `role: admin`.

The dashboard has four primary views.

## Views

### 1. Overview

Purpose: fast operator status.

Cards:

- approved users
- unapproved/pending users
- workspaces
- active automations
- total task runs
- run success rate
- failed runs in the last 7 days
- credits spent
- Stripe configured status

Tables:

- recent users
- recent failed runs
- workspaces needing attention

### 2. Users

Purpose: manage beta access and user roles.

Columns:

- name
- email
- role
- auth method
- approved access
- Slack connected
- active session count
- created at
- updated at

Actions:

- approve beta access
- revoke beta access
- promote to admin
- demote to user

Rules:

- `ADMIN_EMAILS` and built-in founder emails are immutable approved admins.
- Revoking access for a user clears existing sessions.
- Demoting the current admin session is blocked.
- Role changes and approval changes create audit events.

### 3. Clients

Purpose: one row per workspace/client.

Columns:

- workspace name
- workspace id
- owner email
- plan
- subscription status
- credit balance
- credits spent
- task count
- run count
- success rate
- failed runs
- automation count
- last activity

Row states:

- healthy
- low credits
- failed runs
- no activity
- billing issue

### 4. Client Detail

Purpose: inspect one workspace deeply.

Sections:

- workspace profile
- billing snapshot
- credit ledger
- task runs
- automations
- recent failures
- integration readiness

Metrics:

- run success rate
- average run cost
- credits spent
- credits remaining
- recent failure count
- latest activity timestamp

## Backend Design

Add an admin service module:

`backend/src/adminDashboard.ts`

Responsibilities:

- read current JSON stores,
- calculate user/workspace summaries,
- expose sanitized admin DTOs,
- create audit events,
- manage persistent beta approvals.

Add an admin access store:

`backend/src/adminAccessStore.ts`

Backed by:

`admin-access.json`

Shape:

```ts
interface AdminAccessRecord {
  email: string;
  status: 'approved' | 'revoked';
  role?: 'user' | 'admin';
  note?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}
```

Add an admin audit store:

`admin-audit-events.json`

Shape:

```ts
interface AdminAuditEvent {
  id: string;
  actorEmail: string;
  action:
    | 'access.approved'
    | 'access.revoked'
    | 'role.promoted'
    | 'role.demoted'
    | 'credits.adjusted';
  targetEmail?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

## Admin API

All routes require admin access.

`GET /api/admin/overview`

Returns:

- aggregate metrics,
- recent users,
- workspaces needing attention,
- recent failed runs.

`GET /api/admin/users`

Returns all known users plus approval state, role, Slack state, and active session count.

`PATCH /api/admin/users/:email/access`

Body:

```json
{ "status": "approved", "note": "Founder beta" }
```

or:

```json
{ "status": "revoked", "note": "No longer in beta" }
```

Effects:

- updates `admin-access.json`,
- updates the auth user if one exists,
- clears sessions on revoke,
- writes an audit event.

`PATCH /api/admin/users/:email/role`

Body:

```json
{ "role": "admin" }
```

or:

```json
{ "role": "user" }
```

Effects:

- updates persisted access role,
- updates auth user if one exists,
- writes an audit event.

`GET /api/admin/workspaces`

Returns workspace/client rows with performance metrics.

`GET /api/admin/workspaces/:workspaceId`

Returns profile, billing, ledger, tasks, task runs, automations, integrations, and computed performance metrics for one workspace.

`GET /api/admin/audit`

Returns recent admin audit events.

## Data Sources

Current JSON stores:

- `auth-users.json`
- `auth-sessions.json`
- `admin-access.json`
- `admin-audit-events.json`
- `platform-workspaces.json`
- `platform-billing-config.json`
- `platform-credit-ledger.json`
- `platform-task-runs.json`
- `platform-tasks.json`
- `automations.json`
- `workspace-settings.json`

Admin API responses must not expose:

- session token hashes,
- raw provider tokens,
- integration credentials,
- Stripe secret keys,
- Slack signing secrets,
- model provider API keys.

## Approval Model

Approved access should resolve from:

1. built-in founder admin emails,
2. `ADMIN_EMAILS`,
3. `TEST_CREDIT_ADMIN_EMAILS`,
4. environment allowlists for backward compatibility,
5. persistent `admin-access.json` records with `status: approved`.

Revoked persistent records override non-admin environment allowlists.

Built-in founder admin emails and `ADMIN_EMAILS` cannot be revoked from the UI.

## Frontend Design

Add:

`frontend/src/pages/AdminDashboard.tsx`

Add route:

`/admin`

Use existing visual language:

- dark operational dashboard,
- dense tables,
- compact metric cards,
- no marketing hero,
- no nested card stacks,
- clear status chips,
- controlled empty states.

Tabs:

- Overview
- Users
- Clients
- Audit

Client detail can be an in-page selected panel in V1, not a separate route.

Admin frontend must handle:

- `401`: redirect to login,
- `403`: show access denied,
- network errors: retryable notice,
- action success/failure notices.

## Future Client Analytics Path

V1 admin summaries should be implemented as reusable pure functions:

- `buildWorkspaceAdminSummary(workspaceId)`
- `buildWorkspacePerformanceSummary(workspaceId)`
- `buildWorkspaceActivitySummary(workspaceId)`

Later client-facing analytics can reuse these functions and filter to the authenticated workspace. The future route can be `/workspace/analytics` or `/dashboard/analytics`.

Client-facing version should exclude:

- other users,
- other workspaces,
- admin audit events,
- approval controls,
- internal margin/cost estimates unless intentionally exposed.

## Testing

Backend tests:

- non-admin users cannot call `/api/admin/*`,
- admin users can call `/api/admin/overview`,
- approving an email creates access and audit records,
- revoking an email blocks session creation and clears sessions,
- workspace summaries calculate run success/failure correctly,
- admin responses do not expose token hashes or credential values.

Frontend validation:

- `/admin` renders for admin sessions,
- `/admin` blocks non-admin sessions,
- users table shows approval state,
- approve/revoke actions update rows without refresh,
- client rows show billing and run metrics.

Deploy validation:

- VPS backend build passes,
- frontend build passes,
- live `/api/admin/overview` returns `401` when unauthenticated,
- live `/api/admin/overview` returns `200` for `max@violema.com`,
- live non-admin approved user returns `403`.

## Rollout

1. Add admin access and audit stores.
2. Update auth approval checks to include persistent admin access records.
3. Add admin summary service functions.
4. Add `/api/admin/*` routes.
5. Add `/admin` frontend.
6. Validate locally with targeted tests.
7. Deploy to VPS.
8. Verify live access control and dashboard rendering.

## Risks

- JSON stores are acceptable for beta, but not durable enough for scale.
- Workspace ownership is still light; V1 treats workspace/client identity as the existing workspace record.
- Approval changes must be conservative because they affect access to paid/beta infrastructure.
- Admin dashboard can become a dumping ground; V1 should stay focused on beta operations and client health.

