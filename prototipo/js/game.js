/* AR Pool 8 — prototipo 0.2 (revisado)
   Un solo archivo de juego que sirve para las dos páginas:
   - ar.html  → realidad aumentada con marcador HIRO (AR.js)
   - 3d.html  → vista 3D sin cámara
   La página indica el modo con <body data-mode="ar"> o <body data-mode="3d">. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const MODE = document.body.dataset.mode === 'ar' ? 'ar' : '3d';
const THREE = AFRAME.THREE;

// ---------- Errores visibles en pantalla (útil para depurar en el iPhone) ----------
function showError(msg) {
  const box = $('errors'); if (!box) return;
  box.hidden = false; box.textContent = '⚠️ ' + msg;
}
window.addEventListener('error', e => showError((e.message || 'Error') + (e.filename ? ' · ' + e.filename.split('/').pop() + ':' + e.lineno : '')));
window.addEventListener('unhandledrejection', e => showError(String(e.reason)));

// ---------- Medidas reales (metros) — mesa de 8 pies ----------
const W = 2.24, H = 1.12;          // área de juego
const R = 0.0286;                  // radio de bola (57,2 mm de diámetro)
const CORNER_MOUTH = 0.058;        // boca de tronera de esquina (sin banda)
const SIDE_MOUTH = 0.055;          // boca de tronera lateral
const POCKETS = [
  { x: -W/2 - 0.012, z: -H/2 - 0.012, r: 0.077 },
  { x: 0,            z: -H/2 - 0.022, r: 0.060 },
  { x:  W/2 + 0.012, z: -H/2 - 0.012, r: 0.077 },
  { x: -W/2 - 0.012, z:  H/2 + 0.012, r: 0.077 },
  { x: 0,            z:  H/2 + 0.022, r: 0.060 },
  { x:  W/2 + 0.012, z:  H/2 + 0.012, r: 0.077 },
];
// Física
const DT = 1 / 240;     // paso de simulación
const ROLL = 0.55;      // frenado por rodadura (m/s²)
const DRAG = 0.18;      // frenado proporcional a la velocidad (1/s)
const E_BALL = 0.95;    // rebote bola-bola
const E_CUSH = 0.75;    // rebote en banda
const STOP = 0.004;     // por debajo de esta velocidad la bola se detiene
const MIN_SPEED = 0.25, MAX_SPEED = 6.0;
const speedFromPower = p => MIN_SPEED + (MAX_SPEED - MIN_SPEED) * Math.pow(p, 1.5);
const powerFromSpeed = v => Math.pow(Math.min(1, Math.max(0, (v - MIN_SPEED) / (MAX_SPEED - MIN_SPEED))), 1 / 1.5);

// Colores oficiales aproximados
const COLORS = { 1:'#f2c200', 2:'#1f4fbf', 3:'#d42a20', 4:'#5b2a86', 5:'#f07800', 6:'#137a3a', 7:'#7a1f1a', 8:'#111111' };
const ballColor = n => COLORS[n > 8 ? n - 8 : n];
// Triángulo reglamentario de 8 bolas: la 8 en el centro, una lisa y una rayada en las esquinas de atrás
const RACK = [[1], [9, 2], [10, 8, 3], [11, 7, 14, 4], [5, 13, 15, 6, 12]];

// ---------- Estado ----------
let balls = [];            // {n, x, z, vx, vz, active, sink, mesh, shadow}
let aim = 0, power = 0.4;
let state = 'aim';         // aim | strike | roll | bot
let strikeT = 0, pendingShot = null, botAnim = null;
let shots = 0, pocketedCount = 0, lastPocketed = [];
let sceneEl, root, table, stick, stickPitch, aimLine, ghostRing, targetLine, hitBall = null;

// ---------- Texturas generadas por código (no hay que descargar imágenes) ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
function feltTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#0b6b47'; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i+1] += n; d[i+2] += n; }
    g.putImageData(img, 0, 0);
  });
}
function woodTexture() {
  return canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#5a2d16'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${30 + Math.random()*40},${10 + Math.random()*20},0,${0.15 + Math.random()*0.25})`;
      g.lineWidth = 1 + Math.random() * 2; g.beginPath();
      const y = Math.random() * h; g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 3);
      g.stroke();
    }
  });
}
function ballTexture(n) {
  return canvasTex(256, 128, (g, w, h) => {
    const col = n === 0 ? '#f4f1e4' : ballColor(n);
    if (n >= 9) { g.fillStyle = '#f4f1e4'; g.fillRect(0, 0, w, h); g.fillStyle = col; g.fillRect(0, h * 0.28, w, h * 0.44); }
    else { g.fillStyle = col; g.fillRect(0, 0, w, h); }
    if (n === 0) { g.fillStyle = '#c0392b'; [w * 0.25, w * 0.75].forEach(x => { g.beginPath(); g.arc(x, h / 2, 4, 0, 7); g.fill(); }); return; }
    [w * 0.25, w * 0.75].forEach(x => {
      g.fillStyle = '#f4f1e4'; g.beginPath(); g.arc(x, h / 2, 17, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 22px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(n), x, h / 2 + 1);
    });
  });
}
function blobTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w/2, h/2, 2, w/2, h/2, w/2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// Mapa de entorno sencillo (una "sala" con lámpara) para que las bolas brillen
function setupEnvironment() {
  const renderer = sceneEl.renderer; if (!renderer) return;
  const tex = canvasTex(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3a3f45'); gr.addColorStop(0.5, '#1d2124'); gr.addColorStop(1, '#0c0e10');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6dd'; g.fillRect(w * 0.35, h * 0.04, w * 0.3, h * 0.12);   // lámpara
    g.fillStyle = '#9fb4c8'; g.fillRect(w * 0.82, h * 0.25, w * 0.1, h * 0.2);    // ventana
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    sceneEl.object3D.environment = pmrem.fromEquirectangular(tex).texture;
  } catch (e) { console.warn('Sin mapa de entorno', e); }
}

// ---------- Construcción de la mesa ----------
function buildTable(parent) {
  const g = new THREE.Group(); parent.add(g);
  const feltMat = new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.95, metalness: 0 });
  const cushMat = new THREE.MeshStandardMaterial({ color: '#09593b', roughness: 0.9 });
  const woodTex = woodTexture();
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.45, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2a160b', roughness: 0.6 });
  const pocketMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 1 });
  const pearlMat = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.3 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };

  const CW = 0.05, CH = 0.04, RAIL = 0.11, RAIL_H = 0.05;
  // Paño
  const felt = add(new THREE.PlaneGeometry(W + 2 * CW, H + 2 * CW), feltMat, 0, 0, 0);
  felt.rotation.x = -Math.PI / 2;
  // Bandas (caucho forrado), cortadas en las troneras
  const cm = 0.07, sm = 0.065;
  const longLen = W / 2 - cm - sm;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(longLen, CH, CW), cushMat, sx * (sm + longLen / 2), CH / 2, sz * (H / 2 + CW / 2));
  }
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(CW, CH, H - 2 * cm), cushMat, sx * (W / 2 + CW / 2), CH / 2, 0);
  // Barandas de madera
  const outerW = W + 2 * CW + 2 * RAIL, outerH = H + 2 * CW + 2 * RAIL;
  for (const sz of [-1, 1]) add(new THREE.BoxGeometry(outerW, RAIL_H, RAIL), woodMat, 0, RAIL_H / 2 - 0.005, sz * (H / 2 + CW + RAIL / 2));
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(RAIL, RAIL_H, H + 2 * CW), woodMat, sx * (W / 2 + CW + RAIL / 2), RAIL_H / 2 - 0.005, 0);
  // Cuerpo de la mesa
  const bodyH = MODE === 'ar' ? 0.05 : 0.18;
  add(new THREE.BoxGeometry(outerW, bodyH, outerH), darkMat, 0, -bodyH / 2 - 0.002, 0);
  // Troneras
  POCKETS.forEach(p => {
    const corner = Math.abs(p.x) > 0.1;
    const r = corner ? 0.066 : 0.06;
    const ox = corner ? Math.sign(p.x) * 0.018 : 0, oz = Math.sign(p.z) * (corner ? 0.018 : 0.03);
    add(new THREE.CylinderGeometry(r, r, 0.1, 28), pocketMat, p.x + ox, 0.001, p.z + oz);
  });
  // Diamantes (marcas de referencia en las barandas)
  const diaGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 12);
  const railY = RAIL_H - 0.004;
  for (const k of [1, 2, 3, 5, 6, 7]) for (const sz of [-1, 1]) add(diaGeo, pearlMat, -W / 2 + k * W / 8, railY, sz * (H / 2 + CW + RAIL / 2));
  for (const k of [1, 2, 3]) for (const sx of [-1, 1]) add(diaGeo, pearlMat, sx * (W / 2 + CW + RAIL / 2), railY, -H / 2 + k * H / 4);
  // Solo en 3D: patas, piso y lámpara
  if (MODE === '3d') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.13, 0.62, 0.13), woodMat, sx * (outerW / 2 - 0.12), -0.182 - 0.31, sz * (outerH / 2 - 0.12));
    const floorTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#3b2a20'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { c.fillStyle = y % 64 ? '#35251c' : '#402e23'; c.fillRect(0, y, w, 30); } });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6, 6);
    const floor = add(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }), 0, -0.8, 0);
    floor.rotation.x = -Math.PI / 2;
  }

  // Bolas
  const sphere = new THREE.SphereGeometry(R, 32, 20);
  const blob = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(R * 2.8, R * 2.8);
  for (let n = 0; n < 16; n++) {
    const mat = new THREE.MeshPhysicalMaterial({ map: ballTexture(n), roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    g.add(mesh);
    const shadow = new THREE.Mesh(blobGeo, blob); shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1; g.add(shadow);
    balls.push({ n, x: 0, z: 0, vx: 0, vz: 0, active: true, sink: null, mesh, shadow });
  }

  // Taco: grupo que gira alrededor de la bola blanca (yaw) e inclinado unos grados (pitch)
  stick = new THREE.Group(); g.add(stick);
  stickPitch = new THREE.Group(); stickPitch.rotation.z = -0.09; stick.add(stickPitch);
  const segs = [ // [largo, radio punta, radio final, color]
    [0.012, 0.0065, 0.0065, '#2c6fbf'],  // tiza
    [0.022, 0.0066, 0.0066, '#f4f1e4'],  // virola
    [0.70,  0.0068, 0.0095, '#d9b47c'],  // fuste de arce
    [0.03,  0.0095, 0.0098, '#111111'],  // anillo
    [0.70,  0.0098, 0.0150, '#3b1c0e'],  // mango
  ];
  let xpos = 0;
  segs.forEach(([len, r1, r2, col]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 20), new THREE.MeshStandardMaterial({ color: col, roughness: 0.35 }));
    m.rotation.z = Math.PI / 2;      // eje del cilindro → eje X
    m.position.x = -(xpos + len / 2);
    stickPitch.add(m); xpos += len;
  });

  // Guía de puntería
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
  aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat);
  targetLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }));
  ghostRing = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ghostRing.rotation.x = -Math.PI / 2;
  g.add(aimLine, targetLine, ghostRing);
  return g;
}

// ---------- Reglas básicas / colocación ----------
function rack() {
  const gap = 0.0004;
  balls.forEach(b => { b.vx = b.vz = 0; b.active = true; b.sink = null; });
  const byN = n => balls.find(b => b.n === n);
  const cue = byN(0); cue.x = -W / 4; cue.z = 0;
  RACK.forEach((row, r) => row.forEach((n, j) => {
    const b = byN(n);
    b.x = W / 4 + r * (2 * R + gap) * Math.sqrt(3) / 2;
    b.z = (j - r / 2) * (2 * R + gap);
  }));
  balls.sort((a, b) => a.n - b.n);
  shots = 0; pocketedCount = 0; lastPocketed = []; state = 'aim'; botAnim = null; pendingShot = null;
  setAim(0);
  setInfo('Modo práctica · Tu turno');
}
function placeCueBall() {
  const cue = balls[0]; cue.vx = cue.vz = 0; cue.sink = null; cue.active = true;
  let z = 0;
  for (let k = 0; k < 40; k++) {
    const x = -W / 4;
    if (balls.every(b => b === cue || !b.active || Math.hypot(b.x - x, b.z - z) > 2 * R + 0.002)) { cue.x = x; cue.z = z; return; }
    z = (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2) * 2.2 * R;
  }
  cue.x = -W / 4; cue.z = 0;
}

// ---------- Física ----------
const moving = () => balls.some(b => b.active && (b.vx !== 0 || b.vz !== 0));
function pocketBall(b, p) {
  b.active = false; b.vx = b.vz = 0;
  b.sink = { x0: b.x, z0: b.z, x: p.x, z: p.z, t: 0 };
  if (b.n !== 0) { pocketedCount++; lastPocketed.push(b.n); }
}
function step() {
  for (const b of balls) {
    if (!b.active) continue;
    const s = Math.hypot(b.vx, b.vz);
    if (s > 0) {
      const ns = Math.max(0, s - (ROLL + DRAG * s) * DT);
      if (ns < STOP) { b.vx = b.vz = 0; } else { b.vx *= ns / s; b.vz *= ns / s; }
    }
    b.x += b.vx * DT; b.z += b.vz * DT;
    const ax = Math.abs(b.x), az = Math.abs(b.z), sx = Math.sign(b.x), sz = Math.sign(b.z);
    // Bandas cortas (izquierda/derecha), excepto en la boca de las troneras de esquina
    if (ax > W / 2 - R && az < H / 2 - CORNER_MOUTH) { b.x = sx * (W / 2 - R); if (b.vx * sx > 0) { b.vx *= -E_CUSH; b.vz *= 0.97; } }
    // Bandas largas (arriba/abajo), excepto en las bocas de esquina y laterales
    if (az > H / 2 - R && ax < W / 2 - CORNER_MOUTH && ax > SIDE_MOUTH) { b.z = sz * (H / 2 - R); if (b.vz * sz > 0) { b.vz *= -E_CUSH; b.vx *= 0.97; } }
    // Fondo de la tronera (por si la bola entra a la boca y no cae)
    if (ax > W / 2 + 0.035) { b.x = sx * (W / 2 + 0.035); b.vx *= -0.3; }
    if (az > H / 2 + 0.04) { b.z = sz * (H / 2 + 0.04); b.vz *= -0.3; }
    for (const p of POCKETS) if (Math.hypot(b.x - p.x, b.z - p.z) < p.r) { pocketBall(b, p); break; }
  }
  // Choques entre bolas (masas iguales)
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], b = balls[j];
    if (!a.active || !b.active) continue;
    let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= 2 * R) continue;
    if (d < 1e-9) { dx = 1; dz = 0; d = 1; }
    const nx = dx / d, nz = dz / d, overlap = (2 * R - Math.min(d, 2 * R)) / 2;
    a.x -= nx * overlap; a.z -= nz * overlap; b.x += nx * overlap; b.z += nz * overlap;
    const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rel < 0) {
      const imp = -(1 + E_BALL) * rel / 2;
      a.vx -= imp * nx; a.vz -= imp * nz; b.vx += imp * nx; b.vz += imp * nz;
    }
  }
}

// ---------- Disparo ----------
function shoot(a, p) {
  if (state !== 'aim' && state !== 'bot') return false;
  if (moving() || !balls[0].active) return false;
  pendingShot = { a, p }; strikeT = 0; state = 'strike';
  return true;
}
function launch() {
  const v = speedFromPower(pendingShot.p), c = balls[0];
  c.vx = Math.cos(pendingShot.a) * v; c.vz = Math.sin(pendingShot.a) * v;
  shots++; lastPocketed = []; state = 'roll'; pendingShot = null;
  setInfo(`Tiro ${shots} · Bolas embocadas: ${pocketedCount}/15`);
}
function endOfShot() {
  let msg;
  const scratched = !balls[0].active;
  if (scratched) { placeCueBall(); msg = '⚠️ Bola blanca embocada · se repone en la cabecera'; }
  else if (lastPocketed.length) msg = `¡Embocaste ${lastPocketed.map(n => 'la ' + n).join(', ')}! · ${pocketedCount}/15`;
  else msg = `Tu turno · ${pocketedCount}/15 embocadas`;
  if (pocketedCount === 15) msg = '🏆 ¡Mesa despejada en ' + shots + ' tiros!';
  setInfo(msg); state = 'aim';
}

// ---------- Predicción de la trayectoria (guía de puntería) ----------
function predict(a) {
  const c = balls[0], dx = Math.cos(a), dz = Math.sin(a);
  let best = Infinity, hit = null;
  for (const b of balls) {
    if (b === c || !b.active) continue;
    const fx = b.x - c.x, fz = b.z - c.z, t = fx * dx + fz * dz;
    if (t <= 0) continue;
    const d2 = fx * fx + fz * fz - t * t;
    if (d2 > 4 * R * R) continue;
    const th = t - Math.sqrt(4 * R * R - d2);
    if (th < best) { best = th; hit = b; }
  }
  let tc = Infinity;
  if (dx > 1e-6) tc = Math.min(tc, (W / 2 - R - c.x) / dx); if (dx < -1e-6) tc = Math.min(tc, (-W / 2 + R - c.x) / dx);
  if (dz > 1e-6) tc = Math.min(tc, (H / 2 - R - c.z) / dz); if (dz < -1e-6) tc = Math.min(tc, (-H / 2 + R - c.z) / dz);
  if (hit && best < tc) {
    const gx = c.x + dx * best, gz = c.z + dz * best;
    let tx = hit.x - gx, tz = hit.z - gz; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    return { gx, gz, hit, tx, tz };
  }
  return { gx: c.x + dx * tc, gz: c.z + dz * tc, hit: null };
}

// ---------- Bot (tiro automático con puntería por "bola fantasma") ----------
const LEVELS = [ { name: 'Fácil', noise: 3.0 * Math.PI / 180 }, { name: 'Medio', noise: 1.0 * Math.PI / 180 }, { name: 'Difícil', noise: 0.25 * Math.PI / 180 } ];
function pathClear(x1, z1, x2, z2, ignore) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
  if (L < 1e-6) return true;
  for (const b of balls) {
    if (!b.active || ignore.includes(b)) continue;
    const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.z - z1) * dz) / (L * L)));
    if (Math.hypot(x1 + dx * t - b.x, z1 + dz * t - b.z) < 2 * R + 0.002) return false;
  }
  return true;
}
function planBotShot() {
  const c = balls[0];
  let best = null;
  for (const t of balls) {
    if (t === c || !t.active) continue;
    for (const p of POCKETS) {
      // apuntar un poco hacia dentro de la mesa respecto al centro de la tronera
      const px = p.x * 0.985, pz = p.z * 0.97;
      let ux = px - t.x, uz = pz - t.z; const dTP = Math.hypot(ux, uz); ux /= dTP; uz /= dTP;
      const gx = t.x - ux * 2 * R, gz = t.z - uz * 2 * R;
      if (Math.abs(gx) > W / 2 - R || Math.abs(gz) > H / 2 - R) continue;
      let vx = gx - c.x, vz = gz - c.z; const dCG = Math.hypot(vx, vz); vx /= dCG; vz /= dCG;
      const cos = vx * ux + vz * uz;
      if (cos < Math.cos(75 * Math.PI / 180)) continue;
      if (!pathClear(c.x, c.z, gx, gz, [c, t]) || !pathClear(t.x, t.z, px, pz, [c, t])) continue;
      const score = dCG + 1.3 * dTP + 2.5 * (1 - cos);
      if (!best || score < best.score) best = { score, a: Math.atan2(vz, vx), dCG, dTP, cos };
    }
  }
  if (best) {
    const decel = 1.1; // aproximación para estimar la fuerza
    const vT = Math.sqrt(2 * decel * (best.dTP + 0.12));
    const v = Math.sqrt((vT / Math.max(0.3, best.cos)) ** 2 + 2 * decel * best.dCG) * 1.15;
    return { a: best.a, p: Math.max(0.12, Math.min(0.85, powerFromSpeed(v))), found: true };
  }
  // Sin tiro limpio: golpear la bola más cercana con fuerza media
  const targets = balls.filter(b => b !== c && b.active);
  if (!targets.length) return null;
  const t = targets.reduce((a, b) => Math.hypot(a.x - c.x, a.z - c.z) < Math.hypot(b.x - c.x, b.z - c.z) ? a : b);
  return { a: Math.atan2(t.z - c.z, t.x - c.x), p: 0.5, found: false };
}
function botShot() {
  if (state !== 'aim' || moving() || !balls[0].active) return;
  const plan = planBotShot(); if (!plan) return;
  const level = LEVELS[Number($('level').value) || 0];
  // Error gaussiano de puntería según el nivel
  const gauss = Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
  const target = plan.a + gauss * level.noise;
  let diff = target - aim; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  botAnim = { from: aim, diff, p: plan.p, t: 0 };
  state = 'bot';
  setInfo(`🤖 Bot (${level.name}) ${plan.found ? 'apuntando a una tronera…' : 'sin tiro claro, juega seguro…'}`);
}

// ---------- Interfaz ----------
function setInfo(t) { $('info').textContent = t; }
function setStatus(t) { $('status').textContent = t; }
function setAim(a) {
  aim = Math.atan2(Math.sin(a), Math.cos(a));
  const deg = aim * 180 / Math.PI;
  $('angle').value = deg.toFixed(1);
  $('angleValue').textContent = deg.toFixed(1) + '°';
}
function setPower(p) {
  power = Math.max(0.01, Math.min(1, p));
  $('power').value = Math.round(power * 100);
  $('powerValue').textContent = Math.round(power * 100) + '%';
}
function holdRepeat(btn, fn) {
  let timer = null, rep = null;
  const stop = () => { clearTimeout(timer); clearInterval(rep); timer = rep = null; };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); fn(); timer = setTimeout(() => { rep = setInterval(fn, 60); }, 350); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
}
function bindUI() {
  $('angle').addEventListener('input', e => setAim(Number(e.target.value) * Math.PI / 180));
  $('power').addEventListener('input', e => setPower(Number(e.target.value) / 100));
  holdRepeat($('aimL'), () => { if (state === 'aim') setAim(aim - 0.25 * Math.PI / 180); });
  holdRepeat($('aimR'), () => { if (state === 'aim') setAim(aim + 0.25 * Math.PI / 180); });
  $('shoot').addEventListener('click', () => shoot(aim, power));
  $('bot').addEventListener('click', botShot);
  $('reset').addEventListener('click', rack);
  $('toggleUI').addEventListener('click', () => { $('ui').classList.toggle('compact'); view.key = ''; });
  if (MODE === 'ar') {
    const sc = () => root.object3D.scale.x;
    const setScale = s => { s = Math.max(0.2, Math.min(3, s)); root.object3D.scale.set(s, s, s); $('sizeValue').textContent = s.toFixed(1) + '×'; };
    $('smaller').addEventListener('click', () => setScale(sc() / 1.2));
    $('bigger').addEventListener('click', () => setScale(sc() * 1.2));
    setScale(sc());
  } else {
    $('camFollow').addEventListener('click', () => { cam.follow = true; cam.top = false; });
    $('camTop').addEventListener('click', () => { cam.top = !cam.top; cam.follow = !cam.top; });
  }
}

// ---------- Tocar la mesa para apuntar ----------
const _m = new THREE.Matrix4(), _o = new THREE.Vector3(), _p = new THREE.Vector3();
function tablePointFromScreen(clientX, clientY) {
  const camera = sceneEl.camera, canvas = sceneEl.canvas;
  if (!camera || !canvas) return null;
  if (MODE === 'ar' && !$('marker').object3D.visible) return null;
  const rect = canvas.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1, ny = -((clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld(); table.updateMatrixWorld();
  _o.setFromMatrixPosition(camera.matrixWorld);
  _p.set(nx, ny, 0.5).applyMatrix4(_m.copy(camera.projectionMatrix).invert()).applyMatrix4(camera.matrixWorld);
  _m.copy(table.matrixWorld).invert();
  _o.applyMatrix4(_m); _p.applyMatrix4(_m);
  const dy = _p.y - _o.y; if (Math.abs(dy) < 1e-9) return null;
  const t = (R - _o.y) / dy; if (t <= 0) return null;
  return { x: _o.x + (_p.x - _o.x) * t, z: _o.z + (_p.z - _o.z) * t };
}
function aimAt(clientX, clientY) {
  if (state !== 'aim' || !balls[0].active) return;
  const pt = tablePointFromScreen(clientX, clientY); if (!pt) return;
  const c = balls[0];
  if (Math.hypot(pt.x - c.x, pt.z - c.z) < 0.01) return;
  setAim(Math.atan2(pt.z - c.z, pt.x - c.x));
}

// ---------- Cámara 3D (orbitar, seguir el taco, vista superior) ----------
const cam = { follow: true, top: false, az: 0, el: 0.42, r: 2.6, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), init: false };
function bindPointer() {
  const canvas = sceneEl.canvas; canvas.style.touchAction = 'none';
  const pts = new Map(); let downAt = null, moved = 0, pinch = 0;
  canvas.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    if (MODE === 'ar') aimAt(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved += Math.abs(dx) + Math.abs(dy);
    if (MODE === 'ar') { aimAt(e.clientX, e.clientY); return; }
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.r = Math.max(0.6, Math.min(5, cam.r * pinch / d)); pinch = d; return;
    }
    if (moved > 8) {
      if (cam.follow || cam.top) { cam.follow = false; cam.top = false; }
      cam.az += dx * 0.008; cam.el = Math.max(0.08, Math.min(1.45, cam.el + dy * 0.006));
    }
  });
  const up = e => {
    if (MODE === '3d' && downAt && pts.size === 1 && moved < 8 && performance.now() - downAt.t < 450) aimAt(e.clientX, e.clientY);
    pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.max(0.6, Math.min(5, cam.r * (1 + e.deltaY * 0.001))); }, { passive: false });
}
const _eye = new THREE.Vector3(), _tg = new THREE.Vector3(), _up = new THREE.Vector3();
// Zona de la pantalla que no tapa la interfaz: el centro de la cámara se mueve ahí
let view = { key: '', frac: 1, portrait: true };
function updateViewOffset() {
  const camera = sceneEl.camera, canvas = sceneEl.canvas; if (!camera || !canvas || !camera.setViewOffset) return;
  const fw = canvas.clientWidth, fh = canvas.clientHeight; if (!fw || !fh) return;
  const ui = $('ui').getBoundingClientRect(), head = document.querySelector('header').getBoundingClientRect(), info = $('info').getBoundingClientRect();
  let x0 = 0, x1 = fw, y0 = 0, y1 = fh;
  if (ui.width < fw * 0.7) x0 = ui.right; else { y0 = head.bottom; y1 = info.top; }
  const ox = Math.round(fw / 2 - (x0 + x1) / 2), oy = Math.round(fh / 2 - (y0 + y1) / 2);
  const key = [fw, fh, ox, oy].join(',');
  view.frac = Math.max(0.3, (y1 - y0) / fh); view.wfrac = Math.max(0.3, (x1 - x0) / fw); view.portrait = fh > fw;
  if (key === view.key && camera.view && camera.view.enabled) return;
  view.key = key;
  camera.setViewOffset(fw, fh, ox, oy, fw, fh);
}
function updateCamera(dt) {
  const camEl = $('cam'); if (!camEl) return;
  updateViewOffset();
  const c = balls[0];
  const camera = sceneEl.camera, tanH = Math.tan(((camera && camera.fov) || 55) * Math.PI / 360), aspect = (camera && camera.aspect) || 0.5;
  let az, el, r, tx, tz;
  if (cam.top) {
    az = 0; el = 1.5707; tx = 0; tz = 0;
    const along = view.portrait ? view.frac : view.wfrac * aspect, across = view.portrait ? view.wfrac * aspect : view.frac;
    r = Math.max(2.75 / (2 * tanH * along), 1.55 / (2 * tanH * across));
  }
  else if (cam.follow) { az = aim; el = 0.42; r = 1.45; tx = c.x + Math.cos(aim) * 0.35; tz = c.z + Math.sin(aim) * 0.35; cam.az = az; cam.el = 0.5; }
  else { az = cam.az; el = cam.el; r = cam.r; tx = 0; tz = 0; }
  _tg.set(tx, R, tz);
  _eye.set(tx - r * Math.cos(el) * Math.cos(az), R + r * Math.sin(el), tz - r * Math.cos(el) * Math.sin(az));
  if (cam.top) _eye.x += 0.0001; // evita mirar exactamente en vertical
  table.localToWorld(_tg); table.localToWorld(_eye);
  const k = cam.init ? 1 - Math.exp(-dt * 6) : 1; cam.init = true;
  cam.pos.lerp(_eye, k); cam.tgt.lerp(_tg, k);
  if (cam.top) _up.set(view.portrait ? 1 : 0, 0, view.portrait ? 0 : -1);
  else _up.set(0, 1, 0);
  camEl.object3D.position.copy(cam.pos);
  camEl.object3D.quaternion.setFromRotationMatrix(_m.lookAt(cam.pos, cam.tgt, _up));
}

// ---------- Dibujo por cuadro ----------
const _q = new THREE.Quaternion(), _axis = new THREE.Vector3();
function render(dt) {
  for (const b of balls) {
    const m = b.mesh;
    if (b.sink) {
      b.sink.t += dt; const k = Math.min(1, b.sink.t / 0.25);
      m.position.set(b.sink.x0 + (b.sink.x - b.sink.x0) * k, R - k * 0.06, b.sink.z0 + (b.sink.z - b.sink.z0) * k);
      m.visible = k < 1; b.shadow.visible = false;
      if (k >= 1) b.sink = null;
      continue;
    }
    m.visible = b.active; b.shadow.visible = b.active;
    if (!b.active) continue;
    const dx = b.x - m.position.x, dz = b.z - m.position.z, d = Math.hypot(dx, dz);
    if (d > 1e-6 && d < 0.5) { _axis.set(dz / d, 0, -dx / d); _q.setFromAxisAngle(_axis, d / R); m.quaternion.premultiply(_q); }
    m.position.set(b.x, R, b.z);
    b.shadow.position.set(b.x + 0.006, 0.0015, b.z + 0.006);
  }
  // Taco y guía
  const c = balls[0];
  const showStick = c.active && (state === 'aim' || state === 'strike' || state === 'bot');
  stick.visible = showStick; aimLine.visible = ghostRing.visible = targetLine.visible = showStick && state !== 'strike';
  if (!showStick) return;
  let gap = 0.012 + 0.03 + power * 0.14;
  if (state === 'strike') { const k = Math.min(1, strikeT / 0.12); gap = 0.004 + (0.03 + pendingShot.p * 0.14) * (1 - k * k); }
  if (state === 'bot' && botAnim) gap = 0.012 + 0.03 + botAnim.p * 0.14;
  const a = state === 'strike' ? pendingShot.a : aim;
  stick.position.set(c.x, R, c.z); stick.rotation.y = -a;
  stickPitch.position.x = -gap;
  if (state === 'strike') return;
  const pr = predict(a), y = 0.002;
  const pa = aimLine.geometry.attributes.position;
  pa.setXYZ(0, c.x, y, c.z); pa.setXYZ(1, pr.gx, y, pr.gz); pa.needsUpdate = true; aimLine.geometry.computeBoundingSphere();
  ghostRing.position.set(pr.gx, y + 0.0005, pr.gz);
  targetLine.visible = !!pr.hit;
  if (pr.hit) {
    const pt = targetLine.geometry.attributes.position, L = 0.35;
    pt.setXYZ(0, pr.hit.x, y, pr.hit.z); pt.setXYZ(1, pr.hit.x + pr.tx * L, y, pr.hit.z + pr.tz * L); pt.needsUpdate = true;
    targetLine.geometry.computeBoundingSphere();
  }
}

let acc = 0;
function tick(dtMs) {
  const dt = Math.min(0.05, (dtMs || 16) / 1000);
  if (state === 'bot' && botAnim) {
    botAnim.t += dt; const k = Math.min(1, botAnim.t / 0.7), e = k * k * (3 - 2 * k);
    setAim(botAnim.from + botAnim.diff * e); setPower(botAnim.p);
    if (k >= 1) { const p = botAnim.p; botAnim = null; state = 'aim'; shoot(aim, p); }
  }
  if (state === 'strike') { strikeT += dt; if (strikeT >= 0.12) launch(); }
  if (state === 'roll') {
    acc += dt; let n = 0;
    while (acc >= DT && n++ < 24) { step(); acc -= DT; }
    if (n >= 24) acc = 0;
    if (!moving() && balls.every(b => !b.sink)) endOfShot();
  } else acc = 0;
  render(dt);
  if (MODE === '3d') updateCamera(dt);
}

// ---------- Arranque ----------
AFRAME.registerComponent('pool-tick', { tick(t, dt) { tick(dt); } });
function start() {
  root = $('tableRoot');
  table = buildTable(root.object3D);
  setupEnvironment();
  bindUI(); bindPointer(); setPower(0.4); rack();
  sceneEl.setAttribute('pool-tick', '');
  if (MODE === 'ar') {
    setStatus('Busca el marcador HIRO');
    $('marker').addEventListener('markerFound', () => setStatus('✓ Mesa AR detectada'));
    $('marker').addEventListener('markerLost', () => setStatus('Busca el marcador HIRO'));
    window.addEventListener('camera-error', () => { setStatus('Sin cámara'); showError('No se pudo abrir la cámara. Revisa el permiso de Cámara en Safari (aA → Configuración del sitio web) y recarga.'); });
    window.addEventListener('camera-init', () => setStatus('Cámara lista · busca el marcador HIRO'));
  } else setStatus('Vista 3D · sin cámara');
  window.ARPOOL = { balls, shoot, botShot, rack, predict, get state() { return state; }, setAim, setPower }; // para pruebas
}

if (MODE === 'ar') {
  if (!window.isSecureContext) showError('La cámara solo funciona con HTTPS. Abre el juego desde el enlace https:// de GitHub Pages.');
  else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) showError('Este navegador no permite usar la cámara aquí. En iPhone abre el enlace en Safari (no dentro de WhatsApp o Instagram).');
}
sceneEl = document.querySelector('a-scene');
if (sceneEl.hasLoaded) start(); else sceneEl.addEventListener('loaded', start);
})();
