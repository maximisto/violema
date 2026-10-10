export const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
export function sourceURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? escapeHTML(url.href) : '#'; } catch { return '#'; }
}
const e = escapeHTML;
const n = value => Number(value).toFixed(2).replace('-', '−');
export const packetURL = corpus => `/company-assets/data/${encodeURIComponent(corpus.id)}.json`;

export function calculateBiasScenario(stress, value) {
  const bias = Number(value);
  if (!Number.isFinite(bias) || bias < stress.biasRange[0] || bias > stress.biasRange[1]) throw new RangeError('Bias must be within the declared range.');
  if (![stress.estimate, stress.lower, stress.upper].every(Number.isFinite) || stress.lower > stress.upper) throw new TypeError('A finite ordered interval is required.');
  return { bias, estimate: stress.estimate + bias, lower: stress.lower + bias, upper: stress.upper + bias };
}

// Presentation only: x positions are percentages on fixed pixel rows, so labels keep a readable
// size from phone to desktop instead of shrinking with a viewBox. The arithmetic above is unchanged.
const scaleDomain = [-1.6, 0.6];
const scaleTicks = [-1.5, -1, -.5, 0, .5];
const scaleX = value => `${(4 + (value - scaleDomain[0]) / (scaleDomain[1] - scaleDomain[0]) * 92).toFixed(3)}%`;

export function intervalFigure(stress, bias = 0) {
  const scenario = calculateBiasScenario(stress, bias);
  const x = scaleX;
  const cap = (value, y) => `<line x1="${x(value)}" y1="${y - 7}" x2="${x(value)}" y2="${y + 7}" class="chart-interval"/>`;
  return `<svg class="interval-chart" role="img" focusable="false" aria-label="Saved estimate ${n(scenario.estimate)}, interval ${n(scenario.lower)} to ${n(scenario.upper)} in ${e(stress.unit || 'Hedges’ g')}; assumed shift ${n(bias)}."><title>Saved analysis with an assumed additive shift</title>`
    + scaleTicks.map(v => `<line x1="${x(v)}" y1="22" x2="${x(v)}" y2="94" class="chart-grid"/><text x="${x(v)}" y="112" text-anchor="middle" class="chart-tick">${n(v)}</text>`).join('')
    + stress.thresholds.map((v, i) => `<line x1="${x(v)}" y1="18" x2="${x(v)}" y2="98" class="chart-threshold"/><text x="${x(v)}" y="${i ? 12 : 132}" text-anchor="middle" class="threshold-text">${n(v)} reference</text>`).join('')
    + `<line x1="${x(stress.lower)}" y1="42" x2="${x(stress.upper)}" y2="42" class="chart-baseline"/><circle cx="${x(stress.estimate)}" cy="42" r="4.5" class="chart-baseline-dot"/>`
    + `<line x1="${x(scenario.lower)}" y1="72" x2="${x(scenario.upper)}" y2="72" class="chart-interval"/>${cap(scenario.lower, 72)}${cap(scenario.upper, 72)}<circle cx="${x(scenario.estimate)}" cy="72" r="6" class="chart-point"/>`
    + '</svg>';
}

export const scenarioSummary = (stress, scenario) => `Estimate ${n(scenario.estimate)}; ${e(stress.intervalLabel || '95% confidence interval')} ${n(scenario.lower)} to ${n(scenario.upper)}.`;

export function chartLegend(stress, { withUnit = true } = {}) {
  return `<ul class="chart-legend"><li><i class="legend-key legend-original" aria-hidden="true"></i>Saved result</li><li><i class="legend-key legend-shifted" aria-hidden="true"></i>Assumed shift</li>${withUnit ? `<li>${e(stress.unit || 'Hedges’ g')}; ${e(stress.direction || 'negative values favour psilocybin')}</li>` : ''}</ul>`;
}

// The slider stays hidden until browser/lab.mjs initialises it; without JavaScript the static figure stands.
export function biasControl(stress, prefix = '') {
  return `<div class="bias-control" data-bias-control hidden><label for="${prefix}bias-range">Assumed additive shift <output id="${prefix}bias-value" for="${prefix}bias-range">+0.00</output></label><input id="${prefix}bias-range" type="range" min="${stress.biasRange[0]}" max="${stress.biasRange[1]}" step="0.01" value="0" aria-describedby="${prefix}bias-explanation"><div class="range-labels"><span>+${n(stress.biasRange[0])} / saved result</span><span>+${n(stress.biasRange[1])}</span></div></div>`;
}

export const biasExplanation = prefix => `<p id="${prefix}bias-explanation" class="caption">The control adds the same assumed shift to the estimate and both interval endpoints. It does not estimate bias, refit the model, or change the interval width.</p>`;
export const referenceNote = '<p class="caption">Reference lines are saved analytical thresholds, not universal clinical cutoffs. A shifted interval crossing a line is conditional on this chosen assumption. Displayed values are rounded; the packet retains full precision.</p>';

// A claim and the source records it cites. Leads are horizontal SVG lines placed by percentage on
// equal-height source rows, so each meets its row centre at any width without measuring the DOM.
export function traceSpecimen(corpus, claim, { animate = false, limitLabel = 'What the claim does not establish' } = {}) {
  const sources = claim.sourceIds.map(id => {
    const source = corpus.sources.find(item => item.id === id);
    if (!source) throw new Error(`Unresolved source ${id}`);
    return source;
  });
  const row = i => ((i + .5) / sources.length * 100).toFixed(3);
  // A bus on the claim's edge joins the leads; it grows outward from the claim's midpoint.
  const bus = sources.length > 1 ? `<line class="trace-bus" pathLength="1" x1="0" y1="50%" x2="0" y2="${row(0)}%"/><line class="trace-bus" pathLength="1" x1="0" y1="50%" x2="0" y2="${row(sources.length - 1)}%"/>` : '';
  const leads = bus + sources.map((_, i) => `<line class="trace-lead" pathLength="1" x1="0" y1="${row(i)}%" x2="100%" y2="${row(i)}%" style="--i:${i}"/><circle class="trace-node" cx="100%" cy="${row(i)}%" r="3" style="--i:${i}"/>`).join('') + '<circle class="trace-port" cx="0" cy="50%" r="3.5"/>';
  const trunk = sources.map((_, i) => `<line class="trace-trunk" pathLength="1" x1="9" y1="0" x2="9" y2="${row(i)}%" style="--i:${i}"/><circle class="trace-node trace-trunk-node" cx="9" cy="${row(i)}%" r="3" style="--i:${i}"/>`).join('');
  return `<div class="trace${animate ? ' trace-animate' : ''}" data-trace style="--rows:${sources.length}"><div class="trace-claim"><p class="trace-label">Source-linked claim</p><p class="trace-claim-text">${e(claim.text)}</p><p class="trace-label">${e(limitLabel)}</p><p class="trace-limit">${e(claim.caveat)}</p></div><svg class="trace-lines" aria-hidden="true" focusable="false"><g class="trace-leads">${leads}</g><g class="trace-trunks">${trunk}</g></svg><ol class="trace-sources" aria-label="Linked evidence">${sources.map(source => `<li><a href="${sourceURL(source.url)}" target="_blank" rel="noopener noreferrer"><span class="trace-title">${e(source.title)}</span><span class="external-indicator" aria-label="opens in a new tab">↗</span></a><p class="trace-meta"><span>${e(source.kind)}</span><span>${e(source.year)}</span><code>${e(source.id)}</code></p></li>`).join('')}</ol></div>`;
}

export function sourceList(corpus, ids) {
  return `<ul class="source-list">${ids.map(id => { const source = corpus.sources.find(item => item.id === id); if (!source) throw new Error(`Unresolved source ${id}`); return `<li><p class="source-id"><code>${e(source.id)}</code><span>${e(source.year)}</span></p><a href="${sourceURL(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)}<span class="external-indicator" aria-label="opens in a new tab">↗</span></a><p class="source-kind">${e(source.kind)}</p><p class="source-locator">${e(source.locator)}</p></li>`; }).join('')}</ul>`;
}

export function conditionMatrix(corpus) {
  const labels = [...new Set(corpus.claims.flatMap(claim => (claim.conditions || []).map(condition => condition.label)))];
  return `<section class="condition-section" aria-labelledby="conditions-${e(corpus.id)}"><div class="block-head"><h3 id="conditions-${e(corpus.id)}">Conditions behind the claims</h3><span class="caption">Read across before comparing</span></div><p class="small">A missing or different condition is a reason to inspect the source, not to treat two results as equivalent.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Research conditions comparison; scroll horizontally if needed"><table><caption>${e(corpus.title)}: recorded conditions. Unrecorded fields are shown explicitly.</caption><thead><tr><th scope="col">Condition</th>${corpus.claims.map((claim,i) => `<th scope="col"><a href="#claim-${e(claim.id)}" data-claim-choice="${e(claim.id)}" data-corpus-id="${e(corpus.id)}">Claim ${i+1}</a></th>`).join('')}</tr></thead><tbody>${labels.map(label => `<tr><th scope="row">${e(label)}</th>${corpus.claims.map(claim => `<td>${e(claim.conditions?.find(condition => condition.label === label)?.value || 'Not recorded in this packet')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

export function renderStress(stress) {
  const scenario = calculateBiasScenario(stress, 0);
  return `<section class="stress-panel" data-bias-root aria-labelledby="stress-title"><div class="block-head"><div><p class="label">Replay of a saved analysis</p><h3 id="stress-title">What changes with an assumed bias?</h3></div><a class="text-link" href="${sourceURL(stress.sourceUrl)}" target="_blank" rel="noopener noreferrer">Canonical analysis ↗</a></div><p class="small">${e(stress.note)}</p><p class="status-line">${e(stress.reviewStatus)}</p>${chartLegend(stress)}<div data-interval-chart>${intervalFigure(stress)}</div>${biasControl(stress)}<div class="scenario-result" data-scenario-result aria-live="polite" aria-atomic="true">${scenarioSummary(stress, scenario)}</div><div class="replay-notes">${biasExplanation('')}${referenceNote}</div><details class="provenance-details"><summary>Saved analysis provenance</summary><p><a href="/company-assets/data/stage-b-snapshot.json" download>Download the pinned result snapshot</a></p><p><a href="/company-assets/data/sypres-primary-trials.json" download>Download the trial records of the primary analysis</a></p><p><code>${e(stress.label)} · ${e(stress.sourceVersion)}</code></p></details></section>`;
}

// The bench: claims rail, the selected claim and its analysis in a dark instrument, linked
// evidence beside it. Every claim and its evidence is in the markup; lab.mjs shows one at a time.
export function corpusPanel(corpus, stress) {
  const id = e(corpus.id);
  const rail = corpus.claims.map((claim, i) => `<a href="#claim-${e(claim.id)}" data-claim-choice="${e(claim.id)}" data-corpus-id="${id}"><span class="claim-choice-number">Claim ${i + 1}</span><span class="claim-choice-text">${e(claim.text)}</span></a>`).join('');
  const claims = corpus.claims.map((claim, i) => `<section class="bench-claim" id="claim-${e(claim.id)}" data-claim-panel="${e(claim.id)}" aria-labelledby="claim-heading-${e(claim.id)}"><p class="claim-meta"><span class="claim-number">Claim ${i + 1}</span><span class="pill">${e(claim.status)}</span></p><h3 id="claim-heading-${e(claim.id)}">${e(claim.text)}</h3><div class="caveat"><p class="caveat-label">Interpretation limit</p><p>${e(claim.caveat)}</p></div></section>`).join('');
  const evidence = corpus.claims.map((claim, i) => `<section class="evidence-card" id="evidence-${e(claim.id)}" data-claim-panel="${e(claim.id)}" aria-labelledby="evidence-heading-${e(claim.id)}"><p class="label">Claim ${i + 1}</p><h3 id="evidence-heading-${e(claim.id)}">Linked evidence</h3>${sourceList(corpus, claim.sourceIds)}</section>`).join('');
  const analysis = corpus.id === stress.corpusId
    ? renderStress(stress)
    : '<div class="not-applicable"><h3>No pooled effect is shown for this corpus.</h3><p>The recorded endpoints and testing conditions do not establish a compatible statistical input set. Psychiatric effect sizes and bias thresholds do not transfer to these materials reports.</p></div>';
  return `<article class="corpus-panel" id="corpus-${id}" data-corpus-panel="${id}" aria-labelledby="title-${id}"><header class="corpus-header"><div><p class="label">${e(corpus.domain)}</p><h2 id="title-${id}">${e(corpus.title)}</h2><p class="corpus-question">${e(corpus.question)}</p></div><a class="button button-secondary button-small" href="${packetURL(corpus)}" download>Download packet <span aria-hidden="true">↓</span></a></header><p class="corpus-summary">${e(corpus.summary)}</p><div class="review-banner"><p class="status-line"><strong>${e(corpus.reviewStatus)}</strong></p><p>${e(corpus.scopeNote)}</p></div><div class="bench"><nav class="claim-list" aria-label="Claims in ${e(corpus.title)}"><p class="list-label">Inspect a claim</p>${rail}</nav><div class="instrument bench-instrument">${claims}${analysis}</div><div class="bench-evidence">${evidence}</div></div>${conditionMatrix(corpus)}<section class="lineage-section" aria-labelledby="lineage-${id}"><h3 id="lineage-${id}">How this packet was prepared</h3><ol class="lineage-list">${corpus.lineage.map(step => `<li><strong>${e(step.label)}</strong><span>${e(step.status)}</span>${step.sourceIds?.length ? `<small>Sources: ${step.sourceIds.map(source => `<code>${e(source)}</code>`).join(', ')}</small>` : ''}</li>`).join('')}</ol><details class="provenance-details"><summary>Version and supported operations</summary><p><a href="/company-assets/data/provenance.md" download>Download preparation notes</a> · <a href="/company-assets/data/portability-receipt.json" download>Source-reference check receipt</a></p><p><code>${e(corpus.sourceVersion)}</code></p><ul>${corpus.capabilities.map(item => `<li>${e(item)}</li>`).join('')}</ul><p>Prepared packet with manual source curation. This view does not run live ingestion or automatic full-text extraction.</p></details></section></article>`;
}
