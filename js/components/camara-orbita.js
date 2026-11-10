/* ==========================================================================
   Componente A-Frame: camara-orbita
   Cámara virtual para el modo 3D (computador y celular):
     · libre     → orbita alrededor de la mesa (arrastrar = girar, rueda/pellizco = zoom)
     · tiro      → cámara de asistencia detrás del taco (arrastrar = girar el taco)
     · superior  → vista cenital de toda la mesa (arrastrar = girar el taco)
   Uso: <a-entity camera camara-orbita="modo: libre; taco: #taco"></a-entity>
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;
  var MODOS = ['libre', 'tiro', 'superior'];

  window.ARPOOL.input = window.ARPOOL.input || { arrastro: false };

  AFRAME.registerComponent('camara-orbita', {
    schema: {
      modo: { type: 'string', default: 'libre', oneOf: MODOS },
      mesa: { type: 'selector', default: '#mesa' },
      blanca: { type: 'selector', default: '#bola-0' },
      taco: { type: 'selector', default: '#taco' },
      habilitada: { type: 'boolean', default: true }
    },

    init: function () {
      this.theta = -0.55;     // azimut (rad)
      this.phi = 0.98;        // ángulo desde la vertical (rad)
      this.radius = window.innerWidth < window.innerHeight ? 4.8 : 3.3;   // distancia (m); más lejos en vertical
      this.tiroDist = 1.0;
      this.pos = new THREE.Vector3(0, 2.4, 3);
      this.look = new THREE.Vector3(0, cfg.TABLE.bedHeight, 0);
      this.up = new THREE.Vector3(0, 1, 0);
      this.pointers = new Map();
      this.pinchDist = 0;
      this.snap = true;   // el primer cuadro se coloca sin suavizado

      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onWheel = this.onWheel.bind(this);

      var scene = this.el.sceneEl;
      var attach = function () {
        var c = scene.canvas;
        c.addEventListener('pointerdown', this.onDown);
        window.addEventListener('pointermove', this.onMove);
        window.addEventListener('pointerup', this.onUp);
        window.addEventListener('pointercancel', this.onUp);
        c.addEventListener('wheel', this.onWheel, { passive: false });
        c.style.touchAction = 'none';
      }.bind(this);
      if (scene.canvas) attach(); else scene.addEventListener('render-target-loaded', attach);
    },

    update: function (old) {
      if (old && old.modo && old.modo !== this.data.modo) {
        this.el.emit('camara-modo', { modo: this.data.modo });
      }
    },

    siguienteModo: function () {
      var i = MODOS.indexOf(this.data.modo);
      this.el.setAttribute('camara-orbita', 'modo', MODOS[(i + 1) % MODOS.length]);
      return MODOS[(i + 1) % MODOS.length];
    },

    // ------------------------------------------------------------ Entrada
    onDown: function (e) {
      if (!this.data.habilitada) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      window.ARPOOL.input.arrastro = false;
      if (this.pointers.size === 2) this.pinchDist = this.distPointers();
    },
    onMove: function (e) {
      var p = this.pointers.get(e.pointerId);
      if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6) window.ARPOOL.input.arrastro = true;

      if (this.pointers.size >= 2) {           // pellizco = zoom
        var d = this.distPointers();
        if (this.pinchDist > 0) this.zoom(this.pinchDist / d);
        this.pinchDist = d;
        return;
      }
      var fino = e.shiftKey ? 0.25 : 1;
      if (this.data.modo === 'libre') {
        this.theta -= dx * 0.006 * fino;
        this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.005 * fino, 0.12, 1.45);
      } else {
        var taco = this.tacoComp();
        if (taco) taco.girar(-dx * 0.18 * fino);
      }
    },
    onUp: function (e) {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
    },
    onWheel: function (e) {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.0012));
    },
    zoom: function (f) {
      if (this.data.modo === 'tiro') this.tiroDist = THREE.MathUtils.clamp(this.tiroDist * f, 0.45, 2.2);
      else this.radius = THREE.MathUtils.clamp(this.radius * f, 0.6, 7);
    },
    distPointers: function () {
      var arr = Array.from(this.pointers.values());
      return Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y) || 1;
    },
    tacoComp: function () {
      return this.data.taco && this.data.taco.components['taco-billar'];
    },

    // ------------------------------------------------------------- Ciclo
    tick: function (t, dtMs) {
      if (!this.data.habilitada || !this.data.mesa) return;
      var dt = Math.min(dtMs / 1000, 0.05);
      var mesaObj = this.data.mesa.object3D;
      var center = new THREE.Vector3();
      mesaObj.getWorldPosition(center);
      var wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3(), wantUp = new THREE.Vector3(0, 1, 0);
      var cam = this.el.getObject3D('camera');

      if (this.data.modo === 'libre') {
        wantLook.copy(center);
        wantPos.set(
          Math.sin(this.phi) * Math.sin(this.theta),
          Math.cos(this.phi),
          Math.sin(this.phi) * Math.cos(this.theta)
        ).multiplyScalar(this.radius).add(center);
      } else if (this.data.modo === 'tiro') {
        var ball = new THREE.Vector3();
        if (this.data.blanca) this.data.blanca.object3D.getWorldPosition(ball); else ball.copy(center);
        var taco = this.tacoComp();
        var a = (taco ? taco.angulo : 0) * Math.PI / 180;
        var dir = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).applyQuaternion(mesaObj.getWorldQuaternion(new THREE.Quaternion()));
        wantLook.copy(ball).addScaledVector(dir, 0.55 * this.tiroDist);
        wantPos.copy(ball).addScaledVector(dir, -0.95 * this.tiroDist);
        wantPos.y += 0.38 * this.tiroDist;
      } else { // superior
        var aspect = cam ? cam.aspect : 1.6;
        var vfov = (cam ? cam.fov : 55) * Math.PI / 180;
        var hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
        var halfL = cfg.TABLE.playLength / 2 + 0.42, halfW = cfg.TABLE.playWidth / 2 + 0.42;
        var portrait = aspect < 1;
        var h = portrait
          ? Math.max(halfW / Math.tan(hfov / 2), halfL / Math.tan(vfov / 2))
          : Math.max(halfL / Math.tan(hfov / 2), halfW / Math.tan(vfov / 2));
        wantLook.copy(center);
        wantPos.copy(center); wantPos.y += h;
        wantUp.set(portrait ? 1 : 0, 0, portrait ? 0 : -1);
      }

      var k = this.snap ? 1 : 1 - Math.exp(-dt * 7);
      this.snap = false;
      this.pos.lerp(wantPos, k);
      this.look.lerp(wantLook, k);
      this.up.lerp(wantUp, k).normalize();
      var o = this.el.object3D;
      o.position.copy(this.pos);
      o.up.copy(this.up);
      // La entidad no es una cámara: Object3D.lookAt orienta su +Z al punto,
      // así que miramos al punto "opuesto" para que la cámara (-Z) vea la mesa.
      o.lookAt(this.pos.clone().multiplyScalar(2).sub(this.look));
    },

    remove: function () {
      var c = this.el.sceneEl.canvas;
      if (c) { c.removeEventListener('pointerdown', this.onDown); c.removeEventListener('wheel', this.onWheel); }
      window.removeEventListener('pointermove', this.onMove);
      window.removeEventListener('pointerup', this.onUp);
      window.removeEventListener('pointercancel', this.onUp);
    }
  });
})();
