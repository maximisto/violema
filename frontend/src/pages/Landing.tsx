import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Integrations from '../components/Integrations';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, CheckCircle, BarChart3, MessageSquare, Zap, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

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
              Nexus works{' '}
              <span className="gradient-text">while you sleep</span>
            </h2>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Hundreds of teams are running Nexus right now — pulling reports, triaging issues, sending updates, and closing the loop on tasks you'd otherwise forget.
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
      text: '@nexus pull the MRR from Stripe and compare to last month',
    },
    {
      role: 'nexus',
      text: null,
      tool: { name: 'query_data', label: 'Querying Stripe', icon: '📊' },
    },
    {
      role: 'nexus',
      text: '**MRR Report — March 2025**\n\n📈 **$127,450** this month (+17.8% vs February)\n\n| Metric | This Month | Last Month |\n|--------|-----------|------------|\n| MRR | $127,450 | $108,230 |\n| New Subs | 47 | 39 |\n| Churn | 3 | 5 |\n| NRR | 118% | 112% |\n\nStrong growth. Churn improved significantly. Want me to send this to #revenue-team?',
    },
    {
      role: 'user',
      text: 'Yes, send to #revenue-team and create a task to review by EOW',
    },
    {
      role: 'nexus',
      text: null,
      tools: [
        { name: 'send_message', label: 'Sending to #revenue-team', icon: '📨' },
        { name: 'create_task', label: 'Creating task', icon: '✅' },
      ],
    },
    {
      role: 'nexus',
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
              Watch Nexus pull Stripe data, analyze it, message your team, and create follow-up tasks — all from a single Slack message.
            </p>

            <div className="space-y-4 mb-10">
              {[
                { icon: BarChart3, text: 'Pulls live data from your connected tools' },
                { icon: MessageSquare, text: 'Proactively communicates results to your team' },
                { icon: CheckCircle, text: 'Creates and assigns follow-up tasks automatically' },
                { icon: TrendingUp, text: 'Learns from your workflows over time' },
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
              onClick={() => navigate('/dashboard')}
              className="btn-primary text-base py-3 px-8"
            >
              <Zap className="w-5 h-5" />
              Try Nexus for free
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
                          <span className="text-xs text-white font-bold">N</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-xs text-violet-400 mb-0.5 block font-semibold">Nexus</span>
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

export default function Landing() {
  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar />
      <Hero />
      <Integrations />
      <Features />
      <LiveActivity />
      <ProductDemo />
      <Pricing />
      <Footer />
    </div>
  );
}
