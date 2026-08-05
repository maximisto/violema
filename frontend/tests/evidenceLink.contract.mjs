// Evidence-link contract.
//
// Field observation, 2026-08-05 (maximus Loom prep): the review pane's
// Evidence cards rendered their source as plain text, so a URL a reviewer
// should be able to open — the whole point of inspectable evidence — was
// dead text on screen.
//
// Three things are pinned here:
//   1. evidenceHref: real http(s) URLs and bare domains become clickable
//      hrefs; provider slugs and arbitrary text (and any non-http scheme —
//      javascript:, data:) never do.
//   2. missionPresenter derives evidence `href` through evidenceHref
//      (presenter composition).
//   3. MissionReviews renders an anchor from `item.href` with rel protection
//      (render composition — a correct helper wired to nothing is the bug
//      surviving with better paperwork).

import { readFileSync } from 'node:fs';
import { evidenceHref } from '../src/features/missions/evidenceLink.ts';

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

// --- 2. Presenter wiring ----------------------------------------------------

const presenterSource = readFileSync(new URL('../src/features/missions/missionPresenter.ts', import.meta.url), 'utf8');
assert(
  presenterSource.includes('evidenceHref('),
  'missionPresenter derives evidence hrefs through evidenceHref.',
);

// --- 3. Render wiring -------------------------------------------------------

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
