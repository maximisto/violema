import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

/**
 * The Composio connect/disconnect/catalog surface, end to end.
 *
 * The bridge unit suite proves the SDK calls; this file proves the HTTP
 * contract the frontend builds against — that an unknown app never reaches
 * Composio, that a disabled server says so plainly, and that the catalog and
 * readiness responses carry the shape the UI reads.
 *
 * COMPOSIO_API_KEY is force-unset for every case here, so nothing in this file
 * can touch the live API.
 */

type TestServerContext = {
  baseUrl: string;
  sessionToken: string;
  workspaceId: string;
};

function closeServer(server: http.Server | null) {
  if (!server) return Promise.resolve();
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withIntegrationServer(run: (context: TestServerContext) => Promise<void>) {
  const originalCwd = process.cwd();
  const originalApproved = process.env.VIOLEMA_APPROVED_EMAILS;
  const originalDisableScheduler = process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
  const originalComposioKey = process.env.COMPOSIO_API_KEY;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-integration-routes-'));

  process.chdir(tempDir);
  process.env.VIOLEMA_APPROVED_EMAILS = 'qa-integrations@example.com';
  process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = '1';
  // Composio stays off: these assertions must never reach the real API.
  delete process.env.COMPOSIO_API_KEY;

  let server: http.Server | null = null;

  try {
    const serverModule = await import('../src/server');
    const auth = await import('../src/auth');
    const consent = await import('../src/betaConsentStore');
    const betaProgram = await import('../src/betaProgram');
    const acceptedAt = '2026-07-11T12:01:00.000Z';

    consent.recordBetaConsent({
      email: 'qa-integrations@example.com',
      participantType: 'founder_operator',
      termsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      termsDigest: betaProgram.CURRENT_BETA_TERMS_DIGEST,
      acceptedAt,
      authMethod: 'email',
      acceptanceSource: 'signup',
    });

    const user = auth.upsertAuthUser({
      email: 'qa-integrations@example.com',
      name: 'QA Integrations',
      role: 'admin',
      method: 'email',
      participantType: 'founder_operator',
      acceptedTerms: true,
      acceptedTermsVersion: betaProgram.CURRENT_BETA_TERMS_VERSION,
      acceptedTermsAt: acceptedAt,
      acceptedEducation: true,
    });
    const session = auth.createAuthSession(user.id);

    server = await new Promise<http.Server>((resolve) => {
      const listening = serverModule.default.listen(0, () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');

    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      sessionToken: session.token,
      workspaceId: user.defaultWorkspaceId,
    });

    auth.clearAuthSession(session.token);
  } finally {
    await closeServer(server);
    process.chdir(originalCwd);
    if (typeof originalApproved === 'string') process.env.VIOLEMA_APPROVED_EMAILS = originalApproved;
    else delete process.env.VIOLEMA_APPROVED_EMAILS;
    if (typeof originalDisableScheduler === 'string') process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER = originalDisableScheduler;
    else delete process.env.VIOLEMA_DISABLE_AUTOMATION_SCHEDULER;
    if (typeof originalComposioKey === 'string') process.env.COMPOSIO_API_KEY = originalComposioKey;
    else delete process.env.COMPOSIO_API_KEY;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function authedFetch(context: TestServerContext, route: string, init?: RequestInit) {
  return fetch(`${context.baseUrl}${route}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `violema_session=${context.sessionToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

test('integrations catalog exposes the partner section the UI renders', async () => {
  await withIntegrationServer(async (context) => {
    const response = await authedFetch(context, '/api/integrations/catalog');
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      partner: {
        enabled: boolean;
        connectedApps: string[];
        degraded: boolean;
        apps: Array<{ name: string; label: string; status: string; sources: string[] }>;
      };
      partnerApps: unknown[];
    };

    // Composio being off is a known state, not an outage.
    assert.equal(body.partner.enabled, false);
    assert.equal(body.partner.degraded, false);
    assert.deepEqual(body.partner.connectedApps, []);

    const gmail = body.partner.apps.find((app) => app.name === 'gmail');
    assert.ok(gmail, 'gmail must be offered as a partner app');
    assert.equal(gmail.label, 'Gmail');
    assert.deepEqual(gmail.sources, ['email']);

    const notion = body.partner.apps.find((app) => app.name === 'notion');
    assert.ok(notion, 'notion must stay connectable');
    assert.deepEqual(notion.sources, []);

    for (const expected of ['gmail', 'googlecalendar', 'googledrive', 'github', 'linear']) {
      assert.ok(
        body.partner.apps.some((app) => app.name === expected),
        `${expected} must appear in the partner app list`,
      );
    }
    assert.deepEqual(body.partnerApps, body.partner.apps);
  });
});

test('connect rejects an unknown app before it can reach Composio', async () => {
  await withIntegrationServer(async (context) => {
    const response = await authedFetch(context, '/api/integrations/composio/connect', {
      method: 'POST',
      body: JSON.stringify({ appName: 'definitely-not-an-app' }),
    });

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string; validOptions: string[] };
    assert.match(body.error, /not a connectable Violema integration/);
    // A 400 must tell the caller what would have worked.
    assert.ok(body.validOptions.includes('gmail'));
    assert.ok(body.validOptions.includes('email'));
    assert.ok(body.validOptions.includes('google_drive'));
  });
});

test('connect rejects a missing or malformed appName', async () => {
  await withIntegrationServer(async (context) => {
    for (const payload of [{}, { appName: '' }, { appName: 42 }]) {
      const response = await authedFetch(context, '/api/integrations/composio/connect', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 400, `payload ${JSON.stringify(payload)} should be rejected`);
      const body = (await response.json()) as { error: string; validOptions: string[] };
      assert.equal(body.error, 'appName is required');
      assert.ok(body.validOptions.length > 0);
    }
  });
});

test('connect reports 503 for a valid app when Composio is not configured', async () => {
  await withIntegrationServer(async (context) => {
    // A Violema source id, not a toolkit slug — the endpoint accepts both, so
    // reaching the 503 proves the source id resolved.
    const response = await authedFetch(context, '/api/integrations/composio/connect', {
      method: 'POST',
      body: JSON.stringify({ appName: 'email' }),
    });

    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /Composio is not configured/);
  });
});

test('disconnect validates the app and reports 503 when Composio is not configured', async () => {
  await withIntegrationServer(async (context) => {
    const unknown = await authedFetch(context, '/api/integrations/composio/disconnect', {
      method: 'POST',
      body: JSON.stringify({ appName: 'nope' }),
    });
    assert.equal(unknown.status, 400);

    // Punctuated label form resolves the same as the slug.
    const valid = await authedFetch(context, '/api/integrations/composio/disconnect', {
      method: 'POST',
      body: JSON.stringify({ appName: 'Google Drive' }),
    });
    assert.equal(valid.status, 503);
    assert.match(((await valid.json()) as { error: string }).error, /Composio is not configured/);
  });
});

test('integration routes require an approved beta session', async () => {
  await withIntegrationServer(async (context) => {
    for (const route of [
      '/api/integrations/catalog',
      '/api/integrations/composio/connect',
      '/api/integrations/composio/disconnect',
    ]) {
      const isCatalog = route.endsWith('catalog');
      const response = await fetch(`${context.baseUrl}${route}`, {
        method: isCatalog ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(isCatalog ? {} : { body: JSON.stringify({ appName: 'gmail' }) }),
      });
      assert.equal(response.status, 401, `${route} must not be reachable without a session`);
    }
  });
});

/**
 * Swap the Composio bridge's module exports for the duration of one case.
 *
 * There is no seam for injecting a client into the already-imported server, and
 * the only alternative — setting a real COMPOSIO_API_KEY — would make live API
 * calls from the test suite. The bridge's own behaviour is covered by
 * composioBridge.test.ts against a fake adapter; what these cases pin is the
 * route's mapping from bridge result to HTTP status and response body.
 */
/**
 * Integration-connection ledger events for a workspace.
 *
 * `auditLog.ts` resolves its file path once at module load, so every case in
 * this process appends to the same ledger and the workspace id is stable across
 * cases. Assertions therefore work on the delta a case produced, not on an
 * absolute count.
 */
async function readIntegrationLedger(workspaceId: string) {
  const auditLog = await import('../src/integrationGateway/auditLog');
  return auditLog.listWorkflowLedgerEvents({ workspaceId, workflowId: 'integrations' });
}

async function ledgerEventsAddedBy(
  workspaceId: string,
  run: () => Promise<void>,
) {
  const before = (await readIntegrationLedger(workspaceId)).length;
  await run();
  return (await readIntegrationLedger(workspaceId)).slice(before);
}

async function withBridgeStub(
  stub: Partial<typeof import('../src/composioBridge')>,
  run: () => Promise<void>,
) {
  const bridge = await import('../src/composioBridge');
  const originals = Object.fromEntries(
    Object.keys(stub).map((key) => [key, (bridge as Record<string, unknown>)[key]]),
  );
  Object.assign(bridge, stub);
  try {
    await run();
  } finally {
    Object.assign(bridge, originals);
  }
}

test('connect returns the redirect, the toolkit, and a server-derived callback URL', async () => {
  await withIntegrationServer(async (context) => {
    const originalOrigin = process.env.APP_PUBLIC_ORIGIN;
    process.env.APP_PUBLIC_ORIGIN = 'https://app.example.test';
    const linkCalls: Array<{ appName: string; entityId: string; callbackUrl?: string }> = [];
    let events: Awaited<ReturnType<typeof readIntegrationLedger>> = [];

    try {
      events = await ledgerEventsAddedBy(context.workspaceId, () =>
        withBridgeStub(
          {
            isComposioEnabled: () => true,
            startComposioConnection: async (appName, ctx, options) => {
              linkCalls.push({
                appName,
                entityId: ctx.entityId,
                callbackUrl: options?.callbackUrl,
              });
              return {
                redirectUrl: 'https://auth.composio.test/gmail',
                connectionRequestId: 'conn_req_9',
              };
            },
          },
          async () => {
            const response = await authedFetch(context, '/api/integrations/composio/connect', {
              method: 'POST',
              // Source id in, toolkit slug out.
              body: JSON.stringify({ appName: 'email' }),
            });

            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), {
              redirectUrl: 'https://auth.composio.test/gmail',
              toolkit: 'gmail',
              connectionRequestId: 'conn_req_9',
            });
          },
        ),
      );
    } finally {
      if (typeof originalOrigin === 'string') process.env.APP_PUBLIC_ORIGIN = originalOrigin;
      else delete process.env.APP_PUBLIC_ORIGIN;
    }

    assert.deepEqual(linkCalls, [
      {
        appName: 'gmail',
        entityId: context.workspaceId,
        // Built from APP_PUBLIC_ORIGIN, never from a request header. No status
        // param: Composio appends the real outcome to this URL itself.
        callbackUrl: 'https://app.example.test/integrations?connected=gmail',
      },
    ]);

    // The initiated connection is visible in the workspace ledger, without
    // leaking the redirect URL or any token.
    assert.equal(events.length, 1);
    assert.equal(events[0].summary, 'Started a gmail connection.');
    assert.deepEqual(events[0].metadata, {
      toolkit: 'gmail',
      action: 'connect_initiated',
      actorEmail: 'qa-integrations@example.com',
    });
    assert.doesNotMatch(JSON.stringify(events[0]), /auth\.composio\.test|conn_req_9/);
  });
});

test('connect reports a bad gateway when Composio returns no redirect', async () => {
  await withIntegrationServer(async (context) => {
    const events = await ledgerEventsAddedBy(context.workspaceId, () =>
      withBridgeStub(
        {
          isComposioEnabled: () => true,
          startComposioConnection: async () => ({ redirectUrl: null }),
        },
        async () => {
          const response = await authedFetch(context, '/api/integrations/composio/connect', {
            method: 'POST',
            body: JSON.stringify({ appName: 'gmail' }),
          });
          assert.equal(response.status, 502);
        },
      ),
    );

    // Nothing started, so nothing is claimed in the ledger.
    assert.deepEqual(events, []);
  });
});

test('disconnect removes an active connection and records it', async () => {
  await withIntegrationServer(async (context) => {
    const disconnectCalls: Array<{ appName: string; entityId: string }> = [];

    const events = await ledgerEventsAddedBy(context.workspaceId, () =>
      withBridgeStub(
        {
          isComposioEnabled: () => true,
          disconnectComposioApp: async (appName, ctx) => {
            disconnectCalls.push({ appName, entityId: ctx.entityId });
            return { status: 'disconnected', toolkit: 'googledrive', removed: 2 };
          },
        },
        async () => {
          const response = await authedFetch(context, '/api/integrations/composio/disconnect', {
            method: 'POST',
            body: JSON.stringify({ appName: 'google_drive' }),
          });

          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), {
            ok: true,
            toolkit: 'googledrive',
            removed: 2,
          });
        },
      ),
    );

    assert.deepEqual(disconnectCalls, [
      { appName: 'googledrive', entityId: context.workspaceId },
    ]);
    assert.equal(events.length, 1);
    assert.equal(events[0].summary, 'Disconnected googledrive.');
    assert.deepEqual(events[0].metadata, {
      toolkit: 'googledrive',
      action: 'disconnected',
      actorEmail: 'qa-integrations@example.com',
    });
  });
});

test('disconnect answers 404 when the workspace has no such connection', async () => {
  await withIntegrationServer(async (context) => {
    const events = await ledgerEventsAddedBy(context.workspaceId, () =>
      withBridgeStub(
        {
          isComposioEnabled: () => true,
          disconnectComposioApp: async () => ({ status: 'not_connected', toolkit: 'linear' }),
        },
        async () => {
          const response = await authedFetch(context, '/api/integrations/composio/disconnect', {
            method: 'POST',
            body: JSON.stringify({ appName: 'linear' }),
          });

          assert.equal(response.status, 404);
          const body = (await response.json()) as { error: string; toolkit: string };
          assert.equal(body.toolkit, 'linear');
          assert.match(body.error, /No active linear connection/);
        },
      ),
    );

    // A 404 is not a disconnect — the ledger must not claim one happened.
    assert.deepEqual(events, []);
  });
});

test('disconnect answers 502 when Composio itself fails', async () => {
  await withIntegrationServer(async (context) => {
    await withBridgeStub(
      {
        isComposioEnabled: () => true,
        disconnectComposioApp: async () => ({
          status: 'failed',
          toolkit: 'github',
          message: 'composio upstream 503',
        }),
      },
      async () => {
        const response = await authedFetch(context, '/api/integrations/composio/disconnect', {
          method: 'POST',
          body: JSON.stringify({ appName: 'github' }),
        });

        assert.equal(response.status, 502);
        // The upstream message is not echoed back to the client.
        assert.doesNotMatch(JSON.stringify(await response.json()), /upstream 503/);
      },
    );
  });
});

test('catalog reports degraded when the Composio lookup fails', async () => {
  await withIntegrationServer(async (context) => {
    await withBridgeStub(
      {
        isComposioEnabled: () => true,
        listConnectedAppsDetailed: async () => ({ apps: [], ok: false }),
      },
      async () => {
        const response = await authedFetch(context, '/api/integrations/catalog');
        const body = (await response.json()) as {
          partner: { enabled: boolean; degraded: boolean; connectedApps: string[] };
        };

        assert.equal(body.partner.enabled, true);
        // Enabled but unreadable — the UI must not render this as "nothing connected".
        assert.equal(body.partner.degraded, true);
        assert.deepEqual(body.partner.connectedApps, []);
      },
    );
  });
});

test('catalog surfaces connected toolkits as normalized slugs', async () => {
  await withIntegrationServer(async (context) => {
    await withBridgeStub(
      {
        isComposioEnabled: () => true,
        listConnectedAppsDetailed: async () => ({
          apps: ['GMAIL', 'googlecalendar', 'gmail'],
          ok: true,
        }),
      },
      async () => {
        const response = await authedFetch(context, '/api/integrations/catalog');
        const body = (await response.json()) as {
          partner: { degraded: boolean; connectedApps: string[] };
        };

        assert.equal(body.partner.degraded, false);
        assert.deepEqual(body.partner.connectedApps, ['gmail', 'googlecalendar']);
      },
    );
  });
});

test('readiness reports degraded and still blocks when Composio cannot be reached', async () => {
  await withIntegrationServer(async (context) => {
    await withBridgeStub(
      {
        isComposioEnabled: () => true,
        listConnectedAppsDetailed: async () => ({ apps: [], ok: false }),
      },
      async () => {
        const response = await authedFetch(context, '/api/workflows/weekly-founder-update/readiness');
        const body = (await response.json()) as {
          ok: boolean;
          degraded: boolean;
          report: { ready: boolean };
        };

        assert.equal(body.ok, true);
        assert.equal(body.degraded, true);
        // Degraded is a disclosure, not a bypass: the run gate still fails closed.
        assert.equal(body.report.ready, false);
      },
    );
  });
});

test('readiness sees connected partner apps as ready', async () => {
  await withIntegrationServer(async (context) => {
    await withBridgeStub(
      {
        isComposioEnabled: () => true,
        listConnectedAppsDetailed: async () => ({
          apps: ['gmail', 'googlecalendar', 'googledrive', 'linear', 'github'],
          ok: true,
        }),
      },
      async () => {
        const response = await authedFetch(context, '/api/workflows/weekly-founder-update/readiness');
        const body = (await response.json()) as {
          degraded: boolean;
          report: { blockers: Array<{ key: string }>; warnings: Array<{ key: string }> };
        };

        assert.equal(body.degraded, false);
        const blockerKeys = body.report.blockers.map((blocker) => blocker.key);
        for (const connected of ['email', 'calendar', 'linear', 'github']) {
          assert.ok(!blockerKeys.includes(connected), `${connected} should no longer block`);
        }
        // Drive is optional, so connecting it clears the warning too.
        assert.ok(!body.report.warnings.some((warning) => warning.key === 'google_drive'));
        // Native server-side integrations are unaffected by Composio.
        assert.ok(blockerKeys.includes('slack'));
      },
    );
  });
});

test('readiness builds a runtime status for every workflow, not just the founder update', async () => {
  await withIntegrationServer(async (context) => {
    for (const workflowId of ['weekly-founder-update', 'revenue-watch', 'custom-workflow-42']) {
      const response = await authedFetch(context, `/api/workflows/${workflowId}/readiness`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        ok: boolean;
        degraded: boolean;
        report: { workflowId: string; workspaceId: string; ready: boolean };
      };

      assert.equal(body.ok, true);
      // Composio being off is a known state, not an outage.
      assert.equal(body.degraded, false, `${workflowId} should not report degraded`);
      assert.equal(body.report.workflowId, workflowId);
      assert.equal(body.report.workspaceId, context.workspaceId);
    }
  });
});

test('readiness still fails closed on partner integrations that are not connected', async () => {
  await withIntegrationServer(async (context) => {
    const response = await authedFetch(context, '/api/workflows/weekly-founder-update/readiness');
    const body = (await response.json()) as {
      report: { ready: boolean; blockers: Array<{ key: string; detail: string }> };
    };

    assert.equal(body.report.ready, false);
    const blockerKeys = body.report.blockers.map((blocker) => blocker.key);
    for (const expected of ['email', 'calendar', 'linear', 'github']) {
      assert.ok(blockerKeys.includes(expected), `${expected} must block an unconnected workspace`);
    }
    const email = body.report.blockers.find((blocker) => blocker.key === 'email');
    assert.equal(email?.detail, 'Gmail is not connected to this workspace.');
  });
});

// ── Connect-surface additions ─────────────────────────────────────────────────
//
// The HTTP contract the connect UI is built against. Composio stays off for all
// of these, which is the honest "nothing connected, nothing pending" baseline.

test('catalog carries capability, pending and library sections', async () => {
  await withIntegrationServer(async (context) => {
    const response = await authedFetch(context, '/api/integrations/catalog');
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      partner: { capabilities: unknown[]; pending: unknown[]; connectedApps: string[] };
      library: { provisioned: boolean; status: string };
    };

    // Present and empty rather than absent: the UI can render the sections
    // without existence checks, and empty here genuinely means "none".
    assert.deepEqual(body.partner.capabilities, []);
    assert.deepEqual(body.partner.pending, []);
    assert.deepEqual(body.partner.connectedApps, []);

    // Drive is not connected, so the library was never inspected. `unknown` is
    // the truthful status — not `not_provisioned`, which would invite a
    // provision the workspace cannot complete.
    assert.equal(body.library.provisioned, false);
    assert.equal(body.library.status, 'unknown');
  });
});

test('cancel-pending validates the app before it can reach Composio', async () => {
  await withIntegrationServer(async (context) => {
    const unknownApp = await authedFetch(context, '/api/integrations/composio/cancel-pending', {
      method: 'POST',
      body: JSON.stringify({ appName: 'definitely-not-an-app' }),
    });
    assert.equal(unknownApp.status, 400);
    const body = (await unknownApp.json()) as { error: string; validOptions: string[] };
    assert.match(body.error, /not a connectable Violema integration/);
    assert.ok(body.validOptions.includes('google_drive'));

    // A known app with Composio switched off is a configuration fact, and must
    // not be reported as a failed cancellation.
    const disabled = await authedFetch(context, '/api/integrations/composio/cancel-pending', {
      method: 'POST',
      body: JSON.stringify({ appName: 'google_drive' }),
    });
    assert.equal(disabled.status, 503);
  });
});

test('the slack channel picker degrades honestly instead of returning a fake list', async () => {
  await withIntegrationServer(async (context) => {
    const response = await authedFetch(context, '/api/integrations/slack/channels');
    // 200 with `ok:false`: "Slack is not connected" is an answer, not a server
    // error, and a 5xx would read as "Violema is broken".
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; code?: string; channels?: unknown[] };

    assert.equal(body.ok, false);
    assert.ok(
      ['slack_not_connected', 'slack_not_configured', 'slack_lookup_unavailable'].includes(
        String(body.code),
      ),
      `unexpected failure code: ${body.code}`,
    );
    // Above all: no invented channels.
    assert.equal(body.channels, undefined);
  });
});

test('library provisioning refuses before touching Drive when Composio is off', async () => {
  await withIntegrationServer(async (context) => {
    const response = await authedFetch(context, '/api/integrations/library/provision', {
      method: 'POST',
    });
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /Composio is not configured/);
  });
});

test('the new connect-surface routes require a session', async () => {
  await withIntegrationServer(async (context) => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/integrations/slack/channels'],
      ['POST', '/api/integrations/composio/cancel-pending'],
      ['POST', '/api/integrations/library/provision'],
    ];

    for (const [method, route] of routes) {
      const response = await fetch(`${context.baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ appName: 'google_drive' }) } : {}),
      });
      assert.equal(response.status, 401, `${method} ${route} must require a session`);
    }
  });
});
