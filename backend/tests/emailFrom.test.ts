import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatEmailFrom } from '../src/integrations';

test('bare addresses gain the Violema display name', () => {
  assert.equal(formatEmailFrom('hello@violema.com'), 'Violema <hello@violema.com>');
  assert.equal(formatEmailFrom('  hello@violema.com  '), 'Violema <hello@violema.com>');
});

test('an operator-configured display name is never overridden', () => {
  assert.equal(
    formatEmailFrom('Violema Support <support@violema.com>'),
    'Violema Support <support@violema.com>',
  );
});
