/* ==========================================================================
   AR POOL 8 — config.js
   Medidas reales de una mesa americana profesional de 9 pies (WPA/BCA)
   y datos de las 16 bolas. Todas las medidas están en METROS.
   Este archivo funciona en el navegador (window.ARPOOL) y en Node (tests).
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ARPOOL = root.ARPOOL || {};
  root.ARPOOL.config = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Mesa (9 pies) ----------------------------------------------------
  var TABLE = {
    playLength: 2.54,      // largo del área de juego (nariz a nariz de banda) = 100"
    playWidth: 1.27,       // ancho del área de juego = 50"
    bedHeight: 0.76,       // altura del paño desde el suelo (29.25"–31")
    cushionWidth: 0.05,    // ancho de la banda de goma (nariz -> madera)
    cushionHeight: 0.0365, // altura de la nariz de la banda (≈ 63.5% del diámetro de bola)
    cushionTop: 0.040,     // altura superior de la banda
    railWidth: 0.14,       // ancho de la baranda de madera
    railTop: 0.044,        // altura superior de la madera sobre el paño
    railBottom: -0.12,     // la madera baja 12 cm bajo el paño
    // Troneras
    cornerPocketRadius: 0.066,   // radio del agujero de esquina
    cornerPocketOffset: 0.03,    // el centro está 3 cm "afuera" de la esquina del área de juego
    cornerMouth: 0.117,          // boca de esquina entre narices (4.6")
    sidePocketRadius: 0.068,     // radio del agujero central
    sidePocketOffset: 0.05,      // el centro está 5 cm afuera de la banda
    sideMouth: 0.14,             // boca central entre narices (5.5")
    pocketDepth: 0.15
  };

  // ---- Bolas ------------------------------------------------------------
  var BALL = {
    radius: 0.028575,   // diámetro 57.15 mm (2 1/4")
    mass: 0.17          // 170 g (6 oz)
  };

  // Colores oficiales del pool americano (1–7 lisas, 8 negra, 9–15 rayadas)
  var BALL_COLORS = {
    0: '#f4f1e6', // blanca
    1: '#f2b705', // amarilla
    2: '#1450b4', // azul
    3: '#d42a1f', // roja
    4: '#5a2d8c', // morada
    5: '#ee6a12', // naranja
    6: '#137a3c', // verde
    7: '#7c1d1d', // granate
    8: '#111111'  // negra
  };
  function ballColor(n) {
    if (n === 0 || n === 8) return BALL_COLORS[n];
    return BALL_COLORS[n > 8 ? n - 8 : n];
  }
  function ballType(n) {
    if (n === 0) return 'blanca';
    if (n === 8) return 'negra';
    return n < 8 ? 'lisa' : 'rayada';
  }
  var COLOR_NAMES = {
    1: 'amarilla', 2: 'azul', 3: 'roja', 4: 'morada', 5: 'naranja',
    6: 'verde', 7: 'granate', 8: 'negra', 0: 'blanca'
  };
  function ballName(n) {
    if (n === 0) return 'Bola blanca';
    var base = n > 8 ? n - 8 : n;
    return 'Bola ' + n + ' · ' + COLOR_NAMES[n === 8 ? 8 : base] + ' ' +
      (n === 8 ? '' : (n < 8 ? '(lisa)' : '(rayada)'));
  }

  // ---- Taco -------------------------------------------------------------
  var CUE = {
    length: 1.47,        // 58"
    tipRadius: 0.0065,   // punta de 13 mm
    buttRadius: 0.0155,  // culata de 31 mm
    restGap: 0.012,      // separación entre punta y bola en reposo
    maxPullBack: 0.28,   // retroceso máximo al cargar fuerza
    elevationDeg: 4      // inclinación del taco (culata levantada)
  };

  // ---- Posiciones derivadas --------------------------------------------
  function pocketCenters() {
    var hx = TABLE.playLength / 2, hz = TABLE.playWidth / 2;
    var co = TABLE.cornerPocketOffset, so = TABLE.sidePocketOffset;
    return [
      { id: 'esq-1', x: -(hx + co), z: -(hz + co), r: TABLE.cornerPocketRadius, tipo: 'esquina' },
      { id: 'lat-1', x: 0,          z: -(hz + so), r: TABLE.sidePocketRadius,   tipo: 'lateral' },
      { id: 'esq-2', x:  (hx + co), z: -(hz + co), r: TABLE.cornerPocketRadius, tipo: 'esquina' },
      { id: 'esq-3', x:  (hx + co), z:  (hz + co), r: TABLE.cornerPocketRadius, tipo: 'esquina' },
      { id: 'lat-2', x: 0,          z:  (hz + so), r: TABLE.sidePocketRadius,   tipo: 'lateral' },
      { id: 'esq-4', x: -(hx + co), z:  (hz + co), r: TABLE.cornerPocketRadius, tipo: 'esquina' }
    ];
  }

  // Punto de pie (vértice del triángulo) y línea de saque (cabecera)
  var FOOT_SPOT = { x: TABLE.playLength / 4, z: 0 };
  var HEAD_SPOT = { x: -TABLE.playLength / 4, z: 0 };

  return {
    TABLE: TABLE,
    BALL: BALL,
    CUE: CUE,
    FOOT_SPOT: FOOT_SPOT,
    HEAD_SPOT: HEAD_SPOT,
    ballColor: ballColor,
    ballType: ballType,
    ballName: ballName,
    pocketCenters: pocketCenters
  };
});
