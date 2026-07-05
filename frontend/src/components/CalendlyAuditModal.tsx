import ExternalLink from 'lucide-react/dist/esm/icons/external-link.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calendlyConsultationEvent,
  consultationUrl,
  type CalendlyConsultationEventDetail,
} from '../lib/calendly';

function buildCalendlyEmbedUrl(url: string) {
  const embedUrl = new URL(url);
  embedUrl.searchParams.set('hide_gdpr_banner', '1');
  embedUrl.searchParams.set('primary_color', '7c3cff');
  return embedUrl.toString();
}

export default function CalendlyAuditModal() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('unknown');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const embedUrl = useMemo(() => buildCalendlyEmbedUrl(consultationUrl), []);

  useEffect(() => {
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<CalendlyConsultationEventDetail>).detail;
      setSource(detail?.source || 'unknown');
      setOpen(true);
    }

    window.addEventListener(calendlyConsultationEvent, onOpen);
    return () => window.removeEventListener(calendlyConsultationEvent, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/72 px-3 py-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close workflow audit scheduler"
        onClick={() => setOpen(false)}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendly-audit-title"
        className="relative flex h-[min(48rem,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#07101f] shadow-[0_34px_120px_rgba(0,0,0,0.62)]"
      >
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.035] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Workflow audit</p>
            <h2 id="calendly-audit-title" className="mt-1 truncate text-base font-semibold text-white sm:text-lg">
              Book a 30-minute first-mission call
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={consultationUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden h-10 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 transition hover:border-violet-300/35 hover:text-white sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-slate-300 transition hover:border-violet-300/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              aria-label="Close workflow audit scheduler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe
          title="Schedule a Violema workflow audit"
          src={embedUrl}
          data-source={source}
          className="h-full w-full flex-1 bg-white"
        />
      </section>
    </div>
  );
}
