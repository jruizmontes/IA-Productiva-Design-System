import * as THREE from 'three';
import { HOUSE, ROOMS, LIGHTS } from '../config/layout.js';
import { M, G, floorMaterial, seeded } from './materials.js';

/** Plano horizontal con UV en metros (la textura se repite cada `tile` m) */
function floorPlane(mat, x0, z0, x1, z1, y, tile = 2) {
  const w = x1 - x0;
  const d = z1 - z0;
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}

function box(parent, mat, [w, h, d], [x, y, z], cast = true) {
  const m = new THREE.Mesh(G.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Suelo de la vivienda, terraza, jardín, caminos, pérgola y vegetación */
export function buildSite() {
  const g = new THREE.Group();
  g.name = 'parcela';
  const { width: W, depth: D } = HOUSE;

  // Césped
  const grassGeo = new THREE.CircleGeometry(70, 48);
  const uv = grassGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 35, uv.getY(i) * 35);
  const grass = new THREE.Mesh(grassGeo, M.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(W / 2, -0.16, D / 2);
  grass.receiveShadow = true;
  g.add(grass);

  // Zócalo / cimentación
  box(g, M.concrete, [W + 0.3, 0.16, D + 0.3], [W / 2, -0.16, D / 2]);

  // Suelos de cada estancia
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.bounds;
    if (r.exterior) continue;
    g.add(floorPlane(floorMaterial(r.floor), x0, z0, x1, z1, 0.002, r.floor === 'tile' ? 1.2 : 2.2));
  }

  // Terraza de madera
  const terr = ROOMS.find((r) => r.id === 'terraza');
  if (terr) {
    const [x0, z0, x1, z1] = terr.bounds;
    box(g, M.concrete, [x1 - x0 + 0.2, 0.12, z1 - z0 + 0.15], [(x0 + x1) / 2, -0.16, (z0 + z1) / 2]);
    g.add(floorPlane(M.deck, x0 - 0.1, z0, x1 + 0.1, z1 + 0.05, -0.035, 2));
    box(g, M.concrete, [2.2, 0.06, 0.4], [2.6, -0.16, z1 + 0.25]); // peldaño
  }

  // Escalón de la puerta principal y camino de losas
  box(g, M.concrete, [0.9, 0.12, 1.6], [W + 0.55, -0.15, 4.9]);
  for (let x = W + 1.35; x < W + 9; x += 0.75) {
    const m = box(g, M.paving, [0.6, 0.05, 0.9], [x, -0.16, 4.9 + Math.sin(x * 1.7) * 0.06], false);
    m.rotation.y = Math.sin(x) * 0.05;
  }

  // Vegetación
  const rnd = seeded(21);
  const trees = [
    [-5, 2], [-6.5, 9], [-3.5, 15.5], [3, -5.5], [9, -6], [17.5, -3], [19, 11], [15, 15.5], [7.5, 16.5], [-8, -4], [22, 4],
  ];
  for (const [x, z] of trees) addTree(g, x, z, 0.8 + rnd() * 0.6, rnd);
  // Setos y arbustos junto a fachada
  for (let x = 0.4; x < W; x += 0.9) {
    if (x > 6.3 && x < 13) addShrub(g, x + 0.2, D + 0.55, 0.45 + rnd() * 0.15);
  }
  for (let z = 0.4; z < D - 0.2; z += 0.9) addShrub(g, -0.6, z, 0.4 + rnd() * 0.2);
  for (let x = 0.5; x < W; x += 1.1) addShrub(g, x, -0.6, 0.38 + rnd() * 0.18);
  for (const z of [1, 2, 3, 6.8, 7.9, 9]) addShrub(g, W + 0.6, z, 0.42 + rnd() * 0.15);
  // flores
  const flowerMats = [0xe8c547, 0xd9707a, 0xf3f0e8, 0xb37fd0].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
  );
  for (let i = 0; i < 40; i++) {
    const x = W + 1.2 + rnd() * 3;
    const z = 6.2 + rnd() * 3.5;
    const f = new THREE.Mesh(G.sphereLow, flowerMats[i % 4]);
    f.scale.setScalar(0.12 + rnd() * 0.08);
    f.position.set(x, -0.08, z);
    f.castShadow = true;
    g.add(f);
  }

  // Valla perimetral baja
  const fx0 = -10, fx1 = 24, fz0 = -9, fz1 = 20;
  const fence = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    for (const y of [0.25, 0.55, 0.85]) {
      const m = box(g, M.woodMid, [len, 0.12, 0.04], [(ax + bx) / 2, y - 0.16, (az + bz) / 2]);
      m.rotation.y = -ang;
    }
    const n = Math.floor(len / 2.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      box(g, M.woodDark, [0.09, 1.05, 0.09], [ax + (bx - ax) * t, -0.16, az + (bz - az) * t]);
    }
  };
  fence(fx0, fz0, fx1, fz0);
  fence(fx0, fz1, fx1, fz1);
  fence(fx0, fz0, fx0, fz1);
  fence(fx1, fz0, fx1, 3.9);
  fence(fx1, 5.9, fx1, fz1);

  return g;
}

function addTree(g, x, z, s, rnd) {
  const trunk = new THREE.Mesh(G.cylLow, M.trunk);
  trunk.scale.set(0.25 * s, 2.4 * s, 0.25 * s);
  trunk.position.set(x, -0.16 + 1.2 * s, z);
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(G.sphereLow, i % 2 ? M.leaf : M.leafDark);
    const r = 1.1 * s + rnd() * 0.5 * s;
    f.scale.set(r * 1.6, r * 1.4, r * 1.6);
    f.position.set(x + (rnd() - 0.5) * 1.4 * s, (2.6 + rnd() * 1.4) * s, z + (rnd() - 0.5) * 1.4 * s);
    f.castShadow = true;
    f.receiveShadow = true;
    g.add(f);
  }
}

function addShrub(g, x, z, s) {
  const f = new THREE.Mesh(G.sphereLow, M.leafDark);
  f.scale.set(s * 1.8, s * 1.4, s * 1.8);
  f.position.set(x, -0.16 + s * 0.55, z);
  f.castShadow = true;
  f.receiveShadow = true;
  g.add(f);
}

/** Cubierta plana con alero y techo interior + luminarias de techo */
export function buildRoof() {
  const g = new THREE.Group();
  g.name = 'techo';
  const { width: W, depth: D, wallHeight: H } = HOUSE;
  const o = 0.35;
  const slab = new THREE.Mesh(G.box, [M.roof, M.roof, M.roof, M.ceiling, M.roof, M.roof]);
  slab.scale.set(W + 2 * o, 0.25, D + 2 * o);
  slab.position.set(W / 2, H + 0.125, D / 2);
  slab.castShadow = true;
  slab.receiveShadow = true;
  g.add(slab);
  // peto perimetral
  const t = 0.12;
  const ph = 0.25;
  const y = H + 0.25;
  box(g, M.wallAccent, [W + 2 * o, ph, t], [W / 2, y, -o + t / 2]);
  box(g, M.wallAccent, [W + 2 * o, ph, t], [W / 2, y, D + o - t / 2]);
  box(g, M.wallAccent, [t, ph, D + 2 * o], [-o + t / 2, y, D / 2]);
  box(g, M.wallAccent, [t, ph, D + 2 * o], [W + o - t / 2, y, D / 2]);
  // lucernario sobre el pasillo
  box(g, M.frame, [1.4, 0.12, 0.9], [9.8, y, 4.9]);

  // Pérgola de la terraza (se oculta junto con el techo)
  const terr = ROOMS.find((r) => r.id === 'terraza');
  if (terr) {
    const [x0, z0, x1, z1] = terr.bounds;
    const py = 2.55;
    for (const px of [x0 + 0.05, x1 - 0.05]) box(g, M.greyDark, [0.1, py, 0.1], [px, -0.04, z1 - 0.05]);
    box(g, M.greyDark, [x1 - x0 + 0.1, 0.16, 0.12], [(x0 + x1) / 2, py - 0.1, z1 - 0.05]);
    for (let x = x0 + 0.1; x <= x1 - 0.05; x += 0.45) box(g, M.woodMid, [0.06, 0.14, z1 - z0 + 0.1], [x, py, (z0 + z1) / 2]);
  }

  // Luminarias de techo (discos) — las colgantes se crean en lighting.js
  for (const L of LIGHTS) {
    if (L.pendant || L.exterior) continue;
    const disc = new THREE.Mesh(G.cyl, M.bulb);
    disc.scale.set(0.32, 0.03, 0.32);
    disc.position.set(L.pos[0], H - 0.015, L.pos[1]);
    g.add(disc);
  }
  return g;
}
