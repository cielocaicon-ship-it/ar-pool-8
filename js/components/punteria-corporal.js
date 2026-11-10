/* ==========================================================================
   Componente A-Frame: punteria-corporal   (va en <a-scene>)
   El taco apunta desde donde está el celular hacia la bola blanca, como en
   un billar real: te paras detrás de la bola y miras hacia donde vas a tirar.
   Con ◀ ▶ se hace un ajuste fino (desfase en grados).
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;

  AFRAME.registerComponent('punteria-corporal', {
    schema: {
      mesa: { type: 'selector', default: '#mesa' },
      taco: { type: 'selector', default: '#taco' },
      marcador: { type: 'selector', default: '' }   // si existe, solo apunta cuando se ve
    },
    init: function () {
      this.desfase = 0;
      this.pos = new THREE.Vector3();
    },
    ajustar: function (deltaGrados) {
      this.desfase = THREE.MathUtils.clamp(this.desfase + deltaGrados, -60, 60);
    },
    centrar: function () { this.desfase = 0; },
    tick: function () {
      var d = this.data;
      if (!d.mesa || !d.taco) return;
      if (d.marcador && !d.marcador.object3D.visible) return;
      var taco = d.taco.components['taco-billar'];
      if (!taco || taco.estado !== 'reposo') return;
      var cam = this.el.camera;
      if (!cam) return;
      cam.getWorldPosition(this.pos);
      d.mesa.object3D.updateMatrixWorld();
      d.mesa.object3D.worldToLocal(this.pos);
      var b = taco.posBlanca();
      var dx = b.x - this.pos.x, dz = b.z - this.pos.z;
      if (dx * dx + dz * dz < 1e-6) return;
      var ang = Math.atan2(-dz, dx) * 180 / Math.PI + this.desfase;
      if (Math.abs(((ang - taco.angulo + 540) % 360) - 180) > 0.05) taco.setAngulo(ang);
    }
  });
})();
