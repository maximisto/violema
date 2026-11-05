import { shell } from './pages.mjs';
import { FIELD, FE4S4_ROUTE, FE4S4_RECORD_ROUTE } from './routes.mjs';
import { fe4s4Facts, keepDates, AMENDMENT_NOTE, FE4S4_TITLE, FE4S4_JUDGED_ON, breadcrumb, sectionHead } from './records.mjs';

// A field is a front door for committed-test records that share one kind of claim. This one holds
// claims that a quantum computer beats the best classical methods on a defined problem; chemistry first.

// What every record in the field fixes before any result counts, in the order a reader meets it on a record.
const fixedTerms = [
  ['Problem', 'One public input file, pinned, so every team computes the same thing.'],
  ['Pass line', 'The threshold every run has to meet, and how a result is verified.'],
  ['Comparison', 'Quantum is judged on its slowest run against the fastest classical run that reaches the same line. That pairing already takes the hardest case for the claim among the observed runs, so no statistical interval is taken over runs; only the timing uncertainty in the published logs is counted, against the claim. Every quantum dossier also reruns its own workflow with each quantum output replaced by a classical source declared in advance, and its successful runs compete as classical entries.'],
  ['Budget and clock', 'A ceiling on compute charges, valued at published prices, and on elapsed time for every run; deadlines for evidence; and one judgment date.'],
  ['Outcome rule', 'Every possible outcome is mapped to a tier in advance. A tier moves only on results under the test.'],
];

const limits = [
  'It does not say whether quantum advantage exists, or when it will. It records the rule before the result.',
  'No probabilities yet. The tier for each outcome is written in advance; a tier is not a prediction.',
  'Violema chose the thresholds, budgets and deadlines. They are policy choices, not field consensus.',
  'Naming a company or lab cites its published work. It is not a claim that anyone there has joined a test.',
  'No domain expert has reviewed these records yet. Violema builds them and has a commercial interest in their being read.',
];

export function fieldPage() {
  const head = `<section class="page-head record-head field-head"><div class="wrap">${breadcrumb()}<p class="label">Field · Chemistry first</p><h1>${FIELD.name}, with the goalposts set in advance.</h1><p class="lede">A claim that a quantum computer beats the best classical methods is only as strong as the comparison behind it. Each record in this field fixes one problem, one budget and the rule for every outcome before any result counts. Classical methods compete for the same target under the same ceilings, and they can win.</p><div class="actions"><a class="button button-primary" href="${FE4S4_ROUTE}">Open the first record</a><a class="button button-secondary" href="/method/">How the method works</a></div></div></section>`;
  const terms = `<section class="section record-section" id="fixed" aria-labelledby="fixed-title"><div class="wrap">${sectionHead('fixed', '01', 'What a record fixes', 'Five terms, set before any result counts', 'Each record states what better means for its problem. For the first, it means reaching a verified energy target at least twice as fast, under the same per-run ceilings.')}<div class="capabilities field-terms">${fixedTerms.map(([term, text]) => `<div class="capability"><span class="pill">${term}</span><p>${text}</p></div>`).join('')}</div></div></section>`;
  const record = `<article class="field-record" aria-labelledby="record-fe4s4-title"><p class="field-record-meta"><span>Record 01 · Chemistry</span><span class="pill">Draft protocol, not yet registered</span></p><h3 id="record-fe4s4-title"><a href="${FE4S4_ROUTE}">${FE4S4_TITLE}</a></h3><p class="field-record-summary">One molecule, one fixed Hamiltonian and one test, judged once on ${FE4S4_JUDGED_ON}. Classical and quantum teams have both posted energies for this problem. The classical comparison must cover GPU-accelerated DMRG and selected configuration interaction.</p><dl class="instrument record-facts">${fe4s4Facts()}</dl><p class="caption record-status">${keepDates(AMENDMENT_NOTE)}</p><div class="actions"><a class="button button-primary" href="${FE4S4_ROUTE}">Open the record</a><a class="button button-secondary" href="${FE4S4_RECORD_ROUTE}">Read the full record</a></div></article>`;
  const records = `<section class="section record-section" id="records" aria-labelledby="records-title"><div class="wrap">${sectionHead('records', '02', 'Records', 'One record so far', 'Records are listed in the order they were opened. The next follows the same format; none is drafted yet.')}${record}</div></section>`;
  const close = `<section class="section record-close" aria-labelledby="limits-title"><div class="wrap"><h2 id="limits-title">What this field does not claim.</h2><ul class="field-limits">${limits.map(text => `<li>${text}</li>`).join('')}</ul><div class="actions"><a class="button button-primary" href="${FE4S4_ROUTE}">Open the Fe₄S₄ record</a><a class="button button-secondary" href="/#briefing">Request a briefing</a></div></div></section>`;
  return shell(FIELD.route, `${FIELD.name} records | Violema`, 'Draft protocols for committed tests of claims that a quantum-assisted workflow beats the strongest publicly tested classical methods on a defined problem. Each record fixes the problem, the budget and the rule for every outcome before any result counts. Chemistry first.', [head, terms, records, close].join(''));
}
