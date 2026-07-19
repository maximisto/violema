import { existsSync, readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const contentUrl = new URL('../src/content/demoIntegrations.ts', import.meta.url);
const pageUrl = new URL('../src/pages/IntegrationsPage.tsx', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);

assert(existsSync(contentUrl), 'demo integrations source of truth exists');

const content = readFileSync(contentUrl, 'utf8');
const page = readFileSync(pageUrl, 'utf8');
const packageJson = JSON.parse(readFileSync(packageUrl, 'utf8'));
const activeSection = content
  .split('export const DEMO_INTEGRATIONS')[1]
  ?.split('export const IDENTITY_INTEGRATIONS')[0] || '';
const identitySection = content
  .split('export const IDENTITY_INTEGRATIONS')[1]
  ?.split('export const DEFERRED_INTEGRATIONS')[0] || '';

const activeNames = [
  'Stripe',
  'Gmail',
  'Google Calendar',
  'Google Drive',
  'Linear',
  'GitHub',
  'Web search',
  'Slack',
  'Email',
];

for (const name of activeNames) {
  assert(
    content.includes(`name: '${name}'`),
    `active matrix lists ${name}`,
  );
}

assert(
  (activeSection.match(/status: 'active'/g) || []).length === 9,
  'active matrix contains exactly nine production integrations',
);
assert(
  (activeSection.match(/category: 'Workflow data'/g) || []).length === 7,
  'active matrix contains seven workflow-data integrations',
);
assert(
  (activeSection.match(/category: 'Delivery'/g) || []).length === 2,
  'active matrix contains two delivery integrations',
);
assert(
  identitySection.includes("name: 'Google sign-in'") &&
    identitySection.includes("name: 'Microsoft sign-in'") &&
    (identitySection.match(/category: 'Identity'/g) || []).length === 2,
  'identity providers are listed separately from the nine demo integrations',
);

const deferredSection = content.split('export const DEFERRED_INTEGRATIONS')[1] || '';
for (const name of ['Notion', 'HubSpot', 'Airtable', 'Figma', 'Vercel', 'Microsoft Teams']) {
  assert(
    deferredSection.includes(`name: '${name}'`),
    `deferred matrix lists ${name}`,
  );
}
assert(
  !deferredSection.includes("status: 'active'"),
  'no deferred integration is marked Active',
);

assert(
  page.includes("import { DEMO_INTEGRATIONS, IDENTITY_INTEGRATIONS, DEFERRED_INTEGRATIONS }"),
  'public page imports the verified integration source of truth',
);
assert(
  page.includes('DEMO_INTEGRATIONS.map'),
  'public page renders every verified integration',
);
assert(
  page.includes('>Active<'),
  'public page renders an Active badge',
);
assert(
  !page.includes('NATIVE_NOW') && !page.includes('NEXT_UP'),
  'legacy availability lists are removed',
);
assert(
  !page.toLowerCase().includes('sample-data') &&
    !page.toLowerCase().includes('sample data'),
  'public integration page does not advertise simulated workflows',
);
assert(
  packageJson.scripts?.['test:integrations'] === 'node tests/demoIntegrations.contract.mjs',
  'frontend exposes the integrations claims contract',
);

console.log('demoIntegrations.contract: nine active integrations and deferred claims verified');
