// Progressive enhancement entry point. Every page loads this module and it imports only what the
// page uses. Without JavaScript every page keeps its full content, tables, links and downloads.
import { enhanceTabs } from './tabs.mjs';

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

for (const list of document.querySelectorAll('[data-tabs] [data-tablist]')) enhanceTabs(list);

if (document.querySelector('[data-bias-root], [data-corpus-panel]')) import('./lab.mjs');

if (document.querySelector('[data-evidence-map]')) import('./evidence-map.mjs');
