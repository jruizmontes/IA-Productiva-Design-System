import * as THREE from 'three';

/**
 * Paseo en primera persona.
 *  - Escritorio: W A S D / flechas para moverse, Mayús para correr,
 *    arrastrar con el ratón para mirar, E para abrir/cerrar la puerta cercana.
 *  - Táctil: joystick virtual (izquierda) y arrastrar el dedo para mirar.
 */
export class FirstPersonController {
  constructor(camera, dom, collision, { eyeHeight = 1.6, joystick, onInteract }) {
    this.camera = camera;
    this.dom = dom;
    this.collision = collision;
    this.eye = eyeHeight;
    this.enabled = false;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.radius = 0.24;
    this.bob = 0;
    this.onInteract = onInteract;
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._look = null;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.onInteract?.();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Mirar arrastrando (ratón o dedo) sobre el lienzo
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this._look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this._look || this._look.id !== e.pointerId) return;
      const k = e.pointerType === 'touch' ? 0.006 : 0.0042;
      this.yaw -= (e.clientX - this._look.x) * k;
      this.pitch -= (e.clientY - this._look.y) * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.25, 1.25);
      this._look.x = e.clientX;
      this._look.y = e.clientY;
    });
    const end = (e) => {
      if (this._look && this._look.id === e.pointerId) this._look = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    if (joystick) this._setupJoystick(joystick);
  }

  _setupJoystick(el) {
    const knob = el.querySelector('.knob');
    let id = null;
    let cx = 0;
    let cy = 0;
    const R = 46;
    const move = (e) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R;
      this.joy.y = dy / R;
    };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      id = e.pointerId;
      el.setPointerCapture(id);
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(e);
    });
    el.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.joy.x = this.joy.y = 0;
      knob.style.transform = '';
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Coloca al visitante en (x, z) mirando hacia (lx, lz) */
  enter(x, z, lx, lz) {
    this.pos.set(x, this.eye, z);
    this.collision.resolve(this.pos, this.radius);
    this.yaw = Math.atan2(-(lx - x), -(lz - z));
    this.pitch = -0.05;
    this.vel.set(0, 0, 0);
    this.enabled = true;
  }

  /** Orientación actual para transiciones suaves */
  targetQuaternion(out = new THREE.Quaternion()) {
    this._e.set(this.pitch, this.yaw, 0);
    return out.setFromEuler(this._e);
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let f = 0;
    let s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD')) s += 1;
    if (k.has('KeyA')) s -= 1;
    if (k.has('ArrowLeft') || k.has('KeyQ')) this.yaw += 1.8 * dt;
    if (k.has('ArrowRight')) this.yaw -= 1.8 * dt;
    f -= this.joy.y;
    s += this.joy.x;
    const len = Math.hypot(f, s);
    if (len > 1) {
      f /= len;
      s /= len;
    }
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.8 : 1.5;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // adelante = (-sin, -cos); derecha = (cos, -sin)
    const tx = (-sin * f + cos * s) * speed;
    const tz = (-cos * f - sin * s) * speed;
    const a = 1 - Math.exp(-dt * 10);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.collision.resolve(this.pos, this.radius);

    const moving = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * moving * 5.5;
    const bobY = Math.sin(this.bob) * 0.018 * Math.min(1, moving);
    const cam = this.camera;
    cam.position.set(this.pos.x, this.eye + bobY, this.pos.z);
    // suavizado de la mirada
    this.targetQuaternion(this._q);
    cam.quaternion.slerp(this._q, 1 - Math.exp(-dt * 16));
  }
}
