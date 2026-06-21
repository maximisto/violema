import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign.js';
import Link2 from 'lucide-react/dist/esm/icons/link-2.js';
import Lock from 'lucide-react/dist/esm/icons/lock.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { heroBullets, heroCopy, proofPoints } from '../content/homepage';
import BrandMarquee from './BrandMarquee';
import Reveal from './Reveal';
import SlackPhone from './SlackPhone';
import HeroActivityFeed from './HeroActivityFeed';

type HeroCtaAction = 'set_up_access' | 'watch_workflow_run';

const proofIcons = [CalendarDays, ShieldCheck, Link2, DollarSign];

function trackHeroCta(action: HeroCtaAction, placement: 'hero' | 'mobile_sticky') {
  if (typeof window === 'undefined') return;
  (window as Window & { dataLayer?: unknown[] }).dataLayer?.push({
    event: 'hero_cta_click',
    action,
    placement,
    ts: new Date().toISOString(),
  });
}

function scrollToDemo() {
  document.getElementById('product-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function HeroActions({ placement = 'hero' }: { placement?: 'hero' | 'mobile_sticky' }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={() => {
          trackHeroCta('set_up_access', placement);
          navigate('/signup?next=%2Fplans');
        }}
        className="group relative inline-flex min-h-[3.5rem] items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-[#7c3cff] px-6 text-base font-bold tracking-[-0.01em] text-white shadow-[0_22px_60px_-18px_rgba(124,58,237,0.85)] transition duration-200 hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 sm:min-h-[3.25rem]"
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <Sparkles className="h-5 w-5" />
        {heroCopy.primaryCta}
        <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>

      <button
        type="button"
        onClick={() => {
          trackHeroCta('watch_workflow_run', placement);
          scrollToDemo();
        }}
        className="inline-flex min-h-[3.5rem] items-center justify-center gap-2.5 rounded-2xl border border-white/14 bg-white/[0.04] px-6 text-base font-semibold tracking-[-0.01em] text-[#dbe2f4] transition duration-200 hover:border-violet-200/40 hover:bg-white/[0.07] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 sm:min-h-[3.25rem]"
      >
        <Play className="h-[1.1rem] w-[1.1rem]" />
        {heroCopy.secondaryCta}
      </button>
    </div>
  );
}

function HeroCopy() {
  return (
    <div className="relative z-10 flex flex-col">
      <div className="flex w-fit items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-2.5 pr-3.5 backdrop-blur-sm">
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          <span className="live-dot absolute inset-0 rounded-full" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-signal-400 shadow-[0_0_10px_rgba(255,122,60,0.85)]" />
        </span>
        <span className="text-telemetry text-[0.62rem] text-[#aeb7cd]">{heroCopy.eyebrow}</span>
      </div>

      <h1 className="mt-6 font-display text-[3.3rem] font-semibold leading-[0.95] tracking-[-0.03em] text-white sm:text-[4.1rem] xl:text-[4.5rem]">
        <span className="block">AI agents for</span>
        <span className="block bg-gradient-to-br from-white via-[#e7e0ff] to-violet-300 bg-clip-text text-transparent">
          founder work.
        </span>
      </h1>

      {/* Mobile/tablet: the real product right after the headline — a clean
          framed screenshot (no mockup chrome) that fades into the page. */}
      <div className="relative mt-7 lg:hidden">
        <div aria-hidden className="absolute -inset-5 -z-10">
          <div className="absolute inset-x-4 top-0 h-40 rounded-[44%] bg-violet-600/22 blur-[70px]" />
          <div className="absolute -bottom-4 right-6 h-28 w-28 rounded-full bg-signal-500/12 blur-[60px]" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/12 shadow-[0_34px_80px_-30px_rgba(0,0,0,0.85)]">
          <img
            src="/brand/violema-dashboard-ui.png?v=2"
            alt="Violema dashboard running a weekly founder update with evidence and an approval gate."
            width={1600}
            height={888}
            className="block w-full"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink-900 to-transparent" />
        </div>
      </div>

      <p className="mt-7 max-w-[34rem] text-lg leading-7 text-[#aeb7cd]">{heroCopy.subhead}</p>

      <div className="mt-7 grid max-w-[34rem] grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {heroBullets.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 text-[0.95rem] font-medium text-[#c2cadb]">
            <CheckCircle2 className="h-[1.05rem] w-[1.05rem] flex-none text-violet-300" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-[34rem]">
        <HeroActions />
      </div>

      <p className="mt-5 hidden items-center gap-2 text-sm text-[#8793ad] sm:flex">
        <ShieldCheck className="h-4 w-4 flex-none text-signal-400/90" />
        {heroCopy.surfaceNote}
      </p>
    </div>
  );
}

function DeviceCluster() {
  const innerRef = useRef<HTMLDivElement>(null);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = innerRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--rx', `${px * 5}deg`);
    el.style.setProperty('--ry', `${-py * 5}deg`);
  };

  const reset = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <>
      {/* Mobile + tablet: feature the live Slack phone as a glassy, 3D-tilted
          product shot — Violema's own UI, legible, instead of a tiny dark
          screenshot. */}
      <div className="relative mx-auto w-full max-w-[19rem] py-4 lg:hidden">
        <div aria-hidden className="absolute -inset-10 -z-10">
          <div className="absolute left-1/2 top-4 h-52 w-52 -translate-x-1/2 rounded-full bg-violet-600/30 blur-[90px]" />
          <div className="absolute bottom-6 right-2 h-40 w-40 rounded-full bg-signal-500/18 blur-[80px]" />
        </div>
        <SlackPhone className="phone-3d" />
      </div>

      <div className="tilt-stage relative hidden lg:block" onMouseMove={handleMove} onMouseLeave={reset}>
        <div aria-hidden className="absolute -inset-12 -z-10">
          <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-violet-600/25 blur-[90px]" />
          <div className="absolute bottom-2 right-4 h-56 w-56 rounded-full bg-signal-500/15 blur-[90px]" />
        </div>

      <div ref={innerRef} className="tilt-inner relative mx-auto w-full max-w-[40rem]">
        <div className="signal-orbit relative overflow-hidden rounded-[1.3rem] border border-white/12 bg-ink-850/95 shadow-[0_50px_140px_-32px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="ml-2 flex flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-1.5">
              <Lock className="h-3 w-3 flex-none text-[#7c8aa3]" />
              <span className="text-telemetry truncate text-[0.56rem] text-[#8793ad]">violema.app / runs / 7241</span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-signal-500/30 bg-signal-500/10 px-2.5 py-1">
              <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                <span className="live-dot absolute inset-0 rounded-full" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-signal-400" />
              </span>
              <span className="text-telemetry text-[0.52rem] text-signal-300">Live</span>
            </span>
          </div>

          <img
            src="/brand/violema-dashboard-ui.png?v=2"
            alt="Violema web command center running a weekly founder update with workers, evidence, and an approval gate."
            width={1600}
            height={888}
            className="block w-full"
          />
        </div>

        <div className="absolute -bottom-24 -right-5 w-[19.5rem] origin-bottom-right scale-[0.46] sm:-bottom-28 sm:-right-10 sm:scale-[0.52] lg:scale-[0.58]">
          <SlackPhone />
        </div>

        <div className="absolute -left-6 bottom-[-4.5%] hidden sm:block lg:-left-10">
          <HeroActivityFeed className="animate-float" />
        </div>
      </div>
    </div>
    </>
  );
}

function ProofRail() {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
      {proofPoints.map((point, index) => {
        const Icon = proofIcons[index % proofIcons.length];
        return (
          <div key={point.title} className="flex flex-col gap-4 bg-ink-900/92 p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/14 text-violet-200">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-telemetry text-[0.55rem] text-[#6f7a91]">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div>
              <p className="text-[0.95rem] font-semibold text-white">{point.title}</p>
              <p className="mt-1 text-sm leading-5 text-[#8793ad]">{point.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogoRail() {
  return (
    <div>
      <p className="text-telemetry text-[0.6rem] text-[#6f7a91]">Built to work across the founder stack</p>
      <div className="relative left-1/2 mt-6 w-screen -translate-x-1/2">
        <BrandMarquee />
      </div>
    </div>
  );
}

function MobileStickyCta() {
  const navigate = useNavigate();

  return (
    <div className="mobile-sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-violet-300/20 bg-[#070b16]/94 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-22px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            trackHeroCta('set_up_access', 'mobile_sticky');
            navigate('/signup?next=%2Fplans');
          }}
          className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-[#7c3cff] py-4 text-base font-bold text-white shadow-[0_14px_40px_-10px_rgba(124,58,237,0.7)] transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
        >
          Set up beta access
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="rounded-2xl border border-white/14 bg-white/[0.05] px-5 py-4 text-base font-semibold text-[#e7ebf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}

function useMobileSticky() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const isSmall = window.matchMedia('(max-width: 1023px)').matches;
      // Permanent once the inline hero CTA scrolls away — stays for the journey.
      setShow(isSmall && window.scrollY > 520);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return show;
}

export default function Hero() {
  const showSticky = useMobileSticky();

  return (
    <section className="founder-hero relative overflow-hidden bg-ink-900 text-white">
      <div className="founder-hero-bg absolute inset-0 -z-20" />
      <div className="founder-hero-grid absolute inset-0 -z-10" />
      <div className="founder-hero-noise absolute inset-0 -z-10" />
      <h1 className="sr-only">{heroCopy.headline}</h1>

      <div className="mx-auto max-w-[88rem] px-4 pb-16 pt-28 sm:px-6 lg:px-8 xl:pb-24 xl:pt-36">
        <div className="grid items-center gap-x-12 gap-y-14 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
          <Reveal className="min-w-0">
            <HeroCopy />
          </Reveal>
          <Reveal delay={140} className="min-w-0">
            <DeviceCluster />
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="mt-16">
            <ProofRail />
          </div>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-12">
            <LogoRail />
          </div>
        </Reveal>
      </div>

      {showSticky ? <MobileStickyCta /> : null}
    </section>
  );
}
