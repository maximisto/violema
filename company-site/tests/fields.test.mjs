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

test('the benchmark page shows the latest dated amendment line and links the record\'s history', async () => {
  const html = await read(recordFiles[0]);
  assert.match(AMENDMENT_NOTE, /^2026-11-05 · Amendment 2: /);
  assert.doesNotMatch(AMENDMENT_NOTE, /before registration/, 'Amendment 2 does not settle whether the earlier timestamp registered the draft');
  assert.ok(text(html).includes(AMENDMENT_NOTE), 'the note is on the page as written');
  assert.ok(html.includes(`href="${FE4S4_RECORD_ROUTE}#map-h"`));
  assert.match(await read(recordFiles[1]), /id="map-h"/, 'the anchor exists on the full record');
});

// The label names the field, so a visitor who has seen the Fe4S4 record knows where it lives.
test('Quantum records in the header marks the field page, and the field while a record is open', async () => {
  const link = html => {
    const [, attributes, label] = html.match(new RegExp(`<nav class="primary-nav"[\\s\\S]*?<a href="${FIELD.route}"([^>]*)>([\\s\\S]*?)</a>`)) ?? [];
    assert.equal(text(label ?? '').trim(), 'Quantum records', 'the full label stays in the link, even where the narrow desktop header hides "records" on screen');
    return attributes;
  };
  assert.equal(link(await read(fieldFile)), ' aria-current="page"');
  for (const file of recordFiles) assert.equal(link(await read(file)), ' aria-current="true"', file);
  for (const file of ['index.html', 'demo/index.html', 'about/index.html']) assert.equal(link(await read(file)), '', file);
});

test('home and About list the field beside the other applications', async () => {
  const home = await read('index.html');
  const applications = home.match(/<section class="experience-chapter chapter-applications"[\s\S]*?<\/section>/)[0];
  assert.ok(applications.includes(`<h3 id="quantum-title">${FIELD.name}</h3>`) && applications.includes(`href="${FIELD.route}"`));
  const about = await read('about/index.html');
  const divisions = about.match(/<section id="charter-divisions"[\s\S]*?<\/section>/)[0];
  assert.ok(divisions.includes(`<a href="${FIELD.route}">Open the quantum advantage field</a>`), 'the division list names the field');
  assert.ok(about.includes(`<dt>Second field</dt><dd><a href="${FIELD.route}">${FIELD.name} records</a></dd>`));
  assert.ok(about.includes('<h3 id="about-quantum-title">'));
  assert.doesNotMatch(about, /Interactive architecture|Active architecture|until claims break|stays clean/, 'About in a plainer register');
});

// Someone who types violema.com after seeing the Fe4S4 record elsewhere finds the field in the hero, not 7 screens down.
test('the home hero lists the field after PsychDoc, and the applications card opens the record', async () => {
  const home = await read('index.html');
  const family = home.match(/<div class="hero-family">[\s\S]*?<\/div>/)[0];
  assert.deepEqual([...family.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1]), ['https://psychdoc.ai', FIELD.route]);
  const linkText = (html, href) => text(html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>([\\s\\S]*?)</a>`))?.[1] ?? '');
  const entry = linkText(family, FIELD.route);
  assert.ok(entry.includes(`${FIELD.name} records`), 'names the field as records, not as a result');
  assert.ok(entry.includes('Draft protocol, not yet registered. Fe₄S₄ benchmark.'), 'the status comes first, so it shows on the first screen');
  const applications = home.match(/<section [^>]*id="applications"[\s\S]*?<\/section>/)[0];
  const card = applications.match(/<article [^>]*aria-labelledby="quantum-title"[\s\S]*?<\/article>/)[0];
  assert.ok(linkText(card, FIELD.route).includes('Explore the quantum advantage records'));
  assert.ok(linkText(card, FE4S4_ROUTE).includes('Open the Fe₄S₄ record'));
  // Only the record's own status wording may mention registration or review.
  const permitted = ['Draft protocol, not yet registered', 'No domain expert has reviewed it yet'];
  for (const region of [family, card]) {
    const copy = permitted.reduce((rest, phrase) => rest.replaceAll(phrase, ''), text(region));
    assert.doesNotMatch(copy, /—|\b(registered|validated|reviewed|curated|thought leaders|disrupt|game-changing|reimagining|seamless|delve|elevate|actionable insights|like-minded)\b/i);
  }
});

test('the field page gives the reason for judging the slowest quantum run against the fastest classical one', async () => {
  const field = text(await read(fieldFile));
  assert.ok(field.includes('That pairing already takes the hardest case for the claim among the observed runs, so no statistical interval is taken over runs'));
  assert.ok(field.includes('No probabilities yet.'));
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
