// ===== Monte Carlo of the NPV (Section 8.3.8, Table 8.30) =====
const MC_DIST = [['p_meoh', 300, 393, 520], ['p_h2', 2000, 2473, 2800], ['fci_mult', 0.85, 1.0, 1.25], ['p_mpw', 50, 80, 120],
 ['elec_mult', 0.95, 1.0, 1.25], ['p_ng', 2.20, 2.50, 3.20], ['op_factor', 0.90, 1.0, 1.01]];
function pct(a, q) { const h = (a.length - 1) * q / 100, i = Math.floor(h); return a[i] + (a[Math.min(a.length - 1, i + 1)] - a[i]) * (h - i); }
function tri(u, a, c, b) { const F = (c - a) / (b - a); return u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); }
function mcDecode() { if (mcDecode.v) return mcDecode.v; const b = atob(MC2026), u = new Uint16Array(b.length / 2); for (let i = 0; i < u.length; i++) u[i] = b.charCodeAt(2 * i) | (b.charCodeAt(2 * i + 1) << 8); return (mcDecode.v = u); }
function monteCarlo(n, base, seed) {
  const fixed = seed === 2026 && typeof MC2026 !== 'undefined'; const U = fixed ? mcDecode() : null;
  let s = seed || 20261; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const r0 = BASE_R, out = [];
  for (let k = 0; k < n; k++) { const mk = Object.assign({}, base || {}); MC_DIST.forEach(([key, a, c, b], j) => mk[key] = fixed ? a + U[7 * k + j] / 65535 * (b - a) : tri(rnd(), a, c, b));
    const p = econParams(r0, mk); const cf = cashflow(p); out.push(npvAt(cf, p.i) / 1e6); }
  out.sort((a, b) => a - b); const mean = out.reduce((a, b) => a + b, 0) / n;
  return {v: out, mean, p0: out.filter(x => x > 0).length / n, p5: out[Math.floor(0.05 * n)], p10: pct(out, 10), p50m: pct(out, 50), p90: pct(out, 90), p50: out[Math.floor(0.5 * n)], p95: out[Math.floor(0.95 * n)], sd: Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / n)};
}
if (typeof module !== 'undefined') module.exports = {monteCarlo, MC_DIST};
