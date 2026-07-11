import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string) {
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
  assert(adminDashboard.includes(field), `admin user contract includes ${field}`);
}

for (const label of ['Participant', 'Terms', 'Trial']) {
  assert(adminDashboard.includes(`>${label}<`), `admin renders the ${label} evidence label`);
}

assert(
  adminDashboard.includes('Verified OAuth identity and current beta confidentiality acceptance are required before approval.'),
  'disabled approval explains the identity and terms requirements',
);
assert(
  /disabled=\{[^}]*!user\.approvalReady[^}]*\}/.test(adminDashboard),
  'approval is disabled until the server projection marks the user ready',
);
assert(
  /patchAdminJson[\s\S]*participantType/.test(adminDashboard),
  'participant correction uses the existing admin access mutation',
);
assert(
  !/participantType[\s\S]{0,120}onRoleChange/.test(adminDashboard),
  'participant classification is not conflated with role changes',
);

console.log('adminBetaAccess.contract: approval evidence and trial state verified');
