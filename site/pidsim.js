// ===== TC-310 loop (Section 6.3.7): valve, E-104 and transmitter, PID with filtered derivative =====
const LOOP = {kp: 9.195, tp: 0.475, kv: 1.3125, tv: 0.10, km: 0.16, tm: 0.25, kd: 1.0};
function simLoop(o) {
  o = Object.assign({Kc: 1.07, ti: 0.675, td: 0.112, mode: 'PID', sp: 0, dist: 10, tEnd: 6, dt: 0.0005, N: 20, tStep: 0.2}, o || {});
  const L = LOOP; let xv = 0, T = 0, ym = 0, I = 0, Df = 0, ePrev = 0; const out = []; let iae = 0, maxdev = 0, last = 0;
  const useI = o.mode !== 'P', useD = o.mode === 'PID';
  const n = Math.round(o.tEnd / o.dt), every = Math.max(1, Math.round(0.01 / o.dt));
  for (let k = 0; k <= n; k++) {
    const t = k * o.dt, on = t >= o.tStep; const sp = on ? o.sp : 0, d = on ? o.dist : 0;
    const e = L.km * sp - ym;
    if (useI) I += e * o.dt / o.ti;
    if (useD) { const a = o.td / o.N; Df = (a * Df + o.td * (e - ePrev)) / (a + o.dt); } ePrev = e;
    const u = o.Kc * (e + (useI ? I : 0) + (useD ? Df : 0));
    xv += o.dt * (-xv + L.kv * u) / L.tv; T += o.dt * (-T + L.kp * xv + L.kd * d) / L.tp; ym += o.dt * (-ym + L.km * T) / L.tm;
    const dev = T - sp; iae += Math.abs(dev) * o.dt; maxdev = Math.max(maxdev, Math.abs(dev)); if (Math.abs(dev) > 0.1) last = t;
    if (k % every === 0) out.push([t, T, u]);
  }
  return {pts: out, iae, maxdev, settle: last - o.tStep, final: T};
}
function routh(K) { const a3 = 0.011875, a2 = 0.19125, a1 = 0.825, a0 = 1 + 1.931 * K; return {Kcu: (a2 * a1 / a3 - 1) / 1.931, wu: Math.sqrt(a1 / a3), stable: a2 * a1 > a3 * a0}; }
if (typeof module !== 'undefined') module.exports = {simLoop, routh, LOOP};
