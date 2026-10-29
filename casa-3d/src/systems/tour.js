import * as THREE from 'three';

/**
 * Recorrido virtual automático: la cámara sigue una curva Catmull-Rom
 * que pasa por los puntos definidos en config/layout.js (TOUR),
 * con velocidad constante aproximada, pausas en puntos de interés
 * y orientación suavizada.
 */
export class Tour {
  constructor(camera, points, { eyeHeight = 1.6, speed = 1.05, onLabel, onEnd } = {}) {
    this.camera = camera;
    this.onLabel = onLabel;
    this.onEnd = onEnd;
    const P = points.map((p) => new THREE.Vector3(p.p[0], p.y ?? eyeHeight, p.p[1]));
    const T = points.map((p) => new THREE.Vector3(...p.look));
    this.posCurve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
    // Orientación en cada punto: se interpola por rotación (slerp) y no por
    // punto observado, para evitar giros bruscos cuando la mirada cruza la cámara.
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    this.quats = P.map((p, i) => new THREE.Quaternion().setFromRotationMatrix(m.lookAt(p, T[i], up)));
    this.points = points;
    // duración de cada tramo en función de su longitud
    const n = P.length - 1;
    this.segments = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const len = P[i].distanceTo(P[i + 1]);
      const turn = T[i].clone().sub(P[i]).normalize().angleTo(T[i + 1].clone().sub(P[i + 1]).normalize());
      const dur = Math.max(1.4, len / speed, turn * 1.5) * (P[i].y > 2.5 || P[i + 1].y > 2.5 ? 0.75 : 1);
      const stop = points[i].stop || 0;
      this.segments.push({ start: total, stop, dur });
      total += stop + dur;
    }
    this.total = total;
    this.time = 0;
    this.playing = false;
    this.active = false;
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._lastLabel = -1;
  }

  start() {
    this.time = 0;
    this.active = true;
    this.playing = true;
    this._lastLabel = -1;
    this._sample(true);
  }

  pause() { this.playing = false; }
  resume() { if (this.active) this.playing = true; }
  stop() { this.active = false; this.playing = false; }
  get progress() { return this.total ? this.time / this.total : 0; }

  _sample(snap = false, dt = 0) {
    const n = this.segments.length;
    let i = 0;
    while (i < n - 1 && this.time >= this.segments[i + 1].start) i++;
    const seg = this.segments[i];
    let local = this.time - seg.start - seg.stop;
    let s = local <= 0 ? 0 : Math.min(1, local / seg.dur);
    // ligera aceleración/frenado sólo en los tramos con pausa
    if (seg.stop > 0) s = s * s * (3 - 2 * s) * 0.4 + s * 0.6;
    if (i === n - 1) s = s * s * (3 - 2 * s) * 0.5 + s * 0.5;
    const u = (i + s) / n;
    this.posCurve.getPoint(u, this._p);
    const cam = this.camera;
    cam.position.copy(this._p);
    const r = s * s * (3 - 2 * s);
    this._q.slerpQuaternions(this.quats[i], this.quats[i + 1], r);
    if (snap) cam.quaternion.copy(this._q);
    else cam.quaternion.slerp(this._q, 1 - Math.exp(-dt * 5));

    // etiqueta de la estancia
    let li = -1;
    for (let k = 0; k <= i; k++) if (this.points[k].label) li = k;
    if (s >= 0.5 && this.points[i + 1]?.label) li = i + 1;
    if (li !== this._lastLabel && li >= 0) {
      this._lastLabel = li;
      this.onLabel?.(this.points[li].label);
    }
  }

  update(dt) {
    if (!this.active || !this.playing) return;
    this.time += dt;
    if (this.time >= this.total) {
      this.time = this.total;
      this._sample(false, dt);
      this.playing = false;
      this.active = false;
      this.onEnd?.();
      return;
    }
    this._sample(false, dt);
  }
}
