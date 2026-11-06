// ===== Control loops of the plant: models and a general simulator (Section 6.3) =====
// Chain: controller -> valve kv/(τv s + 1) -> process -> transmitter km/(τm s + 1).
// Process 'fo': y' = (kp·xv + kd·d − y)/τp ;  process 'int': y' = kp·xv + kd·d (integrating).
const F101_A = Math.PI / 4 * 3.5 * 3.5;                       // m², F-101 (D = 3.50 m, Table C.21)
const LOOP_V = [['F-101 vapour space (67.3 m³ − 8.7 m³ liquid)', 58.6], ['R-103 heads (2:1 ellipsoidal, D = 3.51 m)', 11.3], ['R-103 tubes: gas in the catalyst bed and the empty length', 9.1],
  ['E-105 shell side (4 shells)', 8.9], ['E-104 tube side (1,025 tubes)', 1.8], ['Piping of the loop (assumed)', 15.0]];
const LOOP_VOL = LOOP_V.reduce((a, r) => a + r[1], 0);       // ≈ 104.7 m³
const G_P = 0.08314 * 313.15 / LOOP_VOL;                      // bar per kmol (ideal gas at 40 °C)
const LOOPS = {
 'TC-310': {tag: 'TC-310', title: 'R-103 inlet temperature', unit: 'E-104', src: 'report', ref: 'Section 6.3.7, Tables 6.13–6.16', type: 'Feedback · PID',
  desc: 'TT-310 measures the synthesis feed leaving E-104 (Stream 20) and TC-310 sets the 40-bar steam through TV-310 (base case).',
  kind: 'fo', kp: 9.195, tp: 0.475, kv: 1.3125, tv: 0.10, km: 0.16, tm: 0.25, kd: 1.0, y0: 200, yU: '°C', yN: 'Reactor inlet temperature T20', uN: 'Signal to TV-310',
  blocks: ['Controller TC-310', 'Valve TV-310', '1.3125 / (0.10s + 1)', 'E-104 (steam heater)', '9.195 / (0.475s + 1)', 'Transmitter TT-310', '0.16 / (0.25s + 1)', 'Disturbance T19: 1.000 / (0.475s + 1)', 'T20', 'SP 200 °C'],
  tests: {load: {n: 'Disturbance in T19', u: '°C', def: 10, min: -20, max: 20, st: 1, f: v => v}, sp: {n: 'Set-point change', u: '°C', def: 10, min: -20, max: 20, st: 1, f: v => v}},
  band: 0.1, tEnd: 8, dt: 0.0005, modes: ['P', 'PI', 'PID'], def: {mode: 'PID', meth: 'CC'}, kc: [0.1, 7, 0.01], ti: [0.1, 2, 0.005], td: [0, 0.4, 0.002],
  meth: {'ZN-U': {n: 'Z–N (ultimate gain)', PI: [2.89, 0.628], PID: [3.74, 0.377, 0.094]}, 'ZN-RC': {n: 'Z–N (reaction curve)', PI: [0.63, 1.165], PID: [0.84, 0.700, 0.175]},
   'CC': {n: 'Cohen–Coon', PI: [0.68, 0.475], PID: [1.07, 0.675, 0.112], sel: 1}, 'ITAE': {n: 'ITAE (load)', PI: [0.60, 0.573], PID: [0.94, 0.450, 0.134]}, 'DS': {n: 'Direct synthesis (τc = θ)', PI: [0.35, 0.475], PID: [0.35, 0.475, 0.175]}},
  refName: 'Cohen–Coon PID (selected in the report)', refSet: {mode: 'PID', Kc: 1.07, ti: 0.675, td: 0.112}},
 'LC-318': {tag: 'LC-318', title: 'F-101 liquid level', unit: 'F-101', src: 'report', ref: 'Section 6.3.8, Eqs. (6.20)–(6.21), Table 6.17', type: 'Feedback · P-only (averaging)',
  desc: 'LT-318 measures the level of the 3.50 m flash drum and LC-318 moves the let-down valve V-101 on the crude methanol to T-101 (Stream 26). The drum is an integrating process.',
  kind: 'int', kp: -1 / F101_A, kd: 1 / F101_A, kv: 1.8125e-3 * 60, tv: 0.10, km: 16 / 1.80, tm: 0, y0: 0.90, yU: 'm', yN: 'F-101 liquid level', uN: 'Signal to V-101 (LV-318)',
  blocks: ['Controller LC-318', 'Valve V-101', '0.10875 (m³/min)/mA', 'F-101 (liquid hold-up)', '−1 / (9.621 s)', 'Transmitter LT-318', '8.889 mA/m', 'Liquid inflow (Stream 26 from E-105)', 'Level', 'SP 0.90 m'],
  tests: {load: {n: '+ Liquid inflow', u: '%', def: 10, min: -30, max: 30, st: 1, f: v => v / 100 * 0.0145 * 60}, sp: {n: 'Set-point change', u: 'm', def: 0.10, min: -0.4, max: 0.4, st: 0.01, f: v => v}},
  band: 0.005, tEnd: 50, dt: 0.005, modes: ['P', 'PI'], def: {mode: 'P', meth: 'P2'}, kc: [0.2, 8, 0.05], ti: [2, 60, 0.5], td: [0, 0, 1],
  meth: {'P1': {n: 'P, Kc = 1', P: [1]}, 'P2': {n: 'P, Kc = 2', P: [2], sel: 1}, 'P4': {n: 'P, Kc = 4', P: [4]}, 'SIMC': {n: 'PI, averaging (SIMC, τc = 5 min)', PI: [1.95, 20.4]}},
  refName: 'P-only, Kc = 2 (selected in the report)', refSet: {mode: 'P', Kc: 2, ti: 20, td: 0}},
 'PC-319': {tag: 'PC-319', title: 'Synthesis-loop pressure', unit: 'D-103', src: 'est', ref: 'Table 6.24; model estimated for the twin', type: 'Feedback · PI (integrating gas hold-up)',
  desc: 'PT-319 measures the loop pressure at the F-101 vapour outlet (Stream 23) and PC-319 moves the purge valve on Stream 25. The gas hold-up of the loop makes the pressure an integrating process.',
  kind: 'int', kp: -G_P, kd: G_P, kv: 2 * 1436.31 / 60 / 16, tv: 0.10, km: 16 / 60, tm: 0.05, y0: 47, yU: 'bar', yN: 'Synthesis-loop pressure', uN: 'Signal to the purge valve',
  blocks: ['Controller PC-319', 'Purge valve (Stream 25)', '2.992 (kmol/min)/mA', 'Loop gas hold-up', `−${G_P.toFixed(4)} / s bar/kmol`, 'Transmitter PT-319', '0.267 / (0.05s + 1)', 'Fresh gas (Stream 18) from C-101', 'P', 'SP 47 bar'],
  tests: {load: {n: '+ Fresh gas (Stream 18)', u: '%', def: 5, min: -15, max: 15, st: 1, f: v => v / 100 * 5067.44 / 60}, sp: {n: 'Set-point change', u: 'bar', def: 1, min: -3, max: 3, st: 0.1, f: v => v}},
  band: 0.02, tEnd: 12, dt: 0.0005, modes: ['P', 'PI'], def: {mode: 'PI', meth: 'SIMC1'}, kc: [0.5, 60, 0.1], ti: [0.2, 10, 0.05], td: [0, 0, 1],
  meth: {'SIMC1': {n: 'SIMC (τc = θ)', PI: [16.8, 1.2], sel: 1}, 'SIMC3': {n: 'SIMC, smooth (τc = 3θ)', PI: [8.4, 2.4]}, 'P': {n: 'P only, Kc = 10', P: [10]}},
  refName: 'SIMC PI (τc = θ)', refSet: {mode: 'PI', Kc: 16.8, ti: 1.2, td: 0}},
 'FC-106': {tag: 'FY/FC-106', title: 'Gasifying steam ratio', unit: 'R-101', src: 'est', ref: 'Section 6.3.4, Figure 6.9; model estimated for the twin', type: 'Ratio · PI (flow)',
  desc: 'WT-101 measures the MPW feed, FY-106 multiplies it by 1.33 kg/kg and sends the set point of FC-106, which moves the steam valve on Stream 7. A step in the feed is a set-point change for FC-106.',
  kind: 'fo', kp: 1, tp: 0.01, kv: 2 * 50400 / 16, tv: 0.10, km: 16 / 100800, tm: 0.02, kd: 1, y0: 50400, yU: 'kg/h', yN: 'Gasifying steam, Stream 7', uN: 'Signal to FV-106',
  blocks: ['Controller FC-106', 'Valve FV-106', '6,300 (kg/h)/mA', 'Steam line', '1 / (0.01s + 1)', 'Transmitter FT-106', '1.587×10⁻⁴ / (0.02s + 1)', 'Steam-header upset', 'Stream 7', 'SP 1.33×MPW'],
  tests: {sp: {n: 'MPW feed step (FY-106)', u: '%', def: 10, min: -20, max: 20, st: 1, f: v => 1.33 * 37879 * v / 100}, load: {n: 'Steam-header upset', u: '%', def: -10, min: -20, max: 20, st: 1, f: v => v / 100 * 50400}},
  band: 0.002 * 50400, tEnd: 2, dt: 0.0002, modes: ['P', 'PI'], def: {mode: 'PI', meth: 'SIMC1', test: 'sp'}, kc: [0.05, 5, 0.01], ti: [0.02, 1, 0.005], td: [0, 0, 1],
  meth: {'SIMC1': {n: 'SIMC (τc = θ)', PI: [1.67, 0.1], sel: 1}, 'SIMC5': {n: 'SIMC, smooth (τc = 0.1 min)', PI: [0.77, 0.1]}, 'TYP': {n: 'Typical flow PI (0.5, 0.1 min)', PI: [0.5, 0.1]}},
  refName: 'SIMC PI (τc = θ)', refSet: {mode: 'PI', Kc: 1.67, ti: 0.1, td: 0}, ratio: 1}};
function loopK(L) { return L.kv * Math.abs(L.kp) * L.km; }
function simGen(L, o) {
  o = Object.assign({Kc: 1, ti: 1, td: 0, mode: 'PI', sp: 0, dist: 0, N: 10}, o); const act = Math.sign(L.kp);
  let xv = 0, y = 0, ym = 0, I = 0, Df = 0, ePrev = 0, iae = 0, maxdev = 0, last = 0; const out = [];
  const useI = o.mode !== 'P', useD = o.mode === 'PID', dt = L.dt, n = Math.round(L.tEnd / dt), every = Math.max(1, Math.round(L.tEnd / 800 / dt)), tS = L.tEnd * 0.025;
  for (let k = 0; k <= n; k++) {
    const t = k * dt, on = t >= tS, sp = on ? o.sp : 0, d = on ? o.dist : 0;
    const e = act * (L.km * sp - ym);
    if (useI) I += e * dt / o.ti;
    if (useD) { const a = o.td / o.N; Df = (a * Df + o.td * (e - ePrev)) / (a + dt); } ePrev = e;
    const u = o.Kc * (e + (useI ? I : 0) + (useD ? Df : 0));
    xv += dt * (L.kv * u - xv) / L.tv;
    if (L.kind === 'fo') y += dt * (L.kp * xv + L.kd * d - y) / L.tp; else y += dt * (L.kp * xv + L.kd * d);
    ym = L.tm > 0 ? ym + dt * (L.km * y - ym) / L.tm : L.km * y;
    const dev = y - sp; iae += Math.abs(dev) * dt; maxdev = Math.max(maxdev, Math.abs(dev)); if (Math.abs(dev - (o.mode === 'P' ? 0 : 0)) > L.band) last = t;
    if (k % every === 0) out.push([t, y, u, sp]);
  }
  // settling: last time outside the band around the final value
  const fin = y; let ls = 0; out.forEach(p => { if (Math.abs(p[1] - fin) > L.band) ls = p[0]; });
  return {pts: out, iae, maxdev, settle: ls - tS, final: y, tS};
}
// ultimate gain under P control from the characteristic polynomial (∞ when the loop is of second order)
function loopKcu(L) {
  const a = L.tv, b = L.kind === 'fo' ? L.tp : 0, c = L.tm, K = loopK(L) * (L.kind === 'fo' ? 1 : 1);
  // D(s) = (a s + 1)(b s + 1 or s)(c s + 1)
  let p; if (L.kind === 'fo') p = [a * b * c, a * b + a * c + b * c, a + b + c, 1]; else p = [a * c, a + c, 1, 0];
  if (p[0] <= 0) return {Kcu: Infinity, wu: null};
  const Kcu = (p[1] * p[2] / p[0] - p[3]) / K; return {Kcu, wu: Math.sqrt(p[2] / p[0])};
}
if (typeof module !== 'undefined') module.exports = {LOOPS, simGen, loopKcu, loopK, LOOP_VOL, LOOP_V, G_P};
