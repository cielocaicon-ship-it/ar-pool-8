/* ==========================================================================
   Componentes A-Frame: bola-billar y triangulo-bolas
   - bola-billar: una bola pulida (material PBR con barniz) + sombra de
     contacto. Expone rodar(dx, dz) para que la rotación visual coincida
     con el desplazamiento (se usará con la física en la Etapa 2).
   - triangulo-bolas: crea las 16 <a-entity> de bola en su posición de armado.
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;
  var TX = window.ARPOOL.textures;
  var sharedGeo = null, shadowGeo = null, shadowMat = null;

  AFRAME.registerComponent('bola-billar', {
    schema: {
      numero: { type: 'int', default: 0 }
    },

    init: function () {
      var R = cfg.BALL.radius;
      var n = this.data.numero;
      if (!sharedGeo) {
        sharedGeo = new THREE.SphereGeometry(R, 48, 32);
        shadowGeo = new THREE.PlaneGeometry(R * 3.2, R * 3.2);
        shadowMat = new THREE.MeshBasicMaterial({
          map: TX.contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85
        });
      }
      // Material de resina fenólica: base lisa + capa de barniz brillante
      this.material = new THREE.MeshPhysicalMaterial({
        map: TX.ballTexture(n),
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.1
      });
      this.ball = new THREE.Mesh(sharedGeo, this.material);
      this.ball.castShadow = true;
      this.ball.receiveShadow = true;
      // Orientación inicial aleatoria (como cuando se arma el triángulo a mano),
      // pero dejando el número algo visible hacia arriba.
      this.ball.rotation.set(-0.9 + Math.random() * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);

      this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.y = -R + 0.0007;   // justo sobre el paño
      this.shadow.renderOrder = 1;

      var root = new THREE.Group();
      root.add(this.shadow);
      root.add(this.ball);
      this.el.setObject3D('mesh', root);
      this.el.classList.add('interactivo');
      this.el.setAttribute('data-bola', n);
    },

    /** Gira la bola como si rodara sin deslizar dx, dz metros sobre el paño. */
    rodar: function (dx, dz) {
      var dist = Math.hypot(dx, dz);
      if (dist < 1e-7) return;
      var axis = new THREE.Vector3(dz, 0, -dx).normalize();   // eje = arriba × dirección
      var q = new THREE.Quaternion().setFromAxisAngle(axis, dist / cfg.BALL.radius);
      this.ball.quaternion.premultiply(q);
    },

    remove: function () {
      this.el.removeObject3D('mesh');
      this.material.dispose();
    }
  });

  AFRAME.registerComponent('triangulo-bolas', {
    init: function () {
      var el = this.el;
      var R = cfg.BALL.radius;
      window.ARPOOL.rack.buildRack().forEach(function (b) {
        var ball = document.createElement('a-entity');
        ball.setAttribute('id', 'bola-' + b.number);
        ball.setAttribute('bola-billar', 'numero: ' + b.number);
        ball.setAttribute('position', b.x + ' ' + R + ' ' + b.z);
        el.appendChild(ball);
      });
    }
  });
})();
