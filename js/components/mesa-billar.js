/* ==========================================================================
   Componente A-Frame: mesa-billar
   Construye la mesa completa con geometría procedural y materiales PBR:
   paño de fieltro, bandas de goma, baranda de madera barnizada, 6 troneras
   con profundidad, diamantes, gabinete y patas torneadas.
   El origen del componente es el CENTRO DEL PAÑO (la superficie de juego).
   Uso: <a-entity mesa-billar position="0 0.76 0"></a-entity>
   ========================================================================== */
(function () {
  'use strict';
  var THREE = AFRAME.THREE;
  var cfg = window.ARPOOL.config;
  var TX = window.ARPOOL.textures;

  // ---------- utilidades 2D -------------------------------------------------
  function norm(a) { var t = Math.PI * 2; return ((a % t) + t) % t; }

  // Agrega a "path" puntos de un arco del círculo (cx,cy,r) que va de p0 a p1
  // pasando por el ángulo "via" (para elegir el lado correcto del círculo).
  function arcThrough(path, cx, cy, r, p0, p1, via, segs) {
    var a0 = Math.atan2(p0[1] - cy, p0[0] - cx);
    var a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
    var dEnd = norm(a1 - a0), dVia = norm(via - a0);
    var sweep = dVia < dEnd ? dEnd : -(Math.PI * 2 - dEnd);
    for (var i = 1; i <= segs; i++) {
      var a = a0 + sweep * (i / segs);
      path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }

  /**
   * Contorno del rectángulo (bx,by) "mordido" por las 6 troneras.
   * inward=true  -> los arcos entran al rectángulo (contorno del paño: los agujeros quedan fuera)
   * inward=false -> los arcos salen del rectángulo (hueco de la baranda de madera)
   */
  function pocketOutline(path, bx, by, pockets, inward) {
    var c = pockets.corner, s = pockets.side;
    var eX = Math.sqrt(c.r * c.r - Math.pow(by - c.cy, 2)); // corte en bordes horizontales
    var eY = Math.sqrt(c.r * c.r - Math.pow(bx - c.cx, 2)); // corte en bordes verticales
    var aS = Math.sqrt(s.r * s.r - Math.pow(by - s.cy, 2));
    var SEG = 18;
    // Ángulo "via": hacia afuera (madera) o hacia adentro (paño)
    function via(outAngle) { return inward ? outAngle + Math.PI : outAngle; }

    path.moveTo(-c.cx + eX, -by);
    path.lineTo(-aS, -by);
    arcThrough(path, 0, -s.cy, s.r, [-aS, -by], [aS, -by], via(-Math.PI / 2), SEG);
    path.lineTo(c.cx - eX, -by);
    arcThrough(path, c.cx, -c.cy, c.r, [c.cx - eX, -by], [bx, -c.cy + eY], via(-Math.PI / 4), SEG);
    path.lineTo(bx, c.cy - eY);
    arcThrough(path, c.cx, c.cy, c.r, [bx, c.cy - eY], [c.cx - eX, by], via(Math.PI / 4), SEG);
    path.lineTo(aS, by);
    arcThrough(path, 0, s.cy, s.r, [aS, by], [-aS, by], via(Math.PI / 2), SEG);
    path.lineTo(-c.cx + eX, by);
    arcThrough(path, -c.cx, c.cy, c.r, [-c.cx + eX, by], [-bx, c.cy - eY], via(3 * Math.PI / 4), SEG);
    path.lineTo(-bx, -c.cy + eY);
    arcThrough(path, -c.cx, -c.cy, c.r, [-bx, -c.cy + eY], [-c.cx + eX, -by], via(-3 * Math.PI / 4), SEG);
    return { eX: eX, eY: eY, aS: aS };
  }

  // Encoge un polígono convexo d metros hacia adentro (para compensar el bisel)
  function insetConvex(pts, d) {
    var n = pts.length, lines = [];
    var area = 0;
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      area += p[0] * q[1] - q[0] * p[1];
    }
    var sign = area > 0 ? 1 : -1;
    for (var j = 0; j < n; j++) {
      var a = pts[j], b = pts[(j + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      var nx = -dy / L * sign, ny = dx / L * sign; // normal hacia adentro
      lines.push({ p: [a[0] + nx * d, a[1] + ny * d], v: [dx, dy] });
    }
    var out = [];
    for (var k = 0; k < n; k++) {
      var l1 = lines[(k + n - 1) % n], l2 = lines[k];
      var den = l1.v[0] * l2.v[1] - l1.v[1] * l2.v[0];
      var t = ((l2.p[0] - l1.p[0]) * l2.v[1] - (l2.p[1] - l1.p[1]) * l2.v[0]) / den;
      out.push([l1.p[0] + l1.v[0] * t, l1.p[1] + l1.v[1] * t]);
    }
    return out;
  }

  // Extruye una forma 2D (plano XY) hacia arriba (eje Y del mundo)
  function extrudeUp(shape, yBottom, height, bevel, material) {
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: !!bevel,
      bevelSize: bevel || 0,
      bevelThickness: bevel || 0,
      bevelSegments: bevel ? 3 : 0,
      curveSegments: 24
    });
    var mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;      // XY -> XZ, la extrusión apunta a +Y
    mesh.position.y = yBottom;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  AFRAME.registerComponent('mesa-billar', {
    schema: {
      colorPano: { type: 'color', default: '#c9d1cc' }   // tinte opcional del paño
    },

    init: function () {
      var T = cfg.TABLE;
      var hx = T.playLength / 2, hy = T.playWidth / 2;          // nariz de banda
      var bx = hx + T.cushionWidth, by = hy + T.cushionWidth;   // borde interior de la madera
      var ox = bx + T.railWidth, oy = by + T.railWidth;         // borde exterior de la madera
      var pockets = {
        corner: { cx: hx + T.cornerPocketOffset, cy: hy + T.cornerPocketOffset, r: T.cornerPocketRadius },
        side: { cy: hy + T.sidePocketOffset, r: T.sidePocketRadius }
      };
      this.dim = { hx: hx, hy: hy, bx: bx, by: by, ox: ox, oy: oy };
      var group = new THREE.Group();
      group.name = 'mesa';

      // ---------------- Materiales PBR ----------------
      var feltMap = TX.feltTexture(5, 5);
      var matFelt = new THREE.MeshPhysicalMaterial({
        map: feltMap, color: new THREE.Color(this.data.colorPano),
        roughness: 0.92, metalness: 0,
        sheen: 1, sheenRoughness: 0.75, sheenColor: new THREE.Color('#2e7a52')
      });
      var matCushion = matFelt.clone();
      matCushion.map = TX.feltTexture(8, 8);

      var woodMap = TX.woodTexture(0.9, 3.2);
      var matWood = new THREE.MeshPhysicalMaterial({
        map: woodMap, roughness: 0.38, metalness: 0,
        clearcoat: 0.7, clearcoatRoughness: 0.18
      });
      var matWoodDark = new THREE.MeshPhysicalMaterial({
        map: TX.woodTexture(1.5, 1.5), color: new THREE.Color('#9a8a80'),
        roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.25
      });
      var matPocket = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.85, side: THREE.DoubleSide });
      var matLeather = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.6 });
      var matPearl = new THREE.MeshPhysicalMaterial({ color: '#f3efe4', roughness: 0.2, clearcoat: 1, iridescence: 0.4 });
      var matBrass = new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.3, metalness: 1 });
      this.materials = [matFelt, matCushion, matWood, matWoodDark, matPocket, matLeather, matPearl, matBrass];

      // ---------------- Paño (cama de pizarra cubierta de fieltro) ----------------
      var clothShape = new THREE.Shape();
      pocketOutline(clothShape, bx, by, pockets, true);
      var cloth = extrudeUp(clothShape, -0.03, 0.03, 0, matFelt);
      cloth.castShadow = false;
      cloth.name = 'pano';
      group.add(cloth);
      this.cloth = cloth;

      // Línea de cabecera y punto de pie (marcas sutiles del paño)
      var markMat = new THREE.MeshBasicMaterial({ color: '#d8e8dc', transparent: true, opacity: 0.35 });
      var spot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 20), markMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(cfg.FOOT_SPOT.x, 0.0006, 0);
      group.add(spot);
      var spot2 = spot.clone(); spot2.position.x = cfg.HEAD_SPOT.x; group.add(spot2);

      // ---------------- Baranda de madera ----------------
      var railShape = new THREE.Shape();
      var rc = 0.07; // radio de las esquinas exteriores
      railShape.moveTo(-ox + rc, -oy);
      railShape.lineTo(ox - rc, -oy); railShape.quadraticCurveTo(ox, -oy, ox, -oy + rc);
      railShape.lineTo(ox, oy - rc); railShape.quadraticCurveTo(ox, oy, ox - rc, oy);
      railShape.lineTo(-ox + rc, oy); railShape.quadraticCurveTo(-ox, oy, -ox, oy - rc);
      railShape.lineTo(-ox, -oy + rc); railShape.quadraticCurveTo(-ox, -oy, -ox + rc, -oy);
      var hole = new THREE.Path();
      pocketOutline(hole, bx, by, pockets, false);
      railShape.holes.push(hole);
      var bev = 0.005;
      var rail = extrudeUp(railShape, T.railBottom + bev, (T.railTop - T.railBottom) - 2 * bev, bev, matWood);
      rail.name = 'baranda';
      group.add(rail);

      // Moldura inferior de la baranda (perfil más oscuro)
      var moldShape = new THREE.Shape();
      var mo = 0.012;
      moldShape.moveTo(-ox - mo, -oy - mo); moldShape.lineTo(ox + mo, -oy - mo);
      moldShape.lineTo(ox + mo, oy + mo); moldShape.lineTo(-ox - mo, oy + mo);
      var moldHole = new THREE.Path();
      moldHole.moveTo(-ox + 0.1, -oy + 0.1); moldHole.lineTo(-ox + 0.1, oy - 0.1);
      moldHole.lineTo(ox - 0.1, oy - 0.1); moldHole.lineTo(ox - 0.1, -oy + 0.1);
      moldShape.holes.push(moldHole);
      group.add(extrudeUp(moldShape, T.railBottom - 0.03, 0.03, 0.004, matWoodDark));

      // ---------------- Bandas de goma (6 tramos) ----------------
      // Polígonos de las bandas: los mismos que usa el motor de física
      var cB = 0.006;                        // bisel que redondea la nariz
      var polys = window.ARPOOL.geometria.construir().bandas;
      var cushionH = T.cushionTop;
      polys.forEach(function (pts) {
        var inset = insetConvex(pts, cB);
        var sh = new THREE.Shape();
        sh.moveTo(inset[0][0], inset[0][1]);
        for (var i = 1; i < inset.length; i++) sh.lineTo(inset[i][0], inset[i][1]);
        sh.closePath();
        var m = extrudeUp(sh, 0.001, cushionH - cB - 0.001, cB, matCushion);
        m.name = 'banda';
        group.add(m);
      });

      // ---------------- Troneras (cilindro interior + fondo) ----------------
      var depth = 0.105;
      cfg.pocketCenters().forEach(function (p) {
        var cyl = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.92, depth, 32, 1, true), matPocket);
        cyl.position.set(p.x, -depth / 2, p.z);
        cyl.receiveShadow = true;
        group.add(cyl);
        var bottom = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.92, 32), matPocket);
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(p.x, -depth + 0.001, p.z);
        group.add(bottom);
        // Cuero de la tronera: se ve por fuera de la baranda
        // (medio toro orientado hacia afuera de la mesa)
        var lip = new THREE.Mesh(new THREE.TorusGeometry(p.r + 0.004, 0.006, 10, 40, Math.PI), matLeather);
        lip.rotation.x = -Math.PI / 2;           // el medio arco queda hacia -z
        lip.castShadow = true;
        var holder = new THREE.Object3D();
        var ux = Math.sign(p.x), uz = Math.sign(p.z);
        holder.rotation.y = Math.atan2(-ux, -uz); // gira -z hacia el exterior
        holder.position.set(p.x, T.railTop + 0.001, p.z);
        holder.add(lip);
        group.add(holder);
      });

      // ---------------- Diamantes (miras) en la baranda ----------------
      var diamondGeo = new THREE.CircleGeometry(0.0075, 4);
      var railMid = T.cushionWidth + T.railWidth / 2;
      function diamond(x, z, rot) {
        var d = new THREE.Mesh(diamondGeo, matPearl);
        d.rotation.x = -Math.PI / 2;
        d.rotation.z = rot;
        d.scale.set(1.6, 1, 1);
        d.position.set(x, T.railTop + 0.0012, z);
        group.add(d);
      }
      [1, 2, 3].forEach(function (k) {
        var x = k * T.playLength / 8;
        [-1, 1].forEach(function (sx) {
          [-1, 1].forEach(function (sz) { diamond(sx * x, sz * (hy + railMid), 0); });
        });
      });
      [-1, 0, 1].forEach(function (k) {
        var z = k * T.playWidth / 4;
        [-1, 1].forEach(function (sx) { diamond(sx * (hx + railMid), z, Math.PI / 2); });
      });

      // ---------------- Gabinete (faldón) ----------------
      var skirtTop = T.railBottom - 0.03;
      var skirtH = 0.2;
      var skirt = new THREE.Mesh(
        new THREE.BoxGeometry(2 * ox - 0.1, skirtH, 2 * oy - 0.1),
        matWood
      );
      skirt.position.y = skirtTop - skirtH / 2;
      skirt.castShadow = true; skirt.receiveShadow = true;
      group.add(skirt);
      // Panel decorativo del faldón
      var plinth = new THREE.Mesh(new THREE.BoxGeometry(2 * ox - 0.06, 0.025, 2 * oy - 0.06), matWoodDark);
      plinth.position.y = skirtTop - skirtH - 0.012;
      plinth.castShadow = true;
      group.add(plinth);

      // ---------------- Patas torneadas ----------------
      var floorY = -T.bedHeight;
      var legTop = skirtTop - skirtH - 0.025;
      var legH = legTop - floorY;
      var prof = [ // (radio, altura relativa 0 = suelo, 1 = arriba)
        [0.0, 0.0], [0.072, 0.0], [0.078, 0.03], [0.07, 0.06], [0.062, 0.09],
        [0.075, 0.16], [0.08, 0.22], [0.068, 0.3], [0.05, 0.42], [0.046, 0.6],
        [0.052, 0.72], [0.066, 0.8], [0.07, 0.86], [0.06, 0.9], [0.075, 0.94], [0.075, 1.0], [0.0, 1.0]
      ].map(function (p) { return new THREE.Vector2(p[0], p[1] * legH); });
      var legGeo = new THREE.LatheGeometry(prof, 32);
      var legMat = matWood.clone();
      legMat.map = TX.woodTexture(1, 0.6);
      var lx = ox - 0.26, lz = oy - 0.2;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) {
        var leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(s[0] * lx, floorY, s[1] * lz);
        leg.castShadow = true; leg.receiveShadow = true;
        group.add(leg);
        // bloque superior cuadrado
        var block = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.17), matWood);
        block.position.set(s[0] * lx, legTop - 0.06 + 0.001, s[1] * lz);
        block.castShadow = true;
        group.add(block);
        // regatón de latón
        var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.072, 0.012, 24), matBrass);
        foot.position.set(s[0] * lx, floorY + 0.006, s[1] * lz);
        group.add(foot);
      });
      // Travesaño central
      var beam = new THREE.Mesh(new THREE.BoxGeometry(2 * lx, 0.08, 0.1), matWoodDark);
      beam.position.y = floorY + legH * 0.3;
      beam.castShadow = true;
      group.add(beam);

      // Sombra de contacto de la mesa sobre el suelo (útil en AR)
      var sh = new THREE.Mesh(
        new THREE.PlaneGeometry(2 * ox + 0.6, 2 * oy + 0.6),
        new THREE.MeshBasicMaterial({ map: TX.contactShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false })
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = floorY + 0.002;
      sh.renderOrder = -1;
      sh.name = 'sombra-mesa';
      group.add(sh);

      this.el.setObject3D('mesh', group);
      this.el.emit('mesa-lista', { dim: this.dim });
    },

    remove: function () {
      this.el.removeObject3D('mesh');
      (this.materials || []).forEach(function (m) { m.dispose(); });
    }
  });
})();
