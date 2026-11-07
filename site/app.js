// ===================================================================== helpers
const $ = id => document.getElementById(id), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (v, d = 0) => (v === null || v === undefined || !isFinite(v)) ? '—' : (v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -d) ? '−' : '') + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
const money = (v, d = 2) => (v < 0 ? '−$' : '$') + fmt(Math.abs(v), d);
const clone = o => JSON.parse(JSON.stringify(o));
const cssv = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const tip = $('tip');
function showTip(html, e) { tip.innerHTML = html; tip.style.opacity = 1; const x = e.clientX + 16, y = e.clientY + 14; tip.style.left = Math.min(x, innerWidth - tip.offsetWidth - 10) + 'px'; tip.style.top = Math.min(y, innerHeight - tip.offsetHeight - 10) + 'px'; }
function hideTip() { tip.style.opacity = 0; }
let toastT; function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function fillRange(el) { const p = (el.value - el.min) / (el.max - el.min) * 100; el.style.setProperty('--p', p + '%'); }
document.addEventListener('input', e => { if (e.target.type === 'range') fillRange(e.target); });
// ===================================================================== state
const DEF = {X: [0.40, 0.10, 0.90, 1.0], MODE: 'design', margin: 2, MK: {}, SCID: 'base', HI: true, dT: 10, cpm: 550,
  loop: 'TC-310', FK: '1', ft: 598, em: {f: 100, c: 1.04, tech: 'today'},
  pfdHI: false, pfdFlow: true, sec: 'all', scf: 'all', iSeg: 'all', iq: '', stq: '', pidSel: 'base', ecTab: 'price',
  EC: {lease: 0, buy: 0, build: 2, life: 20, dep: 'macrs5', cepci: 840.9, escp: 0, escc: 0, wc: 10, sal: 5, eq: {'R-101 (×5)': 0, 'C-101': 0, 'C-102': 0, 'ME-101': 0, '*': 0}}};
DEF.pids = initPids();
let ST = clone(DEF), PAGE = 'overview', AIRES = {}, MC = null, MCKEY = '';
// economic inputs of the economics page, turned into model parameters (defaults reproduce Chapter 8)
const PLOT_M2 = 126000, SAR = 3.75;
const EQX = [['R-101 (×5)', 'Gasifiers R-101 (×5)'], ['C-101', 'Syngas compressor C-101'], ['C-102', 'Hydrogen compressor C-102'], ['ME-101', 'Hydrogen membrane ME-101'], ['*', 'All other equipment']];
const cbmOf = k => k === '*' ? CBM.filter(c => !EQX.some(e => e[0] === c[0])).reduce((a, c) => a + c[2], 0) : CBM.find(c => c[0] === k)[2];
function ecMK() { const c = ST.EC; let add = 0; EQX.forEach(([k]) => { add += cbmOf(k) * (c.eq[k] || 0) / 100; });
  return {land: c.lease * PLOT_M2 / SAR, land_buy: c.buy * PLOT_M2 / SAR, build: c.build, life: c.life, dep: c.dep, cepci: c.cepci, esc_p: c.escp / 100, esc_c: c.escc / 100, wc: c.wc / 100, salvage: c.sal / 100, cbm_add: add}; }
const MKX = () => Object.assign(ecMK(), ST.MK, {hi: ST.HI});
const SCMK = mk => Object.assign(ecMK(), mk, {hi: ST.HI});   // a scenario of the market page with the economic inputs of the economics page
const lims = () => ST.MODE === 'safe' ? limitsFor('safe', ST.margin / 100) : limitsFor('max', 0);
let E, E0, DES = evaluate([0.40, 0.10, 0.90, 1], {});
function compute() { const L = lims(); E = evaluate(ST.X, MKX(), L); E0 = evaluate([0.40, 0.10, 0.90, 1], MKX(), L); }
const UNITNAME = {S15: 'R-102', S18: 'C-101', S20: 'R-103', S23: 'F-101', S26: 'T-101', H2p: 'C-102', feed: 'R-101', 'ME-101 area': 'ME-101'};
// ===================================================================== charts
function plot(id, c) {
  const svg = $(id); if (!svg) return; const vb = svg.viewBox.baseVal; const W = vb.width, H = vb.height; const m = Object.assign({l: 56, r: 14, t: 12, b: 40}, c.m || {});
  const [x0, x1] = c.x, [y0, y1] = c.y; const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = c.logy ? v => m.t + (Math.log10(y1) - Math.log10(Math.max(v, y0))) / (Math.log10(y1) - Math.log10(y0)) * (H - m.t - m.b) : v => m.t + (y1 - v) / (y1 - y0) * (H - m.t - m.b);
  const dec = (a, b, st) => { const t = ticks(a, b, st); const d = t.length > 1 ? Math.abs(t[1] - t[0]) : 1; return d >= 1 ? 0 : d >= 0.1 ? 1 : 2; };
  const xd = dec(x0, x1, c.xt), yd = c.logy ? 0 : dec(y0, y1, c.yt); const xf = c.xf || (v => fmt(v, xd)), yf = c.yf || (v => fmt(v, yd)); let g = '';
  const yt = c.logy ? (() => { const a = []; for (let e = Math.ceil(Math.log10(y0)); e <= Math.log10(y1) + 1e-9; e++) a.push(Math.pow(10, e)); return a; })() : ticks(y0, y1, c.yt);
  yt.forEach(v => g += `<line class="gl" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${m.l - 7}" y="${Y(v) + 4}" text-anchor="end">${yf(v)}</text>`);
  ticks(x0, x1, c.xt).forEach(v => g += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}" style="opacity:.55"/><text class="ax" x="${X(v)}" y="${H - m.b + 17}" text-anchor="middle">${xf(v)}</text>`);
  if (y0 < 0 && y1 > 0 && !c.logy) g += `<line class="zl" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  if (c.xl) g += `<text class="ax" x="${(W + m.l - m.r) / 2}" y="${H - 4}" text-anchor="middle">${c.xl}</text>`;
  if (c.yl) g += `<text class="ax" transform="translate(13,${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${c.yl}</text>`;
  (c.bands || []).forEach(b => g += `<rect x="${X(b.x0 ?? x0)}" width="${X(b.x1 ?? x1) - X(b.x0 ?? x0)}" y="${Y(b.y1 ?? y1)}" height="${Y(b.y0 ?? y0) - Y(b.y1 ?? y1)}" fill="${b.c}"/>`);
  (c.polys || []).forEach(p => g += `<polygon points="${p.d.map(q => X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1)).join(' ')}" fill="${p.c}" stroke="none"/>`);
  (c.bars || []).forEach(b => { const ya = Y(Math.max(b.y, 0)), yb = Y(Math.min(b.y, 0)); g += `<rect class="hb" data-t="${b.t || ''}" x="${X(b.x) - b.w / 2}" y="${ya}" width="${b.w}" height="${Math.max(0.5, yb - ya)}" fill="${b.c}" rx="2"/>`; });
  (c.hl || []).forEach(h => g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(h.y)}" y2="${Y(h.y)}" stroke="${h.c}" stroke-width="${h.w || 2}" ${h.dash ? `stroke-dasharray="${h.dash}"` : ''}/>`);
  (c.vl || []).forEach(h => g += `<line x1="${X(h.x)}" x2="${X(h.x)}" y1="${m.t}" y2="${H - m.b}" stroke="${h.c}" stroke-width="${h.w || 2}" ${h.dash ? `stroke-dasharray="${h.dash}"` : ''}/>`);
  (c.series || []).forEach(s => { if (!s.d.length) return; const d = s.d.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
    g += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round" ${s.anim ? 'class="anim"' : ''}/>`; });
  (c.pts || []).forEach(p => g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r || 6}" fill="${p.c}" stroke="var(--panel)" stroke-width="2.2"/>`);
  (c.texts || []).forEach(t => g += `<text x="${t.px ?? X(t.x)}" y="${t.py ?? Y(t.y)}" text-anchor="${t.a || 'middle'}" style="font-size:${t.fs || 13}px;fill:${t.c || 'var(--ink2)'};font-weight:${t.b ? 700 : 400}">${t.t}</text>`);
  g += `<line class="guide" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--muted)" stroke-dasharray="3 3" style="opacity:0"/>`;
  svg.innerHTML = g; svg._c = {c, X, Y, m, W, H};
  if (!svg._h) { svg._h = 1;
    svg.addEventListener('mousemove', e => { const o = svg._c; if (!o || !o.c.tip) return; const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * o.W;
      if (px < o.m.l || px > o.W - o.m.r) { hideTip(); svg.querySelector('.guide').style.opacity = 0; return; }
      const xv = o.c.x[0] + (px - o.m.l) / (o.W - o.m.l - o.m.r) * (o.c.x[1] - o.c.x[0]); const gl = svg.querySelector('.guide'); gl.setAttribute('x1', px); gl.setAttribute('x2', px); gl.style.opacity = 1;
      showTip(o.c.tip(xv), e); });
    svg.addEventListener('mouseleave', () => { hideTip(); const gl = svg.querySelector('.guide'); if (gl) gl.style.opacity = 0; }); }
  return {X, Y};
}
function ticks(a, b, st) { if (Array.isArray(st)) return st; if (!st) { const r = b - a, p = Math.pow(10, Math.floor(Math.log10(r / 5))); st = [1, 2, 2.5, 5, 10].map(k => k * p).find(s => r / s <= 7) || p * 10; }
  const o = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) o.push(+v.toFixed(10)); return o; }
const interp = (d, x) => { if (!d.length) return null; if (x <= d[0][0]) return d[0][1]; for (let k = 1; k < d.length; k++) if (x <= d[k][0]) { const a = d[k - 1], b = d[k]; return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return d[d.length - 1][1]; };
function donut(id, parts, center) {
  const svg = $(id), W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 18, r = R * 0.6;
  const tot = parts.reduce((a, p) => a + Math.max(0, p[1]), 0); let a0 = -Math.PI / 2, g = '';
  parts.forEach(([n, v, c]) => { const a1 = a0 + Math.max(0, v) / tot * 2 * Math.PI, big = a1 - a0 > Math.PI ? 1 : 0; const P = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    const [x1, y1] = P(a0, R), [x2, y2] = P(a1, R), [x3, y3] = P(a1, r), [x4, y4] = P(a0, r);
    g += `<path class="seg" data-t="${n}: ${fmt(v / 1e6, 2)} M$ (${fmt(v / tot * 100, 1)} %)" d="M${x1},${y1} A${R},${R} 0 ${big} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${big} 0 ${x4},${y4} Z" fill="${c}" stroke="var(--panel)" stroke-width="2"/>`; a0 = a1; });
  g += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" style="font-size:26px;font-weight:700;fill:var(--ink)">${center[0]}</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" style="font-size:13.5px;fill:var(--muted)">${center[1]}</text>`;
  svg.innerHTML = g; bindTips(svg, '.seg');
}
function bindTips(root, sel) { $$(sel, root).forEach(el => { el.addEventListener('mousemove', e => showTip(el.dataset.t, e)); el.addEventListener('mouseleave', hideTip); }); }
// ===================================================================== router
const PAGES = ['overview', 'process', 'operations', 'heat', 'control', 'economics', 'market', 'safety', 'emethanol', 'validation'];
const TITLES = {overview: 'Overview', process: 'Process flow diagram', operations: 'Operations and AI set points', heat: 'Heat integration', control: 'Process control', economics: 'Economics', market: 'Market and scenarios', safety: 'Process monitoring', emethanol: 'e-Methanol extension', validation: 'Validation'};
let FIRST_SHOWN = false;
function show(p) {
  if (!PAGES.includes(p)) p = 'overview'; PAGE = p;
  let done = false;
  const doit = () => { if (done || PAGE !== p) return; done = true; $$('.page').forEach(s => s.classList.toggle('on', s.dataset.page === p)); $$('nav.main a').forEach(a => a.classList.toggle('on', a.dataset.go === p));
    window.scrollTo(0, 0); render(); requestAnimationFrame(reveal); setTimeout(reveal, 60); document.title = TITLES[p] + ' – MPW Gasification Complex';
    const cur = $('cur'); if (cur) cur.innerHTML = `<i>${String(PAGES.indexOf(p) + 1).padStart(2, '0')}</i><span>${TITLES[p]}</span>`; };
  // animated page change when the browser supports it; the first page and any delayed transition are shown directly
  if (document.startViewTransition && FIRST_SHOWN && !matchMedia('(prefers-reduced-motion: reduce)').matches) { try { document.startViewTransition(doit); } catch (e) { doit(); } setTimeout(doit, 400); } else doit();
  FIRST_SHOWN = true;
  $('nav').classList.remove('open');
}
function go(p) { if (location.hash !== '#/' + p) location.hash = '#/' + p; else show(p); }
window.addEventListener('hashchange', () => show(location.hash.replace('#/', '')));
document.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t) { e.preventDefault(); go(t.dataset.go); } const r = e.target.closest('[data-reset]'); if (r) resetPage(r.dataset.reset); });
$('menu').addEventListener('click', () => $('nav').classList.toggle('open'));
window.addEventListener('scroll', () => { const h = document.documentElement; $('prog').style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + '%'; }, {passive: true});
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); if (e.target._count) e.target._count(); } }), {threshold: 0, rootMargin: '0px 0px -6% 0px'});
function reveal() { $$('.page.on .reveal:not(.in), .page.on .plot:not(.in)').forEach(el => io.observe(el)); }
// safety net: anything already inside the window is shown even if the observer has not reported yet
function revealVisible() { const H = innerHeight; $$('.page.on .reveal:not(.in), .page.on .plot:not(.in)').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > 0 && r.top < H) { el.classList.add('in'); io.unobserve(el); if (el._count) el._count(); } }); }
setInterval(revealVisible, 900);
// theme
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('mpw-theme', t); } catch (e) {} if (PAGE) render(); }
$('theme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
try { const t = localStorage.getItem('mpw-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
// ===================================================================== reset
function resetPage(p, quiet) {
  const D = clone(DEF);
  if (p === 'operations' || p === 'all') { ST.X = D.X; ST.MODE = 'design'; ST.margin = 2; }
  if (p === 'process' || p === 'all') { ST.pfdHI = false; ST.pfdFlow = true; ST.sec = 'all'; ST.stq = ''; closeDrawer(); }
  if (p === 'heat' || p === 'all') { ST.HI = true; ST.dT = 10; ST.cpm = 550; }
  if (p === 'control' || p === 'all') { ST.loop = 'TC-310'; ST.pids = initPids(); ST.iSeg = 'all'; ST.iq = ''; ST.pidSel = 'base'; pidZoom = null; }
  if (p === 'economics' || p === 'all') { MC = null; ST.EC = D.EC; ST.MK = {}; ST.SCID = 'base'; AIRES = {}; HICACHE = {}; }
  if (p === 'market' || p === 'all') { ST.MK = {}; ST.SCID = 'base'; ST.scf = 'all'; AIRES = {}; }
  if (p === 'safety' || p === 'all') { ST.FK = '1'; ST.ft = 598; stopPlay(); }
  if (p === 'emethanol' || p === 'all') { ST.em = D.em; }
  syncInputs(); render(); if (!quiet) toast(p === 'all' ? 'Every page has returned to the design point.' : 'This page has returned to its starting point.');
}
$('resetAll').addEventListener('click', () => { resetPage('all'); window.scrollTo({top: 0, behavior: 'smooth'}); });
function syncInputs() {
  const set = (id, v) => { const el = $(id); if (el) { el.value = v; fillRange(el); } };
  set('beta', ST.X[0]); set('phi', ST.X[1]); set('rho', ST.X[2]); set('feed', ST.X[3] * 100); set('margin', ST.margin);
  $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === ST.MODE));
  $('pfdHI').checked = ST.pfdHI; $('pfdFlow').checked = ST.pfdFlow; $$('#secSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === ST.sec)); $('stq').value = ST.stq;
  $('hiOn').checked = ST.HI; set('dtmin', ST.dT); set('cpm', ST.cpm);
  $$('#lpick .lp').forEach(b => b.classList.toggle('on', b.dataset.l === ST.loop)); syncLoopInputs();
  $$('#iSeg button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.iSeg)); $('iq').value = ST.iq; $$('#pidSel button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.pidSel));
  MS.forEach(([id, k, dflt, , inv]) => set(id, inv(k in ST.MK ? ST.MK[k] : dflt))); $$('#scFilt button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.scf));
  syncEcon(); set('ft', ST.ft); set('ef', ST.em.f); set('ec', ST.em.c); $$('#etech button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.em.tech));
  $$('input[type=range]').forEach(fillRange);
}
// ===================================================================== global render
function render() {
  compute(); headerChips();
  ({overview: rOverview, process: rProcess, operations: rOps, heat: rHeat, control: rControl, economics: rEcon, market: rMarket, safety: rFault, emethanol: rEM, validation: rVal})[PAGE]();
}
function scenName() { const s = SCEN.find(z => z.id === ST.SCID); return s ? (s.sh || s.name) : 'Custom scenario'; }
function headerChips() {
  const c = $('opChip'); if (!E.ok) { c.className = 'chip bad'; c.innerHTML = `<i></i>Limit exceeded: ${UNITNAME[E.limiting] || ''} at ${fmt(E.worst * 100, 1)} %`; }
  else if (E.worst > 0.98) { c.className = 'chip warn'; c.innerHTML = `<i></i>${UNITNAME[E.limiting] || ''} at ${fmt(E.worst * 100, 1)} % of its limit`; } else { c.className = 'chip'; c.innerHTML = '<i></i>All units within design limits'; }
  ['mkChip', 'mkChip2', 'ecChip'].forEach(id => { const el = $(id); if (el) el.innerHTML = `<i style="background:var(--c-lb);box-shadow:none"></i>Market: ${scenName()}${ST.HI ? '' : ' · without heat integration'}`; });
  $('hiChip').className = 'chip' + (ST.HI ? '' : ' bad'); $('hiChip').innerHTML = `<i></i>Heat integration ${ST.HI ? 'ON' : 'OFF'} · ΔTmin = ${fmt(ST.dT, 1)} °C`;
}
// ===================================================================== OVERVIEW
const HERO = [[478.4, 1, ' M$', 'fixed capital'], [105.04, 2, ' M$', 'NPV at 10 %'], [12.8, 2, ' %', 'DCFROR'], [81.7, 1, ' %', 'less hot utility', '−']];
function countUp(el, v, d, pre, suf) { const t0 = performance.now(), dur = 1500; const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + fmt(v * e, d) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
// stream number in the PFD diamond style
const sdia = (n, c) => `<span class="sdia"><svg viewBox="0 0 30 30"><path d="M15 1 29 15 15 29 1 15z" fill="var(--sheet)" stroke="${c}" stroke-width="2"/><text x="15" y="19.5" text-anchor="middle" style="font:700 12px var(--f);fill:var(--ink)">${n}</text></svg></span>`;
// callout balloons on the plant drawing: tag, x and y as fractions of the drawing, leader length
const BALLOONS = [['R-101', .344, .5313, 40], ['CY-101', .3072, .5359, 74], ['E-101', .3572, .7667, 30], ['E-102', .4077, .7063, 46], ['D-101', .2405, .7817, 30], ['E-103', .522, .4975, 30], ['R-102', .5332, .3894, 34],
  ['D-102', .6075, .4482, 30], ['ME-101', .6231, .6272, 34], ['C-102', .6432, .6879, 22], ['C-101', .7583, .6017, 30], ['E-104', .7202, .4347, 30], ['R-103', .7385, .2635, 30], ['E-105', .8203, .5069, 30], ['F-101', .8802, .4495, 30], ['T-101', .7886, .094, 24]];
const UNIT_ART = {'E-101': 'steam', 'E-102': 'steam', 'D-101': 'steam', 'R-101': 'r101', 'CY-101': 'r101', 'D-102': 'r101', 'M-101': 'shift', 'E-103': 'shift', 'R-102': 'shift', 'ME-101': 'me101', 'C-102': 'me101',
  'SC-1': 'c101', 'SC-2': 'c101', 'KO': 'c101', 'C-101': 'c101', 'M-102': 'r103', 'E-104': 'r103', 'R-103': 'r103', 'E-105': 'r103', 'F-101': 'r103', 'D-103': 'r103', 'V-101': 't101', 'T-101': 't101', 'REB': 't101'};
const ART = {steam: [1600, 1184], r101: [1500, 1370], shift: [1700, 1196], me101: [1700, 1204], c101: [1700, 1147], r103: [1300, 1941], t101: [1300, 1848]};
const SEC_OF = {'CR-101': 'feed', 'E-101': 'feed', 'E-102': 'feed', 'D-101': 'feed', 'R-101': 'gas', 'CY-101': 'gas', 'D-102': 'gas', 'M-101': 'wgs', 'E-103': 'wgs', 'R-102': 'wgs', 'ME-101': 'wgs', 'C-102': 'wgs', 'C-101': 'syn', 'E-104': 'syn', 'R-103': 'syn', 'E-105': 'syn', 'F-101': 'syn', 'T-101': 'pur'};
function buildOverview() {
  $('heroStats').innerHTML = HERO.map(([v, d, s, l, p]) => `<div class="stat"><b data-v="${v}" data-d="${d}" data-s="${s}" data-p="${p || ''}">${p || ''}${fmt(v, d)}${s}</b><span>${l}</span></div>`).join('');
  const st = $('heroStats'); st._count = () => $$('b', st).forEach(b => countUp(b, +b.dataset.v, +b.dataset.d, b.dataset.p, b.dataset.s)); st.classList.add('reveal');
  // the plant drawing and its balloons
  $('balloons').innerHTML = BALLOONS.map(([t, x, y, l]) => `<button class="bln" data-u="${t}" style="left:${x * 100}%;top:${y * 100}%;--l:${l}px" aria-label="${t} – ${UNITS[t] ? UNITS[t].n : ''}"><span>${t}</span></button>`).join('');
  $$('#balloons .bln').forEach(b => { const u = UNITS[b.dataset.u];
    b.addEventListener('mousemove', e => showTip(`<b>${b.dataset.u}</b> ${u ? u.n : ''}<br>${u ? u.s : ''}`, e)); b.addEventListener('mouseleave', hideTip);
    b.addEventListener('click', () => { hideTip(); ST.sec = SEC_OF[b.dataset.u] || 'all'; syncInputs(); go('process'); setTimeout(() => openUnit(b.dataset.u), 450); }); });
  // the five sections down the process spine
  const CH = [['feed', 'var(--sec-feed)', '1', 'Feed preparation and steam', 'Two shredders reduce the mixed plastic waste; the process water is boiled in E-101 and superheated to 600 °C in E-102 before it fluidises the gasifiers.', ['steam'],
     [['MPW feed', '37,879 kg/h'], ['Steam to the gasifiers', '50,400 kg/h'], ['Steam temperature', '600 °C']], [[2, 'shredded MPW'], [7, 'gasifying steam']]],
   ['gas', 'var(--sec-gas)', '2', 'Gasification', 'Five allothermal fluidised-bed trains gasify the plastic with steam on olivine at 1,200 °C; fifteen Stairmand cyclones return the char to the combustors that heat the beds.', ['r101'],
     [['Gasifier trains', '5'], ['Bed temperature', '1,200 °C'], ['Carbon conversion', '97.16 %'], ['Raw syngas', '7,852 kmol/h']], [[10, 'clean syngas']]],
   ['wgs', 'var(--sec-wgs)', '3', 'Shift and hydrogen', 'A six-bed shift reactor converts the CO at 270 °C; the Pd–Ag membrane bank lets only hydrogen through, and C-102 sends it out at 30 bar.', ['shift', 'me101'],
     [['Shift temperature', '270 °C'], ['CO conversion', '90 %'], ['Membrane area', '6,040 m²'], ['Hydrogen purity', '99.99 %']], [[16, 'hydrogen product'], [17, 'retentate to C-101']]],
   ['syn', 'var(--sec-syn)', '4', 'Methanol synthesis', 'Five-stage compression to 50 bar, a feed–effluent exchanger and a 3,447-tube boiling-water reactor; the flash drum recycles the gas and purges the inerts.', ['c101', 'r103'],
     [['C-101 power', '22.5 MW'], ['Loop pressure', '50 bar'], ['Reactor tubes', '3,447'], ['Steam raised in R-103', '24.6 MW']], [[26, 'crude methanol']]],
   ['pur', 'var(--sec-pur)', '5', 'Purification', 'V-101 lets the crude methanol down to 1 bar and the 52-tray column T-101 separates 99.5 mol% methanol from the water at a reflux ratio of 0.8231.', ['t101'],
     [['Trays', '52'], ['Column height', '33.6 m'], ['Methanol purity', '99.5 mol%'], ['Reflux ratio', '0.8231']], [[29, 'methanol product']]]];
  $('chain').innerHTML = CH.map(([k, c, n, h, p, art, dl, out]) => `<li class="reveal" style="--sc:${c}" data-sec="${k}" tabindex="0" role="link" aria-label="Open ${h} on the flowsheet">
    <div class="no">${n}</div>
    <div class="tx"><h3>${h}</h3><p>${p}</p><dl>${dl.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl><span class="open">Open on the flowsheet</span></div>
    <div class="art" style="${art.length > 1 ? 'display:grid;grid-template-columns:1fr 1fr;gap:10px' : ''}">${art.map(a => `<div class="plot"><img src="art/${a}.webp" width="${ART[a][0]}" height="${ART[a][1]}" alt="Line drawing of ${h.toLowerCase()} equipment" loading="lazy" decoding="async"></div>`).join('')}</div>
    <div class="link">${out.map(([sn, t]) => `<span class="lk">${sdia(sn, c)}<span>Stream ${sn}, ${t}</span></span>`).join('')}</div></li>`).join('');
  $$('#chain li').forEach(s => { const open = () => { ST.sec = s.dataset.sec; syncInputs(); go('process'); }; s.addEventListener('click', open); s.addEventListener('keydown', e => { if (e.key === 'Enter') open(); }); });
  // the drawing register: every sheet of the twin
  const F = [['02', 'process', 'Process flow diagram', 'Every unit with its symbol, live flows and a data sheet; the stream table follows the set point.', 'Figures 3.79, 4.18'],
   ['03', 'operations', 'Operations and AI set points', 'Differential evolution finds the most profitable, the safest or the largest operation inside the equipment limits.', 'Section 10.2'],
   ['04', 'heat', 'Heat integration', 'Composite curves, the ΔTmin trade-off and the effect of the network on energy, cost and control.', 'Chapter 4'],
   ['05', 'control', 'Process control', 'Tune four loops with five methods, follow the response and browse 34 loops and both P&IDs.', 'Chapter 6'],
   ['06', 'economics', 'Economics', 'Every price, equipment cost, land, time and finance input can be changed; cash flow, tornado and a 4,000-trial Monte Carlo follow.', 'Chapter 8'],
   ['07', 'market', 'Market and scenarios', 'Prices of 2025–2026 and fourteen scenarios, from the base case to the 2026 Gulf and Red Sea crisis.', 'Table 8.27'],
   ['08', 'safety', 'Process monitoring', 'PCA monitoring of eight signals with T², Q and a k-NN diagnosis of five faults.', 'Section 10.4'],
   ['09', 'emethanol', 'Solar e-methanol', 'The purge carbon becomes extra methanol with electrolytic hydrogen and Saudi solar power.', 'Section 10.5'],
   ['10', 'validation', 'Validation', 'Every model of the twin checked against the values of the report.', 'All chapters']];
  $('feats').innerHTML = F.map(([n, p, h, t, src]) => `<a class="reveal" data-go="${p}"><span class="n">${n}</span><h4>${h}</h4><p>${t}</p><span class="src">${src}</span></a>`).join('');
  // equipment and project schedule
  const EQ = [['R-101', 'Gasifiers, carbon conversion', '97.16 %'], ['R-101', 'Raw syngas', '7,852 kmol/h'], ['R-102', 'Shift, CO conversion', '90 %'], ['ME-101', 'Membrane area', '6,040 m²'], ['C-101', 'Compressor power', '22.5 MW'], ['R-103', 'Methanol reactor', '3,447 tubes'], ['T-101', 'Methanol column', '52 trays, 33.6 m']];
  const PJ = [['HEN', 'Heat recovered', '115.6 MW'], ['ISA', 'Control loops', '34'], ['Site', 'Site score, Jubail', '860 / 1,000'], ['DCFROR', 'Discounted cash-flow rate of return', '12.80 %'], ['Payback', 'Discounted payback', '13.06 years']];
  const tab = (h, rows) => `<div class="card"><h3><span class="h">${h}</span></h3><div class="tbl" style="border:0"><table class="sched"><thead><tr><th>Tag</th><th>Item</th><th>Value</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('glance').innerHTML = tab('Equipment schedule', EQ) + tab('Project figures', PJ);
  heroCanvas();
}
function rOverview() {
  const K = [['Methanol', fmt(E.p.meoh_kgh * 7.92, 0) + ' t/y', 'var(--s-meoh)'], ['Hydrogen', fmt(E.p.h2_kgh * 7.92, 0) + ' t/y', 'var(--s-h2)'], ['NPV (10 %)', money(E.npv) + ' M', 'var(--hot)'],
   ['Market', scenName(), 'var(--pen)'], ['Heat integration', ST.HI ? 'ON <small style="font-size:13px;font-weight:500;color:var(--graphite);display:block;margin-top:2px">ΔTmin = ' + fmt(ST.dT, 0) + ' °C</small>' : 'OFF', ST.HI ? 'var(--ok)' : 'var(--bad)'], ['Equipment', E.ok ? 'Within limits' : 'Limit exceeded', E.ok ? 'var(--ok)' : 'var(--bad)']];
  $('snap').innerHTML = K.map(([l, v, c]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:26px">${v}</div></div>`).join('');
}
// ===================================================================== hero: the mass balance as a moving picture
// Coloured plastic shards drift around the feed term; a steady share is drawn into the gasifier at 1,200 °C, glows and breaks up,
// and leaves as ordered molecules: hydrogen (H₂) towards the hydrogen term and methanol (CH₃OH) towards the methanol term.
// Molar ratio of the products: 61,831 t/y ÷ 2.016 = 30,670 and 266,915 t/y ÷ 32.04 = 8,331 (thousand kmol/y), so about 3.7 hydrogen molecules per methanol.
let heroAnim = null;
function heroCanvas() {
  const cv = $('heroCanvas'), ctx = cv.getContext('2d'), hero = $('hero'); let dpr = Math.min(1.75, devicePixelRatio || 1), w = 0, h = 0, vis = true, Z = null;
  const still = matchMedia('(prefers-reduced-motion: reduce)'), mouse = {x: -1e4, y: -1e4};
  const PLASTIC = ['#7fb7e3', '#f4f3ee', '#e9cf5a', '#e8679f', '#e2553b', '#4f97d6', '#2c2f33', '#4fa56b', '#f29c38', '#9ad1c9'];
  const R = (a, b) => a + Math.random() * (b - a);
  let S = [], M = [], heat = [];
  const zone = () => { const hr = hero.getBoundingClientRect(), q = e => { e = e.getBoundingClientRect(); return {x: (e.left - hr.left) * dpr, y: (e.top - hr.top) * dpr, w: e.width * dpr, h: e.height * dpr}; }, r = id => q($(id));
    const I = r('tIn'), m = r('tM'), H = r('tH'), RR = r('tR'), F = r('heroFoot'), TP = r('heroTop'), narrow = matchMedia('(max-width:980px)').matches;
    const rx = narrow ? RR.x + RR.w - 52 * dpr : RR.x + RR.w / 2, ry = RR.y + (narrow ? 58 : 26) * dpr;
    const box = narrow ? {x0: 0, x1: rx - 64 * dpr, y0: I.y + I.h + 14 * dpr, y1: RR.y + RR.h + 4 * dpr} : {x0: 0, x1: rx - 70 * dpr, y0: TP.y + TP.h + 14 * dpr, y1: F.y - 16 * dpr};
    const end = el => { const b = q(el.querySelector('.row')); return {x: b.x, y: b.y, w: b.w, h: b.h}; };
    return {I, m: narrow ? end($('tM')) : m, H: narrow ? end($('tH')) : H, rx, ry, narrow, box}; };
  const inText = (z, x, y) => { const I = z.I; return x > I.x - 8 && x < I.x + I.w + 8 && y > I.y - 4 && y < I.y + I.h + 6 && Math.random() > .15; };
  const shard = (z, anywhere) => { const n = 4 + (Math.random() * 3 | 0), s = R(5, 14) * dpr, pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + R(-.35, .35), rr = s * R(.55, 1); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    let cx, cy, g = 0; do { cx = R(z.box.x0, z.box.x1); cy = R(z.box.y0, z.box.y1); } while (inText(z, cx, cy) && ++g < 12);
    return {x: anywhere ? cx : z.box.x0 - 30 * dpr, y: cy, vx: anywhere ? R(-.3, .3) * dpr : R(1.5, 3) * dpr, vy: R(-.3, .3) * dpr, a: R(0, 6.28), va: R(-.012, .012), pts, c: PLASTIC[Math.random() * PLASTIC.length | 0], hx: cx, hy: cy, st: 0, t: 0}; };
  const size = () => { const r = cv.getBoundingClientRect(); if (!r.width) return; dpr = Math.min(1.75, devicePixelRatio || 1); w = cv.width = Math.round(r.width * dpr); h = cv.height = Math.round(r.height * dpr); Z = zone();
    const n = Math.round(Math.min(300, Math.max(110, r.width * r.height / 4600))); S = Array.from({length: n}, () => shard(Z, true)); M = []; heat = []; };
  size(); addEventListener('resize', () => { clearTimeout(size.t); size.t = setTimeout(size, 150); }); if (document.fonts) document.fonts.ready.then(size);
  // the hero may first be shown after another sheet: size the canvas as soon as it has a size of its own
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(size.t); size.t = setTimeout(size, 60); }).observe(cv);
  hero.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * dpr; mouse.y = (e.clientY - r.top) * dpr; });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(cv);
  const ink = () => cssv('--ink'), dark = () => document.documentElement.dataset.theme === 'dark';
  let feedT = 0, tick0 = performance.now();
  const draw = (t) => {
    const dt = Math.min(50, t - tick0) / 16.7; tick0 = t; const z = Z; if (!z) return; ctx.clearRect(0, 0, w, h); const INK = ink(), dk = dark();
    // gasifier glow
    const gr = ctx.createRadialGradient(z.rx, z.ry, 0, z.rx, z.ry, 70 * dpr); gr.addColorStop(0, dk ? 'rgba(255,140,60,.55)' : 'rgba(224,74,27,.42)'); gr.addColorStop(1, 'rgba(224,74,27,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(z.rx, z.ry, 70 * dpr, 0, 6.283); ctx.fill();
    // feed: one shard enters the gasifier every few frames
    feedT += dt; if (!still.matches && feedT > 5) { feedT = 0; const c = S.filter(s => s.st === 0); if (c.length > 40) { const s = c.reduce((a, b) => (b.x > a.x ? b : a)); s.st = 1; s.t = 0; s.x0 = s.x; s.y0 = s.y; } }
    for (const s of S) {
      if (s.st === 0) { // drift around a home position, stirred by the pointer
        s.vx += (s.hx - s.x) * 0.0006 * dt + R(-.02, .02) * dpr; s.vy += (s.hy - s.y) * 0.0006 * dt + R(-.02, .02) * dpr;
        const dx = s.x - mouse.x, dy = s.y - mouse.y, d2 = dx * dx + dy * dy, rr = 110 * dpr; if (d2 < rr * rr) { const f = (1 - Math.sqrt(d2) / rr) * 0.9 * dpr; const d = Math.sqrt(d2) || 1; s.vx += dx / d * f; s.vy += dy / d * f; s.va += R(-.01, .01); }
        s.vx *= 0.96; s.vy *= 0.96; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt;
      } else { // pulled into the gasifier along a curve
        s.t += 0.012 * dt; const k = s.t * s.t * (3 - 2 * s.t), mx = (s.x0 + z.rx) / 2, my = Math.min(s.y0, z.ry) - 60 * dpr;
        s.x = (1 - k) * (1 - k) * s.x0 + 2 * (1 - k) * k * mx + k * k * z.rx; s.y = (1 - k) * (1 - k) * s.y0 + 2 * (1 - k) * k * my + k * k * z.ry; s.a += 0.08 * dt;
        if (s.t >= 1) { // gasified: a flash of heat, then the products leave
          for (let q = 0; q < 5; q++) heat.push({x: z.rx + R(-8, 8) * dpr, y: z.ry + R(-8, 8) * dpr, vx: R(-1.2, 1.2) * dpr, vy: R(-1.2, 1.2) * dpr, life: 1});
          const nH = Math.random() < 0.7 ? 1 : 0; // ≈ 3.7 H₂ per CH₃OH over time
          if (Math.random() < 0.23) M.push({k: 'm', t: 0, sp: R(.0045, .0065)}); if (nH || Math.random() < .5) M.push({k: 'h', t: 0, sp: R(.005, .0075)});
          Object.assign(s, shard(z, false), {st: 0}); }
      }
      const sx = s.st ? 1 - s.t * .5 : 1; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.scale(sx, sx); ctx.beginPath(); s.pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.fillStyle = s.st && s.t > .6 ? '#ff8a4c' : s.c; ctx.globalAlpha = s.c === '#f4f3ee' && dk ? .85 : .92; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 0.8 * dpr; ctx.strokeStyle = dk ? 'rgba(234,241,248,.55)' : 'rgba(21,25,28,.55)'; ctx.stroke(); ctx.restore();
    }
    for (let i = heat.length - 1; i >= 0; i--) { const p = heat[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.03 * dt; if (p.life <= 0) { heat.splice(i, 1); continue; } ctx.fillStyle = `rgba(255,${120 + 100 * p.life | 0},40,${p.life})`; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * dpr, 0, 6.283); ctx.fill(); }
    // products: ordered lanes from the gasifier to the two terms
    for (let i = M.length - 1; i >= 0; i--) { const m = M[i]; m.t += m.sp * dt; if (m.t >= 1) { M.splice(i, 1); continue; }
      const T = m.k === 'm' ? z.m : z.H, tx = z.narrow ? T.x + T.w + 14 * dpr : T.x - 14 * dpr, ty = T.y + T.h * (z.narrow ? .5 : .34) + (m.o || (m.o = R(-14, 14) * dpr)), k = m.t;
      const x = z.rx + (tx - z.rx) * (z.narrow ? 1 - (1 - k) * (1 - k) : k), y = z.ry + (ty - z.ry) * (z.narrow ? k * k : Math.min(1, k * 1.5 - k * k * .5)), al = m.t > .78 ? (1 - m.t) / .22 : Math.min(1, m.t * 8);
      ctx.globalAlpha = al; ctx.lineWidth = 1.4 * dpr; ctx.strokeStyle = INK;
      if (m.k === 'h') { const c = dk ? '#93b6ff' : '#2b44c9'; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x - 3.2 * dpr, y, 3.4 * dpr, 0, 6.283); ctx.arc(x + 3.2 * dpr, y, 3.4 * dpr, 0, 6.283); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x - 6 * dpr, y); ctx.lineTo(x + 6 * dpr, y); ctx.stroke(); ctx.fillStyle = dk ? '#dfe7ef' : '#3a4247'; ctx.beginPath(); ctx.arc(x - 6 * dpr, y, 4.6 * dpr, 0, 6.283); ctx.fill(); ctx.fillStyle = '#d9a400'; ctx.beginPath(); ctx.arc(x + 6 * dpr, y, 4 * dpr, 0, 6.283); ctx.fill();
        ctx.fillStyle = dk ? '#eaf1f8' : '#f6f7f4'; ctx.beginPath(); ctx.arc(x + 9.5 * dpr, y - 2.5 * dpr, 2 * dpr, 0, 6.283); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1; }
  };
  const tick = t => { heroAnim = requestAnimationFrame(tick); if (PAGE !== 'overview' || !vis || document.hidden) return; if (!w) { size(); if (!w) return; } if (still.matches) { if (!tick.once) { tick.once = 1; draw(t); } return; } draw(t); };
  requestAnimationFrame(tick);
}
// ===================================================================== PROCESS
const SECBOX = {feed: [14, 16, 470, 420], gas: [490, 16, 960, 420], wgs: [980, 16, 1786, 420], syn: [14, 462, 1340, 978], pur: [1360, 462, 1786, 978]};
function modelFlow(n, r) {
  const b = DES.r, f = r.feed, sc = v => v * f; const s = STREAMS[n]; const base = s ? s[2] : null;
  const m = {3: r.water, 6: r.S6, 7: 2797.67 * f, 11: r.S11, 12: r.S12, 13: r.S12 + r.S6, 14: r.S12 + r.S6, 15: r.S15, 16: r.H2p, 17: r.S17, 18: r.S18, 19: r.S20, 20: r.S20,
    21: r.S23 + r.S26, 22: r.S23 + r.S26, 23: r.S23, 24: r.S24, 25: r.purge, 26: r.S26, 27: r.S26, 29: r.MeOH, 31: r.S24, 28: base * r.S26 / b.S26, 4: r.water, 5: r.water};
  if (m[n] !== undefined) return m[n]; if ([8, 9, 10, 30].includes(+n)) return sc(base); return base;
}
// total stream flow, anchored to the stream table of Chapter 3 at the design point (stream 29 = 1,053.88 kmol/h distillate, of which 1,049.12 kmol/h methanol)
const FLOW_ANCHOR = {};
function liveFlow(n, r) {
  const v = modelFlow(n, r), s = STREAMS[n]; if (v === null || v === undefined || !s) return v;
  if (FLOW_ANCHOR[n] === undefined) { const d = modelFlow(n, DES.r); FLOW_ANCHOR[n] = d ? s[2] / d : 1; }
  return v * FLOW_ANCHOR[n];
}
function buildPFD() {
  const svg = $('pfd'); svg.innerHTML = PFD.build() + '<g id="dimG"></g>';
  $$('#pfd .dg').forEach(g => { g.addEventListener('mousemove', e => { const n = +g.dataset.st, s = STREAMS[n], fl = liveFlow(n, E.r);
    showTip(`<b>Stream ${n}</b> – ${SNAME[n] || ''}<br>${s ? `T = ${fmt(s[0], 2)} °C · P = ${fmt(s[1], 3)} bar<br>` : HI_STREAM_T[n] ? `T = ${fmt(HI_STREAM_T[n], 2)} °C<br>` : ''}${fl !== null && n > 2 ? `Flow = ${fmt(fl, 2)} kmol/h` : n <= 2 ? `MPW = ${fmt(37879 * E.r.feed, 0)} kg/h` : ''}`, e); }); g.addEventListener('mouseleave', hideTip); });
  $$('#pfd .u').forEach(u => u.addEventListener('click', () => openUnit(u.dataset.u)));
}
function rProcess() {
  const svg = $('pfd'); svg.classList.toggle('hi', ST.pfdHI); svg.classList.toggle('noflow', !ST.pfdFlow);
  $('dimG').innerHTML = ST.sec === 'all' ? '' : Object.entries(SECBOX).filter(([k]) => k !== ST.sec).map(([k, [x0, y0, x1, y1]]) => `<rect x="${x0 - 6}" y="${y0 - 6}" width="${x1 - x0 + 12}" height="${y1 - y0 + 12}" fill="var(--panel)" opacity=".72" rx="12"/>`).join('');
  $$('#pfd [data-fl]').forEach(p => { const n = +p.dataset.fl, fl = liveFlow(n, E.r), b = liveFlow(n, DES.r); if (fl && b) p.style.animationDuration = Math.min(4, Math.max(0.4, 1.2 * b / fl)) + 's'; });
  secPanel();
  $('pfdChip').innerHTML = `<i></i>β = ${ST.X[0].toFixed(3)} · φ = ${ST.X[1].toFixed(3)} · ρ = ${ST.X[2].toFixed(3)} · feed ${fmt(ST.X[3] * 100, 1)} %`;
  const K = [['MPW feed', fmt(37879 * E.r.feed, 0) + ' kg/h', 'var(--sec-feed)'], ['Steam to R-101', fmt(50400 * E.r.feed, 0) + ' kg/h', 'var(--sec-gas)'], ['Hydrogen (16)', fmt(liveFlow(16, E.r), 2) + ' kmol/h', 'var(--green)'],
   ['Methanol in (29)', fmt(E.r.MeOH, 2) + ' kmol/h', 'var(--navy)'], ['Purge (25)', fmt(liveFlow(25, E.r), 2) + ' kmol/h', 'var(--orange)'], ['Recycle (24)', fmt(liveFlow(24, E.r), 2) + ' kmol/h', 'var(--blue)']];
  $('pfdK').innerHTML = K.map(([l, v, c]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:22px">${v}</div></div>`).join('');
  const q = ST.stq.toLowerCase(); const ids = Object.keys(SNAME).map(Number).filter(n => n <= 31 || ST.pfdHI);
  $('sttab').innerHTML = '<thead><tr><th>Stream</th><th>Description</th><th>T (°C)</th><th>P (bar)</th><th>Design (kmol/h)</th><th>Live (kmol/h)</th></tr></thead><tbody>' + ids.filter(n => !q || (n + ' ' + SNAME[n]).toLowerCase().includes(q)).map(n => { const s = STREAMS[n];
    const fl = n > 31 ? null : liveFlow(n, E.r); const ch = s && fl && Math.abs(fl / s[2] - 1) > 0.0005;
    return `<tr><td><b>${n}</b>${n > 31 ? ' <span class="tag hi">HI</span>' : ''}</td><td>${SNAME[n]}</td><td>${s ? fmt(s[0], 2) : fmt(HI_STREAM_T[n], 2)}</td><td>${s ? fmt(s[1], 3) : '—'}</td><td>${s && n > 2 ? fmt(s[2], 2) : n <= 2 ? '37,879 kg/h' : '—'}</td><td class="${ch ? 'okc' : ''}">${n <= 2 ? fmt(37879 * E.r.feed, 0) + ' kg/h' : fl ? fmt(fl, 2) : '—'}</td></tr>`; }).join('') + '</tbody>';
}
const SECINFO = {all: ['Whole plant', 'Select a section above to highlight it, or select a unit for its data sheet.', ['R-101', 'R-102', 'ME-101', 'C-101', 'R-103', 'T-101']],
 feed: ['Feed preparation', 'Two shredders reduce the MPW; the process water is preheated, boiled in E-101 and superheated to 600 °C in E-102. D-101 splits the steam between the gasifier and the shift.', ['CR-101', 'E-101', 'E-102', 'D-101']],
 gas: ['Gasification and gas cleaning', 'Five allothermal fluidised-bed trains gasify the plastic with steam at 1,200 °C; 15 Stairmand cyclones remove the char, and D-102 sends β of the clean syngas to the methanol loop.', ['R-101', 'CY-101', 'D-102']],
 wgs: ['Water-gas shift and hydrogen separation', 'The syngas is mixed with steam, cooled in E-103 and shifted in R-102 at 270 °C; the Pd–Ag membrane ME-101 recovers 99.99 % hydrogen at 0.04 bar, compressed to 30 bar by C-102.', ['M-101', 'E-103', 'R-102', 'ME-101', 'C-102']],
 syn: ['Methanol synthesis', 'The retentate and the bypass are cooled, compressed to 50 bar in five stages, mixed with the recycle, heated in E-104 and converted in R-103; F-101 separates the crude methanol and D-103 purges φ of the gas.', ['SC-1', 'SC-2', 'KO', 'C-101', 'M-102', 'E-104', 'R-103', 'E-105', 'F-101', 'D-103', 'C-101R']],
 pur: ['Methanol purification', 'V-101 lets the crude methanol down to 1 bar and the 52-tray column T-101 delivers 99.5 mol% methanol at a reflux ratio of 0.8231.', ['V-101', 'T-101', 'REB']]};
function secPanel() { const [t, d, us] = SECINFO[ST.sec]; $('secT').textContent = t; $('secD').textContent = d;
  $('secU').innerHTML = us.map(u => `<button class="btn sm" data-u="${u}">${u === 'KO' ? 'KO drum' : u === 'REB' ? 'Reboiler' : u}</button>`).join(''); $$('#secU button').forEach(b => b.addEventListener('click', () => openUnit(b.dataset.u))); }
function openUnit(id) {
  let u = UNITS[id]; if (!u) return; if (u.alias) { id = u.alias; u = UNITS[id]; }
  $$('#pfd .u').forEach(g => g.classList.toggle('sel', g.dataset.u === id || (UNITS[g.dataset.u] && UNITS[g.dataset.u].alias === id)));
  const r = E.r, b = DES.r; const live = {feed: ['Feed load', r.feed], S15: ['Load (Stream 15)', r.S15 / b.S15], A: ['Membrane area needed', r.A / A_INST], H2p: ['Load (Stream 16)', r.H2p / b.H2p], S18: ['Load (Stream 18)', r.S18 / b.S18],
    S24: ['Recycle load', r.S24 / b.S24], S20: ['Load (Stream 20)', r.S20 / b.S20], S23: ['Vapour load', r.S23 / b.S23], S26: ['Feed load', r.S26 / b.S26]}[u.live];
  const rows = u.d.map(([k, v]) => { if (v === 'live') { v = {beta: ['β = ' + ST.X[0].toFixed(4), fmt(r.S12, 0) + ' kmol/h', fmt(r.S11, 0) + ' kmol/h'], phi: ['φ = ' + ST.X[1].toFixed(4)]}[u.live]; v = Array.isArray(v) ? v[u.d.filter(x => x[1] === 'live').findIndex(x => x[0] === k)] : v; }
    if (typeof v === 'string' && v.startsWith('live')) v = 'ρ = ' + ST.X[2].toFixed(4) + v.slice(4); return `<dt>${k}</dt><dd>${v}</dd>`; }).join('');
  $('dbody').innerHTML = `<div class="sec" style="color:${u.c}">${u.s}</div><h3>${id}</h3><p style="margin:0 0 6px;color:var(--muted)">${u.n}</p>
    ${live ? `<div class="bar" style="grid-template-columns:120px minmax(0,1fr) 62px"><span>${live[0]}</span><div class="track"><i class="${live[1] > 1.0001 ? 'warn' : ''}" style="width:${Math.min(100, live[1] / 1.15 * 100)}%"></i><b style="left:${100 / 1.15}%"></b></div><span>${fmt(live[1] * 100, 1)} %</span></div>` : ''}
    <dl>${rows}</dl><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm pri" data-go="operations">Change the set points</button><button class="btn sm" data-go="economics">Costs</button></div>${UNIT_ART[id] ? `<figure class="dart plot"><img src="art/${UNIT_ART[id]}.webp" width="${ART[UNIT_ART[id]][0]}" height="${ART[UNIT_ART[id]][1]}" alt="Line drawing of the ${u.s.toLowerCase()} area"><figcaption>${u.s} area, drawn from the 3D model of the plant</figcaption></figure>` : ''}`;
  $('drawer').classList.add('open'); $('drawer').setAttribute('aria-hidden', 'false'); const da = $('dbody').querySelector('.dart'); if (da) setTimeout(() => da.classList.add('in'), 260);
}
function closeDrawer() { $('drawer').classList.remove('open'); $('drawer').setAttribute('aria-hidden', 'true'); $$('#pfd .u').forEach(g => g.classList.remove('sel')); }
$('dclose').addEventListener('click', closeDrawer);
$('pfdHI').addEventListener('change', e => { ST.pfdHI = e.target.checked; rProcess(); });
$('pfdFull').addEventListener('click', () => { const c = $('pfd').closest('.card'); if (document.fullscreenElement) document.exitFullscreen(); else if (c.requestFullscreen) c.requestFullscreen().catch(() => {}); });
document.addEventListener('fullscreenchange', () => { $('pfdFull').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
$('pfdFlow').addEventListener('change', e => { ST.pfdFlow = e.target.checked; rProcess(); });
$$('#secSeg button').forEach(b => b.addEventListener('click', () => { ST.sec = b.dataset.s; $$('#secSeg button').forEach(x => x.classList.toggle('on', x === b)); rProcess(); }));
$('stq').addEventListener('input', e => { ST.stq = e.target.value; rProcess(); });
// ===================================================================== OPERATIONS
const MODETXT = {design: 'The set points of Chapter 2 (β = 0.40, φ = 0.10, ρ = 0.90) at the design feed of 37,879 kg/h.',
 safe: 'The AI keeps every unit below its design load by the selected margin and finds the most profitable point inside this safe window, reducing the feed if needed.',
 npv: 'The AI finds the set point with the highest NPV at the selected feed rate, using the design margins of the units (Section 10.2).',
 feed: 'The AI raises the MPW feed as far as the equipment allows and adjusts β, φ and ρ so that no unit exceeds its allowed limit.',
 meoh: 'The AI makes as much methanol as the equipment allows at the selected feed rate.', h2: 'The AI makes as much hydrogen as the equipment allows at the selected feed rate.'};
function dlt(v, b) { const x = (v - b) / Math.abs(b) * 100; return Math.abs(x) < 0.05 ? ['design value', ''] : [(x > 0 ? '+' : '') + fmt(x, 1) + ' % vs design', x > 0 ? 'up' : 'dn']; }
function rOps() {
  $('o-beta').value = ST.X[0].toFixed(4); $('o-phi').value = ST.X[1].toFixed(4); $('o-rho').value = ST.X[2].toFixed(4); $('o-feed').value = fmt(ST.X[3] * 100, 1) + ' %'; $('o-margin').value = fmt(ST.margin, 1) + ' %'; $('modetxt').textContent = MODETXT[ST.MODE];
  const dn = E.npv - E0.npv; const K = [['Methanol product', fmt(E.p.meoh_kgh * 7.92, 0) + ' t/y', dlt(E.r.MeOH, DES.r.MeOH), 'var(--navy)'], ['Hydrogen product', fmt(E.p.h2_kgh * 7.92, 0) + ' t/y', dlt(E.r.H2p, DES.r.H2p), 'var(--green)'],
   ['NPV at ' + fmt(E.p.i * 100, 1) + ' %', money(E.npv) + ' M', [Math.abs(dn) < 0.005 ? 'equal to the design point' : (dn > 0 ? '+' : '') + fmt(dn, 2) + ' M vs design point', dn > 0.005 ? 'up' : dn < -0.005 ? 'dn' : ''], 'var(--orange)'],
   ['DCFROR', E.irr === null ? '—' : fmt(E.irr * 100, 2) + ' %', ['payback ' + (E.dpb === null ? 'beyond the project life' : fmt(E.dpb, 2) + ' years'), ''], 'var(--blue)'],
   ['MPW carbon in methanol', fmt(E.r.MeOH / (2556.14 * E.r.feed) * 100, 1) + ' %', ['purge CO + CO₂ ' + fmt(E.r.purgeCO + E.r.purgeCO2, 0) + ' kmol/h', ''], 'var(--gold)'],
   ['Limiting unit', UNITNAME[E.limiting] || E.limiting, [fmt(E.worst * 100, 1) + ' % of its allowed limit', E.ok ? '' : 'dn'], E.ok ? 'var(--grey)' : 'var(--red)']];
  $('opK').innerHTML = K.map(([l, v, [d, c], col]) => `<div class="kpi" style="--c:${col}"><div class="l">${l}</div><div class="v">${v}</div><div class="d ${c}">${d}</div></div>`).join('');
  const L = lims(), r = E.r; const rows = [['R-101 feed (MPW)', r.feed, L.feed], ['R-102 (Stream 15)', r.S15 / DES.r.S15, L.S15], ['ME-101 area', r.A / A_INST, L.A], ['C-101 (Stream 18)', r.S18 / DES.r.S18, L.S18],
    ['R-103 (Stream 20)', r.S20 / DES.r.S20, L.S20], ['F-101 vapour (23)', r.S23 / DES.r.S23, L.S23], ['T-101 feed (26)', r.S26 / DES.r.S26, L.S26], ['C-102 (Stream 16)', r.H2p / DES.r.H2p, L.H2p]];
  const sc = v => Math.max(0, Math.min(100, (v - 0.75) / 0.37 * 100));
  $('bars').innerHTML = rows.map(([n, v, l]) => { const c = v > l * (1 + 1e-6) ? 'bad' : v > l * 0.98 ? 'warn' : ''; return `<div class="bar"><span>${n}</span><div class="track"><i class="${c}" style="width:${sc(v)}%"></i><b style="left:${sc(1)}%"></b><s style="left:${sc(l)}%"></s></div><span>${fmt(v * 100, 1)} %</span></div>`; }).join('');
  const cum = (cf, i) => { let d = 0; return cf.map((c, y) => [y, (d += c / Math.pow(1 + i, y)) / 1e6]); }; const a = cum(E.cf, E.p.i), bb = cum(E0.cf, E0.p.i);
  const ys = a.concat(bb).map(p => p[1]); plot('opCF', {x: [0, E.cf.length - 1], y: [Math.min(-500, ...ys) - 20, Math.max(200, ...ys) + 30], xt: 2, xl: 'Year from the start of construction', series: [{d: bb, c: 'var(--c-lb)', dash: '6 4'}, {d: a, c: cssv('--navy'), w: 2.8}],
    tip: x => { const y = Math.round(x); return `<b>Year ${y}</b><br>Current: ${fmt(interp(a, y), 1)} M$<br>Design point: ${fmt(interp(bb, y), 1)} M$`; }});
  const ks = [11, 12, 15, 16, 17, 18, 20, 23, 24, 25, 26, 29];
  $('opStreams').innerHTML = '<thead><tr><th>Stream</th><th>Description</th><th>Design (kmol/h)</th><th>Now (kmol/h)</th><th>Change</th></tr></thead><tbody>' + ks.map(n => { const v = liveFlow(n, E.r), b = liveFlow(n, DES.r), x = (v / b - 1) * 100;
    return `<tr><td><b>${n}</b></td><td>${SNAME[n]}</td><td>${fmt(b, 2)}</td><td>${fmt(v, 2)}</td><td class="${Math.abs(x) < 0.05 ? '' : x > 0 ? 'okc' : 'badc'}">${Math.abs(x) < 0.05 ? '—' : (x > 0 ? '+' : '') + fmt(x, 2) + ' %'}</td></tr>`; }).join('') + '</tbody>';
}
function runMode(m) {
  ST.MODE = m; $$('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  if (m === 'design') { ST.X = [0.40, 0.10, 0.90, 1.0]; syncInputs(); $('ainote').textContent = 'Design point of Chapter 2.'; render(); return; }
  $$('#modes button').forEach(b => b.disabled = true); $('ainote').innerHTML = '<span class="spin"></span> AI search running…';
  setTimeout(() => { const o = optimise(MKX(), {objective: m === 'safe' ? 'npv' : m, mode: m === 'safe' ? 'safe' : 'max', margin: ST.margin / 100, feed: m === 'safe' ? 1 : ST.X[3]});
    ST.X = o.x.slice(); syncInputs(); $$('#modes button').forEach(b => b.disabled = false); $('ainote').textContent = 'AI set point found after ' + fmt(o.n) + ' evaluations of the plant model.'; render(); toast('AI set point applied: ' + $$('#modes button').find(b => b.dataset.m === m).textContent); }, 40);
}
$$('#modes button').forEach(b => b.addEventListener('click', () => runMode(b.dataset.m)));
$('margin').addEventListener('input', () => { ST.margin = +$('margin').value; $('o-margin').value = fmt(ST.margin, 1) + ' %'; });
$('margin').addEventListener('change', () => { if (ST.MODE === 'safe') runMode('safe'); else render(); });
['beta', 'phi', 'rho', 'feed'].forEach((id, j) => $(id).addEventListener('input', () => { ST.X[j] = j === 3 ? +$(id).value / 100 : +$(id).value; ST.MODE = 'manual'; $$('#modes button').forEach(b => b.classList.remove('on')); $('ainote').textContent = 'Manual set point.'; render(); }));
$('toDesign').addEventListener('click', () => runMode('design'));
// ===================================================================== HEAT INTEGRATION
const HEATC = 2060796.77 / 25927.58, CWC = 0.45 * 28.512, CHWC = 17.037 / 5 * 28.512, CRF = 0.1 * Math.pow(1.1, 20) / (Math.pow(1.1, 20) - 1), FCIF = 478400128.68 / 298183405.96;
const P10 = pinchAnalysis(10), A10 = areaTarget(P10);
const CO2 = cost => cost / (2.5 / 1.055056) * 0.0561;
function econDT(dT, cpm) {
  const P = pinchAnalysis(dT), A = areaTarget(P);
  const mk = Object.assign(MKX(), {hi: true, qh_add: (P.QH - P10.QH) / 1000, qc_add: (P.CW - P10.CW) / 1000, w_add: (P.CHW - P10.CHW) / 5, fci_add: FCIF * cpm * (A - A10)});   // extra chilled water through the chillers (COP 5)
  return Object.assign(evaluate([0.40, 0.10, 0.90, 1], mk), {P, A});
}
let HICACHE = {};
function rHeat() {
  const dT = ST.dT, cpm = ST.cpm; $('o-dtmin').value = fmt(dT, 1) + ' °C'; $('o-cpm').value = '$' + fmt(cpm);
  const P = pinchAnalysis(dT), A = areaTarget(P); const chwH = 4052.93, cwH = P.QC - chwH;
  const K = [['Minimum hot utility', fmt(P.QH / 1000, 2) + ' MW', 'var(--orange)', `${fmt((1 - P.QH / 141540) * 100, 1)} % below 141.54 MW`], ['Minimum cold utility', fmt(P.QC / 1000, 2) + ' MW', 'var(--blue)', `CW ${fmt(cwH / 1000, 2)} · CHW ${fmt(chwH / 1000, 2)} MW`],
   ['Pinch temperatures', fmt(P.Thot, 2) + ' / ' + fmt(P.Tcold, 2) + ' °C', 'var(--gold)', 'hot / cold side'], ['Heat recovered', fmt(P.recovered / 1000, 2) + ' MW', 'var(--green)', 'between process streams'],
   ['Area target', fmt(A, 0) + ' m²', 'var(--navy)', `Aspen at 10 °C: 33,692 m²`], ['Minimum units', '14', 'var(--grey)', 'N = 12 + 3 − 1']];
  $('hiK').innerHTML = K.map(([l, v, c, d]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:24px">${v}</div><div class="d">${d}</div></div>`).join('');
  $('ccNote').textContent = 'ΔTmin = ' + fmt(dT, 1) + ' °C';
  const hot = P.hot.map(p => [p.H / 1000, p.T]), cold = P.cold.map(p => [p.H / 1000, p.T]); const Hmax = Math.max(hot[hot.length - 1][0], cold[cold.length - 1][0]);
  const lo = P.QC / 1000, hi = hot[hot.length - 1][0]; const xs = []; for (let k = 0; k <= 80; k++) xs.push(lo + (hi - lo) * k / 80);
  const poly = xs.map(x => [x, interp(hot, x)]).concat(xs.slice().reverse().map(x => [x, interp(cold, x)]));
  const pinH = (() => { let best = 1e9, bh = 0; xs.forEach(x => { const d = interp(hot, x) - interp(cold, x); if (d < best) { best = d; bh = x; } }); return bh; })();
  plot('ccChart', {x: [0, Math.ceil(Hmax / 25) * 25], y: [0, 1000], xt: 25, yt: 200, xl: 'Enthalpy (MW)', yl: 'Temperature (°C)', polys: [{d: poly, c: 'color-mix(in srgb,var(--c-gr) 24%,transparent)'}],
    series: [{d: hot, c: 'var(--c-rd)', w: 2.8}, {d: cold, c: 'var(--c-bl)', w: 2.8}], pts: [{x: pinH, y: P.Thot, c: 'var(--c-go)', r: 6}, {x: pinH, y: P.Tcold, c: 'var(--c-go)', r: 6}],
    texts: [{px: 500, py: 30, t: 'QH,min = ' + fmt(P.QH / 1000, 2) + ' MW', a: 'end', c: 'var(--c-or)', b: 1}, {px: 70, py: 300 - 52, t: 'QC,min = ' + fmt(P.QC / 1000, 2) + ' MW', a: 'start', c: 'var(--c-bl)', b: 1}],
    tip: x => `<b>${fmt(x, 1)} MW</b><br>Hot: ${fmt(interp(hot, x), 1)} °C<br>Cold: ${x >= lo ? fmt(interp(cold, x), 1) + ' °C' : '—'}`});
  const g = P.casc.map(c => [c.R / 1000, c.T]).sort((a, b) => b[1] - a[1]); const gx = g.slice().sort((a, b) => a[1] - b[1]);
  const Tcw = 40 - dT / 2; const below = gx.filter(p => p[1] <= P.Tp + 1e-6); const cwPoly = [[0, Tcw]].concat(below.filter(p => p[1] >= Tcw).map(p => [p[0], p[1]])).concat([[0, P.Tp]]);
  const chwPoly = [[0, below[0][1]]].concat(below.filter(p => p[1] <= Tcw)).concat([[interp(gx.map(p => [p[1], p[0]]).sort((a, b) => a[0] - b[0]), Tcw) || 0, Tcw], [0, Tcw]]);
  plot('gccChart', {x: [0, Math.ceil(Math.max(...g.map(p => p[0])) / 20) * 20], y: [0, 1000], xt: 20, yt: 200, xl: 'Net heat flow (MW)', yl: 'Shifted temperature (°C)',
    polys: [{d: [[0, 1000], [P.QH / 1000, 1000], [P.QH / 1000, g[0][1]], [0, g[0][1]]], c: 'color-mix(in srgb,var(--c-or) 24%,transparent)'}, {d: cwPoly, c: 'color-mix(in srgb,var(--c-bl) 24%,transparent)'}, {d: chwPoly, c: 'color-mix(in srgb,var(--c-pu) 30%,transparent)'}],
    series: [{d: gx.map(p => [p[0], p[1]]), c: cssv('--navy'), w: 2.6}], pts: [{x: 0, y: P.Tp, c: 'var(--c-go)', r: 6}], texts: [{px: 500, py: 34, t: 'Pinch at T* = ' + fmt(P.Tp, 2) + ' °C', a: 'end', c: cssv('--ink2'), b: 1}],
    tip: x => { const pts = gx.filter(p => Math.abs(p[0] - x) < 2); return `<b>${fmt(x, 1)} MW</b>` + (pts.length ? '<br>T* = ' + pts.map(p => fmt(p[1], 1)).join(', ') + ' °C' : ''); }});
  // impacts
  const eHI = econDT(dT, cpm), eNo = evaluate([0.40, 0.10, 0.90, 1], Object.assign(MKX(), {hi: false}));
  const heatCost = HEATC * P.QH, heatNo = 12200135.49, co2 = CO2(heatCost), co2No = CO2(heatNo), cwflow = cwH / 41.8;
  const IMP = [['Energy', fmt(P.QH / 1000, 2) + ' MW fired heat', [`Hot utility ${fmt((1 - P.QH / 141540) * 100, 1)} % below the base plant (141.54 MW)`, `Cold utility ${fmt(P.QC / 1000, 2)} MW instead of 171.53 MW`, `Firing of E-101 ${fmt((1 - P.QH / 70379) * 100, 0)} % lower`, `${fmt(P.recovered / 1000, 1)} MW exchanged between process streams`]],
   ['Economics', money(eHI.npv) + ' M NPV', [`Without integration: ${money(eNo.npv)} M (×${fmt(eHI.npv / eNo.npv, 1)})`, `DCFROR ${fmt(eHI.irr * 100, 2)} % against ${fmt(eNo.irr * 100, 2)} %`, `Discounted payback ${fmt(eHI.dpb, 2)} against ${eNo.dpb === null ? '—' : fmt(eNo.dpb, 2)} years`, `Fired-heat cost ${money(heatCost / 1e6)} M/y against $12.20 M/y`]],
   ['Environment', fmt((co2No - co2) / 1000, 0) + ' kt/y less CO₂', [`CO₂ from the fired heat: ${fmt(co2 / 1000, 1)} kt/y instead of ${fmt(co2No / 1000, 1)} kt/y`, `Cooling water ${fmt(cwflow, 0)} kg/s instead of 2,891 kg/s (10 °C rise)`, `${fmt((1 - cwflow / 2891) * 100, 1)} % less cooling water pumped`, 'Natural gas at 56.1 kg CO₂/GJ']],
   ['Equipment', '2 new exchangers', ['E-106 (H2 – C2, 15.36 MW) and E-107 (H3 – C2, 1.33 MW)', 'Nine existing units re-piped (E-101 to E-105, reboiler, SC-1 …)', `Area target ${fmt(A, 0)} m² at ΔTmin = ${fmt(dT, 1)} °C`, `FCI ${money(eHI.p ? (FCI + (eHI.p.fci_add || 0)) / 1e6 : 478.4, 2)} M (base plant $477.23 M)`]],
   ['Control', '5 new bypass loops', ['TC-114: effluent bypass of the E-101 preheater', 'TC-105 and TC-202: syngas bypasses of E-102 and E-103', 'TC-310: suction-gas bypass of E-104; TC-406: reboiler bypass', 'Disturbances now pass from one stream to the stream it heats']],
   ['Operation', 'Once-through steam train', ['FC-103 fixes the steam production (4 → 32 → 33 → 34 → 5)', 'Start-up heaters and the LP-steam connection are kept as spare', 'E-104 no longer needs the 40-bar steam of E-103', 'Steam export falls from 22.81 MW to zero']]];
  $('impact').innerHTML = IMP.map(([k, big, li]) => `<div class="imp"><div class="k">${k}</div><div class="big">${big}</div><ul>${li.map(l => `<li>${l}</li>`).join('')}</ul></div>`).join('');
  $('hiBox').innerHTML = ST.HI ? `The heat-integrated design is selected. Its NPV is <b>${money(eNo.npv === undefined ? 0 : evaluate([0.4, 0.1, 0.9, 1], Object.assign(MKX(), {hi: true})).npv)} M</b> in the selected market.` : `The base flowsheet without heat integration is selected: NPV <b>${money(eNo.npv)} M</b>. All other pages now use this plant.`;
  // ΔTmin trade-off
  const key = ST.cpm + '|' + JSON.stringify(MKX()); if (HICACHE.key !== key) { const rows = []; for (let d = 5; d <= 40.001; d += 1) { const Pd = pinchAnalysis(d), Ad = areaTarget(Pd), en = HEATC * Pd.QH + CWC * Pd.CW + CHWC * Pd.CHW, cap = Ad * cpm * FCIF * CRF; rows.push([d, en / 1e6, cap / 1e6, (en + cap) / 1e6, econDT(d, cpm).npv]); } HICACHE = {key, rows}; }
  const R = HICACHE.rows; const opt = R.reduce((a, b) => b[3] < a[3] ? b : a); const best = R.reduce((a, b) => b[4] > a[4] ? b : a);
  const en0 = HEATC * P.QH + CWC * P.CW + CHWC * P.CHW, cap0 = A * cpm * FCIF * CRF;
  plot('stChart', {x: [5, 40], y: [0, Math.ceil(Math.max(...R.map(r => r[3])) / 2) * 2], xt: 5, xl: 'ΔTmin (°C)', series: [{d: R.map(r => [r[0], r[1]]), c: 'var(--c-or)'}, {d: R.map(r => [r[0], r[2]]), c: 'var(--c-bl)'}, {d: R.map(r => [r[0], r[3]]), c: cssv('--navy'), w: 3}],
    vl: [{x: dT, c: cssv('--muted'), dash: '4 4', w: 1.5}], pts: [{x: opt[0], y: opt[3], c: 'var(--c-gr)', r: 7}, {x: dT, y: (en0 + cap0) / 1e6, c: 'var(--c-or)', r: 5}],
    tip: x => { const rr = R[Math.max(0, Math.min(R.length - 1, Math.round(x) - 5))]; return `<b>ΔTmin = ${rr[0]} °C</b><br>Energy ${fmt(rr[1], 2)} M$/y<br>Area ${fmt(rr[2], 2)} M$/y<br>Total ${fmt(rr[3], 2)} M$/y`; }});
  $('stNote').textContent = `Lowest total annual cost at ΔTmin ≈ ${opt[0]} °C (${fmt(opt[3], 2)} M$/y) with ${fmt(cpm)} $/m² and a capital recovery factor of ${fmt(CRF, 4)} (10 %, 20 years). The design value of 10 °C is ${Math.abs(opt[0] - 10) <= 3 ? 'close to this optimum' : 'a common industrial choice for gas–liquid services'}.`;
  const nNo = eNo.npv; const ny = R.map(r => r[4]).concat([nNo]);
  plot('npvDt', {x: [5, 40], y: [Math.floor(Math.min(...ny) / 20) * 20 - 10, Math.ceil(Math.max(...ny) / 20) * 20 + 10], xt: 5, xl: 'ΔTmin (°C)', series: [{d: R.map(r => [r[0], r[4]]), c: cssv('--navy'), w: 3}],
    hl: [{y: nNo, c: 'var(--c-rd)', dash: '7 5'}], pts: [{x: dT, y: eHI.npv, c: 'var(--c-or)', r: 7}], tip: x => { const rr = R[Math.max(0, Math.min(R.length - 1, Math.round(x) - 5))]; return `<b>ΔTmin = ${rr[0]} °C</b><br>NPV ${fmt(rr[4], 2)} M$<br>Without HI ${fmt(nNo, 2)} M$`; }});
  drawHEN();
  $('utilT').innerHTML = '<thead><tr><th>Item</th><th>Before</th><th>After</th><th>Reduction (%)</th></tr></thead><tbody>' + UTILHI.map(([n, a, b, r]) => `<tr><td>${n}</td><td>${Math.abs(a) > 1000 ? money(a, 0) : fmt(a, 2)}</td><td>${Math.abs(b) > 1000 ? money(b, 0) : fmt(b, 2)}</td><td>${r}</td></tr>`).join('') + '</tbody>';
  $('aeaT').innerHTML = '<thead><tr><th>Quantity</th><th>Hand</th><th>Aspen EA</th><th>Twin</th></tr></thead><tbody>' + AEA.map(([n, a, b, e], k) => { const tw = [fmt(P10.QH, 2), fmt(P10.QC, 2), fmt(P10.CHW, 2), fmt(P10.CW, 2), fmt(P10.Thot, 2) + ' / ' + fmt(P10.Tcold, 2), fmt(P10.recovered, 2), '14', fmt(A10, 0)][k];
    return `<tr><td>${n}</td><td>${a}</td><td>${b}</td><td class="okc">${tw}</td></tr>`; }).join('') + '</tbody>';
  $('aeaNote').textContent = 'The twin repeats the problem-table algorithm in the browser (Twin column, ΔTmin = 10 °C). Chilled water follows the Aspen convention: cooling water takes all the heat above a shifted 35 °C (Eq. 4.21).';
}
function drawHEN() {
  const svg = $('hen'); const W = 1180, x0 = 230, x1 = 1090, colX = c => x0 + 40 + (c - 1) * ((x1 - x0 - 80) / 13) + (c >= 9 ? 26 : 0) - (c <= 8 ? 6 : 0);
  const pinchX = (colX(8) + colX(9)) / 2; const rows = {}; let y = 44; HEN.hot.forEach(h => { rows[h[0]] = y; y += 46; }); y += 30; HEN.cold.forEach(c => { rows[c[0]] = y; y += 62; });
  const cols = {}; [...HEN.m, ...HEN.u].forEach(m => { [m[1], m[2]].forEach(s => { if (!rows[s]) return; (cols[s] = cols[s] || []).push(m[4]); }); });
  let g = `<line x1="${pinchX}" x2="${pinchX}" y1="14" y2="${y - 10}" stroke="${cssv('--muted')}" stroke-width="1.6" stroke-dasharray="7 5"/><text class="halo" x="${pinchX - 8}" y="24" text-anchor="end" style="font-size:13px;fill:var(--muted)">above the pinch</text><text class="halo" x="${pinchX + 8}" y="24" style="font-size:13px;fill:var(--muted)">below the pinch</text>`;
  const ext = {H1: [1, 2], H2: [3, 12], H3: [5, 6], H4: [7, 11], H5: [13, 13], H6: [12, 12], H7: [14, 14], C1: [8, 10], C2: [2, 8], C3: [1, 1], C4: [6, 7], C5: [4, 9]};
  HEN.hot.concat(HEN.cold).forEach(([id, ts, tt, nm]) => { const hot = id[0] === 'H', yy = rows[id], [ca, cb] = ext[id]; const xa = colX(ca) - 44, xb = colX(cb) + 44, c = hot ? 'var(--c-rd)' : 'var(--c-bl)';
    g += `<text class="halo" x="12" y="${yy + 5}" style="font-size:13.5px;font-weight:700;fill:${c}">${id}</text><text class="halo" x="40" y="${yy + 5}" style="font-size:12.5px;fill:var(--muted)">${nm}</text>`;
    g += hot ? `<line class="st" x1="${xa}" x2="${xb}" y1="${yy}" y2="${yy}" stroke="${c}"/><path d="M${xb},${yy - 6} l10,6 l-10,6z" fill="${c}"/><text class="halo" x="${xa - 6}" y="${yy + 4}" text-anchor="end" style="font-size:11.5px;fill:var(--muted)">${fmt(ts, 2)}</text><text class="halo" x="${xb + 14}" y="${yy + 4}" style="font-size:11.5px;fill:var(--muted)">${fmt(tt, 2)} °C</text>`
      : `<line class="st" x1="${xa}" x2="${xb}" y1="${yy}" y2="${yy}" stroke="${c}"/><path d="M${xa},${yy - 6} l-10,6 l10,6z" fill="${c}"/><text class="halo" x="${xb + 6}" y="${yy + 4}" style="font-size:11.5px;fill:var(--muted)">${fmt(ts, 2)}</text><text class="halo" x="${xa - 14}" y="${yy + 4}" text-anchor="end" style="font-size:11.5px;fill:var(--muted)">${fmt(tt, 2)} °C</text>`; });
  HEN.m.forEach(([n, h, c, q, col]) => { const xx = colX(col), ya = rows[h], yb = rows[c]; g += `<g class="hx" data-t="<b>${n}</b>: ${h} – ${c}<br>Q = ${fmt(q, 2)} kW"><line x1="${xx}" x2="${xx}" y1="${ya}" y2="${yb}" stroke="${cssv('--ink2')}" stroke-width="1.6"/><circle cx="${xx}" cy="${ya}" r="11" fill="var(--c-or)" stroke="var(--panel)" stroke-width="2"/><circle cx="${xx}" cy="${yb}" r="11" fill="var(--c-or)" stroke="var(--panel)" stroke-width="2"/>
    <text class="halo" x="${xx}" y="${yb + 28}" text-anchor="middle" style="font-size:11.5px;font-weight:700;fill:var(--ink)">${n}</text><text class="halo" x="${xx}" y="${yb + 42}" text-anchor="middle" style="font-size:11px;fill:var(--muted)">${fmt(q / 1000, 2)} MW</text></g>`; });
  HEN.u.forEach(([n, h, c, q, col]) => { const xx = colX(col), s = h === 'HU' ? c : h, yy = rows[s], col2 = h === 'HU' ? 'var(--c-go)' : 'var(--c-lb)', lab = h === 'HU' ? 'H' : c === 'CHW' ? 'CH' : 'C';
    g += `<g class="hx" data-t="<b>${n}</b>: ${h === 'HU' ? 'fired heat' : c === 'CHW' ? 'chilled water' : 'cooling water'} on ${s}<br>Q = ${fmt(q, 2)} kW"><circle cx="${xx}" cy="${yy}" r="13" fill="${col2}" stroke="var(--panel)" stroke-width="2"/><text x="${xx}" y="${yy + 4}" text-anchor="middle" style="font-size:11px;font-weight:700;fill:#fff">${lab}</text>
    <text class="halo" x="${xx}" y="${yy + (h === 'HU' ? 30 : -18)}" text-anchor="middle" style="font-size:11.5px;font-weight:700;fill:var(--ink)">${n}${h === 'HU' ? '' : ' · ' + fmt(q / 1000, 2) + ' MW'}</text>${h === 'HU' ? `<text class="halo" x="${xx}" y="${yy + 44}" text-anchor="middle" style="font-size:11px;fill:var(--muted)">${fmt(q / 1000, 2)} MW</text>` : ''}</g>`; });
  svg.setAttribute('viewBox', `0 0 ${W} ${y + 30}`); svg.innerHTML = g; bindTips(svg, '.hx');
}
$('hiOn').addEventListener('change', e => { ST.HI = e.target.checked; HICACHE = {}; render(); toast(ST.HI ? 'Heat-integrated plant selected on every page.' : 'Base plant without heat integration selected on every page.'); });
$('dtmin').addEventListener('input', e => { ST.dT = +e.target.value; render(); });
$('cpm').addEventListener('input', e => { ST.cpm = +e.target.value; render(); });
// ===================================================================== CONTROL
const LCOL = {'TC-310': 'var(--c-or)', 'LC-318': 'var(--c-bl)', 'PC-319': 'var(--c-gr)', 'FC-106': 'var(--c-pu)'};
function loopDefaults(id) { const L = LOOPS[id], m = L.meth[L.def.meth], s = m[L.def.mode] || m.P || m.PI;
  return {mode: L.def.mode, meth: L.def.meth, Kc: s[0], ti: s[1] ?? L.refSet.ti, td: s[2] ?? 0, test: L.def.test || 'load', step: L.tests[L.def.test || 'load'].def}; }
function initPids() { const o = {}; Object.keys(LOOPS).forEach(k => o[k] = loopDefaults(k)); return o; }
function curLoop() { return LOOPS[ST.loop]; } function curPid() { return ST.pids[ST.loop]; }
function blockDiagram() {
  const L = curLoop(), B = L.blocks, col = LCOL[ST.loop];
  const b = (x, y, w, h, t1, t2, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="var(--fill)" stroke="${c}" stroke-width="2"/><text x="${x + w / 2}" y="${y + h / 2 - 4}" text-anchor="middle" style="font-size:15px;font-weight:700;fill:var(--ink)">${t1}</text><text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" style="font-size:13.5px;fill:var(--muted)">${t2}</text>`;
  const a = (x1, x2, y = 100) => `<path d="M${x1},${y} H${x2}" stroke="var(--ink2)" stroke-width="2" marker-end="url(#bA)" fill="none"/>`;
  const sum = x => `<rect x="${x}" y="88" width="24" height="24" rx="12" fill="var(--panel)" stroke="var(--ink2)" stroke-width="2"/><text x="${x + 12}" y="105" text-anchor="middle" style="font-size:14px;fill:var(--ink)">Σ</text>`;
  const ctl = L.ratio ? 'Kc(1 + 1/τIs)' : curPid().mode === 'P' ? 'Kc' : curPid().mode === 'PI' ? 'Kc(1 + 1/τIs)' : 'Kc(1 + 1/τIs + τDs)';
  $('blk').innerHTML = `<defs><marker id="bA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--ink2)"/></marker></defs>
   <text x="34" y="94" text-anchor="middle" style="font-size:13.5px;fill:var(--muted)">${B[9].split(' ').slice(0, 1)}</text><text x="34" y="112" text-anchor="middle" style="font-size:12.5px;fill:var(--muted)">${B[9].split(' ').slice(1).join(' ')}</text>${a(70, 96)}${sum(98)}
   ${a(122, 160)}${b(160, 70, 170, 60, B[0], ctl, col)}${a(330, 370)}${b(370, 70, 180, 60, B[1], B[2], 'var(--blue)')}${a(550, 600)}
   ${b(600, 70, 200, 60, B[3], B[4], 'var(--navy)')}${sum(832)}${a(800, 832)}${a(856, 1070)}<text x="1000" y="92" style="font-size:14px;fill:var(--ink)">${B[8]}</text>
   <path d="M844,40 V88" stroke="var(--ink2)" stroke-width="2" marker-end="url(#bA)"/><text x="844" y="24" text-anchor="middle" style="font-size:13.5px;fill:var(--muted)">${B[7]}</text>
   <path d="M950,100 V174 H730" stroke="var(--ink2)" stroke-width="2" fill="none"/>${b(470, 150, 260, 48, B[5], B[6], 'var(--green)')}
   <path d="M470,174 H110 V112" stroke="var(--ink2)" stroke-width="2" fill="none" marker-end="url(#bA)"/><text x="118" y="140" style="font-size:13px;fill:var(--muted)">−</text>`;
  $('blkT').textContent = 'Block diagram of the ' + L.tag + ' loop'; $('blkR').textContent = L.ref; $('lDesc').textContent = L.desc;
}
function runLoop(L, s, test, stepV) { const T = L.tests[test], v = T.f(stepV); return simGen(L, {Kc: s.Kc, ti: s.ti, td: s.mode === 'PID' ? s.td : 0, mode: s.mode, sp: test === 'sp' ? v : 0, dist: test === 'load' ? v : 0}); }
function isUnstable(L, s, R) {
  const t = L.tEnd, amp = (a, b) => Math.max(0, ...R.pts.filter(p => p[0] >= a * t && p[0] < b * t).map(p => Math.abs(p[1] - R.final)));
  const ku = loopKcu(L).Kcu; return !isFinite(R.final) || Math.abs(R.final) > 1e6 || (s.mode === 'P' && s.Kc >= ku) || (amp(0.75, 1) > L.band * 0.5 && amp(0.75, 1) > 1.02 * amp(0.5, 0.75));
}
const fmtY = (L, v) => fmt(v, L.yU === 'kg/h' ? 0 : L.yU === '°C' ? 2 : L.yU === 'bar' ? 3 : 3);
let pidRun = null;
function buildLoopPick() {
  $('lpick').innerHTML = Object.entries(LOOPS).map(([k, L]) => `<button class="lp${k === ST.loop ? ' on' : ''}" style="--lc:${LCOL[k]}" data-l="${k}"><span class="bd ${L.src === 'report' ? 'r' : 'e'}">${L.src === 'report' ? 'Report model' : 'Estimated model'}</span><div class="tg">${L.tag}</div><div class="tt">${L.title}</div><div class="ty">${L.type} · ${L.unit}</div><div class="st" id="lst-${k}"><i></i>stable</div></button>`).join('');
  $$('#lpick .lp').forEach(b => b.addEventListener('click', () => selectLoop(b.dataset.l)));
}
function selectLoop(k) { ST.loop = k; $$('#lpick .lp').forEach(b => b.classList.toggle('on', b.dataset.l === k)); syncLoopInputs(); rControl(true); }
function syncLoopInputs() {
  const L = curLoop(), P = curPid(); const set = (id, v, r) => { const el = $(id); if (r) { el.min = r[0]; el.max = r[1]; el.step = r[2]; } el.value = v; fillRange(el); };
  set('kc', P.Kc, L.kc); set('ti', P.ti, L.ti); set('td', P.td, L.td[1] > 0 ? L.td : [0, 0.4, 0.002]);
  const T = L.tests[P.test]; set('stp', P.step, [T.min, T.max, T.st]);
  $('pidMode').innerHTML = ['P', 'PI', 'PID'].map(m => `<button data-k="${m}" class="${P.mode === m ? 'on' : ''}" ${L.modes.includes(m) ? '' : 'disabled title="Not used for this loop"'}>${m}</button>`).join('');
  $$('#pidMode button').forEach(b => b.addEventListener('click', () => { const P = curPid(); P.mode = b.dataset.k; const m = L.meth[P.meth]; if (m && m[P.mode]) { const s = m[P.mode]; P.Kc = s[0]; if (s[1]) P.ti = s[1]; P.td = s[2] || 0; } else P.meth = 'custom'; syncLoopInputs(); rControl(true); }));
  $('pidTest').innerHTML = Object.entries(L.tests).map(([k, t]) => `<button data-k="${k}" class="${P.test === k ? 'on' : ''}">${t.n}</button>`).join('');
  $$('#pidTest button').forEach(b => b.addEventListener('click', () => { const P = curPid(); P.test = b.dataset.k; P.step = L.tests[P.test].def; syncLoopInputs(); rControl(true); }));
  $('tiBox').style.display = L.modes.includes('PI') ? '' : 'none'; $('tdBox').style.display = L.modes.includes('PID') ? '' : 'none';
  $('cTag').textContent = L.tag; $('methT').textContent = L.src === 'report' && ST.loop === 'TC-310' ? 'Tuning method (Table 6.15)' : ST.loop === 'LC-318' ? 'Tuning (Table 6.17)' : 'Tuning method';
}
function rControl(anim) {
  const L = curLoop(), P = curPid(), T = L.tests[P.test];
  blockDiagram();
  $('o-kc').value = fmt(P.Kc, 2); $('o-ti').value = fmt(P.ti, 3); $('o-td').value = fmt(P.td, 3); $('stpL').firstChild.textContent = 'Step size (' + T.u + ') '; $('o-stp').value = (P.step > 0 ? '+' : '') + fmt(P.step, T.st < 1 ? (T.st < 0.1 ? 2 : 1) : 0) + ' ' + T.u;
  $('ti').disabled = P.mode === 'P'; $('td').disabled = P.mode !== 'PID';
  $('pidMeth').innerHTML = Object.entries(L.meth).map(([k, m]) => `<button data-k="${k}" class="${P.meth === k ? 'on' : ''}">${m.n}${m.sel ? ' ★' : ''}</button>`).join('') + `<button data-k="custom" class="${P.meth === 'custom' ? 'on' : ''}">Custom</button>`;
  $$('#pidMeth button').forEach(b => b.addEventListener('click', () => { const k = b.dataset.k, P = curPid(); P.meth = k; if (k !== 'custom') { const m = L.meth[k]; const md = m[P.mode] ? P.mode : m.PID ? 'PID' : m.PI ? 'PI' : 'P'; P.mode = md; const s = m[md]; P.Kc = s[0]; if (s[1]) P.ti = s[1]; P.td = s[2] || 0; } syncLoopInputs(); rControl(true); }));
  const R = runLoop(L, P, P.test, P.step), Rr = runLoop(L, L.refSet, P.test, P.step), unstable = isUnstable(L, P, R);
  const ku = loopKcu(L), sp = P.test === 'sp' ? T.f(P.step) : 0, offset = R.final - sp;
  const yu = ' ' + L.yU, tau63 = (() => { const fin = R.final, s0 = R.pts.find(p => Math.abs(p[1]) >= 0.632 * Math.abs(fin) && p[0] > R.tS); return s0 && Math.abs(fin) > 1e-9 ? s0[0] - R.tS : null; })();
  const ov = sp ? (Math.max(...R.pts.map(p => p[1] * Math.sign(sp))) - Math.abs(sp)) / Math.abs(sp) * 100 : null;
  const rise = (() => { if (!sp) return null; const t1 = R.pts.find(p => p[0] > R.tS && p[1] / sp >= 0.1), t9 = R.pts.find(p => p[0] > R.tS && p[1] / sp >= 0.9); return t1 && t9 ? t9[0] - t1[0] : null; })();
  const K = [sp ? ['Rise time (10–90 %)', unstable || rise === null ? '—' : fmt(rise, 3) + ' min', 'var(--orange)'] : ['Maximum deviation', unstable ? '∞' : fmtY(L, R.maxdev) + yu, 'var(--orange)'], ['IAE', unstable ? '∞' : fmt(R.iae, L.yU === 'kg/h' ? 0 : 3) + yu + '·min', 'var(--blue)'],
   ['Settling (±' + fmtY(L, L.band) + yu + ')', unstable ? '—' : (R.settle > L.tEnd * 0.95 ? '> ' + fmt(L.tEnd * 0.97, 1) + ' min' : fmt(Math.max(0, R.settle), 2) + ' min'), 'var(--navy)'],
   [sp ? 'Overshoot' : 'Offset', sp ? (unstable ? '—' : fmt(Math.max(0, ov), 1) + ' %') : (P.mode === 'P' ? fmtY(L, offset) + yu : '0 (integral action)'), 'var(--gold)'],
   [L.kind === 'int' && P.mode === 'P' ? 'Closed-loop τ (63 %)' : 'Kc / Kcu', L.kind === 'int' && P.mode === 'P' ? (tau63 ? fmt(tau63, 2) + ' min' : '—') : (isFinite(ku.Kcu) ? fmt(P.Kc / ku.Kcu, 3) : '0 (Kcu = ∞)'), 'var(--green)'],
   ['Loop', unstable ? 'UNSTABLE' : 'Stable', unstable ? 'var(--red)' : 'var(--green)']];
  $('pidK').innerHTML = K.map(([l, v, c]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:22px">${v}</div></div>`).join('');
  $('pidChip').className = 'chip' + (unstable ? ' bad' : ''); $('pidChip').innerHTML = `<i></i>${L.tag}: ${unstable ? 'loop unstable' : 'loop stable'} · ${P.mode} Kc = ${fmt(P.Kc, 2)}`;
  const st = $('lst-' + ST.loop); if (st) { st.className = 'st' + (unstable ? ' bad' : ''); st.innerHTML = `<i></i>${unstable ? 'unstable' : 'stable'} · ${P.mode} Kc ${fmt(P.Kc, 2)}`; }
  $('yT').textContent = L.yN; $('yU').textContent = L.yU + ' (set point ' + fmtY(L, L.y0) + ' ' + L.yU + ')'; $('uN').textContent = L.uN;
  $('yLg').innerHTML = `<span><i class="sw ln" style="background:var(--navy)"></i>Selected tuning</span><span><i class="sw dash" style="border-color:var(--c-lb)"></i>${L.refName}</span><span><i class="sw dash" style="border-color:var(--c-or)"></i>Set point</span><span><i class="sw" style="background:color-mix(in srgb,var(--c-gr) 30%,transparent)"></i>±${fmtY(L, L.band)} ${L.yU} band</span>`;
  const cl = v => Math.max(-1e7, Math.min(1e7, v)); const y0 = L.y0, tT = R.pts.map(p => [p[0], y0 + cl(p[1])]), tR = Rr.pts.map(p => [p[0], y0 + p[1]]), tS = R.pts.map(p => [p[0], y0 + p[3]]), tU = R.pts.map(p => [p[0], cl(p[2])]);
  const span = Math.max(...tR.map(p => Math.abs(p[1] - y0)), Math.abs(sp), L.band * 4) * 1.6;
  const ys = tT.concat(tR).map(p => p[1]).filter(v => Math.abs(v - y0) <= span * 3);
  const lim = [Math.min(...ys, y0 + sp) , Math.max(...ys, y0 + sp)]; const pad = (lim[1] - lim[0]) * 0.12 || 1; lim[0] -= pad; lim[1] += pad;
  const draw = n => { const k = Math.max(2, Math.round(tT.length * n));
    plot('pidT', {x: [0, L.tEnd], y: lim, xl: 'Time (min)', bands: [{y0: y0 + sp - L.band, y1: y0 + sp + L.band, x0: R.tS, c: 'color-mix(in srgb,var(--c-gr) 24%,transparent)'}], series: [{d: tS, c: 'var(--c-or)', dash: '4 4', w: 1.6}, {d: tR.slice(0, k), c: 'var(--c-lb)', dash: '6 4'}, {d: tT.slice(0, k), c: cssv('--navy'), w: 2.8}],
      tip: x => `<b>t = ${fmt(x, 2)} min</b><br>Selected: ${fmtY(L, interp(tT, x))} ${L.yU}<br>${L.refName.split(' (')[0]}: ${fmtY(L, interp(tR, x))} ${L.yU}`});
    const um = Math.max(1e-3, ...tU.map(p => Math.abs(p[1]))) * 1.15;
    plot('pidU', {x: [0, L.tEnd], y: [-um, um], xl: 'Time (min)', series: [{d: tU.slice(0, k), c: 'var(--c-or)', w: 2.6}], tip: x => `<b>t = ${fmt(x, 2)} min</b><br>u = ${fmt(interp(tU, x), 3)} mA`}); };
  if (pidRun) cancelAnimationFrame(pidRun);
  if (anim) { const t0 = performance.now(); const stp = t => { const n = Math.min(1, (t - t0) / 1600); draw(n); if (n < 1) pidRun = requestAnimationFrame(stp); }; pidRun = requestAnimationFrame(stp); } else draw(1);
  loopTable(L, P); loopSummary();
  const q = ST.iq.toLowerCase(); const hiTags = ['TC-114 *', 'TC-105', 'TC-202', 'TC-310', 'TC-406 / FC-408', 'FC-103']; const SIMT = {'TC-310': 'TC-310', 'LC-318': 'LC-318', 'PC-319': 'PC-319', 'FY/FC-106': 'FC-106'};
  const rows = INSTR.filter(r => (ST.iSeg === 'all' || (ST.iSeg === 'HI' ? hiTags.includes(r[0]) : r[0].replace('FY/', '').startsWith(ST.iSeg)) || (ST.iSeg === 'P' && r[0].startsWith('PC'))) && (!q || r.join(' ').toLowerCase().includes(q)));
  $('iTab').innerHTML = '<thead><tr><th>Loop</th><th>Service</th><th>Mode</th><th>Final control element</th><th>Section</th><th></th></tr></thead><tbody>' + rows.map(r => `<tr><td><b>${r[0]}</b>${hiTags.includes(r[0]) ? ' <span class="tag hi">HI</span>' : ''}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${SIMT[r[0]] ? `<button class="btn sm" data-sim="${SIMT[r[0]]}">Simulate ↑</button>` : ''}</td></tr>`).join('') + '</tbody>';
  $$('#iTab [data-sim]').forEach(b => b.addEventListener('click', () => { selectLoop(b.dataset.sim); $('lpick').scrollIntoView({behavior: 'smooth', block: 'start'}); }));
  $('hicT').innerHTML = '<thead><tr><th>Exchanger</th><th>Base flowsheet</th><th>Heat-integrated flowsheet</th><th>New control action</th></tr></thead><tbody>' + HICTRL.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('') + '</tbody>';
  const img = $('pidimg'), want = ST.pidSel === 'hi' ? 'pid_hi.webp' : 'pid_base.webp'; if (!img.src.endsWith(want)) { img.src = want; pidZoom = null; }
  if (!pidZoom && img.complete && img.naturalWidth) fitPid();
}
const PIDM_RES = {};   // the five tuning methods of Table 6.16 are simulated once
function loopTable(L, P) {
  const ku = loopKcu(L);
  if (ST.loop === 'TC-310') {
    const rowsM = Object.entries(PIDM).map(([k, m]) => { if (!PIDM_RES[k]) { const g = m.sim || m.PID, r = simLoop({Kc: g[0], ti: g[1], td: g[2], mode: 'PID', dist: 10, tEnd: 8}), bsp = simLoop({Kc: g[0], ti: g[1], td: g[2], mode: 'PID', sp: 5, dist: 0, tEnd: 8});
        PIDM_RES[k] = {a: r, os: (Math.max(...bsp.pts.map(p => p[1])) - 5) / 5 * 100}; } const a = PIDM_RES[k].a, os = PIDM_RES[k].os; return `<tr${k === P.meth ? ' style="font-weight:700"' : ''}><td>${m.n}</td><td>${m.PID.map(v => fmt(v, 3)).join(' / ')}</td><td>${fmt(m.rep[0], 2)} | <span class="okc">${fmt(a.maxdev, 2)}</span></td><td>${fmt(m.rep[1], 2)} | <span class="okc">${fmt(a.iae, 2)}</span></td><td>${fmt(m.rep[2], 2)} | <span class="okc">${fmt(a.settle, 2)}</span></td><td>${m.rep[3]} | <span class="okc">${fmt(os, 0)}</span></td></tr>`; }).join('');
    $('tabT').textContent = 'Stability (Routh, Table 6.14) and performance of the methods (Table 6.16)';
    $('pidTab').innerHTML = `<thead><tr><th>Method</th><th>Kc / τI / τD</th><th>Max. dev. (°C)</th><th>IAE (°C·min)</th><th>Settling (min)</th><th>SP overshoot (%)</th></tr></thead><tbody>${rowsM}</tbody>`;
    $('routhNote').innerHTML = `Report | <span class="okc">twin</span>, for a 10 °C disturbance in T19. Routh: 0.011875s³ + 0.19125s² + 0.825s + (1 + 1.931Kc) = 0, so the loop is stable under P control for Kc < Kcu = <b>${fmt(ku.Kcu, 3)}</b>, with ωu = ${fmt(ku.wu, 3)} rad/min (Pu = ${fmt(2 * Math.PI / ku.wu, 3)} min).`;
  } else if (ST.loop === 'LC-318') {
    const rep = [[1, 0.01611, 9.95, 0.090, 0.990], [2, 0.03222, 4.98, 0.045, 0.945], [4, 0.06444, 2.49, 0.023, 0.923]];
    const rows = rep.map(([kc, g, tau, off, fin]) => { const R = simGen(Object.assign({}, L, {tEnd: 90, dt: 0.01}), {Kc: kc, mode: 'P', dist: L.tests.load.f(10)}); const t63 = R.pts.find(p => p[1] >= 0.632 * R.final && p[0] > R.tS)[0] - R.tS;
      return `<tr${Math.abs(P.Kc - kc) < 1e-9 && P.mode === 'P' ? ' style="font-weight:700"' : ''}><td>${kc}</td><td>${fmt(g, 5)} | <span class="okc">${fmt(kc * loopK(L) * F101_A / 60, 5)}</span></td><td>${fmt(tau, 2)} | <span class="okc">${fmt(F101_A / (kc * loopK(L) * F101_A), 2)}</span> | <span class="okc">${fmt(t63, 2)}</span></td><td>${fmt(off, 3)} | <span class="okc">${fmt(R.final, 3)}</span></td><td>${fmt(fin, 3)} | <span class="okc">${fmt(0.9 + R.final, 3)}</span></td></tr>`; }).join('');
    $('tabT').textContent = 'P-only level control of F-101 for a +10 % step in the liquid inflow (Table 6.17)';
    $('pidTab').innerHTML = `<thead><tr><th>Kc (mA/mA)</th><th>Kc·kv·km (m²/s)</th><th>τcl (min): Eq. 6.21 | with valve lag</th><th>Level offset (m)</th><th>Final level (m)</th></tr></thead><tbody>${rows}</tbody>`;
    $('routhNote').innerHTML = `Report | <span class="okc">twin</span>. A = π/4 × 3.50² = ${fmt(F101_A, 3)} m², kv = 1.8125 × 10⁻³ (m³/s)/mA (V-101 passes 0.029 m³/s), km = 16/1.80 = 8.889 mA/m. τcl = A/(Kc·kv·km) and offset = ΔFin/(Kc·kv·km) (Eq. 6.21). The twin also includes the 0.10 min lag of the valve, which makes the response slightly faster at the start; the offsets are identical. With an integrating process and one lag the loop has no ultimate gain (P control is always stable).`;
  } else {
    const rows = Object.entries(L.meth).map(([k, m]) => { const md = m.PI ? 'PI' : 'P', s = m[md]; const sset = {mode: md, Kc: s[0], ti: s[1] || 1, td: 0}; const a = runLoop(L, sset, 'load', L.tests.load.def), b = runLoop(L, sset, 'sp', L.tests.sp.def);
      const spv = L.tests.sp.f(L.tests.sp.def), os = (Math.max(...b.pts.map(p => p[1] * Math.sign(spv))) - Math.abs(spv)) / Math.abs(spv) * 100;
      return `<tr${k === P.meth ? ' style="font-weight:700"' : ''}><td>${m.n}</td><td>${md}: ${fmt(s[0], 2)}${s[1] ? ' / ' + fmt(s[1], 2) + ' min' : ''}</td><td class="okc">${fmtY(L, a.maxdev)}</td><td class="okc">${fmt(a.iae, L.yU === 'kg/h' ? 0 : 3)}</td><td class="okc">${md === 'P' ? fmtY(L, a.final) : '0'}</td><td class="okc">${fmt(Math.max(0, os), 1)}</td><td class="okc">${fmt(Math.max(0, b.settle), 2)}</td></tr>`; }).join('');
    const lt = L.tests.load, sp = L.tests.sp;
    $('tabT').textContent = 'Performance of the tuning methods (twin, model estimated from the design data)';
    $('pidTab').innerHTML = `<thead><tr><th>Method</th><th>Settings</th><th>Max. dev., load (${L.yU})</th><th>IAE, load (${L.yU}·min)</th><th>Offset (${L.yU})</th><th>SP overshoot (%)</th><th>SP settling (min)</th></tr></thead><tbody>${rows}</tbody>`;
    const th = L.tv + L.tm, Kp = loopK(L);
    $('routhNote').innerHTML = (ST.loop === 'PC-319' ? `Model estimated for the twin (not part of the report): the gas hold-up of the loop is ${fmt(LOOP_VOL, 1)} m³ (${LOOP_V.map(r => r[0] + ' ' + fmt(r[1], 1)).join('; ')}), so dP/dt = RT/V × (Fin − Fpurge) with RT/V = ${fmt(G_P, 4)} bar/kmol at 40 °C. The purge valve passes twice the design purge (2 × 1,436.31 kmol/h), PT-319 has a span of 0–60 bar and a lag of 0.05 min. Integrating model K′e<sup>−θs</sup>/s with K′ = ${fmt(Kp, 4)} min⁻¹ and θ = ${fmt(th, 2)} min; SIMC: Kc = 1/[K′(τc + θ)], τI = 4(τc + θ). Under P control the ultimate gain is Kcu = ${fmt(loopKcu(L).Kcu, 1)}.`
      : `Model estimated for the twin (not part of the report): FV-106 passes twice the design steam (2 × 50,400 kg/h) and FT-106 has a span of 0–100,800 kg/h, so K = kv·km = ${fmt(Kp, 3)}. The valve lag (0.10 min) dominates; the steam line (0.01 min) and the transmitter (0.02 min) form the dead time θ = ${fmt(L.tp + L.tm, 2)} min. SIMC: Kc = τ/[K(τc + θ)], τI = min(τ, 4(τc + θ)). The set point is 1.33 × the MPW feed measured by WT-101 (Table 6.18), so a feed step of +10 % asks for +${fmt(1.33 * 3787.9, 0)} kg/h of steam. Ultimate gain under P control: Kcu = ${fmt(loopKcu(L).Kcu, 1)}.`) + ` Standard tests: ${lt.n} ${lt.def > 0 ? '+' : ''}${lt.def} ${lt.u} and ${sp.n} ${sp.def > 0 ? '+' : ''}${sp.def} ${sp.u}.`;
  }
}
function loopSummary() {
  $('loopSum').innerHTML = '<thead><tr><th>Loop</th><th>Controlled variable</th><th>Model</th><th>Current tuning</th><th>Response (standard test)</th><th>Settling (min)</th><th>Kcu (P only)</th><th>Status</th><th></th></tr></thead><tbody>' +
   Object.entries(LOOPS).map(([k, L]) => { const P = ST.pids[k], t = L.def.test || 'load', R = runLoop(L, P, t, L.tests[t].def), un = isUnstable(L, P, R), ku = loopKcu(L).Kcu;
    return `<tr${k === ST.loop ? ' style="font-weight:700"' : ''}><td><b style="color:${LCOL[k]}">${L.tag}</b></td><td>${L.title}</td><td>${L.src === 'report' ? '<span class="tag">Report</span>' : '<span class="tag hi" style="background:var(--lgold);color:var(--gold)">Estimated</span>'}</td><td>${P.mode} · Kc ${fmt(P.Kc, 2)}${P.mode !== 'P' ? ' · τI ' + fmt(P.ti, 2) : ''}${P.mode === 'PID' ? ' · τD ' + fmt(P.td, 3) : ''}</td>
     <td>${un ? '∞' : t === 'sp' ? 'overshoot ' + fmt(Math.max(0, (Math.max(...R.pts.map(p => p[1])) - L.tests.sp.f(L.tests.sp.def)) / L.tests.sp.f(L.tests.sp.def) * 100), 1) + ' %' : fmtY(L, R.maxdev) + ' ' + L.yU}</td><td>${un ? '—' : fmt(Math.max(0, R.settle), 2)}</td><td>${isFinite(ku) ? fmt(ku, 2) : '∞'}</td><td class="${un ? 'badc' : 'okc'}">${un ? 'Unstable' : 'Stable'}</td><td><button class="btn sm" data-sel="${k}">Open</button></td></tr>`; }).join('') + '</tbody>';
  $$('#loopSum [data-sel]').forEach(b => b.addEventListener('click', () => { selectLoop(b.dataset.sel); $('lpick').scrollIntoView({behavior: 'smooth', block: 'start'}); }));
  Object.entries(LOOPS).forEach(([k, L]) => { if (k === ST.loop) return; const P = ST.pids[k], t = L.def.test || 'load', un = isUnstable(L, P, runLoop(L, P, t, L.tests[t].def)); const st = $('lst-' + k); if (st) { st.className = 'st' + (un ? ' bad' : ''); st.innerHTML = `<i></i>${un ? 'unstable' : 'stable'} · ${P.mode} Kc ${fmt(P.Kc, 2)}`; } });
}
[['kc', 'Kc'], ['ti', 'ti'], ['td', 'td']].forEach(([id, k]) => $(id).addEventListener('input', e => { const P = curPid(); P[k] = +e.target.value; P.meth = 'custom'; rControl(); }));
$('stp').addEventListener('input', e => { curPid().step = +e.target.value || curLoop().tests[curPid().test].st; rControl(); });
$('pidPlay').addEventListener('click', () => rControl(true));
$('loopReset').addEventListener('click', () => { ST.pids[ST.loop] = loopDefaults(ST.loop); syncLoopInputs(); rControl(true); toast(curLoop().tag + ' returned to its recommended tuning.'); });
$$('#iSeg button').forEach(b => b.addEventListener('click', () => { ST.iSeg = b.dataset.k; $$('#iSeg button').forEach(x => x.classList.toggle('on', x === b)); rControl(); }));
$('iq').addEventListener('input', e => { ST.iq = e.target.value; rControl(); });
$$('#pidSel button').forEach(b => b.addEventListener('click', () => { ST.pidSel = b.dataset.k; $$('#pidSel button').forEach(x => x.classList.toggle('on', x === b)); rControl(); }));
// P&ID pan and zoom
let pidZoom = null; const pv = $('pidv'), pimg = $('pidimg');
function applyPid() { pimg.style.transform = `translate(${pidZoom.x}px,${pidZoom.y}px) scale(${pidZoom.s})`; }
function fitPid() { const r = pv.getBoundingClientRect(); if (!pimg.naturalWidth || !r.width) return; const s = Math.min(r.width / pimg.naturalWidth, r.height / pimg.naturalHeight); pidZoom = {s, x: (r.width - pimg.naturalWidth * s) / 2, y: (r.height - pimg.naturalHeight * s) / 2, s0: s}; applyPid(); }
pimg.addEventListener('load', fitPid);
function zoomAt(f, cx, cy) { if (!pidZoom) fitPid(); const s2 = Math.max(pidZoom.s0 * 0.8, Math.min(pidZoom.s0 * 8, pidZoom.s * f)); const k = s2 / pidZoom.s; pidZoom.x = cx - (cx - pidZoom.x) * k; pidZoom.y = cy - (cy - pidZoom.y) * k; pidZoom.s = s2; applyPid(); }
pv.addEventListener('wheel', e => { e.preventDefault(); const r = pv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, {passive: false});
let drag = null; pv.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = {x: e.clientX, y: e.clientY, ox: pidZoom ? pidZoom.x : 0, oy: pidZoom ? pidZoom.y : 0}; pv.setPointerCapture(e.pointerId); pv.style.cursor = 'grabbing'; });
pv.addEventListener('pointermove', e => { if (!drag || !pidZoom) return; pidZoom.x = drag.ox + e.clientX - drag.x; pidZoom.y = drag.oy + e.clientY - drag.y; applyPid(); });
pv.addEventListener('pointerup', () => { drag = null; pv.style.cursor = 'grab'; });
$('zin').addEventListener('click', () => { const r = pv.getBoundingClientRect(); zoomAt(1.35, r.width / 2, r.height / 2); });
$('zout').addEventListener('click', () => { const r = pv.getBoundingClientRect(); zoomAt(1 / 1.35, r.width / 2, r.height / 2); });
$('zfit').addEventListener('click', fitPid);
// ===================================================================== ECONOMICS
// ===================================================================== ECONOMICS
const DEPS = [['macrs5', 'MACRS 5'], ['macrs7', 'MACRS 7'], ['macrs10', 'MACRS 10'], ['sl10', 'SL 10 y']];
const ES = {
  eq: EQX.map(([k, l], j) => ['eq' + j, 'eq.' + k, l, -50, 100, 1, v => (v > 0 ? '+' : '') + fmt(v) + ' %', null]),
  cap: [['lease', 'lease', 'Land lease (SAR/m² per year)', 0, 20, 0.5, v => fmt(v, 1), '0 = plot provided free (Chapter 8); RCJY lease 4.5 SAR/m²'],
    ['buy', 'buy', 'Land purchase (SAR/m²)', 0, 1500, 10, v => fmt(v), '12.6 ha plot, paid in year 0 and recovered at the end'],
    ['wc', 'wc', 'Working capital (% of FCI)', 5, 25, 1, v => fmt(v) + ' %', 'Chapter 8: 10 %'], ['sal', 'sal', 'Salvage value (% of FCI)', 0, 15, 1, v => fmt(v) + ' %', 'Chapter 8: 5 %']],
  time: [['build', 'build', 'Construction period', 1, 4, 1, v => fmt(v) + (+v === 1 ? ' year' : ' years'), 'Fixed capital spread evenly; Chapter 8: 2 years (50 % / 50 %)'],
    ['life', 'life', 'Operating life', 10, 30, 1, v => fmt(v) + ' years', 'Chapter 8: 20 years of operation'],
    ['cepci', 'cepci', 'Cost index (CEPCI) of the purchase', 700, 1000, 0.1, v => fmt(v, 1), 'Chapter 8: 840.9; scales the cost of every unit'],
    ['escp', 'escp', 'Escalation of the product prices (%/year)', -3, 5, 0.25, v => (v > 0 ? '+' : '') + fmt(v, 2) + ' %', 'Chapter 8: constant prices'],
    ['escc', 'escc', 'Escalation of the operating costs (%/year)', -3, 5, 0.25, v => (v > 0 ? '+' : '') + fmt(v, 2) + ' %', 'Chapter 8: constant costs']]};
const ESALL = () => ES.eq.concat(ES.cap, ES.time);
const ecGet = k => k.startsWith('eq.') ? ST.EC.eq[k.slice(3)] : ST.EC[k];
const ecSet = (k, v) => { if (k.startsWith('eq.')) ST.EC.eq[k.slice(3)] = v; else ST.EC[k] = v; };
const EC_MS = {price: ['pm', 'ph', 'pw', 'pe', 'ng', 'lg'], cap: ['fc'], fin: ['ir', 'tx', 'av']};
function buildEcon() {
  const msCtl = id => { const [, , dflt, , inv, l, mn, mx, st] = MS.find(z => z[0] === id); return `<div class="ctl"><label for="e${id}">${l} <output id="o-e${id}"></output></label><input id="e${id}" type="range" min="${mn}" max="${mx}" step="${st}" value="${inv(dflt)}"></div>`; };
  const ecCtl = ([id, k, l, mn, mx, st, , ref]) => `<div class="ctl"><label for="x${id}">${l} <output id="o-x${id}"></output></label><input id="x${id}" type="range" min="${mn}" max="${mx}" step="${st}" value="${ecGet(k)}">${ref ? `<span class="ref">${ref}</span>` : ''}</div>`;
  $('ecPrice').innerHTML = EC_MS.price.map(msCtl).join('') + '<p class="note">The same prices are used by the market page and by the AI search.</p>';
  $('ecCap').innerHTML = '<h4>Equipment, change of the bare-module cost</h4>' + ES.eq.map(ecCtl).join('') + msCtl('fc') + '<h4>Land and capital</h4>' + ES.cap.map(ecCtl).join('');
  $('ecTime').innerHTML = ES.time.map(ecCtl).join('') + '<p class="note">Escalation is counted from year 0; the interest rate stays as set on the Finance tab.</p>';
  $('ecFin').innerHTML = EC_MS.fin.map(msCtl).join('') + '<h4>Depreciation</h4><div class="seg full" id="xdep" style="grid-template-columns:repeat(2,1fr)">' + DEPS.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('') + '</div><p class="note">Chapter 8 compares six methods; the 5-year MACRS gives the highest NPV and is the design basis.</p>';
  EC_MS.price.concat(EC_MS.cap, EC_MS.fin).forEach(id => { const [, k, , fwd] = MS.find(z => z[0] === id); $('e' + id).addEventListener('input', e => { ST.MK[k] = fwd(+e.target.value); ST.SCID = 'custom'; HICACHE = {}; render(); }); });
  ESALL().forEach(([id, k]) => $('x' + id).addEventListener('input', e => { ecSet(k, +e.target.value); HICACHE = {}; AIRES = {}; render(); }));
  $$('#xdep button').forEach(b => b.addEventListener('click', () => { ST.EC.dep = b.dataset.k; HICACHE = {}; AIRES = {}; syncEcon(); render(); }));
  $$('#ecTab button').forEach(b => b.addEventListener('click', () => { ST.ecTab = b.dataset.k; syncEcon(); }));
}
function syncEcon() {
  if (!$('ecPrice')) return; const set = (id, v) => { const el = $(id); if (el) { el.value = v; fillRange(el); } };
  EC_MS.price.concat(EC_MS.cap, EC_MS.fin).forEach(id => { const [, k, dflt, , inv] = MS.find(z => z[0] === id); set('e' + id, inv(k in ST.MK ? ST.MK[k] : dflt)); });
  ESALL().forEach(([id, k]) => set('x' + id, ecGet(k)));
  $$('#xdep button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.EC.dep));
  $$('#ecTab button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.ecTab)); $$('.ecin .ecg').forEach(g => g.classList.toggle('on', g.dataset.g === ST.ecTab));
}
// inputs that differ from Chapter 8, listed with the value of the report
function ecChanges() {
  const out = []; MS.forEach(([id, k, dflt, , inv, l, , , , f]) => { if (k in ST.MK && Math.abs(ST.MK[k] - dflt) > 1e-9) out.push([l.replace(/ \(.*\)$/, ''), f(inv(ST.MK[k])), f(inv(dflt))]); });
  const D = DEF.EC; ESALL().forEach(([id, k, l, , , , f]) => { const v = ecGet(k), d = k.startsWith('eq.') ? 0 : D[k]; if (Math.abs(v - d) > 1e-9) out.push([l.replace(/ \(.*\)$/, ''), f(v), f(d)]); });
  if (ST.EC.dep !== D.dep) out.push(['Depreciation', DEPS.find(d => d[0] === ST.EC.dep)[1], 'MACRS 5']);
  if (!ST.HI) out.push(['Heat integration', 'OFF', 'ON']); return out;
}
function rEcon() {
  const p = E0.p, D = econDetail(p), ind = indicators(E0.cf, p.i, D.B), full = D.full, cep = p.cepci || 840.9;
  // input read-outs and the list of changes
  EC_MS.price.concat(EC_MS.cap, EC_MS.fin).forEach(id => { const m = MS.find(z => z[0] === id); $('o-e' + id).value = m[9](+$('e' + id).value); });
  ESALL().forEach(([id, k, , , , , f]) => { $('o-x' + id).value = f(ecGet(k)); });
  const ch = ecChanges(); $('ecDiff').className = 'box' + (ch.length ? ' or' : '');
  $('ecDiff').innerHTML = ch.length ? `<b>Changed from Chapter 8</b><ul>${ch.map(([l, v, d]) => `<li>${l}: <b>${v}</b> <span style="color:var(--graphite)">(report ${d})</span></li>`).join('')}</ul><p style="margin:8px 0 0">NPV ${money(ind.npv)} M against ${money(DES.npv)} M in the report (${ind.npv - DES.npv >= 0 ? '+' : '−'}${fmt(Math.abs(ind.npv - DES.npv), 2)} M$).</p>`
    : `Every input is at its value in Chapter 8: NPV ${money(DES.npv)} M, DCFROR ${fmt(DES.irr * 100, 2)} %.`;
  const K = [['Fixed-capital investment', money(D.F / 1e6) + ' M', 'var(--navy)', (ST.HI ? 'Turton module method' : 'without heat integration') + ', CEPCI ' + fmt(cep, 1)], ['Annual revenue', money(full.R / 1e6) + ' M', 'var(--green)', 'full capacity, year ' + full.y],
   ['Cost of manufacturing', money(full.C / 1e6) + ' M/y', 'var(--orange)', 'COMd, Turton correlation'], ['Net present value', money(ind.npv) + ' M', 'var(--blue)', 'at ' + fmt(p.i * 100, 1) + ' %, ' + D.L + ' years of operation'],
   ['DCFROR', ind.irr === null ? '—' : fmt(ind.irr * 100, 2) + ' %', 'var(--gold)', 'discounted payback ' + (ind.dpb === null ? 'beyond the life' : fmt(ind.dpb, 2) + ' years')], ['ROROI / payback', fmt(D.roroi * 100, 2) + ' % · ' + fmt(D.pbp, 2) + ' y', 'var(--grey)', 'non-discounted']];
  $('ecK').innerHTML = K.map(([l, v, c, d]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:24px">${v}</div><div class="d">${d}</div></div>`).join('');
  let cu = 0, cd = 0; const cum = [], cdis = []; D.rows.forEach(r => { cu += r.cf; cd += r.cf / Math.pow(1 + p.i, r.y); cum.push([r.y, cu / 1e6]); cdis.push([r.y, cd / 1e6]); });
  const all = D.rows.map(r => r.cf / 1e6).concat(cum.map(c => c[1]), cdis.map(c => c[1]));
  plot('ecCF', {x: [-0.6, D.N + 0.6], y: [Math.floor(Math.min(...all) / 100) * 100, Math.ceil(Math.max(...all) / 100) * 100], xt: D.N > 26 ? 4 : 2, xl: 'Year', bars: D.rows.map(r => ({x: r.y, y: r.cf / 1e6, w: Math.max(5, 13 * 22 / D.N), c: r.cf < 0 ? 'var(--c-rs)' : 'var(--c-lb)'})),
    series: [{d: cum, c: 'var(--c-or)', dash: '6 4'}, {d: cdis, c: cssv('--navy'), w: 2.8}], tip: x => { const y = Math.max(0, Math.min(D.N, Math.round(x))), r = D.rows[y]; return `<b>Year ${y}</b><br>Cash flow ${fmt(r.cf / 1e6, 2)} M$${r.R ? `<br>Revenue ${fmt(r.R / 1e6, 1)} · COMd ${fmt(r.C / 1e6, 1)}` : ''}<br>Cumulative ${fmt(cum[y][1], 1)} · discounted ${fmt(cdis[y][1], 1)} M$`; }});
  const ir = []; for (let i = 0; i <= 0.2001; i += 0.005) ir.push([i * 100, npvAt(E0.cf, i) / 1e6]);
  plot('ecIR', {x: [0, 20], y: [Math.floor(Math.min(...ir.map(v => v[1])) / 200) * 200, Math.ceil(Math.max(...ir.map(v => v[1])) / 200) * 200], xt: 2, xl: 'Interest rate (%)', series: [{d: ir, c: cssv('--navy'), w: 2.8}],
    pts: [{x: p.i * 100, y: ind.npv, c: 'var(--c-or)'}].concat(ind.irr !== null ? [{x: ind.irr * 100, y: 0, c: 'var(--c-gr)'}] : []), tip: x => `<b>i = ${fmt(x, 1)} %</b><br>NPV ${fmt(interp(ir, x), 1)} M$`});
  // effect of time: NPV against the operating life for each construction period
  const TC = ['var(--c-gr)', cssv('--navy'), 'var(--c-or)', 'var(--c-rd)'], lines = [1, 2, 3, 4].map(b => { const d = []; for (let L = 10; L <= 30; L++) d.push([L, npvAt(cashflow(Object.assign({}, p, {build: b, life: L})), p.i) / 1e6]); return d; });
  const tv = lines.flat().map(q => q[1]);
  plot('ecTimeC', {x: [10, 30], y: [Math.floor(Math.min(...tv, 0) / 50) * 50, Math.ceil(Math.max(...tv) / 50) * 50], xt: 2, xl: 'Operating life (years)', series: lines.map((d, k) => ({d, c: TC[k], w: k + 1 === D.B ? 3 : 1.6, dash: k + 1 === D.B ? '' : '5 4'})),
    pts: [{x: D.L, y: ind.npv, c: 'var(--c-gr)'}], tip: x => { const L = Math.round(x); return `<b>${L} years of operation</b><br>` + lines.map((d, k) => `${k + 1}-year construction: ${fmt(interp(d, L), 1)} M$`).join('<br>'); }});
  $('ecTimeLg').innerHTML = [1, 2, 3, 4].map((b, k) => `<span><i class="sw ${b === D.B ? 'ln' : 'dash'}" style="${b === D.B ? 'background' : 'border-color'}:${TC[k]}"></i>${b}-year construction${b === 2 ? ' (report)' : ''}</span>`).join('') + '<span><i class="sw dot" style="background:var(--c-gr)"></i>Selected</span>';
  // bare-module costs as changed on the Capital tab and by the cost index
  const SC = {gas: 'var(--sec-gas)', syn: 'var(--sec-syn)', wgs: 'var(--sec-wgs)', pur: 'var(--sec-pur)', feed: 'var(--sec-feed)', hi: 'var(--red)'}, kx = cep / 840.9;
  const cb = CBM.map(([n, d, v, sec]) => { const k = EQX.some(e => e[0] === n) ? n : '*', m = 1 + (ST.EC.eq[k] || 0) / 100; return [n, d, v * m * kx, sec, m * kx]; }), top = Math.max(...cb.map(c => c[2])), tot = cb.reduce((a, c) => a + c[2], 0);
  const rest = cb.slice(13), rv = rest.reduce((a, c) => a + c[2], 0), tag = m => Math.abs(m - 1) > 1e-6 ? ` <small style="color:var(--hot)">${m > 1 ? '+' : '−'}${fmt(Math.abs(m - 1) * 100, 0)} %</small>` : '';
  $('cbm').innerHTML = cb.slice(0, 13).map(([n, d, v, sc, m]) => `<div class="bar" style="grid-template-columns:132px minmax(0,1fr) 104px" title="${d}"><span>${n}</span><div class="track"><i style="width:${v / top * 100}%;background:${SC[sc]}"></i></div><span>${fmt(v / 1e6, 2)} M$${tag(m)}</span></div>`).join('') +
    `<div class="bar" style="grid-template-columns:132px minmax(0,1fr) 104px"><span>Others (${rest.length})</span><div class="track"><i style="width:${rv / top * 100}%;background:var(--grey)"></i></div><span>${fmt(rv / 1e6, 2)} M$${tag(rest[0][4])}</span></div>
    <div class="lg"><span><i class="sw" style="background:var(--sec-gas)"></i>Gasification</span><span><i class="sw" style="background:var(--sec-wgs)"></i>Shift and H₂</span><span><i class="sw" style="background:var(--sec-syn)"></i>Synthesis</span><span><i class="sw" style="background:var(--sec-pur)"></i>Purification</span><span><i class="sw" style="background:var(--sec-feed)"></i>Feed</span></div>`;
  $('cbmTot').textContent = '∑CBM = ' + money(tot / 1e6) + ' M';
  const pr = full.parts, com = full.C; const parts = [['Raw materials (1.23 CRM)', 1.23 * pr.CRM * p.com_mult, 'var(--c-gr)'], ['Utilities (1.23 CUT)', 1.23 * pr.CUT * p.com_mult, 'var(--c-or)'], ['FCI-related (0.153 FCI)', pr.coefF * p.com_mult, cssv('--navy')], ['Operating labour (2.73 COL)', 2.73 * pr.COL * p.com_mult, 'var(--c-go)'], ['Waste treatment (1.23 CWT)', 1.23 * pr.CWT * p.com_mult, 'var(--c-gy)']].concat(p.land ? [['Land lease', p.land, 'var(--c-rs)']] : []);
  donut('comD', parts, [money(com / 1e6, 1) + ' M', 'COMd per year']); $('comTot').textContent = 'year ' + full.y + ', full capacity'; $('comLg').innerHTML = parts.map(([n, v, c]) => `<span><i class="sw" style="background:${c}"></i>${n}: ${fmt(v / 1e6, 2)} M$</span>`).join('');
  const base = ind.npv; const ev = mk => evaluate([0.4, 0.1, 0.9, 1], Object.assign(MKX(), mk)).npv; const m0 = MKX(); const pm = m0.p_meoh || 393, ph = m0.p_h2 || 2473, pw = m0.p_mpw ?? 80, ii = m0.i || 0.1;
  const T = [['Product prices', ev({p_meoh: pm * 1.2, p_h2: ph * 1.2}), ev({p_meoh: pm * 0.8, p_h2: ph * 0.8})], ['Cost of manufacturing', ev({com_mult: 0.8}), ev({com_mult: 1.2})], ['Fixed capital (FCI)', ev({fci_mult: (m0.fci_mult || 1) * 0.8}), ev({fci_mult: (m0.fci_mult || 1) * 1.2})],
 ['Interest rate', ev({i: ii * 0.8}), ev({i: ii * 1.2})], ['MPW price', ev({p_mpw: pw * (pw >= 0 ? 0.8 : 1.2)}), ev({p_mpw: pw * (pw >= 0 ? 1.2 : 0.8)})],
   ['Electricity tariff', ev({elec_mult: 0.8}), ev({elec_mult: 1.2})], ['Natural-gas price', ev({p_ng: (m0.p_ng || 2.5) * 0.8}), ev({p_ng: (m0.p_ng || 2.5) * 1.2})]].sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2]));
  const lo = Math.min(...T.map(t => Math.min(t[1], t[2])), base), hi = Math.max(...T.map(t => Math.max(t[1], t[2])), base); const svg = $('torn'), W = 520, ml = 150, mr = 16, X = v => ml + (v - lo) / (hi - lo) * (W - ml - mr), rh = 34;
  let g = ''; ticks(lo, hi).forEach(v => g += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="8" y2="${8 + rh * T.length}"/><text class="ax" x="${X(v)}" y="${26 + rh * T.length}" text-anchor="middle">${fmt(v)}</text>`);
  T.forEach(([n, a, b], k) => { const y = 12 + k * rh; g += `<text x="${ml - 8}" y="${y + 17}" text-anchor="end" style="font-size:14px;fill:var(--ink)">${n}</text><rect class="tb" data-t="<b>${n}</b><br>−20 %: ${fmt(Math.min(a, b) === a ? a : b, 1)} M$<br>+20 %: ${fmt(Math.min(a, b) === a ? b : a, 1)} M$" x="${Math.min(X(base), X(a))}" y="${y + 2}" width="${Math.abs(X(a) - X(base))}" height="22" fill="var(--c-gr)" rx="3"/><rect class="tb" data-t="<b>${n}</b>" x="${Math.min(X(base), X(b))}" y="${y + 2}" width="${Math.abs(X(b) - X(base))}" height="22" fill="var(--c-rd)" rx="3"/>`; });
  g += `<line x1="${X(base)}" x2="${X(base)}" y1="4" y2="${10 + rh * T.length}" stroke="var(--ink)" stroke-width="2"/><text x="${X(base)}" y="${44 + rh * T.length}" text-anchor="middle" style="font-size:13px;fill:var(--ink);font-weight:700">Base NPV ${fmt(base, 1)} M$</text>`;
  svg.innerHTML = g; bindTips(svg, '.tb');
  drawMC();
  const S = [['Fixed-capital investment', money(D.F, 2), 'Turton module method, CEPCI = ' + fmt(cep, 1)], ['Total capital investment', money(D.F + D.WC, 2), 'WC = ' + fmt(ST.EC.wc) + ' % of FCI'], ['Annual revenue', money(full.R, 2) + '/yr', `MeOH $${fmt(m0.p_meoh || 393, 2)}/t, H₂ $${fmt(m0.p_h2 || 2473, 2)}/t`],
   ['Cost of manufacturing', money(full.C, 2) + '/yr', 'Turton correlation (KSA)'], ['Gross margin', money(full.R - full.C, 2) + '/yr', 'Before depreciation and tax'], ['Average net profit', money(D.npavg, 2) + '/yr', 'After depreciation (' + DEPS.find(d => d[0] === ST.EC.dep)[1] + ') and ' + (p.tax === 0.025 ? 'zakat' : 'tax of ' + fmt(p.tax * 100, 1) + ' %')],
   ['Net present value', money(ind.npv * 1e6, 2), ind.npv > 0 ? 'NPV > 0 ✓' : 'NPV < 0'], ['DCFROR', ind.irr === null ? '—' : fmt(ind.irr * 100, 2) + ' %', ind.irr > p.i ? 'DCFROR > i ✓' : 'DCFROR < i'], ['Rate of return on investment', fmt(D.roroi * 100, 2) + ' %', D.roroi > p.i ? 'ROROI > i ✓' : 'ROROI < i'],
   ['Payback period', fmt(D.pbp, 2) + ' years', 'Non-discounted'], ['Discounted payback', ind.dpb === null ? 'beyond the life' : fmt(ind.dpb, 2) + ' years', 'From the start of operation']];
  $('ecSum').innerHTML = '<thead><tr><th>Item</th><th>Result</th><th>Method / criterion</th></tr></thead><tbody>' + S.map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td>${r[2]}</td></tr>`).join('') + '</tbody>';
}
function drawMC() {
  const mk = JSON.stringify(MKX()); if (MC && MCKEY !== mk) MC = null; 
  if (!MC && PAGE === 'economics') { setTimeout(() => { if (!MC) { MC = monteCarlo(4000, MKX(), 2026); MCKEY = JSON.stringify(MKX()); $('mcRun').textContent = 'New random sample'; drawMC(); } }, 120); }
  if (!MC) { $('mcH').innerHTML = `<text x="260" y="150" text-anchor="middle" style="font-size:16px;fill:var(--muted)">Running 4,000 trials…</text>`; $('mcK').innerHTML = ''; return; }
  const v = MC.v, lo = Math.floor(v[0] / 50) * 50, hi = Math.ceil(v[v.length - 1] / 50) * 50, nb = Math.round((hi - lo) / 25); const h = new Array(nb).fill(0); v.forEach(x => h[Math.min(nb - 1, Math.floor((x - lo) / 25))]++);
  plot('mcH', {x: [lo, hi], y: [0, Math.ceil(Math.max(...h) / 50) * 50], xt: 100, xl: 'NPV (million US$)', yl: 'Trials', bars: h.map((n, k) => ({x: lo + 25 * k + 12.5, y: n, w: 400 / nb, c: lo + 25 * k + 12.5 < 0 ? 'var(--c-rs)' : 'var(--c-gr)'})),
    vl: [{x: MC.mean, c: cssv('--navy'), w: 2.5}, {x: 0, c: cssv('--muted'), w: 1.2}], tip: x => { const k = Math.max(0, Math.min(nb - 1, Math.floor((x - lo) / 25))); return `<b>${fmt(lo + 25 * k)} to ${fmt(lo + 25 * k + 25)} M$</b><br>${h[k]} trials`; }});
  $('mcK').innerHTML = [['Mean NPV', fmt(MC.mean, 1) + ' M$', 'var(--navy)'], ['P(NPV > 0)', fmt(MC.p0 * 100, 1) + ' %', 'var(--green)'], ['P10 / P50 / P90', fmt(MC.p10, 0) + ' / ' + fmt(MC.p50m, 0) + ' / ' + fmt(MC.p90, 0) + ' M$', 'var(--orange)']].map(([l, v, c]) => `<div class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v" style="font-size:20px">${v}</div></div>`).join('');
}
$('mcRun').addEventListener('click', () => { const b = $('mcRun'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Running…'; setTimeout(() => { MC = monteCarlo(4000, MKX(), 20261 + Math.floor(Math.random() * 1e6)); MCKEY = JSON.stringify(MKX()); b.disabled = false; b.textContent = 'New random sample'; drawMC(); toast('Monte Carlo finished: 4,000 new random trials.'); }, 40); });
// the result of a scenario is shown where the eye already is: flash it, and bring it into view when it sits below the cards
function showResult() { const r = $('mkRes'); if (!r) return; r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
  const b = r.getBoundingClientRect(), top = innerWidth <= 1180 ? 76 : 12; if (b.top < top || b.top > innerHeight * 0.55) window.scrollTo({top: scrollY + b.top - top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }
// ===================================================================== MARKET
const H2SC = 2473 * 1.03;
const SCEN = [
 {id: 'base', c: 'base', name: 'Base case', src: 'Chapter 8', d: 'Prices of 2026: methanol $393/t, hydrogen $2,473/t, MPW $80/t.', mk: {}, rep: 105.04},
 {id: 'p5', c: 'market', name: 'Product prices +5 %', src: 'Section 8.3.1', d: 'Methanol $412.65/t and hydrogen $2,596.65/t.', mk: {p_meoh: 412.65, p_h2: 2596.65}, rep: 190.50},
 {id: 'm5', c: 'market', name: 'Product prices −5 %', src: 'Section 8.3.2', d: 'Methanol $373.35/t and hydrogen $2,349.35/t.', mk: {p_meoh: 373.35, p_h2: 2349.35}, rep: 19.50},
 {id: 'w60', c: 'market', name: 'MPW price −25 %', src: 'Section 8.3.3', d: 'Plastic waste bought at $60/t.', mk: {p_mpw: 60}, rep: 153.98},
 {id: 'w100', c: 'market', name: 'MPW price +25 %', src: 'Section 8.3.4', d: 'Plastic waste bought at $100/t.', mk: {p_mpw: 100}, rep: 56.08},
 {id: 'mild', c: 'crisis', name: 'Mild disruption', src: 'Table 8.27', d: 'Freight, fuel and insurance rise: methanol +5 %, logistics $25/t, FCI +3 %.', mk: {p_meoh: 393 * 1.05, logi: 25, fci_mult: 1.03}},
 {id: 'mod', c: 'crisis', name: 'Moderate disruption', src: 'Table 8.27', d: 'Hormuz restricted, Red Sea threatened: methanol +14 %, hydrogen +3 %, logistics $50/t, availability 95 %, FCI +5 %.', mk: {p_meoh: 393 * 1.14, p_h2: H2SC, logi: 50, op_factor: 0.95, fci_mult: 1.05}},
 {id: 'crisis', c: 'crisis', name: 'Gulf and Red Sea crisis 2026 (selected case)', sh: 'Gulf and Red Sea crisis 2026', src: 'Section 8.3.6', d: 'Methanol $480/t, hydrogen +3 %, methanol trucked to the Red Sea ports ($60/t), availability 95 %, FCI +5 %.', mk: {p_meoh: 480, p_h2: H2SC, logi: 60, op_factor: 0.95, fci_mult: 1.05}, rep: 74.11},
 {id: 'sev', c: 'crisis', name: 'Severe disruption (Hormuz closed, Houthi blockade of Saudi ports)', sh: 'Severe disruption', src: 'Table 8.27', d: 'Yemen and Red Sea: methanol +22 %, hydrogen +3 %, logistics $90/t, availability 90 %, FCI +10 %, for the whole project.', mk: {p_meoh: 393 * 1.22, p_h2: H2SC, logi: 90, op_factor: 0.90, fci_mult: 1.10}, rep: -84},
 {id: 'ext', c: 'crisis', name: 'Extreme disruption', src: 'Table 8.27', d: 'Prolonged closure of both corridors, attacks on Jubail: methanol +37 %, hydrogen +5 %, logistics $150/t, availability 80 %, FCI +15 %.', mk: {p_meoh: 393 * 1.37, p_h2: 2473 * 1.05, logi: 150, op_factor: 0.80, fci_mult: 1.15}},
 {id: 'rus', c: 'crisis', name: 'Energy shock of the Russia–Ukraine war type (2022)', sh: 'Russia–Ukraine energy shock', src: 'Methanex 2022; FCI assumed', d: 'Methanol at the 2022 average realised price of $397/t (Methanex), equipment cost +10 % (assumed); Saudi gas and power tariffs unchanged.', mk: {p_meoh: 397, fci_mult: 1.10}},
 {id: 'pre', c: 'market', name: 'Pre-war prices', src: 'Section 8.3.7', d: 'Methanol $360/t and hydrogen $2,250/t.', mk: {p_meoh: 360, p_h2: 2250}, rep: -45.0, repD: 1},
 {id: 'gate', c: 'policy', name: 'Landfill gate fee $70/t', src: 'Section 8.3.7', d: 'The plant is paid $70/t to take the plastic instead of paying $80/t.', mk: {p_mpw: -70}, rep: 472},
 {id: 'tax', c: 'policy', name: 'Income tax 20 % (foreign partner)', sh: 'Income tax 20 %', src: 'Section 8.3.7', d: '20 % income tax instead of the 2.5 % zakat.', mk: {tax: 0.20}, rep: 55.4, repD: 1}];
const SCC = {base: 'var(--navy)', market: 'var(--blue)', crisis: 'var(--red)', policy: 'var(--green)'};
const MS = [['pm', 'p_meoh', 393, v => v, v => v, 'Methanol price ($/t)', 300, 560, 0.01, v => fmt(v, 2)], ['ph', 'p_h2', 2473, v => v, v => v, 'Hydrogen price ($/t)', 2000, 2900, 0.01, v => fmt(v, 2)],
 ['pw', 'p_mpw', 80, v => v, v => v, 'MPW price ($/t; negative = gate fee)', -80, 130, 1, v => fmt(v)], ['lg', 'logi', 0, v => v, v => v, 'Export logistics ($/t of methanol)', 0, 160, 1, v => fmt(v)],
 ['av', 'op_factor', 1, v => v / 100, v => v * 100, 'Availability (% of 7,920 h)', 70, 101, 1, v => fmt(v) + ' %'], ['fc', 'fci_mult', 1, v => 1 + v / 100, v => (v - 1) * 100, 'Change of the FCI (%)', -15, 30, 1, v => (v > 0 ? '+' : '') + fmt(v) + ' %'],
 ['pe', 'p_elec', 0.23 / 3.75, v => v / 3.75, v => v * 3.75, 'Electricity (SAR/kWh)', 0.15, 0.35, 0.01, v => fmt(v, 2)], ['ng', 'p_ng', 2.5, v => v, v => v, 'Natural gas ($/MMBtu)', 1.5, 5, 0.05, v => fmt(v, 2)],
 ['ir', 'i', 0.10, v => v / 100, v => v * 100, 'Interest rate (%)', 6, 15, 0.5, v => fmt(v, 1) + ' %'], ['tx', 'tax', 0.025, v => v / 100, v => v * 100, 'Tax (%; zakat = 2.5)', 0, 25, 0.5, v => fmt(v, 1) + ' %']];
function buildMarket() {
  $('mkSliders').innerHTML = MS.map(([id, , dflt, , inv, l, mn, mx, st]) => `<div class="ctl"><label for="${id}">${l} <output id="o-${id}"></output></label><input id="${id}" type="range" min="${mn}" max="${mx}" step="${st}" value="${inv(dflt)}"></div>`).join('');
  MS.forEach(([id, k, , fwd]) => $(id).addEventListener('input', () => { ST.MK[k] = fwd(+$(id).value); ST.SCID = 'custom'; HICACHE = {}; render(); }));
  $$('#scFilt button').forEach(b => b.addEventListener('click', () => { ST.scf = b.dataset.k; $$('#scFilt button').forEach(x => x.classList.toggle('on', x === b)); rMarket(); }));
  $('riskT').innerHTML = '<thead><tr><th>Risk level</th><th>Description</th><th>Methanol price</th><th>H₂ price</th><th>Logistics ($/t)</th><th>Availability</th><th>FCI</th></tr></thead><tbody>' + RISK.map(r => `<tr><td><b>${r[0]}</b></td>${r.slice(1).map(c => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody>';
}
function rMarket() {
  MS.forEach(([id, , , , , , , , , f]) => { $('o-' + id).value = f(+$(id).value); });
  const pm = ST.MK.p_meoh || 393, ph = ST.MK.p_h2 || 2473; const xs = PRICES.map((p, k) => k);
  plot('prChart', {x: [-0.3, PRICES.length - 0.7], y: [300, 600], xt: xs, xf: v => PRICES[v] ? PRICES[v][0] : '', yt: 50, m: {l: 52, r: 56, t: 12, b: 40},
    series: [{d: PRICES.filter(p => p[1]).map((p) => [PRICES.indexOf(p), p[1]]), c: cssv('--navy'), w: 2.8}, {d: PRICES.filter(p => p[2]).map(p => [PRICES.indexOf(p), 300 + (p[2] - 2000) / 1000 * 300]), c: 'var(--c-gr)', w: 2.8}],
    hl: [{y: pm, c: 'var(--c-or)', dash: '6 5', w: 1.8}], pts: PRICES.filter(p => p[1]).map(p => ({x: PRICES.indexOf(p), y: p[1], c: cssv('--navy'), r: 5})).concat(PRICES.filter(p => p[2]).map(p => ({x: PRICES.indexOf(p), y: 300 + (p[2] - 2000) / 1000 * 300, c: 'var(--c-gr)', r: 5}))),
    texts: [2000, 2250, 2500, 2750, 3000].map(v => ({px: 520 - 50, py: 12 + (600 - (300 + (v - 2000) * 0.3)) / 300 * (300 - 52) + 4, t: fmt(v), a: 'start', fs: 12.5, c: 'var(--muted)'})),
    tip: x => { const k = Math.max(0, Math.min(PRICES.length - 1, Math.round(x))), p = PRICES[k]; return `<b>${p[0]}</b><br>Methanol ${p[1] ? '$' + fmt(p[1], 2) + '/t' : '—'}<br>Hydrogen ${p[2] ? '$' + fmt(p[2]) + '/t' : '—'}`; }});
  const p = E0.p; const mt = p.meoh_kgh * 7.92 * (ST.MK.op_factor || 1), ht = p.h2_kgh * 7.92 * (ST.MK.op_factor || 1); const rm = mt * (pm - (ST.MK.logi || 0)), rh = ht * ph;
  donut('revD', [['Methanol (net of logistics)', rm, cssv('--navy')], ['Hydrogen', rh, 'var(--c-gr)']], [money((rm + rh) / 1e6, 1) + ' M', 'revenue per year']); $('revTot').textContent = scenName();
  $('revLg').innerHTML = `<span><i class="sw" style="background:var(--navy)"></i>Methanol: ${fmt(mt, 0)} t/y × $${fmt(pm - (ST.MK.logi || 0), 2)}/t = ${fmt(rm / 1e6, 2)} M$</span><span><i class="sw" style="background:var(--c-gr)"></i>Hydrogen: ${fmt(ht, 0)} t/y × $${fmt(ph, 2)}/t = ${fmt(rh / 1e6, 2)} M$</span>`;
  $('cards').innerHTML = SCEN.filter(s => ST.scf === 'all' || s.c === ST.scf).map(s => { const n = evaluate([0.40, 0.10, 0.90, 1], SCMK(s.mk)).npv; const a = AIRES[s.id];
    return `<button class="sc${s.id === ST.SCID ? ' on' : ''}" style="--c:${SCC[s.c]}" data-id="${s.id}"><b>${s.name}</b><span class="src">${s.src}</span><div>${s.d}</div><div class="n">NPV, design point: <b style="display:inline">${money(n)} M</b>${a ? `<br>NPV, AI set point: <b style="display:inline">${money(a.e.npv)} M</b>` : ''}</div></button>`; }).join('');
  $$('#cards .sc').forEach(c => c.addEventListener('click', () => { const s = SCEN.find(z => z.id === c.dataset.id); ST.SCID = s.id; ST.MK = clone(s.mk); HICACHE = {}; syncInputs(); render(); showResult(); }));
  const s = SCEN.find(z => z.id === ST.SCID), e = E0, a = AIRES[ST.SCID];
  let h = `<p style="margin:0 0 8px"><b>${s ? s.name : 'Custom scenario'}</b>${s ? ' – ' + s.src : ''}</p><div class="tbl"><table><thead><tr><th>Indicator</th><th>Design point</th><th>AI set point</th></tr></thead><tbody>
   <tr><td>NPV at ${fmt((ST.MK.i || 0.10) * 100, 1)} % (million US$)</td><td>${fmt(e.npv, 2)}</td><td>${a ? fmt(a.e.npv, 2) : '—'}</td></tr><tr><td>DCFROR (%)</td><td>${e.irr === null ? '—' : fmt(e.irr * 100, 2)}</td><td>${a && a.e.irr !== null ? fmt(a.e.irr * 100, 2) : '—'}</td></tr>
   <tr><td>Discounted payback (years)</td><td>${e.dpb === null ? 'beyond life' : fmt(e.dpb, 2)}</td><td>${a ? (a.e.dpb === null ? 'beyond life' : fmt(a.e.dpb, 2)) : '—'}</td></tr><tr><td>Methanol (t/y)</td><td>${fmt(e.p.meoh_kgh * 7.92 * (ST.MK.op_factor || 1), 0)}</td><td>${a ? fmt(a.e.p.meoh_kgh * 7.92 * (ST.MK.op_factor || 1), 0) : '—'}</td></tr>`;
  if (s && s.rep !== undefined && ST.HI) h += `<tr><td>NPV in the report (million US$)</td><td colspan="2" class="okc">${fmt(s.rep, Math.abs(s.rep) >= 100 && Number.isInteger(s.rep) ? 0 : 2)}</td></tr>`;
  $('scenres').innerHTML = h + '</tbody></table></div>'; $('scnote').textContent = a ? 'AI set point: β = ' + a.x[0].toFixed(4) + ', φ = ' + a.x[1].toFixed(4) + ', ρ = ' + a.x[2].toFixed(4) + '.' : '';
  const svg = $('scchart'), W = 520, ml = 190, mr = 14, mT = 8, rh2 = 31; const vals = SCEN.map(z => [evaluate([0.40, 0.10, 0.90, 1], SCMK(z.mk)).npv, AIRES[z.id] ? AIRES[z.id].e.npv : null]);
  const all = vals.flat().filter(v => v !== null); const lo = Math.min(-250, ...all), hi = Math.max(500, ...all); const X = v => ml + (v - lo) / (hi - lo) * (W - ml - mr);
  let g = ''; for (let v = Math.ceil(lo / 100) * 100; v <= hi; v += 100) g += `<line x1="${X(v)}" x2="${X(v)}" y1="${mT}" y2="${mT + rh2 * SCEN.length}" stroke="${v === 0 ? 'var(--muted)' : 'var(--grid)'}"/><text class="ax" x="${X(v)}" y="${mT + rh2 * SCEN.length + 16}" text-anchor="middle">${v}</text>`;
  SCEN.forEach((z, k) => { const y = mT + k * rh2; const [n, aa] = vals[k]; g += `<text x="${ml - 7}" y="${y + 19}" text-anchor="end" style="font-size:14.5px;fill:var(--ink);font-weight:${z.id === ST.SCID ? 700 : 400}">${z.sh || z.name}</text>`;
    g += `<rect class="tb" data-t="<b>${z.sh || z.name}</b><br>Design point: ${fmt(n, 1)} M$${aa !== null ? '<br>AI set point: ' + fmt(aa, 1) + ' M$' : ''}" x="${Math.min(X(0), X(n))}" y="${y + 5}" width="${Math.abs(X(n) - X(0))}" height="${aa === null ? 21 : 10}" fill="var(--c-lb)" rx="2"/>`;
    if (aa !== null) g += `<rect x="${Math.min(X(0), X(aa))}" y="${y + 16}" width="${Math.abs(X(aa) - X(0))}" height="10" fill="${cssv('--navy')}" rx="2"/>`; });
  svg.innerHTML = g; bindTips(svg, '.tb');
}
$('scai').addEventListener('click', () => { const b = $('scai'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Searching…'; setTimeout(() => { const o = optimise(MKX(), {feed: 1}); AIRES[ST.SCID] = o; ST.X = o.x.slice(); ST.MODE = 'npv'; syncInputs(); b.disabled = false; b.textContent = 'AI set point for this scenario'; render(); toast('AI set point applied to the plant.'); }, 40); });
$('allai').addEventListener('click', () => { const b = $('allai'); b.disabled = true; let k = 0; const step = () => { if (k >= SCEN.length) { b.disabled = false; b.textContent = 'AI set point for every scenario'; rMarket(); toast('AI set points found for all 14 scenarios.'); return; }
  const z = SCEN[k]; AIRES[z.id] = optimise(SCMK(z.mk), {feed: 1}); k++; b.innerHTML = `<span class="spin"></span> ${k} / ${SCEN.length}`; setTimeout(step, 10); }; setTimeout(step, 10); });
// ===================================================================== MONITORING
const SIG = ['T19', 'TT-310', 'Steam flow', 'TC-310 output', 'Methanol', 'Recycle', 'Purge', 'F-101 level'];
const ACT = {1: 'Follow the opening of TV-310 on the trend display; plan the cleaning of E-104 at the next planned stop.', 2: 'Check the valve on site and call the instrument technician; keep the outlet temperature within its limits by adjusting the steam supply by hand.',
 3: 'Compare TT-310 with a portable reference thermometer; recalibrate or replace the transmitter.', 4: 'Check the clean syngas for catalyst poisons; follow the activity trend and plan the change of the R-103 catalyst.',
 5: 'Check the purge valve and its bypass for passing; isolate and repair, then repeat the AI search of Section 10.2.'};
let playT = null; function stopPlay() { if (playT) { clearInterval(playT); playT = null; } const b = $('play'); if (b) b.textContent = '▶ Play the fault from the start'; }
function buildFault() {
  $('t2l').textContent = '99 % limit = ' + fmt(FDD.T2lim, 2); $('ql').textContent = '99 % limit = ' + fmt(FDD.Qlim, 2);
  $('fbtns').innerHTML = Object.entries(FDD.faults).map(([k, v]) => `<button data-k="${k}">F${k} – ${v.name}</button>`).join('');
  $$('#fbtns button').forEach(b => b.addEventListener('click', () => { ST.FK = b.dataset.k; rFault(); }));
  $('ft').addEventListener('input', () => { ST.ft = +$('ft').value; rFault(); });
  $('play').addEventListener('click', () => { if (playT) { stopPlay(); return; } let t = 0; $('play').textContent = '■ Stop'; playT = setInterval(() => { ST.ft = t; $('ft').value = t; fillRange($('ft')); rFault(); t += 4; if (t > 598) stopPlay(); }, 40); });
}
function rFault() {
  $$('#fbtns button').forEach(b => b.classList.toggle('on', b.dataset.k === ST.FK));
  const f = FDD.faults[ST.FK], t = ST.ft; $('o-ft').value = fmt(t);
  const pts = arr => arr.slice(0, Math.floor(t / 2) + 1).map((v, i) => [i * 2, v]);
  plot('cT', {x: [0, 600], y: [0.1, 1000], logy: true, xt: 100, xl: 'Time (min)', yf: v => v >= 1 ? fmt(v) : v, hl: [{y: FDD.T2lim, c: 'var(--c-rd)', dash: '7 4'}], vl: [{x: 100, c: '#999', w: 1.5}], series: [{d: pts(f.T2), c: cssv('--navy'), w: 1.8}], tip: x => `<b>${fmt(x)} min</b><br>T² = ${fmt(f.T2[Math.min(f.T2.length - 1, Math.round(x / 2))], 2)}`});
  plot('cQ', {x: [0, 600], y: [0.01, 10000], logy: true, xt: 100, xl: 'Time (min)', yf: v => v >= 1 ? fmt(v) : v, hl: [{y: FDD.Qlim, c: 'var(--c-rd)', dash: '7 4'}], vl: [{x: 100, c: '#999', w: 1.5}], series: [{d: pts(f.Q), c: cssv('--navy'), w: 1.8}], tip: x => `<b>${fmt(x)} min</b><br>Q = ${fmt(f.Q[Math.min(f.Q.length - 1, Math.round(x / 2))], 3)}`});
  const first = 100 + Math.min(f.dT === null ? 1e9 : f.dT, f.dQ === null ? 1e9 : f.dQ); const al = $('falarm');
  if (t >= first) { al.className = 'alarm bad'; al.textContent = 'ALARM at ' + fmt(first) + ' min (' + fmt(first - 100) + ' min after the start of the fault)'; } else { al.className = 'alarm ok'; al.textContent = t < 100 ? 'Normal operation' : 'Fault developing – no alarm yet'; }
  $('fdChip').className = 'chip' + (t >= first ? ' bad' : t >= 100 ? ' warn' : ''); $('fdChip').innerHTML = `<i></i>${t >= first ? 'Alarm: F' + ST.FK + ' ' + f.name : t >= 100 ? 'Fault developing' : 'Normal operation'}`;
  $('finfo').innerHTML = `<div class="tbl"><table><thead><tr><th>Statistic</th><th>Detection delay</th></tr></thead><tbody><tr><td>T²</td><td>${f.dT === null ? '—' : f.dT + ' min'}</td></tr><tr><td>Q</td><td>${f.dQ === null ? '—' : f.dQ + ' min'}</td></tr></tbody></table></div>`;
  const show = t >= first; const W = 520, H = 290, ml = 40, mb = 50, mt = 10, mr = 8, bw = (W - ml - mr) / 8; const Y = v => mt + (80 - v) / 80 * (H - mt - mb);
  let g = ''; for (let v = 0; v <= 80; v += 20) g += `<line class="gl" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${ml - 5}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  f.c.forEach((c, j) => { const x = ml + j * bw; const cc = show ? c : 0; g += `<rect x="${x + 7}" y="${Y(cc)}" width="${bw - 14}" height="${Y(0) - Y(cc)}" fill="${c === Math.max(...f.c) ? 'var(--c-or)' : 'var(--c-bl)'}" rx="3" style="transition:all .4s"/>`;
    g += SIG[j].split(' ').map((w, q) => `<text class="ax" x="${x + bw / 2}" y="${H - mb + 17 + q * 14}" text-anchor="middle">${w}</text>`).join(''); });
  $('cC').innerHTML = g + (show ? '' : `<text x="${(W + ml) / 2}" y="${H / 2 - 10}" text-anchor="middle" style="font-size:15px;fill:var(--muted)">Shown after the alarm</text>`);
  const top = f.c.indexOf(Math.max(...f.c));
  faultTables();
  $('fact').innerHTML = show ? `<p><b>Diagnosis (k-NN):</b> F${ST.FK} – ${f.name}. Correct for ${fmt(f.acc, 1)} % of the test samples of this fault (overall ${fmt(FDD.acc, 1)} %).</p><p><b>Largest contribution:</b> ${SIG[top]} (${fmt(f.c[top], 0)} %).</p><div class="box or"><b>Operator action:</b> ${ACT[ST.FK]}</div>` : '<p>No alarm yet: the monitor checks the eight signals every minute.</p>';
}
const ACT_S = {1: 'Plan the cleaning of E-104', 2: 'Check the valve; control the steam by hand', 3: 'Recalibrate TT-310', 4: 'Check for poisons; plan the catalyst change', 5: 'Repair the purge valve; repeat the AI search'};
function faultTables() {
  $('ftab').innerHTML = '<thead><tr><th>Fault</th><th>T² delay</th><th>Q delay</th><th>First alarm</th><th>Main signal</th><th>Correct diagnosis</th><th>Action of the operators</th></tr></thead><tbody>' +
    Object.entries(FDD.faults).map(([k, f]) => { const m = f.c.indexOf(Math.max(...f.c)), first = Math.min(f.dT === null ? 1e9 : f.dT, f.dQ === null ? 1e9 : f.dQ);
      return `<tr data-k="${k}" class="${k === ST.FK ? 'on' : ''}"><td><b>F${k}</b> ${f.name}</td><td>${f.dT === null ? '—' : f.dT + ' min'}</td><td>${f.dQ === null ? '—' : f.dQ + ' min'}</td><td><b>${first} min</b></td><td>${SIG[m]} (${fmt(f.c[m])} %)</td><td>${fmt(f.acc, 1)} %</td><td>${ACT_S[k]}</td></tr>`; }).join('') + '</tbody>';
  $$('#ftab tbody tr').forEach(r => r.addEventListener('click', () => { stopPlay(); ST.FK = r.dataset.k; ST.ft = 598; $('ft').value = 598; fillRange($('ft')); rFault(); }));
  if (!$('fmod').innerHTML) $('fmod').innerHTML = '<tbody>' + [['Signals', SIG.join(', ')], ['Principal components', '4, explaining 92.7 % of the normal variation'], ['T² limit (99 %)', fmt(FDD.T2lim, 2)], ['Q limit (99 %)', fmt(FDD.Qlim, 2)],
    ['Sample time', '2 min; the fault starts at 100 min'], ['Alarm rule', 'three samples in a row above a limit'], ['Diagnosis', 'k-nearest neighbours, ' + fmt(FDD.acc, 1) + ' % correct'], ['False alarms', 'none in normal operation']].map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join('') + '</tbody>';
}
// ===================================================================== E-METHANOL
function buildEM() {
  $$('#etech button').forEach(b => b.addEventListener('click', () => { ST.em.tech = b.dataset.k; $$('#etech button').forEach(x => x.classList.toggle('on', x === b)); rEM(); }));
  $('ef').addEventListener('input', () => { ST.em.f = +$('ef').value; rEM(); }); $('ec').addEventListener('input', () => { ST.em.c = +$('ec').value; rEM(); });
}
function rEM() {
  const f = ST.em.f / 100, c = ST.em.c / 100; $('o-ef').value = fmt(f * 100) + ' %'; $('o-ec').value = fmt(c * 100, 2);
  const [cap, es] = ST.em.tech === 'today' ? [1000, 55] : [200, 45]; const o = emethanol(f, c, cap, es); const pm = ST.MK.p_meoh || 393;
  const K = [['e-methanol', fmt(o.meoh_t) + ' t/y', 'var(--green)'], ['Electrolyser', fmt(o.P_el_spec, 1) + ' MW', 'var(--blue)'], ['Net CO₂ avoided', fmt(o.co2_net) + ' t/y', 'var(--green)'], ['Carbon to product', fmt(o.eta_C, 2) + ' %', 'var(--navy)'],
   ['Water (net) / O₂', fmt((o.water_t - o.water_made_t) / 7920, 1) + ' m³/h · ' + fmt(o.o2_t / 1000, 0) + ' kt/y', 'var(--grey)'], ['Cost of e-methanol', f > 0 ? '$' + fmt(o.total, 0) + '/t' : '—', 'var(--orange)']];
  $('ekpis').innerHTML = K.map(([l, v, col]) => `<div class="kpi" style="--c:${col}"><div class="l">${l}</div><div class="v" style="font-size:21px">${v}</div></div>`).join('');
  const parts = [['Synthesis section', o.syn, cssv('--navy')], ['Electrolyser', o.elz, 'var(--c-bl)'], ['Electricity', o.elec, 'var(--c-lb)'], ['Natural gas', o.ng, 'var(--c-gy)']]; const ymax = Math.max(900, Math.ceil((Math.max(o.total || 0, pm) + 50) / 100) * 100);
  let y0 = 0; const bars = []; const svg = $('eC'), W = 520, H = 300, ml = 56, mb = 30, mt = 12, mr = 14, Y = v => mt + (ymax - v) / ymax * (H - mt - mb); let g = '';
  ticks(0, ymax, 100).forEach(v => g += `<line class="gl" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${ml - 7}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`);
  const bw = 140, bx = ml + (W - ml - mr - bw) / 2; if (f > 0) parts.forEach(([n, v, col]) => { g += `<rect class="tb" data-t="<b>${n}</b>: ${fmt(v, 0)} $/t" x="${bx}" y="${Y(y0 + v)}" width="${bw}" height="${Y(y0) - Y(y0 + v)}" fill="${col}"/>`; y0 += v; });
  g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(pm)}" y2="${Y(pm)}" stroke="var(--c-rd)" stroke-width="2" stroke-dasharray="7 4"/><text class="ax" x="${bx + bw / 2}" y="${H - 9}" text-anchor="middle">Selected case</text>`; svg.innerHTML = g; bindTips(svg, '.tb');
  $('eleg').innerHTML = parts.map(([n, v, col]) => `<span><i class="sw" style="background:${col}"></i>${n}: ${fmt(f > 0 ? v : 0, 0)} $/t</span>`).join('') + `<span><i class="sw dash" style="border-color:var(--c-rd)"></i>Methanol price: $${fmt(pm, 0)}/t</span>`;
  const ev = $('everd'); if (f <= 0) { ev.className = 'verdict'; ev.textContent = 'Move the first slider to size the extension.'; } else if (o.total <= pm) { ev.className = 'verdict ok'; ev.textContent = 'The e-methanol costs $' + fmt(o.total, 0) + '/t, $' + fmt(pm - o.total, 0) + '/t below the market price.'; }
  else { ev.className = 'verdict bad'; ev.textContent = 'The e-methanol costs $' + fmt(o.total, 0) + '/t, $' + fmt(o.total - pm, 0) + '/t above the market price at this electricity price.'; }
  const xs = []; for (let x = 0.5; x <= 7.001; x += 0.25) xs.push(x); const ff = Math.max(f, 0.05); const c1 = xs.map(x => [x, Math.min(900, emethanol(ff, x / 100, 1000, 55).total)]), c2 = xs.map(x => [x, Math.min(900, emethanol(ff, x / 100, 200, 45).total)]);
  plot('eL', {x: [0, 7], y: [0, 900], xt: 1, yt: 100, xl: 'Electricity price (US¢/kWh)', hl: [{y: pm, c: 'var(--c-rd)', dash: '7 4'}], series: [{d: c1, c: cssv('--navy'), w: 2.8}, {d: c2, c: 'var(--c-gr)', w: 2.8}], pts: f > 0 ? [{x: c * 100, y: Math.min(900, o.total), c: 'var(--c-or)', r: 7}] : [],
    tip: x => `<b>${fmt(x, 2)} US¢/kWh</b><br>Today: $${fmt(emethanol(ff, x / 100, 1000, 55).total, 0)}/t<br>2050: $${fmt(emethanol(ff, x / 100, 200, 45).total, 0)}/t`});
  $('eleg2').innerHTML = `<span><i class="sw ln" style="background:var(--navy)"></i>Today’s electrolyser</span><span><i class="sw ln" style="background:var(--c-gr)"></i>2050 electrolyser</span><span><i class="sw dash" style="border-color:var(--c-rd)"></i>Methanol market price</span><span><i class="sw dot" style="background:var(--c-or)"></i>Current case</span>`;
  const be = (cp, e) => { if (emethanol(ff, 0, cp, e).total > pm) return null; let lo = 0, hi = 0.3; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (emethanol(ff, m, cp, e).total > pm) hi = m; else lo = m; } return lo * 100; };
  const b1 = be(1000, 55), b2 = be(200, 45); $('ebe').textContent = 'Break-even electricity price at $' + fmt(pm, 0) + '/t of methanol: ' + (b1 === null ? 'none' : fmt(b1, 2) + ' US¢/kWh') + ' today and ' + (b2 === null ? 'none' : fmt(b2, 2) + ' US¢/kWh') + ' with the 2050 electrolyser.';
  // where the carbon of the plastic goes, today and with the extension
  const Cp = EM.CO + EM.CO2, Ce = EM.X * f * Cp, CM = 1049.12, Co = EM.C_in - CM - Cp, pc = v => v / EM.C_in * 100;
  const rowsC = [['Plant of Chapter 2', [[CM, 'Methanol (Stream 29)', cssv('--navy')], [0, 'e-Methanol', 'var(--c-gr)'], [Cp, 'Purge gas, CO + CO₂', 'var(--c-or)'], [Co, 'Other carbon', 'var(--c-gy)']]],
    ['With the extension (' + fmt(f * 100) + ' % of the purge)', [[CM, 'Methanol (Stream 29)', cssv('--navy')], [Ce, 'e-Methanol', 'var(--c-gr)'], [Cp - Ce, 'Purge gas, CO + CO₂', 'var(--c-or)'], [Co, 'Other carbon', 'var(--c-gy)']]]];
  { const W = 520, ml = 10, mr = 10, X = v => ml + v / 100 * (W - ml - mr); let g = ''; [0, 20, 40, 60, 80, 100].forEach(v => g += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="30" y2="250"/><text class="ax" x="${X(v)}" y="268" text-anchor="${v === 0 ? 'start' : v === 100 ? 'end' : 'middle'}">${v} %</text>`);
    rowsC.forEach(([lab, seg], k) => { const y = 44 + k * 110; let x0 = 0; g += `<text x="${ml}" y="${y - 10}" style="font-size:14px;font-weight:600;fill:var(--ink)">${lab}</text>`;
      seg.forEach(([v, n, col]) => { const w = pc(v); if (w <= 0) return; g += `<rect class="tb" data-t="<b>${n}</b>: ${fmt(v, 1)} kmol/h of C, ${fmt(w, 2)} %" x="${X(x0)}" y="${y}" width="${X(x0 + w) - X(x0)}" height="54" fill="${col}"/>`;
        if (w > 7) g += `<text x="${X(x0 + w / 2)}" y="${y + 33}" text-anchor="middle" style="font-size:14px;font-weight:700;fill:#fff;pointer-events:none">${fmt(w, 1)} %</text>`; x0 += w; });
      g += `<text x="${W - mr}" y="${y + 80}" text-anchor="end" style="font-size:13.5px;fill:var(--ink2)">Carbon to product: <tspan style="font-weight:700;fill:var(--ink)">${fmt(pc(CM + (k ? Ce : 0)), 2)} %</tspan></text>`; });
    $('eCarb').innerHTML = g; bindTips($('eCarb'), '.tb'); }
  $('eleg3').innerHTML = [['Methanol (Stream 29)', cssv('--navy')], ['e-Methanol', 'var(--c-gr)'], ['Purge gas, CO + CO₂', 'var(--c-or)'], ['Other carbon (CH₄, char)', 'var(--c-gy)']].map(([n, col]) => `<span><i class="sw" style="background:${col}"></i>${n}</span>`).join('');
  // phases of the extension and the extension at the selected share
  const sh = [10, 25, 50, 100]; if (!sh.includes(Math.round(f * 100)) && f > 0) sh.push(Math.round(f * 100)); sh.sort((a, b) => a - b);
  $('ephase').innerHTML = '<thead><tr><th>Share of the purge</th><th>e-Methanol (t/y)</th><th>Electrolyser (MW)</th><th>Net CO₂ avoided (t/y)</th><th>Carbon to product</th><th>Cost (US$/t)</th></tr></thead><tbody>' +
    sh.map(v => { const q = emethanol(v / 100, c, cap, es); return `<tr data-f="${v}" class="${v === Math.round(f * 100) ? 'on' : ''}"><td><b>${v} %</b></td><td>${fmt(q.meoh_t)}</td><td>${fmt(q.P_el_spec, 1)}</td><td>${fmt(q.co2_net)}</td><td>${fmt(q.eta_C, 2)} %</td><td>${fmt(q.total, 0)}</td></tr>`; }).join('') + '</tbody>';
  $$('#ephase tbody tr').forEach(r => r.addEventListener('click', () => { ST.em.f = +r.dataset.f; $('ef').value = ST.em.f; fillRange($('ef')); rEM(); }));
  $('eside').innerHTML = '<tbody>' + [['Hydrogen from the electrolyser', fmt(o.h2_t) + ' t/y'], ['Electrolyser power', fmt(o.P_el_spec, 1) + ' MW'], ['CO + CO₂ converted', fmt(EM.X * f * Cp, 1) + ' kmol/h'], ['Water, net', fmt((o.water_t - o.water_made_t) / 7920, 1) + ' m³/h'],
    ['Oxygen by-product', fmt(o.o2_t) + ' t/y'], ['Natural gas to replace the purge fuel', fmt(o.ng_MW, 1) + ' MW'], ['Cost: synthesis / electrolyser', f > 0 ? fmt(o.syn, 0) + ' / ' + fmt(o.elz, 0) + ' $/t' : '—'], ['Cost: electricity / gas', f > 0 ? fmt(o.elec, 0) + ' / ' + fmt(o.ng, 0) + ' $/t' : '—'],
    ['Methanol market price', '$' + fmt(pm, 0) + '/t']].map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join('') + '</tbody>';
}
// ===================================================================== VALIDATION
let AIVAL = null;
function rVal() {
  const H = [['Plant model', 'D-102 split, water-gas shift, plug-flow Sieverts membrane and synthesis loop with recycle (Chapters 2 and 3, Appendix H.1).'], ['Economics', 'Turton cost of manufacturing, MACRS-5 depreciation, zakat and 20-year discounted cash flow (Chapter 8, Appendix G).'],
   ['AI search', 'Seeded differential evolution: 24 candidates × 111 generations = 2,664 evaluations with the equipment limits of Section 10.2.'], ['Heat integration', 'Problem-table algorithm, composite and grand composite curves and Bath area target (Chapter 4, Section 4.4).'],
   ['Control', 'TC-310 loop of Table 6.13 integrated with a 0.0001 min step; ideal PID with the derivative filter of the Simulink models (N = 100, Appendix F).'], ['Monitoring', 'PCA model of eight signals with T², Q and k-NN diagnosis trained on 600 minutes per fault (Section 10.4).']];
  $('howCards').innerHTML = H.map(([h, t]) => `<div class="card lift"><h3 style="margin-bottom:6px"><span class="h">${h}</span></h3><p style="margin:0;color:var(--muted)">${t}</p></div>`).join('');
  const d = evaluate([0.4, 0.1, 0.9, 1], {}), nh = evaluate([0.4, 0.1, 0.9, 1], {hi: false}), Dd = econDetail(d.p);
  const rows = [['Methanol in Stream 29 (kmol/h)', '1,049.12', fmt(d.r.MeOH, 2)], ['Hydrogen product, Stream 16 (kmol/h)', '3,872.96', fmt(d.r.H2p, 2)], ['Reactor feed, Stream 20 (kmol/h)', '17,994.19', fmt(d.r.S20, 2)], ['Purge gas, Stream 25 (kmol/h)', '1,436.31', fmt(d.r.purge, 2)],
   ['Membrane area of ME-101 (m²)', '6,040', fmt(d.r.A, 1)], ['Methanol product (t/y)', '266,915', fmt(d.p.meoh_kgh * 7.92, 0)], ['Hydrogen product (t/y)', '61,831', fmt(d.p.h2_kgh * 7.92, 0)], ['Annual revenue ($/yr)', '257,806,461.97', fmt(Dd.full.R, 2)],
   ['COMd ($/yr)', '172,135,713.00', fmt(Dd.full.C, 2)], ['NPV, base case (million US$)', '105.04', fmt(d.npv, 2)], ['DCFROR, base case (%)', '12.80', fmt(d.irr * 100, 2)], ['Discounted payback (years)', '13.06', fmt(d.dpb, 2)], ['ROROI (%)', '10.87', fmt(Dd.roroi * 100, 2)],
   ['NPV without heat integration (million US$)', '22.226', fmt(nh.npv, 3)], ['DCFROR without heat integration (%)', '10.61', fmt(nh.irr * 100, 2)]];
  SCEN.filter(s => s.rep !== undefined && s.id !== 'base').forEach(s => rows.push(['NPV, ' + (s.sh || s.name) + ' (million US$)', fmt(s.rep, s.repD !== undefined ? s.repD : Number.isInteger(s.rep) && Math.abs(s.rep) >= 80 ? 0 : 2), fmt(evaluate([0.4, 0.1, 0.9, 1], s.mk).npv, 2)]));
  rows.push(['AI set point at $393/t, NPV (million US$)', '106.49 (Section 10.2)', AIVAL ? fmt(AIVAL, 2) : '…']);
  $('valtab').innerHTML = '<thead><tr><th>Quantity</th><th>Report</th><th>Twin</th></tr></thead><tbody>' + rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="okc">${r[2]}</td></tr>`).join('') + '</tbody>';
  if (AIVAL === null) setTimeout(() => { AIVAL = optimise({}, {feed: 1}).e.npv; if (PAGE === 'validation') rVal(); }, 200);
  const cc = simLoop({}), sp = simLoop({sp: 5, dist: 0}); const os = (Math.max(...sp.pts.map(p => p[1])) - 5) / 5 * 100; const t = (x, y) => [x, y];
  const rows2 = [['QH,min at ΔTmin = 10 °C (kW)', '25,927.58', fmt(P10.QH, 2)], ['QC,min at ΔTmin = 10 °C (kW)', '55,916.95', fmt(P10.QC, 2)], ['Pinch, hot / cold (°C)', '109.22 / 99.22', fmt(P10.Thot, 2) + ' / ' + fmt(P10.Tcold, 2)],
   ['Chilled water, Aspen convention (kW)', '3,480.56', fmt(P10.CHW, 2)], ['Area target, counter-current (m²)', '33,692 (Aspen)', fmt(A10, 0)], ['QH,min at ΔTmin = 20 °C (kW)', '30,317.36', fmt(pinchAnalysis(20).QH, 2)], ['QH,min at ΔTmin = 40 °C (kW)', '37,711.32', fmt(pinchAnalysis(40).QH, 2)],
   ['Gain margin of the Cohen–Coon PID (Kcu / Kc)', '6.0', fmt(routh().Kcu / 1.067, 2) + ' (Kcu = ' + fmt(routh().Kcu, 3) + ')'], ['Cohen–Coon PID: max. deviation (°C)', '3.93', fmt(cc.maxdev, 2)], ['Cohen–Coon PID: IAE (°C·min)', '3.28', fmt(cc.iae, 2)], ['Cohen–Coon PID: settling (min)', '2.19', fmt(cc.settle, 2)],
   ['Cohen–Coon PID: SP overshoot (%)', '13.3', fmt(os, 1)], ['Product prices ±20 %: NPV (million US$)', '−238 / 447', fmt(evaluate([0.4, 0.1, 0.9, 1], {p_meoh: 314.4, p_h2: 1978.4}).npv, 0) + ' / ' + fmt(evaluate([0.4, 0.1, 0.9, 1], {p_meoh: 471.6, p_h2: 2967.6}).npv, 0)],
   ['Monte Carlo (seed 2026): mean NPV / P(NPV > 0)', '15.2 M$ / 54.5 %', (() => { const m = monteCarlo(4000, {}, 2026); return fmt(m.mean, 1) + ' M$ / ' + fmt(m.p0 * 100, 1) + ' %'; })()],
   ['Monte Carlo: P10 / P50 / P90 (million US$)', '−163 / 13 / 190', (() => { const m = monteCarlo(4000, {}, 2026); return fmt(m.p10, 0) + ' / ' + fmt(m.p50m, 0) + ' / ' + fmt(m.p90, 0); })()],
   ['COM +20 % / FCI +20 %: NPV (million US$)', '−128 / −84', fmt(evaluate([0.4, 0.1, 0.9, 1], {com_mult: 1.2}).npv, 0) + ' / ' + fmt(evaluate([0.4, 0.1, 0.9, 1], {fci_mult: 1.2}).npv, 0)]];
  $('valtab2').innerHTML = '<thead><tr><th>Quantity</th><th>Report</th><th>Twin</th></tr></thead><tbody>' + rows2.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="okc">${r[2]}</td></tr>`).join('') + '</tbody>';
}
// ===================================================================== command palette
const PKW = {overview: 'home plant mass balance schedule', process: 'pfd flowsheet streams units data sheet', operations: 'ai optimiser set points beta phi rho feed profit safe', heat: 'pinch hen composite curves dtmin exchangers utility',
  control: 'loops pid tuning p&id isa response', economics: 'npv irr dcfror cash flow capital cost tornado monte carlo payback land equipment cepci life construction escalation depreciation salvage working capital', market: 'prices scenarios crisis methanol hydrogen', safety: 'pca fault diagnosis t2 q knn monitoring',
  emethanol: 'solar electrolysis co2 purge e-methanol', validation: 'report check chapters values'};
const CMDS = () => PAGES.map(p => ({t: TITLES[p], kw: PKW[p], k: 'page', f: () => go(p)})).concat([{t: 'Reset every page to the design point', k: 'action', f: () => resetPage('all')}, {t: 'Toggle heat integration', k: 'action', f: () => { ST.HI = !ST.HI; syncInputs(); HICACHE = {}; render(); toast('Heat integration ' + (ST.HI ? 'ON' : 'OFF')); }},
  {t: 'AI: maximum profit', k: 'action', f: () => { go('operations'); setTimeout(() => runMode('npv'), 300); }}, {t: 'AI: safe operation', k: 'action', f: () => { go('operations'); setTimeout(() => runMode('safe'), 300); }},
  {t: 'Crisis scenario 2026', k: 'scenario', f: () => { const s = SCEN.find(z => z.id === 'crisis'); ST.SCID = s.id; ST.MK = clone(s.mk); syncInputs(); go('market'); render(); }}, {t: 'Run the Monte Carlo simulation', k: 'action', f: () => { go('economics'); setTimeout(() => $('mcRun').click(), 300); }},
  {t: 'Light / dark theme', k: 'action', f: () => $('theme').click()}]).concat(Object.keys(UNITS).filter(k => !UNITS[k].alias).map(k => ({t: k + ' – ' + UNITS[k].n, k: 'unit', f: () => { go('process'); setTimeout(() => openUnit(k), 350); }})));
let palSel = 0; const esc = t => t.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
function openPal() { $('palette').classList.add('open'); $('pq').value = ''; palSel = 0; renderPal(); setTimeout(() => $('pq').focus(), 10); }
function closePal() { $('palette').classList.remove('open'); }
function renderPal() { const q = $('pq').value.toLowerCase(); const L = CMDS().filter(c => (c.t + ' ' + (c.kw || '')).toLowerCase().includes(q)).slice(0, 12); palSel = Math.max(0, Math.min(palSel, L.length - 1));
  $('pres').innerHTML = L.length ? L.map((c, i) => `<button class="${i === palSel ? 'on' : ''}" data-i="${i}">${c.t}<small>${c.k}</small></button>`).join('') : `<p class="pnone">Nothing matches “${esc(q)}”. Try a sheet name, a unit tag such as R-103, or a word such as NPV or pinch.</p>`; $$('#pres button').forEach(b => b.addEventListener('click', () => { closePal(); L[+b.dataset.i].f(); })); $('pres')._L = L; }
$('pal').addEventListener('click', openPal); $('pq').addEventListener('input', () => { palSel = 0; renderPal(); });
$('palette').addEventListener('click', e => { if (e.target.id === 'palette') closePal(); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPal(); }
  if (!$('palette').classList.contains('open')) { if (e.key === 'Escape') closeDrawer(); return; }
  if (e.key === 'Escape') closePal(); if (e.key === 'ArrowDown') { palSel++; renderPal(); e.preventDefault(); } if (e.key === 'ArrowUp') { palSel = Math.max(0, palSel - 1); renderPal(); e.preventDefault(); }
  if (e.key === 'Enter') { const L = $('pres')._L; if (L && L[palSel]) { closePal(); L[palSel].f(); } } });
// ===================================================================== return from the 3D presentation
// The state of the twin is kept for this tab when the presentation is opened, and restored when the viewer comes back.
function saveReturn() { try { sessionStorage.setItem('mpw-twin-return', JSON.stringify({ST, page: PAGE, y: scrollY, t: Date.now()})); } catch (e) {} }
document.addEventListener('click', e => { if (e.target.closest('a[href^="presentation"]')) saveReturn(); }, true);
addEventListener('pagehide', saveReturn);
function restoreReturn() {
  let r = null; try { r = JSON.parse(sessionStorage.getItem('mpw-twin-return') || 'null'); } catch (e) {}
  const nav = ((performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {}).type, back = /[?&]back=1/.test(location.search);
  if (back) history.replaceState(null, '', location.pathname + (r && r.page ? '#/' + r.page : location.hash));
  if (!r || !(back || nav === 'back_forward')) return null;
  const D = clone(DEF), R = r.ST || {}; ST = Object.assign(D, R, {EC: Object.assign(D.EC, R.EC || {}, {eq: Object.assign(D.EC.eq, (R.EC || {}).eq || {})}), em: Object.assign(D.em, R.em || {})}); return r;
}
const RET = restoreReturn();
// ===================================================================== start
buildOverview(); buildPFD(); buildMarket(); buildEcon(); buildFault(); buildEM(); buildLoopPick(); syncInputs();
show(RET ? RET.page : (location.hash.replace('#/', '') || 'overview')); if (RET) setTimeout(() => window.scrollTo(0, RET.y || 0), 120);
