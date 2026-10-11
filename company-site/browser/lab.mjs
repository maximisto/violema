// Evidence interactions: the bounded assumed-bias replay (home hero and demo) and the demo bench
// (corpus switch, claim selection, reset, hash links). Loaded by site.mjs only where needed.
import { corpora, stressTest } from '../data/corpora.mjs';
import { calculateBiasScenario, intervalFigure } from './render.mjs';
import { enhanceTabs } from './tabs.mjs';

const format = number => number.toFixed(2).replace('-', '−');
const plainClick = event => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

function enhanceBias(root) {
  const control = root.querySelector('[data-bias-control]');
  const range = root.querySelector('input[type="range"]');
  if (!control || !range) return null;
  const output = root.querySelector('output');
  const chart = root.querySelector('[data-interval-chart]');
  const result = root.querySelector('[data-scenario-result]');
  function update(value) {
    const scenario = calculateBiasScenario(stressTest, value);
    range.value = String(scenario.bias);
    output.textContent = `+${format(scenario.bias)}`;
    chart.innerHTML = intervalFigure(stressTest, scenario.bias);
    result.textContent = `Assumed shift +${format(scenario.bias)}. Estimate ${format(scenario.estimate)}; ${stressTest.intervalLabel || '95% confidence interval'} ${format(scenario.lower)} to ${format(scenario.upper)}.`;
  }
  control.hidden = false;
  range.addEventListener('input', event => update(Number(event.target.value)));
  return { root, update };
}

const biasControls = [...document.querySelectorAll('[data-bias-root]')].map(enhanceBias).filter(Boolean);
const panels = [...document.querySelectorAll('[data-corpus-panel]')];
const switcher = document.querySelector('[data-corpus-switch]');

if (panels.length && switcher) {
  const benchBias = biasControls.find(control => control.root.closest('[data-corpus-panel]'));
  const reset = document.querySelector('[data-reset]');
  const announcement = document.querySelector('[data-announcement]');
  const initial = corpora[0].id;
  const chosenClaims = new Map(corpora.map(corpus => [corpus.id, corpus.claims[0].id]));
  const titleOf = id => corpora.find(corpus => corpus.id === id).title;

  document.documentElement.classList.add('enhanced');

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

  function showCorpus(id, announce) {
    selectClaim(id, chosenClaims.get(id));
    // A different domain must never carry a clinical numerical scenario forward.
    if (id !== stressTest.corpusId) benchBias?.update(0);
    if (announce) announcement.textContent = `${titleOf(id)} selected.`;
  }

  const tabs = enhanceTabs(switcher, {
    onSelect(panelId) {
      const id = panelId.replace(/^corpus-/, '');
      showCorpus(id, true);
      history.replaceState(null, '', `#corpus-${id}`);
    },
  });

  function selectCorpus(id, announce = false) {
    if (!corpora.some(corpus => corpus.id === id)) return;
    tabs.select(`corpus-${id}`, { notify: false });
    showCorpus(id, announce);
  }

  document.querySelectorAll('[data-claim-choice]').forEach(choice => choice.addEventListener('click', event => {
    if (!plainClick(event)) return;
    event.preventDefault();
    const claimId = choice.dataset.claimChoice;
    selectClaim(choice.dataset.corpusId, claimId);
    history.replaceState(null, '', `#claim-${claimId}`);
    const heading = document.querySelector(`#claim-heading-${claimId}`);
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    announcement.textContent = 'Selected claim and its linked evidence updated.';
  }));

  if (reset) {
    reset.hidden = false;
    reset.addEventListener('click', () => {
      corpora.forEach(corpus => chosenClaims.set(corpus.id, corpus.claims[0].id));
      benchBias?.update(0);
      selectCorpus(initial);
      history.replaceState(null, '', `#corpus-${initial}`);
      announcement.textContent = 'Demo reset to the first corpus, first claim, and unshifted saved result.';
    });
  }

  function followHash() {
    const corpusId = location.hash.replace('#corpus-', '');
    const claimId = location.hash.replace('#claim-', '');
    const containing = corpora.find(corpus => corpus.claims.some(claim => claim.id === claimId));
    if (containing) {
      selectCorpus(containing.id);
      selectClaim(containing.id, claimId);
    } else selectCorpus(corpora.some(corpus => corpus.id === corpusId) ? corpusId : initial);
  }
  followHash();
  window.addEventListener('hashchange', followHash);
}
