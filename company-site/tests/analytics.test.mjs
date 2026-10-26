import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analytics, analyticsEnabled, analyticsScript, ANALYTICS_RETENTION_MONTHS, TRACKER_SRC } from '../lib/analytics.mjs';
import { buildLegalPolicies, legalPolicies, privacyRevisedAt } from '../lib/legal.mjs';
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
  // The People we contact revision (2026-10-26) is later than the pre-analytics date, so it is the effective date.
  assert.equal(buildLegalPolicies(OFF)[1].updatedAt, privacyRevisedAt);
});

test('privacy describes the statistics, the four counted actions, Do Not Track and retention once it is on', () => {
  const policies = buildLegalPolicies(ON);
  const text = privacyText(policies);
  assert.equal(policies[1].updatedAt, ON.policyDate > privacyRevisedAt ? ON.policyDate : privacyRevisedAt);
  assert.equal(buildLegalPolicies({ ...ON, policyDate: '2026-12-01' })[1].updatedAt, '2026-12-01', 'a later analytics policy date still wins');
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

test('privacy section 3 tells researchers we write to where their details come from, why, and how to stop', () => {
  for (const config of [OFF, ON]) {
    const privacy = buildLegalPolicies(config).find(policy => policy.slug === 'privacy');
    assert.deepEqual(privacy.sections.map(section => Number.parseInt(section.title, 10)), [1, 2, 3, 4, 5, 6, 7, 8], 'sections stay numbered in order');
    const contact = privacy.sections.find(section => section.id === 'people-we-contact');
    assert.equal(contact.title, '3. People we contact');
    for (const phrase of ['public sources', 'Proofpoint Essentials', 'institutional websites', 'legitimate interest', 'do not use it for marketing', 'AI services', 'within 12 months', 'Your right to object', 'One reply asking us to stop is enough', 'mailto:privacy@violema.com', 'data protection authority', 'Microsoft 365']) {
      assert.ok(contact.html.includes(phrase), phrase);
    }
    assert.ok(contact.html.includes('as section 7 describes'));
    assert.ok(privacy.sections.find(section => section.id === 'choices-rights').title.startsWith('7. '), 'section 7 is the rights section it points to');
    assert.ok(privacy.sections.find(section => section.id === 'scope').html.includes('(section 3)'));
    assert.ok(!/—/.test(privacyText([privacy])), 'no em-dashes in public copy');
  }
  const on = privacyText(buildLegalPolicies(ON));
  assert.ok(on.includes('never the values chosen (section 4)'), 'the visit-statistics cross-reference follows the renumbering');
});
