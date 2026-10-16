import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { corpora } from '../data/corpora.mjs';
import { escapeHTML } from '../lib/render.mjs';

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const playback = (await readFile(new URL('../browser/playback.mjs', import.meta.url), 'utf8')).replace('export function', 'function') + (await readFile(new URL('../browser/experience.mjs', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
const appearance = await readFile(new URL('../browser/appearance.css', import.meta.url), 'utf8');
const baseCSS = await readFile(new URL('../browser/site.css', import.meta.url), 'utf8');

test('the guided journey preserves the claim, its limits and every cited source before JavaScript', () => {
  const guide = html.slice(html.indexOf('class="evidence-guide'), html.indexOf('<div class="full-map"'));
  const corpus = corpora.find(item => item.id === 'psychdoc');
  const claim = corpus.claims[0];
  for (const text of [claim.text, claim.caveat, claim.status]) assert.ok(guide.includes(escapeHTML(text)));
  for (const id of claim.sourceIds) {
    const source = corpus.sources.find(item => item.id === id);
    assert.ok(guide.includes(escapeHTML(source.title)));
    assert.ok(guide.includes(escapeHTML(source.url)));
    assert.ok(guide.includes(escapeHTML(source.locator)));
  }
  assert.doesNotMatch(guide, /<section[^>]+hidden/);
  assert.match(html, /<div class="full-map" id="full-map">/);
  assert.doesNotMatch(html, /<details[^>]*class="full-map"/);
  assert.match(html, /href="#evidence-map"/);
  const chapters = [...html.matchAll(/<section[^>]+id="([^"]+)"[^>]+data-chapter/g)].map(match => match[1]);
  assert.deepEqual(chapters, ['overview', 'evidence', 'method', 'applications', 'connect']);
});

test('the prepaint theme handles denied storage and rejects arbitrary stored values', () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const value of ['dark', 'light', null, '<script>', 'auto']) {
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(script, { document, localStorage: { getItem: () => value } });
    assert.equal(document.documentElement.dataset.theme, value === 'dark' ? 'dark' : undefined);
  }
  assert.doesNotThrow(() => vm.runInNewContext(script, { get localStorage() { throw new Error('Denied'); } }));
});

const luminance = hex => {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(channel => parseInt(channel, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const tokens = css => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(match => [match[1], match[2]]));
test('both themes maintain readable text and distinguishable controls on each page surface', () => {
  const light = { ...tokens(baseCSS.match(/:root \{([\s\S]*?)\n}/)[1]), ...tokens(appearance.split(":root[data-theme='dark']")[0]) };
  const dark = { ...light, ...tokens(appearance.split(":root[data-theme='dark']")[1].split('}')[0]) };
  for (const [name, colors] of [['light', light], ['dark', dark]]) {
    for (const background of ['bg', 'surface', 'surface-2', 'chapter-bg']) {
      for (const foreground of ['ink', 'ink-2', 'ink-3', 'accent']) assert.ok(contrast(colors[foreground], colors[background]) >= 4.5, `${name}: ${foreground} on ${background}`);
      assert.ok(contrast(colors['line-strong'], colors[background]) >= 3, `${name}: control border on ${background}`);
    }
    assert.ok(contrast(colors['accent-ink'], colors.accent) >= 4.5, `${name}: primary action`);
  }
});

test('the privacy page describes the saved theme preference without changing the terms date', async () => {
  const privacy = await readFile(new URL('../dist/legal/privacy/index.html', import.meta.url), 'utf8');
  const terms = await readFile(new URL('../dist/legal/terms/index.html', import.meta.url), 'utf8');
  assert.match(privacy, /localStorage to remember your light or dark appearance choice/);
  assert.match(privacy, /<code>violema-theme<\/code>/);
  assert.match(privacy, /This preference is not sent to Violema or an AI provider/);
  assert.match(privacy, /datetime="2026-10-15"/);
  assert.match(terms, /datetime="2026-10-12"/);
  assert.doesNotMatch(privacy, /do not set cookies or use localStorage/);
});

function playbackHarness({ reduce = false, mobile = false, observerAvailable = true, controlAvailable = true } = {}) {
  const eventTarget = extra => ({ listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, ...extra });
  const parts = Array.from({ length: 3 }, () => ({ played: false, setAttribute() { this.played = true; }, removeAttribute() { this.played = false; } }));
  const control = eventTarget({ hidden: true, disabled: false });
  const root = eventTarget({ dataset: { stage: 'static' }, querySelector: () => controlAvailable ? control : null, querySelectorAll: () => parts });
  const motion = eventTarget({ matches: reduce });
  const size = eventTarget({ matches: mobile });
  const document = eventTarget({ hidden: false, querySelector: selector => selector === '[data-trace-story]' ? root : null, querySelectorAll: () => [] });
  const observers = [], timers = new Map();
  let timerId = 0;
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() { this.disconnected = true; }
  }
  vm.runInNewContext(playback, {
    document, innerHeight: 800, window: observerAvailable ? { IntersectionObserver: Observer } : {}, IntersectionObserver: Observer,
    matchMedia: query => query.includes('reduced') ? motion : size,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  return { root, control, motion, size, parts, document, observers, timers,
    enter: ratio => observers[0].callback([{ isIntersecting: true, intersectionRatio: ratio, target: root }]),
    click: () => control.listeners.click(),
    tick: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
  };
}

test('playback waits for sufficient visibility, settles once, and preserves Skip/Replay control identity', () => {
  const h = playbackHarness();
  assert.equal(h.root.dataset.stage, 'waiting');
  h.enter(.1);
  assert.equal(h.root.dataset.stage, 'waiting');
  h.enter(.35);
  assert.equal(h.root.dataset.stage, 'playing');
  assert.equal(h.control.textContent, 'Skip animation');
  h.root.listeners.keydown({ target: h.control, key: 'Enter' });
  assert.equal(h.root.dataset.stage, 'playing', 'keyboard activation on Skip must not restart playback');
  h.click();
  assert.equal(h.root.dataset.stage, 'settled');
  assert.equal(h.timers.size, 0);
  h.click();
  assert.equal(h.root.dataset.stage, 'playing');
  h.tick();
  assert.equal(h.root.dataset.stage, 'settled');
  h.click();
  h.root.listeners.keydown({ target: h.parts[0], key: 'ArrowRight' });
  assert.equal(h.root.dataset.stage, 'settled', 'navigating an interactive diagram takes priority over playback');
});

test('reduced motion, hidden tabs and a missing observer leave complete static content', () => {
  const reduced = playbackHarness({ reduce: true });
  assert.equal(reduced.root.dataset.stage, 'settled');
  assert.equal(reduced.control.disabled, true);
  assert.equal(reduced.observers.length, 1, 'only the chapter observer is created');
  const h = playbackHarness();
  h.enter(.5);
  h.motion.matches = true;
  h.motion.listeners.change();
  assert.equal(h.root.dataset.stage, 'settled');
  assert.equal(h.timers.size, 0);
  h.motion.matches = false;
  h.motion.listeners.change();
  h.click();
  h.document.hidden = true;
  h.document.listeners.visibilitychange();
  assert.equal(h.root.dataset.stage, 'settled');
  const noObserver = playbackHarness({ observerAvailable: false });
  assert.equal(noObserver.root.dataset.stage, 'static');
  assert.equal(noObserver.control.hidden, true);
});

test('phone playback follows visible parts and a click interrupts without treating touch scroll as input', () => {
  const h = playbackHarness({ mobile: true });
  h.size.listeners.change();
  assert.equal(h.root.dataset.stage, 'waiting');
  h.enter(.5);
  assert.equal(h.root.dataset.stage, 'following');
  const observer = h.observers.at(-1);
  observer.callback([{ isIntersecting: true, intersectionRatio: .1, target: h.parts[0] }]);
  assert.equal(h.parts[0].played, false);
  observer.callback([{ isIntersecting: true, intersectionRatio: .5, target: h.parts[0] }]);
  assert.equal(h.parts[0].played, true);
  assert.equal(h.parts[1].played, false);
  assert.equal(h.root.listeners.pointerdown, undefined);
  h.root.listeners.click({ target: h.parts[0] });
  assert.equal(h.root.dataset.stage, 'settled');
  assert.ok(h.parts.every(part => !part.played));
  assert.ok(observer.disconnected);
});

test('each interactive trial preserves all publication and registration fields from the source packet', async () => {
  const packet = JSON.parse(await readFile(new URL('../data/sypres-primary-trials.json', import.meta.url), 'utf8'));
  for (const trial of packet.trials) {
    const panel = html.match(new RegExp(`<div data-trial-panel="${trial.id}"[\\s\\S]*?</div>`))[0];
    assert.ok(panel.includes(escapeHTML(trial.study)));
    assert.ok(panel.includes(escapeHTML(trial.registration || 'Not recorded')));
    for (const doi of trial.dois) assert.ok(panel.includes(escapeHTML(doi)), `${trial.id}: ${doi}`);
    assert.match(panel, /rows are not independent trials/);
    assert.match(panel, /does not report a trial-specific effect/);
  }
  assert.equal((html.match(/data-trial-choice=/g) || []).length, packet.analysis.k);
});

test('a tall part can animate on a phone when enough of the viewport is visible', () => {
  const h = playbackHarness({ mobile: true });
  h.enter(.2);
  assert.equal(h.root.dataset.stage, 'following');
  const observer = h.observers.at(-1);
  observer.callback([{ isIntersecting: true, intersectionRatio: .2, intersectionRect: { height: 400 }, boundingClientRect: { height: 2000 }, target: h.parts[0] }]);
  assert.equal(h.parts[0].played, true);
});

test('closing a pointer-opened trial dialog restores its invoking link even when the browser did not focus it', () => {
  let focused = 'body';
  const eventTarget = extra => ({ listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute() {}, ...extra });
  const choices = ['davis-2021', 'goodwin-2022'].map(id => eventTarget({ dataset: { trialChoice: id }, focus() { focused = id; } }));
  const panels = choices.map(choice => ({ dataset: { trialPanel: choice.dataset.trialChoice }, hidden: true }));
  const dialog = eventTarget({ shown: false, showModal() { this.shown = true; }, querySelectorAll: () => panels });
  const document = {
    querySelector: selector => selector === '[data-trial-dialog]' ? dialog : null,
    querySelectorAll: selector => selector === '[data-trial-choice]' ? choices : [],
  };
  vm.runInNewContext(playback, { document, window: {}, matchMedia: () => ({ matches: false }) });
  for (const choice of choices) {
    focused = 'body';
    let prevented = false;
    choice.listeners.click({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(dialog.shown, true);
    assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.dataset.trialPanel), [choice.dataset.trialChoice]);
    dialog.listeners.close();
    assert.equal(focused, choice.dataset.trialChoice);
  }
});


test('presentational step entrances settle without exposing a replay control', () => {
  const h = playbackHarness({ controlAvailable: false });
  h.enter(.35);
  assert.equal(h.root.dataset.stage, 'playing');
  assert.equal(h.control.hidden, true);
  h.tick();
  assert.equal(h.root.dataset.stage, 'settled');
  assert.equal(h.timers.size, 0);
  const reduced = playbackHarness({ controlAvailable: false, reduce: true });
  assert.equal(reduced.root.dataset.stage, 'settled');
  const phone = playbackHarness({ controlAvailable: false, mobile: true });
  phone.enter(.35);
  assert.equal(phone.root.dataset.stage, 'following');
  phone.root.listeners.click({ target: phone.parts[0] });
  assert.equal(phone.root.dataset.stage, 'settled', 'manual step selection immediately ends the entrance');
});


test('mobile navigation opens accessibly and closes on Escape, departure, navigation and viewport changes', async () => {
  const source = (await readFile(new URL('../browser/site.mjs', import.meta.url), 'utf8')).replace(/^import .*;$/m, '');
  const target = extra => ({ listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, ...extra });
  let focused;
  const firstLink = { focus() { focused = this; } };
  const menu = target({ hidden: true, attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, getAttribute(name) { return this.attrs[name]; }, focus() { focused = this; } });
  const navigation = target({ querySelector: () => firstLink });
  const header = target({ dataset: {}, querySelector: selector => selector === '[data-menu-control]' ? menu : navigation, contains: element => [menu, navigation, firstLink].includes(element) });
  const document = target({ querySelector: selector => selector === '[data-site-header]' ? header : null, querySelectorAll: () => [], getElementById: () => null });
  const window = target({ scrollY: 0 });
  const media = target({ matches: true });
  vm.runInNewContext(source, { document, window, matchMedia: () => media, location: { hash: '' } });
  assert.equal(menu.hidden, false);
  assert.equal(menu.attrs['aria-expanded'], 'false');
  const open = () => {
    menu.listeners.click();
    assert.equal(menu.attrs['aria-expanded'], 'true');
    assert.equal(menu.attrs['aria-label'], 'Close navigation');
    assert.equal(focused, firstLink);
  };
  open();
  header.listeners.keydown({ key: 'Escape' });
  assert.equal(menu.attrs['aria-expanded'], 'false');
  assert.equal(focused, menu);
  open();
  // Safari does not focus a pointer-clicked button. It blurs the link first.
  header.listeners.focusout({ relatedTarget: null });
  menu.listeners.click();
  assert.equal(menu.attrs['aria-expanded'], 'false', 'Safari close tap must not reopen after the link blur');
  for (const close of [
    () => navigation.listeners.click({ target: { closest: () => firstLink } }),
    () => document.listeners.click({ target: {} }),
    () => header.listeners.focusout({ relatedTarget: {} }),
    () => media.listeners.change(),
    () => window.listeners.pageshow(),
  ]) {
    open();
    close();
    assert.equal(header.dataset.menuOpen, 'false');
    assert.equal(menu.attrs['aria-label'], 'Open navigation');
  }
  assert.match(html, /aria-controls="primary-navigation" hidden data-menu-control/);
  assert.match(html, /<nav class="primary-nav" id="primary-navigation" aria-label="Main navigation">/);
});
