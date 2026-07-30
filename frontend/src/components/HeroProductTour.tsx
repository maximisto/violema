import { useEffect, useState } from 'react';

export type HeroTourSlide = {
  src: string;
  /** Path shown in the frame's address bar. It reads like a live walk-through. */
  path: string;
  alt: string;
};

export const HERO_IMAGE_VERSION = '20260729';
export const heroImageSrc = (name: `P${1 | 2 | 3 | 4 | 5}`) => `/brand/${name}.jpg?v=${HERO_IMAGE_VERSION}`;

/**
 * A slow, ambient walk-through of the live product (light theme), following one
 * real Competitor monitor run from chat to analytics.
 */
export const heroTourSlides: HeroTourSlide[] = [
  { src: heroImageSrc('P1'), path: 'violema.com / chat', alt: 'Violema home chat with the context inspector showing a completed competitor monitor mission.' },
  { src: heroImageSrc('P2'), path: 'violema.com / missions', alt: 'Violema mission cockpit showing competitor monitor run progress, cost, and cadence controls.' },
  { src: heroImageSrc('P3'), path: 'violema.com / reviews', alt: 'Violema review gate with the drafted competitor memo, source evidence, and delivery receipt.' },
  { src: heroImageSrc('P4'), path: 'violema.com / calendar', alt: 'Violema calendar scheduling recurring founder workflows across the connected stack.' },
  { src: heroImageSrc('P5'), path: 'violema.com / analytics', alt: 'Violema analytics with the credit waterfall, per-step run cost, and runway forecast.' },
];

export const HERO_TOUR_MS = 7200;
const FADE_MS = 1400;

/**
 * Drives the tour index. Auto-advances only on desktop, with motion enabled,
 * and while the tab is visible — and re-evaluates when any of those change.
 */
export function useHeroTour() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px)');

    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const start = () => {
      stop();
      if (reduce.matches || !desktop.matches || document.hidden) return;
      timer = window.setInterval(() => {
        setIndex((i) => (i + 1) % heroTourSlides.length);
      }, HERO_TOUR_MS);
    };

    start();
    document.addEventListener('visibilitychange', start);
    reduce.addEventListener('change', start);
    desktop.addEventListener('change', start);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', start);
      reduce.removeEventListener('change', start);
      desktop.removeEventListener('change', start);
    };
  }, []);

  return { index, slides: heroTourSlides, active: heroTourSlides[index] };
}

/** The stacked, cross-fading product screenshots. */
export function HeroTourImages({ index }: { index: number }) {
  // Eager-load the current and upcoming frame so the cross-fade never flashes
  // an undecoded image; the rest stay lazy until promoted one step ahead.
  const next = (index + 1) % heroTourSlides.length;
  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '1800 / 1010' }}>
      {heroTourSlides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          width={1800}
          height={1010}
          loading={i === 0 || i === index || i === next ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          aria-hidden={i !== index}
          className="absolute inset-0 h-full w-full select-none object-contain transition-opacity ease-out motion-reduce:transition-none"
          style={{ opacity: i === index ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        />
      ))}
    </div>
  );
}
