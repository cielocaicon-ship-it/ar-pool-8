/* ==========================================================================
   AR POOL 8 — motor.js  (motor de física del pool, sin dependencias)
   · Paso de simulación FIJO (1/500 s) con acumulador → reproducible.
   · Cada bola tiene velocidad lineal (vx, vz) y velocidad angular 3D (wx, wy, wz).
   · Paño: fricción de deslizamiento hasta que la bola rueda sin deslizar,
     luego resistencia a la rodadura. El giro vertical (efecto lateral) decae.
   · Choques bola-bola elásticos (e = 0.95) y bola-banda (e = 0.75) contra
     los mismos segmentos que se dibujan, con fricción que usa el efecto.
   · Troneras: la bola cae cuando su centro entra en la boca del agujero.
   Funciona en el navegador (window.ARPOOL.fisica) y en Node (tests).
   ========================================================================== */
(function (root, factory) {
  var deps = (typeof module !== 'undefined' && module.exports)
    ? { cfg: require('../core/config.js'), geo: require('../core/geometria-mesa.js') }
    : { cfg: root.ARPOOL.config, geo: root.ARPOOL.geometria };
  var api = factory(deps.cfg, deps.geo);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ARPOOL = root.ARPOOL || {};
  root.ARPOOL.fisica = api;
})(typeof self !== 'undefined' ? self : this, function (cfg, geo) {
  'use strict';

  var PARAM = {
    dt: 1 / 500,          // paso fijo (s)
    g: 9.81,
    muDesliz: 0.2,        // fricción bola-paño deslizando
    muRodar: 0.01,        // resistencia a la rodadura
    muGiro: 0.044,        // frenado del giro vertical
    eBola: 0.95,          // restitución bola-bola
    eBanda: 0.8,          // restitución bola-banda
    muBanda: 0.14,        // fricción bola-banda (usa el efecto)
    vMax: 9,              // velocidad máxima del golpe (m/s)
    capturaTronera: 0.86  // fracción del radio del agujero para caer
  };

  function Motor(opciones) {
    this.p = Object.assign({}, PARAM, opciones || {});
    this.R = cfg.BALL.radius;
    this.geo = geo.construir();
    this.bolas = [];
    this.acumulado = 0;
    this.tiempo = 0;
    this.pasos = 0;
  }

  Motor.PARAM = PARAM;

  /** Coloca las bolas: [{number|numero, x, z}] */
  Motor.prototype.colocar = function (lista) {
    this.bolas = lista.map(function (b) {
      return {
        n: b.number !== undefined ? b.number : b.numero,
        x: b.x, z: b.z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0,
        activa: true,     // sobre el paño
        rot: { x: 0, y: 0, z: 0 }   // giro acumulado para el dibujo
      };
    });
    this.acumulado = 0;
  };

  Motor.prototype.bola = function (n) {
    for (var i = 0; i < this.bolas.length; i++) if (this.bolas[i].n === n) return this.bolas[i];
    return null;
  };

  /**
   * Golpe del taco a la bola blanca.
   * dir: {x,z} unitario · potencia: 0..1 · efecto: {lado:-1..1, alto:-1..1} (fracción de R/2)
   */
  Motor.prototype.golpear = function (dir, potencia, efecto) {
    var b = this.bola(0);
    if (!b || !b.activa) return false;
    var R = this.R;
    var V = 0.25 + Math.pow(Math.max(0, Math.min(1, potencia)), 1.25) * (this.p.vMax - 0.25);
    efecto = efecto || { lado: 0, alto: 0 };
    var a = (efecto.lado || 0) * 0.5, h = (efecto.alto || 0) * 0.5;   // desplazamiento de la punta / R
    b.vx = dir.x * V; b.vz = dir.z * V;
    // Momento angular: ω = (r × J) / I con I = 2/5 m R²  →  ω = 5 V (r × d) / (2 R²)
    var k = 5 * V / (2 * R);
    // componente vertical del punto de impacto (alto) → giro alrededor de (ŷ × d)
    b.wx = k * h * dir.z;
    b.wz = k * h * -dir.x;
    // componente lateral (lado) → giro alrededor de ŷ
    b.wy = k * a;
    return V;
  };

  Motor.prototype.enMovimiento = function () {
    for (var i = 0; i < this.bolas.length; i++) {
      var b = this.bolas[i];
      if (b.activa && (b.vx || b.vz || b.wx || b.wy || b.wz)) return true;
    }
    return false;
  };

  /** Avanza el tiempo real transcurrido usando pasos fijos. Devuelve eventos. */
  Motor.prototype.avanzar = function (segundos) {
    var ev = [];
    this.acumulado += Math.min(segundos, 0.1);   // evita "espirales" si la pestaña se congela
    while (this.acumulado >= this.p.dt) {
      this.paso(this.p.dt, ev);
      this.acumulado -= this.p.dt;
    }
    return ev;
  };

  /** Simula hasta que todo se detenga (para el bot y para pruebas). */
  Motor.prototype.simularHastaReposo = function (maxSegundos) {
    var ev = [], t = 0, lim = maxSegundos || 30;
    while (this.enMovimiento() && t < lim) { this.paso(this.p.dt, ev); t += this.p.dt; }
    return ev;
  };

  Motor.prototype.paso = function (dt, ev) {
    var p = this.p, R = this.R, bolas = this.bolas;
    var i, j, b;
    this.tiempo += dt; this.pasos++;

    // 1) Fricción con el paño e integración
    for (i = 0; i < bolas.length; i++) {
      b = bolas[i];
      if (!b.activa) continue;
      this.friccionPano(b, dt);
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.rot.x += b.wx * dt; b.rot.y += b.wy * dt; b.rot.z += b.wz * dt;
    }

    // 2) Choques bola-bola (varias pasadas para grupos como el triángulo)
    for (var pasada = 0; pasada < 3; pasada++) {
      for (i = 0; i < bolas.length; i++) {
        if (!bolas[i].activa) continue;
        for (j = i + 1; j < bolas.length; j++) {
          if (!bolas[j].activa) continue;
          this.choqueBolas(bolas[i], bolas[j], ev);
        }
      }
    }

    // 3) Bandas y troneras
    for (i = 0; i < bolas.length; i++) {
      b = bolas[i];
      if (!b.activa) continue;
      if (this.revisarTronera(b, ev)) continue;
      this.choqueBandas(b, ev);
    }
  };

  Motor.prototype.friccionPano = function (b, dt) {
    var p = this.p, R = this.R, g = p.g;
    // velocidad del punto de contacto: u = v + ω × (0,-R,0)
    var ux = b.vx + R * b.wz;
    var uz = b.vz - R * b.wx;
    var u = Math.hypot(ux, uz);
    if (u > 1e-4) {
      // Deslizando: la fricción frena el punto de contacto a ritmo 3.5·μ·g
      var du = Math.min(u, 3.5 * p.muDesliz * g * dt);
      var f = du / 3.5;                // cambio de velocidad lineal
      var nx = ux / u, nz = uz / u;
      b.vx -= nx * f; b.vz -= nz * f;
      // el torque de la fricción: Δω = (5/2R)·f en el eje correspondiente
      b.wz -= nx * f * 2.5 / R;
      b.wx += nz * f * 2.5 / R;
    } else {
      // Rodando sin deslizar
      var v = Math.hypot(b.vx, b.vz);
      if (v > 0) {
        var dv = p.muRodar * g * dt;
        if (v <= dv || v < 0.004) { b.vx = 0; b.vz = 0; }
        else { b.vx -= b.vx / v * dv; b.vz -= b.vz / v * dv; }
      }
      b.wz = -b.vx / R;
      b.wx = b.vz / R;
    }
    // Giro vertical (efecto lateral)
    if (b.wy) {
      var dw = (5 * p.muGiro * g / (2 * R)) * dt;
      b.wy = Math.abs(b.wy) <= dw ? 0 : b.wy - Math.sign(b.wy) * dw;
    }
    if (!b.vx && !b.vz && Math.abs(b.wx) + Math.abs(b.wz) < 0.2) { b.wx = 0; b.wz = 0; }
  };

  Motor.prototype.choqueBolas = function (a, b, ev) {
    var dx = b.x - a.x, dz = b.z - a.z;
    var d2 = dx * dx + dz * dz, minD = 2 * this.R;
    if (d2 >= minD * minD || d2 === 0) return;
    var d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
    // separar (corrección de posición: evita que se atraviesen)
    var solape = (minD - d) / 2 + 1e-7;
    a.x -= nx * solape; a.z -= nz * solape;
    b.x += nx * solape; b.z += nz * solape;
    // impulso solo si se acercan
    var vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (vn <= 0) return;
    var jimp = (1 + this.p.eBola) / 2 * vn;   // masas iguales
    a.vx -= jimp * nx; a.vz -= jimp * nz;
    b.vx += jimp * nx; b.vz += jimp * nz;
    if (vn > 0.02) ev.push({ tipo: 'bola-bola', a: a.n, b: b.n, intensidad: vn, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, t: this.tiempo });
  };

  Motor.prototype.choqueBandas = function (b, ev) {
    var R = this.R, segs = this.geo.segmentos, p = this.p;
    for (var k = 0; k < segs.length; k++) {
      var s = segs[k];
      var ex = s.bx - s.ax, ez = s.bz - s.az;
      var L2 = ex * ex + ez * ez;
      var t = ((b.x - s.ax) * ex + (b.z - s.az) * ez) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var cx = s.ax + ex * t, cz = s.az + ez * t;
      var dx = b.x - cx, dz = b.z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 >= R * R || d2 === 0) continue;
      var d = Math.sqrt(d2), nx = dx / d, nz = dz / d;   // normal: de la banda hacia la bola
      b.x += nx * (R - d + 1e-7); b.z += nz * (R - d + 1e-7);
      var vn = b.vx * nx + b.vz * nz;
      if (vn >= 0) continue;
      // Rebote normal
      b.vx -= (1 + p.eBanda) * vn * nx;
      b.vz -= (1 + p.eBanda) * vn * nz;
      // Fricción tangencial en la banda (aquí actúa el efecto lateral)
      var tx = -nz, tz = nx;
      // Deslizamiento del punto de contacto a lo largo de la banda: v·t + ωy·R
      var slip = b.vx * tx + b.vz * tz + b.wy * R;
      var maxJ = p.muBanda * (1 + p.eBanda) * -vn;
      var jt = Math.max(-maxJ, Math.min(maxJ, -slip / 3.5));
      b.vx += jt * tx; b.vz += jt * tz;
      b.wy += 2.5 * jt / R;
      if (-vn > 0.03) ev.push({ tipo: 'banda', bola: b.n, intensidad: -vn, x: b.x, z: b.z, t: this.tiempo });
    }
  };

  Motor.prototype.revisarTronera = function (b, ev) {
    var tr = this.geo.troneras, g = this.geo;
    for (var k = 0; k < tr.length; k++) {
      var t = tr[k];
      var dx = b.x - t.x, dz = b.z - t.z;
      if (dx * dx + dz * dz < Math.pow(t.r * this.p.capturaTronera, 2)) return this.embocar(b, t, ev);
    }
    // Seguridad: si una bola sale del rectángulo de la madera solo pudo ser por una tronera
    if (Math.abs(b.x) > g.bx + 0.01 || Math.abs(b.z) > g.by + 0.01) {
      var mejor = null, md = Infinity;
      tr.forEach(function (t) { var d = Math.hypot(b.x - t.x, b.z - t.z); if (d < md) { md = d; mejor = t; } });
      return this.embocar(b, mejor, ev);
    }
    return false;
  };

  Motor.prototype.embocar = function (b, t, ev) {
    var vel = Math.hypot(b.vx, b.vz);
    b.activa = false;
    ev.push({ tipo: 'tronera', bola: b.n, tronera: t.id, x: b.x, z: b.z, tx: t.x, tz: t.z, intensidad: vel, t: this.tiempo });
    b.vx = b.vz = b.wx = b.wy = b.wz = 0;
    return true;
  };

  /** Vuelve a poner una bola en la mesa (p. ej. la blanca tras una falta). */
  Motor.prototype.reponer = function (n, x, z) {
    var b = this.bola(n);
    if (!b) return null;
    var R = this.R, ok = false, intento = 0;
    while (!ok && intento < 60) {
      ok = true;
      for (var i = 0; i < this.bolas.length; i++) {
        var o = this.bolas[i];
        if (o === b || !o.activa) continue;
        if (Math.hypot(o.x - x, o.z - z) < 2 * R + 0.002) { ok = false; break; }
      }
      if (!ok) { x -= 2 * R + 0.003; intento++; if (x < -this.geo.hx + R) { x = -this.geo.hx / 2; z += 2 * R + 0.003; } }
    }
    b.x = x; b.z = z; b.activa = true;
    b.vx = b.vz = b.wx = b.wy = b.wz = 0;
    return b;
  };

  Motor.prototype.instantanea = function () {
    return this.bolas.map(function (b) {
      return { n: b.n, x: b.x, z: b.z, activa: b.activa };
    });
  };

  return { Motor: Motor, PARAM: PARAM };
});
