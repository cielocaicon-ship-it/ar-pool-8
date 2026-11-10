/* ==========================================================================
   AR POOL 8 — sonido-billar.js
   Sonidos sintetizados con Web Audio (no se descarga ningún archivo):
   golpe de taco, choque de bolas, banda, tronera, cambio de turno.
   El volumen depende de la intensidad del impacto y, cuando el navegador
   lo permite, el sonido es espacial (PannerNode HRTF) según dónde ocurre.
   ========================================================================== */
(function () {
  'use strict';
  var ctx = null, master = null, ruido = null;
  var activo = true;
  var ultimos = {};   // limitador para no saturar con muchos choques simultáneos

  function asegurar() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    // búfer de ruido blanco reutilizable
    ruido = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = ruido.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  // Los navegadores solo dejan iniciar audio tras un toque o clic
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      if (asegurar() && ctx.state === 'suspended') ctx.resume();
    }, { passive: true });
  });

  function salida(pos) {
    if (!pos || !ctx.createPanner) return master;
    var p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.8;
    p.rolloffFactor = 0.7;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(master);
    return p;
  }

  function puedeSonar(tipo, separacionMs) {
    var ahora = performance.now();
    if (ultimos[tipo] && ahora - ultimos[tipo] < separacionMs) return false;
    ultimos[tipo] = ahora;
    return true;
  }

  // Ráfaga de ruido filtrado con envolvente rápida
  function rafaga(frec, q, dur, vol, destino, tipoFiltro) {
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = ruido;
    var f = ctx.createBiquadFilter();
    f.type = tipoFiltro || 'bandpass';
    f.frequency.value = frec;
    f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(destino);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }
  function tono(frec, dur, vol, destino, tipo) {
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(frec, t);
    o.frequency.exponentialRampToValueAtTime(frec * 0.92, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function listo() { return activo && asegurar() && ctx.state === 'running'; }
  function vol(intensidad, maxV) { return Math.max(0.03, Math.min(1, intensidad / maxV)); }

  var API = {
    setActivo: function (v) { activo = !!v; },
    activo: function () { return activo; },

    /** Coloca el "oído" en la cámara (posición y orientación del mundo) */
    oyente: function (pos, frente, arriba) {
      if (!ctx || !ctx.listener) return;
      var L = ctx.listener;
      if (L.positionX) {
        L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
        L.forwardX.value = frente.x; L.forwardY.value = frente.y; L.forwardZ.value = frente.z;
        L.upX.value = arriba.x; L.upY.value = arriba.y; L.upZ.value = arriba.z;
      } else {
        L.setPosition(pos.x, pos.y, pos.z);
        L.setOrientation(frente.x, frente.y, frente.z, arriba.x, arriba.y, arriba.z);
      }
    },
    taco: function (potencia, pos) {
      if (!listo()) return;
      var v = 0.25 + potencia * 0.75, o = salida(pos);
      rafaga(1500, 2.5, 0.05, v * 0.9, o);
      tono(620, 0.04, v * 0.25, o, 'triangle');
    },
    bolaBola: function (intensidad, pos) {
      if (!listo() || !puedeSonar('bb', 18)) return;
      var v = vol(intensidad, 4), o = salida(pos);
      rafaga(3800, 3, 0.035, v * 0.9, o);
      tono(2300 + Math.random() * 400, 0.05, v * 0.35, o);
    },
    banda: function (intensidad, pos) {
      if (!listo() || !puedeSonar('banda', 25)) return;
      var v = vol(intensidad, 3), o = salida(pos);
      rafaga(260, 0.9, 0.09, v * 0.8, o, 'lowpass');
      tono(110, 0.08, v * 0.4, o);
    },
    tronera: function (intensidad, pos) {
      if (!listo()) return;
      var v = Math.max(0.35, vol(intensidad, 2.5)), o = salida(pos);
      rafaga(400, 1.2, 0.12, v * 0.8, o, 'lowpass');
      tono(150, 0.14, v * 0.45, o);
      // la bola rueda dentro de la tronera
      setTimeout(function () { if (listo()) rafaga(900, 1.5, 0.18, v * 0.25, o); }, 110);
    },
    turno: function () {
      if (!listo()) return;
      tono(660, 0.12, 0.12, master); setTimeout(function () { if (listo()) tono(880, 0.16, 0.1, master); }, 110);
    }
  };
  window.ARPOOL.sonido = API;
})();
