import type { ParticipantType } from './betaProgram';
import { addLedgerEntry, listLedgerEntries } from './platform/store';

export const BETA_TRIAL_CREDITS = 500;
export const BETA_TRIAL_CAMPAIGN = 'beta_trial_2026_07_v1';

export function ensureBetaTrialCredits(input: {
  workspaceId: string;
  participantType: ParticipantType;
  termsVersion: string;
  approvalActor?: string;
}) {
  const referenceId = `${BETA_TRIAL_CAMPAIGN}:${input.workspaceId}`;
  const existing = listLedgerEntries(input.workspaceId).find(
    (entry) => entry.source === 'trial_grant' && entry.referenceId === referenceId,
  );
  if (existing) return { entry: existing, created: false };

  const approvalActor = input.approvalActor?.trim();
  const entry = addLedgerEntry({
    workspaceId: input.workspaceId,
    source: 'trial_grant',
    deltaCredits: BETA_TRIAL_CREDITS,
    referenceType: 'beta_trial',
    referenceId,
    note: 'Controlled beta trial grant',
    metadata: {
      participantType: input.participantType,
      termsVersion: input.termsVersion,
      ...(approvalActor ? { approvalActor } : {}),
      oneTime: true,
    },
  });
  return { entry, created: true };
}
