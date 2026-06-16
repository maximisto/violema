import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Play from 'lucide-react/dist/esm/icons/play.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import { Link, useNavigate } from 'react-router-dom';
import ViolemaLogo from './ViolemaLogo';
import Reveal from './Reveal';

const footerLinks = {
  Product: [
    { label: 'Product', path: '/#features' },
    { label: 'Workflows', path: '/#how-it-works' },
    { label: 'Integrations', path: '/integrations' },
    { label: 'Pricing', path: '/#pricing' },
    { label: 'Compare', path: '/#compare' },
  ],
  Resources: [
    { label: 'AI agents for founders', path: '/ai-agents-for-founders/' },
    { label: 'Founder guides', path: '/blog/' },
    { label: 'What to automate first', path: '/blog/what-should-founders-automate-first-with-ai-agents/' },
    { label: 'Agent vs automation', path: '/blog/ai-agent-vs-workflow-automation/' },
  ],
  Company: [
    { label: 'Contact', path: 'mailto:hello@purpleorange.io' },
    { label: 'Sales', path: 'mailto:sales@purpleorange.io?subject=Violema' },
    { label: 'Security', path: 'mailto:security@purpleorange.io' },
  ],
  Support: [
    { label: 'FAQ', path: '/faq' },
    { label: 'Sign in', path: '/login' },
    { label: 'Set up access', path: '/signup?next=%2Fplans' },
  ],
  Legal: [
    { label: 'Privacy', path: '/privacy' },
    { label: 'Terms', path: '/terms' },
  ],
};

function FooterLink({ label, path }: { label: string; path: string }) {
  const className = 'text-sm text-[#8793ad] transition duration-200 hover:text-white';
  const isStaticSeoPage = path.startsWith('/blog/') || path.startsWith('/ai-agents-for-founders/');
  if (path.startsWith('mailto:') || path.includes('#') || isStaticSeoPage) {
    return (
      <a href={path} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link to={path} className={className}>
      {label}
    </Link>
  );
}

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <div className="py-14">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-6 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.9)] sm:p-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10">
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal-500/60 to-transparent" />
              <div aria-hidden className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-violet-600/18 blur-3xl" />
              <div aria-hidden className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-signal-500/12 blur-3xl" />

              {/* Line-art bookend — single continuous violet→cyan "rail" stroke, echoing the Trust Surface dog. */}
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 1200 360"
                preserveAspectRatio="none"
                fill="none"
              >
                <defs>
                  <linearGradient id="footerRail" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#8b5cf6" stopOpacity="0" />
                    <stop offset="0.26" stopColor="#8b5cf6" stopOpacity="0.5" />
                    <stop offset="0.72" stopColor="#22d3ee" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M-40 236 C 180 236 300 110 540 132 C 740 150 880 64 1080 92 C 1170 104 1210 140 1260 138"
                  stroke="url(#footerRail)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              <div className="relative max-w-2xl">
                <p className="text-telemetry text-[0.62rem] text-signal-400">// founder operating system</p>
                <h2 className="mt-4 font-display text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-[3.2rem]">
                  Put the work that repeats on rails.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-[#aeb7cd] sm:text-lg">
                  Schedule the run, review the judgment calls, deliver through the right channel, and keep the proof attached.
                </p>
              </div>

              <div className="relative mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col xl:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/signup?next=%2Fplans')}
                  className="group inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-[#7c3cff] px-6 text-sm font-bold text-white shadow-[0_22px_60px_-18px_rgba(124,58,237,0.8)] transition duration-200 hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
                >
                  <Sparkles className="h-4 w-4" />
                  Set up access
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border border-white/14 bg-white/[0.04] px-6 text-sm font-bold text-white transition duration-200 hover:border-signal-500/40 hover:bg-signal-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  <Play className="h-4 w-4" />
                  See workflow demo
                </a>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="grid gap-10 border-t border-white/10 py-14 md:grid-cols-[1.15fr_1.85fr]">
          <div>
            <button
              type="button"
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              onClick={() => navigate('/')}
              aria-label="Violema home"
            >
              <ViolemaLogo className="h-12 w-[12.5rem]" />
            </button>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#8793ad]">
              Reviewable AI operations for recurring founder work: approvals, delivery, source links, and run history.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 xl:grid-cols-5">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h3 className="text-telemetry text-[0.55rem] text-[#6f7a91]">{category}</h3>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <FooterLink {...link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-sm text-[#828ea4] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/po-logo.png" alt="Purple Orange LLC" className="h-5 w-5 object-contain" />
            <span>© {new Date().getFullYear()} Purple Orange LLC. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-telemetry text-[0.5rem]">
            <span>TLS in transit</span>
            <span>Private by default</span>
            <span>Approval-first execution</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
