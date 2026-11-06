// The MPW gasification complex, laid out on the 420 m × 300 m plot of Figure 9.2 (x east, z south, metres).
// Process order follows the PFD (Figures 3.79 / 4.18): feed → gasification → shift → membrane (north row),
// compression → methanol synthesis → purification (south row), joined by the main pipe rack at z = 22.
import * as THREE from 'three';
import {REC, Kit, hxSaddle, pipeRun, vVessel, hDrum, hx, pump, compressor, frame, pipeRack, ringPlatform, caged, stairs, railLine, tank, building, palm, car, truck, road, blob} from './kit.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RZ = 22, RW = 8, TIER = [6.5, 9.5, 12.5];               // main pipe rack
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
  const unitKit = id => { const u = units[id] || (units[id] = {id, K: new Kit(), extra: []}); u.K.id = id; return u.K; };
  if (REC.on) window.__REC = REC;
  const site = new Kit(); site.id = 'SITE';
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
  const conv = new Kit(); conv.id = 'CONV'; { const a = V(-112, 3, 60), b = V(-86, 27.5, -8), d = b.clone().sub(a), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d.clone().normalize()); const g = new THREE.BoxGeometry(L, 2.0, 2.4); g.applyQuaternion(q); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); conv.add(g, 'steelG');
    for (let t = 0.1; t < 0.95; t += 0.11) { const p = a.clone().lerp(b, t); if (p.z > 15.5 && p.z < 34 || p.x > -102.5 && p.x < -89) continue; conv.box(0.35, p.y - 1.0, 0.35, 'steelG', p.x - 1, 0, p.z); conv.box(0.35, p.y - 1.0, 0.35, 'steelG', p.x + 1, 0, p.z); }
    frame(conv, -86, -12, 7, 7, [9, 18, 27], {nx: 1, nz: 1}); conv.box(7.6, 3.2, 7.6, 'roofG', -86, 27, -12);
    const y = 29.2, zc = -12.4; conv.box(TRAINS[4] + 6 - (-86), 2.0, 2.4, 'steelG', (-86 + TRAINS[4] + 6) / 2, y - 1.0, zc);
    for (const x of TRAINS) { conv.box(0.3, 8, 0.3, 'steelG', x + 4.5, 21.2, zc - 1.1); conv.box(0.3, 8, 0.3, 'steelG', x + 4.5, 21.2, zc + 1.1); }
    N.convPath = [a, b, V(-86, y, zc), V(TRAINS[4] + 4.5, y, zc)]; }
  units.CONV = {id: 'CONV', K: conv, extra: [], hidden: true};

  // ================================================================ PROCESS AREA (report Figures 9.2 and 9.4)
  // north of the rack, west → east: fired heaters and stack, five gasifiers with their cyclones, E-103, R-102, D-102 / M-101,
  // E-106, E-104, R-103 with its steam-drum structure, E-107, T-101 with its overhead structure (north-east).
  // south of the rack, west → east: D-101, E-101 boilers and E-102 superheater (south-west), ME-101 skid and C-102,
  // suction coolers and KO drum, C-101 train with IC-1…IC-4, C-101R, M-102, E-105, V-101, F-101 and D-103 (south-east).
  const ty = (t, r) => TIER[t] + r + 0.05, ye = t => TIER[t] + (t === 2 ? 2.3 : 1.9), XY = TIER[2] + 4.4;
  const P3 = (n, k = 1) => n.p.clone().addScaledVector(n.d, k);
  // along the rack: rise beside the rack, enter lane k of tier t at x0, run to x1, leave and drop to the nozzle
  const onRack = (a, b, t, k, r, x0, x1, o = {}) => { const y = ty(t, r), yE = ye(t), zl = lane(k), A1 = P3(a, o.s1 ?? 1), B1 = P3(b, o.s2 ?? 1);
    const pre = (o.via1 || []).map(v => V(...v)), post = (o.via2 || []).map(v => V(...v)), za = (pre.length ? pre[pre.length - 1] : A1).z, zb = (post.length ? post[0] : B1).z;
    return ortho([a.p.clone(), A1, ...pre, V(x0, yE, za), V(x0, yE, zl), V(x0, y, zl), V(x1, y, zl), V(x1, yE, zl), V(x1, yE, zb), ...post, B1, b.p.clone()]); };
  // across the rack at x, above the top tier
  const cross = (a, b, x, o = {}) => { const A1 = P3(a, o.s1 ?? 1), B1 = P3(b, o.s2 ?? 1), pre = (o.via1 || []).map(v => V(...v)), post = (o.via2 || []).map(v => V(...v));
    const za = (pre.length ? pre[pre.length - 1] : A1).z, zb = (post.length ? post[0] : B1).z, Y = o.y ?? XY;
    return ortho([a.p.clone(), A1, ...pre, V(x, Y, za), V(x, Y, zb), ...post, B1, b.p.clone()]); };
  const NZ = (x, y, z, dx, dy, dz, r = 0.3) => ({p: V(x, y, z), d: V(dx, dy, dz), r});

  // ---------------------------------------------------------------- gasification: fired heaters, gasifiers, cyclones (north-west)
  TRAINS.forEach((x, i) => {
    const feat = i === 0, K = unitKit('R-101'), C = unitKit('CY-101');
    // gasifier R-101: refractory-lined shell (D 7.5 m outside, 6.5 m bore), plenum and steam distributor
    const g = vVessel(K, x, -6, {D: 7.5, H: 6.5, y0: 3.2, mk: 'refr', seg: 48, rings: 1.6, plat: [{y: 8.4, t0: -0.4, tl: Math.PI * 1.5}], ladder: {a: -0.3, y1: 8.4}, manways: [[6.6, Math.PI]], topNozzle: false, cut: feat});
    K.push().tr(x, 0, -6); ringPlatform(K, 3.75, g.top + 0.05, 0, Math.PI * 2, 0.9); K.pop();
    K.cyl(1.0, 2.2, 'refr', x, g.top - 0.3, -6, 20); N['r101top' + i] = {p: V(x, g.top + 1.9, -6), d: V(0, 1, 0)};
    N['r101st' + i] = g.noz(3.6, -Math.PI / 2, 0.4, 0.8);      // steam from below into the plenum (south side)
    // feed bin and screw feeder on the east wall, fed from the conveyor above
    K.seg([x + 4.5, 28, -12.4], [x + 4.5, 22, -12.4], 0.35, 'galv', 10); K.add(new THREE.CylinderGeometry(1.5, 0.5, 2.6, 4, 1).rotateY(Math.PI / 4).translate(x + 4.5, 20.4, -12.4), 'galv'); K.box(2.0, 6, 2.0, 'galv', x + 4.5, 13.2, -12.4);
    K.box(2.4, 0.4, 2.4, 'steelG', x + 4.5, 12.8, -12.4); for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.25, 12.8, 0.25, 'steelG', x + 4.5 + sx, 0, -12.4 + sz);
    K.seg([x + 4.5, 13.2, -12.4], [x + 4.5, 6.4, -9.2], 0.42, 'galv', 12); K.add(new THREE.CylinderGeometry(0.42, 0.42, 3.0, 14).rotateZ(Math.PI / 2).translate(x + 4.0, 5.2, -8.0), 'galv'); K.add(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 14).rotateZ(Math.PI / 2).translate(x + 6.0, 5.2, -8.0), 'blue'); K.seg([x + 4.5, 6.4, -9.2], [x + 4.5, 5.2, -8.0], 0.42, 'galv', 12);
    // fired heater (char combustor) behind the gasifier, solids chute between the beds
    K.cyl(1.7, 24, 'refr', x, 2.4, -30, 28); K.cyl(1.9, 2.4, 'concV', x, 0, -30, 28); K.lathe([[1.7, 0], [1.2, 1.2], [0.8, 1.6]], 'refr', x, 26.4, -30, 24);
    K.seg([x, 4.5, -26.6], [x, 4.5, -9.7], 0.55, 'refr', 14);
    frame(K, x, -30, 7, 7, [9, 17, 25], {nx: 1, nz: 1});
    K.seg([x, 28, -30], [x, 30, -30], 0.9, 'refr', 16);
    // cyclones CY-101 ×3 on their structure south of the gasifier (Figure 9.2): body 3.5 m, overall 14 m
    const cz = 6; frame(C, x, cz, 14, 6, [7.2, 14, 21.4], {nx: 2, nz: 1});
    for (let k = 0; k < 3; k++) { const cx = x - 4.4 + k * 4.4;
      C.cyl(1.75, 7, 'cladS', cx, 14, cz, 32); C.add(new THREE.CylinderGeometry(1.75, 0.35, 7, 32, 1, true).translate(cx, 10.5, cz), 'cladS'); C.lathe([[1.75, 0], [1.2, 0.5], [0.7, 0.7]], 'cladS', cx, 21, cz, 28);
      C.cyl(0.62, 2.6, 'cladS', cx, 21.4, cz, 18);                        // vortex finder / gas outlet
      C.box(1.75, 0.7, 2.2, 'cladS', cx, 19.6, cz - 1.75);                // tangential inlet (north side)
      C.seg([cx, 7, cz], [cx, 4.2, cz], 0.32, 'cladS', 12); C.box(0.9, 0.9, 0.9, 'dark', cx, 3.3, cz);   // dipleg and rotary valve (Stream 9)
      if (k === 0 && feat) featured['CY-101'] = {x: cx, z: cz}; }
    // char screw cooler: under the cyclones, along the west side of the gasifier, into the fired heater (Section 7.5.3)
    C.add(new THREE.CylinderGeometry(0.45, 0.45, 9.6, 16).rotateZ(Math.PI / 2).translate(x - 2.2, 2.9, cz), 'galv');
    pipeRun(C, [V(x - 7, 2.9, cz), V(x - 7, 2.9, -30), V(x - 1.75, 2.9, -30)], 0.45, 'galv', {flanges: false});
    C.box(1.2, 1.4, 1.2, 'blue', x - 7, 2.2, cz + 1.4);
    // raw gas duct gasifier top → cyclone inlets (Stream 8)
    pipeRun(C, [N['r101top' + i].p, V(x, 22.6, -6), V(x, 22.6, cz - 1.75), V(x, 20.4, cz - 1.75)], 0.85, 'cladS', {flanges: false});
    C.box(13.2, 1.2, 1.4, 'cladS', x, 19.2, cz - 1.75);
    // clean syngas collector on top of the cyclones → header (Stream 10)
    C.add(new THREE.CylinderGeometry(0.85, 0.85, 10, 20).rotateZ(Math.PI / 2).translate(x, 24.6, cz), 'clad');
    for (let k = 0; k < 3; k++) C.seg([x - 4.4 + k * 4.4, 24, cz], [x - 4.4 + k * 4.4, 24.6, cz], 0.62, 'clad', 14);
    N['cyOut' + i] = {p: V(x + 5, 24.6, cz), d: V(1, 0, 0)};
    if (feat) featured['R-101'] = {x, z: -6, g};
  });
  // syngas header along z = 15 (y 26.4) to D-102 (Stream 10), on its own bents
  const HZ = 15, hdr = new Kit(); hdr.id = 'HDR'; hdr.add(new THREE.CylinderGeometry(1.1, 1.1, 40 - (TRAINS[0] + 7), 24).rotateZ(Math.PI / 2).translate((TRAINS[0] + 7 + 40) / 2, 26.4, HZ), 'clad');
  for (const x of TRAINS) pipeRun(hdr, [V(x + 5, 24.6, 6), V(x + 7, 24.6, 6), V(x + 7, 24.6, HZ), V(x + 7, 25.3, HZ)], 0.85, 'clad', {flanges: false});
  for (let x = TRAINS[0] + 11; x <= 38; x += 9) { hdr.box(0.5, 25.3, 0.5, 'steelG', x, 0, HZ); hdr.box(1.2, 0.5, 1.2, 'concV', x, 0, HZ); hdr.box(0.4, 0.4, 2.6, 'steelG', x, 24.9, HZ); }
  // flue gas: fired heaters → duct (y 31, z −30) → stack, and a branch to the E-101 boilers in the south-west
  hdr.add(new THREE.BoxGeometry(TRAINS[4] + 104 - 4, 2.2, 2.2).translate((TRAINS[4] - 104 + 4) / 2, 31, -30), 'galv');
  for (const x of TRAINS) { hdr.box(0.4, 30, 0.4, 'steelG', x + 3.2, 0, -32.5); hdr.box(0.4, 30, 0.4, 'steelG', x + 3.2, 0, -27.5); }
  { const sx = -21, sz = -38; hdr.cyl(2.0, 52, 'galv', sx, 0, sz, 28, 1.6); hdr.cyl(2.6, 1.2, 'concV', sx, 0, sz, 28); hdr.cyl(1.75, 1.0, 'dark', sx, 51.6, sz, 24);
    for (const y of [18, 36]) hdr.torus(1.95, 0.08, 'galv', sx, y, sz); hdr.push().tr(sx, 0, sz); ringPlatform(hdr, 1.9, 40, 0, Math.PI * 2, 1.0); hdr.pop(); caged(hdr, sx, sz + 2.5, 0.3, 40, 0);
    hdr.box(2.2, 2.2, 7.6, 'galv', sx, 29.9, -34.2); }
  pipeRun(hdr, [V(-98, 31, -30), V(-100, 31, -30), V(-100, 31, 47), V(-46.75, 31, 47), V(-46.75, 6.2, 47)], 1.0, 'galv', {flanges: false});
  for (const z of [-14, 2, 13, 36]) { hdr.box(0.45, 30, 0.45, 'steelG', -101.6, 0, z); hdr.box(0.45, 30, 0.45, 'steelG', -98.4, 0, z); hdr.box(3.6, 0.4, 0.5, 'steelG', -100, 29.6, z); }
  for (const x of [-88, -76, -64]) { hdr.box(0.45, 30, 0.45, 'steelG', x, 0, 45.4); hdr.box(0.45, 30, 0.45, 'steelG', x, 0, 48.6); hdr.box(0.5, 0.4, 3.6, 'steelG', x, 29.6, 47); }
  units.HDR = {id: 'HDR', K: hdr, extra: [], hidden: true};

  // ---------------------------------------------------------------- steam generation (south-west): D-101, E-101 A/B boilers, E-102 superheater
  { const K = unitKit('D-101'); const d = hDrum(K, -84, 3.2, 34, {D: 3.6, L: 10.8, bands: 2, manway: true, mk: 'clad'});
    N.d101in = d.noz(-3, Math.PI / 2, 0.35); N.d101o7 = d.noz(1, Math.PI / 2, 0.35); N.d101o6 = d.noz(4, Math.PI / 2, 0.3);
    K.seg([-84 + 4.6, 5.0, 34], [-84 + 4.6, 6.0, 34], 0.12, 'red', 8); }                       // PSV
  { // two horizontal boilers on one plinth, steam domes on top (as in the scale model); flue gas enters a common box at the east end
    const K = unitKit('E-101'), x = -54; K.box(15.5, 0.3, 10.6, 'concV', x - 0.8, 0, 47);
    for (const [j, z] of [[0, 44.6], [1, 49.4]]) { const d = hDrum(K, x, 2.75, z, {D: 3.0, L: 11, bands: 3, mk: 'clad', base: 0.3});
      K.cyl(0.6, 1.0, 'clad', x + 3, 4.15, z, 18); K.cyl(0.75, 0.12, 'ss', x + 3, 5.15, z, 18); K.seg([x + 3, 5.25, z], [x + 3, 5.9, z], 0.3, 'clad', 12);
      K.seg([x - 3.2, 4.2, z], [x - 3.2, 5.0, z], 0.1, 'red', 8);                                // PSV
      N['e101out' + j] = {p: V(x + 3, 5.9, z), d: V(0, 1, 0)}; N['e101in' + j] = d.noz(-4.6, j ? 0 : Math.PI, 0.3); }
    N.e101hin1 = NZ(x + 3.5, 3.9, 51.75, 0, 0, 1, 0.3); K.seg([x + 3.5, 3.9, 50.2], [x + 3.5, 3.9, 51.75], 0.3, 'clad', 12);
    N.e101hout1 = NZ(x + 1, 1.7, 51.75, 0, 0, 1, 0.3); K.seg([x + 1, 1.7, 50.3], [x + 1, 1.7, 51.75], 0.3, 'clad', 12);
    K.box(2.5, 5.4, 9.6, 'galv', x + 7.0, 0.3, 47); K.box(2.7, 0.3, 9.8, 'dark', x + 7.0, 5.7, 47);            // flue-gas inlet box
    pump(K, x - 9.5, 55, 0); }
  { // E-102: box-type convection superheater with a stepped top (scale model); hot syngas in at the top, out at the east foot
    const K = unitKit('E-102'), x = -38, z = 47; K.box(8.6, 0.45, 6.6, 'concV', x, 0, z); K.box(8, 9.2, 6, 'paint2', x, 0.45, z);
    for (let k = 0; k < 9; k++) K.box(7.4, 0.12, 0.08, 'galv', x, 1.6 + k * 0.85, z + 3.04);                   // louvres
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box(0.3, 9.4, 0.3, 'steelG', x + sx * 4.05, 0.45, z + sz * 3.05);
    K.box(5.4, 1.4, 3.8, 'paint2', x, 9.65, z); K.box(2.6, 1.1, 2.2, 'paint2', x, 11.05, z);
    K.seg([x, 12.15, z], [x, 13.0, z], 0.62, 'clad', 16);
    K.seg([x - 4.0, 8.2, z - 1.6], [x - 4.8, 8.2, z - 1.6], 0.32, 'clad', 12); K.seg([x - 4.0, 2.8, z - 1.6], [x - 4.8, 2.8, z - 1.6], 0.32, 'clad', 12); K.seg([x + 4.0, 1.8, z + 1.2], [x + 4.8, 1.8, z + 1.2], 0.55, 'clad', 14);
    N.e102s = {tIn: NZ(x - 4.8, 8.2, z - 1.6, -1, 0, 0, 0.32), tOut: NZ(x - 4.8, 2.8, z - 1.6, -1, 0, 0, 0.32), sIn: NZ(x, 13.0, z, 0, 1, 0, 0.62), sOut: NZ(x + 4.8, 1.8, z + 1.2, 1, 0, 0, 0.55)}; }

  // ---------------------------------------------------------------- syngas conditioning (north, centre): E-103, R-102, D-102, M-101, E-106
  { // E-103 A/B: two waste-heat boiler shells side by side, syngas through the tubes in series, steam drum above on a steel table (scale model)
    const K = unitKit('E-103'), x = 21; K.box(12, 0.3, 7.6, 'concV', x, 0, 4);
    const a = hx(K, x, 2.2, 2.2, {D: 1.8, L: 9, nr: 0.4, nt: 0.55, base: 0.3, tubeDown: true}), b = hx(K, x, 2.2, 5.8, {D: 1.8, L: 9, nr: 0.4, nt: 0.55, base: 0.3});
    frame(K, x, 4, 6, 7.8, [4.3], {nx: 1, nz: 1, floors: false, brace: false});
    const sd = hDrum(K, x, 5.4, 4, {D: 1.5, L: 8, saddles: false, bands: 1, mk: 'clad'}); for (const sx of [-3, 3]) K.box(0.4, 0.45, 1.3, 'steelG', x + sx, 4.3, 4);
    for (const [n, zz] of [[a.sIn, 3.55], [b.sIn, 4.45]]) pipeRun(K, [n.p, V(n.p.x, 4.25, n.p.z), V(n.p.x, 4.25, zz), V(n.p.x, 4.95, zz)], 0.3, 'clad', {flanges: false});   // risers
    pipeRun(K, [a.sOut.p, V(a.sOut.p.x, 0.75, 2.2), V(a.sOut.p.x, 0.75, 5.8), b.sOut.p], 0.25, 'clad', {flanges: false}); pipeRun(K, [V(a.sOut.p.x, 4.75, 4), V(a.sOut.p.x, 0.75, 4)], 0.25, 'clad', {flanges: false});   // downcomer
    pipeRun(K, [b.tOut.p, V(b.tOut.p.x, 0.75, 5.8), V(b.tOut.p.x, 0.75, 2.2), a.tIn.p], 0.45, 'clad', {flanges: false});   // syngas B → A
    N.e103gIn = b.tIn; N.e103gOut = a.tOut; N.e103wIn = sd.noz(-2.4, Math.PI / 2, 0.25); N.e103wOut = sd.noz(2.4, Math.PI / 2, 0.3); K.seg([x, 6.2, 4], [x, 7.0, 4], 0.1, 'red', 8); }
  { const K = unitKit('R-102'); const v = vVessel(K, 32, -10, {D: 5.4, H: 9.7, y0: 3, rings: 1.2, plat: [{y: 7.5, tl: Math.PI * 1.4, t0: 2.4}, {y: 12.8, tl: Math.PI * 1.6, t0: 2.4}], ladder: {a: 2.6, y1: 12.8}, davit: true, cut: true});
    N.r102in = {p: V(32, v.top + 0.7, -10), d: V(0, 1, 0)}; N.r102out = v.noz(3.4, -Math.PI / 2, 0.6, 0.8); featured['R-102'] = {x: 32, z: -10, v}; }
  { const K = unitKit('D-102'); const d = hDrum(K, 47, 5.6, 6, {D: 4.84, L: 14.52, bands: 3, mk: 'refr', manway: true});
    N.d102in = d.noz(-5.5, Math.PI / 2, 0.85); N.d102o12 = d.noz(5.5, Math.PI / 2, 0.7); N.d102o11 = d.noz(3.0, 0, 0.55); }
  { const K = unitKit('M-101'); const d = hDrum(K, 47, 5.4, -6, {D: 4.5, L: 13.5, bands: 3, mk: 'refr'});
    N.m101in12 = d.noz(5.0, Math.PI / 2, 0.7); N.m101in6 = d.noz(-2.0, Math.PI / 2, 0.35); N.m101out = d.nozEnd(-1, 0.7); }
  { const K = unitKit('E-106'); N.e106 = hx(K, 64, 2.2, 6, {D: 1.5, L: 8, nr: 0.5, nt: 0.32}); }

  // ---------------------------------------------------------------- methanol loop and distillation (north-east): E-104, R-103, E-107, T-101
  { // E-104 A/B feed–effluent exchangers: synthesis gas in series through the tubes (A then B)
    const K = unitKit('E-104'); K.box(8.6, 0.3, 5.4, 'concV', 80, 0, 11);
    const a = hx(K, 80, 2.1, 9.6, {D: 1.12, L: 6.5, nr: 0.36, nt: 0.32, base: 0.3}), b = hx(K, 80, 2.1, 12.4, {D: 1.12, L: 6.5, nr: 0.45, nt: 0.32, base: 0.3, tubeDown: true}); N.e104a = a; N.e104b = b;
    pipeRun(K, [a.tOut.p, V(a.tOut.p.x, 0.75, 9.6), V(a.tOut.p.x, 0.75, 12.4), b.tIn.p], 0.3, 'clad', {flanges: false}); }
  { const K = unitKit('R-103'); const x = 98, z = -12; K.box(5.2, 0.4, 5.2, 'concV', x, 0, z);
    const v = vVessel(K, x, z, {D: 3.51, H: 7, y0: 6.6, noSkirt: true, legs: 4, rings: 1.2, plat: [{y: 13, tl: Math.PI * 1.5, t0: 2.6}], ladder: {a: 0.3, y0: 0.4, y1: 13}, cut: true});
    // steam drum on its own three-level structure north of the reactor, with riser and downcomer (scale model)
    const sx = x, sz = z - 9; frame(K, sx, sz, 4.6, 4.6, [5.5, 11, 15.8], {nx: 1, nz: 1}); caged(K, sx - 2.3, sz - 2.9, 0.3, 15.8, 0);
    const sd = hDrum(K, sx, 17.0, sz, {D: 1.8, L: 6.8, saddles: false, bands: 1, ry: Math.PI / 2, mk: 'clad'}); K.box(1.8, 0.3, 5.4, 'steelG', sx, 15.85, sz);
    pipeRun(K, [V(sx - 0.5, 16.25, sz + 1.8), V(sx - 0.5, 14.9, sz + 1.8), V(sx - 0.5, 14.9, z - 3.5), V(sx - 0.5, 11.6, z - 3.5), V(sx - 0.5, 11.6, z - 1.7)], 0.25, 'clad', {flanges: false});
    pipeRun(K, [V(sx + 0.5, 16.25, sz + 2.9), V(sx + 0.5, 14.9, sz + 2.9), V(sx + 0.5, 14.9, z - 3.0), V(sx + 0.5, 7.6, z - 3.0), V(sx + 0.5, 7.6, z - 1.7)], 0.25, 'clad', {flanges: false});
    K.seg([sx, 17.9, sz - 1.8], [sx, 19.0, sz - 1.8], 0.12, 'red', 8);
    N.r103in = {p: V(x, v.top + 0.7, z), d: V(0, 1, 0)}; N.r103out = v.nozBot(0.45); featured['R-103'] = {x, z, v}; units['R-103'].fei = {x, z}; }
  { const K = unitKit('E-107'); K.box(8.4, 0.3, 2.4, 'concV', 98, 0, 6); N.e107 = hx(K, 98, 2.2, 6, {D: 1.4, L: 7, nr: 0.45, nt: 0.32, base: 0.3}); }
  { const K = unitKit('T-101'); const x = 116, z = -16;
    const plats = []; for (let y = 7; y <= 36; y += 5.8) plats.push({y, t0: 0.6, tl: Math.PI * 1.35});
    const v = vVessel(K, x, z, {D: 3.38, H: 33.6, y0: 4.5, rings: 2.4, plat: plats, ladder: {a: 1.2, y1: 36.8}, davit: true, cut: true, manways: [[8, -0.5], [19.6, -0.5], [31.2, -0.5]]});
    // overhead structure north of the column: condenser on the top deck, reflux drum on the middle deck, reflux pump at grade
    const ox = 110, oz = -32; frame(K, ox, oz, 9, 7, [5.5, 10.5, 15.5], {nx: 1, nz: 1}); stairs(K, ox + 9.7, 0.3, oz + 2.6, ox + 4.6, 5.5);
    const cnd = hx(K, ox, 17.2, oz, {D: 1.9, L: 7.4, nr: 0.7, nt: 0.45, saddleMk: 'steelG', base: 15.5}); N.cnd = cnd;
    const rd = hDrum(K, ox - 0.4, 11.7, oz, {D: 2.0, L: 5.6, saddles: false, bands: 1}); K.box(5.6, 0.3, 2.2, 'steelG', ox - 0.4, 10.4, oz);
    pipeRun(K, [V(x, v.top + 0.7, z), V(x, v.top + 2.4, z), V(cnd.sIn.p.x, v.top + 2.4, z), V(cnd.sIn.p.x, v.top + 2.4, oz), cnd.sIn.p], 0.75, 'clad', {flanges: false});     // overhead vapour
    pipeRun(K, [cnd.sOut.p, V(cnd.sOut.p.x, rd.y + 0.95, oz)], 0.3, 'paint2', {flanges: false});                                                          // condensate → reflux drum
    const rp = pump(K, ox - 8, oz + 1.5, 0), re = rd.nozEnd(-1, 0.2);
    pipeRun(K, [re.p, V(ox - 4.3, re.p.y, oz), V(ox - 4.3, 12.2, oz), V(ox - 5.2, 12.2, oz), V(ox - 5.2, 1.6, oz), V(ox - 5.2, 1.6, rp.suc.p.z), V(ox - 5.2, 0.7, rp.suc.p.z), rp.suc.p], 0.2, 'paint2', {flanges: false});
    pipeRun(K, [rp.dis.p, V(rp.dis.p.x, v.top - 1.5, rp.dis.p.z), V(rp.dis.p.x, v.top - 1.5, z - 2.4), V(x, v.top - 1.5, z - 2.4), V(x, v.top - 1.5, z - 1.75)], 0.2, 'paint2', {flanges: false});   // reflux
    // kettle reboiler at the base (south): liquid from the sump, vapour back above the bottom tangent line; bottoms pump
    const kr = hDrum(K, x, 2.3, z + 9, {D: 2.6, L: 6, bands: 1}); K.seg([x - 4.4, 2.3, z + 9], [x - 5.0, 2.3, z + 9], 0.3, 'clad', 12); K.seg([x - 3.6, 3.7, z + 9], [x - 3.6, 4.3, z + 9], 0.3, 'clad', 12);
    N.rbOut = {p: V(x - 5.0, 2.3, z + 9), d: V(-1, 0, 0)}; N.rbIn = {p: V(x - 3.6, 4.3, z + 9), d: V(0, 1, 0)}; K.add(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 24).rotateZ(Math.PI / 2).translate(x - 3.6, 2.3, z + 9), 'paint2');
    pipeRun(K, [V(x - 0.8, 3.55, z + 9), V(x - 0.8, 5.0, z + 9), V(x - 0.8, 5.0, z + 1.4)], 0.5, 'clad', {flanges: false});
    pipeRun(K, [V(x + 0.5, 4.3, z + 1.5), V(x + 0.5, 4.3, z + 5), V(x + 0.5, 0.7, z + 5), V(x + 0.5, 0.7, z + 8.4), V(x + 0.5, 1.2, z + 8.4)], 0.3, 'paint2', {flanges: false});
    const bp = pump(K, x - 8, z + 9.5, Math.PI), nb = v.nozBot(0.25);
    pipeRun(K, [nb.p, V(x, 1.4, z), V(x, 1.4, z + 3.4), V(bp.suc.p.x - 1.0, 1.4, z + 3.4), V(bp.suc.p.x - 1.0, 1.4, bp.suc.p.z), V(bp.suc.p.x - 1.0, 0.7, bp.suc.p.z), bp.suc.p], 0.2, 'paint2', {flanges: false});
    N.t101feed = v.noz(4.5 + 33.6 * (1 - 39 / 52), 0, 0.3, 0.7); N.t101dist = {p: V(rp.dis.p.x, 3.0, rp.dis.p.z), d: V(0, 1, 0)}; N.t101bot = bp.dis;
    featured['T-101'] = {x, z, v}; }

  // ---------------------------------------------------------------- hydrogen separation and compression (south, centre)
  { // ME-101: 26 vertical Pd–Ag modules in two rows inside a steel frame, with headers (scale model: membrane bank)
    const K = unitKit('ME-101'); const x0 = 17, x1 = 39, z = 51; frame(K, (x0 + x1) / 2, z, x1 - x0 + 2, 9, [1.2, 7.4], {nx: 4, nz: 1});
    for (let r = 0; r < 2; r++) for (let k = 0; k < 13; k++) { const x = x0 + 1 + k * 1.65, zz = z - 2.2 + r * 4.4; K.cyl(0.55, 4.6, 'ss', x, 1.6, zz, 20); K.lathe([[0.55, 0], [0.3, 0.35], [0.2, 0.4]], 'ss', x, 6.2, zz, 16); K.lathe([[0.2, -0.4], [0.3, -0.35], [0.55, 0]], 'ss', x, 1.6, zz, 16);
      K.seg([x, 6.6, zz], [x, 7.9, zz], 0.12, 'ss', 8); K.seg([x, 1.2, zz], [x, 0.9, zz + (r ? -0.9 : 0.9)], 0.12, 'ss', 8); K.box(1.0, 0.25, 1.0, 'galv', x, 1.3, zz); }
    for (const zz of [z - 2.2, z + 2.2]) K.add(new THREE.CylinderGeometry(0.4, 0.4, x1 - x0, 18).rotateZ(Math.PI / 2).translate((x0 + x1) / 2 + 0.8, 7.9, zz), 'ss');
    K.add(new THREE.CylinderGeometry(0.45, 0.45, x1 - x0, 18).rotateZ(Math.PI / 2).translate((x0 + x1) / 2 + 0.8, 0.9, z), 'ss');
    N.meIn = {p: V(x0 - 0.5, 7.9, z - 2.2), d: V(-1, 0, 0)}; N.meRet = {p: V(x1 + 1.9, 7.9, z + 2.2), d: V(1, 0, 0)}; N.mePerm = {p: V(x1 + 1.9, 0.9, z), d: V(1, 0, 0)}; featured['ME-101'] = {x: x0 + 1 + 4 * 1.65, z: z + 2.2}; }
  { // C-102: vacuum compressor on the permeate and the reciprocating export compressor (0.04 → 30 bar) on one skid
    const K = unitKit('C-102'), x = 28, z = 63; K.box(16, 0.5, 6, 'concV', x, 0, z);
    K.cyl(1.2, 2.8, 'blue', x - 5, 0.5, z, 24); K.lathe([[1.2, 0], [0.8, 0.5], [0.4, 0.7]], 'blue', x - 5, 3.3, z, 20);
    K.add(new THREE.CylinderGeometry(0.75, 0.75, 2.8, 20).rotateZ(Math.PI / 2).translate(x - 2.6, 1.6, z), 'blueD'); for (let k = 0; k < 10; k++) K.add(new THREE.TorusGeometry(0.78, 0.05, 4, 20).rotateY(Math.PI / 2).translate(x - 3.8 + k * 0.27, 1.6, z), 'blueD');
    K.box(2.6, 2.2, 2.6, 'blue', x + 3, 0.5, z); K.seg([x + 3, 2.7, z], [x + 3, 3.6, z], 0.35, 'blue', 14);
    for (const s of [-1, 1]) { K.add(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 22).rotateX(Math.PI / 2).translate(x + 3, 1.7, z + s * 2.6), 'blue'); K.add(new THREE.CylinderGeometry(1.08, 1.08, 0.2, 22).rotateX(Math.PI / 2).translate(x + 3, 1.7, z + s * 3.9), 'blueD'); }
    K.add(new THREE.CylinderGeometry(0.75, 0.75, 2.6, 20).rotateZ(Math.PI / 2).translate(x + 6.0, 1.6, z), 'blueD');
    K.seg([x - 5, 4.0, z], [x - 5, 4.6, z], 0.4, 'ss', 14); K.seg([x - 5, 1.6, z + 1.2], [x - 1.6, 1.6, z + 1.2], 0.3, 'ss', 12); K.seg([x - 1.6, 1.6, z + 1.2], [x + 3, 1.6, z + 1.2], 0.3, 'ss', 12);
    N.c102in = NZ(x - 5, 4.6, z, 0, 1, 0, 0.4); N.c102out = NZ(x + 3, 3.6, z, 0, 1, 0, 0.3); }
  { // suction coolers SC-1 / SC-2 side by side on one plinth (gas in series), and the knock-out drum
    const K = unitKit('SC'); K.box(10.6, 0.3, 6.4, 'concV', 48, 0, 42);
    const a = hx(K, 48, 2.4, 40.6, {D: 1.6, L: 8, nr: 0.5, base: 0.3}), b = hx(K, 48, 2.4, 43.4, {D: 1.6, L: 8, nr: 0.5, base: 0.3}); N.sc1 = a; N.sc2 = b;
    const ko = vVessel(K, 48, 52, {D: 3, H: 6, y0: 2, plat: [{y: 7.6, tl: Math.PI}], ladder: {a: Math.PI, y1: 7.6}}); N.koIn = ko.noz(5.5, Math.PI / 2, 0.5, 0.6); N.koOut = {p: V(48, ko.top + 0.7, 52), d: V(0, 1, 0)}; N.koW = ko.noz(1.0, Math.PI, 0.2, 0.6); pump(K, 52.5, 55.5, -Math.PI / 2, 0.8);
    pipeRun(K, route(a.sOut, b.sIn, [[a.sOut.p.x, 0.75, 42.0], [52.9, 0.75, 42.0], [52.9, 4.4, 42.0], [52.9, 4.4, 43.4]], {s1: 0.3, s2: 0.6}), 0.4, 'clad');
    pipeRun(K, route(b.sOut, N.koIn, [[b.sOut.p.x, 0.75, 46.0], [b.sOut.p.x, 5.5, 46.0], [48, 5.5, 46.0]], {s1: 0.3, s2: 0.6}), 0.4, 'clad'); }
  { // C-101: motor, gearbox and two barrel casings on one skid (five stages), with the four intercoolers on their own skid (scale model)
    const K = unitKit('C-101'); const c = compressor(K, 58, 60, {casings: 2, r: 1.35, len: 5.2}); N.c101 = c.stages;
    K.box(20, 0.3, 7.4, 'concV', 68.5, 0, 50.5); const ic = []; for (let k = 0; k < 4; k++) ic.push(hx(K, 60.5 + k * 5, 1.9, 50.5, {D: 1.2, L: 5, nr: 0.35, nt: 0.25, ry: Math.PI / 2, base: 0.3})); N.ic = ic;
    // interstage loops: casing → intercooler (shell side, in at the north end) → back into the casing side; IC-2 returns into the second casing
    const c0 = c.stages[0], c1 = c.stages[1];
    const LP = [{x: c0.in.p.x + 1.2, y0: c0.in.p.y - 0.95, back: c0.in.p.x + 1.2, zs: 60 - 1.35 + 0.05}, {x: c0.out.p.x, y0: c0.out.p.y, back: null},
      {x: c1.in.p.x + 1.06, y0: c1.in.p.y - 0.95, back: c1.in.p.x + 1.06, zs: 60 - 1.188 + 0.05}, {x: c1.in.p.x + 2.06, y0: c1.in.p.y - 0.95, back: c1.in.p.x + 2.06, zs: 60 - 1.188 + 0.05}];
    LP.forEach((l, k) => { const h = 6.2 + 0.8 * k, r = 0.3 - k * 0.02, n = ic[k], xr = n.sOut.p.x + 1.3;
      pipeRun(K, [V(l.x, l.y0, 60), V(l.x, h, 60), V(l.x, h, 47.6), V(n.sIn.p.x, h, 47.6), V(n.sIn.p.x, h, n.sIn.p.z), n.sIn.p], r, 'paint2', {flanges: false});
      const ret = [n.sOut.p, V(n.sOut.p.x, 0.65, n.sOut.p.z), V(xr, 0.65, n.sOut.p.z), V(xr, 0.65, 56.8)];
      if (l.back !== null) ret.push(V(l.back, 0.65, 56.8), V(l.back, 2.72, 56.8), V(l.back, 2.72, l.zs)); else ret.push(V(c1.in.p.x, 0.65, 56.8), V(c1.in.p.x, 5.8, 56.8), V(c1.in.p.x, 5.8, 60), c1.in.p);
      pipeRun(K, ret, r - 0.02, 'paint2', {flanges: false}); });
    featured['C-101'] = {x: c1.in.p.x - 1.3, z: 60}; }
  { const K = unitKit('C-101R'); const c = compressor(K, 82, 62, {casings: 1, r: 1.0, len: 3.6}); N.rcIn = c.stages[0].in; N.rcOut = c.stages[0].out; }
  { const K = unitKit('M-102'); K.box(4.6, 0.3, 2.0, 'concV', 70, 0, 31); K.add(new THREE.CylinderGeometry(0.52, 0.52, 3.12, 18).rotateZ(Math.PI / 2).translate(70, 2.0, 31), 'clad');
    for (const s of [-1, 1]) { K.box(0.5, 1.5, 1.1, 'concV', 70 + s * 1.0, 0.3, 31); K.add(new THREE.SphereGeometry(0.52, 16, 10).scale(0.5, 1, 1).translate(70 + s * 1.56, 2.0, 31), 'clad'); }
    K.seg([68.44 - 0.0, 2.0, 31], [67.7, 2.0, 31], 0.32, 'clad', 12); K.seg([71.56, 2.0, 31], [72.3, 2.0, 31], 0.4, 'clad', 12); K.seg([70, 2.5, 31], [70, 3.1, 31], 0.36, 'clad', 12);
    N.m102a = NZ(67.7, 2.0, 31, -1, 0, 0, 0.32); N.m102b = NZ(70, 3.1, 31, 0, 1, 0, 0.36); N.m102out = NZ(72.3, 2.0, 31, 1, 0, 0, 0.4); }

  // ---------------------------------------------------------------- synthesis effluent and separation (south-east): E-105, F-101, D-103, V-101
  { // E-105: two stacked pairs on a steel frame (scale model); effluent enters the upper shells and runs down into the lower shells
    const K = unitKit('E-105'); frame(K, 92, 48, 10, 7, [4.4], {nx: 1, nz: 1, floors: false}); N.e105 = [];
    for (let k = 0; k < 4; k++) { const up = k >= 2; N.e105.push(hx(K, 92, up ? 6.7 : 2.3, 48 - 1.7 + (k % 2) * 3.4, {D: 1.5, L: 7.5, nr: 0.35, saddleMk: up ? 'steelG' : 'concV', base: up ? 4.4 : 0, ry: up ? 0 : Math.PI})); }
    for (const sx of [-1, 1]) K.box(0.3, 0.4, 7, 'steelG', 92 + sx * hxSaddle(7.5, 0.75, 0.35), 4.0, 48);
    for (const k of [0, 1]) pipeRun(K, [N.e105[k + 2].sOut.p, N.e105[k].sIn.p], 0.35, 'clad', {flanges: false}); }
  { const K = unitKit('F-101'); const v = vVessel(K, 112, 46, {D: 3.5, H: 8.75, y0: 2.4, plat: [{y: 11.4, tl: Math.PI * 1.4, t0: 1}], ladder: {a: 0.2, y1: 11.4}, cut: true});
    N.f101in = v.noz(7.4, Math.PI, 0.5, 0.6); N.f101v = {p: V(112, v.top + 0.7, 46), d: V(0, 1, 0)}; N.f101l = v.noz(2.7, Math.PI / 2, 0.25, 0.6); featured['F-101'] = {x: 112, z: 46, v}; }
  { const K = unitKit('D-103'); const d = hDrum(K, 112, 1.6, 58, {D: 0.93, L: 2.8, mk: 'paint'}); N.d103in = d.noz(-0.7, Math.PI / 2, 0.35); N.d103o24 = d.nozEnd(-1, 0.32); N.d103o25 = d.noz(0.8, Math.PI / 2, 0.2); }
  { // V-101: two globe valves in series with diaphragm actuators (scale model), block valves and a bypass
    const K = unitKit('V-101'), z = 38; K.box(7.4, 0.3, 1.4, 'concV', 104, 0, z);
    K.seg([100.6, 1.4, z], [107.4, 1.4, z], 0.22, 'paint2', 12); for (const vx of [102.4, 105.4]) { K.sphere(0.42, 'red', vx, 1.4, z, 16, 10); K.seg([vx, 1.8, z], [vx, 2.9, z], 0.08, 'galv', 6); K.lathe([[0.05, 0], [0.62, 0.05], [0.66, 0.22], [0.2, 0.42]], 'red', vx, 2.9, z, 20); K.box(0.3, 1.0, 0.3, 'concV', vx, 0.3, z); }
    K.seg([101.2, 1.4, z], [101.2, 2.6, z], 0.12, 'paint2', 8); K.seg([101.2, 2.6, z], [106.6, 2.6, z], 0.12, 'paint2', 8); K.seg([106.6, 2.6, z], [106.6, 1.4, z], 0.12, 'paint2', 8); K.sphere(0.2, 'yellow', 103.9, 2.6, z, 12, 8);
    N.v101in = NZ(100.6, 1.4, z, -1, 0, 0, 0.22); N.v101out = NZ(107.4, 1.4, z, 1, 0, 0, 0.22); }

  // ---------------------------------------------------------------- tank farm, wastewater, flare, utilities
  { const K = unitKit('TANKS'); const bund = (x0, z0, x1, z1) => { for (const [a, b, c, d] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) K.box(Math.max(0.6, Math.abs(c - a)), 1.5, Math.max(0.6, Math.abs(d - b)), 'concV', (a + c) / 2, 0, (b + d) / 2); };
    bund(140, -43, 203, 43); tank(K, 158, -21, 21, 17); tank(K, 158, 21, 21, 17); tank(K, 186, 0, 13, 13);
    N.tankIn = {p: V(146, 3, 0), d: V(-1, 0, 0)}; K.seg([146, 3, 0], [170, 3, 0], 0.25, 'paint2', 10); }
  { const K = unitKit('WWT'); K.cyl(9, 3.2, 'concV', 160, 0, 70, 48); K.cyl(8.5, 0.1, 'water', 160, 3.0, 70, 48); K.cyl(6, 3.2, 'concV', 186, 0, 62, 40); K.cyl(5.5, 0.1, 'water', 186, 3.0, 62, 40);
    K.seg([160, 3.6, 61], [160, 3.6, 79], 0.15, 'yellow', 6); building(K, 188, 82, 18, 10, 5, {win: true, roof: 'roofB'}); N.wwtIn = {p: V(145, 2, 70), d: V(-1, 0, 0)}; }
  { const K = unitKit('FLARE'); const fx = 182, fz = 120; K.cyl(1.0, 60, 'paint2', fx, 0, fz, 16, 0.7); K.cyl(1.4, 3, 'dark', fx, 60, fz, 16); K.cyl(3, 1.2, 'concV', fx, 0, fz, 16);
    for (const y of [12, 24, 36, 48]) K.torus(0.95 - y * 0.004, 0.06, 'red', fx, y, fz);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; K.seg([fx, 44, fz], [fx + Math.cos(a) * 26, 0.2, fz + Math.sin(a) * 26], 0.03, 'dark', 3); K.box(1.4, 0.8, 1.4, 'concV', fx + Math.cos(a) * 26, 0, fz + Math.sin(a) * 26); }
    K.cyl(2.2, 4, 'paint2', fx - 8, 0.4, fz - 6, 20); K.box(5, 0.4, 5, 'concV', fx - 8, 0, fz - 6);                               // flare knock-out drum
    units.FLARE.flame = {x: fx, y: 63.5, z: fz}; N.flareIn = {p: V(fx, 1.5, fz - 2), d: V(0, 0, -1)}; }
  { const K = unitKit('CTOWER'); const cx = -16, cz = 121; K.box(58, 10, 18, 'paint2', cx, 0.3, cz); for (let k = 0; k < 15; k++) K.box(0.2, 9.4, 18.2, 'galv', cx - 28 + k * 4, 0.6, cz);
    K.box(59, 0.6, 19, 'galv', cx, 10.3, cz); units.CTOWER.fans = [];
    for (let k = 0; k < 4; k++) { const x = cx - 21 + k * 14; K.cyl(4.6, 3.4, 'paint2', x, 10.9, cz, 32, 4.2, true); K.torus(4.2, 0.08, 'galv', x, 14.3, cz); units.CTOWER.fans.push({x, y: 13.2, z: cz}); }
    railLine(K, [cx - 29, 10.9, cz - 9.3], [cx + 29, 10.9, cz - 9.3]); railLine(K, [cx - 29, 10.9, cz + 9.3], [cx + 29, 10.9, cz + 9.3]); stairs(K, cx + 29.5, 0.3, cz + 7, cx + 40, 10.9);
    tank(K, -66, 122, 13, 10, {mk: 'red'}); building(K, -110, 121, 26, 18, 9, {win: true, roof: 'roofB'});
    K.box(30, 4, 22, 'galv', 90, 0.3, 121); for (let k = 0; k < 4; k++) K.box(3.2, 4.4, 3.2, 'dark', 70 + k * 6, 0.3, 112);
    N.bfw = {p: V(-110, 2, 111.5), d: V(0, 0, -1)}; }
  for (let i = 0; i < 6; i++) truck(site, -186 + (i % 3) * 30, 112 + Math.floor(i / 3) * 16, 0, i % 2 ? 'tanker' : 'box', ['carW', 'blue', 'carS'][i % 3]);

  // ================================================================ main pipe rack (z = 22): three tiers — utilities on the lowest, process lines above
  const rack = new Kit(); rack.id = 'RACK'; pipeRack(rack, -100, 126, RZ, RW, TIER, {step: 6});
  const UT = [[0, 'bluePipe', 0.45], [1, 'bluePipe', 0.45], [2, 'clad', 0.3], [3, 'cladS', 0.2], [4, 'red', 0.3], [5, 'galv', 0.14]];   // CW supply / return, LP steam, condensate, fire water, instrument air
  for (const [k, mk, r] of UT) pipeRun(rack, [V(-100, ty(0, r), lane(k)), V(126, ty(0, r), lane(k))], r, mk, {flanges: false, supports: false});
  rack.add(new THREE.CylinderGeometry(0.1, 0.1, 226, 8).rotateZ(Math.PI / 2).translate(13, ty(0, 0.1), lane(5) + 0.45), 'yellow');            // nitrogen
  for (const s of [-1, 1]) rack.box(226, 0.12, 0.5, 'galv', 13, TIER[2] + 3.1, RZ + s * (RW / 2 - 0.3));                                       // cable trays on the column extensions
  for (let x = -100; x < 126.01; x += 6) for (const s of [-1, 1]) { rack.box(0.3, 3.1, 0.3, 'steelG', x, TIER[2], RZ + s * RW / 2); rack.box(0.12, 0.12, 0.7, 'steelG', x, TIER[2] + 2.98, RZ + s * (RW / 2 - 0.3)); }
  // MCC / switch rooms and analyser shelters next to the machines
  for (const [x, z, w, d] of [[-14, 44, 9, 5], [46, 75, 9, 5], [100, 70, 6, 4], [62, -24, 7, 4], [-70, 74, 6, 4]]) building(rack, x, z, w, d, 3.4, {wall: 'wall', roof: 'roofG'});
  for (let x = -90; x < 126; x += 24) for (const z of [30, 88]) { rack.cyl(0.12, 10, 'galv', x, 0, z, 6); rack.box(1.4, 0.3, 0.5, 'dark', x + 0.5, 10, z); }
  // cooling-water branches from the rack to the coolers
  const CWR = [];
  for (const [x, n] of [[44.6, N.sc1.tIn], [56.6, N.ic[0].tIn], [87.4, N.e105[2].tIn], [104.6, N.cnd.tIn]]) { const zt = n.p.z, ze = zt < RZ ? RZ - RW / 2 - 1 : RZ + RW / 2 + 1, yh = Math.max(n.p.y + 0.8, ye(0));
    CWR.push(pipeRun(rack, [V(x, ty(0, 0.22), lane(0)), V(x, ye(0), lane(0)), V(x, ye(0), ze), V(x, yh, ze), V(x, yh, zt), V(n.p.x, yh, zt), n.p], 0.22, 'bluePipe', {flanges: false})); }
  units.RACK = {id: 'RACK', K: rack, extra: [], hidden: true};

  // ================================================================ STREAMS (numbers as in the heat-integrated PFD, Figure 4.18)
  const S = (id, pts, r, mk, svc, o = {}) => { const K = new Kit(); K.id = 'S:' + id; const Q = pipeRun(K, pts, r, mk, {supports: o.supports}); streams[id] = {id, K, pts: Q, r, svc, label: o.label}; return Q; };
  const add = (id, pts, r, mk) => pipeRun(streams[id].K, pts, r, mk, {flanges: true});
  const SV = {gas: 'clad', steam: 'clad', water: 'greenPipe', h2: 'ss', syn: 'clad', liq: 'cladS', prod: 'paint2'};
  // ---------- water / steam train: 3 → E-101 → 4 → E-107 → 32 → E-106 → 33 → E-103 → 34 → E-102 → 5 → D-101 → 7 / 6
  S('3', ortho([N.bfw.p, V(-110, 2, 100), V(-106, 2, 100), V(-106, 2, 54.2), V(N.e101in1.p.x, 2, 54.2), P3(N.e101in1), N.e101in1.p]), 0.3, SV.water, 'water');
  add('3', ortho([V(-61.2, 2, 54.2), V(-61.2, 2, 41.6), V(N.e101in0.p.x, 2, 41.6), P3(N.e101in0), N.e101in0.p]), 0.26, SV.water);
  S('4', onRack(N.e101out0, N.e107.tIn, 1, 1, 0.32, -51, N.e107.tIn.p.x, {s1: 0.4, via1: [[-51, 6.6, 44.6]], s2: 0.6}), 0.32, SV.water, 'water');
  add('4', ortho([N.e101out1.p, V(-51, 6.6, 49.4), V(-51, 6.6, 44.6)]), 0.3, SV.water);
  S('32', route(N.e107.tOut, N.e106.tIn, [[N.e107.tOut.p.x, 0.75, 6], [N.e107.tOut.p.x, 0.75, 1.5], [N.e106.tIn.p.x - 1.0, 0.75, 1.5], [N.e106.tIn.p.x - 1.0, 4.6, 1.5], [N.e106.tIn.p.x - 1.0, 4.6, 6], [N.e106.tIn.p.x, 4.6, 6]], {s1: 0.3, s2: 0.8}), 0.3, SV.water, 'water');
  S('33', route(N.e106.tOut, N.e103wIn, [[N.e106.tOut.p.x, 0.55, 6], [N.e106.tOut.p.x - 1.0, 0.55, 6], [N.e106.tOut.p.x - 1.0, 0.55, 13.2], [N.e103wIn.p.x, 0.55, 13.2], [N.e103wIn.p.x, 7.4, 13.2]], {s1: 0.3, s2: 0.8}), 0.3, SV.water, 'water');
  S('34', onRack(N.e103wOut, N.e102s.tIn, 2, 2, 0.35, N.e103wOut.p.x + 1.5, -43.5, {s1: 0.5, via2: [[-43.5, ye(2), N.e102s.tIn.p.z], [-43.5, 8.2, N.e102s.tIn.p.z]], s2: 0.3}), 0.35, SV.steam, 'steam');
  S('5', route(N.e102s.tOut, N.d101in, [[-43.2, 2.8, 38.6], [N.d101in.p.x, 2.8, 38.6], [N.d101in.p.x, 6.3, 38.6]], {s1: 0.4, s2: 0.8}), 0.35, SV.steam, 'steam');
  S('7', cross(N.d101o7, {p: V(-83, 1.4, 0), d: V(0, 0, 1)}, -83, {s1: 0.6, s2: 0.01, via2: [[-83, 1.4, 16.2]]}), 0.35, SV.steam, 'steam');
  add('7', ortho([V(-83, 1.4, 0), V(TRAINS[4], 1.4, 0)]), 0.35, SV.steam);
  for (let i = 0; i < 5; i++) add('7', ortho([V(TRAINS[i], 1.4, 0), V(TRAINS[i], 1.4, P3(N['r101st' + i], 1.0).z), P3(N['r101st' + i], 1.0).setY(N['r101st' + i].p.y), N['r101st' + i].p]), 0.3, SV.steam);
  S('6', onRack(N.d101o6, N.m101in6, 1, 0, 0.3, -80, 45, {s1: 0.6, s2: 0.8}), 0.3, SV.steam, 'steam');
  // ---------- gasification (in-train ducts, built with R-101 / CY-101) and the header
  streams['8'] = {id: '8', pts: [N['r101top0'].p, V(TRAINS[0], 22.6, -6), V(TRAINS[0], 22.6, 4.25)], r: 0.9, svc: 'gas', virtual: true};
  streams['9'] = {id: '9', pts: [V(TRAINS[0] - 4.4, 7, 6), V(TRAINS[0] - 4.4, 2.9, 6), V(TRAINS[0] - 7, 2.9, 6), V(TRAINS[0] - 7, 2.9, -30), V(TRAINS[0] - 1.75, 2.9, -30)], r: 0.45, svc: 'solid', virtual: true};
  S('10', ortho([V(40, 26.4, HZ), V(N.d102in.p.x, 26.4, HZ), V(N.d102in.p.x, 26.4, 6), P3(N.d102in, 0.6), N.d102in.p]), 1.0, 'clad', 'gas');
  streams['10'].pts.unshift(V(TRAINS[0] + 7, 26.4, HZ));
  // ---------- syngas: 12 → M-101 → 13 → E-102 → 35 → E-103 → 14 → R-102 → 15 → ME-101 → 16 / 17
  S('12', ortho([N.d102o12.p, V(N.d102o12.p.x, 10.4, 6), V(N.d102o12.p.x, 10.4, -6), V(N.m101in12.p.x, 10.4, -6), N.m101in12.p]), 0.7, SV.gas, 'gas');
  S('13', onRack(N.m101out, N.e102s.sIn, 2, 0, 0.7, 36.8, -38, {s1: 0.6, via1: [[36.8, 5.4, -6]], s2: 0.6}), 0.7, SV.gas, 'gas');
  S('35', onRack(N.e102s.sOut, N.e103gIn, 2, 3, 0.6, -32.6, N.e103gIn.p.x, {s1: 0.6, s2: 0.6}), 0.6, SV.gas, 'gas');
  S('14', route(N.e103gOut, N.r102in, [[N.e103gOut.p.x, 17.2, 2.2], [N.e103gOut.p.x, 17.2, -10], [32, 17.2, -10]], {s1: 0.3, s2: 0.8}), 0.6, SV.gas, 'gas');
  S('15', cross(N.r102out, N.meIn, 32, {s1: 0.8, via1: [[32, 3.4, -4.5]], via2: [[32, 9.4, 27.2], [15.0, 9.4, 27.2], [15.0, 9.4, 48.8], [15.0, 7.9, 48.8]], s2: 0.6}), 0.55, SV.h2, 'h2');
  S('16', ortho([N.mePerm.p, V(41.4, 0.9, 51), V(41.4, 0.9, 57.5), V(41.4, 5.6, 57.5), V(N.c102in.p.x, 5.6, 57.5), V(N.c102in.p.x, 5.6, 63), P3(N.c102in, 0.4), N.c102in.p]), 0.45, SV.h2, 'h2');
  add('16', onRack(N.c102out, {p: V(131, 1.0, lane(5)), d: V(0, 1, 0)}, 1, 5, 0.3, N.c102out.p.x, 131, {s1: 0.6, s2: 0.01}), 0.3, SV.h2);
  // ---------- suction gas: 17 + 11 → 36 → E-106 → 37 → E-104 b → 38 → SC-1 → SC-2 → KO → C-101
  const tee = V(N.e106.sIn.p.x, 10.4, 10.2);
  S('17', cross(N.meRet, {p: V(41.5, 10.4, 16.4), d: V(0, 0, -1)}, 41.5, {s1: 0.4, s2: 0.01, via1: [[41.5, 7.9, 53.2]]}), 0.45, SV.syn, 'syn');
  add('17', ortho([V(41.5, 10.4, 16.4), V(tee.x, 10.4, 16.4), tee]), 0.45, SV.syn);
  S('11', ortho([N.d102o11.p, P3(N.d102o11, 0.6), V(N.d102o11.p.x, 10.4, P3(N.d102o11, 0.6).z), V(N.d102o11.p.x, 10.4, tee.z), tee]), 0.5, SV.syn, 'syn');
  S('36', ortho([tee, V(tee.x, 10.4, 6), P3(N.e106.sIn, 0.6), N.e106.sIn.p]), 0.55, SV.syn, 'syn');
  S('37', route(N.e106.sOut, N.e104b.sIn, [[N.e106.sOut.p.x, 0.7, 6], [N.e106.sOut.p.x, 0.7, 3.6], [85.6, 0.7, 3.6], [85.6, 4.6, 3.6], [85.6, 4.6, 12.4], [N.e104b.sIn.p.x, 4.6, 12.4]], {s1: 0.3, s2: 0.8}), 0.45, SV.syn, 'syn');
  S('38', cross(N.e104b.sOut, N.sc1.sIn, 75, {s1: 0.25, via1: [[N.e104b.sOut.p.x, 0.85, 12.4], [N.e104b.sOut.p.x, 0.85, 15.6], [75, 0.85, 15.6]], via2: [[75, 11.2, 27.6], [N.sc1.sIn.p.x, 11.2, 27.6], [N.sc1.sIn.p.x, 11.2, N.sc1.sIn.p.z]], s2: 0.8}), 0.45, SV.syn, 'syn');
  add('38', route(N.koOut, N.c101[0].in, [[48, 12, 52], [48, 12, 57.0], [N.c101[0].in.p.x, 12, 57.0], [N.c101[0].in.p.x, 12, 60]], {s1: 0.5, s2: 1.0}), 0.5, SV.syn);
  S('30', onRack(N.koW, {p: V(-61.2, 2.0, 52.0), d: V(0, 1, 0)}, 1, 4, 0.2, 44.8, -61.2, {s1: 0.4, via1: [[44.8, 1.0, 52]], s2: 0.01}), 0.2, SV.water, 'water');
  // ---------- synthesis loop: 18 (+31) → M-102 → 19 → E-104 a / b → 20 → R-103 → 21
  S('18', route(N.c101[1].out, N.m102a, [[N.c101[1].out.p.x, 9.8, 60], [N.c101[1].out.p.x, 9.8, 34.0], [66.4, 9.8, 34.0], [66.4, 2.0, 34.0], [66.4, 2.0, 31]], {s1: 0.6, s2: 0.6}), 0.32, SV.syn, 'syn');
  S('31', route(N.rcOut, N.m102b, [[N.rcOut.p.x, 9.4, 62], [N.rcOut.p.x, 9.4, 33.6], [N.rcOut.p.x, 7.0, 33.6], [70, 7.0, 33.6], [70, 7.0, 31]], {s1: 0.6, s2: 0.6}), 0.36, SV.syn, 'syn');
  S('19', cross(N.m102out, N.e104a.tIn, 73, {s1: 0.6, via1: [[73, 2.0, 31]], via2: [[73, 4.4, 16.2], [73, 4.4, 9.6], [N.e104a.tIn.p.x, 4.4, 9.6]], s2: 0.6}), 0.4, SV.syn, 'syn');
  S('20', route(N.e104b.tOut, N.r103in, [[N.e104b.tOut.p.x, 17.0, 12.4], [N.e104b.tOut.p.x, 17.0, -12], [98, 17.0, -12]], {s1: 0.3, s2: 0.7}), 0.45, SV.syn, 'syn');
  // ---------- effluent: 21 → E-107 → 39 → T-101 reboiler → 40 → E-104 a / E-101 → 41 / 42 → E-105 → 22
  S('21', route(N.r103out, N.e107.sIn, [[98, 4.3, -12], [98, 4.3, 3.4], [N.e107.sIn.p.x, 4.3, 3.4], [N.e107.sIn.p.x, 4.3, 6]], {s1: 0.6, s2: 0.6}), 0.45, SV.liq, 'liq');
  S('39', route(N.e107.sOut, N.rbIn, [[N.e107.sOut.p.x, 0.75, 6], [N.e107.sOut.p.x, 0.75, 9.0], [N.rbIn.p.x, 0.75, 9.0], [N.rbIn.p.x, 6.4, 9.0], [N.rbIn.p.x, 6.4, -7]], {s1: 0.3, s2: 1.2}), 0.42, SV.liq, 'liq');
  S('40', route(N.rbOut, N.e104a.sIn, [[110.0, 2.3, -7], [110.0, 5.6, -7], [110.0, 5.6, 7.4], [N.e104a.sIn.p.x, 5.6, 7.4], [N.e104a.sIn.p.x, 5.6, 9.6]], {s1: 0.6, s2: 0.6}), 0.4, SV.liq, 'liq');
  add('40', onRack({p: V(88, 5.6, 7.4), d: V(0, 1, 0)}, N.e101hin1, 1, 3, 0.32, 88, -49.5, {s1: 0.01, via2: [[-49.5, ye(1), 53.4], [N.e101hin1.p.x, ye(1), 53.4], [N.e101hin1.p.x, 3.9, 53.4]], s2: 0.6}), 0.32, SV.liq);
  S('41', cross(N.e104a.sOut, N.e105[2].sIn, 79, {s1: 0.25, via1: [[N.e104a.sOut.p.x, 0.85, 9.6], [79, 0.85, 9.6], [79, 0.85, 16.0]], via2: [[79, 10.8, 28.4], [N.e105[2].sIn.p.x, 10.8, 28.4], [N.e105[2].sIn.p.x, 10.8, N.e105[2].sIn.p.z]], s2: 0.8}), 0.36, SV.liq, 'liq');
  S('42', onRack(N.e101hout1, N.e105[3].sIn, 1, 2, 0.3, -53, 96.6, {s1: 0.6, via1: [[-53, 1.7, 53.0]], via2: [[N.e105[3].sIn.p.x, ye(1), N.e105[3].sIn.p.z]], s2: 0.6}), 0.3, SV.liq, 'liq');
  // 22: E-105 (40 °C) → F-101; 23: vapour → D-103; 24: recycle → C-101R; 25: purge → fired heaters
  S('22', route(N.e105[1].sOut, N.f101in, [[N.e105[1].sOut.p.x, 0.7, N.e105[1].sOut.p.z], [N.e105[1].sOut.p.x, 0.7, 43.6], [106.2, 0.7, 43.6], [106.2, 7.4, 43.6], [106.2, 7.4, 46]], {s1: 0.3, s2: 0.6}), 0.42, SV.liq, 'liq');
  add('22', ortho([N.e105[0].sOut.p, V(N.e105[0].sOut.p.x, 0.7, N.e105[0].sOut.p.z)]), 0.34, SV.liq);
  S('23', route(N.f101v, N.d103in, [[112, 13.6, 46], [116.2, 13.6, 46], [116.2, 13.6, 58], [N.d103in.p.x, 13.6, 58]], {s1: 0.5, s2: 0.8}), 0.45, SV.syn, 'syn');
  S('24', route(N.d103o24, N.rcIn, [[109.4, 1.6, 58], [109.4, 1.6, 66.4], [N.rcIn.p.x, 1.6, 66.4], [N.rcIn.p.x, 6.0, 66.4], [N.rcIn.p.x, 6.0, 62]], {s1: 0.4, s2: 0.8}), 0.42, SV.syn, 'syn');
  S('25', onRack(N.d103o25, {p: V(-57, 1.2, -24), d: V(0, 1, 0)}, 2, 4, 0.2, 118, -57, {s1: 0.6, via1: [[118, 3.2, 58]], via2: [[-57, ye(2), -24]], s2: 0.01}), 0.2, SV.syn, 'syn');
  add('25', ortho([V(TRAINS[0] + 1.0, 1.2, -24), V(TRAINS[4] + 1.0, 1.2, -24)]), 0.2, SV.syn);
  for (const x of TRAINS) add('25', ortho([V(x + 1.0, 1.2, -24), V(x + 1.0, 1.2, -27.4), V(x + 1.0, 3.4, -27.4), V(x + 1.0, 3.4, -28.7)]), 0.14, SV.syn);   // burner fuel to each fired heater
  // ---------- purification: 26 → V-101 → 27 → T-101 → 29 (methanol) / 28 (water)
  S('26', route(N.f101l, N.v101in, [[112, 1.4, N.f101l.p.z - 0.6], [112, 1.4, 40.2], [99.4, 1.4, 40.2], [99.4, 1.4, 38]], {s1: 0.6, s2: 0.6}), 0.25, SV.liq, 'liq');
  S('27', cross(N.v101out, N.t101feed, 120.5, {s1: 0.6, via1: [[120.5, 1.4, 38]], via2: [[120.5, N.t101feed.p.y, -16]], s2: 0.5}), 0.28, SV.liq, 'liq');
  S('29', route(N.t101dist, N.tankIn, [[N.t101dist.p.x, 3.0, -36.6], [122, 3.0, -36.6], [122, 5.6, -36.6], [122, 5.6, 0], [140, 5.6, 0], [140, 3, 0]], {s1: 0.01, s2: 1.0}), 0.28, SV.prod, 'prod');
  S('28', route(N.t101bot, N.wwtIn, [[N.t101bot.p.x, 2.6, -6.5], [N.t101bot.p.x, 2.6, -3.0], [124.5, 2.6, -3.0], [124.5, 2.6, 70], [140, 2.6, 70]], {s1: 0.5, s2: 1.0}), 0.2, SV.water, 'water');
  // 1 and 2 are the solid feed (conveyors)
  streams['1'] = {id: '1', pts: [V(-184, 1, 10), V(-150, 1, 40), V(-128, 2, 60)], r: 0.6, svc: 'solid', virtual: true};
  streams['2'] = {id: '2', pts: N.convPath, r: 0.6, svc: 'solid', virtual: true};

  // ================================================================ pipe supports: steel posts under long elevated runs away from the rack
  // (placed only where nothing stands below the line: equipment, structures, other lines, roads)
  { const OB = [], tmp = new THREE.Vector3();
    const diag = (g, b) => { if (g.type !== 'CylinderGeometry') return false; b.getSize(tmp); const a = [tmp.x, tmp.y, tmp.z].sort((p, q) => p - q); return !(Math.abs(a[0] - a[1]) < 0.03 * a[1] + 0.01 || Math.abs(a[1] - a[2]) < 0.03 * a[2] + 0.01); };
    const addK = (K, tag) => { for (const mk in K.parts) for (const g of K.parts[mk]) { if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; if (b.max.y < 0.4 || diag(g, b)) continue; OB.push({b, tag}); } };
    for (const id in units) if (units[id].K && id !== 'BLOB') addK(units[id].K, id);
    addK(rack, 'RACK'); addK(hdr, 'HDR'); for (const id in streams) if (streams[id].K) addK(streams[id].K, 'S:' + id);
    const roads = [[-100, 130, 26.85, 32.35], [-100, 130, -42.75, -37.25], [-96.75, -91.25, -42, 95], [125.5, 130.5, -42, 95], [-100, 130, 89.5, 94.5]];
    const free = (x, z, y, tag) => { if (z > RZ - RW / 2 - 0.8 && z < RZ + RW / 2 + 0.8 && x > -101 && x < 127) return false;
      if (roads.some(([x0, x1, z0, z1]) => x > x0 - 0.6 && x < x1 + 0.6 && z > z0 - 0.6 && z < z1 + 0.6)) return false;
      for (const o of OB) { if (o.tag === tag) continue; const b = o.b; if (x + 0.5 > b.min.x && x - 0.5 < b.max.x && z + 0.5 > b.min.z && z - 0.5 < b.max.z && b.min.y < y - 0.05) return false; } return true; };
    const runs = []; for (const id in streams) { const st = streams[id]; if (st.K && st.pts) runs.push({Q: st.pts, r: st.r, K: st.K, tag: 'S:' + id}); }
    for (const Q of CWR) runs.push({Q, r: 0.22, K: rack, tag: 'RACK'});
    for (const {Q, r, K, tag} of runs) for (let i = 1; i < Q.length; i++) { const A = Q[i - 1], B = Q[i]; if (Math.abs(A.y - B.y) > 1e-3 || A.y < 2.6) continue; const L = A.distanceTo(B); if (L < 9) continue;
      const n = Math.floor(L / 7.5), ax = Math.abs(B.x - A.x) > 1e-3;
      for (let k = 1; k <= n; k++) for (const dt of [0, 0.7, -0.7, 1.4, -1.4]) { const t = k / (n + 1) + dt / L; if (t * L < 2.2 || (1 - t) * L < 2.2) continue; const p = A.clone().lerp(B, t), yt = p.y - r;
        if (!free(p.x, p.z, yt, tag)) continue;
        K.box(0.28, yt - 0.18, 0.28, 'steelG', p.x, 0, p.z); K.box(0.6, 0.3, 0.6, 'concV', p.x, 0, p.z); K.box(ax ? 0.22 : r * 2 + 0.5, 0.18, ax ? r * 2 + 0.5 : 0.22, 'steelG', p.x, yt - 0.18, p.z); break; } } }

  // ================================================================ blobs (contact shadows) under the big items
  const shadowsK = new Kit();
  for (const x of TRAINS) { blob(shadowsK, x, -6, 13, 13); blob(shadowsK, x, -30, 7, 7); blob(shadowsK, x, 6, 18, 10, true); }
  for (const [x, z, s] of [[32, -10, 9], [116, -16, 7], [112, 46, 6.5], [98, -12, 7], [48, 52, 5.5], [158, -21, 30], [158, 21, 30], [186, 0, 20], [-21, -38, 7]]) blob(shadowsK, x, z, s, s);
  for (const [x, z, w, d] of [[21, 4, 14, 9], [47, 0, 18, 20], [28, 51, 26, 12], [-54, 47, 18, 13], [-38, 47, 10, 8], [-84, 34, 13, 6], [67, 60, 24, 8], [68, 50.5, 21, 8], [92, 48, 12, 10], [80, 11, 10, 7], [110, -32, 11, 9], [-125, 66, 32, 32], [28, 63, 17, 7]]) blob(shadowsK, x, z, w, d, true);
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
  const allS = new Kit(); for (const id in streams) { const s = streams[id]; if (s.K) { for (const mk in s.K.parts) (allS.parts[mk] || (allS.parts[mk] = [])).push(...s.K.parts[mk]); delete s.K; } }
  root.add(allS.build(M, {name: 'streams'}));
  return {root, units, streams, N, featured, anim};
}
