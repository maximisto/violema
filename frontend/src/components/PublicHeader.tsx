import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import { Link, useNavigate } from 'react-router-dom';
import ViolemaLogo from './ViolemaLogo';
import ThemeToggle from './ThemeToggle';

type PublicHeaderProps = {
  backHref?: string;
  backLabel?: string;
  actionHref?: string;
  actionLabel?: string;
};

export default function PublicHeader({
  backHref = '/',
  backLabel = 'Back home',
  actionHref,
  actionLabel,
}: PublicHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative z-20 border-b border-white/6 bg-navy-950/35 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.85rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          className="flex min-w-0 items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          onClick={() => navigate('/')}
          aria-label="Violema home"
        >
          <ViolemaLogo className="h-11 w-[11.5rem] sm:h-14 sm:w-[14.25rem]" />
        </button>

        <nav className="hidden items-center gap-2 rounded-full border border-white/8 bg-navy-900/55 px-2 py-1.5 shadow-[0_12px_32px_rgba(4,8,20,0.22)] backdrop-blur-xl md:flex">
          <Link to="/" className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-all hover:bg-white/6 hover:text-white">
            Home
          </Link>
          <Link to="/#beta-access" className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-all hover:bg-white/6 hover:text-white">
            Beta access
          </Link>
          <Link to="/faq" className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-all hover:bg-white/6 hover:text-white">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="h-10 w-10" />
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-navy-700/80 bg-navy-900/55 px-4 py-2 text-[0.82rem] font-medium text-slate-300 transition-colors hover:border-navy-600 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
          {actionHref && actionLabel ? (
            <Link
              to={actionHref}
              className="rounded-full bg-violet-600 px-4 py-2 text-[0.82rem] font-semibold text-white transition-colors hover:bg-violet-500"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
