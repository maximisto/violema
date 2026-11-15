import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { briefingRoles, briefingIntents, briefingLimits } from '../lib/briefing.mjs';
import { briefingPresets } from '../browser/briefing.mjs';

const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist');
const form = async () => (await readFile(join(dist, 'index.html'), 'utf8')).match(/<form class="briefing-form"[\s\S]*?<\/form>/)[0];

test('role labels fit visitors outside biotech; the values are the handler\'s and keep their order', () => {
  assert.deepEqual(briefingRoles.map(({ value, label }) => [value, label]), [
    ['biotech', 'Biotech or pharma team'],
    ['fund', 'Investor, funder or prize program'],
    ['clinic', 'Clinic or care operator'],
    ['research', 'Research group or national lab'],
    ['other', 'Technology vendor or other'],
  ]);
});

test('the role select starts on a disabled "Choose one" and preselects no role', async () => {
  // The select names its error line, so a screen reader hears "Choose what describes you." with the field.
  const role = (await form()).match(/<select class="briefing-control" id="briefing-role" name="role" required aria-describedby="briefing-role-error">([\s\S]*?)<\/select>/)[1];
  assert.ok(role.startsWith('<option value="" selected disabled>Choose one</option>'));
  assert.equal((role.match(/ selected/g) || []).length, 1, 'only the placeholder is selected');
  assert.deepEqual([...role.matchAll(/<option value="([a-z-]+)">([^<]+)<\/option>/g)].map(match => match[1]), briefingRoles.map(item => item.value));
});

test('the topic placeholder names both fields', async () => {
  assert.match(await form(), /id="briefing-topic" name="topic" type="text" maxlength="200" placeholder="For example: psilocybin for depression, or a quantum chemistry benchmark"/);
});

const allowed = { intents: briefingIntents.map(item => item.value), roles: briefingRoles.map(item => item.value), topicLimit: briefingLimits.topic };

test('briefingPresets keeps known intent and role values and the topic', () => {
  assert.deepEqual(briefingPresets('?intent=expert-review&role=research&topic=Fe4S4%20benchmark%20record', allowed), { intent: 'expert-review', role: 'research', topic: 'Fe4S4 benchmark record' });
  assert.deepEqual(briefingPresets('intent=correction', allowed), { intent: 'correction' }, 'the leading ? is optional');
});

test('briefingPresets ignores values the form does not offer', () => {
  assert.deepEqual(briefingPresets('?intent=sales&role=admin', allowed), {});
  assert.deepEqual(briefingPresets('?intent=Correction&role=', allowed), {}, 'values match exactly');
  assert.deepEqual(briefingPresets('?intent=correction&role=research', { ...allowed, intents: [], roles: [] }), {}, 'only the lists given count');
  assert.deepEqual(briefingPresets('?name=x&email=a%40b.c&message=hi', allowed), {}, 'other fields are never preset');
});

test('briefingPresets trims the topic, drops control characters and cuts it to the field limit', () => {
  assert.deepEqual(briefingPresets('?topic=%20%20spin%20models%20%20', allowed), { topic: 'spin models' });
  assert.deepEqual(briefingPresets('?topic=a%00b%0Ac%1Bd%7Fe%C2%85f', allowed), { topic: 'abcdef' });
  assert.equal(briefingPresets(`?topic=${'x'.repeat(500)}`, allowed).topic.length, briefingLimits.topic);
  assert.deepEqual(briefingPresets('?topic=abcdef', { ...allowed, topicLimit: 3 }), { topic: 'abc' });
  assert.deepEqual(briefingPresets('?topic=abcdef', { ...allowed, topicLimit: -1 }), { topic: 'abcdef' }, 'an input without maxlength reports -1, which is no limit');
  assert.deepEqual(briefingPresets('?topic=%F0%9F%A7%AA%F0%9F%A7%AA', { ...allowed, topicLimit: 3 }), { topic: '🧪' }, 'a cut never leaves half a character');
});

test('briefingPresets returns nothing for an empty query or an empty topic', () => {
  assert.deepEqual(briefingPresets('', allowed), {});
  assert.deepEqual(briefingPresets('?', allowed), {});
  assert.deepEqual(briefingPresets('?topic=%20%0A%20', allowed), {});
});
