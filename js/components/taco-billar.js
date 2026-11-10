/* ==========================================================================
   Componente A-Frame: taco-billar
   Taco 3D (punta, virola, fuste de arce, unión, culata con grip) que gira
   alrededor de la bola blanca, hace el retroceso al cargar fuerza y el
   avance hasta el contacto. Dibuja la línea guía y la bola fantasma del
   primer contacto probable.
   Al tocar la bola emite el evento 'taco-golpe' {angulo, potencia, direccion}
   (la Etapa 2 conectará ese evento con el motor de física).
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;
  var TX = window.ARPOOL.textures;
  var AIM = window.ARPOOL.aim;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInQuad(t) { return t * t; }

  AFRAME.registerComponent('taco-billar', {
    schema: {
      objetivo: { type: 'selector', default: '#bola-0' },
      angulo: { type: 'number', default: 0 },          // grados, 0 = hacia +x
      guia: { type: 'boolean', default: true }
    },

    init: function () {
      var C = cfg.CUE, R = cfg.BALL.radius;
      this.estado = 'reposo';
      this.potencia = 0;          // 0..1
      this.pull = 0;              // retroceso actual (m)
      this.t = 0;
      this.angulo = this.data.angulo;

      // Jerarquía: pivote (en la blanca, gira en Y) > inclinación > deslizador > taco
      this.pivot = new THREE.Group();
      this.tilt = new THREE.Group();
      this.tilt.position.x = -R;
      this.tilt.rotation.z = -C.elevationDeg * Math.PI / 180;
      this.slide = new THREE.Group();
      this.pivot.add(this.tilt);
      this.tilt.add(this.slide);
      this.slide.add(this.buildStick());
      this.el.setObject3D('mesh', this.pivot);

      this.buildGuide();
      this.el.object3D.add(this.guide);   // coordenadas locales de la mesa
      this.updatePose();
    },

    // --------------------------------------------------------------- Modelo
    buildStick: function () {
      var C = cfg.CUE;
      var stick = new THREE.Group();
      var maple = TX.woodTexture(1, 1, 'maple'); maple.center.set(0.5, 0.5); maple.rotation = Math.PI / 2;
      var ebony = TX.woodTexture(1, 1); ebony.center.set(0.5, 0.5); ebony.rotation = Math.PI / 2;
      var mats = {
        tip: new THREE.MeshStandardMaterial({ color: '#3f6fb6', roughness: 0.95 }),
        ferrule: new THREE.MeshPhysicalMaterial({ color: '#f4f1e8', roughness: 0.25, clearcoat: 0.6 }),
        shaft: new THREE.MeshPhysicalMaterial({ map: maple, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
        joint: new THREE.MeshStandardMaterial({ color: '#c8c8c8', roughness: 0.2, metalness: 1 }),
        forearm: new THREE.MeshPhysicalMaterial({ map: ebony, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
        inlay: new THREE.MeshPhysicalMaterial({ color: '#efe6cf', roughness: 0.25, clearcoat: 1, iridescence: 0.3 }),
        wrap: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.85 }),
        bumper: new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.7 })
      };
      this.materials = mats;
      // tramos: [desde, hasta, radio inicio, radio fin, material]  (0 = punta)
      var L = C.length;
      var parts = [
        [0.000, 0.010, C.tipRadius * 0.97, C.tipRadius, 'tip'],
        [0.010, 0.032, C.tipRadius + 0.0001, C.tipRadius + 0.0002, 'ferrule'],
        [0.032, 0.735, C.tipRadius + 0.0002, 0.0106, 'shaft'],
        [0.735, 0.745, 0.0109, 0.0109, 'joint'],
        [0.745, 0.760, 0.0110, 0.0110, 'wrap'],
        [0.760, 1.040, 0.0111, 0.0128, 'forearm'],
        [1.040, 1.048, 0.0129, 0.0129, 'inlay'],
        [1.048, 1.300, 0.0131, 0.0136, 'wrap'],
        [1.300, 1.308, 0.0137, 0.0137, 'inlay'],
        [1.308, L - 0.016, 0.0138, C.buttRadius, 'forearm'],
        [L - 0.016, L, C.buttRadius, C.buttRadius * 0.96, 'bumper']
      ];
      parts.forEach(function (p) {
        var h = p[1] - p[0];
        var g = new THREE.CylinderGeometry(p[3], p[2], h, 28, 1, false);
        var m = new THREE.Mesh(g, mats[p[4]]);
        m.position.y = p[0] + h / 2;
        m.castShadow = true;
        stick.add(m);
      });
      // punta redondeada
      var cap = new THREE.Mesh(new THREE.SphereGeometry(C.tipRadius * 0.97, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.tip);
      cap.scale.y = 0.35;
      stick.add(cap);
      // Incrustaciones en forma de punta (decoración del antebrazo)
      for (var i = 0; i < 4; i++) {
        var pt = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.16, 3), mats.inlay);
        var a = i * Math.PI / 2;
        pt.position.set(Math.cos(a) * 0.0117, 0.93, Math.sin(a) * 0.0117);
        pt.rotation.y = -a;
        pt.scale.z = 0.25;
        stick.add(pt);
      }
      stick.rotation.z = Math.PI / 2;   // el eje +Y del cilindro pasa a apuntar hacia -X
      return stick;
    },

    buildGuide: function () {
      var R = cfg.BALL.radius;
      var g = new THREE.Group();
      g.name = 'guia-tiro';
      var lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
      this.lineMain = new THREE.Mesh(new THREE.BoxGeometry(1, 0.0012, 0.0024), lineMat);
      this.lineObj = new THREE.Mesh(new THREE.BoxGeometry(1, 0.0012, 0.0024),
        new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.7, depthWrite: false }));
      this.lineCue = new THREE.Mesh(new THREE.BoxGeometry(1, 0.0012, 0.0024),
        new THREE.MeshBasicMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.45, depthWrite: false }));
      this.ghost = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }));
      this.ghostRing = new THREE.Mesh(new THREE.RingGeometry(R * 0.96, R * 1.05, 40),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      this.ghostRing.rotation.x = -Math.PI / 2;
      [this.lineMain, this.lineObj, this.lineCue, this.ghost, this.ghostRing].forEach(function (m) {
        m.renderOrder = 5; g.add(m);
      });
      this.guide = g;
      this.ultimoContacto = null;
    },

    // ---------------------------------------------------------- API pública
    setAngulo: function (deg) {
      this.angulo = ((deg % 360) + 360) % 360;
      this.el.emit('taco-angulo', { angulo: this.angulo });
    },
    girar: function (deltaDeg) { if (this.estado === 'reposo' || this.estado === 'cargando') this.setAngulo(this.angulo + deltaDeg); },
    apuntarA: function (x, z) {   // coordenadas locales de la mesa
      var b = this.posBlanca();
      this.setAngulo(Math.atan2(-(z - b.z), x - b.x) * 180 / Math.PI);
    },
    cargar: function (p) {
      if (this.estado !== 'reposo' && this.estado !== 'cargando') return;
      this.estado = 'cargando';
      this.potencia = Math.max(0, Math.min(1, p));
      this.el.emit('taco-potencia', { potencia: this.potencia });
    },
    soltar: function () {
      if (this.estado !== 'cargando') return false;
      if (this.potencia < 0.03) { this.estado = 'reposo'; this.potencia = 0; this.el.emit('taco-potencia', { potencia: 0 }); return false; }
      this.estado = 'golpe';
      this.t = 0;
      this.pullInicio = this.pull;
      this.duracionGolpe = 0.07 + 0.16 * (1 - this.potencia);   // más fuerza = avance más rápido
      return true;
    },
    ocupado: function () { return this.estado !== 'reposo' && this.estado !== 'cargando'; },
    conFisica: function () { return !!this.el.sceneEl.querySelector('[fisica-mesa]'); },
    reposo: function () {
      this.estado = 'reposo'; this.potencia = 0; this.pull = 0;
      this.el.emit('taco-potencia', { potencia: 0 });
      this.setAngulo(this.angulo);
    },
    /** La física avisa que todo se detuvo: el taco vuelve junto a la blanca */
    liberar: function () { if (this.estado === 'esperando' || this.estado === 'contacto') this.reposo(); },

    posBlanca: function () {
      var o = this.data.objetivo || document.getElementById('bola-0');
      return o ? o.object3D.position : { x: 0, y: cfg.BALL.radius, z: 0 };
    },

    // ------------------------------------------------------------- Ciclo
    tick: function (time, dtMs) {
      var dt = Math.min(dtMs / 1000, 0.05);
      var C = cfg.CUE;
      switch (this.estado) {
        case 'cargando':
          this.pull += ((this.potencia * C.maxPullBack) - this.pull) * Math.min(1, dt * 14);
          break;
        case 'golpe':
          this.t += dt;
          var k = Math.min(1, this.t / this.duracionGolpe);
          this.pull = this.pullInicio + (-C.restGap - this.pullInicio) * easeInQuad(k);
          if (k >= 1) {
            var dir = AIM.dirFromAngle(this.angulo);
            this.el.emit('taco-golpe', { angulo: this.angulo, potencia: this.potencia, direccion: dir, efecto: this.efecto || { lado: 0, alto: 0 } });
            this.estado = 'contacto';
            this.t = 0;
          }
          break;
        case 'contacto':   // seguimiento: el taco continúa un poco tras el impacto
          this.t += dt;
          var kc = Math.min(1, this.t / 0.14);
          this.pull = -C.restGap - (0.03 + 0.07 * this.potencia) * easeOutCubic(kc);
          if (this.t > 0.32) {
            if (this.conFisica()) { this.estado = 'esperando'; }
            else { this.estado = 'retorno'; this.t = 0; }
          }
          break;
        case 'esperando':  // las bolas se mueven: el taco se aparta
          break;
        case 'retorno':
          this.t += dt;
          var kr = Math.min(1, this.t / 0.5);
          this.pull = this.pull + (0 - this.pull) * easeOutCubic(kr);
          if (kr >= 1) this.reposo();
          break;
      }
      this.updatePose();
    },

    updatePose: function () {
      var b = this.posBlanca();
      this.pivot.position.set(b.x, b.y, b.z);
      this.pivot.visible = this.estado !== 'esperando';
      this.pivot.rotation.y = this.angulo * Math.PI / 180;
      this.slide.position.x = -cfg.CUE.restGap - this.pull;
      this.updateGuide(b);
    },

    updateGuide: function (b) {
      var show = this.data.guia && (this.estado === 'reposo' || this.estado === 'cargando');
      this.guide.visible = show;
      if (!show) return;
      var R = cfg.BALL.radius, T = cfg.TABLE;
      var balls = [];
      var els = this.el.sceneEl.querySelectorAll('[bola-billar]');
      for (var i = 0; i < els.length; i++) {
        var e = els[i], p = e.object3D.position;
        if (!e.object3D.visible) continue;
        balls.push({ number: e.getAttribute('bola-billar').numero, x: p.x, z: p.z });
      }
      var dir = AIM.dirFromAngle(this.angulo);
      var hit = AIM.firstContact({ x: b.x, z: b.z }, dir, balls, R, T.playLength / 2, T.playWidth / 2);
      this.ultimoContacto = hit;
      if (!hit) { this.guide.visible = false; return; }

      var y = R;
      placeSegment(this.lineMain, b.x + dir.x * R, b.z + dir.z * R, hit.punto.x, hit.punto.z, y);
      this.ghost.position.set(hit.punto.x, y, hit.punto.z);
      this.ghostRing.position.set(hit.punto.x, 0.0015, hit.punto.z);
      if (hit.tipo === 'bola') {
        this.lineObj.visible = true;
        this.lineCue.visible = true;
        var ob = balls.filter(function (x) { return x.number === hit.bola; })[0];
        var n = hit.normal;
        placeSegment(this.lineObj, ob.x, ob.z, ob.x + n.x * 0.28, ob.z + n.z * 0.28, y);
        // Tangente aproximada de la blanca (rodando sin efecto, ≈ perpendicular a la normal)
        var dot = dir.x * n.x + dir.z * n.z;
        var tx = dir.x - dot * n.x, tz = dir.z - dot * n.z, tl = Math.hypot(tx, tz);
        if (tl > 0.05) {
          placeSegment(this.lineCue, hit.punto.x, hit.punto.z, hit.punto.x + tx / tl * 0.18 * tl, hit.punto.z + tz / tl * 0.18 * tl, y);
        } else this.lineCue.visible = false;
      } else {
        this.lineObj.visible = false;
        this.lineCue.visible = false;
      }
    },

    remove: function () {
      this.el.removeObject3D('mesh');
      this.el.object3D.remove(this.guide);
    }
  });

  // Coloca una caja de largo 1 entre dos puntos del plano de la mesa
  function placeSegment(mesh, x0, z0, x1, z1, y) {
    var dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    mesh.visible = L > 0.001;
    mesh.scale.set(Math.max(L, 0.0001), 1, 1);
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.rotation.set(0, Math.atan2(-dz, dx), 0);
  }
})();
