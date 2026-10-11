import { escapeHTML as e } from './render.mjs';

// The method page's schematic of the evidence system as PsychDoc runs it, and the planned cross-field step.
// Figures come from data/how-it-works.mjs (PsychDoc version 2.2, in review). The diagrams are inline SVG drawn
// from the site's colour tokens through classes in site.css; no colour is written here. SVG text does not
// wrap, so every line is set by hand to fit its box at the sizes in site.css.

const external = '<span class="external-glyph" aria-hidden="true">↗</span>';
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const longDate = iso => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

// Tag width from approximate advance widths of Inter at 12.5 px (em, by character class), plus padding.
function tagWidth(text) {
  let em = 0;
  for (const ch of text) em += /[ijl.,'’ ]/.test(ch) ? 0.27 : /[frt]/.test(ch) ? 0.37 : /[mw]/.test(ch) ? 0.82 : ch === 'I' ? 0.29 : /[A-Z]/.test(ch) ? 0.68 : 0.57;
  return Math.ceil(em * 12.5 * 1.04) + 18;
}

function tag(text, { x = 14, y = 14, variant = '' } = {}) {
  return `<g class="dg-tag${variant ? ` dg-tag-${variant}` : ''}"><rect x="${x}" y="${y}" width="${tagWidth(text)}" height="24" rx="4"/><text x="${x + 9}" y="${y + 16.5}">${e(text)}</text></g>`;
}

const lines = (items, cls, x, y0, step) => items.map((text, i) => `<text class="${cls}" x="${x}" y="${y0 + i * step}">${e(text)}</text>`).join('');

// One step of the loop: who does it, what it does, and the version 2.2 figure that shows it working.
function step({ x, y, number, who, title, body, figure }) {
  return `<g transform="translate(${x} ${y})"><rect class="dg-box" width="212" height="200" rx="10"/>${tag(who)}<text class="dg-number" x="198" y="31" text-anchor="end">${number}</text><text class="dg-title" x="14" y="66">${e(title)}</text>${lines(body, 'dg-text', 14, 90, 18)}<line class="dg-rule" x1="14" y1="146" x2="198" y2="146"/>${lines(figure, 'dg-figure', 14, 168, 18)}</g>`;
}

const arrowDefs = prefix => `<defs><marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head" d="M0 0 L10 5 L0 10 z"/></marker><marker id="${prefix}-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-head-accent" d="M0 0 L10 5 L0 10 z"/></marker></defs>`;

export function loopDiagram(f) {
  const s = f.screening;
  const steps = [
    { x: 16, y: 20, who: 'Person', title: 'Set the question', body: ['A person sets the', 'question and picks the', 'first seed papers.'], figure: [`1 question, ${s.include.length + s.exclude.length} written rules`] },
    { x: 268, y: 20, who: 'Code, weekly', title: 'Find papers', body: ['A weekly scan follows', 'citations out from the', 'seed papers.'], figure: [`${count(f.scan.seeds, 'seed')}, ${f.scan.candidates} candidates`] },
    { x: 520, y: 20, who: 'AI draft, person', title: 'Screen by the rules', body: ['Each paper: include,', 'exclude or pending,', 'with a reason.'], figure: [`${s.records} records: ${s.included} included,`, `${s.excluded} excluded, ${s.pending} pending`] },
    { x: 772, y: 20, who: 'AI draft, person', title: 'Read the papers', body: ['Sample sizes, timepoints', 'and effects, with exact', 'quotes.'], figure: ['Quotes kept with', 'each claim'] },
    { x: 772, y: 312, who: 'AI draft, person', title: 'Write claims', body: ['One finding, its sources,', 'a tier, and why it has', 'that tier.'], figure: [`${f.claims.total} claims, ${f.claims.preliminary} preliminary`] },
    { x: 520, y: 312, who: 'AI draft, person', title: 'Connect claims', body: ['Typed links, such as', 'extends or measures it', 'differently.'], figure: [`${count(f.claims.relations, 'link')} between claims,`, `${f.claims.posed} posed as a question`] },
    { x: 268, y: 312, who: 'Code, AI tests', title: 'Check independence', body: ['Count research programs;', 'AI stress tests; experts', 'invited.'], figure: [`${f.independence.papers} papers from`, `${f.independence.programs} research programs`] },
    { x: 16, y: 312, who: 'Code, person', title: 'Publish and watch', body: ['Versioned page and map;', 'each change waits for', 'approval.'], figure: [`Version ${f.synthesis.version}, in review`] },
  ];
  const label = 'The PsychDoc pipeline in eight steps: set the question, find papers, screen them against written rules, read them, write claims, connect claims, check independence, publish. Studies added to the synthesis become seeds for the next weekly scan, so the search keeps widening.';
  return `<svg class="dg dg-loop" viewBox="0 0 1000 532" role="img" focusable="false" aria-label="${e(label)}">${arrowDefs('loop')}${steps.map((item, i) => step({ ...item, number: i + 1 })).join('')}`
    + '<line class="dg-edge" x1="230" y1="120" x2="264" y2="120" marker-end="url(#loop-arrow)"/>'
    + '<line class="dg-edge" x1="482" y1="120" x2="516" y2="120" marker-end="url(#loop-arrow)"/>'
    + '<line class="dg-edge" x1="734" y1="120" x2="768" y2="120" marker-end="url(#loop-arrow)"/>'
    + '<line class="dg-edge" x1="878" y1="222" x2="878" y2="308" marker-end="url(#loop-arrow)"/>'
    + '<line class="dg-edge" x1="770" y1="412" x2="736" y2="412" marker-end="url(#loop-arrow)"/>'
    + '<line class="dg-edge" x1="518" y1="412" x2="484" y2="412" marker-end="url(#loop-arrow)"/>'
    + '<line class="dg-edge" x1="266" y1="412" x2="232" y2="412" marker-end="url(#loop-arrow)"/>'
    + '<text class="dg-label" x="866" y="270" text-anchor="end">papers that pass the rules</text>'
    + '<path class="dg-edge-loop" d="M122 310 V 266 H 374 V 224" marker-end="url(#loop-arrow-accent)"/>'
    + '<text class="dg-label dg-label-accent" x="388" y="254">Added studies become seeds</text>'
    + '<text class="dg-label dg-label-accent" x="388" y="272">for the next weekly scan</text>'
    + '</svg>';
}

// A claim drawn as an input to the planned cross-field question: three real ones from version 2.2, one planned.
function claimBox({ x, y, who, text, source, planned = false, height = 108 }) {
  return `<g transform="translate(${x} ${y})"><rect class="${planned ? 'dg-box-planned' : 'dg-box'}" width="300" height="${height}" rx="10"/>${tag(who, { x: 14, y: 12, variant: planned ? 'planned' : '' })}${lines(text, 'dg-text-ink', 14, 58, 18)}${source ? `<text class="dg-small" x="14" y="97">${e(source)}</text>` : ''}</g>`;
}

export function crossFieldDiagram(f) {
  const [rat, mouse, human] = f.converging;
  const label = 'Planned. Three real claims from different labs and journals, in rats, mice and people, plus claims from other fields, would be linked by the system to one posed question. The question would be checked by AI stress tests and signed expert review, offered to labs to test, and carry a contribution record naming the papers, journals, labs, reviewers and the testing lab.';
  return `<svg class="dg dg-cross" viewBox="0 0 1000 510" role="img" focusable="false" aria-label="${e(label)}">${arrowDefs('cross')}`
    + claimBox({ x: 16, y: 20, who: 'Rats, electrophysiology', text: ['Neuron firing still changed months', 'later; synaptic density did not differ.'], source: `${rat.source}, ${rat.venue}` })
    + claimBox({ x: 16, y: 146, who: 'Mice, imaging', text: ['New dendritic spines after one dose,', 'about a third still there a month on.'], source: `${mouse.source}, ${mouse.venue}` })
    + claimBox({ x: 16, y: 272, who: 'People, PET scan', text: ['15 adults: no significant overall rise in', 'synaptic density a week after one dose.'], source: `${human.source}, ${human.venue}` })
    + claimBox({ x: 16, y: 404, who: 'Planned', planned: true, height: 88, text: ['Claims from other questions and', 'fields that measure the same thing.'] })
    + '<path class="dg-edge-planned" d="M316 74 C 348 74, 340 206, 372 206" marker-end="url(#cross-arrow-accent)"/>'
    + '<path class="dg-edge-planned" d="M316 200 C 346 200, 342 234, 372 234" marker-end="url(#cross-arrow-accent)"/>'
    + '<path class="dg-edge-planned" d="M316 326 C 346 326, 342 262, 372 262" marker-end="url(#cross-arrow-accent)"/>'
    + '<path class="dg-edge-planned" d="M316 448 C 350 448, 340 292, 372 292" marker-end="url(#cross-arrow-accent)"/>'
    + '<text class="dg-label dg-label-accent" x="378" y="136">Planned links</text>'
    + `<g transform="translate(376 150)"><rect class="dg-box-posed" width="256" height="198" rx="10"/>${tag('Posed question', { variant: 'posed' })}${lines(['Does the lasting change in neuron', 'function without spine growth,', 'seen in rats months after one', 'dose, hold in other labs, and is', 'there a human counterpart?'], 'dg-text-ink', 14, 62, 18)}${lines(['Listed today as an open question', `in version ${f.synthesis.version}. Not a finding.`], 'dg-small', 14, 162, 18)}</g>`
    + '<path class="dg-edge-planned" d="M632 249 H 646 V 68 H 658" marker-end="url(#cross-arrow-accent)"/>'
    + `<g transform="translate(664 20)"><rect class="dg-box-planned" width="320" height="96" rx="10"/><text class="dg-title" x="14" y="32">Checked</text>${lines(['AI stress tests, then signed', 'expert review.'], 'dg-text', 14, 58, 18)}</g>`
    + '<line class="dg-edge-planned" x1="824" y1="118" x2="824" y2="138" marker-end="url(#cross-arrow-accent)"/>'
    + `<g transform="translate(664 140)"><rect class="dg-box-planned" width="320" height="80" rx="10"/><text class="dg-title" x="14" y="32">Offered to labs to test</text>${lines(['A prediction a lab can confirm or refute.'], 'dg-text', 14, 58, 18)}</g>`
    + '<line class="dg-edge-planned" x1="824" y1="222" x2="824" y2="242" marker-end="url(#cross-arrow-accent)"/>'
    + `<g transform="translate(664 244)"><rect class="dg-box-planned" width="320" height="248" rx="10"/>${tag('Contribution record', { variant: 'planned' })}${lines(['Claims it rests on, each with its paper'], 'dg-text-ink', 14, 64, 18)}${lines([`Journals: ${mouse.venue}, ${rat.venue},`, human.venue], 'dg-text-ink', 14, 88, 18)}${lines([`Labs behind them: ${[mouse.lab, rat.lab, human.lab].join(', ')}`, 'Reviewers who signed the check', 'The lab that tests it, and the result', 'Credit terms agreed before the test'], 'dg-text-ink', 14, 130, 24)}<text class="dg-small" x="14" y="230">Every later use cites the record.</text></g>`
    + '</svg>';
}

function figure(name, svg, legend, caption, regionLabel) {
  return `<figure class="diagram diagram-${name}">${legend}<div class="diagram-scroll" tabindex="0" role="region" aria-label="${e(regionLabel)}">${svg}</div><p class="diagram-hint" aria-hidden="true">Scroll sideways to see the whole diagram.</p><figcaption>${caption}</figcaption></figure>`;
}

export function howItWorksSection(f) {
  // The copy says no signed expert review exists; a recorded review must change the copy, not hide behind it.
  if (f.expertReviews !== 0) throw new Error('Update the expert review copy before publishing a recorded review');
  const s = f.screening;
  const roles = [['Code', 'Runs on its own, on a schedule or at build'], ['AI draft', 'An AI model drafts the decision and its reason'], ['Person', 'A person approves before anything is published (today, the publisher)']];
  const legend = `<ul class="diagram-legend" aria-label="Who does each step">${roles.map(([chip, text]) => `<li><span class="role-chip">${chip}</span>${text}</li>`).join('')}</ul>`;
  const ai = f.aiPolicy;
  const aiNote = `<div class="how-fact how-ai"><h3>Where AI is used in this method</h3><p>PsychDoc, its first application, states this in its AI policy, updated ${longDate(ai.updatedAt)}: “${e(ai.intro)}”</p><ul>${ai.helps.map(step => `<li>${e(step)}</li>`).join('')}</ul><p>The policy also says: “${e(ai.decides)}”</p><p><a class="text-link" href="${e(ai.url)}">Read PsychDoc’s AI policy ${external}</a></p></div>`;
  const rules = `<details class="how-rules"><summary>Read the rules</summary><ul>${s.include.map(rule => `<li><strong>Include</strong> ${e(rule)}</li>`).join('')}${s.exclude.map(rule => `<li><strong>Exclude</strong> ${e(rule)}</li>`).join('')}</ul><p>These rules ask whether a study measured the brain a week or more after dosing. The synthesis has broader rules of its own, and its trust panel counts only verdicts made under those.</p></details>`;
  return `<section class="method-row how-it-works" id="how-it-works" aria-labelledby="how-it-works-title"><div class="wrap">`
    + `<div class="split how-head"><div><p class="label">How it works</p><h2 id="how-it-works-title">From one question<br>to claims you can check.</h2></div><div class="split-body"><p class="lede">PsychDoc, the first application of this method, takes one research question at a time. It finds candidate papers itself by following citations, sorts them by written rules, turns what they report into claims you can check, and keeps scanning for new work.</p><p class="status-line">The numbers come from PsychDoc’s psilocybin synthesis, version ${e(f.synthesis.version)}, which is in review and not yet published.</p></div></div>`
    + figure('loop', loopDiagram(f), legend, 'Steps 1 to 4 turn a question into a set of papers that pass written rules; steps 5 to 8 turn those papers into claims, links and a published page. The violet loop keeps the search widening: every study added to the synthesis must also be listed as a seed, or a test fails the build, and the next weekly scan starts from the larger set. Today a person adds the seeds in the same update; adding them automatically is planned.', 'The eight steps; scroll sideways on narrow screens')
    + `<div class="how-facts">`
    + `<div class="how-fact"><h3>It finds papers itself, by following citations</h3><p>${e(f.scan.schedule)} a scheduled job asks OpenAlex, an open index of scholarly works and the citations between them, two questions about each seed paper: which papers does it cite, and which papers cite it? Of the papers that cite a seed, it keeps the ${f.scan.citingKept} most cited. Seeds are the papers the synthesis already rests on; any paper linked to a seed becomes a candidate.</p><p>The last accepted scan, on ${longDate(f.scan.date)}, started from ${count(f.scan.seeds, 'seed')} and produced ${f.scan.candidates} candidates; the ${f.scan.multiSeed} that link to two or more seeds are read first. It ran before the synthesis grew to ${f.independence.papers} papers, so the next scan starts from more seeds. A scan is saved only when every seed resolves and every request is answered, and it arrives as a pull request that a person reviews.</p><p>New papers have few citations yet, so recent work is easy to miss. A review therefore also runs written keyword searches on OpenAlex and Europe PMC and records the exact queries; in the review of ${longDate(s.date)}, an AI agent ran them. Of the ${s.included} records that passed the rules, the searches found ${s.foundBySearch} and the citation scan ${s.foundByScan}; ${s.scanOnly === 1 ? 'one was' : `${s.scanOnly} were`} found by the scan alone. Running the searches on a schedule is planned.</p></div>`
    + `<div class="how-fact"><h3>It decides what counts by written rules</h3><p>Ranking only sets the reading order. Whether a paper counts is decided against written rules, stored with a version stamp (<code>${e(s.criteriaVersion)}</code>) in the screening record. Each verdict records the version it was made under; if the rules change, old verdicts stop counting until someone looks at them again.</p><p>Every screened record gets a verdict and a one-line reason. On ${longDate(s.date)}, ${s.records} records were screened, the scan’s ${s.fromScan} candidates from 2024 to 2026 and ${s.fromSearch} from the keyword searches: ${s.included} were included, ${s.excluded} excluded and ${s.pending} wait for a full-text check. The other ${s.unscreened} scan candidates have no verdict yet. Excluded papers stay on file with their reason.</p><p>An AI model drafted these rules, each verdict and its reason; a person approves the change before it is published. Today that person is the publisher, until a scientific editor is appointed.</p>${rules}</div>`
    + `<div class="how-fact"><h3>Each finding becomes a claim you can trace to its paper</h3><p>Reading pulls out the population, design, sample size, timepoints, the change measured and its effect size, with the authors’ own words quoted. A claim then states one finding in plain language with its tier and the reason for it, and is linked to other claims by a typed relation: it extends one, measures the same thing differently, differs by population, or suggests a mechanism.</p><p>Version ${e(f.synthesis.version)} has ${f.claims.total} claims; ${f.claims.preliminary} are preliminary. The tiers are established, active debate, preliminary, speculation, and PsychDoc’s own interpretation, which is always posed as a question.</p></div>`
    + `<div class="how-fact"><h3>Agreement from a single team is flagged</h3><p>Code groups the papers into research programs: two papers belong to one program when they share the first or last author, or two or more authors; one shared author in the middle of both lists is a tie, not a merge. Version ${e(f.synthesis.version)} has ${f.independence.papers} papers from ${f.independence.programs} programs. Claims whose two or more sources all come from one program are flagged as convergent but not independent.</p><p>Separate AI agents stress test a posed reading for errors, confounds and overstatement. That is not peer review, and AI is never credited as an author or reviewer. Signed expert review is invited and has not been done for this synthesis; its trust panel says so.</p></div>`
    + aiNote
    + `</div><p class="how-more"><a class="text-link" href="${e(f.synthesis.walkthrough)}">See each step in detail on PsychDoc ${external}</a></p></div></section>`;
}

const statusRows = [
  ['Finding papers', 'A weekly citation scan from the seeds, whose pull request lists newly linked papers; keyword searches run by an AI agent during a review, with the queries recorded.', 'Keyword searches on a schedule, and seeds added automatically when a study joins the synthesis.'],
  ['Deciding relevance', 'Written rules with a version stamp; an AI model drafts each verdict and its reason; a person approves.', 'Screening proposals arrive with each weekly scan, for every candidate, ready for a person to approve.'],
  ['Connecting findings', 'Typed links between claims within one question; PsychDoc’s own readings are posed as questions and stress tested by AI agents.', 'Links across questions, journals and fields through shared measures, populations and mechanisms; the system proposes candidate questions.'],
  ['Independence', 'Research programs computed from author lists; agreement from one program is flagged.', 'The same count across fields, so a cross-field question shows how many separate teams it rests on.'],
  ['Credit', 'Every claim names its papers and authors, with DOI links.', 'A contribution record for each posed question, naming papers, journals, labs, universities, reviewers and the testing lab, with credit terms agreed with partners in advance. Nothing is agreed yet.'],
];

export function crossFieldSection(f) {
  const legend = '<ul class="diagram-legend" aria-label="Outline key"><li><span class="outline-key" aria-hidden="true"></span>Exists today</li><li><span class="outline-key outline-key-planned" aria-hidden="true"></span>Planned</li></ul>';
  return `<section class="method-row" id="cross-field" aria-labelledby="cross-field-title"><div class="wrap">`
    + `<div class="split how-head"><div><p class="label">Where this is going</p><h2 id="cross-field-title">From many papers to new questions,<br>with shared credit.</h2><p class="how-status"><span class="pill">Planned</span></p></div><div class="split-body"><p class="lede">Today PsychDoc links claims inside one question. The plan is to link claims across questions, journals and fields wherever they measure the same thing, so the system can point to a pattern no single paper shows.</p><p>Each such pattern would be posed as a question, checked, offered to labs to test, and carry a record of everyone whose work it rests on.</p></div></div>`
    + figure('cross', crossFieldDiagram(f), legend, `Solid outlines exist today; dashed ones are planned. The three claims are real and come from three labs and three journals; the links into the question would be drawn by the system, which is planned. The question itself is already listed in version ${e(f.synthesis.version)} as an open question.`, 'The planned cross-field question; scroll sideways on narrow screens')
    + `<div class="table-scroll how-table" tabindex="0" role="region" aria-label="PsychDoc today and planned; scroll horizontally if needed"><table><caption>PsychDoc today, and what is planned.</caption><thead><tr><th scope="col">Part</th><th scope="col">Today</th><th scope="col">Planned</th></tr></thead><tbody>${statusRows.map(([part, today, planned]) => `<tr><th scope="row">${part}</th><td>${today}</td><td>${planned}</td></tr>`).join('')}</tbody></table></div>`
    + `</div></section>`;
}
