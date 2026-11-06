// Cutaways: a clipping box opens the featured unit towards the camera and the internals come alive.
import * as THREE from 'three';
import {PLOT} from './scene.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const toW = (x, y, z) => V(x, y, z).applyAxisAngle(UP, PLOT.rot);
const dirW = (a) => V(Math.sin(a), 0, Math.cos(a)).applyAxisAngle(UP, PLOT.rot);   // plant-frame azimuth → world direction

function dotTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; }
let DOT; const dot = () => DOT || (DOT = dotTex());
// simple CPU particle cloud (Points). update(fn) writes positions; colours fixed per particle.
function cloud(n, size, color, o = {}) { const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); const c = new THREE.Color();
  for (let i = 0; i < n; i++) { c.set(typeof color === 'function' ? color(i) : color); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({size, map: dot(), vertexColors: true, transparent: true, depthWrite: false, opacity: o.opacity ?? 0.95, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true});
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.seed = Float32Array.from({length: n}, () => Math.random()); return p; }

export class Cutaway {
  constructor(app, id, o) { this.app = app; this.id = id; this.o = o; this.k = 0; this.on = false; this.group = new THREE.Group(); this.group.visible = false; app.scene.add(this.group);
    this.planes = Array.from({length: 6}, () => new THREE.Plane()); this.mats = new Map(); this.updates = []; this.callouts = []; this.light = new THREE.PointLight(o.light || 0xfff1dc, 0, 40, 1.6); this.group.add(this.light); }
  // c: axis base (plant frame), r: radius, y0/y1: vertical extent of the cut box, w: half width
  setBox(camAz) { const o = this.o, c = toW(o.x, 0, o.z), n = dirW(camAz), t = V().crossVectors(UP, n).normalize(); this.c = c; this.n = n; this.t = t;
    const P = this.planes, ct = c.dot(t), cn = c.dot(n);
    P[1].set(t.clone(), -ct - o.w); P[2].set(t.clone().negate(), ct - o.w); P[3].set(V(0, 1, 0), -o.y1); P[4].set(V(0, -1, 0), o.y0); P[5].set(n.clone(), -cn - (o.depth || o.r + 4)); this.apply(); }
  apply() { const k = this.k, o = this.o, cn = this.c.dot(this.n), off = (o.r + 2.5) * (1 - k) - (o.cutIn || 0.02) * k; this.planes[0].set(this.n.clone().negate(), cn + off); }
  clipMaterial(m) { if (this.mats.has(m)) return this.mats.get(m); const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.clippingPlanes = this.planes; c.clipIntersection = true; c.side = THREE.DoubleSide; c.clipShadows = true; this.mats.set(m, c); return c; }
  hook(meshes) { this.meshes = meshes; }
  open(camAz) { this.camAz = camAz; this.setBox(camAz); this.on = true; this.group.visible = true; (this.meshes || []).forEach(mesh => { mesh.userData.orig = mesh.userData.orig || mesh.material; mesh.material = this.clipMaterial(mesh.userData.orig); });
    this.group.traverse(x => { if (x.isMesh && x.material && !x.material.isPointsMaterial && x.userData.clip !== false) { x.material.clippingPlanes = this.planes; x.material.clipIntersection = true; } });
    this.app.tween(this, {k: 1}, 1.6).then(() => { this.app.shadowDirty = 2; }); }
  close() { if (!this.on) return; return this.app.tween(this, {k: 0}, 1.0).then(() => { this.on = false; this.group.visible = false; (this.meshes || []).forEach(m => { if (m.userData.orig) m.material = m.userData.orig; }); this.app.shadowDirty = 2; }); }
  backHalf() { const a = this.camAz || 0, cx = Math.sin(a), cz = Math.cos(a); this.group.traverse(o => { if (!o.isPoints && !o.isInstancedMesh) return; if (o.userData.noMirror) return; const p = o.isPoints ? o.geometry.attributes.position : null;
    if (p) { const A = p.array; for (let i = 0; i < p.count; i++) { const x = A[i * 3], z = A[i * 3 + 2], d = x * cx + z * cz; if (d > 0) { A[i * 3] = x - 2 * d * cx; A[i * 3 + 2] = z - 2 * d * cz; } } } }); }
  tick(t, dt) { if (!this.on && this.k <= 0) return; this.apply(); this.light.intensity = this.k * (this.o.li ?? 14); this.updates.forEach(f => f(t, dt, this.k)); this.backHalf(); if (this.k > 0 && this.k < 1) this.app.shadowDirty = 1; }
  callout(p, html, side = 1) { this.callouts.push({p: toW(...p), html, side}); }
  mat(o) { return new THREE.MeshStandardMaterial(o); }
  add(obj, p) { if (p) obj.position.copy(toW(...p)); obj.rotation.y += PLOT.rot; this.group.add(obj); return obj; }
}

// ---------------------------------------------------------------------- builders for every featured unit
export function buildCutaways(app, P) {
  const F = P.featured, C = {}, U = P.units;
  const meshesOf = (...ids) => ids.flatMap(id => U[id] ? U[id].group.children.filter(m => m.isMesh) : []);
  const back = (az) => az;   // camera azimuth per unit (plant frame), the cut faces the camera

  // ---------------- R-101 gasifier: refractory, distributor, bubbling olivine bed, freeboard, screw feed
  { const f = F['R-101'], x = f.x, z = f.z, cw = new Cutaway(app, 'R-101', {x, z, r: 3.75, w: 4.4, y0: 1.2, y1: 12.5, light: 0xffb070, li: 54});
    cw.hook(meshesOf('R-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const brick = cw.mat({color: 0x8c3f26, roughness: 0.9, emissive: 0xff5a14, emissiveIntensity: 0.35, side: THREE.DoubleSide});
    const lin = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 6.5, 48, 1, true), brick); lin.position.y = 3.2 + 3.25; G.add(lin);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.25, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), brick); dome.scale.y = 0.45; dome.position.y = 9.7; G.add(dome);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.24, 3.24, 0.12, 48), cw.mat({color: 0x6f757b, metalness: 0.7, roughness: 0.4})); plate.position.y = 4.2; G.add(plate);
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), cw.mat({color: 0x9aa1a6, metalness: 0.8, roughness: 0.3}), 160); const d = new THREE.Object3D();
    for (let i = 0; i < 160; i++) { const a = i * 2.39996, rr = Math.sqrt(i / 160) * 3.0; d.position.set(Math.cos(a) * rr, 4.35, Math.sin(a) * rr); d.updateMatrix(); caps.setMatrixAt(i, d.matrix); } G.add(caps);
    // bed: animated glowing granular surface
    const bedU = {uT: {value: 0}};
    const bedM = new THREE.ShaderMaterial({uniforms: bedU, side: THREE.DoubleSide, clipping: true,
      vertexShader: `#include <clipping_planes_pars_vertex>\nvarying vec3 vP; void main(){ vP = position; vec4 mvPosition = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mvPosition;\n#include <clipping_planes_vertex>\n}`,
      fragmentShader: `#include <clipping_planes_pars_fragment>\nuniform float uT; varying vec3 vP; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){\n#include <clipping_planes_fragment>\n vec2 q = vec2(atan(vP.z,vP.x)*3.0, vP.y*2.0) + vP.xz*1.3; float g = n(q*6.+vec2(0.,uT*1.6))*0.55+n(q*17.-vec2(uT*2.,0.))*0.45; float hot = smoothstep(0.25,0.9,g);
        vec3 c = mix(vec3(0.55,0.16,0.03), vec3(1.0,0.62,0.18), hot); c = mix(c, vec3(1.0,0.9,0.55), smoothstep(0.82,0.98,g)); gl_FragColor = vec4(c*1.25,1.0); }`});
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(3.22, 3.22, 1.0, 48, 1, false), bedM); bed.position.y = 4.78; G.add(bed); bed.userData.clip = false; bedM.clippingPlanes = cw.planes; bedM.clipIntersection = true;
    // bubbles rising through the bed and splashing into the freeboard
    const nb = 70, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({color: 0xffb760, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false}), nb); bub.userData.clip = false; G.add(bub);
    const bs = Array.from({length: nb}, () => ({a: Math.random() * 6.28, r: Math.sqrt(Math.random()) * 2.9, ph: Math.random(), s: 0.12 + Math.random() * 0.22}));
    const spl = cloud(500, 0.16, i => i % 3 ? 0xffa040 : 0xffd080, {add: true}); G.add(spl);
    const gas = cloud(700, 0.22, 0xffe6b0, {add: true, opacity: 0.35}); G.add(gas);
    const feed = cloud(120, 0.22, i => [0x2b74c9, 0xd23c2c, 0xf2f2f2, 0x2f9a52, 0xe0b030][i % 5]); G.add(feed);
    const sa = spl.userData.seed, ga = gas.userData.seed, fa = feed.userData.seed;
    cw.updates.push((t, dt) => { bedU.uT.value = t;
      const ca = Math.sin(cw.camAz || 0), cb = Math.cos(cw.camAz || 0); for (let i = 0; i < nb; i++) { const b = bs[i], k = (t * 0.45 + b.ph) % 1, y = 4.25 + k * 1.05; let bx = Math.cos(b.a) * b.r, bz = Math.sin(b.a) * b.r; const dd2 = bx * ca + bz * cb; if (dd2 > 0) { bx -= 2 * dd2 * ca; bz -= 2 * dd2 * cb; } d.position.set(bx, y, bz); d.scale.setScalar(b.s * 0.7 * (0.6 + k * 1.2)); d.updateMatrix(); bub.setMatrixAt(i, d.matrix); } bub.instanceMatrix.needsUpdate = true;
      const P1 = spl.geometry.attributes.position.array; for (let i = 0; i < 500; i++) { const s = sa[i], k = (t * (0.7 + s * 0.5) + s * 7) % 1, a = s * 77, r = (s * 13 % 1) * 3.0, v = 2.4 + (s * 31 % 1) * 2.0; P1[i * 3] = Math.cos(a) * r; P1[i * 3 + 1] = 5.25 + v * k - 4.0 * k * k; P1[i * 3 + 2] = Math.sin(a) * r; } spl.geometry.attributes.position.needsUpdate = true;
      const P2 = gas.geometry.attributes.position.array; for (let i = 0; i < 700; i++) { const s = ga[i], k = (t * 0.18 + s) % 1, a = s * 91 + k * 2, r = (s * 17 % 1) * 3.0 * (1 - k * k * 0.8); P2[i * 3] = Math.cos(a) * r; P2[i * 3 + 1] = 5.4 + k * 6.6; P2[i * 3 + 2] = Math.sin(a) * r; } gas.geometry.attributes.position.needsUpdate = true;
      const P3 = feed.geometry.attributes.position.array; for (let i = 0; i < 120; i++) { const s = fa[i], k = (t * 0.35 + s) % 1; const sx = 6.8 - k * 7.2, sy = 5.2 - Math.max(0, k - 0.6) * 1.2 + Math.sin(s * 40) * 0.12, sz = -2.0 + Math.cos(s * 33) * 0.25; P3[i * 3] = sx; P3[i * 3 + 1] = sy; P3[i * 3 + 2] = sz; } feed.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 7, z));
    cw.callout([x, 11.2, z], '<b>Raw syngas → cyclones</b>Stream 8 · 1,200 °C · 7,925 kmol/h');
    cw.callout([x - 1, 7.8, z], '<b>Freeboard 4.0 m</b>gas residence time 3.37 s');
    cw.callout([x + 1.5, 5.0, z], '<b>Bubbling olivine bed</b>550 µm · 31,074 kg · 1,200 °C · U = 0.87 → 1.57 m/s');
    cw.callout([x + 3.6, 5.2, z - 2], '<b>MPW screw feeder</b>7,576 kg/h per train');
    cw.callout([x, 3.4, z], '<b>Steam distributor</b>Stream 7 · 600 °C · S/C = 1.09');
    C['R-101'] = cw; }

  // ---------------- CY-101 cyclone: outer vortex down, inner vortex up, solids to the dipleg
  { const f = F['CY-101'], x = f.x, z = f.z, cw = new Cutaway(app, 'CY-101', {x, z, r: 1.75, w: 2.0, y0: 6.6, y1: 23.5, depth: 3.2, li: 15});
    cw.hook(meshesOf('CY-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const sol = cloud(900, 0.14, i => i % 4 ? 0xd98a3a : 0x7a5a3a); const gs = cloud(500, 0.2, 0xfff0c8, {add: true, opacity: 0.45}); G.add(sol, gs);
    const ss = sol.userData.seed, gq = gs.userData.seed;
    cw.updates.push(t => { const A = sol.geometry.attributes.position.array; for (let i = 0; i < 900; i++) { const s = ss[i], k = (t * 0.22 + s) % 1, y = 20.6 - k * 13.4; const rr = y > 14 ? 1.6 : 0.35 + (y - 7) / 7 * 1.25; const a = s * 50 + k * 34; A[i * 3] = Math.cos(a) * rr; A[i * 3 + 1] = y; A[i * 3 + 2] = Math.sin(a) * rr; } sol.geometry.attributes.position.needsUpdate = true;
      const B = gs.geometry.attributes.position.array; for (let i = 0; i < 500; i++) { const s = gq[i], k = (t * 0.3 + s) % 1, y = 12 + k * 12.6, rr = 0.5 * (1 - k * 0.3); const a = -s * 60 - k * 30; B[i * 3] = Math.cos(a) * rr; B[i * 3 + 1] = y; B[i * 3 + 2] = Math.sin(a) * rr; } gs.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 15, z));
    cw.callout([x, 23.6, z], '<b>Clean syngas</b>Stream 10 · d₅₀ = 22.9 µm');
    cw.callout([x + 1.6, 18, z], '<b>Tangential inlet</b>1.75 × 0.70 m · 14.5 m/s');
    cw.callout([x, 8.5, z], '<b>Char + olivine</b>Stream 9 → combustor');
    C['CY-101'] = cw; }

  // ---------------- CR-101 shredder: counter-rotating toothed rotors cutting the plastic
  { const p = F['CR-101'].parts[0], x = p.x, z = p.z, cw = new Cutaway(app, 'CR-101', {x, z, r: 3.0, w: 3.4, y0: 0.5, y1: 6.5, depth: 4, li: 12});
    cw.hook(meshesOf('CR-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const steel = cw.mat({color: 0x8b949b, metalness: 0.85, roughness: 0.35}), tooth = cw.mat({color: 0xc9cdd1, metalness: 0.9, roughness: 0.25});
    const rot = []; for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(0, 2.2, s * 0.55); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5, 16).rotateZ(Math.PI / 2), steel); g.add(sh);
      for (let k = 0; k < 11; k++) { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.28, 18).rotateZ(Math.PI / 2), steel); disc.position.x = -2.2 + k * 0.44; g.add(disc);
        for (let j = 0; j < 3; j++) { const tt = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.16), tooth); const a = j / 3 * Math.PI * 2 + k * 0.6; tt.position.set(-2.2 + k * 0.44, Math.cos(a) * 0.56, Math.sin(a) * 0.56); tt.rotation.x = -a; g.add(tt); } }
      G.add(g); rot.push([g, s]); }
    const N = 60, pcs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.06, 0.3), new THREE.MeshStandardMaterial({roughness: 0.5}), N); pcs.userData.clip = false; const cc = new THREE.Color(), dd = new THREE.Object3D();
    for (let i = 0; i < N; i++) pcs.setColorAt(i, cc.set([0x2b74c9, 0xd23c2c, 0xf2f2f2, 0x2f9a52, 0xe0b030, 0x333333][i % 6])); G.add(pcs);
    const fl = cloud(700, 0.09, i => [0x2b74c9, 0xd23c2c, 0xeeeeee, 0x2f9a52, 0xe0b030][i % 5]); G.add(fl); const fs = fl.userData.seed;
    const sd = Array.from({length: N}, () => [Math.random(), Math.random(), Math.random()]);
    cw.updates.push((t, dt) => { rot.forEach(([g, s]) => g.rotation.x = -s * t * 3.2);
      for (let i = 0; i < N; i++) { const [a, b, c] = sd[i], k = (t * 0.28 + a) % 1; let px, py, pz; if (k < 0.45) { px = -1.8 + b * 3.6; py = 7.5 - k / 0.45 * 4.6; pz = (c - 0.5) * 1.6; } else { px = 99; py = -99; pz = 0; }
        dd.position.set(px, py, pz); dd.rotation.set(a * 9 + t * 2, b * 9, c * 9 + t); dd.scale.setScalar(0.8 + c); dd.updateMatrix(); pcs.setMatrixAt(i, dd.matrix); } pcs.instanceMatrix.needsUpdate = true;
      const A = fl.geometry.attributes.position.array; for (let i = 0; i < 700; i++) { const s = fs[i], k = (t * 0.5 + s) % 1; A[i * 3] = -2 + (s * 37 % 1) * 4 + k * 0.5; A[i * 3 + 1] = 1.7 - k * 1.2; A[i * 3 + 2] = (s * 53 % 1 - 0.5) * 0.9; } fl.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 4, z + 2));
    cw.callout([x, 7.2, z], '<b>Mixed plastic waste in</b>Stream 1 · 37,879 kg/h');
    cw.callout([x + 1.2, 2.4, z], '<b>Twin-shaft rotors</b>counter-rotating cutting discs · 2,083 kW');
    cw.callout([x - 1.5, 0.8, z], '<b>Shredded flakes out</b>Stream 2 → conveyor → screw feeders');
    C['CR-101'] = cw; }

  // ---------------- R-102 water-gas shift: six catalyst beds with interbed cooling
  { const f = F['R-102'], x = f.x, z = f.z, cw = new Cutaway(app, 'R-102', {x, z, r: 2.7, w: 3.3, y0: 2.0, y1: 15.5, li: 19});
    cw.hook(meshesOf('R-102')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const cat = cw.mat({color: 0x5d5b58, roughness: 0.95, map: pellets()}); const coil = cw.mat({color: 0xb8bfc5, metalness: 0.9, roughness: 0.3});
    for (let b = 0; b < 6; b++) { const y = 3.6 + b * 1.55; const m = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 1.0, 48, 1, false), cat); m.position.y = y + 0.5; G.add(m);
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 48), coil); sup.position.y = y; G.add(sup);
      if (b < 5) { const c = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 6, 40), coil); c.rotation.x = Math.PI / 2; c.position.y = y + 1.28; G.add(c); const c2 = c.clone(); c2.scale.setScalar(0.65); c2.position.y = y + 1.28; G.add(c2); } }
    const gp = cloud(900, 0.18, i => i % 5 === 0 ? 0xff6655 : i % 5 === 1 ? 0x66aaff : 0xfff2cc, {add: true, opacity: 0.6}); G.add(gp); const gs = gp.userData.seed;
    cw.updates.push(t => { const A = gp.geometry.attributes.position.array; for (let i = 0; i < 900; i++) { const s = gs[i], k = (t * 0.12 + s) % 1, y = 13.0 - k * 10, a = s * 71 + k * 3, r = (s * 29 % 1) * 2.4; A[i * 3] = Math.cos(a) * r; A[i * 3 + 1] = y; A[i * 3 + 2] = Math.sin(a) * r; } gp.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 8, z));
    cw.callout([x, 13.4, z], '<b>Shift feed</b>Stream 14 · 270 °C · 7,386 kmol/h');
    cw.callout([x + 1.4, 9.8, z], '<b>6 catalyst beds</b>Cu/ZnO/Al₂O₃ · 71,198 kg · 49.35 m³');
    cw.callout([x - 1.2, 7.0, z], '<b>Interbed cooling</b>14.23 MW → 28.3 t/h steam');
    cw.callout([x, 4.0, z], '<b>CO + H₂O → CO₂ + H₂</b>90 % CO conversion');
    C['R-102'] = cw; }

  // ---------------- ME-101: Pd–Ag tubes, hydrogen crosses the wall, the rest stays in the tube
  { const f = F['ME-101'], x = f.x, z = f.z, cw = new Cutaway(app, 'ME-101', {x, z, r: 0.55, w: 0.75, y0: 1.4, y1: 6.7, depth: 1.6, li: 8});
    cw.hook(meshesOf('ME-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const tm = cw.mat({color: 0xd9dde1, metalness: 0.95, roughness: 0.2, transparent: true, opacity: 0.55});
    const tub = []; for (let i = 0; i < 19; i++) { const ring = i === 0 ? 0 : i < 7 ? 1 : 2, a = ring === 1 ? (i - 1) / 6 * Math.PI * 2 : (i - 7) / 12 * Math.PI * 2, rr = ring * 0.17; const px = Math.cos(a) * rr, pz = Math.sin(a) * rr; tub.push([px, pz]);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 10, 1, true), tm); m.position.set(px, 1.7 + 2.2, pz); G.add(m); }
    const h2 = cloud(600, 0.07, 0xffffff, {add: true}), oth = cloud(300, 0.11, i => i % 2 ? 0xff5a4a : 0x8a9096); G.add(h2, oth); const hs = h2.userData.seed, os = oth.userData.seed;
    cw.updates.push(t => { const A = h2.geometry.attributes.position.array; for (let i = 0; i < 600; i++) { const s = hs[i], k = (t * 0.25 + s) % 1, [px, pz] = tub[i % 19], cross = Math.max(0, (k - (s * 13 % 1) * 0.6) * 3), a = s * 40;
        A[i * 3] = px + Math.cos(a) * Math.min(cross, 1) * 0.12; A[i * 3 + 1] = 6.0 - k * 4.2; A[i * 3 + 2] = pz + Math.sin(a) * Math.min(cross, 1) * 0.12; } h2.geometry.attributes.position.needsUpdate = true;
      const B = oth.geometry.attributes.position.array; for (let i = 0; i < 300; i++) { const s = os[i], k = (t * 0.25 + s) % 1, [px, pz] = tub[i % 19]; B[i * 3] = px; B[i * 3 + 1] = 6.0 - k * 4.3; B[i * 3 + 2] = pz; } oth.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 4, z + 1));
    cw.callout([x, 6.4, z], '<b>Shifted gas in</b>Stream 15 · 7,386 kmol/h');
    cw.callout([x + 0.3, 4.2, z], '<b>Pd–Ag film 5 µm</b>only H₂ (white) crosses the wall');
    cw.callout([x, 2.0, z], '<b>Permeate 99.99 % H₂</b>Stream 16 · 0.04 bar → C-102');
    C['ME-101'] = cw; }

  // ---------------- C-101 compressor: impellers on the shaft
  { const f = F['C-101'], x = f.x, z = f.z, cw = new Cutaway(app, 'C-101', {x, z, r: 1.5, w: 9, y0: 1.2, y1: 5.2, depth: 2.4, li: 10});
    cw.hook(meshesOf('C-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const im = cw.mat({color: 0xd5d9dc, metalness: 0.9, roughness: 0.25}); const imps = [];
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 18, 12).rotateZ(Math.PI / 2), im); shaft.position.set(0, 2.72, 0); G.add(shaft);
    for (let k = 0; k < 6; k++) { const g = new THREE.Group(); g.position.set(-7.6 + k * 2.6 + (k > 1 ? 0.8 : 0) + (k > 3 ? 0.8 : 0), 2.72, 0); const d1 = new THREE.Mesh(new THREE.CylinderGeometry(1.05 - k * 0.06, 0.4, 0.3, 32).rotateZ(Math.PI / 2), im); g.add(d1);
      for (let j = 0; j < 14; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6 - k * 0.03, 0.04), im); const a = j / 14 * Math.PI * 2; b.position.set(0.1, Math.cos(a) * 0.62, Math.sin(a) * 0.62); b.rotation.x = -a + 0.5; g.add(b); } G.add(g); imps.push(g); }
    const gp = cloud(800, 0.12, 0xa8d8ff, {add: true, opacity: 0.6}); G.add(gp); const gs = gp.userData.seed;
    cw.updates.push(t => { imps.forEach(g => g.rotation.x = t * 9); const A = gp.geometry.attributes.position.array; for (let i = 0; i < 800; i++) { const s = gs[i], k = (t * 0.2 + s) % 1, a = s * 60 + k * 50, r = 0.5 + Math.abs(Math.sin(k * Math.PI * 6)) * 0.6; A[i * 3] = -8 + k * 16; A[i * 3 + 1] = 2.72 + Math.cos(a) * r; A[i * 3 + 2] = Math.sin(a) * r; } gp.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 4, z + 2));
    cw.callout([x - 6, 4.6, z], '<b>Suction</b>1.00 bar · 36.65 m³/s');
    cw.callout([x, 4.4, z], '<b>5 centrifugal stages</b>pressure ratio 2.187 each · 22.5 MW');
    cw.callout([x + 6, 4.6, z], '<b>Discharge</b>Stream 18 · 50 bar · 147 °C');
    C['C-101'] = cw; }

  // ---------------- R-103 methanol reactor: tubes with catalyst, boiling water on the shell side
  { const f = F['R-103'], x = f.x, z = f.z, cw = new Cutaway(app, 'R-103', {x, z, r: 1.76, w: 2.2, y0: 5.6, y1: 15.6, li: 15});
    cw.hook(meshesOf('R-103')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const tm = cw.mat({color: 0xc5cbd0, metalness: 0.9, roughness: 0.3}); const n = 420, tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 4.88, 6, 1, true), tm, n); const d = new THREE.Object3D(); let k = 0;
    for (let i = 0; i < 2000 && k < n; i++) { const a = i * 2.39996, rr = Math.sqrt(i / 2000) * 1.62; d.position.set(Math.cos(a) * rr, 7.2 + 2.44 + 0.6, Math.sin(a) * rr); d.updateMatrix(); if (i % 4 === 0) { tubes.setMatrixAt(k++, d.matrix); } } tubes.count = k; G.add(tubes);
    for (const y of [7.4, 12.6]) { const ts = new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.74, 0.14, 48), tm); ts.position.y = y; G.add(ts); }
    const wat = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 5.0, 48, 1, true), cw.mat({color: 0x5aa0c8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false})); wat.position.y = 10.0; G.add(wat);
    const bb = cloud(700, 0.12, 0xe9f6ff, {opacity: 0.85}), gg = cloud(500, 0.13, i => i % 3 ? 0xffd88a : 0xffffff, {add: true, opacity: 0.7}); G.add(bb, gg); const bs = bb.userData.seed, gs = gg.userData.seed;
    cw.updates.push(t => { const A = bb.geometry.attributes.position.array; for (let i = 0; i < 700; i++) { const s = bs[i], k = (t * 0.32 + s) % 1, a = s * 81, r = (s * 23 % 1) * 1.6; A[i * 3] = Math.cos(a) * r; A[i * 3 + 1] = 7.6 + k * 4.9; A[i * 3 + 2] = Math.sin(a) * r; } bb.geometry.attributes.position.needsUpdate = true;
      const B = gg.geometry.attributes.position.array; for (let i = 0; i < 500; i++) { const s = gs[i], k = (t * 0.4 + s) % 1, a = s * 97, r = (s * 31 % 1) * 1.55; B[i * 3] = Math.cos(a) * r; B[i * 3 + 1] = 13.4 - k * 6.6; B[i * 3 + 2] = Math.sin(a) * r; } gg.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 10, z));
    cw.callout([x, 14.2, z], '<b>Synthesis gas in</b>Stream 20 · 200 °C · 49.5 bar');
    cw.callout([x + 1.2, 11, z], '<b>3,447 tubes</b>44.45 mm × 4.88 m · Cu/ZnO/Al₂O₃ 17,752 kg');
    cw.callout([x - 1.2, 9, z], '<b>Boiling water (shell)</b>24.62 MW → 44.6 t/h steam at 11.75 bar');
    cw.callout([x, 6.6, z], '<b>CO + 2H₂ → CH₃OH</b>18.6 % CO per pass → Stream 21');
    C['R-103'] = cw; }

  // ---------------- F-101 flash drum: liquid level, droplets, vapour up
  { const f = F['F-101'], x = f.x, z = f.z, cw = new Cutaway(app, 'F-101', {x, z, r: 1.75, w: 2.1, y0: 1.5, y1: 13, li: 13});
    cw.hook(meshesOf('F-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 1.6, 48), cw.mat({color: 0x6fa9c9, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75})); liq.position.y = 2.4 + 0.8 - 0.7; G.add(liq);
    const dem = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 48), cw.mat({color: 0x9aa3aa, roughness: 0.8, wireframe: false})); dem.position.y = 10.2; G.add(dem);
    const dr = cloud(500, 0.11, 0x9fd0ef), vp = cloud(400, 0.18, 0xffffff, {add: true, opacity: 0.4}); G.add(dr, vp); const ds = dr.userData.seed, vs = vp.userData.seed;
    cw.updates.push(t => { liq.position.y = 1.7 + Math.sin(t * 1.3) * 0.04; const A = dr.geometry.attributes.position.array; for (let i = 0; i < 500; i++) { const s = ds[i], k = (t * 0.5 + s) % 1; A[i * 3] = -1.6 + k * 1.2 + (s * 7 % 1) * 0.6; A[i * 3 + 1] = 7.4 - k * k * 4.6; A[i * 3 + 2] = (s * 13 % 1 - 0.5) * 1.0; } dr.geometry.attributes.position.needsUpdate = true;
      const B = vp.geometry.attributes.position.array; for (let i = 0; i < 400; i++) { const s = vs[i], k = (t * 0.22 + s) % 1, a = s * 50, r = (s * 17 % 1) * 1.5; B[i * 3] = Math.cos(a) * r; B[i * 3 + 1] = 3 + k * 8.5; B[i * 3 + 2] = Math.sin(a) * r; } vp.geometry.attributes.position.needsUpdate = true; });
    cw.light.position.copy(toW(x, 7, z));
    cw.callout([x, 11.6, z], '<b>Vapour</b>Stream 23 · 14,363 kmol/h → recycle');
    cw.callout([x - 1, 7.4, z], '<b>Feed</b>Stream 22 · 40 °C · 47 bar');
    cw.callout([x, 2.6, z], '<b>Crude methanol</b>Stream 26 · level 0.90 m (LC-318)');
    C['F-101'] = cw; }

  // ---------------- T-101 distillation: 52 sieve trays, liquid down, vapour up
  { const f = F['T-101'], x = f.x, z = f.z, cw = new Cutaway(app, 'T-101', {x, z, r: 1.69, w: 2.1, y0: 3.6, y1: 39.5, li: 8});
    cw.hook(meshesOf('T-101')); const G = new THREE.Group(); cw.add(G, [x, 0, z]);
    const trayM = cw.mat({color: 0xaab2b8, metalness: 0.8, roughness: 0.35}); const n = 52, y0 = 6.0, sp = 0.6;
    const trays = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.66, 1.66, 0.05, 40), trayM, n), dcs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.5, 2.2), trayM, n);
    const liq = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.64, 1.64, 0.07, 40), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.7}), n); const d = new THREE.Object3D(), cc = new THREE.Color();
    for (let i = 0; i < n; i++) { const y = y0 + i * sp; d.position.set(0, y, 0); d.rotation.set(0, 0, 0); d.updateMatrix(); trays.setMatrixAt(i, d.matrix); d.position.y = y + 0.06; d.updateMatrix(); liq.setMatrixAt(i, d.matrix);
      const w = i / (n - 1); liq.setColorAt(i, cc.setRGB(0.42 + w * 0.5, 0.62 + w * 0.3, 0.85 - w * 0.25)); d.position.set(i % 2 ? 1.2 : -1.2, y - 0.25 + 0.28, 0); d.updateMatrix(); dcs.setMatrixAt(i, d.matrix); }
    G.add(trays, liq, dcs); liq.material.clippingPlanes = cw.planes; liq.material.clipIntersection = true;
    const vap = cloud(1600, 0.1, i => 0xffffff, {add: true, opacity: 0.6}), lq = cloud(900, 0.08, 0x8ec5ee); G.add(vap, lq); const vs = vap.userData.seed, ls = lq.userData.seed;
    cw.updates.push(t => { const A = vap.geometry.attributes.position.array; for (let i = 0; i < 1600; i++) { const s = vs[i], tr = Math.floor(s * (n - 1)), k = (t * 1.4 + s * 17) % 1, a = s * 333, r = (s * 71 % 1) * 1.1; A[i * 3] = Math.cos(a) * r; A[i * 3 + 1] = y0 + tr * sp + 0.1 + k * (sp - 0.1); A[i * 3 + 2] = Math.sin(a) * r; } vap.geometry.attributes.position.needsUpdate = true;
      const B = lq.geometry.attributes.position.array; for (let i = 0; i < 900; i++) { const s = ls[i], tr = Math.floor(s * (n - 1)) + 1, k = (t * 1.1 + s * 13) % 1, side = tr % 2 ? 1 : -1; B[i * 3] = side * (1.35 + (s * 7 % 1) * 0.25); B[i * 3 + 1] = y0 + tr * sp - k * sp; B[i * 3 + 2] = (s * 19 % 1 - 0.5) * 1.6; } lq.geometry.attributes.position.needsUpdate = true; });
    cw.callout([x, 38.6, z], '<b>Overhead vapour → condenser</b>18.84 MW');
    cw.callout([x, y0 + 48 * sp, z], '<b>Distillate 99.5 mol % methanol</b>Stream 29 · reflux ratio 0.8231');
    cw.callout([x, y0 + 13 * sp, z], '<b>Feed tray 39</b>Stream 27 · 1,526 kmol/h');
    cw.callout([x, y0 + 4 * sp, z], '<b>52 sieve trays</b>0.60 m spacing · 46.15 % efficiency');
    cw.callout([x, 4.4, z], '<b>Bottoms water</b>Stream 28 · reboiler 19.98 MW');
    C['T-101'] = cw; }
  return C;
}
function pellets() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#4a4744'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { const v = 70 + Math.random() * 60 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 8})`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace; return t; }
