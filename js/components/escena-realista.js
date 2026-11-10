/* ==========================================================================
   Componentes A-Frame: escena-realista y lampara-billar
   - escena-realista (en <a-scene>): mapeo de tonos ACES, mapa de entorno
     PBR para reflejos y niveles de calidad gráfica (baja / media / alta).
   - lampara-billar: lámpara colgante clásica de 3 pantallas sobre la mesa.
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var TX = window.ARPOOL.textures;

  var CALIDADES = {
    baja:  { pixelRatio: 1,   sombras: false, mapa: 512 },
    media: { pixelRatio: 1.5, sombras: true,  mapa: 1024 },
    alta:  { pixelRatio: 2,   sombras: true,  mapa: 2048 }
  };

  AFRAME.registerComponent('escena-realista', {
    schema: {
      calidad: { type: 'string', default: 'media', oneOf: ['baja', 'media', 'alta'] },
      exposicion: { type: 'number', default: 1.0 }
    },

    init: function () {
      var scene = this.el;
      var self = this;
      var setup = function () {
        var r = scene.renderer;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = self.data.exposicion;
        r.outputColorSpace = THREE.SRGBColorSpace;
        scene.object3D.environment = TX.environmentMap(r);
        self.aplicarCalidad();
      };
      if (scene.hasLoaded) setup(); else scene.addEventListener('loaded', setup);
    },

    update: function (old) {
      if (old && old.calidad && old.calidad !== this.data.calidad) this.aplicarCalidad();
    },

    aplicarCalidad: function () {
      var q = CALIDADES[this.data.calidad] || CALIDADES.media;
      var r = this.el.renderer;
      if (!r) return;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.el.querySelectorAll('[light]').forEach(function (le) {
        var l = le.getObject3D('light');
        if (!l || !l.shadow || le.getAttribute('light').castShadow !== true) return;
        l.castShadow = q.sombras;
        if (l.shadow.mapSize.x !== q.mapa) {
          l.shadow.mapSize.set(q.mapa, q.mapa);
          if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
        }
      });
      // Forzar recompilación de materiales para activar/desactivar sombras
      this.el.object3D.traverse(function (o) {
        if (o.material) [].concat(o.material).forEach(function (m) { m.needsUpdate = true; });
      });
      // Tamaño del lienzo según el nuevo pixelRatio
      if (this.el.resize) this.el.resize();
      this.el.emit('calidad-cambiada', { calidad: this.data.calidad });
    }
  });

  AFRAME.registerComponent('lampara-billar', {
    schema: { altura: { type: 'number', default: 1.0 } },  // sobre el paño
    init: function () {
      var g = new THREE.Group();
      var wood = new THREE.MeshPhysicalMaterial({ map: TX.woodTexture(1, 1), roughness: 0.4, clearcoat: 0.6 });
      var shadeMat = new THREE.MeshStandardMaterial({ color: '#1f3b2c', roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide });
      var brass = new THREE.MeshStandardMaterial({ color: '#b8925a', roughness: 0.3, metalness: 1 });
      var glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.94, 0.82).multiplyScalar(3) });
      var h = this.data.altura;

      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.1), wood);
      bar.position.y = h + 0.17;
      g.add(bar);
      [-0.7, 0, 0.7].forEach(function (x) {
        var shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.2, 0.16, 32, 1, true), shadeMat);
        shade.position.set(x, h + 0.06, 0);
        g.add(shade);
        var bulb = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), glow);
        bulb.rotation.x = Math.PI / 2;
        bulb.position.set(x, h + 0.02, 0);
        g.add(bulb);
        var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), brass);
        rod.position.set(x, h + 0.19 - 0.045 + 0.0, 0);
        g.add(rod);
      });
      [-0.8, 0.8].forEach(function (x) {   // cadenas al techo
        var chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), brass);
        chain.position.set(x, h + 0.8, 0);
        g.add(chain);
      });
      this.el.setObject3D('mesh', g);
    },
    remove: function () { this.el.removeObject3D('mesh'); }
  });
})();
