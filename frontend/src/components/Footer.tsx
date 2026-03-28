import { useState } from 'react';
import { Zap, ArrowRight, Sparkles, Check, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const LINKS = {
  Product: [
    { label: 'Features', path: '/#features' },
    { label: 'Integrations', path: '/#integrations' },
    { label: 'Pricing', path: '/#pricing' },
    { label: 'Changelog', path: '#' },
    { label: 'Roadmap', path: '#' },
  ],
  Company: [
    { label: 'About', path: '#' },
    { label: 'Blog', path: '#' },
    { label: 'Careers', path: '#' },
    { label: 'Press', path: '#' },
    { label: 'Contact', path: 'mailto:hello@purpleorange.io' },
  ],
  Resources: [
    { label: 'Documentation', path: '#' },
    { label: 'API Reference', path: '#' },
    { label: 'Status', path: '#' },
    { label: 'Community', path: '#' },
    { label: 'FAQ', path: '/faq' },
  ],
  Legal: [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
    { label: 'Cookie Policy', path: '#' },
    { label: 'Security', path: 'mailto:security@purpleorange.io' },
  ],
};

type SignupState = 'idle' | 'loading' | 'success' | 'error' | 'duplicate';

function WaitlistSignup() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<SignupState>('idle');
  const [position, setPosition] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showName, setShowName] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, source: 'footer' }),
      });
      const data = await res.json() as { ok?: boolean; duplicate?: boolean; position?: number; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? 'Something went wrong.');
        setState('error');
        return;
      }
      setPosition(data.position ?? null);
      setState(data.duplicate ? 'duplicate' : 'success');
    } catch {
      setErrorMsg('Network error — please try again.');
      setState('error');
    }
  }

  if (state === 'success' || state === 'duplicate') {
    return (
      <div className="flex flex-col items-center text-center py-2 animate-in">
        <div className="w-12 h-12 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-violet-400" />
        </div>
        {state === 'success' ? (
          <>
            <p className="text-white font-semibold text-lg mb-1">You're on the list! 🎉</p>
            <p className="text-slate-400 text-sm">
              You're <span className="text-violet-400 font-semibold">#{position?.toLocaleString()}</span> in line. We'll
              email you the moment early access opens.
            </p>
          </>
        ) : (
          <>
            <p className="text-white font-semibold text-lg mb-1">Already signed up!</p>
            <p className="text-slate-400 text-sm">
              You're <span className="text-violet-400 font-semibold">#{position?.toLocaleString()}</span> in line. We haven't forgotten you.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto">
      {/* Name toggle */}
      <div className={`overflow-hidden transition-all duration-300 ${showName ? 'max-h-20 mb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name (optional)"
          className="w-full bg-navy-900/80 border border-navy-600 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Email row */}
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          onFocus={() => setShowName(true)}
          placeholder="your@email.com"
          className="flex-1 min-w-0 bg-navy-900/80 border border-navy-600 focus:border-violet-500 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={state === 'loading' || !email.trim()}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 text-sm shadow-glow-violet"
        >
          {state === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>Notify me <ArrowRight className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>

      {state === 'error' && (
        <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
      )}

      <p className="text-xs text-slate-600 mt-2.5 text-center">
        No spam, ever. Unsubscribe any time. ~2 emails/quarter.
      </p>
    </form>
  );
}

export default function Footer() {
  const navigate = useNavigate();

  function renderLink(link: { label: string; path: string }) {
    if (link.path.startsWith('mailto:')) {
      return (
        <a key={link.label} href={link.path} className="text-slate-500 hover:text-slate-300 text-sm transition-colors duration-150">
          {link.label}
        </a>
      );
    }
    if (link.path.startsWith('/')) {
      return (
        <Link key={link.label} to={link.path} className="text-slate-500 hover:text-slate-300 text-sm transition-colors duration-150">
          {link.label}
        </Link>
      );
    }
    return (
      <a key={link.label} href={link.path} className="text-slate-500 hover:text-slate-300 text-sm transition-colors duration-150">
        {link.label}
      </a>
    );
  }

  return (
    <footer className="border-t border-navy-800 bg-navy-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Waitlist section ─────────────────────────────────────────── */}
        <div className="relative py-20 border-b border-navy-800 overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[300px] bg-violet-600/8 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-2xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wide uppercase mb-6">
              <Sparkles className="w-3 h-3" />
              Not ready to commit yet? No stress.
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              Get the scoop before anyone else
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto leading-relaxed">
              Drop your email and we'll hit you with early access, behind-the-scenes product updates, and launch discounts. Zero fluff.
            </p>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="flex -space-x-2">
                {['A', 'B', 'C', 'D', 'E'].map((l, i) => (
                  <div
                    key={l}
                    className="w-7 h-7 rounded-full border-2 border-navy-950 flex items-center justify-center text-[10px] font-bold text-white"
                    style={{
                      background: ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'][i],
                      zIndex: 5 - i,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <span className="text-slate-500 text-sm">
                <span className="text-slate-300 font-semibold">2,400+</span> people already waiting
              </span>
            </div>

            <WaitlistSignup />

            {/* Or jump in now */}
            <div className="mt-6 flex items-center gap-3 justify-center">
              <span className="text-slate-700 text-xs">— or —</span>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-violet-400 hover:text-violet-300 font-semibold transition-colors underline underline-offset-2"
              >
                Try Nexus now, it's free →
              </button>
            </div>
          </div>
        </div>

        {/* ── Launch CTA (compact) ─────────────────────────────────────── */}
        <div className="py-14 text-center border-b border-navy-800">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Start with Nexus today
          </h2>
          <p className="text-lg text-slate-400 mb-7 max-w-xl mx-auto">
            Join thousands of teams that have already hired their first AI coworker.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary text-base py-3 px-8 shadow-glow-violet"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Add Nexus to Slack — Free
            </button>
            <button className="btn-secondary text-base py-3 px-8">
              Book a demo
            </button>
          </div>
        </div>

        {/* ── Footer links ─────────────────────────────────────────────── */}
        <div className="py-16 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Logo + description */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <button
              className="flex items-center gap-2.5 mb-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg"
              onClick={() => navigate('/')}
            >
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center group-hover:shadow-glow-violet transition-all">
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm leading-tight">Nexus</span>
                <span className="text-[9px] text-violet-400/60 leading-none font-medium tracking-widest uppercase">
                  by Purple Orange AI
                </span>
              </div>
            </button>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Your AI coworker that proactively executes tasks, coordinates your tools, and gets things done — autonomously.
            </p>
            <div className="flex gap-3">
              {['twitter', 'linkedin', 'github'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-8 h-8 rounded-lg bg-navy-800 border border-navy-700 hover:border-navy-600 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors text-xs capitalize"
                >
                  {social[0].toUpperCase()}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-slate-200 font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {renderLink(link)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────────── */}
        <div className="py-6 border-t border-navy-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">
            © {new Date().getFullYear()} Purple Orange LLC. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center sm:justify-end">
            <Link to="/privacy" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Privacy</Link>
            <Link to="/terms" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Terms</Link>
            <Link to="/faq" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">FAQ</Link>
            <span className="w-px h-3 bg-navy-700 hidden sm:block" />
            <span className="text-slate-700 text-xs">SOC 2 Certified</span>
            <span className="w-px h-3 bg-navy-700 hidden sm:block" />
            <span className="text-slate-700 text-xs">GDPR Compliant</span>
            <span className="w-px h-3 bg-navy-700 hidden sm:block" />
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
