import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { HOUSE, ROOMS, FURNITURE, TOUR } from './config/layout.js';
import { initMaterials, setMaxAnisotropy, M } from './builders/materials.js';
import { buildWalls } from './builders/walls.js';
import { builders } from './builders/furniture.js';
import { buildSite, buildRoof } from './builders/environment.js';
import { createLighting } from './systems/lighting.js';
import { CollisionWorld } from './systems/collision.js';
import { FirstPersonController } from './systems/firstPerson.js';
import { Tour } from './systems/tour.js';

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isSmall = Math.min(innerWidth, innerHeight) < 700;
if (isTouch) document.body.classList.add('touch');

// ------------------------------------------------------------------
// Renderizador, escena y cámara
// ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // sombras bajo demanda (rendimiento)
renderer.localClippingEnabled = true;
$('#app').appendChild(renderer.domElement);
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 300);
const CENTER = new THREE.Vector3(HOUSE.width / 2, 0.8, HOUSE.depth / 2);
// Encuadre exterior: más alejado en pantallas verticales (móvil)
const EXTERIOR_POS = innerWidth < innerHeight ? new THREE.Vector3(-8, 9.5, 25) : new THREE.Vector3(-4.5, 5.2, 17.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 55;
controls.maxPolarAngle = Math.PI * 0.49;
controls.screenSpacePanning = true;
controls.target.copy(CENTER);
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// ------------------------------------------------------------------
// Construcción de la vivienda
// ------------------------------------------------------------------
initMaterials();
const lighting = createLighting(scene, { shadowSize: isTouch || isSmall ? 1024 : 2048 });

const walls = buildWalls();
scene.add(walls.group);

const roof = buildRoof();
scene.add(roof);

const collision = new CollisionWorld({ bounds: { minX: -9.6, maxX: 23.6, minZ: -8.6, maxZ: 19.6 } });
walls.colliders.forEach((c) => collision.addBox(c));
walls.doors.forEach((d) => collision.addDoor(d));

// Mobiliario
const furnitureRoot = new THREE.Group();
for (const item of FURNITURE) {
  const make = builders[item.type];
  if (!make) {
    console.warn('Mueble desconocido:', item.type);
    continue;
  }
  const obj = make(item);
  obj.position.set(item.pos[0], 0, item.pos[1]);
  obj.rotation.y = THREE.MathUtils.degToRad(item.rot || 0);
  furnitureRoot.add(obj);
  obj.updateMatrixWorld(true);
  if (!obj.userData.noCollide) {
    const b = new THREE.Box3().setFromObject(obj);
    const k = obj.userData.collideScale ?? 1;
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    const hx = ((b.max.x - b.min.x) / 2) * k;
    const hz = ((b.max.z - b.min.z) / 2) * k;
    if (b.max.y > 0.25) collision.addBox({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  }
}
// Árboles del jardín (troncos) como obstáculos
const site = buildSite();

scene.add(mergeStatic(furnitureRoot), mergeStatic(site));

/**
 * Fusiona todas las mallas estáticas que comparten material en una sola
 * geometría: reduce de ~1500 a ~60 llamadas de dibujo (clave en móviles).
 */
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) {
      keep.push(o);
      return;
    }
    const cast = !o.userData.noShadow && o.material !== M.glass && o.material !== M.curtain;
    const key = o.material.uuid + (cast ? '|c' : '|n');
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    geo.applyMatrix4(o.matrixWorld);
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast, geos: [] });
    buckets.get(key).geos.push(geo);
  });
  const out = new THREE.Group();
  for (const { mat, cast, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const o of keep) {
    o.updateMatrixWorld(true);
    const clone = o.clone();
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(o.matrixWorld);
    out.add(clone);
  }
  return out;
}

// ------------------------------------------------------------------
// Estado de visualización: techo, paredes, puertas, día/noche
// ------------------------------------------------------------------
let shadowsDirty = 3;
const markShadows = () => (shadowsDirty = Math.max(shadowsDirty, 2));

const CUT = 1.15;
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT);
const clipMaterials = [M.frame, M.glass, M.curtain, M.doorWood, M.doorMain, M.handle, M.casing, M.sill];

const state = { roof: true, walls: 'full', doorsOpen: false, night: false, mode: 'orbit' };

function setRoof(v) {
  state.roof = v;
  roof.visible = v;
  $('#roofBtn').classList.toggle('on', v);
  $('#roofBtn').setAttribute('aria-checked', String(v));
  markShadows();
}

function setWalls(mode) {
  state.walls = mode;
  walls.group.visible = mode !== 'hidden';
  for (const p of walls.pieces) {
    const { mesh, y0, y1 } = p;
    const top = mode === 'cut' ? Math.min(y1, CUT) : y1;
    mesh.visible = top - y0 > 0.001;
    if (mesh.visible) {
      mesh.scale.y = top - y0;
      mesh.position.y = (y0 + top) / 2;
    }
  }
  for (const g of walls.openingItems.children) if (g.userData.sill !== undefined) g.visible = mode !== 'cut' || g.userData.sill < CUT;
  for (const m of clipMaterials) {
    m.clippingPlanes = mode === 'cut' ? [clipPlane] : null;
    m.needsUpdate = true;
  }
  document.querySelectorAll('#wallSeg button').forEach((b) => b.classList.toggle('active', b.dataset.walls === mode));
  markShadows();
}

function setDoors(open) {
  state.doorsOpen = open;
  walls.doors.forEach((d) => (d.target = open ? 1 : 0));
  $('#doorsBtn').textContent = open ? '🚪 Cerrar todas' : '🚪 Abrir todas';
}

function toggleDoor(door) {
  door.target = door.target > 0.5 ? 0 : 1;
}

function setNight(v) {
  state.night = v;
  lighting.setNight(v);
  $('#dayBtn').textContent = v ? '☀️ Modo día' : '🌙 Modo noche';
}

// ------------------------------------------------------------------
// Cámara: transiciones suaves
// ------------------------------------------------------------------
let tween = null;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Transición orbital: interpola posición y punto de mira */
function flyTo(pos, target, duration = 1.6, onDone) {
  tween = {
    kind: 'orbit',
    t: 0,
    duration,
    p0: camera.position.clone(),
    p1: pos.clone(),
    c0: controls.target.clone(),
    c1: target.clone(),
    onDone,
  };
}

/** Transición libre: interpola posición y orientación (para primera persona y recorrido) */
function flyToPose(pos, quat, duration = 1.6, onDone) {
  tween = { kind: 'free', t: 0, duration, p0: camera.position.clone(), p1: pos.clone(), q0: camera.quaternion.clone(), q1: quat.clone(), onDone };
}

function updateTween(dt) {
  if (!tween) return false;
  tween.t = Math.min(1, tween.t + dt / tween.duration);
  const k = ease(tween.t);
  camera.position.lerpVectors(tween.p0, tween.p1, k);
  if (tween.kind === 'orbit') {
    controls.target.lerpVectors(tween.c0, tween.c1, k);
    camera.lookAt(controls.target);
  } else {
    camera.quaternion.slerpQuaternions(tween.q0, tween.q1, k);
  }
  if (tween.t >= 1) {
    const done = tween.onDone;
    tween = null;
    done?.();
  }
  return true;
}

// ------------------------------------------------------------------
// Modos: órbita, primera persona y recorrido
// ------------------------------------------------------------------
const fp = new FirstPersonController(camera, renderer.domElement, collision, {
  eyeHeight: HOUSE.eyeHeight,
  joystick: $('#joystick'),
  onInteract: () => interactNearestDoor(),
});

const tour = new Tour(camera, TOUR, {
  eyeHeight: HOUSE.eyeHeight,
  onLabel: (txt) => showRoomLabel(txt),
  onEnd: () => {
    setMode('orbit');
    controls.target.copy(CENTER);
    if (!isSmall) $('#panel').classList.remove('collapsed');
    updateViewOffset();
    toast('Recorrido finalizado');
    updateTourButtons();
  },
});

function setMode(mode) {
  state.mode = mode;
  controls.enabled = mode === 'orbit';
  fp.enabled = mode === 'fp';
  if (mode !== 'tour') tour.stop();
  $('#fpHud').classList.toggle('hidden', mode !== 'fp');
  $('#tourBar').classList.toggle('hidden', mode !== 'tour');
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === (mode === 'fp' ? 'fp' : currentView)));
  if (mode === 'orbit') {
    // re-sincroniza OrbitControls con la orientación actual de la cámara
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (!tween) controls.target.copy(camera.position).addScaledVector(dir, 6);
    if (controls.target.y < 0) controls.target.y = 0.5;
  }
  updateTourButtons();
  updateViewOffset();
}

let currentView = 'exterior';
function goView(view) {
  if (state.mode === 'tour') tour.stop();
  currentView = view;
  if (view === 'fp') return enterFirstPerson();
  setMode('orbit');
  if (!isSmall) $('#panel').classList.remove('collapsed');
  updateViewOffset();
  if (view === 'exterior') {
    setRoof(true);
    setWalls('full');
    flyTo(EXTERIOR_POS.clone(), CENTER.clone().setY(1.0), 1.8);
  } else if (view === 'aerial') {
    setRoof(false);
    setWalls('cut');
    flyTo(new THREE.Vector3(HOUSE.width / 2, 19.5, HOUSE.depth / 2 + 6.5), new THREE.Vector3(HOUSE.width / 2, 0, HOUSE.depth / 2 + 0.6), 1.8);
  }
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  hideRoomLabel();
}

function enterFirstPerson(spot) {
  if (state.mode === 'tour') tour.stop();
  controls.enabled = false;
  setWalls('full');
  setRoof(true);
  const s = spot || { x: 15.6, z: 4.9, lx: 12, lz: 4.9 };
  if (!spot) {
    const main = walls.doors.find((d) => d.id === 'principal');
    if (main) main.target = 1;
  }
  fp.enabled = false;
  fp.enter(s.x, s.z, s.lx, s.lz);
  fp.enabled = false;
  const q = fp.targetQuaternion();
  flyToPose(new THREE.Vector3(fp.pos.x, HOUSE.eyeHeight, fp.pos.z), q, 1.8, () => {
    setMode('fp');
    currentView = 'fp';
  });
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === 'fp'));
  $('#panel').classList.add('collapsed');
}

function startTour() {
  setMode('tour');
  tour.stop();
  setWalls('full');
  setRoof(true);
  setDoors(true);
  const first = TOUR[0];
  const p = new THREE.Vector3(first.p[0], first.y ?? HOUSE.eyeHeight, first.p[1]);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, new THREE.Vector3(...first.look), camera.up));
  flyToPose(p, q, 2.0, () => {
    tour.start();
    updateTourButtons();
  });
  $('#panel').classList.add('collapsed');
  updateTourButtons();
}

function togglePauseTour() {
  if (!tour.active) return;
  tour.playing ? tour.pause() : tour.resume();
  updateTourButtons();
}

function updateTourButtons() {
  const active = state.mode === 'tour';
  $('#tourPause').disabled = !tour.active;
  $('#tourRestart').disabled = !active;
  const label = tour.active && !tour.playing ? '▶ Continuar' : '⏸ Pausar';
  $('#tourPause').textContent = label;
  $('#tbPause').textContent = tour.playing ? '⏸' : '▶';
  $('#tourStart').textContent = active ? '■ Detener' : '▶ Iniciar';
}

function selectRoom(room) {
  const [x0, z0, x1, z1] = room.bounds;
  const c = new THREE.Vector3((x0 + x1) / 2, 0.6, (z0 + z1) / 2);
  showRoomLabel(room.name);
  if (state.mode === 'fp') {
    const q = new THREE.Quaternion();
    fp.enabled = false;
    fp.enter(room.spot[0], room.spot[1], room.look[0], room.look[1]);
    fp.enabled = false;
    fp.targetQuaternion(q);
    flyToPose(new THREE.Vector3(fp.pos.x, HOUSE.eyeHeight, fp.pos.z), q, 1.6, () => setMode('fp'));
    return;
  }
  if (state.mode === 'tour') setMode('orbit');
  if (!room.exterior) {
    setRoof(false);
    if (state.walls === 'full') setWalls('cut');
  }
  const size = Math.max(x1 - x0, z1 - z0);
  const pos = c.clone().add(new THREE.Vector3(-0.15 * size, size * 1.2 + 4.2, size * 0.55 + 2.6));
  flyTo(pos, c, 1.6);
  currentView = 'room';
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('#roomList .btn').forEach((b) => b.classList.toggle('active', b.dataset.room === room.id));
}

// ------------------------------------------------------------------
// Interacción con puertas
// ------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downInfo = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (tween && state.mode === 'orbit') tween = null; // el usuario toma el control
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downInfo) return;
  const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
  const dtime = performance.now() - downInfo.t;
  downInfo = null;
  if (moved > 8 || dtime > 450 || state.mode === 'tour') return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(walls.openingItems, true);
  for (const h of hits) {
    if (!h.object.visible) continue;
    if (state.walls === 'cut' && h.point.y > CUT) continue;
    const door = h.object.userData.door;
    if (door) {
      if (state.mode === 'fp' && h.distance > 4) return toast('Acércate más a la puerta');
      toggleDoor(door);
      return;
    }
    break;
  }
});

function interactNearestDoor() {
  let best = null;
  let bd = 2.2;
  for (const d of walls.doors) {
    const dist = Math.hypot(d.center.x - fp.pos.x, d.center.z - fp.pos.z);
    if (dist < bd) {
      bd = dist;
      best = d;
    }
  }
  if (best) toggleDoor(best);
  else toast('No hay ninguna puerta cerca');
}

// ------------------------------------------------------------------
// Indicadores (estancia actual, avisos)
// ------------------------------------------------------------------
let labelTimer = 0;
function showRoomLabel(txt, persist = false) {
  const el = $('#roomLabel');
  el.textContent = txt;
  el.classList.remove('hidden');
  labelTimer = persist ? Infinity : 3.2;
}
function hideRoomLabel() {
  $('#roomLabel').classList.add('hidden');
}
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}
let lastRoom = null;
function roomAt(x, z) {
  for (const r of ROOMS) {
    const [x0, z0, x1, z1] = r.bounds;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return r.name;
  }
  return 'Jardín';
}

// ------------------------------------------------------------------
// Interfaz
// ------------------------------------------------------------------
const roomList = $('#roomList');
for (const r of ROOMS) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = r.name;
  b.dataset.room = r.id;
  b.onclick = () => selectRoom(r);
  roomList.appendChild(b);
}
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => goView(b.dataset.view)));
$('#tourStart').onclick = () => (state.mode === 'tour' ? goView('exterior') : startTour());
$('#tourPause').onclick = togglePauseTour;
$('#tourRestart').onclick = startTour;
$('#tbPause').onclick = togglePauseTour;
$('#tbRestart').onclick = startTour;
$('#tbExit').onclick = () => goView('exterior');
$('#roofBtn').onclick = () => setRoof(!state.roof);
document.querySelectorAll('#wallSeg button').forEach((b) => (b.onclick = () => setWalls(b.dataset.walls)));
$('#doorsBtn').onclick = () => setDoors(!state.doorsOpen);
$('#dayBtn').onclick = () => setNight(!state.night);
$('#menuBtn').onclick = () => {
  $('#panel').classList.toggle('collapsed');
  updateViewOffset();
};
$('#helpBtn').onclick = () => $('#help').classList.remove('hidden');
$('#helpClose').onclick = () => $('#help').classList.add('hidden');
$('#help').onclick = (e) => e.target.id === 'help' && $('#help').classList.add('hidden');
$('#fpDoor').onclick = () => interactNearestDoor();
$('#fpExit').onclick = () => goView('exterior');
$('#fsBtn').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
};
if (isSmall) $('#panel').classList.add('collapsed');

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  switch (e.code) {
    case 'Escape':
      if (!$('#help').classList.contains('hidden')) $('#help').classList.add('hidden');
      else if (state.mode !== 'orbit') goView('exterior');
      break;
    case 'Space':
      if (state.mode === 'tour') {
        e.preventDefault();
        togglePauseTour();
      }
      break;
    case 'KeyT':
      startTour();
      break;
    case 'KeyR':
      setRoof(!state.roof);
      break;
    case 'KeyP':
      setWalls({ full: 'cut', cut: 'hidden', hidden: 'full' }[state.walls]);
      break;
    case 'KeyN':
      setNight(!state.night);
      break;
    case 'KeyO':
      if (state.mode !== 'fp') setDoors(!state.doorsOpen);
      break;
  }
});

/** Desplaza el encuadre para que el panel lateral no tape la vivienda (escritorio) */
function updateViewOffset() {
  camera.aspect = innerWidth / innerHeight;
  const panelOpen = !$('#panel').classList.contains('collapsed') && innerWidth > 760;
  if (panelOpen && state.mode === 'orbit') camera.setViewOffset(innerWidth, innerHeight, -160, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  updateViewOffset();
});
$('#panel').addEventListener('transitionend', updateViewOffset);

// ------------------------------------------------------------------
// Bucle principal
// ------------------------------------------------------------------
const clock = new THREE.Clock();
lighting.update(0, renderer, true);
camera.position.set(-22, 18, 34);
controls.update();
updateViewOffset();
flyTo(EXTERIOR_POS.clone(), CENTER.clone().setY(1.0), 2.6);

function animate() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05); // física y paseo
  const dtA = Math.min(raw, 0.25); // animaciones temporizadas (no se ralentizan si bajan los FPS)

  // puertas
  let doorsMoving = false;
  for (const d of walls.doors) {
    if (d.progress !== d.target) {
      const step = dtA / 0.9;
      d.progress = d.target > d.progress ? Math.min(d.target, d.progress + step) : Math.max(d.target, d.progress - step);
      d.apply();
      doorsMoving = true;
    }
  }
  if (doorsMoving) markShadows();
  if (lighting.update(dtA, renderer)) markShadows();

  const tweening = updateTween(dtA);
  if (!tweening) {
    if (state.mode === 'orbit') controls.update();
    else if (state.mode === 'fp') fp.update(dt);
    else if (state.mode === 'tour') {
      tour.update(dtA);
      $('#tourProgress').style.width = `${(tour.progress * 100).toFixed(1)}%`;
    }
  }

  // estancia actual en primera persona
  if (state.mode === 'fp' && !tweening) {
    const r = roomAt(camera.position.x, camera.position.z);
    if (r !== lastRoom) {
      lastRoom = r;
      showRoomLabel(r);
    }
  } else lastRoom = null;
  if (labelTimer !== Infinity && labelTimer > 0) {
    labelTimer -= dt;
    if (labelTimer <= 0) hideRoomLabel();
  }

  if (shadowsDirty > 0) {
    renderer.shadowMap.needsUpdate = true;
    shadowsDirty--;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(() => {
  animate();
  setTimeout(() => $('#loader').classList.add('done'), 250);
});

// Exponer para depuración en consola
window.__casa = { rooms: ROOMS, controls, scene, camera, renderer, state, setWalls, setRoof, setNight, setDoors, startTour, goView, selectRoom, tour, fp, walls, collision };
