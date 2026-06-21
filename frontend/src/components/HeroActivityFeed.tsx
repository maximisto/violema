import Check from 'lucide-react/dist/esm/icons/check.js';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import { useEffect, useRef, useState, type ComponentType } from 'react';

// A floating, looping "live activity" card for the hero. It cycles through real
// workspace events from different actors (Violema, a teammate, Dima) so the hero
// reads as a live, multi-person operation — and folds the "Approved & delivered"
// moment into an animated element instead of a static badge.

interface Activity {
  initials: string;
  name: string;
  avatar: string; // tailwind gradient classes
  action: string;
  meta: string;
  Icon: ComponentType<{ className?: string }>;
  iconWrap: string;
}

const ACTIVITY: Activity[] = [
  {
    initials: 'V',
    name: 'Violema',
    avatar: 'from-violet-500 to-[#7c3cff]',
    action: 'Weekly update — ready for review',
    meta: '#founder-ops · 9:05 AM',
    Icon: Sparkles,
    iconWrap: 'bg-violet-500/16 text-violet-200',
  },
  {
    initials: 'AC',
    name: 'Ava Chen',
    avatar: 'from-emerald-400 to-teal-600',
    action: 'Approved & delivered to Slack',
    meta: 'Chief of staff · 9:06 AM',
    Icon: Check,
    iconWrap: 'bg-emerald-500/16 text-emerald-300',
  },
  {
    initials: 'D',
    name: 'Dima',
    avatar: 'from-signal-400 to-[#cf4a10]',
    action: 'Guarded 1 risk before send',
    meta: 'Trust boundary · 9:04 AM',
    Icon: ShieldAlert,
    iconWrap: 'bg-signal-500/16 text-signal-300',
  },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function HeroActivityFeed({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const node = rootRef.current;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => setIndex((i) => (i + 1) % ACTIVITY.length), 2800);
    };
    if (!node || typeof IntersectionObserver === 'undefined') {
      start();
    } else {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && start()),
        { threshold: 0.5 },
      );
      observer.observe(node);
      return () => {
        observer.disconnect();
        if (interval) clearInterval(interval);
      };
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const item = ACTIVITY[index];

  return (
    <div
      ref={rootRef}
      className={`w-[15rem] rounded-xl border border-white/10 bg-ink-800/94 px-2.5 py-2 shadow-[0_26px_64px_-22px_rgba(0,0,0,0.95)] backdrop-blur-xl ${className}`}
    >
      {/* key forces a fresh mount each cycle so the entry animation replays */}
      <div key={index} className="slackphone-in flex items-center gap-2.5">
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${item.avatar} text-[0.58rem] font-black text-white`}>
          {item.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[0.68rem] font-semibold text-white">{item.name}</span>
            <span className={`flex h-3 w-3 flex-none items-center justify-center rounded-full ${item.iconWrap}`}>
              <item.Icon className="h-1.5 w-1.5" />
            </span>
            <span className="ml-auto flex items-center gap-1">
              <span className="relative flex h-1 w-1 items-center justify-center">
                <span className="live-dot absolute inset-0 rounded-full" />
                <span className="relative h-1 w-1 rounded-full bg-signal-400" />
              </span>
              <span className="text-telemetry text-[0.4rem] uppercase tracking-[0.14em] text-[#7c8aa3]">Live</span>
            </span>
          </div>
          <p className="mt-0.5 truncate text-[0.58rem] leading-snug text-[#c2cadb]">{item.action}</p>
        </div>
      </div>
    </div>
  );
}
