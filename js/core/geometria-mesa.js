/* ==========================================================================
   AR POOL 8 — geometria-mesa.js
   Geometría 2D compartida por el dibujo 3D de la mesa y por el motor de
   física: bordes de las 6 bandas (con sus "mandíbulas" en las troneras)
   y círculos de las troneras. Así lo que se ve y lo que choca es idéntico.
   Coordenadas (x, z) en metros; (0,0) = centro del paño.
   ========================================================================== */
(function (root, factory) {
  var cfg = (typeof module !== 'undefined' && module.exports)
    ? require('./config.js')
    : root.ARPOOL.config;
  var api = factory(cfg);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ARPOOL = root.ARPOOL || {};
  root.ARPOOL.geometria = api;
})(typeof self !== 'undefined' ? self : this, function (cfg) {
  'use strict';
  var T = cfg.TABLE;

  function ensureCCW(pts) {
    var a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a < 0 ? pts.slice().reverse() : pts;
  }

  function construir() {
    var hx = T.playLength / 2, hy = T.playWidth / 2;          // nariz de banda
    var bx = hx + T.cushionWidth, by = hy + T.cushionWidth;   // borde de la madera
    var pockets = {
      corner: { cx: hx + T.cornerPocketOffset, cy: hy + T.cornerPocketOffset, r: T.cornerPocketRadius },
      side: { cy: hy + T.sidePocketOffset, r: T.sidePocketRadius }
    };
    var c = pockets.corner, s = pockets.side;
    var cut = {
      eX: Math.sqrt(c.r * c.r - Math.pow(by - c.cy, 2)),
      eY: Math.sqrt(c.r * c.r - Math.pow(bx - c.cx, 2)),
      aS: Math.sqrt(s.r * s.r - Math.pow(by - s.cy, 2))
    };
    var mC = T.cornerMouth / Math.SQRT2;
    var sideNose = T.sideMouth / 2;

    var base = [               // banda larga inferior izquierda
      [-(c.cx - cut.eX), -by],
      [-cut.aS, -by],
      [-sideNose, -hy],
      [-(hx - mC), -hy]
    ];
    var shortLeft = [          // banda corta izquierda (cabecera)
      [-bx, -(c.cy - cut.eY)],
      [-hx, -(hy - mC)],
      [-hx, (hy - mC)],
      [-bx, (c.cy - cut.eY)]
    ];
    var polys = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(function (m) {
      return ensureCCW(base.map(function (p) { return [p[0] * m[0], p[1] * m[1]]; }));
    });
    polys.push(ensureCCW(shortLeft));
    polys.push(ensureCCW(shortLeft.map(function (p) { return [-p[0], p[1]]; })));

    // Segmentos de choque: todos los lados de cada banda.
    var segmentos = [];
    polys.forEach(function (pts) {
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        segmentos.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1] });
      }
    });

    return {
      hx: hx, hy: hy, bx: bx, by: by,
      pockets: pockets, cut: cut,
      bandas: polys,
      segmentos: segmentos,
      troneras: cfg.pocketCenters()
    };
  }

  return { construir: construir, ensureCCW: ensureCCW };
});
