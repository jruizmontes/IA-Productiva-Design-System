import * as THREE from 'three';

/**
 * Materiales y texturas procedurales (generadas con <canvas>, sin archivos externos).
 * Se reutilizan instancias para reducir cambios de estado en la GPU.
 */

let maxAniso = 4;
export function setMaxAnisotropy(v) {
  maxAniso = Math.min(v, 8);
}

function canvasTexture(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = maxAniso;
  return tex;
}

// Pseudoaleatorio determinista para que la casa siempre se vea igual
export function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function woodPlanks(g, size, base, rows = 8, seed = 3) {
  const rnd = seeded(seed);
  const h = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * size;
    while (x < size) {
      const len = size * (0.45 + rnd() * 0.5);
      const l = (rnd() - 0.5) * 14;
      g.fillStyle = `hsl(${base[0] + (rnd() - 0.5) * 4}, ${base[1]}%, ${base[2] + l}%)`;
      g.fillRect(x, r * h, len, h);
      // vetas
      g.globalAlpha = 0.12;
      for (let k = 0; k < 6; k++) {
        g.fillStyle = rnd() > 0.5 ? '#5a3d22' : '#ffffff';
        const yy = r * h + rnd() * h;
        g.fillRect(x, yy, len, 1 + rnd() * 1.5);
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(60,40,20,0.55)';
      g.fillRect(x, r * h, 2, h);
      x += len;
    }
    g.fillStyle = 'rgba(60,40,20,0.45)';
    g.fillRect(0, r * h, size, 2);
  }
}

const cache = {};
const once = (k, fn) => cache[k] || (cache[k] = fn());

export const textures = {
  woodFloor: () => once('woodFloor', () => canvasTexture(512, (g, s) => woodPlanks(g, s, [34, 42, 66], 8, 7))),
  deck: () => once('deck', () => canvasTexture(512, (g, s) => woodPlanks(g, s, [26, 38, 42], 6, 11))),
  tile: () =>
    once('tile', () =>
      canvasTexture(256, (g, s) => {
        const n = 4;
        const t = s / n;
        const rnd = seeded(5);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const l = 86 + rnd() * 5;
            g.fillStyle = `hsl(30, 6%, ${l}%)`;
            g.fillRect(i * t, j * t, t, t);
          }
        g.strokeStyle = '#a9a39b';
        g.lineWidth = 3;
        for (let i = 0; i <= n; i++) {
          g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, s); g.stroke();
          g.beginPath(); g.moveTo(0, i * t); g.lineTo(s, i * t); g.stroke();
        }
      })
    ),
  wallTile: () =>
    once('wallTile', () =>
      canvasTexture(256, (g, s) => {
        g.fillStyle = '#eef0ef';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#c9cccb';
        g.lineWidth = 2;
        const rows = 8;
        for (let r = 0; r <= rows; r++) {
          const y = (r * s) / rows;
          g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
          const off = r % 2 ? s / 4 : 0;
          for (let x = off; x < s; x += s / 2) {
            g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s / rows); g.stroke();
          }
        }
      })
    ),
  grass: () =>
    once('grass', () =>
      canvasTexture(512, (g, s) => {
        g.fillStyle = '#6f8f4a';
        g.fillRect(0, 0, s, s);
        const rnd = seeded(9);
        for (let i = 0; i < 9000; i++) {
          const l = 28 + rnd() * 22;
          g.fillStyle = `hsl(${85 + rnd() * 20}, ${35 + rnd() * 15}%, ${l}%)`;
          g.fillRect(rnd() * s, rnd() * s, 2, 2 + rnd() * 4);
        }
      })
    ),
  paving: () =>
    once('paving', () =>
      canvasTexture(256, (g, s) => {
        g.fillStyle = '#9d9a94';
        g.fillRect(0, 0, s, s);
        const rnd = seeded(13);
        for (let i = 0; i < 2500; i++) {
          g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},0.06)`;
          g.fillRect(rnd() * s, rnd() * s, 3, 3);
        }
        g.strokeStyle = '#7d7a75';
        g.lineWidth = 3;
        g.strokeRect(0, 0, s, s);
      })
    ),
  fabric: () =>
    once('fabric', () =>
      canvasTexture(128, (g, s) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, s, s);
        const rnd = seeded(17);
        for (let i = 0; i < 1500; i++) {
          g.fillStyle = `rgba(0,0,0,${rnd() * 0.07})`;
          g.fillRect(rnd() * s, rnd() * s, 1, 1);
        }
        g.strokeStyle = 'rgba(0,0,0,0.04)';
        for (let i = 0; i < s; i += 2) {
          g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
        }
      }, [3, 3])
    ),
};

const std = (opts) => new THREE.MeshStandardMaterial(opts);

/** Paleta: madera clara, blanco, gris y tonos cálidos */
export const M = {};
export function initMaterials() {
  Object.assign(M, {
    wall: std({ color: 0xf3efe8, roughness: 0.92 }),
    wallExt: std({ color: 0xe9e5de, roughness: 0.95 }),
    wallAccent: std({ color: 0x4a4d52, roughness: 0.8 }),
    wallTile: std({ map: textures.wallTile(), roughness: 0.35 }),
    floorWood: std({ map: textures.woodFloor(), roughness: 0.62 }),
    floorTile: std({ map: textures.tile(), roughness: 0.28 }),
    deck: std({ map: textures.deck(), roughness: 0.8 }),
    grass: std({ map: textures.grass(), roughness: 1 }),
    paving: std({ map: textures.paving(), roughness: 0.9 }),
    concrete: std({ color: 0x8e8b86, roughness: 0.95 }),
    roof: std({ color: 0x5b5e63, roughness: 0.9 }),
    ceiling: std({ color: 0xfbfaf7, roughness: 1 }),
    frame: std({ color: 0x2e3135, roughness: 0.45, metalness: 0.4 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbfd9e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false,
    }),
    doorWood: std({ color: 0xc8a57c, roughness: 0.55 }),
    doorMain: std({ color: 0x6d4a2d, roughness: 0.5 }),
    casing: std({ color: 0xf7f6f3, roughness: 0.5 }),
    sill: std({ color: 0xc8c6c2, roughness: 0.7 }),
    handle: std({ color: 0xb9b9b9, roughness: 0.25, metalness: 0.9 }),
    woodLight: std({ color: 0xd2b48c, roughness: 0.6 }),
    woodMid: std({ color: 0xa87a50, roughness: 0.55 }),
    woodDark: std({ color: 0x6e4c32, roughness: 0.55 }),
    white: std({ color: 0xf6f5f2, roughness: 0.4 }),
    whiteGloss: std({ color: 0xfafafa, roughness: 0.15 }),
    greyLight: std({ color: 0xc8c6c2, roughness: 0.7 }),
    grey: std({ color: 0x8b8d90, roughness: 0.6 }),
    greyDark: std({ color: 0x3b3d40, roughness: 0.5 }),
    black: std({ color: 0x141516, roughness: 0.35 }),
    screen: std({ color: 0x0b0c0e, roughness: 0.1, metalness: 0.3, emissive: 0x000000 }),
    steel: std({ color: 0xcfd2d4, roughness: 0.25, metalness: 0.85 }),
    marble: std({ color: 0xeeebe6, roughness: 0.2 }),
    countertop: std({ color: 0xdedbd5, roughness: 0.25 }),
    fabricLight: std({ color: 0xe4ded3, roughness: 0.95, map: textures.fabric() }),
    fabricGrey: std({ color: 0xa9a7a3, roughness: 0.95, map: textures.fabric() }),
    fabricWarm: std({ color: 0xc98a4b, roughness: 0.9, map: textures.fabric() }),
    fabricBlue: std({ color: 0x7c97a6, roughness: 0.9, map: textures.fabric() }),
    linen: std({ color: 0xf4f1ea, roughness: 0.95, map: textures.fabric() }),
    curtain: std({ color: 0xf2eee6, roughness: 1, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    leaf: std({ color: 0x4f7a3a, roughness: 0.8 }),
    leafDark: std({ color: 0x3c6130, roughness: 0.85 }),
    trunk: std({ color: 0x6b4f37, roughness: 0.9 }),
    pot: std({ color: 0xd9d3c8, roughness: 0.8 }),
    potDark: std({ color: 0x55585c, roughness: 0.8 }),
    ceramic: std({ color: 0xffffff, roughness: 0.12 }),
    mirror: std({ color: 0xdfe8ee, roughness: 0.02, metalness: 1 }),
    art1: std({ color: 0xc58b5a, roughness: 0.8 }),
    art2: std({ color: 0x6f8c8c, roughness: 0.8 }),
    bulb: std({ color: 0xfff6e4, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 }),
    lampShade: std({ color: 0xf1e6d2, emissive: 0xffc777, emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide }),
  });
  return M;
}

/** Material de suelo en función del tipo de estancia */
export function floorMaterial(type) {
  return { wood: M.floorWood, tile: M.floorTile, deck: M.deck, stone: M.paving }[type] || M.floorWood;
}

/** Geometrías compartidas (se escalan por instancia) */
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  cylLow: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  sphere: new THREE.SphereGeometry(0.5, 18, 12),
  sphereLow: new THREE.IcosahedronGeometry(0.5, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
};
