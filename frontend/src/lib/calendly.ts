export const consultationUrl = 'https://calendly.com/max-purpleorange/30min';
export const calendlyConsultationEvent = 'violema:open-calendly-consultation';

type PreventableEvent = {
  preventDefault: () => void;
};

declare global {
  interface Window {
    gtag?: (eventName: 'event', action: string, params: Record<string, string>) => void;
  }
}

export interface CalendlyConsultationEventDetail {
  source: string;
  url: string;
}

export function openCalendlyConsultation(event?: PreventableEvent, source = 'unknown') {
  event?.preventDefault();

  if (typeof window === 'undefined') {
    return;
  }

  window.gtag?.('event', 'book_consultation_click', {
    event_category: 'lead',
    event_label: source,
  });
  window.dispatchEvent(new CustomEvent<CalendlyConsultationEventDetail>(calendlyConsultationEvent, {
    detail: {
      source,
      url: consultationUrl,
    },
  }));
}
