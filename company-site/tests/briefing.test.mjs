import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { briefingRoles, briefingIntents, briefingLimits } from '../lib/briefing.mjs';
import { briefingPresets, presetsToApply, enhanceBriefingForm } from '../browser/briefing.mjs';

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

// The form is usable before its module loads, and a reload restores what was in it.
test('a preset never replaces a choice made before the module loaded, or one the browser restored', () => {
  const presets = { intent: 'expert-review', role: 'research', topic: 'Fe4S4 benchmark record' };
  const untouched = { intentUntouched: true, roleUntouched: true, topicEmpty: true };
  assert.deepEqual(presetsToApply(presets, untouched), presets, 'an untouched form takes every preset');
  assert.deepEqual(presetsToApply(presets, { intentUntouched: false, roleUntouched: false, topicEmpty: false }), {}, 'a visitor who already chose a correction and a clinic, and typed a topic, keeps all three');
  assert.deepEqual(presetsToApply(presets, { ...untouched, intentUntouched: false }), { role: 'research', topic: 'Fe4S4 benchmark record' }, 'each field is judged on its own');
  assert.deepEqual(presetsToApply({}, untouched), {}, 'no preset, nothing to apply');
});

test('briefingPresets returns nothing for an empty query or an empty topic', () => {
  assert.deepEqual(briefingPresets('', allowed), {});
  assert.deepEqual(briefingPresets('?', allowed), {});
  assert.deepEqual(briefingPresets('?topic=%20%0A%20', allowed), {});
});

// The enhancer itself, against a small in-memory form that offers only what browser/briefing.mjs
// touches. `intent`, `role` and `topic` are what the form holds when the module starts: what the
// page was built with, what the visitor chose while it loaded, or what a reload restored.
function fixture({ search = '', state = null, intent = 'briefing', role = '', topic = '' } = {}) {
  const inert = { addEventListener() {}, setAttribute() {}, removeAttribute() {} };
  const select = (values, built, now) => {
    const options = values.map(value => ({ value, selected: value === now, defaultSelected: value === built }));
    return { ...inert, options, required: true,
      get value() { return options.find(option => option.selected)?.value ?? ''; },
      set value(next) { for (const option of options) option.selected = option.value === next; } };
  };
  const text = value => ({ ...inert, value, defaultValue: '', placeholder: '', required: false, maxLength: briefingLimits.topic });
  const elements = {
    intent: select(briefingIntents.map(item => item.value), 'briefing', intent),
    role: select(['', ...briefingRoles.map(item => item.value)], '', role),
    name: text(''), email: text(''), organization: text(''), topic: text(topic), message: text(''), website: text(''),
  };
  const part = () => ({ ...inert, hidden: true, textContent: '', querySelector: part });
  const submit = part();
  const form = {
    ...inert, elements,
    dataset: { briefingIntents: JSON.stringify(briefingIntents.map(({ value, submit: label, prompt, record }) => ({ value, submit: label, prompt, record: Boolean(record) }))) },
    querySelector: selector => (selector === '[data-briefing-submit]' ? submit : part()),
  };
  const history = { state, replaceState(next, _title, url) { assert.equal(url, undefined, 'the address never changes'); this.state = next; } };
  globalThis.window = { location: { search }, history };
  return { form, elements, submit, history };
}
test.after(() => { delete globalThis.window; });

const PRESET_LINK = '?intent=correction&role=research&topic=Fe4S4%20benchmark%20record';
const held = elements => [elements.intent.value, elements.role.value, elements.topic.value];

test('a first visit through a preset link fills the form once and marks the history entry', () => {
  const { form, elements, submit, history } = fixture({ search: PRESET_LINK });
  enhanceBriefingForm(form);
  assert.deepEqual(held(elements), ['correction', 'research', 'Fe4S4 benchmark record']);
  assert.equal(submit.textContent, 'Send correction');
  assert.equal(elements.message.required, true, 'a correction needs its message');
  assert.equal(elements.organization.required, false);
  assert.deepEqual(history.state, { briefingPresets: true });
});

test('a visitor who changed the request type while the module loaded, and came back to the built option, keeps it', () => {
  const { form, elements } = fixture({ search: PRESET_LINK });
  enhanceBriefingForm(form, { touched: new Set(['intent']) });
  assert.equal(elements.intent.value, 'briefing', 'the select shows the option it was built with, but the visitor chose it');
  assert.equal(elements.role.value, 'research', 'a field the visitor left alone still takes its preset');
});

test('a reload of a preset link applies nothing, even to a field restored on its built option', () => {
  const { form, elements, history } = fixture({ search: PRESET_LINK, state: { briefingPresets: true, kept: 1 }, intent: 'briefing', role: 'clinic' });
  enhanceBriefingForm(form);
  assert.deepEqual(held(elements), ['briefing', 'clinic', '']);
  assert.deepEqual(history.state, { briefingPresets: true, kept: 1 }, 'the history entry is left as it was');
});

// Some browsers clear a form on reload. With nothing restored it is a fresh form.
test('a reload that restored nothing takes the presets again', () => {
  const { form, elements, history } = fixture({ search: PRESET_LINK, state: { briefingPresets: true } });
  enhanceBriefingForm(form);
  assert.deepEqual(held(elements), ['correction', 'research', 'Fe4S4 benchmark record']);
  assert.deepEqual(history.state, { briefingPresets: true });
});

test('a reload that restored only a typed name still keeps the whole form as the visitor left it', () => {
  const { form, elements } = fixture({ search: PRESET_LINK, state: { briefingPresets: true } });
  elements.name.value = 'A. Reader';
  enhanceBriefingForm(form);
  assert.deepEqual(held(elements), ['briefing', '', '']);
});

test('a visit without a preset link changes nothing and writes nothing to the history entry', () => {
  const { form, elements, history } = fixture();
  enhanceBriefingForm(form);
  assert.deepEqual(held(elements), ['briefing', '', '']);
  assert.equal(history.state, null);
});
