import * as THREE from 'three';
import { HOUSE, LIGHTS } from '../config/layout.js';
import { M, G } from '../builders/materials.js';

/**
 * Iluminación natural (sol, cielo, entorno) y artificial (luminarias interiores).
 * El paso día ↔ noche se interpola suavemente con un parámetro t ∈ [0,1].
 */
const C = (h) => new THREE.Color(h);
const DAY = {
  skyTop: C(0x6fa8dc), skyHorizon: C(0xe8eef2), sun: C(0xfff0d8), sunI: 3.0,
  hemiI: 0.9, env: 0.55, exposure: 1.0, fog: C(0xdfe7ec),
};
const NIGHT = {
  skyTop: C(0x050a18), skyHorizon: C(0x1b2742), sun: C(0x8ea6ff), sunI: 0.35,
  hemiI: 0.06, env: 0.05, exposure: 1.15, fog: C(0x121a2c),
};

export function createLighting(scene, { shadowSize = 2048 } = {}) {
  const center = new THREE.Vector3(HOUSE.width / 2, 0, HOUSE.depth / 2);

  // Cúpula de cielo con degradado
  const skyUniforms = { top: { value: DAY.skyTop.clone() }, horizon: { value: DAY.skyHorizon.clone() } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vP;
        void main(){ float h = clamp(vP.y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h,0.7)), 1.0);
        #include <colorspace_fragment>
        }`,
    })
  );
  sky.position.copy(center);
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(DAY.fog.clone(), 45, 115);

  const hemi = new THREE.HemisphereLight(0xe3efff, 0x8d7b62, DAY.hemiI);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.position.copy(center).add(new THREE.Vector3(-11, 16, 13));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const s = 13;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  // Luminarias interiores (sin sombras para rendimiento)
  const points = [];
  const warm = new THREE.Color(0xffc98a);
  for (const L of LIGHTS) {
    const y = L.pendant ? 1.45 : L.exterior ? 2.4 : HOUSE.wallHeight - 0.25;
    const p = new THREE.PointLight(warm, 0, 9, 1.6);
    p.position.set(L.pos[0], y, L.pos[1]);
    p.userData.power = L.power;
    scene.add(p);
    points.push(p);
    if (L.pendant) {
      const cord = new THREE.Mesh(G.cylLow, M.black);
      cord.scale.set(0.01, HOUSE.wallHeight - 1.62, 0.01);
      cord.position.set(L.pos[0], (HOUSE.wallHeight + 1.62) / 2, L.pos[1]);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 24, 1, true), M.lampShade);
      shade.position.set(L.pos[0], 1.62, L.pos[1]);
      const bulb = new THREE.Mesh(G.sphere, M.bulb);
      bulb.scale.setScalar(0.08);
      bulb.position.set(L.pos[0], 1.52, L.pos[1]);
      scene.add(cord, shade, bulb);
    }
    if (L.exterior) {
      const lamp = new THREE.Mesh(G.box, M.bulb);
      lamp.scale.set(0.14, 0.22, 0.08);
      lamp.position.set(L.pos[0], 2.2, HOUSE.depth + 0.14);
      scene.add(lamp);
    }
  }
  // Aplique exterior junto a la puerta principal
  const porch = new THREE.PointLight(warm, 0, 7, 1.6);
  porch.position.set(HOUSE.width + 0.4, 2.3, 4.0);
  porch.userData.power = 0.7;
  scene.add(porch);
  points.push(porch);
  const sconce = new THREE.Mesh(G.box, M.bulb);
  sconce.scale.set(0.08, 0.22, 0.14);
  sconce.position.set(HOUSE.width + 0.14, 2.2, 4.0);
  scene.add(sconce);

  let t = 0; // 0 = día, 1 = noche
  let target = 0;

  function applyT(renderer) {
    const k = t * t * (3 - 2 * t);
    skyUniforms.top.value.copy(DAY.skyTop).lerp(NIGHT.skyTop, k);
    skyUniforms.horizon.value.copy(DAY.skyHorizon).lerp(NIGHT.skyHorizon, k);
    scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, k);
    sun.color.copy(DAY.sun).lerp(NIGHT.sun, k);
    sun.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, k);
    hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, k);
    scene.environmentIntensity = THREE.MathUtils.lerp(DAY.env, NIGHT.env, k);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, k);
    const lk = THREE.MathUtils.clamp((k - 0.25) / 0.75, 0, 1);
    for (const p of points) p.intensity = lk * 7 * p.userData.power;
    M.bulb.emissiveIntensity = lk * 3;
    M.lampShade.emissiveIntensity = lk * 1.2;
    M.screen.emissive.setRGB(0.05 * lk, 0.08 * lk, 0.12 * lk);
  }

  return {
    sun,
    isNight: () => target === 1,
    setNight(night) {
      target = night ? 1 : 0;
    },
    /** Devuelve true si cambió (para actualizar sombras) */
    update(dt, renderer, force = false) {
      if (t === target && !force) return false;
      const step = dt / 1.6;
      t = target > t ? Math.min(target, t + step) : Math.max(target, t - step);
      applyT(renderer);
      return true;
    },
  };
}
