import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELD, FE4S4_ROUTE, FE4S4_RECORD_ROUTE } from '../lib/routes.mjs';
import { AMENDMENT_NOTE } from '../lib/records.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const read = file => readFile(join(dist, file), 'utf8');
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const fieldFile = 'fields/quantum-advantage/index.html';
const recordFiles = ['records/fe4s4-benchmark/index.html', 'records/fe4s4-benchmark/record/index.html'];
const breadcrumb = html => html.match(/<nav class="legal-breadcrumb record-breadcrumb" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/)?.[1] ?? '';
// Text that search results and link previews show from <head>, which text() drops with the tags.
const previewText = html => [...html.matchAll(/<meta (?:name|property)="(?:description|(?:og|twitter):(?:title|description|image:alt))" content="([^"]*)">/g)].map(match => match[1]);

test('the field page is a public page that lists Fe4S4 as its first record', async () => {
  const html = await read(fieldFile);
  assert.equal(FIELD.route, '/fields/quantum-advantage/');
  assert.ok(html.includes(`<link rel="canonical" href="https://violema.com${FIELD.route}">`));
  assert.ok(html.includes('<meta name="robots" content="index,follow">'));
  assert.ok(html.includes('<link rel="stylesheet" href="/company-assets/records.css">'));
  assert.equal(html.match(/<title>([^<]+)<\/title>/)[1], 'Quantum advantage records | Violema');
  const records = html.match(/<article class="field-record"[\s\S]*?<\/article>/g) || [];
  assert.equal(records.length, 1, 'one record so far');
  for (const href of [FE4S4_ROUTE, FE4S4_RECORD_ROUTE]) assert.ok(records[0].includes(`href="${href}"`), href);
  assert.match(records[0], /Draft protocol, not yet registered/);
  assert.match(records[0], /class="instrument record-facts"/, 'the card repeats the record\'s own facts');
});

test('the field page keeps the house voice and makes no partner, customer or forecast claim', async () => {
  const html = await read(fieldFile);
  assert.doesNotMatch(html, /—/);
  assert.doesNotMatch(html, /\b(curated|thought leaders|disrupt|game-changing|reimagining|seamless|delve|elevate|actionable insights|like-minded)\b/i);
  const preview = previewText(html);
  assert.equal(preview.length, 7, 'the description, and the og and twitter title, description and image alt');
  assert.doesNotMatch(`${text(html)} ${preview.join(' ')}`, /\b(partners?|customers?|clients?|validated|accuracy|forecasts?)\b/i);
  assert.match(text(html), /It does not say whether quantum advantage exists, or when it will\./);
  assert.match(text(html), /Classical methods compete for the same target under the same ceilings, and they can win\./);
});

// The record's history keeps its dated row saying the note changed; history rows are not rewritten.
const historyRow = 'the conflict-of-interest note no longer says whom the demo was prepared for';
test('no public page names the person a record was first built for', async () => {
  for (const file of [fieldFile, ...recordFiles]) assert.doesNotMatch(text(await read(file)).replace(historyRow, ''), /\bCarl\b|\bSaab\b|prepared for/i, file);
});

test('both record pages lead back through the field in their breadcrumb', async () => {
  const [benchmark, record] = await Promise.all(recordFiles.map(read));
  assert.equal(text(breadcrumb(benchmark)).trim(), `Home / ${FIELD.name} / Fe₄S₄ benchmark`);
  assert.equal(text(breadcrumb(record)).trim(), `Home / ${FIELD.name} / Fe₄S₄ benchmark / Full record`);
  for (const html of [benchmark, record]) assert.ok(breadcrumb(html).includes(`<a href="${FIELD.route}">${FIELD.name}</a>`));
});

test('the benchmark page shows the dated Amendment 1 line and links the record\'s history', async () => {
  const html = await read(recordFiles[0]);
  assert.match(AMENDMENT_NOTE, /^2026-10-31 · Amendment 1, before registration: /);
  assert.ok(text(html).includes(AMENDMENT_NOTE), 'the note is on the page as written');
  assert.ok(html.includes(`href="${FE4S4_RECORD_ROUTE}#map-h"`));
  assert.match(await read(recordFiles[1]), /id="map-h"/, 'the anchor exists on the full record');
});

test('Records in the header marks the field page, and the field while a record is open', async () => {
  const link = html => html.match(new RegExp(`<nav class="primary-nav"[\\s\\S]*?<a href="${FIELD.route}"([^>]*)>Records</a>`))?.[1];
  assert.equal(link(await read(fieldFile)), ' aria-current="page"');
  for (const file of recordFiles) assert.equal(link(await read(file)), ' aria-current="true"', file);
  for (const file of ['index.html', 'demo/index.html', 'about/index.html']) assert.equal(link(await read(file)), '', file);
});

test('the field is linked from the footer, the evidence lab, the sitemap and llms.txt', async () => {
  for (const file of ['index.html', fieldFile, ...recordFiles]) {
    const footer = (await read(file)).match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
    assert.ok(footer.includes(`<a href="${FIELD.route}">${FIELD.name} records</a>`), file);
  }
  assert.ok((await read('demo/index.html')).includes(`<a class="text-link" href="${FIELD.route}">`));
  assert.ok((await read('sitemap.xml')).includes(`<loc>https://violema.com${FIELD.route}</loc>`));
  assert.ok((await read('llms.txt')).includes(`(https://violema.com${FIELD.route})`));
});
