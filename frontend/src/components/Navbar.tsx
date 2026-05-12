import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, Sparkles, X } from 'lucide-react';
import ViolemaLogo from './ViolemaLogo';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const navLinks = [
    { label: 'Product', href: '#features' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Compare', href: '#compare' },
    { label: 'FAQ', href: '/faq' },
  ];

  const handleNavClick = (href: string) => {
    if (href.startsWith('/')) {
      navigate(href);
      return;
    }

    const sectionId = href.replace('#', '');
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-navy-900/90 backdrop-blur-md border-b border-navy-800/60 shadow-lg'
          : 'border-b border-navy-800/70 bg-navy-900/72 backdrop-blur-md lg:border-transparent lg:bg-transparent lg:backdrop-blur-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        <div className="mobile-header-row flex items-center justify-between">
          {/* Logo */}
          <button
            className="flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-2xl"
            onClick={() => navigate('/')}
            aria-label="Violema home"
          >
            <ViolemaLogo
              className="mobile-header-logo"
            />
          </button>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-white/8 bg-navy-900/55 px-2 py-1.5 shadow-[0_12px_32px_rgba(4,8,20,0.22)] backdrop-blur-xl">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-all duration-200 hover:bg-white/6 hover:text-white"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-2.5">
            <button
              onClick={() => navigate('/login')}
              className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-colors duration-200 hover:text-white"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup?next=%2Fplans')}
              className="btn-primary rounded-full text-[0.82rem] py-2.5 px-4.5"
            >
              <Sparkles className="w-4 h-4" />
              Get access
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className={`lg:hidden transition-all duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              mobileOpen
                ? 'rounded-2xl border border-violet-400/45 bg-violet-500/10 p-2.5 text-white shadow-[0_0_22px_rgba(139,92,246,0.24)]'
                : 'rounded-xl p-1.5 text-slate-400'
            }`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-8 w-8 sm:h-5 sm:w-5" /> : <Menu className="h-8 w-8 sm:h-5 sm:w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="mobile-nav-drawer lg:hidden overflow-y-auto border-t border-violet-800/35 bg-navy-950 shadow-[0_28px_90px_rgba(2,6,23,0.72)]">
          <div className="px-4 pb-7 pt-4">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/8 bg-navy-900/80 px-4 py-3">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-violet-200/75">
                Navigate
              </span>
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.8)]" />
            </div>

            <div className="space-y-2.5">
              {navLinks.map((link, index) => (
                <button
                  key={link.label}
                  onClick={() => {
                    handleNavClick(link.href);
                    setMobileOpen(false);
                  }}
                  className="group flex w-full items-center justify-between rounded-2xl border border-white/8 bg-navy-900/80 px-4 py-4 text-left text-white shadow-[0_16px_36px_rgba(2,6,23,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/45 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <span className="flex items-baseline gap-3">
                    <span className="text-[0.72rem] font-bold tracking-[0.18em] text-violet-300/70">
                      0{index + 1}
                    </span>
                    <span className="text-[1.75rem] font-black leading-none tracking-tight">
                      {link.label}
                    </span>
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-navy-900/80 text-slate-300 transition-all duration-200 group-hover:border-violet-300/50 group-hover:text-white">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 border-t border-white/10 pt-5">
              <button
                onClick={() => {
                  navigate('/signup?next=%2Fplans');
                  setMobileOpen(false);
                }}
                className="btn-primary w-full justify-center rounded-2xl py-4 text-[1.05rem] font-extrabold"
              >
                <Sparkles className="h-5 w-5" />
                Start setup
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  navigate('/login');
                  setMobileOpen(false);
                }}
                className="btn-secondary w-full justify-center rounded-2xl py-4 text-[1.05rem] font-extrabold"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
