// ===== Pinch analysis (Chapter 4, problem table algorithm) =====
const HI_STREAMS = [
 {id: 'H1', n: 'Syngas to R-102 (13)', ts: 941.87, tt: 270, q: 46633.10},
 {id: 'H2', n: 'C-101 suction gas, cooling (11+17)', ts: 639.4, tt: 66.26, q: 36903.74},
 {id: 'H3', n: 'R-103 effluent, gas (21)', ts: 200, tt: 129.19, q: 13825.10},
 {id: 'H4', n: 'R-103 effluent, condensing (21)', ts: 129.19, tt: 40, q: 33409.70},
 {id: 'H5', n: 'T-101 overhead (29)', ts: 64.28, tt: 63.28, q: 18843.00},
 {id: 'H6', n: 'Suction gas, condensing', ts: 66.26, tt: 40, q: 17859.09},
 {id: 'H7', n: 'Suction gas, chilled', ts: 40, tt: 24.18, q: 4052.93},
 {id: 'C1', n: 'Gasifier water, preheat (3)', ts: 25, tt: 100, q: 8585.30},
 {id: 'C2', n: 'Gasifier water, boiling (3)', ts: 100, tt: 101, q: 61793.60},
 {id: 'C3', n: 'Steam superheat (3)', ts: 101, tt: 600, q: 27362.61},
 {id: 'C4', n: 'T-101 reboiler (28)', ts: 99.22, tt: 100.22, q: 19977.00},
 {id: 'C5', n: 'Synthesis feed (19)', ts: 72.19, tt: 200, q: 23818.78}];
// heat-capacity flow rates from the duties of Table 4.1 (CP = Q / ΔT, unrounded, as in the report's problem table)
HI_STREAMS.forEach(s => { if (s.q && !s.cp) s.cp = s.q / Math.abs(s.ts - s.tt); });
function pinchAnalysis(dT, streams) {
  streams = streams || HI_STREAMS; const h = dT / 2;
  const sh = streams.map(s => { const hot = s.ts > s.tt; return Object.assign({}, s, {hot, a: hot ? s.ts - h : s.ts + h, b: hot ? s.tt - h : s.tt + h}); });
  const T = [...new Set(sh.flatMap(s => [s.a, s.b]).map(v => +v.toFixed(6)))].sort((x, y) => y - x);
  const iv = []; let r = 0; const casc = [{T: T[0], r: 0}];
  for (let k = 0; k < T.length - 1; k++) {
    const hi = T[k], lo = T[k + 1]; let cpn = 0;
    sh.forEach(s => { const top = Math.max(s.a, s.b), bot = Math.min(s.a, s.b); if (top >= hi - 1e-9 && bot <= lo + 1e-9) cpn += s.hot ? s.cp : -s.cp; });
    const q = cpn * (hi - lo); r += q; iv.push({hi, lo, cpn, q}); casc.push({T: lo, r});
  }
  const QH = Math.max(0, -Math.min(...casc.map(c => c.r))); casc.forEach(c => c.R = c.r + QH);
  const QC = casc[casc.length - 1].R; let ip = 0; casc.forEach((c, k) => { if (c.R < casc[ip].R - 1e-6) ip = k; });
  const Tp = casc[ip].T;
  // cooling water can take heat down to a shifted temperature of 30 °C + dT/2; below that chilled water is needed
  const Tcw = 30 + h; let Rcw = 0; for (let k = 0; k < casc.length - 1; k++) { const a = casc[k], b = casc[k + 1]; if (a.T >= Tcw && b.T <= Tcw) { Rcw = a.R + (b.R - a.R) * (a.T - Tcw) / (a.T - b.T); break; } }
  const CHW = Math.max(0, QC - Rcw), CW = QC - CHW;
  const comp = hot => { const ss = streams.filter(s => (s.ts > s.tt) === hot); const P = [...new Set(ss.flatMap(s => [s.ts, s.tt]))].sort((a, b) => a - b);
    const pts = [{T: P[0], H: 0}]; let H = 0; for (let k = 0; k < P.length - 1; k++) { let cp = 0; ss.forEach(s => { const lo = Math.min(s.ts, s.tt), hi = Math.max(s.ts, s.tt); if (lo <= P[k] + 1e-9 && hi >= P[k + 1] - 1e-9) cp += s.cp; }); H += cp * (P[k + 1] - P[k]); pts.push({T: P[k + 1], H}); } return pts; };
  const hot = comp(true), cold = comp(false).map(p => ({T: p.T, H: p.H + QC}));
  const totH = hot[hot.length - 1].H, totC = cold[cold.length - 1].H - QC;
  return {dT, QH, QC, CW, CHW, Tp, Thot: Tp + h, Tcold: Tp - h, casc, iv, hot, cold, recovered: totC - QH, totH, totC};
}
// area target (Bath formula, vertical heat transfer on the balanced composite curves)
function areaTarget(P, hProc, hu) {
  hProc = hProc || 0.2; hu = hu || {fired: 0.111, cw: 3.75, chw: 0.2};
  const streams = HI_STREAMS.map(s => Object.assign({}, s, {hk: hProc}));
  if (P.QH > 0) streams.push({id: 'HU', ts: 1000, tt: 200, cp: P.QH / 800, hk: hu.fired});
  if (P.CW > 0) streams.push({id: 'CW', ts: 30, tt: 40, cp: P.CW / 10, hk: hu.cw});
  if (P.CHW > 0) streams.push({id: 'CHW', ts: 7, tt: 12, cp: P.CHW / 5, hk: hu.chw});
  const segs = hot => { const ss = streams.filter(s => (s.ts > s.tt) === hot); const Tset = [...new Set(ss.flatMap(s => [s.ts, s.tt]))].sort((a, b) => a - b);
    const out = []; let H = 0; for (let k = 0; k < Tset.length - 1; k++) { const lo = Tset[k], hi = Tset[k + 1]; const act = ss.filter(s => Math.min(s.ts, s.tt) <= lo + 1e-9 && Math.max(s.ts, s.tt) >= hi - 1e-9);
      const cp = act.reduce((a, s) => a + s.cp, 0), q = cp * (hi - lo); const rh = act.reduce((a, s) => a + s.cp * (hi - lo) / s.hk, 0); out.push({lo, hi, H0: H, H1: H + q, cp, rh}); H += q; } return out; };
  const hs = segs(true), cs = segs(false); const Hb = [...new Set(hs.flatMap(s => [s.H0, s.H1]).concat(cs.flatMap(s => [s.H0, s.H1])).map(v => +v.toFixed(4)))].sort((a, b) => a - b);
  const Tat = (sg, H) => { for (const s of sg) if (H >= s.H0 - 1e-3 && H <= s.H1 + 1e-3) return s.cp > 0 ? s.lo + Math.min(s.H1 - s.H0, Math.max(0, H - s.H0)) / s.cp : s.lo; return H < sg[0].H0 ? sg[0].lo : sg[sg.length - 1].hi; };
  const rAt = (sg, H0, H1) => { let a = 0; sg.forEach(s => { const o = Math.min(H1, s.H1) - Math.max(H0, s.H0); if (o > 1e-9) a += s.rh * o / (s.H1 - s.H0); }); return a; };
  let A = 0;
  for (let k = 0; k < Hb.length - 1; k++) { const H0 = Hb[k], H1 = Hb[k + 1]; if (H1 - H0 < 1e-6) continue;
    const d0 = Tat(hs, H0 + 1e-7) - Tat(cs, H0 + 1e-7), d1 = Tat(hs, H1 - 1e-7) - Tat(cs, H1 - 1e-7);
    const lm = Math.abs(d0 - d1) < 1e-6 ? d0 : (d0 - d1) / Math.log(d0 / d1); A += (rAt(hs, H0, H1) + rAt(cs, H0, H1)) / lm; }
  return A;
}
if (typeof module !== 'undefined') module.exports = {pinchAnalysis, areaTarget, HI_STREAMS};
