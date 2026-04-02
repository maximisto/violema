import { useNavigate } from 'react-router-dom';
import { Play, ArrowRight, Sparkles, CheckCircle2, Globe, Slack } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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

const TERMINAL_MESSAGES = [
  { role: 'user', content: '@violema pull the MRR from Stripe and compare to last month' },
  { role: 'violema', content: '📊 Pulling Stripe data...', type: 'thinking' },
  { role: 'violema', content: 'MRR this month: **$127,450** (+17.8% vs Feb)\nNew subscriptions: 47 | Churn: 3\nNet Revenue Retention: 118% 🚀', type: 'result' },
  { role: 'user', content: '@violema send the summary to #revenue-team on Slack' },
  { role: 'violema', content: '✅ Sent to #revenue-team. Want me to create a weekly automated report?', type: 'result' },
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
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center">
          <span className="violema-glyph text-xs text-white">V</span>
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
  return (
    <div className="text-center px-6 first:pl-0 last:pr-0">
      <p className="text-3xl font-extrabold text-white tabular-nums">
        {stat.prefix}{count.toLocaleString()}{stat.suffix}
      </p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
    </div>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < TERMINAL_MESSAGES.length) {
        setVisibleMessages((prev) => [...prev, idx]);
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
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div className="animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-800/50 rounded-full px-4 py-1.5 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-300 text-sm font-medium">Now in beta</span>
              <span className="w-px h-3 bg-violet-700" />
              <span className="text-slate-400 text-sm">Access and billing now live</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] mb-6 tracking-tight">
              Your AI coworker
              <br />
              <span className="gradient-text">for real work.</span>
            </h1>

            {/* Sub */}
            <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl leading-relaxed">
              Violema coordinates specialized agents to carry work through from start to finish.
            </p>

            {/* Social proof bullets */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              {[
                'Works across your tools',
                'Automates recurring work',
                'Keeps you in control',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/signup?next=%2Fplans')}
                className="btn-primary text-base py-3 px-6 shadow-glow-violet animate-glow"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                Get access
              </button>
              <button className="btn-secondary text-base py-3 px-6 group">
                <Play className="w-4 h-4 group-hover:text-violet-400 transition-colors" />
                Watch demo
              </button>
            </div>

            {/* Trust */}
            <p className="mt-6 text-sm text-slate-500">
              One manager • Six specialists • Extra capacity when needed
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: Slack, label: 'Slack' },
                { icon: Globe, label: 'Web app' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="ui-pill px-3 py-1.5 text-slate-300">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Terminal mockup */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-violet-600/10 rounded-3xl blur-2xl" />

            {/* Terminal window */}
            <div className="relative bg-navy-800/80 backdrop-blur-sm border border-navy-700/60 rounded-2xl overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-navy-900/60 border-b border-navy-700/60">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-navy-800 rounded-md px-4 py-1 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-slate-500 font-mono">#general — Violema AI</span>
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
                <div className="flex items-center gap-2 bg-navy-800 rounded-lg px-3 py-2">
                  <span className="text-slate-500 text-sm">Message #general...</span>
                  <div className="ml-auto flex gap-2">
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-3 -right-3 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-glow-violet animate-float">
              Violema is working...
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
    </section>
  );
}
