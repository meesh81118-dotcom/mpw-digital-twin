// ===== Plant model (same equations as plant_model.py, Appendix H.1) =====
const S10 = {H2: 5000.01, CO: 2413.49, CO2: 69.95, CH4: 0.083, H2O: 368.89};
const S7 = 2797.67, X1 = 0.16, X2 = 0.029998, XH2 = 0.995, VF_W = 0.035050, VF_M = 0.020571, XCO_WGS = 0.90;
const Y_W18 = 153.59 / (5067.44 - 153.59), PI_M = 1.8032e-3, P1m = 1.0e5, P2m = 0.04e5, A_INST = 6040.63;
const KEYS = ['H2', 'CO', 'CO2', 'CH4', 'H2O', 'MeOH'];
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
function membrane(feed, rho) {
  const nf = sum(feed), h2 = feed.H2, xf = h2 / nf, xr = (1 - rho) * h2 / (nf - rho * h2);
  const d1 = Math.sqrt(P1m * xf) - Math.sqrt(P2m), d2 = Math.sqrt(P1m * xr) - Math.sqrt(P2m);
  return rho * h2 / 3.6 / (PI_M * (d1 - d2) / Math.log(d1 / d2));
}
function loop(S18, phi) {
  let rec = {}; KEYS.forEach(k => rec[k] = 0); let f, out, vap, liq, x1, x2;
  for (let it = 0; it < 600; it++) {
    f = {}; KEYS.forEach(k => f[k] = (S18[k] || 0) + rec[k]);
    x1 = X1 * f.CO; x2 = X2 * f.CO2; const s = Math.min(1, XH2 * f.H2 / (2 * x1 + 3 * x2)); x1 *= s; x2 *= s;
    out = {H2: f.H2 - 2 * x1 - 3 * x2, CO: f.CO - x1, CO2: f.CO2 - x2, CH4: f.CH4, H2O: f.H2O + x2, MeOH: f.MeOH + x1 + x2};
    vap = Object.assign({}, out); vap.H2O = VF_W * out.H2O; vap.MeOH = VF_M * out.MeOH;
    liq = {H2O: out.H2O - vap.H2O, MeOH: out.MeOH - vap.MeOH};
    let err = 0; const nw = {}; KEYS.forEach(k => { nw[k] = (1 - phi) * vap[k]; err = Math.max(err, Math.abs(nw[k] - rec[k])); });
    rec = nw; if (err < 1e-7) break;
  }
  return {f, out, vap, liq, rec, x1, x2};
}
function plant(beta, phi, rho, feed = 1) {
  const S11 = {}, S12 = {}; for (const k in S10) { S11[k] = feed * beta * S10[k]; S12[k] = feed * (1 - beta) * S10[k]; }
  const S6 = 2 * S12.CO - S12.H2O, water = feed * S7 + S6, xw = XCO_WGS * S12.CO;
  const S15 = {H2: S12.H2 + xw, CO: S12.CO - xw, CO2: S12.CO2 + xw, CH4: S12.CH4, H2O: 2 * S12.CO - xw};
  const A = membrane(S15, rho), H2p = rho * S15.H2; const S17 = Object.assign({}, S15); S17.H2 -= H2p;
  const dry = {}; ['H2', 'CO', 'CO2', 'CH4'].forEach(k => dry[k] = S17[k] + S11[k]);
  const S18 = Object.assign({}, dry); S18.H2O = Y_W18 * sum(dry);
  const L = loop(S18, phi);
  return {S6, water, S15: sum(S15), A, H2p, S18: sum(S18), S20: sum(L.f), S23: sum(L.vap), S24: sum(L.rec), S26: sum(L.liq),
    MeOH: 0.999 * L.liq.MeOH, x1: L.x1, x2: L.x2, purge: phi * sum(L.vap), S17: sum(S17), S11: sum(S11), S12: sum(S12), feed,
    purgeCO: phi * L.vap.CO, purgeCO2: phi * L.vap.CO2};
}
// ===== Economic model (Chapter 8, Appendix G) =====
const P_BASE = {meoh_kgh: 33701.38806641478, h2_kgh: 7806.985623098963, mpw_kgh: 37879.0, p_meoh: 393.0, p_h2: 2473.0, p_mpw: 80.0,
  p_elec: 0.23 / 3.75, p_ng: 2.5, p_water: 8.04 / 3.75, p_ww: 3.64 / 3.75, p_sw: 69.16 / 3.75 / 1000, eta_f: 0.85,
  cat_cost: (71198 + 17752) * 80.0 / 4.0, mem_cost: 6040 * 5000.0 * 840.9 / 797.9 * 0.8 / 5.0, COL: 78 * 132222 / 3.75, land: 0.0,
  Q_R101: 145.67, bfw: 72.9, proc_water: 98.58747, ww: 8.538 + 28.58746, wc: 0.1, salvage: 0.05, tax: 0.025, i: 0.1,
  fci_mult: 1.0, op_factor: 1.0, logi: 0, Q_heat: 25.92758, hi: true, com_mult: 1.0, elec_mult: 1.0};
const HI_X = 10429187, FCI_NOHI = 477231118.72, HI_DHEAT = 10139338.72, HI_DCW = 884645.81, HI_DSTEAM = 1813346.49, PSW0 = 69.16 / 3.75 / 1000;
const FCI = 478400128.68, WCIRC = 823.07, C102W = 28551.90, WCH = 810.59, QR102 = 14.22877;
const HRS = 7920.0, GJ_MW = 3.6 * HRS, MACRS5 = [20, 32, 19.2, 11.52, 11.52, 5.76];
const BASE_R = plant(0.40, 0.10, 0.90, 1);
function econParams(r, mk) {
  const b = BASE_R, p = Object.assign({}, P_BASE, mk || {});
  p.meoh_kgh = P_BASE.meoh_kgh * r.MeOH / b.MeOH; p.h2_kgh = P_BASE.h2_kgh * r.H2p / b.H2p;
  p.mpw_kgh = P_BASE.mpw_kgh * r.feed; p.Q_R101 = P_BASE.Q_R101 * r.feed;
  const k18 = r.S18 / b.S18, k24 = r.S24 / b.S24, kh = r.H2p / b.H2p;
  p.W_total = 22533.2 * k18 + WCIRC * k24 + C102W * kh + WCH * r.S17 / b.S17 + 2083 + 5 * 228 + 1500;
  p.Q_CW = 12.396 * r.S20 / b.S20 + 20.625 * r.S17 / b.S17 + 18.843 * r.MeOH / b.MeOH + 17.772 * k18 + C102W / 1000 * kh;
  p.Q_steam = QR102 * (28.3 - 13.0) / 28.3 * r.S15 / b.S15 + (r.x1 * 96547.3 + r.x2 * 56581.2) / 3.6e6;
  p.Q_heat = P_BASE.Q_heat + (r.water - b.water) / b.water * (70.379 + 27.363);
  p.proc_water = P_BASE.proc_water * r.water / b.water;
  p.Q_heat += (p.qh_add || 0); p.Q_CW += (p.qc_add || 0); return p;
}
function comD(p, F, f) {
  const meoh = p.meoh_kgh * HRS / 1000 * f, h2 = p.h2_kgh * HRS / 1000 * f, mpw = p.mpw_kgh * HRS / 1000 * f;
  const rev = meoh * (p.p_meoh - p.logi) + h2 * p.p_h2;
  const CRM = mpw * p.p_mpw + (p.proc_water + p.bfw) * HRS * f * p.p_water + p.cat_cost + p.mem_cost;
  const fe = p.p_ng / 1.055056 / p.eta_f;
  let CUT = p.W_total * HRS * f * p.p_elec * p.elec_mult + p.Q_R101 / p.eta_f * GJ_MW * f / 1.055056 * p.p_ng + p.Q_heat * GJ_MW * f * fe
    + p.Q_CW * 1000 / (4.0 * 10) / 1025 * 3600 * HRS * f * p.p_sw - p.Q_steam * GJ_MW * f * fe;
  if (!p.hi) CUT += f * HI_X * (0.9040 * p.p_ng / 2.5 * 0.85 / p.eta_f + 0.0960 * p.p_sw / PSW0);
  const CWT = p.ww * HRS * f * p.p_ww, coef = (0.146 - 0.032 + 0.010) / 0.81;
  return [rev, p.com_mult * (coef * F + 2.73 * p.COL + 1.23 * (CRM + CUT + CWT)) + p.land, {CRM, CUT, CWT, COL: p.COL, F, coefF: coef * F}];
}
function cashflow(p) {
  const F = (p.hi ? FCI : FCI_NOHI) * p.fci_mult + (p.fci_add || 0), WC = p.wc * F, S = p.salvage * F; let carry = 0; const cf = [];
  for (let y = 0; y < 23; y++) {
    let c = 0; if (y === 1 || y === 2) c -= 0.5 * F; if (y === 2) c -= WC; const k = y - 3;
    if (k >= 0) {
      const f = k < 2 ? [0.75, 0.90][k] : 1.0; const [R, C] = comD(p, F, f * p.op_factor);
      const d = k < 6 ? MACRS5[k] / 100 * F : 0; const ti = R - C - d; let taxable;
      if (ti < 0) { carry -= ti; taxable = 0; } else { const use = Math.min(carry, ti); carry -= use; taxable = ti - use; }
      c += ti - p.tax * taxable + d;
    }
    if (y === 22) c += WC + S; cf.push(c);
  }
  return cf;
}
const npvAt = (cf, i) => cf.reduce((a, c, y) => a + c / Math.pow(1 + i, y), 0);
function indicators(cf, i) {
  let lo = -0.3, hi = 0.6, irr = null;
  if (npvAt(cf, lo) > 0 && npvAt(cf, hi) < 0) { for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (npvAt(cf, m) > 0) lo = m; else hi = m; } irr = (lo + hi) / 2; }
  let dc = 0, dpb = null, prev = 0;
  for (let y = 0; y < cf.length; y++) { prev = dc; dc += cf[y] / Math.pow(1 + i, y); if (dpb === null && y > 2 && dc >= 0) dpb = y - 1 + (-prev) / (dc - prev) - 2; }
  return {npv: npvAt(cf, i) / 1e6, irr, dpb};
}
// ===== Design limits and operating modes =====
const LIMITS_MAX = {S15: 1.00, S18: 1.05, S20: 1.05, S23: 1.05, S26: 1.05, H2p: 1.05, feed: 1.05};
function limitsFor(mode, margin) {
  const L = {}; for (const k in LIMITS_MAX) L[k] = mode === 'safe' ? Math.min(1.0, LIMITS_MAX[k]) * (1 - margin) : LIMITS_MAX[k];
  L.A = mode === 'safe' ? 1 - margin : 1.0; return L;
}
function evaluate(x, mk, L) {
  L = L || limitsFor('max', 0);
  const r = plant(x[0], x[1], x[2], x[3] === undefined ? 1 : x[3]); const p = econParams(r, mk); const cf = cashflow(p);
  let worst = r.A / (A_INST * L.A), lim = 'ME-101 area';
  for (const k in LIMITS_MAX) { const v = r[k] / (L[k] * (k === 'feed' ? 1 : BASE_R[k])); if (v > worst) { worst = v; lim = k; } }
  const ind = indicators(cf, p.i);
  return {r, p, cf, npv: ind.npv, irr: ind.irr, dpb: ind.dpb, worst, limiting: lim, ok: worst <= 1 + 1e-6};
}
// differential evolution (seeded, so every search gives the same answer for the same inputs)
function optimise(mk, opts) {
  opts = Object.assign({objective: 'npv', mode: 'max', margin: 0, feed: 1}, opts || {});
  const L = limitsFor(opts.mode, opts.margin), freeFeed = opts.objective === 'feed' || opts.mode === 'safe';
  const fhi = opts.mode === 'safe' ? 1.0 : 1.10, pen = opts.objective === 'npv' && opts.mode === 'max' ? 1 : 30;
  const lo = [0.35, 0.08, 0.85].concat(freeFeed ? [0.80] : []), hi = [0.45, 0.12, 0.93].concat(freeFeed ? [fhi] : []);
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const score = e => opts.objective === 'npv' ? e.npv : opts.objective === 'meoh' ? e.r.MeOH / 10 + e.npv / 1000
    : opts.objective === 'h2' ? e.r.H2p / 40 + e.npv / 1000 : e.r.feed * 1000 + e.npv / 1000;
  const obj = z => { const x = freeFeed ? z : z.concat([opts.feed]); const e = evaluate(x, mk, L); return score(e) - (e.ok ? 0 : 1 + 300 * (e.worst - 1) * pen); };
  const D = lo.length, NP = 24, G = 110; let pop = [], fit = [];
  for (let j = 0; j < NP; j++) { const z = lo.map((l, i) => l + (hi[i] - l) * rnd()); if (j === 0) z.splice(0, D, ...[0.40, 0.10, 0.90].concat(freeFeed ? [1.0] : [])); pop.push(z); fit.push(obj(z)); }
  for (let g = 0; g < G; g++) for (let j = 0; j < NP; j++) {
    let a, b, c; do { a = Math.floor(rnd() * NP); } while (a === j); do { b = Math.floor(rnd() * NP); } while (b === j || b === a);
    do { c = Math.floor(rnd() * NP); } while (c === j || c === a || c === b);
    const R = Math.floor(rnd() * D); const t = pop[j].map((v, i) => (rnd() < 0.9 || i === R) ? Math.min(hi[i], Math.max(lo[i], pop[a][i] + 0.7 * (pop[b][i] - pop[c][i]))) : v);
    const ft = obj(t); if (ft >= fit[j]) { pop[j] = t; fit[j] = ft; }
  }
  let ib = 0; fit.forEach((f, j) => { if (f > fit[ib]) ib = j; });
  const x = freeFeed ? pop[ib] : pop[ib].concat([opts.feed]); return {x, n: NP * (G + 1), e: evaluate(x, mk, L)};
}
// ===== e-methanol extension (carbon_emethanol.py, Appendix H.4) =====
const EM = {CO: 382.20, CO2: 1048.87, H2: 1.22, X: 0.95, C_in: 2556.14, fuel_MW: (382.20 * 282.99 + 1.22 * 241.82 + 2.21 * 676.2) / 3600,
  CBM_syn: 20152604.0, FCI_ratio: 478400128.68 / 298183405.96, P0: 266915.0};
EM.CRF = 0.10 * Math.pow(1.1, 20) / (Math.pow(1.1, 20) - 1);
function emethanol(f, c_el, capex_kw, e_spec) {
  const meoh = EM.X * f * (EM.CO + EM.CO2), h2 = EM.X * f * (2 * EM.CO + 3 * EM.CO2) - f * EM.H2, h2kg = h2 * 2.016;
  const P_el = h2kg * 55 / 1000, ng_MW = f * EM.fuel_MW / 0.85;
  const co2_use = EM.X * f * (EM.CO + EM.CO2) * 44.01 * HRS / 1000, co2_ng = ng_MW * 1000 * (56100 / 1e6 * 3.6) * HRS / 1000;
  const o = {meoh_t: meoh * 32.042 * HRS / 1000, h2_t: h2kg * HRS / 1000, P_el, P_el_spec: h2kg * e_spec / 1000, ng_MW, co2_net: co2_use - co2_ng,
    eta_C: (1049.12 + meoh) / EM.C_in * 100, water_t: h2 * 18.015 * HRS / 1000, o2_t: h2 / 2 * 31.998 * HRS / 1000,
    water_made_t: EM.X * f * EM.CO2 * 18.015 * HRS / 1000};
  if (f <= 0) return Object.assign(o, {syn: 0, elz: 0, elec: 0, ng: 0, total: 0});
  const Q = o.meoh_t, FCIs = EM.FCI_ratio * EM.CBM_syn * Math.pow(Q / EM.P0, 0.6), h2_per_t = h2kg / (meoh * 32.042) * 1000;
  o.syn = FCIs * (EM.CRF + 0.05) / Q; o.elz = o.h2_t * 1000 / HRS * e_spec * capex_kw * (EM.CRF + 0.02) / Q;
  o.elec = h2_per_t * e_spec * c_el; o.ng = ng_MW * 1000 * HRS * 3412.14 / 1e6 * 2.5 / Q; o.total = o.syn + o.elz + o.elec + o.ng; return o;
}
// detailed yearly results (Table 8.21)
function econDetail(p) {
  const F = (p.hi ? FCI : FCI_NOHI) * p.fci_mult + (p.fci_add || 0), WC = p.wc * F, S = p.salvage * F; let carry = 0; const rows = [];
  for (let y = 0; y < 23; y++) {
    let inv = 0; if (y === 1 || y === 2) inv -= 0.5 * F; if (y === 2) inv -= WC; const k = y - 3; let R = 0, C = 0, d = 0, np = 0, parts = null;
    if (k >= 0) { const f = k < 2 ? [0.75, 0.90][k] : 1.0; const res = comD(p, F, f * p.op_factor); R = res[0]; C = res[1]; parts = res[2];
      d = k < 6 ? MACRS5[k] / 100 * F : 0; const ti = R - C - d; let taxable; if (ti < 0) { carry -= ti; taxable = 0; } else { const use = Math.min(carry, ti); carry -= use; taxable = ti - use; } np = ti - p.tax * taxable; }
    let cf = inv + (k >= 0 ? np + d : 0); if (y === 22) cf += WC + S; rows.push({y, inv, R, C, d, np, cf, parts});
  }
  const op = rows.filter(r => r.y >= 3), npavg = op.reduce((a, r) => a + r.np, 0) / op.length;
  return {rows, F, WC, npavg, roroi: npavg / (F + WC), pbp: F / (npavg + F / op.length), full: rows[5]};
}
if (typeof module !== 'undefined') module.exports = {plant, evaluate, optimise, limitsFor, BASE_R, emethanol, cashflow, econParams, indicators, P_BASE, econDetail};
