// Valida el empacador sobre malla: formas NO rectangulares + obstáculos.
// Lo que revisaría el usuario: nada encimado, nada fuera de la forma, nada
// encima de una columna o escalera.
import { acomodarEnForma, dentroPoly, CELDA } from '../src/datos/malla.js';
import { expandirPiezas } from '../src/datos/espacio.js';

const P = (id, nombre, cant, ruta) => ({ id, nombre, cantidad: cant, ruta, w: null, d: null });

// Oficina en L de 14×10 m con la esquina inferior derecha recortada (6×5 m).
const L = [[0, 0], [14000, 0], [14000, 5000], [8000, 5000], [8000, 10000], [0, 10000]];
// Despacho con núcleo central: rectángulo con escalera y 2 columnas.
const RECT = null;

const CASOS = [
  {
    titulo: 'oficina en L (14×10 con esquina recortada) + 2 columnas',
    area: { ancho: 14000, largo: 10000, poly: L, obstaculos: [
      { x: 3000, y: 3000, w: 400, h: 400 }, { x: 6000, y: 7000, w: 400, h: 400 },
    ] },
    partidas: [
      P('a', 'Banca doble APP LT 1.05 · 4 usuarios', 3, 'applt'),
      P('b', 'Modulor · Archivero horizontal 0.75, 2 cajones', 6, 'modulor'),
      P('c', 'Mesa de juntas APP LT 2.40 × 1.20', 1, 'applt'),
      P('d', 'Pac · Sillón sin brazos, tela', 6, 'pac'),
    ],
  },
  {
    titulo: 'rectángulo 12×9 con escalera al centro + columna',
    area: { ancho: 12000, largo: 9000, poly: RECT, obstaculos: [
      { x: 5000, y: 3500, w: 2500, h: 2000 }, { x: 1500, y: 1500, w: 400, h: 400 },
    ] },
    partidas: [
      P('a', 'Escritorio APP LT 1.50 × 0.60', 8, 'applt'),
      P('b', 'Modulor · Librero vertical 1.20', 4, 'modulor'),
    ],
  },
  {
    titulo: 'espacio chico 5×4 con demasiado mueble (debe reportar los que no caben)',
    area: { ancho: 5000, largo: 4000, poly: null, obstaculos: [] },
    partidas: [P('a', 'Mesa de juntas Alba 3.60 m', 6, 'alba')],
  },
];

let fallas = 0;
for (const c of CASOS) {
  const piezas = expandirPiezas(c.partidas, 60);
  const r = acomodarEnForma(c.area, piezas);
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));

  const cajas = r.colocacion.map((k) => {
    const p = byId[k.id];
    const w = k.rot === 90 ? p.d : p.w, h = k.rot === 90 ? p.w : p.d;
    return { id: k.id, x: k.x, y: k.y, w, h };
  });

  // 1) nada encimado
  let encimados = 0;
  for (let i = 0; i < cajas.length; i++)
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) encimados++;
    }

  // 2) las 4 esquinas de cada mueble dentro de la forma
  let fueraForma = 0;
  for (const b of cajas) {
    const esq = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
    const ok = esq.every(([x, y]) =>
      x >= -CELDA && y >= -CELDA && x <= c.area.ancho + CELDA && y <= c.area.largo + CELDA &&
      (!c.area.poly || dentroPoly(c.area.poly, Math.min(Math.max(x, 1), c.area.ancho - 1), Math.min(Math.max(y, 1), c.area.largo - 1))));
    if (!ok) fueraForma++;
  }

  // 3) ningún mueble encima de un obstáculo
  let sobreObst = 0;
  for (const b of cajas)
    for (const o of c.area.obstaculos || [])
      if (b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h) sobreObst++;

  const ok = encimados === 0 && fueraForma === 0 && sobreObst === 0;
  if (!ok) fallas++;
  console.log(`${ok ? '✓' : '✗'} ${c.titulo}`);
  console.log(`    colocadas ${r.colocacion.length}/${piezas.length} · encimados ${encimados} · fuera de la forma ${fueraForma} · sobre obstáculo ${sobreObst}` +
    (r.fuera.length ? ` · NO CUPIERON ${r.fuera.length}` : ''));
}
console.log(fallas === 0 ? '\nFORMAS REALES OK: nada encimado, nada fuera, nada sobre columnas/escaleras' : `\n${fallas} CASO(S) MAL`);
process.exit(fallas ? 1 : 0);
