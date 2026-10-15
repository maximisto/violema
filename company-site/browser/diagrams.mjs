import { enhancePlayback } from './playback.mjs';

// Adapted from PsychDoc's DiagramExplorer/DiagramStage: complete SVGs first,
// selectable records and interruptible playback after enhancement.
export function enhanceDiagram(root) {
  const parts = [...root.querySelectorAll('[data-diagram-part]')];
  const panels = [...root.querySelectorAll('[data-detail-panel]')];
  if (!parts.length || parts.some(part => !panels.some(panel => panel.dataset.detailPanel === part.dataset.diagramPart))) return;
  root.querySelectorAll('[data-seq]').forEach(part => part.style.setProperty('--seq', part.dataset.seq));
  let selected;
  function close() {
    panels.forEach(panel => { panel.hidden = true; });
    parts.forEach(part => part.setAttribute('aria-expanded', 'false'));
    selected?.focus();
    selected = null;
  }
  function open(part) {
    selected = part;
    for (const panel of panels) panel.hidden = panel.dataset.detailPanel !== part.dataset.diagramPart;
    parts.forEach(item => item.setAttribute('aria-expanded', String(item === part)));
    const panel = panels.find(item => !item.hidden);
    panel.querySelector('h3').focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  root.querySelector('svg').setAttribute('role', 'group');
  for (const part of parts) {
    const panel = panels.find(item => item.dataset.detailPanel === part.dataset.diagramPart);
    part.setAttribute('role', 'button');
    part.setAttribute('tabindex', '0');
    part.setAttribute('aria-label', panel.dataset.detailName);
    part.setAttribute('aria-controls', panel.id);
    part.setAttribute('aria-expanded', 'false');
    part.addEventListener('click', () => open(part));
    part.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(part); }
    });
  }
  panels.forEach(panel => panel.querySelector('[data-detail-close]').addEventListener('click', close));
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected) { event.preventDefault(); close(); }
  });
  root.querySelector('[data-diagram-hint]').hidden = false;
  enhancePlayback(root, parts, 3600, 'Replay sequence');
}

for (const root of document.querySelectorAll('[data-diagram]')) enhanceDiagram(root);
