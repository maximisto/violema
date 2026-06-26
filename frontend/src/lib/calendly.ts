export const consultationUrl = 'https://calendly.com/max-purpleorange/30min';

const calendlyWidgetScriptId = 'calendly-popup-widget-script';
const calendlyWidgetSrc = 'https://assets.calendly.com/assets/external/widget.js';

type PreventableEvent = {
  preventDefault: () => void;
};

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget?: (options: { url: string }) => void;
    };
    gtag?: (eventName: 'event', action: string, params: Record<string, string>) => void;
  }
}

let calendlyWidgetPromise: Promise<void> | null = null;

function hasCalendlyWidget() {
  return typeof window !== 'undefined'
    && typeof window.Calendly?.initPopupWidget === 'function';
}

function loadCalendlyWidget() {
  if (typeof document === 'undefined' || hasCalendlyWidget()) {
    return Promise.resolve();
  }

  if (calendlyWidgetPromise) {
    return calendlyWidgetPromise;
  }

  calendlyWidgetPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(calendlyWidgetScriptId)
      || document.querySelector<HTMLScriptElement>(`script[src="${calendlyWidgetSrc}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Calendly widget failed to load')), { once: true });
      window.setTimeout(() => resolve(), 1500);
      return;
    }

    const script = document.createElement('script');
    script.id = calendlyWidgetScriptId;
    script.src = calendlyWidgetSrc;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Calendly widget failed to load'));
    document.head.appendChild(script);
  });

  return calendlyWidgetPromise;
}

export async function openCalendlyConsultation(event?: PreventableEvent, source = 'unknown') {
  event?.preventDefault();

  try {
    window.gtag?.('event', 'book_consultation_click', {
      event_category: 'lead',
      event_label: source,
    });
    await loadCalendlyWidget();
    if (hasCalendlyWidget()) {
      window.Calendly?.initPopupWidget?.({ url: consultationUrl });
      return;
    }
  } catch {
    // Keep the site open even if Calendly's popup script is blocked.
  }

  window.open(consultationUrl, '_blank', 'noopener,noreferrer');
}
