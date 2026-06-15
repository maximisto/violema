import { resolveIntegrationLogo } from '../src/content/integrationLogos';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const brandNames = ['Slack', 'Stripe', 'GitHub', 'Gmail', 'Google Drive', 'Notion', 'HubSpot'];

brandNames.forEach((name) => {
  const logo = resolveIntegrationLogo(name);
  if (logo.kind !== 'brand') {
    throw new Error(`${name} should use a real monochrome brand glyph`);
  }
  assert(logo.path.length > 80, `${name} should expose a reusable SVG path`);
});

assert(resolveIntegrationLogo('slack').kind === 'brand', 'brand lookup should be case-insensitive');
assert(resolveIntegrationLogo('google-calendar').kind === 'app', 'Google Calendar should use an app icon fallback');
assert(resolveIntegrationLogo('Google Calendar').icon === 'calendar', 'Google Calendar should use a calendar icon');
assert(resolveIntegrationLogo('Outlook').icon === 'mail', 'Outlook should use a mail icon until a brand glyph is added');
assert(resolveIntegrationLogo('Microsoft Teams').icon === 'team', 'Teams should use a team icon until a brand glyph is added');
assert(resolveIntegrationLogo('Web search').icon === 'search', 'Web search should use a search icon');
assert(resolveIntegrationLogo('Browser screenshots').icon === 'browser', 'Browser screenshots should use a browser icon');
assert(resolveIntegrationLogo('Custom MCP tools').icon === 'mcp', 'MCP should use a connector icon');
assert(resolveIntegrationLogo('Violema Web').kind === 'initial', 'Violema Web should use the Violema app initial');
assert(resolveIntegrationLogo('Unknown private system').label === 'U', 'unknown systems should fall back to a single initial');
