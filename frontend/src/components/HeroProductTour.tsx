import { useEffect, useState } from 'react';

export type HeroTourSlide = {
  src: string;
  /** Path shown in the frame's address bar — reads like a live walk-through. */
  path: string;
  alt: string;
};

/**
 * A slow, ambient walk-through of the live product. Each frame is a real
 * Violema view (chat → control center → missions → board → map → calendar →
 * analytics → inspector); the app's own active nav tab moves with it, so the
 * hero quietly shows the whole surface area without any extra chrome.
 */
export const heroTourSlides: HeroTourSlide[] = [
  { src: '/brand/tour/01-chat.webp', path: 'violema.app / chat', alt: 'Violema chat — ask the AI operator to run founder work.' },
  { src: '/brand/tour/02-control.webp', path: 'violema.app / runs / 7241', alt: 'Violema control center — a weekly founder update with live run progress and an approval gate.' },
  { src: '/brand/tour/03-missions.webp', path: 'violema.app / missions', alt: 'Violema missions — Check Stripe revenue running with step-by-step run progress.' },
  { src: '/brand/tour/04-board.webp', path: 'violema.app / board', alt: 'Violema board — mission work organized by status.' },
  { src: '/brand/tour/05-map.webp', path: 'violema.app / map', alt: 'Violema map — the workflow topology across steps, tools and integrations.' },
  { src: '/brand/tour/06-calendar.webp', path: 'violema.app / calendar', alt: 'Violema calendar — schedule recurring founder workflows.' },
  { src: '/brand/tour/07-analytics.webp', path: 'violema.app / analytics', alt: 'Violema analytics — credit use, efficiency and cost by mission step.' },
  { src: '/brand/tour/08-inspector.webp', path: 'violema.app / runs / 7241', alt: 'Violema context inspector — plan, evidence and delivery for a completed run.' },
];

export const HERO_TOUR_MS = 4600;
const FADE_MS = 1100;

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
  return (
    <div className="relative w-full overflow-hidden bg-ink-850" style={{ aspectRatio: '1600 / 894' }}>
      {heroTourSlides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          width={1600}
          height={894}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          aria-hidden={i !== index}
          className="absolute inset-0 h-full w-full select-none object-cover transition-opacity ease-out motion-reduce:transition-none"
          style={{ opacity: i === index ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        />
      ))}
    </div>
  );
}
