// Real ground around the plot: Esri World Imagery tiles of Jubail Industrial City at four zoom levels,
// drawn by ONE plane and ONE shader (a single full-screen pass, whatever the number of levels).
import * as THREE from 'three';

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const R = 6378137;
const mx = lon => R * lon * Math.PI / 180, my = lat => R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
const tileX = (lon, z) => (lon + 180) / 360 * 2 ** z, tileY = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const lonOf = (x, z) => x / 2 ** z * 360 - 180, latOf = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };
function loadImg(url, ms = 9000) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; const to = setTimeout(() => rej('timeout'), ms); im.onload = () => { clearTimeout(to); res(im); }; im.onerror = () => { clearTimeout(to); rej('err'); }; im.src = url; }); }

async function level(lat0, lon0, z, size) {
  const k = Math.cos(lat0 * Math.PI / 180), dLon = size / 2 / (111320 * k), dLat = size / 2 / 110574;
  const x0 = Math.floor(tileX(lon0 - dLon, z)), x1 = Math.floor(tileX(lon0 + dLon, z)), y0 = Math.floor(tileY(lat0 + dLat, z)), y1 = Math.floor(tileY(lat0 - dLat, z));
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1, c = document.createElement('canvas'); c.width = nx * 256; c.height = ny * 256; const g = c.getContext('2d'); g.fillStyle = '#c8b28c'; g.fillRect(0, 0, c.width, c.height);
  let ok = 0; await Promise.all(Array.from({length: nx * ny}, (_, i) => { const x = x0 + i % nx, y = y0 + Math.floor(i / nx); return loadImg(`${TILE}/${z}/${y}/${x}`).then(im => { g.drawImage(im, (x - x0) * 256, (y - y0) * 256); ok++; }).catch(() => {}); }));
  const W = lonOf(x0, z), E = lonOf(x1 + 1, z), N = latOf(y0, z), S = latOf(y1 + 1, z), cx = mx(lon0), cy = my(lat0);
  return {canvas: c, ok, total: nx * ny, geo: {w: W, e: E, n: N, s: S}, rect: new THREE.Vector4((mx(W) - cx) * k, (mx(E) - cx) * k, -(my(N) - cy) * k, -(my(S) - cy) * k)};
}

// region: bundled 8° × 8° texture; local: bundled 30 km fallback; then up to four imagery levels
export function makeGround(scene, renderer, lat0, lon0, regionTex, localTex, localRect) {
  const k = Math.cos(lat0 * Math.PI / 180), D = Math.PI / 180;
  const rect = (w, e, s, n) => new THREE.Vector4((w - lon0) * 111320 * k, (e - lon0) * 111320 * k, -(n - lat0) * 110574, -(s - lat0) * 110574);
  const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {tR: {value: regionTex}, rR: {value: rect(45.5, 53.5, 22.5, 30.5)}, tF: {value: localTex}, rF: {value: localRect}, onF: {value: 1},
    t0: {value: null}, t1: {value: null}, t2: {value: null}, t3: {value: null}, r0: {value: new THREE.Vector4()}, r1: {value: new THREE.Vector4()}, r2: {value: new THREE.Vector4()}, r3: {value: new THREE.Vector4()}, on: {value: new THREE.Vector4()}}]);
  U.tR.value = regionTex; U.tF.value = localTex;
  const m = new THREE.ShaderMaterial({uniforms: U, fog: true, depthTest: false, depthWrite: false,
    vertexShader: `#include <fog_pars_vertex>\nvarying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `#include <fog_pars_fragment>\nuniform sampler2D tR,tF,t0,t1,t2,t3; uniform vec4 rR,rF,r0,r1,r2,r3,on; uniform float onF; varying vec2 vW;
      vec2 uvOf(vec4 r){ return vec2((vW.x - r.x) / (r.y - r.x), 1.0 - (vW.y - r.z) / (r.w - r.z)); }
      float inside(vec2 u, float f){ vec2 e = min(u, 1.0 - u); return smoothstep(0.0, f, min(e.x, e.y)); }
      void main(){ vec3 c = texture2D(tR, uvOf(rR)).rgb; vec2 u;
        u = uvOf(rF); c = mix(c, texture2D(tF, u).rgb, inside(u, 0.05) * onF);
        u = uvOf(r0); if (on.x > 0.5) c = mix(c, texture2D(t0, u).rgb, inside(u, 0.06));
        u = uvOf(r1); if (on.y > 0.5) c = mix(c, texture2D(t1, u).rgb, inside(u, 0.06));
        u = uvOf(r2); if (on.z > 0.5) c = mix(c, texture2D(t2, u).rgb, inside(u, 0.06));
        u = uvOf(r3); if (on.w > 0.5) c = mix(c, texture2D(t3, u).rgb, inside(u, 0.06));
        gl_FragColor = vec4(c * 0.92, 1.0);\n#include <colorspace_fragment>\n#include <fog_fragment>\n}`});
  m.toneMapped = false;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(900000, 900000).rotateX(-Math.PI / 2), m); plane.position.y = -0.5; plane.frustumCulled = false; scene.add(plane);
  // imagery arrives in the background
  const done = (async () => { const specs = [[12, 70000], [14, 14000], [16, 3200], [17, 1500]]; const L = await Promise.all(specs.map(([z, s]) => level(lat0, lon0, z, s)));
    let patch = null, any = false; L.forEach((l, i) => { if (l.ok < l.total * 0.6) return; any = true; const t = new THREE.CanvasTexture(l.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      renderer.initTexture(t); U['t' + i].value = t; U['r' + i].value.copy(l.rect); U.on.value.setComponent(i, 1); if (i === 0) patch = {tex: t, geo: l.geo}; });
    if (any) U.onF.value = 0; return {ok: any, patch}; })();
  return {plane, U, done};
}
