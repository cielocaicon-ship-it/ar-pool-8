/* ==========================================================================
   AR POOL 8 — textures.js
   Texturas procedurales generadas con <canvas> (no se descarga ninguna
   imagen): paño de fieltro, madera con vetas, bolas numeradas, piso,
   sombra de contacto y mapa de entorno para los reflejos PBR.
   ========================================================================== */
(function () {
  'use strict';
  var THREE = window.THREE || (window.AFRAME && window.AFRAME.THREE);
  var cfg = window.ARPOOL.config;
  var cache = {};

  // Generador pseudoaleatorio con semilla (las texturas salen siempre iguales)
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function toTexture(c, opts) {
    opts = opts || {};
    var t = new THREE.CanvasTexture(c);
    if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = opts.anisotropy || 8;
    if (opts.repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    return t;
  }

  // ---------------------------------------------------------------- Paño
  function felt() {
    if (cache.felt) return cache.felt;
    var size = 512, c = canvas(size, size), ctx = c.getContext('2d');
    var r = rng(11);
    ctx.fillStyle = '#17503a';
    ctx.fillRect(0, 0, size, size);
    // grano fino
    var img = ctx.getImageData(0, 0, size, size), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (r() - 0.5) * 18;
      d[i] += n * 0.6; d[i + 1] += n; d[i + 2] += n * 0.7;
    }
    ctx.putImageData(img, 0, 0);
    // fibras sueltas
    ctx.globalAlpha = 0.06;
    for (var k = 0; k < 2200; k++) {
      var x = r() * size, y = r() * size, a = r() * Math.PI, l = 2 + r() * 6;
      ctx.strokeStyle = r() > 0.5 ? '#2f8a5c' : '#0f3d26';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    cache.felt = c;
    return c;
  }
  function feltTexture(repeatX, repeatY) {
    return toTexture(felt(), { repeat: [repeatX || 6, repeatY || 3] });
  }

  // -------------------------------------------------------------- Madera
  function wood(base, dark, seed) {
    var key = 'wood' + base + dark + seed;
    if (cache[key]) return cache[key];
    var w = 1024, h = 256, c = canvas(w, h), ctx = c.getContext('2d');
    var r = rng(seed || 7);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // vetas largas onduladas
    for (var i = 0; i < 90; i++) {
      var y0 = r() * h, amp = 2 + r() * 6, freq = 0.004 + r() * 0.01, ph = r() * 6.28;
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.08 + r() * 0.22;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      for (var x = 0; x <= w; x += 8) {
        var y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // nudos sutiles
    ctx.globalAlpha = 0.18;
    for (var k = 0; k < 4; k++) {
      var kx = r() * w, ky = r() * h;
      var g = ctx.createRadialGradient(kx, ky, 1, kx, ky, 18 + r() * 14);
      g.addColorStop(0, dark); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(kx, ky, 40, 10, 0, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    cache[key] = c;
    return c;
  }
  function woodTexture(repeatX, repeatY, variant) {
    var c = variant === 'maple'
      ? wood('#d9b98a', '#9c7448', 3)
      : variant === 'floor'
        ? wood('#4a3324', '#20140c', 21)
        : wood('#4b2414', '#1a0905', 7);   // caoba oscura para la mesa
    return toTexture(c, { repeat: [repeatX || 1, repeatY || 1] });
  }

  // --------------------------------------------------------------- Bolas
  // Textura equirectangular: el ancho cubre 360° y el alto 180°, así que
  // los círculos dibujados en el ecuador no se deforman.
  function ballTexture(number) {
    var key = 'ball' + number;
    if (cache[key]) return cache[key];
    var W = 1024, H = 512, c = canvas(W, H), ctx = c.getContext('2d');
    var color = cfg.ballColor(number);
    var white = '#f4f1e6';
    var striped = number > 8;

    ctx.fillStyle = striped ? white : color;
    ctx.fillRect(0, 0, W, H);

    if (striped) {
      // Franja: ±38° de latitud
      var band = (38 / 180) * H;
      ctx.fillStyle = color;
      ctx.fillRect(0, H / 2 - band, W, band * 2);
    }

    if (number !== 0) {
      // Círculo blanco del número (radio angular ≈ 24°), dibujado fila por fila
      // para que sea un círculo perfecto sobre la esfera.
      var alpha = 24 * Math.PI / 180;
      [0.25, 0.75].forEach(function (u) {
        var lon0 = u * W;
        ctx.fillStyle = white;
        for (var y = 0; y < H; y++) {
          var lat = (0.5 - (y + 0.5) / H) * Math.PI;
          var cl = Math.cos(lat);
          if (cl <= 0) continue;
          var ratio = Math.cos(alpha) / cl;
          if (ratio > 1) continue;
          var dlon = Math.acos(ratio) / (2 * Math.PI) * W;
          ctx.fillRect(lon0 - dlon, y, dlon * 2, 1);
        }
        // Número
        ctx.fillStyle = '#141414';
        ctx.font = 'bold ' + (number > 9 ? 74 : 88) + 'px "Arial Black", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.translate(lon0, H / 2 + 3);
        ctx.scale(number > 9 ? 0.82 : 1, 1);
        ctx.fillText(String(number), 0, 0);
        if (number === 6 || number === 9) {   // subrayado para distinguir 6 y 9
          ctx.fillRect(-20, 38, 40, 7);
        }
        ctx.restore();
      });
    } else {
      // Bola blanca: pequeños puntos rojos de referencia (como las de torneo)
      ctx.fillStyle = '#c0282d';
      [[0.25, 0.5], [0.75, 0.5], [0.0, 0.5], [0.5, 0.5], [0.5, 0.02], [0.5, 0.98]].forEach(function (p) {
        ctx.beginPath();
        ctx.arc(p[0] * W, p[1] * H, 9, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // micro-variación de la superficie
    var r = rng(100 + number);
    ctx.globalAlpha = 0.035;
    for (var k = 0; k < 900; k++) {
      ctx.fillStyle = r() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(r() * W, r() * H, 2, 2);
    }
    ctx.globalAlpha = 1;

    var tex = toTexture(c, { anisotropy: 4 });
    cache[key] = tex;
    return tex;
  }

  // ------------------------------------------------------ Sombra de contacto
  function contactShadowTexture() {
    if (cache.shadow) return cache.shadow;
    var s = 128, c = canvas(s, s), ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    cache.shadow = toTexture(c);
    return cache.shadow;
  }

  // ------------------------------------------------------ Mapa de entorno
  // Una "habitación" virtual con lámparas brillantes. Se convierte en un
  // mapa PMREM para que las bolas y la madera tengan reflejos realistas.
  function environmentMap(renderer) {
    if (cache.env) return cache.env;
    var scene = new THREE.Scene();
    var room = new THREE.Mesh(
      new THREE.BoxGeometry(12, 5, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.11, 0.1, 0.09), side: THREE.BackSide })
    );
    room.position.y = 2;
    scene.add(room);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.035, 0.025) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.49;
    scene.add(floor);
    function panel(w, h, x, y, z, rx, ry, intensity, tint) {
      var col = new THREE.Color(tint || 0xffffff).multiplyScalar(intensity);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
      scene.add(m);
    }
    // lámpara de mesa de billar (3 focos alargados sobre la mesa)
    panel(0.5, 0.35, -0.8, 3.0, 0, Math.PI / 2, 0, 9, 0xfff1d6);
    panel(0.5, 0.35, 0.0, 3.0, 0, Math.PI / 2, 0, 9, 0xfff1d6);
    panel(0.5, 0.35, 0.8, 3.0, 0, Math.PI / 2, 0, 9, 0xfff1d6);
    // ventanas / luz de relleno
    panel(3, 1.6, 0, 2.2, -5.9, 0, 0, 1.6, 0xcfe0ff);
    panel(2, 1.4, 5.9, 2.0, 1, 0, -Math.PI / 2, 1.1, 0xffe2c0);
    panel(2, 1.4, -5.9, 2.0, -1, 0, Math.PI / 2, 0.7, 0xffffff);

    var pmrem = new THREE.PMREMGenerator(renderer);
    var rt = pmrem.fromScene(scene, 0.03);
    pmrem.dispose();
    cache.env = rt.texture;
    return cache.env;
  }

  window.ARPOOL.textures = {
    feltTexture: feltTexture,
    woodTexture: woodTexture,
    ballTexture: ballTexture,
    contactShadowTexture: contactShadowTexture,
    environmentMap: environmentMap
  };
})();
