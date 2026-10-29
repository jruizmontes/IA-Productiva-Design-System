import * as THREE from 'three';
import { M, G, seeded } from './materials.js';

/**
 * Catálogo de mobiliario construido con primitivas.
 * Convención: cada pieza se crea en el origen, apoyada en y = 0,
 * con su frente mirando hacia +Z. Medidas reales en metros.
 */

const colorMats = new Map();
function colorMat(hex, rough = 0.9, useFabric = true) {
  const key = `${hex}-${rough}`;
  if (!colorMats.has(key)) {
    colorMats.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, map: useFabric ? M.fabricLight.map : null }));
  }
  return colorMats.get(key);
}

/** Caja: tamaño [w,h,d], posición [x, yBase, z] (y = base de la caja) */
function box(g, mat, [w, h, d], [x, y, z], rot = null) {
  const m = new THREE.Mesh(G.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  g.add(m);
  return m;
}
function cyl(g, mat, r, h, [x, y, z], low = false, rTop = null) {
  const geo = rTop !== null ? new THREE.CylinderGeometry(rTop, r, h, 16) : low ? G.cylLow : G.cyl;
  const m = new THREE.Mesh(geo, mat);
  if (rTop !== null) m.position.set(x, y + h / 2, z);
  else {
    m.scale.set(r * 2, h, r * 2);
    m.position.set(x, y + h / 2, z);
  }
  g.add(m);
  return m;
}
function sph(g, mat, [sx, sy, sz], [x, y, z], low = true) {
  const m = new THREE.Mesh(low ? G.sphereLow : G.sphere, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function legs(g, mat, w, d, h, inset = 0.05, r = 0.02) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, mat, r, h, [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)], true);
}

function lampOnTop(g, y, x = 0, z = 0, s = 1) {
  cyl(g, M.greyDark, 0.06 * s, 0.03, [x, y, z], true);
  cyl(g, M.greyDark, 0.012, 0.28 * s, [x, y, z], true);
  const shade = cyl(g, M.lampShade, 0.12 * s, 0.18 * s, [x, y + 0.24 * s, z], false, 0.085 * s);
  shade.userData.noShadow = true;
}

export const builders = {
  rug({ size = [2, 1.5], color = 0xccc5b9 }) {
    const g = new THREE.Group();
    box(g, colorMat(color, 1), [size[0], 0.012, size[1]], [0, 0.002, 0]);
    g.userData.noCollide = true;
    return g;
  },

  sofa({ width = 2.2, depth = 0.92, mat = M.fabricLight }) {
    const g = new THREE.Group();
    const w = width;
    box(g, M.woodDark, [w - 0.1, 0.08, depth - 0.1], [0, 0.06, 0]);
    legs(g, M.woodDark, w - 0.1, depth - 0.1, 0.08, 0.06, 0.025);
    box(g, mat, [w, 0.28, depth], [0, 0.14, 0]);
    const arm = 0.18;
    const seats = Math.max(1, Math.round((w - 2 * arm) / 0.65));
    const sw = (w - 2 * arm) / seats;
    for (let i = 0; i < seats; i++) {
      const x = -w / 2 + arm + sw * (i + 0.5);
      box(g, mat, [sw - 0.02, 0.14, depth - 0.22], [x, 0.42, 0.08]);
      box(g, mat, [sw - 0.03, 0.42, 0.18], [x, 0.44, -depth / 2 + 0.2], [-0.12, 0, 0]);
    }
    box(g, mat, [w, 0.5, 0.16], [0, 0.42, -depth / 2 + 0.08]);
    for (const s of [-1, 1]) box(g, mat, [arm, 0.36, depth], [s * (w / 2 - arm / 2), 0.42, 0]);
    // cojines decorativos
    if (w > 1.2) {
      const p1 = box(g, M.fabricWarm, [0.42, 0.38, 0.12], [-w / 2 + 0.45, 0.58, -depth / 2 + 0.33], [-0.25, 0.25, 0]);
      const p2 = box(g, M.fabricGrey, [0.42, 0.38, 0.12], [w / 2 - 0.45, 0.58, -depth / 2 + 0.33], [-0.25, -0.25, 0]);
      box(g, M.fabricWarm, [0.36, 0.32, 0.11], [w / 2 - 0.8, 0.58, -depth / 2 + 0.36], [-0.2, -0.1, 0]);
      p1.userData.soft = p2.userData.soft = true;
    }
    return g;
  },

  armchair() {
    const g = builders.sofa({ width: 0.9, depth: 0.85, mat: M.fabricGrey });
    box(g, M.fabricLight, [0.4, 0.36, 0.11], [0, 0.58, -0.12], [-0.25, 0, 0]);
    return g;
  },

  coffeeTable() {
    const g = new THREE.Group();
    box(g, M.woodLight, [1.15, 0.05, 0.62], [0, 0.38, 0]);
    box(g, M.woodLight, [1.05, 0.03, 0.52], [0, 0.1, 0]);
    for (const sx of [-1, 1]) box(g, M.woodMid, [0.05, 0.38, 0.55], [sx * 0.53, 0, 0]);
    // decoración
    box(g, M.fabricBlue, [0.28, 0.04, 0.2], [-0.25, 0.43, 0.05]);
    box(g, M.white, [0.26, 0.03, 0.19], [-0.25, 0.47, 0.05], [0, 0.2, 0]);
    cyl(g, M.potDark, 0.06, 0.11, [0.25, 0.43, -0.05], true);
    sph(g, M.leaf, [0.16, 0.14, 0.16], [0.25, 0.6, -0.05]);
    cyl(g, M.ceramic, 0.11, 0.03, [0.05, 0.43, 0.15], false);
    return g;
  },

  sideTable({ lamp = false }) {
    const g = new THREE.Group();
    cyl(g, M.woodLight, 0.24, 0.03, [0, 0.55, 0]);
    cyl(g, M.black, 0.015, 0.55, [0, 0, 0], true);
    cyl(g, M.black, 0.16, 0.02, [0, 0, 0], true);
    if (lamp) lampOnTop(g, 0.58, 0, 0, 1.25);
    else {
      cyl(g, M.pot, 0.07, 0.16, [0.05, 0.58, 0], true);
      sph(g, M.leaf, [0.2, 0.18, 0.2], [0.05, 0.82, 0]);
    }
    return g;
  },

  tvStand() {
    const g = new THREE.Group();
    box(g, M.woodMid, [1.9, 0.42, 0.45], [0, 0.12, 0]);
    for (const sx of [-1, 1]) box(g, M.black, [0.04, 0.12, 0.38], [sx * 0.85, 0, 0]);
    for (const sx of [-0.63, 0, 0.63]) box(g, M.woodDark, [0.6, 0.005, 0.005], [sx, 0.44, 0.226]);
    for (const sx of [-0.315, 0.315]) box(g, M.woodDark, [0.006, 0.4, 0.005], [sx, 0.13, 0.226]);
    // decoración
    box(g, M.greyDark, [0.38, 0.12, 0.18], [0.55, 0.54, 0]);
    cyl(g, M.ceramic, 0.06, 0.24, [-0.7, 0.54, 0], false, 0.04);
    cyl(g, M.pot, 0.07, 0.12, [-0.45, 0.54, 0.05], true);
    sph(g, M.leaf, [0.18, 0.2, 0.18], [-0.45, 0.74, 0.05]);
    return g;
  },

  tv({ y = 1.3 }) {
    const g = new THREE.Group();
    box(g, M.black, [1.45, 0.84, 0.05], [0, y - 0.42, -0.0]);
    box(g, M.screen, [1.4, 0.79, 0.005], [0, y - 0.395, 0.026]);
    g.userData.noCollide = true;
    return g;
  },

  floorLamp() {
    const g = new THREE.Group();
    cyl(g, M.black, 0.15, 0.03, [0, 0, 0], true);
    cyl(g, M.black, 0.015, 1.45, [0, 0, 0], true);
    const s = cyl(g, M.lampShade, 0.2, 0.28, [0, 1.38, 0], false, 0.16);
    s.userData.noShadow = true;
    return g;
  },

  plant({ scale = 1 }) {
    const g = new THREE.Group();
    const s = scale;
    const rnd = seeded(Math.floor(s * 100) + 3);
    cyl(g, M.pot, 0.17 * s, 0.38 * s, [0, 0, 0], false, 0.2 * s);
    cyl(g, M.trunk, 0.02 * s, 0.4 * s, [0, 0.35 * s, 0], true);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd();
      const r = 0.14 * s + rnd() * 0.08 * s;
      sph(g, i % 2 ? M.leaf : M.leafDark, [0.28 * s, 0.26 * s, 0.28 * s], [Math.cos(a) * r, (0.7 + rnd() * 0.35) * s, Math.sin(a) * r]);
    }
    sph(g, M.leaf, [0.3 * s, 0.3 * s, 0.3 * s], [0, 1.05 * s, 0]);
    return g;
  },

  chair({ mat = M.woodLight, seat = M.fabricLight }) {
    const g = new THREE.Group();
    legs(g, M.woodMid, 0.44, 0.44, 0.45, 0.04, 0.018);
    box(g, mat, [0.46, 0.04, 0.46], [0, 0.45, 0]);
    box(g, seat, [0.42, 0.04, 0.42], [0, 0.49, 0.01]);
    for (const sx of [-1, 1]) box(g, M.woodMid, [0.03, 0.4, 0.03], [sx * 0.2, 0.49, -0.21]);
    box(g, mat, [0.44, 0.16, 0.03], [0, 0.72, -0.22], [-0.08, 0, 0]);
    return g;
  },

  diningSet() {
    const g = new THREE.Group();
    box(g, M.woodLight, [1.6, 0.05, 0.9], [0, 0.72, 0]);
    legs(g, M.woodMid, 1.6, 0.9, 0.72, 0.1, 0.03);
    box(g, M.woodMid, [1.35, 0.06, 0.03], [0, 0.62, 0]);
    for (const sx of [-0.4, 0.4])
      for (const sz of [-1, 1]) {
        const c = builders.chair({});
        c.position.set(sx, 0, sz * 0.62);
        c.rotation.y = sz > 0 ? Math.PI : 0;
        g.add(c);
      }
    // centro de mesa y servicio
    cyl(g, M.ceramic, 0.07, 0.22, [0, 0.77, 0], false, 0.05);
    sph(g, M.leaf, [0.2, 0.16, 0.2], [0, 1.02, 0]);
    for (const sx of [-0.4, 0.4]) for (const sz of [-1, 1]) cyl(g, M.ceramic, 0.12, 0.015, [sx, 0.77, sz * 0.27]);
    box(g, M.linen, [1.0, 0.004, 0.36], [0, 0.773, 0]);
    return g;
  },

  sideboard() {
    const g = new THREE.Group();
    box(g, M.woodMid, [1.6, 0.6, 0.45], [0, 0.2, 0]);
    legs(g, M.black, 1.5, 0.38, 0.2, 0.05, 0.015);
    for (const sx of [-0.4, 0, 0.4]) box(g, M.woodDark, [0.005, 0.56, 0.005], [sx, 0.22, 0.226]);
    cyl(g, M.ceramic, 0.09, 0.32, [-0.5, 0.8, 0], false, 0.05);
    box(g, M.woodLight, [0.3, 0.2, 0.2], [0.45, 0.8, 0]);
    lampOnTop(g, 0.8, 0.05, -0.05, 1);
    return g;
  },

  wallArt({ y = 1.6, w = 0.9 }) {
    const g = new THREE.Group();
    const h = w * 0.7;
    box(g, M.black, [w, h, 0.03], [0, y - h / 2, 0]);
    box(g, M.white, [w - 0.06, h - 0.06, 0.005], [0, y - h / 2 + 0.03, 0.016]);
    box(g, M.art1, [w * 0.35, h * 0.55, 0.004], [-w * 0.15, y - h * 0.3, 0.02]);
    box(g, M.art2, [w * 0.3, h * 0.4, 0.004], [w * 0.18, y - h * 0.2, 0.021]);
    g.userData.noCollide = true;
    return g;
  },

  kitchenRun({ length = 3 }) {
    const g = new THREE.Group();
    const L = length;
    const d = 0.62;
    box(g, M.greyDark, [L, 0.1, d - 0.06], [0, 0, -0.03]);
    box(g, M.white, [L, 0.76, d - 0.02], [0, 0.1, 0]);
    box(g, M.countertop, [L, 0.04, d + 0.02], [0, 0.86, 0.01]);
    const doors = Math.round(L / 0.6);
    for (let i = 1; i < doors; i++) box(g, M.greyLight, [0.006, 0.74, 0.005], [-L / 2 + (i * L) / doors, 0.11, d / 2]);
    for (let i = 0; i < doors; i++) box(g, M.steel, [0.25, 0.015, 0.02], [-L / 2 + ((i + 0.5) * L) / doors, 0.78, d / 2 + 0.01]);
    // fregadero bajo la ventana
    const sinkX = 0.35;
    box(g, M.steel, [0.62, 0.02, 0.44], [sinkX, 0.885, 0.0]);
    box(g, M.greyDark, [0.54, 0.01, 0.36], [sinkX, 0.9, 0.0]);
    cyl(g, M.steel, 0.02, 0.3, [sinkX, 0.9, -0.24], true);
    box(g, M.steel, [0.03, 0.03, 0.2], [sinkX, 1.17, -0.15]);
    // placa y horno
    const cookX = -1.0;
    box(g, M.black, [0.6, 0.012, 0.52], [cookX, 0.9, 0.0]);
    for (const [ox, oz] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) cyl(g, M.greyDark, 0.08, 0.003, [cookX + ox, 0.912, oz]);
    box(g, M.black, [0.58, 0.55, 0.01], [cookX, 0.18, d / 2 + 0.001]);
    box(g, M.steel, [0.45, 0.02, 0.02], [cookX, 0.68, d / 2 + 0.02]);
    // campana
    box(g, M.steel, [0.62, 0.08, 0.5], [cookX, 1.55, -0.05]);
    box(g, M.steel, [0.28, 1.05, 0.25], [cookX, 1.63, -0.17]);
    // salpicadero y muebles altos
    box(g, M.marble, [L, 0.6, 0.015], [0, 0.9, -d / 2 + 0.01]);
    const upX0 = 0.95;
    const upX1 = L / 2;
    box(g, M.white, [upX1 - upX0, 0.72, 0.35], [(upX0 + upX1) / 2, 1.5, -d / 2 + 0.175]);
    box(g, M.white, [0.55, 0.72, 0.35], [-L / 2 + 0.275, 1.5, -d / 2 + 0.175]);
    box(g, M.steel, [0.2, 0.015, 0.02], [(upX0 + upX1) / 2, 1.55, -d / 2 + 0.36]);
    box(g, M.steel, [0.2, 0.015, 0.02], [-L / 2 + 0.275, 1.55, -d / 2 + 0.36]);
    // utensilios
    cyl(g, M.woodLight, 0.15, 0.02, [-0.35, 0.9, -0.05]);
    box(g, M.woodLight, [0.4, 0.02, 0.28], [-0.4, 0.9, 0.05], [0, 0.2, 0]);
    cyl(g, M.ceramic, 0.05, 0.14, [1.2, 0.9, -0.15]);
    return g;
  },

  fridge() {
    const g = new THREE.Group();
    box(g, M.steel, [0.7, 1.86, 0.68], [0, 0, 0]);
    box(g, M.greyDark, [0.7, 0.006, 0.005], [0, 1.15, 0.341]);
    box(g, M.greyDark, [0.005, 1.86, 0.005], [0, 0, 0.341]);
    for (const sx of [-1, 1]) box(g, M.greyLight, [0.02, 0.6, 0.03], [sx * 0.04, 1.25, 0.36]);
    return g;
  },

  island() {
    const g = new THREE.Group();
    box(g, M.woodLight, [1.7, 0.86, 0.8], [0, 0, -0.05]);
    box(g, M.countertop, [1.9, 0.04, 1.0], [0, 0.86, 0]);
    for (const sx of [-1, 1]) box(g, M.countertop, [0.04, 0.86, 1.0], [sx * 0.93, 0, 0]);
    for (let i = 0; i < 6; i++) box(g, M.woodMid, [0.004, 0.84, 0.004], [-0.75 + i * 0.3, 0.01, 0.351]);
    // frutero y botellas
    sph(g, M.ceramic, [0.3, 0.1, 0.3], [-0.3, 0.92, 0]);
    sph(g, M.fabricWarm, [0.08, 0.08, 0.08], [-0.33, 0.96, 0.02]);
    sph(g, M.leaf, [0.07, 0.07, 0.07], [-0.26, 0.96, -0.03]);
    cyl(g, M.greyDark, 0.035, 0.28, [0.4, 0.9, -0.1], true);
    return g;
  },

  stool() {
    const g = new THREE.Group();
    cyl(g, M.black, 0.2, 0.02, [0, 0, 0], true);
    cyl(g, M.black, 0.025, 0.65, [0, 0, 0], true);
    cyl(g, M.black, 0.15, 0.015, [0, 0.3, 0], true);
    cyl(g, M.woodLight, 0.19, 0.06, [0, 0.65, 0]);
    return g;
  },

  bed({ width = 1.6, color = 0xb8a48c }) {
    const g = new THREE.Group();
    const L = 2.05;
    const W = width + 0.1;
    box(g, M.woodLight, [W, 0.3, L], [0, 0.05, 0]);
    legs(g, M.woodMid, W, L, 0.06, 0.06, 0.03);
    box(g, M.linen, [width, 0.22, 1.98], [0, 0.35, 0.01]);
    // cabecero tapizado
    box(g, M.woodLight, [W + 0.1, 1.05, 0.08], [0, 0, -L / 2 - 0.02]);
    box(g, M.fabricGrey, [W - 0.05, 0.55, 0.06], [0, 0.48, -L / 2 + 0.05]);
    // edredón y manta
    box(g, colorMat(color), [width + 0.06, 0.06, 1.35], [0, 0.55, 0.33]);
    box(g, colorMat(color), [width + 0.06, 0.28, 0.02], [0, 0.32, 1.0]);
    for (const s of [-1, 1]) box(g, colorMat(color), [0.02, 0.28, 1.35], [s * (width / 2 + 0.03), 0.32, 0.33]);
    box(g, M.fabricWarm, [width + 0.08, 0.07, 0.4], [0, 0.58, 0.6]);
    // almohadas
    const n = width > 1.2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i - 0.5) * (width / 2);
      box(g, M.white, [width / n - 0.12, 0.14, 0.42], [x, 0.56, -0.72], [0.2, 0, 0]);
    }
    box(g, M.fabricBlue, [0.42, 0.3, 0.1], [0, 0.6, -0.5], [-0.35, 0, 0]);
    return g;
  },

  nightstand({ noLamp = false }) {
    const g = new THREE.Group();
    box(g, M.woodMid, [0.48, 0.42, 0.4], [0, 0.12, 0]);
    legs(g, M.black, 0.42, 0.34, 0.12, 0.03, 0.012);
    box(g, M.woodDark, [0.46, 0.004, 0.004], [0, 0.33, 0.201]);
    box(g, M.steel, [0.12, 0.012, 0.015], [0, 0.42, 0.205]);
    if (!noLamp) lampOnTop(g, 0.54, 0.04, -0.03, 1.0);
    else {
      box(g, M.fabricBlue, [0.18, 0.04, 0.24], [0, 0.54, 0]);
      cyl(g, M.ceramic, 0.04, 0.09, [0.12, 0.54, 0.05]);
    }
    return g;
  },

  wardrobe({ width = 2 }) {
    const g = new THREE.Group();
    box(g, M.white, [width, 2.25, 0.6], [0, 0, 0]);
    const doors = Math.max(2, Math.round(width / 0.5));
    for (let i = 1; i < doors; i++) box(g, M.greyLight, [0.006, 2.2, 0.005], [-width / 2 + (i * width) / doors, 0.03, 0.301]);
    for (let i = 0; i < doors; i++) {
      const x = -width / 2 + ((i + 0.5) * width) / doors + (i % 2 ? -1 : 1) * (width / doors / 2 - 0.06);
      box(g, M.woodMid, [0.02, 0.5, 0.025], [x, 0.85, 0.31]);
    }
    box(g, M.woodLight, [width, 0.04, 0.6], [0, 2.25, 0]);
    return g;
  },

  desk() {
    const g = new THREE.Group();
    box(g, M.white, [1.2, 0.035, 0.6], [0, 0.72, 0]);
    for (const sx of [-1, 1]) box(g, M.woodLight, [0.04, 0.72, 0.55], [sx * 0.56, 0, 0]);
    box(g, M.greyDark, [0.34, 0.015, 0.24], [0.1, 0.755, 0.05]);
    box(g, M.greyDark, [0.34, 0.22, 0.01], [0.1, 0.77, -0.08], [-0.25, 0, 0]);
    lampOnTop(g, 0.755, -0.42, -0.15, 0.9);
    const c = builders.chair({ seat: M.fabricGrey });
    c.position.set(0.05, 0, 0.5);
    c.rotation.y = Math.PI;
    g.add(c);
    return g;
  },

  console() {
    const g = new THREE.Group();
    box(g, M.woodLight, [1.0, 0.03, 0.3], [0, 0.8, 0]);
    for (const sx of [-1, 1]) box(g, M.black, [0.03, 0.8, 0.26], [sx * 0.46, 0, 0]);
    cyl(g, M.ceramic, 0.07, 0.25, [-0.3, 0.83, 0], false, 0.04);
    box(g, M.woodDark, [0.22, 0.06, 0.16], [0.25, 0.83, 0]);
    return g;
  },

  shower() {
    // Plato de ducha de ancho completo; la mampara mira hacia -Z (entrada)
    const g = new THREE.Group();
    box(g, M.whiteGloss, [2.38, 0.05, 1.2], [0, 0, 0]);
    box(g, M.greyLight, [0.6, 0.004, 0.06], [0, 0.05, 0]);
    box(g, M.glass, [1.35, 2.0, 0.012], [-0.5, 0.05, -0.59]).userData.noShadow = true;
    box(g, M.steel, [1.35, 0.025, 0.03], [-0.5, 2.05, -0.59]);
    box(g, M.steel, [0.025, 2.0, 0.03], [0.17, 0.05, -0.59]);
    // grifería en el tabique oeste
    box(g, M.steel, [0.03, 0.08, 0.15], [-1.17, 1.05, 0.0]);
    cyl(g, M.steel, 0.012, 1.0, [-1.17, 1.05, 0.0], true);
    box(g, M.steel, [0.3, 0.02, 0.02], [-1.04, 2.05, 0.0]);
    cyl(g, M.steel, 0.12, 0.015, [-0.9, 2.02, 0.0]);
    // azulejo en las paredes de la ducha
    box(g, M.wallTile, [0.02, 2.1, 1.2], [-1.18, 0.05, 0]);
    box(g, M.wallTile, [0.02, 2.1, 1.2], [1.18, 0.05, 0]);
    box(g, M.wallTile, [0.82, 2.1, 0.02], [-0.76, 0.05, 0.57]);
    box(g, M.wallTile, [0.72, 2.1, 0.02], [0.81, 0.05, 0.57]);
    box(g, M.wallTile, [0.8, 1.55, 0.02], [0.05, 0.05, 0.57]);
    g.userData.collideScale = 0.95;
    return g;
  },

  vanity() {
    const g = new THREE.Group();
    box(g, M.woodMid, [1.0, 0.45, 0.48], [0, 0.4, 0]);
    box(g, M.woodDark, [0.98, 0.004, 0.004], [0, 0.62, 0.241]);
    box(g, M.marble, [1.04, 0.03, 0.5], [0, 0.85, 0]);
    sph(g, M.ceramic, [0.42, 0.14, 0.34], [0, 0.93, 0.02], false);
    cyl(g, M.steel, 0.015, 0.22, [0, 0.88, -0.17], true);
    box(g, M.steel, [0.02, 0.02, 0.12], [0, 1.09, -0.12]);
    box(g, M.black, [0.82, 0.82, 0.02], [0, 1.18, -0.23]);
    box(g, M.mirror, [0.78, 0.78, 0.005], [0, 1.2, -0.218]);
    cyl(g, M.pot, 0.04, 0.12, [0.38, 0.88, -0.1]);
    box(g, M.wallTile, [1.2, 1.3, 0.015], [0, 0.88, -0.248]);
    return g;
  },

  toilet() {
    const g = new THREE.Group();
    box(g, M.ceramic, [0.38, 0.4, 0.17], [0, 0.4, -0.25]);
    cyl(g, M.ceramic, 0.17, 0.38, [0, 0, 0.0], false, 0.19);
    sph(g, M.ceramic, [0.38, 0.12, 0.5], [0, 0.4, 0.02], false);
    box(g, M.whiteGloss, [0.36, 0.03, 0.45], [0, 0.44, 0.02]);
    box(g, M.steel, [0.06, 0.01, 0.03], [0, 0.8, -0.25]);
    return g;
  },

  towelRack() {
    const g = new THREE.Group();
    box(g, M.steel, [0.6, 0.02, 0.06], [0, 1.2, 0.03]);
    box(g, M.linen, [0.5, 0.55, 0.03], [0, 0.66, 0.06]);
    g.userData.noCollide = true;
    return g;
  },

  bench() {
    const g = new THREE.Group();
    box(g, M.fabricGrey, [1.3, 0.12, 0.42], [0, 0.34, 0]);
    legs(g, M.woodMid, 1.25, 0.38, 0.34, 0.04, 0.02);
    return g;
  },

  outdoorTable() {
    const g = new THREE.Group();
    cyl(g, M.woodMid, 0.45, 0.04, [0, 0.72, 0]);
    cyl(g, M.greyDark, 0.03, 0.72, [0, 0, 0], true);
    cyl(g, M.greyDark, 0.25, 0.02, [0, 0, 0], true);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const c = builders.chair({ mat: M.greyDark, seat: M.fabricLight });
      c.position.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75);
      c.rotation.y = -a - Math.PI / 2;
      g.add(c);
    }
    cyl(g, M.ceramic, 0.08, 0.1, [0.1, 0.76, 0]);
    return g;
  },

  lounger() {
    const g = new THREE.Group();
    box(g, M.woodMid, [0.65, 0.28, 1.4], [0, 0.0, 0.25]);
    box(g, M.fabricLight, [0.6, 0.08, 1.35], [0, 0.28, 0.25]);
    box(g, M.fabricLight, [0.6, 0.75, 0.1], [0, 0.18, -0.65], [-0.75, 0, 0]);
    box(g, M.woodMid, [0.65, 0.75, 0.04], [0, 0.12, -0.72], [-0.75, 0, 0]);
    return g;
  },

  planter() {
    const g = new THREE.Group();
    box(g, M.potDark, [0.55, 0.55, 0.55], [0, 0, 0]);
    sph(g, M.leafDark, [0.6, 0.5, 0.6], [0, 0.75, 0]);
    sph(g, M.leaf, [0.35, 0.45, 0.35], [0.1, 0.95, 0.05]);
    return g;
  },
};
