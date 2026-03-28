import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Integrations from '../components/Integrations';
import Features from '../components/Features';
import Pricing from '../components/Pricing';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, CheckCircle, BarChart3, MessageSquare, Zap } from 'lucide-react';

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
      <ProductDemo />
      <Pricing />
      <Footer />
    </div>
  );
}
