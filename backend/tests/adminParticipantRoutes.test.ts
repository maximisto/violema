import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

/**
 * Wire-level contract for the participants surface. The unit tests cover the
 * derivation and the filter predicates; this file covers what a frontend lane
 * actually receives — query-string parsing, the response envelope, and the
 * refusal to accept a derived stage over HTTP.
 */

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withTempServer(run: (context: { baseUrl: string }) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-participant-routes-'));

  process.chdir(tempDir);
  process.env.ADMIN_EMAILS = 'admin@example.invalid';
  process.env.VIOLEMA_APPROVED_EMAILS = 'member@example.invalid';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';

  let server: http.Server | null = null;
  try {
    const { default: app } = await import('../src/server');
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');
    await run({ baseUrl: `http://127.0.0.1:${address.port}` });
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (typeof originalAdminEmails === 'string') process.env.ADMIN_EMAILS = originalAdminEmails;
    else delete process.env.ADMIN_EMAILS;
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalDisableScheduler === 'string') {
      process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    } else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('the participants endpoint filters server-side and refuses a hand-set stage', async () => withTempServer(async ({ baseUrl }) => {
  const auth = await import('../src/auth');
  const access = await import('../src/adminAccessStore');
  const consent = await import('../src/betaConsentStore');
  const betaProgram = await import('../src/betaProgram');

  const acceptedAt = '2026-07-11T12:01:00.000Z';
  consent.recordBetaConsent({
    email: 'member@example.invalid',
    participantType: 'founder_operator',
    authMethod: 'email',
    acceptanceSource: 'signup',
    termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
    termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
    acceptedAt,
  });
  access.recordAccessRequest({
    email: 'member@example.invalid',
    method: 'email',
    identityVerifiedAt: '2026-07-11T12:00:00.000Z',
    acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
    acceptedTermsAt: acceptedAt,
  });
  access.setAccessStatus({
    email: 'member@example.invalid',
    status: 'approved',
    role: 'user',
    updatedBy: 'admin@example.invalid',
  });
  auth.upsertAuthUser({
    email: 'member@example.invalid',
    name: 'Member',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  const admin = auth.upsertAuthUser({
    email: 'admin@example.invalid',
    name: 'Admin',
    role: 'admin',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  const headers = { cookie: `violema_session=${auth.createAuthSession(admin.id).token}` };
  const json = (response: Response) => response.json() as Promise<Record<string, any>>;

  // Unfiltered: the envelope carries items, facet counts, and the closed sets
  // the admin UI renders its selectors from.
  const all = await json(await fetch(`${baseUrl}/api/admin/users`, { headers }));
  assert.equal(Array.isArray(all.items), true);
  assert.deepEqual(all.catalog.accountStages, ['internal', 'applicant', 'trial', 'paying', 'lapsed']);
  assert.ok(all.catalog.participantTypes.includes('team_member'));
  assert.ok(all.catalog.participantTypes.includes('advisor'));
  assert.equal(all.matched, all.items.length);
  assert.equal(all.counts.total, all.items.length);

  const member = all.items.find((item: any) => item.email === 'member@example.invalid');
  assert.equal(member.accountStage.stage, 'trial');
  assert.ok(member.accountStage.reason.length > 0);
  assert.deepEqual(member.accountStage.derivedFrom, ['access.status']);
  assert.equal(member.activated, false);
  assert.equal(
    all.items.find((item: any) => item.email === 'admin@example.invalid').accountStage.stage,
    'internal',
  );

  // Comma-separated and repeated query params both narrow the set, while facets
  // stay counted over the whole base.
  const trials = await json(await fetch(`${baseUrl}/api/admin/users?stage=trial`, { headers }));
  assert.deepEqual(trials.items.map((item: any) => item.email), ['member@example.invalid']);
  assert.equal(trials.counts.total, all.items.length);
  assert.deepEqual(trials.filters.stage, ['trial']);

  const commaList = await json(await fetch(`${baseUrl}/api/admin/users?stage=trial,internal`, { headers }));
  assert.equal(commaList.matched, 2);
  const repeated = await json(
    await fetch(`${baseUrl}/api/admin/users?stage=trial&stage=internal`, { headers }),
  );
  assert.equal(repeated.matched, 2);

  const notActivated = await json(
    await fetch(`${baseUrl}/api/admin/users?stage=trial&activated=false`, { headers }),
  );
  assert.equal(notActivated.matched, 1);
  const activated = await json(await fetch(`${baseUrl}/api/admin/users?activated=true`, { headers }));
  assert.equal(activated.matched, 0, 'nobody has completed a run in this fixture');

  const badStage = await fetch(`${baseUrl}/api/admin/users?stage=vip`, { headers });
  assert.equal(badStage.status, 400);
  assert.match(String((await json(badStage)).error), /stage must be one of/);
  const badActivated = await fetch(`${baseUrl}/api/admin/users?activated=maybe`, { headers });
  assert.equal(badActivated.status, 400);

  // The new participant types are assignable over the existing edit path.
  const assignAdvisor = await fetch(`${baseUrl}/api/admin/users/member@example.invalid/access`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantType: 'advisor' }),
  });
  assert.equal(assignAdvisor.status, 200);
  assert.equal((await json(assignAdvisor)).record.participantType, 'advisor');
  const advisors = await json(
    await fetch(`${baseUrl}/api/admin/users?participantType=advisor`, { headers }),
  );
  assert.deepEqual(advisors.items.map((item: any) => item.email), ['member@example.invalid']);

  // Stage is derived. Writing one is refused loudly, and the rest of the patch
  // is not applied behind the operator's back.
  const forgeStage = await fetch(`${baseUrl}/api/admin/users/member@example.invalid/access`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'revoked', accountStage: 'paying' }),
  });
  assert.equal(forgeStage.status, 400);
  assert.match(String((await json(forgeStage)).error), /derived from billing, access, and ledger truth/);
  assert.equal(
    access.getAccessRecord('member@example.invalid')?.status,
    'approved',
    'a rejected patch must not partially apply',
  );

  const forgeOverride = await fetch(`${baseUrl}/api/admin/users/member@example.invalid/stage-override`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ override: 'paying' }),
  });
  assert.equal(forgeOverride.status, 400);
  assert.match(String((await json(forgeOverride)).error), /stage override must be null or internal/);

  // The one permitted override works and names its actor.
  const markInternal = await fetch(`${baseUrl}/api/admin/users/member@example.invalid/stage-override`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ override: 'internal' }),
  });
  assert.equal(markInternal.status, 200);
  const marked = await json(markInternal);
  assert.equal(marked.record.stageOverride, 'internal');
  assert.equal(marked.record.stageOverrideBy, 'admin@example.invalid');
  assert.equal(
    marked.users.find((item: any) => item.email === 'member@example.invalid').accountStage.stage,
    'internal',
  );

  // Metadata only: no draft body, artifact payload, or run content rides along.
  assert.equal(/"artifacts"|"markdown"|"draft"|"body"/.test(JSON.stringify(all.items)), false);

  // Non-admins reach none of it.
  assert.equal((await fetch(`${baseUrl}/api/admin/users?stage=paying`)).status, 401);
}));
