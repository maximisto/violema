import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evidenceMapSection } from './evidence-map.mjs';
import { homeExperience } from './experience.mjs';
import { howItWorksSection, crossFieldSection } from './how-it-works.mjs';
import { howItWorks } from '../data/how-it-works.mjs';
import { legalPolicies, legalUpdatedAt } from './legal.mjs';
import { escapeHTML as e, sourceURL, corpusPanel, intervalFigure, calculateBiasScenario, chartLegend, biasControl, biasExplanation, referenceNote, scenarioSummary, traceSpecimen } from './render.mjs';

const psychdoc = 'https://psychdoc.ai';
const mapBytes = readFileSync(new URL('../data/evidence-map.json', import.meta.url));
const evidenceMap = JSON.parse(mapBytes);
const evidenceMapHash = createHash('sha256').update(mapBytes).digest('hex');
const nav = (route,href,label) => `<a href="${href}"${route===href?' aria-current="page"':''}>${label}</a>`;
const external = '<span class="external-glyph" aria-hidden="true">↗</span>';
const fontFiles = ['instrument-sans-latin-wght-normal.woff2', 'inter-latin-wght-normal.woff2'];

// Pages with evidence interactions preload the modules site.mjs imports, so the bench and the
// replay enhance without a second round trip.
const labModules = ['/company-assets/browser/tabs.mjs', '/company-assets/browser/lab.mjs', '/company-assets/browser/render.mjs', '/company-assets/data/corpora.mjs'];

function head(route, title, description, { lab = false } = {}) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}">`,
    `<meta name="robots" content="${route === '/review/' ? 'noindex,follow' : 'index,follow'}">`,
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#F5F6F8">',
    `<link rel="canonical" href="https://violema.com${route}">`,
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Corporation","@id":"https://violema.com/#organization","name":"Violema","legalName":"Violema, Inc.","url":"https://violema.com/"}</script>',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Violema">',
    `<meta property="og:title" content="${e(title)}">`,
    `<meta property="og:description" content="${e(description)}">`,
    `<meta property="og:url" content="https://violema.com${route}">`,
    '<link rel="icon" href="/company-assets/violema-icon.png" type="image/png">',
    ...fontFiles.map(file => `<link rel="preload" href="/company-assets/fonts/${file}" as="font" type="font/woff2" crossorigin>`),
    '<script>try{if(localStorage.getItem("violema-theme")==="dark")document.documentElement.dataset.theme="dark"}catch{}</script>',
    '<link rel="stylesheet" href="/company-assets/site.css">',
    '<link rel="stylesheet" href="/company-assets/appearance.css">',
    ...(route === '/' ? ['<link rel="stylesheet" href="/company-assets/experience.css">'] : []),
    ...(route === '/method/' ? ['<link rel="stylesheet" href="/company-assets/diagrams.css">'] : []),
    ...(lab ? labModules : []).map(href => `<link rel="modulepreload" href="${href}">`),
  ].join('');
}

function siteHeader(route) {
  return `<header class="site-header" data-site-header><div class="wrap header-inner"><a class="brand" href="/" aria-label="Violema home"><img class="brand-light" src="/company-assets/violema-logo.png" width="2172" height="724" alt="Violema"><img class="brand-dark" src="/company-assets/violema-logo-dark.png" width="2172" height="724" alt="Violema" loading="lazy"></a><nav class="primary-nav" id="primary-navigation" aria-label="Main navigation">${nav(route, '/method/', 'Method')}${nav(route, '/demo/', 'Evidence lab')}${nav(route, '/review/', 'For reviewers')}<a href="${psychdoc}">PsychDoc ${external}</a></nav><button class="theme-control" type="button" aria-label="Switch to dark mode" title="Switch to dark mode" hidden data-theme-control><svg class="theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20.9 13.1A9 9 0 0 1 10.9 3.1a9 9 0 1 0 10 10Z"/></svg><svg class="theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg></button><button class="mobile-menu-control" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-navigation" hidden data-menu-control><svg class="menu-open-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="menu-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div></header>`;
}

function siteFooter() {
  return `<footer class="site-footer"><div class="wrap"><div class="footer-main"><a class="footer-wordmark" href="/">Violema</a><p class="footer-tagline">Scientific conclusions.<br>With their evidence attached.</p><nav class="footer-nav" aria-label="Footer navigation"><a href="/method/">Method</a><a href="/demo/">Evidence lab</a><a href="/review/">For scientific reviewers</a><a href="${psychdoc}/#briefing">Request a scientific briefing ${external}</a></nav></div><div class="footer-meta"><span>Prepared demonstration · independent scientific review pending</span><a href="/login">Existing workspace sign in</a></div><div class="footer-end"><p class="footer-copyright">Copyright 2026 Violema, Inc.</p><nav class="footer-legal" aria-label="Legal"><a href="/legal/terms/">Terms of Use</a><a href="/legal/privacy/">Privacy Policy</a></nav></div></div></footer>`;
}

export function shell(route, title, description, content, options = {}) {
  return `<!doctype html><html lang="en"><head>${head(route, title, description, options)}</head><body><a class="skip-link" href="#main">Skip to content</a>${siteHeader(route)}<main id="main"${route === '/' ? ' class="home-experience"' : ''}>${content}</main>${siteFooter()}<script type="module" src="/company-assets/browser/site.mjs"></script></body></html>`;
}

export function legalPage(slug) {
  const policy = legalPolicies.find(item => item.slug === slug);
  if (!policy) throw new Error(`Unknown website policy: ${slug}`);
  const updatedAt = policy.updatedAt || legalUpdatedAt;
  const effectiveDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${updatedAt}T00:00:00Z`));
  const sections = policy.sections.map(section => `<section id="${e(section.id)}" class="legal-section" aria-labelledby="${e(section.id)}-title"><h2 id="${e(section.id)}-title">${e(section.title)}</h2>${section.html}</section>`).join('');
  return shell(`/legal/${slug}/`, `${policy.title} | Violema`, policy.description, `<article class="wrap legal-document"><nav class="legal-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">${e(policy.title)}</span></nav><header class="legal-heading"><p class="label">Violema, Inc. · Delaware corporation</p><h1>${e(policy.title)}</h1><p class="lede">${e(policy.summary)}</p><p class="caption">Effective date: <time datetime="${e(updatedAt)}">${e(effectiveDate)}</time></p></header><nav class="legal-contents" aria-label="On this page"><p>On this page</p><ol>${policy.sections.map(section => `<li><a href="#${e(section.id)}">${e(section.title)}</a></li>`).join('')}</ol></nav><div class="legal-body">${sections}</div></article>`);
}

// The six records of the method. A real sequence, so the stations are numbered.
const protocolSteps = [
  ['Source', 'A stable record'],
  ['Study', 'The underlying experiment'],
  ['Claim', 'What the source supports'],
  ['Assumption', 'What analysis requires'],
  ['Review', 'What has been checked'],
  ['Version', 'A replayable record'],
];

export function protocol() {
  return `<ol class="protocol" data-step-sequence data-stage="static" aria-label="Evidence workflow">${protocolSteps.map(([name, text], i) => `<li class="station" data-step><span class="station-number">${String(i + 1).padStart(2, '0')}</span><span class="station-node" aria-hidden="true"></span><strong class="station-name">${name}</strong><span class="station-text">${text}</span></li>`).join('')}</ol>`;
}

// The review instrument: one packet claim traced to its sources, then the saved interval and bounded replay.
function specimen(corpus, stress) {
  const claim = corpus.claims[0];
  return `<section class="instrument specimen" aria-labelledby="specimen-title"><header class="instrument-head"><h2 id="specimen-title" class="instrument-title">PsychDoc specimen</h2><span class="pill">${e(claim.status)}</span></header>${traceSpecimen(corpus, claim)}<div class="replay" data-bias-root><div class="replay-head"><h3 class="replay-title">Saved estimate and interval</h3>${chartLegend(stress, { withUnit: false })}</div><p class="replay-unit">${e(stress.unit || 'Hedges’ g')}; ${e(stress.direction || 'Negative values favour psilocybin')}</p><div data-interval-chart>${intervalFigure(stress)}</div><div class="replay-grid"><div class="replay-controls">${biasControl(stress, 'review-')}<p class="scenario-result" data-scenario-result aria-live="polite" aria-atomic="true">${scenarioSummary(stress, calculateBiasScenario(stress, 0))}</p></div><div class="replay-notes">${biasExplanation('review-')}${referenceNote}</div></div></div><footer class="instrument-foot"><span>Prepared source packet <code>${e(corpus.sourceVersion)}</code></span><span class="instrument-foot-action">Open the record, inspect the limit <a href="/demo/#corpus-${e(corpus.id)}" aria-label="Inspect the PsychDoc evidence specimen">Inspect</a></span></footer></section>`;
}

// The illustration shows inclusion in the saved primary analysis. Position is a layout choice;
// neither the lines nor their length encode citation, study independence or effect size.
function evidenceHero(corpus, trials) {
  if (!trials || trials.trials.length !== trials.analysis.k) throw new Error('Hero needs exactly primary.k trial records');
  const doiURL = doi => doi.startsWith('https://doi.org/') ? doi : `https://doi.org/${doi}`;
  const records = trials.trials.map((trial, index) => `<li data-trial="${e(trial.id)}" style="--seq:${index}"><a href="${e(trial.dois.length ? doiURL(trial.dois[0]) : '/company-assets/data/sypres-primary-trials.json')}" data-trial-choice="${e(trial.id)}"><span class="record-node" aria-hidden="true"></span><span>${e(trial.study)}</span><span class="record-open" aria-hidden="true">↗</span></a></li>`).join('');
  const trialPanels = trials.trials.map(trial => `<div data-trial-panel="${e(trial.id)}" hidden><p class="label">Included trial record</p><h2 id="trial-title-${e(trial.id)}">${e(trial.study)}</h2><p>One of the 12 trials in the saved primary analysis. The source CSV records ${trial.csvRows} rows for this trial; rows are not independent trials.</p><dl><dt>Registration, as recorded</dt><dd>${e(trial.registration || 'Not recorded')}</dd><dt>Publications recorded for this trial</dt><dd>${trial.dois.length ? `<ul>${trial.dois.map(doi => `<li><a href="${e(doiURL(doi))}">${e(doi)} ↗</a></li>`).join('')}</ul>` : 'None recorded'}</dd></dl><p class="caption">SYPRES depression-psiloctr, version 25.1.2. This panel identifies sources; it does not report a trial-specific effect.</p></div>`).join('');
  const trialDialog = `<dialog class="trial-dialog" data-trial-dialog><form method="dialog"><button type="submit" aria-label="Close trial record">Close <span aria-hidden="true">×</span></button></form>${trialPanels}<a class="text-link" href="/company-assets/data/sypres-primary-trials.json" download>Download all 12 trial records</a></dialog>`;
  const paths = Array.from({ length: trials.trials.length }, (_, i) => {
    const x = 20 + i * 560 / (trials.trials.length - 1);
    return `<path class="assembly-line" pathLength="1" style="--seq:${i}" d="M${x.toFixed(2)} 0 C${x.toFixed(2)} 60 300 42 300 108"/>`;
  }).join('');
  return `<figure class="evidence-hero instrument" aria-labelledby="evidence-hero-title" data-trace-story data-stage="static"><div class="evidence-hero-top"><div class="instrument-title-row"><p id="evidence-hero-title">Every conclusion has a history.</p><button class="trace-playback" type="button" data-playback hidden>Play trace</button></div><span class="caption">PsychDoc / saved primary analysis</span></div><div class="source-assembly"><p class="assembly-label">The ${trials.trials.length} included trial records <span class="assembly-instruction">Select one to inspect ↗</span></p><ul class="trial-records" aria-label="Trials included in the saved primary analysis">${records}</ul><svg class="assembly-convergence" viewBox="0 0 600 112" aria-hidden="true" focusable="false">${paths}<circle cx="300" cy="108" r="4"/></svg><div class="assembly-claim"><p class="assembly-label">One inspectable claim</p><p class="assembly-claim-text">${e(corpus.claims[0].text)}</p><p class="assembly-limit">${e(corpus.claims[0].caveat)}</p></div></div><figcaption class="evidence-hero-caption"><span>SYPRES depression-psiloctr, version 25.1.2. Lines show inclusion in this saved analysis.</span><a href="/review/#review-specimen">Follow the evidence</a></figcaption>${trialDialog}</figure>`;
}

export function homePage(corpora, stress, trials) {
  const corpus = corpora.find(item => item.id === stress.corpusId);
  return shell('/', 'Violema: scientific conclusions, with their evidence attached', 'Violema builds scientific evidence systems that connect claims to sources, expose consequential assumptions, and keep conclusions open to review.', homeExperience({
    corpora,
    hero: evidenceHero(corpus, trials),
    map: evidenceMapSection(evidenceMap, evidenceMapHash),
    mapData: evidenceMap,
  }));
}

export function reviewPage(corpora, stress) {
  const corpus = corpora.find(c => c.id === stress.corpusId);
  return shell('/review/', 'Scientific review | Violema', 'A focused walkthrough for physicians and researchers: inspect a PsychDoc claim, its sources, an explicit assumption, and the boundary between animal and human evidence.', [
    `<section class="page-head review-head"><div class="wrap"><p class="label">For physicians and researchers</p><h1>Help us find<br>where the reasoning breaks.</h1><p class="lede">A first look at Violema through PsychDoc, our first scientific application. Start with one claim, follow the evidence, and challenge the interpretation.</p><div class="review-intro"><p>Allow about 15 minutes. The goal is to identify corrections and useful next questions. Independent source and method review is still open.</p><a class="button button-primary" href="#review-specimen">Start with the claim</a></div></div></section>`,
    `<section class="section" id="review-specimen" aria-labelledby="review-walkthrough-title"><div class="wrap review-layout"><div class="review-guide"><h2 id="review-walkthrough-title">A short review path.</h2><ol class="review-steps"><li><h3>Read the claim and its limit</h3><p>The saved result pools mixed trial populations and controls. Read what it does and does not establish before considering its practical meaning.</p><a href="/demo/#claim-psychdoc-primary">Open Claim 1 in the evidence lab</a></li><li><h3>Check the source record</h3><p>Follow the dataset, saved analysis, published meta-analysis and author code. Check population, comparator, endpoint and time window against the original sources.</p><a href="/company-assets/data/sypres-primary-trials.json" download>Download the 12 trial records</a></li><li><h3>Challenge an assumption</h3><p>Move the assumed additive shift. The estimate and both interval endpoints move together; no model is refitted and no actual bias is estimated.</p><a href="${psychdoc}/#stress">Inspect the canonical analysis ${external}</a></li><li><h3>Check what transfers to humans</h3><p>Compare the scope of the mechanistic evidence with the clinical claims. Use the animal and human study labels, then inspect the original paper.</p><a href="#animal-human-scope">Review the animal / human boundary</a></li></ol></div>${specimen(corpus, stress)}</div></section>`,
    `<section class="section" id="animal-human-scope" aria-labelledby="scope-title"><div class="wrap review-scope"><div><p class="label">Scope matters</p><h2 id="scope-title">Animal findings.<br>Human conclusions.</h2></div><div><p class="lede">A finding outside one comparison is not absent from the literature.</p><p>PsychDoc’s “Where the evidence stops” comparison does not currently include animal findings. Its study-type controls highlight matching evidence in that comparison; they do not search the whole research record.</p><p>A separate PsychDoc evidence page includes a mouse finding from Shao et al. (2021). Review that claim in its own experimental context before connecting it to a human mechanism or clinical outcome.</p><div class="link-row"><a class="text-link" href="${psychdoc}/#chain">Inspect the comparison ${external}</a><a class="text-link" href="${psychdoc}/evidence/psilocybin-rewiring#c-mouse-spines-persist">Inspect the mouse finding ${external}</a></div></div></div></section>`,
    `<section class="section" aria-labelledby="review-questions-title"><div class="wrap split"><div><p class="label">What would improve this</p><h2 id="review-questions-title">Five questions<br>for your review.</h2><p class="lede">A specific correction is more useful than a general endorsement.</p></div><ol class="review-questions"><li><h3>Does the claim match its source?</h3><p>Flag the exact wording that overstates, omits or misrepresents a finding. Include the publication and passage when possible.</p></li><li><h3>Which differences should block a comparison?</h3><p>Identify populations, controls, endpoints, timing or repeated samples that need to be distinguished more clearly.</p></li><li><h3>Is the assumption replay easy to misread?</h3><p>Point out where an assumed shift might look like a measured bias, a newly fitted result or a clinical threshold.</p></li><li><h3>Where does the animal-to-human inference go too far?</h3><p>Name the missing evidence or experimental condition required to support that step.</p></li><li><h3>What real research decision would this help?</h3><p>Suggest one question you would use it for, the minimum evidence needed, and what would make you return to the record.</p></li></ol></div></section>`,
    `<section class="section" aria-labelledby="review-next-title"><div class="wrap review-next"><div><h2 id="review-next-title">Bring the correction.<br>We will keep the trail.</h2><p>Share short notes with the person who sent this walkthrough: the claim or page, the source, what should change, and why. That feedback can improve the wording, source links, scope labels or next analysis.</p><p class="small">Please use published research and general workflow examples. Do not include patient information. This page does not collect review submissions.</p></div><div><p class="label">The broader method</p><h3>Another question, different constraints.</h3><p>The Materials research example keeps source records and test conditions visible without presenting a pooled effect.</p><a class="text-link" href="/demo/#corpus-perovskite-stability">Explore the second example</a><a class="text-link" href="/method/">Read the Violema method</a></div></div></section>`,
  ].join(''), { lab: true });
}

export function methodPage(corpora,stress) {
  const c=corpora.find(c=>c.id==='psychdoc');
  const materials=corpora.find(c=>c.id==='perovskite-stability');
  const facts = corpus => `<dl class="facts facts-compact"><div><dt>Claims</dt><dd>${corpus.claims.length}</dd></div><div><dt>Sources</dt><dd>${corpus.sources.length}</dd></div></dl>`;
  return shell('/method/','The method | Violema','Inspect the path from a scientific source to a claim, its assumptions, and review status. See what is implemented and what remains research.',[
    `<section class="page-head"><div class="wrap split"><div><p class="label">The method</p><h1>A conclusion should<br>show its working.</h1></div><p class="lede page-lede">Sources, studies, claims, and assumptions have different jobs. Keeping them distinct makes it possible to see where evidence ends and interpretation begins.</p></div></section>`,
    `<section class="protocol-band"><div class="wrap">${protocol()}<p class="small protocol-note">This is the organizing workflow. The prepared demonstration uses curated source records; it does not automate every step.</p></div></section>`,
    howItWorksSection(howItWorks),
    crossFieldSection(howItWorks),
    `<section class="method-row" id="trace" aria-labelledby="trace-title"><div class="wrap method-grid"><div class="method-copy"><p class="label">Trace</p><h2 id="trace-title">Count studies carefully.<br>Keep reports connected.</h2><p>A new publication may describe a new experiment, a follow-up, or an existing sample. These are different kinds of evidence.</p><p>The current packet preserves explicit source-to-claim links. Reviewed study and sample relationships are a development priority. Shared authors alone do not establish shared participants or independence.</p><a class="text-link" href="/demo/">Follow a source-linked claim</a></div><div class="instrument method-specimen"><div class="instrument-head"><p class="instrument-title">Example from the prepared packet</p><span class="pill">${e(c.claims[0].status)}</span></div>${traceSpecimen(c, c.claims[0], { limitLabel: 'Limit recorded beside the claim' })}</div></div></section>`,
    `<section class="method-row" id="assumptions" aria-labelledby="assumptions-title"><div class="wrap method-grid"><div class="method-copy"><p class="label">Challenge</p><h2 id="assumptions-title">Make the assumption<br>part of the result.</h2><p>A result can be precise under one set of choices and fragile under another. The interface should show which choice changed and which conclusion it affects.</p><p>In this preview, the PsychDoc control replays an assumed additive bias shift against a saved result. It does not estimate actual bias, refit a model, or assign a probability that a claim is true.</p><a class="text-link" href="/demo/#corpus-psychdoc">Replay the saved analysis</a></div><div class="instrument method-specimen"><div class="instrument-head"><p class="instrument-title">A bounded demonstration</p><span class="caption">${e(stress.unit || 'Hedges’ g')}</span></div><div class="replay" data-bias-root>${chartLegend(stress, { withUnit: false })}<div data-interval-chart>${intervalFigure(stress)}</div><p class="caption">${e(stress.direction)}. The original interval is retained and translated with the assumed shift.</p>${biasControl(stress, 'method-')}<p class="scenario-result" data-scenario-result aria-live="polite" aria-atomic="true">${scenarioSummary(stress, calculateBiasScenario(stress, 0))}</p>${biasExplanation('method-')}${referenceNote}</div><div class="instrument-foot"><span class="pill">${e(stress.reviewStatus)}</span></div></div></div></section>`,
    `<section class="method-row" id="transfer" aria-labelledby="transfer-title"><div class="wrap method-grid"><div class="method-copy"><p class="label">Transfer</p><h2 id="transfer-title">The same record.<br>Different scientific constraints.</h2><p>Source identity, claim links, preparation history, and review status can travel across domains. Statistical compatibility has to be established for each question.</p><p>The materials packet retains conditions such as illumination, temperature, and the stability endpoint. No pooled result is presented when the recorded inputs do not justify one.</p><a class="text-link" href="/demo/#corpus-perovskite-stability">Compare the materials conditions</a></div><div class="instrument method-specimen"><div class="transfer-grid"><div class="transfer-cell"><p class="label">PsychDoc</p><h3>Saved statistical replay</h3><p>One pinned psilocybin analysis; assumption control with declared limits.</p>${facts(c)}</div><div class="transfer-cell"><p class="label">Perovskite stability</p><h3>Condition comparison</h3><p>Different test contexts remain visible; no pooled statistical endpoint.</p>${facts(materials)}</div></div><div class="instrument-foot transfer-foot"><p class="caption">A shared presentation contract and existing source-reference checks have been exercised with both packets. This does not demonstrate general extraction or quantitative portability. <a href="/company-assets/data/portability-receipt.json" download>Download the check receipt.</a></p></div></div></div></section>`,
    `<section class="section" aria-labelledby="capability-title"><div class="wrap split"><div><h2 id="capability-title">What exists.<br>What comes next.</h2><p class="lede">The interface is only useful if its status is as inspectable as its sources.</p></div><div class="capabilities"><div class="capability"><span class="pill pill-filled">In this preview</span><p>Two curated source packets, claim-source links, condition comparison, versioned downloads, and a bounded saved-analysis replay.</p></div><div class="capability"><span class="pill">Review pending</span><p>Independent verification of scientific inputs and methods. A clear presentation is not evidence that this review has happened.</p></div><div class="capability"><span class="pill">Development</span><p>Reviewed study/sample relationships, source-linked assumption boundaries, and evidence-change impact. These are directions, not shipped guarantees.</p></div></div></div></section>`,
    `<section class="section closing" aria-labelledby="closing-title"><div class="wrap split"><h2 id="closing-title">Inspect the record.</h2><div class="split-body"><p class="lede">Use the two packets to see what stays consistent and where the science needs different treatment.</p><div class="actions"><a class="button button-primary" href="/demo/">Open the evidence lab</a></div></div></div></section>`,
  ].join(''));
}

export function demoPage(corpora,stress) {
  const segments = corpora.map(c => `<a class="segment" href="#corpus-${e(c.id)}" data-corpus-choice="${e(c.id)}"><span class="segment-indicator" aria-hidden="true"></span><span class="segment-text"><span class="segment-domain">${e(c.domain)}</span><strong>${e(c.title)}</strong></span></a>`).join('');
  return shell('/demo/','Evidence lab | Violema','Inspect two prepared scientific source packets, compare claim conditions, and replay a bounded saved analysis. Review status and provenance remain visible.',[
    `<section class="page-head demo-head"><div class="wrap split"><div><p class="label">Evidence lab</p><h1>Open the record.</h1><p class="lede">Two research questions. One way to inspect sources, claims, and the limits between them.</p></div><div class="prepared-note"><p class="status-line"><span><strong>Prepared source packets</strong> Manual curation. No live ingestion.<br>Scientific review remains pending.</span></p></div></div></section>`,
    `<div class="wrap lab-toolbar"><nav class="segmented corpus-switch" data-corpus-switch aria-label="Choose a research corpus">${segments}</nav><button class="button button-secondary reset-button" type="button" data-reset hidden>Reset demo <span aria-hidden="true">↺</span></button></div>`,
    '<div class="visually-hidden" data-announcement role="status" aria-live="polite"></div>',
    '<noscript><p class="wrap no-js-note">JavaScript is off. Both prepared packets and all claims are shown below; source links and packet downloads remain available. The bias control requires JavaScript.</p></noscript>',
    `<div class="wrap lab-content">${corpora.map(c=>corpusPanel(c,stress)).join('')}</div>`,
    '<section class="wrap demo-closing" aria-label="Scope of this demonstration"><p>This demonstration supports inspection and expert criticism. It is not clinical guidance, a comprehensive literature review, or a claim of validated analysis across arbitrary corpora.</p><a class="text-link" href="/method/">Understand the method</a></section>',
  ].join(''), { lab: true });
}
