// The MPW gasification complex, laid out on the 420 m × 300 m plot of Figure 9.2 (x east, z south, metres).
// Process order follows the PFD (Figures 3.79 / 4.18): feed → gasification → shift → membrane (north row),
// compression → methanol synthesis → purification (south row), joined by the main pipe rack at z = 22.
import * as THREE from 'three';
import {Kit, pipeRun, vVessel, hDrum, hx, pump, compressor, frame, pipeRack, ringPlatform, caged, stairs, railLine, tank, building, palm, car, truck, road, blob} from './kit.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RZ = 22, RW = 8, TIER = [6.5, 9.5];               // main pipe rack
const lane = (k) => RZ - 3 + k * 1.2;                     // 6 lanes across the rack
export const TRAINS = [-66, -48, -30, -12, 6];            // x of the five gasifier trains

// orthogonal routing: insert corners so that every segment is parallel to an axis.
function ortho(pts, lastOrder = 'xzy') { const out = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) { const a = out[out.length - 1], b = pts[i], ord = i === pts.length - 1 || i === pts.length - 2 ? lastOrder : 'yxz'; let c = a.clone();
    for (const ax of ord) { if (Math.abs(c[ax] - b[ax]) > 1e-3) { c = c.clone(); c[ax] = b[ax]; out.push(c); } } }
  return out; }
// a → b between two nozzles {p, d}. via = list of [x,y,z] waypoints.
function route(a, b, via = [], o = {}) { const s1 = o.s1 ?? 1.0, s2 = o.s2 ?? 1.0;
  const A1 = a.p.clone().addScaledVector(a.d, s1), B1 = b.p.clone().addScaledVector(b.d, s2);
  const pts = [a.p.clone(), A1, ...via.map(v => V(...v)), B1, b.p.clone()]; return ortho(pts, o.order || 'xzy'); }
const rackVia = (x0, x1, k, t = 0) => [[x0, TIER[t] + 0.45 + 0.35, lane(k)], [x1, TIER[t] + 0.45 + 0.35, lane(k)]];

export function buildPlant(M, T, opts = {}) {
  const root = new THREE.Group(); root.name = 'plant';
  const units = {}, streams = {}, anim = [], featured = {};
  const R = (() => { let s = 77; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const unitKit = id => (units[id] || (units[id] = {id, K: new Kit(), extra: []})).K;
  const site = new Kit();
  const N = {};                                           // nozzles by name

  // ================================================================ ground: plot, paving, roads, fences, landscaping
  site.plane(470, 350, 'sand', 0, 0.02, 0);
  const pave = (x0, z0, x1, z1, mk = 'conc', y = 0.12) => site.box(x1 - x0, y, z1 - z0, mk, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  pave(-195, -42, 130, 93, 'gravel', 0.1);                  // process block (gravel; concrete pads under the units)
  road(site, -100, 29.6, 130, 29.6, 5.5); road(site, -100, -40, 130, -40, 5.5); road(site, -94, -40, -94, 93, 5.5); road(site, 128, -40, 128, 93, 5); road(site, -100, 92, 130, 92, 5);
  pave(-198, -140, -92, -53, 'asph'); pave(-90, -140, 28, -53, 'conc'); pave(30, -140, 133, -53, 'conc'); pave(136, -140, 205, -53, 'asph');
  pave(138, -45, 205, 45, 'gravel', 0.1); pave(138, 47, 205, 93, 'conc'); pave(-196, 104, -96, 138, 'asph'); pave(-90, 104, 50, 138, 'gravel', 0.1); pave(52, 104, 130, 138, 'gravel', 0.1);
  // internal roads (12 m) with markings
  const rd = (a, b, c, d, w = 11) => road(site, a, b, c, d, w);
  rd(-205, -48, 212, -48); rd(-205, 98, 212, 98); rd(134, -146, 134, 146, 10); rd(-205, -146, -205, 146, 10); rd(-205, 143, 212, 143); rd(-205, -146, 212, -146); rd(210, -146, 210, 146, 10);
  rd(-91, -146, -91, -48, 8); rd(29, -146, 29, -48, 8);
  for (const [x, z, ry] of [[-120, -48, 0], [20, -48, 0], [134, 30, 1], [-60, 98, 0], [100, 98, 0]]) site.plane(ry ? 11 : 6, ry ? 6 : 11, 'cross', x, 0.1, z);
  // fence with posts
  for (const [x0, z0, x1, z1] of [[-212, -151, 214, -151], [-212, 151, 214, 151], [-212, -151, -212, 151], [214, -151, 214, 151]]) { const L = Math.hypot(x1 - x0, z1 - z0); site.box(Math.max(0.05, Math.abs(x1 - x0)), 2.2, Math.max(0.05, Math.abs(z1 - z0)), 'galv', (x0 + x1) / 2, 0, (z0 + z1) / 2);
    for (let t = 0; t <= L; t += 4) site.box(0.12, 2.5, 0.12, 'galv', x0 + (x1 - x0) * t / L, 0, z0 + (z1 - z0) * t / L); }
  // palms along the north and south roads, hedges
  for (let x = -195; x < 205; x += 11) { palm(site, x, -138.8, 1, R); palm(site, x + 5, 106.2, 0.95, R); }
  for (let x = -195; x < 125; x += 13) palm(site, x, -54.6, 0.85, R);
  site.box(320, 0.8, 1.2, 'hedge', -35, 0, -51);

  // ================================================================ north strip: administration, amenities, services, loading
  const bk = site;
  building(bk, -160, -112, 46, 26, 11, {win: true, roof: 'roofB', hvac: 4});                  // administration
  building(bk, -112, -112, 18, 26, 7, {win: true, roof: 'roofG'});                            // canteen
  for (let i = 0; i < 60; i++) car(bk, -190 + (i % 15) * 6.2, -84 + Math.floor(i / 15) * 7.5, Math.PI / 2, ['carW', 'carK', 'carS', 'carW', 'carR'][i % 5]);
  // mosque with dome and minaret
  building(bk, -62, -116, 22, 20, 7, {wall: 'white', roof: 'white'}); bk.sphere(6, 'white', -62, 7.9, -116, 28, 14); bk.cyl(1.2, 24, 'white', -48, 0.3, -124, 14); bk.cyl(1.7, 1.6, 'white', -48, 22.5, -124, 14); bk.cyl(1.0, 3, 'white', -48, 24.1, -124, 14, 0.05);
  building(bk, -30, -116, 26, 22, 6, {win: true, roof: 'roofG'});                            // clinic
  bk.box(50, 0.3, 24, 'grass', -40, 0.1, -76); for (let i = 0; i < 12; i++) palm(bk, -62 + (i % 6) * 9, -82 + Math.floor(i / 6) * 13, 0.75, R);
  // fire station: red roof, open bays with fire engines (as in the reference view)
  building(bk, 4, -112, 34, 20, 8, {roof: 'roofR', gable: 2.2, doors: 5, doorW: 4.6, doorH: 5.4, doorMk: 'red'});
  for (let i = 0; i < 3; i++) truck(bk, -6 + i * 7.6, -96, -Math.PI / 2, 'fire', 'carR');
  building(bk, 62, -116, 48, 26, 9, {roof: 'roofG', gable: 2.5, doors: 4});                  // workshop and warehouse
  units.CONTROL = {id: 'CONTROL', K: new Kit(), extra: []}; building(units.CONTROL.K, 62, -72, 34, 20, 7, {win: true, roof: 'roofB', hvac: 3});
  building(bk, 108, -116, 34, 26, 8, {win: true, roof: 'roofB', hvac: 2});                   // laboratory and operators
  // product loading bays
  { const K = unitKit('TANKS'); for (let i = 0; i < 3; i++) { frame(K, 152 + i * 16, -96, 7, 14, [6.5], {floors: true, brace: false}); truck(K, 152 + i * 16, -96, Math.PI / 2, 'tanker'); }
    building(K, 190, -120, 18, 14, 5, {win: true, roof: 'roofB'}); }

  // ================================================================ feed preparation: MPW hall, shredders, conveyor
  { const K = unitKit('HALL'); building(K, -147, 6, 74, 70, 13, {roof: 'roofBr', gable: 5, wall: 'wall', doors: 0});
    for (let i = 0; i < 4; i++) { K.box(0.3, 6, 6, 'yellow', -184.2, 0.35, -18 + i * 16); truck(K, -197, -18 + i * 16, 0, 'box', 'carW'); } }
  { // CR-101 A/B under an open steel shed (walls cut so the shredding can be watched)
    const K = unitKit('CR-101'); const cx = -125, cz = 66;
    frame(K, cx, cz, 30, 30, [11], {floors: false, brace: false, nx: 3, nz: 3}); K.box(31, 0.35, 31, 'roofG', cx, 11, cz);
    for (const dz of [-7, 7]) { const sx = cx - 2, sz = cz + dz;                 // shredder: hopper, housing, motor and gearbox
      K.box(6, 3.2, 4.4, 'blue', sx, 0.4, sz); K.box(6.4, 0.4, 4.8, 'dark', sx, 0, sz);
      K.add(new THREE.CylinderGeometry(1, 3.0, 2.6, 4, 1, true).rotateY(Math.PI / 4).translate(sx, 4.9, sz), 'galv');
      K.add(new THREE.CylinderGeometry(0.65, 0.65, 2.2, 18).rotateX(Math.PI / 2).translate(sx + 4, 1.6, sz), 'blue'); K.box(1.6, 1.6, 1.6, 'blueD', sx + 4, 0.8, sz - 2.4);
      featured['CR-101'] = featured['CR-101'] || {parts: []}; featured['CR-101'].parts.push({x: sx, z: sz}); }
    // discharge conveyor to the transfer tower
    N.crOut = {p: V(cx + 6, 1.4, cz), d: V(1, 0, 0)}; }
  // conveyor gallery: crusher → transfer tower (−86, −12) → feed conveyor over the trains (z = −12.4, y = 29)
  const conv = new Kit(); { const a = V(-112, 3, 60), b = V(-86, 27.5, -8), d = b.clone().sub(a), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d.clone().normalize()); const g = new THREE.BoxGeometry(L, 2.0, 2.4); g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); conv.add(g, 'steelG');
    for (let t = 0.1; t < 0.95; t += 0.11) { const p = a.clone().lerp(b, t); conv.box(0.35, p.y - 1.0, 0.35, 'steelG', p.x - 1, 0, p.z); conv.box(0.35, p.y - 1.0, 0.35, 'steelG', p.x + 1, 0, p.z); }
    frame(conv, -86, -12, 7, 7, [9, 18, 27], {nx: 1, nz: 1}); conv.box(7.6, 3.2, 7.6, 'roofG', -86, 27, -12);
    const y = 29.2, zc = -12.4; conv.box(TRAINS[4] + 6 - (-86), 2.0, 2.4, 'steelG', (-86 + TRAINS[4] + 6) / 2, y - 1.0, zc);
    for (const x of TRAINS) { conv.box(0.3, 8, 0.3, 'steelG', x + 4.5, 21.2, zc - 1.1); conv.box(0.3, 8, 0.3, 'steelG', x + 4.5, 21.2, zc + 1.1); }
    N.convPath = [a, b, V(-86, y, zc), V(TRAINS[4] + 4.5, y, zc)]; }
  units.CONV = {id: 'CONV', K: conv, extra: [], hidden: true};

  // ================================================================ steam system: E-101 A/B (flue-gas boiler), D-101
  { const K = unitKit('E-101'); for (const [i, z] of [[0, -22], [1, -4]]) { const x = -99;
      K.box(13, 10, 7, 'galv', x, 0.4, z); K.box(13.4, 0.5, 7.4, 'dark', x, 10.4, z); for (let k = 0; k < 6; k++) K.box(0.15, 10, 7.2, 'paint2', x - 6 + k * 2.4, 0.4, z);
      K.cyl(1.1, 22, 'galv', x + 4.5, 10.9, z, 18); K.cyl(1.3, 0.6, 'dark', x + 4.5, 32.4, z, 18); K.box(1.2, 0.6, 7.6, 'concV', x, 0, z);
      N['e101in' + i] = {p: V(x - 6.8, 3, z), d: V(-1, 0, 0)}; N['e101out' + i] = {p: V(x - 3, 10.9, z), d: V(0, 1, 0)}; N['e101fg' + i] = {p: V(x + 6.6, 8, z), d: V(1, 0, 0)};
      N['e101hin' + i] = {p: V(x - 2, 7.5, z + 4.1), d: V(0, 0, 1)}; N['e101hout' + i] = {p: V(x + 2, 2.2, z + 4.1), d: V(0, 0, 1)}; K.seg([x - 2, 7.5, z + 3.5], [x - 2, 7.5, z + 4.1], 0.3, 'galv', 12); K.seg([x + 2, 2.2, z + 3.5], [x + 2, 2.2, z + 4.1], 0.3, 'galv', 12); }
    pump(K, -118, -13, 0); }
  { const K = unitKit('D-101'); const d = hDrum(K, -84, 3.2, 40, {D: 3.6, L: 10.8, bands: 2, manway: true}); N.d101in = d.noz(-3, Math.PI / 2, 0.35); N.d101o7 = d.noz(2, Math.PI / 2, 0.35); N.d101o6 = d.noz(4, Math.PI / 2, 0.3); }

  // ================================================================ gasification: five dual-bed trains
  TRAINS.forEach((x, i) => {
    const feat = i === 0, K = unitKit('R-101'), C = unitKit('CY-101');
    // gasifier R-101: refractory-lined shell (D 7.5 m outside, 6.5 m bore), plenum and steam distributor
    const g = vVessel(K, x, -6, {D: 7.5, H: 6.5, y0: 3.2, mk: 'refr', seg: 48, rings: 1.6, plat: [{y: 8.4, t0: -0.4, tl: Math.PI * 1.5}], ladder: {a: -0.3, y1: 8.4}, manways: [[6.6, -Math.PI / 2]], topNozzle: false, cut: feat});
    K.cyl(1.0, 2.2, 'refr', x, g.top - 0.3, -6, 20); N['r101top' + i] = {p: V(x, g.top + 1.9, -6), d: V(0, 1, 0)};
    N['r101st' + i] = g.noz(3.6, -Math.PI / 2, 0.4, 0.8);      // steam from below into the plenum (south side)
    // feed bin and screw feeder on the east wall, fed from the conveyor above
    K.seg([x + 4.5, 28, -12.4], [x + 4.5, 22, -12.4], 0.35, 'galv', 10); K.add(new THREE.CylinderGeometry(1.5, 0.5, 2.6, 4, 1).rotateY(Math.PI / 4).translate(x + 4.5, 20.4, -12.4), 'galv'); K.box(2.0, 6, 2.0, 'galv', x + 4.5, 13.2, -12.4);
    K.box(2.4, 0.4, 2.4, 'steelG', x + 4.5, 12.8, -12.4); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.25, 12.8, 0.25, 'steelG', x + 4.5 + sx, 0, -12.4 + sz);
    K.seg([x + 4.5, 13.2, -12.4], [x + 4.5, 6.4, -9.2], 0.42, 'galv', 12); K.add(new THREE.CylinderGeometry(0.42, 0.42, 3.0, 14).rotateZ(Math.PI / 2).translate(x + 4.0, 5.2, -8.0), 'galv'); K.add(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 14).rotateZ(Math.PI / 2).translate(x + 6.0, 5.2, -8.0), 'blue'); K.seg([x + 4.5, 6.4, -9.2], [x + 4.5, 5.2, -8.0], 0.42, 'galv', 12);
    // combustor riser (north), chutes between the beds, flue gas to the duct
    K.cyl(1.7, 24, 'refr', x, 2.4, -30, 28); K.cyl(1.9, 2.4, 'concV', x, 0, -30, 28); K.lathe([[1.7, 0], [1.2, 1.2], [0.8, 1.6]], 'refr', x, 26.4, -30, 24);
    K.seg([x, 4.5, -26.6], [x, 4.5, -9.7], 0.55, 'refr', 14);
    frame(K, x, -30, 7, 7, [9, 17, 25], {nx: 1, nz: 1});
    K.seg([x, 28, -30], [x, 30, -30], 0.9, 'refr', 16);
    // cyclones CY-101 ×3: body 3.5 × 7 m, cone 7 m, on an elevated structure between gasifier and combustor
    frame(C, x, -18, 14, 6, [7.2, 14, 21.4], {nx: 2, nz: 1});
    for (let k = 0; k < 3; k++) { const cx = x - 4.4 + k * 4.4, cz = -18;
      C.cyl(1.75, 7, 'cladS', cx, 14, cz, 32); C.add(new THREE.CylinderGeometry(1.75, 0.35, 7, 32, 1, true).translate(cx, 10.5, cz), 'cladS'); C.lathe([[1.75, 0], [1.2, 0.5], [0.7, 0.7]], 'cladS', cx, 21, cz, 28);
      C.cyl(0.62, 2.6, 'cladS', cx, 21.4, cz, 18);                       // vortex finder / gas outlet
      C.box(1.75, 0.7, 2.2, 'cladS', cx, 19.6, cz + 1.75);                // tangential inlet
      C.seg([cx, 7, cz], [cx, 2.0, cz - 5.6], 0.32, 'cladS', 12); C.seg([cx, 2.0, cz - 5.6], [x, 2.6, -28.3], 0.32, 'cladS', 12); // dipleg to the combustor (Stream 9)
      if (k === 0 && feat) featured['CY-101'] = {x: cx, z: cz}; }
    // raw gas duct gasifier top → cyclone inlets (Stream 8)
    pipeRun(C, [N['r101top' + i].p, V(x, 21.6, -6), V(x, 21.6, -15.6)], 0.85, 'cladS', {flanges: false});
    C.box(13.2, 1.2, 1.4, 'cladS', x, 19.4, -15.4);
    // clean syngas collector on top of the cyclones → header (Stream 10)
    C.add(new THREE.CylinderGeometry(0.85, 0.85, 10, 20).rotateZ(Math.PI / 2).translate(x, 24.6, -18), 'clad');
    for (let k = 0; k < 3; k++) C.seg([x - 4.4 + k * 4.4, 24, -18], [x - 4.4 + k * 4.4, 24.6, -18], 0.62, 'clad', 14);
    N['cyOut' + i] = {p: V(x + 5, 24.6, -18), d: V(1, 0, 0)};
    if (feat) featured['R-101'] = {x, z: -6, g};
  });
  // syngas header along z = −18, y = 24.6 to D-102 (Stream 10)
  const hdr = new Kit(); hdr.add(new THREE.CylinderGeometry(1.1, 1.1, 20 - TRAINS[0], 24).rotateZ(Math.PI / 2).translate((TRAINS[0] + 20) / 2 + 2, 26.4, -18), 'clad');
  for (const x of TRAINS) pipeRun(hdr, [V(x + 5, 24.6, -18), V(x + 7, 24.6, -18), V(x + 7, 26.4, -18)], 0.85, 'clad', {flanges: false});
  // flue gas duct combustors → E-101 (y 30, z −30)
  hdr.add(new THREE.BoxGeometry(TRAINS[4] + 104 - 4, 2.2, 2.2).translate((TRAINS[4] - 104 + 4) / 2 - 0, 31, -30), 'galv');
  for (const x of TRAINS) { hdr.box(0.4, 30, 0.4, 'steelG', x + 3.2, 0, -32.5); hdr.box(0.4, 30, 0.4, 'steelG', x + 3.2, 0, -27.5); }
  pipeRun(hdr, [V(-98, 31, -30), V(-92, 31, -30), V(-92, 31, -13), V(-92, 8, -13)], 1.0, 'galv', {flanges: false});
  units.HDR = {id: 'HDR', K: hdr, extra: [], hidden: true};

  // ================================================================ gas cleaning, shift and hydrogen (north row, east)
  { const K = unitKit('D-102'); const v = vVessel(K, 22, -16, {D: 4.84, H: 14.5, y0: 3, plat: [{y: 13, tl: Math.PI * 1.4}], ladder: {a: -0.5, y1: 13}, rings: 1.4, mk: 'refr'}); N.d102in = {p: V(22, v.top + 0.7, -16), d: V(0, 1, 0)};
    N.d102o12 = v.noz(6, 0, 0.7, 0.8); N.d102o11 = v.noz(4.5, -Math.PI / 2, 0.55, 0.8); }
  pipeRun(units.HDR.K, [V(20 - 0.2, 26.4, -18), V(22, 26.4, -18), V(22, 26.4, -16), N.d102in.p], 1.0, 'clad', {flanges: false});
  { const K = unitKit('M-101'); const v = vVessel(K, 33, -16, {D: 4.5, H: 13.5, y0: 3, mk: 'refr', rings: 1.4, plat: [{y: 12, tl: Math.PI * 1.3, t0: 2}]}); N.m101in12 = v.noz(6, Math.PI, 0.7, 0.8); N.m101in6 = v.noz(9, Math.PI / 2, 0.35, 0.8); N.m101out = v.noz(4.5, -Math.PI / 2, 0.7, 0.8); }
  { const K = unitKit('E-102'); frame(K, 40, -2, 10, 5, [3.4], {nx: 1, nz: 1, rails: false}); const n = hx(K, 40, 5.0, -2, {D: 1.6, L: 8, saddleMk: 'steelG', nr: 0.55, nt: 0.3, base: 3.4}); N.e102s = n; }
  { const K = unitKit('E-103'); frame(K, 50, -16, 12, 6, [4.2], {nx: 2, nz: 1}); const a = hx(K, 50, 2.4, -16, {D: 1.8, L: 9, nr: 0.6, nt: 0.4, saddles: true}), b = hx(K, 50, 6.6, -16, {D: 1.8, L: 9, nr: 0.6, nt: 0.4, saddleMk: 'steelG', base: 4.2}); N.e103a = a; N.e103b = b; }
  { const K = unitKit('R-102'); const v = vVessel(K, 66, -16, {D: 5.4, H: 9.7, y0: 3, rings: 1.2, plat: [{y: 7.5, tl: Math.PI * 1.4, t0: 2.4}, {y: 12.8, tl: Math.PI * 1.6, t0: 2.4}], ladder: {a: 2.6, y1: 12.8}, davit: true, cut: true});
    N.r102in = {p: V(66, v.top + 0.7, -16), d: V(0, 1, 0)}; N.r102out = v.noz(3.4, -Math.PI / 2, 0.6, 0.8); featured['R-102'] = {x: 66, z: -16, v}; }
  { // ME-101: 26 vertical Pd–Ag modules in two rows inside a steel frame, with headers
    const K = unitKit('ME-101'); const x0 = 80, x1 = 102, z = -16; frame(K, (x0 + x1) / 2, z, x1 - x0 + 2, 9, [1.2, 7.4], {nx: 4, nz: 1});
    for (let r = 0; r < 2; r++) for (let k = 0; k < 13; k++) { const x = x0 + 1 + k * 1.65, zz = z - 2.2 + r * 4.4; K.cyl(0.55, 4.6, 'ss', x, 1.6, zz, 20); K.lathe([[0.55, 0], [0.3, 0.35], [0.2, 0.4]], 'ss', x, 6.2, zz, 16); K.lathe([[0.2, -0.4], [0.3, -0.35], [0.55, 0]], 'ss', x, 1.6, zz, 16);
      K.seg([x, 6.6, zz], [x, 7.9, zz], 0.12, 'ss', 8); K.seg([x, 1.2, zz], [x, 0.9, zz + (r ? -0.9 : 0.9)], 0.12, 'ss', 8); K.box(1.0, 0.25, 1.0, 'galv', x, 1.3, zz); }
    for (const zz of [z - 2.2, z + 2.2]) K.add(new THREE.CylinderGeometry(0.4, 0.4, x1 - x0, 18).rotateZ(Math.PI / 2).translate((x0 + x1) / 2 + 0.8, 7.9, zz), 'ss');
    K.add(new THREE.CylinderGeometry(0.45, 0.45, x1 - x0, 18).rotateZ(Math.PI / 2).translate((x0 + x1) / 2 + 0.8, 0.9, z), 'ss');
    N.meIn = {p: V(x0 - 0.5, 7.9, z - 2.2), d: V(-1, 0, 0)}; N.meRet = {p: V(x1 + 1.9, 7.9, z + 2.2), d: V(1, 0, 0)}; N.mePerm = {p: V(x1 + 1.9, 0.9, z), d: V(1, 0, 0)}; featured['ME-101'] = {x: x0 + 1 + 4 * 1.65, z: z + 2.2}; }
  { const K = unitKit('C-102'); const c = compressor(K, 107, -30, {casings: 2, r: 1.15, len: 3.4}); N.c102in = c.stages[0].in; N.c102out = c.stages[1].out; }
  { const K = unitKit('E-106'); const n = hx(K, -64, 2.4, 34, {D: 1.5, L: 8, nr: 0.5}); N.e106 = n; }

  // ================================================================ compression (south row, west)
  { const K = unitKit('SC'); frame(K, -64, 48, 10, 6, [4.2], {nx: 1, nz: 1}); const a = hx(K, -64, 2.4, 48, {D: 1.6, L: 8, nr: 0.5}), b = hx(K, -64, 6.6, 48, {D: 1.3, L: 7, nr: 0.45, saddleMk: 'steelG', base: 4.2}); N.sc1 = a; N.sc2 = b;
    const ko = vVessel(K, -52, 58, {D: 3, H: 6, y0: 2, plat: [{y: 7.6, tl: Math.PI}], ladder: {a: 0, y1: 7.6}}); N.koIn = ko.noz(5.5, Math.PI / 2, 0.5, 0.6); N.koOut = {p: V(-52, ko.top + 0.7, 58), d: V(0, 1, 0)}; N.koW = ko.noz(1.0, -Math.PI / 2, 0.2, 0.6); pump(K, -46, 64, Math.PI / 2, 0.8); }
  { const K = unitKit('C-101'); const c = compressor(K, -40, 52, {casings: 3, r: 1.35, len: 4.2}); N.c101 = c.stages;
    for (let k = 0; k < 2; k++) { const n = hx(K, -24 + k * 9, 2.2, 63, {D: 1.2, L: 6, nr: 0.4}); N['ic' + k] = n; }
    pipeRun(K, [c.stages[0].out.p, V(c.stages[0].out.p.x, 7, c.stages[0].out.p.z), V(-24 + 3, 7, 52), V(-21, 7, 63), V(-21, 3.6, 63)], 0.4, 'paint2');
    pipeRun(K, [V(-27, 3.6, 63), V(-27, 7.5, 63), V(c.stages[1].in.p.x, 7.5, 63), c.stages[1].in.p], 0.36, 'paint2');
    pipeRun(K, [c.stages[1].out.p, V(c.stages[1].out.p.x, 8, c.stages[1].out.p.z), V(-12, 8, 52), V(-12, 8, 63), V(-12, 3.4, 63)], 0.32, 'paint2');
    pipeRun(K, [V(-18, 3.4, 63), V(-18, 8.5, 63), V(c.stages[2].in.p.x, 8.5, 63), c.stages[2].in.p], 0.3, 'paint2');
    featured['C-101'] = {x: c.stages[1].in.p.x + 2, z: 52}; }
  { const K = unitKit('C-101R'); const c = compressor(K, -6, 80, {casings: 1, r: 1.0, len: 3.6}); N.crIn = c.stages[0].in; N.crOut = c.stages[0].out; }

  // ================================================================ methanol synthesis (south row, centre)
  { const K = unitKit('M-102'); K.add(new THREE.CylinderGeometry(0.6, 0.6, 4, 18).rotateZ(Math.PI / 2).translate(6, 4.2, 40), 'ss'); K.box(0.6, 3.7, 0.6, 'steelG', 5, 0, 40); K.box(0.6, 3.7, 0.6, 'steelG', 7, 0, 40);
    N.m102a = {p: V(4, 4.2, 40), d: V(-1, 0, 0)}; N.m102b = {p: V(6, 4.8, 40), d: V(0, 1, 0)}; N.m102out = {p: V(8, 4.2, 40), d: V(1, 0, 0)}; }
  { const K = unitKit('E-104'); frame(K, 16, 48, 9, 5, [4.2], {nx: 1, nz: 1}); const a = hx(K, 16, 2.3, 48, {D: 1.12, L: 6.5, nr: 0.4, nt: 0.32}), b = hx(K, 16, 6.6, 48, {D: 1.12, L: 6.5, nr: 0.4, nt: 0.32, saddleMk: 'steelG', base: 4.2}); N.e104a = a; N.e104b = b;
    pipeRun(K, ortho([a.tOut.p, V(a.tOut.p.x, 0.7, 48), V(a.tOut.p.x - 1.4, 0.7, 48), V(a.tOut.p.x - 1.4, 8.6, 48), V(b.tIn.p.x, 8.6, 48), b.tIn.p]), 0.3, 'clad'); }
  { const K = unitKit('R-103'); const x = 28, z = 58; frame(K, x, z, 9, 9, [6], {nx: 1, nz: 1});
    const v = vVessel(K, x, z, {D: 3.51, H: 7, y0: 6.6, noSkirt: true, legs: 0, rings: 1.2, plat: [{y: 13, tl: Math.PI * 1.5}], ladder: {a: 0.3, y0: 6.1, y1: 13}, cut: true});
    K.box(4.2, 0.6, 4.2, 'steelG', x, 6, z);
    // steam drum on top of the structure with risers and downcomers (boiling-water cooling)
    frame(K, x + 1, z - 7, 10, 4, [16.5], {nx: 1, nz: 1, brace: true}); const sd = hDrum(K, x + 1, 18, z - 7, {D: 1.8, L: 8, saddles: false, bands: 1}); K.box(8.2, 0.3, 2, 'steelG', x + 1, 16.3, z - 7);
    pipeRun(K, [V(x - 1.2, 18, z - 6), V(x - 1.2, 18, z - 2.5), V(x - 1.2, 12, z - 2.5), V(x - 1.2, 12, z - 1.6)], 0.25, 'paint2'); pipeRun(K, [V(x + 1.2, 17.2, z - 6.3), V(x + 1.2, 17.2, z - 2.5), V(x + 1.2, 8, z - 2.5), V(x + 1.2, 8, z - 1.6)], 0.25, 'paint2');
    N.r103in = {p: V(x, v.top + 0.7, z), d: V(0, 1, 0)}; N.r103out = v.nozBot(0.45); featured['R-103'] = {x, z, v}; units['R-103'].fei = {x, z}; }
  { const K = unitKit('E-107'); N.e107 = hx(K, 42, 2.4, 44, {D: 1.4, L: 7, nr: 0.45}); }
  { const K = unitKit('E-105'); frame(K, 44, 64, 10, 7, [4.4], {nx: 1, nz: 1}); N.e105 = [];
    for (let k = 0; k < 4; k++) N.e105.push(hx(K, 44, k < 2 ? 2.3 : 6.7, 64 - 1.7 + (k % 2) * 3.4, {D: 1.5, L: 7.5, nr: 0.35, saddleMk: k < 2 ? 'concV' : 'steelG', base: k < 2 ? 0 : 4.4})); }
  { const K = unitKit('F-101'); const v = vVessel(K, 58, 56, {D: 3.5, H: 8.75, y0: 2.4, plat: [{y: 11.4, tl: Math.PI * 1.4, t0: 1}], ladder: {a: 1.4, y1: 11.4}, cut: true}); N.f101in = v.noz(7.4, Math.PI, 0.5, 0.6); N.f101v = {p: V(58, v.top + 0.7, 56), d: V(0, 1, 0)}; N.f101l = v.noz(1.2, Math.PI / 2, 0.25, 0.6); featured['F-101'] = {x: 58, z: 56, v}; }
  { const K = unitKit('D-103'); const v = vVessel(K, 58, 74, {D: 1.6, H: 3, y0: 1.6, plat: []}); N.d103in = {p: V(58, v.top + 0.7, 74), d: V(0, 1, 0)}; N.d103o24 = v.noz(2.6, Math.PI, 0.35, 0.5); N.d103o25 = v.noz(2.6, 0, 0.2, 0.5); }
  { const K = unitKit('V-101'); K.box(1.0, 1.2, 1.0, 'dark', 72, 0.3, 50); K.cyl(0.35, 1.0, 'red', 72, 3.2, 50, 14); K.cyl(0.6, 0.5, 'galv', 72, 4.3, 50, 16); K.seg([71, 2.2, 50], [73, 2.2, 50], 0.3, 'paint2', 12);
    N.v101in = {p: V(71, 2.2, 50), d: V(-1, 0, 0)}; N.v101out = {p: V(73, 2.2, 50), d: V(1, 0, 0)}; }

  // ================================================================ purification: T-101 with condenser, reflux drum, reboiler, pumps
  { const K = unitKit('T-101'); const x = 104, z = 62;
    const plats = []; for (let y = 7; y <= 36; y += 5.8) plats.push({y, t0: -0.3, tl: Math.PI * 1.35});
    const v = vVessel(K, x, z, {D: 3.38, H: 33.6, y0: 4.5, rings: 2.4, plat: plats, ladder: {a: -0.55, y1: 36.8}, davit: true, cut: true, manways: [[8, 0.9], [19.6, 0.9], [31.2, 0.9]]});
    // overhead condenser structure (north-east) with condenser and reflux drum
    frame(K, x + 11, z - 10, 12, 8, [6, 13], {nx: 2, nz: 1});
    const cnd = hx(K, x + 11, 15, z - 10, {D: 1.9, L: 9, nr: 0.7, nt: 0.45, saddleMk: 'steelG', base: 13}); const rd = hDrum(K, x + 11, 8.2, z - 10, {D: 2.0, L: 6.5, saddles: false, bands: 1}); K.box(6, 0.3, 2.2, 'steelG', x + 11, 6.7, z - 10);
    pipeRun(K, [V(x, v.top + 0.7, z), V(x, v.top + 2.2, z), V(x + 11 + 3.8, v.top + 2.2, z), V(x + 11 + 3.8, v.top + 2.2, z - 10), cnd.sIn.p], 0.75, 'clad');
    pipeRun(K, [cnd.sOut.p, V(cnd.sOut.p.x, 10.2, z - 10), V(x + 11 - 2, 10.2, z - 10)], 0.3, 'paint2', {flanges: false});
    const rp = pump(K, x + 6, z - 3, Math.PI); pipeRun(K, [V(x + 11, 6.2, z - 10), V(x + 11, 1.5, z - 10), V(x + 7.5, 1.5, z - 10), V(x + 7.5, 0.7, z - 3), rp.suc.p], 0.2, 'paint2', {flanges: false});
    pipeRun(K, [rp.dis.p, V(rp.dis.p.x, v.top - 1.5, rp.dis.p.z), V(x + 1.4, v.top - 1.5, z), V(x + 1.2, v.top - 1.5, z)], 0.2, 'paint2', {flanges: false});
    // kettle reboiler at the base (south) and bottoms pump
    const kr = hDrum(K, x, 2.3, z + 8, {D: 2.6, L: 6, bands: 1}); K.seg([x - 4.4, 2.3, z + 8], [x - 5.0, 2.3, z + 8], 0.3, 'clad', 12); K.seg([x - 3.6, 3.7, z + 8], [x - 3.6, 4.3, z + 8], 0.3, 'clad', 12); N.rbOut = {p: V(x - 5.0, 2.3, z + 8), d: V(-1, 0, 0)}; N.rbIn = {p: V(x - 3.6, 4.3, z + 8), d: V(0, 1, 0)}; K.add(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 24).rotateZ(Math.PI / 2).translate(x - 3.6, 2.3, z + 8), 'paint2');
    pipeRun(K, [V(x, 3.6, z + 8), V(x, 5.0, z + 8), V(x, 5.0, z + 1.9)], 0.5, 'clad', {flanges: false}); pipeRun(K, [V(x + 1.0, 4.6, z + 1.6), V(x + 1.0, 4.6, z + 3), V(x + 1.0, 3.4, z + 6.8)], 0.3, 'paint2', {flanges: false});
    const bp = pump(K, x + 7, z + 10, 0);
    N.t101feed = v.noz(4.5 + 33.6 * (1 - 39 / 52), Math.PI, 0.3, 0.7); N.t101dist = {p: V(x + 11 + 3.6, 8.2, z - 10), d: V(1, 0, 0)}; N.t101bot = bp.dis;
    featured['T-101'] = {x, z, v}; }
  // ================================================================ tank farm, wastewater, flare, utilities
  { const K = unitKit('TANKS'); const bund = (x0, z0, x1, z1) => { for (const [a, b, c, d] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) K.box(Math.max(0.6, Math.abs(c - a)), 1.5, Math.max(0.6, Math.abs(d - b)), 'concV', (a + c) / 2, 0, (b + d) / 2); };
    bund(140, -43, 203, 43); tank(K, 158, -21, 21, 17); tank(K, 158, 21, 21, 17); tank(K, 186, 0, 13, 13);
    N.tankIn = {p: V(146, 3, 0), d: V(-1, 0, 0)}; K.seg([146, 3, 0], [170, 3, 0], 0.25, 'paint2', 10); }
  { const K = unitKit('WWT'); K.cyl(9, 3.2, 'concV', 160, 0, 70, 48); K.cyl(8.5, 0.1, 'water', 160, 3.0, 70, 48); K.cyl(6, 3.2, 'concV', 186, 0, 62, 40); K.cyl(5.5, 0.1, 'water', 186, 3.0, 62, 40);
    K.seg([160, 3.6, 61], [160, 3.6, 79], 0.15, 'yellow', 6); building(K, 188, 82, 18, 10, 5, {win: true, roof: 'roofB'}); N.wwtIn = {p: V(145, 2, 70), d: V(-1, 0, 0)}; }
  { const K = unitKit('FLARE'); const fx = 182, fz = 120; K.cyl(1.0, 60, 'galv', fx, 0, fz, 16, 0.7); K.cyl(1.4, 3, 'dark', fx, 60, fz, 16); K.cyl(3, 1.2, 'concV', fx, 0, fz, 16);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; K.seg([fx, 44, fz], [fx + Math.cos(a) * 26, 0.2, fz + Math.sin(a) * 26], 0.03, 'dark', 3); K.box(1.4, 0.8, 1.4, 'concV', fx + Math.cos(a) * 26, 0, fz + Math.sin(a) * 26); }
    units.FLARE.flame = {x: fx, y: 63.5, z: fz}; N.flareIn = {p: V(fx, 1.5, fz - 2), d: V(0, 0, -1)}; }
  { const K = unitKit('CTOWER'); const cx = -16, cz = 121; K.box(58, 10, 18, 'paint2', cx, 0.3, cz); for (let k = 0; k < 15; k++) K.box(0.2, 9.4, 18.2, 'galv', cx - 28 + k * 4, 0.6, cz);
    K.box(59, 0.6, 19, 'galv', cx, 10.3, cz); units.CTOWER.fans = [];
    for (let k = 0; k < 4; k++) { const x = cx - 21 + k * 14; K.cyl(4.6, 3.4, 'paint2', x, 10.9, cz, 32, 4.2, true); K.torus(4.2, 0.08, 'galv', x, 14.3, cz); units.CTOWER.fans.push({x, y: 13.2, z: cz}); }
    railLine(K, [cx - 29, 10.9, cz - 9.3], [cx + 29, 10.9, cz - 9.3]); railLine(K, [cx - 29, 10.9, cz + 9.3], [cx + 29, 10.9, cz + 9.3]); stairs(K, cx + 29.5, 0.3, cz + 7, cx + 40, 10.9);
    tank(K, -66, 122, 13, 10, {mk: 'red'}); building(K, -110, 121, 26, 18, 9, {win: true, roof: 'roofB', hvac: 2});
    K.box(30, 4, 22, 'galv', 90, 0.3, 121); for (let k = 0; k < 4; k++) K.box(3.2, 4.4, 3.2, 'dark', 70 + k * 6, 0.3, 112);
    N.bfw = {p: V(-110, 2, 111.5), d: V(0, 0, -1)}; }
  for (let i = 0; i < 6; i++) truck(site, -186 + (i % 3) * 30, 112 + Math.floor(i / 3) * 16, 0, i % 2 ? 'tanker' : 'box', ['carW', 'blue', 'carS'][i % 3]);

  // ================================================================ pipe rack (z = 22) and utility headers
  const rack = new Kit(); pipeRack(rack, -100, 126, RZ, RW, TIER, {step: 6});
  for (const [k, t, mk, r] of [[0, 0, 'bluePipe', 0.45], [1, 0, 'bluePipe', 0.45], [5, 1, 'greenPipe', 0.3], [4, 0, 'clad', 0.25]]) pipeRun(rack, [V(-100, TIER[t] + 0.45 + r, lane(k)), V(126, TIER[t] + 0.45 + r, lane(k))], r, mk, {flanges: false, supports: false});
  // cooling-water branches to the exchangers
  for (const [x, z] of [[-64, 48], [-64, 34], [42, 44], [44, 64], [-24, 63], [-15, 63], [115, 52]]) pipeRun(rack, [V(x + 3, TIER[0] + 0.9, lane(0)), V(x + 3, TIER[0] + 0.9, z + (z > RZ ? -2.2 : 2.2)), V(x + 3, 1.2, z + (z > RZ ? -2.2 : 2.2))], 0.22, 'bluePipe', {flanges: false});
  units.RACK = {id: 'RACK', K: rack, extra: [], hidden: true};

  // ================================================================ STREAMS (numbers as in the PFD)
  const S = (id, pts, r, mk, svc, o = {}) => { const K = new Kit(); const Q = pipeRun(K, pts, r, mk, {supports: o.supports}); streams[id] = {id, K, pts: Q, r, svc, label: o.label}; return Q; };
  const ortho2 = ortho;
  const SV = {gas: 'clad', steam: 'clad', water: 'greenPipe', h2: 'ss', syn: 'clad', liq: 'cladS', prod: 'paint2'};
  // rack router: up to the rack tier, across to a lane, along the rack, back over the target, down into the nozzle
  const rk = (a, b, k, t = 1, o = {}) => { const A1 = a.p.clone().addScaledVector(a.d, o.s1 ?? 1), B1 = b.p.clone().addScaledVector(b.d, o.s2 ?? 1), y = TIER[t] + 0.8 + (o.dy || 0), zl = lane(k);
    const pre = (o.via1 || []).map(v => V(...v)), post = (o.via2 || []).map(v => V(...v)); const a2 = pre.length ? pre[pre.length - 1] : A1, b2 = post.length ? post[0] : B1;
    return ortho([a.p.clone(), A1, ...pre, V(a2.x, y, a2.z), V(a2.x, y, zl), V(b2.x, y, zl), V(b2.x, y, b2.z), ...post, B1, b.p.clone()]); };
  // ---------- water / steam train after heat integration (Figure 4.18): 3 → E-101 → 4 → E-107 → 32 → E-106 → 33 → E-103 → 34 → E-102 → 5 → D-101
  S('3', ortho([N.bfw.p, V(-110, 2, 100), V(-108, 2, 100), V(-108, 3, -22), N.e101in0.p]), 0.3, SV.water, 'water');
  pipeRun(streams['3'].K, ortho([V(-108, 3, -4), N.e101in1.p]), 0.3, SV.water, {flanges: true});
  S('4', rk(N.e101out1, N.e107.tIn, 0, 1, {s1: 0.5}), 0.32, SV.water, 'water');
  pipeRun(streams['4'].K, ortho([N.e101out0.p, V(-102, 11.4, -22), V(-102, 11.4, -4)]), 0.32, SV.water, {flanges: false});
  S('32', rk(N.e107.tOut, N.e106.tIn, 1, 1, {s1: 0.4, via1: [[N.e107.tOut.p.x - 1.2, 1.6, N.e107.tOut.p.z]]}), 0.3, SV.water, 'water');
  S('33', rk(N.e106.tOut, N.e103a.tIn, 2, 1, {s1: 0.4, via1: [[N.e106.tOut.p.x - 1.2, 1.6, N.e106.tOut.p.z]], via2: [[N.e103a.tIn.p.x, 10.3, -24]]}), 0.3, SV.water, 'water');
  pipeRun(streams['33'].K, ortho([N.e103a.tOut.p, V(N.e103a.tOut.p.x, 0.6, -16), V(N.e103a.tOut.p.x - 1.2, 0.6, -16), V(N.e103a.tOut.p.x - 1.2, 9.6, -16), V(N.e103b.tIn.p.x, 9.6, -16), N.e103b.tIn.p]), 0.3, SV.water);
  S('34', route(N.e103b.tOut, N.e102s.tIn, [[N.e103b.tOut.p.x - 1.4, 5.4, -16], [N.e103b.tOut.p.x - 1.4, 5.4, -8], [N.e102s.tIn.p.x, 8.4, -8]], {s1: 0.4, s2: 1.0}), 0.35, SV.steam, 'steam');
  S('5', rk(N.e102s.tOut, N.d101in, 3, 1, {s1: 0.4, via1: [[N.e102s.tOut.p.x, 3.35, 3]]}), 0.35, SV.steam, 'steam');
  // 7: D-101 → steam header → the five gasifier plenums; 6: D-101 → M-101 (shift steam)
  S('7', route(N.d101o7, N['r101st0'], [...rackVia(-82, -72, 1, 0), [-72, 1.4, lane(1)], [-72, 1.4, 4], [TRAINS[0], 1.4, 4]], {s1: 0.6}), 0.35, SV.steam, 'steam');
  for (let i = 1; i < 5; i++) pipeRun(streams['7'].K, ortho([V(-72, 1.4, 4), V(TRAINS[i], 1.4, 4), N['r101st' + i].p.clone().addScaledVector(N['r101st' + i].d, 1.0), N['r101st' + i].p]), 0.3, SV.steam, {flanges: true});
  S('6', route(N.d101o6, N.m101in6, [...rackVia(-80, 30, 4, 0), [30, 13, lane(4)], [30, 13, -21]], {s1: 0.6}), 0.3, SV.steam, 'steam');
  // 8, 9 and 10 are the in-train ducts and the header (built with R-101 / CY-101)
  streams['8'] = {id: '8', pts: [N['r101top0'].p, V(TRAINS[0], 21.6, -6), V(TRAINS[0], 21.6, -15.6)], r: 0.9, svc: 'gas', virtual: true};
  streams['9'] = {id: '9', pts: [V(TRAINS[0], 7, -18), V(TRAINS[0], 2, -23.6), V(TRAINS[0], 2.6, -28.3)], r: 0.35, svc: 'gas', virtual: true};
  streams['10'] = {id: '10', pts: [V(TRAINS[0] + 5, 24.6, -18), V(TRAINS[0] + 7, 24.6, -18), V(TRAINS[0] + 7, 26.4, -18), V(22, 26.4, -18), V(22, 26.4, -16), N.d102in.p], r: 1.1, svc: 'gas', virtual: true};
  // ---------- syngas: 12 → M-101 → 13 → E-102 → 35 → E-103 → 14 → R-102 → 15 → ME-101 → 16 / 17
  S('12', route(N.d102o12, N.m101in12, [], {s1: 0.5, s2: 0.5}), 0.7, SV.gas, 'gas');
  S('13', route(N.m101out, N.e102s.sIn, [[33, 9, -8], [N.e102s.sIn.p.x, 9, -8]], {s1: 0.6, s2: 0.8}), 0.7, SV.gas, 'gas');
  S('35', route(N.e102s.sOut, N.e103b.sIn, [[N.e102s.sOut.p.x, 2.5, 3], [57, 2.5, 3], [57, 11, 3], [57, 11, -16], [N.e103b.sIn.p.x, 11, -16]], {s1: 0.4, s2: 0.8}), 0.6, SV.gas, 'gas');
  pipeRun(streams['35'].K, route(N.e103b.sOut, N.e103a.sIn, [[N.e103b.sOut.p.x, 4.95, -17.6], [N.e103a.sIn.p.x, 4.95, -17.6]], {s1: 0.3, s2: 0.3}), 0.55, SV.gas, {flanges: true});
  S('14', route(N.e103a.sOut, N.r102in, [[N.e103a.sOut.p.x, 0.8, -21], [62, 0.8, -21], [62, 16.5, -21], [66, 16.5, -21]], {s1: 0.3, s2: 1.0}), 0.6, SV.gas, 'gas');
  S('15', route(N.r102out, N.meIn, [[74, 3.4, -11.5], [74, 7.9, -11.5], [74, 7.9, -18.2]], {s1: 0.8, s2: 0.8}), 0.55, SV.h2, 'h2');
  S('16', route(N.mePerm, N.c102in, [[106, 0.9, -24], [N.c102in.p.x, 6.2, -24]], {s1: 0.6, s2: 0.6}), 0.5, SV.h2, 'h2');
  pipeRun(streams['16'].K, ortho([N.c102out.p, N.c102out.p.clone().setY(7.5), V(128, 7.5, N.c102out.p.z), V(128, 7.5, -38), V(132, 7.5, -38), V(132, 1, -38)]), 0.3, SV.h2, {flanges: true});
  // ---------- suction gas: 17 + 11 → 36 → E-106 → 37 → E-104 b → 38 → SC-1 → SC-2 → KO → C-101
  S('17', route(N.meRet, N.e106.sIn, [[105.5, 7.9, -13.8], ...rackVia(105.5, N.e106.sIn.p.x, 2, 0), [N.e106.sIn.p.x, 5.2, lane(2)]], {s1: 0.5, s2: 1.0}), 0.45, SV.syn, 'syn');
  S('11', route(N.d102o11, N.e106.sIn, [...rackVia(22, N.e106.sIn.p.x + 0.6, 3, 0), [N.e106.sIn.p.x + 0.6, 5.2, lane(3)], [N.e106.sIn.p.x + 0.6, 5.2, 33]], {s1: 0.6, s2: 0.6}), 0.5, SV.syn, 'syn');
  streams['36'] = {id: '36', pts: [N.e106.sIn.p.clone().setY(5.2), N.e106.sIn.p], r: 0.5, svc: 'syn', virtual: true};
  S('37', rk(N.e106.sOut, N.e104b.sIn, 5, 0, {s1: 0.3, via1: [[N.e106.sOut.p.x - 1.0, 0.9, N.e106.sOut.p.z]], dy: -0.2}), 0.45, SV.syn, 'syn');
  S('38', rk(N.e104b.sOut, N.sc1.sIn, 5, 1, {s1: 0.3, via1: [[N.e104b.sOut.p.x, 5.2, 45.6]]}), 0.45, SV.syn, 'syn');
  const scK = new Kit(); streams.sc = {id: 'sc', K: scK, svc: 'syn', pts: [], hidden: true};
  pipeRun(scK, route(N.sc1.sOut, N.sc2.sIn, [[N.sc1.sOut.p.x, 0.85, 52.2], [-57.5, 0.85, 52.2], [-57.5, 9.2, 52.2], [N.sc2.sIn.p.x, 9.2, 52.2]], {s1: 0.3, s2: 1.0}), 0.4, SV.syn);
  pipeRun(scK, route(N.sc2.sOut, N.koIn, [[N.sc2.sOut.p.x, 5.2, 52.6], [-52, 5.2, 52.6]], {s1: 0.3, s2: 0.8}), 0.4, SV.syn);
  pipeRun(scK, route(N.koOut, N.c101[0].in, [[-52, 12, 58], [N.c101[0].in.p.x, 12, 58]], {s1: 0.5, s2: 1.0}), 0.5, SV.syn);
  S('30', route(N.koW, N.e101in1, [[-52, 0.6, 66], [-76, 0.6, 66], [-76, 0.6, 18], [-107, 0.6, 18]], {s1: 0.4, s2: 1.0}), 0.2, SV.water, 'water');
  // ---------- synthesis loop: 18 → M-102 (+31) → 19 → E-104 a/b → 20 → R-103 → 21
  S('18', route(N.c101[2].out, N.m102a, [[N.c101[2].out.p.x, 9.2, 52], [N.c101[2].out.p.x, 9.2, 40], [1.5, 9.2, 40]], {s1: 0.6, s2: 1.5}), 0.32, SV.syn, 'syn');
  S('31', route(N.crOut, N.m102b, [[N.crOut.p.x, 7, 80], [N.crOut.p.x, 7, 36.5], [6, 7, 36.5], [6, 7, 40]], {s1: 0.6, s2: 1.0}), 0.36, SV.syn, 'syn');
  S('19', route(N.m102out, N.e104a.tIn, [[10, 7.0, 40], [N.e104a.tIn.p.x, 7.0, 40]], {s1: 0.6, s2: 0.6}), 0.4, SV.syn, 'syn');
  S('20', route(N.e104b.tOut, N.r103in, [[N.e104b.tOut.p.x + 0.0, 5.0, 45.0], [21, 5.0, 45], [21, 17, 45], [21, 17, 52.6], [28, 17, 52.6]], {s1: 0.3, s2: 1.0}), 0.45, SV.syn, 'syn');
  // ---------- effluent after heat integration: 21 → E-107 → 39 → T-101 reboiler → 40 → E-104 a / E-101 → 41 / 42 → E-105 → 22
  S('21', route(N.r103out, N.e107.sIn, [[28, 4.4, 50], [N.e107.sIn.p.x, 4.4, 50]], {s1: 0.4, s2: 1.0}), 0.45, SV.liq, 'liq');
  S('39', rk(N.e107.sOut, N.rbIn, 1, 0, {s1: 0.3, via1: [[N.e107.sOut.p.x - 1.0, 0.9, 44]], via2: [[N.rbIn.p.x, 7.3, 70]]}), 0.42, SV.liq, 'liq');
  S('40', rk(N.rbOut, N.e104a.sIn, 0, 0, {s1: 0.6, s2: 1.0, via1: [[98.4, 2.3, 76]]}), 0.4, SV.liq, 'liq');
  pipeRun(streams['40'].K, ortho([V(N.e104a.sIn.p.x, TIER[0] + 0.8, lane(0)), V(-100, TIER[0] + 0.8, lane(0)), V(-100, TIER[0] + 0.8, 3), V(N.e101hin1.p.x, TIER[0] + 0.8, 3), V(N.e101hin1.p.x, 7.5, 3), N.e101hin1.p.clone().addScaledVector(N.e101hin1.d, 1.0), N.e101hin1.p]), 0.32, SV.liq, {flanges: true});
  S('41', route(N.e104a.sOut, N.e105[0].sIn, [[N.e104a.sOut.p.x, 0.75, 51.6], [36, 0.75, 51.6], [36, 9.6, 51.6], [36, 9.6, 60.6], [N.e105[0].sIn.p.x, 9.6, 60.6]], {s1: 0.3, s2: 1.0}), 0.36, SV.liq, 'liq');
  S('42', rk(N.e101hout1, N.e105[1].sIn, 4, 1, {s1: 0.6, via2: [[N.e105[1].sIn.p.x, 10.3, 67.8]]}), 0.3, SV.liq, 'liq');
  // 22: E-105 (40 °C) → F-101; 23: vapour → D-103; 24: recycle → C-101R; 25: purge → flare
  S('22', route(N.e105[2].sOut, N.f101in, [[N.e105[2].sOut.p.x, 5.3, 70], [52, 5.3, 70], [52, 7.4, 70], [52, 7.4, 56]], {s1: 0.3, s2: 1.0}), 0.42, SV.liq, 'liq');
  pipeRun(streams['22'].K, ortho([N.e105[0].sOut.p, V(N.e105[0].sOut.p.x, 0.8, N.e105[0].sOut.p.z), V(N.e105[0].sOut.p.x, 0.8, 70), V(52, 0.8, 70), V(52, 5.3, 70)]), 0.36, SV.liq, {flanges: true});
  S('23', route(N.f101v, N.d103in, [[58, 15.5, 56], [62.5, 15.5, 56], [62.5, 15.5, 74], [58, 15.5, 74]], {s1: 0.5, s2: 1.0}), 0.45, SV.syn, 'syn');
  S('24', route(N.d103o24, N.crIn, [[54, 3.2, 74], [54, 3.2, 86], [N.crIn.p.x, 3.2, 86], [N.crIn.p.x, 6.5, 86], [N.crIn.p.x, 6.5, 80]], {s1: 0.6, s2: 1.0}), 0.42, SV.syn, 'syn');
  S('25', route(N.d103o25, N.flareIn, [[62, 6, 74], [62, 6, 102], [182, 6, 102], [182, 6, 110]], {s1: 0.5, s2: 1.0}), 0.2, SV.syn, 'syn');
  // ---------- purification: 26 → V-101 → 27 → T-101 → 29 (methanol) / 28 (water)
  S('26', route(N.f101l, N.v101in, [[58, 1.2, 50]], {s1: 0.6, s2: 1.0}), 0.25, SV.liq, 'liq');
  S('27', route(N.v101out, N.t101feed, [[76, 2.2, 62], [96, 2.2, 62], [96, N.t101feed.p.y, 62]], {s1: 0.6, s2: 0.8}), 0.28, SV.liq, 'liq');
  S('29', route(N.t101dist, N.tankIn, [[120, 8.2, 52], [120, TIER[1] + 1.1, 52], [120, TIER[1] + 1.1, lane(4)], [138, TIER[1] + 1.1, lane(4)], [138, TIER[1] + 1.1, 0], [140, 3, 0]], {s1: 0.6, s2: 1.0}), 0.28, SV.prod, 'prod');
  S('28', route(N.t101bot, N.wwtIn, [[N.t101bot.p.x, 3, 75], [140, 3, 75], [140, 2, 70]], {s1: 0.5, s2: 1.0}), 0.2, SV.water, 'water');
  // 1 and 2 are the solid feed (conveyors)
  streams['1'] = {id: '1', pts: [V(-184, 1, 10), V(-150, 1, 40), V(-128, 2, 60)], r: 0.6, svc: 'solid', virtual: true};
  streams['2'] = {id: '2', pts: N.convPath, r: 0.6, svc: 'solid', virtual: true};

  // ================================================================ blobs (contact shadows) under the big items
  const shadowsK = new Kit();
  for (const x of TRAINS) { blob(shadowsK, x, -6, 13, 13); blob(shadowsK, x, -30, 7, 7); blob(shadowsK, x, -18, 18, 10, true); }
  for (const [x, z, s] of [[22, -16, 8], [33, -16, 7.5], [66, -16, 9], [104, 62, 7], [58, 56, 6.5], [28, 58, 11], [158, -21, 30], [158, 21, 30], [186, 0, 20], [-52, 58, 5.5]]) blob(shadowsK, x, z, s, s);
  for (const [x, z, w, d] of [[50, -16, 14, 8], [91, -16, 26, 12], [-64, 41, 11, 22], [-27, 52, 40, 8], [44, 64, 12, 10], [115, 52, 14, 10], [16, 48, 10, 6], [-125, 66, 32, 32]]) blob(shadowsK, x, z, w, d, true);
  units.BLOB = {id: 'BLOB', K: shadowsK, extra: [], hidden: true, noShadow: true};

  // ================================================================ build meshes
  const padK = new Kit();
  for (const id in units) { const u = units[id]; if (u.hidden || ['CONTROL', 'TANKS', 'WWT', 'FLARE', 'CTOWER', 'HALL', 'CR-101'].includes(id)) continue; }
  const siteG = site.build(M, {name: 'site'}); root.add(siteG);
  for (const id in units) { const u = units[id]; u.group = u.K.build(M, {name: id, cast: !u.noShadow}); root.add(u.group); u.box = new THREE.Box3().setFromObject(u.group); delete u.K; }
  // concrete pads (with a kerb) under the process units
  for (const id in units) { const u = units[id]; if (u.hidden || ['CONTROL', 'TANKS', 'WWT', 'FLARE', 'CTOWER', 'HALL', 'CR-101', 'V-101', 'M-102'].includes(id)) continue; const b = u.box;
    const x0 = b.min.x - 2.2, x1 = b.max.x + 2.2, z0 = b.min.z - 2.2, z1 = b.max.z + 2.2; padK.box(x1 - x0, 0.22, z1 - z0, 'conc', (x0 + x1) / 2, 0, (z0 + z1) / 2); padK.box(x1 - x0 + 0.3, 0.3, 0.3, 'curb', (x0 + x1) / 2, 0, z0); padK.box(x1 - x0 + 0.3, 0.3, 0.3, 'curb', (x0 + x1) / 2, 0, z1); padK.box(0.3, 0.3, z1 - z0, 'curb', x0, 0, (z0 + z1) / 2); padK.box(0.3, 0.3, z1 - z0, 'curb', x1, 0, (z0 + z1) / 2); }
  padK.box(240, 0.22, 10, 'conc', 13, 0, RZ);       // under the rack
  const padG = padK.build(M, {name: 'pads', cast: false}); root.add(padG);
  for (const id in streams) { const s = streams[id]; if (s.K) { s.group = s.K.build(M, {name: 'S' + id}); root.add(s.group); delete s.K; } }
  return {root, units, streams, N, featured, anim};
}
