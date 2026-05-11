import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Integrations from '../components/Integrations';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import Footer from '../components/Footer';
import ViolemaLogo from '../components/ViolemaLogo';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, CheckCircle, BarChart3, MessageSquare, Zap, Activity,
  Brain, Shield, Eye, Check, X, ArrowRight, Sparkles,
} from 'lucide-react';
import { useState, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';

const ACTIVITY_FEED = [
  { team: 'Revenue ops', action: 'drafted the weekly MRR brief', result: 'ready for review', icon: '📊', color: 'text-green-400' },
  { team: 'Founder office', action: 'assembled investor update notes', result: 'open risks flagged', icon: '📋', color: 'text-violet-400' },
  { team: 'Product', action: 'summarized support themes', result: '3 follow-ups queued', icon: '📨', color: 'text-cyan-400' },
  { team: 'Sales', action: 'prepared CRM follow-up draft', result: 'approval required', icon: '✅', color: 'text-green-400' },
  { team: 'Finance', action: 'checked subscription anomalies', result: 'needs human review', icon: '⚠️', color: 'text-yellow-400' },
  { team: 'Engineering', action: 'compiled release notes', result: 'delivery log attached', icon: '🔀', color: 'text-violet-400' },
  { team: 'Operations', action: 'ran vendor renewal check', result: 'next step suggested', icon: '⚡', color: 'text-cyan-400' },
  { team: 'Customer success', action: 'built account health digest', result: 'priority list ready', icon: '🎯', color: 'text-green-400' },
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
    <section className="py-24 relative overflow-hidden" id="product-demo">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/30 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Live feed */}
          <div className="relative">
            <div className="absolute -inset-4 bg-cyan-500/5 rounded-3xl blur-2xl" />
            <div className="interactive-glow demo-scanline surface-lift relative bg-navy-800/60 border border-navy-700/60 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-navy-700/60 bg-navy-900/40">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Demo workflow feed</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-slate-500">Sample run</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {feed.map((item, i) => (
                  <div
                    key={(item as typeof item & { _key?: number })._key ?? i}
                    className={`surface-lift flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-900/60 border border-navy-700/40 transition-all duration-500 ${
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
              <span className="text-cyan-400 text-sm font-medium">Operating loop</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
              Recurring work,{' '}
              <span className="gradient-text">without recurring reminders</span>
            </h2>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Start with a workflow you already repeat. Violema turns it into a run with clear inputs, review state, delivery target, and a history you can inspect later.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '6', label: 'Beta workflow candidates' },
                { value: 'Gate', label: 'Approval before send' },
                { value: 'Log', label: 'Run history included' },
                { value: 'Cost', label: 'Credits visible per run' },
              ].map((stat) => (
                <div key={stat.label} className="interactive-glow surface-lift bg-navy-800/60 border border-navy-700/60 rounded-xl px-4 py-3">
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
  const demoRef = useRef<HTMLDivElement>(null);
  const [demoInView, setDemoInView] = useState(false);
  const [visibleDemoMessages, setVisibleDemoMessages] = useState(0);
  const [demoSpotlight, setDemoSpotlight] = useState({ x: 50, y: 50 });

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
  const demoMessageCount = DEMO_MESSAGES.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDemoInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.28 }
    );
    if (demoRef.current) observer.observe(demoRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!demoInView) return;
    setVisibleDemoMessages(0);

    const interval = window.setInterval(() => {
      setVisibleDemoMessages((count) => {
        if (count >= demoMessageCount) {
          window.clearInterval(interval);
          return count;
        }
        return count + 1;
      });
    }, 420);

    return () => window.clearInterval(interval);
  }, [demoInView, demoMessageCount]);

  function handleDemoPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setDemoSpotlight({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  }

  const demoShellStyle = {
    '--mx': `${demoSpotlight.x}%`,
    '--my': `${demoSpotlight.y}%`,
  } as CSSProperties;

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-navy-800 border border-navy-700 rounded-full px-4 py-1.5 mb-6">
              <span className="text-violet-400 text-sm font-medium">Demo workflow</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
              One workflow,{' '}
              <span className="gradient-text">shown end to end</span>
            </h2>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              A simple revenue run shows the product loop: connect data, draft the summary, ask for approval, deliver the update, and preserve the run history.
            </p>

            <div className="space-y-4 mb-10">
              {[
                { icon: BarChart3, text: 'Reads from the connected system of record' },
                { icon: MessageSquare, text: 'Drafts the update for the right channel' },
                { icon: CheckCircle, text: 'Requires approval before delivery' },
                { icon: TrendingUp, text: 'Records output, status, and credit cost' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="group flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
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
              Set up beta access
            </button>
          </div>

          {/* Right: Chat mockup */}
          <div
            ref={demoRef}
            className="relative"
            style={demoShellStyle}
            onPointerMove={handleDemoPointerMove}
          >
            <div className="absolute -inset-4 bg-violet-600/10 rounded-3xl blur-2xl" />
            <div className="interactive-glow demo-scanline surface-lift relative bg-navy-800/80 backdrop-blur-sm border border-navy-700/60 rounded-2xl overflow-hidden shadow-2xl hover:border-violet-700/55">
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-navy-900/60 border-b border-navy-700/60">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <span className="signal-rail overflow-hidden rounded-full bg-navy-800/70 px-3 py-1 text-xs text-slate-500 font-mono">#general</span>
                </div>
              </div>

              {/* Messages */}
              <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                {DEMO_MESSAGES.map((msg, i) => {
                  const isVisible = i < visibleDemoMessages;
                  return (
                    <div
                      key={i}
                      className={`staged-message ${isVisible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-4 opacity-0 blur-[1px]'}`}
                    >
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
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex-shrink-0 flex items-center justify-center shadow-glow-violet">
                            <Sparkles className="w-3 h-3 text-white" />
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
                  );
                })}
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
    tagline: 'Approved autopilot',
    description: 'For low-risk recurring workflows you have already approved. Violema can run the loop and leave a clear record behind.',
    example: 'Every Monday at 9am, Violema pulls Stripe MRR, drafts the executive summary, and prepares it for delivery to the revenue team.',
    chips: ['Pre-approved work', 'Scheduled runs', 'Best for routine loops'],
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
    description: 'Before taking meaningful actions, Violema explains the proposed next step and waits for your confirmation.',
    example: '"Revenue churn moved outside the normal range. I drafted a short customer-risk brief and need approval before sending it."',
    chips: ['Approval gates', 'Clear next step', 'Best for sensitive work'],
  },
  {
    key: 'supervised',
    icon: Eye,
    color: 'text-cyan-400',
    border: 'border-cyan-800/40 hover:border-cyan-600/60',
    bg: 'bg-cyan-950/20',
    glow: 'shadow-cyan-900/20',
    label: 'Supervised',
    tagline: 'Full execution trace',
    description: 'See the steps taken, sources used, actions proposed, and why approval is needed before the workflow moves forward.',
    example: 'Run log: Stripe checked. Funnel notes attached. Mobile checkout risk flagged. Delivery paused until approval.',
    chips: ['Execution trace', 'Inspect every action', 'Best for learning/debugging'],
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
            You choose what{' '}
            <span className="gradient-text">can run on its own</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start with approval gates. Move only the repeatable, low-risk parts into autonomous mode once the run history earns trust.
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
                  className={`interactive-glow surface-lift w-full text-left rounded-2xl border p-5 transition-all duration-300 ${m.border} ${
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
            <div className="interactive-glow demo-scanline surface-lift relative bg-navy-800/80 border border-navy-700/60 rounded-2xl overflow-hidden shadow-2xl">
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

// ─── Beta workflows ───────────────────────────────────────────────────────────

const BETA_WORKFLOWS = [
  {
    title: 'Weekly founder update',
    description: 'Pull metrics and notes, draft the update, request approval, then deliver to Slack or email.',
    stack: 'Stripe, docs, Slack/email',
    output: 'Investor-ready weekly brief',
    control: 'Approval before send',
  },
  {
    title: 'Revenue risk monitor',
    description: 'Check revenue signals, flag anomalies, summarize what changed, and suggest follow-up.',
    stack: 'Stripe, CRM, product analytics',
    output: 'Risk digest with next actions',
    control: 'Human review for risky actions',
  },
  {
    title: 'Fundraising intelligence brief',
    description: 'Track investor, market, and competitor signals with source links and prioritized follow-up.',
    stack: 'Web research, notes, CRM',
    output: 'Source-linked research brief',
    control: 'Sources and assumptions visible',
  },
  {
    title: 'Engineering release digest',
    description: 'Summarize shipped work, open blockers, customer impact, and handoff notes for the next cycle.',
    stack: 'GitHub, Linear, docs',
    output: 'Release summary and blockers',
    control: 'Delivery log retained',
  },
  {
    title: 'Customer follow-up queue',
    description: 'Collect account signals, draft follow-up messages, and separate routine nudges from sensitive outreach.',
    stack: 'CRM, email, support notes',
    output: 'Prioritized follow-up list',
    control: 'Sensitive messages gated',
  },
  {
    title: 'Operating cost check',
    description: 'Review recurring tools, usage changes, and renewal dates so small costs do not become invisible drag.',
    stack: 'Billing exports, vendor notes',
    output: 'Renewal and savings brief',
    control: 'No spend change without approval',
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
            <span className="text-violet-400 text-sm font-medium">Controlled beta proof</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Beta workflows we are proving
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            The first product story is not fake traction. It is a focused set of recurring workflows that can be run, reviewed, delivered, and improved.
          </p>
        </div>

        <div
          ref={ref}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {BETA_WORKFLOWS.map((workflow, i) => (
            <div
              key={i}
              className={`interactive-glow surface-lift bg-navy-800/50 border border-navy-700/60 rounded-2xl p-6 hover:border-navy-600 transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="ui-pill normal-case tracking-normal text-violet-200">Beta workflow</span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_16px_rgba(74,222,128,0.5)]" />
              </div>
              <h3 className="text-lg font-semibold text-white">{workflow.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{workflow.description}</p>
              <div className="mt-5 space-y-2 rounded-xl border border-navy-700/60 bg-navy-950/35 p-4">
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                  <span>{workflow.stack}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-400" />
                  <span>{workflow.output}</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                  <span>{workflow.control}</span>
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
  { feature: 'Recurring workflow runs', violema: true, chatAssistant: false, workflowBot: true, codingAgent: false, note: '' },
  { feature: 'Run history and delivery log', violema: true, chatAssistant: 'partial', workflowBot: 'partial', codingAgent: 'partial', note: '' },
  { feature: 'Approval gates before sensitive actions', violema: true, chatAssistant: false, workflowBot: 'partial', codingAgent: 'partial', note: '' },
  { feature: 'Source links and checked inputs', violema: true, chatAssistant: 'partial', workflowBot: 'partial', codingAgent: 'partial', note: '' },
  { feature: 'Credit cost visible per run', violema: true, chatAssistant: false, workflowBot: false, codingAgent: false, note: '' },
  { feature: 'Failure reason and retry path', violema: true, chatAssistant: false, workflowBot: 'partial', codingAgent: 'partial', note: '' },
  { feature: 'Slack + web app delivery', violema: true, chatAssistant: false, workflowBot: 'partial', codingAgent: false, note: '' },
  { feature: 'API-key setup for providers', violema: true, chatAssistant: false, workflowBot: 'partial', codingAgent: false, note: 'Core tools first' },
  { feature: 'Workspace memory for repeated work', violema: true, chatAssistant: 'partial', workflowBot: 'partial', codingAgent: 'partial', note: '' },
  { feature: 'Plans and top-ups tied to usage', violema: true, chatAssistant: false, workflowBot: false, codingAgent: false, note: '' },
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
            Built for inspected execution
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            The difference is not a louder chatbot. It is the operating loop around each run: inputs, approvals, delivery, cost, failure state, and retry path.
          </p>
        </div>

        <div
          ref={ref}
          className={`interactive-glow surface-lift overflow-x-auto rounded-2xl border border-navy-700/60 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
                    <span className="text-xs text-slate-500">Chat assistant</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg bg-navy-700 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-300">V</span>
                    </div>
                    <span className="text-xs text-slate-500">Workflow bot</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-lg bg-navy-700 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-300">D</span>
                    </div>
                    <span className="text-xs text-slate-500">Coding agent</span>
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
                    <CompCell value={row.chatAssistant} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CompCell value={row.workflowBot} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CompCell value={row.codingAgent} />
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
  function scrollToDemo() {
    document.getElementById('product-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-navy-950/40 pointer-events-none" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent pointer-events-none" />
      <div className="interactive-glow relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ViolemaLogo className="mx-auto mb-8 h-[7rem] w-full max-w-[28.5rem]" />
        <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-800/50 rounded-full px-4 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-violet-300 text-sm font-medium">Private beta starts with one live workflow</span>
        </div>
        <h2 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-[1.05]">
          Connect the stack.
          <br />
          <span className="gradient-text">Let Violema run the loop.</span>
        </h2>
        <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
          Start with revenue, investor updates, engineering digests, or CRM follow-up. Violema connects the tools, drafts the work, and asks before anything risky ships.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mb-10">
          <button
            onClick={() => navigate('/signup?next=%2Fplans')}
            className="btn-primary text-lg py-4 px-8 shadow-glow-violet"
          >
            <Zap className="w-5 h-5" />
            Start setup
          </button>
          <button onClick={scrollToDemo} className="btn-secondary text-lg py-4 px-8 group">
            See workflow demo
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
          {['Slack + core tools', 'API keys in setup', 'Human approval controls', 'Controlled-beta workflows'].map((item) => (
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
    </div>
  );
}
