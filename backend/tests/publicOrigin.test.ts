import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPartnerConnectCallbackUrl, resolvePublicOrigin } from '../src/publicOrigin';

function withEnv(
  values: { APP_PUBLIC_ORIGIN?: string; NODE_ENV?: string },
  run: () => void,
) {
  const original = {
    APP_PUBLIC_ORIGIN: process.env.APP_PUBLIC_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (typeof value === 'string') process.env[key] = value;
      else delete process.env[key];
    }
  }
}

test('public origin prefers explicit configuration', () => {
  withEnv({ APP_PUBLIC_ORIGIN: 'https://staging.violema.com', NODE_ENV: 'production' }, () => {
    assert.equal(resolvePublicOrigin(), 'https://staging.violema.com');
  });
});

test('public origin trims a configured trailing slash', () => {
  withEnv({ APP_PUBLIC_ORIGIN: 'https://staging.violema.com///' }, () => {
    assert.equal(resolvePublicOrigin(), 'https://staging.violema.com');
  });
  withEnv({ APP_PUBLIC_ORIGIN: '  https://staging.violema.com/  ' }, () => {
    assert.equal(resolvePublicOrigin(), 'https://staging.violema.com');
  });
});

test('public origin falls back per environment when unconfigured', () => {
  withEnv({ APP_PUBLIC_ORIGIN: undefined, NODE_ENV: 'production' }, () => {
    assert.equal(resolvePublicOrigin(), 'https://violema.com');
  });
  withEnv({ APP_PUBLIC_ORIGIN: undefined, NODE_ENV: 'development' }, () => {
    assert.equal(resolvePublicOrigin(), 'http://localhost:5173');
  });
  withEnv({ APP_PUBLIC_ORIGIN: '   ', NODE_ENV: 'test' }, () => {
    // Blank is not configuration.
    assert.equal(resolvePublicOrigin(), 'http://localhost:5173');
  });
});

test('the partner callback URL is built from the configured origin', () => {
  withEnv({ APP_PUBLIC_ORIGIN: 'https://app.example.test' }, () => {
    assert.equal(
      buildPartnerConnectCallbackUrl('gmail'),
      'https://app.example.test/integrations?connected=gmail',
    );
  });
});

test('the partner callback URL never pre-seeds a status Composio will append', () => {
  withEnv({ APP_PUBLIC_ORIGIN: 'https://app.example.test' }, () => {
    // Composio appends `status=success` or `status=failed` itself. Shipping our
    // own would make a failed connection arrive as `status=success&status=failed`.
    const url = new URL(buildPartnerConnectCallbackUrl('gmail'));
    assert.deepEqual(url.searchParams.getAll('status'), []);
    assert.deepEqual(url.searchParams.getAll('connected'), ['gmail']);
  });
});

test('the partner callback URL escapes the toolkit it carries', () => {
  withEnv({ APP_PUBLIC_ORIGIN: 'https://app.example.test' }, () => {
    // Defence in depth: callers already resolve against a fixed slug list, but
    // the URL must not become injectable if that ever changes.
    assert.equal(
      buildPartnerConnectCallbackUrl('evil&status=hacked'),
      'https://app.example.test/integrations?connected=evil%26status%3Dhacked',
    );
    // The escaped payload stays a value, never a second `status` param.
    assert.deepEqual(
      new URL(buildPartnerConnectCallbackUrl('evil&status=hacked')).searchParams.getAll('status'),
      [],
    );
  });
});
