import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authConfigOverrideEnvVar,
  describeAuthConfigChoice,
  selectComposioAuthConfig,
  type ComposioAuthConfigSummary,
} from '../src/composioAuthConfig';

/**
 * The account that produced the production defect this module exists to fix:
 * a custom, read-only Google Drive auth config sorts ahead of the
 * Composio-managed one, so `items[0]` handed every new connection a client that
 * could not read file contents and only admitted allowlisted Google accounts.
 *
 * `credentials` is present because the SDK really does return it on list items
 * (`transformAuthConfigRetrieveResponse` in @composio/core) — the selection and
 * log payloads must never carry it anywhere.
 */
function founderGoogleDriveConfigs(): ComposioAuthConfigSummary[] {
  return [
    {
      id: 'ac_custom_readonly',
      name: 'Google Drive TechChicago Read Only',
      isComposioManaged: false,
      status: 'ENABLED',
      credentials: { client_id: 'SHOULD-NEVER-BE-LOGGED', client_secret: 'SHOULD-NEVER-BE-LOGGED' },
    } as ComposioAuthConfigSummary,
    {
      id: 'ac_managed',
      name: 'googledrive-ksbv93',
      isComposioManaged: true,
      status: 'ENABLED',
    },
  ];
}

/** Run one case against a known override env, leaving the process env as found. */
function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const original = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    original.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of original) {
      if (typeof value === 'string') process.env[key] = value;
      else delete process.env[key];
    }
  }
}

test('the Composio-managed auth config wins even when a custom one sorts first', () => {
  // The exact production defect: items[0] is the custom read-only config.
  const choice = selectComposioAuthConfig('googledrive', founderGoogleDriveConfigs(), {});

  assert.deepEqual(choice, {
    id: 'ac_managed',
    name: 'googledrive-ksbv93',
    managed: true,
    reason: 'composio_managed',
  });
});

test('the SDK camelCase flag and the raw snake_case flag both mark a config managed', () => {
  // The TS SDK maps is_composio_managed -> isComposioManaged. Accepting both
  // means a raw payload can never silently demote a managed config to custom.
  const choice = selectComposioAuthConfig(
    'gmail',
    [
      { id: 'ac_custom', name: 'Custom Gmail', isComposioManaged: false },
      { id: 'ac_managed_raw', name: 'gmail-abc123', is_composio_managed: true },
    ],
    {},
  );

  assert.equal(choice?.id, 'ac_managed_raw');
  assert.equal(choice?.managed, true);
});

test('with no managed config the first available is still used', () => {
  // Preserved so toolkits that only ever have custom configs keep working.
  const choice = selectComposioAuthConfig(
    'hubspot',
    [
      { id: 'ac_custom_1', name: 'Custom HubSpot', isComposioManaged: false },
      { id: 'ac_custom_2', name: 'Another HubSpot', isComposioManaged: false },
    ],
    {},
  );

  assert.deepEqual(choice, {
    id: 'ac_custom_1',
    name: 'Custom HubSpot',
    managed: false,
    reason: 'first_available',
  });
});

test('an empty list selects nothing so the caller creates a managed config', () => {
  assert.equal(selectComposioAuthConfig('linear', [], {}), null);
});

test('the env override pins one auth config by id', () => {
  const choice = selectComposioAuthConfig('googledrive', founderGoogleDriveConfigs(), {
    COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE: 'ac_custom_readonly',
  });

  // An operator escape hatch: it outranks even the managed config.
  assert.deepEqual(choice, {
    id: 'ac_custom_readonly',
    name: 'Google Drive TechChicago Read Only',
    managed: false,
    reason: 'env_override',
  });
});

test('an override id that does not exist fails closed instead of falling back', () => {
  // Silently using a different auth config is exactly the production bug.
  assert.throws(
    () =>
      selectComposioAuthConfig('googledrive', founderGoogleDriveConfigs(), {
        COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE: 'ac_typo',
      }),
    /COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE[\s\S]*ac_typo/,
  );
});

test('an override set against an empty list fails closed rather than creating a config', () => {
  assert.throws(
    () =>
      selectComposioAuthConfig('googledrive', [], {
        COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE: 'ac_missing',
      }),
    /COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE/,
  );
});

test('a blank override is treated as unset rather than as a failure', () => {
  const choice = selectComposioAuthConfig('googledrive', founderGoogleDriveConfigs(), {
    COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE: '   ',
  });

  assert.equal(choice?.id, 'ac_managed');
});

test('the override variable name is derived from the toolkit slug', () => {
  assert.equal(authConfigOverrideEnvVar('googledrive'), 'COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE');
  // Slug separators are not legal in an env var name.
  assert.equal(authConfigOverrideEnvVar('google-calendar'), 'COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR');
  assert.equal(authConfigOverrideEnvVar('google_drive'), 'COMPOSIO_AUTH_CONFIG_GOOGLE_DRIVE');
});

test('selection reads process.env when no environment is injected', () => {
  withEnv({ COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE: 'ac_custom_readonly' }, () => {
    const choice = selectComposioAuthConfig('googledrive', founderGoogleDriveConfigs());
    assert.equal(choice?.id, 'ac_custom_readonly');
    assert.equal(choice?.reason, 'env_override');
  });
});

test('a disabled config loses to an enabled one inside the same tier', () => {
  // A DISABLED auth config cannot open connections, so preferring an enabled
  // sibling only ever reorders candidates — it never removes one.
  const choice = selectComposioAuthConfig(
    'notion',
    [
      { id: 'ac_disabled', name: 'Retired Notion', isComposioManaged: false, status: 'DISABLED' },
      { id: 'ac_enabled', name: 'Live Notion', isComposioManaged: false, status: 'ENABLED' },
    ],
    {},
  );

  assert.equal(choice?.id, 'ac_enabled');
});

test('a disabled managed config still outranks an enabled custom one', () => {
  // Managed remains the dominant term: the verified OAuth app and the toolkit's
  // full default scopes matter more than a status flag an operator can flip back.
  const choice = selectComposioAuthConfig(
    'notion',
    [
      { id: 'ac_custom_live', name: 'Custom Notion', isComposioManaged: false, status: 'ENABLED' },
      { id: 'ac_managed_off', name: 'notion-xyz', isComposioManaged: true, status: 'DISABLED' },
    ],
    {},
  );

  assert.equal(choice?.id, 'ac_managed_off');
});

test('entries without a usable id are skipped rather than linked against', () => {
  const choice = selectComposioAuthConfig(
    'github',
    [{ id: '' } as ComposioAuthConfigSummary, { id: 'ac_real', name: 'GitHub' }],
    {},
  );

  assert.equal(choice?.id, 'ac_real');
});

test('a config with no name reports null rather than inventing one', () => {
  const choice = selectComposioAuthConfig('github', [{ id: 'ac_nameless' }], {});

  assert.deepEqual(choice, {
    id: 'ac_nameless',
    name: null,
    managed: false,
    reason: 'first_available',
  });
});

test('the selection log payload carries ids and names but never credentials', () => {
  const choice = selectComposioAuthConfig('googledrive', founderGoogleDriveConfigs(), {
    COMPOSIO_AUTH_CONFIG_GOOGLEDRIVE: 'ac_custom_readonly',
  });
  assert.ok(choice);

  const payload = describeAuthConfigChoice('googledrive', choice);

  // Enumerated explicitly — the payload is built key by key, never spread from
  // the SDK item, which really does carry `credentials`.
  assert.deepEqual(payload, {
    toolkit: 'googledrive',
    authConfigId: 'ac_custom_readonly',
    authConfigName: 'Google Drive TechChicago Read Only',
    composioManaged: false,
    reason: 'env_override',
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'authConfigId',
    'authConfigName',
    'composioManaged',
    'reason',
    'toolkit',
  ]);
  assert.ok(!JSON.stringify(payload).includes('SHOULD-NEVER-BE-LOGGED'));
});
