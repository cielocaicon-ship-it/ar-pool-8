# 🎱 AR Pool 8 — prototipo 0.2

Billar americano en realidad aumentada para el navegador (A-Frame 1.5 + AR.js 3.4.5), pensado para jugarse desde Safari en iPhone.

## Páginas
| Archivo | Para qué sirve |
|---|---|
| `index.html` | Menú de inicio |
| `ar.html` | Realidad aumentada con el marcador HIRO (usa la cámara) |
| `3d.html` | Vista 3D sin cámara |
| `marcador.html` | Muestra el marcador HIRO en pantalla |
| `js/game.js` | Todo el juego: mesa, bolas, física, taco, bot y cámara |
| `css/styles.css` | Estilos de la interfaz |
| `lib/` | A-Frame y AR.js guardados en el repositorio (no dependen de otros servidores) |
| `data/` | Archivos del marcador HIRO y de calibración de cámara de AR.js |

## Qué funciona (probado en Chrome de escritorio con cámara simulada)
- Mesa de 8 pies a escala real con paño, bandas, barandas de madera, troneras y diamantes.
- 16 bolas con colores y números reales (lisas y rayadas), triángulo reglamentario con la 8 en el centro, giro de las bolas al rodar.
- Física 2D: fricción, choques entre bolas, rebote en bandas, bocas de tronera.
- Taco con animación de golpe, guía de puntería con bola fantasma y dirección de la bola golpeada.
- Apuntar con el deslizador, con ◀ ▶ (0,25° por toque, se mantiene presionado para repetir) o tocando la mesa.
- Bot de práctica que busca un tiro a tronera, con 3 niveles de puntería.
- AR: detección del marcador HIRO y tamaño de mesa ajustable.
- 3D: cámara detrás del taco, vista superior y cámara libre (arrastrar / pellizcar).

## Qué falta (no implementado todavía)
- Reglas completas de bola 8 (lisas/rayadas, faltas, turnos, ganar/perder).
- Partida real contra la IA por turnos.
- Multijugador en línea (salas, códigos de invitación, sincronización).
- Efectos (spin), saltos y física 3D completa.
- Prueba en un iPhone real.
