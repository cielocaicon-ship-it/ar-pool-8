/* ==========================================================================
   Componente A-Frame: fisica-mesa
   Conecta el motor de física (js/fisica/motor.js) con las entidades:
   · Escucha 'taco-golpe' del taco y aplica el impulso a la bola blanca.
   · Cada cuadro avanza la simulación con paso fijo y mueve las <a-entity>.
   · Gira cada bola según su velocidad angular real (rueda o desliza).
   · Anima la caída en la tronera y reproduce sonidos.
   · Cuando todas las bolas se detienen emite 'bolas-quietas'.
   Uso: <a-entity id="mesa" mesa-billar fisica-mesa="taco: #taco">
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;
  var Motor = window.ARPOOL.fisica.Motor;
  var SND = function () { return window.ARPOOL.sonido; };

  AFRAME.registerComponent('fisica-mesa', {
    schema: {
      taco: { type: 'selector', default: '#taco' }
    },

    init: function () {
      this.motor = new Motor();
      this.entidades = {};
      this.cayendo = [];          // animaciones de caída en tronera
      this.moviendo = false;
      this.resumen = null;
      this.listo = false;
      this.tmpQ = new THREE.Quaternion();
      this.tmpV = new THREE.Vector3();
      this.onGolpe = this.onGolpe.bind(this);

      var self = this;
      var preparar = function () {
        self.leerBolas();
        self.listo = true;
        if (self.data.taco) self.data.taco.addEventListener('taco-golpe', self.onGolpe);
      };
      if (this.el.sceneEl.hasLoaded) setTimeout(preparar, 0);
      else this.el.sceneEl.addEventListener('loaded', preparar);
    },

    leerBolas: function () {
      var lista = [], ents = this.el.querySelectorAll('[bola-billar]');
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i], n = e.getAttribute('bola-billar').numero;
        this.entidades[n] = e;
        lista.push({ numero: n, x: e.object3D.position.x, z: e.object3D.position.z });
      }
      this.motor.colocar(lista);
    },

    /** Vuelve a armar el triángulo (botón "Reacomodar") */
    reacomodar: function () {
      var R = cfg.BALL.radius, self = this;
      this.cayendo = [];
      window.ARPOOL.rack.buildRack().forEach(function (b) {
        var e = self.entidades[b.number];
        if (!e) return;
        e.object3D.position.set(b.x, R, b.z);
        e.object3D.visible = true;
      });
      this.leerBolas();
      this.moviendo = false;
      this.el.emit('mesa-reacomodada');
      this.el.emit('bolas-quietas', { embocadas: [], blancaEmbocada: false, reacomodo: true });
    },

    onGolpe: function (e) {
      if (!this.listo || this.moviendo) return;
      var d = e.detail;
      var V = this.motor.golpear(d.direccion, d.potencia, d.efecto);
      if (!V) return;
      this.moviendo = true;
      this.resumen = { embocadas: [], blancaEmbocada: false, primerContacto: null, bandas: 0, potencia: d.potencia };
      var s = SND(); if (s) s.taco(d.potencia, this.mundo(this.motor.bola(0)));
      this.el.emit('tiro-iniciado', { velocidad: V, potencia: d.potencia });
    },

    enMovimiento: function () { return this.moviendo; },

    mundo: function (p) {
      this.tmpV.set(p.x, cfg.BALL.radius, p.z);
      return this.el.object3D.localToWorld(this.tmpV.clone());
    },

    tick: function (t, dtMs) {
      if (!this.listo) return;
      var dt = dtMs / 1000;
      var s = SND();
      if (this.moviendo) {
        var ev = this.motor.avanzar(dt);
        for (var i = 0; i < ev.length; i++) this.procesarEvento(ev[i], s);
        this.sincronizar();
      }
      // Animación de caída (0.4 s): la bola se hunde hacia el centro de la tronera
      for (var k = this.cayendo.length - 1; k >= 0; k--) {
        var c = this.cayendo[k];
        c.t += dt;
        var u = Math.min(1, c.t / 0.4);
        var o = c.el.object3D;
        o.position.x = c.x0 + (c.tx - c.x0) * Math.min(1, u * 1.6);
        o.position.z = c.z0 + (c.tz - c.z0) * Math.min(1, u * 1.6);
        o.position.y = cfg.BALL.radius - 0.11 * u * u;
        if (u >= 1) { o.visible = false; this.cayendo.splice(k, 1); }
      }
      if (this.moviendo && !this.motor.enMovimiento() && this.cayendo.length === 0) this.finTiro();

      // El oído del sonido espacial sigue a la cámara
      if (s && s.oyente) {
        var cam = this.el.sceneEl.camera;
        if (cam) {
          var pos = new THREE.Vector3(), fr = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
          cam.getWorldPosition(pos); cam.getWorldDirection(fr);
          up.applyQuaternion(cam.getWorldQuaternion(this.tmpQ));
          s.oyente(pos, fr, up);
        }
      }
    },

    procesarEvento: function (e, s) {
      var r = this.resumen;
      if (e.tipo === 'bola-bola') {
        if (r && r.primerContacto === null && (e.a === 0 || e.b === 0)) r.primerContacto = e.a === 0 ? e.b : e.a;
        if (s) s.bolaBola(e.intensidad, this.mundo(e));
      } else if (e.tipo === 'banda') {
        if (r) r.bandas++;
        if (s) s.banda(e.intensidad, this.mundo(e));
      } else if (e.tipo === 'tronera') {
        var ent = this.entidades[e.bola];
        if (ent) this.cayendo.push({ el: ent, t: 0, x0: e.x, z0: e.z, tx: e.tx, tz: e.tz });
        if (r) { r.embocadas.push(e.bola); if (e.bola === 0) r.blancaEmbocada = true; }
        if (s) s.tronera(e.intensidad, this.mundo({ x: e.tx, z: e.tz }));
        this.el.emit('bola-embocada', { bola: e.bola, tronera: e.tronera });
      }
    },

    sincronizar: function () {
      var bolas = this.motor.bolas, R = cfg.BALL.radius;
      for (var i = 0; i < bolas.length; i++) {
        var b = bolas[i], e = this.entidades[b.n];
        if (!e || !b.activa) continue;
        e.object3D.position.set(b.x, R, b.z);
        // Rotación visual = integral de la velocidad angular de la física
        var rx = b.rot.x, ry = b.rot.y, rz = b.rot.z;
        var ang = Math.sqrt(rx * rx + ry * ry + rz * rz);
        if (ang > 1e-6) {
          var comp = e.components['bola-billar'];
          this.tmpV.set(rx / ang, ry / ang, rz / ang);
          this.tmpQ.setFromAxisAngle(this.tmpV, ang);
          if (comp) comp.ball.quaternion.premultiply(this.tmpQ);
          b.rot.x = b.rot.y = b.rot.z = 0;
        }
      }
    },

    finTiro: function () {
      this.moviendo = false;
      var r = this.resumen || { embocadas: [], blancaEmbocada: false };
      // Bola blanca embocada: vuelve a la zona de cabecera
      if (r.blancaEmbocada) {
        var b = this.motor.reponer(0, cfg.HEAD_SPOT.x, cfg.HEAD_SPOT.z);
        var e = this.entidades[0];
        if (b && e) { e.object3D.position.set(b.x, cfg.BALL.radius, b.z); e.object3D.visible = true; }
      }
      r.enMesa = this.motor.bolas.filter(function (x) { return x.activa && x.n !== 0; }).length;
      this.el.emit('bolas-quietas', r);
    },

    remove: function () {
      if (this.data.taco) this.data.taco.removeEventListener('taco-golpe', this.onGolpe);
    }
  });
})();
