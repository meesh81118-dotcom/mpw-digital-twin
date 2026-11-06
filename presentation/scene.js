// Local scene: sky, light, environment, ground and the plant (plant frame = scene frame rotated to the real plot).
import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {makeTextures, makeMaterials, D2R} from './kit.js';
import {buildPlant} from './plant.js';

export const PLOT = {lat: 27.0130, lon: 49.5542, rot: 40 * D2R};   // vacant plot in Jubail Industrial City, grid bearing 50° / 140°

export function makeLocalScene(renderer, q = {}) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 120000);
  // golden-hour sun from the south-west of the plant frame (light from the left of the hero view, long shadows)
  const sunLocal = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();
  const sunDir = sunLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), PLOT.rot);
  const sky = new Sky(); sky.scale.setScalar(450000); const su = sky.material.uniforms;
  su.turbidity.value = 6.5; su.rayleigh.value = 1.25; su.mieCoefficient.value = 0.0048; su.mieDirectionalG.value = 0.86; su.sunPosition.value.copy(sunDir);
  // the sky shader is evaluated once into a cube map; every frame then only samples a texture
  const skyScene = new THREE.Scene(); skyScene.add(sky); const cubeRT = new THREE.WebGLCubeRenderTarget(q.sky || 512, {type: THREE.HalfFloatType}); const cc = new THREE.CubeCamera(1, 1e6, cubeRT); cc.update(renderer, skyScene);
  const under = new THREE.Scene(); under.background = cubeRT.texture;    // drawn first: sky and satellite ground, then the depth is cleared
  // environment from the same sky + warm ground bounce
  const pm = new THREE.PMREMGenerator(renderer); const es = new THREE.Scene(); const sk2 = new Sky(); sk2.scale.setScalar(1000); Object.keys(su).forEach(k => { if (sk2.material.uniforms[k]) sk2.material.uniforms[k].value = su[k].value; }); es.add(sk2);
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshBasicMaterial({color: 0x9c8466})); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -6; es.add(gnd);
  const env = pm.fromScene(es, 0.02).texture; scene.environment = env; scene.environmentIntensity = 0.62;
  scene.fog = new THREE.FogExp2(0xcdbfa6, 0.00009); under.fog = scene.fog;
  const sun = new THREE.DirectionalLight(0xffdcb4, 2.9); sun.castShadow = true; const SM = q.shadow || 2048;
  sun.shadow.mapSize.set(SM, SM); Object.assign(sun.shadow.camera, {left: -250, right: 250, top: 250, bottom: -250, near: 50, far: 1600}); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.45;
  sun.position.copy(sunDir).multiplyScalar(800); scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xd6e4ff, 0xa88a66, 0.22));
  const T = makeTextures(renderer.capabilities.getMaxAnisotropy());
  const M = makeMaterials(T);
  M.blob = new THREE.MeshBasicMaterial({map: T.blob, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2});
  M.blobSq = new THREE.MeshBasicMaterial({map: T.blobSq, transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2});
  const t0 = performance.now(); const P = buildPlant(M, T); const plantMs = performance.now() - t0;
  const plant = P.root; plant.rotation.y = PLOT.rot; scene.add(plant); plant.updateMatrixWorld(true);
  // static shadows: rendered once (and again only when asked)
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  return {scene, under, cam, sun, sunDir, sky, M, T, P, plant, plantMs};
}
