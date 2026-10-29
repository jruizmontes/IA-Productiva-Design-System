import * as THREE from 'three';
import { HOUSE, WALLS } from '../config/layout.js';
import { M, G } from './materials.js';

/**
 * Construye muros con huecos, ventanas, puertas abatibles y correderas.
 * Devuelve las piezas de muro (para el modo "recortado"), las puertas
 * animables y las cajas de colisión en planta.
 */

const CENTER = new THREE.Vector2(HOUSE.width / 2, HOUSE.depth / 2);

function boxMesh(mat, sx, sy, sz, x, y, z, cast = true) {
  const m = new THREE.Mesh(G.box, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** Curtain geometry: plano con pliegues senoidales (compartido) */
let curtainGeo = null;
function getCurtainGeo() {
  if (curtainGeo) return curtainGeo;
  const g = new THREE.PlaneGeometry(1, 1, 24, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, Math.sin((x + 0.5) * Math.PI * 8) * 0.035);
  }
  g.computeVertexNormals();
  curtainGeo = g;
  return g;
}

export function buildWalls() {
  const group = new THREE.Group();
  group.name = 'muros';
  const pieces = []; // { mesh, y0, y1 }
  const colliders = []; // { minX, maxX, minZ, maxZ }
  const doors = [];
  const openingItems = new THREE.Group(); // ventanas/puertas/cortinas (se recortan con plano)
  openingItems.name = 'carpinterias';
  group.add(openingItems);

  const H = HOUSE.wallHeight;

  for (const wall of WALLS) {
    const alongX = wall.from[1] === wall.to[1];
    const c = alongX ? wall.from[1] : wall.from[0]; // coordenada fija
    const u0 = alongX ? Math.min(wall.from[0], wall.to[0]) : Math.min(wall.from[1], wall.to[1]);
    const u1 = alongX ? Math.max(wall.from[0], wall.to[0]) : Math.max(wall.from[1], wall.to[1]);
    const t = wall.t;
    // sentido hacia el exterior de la vivienda (para materiales y cortinas)
    const outward = alongX ? Math.sign(c - CENTER.y) : Math.sign(c - CENTER.x);

    // Materiales por cara del cubo [+x,-x,+y,-y,+z,-z]
    let mats = M.wall;
    if (wall.exterior) {
      const outIdx = alongX ? (outward > 0 ? 4 : 5) : outward > 0 ? 0 : 1;
      const inIdx = alongX ? (outward > 0 ? 5 : 4) : outward > 0 ? 1 : 0;
      mats = [M.wallAccent, M.wallAccent, M.wallAccent, M.wallAccent, M.wallAccent, M.wallAccent];
      mats[inIdx] = M.wall;
      mats[outIdx] = M.wallAccent;
    }

    // Convierte coordenadas locales (u a lo largo, n normal) a mundo
    const W = (u, y, n = 0) => (alongX ? new THREE.Vector3(u, y, c + n) : new THREE.Vector3(c + n, y, u));

    const addPiece = (a, b, y0, y1) => {
      if (b - a < 0.001 || y1 - y0 < 0.001) return;
      const mid = W((a + b) / 2, (y0 + y1) / 2);
      const m = boxMesh(mats, alongX ? b - a : t, y1 - y0, alongX ? t : b - a, mid.x, mid.y, mid.z);
      m.userData = { y0, y1 };
      group.add(m);
      pieces.push({ mesh: m, y0, y1 });
      if (y0 < 1.0) {
        colliders.push(
          alongX
            ? { minX: a, maxX: b, minZ: c - t / 2, maxZ: c + t / 2 }
            : { minX: c - t / 2, maxX: c + t / 2, minZ: a, maxZ: b }
        );
      }
    };

    const ops = [...(wall.openings || [])].sort((p, q) => p.at - q.at);
    let cursor = u0;
    for (const op of ops) {
      const a = u0 + op.at;
      const b = a + op.w;
      addPiece(cursor, a, 0, H);
      const top = op.type === 'window' ? op.sill + op.h : op.h;
      addPiece(a, b, top, H); // dintel
      if (op.type === 'window') addPiece(a, b, 0, op.sill); // antepecho
      cursor = b;

      if (op.type === 'window') buildWindow(openingItems, W, alongX, a, b, op, t, outward, !!wall.exterior);
      if (op.type === 'door') doors.push(buildDoor(openingItems, W, alongX, a, b, op, t));
      if (op.type === 'slider') doors.push(buildSlider(openingItems, W, alongX, a, b, op, t, outward));
      if (op.type === 'opening') buildCasing(openingItems, W, alongX, a, b, op.h, t, M.casing);
    }
    addPiece(cursor, u1, 0, H);
  }

  return { group, pieces, colliders, doors, openingItems };
}

function buildWindow(parent, W, alongX, a, b, op, t, outward, exterior) {
  const y0 = op.sill;
  const y1 = op.sill + op.h;
  const fw = 0.06; // ancho de perfil
  const fd = 0.09; // profundidad de perfil
  const g = new THREE.Group();
  const bar = (u0, u1, ya, yb, n = 0, d = fd, mat = M.frame) => {
    const p = W((u0 + u1) / 2, (ya + yb) / 2, n);
    const sx = alongX ? u1 - u0 : d;
    const sz = alongX ? d : u1 - u0;
    g.add(boxMesh(mat, sx, yb - ya, sz, p.x, p.y, p.z, mat !== M.glass));
  };
  bar(a, b, y0, y0 + fw);
  bar(a, b, y1 - fw, y1);
  bar(a, a + fw, y0, y1);
  bar(b - fw, b, y0, y1);
  const panes = op.w > 1.3 ? 2 : 1;
  for (let i = 1; i < panes; i++) {
    const u = a + (i * (b - a)) / panes;
    bar(u - fw / 2, u + fw / 2, y0, y1);
  }
  if (op.w > 1.5 && op.h > 1.2) bar(a, b, y1 - 0.42, y1 - 0.42 + fw * 0.7); // travesaño
  bar(a + fw, b - fw, y0 + fw, y1 - fw, 0, 0.012, M.glass);
  // Vierteaguas exterior y alféizar interior
  if (exterior) {
    bar(a - 0.05, b + 0.05, y0 - 0.04, y0, outward * (t / 2 + 0.03), 0.1, M.sill);
    bar(a - 0.03, b + 0.03, y0 - 0.03, y0, -outward * (t / 2 + 0.02), 0.06, M.casing);
  }
  if (op.curtains) {
    const geo = getCurtainGeo();
    const n = -outward * (t / 2 + 0.12);
    const cw = Math.min(0.55, op.w * 0.3);
    const top = Math.min(y1 + 0.25, HOUSE.wallHeight - 0.05);
    const bottom = 0.03;
    for (const side of [-1, 1]) {
      const u = side < 0 ? a - 0.1 + cw / 2 : b + 0.1 - cw / 2;
      const p = W(u, (top + bottom) / 2, n);
      const m = new THREE.Mesh(geo, M.curtain);
      m.scale.set(cw, top - bottom, 1);
      m.position.copy(p);
      if (!alongX) m.rotation.y = Math.PI / 2;
      m.receiveShadow = true;
      g.add(m);
    }
    bar(a - 0.25, b + 0.25, top + 0.01, top + 0.04, n, 0.03, M.frame);
  }
  g.userData.sill = y0;
  parent.add(g);
}

function buildCasing(parent, W, alongX, a, b, h, t, mat) {
  const d = t + 0.04;
  const cw = 0.06;
  const add = (u0, u1, y0, y1) => {
    const p = W((u0 + u1) / 2, (y0 + y1) / 2);
    parent.add(boxMesh(mat, alongX ? u1 - u0 : d, y1 - y0, alongX ? d : u1 - u0, p.x, p.y, p.z));
  };
  add(a - cw, a, 0, h + cw);
  add(b, b + cw, 0, h + cw);
  add(a - cw, b + cw, h, h + cw);
}

function buildDoor(parent, W, alongX, a, b, op, t) {
  buildCasing(parent, W, alongX, a, b, op.h, t, op.main ? M.frame : M.casing);
  const w = b - a - 0.02;
  const h = op.h - 0.02;
  const th = op.main ? 0.06 : 0.04;
  const along = op.hinge === 'end' ? -1 : 1;
  const hingeU = op.hinge === 'end' ? b - 0.01 : a + 0.01;
  const pivot = new THREE.Group();
  pivot.position.copy(W(hingeU, 0, 0));
  parent.add(pivot);

  // Panel en coordenadas locales: se extiende por el eje +X local (o +Z)
  const mat = op.main ? M.doorMain : M.doorWood;
  const panel = new THREE.Mesh(G.box, mat);
  panel.castShadow = panel.receiveShadow = true;
  const dirVec = alongX ? new THREE.Vector3(along, 0, 0) : new THREE.Vector3(0, 0, along);
  panel.scale.set(alongX ? w : th, h, alongX ? th : w);
  panel.position.copy(dirVec.clone().multiplyScalar(w / 2)).setY(h / 2 + 0.01);
  pivot.add(panel);

  if (op.main) {
    // Franja de vidrio y tirador vertical
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(G.box, M.handle);
      bar.scale.set(alongX ? 0.03 : 0.04, 0.9, alongX ? 0.04 : 0.03);
      bar.position.copy(dirVec.clone().multiplyScalar(w - 0.12));
      bar.position.y = 1.05;
      if (alongX) bar.position.z = s * (th / 2 + 0.03);
      else bar.position.x = s * (th / 2 + 0.03);
      pivot.add(bar);
    }
    for (let i = 0; i < 4; i++) {
      const groove = new THREE.Mesh(G.box, M.woodDark);
      groove.scale.set(alongX ? w * 0.7 : th + 0.004, 0.012, alongX ? th + 0.004 : w * 0.7);
      groove.position.copy(dirVec.clone().multiplyScalar(w * 0.42));
      groove.position.y = 0.5 + i * 0.4;
      pivot.add(groove);
    }
  } else {
    for (const s of [-1, 1]) {
      const knob = new THREE.Mesh(G.box, M.handle);
      knob.scale.set(alongX ? 0.13 : 0.03, 0.02, alongX ? 0.03 : 0.13);
      knob.position.copy(dirVec.clone().multiplyScalar(w - 0.12));
      knob.position.y = 1.0;
      if (alongX) knob.position.z = s * (th / 2 + 0.03);
      else knob.position.x = s * (th / 2 + 0.03);
      pivot.add(knob);
    }
  }

  const sign = alongX ? -op.swing * along : op.swing * along;
  const closedBox = alongX
    ? { minX: a, maxX: b, minZ: W(0, 0).z - 0.06, maxZ: W(0, 0).z + 0.06 }
    : { minX: W(0, 0).x - 0.06, maxX: W(0, 0).x + 0.06, minZ: a, maxZ: b };

  const door = {
    id: op.id || 'puerta',
    type: 'hinged',
    pivot,
    progress: 0,
    target: 0,
    closedBox,
    center: W((a + b) / 2, 1, 0),
    apply() {
      const e = this.progress < 0.5 ? 2 * this.progress ** 2 : 1 - (-2 * this.progress + 2) ** 2 / 2;
      pivot.rotation.y = sign * e * (Math.PI / 2) * 0.97;
    },
  };
  pivot.traverse((o) => (o.userData.door = door));
  return door;
}

function buildSlider(parent, W, alongX, a, b, op, t, outward) {
  const h = op.h;
  const pw = (b - a) / 2 + 0.04;
  const fw = 0.06;
  const make = (n) => {
    const g = new THREE.Group();
    const add = (sx, sy, sz, x, y, z, mat) => g.add(boxMesh(mat, sx, sy, sz, x, y, z, mat !== M.glass));
    // marco del panel en local (eje u = X local)
    add(pw, fw, 0.05, 0, fw / 2, 0, M.frame);
    add(pw, fw, 0.05, 0, h - fw / 2, 0, M.frame);
    add(fw, h, 0.05, -pw / 2 + fw / 2, h / 2, 0, M.frame);
    add(fw, h, 0.05, pw / 2 - fw / 2, h / 2, 0, M.frame);
    add(pw - 2 * fw, h - 2 * fw, 0.012, 0, h / 2, 0, M.glass);
    if (!alongX) g.rotation.y = Math.PI / 2;
    parent.add(g);
    return g;
  };
  const fixed = make();
  const fixedPos = W(b - pw / 2, 0, outward * 0.035);
  fixed.position.copy(fixedPos);
  const moving = make();
  const closedU = a + pw / 2;
  const movingBase = W(closedU, 0, -outward * 0.035);
  moving.position.copy(movingBase);
  buildCasing(parent, W, alongX, a, b, h, t, M.frame);

  const closedBox = alongX
    ? { minX: a, maxX: b, minZ: W(0, 0).z - 0.08, maxZ: W(0, 0).z + 0.08 }
    : { minX: W(0, 0).x - 0.08, maxX: W(0, 0).x + 0.08, minZ: a, maxZ: b };
  const travel = pw - 0.1;
  const door = {
    id: op.id || 'corredera',
    type: 'slider',
    progress: 0,
    target: 0,
    closedBox,
    center: W((a + b) / 2, 1, 0),
    apply() {
      const e = this.progress < 0.5 ? 2 * this.progress ** 2 : 1 - (-2 * this.progress + 2) ** 2 / 2;
      const off = e * travel;
      moving.position.copy(movingBase);
      if (alongX) moving.position.x += off;
      else moving.position.z += off;
    },
  };
  moving.traverse((o) => (o.userData.door = door));
  fixed.traverse((o) => (o.userData.door = door));
  return door;
}
