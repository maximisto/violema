import { corpora, stressTest } from '../data/corpora.mjs';
import { calculateBiasScenario, intervalFigure } from './render.mjs';

const panels = [...document.querySelectorAll('[data-corpus-panel]')];
const choices = [...document.querySelectorAll('[data-corpus-choice]')];
const reset = document.querySelector('[data-reset]');
const announcement = document.querySelector('[data-announcement]');
const range = document.querySelector('#bias-range');
const initial = corpora[0].id;
let active = initial;
const chosenClaims = new Map(corpora.map(corpus => [corpus.id, corpus.claims[0].id]));
const format = number => number.toFixed(2).replace('-', '−');

function selectClaim(corpusId, claimId) {
  const corpus = corpora.find(item => item.id === corpusId);
  if (!corpus?.claims.some(claim => claim.id === claimId)) return;
  chosenClaims.set(corpusId, claimId);
  const panel = panels.find(item => item.dataset.corpusPanel === corpusId);
  panel.querySelectorAll('[data-claim-panel]').forEach(item => { item.hidden = item.dataset.claimPanel !== claimId; });
  panel.querySelectorAll('[data-claim-choice]').forEach(item => {
    if (item.dataset.claimChoice === claimId) item.setAttribute('aria-current', 'true');
    else item.removeAttribute('aria-current');
  });
}

function updateBias(value) {
  if (!range) return;
  const result = calculateBiasScenario(stressTest, value);
  range.value = String(result.bias);
  document.querySelector('#bias-value').textContent = `+${format(result.bias)}`;
  document.querySelector('[data-interval-chart]').innerHTML = intervalFigure(stressTest, result.bias);
  document.querySelector('[data-scenario-result]').textContent = `Assumed shift +${format(result.bias)}. Estimate ${format(result.estimate)}; ${stressTest.intervalLabel || '95% confidence interval'} ${format(result.lower)} to ${format(result.upper)}.`;
}

function selectCorpus(id, announce = false) {
  if (!corpora.some(corpus => corpus.id === id)) return;
  active = id;
  panels.forEach(panel => { panel.hidden = panel.dataset.corpusPanel !== id; });
  choices.forEach(choice => {
    if (choice.dataset.corpusChoice === id) choice.setAttribute('aria-current', 'true');
    else choice.removeAttribute('aria-current');
  });
  selectClaim(id, chosenClaims.get(id));
  // A different domain must never carry a clinical numerical scenario forward.
  if (id !== stressTest.corpusId) updateBias(0);
  if (announce) announcement.textContent = `${corpora.find(corpus => corpus.id === id).title} selected.`;
}

if (panels.length) {
  document.documentElement.classList.add('enhanced');
  choices.forEach(choice => choice.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectCorpus(choice.dataset.corpusChoice, true);
    history.replaceState(null, '', `#corpus-${active}`);
  }));
  document.querySelectorAll('[data-claim-choice]').forEach(choice => choice.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectClaim(choice.dataset.corpusId, choice.dataset.claimChoice);
    history.replaceState(null, '', `#claim-${choice.dataset.claimChoice}`);
    const heading = document.querySelector(`#claim-heading-${choice.dataset.claimChoice}`);
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    announcement.textContent = 'Selected claim and its linked evidence updated.';
  }));
  document.querySelector('[data-bias-control]')?.removeAttribute('hidden');
  range?.addEventListener('input', event => updateBias(Number(event.target.value)));
  reset.hidden = false;
  reset.addEventListener('click', () => {
    corpora.forEach(corpus => chosenClaims.set(corpus.id, corpus.claims[0].id));
    updateBias(0);
    selectCorpus(initial);
    history.replaceState(null, '', `#corpus-${initial}`);
    announcement.textContent = 'Demo reset to the first corpus, first claim, and unshifted saved result.';
  });
  function followHash() {
    const hashId = location.hash.replace('#corpus-', '');
    const claimId = location.hash.replace('#claim-', '');
    const containingCorpus = corpora.find(corpus => corpus.claims.some(claim => claim.id === claimId));
    if (containingCorpus) {
      selectCorpus(containingCorpus.id);
      selectClaim(containingCorpus.id, claimId);
    } else selectCorpus(corpora.some(corpus => corpus.id === hashId) ? hashId : initial);
  }
  followHash();
  window.addEventListener('hashchange', followHash);
}
