import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPartnerCapabilityReport,
  describeToolkitCapability,
  hasCapability,
  PARTNER_CAPABILITIES,
  PARTNER_FEATURES,
} from '../src/integrationGateway/partnerCapability';
import { readGrantedScopes } from '../src/composioBridge';
import type { ComposioConnectionRecord } from '../src/composioBridge';

/**
 * Capability derivation, pinned to the real tenant state that broke.
 *
 * Pure functions over synthetic connection records — no Composio client, no
 * network, no files, no cwd games. The scope strings here are the actual OAuth
 * scopes the providers issue, so a change in the ladder fails loudly.
 */

function connection(patch: Partial<ComposioConnectionRecord>): ComposioConnectionRecord {
  return {
    id: 'ca_synthetic',
    toolkit: 'googledrive',
    status: 'ACTIVE',
    grantedScopes: [],
    ...patch,
  };
}

// ── Scope extraction ──────────────────────────────────────────────────────────

test('granted scopes are read from both the SDK and raw-wire shapes', () => {
  // SDK-normalised: space-delimited string on `state.scope` (Google).
  assert.deepEqual(
    readGrantedScopes({
      status: 'ACTIVE',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
    }),
    [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  );

  // Raw REST wire nests credentials under `state.val` — the shape the Composio
  // dashboard shows for Slack.
  assert.deepEqual(
    readGrantedScopes({ val: { scope: 'chat:write,channels:read' } }),
    ['chat:write', 'channels:read'],
  );

  // Slack reports the user grant separately; both are unioned.
  assert.deepEqual(
    readGrantedScopes({ scope: 'chat:write', authed_user: { scope: 'channels:read' } }),
    ['chat:write', 'channels:read'],
  );

  // Array form.
  assert.deepEqual(readGrantedScopes({ scope: ['chat:write'] }), ['chat:write']);
});

test('a connection with no scope field reports null, never an empty grant', () => {
  // This is the distinction the whole module rests on: `null` means "cannot
  // tell", `[]` would mean "granted nothing" and would wrongly accuse the
  // customer of a misconfigured connection.
  assert.equal(readGrantedScopes({ status: 'ACTIVE', access_token: 'redacted' }), null);
  assert.equal(readGrantedScopes(undefined), null);
  assert.equal(readGrantedScopes(null), null);
  assert.deepEqual(readGrantedScopes({ scope: '' }), []);
});

test('scope extraction never copies credentials out of the state blob', () => {
  // `state` carries live secrets beside `scope`. Only scope strings may escape.
  const scopes = readGrantedScopes({
    status: 'ACTIVE',
    scope: 'chat:write',
    access_token: 'xoxb-SYNTHETIC-NOT-REAL',
    refresh_token: 'xoxr-SYNTHETIC-NOT-REAL',
    api_key: 'SYNTHETIC',
    proxy_password: 'SYNTHETIC',
  });

  assert.deepEqual(scopes, ['chat:write']);
  const serialized = JSON.stringify(scopes);
  for (const secret of ['xoxb-', 'xoxr-', 'api_key', 'proxy_password', 'SYNTHETIC']) {
    assert.equal(serialized.includes(secret), false, `scope output leaked ${secret}`);
  }
});

// ── Drive: the incident ───────────────────────────────────────────────────────

test('Drive with only drive.metadata.readonly is connected but cannot write the library', () => {
  // The exact tenant state: the UI said "connected", the library write failed
  // at run time, and nothing before this told anyone why.
  const report = describeToolkitCapability('googledrive', [
    connection({ grantedScopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'] }),
  ]);

  // `assert.deepEqual` carries an `asserts actual is T` signature, so the
  // variable it is called on is narrowed to the literal tuple from that point
  // on. Each assertion therefore gets its own widened binding.
  const capabilities: string[] = [...report.capabilities];
  const missing: string[] = [...report.missing];
  const sufficientFor: string[] = [...report.sufficientFor];

  assert.equal(report.connected, true);
  assert.equal(report.scopeVisibility, 'granted');
  // The library write is the capability the mission actually needed.
  assert.equal(sufficientFor.includes(PARTNER_FEATURES.LIBRARY_WRITE), false);
  assert.equal(sufficientFor.includes(PARTNER_FEATURES.DRIVE_EVIDENCE), true);
  assert.equal(sufficientFor.length, 1);
  assert.deepEqual(capabilities, [PARTNER_CAPABILITIES.DRIVE_METADATA]);
  assert.deepEqual(missing, [PARTNER_CAPABILITIES.DRIVE_READ, PARTNER_CAPABILITIES.DRIVE_WRITE]);
});

test('Drive with drive.file can write the library', () => {
  const report = describeToolkitCapability('googledrive', [
    connection({ grantedScopes: ['https://www.googleapis.com/auth/drive.file'] }),
  ]);

  const missing: string[] = [...report.missing];
  assert.deepEqual(missing, []);
  assert.equal(report.sufficientFor.includes(PARTNER_FEATURES.LIBRARY_WRITE), true);
  assert.equal(report.sufficientFor.includes(PARTNER_FEATURES.LIBRARY_READ), true);
});

test('Drive with drive.readonly can read but still cannot write', () => {
  const report = describeToolkitCapability('googledrive', [
    connection({ grantedScopes: ['https://www.googleapis.com/auth/drive.readonly'] }),
  ]);

  const capabilities: string[] = [...report.capabilities];
  const missing: string[] = [...report.missing];

  assert.deepEqual(capabilities, [
    PARTNER_CAPABILITIES.DRIVE_METADATA,
    PARTNER_CAPABILITIES.DRIVE_READ,
  ]);
  assert.deepEqual(missing, [PARTNER_CAPABILITIES.DRIVE_WRITE]);
  assert.equal(report.sufficientFor.includes(PARTNER_FEATURES.LIBRARY_WRITE), false);
});

test('several Drive connections union their scopes', () => {
  const report = describeToolkitCapability('googledrive', [
    connection({ id: 'ca_a', grantedScopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'] }),
    connection({ id: 'ca_b', grantedScopes: ['https://www.googleapis.com/auth/drive.file'] }),
  ]);

  assert.equal(report.sufficientFor.includes(PARTNER_FEATURES.LIBRARY_WRITE), true);
});

// ── Slack ─────────────────────────────────────────────────────────────────────

test('Slack distinguishes "can post" from merely connected', () => {
  const cannotPost = describeToolkitCapability('slackbot', [
    connection({ toolkit: 'slackbot', grantedScopes: ['channels:read'] }),
  ]);
  assert.equal(cannotPost.connected, true);
  assert.equal(cannotPost.capabilities.includes(PARTNER_CAPABILITIES.SLACK_POST), false);
  assert.equal(cannotPost.sufficientFor.includes(PARTNER_FEATURES.SLACK_DELIVERY), false);
  assert.equal(cannotPost.sufficientFor.includes(PARTNER_FEATURES.SLACK_CHANNEL_PICKER), true);

  const canPost = describeToolkitCapability('slackbot', [
    connection({ toolkit: 'slackbot', grantedScopes: ['chat:write', 'channels:read'] }),
  ]);
  assert.equal(canPost.sufficientFor.includes(PARTNER_FEATURES.SLACK_DELIVERY), true);
});

test('branded delivery requires chat:write.customize on top of chat:write', () => {
  const plain = describeToolkitCapability('slackbot', [
    connection({ toolkit: 'slackbot', grantedScopes: ['chat:write'] }),
  ]);
  assert.equal(plain.sufficientFor.includes(PARTNER_FEATURES.SLACK_DELIVERY), true);
  assert.equal(plain.sufficientFor.includes(PARTNER_FEATURES.SLACK_BRANDED_DELIVERY), false);
  assert.equal(plain.missing.includes(PARTNER_CAPABILITIES.SLACK_CUSTOMIZE_IDENTITY), true);

  const branded = describeToolkitCapability('slackbot', [
    connection({ toolkit: 'slackbot', grantedScopes: ['chat:write', 'chat:write.customize'] }),
  ]);
  assert.equal(branded.sufficientFor.includes(PARTNER_FEATURES.SLACK_BRANDED_DELIVERY), true);
});

// ── Honest degradation ────────────────────────────────────────────────────────

test('a connection that hides its scopes reports unknown, not a fabricated verdict', () => {
  const report = describeToolkitCapability('googledrive', [
    connection({ grantedScopes: null }),
  ]);

  assert.equal(report.connected, true);
  assert.equal(report.scopeVisibility, 'unknown');
  // Crucially all three are empty: we assert neither capability nor absence.
  assert.deepEqual(report.capabilities, []);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.sufficientFor, []);
});

test('hasCapability separates "no" from "cannot tell"', () => {
  const known = buildPartnerCapabilityReport([
    connection({ grantedScopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'] }),
  ]);
  assert.equal(hasCapability(known, 'googledrive', PARTNER_CAPABILITIES.DRIVE_WRITE), 'no');

  const opaque = buildPartnerCapabilityReport([connection({ grantedScopes: null })]);
  assert.equal(hasCapability(opaque, 'googledrive', PARTNER_CAPABILITIES.DRIVE_WRITE), 'unknown');

  const absent = buildPartnerCapabilityReport([]);
  assert.equal(hasCapability(absent, 'googledrive', PARTNER_CAPABILITIES.DRIVE_WRITE), 'no');
});

// ── Lifecycle: pending and expired ────────────────────────────────────────────

test('EXPIRED, FAILED, INACTIVE and REVOKED all count as not connected', () => {
  for (const status of ['EXPIRED', 'FAILED', 'INACTIVE', 'REVOKED'] as const) {
    const report = buildPartnerCapabilityReport([
      connection({ status, grantedScopes: ['https://www.googleapis.com/auth/drive'] }),
    ]);
    assert.deepEqual(report.connectedApps, [], `${status} must not count as connected`);
    assert.deepEqual(report.capabilities, []);
    assert.deepEqual(report.pending, [], `${status} is dead, not pending`);
  }
});

test('abandoned OAuth tabs surface as pending with their initiation time', () => {
  // The tenant left two Drive consent tabs. Both sat INITIATED forever and the
  // UI showed nothing, so a retry just added a third.
  const report = buildPartnerCapabilityReport([
    connection({
      id: 'ca_pending_one',
      status: 'INITIATED',
      createdAt: '2099-01-01T10:00:00.000Z',
      grantedScopes: null,
    }),
    connection({
      id: 'ca_pending_two',
      status: 'INITIATED',
      createdAt: '2099-01-01T10:05:00.000Z',
      grantedScopes: null,
    }),
    connection({ id: 'ca_live', status: 'ACTIVE', grantedScopes: ['https://www.googleapis.com/auth/drive.file'] }),
  ]);

  assert.deepEqual(report.pending, [
    { slug: 'googledrive', initiatedAt: '2099-01-01T10:00:00.000Z', connectionRequestId: 'ca_pending_one' },
    { slug: 'googledrive', initiatedAt: '2099-01-01T10:05:00.000Z', connectionRequestId: 'ca_pending_two' },
  ]);

  // A stranded attempt must not suppress the working connection beside it.
  assert.deepEqual(report.connectedApps, ['googledrive']);
  assert.equal(report.capabilities[0].sufficientFor.includes(PARTNER_FEATURES.LIBRARY_WRITE), true);
});

test('INITIALIZING is pending too — it is an unfinished flow either way', () => {
  const report = buildPartnerCapabilityReport([
    connection({ id: 'ca_init', toolkit: 'slackbot', status: 'INITIALIZING', grantedScopes: null }),
  ]);
  assert.equal(report.pending.length, 1);
  assert.equal(report.pending[0].slug, 'slackbot');
});
