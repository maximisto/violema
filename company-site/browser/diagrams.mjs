import { enhancePlayback } from './playback.mjs';

// Adapted from PsychDoc's DiagramExplorer/DiagramStage: complete SVGs first,
// selectable records and interruptible playback after enhancement.
export function enhanceDiagram(root) {
  const parts = [...root.querySelectorAll('[data-diagram-part]')];
  const panels = [...root.querySelectorAll('[data-detail-panel]')];
  if (!parts.length || parts.some(part => !panels.some(panel => panel.dataset.detailPanel === part.dataset.diagramPart))) return;
  root.querySelectorAll('[data-seq]').forEach(part => part.style.setProperty('--seq', part.dataset.seq));
  let selected;

  const stepNav = document.createElement('div');
  stepNav.className = 'diagram-step-nav';
  stepNav.setAttribute('role', 'toolbar');
  stepNav.setAttribute('aria-label', 'Select diagram step');
  const stepButtons = parts.map((part, index) => {
    const panel = panels.find(item => item.dataset.detailPanel === part.dataset.diagramPart);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diagram-step-pill';
    const num = document.createElement('span');
    num.className = 'diagram-step-num';
    num.textContent = String(index + 1).padStart(2, '0');
    const txt = document.createElement('span');
    txt.textContent = (panel.dataset.detailName || `Step ${index + 1}`).replace(/^\d+\.\s*/, '');
    btn.append(num, txt);
    btn.addEventListener('click', () => open(part, { focusHeading: false }));
    stepNav.append(btn);
    return btn;
  });
  panels[0].before(stepNav);

  function syncStepButtons(activePart) {
    parts.forEach((item, idx) => {
      const isCurrent = item === activePart;
      stepButtons[idx].setAttribute('aria-pressed', String(isCurrent));
      stepButtons[idx].classList.toggle('is-active', isCurrent);
    });
  }

  function close() {
    panels.forEach(panel => { panel.hidden = true; });
    parts.forEach(part => part.setAttribute('aria-expanded', 'false'));
    syncStepButtons(null);
    selected?.focus();
    selected = null;
  }

  function open(part, { focusHeading = true, scrollIntoView = false } = {}) {
    selected = part;
    for (const panel of panels) panel.hidden = panel.dataset.detailPanel !== part.dataset.diagramPart;
    parts.forEach(item => item.setAttribute('aria-expanded', String(item === part)));
    syncStepButtons(part);
    const panel = panels.find(item => !item.hidden);
    if (focusHeading) panel.querySelector('h3').focus({ preventScroll: true });
    if (scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  root.querySelector('svg').setAttribute('role', 'group');
  for (const part of parts) {
    const panel = panels.find(item => item.dataset.detailPanel === part.dataset.diagramPart);
    part.setAttribute('role', 'button');
    part.setAttribute('tabindex', '0');
    part.setAttribute('aria-label', panel.dataset.detailName);
    part.setAttribute('aria-controls', panel.id);
    part.setAttribute('aria-expanded', 'false');
    part.addEventListener('click', () => open(part, { focusHeading: true, scrollIntoView: true }));
    part.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(part, { focusHeading: true, scrollIntoView: true });
      }
    });
  }

  panels.forEach((panel, index) => {
    const head = panel.querySelector('.diagram-detail-head');
    const closeBtn = panel.querySelector('[data-detail-close]');
    closeBtn.addEventListener('click', close);
    const controls = document.createElement('div');
    controls.className = 'diagram-detail-controls';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.textContent = '← Prev';
    prevBtn.setAttribute('aria-label', 'Previous diagram step');
    prevBtn.addEventListener('click', () => open(parts[(index - 1 + parts.length) % parts.length], { focusHeading: false }));
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = 'Next →';
    nextBtn.setAttribute('aria-label', 'Next diagram step');
    nextBtn.addEventListener('click', () => open(parts[(index + 1) % parts.length], { focusHeading: false }));
    controls.append(prevBtn, nextBtn, closeBtn);
    head.append(controls);
  });

  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected) { event.preventDefault(); close(); }
  });
  root.querySelector('[data-diagram-hint]').hidden = false;
  open(parts[0], { focusHeading: false, scrollIntoView: false });
  enhancePlayback(root, parts, 3600, 'Replay sequence');
}

for (const root of document.querySelectorAll('[data-diagram]')) enhanceDiagram(root);
