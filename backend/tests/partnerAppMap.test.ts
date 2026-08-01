import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PARTNER_SOURCE_IDS,
  PARTNER_TOOLKIT_SLUGS,
  listPartnerConnectOptions,
  normalizeAppName,
  resolvePartnerToolkit,
  sourcesForPartnerToolkit,
  toolkitForPartnerSource,
} from '../src/integrationGateway/partnerAppMap';

test('partner app map resolves Violema source ids to Composio toolkit slugs', () => {
  assert.equal(resolvePartnerToolkit('email'), 'gmail');
  assert.equal(resolvePartnerToolkit('calendar'), 'googlecalendar');
  assert.equal(resolvePartnerToolkit('google_drive'), 'googledrive');
  assert.equal(resolvePartnerToolkit('linear'), 'linear');
  assert.equal(resolvePartnerToolkit('github'), 'github');
});

test('partner app map resolves toolkit slugs to themselves', () => {
  for (const slug of PARTNER_TOOLKIT_SLUGS) {
    assert.equal(resolvePartnerToolkit(slug), slug);
  }
});

test('partner app map tolerates punctuation, spacing, and casing variants', () => {
  assert.equal(resolvePartnerToolkit('GMAIL'), 'gmail');
  assert.equal(resolvePartnerToolkit('  Gmail  '), 'gmail');
  assert.equal(resolvePartnerToolkit('Google Calendar'), 'googlecalendar');
  assert.equal(resolvePartnerToolkit('google-calendar'), 'googlecalendar');
  assert.equal(resolvePartnerToolkit('Google_Drive'), 'googledrive');
  assert.equal(resolvePartnerToolkit('Google Drive'), 'googledrive');
  assert.equal(resolvePartnerToolkit('GitHub'), 'github');
});

test('partner app map returns null for anything it does not own', () => {
  assert.equal(resolvePartnerToolkit('slack'), null);
  assert.equal(resolvePartnerToolkit('stripe'), null);
  assert.equal(resolvePartnerToolkit('notion'), null);
  assert.equal(resolvePartnerToolkit('gmailx'), null);
  assert.equal(resolvePartnerToolkit(''), null);
  assert.equal(resolvePartnerToolkit('   '), null);
  assert.equal(resolvePartnerToolkit(undefined), null);
  assert.equal(resolvePartnerToolkit(null), null);
});

test('partner app map exposes the reverse toolkit to source lookup', () => {
  assert.deepEqual(sourcesForPartnerToolkit('gmail'), ['email']);
  assert.deepEqual(sourcesForPartnerToolkit('googlecalendar'), ['calendar']);
  assert.deepEqual(sourcesForPartnerToolkit('googledrive'), ['google_drive']);
  assert.deepEqual(sourcesForPartnerToolkit('github'), ['github']);
  // Reverse lookup accepts the same loose input as the forward one.
  assert.deepEqual(sourcesForPartnerToolkit('Google Drive'), ['google_drive']);
  // Toolkits Violema does not source workflow data from map to nothing.
  assert.deepEqual(sourcesForPartnerToolkit('notion'), []);
  assert.deepEqual(sourcesForPartnerToolkit('slack'), []);
});

test('partner app map keeps its forward and reverse halves consistent', () => {
  assert.deepEqual(PARTNER_SOURCE_IDS, ['email', 'calendar', 'google_drive', 'linear', 'github']);
  for (const source of PARTNER_SOURCE_IDS) {
    const toolkit = toolkitForPartnerSource(source);
    assert.ok(toolkit, `${source} must map to a toolkit`);
    assert.ok(sourcesForPartnerToolkit(toolkit).includes(source));
  }
  assert.deepEqual(listPartnerConnectOptions(), [
    'calendar',
    'email',
    'github',
    'gmail',
    'google_drive',
    'googlecalendar',
    'googledrive',
    'linear',
  ]);
});

test('normalizeAppName strips everything that is not alphanumeric', () => {
  assert.equal(normalizeAppName('  Google-Calendar  '), 'googlecalendar');
  assert.equal(normalizeAppName('google_drive'), 'googledrive');
  assert.equal(normalizeAppName('!!!'), '');
});
