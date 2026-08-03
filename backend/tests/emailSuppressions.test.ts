import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyPostmarkWebhook,
  isEmailSuppressed,
  listEmailSuppressions,
  recordEmailSuppression,
  verifyPostmarkWebhookSecret,
} from '../src/emailSuppressions';

// The store binds process.cwd() at call time, so the whole suite runs from a
// scratch directory and never touches the repo's runtime data.
const ORIGINAL_CWD = process.cwd();
const SCRATCH_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-suppressions-'));
process.chdir(SCRATCH_DIR);
assert.equal(process.cwd(), fs.realpathSync(SCRATCH_DIR), 'suite must run from the scratch directory');

const STORE = path.join(process.cwd(), 'email-suppressions.json');

beforeEach(() => {
  fs.rmSync(STORE, { force: true });
});

after(() => {
  process.chdir(ORIGINAL_CWD);
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
});

test('classification: hard bounces and complaints suppress, the rest is ignored', () => {
  const hard = classifyPostmarkWebhook({
    RecordType: 'Bounce',
    Type: 'HardBounce',
    Email: 'Gone@Example.com',
    Description: 'The server was unable to deliver your message',
    MessageID: 'msg-1',
  });
  assert.deepEqual(hard, {
    action: 'suppress',
    email: 'gone@example.com',
    reason: 'hard_bounce',
    recordType: 'Bounce',
    bounceType: 'HardBounce',
    detail: 'The server was unable to deliver your message',
    messageId: 'msg-1',
  });

  const complaint = classifyPostmarkWebhook({ RecordType: 'SpamComplaint', Email: 'angry@example.com' });
  assert.equal(complaint.action, 'suppress');
  assert.equal((complaint as { reason: string }).reason, 'spam_complaint');

  const spamNotification = classifyPostmarkWebhook({
    RecordType: 'Bounce',
    Type: 'SpamNotification',
    Email: 'flagged@example.com',
  });
  assert.equal((spamNotification as { reason: string }).reason, 'spam_complaint');

  // A full mailbox today is deliverable tomorrow.
  assert.equal(
    classifyPostmarkWebhook({ RecordType: 'Bounce', Type: 'Transient', Email: 'full@example.com' }).action,
    'ignore',
  );
  assert.equal(classifyPostmarkWebhook({ RecordType: 'Delivery', Recipient: 'ok@example.com' }).action, 'ignore');
  assert.equal(classifyPostmarkWebhook({ RecordType: 'Bounce', Type: 'HardBounce' }).action, 'ignore');
  assert.equal(classifyPostmarkWebhook(null).action, 'ignore');
  assert.equal(classifyPostmarkWebhook('junk').action, 'ignore');
});

test('suppression round-trip: record once, block case-insensitively, never resurrect', () => {
  const decision = classifyPostmarkWebhook({
    RecordType: 'Bounce',
    Type: 'HardBounce',
    Email: 'bounced@example.com',
  });
  assert.equal(decision.action, 'suppress');
  const suppress = decision as Extract<typeof decision, { action: 'suppress' }>;

  const first = recordEmailSuppression(suppress, { now: () => '2026-08-02T22:00:00.000Z' });
  assert.equal(first.recorded, true);
  const second = recordEmailSuppression(suppress);
  assert.equal(second.recorded, false, 'a repeat event must not duplicate the record');

  assert.equal(listEmailSuppressions().length, 1);
  const hit = isEmailSuppressed('BOUNCED@example.com');
  assert.ok(hit, 'lookups must be case-insensitive');
  assert.equal(hit?.reason, 'hard_bounce');
  assert.equal(hit?.suppressedAt, '2026-08-02T22:00:00.000Z');
  assert.equal(isEmailSuppressed('someone-else@example.com'), null);
});

test('an unreadable store fails open: mail flows, nothing throws', () => {
  fs.writeFileSync(STORE, 'not json at all');
  assert.equal(isEmailSuppressed('anyone@example.com'), null);
  assert.deepEqual(listEmailSuppressions(), []);
});

test('webhook secret check is present-and-equal, never prefix-happy', () => {
  assert.equal(verifyPostmarkWebhookSecret('s3cret', 's3cret'), true);
  assert.equal(verifyPostmarkWebhookSecret('s3cret-longer', 's3cret'), false);
  assert.equal(verifyPostmarkWebhookSecret('s3cre', 's3cret'), false);
  assert.equal(verifyPostmarkWebhookSecret(undefined, 's3cret'), false);
  assert.equal(verifyPostmarkWebhookSecret('', 's3cret'), false);
  assert.equal(verifyPostmarkWebhookSecret('anything', ''), false);
});
