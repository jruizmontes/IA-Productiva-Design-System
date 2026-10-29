# Casa Moderna 3D — Simulación arquitectónica interactiva

Una vivienda contemporánea de una planta (13 × 10 m, unos 130 m² construidos) modelada **íntegramente con código** en Three.js.
Puedes recorrerla en 3D, entrar a cada estancia, abrir las puertas, pasar del día a la noche y activar una visita guiada automática.

## Programa arquitectónico

| Estancia | Superficie aprox. | Elementos principales |
|---|---|---|
| Sala | 6,5 × 5,8 m | Sofá de 3 plazas, sillón, mesa de centro, mueble de TV, televisor, alfombra, lámparas, ventanal y corredera a la terraza |
| Comedor | 4,5 × 4,2 m | Mesa para 4 con sillas, aparador, lámpara colgante y ventana |
| Cocina | 4,0 × 4,2 m | Muebles bajos y altos, encimera, fregadero, placa, horno, campana, nevera, isla con 3 taburetes |
| Dormitorio principal | 4,0 × 4,4 m | Cama de 1,60 m, mesitas con lámparas, armario de 2,2 m, banco, ventana con cortinas |
| Dormitorio 2 | 4,5 × 4,2 m | Cama de 1,40 m, mesitas, armario, escritorio con silla, ventana |
| Baño completo | 2,5 × 4,4 m | Ducha de obra con mampara, lavabo suspendido con espejo, inodoro, toallero, ventana alta |
| Pasillo / recibidor | 6,5 × 1,4 m | Puerta principal, consola, cuadro y planta |
| Exterior | — | Terraza de madera con pérgola, tumbonas y mesa; jardín con árboles, setos, flores, camino de losas y valla |

Medidas reales: muros exteriores de 20 cm, tabiques de 10 cm, altura libre de 2,70 m, puertas de 0,80–1,00 × 2,10 m y antepechos de ventana entre 0,5 y 1,6 m.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (incluye `npm`).
- Un navegador moderno con WebGL 2 (Chrome, Edge, Firefox, Safari).

## Instalación y ejecución

```bash
# 1. Entra en la carpeta del proyecto
cd casa-3d

# 2. Instala las dependencias (Three.js y Vite)
npm install

# 3. Arranca el servidor de desarrollo
npm run dev
```

Abre en el navegador la dirección que muestra la terminal (normalmente **http://localhost:5173**).
Como el servidor se inicia con `--host`, también aparece una dirección de red (por ejemplo `http://192.168.1.20:5173`) para abrirla **desde el teléfono** conectado a la misma red Wi‑Fi.

### Versión de producción (opcional)

```bash
npm run build     # genera la carpeta dist/
npm run preview   # sirve dist/ en http://localhost:4173
```

La carpeta `dist/` usa rutas relativas, así que puede publicarse en cualquier hosting estático (GitHub Pages, Netlify, etc.).

> No abras `index.html` con doble clic (`file://`): los módulos ES requieren un servidor local, por eso se usa Vite.

## Controles

| Acción | Ratón / teclado | Táctil |
|---|---|---|
| Girar 360° | Arrastrar con botón izquierdo | Arrastrar con un dedo |
| Zoom | Rueda | Pellizcar |
| Desplazar | Botón derecho o Mayús + arrastrar | Arrastrar con dos dedos |
| Abrir / cerrar una puerta | Clic sobre la puerta | Tocar la puerta |
| Caminar (primera persona) | W A S D o flechas · Mayús para correr | Joystick virtual |
| Mirar (primera persona) | Arrastrar el ratón | Arrastrar el dedo |
| Puerta más cercana (primera persona) | E | Botón 🚪 |

Atajos: **T** recorrido · **Espacio** pausa/continúa · **R** techo · **P** paredes (completas → recortadas → ocultas) · **N** día/noche · **O** puertas · **Esc** volver a la vista exterior.

## Funciones

1. Rotación 360°, zoom y desplazamiento con `OrbitControls` (amortiguados).
2. **Recorrido virtual automático** por todas las estancias (curva Catmull‑Rom, pausas en puntos de interés) con botones *Pausar / Continuar / Reiniciar* y barra de progreso.
3. **Primera persona** con colisiones contra muros, muebles y puertas cerradas.
4. **Selección de habitación** con desplazamiento suave de cámara.
5. **Vista aérea** de la distribución.
6. **Techo** visible u oculto; **paredes** completas, recortadas (a 1,15 m, como una maqueta) u ocultas.
7. **Puertas animadas** (abatibles y corredera), individualmente o todas a la vez.
8. **Día / noche**: el sol, el cielo, la luz ambiental y las luminarias interiores cambian de forma progresiva.

## Estructura del código

```
casa-3d/
├── index.html                 Interfaz (HTML) en español
├── src/
│   ├── main.js                Escena, cámara, modos de navegación e interfaz
│   ├── styles.css             Estilos de la interfaz (adaptada a móvil)
│   ├── config/layout.js       ★ DISTRIBUCIÓN: estancias, muros, huecos, muebles, luces y recorrido
│   ├── builders/
│   │   ├── materials.js       Materiales y texturas procedurales (madera, baldosa, césped…)
│   │   ├── walls.js           Muros con huecos, ventanas, cortinas, puertas y corredera
│   │   ├── furniture.js       Catálogo de muebles creados con primitivas
│   │   └── environment.js     Suelos, terraza, jardín, cubierta, pérgola y luminarias
│   └── systems/
│       ├── lighting.js        Sol, cielo, luz ambiental y transición día/noche
│       ├── collision.js       Colisiones 2D (círculo contra cajas)
│       ├── firstPerson.js     Paseo en primera persona (teclado, ratón, joystick)
│       └── tour.js            Recorrido automático
└── vite.config.js
```

### Cómo modificar la distribución

Todo se define en `src/config/layout.js` (1 unidad = 1 metro; X de oeste a este, Z de norte a sur):

- **Mover un tabique o abrir un hueco**: edita `WALLS`. Cada hueco indica `at` (distancia desde el inicio del muro), `w` (ancho), `type` (`door`, `window`, `slider`, `opening`), `sill` y `h`.
- **Añadir un mueble**: agrega una entrada a `FURNITURE` con un `type` del catálogo (`sofa`, `bed`, `wardrobe`, `plant`, `diningSet`…), `pos: [x, z]` y `rot` en grados.
- **Cambiar estancias**: ajusta `ROOMS` (límites, tipo de suelo y punto de vista en primera persona).
- **Editar el recorrido**: modifica los puntos de `TOUR` (posición, punto observado, etiqueta y pausa).

Las colisiones se recalculan automáticamente a partir de muros y muebles.

## Rendimiento

- Las mallas estáticas que comparten material se **fusionan** en una sola geometría (de ~1500 a ~300 llamadas de dibujo).
- Geometrías y materiales compartidos; texturas generadas en `<canvas>` (sin descargas).
- Mapa de sombras **bajo demanda**: sólo se recalcula cuando algo cambia (puertas, luz, paredes).
- En móviles se limita la resolución (pixel ratio 1,5) y el mapa de sombras (1024 px).
