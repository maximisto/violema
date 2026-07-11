import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function assertSource(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const adminDashboard = readFileSync(new URL('../src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');

for (const field of [
  'participantType',
  'identityVerified',
  'termsCurrent',
  'termsVersion',
  'approvalReady',
  'trialStatus',
  'trialCredits',
  'trialGrantedAt',
]) {
  assertSource(adminDashboard.includes(field), `admin user contract includes ${field}`);
}

for (const label of ['Participant', 'Terms', 'Trial']) {
  assertSource(adminDashboard.includes(`>${label}<`), `admin renders the ${label} evidence label`);
}

assertSource(
  adminDashboard.includes('Verified OAuth identity and current beta confidentiality acceptance are required before approval.'),
  'disabled approval explains the identity and terms requirements',
);
assertSource(
  adminDashboard.includes('export function buildParticipantAccessPatch'),
  'admin exposes a participant-only access patch contract',
);
assertSource(
  adminDashboard.includes('export function isAdminApprovalDisabled'),
  'admin exposes the approval disable contract',
);
const adminModule = await import('../src/pages/AdminDashboard');
const participantPatch = adminModule.buildParticipantAccessPatch('investor');
assert.deepEqual(participantPatch, { participantType: 'investor' });
assert.equal('status' in participantPatch, false, 'participant save must not imply approval or revocation');
assert.equal('role' in participantPatch, false, 'participant save must not mutate role');
assert.equal(adminModule.isAdminApprovalDisabled({ busy: false, isApproved: false, approvalReady: false, participantDirty: false }), true);
assert.equal(adminModule.isAdminApprovalDisabled({ busy: false, isApproved: false, approvalReady: true, participantDirty: true }), true);
assert.equal(adminModule.isAdminApprovalDisabled({ busy: false, isApproved: false, approvalReady: true, participantDirty: false }), false);

assertSource(adminDashboard.includes('Save participant'), 'participant control exposes an explicit save action');
assertSource(
  (adminDashboard.match(/<ParticipantControl\s+user=/g) || []).length === 2,
  'desktop and mobile user surfaces both render the participant save control',
);

const accessHandlerStart = adminDashboard.indexOf('const handleAccessChange');
const participantHandlerStart = adminDashboard.indexOf('const handleParticipantSave');
const roleHandlerStart = adminDashboard.indexOf('const handleRoleChange');
assertSource(accessHandlerStart >= 0 && participantHandlerStart > accessHandlerStart, 'participant save has its own handler after access mutation');
assertSource(roleHandlerStart > participantHandlerStart, 'role mutation remains a separate handler');
const accessHandler = adminDashboard.slice(accessHandlerStart, participantHandlerStart);
const participantHandler = adminDashboard.slice(participantHandlerStart, roleHandlerStart);
assertSource(!accessHandler.includes('participantType:'), 'approval mutation does not silently persist participant changes');
assertSource(participantHandler.includes('/access`'), 'participant save uses the existing access PATCH route');
assertSource(participantHandler.includes('buildParticipantAccessPatch'), 'participant save sends the participant-only contract');
assertSource(
  !participantHandler.includes('/role`') && !participantHandler.includes("status: 'approved'"),
  'participant save stays independent from role and approval mutations',
);

console.log('adminBetaAccess.contract: approval evidence and trial state verified');
