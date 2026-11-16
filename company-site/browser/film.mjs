// The film player: choose the wide or the vertical cut, keep your place when switching, and play from a line's time.
// Without this module the page shows the cut that fits the screen (films.css) and each time link jumps to the film.
const player = document.querySelector('[data-film]');
// Matches the media query in films.css, so the first cut shown is the same with or without this module.
const phone = matchMedia('(max-width: 640px) and (orientation: portrait)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Seeking before the browser knows the duration is lost, so a seek on a video that is still loading waits for its
// metadata. Only the latest waiting seek counts, and a cut switch reads it, so switching back quickly keeps the place.
const pendingSeek = new WeakMap();
function playFrom(video, time, play) {
  if (video.readyState >= 1) {
    pendingSeek.delete(video);
    video.currentTime = Math.min(time, video.duration || time);
  } else {
    if (!pendingSeek.has(video)) {
      video.addEventListener('loadedmetadata', () => {
        const at = pendingSeek.get(video);
        pendingSeek.delete(video);
        if (at !== undefined) video.currentTime = Math.min(at, video.duration || at);
      }, { once: true });
      video.preload = 'metadata';
      video.load();
    }
    pendingSeek.set(video, time);
  }
  if (play) video.play().catch(() => {});
}

// The reader's sound, speed and captions follow them to the other cut. load() resets the speed to the default one.
function carrySettings(from, to) {
  to.muted = from.muted;
  to.volume = from.volume;
  to.defaultPlaybackRate = from.playbackRate;
  to.playbackRate = from.playbackRate;
  [...to.textTracks].forEach((track, i) => { if (from.textTracks[i]) track.mode = from.textTracks[i].mode; });
}

if (player) {
  const videos = new Map([...player.querySelectorAll('.film-frame[data-cut]')].map(frame => [frame.dataset.cut, frame.querySelector('video')]));
  const buttons = [...player.querySelectorAll('[data-cut-choice]')];
  const fitting = () => (phone.matches && videos.has('vertical') ? 'vertical' : 'wide');
  let cut = fitting();
  // Until the reader picks a cut or starts the film, the cut follows the screen, as a phone turns or a window resizes.
  let settled = false;
  const show = next => {
    cut = next;
    player.dataset.cut = next;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.cutChoice === next));
  };
  show(cut);
  player.querySelector('[data-film-cuts]').hidden = false;
  phone.addEventListener('change', () => { if (!settled) show(fitting()); });

  // Both cuts share one soundtrack, so the other cut picks up at the same second.
  for (const button of buttons) button.addEventListener('click', () => {
    const next = button.dataset.cutChoice;
    settled = true;
    if (next === cut) return;
    const from = videos.get(cut);
    const to = videos.get(next);
    const time = pendingSeek.get(from) ?? from.currentTime;
    const playing = !from.paused && !from.ended;
    from.pause();
    carrySettings(from, to);
    show(next);
    // A cut that has never loaded already sits at 0, so it loads only when there is a place to carry or the film plays.
    if (playing || time !== (pendingSeek.get(to) ?? to.currentTime)) playFrom(to, time, playing);
  });

  // One cut plays at a time.
  for (const video of videos.values()) video.addEventListener('play', () => {
    settled = true;
    for (const other of videos.values()) if (other !== video) other.pause();
  });

  for (const link of document.querySelectorAll('[data-seek]')) link.addEventListener('click', event => {
    event.preventDefault();
    const video = videos.get(cut);
    player.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
    playFrom(video, Number(link.dataset.seek), true);
    video.focus({ preventScroll: true });
  });
}
