/* ==========================================================================
   AR POOL 8 — ar-app.js  (archivo principal de la experiencia)
   Une la escena A-Frame con la interfaz:
     · Preferencias y estadísticas en LocalStorage
     · Controles de teclado, ratón y táctiles para el taco
     · Eventos del raycaster (clic en bolas y en el paño)
     · Indicadores de fuerza y dirección
     · Detección de compatibilidad WebXR AR (la sesión AR llega en la Etapa 5)
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;
  var TX = window.ARPOOL.textures;

  // ------------------------------------------------------------------ Piso
  AFRAME.registerComponent('piso-madera', {
    init: function () {
      var mat = new THREE.MeshStandardMaterial({
        map: TX.woodTexture(5, 22, 'floor'), color: '#7a6a5e', roughness: 0.7, metalness: 0, envMapIntensity: 0.25
      });
      var apply = function () {
        var m = this.el.getObject3D('mesh');
        if (!m) return;
        m.material = mat;
        m.receiveShadow = true;
      }.bind(this);
      this.el.addEventListener('object3dset', apply);
      apply();
    }
  });

  // ------------------------------------------------------------ LocalStorage
  var CLAVE_PREFS = 'arpool8.prefs';
  var CLAVE_STATS = 'arpool8.stats';
  var CLAVE_NOMBRE = 'arpool8.nombre';
  function leer(clave, def) {
    try { var v = JSON.parse(localStorage.getItem(clave)); return v && typeof v === 'object' ? Object.assign({}, def, v) : def; }
    catch (e) { return def; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* modo privado */ }
  }
  var prefs = leer(CLAVE_PREFS, { calidad: 'media', camara: 'libre', guia: true });
  var stats = leer(CLAVE_STATS, { golpesPractica: 0, sesiones: 0 });
  stats.sesiones++;
  guardar(CLAVE_STATS, stats);

  window.ARPOOL.app = { prefs: prefs, stats: stats };

  // ------------------------------------------------------------ Arranque
  document.addEventListener('DOMContentLoaded', function () {
    var scene = document.getElementById('escena');
    if (scene.hasLoaded) iniciar(scene); else scene.addEventListener('loaded', function () { iniciar(scene); });
  });

  function iniciar(scene) {
    var $ = function (id) { return document.getElementById(id); };
    var tacoEl = $('taco'), camEl = $('camara'), selEl = $('seleccion'), mesaEl = $('mesa');
    var taco = tacoEl.components['taco-billar'];
    var cam = camEl.components['camara-orbita'];

    var NOMBRES_CAM = { libre: 'Libre', tiro: 'Tiro', superior: 'Superior' };
    var NOMBRES_CAL = { baja: 'Baja', media: 'Media', alta: 'Alta' };

    // --- aplicar preferencias guardadas
    scene.setAttribute('escena-realista', 'calidad', prefs.calidad);
    camEl.setAttribute('camara-orbita', 'modo', prefs.camara);
    tacoEl.setAttribute('taco-billar', 'guia', prefs.guia);
    $('lbl-calidad').textContent = NOMBRES_CAL[prefs.calidad];
    $('lbl-camara').textContent = NOMBRES_CAM[prefs.camara];
    $('lbl-guia').textContent = prefs.guia ? 'Guía sí' : 'Guía no';
    $('hud-jugador').textContent = localStorage.getItem(CLAVE_NOMBRE) || 'Jugador';
    $('hud-golpes').textContent = stats.golpesPractica;

    // ------------------------------------------------------- Mensajes
    var toastTimer = null;
    function aviso(texto, ms) {
      var t = $('toast');
      t.innerHTML = texto;
      t.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.remove('visible'); }, ms || 2600);
    }
    window.ARPOOL.app.aviso = aviso;

    // ------------------------------------------------------- Indicadores
    tacoEl.addEventListener('taco-angulo', function (e) {
      var a = e.detail.angulo;
      $('hud-angulo').textContent = a.toFixed(1) + '°';
      $('flecha').setAttribute('transform', 'rotate(' + (-a) + ' 50 50)');
    });
    tacoEl.addEventListener('taco-potencia', function (e) {
      var p = Math.round(e.detail.potencia * 100);
      $('barra-fuerza').style.height = p + '%';
      $('hud-fuerza').textContent = p + '%';
    });
    tacoEl.addEventListener('taco-golpe', function (e) {
      stats.golpesPractica++;
      guardar(CLAVE_STATS, stats);
      $('hud-golpes').textContent = stats.golpesPractica;
      var c = taco.ultimoContacto;
      var destino = c ? (c.tipo === 'bola' ? 'la bola ' + c.bola : 'la banda') : '—';
      aviso('Golpe registrado · ' + Math.round(e.detail.potencia * 100) + '% de fuerza · ' +
        e.detail.angulo.toFixed(1) + '°<br><small>Primer contacto previsto: ' + destino +
        '. Las bolas se moverán cuando se integre la física (Etapa 2).</small>', 3600);
    });
    taco.setAngulo(taco.angulo);

    // ------------------------------------------------------- Botones
    $('btn-camara').addEventListener('click', function () {
      cam.siguienteModo();
    });
    function lamparaSegunCamara(modo) {   // en vista superior la lámpara taparía la mesa
      $('lampara').setAttribute('visible', modo !== 'superior');
    }
    lamparaSegunCamara(prefs.camara);
    camEl.addEventListener('camara-modo', function (e) {
      lamparaSegunCamara(e.detail.modo);
      prefs.camara = e.detail.modo; guardar(CLAVE_PREFS, prefs);
      $('lbl-camara').textContent = NOMBRES_CAM[e.detail.modo];
      aviso('Cámara: ' + NOMBRES_CAM[e.detail.modo], 1200);
    });
    $('btn-guia').addEventListener('click', alternarGuia);
    function alternarGuia() {
      prefs.guia = !prefs.guia; guardar(CLAVE_PREFS, prefs);
      tacoEl.setAttribute('taco-billar', 'guia', prefs.guia);
      $('lbl-guia').textContent = prefs.guia ? 'Guía sí' : 'Guía no';
    }
    $('btn-calidad').addEventListener('click', function () {
      var orden = ['baja', 'media', 'alta'];
      prefs.calidad = orden[(orden.indexOf(prefs.calidad) + 1) % 3];
      guardar(CLAVE_PREFS, prefs);
      scene.setAttribute('escena-realista', 'calidad', prefs.calidad);
      $('lbl-calidad').textContent = NOMBRES_CAL[prefs.calidad];
      aviso('Calidad gráfica: ' + NOMBRES_CAL[prefs.calidad], 1200);
    });
    function ayuda(mostrar) { $('ayuda').classList.toggle('oculto', !mostrar); }
    $('btn-ayuda').addEventListener('click', function () { ayuda(true); });
    $('btn-cerrar-ayuda').addEventListener('click', function () { ayuda(false); });

    // ------------------------------------------------------- Giro y golpe
    var giro = 0;           // -1, 0, 1 (botones / teclas mantenidas)
    var fino = false;
    var cargando = false, potencia = 0, inicioCarga = 0;
    function empezarCarga() {
      if (taco.ocupado() || cargando) return;
      cargando = true; potencia = 0; inicioCarga = performance.now();
      $('btn-golpear').classList.add('activo');
    }
    function soltarCarga() {
      if (!cargando) return;
      cargando = false;
      $('btn-golpear').classList.remove('activo');
      if (!taco.soltar()) aviso('Mantén presionado más tiempo para cargar fuerza', 1500);
    }

    // Bucle de entrada (rotación continua y carga de fuerza)
    var ultimo = performance.now();
    (function bucle(ahora) {
      var dt = Math.min((ahora - ultimo) / 1000, 0.05);
      ultimo = ahora;
      if (giro !== 0) taco.girar(giro * (fino ? 6 : 50) * dt);
      if (cargando) {
        potencia = Math.min(1, (ahora - inicioCarga) / 1300);   // 1.3 s para fuerza máxima (independiente de los FPS)
        taco.cargar(potencia);
      }
      requestAnimationFrame(bucle);
    })(ultimo);

    function botonMantener(id, alPresionar, alSoltar) {
      var b = $(id);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.setPointerCapture(e.pointerId); alPresionar(); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, alSoltar); });
    }
    botonMantener('btn-izq', function () { giro = 1; }, function () { giro = 0; });
    botonMantener('btn-der', function () { giro = -1; }, function () { giro = 0; });
    botonMantener('btn-golpear', empezarCarga, soltarCarga);

    // Teclado
    window.addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      fino = e.shiftKey;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': giro = 1; break;
        case 'ArrowRight': case 'KeyD': giro = -1; break;
        case 'Space': e.preventDefault(); if (!e.repeat) empezarCarga(); break;
        case 'KeyC': cam.siguienteModo(); break;
        case 'Digit1': camEl.setAttribute('camara-orbita', 'modo', 'libre'); break;
        case 'Digit2': camEl.setAttribute('camara-orbita', 'modo', 'tiro'); break;
        case 'Digit3': camEl.setAttribute('camara-orbita', 'modo', 'superior'); break;
        case 'KeyG': alternarGuia(); break;
        case 'KeyH': ayuda($('ayuda').classList.contains('oculto')); break;
        case 'Escape': ayuda(false); break;
      }
    });
    window.addEventListener('keyup', function (e) {
      fino = e.shiftKey;
      if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && giro === 1) giro = 0;
      if ((e.code === 'ArrowRight' || e.code === 'KeyD') && giro === -1) giro = 0;
      if (e.code === 'Space') soltarCarga();
    });

    // ------------------------------------------------------- Raycaster + cursor
    // Clic en el paño: apunta el taco a ese punto (si no fue un arrastre de cámara)
    $('zona-apuntado').addEventListener('click', function (e) {
      if (window.ARPOOL.input.arrastro || taco.ocupado()) return;
      var hit = e.detail.intersection;
      if (!hit) return;
      var local = mesaEl.object3D.worldToLocal(hit.point.clone());
      taco.apuntarA(local.x, local.z);
      ocultarFicha();
    });
    // Clic en una bola: ficha informativa + anillo animado
    $('bolas').addEventListener('click', function (e) {
      if (window.ARPOOL.input.arrastro) return;
      var bola = e.target.closest('[bola-billar]');
      if (!bola) return;
      var n = parseInt(bola.getAttribute('data-bola'), 10);
      var p = bola.object3D.position;
      selEl.object3D.position.set(p.x, 0.0012, p.z);
      selEl.setAttribute('visible', true);
      var tipo = cfg.ballType(n);
      $('ficha-bola').innerHTML =
        '<span class="muestra" style="background:' + (n > 8
          ? 'linear-gradient(#f4f1e6 24%,' + cfg.ballColor(n) + ' 24% 76%, #f4f1e6 76%)'
          : cfg.ballColor(n)) + '">' + (n ? '<i>' + n + '</i>' : '') + '</span>' +
        '<div><b>' + cfg.ballName(n) + '</b><br><small>Grupo: ' + tipo + ' · Ø ' + (cfg.BALL.radius * 2000).toFixed(2) + ' mm · ' + (cfg.BALL.mass * 1000) + ' g</small></div>';
      $('ficha-bola').classList.remove('oculto');
    });
    function ocultarFicha() { $('ficha-bola').classList.add('oculto'); selEl.setAttribute('visible', false); }
    // Al pasar el cursor por una bola, se muestra la mano
    scene.addEventListener('raycaster-intersection', function () { scene.canvas.style.cursor = 'pointer'; });
    scene.addEventListener('raycaster-intersection-cleared', function () { scene.canvas.style.cursor = 'grab'; });

    // ------------------------------------------------------- Compatibilidad WebXR
    detectarAR().then(function (r) {
      var chip = $('estado-ar');
      chip.textContent = r.texto;
      chip.className = 'chip ' + r.clase;
    });

    aviso('Mesa de práctica lista · Pulsa <b>H</b> o <b>?</b> para ver los controles', 3200);
  }

  // Comprueba si el navegador ofrece sesiones 'immersive-ar' de WebXR
  function detectarAR() {
    if (!window.isSecureContext) {
      return Promise.resolve({ clase: 'no', texto: 'AR requiere HTTPS · modo 3D' });
    }
    if (!navigator.xr || !navigator.xr.isSessionSupported) {
      return Promise.resolve({ clase: 'no', texto: 'Sin WebXR AR en este navegador · modo 3D' });
    }
    return navigator.xr.isSessionSupported('immersive-ar').then(function (ok) {
      return ok
        ? { clase: 'si', texto: 'WebXR AR disponible · se activa en la Etapa 5' }
        : { clase: 'no', texto: 'Este dispositivo no ofrece AR WebXR · modo 3D' };
    }).catch(function () { return { clase: 'no', texto: 'No se pudo comprobar WebXR · modo 3D' }; });
  }
  window.ARPOOL.detectarAR = detectarAR;
})();
