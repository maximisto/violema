import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Zap, MessageSquare, Shield, Cpu, CreditCard, Wrench } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const CATEGORIES = [
  {
    id: 'general',
    label: 'General',
    icon: MessageSquare,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    faqs: [
      {
        q: 'What exactly is Nexus?',
        a: 'Nexus is your AI coworker — built on Claude, the most capable reasoning model available. Unlike a chatbot that waits for commands, Nexus proactively executes multi-step tasks, coordinates across your tools (Slack, GitHub, Stripe, HubSpot, Linear, and more), and works autonomously in the background. Think of it as hiring a brilliant, tireless teammate who never sleeps.',
      },
      {
        q: 'How is Nexus different from ChatGPT or Claude.ai?',
        a: 'Consumer AI tools are conversational interfaces. Nexus is a work execution layer. It connects to your actual systems, remembers your team\'s context, takes autonomous actions (like triaging PRs, sending Slack digests, or querying your database), and operates in three configurable autonomy modes so you stay in control. It also shows you its full reasoning process so there are no black-box surprises.',
      },
      {
        q: 'How is Nexus different from Viktor or Devin?',
        a: 'Viktor focuses mainly on Slack-based task delegation. Devin is purpose-built for software engineering. Nexus is broader — it covers business operations, data analysis, engineering workflows, and customer ops all in one platform. We also lead on reasoning transparency: you can see every thinking step, tool call, and confidence score.',
      },
      {
        q: 'Who is Nexus built for?',
        a: 'Nexus is designed for fast-moving startups and scale-ups with small, high-leverage teams. If you\'re a founder, ops lead, engineer, or business operator who wants to get 10× more done without 10× headcount, Nexus is for you.',
      },
    ],
  },
  {
    id: 'capabilities',
    label: 'Capabilities',
    icon: Cpu,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    faqs: [
      {
        q: 'What can Nexus actually do?',
        a: 'Nexus can: search the web for research, write and execute code, create tasks in Linear/Jira, send Slack/email messages, query your databases, generate reports and slide decks, schedule recurring automations, pull metrics from Stripe/PostHog/GA, triage GitHub issues, enrich leads in HubSpot/Salesforce, and much more. New tools ship every week.',
      },
      {
        q: 'What are autonomy modes?',
        a: 'Nexus has three modes: Autonomous (executes everything without asking), Cautious (plans first, asks for approval on irreversible actions), and Supervised (shows full reasoning, waits for your sign-off on every step). You can switch modes per-conversation in real time.',
      },
      {
        q: 'What does "reasoning transparency" mean?',
        a: 'Before Nexus takes action, it thinks out loud. You can expand any response to see the full reasoning chain: what it considered, what it ruled out, and why it chose a particular tool or approach. Each tool call also shows a confidence score so you know when to double-check an output.',
      },
      {
        q: 'Can Nexus run scheduled tasks automatically?',
        a: 'Yes. You can tell Nexus to run any task on a recurring schedule — "send the weekly eng standup digest every Monday at 9am", "check CAC from PostHog every Friday", etc. Automations run in the background and surface results in your dashboard.',
      },
      {
        q: 'Does Nexus have memory?',
        a: 'Nexus maintains full conversation history within each session and across saved conversations. Workspace-level memory (persistent facts about your company, team, and preferences) is on the roadmap and will roll out to Pro and Enterprise customers first.',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: Shield,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    faqs: [
      {
        q: 'Is my data safe with Nexus?',
        a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We are SOC 2 Type II certified and GDPR compliant. We never use your data to train AI models. Your conversations, tool outputs, and connected credentials stay within your workspace.',
      },
      {
        q: 'Who builds the AI that powers Nexus?',
        a: 'Nexus uses a routed model stack rather than a single model. Claude Sonnet handles most interactive work, GPT-5 covers harder reasoning, Claude Opus is reserved for critical high-stakes tasks, MiniMax powers heavy operational runs, and Mistral handles embeddings and memory. That keeps the system both capable and efficient.',
      },
      {
        q: 'Can I connect Nexus to my internal tools without exposing credentials?',
        a: 'Yes. OAuth connections and API keys are stored in an encrypted credential vault. Nexus never logs raw credential values. Enterprise customers can bring their own encryption keys (BYOK) for the credential vault.',
      },
      {
        q: 'Do you comply with GDPR, HIPAA, or other regulations?',
        a: 'We are fully GDPR compliant. HIPAA compliance is available on Enterprise plans with a signed BAA. SOC 2 Type II report is available on request. Contact us at compliance@purpleorange.io for specifics.',
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing & Plans',
    icon: CreditCard,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    faqs: [
      {
        q: 'How does pricing work?',
        a: 'Nexus offers a free Starter plan (1 seat, 500 tasks/mo, 3 integrations), a Pro plan at $49/seat/mo (unlimited tasks, 50+ integrations, priority Claude access), and an Enterprise plan with custom pricing for advanced security, SSO, SLA, and dedicated infrastructure.',
      },
      {
        q: 'What counts as a "task"?',
        a: 'A task is one complete request cycle — from your message to Nexus\'s final response, including all tool calls and reasoning steps within that cycle. Multi-step automations that run in the background count as one task per scheduled execution.',
      },
      {
        q: 'Is there a free trial for Pro?',
        a: 'Yes. Pro includes a 14-day free trial — no credit card required. You get full access to all Pro features including unlimited tasks and all integrations during the trial period.',
      },
      {
        q: 'Can I cancel any time?',
        a: 'Absolutely. No lock-in, no cancellation fees. Cancel from your account settings and your plan downgrades to Starter at the end of your billing period. Your conversation history is preserved.',
      },
    ],
  },
  {
    id: 'technical',
    label: 'Technical',
    icon: Wrench,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    faqs: [
      {
        q: 'Does Nexus have an API?',
        a: 'A public API and webhook system are on the roadmap for Q3 2025. This will let you trigger Nexus tasks programmatically from your own systems and receive structured outputs back. Sign up for early access on our waitlist.',
      },
      {
        q: 'Can I build custom tools for Nexus?',
        a: 'Custom tool integrations are available on Enterprise plans today. You define an OpenAPI spec and Nexus automatically learns to call your internal endpoints. Self-serve custom tools are coming Q4 2025.',
      },
      {
        q: 'What browsers and platforms does Nexus support?',
        a: 'Nexus runs entirely in the browser — no desktop app required. We support Chrome, Edge, Firefox, and Safari (latest 2 versions). A native Mac app and mobile companion app are planned for H2 2025.',
      },
      {
        q: 'Is Nexus open source?',
        a: 'The core platform is proprietary. We open-source our integration SDKs and tool schemas so the community can contribute new connectors. Check github.com/purpleorangeai for our public repos.',
      },
    ],
  },
];

function AccordionItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${open ? 'border-violet-500/40 bg-navy-800/80' : 'border-navy-700/60 bg-navy-800/30 hover:border-navy-600/60'}`}>
      <button
        className="w-full text-left px-6 py-5 flex items-start gap-4 group"
        onClick={onToggle}
        aria-expanded={open}
      >
        <ChevronDown
          className={`w-5 h-5 mt-0.5 flex-shrink-0 text-violet-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
        <span className={`font-semibold text-base leading-snug transition-colors ${open ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
          {q}
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? '400px' : '0px', opacity: open ? 1 : 0 }}
      >
        <p className="px-6 pb-5 text-slate-400 leading-relaxed text-[15px] pl-[60px]">{a}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('general');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({ 'general-0': true });

  const currentCat = CATEGORIES.find((c) => c.id === activeCategory)!;
  const Icon = currentCat.icon;

  function toggle(key: string) {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-cyan-900/10 pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wide uppercase mb-6">
            <Zap className="w-3 h-3" fill="currentColor" />
            Frequently Asked Questions
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Got questions?<br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              We've got answers.
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Everything you need to know about Nexus — from capabilities and pricing to security and integrations.
          </p>
        </div>
      </section>

      {/* Category tabs + FAQ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* Category selector */}
        <div className="flex flex-wrap gap-3 mb-10">
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                  active
                    ? `${cat.bg} ${cat.border} ${cat.color} border-opacity-100`
                    : 'bg-navy-800/40 border-navy-700/60 text-slate-400 hover:text-slate-200 hover:border-navy-600'
                }`}
              >
                <CatIcon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Active category header */}
        <div className={`flex items-center gap-3 mb-6 p-4 rounded-xl ${currentCat.bg} border ${currentCat.border}`}>
          <div className={`w-9 h-9 rounded-lg ${currentCat.bg} border ${currentCat.border} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${currentCat.color}`} />
          </div>
          <div>
            <h2 className="text-white font-semibold">{currentCat.label}</h2>
            <p className="text-slate-500 text-xs">{currentCat.faqs.length} questions</p>
          </div>
        </div>

        {/* FAQ items */}
        <div className="space-y-3">
          {currentCat.faqs.map((faq, i) => (
            <AccordionItem
              key={`${activeCategory}-${i}`}
              q={faq.q}
              a={faq.a}
              open={!!openItems[`${activeCategory}-${i}`]}
              onToggle={() => toggle(`${activeCategory}-${i}`)}
            />
          ))}
        </div>

        {/* Still have questions CTA */}
        <div className="mt-16 text-center p-10 rounded-2xl bg-gradient-to-br from-violet-900/30 to-navy-800/60 border border-violet-700/30">
          <h3 className="text-2xl font-bold text-white mb-3">Still have questions?</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Our team is online and ready to help. Usually responds within a few minutes.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Ask Nexus directly
            </button>
            <a
              href="mailto:hello@purpleorange.io"
              className="btn-secondary"
            >
              Email us
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
