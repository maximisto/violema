// This is a new presentation adapter, not PsychDoc's statistical loader.
import { corpora, stressTest } from './corpora.mjs';

function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be nonempty text`);
}

function unique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

export function canonicalSource(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Source URL must be public HTTPS');
  parsed.hash = '';
  if (parsed.hostname === 'doi.org' || parsed.hostname === 'dx.doi.org') {
    return `https://doi.org${decodeURIComponent(parsed.pathname).toLowerCase().replace(/\/$/, '')}`;
  }
  return parsed.href;
}

export function validateCorpus(corpus) {
  for (const field of ['id', 'title', 'domain', 'question', 'summary', 'sourceVersion', 'reviewStatus', 'scopeNote']) nonempty(corpus[field], field);
  if (!/^[a-z][a-z0-9-]*$/.test(corpus.id)) throw new Error('Unsafe corpus id');
  for (const field of ['sources', 'claims', 'lineage', 'capabilities']) {
    if (!Array.isArray(corpus[field]) || !corpus[field].length) throw new Error(`${field} must be a nonempty array`);
  }
  unique(corpus.sources.map((s) => s.id), 'source id');
  unique(corpus.sources.map((s) => canonicalSource(s.url)), 'source identity');
  unique(corpus.claims.map((c) => c.id), 'claim id');
  unique(corpus.lineage.map((l) => l.id), 'lineage id');
  const sourceIds = new Set(corpus.sources.map((s) => s.id));
  for (const source of corpus.sources) {
    for (const field of ['id', 'title', 'url', 'locator', 'kind']) nonempty(source[field], `source.${field}`);
    if (!Number.isInteger(source.year)) throw new Error('Source year must be an integer');
  }
  for (const record of [...corpus.claims, ...corpus.lineage]) {
    nonempty(record.id, 'record.id');
    nonempty(record.status, 'record.status');
    if (!Array.isArray(record.sourceIds) || !record.sourceIds.length) throw new Error('Missing source references');
    unique(record.sourceIds, 'source reference');
    if (record.sourceIds.some((id) => !sourceIds.has(id))) throw new Error(`Unresolved source reference in ${record.id}`);
  }
  for (const claim of corpus.claims) {
    nonempty(claim.text, 'claim.text');
    nonempty(claim.caveat, 'claim.caveat');
    if (!Array.isArray(claim.conditions) || !claim.conditions.length) throw new Error('Missing claim conditions');
    unique(claim.conditions.map((c) => c.label), 'condition label');
    for (const condition of claim.conditions) {
      nonempty(condition.label, 'condition.label');
      nonempty(condition.value, 'condition.value');
    }
  }
  return corpus;
}

export function validateCorpora(packets = corpora) {
  if (!Array.isArray(packets) || !packets.length) throw new Error('No corpora');
  unique(packets.map((c) => c.id), 'corpus id');
  for (const corpus of packets) validateCorpus(corpus);
  return packets;
}

export function analysisForCorpus(id) {
  // Compatibility is deliberately explicit: no generic pooling of a new corpus.
  return id === 'psychdoc' && corpora.some((corpus) => corpus.id === id) ? structuredClone(stressTest) : null;
}

export function packetFor(corpus) {
  validateCorpus(corpus);
  return { schemaVersion: '1.0.0', curatedAt: '2026-10-10', corpus: structuredClone(corpus), analysis: analysisForCorpus(corpus.id) };
}

export function toPsychDocObject(corpus) {
  validateCorpus(corpus);
  return {
    type: 'synthesis-object', slug: corpus.id, title: corpus.title, summary: corpus.summary,
    question: corpus.question, publishedAt: '2026-10-10', updatedAt: '2026-10-10',
    areas: [], authors: [], related: [],
    sources: corpus.sources.map((source) => ({ ...source, authors: [], venue: 'See linked source', license: 'unknown' })),
    // These provisional tiers are an adapter input, not published evidence grades.
    claims: corpus.claims.map((claim) => ({ id: claim.id, text: claim.text, tier: 'preliminary', sources: [...claim.sourceIds], basis: claim.caveat })),
    entities: [], relations: [], assets: [], views: { public: { lede: corpus.summary, body: corpus.scopeNote } },
    limitations: [corpus.scopeNote], openQuestions: [corpus.question],
    provenance: { generatedBy: 'assisted', createdAt: '2026-10-10', updatedAt: '2026-10-10' },
  };
}
