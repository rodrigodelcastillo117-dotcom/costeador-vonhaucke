// Revalida el motor de acomodo después de tocar tipoDe()/huellaReal().
// Chequea lo que revisaría el usuario: 0 encimados, 0 fuera del área,
// 100% de piezas colocadas.
import { acomodarLocal } from '../src/datos/planner.js';
import { expandirPiezas, dimsPieza } from '../src/datos/espacio.js';

const P = (id, nombre, cantidad, ruta) => ({ id, nombre, cantidad, ruta: ruta || null, w: null, d: null });

const CASOS = {
  'mixto realista (App LT + juntas + guardas + sillas)': [
    P('a', 'Banca doble APP LT 1.05 · 8 usuarios', 3, 'applt'),
    P('b', 'Banca sencilla APP LT 1.20 · 3 usuarios', 4, 'applt'),
    P('c', 'Mesa de juntas APP LT 2.40 × 1.20', 2, 'applt'),
    P('d', 'Modulor · Archivero horizontal 0.75, 2 cajones', 8, 'modulor'),
    P('e', 'Pac · Sillón sin brazos, tela', 10, 'pac'),
    P('f', 'Privacy 4 · Muro cristal 1.20 × 2.40', 4, 'privacy4'),
  ],
  'solo benches grandes': [P('a', 'Feather · Bench doble 8 puestos 1.50 m', 6, 'feather')],
  'solo asientos y mamparas': [
    P('a', 'Tetris · Sofá 3 plazas', 6, 'tetris'),
    P('b', 'Privacy 4 · Muro sólido 0.90 × 2.40', 8, 'privacy4'),
  ],
  'una sola pieza': [P('a', 'Escritorio APP LT 1.50 × 0.60', 1, 'applt')],
  'catálogo revuelto (30 renglones)': Array.from({ length: 30 }, (_, i) =>
    P('x' + i, ['Escritorio APP LT 1.50 × 0.60', 'Modulor · Librero vertical 1.20', 'Río · Bench recto doble 2u · 1.20 m',
      'Mesa de juntas Alba 2.40 m', 'Arlequín · Cubo 0.40 m', 'Ergonova 4 · Banca doble 6 puestos 1.20 m'][i % 6], 1 + (i % 3))),
};

let fallas = 0;
for (const [titulo, partidas] of Object.entries(CASOS)) {
  const piezas = expandirPiezas(partidas, 60);
  const r = acomodarLocal([], piezas, { ajustar: true });
  const area = r.areas[0];
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));

  // 1) todas colocadas
  const colocadas = r.colocacion.length;
  // 2) dentro del área
  let fuera = 0;
  const cajas = r.colocacion.map((c) => {
    const p = byId[c.id];
    const { pw, ph } = dimsPieza(p, c.rot);
    if (c.x < 0 || c.y < 0 || c.x + pw > area.ancho + 1 || c.y + ph > area.largo + 1) fuera++;
    return { x: c.x, y: c.y, w: pw, h: ph };
  });
  // 3) sin encimar
  let encimados = 0;
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) encimados++;
    }

  const ok = colocadas === piezas.length && fuera === 0 && encimados === 0 && r.caben;
  if (!ok) fallas++;
  const m2 = ((area.ancho / 1000) * (area.largo / 1000)).toFixed(1);
  console.log(`${ok ? '✓' : '✗'} ${titulo.padEnd(42)} ${String(colocadas).padStart(2)}/${String(piezas.length).padEnd(3)} piezas · fuera ${fuera} · encimados ${encimados} · espacio ${(area.ancho / 1000).toFixed(1)}×${(area.largo / 1000).toFixed(1)} m (${m2} m²)`);
}
console.log(fallas === 0 ? '\nACOMODO OK: 0 encimados, 0 fuera, 100% colocadas en todos los casos' : `\n${fallas} CASO(S) MAL`);
process.exit(fallas ? 1 : 0);
