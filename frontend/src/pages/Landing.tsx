import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Integrations from '../components/Integrations';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, CheckCircle, BarChart3, MessageSquare, Zap, Activity,
  Brain, Shield, Eye, Check, X, Star, ArrowRight,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const ACTIVITY_FEED = [
  { team: 'Acme Corp', action: 'pulled MRR from Stripe', result: '+17.8% MoM', icon: '📊', color: 'text-green-400' },
  { team: 'Vercel', action: 'triaged 12 GitHub PRs', result: '3 merged automatically', icon: '🔀', color: 'text-violet-400' },
  { team: 'Linear', action: 'sent weekly digest', result: 'to #engineering', icon: '📨', color: 'text-cyan-400' },
  { team: 'Retool', action: 'enriched 47 HubSpot leads', result: 'from LinkedIn', icon: '✅', color: 'text-green-400' },
  { team: 'Figma', action: 'detected CAC anomaly', result: 'alert sent to @cmo', icon: '⚠️', color: 'text-yellow-400' },
  { team: 'Clerk', action: 'generated Q1 board deck', result: '18 slides, 3 charts', icon: '📋', color: 'text-violet-400' },
  { team: 'Supabase', action: 'ran database health check', result: 'all systems nominal', icon: '⚡', color: 'text-cyan-400' },
  { team: 'Planetscale', action: 'created sprint report', result: '42 tasks completed', icon: '🎯', color: 'text-green-400' },
];

function LiveActivity() {
  const [feed, setFeed] = useState(ACTIVITY_FEED.slice(0, 4));
  const [fadeIn, setFadeIn] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = ACTIVITY_FEED[Math.floor(Math.random() * ACTIVITY_FEED.length)];
      setFeed((prev) => {
        const updated = [{ ...next, _key: Date.now() }, ...prev.slice(0, 3)];
        return updated;
      });
      setFadeIn(Date.now());
      setTimeout(() => setFadeIn(null), 600);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/30 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Live feed */}
          <div className="relative">
            <div className="absolute -inset-4 bg-cyan-500/5 rounded-3xl blur-2xl" />
            <div className="relative bg-navy-800/60 border border-navy-700/60 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-navy-700/60 bg-navy-900/40">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Live activity feed</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-slate-500">Real-time</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {feed.map((item, i) => (
                  <div
                    key={(item as typeof item & { _key?: number })._key ?? i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-900/60 border border-navy-700/40 transition-all duration-500 ${
                      i === 0 && fadeIn ? 'opacity-100 scale-100' : 'opacity-100'
                    }`}
                    style={i === 0 && fadeIn ? { animation: 'fadeSlideIn 0.5s ease-out' } : {}}
                  >
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-300">{item.team}</span>
                        <span className="text-xs text-slate-500">{item.action}</span>
                      </div>
                      <span className={`text-xs font-medium ${item.color}`}>{item.result}</span>
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">just now</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
              <span className="text-cyan-400 text-sm font-medium">Always on</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
              Violema works{' '}
              <span className="gradient-text">while you sleep</span>
            </h2>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Violema doesn’t just answer. It gets the work done — pulling reports, triaging issues, sending updates, and closing the loop on follow-through your team would otherwise miss.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '24/7', label: 'Always available' },
                { value: '< 1s', label: 'Task start time' },
                { value: '10x', label: 'Team throughput' },
                { value: '0', label: 'Manual reminders' },
              ].map((stat) => (
                <div key={stat.label} className="bg-navy-800/60 border border-navy-700/60 rounded-xl px-4 py-3">
                  <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

// Demo section with product mockup
function ProductDemo() {
  const navigate = useNavigate();

  const DEMO_MESSAGES = [
    {
      role: 'user',
      text: '@violema pull the MRR from Stripe and compare to last month',
    },
    {
      role: 'violema',
      text: null,
      tool: { name: 'query_data', label: 'Querying Stripe', icon: '📊' },
    },
    {
      role: 'violema',
      text: '**MRR Report — March 2026**\n\n📈 **$127,450** this month (+17.8% vs February)\n\n| Metric | This Month | Last Month |\n|--------|-----------|------------|\n| MRR | $127,450 | $108,230 |\n| New Subs | 47 | 39 |\n| Churn | 3 | 5 |\n| NRR | 118% | 112% |\n\nStrong growth. Churn improved significantly. Want me to send this to #revenue-team?',
    },
    {
      role: 'user',
      text: 'Yes, send to #revenue-team and create a task to review by EOW',
    },
    {
      role: 'violema',
      text: null,
      tools: [
        { name: 'send_message', label: 'Sending to #revenue-team', icon: '📨' },
        { name: 'create_task', label: 'Creating task', icon: '✅' },
      ],
    },
    {
      role: 'violema',
      text: '✅ Done! I\'ve sent the MRR summary to **#revenue-team** and created task **TASK-4821** "Review Q1 MRR Metrics" assigned to you, due Friday.',
    },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
              <span className="text-violet-400 text-sm font-medium">See it in action</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
              Real work,{' '}
              <span className="gradient-text">done in seconds</span>
            </h2>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Watch Violema pull Stripe data, analyze it, message your team, and create follow-up tasks — all from one prompt.
            </p>

            <div className="space-y-4 mb-10">
              {[
                { icon: BarChart3, text: 'Executes across your connected tools' },
                { icon: MessageSquare, text: 'Communicates results back to the right humans' },
                { icon: CheckCircle, text: 'Automates research and follow-through' },
                { icon: TrendingUp, text: 'Allocates depth dynamically — fast tasks stay fast, complex work gets focus' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-violet-400" />
                  </div>
                  <span className="text-slate-300 text-sm">{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/signup?next=%2Fplans')}
              className="btn-primary text-base py-3 px-8"
            >
              <Zap className="w-5 h-5" />
              Set up access
            </button>
          </div>

          {/* Right: Chat mockup */}
          <div className="relative">
            <div className="absolute -inset-4 bg-violet-600/10 rounded-3xl blur-2xl" />
            <div className="relative bg-navy-800/80 backdrop-blur-sm border border-navy-700/60 rounded-2xl overflow-hidden shadow-2xl">
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-navy-900/60 border-b border-navy-700/60">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <span className="text-xs text-slate-500 font-mono">#general</span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                {DEMO_MESSAGES.map((msg, i) => (
                  <div key={i}>
                    {msg.role === 'user' ? (
                      <div className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">A</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 mb-0.5 block">Alex</span>
                          <p className="text-sm text-slate-300 font-mono">{msg.text}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">V</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-xs text-violet-400 mb-0.5 block font-semibold">Violema</span>
                          {msg.tool && (
                            <div className="bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 flex items-center gap-2 mb-2">
                              <span>{msg.tool.icon}</span>
                              <span className="text-xs text-slate-400">{msg.tool.label}...</span>
                              <span className="ml-auto flex gap-1">
                                {[0, 150, 300].map((d) => (
                                  <span key={d} className="w-1 h-1 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                ))}
                              </span>
                            </div>
                          )}
                          {(msg as { tools?: { name: string; label: string; icon: string }[] }).tools?.map((tool, j) => (
                            <div key={j} className="bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 flex items-center gap-2 mb-2">
                              <span className="text-xs text-green-400">✓</span>
                              <span>{tool.icon}</span>
                              <span className="text-xs text-slate-400">{tool.label}</span>
                            </div>
                          ))}
                          {msg.text && (
                            <p
                              className="text-sm text-slate-300"
                              dangerouslySetInnerHTML={{
                                __html: msg.text
                                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                                  .replace(/\n\n/g, '<br /><br />')
                                  .replace(/\n/g, '<br />')
                                  .replace(/\|(.+)\|/g, (match) => {
                                    if (match.includes('---')) return '';
                                    const cells = match.split('|').filter(Boolean).map((c) => c.trim());
                                    return `<span class="flex gap-4 text-xs font-mono text-slate-400 my-0.5">${cells.map((c) => `<span>${c}</span>`).join('')}</span>`;
                                  }),
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Autonomy Modes Section ──────────────────────────────────────────────────

const AUTONOMY_MODES = [
  {
    key: 'autonomous',
    icon: Zap,
    color: 'text-green-400',
    border: 'border-green-800/40 hover:border-green-600/60',
    bg: 'bg-green-950/20',
    glow: 'shadow-green-900/20',
    label: 'Autonomous',
    tagline: 'Full autopilot',
    description: 'Violema acts immediately with no confirmation needed. Perfect for routine tasks, reports, and anything you trust it to run on its own.',
    example: 'Every Monday at 9am, Violema pulls Stripe MRR, generates the executive summary, and posts it to #revenue-team — while you sleep.',
    chips: ['No interruptions', 'Fastest execution', 'Best for routine work'],
  },
  {
    key: 'cautious',
    icon: Shield,
    color: 'text-yellow-400',
    border: 'border-yellow-800/40 hover:border-yellow-600/60',
    bg: 'bg-yellow-950/20',
    glow: 'shadow-yellow-900/20',
    label: 'Cautious',
    tagline: 'Explain then act',
    description: 'Before taking significant actions, Violema tells you what it\'s about to do and why. You stay informed without being slowed down.',
    example: '"I\'m going to pause 3 campaigns (ROAS < 1.5x) and reallocate $4,200 to the top performer. Proceeding now."',
    chips: ['Transparent intent', 'Informed decisions', 'Best for high-stakes work'],
  },
  {
    key: 'supervised',
    icon: Eye,
    color: 'text-cyan-400',
    border: 'border-cyan-800/40 hover:border-cyan-600/60',
    bg: 'bg-cyan-950/20',
    glow: 'shadow-cyan-900/20',
    label: 'Supervised',
    tagline: 'Full reasoning visible',
    description: 'See every step of Violema\'s thinking — the reasoning, the alternatives considered, and why it chose the path it took. Maximum transparency.',
    example: 'Step 1: Querying Stripe… Step 2: Cross-referencing PostHog funnel data… Step 3: Identified checkout drop at payment step (mobile only)…',
    chips: ['Full thought process', 'Audit everything', 'Best for learning/debugging'],
  },
];

function AutonomyModes() {
  const [active, setActive] = useState(1); // Start on Cautious
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const mode = AUTONOMY_MODES[active];
  const ModeIcon = mode.icon;

  return (
    <section className="py-24 relative overflow-hidden" id="autonomy">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/40 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
            <Brain className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-violet-400 text-sm font-medium">Autonomy modes</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            You decide{' '}
            <span className="gradient-text">how much control</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Unlike black-box AI tools, Violema adapts to your trust level. Start supervised, go autonomous when you're ready.
          </p>
        </div>

        <div
          ref={ref}
          className={`grid lg:grid-cols-2 gap-12 items-center transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Mode selector */}
          <div className="space-y-4">
            {AUTONOMY_MODES.map((m, i) => {
              const Icon = m.icon;
              const isActive = active === i;
              return (
                <button
                  key={m.key}
                  onClick={() => setActive(i)}
                  className={`w-full text-left rounded-2xl border p-5 transition-all duration-300 ${m.border} ${
                    isActive ? `${m.bg} shadow-lg ${m.glow}` : 'bg-navy-800/30 border-navy-700/40 hover:bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? m.bg : 'bg-navy-800'} border ${isActive ? m.border : 'border-navy-700'}`}>
                      <Icon className={`w-4 h-4 ${isActive ? m.color : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-slate-400'}`}>{m.label}</p>
                      <p className={`text-xs ${isActive ? m.color : 'text-slate-600'}`}>{m.tagline}</p>
                    </div>
                    {isActive && (
                      <div className={`ml-auto w-2 h-2 rounded-full ${m.color.replace('text-', 'bg-')} animate-pulse`} />
                    )}
                  </div>
                  {isActive && (
                    <p className="text-sm text-slate-400 leading-relaxed mt-1 pl-12">{m.description}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview window */}
          <div className="relative">
            <div className={`absolute -inset-4 rounded-3xl blur-2xl opacity-20 transition-all duration-500 ${mode.color.replace('text-', 'bg-')}`} />
            <div className="relative bg-navy-800/80 border border-navy-700/60 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 bg-navy-900/60 border-b border-navy-700/60">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <div className={`ml-3 flex items-center gap-1.5 text-xs border rounded-full px-3 py-0.5 ${mode.bg} ${mode.border} ${mode.color}`}>
                  <ModeIcon className="w-3 h-3" />
                  {mode.label} mode
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-slate-500">Violema active</span>
                </div>
              </div>
              <div className="p-5 min-h-[200px] flex items-center">
                <div className={`w-full rounded-xl border p-4 ${mode.bg} ${mode.border}`}>
                  <div className="flex items-start gap-2.5">
                    <Brain className={`w-4 h-4 ${mode.color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className={`text-xs font-semibold mb-2 ${mode.color}`}>{mode.label} mode active</p>
                      <p className="text-sm text-slate-300 leading-relaxed font-mono">{mode.example}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 px-5 pb-5">
                {mode.chips.map((chip) => (
                  <span
                    key={chip}
                    className={`text-[11px] border rounded-full px-3 py-1 ${mode.bg} ${mode.border} ${mode.color}`}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "Violema replaced 3 hours of Monday morning reporting. It pulls our Stripe, HubSpot, and Linear data, writes the digest, and posts it to Slack before anyone's even logged on.",
    name: 'Sarah Chen',
    role: 'Head of Operations',
    company: 'Loops',
    avatar: 'SC',
    stars: 5,
  },
  {
    quote: "The supervised mode was a revelation. I could see exactly why Violema made each decision — it completely changed how I think about delegating work to AI.",
    name: 'Marcus Webb',
    role: 'CTO',
    company: 'Framer',
    avatar: 'MW',
    stars: 5,
  },
  {
    quote: "We set up 12 automations in our first week. Violema now handles all our recurring ops work. My team focuses only on problems that actually need human judgment.",
    name: 'Priya Nair',
    role: 'VP Engineering',
    company: 'Loom',
    avatar: 'PN',
    stars: 5,
  },
  {
    quote: "The confidence scores on tool calls were a game-changer. I knew exactly when to trust Violema's output and when to verify. That level of transparency is rare.",
    name: 'James Liu',
    role: 'Founder',
    company: 'Fathom',
    avatar: 'JL',
    stars: 5,
  },
  {
    quote: "What shocked me: Violema noticed we had 18 failed payments at risk and proactively drafted a recovery email campaign. We hadn't asked for it. That's a real coworker.",
    name: 'Elena Vasquez',
    role: 'Head of Revenue',
    company: 'Linear',
    avatar: 'EV',
    stars: 5,
  },
  {
    quote: "We tried ChatGPT, Claude, and Copilot. None of them actually *do* anything. Violema executes — it takes actions, moves data, sends messages. It's in a different category.",
    name: 'Tom Okello',
    role: 'COO',
    company: 'Resend',
    avatar: 'TO',
    stars: 5,
  },
];

function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
            <span className="text-violet-400 text-sm font-medium">What teams say</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Teams that shipped faster
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Teams use Violema to cut repetitive work, centralize execution, and keep humans in the loop.
          </p>
        </div>

        <div
          ref={ref}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className={`bg-navy-800/50 border border-navy-700/60 rounded-2xl p-6 hover:border-navy-600 transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600/40 to-violet-800/40 border border-violet-700/40 flex items-center justify-center">
                  <span className="text-xs font-bold text-violet-300">{t.avatar}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

const COMPARISON_ROWS = [
  { feature: 'Actually executes tasks', violema: true, chatgpt: false, viktor: true, devin: true, note: '' },
  { feature: 'Reasoning transparency', violema: true, chatgpt: false, viktor: false, devin: false, note: 'See every thought step' },
  { feature: 'Autonomy modes (3 levels)', violema: true, chatgpt: false, viktor: false, devin: false, note: 'Auto / Cautious / Supervised' },
  { feature: 'Confidence scoring on actions', violema: true, chatgpt: false, viktor: false, devin: false, note: '' },
  { feature: 'Proactive anomaly detection', violema: true, chatgpt: false, viktor: true, devin: false, note: '' },
  { feature: 'Scheduled automations', violema: true, chatgpt: false, viktor: true, devin: false, note: '' },
  { feature: 'Extensible integration layer', violema: true, chatgpt: false, viktor: true, devin: false, note: 'Core tools first, then custom expansion' },
  { feature: 'Slack / Teams native', violema: true, chatgpt: false, viktor: true, devin: false, note: '' },
  { feature: 'Long-term memory', violema: true, chatgpt: 'partial', viktor: true, devin: 'partial', note: '' },
  { feature: 'Built for paid production use', violema: true, chatgpt: 'partial', viktor: false, devin: false, note: 'Plans + one-time top-ups' },
];

function CompCell({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check className="w-4 h-4 text-green-400 mx-auto" />;
  if (value === false)
    return <X className="w-4 h-4 text-slate-700 mx-auto" />;
  return <span className="text-yellow-500 text-xs mx-auto block text-center">Partial</span>;
}

function ComparisonTable() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 relative overflow-hidden" id="compare">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
            <span className="text-violet-400 text-sm font-medium">How we compare</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Not all AI is equal
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Chat interfaces suggest. Violema executes — with full transparency into why.
          </p>
        </div>

        <div
          ref={ref}
          className={`overflow-x-auto rounded-2xl border border-navy-700/60 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-700/60">
                <th className="text-left px-6 py-4 text-sm text-slate-400 font-medium w-[40%]">Feature</th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white">Violema</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg bg-navy-700 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-300">G</span>
                    </div>
                    <span className="text-xs text-slate-500">ChatGPT</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg bg-navy-700 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-300">V</span>
                    </div>
                    <span className="text-xs text-slate-500">Viktor</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg bg-navy-700 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-300">D</span>
                    </div>
                    <span className="text-xs text-slate-500">Devin</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-navy-800/60 transition-all duration-500 last:border-0 ${inView ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: `${i * 50 + 200}ms` }}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-300">{row.feature}</span>
                      {row.note && (
                        <span className="text-[10px] text-violet-400 bg-violet-950/50 border border-violet-900/50 rounded-full px-2 py-0.5">
                          {row.note}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 bg-violet-950/10">
                    <CompCell value={row.violema} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CompCell value={row.chatgpt} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CompCell value={row.viktor} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CompCell value={row.devin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-navy-950/40 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-violet-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-800/50 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-violet-300 text-sm font-medium">Access, billing, and onboarding</span>
        </div>
        <h2 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-[1.05]">
          Put Violema to work
          <br />
          <span className="gradient-text">with a plan that fits.</span>
        </h2>
        <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
          No prompting tricks. No babysitting. Violema executes, reports back, and gets better every day. Pick a plan, connect your stack, and put it to work.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mb-10">
          <button
            onClick={() => navigate('/signup?next=%2Fplans')}
            className="btn-primary text-lg py-4 px-8 shadow-glow-violet"
          >
            <Zap className="w-5 h-5" />
            Start setup
          </button>
          <button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-secondary text-lg py-4 px-8 group"
          >
            See how it works
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
          {['Slack + web app', 'Plans and top-ups', 'Human review controls', 'Cancel anytime'].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar />
      <Hero />
      <Integrations />
      <Features />
      <AutonomyModes />
      <LiveActivity />
      <ProductDemo />
      <Testimonials />
      <ComparisonTable />
      <Pricing />
      <FinalCTA />
      <Footer />
      <div className="mobile-home-cta sm:hidden" aria-label="Violema mobile quick actions">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/signup?next=%2Fplans')}
            className="btn-primary min-w-0 justify-center px-3 py-2.5 text-sm"
          >
            Start setup
          </button>
          <button
            onClick={() => navigate('/login')}
            className="btn-secondary min-w-0 justify-center px-3 py-2.5 text-sm"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
