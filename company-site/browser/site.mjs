// Progressive enhancement entry point. Every page loads this module and it imports only what the
// page uses. Without JavaScript every page keeps its full content, tables, links and downloads.
import { enhanceTabs } from './tabs.mjs';

const themeControl = document.querySelector('[data-theme-control]');
if (themeControl) {
  const setTheme = value => {
    const theme = value === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    themeControl.setAttribute('aria-label', label);
    themeControl.title = label;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#10131A' : '#F5F6F8';
  };
  setTheme(document.documentElement.dataset.theme);
  themeControl.hidden = false;
  themeControl.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    try { localStorage.setItem('violema-theme', theme); } catch { /* The current page still works when storage is unavailable. */ }
  });
}

const header = document.querySelector('[data-site-header]');
if (header) {
  const update = () => { header.dataset.scrolled = String(window.scrollY > 4); };
  update();
  window.addEventListener('scroll', update, { passive: true });
}

// The hero trace draws once in CSS; pin the drawn state afterwards so a later layout change
// (rotation, resize across the phone breakpoint) cannot replay it.
for (const trace of document.querySelectorAll('.trace-animate')) {
  const done = () => trace.setAttribute('data-trace-done', '');
  const expected = trace.querySelectorAll('.trace-lead').length;
  let finished = 0;
  trace.addEventListener('animationend', event => {
    const lead = event.target.classList?.contains('trace-lead') || event.target.classList?.contains('trace-trunk');
    if (event.animationName === 'trace-draw' && lead && ++finished >= expected) done();
  });
  setTimeout(done, 5000);
}

const tabGroups = [];
for (const list of document.querySelectorAll('[data-tabs] [data-tablist]')) {
  const anchors = [...list.querySelectorAll('a[href^="#"]')];
  const api = enhanceTabs(list);
  if (api) tabGroups.push({ anchors, api });
}

// Existing map fragments still work when the full explorer is folded away.
function revealFragment() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') parent.open = true;
  }
  for (const { anchors, api } of tabGroups) {
    const anchor = anchors.find(item => {
      const panel = document.getElementById(item.hash.slice(1));
      return panel === target || panel?.contains(target);
    });
    if (anchor) api.select(anchor.hash.slice(1));
  }
  requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}
revealFragment();
window.addEventListener('hashchange', revealFragment);

if (document.querySelector('[data-bias-root], [data-corpus-panel]')) import('./lab.mjs');

const map = document.querySelector('[data-evidence-map]');
if (map) {
  const disclosure = map.closest('details.full-map');
  if (!disclosure || disclosure.open) import('./evidence-map.mjs');
  else disclosure.addEventListener('toggle', () => {
    if (disclosure.open) import('./evidence-map.mjs');
  });
}

if (document.querySelector('.home-experience')) import('./experience.mjs');

if (document.querySelector('[data-diagram]')) import('./diagrams.mjs');
