/* ==========================================================================
   AR POOL 8 — ar-marcador.js
   Página "Escanear marcador": la mesa aparece sobre el marcador Hiro y se
   queda pegada a él aunque muevas el celular o camines alrededor.
   · Muestra/oculta el aviso "Apunta al marcador" (eventos markerFound/markerLost)
   · Botones − / + para el tamaño de la mesa (se guarda en LocalStorage)
   ========================================================================== */
(function () {
  'use strict';
  var TAMANOS = [0.35, 0.5, 0.65, 0.8, 1.0, 1.25, 1.6];
  var CLAVE = 'arpool8.tamanoMarcador';

  document.addEventListener('DOMContentLoaded', function () {
    var scene = document.getElementById('escena');
    var marcador = document.getElementById('marcador');
    var raiz = document.getElementById('mesa-raiz');
    var aviso = document.getElementById('buscar-marcador');
    var idx = TAMANOS.indexOf(parseFloat(localStorage.getItem(CLAVE)));
    if (idx < 0) idx = window.innerWidth < window.innerHeight ? 2 : 3;   // en vertical, algo más pequeña

    function aplicarTamano(mostrar) {
      var s = TAMANOS[idx];
      raiz.setAttribute('scale', s + ' ' + s + ' ' + s);
      try { localStorage.setItem(CLAVE, s); } catch (e) { /* modo privado */ }
      if (mostrar && window.ARPOOL.app && window.ARPOOL.app.aviso) {
        window.ARPOOL.app.aviso('Tamaño de la mesa: ' + Math.round(s * 100) + '%', 1100);
      }
    }
    aplicarTamano(false);
    document.getElementById('btn-menos').addEventListener('click', function () { idx = Math.max(0, idx - 1); aplicarTamano(true); });
    document.getElementById('btn-mas').addEventListener('click', function () { idx = Math.min(TAMANOS.length - 1, idx + 1); aplicarTamano(true); });

    var visto = false;
    marcador.addEventListener('markerFound', function () {
      aviso.classList.add('oculto');
      if (!visto && window.ARPOOL.app && window.ARPOOL.app.aviso) {
        window.ARPOOL.app.aviso('¡Mesa encontrada! Muévete alrededor para apuntar', 2200);
      }
      visto = true;
    });
    marcador.addEventListener('markerLost', function () { aviso.classList.remove('oculto'); });

    // Los navegadores necesitan un toque para activar el sonido; el primer toque también lo habilita
    scene.addEventListener('loaded', function () { aviso.classList.remove('oculto'); });
  });
})();
