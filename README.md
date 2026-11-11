# AR POOL 8 — Realistic Mixed Reality Billiards

Videojuego de pool americano de 8 bolas hecho con **A-Frame 1.6 + Three.js + WebXR**.

## Estado

| Parte | Estado |
|---|---|
| Mesa 3D realista, 16 bolas, taco y cámara | ✅ Lista |
| Física: colisiones, bandas, troneras, fricción, efecto | ✅ Lista |
| Reglas completas de 8 bolas y bot (fácil / normal / difícil) | Pendiente |
| Servidor Node.js + Socket.IO, salas y multijugador online | Pendiente |
| WebXR AR: hit-test, colocar la mesa, controles XR | ◐ Colocación AR y vista con cámara listas; faltan controladores de gafas |
| Pulido gráfico, sonido espacial y optimización | Pendiente |

> **Ya se puede jugar**: el taco golpea la blanca y la física mueve las 16 bolas (choques, bandas,
> troneras, fricción del paño y efecto). La blanca embocada vuelve a la cabecera.
> Las reglas completas de 8 bolas, el bot y el multijugador llegan en próximas versiones.

## Escanear marcador (modo principal, funciona en iPhone y Android)

1. Abre `marcador.html` en un computador (o imprímelo) para tener el **marcador Hiro**.
2. En el celular entra a **ESCANEAR MARCADOR** (`ar-marcador.html`) y acepta la cámara.
3. Apunta al marcador: la mesa aparece encima y se queda pegada a él. Puedes caminar alrededor.
4. El taco apunta desde donde está el celular hacia la blanca; ◀ ▶ hacen el ajuste fino; − / + cambian el tamaño.

Usa **AR.js 3.4.8** (`vendor/arjs/`, licencia MIT) para seguir el marcador con la cámara.

## Realidad aumentada: qué funciona en cada teléfono

| Dispositivo | Botón ◎ | Qué hace |
|---|---|
| Android con Chrome (ARCore) | **Ver en AR** | **AR real WebXR**: detecta el suelo, aparece un aro verde, tocas la pantalla y la mesa queda anclada a escala real. Puedes caminar alrededor. |
| Meta Quest / gafas con WebXR | **Ver en AR** | Igual que Android (passthrough). |
| iPhone / iPad (Safari o Chrome) | **Cámara** | **Vista con cámara**: la cámara trasera es el fondo y el giroscopio mueve la vista. La mesa se queda en su sitio al **girar** el teléfono, pero **no** se ancla al suelo ni sigue tus pasos, porque Apple no ofrece WebXR en el navegador. |

En AR y en la vista con cámara **el taco apunta desde donde estás tú hacia la bola blanca** (como en un billar
real: te paras detrás de la bola). Con ◀ ▶ haces el ajuste fino. Los botones *Mover mesa*, *Escala* (100 %, 50 %, 25 %)
y *Salir* aparecen a la izquierda.

---

## 1. Cómo abrirlo en tu computador

El juego no necesita instalar nada: A-Frame va incluido en `vendor/aframe.min.js`.

**Opción A — Visual Studio Code (la más fácil)**
1. Abre la carpeta `ar-pool-8` en VS Code.
2. Instala la extensión **Live Server** (de Ritwick Dey).
3. Clic derecho sobre `index.html` → **Open with Live Server**.
4. Se abre el navegador con la pantalla de bienvenida → **MESA DE PRÁCTICA**.

**Opción B — Terminal (si tienes Node.js)**
```bash
cd ar-pool-8
npm start          # abre http://localhost:8080
```

## 2. Cómo probarlo en el celular (HTTPS)

WebXR y varias funciones del navegador **solo funcionan con HTTPS**. La forma más simple es GitHub Pages:

1. Crea un repositorio nuevo en GitHub (por ejemplo `ar-pool-8`).
2. Sube **todo el contenido** de la carpeta (incluida `vendor/`).
3. En el repositorio: **Settings → Pages → Branch: main → / (root) → Save**.
4. Espera 1–2 minutos y abre `https://TU-USUARIO.github.io/ar-pool-8/` en el celular.

GitHub Pages sirve para el **frontend**. El servidor multijugador necesitará
otro servicio que admita WebSockets permanentes (por ejemplo Render o Railway).

## 3. Controles

| Acción | Computador | Celular |
|---|---|
| Girar la cámara | Arrastrar con el ratón (vista libre) | Arrastrar con un dedo |
| Zoom | Rueda del ratón | Pellizcar con dos dedos |
| Girar el taco | ← → o A / D (Shift = fino) · arrastrar en vista Tiro/Superior | Botones ◀ ▶ |
| Apuntar a un punto | Clic sobre el paño | Tocar el paño |
| Cargar fuerza y golpear | Mantener **ESPACIO** y soltar | Mantener **GOLPEAR** y soltar |
| Cambiar cámara | C, o 1 / 2 / 3 | Botón 🎥 |
| Ver una bola | Clic sobre la bola | Tocar la bola |
| Línea guía | G | Botón ⟶ |
| Ayuda | H | Botón ? |

Cámaras: **Libre** (orbita la mesa), **Tiro** (cámara de asistencia detrás del taco) y **Superior** (vista cenital).

## 4. Lista de verificación

- [ ] La pantalla de bienvenida muestra **AR POOL 8**, el nombre se guarda al recargar.
- [ ] La mesa tiene paño verde, madera con vetas, 6 troneras con fondo, diamantes y patas torneadas.
- [ ] Hay 16 bolas: la 1 en el vértice, la 8 en el centro, rayadas con franja, números legibles.
- [ ] El taco gira alrededor de la blanca y la línea guía cambia; la bola fantasma marca el primer contacto.
- [ ] Al mantener ESPACIO el taco retrocede y la barra de fuerza sube; al soltar avanza, golpea y las bolas se mueven.
- [ ] Las bolas chocan, rebotan en las bandas, caen en las troneras y se detienen; luego el taco vuelve.
- [ ] El botón △ vuelve a armar el triángulo.
- [ ] El contador **Golpes** aumenta y sigue igual después de recargar (LocalStorage).
- [ ] Las tres cámaras funcionan; la calidad Baja/Media/Alta cambia sombras y nitidez.
- [ ] El chip inferior izquierdo dice honestamente si el dispositivo tiene WebXR AR.

**Pruebas automáticas**:
```bash
node tests/etapa1.test.js      # 18 pruebas: medidas, triángulo y puntería
node tests/etapa2.test.js      # 15 pruebas: fricción, choques, bandas, troneras, saque reproducible
```

## 5. Estructura del proyecto

```
ar-pool-8/
├── index.html               Pantalla de bienvenida y selección de modo
├── ar-marcador.html         AR con marcador Hiro (AR.js): la mesa se pega al marcador
├── marcador.html            Marcador Hiro para abrir en otra pantalla o imprimir
├── ar-experiencia.html      Escena A-Frame (<a-scene>, <a-entity>, cámara, luces, interfaz)
├── css/estilos.css          Paneles holográficos semitransparentes
├── js/
│   ├── ar-app.js            Aplicación: controles, raycaster, LocalStorage, detección WebXR
│   ├── core/                Lógica sin dependencia de A-Frame (se prueba con Node)
│   │   ├── config.js        Medidas reales: mesa de 9 pies, bolas de 57.15 mm, taco de 147 cm
│   │   ├── rack.js          Armado del triángulo según reglamento WPA
│   │   ├── aim.js           Línea guía y cálculo del primer contacto
│   │   ├── geometria-mesa.js Bandas y troneras compartidas por el dibujo y la física
│   │   └── textures.js      Texturas procedurales (fieltro, madera, bolas) y mapa de entorno PBR
│   ├── fisica/motor.js      Motor de física de paso fijo (1/500 s), reproducible
│   └── components/          Componentes A-Frame (Entity-Component-System)
│       ├── mesa-billar.js   Mesa completa: paño, bandas, baranda, troneras, gabinete, patas
│       ├── bola-billar.js   bola-billar + triangulo-bolas
│       ├── taco-billar.js   Taco 3D, retroceso, golpe, guía y bola fantasma
│       ├── camara-orbita.js Cámaras libre / tiro / superior con ratón y táctil
│       ├── escena-realista.js  Tono ACES, reflejos, calidad gráfica y lámpara
│       ├── fisica-mesa.js   Conecta la física con las bolas, caídas y sonidos
│       ├── sonido-billar.js Sonidos sintetizados con audio espacial
│       └── modo-ar.js       AR WebXR con hit-test y vista con cámara (iPhone)
├── tests/                   Pruebas automáticas (etapa1, etapa2)
└── vendor/aframe.min.js     A-Frame 1.6.0 (MIT)
```
Más adelante se agregan `js/reglas/`, `js/ia/`, `js/red/` y `servidor/`.

## 6. Requisitos de la clase y dónde están

| Requisito | Dónde |
|---|---|
| `<a-scene>` y `<a-entity>` | `ar-experiencia.html` |
| Entity-Component-System | `js/components/*.js` (`AFRAME.registerComponent`) |
| Posicionamiento y escala 3D | Mesa a 0.76 m, bolas de 57.15 mm, `#mesa-raiz` listo para AR |
| Cámara virtual | `#camara` con `camara-orbita` (3 modos) |
| Raycaster y cursor | `<a-scene cursor raycaster="objects: .interactivo">` |
| Eventos de interacción | clic en bolas y paño, `taco-golpe`, `taco-angulo`, `camara-modo` |
| Animaciones | `animation__intro` de la mesa, anillo de selección, golpe del taco, transición de cámara |
| Panel de controles | HUD: marcador, fuerza, dirección, botones |
| LocalStorage | nombre, preferencias y estadísticas (`arpool8.*`) |
| HTTPS | Despliegue en GitHub Pages (sección 2) |

## 7. Si algo falla

- **Pantalla negra o "loading" infinito:** revisa que la carpeta `vendor/` se haya subido. En el navegador, pulsa F12 → pestaña *Console* y busca la línea roja: dice el archivo y la línea.
- **Se ve todo muy lento:** en el juego pulsa ✦ hasta **Baja**.
- **"AR requiere HTTPS":** estás abriendo el archivo directo o por `http://`. Usa GitHub Pages.
- **iPhone y la cámara no abre:** acepta los dos permisos (cámara y "movimiento y orientación"). Si los negaste, ve a Ajustes → Safari (o Chrome) → Cámara / Movimiento, o borra los datos del sitio y vuelve a entrar.
- **iPhone:** no tiene WebXR AR. La vista con cámara funciona, pero la mesa no se ancla al suelo; el juego lo dice en pantalla.

## Licencias
Código del proyecto: MIT. A-Frame: MIT. Todas las texturas y modelos se generan por código (no hay recursos de terceros).
