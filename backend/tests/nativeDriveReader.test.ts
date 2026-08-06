import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createDriveReader,
  DriveReaderError,
  DRIVE_READER_MAX_DOWNLOAD_BYTES,
  DRIVE_READER_MAX_LIST_PAGES,
  readDriveReaderConfig,
  type DriveReaderFetch,
} from '../src/integrationGateway/adapters/nativeDriveReader';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

function decodeBase64Url(segment: string): Buffer {
  return Buffer.from(segment, 'base64url');
}

function generateTestKeypair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// --- readDriveReaderConfig -------------------------------------------------

test('readDriveReaderConfig: inline key wins over file path; file path read from disk; absent/malformed -> null', () => {
  const { privateKey } = generateTestKeypair();
  const clientEmail = 'inline-reader@test.iam.gserviceaccount.com';
  const fileClientEmail = 'file-reader@test.iam.gserviceaccount.com';

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'violema-native-drive-reader-'));
  const keyFilePath = path.join(tempDir, 'reader-key.json');
  fs.writeFileSync(keyFilePath, JSON.stringify({ client_email: fileClientEmail, private_key: privateKey }));

  try {
    // Inline wins over file path when both are present.
    const both = readDriveReaderConfig({
      GOOGLE_LIBRARY_READER_KEY: JSON.stringify({ client_email: clientEmail, private_key: privateKey }),
      GOOGLE_LIBRARY_READER_KEY_FILE: keyFilePath,
    } as unknown as NodeJS.ProcessEnv);
    assert.ok(both);
    assert.equal(both?.clientEmail, clientEmail);
    assert.equal(both?.privateKey, privateKey);

    // File path is read from disk when inline is absent.
    const fileOnly = readDriveReaderConfig({
      GOOGLE_LIBRARY_READER_KEY_FILE: keyFilePath,
    } as unknown as NodeJS.ProcessEnv);
    assert.ok(fileOnly);
    assert.equal(fileOnly?.clientEmail, fileClientEmail);
    assert.equal(fileOnly?.privateKey, privateKey);

    // Escaped \n sequences arriving through env JSON are normalized to real newlines.
    const escapedKey = privateKey.replace(/\n/g, '\\n');
    const escaped = readDriveReaderConfig({
      GOOGLE_LIBRARY_READER_KEY: JSON.stringify({ client_email: clientEmail, private_key: escapedKey }),
    } as unknown as NodeJS.ProcessEnv);
    assert.ok(escaped);
    assert.equal(escaped?.privateKey, privateKey);

    // Absent -> null.
    assert.equal(readDriveReaderConfig({} as NodeJS.ProcessEnv), null);

    // Malformed inline JSON -> null, never throws.
    assert.equal(
      readDriveReaderConfig({ GOOGLE_LIBRARY_READER_KEY: '{not json' } as unknown as NodeJS.ProcessEnv),
      null,
    );

    // Inline JSON missing required fields -> null.
    assert.equal(
      readDriveReaderConfig({
        GOOGLE_LIBRARY_READER_KEY: JSON.stringify({ client_email: clientEmail }),
      } as unknown as NodeJS.ProcessEnv),
      null,
    );

    // File path pointing at a nonexistent file -> null, never throws.
    assert.equal(
      readDriveReaderConfig({
        GOOGLE_LIBRARY_READER_KEY_FILE: path.join(tempDir, 'does-not-exist.json'),
      } as unknown as NodeJS.ProcessEnv),
      null,
    );

    // File contents that are malformed JSON -> null.
    const badFilePath = path.join(tempDir, 'bad-key.json');
    fs.writeFileSync(badFilePath, 'not json at all');
    assert.equal(
      readDriveReaderConfig({ GOOGLE_LIBRARY_READER_KEY_FILE: badFilePath } as unknown as NodeJS.ProcessEnv),
      null,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// --- token exchange + caching ----------------------------------------------

test('token request is a valid RS256 JWT for drive.readonly and is cached across calls', async () => {
  const { publicKey, privateKey } = generateTestKeypair();
  const clientEmail = 'token-jwt-reader@test.iam.gserviceaccount.com';

  let tokenCallCount = 0;
  let listCallCount = 0;

  const fetchImpl: DriveReaderFetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === TOKEN_URL) {
      tokenCallCount += 1;
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');

      const assertion = body.get('assertion');
      assert.ok(assertion);
      const [headerSeg, claimsSeg, sigSeg] = (assertion as string).split('.');

      const header = JSON.parse(decodeBase64Url(headerSeg).toString('utf-8'));
      assert.deepEqual(header, { alg: 'RS256', typ: 'JWT' });

      const claims = JSON.parse(decodeBase64Url(claimsSeg).toString('utf-8'));
      assert.equal(claims.iss, clientEmail);
      assert.equal(claims.scope, DRIVE_SCOPE);
      assert.equal(claims.aud, TOKEN_URL);
      assert.equal(claims.exp - claims.iat, 3600);

      const signingInput = `${headerSeg}.${claimsSeg}`;
      const verified = crypto.verify(
        'RSA-SHA256',
        Buffer.from(signingInput),
        publicKey,
        decodeBase64Url(sigSeg),
      );
      assert.equal(verified, true);

      return jsonResponse({ access_token: 'tok', expires_in: 3600 });
    }

    if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      listCallCount += 1;
      assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer tok');
      return jsonResponse({ files: [] });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  };

  const reader = createDriveReader({ clientEmail, privateKey }, fetchImpl);

  await reader.listFolderTree('root-folder-1');
  await reader.listFolderTree('root-folder-1');

  assert.equal(tokenCallCount, 1);
  assert.equal(listCallCount, 2);
});

// --- listFolderTree pagination + recursion ----------------------------------

test('listFolderTree paginates and recurses but never fetches more than 3 pages', async () => {
  const { privateKey } = generateTestKeypair();
  const clientEmail = 'pagination-reader@test.iam.gserviceaccount.com';

  const rootId = 'root-folder-id';
  const subId = 'sub-folder-id';

  const fileA = { id: 'file-a', name: 'A.txt', mimeType: 'text/plain' };
  const subfolderEntry = { id: subId, name: 'Sub', mimeType: 'application/vnd.google-apps.folder' };
  const fileB = { id: 'file-b', name: 'B.txt', mimeType: 'text/plain' };
  const fileC = { id: 'file-c', name: 'C.txt', mimeType: 'text/plain' };
  const fileD = { id: 'file-d', name: 'D.txt', mimeType: 'text/plain' };

  let listCallCount = 0;
  const seenRequests: string[] = [];

  const fetchImpl: DriveReaderFetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === TOKEN_URL) {
      return jsonResponse({ access_token: 'tok', expires_in: 3600 });
    }

    if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      listCallCount += 1;
      const parsed = new URL(url);
      const q = parsed.searchParams.get('q') || '';
      const pageToken = parsed.searchParams.get('pageToken');
      const folderMatch = q.match(/^'([^']+)' in parents/);
      const folderId = folderMatch?.[1];
      seenRequests.push(`${folderId}:${pageToken || 'first'}`);

      if (folderId === rootId && !pageToken) {
        return jsonResponse({ files: [fileA, subfolderEntry], nextPageToken: 'root-p2' });
      }
      if (folderId === rootId && pageToken === 'root-p2') {
        return jsonResponse({ files: [fileB] });
      }
      if (folderId === subId && !pageToken) {
        return jsonResponse({ files: [fileC], nextPageToken: 'sub-p2' });
      }
      if (folderId === subId && pageToken === 'sub-p2') {
        return jsonResponse({ files: [fileD] });
      }
      throw new Error(`Unexpected files.list request: folder=${folderId} pageToken=${pageToken}`);
    }

    throw new Error(`Unexpected fetch to ${url}`);
  };

  const reader = createDriveReader({ clientEmail, privateKey }, fetchImpl);
  const results = await reader.listFolderTree(rootId);

  assert.equal(DRIVE_READER_MAX_LIST_PAGES, 3);
  assert.equal(listCallCount, 3);
  assert.deepEqual(seenRequests, [`${rootId}:first`, `${rootId}:root-p2`, `${subId}:first`]);

  const resultIds = results.map((file) => file.id);
  assert.deepEqual(resultIds, [fileA.id, subfolderEntry.id, fileB.id, fileC.id]);
  assert.ok(!resultIds.includes(fileD.id), 'sub-p2 must never be fetched once the page cap is hit');
});

// --- downloadFile size guard -------------------------------------------------

test('downloadFile refuses oversized content with DriveReaderError too_large', async () => {
  const { privateKey } = generateTestKeypair();
  const clientEmail = 'download-reader@test.iam.gserviceaccount.com';
  const fileId = 'huge-file-id';

  const fetchImpl: DriveReaderFetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === TOKEN_URL) {
      return jsonResponse({ access_token: 'tok', expires_in: 3600 });
    }

    if (url === `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`) {
      // A body that blows up if anything ever tries to read it — proves the
      // Content-Length check short-circuits before any buffering happens.
      const throwingBody = new ReadableStream({
        pull() {
          throw new Error('body must never be read once Content-Length exceeds the cap');
        },
      });
      return new Response(throwingBody, {
        status: 200,
        headers: { 'content-length': '6000000' },
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  };

  const reader = createDriveReader({ clientEmail, privateKey }, fetchImpl);

  await assert.rejects(
    reader.downloadFile(fileId),
    (error: unknown) => {
      if (!(error instanceof DriveReaderError)) assert.fail('expected a DriveReaderError');
      assert.equal(error.code, 'too_large');
      assert.ok(!error.message.includes(privateKey));
      return true;
    },
  );

  assert.ok(DRIVE_READER_MAX_DOWNLOAD_BYTES < 6_000_000);
});

// --- exportDoc ----------------------------------------------------------------

test('exportDoc returns the exported plain text', async () => {
  const { privateKey } = generateTestKeypair();
  const clientEmail = 'export-reader@test.iam.gserviceaccount.com';
  const fileId = 'doc-file-id';

  const fetchImpl: DriveReaderFetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === TOKEN_URL) {
      return jsonResponse({ access_token: 'tok', expires_in: 3600 });
    }

    if (url === `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text%2Fplain`) {
      return new Response('Hello from a Google Doc export.', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  };

  const reader = createDriveReader({ clientEmail, privateKey }, fetchImpl);
  const text = await reader.exportDoc(fileId);

  assert.equal(text, 'Hello from a Google Doc export.');
});

// --- error safety ---------------------------------------------------------

test('errors never contain the private key', async () => {
  const { privateKey } = generateTestKeypair();
  const clientEmail = 'error-safety-reader@test.iam.gserviceaccount.com';

  const fetchImpl: DriveReaderFetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url === TOKEN_URL) {
      return new Response('server exploded', { status: 500 });
    }

    throw new Error(`Unexpected fetch to ${url}`);
  };

  const reader = createDriveReader({ clientEmail, privateKey }, fetchImpl);

  await assert.rejects(
    reader.listFolderTree('some-folder'),
    (error: unknown) => {
      if (!(error instanceof DriveReaderError)) assert.fail('expected a DriveReaderError');
      assert.equal(error.code, 'auth_failed');
      assert.ok(!error.message.includes(privateKey));
      assert.ok(!(error.stack || '').includes(privateKey));
      // Also guard against a leaked key body fragment (in case of partial normalization bugs).
      const keyBodyLine = privateKey.split('\n')[1] || '';
      if (keyBodyLine) {
        assert.ok(!error.message.includes(keyBodyLine));
        assert.ok(!(error.stack || '').includes(keyBodyLine));
      }
      return true;
    },
  );
});
