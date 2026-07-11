import { betaAccessSignals, betaAccessSteps, homepageNav } from '../src/content/homepage';
import { readdirSync, readFileSync } from 'node:fs';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function readPublicTextFiles(directory: URL): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);

    if (entry.isDirectory()) {
      return readPublicTextFiles(entryUrl);
    }

    if (/\.(html|xml)$/.test(entry.name)) {
      return [readFileSync(entryUrl, 'utf8')];
    }

    return [];
  });
}

const navLabels = homepageNav.map((item) => item.label);

const visibleLaunchCopy = [
  ...betaAccessSteps.flatMap((step) => [step.label, step.title, step.body]),
  ...betaAccessSignals.flatMap((signal) => [signal.label, signal.value]),
].join(' ');

const betaAccessComponent = readFileSync(new URL('../src/components/BetaAccess.tsx', import.meta.url), 'utf8');
const controlledBetaCopy = [visibleLaunchCopy, betaAccessComponent].join(' ');

assert(controlledBetaCopy.includes('$79'), 'homepage anchors Start at $79');
assert(controlledBetaCopy.includes('$249'), 'homepage anchors Pro at $249');
assert(/500 trial credits/i.test(controlledBetaCopy), 'homepage states the beta trial amount');
assert(/manual approval/i.test(controlledBetaCopy), 'homepage states manual approval');
assert(/confidential/i.test(controlledBetaCopy), 'homepage states beta confidentiality');
assert(!/buy now|instant access|start checkout/i.test(controlledBetaCopy), 'homepage does not promise self-serve access');

assert(navLabels.includes('Beta access'), 'homepage nav exposes beta access');
assert(!navLabels.includes('Pricing'), 'homepage nav does not expose pricing as a public primary nav item');
assert(
  homepageNav.some((item) => item.label === 'Beta access' && item.href === '#beta-access'),
  'beta nav item points to beta access section',
);

assert(betaAccessSteps.length === 3, 'public launch surface explains a three-step beta access process');
assert(betaAccessSignals.length === 4, 'public launch surface shows four beta qualification signals');

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const termsPage = readFileSync(new URL('../src/pages/TermsOfService.tsx', import.meta.url), 'utf8');
const faqPage = readFileSync(new URL('../src/pages/FAQ.tsx', import.meta.url), 'utf8');
const footerComponent = readFileSync(new URL('../src/components/Footer.tsx', import.meta.url), 'utf8');
const calendlyHelper = readFileSync(new URL('../src/lib/calendly.ts', import.meta.url), 'utf8');
const publicLaunchFiles = [indexHtml, termsPage, faqPage, ...readPublicTextFiles(new URL('../public/', import.meta.url))].join('\n');

assert(!publicLaunchFiles.includes('https://violema.com/plans'), 'public launch SEO surface does not advertise public plans');
assert(!/\/signup\?next=%2Fplans|href=["']\/plans/.test(publicLaunchFiles), 'public launch pages do not route beta access into public plans');
assert(!/"priceCurrency"\s*:\s*"USD"/.test(publicLaunchFiles), 'public structured data does not imply a published USD offer');
assert(!/Buy top-up|subscription tier|included seats|public package pricing/i.test(publicLaunchFiles), 'public legal and FAQ copy does not expose package mechanics');
assert(indexHtml.includes('https://violema.com/#beta-access'), 'homepage structured data points commercial interest to beta access');
assert(indexHtml.includes('https://assets.calendly.com/assets/external/widget.css'), 'homepage loads Calendly popup widget styles');
assert(indexHtml.includes('https://assets.calendly.com/assets/external/widget.js'), 'homepage loads Calendly popup widget script');
assert(calendlyHelper.includes('https://calendly.com/max-purpleorange/30min'), 'Calendly helper owns the 30-minute consultation URL');
assert(calendlyHelper.includes('calendlyConsultationEvent'), 'Calendly helper opens the in-page scheduling modal');
assert(betaAccessComponent.includes('openCalendlyConsultation'), 'beta setup-call CTA opens Calendly through the modal helper');
assert(!/target="_blank"[\s\S]{0,220}Book setup call/.test(betaAccessComponent), 'beta setup-call CTA does not open Calendly in a new tab by default');
assert(!betaAccessComponent.includes('mailto:sales@purpleorange.io?subject=Violema%20beta%20setup%20call'), 'beta setup-call CTA no longer falls back to sales email');
assert(footerComponent.includes('openCalendlyConsultation'), 'footer sales link opens Calendly through the modal helper');

console.log('publicLaunchSurface.contract: public beta launch posture verified');
