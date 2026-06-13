# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal `/admin` dashboard for managing beta users, client/workspace health, and operational performance while preserving a clean path to future client-facing analytics.

**Architecture:** Add persistent admin access/audit stores, reusable admin summary builders, admin-only Express routes, and a compact React admin dashboard. The backend remains JSON-backed for beta speed, with all privileged behavior guarded server-side by existing session cookies and admin role checks.

**Tech Stack:** TypeScript, Express, Node JSON stores, React, React Router, Tailwind CSS, Node test runner with `ts-node/register/transpile-only`.

---

## File Structure

- Create `backend/src/adminAccessStore.ts`: persistent beta access records and audit events.
- Create `backend/src/adminDashboard.ts`: pure summary builders for users, workspaces, performance, and overview.
- Create `backend/src/adminRoutes.ts`: Express route registration for `/api/admin/*`.
- Modify `backend/src/auth.ts`: expose user/session listing helpers, session clearing by email, persistent approval checks, and request recording.
- Modify `backend/src/server.ts`: call access request recording on denied signup, register admin routes, keep admin APIs behind `assertAdminAccess`.
- Modify `backend/tests/authAccess.test.ts`: cover persistent approval, requested state, revoked override, and public/protected API path behavior.
- Create `backend/tests/adminDashboard.test.ts`: cover admin summary calculations and secret redaction.
- Create `frontend/src/pages/AdminDashboard.tsx`: internal dashboard UI with Overview, Users, Clients, Audit tabs.
- Modify `frontend/src/App.tsx`: add `/admin` protected route.
- Modify `frontend/src/lib/auth.ts`: reuse existing admin role detection; no new auth model.

---

## Task 1: Persistent Access And Audit Store

**Files:**
- Create: `backend/src/adminAccessStore.ts`
- Modify: `backend/src/auth.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/authAccess.test.ts`

- [ ] **Step 1: Extend the auth access test first**

Add these imports to `backend/tests/authAccess.test.ts`:

```ts
import {
  clearAdminAccessRecords,
  getAccessRecord,
  listAdminAuditEvents,
  recordAccessRequest,
  setAccessStatus,
} from '../src/adminAccessStore';
```

Add this test:

```ts
test('persistent admin access records requests, approvals, revokes, and audit events', () => {
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  delete process.env.VIOLEMA_APPROVED_EMAILS;
  clearAdminAccessRecords();

  try {
    const requested = recordAccessRequest({
      email: 'founder@example.com',
      name: 'Founder Example',
      method: 'email',
      note: 'Signup request',
    });
    assert.equal(requested.status, 'requested');
    assert.equal(isEmailApprovedForAccess('founder@example.com'), false);

    const approved = setAccessStatus({
      email: 'founder@example.com',
      status: 'approved',
      role: 'user',
      note: 'Approved for beta',
      updatedBy: 'max@violema.com',
    });
    assert.equal(approved.status, 'approved');
    assert.equal(isEmailApprovedForAccess('FOUNDER@example.com'), true);

    const revoked = setAccessStatus({
      email: 'founder@example.com',
      status: 'revoked',
      note: 'No longer in beta',
      updatedBy: 'max@violema.com',
    });
    assert.equal(revoked.status, 'revoked');
    assert.equal(isEmailApprovedForAccess('founder@example.com'), false);

    const record = getAccessRecord('founder@example.com');
    assert.equal(record?.name, 'Founder Example');
    assert.equal(record?.status, 'revoked');
    assert.ok(listAdminAuditEvents().some((event) => event.action === 'access.revoked'));
  } finally {
    clearAdminAccessRecords();
    if (originalApproved === undefined) delete process.env.VIOLEMA_APPROVED_EMAILS;
    else process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
  }
});
```

- [ ] **Step 2: Run the test and verify it fails for missing store functions**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/authAccess.test.ts
```

Expected: fail with an import or missing export error for `../src/adminAccessStore`.

- [ ] **Step 3: Create the access store**

Create `backend/src/adminAccessStore.ts`:

```ts
import path from 'path';
import { readJsonFile, writeJsonFile } from './platform/jsonStore';

export type AdminAccessStatus = 'requested' | 'approved' | 'revoked';
export type AdminAccessRole = 'user' | 'admin';
export type AdminAuditAction =
  | 'access.requested'
  | 'access.approved'
  | 'access.revoked'
  | 'role.promoted'
  | 'role.demoted'
  | 'credits.adjusted';

export interface AdminAccessRecord {
  email: string;
  name?: string;
  method?: 'email' | 'google' | 'microsoft';
  status: AdminAccessStatus;
  role: AdminAccessRole;
  note?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AdminAuditEvent {
  id: string;
  actorEmail: string;
  action: AdminAuditAction;
  targetEmail?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACCESS_FILE = path.join(process.cwd(), 'admin-access.json');
const AUDIT_FILE = path.join(process.cwd(), 'admin-audit-events.json');

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function readAccessRecords() {
  return readJsonFile<AdminAccessRecord[]>(ACCESS_FILE, []);
}

function writeAccessRecords(records: AdminAccessRecord[]) {
  writeJsonFile(ACCESS_FILE, records);
}

function readAuditEvents() {
  return readJsonFile<AdminAuditEvent[]>(AUDIT_FILE, []);
}

function writeAuditEvents(events: AdminAuditEvent[]) {
  writeJsonFile(AUDIT_FILE, events);
}

export function listAdminAccessRecords() {
  return readAccessRecords();
}

export function getAccessRecord(email: string) {
  const normalized = normalizeEmail(email);
  return readAccessRecords().find((record) => record.email === normalized) || null;
}

export function listAdminAuditEvents(limit = 100) {
  return readAuditEvents()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function recordAdminAuditEvent(input: Omit<AdminAuditEvent, 'id' | 'createdAt'>) {
  const event: AdminAuditEvent = {
    ...input,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  writeAuditEvents([event, ...readAuditEvents()]);
  return event;
}

export function recordAccessRequest(input: {
  email: string;
  name?: string;
  method?: 'email' | 'google' | 'microsoft';
  note?: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;

  if (existing && existing.status !== 'requested') {
    return existing;
  }

  const next: AdminAccessRecord = {
    email,
    name: input.name?.trim() || existing?.name,
    method: input.method || existing?.method || 'email',
    status: 'requested',
    role: existing?.role || 'user',
    note: input.note || existing?.note,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: existing?.updatedBy,
  };

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  recordAdminAuditEvent({
    actorEmail: 'system',
    action: 'access.requested',
    targetEmail: email,
    metadata: { method: next.method, name: next.name },
  });
  return next;
}

export function setAccessStatus(input: {
  email: string;
  status: AdminAccessStatus;
  role?: AdminAccessRole;
  note?: string;
  updatedBy: string;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const records = readAccessRecords();
  const index = records.findIndex((record) => record.email === email);
  const existing = index >= 0 ? records[index] : null;
  const next: AdminAccessRecord = {
    email,
    name: existing?.name,
    method: existing?.method || 'email',
    status: input.status,
    role: input.role || existing?.role || 'user',
    note: input.note,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };

  if (index >= 0) records[index] = next;
  else records.unshift(next);
  writeAccessRecords(records);
  recordAdminAuditEvent({
    actorEmail: input.updatedBy,
    action: input.status === 'approved' ? 'access.approved' : input.status === 'revoked' ? 'access.revoked' : 'access.requested',
    targetEmail: email,
    metadata: { note: input.note, role: next.role },
  });
  return next;
}

export function clearAdminAccessRecords() {
  writeAccessRecords([]);
  writeAuditEvents([]);
}
```

- [ ] **Step 4: Wire persistent access into auth approval**

Modify `backend/src/auth.ts` imports:

```ts
import {
  getAccessRecord,
  listAdminAccessRecords,
  recordAccessRequest,
} from './adminAccessStore';
```

Add exports below `readUsers()` and `readSessions()`:

```ts
export function listAuthUsers() {
  return readUsers();
}

export function listAuthSessions() {
  return readSessions().filter((session) => session.expiresAt > new Date().toISOString());
}
```

Update `isEmailApprovedForAccess`:

```ts
export function isEmailApprovedForAccess(email: string) {
  const normalized = normalizeEmail(email);
  const persistent = getAccessRecord(normalized);
  if (persistent?.status === 'revoked') return false;
  if (persistent?.status === 'approved') return true;
  return getApprovedAccessEmails().has(normalized);
}
```

Add:

```ts
export function requestBetaAccess(input: {
  email: string;
  name?: string;
  method?: AuthMethod;
  note?: string;
}) {
  return recordAccessRequest(input);
}

export function getPersistentApprovedAccessEmails() {
  return listAdminAccessRecords()
    .filter((record) => record.status === 'approved')
    .map((record) => record.email);
}

export function clearAuthSessionsForEmail(email: string) {
  const normalized = normalizeEmail(email);
  const users = readUsers();
  const user = users.find((item) => item.email === normalized);
  if (!user) return 0;
  const sessions = readSessions();
  const next = sessions.filter((session) => session.userId !== user.id);
  writeSessions(next);
  return sessions.length - next.length;
}
```

- [ ] **Step 5: Record denied access requests**

Modify the `/api/auth/session` denial branch in `backend/src/server.ts` before returning `403`:

```ts
requestBetaAccess({
  email,
  name,
  method,
  note: 'Email session request',
});
```

Add `requestBetaAccess` to the existing auth import.

- [ ] **Step 6: Run the access tests**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/authAccess.test.ts
```

Expected: all auth access tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
cd /tmp/violema-auth-gate
git add backend/src/adminAccessStore.ts backend/src/auth.ts backend/src/server.ts backend/tests/authAccess.test.ts
git commit -m "feat(admin): persist beta access approvals"
```

---

## Task 2: Admin Summary Service

**Files:**
- Create: `backend/src/adminDashboard.ts`
- Test: `backend/tests/adminDashboard.test.ts`

- [ ] **Step 1: Write service tests**

Create `backend/tests/adminDashboard.test.ts`:

```ts
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('admin dashboard summarizes users, workspaces, and run performance', async () => {
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(path.join(tmpdir(), 'violema-admin-dashboard-'));

  try {
    process.chdir(tempDir);
    const auth = await import('../src/auth');
    const access = await import('../src/adminAccessStore');
    const workspace = await import('../src/platform/workspace');
    const billing = await import('../src/platform/billing');
    const store = await import('../src/platform/store');
    const dashboard = await import('../src/adminDashboard');

    access.setAccessStatus({
      email: 'client@example.com',
      status: 'approved',
      role: 'user',
      note: 'Client beta',
      updatedBy: 'max@violema.com',
    });
    auth.upsertAuthUser({
      email: 'client@example.com',
      name: 'Client User',
      role: 'user',
      method: 'email',
      acceptedTerms: true,
      acceptedEducation: true,
    });
    auth.createAuthSession(auth.listAuthUsers()[0].id);
    workspace.upsertWorkspaceProfile('client-acme', {
      name: 'Acme',
      ownerEmail: 'client@example.com',
      slug: 'acme',
    });
    billing.upsertBillingConfig('client-acme', {
      planId: 'pro',
      subscriptionStatus: 'active',
    });
    const task = store.createTask({
      workspaceId: 'client-acme',
      title: 'Revenue digest',
      kind: 'report',
    });
    const run = store.createTaskRun({
      workspaceId: 'client-acme',
      taskId: task.id,
      agentRole: 'analyst',
      modelTier: 'default',
      estimatedCredits: 12,
    });
    store.finalizeTaskRun(run.id, {
      status: 'succeeded',
      actualCredits: 10,
      metadata: { title: 'Revenue digest' },
    });

    const overview = dashboard.buildAdminOverview();
    assert.equal(overview.metrics.approvedUsers, 1);
    assert.equal(overview.metrics.workspaces, 1);
    assert.equal(overview.metrics.totalRuns, 1);
    assert.equal(overview.metrics.runSuccessRate, 100);

    const users = dashboard.buildAdminUsers();
    assert.equal(users[0].email, 'client@example.com');
    assert.equal(users[0].activeSessionCount, 1);
    assert.equal(users[0].approvedAccess, true);

    const workspaces = dashboard.buildAdminWorkspaces();
    assert.equal(workspaces[0].workspaceId, 'client-acme');
    assert.equal(workspaces[0].planId, 'pro');
    assert.equal(workspaces[0].runSuccessRate, 100);
  } finally {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify it fails for missing module**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/adminDashboard.test.ts
```

Expected: fail because `../src/adminDashboard` does not exist.

- [ ] **Step 3: Create the summary service**

Create `backend/src/adminDashboard.ts` with these exports:

```ts
import { listAdminAccessRecords, listAdminAuditEvents } from './adminAccessStore';
import { isEmailApprovedForAccess, listAuthSessions, listAuthUsers } from './auth';
import { listAutomations } from './scheduler';
import {
  getBillingStatus,
  getWorkspaceProfile,
  listLedgerEntries,
  listTaskRuns,
  listTasks,
  listWorkspaces,
} from './platform';

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function lastActivity(values: Array<string | undefined>) {
  return values.filter(Boolean).sort().at(-1) || null;
}

export function buildAdminUsers() {
  const users = listAuthUsers();
  const sessions = listAuthSessions();
  const accessRecords = listAdminAccessRecords();
  const emails = new Set([...users.map((user) => user.email), ...accessRecords.map((record) => record.email)]);

  return Array.from(emails).sort().map((email) => {
    const user = users.find((item) => item.email === email) || null;
    const access = accessRecords.find((item) => item.email === email) || null;
    const approvedAccess = access?.status === 'approved' || (!access && isEmailApprovedForAccess(email));
    const accessStatus = access?.status || (approvedAccess ? 'approved' : 'requested');
    return {
      email,
      name: user?.name || access?.name || email.split('@')[0],
      role: access?.role || user?.role || 'user',
      method: user?.method || access?.method || 'email',
      accessStatus,
      approvedAccess,
      slackConnected: Boolean(user?.slackWorkspace && user?.slackChannelId),
      slackDisplayTarget: user?.slackDisplayTarget || null,
      activeSessionCount: user ? sessions.filter((session) => session.userId === user.id).length : 0,
      createdAt: user?.createdAt || access?.createdAt || null,
      updatedAt: user?.updatedAt || access?.updatedAt || null,
    };
  });
}

export function buildWorkspacePerformanceSummary(workspaceId: string) {
  const runs = listTaskRuns(workspaceId);
  const succeeded = runs.filter((run) => run.status === 'succeeded').length;
  const failed = runs.filter((run) => run.status === 'failed').length;
  const totalCredits = runs.reduce((sum, run) => sum + Math.max(0, run.actualCredits ?? run.estimatedCredits ?? 0), 0);
  return {
    totalRuns: runs.length,
    succeededRuns: succeeded,
    failedRuns: failed,
    runSuccessRate: pct(succeeded, runs.length),
    averageRunCredits: runs.length > 0 ? Math.round(totalCredits / runs.length) : 0,
    creditsFromRuns: totalCredits,
    lastActivityAt: lastActivity(runs.map((run) => run.finishedAt || run.startedAt)),
  };
}

export function buildAdminWorkspaces() {
  const workspaces = listWorkspaces();
  return workspaces.map((workspace) => {
    const billing = getBillingStatus(workspace.id);
    const tasks = listTasks(workspace.id);
    const runs = listTaskRuns(workspace.id);
    const performance = buildWorkspacePerformanceSummary(workspace.id);
    const automations = listAutomations();
    const rowState =
      billing.summary.balanceCredits <= 0 ? 'billing_issue'
      : billing.summary.balanceCredits < 100 ? 'low_credits'
      : performance.failedRuns > 0 ? 'failed_runs'
      : performance.totalRuns === 0 ? 'no_activity'
      : 'healthy';

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      slug: workspace.slug,
      ownerEmail: workspace.ownerEmail || null,
      planId: billing.config.planId,
      planName: billing.plan.name,
      subscriptionStatus: billing.config.subscriptionStatus || 'none',
      creditBalance: billing.summary.balanceCredits,
      creditsSpent: billing.summary.spentCredits,
      taskCount: tasks.length,
      runCount: runs.length,
      automationCount: automations.length,
      rowState,
      ...performance,
    };
  });
}

export function buildWorkspaceAdminDetail(workspaceId: string) {
  const workspace = getWorkspaceProfile(workspaceId);
  return {
    workspace,
    billing: getBillingStatus(workspaceId),
    performance: buildWorkspacePerformanceSummary(workspaceId),
    tasks: listTasks(workspaceId).slice(0, 100),
    runs: listTaskRuns(workspaceId).slice(0, 100),
    ledger: listLedgerEntries(workspaceId).slice(-100).reverse(),
    automations: listAutomations(),
  };
}

export function buildAdminOverview() {
  const users = buildAdminUsers();
  const workspaces = buildAdminWorkspaces();
  const totalRuns = workspaces.reduce((sum, workspace) => sum + workspace.totalRuns, 0);
  const succeededRuns = workspaces.reduce((sum, workspace) => sum + workspace.succeededRuns, 0);
  const failedRuns = workspaces.reduce((sum, workspace) => sum + workspace.failedRuns, 0);
  return {
    metrics: {
      approvedUsers: users.filter((user) => user.approvedAccess).length,
      pendingUsers: users.filter((user) => user.accessStatus === 'requested').length,
      workspaces: workspaces.length,
      activeAutomations: listAutomations().filter((item) => item.status === 'active').length,
      totalRuns,
      runSuccessRate: pct(succeededRuns, totalRuns),
      failedRuns,
      creditsSpent: workspaces.reduce((sum, workspace) => sum + workspace.creditsSpent, 0),
    },
    recentUsers: users.slice(0, 8),
    workspacesNeedingAttention: workspaces.filter((workspace) => workspace.rowState !== 'healthy').slice(0, 8),
    recentFailedRuns: workspaces.flatMap((workspace) =>
      buildWorkspaceAdminDetail(workspace.workspaceId).runs
        .filter((run) => run.status === 'failed')
        .map((run) => ({ ...run, workspaceName: workspace.workspaceName }))
    ).slice(0, 8),
  };
}

export function buildAdminAudit(limit = 100) {
  return listAdminAuditEvents(limit);
}
```

- [ ] **Step 4: Run the service tests**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/adminDashboard.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
cd /tmp/violema-auth-gate
git add backend/src/adminDashboard.ts backend/tests/adminDashboard.test.ts
git commit -m "feat(admin): summarize beta operations"
```

---

## Task 3: Admin API Routes

**Files:**
- Create: `backend/src/adminRoutes.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/adminDashboard.test.ts`

- [ ] **Step 1: Add route-level tests to the service test file**

Append this focused admin authorization test to `backend/tests/adminDashboard.test.ts`:

```ts
test('admin route guard rejects non-admin actors', async () => {
  const routes = await import('../src/adminRoutes');

  assert.throws(
    () => routes.assertAdminActor({ role: 'user', email: 'user@example.com' }),
    /Admin access required/,
  );
  assert.equal(
    routes.assertAdminActor({ role: 'admin', email: 'max@violema.com' }),
    'max@violema.com',
  );
});
```

- [ ] **Step 2: Run test and verify it fails for missing `adminRoutes`**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/adminDashboard.test.ts
```

Expected: fail because `../src/adminRoutes` does not exist.

- [ ] **Step 3: Create admin routes**

Create `backend/src/adminRoutes.ts`:

```ts
import type { Express, Request, Response } from 'express';
import {
  buildAdminAudit,
  buildAdminOverview,
  buildAdminUsers,
  buildAdminWorkspaces,
  buildWorkspaceAdminDetail,
} from './adminDashboard';
import { setAccessStatus } from './adminAccessStore';
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
      const status = req.body?.status === 'approved' || req.body?.status === 'revoked' ? req.body.status : null;
      if (!status) {
        res.status(400).json({ error: 'status must be approved or revoked' });
        return;
      }
      const record = setAccessStatus({
        email: req.params.email,
        status,
        role: req.body?.role === 'admin' ? 'admin' : 'user',
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
        updatedBy: actorEmail,
      });
      if (status === 'revoked') clearAuthSessionsForEmail(req.params.email);
      res.json({ ok: true, record, users: buildAdminUsers() });
    } catch (error) {
      sendAdminError(res, error);
    }
  });

  app.patch('/api/admin/users/:email/role', (req, res) => {
    try {
      const actorEmail = assertAdminActor(options.getAdminActor(req));
      const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'user' ? 'user' : null;
      if (!role) {
        res.status(400).json({ error: 'role must be admin or user' });
        return;
      }
      const record = setAccessStatus({
        email: req.params.email,
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
```

- [ ] **Step 4: Register routes in server**

Modify `backend/src/server.ts` imports:

```ts
import { registerAdminRoutes } from './adminRoutes';
```

Add after auth routes and before workspace/billing routes:

```ts
registerAdminRoutes(app, {
  getAdminActor: (req) => {
    const token = parseCookieValue(req, AUTH_COOKIE_NAME);
    const record = token ? getAuthUserByToken(token) : null;
    if (!record) {
      const error = new Error('Admin session required') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
    return {
      email: record.user.email,
      role: record.user.role,
    };
  },
});
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/authAccess.test.ts tests/adminDashboard.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
cd /tmp/violema-auth-gate
git add backend/src/adminRoutes.ts backend/src/server.ts backend/tests/adminDashboard.test.ts
git commit -m "feat(admin): add admin api routes"
```

---

## Task 4: Admin Dashboard Frontend

**Files:**
- Create: `frontend/src/pages/AdminDashboard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the page with typed fetch helpers**

Create `frontend/src/pages/AdminDashboard.tsx` with:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBackendAuthSession, isAdminSession } from '../lib/auth';

type AdminTab = 'overview' | 'users' | 'clients' | 'audit';

interface AdminOverview {
  metrics: {
    approvedUsers: number;
    pendingUsers: number;
    workspaces: number;
    activeAutomations: number;
    totalRuns: number;
    runSuccessRate: number;
    failedRuns: number;
    creditsSpent: number;
  };
  recentUsers: AdminUserRow[];
  workspacesNeedingAttention: AdminWorkspaceRow[];
  recentFailedRuns: Array<{ id: string; workspaceName?: string; status: string; error?: string }>;
}

interface AdminUserRow {
  email: string;
  name: string;
  role: 'user' | 'admin';
  method: string;
  accessStatus: 'requested' | 'approved' | 'revoked';
  approvedAccess: boolean;
  slackConnected: boolean;
  slackDisplayTarget?: string | null;
  activeSessionCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AdminWorkspaceRow {
  workspaceId: string;
  workspaceName: string;
  ownerEmail?: string | null;
  planId: string;
  planName: string;
  subscriptionStatus: string;
  creditBalance: number;
  creditsSpent: number;
  taskCount: number;
  runCount: number;
  automationCount: number;
  rowState: string;
  runSuccessRate: number;
  failedRuns: number;
  lastActivityAt?: string | null;
}

interface AdminAuditEvent {
  id: string;
  actorEmail: string;
  action: string;
  targetEmail?: string;
  workspaceId?: string;
  createdAt: string;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    throw new Error((payload && 'error' in payload && payload.error) || `Admin request failed with ${response.status}`);
  }
  return payload as T;
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'violet' | 'cyan' | 'amber' | 'rose' }) {
  const toneClass = {
    slate: 'border-slate-700/70 text-slate-300',
    violet: 'border-violet-500/35 text-violet-200',
    cyan: 'border-cyan-500/30 text-cyan-200',
    amber: 'border-amber-500/30 text-amber-200',
    rose: 'border-rose-500/30 text-rose-200',
  }[tone];
  return (
    <div className={`rounded-2xl border bg-navy-950/60 p-4 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone = value === 'approved' || value === 'healthy' || value === 'active'
    ? 'bg-emerald-500/12 text-emerald-300'
    : value === 'requested' || value === 'low_credits'
      ? 'bg-amber-500/12 text-amber-300'
      : 'bg-rose-500/12 text-rose-300';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value.replace(/_/g, ' ')}</span>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [clients, setClients] = useState<AdminWorkspaceRow[]>([]);
  const [audit, setAudit] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);
    try {
      const session = await fetchBackendAuthSession();
      if (!session) {
        navigate('/login?next=%2Fadmin', { replace: true });
        return;
      }
      if (!isAdminSession(session)) {
        setError('Admin access required.');
        return;
      }
      const [overviewPayload, usersPayload, clientsPayload, auditPayload] = await Promise.all([
        adminFetch<AdminOverview>('/api/admin/overview'),
        adminFetch<{ items: AdminUserRow[] }>('/api/admin/users'),
        adminFetch<{ items: AdminWorkspaceRow[] }>('/api/admin/workspaces'),
        adminFetch<{ items: AdminAuditEvent[] }>('/api/admin/audit'),
      ]);
      setOverview(overviewPayload);
      setUsers(usersPayload.items);
      setClients(clientsPayload.items);
      setAudit(auditPayload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  async function updateAccess(email: string, status: 'approved' | 'revoked') {
    setNotice(null);
    await adminFetch(`/api/admin/users/${encodeURIComponent(email)}/access`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note: status === 'approved' ? 'Approved from admin dashboard' : 'Revoked from admin dashboard' }),
    });
    setNotice(`${email} ${status}.`);
    await loadAdminData();
  }

  const activeClients = useMemo(() => clients.filter((client) => client.runCount > 0), [clients]);

  if (loading) {
    return <div className="min-h-screen bg-navy-950 p-8 text-slate-400">Loading admin dashboard...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-950 p-8 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
          <p className="text-sm font-semibold text-rose-200">{error}</p>
          <button className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-200">
      <div className="border-b border-slate-800 bg-navy-950/95 px-6 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">Internal Control Room</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Violema Admin</h1>
          </div>
          <button className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {notice ? <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div> : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {(['overview', 'users', 'clients', 'audit'] as AdminTab[]).map((item) => (
            <button
              key={item}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-violet-600 text-white' : 'border border-slate-800 text-slate-400'}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === 'overview' && overview ? (
          <section>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="Approved users" value={overview.metrics.approvedUsers} tone="violet" />
              <MetricCard label="Pending" value={overview.metrics.pendingUsers} tone="amber" />
              <MetricCard label="Clients" value={overview.metrics.workspaces} tone="cyan" />
              <MetricCard label="Run success" value={`${overview.metrics.runSuccessRate}%`} tone={overview.metrics.runSuccessRate >= 80 ? 'cyan' : 'rose'} />
              <MetricCard label="Active automations" value={overview.metrics.activeAutomations} />
              <MetricCard label="Total runs" value={overview.metrics.totalRuns} />
              <MetricCard label="Failed runs" value={overview.metrics.failedRuns} tone={overview.metrics.failedRuns > 0 ? 'rose' : 'slate'} />
              <MetricCard label="Credits spent" value={overview.metrics.creditsSpent} />
            </div>
          </section>
        ) : null}

        {tab === 'users' ? (
          <section className="overflow-hidden rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Slack</th>
                  <th className="px-4 py-3">Sessions</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3"><StatusPill value={user.accessStatus} /></td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">{user.slackConnected ? user.slackDisplayTarget || 'connected' : 'not connected'}</td>
                    <td className="px-4 py-3">{user.activeSessionCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-emerald-500/30 px-3 py-1 text-xs text-emerald-300" onClick={() => updateAccess(user.email, 'approved')}>
                          Approve
                        </button>
                        <button className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300" onClick={() => updateAccess(user.email, 'revoked')}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {tab === 'clients' ? (
          <section className="grid gap-3">
            {clients.map((client) => (
              <div key={client.workspaceId} className="rounded-2xl border border-slate-800 bg-navy-950/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{client.workspaceName}</p>
                    <p className="text-xs text-slate-500">{client.workspaceId} · {client.ownerEmail || 'no owner'}</p>
                  </div>
                  <StatusPill value={client.rowState} />
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-5">
                  <span>{client.planName}</span>
                  <span>{client.creditBalance} credits</span>
                  <span>{client.runCount} runs</span>
                  <span>{client.runSuccessRate}% success</span>
                  <span>{client.failedRuns} failed</span>
                </div>
              </div>
            ))}
            {activeClients.length === 0 ? <p className="text-sm text-slate-500">No client run activity yet.</p> : null}
          </section>
        ) : null}

        {tab === 'audit' ? (
          <section className="grid gap-2">
            {audit.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-800 bg-navy-950/70 px-4 py-3 text-sm">
                <p className="font-medium text-white">{event.action}</p>
                <p className="text-xs text-slate-500">{event.actorEmail} · {event.targetEmail || event.workspaceId || 'system'} · {event.createdAt}</p>
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

Modify `frontend/src/App.tsx`:

```tsx
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
```

Add route:

```tsx
<Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
```

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd /tmp/violema-auth-gate/frontend
npm run build
```

Expected: `tsc && vite build` completes.

- [ ] **Step 4: Commit**

Run:

```bash
cd /tmp/violema-auth-gate
git add frontend/src/pages/AdminDashboard.tsx frontend/src/App.tsx
git commit -m "feat(admin): add internal dashboard UI"
```

---

## Task 5: End-To-End Validation And Deploy

**Files:**
- Validate only unless previous tasks reveal small defects.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd /tmp/violema-auth-gate/backend
env NODE_PATH='/Users/maximisto/Documents/New project/backend/node_modules' \
  node --test -r ts-node/register/transpile-only tests/authAccess.test.ts tests/adminDashboard.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run diff check**

Run:

```bash
cd /tmp/violema-auth-gate
git diff --check
```

Expected: no output.

- [ ] **Step 3: Push**

Run:

```bash
cd /tmp/violema-auth-gate
git fetch origin claude/build-ai-assistant-platform-BsdRr
git rev-list --left-right --count HEAD...origin/claude/build-ai-assistant-platform-BsdRr
git push origin HEAD:claude/build-ai-assistant-platform-BsdRr
```

Expected before push: `N 0` where `N` is the number of local commits.

- [ ] **Step 4: Deploy**

Run:

```bash
ssh root@187.77.220.60 'set -e; cd /var/www/nexus; git fetch origin claude/build-ai-assistant-platform-BsdRr; git reset --hard origin/claude/build-ai-assistant-platform-BsdRr; deploy/deploy.sh --skip-deps'
```

Expected:

- backend `tsc` passes,
- frontend `tsc && vite build` passes,
- nginx config test succeeds,
- PM2 starts `violema-backend`.

- [ ] **Step 5: Verify live unauthenticated protection**

Run:

```bash
curl -sS -i https://violema.com/api/admin/overview | sed -n '1,20p'
```

Expected:

```http
HTTP/2 401
```

Body includes:

```json
{"error":"Approved Violema beta session required.","code":"beta_session_required"}
```

- [ ] **Step 6: Verify live admin access**

Run:

```bash
rm -f /tmp/violema-admin-cookie.txt
curl -sS -c /tmp/violema-admin-cookie.txt \
  -H 'Content-Type: application/json' \
  -X POST https://violema.com/api/auth/session \
  --data '{"email":"max@violema.com","name":"Max Markovtsev","acceptedTerms":true,"acceptedEducation":true}' >/dev/null
curl -sS -b /tmp/violema-admin-cookie.txt https://violema.com/api/admin/overview \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s); console.log(JSON.stringify(j.metrics,null,2));})'
```

Expected: JSON metrics object with numeric `approvedUsers`, `workspaces`, and `runSuccessRate`.

- [ ] **Step 7: Verify non-admin rejection**

Run:

```bash
curl -sS -b /tmp/violema-admin-cookie.txt \
  -H 'Content-Type: application/json' \
  -X PATCH https://violema.com/api/admin/users/codex-nonadmin-smoke%40violema.test/access \
  --data '{"status":"approved","role":"user","note":"Temporary non-admin smoke check"}' >/dev/null
rm -f /tmp/violema-nonadmin-cookie.txt
curl -sS -c /tmp/violema-nonadmin-cookie.txt \
  -H 'Content-Type: application/json' \
  -X POST https://violema.com/api/auth/session \
  --data '{"email":"codex-nonadmin-smoke@violema.test","name":"Non Admin Smoke","acceptedTerms":true,"acceptedEducation":true}' >/dev/null
curl -sS -i -b /tmp/violema-nonadmin-cookie.txt https://violema.com/api/admin/overview | sed -n '1,20p'
```

Expected:

```http
HTTP/2 403
```

Body includes:

```json
{"error":"Admin access required"}
```

Clean up the temporary smoke user:

```bash
curl -sS -b /tmp/violema-admin-cookie.txt \
  -H 'Content-Type: application/json' \
  -X PATCH https://violema.com/api/admin/users/codex-nonadmin-smoke%40violema.test/access \
  --data '{"status":"revoked","role":"user","note":"Temporary non-admin smoke check complete"}' >/dev/null
```

- [ ] **Step 8: Verify UI route**

Run:

```bash
curl -sSIL https://violema.com/admin | sed -n '1,16p'
```

Expected: `HTTP/2 200` serving the SPA.

- [ ] **Step 9: Final status**

Run:

```bash
ssh root@187.77.220.60 'cd /var/www/nexus && git rev-parse HEAD && pm2 status violema-backend --no-color'
```

Expected: deployed commit hash matches local `HEAD`, and `violema-backend` is `online`.

---

## Self-Review

Spec coverage:

- Beta access management: Task 1 and Task 3.
- Users view: Task 2 and Task 4.
- Clients/workspaces view: Task 2 and Task 4.
- Client performance metrics: Task 2.
- Admin-only security: Task 3 and Task 5.
- Future client analytics path: Task 2 pure summary functions.
- Audit log: Task 1 and Task 4.
- JSON-backed storage: Task 1 and Task 2.

Type consistency:

- Access statuses are `requested`, `approved`, and `revoked` throughout.
- User roles are `user` and `admin` throughout.
- Workspace metric fields in the frontend match `buildAdminWorkspaces`.

Execution note:

- Use `/tmp/violema-auth-gate` as the implementation worktree because `/Users/maximisto/Documents/New project` is behind live and has unrelated dirty files.
