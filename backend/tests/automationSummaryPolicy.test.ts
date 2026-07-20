import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOMATION_SUMMARY_MAX_TOKENS,
  requireCompleteAutomationSummary,
} from '../src/platform/automationSummaryPolicy';

test('automation summaries have enough output budget for a complete founder brief', () => {
  assert.ok(AUTOMATION_SUMMARY_MAX_TOKENS >= 1400);
});

test('requireCompleteAutomationSummary rejects provider-truncated drafts', () => {
  assert.throws(
    () => requireCompleteAutomationSummary({
      text: '# Weekly Founder Update\n\nIncomplete table row |',
      stopReason: 'length',
    }),
    /output limit/i,
  );
  assert.throws(
    () => requireCompleteAutomationSummary({
      text: '# Weekly Founder Update\n\nIncomplete',
      stopReason: 'max_tokens',
    }),
    /output limit/i,
  );
});

test('requireCompleteAutomationSummary accepts and trims completed drafts', () => {
  assert.equal(
    requireCompleteAutomationSummary({
      text: '  # Weekly Founder Update\n\n## Next actions\n- Ship.  ',
      stopReason: 'stop',
    }),
    '# Weekly Founder Update\n\n## Next actions\n- Ship.',
  );
});
