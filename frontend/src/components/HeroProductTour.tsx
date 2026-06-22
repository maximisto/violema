import { useEffect, useState } from 'react';

export type HeroTourSlide = {
  /** Base asset path without extension; .avif and .jpg variants both exist. */
  asset: string;
  /** Path shown in the frame's address bar. It reads like a live walk-through. */
  path: string;
  alt: string;
};

/**
 * A slow, ambient walk-through of the live product. Each frame is a real
 * Violema view, ordered to tell the founder workflow from home to scheduling.
 */
export const heroTourSlides: HeroTourSlide[] = [
  { asset: '/brand/P1', path: 'violema.com / chat', alt: 'Violema home chat with mission context inspector and Dima approval state.' },
  { asset: '/brand/P2', path: 'violema.com / missions', alt: 'Violema mission cockpit showing weekly founder update progress, review, and cost controls.' },
  { asset: '/brand/P3', path: 'violema.com / map', alt: 'Violema workflow map showing steps, tools, integrations, and agent handoff path.' },
  { asset: '/brand/P4', path: 'violema.com / calendar', alt: 'Violema calendar for scheduling recurring founder workflows with connected stack context.' },
  { asset: '/brand/P5', path: 'violema.com / workflow builder', alt: 'Violema workflow builder for creating and saving a recurring automation.' },
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
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '1508 / 798' }}>
      {heroTourSlides.map((slide, i) => (
        <picture key={slide.asset}>
          <source srcSet={`${slide.asset}.avif`} type="image/avif" />
          <img
            src={`${slide.asset}.jpg`}
            alt={slide.alt}
            width={1508}
            height={798}
            loading={i === 0 || i === index || i === next ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            aria-hidden={i !== index}
            className="absolute inset-0 h-full w-full select-none object-contain transition-opacity ease-out motion-reduce:transition-none"
            style={{ opacity: i === index ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
          />
        </picture>
      ))}
    </div>
  );
}
