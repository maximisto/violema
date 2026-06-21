import { Moon, Sun } from 'lucide-react';
import { LIGHT_THEME_ENABLED } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Dark/light switch for the public/marketing surface. Shows the icon of the
 * theme you'd switch TO. Styled with neutral utilities that flip with the theme.
 */
export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isLight, toggleTheme } = useTheme();

  // Light theme is disabled for now — hide the switch entirely.
  if (!LIGHT_THEME_ENABLED) return null;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition duration-200 hover:border-violet-300/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${className}`}
    >
      {isLight ? <Moon className="h-[1.15rem] w-[1.15rem]" /> : <Sun className="h-[1.15rem] w-[1.15rem]" />}
    </button>
  );
}
