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

test('integration catalog reports which Violema sources each partner app feeds', async () => {
  const registry = await import('../src/integrationRegistry');

  const catalog = registry.buildIntegrationCatalog({ partnerEnabled: true });
  const byName = new Map(catalog.partner.apps.map((app) => [app.name, app]));

  assert.deepEqual(byName.get('gmail')?.sources, ['email']);
  assert.deepEqual(byName.get('googlecalendar')?.sources, ['calendar']);
  assert.deepEqual(byName.get('googledrive')?.sources, ['google_drive']);
  assert.deepEqual(byName.get('github')?.sources, ['github']);
  assert.deepEqual(byName.get('linear')?.sources, ['linear']);
  // Connectable, but no workflow reads from them yet — so no sources, not a guess.
  assert.deepEqual(byName.get('notion')?.sources, []);
  assert.deepEqual(byName.get('hubspot')?.sources, []);

  // The top-level list stays in place for existing clients.
  assert.deepEqual(catalog.partnerApps, catalog.partner.apps);
});

test('integration catalog normalizes connected apps and reports lookup failure as degraded', async () => {
  const registry = await import('../src/integrationRegistry');

  const healthy = registry.buildIntegrationCatalog({
    partnerEnabled: true,
    connectedPartnerApps: ['GMAIL', 'Google Calendar', 'gmail'],
  });
  assert.deepEqual(healthy.partner.connectedApps, ['gmail', 'googlecalendar']);
  assert.equal(healthy.partner.degraded, false);

  // An unreachable Composio must not read as "this workspace connected nothing".
  const degraded = registry.buildIntegrationCatalog({
    partnerEnabled: true,
    connectedPartnerApps: [],
    partnerDegraded: true,
  });
  assert.deepEqual(degraded.partner.connectedApps, []);
  assert.equal(degraded.partner.degraded, true);
  assert.equal(degraded.partner.enabled, true);
});

test('integration registry resolves connect requests by source id, slug, or variant', async () => {
  const registry = await import('../src/integrationRegistry');

  assert.equal(registry.resolvePartnerAppSlug('email'), 'gmail');
  assert.equal(registry.resolvePartnerAppSlug('google_drive'), 'googledrive');
  assert.equal(registry.resolvePartnerAppSlug('Google Calendar'), 'googlecalendar');
  assert.equal(registry.resolvePartnerAppSlug('GitHub'), 'github');
  // Connectable catalog apps outside the workflow-source map still resolve.
  assert.equal(registry.resolvePartnerAppSlug('notion'), 'notion');
  assert.equal(registry.resolvePartnerAppSlug('HubSpot'), 'hubspot');
  // Not connectable through Composio in this catalog.
  assert.equal(registry.resolvePartnerAppSlug('stripe'), null);
  assert.equal(registry.resolvePartnerAppSlug('definitely-not-an-app'), null);
  assert.equal(registry.resolvePartnerAppSlug(''), null);

  const options = registry.listPartnerAppOptions();
  for (const expected of [
    'email',
    'calendar',
    'google_drive',
    'gmail',
    'googlecalendar',
    'googledrive',
    'github',
    'linear',
    'notion',
    'hubspot',
  ]) {
    assert.ok(options.includes(expected), `${expected} should be an accepted option`);
  }
  assert.ok(!options.includes('stripe'));
});

test('Google partner integrations declare no manual credential fields', async () => {
  const registry = await import('../src/integrationRegistry');

  for (const provider of ['gmail', 'googlecalendar', 'googledrive'] as const) {
    const definition = registry.INTEGRATION_DEFINITIONS[provider];
    assert.equal(definition.connectionMethod, 'partner');
    assert.equal(definition.partnerAppName, provider);
    // OAuth-only: there is no token for an operator to paste, so the settings
    // surface must not claim there is one.
    assert.deepEqual(registry.getIntegrationFields(provider), []);
    assert.ok(definition.capabilities.length > 0);
    assert.ok(definition.boundaries.length > 0);
  }
});

test('integration registry remains the credential field source of truth', async () => {
  const registry = await import('../src/integrationRegistry');

  assert.deepEqual(registry.getIntegrationFields('github'), ['token']);
  assert.deepEqual(registry.getIntegrationFields('linear'), ['apiKey']);
  assert.deepEqual(registry.getIntegrationEnvKeys('stripe', 'secretKey'), ['STRIPE_SECRET_KEY']);
  assert.equal(registry.isIntegrationProvider('hubspot'), true);
  // Slack became a connectable provider when tenants gained their own Slack
  // delivery. It is a partner connection, so it must still add no manual
  // credential surface — a tenant never pastes a bot token into Violema.
  assert.equal(registry.isIntegrationProvider('slack'), true);
  assert.deepEqual(registry.getIntegrationFields('slack'), []);
  assert.equal(registry.resolvePartnerAppSlug('slack'), 'slackbot');
  assert.equal(registry.resolvePartnerAppSlug('Slack'), 'slackbot');
  assert.equal(registry.resolvePartnerAppSlug('slackbot'), 'slackbot');
});
