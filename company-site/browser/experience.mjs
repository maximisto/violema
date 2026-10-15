import { enhancePlayback } from './playback.mjs';

const trace = document.querySelector('[data-trace-story]');
if (trace) enhancePlayback(trace, [...trace.querySelectorAll('.trial-records, .assembly-convergence, .assembly-claim')], 3400, 'Replay trace');
const method = document.querySelector('[data-method-explorer]');
if (method) {
  const steps = [...method.querySelectorAll('.method-stations > a')];
  steps.forEach((step, index) => step.style.setProperty('--seq', index));
  enhancePlayback(method, steps, 1500, 'Replay sequence');
}

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
    });
  }
}
