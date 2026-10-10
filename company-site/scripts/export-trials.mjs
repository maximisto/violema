// The 12 trials pooled in the saved primary analysis, as individually traceable records.
//
// Export (needs the pinned SYPRES CSV, read only):
//   node scripts/export-trials.mjs --csv <path to depression-psiloctr-25.1.2.csv>
// Check (the build runs this; add --csv or set SYPRES_CSV to also re-derive from the CSV):
//   node scripts/export-trials.mjs --check [--csv <path>]
//
// Each record keeps the study label exactly as in stage-b-snapshot.json primary.studies and the
// year, doi and registration_number fields exactly as recorded in the CSV. A blank field stays
// blank (null); nothing is filled in. A study whose rows disagree on a field fails the export.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const data = fileURLToPath(new URL('../data/', import.meta.url));
export const trialsPath = resolve(data, 'sypres-primary-trials.json');
const snapshotPath = resolve(data, 'stage-b-snapshot.json');

// Recorded once at export time; the check never rewrites these.
const EXPORT_META = {
  exportedAt: '2026-10-10',
  psychdocCommit: '23a6e348e7a7d7586b6b205da2a2061f3e052520',
  csvPath: 'analysis/stage_b/data/depression-psiloctr-25.1.2.csv',
};

export const trialId = study => study.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Semicolon-separated values with double-quote escaping, as the SYPRES release writes them.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const recorded = value => (value === undefined || value.trim() === '' ? null : value.trim());

export function deriveTrials(csvText, studies) {
  const [header, ...rows] = parseCsv(csvText);
  const column = name => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`CSV has no ${name} column`);
    return index;
  };
  const [study, year, doi, registration] = ['study', 'year', 'doi', 'registration_number'].map(column);
  return studies.map(label => {
    const matches = rows.filter(row => row[study] === label);
    if (!matches.length) throw new Error(`No CSV rows for ${label}`);
    const single = (index, name) => {
      const values = [...new Set(matches.map(row => recorded(row[index])))];
      if (values.length !== 1) throw new Error(`${label}: rows disagree on ${name}`);
      return values[0];
    };
    const yearValue = single(year, 'year');
    return {
      id: trialId(label),
      study: label,
      year: yearValue === null ? null : Number(yearValue),
      doi: single(doi, 'doi'),
      registration: single(registration, 'registration_number'),
      csvRows: matches.length,
    };
  });
}

async function loadSnapshot() {
  return JSON.parse(await readFile(snapshotPath, 'utf8'));
}

async function readCsv(path) {
  const bytes = await readFile(path);
  return { text: bytes.toString('utf8'), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function packetForTrials(snapshot, trials, sha256) {
  return {
    schemaVersion: 1,
    description: 'The 12 trials pooled in the saved primary analysis (SYPRES depression-psiloctr, version 25.1.2). Labels match stage-b-snapshot.json primary.studies; year, doi and registration are copied as recorded in the pinned CSV; null means the CSV field is blank.',
    source: {
      dataset: 'SYPRES depression-psiloctr',
      version: '25.1.2',
      doi: 'https://doi.org/10.5281/zenodo.17657950',
      licence: 'CC BY 4.0',
      file: EXPORT_META.csvPath,
      sha256,
      psychdocCommit: EXPORT_META.psychdocCommit,
      exportedAt: EXPORT_META.exportedAt,
    },
    analysis: { id: snapshot.primary.id, label: snapshot.primary.label, k: snapshot.primary.k },
    fields: {
      doi: 'CSV column doi, verbatim (some trials list two DOIs)',
      registration: 'CSV column registration_number, verbatim (a trial registry id such as NCT or ACTRN)',
      csvRows: 'Number of CSV rows recorded for this study label',
    },
    trials,
  };
}

/** Throws when the stored records stop matching the snapshot, or the CSV when one is given. */
export async function checkTrials({ csv } = {}) {
  const snapshot = await loadSnapshot();
  const stored = JSON.parse(await readFile(trialsPath, 'utf8'));
  const studies = snapshot.primary.studies;
  if (studies.length !== snapshot.primary.k) throw new Error('stage-b-snapshot primary.k does not equal primary.studies');
  if (!isDeepStrictEqual(stored.trials.map(t => t.study), studies)) throw new Error('Trial records no longer match primary.studies');
  if (stored.analysis?.k !== snapshot.primary.k) throw new Error('Trial records disagree with primary.k');
  if (stored.source?.sha256 !== snapshot.dataSha256) throw new Error('Trial records name a different CSV from the pinned snapshot');
  const ids = stored.trials.map(t => t.id);
  if (new Set(ids).size !== ids.length || ids.some((id, i) => id !== trialId(studies[i]))) throw new Error('Trial ids are not the stable slugs of their labels');
  if (csv) {
    const file = await readCsv(csv);
    if (file.sha256 !== stored.source.sha256) throw new Error('The CSV is not the pinned SYPRES 25.1.2 release');
    if (!isDeepStrictEqual(deriveTrials(file.text, studies), stored.trials)) throw new Error('Trial records are stale against the CSV');
  }
  return stored;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const csvIndex = args.indexOf('--csv');
  const csv = csvIndex >= 0 ? args[csvIndex + 1] : process.env.SYPRES_CSV;
  if (args.includes('--check')) {
    const stored = await checkTrials({ csv });
    console.log(`${stored.trials.length} trial records match primary.studies${csv ? ' and the pinned CSV' : ''}.`);
  } else {
    if (!csv) throw new Error('Usage: node scripts/export-trials.mjs --csv <path> | --check [--csv <path>]');
    const snapshot = await loadSnapshot();
    const file = await readCsv(csv);
    if (file.sha256 !== snapshot.dataSha256) throw new Error('The CSV is not the pinned SYPRES 25.1.2 release');
    const packet = packetForTrials(snapshot, deriveTrials(file.text, snapshot.primary.studies), file.sha256);
    await writeFile(trialsPath, `${JSON.stringify(packet, null, 2)}\n`);
    console.log(`Wrote ${packet.trials.length} trial records to data/sypres-primary-trials.json.`);
  }
}
