import { acomodarLocal } from '../src/datos/planner.js';
import { acomodarEnForma } from '../src/datos/malla.js';
import { dimsPieza, frenteDe, huellaReal } from '../src/datos/espacio.js';

const dims = (p, c) => dimsPieza(p, c.rot);

console.log('\n=== A · dos bancas 4.80×1.20 en un open 9.00×4.00 (¿caben? un proyectista dice que SÍ)');
{
  const areas = [{ nombre: 'Open', tipo: 'open', ancho: 9000, largo: 4000 }];
  const piezas = [
    { id: 'b1', nombre: 'Banca doble 8 usuarios · ocupa 4.80 × 1.20 m', w: 4800, d: 1200, tipo: 'escritorio' },
    { id: 'b2', nombre: 'Banca doble 8 usuarios · ocupa 4.80 × 1.20 m', w: 4800, d: 1200, tipo: 'escritorio' },
  ];
  const r = acomodarLocal(areas, piezas, { ajustar: false });
  console.log(' colocadas:', r.colocacion.length, '/2 →', r.colocacion.map((c) => `${c.id}@${c.x},${c.y}`));
  console.log(' notas:', r.notas);
  console.log(' A MANO cabría: 0.10 + 1.20 + 1.00(pasillo) + 1.20 = 3.50 m de 4.00 → sobran 0.50 m');
}

console.log('\n=== B · ¿el escritorio ve a la puerta? (4 puertas, 4 pruebas)');
{
  const casos = [
    ['puerta ABAJO  (y=3900)', { x: 1750, y: 3900, ancho: 900 }],
    ['puerta ARRIBA (y=100)',  { x: 1750, y: 100, ancho: 900 }],
    ['puerta DERECHA(x=3400)', { x: 3400, y: 2000, ancho: 900 }],
    ['puerta IZQ    (x=100)',  { x: 100, y: 2000, ancho: 900 }],
  ];
  for (const [et, pu] of casos) {
    const area = { nombre: 'Privado', tipo: 'privado', ancho: 3500, largo: 4000, puertas: [pu] };
    const piezas = [{ id: 'd', nombre: 'Escritorio 1.80', w: 1800, d: 800, tipo: 'escritorio' }];
    const r = acomodarEnForma(area, piezas);
    const c = r.colocacion[0];
    if (!c) { console.log(`  ${et}: NO SE COLOCÓ`); continue; }
    const { pw, ph } = dimsPieza(piezas[0], c.rot);
    const cx = c.x + pw / 2, cy = c.y + ph / 2;
    const f = frenteDe(c.rot);
    const dir = { abajo: [0, 1], izq: [-1, 0], arriba: [0, -1], der: [1, 0] }[f];
    const dx = pu.x - cx, dy = pu.y - cy;
    const cos = (dir[0] * dx + dir[1] * dy) / (Math.hypot(dx, dy) || 1);
    console.log(`  ${et}: pos=(${c.x},${c.y}) rot=${c.rot} silla al '${f}' · coseno hacia la puerta=${cos.toFixed(2)} ${cos > 0.3 ? 'VE A LA PUERTA' : 'NO la ve'}`);
  }
}

console.log('\n=== C · sala de juntas: ¿la mesa queda centrada y con 90 cm alrededor?');
{
  const area = { nombre: 'Sala de juntas', tipo: 'juntas', ancho: 5000, largo: 4000 };
  const piezas = [{ id: 'j', nombre: 'Mesa de juntas 10 personas', w: 3000, d: 1200, tipo: 'juntas' }];
  const r = acomodarEnForma(area, piezas);
  const c = r.colocacion[0];
  const { pw, ph } = dimsPieza(piezas[0], c.rot);
  console.log(`  mesa en (${c.x},${c.y}) ${pw}×${ph} · márgenes izq=${c.x} der=${area.ancho - c.x - pw} arriba=${c.y} abajo=${area.largo - c.y - ph}`);
}

console.log('\n=== D · ¿un mueble puede quedar tapando la puerta tras un movimiento manual?');
{
  const area = { nombre: 'Privado', tipo: 'privado', ancho: 3500, largo: 4000,
    puertas: [{ x: 1750, y: 3900, ancho: 900 }],
    obstaculos: [{ x: 850, y: 3000, w: 1800, h: 1800, tipo: 'puerta' }] };
  const piezas = [{ id: 'g', nombre: 'Archivero', w: 900, d: 450, tipo: 'guarda' }];
  const r = acomodarEnForma(area, piezas);
  console.log('  auto:', r.colocacion, '→ el motor lo esquiva');
  // El proyectista lo arrastra encima de la puerta:
  const manual = { colocacion: [{ id: 'g', area: 0, x: 1300, y: 3500, rot: 0 }] };
  const b = { x0: 1300, y0: 3500, x1: 2200, y1: 3950 };
  const o = area.obstaculos[0];
  const choca = Math.min(b.x1, o.x + o.w) - Math.max(b.x0, o.x) > 0 && Math.min(b.y1, o.y + o.h) - Math.max(b.y0, o.y) > 0;
  console.log('  manual encima del barrido de la puerta:', choca ? 'SÍ CHOCA' : 'no');
  console.log('  ¿lo reporta el chequeo de Acomodo.jsx? NO — ese chequeo sólo mira bordes del rectángulo y traslapes mueble-mueble');
}

console.log('\n=== E · huellaReal con los nombres REALES de los generadores');
{
  const casos = [
    'Bench recto sencillo 6u', 'Bench recto doble 6u', 'Bench recto doble 12u',
    'App LT · Banca doble 8 usuarios', 'App · Banca sencilla 4 usuarios',
    'Estación 4u "cruz"', 'TeamSpace 10u',
  ];
  for (const n of casos) {
    console.log(`  ${n.padEnd(34)} w=1400 d=700 → ${huellaReal(n, 1400, 700, 'escritorio').join(' × ')} mm`);
  }
}
