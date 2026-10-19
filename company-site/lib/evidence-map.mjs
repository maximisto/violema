import { escapeHTML as e, sourceURL } from './render.mjs';

export const mapExplorerURL = 'https://psychdoc.ai/evidence/psilocybin-rewiring/map';
const studyLabels = { animal: 'Animal studies', healthy: 'Healthy volunteers', patients: 'Patients', 'in-vitro': 'In vitro', pooled: 'Pooled evidence', other: 'Not categorized' };
const paperLabel = paper => paper.label.replace(/([a-z])(\d{4})$/, '$1 $2');
const claimLabel = claim => `Claim ${claim.number}`;
const link = (href, label) => `<a href="${sourceURL(href)}">${e(label)} <span aria-hidden="true">↗</span></a>`;
const tag = claim => `<span class="map-tier">${e(claim.posedAsQuestion ? 'Question for review' : claim.tier)}</span>`;

export function filterEvidenceMap(data, study = 'all', method = 'all') {
  const claims = data.claims.filter(claim => (study === 'all' || claim.studyTypes.includes(study)) && (method === 'all' || claim.methods.some(item => item.id === method)));
  const claimIds = new Set(claims.map(claim => claim.id));
  const sourceLinks = data.sourceLinks.filter(edge => claimIds.has(edge.to));
  const paperIds = new Set(sourceLinks.map(edge => edge.from));
  return { ...data, claims, papers: study === 'all' && method === 'all' ? data.papers : data.papers.filter(paper => paperIds.has(paper.id)), sourceLinks, relations: data.relations.filter(edge => claimIds.has(edge.from) && claimIds.has(edge.to)) };
}

function selectionIds(data, selected) {
  const ids = new Set([selected.id]);
  const edges = new Set();
  for (const edge of [...data.sourceLinks, ...data.relations]) {
    if ((selected.type === 'edge' && selected.id === edge.id) || (selected.type !== 'edge' && [edge.from, edge.to].includes(selected.id))) {
      edges.add(edge.id); ids.add(edge.from); ids.add(edge.to);
    }
  }
  return { ids, edges };
}

export function renderMapField(data, selected) {
  if (!data.claims.length) return '<p class="map-empty">No claims match both filters. Choose another study type or method.</p>';
  const height = Math.max(data.papers.length, data.claims.length) * 44 + 34;
  const y = (index, count) => 38 + index * (height - 64) / Math.max(1, count - 1);
  const positions = new Map([
    ...data.papers.map((paper, index) => [paper.id, { x: 32, y: y(index, data.papers.length) }]),
    ...data.claims.map((claim, index) => [claim.id, { x: 73, y: y(index, data.claims.length) }]),
  ]);
  const { ids, edges } = selectionIds(data, selected);
  const paths = [...data.sourceLinks, ...data.relations].map(edge => {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    const source = edge.kind === 'source-for';
    const path = source ? `M ${from.x} ${from.y} C 46 ${from.y}, 59 ${to.y}, ${to.x} ${to.y}` : `M ${from.x} ${from.y} C 48 ${from.y}, 48 ${to.y}, ${to.x} ${to.y}`;
    const label = source ? `${paperLabel(data.papers.find(paper => paper.id === edge.from))}, source for ${claimLabel(data.claims.find(claim => claim.id === edge.to))}` : `${edge.posedAsQuestion ? 'Question: ' : ''}${edge.label}, ${claimLabel(data.claims.find(claim => claim.id === edge.from))} to ${claimLabel(data.claims.find(claim => claim.id === edge.to))}`;
    return `<path class="map-edge ${source ? 'map-edge-source' : 'map-edge-relation'}${edge.posedAsQuestion ? ' map-edge-question' : ''}${edges.has(edge.id) ? ' is-connected' : ''}" d="${path}" vector-effect="non-scaling-stroke" data-map-select="edge" data-map-id="${e(edge.id)}" aria-label="${e(label)}"><title>${e(label)}</title></path>`;
  }).join('');
  const nodes = (items, type) => items.map((item, index) => {
    const name = type === 'paper' ? paperLabel(item) : claimLabel(item);
    const population = type === 'claim' ? item.populations.join(', ') : item.venue;
    return `<a class="map-node map-node-${type}${ids.has(item.id) ? ' is-connected' : ''}${selected.id === item.id ? ' is-selected' : ''}" href="${sourceURL(item.href)}" data-map-select="${type}" data-map-id="${e(item.id)}" style="top:${(y(index, items.length) / height * 100).toFixed(3)}%" aria-label="${e(type === 'paper' ? `${name} ${population}: ${item.title}` : `${name} ${population}: ${item.text}`)}"${selected.id === item.id ? ' aria-current="true"' : ''}><span class="map-node-shape" aria-hidden="true">${type === 'claim' ? e(item.number) : ''}</span><span><strong>${e(name)}</strong> <small>${e(population)}</small></span></a>`;
  }).join('');
  return `<div class="map-field" style="--map-height:${height}px"><span class="map-column-label map-column-papers">Papers</span><span class="map-column-label map-column-claims">Claims</span><svg class="map-lines" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${nodes(data.papers, 'paper')}${nodes(data.claims, 'claim')}</div>`;
}

const sourceList = (data, ids, claimId) => `<ul class="map-source-list">${ids.map(id => data.papers.find(paper => paper.id === id)).filter(Boolean).map(paper => `<li>${link(paper.href, paperLabel(paper))}<span>${e(paper.venue)}</span>${claimId ? relatedButton('edge', data.sourceLinks.find(edge => edge.from === paper.id && edge.to === claimId), 'Inspect connection') : ''}</li>`).join('')}</ul>`;
const relatedButton = (type, item, label) => `<button type="button" data-map-select="${type}" data-map-id="${e(item.id)}">${e(label)}</button>`;

export function renderMapDetail(data, selected) {
  if (!selected) return '<p class="map-detail-empty">Select a paper, claim, or connection to inspect its record.</p>';
  if (selected.type === 'paper') {
    const paper = data.papers.find(item => item.id === selected.id);
    return `<p class="map-detail-kind">Source record</p><h3>${e(paperLabel(paper))}</h3><p class="map-detail-lede">${e(paper.title)}</p><p class="map-detail-meta">${e(paper.venue)} · ${e(paper.year)}</p><p>${link(paper.href, 'Read the publication')}</p><h4>Claims that cite this paper</h4><ul class="map-connection-list">${data.claims.filter(claim => claim.sourceIds.includes(paper.id)).map(claim => `<li>${relatedButton('claim', claim, `${claimLabel(claim)}: ${claim.text}`)}</li>`).join('')}</ul><p class="map-detail-note">A source link records which publication is cited. It does not by itself establish agreement or validate the claim.</p>`;
  }
  if (selected.type === 'edge') {
    const edge = [...data.sourceLinks, ...data.relations].find(item => item.id === selected.id);
    const to = data.claims.find(claim => claim.id === edge.to);
    if (edge.kind === 'source-for') {
      const paper = data.papers.find(item => item.id === edge.from);
      return `<p class="map-detail-kind">Source-to-claim connection</p><h3>${e(paperLabel(paper))} → ${e(claimLabel(to))}</h3><p class="map-detail-lede">${e(to.text)}</p>${tag(to)}<h4>Why this line exists</h4><p>The prepared PsychDoc.AI record lists this paper as a source for this claim.</p><h4>Claim’s stated basis</h4><p>${e(to.basis)}</p><p>${link(paper.href, 'Read the publication')}</p><p>${link(to.href, 'Inspect the complete claim')}</p>`;
    }
    const from = data.claims.find(claim => claim.id === edge.from);
    return `<p class="map-detail-kind">Authored relationship${edge.posedAsQuestion ? ' · Question' : ''}</p><h3>${e(edge.label)}</h3><p class="map-detail-meta">${e(claimLabel(from))} → ${e(claimLabel(to))}</p><p class="map-detail-lede">${e(edge.statement)}</p><span class="map-tier">${e(edge.posedAsQuestion ? 'Question for review' : edge.tier)}</span><h4>Stated basis</h4><p>${e(edge.basis)}</p><h4>Inspect both claims</h4><ul class="map-connection-list"><li>${relatedButton('claim', from, `${claimLabel(from)}: ${from.text}`)}</li><li>${relatedButton('claim', to, `${claimLabel(to)}: ${to.text}`)}</li></ul><p class="map-detail-note">This is an authored interpretation in the prepared record, not a paper-to-paper citation or a verified causal link.</p>`;
  }
  const claim = data.claims.find(item => item.id === selected.id);
  const related = data.relations.filter(edge => edge.from === claim.id || edge.to === claim.id);
  return `<p class="map-detail-kind">${e(claimLabel(claim))} · ${e(claim.populations.join(', ') || 'Population not specified')}</p><h3>${e(claim.text)}</h3>${tag(claim)}<h4>Stated basis</h4><p>${e(claim.basis)}</p>${claim.wouldChangeIf ? `<details class="map-limit"><summary>What could change this claim?</summary><p>${e(claim.wouldChangeIf)}</p></details>` : ''}<h4>Cited sources</h4>${sourceList(data, claim.sourceIds, claim.id)}${related.length ? `<h4>Connected claims</h4><ul class="map-connection-list">${related.map(edge => `<li>${relatedButton('edge', edge, `${edge.posedAsQuestion ? 'Question: ' : ''}${edge.label} · ${claimLabel(data.claims.find(item => item.id === (edge.from === claim.id ? edge.to : edge.from)))}`)}</li>`).join('')}</ul>` : ''}<p>${link(claim.href, 'Inspect the complete claim')}</p>`;
}

export function renderMapText(data) {
  return `<details class="map-text-alternative"><summary>Read all papers and connections as text</summary><div class="map-text-grid"><div><h3>The papers</h3><ul>${data.papers.map(paper => `<li>${link(paper.href, paperLabel(paper))}<p>${e(paper.title)}</p></li>`).join('')}</ul></div><div><h3>The claims and their sources</h3><ol>${data.claims.map(claim => `<li>${link(claim.href, `${claimLabel(claim)}: ${claim.text}`)}<p>${e(claim.basis)}</p>${sourceList(data, claim.sourceIds)}</li>`).join('')}</ol></div><div><h3>Authored relationships</h3><ul>${data.relations.map(edge => `<li><strong>${e(edge.label)}${edge.posedAsQuestion ? ' (question)' : ''}</strong><p>${e(edge.statement)}</p><p>${e(edge.basis)}</p><p>${link(data.claims.find(item => item.id === edge.from).href, claimLabel(data.claims.find(item => item.id === edge.from)))} → ${link(data.claims.find(item => item.id === edge.to).href, claimLabel(data.claims.find(item => item.id === edge.to)))}</p></li>`).join('')}</ul></div></div></details>`;
}

export function evidenceMapSection(data, hash) {
  if (data.schemaVersion !== 1 || !data.claims.length) throw new Error('A versioned evidence map with claims is required');
  const selected = { type: 'claim', id: data.claims[0].id };
  const methods = [...new Map(data.claims.flatMap(claim => claim.methods).map(method => [method.id, method])).values()];
  const studyTypes = [...new Set(data.claims.flatMap(claim => claim.studyTypes))];
  const json = JSON.stringify(data).replaceAll('<', '\\u003c');
  return `<section class="section evidence-map-section" id="evidence-map" aria-labelledby="evidence-map-title"><div class="wrap"><div class="section-head"><div><p class="label">A connected evidence record</p><h2 id="evidence-map-title">Follow the paper.<br>Question the connection.</h2></div><p class="map-intro">Explore PsychDoc.AI’s prepared psilocybin evidence. Select a paper, a claim, or a line to see what connects them.</p></div><div class="evidence-map" data-evidence-map data-map-sha256="${e(hash)}"><header class="map-toolbar"><div><strong>Psilocybin: from mechanism to humans</strong><p><span data-map-count>${data.papers.length} papers · ${data.claims.length} claims · ${data.sourceLinks.length + data.relations.length} connections</span></p></div><div class="map-filters" data-map-filters hidden><label>Study type<select name="study" data-map-filter="study"><option value="all">All study types</option>${studyTypes.map(type => `<option value="${e(type)}">${e(studyLabels[type] || type)}</option>`).join('')}</select></label><label>Method<select name="method" data-map-filter="method"><option value="all">All methods</option>${methods.map(method => `<option value="${e(method.id)}">${e(method.label)}</option>`).join('')}</select></label></div></header><div class="map-legend" aria-label="Connection types"><span><i class="map-key-source" aria-hidden="true"></i>Cited source for a claim</span><span><i class="map-key-relation" aria-hidden="true"></i>Authored relationship</span><span><i class="map-key-question" aria-hidden="true"></i>Posed as a question</span></div><div class="map-workspace"><div class="map-field-wrap" data-map-field>${renderMapField(data, selected)}</div><aside class="map-detail" data-map-detail aria-label="Selected evidence record" aria-live="polite" aria-atomic="true">${renderMapDetail(data, selected)}</aside></div><p class="map-geometry-note">Positions organize the record. Line length does not measure similarity, causality, or strength of evidence. Paper-to-paper citations and model similarity are not shown.</p>${renderMapText(data)}<footer class="map-footer"><p>Prepared record updated ${e(data.synthesis.updatedAt)}. Independent review remains open.<br><a href="/company-assets/data/evidence-map.json" download>Download this version</a></p><a class="button button-primary" href="${mapExplorerURL}">Explore the evidence map <span aria-hidden="true">↗</span></a></footer><script type="application/json" data-map-data>${json}</script></div></div></section>`;
}
