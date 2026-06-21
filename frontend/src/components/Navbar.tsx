import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import Menu from 'lucide-react/dist/esm/icons/menu.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { useEffect, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { homepageNav } from '../content/homepage';
import ViolemaLogo from './ViolemaLogo';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomeRoute = location.pathname === '/';
  const transparent = isHomeRoute && !scrolled && !mobileOpen;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) return;
    const sectionId = location.hash.replace('#', '');
    const timer = window.setTimeout(() => scrollToSection(sectionId, 'auto'), 80);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);

  function scrollToSection(sectionId: string, behavior?: ScrollBehavior) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: behavior ?? (prefersReducedMotion ? 'auto' : 'smooth'), block: 'start' });
  }

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (href.startsWith('/blog/') || href.startsWith('/ai-agents-for-founders/')) {
      return;
    }

    event.preventDefault();

    if (href.startsWith('/')) {
      navigate(href);
      return;
    }

    const sectionId = href.replace('#', '');
    if (location.pathname !== '/') {
      navigate({ pathname: '/', hash: href });
      return;
    }

    window.history.pushState(null, '', href);
    scrollToSection(sectionId);
  }

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        transparent
          ? 'border-b border-transparent bg-transparent'
          : 'border-b border-white/10 bg-[#070b16]/85 shadow-[0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.75rem] items-center justify-between gap-4 xl:h-[5.5rem]">
          <button
            type="button"
            className="flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            onClick={() => navigate('/')}
            aria-label="Violema home"
          >
            <ViolemaLogo className="mobile-header-logo xl:h-14 xl:w-[15.5rem]" />
          </button>

          <div className="hidden items-center gap-9 xl:flex">
            {homepageNav.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(event) => handleNavClick(event, link.href)}
                className="inline-flex items-center gap-1.5 rounded-xl px-1 py-2 text-base font-medium text-[#dbe2f4] transition duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                {link.label}
                {link.label === 'Product' || link.label === 'Use cases' || link.label === 'Resources' ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : null}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="min-h-12 rounded-xl border border-slate-500/55 bg-[#070b18]/45 px-8 text-base font-semibold text-[#dbe2f4] transition duration-200 hover:border-violet-200/45 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate('/signup?next=%2Fplans')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-violet-500 to-[#7c3cff] px-8 text-base font-bold text-white shadow-[0_18px_55px_rgba(124,58,237,0.28)] transition duration-200 hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              Set up access
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 xl:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#f4f1ec] transition duration-200 hover:border-violet-200/40"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-[#090a0c]/96 backdrop-blur-xl xl:hidden">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
            <div className="grid gap-2">
              {homepageNav.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(event) => {
                    handleNavClick(event, link.href);
                    setMobileOpen(false);
                  }}
                  className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-left text-base font-medium text-[#f4f1ec] transition duration-200 hover:border-violet-200/40"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => {
                  navigate('/signup?next=%2Fplans');
                  setMobileOpen(false);
                }}
                className="min-h-12 rounded-xl bg-[#f4f1ec] px-4 text-sm font-semibold text-[#090a0c]"
              >
                Set up access
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/login');
                  setMobileOpen(false);
                }}
                className="min-h-12 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-[#f4f1ec]"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
