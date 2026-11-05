import { shell } from './pages.mjs';
import { FIELD, FE4S4_ROUTE, FE4S4_RECORD_ROUTE } from './routes.mjs';
import { fe4s4Facts, keepDates, AMENDMENT_NOTE } from './records.mjs';

// A field is a front door for committed-test records that share one kind of claim. This one holds
// claims that a quantum computer beats the best classical methods on a defined problem; chemistry first.
export { FIELD };

// What every record in the field fixes before any result counts, in the order a reader meets it on a record.
const fixedTerms = [
  ['Problem', 'One public input file, pinned, so every team computes the same thing.'],
  ['Pass line', 'The answer every method has to reach, and how it is verified.'],
  ['Comparison', 'Quantum runs against the fastest classical run that reaches the same line. Every quantum dossier also runs its own workflow with the quantum step replaced by a classical one, and those runs compete as classical entries.'],
  ['Budget and clock', 'A ceiling on cost and on elapsed time for every run, with cost valued at public prices; a deadline for evidence; and one judgment date.'],
  ['Outcome rule', 'Every possible outcome is mapped to a tier in advance. A tier moves only on results under the test.'],
];

const limits = [
  'It does not say whether quantum advantage exists, or when it will. It records the rule before the result.',
  'No probabilities. A tier is a grade written in advance, not a prediction.',
  'Violema chose the thresholds, budgets and deadlines. They are policy choices, not field consensus.',
  'Naming a company or lab cites its published work. It is not a claim that anyone there has joined a test.',
  'No domain expert has reviewed these records yet. Violema builds them and has a commercial interest in their being read.',
];

const sectionHead = (id, number, label, title, lede) => `<div class="section-head record-section-head"><div><p class="record-chapter"><span aria-hidden="true">${number}</span>${label}</p><h2 id="${id}-title">${title}</h2><p class="lede">${lede}</p></div></div>`;

export function fieldPage() {
  const head = `<section class="page-head record-head field-head"><div class="wrap"><nav class="legal-breadcrumb record-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">${FIELD.name}</span></nav><p class="label">Field · Chemistry first</p><h1>${FIELD.name}, with the goalposts set in advance.</h1><p class="lede">A claim that a quantum computer beats the best classical methods is only as strong as the comparison behind it. Each record in this field fixes one problem, one budget and the rule for every outcome before any result counts. Classical methods enter under the same rules, and they can win.</p><div class="actions"><a class="button button-primary" href="${FE4S4_ROUTE}">Open the first record</a><a class="button button-secondary" href="/method/">How the method works</a></div></div></section>`;
  const terms = `<section class="section record-section" id="fixed" aria-labelledby="fixed-title"><div class="wrap">${sectionHead('fixed', '01', 'What a record fixes', 'Five terms, set before any result counts', 'Each record states what better means for its problem. For the first, it means less time to a verified answer under one budget.')}<div class="capabilities field-terms">${fixedTerms.map(([term, text]) => `<div class="capability"><span class="pill">${term}</span><p>${text}</p></div>`).join('')}</div></div></section>`;
  const record = `<article class="field-record" aria-labelledby="record-fe4s4-title"><p class="field-record-meta"><span>Record 01 · Chemistry</span><span class="pill">Draft protocol, not yet registered</span></p><h3 id="record-fe4s4-title"><a href="${FE4S4_ROUTE}">Can quantum assistance halve the time to a verified iron-sulfur result?</a></h3><p class="field-record-summary">One molecule, one fixed Hamiltonian and one test, judged once on 31 December 2027. Classical and quantum teams have both posted energies for this problem.</p><dl class="instrument record-facts">${fe4s4Facts()}</dl><p class="caption record-status">${keepDates(AMENDMENT_NOTE)}</p><div class="actions"><a class="button button-primary" href="${FE4S4_ROUTE}">Open the record</a><a class="button button-secondary" href="${FE4S4_RECORD_ROUTE}">Read the full record</a></div></article>`;
  const records = `<section class="section record-section" id="records" aria-labelledby="records-title"><div class="wrap">${sectionHead('records', '02', 'Records', 'One record so far', 'Records are listed in the order they were opened. The next follows the same format; none is drafted yet.')}${record}</div></section>`;
  const close = `<section class="section record-close" aria-labelledby="limits-title"><div class="wrap"><h2 id="limits-title">What this field does not claim.</h2><ul class="field-limits">${limits.map(text => `<li>${text}</li>`).join('')}</ul><div class="actions"><a class="button button-primary" href="${FE4S4_ROUTE}">Open the Fe₄S₄ record</a><a class="button button-secondary" href="/#briefing">Request a briefing</a></div></div></section>`;
  return shell(FIELD.route, `${FIELD.name} records | Violema`, 'Committed tests of claims that a quantum computer beats the best classical methods on a defined problem. Each record fixes the problem, the budget and the rule for every outcome before any result counts. Chemistry first.', [head, terms, records, close].join(''));
}
