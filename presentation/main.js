import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Kit, truck as truckK} from './kit.js';
import {UNITS, SLIDES, SNAME, SDATA, SVC} from './data.js';
import {makeLocalScene, PLOT} from './scene.js';
import {makeGlobe, llVec} from './globe.js';
import {makeGround} from './ground.js';
import {buildCutaways} from './fx.js';
import {TRAINS} from './plant.js';

// ================================================================== basics
const $ = id => document.getElementById(id), $$ = s => [...document.querySelectorAll(s)];
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const ease = {smooth: t => t * t * t * (t * (t * 6 - 15) + 10), io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out: t => 1 - Math.pow(1 - t, 3), sine: t => -(Math.cos(Math.PI * t) - 1) / 2, lin: t => t};
const Q = new URLSearchParams(location.search), FAST = Q.has('fast') ? 0.02 : 1, LOW = Q.has('lo');
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', stencil: false});
// render at CSS-pixel resolution at most; a governor lowers it further whenever frames get slower than ~50 fps
const DPR_MAX = Math.min(devicePixelRatio || 1, 1), DPR_MIN = 0.55; let DPR = LOW ? 0.75 : DPR_MAX; renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight);
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
  c.near = clamp(LC.dist * 0.0025, 0.15, 60); c.far = Math.max(60000, LC.dist * 6); c.aspect = innerWidth / innerHeight;
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
  control: {x: 18, y: 0, z: 40, dist: 180, az: 18, el: 38, shift: 0.1}, safety: {x: 34, y: 0, z: 50, dist: 150, az: 8, el: 58, shift: 0.1}, econ: {x: 0, y: 0, z: 0, dist: 470, az: 36, el: 38, shift: 0.12}, twin: {x: 0, y: 0, z: 0, dist: 340, az: -52, el: 26, shift: -0.05}};
const FOCUS = {'CR-101': {y: 2.8, dist: 15, az: 62, el: 16}, 'R-101': {y: 6.6, dist: 25, az: -32, el: 12}, 'CY-101': {y: 15.0, dist: 21, az: -90, el: 7}, 'R-102': {y: 8.5, dist: 23, az: 22, el: 10},
  'ME-101': {y: 4.0, dist: 7.2, az: 4, el: 6}, 'C-101': {y: 2.9, dist: 21, az: 180, el: 14}, 'R-103': {y: 10.6, dist: 19, az: -28, el: 6}, 'F-101': {y: 6.6, dist: 17, az: 40, el: 8}, 'T-101': {y: 21, dist: 54, az: -42, el: 4}};
function focusShot(id) { const f = FOCUS[id], c = CUT[id]; return {x: c.o.x, y: f.y, z: c.o.z, dist: f.dist, az: f.az, el: f.el, shift: innerWidth > 980 ? -0.02 : 0}; }

// ================================================================== labels: unit tags, stream tags, callouts, loop badges
const TAGNAME = {HALL: 'MPW hall', TANKS: 'Tank farm', FLARE: 'Flare', CTOWER: 'Utilities', CONTROL: 'Control room', ADMIN: 'Administration', SC: 'SC-1 / SC-2', WWT: 'Wastewater'};
const TAGS = {}, STAGS = {}, CALLS = [], LOOPS = []; let LABELS = true, ACTIVE_UNITS = [], ACTIVE_STREAMS = [], SHOW_ALL_STREAMS = false, SHOW_LOOPS = false;
function mkEl(cls, html, parent = labelsEl) { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; }
const _v = new THREE.Vector3();
function project(p, out) { _v.copy(p).project(L.cam); out.x = (_v.x + 1) / 2 * innerWidth; out.y = (1 - _v.y) / 2 * innerHeight; out.ok = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15; return out; }
const SP = {x: 0, y: 0, ok: false};
function setT(o, x, y) { const t = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`; if (o.t !== t) { o.el.style.transform = t; o.t = t; } }
function updateLabels() {
  const local = MODE === 'local' && !FADE.on, placed = [];
  const fits = (x, y, w, h) => { for (const r of placed) if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) return false; placed.push([x, y, w, h]); return true; };
  // callouts (always shown while a cutaway is open)
  for (const c of CALLS) { let vis = local && c.cw.k > 0.65; if (vis) { project(c.p, SP); vis = SP.ok; if (vis) { setT(c, SP.x, SP.y); placed.push([SP.x + (c.side > 0 ? 40 : -260), SP.y - 18, 220, 36]); } } if (vis !== c.on) { c.on = vis; c.el.classList.toggle('on', vis); } }
  for (const l of LOOPS) { let vis = local && SHOW_LOOPS; if (vis) { project(l.p, SP); vis = SP.ok; if (vis) { setT(l, SP.x, SP.y); placed.push([SP.x - 14, SP.y - 16, 240, 32]); } } if (vis !== l.on) { l.on = vis; l.el.classList.toggle('on', vis); } }
  const showAllTags = SLIDE && SLIDE.id === 'plant';
  for (const id in TAGS) { const t = TAGS[id]; let vis = local && LABELS && (ACTIVE_UNITS.includes(id) || id === HOVER || (showAllTags && t.major));
    if (vis) { project(t.p, SP); vis = SP.ok && fits(SP.x - 46, SP.y - 44, 92, 26); if (vis) setT(t, SP.x, SP.y); }
    if (vis !== t.on) { t.on = vis; t.el.classList.toggle('on', vis); } const sel = id === FOCUSED; if (t.sel !== sel) { t.sel = sel; t.el.classList.toggle('sel', sel); } }
  for (const id in STAGS) { const s = STAGS[id]; let vis = local && LABELS && (SHOW_ALL_STREAMS || ACTIVE_STREAMS.includes(id));
    if (vis) { project(s.p, SP); vis = SP.ok && fits(SP.x - 15, SP.y - 15, 30, 30); if (vis) setT(s, SP.x, SP.y); }
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
function unitPanel(id) { const u = UNITS[id]; if (!u) return; const list = (SLIDE && SLIDE.units) || [];
  $('pBody').innerHTML = `<div class="sec" style="color:${u.col}">${u.sec}</div><h3>${u.name}</h3><p class="role">${u.role}</p>
    ${list.length > 1 ? `<div class="chips">${list.map(k => `<button data-u="${k}" class="${k === id ? 'on' : ''}">${TAGNAME[k] || k}</button>`).join('')}</div>` : ''}
    ${u.kpi ? `<div class="kp">${u.kpi.map(([v, s, l]) => `<div><b><span data-v="${v}">${v}</span>${s ? `<u>${s}</u>` : ''}</b><span>${l}</span></div>`).join('')}</div>` : ''}
    <dl>${u.data.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="nav"><button id="pBack">${SLIDE && SLIDE.focus === id ? 'Plant overview' : '← Back'}</button><button id="pNext">Next →</button></div>`;
  $('pBody').querySelectorAll('[data-v]').forEach(s => cnt(s, s.dataset.v));
  $('pBody').querySelectorAll('.chips button').forEach(b => b.onclick = () => selectUnit(b.dataset.u));
  $('pBack').onclick = () => { if (SLIDE && SLIDE.focus === id) go(2); else back(); }; $('pNext').onclick = () => go(IDX + 1);
  $('panel').classList.add('on'); }
function streamsPanel() { const ids = Object.keys(SNAME).map(Number);
  $('pBody').innerHTML = `<div class="sec" style="color:#ffd29b">Heat-integrated PFD</div><h3>42 streams</h3>
    <p class="role">${Object.entries(SVC).map(([k, [c, n]]) => `<span style="white-space:nowrap;margin-right:10px"><i class="sw" style="background:${c}"></i>${n}</span>`).join(' ')}</p>
    <table>${ids.map(n => { const s = P.streams[n], d = SDATA[n], c = (SVC[s ? s.svc : 'syn'] || SVC.syn)[0]; return `<tr data-s="${n}"><td><i class="sw" style="background:${c}"></i>${n}</td><td>${SNAME[n]}</td><td style="text-align:right;color:#9fb0c1">${d && d[0] != null ? d[0].toFixed(0) + ' °C' : ''}</td></tr>`; }).join('')}</table>`;
  $('pBody').querySelectorAll('tr').forEach(tr => { tr.onclick = () => focusStream(tr.dataset.s); tr.onmouseenter = () => pulseStream(tr.dataset.s, true); tr.onmouseleave = () => pulseStream(tr.dataset.s, false); });
  $('panel').classList.add('on'); }
function pulseStream(id, on) { const m = flowMesh(id); if (!m) return; m.visible = true; m.material.uniforms.uA.value = on ? 2.2 : 1; }
function focusStream(id) { const s = P.streams[id]; if (!s || !s.pts) return; const b = new THREE.Box3().setFromPoints(s.pts), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  exitExplore(); flyTo({x: c.x, y: c.y * 0.5, z: c.z, dist: clamp(Math.max(sz.x, sz.z, sz.y * 1.5) * 1.6, 35, 260), az: LC.az - PLOT.rot / D2R, el: 42}, 1.8); pulseStream(id, true); setTimeout(() => pulseStream(id, false), 2600); }

// ================================================================== slides
let MODE = 'globe', IDX = -1, SLIDE = null, BUSY = false, EXPLORE = false, FOCUSED = null, OPEN_CUT = null, HOVER = null, AUTO = null, STEP = 0, STEP_TIMER = null;
const FADE = {on: false, a: 0, other: 'globe'};
const CF = [0, -217.45, -454.68, -423.16, -376.59, -323.39, -275.03, -231.07, -191.1, -155.41, -123.2, -93.93, -67.31, -43.12, -21.12, -1.13, 17.05, 33.58, 48.6, 62.26, 74.68, 85.96, 105.04];
function cardHTML(o, sl) { let h = sl.steps ? `<div class="k">${sl.kicker}</div><h1>${o.kicker}</h1>` : `<div class="k">${o.kicker || sl.kicker || ''}</div><h1>${sl.title}</h1>`; if (o.text) h += `<p>${o.text}</p>`;
  if (o.bars) h += `<div class="bars">${o.bars.map(([n, v]) => `<div class="bar"><span>${n}</span><div class="t"><i data-w="${v / 10}"></i></div><b>${v}</b></div>`).join('')}</div>`;
  if (o.bars2) h += `<div style="margin-top:14px">${o.bars2.map(([n, a, b, u]) => `<div class="b2"><span>${n}</span><div class="tt"><i data-w="100"></i><s data-w="${b / a * 100}"></s></div><em>${a.toLocaleString('en-US')} → <b style="color:#fff">${b.toLocaleString('en-US')}</b> ${u}</em></div>`).join('')}</div>`;
  if (o.stats) h += `<div class="stats">${o.stats.map(([v, u, l]) => `<div class="stat"><b><span data-c="${v}">${v}</span>${u ? `<u>${u}</u>` : ''}</b><span>${l}</span></div>`).join('')}</div>`;
  if (sl.id === 'econ') h += `<svg id="spark" viewBox="0 0 520 130"></svg>`;
  if (sl.steps) h += `<div class="steps">${sl.steps.map((s, i) => `<i class="${i <= STEP ? 'on' : ''}"></i>`).join('')}</div>`;
  return h; }
function showCard(sl, o = sl) { const c = $('card'); c.classList.remove('on'); c.classList.toggle('globe', sl.cam === 'globe');
  setTimeout(() => { $('cardIn').innerHTML = cardHTML(o, sl); c.classList.add('on'); setTimeout(() => { $('cardIn').querySelectorAll('[data-w]').forEach(i => i.style.width = i.dataset.w + '%'); $('cardIn').querySelectorAll('[data-c]').forEach(s => cnt(s, s.dataset.c)); if (sl.id === 'econ') spark(); }, 120); }, 260 * FAST); }
function spark() { const s = $('spark'); if (!s) return; const X = i => 34 + i / 22 * 470, Y = v => 22 + (125 - v) / 600 * 84;
  s.innerHTML = `<line x1="34" x2="504" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.3)" stroke-dasharray="4 4"/><path d="${CF.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}" fill="none" stroke="#f0a35e" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset 2.2s ease .3s"/>
    <circle cx="${X(22)}" cy="${Y(105.04)}" r="4.5" fill="#ffd29b"/><text x="${X(22) - 8}" y="${Y(105.04) - 9}" text-anchor="end" fill="#ffd29b" style="font:600 12px Inter">NPV 105.04 M$</text>
    <text x="34" y="126" fill="#9fb0c2" style="font:500 11px Inter">Cumulative discounted cash flow, years 0–22 (M$)</text>`; requestAnimationFrame(() => s.querySelector('path').style.strokeDashoffset = 0); }
function navUI(i) { $$('#dots button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); }); $('num').textContent = `${i + 1} / ${SLIDES.length}`; $('chap').textContent = SLIDES[i].chap; }
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
  navUI(i); exitExplore(); $('panel').classList.remove('on'); $('qr').classList.toggle('on', sl.id === 'twin'); if (FOCUSED) { FOCUSED = null; }
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
function selectUnit(id) { if (!UNITS[id]) return; exitExplore(); FOCUSED = id; unitPanel(id);
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
  if (id !== HOVER) { if (HOVER && !(heatOn && HI_SET.includes(HOVER))) tint(HOVER, 0, false); HOVER = id; if (id && !(heatOn && HI_SET.includes(id)) && !(OPEN_CUT && OPEN_CUT.id === id)) tint(id, 0xffa040, true); canvas.style.cursor = id ? 'pointer' : 'grab'; }
  const tip = $('tip'); if (id && UNITS[id]) { tip.innerHTML = `<b>${UNITS[id].name}</b><br><span style="color:#9fb0c1">${UNITS[id].sec}</span>`; tip.style.left = (e.clientX + 16) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; tip.style.opacity = 1; } else if (!tip.dataset.lock) tip.style.opacity = 0; }
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => { if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved < 6) { const id = pick(e); if (id) selectUnit(id); } });
canvas.addEventListener('pointerdown', e => { if (MODE === 'local' && !EXPLORE && !BUSY) { const sx = e.clientX, sy = e.clientY; const mv = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) { canvas.removeEventListener('pointermove', mv); if (!EXPLORE) { enterExplore(); } } }; canvas.addEventListener('pointermove', mv); canvas.addEventListener('pointerup', () => canvas.removeEventListener('pointermove', mv), {once: true}); } });
function toggleAuto() { if (AUTO) { clearInterval(AUTO); AUTO = null; } else AUTO = setInterval(() => { if (!BUSY && !EXPLORE) { if (IDX < SLIDES.length - 1) go(IDX + 1); else toggleAuto(); } }, 10000); $('bAuto').classList.toggle('on', !!AUTO); }
function nextStep(d) { if (SLIDE && SLIDE.id === 'site' && d > 0 && STEP < 2 && !BUSY) { STEP++; runBeats(STEP); return true; } return false; }
addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea')) return; const k = e.key;
  if (k === 'ArrowRight' || k === 'PageDown') { if (!nextStep(1)) go(IDX + 1); } else if (k === 'ArrowLeft' || k === 'PageUp') go(IDX - 1);
  else if (k === 'Escape') back(); else if (k === 'f' || k === 'F') toggleFull(); else if (k === 'e' || k === 'E') (EXPLORE ? exitExplore() : enterExplore());
  else if (k === 'l' || k === 'L') toggleLabels(); else if (k === 's' || k === 'S') toggleStreams(); else if (k === ' ') { e.preventDefault(); toggleAuto(); } else if (k === 'Home') go(0); });
function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
function toggleLabels() { LABELS = !LABELS; $('bLabels').classList.toggle('on', LABELS); }
let STREAMS_ON = false; function toggleStreams() { STREAMS_ON = !STREAMS_ON; $('bStreams').classList.toggle('on', STREAMS_ON); SHOW_ALL_STREAMS = STREAMS_ON || (SLIDE && SLIDE.streams === 'all'); if (MODE === 'local') setFlows(STREAMS_ON ? 'all' : (SLIDE && SLIDE.streams) || []); }
function buildNav() { $('dots').innerHTML = SLIDES.map((s, i) => `<button data-t="${s.chap}" title="${s.chap}"></button>`).join(''); $$('#dots button').forEach((b, i) => b.onclick = () => go(i));
  $('next').onclick = () => { if (!nextStep(1)) go(IDX + 1); }; $('prev').onclick = () => go(IDX - 1); $('home').onclick = () => go(0);
  $('bFull').onclick = toggleFull; $('bExplore').onclick = () => (EXPLORE ? exitExplore() : enterExplore()); $('bLabels').onclick = toggleLabels; $('bAuto').onclick = toggleAuto; $('bStreams').onclick = toggleStreams; $('pClose').onclick = back; }

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
    const prox = []; if (id === 'R-101') TRAINS.forEach(x => prox.push(new THREE.Box3(new THREE.Vector3(x - 5, 0, -34), new THREE.Vector3(x + 6.5, 28, -2)))); else if (id === 'CY-101') TRAINS.forEach(x => prox.push(new THREE.Box3(new THREE.Vector3(x - 7, 6, -21.5), new THREE.Vector3(x + 7, 27, -14.5)))); else prox.push(b.clone());
    if (id === 'R-101') prox.forEach(p => { p.min.z = -10; p.max.z = -1.8; p.max.y = 14; p.min.x += 0.6; });
    u.proxies = prox; prox.forEach(bx => { const s = bx.getSize(new THREE.Vector3()), c = bx.getCenter(new THREE.Vector3()); const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z)); m.position.copy(c); m.visible = false; m.userData.unit = id; P.root.add(m); m.updateMatrixWorld(true); PROX.push(m); });
    if (!UNITS[id]) continue; const bb = prox[0], c = bb.getCenter(new THREE.Vector3()), p = toW(c.x, bb.max.y + 1.2, c.z);
    const el = mkEl('tag', `<div class="p"><i></i>${TAGNAME[id] || id}</div><div class="s"></div>`); el.style.setProperty('--c', UNITS[id].col); el.onclick = () => selectUnit(id);
    TAGS[id] = {el, p, on: false, major: major.includes(id)}; }
  for (const id in P.streams) { const s = P.streams[id]; if (!s.pts || !s.pts.length || !SNAME[id]) continue; const a = streamAnchor(s.pts), p = toW(a.x, a.y + 0.2, a.z), col = (SVC[s.svc] || SVC.syn)[0];
    const el = mkEl('st', `<b style="--c:${col}"><span>${id}</span></b>`); STAGS[id] = {el, p, on: false};
    el.onmouseenter = e => { const d = SDATA[id]; const tip = $('tip'); tip.dataset.lock = 1; tip.innerHTML = `<b>Stream ${id}</b> – ${SNAME[id]}<br>${d && d[0] != null ? `T = ${d[0].toLocaleString('en-US')} °C` : ''}${d && d[1] != null ? ` · P = ${d[1]} bar` : ''}${d && d[2] != null ? `<br>F = ${d[2].toLocaleString('en-US')} kmol/h` : id <= 2 ? '<br>MPW = 37,879 kg/h' : ''}`;
      const r = el.getBoundingClientRect(); tip.style.left = (r.right + 8) + 'px'; tip.style.top = (r.top - 4) + 'px'; tip.style.opacity = 1; pulseStream(id, true); };
    el.onmouseleave = () => { const tip = $('tip'); delete tip.dataset.lock; tip.style.opacity = 0; pulseStream(id, false); }; el.onclick = () => focusStream(id); }
  // control-loop badges
  const loopAt = (tag, unit, d, tt, dy = 0) => { const u = P.units[unit]; if (!u) return; const b = u.proxies[0], c = b.getCenter(new THREE.Vector3()); const el = mkEl('loop', `<div class="c">${tt}</div><div class="t"><b>${tag}</b><span>${d}</span></div>`); LOOPS.push({el, p: toW(c.x, b.max.y * 0.8 + 3 + dy, c.z), on: false}); };
  loopAt('TC-310', 'E-104', 'R-103 feed temperature · Cohen–Coon PID', 'TT'); loopAt('LC-318', 'F-101', 'Flash-drum level · P-only (averaging)', 'LT'); loopAt('PC-319', 'D-103', 'Loop pressure · PI on the purge', 'PT', 4);
  loopAt('FY/FC-106', 'D-101', 'Steam-to-MPW ratio 1.33 kg/kg', 'FT'); loopAt('PC-301', 'C-101', 'Suction pressure → compressor speed', 'PT'); loopAt('TC-202', 'E-103', 'Shift-feed temperature · syngas bypass', 'TT'); loopAt('PC-210', 'C-102', 'H₂ pressure → speed', 'PT');
  // callouts of the cutaways
  for (const id in CUT) CUT[id].callouts.forEach((c, i) => { const side = i % 2 ? -1 : 1; const el = mkEl('co', `<div class="dt"></div><div class="ln" style="${side > 0 ? 'left:4px' : 'right:4px'};width:56px"></div><div class="box" style="${side > 0 ? 'left:60px' : 'right:60px'}">${c.html}</div>`);
    CALLS.push({el, p: c.p, cw: CUT[id], side, on: false}); });
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
// far-away details (handrails, ladders, grating, bolts, wheels) are switched off for wide shots
let DETAIL = [], detailOn = true; const DETAIL_MK = new Set(['yellow', 'galv', 'grate', 'dark', 'rubber', 'ss']);
function lod() { const want = LC.dist < (detailOn ? 200 : 175) || EXPLORE && LC.dist < 260; if (want !== detailOn) { detailOn = want; DETAIL.forEach(m => m.visible = want); } }
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
  if (L && (MODE === 'local' || (FADE.on && FADE.other === 'local'))) { if (EXPLORE) { controls.update(); syncFromCamera(); } else applyLocal(); lod(); flowU.uT.value = TT; ANIM.forEach(f => f(TT, dt)); for (const id in CUT) CUT[id].tick(TT, dt); hoverStep(); }
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
  controls = new OrbitControls(L.cam, canvas); controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = 1.48; controls.minDistance = 6; controls.maxDistance = 9000;
  app.cutLight = new THREE.PointLight(0xfff1dc, 0, 40, 1.6); L.scene.add(app.cutLight); CUT = buildCutaways(app, P); addDetails(); makeTags();
  // the ground below the plot: one plane, bundled textures first, real imagery when it arrives
  { const fk = Math.cos(PLOT.lat * D2R), W0 = 49.4083, E0 = 49.7117, S0 = 26.8849, N0 = 27.1551; const lr = new THREE.Vector4((W0 - PLOT.lon) * 111320 * fk, (E0 - PLOT.lon) * 111320 * fk, -(N0 - PLOT.lat) * 110574, -(S0 - PLOT.lat) * 110574);
    const G = makeGround(L.under, renderer, PLOT.lat, PLOT.lon, regionTex, fallbackTex, lr); if (!Q.has('nosat')) G.done.then(r => { if (r.patch) globe.setPatch(r.patch.tex, r.patch.geo); }).catch(() => {}); }
  P.root.traverse(m => { if (m.isMesh && DETAIL_MK.has(m.userData.mk)) DETAIL.push(m); });
  // compile every program now so that no slide stalls on a shader compile later
  status('Preparing the shaders…'); await new Promise(r => setTimeout(r, 20));
  Object.assign(LC, shotW(SHOTS.hero)); applyLocal(); globe.apply();
  for (const id in CUT) { const c = CUT[id]; c.setBox(0); (c.meshes || []).forEach(m => { m.userData.orig = m.userData.orig || m.material; m.material = c.clipMaterial(m.userData.orig); }); c.group.visible = true; c.group.traverse(x => { if (x.isMesh && x.material && x.userData.clip !== false && !x.material.isPointsMaterial) { x.material.clippingPlanes = c.planes; x.material.clipIntersection = true; } }); }
  try { await renderer.compileAsync(L.scene, L.cam); } catch (e) { renderer.compile(L.scene, L.cam); }
  // upload every buffer and texture now (one render with culling off), so nothing is uploaded mid-flight later
  { const fc = []; L.scene.traverse(o => { if (o.frustumCulled) { fc.push(o); o.frustumCulled = false; } }); renderScene('local'); fc.forEach(o => o.frustumCulled = true); }
  renderScene('local');
  for (const id in CUT) { const c = CUT[id]; (c.meshes || []).forEach(m => m.material = m.userData.orig); c.group.visible = false; }
  for (const id of ['R-101', 'T-101', 'R-103']) tint(id, 0xffa040, true), tint(id, 0xffa040, false);
  try { await renderer.compileAsync(globe.scene, globe.cam); } catch (e) { renderer.compile(globe.scene, globe.cam); }
  renderer.shadowMap.needsUpdate = true; renderScene('local'); renderScene('globe');
  // a quick start-up measure picks a safe first resolution for slow GPUs
  if (!LOW) { bench(3); const ms = Math.min(bench(5), bench(5)); window.__q = {ms}; if (ms > 14) setDPR(DPR * Math.sqrt(12 / ms)); }
  { const w = Math.floor(innerWidth * DPR * 0.5), h = Math.floor(innerHeight * DPR * 0.5); fadeRT.setSize(w, h); renderScene('globe', fadeRT); renderScene('local'); fadeQ.material.uniforms.a.value = 0.5; renderer.autoClear = false; renderer.render(fadeS, fadeC); renderer.autoClear = true; }
  $('lbar').firstElementChild.style.width = '100%'; status('Ready'); $('start').classList.add('on');
  requestAnimationFrame(frame);
  const s0 = Q.get('s'); if (s0 !== null) { $('loader').classList.add('off'); go(+s0); }
}
$('start').onclick = () => { $('loader').classList.add('off'); go(0); };
init();
window.__app = {get REFRESH() { return REFRESH; }, LONG, CALLS, TAGS, bench, GOV, get DPR() { return DPR; }, frame: t => frame(t), render: renderScene, go, get IDX() { return IDX; }, get MODE() { return MODE; }, LC, globe, renderer, get L() { return L; }, get CUT() { return CUT; }, selectUnit, get BUSY() { return BUSY; }};
