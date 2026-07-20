import type { TextGenerationResult } from '../models';

export const AUTOMATION_SUMMARY_MAX_TOKENS = 1400;
export const AUTOMATION_SUMMARY_WORD_LIMIT = 650;

const TRUNCATION_STOP_REASONS = new Set([
  'length',
  'max_tokens',
  'max_output_tokens',
]);

export function requireCompleteAutomationSummary(result: TextGenerationResult) {
  const stopReason = result.stopReason?.trim().toLowerCase();
  if (stopReason && TRUNCATION_STOP_REASONS.has(stopReason)) {
    throw new Error('Generated summary exceeded the output limit and was withheld from review.');
  }

  const text = result.text.trim();
  if (!text) {
    throw new Error('Generated summary was empty and was withheld from review.');
  }
  return text;
}
