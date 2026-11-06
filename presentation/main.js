import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {UNITS, SLIDES, SITE} from './data.js';

// =====================================================================  basics
const $ = id => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const clock = new THREE.Clock(); const LO = new URLSearchParams(location.search).has('lo'); if (LO) renderer.setPixelRatio(1);
const D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = {io: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out: t => 1 - Math.pow(1 - t, 3), sine: t => -(Math.cos(Math.PI * t) - 1) / 2, expo: t => t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2};
// ---- tween engine
const TW = [];
const FAST = new URLSearchParams(location.search).has('fast') ? 0.01 : 1;
function tween(o, to, d = 1.6, e = ease.io) { d *= FAST;
  for (let i = TW.length - 1; i >= 0; i--) if (TW[i].o === o) { for (const k in to) delete TW[i].to[k]; }
  return new Promise(res => { const from = {}; for (const k in to) from[k] = o[k]; TW.push({o, from, to, d, t: 0, e, res}); });
}
function stepTweens(dt) {
  for (let i = TW.length - 1; i >= 0; i--) { const w = TW[i]; w.t += dt; const k = Math.min(1, w.t / w.d), v = w.e(k);
    for (const key in w.to) w.o[key] = lerp(w.from[key], w.to[key], v); if (k >= 1) { TW.splice(i, 1); w.res(); } }
}
const wait = s => new Promise(r => setTimeout(r, s * 1000 * FAST));
// ---- loading
const manager = new THREE.LoadingManager(); let loaded = 0, total = 0;
manager.onProgress = (u, a, b) => { loaded = a; total = b; $('lbar').style.width = (a / b * 100) + '%'; };
const tl = new THREE.TextureLoader(manager);
const tex = (u, srgb = true) => { const t = tl.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
const fileLoader = new THREE.FileLoader(manager); fileLoader.setResponseType('json');
const getJSON = u => new Promise(r => fileLoader.load(u, r));
// ---- small canvas textures
function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function radial(c0, c1) { return canvasTex(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, c0); r.addColorStop(1, c1); g.fillStyle = r; g.fillRect(0, 0, w, h); }); }
// periodic value noise for tileable detail textures
function noiseTex(n, scales, srgb = false, normal = false) {
  return canvasTex(n, n, (g, w, h) => {
    const img = g.createImageData(w, h), A = new Float32Array(w * h);
    let amp = 1, tot = 0;
    for (const s of scales) { const grid = new Float32Array(s * s).map(() => Math.random());
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const fx = x / w * s, fy = y / h * s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = grid[(y0 % s) * s + x0 % s], b = grid[(y0 % s) * s + (x0 + 1) % s], c = grid[((y0 + 1) % s) * s + x0 % s], d = grid[((y0 + 1) % s) * s + (x0 + 1) % s];
        A[y * w + x] += amp * lerp(lerp(a, b, sx), lerp(c, d, sx), sy); }
      tot += amp; amp *= 0.55; }
    for (let i = 0; i < w * h; i++) A[i] /= tot;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, o = i * 4;
      if (normal) { const dx = (A[y * w + (x + 1) % w] - A[y * w + (x - 1 + w) % w]) * 6, dy = (A[((y + 1) % h) * w + x] - A[((y - 1 + h) % h) * w + x]) * 6; const l = Math.hypot(dx, dy, 1);
        img.data[o] = (-dx / l * .5 + .5) * 255; img.data[o + 1] = (-dy / l * .5 + .5) * 255; img.data[o + 2] = (1 / l * .5 + .5) * 255; }
      else { const v = A[i] * 255; img.data[o] = v; img.data[o + 1] = A[(i * 7) % (w * h)] * 255; img.data[o + 2] = v; }
      img.data[o + 3] = 255; }
    g.putImageData(img, 0, 0);
  }, srgb);
}

// =====================================================================  GLOBE
const gScene = new THREE.Scene();
const gCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.0001, 300);
const SUN = new THREE.Vector3();
function llVec(lat, lon, r = 1) { const p = (lon + 180) * D2R, la = lat * D2R; return new THREE.Vector3(-Math.cos(p) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(p) * Math.cos(la) * r); }
const SUNP = {lat: 8, lon: 8}; SUN.copy(llVec(SUNP.lat, SUNP.lon)).normalize();
const RB = [45.5, 53.5, 22.5, 30.5], KB = [34.0, 56.5, 15.5, 33.0];
const tDay = tex('assets/earth_day.jpg'), tNight = tex('assets/earth_night.jpg'), tWater = tex('assets/earth_water.jpg', false), tClouds = tex('assets/earth_clouds.jpg', false), tRegion = tex('assets/region.jpg'), tMask = tex('assets/ksa_mask.png', false);
const earthU = {tDay: {value: tDay}, tNight: {value: tNight}, tWater: {value: tWater}, tRegion: {value: tRegion}, tMask: {value: tMask}, uSun: {value: SUN},
  uRB: {value: new THREE.Vector4(...RB)}, uKB: {value: new THREE.Vector4(...KB)}, uKSA: {value: 0}, uEast: {value: 0}, uReg: {value: 1}, uTime: {value: 0}};
const LATLON = `float latd(vec3 n){return degrees(asin(clamp(n.y,-1.,1.)));}
 float lond(vec3 n){float l=degrees(atan(n.z,-n.x))-180.; return l<-180.?l+360.:l;}`;
const earthMat = new THREE.ShaderMaterial({uniforms: earthU,
  vertexShader: `varying vec3 vN; varying vec3 vP; varying vec2 vUv; void main(){vUv=uv; vN=normalize(position); vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: `uniform sampler2D tDay,tNight,tWater,tRegion,tMask; uniform vec3 uSun; uniform vec4 uRB,uKB; uniform float uKSA,uEast,uReg,uTime;
  varying vec3 vN; varying vec3 vP; varying vec2 vUv; ${LATLON}
  void main(){ vec3 n=normalize(vN); float la=latd(n), lo=lond(n);
    vec3 day=texture2D(tDay,vUv).rgb;
    vec2 ru=vec2((lo-uRB.x)/(uRB.y-uRB.x),(la-uRB.z)/(uRB.w-uRB.z));
    if(ru.x>0.&&ru.x<1.&&ru.y>0.&&ru.y<1.){ float e=smoothstep(0.,.06,min(min(ru.x,1.-ru.x),min(ru.y,1.-ru.y))); day=mix(day,texture2D(tRegion,ru).rgb,e*uReg); }
    vec3 V=normalize(cameraPosition-vP); float d=dot(n,uSun);
    vec3 col=day*(0.035+1.2*clamp(d,0.,1.));
    float wm=texture2D(tWater,vUv).r; vec3 R=reflect(-uSun,n);
    col+=vec3(1.,.93,.8)*wm*pow(max(dot(R,V),0.),55.)*1.1*step(0.,d);
    vec3 nl=texture2D(tNight,vUv).rgb; col+=nl*nl*vec3(1.,.78,.5)*2.4*(1.-smoothstep(-.28,.04,d));
    vec2 ku=vec2((lo-uKB.x)/(uKB.y-uKB.x),(la-uKB.z)/(uKB.w-uKB.z));
    if(ku.x>0.&&ku.x<1.&&ku.y>0.&&ku.y<1.){ vec4 m=texture2D(tMask,ku);
      float pulse=.75+.25*sin(uTime*2.2);
      col=mix(col,col*vec3(1.08,1.,.9)+vec3(.05,.03,0.),m.r*uKSA);
      col+=vec3(1.,.66,.3)*m.b*uKSA*1.6*pulse;
      col=mix(col,col+vec3(.22,.12,.02),m.g*uEast);
      col+=vec3(1.,.82,.45)*m.a*uEast*2.*pulse; }
    float fr=pow(1.-max(dot(n,V),0.),3.); col+=vec3(.3,.55,1.)*fr*.55*smoothstep(-.2,.4,d);
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`});
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 384, 192), earthMat); gScene.add(earth);
const cloudU = {tC: {value: tClouds}, uSun: {value: SUN}, uOp: {value: 0.9}, uT: {value: 0}, uSite: {value: llVec(SITE.lat, SITE.lon)}, uClr: {value: 0}};
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.007, 256, 128), new THREE.ShaderMaterial({uniforms: cloudU, transparent: true, depthWrite: false,
  vertexShader: `varying vec3 vN; varying vec2 vUv; void main(){vUv=uv; vN=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tC; uniform vec3 uSun,uSite; uniform float uOp,uT,uClr; varying vec3 vN; varying vec2 vUv;
  void main(){ float c=texture2D(tC,vUv+vec2(uT*.0015,0.)).r; float d=dot(normalize(vN),uSun); float l=clamp(d*1.1+.06,0.,1.);
    float clr=1.-uClr*(1.-smoothstep(.94,.995,dot(normalize(vN),uSite)));
    gl_FragColor=vec4(vec3(1.)*l,smoothstep(.08,.85,c)*uOp*clr*(.25+.75*smoothstep(-.2,.15,d)));
    #include <colorspace_fragment>
  }`}));
gScene.add(clouds);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.045, 128, 64), new THREE.ShaderMaterial({side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: {uSun: {value: SUN}},
  vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normalMatrix*normal); vW=normalize((modelMatrix*vec4(position,1.)).xyz); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ float i=pow(clamp(.72+dot(vN,vec3(0.,0.,1.)),0.,1.),5.); float s=smoothstep(-.35,.5,dot(vW,uSun));
    gl_FragColor=vec4(vec3(.32,.58,1.)*i*1.6*s+vec3(1.,.55,.3)*i*.25*(1.-s)*s*4.,i*s);}`}));
gScene.add(atmo);
{ const n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(150); pos.set([v.x, v.y, v.z], i * 3); const t = Math.random(), b = .45 + Math.pow(Math.random(), 3) * .9; col.set([b * (0.85 + t * .2), b * (0.88 + t * .1), b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gScene.add(new THREE.Points(g, new THREE.PointsMaterial({size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .95, depthWrite: false}))); }
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({map: radial('rgba(255,244,220,1)', 'rgba(255,200,120,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true}));
sunSprite.position.copy(SUN).multiplyScalar(120); sunSprite.scale.setScalar(16); gScene.add(sunSprite);
// globe camera described by geographic parameters
const GC = {lat: 12, lon: 20, alt: 36000, tilt: 0, head: 0, shift: 0};
function applyGlobeCam() {
  const T = llVec(GC.lat, GC.lon), up = T.clone().normalize(), east = new THREE.Vector3(0, 1, 0).cross(up).normalize(), north = up.clone().cross(east).normalize();
  const h = GC.head * D2R, fwd = north.clone().multiplyScalar(Math.cos(h)).add(east.clone().multiplyScalar(Math.sin(h)));
  const dist = GC.alt / 6371, tl_ = GC.tilt * D2R;
  const P = T.clone().add(up.clone().multiplyScalar(Math.cos(tl_) * dist)).add(fwd.clone().multiplyScalar(-Math.sin(tl_) * dist));
  gCam.position.copy(P); gCam.up.copy(tl_ < 0.05 ? fwd : up); gCam.lookAt(T);
  gCam.near = Math.max(dist * 0.02, 0.00002); gCam.far = 300; if (GC.shift > 0.001) gCam.setViewOffset(innerWidth, innerHeight, -GC.shift * innerWidth, 0, innerWidth, innerHeight); else gCam.clearViewOffset(); gCam.updateProjectionMatrix();
  const a = GC.alt; cloudU.uOp.value = clamp((a - 80) / 600, 0, 1) * .9;
}
// geographic labels and pins
const labelsEl = $('labels');
const GEO = [];
function geo(lat, lon, html, cls) { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; labelsEl.appendChild(el); const o = {el, p: llVec(lat, lon, 1.002), show: false}; GEO.push(o); return o; }
const G = {ksa: geo(23.6, 44.2, 'Kingdom of Saudi Arabia', 'geo big'), gulf: geo(27.4, 51.3, 'Arabian Gulf', 'geo sea'), red: geo(20.6, 38.6, 'Red Sea', 'geo sea'), east: geo(24.2, 49.4, 'Eastern Province', 'geo'),
  riyadh: geo(24.63, 46.72, '<div class="d"></div><div class="n">Riyadh<small>Second Industrial City · 725</small></div>', 'pin'), yanbu: geo(24.09, 38.06, '<div class="d"></div><div class="n">Yanbu<small>Industrial City · 735</small></div>', 'pin'),
  jubail: geo(27.00, 49.62, '<div class="r"></div><div class="d"></div><div class="n">Jubail<small>Industrial City · 860</small></div>', 'pin'), dammam: geo(26.43, 50.10, '<div class="d" style="width:8px;height:8px;background:#fff;box-shadow:none"></div><div class="n" style="top:-8px;font-size:11px">Dammam</div>', 'pin'),
  jsite: geo(SITE.lat, SITE.lon, '<div class="r"></div><div class="d"></div><div class="n">MPW Gasification Complex<small>27.02° N · 49.56° E</small></div>', 'pin')};
const showGeo = keys => GEO.forEach(o => { o.show = false; }) || keys.forEach(k => G[k].show = true);
function updateGeo() {
  const camDir = gCam.position.clone().normalize(), v = new THREE.Vector3();
  GEO.forEach(o => { const vis = o.show && SCENE === 'globe' && o.p.clone().normalize().dot(gCam.position.clone().sub(o.p).normalize()) > 0.05;
    if (vis) { v.copy(o.p).project(gCam); o.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; o.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; }
    o.el.classList.toggle('on', vis && v.z < 1); });
}

// =====================================================================  LOCAL SCENE (metres)
const lScene = new THREE.Scene();
const lCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 90000);
const sky = new Sky(); sky.scale.setScalar(400000); lScene.add(sky);
const sunEl = 17, sunAz = 238;
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, (90 - sunEl) * D2R, sunAz * D2R);
Object.assign(sky.material.uniforms, {}); sky.material.uniforms.turbidity.value = 7; sky.material.uniforms.rayleigh.value = 1.5; sky.material.uniforms.mieCoefficient.value = 0.006; sky.material.uniforms.mieDirectionalG.value = 0.82; sky.material.uniforms.sunPosition.value.copy(sunDir);
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene((() => { const s = new THREE.Scene(); const k = new Sky(); k.scale.setScalar(1000); k.material.uniforms.turbidity.value = 7; k.material.uniforms.rayleigh.value = 1.5; k.material.uniforms.mieCoefficient.value = .006; k.material.uniforms.sunPosition.value.copy(sunDir);
  s.add(k); const g = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({color: 0xb89a74})); g.rotation.x = -Math.PI / 2; g.position.y = -5; s.add(g); return s; })());
lScene.environment = envRT.texture; lScene.environmentIntensity = 0.7;
lScene.fog = new THREE.FogExp2(0xd9c8ad, 0.000045);
const sun = new THREE.DirectionalLight(0xffdfb8, 3.4); sun.position.copy(sunDir).multiplyScalar(800); sun.castShadow = true;
sun.shadow.mapSize.set(LO ? 1024 : 4096, LO ? 1024 : 4096); Object.assign(sun.shadow.camera, {left: -300, right: 300, top: 300, bottom: -300, near: 10, far: 2500}); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
lScene.add(sun, sun.target); lScene.add(new THREE.HemisphereLight(0xcfe0ff, 0xc8a27a, 0.35));
// ground and sea
let LOC = null; const MASK = {data: null, w: 0, h: 0};
const groundTex = tex('assets/local_ground.jpg'); const maskImg = new Image(); maskImg.src = 'assets/local_mask.png';
const detail = noiseTex(512, [8, 16, 32, 64, 128]); detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
const waterN = noiseTex(512, [8, 16, 32, 64], false, true); waterN.wrapS = waterN.wrapT = THREE.RepeatWrapping; waterN.repeat.set(160, 160);
const KM = 30000;
const groundMat = new THREE.MeshStandardMaterial({map: groundTex, roughness: 0.96, metalness: 0, polygonOffset: true, polygonOffsetFactor: 8, polygonOffsetUnits: 8});
groundMat.onBeforeCompile = s => { s.uniforms.tDet = {value: detail};
  s.fragmentShader = s.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D tDet;')
    .replace('#include <map_fragment>', `#include <map_fragment>
      float d1=texture2D(tDet,vMapUv*900.).r, d2=texture2D(tDet,vMapUv*120.).r, d3=texture2D(tDet,vMapUv*14.).g;
      diffuseColor.rgb*= (0.82+0.36*d1)*(0.88+0.24*d2)*(0.9+0.2*d3);`); };
const ground = new THREE.Mesh(new THREE.PlaneGeometry(KM, KM), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; lScene.add(ground);
const seaMat = new THREE.MeshStandardMaterial({color: 0x2a9fa3, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.62, normalMap: waterN, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(KM, KM), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = 0.6; lScene.add(sea);
function sampleLand(x, z) { if (!MASK.data) return true; const u = (x / KM + 0.5), v = (z / KM + 0.5); if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  const i = (Math.floor(v * (MASK.h - 1)) * MASK.w + Math.floor(u * (MASK.w - 1))) * 4; return MASK.data[i] > 140; }
function setupMask() { const c = document.createElement('canvas'); c.width = maskImg.width; c.height = maskImg.height; const g = c.getContext('2d'); g.drawImage(maskImg, 0, 0);
  MASK.data = g.getImageData(0, 0, c.width, c.height).data; MASK.w = c.width; MASK.h = c.height;
  const inv = document.createElement('canvas'); inv.width = c.width; inv.height = c.height; const h = inv.getContext('2d'); const id = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < id.data.length; i += 4) { const v = 255 - id.data[i]; id.data[i] = id.data[i + 1] = id.data[i + 2] = v > 128 ? 255 : v * 1.6; }
  h.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(inv); seaMat.alphaMap = t; seaMat.needsUpdate = true; }

// =====================================================================  materials for the plant and the city
const M = {
  concrete: new THREE.MeshStandardMaterial({color: 0xc9c4ba, roughness: 0.92}), pad: new THREE.MeshStandardMaterial({color: 0xd6d1c6, roughness: 0.9}),
  asphalt: new THREE.MeshStandardMaterial({color: 0x4a4d52, roughness: 0.85}), line: new THREE.MeshStandardMaterial({color: 0xf2f2f0, roughness: 0.6}), yline: new THREE.MeshStandardMaterial({color: 0xe6b428, roughness: .6}),
  vessel: new THREE.MeshStandardMaterial({color: 0xf3f5f7, roughness: 0.3, metalness: 0.18}), clad: new THREE.MeshStandardMaterial({color: 0xd9dfe5, roughness: 0.26, metalness: 0.9}),
  steel: new THREE.MeshStandardMaterial({color: 0x3e6a52, roughness: 0.6, metalness: 0.4}), steelG: new THREE.MeshStandardMaterial({color: 0x7f8a92, roughness: 0.55, metalness: 0.6}),
  rail: new THREE.MeshStandardMaterial({color: 0xe3b12c, roughness: 0.5, metalness: 0.3}), blue: new THREE.MeshStandardMaterial({color: 0x2c5f9e, roughness: 0.45, metalness: 0.4}),
  dark: new THREE.MeshStandardMaterial({color: 0x2d3238, roughness: 0.6, metalness: 0.5}), refr: new THREE.MeshStandardMaterial({color: 0xb7b1a6, roughness: 0.7, metalness: 0.2}),
  wall: new THREE.MeshStandardMaterial({color: 0xf1efe9, roughness: 0.8}), roofR: new THREE.MeshStandardMaterial({color: 0xb5282e, roughness: 0.6, metalness: .2}),
  roofB: new THREE.MeshStandardMaterial({color: 0x2f62a6, roughness: 0.6, metalness: .2}), roofG: new THREE.MeshStandardMaterial({color: 0x9aa1a6, roughness: 0.55, metalness: .4}),
  roofW: new THREE.MeshStandardMaterial({color: 0xe8e8e4, roughness: 0.6, metalness: .2}), glass: new THREE.MeshStandardMaterial({color: 0x26415c, roughness: 0.1, metalness: 0.9}),
  green: new THREE.MeshStandardMaterial({color: 0x5c8a3a, roughness: 0.9}), sandL: new THREE.MeshStandardMaterial({color: 0xd9bf95, roughness: 0.98}), bund: new THREE.MeshStandardMaterial({color: 0xbdb5a6, roughness: 0.95}),
  yellow: new THREE.MeshStandardMaterial({color: 0xe0b52b, roughness: 0.5, metalness: .2}), red: new THREE.MeshStandardMaterial({color: 0xc23b32, roughness: 0.5, metalness: .2}),
  pipeR: new THREE.MeshStandardMaterial({color: 0x9aa6b1, roughness: 0.35, metalness: 0.8}), trunk: new THREE.MeshStandardMaterial({color: 0x7b5a3a, roughness: 0.9}),
  palm: new THREE.MeshStandardMaterial({color: 0x4f7a2e, roughness: 0.8, side: THREE.DoubleSide}), black: new THREE.MeshStandardMaterial({color: 0x15181c, roughness: 0.5})
};
// ---- geometry helpers (y up, metres)
const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const cyl = (r, h, m, x, y, z, parent, seg = 28, r2) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const hcyl = (r, L, m, x, y, z, parent, axis = 'x', seg = 24) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), m); if (axis === 'x') o.rotation.z = Math.PI / 2; else o.rotation.x = Math.PI / 2; o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
function headGeo(r, k = 0.5, seg = 28) { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * k)); } return new THREE.LatheGeometry(pts, seg); }
function vVessel(p, x, z, D, H, o = {}) {
  const g = new THREE.Group(); g.position.set(x, o.y0 || 0, z); p.add(g); const r = D / 2, m = o.m || M.vessel, k = o.k ?? 0.5, sk = o.skirt ?? Math.min(3, H * 0.2);
  cyl(r * 1.02, sk, M.concrete, 0, 0, 0, g, 28); cyl(r, H - sk, m, 0, sk, 0, g, 36);
  const top = new THREE.Mesh(headGeo(r, k), m); top.position.y = H; top.castShadow = true; g.add(top);
  if (o.cone) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.25, o.cone, 28, 1, true), m); c.position.y = sk - o.cone / 2; c.castShadow = true; g.add(c); }
  const nPl = o.plat ?? Math.max(0, Math.floor((H - 4) / 7));
  for (let i = 1; i <= nPl; i++) { const y = sk + (H - sk) * i / (nPl + 0.5); const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.9, 0.06, 6, 40), M.rail); ring.rotation.x = Math.PI / 2; ring.position.y = y + 1.05; g.add(ring);
    const fl = new THREE.Mesh(new THREE.RingGeometry(r + 0.05, r + 0.95, 40, 1, 0, Math.PI * 1.25), M.steelG); fl.rotation.x = -Math.PI / 2; fl.position.y = y; g.add(fl); }
  if (o.ladder !== false && H > 6) { const lad = new THREE.Group(); for (const s of [-0.25, 0.25]) cyl(0.04, H, M.rail, s, 0, r + 0.45, lad, 6); for (let y = 2.5; y < H; y += 0.9) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 4, 12, Math.PI), M.rail); hoop.position.set(0, y, r + 0.65); hoop.rotation.y = Math.PI; lad.add(hoop); } lad.rotation.y = o.lr || 0; g.add(lad); }
  g.userData.top = H + r * k; return g;
}
function hVessel(p, x, y, z, D, L, o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = o.ry || 0; p.add(g); const r = D / 2, m = o.m || M.vessel;
  hcyl(r, L, m, 0, 0, 0, g, 'x', 32); for (const s of [-1, 1]) { const h = new THREE.Mesh(headGeo(r, o.k ?? 0.5), m); h.rotation.z = -s * Math.PI / 2; h.position.x = s * L / 2; h.castShadow = true; g.add(h); }
  if (o.saddles !== false) for (const s of [-0.3, 0.3]) box(D * 0.7, y - 0.0 + 0.01, D * 0.9, M.concrete, s * L, -y, 0, g);
  if (o.bands) for (let i = 0; i < o.bands; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 6, 32), M.steelG); b.rotation.y = Math.PI / 2; b.position.x = -L / 2 + L * (i + 0.5) / o.bands; g.add(b); }
  return g;
}
function frame(p, x, z, w, d, h, levels, m = M.steel) {
  const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g); const cols = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
  cols.forEach(([a, b]) => box(0.45, h, 0.45, m, a, 0, b, g));
  for (let i = 1; i <= levels; i++) { const y = h * i / levels; box(w, 0.4, 0.4, m, 0, y - 0.4, -d / 2, g); box(w, 0.4, 0.4, m, 0, y - 0.4, d / 2, g); box(0.4, 0.4, d, m, -w / 2, y - 0.4, 0, g); box(0.4, 0.4, d, m, w / 2, y - 0.4, 0, g);
    const gr = box(w, 0.12, d, M.steelG, 0, y - 0.1, 0, g); gr.material = M.steelG; const rl = box(w, 0.06, 0.06, M.rail, 0, y + 1.0, -d / 2, g); box(w, 0.06, 0.06, M.rail, 0, y + 1.0, d / 2, g); }
  return g;
}
function pipe(p, pts, r, m = M.clad) {
  const path = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i]), new THREE.Vector3(...pts[i + 1])));
  const geos = []; for (let i = 0; i < pts.length - 1; i++) { const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]), L = a.distanceTo(b); const g = new THREE.CylinderGeometry(r, r, L, 14, 1, true);
    g.translate(0, L / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.applyQuaternion(q); g.translate(a.x, a.y, a.z); geos.push(g);
    if (i > 0) { const s = new THREE.SphereGeometry(r * 1.02, 12, 8); s.translate(a.x, a.y, a.z); geos.push(s); } }
  const o = new THREE.Mesh(mergeGeometries(geos), m); o.castShadow = true; p.add(o); return o;
}
function building(p, x, z, w, d, h, roof = M.roofW, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = o.ry || 0; p.add(g); box(w, h, d, o.wall || M.wall, 0, 0, 0, g);
  if (o.gable) { const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(0, o.gable); s.lineTo(w / 2 + 0.4, 0); const rg = new THREE.ExtrudeGeometry(s, {depth: d + 0.8, bevelEnabled: false}); rg.translate(0, 0, -d / 2 - 0.4); const r = new THREE.Mesh(rg, roof); r.position.y = h; r.castShadow = true; g.add(r); }
  else box(w + 0.6, 0.6, d + 0.6, roof, 0, h, 0, g);
  if (o.doors) for (let i = 0; i < o.doors; i++) box(4, 5, 0.2, M.roofG, -w / 2 + w * (i + 0.5) / o.doors, 0, d / 2 + 0.05, g);
  if (o.win) for (let i = 0; i < o.win; i++) box(w / (o.win * 1.6), 1.4, 0.15, M.glass, -w / 2 + w * (i + 0.5) / o.win, h * 0.55, d / 2 + 0.05, g);
  return g;
}
function tank(p, x, z, D, H, o = {}) { const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g); cyl(D / 2, H, o.m || M.vessel, 0, 0, 0, g, 48);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(D / 2 + 0.1, D * 0.08, 48), o.m || M.vessel); roof.position.y = H + D * 0.04; roof.castShadow = true; g.add(roof);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(D / 2 + 0.02, 0.06, 4, 48), M.steelG); b.rotation.x = Math.PI / 2; b.position.y = H * (i + 1) / 5; g.add(b); }
  const st = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 1.1, y = i / 40 * H; st.push([Math.cos(a) * (D / 2 + 0.6), y, Math.sin(a) * (D / 2 + 0.6)]); } pipe(g, st, 0.12, M.rail);
  return g; }
function palm(p, x, z, s = 1) { const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); p.add(g); cyl(0.22, 7, M.trunk, 0, 0, 0, g, 8, 0.16);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.2, 4, 1, true), M.palm); l.position.set(0, 7, 0); l.rotation.set(1.15, i / 9 * Math.PI * 2, 0); l.translateY(2); l.castShadow = true; g.add(l); } return g; }
const VCOL = {}, BOXM = {}; function vehicle(p, x, z, ry, type, color) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; p.add(g); const cm = VCOL[color] || (VCOL[color] = new THREE.MeshStandardMaterial({color, roughness: .4, metalness: .5}));
  if (type === 'car') { box(4.4, 0.9, 1.9, cm, 0, 0.3, 0, g); box(2.4, 0.7, 1.7, M.glass, -0.2, 1.2, 0, g); }
  else if (type === 'tanker') { box(2.4, 2.6, 2.5, cm, 6, 0.5, 0, g); const t = hcyl(1.2, 9, M.clad, -1, 2.2, 0, g); box(11, 0.4, 2.2, M.dark, -1, 0.6, 0, g); }
  else { box(2.4, 2.6, 2.5, cm, 6, 0.5, 0, g); box(10, 3.2, 2.5, BOXM.t || (BOXM.t = new THREE.MeshStandardMaterial({color: 0xd8d2c4, roughness: .7})), -1, 0.8, 0, g); }
  return g; }

// =====================================================================  the plant
const plant = new THREE.Group(); const PLANT_ROT = -0.62; plant.rotation.y = PLANT_ROT; lScene.add(plant);
const UNITG = {}; const PICK = []; const ANIM = [];
function unit(id, g) { g.userData.unit = id; UNITG[id] = UNITG[id] || []; UNITG[id].push(g); g.traverse(o => { if (o.isMesh) { o.userData.unit = id; PICK.push(o); } }); return g; }
const P = (xm, ym) => [xm - 210, ym - 150]; // plot-plan metres (from the NW corner) -> plant coordinates
function buildPlant() {
  const root = plant;
  // site pad, ring roads and fence
  box(436, 0.25, 316, M.sandL, 0, -0.2, 0, root);
  const pads = [[14, 14, 115, 94, M.pad], [122, 14, 236, 94, M.pad], [243, 14, 340, 94, M.pad], [348, 14, 412, 94, M.pad], [18, 111, 337, 240, M.concrete], [352, 108, 410, 192, M.pad], [352, 200, 412, 240, M.pad], [352, 250, 412, 286, M.sandL], [18, 256, 110, 286, M.pad], [123, 256, 256, 286, M.pad], [265, 256, 337, 286, M.pad]];
  pads.forEach(([x0, y0, x1, y1, m]) => { const [a, b] = P((x0 + x1) / 2, (y0 + y1) / 2); box(x1 - x0, 0.3, y1 - y0, m, a, 0, b, root); });
  const roadsX = [[6, 6, 414, 8], [6, 102, 414, 8], [6, 247, 414, 8], [6, 292, 414, 8]], roadsY = [[6, 6, 300, 8], [118, 6, 102, 6], [239, 6, 102, 6], [344, 6, 300, 8], [414, 6, 300, 8], [116, 247, 300, 6], [260, 247, 300, 6]];
  roadsX.forEach(([x0, y, x1, w]) => { const [a, b] = P((x0 + x1) / 2, y); box(x1 - x0, 0.12, w, M.asphalt, a, 0.25, b, root); box(x1 - x0, 0.03, 0.2, M.line, a, 0.37, b, root); });
  roadsY.forEach(([x, y0, y1, w]) => { const [a, b] = P(x, (y0 + y1) / 2); box(w, 0.12, y1 - y0, M.asphalt, a, 0.25, b, root); });
  // fence and trees along the north boundary
  for (const [x0, y0, x1, y1] of [[0, 0, 420, 0], [0, 300, 420, 300], [0, 0, 0, 300], [420, 0, 420, 300]]) { const [a, b] = P((x0 + x1) / 2, (y0 + y1) / 2); box(Math.max(0.15, x1 - x0), 2.4, Math.max(0.15, y1 - y0), M.steelG, a, 0, b, root); }
  for (let x = 20; x < 410; x += 14) { const [a, b] = P(x, 2.5); palm(root, a, b, 0.9 + Math.random() * 0.2); }
  // ---------------- administration and amenities (north row)
  { const [a, b] = P(58, 35); unit('ADMIN', building(root, a, b, 48, 28, 12, M.roofB, {win: 8})); }
  { const [a, b] = P(100, 30); building(root, a, b, 22, 14, 5, M.green); }
  for (let i = 0; i < 46; i++) { const [a, b] = P(30 + (i % 15) * 5.6, 62 + Math.floor(i / 15) * 10); vehicle(root, a, b, Math.PI / 2, 'car', [0xffffff, 0x222222, 0x9a1b1b, 0x8c96a0, 0x2a5fa0][i % 5]); }
  { const g = new THREE.Group(); const [a, b] = P(178, 50); g.position.set(a, 0, b); root.add(g); unit('ADMIN', g);
    building(g, -38, -18, 22, 22, 6, M.roofW); box(3, 0.3, 8, M.red, -38, 6.6, -18, g); box(8, 0.3, 3, M.red, -38, 6.6, -18, g);
    building(g, -10, -18, 22, 20, 7, M.roofW); const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.wall); dome.position.set(-10, 7.6, -18); dome.castShadow = true; g.add(dome); cyl(1.2, 26, M.wall, 2, 0, -24, g, 12); cyl(1.6, 2, M.wall, 2, 24, -24, g, 12);
    building(g, 22, -18, 30, 22, 7, M.roofG, {win: 5}); building(g, 22, 12, 28, 22, 8, M.roofR, {doors: 4});
    box(52, 0.35, 26, M.green, -24, 0.1, 14, g); for (let i = 0; i < 12; i++) palm(g, -46 + (i % 6) * 8.5, 6 + Math.floor(i / 6) * 14, 0.8 + Math.random() * .3); }
  // services: workshop, control room, operators, lab
  { const [a, b] = P(291, 33); building(root, a, b, 86, 26, 11, M.roofG, {doors: 5, gable: 2.5}); }
  { const [a, b] = P(268, 72); unit('CONTROL', building(root, a, b, 36, 24, 8, M.roofR, {win: 6})); const [c, d] = P(306, 72); building(root, c, d, 22, 22, 6, M.roofW); const [e, f] = P(330, 72); building(root, e, f, 20, 22, 6, M.green); }
  // product loading
  { const g = new THREE.Group(); const [a, b] = P(380, 54); g.position.set(a, 0, b); root.add(g); unit('TANKS', g);
    for (let i = 0; i < 3; i++) { frame(g, -16 + i * 14, -6, 6, 12, 7, 1, M.steelG); vehicle(g, -16 + i * 14, -6, Math.PI / 2, 'tanker', 0xf2f2f2); }
    building(g, 18, 16, 16, 12, 5, M.roofB); }
  // tank farm
  { const g = new THREE.Group(); root.add(g); unit('TANKS', g); const [a, b] = P(381, 150);
    const bw = [[58, 84]]; box(58, 1.4, 1, M.bund, a, 0, b - 42, g); box(58, 1.4, 1, M.bund, a, 0, b + 42, g); box(1, 1.4, 84, M.bund, a - 29, 0, b, g); box(1, 1.4, 84, M.bund, a + 29, 0, b, g);
    tank(g, a - 10, b - 22, 22, 17); tank(g, a - 10, b + 20, 22, 17); tank(g, a + 16, b - 1, 14, 13); }
  // wastewater treatment
  { const [a, b] = P(382, 220); const g = new THREE.Group(); root.add(g); unit('CTOWER', g); cyl(8, 3, M.concrete, a + 12, 0, b - 4, g, 40); cyl(7.4, 0.2, new THREE.MeshStandardMaterial({color: 0x557a6a, roughness: .2}), a + 12, 2.95, b - 4, g, 40); cyl(5, 3, M.concrete, a - 6, 0, b - 10, g, 32); building(g, a - 10, b + 10, 18, 12, 5, M.roofB); }
  // flare
  { const [a, b] = P(392, 268); const g = new THREE.Group(); root.add(g); unit('FLARE', g); cyl(0.9, 52, M.steelG, a, 0, b, g, 16, 0.7); cyl(1.3, 3, M.dark, a, 52, b, g, 16);
    for (let i = 0; i < 3; i++) { const ang = i / 3 * Math.PI * 2; pipe(g, [[a, 40, b], [a + Math.cos(ang) * 22, 0, b + Math.sin(ang) * 22]], 0.05, M.steelG); }
    const ex = new THREE.Mesh(new THREE.RingGeometry(15.5, 16, 64), new THREE.MeshBasicMaterial({color: 0xd64b3a, transparent: true, opacity: 0.8})); ex.rotation.x = -Math.PI / 2; ex.position.set(a, 0.5, b); g.add(ex);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({map: flameTex(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false})); fl.position.set(a, 58, b); fl.scale.set(7, 12, 1); g.add(fl);
    const pl = new THREE.PointLight(0xff8a3a, 1500, 120, 2); pl.position.set(a, 58, b); g.add(pl); ANIM.push(t => { const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3); fl.scale.set(6.5 * f, 12 * (0.9 + 0.2 * Math.sin(t * 11)), 1); pl.intensity = 1300 * f; }); }
  // truck parking and weighbridge
  for (let i = 0; i < 8; i++) { const [a, b] = P(30 + (i % 4) * 20, 263 + Math.floor(i / 4) * 14); vehicle(root, a, b, 0, i % 3 ? 'truck' : 'tanker', [0x1f4e79, 0xd0d0d0, 0xb84a2a][i % 3]); }
  { const [a, b] = P(98, 270); building(root, a, b, 10, 6, 3, M.roofB); }
  // utilities: fire water, BFW and demineralisation, cooling tower, substation, CCU land
  { const g = new THREE.Group(); root.add(g); unit('CTOWER', g);
    const [a, b] = P(134, 271); tank(g, a, b, 14, 10, {m: new THREE.MeshStandardMaterial({color: 0xc8483e, roughness: .5, metalness: .3})});
    const [c, d] = P(176, 271); building(g, c, d, 30, 18, 9, M.roofB, {win: 4});
    const [e, f] = P(226, 271); box(56, 10, 20, new THREE.MeshStandardMaterial({color: 0x9db8cf, roughness: 0.6}), e, 0, f, g);
    for (let i = 0; i < 4; i++) { const fx = e - 21 + i * 14; cyl(4.4, 3.5, M.roofG, fx, 10, f, g, 32, 4.0); const fan = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.15, 0.6), M.dark); fan.userData.keep = true; fan.position.set(fx, 12.6, f); g.add(fan); ANIM.push(t => fan.rotation.y = t * 4 + i);
      steam(g, fx, 14, f, 1); }
    const [h, k] = P(282, 271); building(g, h, k, 22, 16, 5, M.roofW); for (let i = 0; i < 3; i++) box(3, 4, 3, M.dark, h - 6 + i * 6, 0, k + 12, g);
    const [m1, n1] = P(305, 271); box(60, 0.2, 26, new THREE.MeshStandardMaterial({color: 0xcfc6b4, roughness: 1}), m1, 0.3, n1, root); }
  // ---------------- process block
  // MPW storage hall and crusher
  { const [a, b] = P(62, 155); unit('HALL', building(root, a, b, 75, 70, 16, M.roofG, {gable: 5})); for (let i = 0; i < 3; i++) { box(0.4, 6, 8, M.yellow, a - 38, 0, b - 22 + i * 22, root); vehicle(root, a - 46, b - 22 + i * 22, 0, 'truck', 0x1f4e79); }
    const [c, d] = P(85, 216); const g = new THREE.Group(); root.add(g); unit('CR-101', g); building(g, c, d, 30, 30, 12, M.roofG); for (let i = 0; i < 2; i++) { box(6, 4, 5, M.blue, c - 6 + i * 12, 12, d, g); }
    pipe(g, [[c + 15, 10, d - 2], [c + 50, 13, d - 30], [c + 64, 13, d - 52]], 1.0, M.steelG); }
  // pipe rack along the process block
  const RZ = P(0, 172)[1], RX0 = P(130, 0)[0], RX1 = P(334, 0)[0];
  { const g = new THREE.Group(); root.add(g);
    for (let x = RX0; x <= RX1; x += 8) { box(0.5, 9, 0.5, M.steel, x, 0, RZ - 4, g); box(0.5, 9, 0.5, M.steel, x, 0, RZ + 4, g); box(0.4, 0.4, 8.5, M.steel, x, 6, RZ, g); box(0.4, 0.4, 8.5, M.steel, x, 8.6, RZ, g); }
    const cols = [M.clad, M.clad, M.pipeR, M.clad, M.yellow, M.clad, M.pipeR, M.red, M.clad];
    cols.forEach((m, i) => pipe(g, [[RX0, i < 5 ? 6.8 : 9.4, RZ - 3.2 + (i % 5) * 1.6], [RX1, i < 5 ? 6.8 : 9.4, RZ - 3.2 + (i % 5) * 1.6]], i % 3 === 0 ? 0.55 : 0.35, m)); }
  // --- feed preparation: E-101 A/B, E-102, D-101
  { const g = new THREE.Group(); root.add(g); unit('E-101', g); const [a, b] = P(132, 125);
    for (const dz of [0, 9]) { hVessel(g, a, 3, b + dz, 3.2, 16, {bands: 3}); box(18, 1.2, 1.2, M.steelG, a, 6, b + dz, g); hcyl(0.9, 6, M.vessel, a + 2, 6.8, b + dz, g); }
    cyl(0.9, 26, M.steelG, a - 10, 0, b + 4.5, g, 16, 0.8); }
  { const g = new THREE.Group(); root.add(g); unit('E-102', g); const [a, b] = P(132, 150); box(10, 12, 9, M.refr, a, 0, b, g); box(10.4, 1, 9.4, M.steelG, a, 12, b, g); cyl(0.8, 6, M.steelG, a, 13, b, g, 16); }
  { const g = new THREE.Group(); root.add(g); unit('D-101', g); const [a, b] = P(150, 150); vVessel(g, a, b, 3.6, 9, {plat: 1}); }
  // --- gasification: five R-101 trains, each with a combustor and three cyclones
  for (let i = 0; i < 5; i++) {
    const [a, b] = P(162 + i * 18, 133), g = new THREE.Group(); root.add(g); unit('R-101', g);
    vVessel(g, a, b, 8.2, 13, {m: M.refr, plat: 1, k: 0.32, skirt: 3});
    box(7, 11, 7, M.refr, a, 0, b - 11, g); cyl(0.8, 18, M.steelG, a, 11, b - 11, g, 16); steam(g, a, 31, b - 11, 0.6);
    pipe(g, [[a, 15, b], [a, 18, b + 4], [a, 18, b + 9]], 1.2, M.refr);
    const cy = new THREE.Group(); root.add(cy); unit('CY-101', cy);
    frame(cy, a, b + 11, 13, 6, 9, 1, M.steel);
    for (let k = 0; k < 3; k++) { const cx = a - 4.2 + k * 4.2, cz = b + 11; cyl(1.75, 6, M.vessel, cx, 12, cz, cy, 28); cyl(0.4, 3, M.vessel, cx, 9, cz, cy, 16, 1.75); cyl(0.4, 9, M.vessel, cx, 0, cz, cy, 12); cyl(0.9, 3, M.vessel, cx, 18, cz, cy, 16); }
    pipe(cy, [[a, 19.5, b + 11], [a, 23, b + 11], [a + 9, 23, b + 11]], 0.9, M.clad);
  }
  // --- syngas split and shift
  { const g = new THREE.Group(); root.add(g); unit('D-102', g); const [a, b] = P(262, 128); vVessel(g, a, b, 4.84, 10, {plat: 1}); pipe(g, [[a - 10, 23, b + 16], [a, 23, b + 16], [a, 12, b]], 0.9); }
  { const g = new THREE.Group(); root.add(g); unit('M-101', g); const [a, b] = P(276, 128); vVessel(g, a, b, 4.5, 9, {plat: 1, m: M.refr}); }
  { const g = new THREE.Group(); root.add(g); unit('E-103', g); const [a, b] = P(290, 126); for (const dz of [0, 7]) { hVessel(g, a, 3, b + dz, 2.6, 13); hVessel(g, a, 6.4, b + dz, 1.4, 7, {saddles: false}); } }
  { const g = new THREE.Group(); root.add(g); unit('R-102', g); const [a, b] = P(305, 132); vVessel(g, a, b, 5.4, 9.7, {k: 0.42}); pipe(g, [[a - 10, 6, b - 3], [a - 4, 6, b - 3]], 0.7); }
  // --- hydrogen membrane rack and compressor
  { const g = new THREE.Group(); root.add(g); unit('ME-101', g); const [a, b] = P(322, 124);
    frame(g, a, b, 13, 9, 8, 2, M.steelG);
    for (let k = 0; k < 26; k++) { const lx = a - 5.6 + (k % 13) * 0.93, lz = b - 2 + Math.floor(k / 13) * 4; cyl(0.38, 3.4, M.clad, lx, k % 2 ? 4.4 : 0.6, lz, g, 16); cyl(0.42, 0.25, M.steelG, lx, (k % 2 ? 4.4 : 0.6) + 3.4, lz, g, 16); }
    pipe(g, [[a - 7, 8.2, b - 2], [a + 7, 8.2, b - 2]], 0.4); pipe(g, [[a - 7, 8.2, b + 2], [a + 7, 8.2, b + 2]], 0.4); }
  { const g = new THREE.Group(); root.add(g); unit('C-102', g); const [a, b] = P(322, 148); box(16, 0.6, 9, M.concrete, a, 0, b, g); box(9, 3.2, 3.6, M.blue, a - 2, 0.6, b, g); hcyl(1.7, 4.5, M.blue, a + 5, 2.3, b, g); box(17, 0.3, 10, M.roofG, a, 8, b, g); for (const s of [-1, 1]) for (const t of [-1, 1]) box(0.3, 8, 0.3, M.steelG, a + s * 8, 0, b + t * 4.6, g); }
  // --- compression: suction coolers, KO drum and the five-stage C-101 train
  { const g = new THREE.Group(); root.add(g); unit('SC', g); const [a, b] = P(150, 192);
    hVessel(g, a, 3, b, 2.4, 11, {bands: 2}); hVessel(g, a, 3, b + 6, 2.0, 9); const [c, d] = P(164, 198); vVessel(g, c, d, 3, 8, {plat: 1}); }
  { const g = new THREE.Group(); root.add(g); unit('C-101', g); const [a, b] = P(196, 212);
    box(46, 0.8, 14, M.concrete, a, 0, b, g);
    for (let k = 0; k < 5; k++) { const sx = a - 18 + k * 7.5; hcyl(2.1 - k * 0.22, 4.2, M.blue, sx, 3.2, b, g); box(4.6, 2.2, 3.8, M.blue, sx, 0.8, b, g); }
    hcyl(2.4, 7, new THREE.MeshStandardMaterial({color: 0x1d4b7f, roughness: .4, metalness: .5}), a + 21, 3.4, b, g); box(46, 0.3, 1, M.dark, a, 3.2, b - 2.6, g);
    for (let k = 0; k < 4; k++) { hVessel(g, a - 14 + k * 7.5, 2.4, b - 9, 1.6, 6, {bands: 1}); pipe(g, [[a - 18 + k * 7.5, 5, b], [a - 18 + k * 7.5, 7, b - 9], [a - 14 + k * 7.5, 3.2, b - 9]], 0.45); }
    for (let k = 0; k < 3; k++) frame(g, a - 16 + k * 16, b + 9.5, 10, 4, 6, 1, M.steel);
    box(8, 4, 6, M.blue, a + 30, 0, b + 4, g); hVessel(g, a + 30, 2, b - 6, 1.6, 5); }
  // --- synthesis loop: M-102, E-104, R-103, E-105, F-101, D-103, C-101R
  { const g = new THREE.Group(); root.add(g); unit('E-104', g); const [a, b] = P(236, 190); hVessel(g, a, 3.5, b, 1.121 * 1.6, 7.8, {bands: 2}); vVessel(g, a - 9, b, 1.6, 4, {plat: 0, ladder: false}); }
  { const g = new THREE.Group(); root.add(g); unit('R-103', g); const [a, b] = P(252, 205);
    frame(g, a, b, 9, 9, 5, 1, M.steel); vVessel(g, a, b, 3.51 * 1.25, 8.8, {y0: 5, plat: 1, k: 0.5, skirt: 0.4}); hVessel(g, a + 1, 17.5, b, 2.2, 8, {saddles: false}); box(8, 0.4, 2.5, M.steelG, a + 1, 16, b, g);
    pipe(g, [[a + 4, 17.5, b], [a + 3, 13, b + 1.2], [a + 2.4, 9, b + 1.2]], 0.35, M.clad); pipe(g, [[a - 3, 17.5, b], [a - 2.4, 10, b - 1.5]], 0.35, M.clad);
    const ring = new THREE.Mesh(new THREE.RingGeometry(18.6, 19, 96), new THREE.MeshBasicMaterial({color: 0xff4d3a, transparent: true, opacity: 0, depthWrite: false})); ring.rotation.x = -Math.PI / 2; ring.position.set(a, 0.6, b); g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(18.6, 96), new THREE.MeshBasicMaterial({color: 0xff4d3a, transparent: true, opacity: 0, depthWrite: false})); disc.rotation.x = -Math.PI / 2; disc.position.set(a, 0.55, b); g.add(disc); FX.fei = [ring, disc]; }
  { const g = new THREE.Group(); root.add(g); unit('E-105', g); const [a, b] = P(272, 196); frame(g, a, b, 9, 7, 5, 1, M.steel); for (let k = 0; k < 4; k++) hVessel(g, a, k < 2 ? 2 : 6.4, b - 1.6 + (k % 2) * 3.2, 1.003 * 1.5, 7.5, {saddles: k < 2, bands: 1}); }
  { const g = new THREE.Group(); root.add(g); unit('F-101', g); const [a, b] = P(288, 206); vVessel(g, a, b, 3.5, 8.75, {plat: 1}); }
  { const g = new THREE.Group(); root.add(g); unit('F-101', g); const [a, b] = P(298, 196); vVessel(g, a, b, 1.6, 4.5, {plat: 0, ladder: false}); const [c, d] = P(232, 222); box(9, 0.5, 6, M.concrete, c, 0, d, g); box(5, 2.4, 2.6, M.blue, c - 1, 0.5, d, g); hcyl(1.2, 3, M.blue, c + 3, 1.7, d, g); }
  // --- purification: T-101, condenser, reflux drum, reboiler
  { const g = new THREE.Group(); root.add(g); unit('T-101', g); const [a, b] = P(318, 212);
    vVessel(g, a, b, 3.38 * 1.15, 33.6, {plat: 5, skirt: 4, lr: 0.6}); pipe(g, [[a, 35.6, b], [a, 37.5, b], [a + 7, 37.5, b], [a + 7, 14, b - 6]], 0.6);
    frame(g, a + 8, b - 8, 9, 8, 12, 2, M.steel); hVessel(g, a + 8, 12.8, b - 8, 1.8, 8, {saddles: false, bands: 1}); hVessel(g, a + 9, 6.6, b - 8, 2.0, 6, {saddles: false});
    hVessel(g, a - 4, 2.6, b + 10, 2.6, 7, {k: 0.45}); pipe(g, [[a - 4, 4, b + 10], [a - 1.5, 6, b + 4], [a - 1.5, 6, b + 1.5]], 0.5); }
  // heat-integration exchangers E-106, E-107 (shown in red on the heat-integration slide)
  { const g = new THREE.Group(); root.add(g); unit('E-106', g); const [a, b] = P(176, 190); hVessel(g, a, 3, b, 2.2, 8, {bands: 1}); }
  { const g = new THREE.Group(); root.add(g); unit('E-107', g); const [a, b] = P(262, 222); hVessel(g, a, 2.4, b, 1.6, 6); }
  // process interconnections
  { const g = new THREE.Group(); root.add(g);
    const L = (pts, r = 0.45, m = M.clad) => pipe(g, pts, r, m);
    const [x1, z1] = P(262, 128), [x2, z2] = P(305, 132), [x3, z3] = P(322, 124), [x4, z4] = P(150, 192), [x5, z5] = P(252, 205), [x6, z6] = P(318, 212);
    L([[x1 + 3, 6, z1], [x1 + 3, 6.8, RZ - 3.2]], 0.55); L([[x2, 4, z2 + 3], [x2, 6.8, RZ - 1.6]], 0.55); L([[x3, 2, z3 + 5], [x3, 9.4, RZ - 3.2]], 0.4);
    L([[x4 + 6, 3, z4], [x4 + 6, 9.4, RZ + 3.2]], 0.55); L([[x5, 8, z5 - 3], [x5, 6.8, RZ + 3.2]], 0.45); L([[x6, 3, z6 - 3], [x6, 9.4, RZ + 1.6]], 0.45);
    FX.flow = []; const FC = [0xff6b3a, 0x3aa0ff, 0x7bd389, 0xffd166, 0xc084fc];
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, RX1 - RX0, 8, 1, true), new THREE.MeshBasicMaterial({color: FC[i], transparent: true, opacity: 0, map: dashTex(), depthWrite: false}));
      t.rotation.z = Math.PI / 2; t.position.set((RX0 + RX1) / 2, 10.6 + i * 0.6, RZ - 2 + i); t.material.map.repeat.set(1, 30); g.add(t); FX.flow.push(t); }
  }
  // lights and a few palms along the internal roads
  for (let x = 30; x < 400; x += 40) { const [a, b] = P(x, 106); cyl(0.12, 9, M.steelG, a, 0, b, root, 6); box(1.4, 0.3, 0.5, M.dark, a + .5, 9, b, root); }
}
const FX = {fei: null, flow: null};
function dashTex() { const t = canvasTex(16, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
let _flame; function flameTex() { return _flame || (_flame = canvasTex(128, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h * 0.72, 4, w / 2, h * 0.6, h * 0.55); r.addColorStop(0, 'rgba(255,250,220,1)'); r.addColorStop(.25, 'rgba(255,190,80,.95)'); r.addColorStop(.6, 'rgba(255,90,30,.5)'); r.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); })); }
let _smoke; function smokeTex() { return _smoke || (_smoke = radial('rgba(255,255,255,.55)', 'rgba(255,255,255,0)')); }
function steam(p, x, y, z, s = 1) { const parts = []; for (let i = 0; i < 9; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: smokeTex(), transparent: true, depthWrite: false, opacity: 0.4})); sp.position.set(x, y, z); p.add(sp); parts.push({sp, o: i / 9}); }
  ANIM.push((t, dt) => parts.forEach(q => { const k = (t * 0.12 * s + q.o) % 1; q.sp.position.set(x + k * 9 * s, y + k * 22 * s, z + k * 3); const sc = (3 + k * 14) * s; q.sp.scale.set(sc, sc, 1); q.sp.material.opacity = 0.5 * Math.sin(k * Math.PI) * (1 - k * 0.4); })); }

// merge the thousands of small static meshes into one mesh per (unit, material)
function consolidate(root) {
  root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert(), buckets = new Map(), kill = [];
  root.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.userData.keep || o.material.isMeshBasicMaterial) return;
    let id = '', q = o; while (q && q !== root) { if (q.userData.unit) { id = q.userData.unit; break; } q = q.parent; } const key = id + '|' + o.material.uuid; let b = buckets.get(key); if (!b) { b = {id, mat: o.material, geos: []}; buckets.set(key, b); }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); b.geos.push(g); kill.push(o); });
  kill.forEach(o => o.parent.remove(o));
  for (const k in UNITG) UNITG[k] = []; PICK.length = 0;
  buckets.forEach(b => { const m = new THREE.Mesh(mergeGeometries(b.geos), b.mat); m.castShadow = m.receiveShadow = true; root.add(m);
    if (b.id) { m.userData.unit = b.id; (UNITG[b.id] = UNITG[b.id] || []).push(m); PICK.push(m); } b.geos.forEach(g => g.dispose()); });
  // keep the remaining (animated / basic) objects of each unit in its list too
}
// =====================================================================  the industrial city around the plant
function buildCity() {
  const rot = PLANT_ROT, cr = Math.cos(rot), sr = Math.sin(rot);
  const W = (u, v) => [u * cr + v * sr, -u * sr + v * cr];
  const N = {tank: [], col: [], bld: [], pad: [], road: [], stack: [], sph: [], rack: [], house: [], tree: [], ship: [], chim: []};
  const rnd = (() => { let s = 98765; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const BU = 780, BV = 600, RW = 16;
  for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) {
    const u0 = i * BU, v0 = j * BV, [x, z] = W(u0, v0), d = Math.hypot(x, z); if (d > 11500) continue;
    // highways on the block edges (only on land)
    const [ex, ez] = W(u0 + BU / 2, v0), [nx, nz] = W(u0, v0 + BV / 2);
    if (sampleLand(ex, ez) && (i % 2 === 0 || rnd() < 0.5)) N.road.push([ex, ez, i % 2 ? 9 : RW, BV, rot]);
    if (sampleLand(nx, nz) && (j % 3 === 0 || rnd() < 0.6)) N.road.push([nx, nz, BU, j % 3 ? 9 : RW, rot]);
    if (Math.abs(i) <= 0 && Math.abs(j) <= 0) continue;
    if (!sampleLand(x, z) || !sampleLand(...W(u0 + 400, v0 + 300)) || !sampleLand(...W(u0 - 400, v0 - 300))) continue;
    const coast = !sampleLand(...W(u0 + 1300, v0 - 900)) || !sampleLand(...W(u0 + 2300, v0 - 1600));
    if (coast && rnd() < 0.7) { for (let k = 0; k < 60; k++) { const uu = u0 + (rnd() - .5) * BU * .85, vv = v0 + (rnd() - .5) * BV * .85; N.house.push([...W(uu, vv), 16 + rnd() * 18, 5 + rnd() * 7, 14 + rnd() * 16, rot]); if (k % 3 === 0) N.tree.push([...W(uu + 14, vv + 10)]); } continue; }
    if (rnd() > (d < 6000 ? 0.78 : 0.5)) continue;
    // one industrial plant per block: a fenced pad with tank farm, process area, rack, buildings and a stack
    const pw = BU * (0.62 + rnd() * 0.26), pd = BV * (0.62 + rnd() * 0.26), pu = u0 + (rnd() - .5) * (BU - pw - 80), pv = v0 + (rnd() - .5) * (BV - pd - 80);
    N.pad.push([...W(pu, pv), pw, pd, rot]);
    const sideT = rnd() < .5 ? -1 : 1, R = 9 + rnd() * 13, nr = 2 + Math.floor(rnd() * 2), nc = 2 + Math.floor(rnd() * 3);
    for (let a = 0; a < nr; a++) for (let b = 0; b < nc; b++) N.tank.push([...W(pu + sideT * pw * 0.28 + (a - (nr - 1) / 2) * R * 2.7, pv + (b - (nc - 1) / 2) * R * 2.7), R, 10 + rnd() * 8]);
    if (rnd() < 0.35) for (let a = 0; a < 3; a++) N.sph.push([...W(pu + sideT * pw * 0.28 + (a - 1) * 30, pv - pd * 0.38), 8 + rnd() * 3]);
    const pu2 = pu - sideT * pw * 0.18;
    for (let k = 0; k < 10; k++) N.col.push([...W(pu2 + (rnd() - .5) * pw * 0.32, pv + (rnd() - .5) * pd * 0.5), 1.2 + rnd() * 2.6, 14 + rnd() * 48]);
    for (let k = 0; k < 5; k++) N.bld.push([...W(pu2 + (rnd() - .5) * pw * 0.35, pv + (rnd() - .5) * pd * 0.55), 10 + rnd() * 24, 6 + rnd() * 14, 8 + rnd() * 18, rot, 0]);
    N.rack.push([...W(pu2, pv + pd * 0.05), pw * 0.4, 6, rot]);
    for (let k = 0; k < 2; k++) N.bld.push([...W(pu - pw * 0.3 + k * pw * 0.25, pv + pd * 0.4), 30 + rnd() * 40, 7 + rnd() * 5, 18 + rnd() * 12, rot, 1]);
    if (rnd() < 0.7) N.stack.push([...W(pu + pw * 0.45, pv - pd * 0.45), 1.6, 55 + rnd() * 55]);
    if (rnd() < 0.4) N.chim.push([...W(pu2 + 20, pv - 30), 3.5, 70 + rnd() * 40]);
  }
  // King Fahd Industrial Port: jetties into the Gulf north-east of the site
  const port = ll2xz(27.075, 49.64), pr = 0.9;
  for (let k = 0; k < 3; k++) { const L = 2600 - k * 500, pts = [port[0] + k * 60, port[1] - k * 380]; const g = new THREE.Mesh(new THREE.BoxGeometry(L, 4, 90), M.pad); g.position.set(pts[0] + Math.cos(pr) * L / 2, 1.5, pts[1] - Math.sin(pr) * L / 2); g.rotation.y = pr; g.receiveShadow = true; lScene.add(g);
    for (let s = 0; s < 2; s++) N.ship.push([pts[0] + Math.cos(pr) * (L * (0.45 + s * 0.4)) - Math.sin(pr) * 75, pts[1] - Math.sin(pr) * (L * (0.45 + s * 0.4)) - Math.cos(pr) * 75, 180 + s * 60, pr]); }
  const dummy = new THREE.Object3D(), C = new THREE.Color();
  const inst = (geo, mat, list, set, shadows = false) => { if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((a, i) => { dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); set(dummy, a, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    m.castShadow = shadows; m.receiveShadow = true; lScene.add(m); return m; };
  const tankM = new THREE.MeshStandardMaterial({color: 0xeef0f2, roughness: 0.35, metalness: 0.4});
  inst(new THREE.CylinderGeometry(1, 1, 1, 24), tankM, N.tank, (o, [x, z, r, h]) => { o.position.set(x, h / 2, z); o.scale.set(r, h, r); });
  inst(new THREE.SphereGeometry(1, 18, 10), tankM, N.sph, (o, [x, z, r]) => { o.position.set(x, r * 1.25, z); o.scale.setScalar(r); });
  inst(new THREE.CylinderGeometry(1, 1, 1, 10), M.clad, N.col, (o, [x, z, r, h]) => { o.position.set(x, h / 2, z); o.scale.set(r, h, r); });
  inst(new THREE.CylinderGeometry(1, 1, 1, 8), M.steelG, N.stack, (o, [x, z, r, h]) => { o.position.set(x, h / 2, z); o.scale.set(r, h, r); });
  inst(new THREE.CylinderGeometry(0.75, 1, 1, 12), new THREE.MeshStandardMaterial({color: 0xd9d4cc, roughness: 0.8}), N.chim, (o, [x, z, r, h]) => { o.position.set(x, h / 2, z); o.scale.set(r, h, r); });
  const bm = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.7, metalness: 0.1}), N.bld, (o, [x, z, w, h, d, r]) => { o.position.set(x, h / 2, z); o.scale.set(w, h, d); o.rotation.set(0, r, 0); });
  if (bm) { N.bld.forEach((a, i) => bm.setColorAt(i, C.set(a[5] ? [0xe4e2dc, 0xd0d4d8, 0x5f86b8, 0xe4e2dc, 0xb84a40][i % 5] : [0xcfd3d6, 0xa9b1b8, 0xe0ddd5][i % 3]))); bm.instanceColor.needsUpdate = true; }
  const pm = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.95}), N.pad, (o, [x, z, w, d, r]) => { o.position.set(x, 0.2, z); o.scale.set(w, 0.4, d); o.rotation.set(0, r, 0); });
  if (pm) { N.pad.forEach((a, i) => pm.setColorAt(i, C.set([0xc9c1b1, 0xbdb6a8, 0xd3c9b5, 0xb0aaa0, 0xcdbfa6][i % 5]))); pm.instanceColor.needsUpdate = true; }
  inst(new THREE.BoxGeometry(1, 1, 1), M.asphalt, N.road, (o, [x, z, w, d, r]) => { o.position.set(x, 0.35, z); o.scale.set(w, 0.5, d); o.rotation.set(0, r, 0); });
  inst(new THREE.BoxGeometry(1, 1, 1), M.pipeR, N.rack, (o, [x, z, w, h, r]) => { o.position.set(x, 6, z); o.scale.set(w, 2, h); o.rotation.set(0, r, 0); });
  const hm = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.85}), N.house, (o, [x, z, w, h, d, r]) => { o.position.set(x, h / 2, z); o.scale.set(w, h, d); o.rotation.set(0, r, 0); });
  if (hm) { N.house.forEach((a, i) => hm.setColorAt(i, C.set([0xf1ece2, 0xe7dcc8, 0xd9cdb6, 0xf6f4ef][i % 4]))); hm.instanceColor.needsUpdate = true; }
  inst(new THREE.ConeGeometry(1, 1, 7), M.palm, N.tree, (o, [x, z]) => { o.position.set(x, 4, z); o.scale.set(3.5, 6, 3.5); });
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0x7a2a22, roughness: 0.6, metalness: 0.3}), N.ship, (o, [x, z, L, r]) => { o.position.set(x, 6, z); o.scale.set(L, 12, 30); o.rotation.set(0, r, 0); });
  // access road from the plant gate to the highway grid
  const [ax, az] = W(0, -(BV / 2 + 158) / 2); const acc = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, Math.max(1, BV / 2 - 158)), M.asphalt); acc.position.set(ax, 0.15, az); acc.rotation.y = rot; lScene.add(acc);
}
function ll2xz(lat, lon) { return [(lon - SITE.lon) * 111320 * Math.cos(SITE.lat * D2R), -(lat - SITE.lat) * 110570]; }
// clouds above the city, passed through during the descent
const lClouds = []; function buildClouds() { for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({map: smokeTex(), transparent: true, depthWrite: false, opacity: 0.0, fog: false})); const a = Math.random() * Math.PI * 2, r = 600 + Math.random() * 2600;
  s.position.set(Math.cos(a) * r, 2400 + Math.random() * 1600, Math.sin(a) * r); const sc = 1400 + Math.random() * 1800; s.scale.set(sc, sc * 0.55, 1); lScene.add(s); lClouds.push(s); } }

// =====================================================================  local camera (orbit parameters)
const LC = {tx: 0, ty: 0, tz: 0, dist: 9000, az: 200, el: 80, shift: 0};
const controls = new OrbitControls(lCam, canvas); controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = 1.45; controls.minDistance = 15; controls.maxDistance = 14000;
function applyLocalCam() {
  if (EXPLORE && !FOCUS_TWEEN) { controls.update(); syncLC(); }
  else { const az = LC.az * D2R, el = LC.el * D2R; lCam.position.set(LC.tx + LC.dist * Math.cos(el) * Math.sin(az), LC.ty + LC.dist * Math.sin(el), LC.tz + LC.dist * Math.cos(el) * Math.cos(az)); lCam.lookAt(LC.tx, LC.ty, LC.tz); controls.target.set(LC.tx, LC.ty, LC.tz); }
  { const r = clamp(LC.dist * 1.1, 70, 650); const c = sun.shadow.camera; if (Math.abs(c.right - r) > 1) { c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.updateProjectionMatrix(); }
    sun.target.position.set(LC.tx, 0, LC.tz); sun.position.copy(sunDir).multiplyScalar(900).add(sun.target.position); sun.target.updateMatrixWorld(); }
  HLM.forEach(m => { if (m.emissive.getHex() === 0xff9a3c) m.emissiveIntensity = 0.12 + 0.1 * Math.sin(T * 3.2); });
  const alt = lCam.position.y; lScene.fog.density = alt > 2000 ? 0.000016 : lerp(0.00011, 0.000016, alt / 2000);
  lCam.near = clamp(alt * 0.01, 0.5, 30); if (LC.shift > 0.001) lCam.setViewOffset(innerWidth, innerHeight, LC.shift * innerWidth, -LC.shift * 0.5 * innerHeight, innerWidth, innerHeight); else lCam.clearViewOffset(); lCam.updateProjectionMatrix();
  const co = clamp(1 - Math.abs(alt - 3000) / 1600, 0, 1); lClouds.forEach(c => c.material.opacity = co * 0.7);
}
function syncLC() { const t = controls.target, d = lCam.position.clone().sub(t); LC.tx = t.x; LC.ty = t.y; LC.tz = t.z; LC.dist = d.length(); LC.el = Math.asin(clamp(d.y / LC.dist, -1, 1)) / D2R; LC.az = Math.atan2(d.x, d.z) / D2R; }
const toW = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), PLANT_ROT);
function unitBox(id) { const b = new THREE.Box3(); (UNITG[id] || []).forEach(g => b.expandByObject(g)); return b; }
function shotFor(id, o = {}) { const b = unitBox(id), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); const r = Math.max(s.x, s.y * 1.2, s.z) * 0.5;
  return {tx: c.x, ty: Math.min(c.y, s.y * 0.45), tz: c.z, dist: clamp(r * (o.k || 3.0), 48, 300), az: o.az ?? (205 + PLANT_ROT / D2R * 0), el: o.el ?? 24}; }
function shortestAz(from, to) { let d = ((to - from) % 360 + 540) % 360 - 180; return from + d; }
async function flyLocal(sh, d = 2.2) { sh = Object.assign({}, sh); sh.az = shortestAz(LC.az, sh.az); FOCUS_TWEEN = true; await tween(LC, sh, d, ease.io); FOCUS_TWEEN = false; }

// =====================================================================  unit labels, picking and the info panel
const UL = {};
function makeUnitLabels() {
  Object.keys(UNITS).forEach(id => { if (!UNITG[id]) return; const u = UNITS[id], el = document.createElement('div'); el.className = 'lab'; el.style.setProperty('--c', u.col);
    el.innerHTML = `<div class="p"><i></i>${id === 'SC' ? 'SC-1/SC-2' : id === 'HALL' ? 'MPW hall' : id === 'TANKS' ? 'Tank farm' : id === 'FLARE' ? 'Flare' : id === 'CTOWER' ? 'Utilities' : id === 'CONTROL' ? 'Control room' : id === 'ADMIN' ? 'Administration' : id}</div><div class="s"></div>`;
    el.addEventListener('click', e => { e.stopPropagation(); openUnit(id); }); labelsEl.appendChild(el);
    const b = unitBox(id), c = b.getCenter(new THREE.Vector3()); UL[id] = {el, p: new THREE.Vector3(c.x, b.max.y + 2, c.z)}; });
}
let LABELS = true, ACTIVE_LABELS = null;
const LOOPB = [['TC-310', 'E-104', 'R-103 feed temperature · PID (Cohen–Coon)', 'TT'], ['LC-318', 'F-101', 'Flash-drum level · P-only (averaging)', 'LT'], ['PC-319', 'F-101', 'Synthesis-loop pressure · PI on purge', 'PT', 13],
  ['FY/FC-106', 'R-101', 'Steam-to-MPW ratio 1.33 kg/kg · PI', 'FT'], ['PC-301', 'C-101', 'Suction pressure → compressor speed', 'PT'], ['TC-114', 'R-103', 'Reactor temperature → steam-drum pressure', 'TT', 20]];
const LB = [];
function makeLoopBadges() { LOOPB.forEach(([tag, u, d, tt, dy = 0]) => { const el = document.createElement('div'); el.className = 'loopb'; el.innerHTML = `<div class="ring"></div><div class="c">${tt}</div><div class="t"><b>${tag}</b><span>${d}</span></div>`; labelsEl.appendChild(el);
  const b = unitBox(u), c = b.getCenter(new THREE.Vector3()); LB.push({el, p: new THREE.Vector3(c.x, b.max.y * 0.75 + 4 + dy, c.z)}); }); }
let SHOW_LOOPS = false;
const sitePin = document.createElement('div'); sitePin.className = 'pin'; sitePin.innerHTML = '<div class="r"></div><div class="d"></div><div class="n">MPW Gasification Complex<small>Plot 420 m × 300 m · Jubail Industrial City</small></div>'; labelsEl.appendChild(sitePin);
function updateSitePin() { const on = SCENE === 'local' && SLIDES[IDX] && SLIDES[IDX].id === 'arrive' && !BUSY; if (on) { const v = new THREE.Vector3(0, 30, 0).project(lCam); sitePin.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; sitePin.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; } sitePin.classList.toggle('on', on); }
function updateLoopBadges() { const v = new THREE.Vector3(); LB.forEach(o => { let vis = SHOW_LOOPS && SCENE === 'local'; if (vis) { v.copy(o.p).project(lCam); vis = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; o.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; o.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; } o.el.classList.toggle('on', vis); }); }
const MAJOR = ['HALL', 'R-101', 'C-101', 'R-103', 'T-101', 'ME-101', 'TANKS', 'FLARE', 'CONTROL', 'R-102'];
function updateUnitLabels() { const v = new THREE.Vector3(); const show = SCENE === 'local' && LABELS && lCam.position.y < 1500;
  for (const id in UL) { const o = UL[id]; let vis = show && (ACTIVE_LABELS ? ACTIVE_LABELS.includes(id) : (LC.dist < 330 || MAJOR.includes(id))); if (vis) { v.copy(o.p).project(lCam); vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      o.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; o.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; o.el.style.zIndex = Math.round((1 - v.z) * 1e5); }
    o.el.classList.toggle('on', vis); o.el.classList.toggle('sel', id === FOCUS); } }
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let HOVER = null, FOCUS = null, FOCUS_TWEEN = false, PREV_SHOT = null;
const HL = new Map();
function highlight(id, color, on) { (UNITG[id] || []).forEach(g => g.traverse(o => { if (!o.isMesh || !o.material || o.material.isMeshBasicMaterial) return;
  if (on) { if (!HL.has(o)) { HL.set(o, o.material); o.material = o.material.clone(); } o.material.emissive = new THREE.Color(color); o.material.emissiveIntensity = color === 0xff3a1e ? 0.45 : 0.18; HLM.add(o.material); }
  else if (HL.has(o)) { HLM.delete(o.material); o.material.dispose(); o.material = HL.get(o); HL.delete(o); } })); }
const HLM = new Set();
const HI_SET = ['E-101', 'E-102', 'E-103', 'E-104', 'E-105', 'E-106', 'E-107', 'T-101', 'SC'];
canvas.addEventListener('pointermove', e => { if (SCENE !== 'local') return; mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, lCam);
  const hit = ray.intersectObjects(PICK, false)[0]; const id = hit ? hit.object.userData.unit : null;
  if (id !== HOVER) { if (HOVER && HOVER !== FOCUS && !(SLIDE_HI && HI_SET.includes(HOVER))) highlight(HOVER, 0, false); HOVER = id; if (id && id !== FOCUS) highlight(id, 0xff9a3c, true); canvas.style.cursor = id ? 'pointer' : 'default'; }
  const tip = $('tip'); if (id && UNITS[id]) { tip.textContent = UNITS[id].name; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; tip.style.opacity = 1; } else tip.style.opacity = 0; });
let downAt = null; canvas.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
canvas.addEventListener('pointerup', e => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; if (SCENE === 'local' && HOVER && UNITS[HOVER]) openUnit(HOVER); });
const cnt = (el, v) => { const s = String(v), m = s.match(/^[^\d]*([\d,]*\.?\d*)(.*)$/); if (!m || !m[1]) { el.textContent = s; return; } const num = parseFloat(m[1].replace(/,/g, '')), dec = (m[1].split('.')[1] || '').length, pre = s.slice(0, s.indexOf(m[1])), suf = m[2]; const t0 = performance.now();
  const f = t => { const k = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + (num * e).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec}) + suf; if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
async function openUnit(id, fromSlide) {
  const u = UNITS[id]; if (!u) return; if (FOCUS && FOCUS !== id && !(SLIDE_HI && HI_SET.includes(FOCUS))) highlight(FOCUS, 0, false); FOCUS = id; highlight(id, 0xff9a3c, true);
  if (!fromSlide) PREV_SHOT = PREV_SHOT || {...LC};
  const sl = SLIDES[IDX], list = sl.units || null;
  $('pBody').innerHTML = `<div class="sec" style="color:${u.col}">${u.sec}</div><h3>${u.name}</h3><p class="role">${u.role}</p>
   ${list ? `<div class="units">${list.map(k => `<button data-u="${k}" class="${k === id ? 'on' : ''}">${k === 'SC' ? 'SC-1/SC-2' : k === 'HALL' ? 'MPW hall' : k === 'TANKS' ? 'Tank farm' : k}</button>`).join('')}</div>` : ''}
   ${u.kpi ? `<div class="kp">${u.kpi.map(([v, s, l]) => `<div><b data-v="${v}">${v}</b><u></u><span>${l}</span></div>`).join('').replace(/<u><\/u>/g, '')}</div>` : ''}
   <dl>${u.data.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
   <div class="nav"><button id="pBack">${fromSlide ? 'Plant overview' : '← Back'}</button><button id="pNext">Next slide →</button></div>`;
  if (u.kpi) $('pBody').querySelectorAll('.kp b').forEach((b, i) => { const [v, s] = u.kpi[i]; b.innerHTML = ''; const sp = document.createElement('span'); sp.style.cssText = 'display:inline;font:inherit;color:inherit;margin:0'; b.appendChild(sp); cnt(sp, v); if (s) { const un = document.createElement('u'); un.textContent = s; b.appendChild(un); } });
  $('pBody').querySelectorAll('.units button').forEach(b => b.onclick = () => openUnit(b.dataset.u, true));
  $('pBack').onclick = () => closeUnit(); $('pNext').onclick = () => go(IDX + 1);
  $('panel').classList.add('on'); tween(LC, {shift: innerWidth > 900 ? 0.12 : 0}, 1.4);
  if (SCENE === 'local') { const az = {'T-101': 150, 'R-101': 200, 'CY-101': 200, 'C-101': 195, 'ME-101': 220, 'R-103': 215, 'TANKS': 245, 'FLARE': 245, 'HALL': 185, 'ADMIN': 30, 'CONTROL': 30}[id];
    await flyLocal(shotFor(id, {az: (az ?? 210) + PLANT_ROT / D2R, el: id === 'T-101' ? 16 : id === 'R-101' || id === 'CY-101' ? 26 : 24, k: id === 'T-101' ? 2.2 : id === 'R-101' || id === 'CY-101' ? 1.5 : id === 'C-101' ? 1.9 : 3.4}), 2.0); }
}
async function closeUnit() { $('panel').classList.remove('on'); tween(LC, {shift: 0}, 1.4); if (FOCUS && !(SLIDE_HI && HI_SET.includes(FOCUS))) highlight(FOCUS, 0, false); FOCUS = null;
  const sl = SLIDES[IDX]; if (sl && SHOTS[sl.id] && SCENE === 'local') await flyLocal(SHOTS[sl.id](), 2.0); else if (PREV_SHOT) await flyLocal(PREV_SHOT, 2.0); PREV_SHOT = null; }
$('pClose').onclick = () => closeUnit();

// =====================================================================  slides
let SCENE = 'globe', IDX = -1, EXPLORE = false, SLIDE_HI = false, BUSY = false, AUTO = null;
const PLANT_AZ = 205 + PLANT_ROT / D2R;
const SHOTS = {
  arrive: () => ({tx: 500, ty: 0, tz: -420, dist: 2500, az: 318, el: 19}),
  plant: () => ({tx: 10, ty: 0, tz: 10, dist: 470, az: PLANT_AZ, el: 31}),
  heat: () => ({...toWv(P(240, 175)), ty: 0, dist: 300, az: PLANT_AZ + 18, el: 46}),
  control: () => ({...toWv(P(250, 185)), ty: 0, dist: 260, az: PLANT_AZ + 30, el: 40}),
  safety: () => ({...toWv(P(260, 200)), ty: 0, dist: 210, az: PLANT_AZ + 10, el: 52}),
  econ: () => ({tx: 0, ty: 0, tz: 0, dist: 760, az: PLANT_AZ + 70, el: 52}),
  twin: () => ({tx: 0, ty: 0, tz: 0, dist: 560, az: PLANT_AZ - 60, el: 26})
};
function toWv([x, z]) { const v = toW(x, 0, z); return {tx: v.x, tz: v.z}; }
const GLOBE_SHOTS = {intro: {lat: 16, lon: 30, alt: 21000, tilt: 0, head: 0, shift: 0.17}, ksa: {lat: 24.0, lon: 42.8, alt: 3900, tilt: 0, head: 0, shift: 0.14}, east: {lat: 25.4, lon: 48.6, alt: 1250, tilt: 30, head: 8, shift: 0.12},
  jubail: {lat: 26.45, lon: 49.35, alt: 420, tilt: 38, head: 14, shift: 0.1}, end: {lat: 20, lon: 40, alt: 19000, tilt: 0, head: 0, shift: 0.17}};
function renderText(sl) {
  const lt = $('lt'); let h = `<div class="k rv">${sl.kicker || ''}</div><h2 class="rv">${sl.title}</h2>`;
  if (sl.text) h += `<p class="rv">${sl.text}</p>`;
  if (sl.focus) h += `<p class="rv">${UNITS[sl.focus].role}</p>`;
  if (sl.bars) h += `<div class="bars rv">${sl.bars.map(([n, v]) => `<div class="bar"><span>${n}</span><div class="t"><i data-w="${v / 10}"></i></div><b>${v}</b></div>`).join('')}</div><p class="rv" style="font-size:13px;color:var(--mut);margin-top:8px">Weighted score out of 1,000 (Table 9.3)</p>`;
  if (sl.bars2) h += `<div class="rv" style="margin-top:18px;max-width:640px">${sl.bars2.map(([n, a, b, u]) => `<div class="bar2"><span>${n}</span><div class="tt"><i data-w="100"></i><s data-w="${b / a * 100}"></s></div><em>${a.toLocaleString('en-US')} → <b style="color:#fff">${b.toLocaleString('en-US')}</b> ${u}</em></div>`).join('')}<p style="font-size:12.5px;color:var(--mut);margin:4px 0 0"><span style="display:inline-block;width:14px;height:6px;background:rgba(255,255,255,.3);border-radius:2px;margin-right:6px"></span>before <span style="display:inline-block;width:14px;height:6px;background:#ff7a59;border-radius:2px;margin:0 6px 0 14px"></span>after heat integration</p></div>`;
  if (sl.stats) h += `<div class="stats rv">${sl.stats.map(([v, u, l]) => `<div class="stat"><b><span data-c="${v}">${v}</span>${u ? `<u>${u}</u>` : ''}</b><span>${l}</span></div>`).join('')}</div>`;
  if (sl.id === 'econ') h += `<div class="rv card"><svg id="spark" viewBox="0 0 520 124" style="width:min(520px,80vw);display:block"></svg></div>`;
  if (sl.focus) h += `<p class="rv" style="margin-top:16px;font-size:13px;color:var(--mut)">Select a unit on the plant or in the panel →</p>`;
  lt.innerHTML = h; const els = [...lt.querySelectorAll('.rv')]; els.forEach((e, i) => setTimeout(() => e.classList.add('in'), 250 + i * 140));
  setTimeout(() => { lt.querySelectorAll('[data-w]').forEach(i => i.style.width = i.dataset.w + '%'); lt.querySelectorAll('[data-c]').forEach(s => cnt(s, s.dataset.c)); }, 700);
  if (sl.id === 'econ') drawSpark();
}
const CF = [0, -217.45, -454.68, -423.16, -376.59, -323.39, -275.03, -231.07, -191.1, -155.41, -123.2, -93.93, -67.31, -43.12, -21.12, -1.13, 17.05, 33.58, 48.6, 62.26, 74.68, 85.96, 105.04];
function drawSpark() { const s = $('spark'); if (!s) return; const X = i => 30 + i / 22 * 470, Y = v => 24 + (125 - v) / 600 * 80;
  const d = CF.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' ');
  s.innerHTML = `<line x1="30" x2="500" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.35)" stroke-dasharray="4 4"/><path d="${d}" fill="none" stroke="#f0a35e" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset 2.4s ease .6s"/>
   <circle cx="${X(22)}" cy="${Y(105.04)}" r="5" fill="#ffd38a"/><text x="${X(22) - 8}" y="${Y(105.04) - 10}" text-anchor="end" fill="#ffd38a" style="font:600 12px Inter">NPV $105.04 M</text>
   <text x="${X(15.5)}" y="${Y(0) + 18}" fill="#9fb0c2" text-anchor="middle" style="font:500 11px Inter">discounted payback 13.06 y</text><text x="30" y="116" fill="#9fb0c2" style="font:500 11px Inter">Cumulative discounted cash flow, years 0–22 (million US$)</text>`;
  requestAnimationFrame(() => s.querySelector('path').style.strokeDashoffset = 0); }
function setScene(s) { SCENE = s; if (s === 'globe') { controls.enabled = false; } else if (EXPLORE) controls.enabled = true; }
async function flash(mid) { const f = $('flash'); f.style.opacity = 1; await wait(0.9); mid(); await wait(0.25); f.style.opacity = 0; }
function setFX(sl) {
  SLIDE_HI = sl.id === 'heat'; HI_SET.forEach(id => highlight(id, 0xff3a1e, SLIDE_HI));
  if (FX.flow) FX.flow.forEach(t => tween(t.material, {opacity: ['heat', 'synth', 'shift', 'gasify', 'membrane', 'compress', 'distil', 'feed'].includes(sl.id) ? 0.85 : 0}, 1));
  if (FX.fei) { tween(FX.fei[0].material, {opacity: sl.id === 'safety' ? 0.95 : 0}, 1); tween(FX.fei[1].material, {opacity: sl.id === 'safety' ? 0.22 : 0}, 1); }
  SHOW_LOOPS = sl.id === 'control';
  ACTIVE_LABELS = sl.units || (sl.id === 'control' ? [] : ['econ', 'twin', 'arrive'].includes(sl.id) ? [] : sl.id === 'safety' ? ['R-103', 'FLARE', 'CONTROL', 'ADMIN'] : sl.id === 'heat' ? ['E-101', 'E-102', 'E-103', 'E-104', 'E-105', 'E-106', 'E-107', 'T-101'] : null);
  $('qr').classList.toggle('on', sl.id === 'twin');
}
async function go(i) {
  if (i < 0 || i >= SLIDES.length || BUSY) return; const prev = SLIDES[IDX], sl = SLIDES[i]; BUSY = true; IDX = i;
  $('panel').classList.remove('on'); tween(LC, {shift: 0}, 1.2); if (FOCUS) { if (!(SLIDE_HI && HI_SET.includes(FOCUS))) highlight(FOCUS, 0, false); FOCUS = null; } PREV_SHOT = null;
  $$('#dots button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); }); $('num').textContent = (i + 1) + ' / ' + SLIDES.length;
  $$('#chaps button').forEach(b => b.classList.toggle('on', +b.dataset.i === CHAPI(i)));
  $('lt').querySelectorAll('.rv').forEach(e => e.classList.remove('in'));
  const wantGlobe = !!GLOBE_SHOTS[sl.id];
  setTimeout(() => renderText(sl), 380);
  if (wantGlobe) {
    if (SCENE !== 'globe') { await flash(() => { setScene('globe'); Object.assign(GC, {lat: 26.9, lon: 49.56, alt: 60, tilt: 35, head: 12}); }); }
    earthU.uKSA.value = earthU.uKSA.value; tween(earthU.uKSA, {value: ['ksa', 'east', 'jubail'].includes(sl.id) ? 1 : 0}, 1.6); tween(earthU.uEast, {value: sl.id === 'east' ? 1 : sl.id === 'jubail' ? 0.35 : 0}, 1.6); tween(cloudU.uClr, {value: ['intro', 'end'].includes(sl.id) ? 0.35 : 1}, 2.4);
    showGeo({intro: [], ksa: ['ksa', 'gulf', 'red', 'riyadh', 'yanbu', 'jubail'], east: ['east', 'gulf', 'jubail', 'dammam'], jubail: ['jsite', 'gulf', 'dammam'], end: ['jubail']}[sl.id]);
    const d = sl.id === 'intro' ? (prev ? 3.2 : 0.01) : sl.id === 'end' ? 4.5 : sl.id === 'jubail' ? 3.6 : 3.4;
    tween(SUNP, {lon: sl.id === 'end' ? -52 : 8}, sl.id === 'end' ? 6 : 2.5, ease.sine);
    await tween(GC, GLOBE_SHOTS[sl.id], d, ease.io);
  } else {
    showGeo([]);
    if (SCENE !== 'local') {
      if (prev && prev.id === 'jubail') await tween(GC, {lat: 26.98, lon: 49.56, alt: 18, tilt: 30}, 1.4, ease.io);
      await flash(() => { setScene('local'); Object.assign(LC, {tx: 0, ty: 0, tz: 0, dist: 7800, az: PLANT_AZ - 40, el: 82}); });
    }
    setFX(sl);
    if (sl.focus) { const z = sl.focus; await Promise.all([flyLocal(shotFor(z, {az: ({HALL: 185, 'R-101': 200, 'R-102': 215, 'ME-101': 225, 'C-101': 195, 'R-103': 215, 'T-101': 150}[z]) + PLANT_ROT / D2R, el: z === 'T-101' ? 16 : 26, k: z === 'T-101' ? 2.2 : z === 'R-101' ? 1.5 : z === 'C-101' ? 1.9 : z === 'HALL' ? 1.6 : 3.4}), 2.8), wait(0.4).then(() => openUnit(z, true))]); }
    else await flyLocal(SHOTS[sl.id](), sl.id === 'arrive' ? 5.5 : 3.0);
  }
  if (!GLOBE_SHOTS[sl.id]) setFX(sl); else { ACTIVE_LABELS = null; SHOW_LOOPS = false; $('qr').classList.remove('on'); }
  BUSY = false;
}
const $$ = s => [...document.querySelectorAll(s)];
const CHAPS = [['Problem', 0], ['Saudi Arabia', 1], ['Jubail', 3], ['The plant', 5], ['Process', 6], ['Heat integration', 13], ['Control & safety', 14], ['Economics', 16], ['Digital twin', 17], ['End', 18]];
const CHAPI = i => CHAPS.reduce((a, c, k) => i >= c[1] ? k : a, 0);
function buildNav() { $('dots').innerHTML = SLIDES.map((s, i) => `<button data-t="${s.chap}" data-i="${i}"></button>`).join(''); $$('#dots button').forEach(b => b.onclick = () => go(+b.dataset.i));
  $('chaps').innerHTML = CHAPS.map(([n, i], k) => `<button data-i="${k}">${n}</button>`).join(''); $$('#chaps button').forEach(b => b.onclick = () => go(CHAPS[+b.dataset.i][1]));
  $('next').onclick = () => go(IDX + 1); $('prev').onclick = () => go(IDX - 1);
  addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'PageDown') go(IDX + 1); else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(IDX - 1); else if (e.key === 'Escape') closeUnit();
    else if (e.key.toLowerCase() === 'f') toggleFull(); else if (e.key.toLowerCase() === 'e') toggleExplore(); else if (e.key.toLowerCase() === 'l') toggleLabels(); else if (e.key === ' ') { e.preventDefault(); toggleAuto(); } });
  $('bFull').onclick = toggleFull; $('bExplore').onclick = toggleExplore; $('bLabels').onclick = toggleLabels; $('bAuto').onclick = toggleAuto; }
function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
function toggleExplore() { EXPLORE = !EXPLORE; $('bExplore').classList.toggle('on', EXPLORE); if (EXPLORE && SCENE !== 'local') go(5); controls.enabled = EXPLORE && SCENE === 'local'; }
function toggleLabels() { LABELS = !LABELS; $('bLabels').classList.toggle('on', LABELS); }
function toggleAuto() { if (AUTO) { clearInterval(AUTO); AUTO = null; } else { AUTO = setInterval(() => { if (!BUSY && !FOCUS_TWEEN) { if (IDX < SLIDES.length - 1) go(IDX + 1); else toggleAuto(); } }, 9000); } $('bAuto').classList.toggle('on', !!AUTO); }
controls.addEventListener('start', () => { if (!EXPLORE && SCENE === 'local') { EXPLORE = true; $('bExplore').classList.add('on'); } });
// allow dragging the view at any time in the plant without entering explore mode explicitly
canvas.addEventListener('pointerdown', () => { if (SCENE === 'local' && !EXPLORE && !BUSY) { controls.enabled = true; } });

// =====================================================================  main loop
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); for (const c of [gCam, lCam]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); } });
let T = 0;
function frame_() {
  const dt = Math.min(clock.getDelta(), 0.05); T += dt; stepTweens(dt);
  earthU.uTime.value = T; cloudU.uT.value = T;
  if (SCENE === 'globe') { if (IDX === 0 && !BUSY) GC.lon += dt * 0.6; SUN.copy(llVec(SUNP.lat, SUNP.lon)).normalize(); sunSprite.position.copy(SUN).multiplyScalar(120); applyGlobeCam(); renderer.render(gScene, gCam); }
  else { if (controls.enabled && !FOCUS_TWEEN && !BUSY) { controls.update(); syncLC(); EXPLORE = true; } applyLocalCam(); waterN.offset.x = T * 0.004; waterN.offset.y = T * 0.0025; ANIM.forEach(f => f(T, dt));
    if (FX.flow) FX.flow.forEach((t, i) => t.material.map.offset.y = -T * (0.6 + i * 0.1)); if (FX.fei) FX.fei[0].scale.setScalar(1 + 0.02 * Math.sin(T * 3));
    renderer.render(lScene, lCam); }
  updateGeo(); updateUnitLabels(); updateLoopBadges(); updateSitePin(); requestAnimationFrame(frame_);
}
// =====================================================================  start
manager.onLoad = () => { $('lst').textContent = 'Ready'; $('start').classList.add('on'); };
let started = false;
async function start() { if (started) return; started = true; $('loader').classList.add('off'); await wait(0.6); go(0); }
$('start').onclick = start;
(async function init() {
  buildNav();
  await new Promise(r => { if (maskImg.complete && maskImg.naturalWidth) r(); else maskImg.onload = r; }); setupMask();
  $('lst').textContent = 'Building Jubail Industrial City…'; await wait(0.05); buildPlant(); consolidate(plant); console.log('plant meshes', plant.children.length); buildCity(); buildClouds(); makeUnitLabels(); makeLoopBadges();
  applyGlobeCam(); frame_();
  if (loaded >= total) manager.onLoad();
  if (new URLSearchParams(location.search).has('s')) { const s = +new URLSearchParams(location.search).get('s'); started = true; $('loader').classList.add('off'); go(s); }
})();
window.__r = renderer; window.__ls = lScene; window.__lc = lCam; window.__go = go; window.__openUnit = openUnit; window.__state = () => ({IDX, SCENE, LC: {...LC}, GC: {...GC}});
