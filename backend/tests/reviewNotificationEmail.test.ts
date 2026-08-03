import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewWaitingEmail } from '../src/reviewNotificationEmail';

test('review-waiting email announces without leaking the draft', () => {
  const message = buildReviewWaitingEmail({ missionName: 'Competitor monitor', ownerName: 'Ada' });
  assert.equal(message.subject, 'Competitor monitor has a draft waiting for your review');
  assert.ok(message.body.startsWith('Hi Ada,'));
  // The three facts the owner needs: nothing sent, where to act, what acting does.
  assert.ok(message.body.includes('Nothing has been sent'));
  assert.ok(message.body.includes('https://violema.com/dashboard'));
  assert.ok(message.body.includes('Reviews tab'));
  assert.ok(message.body.includes('Approve to deliver'));
  // Browser-agnostic entry stays part of every ask-to-log-in moment.
  assert.ok(message.body.includes('Email me a sign-in link'));
  // No draft content markers — the notice must never read as the delivery.
  assert.ok(!message.body.includes('#'), 'no markdown headings from any draft');
});

test('greeting degrades without a name', () => {
  assert.ok(buildReviewWaitingEmail({ missionName: 'Revenue watch' }).body.startsWith('Hi,'));
});
