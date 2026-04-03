import type { MouseEventHandler, ReactNode } from 'react';

export type AuthProviderKind = 'google' | 'microsoft';

export function GoogleMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M21.35 11.1H12v2.9h5.34c-.23 1.4-1.05 2.6-2.23 3.4v2.83h3.6c2.1-1.94 3.31-4.8 3.31-8.13 0-.71-.06-1.24-.17-2Z" />
      <path fill="#34A853" d="M12 22c2.97 0 5.46-.98 7.28-2.66l-3.6-2.83c-.99.66-2.26 1.05-3.68 1.05-2.83 0-5.23-1.91-6.09-4.47H2.17v2.9A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M5.91 13.09A5.99 5.99 0 0 1 5.6 12c0-.38.05-.75.11-1.09V8.01H2.17A10 10 0 0 0 2 12c0 1.6.38 3.12 1.04 4.47l2.87-2.38Z" />
      <path fill="#EA4335" d="M12 5.88c1.62 0 3.08.56 4.22 1.66l3.16-3.16C17.45 2.54 14.97 1.5 12 1.5A10 10 0 0 0 2.17 8.01l3.74 2.9C6.77 7.8 9.17 5.88 12 5.88Z" />
    </svg>
  );
}

export function MicrosoftMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="8.5" height="8.5" fill="#F25022" rx="1.2" />
      <rect x="13" y="2.5" width="8.5" height="8.5" fill="#7FBA00" rx="1.2" />
      <rect x="2.5" y="13" width="8.5" height="8.5" fill="#00A4EF" rx="1.2" />
      <rect x="13" y="13" width="8.5" height="8.5" fill="#FFB900" rx="1.2" />
    </svg>
  );
}

const PROVIDER_STYLES: Record<AuthProviderKind, {
  halo: string;
  badge: string;
  eyebrow: string;
  label: string;
  accent: string;
  titleFont: string;
}> = {
  google: {
    halo: 'from-[#4285F4]/18 via-[#34A853]/10 to-[#EA4335]/16 border-[#4285F4]/18 hover:border-[#4285F4]/38 hover:shadow-[0_18px_40px_rgba(66,133,244,0.12)]',
    badge: 'border-white/70 bg-white shadow-[0_10px_24px_rgba(255,255,255,0.12)]',
    eyebrow: 'text-[#8ab4f8]',
    accent: 'bg-gradient-to-r from-[#4285F4]/0 via-[#4285F4]/35 to-[#EA4335]/0',
    label: 'Continue with Google',
    titleFont: '"Roboto","Helvetica Neue",Arial,sans-serif',
  },
  microsoft: {
    halo: 'from-[#00A4EF]/18 via-[#7FBA00]/10 to-[#F25022]/16 border-[#00A4EF]/18 hover:border-[#00A4EF]/36 hover:shadow-[0_18px_40px_rgba(0,164,239,0.12)]',
    badge: 'border-white/10 bg-white/[0.06]',
    eyebrow: 'text-[#7dd3fc]',
    accent: 'bg-gradient-to-r from-[#00A4EF]/0 via-[#00A4EF]/35 to-[#F25022]/0',
    label: 'Continue with Microsoft',
    titleFont: '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif',
  },
};

interface AuthProviderButtonProps {
  provider: AuthProviderKind;
  note: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  icon: ReactNode;
}

export default function AuthProviderButton({
  provider,
  note,
  onClick,
  icon,
}: AuthProviderButtonProps) {
  const style = PROVIDER_STYLES[provider];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${style.halo} px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-80" />
      <div className={`absolute inset-x-8 bottom-0 h-px ${style.accent} opacity-75 transition-opacity duration-200 group-hover:opacity-100`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border ${style.badge} shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${style.eyebrow}`}>
            {provider === 'google' ? 'Google workspace' : 'Microsoft identity'}
          </p>
          <p
            className="mt-1 text-sm font-semibold tracking-[-0.01em] text-white"
            style={{ fontFamily: style.titleFont }}
          >
            {style.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{note}</p>
        </div>
      </div>
    </button>
  );
}
