import assert from 'node:assert/strict';
import test from 'node:test';

test('integration catalog exposes workflow-ready public metadata without env keys', async () => {
  const registry = await import('../src/integrationRegistry');

  const catalog = registry.buildIntegrationCatalog({
    partnerEnabled: false,
    connectedPartnerApps: ['github'],
  });

  assert.equal(catalog.readiness.headline, 'Workflow readiness, not connector setup');
  assert.equal(catalog.partner.enabled, false);
  assert.equal(catalog.partner.connectedApps[0], 'github');
  assert.ok(catalog.partnerApps.some((app) => app.name === 'github'));
  assert.ok(catalog.providers.some((provider) => provider.id === 'stripe'));

  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /COMPOSIO_API_KEY/);
  assert.doesNotMatch(serialized, /GITHUB_TOKEN/);
  assert.doesNotMatch(serialized, /STRIPE_SECRET_KEY/);
});

test('integration registry remains the credential field source of truth', async () => {
  const registry = await import('../src/integrationRegistry');

  assert.deepEqual(registry.getIntegrationFields('github'), ['token']);
  assert.deepEqual(registry.getIntegrationFields('linear'), ['apiKey']);
  assert.deepEqual(registry.getIntegrationEnvKeys('stripe', 'secretKey'), ['STRIPE_SECRET_KEY']);
  assert.equal(registry.isIntegrationProvider('hubspot'), true);
  assert.equal(registry.isIntegrationProvider('slack'), false);
});

test('integration catalog exposes Google Workspace as separate provider surfaces', async () => {
  const registry = await import('../src/integrationRegistry');

  const catalog = registry.buildIntegrationCatalog({
    partnerEnabled: true,
    connectedPartnerApps: ['gmail'],
  });

  assert.equal(registry.isIntegrationProvider('gmail'), true);
  assert.equal(registry.isIntegrationProvider('google_calendar'), true);
  assert.equal(registry.isIntegrationProvider('google_drive'), true);
  assert.deepEqual(registry.getIntegrationFields('gmail'), []);
  assert.deepEqual(registry.getIntegrationFields('google_calendar'), []);
  assert.deepEqual(registry.getIntegrationFields('google_drive'), []);

  const gmail = catalog.providers.find((provider) => provider.id === 'gmail');
  const calendar = catalog.providers.find((provider) => provider.id === 'google_calendar');
  const drive = catalog.providers.find((provider) => provider.id === 'google_drive');

  assert.equal(gmail?.connectionMethod, 'partner');
  assert.equal(calendar?.connectionMethod, 'partner');
  assert.equal(drive?.connectionMethod, 'partner');
  assert.ok(catalog.partnerApps.some((app) => app.name === 'gmail'));
  assert.ok(catalog.partnerApps.some((app) => app.name === 'google_calendar'));
  assert.ok(catalog.partnerApps.some((app) => app.name === 'google_drive'));

  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /GMAIL_/);
  assert.doesNotMatch(serialized, /GOOGLE_/);
});
