import { escapeHTML as e, sourceURL, corpusPanel, intervalFigure, calculateBiasScenario, chartLegend, biasControl, biasExplanation, referenceNote, scenarioSummary, traceSpecimen } from './render.mjs';

const icon = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>';
const psychdoc = 'https://psychdoc.ai';
const nav = (route,href,label) => `<a href="${href}"${route===href?' aria-current="page"':''}>${label}</a>`;
const external = '<span class="external-glyph" aria-hidden="true">↗</span>';
const fontFiles = ['instrument-sans-latin-wght-normal.woff2', 'inter-latin-wght-normal.woff2'];

function head(route, title, description) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}">`,
    '<meta name="robots" content="noindex,nofollow">',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#F5F6F8" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0E1117" media="(prefers-color-scheme: dark)">',
    `<link rel="canonical" href="https://violema.com${route}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Violema">',
    `<meta property="og:title" content="${e(title)}">`,
    `<meta property="og:description" content="${e(description)}">`,
    `<meta property="og:url" content="https://violema.com${route}">`,
    '<link rel="icon" href="/company-assets/violema-icon.svg" type="image/svg+xml">',
    ...fontFiles.map(file => `<link rel="preload" href="/company-assets/fonts/${file}" as="font" type="font/woff2" crossorigin>`),
    '<link rel="stylesheet" href="/company-assets/site.css">',
  ].join('');
}

function siteHeader(route) {
  return `<header class="site-header" data-site-header><div class="wrap header-inner"><a class="wordmark" href="/" aria-label="Violema home">Violema</a><nav class="primary-nav" aria-label="Main navigation">${nav(route, '/method/', 'Method')}${nav(route, '/demo/', 'Evidence lab')}<a href="${psychdoc}">PsychDoc ${external}</a></nav></div></header>`;
}

function siteFooter() {
  return `<footer class="site-footer"><div class="wrap"><div class="footer-main"><a class="wordmark footer-wordmark" href="/">Violema</a><p class="footer-tagline">Scientific conclusions.<br>With their evidence attached.</p><nav class="footer-nav" aria-label="Footer navigation"><a href="/method/">Method</a><a href="/demo/">Evidence lab</a><a href="${psychdoc}/#briefing">Request a scientific briefing ${external}</a></nav></div><div class="footer-meta"><span>Prepared demonstration · independent scientific review pending</span><span>Existing workspace: <span class="planned-destination">agent.purpleorange.ai</span> <small>planned destination, not live here</small></span></div></div></footer>`;
}

export function shell(route, title, description, content) {
  return `<!doctype html><html lang="en"><head>${head(route, title, description)}</head><body><a class="skip-link" href="#main">Skip to content</a>${siteHeader(route)}<main id="main">${content}</main>${siteFooter()}<script type="module" src="/company-assets/browser/site.mjs"></script></body></html>`;
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
  return `<ol class="protocol" aria-label="Evidence workflow">${protocolSteps.map(([name, text], i) => `<li class="station"><span class="station-number">${String(i + 1).padStart(2, '0')}</span><span class="station-node" aria-hidden="true"></span><strong class="station-name">${name}</strong><span class="station-text">${text}</span></li>`).join('')}</ol>`;
}

// The hero instrument: one packet claim traced to its sources, then the saved interval and the bounded replay.
function specimen(corpus, stress) {
  const claim = corpus.claims[0];
  return `<section class="instrument specimen" aria-labelledby="specimen-title"><header class="instrument-head"><h2 id="specimen-title" class="instrument-title">PsychDoc specimen</h2><span class="pill">${e(claim.status)}</span></header>${traceSpecimen(corpus, claim, { animate: true })}<div class="replay" data-bias-root><div class="replay-head"><h3 class="replay-title">Saved estimate and interval</h3>${chartLegend(stress, { withUnit: false })}</div><p class="replay-unit">${e(stress.unit || 'Hedges’ g')}; ${e(stress.direction || 'Negative values favour psilocybin')}</p><div data-interval-chart>${intervalFigure(stress)}</div><div class="replay-grid"><div class="replay-controls">${biasControl(stress, 'hero-')}<p class="scenario-result" data-scenario-result aria-live="polite" aria-atomic="true">${scenarioSummary(stress, calculateBiasScenario(stress, 0))}</p></div><div class="replay-notes">${biasExplanation('hero-')}${referenceNote}</div></div></div><footer class="instrument-foot"><span>Prepared source packet <code>${e(corpus.sourceVersion)}</code></span><a href="/demo/#corpus-${e(corpus.id)}" aria-label="Inspect the PsychDoc evidence specimen">Inspect</a></footer></section>`;
}

function teaser(corpora) {
  const tabs = corpora.map(c => `<a class="segment" href="#teaser-${e(c.id)}" data-tab="teaser-${e(c.id)}"><span class="segment-indicator" aria-hidden="true"></span><span class="segment-text">${e(c.domain)}</span></a>`).join('');
  const panels = corpora.map(c => `<article class="teaser-card" id="teaser-${e(c.id)}" aria-labelledby="teaser-title-${e(c.id)}"><h3 id="teaser-title-${e(c.id)}">${e(c.title)}</h3><p class="teaser-question">${e(c.question)}</p><p class="small">${e(c.summary)}</p><dl class="facts"><div><dt>Claims</dt><dd>${c.claims.length}</dd></div><div><dt>Sources</dt><dd>${c.sources.length}</dd></div><div><dt>Version</dt><dd><code>${e(c.sourceVersion)}</code></dd></div></dl><p class="status-line">${e(c.reviewStatus)}</p><a class="button button-secondary" href="/demo/#corpus-${e(c.id)}">Try the evidence lab</a></article>`).join('');
  return `<div class="teaser-panel" data-tabs><nav class="segmented" data-tablist aria-label="Choose a research corpus">${tabs}</nav>${panels}</div>`;
}

export function homePage(corpora,stress) {
  const corpus=corpora.find(c=>c.id===stress.corpusId);
  return shell('/','Violema: scientific conclusions, with their evidence attached','Violema builds scientific evidence systems that connect claims to sources, expose consequential assumptions, and keep conclusions open to review.',[
    `<section class="hero" aria-labelledby="hero-title"><div class="wrap hero-grid"><div class="hero-copy"><p class="label">Scientific evidence systems</p><h1 id="hero-title">Know which conclusions hold.<br>And why.</h1><p class="lede">Violema connects scientific claims to their sources, makes consequential assumptions visible, and keeps the record open to review.</p><div class="actions"><a class="button button-primary" href="${psychdoc}">Explore PsychDoc ${external}</a><a class="button button-secondary" href="/method/">See the method</a></div><p class="hero-note">First application: neuropsychiatric evidence.<br>Built to be inspected, challenged, and improved.</p></div>${specimen(corpus, stress)}</div></section>`,
    `<section class="statement" aria-label="Why the links matter"><div class="wrap statement-grid"><p class="statement-text">A paper is a source.<br>A conclusion is a chain of reasoning.</p><p class="statement-body">We make the links inspectable: which study supports a claim, what a model assumes, and where an interpretation stops.</p></div></section>`,
    `<section class="section" aria-labelledby="protocol-title"><div class="wrap"><div class="section-head"><div><p class="label">The method</p><h2 id="protocol-title">Keep the reasoning<br>close to the evidence.</h2></div><a class="text-link" href="/method/">Inspect the workflow</a></div>${protocol()}<div class="uses"><a class="use" href="/method/#trace"><h3>Trace the claim</h3><p>Move from a conclusion to the supporting publication, recorded conditions, and limits.</p></a><a class="use" href="/method/#assumptions"><h3>Expose the assumption</h3><p>Distinguish what the source reports from what an analysis assumes.</p></a><a class="use" href="/method/#transfer"><h3>Test what transfers</h3><p>Switch research questions while keeping source identity and review status explicit.</p></a></div></div></section>`,
    `<section class="section" aria-labelledby="application-title"><div class="wrap split"><div><p class="label">First application</p><h2 id="application-title">PsychDoc.<br>From molecule to clinic.</h2></div><div class="split-body"><p class="lede">Explore a source-linked map of psychedelic research and a saved statistical analysis.</p><p class="status-line">The evidence is available to inspect; independent source and method review remains unfinished.</p><div class="actions"><a class="button button-primary" href="${psychdoc}">Explore PsychDoc ${external}</a></div><div class="card application-card"><p class="label">An assumption, made visible</p><h3>Does the interpretation survive a different assumption?</h3><p>A saved psilocybin analysis lets you see how an assumed bias shift moves an estimate and its interval. It is a bounded replay of an existing result. The interactive lab states the source, assumptions, and review limits.</p><div class="link-row"><a class="text-link" href="/demo/#corpus-psychdoc">Try the evidence lab</a><a class="text-link" href="${psychdoc}/#evidence">Inspect the canonical evidence ${external}</a></div></div></div></div></section>`,
    `<section class="section" aria-labelledby="teaser-heading"><div class="wrap split"><div><p class="label">Evidence lab</p><h2 id="teaser-heading">Open the record.</h2><p class="lede">Two research questions. One way to inspect sources, claims, and the limits between them.</p></div>${teaser(corpora)}</div></section>`,
    `<section class="section" aria-labelledby="research-title"><div class="wrap"><div class="research"><div class="research-aside"><p class="label">Research direction</p><h2 id="research-title">Oryx</h2><span class="pill">In development</span></div><div class="research-body"><h3>Another domain should change the questions, not erase the evidence trail.</h3><p>Oryx is a broader research direction in scientific synthesis, still in development. Separately, the materials packet asks how perovskite stability reports compare under different conditions. It is a transfer specimen for the evidence workflow, not an Oryx product or a quantitative validation.</p><a class="text-link" href="/demo/#corpus-perovskite-stability">Inspect the materials packet</a></div></div></div></section>`,
    `<section class="section closing" aria-labelledby="closing-title"><div class="wrap split"><h2 id="closing-title">Start with a conclusion<br>worth getting right.</h2><div class="split-body"><p class="lede">Walk through the evidence, challenge the assumptions, and identify the next question that needs a defensible answer.</p><div class="actions"><a class="button button-primary" href="${psychdoc}/#briefing">Request a scientific briefing ${external}</a></div></div></div></section>`,
  ].join(''));
}

export function methodPage(corpora,stress) {
  const c=corpora.find(c=>c.id==='psychdoc');
  const materials=corpora.find(c=>c.id==='perovskite-stability');
  const facts = corpus => `<dl class="facts facts-compact"><div><dt>Claims</dt><dd>${corpus.claims.length}</dd></div><div><dt>Sources</dt><dd>${corpus.sources.length}</dd></div></dl>`;
  return shell('/method/','The method | Violema','Inspect the path from a scientific source to a claim, its assumptions, and review status. See what is implemented and what remains research.',[
    `<section class="page-head"><div class="wrap split"><div><p class="label">The method</p><h1>A conclusion should<br>show its working.</h1></div><p class="lede page-lede">Sources, studies, claims, and assumptions have different jobs. Keeping them distinct makes it possible to see where evidence ends and interpretation begins.</p></div></section>`,
    `<section class="protocol-band"><div class="wrap">${protocol()}<p class="small protocol-note">This is the organizing workflow. The prepared demonstration uses curated source records; it does not automate every step.</p></div></section>`,
    `<section class="method-row" id="trace" aria-labelledby="trace-title"><div class="wrap method-grid"><div class="method-copy"><p class="label">Trace</p><h2 id="trace-title">Count studies carefully.<br>Keep reports connected.</h2><p>A new publication may describe a new experiment, a follow-up, or an existing sample. These are different kinds of evidence.</p><p>The current packet preserves explicit source-to-claim links. Reviewed study and sample relationships are a development priority. Shared authors alone do not establish shared participants or independence.</p><a class="text-link" href="/demo/">Follow a source-linked claim</a></div><div class="instrument method-specimen"><div class="instrument-head"><p class="instrument-title">Example from the prepared packet</p><span class="pill">${e(c.claims[0].status)}</span></div>${traceSpecimen(c, c.claims[0], { limitLabel: 'Limit recorded beside the claim' })}</div></div></section>`,
    `<section class="method-row" id="assumptions" aria-labelledby="assumptions-title"><div class="wrap method-grid"><div class="method-copy"><p class="label">Challenge</p><h2 id="assumptions-title">Make the assumption<br>part of the result.</h2><p>A result can be precise under one set of choices and fragile under another. The interface should show which choice changed and which conclusion it affects.</p><p>In this preview, the PsychDoc control replays an assumed additive bias shift against a saved result. It does not estimate actual bias, refit a model, or assign a probability that a claim is true.</p><a class="text-link" href="/demo/#corpus-psychdoc">Replay the saved analysis</a></div><div class="instrument method-specimen"><div class="instrument-head"><p class="instrument-title">A bounded demonstration</p><span class="caption">${e(stress.unit || 'Hedges’ g')}</span></div><div class="replay replay-static">${chartLegend(stress, { withUnit: false })}${intervalFigure(stress)}<p class="caption">${e(stress.direction)}. The original interval is retained and translated with the assumed shift.</p></div><div class="instrument-foot"><span class="pill">${e(stress.reviewStatus)}</span></div></div></div></section>`,
    `<section class="method-row" id="transfer" aria-labelledby="transfer-title"><div class="wrap method-grid"><div class="method-copy"><p class="label">Transfer</p><h2 id="transfer-title">The same record.<br>Different scientific constraints.</h2><p>Source identity, claim links, preparation history, and review status can travel across domains. Statistical compatibility has to be established for each question.</p><p>The materials packet retains conditions such as illumination, temperature, and the stability endpoint. No pooled result is presented when the recorded inputs do not justify one.</p><a class="text-link" href="/demo/#corpus-perovskite-stability">Compare the materials conditions</a></div><div class="instrument method-specimen"><div class="transfer-grid"><div class="transfer-cell"><p class="label">PsychDoc</p><h3>Saved statistical replay</h3><p>One pinned psilocybin analysis; assumption control with declared limits.</p>${facts(c)}</div><div class="transfer-cell"><p class="label">Perovskite stability</p><h3>Condition comparison</h3><p>Different test contexts remain visible; no pooled statistical endpoint.</p>${facts(materials)}</div></div><div class="instrument-foot transfer-foot"><p class="caption">A shared presentation contract and existing source-reference checks have been exercised with both packets. This does not demonstrate general extraction or quantitative portability. <a href="/company-assets/data/portability-receipt.json" download>Download the check receipt.</a></p></div></div></div></section>`,
    `<section class="section" aria-labelledby="capability-title"><div class="wrap split"><div><h2 id="capability-title">What exists.<br>What comes next.</h2><p class="lede">The interface is only useful if its status is as inspectable as its sources.</p></div><div class="capabilities"><div class="capability"><span class="pill pill-filled">In this preview</span><p>Two curated source packets, claim-source links, condition comparison, versioned downloads, and a bounded saved-analysis replay.</p></div><div class="capability"><span class="pill">Review pending</span><p>Independent verification of scientific inputs and methods. A clear presentation is not evidence that this review has happened.</p></div><div class="capability"><span class="pill">Development</span><p>Reviewed study/sample relationships, source-linked assumption boundaries, and evidence-change impact. These are directions, not shipped guarantees.</p></div></div></div></section>`,
    `<section class="section closing" aria-labelledby="closing-title"><div class="wrap split"><h2 id="closing-title">Inspect the record.</h2><div class="split-body"><p class="lede">Use the two packets to see what stays consistent and where the science needs different treatment.</p><div class="actions"><a class="button button-primary" href="/demo/">Open the evidence lab</a></div></div></div></section>`,
  ].join(''));
}

export function demoPage(corpora,stress) {
  return shell('/demo/','Evidence lab | Violema','Inspect two prepared scientific source packets, compare claim conditions, and replay a bounded saved analysis. Review status and provenance remain visible.',`<section class="page-heading demo-heading content-width"><div><span class="context-line"><span class="context-mark"></span>Evidence lab</span><h1>Open the record.</h1><p>Two research questions. One way to inspect sources, claims, and the limits between them.</p></div><div class="prepared-note"><span class="status-dot"></span><p><strong>Prepared source packets</strong>Manual curation. No live ingestion.<br>Scientific review remains pending.</p></div></section><div class="lab-toolbar content-width"><nav class="corpus-choices" data-corpus-switch aria-label="Choose a research corpus">${corpora.map(c => `<a href="#corpus-${e(c.id)}" data-corpus-choice="${e(c.id)}"><span>${e(c.domain)}</span><strong>${e(c.title)}</strong></a>`).join('')}</nav><button class="reset-button" type="button" data-reset hidden>Reset demo <span aria-hidden="true">↺</span></button></div><div class="visually-hidden" data-announcement role="status" aria-live="polite"></div><noscript><p class="no-js-note content-width">JavaScript is off. Both prepared packets and all claims are shown below; source links and packet downloads remain available. The bias control requires JavaScript.</p></noscript><div class="lab-content content-width">${corpora.map(c=>corpusPanel(c,stress)).join('')}</div><section class="demo-closing content-width"><p>This demonstration supports inspection and expert criticism. It is not clinical guidance, a comprehensive literature review, or a claim of validated analysis across arbitrary corpora.</p><a class="text-link" href="/method/">Understand the method ${icon}</a></section>`);
}
