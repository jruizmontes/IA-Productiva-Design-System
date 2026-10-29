/**
 * Colisiones en planta (2D, XZ) para el modo primera persona.
 * El visitante es un círculo de radio r; los obstáculos son cajas alineadas a ejes.
 * Las puertas cerradas bloquean el paso; abiertas, no.
 */
export class CollisionWorld {
  constructor({ bounds }) {
    this.static = [];
    this.doors = [];
    this.bounds = bounds; // límites de la parcela {minX,maxX,minZ,maxZ}
  }

  addBox(b) {
    this.static.push(b);
  }

  addDoor(door) {
    this.doors.push(door);
  }

  /** Empuja la posición fuera de los obstáculos. Modifica pos (x, z). */
  resolve(pos, r) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.static) moved = pushOut(pos, r, b) || moved;
      for (const d of this.doors) if (d.progress < 0.6) moved = pushOut(pos, r, d.closedBox) || moved;
      if (!moved) break;
    }
    const B = this.bounds;
    pos.x = Math.min(Math.max(pos.x, B.minX + r), B.maxX - r);
    pos.z = Math.min(Math.max(pos.z, B.minZ + r), B.maxZ - r);
    return pos;
  }
}

function pushOut(pos, r, b) {
  if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) return false;
  const cx = Math.min(Math.max(pos.x, b.minX), b.maxX);
  const cz = Math.min(Math.max(pos.z, b.minZ), b.maxZ);
  let dx = pos.x - cx;
  let dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > 1e-10) {
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.z = cz + (dz / d) * r;
    return true;
  }
  // Centro dentro de la caja: salir por el lado de menor penetración
  const pens = [
    [pos.x - b.minX + r, -1, 0],
    [b.maxX - pos.x + r, 1, 0],
    [pos.z - b.minZ + r, 0, -1],
    [b.maxZ - pos.z + r, 0, 1],
  ].sort((p, q) => p[0] - q[0]);
  const [pen, sx, sz] = pens[0];
  pos.x += sx * pen;
  pos.z += sz * pen;
  return true;
}
