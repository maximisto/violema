import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const PO_LOGO = '/po-logo.png';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Product', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '/faq' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-navy-900/90 backdrop-blur-md border-b border-navy-800/60 shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[4.9rem] sm:h-[5.4rem]">
          {/* Logo */}
          <button
            className="brand-shell flex items-center gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5"
            onClick={() => navigate('/')}
            aria-label="Nexus home"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 shadow-glow-violet overflow-hidden flex-shrink-0 p-0.5 ring-1 ring-violet-300/25">
              <img src={PO_LOGO} alt="Purple Orange AI" className="po-logo w-full h-full object-contain" />
            </div>
            <div className="brand-lockup w-[10.4rem] sm:w-[11.7rem]">
              <span className="brand-wordmark text-[1.08rem] sm:text-[1.34rem]">
                NEXUS
              </span>
              <span className="brand-submark text-[8.7px] sm:text-[10px]">
                by Purple Orange AI
              </span>
            </div>
          </button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-white/8 bg-navy-900/55 px-2 py-1.5 shadow-[0_12px_32px_rgba(4,8,20,0.22)] backdrop-blur-xl">
            {navLinks.map((link) => (
              link.href.startsWith('/') ? (
                <button
                  key={link.label}
                  onClick={() => navigate(link.href)}
                  className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-all duration-200 hover:bg-white/6 hover:text-white"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-all duration-200 hover:bg-white/6 hover:text-white"
                >
                  {link.label}
                </a>
              )
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-colors duration-200 hover:text-white"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary rounded-full text-[0.82rem] py-2.5 px-4.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Add to Slack
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-navy-900/95 backdrop-blur-md border-b border-navy-800">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              link.href.startsWith('/') ? (
                <button
                  key={link.label}
                  onClick={() => {
                    navigate(link.href);
                    setMobileOpen(false);
                  }}
                  className="block w-full text-left text-slate-400 hover:text-white text-sm font-medium transition-colors"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-slate-400 hover:text-white text-sm font-medium transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              )
            ))}
            <div className="pt-3 border-t border-navy-800">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full btn-primary justify-center text-sm"
              >
                Add to Slack
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
