/* ==========================================================================
   AR POOL 8 — ar-app.js  (archivo principal de la experiencia)
   Une la escena A-Frame con la interfaz:
     · Preferencias y estadísticas en LocalStorage
     · Controles de teclado, ratón y táctiles para el taco
     · Eventos del raycaster (clic en bolas y en el paño)
     · Indicadores de fuerza y dirección
     · Estado del tiro (física), sonido y botón para volver a armar
     · Botón AR: AR WebXR real o vista con cámara (iPhone)
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
  var prefs = leer(CLAVE_PREFS, { calidad: 'media', camara: 'libre', guia: true, sonido: true });
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
    var fisica = mesaEl.components['fisica-mesa'];
    var ar = scene.components['modo-ar'];
    var SND = window.ARPOOL.sonido;
    function enVistaReal() { return ar && ar.modo !== 'escritorio'; }

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
    function pintarSonido() {
      SND.setActivo(prefs.sonido);
      $('ico-sonido').textContent = prefs.sonido ? '🔊' : '🔇';
      $('lbl-sonido').textContent = prefs.sonido ? 'Sonido' : 'Silencio';
    }
    pintarSonido();

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
    tacoEl.addEventListener('taco-golpe', function () {
      stats.golpesPractica++;
      guardar(CLAVE_STATS, stats);
      $('hud-golpes').textContent = stats.golpesPractica;
      ocultarFicha();
    });

    // ------------------------------------------------------- Física: estado del tiro
    mesaEl.addEventListener('tiro-iniciado', function () {
      $('hud-turno').textContent = 'Bolas en movimiento…';
    });
    var nombresBola = function (lista) {
      return lista.map(function (n) { return n === 0 ? 'la blanca' : 'la ' + n; }).join(', ');
    };
    mesaEl.addEventListener('bolas-quietas', function (e) {
      var r = e.detail;
      taco.liberar();
      $('hud-turno').textContent = 'Tu turno';
      if (r.reacomodo) { $('hud-bolas').textContent = 15; aviso('Triángulo armado', 1400); return; }
      if (r.enMesa !== undefined) $('hud-bolas').textContent = r.enMesa;
      var objetivo = (r.embocadas || []).filter(function (n) { return n !== 0; });
      var msg = [];
      if (objetivo.length) msg.push('¡Embocaste ' + nombresBola(objetivo) + '!');
      if (r.blancaEmbocada) msg.push('Bola blanca embocada: vuelve a la cabecera');
      else if (r.primerContacto === null) msg.push('La blanca no tocó ninguna bola');
      if (r.enMesa === 0) msg.push('Mesa limpia 🎱 · pulsa △ para armar de nuevo');
      if (msg.length) aviso(msg.join('<br>'), 2600);
      SND.turno();
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
    function alternarSonido() {
      prefs.sonido = !prefs.sonido; guardar(CLAVE_PREFS, prefs); pintarSonido();
    }
    $('btn-sonido').addEventListener('click', alternarSonido);
    function reacomodar() {
      if (fisica.enMovimiento()) { aviso('Espera a que las bolas se detengan', 1400); return; }
      fisica.reacomodar();
    }
    $('btn-reacomodar').addEventListener('click', reacomodar);

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
      // la fuerza depende del tiempo presionado (no de los FPS)
      potencia = Math.min(1, (performance.now() - inicioCarga) / 1300);
      taco.cargar(potencia);
      if (!taco.soltar()) aviso('Mantén presionado más tiempo para cargar fuerza', 1500);
    }

    // Bucle de entrada (rotación continua y carga de fuerza)
    var ultimo = performance.now();
    (function bucle(ahora) {
      var dt = Math.min((ahora - ultimo) / 1000, 0.05);
      ultimo = ahora;
      if (giro !== 0) {
        if (enVistaReal()) ar.ajustarPunteria(giro * (fino ? 4 : 20) * dt);
        else taco.girar(giro * (fino ? 6 : 50) * dt);
      }
      if (cargando) {
        potencia = Math.min(1, (performance.now() - inicioCarga) / 1300);   // 1.3 s para fuerza máxima (independiente de los FPS)
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
        case 'KeyR': reacomodar(); break;
        case 'KeyM': alternarSonido(); break;
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
      if (window.ARPOOL.input.arrastro || taco.ocupado() || enVistaReal()) return;
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

    // ------------------------------------------------------- Realidad aumentada
    var capacidades = { webxr: false, camara: false };
    ar.capacidades().then(function (c) {
      capacidades = c;
      var chip = $('estado-ar');
      if (c.webxr) {
        $('lbl-ar').textContent = 'Ver en AR';
        chip.textContent = 'AR WebXR disponible · pulsa ◎';
        chip.className = 'chip si';
      } else if (c.camara) {
        $('lbl-ar').textContent = 'Cámara';
        chip.textContent = c.ios
          ? 'iPhone: sin WebXR · ◎ abre la vista con cámara'
          : 'Sin WebXR AR · ◎ abre la vista con cámara';
        chip.className = 'chip medio';
      } else {
        vistaPedida = null;
        $('btn-ar').disabled = true;
        chip.textContent = window.isSecureContext ? 'Sin cámara ni WebXR · modo 3D' : 'AR y cámara requieren HTTPS · modo 3D';
        chip.className = 'chip no';
      }
      if (vistaPedida === 'camara' || vistaPedida === 'ar') {
        if (c.webxr) {
          $('inicio-titulo').textContent = 'Realidad aumentada';
          $('inicio-texto').innerHTML = 'Apunta al suelo, espera el aro verde y toca la pantalla para colocar la mesa.';
          $('btn-iniciar-real').textContent = 'INICIAR AR';
        }
        $('inicio-real').classList.remove('oculto');
      }
    });

    function abrirVistaReal() {
      if (capacidades.webxr) ar.entrarWebXR();
      else if (capacidades.camara) {
        aviso('Abriendo la cámara… acepta los permisos de cámara y movimiento', 2600);
        ar.entrarCamara();
      }
    }
    // Desde el menú: ar-experiencia.html?vista=camara (o ?vista=ar) → pantalla para abrir con un toque
    var vistaPedida = new URLSearchParams(location.search).get('vista');
    $('btn-iniciar-real').addEventListener('click', function () {
      $('inicio-real').classList.add('oculto');
      abrirVistaReal();
    });
    $('btn-solo-3d').addEventListener('click', function () { $('inicio-real').classList.add('oculto'); });

    $('btn-ar').addEventListener('click', function () {
      if (enVistaReal()) { ar.salir(); return; }
      if (fisica.enMovimiento()) { aviso('Espera a que las bolas se detengan', 1400); return; }
      abrirVistaReal();
    });
    $('btn-salir-ar').addEventListener('click', function () { ar.salir(); });
    $('btn-mover').addEventListener('click', function () { ar.moverMesa(); });
    $('btn-escala').addEventListener('click', function () {
      var e = ar.cambiarEscala();
      $('lbl-escala').textContent = Math.round(e * 100) + '%';
      aviso(e === 1 ? 'Escala real (mesa de 9 pies)' : 'Escala ' + Math.round(e * 100) + '% (mesa en miniatura)', 1500);
    });

    function guiaAR(texto) {
      var g = $('guia-ar');
      g.innerHTML = texto || '';
      g.classList.toggle('oculto', !texto);
    }
    scene.addEventListener('modo-vista', function (e) {
      var m = e.detail.modo;
      $('panel-ar').classList.toggle('oculto', m === 'escritorio');
      $('btn-camara').disabled = m !== 'escritorio';
      $('lbl-ar').textContent = m === 'escritorio' ? (capacidades.webxr ? 'Ver en AR' : 'Cámara') : 'Salir';
      $('lbl-escala').textContent = '100%';
      ar.centrarPunteria();
      ocultarFicha();
      if (m === 'camara') {
        guiaAR('<b>Vista con cámara</b> · gira el teléfono para mirar la mesa<br>' +
          '1 dedo: girar la mesa · 2 dedos: acercar o alejar · el taco apunta desde donde miras');
        setTimeout(function () { guiaAR(''); }, 7000);
      } else if (m === 'escritorio') {
        guiaAR('');
      }
    });
    scene.addEventListener('ar-colocando', function (e) {
      guiaAR(e.detail.hitTest
        ? 'Mueve el teléfono despacio apuntando al <b>suelo</b>.<br>Cuando veas el aro verde, <b>toca la pantalla</b> para colocar la mesa.'
        : 'Toca la pantalla para colocar la mesa delante de ti.');
    });
    scene.addEventListener('mesa-colocada', function () {
      if (ar.modo === 'webxr') {
        guiaAR('Mesa colocada · camina alrededor: el taco apunta desde donde estás hacia la blanca');
        setTimeout(function () { guiaAR(''); }, 4500);
      }
    });
    scene.addEventListener('ar-error', function (e) { aviso(e.detail.mensaje, 4500); });
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
        ? { clase: 'si', texto: 'WebXR AR disponible' }
        : { clase: 'no', texto: 'Este dispositivo no ofrece AR WebXR · modo 3D' };
    }).catch(function () { return { clase: 'no', texto: 'No se pudo comprobar WebXR · modo 3D' }; });
  }
  window.ARPOOL.detectarAR = detectarAR;
})();
