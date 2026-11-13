// Story layers of the live presentation (added November 2026):
//   safety slide – emergency: purge-gas leak at D-103, detection and shutdown, evacuation to the assembly points (Chapter 7, Section 9.2.4)
//   economics    – the plant rises over the two years of construction (Chapter 8), then the cash flow
//   digital twin – the twin watches every unit: PCA monitoring finds Fault 4 in R-103 (Section 10.4)
//   Vision 2030  – phase 2: solar field, electrolysers and e-methanol from the purge (Section 10.5)
import * as THREE from 'three';
import {Kit, truck, building} from './kit.js';
import {UNITS, FDD4} from './data.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, outC = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
let _dot = null; function dotTex() { if (_dot) return _dot; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); _dot.colorSpace = THREE.SRGBColorSpace; return _dot; }
// a soft puff for the gas cloud
let _puff = null; function puffTex() { if (_puff) return _puff; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) { const x = 64 + (Math.sin(i * 2.4) * 30) * (i % 3) / 2, y = 64 + (Math.cos(i * 1.7) * 26) * (i % 4) / 3, rr = 26 + (i * 7) % 22; const r = g.createRadialGradient(x, y, 0, x, y, rr);
    r.addColorStop(0, 'rgba(255,255,255,.22)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  _puff = new THREE.CanvasTexture(c); _puff.colorSpace = THREE.SRGBColorSpace; return _puff; }

export function makeStory(C) {
  // C: THREE scene parts and helpers handed over by main.js
  const {P, L, renderer, tween, flyTo, ease, tint, flowU, mkEl, toW, FAST, FLARE, D2R} = C;
  const root = P.root, M = L.M, XL = [];
  const sec = s => s * FAST;
  // ------------------------------------------------------------ helpers
  function flowTube(pts, color, r, speed = 1) { const path = new THREE.CurvePath(); for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i])); const len = path.getLength();
    const m = new THREE.ShaderMaterial({uniforms: {uT: flowU.uT, uL: {value: len}, uC: {value: new THREE.Color(color)}, uA: {value: 0}, uS: {value: speed}}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform float uT,uL,uA,uS; uniform vec3 uC; varying vec2 vUv; void main(){ float d = fract(vUv.x * uL / 7.0 - uT * 0.9 * uS); float a = smoothstep(0.0, 0.25, d) * smoothstep(0.75, 0.3, d); gl_FragColor = vec4(uC * (0.4 + 1.3 * a), (0.22 + 0.72 * a) * uA); }'});
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(16, Math.round(len / 1.5)), r, 10, false), m); mesh.renderOrder = 6; mesh.visible = false; mesh.frustumCulled = false; return mesh; }
  const showTube = (m, on, d = 0.8) => { if (on) { m.visible = true; tween(m.material.uniforms.uA, {value: 1}, d); } else if (m.visible) tween(m.material.uniforms.uA, {value: 0}, 0.5).then(() => { if (m.material.uniforms.uA.value < 0.01) m.visible = false; }); };
  // labels in the plant frame (projected by main.js in updateLabels)
  function label(cls, html, x, y, z) { const el = mkEl('xl ' + cls, html); const o = {el, p: toW(x, y, z), on: false, want: false, sfx: ' translate(-50%,-100%)'}; XL.push(o); return o; }
  const glow = (color, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: dotTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0})); sp.scale.set(s, s, 1); return sp; };
  const shadowsNow = () => { renderer.shadowMap.needsUpdate = true; };
  const ROT = (x, z) => toW(x, 0, z);

  // ============================================================ SAFETY: emergency
  const EM = {built: false, k: 0, emit: false, fade: 0, alarm: 0, t0: 0, evac: false, et: 0};
  const WIND = V(0.383, 0, 0.924).normalize();          // from the north-north-west, in the plant frame (layout of Chapter 9: north = −z)
  const LEAK = V(112.6, 2.1, 58.4);
  const AP = [['Staff parking', -150, -66], ['Garden', -40, -72], ['Product loading', 168, -70], ['Truck parking', -146, 118]];
  const ROUTES = [[[40, 52], [40, 29.6], [-94, 29.6], [-94, -48], [-40, -48], [-40, -66]], [[95, 36], [95, 29.6], [128, 29.6], [128, -48], [168, -48], [168, -64]],
    [[-60, 24], [-60, 29.6], [-94, 29.6], [-94, -48], [-150, -48], [-150, -60]], [[-125, 40], [-125, 98], [-146, 98], [-146, 112]], [[78, 62], [78, 92], [-20, 92], [-94, 92], [-94, 29.6], [-94, -48], [-40, -48], [-40, -66]]];
  const FIRE_PATH = [[4, -90], [29, -90], [29, -48], [134, -48], [134, 14]];
  function buildEM() { if (EM.built) return; EM.built = true; const g = EM.g = new THREE.Group(); g.name = 'story-emergency'; root.add(g);
    // gas cloud: puffs drift with the wind and grow
    const mat = () => new THREE.SpriteMaterial({map: puffTex(), color: 0xff6a2a, transparent: true, depthWrite: false, opacity: 0});
    EM.parts = []; for (let i = 0; i < 110; i++) { const sp = new THREE.Sprite(mat()); sp.visible = false; g.add(sp); EM.parts.push({sp, age: 1e9, life: 1, v: V(0, 0, 0), s0: 1}); }
    const src = glow(0xff5a2a, 6); src.position.copy(LEAK); g.add(src); EM.src = src;
    // fixed CO detectors around the loop: post, head and a beacon
    const dk = new Kit(); EM.beacons = []; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, x = 112 + Math.cos(a) * 14, z = 52 + Math.sin(a) * 12;
      dk.cyl(0.09, 2.4, 'galv', x, 0, z, 8); dk.box(0.45, 0.5, 0.35, 'yellow', x, 2.4, z); const b = glow(0xff2a1a, 5); b.position.set(x, 3.3, z); g.add(b); EM.beacons.push(b); }
    g.add(dk.build(M, {name: 'detectors'}));
    // assembly points: green ground marks with a sign
    const ak = new Kit(); EM.ap = AP.map(([n, x, z]) => { ak.ring(5.4, 6.4, 'greenPipe', x, 0.35, z, 48); ak.cyl(0.12, 4, 'galv', x + 6.6, 0, z, 8); ak.box(2.4, 1.6, 0.12, 'greenPipe', x + 6.6, 3.2, z); return label('ap', `<b>A</b><span>${n}</span>`, x, 5.4, z); });
    EM.apG = ak.build(M, {name: 'assembly', cast: false}); EM.apG.visible = false; g.add(EM.apG);
    // escape routes (moving green arrows) and people in hi-vis clothing
    EM.routes = ROUTES.map(r => { const pts = r.map(([x, z]) => V(x, 0.5, z)); const t = flowTube(pts, 0x2bff7a, 0.42, 1.4); g.add(t); const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { seg.push(pts[i].distanceTo(pts[i - 1])); tot += seg[i - 1]; } return {pts, seg, tot, t}; });
    const cap = new THREE.CapsuleGeometry(0.9, 2.2, 3, 10); cap.translate(0, 2.0, 0); const pm = new THREE.MeshBasicMaterial({color: 0xffa21a});
    EM.nW = EM.routes.length * 7; EM.walk = new THREE.InstancedMesh(cap, pm, EM.nW); EM.walk.frustumCulled = false; EM.walk.visible = false; g.add(EM.walk);
    // the fire engine leaves the station with flashing lights
    const fk = new Kit(); truck(fk, 0, 0, 0, 'fire', 'carR'); EM.fire = fk.build(M, {name: 'fire-engine'}); EM.fire.visible = false; g.add(EM.fire);
    EM.fl = [glow(0xff2a2a, 7), glow(0x2a6aff, 7)]; EM.fl.forEach((s, i) => { s.position.set(1.4, 4.0, i ? -0.8 : 0.8); EM.fire.add(s); });
    EM.fp = FIRE_PATH.map(([x, z]) => V(x, 0, z)); EM.fseg = []; EM.ftot = 0; for (let i = 1; i < EM.fp.length; i++) { EM.fseg.push(EM.fp[i].distanceTo(EM.fp[i - 1])); EM.ftot += EM.fseg[EM.fseg.length - 1]; }
    EM.leakL = label('warn', '<b>D-103</b><span>purge leak · CO</span>', LEAK.x, 9, LEAK.z);
    EM.windL = label('wind', '<b>Wind NNW</b><span>→ carries the gas to the SSE</span>', LEAK.x + WIND.x * 34, 6, LEAK.z + WIND.z * 34);
    EM.fireL = label('bad', '<b>Fire engine</b><span>from the fire station</span>', 4, 8, -90);
    EM.ctrlL = label('ok', '<b>Control room</b><span>blast-resistant, 24 m upwind</span>', 62, 11, -72); }
  const along = (pts, seg, d) => { let i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; } const k = clamp(d / seg[i], 0, 1); return [pts[i].clone().lerp(pts[i + 1], k), pts[i + 1].clone().sub(pts[i])]; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  function tickEM(t, dt) { if (!EM.built || !EM.g.visible) return;
    // cloud
    let alive = 0; for (const q of EM.parts) { q.age += dt; if (q.age < 0) { q.sp.visible = false; continue; } if (q.age > q.life) { if (EM.emit) { q.age = 0; q.life = 7 + Math.random() * 5; const sp = 3.2 + Math.random() * 2.2;
          q.v.copy(WIND).multiplyScalar(sp).add(V((Math.random() - 0.5) * 1.6, 0.25 + Math.random() * 0.5, (Math.random() - 0.5) * 1.6)); q.sp.position.copy(LEAK).add(V((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2)); q.s0 = 3 + Math.random() * 2.5; q.sp.visible = true; }
        else { q.sp.visible = false; continue; } }
      alive++; q.sp.position.addScaledVector(q.v, dt); const k = q.age / q.life; const s = q.s0 + k * 26; q.sp.scale.set(s, s * 0.55, 1); q.sp.material.opacity = 0.55 * Math.pow(Math.sin(Math.PI * Math.min(1, k)), 0.7) * EM.fade; }
    EM.src.material.opacity = EM.emit ? 0.85 + 0.15 * Math.sin(t * 9) : Math.max(0, EM.src.material.opacity - dt);
    // detectors
    EM.beacons.forEach((b, i) => { b.material.opacity = EM.alarm * (Math.sin(t * 10 + i) > 0 ? 1 : 0.1); });
    // evacuation
    if (EM.evac) { const tt = (performance.now() - EM.et) / 1000 / FAST; let n = 0;
      EM.routes.forEach((R, ri) => { for (let j = 0; j < 7; j++) { const d = clamp((tt - j * 0.45 - ri * 0.2) * 11, 0, R.tot); const [p, dir] = along(R.pts, R.seg, d);
          if (d >= R.tot - 0.01) { const a = j * 0.9 + ri; p.x += Math.cos(a) * 2.4; p.z += Math.sin(a) * 2.4; }
          _e.set(0, Math.atan2(dir.x, dir.z), 0); _q.setFromEuler(_e); _s.setScalar(d > 0 || tt > 0 ? 1 : 0.001); _m.compose(p, _q, _s); EM.walk.setMatrixAt(n++, _m); } });
      EM.walk.instanceMatrix.needsUpdate = true;
      const df = clamp((tt - 0.6) * 15, 0, EM.ftot); const [fp, fd] = along(EM.fp, EM.fseg, df); EM.fire.position.copy(fp); EM.fire.rotation.y = Math.atan2(-fd.z, fd.x); EM.fire.visible = true; EM.fireL.p.copy(toW(fp.x, 9, fp.z));
      EM.fl.forEach((s, i) => s.material.opacity = (Math.sin(t * 14 + i * Math.PI) > 0 ? 1 : 0.05)); } }
  const EMSHOT = [null, {x: 118, y: 0, z: 64, dist: 112, az: -38, el: 28, shift: 0.14}, {x: 150, y: 14, z: 84, dist: 235, az: -30, el: 27, shift: 0.14}, {x: 8, y: 0, z: 6, dist: 470, az: 6, el: 64, shift: 0.12}];
  const LOOP = ['R-103', 'F-101', 'D-103', 'C-101R', 'E-105', 'M-102'];
  function emState(k) { buildEM(); EM.k = k; EM.g.visible = k > 0;
    EM.emit = k === 1; tween(EM, {fade: k === 1 || k === 2 ? 1 : 0}, k === 3 ? 1.5 : 0.8); tween(EM, {alarm: k >= 2 ? 1 : 0}, 0.4);
    FLARE.k = 1; if (k === 2 || k === 3) tween(FLARE, {k: k === 2 ? 2.6 : 1.6}, 1.4);
    LOOP.forEach(id => tint(id, 0xffb020, k === 2));
    EM.leakL.want = k === 1 || k === 2; EM.windL.want = k === 1; EM.ctrlL.want = k === 2 || k === 3; EM.ap.forEach(a => a.want = k === 3); EM.fireL.want = k === 3;
    EM.apG.visible = k === 3; EM.routes.forEach(R => showTube(R.t, k === 3)); EM.walk.visible = k === 3; EM.evac = k === 3; if (k === 3) EM.et = performance.now(); else { EM.fire.visible = false; }
    if (k === 1) EM.parts.forEach((q, i) => { q.age = -i / EM.parts.length * 7.5; q.life = 1; });
    if (k === 2) setTimeout(() => { if (EM.k === 2) EM.emit = false; }, sec(1.2) * 1000); }
  function emLeave() { if (!EM.built) return; EM.k = 0; EM.emit = false; EM.evac = false; EM.fade = 0; EM.alarm = 0; EM.g.visible = false; FLARE.k = 1; LOOP.forEach(id => tint(id, 0xffb020, false)); EM.ap.concat([EM.leakL, EM.windL, EM.ctrlL, EM.fireL]).forEach(x => x.want = false); EM.parts.forEach(q => { q.age = 1e9; q.sp.visible = false; });
    EM.routes.forEach(R => { R.t.material.uniforms.uA.value = 0; R.t.visible = false; }); }

  // ============================================================ ECONOMICS: construction
  const BD = {on: false, u: 1, t0: 0, items: null, decor: [], cranes: null, done: true};
  const SKIP = new Set(['site', 'CONTROL', 'BLOB', 'story-emergency', 'story-health', 'story-future']);
  function prepBuild() { if (BD.items) return; const items = [], xs = [];
    for (const o of root.children) { if (!o.isGroup || !o.name || SKIP.has(o.name) || !(P.units[o.name] || o.name === 'pads' || o.name === 'streams') || !o.visible) continue; const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) continue; const c = b.getCenter(V(0, 0, 0));
      // the plant root is rotated: bring the centre back to the plant frame
      const cx = c.clone().applyAxisAngle(V(0, 1, 0), -root.rotation.y).x; items.push({o, name: o.name, cx}); xs.push(cx); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    items.forEach(it => { if (it.name === 'pads') { it.s = 0.0; it.d = 0.12; } else if (it.name === 'RACK' || it.name === 'HDR') { it.s = 0.08; it.d = 0.3; } else if (it.name === 'streams') { it.s = 0.74; it.d = 0.24; }
      else { it.s = 0.12 + 0.56 * (it.cx - x0) / (x1 - x0); it.d = 0.2; } it.sec = UNITS[it.name] ? UNITS[it.name].sec : null; });
    BD.items = items;
    BD.decor = root.children.filter(o => o.isSprite || o.isPoints || o.isPointLight || (o.isGroup && !o.name && o.position.y > 5));
    BD.blob = root.children.find(o => o.name === 'BLOB');
    // tower cranes
    const ck = new Kit(); BD.jibs = [];
    const cranes = [[-52, -14, 52], [38, 8, 46], [104, -2, 58]];
    for (const [x, z, H] of cranes) { ck.box(1.8, H, 1.8, 'yellow', x, 0, z); for (let y = 2; y < H; y += 3.2) { ck.box(1.95, 0.12, 0.12, 'yellow', x, y, z - 0.92); ck.box(1.95, 0.12, 0.12, 'yellow', x, y, z + 0.92); }
      ck.box(3.2, 2.4, 2.6, 'dark', x, H - 1.2, z); ck.box(5, 0.6, 5, 'conc', x, 0, z); }
    BD.cranes = ck.build(M, {name: 'cranes'}); BD.cranes.visible = false; root.add(BD.cranes);
    for (const [x, z, H] of cranes) { const jk = new Kit(); jk.box(44, 1.1, 1.3, 'yellow', 13, 0, 0); jk.box(6, 2.2, 2.2, 'conc', -7, -1.1, 0); jk.box(0.9, 4.2, 0.9, 'yellow', 0, 1.1, 0); jk.seg(V(26, -0.1, 0), V(26, -H * 0.55, 0), 0.06, 'dark', 6); jk.box(1.4, 1.0, 1.4, 'red', 26, -H * 0.55 - 1, 0);
      const jg = jk.build(M, {name: 'jib'}); jg.position.set(x, H + 1.2, z); BD.cranes.add(jg); BD.jibs.push(jg); } }
  function setBuild(u, t) { BD.u = u; for (const it of BD.items) { const k = u < 0 ? 1 + u : sm((u - it.s) / it.d); it.o.scale.y = Math.max(0.0005, k); it.o.visible = k > 0.001; } }
  function startBuild() { prepBuild(); BD.on = true; BD.done = false; BD.t0 = performance.now(); BD.decor.forEach(o => o.visible = false); if (BD.blob) BD.blob.visible = false; BD.cranes.visible = true; BD.cranes.scale.set(1, 1, 1); BD.lastSec = ''; }
  function finishBuild() { if (!BD.items) return; BD.on = false; BD.done = true; setBuild(1); BD.decor.forEach(o => o.visible = true); if (BD.blob) BD.blob.visible = true; BD.cranes.visible = false; shadowsNow(); }
  const BUILD_SINK = 1.2, BUILD_T = 9.5;
  function tickBuild(t, dt) { if (!BD.on) return; const e = (performance.now() - BD.t0) / 1000 / FAST; let u;
    if (e < BUILD_SINK) u = -sm(e / BUILD_SINK); else u = Math.min(1, (e - BUILD_SINK) / BUILD_T);
    setBuild(u); shadowsNow(); BD.jibs.forEach((j, i) => j.rotation.y = t * (0.35 + i * 0.1) + i * 2);
    if (e > BUILD_SINK + BUILD_T * 0.92) BD.cranes.scale.y = Math.max(0.001, 1 - (e - BUILD_SINK - BUILD_T * 0.92) / (BUILD_T * 0.08));
    const p = Math.max(0, u), yr = $('bYr'), bar = $('bBar'), cap = $('bCap'), sc = $('bSec');
    if (yr) { yr.textContent = (2 * p).toFixed(1); bar.style.width = (p * 100) + '%'; cap.textContent = (478.40 * p).toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
      let cur = p <= 0 ? 'Site preparation and foundations' : p >= 1 ? 'Commissioning: the plant is ready to start' : null;
      if (!cur) { const act = BD.items.filter(it => p > it.s && p < it.s + it.d && it.sec).sort((a, b) => a.s - b.s); cur = act.length ? act[act.length - 1].sec : p > 0.74 ? 'Piping and the pipe rack' : 'Foundations and steel'; }
      if (cur !== BD.lastSec) { sc.textContent = cur; BD.lastSec = cur; } }
    if (u >= 1) { finishBuild(); const sc2 = $('bSec'); if (sc2) sc2.textContent = 'Commissioning: the plant is ready to start'; } }
  const $ = id => document.getElementById(id);

  // ============================================================ DIGITAL TWIN: health view
  const HV = {built: false, on: false};
  const HEALTHY = ['R-101', 'CY-101', 'D-101', 'E-101', 'E-102', 'E-103', 'R-102', 'D-102', 'M-101', 'E-106', 'E-104', 'E-107', 'T-101', 'ME-101', 'C-102', 'SC', 'C-101', 'C-101R', 'M-102', 'E-105', 'F-101', 'D-103', 'V-101'];
  function buildHV() { if (HV.built) return; HV.built = true; const g = HV.g = new THREE.Group(); g.name = 'story-health'; g.visible = false; root.add(g);
    // the scan: a thin glowing curtain sweeping the plot from west to east
    const sm2 = new THREE.MeshBasicMaterial({color: 0x34e0ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide});
    HV.scan = new THREE.Mesh(new THREE.PlaneGeometry(150, 46), sm2); HV.scan.rotation.y = Math.PI / 2; HV.scan.position.set(-200, 23, 25); g.add(HV.scan);
    const r103 = P.units['R-103'].box, c = r103.getCenter(V(0, 0, 0)).applyAxisAngle(V(0, 1, 0), -root.rotation.y);
    HV.lbl = label('bad', '<b>R-103 · Fault 4</b><span>catalyst activity falling</span>', c.x, r103.max.y + 4, c.z);
    HV.ok = label('ok', '<b>22 units healthy</b><span>T² and Q inside their limits</span>', -30, 34, -16);
    HV.ring = glow(0xff3a1e, 34); HV.ring.position.set(c.x, 10, c.z); g.add(HV.ring); }
  function hvState(on) { buildHV(); HV.on = on; HV.g.visible = on; HEALTHY.forEach(id => tint(id, 0x1fc46a, on)); tint('R-103', 0xff3a1e, on); HV.lbl.want = on; HV.ok.want = on; HV.t0 = performance.now(); }
  function tickHV(t) { if (!HV.on) return; const e = ((performance.now() - HV.t0) / 1000 / FAST) % 4.2; HV.scan.position.x = -210 + e / 4.2 * 430; HV.scan.material.opacity = 0.16 * Math.sin(Math.PI * e / 4.2);
    const k = 0.5 + 0.5 * Math.sin(t * 5); const u = P.units['R-103']; if (u) u.group.children.forEach(m => { const h = m.userData && m.userData['hl' + 0xff3a1e]; if (h) h.emissiveIntensity = 0.25 + 0.6 * k; });
    HV.ring.material.opacity = 0.25 + 0.35 * k; }

  // ============================================================ VISION 2030: phase 2
  const FU = {built: false, k: -1, t0: 0};
  function buildFU() { if (FU.built) return; FU.built = true; const g = FU.g = new THREE.Group(); g.name = 'story-future'; g.visible = false; root.add(g);
    // solar field south of the plot (not to scale): instanced tables with a light glint wave
    const tabs = []; for (let z = 172; z <= 330; z += 6.2) for (let x = -198; x <= 198; x += 13.2) { if (x > 70 && z < 214) continue; tabs.push([x, z]); }
    const pg = new THREE.BoxGeometry(12.4, 0.09, 2.6), pmat = new THREE.MeshStandardMaterial({color: 0x24447e, metalness: 0.6, roughness: 0.18, emissive: 0x0a1630, emissiveIntensity: 1});
    FU.pv = new THREE.InstancedMesh(pg, pmat, tabs.length); FU.pv.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(tabs.length * 3).fill(1), 3); FU.pv.castShadow = true; FU.pv.frustumCulled = false; FU.tabs = tabs; g.add(FU.pv);
    const lg = new THREE.BoxGeometry(0.16, 1.5, 0.16); lg.translate(0, 0.75, 0); FU.legs = new THREE.InstancedMesh(lg, M.galv, tabs.length * 2); FU.legs.frustumCulled = false; g.add(FU.legs);
    tabs.forEach(([x, z], i) => { FU.legs.setMatrixAt(2 * i, new THREE.Matrix4().makeTranslation(x - 4.5, 0, z)); FU.legs.setMatrixAt(2 * i + 1, new THREE.Matrix4().makeTranslation(x + 4.5, 0, z)); });
    FU.cx = 130; FU.cz = 192;
    // electrolyser hall, transformer yard and hydrogen spheres
    const ek = new Kit(); building(ek, 128, 192, 60, 28, 12, {win: true, roof: 'roofB', hvac: 4}); for (let i = 0; i < 4; i++) ek.box(5, 4.5, 4, 'galv', 86, 0, 180 + i * 7); ek.box(14, 0.25, 32, 'conc', 86, 0, 190);
    for (const [x, z] of [[176, 180], [176, 200]]) { ek.sphere(5.2, 'paint', x, 7.6, z, 24, 14); for (let a = 0; a < 4; a++) ek.cyl(0.25, 5, 'galv', x + Math.cos(a * 1.57) * 3.6, 0, z + Math.sin(a * 1.57) * 3.6, 8); }
    FU.ely = ek.build(M, {name: 'electrolysers'}); g.add(FU.ely);
    // e-methanol synthesis east of the plot: reactor, column, compressor, tank, pad
    const mk = new Kit(); mk.box(64, 0.22, 86, 'conc', 250, 0, 36); mk.cyl(2.3, 17, 'clad', 240, 0.2, 40, 24); mk.sphere(2.3, 'clad', 240, 17.2, 40, 20, 10); mk.cyl(1.6, 27, 'clad', 254, 0.2, 50, 20); mk.sphere(1.6, 'clad', 254, 27.2, 50, 16, 8);
    mk.box(9, 3.6, 4.6, 'blue', 238, 0.2, 64); mk.cyl(0.5, 4.6, 'dark', 244, 0.2, 64, 12); mk.cyl(9, 13, 'paint', 262, 0.2, 8, 40); mk.cyl(9.1, 0.4, 'roofG', 262, 13.2, 8, 40);
    for (const [x, z] of [[247, 40], [260, 50]]) mk.box(0.4, 18, 0.4, 'steelG', x, 0, z);
    FU.syn = mk.build(M, {name: 'emethanol'}); g.add(FU.syn);
    // pipelines on low sleepers, with their flows
    const pk = new Kit(); const pipe = (pts, r, mkk) => { for (let i = 1; i < pts.length; i++) pk.seg(pts[i - 1], pts[i], r, mkk, 10); for (let i = 0; i < pts.length; i++) pk.box(0.4, pts[i].y, 0.4, 'steelG', pts[i].x, 0, pts[i].z); };
    const H2P = [V(158, 4.5, 178), V(222, 4.5, 178), V(222, 4.5, 46), V(238, 4.5, 46)], PUR = [V(114, 9, 60), V(222.6, 9, 60), V(222.6, 9, 62), V(234, 9, 62)], EMO = [V(254, 4, 46), V(262, 4, 30), V(262, 4, 18)];
    pipe(H2P, 0.35, 'clad'); pipe(PUR, 0.28, 'clad'); pipe(EMO, 0.25, 'clad'); FU.pipes = pk.build(M, {name: 'p2pipes'}); g.add(FU.pipes);
    FU.fH2 = flowTube(H2P, 0x7fd3ff, 0.62, 1.2); FU.fPU = flowTube(PUR, 0xff8a3d, 0.55, 1.0); FU.fEM = flowTube(EMO, 0xffe36e, 0.5, 0.9); [FU.fH2, FU.fPU, FU.fEM].forEach(m => g.add(m));
    FU.sun = glow(0xffd36a, 140); FU.sun.position.set(0, 120, 380); g.add(FU.sun);
    FU.l1 = label('ok', '<b>Solar field</b><span>drawn smaller than the real one</span>', -40, 8, 250); FU.l2 = label('h2', '<b>Electrolysers · 411.8 MW</b><span>water + sunlight → H₂</span>', 128, 17, 192);
    FU.l3 = label('meoh', '<b>e-Methanol</b><span>purge CO + CO₂ + H₂ · 345,008 t/y</span>', 248, 31, 44); FU.l4 = label('warn', '<b>Purge gas</b><span>today burned as fuel</span>', 160, 13, 60);
    [FU.ely, FU.syn, FU.pipes].forEach(o => o.scale.y = 0.0005); setPV(0, 0); }
  const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3();
  function setPV(u, t) { const n = FU.tabs.length, col = FU.pv.instanceColor;
    for (let i = 0; i < n; i++) { const [x, z] = FU.tabs[i], d = Math.hypot(x - FU.cx, z - FU.cz) / 330, k = outC((u - d * 0.75) / 0.25); _pe.set(25 * D2R * k, 0, 0); _pq.setFromEuler(_pe); _pp.set(x, 1.5 * k + 0.05, z); _ps.set(k > 0 ? 1 : 0.0001, 1, k > 0 ? 1 : 0.0001); _pm.compose(_pp, _pq, _ps); FU.pv.setMatrixAt(i, _pm);
      const w = Math.max(0, Math.sin((x * 0.012 + z * 0.02) - t * 1.8)); const b = 0.85 + 0.9 * Math.pow(w, 18); col.setXYZ(i, b, b, b * 1.05); }
    FU.pv.instanceMatrix.needsUpdate = true; col.needsUpdate = true; FU.legs.visible = u > 0.05; }
  function fuState(k) { buildFU(); const prev = FU.k; FU.k = k; FU.g.visible = true; FU.t0 = performance.now();
    if (k >= 0 && prev < 0) { FU.pvU = 0; [FU.ely, FU.syn, FU.pipes].forEach(o => o.scale.y = 0.0005); }
    tween(FU.ely.scale, {y: 1}, 2.4, ease.out); tween(FU.pipes.scale, {y: k >= 0 ? 1 : 0.0005}, 2.0, ease.out); tween(FU.syn.scale, {y: k >= 1 ? 1 : 0.0005}, 2.2, ease.out);
    showTube(FU.fH2, true, 1.6); showTube(FU.fPU, k >= 1, 1.2); showTube(FU.fEM, k >= 1, 1.6);
    FU.l1.want = k === 0; FU.l2.want = true; FU.l3.want = k >= 1; FU.l4.want = k >= 1; FLARE.k = 1; }
  function fuLeave() { if (!FU.built) return; FU.k = -1; FU.g.visible = false; [FU.l1, FU.l2, FU.l3, FU.l4].forEach(l => l.want = false); [FU.fH2, FU.fPU, FU.fEM].forEach(m => { m.material.uniforms.uA.value = 0; m.visible = false; }); shadowsNow(); }
  function tickFU(t) { if (FU.k < 0 || !FU.g.visible) return; const e = (performance.now() - FU.t0) / 1000 / FAST; FU.pvU = Math.min(1, Math.max(FU.pvU, e / 3.2)); setPV(FU.pvU, t);
    if (e < 3.5) shadowsNow(); FU.sun.material.opacity = 0.22 + 0.04 * Math.sin(t * 0.7); }
  const FUSHOT = [{x: 40, y: 0, z: 120, dist: 560, az: 22, el: 30, shift: 0.12}, {x: 150, y: 0, z: 70, dist: 360, az: 44, el: 33, shift: 0.12}];

  // ============================================================ card extras
  function cardExtra(o) { let h = '';
    if (o.seq) h += `<ol class="seq">${o.seq.map((s, i) => `<li style="--d:${0.35 + i * 0.55}s"><i>${i + 1}</i><span>${s}</span></li>`).join('')}</ol>`;
    if (o.build) h += `<div class="bld"><div class="row"><div><span>Year of construction</span><b id="bYr">0.0</b><u>of 2</u></div><div><span>Capital invested</span><b id="bCap">0.0</b><u>M$</u></div></div><div class="pb"><i id="bBar"></i></div><div class="now"><span>Now building</span><b id="bSec">Site preparation and foundations</b></div></div>`;
    if (o.fdd) { h += `<svg id="fddc" viewBox="0 0 520 170"></svg><div class="fdd"><div><span>Diagnosis (k-NN)</span><b>Fault 4 · R-103 catalyst</b><em>${FDD4.acc} % of test samples</em></div><div><span>Largest contribution</span><b>Methanol ${FDD4.c[4]} %</b><em>purge ${FDD4.c[6]} %, recycle ${FDD4.c[5]} %</em></div></div>
      <div class="act"><b>Operator action</b>Check the clean syngas for catalyst poisons, follow the activity trend and plan the change of the R-103 catalyst.</div>`; }
    if (o.carbon) h += `<div class="cbar"><div><span>Today</span><div class="t"><i data-w="${o.carbon[0]}" style="background:var(--pen)"></i></div><b>${o.carbon[0]} %</b></div><div><span>Phase 2</span><div class="t"><i data-w="${o.carbon[1]}" style="background:#2f9a52"></i></div><b>${o.carbon[1]} %</b></div><em>Carbon of the plastic kept in products</em></div>`;
    return h; }
  function afterCard(o) { if (o.fdd) drawFDD(); }
  function drawFDD() { const s = $('fddc'); if (!s) return; const Q = FDD4.Q, W = 520, H = 170, ml = 40, mr = 10, mt = 10, mb = 26, X = m => ml + m / 600 * (W - ml - mr), Y = v => mt + (Math.log10(1e4) - Math.log10(Math.max(v, 0.01))) / 6 * (H - mt - mb);
    const al = 100 + FDD4.dQ; let g = '';
    for (const v of [0.01, 1, 100, 10000]) g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rule2)"/><text x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end" style="font:500 11px Plex;fill:var(--mut)">${v >= 1 ? v.toLocaleString('en-US') : v}</text>`;
    g += `<rect x="${X(100)}" y="${mt}" width="${X(600) - X(100)}" height="${H - mt - mb}" fill="rgba(224,74,27,.07)"/><text x="${X(104)}" y="${mt + 12}" style="font:600 11px Plex;fill:var(--hot)">fault starts</text>`;
    g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(FDD4.Qlim)}" y2="${Y(FDD4.Qlim)}" stroke="#c62b1e" stroke-width="1.6" stroke-dasharray="6 4"/><text x="${W - mr}" y="${Y(FDD4.Qlim) - 5}" text-anchor="end" style="font:600 11px Plex;fill:#c62b1e">99 % limit</text>`;
    g += `<path d="${Q.map((v, i) => (i ? 'L' : 'M') + X(i * 2).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ')}" fill="none" stroke="var(--pen)" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset 2.6s ease .2s"/>`;
    g += `<circle cx="${X(al)}" cy="${Y(Q[Math.round(al / 2)])}" r="0" fill="#c62b1e" style="transition:r .3s ease 1.1s"><animate attributeName="r" values="5;8;5" dur="1.2s" begin="1.3s" repeatCount="indefinite"/></circle>`;
    g += `<text x="${X(al) + 8}" y="${Y(Q[Math.round(al / 2)]) + 16}" style="font:700 12px Plex;fill:#c62b1e">ALARM at ${al} min</text><text x="${(W + ml) / 2}" y="${H - 6}" text-anchor="middle" style="font:500 11px Plex;fill:var(--mut)">Q statistic of the PCA model, minutes (log scale)</text>`;
    s.innerHTML = g; requestAnimationFrame(() => { const p = s.querySelector('path'); if (p) p.style.strokeDashoffset = 0; const c = s.querySelector('circle'); if (c) c.setAttribute('r', 5); }); }

  // ============================================================ slide controllers
  const S = {
    safety: {enter(k, back) { emState(k); if (k > 0) flyTo(EMSHOT[k], k === 3 ? 3.0 : 2.2); else if (back) flyTo(C.SHOTS.safety, 2.0); }, leave: emLeave},
    econ: {enter(k) { if (k === 0) { startBuild(); flyTo(Object.assign({}, C.SHOTS.econ, {az: C.SHOTS.econ.az + 24}), BUILD_SINK + BUILD_T + 0.4, ease.sine); } else { finishBuild(); flyTo(C.SHOTS.econ, 1.6); } }, leave: finishBuild},
    twin: {enter(k, back) { hvState(k === 1); C.qr(k === 0); if (k === 1) flyTo({x: 70, y: 0, z: -6, dist: 255, az: -34, el: 32, shift: 0.13}, 2.2); else if (back) flyTo(C.SHOTS.twin, 2.0); }, leave() { if (HV.built && HV.on) hvState(false); }},
    future: {enter(k) { fuState(k); flyTo(FUSHOT[k], k === 0 ? 2.6 : 2.4); }, leave: fuLeave}};
  return {
    S, cardExtra, afterCard, XL, busyStep: () => BD.on,
    tick(t, dt) { tickEM(t, dt); tickBuild(t, dt); tickHV(t); tickFU(t); },
    prewarm() { buildEM(); buildHV(); buildFU(); EM.g.visible = true; HV.g.visible = true; FU.g.visible = true; return () => { EM.g.visible = false; HV.g.visible = false; FU.g.visible = false; }; }};
}
