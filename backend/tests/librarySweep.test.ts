import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test, beforeEach } from 'node:test';

import { MAX_ENTRY_CONTENT_BYTES } from '../src/integrationGateway/accountLibrary';
import {
  MAX_OPERATOR_FILES_PER_SWEEP,
  SWEEP_MEMO_MAX_ENTRIES,
  SWEEP_MEMO_TTL_MS,
  LibrarySweepError,
  clearSweepMemoForTests,
  getFolderDropLaneState,
  getFolderDropReaderEmail,
  setLibrarySweepOverridesForTests,
  sweepOperatorFiles,
} from '../src/integrationGateway/librarySweep';
import {
  createDriveReader,
  DRIVE_READER_MAX_DOWNLOAD_BYTES,
  DriveReaderError,
  type DriveFileMeta,
  type DriveReader,
  type DriveReaderFetch,
} from '../src/integrationGateway/adapters/nativeDriveReader';
import type { PartnerComposioExecutor } from '../src/integrationGateway/adapters/partnerComposio';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const ROOT_ID = 'root-folder';
const SECTION_ID = 'section-a';

// --- fakes -------------------------------------------------------------------

interface FakeReaderOptions {
  tree: DriveFileMeta[];
  fileContents?: Record<string, Buffer>;
  docExports?: Record<string, string>;
  listError?: Error;
}

function createFakeReader(options: FakeReaderOptions) {
  const downloadCalls: string[] = [];
  const exportCalls: string[] = [];

  const reader: DriveReader = {
    async listFolderTree() {
      if (options.listError) throw options.listError;
      return options.tree;
    },
    async downloadFile(fileId: string) {
      downloadCalls.push(fileId);
      const content = options.fileContents?.[fileId];
      if (!content) throw new Error(`test fixture: no download content registered for ${fileId}`);
      return content;
    },
    async exportDoc(fileId: string) {
      exportCalls.push(fileId);
      const text = options.docExports?.[fileId];
      if (text === undefined) throw new Error(`test fixture: no export text registered for ${fileId}`);
      return text;
    },
  };

  return { reader, downloadCalls, exportCalls };
}

interface ComposioPage {
  files: Array<{ id: string; name: string }>;
  nextPageToken?: string;
}

/** Fake GOOGLEDRIVE_FIND_FILE executor: pages are served per-folder, in order, by the `q` clause's leading `'<folderId>' in parents`. */
function createComposioFake(pagesByFolder: Record<string, ComposioPage[]>) {
  const calls: Array<{ actionName: string; input: Record<string, unknown> }> = [];
  const pageIndex: Record<string, number> = {};

  const execute: PartnerComposioExecutor = async (actionName, input) => {
    calls.push({ actionName, input });
    if (actionName !== 'GOOGLEDRIVE_FIND_FILE') {
      throw new Error(`test fixture: unexpected Composio action ${actionName}`);
    }
    const q = String(input.q ?? '');
    const folderId = /^'([^']+)' in parents/.exec(q)?.[1];
    const pages = folderId ? pagesByFolder[folderId] : undefined;
    if (!pages) return { successful: true, data: { files: [] } };

    const idx = pageIndex[folderId as string] ?? 0;
    pageIndex[folderId as string] = idx + 1;
    const page = pages[idx];
    if (!page) return { successful: true, data: { files: [] } };

    return {
      successful: true,
      data: { files: page.files, ...(page.nextPageToken ? { nextPageToken: page.nextPageToken } : {}) },
    };
  };

  return { execute, calls };
}

/** A Composio executor whose Nth overall call rejects. */
function createFailingComposioFake(failOnCallIndex: number) {
  const calls: Array<{ actionName: string; input: Record<string, unknown> }> = [];
  let callCount = 0;

  const execute: PartnerComposioExecutor = async (actionName, input) => {
    calls.push({ actionName, input });
    callCount += 1;
    if (callCount === failOnCallIndex) {
      throw new Error('composio outage');
    }
    const q = String(input.q ?? '');
    if (!q.includes(`'${SECTION_ID}' in parents`)) {
      return { successful: true, data: { files: [] } };
    }
    return { successful: true, data: { files: [], nextPageToken: 'section-a-page-2' } };
  };

  return { execute, calls };
}

/** The tree shared by the discriminator, unsupported/oversized, and google-doc tests. */
function buildScenarioTree(): DriveFileMeta[] {
  return [
    { id: SECTION_ID, name: 'Section A', mimeType: FOLDER_MIME },
    {
      id: 'op-pdf-1',
      name: 'operator-notes.pdf',
      mimeType: 'application/pdf',
      size: 1200,
      modifiedTime: '2026-08-01T00:00:00.000Z',
      md5Checksum: 'md5-pdf-1',
    },
    {
      id: 'op-md-1',
      name: 'operator-notes.md',
      mimeType: 'text/markdown',
      size: 40,
      modifiedTime: '2026-08-02T00:00:00.000Z',
      md5Checksum: 'md5-md-1',
    },
    // Same extension as op-md-1, but this one is Composio-visible (app-created).
    {
      id: 'shared-md-1',
      name: 'app-created.md',
      mimeType: 'text/markdown',
      size: 40,
      modifiedTime: '2026-08-03T00:00:00.000Z',
    },
    {
      id: 'img-1',
      name: 'diagram.png',
      mimeType: 'image/png',
      size: 500,
      modifiedTime: '2026-08-04T00:00:00.000Z',
    },
    {
      id: 'big-pdf-1',
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      size: 6_000_000,
      modifiedTime: '2026-08-05T00:00:00.000Z',
    },
    {
      id: 'gdoc-1',
      name: 'Strategy Doc',
      mimeType: GOOGLE_DOC_MIME,
      modifiedTime: '2026-08-06T00:00:00.000Z',
    },
  ];
}

function buildScenarioComposioPages(): Record<string, ComposioPage[]> {
  return {
    [ROOT_ID]: [{ files: [] }],
    [SECTION_ID]: [
      { files: [], nextPageToken: 'section-a-page-2' },
      { files: [{ id: 'shared-md-1', name: 'app-created.md' }] },
    ],
  };
}

beforeEach(() => {
  clearSweepMemoForTests();
  setLibrarySweepOverridesForTests(null);
});

// --- discriminator -------------------------------------------------------------

test('set difference: Composio-visible files are never operator files, even .md', async () => {
  const { reader } = createFakeReader({
    tree: buildScenarioTree(),
    fileContents: { 'op-pdf-1': Buffer.from('not a real pdf'), 'op-md-1': Buffer.from('operator markdown body') },
    docExports: { 'gdoc-1': 'Exported strategy text.' },
  });
  const { execute } = createComposioFake(buildScenarioComposioPages());

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute },
  );

  const ids = result.entries.map((entry) => entry.fileId);
  assert.ok(ids.includes('op-pdf-1'), 'operator pdf must be classified as an operator file');
  assert.ok(ids.includes('op-md-1'), 'operator markdown must be classified as an operator file');
  assert.ok(!ids.includes('shared-md-1'), 'Composio-visible .md must never be treated as an operator file');
  assert.ok(!ids.includes(SECTION_ID), 'folders must never appear as entries');
});

// --- pagination + failure -------------------------------------------------------

test('Composio listing paginates to completeness; failure mid-listing throws LibrarySweepError', async () => {
  // Happy path: the section folder's listing needs two pages, and the sweep
  // must make exactly one call for root + two for section-a (three total).
  const { reader } = createFakeReader({
    tree: buildScenarioTree(),
    fileContents: { 'op-pdf-1': Buffer.from('x'), 'op-md-1': Buffer.from('y') },
    docExports: { 'gdoc-1': 'z' },
  });
  const { execute, calls } = createComposioFake(buildScenarioComposioPages());

  await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute },
  );

  assert.equal(calls.length, 3, 'root (1 page) + section-a (2 pages) = 3 Composio calls');

  // Failure path: the executor rejects on its 3rd overall call (root, then
  // section-a page 1, then section-a page 2 rejects).
  const { reader: reader2 } = createFakeReader({ tree: buildScenarioTree() });
  const { execute: failingExecute } = createFailingComposioFake(3);

  await assert.rejects(
    sweepOperatorFiles(
      { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
      { reader: reader2, execute: failingExecute },
    ),
    (error: unknown) => {
      if (!(error instanceof LibrarySweepError)) assert.fail('expected a LibrarySweepError');
      assert.equal(error.code, 'listing_failed');
      return true;
    },
  );
});

// --- unsupported / oversized skips -----------------------------------------------

test('unsupported and oversized files are skipped with warnings naming the file', async () => {
  const { reader, downloadCalls } = createFakeReader({
    tree: buildScenarioTree(),
    fileContents: { 'op-pdf-1': Buffer.from('a'), 'op-md-1': Buffer.from('b') },
    docExports: { 'gdoc-1': 'c' },
  });
  const { execute } = createComposioFake(buildScenarioComposioPages());

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute },
  );

  const ids = result.entries.map((entry) => entry.fileId);
  assert.ok(!ids.includes('img-1'), 'unsupported mime must never become an entry');
  assert.ok(!ids.includes('big-pdf-1'), 'oversized file must never become an entry');
  assert.ok(!downloadCalls.includes('img-1'), 'unsupported files must never be downloaded');
  assert.ok(!downloadCalls.includes('big-pdf-1'), 'oversized files must never be downloaded');

  const unsupportedWarning = result.warnings.find((w) => w.includes('diagram.png'));
  assert.ok(unsupportedWarning, 'expected a warning naming diagram.png');
  assert.equal(unsupportedWarning, "Folder drop: 'diagram.png' skipped (unsupported type image/png)");

  // Operators read these warnings, not engineers: "5 MB" is a size a person
  // can act on, "5000000-byte cap" is a number they have to decode.
  const oversizedWarning = result.warnings.find((w) => w.includes('huge.pdf'));
  assert.ok(oversizedWarning, 'expected a warning naming huge.pdf');
  assert.equal(oversizedWarning, "Folder drop: 'huge.pdf' skipped (larger than 5 MB)");
  assert.ok(
    !oversizedWarning?.includes(String(DRIVE_READER_MAX_DOWNLOAD_BYTES)),
    'the raw byte count must not be shown to operators',
  );
});

// --- 20-file cap ------------------------------------------------------------------

test('newest-first cap at 20 with a warning naming the drop count', async () => {
  const files: DriveFileMeta[] = Array.from({ length: 22 }, (_, i) => ({
    id: `many-op-${i}`,
    name: `note-${i}.md`,
    mimeType: 'text/markdown',
    size: 40,
    modifiedTime: new Date(2026, 0, 1 + i).toISOString(),
    md5Checksum: `md5-many-${i}`,
  }));

  const fileContents: Record<string, Buffer> = {};
  for (const file of files) fileContents[file.id] = Buffer.from('note body');

  const { reader } = createFakeReader({ tree: files, fileContents });
  const { execute } = createComposioFake({ [ROOT_ID]: [{ files: [] }] });

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute },
  );

  assert.equal(MAX_OPERATOR_FILES_PER_SWEEP, 20);
  assert.equal(result.entries.length, 20);

  // Newest-first: the two oldest (index 0 and 1) are dropped.
  const entryIds = result.entries.map((e) => e.fileId);
  assert.ok(!entryIds.includes('many-op-0'));
  assert.ok(!entryIds.includes('many-op-1'));
  assert.ok(entryIds.includes('many-op-21'), 'newest file must be kept');

  const capWarning = result.warnings.find((w) => w.includes('20-file cap'));
  assert.equal(
    capWarning,
    'Folder drop: 2 more file(s) were not read this run (20-file cap): note-1.md, note-0.md',
  );
});

// --- google docs ------------------------------------------------------------------

test('google docs go through exportDoc, never downloadFile', async () => {
  const { reader, downloadCalls, exportCalls } = createFakeReader({
    tree: buildScenarioTree(),
    fileContents: { 'op-pdf-1': Buffer.from('a'), 'op-md-1': Buffer.from('b') },
    docExports: { 'gdoc-1': 'Exported strategy document text.' },
  });
  const { execute } = createComposioFake(buildScenarioComposioPages());

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute },
  );

  const gdocEntry = result.entries.find((entry) => entry.fileId === 'gdoc-1');
  assert.ok(gdocEntry, 'expected a Google Doc entry');
  assert.equal(gdocEntry?.content, 'Exported strategy document text.');
  assert.ok(exportCalls.includes('gdoc-1'));
  assert.ok(!downloadCalls.includes('gdoc-1'), 'Google Docs must never go through downloadFile');
});

// --- memo -------------------------------------------------------------------------

test('memo: unchanged fileId+modifiedTime+md5 parses once across two sweeps', async () => {
  const tree: DriveFileMeta[] = [
    {
      id: 'memo-md-1',
      name: 'memo-test.md',
      mimeType: 'text/markdown',
      size: 40,
      modifiedTime: '2026-08-01T00:00:00.000Z',
      md5Checksum: 'memo-md5-1',
    },
  ];
  const { reader, downloadCalls } = createFakeReader({
    tree,
    fileContents: { 'memo-md-1': Buffer.from('Memo content that should be cached.') },
  });

  const first = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute: createComposioFake({ [ROOT_ID]: [{ files: [] }] }).execute },
  );
  assert.equal(downloadCalls.length, 1);
  assert.equal(first.entries[0]?.content, 'Memo content that should be cached.');

  const second = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute: createComposioFake({ [ROOT_ID]: [{ files: [] }] }).execute },
  );
  assert.equal(downloadCalls.length, 1, 'downloadFile must not be called again for an unchanged file');
  assert.equal(second.entries[0]?.content, 'Memo content that should be cached.');

  assert.equal(SWEEP_MEMO_MAX_ENTRIES, 50);
  assert.equal(SWEEP_MEMO_TTL_MS, 15 * 60 * 1000);
});

test('memo re-clamp keeps truncation honest: a once-truncated file never later reports complete', async () => {
  const tree: DriveFileMeta[] = [
    {
      id: 'trunc-md-1',
      name: 'big-notes.md',
      mimeType: 'text/markdown',
      size: 1000,
      modifiedTime: '2026-08-01T00:00:00.000Z',
      md5Checksum: 'trunc-md5-1',
    },
  ];
  const { reader, downloadCalls } = createFakeReader({
    tree,
    fileContents: { 'trunc-md-1': Buffer.from('A'.repeat(1000)) },
  });

  // Sweep #1: a tight per-file budget truncates the file and memoizes the
  // truncated slice with truncated: true.
  const first = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 100 },
    { reader, execute: createComposioFake({ [ROOT_ID]: [{ files: [] }] }).execute },
  );
  assert.equal(downloadCalls.length, 1);
  assert.equal(first.entries[0]?.truncated, true);
  assert.equal(Buffer.byteLength(first.entries[0]?.content ?? '', 'utf8'), 100);

  // Sweep #2: the file is unchanged (same fileId+modifiedTime+md5), but this
  // sweep has a much larger remaining budget. The cached 100-byte slice now
  // fits comfortably under the new ceiling, but it is still only a slice of
  // the real 1000-byte file — the entry must keep reporting truncated: true,
  // and downloadFile must never be called again.
  const second = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader, execute: createComposioFake({ [ROOT_ID]: [{ files: [] }] }).execute },
  );
  assert.equal(downloadCalls.length, 1, 'downloadFile must not be called again on the memo hit');
  assert.equal(
    second.entries[0]?.truncated,
    true,
    'a once-truncated file must never later report complete without an actual re-download',
  );
  assert.equal(Buffer.byteLength(second.entries[0]?.content ?? '', 'utf8'), 100);
});

// --- budget -------------------------------------------------------------------------

test('budget exhaustion leaves a VISIBLE gap, never a silent disappearance', async () => {
  const tree: DriveFileMeta[] = [
    {
      id: 'budget-1',
      name: 'first.md',
      mimeType: 'text/markdown',
      size: 20,
      modifiedTime: '2026-08-02T00:00:00.000Z',
      md5Checksum: 'md5-budget-1',
    },
    {
      id: 'budget-2',
      name: 'second.md',
      mimeType: 'text/markdown',
      size: 20,
      modifiedTime: '2026-08-01T00:00:00.000Z',
      md5Checksum: 'md5-budget-2',
    },
  ];
  const { reader, downloadCalls } = createFakeReader({
    tree,
    fileContents: {
      'budget-1': Buffer.from('X'.repeat(20)),
      'budget-2': Buffer.from('Y'.repeat(20)),
    },
  });
  const { execute } = createComposioFake({ [ROOT_ID]: [{ files: [] }] });

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 20 },
    { reader, execute },
  );

  // Still no wasted download for the file there is no room to read...
  assert.ok(!downloadCalls.includes('budget-2'));

  // ...but it does NOT vanish. The module's own stated policy is that every
  // skip is named, and this was the only one that wasn't.
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0]?.fileId, 'budget-1');
  assert.equal(result.entries[0]?.content, 'X'.repeat(20));

  const starved = result.entries[1];
  assert.equal(starved?.fileId, 'budget-2');
  assert.equal(starved?.content, null);
  assert.equal(starved?.contentError, 'content budget exhausted');
  assert.equal(starved?.truncated, true);
  assert.equal(starved?.fileName, 'second.md', 'the operator must still see the file NAME');

  assert.ok(
    result.warnings.some((warning) => /budget/i.test(warning) && warning.includes('second.md')),
    `expected a warning naming the starved file, got ${JSON.stringify(result.warnings)}`,
  );
});

test('a fat first file cannot monopolize the operator lane', async () => {
  // 12 KB of markdown against a 12 KB budget: without a per-entry ceiling this
  // one file eats the whole lane and every later drop disappears. The
  // per-entry cap is MAX_ENTRY_CONTENT_BYTES (8 KB), the same ceiling the
  // sibling app-entry path in accountLibrary applies.
  const budgetBytes = 12_000;
  const tree: DriveFileMeta[] = [
    {
      id: 'fat-1',
      name: 'fat.md',
      mimeType: 'text/markdown',
      size: budgetBytes,
      modifiedTime: '2026-08-02T00:00:00.000Z',
      md5Checksum: 'md5-fat-1',
    },
    {
      id: 'small-1',
      name: 'small.md',
      mimeType: 'text/markdown',
      size: 30,
      modifiedTime: '2026-08-01T00:00:00.000Z',
      md5Checksum: 'md5-small-1',
    },
  ];
  const { reader, downloadCalls } = createFakeReader({
    tree,
    fileContents: {
      'fat-1': Buffer.from('X'.repeat(budgetBytes)),
      'small-1': Buffer.from('the later drop that must survive'),
    },
  });
  const { execute } = createComposioFake({ [ROOT_ID]: [{ files: [] }] });

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes },
    { reader, execute },
  );

  const fat = result.entries.find((entry) => entry.fileId === 'fat-1');
  assert.ok(fat);
  assert.equal(Buffer.byteLength(String(fat?.content), 'utf8'), MAX_ENTRY_CONTENT_BYTES);
  assert.equal(fat?.truncated, true, 'a clipped file must say so');

  const small = result.entries.find((entry) => entry.fileId === 'small-1');
  assert.ok(small, 'the later file must not be starved by the fat one');
  assert.equal(small?.contentError, undefined);
  assert.match(String(small?.content), /must survive/);
  assert.ok(downloadCalls.includes('small-1'));
});

// --- a broken download must degrade the FILE, never the RUN -------------------------

test('a download stream that dies mid-read yields contentError, and never throws out of the sweep', async () => {
  // The REAL reader, not the fake one: the whole point is that
  // nativeDriveReader's streaming loop converts a raw mid-body failure into a
  // DriveReaderError, which is the only thing resolveFileText knows how to
  // degrade. A raw TypeError/AbortError escaping here would propagate through
  // sweepOperatorFiles → readLibrary → a `critical` library-read step, so one
  // slow dropped PDF would block the entire mission run.
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const fetchImpl: DriveReaderFetch = async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/files/broken-pdf?alt=media')) {
      let pulls = 0;
      const body = new ReadableStream({
        pull(controller) {
          pulls += 1;
          if (pulls === 1) {
            controller.enqueue(new Uint8Array(16));
            return;
          }
          throw new TypeError('terminated');
        },
      });
      return new Response(body, { status: 200 });
    }
    if (url.includes('/files/good-md?alt=media')) {
      return new Response('a healthy operator note', { status: 200 });
    }
    throw new Error(`test fixture: unexpected fetch to ${url}`);
  };

  const reader = createDriveReader(
    { clientEmail: 'reader@test.iam.gserviceaccount.com', privateKey },
    fetchImpl,
  );
  // listFolderTree is not what is under test here; serve the tree directly.
  const tree: DriveFileMeta[] = [
    {
      id: 'broken-pdf',
      name: 'slow.pdf',
      mimeType: 'application/pdf',
      size: 4_000_000,
      modifiedTime: '2026-08-02T00:00:00.000Z',
      md5Checksum: 'md5-broken',
    },
    {
      id: 'good-md',
      name: 'healthy.md',
      mimeType: 'text/markdown',
      size: 40,
      modifiedTime: '2026-08-01T00:00:00.000Z',
      md5Checksum: 'md5-good',
    },
  ];
  const readerWithTree: DriveReader = { ...reader, listFolderTree: async () => tree };
  const { execute } = createComposioFake({ [ROOT_ID]: [{ files: [] }] });

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader: readerWithTree, execute },
  );

  assert.equal(result.laneState, 'active');
  const broken = result.entries.find((entry) => entry.fileId === 'broken-pdf');
  assert.ok(broken, 'the unreadable file must stay VISIBLE as an entry, not vanish');
  assert.equal(broken?.content, null);
  assert.equal(broken?.contentError, 'content unreadable');

  const healthy = result.entries.find((entry) => entry.fileId === 'good-md');
  assert.ok(healthy, 'the healthy file must still be read');
  assert.equal(healthy?.contentError, undefined);
  assert.match(String(healthy?.content), /healthy operator note/);
});

// --- lane state ---------------------------------------------------------------------

test('lane state: null reader → not_configured; reader http_error on root list → needs_share; list ok → active', async () => {
  assert.equal(await getFolderDropLaneState(ROOT_ID, { reader: null }), 'not_configured');

  const failingReader: DriveReader = {
    listFolderTree: async () => {
      throw new DriveReaderError('http_error', 'forbidden', 403);
    },
    downloadFile: async () => {
      throw new Error('unused');
    },
    exportDoc: async () => {
      throw new Error('unused');
    },
  };
  assert.equal(await getFolderDropLaneState(ROOT_ID, { reader: failingReader }), 'needs_share');

  const okReader: DriveReader = {
    listFolderTree: async () => [],
    downloadFile: async () => {
      throw new Error('unused');
    },
    exportDoc: async () => {
      throw new Error('unused');
    },
  };
  assert.equal(await getFolderDropLaneState(ROOT_ID, { reader: okReader }), 'active');
});

test('auth_failed is a platform-side problem, not a share problem: it maps to not_configured', async () => {
  const authFailedReader: DriveReader = {
    listFolderTree: async () => {
      throw new DriveReaderError('auth_failed', 'the platform key could not be used to sign the auth token');
    },
    downloadFile: async () => {
      throw new Error('unused');
    },
    exportDoc: async () => {
      throw new Error('unused');
    },
  };

  assert.equal(
    await getFolderDropLaneState(ROOT_ID, { reader: authFailedReader }),
    'not_configured',
    'a broken platform credential must never tell the operator to re-share their folder',
  );

  const result = await sweepOperatorFiles(
    { workspaceId: 'ws_test', rootFolderId: ROOT_ID, budgetBytes: 1_000_000 },
    { reader: authFailedReader },
  );
  assert.equal(result.laneState, 'not_configured');
  assert.deepEqual(result.entries, []);
});

// --- reader email + test overrides ---------------------------------------------------

test('getFolderDropReaderEmail reflects the configured service-account key', () => {
  const original = process.env.GOOGLE_LIBRARY_READER_KEY;
  try {
    delete process.env.GOOGLE_LIBRARY_READER_KEY;
    assert.equal(getFolderDropReaderEmail(), null);

    process.env.GOOGLE_LIBRARY_READER_KEY = JSON.stringify({
      client_email: 'reader@test.iam.gserviceaccount.com',
      private_key: 'not-a-real-key-but-non-empty',
    });
    assert.equal(getFolderDropReaderEmail(), 'reader@test.iam.gserviceaccount.com');
  } finally {
    if (original === undefined) delete process.env.GOOGLE_LIBRARY_READER_KEY;
    else process.env.GOOGLE_LIBRARY_READER_KEY = original;
  }
});

test('setLibrarySweepOverridesForTests short-circuits lane state and sweep results', async () => {
  const stubbedSweep = { laneState: 'active' as const, entries: [], warnings: ['stubbed'] };
  setLibrarySweepOverridesForTests({ laneState: 'active', sweep: stubbedSweep });
  try {
    assert.equal(await getFolderDropLaneState(null), 'active');
    const result = await sweepOperatorFiles({ workspaceId: 'ws', rootFolderId: 'root', budgetBytes: 100 });
    assert.deepEqual(result, stubbedSweep);
  } finally {
    setLibrarySweepOverridesForTests(null);
  }
});
