/* ==========================================================================
   Pruebas de la Etapa 1 (se ejecutan con Node, sin instalar nada):
       node tests/etapa1.test.js
   Verifican medidas reales, el armado del triángulo y el cálculo de puntería.
   ========================================================================== */
'use strict';
const assert = require('assert');
const cfg = require('../js/core/config.js');
const { buildRack, RACK_ORDER } = require('../js/core/rack.js');
const aim = require('../js/core/aim.js');

let ok = 0, fallos = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; console.log('  ✔ ' + nombre); }
  catch (e) { fallos++; console.log('  ✘ ' + nombre + '\n      ' + e.message); }
}
const R = cfg.BALL.radius;
const hx = cfg.TABLE.playLength / 2, hz = cfg.TABLE.playWidth / 2;

console.log('\nMedidas');
prueba('Bola de 57.15 mm de diámetro', () => assert.ok(Math.abs(R * 2 - 0.05715) < 1e-6));
prueba('Mesa de 9 pies: área de juego 2:1 (2.54 × 1.27 m)', () => {
  assert.strictEqual(cfg.TABLE.playLength, 2.54);
  assert.strictEqual(cfg.TABLE.playLength / cfg.TABLE.playWidth, 2);
});
prueba('Nariz de banda entre 62% y 65% del diámetro de la bola', () => {
  const r = cfg.TABLE.cushionHeight / (2 * R);
  assert.ok(r > 0.62 && r < 0.65, 'relación = ' + r.toFixed(3));
});
prueba('Boca de esquina ≈ 2 diámetros de bola (reglamento: 4.5"–4.625")', () => {
  const d = cfg.TABLE.cornerMouth / (2 * R);
  assert.ok(d > 1.9 && d < 2.4, 'boca = ' + d.toFixed(2) + ' diámetros');
  assert.ok(cfg.TABLE.sideMouth > cfg.TABLE.cornerMouth);
});
prueba('Hay 6 troneras simétricas', () => {
  const p = cfg.pocketCenters();
  assert.strictEqual(p.length, 6);
  const sx = p.reduce((s, q) => s + q.x, 0), sz = p.reduce((s, q) => s + q.z, 0);
  assert.ok(Math.abs(sx) < 1e-9 && Math.abs(sz) < 1e-9);
});

console.log('\nArmado del triángulo');
const rack = buildRack();
prueba('16 bolas, números 0 a 15 sin repetir', () => {
  assert.strictEqual(rack.length, 16);
  const nums = rack.map(b => b.number).sort((a, b) => a - b);
  assert.deepStrictEqual(nums, [...Array(16).keys()]);
});
prueba('Ninguna bola se superpone con otra', () => {
  for (let i = 0; i < rack.length; i++)
    for (let j = i + 1; j < rack.length; j++) {
      const d = Math.hypot(rack[i].x - rack[j].x, rack[i].z - rack[j].z);
      assert.ok(d >= 2 * R, `bolas ${rack[i].number} y ${rack[j].number} a ${d.toFixed(5)} m`);
    }
});
prueba('Todas las bolas están dentro del área de juego', () => {
  rack.forEach(b => {
    assert.ok(Math.abs(b.x) <= hx - R && Math.abs(b.z) <= hz - R, 'bola ' + b.number);
  });
});
prueba('Bola 1 en el vértice, sobre el punto de pie', () => {
  const b1 = rack.find(b => b.number === 1);
  assert.ok(Math.abs(b1.x - cfg.FOOT_SPOT.x) < 1e-9 && Math.abs(b1.z) < 1e-9);
});
prueba('Bola 8 en el centro de la tercera fila', () => {
  assert.strictEqual(RACK_ORDER[2][1], 8);
  const b8 = rack.find(b => b.number === 8);
  assert.ok(Math.abs(b8.z) < 1e-9);
});
prueba('Esquinas traseras: una lisa y una rayada', () => {
  const ult = RACK_ORDER[4];
  const tipos = [cfg.ballType(ult[0]), cfg.ballType(ult[ult.length - 1])].sort();
  assert.deepStrictEqual(tipos, ['lisa', 'rayada']);
});
prueba('Bola blanca en la zona de cabecera', () => {
  const b0 = rack.find(b => b.number === 0);
  assert.ok(b0.x < -hx / 2 + 1e-9);
});
prueba('7 lisas, 7 rayadas, 1 negra, 1 blanca', () => {
  const c = {};
  rack.forEach(b => { const t = cfg.ballType(b.number); c[t] = (c[t] || 0) + 1; });
  assert.deepStrictEqual(c, { blanca: 1, lisa: 7, rayada: 7, negra: 1 });
});

console.log('\nPuntería (línea guía y primer contacto)');
prueba('El ángulo 0° apunta a +x y 90° apunta a -z', () => {
  const a = aim.dirFromAngle(0), b = aim.dirFromAngle(90);
  assert.ok(Math.abs(a.x - 1) < 1e-9 && Math.abs(a.z) < 1e-9);
  assert.ok(Math.abs(b.x) < 1e-9 && Math.abs(b.z + 1) < 1e-9);
});
prueba('Saque recto: el primer contacto es la bola 1', () => {
  const b0 = rack[0];
  const hit = aim.firstContact(b0, aim.dirFromAngle(0), rack, R, hx, hz);
  assert.strictEqual(hit.tipo, 'bola');
  assert.strictEqual(hit.bola, 1);
  // la blanca queda tocando la bola 1 (distancia entre centros = 2R)
  const b1 = rack.find(b => b.number === 1);
  assert.ok(Math.abs(Math.hypot(hit.punto.x - b1.x, hit.punto.z - b1.z) - 2 * R) < 1e-9);
});
prueba('Tiro hacia atrás: el primer contacto es la banda de cabecera', () => {
  const b0 = rack[0];
  const hit = aim.firstContact(b0, aim.dirFromAngle(180), rack, R, hx, hz);
  assert.strictEqual(hit.tipo, 'banda');
  assert.ok(Math.abs(hit.punto.x - (-hx + R)) < 1e-9);
});
prueba('Tiro perpendicular: llega a la banda lateral a R de la nariz', () => {
  const hit = aim.firstContact({ x: 0, z: 0 }, aim.dirFromAngle(90), [], R, hx, hz);
  assert.strictEqual(hit.tipo, 'banda');
  assert.ok(Math.abs(hit.punto.z - (-hz + R)) < 1e-9);
});
prueba('Bola rozada: el contacto ocurre aunque el centro no esté en la línea', () => {
  const objetivo = [{ number: 3, x: 0.5, z: 0.05 }];   // 5 cm de lado (< 2R = 5.7 cm)
  const hit = aim.firstContact({ x: 0, z: 0 }, aim.dirFromAngle(0), objetivo, R, hx, hz);
  assert.strictEqual(hit.tipo, 'bola');
  const fuera = [{ number: 3, x: 0.5, z: 0.06 }];       // 6 cm de lado (> 2R): no la toca
  assert.strictEqual(aim.firstContact({ x: 0, z: 0 }, aim.dirFromAngle(0), fuera, R, hx, hz).tipo, 'banda');
});

console.log(`\n${ok} pruebas correctas, ${fallos} fallidas\n`);
process.exit(fallos ? 1 : 0);
