// Progressive enhancement entry point. Every page loads this module and it imports only what the
// page uses. Without JavaScript every page keeps its full content, tables, links and downloads.
import { enhanceTabs } from './tabs.mjs';
import { track } from './analytics.mjs';

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
  const menu = header.querySelector('[data-menu-control]');
  const navigation = header.querySelector('.primary-nav');
  if (menu && navigation) {
    const mobile = matchMedia('(max-width: 1023px)');
    const setOpen = open => {
      header.dataset.menuOpen = String(open);
      menu.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };
    header.dataset.navReady = '';
    menu.hidden = false;
    setOpen(false);
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      if (open) navigation.querySelector('a')?.focus({ preventScroll: true });
    });
    header.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        menu.focus({ preventScroll: true });
      }
    });
    navigation.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('click', event => { if (!header.contains(event.target)) setOpen(false); });
    header.addEventListener('focusout', event => {
      // Safari blurs the link before a pointer-clicked button, without focusing it.
      // Let that click toggle the menu once; only close on a known focus departure.
      if (event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    });
    mobile.addEventListener('change', () => setOpen(false));
    window.addEventListener('pageshow', () => setOpen(false));
  }
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

const epochLinks = [...document.querySelectorAll('[data-epoch-target]')];
if (epochLinks.length) {
  const syncEpochs = activeId => {
    for (const link of epochLinks) link.classList.toggle('is-active', link.dataset.epochTarget === activeId);
  };
  syncEpochs('founder-era-agencies');
  for (const link of epochLinks) {
    link.addEventListener('click', event => {
      const targetId = link.dataset.epochTarget;
      const group = tabGroups.find(g => g.anchors.some(a => a.hash === `#${targetId}`));
      if (!group) return;
      event.preventDefault();
      group.api.select(targetId);
      syncEpochs(targetId);
    });
  }
  const founderTabs = document.querySelector('[data-founder-explorer] [data-tablist]');
  if (founderTabs) {
    founderTabs.addEventListener('click', event => {
      const anchor = event.target.closest('a[href^="#"]');
      if (anchor) syncEpochs(anchor.hash.slice(1));
    });
  }
}

for (const trace of document.querySelectorAll('[data-trace]')) {
  const rows = [...trace.querySelectorAll('[data-trace-row]')];
  const leads = [...trace.querySelectorAll('.trace-lead')];
  const trunks = [...trace.querySelectorAll('.trace-trunk')];
  const leadNodes = [...trace.querySelectorAll('.trace-leads .trace-node')];
  const trunkNodes = [...trace.querySelectorAll('.trace-trunks .trace-node')];
  rows.forEach((row, index) => {
    const toggle = active => {
      row.classList.toggle('is-highlighted', active);
      leads[index]?.classList.toggle('is-highlighted', active);
      trunks[index]?.classList.toggle('is-highlighted', active);
      leadNodes[index]?.classList.toggle('is-highlighted', active);
      trunkNodes[index]?.classList.toggle('is-highlighted', active);
    };
    row.addEventListener('pointerenter', () => toggle(true));
    row.addEventListener('pointerleave', () => toggle(false));
    row.addEventListener('focusin', () => toggle(true));
    row.addEventListener('focusout', () => toggle(false));
  });
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
    if (!disclosure.open) return;
    import('./evidence-map.mjs');
    if (!disclosure.dataset.counted) {
      disclosure.dataset.counted = '';
      track('evidence-map-opened');
    }
  });
}

if (document.querySelector('.home-experience')) import('./experience.mjs');

if (document.querySelector('[data-diagram]')) import('./diagrams.mjs');

// A short entrance orients both six-step overviews. Selection stays with the reader;
// there is no Replay control for a purely presentational fade.
if (document.querySelector('[data-step-sequence]')) {
  import('./playback.mjs').then(({ enhancePlayback }) => {
    for (const sequence of document.querySelectorAll('[data-step-sequence]')) {
      const steps = [...sequence.querySelectorAll('[data-step]')];
      steps.forEach((step, index) => step.style.setProperty('--seq', index));
      enhancePlayback(sequence, steps, 1700);
    }
  });
}
