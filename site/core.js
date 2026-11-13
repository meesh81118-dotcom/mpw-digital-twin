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
function plant(beta, phi, rho, feed = 1, fm = null) {
  const G = fm ? fm.S10 : S10;   // syngas of R-101 per unit feed: Chapter 2, or the feedstock model for another MPW
  const S11 = {}, S12 = {}; for (const k in G) { S11[k] = feed * beta * G[k]; S12[k] = feed * (1 - beta) * G[k]; }
  const S6 = Math.max(0, 2 * S12.CO - S12.H2O), water = feed * S7 + S6, xw = XCO_WGS * S12.CO;
  const S15 = {H2: S12.H2 + xw, CO: S12.CO - xw, CO2: S12.CO2 + xw, CH4: S12.CH4, H2O: S12.H2O + S6 - xw};
  const A = membrane(S15, rho), H2p = rho * S15.H2; const S17 = Object.assign({}, S15); S17.H2 -= H2p;
  const dry = {}; ['H2', 'CO', 'CO2', 'CH4'].forEach(k => dry[k] = S17[k] + S11[k]);
  const S18 = Object.assign({}, dry); S18.H2O = Y_W18 * sum(dry);
  const L = loop(S18, phi);
  return {S6, water, S15: sum(S15), A, H2p, S18: sum(S18), S20: sum(L.f), S23: sum(L.vap), S24: sum(L.rec), S26: sum(L.liq),
    MeOH: 0.999 * L.liq.MeOH, x1: L.x1, x2: L.x2, purge: phi * sum(L.vap), S17: sum(S17), S11: sum(S11), S12: sum(S12), feed,
    purgeCO: phi * L.vap.CO, purgeCO2: phi * L.vap.CO2, purgeH2: phi * L.vap.H2, purgeCH4: phi * L.vap.CH4,
    S10: feed * sum(G), char: feed * (fm ? fm.char : CHAR0), fm, gas: G, Q101: feed * (1 + (fm ? fm.qExtra : 0) / 145.67)};
}
// ===== Feedstock model (extension of Section 2.2): polymer mix and contaminants -> elemental composition -> R-101 equilibrium
// Polymer elemental mass fractions (C, H, O, Cl) from the repeat units; HHV in MJ/kg.
const POLY = {HDPE: {C: .8563, H: .1437, O: 0, Cl: 0, hhv: 46.4}, LDPE: {C: .8563, H: .1437, O: 0, Cl: 0, hhv: 46.6}, PP: {C: .8563, H: .1437, O: 0, Cl: 0, hhv: 46.4},
  PS: {C: .9226, H: .0774, O: 0, Cl: 0, hhv: 41.4}, PET: {C: .6250, H: .0420, O: .3330, Cl: 0, hhv: 22.9}, PVC: {C: .3844, H: .0484, O: 0, Cl: .5672, hhv: 19.9}};
const PKEYS = ['HDPE', 'LDPE', 'PP', 'PS', 'PET', 'PVC'];
// design MPW: the polymer mix that stands for Table 2.3; w = moisture and a = inerts (wt% of the waste received), pur = pre-treatment 0-100 %
const FQ_DES = {HDPE: 24, LDPE: 22, PP: 26, PS: 13, PET: 15, PVC: 0, w: 0, a: 0, pur: 0};
const MPW_KGH = 37879, MPW0 = {C: 2556.14 * 12.011 / 37879, H: 2571.39 * 2.016 / 37879, O: 62.30 * 31.998 / 37879};   // Table 2.3 (kmol/h of C, H2 and O2)
const CHAR0 = 72.616, CH40 = 0.083, C0 = 2556.14, T_EQ = 1267.937, K_EQ = Math.exp(4800 / T_EQ - 4.72);
const polyMix = sh => { const t = PKEYS.reduce((a, k) => a + (sh[k] || 0), 0) || 1, o = {C: 0, H: 0, O: 0, Cl: 0, hhv: 0}; PKEYS.forEach(k => { const f = (sh[k] || 0) / t; for (const e in o) o[e] += f * POLY[k][e]; }); return o; };
const MIX0 = polyMix(FQ_DES);
// removal by the pre-treatment line at 100 %: NIR sorting of PVC, thermal drying, screening and eddy-current separation of inerts
const PRE = {PVC: 0.92, w: 0.85, a: 0.95, loss: 0.015};
function feedModel(fq) {
  fq = Object.assign({}, FQ_DES, fq || {}); const p = Math.max(0, Math.min(1, (fq.pur || 0) / 100));
  const w0 = Math.max(0, fq.w || 0) / 100, a0 = Math.max(0, fq.a || 0) / 100, P0 = Math.max(0, 1 - w0 - a0);
  const tot = PKEYS.reduce((a, k) => a + (fq[k] || 0), 0) || 1, sPVC = (fq.PVC || 0) / tot;
  // per kg of waste received, after the pre-treatment line
  const pvc = P0 * sPVC * (1 - PRE.PVC * p), other = P0 * (1 - sPVC) * (1 - PRE.loss * p), wat = w0 * (1 - PRE.w * p), ine = a0 * (1 - PRE.a * p);
  const Y = pvc + other + wat + ine;   // kg of cleaned feed per kg received
  const sh = {}; PKEYS.forEach(k => sh[k] = k === 'PVC' ? pvc : other * (fq[k] || 0) / Math.max(1e-12, tot - (fq.PVC || 0)));
  const mix = polyMix(sh), fP = (pvc + other) / Y, fW = wat / Y, fA = ine / Y;
  // elemental composition of the plastic, calibrated so that the design mix gives Table 2.3 exactly
  const el = {C: Math.max(0, MPW0.C + mix.C - MIX0.C), H: Math.max(0, MPW0.H + mix.H - MIX0.H), O: Math.max(0, MPW0.O + mix.O - MIX0.O), Cl: mix.Cl};
  const se = el.C + el.H + el.O + el.Cl, s0 = MPW0.C + MPW0.H + MPW0.O; for (const e in el) el[e] *= s0 / se;
  const kg = MPW_KGH, nC = kg * fP * el.C / 12.011, nH = kg * fP * el.H / 1.008, nO = kg * fP * el.O / 15.999, nCl = kg * fP * el.Cl / 35.453, nW = kg * fW / 18.015;
  // R-101: atom balances with the shift equilibrium at the temperature approach of Section 2.2 (Eqs I-IV); char and CH4 in the design ratio to the carbon fed
  const char = CHAR0 / C0 * nC, ch4 = CH40 / C0 * nC, hcl = nCl;
  const Cg = nC - char - ch4, Og = nO + S7 + nW, Hg = (nH + 2 * (S7 + nW) - 4 * ch4 - hcl) / 2, D = Og - Cg, Gq = Hg - Og + Cg;
  const a = 1 - K_EQ, b = K_EQ * (Cg + D) + Gq, c = -K_EQ * Cg * D; let x = D > 0 ? (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a) : 0; x = Math.max(0, Math.min(x, Cg, Math.max(0, D)));
  const S10m = {H2: Gq + x, CO: Cg - x, CO2: x, CH4: ch4, H2O: D - x};
  // heat and costs of the feed quality (zero for the design feed)
  const hhvP = 0.3491 * el.C * 100 + 1.1783 * el.H * 100 - 0.1034 * el.O * 100, hhvFeed = fP * hhvP;   // MJ/kg of cleaned feed (Channiwala and Parikh)
  const qExtra = (kg * fW * 4.88 + kg * fA * 1.06) / 3600;   // MW: evaporate the moisture and heat it and the inerts to 1,200 °C in R-101
  const rec = kg / Y;   // kg/h of waste bought for one unit of feed rate
  const removedW = rec * (w0 - wat), removedS = rec * (P0 * sPVC * PRE.PVC * p + P0 * (1 - sPVC) * PRE.loss * p + a0 * PRE.a * p);
  const qDry = removedW * 2.9 / 3600;   // MW of fuel for the dryer
  const cost = rec / 1000 * 6 * p + removedS / 1000 * 25 + kg * fA / 1000 * 25 + hcl * 36.46 * 0.30;   // US$/h: sorting line, rejects and ash to landfill, HCl sorbent
  const synMW = (S10m.H2 * 285.8 + S10m.CO * 283.0 + S10m.CH4 * 890.3) / 3600, feedMW = kg * hhvFeed / 3600;   // MW, higher heating value
  const comb = S10m.H2 + S10m.CO + S10m.CH4, LFL = comb > 0 ? 1 / ((S10m.H2 / comb) / 4.0 + (S10m.CO / comb) / 12.5 + (S10m.CH4 / comb) / 5.0) : null,
    UFL = comb > 0 ? 1 / ((S10m.H2 / comb) / 75.0 + (S10m.CO / comb) / 74.0 + (S10m.CH4 / comb) / 15.0) : null;
  const clppm = el.Cl * fP * 1e6, hclppm = hcl / (sum(S10m) + hcl) * 1e6;
  return {S10: S10m, char, ch4, hcl, nC, nH, nO, nCl, nW, el, fP, fW, fA, Y, rec, sh, mix, qExtra, qDry, cost, removedW, removedS, hhv: hhvFeed, synMW, feedMW, LFL, UFL, clppm, hclppm,
    SC: (S7 + nW) / Math.max(1e-9, nC), h2co: S10m.H2 / Math.max(1e-9, S10m.CO), fq};
}
const isDesignFeed = fq => !fq || Object.keys(FQ_DES).every(k => Math.abs((fq[k] || 0) - FQ_DES[k]) < 1e-9);
// the design feed returns null, so that the plant runs on the syngas of Chapter 2 exactly
const FM_CACHE = {}; function feedOf(fq) { if (isDesignFeed(fq)) return null; const k = JSON.stringify(fq); return FM_CACHE[k] || (FM_CACHE[k] = feedModel(fq)); }
// ===== Economic model (Chapter 8, Appendix G) =====
const P_BASE = {meoh_kgh: 33701.38806641478, h2_kgh: 7806.985623098963, mpw_kgh: 37879.0, p_meoh: 393.0, p_h2: 2473.0, p_mpw: 80.0,
  p_elec: 0.23 / 3.75, p_ng: 2.5, p_water: 8.04 / 3.75, p_ww: 3.64 / 3.75, p_sw: 69.16 / 3.75 / 1000, eta_f: 0.85,
  cat_cost: (71198 + 17752) * 80.0 / 4.0, mem_cost: 6040 * 5000.0 * 840.9 / 797.9 * 0.8 / 5.0, COL: 78 * 132222 / 3.75, land: 0.0,
  Q_R101: 145.67, bfw: 72.9, proc_water: 98.58747, ww: 8.538 + 28.58746, wc: 0.1, salvage: 0.05, tax: 0.025, i: 0.1,
  fci_mult: 1.0, op_factor: 1.0, logi: 0, Q_heat: 25.92758, hi: true, com_mult: 1.0, elec_mult: 1.0,
  // economic inputs of the economics page (defaults = Chapter 8): construction years, operating years, depreciation,
  // cost index, price and cost escalation, change of the bare-module cost, purchased land
  build: 2, life: 20, dep: 'macrs5', cepci: 840.9, esc_p: 0, esc_c: 0, cbm_add: 0, land_buy: 0};
const HI_X = 10429187, FCI_NOHI = 477231118.72, HI_DHEAT = 10139338.72, HI_DCW = 884645.81, HI_DSTEAM = 1813346.49, PSW0 = 69.16 / 3.75 / 1000;
const FCI = 478400128.68, WCIRC = 823.07, C102W = 28551.90, WCH = 810.59, QR102 = 14.22877;
const UT_CAL = -2.65, COM_CAL = -0.0578;
const HRS = 7920.0, GJ_MW = 3.6 * HRS, MACRS5 = [20, 32, 19.2, 11.52, 11.52, 5.76];
// depreciation schedules (% of FCI per operating year, Turton Table 10.4); straight line over 10 years on FCI − salvage
const DEP = {macrs5: MACRS5, macrs7: [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46], macrs10: [10, 18, 14.4, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28], sl10: null};
const CEPCI0 = 840.9, SUM_CBM = 298183405.96, FCI_PER_CBM = 478400128.68 / SUM_CBM;   // FCI per US$ of bare-module cost (Chapter 8)
function fciOf(p) { return (((p.hi ? FCI : FCI_NOHI) * p.fci_mult) + FCI_PER_CBM * (p.cbm_add || 0)) * (p.cepci || CEPCI0) / CEPCI0 + (p.fci_add || 0); }
function depOf(p, k, F, S) { const t = DEP[p.dep || 'macrs5']; return t ? (k < t.length ? t[k] / 100 * F : 0) : (k < 10 ? (F - S) / 10 : 0); }
const BASE_R = plant(0.40, 0.10, 0.90, 1);
function econParams(r, mk) {
  const b = BASE_R, p = Object.assign({}, P_BASE, mk || {});
  p.meoh_kgh = P_BASE.meoh_kgh * r.MeOH / b.MeOH; p.h2_kgh = P_BASE.h2_kgh * r.H2p / b.H2p;
  p.mpw_kgh = P_BASE.mpw_kgh * r.feed; p.Q_R101 = P_BASE.Q_R101 * r.feed;
  if (r.fm) { const f = r.fm; p.mpw_kgh = f.rec * r.feed; p.Q_R101 += f.qExtra * r.feed; p.fq_add = f.cost * r.feed; p.qh_add = (p.qh_add || 0) + f.qDry * r.feed; }
  const k18 = r.S18 / b.S18, k24 = r.S24 / b.S24, kh = r.H2p / b.H2p;
  p.W_total = 22533.2 * k18 + WCIRC * k24 + C102W * kh + WCH * r.S17 / b.S17 + 2083 + 5 * 228 + 1500;
  p.Q_CW = 12.39579 * r.S20 / b.S20 + 20.62523 * r.S17 / b.S17 + 18.843 * r.MeOH / b.MeOH + 17.772 * k18 + C102W / 1000 * kh;
  p.Q_steam = QR102 * (28.3 - 13.0) / 28.3 * r.S15 / b.S15 + (r.x1 * 96547.3 + r.x2 * 56581.2) / 3.6e6;
  p.Q_heat = P_BASE.Q_heat + (r.water - b.water) / b.water * (70.379 + 27.363);
  p.proc_water = P_BASE.proc_water * r.water / b.water;
  p.Q_heat += (p.qh_add || 0); p.Q_CW += (p.qc_add || 0); p.W_total += (p.w_add || 0); return p;
}
function comD(p, F, f) {
  const meoh = p.meoh_kgh * HRS / 1000 * f, h2 = p.h2_kgh * HRS / 1000 * f, mpw = p.mpw_kgh * HRS / 1000 * f;
  const rev = meoh * (p.p_meoh - p.logi) + h2 * p.p_h2;
  const CRM = mpw * p.p_mpw + (p.proc_water + p.bfw) * HRS * f * p.p_water + p.cat_cost + p.mem_cost + (p.fq_add || 0) * HRS * f;
  const fe = p.p_ng / 1.055056 / p.eta_f;
  let CUT = p.W_total * HRS * f * p.p_elec * p.elec_mult + p.Q_R101 / p.eta_f * GJ_MW * f / 1.055056 * p.p_ng + p.Q_heat * GJ_MW * f * fe
    + p.Q_CW * 1000 / (4.0 * 10) / 1025 * 3600 * HRS * f * p.p_sw - p.Q_steam * GJ_MW * f * fe;
  if (!p.hi) CUT += f * HI_X * (0.9040 * p.p_ng / 2.5 * 0.85 / p.eta_f + 0.0960 * p.p_sw / PSW0);
  CUT += UT_CAL * f;   // closes the 2.65 $/yr rounding gap with the printed utility cost of Chapter 8
  const CWT = p.ww * HRS * f * p.p_ww, coef = (0.146 - 0.032 + 0.010) / 0.81;
  return [rev, p.com_mult * (coef * F + 2.73 * p.COL + 1.23 * (CRM + CUT + CWT) + COM_CAL * f) + p.land, {CRM, CUT, CWT, COL: p.COL, F, coefF: coef * F}];
}
function cashflow(p) { return econRows(p).rows.map(r => r.cf); }
// yearly cash flows: land in year 0, FCI spread evenly over the construction years, WC at the end of construction,
// operation at 75 % and 90 % in the first two years, losses carried forward, WC + salvage + land recovered in the last year
function econRows(p) {
  const F = fciOf(p), WC = p.wc * F, S = p.salvage * F, B = Math.max(1, Math.round(p.build || 2)), L = Math.max(1, Math.round(p.life || 20)), N = B + L, LB = p.land_buy || 0;
  const ep = p.esc_p || 0, ec = p.esc_c || 0; let carry = 0; const rows = [];
  for (let y = 0; y <= N; y++) {
    let inv = 0; if (y === 0) inv -= LB; if (y >= 1 && y <= B) inv -= F / B; if (y === B) inv -= WC; const k = y - B - 1; let R = 0, C = 0, d = 0, np = 0, parts = null;
    if (k >= 0) { const f = k < 2 ? [0.75, 0.90][k] : 1.0; const res = comD(p, F, f * p.op_factor); R = res[0] * Math.pow(1 + ep, y); C = res[1] * Math.pow(1 + ec, y); parts = res[2];
      d = depOf(p, k, F, S); const ti = R - C - d; let taxable; if (ti < 0) { carry -= ti; taxable = 0; } else { const use = Math.min(carry, ti); carry -= use; taxable = ti - use; } np = ti - p.tax * taxable; }
    let cf = inv + (k >= 0 ? np + d : 0); if (y === N) cf += WC + S + LB; rows.push({y, inv, R, C, d, np, cf, parts});
  }
  return {rows, F, WC, S, B, L, N};
}
const npvAt = (cf, i) => cf.reduce((a, c, y) => a + c / Math.pow(1 + i, y), 0);
function indicators(cf, i, B) {
  B = B || 2; let lo = -0.3, hi = 0.6, irr = null;
  if (npvAt(cf, lo) > 0 && npvAt(cf, hi) < 0) { for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (npvAt(cf, m) > 0) lo = m; else hi = m; } irr = (lo + hi) / 2; }
  let dc = 0, dpb = null, prev = 0;
  for (let y = 0; y < cf.length; y++) { prev = dc; dc += cf[y] / Math.pow(1 + i, y); if (dpb === null && y > B && dc >= 0) dpb = y - 1 + (-prev) / (dc - prev) - B; }
  return {npv: npvAt(cf, i) / 1e6, irr, dpb};
}
// ===== Design limits and operating modes =====
const LIMITS_MAX = {S15: 1.00, S18: 1.05, S20: 1.05, S23: 1.05, S26: 1.05, H2p: 1.05, feed: 1.05, Q101: 1.10};   // Q101: duty of the R-101 furnaces (feedstock extension)
function limitsFor(mode, margin) {
  const L = {}; for (const k in LIMITS_MAX) L[k] = mode === 'safe' ? Math.min(1.0, LIMITS_MAX[k]) * (1 - margin) : LIMITS_MAX[k];
  L.A = mode === 'safe' ? 1 - margin : 1.0; return L;
}
function evaluate(x, mk, L) {
  L = L || limitsFor('max', 0);
  const r = plant(x[0], x[1], x[2], x[3] === undefined ? 1 : x[3], mk && mk.fq ? feedOf(mk.fq) : null); const p = econParams(r, mk); const cf = cashflow(p);
  let worst = r.A / (A_INST * L.A), lim = 'ME-101 area';
  for (const k in LIMITS_MAX) { const v = r[k] / (L[k] * (k === 'feed' ? 1 : BASE_R[k])); if (v > worst) { worst = v; lim = k; } }
  const ind = indicators(cf, p.i, p.build);
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
  const E = econRows(p), op = E.rows.filter(r => r.y > E.B), npavg = op.reduce((a, r) => a + r.np, 0) / op.length;
  return {rows: E.rows, F: E.F, WC: E.WC, B: E.B, L: E.L, N: E.N, npavg, roroi: npavg / (E.F + E.WC), pbp: E.F / (npavg + E.F / op.length), full: E.rows[Math.min(E.N, E.B + 3)]};
}
if (typeof module !== 'undefined') module.exports = {isDesignFeed, feedModel, feedOf, FQ_DES, POLY, PKEYS, plant, evaluate, optimise, limitsFor, BASE_R, emethanol, cashflow, econParams, indicators, P_BASE, econDetail, econRows, fciOf, CEPCI0, FCI_PER_CBM};
