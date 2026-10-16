import { enhancePlayback } from './playback.mjs';
import { track } from './analytics.mjs';

const trace = document.querySelector('[data-trace-story]');
if (trace) enhancePlayback(trace, [...trace.querySelectorAll('.trial-records, .assembly-convergence, .assembly-claim')], 3400, 'Replay trace');
// Navigation reports the chapter crossing the upper reading band; scrolling remains native.
const chapterLinks = [...document.querySelectorAll('.chapter-nav a')];
if ('IntersectionObserver' in window) {
  const chapters = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      chapterLinks.forEach(link => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-20% 0px -65% 0px' });
  document.querySelectorAll('[data-chapter]').forEach(chapter => chapters.observe(chapter));
}

// Native dialog handles Escape and focus trapping. Restore the invoking link explicitly:
// Safari does not focus a link on pointer activation, so its native return target can be the body.
const trialDialog = document.querySelector('[data-trial-dialog]');
if (trialDialog && typeof trialDialog.showModal === 'function') {
  let dialogTrigger;
  const choices = [...document.querySelectorAll('[data-trial-choice]')];
  const panels = [...trialDialog.querySelectorAll('[data-trial-panel]')];
  const lines = [...document.querySelectorAll('.assembly-line')];
  trialDialog.addEventListener('close', () => {
    dialogTrigger?.focus({ preventScroll: true });
    dialogTrigger = null;
  });
  for (const [index, choice] of choices.entries()) {
    choice.setAttribute('aria-haspopup', 'dialog');
    const highlight = value => lines[index]?.classList.toggle('is-highlighted', value);
    choice.addEventListener('pointerenter', () => highlight(true));
    choice.addEventListener('pointerleave', () => highlight(false));
    choice.addEventListener('focus', () => highlight(true));
    choice.addEventListener('blur', () => highlight(false));
    choice.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      dialogTrigger = choice;
      panels.forEach(panel => { panel.hidden = panel.dataset.trialPanel !== choice.dataset.trialChoice; });
      trialDialog.setAttribute('aria-labelledby', `trial-title-${choice.dataset.trialChoice}`);
      trialDialog.showModal();
      track('trial-record-opened', { trial: choice.dataset.trialChoice });
    });
  }
}

// Independent CSS translate composes cursor depth with the ambient transform keyframes.
const heroArt = document.querySelector('[data-hero-art]');
if (heroArt) {
  const scene = heroArt.closest('.hero-scene');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let inView = true;
  let frame = 0;
  let x = 0, y = 0, targetX = 0, targetY = 0;
  const allowed = () => !reduced.matches && finePointer.matches && inView && !document.hidden;
  const render = () => {
    x += (targetX - x) * .075;
    y += (targetY - y) * .075;
    heroArt.style.setProperty('--cursor-x', `${x.toFixed(3)}px`);
    heroArt.style.setProperty('--cursor-y', `${y.toFixed(3)}px`);
    frame = Math.abs(targetX - x) + Math.abs(targetY - y) > .015 ? requestAnimationFrame(render) : 0;
  };
  const settle = () => {
    targetX = 0; targetY = 0;
    heroArt.style.setProperty('--cursor-glow', '0');
    if (!frame && allowed()) frame = requestAnimationFrame(render);
  };
  const syncMotion = () => {
    heroArt.toggleAttribute('data-paused', !inView || document.hidden);
    if (!allowed()) {
      cancelAnimationFrame(frame); frame = 0;
      x = y = targetX = targetY = 0;
      heroArt.style.setProperty('--cursor-x', '0px');
      heroArt.style.setProperty('--cursor-y', '0px');
      heroArt.style.setProperty('--cursor-glow', '0');
    }
  };
  scene.addEventListener('pointermove', event => {
    if (!allowed() || event.pointerType !== 'mouse') return;
    const bounds = scene.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const ny = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    targetX = (nx - .5) * 24;
    targetY = (ny - .5) * 18;
    heroArt.style.setProperty('--light-x', `${(nx * 100).toFixed(2)}%`);
    heroArt.style.setProperty('--light-y', `${(ny * 100).toFixed(2)}%`);
    heroArt.style.setProperty('--cursor-glow', '.65');
    if (!frame) frame = requestAnimationFrame(render);
  }, { passive: true });
  scene.addEventListener('pointerleave', settle);
  window.addEventListener('blur', settle);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncMotion(); }).observe(heroArt);
  }
  document.addEventListener('visibilitychange', syncMotion);
  reduced.addEventListener('change', syncMotion);
  finePointer.addEventListener('change', syncMotion);
  syncMotion();
}

// Reveal chapter typography once as it enters. Content is never hidden without JS.
const chapterMotion = matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function') {
  const entrances = new Set();
  const chapterEntrance = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      chapterEntrance.unobserve(entry.target);
      if (chapterMotion.matches) continue;
      entry.target.querySelectorAll('.chapter-label, h2, .lede').forEach((element, index) => {
        const animation = element.animate(
          [{ opacity: .2, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 650, delay: index * 110, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' },
        );
        entrances.add(animation);
        animation.onfinish = () => entrances.delete(animation);
      });
    }
  }, { threshold: .15 });
  document.querySelectorAll('.chapter-intro, .chapter-heading, .connect-heading').forEach(element => chapterEntrance.observe(element));
  const finishEntrances = () => { if (chapterMotion.matches || document.hidden) entrances.forEach(animation => animation.finish()); };
  chapterMotion.addEventListener('change', finishEntrances);
  document.addEventListener('visibilitychange', finishEntrances);
}

// Keep the closing illustration quiet when the reader is elsewhere.
const closingEvidence = document.querySelector('.closing-evidence');
if (closingEvidence && 'IntersectionObserver' in window) {
  let visible = false;
  const sync = () => closingEvidence.toggleAttribute('data-paused', !visible || document.hidden);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(closingEvidence);
  document.addEventListener('visibilitychange', sync);
  sync();
}
