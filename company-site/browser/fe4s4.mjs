// The Fe4S4 record's instruments. The build renders every figure at rest; this module adds motion and interaction
// and re-renders through the same figures module, so what a reader sees after a click is what the build would draw.
import {
  CLUSTER, ATOM_RADIUS, ACTIVE_SPACE, project, raceSVG, evidenceSVG, evidenceDetail, verdict, decide, outcomeList,
} from './fe4s4-figures.mjs';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const token = (element, name, fallback) => getComputedStyle(element).getPropertyValue(name).trim() || fallback;

/* ---------- Instrument 1: the cluster turns and configurations flash, while motion is allowed ---------- */

function enhanceCluster(stage) {
  const canvas = stage.querySelector('canvas');
  const still = stage.querySelector('.cluster-still');
  const cells = [...document.querySelectorAll('[data-cells]')];
  const toggle = document.querySelector('[data-motion]');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const colors = { Fe: token(stage, '--fe4s4-iron', '#CD936B'), S: token(stage, '--fe4s4-sulfur', '#E2CF7A'), C: token(stage, '--fe4s4-carbon', '#9AA4B2') };
  const rgb = hex => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (hex, k) => `rgb(${rgb(hex).map(v => Math.round(Math.max(0, Math.min(255, v * k)))).join(',')})`;
  const tint = (hex, k) => `rgb(${rgb(hex).map(v => Math.round(v + (255 - v) * k)).join(',')})`;
  let width = 0, height = 0, theta = 0.6, paused = false, visible = true, frame = 0, last = 0, flash = 0;

  function draw() {
    context.clearRect(0, 0, width, height);
    const points = CLUSTER.atoms.map(atom => project(atom.p, theta, width, height));
    const items = [];
    for (const [i, j] of CLUSTER.bonds) {
      const a = points[i], b = points[j], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const depth = Math.min(1, Math.max(0, ((a.z + b.z) / 2 + 4.5) / 9));
      items.push({ z: (a.z + b.z) / 2 - 0.35, draw() {
        context.lineCap = 'round';
        context.lineWidth = 0.15 * a.unit * (a.scale + b.scale) / 2;
        context.strokeStyle = shade(colors[CLUSTER.atoms[i].el], 0.35 + 0.5 * depth);
        context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(mx, my); context.stroke();
        context.strokeStyle = shade(colors[CLUSTER.atoms[j].el], 0.35 + 0.5 * depth);
        context.beginPath(); context.moveTo(mx, my); context.lineTo(b.x, b.y); context.stroke();
      } });
    }
    CLUSTER.atoms.forEach((atom, i) => {
      const p = points[i];
      items.push({ z: p.z, draw() {
        const depth = Math.min(1, Math.max(0, (p.z + 4.5) / 9));
        const r = ATOM_RADIUS[atom.el] * p.unit * p.scale;
        const ball = context.createRadialGradient(p.x - r * 0.38, p.y - r * 0.42, r * 0.08, p.x, p.y, r);
        ball.addColorStop(0, tint(colors[atom.el], 0.1 + 0.7 * depth));
        ball.addColorStop(0.45, shade(colors[atom.el], 0.55 + 0.45 * depth));
        ball.addColorStop(1, shade(colors[atom.el], 0.12 + 0.18 * depth));
        context.fillStyle = ball;
        context.beginPath(); context.arc(p.x, p.y, r, 0, Math.PI * 2); context.fill();
      } });
    });
    items.sort((m, n) => m.z - n.z).forEach(item => item.draw());
  }
  function size() {
    const box = stage.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = box.width; height = box.height;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function occupy() {
    for (const row of cells) {
      const order = [...row.children].map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const on = new Set(order.slice(0, ACTIVE_SPACE.alpha));
      [...row.children].forEach((cell, i) => cell.classList.toggle('is-occupied', on.has(i)));
    }
  }
  const moving = () => !paused && visible && !reduceMotion.matches && document.visibilityState === 'visible';
  function tick(time) {
    frame = 0;
    const dt = last ? Math.min(64, time - last) : 16;
    last = time;
    if (!moving()) { last = 0; return; }
    theta += dt * 0.00018;
    draw();
    flash += dt;
    if (flash >= 150) { flash = 0; occupy(); }
    frame = requestAnimationFrame(tick);
  }
  const start = () => { if (!frame && moving()) frame = requestAnimationFrame(tick); };

  canvas.hidden = false;
  still.hidden = true;
  new ResizeObserver(size).observe(stage);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; start(); }, { threshold: 0.05 }).observe(stage);
  document.addEventListener('visibilitychange', start);
  reduceMotion.addEventListener('change', () => { if (toggle) toggle.hidden = reduceMotion.matches; draw(); start(); });
  if (toggle) {
    toggle.hidden = reduceMotion.matches;
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.textContent = paused ? 'Resume motion' : 'Pause motion';
      start();
    });
  }
  size();
  start();
}

/* ---------- Instrument 2: three vertical scales, eased on a log axis ---------- */

function enhanceRace(chart, scales) {
  let current = Number(scales.querySelector('[aria-pressed="true"]')?.dataset.raceMax || 360), animation = 0;
  scales.hidden = false;
  scales.addEventListener('click', event => {
    const button = event.target.closest('button[data-race-max]');
    if (!button) return;
    scales.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    const from = current, to = Number(button.dataset.raceMax), began = performance.now(), duration = reduceMotion.matches ? 0 : 900;
    cancelAnimationFrame(animation);
    const step = time => {
      const k = duration ? Math.min(1, (time - began) / duration) : 1;
      const eased = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      current = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * eased);
      chart.innerHTML = raceSVG(current);
      if (k < 1) animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step);
  });
}

/* ---------- Instrument 3: select a mark to read it ---------- */

function enhanceEvidence(chart, detail) {
  const choose = index => {
    chart.innerHTML = evidenceSVG(index);
    detail.innerHTML = evidenceDetail(index);
  };
  chart.addEventListener('click', event => {
    const mark = event.target.closest('[data-evidence]');
    if (mark) choose(Number(mark.dataset.evidence));
  });
  chart.addEventListener('keydown', event => {
    const mark = event.target.closest('[data-evidence]');
    if (!mark || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    const index = Number(mark.dataset.evidence);
    choose(index);
    chart.querySelector(`[data-evidence="${index}"]`)?.focus();
  });
  chart.addEventListener('pointerover', event => {
    const mark = event.target.closest('[data-evidence]');
    if (mark && !mark.classList.contains('is-selected')) detail.innerHTML = evidenceDetail(Number(mark.dataset.evidence));
  });
  chart.addEventListener('pointerleave', () => {
    const selected = chart.querySelector('.is-selected');
    if (selected) detail.innerHTML = evidenceDetail(Number(selected.dataset.evidence));
  });
}

/* ---------- Instrument 4: the outcome builder ---------- */

function enhanceOutcomes(form) {
  const tier = document.querySelector('[data-outcome-tier]');
  const why = document.querySelector('[data-outcome-why]');
  const list = document.querySelector('[data-outcome-list]');
  const value = name => form.querySelector(`input[name="${name}"]:checked`)?.value;
  form.querySelectorAll('[data-outcome-fieldset]').forEach(fieldset => { fieldset.disabled = false; });
  const update = () => {
    const scenario = { dossier: value('dossier'), confirmations: Number(value('confirmations')), contradiction: value('contradiction') === 'yes' };
    form.querySelectorAll('[data-needs-positive]').forEach(fieldset => { fieldset.disabled = scenario.dossier !== 'positive'; });
    const result = verdict(scenario);
    tier.textContent = result.outcome.tier;
    why.textContent = result.why;
    list.innerHTML = outcomeList(decide(scenario));
  };
  form.addEventListener('change', update);
  form.addEventListener('submit', event => event.preventDefault());
  update();
}

const stage = document.querySelector('[data-cluster]');
if (stage) enhanceCluster(stage);
const race = document.querySelector('[data-race]');
const scales = document.querySelector('[data-race-scales]');
if (race && scales) enhanceRace(race, scales);
const evidence = document.querySelector('[data-evidence-chart]');
const detail = document.querySelector('[data-evidence-detail]');
if (evidence && detail) enhanceEvidence(evidence, detail);
const form = document.querySelector('[data-outcome-form]');
if (form) enhanceOutcomes(form);
