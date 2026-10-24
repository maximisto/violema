// The Fe4S4 benchmark record's figures: data and pure renderers shared by the build (complete SVG at rest)
// and the browser (company-assets/browser/fe4s4-figures.mjs), which re-renders the same markup on interaction.
// Every value comes from the hypothesis record checked against primary sources on 2026-10-24, or is derived
// from those values here so the arithmetic is tested, never typed.

export const RECORD_CHECKED = '2026-10-24';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const day = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (from, to) => Math.round((day(to) - day(from)) / 86400000);

/* ---------- The problem ---------- */

export const ACTIVE_SPACE = Object.freeze({ electrons: 54, orbitals: 36, alpha: 27, beta: 27 });

function binomial(n, k) {
  let result = 1n;
  for (let i = 1n; i <= BigInt(k); i++) result = result * (BigInt(n) - BigInt(k) + i) / i;
  return result;
}
/** Determinants with 27 spin-up and 27 spin-down electrons in 36 spatial orbitals: C(36, 27) squared. */
export const DETERMINANTS = binomial(ACTIVE_SPACE.orbitals, ACTIVE_SPACE.alpha) * binomial(ACTIVE_SPACE.orbitals, ACTIVE_SPACE.beta);
export const DETERMINANT_TEXT = DETERMINANTS.toLocaleString('en-US');
/** The singlet (S = 0) subspace: the Ms = 0 space less the Ms = 1 space, C(36, 27)² − C(36, 28)·C(36, 26). */
export const SINGLETS = DETERMINANTS - binomial(ACTIVE_SPACE.orbitals, ACTIVE_SPACE.alpha + 1) * binomial(ACTIVE_SPACE.orbitals, ACTIVE_SPACE.beta - 1);
export const SINGLET_TEXT = SINGLETS.toLocaleString('en-US');
/** The strip draws a new configuration every half second: under three flashes a second for any cell. */
export const FLASH_MS = 500;

// Idealized cubane: Fe on one tetrahedron (Fe-Fe 2.75 A), sulfide on the other (S-S 3.6 A), Fe-S about 2.28 A;
// each Fe carries a terminal thiolate S at 2.25 A and its methyl C at 1.82 A, Fe-S-C 105 degrees. Not the benchmark's coordinates.
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const mul = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const norm = p => Math.hypot(p[0], p[1], p[2]);
const unit = p => mul(p, 1 / norm(p));
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
export const CLUSTER = (() => {
  const feDirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  const sDirs = [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]];
  const atoms = [...feDirs.map(d => ({ el: 'Fe', p: mul(d, 0.972) })), ...sDirs.map(d => ({ el: 'S', p: mul(d, 1.273) }))];
  const bonds = [];
  for (let i = 0; i < 4; i++) for (let j = 4; j < 8; j++) if (norm(sub(atoms[i].p, atoms[j].p)) < 2.6) bonds.push([i, j]);
  feDirs.forEach((d, i) => {
    const u = unit(d);
    const thiolate = mul(u, norm(atoms[i].p) + 2.25);
    const side = unit(cross(u, [0, 0, 1]));
    const angle = 75 * Math.PI / 180;
    const carbon = add(thiolate, add(mul(u, 1.82 * Math.cos(angle)), mul(side, 1.82 * Math.sin(angle))));
    const s = atoms.push({ el: 'S', p: thiolate }) - 1;
    const c = atoms.push({ el: 'C', p: carbon }) - 1;
    bonds.push([i, s], [s, c]);
  });
  return Object.freeze({ atoms, bonds });
})();
export const ATOM_RADIUS = Object.freeze({ Fe: 0.42, S: 0.5, C: 0.34 });
export const CLUSTER_TILT = 0.42;

/** Perspective projection of a cluster point into a width x height frame at rotation theta. */
export function project(p, theta, width, height) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const x1 = p[0] * ct + p[2] * st;
  const z1 = -p[0] * st + p[2] * ct;
  const cp = Math.cos(CLUSTER_TILT), sp = Math.sin(CLUSTER_TILT);
  const y2 = p[1] * cp - z1 * sp;
  const z2 = p[1] * sp + z1 * cp;
  const scale = 14 / (14 - z2);
  const u = Math.min(width, height) / 10.2;
  return { x: width / 2 + x1 * scale * u, y: height * 0.53 - y2 * scale * u, z: z2, scale, unit: u };
}

/** The cluster as a still SVG: the figure at rest and without JavaScript. Depth is drawn back to front. */
export function clusterSVG(theta = 0.6, width = 640, height = 480) {
  const P = CLUSTER.atoms.map(a => project(a.p, theta, width, height));
  const items = [];
  CLUSTER.bonds.forEach(([i, j]) => {
    const a = P[i], b = P[j], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, w = (0.15 * a.unit * (a.scale + b.scale) / 2).toFixed(2);
    items.push({ z: (a.z + b.z) / 2 - 0.35, svg: `<line class="bond-${CLUSTER.atoms[i].el}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke-width="${w}"/><line class="bond-${CLUSTER.atoms[j].el}" x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke-width="${w}"/>` });
  });
  CLUSTER.atoms.forEach((atom, i) => {
    const p = P[i];
    items.push({ z: p.z, svg: `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(ATOM_RADIUS[atom.el] * p.unit * p.scale).toFixed(1)}" fill="url(#ball-${atom.el})"/>` });
  });
  const ball = el => `<radialGradient id="ball-${el}" cx="0.36" cy="0.32" r="0.75"><stop offset="0" class="ball-hi-${el}"/><stop offset="0.45" class="ball-mid-${el}"/><stop offset="1" class="ball-lo-${el}"/></radialGradient>`;
  return `<svg class="cluster-still" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><defs>${['Fe', 'S', 'C'].map(ball).join('')}</defs><g stroke-linecap="round">${items.sort((m, n) => m.z - n.z).map(item => item.svg).join('')}</g></svg>`;
}

/* ---------- The race on one Hamiltonian ---------- */

// Energies in hartree, as posted for the same CAS(54, 36) Hamiltonian. The tracker holds it in a different orbital
// basis, so its energies compare directly with the pinned file's.
export const ENERGIES = Object.freeze({
  quantum: { eh: -326.913, date: '2025-11-11' },
  trimciBest: { eh: -327.175, date: '2025-11-20' },
  reference: { eh: -327.24466, date: '2026-03-30' },
  bar: { eh: -327.24306 },
  // The DMRG value distributed with the model files (Li and Chan, JCTC 2017; bond dimension 4000, marked not
  // converged), which the tracker's SQD entry quotes as its reference.
  dmrg2017: { eh: -327.2396369 },
});
/** The SQD entry's largest diagonalized subspace (Shirakawa et al., arXiv 2511.00224). */
export const SQD_SUBSPACE = 1e10;
export const millihartreeAbove = eh => Math.round((eh - ENERGIES.reference.eh) * 1e5) / 100;
export const GAP = Object.freeze({
  quantum: millihartreeAbove(ENERGIES.quantum.eh),
  trimci: millihartreeAbove(ENERGIES.trimciBest.eh),
  bar: millihartreeAbove(ENERGIES.bar.eh),
  dmrg2017: millihartreeAbove(ENERGIES.dmrg2017.eh),
});
export const TRIMCI_GAIN = Math.round((GAP.quantum - GAP.trimci) * 100) / 100;
export const KCAL_PER_MILLIHARTREE = 0.6275095;
export const MATCH_DAYS = daysBetween(ENERGIES.quantum.date, ENERGIES.trimciBest.date);
export const RACE_SCALES = Object.freeze([
  { key: 'gap', label: 'Full range', max: 360 },
  { key: 'classical', label: 'Classical entries', max: 80 },
  { key: 'pass', label: 'Pass line', max: 2 },
]);

const R = { width: 760, height: 400, left: 74, right: 26, top: 30, bottom: 48 };
const raceStart = day('2025-10-25'), raceEnd = day('2026-05-05');
const rx = iso => R.left + (day(iso) - raceStart) / (raceEnd - raceStart) * (R.width - R.left - R.right);
const plotHeight = R.height - R.top - R.bottom;
function ticks(max) {
  const step = [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100].find(s => max / s <= 8) || 100;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(2)));
  return out;
}
const text = (x, y, value, cls, anchor = 'start') => `<text class="${cls}" x="${Number(x).toFixed(1)}" y="${Number(y).toFixed(1)}" text-anchor="${anchor}">${value}</text>`;

/**
 * Posted energies at a vertical scale of 0 to ymax millihartree above the GPU DMRG value. Marks only: no line joins
 * entries from different methods or dates, because nothing was posted between them that this record checked.
 * The pass line is one-sided: any verified energy at or below it passes, including one below the DMRG value.
 */
export function raceSVG(ymax) {
  const ry = v => R.top + plotHeight - (v / ymax) * plotHeight;
  const q = GAP.quantum, best = GAP.trimci, bar = GAP.bar;
  const qx = rx(ENERGIES.quantum.date), mx = rx(ENERGIES.trimciBest.date), refx = rx(ENERGIES.reference.date), right = R.width - R.right;
  const p = [];
  p.push(`<defs><clipPath id="race-plot"><rect x="${R.left}" y="${R.top - 1}" width="${right - R.left}" height="${plotHeight + 2}"/></clipPath><pattern id="race-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hatch-fill" width="6" height="6"/><line class="hatch-line" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>`);
  for (const v of ticks(ymax)) {
    p.push(`<line class="${v === 0 ? 'axis-zero' : 'grid'}" x1="${R.left}" x2="${right}" y1="${ry(v).toFixed(1)}" y2="${ry(v).toFixed(1)}"/>`);
    p.push(text(R.left - 10, ry(v) + 4, v, 'tick', 'end'));
  }
  p.push(`<text class="axis-label" x="16" y="${R.top + plotHeight / 2}" transform="rotate(-90 16 ${R.top + plotHeight / 2})" text-anchor="middle">mEh above −327.24466 Eh</text>`);
  for (const [iso, label] of [['2025-11-01', 'Nov 2025'], ['2025-12-01', 'Dec'], ['2026-01-01', 'Jan 2026'], ['2026-02-01', 'Feb'], ['2026-03-01', 'Mar'], ['2026-04-01', 'Apr'], ['2026-05-01', 'May']]) {
    const x = rx(iso);
    p.push(`<line class="grid-tick" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${R.top + plotHeight}" y2="${R.top + plotHeight + 5}"/>`, text(x, R.top + plotHeight + 20, label, 'tick', 'middle'));
  }
  const passY = ry(bar);
  p.push(`<g clip-path="url(#race-plot)">`);
  p.push(`<rect x="${R.left}" y="${passY.toFixed(1)}" width="${right - R.left}" height="${(R.top + plotHeight - passY).toFixed(1)}" fill="url(#race-hatch)"/>`);
  p.push(`<line class="pass-line" x1="${R.left}" x2="${right}" y1="${passY.toFixed(1)}" y2="${passY.toFixed(1)}"/>`);
  if (ymax >= GAP.dmrg2017 && ymax <= 100) p.push(`<line class="dmrg-2017" x1="${R.left}" x2="${right}" y1="${ry(GAP.dmrg2017).toFixed(1)}" y2="${ry(GAP.dmrg2017).toFixed(1)}"/>`);
  if (q <= ymax) p.push(`<line class="same-day" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${ry(q).toFixed(1)}" y2="${ry(best).toFixed(1)}"/>`);
  p.push(`<path class="quantum-mark" d="M${qx.toFixed(1)},${(ry(q) - 8).toFixed(1)} l8,8 l-8,8 l-8,-8 Z"/>`);
  p.push(`<circle class="classical-ring" cx="${mx.toFixed(1)}" cy="${ry(q).toFixed(1)}" r="7"/>`);
  p.push(`<circle class="classical-mark" cx="${mx.toFixed(1)}" cy="${ry(best).toFixed(1)}" r="6.5"/>`);
  p.push(`<circle class="classical-mark" cx="${refx.toFixed(1)}" cy="${ry(0).toFixed(1)}" r="6.5"/>`);
  p.push(`</g>`);
  if (q <= ymax) {
    p.push(`<path class="brace" d="M${qx.toFixed(1)},${(ry(q) - 16).toFixed(1)} v-6 H${mx.toFixed(1)} v6"/>`);
    p.push(text((qx + mx) / 2, ry(q) - 28, `${MATCH_DAYS} days between tracker posts`, 'note-strong', 'middle'));
    p.push(text(mx + 16, ry(q) + 4, 'IBM and RIKEN SQD, 77 qubits; TrimCI reached the same energy', 'note'));
  }
  if (best <= ymax) p.push(text(mx + 14, ry(best) + 22, `TrimCI, classical: ${Math.round(TRIMCI_GAIN)} mEh lower, same post`, 'note-classical'));
  if (ymax >= GAP.dmrg2017 && ymax <= 100) p.push(text(R.left + 10, ry(GAP.dmrg2017) - 13, `DMRG with the 2017 model files, marked not converged: ${GAP.dmrg2017} mEh`, 'note-classical'));
  p.push(text(refx - 12, ry(0) - 14, 'GPU DMRG, the reference', 'note-classical', 'end'));
  if (ymax <= 2) p.push(text(right - 10, passY + 22, `Pass line, ${bar} mEh above the reference: at or below it passes`, 'note-bar', 'end'));
  else p.push(text(R.left + 10, passY - 8, `Pass line, ${bar} mEh above the reference`, 'note-bar'));
  const offScale = (x, y, label, cls) => p.push(`<path class="${cls}-arrow" d="M${x.toFixed(1)},${y + 16} V${y} M${(x - 6).toFixed(1)},${y + 7} L${x.toFixed(1)},${y} L${(x + 6).toFixed(1)},${y + 7}"/>`, text(x + 12, y + 12, label, cls));
  if (q > ymax) offScale(qx, R.top + 2, `IBM and RIKEN SQD entry above this scale: ${q.toFixed(2)} mEh`, 'note-quantum');
  if (best > ymax) offScale(mx, R.top + 24, `Best TrimCI entry above this scale: ${best.toFixed(2)} mEh`, 'note-classical');
  if (GAP.dmrg2017 > ymax) offScale(R.left + 22, R.top + 46, `2017 DMRG value above this scale: ${GAP.dmrg2017} mEh`, 'note-classical');
  if (ymax <= 2) p.push(text((R.left + right) / 2, R.top + plotHeight * 0.36, 'A timed attempt counts only if its verified energy reaches this line.', 'note-strong', 'middle'), text((R.left + right) / 2, R.top + plotHeight * 0.36 + 20, 'Nothing drawn here was entered in that test.', 'note', 'middle'));
  return p.join('');
}

/* ---------- Evidence time ---------- */

export const LANES = Object.freeze([
  { key: 'ft', name: 'Fault-tolerant estimate', y: 78 },
  { key: 'hw', name: 'Hardware run', y: 136 },
  { key: 'cl', name: 'Classical result', y: 194 },
  { key: 'an', name: 'Analysis', y: 252 },
  { key: 'pg', name: 'Program or other', y: 310 },
]);

export const EVIDENCE = Object.freeze([
  { d: '2016-05-11', lane: 'ft', url: 'https://arxiv.org/abs/1605.03590', who: 'Reiher et al.', venue: 'PNAS 2017 · arXiv 1605.03590', text: 'A fault-tolerant resource estimate for simulating FeMoco, the iron-molybdenum cofactor of nitrogenase, with error-correction overhead included. An estimate, not a run or a classical comparison.' },
  { d: '2018-09-27', lane: 'cl', url: 'https://arxiv.org/abs/1809.10307', who: 'Li et al.', venue: 'J. Chem. Phys. 2019 · arXiv 1809.10307', text: 'Found that the FeMoco active space used in the 2016 estimate gives a qualitatively incorrect ground state, and built a larger model with 113 electrons in 76 orbitals.' },
  { d: '2019-02-06', lane: 'ft', url: 'https://arxiv.org/abs/1902.02134', who: 'Berry et al.', venue: 'Quantum 2019 · arXiv 1902.02134', text: 'New algorithms for chemistry on a fault-tolerant machine. The version of 2019-10-01 estimates about 700 times less surface-code spacetime volume for FeMoco than earlier quantum algorithms, using the larger 2018 model; the first version gave no such factor.' },
  { d: '2020-11-06', lane: 'ft', url: 'https://arxiv.org/abs/2011.03494', who: 'Lee et al.', venue: 'PRX Quantum 2021 · arXiv 2011.03494', text: 'A projected cost for FeMoco: about 4 million physical qubits and under 4 days, assuming 1 μs cycle times and physical gate error rates no worse than 0.1%. An estimate, not a run.' },
  { d: '2022-08-03', lane: 'an', url: 'https://arxiv.org/abs/2208.02199', who: 'Lee et al., 18 authors', venue: 'Nature Communications 2023 · arXiv 2208.02199', text: 'Asks whether there is evidence for exponential quantum advantage in ground-state energy estimation, and concludes it has yet to be found across chemical space. It does not consider other tasks and does not rule out polynomial speedups.' },
  { d: '2023-06-14', lane: 'hw', id: 'kim', url: 'https://doi.org/10.1038/s41586-023-06096-3', who: 'Kim et al.', venue: 'Nature 618:500 (2023)', text: 'A 127-qubit experiment that IBM presented as evidence of the utility of quantum computing before fault tolerance. It concerns a spin model, not a molecule.' },
  { d: '2023-06-26', lane: 'cl', id: 'tindall', url: 'https://arxiv.org/abs/2306.14887', who: 'Tindall et al.; Begušić and Chan', venue: 'arXiv 2306.14887 (PRX Quantum 2024) · arXiv 2306.16372, posted 2023-06-28', text: 'Classical simulations of that experiment, posted within two weeks of it. This is why the test makes a quantum result wait at least 180 days before it is judged, and counts every classical answer public by the cutoff.' },
  { d: '2024-05-08', lane: 'hw', url: 'https://arxiv.org/abs/2405.05068', who: 'Robledo-Moreno et al.', venue: 'arXiv 2405.05068', text: 'Sample-based quantum diagonalization (SQD) on quantum hardware, applied to nitrogen and iron-sulfur clusters. Going beyond exact diagonalization is not the same as beating the strongest approximate classical solver.' },
  { d: '2025-01-10', lane: 'ft', url: 'https://arxiv.org/abs/2501.06165', who: 'Caesura et al.', venue: 'PRX Quantum 6:030337 (2025) · arXiv 2501.06165', text: 'A fault-tolerant estimate on cytochrome P450, an enzyme family central to drug metabolism: about two orders of magnitude faster (233 times for P450) than an earlier algorithm on baseline photonic hardware without Active Volume support. Active Volume compilation, which suits only some hardware, contributes a factor of about 25 of that. An erratum published 2026-10-08 says its correction does not change the resource estimates.' },
  { d: '2025-01-13', lane: 'an', url: 'https://arxiv.org/abs/2501.07231', who: 'Reinholdt et al.', venue: 'arXiv 2501.07231', text: 'A critical analysis of quantum-selected configuration interaction, the idea behind SQD, finding that sampling efficiency and determinant selection limit it in the systems studied.' },
  { d: '2025-10-31', lane: 'hw', id: 'sqd', url: 'https://arxiv.org/abs/2511.00224', who: 'Shirakawa et al., IBM and RIKEN, 21 authors', venue: 'arXiv 2511.00224', text: 'Closed-loop sample-based quantum diagonalization on IBM Heron processors with up to 152,064 nodes of the Fugaku supercomputer. For this [4Fe-4S] (54e, 36o) model it used 77 qubits and a 10¹⁰-determinant subspace, reaching −326.912 hartree, 278 mEh lower than the team’s 2024 result. The authors describe its accuracy as comparable to some all-classical approximation methods.' },
  { d: '2025-11-11', lane: 'pg', url: 'https://quantum-advantage-tracker.github.io/', who: 'Quantum Advantage Tracker, IBM and RIKEN SQD entry', venue: 'Quantum Advantage Tracker, variational track', text: 'The tracker lists this record’s Fe₄S₄ model, the same Hamiltonian in a different orbital basis, under its baseline benchmarks, with no active advantage candidate. The IBM and RIKEN SQD entry reports −326.913 hartree on 77 qubits, with 10 hours of quantum processor time and 10 hours on 76,032 Fugaku nodes, run in parallel.' },
  { d: '2025-11-18', lane: 'cl', url: 'https://arxiv.org/abs/2511.14734', who: 'Zhang and Otten', venue: 'arXiv 2511.14734', text: 'A classical method seeded with random determinants (TrimCI) matched a recent quantum SQD energy for a [4Fe-4S] cluster with roughly a million times fewer determinants and CPU-hours.' },
  { d: '2025-11-20', lane: 'cl', id: 'trimci', url: 'https://quantum-advantage-tracker.github.io/', who: 'TrimCI entries on the tracker', venue: 'Quantum Advantage Tracker, variational track', text: 'Classical entries on the same tracker model, matching the SQD energy (−326.913 hartree) and reaching −327.175 hartree.' },
  { d: '2025-11-30', lane: 'an', url: 'https://arxiv.org/abs/2512.01012', who: 'Raisuddin et al.', venue: 'arXiv 2512.01012', text: 'A benchmark of SQD across the W4-11 thermochemistry set, which found uneven accuracy across reaction types.' },
  { d: '2026-01-08', lane: 'cl', url: 'https://arxiv.org/abs/2601.04621', who: 'Zhai et al., Chan group', venue: 'arXiv 2601.04621 · v2 2026-06-22', text: 'A classical simulation of the FeMo-cofactor model to chemical accuracy. Its benchmark on a [Fe₄S₄(SCH₃)₄]²⁻ (54e, 36o) model reports a spin-adapted DMRG upper bound of −327.244001 hartree in v1, which Legeza et al. compare with their own result. Whether its integrals are this record’s pinned file was not checked, so it is not plotted on the energy chart.' },
  { d: '2026-03-30', lane: 'cl', url: 'https://arxiv.org/abs/2603.28648', who: 'Legeza et al.', venue: 'arXiv 2603.28648', text: 'GPU-accelerated DMRG on the Fe₄S₄ CAS(54,36) model reached −327.24466 hartree. This record’s energy target is that value plus 0.0016 hartree.' },
  { d: '2026-04-16', lane: 'pg', url: 'https://wellcomeleap.org/', who: 'Wellcome Leap, Quantum for Bio', venue: 'Program outcome · program launched March 2023', text: 'The announcement names no winner of the $5 million grand prize for quantum advantage. A team led by Algorithmiq, with IBM and Cleveland Clinic, won the $2 million prize for running its photosensitizer workflow on more than 50 qubits at program depth of order 10³ to 10⁴, with a path toward advantage. Wellcome Leap expects a follow-on program.' },
  { d: '2026-05-01', lane: 'hw', url: 'https://arxiv.org/abs/2605.01138', who: 'Merz et al.', venue: 'arXiv 2605.01138 · revised 2026-09-05 · Gordon Bell Prize finalist, 2026-09-09', text: 'A Cleveland Clinic, RIKEN and IBM team ran a fragmented hybrid quantum-classical calculation on protein systems of up to 12,635 atoms, using IBM Heron processors with the Fugaku and Miyabi-G supercomputers. The largest circuit used 94 qubits and 5,758 two-qubit gates. The authors state that they do not regard the results as the basis of a quantum advantage claim.' },
  { d: '2026-07-23', lane: 'cl', url: 'https://arxiv.org/abs/2607.21337', who: 'Belagali et al.', venue: 'arXiv 2607.21337', text: 'A fast classical evaluation of single-layer UCJ circuits, a circuit family used in SQD workflows.' },
  { d: '2026-07-27', lane: 'pg', url: 'https://arxiv.org/abs/2607.24937', who: 'Three IBM-related advantage claims', venue: 'arXiv 2607.24937 · 2607.25941 · 2607.25998, posted 2026-07-27 and 28', text: 'Advantage claims on spin models and sampling tasks. They concern problems other than biological molecules, so they do not bear on this test.' },
]);
export const RESPONSE_ARCS = Object.freeze([
  { from: 'kim', to: 'tindall', lines: [`${daysBetween('2023-06-14', '2023-06-26')} and ${daysBetween('2023-06-14', '2023-06-28')} days between posts`, 'a spin model, not a molecule'], side: 'left' },
  { from: 'sqd', to: 'trimci', lines: [`${daysBetween('2025-10-31', '2025-11-20')} days from the preprint`, 'to a matching classical entry'], side: 'left' },
]);
export const DEFAULT_EVIDENCE = EVIDENCE.findIndex(item => item.id === 'sqd');

const A0 = day('2016-01-01'), A1 = day('2023-01-01'), B1 = day('2027-01-01');
const XA = [190, 410], XB = [432, 980];
const ex = iso => {
  const t = day(iso);
  return t < A1 ? XA[0] + (t - A0) / (A1 - A0) * (XA[1] - XA[0]) : XB[0] + (t - A1) / (B1 - A1) * (XB[1] - XB[0]);
};
const laneOf = key => LANES.find(lane => lane.key === key);
// Marks closer than 15 px in one lane alternate onto a second row so each stays selectable.
const EVIDENCE_POSITIONS = (() => {
  const last = {};
  return EVIDENCE.map(item => {
    const lane = laneOf(item.lane), x = ex(item.d);
    let y = lane.y;
    if (last[item.lane] && x - last[item.lane].x < 15) y = last[item.lane].y === lane.y ? lane.y - 15 : lane.y;
    last[item.lane] = { x, y };
    return { x, y };
  });
})();
function glyph(key, x, y) {
  if (key === 'ft') return `<circle class="hit lane-ft" cx="${x.toFixed(1)}" cy="${y}" r="7"/>`;
  if (key === 'hw') return `<path class="hit lane-hw" d="M${x.toFixed(1)},${y - 8} l8,8 l-8,8 l-8,-8 Z"/>`;
  if (key === 'cl') return `<circle class="hit lane-cl" cx="${x.toFixed(1)}" cy="${y}" r="7"/>`;
  if (key === 'an') return `<rect class="hit lane-an" x="${(x - 6.5).toFixed(1)}" y="${y - 6.5}" width="13" height="13" rx="2"/>`;
  return `<path class="hit lane-pg" d="M${x.toFixed(1)},${y - 8} l8,14 h-16 Z"/>`;
}

/** The ten-year timeline; selected marks the item whose detail is shown. */
export function evidenceSVG(selected = DEFAULT_EVIDENCE) {
  const p = [];
  for (const lane of LANES) p.push(`<line class="lane" x1="${XA[0] - 8}" x2="${XB[1]}" y1="${lane.y}" y2="${lane.y}"/>`, text(14, lane.y + 4, lane.name, `lane-name lane-text-${lane.key}`));
  const axis = 344;
  p.push(`<line class="axis" x1="${XA[0]}" x2="${XA[1]}" y1="${axis}" y2="${axis}"/><line class="axis" x1="${XB[0]}" x2="${XB[1]}" y1="${axis}" y2="${axis}"/>`);
  p.push(`<path class="axis-break" d="M${XA[1] + 4},${axis + 6} l6,-12 M${XA[1] + 10},${axis + 6} l6,-12"/>`);
  for (const year of [2016, 2018, 2020, 2022, 2023, 2024, 2025, 2026, 2027]) {
    const x = ex(`${year}-01-01`);
    p.push(`<line class="grid-tick" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${axis}" y2="${axis + 5}"/>`, text(x, axis + 19, year, 'tick', 'middle'));
    if (year >= 2023) p.push(`<line class="grid" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="48" y2="${axis}"/>`);
  }
  const checked = ex(RECORD_CHECKED);
  p.push(`<line class="checked-line" x1="${checked.toFixed(1)}" x2="${checked.toFixed(1)}" y1="44" y2="${axis}"/>`, text(checked + 4, 36, 'record checked', 'note', 'end'));
  for (const arc of RESPONSE_ARCS) {
    const a = EVIDENCE_POSITIONS[EVIDENCE.findIndex(item => item.id === arc.from)];
    const b = EVIDENCE_POSITIONS[EVIDENCE.findIndex(item => item.id === arc.to)];
    const cx = Math.max(a.x, b.x) + 46, cy = (a.y + b.y) / 2;
    const lx = arc.side === 'right' ? cx - 4 : Math.min(a.x, b.x) - 16, anchor = arc.side === 'right' ? 'start' : 'end';
    p.push(`<path class="response-arc" d="M${(a.x + 9).toFixed(1)},${a.y} Q${cx.toFixed(1)},${cy} ${(b.x + 9).toFixed(1)},${b.y}"/>`, text(lx, cy - 2, arc.lines[0], 'note-strong', anchor), text(lx, cy + 14, arc.lines[1], 'note', anchor));
  }
  EVIDENCE.forEach((item, i) => {
    const { x, y } = EVIDENCE_POSITIONS[i];
    const lane = laneOf(item.lane);
    p.push(`<g class="evidence-mark${i === selected ? ' is-selected' : ''}" tabindex="0" role="button" data-evidence="${i}" aria-pressed="${i === selected}" aria-label="${escapeHTML(`${item.d}, ${lane.name}: ${item.who}`)}"><circle class="target" cx="${x.toFixed(1)}" cy="${y}" r="16"/>${glyph(item.lane, x, y)}</g>`);
  });
  return p.join('');
}

export function evidenceDetail(i = DEFAULT_EVIDENCE) {
  const item = EVIDENCE[i];
  const lane = laneOf(item.lane);
  return `<div class="evidence-when"><span class="evidence-date">${item.d}</span><span class="evidence-lane lane-text-${lane.key}">${lane.name}</span></div><div class="evidence-body"><h4>${escapeHTML(item.who)}</h4><p class="evidence-venue"><a href="${escapeHTML(item.url)}" rel="noopener" target="_blank">${escapeHTML(item.venue)} <span class="external-glyph" aria-hidden="true">↗</span></a></p><p>${escapeHTML(item.text)}</p></div>`;
}

/* ---------- The committed future ---------- */

export const CLOCK = Object.freeze({ dossierBy: '2027-07-04', judged: '2027-12-31', windowDays: daysBetween('2027-07-04', '2027-12-31') });

export function futureSVG() {
  const start = day('2026-10-01'), end = day('2028-02-01');
  const fx = iso => 40 + (day(iso) - start) / (end - start) * 920;
  const axis = 128, p = [];
  const w0 = fx(CLOCK.dossierBy), w1 = fx(CLOCK.judged);
  p.push(`<rect class="window" x="${w0.toFixed(1)}" y="44" width="${(w1 - w0).toFixed(1)}" height="${axis - 44}"/>`);
  p.push(text((w0 + w1) / 2, 66, `challenge window, at least ${CLOCK.windowDays} days`, 'note-classical', 'middle'), text((w0 + w1) / 2, 84, 'every classical answer public by the cutoff counts', 'note', 'middle'));
  p.push(`<line class="axis" x1="40" x2="960" y1="${axis}" y2="${axis}"/>`);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const iso of ['2026-11-01', '2027-01-01', '2027-03-01', '2027-05-01', '2027-07-01', '2027-09-01', '2027-11-01', '2028-01-01']) {
    const [y, m] = iso.split('-'), x = fx(iso);
    p.push(`<line class="grid-tick" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${axis}" y2="${axis + 5}"/>`, text(x, axis + 19, months[Number(m) - 1] + (m === '01' ? ` ${y}` : ''), 'tick', 'middle'));
  }
  const cx = fx(RECORD_CHECKED);
  p.push(`<circle class="checked-mark" cx="${cx.toFixed(1)}" cy="${axis}" r="5"/>`, text(cx + 10, axis - 12, `record checked, ${RECORD_CHECKED}`, 'note-strong'), text(cx + 10, 58, 'registration pending: results before it cannot count', 'note'));
  const dx = fx(CLOCK.dossierBy);
  p.push(`<line class="deadline" x1="${dx.toFixed(1)}" x2="${dx.toFixed(1)}" y1="40" y2="${axis}"/><circle class="deadline-mark" cx="${dx.toFixed(1)}" cy="${axis}" r="5"/>`);
  p.push(text(dx - 8, 104, 'quantum dossier public by', 'note-quantum', 'end'), text(dx - 8, 119, `${CLOCK.dossierBy}, 23:59 UTC`, 'note-quantum', 'end'));
  const jx = fx(CLOCK.judged);
  p.push(`<circle class="judgment-mark" cx="${jx.toFixed(1)}" cy="${axis}" r="8"/>`, text(jx + 10, axis + 42, `judged once, ${CLOCK.judged}`, 'note-bar', 'end'));
  return p.join('');
}

export const OUTCOMES = Object.freeze([
  { id: 'o-established-benchmark', short: 'Established', tier: 'Moves to Established, for this benchmark only', when: 'Positive, at least two independent positive confirmations, no decisive contradictory reproduction.' },
  { id: 'o-contested', short: 'Active debate', tier: 'Moves to Active debate, for this benchmark only', when: 'Positive, and at least one decisive contradictory reproduction exists.' },
  { id: 'o-positive-awaiting-confirmation', short: 'Speculation', tier: 'Stays Speculation, shown prominently with its confirmation count', when: 'Positive, fewer than two independent positive confirmations, no decisive contradictory reproduction.' },
  { id: 'o-threshold-not-met', short: 'Speculation', tier: 'Stays Speculation; threshold not shown', when: 'The bound dossier fails: its speed score’s upper bound is below 2.0, or it misses the ten-run rule.' },
  { id: 'o-otherwise', short: 'Speculation', tier: 'Stays Speculation; inconclusive', when: 'The bound dossier is eligible but inconclusive.' },
  { id: 'o-lapsed', short: 'Speculation', tier: 'Stays Speculation; lapsed', when: 'No dossier was complete, eligible and public by 2027-07-04: no result, never a negative one.' },
]);
export const DEFAULT_SCENARIO = Object.freeze({ dossier: 'positive', confirmations: 1, contradiction: false });

/** The record's outcome rule, applied once at the cutoff. The outcomes do not overlap. */
export function decide({ dossier, confirmations, contradiction }) {
  if (dossier === 'none') return 'o-lapsed';
  if (dossier === 'fails') return 'o-threshold-not-met';
  if (dossier === 'inconclusive') return 'o-otherwise';
  if (dossier !== 'positive') throw new RangeError(`Unknown dossier state: ${dossier}`);
  if (contradiction) return 'o-contested';
  return confirmations >= 2 ? 'o-established-benchmark' : 'o-positive-awaiting-confirmation';
}

export function verdict(scenario = DEFAULT_SCENARIO) {
  const outcome = OUTCOMES.find(item => item.id === decide(scenario));
  const why = outcome.id === 'o-positive-awaiting-confirmation' ? `${outcome.when} Confirmations shown: ${scenario.confirmations}.` : outcome.when;
  return { outcome, why };
}

export function outcomeList(selectedId = decide(DEFAULT_SCENARIO)) {
  return OUTCOMES.map(item => `<li data-outcome="${item.id}"${item.id === selectedId ? ' class="is-selected" aria-current="true"' : ''}><span class="outcome-when">${escapeHTML(item.when)}</span><span class="outcome-tier">${escapeHTML(item.short)}</span><code>${item.id}</code></li>`).join('');
}

/* ---------- The ledger behind it ---------- */

// PsychDoc's psilocybin map on the feat/map-events branch (not yet deployed): events by revision date.
export const LEDGER = Object.freeze({
  byDate: [['2026-07-19', 12], ['2026-09-29', 19], ['2026-10-05', 4], ['2026-10-10', 29], ['2026-10-11', 22], ['2026-10-24', 2]],
  conclusionChanges: ['2026-09-29', '2026-10-11', '2026-10-24'],
  revisions: 10,
  kinds: { added: 36, restated: 48, 'sources-changed': 4 },
  recordedAtTheTime: 2,
});
export const LEDGER_EVENTS = LEDGER.byDate.reduce((sum, [, n]) => sum + n, 0);

export function ledgerSVG() {
  const start = day('2026-07-12'), end = day('2026-10-31');
  const gx = iso => 30 + (day(iso) - start) / (end - start) * 580;
  const base = 150, shift = { '2026-10-10': -7, '2026-10-11': 7 }, p = [];
  p.push(`<line class="axis" x1="30" x2="610" y1="${base}" y2="${base}"/>`);
  for (const [iso, label] of [['2026-08-01', 'Aug'], ['2026-09-01', 'Sep'], ['2026-10-01', 'Oct 2026']]) {
    p.push(`<line class="grid-tick" x1="${gx(iso).toFixed(1)}" x2="${gx(iso).toFixed(1)}" y1="${base}" y2="${base + 5}"/>`, text(gx(iso), base + 19, label, 'tick', 'middle'));
  }
  for (const [iso, count] of LEDGER.byDate) {
    const cx = gx(iso) + (shift[iso] || 0), recorded = iso === '2026-10-24';
    for (let k = 0; k < count; k++) p.push(`<circle class="${recorded ? 'event-recorded' : 'event-reconstructed'}" cx="${(cx - 2.6 + (k % 2) * 5.2).toFixed(1)}" cy="${(base - 6 - Math.floor(k / 2) * 5.6).toFixed(1)}" r="2.1"/>`);
  }
  for (const iso of LEDGER.conclusionChanges) p.push(`<path class="conclusion-mark" d="M${(gx(iso) + (shift[iso] || 0)).toFixed(1)},${base + 28} l5,8 h-10 z"/>`);
  const last = gx('2026-10-24');
  // Anchored at the right, so the legend stays in view when a phone opens the chart on its recent end.
  p.push(text(610, 24, 'one dot per dated event · ▲ conclusion changed', 'note', 'end'));
  p.push(`<path class="leader" d="M${last.toFixed(1)},${base - 18} V48 H${(last - 6).toFixed(1)}"/>`, text(last - 10, 52, 'correction, recorded at the time', 'note-bar', 'end'));
  return p.join('');
}
