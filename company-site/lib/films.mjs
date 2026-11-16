import { shell, longDate } from './pages.mjs';
import { escapeHTML as e } from './render.mjs';
import { pageFor } from './routes.mjs';

// A film page: the film in both cuts, then its record. Every line the film speaks or shows is listed with its
// sources and limits, and the sources are numbered as in the film. Content comes from data/films.mjs.

export const filmAssetBase = film => `/company-assets/films/${film.slug}/`;
// The served path of every media file the page links, for the build and the tests.
export const filmMediaPaths = film => film.media.cuts.map(cut => `${filmAssetBase(film)}${cut.file}`);

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const megabytes = bytes => `${(bytes / 1e6).toFixed(1)} MB`;
const kinds = {
  test: 'Claim under test',
  sourced: 'Sourced',
  derived: 'Follows from the study',
  argument: 'Argument',
  product: 'About Violema',
  card: 'End card',
};

// Source numbers link to the source list; each carries its full name for screen readers.
const refs = (film, numbers) => numbers.map(n => {
  if (!film.sources.some(source => source.n === n)) throw new Error(`${film.slug}: no source ${n}`);
  return `<a class="film-ref" href="#source-${n}"><span class="visually-hidden">Source </span>${n}</a>`;
}).join('');
const sourceLabel = href => {
  const url = new URL(href);
  return url.host === 'doi.org' ? `doi.org${url.pathname}` : url.host.replace(/^www\./, '');
};

const sectionHead = (id, number, label, title, lede) => `<div class="section-head record-section-head"><div><p class="record-chapter"><span aria-hidden="true">${number}</span>${label}</p><h2 id="${id}-title">${title}</h2><p class="lede">${lede}</p></div></div>`;

// WebVTT captions, shared by both cuts.
export function filmCaptions(film) {
  const stamp = seconds => {
    const ms = Math.round(seconds * 1000);
    const pad = (value, width = 2) => String(value).padStart(width, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
  };
  return `WEBVTT\n\n${film.cues.map(([start, end, text], i) => `${i + 1}\n${stamp(start)} --> ${stamp(end)}\n${text}\n`).join('\n')}`;
}

function player(film) {
  const base = filmAssetBase(film);
  const frames = film.media.cuts.map(cut => `<div class="film-frame film-frame-${cut.id}" data-cut="${cut.id}"><video controls playsinline preload="none" width="${cut.width}" height="${cut.height}" poster="${base}${cut.poster}" aria-label="${e(film.title)}, ${cut.label.toLowerCase()} cut"><source src="${base}${cut.file}" type="video/mp4"><track kind="captions" src="${base}${film.media.captions}" srclang="en" label="English"><p>This browser cannot play the film. <a href="${base}${cut.file}" download>Download the ${cut.label.toLowerCase()} cut</a>.</p></video></div>`).join('');
  const choices = film.media.cuts.map(cut => `<button class="film-cut" type="button" aria-pressed="false" data-cut-choice="${cut.id}">${cut.label} <span>${cut.ratio}</span></button>`).join('');
  const downloads = film.media.cuts.map(cut => `<a href="${base}${cut.file}" download>${cut.label} cut, ${cut.ratio}, MP4, ${megabytes(cut.bytes)}</a>`).join('');
  const draft = film.status === 'draft' ? `<p class="film-draft"><span class="pill">Draft cut</span><span>${e(film.draftNote)}</span></p>` : '';
  return `<figure class="film-player instrument" data-film><div class="film-bar"><p class="instrument-title">Film ${film.number} · ${e(film.title)} · ${clock(film.runtime)}</p><div class="film-cuts" role="group" aria-label="Cut" data-film-cuts hidden>${choices}</div></div><div class="film-stage">${frames}</div><figcaption class="film-foot">${draft}<p class="film-downloads"><span>Download</span>${downloads}</p></figcaption></figure>`;
}

function filmSection(film) {
  const notes = `<div class="film-notes"><h3>What you are watching</h3><ul class="field-limits">${film.disclosures.map(text => `<li>${e(text)}</li>`).join('')}</ul></div>`;
  return `<section class="section record-section film-section" id="film" aria-labelledby="film-title"><div class="wrap">${sectionHead('film', '01', 'The film', 'Watch the film', `${film.runtime} seconds. Wide for screens, vertical for phones, one soundtrack. Captions are in the player.`)}${player(film)}${notes}</div></section>`;
}

function recordSection(film) {
  const { record } = film;
  const also = links => (links ? `<span class="film-also">${links.map(([label, href]) => `<a href="${e(href)}">${e(label)}</a>`).join('')}</span>` : '');
  const entry = item => `<li class="film-entry" id="record-${item.year}"><p class="film-entry-year"><time datetime="${item.year}">${item.year}</time></p><div class="film-entry-body"><p class="film-onscreen"><span class="film-tag">On screen</span>${e(item.screen)} <span class="film-refs">${refs(film, item.refs)}</span></p><dl class="film-entry-facts"><div><dt>What the sources say</dt><dd>${e(item.found)}</dd></div><div><dt>Limits</dt><dd>${e(item.limits)}${also(item.also)}</dd></div></dl></div></li>`;
  const now = `<li class="film-entry film-entry-now"><p class="film-entry-year"><time datetime="${record.now.year}">${record.now.year}</time></p><div class="film-entry-body"><p class="film-onscreen"><span class="film-tag">On screen</span>${e(record.now.screen)}</p></div></li>`;
  const claim = `<div class="film-claim"><p class="film-claim-label">Claim</p><p class="film-claim-text">“${e(record.claim)}”</p><p class="film-chip">${e(record.chip)}</p></div>`;
  return `<section class="section record-section" id="record" aria-labelledby="record-title"><div class="wrap">${sectionHead('record', '02', 'The record', 'One claim, every entry dated', 'The film ends on this record. Here each entry carries its sources and its limits.')}${claim}<ol class="film-timeline">${record.entries.map(entry).join('')}${now}</ol></div></section>`;
}

function linesSection(film) {
  const row = line => {
    const said = line.spoken ? `<p class="film-said"><span class="film-tag">${e(line.voice)}</span>${e(line.spoken)}</p>` : '<p class="film-said is-silent"><span class="film-tag">Voice</span>No spoken line.</p>';
    const screen = line.screen.length ? `<div class="film-screen"><p class="film-tag">On screen</p><ul>${line.screen.map(text => `<li>${e(text)}</li>`).join('')}</ul></div>` : '';
    const sources = line.refs.length ? `<p class="film-sourced"><span>Sources</span>${refs(film, line.refs)}</p>` : '';
    return `<li class="film-line"><p class="film-line-time"><a href="#film" data-seek="${line.at}" aria-label="${clock(line.at)}, play the film from here">${clock(line.at)}</a></p><div class="film-line-body"><p class="film-line-meta"><span class="film-beat">${e(line.beat)}</span><span class="pill">${kinds[line.kind]}</span></p>${said}${screen}<p class="film-note">${e(line.note)}</p>${sources}</div></li>`;
  };
  return `<section class="section record-section" id="lines" aria-labelledby="lines-title"><div class="wrap">${sectionHead('lines', '03', 'Every line', 'What the film says, line by line', `Each spoken and on-screen line, checked against its sources on ${longDate(film.checked)}. Select a time to play the film from there.`)}<ol class="film-lines">${film.lines.map(row).join('')}</ol></div></section>`;
}

function sourcesSection(film) {
  const items = film.sources.map(source => `<li id="source-${source.n}"><span class="film-source-n" aria-hidden="true">${source.n}</span><div><p class="film-source-cite"><span class="visually-hidden">Source ${source.n}. </span>${e(source.citation)}</p><p class="film-source-read">${e(source.read)} <a href="${e(source.href)}">${e(sourceLabel(source.href))}</a></p></div></li>`).join('');
  return `<section class="section record-section" id="sources" aria-labelledby="sources-title"><div class="wrap">${sectionHead('sources', '04', 'Sources', `${film.sources.length} sources, numbered as in the film`, `Each was read on ${longDate(film.checked)}.`)}<ol class="film-sources">${items}</ol></div></section>`;
}

function closeSection(film) {
  return `<section class="section record-close film-close" aria-labelledby="limits-title"><div class="wrap"><h2 id="limits-title">What the film does not say.</h2><ul class="field-limits">${film.notClaimed.map(text => `<li>${e(text)}</li>`).join('')}</ul><p class="film-checked">${e(film.checkedBy)}</p><div class="actions"><a class="button button-primary" href="/method/">How the method works</a><a class="button button-secondary" href="/#briefing">Request a briefing</a></div></div></section>`;
}

// Search engines read a VideoObject only once the film has a release date.
function videoObject(film, route) {
  if (!film.published) return null;
  const base = `https://violema.com${filmAssetBase(film)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: film.title,
    description: film.description,
    url: `https://violema.com${route}`,
    thumbnailUrl: film.media.cuts.map(cut => `${base}${cut.poster}`),
    uploadDate: film.published,
    duration: `PT${film.runtime}S`,
    contentUrl: `${base}${film.media.cuts[0].file}`,
    publisher: { '@id': 'https://violema.com/#organization' },
  };
}

export function filmPage(film, route) {
  pageFor(route);
  const head = `<section class="page-head record-head film-head"><div class="wrap"><nav class="legal-breadcrumb record-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Film ${film.number}</span></nav><p class="label">Violema film ${film.number} · ${film.runtime} seconds</p><h1>${e(film.title)}</h1><p class="lede">${e(film.lede)}</p><div class="actions"><a class="button button-primary" href="#film">Watch the film</a><a class="button button-secondary" href="#record">Read the record</a></div></div></section>`;
  const card = { image: `${filmAssetBase(film)}${film.media.card.file}`, ogAlt: film.media.card.alt, twitterAlt: film.media.card.alt };
  return shell(route, `${film.title}, film ${film.number} | Violema`, film.description, [head, filmSection(film), recordSection(film), linesSection(film), sourcesSection(film), closeSection(film)].join(''), { card, structuredData: videoObject(film, route) });
}
