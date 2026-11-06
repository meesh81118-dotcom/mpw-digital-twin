// Equipment kit: procedural textures, PBR materials and dimension-driven equipment geometry.
// Every builder writes plain BufferGeometries into a Kit (one bucket per material); a Kit is merged
// into one mesh per material at the end, so a whole unit costs only a handful of draw calls.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M4 = THREE.Matrix4;
export const D2R = Math.PI / 180;

// ------------------------------------------------------------------ textures
function cv(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
// tileable value noise (sum of octaves), returns Float32Array in 0..1
function vnoise(n, cells, seed = 1, gain = 0.55) {
  const out = new Float32Array(n * n), R = rng(seed); let amp = 1, tot = 0;
  for (const s of cells) { const g = new Float32Array(s * s).map(() => R());
    for (let y = 0; y < n; y++) { const fy = y / n * s, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % s) * s, r1 = ((y0 + 1) % s) * s;
      for (let x = 0; x < n; x++) { const fx = x / n * s, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), a = g[r0 + x0 % s], b = g[r0 + (x0 + 1) % s], c = g[r1 + x0 % s], d = g[r1 + (x0 + 1) % s];
        out[y * n + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy); } }
    tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
function texFrom(canvas, {srgb = true, rep = true, aniso = 8} = {}) { const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.needsUpdate = true; return t; }
function paintNoise(g, n, f) { const img = g.getImageData(0, 0, n, n); f(img.data); g.putImageData(img, 0, 0); }
const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

export function makeTextures(aniso = 8) {
  const T = {};
  // concrete paving, 1024 px = 12 m, expansion joints every 6 m
  T.concrete = texFrom(cv(1024, 1024, (g, w) => { const a = vnoise(w, [4, 16, 64, 256], 11), b = vnoise(w, [8, 32, 128], 12);
    paintNoise(g, w, d => { for (let i = 0; i < w * w; i++) { const v = 178 + (a[i] - .5) * 30 + (b[i] - .5) * 16 + (Math.random() - .5) * 14; d[i * 4] = clamp255(v); d[i * 4 + 1] = clamp255(v - 3); d[i * 4 + 2] = clamp255(v - 9); d[i * 4 + 3] = 255; } });
    g.strokeStyle = 'rgba(70,66,60,.55)'; g.lineWidth = 2.2; for (const p of [0, 512]) { g.beginPath(); g.moveTo(p + 1, 0); g.lineTo(p + 1, w); g.moveTo(0, p + 1); g.lineTo(w, p + 1); g.stroke(); }
    g.strokeStyle = 'rgba(80,74,66,.22)'; g.lineWidth = 1; for (const p of [256, 768]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, w); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
    const R = rng(5); for (let k = 0; k < 26; k++) { const x = R() * w, y = R() * w, r = 20 + R() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(90,80,66,${.05 + R() * .08})`); gr.addColorStop(1, 'rgba(90,80,66,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }), {aniso});
  // asphalt, 512 px = 4 m
  T.asphalt = texFrom(cv(512, 512, (g, w) => { const a = vnoise(w, [4, 16, 64], 21);
    paintNoise(g, w, d => { for (let i = 0; i < w * w; i++) { const v = 74 + (a[i] - .5) * 20 + (Math.random() - .5) * 26; d[i * 4] = clamp255(v); d[i * 4 + 1] = clamp255(v + 1); d[i * 4 + 2] = clamp255(v + 4); d[i * 4 + 3] = 255; } }); }), {aniso});
  // desert sand with pebbles, 1024 px = 24 m
  T.sand = texFrom(cv(1024, 1024, (g, w) => { const a = vnoise(w, [3, 8, 32, 128, 512], 31), b = vnoise(w, [16, 64], 32);
    paintNoise(g, w, d => { for (let i = 0; i < w * w; i++) { const t = a[i], s = (Math.random() - .5) * 18, k = b[i];
      d[i * 4] = clamp255(196 + (t - .5) * 46 + s + (k - .5) * 20); d[i * 4 + 1] = clamp255(170 + (t - .5) * 40 + s + (k - .5) * 14); d[i * 4 + 2] = clamp255(128 + (t - .5) * 34 + s); d[i * 4 + 3] = 255; } });
    const R = rng(7); for (let k = 0; k < 1600; k++) { g.fillStyle = `rgba(${90 + R() * 60},${80 + R() * 50},${60 + R() * 40},${.25 + R() * .4})`; const r = .6 + R() * 1.8; g.beginPath(); g.arc(R() * w, R() * w, r, 0, 7); g.fill(); }
  }), {aniso});
  // gravel, 512 px = 3 m
  T.gravel = texFrom(cv(512, 512, (g, w) => { g.fillStyle = '#8f877a'; g.fillRect(0, 0, w, w); const R = rng(9);
    for (let k = 0; k < 9000; k++) { const v = 100 + R() * 95 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; const x = R() * w, y = R() * w, r = 1 + R() * 3.2; g.beginPath(); g.ellipse(x, y, r, r * (.6 + R() * .4), R() * 3, 0, 7); g.fill(); } }), {aniso});
  // steel grating, 256 px = 1 m
  T.grating = texFrom(cv(256, 256, (g, w) => { g.fillStyle = '#5a6066'; g.fillRect(0, 0, w, w); g.fillStyle = '#2a2e33'; for (let x = 0; x < w; x += 8) for (let y = 0; y < w; y += 26) g.fillRect(x + 2, y + 2, 5, 23); }), {aniso});
  // corrugated sheeting (bump), 64 px = 0.4 m
  T.corr = texFrom(cv(64, 8, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 128 + 110 * Math.sin(x / w * Math.PI * 4); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } }), {srgb: false});
  // aluminium cladding seams along a pipe or a shell (bump), one band per metre
  T.seam = texFrom(cv(16, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, w, 3); g.fillStyle = '#c0c0c0'; g.fillRect(0, 3, w, 2); }), {srgb: false});
  // windows band for buildings (1 px row per floor), 256x64
  T.windows = texFrom(cv(256, 128, (g, w, h) => { g.fillStyle = '#efede6'; g.fillRect(0, 0, w, h); for (let x = 8; x < w; x += 32) { g.fillStyle = '#2b3d50'; g.fillRect(x, 44, 22, 40); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, 44, 22, 6); } }), {aniso});
  // palm frond (alpha)
  T.frond = texFrom(cv(128, 512, (g, w, h) => { g.translate(w / 2, 0); g.strokeStyle = '#5b4a2c'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h); g.stroke();
    for (let y = 8; y < h; y += 7) { const t = y / h, L = Math.sin(t * Math.PI) * w * .48; const c = `rgb(${60 + t * 30 | 0},${100 + (1 - t) * 30 | 0},${40})`; g.strokeStyle = c; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(-L * .5, y + 6, -L, y + 22); g.moveTo(0, y); g.quadraticCurveTo(L * .5, y + 6, L, y + 22); g.stroke(); } }), {rep: false});
  // soft round contact shadow
  T.blob = texFrom(cv(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(.55, 'rgba(0,0,0,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }), {rep: false, srgb: false});
  T.blobSq = texFrom(cv(128, 128, (g, w) => { const id = g.createImageData(w, w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const dx = Math.max(0, Math.abs(x - 63.5) - 40) / 24, dy = Math.max(0, Math.abs(y - 63.5) - 40) / 24, d = Math.min(1, Math.hypot(dx, dy)); id.data[(y * w + x) * 4 + 3] = (1 - d) * (1 - d) * 120; } g.putImageData(id, 0, 0); }), {rep: false, srgb: false});
  // road surface with markings: u across (0..1 = carriageway), v along (1 tile = 12 m): edge lines + dashed centre line
  T.road = texFrom(cv(256, 512, (g, w, h) => { const a = vnoise(256, [8, 32], 41); const id = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = 70 + (a[(y % 256) * 256 + x] - .5) * 18 + (Math.random() - .5) * 22; id.data[i] = clamp255(v); id.data[i + 1] = clamp255(v + 1); id.data[i + 2] = clamp255(v + 4); id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0); g.fillStyle = 'rgba(236,236,230,.92)'; g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h); g.fillRect(w / 2 - 2, 0, 4, h * 0.45); }), {aniso});
  T.cross = texFrom(cv(64, 64, (g, w) => { g.fillStyle = '#4a4c50'; g.fillRect(0, 0, w, w); g.fillStyle = 'rgba(238,238,232,.95)'; for (let x = 4; x < w; x += 16) g.fillRect(x, 0, 8, w); }), {aniso});
  T.dash = texFrom(cv(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(255,255,255,1)'); gr.addColorStop(.58, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }), {srgb: false});
  T.smoke = texFrom(cv(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,.6)'); r.addColorStop(.5, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }), {rep: false});
  T.flame = texFrom(cv(128, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h * .75, 3, w / 2, h * .6, h * .55); r.addColorStop(0, 'rgba(255,250,225,1)'); r.addColorStop(.25, 'rgba(255,196,90,.95)'); r.addColorStop(.6, 'rgba(255,96,30,.5)'); r.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }), {rep: false});
  return T;
}

// ------------------------------------------------------------------ materials
// "Height AO": darkens indirect light close to the ground and gives a contact feel without an AO pass.
function heightAO(mat, k = 1) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => { if (prev) prev(s, r);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n{ float hao = mix(${(1 - 0.42 * k).toFixed(3)}, 1.0, smoothstep(0.0, 3.2, vWY)); reflectedLight.indirectDiffuse *= hao; reflectedLight.indirectSpecular *= hao; reflectedLight.directDiffuse *= mix(${(1 - 0.12 * k).toFixed(3)}, 1.0, smoothstep(0.0, 1.2, vWY)); }`); };
  mat.customProgramCacheKey = () => 'hao' + k + (mat.userData.wp ? 'wp' + mat.userData.wp : '');
  return mat;
}
// world-space planar mapping (for paving, roads, sand)
function worldMap(mat, scale) {
  mat.userData.wp = scale;
  mat.onBeforeCompile = s => { s.uniforms.uWS = {value: 1 / scale};
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;').replace('#include <project_vertex>', '#include <project_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ; uniform float uWS;').replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D(map, vWXZ * uWS); diffuseColor *= sampledDiffuseColor;'); };
  return mat;
}
export function makeMaterials(T, env) {
  const S = (o, ao = 1) => heightAO(new THREE.MeshStandardMaterial(o), ao);
  const M = {
    paint: S({color: 0xeef0f1, roughness: 0.42, metalness: 0.12}),
    paint2: S({color: 0xe3e6e8, roughness: 0.48, metalness: 0.1}),
    clad: S({color: 0xc8cdd2, roughness: 0.3, metalness: 0.88}),
    cladS: S({color: 0xd0d4d8, roughness: 0.28, metalness: 0.9}),
    ss: S({color: 0xb7bdc3, roughness: 0.24, metalness: 0.95}),
    refr: S({color: 0xd9d6cf, roughness: 0.6, metalness: 0.05}),
    steelG: S({color: 0x2e5b45, roughness: 0.55, metalness: 0.35}),
    galv: S({color: 0x8a9399, roughness: 0.5, metalness: 0.65}),
    grate: S({color: 0xffffff, map: T.grating, roughness: 0.7, metalness: 0.4}),
    yellow: S({color: 0xe3b034, roughness: 0.45, metalness: 0.2}),
    blue: S({color: 0x2c5d97, roughness: 0.38, metalness: 0.35}),
    blueD: S({color: 0x1f456f, roughness: 0.4, metalness: 0.4}),
    bluePipe: S({color: 0x2f74c0, roughness: 0.35, metalness: 0.25}),
    greenPipe: S({color: 0x3f8a52, roughness: 0.4, metalness: 0.2}),
    red: S({color: 0xc0332c, roughness: 0.45, metalness: 0.2}),
    orange: S({color: 0xd9782b, roughness: 0.45, metalness: 0.2}),
    dark: S({color: 0x2c3136, roughness: 0.55, metalness: 0.5}),
    black: S({color: 0x16191c, roughness: 0.6, metalness: 0.2}),
    rubber: S({color: 0x1d1f21, roughness: 0.9, metalness: 0}),
    conc: worldMap(S({color: 0xffffff, map: T.concrete, roughness: 0.9}), 12),
    concV: S({color: 0xc9c4b9, roughness: 0.92}),
    asph: worldMap(S({color: 0xffffff, map: T.asphalt, roughness: 0.86}), 4),
    road: S({color: 0xffffff, map: T.road, roughness: 0.85}),
    cross: worldMap(S({color: 0xffffff, map: T.cross, roughness: 0.8}), 2.6),
    curb: S({color: 0xd5d2ca, roughness: 0.85}),
    sand: worldMap(S({color: 0xffffff, map: T.sand, roughness: 0.98}), 24),
    gravel: worldMap(S({color: 0xffffff, map: T.gravel, roughness: 0.95}), 3),
    wall: S({color: 0xf0eee8, roughness: 0.82}),
    wallWin: S({color: 0xffffff, map: T.windows, roughness: 0.7}),
    roofR: S({color: 0xb8302c, roughness: 0.5, metalness: 0.35}),
    roofB: S({color: 0x2e66ad, roughness: 0.5, metalness: 0.35}),
    roofG: S({color: 0xa4a9ab, roughness: 0.45, metalness: 0.55}),
    roofBr: S({color: 0x8c4a34, roughness: 0.6, metalness: 0.2}),
    glass: S({color: 0x223a52, roughness: 0.08, metalness: 0.9}),
    trunk: S({color: 0x7a6040, roughness: 0.95}),
    frond: S({color: 0xffffff, map: T.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8}),
    grass: S({color: 0x6f8f3c, roughness: 0.95}),
    hedge: S({color: 0x4c6e2c, roughness: 0.95}),
    white: S({color: 0xf6f6f2, roughness: 0.6}),
    carW: S({color: 0xf2f2f0, roughness: 0.25, metalness: 0.6}), carK: S({color: 0x2a2d31, roughness: 0.3, metalness: 0.6}),
    carS: S({color: 0xa9b0b6, roughness: 0.25, metalness: 0.7}), carR: S({color: 0xa82a26, roughness: 0.3, metalness: 0.5}),
    tankW: S({color: 0xf2f3f3, roughness: 0.38, metalness: 0.1}),
    water: new THREE.MeshStandardMaterial({color: 0x3d7f88, roughness: 0.08, metalness: 0.1}),
  };
  for (const k in M) { M[k].userData.key = k; }
  return M;
}

// ------------------------------------------------------------------ Kit (geometry buckets with a transform stack)
function idx(g) { if (!g.index) { const n = g.attributes.position.count, a = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g; }
const _q = new THREE.Quaternion(), _up = V(0, 1, 0);
export class Kit {
  constructor() { this.parts = {}; this.m = new M4(); this.st = []; this.tris = 0; }
  push() { this.st.push(this.m.clone()); return this; }
  pop() { this.m.copy(this.st.pop()); return this; }
  tr(x, y, z, ry = 0) { const t = new M4().makeRotationY(ry); t.setPosition(x, y, z); this.m.multiply(t); return this; }
  rot(rx, ry, rz) { this.m.multiply(new M4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); return this; }
  add(g, mk, local) { idx(g); if (local) g.applyMatrix4(local); g.applyMatrix4(this.m); (this.parts[mk] || (this.parts[mk] = [])).push(g); return g; }
  // world (kit-frame) point of a local point
  P(x, y, z) { return V(x, y, z).applyMatrix4(this.m); }
  D(x, y, z) { return V(x, y, z).transformDirection(this.m); }
  // primitives (all lengths in metres, y up)
  box(w, h, d, mk, x = 0, y = 0, z = 0, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); const l = new M4().makeRotationY(ry); l.setPosition(x, y + h / 2, z); return this.add(g, mk, l); }
  boxC(w, h, d, mk, x, y, z, rx = 0, ry = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); const l = new M4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)); l.setPosition(x, y, z); return this.add(g, mk, l); }
  cyl(r, h, mk, x = 0, y = 0, z = 0, seg = 24, rTop, open = false, uvLen = 0) { const g = new THREE.CylinderGeometry(rTop ?? r, r, h, seg, 1, open); if (uvLen) scaleUV(g, 1, h / uvLen); g.translate(x, y + h / 2, z); return this.add(g, mk); }
  // cylinder between two points
  seg(a, b, r, mk, segs = 12, open = true, uvLen = 0) { const A = a.isVector3 ? a : V(...a), B = b.isVector3 ? b : V(...b), d = B.clone().sub(A), L = d.length(); if (L < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, L, segs, 1, open); if (uvLen) scaleUV(g, 1, L / uvLen); g.translate(0, L / 2, 0); _q.setFromUnitVectors(_up, d.normalize()); g.applyQuaternion(_q); g.translate(A.x, A.y, A.z); return this.add(g, mk); }
  sphere(r, mk, x, y, z, ws = 16, hs = 10) { const g = new THREE.SphereGeometry(r, ws, hs); g.translate(x, y, z); return this.add(g, mk); }
  lathe(pts, mk, x = 0, y = 0, z = 0, segs = 32) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), segs); g.translate(x, y, z); return this.add(g, mk); }
  ring(rIn, rOut, mk, x, y, z, segs = 32, t0 = 0, tl = Math.PI * 2) { const g = new THREE.RingGeometry(rIn, rOut, segs, 1, t0, tl); g.rotateX(-Math.PI / 2); g.translate(x, y, z); return this.add(g, mk); }
  torus(R, r, mk, x, y, z, rx = Math.PI / 2, arc = Math.PI * 2, segs = 32, rz = 0) { const g = new THREE.TorusGeometry(R, r, 6, segs, arc); const l = new M4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)); l.setPosition(x, y, z); return this.add(g, mk, l); }
  plane(w, d, mk, x, y, z, ry = 0) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(ry); g.translate(x, y, z); return this.add(g, mk); }
  // merge into meshes (one per material)
  build(M, {cast = true, receive = true, name = ''} = {}) { const grp = new THREE.Group(); grp.name = name;
    for (const mk in this.parts) { const list = this.parts[mk]; if (!list.length) continue; const geo = mergeGeometries(list, false); list.forEach(g => g.dispose());
      geo.computeBoundingSphere(); geo.computeBoundingBox(); const mesh = new THREE.Mesh(geo, M[mk]); mesh.castShadow = cast && !['conc', 'asph', 'sand', 'gravel', 'road', 'cross', 'grass', 'blob', 'blobSq'].includes(mk); mesh.receiveShadow = receive; mesh.matrixAutoUpdate = false; mesh.userData.mk = mk; grp.add(mesh);
      this.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; }
    this.parts = {}; return grp; }
}
function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }

// ------------------------------------------------------------------ pipes with real elbows
// pts: array of Vector3 (or arrays). Builds straight runs, long-radius elbows (R = 1.5·OD) and optional end flanges.
export function pipeRun(K, pts, r, mk = 'clad', o = {}) {
  const P = pts.map(p => p.isVector3 ? p.clone() : V(...p)); const out = [];
  for (let i = 0; i < P.length; i++) if (!out.length || out[out.length - 1].distanceTo(P[i]) > 1e-3) out.push(P[i]);
  // drop collinear points
  const Q = [out[0]]; for (let i = 1; i < out.length - 1; i++) { const a = out[i].clone().sub(Q[Q.length - 1]).normalize(), b = out[i + 1].clone().sub(out[i]).normalize(); if (a.dot(b) < 0.9999) Q.push(out[i]); } if (out.length > 1) Q.push(out[out.length - 1]);
  const segs = o.segs || (r > 0.5 ? 20 : r > 0.2 ? 14 : 10), Rb = o.bend ?? Math.max(r * 3, 0.25);
  let start = Q[0]; const uvLen = mk === 'clad' ? 1 : 0;
  for (let i = 1; i < Q.length; i++) { const A = Q[i - 1], B = Q[i];
    if (i < Q.length - 1) { const C = Q[i + 1], d1 = B.clone().sub(A).normalize(), d2 = C.clone().sub(B).normalize(), phi = Math.acos(Math.max(-1, Math.min(1, d1.dot(d2))));
      const R = Math.min(Rb, A.distanceTo(B) * 0.45 / Math.max(Math.tan(phi / 2), 1e-3), B.distanceTo(C) * 0.45 / Math.max(Math.tan(phi / 2), 1e-3)), t = R * Math.tan(phi / 2);
      const S = B.clone().addScaledVector(d1, -t); K.seg(start, S, r, mk, segs, true, uvLen);
      if (phi > 1e-3) { const w = d2.clone().addScaledVector(d1, -d1.dot(d2)).normalize(), Cn = S.clone().addScaledVector(w, R), u = w.clone().negate(), v = d1.clone(), z = u.clone().cross(v);
        const g = new THREE.TorusGeometry(R, r, segs, Math.max(4, Math.round(phi / (Math.PI / 2) * 8)), phi); const l = new M4().makeBasis(u, v, z); l.setPosition(Cn); K.add(g, mk, l); }
      start = B.clone().addScaledVector(d2, t);
    } else K.seg(start, B, r, mk, segs, true, uvLen); }
  if (o.flanges !== false) { for (const [p, q] of [[Q[0], Q[1]], [Q[Q.length - 1], Q[Q.length - 2]]]) { if (!q) continue; const d = q.clone().sub(p).normalize(); const f = p.clone().addScaledVector(d, 0.05); K.seg(f, f.clone().addScaledVector(d, 0.09), r * 1.55, 'ss', segs, false); } }
  if (o.supports) { // pipe shoes on long horizontal runs
    for (let i = 1; i < Q.length; i++) { const A = Q[i - 1], B = Q[i]; if (Math.abs(A.y - B.y) > 0.01) continue; const L = A.distanceTo(B); for (let s = 3; s < L - 2; s += 6) { const p = A.clone().lerp(B, s / L); K.box(r * 1.2, 0.18, 0.25, 'galv', p.x, p.y - r - 0.18, p.z); } } }
  return Q;
}

// ------------------------------------------------------------------ handrails, ladders, platforms, structures
export function railLine(K, a, b, h = 1.05, mk = 'yellow') { const A = V(...a), B = V(...b), L = A.distanceTo(B), n = Math.max(1, Math.round(L / 1.6));
  for (let i = 0; i <= n; i++) { const p = A.clone().lerp(B, i / n); K.seg(p, p.clone().setY(p.y + h), 0.025, mk, 5); }
  K.seg(A.clone().setY(A.y + h), B.clone().setY(B.y + h), 0.025, mk, 5); K.seg(A.clone().setY(A.y + h * .5), B.clone().setY(B.y + h * .5), 0.02, mk, 4); }
export function ringPlatform(K, r, y, t0 = 0, tl = Math.PI * 1.2, w = 1.1) {
  K.ring(r + 0.05, r + w, 'grate', 0, y, 0, 40, t0, tl);
  const n = Math.max(3, Math.round((r + w) * tl / 1.6)); const R = r + w - 0.05;
  for (let i = 0; i <= n; i++) { const a = t0 + tl * i / n; K.seg([Math.cos(a) * R, y, -Math.sin(a) * R], [Math.cos(a) * R, y + 1.05, -Math.sin(a) * R], 0.025, 'yellow', 5); }
  const arc = new THREE.TorusGeometry(R, 0.028, 4, 40, tl); K.add(arc, 'yellow', new M4().makeRotationX(Math.PI / 2).premultiply(new M4().makeRotationY(t0)).setPosition(0, y + 1.05, 0));
  const arc2 = new THREE.TorusGeometry(R, 0.022, 4, 40, tl); K.add(arc2, 'yellow', new M4().makeRotationX(Math.PI / 2).premultiply(new M4().makeRotationY(t0)).setPosition(0, y + 0.55, 0));
  // brackets under the platform
  for (let i = 0; i <= n; i += 2) { const a = t0 + tl * i / n; K.seg([Math.cos(a) * r, y - 0.9, -Math.sin(a) * r], [Math.cos(a) * (r + w * .9), y - 0.02, -Math.sin(a) * (r + w * .9)], 0.04, 'galv', 4); }
}
export function caged(K, x, z, y0, y1, ry = 0) { // caged ladder, its back against +z of local frame
  K.push().tr(x, 0, z, ry);
  for (const s of [-0.22, 0.22]) K.seg([s, y0, 0], [s, y1 + 1.0, 0], 0.025, 'yellow', 5);
  for (let y = y0 + 0.3; y < y1; y += 0.3) K.seg([-0.22, y, 0], [0.22, y, 0], 0.014, 'yellow', 4);
  for (let y = y0 + 2.4; y <= y1 + 0.9; y += 0.85) { const t = new THREE.TorusGeometry(0.38, 0.018, 4, 14, Math.PI); K.add(t, 'yellow', new M4().makeRotationX(Math.PI / 2).premultiply(new M4().makeRotationY(Math.PI)).setPosition(0, y, 0.38 - 0.02)); }
  for (const a of [0.35, 1.57, 2.8]) K.seg([Math.cos(a) * 0.38, y0 + 2.4, 0.36 + Math.sin(a) * 0.38], [Math.cos(a) * 0.38, y1 + 0.9, 0.36 + Math.sin(a) * 0.38], 0.014, 'yellow', 4);
  K.pop(); }
export function stairs(K, x0, y0, z0, x1, y1, w = 1.0, mk = 'galv') { // straight stair along x from (x0,y0) to (x1,y1)
  const L = Math.abs(x1 - x0), H = y1 - y0, n = Math.max(2, Math.round(H / 0.2)), s = Math.sign(x1 - x0);
  for (const dz of [-w / 2, w / 2]) K.seg([x0, y0, z0 + dz], [x1, y1, z0 + dz], 0.06, mk, 4, false);
  for (let i = 1; i < n; i++) K.box(0.26, 0.04, w, 'grate', x0 + s * L * i / n, y0 + H * i / n - 0.04, z0);
  for (const dz of [-w / 2, w / 2]) K.seg([x0, y0 + 1, z0 + dz], [x1, y1 + 1, z0 + dz], 0.025, 'yellow', 4);
}
// open steel frame: nx × nz bays, floors at given heights, bracing on the outer faces
export function frame(K, x, z, w, d, levels, o = {}) {
  const mk = o.mk || 'steelG', cx = o.nx || Math.max(1, Math.round(w / 6)), cz = o.nz || Math.max(1, Math.round(d / 6)), top = levels[levels.length - 1], col = o.col || 0.36;
  K.push().tr(x, 0, z, o.ry || 0);
  for (let i = 0; i <= cx; i++) for (let j = 0; j <= cz; j++) { const px = -w / 2 + w * i / cx, pz = -d / 2 + d * j / cz; K.box(col, top, col, mk, px, 0, pz); K.box(col * 2, 0.5, col * 2, 'concV', px, 0, pz); }
  for (const y of levels) { for (let j = 0; j <= cz; j++) K.box(w, 0.4, 0.24, mk, 0, y - 0.4, -d / 2 + d * j / cz); for (let i = 0; i <= cx; i++) K.box(0.24, 0.4, d, mk, -w / 2 + w * i / cx, y - 0.4, 0);
    if (o.floors !== false) { K.box(w, 0.05, d, 'grate', 0, y - 0.04, 0); if (o.rails !== false) { railLine(K, [-w / 2, y, -d / 2], [w / 2, y, -d / 2]); railLine(K, [-w / 2, y, d / 2], [w / 2, y, d / 2]); railLine(K, [-w / 2, y, -d / 2], [-w / 2, y, d / 2]); railLine(K, [w / 2, y, -d / 2], [w / 2, y, d / 2]); } } }
  if (o.brace !== false) { let yb = 0; for (const y of levels) { for (const s of [-1, 1]) { K.seg([-w / 2, yb, s * d / 2], [-w / 2 + w / cx, y - 0.4, s * d / 2], 0.07, mk, 4, false); K.seg([s * w / 2, yb, -d / 2], [s * w / 2, y - 0.4, -d / 2 + d / cz], 0.07, mk, 4, false); } yb = y; } }
  K.pop();
}
// pipe-rack bents along x
export function pipeRack(K, x0, x1, z, w, tiers, o = {}) { const step = o.step || 6, mk = o.mk || 'steelG'; const top = tiers[tiers.length - 1];
  for (let x = x0; x <= x1 + 0.01; x += step) { for (const s of [-1, 1]) { K.box(0.4, top, 0.4, mk, x, 0, z + s * w / 2); K.box(0.9, 0.4, 0.9, 'concV', x, 0, z + s * w / 2); } for (const y of tiers) K.box(0.3, 0.45, w + 0.4, mk, x, y - 0.45, z); }
  for (const y of tiers) for (const s of [-1, 1]) K.box(x1 - x0, 0.3, 0.22, mk, (x0 + x1) / 2, y - 0.75, z + s * w / 2);
  for (let x = x0; x < x1 - 0.1; x += step * 4) for (const s of [-1, 1]) K.seg([x, 0.4, z + s * w / 2], [x + step, tiers[0] - 0.8, z + s * w / 2], 0.08, mk, 4, false);
}

// ------------------------------------------------------------------ vessels
// Vertical vessel. Origin at the foundation centre. Returns nozzle helpers.
// o: {D, H (tan-tan), y0 (bottom tangent line height), skirt, legs, head ('ell'|'hemi'|'flat'), bot ('ell'|'cone'), cone (m), mk,
//     plat: [{y, t0, tl}], ladder: {y1, a}, rings (insulation bands), davit}
export function vVessel(K, x, z, o) {
  const r = o.D / 2, y0 = o.y0 ?? 2.5, H = o.H, mk = o.mk || 'paint', seg = o.seg || 40;
  K.push().tr(x, 0, z, o.ry || 0);
  // support
  if (o.legs) { const n = o.legs; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / 4; K.box(0.35, y0 + 0.4, 0.35, 'steelG', Math.cos(a) * r * .92, 0, Math.sin(a) * r * .92); K.box(0.7, 0.35, 0.7, 'concV', Math.cos(a) * r * .92, 0, Math.sin(a) * r * .92); } }
  else if (!o.noSkirt) { K.cyl(r * 1.0, y0, o.skirtMk || 'paint2', 0, 0.3, 0, seg); K.cyl(r * 1.18, 0.3, 'concV', 0, 0, 0, seg); K.cyl(r * 1.08, 0.12, 'galv', 0, 0.3, 0, seg); K.box(0.9, 1.6, 0.2, 'dark', 0, 0.45, r * 0.98); }
  // shell
  K.cyl(r, H, mk, 0, y0, 0, seg, undefined, false, mk === 'clad' ? 1 : 0);
  // heads
  const k = o.head === 'hemi' ? 1 : o.head === 'flat' ? 0.12 : 0.5, pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push([Math.cos(a) * r + 1e-3, Math.sin(a) * r * k]); }
  K.lathe(pts, mk, 0, y0 + H, 0, seg);
  if (o.bot === 'cone') { K.add(new THREE.CylinderGeometry(r, o.coneR || r * 0.18, o.cone || r * 1.6, seg, 1, true).translate(0, y0 - (o.cone || r * 1.6) / 2, 0), mk); }
  else { K.lathe(pts.map(([a, b]) => [a, -b]).reverse(), mk, 0, y0, 0, seg); }
  // insulation / stiffening bands
  if (o.rings) for (let y = y0 + 1.2; y < y0 + H - 0.5; y += o.rings) K.torus(r + 0.02, 0.035, 'galv', 0, y, 0, Math.PI / 2, Math.PI * 2, seg);
  // platforms and ladder
  const top = y0 + H + r * k;
  (o.plat || []).forEach(p => ringPlatform(K, r, p.y, p.t0 ?? 0, p.tl ?? Math.PI * 1.25, p.w ?? 1.1));
  if (o.ladder) { const a = o.ladder.a ?? -0.35; K.push().tr(Math.cos(a) * (r + 0.55), 0, -Math.sin(a) * (r + 0.55), a - Math.PI / 2); caged(K, 0, 0, o.ladder.y0 ?? 0.3, o.ladder.y1 ?? top, 0); K.pop(); }
  // top nozzle and davit
  if (o.topNozzle !== false) { K.cyl(o.tnR || Math.max(0.2, r * 0.18), 0.8, mk === 'clad' ? 'clad' : 'paint2', 0, top - 0.1, 0, 16); K.cyl((o.tnR || Math.max(0.2, r * 0.18)) * 1.5, 0.08, 'ss', 0, top + 0.62, 0, 16); }
  if (o.davit) { K.seg([r * 0.7, top - 0.5, 0], [r * 0.7, top + 3, 0], 0.08, 'yellow', 6); K.seg([r * 0.7, top + 3, 0], [r * 0.7 + 2.2, top + 3, 0], 0.07, 'yellow', 6); }
  // manways on the shell
  (o.manways || []).forEach(([y, a]) => { const p = [Math.cos(a) * r, y, -Math.sin(a) * r]; K.seg(p, [Math.cos(a) * (r + 0.4), y, -Math.sin(a) * (r + 0.4)], 0.32, mk, 16, false); K.seg([Math.cos(a) * (r + 0.4), y, -Math.sin(a) * (r + 0.4)], [Math.cos(a) * (r + 0.5), y, -Math.sin(a) * (r + 0.5)], 0.42, 'ss', 16, false); });
  const self = {top, r, y0, H, x, z,
    // nozzle on the shell at height y and angle a (radians, 0 = +x, π/2 = -z), returns {p, d}
    noz(y, a, nr = 0.3, L = 0.6) { K.push().tr(x, 0, z, o.ry || 0); const p0 = [Math.cos(a) * r * 0.98, y, -Math.sin(a) * r * 0.98], p1 = [Math.cos(a) * (r + L), y, -Math.sin(a) * (r + L)];
      K.seg(p0, p1, nr, mk === 'refr' ? 'paint2' : mk, 14, false); K.seg(p1, [Math.cos(a) * (r + L + 0.08), y, -Math.sin(a) * (r + L + 0.08)], nr * 1.55, 'ss', 14, false); const res = {p: K.P(...p1), d: K.D(Math.cos(a), 0, -Math.sin(a)), r: nr}; K.pop(); return res; },
    nozTop(nr = 0.3) { K.push().tr(x, 0, z, o.ry || 0); const res = {p: K.P(0, top + 0.7, 0), d: K.D(0, 1, 0), r: nr}; K.pop(); return res; },
    nozBot(nr = 0.3) { K.push().tr(x, 0, z, o.ry || 0); const yb = o.bot === 'cone' ? y0 - (o.cone || r * 1.6) : y0 - r * k; const res = {p: K.P(0, yb - 0.4, 0), d: K.D(0, -1, 0), r: nr}; K.seg([0, yb, 0], [0, yb - 0.4, 0], nr, mk, 12, false); K.pop(); return res; }};
  K.pop(); return self;
}
// Horizontal drum along local x. y = axis height.
export function hDrum(K, x, y, z, o) {
  const r = o.D / 2, L = o.L, mk = o.mk || 'paint', seg = o.seg || 32;
  K.push().tr(x, 0, z, o.ry || 0);
  K.add(new THREE.CylinderGeometry(r, r, L, seg, 1, true).rotateZ(Math.PI / 2).translate(0, y, 0), mk);
  const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r + 1e-3, Math.sin(a) * r * 0.5)); }
  for (const s of [-1, 1]) { const g = new THREE.LatheGeometry(pts, seg); g.rotateZ(-s * Math.PI / 2); g.translate(s * L / 2, y, 0); K.add(g, mk); }
  if (o.saddles !== false) for (const s of [-0.3, 0.3]) { const b0 = o.base || 0; K.box(r * 1.5, Math.max(0.2, y - r * 0.6 - b0), r * 1.6, o.saddleMk || 'concV', s * L, b0, 0); K.box(0.25, r * 0.7, r * 1.7, 'galv', s * L, y - r * 1.05, 0); }
  if (o.bands) for (let i = 0; i < o.bands; i++) { const t = new THREE.TorusGeometry(r + 0.02, 0.035, 4, seg); t.rotateY(Math.PI / 2); t.translate(-L / 2 + L * (i + 0.5) / o.bands, y, 0); K.add(t, 'galv'); }
  if (o.manway) K.seg([L / 2 + r * 0.45, y, 0], [L / 2 + r * 0.45 + 0.35, y, 0], 0.32, 'ss', 14, false);
  const self = {x, y, z, r, L,
    noz(lx, a = Math.PI / 2, nr = 0.25, len = 0.5) { K.push().tr(x, 0, z, o.ry || 0); const dir = V(0, Math.sin(a), Math.cos(a)), p0 = V(lx, y, 0).addScaledVector(dir, r * 0.95), p1 = V(lx, y, 0).addScaledVector(dir, r + len);
      K.seg(p0, p1, nr, mk, 14, false); K.seg(p1, p1.clone().addScaledVector(dir, 0.08), nr * 1.55, 'ss', 14, false); const res = {p: K.P(p1.x, p1.y, p1.z), d: K.D(dir.x, dir.y, dir.z), r: nr}; K.pop(); return res; },
    nozEnd(s = 1, nr = 0.25) { K.push().tr(x, 0, z, o.ry || 0); const p = V(s * (L / 2 + r * 0.5 + 0.4), y, 0); K.seg([s * (L / 2 + r * 0.45), y, 0], p, nr, mk, 14, false); const res = {p: K.P(p.x, p.y, p.z), d: K.D(s, 0, 0), r: nr}; K.pop(); return res; }};
  K.pop(); return self;
}
// Shell-and-tube exchanger along local x: shell, channel with bolted cover, bonnet, saddles, nozzles
export function hx(K, x, y, z, o) {
  const r = o.D / 2, L = o.L, mk = o.mk || 'paint', ry = o.ry || 0;
  K.push().tr(x, 0, z, ry);
  K.add(new THREE.CylinderGeometry(r, r, L, 28, 1, true).rotateZ(Math.PI / 2).translate(0, y, 0), mk);
  // channel (tube side) at -x end, with girth flanges and a flat bolted cover
  const cL = Math.max(0.8, r * 1.3);
  K.add(new THREE.CylinderGeometry(r * 1.05, r * 1.05, cL, 28).rotateZ(Math.PI / 2).translate(-L / 2 - cL / 2, y, 0), o.chMk || 'paint2');
  for (const px of [-L / 2, -L / 2 - cL]) K.add(new THREE.CylinderGeometry(r * 1.22, r * 1.22, 0.16, 32).rotateZ(Math.PI / 2).translate(px, y, 0), 'ss');
  const bolts = 18; for (let i = 0; i < bolts; i++) { const a = i / bolts * Math.PI * 2; K.add(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 5).rotateZ(Math.PI / 2).translate(-L / 2 - cL, y + Math.sin(a) * r * 1.15, Math.cos(a) * r * 1.15), 'dark'); }
  // rear bonnet at +x
  const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r + 1e-3, Math.sin(a) * r * 0.6)); }
  K.add(new THREE.LatheGeometry(pts, 28).rotateZ(-Math.PI / 2).translate(L / 2, y, 0), mk); K.add(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.14, 32).rotateZ(Math.PI / 2).translate(L / 2, y, 0), 'ss');
  if (o.saddles !== false) for (const s of [-0.32, 0.32]) { const b0 = o.base || 0; K.box(r * 1.4, Math.max(0.2, y - r * 0.7 - b0), r * 1.5, o.saddleMk || 'concV', s * L, b0, 0); K.box(0.22, r * 0.6, r * 1.6, 'galv', s * L, y - r * 1.0, 0); }
  const noz = (px, up, nr) => { const dir = up ? 1 : -1, p0 = V(px, y + dir * r * 0.95, 0), p1 = V(px, y + dir * (r + 0.45), 0); K.seg(p0, p1, nr, mk, 12, false); K.seg(p1, p1.clone().setY(p1.y + dir * 0.08), nr * 1.55, 'ss', 12, false); return {p: K.P(p1.x, p1.y, p1.z), d: K.D(0, dir, 0), r: nr}; };
  const nr = o.nr || Math.max(0.15, r * 0.28), nt = o.nt || nr;
  const N = {sIn: noz(L / 2 - r * 0.9, true, nr), sOut: noz(-L / 2 + r * 0.9, false, nr), tIn: noz(-L / 2 - cL * 0.5, !o.tubeDown, nt), tOut: noz(-L / 2 - cL * 0.5, !!o.tubeDown, nt)};
  K.pop(); return N;
}
// centrifugal pump skid with motor
export function pump(K, x, z, ry = 0, s = 1) { K.push().tr(x, 0, z, ry); K.box(2.6 * s, 0.25, 0.9 * s, 'concV', 0, 0, 0); K.box(2.4 * s, 0.15, 0.7 * s, 'dark', 0, 0.25, 0);
  K.add(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 1.0 * s, 20).rotateZ(Math.PI / 2).translate(-0.5 * s, 0.75 * s, 0), 'blue'); K.add(new THREE.CylinderGeometry(0.26 * s, 0.26 * s, 0.12, 20).rotateZ(Math.PI / 2).translate(0.05 * s, 0.75 * s, 0), 'yellow');
  K.add(new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 0.35 * s, 20).rotateZ(Math.PI / 2).translate(0.55 * s, 0.7 * s, 0), 'blueD'); K.seg([0.55 * s, 0.7 * s, 0], [0.55 * s, 1.35 * s, 0], 0.12 * s, 'ss', 10); K.seg([0.85 * s, 0.7 * s, 0], [1.25 * s, 0.7 * s, 0], 0.13 * s, 'ss', 10);
  const res = {suc: {p: K.P(1.25 * s, 0.7 * s, 0), d: K.D(1, 0, 0), r: 0.13 * s}, dis: {p: K.P(0.55 * s, 1.35 * s, 0), d: K.D(0, 1, 0), r: 0.12 * s}}; K.pop(); return res; }
// centrifugal compressor train (blue): motor, gearbox, barrel casings, lube console. Along local x.
export function compressor(K, x, z, o) {
  const ry = o.ry || 0, cas = o.casings || 2, cr = o.r || 1.2, L = o.len || 4.2; K.push().tr(x, 0, z, ry);
  const total = 4.5 + 2 + cas * (L + 1);
  K.box(total + 1.5, 1.0, cr * 3 + 1.2, 'concV', total / 2 - 2.6, 0, 0); K.box(total + 1, 0.3, cr * 3, 'dark', total / 2 - 2.6, 1.0, 0);
  // motor with cooling fins
  K.add(new THREE.CylinderGeometry(cr * 1.05, cr * 1.05, 4.2, 28).rotateZ(Math.PI / 2).translate(0, 1.3 + cr * 1.05, 0), 'blue');
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; K.boxC(4.0, 0.12, 0.25, 'blueD', 0, 1.3 + cr * 1.05 + Math.sin(a) * cr * 1.08, Math.cos(a) * cr * 1.08, a, 0, 0); }
  K.box(1.6, 0.9, cr * 1.6, 'blueD', 0, 1.3 + cr * 2.1, 0);
  K.add(new THREE.CylinderGeometry(cr * 0.5, cr * 0.5, 1.0, 16).rotateZ(Math.PI / 2).translate(2.6, 1.3 + cr * 1.05, 0), 'yellow');
  K.box(1.8, cr * 1.6, cr * 1.9, 'blue', 4.0, 1.3, 0);
  const N = []; let px = 5.4;
  for (let c = 0; c < cas; c++) { const cx = px + L / 2, rc = cr * (1 - c * 0.12);
    K.add(new THREE.CylinderGeometry(rc, rc, L, 28).rotateZ(Math.PI / 2).translate(cx, 1.3 + cr * 1.05, 0), 'blue');
    for (const s of [-1, 1]) K.add(new THREE.CylinderGeometry(rc * 1.12, rc * 1.12, 0.3, 28).rotateZ(Math.PI / 2).translate(cx + s * (L / 2 - 0.15), 1.3 + cr * 1.05, 0), 'blueD');
    K.box(L * 0.9, 0.2, rc * 2.3, 'blueD', cx, 1.3 + cr * 1.05 - 0.1, 0);
    const ni = {p: K.P(cx - L * 0.3, 1.3 + cr * 1.05 + rc + 0.9, 0), d: K.D(0, 1, 0), r: 0.35 * rc}, no = {p: K.P(cx + L * 0.3, 1.3 + cr * 1.05 + rc + 0.9, 0), d: K.D(0, 1, 0), r: 0.3 * rc};
    K.seg([cx - L * 0.3, 1.3 + cr * 1.05 + rc * 0.8, 0], [cx - L * 0.3, 1.3 + cr * 1.05 + rc + 0.9, 0], 0.35 * rc, 'blue', 16, false); K.seg([cx + L * 0.3, 1.3 + cr * 1.05 + rc * 0.8, 0], [cx + L * 0.3, 1.3 + cr * 1.05 + rc + 0.9, 0], 0.3 * rc, 'blue', 16, false);
    N.push({in: ni, out: no}); px += L + 1; if (c < cas - 1) K.add(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 12).rotateZ(Math.PI / 2).translate(px - 0.5, 1.3 + cr * 1.05, 0), 'yellow'); }
  K.box(2.4, 2.0, 1.6, 'blue', 1.0, 0.3, cr * 1.5 + 1.6); K.box(2.4, 0.3, 1.8, 'galv', 1.0, 2.3, cr * 1.5 + 1.6);
  K.pop(); return {stages: N, len: total};
}

// ------------------------------------------------------------------ site elements
export function tank(K, x, z, D, H, o = {}) { const r = D / 2; K.push().tr(x, 0, z);
  K.cyl(r + 0.8, 0.5, 'concV', 0, 0, 0, 56); K.cyl(r, H, o.mk || 'tankW', 0, 0.5, 0, 56);
  for (let i = 1; i < 6; i++) K.torus(r + 0.015, 0.04, 'paint2', 0, 0.5 + H * i / 6, 0, Math.PI / 2, Math.PI * 2, 56);
  K.add(new THREE.ConeGeometry(r + 0.15, D * 0.07, 56, 1, true).translate(0, 0.5 + H + D * 0.035, 0), o.mk || 'tankW');
  K.torus(r - 0.05, 0.03, 'yellow', 0, 0.5 + H + 1.05, 0, Math.PI / 2, Math.PI * 1.4, 40);
  // spiral stair
  const pts = []; for (let i = 0; i <= 48; i++) { const t = i / 48, a = -0.4 + t * Math.PI * 0.9; pts.push([Math.cos(a) * (r + 0.7), 0.5 + t * H, Math.sin(a) * (r + 0.7)]); }
  for (let i = 1; i < pts.length; i++) { K.seg(pts[i - 1], pts[i], 0.05, 'galv', 4, false); K.seg([pts[i - 1][0], pts[i - 1][1] + 1, pts[i - 1][2]], [pts[i][0], pts[i][1] + 1, pts[i][2]], 0.025, 'yellow', 4); }
  K.box(1.2, 0.4, 1.2, 'galv', 0, 0.5 + H + D * 0.07, 0);
  K.pop(); }
export function building(K, x, z, w, d, h, o = {}) { K.push().tr(x, 0, z, o.ry || 0);
  K.box(w + 0.6, 0.35, d + 0.6, 'concV', 0, 0, 0);
  K.box(w, h, d, o.win ? 'wallWin' : (o.wall || 'wall'), 0, 0.35, 0); if (o.win) { const g = K.parts.wallWin[K.parts.wallWin.length - 1]; const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 6, uv.getY(i) * h / 4); }
  if (o.gable) { const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.5, 0); s.lineTo(0, o.gable); s.lineTo(w / 2 + 0.5, 0); s.lineTo(-w / 2 - 0.5, 0);
    const rg = new THREE.ExtrudeGeometry(s, {depth: d + 1, bevelEnabled: false}); rg.translate(0, h + 0.35, -d / 2 - 0.5); const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.5, uv.getY(i) * 2.5); K.add(rg, o.roof || 'roofG');
    for (const s2 of [-1, 1]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, o.gable, 0], 3)); g.computeVertexNormals(); g.translate(0, h + 0.35, s2 * d / 2); K.add(g, o.wall || 'wall'); } }
  else { K.box(w + 0.2, 0.6, d + 0.2, o.roof ? 'curb' : 'curb', 0, h + 0.35, 0); K.box(w - 0.4, 0.12, d - 0.4, o.roof || 'roofG', 0, h + 0.35 + 0.35, 0);
    if (o.hvac) for (let i = 0; i < o.hvac; i++) K.box(2.2, 1.2, 1.6, 'galv', -w / 3 + i * 3.2, h + 0.95, -d / 4); }
  if (o.doors) for (let i = 0; i < o.doors; i++) { K.box(o.doorW || 4.5, o.doorH || 5, 0.15, o.doorMk || 'galv', -w / 2 + w * (i + 0.5) / o.doors, 0.35, d / 2 + 0.06); }
  K.pop(); }
export function palm(K, x, z, s = 1, R = Math.random) { K.push().tr(x, 0, z, R() * 6); const h = (6 + R() * 3) * s, lean = (R() - 0.5) * 0.4;
  const top = [lean * h * 0.3, h, 0]; const n = 6; for (let i = 0; i < n; i++) { const a = [lean * h * 0.3 * (i / n) ** 2, h * i / n, 0], b = [lean * h * 0.3 * ((i + 1) / n) ** 2, h * (i + 1) / n, 0]; K.seg(a, b, 0.22 * s * (1 - i / n * 0.35), 'trunk', 7, true); }
  K.sphere(0.45 * s, 'trunk', top[0], top[1], top[2], 8, 6);
  const fr = 11; for (let i = 0; i < fr; i++) { const a = i / fr * Math.PI * 2 + R() * 0.3, droop = 0.55 + R() * 0.5, L = (3.2 + R()) * s;
    const g = new THREE.PlaneGeometry(1.1 * s, L, 1, 4); g.translate(0, L / 2, 0); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k) / L; p.setZ(k, -yy * yy * L * droop * 0.7); } g.computeVertexNormals();
    g.rotateX(-Math.PI / 2 + 0.55); g.rotateY(a); g.translate(top[0], top[1], top[2]); K.add(g, 'frond'); }
  K.pop(); }
export function car(K, x, z, ry, mk = 'carW') { K.push().tr(x, 0, z, ry); K.boxC(4.5, 0.75, 1.85, mk, 0, 0.62, 0); K.boxC(2.5, 0.62, 1.7, 'glass', -0.25, 1.28, 0); K.boxC(2.3, 0.08, 1.6, mk, -0.25, 1.62, 0);
  for (const sx of [-1.45, 1.45]) for (const sz of [-0.85, 0.85]) K.add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 8).rotateX(Math.PI / 2).translate(sx, 0.36, sz), 'rubber'); K.pop(); }
export function truck(K, x, z, ry, type = 'tanker', cab = 'carW') { K.push().tr(x, 0, z, ry);
  K.boxC(2.3, 2.5, 2.45, cab, 5.6, 1.95, 0); K.boxC(0.1, 1.0, 2.2, 'glass', 6.78, 2.5, 0); K.boxC(12.5, 0.35, 2.3, 'dark', -0.6, 1.0, 0);
  if (type === 'tanker') { K.add(new THREE.CylinderGeometry(1.15, 1.15, 10.5, 24).rotateZ(Math.PI / 2).translate(-1.2, 2.45, 0), 'carS'); for (const s of [-1, 1]) K.add(new THREE.SphereGeometry(1.15, 16, 10).scale(0.35, 1, 1).translate(-1.2 + s * 5.25, 2.45, 0), 'carS'); }
  else if (type === 'fire') { K.boxC(7, 2.6, 2.45, 'carR', 1.0, 2.4, 0); K.boxC(9.5, 0.3, 2.45, 'carR', 1.6, 1.0, 0); }
  else K.boxC(10, 2.9, 2.45, 'white', -1.2, 2.6, 0);
  for (const sx of [-5.5, -4.2, 0.5, 5.6]) for (const sz of [-1.0, 1.0]) K.add(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 8).rotateX(Math.PI / 2).translate(sx, 0.5, sz), 'rubber'); K.pop(); }
// straight road strip with markings: from (x0,z0) to (x1,z1), width w; textured along its length
export function road(K, x0, z0, x1, z1, w, o = {}) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
  const g = new THREE.PlaneGeometry(L, w); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * L / 12); // u across, v along
  const l = new M4().makeRotationY(ry); l.setPosition((x0 + x1) / 2, o.y ?? 0.06, (z0 + z1) / 2); K.add(g, o.plain ? 'asph' : 'road', l);
  if (o.curb !== false) for (const s of [-1, 1]) { const c = new THREE.BoxGeometry(L, 0.18, 0.3); const lc = new M4().makeRotationY(ry); const nx = -Math.sin(ry) * 0, nz = 0; lc.setPosition((x0 + x1) / 2 + Math.sin(ry) * s * (w / 2 + 0.15), 0.09, (z0 + z1) / 2 + Math.cos(ry) * s * (w / 2 + 0.15)); K.add(c, 'curb', lc); }
}
export function blob(K, x, z, w, d, sq = false, ry = 0, y = 0.16) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(ry); g.translate(x, y, z); K.add(g, sq ? 'blobSq' : 'blob'); }
