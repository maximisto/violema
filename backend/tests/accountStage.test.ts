import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Several store modules bind their file path from `process.cwd()` at import
// time, so the chdir has to happen before the first dynamic import. Static
// imports are hoisted, which is why nothing from `src/` is imported at the top.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-account-stage-'));
process.chdir(tempDir);

process.env.ADMIN_EMAILS = 'staff@example.invalid';
process.env.VIOLEMA_APPROVED_EMAILS = '';

const BASE_INPUT = {
  isDefaultWorkspace: false,
  isDemoWorkspace: false,
  role: 'user' as const,
  accessStatus: null,
  approvedForAccess: false,
  hasTrialGrant: false,
};

test('every account stage derives from stored truth, never from a hand-set flag', async () => {
  const { resolveAccountStage, ACCOUNT_STAGES } = await import('../src/platform/accountStage');

  // ── internal: staff and Violema's own surfaces are never pipeline or revenue.
  const admin = resolveAccountStage({ ...BASE_INPUT, role: 'admin' });
  assert.equal(admin.stage, 'internal');
  assert.deepEqual(admin.derivedFrom, ['authUser.role']);

  // An admin in a TENANT workspace is still internal: the authorization axis
  // decides, not where their workspace happens to live.
  const adminInTenantWorkspace = resolveAccountStage({
    ...BASE_INPUT,
    role: 'admin',
    isDefaultWorkspace: false,
    approvedForAccess: true,
    accessStatus: 'approved',
    hasTrialGrant: true,
  });
  assert.equal(adminInTenantWorkspace.stage, 'internal');

  assert.equal(resolveAccountStage({ ...BASE_INPUT, isDefaultWorkspace: true }).stage, 'internal');
  const demo = resolveAccountStage({ ...BASE_INPUT, isDemoWorkspace: true });
  assert.equal(demo.stage, 'internal');
  assert.deepEqual(demo.derivedFrom, ['workspace.isDemo']);

  // ── paying: billing truth only. Never inferred from a credit balance.
  const paying = resolveAccountStage({
    ...BASE_INPUT,
    accessStatus: 'approved',
    approvedForAccess: true,
    subscriptionStatus: 'active',
    subscriptionStatusAt: '2026-07-14T09:00:00.000Z',
  });
  assert.equal(paying.stage, 'paying');
  assert.deepEqual(paying.derivedFrom, ['billing.subscriptionStatus']);
  assert.match(paying.reason, /active subscription/i);
  assert.match(paying.reason, /2026-07-14/);

  // A failing card is still a paying customer — and the reason has to say so,
  // or the operator sees "paying" and never learns the payment is bouncing.
  const pastDue = resolveAccountStage({
    ...BASE_INPUT,
    approvedForAccess: true,
    subscriptionStatus: 'past_due',
  });
  assert.equal(pastDue.stage, 'paying');
  assert.match(pastDue.reason, /past due/i);

  // A big trial balance is NOT paying.
  const richTrial = resolveAccountStage({
    ...BASE_INPUT,
    accessStatus: 'approved',
    approvedForAccess: true,
    hasTrialGrant: true,
    trialCredits: 500,
    trialGrantedAt: '2026-07-14T08:00:00.000Z',
  });
  assert.equal(richTrial.stage, 'trial');
  assert.deepEqual(richTrial.derivedFrom, ['access.status', 'ledger.trial_grant']);
  assert.match(richTrial.reason, /500-credit trial grant on 2026-07-14/);

  // ── lapsed: cancelled vs active is the whole distinction.
  const canceled = resolveAccountStage({
    ...BASE_INPUT,
    approvedForAccess: true,
    subscriptionStatus: 'canceled',
    subscriptionStatusAt: '2026-07-20T09:00:00.000Z',
  });
  assert.equal(canceled.stage, 'lapsed');
  assert.match(canceled.reason, /canceled/i);
  assert.equal(resolveAccountStage({ ...BASE_INPUT, subscriptionStatus: 'unpaid' }).stage, 'lapsed');

  const revoked = resolveAccountStage({
    ...BASE_INPUT,
    accessStatus: 'revoked',
    accessStatusAt: '2026-07-22T09:00:00.000Z',
  });
  assert.equal(revoked.stage, 'lapsed');
  assert.match(revoked.reason, /revoked on 2026-07-22/i);

  // Revoked access while Stripe is still charging must read as PAYING, because
  // that mismatch is money moving for someone who cannot log in.
  const revokedButBilled = resolveAccountStage({
    ...BASE_INPUT,
    accessStatus: 'revoked',
    subscriptionStatus: 'active',
  });
  assert.equal(revokedButBilled.stage, 'paying');

  // ── trial
  const approvedNoGrant = resolveAccountStage({
    ...BASE_INPUT,
    accessStatus: 'approved',
    approvedForAccess: true,
  });
  assert.equal(approvedNoGrant.stage, 'trial');
  assert.match(approvedNoGrant.reason, /not granted yet/i);

  const stripeTrial = resolveAccountStage({ ...BASE_INPUT, subscriptionStatus: 'trialing' });
  assert.equal(stripeTrial.stage, 'trial');
  assert.match(stripeTrial.reason, /no charge/i);

  // ── applicant
  const applicant = resolveAccountStage({ ...BASE_INPUT, accessStatus: 'requested' });
  assert.equal(applicant.stage, 'applicant');
  assert.match(applicant.reason, /not approved yet/i);
  assert.equal(resolveAccountStage(BASE_INPUT).stage, 'applicant');

  // An abandoned checkout is neither revenue nor a lapse — it annotates.
  const abandonedCheckout = resolveAccountStage({
    ...BASE_INPUT,
    accessStatus: 'requested',
    subscriptionStatus: 'incomplete',
  });
  assert.equal(abandonedCheckout.stage, 'applicant');
  assert.match(abandonedCheckout.reason, /never completed/i);
  assert.ok(abandonedCheckout.derivedFrom.includes('billing.subscriptionStatus'));

  // ── the override can only ever produce `internal`.
  const overridden = resolveAccountStage({
    ...BASE_INPUT,
    stageOverride: 'internal',
    stageOverrideAt: '2026-08-02T11:30:00.000Z',
  });
  assert.equal(overridden.stage, 'internal');
  assert.deepEqual(overridden.derivedFrom, ['accountStage.override']);
  assert.match(overridden.reason, /2026-08-02/);
  // A stage smuggled in as an override is ignored, not honored.
  assert.equal(
    resolveAccountStage({ ...BASE_INPUT, stageOverride: 'paying' as never }).stage,
    'applicant',
  );

  // Every stage the enum promises is reachable from the rules above.
  assert.deepEqual([...ACCOUNT_STAGES].sort(), ['applicant', 'internal', 'lapsed', 'paying', 'trial']);

  // No reason may leak an identifier — they are built from literals and dates.
  for (const resolution of [admin, demo, paying, richTrial, canceled, revoked, applicant]) {
    assert.equal(/@/.test(resolution.reason), false, 'a reason must never carry an email');
  }
});

test('participant types keep working for values stored before the two additions', async () => {
  const { normalizeParticipantType, defaultParticipantType, PARTICIPANT_TYPES } =
    await import('../src/betaProgram');

  // Back-compat: every value written by the pre-2026-08-02 build still resolves.
  for (const legacy of ['founder_operator', 'investor', 'partner']) {
    assert.equal(normalizeParticipantType(legacy), legacy);
    assert.ok(PARTICIPANT_TYPES.includes(legacy as never));
  }
  for (const added of ['team_member', 'advisor']) {
    assert.equal(normalizeParticipantType(added), added);
  }

  // Unknown values do not throw and do not pass through — callers default.
  for (const unknown of ['tester', 'paying_client', '', null, undefined, 42, {}]) {
    assert.equal(normalizeParticipantType(unknown), null);
  }
  assert.equal(defaultParticipantType(), 'founder_operator');
});

test('the account directory resolves real stored state, including the never-ran case', async () => {
  const auth = await import('../src/auth');
  const access = await import('../src/adminAccessStore');
  const consent = await import('../src/betaConsentStore');
  const betaProgram = await import('../src/betaProgram');
  const billing = await import('../src/platform/billing');
  const store = await import('../src/platform/store');
  const workspace = await import('../src/platform/workspace');
  const { listAccountStageRecords } = await import('../src/accountStageDirectory');

  const acceptedAt = '2026-07-11T12:01:00.000Z';
  const approve = (email: string, participantType: 'founder_operator' | 'team_member' | 'advisor') => {
    consent.recordBetaConsent({
      email,
      participantType,
      authMethod: 'email',
      acceptanceSource: 'signup',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
    });
    access.recordAccessRequest({
      email,
      method: 'email',
      participantType,
      identityVerifiedAt: '2026-07-11T12:00:00.000Z',
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
    });
    access.setAccessStatus({ email, status: 'approved', role: 'user', updatedBy: 'staff@example.invalid' });
  };

  // 1. approved, trial granted, has run → trial + activated
  approve('ran@example.invalid', 'team_member');
  const ranUser = auth.upsertAuthUser({
    email: 'ran@example.invalid',
    name: 'Ran User',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  store.addLedgerEntry({
    workspaceId: ranUser.defaultWorkspaceId,
    source: 'trial_grant',
    deltaCredits: 500,
    referenceType: 'beta_trial',
    referenceId: `beta_trial:${ranUser.defaultWorkspaceId}`,
  });
  const ranTask = store.createTask({
    workspaceId: ranUser.defaultWorkspaceId,
    title: 'Ran task',
    kind: 'automation',
  });
  const succeededRun = store.createTaskRun({
    workspaceId: ranUser.defaultWorkspaceId,
    taskId: ranTask.id,
    agentRole: 'operator',
    modelTier: 'default',
    estimatedCredits: 1,
  });
  store.updateTaskRun(succeededRun.id, { status: 'succeeded' });

  // 2. approved, trial granted, NEVER RAN → trial + not activated
  approve('neverran@example.invalid', 'advisor');
  const neverRanUser = auth.upsertAuthUser({
    email: 'neverran@example.invalid',
    name: 'Never Ran',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  store.addLedgerEntry({
    workspaceId: neverRanUser.defaultWorkspaceId,
    source: 'trial_grant',
    deltaCredits: 500,
    referenceType: 'beta_trial',
    referenceId: `beta_trial:${neverRanUser.defaultWorkspaceId}`,
  });

  // 3. paying: an ACTIVE subscription on the workspace.
  approve('paying@example.invalid', 'founder_operator');
  const payingUser = auth.upsertAuthUser({
    email: 'paying@example.invalid',
    name: 'Paying User',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  store.addLedgerEntry({
    workspaceId: payingUser.defaultWorkspaceId,
    source: 'trial_grant',
    deltaCredits: 500,
    referenceType: 'beta_trial',
    referenceId: `beta_trial:${payingUser.defaultWorkspaceId}`,
  });
  billing.upsertBillingConfig(payingUser.defaultWorkspaceId, {
    planId: 'pro',
    subscriptionStatus: 'active',
  });

  // 4. lapsed: a CANCELED subscription — same shape as 3, opposite status.
  approve('churned@example.invalid', 'founder_operator');
  const churnedUser = auth.upsertAuthUser({
    email: 'churned@example.invalid',
    name: 'Churned User',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  billing.upsertBillingConfig(churnedUser.defaultWorkspaceId, {
    planId: 'pro',
    subscriptionStatus: 'canceled',
  });

  // 5. applicant: requested, never approved.
  access.recordAccessRequest({ email: 'applicant@example.invalid', method: 'email' });

  // 6. admin in a tenant workspace.
  const adminUser = auth.upsertAuthUser({
    email: 'staff@example.invalid',
    name: 'Staff',
    role: 'admin',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });

  // 7. demo workspace.
  approve('demo@example.invalid', 'founder_operator');
  const demoUser = auth.upsertAuthUser({
    email: 'demo@example.invalid',
    name: 'Demo User',
    role: 'user',
    method: 'email',
    acceptedTerms: true,
    acceptedEducation: true,
  });
  workspace.upsertWorkspaceProfile(demoUser.defaultWorkspaceId, {
    name: 'Demo Workspace',
    metadata: { demo: true },
  });

  const byEmail = new Map(listAccountStageRecords().map((record) => [record.email, record]));

  assert.equal(byEmail.get('ran@example.invalid')?.accountStage.stage, 'trial');
  assert.equal(byEmail.get('ran@example.invalid')?.activated, true);
  assert.equal(byEmail.get('ran@example.invalid')?.participantType, 'team_member');

  const neverRan = byEmail.get('neverran@example.invalid');
  assert.equal(neverRan?.accountStage.stage, 'trial');
  assert.equal(neverRan?.activated, false, 'approved with a grant but no run is trial, not activated');
  assert.equal(neverRan?.participantType, 'advisor');

  assert.equal(byEmail.get('paying@example.invalid')?.accountStage.stage, 'paying');
  assert.equal(byEmail.get('churned@example.invalid')?.accountStage.stage, 'lapsed');
  assert.equal(byEmail.get('applicant@example.invalid')?.accountStage.stage, 'applicant');
  assert.equal(byEmail.get('demo@example.invalid')?.accountStage.stage, 'internal');

  const staff = byEmail.get('staff@example.invalid');
  assert.equal(staff?.accountStage.stage, 'internal');
  assert.notEqual(adminUser.defaultWorkspaceId, '');

  // A run that merely started does not count as activation.
  const failedRun = store.createTaskRun({
    workspaceId: neverRanUser.defaultWorkspaceId,
    taskId: store.createTask({
      workspaceId: neverRanUser.defaultWorkspaceId,
      title: 'Started only',
      kind: 'automation',
    }).id,
    agentRole: 'operator',
    modelTier: 'default',
    estimatedCredits: 1,
  });
  store.updateTaskRun(failedRun.id, { status: 'failed' });
  const afterFailedRun = new Map(
    listAccountStageRecords().map((record) => [record.email, record]),
  );
  assert.equal(
    afterFailedRun.get('neverran@example.invalid')?.activated,
    false,
    'a failed run is not a completed run',
  );
});

test('admin filters return the correct sets and facets stay unfiltered', async () => {
  const dashboard = await import('../src/adminDashboard');
  const routes = await import('../src/adminRoutes');

  const rows = dashboard.buildAdminUsers();
  assert.ok(rows.length >= 6);
  for (const row of rows) {
    assert.ok(row.accountStage && typeof row.accountStage.stage === 'string');
    assert.ok(Array.isArray(row.accountStage.derivedFrom));
    assert.equal(typeof row.activated, 'boolean');
  }

  const trialOnly = dashboard.filterAdminUsers(rows, { stage: ['trial'] });
  assert.ok(trialOnly.length > 0);
  assert.ok(trialOnly.every((row) => row.accountStage.stage === 'trial'));
  assert.ok(trialOnly.some((row) => row.email === 'ran@example.invalid'));
  assert.equal(trialOnly.some((row) => row.email === 'paying@example.invalid'), false);

  const payingOrLapsed = dashboard.filterAdminUsers(rows, { stage: ['paying', 'lapsed'] });
  assert.deepEqual(
    payingOrLapsed.map((row) => row.email).sort(),
    ['churned@example.invalid', 'paying@example.invalid'],
  );

  const advisors = dashboard.filterAdminUsers(rows, { participantType: ['advisor'] });
  assert.deepEqual(advisors.map((row) => row.email), ['neverran@example.invalid']);

  const activatedTrials = dashboard.filterAdminUsers(rows, { stage: ['trial'], activated: true });
  assert.deepEqual(activatedTrials.map((row) => row.email), ['ran@example.invalid']);
  const dormantTrials = dashboard.filterAdminUsers(rows, { stage: ['trial'], activated: false });
  assert.equal(dormantTrials.some((row) => row.email === 'neverran@example.invalid'), true);
  assert.equal(dormantTrials.some((row) => row.email === 'ran@example.invalid'), false);

  // An omitted filter must never empty the table.
  assert.equal(dashboard.filterAdminUsers(rows, {}).length, rows.length);
  assert.equal(dashboard.filterAdminUsers(rows, { stage: [] }).length, rows.length);

  // Facets count the whole base, so narrowing does not hide the rest of it.
  const facets = dashboard.summarizeAdminUserFacets(rows);
  assert.equal(facets.total, rows.length);
  assert.equal(facets.byStage.paying, 1);
  assert.equal(facets.byStage.lapsed, 1);
  assert.equal(facets.byParticipantType.advisor, 1);
  assert.equal(facets.activated + facets.notActivated, rows.length);

  // Filter parsing: comma lists, repeats, and loud rejection of junk.
  assert.deepEqual(routes.parseAccountStageFilter('trial,paying'), ['trial', 'paying']);
  assert.deepEqual(routes.parseAccountStageFilter(['trial', 'lapsed']), ['trial', 'lapsed']);
  assert.equal(routes.parseAccountStageFilter(undefined), undefined);
  assert.equal(routes.parseAccountStageFilter(''), undefined);
  assert.throws(() => routes.parseAccountStageFilter('vip'), /stage must be one of/);
  assert.deepEqual(routes.parseParticipantTypeFilter('advisor'), ['advisor']);
  assert.throws(() => routes.parseParticipantTypeFilter('tester'), /participantType must be one of/);
  assert.equal(routes.parseActivatedFilter('true'), true);
  assert.equal(routes.parseActivatedFilter('false'), false);
  assert.equal(routes.parseActivatedFilter(undefined), undefined);
  assert.throws(() => routes.parseActivatedFilter('maybe'), /activated must be true or false/);

  // The overview publishes the closed sets and the stage counts.
  const overview = dashboard.buildAdminOverview();
  assert.deepEqual(overview.catalog.accountStages, ['internal', 'applicant', 'trial', 'paying', 'lapsed']);
  assert.ok(overview.catalog.participantTypes.includes('team_member'));
  assert.equal(overview.metrics.accountsByStage.paying, 1);
  assert.equal(typeof overview.metrics.activatedAccounts, 'number');
});

test('an admin cannot set a derived stage, and the override records who set it', async () => {
  const access = await import('../src/adminAccessStore');
  const routes = await import('../src/adminRoutes');
  const dashboard = await import('../src/adminDashboard');

  // The write is refused loudly. A silently dropped field is how a caller comes
  // to believe a stage was set when nothing happened.
  for (const body of [
    { accountStage: 'paying' },
    { stage: 'paying' },
    { status: 'approved', accountStage: 'internal' },
  ]) {
    assert.throws(
      () => routes.assertNoDerivedStageWrite(body),
      /derived from billing, access, and ledger truth/,
    );
  }
  assert.doesNotThrow(() => routes.assertNoDerivedStageWrite({ status: 'approved', participantType: 'advisor' }));
  assert.doesNotThrow(() => routes.assertNoDerivedStageWrite(undefined));

  // The override parser admits exactly one value.
  assert.equal(routes.parseAccountStageOverride('internal'), 'internal');
  assert.equal(routes.parseAccountStageOverride(null), null);
  assert.equal(routes.parseAccountStageOverride(''), null);
  for (const forbidden of ['paying', 'trial', 'lapsed', 'applicant']) {
    assert.throws(() => routes.parseAccountStageOverride(forbidden), /stage override must be null or internal/);
  }

  // Applying it flips the derived stage and records the actor.
  const before = dashboard.buildAdminUsers().find((row) => row.email === 'ran@example.invalid');
  assert.equal(before?.accountStage.stage, 'trial');

  const record = access.setAccessStageOverride({
    email: 'ran@example.invalid',
    override: 'internal',
    updatedBy: 'staff@example.invalid',
  });
  assert.equal(record.stageOverride, 'internal');
  assert.equal(record.stageOverrideBy, 'staff@example.invalid');
  assert.ok(record.stageOverrideAt);

  const overrideAudit = access.listAdminAuditEvents(50)
    .find((event) => event.action === 'stage.override.updated' && event.targetEmail === 'ran@example.invalid');
  assert.ok(overrideAudit, 'setting an override must be auditable');
  assert.equal(overrideAudit?.actorEmail, 'staff@example.invalid');

  const after = dashboard.buildAdminUsers().find((row) => row.email === 'ran@example.invalid');
  assert.equal(after?.accountStage.stage, 'internal');
  assert.equal(after?.stageOverrideBy, 'staff@example.invalid');
  assert.deepEqual(after?.accountStage.derivedFrom, ['accountStage.override']);

  // An access decision must not silently erase the override.
  access.setAccessStatus({
    email: 'ran@example.invalid',
    status: 'revoked',
    updatedBy: 'staff@example.invalid',
    note: 'checking carry-through',
  });
  assert.equal(access.getAccessRecord('ran@example.invalid')?.stageOverride, 'internal');

  // Clearing it returns the account to derived truth.
  access.setAccessStageOverride({
    email: 'ran@example.invalid',
    override: null,
    updatedBy: 'staff@example.invalid',
  });
  const cleared = access.getAccessRecord('ran@example.invalid');
  assert.equal(cleared?.stageOverride, undefined);
  assert.equal(cleared?.stageOverrideBy, undefined);
  const restored = dashboard.buildAdminUsers().find((row) => row.email === 'ran@example.invalid');
  assert.equal(restored?.accountStage.stage, 'lapsed', 'access was revoked above, so derived truth is lapsed');

  // A stage the store never should have held fails the strict reader rather
  // than being quietly accepted.
  const accessFile = path.join(process.cwd(), 'admin-access.json');
  const original = fs.readFileSync(accessFile, 'utf-8');
  try {
    const rows = JSON.parse(original) as Array<Record<string, unknown>>;
    rows[0].stageOverride = 'paying';
    fs.writeFileSync(accessFile, JSON.stringify(rows));
    assert.throws(() => access.listAdminAccessRecords(), /invalid stageOverride/);
  } finally {
    fs.writeFileSync(accessFile, original);
  }
});

test('the weekly brief carries a stage funnel without carrying account identity', async () => {
  const telemetry = await import('../src/platform/platformTelemetry');

  const snapshot = telemetry.buildPlatformTelemetrySnapshot({ now: new Date('2026-08-02T12:00:00.000Z') });
  const funnel = snapshot.stageFunnel;

  assert.equal(typeof funnel.totalAccounts, 'number');
  assert.ok(funnel.totalAccounts > 0);
  // Every known stage is emitted, including zeroes, so the brief's shape is
  // stable week to week and an emptying stage reads as a change, not a gap.
  assert.deepEqual(
    funnel.byStage.map((bucket) => bucket.stage),
    ['internal', 'applicant', 'trial', 'paying', 'lapsed'],
  );
  const paying = funnel.byStage.find((bucket) => bucket.stage === 'paying');
  assert.equal(paying?.accounts, 1);

  const trial = funnel.byStage.find((bucket) => bucket.stage === 'trial');
  assert.ok(trial);
  assert.equal(
    trial!.activationRatePct,
    trial!.accounts > 0 ? Math.round((trial!.activated / trial!.accounts) * 1000) / 10 : 0,
  );

  assert.ok(funnel.trialGranted >= 1);
  assert.equal(funnel.trialConvertedToPaying, 1, 'the paying workspace also holds a trial grant');
  assert.ok(funnel.trialToPayingConversionPct > 0);
  assert.ok(funnel.byParticipantType.some((bucket) => bucket.participantType === 'advisor'));

  // The funnel is counts only: no email, no reason text, no override actor.
  const serialized = JSON.stringify(funnel);
  assert.equal(serialized.includes('@'), false, 'no address may reach the brief');
  assert.equal(/derivedFrom|reason|stageOverrideBy/.test(serialized), false);

  assert.ok(snapshot.notes.some((note) => /never hand-set/i.test(note)));
});

test.after(() => {
  process.chdir(os.tmpdir());
  fs.rmSync(tempDir, { recursive: true, force: true });
});
