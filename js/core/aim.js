/* ==========================================================================
   AR POOL 8 — aim.js
   Geometría de puntería (sin física): calcula dónde tocará primero la bola
   blanca si viaja en línea recta — contra otra bola o contra una banda.
   Se usa para dibujar la línea guía y la "bola fantasma" de contacto.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ARPOOL = root.ARPOOL || {};
  root.ARPOOL.aim = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Dirección (x,z) a partir de un ángulo en grados. 0° = hacia +x. */
  function dirFromAngle(deg) {
    var a = deg * Math.PI / 180;
    return { x: Math.cos(a), z: -Math.sin(a) };
  }

  /**
   * origin: {x,z} centro de la blanca. dir: vector unitario {x,z}.
   * balls: [{number,x,z}] (se ignora la blanca). R: radio de bola.
   * hx,hz: medio largo y medio ancho del área de juego (hasta la nariz de banda).
   * Devuelve {tipo:'bola'|'banda', distancia, punto:{x,z}, bola, normal}
   */
  function firstContact(origin, dir, balls, R, hx, hz) {
    var best = null;

    // 1) Otras bolas: el centro de la blanca toca a otra bola cuando la
    //    distancia entre centros es 2R (rayo contra círculo de radio 2R).
    var rr = 2 * R;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (b.number === 0 || b.enMesa === false) continue;
      var ox = origin.x - b.x, oz = origin.z - b.z;
      var bq = ox * dir.x + oz * dir.z;
      var c = ox * ox + oz * oz - rr * rr;
      var disc = bq * bq - c;
      if (disc < 0) continue;
      var t = -bq - Math.sqrt(disc);
      if (t < 0) continue;
      if (!best || t < best.distancia) {
        var px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
        best = {
          tipo: 'bola', distancia: t, punto: { x: px, z: pz }, bola: b.number,
          // dirección en la que saldría la bola golpeada (línea de centros)
          normal: { x: (b.x - px) / rr, z: (b.z - pz) / rr }
        };
      }
    }

    // 2) Bandas: el centro de la bola se detiene a R de la nariz de la banda.
    var lim = [
      { t: dir.x > 1e-9 ? (hx - R - origin.x) / dir.x : Infinity, n: { x: -1, z: 0 } },
      { t: dir.x < -1e-9 ? (-hx + R - origin.x) / dir.x : Infinity, n: { x: 1, z: 0 } },
      { t: dir.z > 1e-9 ? (hz - R - origin.z) / dir.z : Infinity, n: { x: 0, z: -1 } },
      { t: dir.z < -1e-9 ? (-hz + R - origin.z) / dir.z : Infinity, n: { x: 0, z: 1 } }
    ];
    for (var k = 0; k < lim.length; k++) {
      var tl = lim[k].t;
      if (tl >= 0 && (!best || tl < best.distancia)) {
        best = {
          tipo: 'banda', distancia: tl,
          punto: { x: origin.x + dir.x * tl, z: origin.z + dir.z * tl },
          bola: null, normal: lim[k].n
        };
      }
    }
    return best;
  }

  return { dirFromAngle: dirFromAngle, firstContact: firstContact };
});
