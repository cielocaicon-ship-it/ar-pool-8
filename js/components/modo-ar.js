/* ==========================================================================
   Componente A-Frame: modo-ar   (va en <a-scene>)
   Dos formas de ver la mesa en tu habitación:

   1) AR WebXR (Android con Chrome, Meta Quest, etc.)  → AR AUTÉNTICA
      · Sesión 'immersive-ar' con hit-test: detecta el suelo y muestra una retícula.
      · Tocas la pantalla y la mesa queda anclada a escala real en ese punto.
      · Puedes caminar alrededor; el taco apunta hacia donde estás tú.

   2) Vista con cámara (iPhone / navegadores sin WebXR)  → NO es AR completa
      · Usa la cámara trasera como fondo y el giroscopio para la orientación.
      · La mesa se mantiene en su sitio al GIRAR el teléfono, pero no detecta
        el suelo ni sigue tus pasos (iOS no ofrece WebXR en el navegador).

   Eventos: 'modo-vista' {modo: 'escritorio' | 'webxr' | 'camara'}
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;

  AFRAME.registerComponent('modo-ar', {
    schema: {
      raiz: { type: 'selector', default: '#mesa-raiz' },
      mesa: { type: 'selector', default: '#mesa' },
      camara: { type: 'selector', default: '#camara' },
      taco: { type: 'selector', default: '#taco' },
      video: { type: 'selector', default: '#video-camara' },
      reticula: { type: 'selector', default: '#reticula' }
    },

    init: function () {
      this.modo = 'escritorio';
      this.colocando = false;
      this.hitSource = null;
      this.offsetAngulo = 0;       // ajuste fino del taco (◀ ▶) en AR
      this.distancia = 1.8;        // distancia de la mesa en la vista con cámara
      this.escala = 1;
      this.stream = null;
      this.punteros = new Map();
      this.tmp = new THREE.Vector3();
      this.tmp2 = new THREE.Vector3();
      this.guardado = null;

      this.onSelect = this.onSelect.bind(this);
      this.onEnterVR = this.onEnterVR.bind(this);
      this.onExitVR = this.onExitVR.bind(this);
      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.el.addEventListener('enter-vr', this.onEnterVR);
      this.el.addEventListener('exit-vr', this.onExitVR);

      // Los toques sobre los paneles de la interfaz no deben recolocar la mesa
      var hud = document.getElementById('hud');
      if (hud) hud.addEventListener('beforexrselect', function (e) { if (e.target !== hud) e.preventDefault(); });
    },

    // ------------------------------------------------------- Capacidades
    capacidades: function () {
      var r = { webxr: false, camara: false, ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) };
      r.camara = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;
      if (!navigator.xr || !navigator.xr.isSessionSupported || !window.isSecureContext) return Promise.resolve(r);
      return navigator.xr.isSessionSupported('immersive-ar')
        .then(function (ok) { r.webxr = ok; return r; })
        .catch(function () { return r; });
    },

    // ------------------------------------------------------- Comunes
    prepararEscenaReal: function () {
      var scene = this.el;
      this.guardado = {
        // copias (A-Frame reutiliza el objeto de datos al quitar el componente)
        background: Object.assign({}, scene.getAttribute('background')),
        fog: Object.assign({}, scene.getAttribute('fog')),
        raizPos: this.data.raiz.object3D.position.clone(),
        raizRot: this.data.raiz.object3D.rotation.y,
        raizEsc: this.data.raiz.object3D.scale.x
      };
      scene.removeAttribute('background');
      scene.removeAttribute('fog');
      scene.object3D.background = null;
      scene.querySelectorAll('.solo-escritorio').forEach(function (e) { e.setAttribute('visible', false); });
      // sin lámpara: algo más de luz ambiente para que la mesa no quede oscura
      var amb = document.getElementById('luz-ambiente');
      if (amb) amb.setAttribute('light', 'intensity', 0.9);
      var sol = document.getElementById('luz-principal');
      if (sol) sol.setAttribute('light', 'intensity', 2.1);
      this.data.camara.setAttribute('camara-orbita', 'habilitada', false);
      document.body.classList.add('vista-real');
    },

    restaurarEscena: function () {
      var scene = this.el, g = this.guardado;
      if (g) {
        if (g.background) scene.setAttribute('background', g.background);
        if (g.fog) scene.setAttribute('fog', g.fog);
        var raiz = this.data.raiz.object3D;
        raiz.position.copy(g.raizPos); raiz.rotation.y = g.raizRot; raiz.scale.setScalar(g.raizEsc);
        raiz.visible = true;
      }
      scene.querySelectorAll('.solo-escritorio').forEach(function (e) { e.setAttribute('visible', true); });
      // en vista superior la lámpara se mantiene oculta
      var lamp = document.getElementById('lampara');
      var orb = this.data.camara.getAttribute('camara-orbita');
      if (lamp && orb && orb.modo === 'superior') lamp.setAttribute('visible', false);
      var amb = document.getElementById('luz-ambiente');
      if (amb) amb.setAttribute('light', 'intensity', 0.22);
      var sol = document.getElementById('luz-principal');
      if (sol) sol.setAttribute('light', 'intensity', 1.1);
      var cam = this.data.camara;
      cam.setAttribute('look-controls', 'enabled', false);
      cam.object3D.rotation.set(0, 0, 0);
      cam.setAttribute('camara-orbita', 'habilitada', true);
      if (cam.components['camara-orbita']) cam.components['camara-orbita'].snap = true;
      if (this.data.reticula) this.data.reticula.object3D.visible = false;
      document.body.classList.remove('vista-real', 'vista-camara', 'vista-webxr');
      this.escala = 1;
      this.cambiarModo('escritorio');
    },

    cambiarModo: function (m) {
      this.modo = m;
      this.el.emit('modo-vista', { modo: m });
    },

    // ======================================================= 1) WebXR AR
    entrarWebXR: function () {
      var self = this;
      function error(err) {
        self.el.emit('ar-error', { mensaje: 'No se pudo iniciar la sesión AR: ' + (err && err.message ? err.message : err) });
      }
      try { return Promise.resolve(this.el.enterAR()).catch(error); }
      catch (err) { error(err); return Promise.resolve(); }
    },

    onEnterVR: function () {
      if (!this.el.is('ar-mode')) return;
      this.prepararEscenaReal();
      document.body.classList.add('vista-webxr');
      // En XR la pose de la cámara la da el visor: la entidad queda en el origen
      var cam = this.data.camara.object3D;
      cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); cam.up.set(0, 1, 0);
      this.data.raiz.object3D.visible = false;      // hasta que el jugador la coloque
      this.colocando = true;
      this.cambiarModo('webxr');

      var session = this.el.renderer.xr.getSession(), self = this;
      this.session = session;
      session.addEventListener('select', this.onSelect);
      if (session.requestHitTestSource) {
        session.requestReferenceSpace('viewer').then(function (vs) {
          return session.requestHitTestSource({ space: vs });
        }).then(function (src) { self.hitSource = src; })
          .catch(function () { self.hitSource = null; });
      }
      this.el.emit('ar-colocando', { hitTest: !!session.requestHitTestSource });
    },

    onExitVR: function () {
      if (this.modo !== 'webxr') return;
      if (this.hitSource) { try { this.hitSource.cancel(); } catch (e) { /* */ } }
      this.hitSource = null;
      if (this.session) this.session.removeEventListener('select', this.onSelect);
      this.session = null;
      this.colocando = false;
      this.restaurarEscena();
    },

    salirWebXR: function () { if (this.el.is('ar-mode')) this.el.exitVR(); },

    /** Toque en la pantalla durante AR: coloca la mesa en la retícula */
    onSelect: function () {
      if (!this.colocando) return;
      var ret = this.data.reticula;
      var pos;
      if (ret && ret.object3D.visible) pos = ret.object3D.position.clone();
      else {
        // sin hit-test: 1.6 m delante, en el suelo estimado
        pos = this.puntoDelante(1.8);
        pos.y = this.alturaSuelo();
      }
      this.colocarEn(pos);
    },

    colocarEn: function (pos) {
      var raiz = this.data.raiz.object3D;
      raiz.position.copy(pos);
      // La cabecera (donde está la blanca) mira hacia el jugador
      var cam = new THREE.Vector3();
      this.el.camera.getWorldPosition(cam);
      raiz.rotation.y = Math.atan2(-(pos.z - cam.z), pos.x - cam.x);
      raiz.scale.setScalar(this.escala);
      raiz.visible = true;
      this.colocando = false;
      if (this.data.reticula) this.data.reticula.object3D.visible = false;
      this.el.emit('mesa-colocada', { escala: this.escala });
    },

    moverMesa: function () {
      if (this.modo === 'webxr') {
        this.colocando = true;
        this.data.raiz.object3D.visible = false;
        this.el.emit('ar-colocando', { hitTest: !!this.hitSource });
      } else if (this.modo === 'camara') {
        this.colocarDelante();
      }
    },

    cambiarEscala: function () {
      var orden = [1, 0.5, 0.25];
      this.escala = orden[(orden.indexOf(this.escala) + 1) % orden.length];
      var raiz = this.data.raiz.object3D;
      raiz.scale.setScalar(this.escala);
      if (this.modo === 'camara') this.colocarDelante();
      return this.escala;
    },

    // ======================================================= 2) Vista con cámara
    entrarCamara: function () {
      var self = this;
      // iOS exige pedir permiso del giroscopio dentro del toque del usuario
      var permiso = Promise.resolve('granted');
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        permiso = DeviceOrientationEvent.requestPermission().catch(function () { return 'denied'; });
      }
      var video = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      return Promise.all([permiso, video]).then(function (r) {
        self.stream = r[1];
        var v = self.data.video;
        v.srcObject = self.stream;
        v.setAttribute('playsinline', '');
        v.muted = true;
        return v.play().then(function () { return r[0]; });
      }).then(function (estadoPermiso) {
        if (estadoPermiso === 'granted') {
          // avisar a look-controls de A-Frame que ya puede leer el giroscopio
          var ui = self.el.components['device-orientation-permission-ui'];
          if (ui) ui.permissionGranted = true;
          self.el.emit('deviceorientationpermissiongranted');
        }
        self.prepararEscenaReal();
        document.body.classList.add('vista-camara');
        var cam = self.data.camara;
        cam.object3D.position.set(0, 1.35, 0);   // altura aproximada del teléfono
        cam.object3D.up.set(0, 1, 0);
        cam.setAttribute('look-controls', { enabled: true, magicWindowTrackingEnabled: true, touchEnabled: false, mouseEnabled: false });
        self.cambiarModo('camara');
        var canvas = self.el.canvas;
        canvas.addEventListener('pointerdown', self.onDown);
        window.addEventListener('pointermove', self.onMove);
        window.addEventListener('pointerup', self.onUp);
        window.addEventListener('pointercancel', self.onUp);
        // ¿Llegan datos del giroscopio? Si no (permiso negado o computador con webcam),
        // la cámara queda fija mirando un poco hacia abajo y la mesa se gira con el dedo.
        self.giroscopio = false;
        var detectar = function (ev) { if (ev.beta !== null && ev.beta !== undefined) self.giroscopio = true; };
        window.addEventListener('deviceorientation', detectar);
        setTimeout(function () {
          window.removeEventListener('deviceorientation', detectar);
          if (!self.giroscopio) {
            cam.setAttribute('look-controls', 'enabled', false);
            cam.object3D.rotation.set(-0.32, 0, 0);
            self.el.emit('ar-error', { mensaje: estadoPermiso !== 'granted'
              ? 'Sin permiso del giroscopio: la vista queda fija. Gira la mesa con un dedo.'
              : 'Este dispositivo no envía datos del giroscopio: la vista queda fija. Gira la mesa con un dedo.' });
          }
          self.colocarDelante();
        }, 900);
      }).catch(function (err) {
        self.detenerVideo();
        self.el.emit('ar-error', { mensaje: 'No se pudo abrir la cámara: ' + (err && err.name === 'NotAllowedError' ? 'permiso denegado' : (err && err.message) || err) });
      });
    },

    salirCamara: function () {
      if (this.modo !== 'camara') return;
      this.detenerVideo();
      var canvas = this.el.canvas;
      canvas.removeEventListener('pointerdown', this.onDown);
      window.removeEventListener('pointermove', this.onMove);
      window.removeEventListener('pointerup', this.onUp);
      window.removeEventListener('pointercancel', this.onUp);
      this.restaurarEscena();
    },

    detenerVideo: function () {
      if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
      this.stream = null;
      if (this.data.video) this.data.video.srcObject = null;
    },

    salir: function () {
      if (this.modo === 'webxr') this.salirWebXR();
      else if (this.modo === 'camara') this.salirCamara();
    },

    puntoDelante: function (dist) {
      var cam = this.el.camera, p = new THREE.Vector3(), d = new THREE.Vector3();
      cam.getWorldPosition(p); cam.getWorldDirection(d);
      d.y = 0;
      if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
      d.normalize();
      return p.addScaledVector(d, dist);
    },
    alturaSuelo: function () {
      var p = new THREE.Vector3();
      this.el.camera.getWorldPosition(p);
      return p.y - 1.35;
    },

    /** Vista con cámara: la mesa se coloca en el suelo, delante del teléfono */
    colocarDelante: function () {
      var dist = this.distancia * Math.max(0.45, this.escala) + 1.2 * this.escala;
      var pos = this.puntoDelante(dist);
      pos.y = 0;
      this.colocarEn(pos);
    },

    // Gestos en la vista con cámara: 1 dedo gira la mesa, 2 dedos la acercan o alejan
    onDown: function (e) {
      if (e.target !== this.el.canvas) return;
      this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.punteros.size === 2) this.dist0 = this.distPunteros();
    },
    onMove: function (e) {
      var p = this.punteros.get(e.pointerId);
      if (!p) return;
      var dx = e.clientX - p.x;
      p.x = e.clientX; p.y = e.clientY;
      var raiz = this.data.raiz.object3D;
      if (this.punteros.size >= 2) {
        var d = this.distPunteros();
        if (this.dist0) {
          var f = this.dist0 / d;   // separar dedos = acercar
          var cam = new THREE.Vector3();
          this.el.camera.getWorldPosition(cam);
          var v = raiz.position.clone().sub(cam); v.y = 0;
          var L = THREE.MathUtils.clamp(v.length() * f, 0.6, 6);
          v.setLength(L);
          raiz.position.set(cam.x + v.x, raiz.position.y, cam.z + v.z);
        }
        this.dist0 = d;
      } else {
        raiz.rotation.y += dx * 0.006;
      }
    },
    onUp: function (e) { this.punteros.delete(e.pointerId); if (this.punteros.size < 2) this.dist0 = 0; },
    distPunteros: function () {
      var a = Array.from(this.punteros.values());
      return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
    },

    // ======================================================= Cada cuadro
    tick: function () {
      if (this.modo === 'escritorio') return;

      // Retícula del hit-test (solo AR WebXR, mientras se coloca la mesa)
      if (this.modo === 'webxr' && this.colocando && this.hitSource && this.el.frame) {
        var ref = this.el.renderer.xr.getReferenceSpace();
        var res = this.el.frame.getHitTestResults(this.hitSource);
        var ret = this.data.reticula.object3D;
        if (res.length && ref) {
          var pose = res[0].getPose(ref);
          if (pose) {
            var m = new THREE.Matrix4().fromArray(pose.transform.matrix);
            var pos = new THREE.Vector3().setFromMatrixPosition(m);
            ret.position.copy(pos);
            ret.visible = true;
          }
        } else ret.visible = false;
      }

      // Puntería con el cuerpo: el taco apunta desde donde está el jugador hacia la blanca
      var taco = this.data.taco && this.data.taco.components['taco-billar'];
      var raiz = this.data.raiz.object3D;
      if (taco && raiz.visible && (taco.estado === 'reposo')) {
        var cam = this.tmp;
        this.el.camera.getWorldPosition(cam);
        this.data.mesa.object3D.worldToLocal(cam);
        var b = taco.posBlanca();
        var dx = b.x - cam.x, dz = b.z - cam.z;
        if (dx * dx + dz * dz > 1e-4) {
          var ang = Math.atan2(-dz, dx) * 180 / Math.PI + this.offsetAngulo;
          if (Math.abs(((ang - taco.angulo + 540) % 360) - 180) > 0.05) taco.setAngulo(ang);
        }
      }
    },

    ajustarPunteria: function (deltaGrados) {
      this.offsetAngulo = THREE.MathUtils.clamp(this.offsetAngulo + deltaGrados, -45, 45);
    },
    centrarPunteria: function () { this.offsetAngulo = 0; },

    remove: function () {
      this.el.removeEventListener('enter-vr', this.onEnterVR);
      this.el.removeEventListener('exit-vr', this.onExitVR);
      this.detenerVideo();
    }
  });
})();
