// Colour key of the printed model (MPW_Plant_Model, 1:150 board): every unit and every stream of the 3D plant takes the colour
// of its part on the printed board, read from the board file 3D_preview_assembled_model.3mf (object names and their filament colours):
//   red    #D23A2E  reactors, heaters & hot streams          blue  #2F6FD6  coolers, cooled streams & water
//   gold   #C9A227  separation units & separated streams     grey  #B4BBC3  mixers, dividers & tanks
//   white  #F2F2F0  machines & final products (and the steel structures)
// A stream takes the colour of the unit it leaves, as on the board. The section tiles use the six section colours of the board.
import * as THREE from 'three';
import {TRAINS} from './plant.js';

export const KEY = {R: 0xD23A2E, B: 0x2F6FD6, G: 0xC9A227, Y: 0xB4BBC3, W: 0xF2F2F0, P: 0xF9F9F8, PAD: 0xE2E5E9};
export const KEY_NAMES = [['R', 'Reactors, heaters & hot streams'], ['B', 'Coolers, cooled streams & water'], ['G', 'Separation units & separated streams'], ['Y', 'Mixers, dividers & tanks'], ['W', 'Machines & final products']];
// equipment of the board (object name in the 3MF → colour) and the unit of the 3D plant that carries it
export const BOARD = [
  ['CR-101 crushers', 'W', 'CR-101'], ['MPW conveyor', 'W', 'CONV'], ['E-101 boilers (2 units)', 'R', 'E-101'], ['E-102 superheater', 'R', 'E-102'], ['D-101 steam divider', 'Y', 'D-101'],
  ['R-101 gasifier', 'R', 'R-101'], ['R-101 feed bin + screw', 'W', 'R-101'], ['CY-101 cyclones (3)', 'G', 'CY-101'], ['D-102 syngas divider', 'Y', 'D-102'], ['M-101 syngas-steam mixer', 'Y', 'M-101'],
  ['E-103 syngas coolers (2 units)', 'B', 'E-103'], ['R-102 shift reactor', 'R', 'R-102'], ['ME-101 membrane bank', 'G', 'ME-101'], ['C-102 permeate vacuum compressor', 'W', 'C-102'], ['H2 export compressor', 'W', 'C-102'],
  ['C-101 compressor train', 'W', 'C-101'], ['IC-1 to IC-4 intercoolers', 'B', 'C-101'], ['M-102 synthesis-loop mixer', 'Y', 'M-102'], ['E-104 syngas feed cooler', 'B', 'E-104'], ['R-103 methanol reactor', 'R', 'R-103'],
  ['R-103 steam drum + structure', 'W', 'R-103'], ['R-103 steam drum', 'Y', 'R-103'], ['E-105 effluent cooler (4 shells)', 'B', 'E-105'], ['F-101 flash drum', 'G', 'F-101'], ['D-103 recycle/purge divider', 'Y', 'D-103'],
  ['T-101 distillation column', 'G', 'T-101'], ['T-101 overhead structure', 'W', 'T-101'], ['T-101 condenser', 'B', 'T-101'], ['T-101 reflux drum', 'Y', 'T-101'], ['Reflux pump', 'W', 'T-101'], ['T-101 kettle reboiler', 'R', 'T-101'],
  ['V-101 let-down valve', 'W', 'V-101'], ['TK-101 A methanol tank', 'Y', 'TANKS'], ['TK-101 B methanol tank', 'Y', 'TANKS']];
// streams: number → colour of the unit it leaves (board objects "Raw syngas (8)", "Clean syngas (10)", …); 32–42 are the heat-integration streams of the 3D plant
export const SCOL = {1: 'W', 2: 'W', 3: 'B', 4: 'R', 5: 'R', 6: 'Y', 7: 'Y', 8: 'R', 9: 'G', 10: 'G', 11: 'Y', 12: 'Y', 13: 'Y', 14: 'B', 15: 'R', 16: 'W', 17: 'G', 18: 'W', 19: 'Y', 20: 'B', 21: 'R', 22: 'B',
  23: 'G', 24: 'Y', 25: 'Y', 26: 'G', 27: 'W', 28: 'B', 29: 'W', 30: 'B', 31: 'W', 32: 'R', 33: 'R', 34: 'B', 35: 'R', 36: 'G', 37: 'R', 38: 'B', 39: 'R', 40: 'R', 41: 'B', 42: 'R'};
export const SECTIONS = [
  [1, 'Feed preparation & steam generation', 0xF3EBD8, ['CR-101', 'E-101', 'E-102', 'D-101']], [2, 'Gasification & gas cleaning', 0xE9D5B7, ['R-101', 'CY-101', 'D-102', 'M-101']],
  [3, 'Water-gas shift & H₂ separation', 0xCFE3F1, ['E-103', 'R-102', 'ME-101', 'C-102']], [4, 'Syngas compression', 0xD9DCE0, ['SC', 'C-101', 'C-101R']],
  [5, 'Methanol synthesis', 0xF3EBB0, ['M-102', 'E-106', 'E-104', 'R-103', 'E-107', 'E-105', 'F-101', 'D-103']], [6, 'Methanol purification', 0xE2D7F0, ['V-101', 'T-101', 'TANKS']]];
const BODY = {'CR-101': 'W', CONV: 'W', 'E-101': 'R', 'E-102': 'R', 'D-101': 'Y', 'R-101': 'R', 'CY-101': 'G', 'D-102': 'Y', 'M-101': 'Y', 'E-103': 'B', 'R-102': 'R', 'ME-101': 'G', 'C-102': 'W', SC: 'B', 'C-101': 'W',
  'C-101R': 'W', 'M-102': 'Y', 'E-104': 'B', 'R-103': 'R', 'E-105': 'B', 'F-101': 'G', 'D-103': 'Y', 'T-101': 'G', 'V-101': 'W', TANKS: 'Y', 'E-106': 'R', 'E-107': 'R', HDR: 'G', RACK: 'P'};
const STRUCT = new Set(['steelG', 'grate', 'yellow', 'galv']), KEEP = new Set(['concV', 'conc', 'curb', 'asph', 'gravel', 'sand', 'road', 'cross', 'grass', 'glass', 'wallWin', 'frond', 'trunk']);
// colour of one vertex of a unit (plant frame, metres); null keeps the real material
function vcol(id, mk, x, y, z) { if (KEEP.has(mk)) return mk === 'concV' || mk === 'conc' ? 'PAD' : null;
  if (id === 'TANKS' && z < -45) return null;                                       // loading bays north of the tank farm are not on the board
  if (id === 'R-101') { const dx = Math.min(...TRAINS.map(t => Math.abs(x - (t + 4.5)))); if (z > -14.5 && z < -6.8 && dx < 2.6) return 'W'; }      // feed bin and screw feeder
  if (STRUCT.has(mk)) return 'W';
  if (id === 'C-101' && x > 57.5 && x < 78.5 && z > 46.3 && z < 54.7 && y < 4.6) return 'B';                                                         // IC-1 … IC-4
  if (id === 'SC' && z > 48.6) return x > 51 ? 'W' : 'G';                                                                                           // KO drum and its pump
  if (id === 'R-103' && z < -16.2 && y > 15.6) return 'Y';                                                                                         // steam drum
  if (id === 'T-101') { if (z < -27.5) return y > 15.6 ? 'B' : (y > 10.3 && y < 13.4 && x > 106 && x < 113.8) ? 'Y' : 'W';                       // condenser, reflux drum, structure and pump
    if (z > -10.6 && y < 4.5) return x > 111.5 ? 'R' : 'W'; return 'G'; }                                                                         // kettle reboiler, bottoms pump, column
  return BODY[id] || null; }

export function makeColourKey(C) {
  const {P, L, toW, mkEl, XL, FLOWS} = C; const root = P.root, col = new THREE.Color(), state = {on: false, built: false};
  const lin = k => { col.setHex(KEY[k]); return [col.r, col.g, col.b]; };
  function modelMat(m) { const n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; n.vertexColors = true; n.color = new THREE.Color(0xffffff);
    if ('metalness' in n) { n.metalness = Math.min(n.metalness, 0.18); n.roughness = Math.max(n.roughness, 0.48); } return n; }
  // vertex colours of the units
  function paintUnit(id, mesh) { const g = mesh.geometry, p = g.attributes.position, n = p.count, mk = mesh.userData.mk, a = new Float32Array(n * 3), base = mesh.material.color || col.set(0xffffff); let any = false;
    for (let i = 0; i < n; i++) { const k = vcol(id, mk, p.getX(i), p.getY(i), p.getZ(i)); let r, gg, b; if (k) { [r, gg, b] = lin(k); any = true; } else { r = base.r; gg = base.g; b = base.b; } a[3 * i] = r; a[3 * i + 1] = gg; a[3 * i + 2] = b; }
    if (!any) return false; g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return true; }
  // vertex colours of the piping: nearest stream centre line (grid of the segments, 6 m cells)
  function paintStreams(mesh) { const segs = []; for (const id in P.streams) { const s = P.streams[id], k = SCOL[id]; if (!s.pts || !k || s.virtual) continue; for (let i = 1; i < s.pts.length; i++) segs.push([s.pts[i - 1], s.pts[i], k]); }
    const cell = 6, grid = new Map(), key = (i, j) => i * 100003 + j;
    segs.forEach((sg, si) => { const [a, b] = sg; const i0 = Math.floor(Math.min(a.x, b.x) / cell) - 1, i1 = Math.floor(Math.max(a.x, b.x) / cell) + 1, j0 = Math.floor(Math.min(a.z, b.z) / cell) - 1, j1 = Math.floor(Math.max(a.z, b.z) / cell) + 1;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = key(i, j); (grid.get(kk) || grid.set(kk, []).get(kk)).push(si); } });
    const g = mesh.geometry, p = g.attributes.position, n = p.count, a = new Float32Array(n * 3), mk = mesh.userData.mk, v = new THREE.Vector3(), ab = new THREE.Vector3(), av = new THREE.Vector3();
    const [wr, wg, wb] = lin('W');
    for (let i = 0; i < n; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)); let best = 1e9, bk = null; const list = STRUCT.has(mk) ? null : grid.get(key(Math.floor(v.x / cell), Math.floor(v.z / cell)));
      if (list) for (const si of list) { const [A, B, k] = segs[si]; ab.subVectors(B, A); const L2 = ab.lengthSq(); const t = L2 > 0 ? Math.max(0, Math.min(1, av.subVectors(v, A).dot(ab) / L2)) : 0; const d = av.copy(A).addScaledVector(ab, t).distanceToSquared(v); if (d < best) { best = d; bk = k; } }
      let r = wr, gg = wg, b = wb; if (bk && best < 9) [r, gg, b] = lin(bk); a[3 * i] = r; a[3 * i + 1] = gg; a[3 * i + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  const LIST = [];   // [mesh, model material]
  function build() { if (state.built) return; state.built = true; const t0 = performance.now();
    for (const id in P.units) { const u = P.units[id]; if (!u.group || !(id in BODY) && id !== 'R-101') continue; u.group.children.forEach(m => { if (!m.isMesh || m.isInstancedMesh) return; const real = m.userData.orig || m.userData.base || m.material; if (!real || !real.color) return;
        const tmp = m.material; m.material = real; const ok = paintUnit(id, m); m.material = tmp; if (ok) LIST.push([m, modelMat(real), real]); }); }
    const sg = root.children.find(o => o.name === 'streams'); if (sg) sg.children.forEach(m => { if (!m.isMesh || !m.material.color) return; paintStreams(m); LIST.push([m, modelMat(m.material), m.material]); });
    // section tiles under the units and their plates (as on the board)
    const tg = new THREE.Group(); tg.name = 'board-sections'; tg.visible = false; root.add(tg); state.tiles = tg; state.plates = [];
    for (const [n, name, c, ids] of SECTIONS) { const mat = new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: 0.94, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3}); const box = new THREE.Box3();
      for (const id of ids) { const u = P.units[id]; if (!u || !u.box) continue; let b = u.box.clone(); if (id === 'TANKS') { b.min.z = Math.max(b.min.z, -45); } box.union(b);
        const w = b.max.x - b.min.x + 5, d = b.max.z - b.min.z + 5, tile = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); tile.rotation.x = -Math.PI / 2; tile.position.set((b.min.x + b.max.x) / 2, 0.27, (b.min.z + b.max.z) / 2); tile.renderOrder = 1; tg.add(tile); }
      const c0 = box.getCenter(new THREE.Vector3()); const el = mkEl('xl sec', `<b>Section ${n}</b><span>${name}</span>`); const o = {el, p: toW(c0.x, Math.min(box.max.y + 6, 44), c0.z), on: false, want: false, sfx: ' translate(-50%,-100%)'}; XL.push(o); state.plates.push(o); }
    state.ms = Math.round(performance.now() - t0); }
  function setFlowColours(on) { for (const id in FLOWS) { const m = FLOWS[id]; if (!m) continue; const k = SCOL[id]; if (!m.userData.c0) m.userData.c0 = m.material.uniforms.uC.value.clone(); m.material.uniforms.uC.value.copy(on && k ? new THREE.Color(KEY[k]) : m.userData.c0); } }
  function apply(on) { build(); state.on = on;
    for (const [m, mm, real] of LIST) { for (const k in m.userData) if (k.startsWith('hl')) delete m.userData[k];
      if (m.userData.orig) m.userData.orig = on ? mm : real; if (m.userData.base) m.userData.base = on ? mm : real; if (!m.userData.cut) m.material = on ? mm : real; }
    state.tiles.visible = on; state.plates.forEach(p => p.want = on); setFlowColours(on); C.renderer.shadowMap.needsUpdate = true; }
  // a check that every equipment of the board has its colour in the 3D plant (run with ?check in the address)
  function check() { build(); const out = []; for (const [name, k, id] of BOARD) { const u = P.units[id]; let hit = 0, tot = 0; const want = lin(k);
      if (u) u.group.children.forEach(m => { const c = m.geometry && m.geometry.attributes.color; if (!c) return; for (let i = 0; i < c.count; i++) { tot++; if (Math.abs(c.getX(i) - want[0]) < 1e-4 && Math.abs(c.getY(i) - want[1]) < 1e-4 && Math.abs(c.getZ(i) - want[2]) < 1e-4) hit++; } });
      out.push([name, k, id, !!u, hit]); } return out; }
  return {apply, check, get on() { return state.on; }, build, state, reapply() { if (state.on) apply(true); }};
}
