import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZERO_BABIES, FILMS } from '../data/films.mjs';
import { filmPage, filmCaptions, filmMediaPaths, filmAssetBase } from '../lib/films.mjs';
import { ZERO_BABIES_ROUTE } from '../lib/routes.mjs';

// The film's own files (script, captions, graphics) live outside this repository, so word-for-word agreement with
// them is checked when the film changes (README, "Films"). These tests hold what the repository can hold: the page
// says what the data says, the data keeps the ledger's rules, and the served files are the pinned ones.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pageFile = 'films/zero-babies/index.html';
const film = ZERO_BABIES;
const read = file => readFile(join(dist, file), 'utf8');
const text = html => html.replace(/<[^>]+>/g, ' ').replaceAll('&amp;', '&').replace(/\s+/g, ' ');
const skipMedia = process.env.VIOLEMA_SKIP_FILM_MEDIA === '1';

const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
const allText = strings(film).join('\n');
const sourceNumbers = new Set(film.sources.map(source => source.n));
const counts = { 6: 'Six' };

function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const bits = buffer.readUInt32LE(21); return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
  if (chunk === 'VP8X') return [buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1];
  throw new Error(`Unknown WebP chunk ${chunk}`);
}
function jpegSize(buffer) {
  for (let i = 2; i < buffer.length;) {
    if (buffer[i] !== 0xff) { i++; continue; }
    const marker = buffer[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buffer.readUInt16BE(i + 7), buffer.readUInt16BE(i + 5)];
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  throw new Error('No JPEG frame header');
}

test('the film page is public and lays out the film, the record, every line and the sources in that order', async () => {
  const html = await read(pageFile);
  assert.equal(ZERO_BABIES_ROUTE, '/films/zero-babies/');
  assert.ok(FILMS.includes(film));
  assert.ok(html.includes(`<link rel="canonical" href="https://violema.com${ZERO_BABIES_ROUTE}">`));
  assert.ok(html.includes('<meta name="robots" content="index,follow">'));
  assert.equal(html.match(/<title>([^<]+)<\/title>/)[1], 'Zero Babies, film 01 | Violema');
  for (const sheet of ['records.css', 'films.css']) assert.ok(html.includes(`<link rel="stylesheet" href="/company-assets/${sheet}">`), sheet);
  assert.ok(html.includes(`<meta property="og:image" content="https://violema.com${filmAssetBase(film)}${film.media.card.file}">`), 'the share card is a still from the film');
  const order = ['id="film"', 'id="record"', 'id="lines"', 'id="sources"', 'id="limits-title"'].map(id => html.indexOf(id));
  assert.ok(order.every(at => at > -1) && order.every((at, i) => i === 0 || at > order[i - 1]), 'sections in order');
});

test('the player offers both cuts with posters and captions, and never plays on its own', async () => {
  const html = await read(pageFile);
  const videos = html.match(/<video[^>]*>/g) ?? [];
  assert.equal(videos.length, film.media.cuts.length);
  for (const [i, cut] of film.media.cuts.entries()) {
    assert.match(videos[i], /\bcontrols\b/);
    assert.match(videos[i], /\bplaysinline\b/);
    assert.match(videos[i], /preload="none"/);
    assert.doesNotMatch(videos[i], /autoplay|\bmuted\b|\bloop\b/);
    assert.ok(videos[i].includes(`width="${cut.width}" height="${cut.height}"`), cut.id);
    assert.ok(videos[i].includes(`poster="${filmAssetBase(film)}${cut.poster}"`), cut.id);
    const poster = await readFile(join(dist, filmAssetBase(film), cut.poster));
    assert.deepEqual(webpSize(poster), [cut.width, cut.height], `${cut.poster} matches its cut`);
    assert.ok(poster.length < 150_000, `${cut.poster} stays small`);
  }
  assert.equal((html.match(/<track kind="captions" src="\/company-assets\/films\/zero-babies\/zero-babies\.en\.vtt" srclang="en" label="English">/g) ?? []).length, film.media.cuts.length);
  assert.deepEqual(jpegSize(await readFile(join(dist, filmAssetBase(film), film.media.card.file))), [1200, 630]);
  assert.match(html, /<div class="film-cuts" role="group" aria-label="Cut" data-film-cuts hidden>/, 'cut buttons wait for the script');
});

test('the draft note shows while the film is a draft, and search engines get a VideoObject only once it is released', async () => {
  const html = await read(pageFile);
  assert.equal(film.status, 'draft');
  assert.ok(html.includes(`<span class="pill">Draft cut</span><span>${film.draftNote}</span>`));
  assert.doesNotMatch(html, /VideoObject/);
  const released = filmPage({ ...film, status: 'final', published: '2026-12-01' }, ZERO_BABIES_ROUTE);
  assert.doesNotMatch(released, /Draft cut/);
  const data = JSON.parse(released.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"VideoObject"[\s\S]*?)<\/script>/)[1]);
  assert.equal(data.uploadDate, '2026-12-01');
  assert.equal(data.duration, 'PT52S');
  assert.equal(data.contentUrl, `https://violema.com${filmMediaPaths(film)[0]}`);
});

test('six sources, numbered 1 to 6; every reference resolves and the film\'s count matches', async () => {
  assert.deepEqual([...sourceNumbers], [1, 2, 3, 4, 5, 6]);
  const used = [...film.lines.flatMap(line => line.refs), ...film.record.entries.flatMap(entry => entry.refs)];
  for (const n of used) assert.ok(sourceNumbers.has(n), `source ${n}`);
  for (const n of sourceNumbers) assert.ok(used.includes(n), `source ${n} is cited somewhere`);
  const word = counts[film.sources.length];
  assert.ok(film.lines.at(-1).screen.includes(`Scenes are generated. ${word} sources.`), 'the end card names the count');
  assert.ok(film.disclosures.includes(`${word} sources, numbered in the film as on this page.`));
  const html = await read(pageFile);
  for (const n of sourceNumbers) assert.ok(html.includes(`<li id="source-${n}">`), `source ${n} is listed`);
  assert.throws(() => filmPage({ ...film, lines: [{ ...film.lines[0], refs: [7] }] }, ZERO_BABIES_ROUTE), /no source 7/);
});

test('captions are valid WebVTT, in order, inside the film, and cover every spoken line but the end card', async () => {
  const vtt = await read(`${filmAssetBase(film).slice(1)}${film.media.captions}`);
  assert.equal(vtt, filmCaptions(film));
  assert.match(vtt, /^WEBVTT\n\n1\n00:00:00\.600 --> 00:00:02\.253\nPlay Mozart to your baby\.\n/);
  const stamps = [...vtt.matchAll(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/gm)];
  assert.equal(stamps.length, film.cues.length);
  let previous = 0;
  for (const [start, end, line] of film.cues) {
    assert.ok(start >= previous && end > start && end <= film.media.duration, line);
    previous = start;
  }
  // The end card shows its line on screen, as in the film, so it has no cue.
  const spoken = film.lines.filter(line => line.spoken);
  for (const [i, line] of spoken.entries()) {
    const next = spoken[i + 1]?.at ?? film.media.duration;
    const cued = film.cues.some(([start]) => start >= line.at && start < next);
    assert.equal(cued, line.kind !== 'card', line.beat);
  }
  assert.ok(film.lines.at(-1).screen.includes('Where science keeps score.'));
});

test('the copy keeps the ledger\'s rules and the site\'s voice', async () => {
  // The ledger's "never say" and "do not use" lines, and on-screen text it retired.
  for (const never of [/\bnull\b/i, /\bfake\b/i, /Tested in babies/i, /Babies tested/i, /at least one hour/i, /every mother/i, /Georgia spent/i, /\bK ?488\b/]) assert.doesNotMatch(allText, never);
  assert.doesNotMatch(allText.replace(/does not say[^.]*smarter[^.]*\./g, ''), /authors? (?:claimed|said|promised)[^.]*smarter/i);
  const page = text(await read(pageFile));
  assert.doesNotMatch(page, /—/);
  assert.doesNotMatch(page, /curat|seamless|\bdelve|\belevat|game-changing|thought leader|\bdisrupt|reimagin|exclusive network|like-minded|meaningful connection|actionable insight/i);
  // Settled from the paper and the bill.
  const [y1993, y1998] = film.record.entries;
  for (const fact of ['36 college students', 'Ten minutes of Mozart’s Sonata for Two Pianos in D major, K. 448', 'Three Stanford-Binet tasks', '10 to 15 minutes']) assert.ok(`${y1993.found} ${y1993.limits}`.includes(fact), fact);
  for (const fact of ['asked the legislature for $105,000', 'birth to five', 'chapter 98-70']) assert.ok(y1998.found.includes(fact), fact);
  assert.ok(y1998.limits.includes('“are encouraged, but not required, to comply”'));
  assert.ok(y1998.limits.includes('not whether it was approved or spent'));
  assert.ok(film.lines.some(line => line.screen.includes('Florida, 1998: classical music required in state-funded education and care programs for children from birth to five. Family daycare centers exempt.')));
  assert.ok(film.disclosures.some(line => /governor and the baby/.test(line)), 'both dramatizations are named');
});

test('every media file carries its hash and is linked from one place', () => {
  for (const cut of film.media.cuts) {
    assert.match(cut.sha256, /^[0-9a-f]{64}$/);
    assert.ok(cut.file.endsWith(`-${cut.sha256.slice(0, 8)}.mp4`), cut.file);
  }
  assert.deepEqual(filmMediaPaths(film), film.media.cuts.map(cut => `/company-assets/films/zero-babies/${cut.file}`));
});

test('the served films are the pinned files', { skip: skipMedia && 'VIOLEMA_SKIP_FILM_MEDIA=1: built without the film files' }, async () => {
  for (const [i, cut] of film.media.cuts.entries()) {
    const file = join(dist, filmMediaPaths(film)[i]);
    assert.equal((await stat(file)).size, cut.bytes, cut.file);
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), cut.sha256, cut.file);
  }
});
