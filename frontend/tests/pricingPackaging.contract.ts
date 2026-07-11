import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const billingPage = readFileSync(new URL('../src/pages/Billing.tsx', import.meta.url), 'utf8');
const backendCatalog = readFileSync(new URL('../../backend/src/platform/billing.ts', import.meta.url), 'utf8');

assert(billingPage.includes('Best for 1–3 active missions'), 'Start mission guidance is present');
assert(billingPage.includes('Best for 5–10 active missions'), 'Pro mission guidance is present');
assert(billingPage.includes('Actual run volume depends on mission complexity and credit usage.'), 'workload caveat is present');
assert(!/5 seats|extra seat|Included seats/i.test(billingPage), 'public pricing has no unsupported seat claim');
assert(!/5 included seats|extraSeatPriceUsd:\s*29/.test(backendCatalog), 'backend Pro packaging has no unsupported seat claim');

console.log('pricingPackaging.contract: pricing packaging verified');
