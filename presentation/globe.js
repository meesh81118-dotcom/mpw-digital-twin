// The Earth: day/night shader with a regional satellite patch, KSA / Eastern Province highlight, clouds, atmosphere, stars.
import * as THREE from 'three';
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function llVec(lat, lon, r = 1) { const p = (lon + 180) * D2R, la = lat * D2R; return new THREE.Vector3(-Math.cos(p) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(p) * Math.cos(la) * r); }

export function makeGlobe(renderer, tl, site, labelsEl) {
  const tex = (u, srgb = true) => { const t = tl.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.0001, 300);
  const SUNP = {lat: 8, lon: 8}, SUN = llVec(8, 8).normalize();
  const RB = [45.5, 53.5, 22.5, 30.5], KB = [34.0, 56.5, 15.5, 33.0];
  const U = {tDay: {value: tex('assets/earth_day.jpg')}, tNight: {value: tex('assets/earth_night.jpg')}, tWater: {value: tex('assets/earth_water.jpg', false)}, tRegion: {value: tex('assets/region.jpg')}, tMask: {value: tex('assets/ksa_mask.png', false)},
    tJB: {value: null}, uJB: {value: new THREE.Vector4(0, 0, 0, 0)}, uJBon: {value: 0}, uSun: {value: SUN}, uRB: {value: new THREE.Vector4(...RB)}, uKB: {value: new THREE.Vector4(...KB)}, uKSA: {value: 0}, uEast: {value: 0}, uTime: {value: 0}};
  const mat = new THREE.ShaderMaterial({uniforms: U,
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec2 vUv; void main(){vUv=uv; vN=normalize(position); vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform sampler2D tDay,tNight,tWater,tRegion,tMask,tJB; uniform vec3 uSun; uniform vec4 uRB,uKB,uJB; uniform float uKSA,uEast,uTime,uJBon; varying vec3 vN; varying vec3 vP; varying vec2 vUv;
    void main(){ vec3 n=normalize(vN); float la=degrees(asin(clamp(n.y,-1.,1.))); float lo=degrees(atan(n.z,-n.x))-180.; lo = lo < -180. ? lo + 360. : lo;
      vec3 day=texture2D(tDay,vUv).rgb;
      vec2 ru=vec2((lo-uRB.x)/(uRB.y-uRB.x),(la-uRB.z)/(uRB.w-uRB.z));
      if(ru.x>0.&&ru.x<1.&&ru.y>0.&&ru.y<1.){ float e=smoothstep(0.,.06,min(min(ru.x,1.-ru.x),min(ru.y,1.-ru.y))); day=mix(day,texture2D(tRegion,ru).rgb,e); }
      if(uJBon>0.){ float yN = log(tan(0.785398+radians(uJB.w)*.5)), yS = log(tan(0.785398+radians(uJB.z)*.5)), y = log(tan(0.785398+radians(la)*.5));
        vec2 ju=vec2((lo-uJB.x)/(uJB.y-uJB.x),(y-yS)/(yN-yS)); if(ju.x>0.&&ju.x<1.&&ju.y>0.&&ju.y<1.){ float e=smoothstep(0.,.08,min(min(ju.x,1.-ju.x),min(ju.y,1.-ju.y))); day=mix(day,texture2D(tJB,ju).rgb*0.93,e*uJBon); } }
      vec3 V=normalize(cameraPosition-vP); float d=dot(n,uSun);
      vec3 col=day*(0.035+1.2*clamp(d,0.,1.));
      float wm=texture2D(tWater,vUv).r; vec3 R=reflect(-uSun,n); col+=vec3(1.,.93,.8)*wm*pow(max(dot(R,V),0.),55.)*1.1*step(0.,d);
      vec3 nl=texture2D(tNight,vUv).rgb; col+=nl*nl*vec3(1.,.78,.5)*2.4*(1.-smoothstep(-.28,.04,d));
      vec2 ku=vec2((lo-uKB.x)/(uKB.y-uKB.x),(la-uKB.z)/(uKB.w-uKB.z));
      if(ku.x>0.&&ku.x<1.&&ku.y>0.&&ku.y<1.){ vec4 m=texture2D(tMask,ku); float pulse=.75+.25*sin(uTime*2.2);
        col=mix(col,col*vec3(1.08,1.,.9)+vec3(.05,.03,0.),m.r*uKSA); col+=vec3(1.,.66,.3)*m.b*uKSA*1.6*pulse;
        col=mix(col,col+vec3(.22,.12,.02),m.g*uEast); col+=vec3(1.,.82,.45)*m.a*uEast*2.*pulse; }
      float fr=pow(1.-max(dot(n,V),0.),3.); col+=vec3(.3,.55,1.)*fr*.55*smoothstep(-.2,.4,d);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 320, 160), mat));
  const CU = {tC: {value: tex('assets/earth_clouds.jpg', false)}, uSun: {value: SUN}, uOp: {value: 0.9}, uT: {value: 0}, uSite: {value: llVec(site.lat, site.lon)}, uClr: {value: 0}};
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.007, 192, 96), new THREE.ShaderMaterial({uniforms: CU, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vN; varying vec2 vUv; void main(){vUv=uv; vN=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tC; uniform vec3 uSun,uSite; uniform float uOp,uT,uClr; varying vec3 vN; varying vec2 vUv;
    void main(){ float c=texture2D(tC,vUv+vec2(uT*.0015,0.)).r; float d=dot(normalize(vN),uSun); float l=clamp(d*1.1+.06,0.,1.);
      float clr=1.-uClr*(1.-smoothstep(.94,.995,dot(normalize(vN),uSite)));
      gl_FragColor=vec4(vec3(1.)*l,smoothstep(.08,.85,c)*uOp*clr*(.25+.75*smoothstep(-.2,.15,d)));
      #include <colorspace_fragment>
    }`})));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 48), new THREE.ShaderMaterial({side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: {uSun: {value: SUN}},
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normalMatrix*normal); vW=normalize((modelMatrix*vec4(position,1.)).xyz); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ float i=pow(clamp(.72+dot(vN,vec3(0.,0.,1.)),0.,1.),5.); float s=smoothstep(-.35,.5,dot(vW,uSun));
      gl_FragColor=vec4(vec3(.32,.58,1.)*i*1.6*s+vec3(1.,.55,.3)*i*.25*(1.-s)*s*4.,i*s);}`})));
  { const n = 7000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(150); pos.set([v.x, v.y, v.z], i * 3); const t = Math.random(), b = .45 + Math.pow(Math.random(), 3) * .9; col.set([b * (0.85 + t * .2), b * (0.88 + t * .1), b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .95, depthWrite: false}))); }
  const glow = document.createElement('canvas'); glow.width = glow.height = 128; { const g = glow.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,244,220,1)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(glow), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true})); sun.scale.setScalar(16); scene.add(sun);
  // camera: target lat/lon, altitude (km), tilt from the vertical, heading of the view (deg from north), horizontal shift of the frame
  const GC = {lat: 16, lon: 30, alt: 21000, tilt: 0, head: 0, shift: 0.17};
  const tmp = new THREE.Vector3();
  function apply() { const T = llVec(GC.lat, GC.lon), up = T.clone().normalize(), east = new THREE.Vector3(0, 1, 0).cross(up).normalize(), north = up.clone().cross(east).normalize();
    const h = GC.head * D2R, fwd = north.clone().multiplyScalar(Math.cos(h)).add(east.clone().multiplyScalar(Math.sin(h))), dist = GC.alt / 6371, t = GC.tilt * D2R;
    cam.position.copy(T).addScaledVector(up, Math.cos(t) * dist).addScaledVector(fwd, -Math.sin(t) * dist); cam.up.copy(t < 0.05 ? fwd : up); cam.lookAt(T);
    cam.near = Math.max(dist * 0.02, 0.00002); cam.far = 300; cam.aspect = innerWidth / innerHeight;
    if (GC.shift > 0.001) cam.setViewOffset(innerWidth, innerHeight, -GC.shift * innerWidth, 0, innerWidth, innerHeight); else cam.clearViewOffset(); cam.updateProjectionMatrix();
    CU.uOp.value = clamp((GC.alt - 80) / 600, 0, 1) * 0.9; }
  // geographic labels
  const GEO = [], geo = (lat, lon, html, cls) => { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; labelsEl.appendChild(el); const o = {el, p: llVec(lat, lon, 1.002), show: false, on: false}; GEO.push(o); return o; };
  const pin = (n, s, ring) => `${ring ? '<div class="r"></div>' : ''}<div class="d"></div><div class="n">${n}${s ? `<small>${s}</small>` : ''}</div>`;
  const G = {ksa: geo(22.2, 45.0, 'Kingdom of Saudi Arabia', 'geo big'), gulf: geo(27.9, 50.9, 'Arabian Gulf', 'geo sea'), red: geo(20.6, 38.6, 'Red Sea', 'geo sea'), east: geo(23.6, 49.6, 'Eastern Province', 'geo'),
    riyadh: geo(24.63, 46.72, pin('Riyadh', 'Second Industrial City · 725'), 'pin'), yanbu: geo(24.09, 38.06, pin('Yanbu', 'Industrial City · 735'), 'pin'),
    jubail: geo(27.00, 49.62, pin('Jubail', 'Industrial City · 860', true), 'pin'), dammam: geo(26.43, 50.10, pin('Dammam', ''), 'pin sm'),
    site: geo(site.lat, site.lon, pin('MPW Gasification Complex', '27.013° N · 49.554° E', true), 'pin')};
  function showGeo(keys) { GEO.forEach(o => o.show = false); keys.forEach(k => G[k] && (G[k].show = true)); }
  function updateLabels(active) { const v = tmp; GEO.forEach(o => { let vis = active && o.show; if (vis) { const n = o.p.clone().normalize(); vis = n.dot(cam.position.clone().sub(o.p).normalize()) > 0.05; }
      if (vis) { v.copy(o.p).project(cam); vis = v.z < 1; if (vis) o.el.style.transform = `translate3d(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px,${((1 - v.y) / 2 * innerHeight).toFixed(1)}px,0)`; }
      if (vis !== o.on) { o.on = vis; o.el.classList.toggle('on', vis); } }); }
  function tick(t) { U.uTime.value = t; CU.uT.value = t; SUN.copy(llVec(SUNP.lat, SUNP.lon)).normalize(); sun.position.copy(SUN).multiplyScalar(120); apply(); }
  function setPatch(texture, b) { U.tJB.value = texture; U.uJB.value.set(b.w, b.e, b.s, b.n); U.uJBon.value = 1; }
  return {scene, cam, GC, U, CU, SUNP, apply, tick, showGeo, updateLabels, setPatch};
}
