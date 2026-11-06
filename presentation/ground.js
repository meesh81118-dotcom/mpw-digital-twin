// Real ground around the plot: Esri World Imagery tiles of Jubail Industrial City, composed at three zoom levels.
// Falls back to the bundled regional texture when the tiles cannot be reached.
import * as THREE from 'three';

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const R = 6378137;
const mx = lon => R * lon * Math.PI / 180, my = lat => R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const tileX = (lon, z) => (lon + 180) / 360 * 2 ** z, tileY = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const lonOf = (x, z) => x / 2 ** z * 360 - 180, latOf = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };

function loadImg(url, ms = 9000) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; const to = setTimeout(() => rej('timeout'), ms); im.onload = () => { clearTimeout(to); res(im); }; im.onerror = () => { clearTimeout(to); rej('err'); }; im.src = url; }); }

// one level: square of side `size` metres centred on (lat0, lon0)
async function level(lat0, lon0, z, size, onTile) {
  const k = Math.cos(lat0 * Math.PI / 180), dLon = size / 2 / (111320 * k), dLat = size / 2 / 110574;
  const x0 = Math.floor(tileX(lon0 - dLon, z)), x1 = Math.floor(tileX(lon0 + dLon, z)), y0 = Math.floor(tileY(lat0 + dLat, z)), y1 = Math.floor(tileY(lat0 - dLat, z));
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1, c = document.createElement('canvas'); c.width = nx * 256; c.height = ny * 256; const g = c.getContext('2d'); g.fillStyle = '#c8b28c'; g.fillRect(0, 0, c.width, c.height);
  let ok = 0; const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(loadImg(`${TILE}/${z}/${y}/${x}`).then(im => { g.drawImage(im, (x - x0) * 256, (y - y0) * 256); ok++; onTile && onTile(); }).catch(() => {}));
  await Promise.all(jobs);
  // metric extent of the mosaic relative to the plot centre (Mercator metres scaled by cos(lat))
  const W = lonOf(x0, z), E = lonOf(x1 + 1, z), N = latOf(y0, z), S = latOf(y1 + 1, z);
  const s = k; const cx = mx(lon0), cy = my(lat0);
  return {canvas: c, ok, total: nx * ny, geo: {w: W, e: E, n: N, s: S}, x0: (mx(W) - cx) * s, x1: (mx(E) - cx) * s, z0: -(my(N) - cy) * s, z1: -(my(S) - cy) * s};
}

export async function buildGround(scene, renderer, lat0, lon0, fallbackTex, progress) {
  const group = new THREE.Group(); group.name = 'ground'; scene.add(group);
  const plane = (L, tex, y, feather, order) => { const w = L.x1 - L.x0, d = L.z1 - L.z0; const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate((L.x0 + L.x1) / 2, y, (L.z0 + L.z1) / 2);
    const m = new THREE.MeshBasicMaterial({map: tex, toneMapped: false, transparent: feather, depthWrite: false, depthTest: false});
    if (feather) m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n{ vec2 e = min(vMapUv, 1.0 - vMapUv); diffuseColor.a *= smoothstep(0.0, 0.06, min(e.x, e.y)); }'); };
    m.color.setRGB(0.93, 0.92, 0.9); const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -10 + order; mesh.receiveShadow = false; group.add(mesh); return mesh; };
  const mk = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  // outer region (always available, bundled): 8° × 8° satellite colour
  const big = {x0: (45.5 - lon0) * 111320 * Math.cos(lat0 * Math.PI / 180), x1: (53.5 - lon0) * 111320 * Math.cos(lat0 * Math.PI / 180), z0: -(30.5 - lat0) * 110574, z1: -(22.5 - lat0) * 110574};
  plane(big, fallbackTex, -2.0, false, 0);
  let count = 0, total = 0; const tick = () => { count++; progress && progress(count, total); };
  const specs = [[12, 70000, -1.4, 1], [14, 14000, -1.0, 2], [16, 3200, -0.6, 3], [17, 1500, -0.3, 4]]; total = 0;
  const levels = await Promise.all(specs.map(([z, size]) => level(lat0, lon0, z, size, tick)));
  let any = false, patch = null; levels.forEach((L, i) => { if (L.ok < L.total * 0.6) return; any = true; const t = mk(L.canvas); renderer.initTexture(t); plane(L, t, specs[i][2], true, specs[i][3]); if (i === 0) patch = {tex: t, geo: L.geo}; });
  return {group, ok: any, patch};
}
