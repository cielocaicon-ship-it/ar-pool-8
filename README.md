# AR POOL 8 — Realistic Mixed Reality Billiards

Videojuego de pool americano de 8 bolas hecho con **A-Frame 1.6 + Three.js + WebXR**.
Se desarrolla en 6 etapas; cada una se puede probar sola y no rompe las anteriores.

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Mesa 3D realista, 16 bolas, taco y cámara | ✅ **Terminada** |
| 2 | Física: colisiones, bandas, troneras, fricción, efecto | Pendiente |
| 3 | Reglas completas de 8 bolas y bot (fácil / normal / difícil) | Pendiente |
| 4 | Servidor Node.js + Socket.IO, salas y multijugador online | Pendiente |
| 5 | WebXR AR: hit-test, colocar la mesa, controles XR | Pendiente |
| 6 | Pulido gráfico, sonido espacial y optimización | Pendiente |

> En la Etapa 1 el taco apunta, carga fuerza y **golpea** la blanca (registra dirección y fuerza),
> pero las bolas todavía **no se mueven**: eso lo hace el motor de física de la Etapa 2.
> Los botones "Jugar contra IA" y "Multijugador online" aparecen desactivados con su etapa.

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

GitHub Pages sirve para el **frontend**. El servidor multijugador de la Etapa 4 necesitará
otro servicio que admita WebSockets permanentes (por ejemplo Render o Railway).

## 3. Controles

| Acción | Computador | Celular |
|---|---|---|
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

## 4. Lista de verificación de la Etapa 1

- [ ] La pantalla de bienvenida muestra **AR POOL 8**, el nombre se guarda al recargar.
- [ ] La mesa tiene paño verde, madera con vetas, 6 troneras con fondo, diamantes y patas torneadas.
- [ ] Hay 16 bolas: la 1 en el vértice, la 8 en el centro, rayadas con franja, números legibles.
- [ ] El taco gira alrededor de la blanca y la línea guía cambia; la bola fantasma marca el primer contacto.
- [ ] Al mantener ESPACIO el taco retrocede y la barra de fuerza sube; al soltar avanza y toca la blanca.
- [ ] El contador **Golpes** aumenta y sigue igual después de recargar (LocalStorage).
- [ ] Las tres cámaras funcionan; la calidad Baja/Media/Alta cambia sombras y nitidez.
- [ ] El chip inferior izquierdo dice honestamente si el dispositivo tiene WebXR AR.

**Pruebas automáticas** (medidas, triángulo y puntería):
```bash
node tests/etapa1.test.js      # 18 pruebas
```

## 5. Estructura del proyecto

```
ar-pool-8/
├── index.html               Pantalla de bienvenida y selección de modo
├── ar-experiencia.html      Escena A-Frame (<a-scene>, <a-entity>, cámara, luces, interfaz)
├── css/estilos.css          Paneles holográficos semitransparentes
├── js/
│   ├── ar-app.js            Aplicación: controles, raycaster, LocalStorage, detección WebXR
│   ├── core/                Lógica sin dependencia de A-Frame (se prueba con Node)
│   │   ├── config.js        Medidas reales: mesa de 9 pies, bolas de 57.15 mm, taco de 147 cm
│   │   ├── rack.js          Armado del triángulo según reglamento WPA
│   │   ├── aim.js           Línea guía y cálculo del primer contacto
│   │   └── textures.js      Texturas procedurales (fieltro, madera, bolas) y mapa de entorno PBR
│   └── components/          Componentes A-Frame (Entity-Component-System)
│       ├── mesa-billar.js   Mesa completa: paño, bandas, baranda, troneras, gabinete, patas
│       ├── bola-billar.js   bola-billar + triangulo-bolas
│       ├── taco-billar.js   Taco 3D, retroceso, golpe, guía y bola fantasma
│       ├── camara-orbita.js Cámaras libre / tiro / superior con ratón y táctil
│       └── escena-realista.js  Tono ACES, reflejos, calidad gráfica y lámpara
├── tests/etapa1.test.js     Pruebas automáticas
└── vendor/aframe.min.js     A-Frame 1.6.0 (MIT)
```
En las próximas etapas se agregan `js/fisica/`, `js/reglas/`, `js/ia/`, `js/red/` y `servidor/`.

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
- **iPhone:** Safari no tiene WebXR AR. El juego funciona en modo 3D táctil y lo indica en pantalla; no se presenta como realidad aumentada.

## Licencias
Código del proyecto: MIT. A-Frame: MIT. Todas las texturas y modelos se generan por código (no hay recursos de terceros).
