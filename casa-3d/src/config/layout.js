/**
 * DISTRIBUCIÓN DE LA VIVIENDA
 * ---------------------------------------------------------------
 * Todas las medidas están en METROS (1 unidad Three.js = 1 m).
 * Sistema de coordenadas en planta:
 *   eje X → de Oeste (0) a Este (13)
 *   eje Z → de Norte (0) a Sur (10)
 *   eje Y → altura (suelo terminado = 0)
 *
 * Para modificar la distribución basta con editar este archivo:
 *  - ROOMS:     límites de cada estancia, tipo de suelo y punto de vista.
 *  - WALLS:     muros (inicio, fin, espesor) y sus huecos (puertas/ventanas).
 *  - FURNITURE: mobiliario (tipo, posición, rotación y opciones).
 *  - LIGHTS:    luminarias interiores (se encienden en modo noche).
 *  - TOUR:      puntos del recorrido virtual automático.
 */

export const HOUSE = {
  width: 13, // X
  depth: 10, // Z
  wallHeight: 2.7,
  extWall: 0.2,
  intWall: 0.1,
  doorHeight: 2.1,
  eyeHeight: 1.6,
};

/** Estancias: x0,z0,x1,z1 en planta. floor: 'wood' | 'tile' | 'stone' */
export const ROOMS = [
  { id: 'sala', name: 'Sala', bounds: [0, 4.2, 6.5, 10], floor: 'wood', spot: [4.6, 6.2], look: [1, 7.6] },
  { id: 'comedor', name: 'Comedor', bounds: [0, 0, 4.5, 4.2], floor: 'wood', spot: [3.8, 3.6], look: [1.8, 1.6] },
  { id: 'cocina', name: 'Cocina', bounds: [4.5, 0, 8.5, 4.2], floor: 'tile', spot: [5.0, 3.6], look: [7.4, 0.6] },
  { id: 'dorm2', name: 'Dormitorio 2', bounds: [8.5, 0, 13, 4.2], floor: 'wood', spot: [9.6, 3.5], look: [12.2, 1.6] },
  { id: 'pasillo', name: 'Pasillo y recibidor', bounds: [6.5, 4.2, 13, 5.6], floor: 'wood', spot: [12.2, 4.9], look: [7, 4.9] },
  { id: 'bano', name: 'Baño', bounds: [6.5, 5.6, 9, 10], floor: 'tile', spot: [7.6, 6.3], look: [7.8, 9.4] },
  { id: 'dorm1', name: 'Dormitorio principal', bounds: [9, 5.6, 13, 10], floor: 'wood', spot: [9.9, 6.4], look: [12.4, 8.6] },
  { id: 'terraza', name: 'Terraza', bounds: [0, 10.1, 6.5, 12.6], floor: 'deck', exterior: true, spot: [5.6, 10.8], look: [1.5, 12] },
];

/**
 * Muros. Todos son ortogonales (horizontales en X o verticales en Z).
 * openings: { at: distancia desde el inicio del muro al inicio del hueco,
 *             w: ancho, type: 'door' | 'window' | 'opening' | 'slider',
 *             sill: altura de antepecho (ventanas), h: altura del hueco,
 *             swing: +1/-1 lado hacia el que abre la puerta (normal del muro),
 *             hinge: 'start' | 'end', curtains: true, main: true }
 */
const E = HOUSE.extWall;
const I = HOUSE.intWall;
export const WALLS = [
  // ---- Fachadas ----
  {
    id: 'norte', from: [0, 0], to: [13, 0], t: E, exterior: true,
    openings: [
      { at: 1.3, w: 2.0, type: 'window', sill: 0.9, h: 1.3, curtains: true },
      { at: 5.8, w: 1.4, type: 'window', sill: 1.1, h: 1.0 },
      { at: 10.0, w: 1.8, type: 'window', sill: 0.9, h: 1.3, curtains: true },
    ],
  },
  {
    id: 'sur', from: [0, 10], to: [13, 10], t: E, exterior: true,
    openings: [
      { at: 1.0, w: 2.6, type: 'slider', h: 2.2, id: 'corredera' },
      { at: 4.3, w: 1.5, type: 'window', sill: 0.6, h: 1.6, curtains: true },
      { at: 7.4, w: 0.8, type: 'window', sill: 1.6, h: 0.6 },
      { at: 10.2, w: 2.0, type: 'window', sill: 0.9, h: 1.3, curtains: true },
    ],
  },
  {
    id: 'oeste', from: [0, 0], to: [0, 10], t: E, exterior: true,
    openings: [{ at: 5.4, w: 3.2, type: 'window', sill: 0.5, h: 1.8, curtains: true }],
  },
  {
    id: 'este', from: [13, 0], to: [13, 10], t: E, exterior: true,
    openings: [{ at: 4.4, w: 1.0, type: 'door', h: 2.1, swing: -1, hinge: 'start', main: true, id: 'principal' }],
  },
  // ---- Tabiques interiores ----
  {
    id: 'cocina-sur', from: [4.5, 4.2], to: [13, 4.2], t: I,
    openings: [
      { at: 0.5, w: 1.3, type: 'opening', h: 2.1 },
      { at: 4.5, w: 0.9, type: 'door', h: 2.1, swing: -1, hinge: 'start', id: 'dorm2' },
    ],
  },
  { id: 'comedor-cocina', from: [4.5, 0], to: [4.5, 4.2], t: I, openings: [{ at: 1.2, w: 1.8, type: 'opening', h: 2.1 }] },
  { id: 'cocina-dorm2', from: [8.5, 0], to: [8.5, 4.2], t: I, openings: [] },
  {
    id: 'pasillo-sur', from: [6.5, 5.6], to: [13, 5.6], t: I,
    openings: [
      { at: 0.4, w: 0.8, type: 'door', h: 2.1, swing: 1, hinge: 'start', id: 'bano' },
      { at: 2.9, w: 0.9, type: 'door', h: 2.1, swing: 1, hinge: 'start', id: 'dorm1' },
    ],
  },
  { id: 'sala-bano', from: [6.5, 5.6], to: [6.5, 10], t: I, openings: [] },
  { id: 'bano-dorm1', from: [9, 5.6], to: [9, 10], t: I, openings: [] },
];

/**
 * Mobiliario. type → función constructora en builders/furniture.js
 * pos: [x, z] (centro en planta), rot: giro en grados alrededor de Y
 * (0° = el frente del mueble mira hacia +Z / sur).
 */
export const FURNITURE = [
  // ---------------- SALA ----------------
  { type: 'rug', pos: [2.6, 7.4], size: [3.2, 2.6], color: 0xc9c2b6 },
  { type: 'sofa', pos: [1.0, 7.4], rot: 90, width: 2.3 },
  { type: 'coffeeTable', pos: [2.75, 7.4], rot: 90 },
  { type: 'armchair', pos: [3.9, 5.5], rot: -30 },
  { type: 'sideTable', pos: [0.75, 5.85], lamp: true },
  { type: 'sideTable', pos: [0.75, 8.95] },
  { type: 'tvStand', pos: [6.22, 7.4], rot: -90 },
  { type: 'tv', pos: [6.42, 7.4], rot: -90, y: 1.35 },
  { type: 'floorLamp', pos: [5.9, 9.55] },
  { type: 'plant', pos: [0.45, 9.55], scale: 1.2 },
  // ---------------- COMEDOR ----------------
  { type: 'diningSet', pos: [2.2, 2.1] },
  { type: 'sideboard', pos: [0.32, 2.1], rot: 90 },
  { type: 'plant', pos: [0.45, 0.45] },
  { type: 'plant', pos: [4.05, 0.45], scale: 0.8 },
  { type: 'wallArt', pos: [0.11, 2.1], rot: 90, y: 1.65 },
  // ---------------- COCINA ----------------
  { type: 'kitchenRun', pos: [6.15, 0.41], length: 3.1 },
  { type: 'fridge', pos: [8.1, 0.45] },
  { type: 'island', pos: [6.3, 2.5] },
  { type: 'stool', pos: [5.7, 3.25] },
  { type: 'stool', pos: [6.3, 3.25] },
  { type: 'stool', pos: [6.9, 3.25] },
  // ---------------- DORMITORIO 2 ----------------
  { type: 'rug', pos: [11.3, 2.1], size: [2.4, 2.2], color: 0xb9b0a3 },
  { type: 'bed', pos: [11.9, 2.1], rot: -90, width: 1.4, color: 0x8fa3a6 },
  { type: 'nightstand', pos: [12.7, 1.05], rot: -90 },
  { type: 'nightstand', pos: [12.7, 3.15], rot: -90, noLamp: true },
  { type: 'wardrobe', pos: [8.86, 1.25], rot: 90, width: 1.8 },
  { type: 'desk', pos: [10.3, 0.42] },
  { type: 'plant', pos: [12.6, 3.85], scale: 0.8 },
  // ---------------- PASILLO ----------------
  { type: 'console', pos: [7.6, 4.42] },
  { type: 'plant', pos: [12.65, 5.32], scale: 0.9 },
  { type: 'wallArt', pos: [10.6, 4.27], y: 1.6, w: 1.0 },
  // ---------------- BAÑO ----------------
  { type: 'shower', pos: [7.75, 9.32] },
  { type: 'vanity', pos: [6.8, 7.4], rot: 90 },
  { type: 'toilet', pos: [8.7, 7.3], rot: -90 },
  { type: 'towelRack', pos: [8.93, 6.3], rot: -90 },
  // ---------------- DORMITORIO PRINCIPAL ----------------
  { type: 'rug', pos: [11.4, 7.8], size: [2.8, 2.6], color: 0xc4bcb0 },
  { type: 'bed', pos: [11.9, 7.8], rot: -90, width: 1.6, color: 0xb8a48c },
  { type: 'nightstand', pos: [12.72, 6.55], rot: -90 },
  { type: 'nightstand', pos: [12.72, 9.05], rot: -90 },
  { type: 'wardrobe', pos: [9.36, 8.5], rot: 90, width: 2.2 },
  { type: 'bench', pos: [10.55, 7.8], rot: 90 },
  { type: 'plant', pos: [12.6, 9.6] },
  { type: 'wallArt', pos: [12.89, 7.8], rot: -90, y: 1.75, w: 1.2 },
  // ---------------- TERRAZA ----------------
  { type: 'outdoorTable', pos: [1.3, 11.45] },
  { type: 'lounger', pos: [4.5, 11.55], rot: 0 },
  { type: 'lounger', pos: [5.5, 11.55], rot: 0 },
  { type: 'planter', pos: [0.35, 12.35] },
  { type: 'planter', pos: [6.15, 12.35] },
];

/** Luminarias interiores: [x, z], intensidad relativa */
export const LIGHTS = [
  { room: 'sala', pos: [2.8, 7.4], power: 1.2 },
  { room: 'sala', pos: [4.8, 5.4], power: 0.7 },
  { room: 'comedor', pos: [2.2, 2.1], power: 1.0, pendant: true },
  { room: 'cocina', pos: [6.4, 2.0], power: 1.1 },
  { room: 'dorm2', pos: [10.8, 2.1], power: 0.9 },
  { room: 'pasillo', pos: [9.8, 4.9], power: 0.6 },
  { room: 'bano', pos: [7.75, 7.6], power: 0.8 },
  { room: 'dorm1', pos: [11.0, 7.8], power: 1.0 },
  { room: 'terraza', pos: [3.2, 11.4], power: 0.8, exterior: true },
];

/**
 * Recorrido virtual: posiciones de cámara [x, z] a altura de ojos
 * y punto observado [x, y, z]. 'stop' añade segundos de pausa.
 */
export const TOUR = [
  { p: [19, 5.0], y: 1.75, look: [13, 1.4, 4.9], label: 'Llegada a la vivienda' },
  { p: [15.2, 4.9], look: [12, 1.5, 4.9] },
  { p: [12.3, 4.9], look: [9.85, 1.4, 6.5], label: 'Recibidor', stop: 0.6 },
  { p: [9.85, 5.0], look: [9.85, 1.4, 7.5] },
  { p: [9.85, 6.4], look: [12.5, 0.9, 7.8], label: 'Dormitorio principal' },
  { p: [10.2, 9.2], look: [12.4, 0.8, 7.6], stop: 0.8 },
  { p: [12.0, 9.5], look: [9.4, 1.2, 8.4] },
  { p: [10.3, 6.3], look: [9.85, 1.4, 4.0] },
  { p: [9.85, 4.9], look: [7.3, 1.4, 4.9] },
  { p: [7.6, 4.9], look: [7.3, 1.0, 8.0], label: 'Baño' },
  { p: [7.3, 6.4], look: [7.9, 1.0, 9.4], stop: 0.8 },
  { p: [7.4, 5.1], look: [9.45, 1.4, 3.6] },
  { p: [9.0, 4.9], look: [9.45, 1.4, 3.0] },
  { p: [9.45, 3.7], look: [12.2, 0.9, 2.1], label: 'Dormitorio 2' },
  { p: [10.2, 2.9], look: [12.5, 0.8, 2.0], stop: 0.6 },
  { p: [11.4, 3.5], look: [8.9, 1.3, 1.0] },
  { p: [9.45, 3.7], look: [9.45, 1.4, 5.5] },
  { p: [9.3, 4.9], look: [6.0, 1.4, 5.0] },
  { p: [6.2, 4.95], look: [2.5, 1.0, 7.4], label: 'Sala' },
  { p: [4.9, 6.2], look: [6.4, 1.3, 7.4] },
  { p: [4.8, 8.9], look: [1.0, 0.9, 7.4], stop: 0.6 },
  { p: [3.6, 5.0], look: [2.2, 0.8, 2.1], label: 'Comedor' },
  { p: [3.9, 2.1], look: [7.0, 1.0, 1.2] },
  { p: [4.9, 1.9], look: [7.0, 0.9, 0.4], label: 'Cocina' },
  { p: [6.4, 1.45], look: [8.1, 1.1, 0.5], stop: 0.6 },
  { p: [7.0, 1.6], look: [7.2, 0.9, 3.4] },
  { p: [7.85, 3.3], look: [5.4, 1.1, 3.8] },
  { p: [5.65, 3.75], look: [5.65, 1.3, 6.0] },
  { p: [5.65, 5.2], look: [2.3, 1.2, 10.5] },
  { p: [3.4, 8.9], look: [2.3, 1.2, 12] },
  { p: [2.3, 10.0], look: [3.5, 1.0, 12.0], label: 'Terraza y jardín' },
  { p: [3.2, 11.0], look: [-4, 1.0, 13], stop: 0.6 },
  { p: [-2, 12.5], y: 3.5, look: [4, 0.5, 8] },
  { p: [-7, 19], y: 10, look: [6.5, 0, 5], label: 'Vista general' },
];
