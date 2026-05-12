import { useNavigate } from 'react-router-dom';
import { Play, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useState, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';

type IconProps = {
  className?: string;
};

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

const STATS = [
  { value: 3, suffix: '', label: 'Autonomy modes', prefix: '' },
  { value: 20, suffix: '', label: 'Active automations on Pro', prefix: '' },
  { value: 100, suffix: '', label: 'Active automations on Team', prefix: '' },
  { value: 5, suffix: '', label: 'Included seats on Team', prefix: '' },
];

const HERO_INTEGRATIONS = [
  { icon: SlackLogo, label: 'Slack' },
  { icon: TeamsLogo, label: 'MS Teams' },
  { icon: WebAppIcon, label: 'Web app' },
  { icon: EmailIcon, label: 'Email' },
];

function trackHeroCta(action: 'start_free' | 'sign_in', placement: 'hero' | 'sticky_mobile') {
  const payload = {
    event: 'hero_cta_click',
    action,
    placement,
    ts: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    // Optional analytics integration: GTM-style dataLayer.
    (window as Window & { dataLayer?: unknown[] }).dataLayer?.push(payload);
  }
  console.info('[analytics]', payload);
}

function SlackLogo({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#36C5F0" d="M8.4 3.2a2.15 2.15 0 0 0-2.15 2.15v4.2a2.15 2.15 0 1 0 4.3 0v-4.2A2.15 2.15 0 0 0 8.4 3.2Z" />
      <path fill="#2EB67D" d="M20.8 8.4a2.15 2.15 0 0 0-2.15-2.15h-4.2a2.15 2.15 0 1 0 0 4.3h4.2A2.15 2.15 0 0 0 20.8 8.4Z" />
      <path fill="#ECB22E" d="M15.6 20.8a2.15 2.15 0 0 0 2.15-2.15v-4.2a2.15 2.15 0 1 0-4.3 0v4.2a2.15 2.15 0 0 0 2.15 2.15Z" />
      <path fill="#E01E5A" d="M3.2 15.6a2.15 2.15 0 0 0 2.15 2.15h4.2a2.15 2.15 0 1 0 0-4.3h-4.2A2.15 2.15 0 0 0 3.2 15.6Z" />
      <path fill="#36C5F0" d="M6.25 14.45a2.15 2.15 0 0 1 4.3 0v.35h-2.15a2.15 2.15 0 0 1-2.15-2.15v1.8Z" />
      <path fill="#2EB67D" d="M14.45 6.25a2.15 2.15 0 0 1 0 4.3h-.35V8.4a2.15 2.15 0 0 1 2.15-2.15h-1.8Z" />
      <path fill="#ECB22E" d="M17.75 9.55a2.15 2.15 0 0 1-4.3 0V9.2h2.15a2.15 2.15 0 0 1 2.15 2.15v-1.8Z" />
      <path fill="#E01E5A" d="M9.55 17.75a2.15 2.15 0 0 1 0-4.3h.35v2.15a2.15 2.15 0 0 1-2.15 2.15h1.8Z" />
    </svg>
  );
}

function TeamsLogo({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="17.2" cy="7.5" r="2.6" fill="#7B83EB" />
      <circle cx="19.2" cy="11.1" r="2" fill="#5059C9" />
      <path fill="#7B83EB" d="M13.5 11.2h5.9a1.7 1.7 0 0 1 1.7 1.7v2.2a4.7 4.7 0 0 1-4.7 4.7h-.2a4.4 4.4 0 0 1-4.4-4.4v-2.5a1.7 1.7 0 0 1 1.7-1.7Z" />
      <path fill="#5059C9" d="M15.2 12.4h5.9a1.45 1.45 0 0 1 1.45 1.45v1.35a3.55 3.55 0 0 1-3.55 3.55h-.25a3.55 3.55 0 0 1-3.55-3.55v-2.8Z" opacity=".9" />
      <rect width="10.9" height="10.9" x="2.35" y="6.1" fill="#6264A7" rx="2" />
      <path fill="#fff" d="M5.15 8.9h5.45v1.25H8.55v4.35H7.2v-4.35H5.15V8.9Z" />
    </svg>
  );
}

function WebAppIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.2 9h15.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="7" cy="7" r=".8" fill="currentColor" />
      <circle cx="9.6" cy="7" r=".8" fill="currentColor" opacity=".72" />
    </svg>
  );
}

function EmailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5.2 8.3 6.8 5.1 6.8-5.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TERMINAL_MESSAGES = [
  { role: 'user', content: '@violema pull the MRR from Stripe and compare to last month' },
  { role: 'violema', content: '📊 Pulling Stripe data...', type: 'thinking' },
  { role: 'violema', content: 'MRR this month: **$127,450** (+17.8% vs Feb)\nNew subscriptions: 47 | Churn: 3\nNet Revenue Retention: 118% 🚀', type: 'result' },
  { role: 'user', content: '@violema prepare the summary for #revenue-team approval' },
  { role: 'violema', content: '✅ Draft ready for approval. Want me to schedule this as a weekly workflow?', type: 'result' },
];

function TerminalMessage({ msg, visible }: { msg: typeof TERMINAL_MESSAGES[0]; visible: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className={`flex gap-3 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {isUser ? (
        <div className="w-6 h-6 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
          <span className="text-xs text-white font-bold">U</span>
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center shadow-glow-violet">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      )}
      <div className={`flex-1 text-sm ${isUser ? 'text-slate-300' : 'text-slate-200'}`}>
        {isUser ? (
          <span className="font-mono">{msg.content}</span>
        ) : msg.type === 'thinking' ? (
          <span className="text-violet-400 flex items-center gap-2">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {msg.content}
          </span>
        ) : (
          <span
            dangerouslySetInnerHTML={{
              __html: msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                .replace(/\n/g, '<br />'),
            }}
          />
        )}
      </div>
    </div>
  );
}

function StatItem({ stat, animate }: { stat: typeof STATS[0]; animate: boolean }) {
  const count = useCountUp(stat.value, 1800, animate);
  const displayValue = animate ? count : stat.value;
  return (
    <div className="text-center px-6 first:pl-0 last:pr-0">
      <p className="text-3xl font-extrabold text-white tabular-nums">
        {stat.prefix}{displayValue.toLocaleString()}{stat.suffix}
      </p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
    </div>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const [visibleMessages, setVisibleMessages] = useState<number[]>([0]);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [terminalSpotlight, setTerminalSpotlight] = useState({ x: 50, y: 50 });

  function handleTerminalPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setTerminalSpotlight({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  const terminalStyle = {
    animationDelay: '0.2s',
    '--mx': `${terminalSpotlight.x}%`,
    '--my': `${terminalSpotlight.y}%`,
  } as CSSProperties;

  function scrollToDemo() {
    document.getElementById('product-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    let idx = 1;
    const interval = setInterval(() => {
      if (idx < TERMINAL_MESSAGES.length) {
        const current = idx;
        setVisibleMessages((prev) => [...prev, current]);
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mobile-hero-section relative flex overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="animate-fade-in-up">
            {/* Badge */}
            <div className="interactive-glow surface-lift hidden max-w-full items-center gap-2 rounded-full border border-violet-800/50 bg-violet-950/60 px-3.5 py-1.5 mb-5 sm:mb-8 sm:inline-flex sm:px-4">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-300 text-sm font-medium">Controlled beta</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[0.96] sm:leading-[1.05] mb-3 sm:mb-6 tracking-tight">
              <span className="sm:hidden">
                The AI
                <br />
                operator
                <br />
                <span className="gradient-text">
                  for founder
                  <br />
                  work.
                </span>
              </span>
              <span className="hidden sm:inline">
                The AI operator
                <br />
                <span className="gradient-text">for founder work.</span>
              </span>
            </h1>

            {/* Sub */}
            <p className="mobile-hero-copy text-base sm:text-xl text-slate-400 mb-4 sm:mb-10 leading-[1.5] sm:leading-relaxed">
              Violema turns weekly updates, revenue checks, research briefs, and follow-up into monitored runs your team can review, approve, and schedule.
            </p>

            {/* Social proof bullets */}
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-3 mb-4 sm:mb-10">
              {[
                'Weekly founder updates',
                'Revenue and risk monitors',
                'Approval before delivery',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-[0.95rem] sm:text-sm text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <button
                onClick={() => {
                  trackHeroCta('start_free', 'hero');
                  navigate('/signup?next=%2Fplans');
                }}
                className="btn-primary group text-base py-2.5 sm:py-3 px-5 sm:px-6 shadow-glow-violet animate-glow"
              >
                <Sparkles className="w-5 h-5" />
                Set up beta access
                <ArrowRight className="magnetic-arrow w-4 h-4" />
              </button>
              <button onClick={scrollToDemo} className="btn-secondary text-base py-2.5 sm:py-3 px-5 sm:px-6 group">
                <Play className="w-4 h-4 group-hover:text-violet-400 transition-colors" />
                See workflow demo
              </button>
            </div>

            <div className="mt-3.5 hidden flex-wrap gap-2 sm:mt-5 sm:flex">
              {HERO_INTEGRATIONS.map(({ icon: Icon, label }) => (
                <div key={label} className="ui-pill px-3.5 py-1.5 text-[0.72rem] normal-case tracking-normal text-slate-300">
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Terminal mockup */}
          <div
            className="relative mt-14 hidden animate-fade-in-up lg:mt-0 lg:block"
            style={terminalStyle}
            onPointerMove={handleTerminalPointerMove}
          >
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-violet-600/10 rounded-3xl blur-2xl" />

            {/* Terminal window */}
            <div className="interactive-glow demo-scanline surface-lift relative bg-navy-800/80 backdrop-blur-sm border border-navy-700/60 rounded-2xl overflow-hidden shadow-2xl hover:border-violet-700/55">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-navy-900/60 border-b border-navy-700/60">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="signal-rail bg-navy-800 rounded-md px-4 py-1 flex items-center gap-2 overflow-hidden">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-slate-500 font-mono">sample workflow — demo data</span>
                  </div>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-5 space-y-4 min-h-[320px]">
                {TERMINAL_MESSAGES.map((msg, i) => (
                  <TerminalMessage key={i} msg={msg} visible={visibleMessages.includes(i)} />
                ))}
              </div>

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-navy-700/60 bg-navy-900/40">
                <div className="group flex items-center gap-2 bg-navy-800 rounded-lg px-3 py-2 border border-transparent transition-colors duration-200 hover:border-violet-700/45">
                  <span className="text-slate-500 text-sm">Message #general...</span>
                  <div className="ml-auto flex gap-2">
                    <ArrowRight className="magnetic-arrow w-4 h-4 text-slate-600 group-hover:text-violet-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-3 -right-3 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-glow-violet animate-float">
              Sample workflow
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div
          ref={statsRef}
          className="mt-20 pt-8 border-t border-navy-800/60"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-0 gap-y-6 divide-x divide-navy-800">
            {STATS.map((stat, i) => (
              <StatItem key={i} stat={stat} animate={statsVisible} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile sticky conversion bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-violet-800/40 bg-navy-950/95 backdrop-blur-md px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              trackHeroCta('start_free', 'sticky_mobile');
              navigate('/signup?next=%2Fplans');
            }}
            className="min-w-0 w-full btn-primary justify-center px-3 py-2.5 text-sm"
          >
            Start setup
          </button>
          <button
            onClick={() => {
              trackHeroCta('sign_in', 'sticky_mobile');
              navigate('/login');
            }}
            className="min-w-0 w-full btn-secondary justify-center px-3 py-2.5 text-sm"
          >
            Sign in
          </button>
        </div>
      </div>
    </section>
  );
}
