import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePersistedAutomationSteps } from '../src/platform/automationSteps';

test('normalizePersistedAutomationSteps preserves optional query steps', () => {
  const steps = normalizePersistedAutomationSteps([
    {
      id: 'step_drive',
      kind: 'query',
      title: 'Scan Drive source material',
      objective: 'Find optional source docs.',
      inputs: { source: 'google_drive', query_type: 'recent_docs' },
      optional: true,
    },
    {
      id: 'step_gmail',
      kind: 'query',
      title: 'Review Gmail commitments',
      objective: 'Find required Gmail commitments.',
      inputs: { source: 'gmail', query_type: 'commitments' },
      optional: false,
    },
  ]);

  assert.equal(steps[0].optional, true);
  assert.equal(Object.prototype.hasOwnProperty.call(steps[1], 'optional'), false);
});
