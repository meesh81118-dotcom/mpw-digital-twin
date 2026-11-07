import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Kit, truck as truckK, liteOf} from './kit.js';
import {UNITS, SLIDES, SNAME, SDATA, SVC, TEAM} from './data.js';
import {INFO, HAZ, RISK} from './info.js';
import {makeLocalScene, PLOT} from './scene.js';
import {makeGlobe, llVec} from './globe.js';
import {makeGround} from './ground.js';
import {buildCutaways, LITE_FX} from './fx.js';
import {TRAINS} from './plant.js';

// ================================================================== basics
const $ = id => document.getElementById(id), $$ = s => [...document.querySelectorAll(s)];
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const ease = {smooth: t => t * t * t * (t * (t * 6 - 15) + 10), io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out: t => 1 - Math.pow(1 - t, 3), sine: t => -(Math.cos(Math.PI * t) - 1) / 2, lin: t => t};
const Q = new URLSearchParams(location.search), FAST = Q.has('fast') ? 0.02 : 1, LOW = Q.has('lo');
const canvas = $('c');
// ---- quality tier: 'lite' for weak GPUs (integrated graphics, old laptops, phones), chosen before the context is created
const GPU = (() => { try { const g = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { return ''; } })();
let saved = null; try { saved = localStorage.getItem('mpwQuality'); } catch (e) {}
const WEAK = /Intel|UHD|HD Graphics|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Basic Render|Radeon\(TM\) Graphics|Vega [0-9]/i.test(GPU) || (navigator.hardwareConcurrency || 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
let LITE = Q.get('q') === 'lite' || (Q.get('q') !== 'high' && (saved === 'lite' || (saved !== 'high' && WEAK)));
const renderer = new THREE.WebGLRenderer({canvas, antialias: !LITE, powerPreference: 'high-performance', stencil: false});
// render at CSS-pixel resolution at most; a governor lowers it further whenever frames get slower than ~50 fps
const DPR_MAX = Math.min(devicePixelRatio || 1, LITE ? 0.85 : 1), DPR_MIN = LITE ? 0.5 : 0.55; let DPR = LOW ? 0.75 : DPR_MAX; renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.localClippingEnabled = true;
// ---- time-based tweens (independent of the frame rate, so a slow frame never slows the motion)
const TW = [];
function tween(o, to, d = 1.6, e = ease.io, onUpdate) { for (const w of TW) if (w.o === o) for (const k in to) delete w.to[k];
  return new Promise(res => { const from = {}; for (const k in to) from[k] = o[k]; TW.push({o, from, to, d: Math.max(1, d * 1000 * FAST), t0: performance.now(), e, res, onUpdate}); }); }
function stepTweens(now) { for (let i = TW.length - 1; i >= 0; i--) { const w = TW[i], k = Math.min(1, (now - w.t0) / w.d), v = w.e(k); for (const key in w.to) w.o[key] = lerp(w.from[key], w.to[key], v); w.onUpdate && w.onUpdate(v, k); if (k >= 1) { TW.splice(i, 1); w.res(); } } }
const wait = s => new Promise(r => setTimeout(r, s * 1000 * FAST));
const app = {tween: (o, to, d, e) => tween(o, to, d, e), shadowDirty: 0};

// ================================================================== loading
const manager = new THREE.LoadingManager(); const tl = new THREE.TextureLoader(manager);
let loadedFrac = 0; manager.onProgress = (u, a, b) => { loadedFrac = a / b; $('lbar').firstElementChild.style.width = (10 + 70 * loadedFrac) + '%'; };
const labelsEl = $('labels');
const globe = makeGlobe(renderer, tl, PLOT, labelsEl);
const regionTex = tl.load('assets/region.jpg'); regionTex.colorSpace = THREE.SRGBColorSpace;
const fallbackTex = tl.load('assets/local_ground.jpg'); fallbackTex.colorSpace = THREE.SRGBColorSpace;
let L, P, CUT = {};                                         // local scene parts (built after the textures)
const lCam = () => L.cam;

// ================================================================== local camera (world frame; shots are given in the plant frame)
const LC = {tx: 0, ty: 0, tz: 0, dist: 300, az: 0, el: 30, shift: 0};
const UPV = new THREE.Vector3(0, 1, 0);
const toW = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(UPV, PLOT.rot);
const shotW = s => { const t = toW(s.x, s.y || 0, s.z); return {tx: t.x, ty: t.y, tz: t.z, dist: s.dist, az: s.az + PLOT.rot / D2R, el: s.el, shift: s.shift ?? 0}; };
const _off = new THREE.Vector3();
function applyLocal() { const c = L.cam, a = LC.az * D2R, e = LC.el * D2R;
  _off.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(LC.dist);
  c.position.set(LC.tx + _off.x, LC.ty + _off.y, LC.tz + _off.z); c.lookAt(LC.tx, LC.ty, LC.tz);
  c.near = clamp(LC.dist * 0.0025, 0.08, 60); c.far = Math.max(60000, LC.dist * 6); c.aspect = innerWidth / innerHeight;
  if (Math.abs(LC.shift) > 0.001) c.setViewOffset(innerWidth, innerHeight, -LC.shift * innerWidth, 0, innerWidth, innerHeight); else c.clearViewOffset(); c.updateProjectionMatrix();
  L.scene.fog.density = LC.dist > 3000 ? 0.000012 : lerp(0.00009, 0.000012, LC.dist / 3000); }
function syncFromCamera() { const c = L.cam, t = controls.target; _off.copy(c.position).sub(t); LC.tx = t.x; LC.ty = t.y; LC.tz = t.z; LC.dist = _off.length(); LC.el = Math.asin(clamp(_off.y / LC.dist, -1, 1)) / D2R; LC.az = Math.atan2(_off.x, _off.z) / D2R; }
// cinematic flight: log-distance interpolation, shortest azimuth, and a lift for long moves
let FLY = 0;
function flyTo(s, d = 2.2, e = ease.smooth) { const A = {...LC}, B = shotW(s); let da = ((B.az - A.az) % 360 + 540) % 360 - 180; B.az = A.az + da;
  const span = Math.hypot(B.tx - A.tx, B.tz - A.tz), lift = clamp(span / Math.max(A.dist, B.dist) - 0.6, 0, 0.9); const id = ++FLY; const st = {u: 0};
  return tween(st, {u: 1}, d, ease.lin, () => { if (id !== FLY) return; const v = e(st.u), arc = Math.sin(Math.PI * v) * lift;
    LC.tx = lerp(A.tx, B.tx, v); LC.ty = lerp(A.ty, B.ty, v); LC.tz = lerp(A.tz, B.tz, v); LC.dist = Math.exp(lerp(Math.log(A.dist), Math.log(B.dist), v)) * (1 + arc * 0.45);
    LC.az = lerp(A.az, B.az, v); LC.el = lerp(A.el, B.el, v) + arc * 6; LC.shift = lerp(A.shift, B.shift, v); }); }
function flyGlobe(to, d, e = ease.io) { const G = globe.GC, A = {...G}; let dl = ((to.lon - A.lon) % 360 + 540) % 360 - 180; const st = {u: 0}; const id = ++FLY;
  return tween(st, {u: 1}, d, ease.lin, () => { if (id !== FLY) return; const v = e(st.u); G.lat = lerp(A.lat, to.lat, v); G.lon = A.lon + dl * v; G.alt = Math.exp(lerp(Math.log(A.alt), Math.log(to.alt), v)); G.tilt = lerp(A.tilt, to.tilt, v); G.head = lerp(A.head, to.head, v); G.shift = lerp(A.shift, to.shift ?? 0, v); }); }

// ================================================================== shots (plant frame: x east, z south; az 0 = camera south of the target)
const SHOTS = {hero: {x: 8, y: 0, z: 18, dist: 215, az: -15, el: 30, shift: 0.11}, streams: {x: 10, y: 0, z: 22, dist: 280, az: -4, el: 54, shift: -0.06}, heat: {x: 0, y: 0, z: 18, dist: 260, az: -12, el: 46, shift: 0.1},
  control: {x: 15, y: 0, z: 14, dist: 250, az: 12, el: 48, shift: 0.12}, safety: {x: 128, y: 0, z: 46, dist: 290, az: 10, el: 60, shift: 0.12}, econ: {x: 0, y: 0, z: 0, dist: 470, az: 36, el: 38, shift: 0.12}, twin: {x: 0, y: 0, z: 0, dist: 340, az: -52, el: 26, shift: -0.05}};
const FOCUS = {'CR-101': {y: 2.8, dist: 15, az: 62, el: 16}, 'R-101': {y: 6.6, dist: 25, az: -62, el: 12}, 'CY-101': {y: 15.0, dist: 21, az: -96, el: 7}, 'R-102': {y: 8.5, dist: 24, az: -40, el: 10},
  'ME-101': {y: 4.0, dist: 8.5, az: 4, el: 10}, 'C-101': {y: 2.9, dist: 21, az: 8, el: 14}, 'R-103': {y: 10.6, dist: 19, az: -28, el: 6}, 'F-101': {y: 6.6, dist: 21, az: -50, el: 10}, 'T-101': {y: 21, dist: 54, az: -42, el: 4}};
function focusShot(id) { const f = FOCUS[id], c = CUT[id]; return {x: c.o.x, y: f.y, z: c.o.z, dist: f.dist, az: f.az, el: f.el, shift: innerWidth > 980 ? -0.02 : 0}; }

// ================================================================== labels: unit tags, stream tags, callouts, loop badges
const TAGNAME = {HALL: 'MPW hall', TANKS: 'Tank farm', FLARE: 'Flare', CTOWER: 'Utilities', CONTROL: 'Control room', ADMIN: 'Administration', SC: 'SC-1 / SC-2', WWT: 'Wastewater'};
const TAGS = {}, STAGS = {}, CALLS = [], LOOPS = []; let LABELS = true, ACTIVE_UNITS = [], ACTIVE_STREAMS = [], SHOW_ALL_STREAMS = false, SHOW_LOOPS = false;
function mkEl(cls, html, parent = labelsEl) { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; }
const _v = new THREE.Vector3();
function project(p, out) { _v.copy(p).project(L.cam); out.x = (_v.x + 1) / 2 * innerWidth; out.y = (1 - _v.y) / 2 * innerHeight; out.ok = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15; return out; }
const SP = {x: 0, y: 0, ok: false}; let REM = 16; const remSync = () => { REM = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; CALLS.forEach(c => c.w = 0); }; remSync(); addEventListener('resize', remSync);
function setT(o, x, y) { const t = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)${o.sfx || ''}`; if (o.t !== t) { o.el.style.transform = t; o.t = t; } }
function updateLabels() {
  const local = MODE === 'local' && !FADE.on, placed = [], RECTS = [];
  if (local) for (const e of [$('card').classList.contains('on') ? $('cardIn') : null, $('panel').classList.contains('on') ? $('panel') : null]) if (e) { const r = e.getBoundingClientRect(); if (r.right > 0 && r.left < innerWidth && r.width) RECTS.push(r); }
  const inView = (x, y) => x > 44 && x < innerWidth - 44 && y > 4.6 * REM && y < innerHeight - 5.6 * REM && !RECTS.some(r => x > r.left - 30 && x < r.right + 30 && y > r.top - 20 && y < r.bottom + 20);
  const fits = (x, y, w, h) => { for (const r of placed) if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) return false; placed.push([x, y, w, h]); return true; };
  // callouts (always shown while a cutaway is open): two columns beside the cutaway, sorted top to bottom so that the leader lines never cross,
  // kept clear of the story card, the data sheet and the bars
  const vis = []; for (const c of CALLS) { let v = local && c.cw.k > 0.65; if (v) { project(c.p, SP); v = SP.ok; if (v) { c.ax = SP.x; c.ay = SP.y; } }
    if (v !== c.on) { c.on = v; c.el.classList.toggle('on', v); c.w = 0; c.col = 0; } if (v) vis.push(c); }
  if (vis.length) { const W = innerWidth, top = 4.4 * REM, bot = innerHeight - 5.4 * REM, gap = 2.4 * REM, rects = [];
    rects.push(...RECTS);
    for (const c of vis) if (!c.w) { c.w = c.box.offsetWidth; c.h = c.box.offsetHeight; }
    let x0 = Infinity, x1 = -Infinity, mx = 0; for (const c of vis) { x0 = Math.min(x0, c.ax); x1 = Math.max(x1, c.ax); mx += c.ax / vis.length; }
    const L = [], R = []; for (const c of vis) { const want = c.ax < mx - 24 ? -1 : c.ax > mx + 24 ? 1 : (c.col || c.side); c.col = want; (want < 0 ? L : R).push(c); }
    { let rl = W - 10, ll = 10; for (const r of rects) if (r.height > innerHeight * 0.6) { if (r.left > W / 2) rl = Math.min(rl, r.left - 10); else ll = Math.max(ll, r.right + 10); }
      const rFree = rl - (x1 + gap), lFree = x0 - gap - ll;
      for (const c of [...R]) if (c.w > rFree && c.w <= lFree) { R.splice(R.indexOf(c), 1); L.push(c); c.col = -1; }
      for (const c of [...L]) if (c.w > lFree && c.w <= rFree) { L.splice(L.indexOf(c), 1); R.push(c); c.col = 1; } }
    while (Math.abs(L.length - R.length) > 2) { const from = L.length > R.length ? L : R, to = from === L ? R : L; from.sort((a, b) => from === L ? b.ax - a.ax : a.ax - b.ax); const c = from.shift(); c.col = -c.col; to.push(c); }
    const lay = (G, sd) => { G.sort((a, b) => a.ay - b.ay);
      for (const c of G) { let bx = sd < 0 ? x0 - gap - c.w : x1 + gap; bx = clamp(bx, 10, W - 10 - c.w);
        for (const r of rects) if (bx < r.right + 10 && bx + c.w > r.left - 10 && r.height > innerHeight * 0.6) bx = sd < 0 ? Math.max(bx, r.right + 10) : Math.min(bx, r.left - 10 - c.w);   // tall data sheet: stay beside it
        c.bx = bx; c.by = c.ay - c.h / 2; }
      let y = top; for (const c of G) { c.by = Math.max(c.by, y);   // downward pass, then keep clear of the story card
        for (const r of rects) if (r.height <= innerHeight * 0.6 && c.bx < r.right + 10 && c.bx + c.w > r.left - 10 && c.by < r.bottom + 10 && c.by + c.h > r.top - 10) { const sh = r.right + 10 - c.bx; if (sd < 0 && sh < gap - 6) c.bx += sh; else c.by = r.bottom + 10; }
        y = c.by + c.h + 8; }
      let yb = bot; for (let i = G.length - 1; i >= 0; i--) { const c = G[i]; if (c.by + c.h > yb) c.by = yb - c.h; yb = c.by - 8; }
      for (const c of G) { placed.push([c.bx, c.by, c.w, c.h]); setT(c, c.ax, c.ay);
        const dx = Math.round(c.bx - c.ax), dy = Math.round(c.by - c.ay), ex = sd > 0 ? dx : dx + c.w, ey = clamp(0, dy + 12, dy + c.h - 12);
        const bt = `translate3d(${dx}px,${dy}px,0)`; if (c.bt !== bt) { c.box.style.transform = bt; c.bt = bt; }
        const lt = `rotate(${Math.atan2(ey, ex).toFixed(3)}rad)`, lw = Math.round(Math.hypot(ex, ey)) + 'px'; if (c.lt !== lt) { c.ln.style.transform = lt; c.lt = lt; } if (c.lw !== lw) { c.ln.style.width = lw; c.lw = lw; } } };
    lay(L, -1); lay(R, 1); }
  for (const l of LOOPS) { let vis = local && SHOW_LOOPS; if (vis) { project(l.p, SP); vis = SP.ok; if (vis) { setT(l, SP.x, SP.y); placed.push([SP.x - 14, SP.y - 16, 240, 32]); } } if (vis !== l.on) { l.on = vis; l.el.classList.toggle('on', vis); } }
  const showAllTags = SLIDE && SLIDE.id === 'plant';
  for (const id in TAGS) { const t = TAGS[id]; let vis = local && LABELS && (ACTIVE_UNITS.includes(id) || id === HOVER || (showAllTags && t.major) || PV);
    if (vis) { project(t.p, SP); vis = SP.ok && inView(SP.x, SP.y - 1.4 * REM) && fits(SP.x - 3 * REM, SP.y - 3 * REM, 6 * REM, 1.9 * REM); if (vis) setT(t, SP.x, SP.y); }
    if (vis !== t.on) { t.on = vis; t.el.classList.toggle('on', vis); } const sel = id === FOCUSED; if (t.sel !== sel) { t.sel = sel; t.el.classList.toggle('sel', sel); } }
  for (const id in STAGS) { const s = STAGS[id]; let vis = local && LABELS && (SHOW_ALL_STREAMS || ACTIVE_STREAMS.includes(id));
    if (vis) { project(s.p, SP); vis = SP.ok && inView(SP.x, SP.y) && fits(SP.x - 1.1 * REM, SP.y - 1.1 * REM, 2.2 * REM, 2.2 * REM); if (vis) setT(s, SP.x, SP.y); }
    if (vis !== s.on) { s.on = vis; s.el.classList.toggle('on', vis); } }
  globe.updateLabels(MODE === 'globe' && !FADE.on);
}
function streamAnchor(pts) { let best = 0, bi = 1; for (let i = 1; i < pts.length; i++) { const L2 = pts[i].distanceTo(pts[i - 1]) * (Math.abs(pts[i].y - pts[i - 1].y) < 0.01 ? 1.4 : 0.6); if (L2 > best) { best = L2; bi = i; } }
  return pts[bi - 1].clone().lerp(pts[bi], 0.5); }

// ================================================================== stream flow overlays
const FLOWS = {}; const flowU = {uT: {value: 0}};
function flowMesh(id) { if (FLOWS[id] !== undefined) return FLOWS[id]; const s = P.streams[id]; if (!s || !s.pts || s.pts.length < 2) return (FLOWS[id] = null);
  const path = new THREE.CurvePath(); for (let i = 1; i < s.pts.length; i++) path.add(new THREE.LineCurve3(s.pts[i - 1], s.pts[i])); const len = path.getLength();
  const g = new THREE.TubeGeometry(path, Math.max(16, Math.round(len / 1.5)), (s.r || 0.3) * 1.32 + 0.05, 10, false);
  const col = new THREE.Color((SVC[s.svc] || SVC.syn)[0]);
  const m = new THREE.ShaderMaterial({uniforms: {uT: flowU.uT, uL: {value: len}, uC: {value: col}, uA: {value: 0}}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uT,uL,uA; uniform vec3 uC; varying vec2 vUv; void main(){ float d = fract(vUv.x * uL / 7.0 - uT * 0.9); float a = smoothstep(0.0, 0.25, d) * smoothstep(0.75, 0.3, d); gl_FragColor = vec4(uC * (0.35 + 1.2 * a), (0.18 + 0.7 * a) * uA); }`});
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; mesh.visible = false; P.root.add(mesh); return (FLOWS[id] = mesh); }
function setFlows(ids) { for (const id in P.streams) { const want = ids === 'all' || (ids || []).includes(id); const m = want ? flowMesh(id) : FLOWS[id]; if (!m) continue;
    if (want) { m.visible = true; tween(m.material.uniforms.uA, {value: 1}, 0.8); } else if (m.visible) tween(m.material.uniforms.uA, {value: 0}, 0.5).then(() => { if (m.material.uniforms.uA.value < 0.01) m.visible = false; }); } }

// ================================================================== highlight (hover, heat integration)
function tint(id, color, on) { const u = P.units[id]; if (!u) return; u.group.children.forEach(m => { if (!m.isMesh) return; const base = m.userData.orig || (m.userData.base = m.userData.base || m.material);
    if (on) { const key = 'hl' + color; m.userData[key] = m.userData[key] || (() => { const c = base.clone(); c.onBeforeCompile = base.onBeforeCompile; c.customProgramCacheKey = base.customProgramCacheKey; c.emissive = new THREE.Color(color); c.emissiveIntensity = color === 0xff3a1e ? 0.55 : 0.28; return c; })(); if (!m.userData.cut) m.material = m.userData[key]; }
    else if (!m.userData.cut) m.material = base; }); }

// ================================================================== panel
function cnt(el, v) { const s = String(v), m = s.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/); if (!m) { el.textContent = s; return; } const num = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length, t0 = performance.now();
  const f = t => { const k = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - k, 3); el.textContent = m[1] + (num * e).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec}) + m[3]; if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
// ---- equipment data sheet: header (tag plate, name, key figures), four tabs, footer navigation
const ICON = {
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 5 7 7-7 7"/></svg>',
  plant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 20h18M5 20V9l5 3V9l5 3V6h4v14"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3 5 6v6c0 4.2 3 7.4 7 9 4-1.6 7-4.8 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>'};
const GHS = {   // simple pictograms drawn for the hazard diamonds
  flam: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.6-8.3.6 1.7 1.6 2.8 2.7 3.3-.2-2.9.9-5.6 3-7.3-.1 2.5.8 4.4 2.1 6.2 1.1 1.5 1.6 3 1.6 4.6C18.5 18 16 21 12 21z" fill="#111"/>',
  liq: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.6-8.3.6 1.7 1.6 2.8 2.7 3.3-.2-2.9.9-5.6 3-7.3-.1 2.5.8 4.4 2.1 6.2 1.1 1.5 1.6 3 1.6 4.6C18.5 18 16 21 12 21z" fill="#111"/><path d="M3 22h18" stroke="#111" stroke-width="2"/>',
  toxic: '<circle cx="12" cy="9.5" r="6" fill="#111"/><rect x="8.6" y="13.5" width="6.8" height="4" rx="1" fill="#111"/><circle cx="9.6" cy="9.3" r="1.6" fill="#fff"/><circle cx="14.4" cy="9.3" r="1.6" fill="#fff"/><path d="M4 18.5l16 3M20 18.5l-16 3" stroke="#111" stroke-width="2" stroke-linecap="round"/>',
  hot: '<path d="M12 3a2.2 2.2 0 0 0-2.2 2.2v8.6a4.3 4.3 0 1 0 4.4 0V5.2A2.2 2.2 0 0 0 12 3z" fill="none" stroke="#111" stroke-width="2"/><circle cx="12" cy="17.4" r="2.4" fill="#111"/><path d="M12 9v8" stroke="#111" stroke-width="2.2"/>',
  press: '<circle cx="12" cy="13" r="8" fill="none" stroke="#111" stroke-width="2"/><path d="M12 13l4.5-4" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="13" r="1.6" fill="#111"/><path d="M8 3h8" stroke="#111" stroke-width="2"/>',
  vac: '<circle cx="12" cy="12" r="8" fill="none" stroke="#111" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="#111" stroke-width="2" transform="rotate(45 12 12)"/>',
  dust: '<circle cx="7" cy="8" r="1.8" fill="#111"/><circle cx="14" cy="6" r="1.4" fill="#111"/><circle cx="17.5" cy="12" r="2" fill="#111"/><circle cx="10" cy="14" r="2.4" fill="#111"/><circle cx="6" cy="18" r="1.4" fill="#111"/><circle cx="15" cy="18.5" r="1.6" fill="#111"/>',
  steam: '<path d="M7 20c-2-2 2-4 0-6s2-4 0-6M12 20c-2-2 2-4 0-6s2-4 0-6M17 20c-2-2 2-4 0-6s2-4 0-6" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>',
  mech: '<circle cx="12" cy="12" r="3" fill="#111"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M5.3 18.7l2.8-2.8M15.9 8.1l2.8-2.8" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>'};
const svcOf = n => { const st = P && P.streams[n]; return (SVC[st ? st.svc : 'syn'] || SVC.syn)[0]; };
const dia = (n, small) => `<span class="dia${small ? ' s' : ''}" style="--c:${svcOf(n)}"><span>${n}</span></span>`;
function streamVals(n) { const d = SDATA[n], v = [];
  if (d && d[0] != null) v.push(d[0].toLocaleString('en-US', {maximumFractionDigits: 2}) + ' °C');
  if (d && d[1] != null) v.push(d[1].toLocaleString('en-US', {maximumFractionDigits: 3}) + ' bar');
  if (d && d[2] != null) v.push(d[2].toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' kmol/h'); else if (+n <= 2) v.push('37,879 kg/h');
  return v; }
const vals = a => `<div class="vals">${a.map(x => `<span>${x}</span>`).join('')}</div>`;
const nozzle = n => typeof n === 'object' ? `<div class="noz"><div class="n"><span class="dia ps" style="--c:#8a99a8"><span>–</span></span></div><b>${n.t}</b>${vals(n.d.split(', '))}</div>`
  : `<div class="noz"><div class="n">${dia(n)}</div><b>${SNAME[n] || 'Stream ' + n}</b>${vals(streamVals(n))}</div>`;
const rows = r => `<dl>${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
let PTAB = 'over';
function tabBody(id, tab) { const u = UNITS[id], I = INFO[id] || {};
  if (tab === 'design') return rows(I.design || []);
  if (tab === 'op') { let h = '';
    if (I.op) h += `<h4>Operating conditions</h4>${rows(I.op)}`;
    if (I.ins && I.ins.length) h += `<h4>Inlet</h4>${I.ins.map(nozzle).join('')}`;
    if (I.outs && I.outs.length) h += `<h4>Outlet</h4>${I.outs.map(nozzle).join('')}`;
    if (I.loops) h += `<h4>Control</h4>${I.loops.map(([a, n, t]) => `<div class="isa"><div class="bub"><b>${a}</b><em>${n}</em></div><span>${t}</span></div>`).join('')}`;
    return h; }
  if (tab === 'safety') { let h = '';
    if (I.haz) h += `<div class="hz">${I.haz.map(k => `<div><div class="ghs"><svg viewBox="0 0 24 24">${GHS[k]}</svg></div>${HAZ[k][0]}</div>`).join('')}</div>`;
    if (I.risk) { const r = I.risk, src = typeof r.pha === 'number' ? `PHA scenario ${r.pha}` : `R-103 risk matrix, ${r.pha}`;
      h += `<div class="risk"><span>${src}: severity ${r.S}, likelihood ${r.L}</span><span class="chip" style="--c:${RISK[r.level]}">${r.level}</span>${r.after !== r.level ? `${ICON.arrow}<span class="chip" style="--c:${RISK.Marginal}">${r.after}</span>` : ''}</div>`; }
    if (I.fei) h += `<div class="fei"><div><b>${I.fei[0]}</b><span>Dow F&amp;EI</span></div><div><b>${I.fei[1]}</b><span>degree of hazard</span></div><div><b>${I.fei[2]}</b><span>radius of exposure</span></div></div>`;
    h += (I.safety || []).map(([t, w, g]) => `<div class="sp"><b>${t}</b><p>${w}</p><div class="g">${ICON.shield}<span>${g}</span></div></div>`).join('');
    return h; }
  return rows(u.data); }
function unitPanel(id, tab) { const u = UNITS[id]; if (!u) return; const I = INFO[id] || {}, list = (SLIDE && SLIDE.units) || [];
  const TABS = [['over', 'Overview'], ['design', 'Design'], ['op', 'Operation'], ['safety', 'Safety']].filter(([k]) => k === 'over' || (k === 'design' && I.design) || (k === 'op' && (I.op || I.ins || I.outs || I.loops)) || (k === 'safety' && I.safety));
  if (tab) PTAB = tab; const cur = TABS.some(t => t[0] === PTAB) ? PTAB : 'over';
  const tagM = u.name.match(/\b([A-Z]{1,3}-\d{3}R?)\b/), plate = tagM ? tagM[1] : TAGNAME[id] || id, title = tagM ? u.name.replace(tagM[0], '').replace(/\s{2,}/g, ' ').trim() : u.name;
  const P0 = $('panel'); P0.style.setProperty('--sec', u.col); P0.classList.toggle('compact', cur !== 'over');
  $('pBody').innerHTML = `<div class="ph"><div class="row"><span class="plate">${plate}</span><span class="secn">${u.sec}</span></div><h3>${title}</h3><p class="role">${u.role}</p>
    ${u.kpi ? `<div class="kp">${u.kpi.map(([v, s, l]) => `<div><b><span data-v="${v}">${v}</span>${s ? `<u>${s}</u>` : ''}</b><span class="l">${l}</span></div>`).join('')}</div>` : ''}
    ${TABS.length > 1 ? `<div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" data-t="${k}" class="${k === cur ? 'on' : ''}">${n}${k === 'safety' ? `<i>${(I.safety || []).length}</i>` : ''}</button>`).join('')}</div>` : ''}</div>
    <div class="pb" id="pTab">${tabBody(id, cur)}</div>
    <div class="pf">${list.length > 1 ? `<div class="chips">${list.map(k => `<button data-u="${k}" class="${k === id ? 'on' : ''}">${TAGNAME[k] || k}</button>`).join('')}</div>` : ''}
      <div class="nav"><button id="pBack">${ICON.plant}Plant view</button><button id="pNext" class="pri">Next slide${ICON.next}</button></div></div>`;
  $('pBody').querySelectorAll('[data-v]').forEach(s => cnt(s, s.dataset.v));
  $('pBody').querySelectorAll('.chips button').forEach(b => b.onclick = () => selectUnit(b.dataset.u));
  $('pBody').querySelectorAll('.tabs button').forEach(b => b.onclick = () => { PTAB = b.dataset.t; P0.classList.toggle('compact', PTAB !== 'over'); $('pBody').querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); const t = $('pTab'); t.innerHTML = tabBody(id, PTAB); t.scrollTop = 0; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; });
  $('pBack').onclick = plantView; $('pNext').onclick = () => go(IDX + 1);
  P0.classList.add('on'); }
function streamsPanel() { const ids = Object.keys(SNAME).map(Number); const P0 = $('panel'); P0.style.setProperty('--sec', '#e04a1b');
  $('pBody').innerHTML = `<div class="ph"><div class="row"><span class="plate">PFD</span><span class="secn">Heat-integrated flowsheet, Figure 4.18</span></div><h3>42 streams</h3>
    <div class="legend">${Object.entries(SVC).map(([k, [c, n]]) => `<span><i class="sw" style="background:${c}"></i>${n}</span>`).join('')}</div></div>
    <div class="pb"><div class="slist">${ids.map(n => { const d = SDATA[n]; return `<button data-s="${n}">${dia(n)}<span>${SNAME[n]}</span><em>${d && d[0] != null ? d[0].toLocaleString('en-US', {maximumFractionDigits: 0}) + ' °C' : ''}</em></button>`; }).join('')}</div></div>`;
  $('pBody').querySelectorAll('.slist button').forEach(tr => { tr.onclick = () => focusStream(tr.dataset.s); tr.onmouseenter = () => pulseStream(tr.dataset.s, true); tr.onmouseleave = () => pulseStream(tr.dataset.s, false); });
  P0.classList.add('on'); }
function pulseStream(id, on) { const m = flowMesh(id); if (!m) return; m.visible = true; m.material.uniforms.uA.value = on ? 2.2 : 1; }
function focusStream(id) { const s = P.streams[id]; if (!s || !s.pts) return; const b = new THREE.Box3().setFromPoints(s.pts), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  exitExplore(); flyTo({x: c.x, y: c.y * 0.5, z: c.z, dist: clamp(Math.max(sz.x, sz.z, sz.y * 1.5) * 1.6, 35, 260), az: LC.az - PLOT.rot / D2R, el: 42}, 1.8); pulseStream(id, true); setTimeout(() => pulseStream(id, false), 2600); }

// ================================================================== slides
let PV = false;   // plant view (whole plant from above): every unit tag shown
let MODE = 'globe', IDX = -1, SLIDE = null, BUSY = false, EXPLORE = false, FOCUSED = null, OPEN_CUT = null, HOVER = null, AUTO = null, STEP = 0, STEP_TIMER = null;
const FADE = {on: false, a: 0, other: 'globe'};
const CF = [0, -217.45, -454.68, -423.16, -376.59, -323.39, -275.03, -231.07, -191.1, -155.41, -123.2, -93.93, -67.31, -43.12, -21.12, -1.13, 17.05, 33.58, 48.6, 62.26, 74.68, 85.96, 105.04];
function kick(t) { if (!t) return ''; const p = t.split(' · '); return p.length > 1 ? `<div class="k"><span class="kn">${p[0]}</span><span>${p.slice(1).join(', ')}</span></div>` : `<div class="k"><span>${t}</span></div>`; }
function cardHTML(o, sl) { let h = sl.steps ? `${kick(sl.kicker)}<h1>${o.kicker}</h1>` : `${kick(o.kicker || sl.kicker)}<h1>${sl.title}</h1>`; if (o.text) h += `<p>${o.text}</p>`;
  if (o.bars) h += `<div class="bars">${o.bars.map(([n, v]) => `<div class="bar"><span>${n}</span><div class="t"><i data-w="${v / 10}"></i></div><b>${v}</b></div>`).join('')}</div>`;
  if (o.bars2) h += `<div style="margin-top:14px">${o.bars2.map(([n, a, b, u]) => `<div class="b2"><span>${n}</span><div class="tt"><i data-w="100"></i><s data-w="${b / a * 100}"></s></div><em>${a.toLocaleString('en-US')} → <b>${b.toLocaleString('en-US')}</b> ${u}</em></div>`).join('')}</div>`;
  if (o.stats) h += `<div class="stats">${o.stats.map(([v, u, l]) => `<div class="stat"><b><span data-c="${v}">${v}</span>${u ? `<u>${u}</u>` : ''}</b><span>${l}</span></div>`).join('')}</div>`;
  if (sl.id === 'econ') h += `<svg id="spark" viewBox="0 0 520 130"></svg>`;
  if (sl.team) h += `<div class="team"><span>Prepared by</span><b>${TEAM[0]}</b><b>${TEAM[1]}</b></div>`;
  if (sl.steps) h += `<div class="steps">${sl.steps.map((s, i) => `<i class="${i <= STEP ? 'on' : ''}"></i>`).join('')}</div>`;
  return h; }
function showCard(sl, o = sl) { const c = $('card'); c.classList.remove('on'); c.classList.toggle('globe', sl.cam === 'globe'); c.style.setProperty('--sec', sl.focus && UNITS[sl.focus] ? UNITS[sl.focus].col : '#e04a1b');
  setTimeout(() => { $('cardIn').innerHTML = cardHTML(o, sl); c.classList.add('on'); setTimeout(() => { $('cardIn').querySelectorAll('[data-w]').forEach(i => i.style.width = i.dataset.w + '%'); $('cardIn').querySelectorAll('[data-c]').forEach(s => cnt(s, s.dataset.c)); if (sl.id === 'econ') spark(); }, 120); }, 260 * FAST); }
function spark() { const s = $('spark'); if (!s) return; const X = i => 34 + i / 22 * 470, Y = v => 22 + (125 - v) / 600 * 84;
  s.innerHTML = `<line x1="34" x2="504" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--mut)" stroke-dasharray="4 4"/><path d="${CF.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}" fill="none" stroke="var(--pen)" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset 2.2s ease .3s"/>
    <circle cx="${X(22)}" cy="${Y(105.04)}" r="5" fill="var(--hot)"/><text x="${X(22) - 8}" y="${Y(105.04) - 9}" text-anchor="end" style="fill:var(--ink);font:800 18px Shoulders">NPV 105.04 M$</text>
    <text x="34" y="127" style="fill:var(--mut);font:500 13px Plex">Cumulative discounted cash flow, years 0–22 (M$)</text>`; requestAnimationFrame(() => s.querySelector('path').style.strokeDashoffset = 0); }
function navUI(i) { $$('#dots button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); }); $('num').innerHTML = `<b>${SLIDES[i].chap}</b><span>${String(i + 1).padStart(2, '0')} / ${SLIDES.length}</span>`; $('chap').textContent = SLIDES[i].chap; }
async function closeCut() { if (!OPEN_CUT) return; const c = OPEN_CUT; OPEN_CUT = null;  (c.meshes || []).forEach(m => m.userData.cut = false); await c.close(); }
async function openCut(id) { const c = CUT[id]; if (!c) return; OPEN_CUT = c;  (c.meshes || []).forEach(m => { if (m.userData.orig === undefined) m.userData.orig = null; }); const f = FOCUS[id]; c.open(f.az * D2R); (c.meshes || []).forEach(m => m.userData.cut = true); }
const GLOBE_INTRO = {lat: 18, lon: 34, alt: 21000, tilt: 0, head: 0, shift: 0.16}, GLOBE_END = {lat: 20, lon: 42, alt: 19000, tilt: 0, head: 0, shift: 0.16};
const BEATS = [{lat: 23.8, lon: 44.2, alt: 3700, tilt: 0, head: 0, shift: 0.13}, {lat: 25.8, lon: 49.0, alt: 1050, tilt: 26, head: -18, shift: 0.1}, {lat: PLOT.lat, lon: PLOT.lon, alt: 42, tilt: 34, head: -40, shift: 0.08}];
const BEAT_GEO = [['ksa', 'gulf', 'red', 'riyadh', 'yanbu', 'jubail'], ['east', 'gulf', 'jubail', 'dammam'], ['site', 'gulf']];
async function runBeats(from) { clearTimeout(STEP_TIMER); for (let b = from; b < 3; b++) { if (!SLIDE || SLIDE.id !== 'site') return; STEP = b; showCard(SLIDE, SLIDE.steps[b]); globe.showGeo(BEAT_GEO[b]);
    tween(globe.U.uKSA, {value: b <= 1 ? 1 : 0.4}, 1.2); tween(globe.U.uEast, {value: b === 1 ? 1 : b === 2 ? 0.25 : 0}, 1.2); tween(globe.CU.uClr, {value: 1}, 2);
    await flyGlobe(BEATS[b], b === 0 ? 3.0 : b === 1 ? 2.8 : 3.4, ease.io); if (!SLIDE || SLIDE.id !== 'site' || STEP !== b) return; if (b < 2) await wait(1.4); } }
// globe → local with a cross-fade at matching views
function localFromGlobe() { const G = globe.GC, k = Math.cos(PLOT.lat * D2R); const t = new THREE.Vector3((G.lon - PLOT.lon) * 111320 * k, 0, -(G.lat - PLOT.lat) * 110574);
  Object.assign(LC, {tx: t.x, ty: 0, tz: t.z, dist: G.alt * 1000, el: 90 - G.tilt, az: -G.head, shift: G.shift}); }
function globeFromLocal() { const k = Math.cos(PLOT.lat * D2R); Object.assign(globe.GC, {lat: PLOT.lat - LC.tz / 110574, lon: PLOT.lon + LC.tx / (111320 * k), alt: LC.dist / 1000, tilt: 90 - LC.el, head: -LC.az, shift: LC.shift}); }
async function crossTo(mode, dur = 0.9) { FADE.other = MODE; MODE = mode; FADE.on = true; FADE.a = 1; await tween(FADE, {a: 0}, dur, ease.sine); FADE.on = false; }

async function go(i, opts = {}) {
  if (i < 0 || i >= SLIDES.length || (BUSY && !opts.force)) return; const prev = SLIDE, sl = SLIDES[i]; BUSY = true; IDX = i; SLIDE = sl; STEP = 0;
  PV = false; navUI(i); exitExplore(); $('panel').classList.remove('on'); $('qr').classList.toggle('on', sl.id === 'twin'); if (FOCUSED) { FOCUSED = null; }
  ACTIVE_UNITS = sl.units || []; ACTIVE_STREAMS = sl.streams === 'all' ? [] : (sl.streams || []); SHOW_ALL_STREAMS = sl.streams === 'all'; SHOW_LOOPS = sl.id === 'control';
  try {
    if (sl.cam === 'globe') {
      if (MODE === 'local') { closeCut(); setFlows([]); await flyTo({x: 0, y: 0, z: 0, dist: 42000, az: -16, el: 56}, 2.8, ease.io); globeFromLocal(); await crossTo('globe', 0.9); }
      if (sl.id === 'site') { showCard(sl, sl.steps[0]); runBeats(0); }
      else { showCard(sl); globe.showGeo(sl.id === 'end' ? ['site'] : []); tween(globe.U.uKSA, {value: sl.id === 'end' ? 0.6 : 0}, 1.4); tween(globe.U.uEast, {value: 0}, 1.4); tween(globe.CU.uClr, {value: 0.35}, 2);
        tween(globe.SUNP, {lon: sl.id === 'end' ? -50 : 8}, sl.id === 'end' ? 6 : 2.5, ease.sine); await flyGlobe(sl.id === 'end' ? GLOBE_END : GLOBE_INTRO, prev ? (sl.id === 'end' ? 4.5 : 3.2) : 0.01); }
    } else {
      if (MODE === 'globe') { clearTimeout(STEP_TIMER); STEP = 3; if (!prev || prev.id !== 'site' || Math.abs(globe.GC.alt - BEATS[2].alt) > 2) await flyGlobe(BEATS[2], prev ? 2.6 : 0.01); localFromGlobe(); applyLocal(); crossTo('local', 0.9); }
      $('attr').classList.add('on');
      if (OPEN_CUT && OPEN_CUT.id !== sl.focus) closeCut();
      showCard(sl); setFlows(sl.streams || []); setHeat(sl.id === 'heat'); setSafety(sl.id === 'safety');
      if (sl.focus) { const d = prev && prev.cam === 'globe' ? 5 : 2.0; setTimeout(() => { if (SLIDE === sl) { FOCUSED = sl.focus; unitPanel(sl.focus); } }, d * 600 * FAST); await flyTo(focusShot(sl.focus), d); if (SLIDE === sl) openCut(sl.focus); }
      else { await flyTo(SHOTS[sl.shot], prev && prev.cam === 'globe' ? 5 : 2.2); if (sl.streams === 'all' && SLIDE === sl) streamsPanel(); }
    }
    if (sl.cam === 'globe') $('attr').classList.remove('on');
  } finally { BUSY = false; }
}
let heatOn = false; const HI_SET = ['E-101', 'E-102', 'E-103', 'E-104', 'E-105', 'E-106', 'E-107', 'T-101'];
function setHeat(on) { if (on === heatOn) return; heatOn = on; HI_SET.forEach(id => tint(id, 0xff3a1e, on)); }
let RINGS = []; function setSafety(on) { RINGS.forEach(r => tween(r.material, {opacity: on ? r.userData.op : 0}, 1)); }
function selectUnit(id) { if (!UNITS[id]) return; PV = false; exitExplore(); FOCUSED = id; unitPanel(id);
  if (CUT[id]) { if (OPEN_CUT && OPEN_CUT.id !== id) closeCut(); flyTo(focusShot(id), 1.9).then(() => { if (FOCUSED === id) openCut(id); }); return; }
  const u = P.units[id]; const b = (u.proxies && u.proxies[0]) || u.box, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  flyTo({x: c.x, y: Math.min(c.y, s.y * 0.45), z: c.z, dist: clamp(Math.max(s.x, s.z, s.y * 1.6) * 1.9, 28, 230), az: LC.az - PLOT.rot / D2R, el: 26, shift: innerWidth > 980 ? -0.06 : 0}, 2.2); }
function back() { FOCUSED = null; $('panel').classList.remove('on'); if (OPEN_CUT && (!SLIDE || OPEN_CUT.id !== SLIDE.focus)) closeCut(); if (SLIDE && SLIDE.cam === 'local') flyTo(SLIDE.focus ? focusShot(SLIDE.focus) : SHOTS[SLIDE.shot], 1.8); }

// ================================================================== input
let controls, ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), PROX = [], downAt = null, pmPending = null;
function exitExplore() { if (!EXPLORE) return; EXPLORE = false; controls.enabled = false; $('bExplore').classList.remove('on'); }
function enterExplore() { if (MODE !== 'local') return; EXPLORE = true; FLY++; controls.target.set(LC.tx, LC.ty, LC.tz); controls.enabled = true; $('bExplore').classList.add('on'); }
function pick(e) { if (MODE !== 'local' || FADE.on) return null; mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, L.cam); const h = ray.intersectObjects(PROX, false); return h.length ? h[0].object.userData.unit : null; }
canvas.addEventListener('pointermove', e => { pmPending = e; });
function hoverStep() { const e = pmPending; if (!e) return; pmPending = null; const id = pick(e);
  if (id !== HOVER) { HOVER = id; canvas.style.cursor = id ? 'pointer' : 'grab'; }
  const tip = $('tip'); if (id && UNITS[id]) { tip.innerHTML = `<b>${UNITS[id].name}</b><br><span class="m">${UNITS[id].sec}</span>`; tip.style.left = Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 10) + 'px'; tip.style.top = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 10) + 'px'; tip.style.opacity = 1; } else if (!tip.dataset.lock) tip.style.opacity = 0; }
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => { if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved < 6) { const id = pick(e); if (id) selectUnit(id); } });
// drag anywhere to orbit the plant at once (the orbit controls listen from this press on; a press without a drag stays a click)
canvas.addEventListener('pointerdown', e => { if (MODE !== 'local' || EXPLORE || BUSY || !controls) return; FLY++; controls.target.set(LC.tx, LC.ty, LC.tz); controls.enabled = true; const sx = e.clientX, sy = e.clientY;
  const mv = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) { canvas.removeEventListener('pointermove', mv); if (!EXPLORE) enterExplore(); } };
  canvas.addEventListener('pointermove', mv); addEventListener('pointerup', () => { canvas.removeEventListener('pointermove', mv); if (!EXPLORE) controls.enabled = false; }, {once: true}); });
canvas.addEventListener('wheel', () => { if (MODE === 'local' && !EXPLORE && !BUSY && controls) enterExplore(); }, {passive: true});
function toggleAuto() { if (AUTO) { clearInterval(AUTO); AUTO = null; } else AUTO = setInterval(() => { if (!BUSY && !EXPLORE) { if (IDX < SLIDES.length - 1) go(IDX + 1); else toggleAuto(); } }, 10000); $('bAuto').classList.toggle('on', !!AUTO); }
function nextStep(d) { if (SLIDE && SLIDE.id === 'site' && d > 0 && STEP < 2 && !BUSY) { STEP++; runBeats(STEP); return true; } return false; }
addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea')) return; const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown') { if (!nextStep(1)) go(IDX + 1); } else if (k === 'ArrowLeft' || k === 'PageUp') go(IDX - 1);
  else if (k === 'Escape') { if ($('menu').classList.contains('on')) toggleMenu(false); else back(); } else if (k === 'f' || k === 'F') toggleFull(); else if (k === 'e' || k === 'E') (EXPLORE ? exitExplore() : enterExplore());
  else if (k === 'l' || k === 'L') toggleLabels(); else if (k === 's' || k === 'S') toggleStreams(); else if (k === ' ') { e.preventDefault(); toggleAuto(); } else if (k === 'Home') go(0); else if (k === 'p' || k === 'P') plantView(); else if (k === 'm' || k === 'M') toggleMenu(); });
function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
function toggleLabels() { LABELS = !LABELS; $('bLabels').classList.toggle('on', LABELS); }
let STREAMS_ON = false; function toggleStreams() { STREAMS_ON = !STREAMS_ON; $('bStreams').classList.toggle('on', STREAMS_ON); SHOW_ALL_STREAMS = STREAMS_ON || (SLIDE && SLIDE.streams === 'all'); if (MODE === 'local') setFlows(STREAMS_ON ? 'all' : (SLIDE && SLIDE.streams) || []); }
function buildNav() { $('dots').innerHTML = SLIDES.map((s, i) => `<button data-t="${s.chap}" aria-label="${s.chap}"><i data-n="${String(i + 1).padStart(2, '0')}"></i></button>`).join(''); $$('#dots button').forEach((b, i) => b.onclick = () => go(i));
  $('next').onclick = () => { if (!nextStep(1)) go(IDX + 1); }; $('prev').onclick = () => go(IDX - 1); $('home').onclick = () => go(0);
  $('bFull').onclick = toggleFull; $('bQ').onclick = () => { try { localStorage.setItem('mpwQuality', LITE ? 'high' : 'lite'); } catch (e) {} const u = new URL(location.href); u.searchParams.set('q', LITE ? 'high' : 'lite'); location.href = u.toString(); }; $('bExplore').onclick = () => (EXPLORE ? exitExplore() : enterExplore()); $('bLabels').onclick = toggleLabels; $('bAuto').onclick = toggleAuto; $('bStreams').onclick = toggleStreams; $('pClose').onclick = back;
  $('bTop').onclick = plantView; $('bMenu').onclick = () => toggleMenu();
  $('menu').innerHTML = SLIDES.map((s, i) => `<button data-i="${i}"><i>${String(i + 1).padStart(2, '0')}</i><span>${s.chap}<small>${s.title.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/ · /g, ', ')}</small></span></button>`).join('') + `<div class="cr">© 2026 ${TEAM[0]} and ${TEAM[1]}. All rights reserved.</div>`;
  $$('#menu button').forEach(b => b.onclick = () => { toggleMenu(false); go(+b.dataset.i); });
  addEventListener('pointerdown', e => { if ($('menu').classList.contains('on') && !e.target.closest('#menu,#bMenu')) toggleMenu(false); }); }
function toggleMenu(on) { const m = $('menu'); on = on ?? !m.classList.contains('on'); m.classList.toggle('on', on); $('bMenu').classList.toggle('on', on);
  if (on) $$('#menu button').forEach(b => b.classList.toggle('on', +b.dataset.i === IDX)); }
// the whole plant from above, from any slide
const TOP_SHOT = {x: 13, y: 0, z: 14, dist: 225, az: 0, el: 70, shift: 0};
async function plantView() { if (BUSY) return; toggleMenu(false);
  if (MODE !== 'local') await go(SLIDES.findIndex(s => s.id === 'plant'));
  exitExplore(); FOCUSED = null; $('panel').classList.remove('on'); $('card').classList.remove('on'); if (OPEN_CUT) closeCut();
  PV = true; BUSY = true; try { await flyTo(TOP_SHOT, 2.0); } finally { BUSY = false; } }

// ================================================================== animated details
const ANIM = [];
function addDetails() {
  const U = P.units, M = L.M, T = L.T;
  // flare flame
  if (U.FLARE && U.FLARE.flame) { const f = U.FLARE.flame; const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: T.flame, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false})); sp.position.set(f.x, f.y + 3, f.z); sp.scale.set(6, 11, 1); P.root.add(sp);
    const pl = new THREE.PointLight(0xff8a3a, 900, 90, 2); pl.position.set(f.x, f.y + 3, f.z); P.root.add(pl); ANIM.push(t => { const k = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3); sp.scale.set(5.5 * k, 11 * (0.9 + 0.2 * Math.sin(t * 11)), 1); pl.intensity = 800 * k; }); }
  // cooling-tower fans and plumes
  if (U.CTOWER && U.CTOWER.fans) U.CTOWER.fans.forEach((f, i) => { const g = new THREE.Group(); g.position.set(f.x, f.y, f.z); for (let b = 0; b < 4; b++) { const m = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.08, 0.7), M.dark); m.rotation.y = b * Math.PI / 4; g.add(m); } P.root.add(g); ANIM.push(t => g.rotation.y = t * 3.4 + i);
    plume(f.x, f.y + 3, f.z, 1.1); });
  // trucks driving around the plot roads
  const kit = new Kit(); truckK(kit, 0, 0, 0, 'tanker'); const tg = kit.build(M); const kit2 = new Kit(); truckK(kit2, 0, 0, 0, 'box', 'blue'); const tg2 = kit2.build(M);
  const loop = [[-205, 143], [210, 143], [210, -146], [-205, -146]]; const perim = loop.map((p, i) => Math.hypot(loop[(i + 1) % 4][0] - p[0], loop[(i + 1) % 4][1] - p[1])), tot = perim.reduce((a, b) => a + b);
  [[tg, 0], [tg2, 0.5]].forEach(([g, ph]) => { P.root.add(g); g.traverse(o => { if (o.isMesh) o.matrixAutoUpdate = false; }); ANIM.push(t => { let d = ((t * 9 / tot + ph) % 1) * tot, i = 0; while (d > perim[i]) { d -= perim[i]; i++; } const a = loop[i], b = loop[(i + 1) % 4], k = d / perim[i];
      g.position.set(lerp(a[0], b[0], k), 0, lerp(a[1], b[1], k) + (i % 2 ? 0 : 2.6) * (i === 0 ? 1 : -1)); g.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); }); });
  // flakes riding the conveyor gallery to the feed bins
  { const path = P.N.convPath, n = 260, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) { c.set([0x2b74c9, 0xd23c2c, 0xf0f0f0, 0x2f9a52, 0xe0b030][i % 5]); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({size: 0.35, vertexColors: true})); pts.frustumCulled = false; P.root.add(pts);
    const segL = []; let tot2 = 0; for (let i = 1; i < path.length; i++) { segL.push(path[i].distanceTo(path[i - 1])); tot2 += segL[i - 1]; }
    ANIM.push(t => { for (let i = 0; i < n; i++) { let d = ((t * 2.2 / tot2 + i / n) % 1) * tot2, s = 0; while (d > segL[s]) { d -= segL[s]; s++; } const a = path[s], b = path[s + 1], k = d / segL[s]; pos[i * 3] = lerp(a.x, b.x, k) + ((i * 7) % 5 - 2) * 0.2; pos[i * 3 + 1] = lerp(a.y, b.y, k) + 1.15; pos[i * 3 + 2] = lerp(a.z, b.z, k) + ((i * 3) % 5 - 2) * 0.18; } g.attributes.position.needsUpdate = true; }); }
  // safety rings: R-103 radius of exposure 19 m, flare exclusion 16 m
  const ring = (x, z, r, col) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.35, r + 0.35, 96), new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0, depthWrite: false})); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.5, z); m.userData.op = 0.95; P.root.add(m);
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0, depthWrite: false})); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.45, z); d.userData.op = 0.18; P.root.add(d); RINGS.push(m, d); };
  if (U['R-103'] && U['R-103'].fei) ring(U['R-103'].fei.x, U['R-103'].fei.z, 19, 0xff4d3a); if (U.FLARE && U.FLARE.flame) ring(U.FLARE.flame.x, U.FLARE.flame.z, 16, 0xffb03a);
}
function plume(x, y, z, s) { const parts = []; for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: L.T.smoke, transparent: true, depthWrite: false, opacity: 0.35})); P.root.add(sp); parts.push({sp, o: i / 7}); }
  ANIM.push(t => parts.forEach(q => { const k = (t * 0.1 * s + q.o) % 1; q.sp.position.set(x + k * 10, y + k * 20, z + k * 4); const sc = (3 + k * 13) * s; q.sp.scale.set(sc, sc, 1); q.sp.material.opacity = 0.4 * Math.sin(k * Math.PI) * (1 - k * 0.3); })); }

// ================================================================== tags and proxies
function makeTags() {
  const U = P.units, major = ['HALL', 'CR-101', 'R-101', 'CY-101', 'D-102', 'R-102', 'ME-101', 'C-102', 'C-101', 'R-103', 'F-101', 'T-101', 'TANKS', 'FLARE', 'CONTROL', 'E-101', 'D-101'];
  for (const id in U) { const u = U[id]; if (u.hidden) continue; let b = u.box;
    const prox = []; if (id === 'R-101') TRAINS.forEach(x => prox.push(new THREE.Box3(new THREE.Vector3(x - 5, 0, -34), new THREE.Vector3(x + 6.5, 28, -2)))); else if (id === 'CY-101') TRAINS.forEach(x => prox.push(new THREE.Box3(new THREE.Vector3(x - 7, 6, 2.5), new THREE.Vector3(x + 7, 26, 9.5)))); else prox.push(b.clone());
    if (id === 'R-101') prox.forEach(p => { p.min.z = -10; p.max.z = -1.8; p.max.y = 14; p.min.x += 0.6; });
    u.proxies = prox; prox.forEach(bx => { const s = bx.getSize(new THREE.Vector3()), c = bx.getCenter(new THREE.Vector3()); const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z)); m.position.copy(c); m.visible = false; m.userData.unit = id; P.root.add(m); m.updateMatrixWorld(true); PROX.push(m); });
    if (!UNITS[id]) continue; const bb = prox[0], c = bb.getCenter(new THREE.Vector3()), p = toW(c.x, bb.max.y + 1.2, c.z);
    const el = mkEl('tag', `<div class="p"><i></i>${TAGNAME[id] || id}</div><div class="s"></div>`); el.style.setProperty('--c', UNITS[id].col); el.onclick = () => selectUnit(id);
    TAGS[id] = {el, p, on: false, major: major.includes(id), sfx: ' translate(-50%,-100%)'}; }
  for (const id in P.streams) { const s = P.streams[id]; if (!s.pts || !s.pts.length || !SNAME[id]) continue; const a = streamAnchor(s.pts), p = toW(a.x, a.y + 0.2, a.z), col = (SVC[s.svc] || SVC.syn)[0];
    const el = mkEl('st', `<b style="--c:${col}"><span>${id}</span></b>`); STAGS[id] = {el, p, on: false, sfx: ' translate(-50%,-50%)'};
    el.onmouseenter = e => { const d = SDATA[id]; const tip = $('tip'); tip.dataset.lock = 1; tip.innerHTML = `<b>Stream ${id}</b> – ${SNAME[id]}<br>${d && d[0] != null ? `T = ${d[0].toLocaleString('en-US')} °C` : ''}${d && d[1] != null ? ` · P = ${d[1]} bar` : ''}${d && d[2] != null ? `<br>F = ${d[2].toLocaleString('en-US')} kmol/h` : id <= 2 ? '<br>MPW = 37,879 kg/h' : ''}`;
      const r = el.getBoundingClientRect(); tip.style.left = (r.right + 8) + 'px'; tip.style.top = (r.top - 4) + 'px'; tip.style.opacity = 1; pulseStream(id, true); };
    el.onmouseleave = () => { const tip = $('tip'); delete tip.dataset.lock; tip.style.opacity = 0; pulseStream(id, false); }; el.onclick = () => focusStream(id); }
  // control-loop badges
  const loopAt = (tag, unit, d, tt, dy = 0) => { const u = P.units[unit]; if (!u) return; const b = u.proxies[0], c = b.getCenter(new THREE.Vector3()); const [lt, ln] = tag.split('-'), el = mkEl('loop', `<div class="bub"><b>${lt.split('/').pop()}</b><em>${ln}</em></div><div class="t"><b>${tag}</b><span>${d.replace(/ · /g, ', ')}</span></div>`); LOOPS.push({el, p: toW(c.x, b.max.y * 0.8 + 3 + dy, c.z), on: false, sfx: ' translate(-1.3rem,-50%)'}); };
  loopAt('TC-310', 'E-104', 'R-103 feed temperature · Cohen–Coon PID', 'TT'); loopAt('LC-318', 'F-101', 'Flash-drum level · P-only (averaging)', 'LT'); loopAt('PC-319', 'D-103', 'Loop pressure · PI on the purge', 'PT', 4);
  loopAt('FY/FC-106', 'D-101', 'Steam-to-MPW ratio 1.33 kg/kg', 'FT'); loopAt('PC-301', 'C-101', 'Suction pressure → compressor speed', 'PT'); loopAt('TC-202', 'E-103', 'Shift-feed temperature · syngas bypass', 'TT'); loopAt('PC-210', 'C-102', 'H₂ pressure → speed', 'PT');
  // callouts of the cutaways
  for (const id in CUT) CUT[id].callouts.forEach((c, i) => { const side = i % 2 ? -1 : 1, m = c.html.match(/^<b>(.*?)<\/b>(.*)$/), title = m ? m[1] : c.html, parts = m && m[2] ? m[2].split(' · ') : [];
    const body = parts.map(t => { const q = t.match(/^Stream (\d+)(.*)$/); return q ? `<span>${dia(q[1], 1)}${q[2].trim()}</span>` : `<span>${t}</span>`; }).join('');
    const el = mkEl('co', `<div class="ln"></div><div class="dt"></div><div class="box"><b>${title}</b>${body ? `<div class="vals">${body}</div>` : ''}</div>`); el.style.setProperty('--c', UNITS[id] ? UNITS[id].col : '#e04a1b');
    CALLS.push({el, box: el.querySelector('.box'), ln: el.querySelector('.ln'), p: c.p, cw: CUT[id], side, on: false, w: 0}); });
}

// ================================================================== render loop with adaptive resolution
let last = performance.now(), TT = 0, frames = 0, acc = 0, slowRuns = 0;
const fadeRT = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType}); const fadeQ = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({uniforms: {t: {value: fadeRT.texture}, a: {value: 0}}, transparent: true, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'uniform sampler2D t; uniform float a; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));
const fadeS = new THREE.Scene(); fadeS.add(fadeQ); const fadeC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function bench(n = 8) { const gl = renderer.getContext(), px = new Uint8Array(4); renderScene('local'); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t = performance.now(); for (let i = 0; i < n; i++) { renderScene('local'); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - t) / n; }
function renderScene(mode, target) { renderer.setRenderTarget(target || null);
  if (mode === 'globe') { renderer.toneMappingExposure = 1.0; renderer.autoClear = true; renderer.render(globe.scene, globe.cam); }
  else { renderer.toneMappingExposure = 0.86; renderer.autoClear = false; renderer.clear(); renderer.render(L.under, L.cam); renderer.clearDepth(); renderer.render(L.scene, L.cam); renderer.autoClear = true; }
  renderer.setRenderTarget(null); }
function applyLite() { L.scene.traverse(o => { if (!o.isMesh || !o.material || o.parent && o.parent.isPoints) return; if (o.userData.orig) o.userData.orig = liteOf(o.userData.orig); if (o.userData.base) o.userData.base = liteOf(o.userData.base); o.material = liteOf(o.material); o.castShadow = false; o.receiveShadow = false; });
  for (const id in CUT) CUT[id].group.traverse(o => { if (o.isPoints) o.geometry.setDrawRange(0, Math.ceil(o.geometry.attributes.position.count * 0.5)); });
  renderer.shadowMap.enabled = false; L.sun.castShadow = false; L.hemi.intensity = 1.05; L.sun.intensity = 2.5; L.scene.environment = null; DETAIL_FAR = 120; }
// compile every program (cut-open variants included) and upload every buffer before the tour starts
async function prewarmCuts() {
  for (const id in CUT) { const c = CUT[id]; c.mats.clear(); c.setBox(0); (c.meshes || []).forEach(m => { m.userData.orig = m.userData.orig || m.material; m.material = c.clipMaterial(m.userData.orig); }); c.group.visible = true; c.group.traverse(x => { if (x.isMesh && x.material && x.userData.clip !== false && !x.material.isPointsMaterial) { x.material.clippingPlanes = c.planes; x.material.clipIntersection = true; } }); }
  try { await renderer.compileAsync(L.scene, L.cam); } catch (e) { renderer.compile(L.scene, L.cam); }
  const fc = []; L.scene.traverse(o => { if (o.frustumCulled) { fc.push(o); o.frustumCulled = false; } }); renderScene('local'); fc.forEach(o => o.frustumCulled = true);
  for (const id in CUT) { const c = CUT[id]; (c.meshes || []).forEach(m => m.material = m.userData.orig); c.group.visible = false; } }
// far-away details (handrails, ladders, grating, bolts, wheels) are switched off for wide shots
let DETAIL = [], detailOn = true, DETAIL_FAR = 200; const DETAIL_MK = new Set(['yellow', 'grate', 'rubber', 'ssF']);          // handrails, gratings, flanges only: equipment never disappears
function lod() { const want = LC.dist < (detailOn ? DETAIL_FAR : DETAIL_FAR - 25) || EXPLORE && LC.dist < DETAIL_FAR * 1.3; if (want !== detailOn) { detailOn = want; DETAIL.forEach(m => m.visible = want); } }
// frame-rate governor: watches the real frame interval and trades resolution for smoothness
const GOV = {acc: 0, n: 0, t: 0, good: 0, ceil: DPR_MAX, last: 0};
const RATE = []; let REFRESH = 0;   // display refresh interval, measured on the first frames (a 30 Hz screen must not be mistaken for a slow GPU)
function governor(dt, now) { if (!REFRESH) { RATE.push(dt * 1000); if (RATE.length >= 90) { RATE.sort((a, b) => a - b); REFRESH = RATE[45]; GOV.hi = Math.max(19.5, REFRESH * 1.2); GOV.lo = REFRESH * 1.06; } return; }
  GOV.acc += dt; GOV.n++; if (now - GOV.t < 1000) return; const avg = GOV.acc / GOV.n * 1000; GOV.acc = 0; GOV.n = 0; GOV.t = now; if (document.hidden) return;
  if (avg > GOV.hi && DPR > DPR_MIN) { if (GOV.raised) GOV.ceil = Math.max(DPR_MIN, DPR - 0.05); GOV.raised = false; setDPR(DPR - (avg > GOV.hi * 1.4 ? 0.15 : 0.08)); GOV.good = 0; }
  else if (avg < GOV.lo) { if (++GOV.good >= 4 && DPR < GOV.ceil - 0.01) { setDPR(Math.min(GOV.ceil, DPR + 0.05)); GOV.raised = true; GOV.good = 0; } } else GOV.good = 0; }
function setDPR(v) { DPR = clamp(+v.toFixed(2), DPR_MIN, DPR_MAX); renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight); }
const LONG = []; function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000); last = now; const tf0 = performance.now(); TT += dt; stepTweens(now);
  if (MODE === 'globe' || (FADE.on && FADE.other === 'globe')) { if (IDX === 0 && !BUSY) globe.GC.lon += dt * 0.5; globe.tick(TT); }
  if (L && (MODE === 'local' || (FADE.on && FADE.other === 'local'))) { if (EXPLORE) { controls.update(); syncFromCamera(); const c = L.cam, nn = clamp(LC.dist * 0.0025, 0.08, 60); if (Math.abs(c.near - nn) > nn * 0.2) { c.near = nn; c.far = Math.max(60000, LC.dist * 6); c.updateProjectionMatrix(); } } else applyLocal(); lod(); flowU.uT.value = TT; ANIM.forEach(f => f(TT, dt)); for (const id in CUT) CUT[id].tick(TT, dt); hoverStep(); }
  if (FADE.on && FADE.a > 0.002) { const w = Math.floor(innerWidth * DPR * 0.5), h = Math.floor(innerHeight * DPR * 0.5); if (fadeRT.width !== w || fadeRT.height !== h) fadeRT.setSize(w, h);
    renderScene(FADE.other, fadeRT); renderScene(MODE); fadeQ.material.uniforms.a.value = FADE.a; renderer.toneMappingExposure = FADE.other === 'globe' ? 1.0 : 0.86; renderer.autoClear = false; renderer.render(fadeS, fadeC); renderer.autoClear = true; }
  else renderScene(MODE);
  updateLabels(); const tf = performance.now() - tf0; if (tf > 25) LONG.push([Math.round(now), Math.round(tf), MODE, FADE.on ? 'fade' : '', IDX]); if (LONG.length > 40) LONG.shift();
  if (!LOW) governor(dt, now);
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); globe.apply(); if (L) applyLocal(); });

// ================================================================== start-up
const status = t => { $('lst').textContent = t; };
async function init() {
  buildNav(); status('Loading the Earth…');
  await new Promise(r => { manager.onLoad = r; if (loadedFrac >= 1) r(); setTimeout(r, 25000); });
  status('Building the plant…'); await new Promise(r => setTimeout(r, 30));
  L = makeLocalScene(renderer, {shadow: 2048, sky: LOW ? 256 : 512}); P = L.P; app.scene = L.scene;
  controls = new OrbitControls(L.cam, canvas); controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.2; controls.rotateSpeed = 0.85; controls.zoomSpeed = 1.1; controls.panSpeed = 0.9; controls.maxPolarAngle = 1.48; controls.minDistance = 2.5; controls.maxDistance = 9000;
  LITE_FX.on = LITE; app.cutLight = new THREE.PointLight(0xfff1dc, 0, 40, 1.6); L.scene.add(app.cutLight); CUT = buildCutaways(app, P); addDetails(); makeTags();
  // the ground below the plot: one plane, bundled textures first, real imagery when it arrives
  { const fk = Math.cos(PLOT.lat * D2R), W0 = 49.4083, E0 = 49.7117, S0 = 26.8849, N0 = 27.1551; const lr = new THREE.Vector4((W0 - PLOT.lon) * 111320 * fk, (E0 - PLOT.lon) * 111320 * fk, -(N0 - PLOT.lat) * 110574, -(S0 - PLOT.lat) * 110574);
    const G = makeGround(L.under, renderer, PLOT.lat, PLOT.lon, regionTex, fallbackTex, lr); if (!Q.has('nosat')) G.done.then(r => { if (r.patch) globe.setPatch(r.patch.tex, r.patch.geo); }).catch(() => {}); }
  P.root.traverse(m => { if (m.isMesh && DETAIL_MK.has(m.userData.mk)) DETAIL.push(m); });
  app.camAz = () => (LC.az - PLOT.rot / D2R) * D2R;
  if (LITE) applyLite();
  // compile every program now so that no slide stalls on a shader compile later
  status('Preparing the shaders…'); await new Promise(r => setTimeout(r, 20));
  Object.assign(LC, shotW(SHOTS.hero)); applyLocal(); globe.apply();
  await prewarmCuts();
  // upload every buffer and texture now (one render with culling off), so nothing is uploaded mid-flight later
  renderScene('local');
  try { await renderer.compileAsync(globe.scene, globe.cam); } catch (e) { renderer.compile(globe.scene, globe.cam); }
  renderer.shadowMap.needsUpdate = true; renderScene('local'); renderScene('globe');
  // a quick start-up measure picks a safe first resolution for slow GPUs
  if (!LOW) { bench(3); let ms = Math.min(bench(5), bench(5)); window.__q = {ms, lite: LITE, gpu: GPU};
    if (!LITE && ms > 9 && Q.get('q') !== 'high') { status('Optimising for this computer…'); LITE = true; applyLite(); await prewarmCuts(); renderScene('local'); ms = Math.min(bench(5), bench(5)); window.__q.lite = ms; }
    if (ms > 12) setDPR(DPR * Math.sqrt(10 / ms)); }
  $('bQ').classList.toggle('on', LITE); document.body.classList.toggle('lite', LITE);
  { const w = Math.floor(innerWidth * DPR * 0.5), h = Math.floor(innerHeight * DPR * 0.5); fadeRT.setSize(w, h); renderScene('globe', fadeRT); renderScene('local'); fadeQ.material.uniforms.a.value = 0.5; renderer.autoClear = false; renderer.render(fadeS, fadeC); renderer.autoClear = true; }
  $('lbar').firstElementChild.style.width = '100%'; status('Ready'); $('start').classList.add('on');
  requestAnimationFrame(frame);
  const s0 = Q.get('s'); if (s0 !== null) { $('loader').classList.add('off'); go(+s0); }
}
$('start').onclick = () => { $('loader').classList.add('off'); go(0); };
init();
window.__app = {THREE, get P() { return P; }, get LITE() { return LITE; }, GPU, get REFRESH() { return REFRESH; }, LONG, CALLS, TAGS, bench, GOV, get DPR() { return DPR; }, frame: t => frame(t), render: renderScene, go, get IDX() { return IDX; }, get MODE() { return MODE; }, LC, globe, renderer, get L() { return L; }, get CUT() { return CUT; }, selectUnit, get BUSY() { return BUSY; }};
