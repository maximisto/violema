// Evidence-link contract.
//
// Field observation, 2026-08-05 (maximus Loom prep): the review pane's
// Evidence cards rendered their source as plain text, so a URL a reviewer
// should be able to open — the whole point of inspectable evidence — was
// dead text on screen.
//
// Four things are pinned here:
//   1. evidenceHref: real http(s) URLs and bare domains become clickable
//      hrefs; provider slugs and arbitrary text (and any non-http scheme —
//      javascript:, data:) never do.
//   2. missionPresenter derives evidence `href` through evidenceHref
//      (presenter composition).
//   3. MissionReviews renders an anchor from `item.href` with rel protection
//      (render composition — a correct helper wired to nothing is the bug
//      surviving with better paperwork).
//   4. libraryEvidence: a swept operator file (folder-drop) becomes a linked
//      evidence receipt labeled as coming from "your Violema Library"; a
//      workspace's own connected-app entry does not get that suffix, and
//      missionPresenter's artifact→evidence mapping is actually wired to
//      this helper (not a correct helper left uncalled).

import { readFileSync } from 'node:fs';
import { evidenceHref } from '../src/features/missions/evidenceLink.ts';
import {
  libraryEvidenceItem,
  libraryEvidenceItems,
  readLibrarySnapshotEntries,
} from '../src/features/missions/libraryEvidence.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 1. Behaviour -----------------------------------------------------------

assert(
  evidenceHref('https://techcrunch.com/2026/08/04/espresso-ai') === 'https://techcrunch.com/2026/08/04/espresso-ai',
  'A full https URL passes through unchanged.',
);
assert(
  evidenceHref('http://example.com/page') === 'http://example.com/page',
  'Plain http is preserved (the browser can upgrade; the link must not break).',
);
assert(
  evidenceHref('www.decenttespresso.com/news') === 'https://www.decenttespresso.com/news',
  'A www-prefixed address is upgraded to https.',
);
assert(
  evidenceHref('techcrunch.com') === 'https://techcrunch.com',
  'A bare domain is upgraded to https.',
);
assert(evidenceHref('google_drive') === null, 'Provider slugs never become links.');
assert(evidenceHref('web search') === null, 'Prose source labels never become links.');
assert(evidenceHref('Run output') === null, 'Fallback source labels never become links.');
assert(evidenceHref('') === null, 'Empty input yields no link.');
assert(evidenceHref(undefined) === null, 'Missing input yields no link.');
assert(evidenceHref('javascript:alert(1)') === null, 'javascript: scheme is rejected.');
assert(evidenceHref('data:text/html,x') === null, 'data: scheme is rejected.');
assert(evidenceHref('ftp://example.com') === null, 'Non-http(s) schemes are rejected.');

// --- 2. Library evidence receipts -------------------------------------------

const operatorEntry = {
  fileId: 'file_abc',
  fileName: 'beandjinn-competitors.pdf',
  webViewLink: 'https://drive.google.com/file/d/abc/view',
  origin: 'operator_file',
  content: null,
  truncated: false,
};
const appEntry = {
  fileId: 'file_xyz',
  fileName: 'q3-board-notes.pdf',
  webViewLink: 'https://drive.google.com/file/d/xyz/view',
  origin: 'app_entry',
  content: null,
  truncated: false,
};
const legacyEntry = {
  fileId: 'file_legacy',
  fileName: 'pre-sweep-notes.pdf',
  webViewLink: 'https://drive.google.com/file/d/legacy/view',
  content: null,
  truncated: false,
};

// A library-read query artifact's real payload shape, as
// `executeQueryData`/`applyQueryStepPayloadToExecution` produce it: the
// snapshot rides under `data`, not at the top level.
const libraryQueryArtifactPayload = {
  ok: true,
  source: 'account_library',
  query_type: 'library_read',
  data: {
    section: 'competitive_intel',
    rootFolderName: 'Violema',
    libraryInitialized: true,
    folderId: 'folder_1',
    entryCount: 3,
    entries: [operatorEntry, appEntry, legacyEntry],
  },
  fetched_at: '2026-08-06T00:00:00.000Z',
  latency_ms: 40,
  cache_hit: false,
  live: true,
  simulated: false,
};

const entries = readLibrarySnapshotEntries(libraryQueryArtifactPayload);
assert(Array.isArray(entries) && entries.length === 3, 'recognizes the nested AccountLibrarySnapshot and returns its entries.');
assert(
  readLibrarySnapshotEntries({ ok: true, source: 'github', data: { open_issues: { total: 3 } } }) === undefined,
  'an unrelated query payload is never mistaken for a library snapshot.',
);
assert(
  readLibrarySnapshotEntries({ note: 'no entries here' }) === undefined,
  'a plain record with no entries array yields no library snapshot.',
);

const items = libraryEvidenceItems(entries, 'query_data', 'artifact-1');
const operatorItem = items.find((item) => item.id.includes('beandjinn-competitors'));
const appItem = items.find((item) => item.id.includes('q3-board-notes'));
const legacyItem = items.find((item) => item.id.includes('pre-sweep-notes'));

assert(Boolean(operatorItem), 'the operator_file entry produces an evidence item.');
assert(operatorItem.label.includes('beandjinn-competitors.pdf'), 'the operator item label carries the file name.');
assert(operatorItem.label.includes('your Violema Library'), 'the operator item label names the library as its source.');
assert(operatorItem.href === 'https://drive.google.com/file/d/abc/view', "the operator item's href is exactly the entry's webViewLink.");

assert(Boolean(appItem), 'the app_entry entry also produces an evidence item.');
assert(appItem.label === 'q3-board-notes.pdf', 'the app entry label is the bare file name.');
assert(!appItem.label.includes('your Violema Library'), 'the app entry never gets the library suffix.');
assert(appItem.href === 'https://drive.google.com/file/d/xyz/view', 'the app entry still links to its own webViewLink.');

assert(Boolean(legacyItem), 'an origin-less (pre-sweep) entry still produces an evidence item.');
assert(!legacyItem.label.includes('your Violema Library'), 'an origin-less entry is treated like an app entry, not an operator file.');

assert(
  libraryEvidenceItem({ webViewLink: 'https://drive.google.com/file/d/x/view', origin: 'operator_file' }, 'query_data', 'artifact-1', 0) === undefined,
  'an entry with no fileName cannot be labeled, so it is dropped rather than rendered blank.',
);

// --- 3. Presenter wiring -----------------------------------------------------

const presenterSource = readFileSync(new URL('../src/features/missions/missionPresenter.ts', import.meta.url), 'utf8');
assert(
  presenterSource.includes('evidenceHref('),
  'missionPresenter derives evidence hrefs through evidenceHref.',
);
assert(
  presenterSource.includes("from './libraryEvidence'"),
  "missionPresenter imports the library evidence mapping rather than reimplementing it (no parallel path).",
);
assert(
  presenterSource.includes('readLibrarySnapshotEntries(') && presenterSource.includes('libraryEvidenceItems('),
  'the artifact→evidence mapping (extractEvidenceItems) is actually wired to the library helper, not left unused.',
);

// --- 4. Render wiring -------------------------------------------------------

const reviewsSource = readFileSync(new URL('../src/features/missions/MissionReviews.tsx', import.meta.url), 'utf8');
assert(
  reviewsSource.includes('item.href'),
  'MissionReviews renders from the evidence item href.',
);
assert(
  /rel="noreferrer noopener"/.test(reviewsSource),
  'Evidence anchors carry rel="noreferrer noopener".',
);

console.log('evidenceLink.contract: all assertions passed');
