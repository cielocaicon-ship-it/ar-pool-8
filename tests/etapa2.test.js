/* ==========================================================================
   Pruebas de la Etapa 2 — motor de física
       node tests/etapa2.test.js
   ========================================================================== */
'use strict';
const assert = require('assert');
const cfg = require('../js/core/config.js');
const { buildRack } = require('../js/core/rack.js');
const { Motor } = require('../js/fisica/motor.js');

let ok = 0, fallos = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; console.log('  ✔ ' + nombre); }
  catch (e) { fallos++; console.log('  ✘ ' + nombre + '\n      ' + e.message); }
}
const R = cfg.BALL.radius;
const hx = cfg.TABLE.playLength / 2, hz = cfg.TABLE.playWidth / 2;
const dirA = (deg) => ({ x: Math.cos(deg * Math.PI / 180), z: -Math.sin(deg * Math.PI / 180) });

console.log('\nMovimiento y fricción');
prueba('La blanca no se mueve hasta recibir el golpe', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: 0, z: 0 }]);
  m.avanzar(0.5);
  assert.strictEqual(m.bola(0).x, 0);
  assert.strictEqual(m.enMovimiento(), false);
});
prueba('Un golpe suave termina deteniéndose por completo', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: -1, z: 0 }]);
  m.golpear(dirA(0), 0.15);
  m.simularHastaReposo(30);
  assert.strictEqual(m.enMovimiento(), false);
  assert.ok(m.bola(0).x > -1 + 0.1, 'avanzó ' + (m.bola(0).x + 1).toFixed(2) + ' m');
});
prueba('Golpe al centro: primero desliza y luego rueda (v = ω·R)', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: -1, z: 0 }]);
  m.golpear(dirA(0), 0.4);
  const b = m.bola(0);
  assert.ok(Math.abs(b.wz) === 0);            // al inicio no gira
  for (let i = 0; i < 400; i++) m.paso(m.p.dt, []);   // 0.8 s
  assert.ok(Math.abs(b.vx + b.wz * R) < 1e-6, 'rueda sin deslizar');
});
prueba('La dirección del movimiento coincide con la del taco', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: 0, z: 0 }]);
  m.golpear(dirA(30), 0.3);
  m.avanzar(0.1);
  const b = m.bola(0);
  const ang = Math.atan2(-b.z, b.x) * 180 / Math.PI;
  assert.ok(Math.abs(ang - 30) < 0.01, 'ángulo ' + ang.toFixed(3));
});

console.log('\nColisiones');
prueba('Choque frontal: la blanca casi se detiene y la otra sale con ~95% de la velocidad', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: -0.5, z: 0 }, { number: 1, x: 0, z: 0 }]);
  m.golpear(dirA(0), 0.5);
  let ev = [];
  while (!ev.some(e => e.tipo === 'bola-bola')) m.paso(m.p.dt, ev);
  const a = m.bola(0), b = m.bola(1);
  const antes = a.vx + b.vx;
  assert.ok(Math.abs(b.vx) > 0.9 * Math.abs(antes) && Math.abs(a.vx) < 0.06 * Math.abs(antes),
    `blanca ${a.vx.toFixed(3)} m/s, bola 1 ${b.vx.toFixed(3)} m/s`);
});
prueba('Se conserva el momento lineal en el choque (impacto oblicuo)', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: 0, z: 0 }, { number: 3, x: 2 * R - 0.002, z: 0.01 }]);
  const a = m.bola(0), b = m.bola(3);
  a.vx = 3; a.vz = 0.4; b.vx = -0.5; b.vz = 0;
  const px = a.vx + b.vx, pz = a.vz + b.vz;
  m.choqueBolas(a, b, []);
  assert.ok(Math.abs(a.vx + b.vx - px) < 1e-12 && Math.abs(a.vz + b.vz - pz) < 1e-12);
  assert.ok(b.vx > 0, 'la bola golpeada sale hacia adelante');
});
prueba('Golpe con efecto de retroceso (draw): la blanca vuelve hacia atrás', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: -0.4, z: 0 }, { number: 2, x: 0, z: 0 }]);
  m.golpear(dirA(0), 0.6, { lado: 0, alto: -1 });
  m.simularHastaReposo(30);
  assert.ok(m.bola(0).x < -0.45, 'la blanca terminó en x = ' + m.bola(0).x.toFixed(3));
});
prueba('Un tiro a máxima fuerza contra la banda no atraviesa la mesa', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: 0.3, z: 0 }]);
  m.golpear(dirA(90), 1);   // hacia la banda lateral (sin tronera en x = 0.3)
  m.simularHastaReposo(30);
  const b = m.bola(0);
  assert.ok(b.activa, 'no debería caer');
  assert.ok(Math.abs(b.z) <= hz - R + 1e-6 && Math.abs(b.x) <= hx - R + 1e-6, `quedó en (${b.x.toFixed(3)}, ${b.z.toFixed(3)})`);
});
prueba('Rebote en banda: sale con el ángulo reflejado', () => {
  const m = new Motor(); m.colocar([{ number: 0, x: 0.5, z: 0 }]);
  m.golpear(dirA(-45), 0.25);   // hacia +z
  const ev = [];
  while (!ev.some(e => e.tipo === 'banda')) m.paso(m.p.dt, ev);
  const b = m.bola(0);
  assert.ok(b.vz < 0 && b.vx > 0, 'después del rebote va hacia -z y sigue avanzando en +x');
});

console.log('\nTroneras');
prueba('Un tiro recto a la tronera de esquina emboca la bola', () => {
  const m = new Motor();
  const p = cfg.pocketCenters().find(t => t.id === 'esq-3');
  m.colocar([{ number: 0, x: p.x - 0.6, z: p.z - 0.6 }]);
  m.golpear({ x: Math.SQRT1_2, z: Math.SQRT1_2 }, 0.4);
  const ev = m.simularHastaReposo(30);
  const t = ev.find(e => e.tipo === 'tronera');
  assert.ok(t && t.tronera === 'esq-3', 'evento: ' + JSON.stringify(t));
  assert.strictEqual(m.bola(0).activa, false);
});
prueba('Un tiro recto a la tronera lateral emboca la bola', () => {
  const m = new Motor();
  m.colocar([{ number: 5, x: 0, z: 0 }, { number: 0, x: 0, z: -0.3 }]);
  m.golpear(dirA(-90), 0.45);   // hacia +z, empuja la 5 a la tronera lateral
  const ev = m.simularHastaReposo(30);
  assert.ok(ev.some(e => e.tipo === 'tronera' && e.bola === 5 && e.tronera === 'lat-2'));
});
prueba('La blanca embocada se puede reponer en la cabecera', () => {
  const m = new Motor(); m.colocar(buildRack());
  m.bola(0).activa = false;
  const b = m.reponer(0, cfg.HEAD_SPOT.x, 0);
  assert.ok(b.activa && Math.abs(b.x - cfg.HEAD_SPOT.x) < 1e-9);
});

console.log('\nSaque completo');
function saque() {
  const m = new Motor(); m.colocar(buildRack());
  m.golpear(dirA(0.5), 1);
  const ev = m.simularHastaReposo(60);
  return { m, ev };
}
prueba('Tras el saque ninguna bola se superpone ni queda fuera de la mesa', () => {
  const { m } = saque();
  const act = m.bolas.filter(b => b.activa);
  for (let i = 0; i < act.length; i++) {
    const a = act[i];
    assert.ok(Math.abs(a.x) <= hx - R + 1e-4 && Math.abs(a.z) <= hz - R + 1e-4, 'bola ' + a.n + ' fuera');
    for (let j = i + 1; j < act.length; j++) {
      const d = Math.hypot(a.x - act[j].x, a.z - act[j].z);
      assert.ok(d >= 2 * R - 1e-5, `bolas ${a.n} y ${act[j].n} solapadas`);
    }
  }
});
prueba('El saque es reproducible: dos simulaciones iguales dan el mismo resultado', () => {
  const a = saque().m.instantanea(), b = saque().m.instantanea();
  assert.deepStrictEqual(a, b);
});
prueba('El saque dispersa el triángulo y todas las bolas se detienen', () => {
  const { m, ev } = saque();
  assert.strictEqual(m.enMovimiento(), false);
  const movidas = m.bolas.filter(b => b.n !== 0 && b.activa && Math.hypot(b.x - 0.635, b.z) > 0.25).length
    + ev.filter(e => e.tipo === 'tronera').length;
  assert.ok(movidas >= 8, 'solo se dispersaron ' + movidas);
});

console.log(`\n${ok} pruebas correctas, ${fallos} fallidas\n`);
process.exit(fallos ? 1 : 0);
