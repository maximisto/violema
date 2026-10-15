// Bounded playback enhances a complete static record. No scientific quantities are animated.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 767px)');

export function enhancePlayback(root, parts, duration, replayLabel) {
  const control = root.querySelector('[data-playback]');
  if (!control || !('IntersectionObserver' in window)) return;
  let observer;
  let timer;
  let seen = new Set();
  const active = () => ['playing', 'following'].includes(root.dataset.stage);
  function clear() {
    clearTimeout(timer);
    observer?.disconnect();
    parts.forEach(part => part.removeAttribute('data-played'));
  }
  function settle() {
    clear();
    root.dataset.stage = 'settled';
    control.textContent = reducedMotion.matches ? 'Motion off' : replayLabel;
    control.disabled = reducedMotion.matches;
    if (root.dataset.playbackName) control.setAttribute('aria-label', `${control.textContent}: ${root.dataset.playbackName}`);
  }
  function play() {
    clear();
    if (reducedMotion.matches || document.hidden) { settle(); return; }
    control.textContent = 'Skip animation';
    if (root.dataset.playbackName) control.setAttribute('aria-label', `Skip animation: ${root.dataset.playbackName}`);
    if (narrow.matches) {
      root.dataset.stage = 'following';
      seen = new Set();
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < .25 && (!entry.intersectionRect || entry.intersectionRect.height < .4 * Math.min(entry.boundingClientRect.height, innerHeight))) continue;
          entry.target.setAttribute('data-played', '');
          seen.add(entry.target);
          observer.unobserve(entry.target);
        }
        if (seen.size === parts.length) timer = setTimeout(settle, 1000);
      }, { threshold: [0, .05, .1, .15, .2, .25, .4, .6, .8, 1] });
      parts.forEach(part => observer.observe(part));
    } else {
      root.dataset.stage = 'playing';
      timer = setTimeout(settle, duration);
    }
  }
  function waitForEntry() {
    if (reducedMotion.matches) { settle(); return; }
    root.dataset.stage = 'waiting';
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .15)) play();
    }, { threshold: [0, .15] });
    observer.observe(root);
  }
  control.hidden = false;
  control.addEventListener('click', () => active() ? settle() : play());
  root.addEventListener('click', event => {
    if (event.target !== control && active()) settle();
  });
  root.addEventListener('keydown', event => {
    if (event.target !== control && ['Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && active()) settle();
  });
  reducedMotion.addEventListener('change', settle);
  narrow.addEventListener('change', () => { if (active()) settle(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  waitForEntry();
}
