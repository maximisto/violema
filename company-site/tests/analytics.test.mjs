import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analytics, analyticsEnabled, analyticsScript, ANALYTICS_RETENTION_MONTHS, TRACKER_SRC } from '../lib/analytics.mjs';
import { buildLegalPolicies, legalPolicies } from '../lib/legal.mjs';
import { shell } from '../lib/pages.mjs';

const ON = Object.freeze({ websiteId: '3f0c4e5a-9b1d-4c2e-8a7f-1d2e3f4a5b6c', policyDate: '2026-10-20' });
const OFF = Object.freeze({ websiteId: null, policyDate: null });
const privacyText = policies => {
  const privacy = policies.find(policy => policy.slug === 'privacy');
  return [privacy.summary, ...privacy.sections.map(section => section.html)].join(' ');
};

test('the switch is off, or fully and correctly set: a half-set or malformed one fails the build', () => {
  assert.equal(analyticsEnabled(OFF), false);
  assert.equal(analyticsEnabled(ON), true);
  assert.throws(() => analyticsEnabled({ websiteId: ON.websiteId, policyDate: null }), /policyDate/);
  assert.throws(() => analyticsEnabled({ websiteId: null, policyDate: ON.policyDate }), /UUID/);
  assert.throws(() => analyticsEnabled({ websiteId: 'not-a-uuid', policyDate: ON.policyDate }), /UUID/);
  assert.throws(() => analyticsEnabled({ websiteId: ON.websiteId, policyDate: '20 October' }), /YYYY-MM-DD/);
});

test('the tracker is a deferred first-party script, limited to violema.com, honouring Do Not Track', () => {
  assert.equal(analyticsScript(OFF), '');
  const tag = analyticsScript(ON);
  assert.match(tag, /^<script defer src="\/stats\/script\.js"/);
  assert.ok(TRACKER_SRC.startsWith('/'));
  for (const attribute of [`data-website-id="${ON.websiteId}"`, 'data-domains="violema.com,www.violema.com"', 'data-do-not-track="true"', 'data-exclude-search="true"', 'data-exclude-hash="true"']) {
    assert.ok(tag.includes(attribute), attribute);
  }
});

test('pages carry the tracker exactly when the switch is on', () => {
  assert.equal(shell('/', 'Title', 'Description', '<p></p>').includes(TRACKER_SRC), analytics.websiteId !== null);
});

test('privacy keeps its live no-analytics wording while the switch is off', () => {
  const text = privacyText(buildLegalPolicies(OFF));
  assert.ok(text.includes('advertising trackers, or analytics scripts'));
  assert.ok(text.includes("Do Not Track signal does not change their behavior"));
  assert.ok(!text.includes('Umami'));
  assert.equal(buildLegalPolicies(OFF)[1].updatedAt, '2026-10-15');
});

test('privacy describes the statistics, the four counted actions, Do Not Track and retention once it is on', () => {
  const policies = buildLegalPolicies(ON);
  const text = privacyText(policies);
  assert.equal(policies[1].updatedAt, ON.policyDate);
  for (const phrase of ['Umami', 'stores nothing on your device', 'Neither the IP address nor the full browser description is stored', 'changes every month', 'four actions', 'never anything you type or the value you choose', 'no visit statistics are recorded', `${ANALYTICS_RETENTION_MONTHS} months`, 'Turning on Do Not Track stops visit statistics']) {
    assert.ok(text.includes(phrase), phrase);
  }
  assert.ok(!text.includes('analytics scripts'), 'the no-analytics claim is gone');
  assert.ok(!text.includes('Do Not Track signal does not change'), 'the old Do Not Track claim is gone');
  assert.ok(!/—/.test(text), 'no em-dashes in public copy');
});

test('the browser counts only the four listed events, and only through window.umami', async () => {
  const source = await readFile(new URL('../browser/analytics.mjs', import.meta.url), 'utf8');
  const listed = [...source.matchAll(/'([a-z-]+)'/g)].map(match => match[1]).filter(name => name.includes('-'));
  assert.deepEqual(listed.sort(), ['corpus-switched', 'evidence-map-opened', 'shift-explored', 'trial-record-opened']);
  const callers = await Promise.all(['site.mjs', 'lab.mjs', 'experience.mjs'].map(name => readFile(new URL(`../browser/${name}`, import.meta.url), 'utf8')));
  const used = callers.flatMap(code => [...code.matchAll(/track\('([a-z-]+)'/g)].map(match => match[1]));
  assert.deepEqual([...new Set(used)].sort(), listed.sort());
  assert.ok(!callers.some(code => code.includes('data-umami-event')), 'no Umami click attributes: they would hold hash-link navigation');
});

test('the live legal policies are the switch-off set while websiteId is null', () => {
  if (analytics.websiteId === null) assert.deepEqual(legalPolicies, buildLegalPolicies(OFF));
});
