import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { safeUrlFetch, type SafeUrlFetchLookup } from '../src/integrationGateway/safeUrlFetch';
import { ingestUrlIntoLibrary } from '../src/integrationGateway/librarySweep';
import type { PartnerComposioExecutor } from '../src/integrationGateway/adapters/partnerComposio';

// --- local http server harness -------------------------------------------------

interface TestServer {
  url: string;
  close: () => Promise<void>;
}

function startServer(handler: http.RequestListener): Promise<TestServer> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

// --- fake DNS lookups ------------------------------------------------------------

const PUBLIC_ADDRESS = { address: '93.184.216.34', family: 4 };

/** Always answers "public" — for scenarios where the real transport is loopback but the guard must not know that. */
function alwaysPublicLookup(): SafeUrlFetchLookup {
  return async () => [PUBLIC_ADDRESS];
}

/** Answers one fixed address for every call, regardless of the requested host. */
function fixedAddressLookup(address: string, family: number): SafeUrlFetchLookup {
  return async () => [{ address, family }];
}

/** Answers from a queue, one entry per call (last entry repeats once exhausted). */
function sequenceLookup(
  answers: Array<Array<{ address: string; family: number }>>,
): SafeUrlFetchLookup {
  let index = 0;
  return async () => {
    const answer = answers[Math.min(index, answers.length - 1)];
    index += 1;
    return answer;
  };
}

// --- fake Composio Drive executor (for ingestUrlIntoLibrary) --------------------

interface RecordedCall {
  actionName: string;
  input: Record<string, unknown>;
}

function createDriveFake() {
  const calls: RecordedCall[] = [];
  let nextId = 1;

  const execute: PartnerComposioExecutor = async (actionName, input) => {
    calls.push({ actionName, input: input as Record<string, unknown> });

    if (actionName === 'GOOGLEDRIVE_FIND_FILE') {
      // Fresh workspace: nothing exists yet, so every lookup — folder or
      // file — comes back empty and every caller falls through to create.
      return { successful: true, data: { files: [] } };
    }
    if (actionName === 'GOOGLEDRIVE_CREATE_FOLDER') {
      return { successful: true, data: { id: `folder_${nextId++}`, name: String(input.name) } };
    }
    if (actionName === 'GOOGLEDRIVE_CREATE_FILE_FROM_TEXT') {
      return { successful: true, data: { id: `file_${nextId++}`, name: String(input.file_name) } };
    }
    return { successful: false, error: `test fixture: unexpected action ${actionName}` };
  };

  return { execute, calls };
}

// --- safeUrlFetch: scheme allow-list --------------------------------------------

test('safeUrlFetch refuses ftp:// as invalid_url', async () => {
  const result = await safeUrlFetch('ftp://example.com/file.txt');
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, 'invalid_url');
});

test('safeUrlFetch refuses javascript: as invalid_url', async () => {
  const result = await safeUrlFetch('javascript:alert(1)');
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, 'invalid_url');
});

// --- safeUrlFetch: every private/loopback/link-local/ULA family is blocked -----

const blockedAddressCases: Array<{ label: string; address: string; family: number }> = [
  { label: 'loopback 127.0.0.1', address: '127.0.0.1', family: 4 },
  { label: 'private 10.1.2.3', address: '10.1.2.3', family: 4 },
  { label: 'private 172.16.0.1', address: '172.16.0.1', family: 4 },
  { label: 'private 192.168.1.1', address: '192.168.1.1', family: 4 },
  { label: 'link-local 169.254.169.254', address: '169.254.169.254', family: 4 },
  { label: 'loopback ::1', address: '::1', family: 6 },
  { label: 'ULA fd00::1', address: 'fd00::1', family: 6 },
];

for (const testCase of blockedAddressCases) {
  test(`safeUrlFetch refuses a host resolving to ${testCase.label}`, async () => {
    const lookup = fixedAddressLookup(testCase.address, testCase.family);
    const result = await safeUrlFetch('http://blocked.example.test/', { lookup });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'blocked_address');
  });
}

// --- safeUrlFetch: redirect-to-private trap -------------------------------------

test('safeUrlFetch refuses a public-resolving hop that redirects to a private address', async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(302, { Location: 'http://127.0.0.1/' });
    res.end();
  });

  try {
    // Hop 1 "resolves publicly" (lied, since the real transport is loopback);
    // hop 2 — the redirect target — resolves to what it actually is: loopback.
    const lookup = sequenceLookup([[PUBLIC_ADDRESS], [{ address: '127.0.0.1', family: 4 }]]);
    const result = await safeUrlFetch(`${server.url}/start`, { lookup });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'blocked_address');
  } finally {
    await server.close();
  }
});

// --- safeUrlFetch: redirect depth cap --------------------------------------------

test('safeUrlFetch refuses a chain of four redirects as too_many_redirects', async () => {
  const chain: Record<string, string | null> = {
    '/r0': '/r1',
    '/r1': '/r2',
    '/r2': '/r3',
    '/r3': '/r4',
    '/r4': null,
  };
  const server = await startServer((req, res) => {
    const next = chain[req.url ?? ''];
    if (next) {
      res.writeHead(302, { Location: next });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('reached the end — should never be seen by the assertion below');
  });

  try {
    const result = await safeUrlFetch(`${server.url}/r0`, { lookup: alwaysPublicLookup() });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'too_many_redirects');
  } finally {
    await server.close();
  }
});

// --- safeUrlFetch: body size cap --------------------------------------------------

test('safeUrlFetch refuses a body that streams past maxBytes as too_large', async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('a'.repeat(2_000));
    res.write('b'.repeat(2_000));
    res.end();
  });

  try {
    const result = await safeUrlFetch(`${server.url}/big`, {
      lookup: alwaysPublicLookup(),
      maxBytes: 500,
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, 'too_large');
  } finally {
    await server.close();
  }
});

// --- safeUrlFetch: happy path sanity (not in the brief's list, but cheap insurance) --

test('safeUrlFetch returns the body for a plain public-resolving 200', async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>hello</body></html>');
  });

  try {
    const result = await safeUrlFetch(`${server.url}/`, { lookup: alwaysPublicLookup() });
    assert.equal(result.ok, true);
    assert.ok(result.ok && result.body.includes('hello'));
  } finally {
    await server.close();
  }
});

// --- ingestUrlIntoLibrary: happy path --------------------------------------------

test('ingestUrlIntoLibrary strips markup/scripts and writes a dated Sources entry', async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<html><head><title>Beandjinn pricing</title></head><body><script>evil()</script>' +
        '<p>Espresso subscriptions from $49.</p></body></html>',
    );
  });

  const drive = createDriveFake();
  const fetchUrl = (url: string, options?: Parameters<typeof safeUrlFetch>[1]) =>
    safeUrlFetch(url, { ...options, lookup: alwaysPublicLookup() });

  try {
    const result = await ingestUrlIntoLibrary(
      { workspaceId: 'ws_test', url: `${server.url}/pricing` },
      { execute: drive.execute, fetchUrl },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.sourceUrl, `${server.url}/pricing`);
    assert.match(result.fileName, /^\d{4}-\d{2}-\d{2}/);
    assert.match(result.fileName, /Beandjinn pricing/);

    const writeCall = drive.calls.find((call) => call.actionName === 'GOOGLEDRIVE_CREATE_FILE_FROM_TEXT');
    assert.ok(writeCall, 'expected a GOOGLEDRIVE_CREATE_FILE_FROM_TEXT call');
    const text = String(writeCall?.input.text_content ?? '');
    assert.match(text, /source_url:/);
    assert.match(text, /Espresso subscriptions/);
    assert.doesNotMatch(text, /evil\(\)/);
  } finally {
    await server.close();
  }
});

test('ingestUrlIntoLibrary maps a blocked address to fetch_blocked without writing', async () => {
  const drive = createDriveFake();
  const fetchUrl = (url: string, options?: Parameters<typeof safeUrlFetch>[1]) =>
    safeUrlFetch(url, { ...options, lookup: fixedAddressLookup('127.0.0.1', 4) });

  const result = await ingestUrlIntoLibrary(
    { workspaceId: 'ws_test', url: 'http://internal.example.test/' },
    { execute: drive.execute, fetchUrl },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'fetch_blocked');
  assert.equal(drive.calls.length, 0);
});

test('ingestUrlIntoLibrary maps an unparseable URL to invalid_url without fetching', async () => {
  const drive = createDriveFake();
  let fetchCalled = false;
  const fetchUrl: typeof safeUrlFetch = async () => {
    fetchCalled = true;
    return safeUrlFetch('not a url');
  };

  const result = await ingestUrlIntoLibrary(
    { workspaceId: 'ws_test', url: 'not a url' },
    { execute: drive.execute, fetchUrl },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'invalid_url');
  assert.equal(fetchCalled, false);
});
