/* ==========================================================================
   AR POOL 8 — rack.js
   Calcula la posición inicial de las 16 bolas (triángulo + bola blanca).
   Reglas del armado (WPA): bola 1 en el vértice sobre el punto de pie,
   bola 8 en el centro de la tercera fila, una lisa y una rayada
   en las dos esquinas traseras.
   Coordenadas: x = largo de la mesa, z = ancho. (0,0) = centro del paño.
   ========================================================================== */
(function (root, factory) {
  var cfg = (typeof module !== 'undefined' && module.exports)
    ? require('./config.js')
    : root.ARPOOL.config;
  var api = factory(cfg);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ARPOOL = root.ARPOOL || {};
  root.ARPOOL.rack = api;
})(typeof self !== 'undefined' ? self : this, function (cfg) {
  'use strict';

  // Filas desde el vértice hacia el fondo de la mesa
  var RACK_ORDER = [
    [1],
    [10, 2],
    [3, 8, 11],
    [12, 4, 13, 5],
    [6, 14, 7, 15, 9]
  ];

  /**
   * Devuelve un arreglo [{number, x, z}] con las 16 bolas.
   * gap: pequeña separación entre bolas (m) para que no se solapen.
   */
  function buildRack(gap) {
    gap = gap === undefined ? 0.0002 : gap;
    var R = cfg.BALL.radius;
    var d = 2 * R + gap;                 // distancia entre centros
    var rowStep = d * Math.sqrt(3) / 2;  // separación entre filas (triángulo equilátero)
    var out = [];

    out.push({ number: 0, x: cfg.HEAD_SPOT.x, z: cfg.HEAD_SPOT.z });

    for (var row = 0; row < RACK_ORDER.length; row++) {
      var balls = RACK_ORDER[row];
      for (var j = 0; j < balls.length; j++) {
        out.push({
          number: balls[j],
          x: cfg.FOOT_SPOT.x + row * rowStep,
          z: (j - row / 2) * d
        });
      }
    }
    return out;
  }

  return { RACK_ORDER: RACK_ORDER, buildRack: buildRack };
});
