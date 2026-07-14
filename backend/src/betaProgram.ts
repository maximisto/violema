import crypto from 'crypto';

export type ParticipantType = 'founder_operator' | 'investor' | 'partner';
export const PARTICIPANT_TYPES: ParticipantType[] = ['founder_operator', 'investor', 'partner'];
export const CURRENT_BETA_TERMS_VERSION = '2026-07-11-beta-confidentiality-v1';
export const BETA_TERMS_PATH = '/terms#beta-confidentiality';
export const CURRENT_BETA_TERMS_CANONICAL_TEXT = `Beta Confidentiality and Evaluation Terms

Beta information. "Beta Information" means nonpublic information disclosed through or about the controlled beta, including pre-release product behavior, interfaces, documentation, benchmarks, roadmaps, pricing experiments, and nonpublic commercial or technical information.

Evaluation-only use. You may use Beta Information only to evaluate VIOLEMA and provide feedback during your approved participation. You may not use Beta Information for any other purpose without Purple Orange AI's written permission.

Protection and disclosure. You must use reasonable care to protect Beta Information and may not disclose it to any third party without Purple Orange AI's written permission.

Exclusions. Beta Information does not include information that you can document was already public through no breach of these Terms, previously known to you without restriction, independently developed without use of Beta Information, or lawfully received from another source without a duty of confidentiality.

Required disclosure. If law or valid legal process requires disclosure, you may disclose only what is legally required and, when permitted, must give Purple Orange AI prompt advance notice and reasonable assistance in seeking protective treatment.

Publicity restrictions. During the confidential beta, you may not publish screenshots, recordings, benchmarks, roadmaps, or public claims about the product without Purple Orange AI's written approval.

Duration. These obligations continue for two years after your last beta access. Information qualifying as a trade secret remains protected for as long as it qualifies as a trade secret under applicable law.

Participant data. Purple Orange AI's obligation to protect participant workspace data continues under the Privacy Policy and applicable onboarding terms.

Counsel-review notice. This beta confidentiality language should be reviewed by qualified counsel before broad external onboarding.`;
export const CURRENT_BETA_TERMS_DIGEST = crypto
  .createHash('sha256')
  .update(CURRENT_BETA_TERMS_CANONICAL_TEXT)
  .digest('hex');

export function normalizeParticipantType(value: unknown): ParticipantType | null {
  return typeof value === 'string' && PARTICIPANT_TYPES.includes(value as ParticipantType)
    ? value as ParticipantType
    : null;
}

export function defaultParticipantType(): ParticipantType {
  return 'founder_operator';
}
