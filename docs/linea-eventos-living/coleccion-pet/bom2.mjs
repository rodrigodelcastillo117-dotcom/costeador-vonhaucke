// Despiece + costo estimado de la línea nueva, con precios de ÚLTIMA COMPRA del ERP
// Von Haucke (mp_erp_ultima_compra.csv) y la fórmula de Alba (MO 20% del material,
// GI = 3×MO → fab = material × 1.8; compra-venta: MO 1% + GI 5% → × 1.06).
// Nesting con el optimizador del propio costeador (optimizarCorte2D), lote de 10.
import { optimizarCorte2D } from '../../../src/motor/optimizacionCorte.js';
import { writeFileSync } from 'node:fs';

const LOTE = 10;
const H4x8 = { largoMM: 2440, anchoMM: 1220 };
const ACR = { largoMM: 2438, anchoMM: 1829 };

// Tableros: precio por hoja (ERP, última compra). veta=true → no se gira (madera).
const TAB = {
  mdf18m:   { n: 'MDF melamina 2 caras 18 mm (MDF18M)', p: 975.0, f: H4x8, veta: false, ref: 'MVLMMD01011700 · 2026-08-10' },
  mdf25hpl: { n: 'MDF laminado plástico (HPL) 2 caras 25 mm', p: 1888.4, f: H4x8, veta: false, ref: 'MVLMMD04010700 · 2025-11-19' },
  mdf16hpl: { n: 'MDF laminado plástico (HPL) 2 caras 16 mm', p: 1467.69, f: H4x8, veta: false, ref: 'MVLMMD04280500 · 2025-11-19' },
  mdf25m:   { n: 'MDF melamina 2 caras 25 mm (MDF25M)', p: 1252.8, f: H4x8, veta: false, ref: 'MVLMMD01280700 · 2026-07-03' },
  trip18h:  { n: 'Triplay hidrófugo pino 18 mm', p: 598.0, f: H4x8, veta: false, ref: 'MPMATR01010102 · 2025-07-08' },
  mdf55:    { n: 'MDF natural 5.5 mm', p: 166.31, f: H4x8, veta: false, ref: 'MVLMMD02280200 · 2026-04-27' },
  mdf55m:   { n: 'MDF melamina 2 caras 5.5 mm (MDF6)', p: 582.0, f: H4x8, veta: false, ref: 'MVLMMD01280200 · 2026-08-04' },
  acr:      { n: 'Acrílico opalino 3 mm 6×8 ft', p: 1995.0, f: ACR, veta: false, ref: 'MVLPAO00821600 · 2025-12-12' },
  // Melamina aglomerado por acabado
  'gr16': { n: 'Melamina 16 mm Antracita Light TX (B761) · Grafito', p: 694.8, f: H4x8, veta: false, ref: 'B761 · 2026-07-07' },
  'gr28': { n: 'Melamina 28 mm Antracita Light TX (B761) · Grafito', p: 1295.1, f: H4x8, veta: false, ref: 'B761 · 2026-07-07' },
  'no16': { n: 'Melamina 16 mm Nogal Neo TX (B805) · Nogal', p: 665.0, f: H4x8, veta: true, ref: 'B805 · 2026-06-04' },
  'no28': { n: 'Melamina 28 mm Nogal Neo TX (B805) · Nogal', p: 1107.0, f: H4x8, veta: true, ref: 'B805 · 2026-06-04' },
  'mel16:roble': { n: 'Melamina 16 mm Roble Mérida TX (B806)', p: 685.0, f: H4x8, veta: true, ref: 'B806 · 2026-08-04' },
  'mel19:roble': { n: 'Melamina 19 mm Roble Mérida TX (B806)', p: 718.0, f: H4x8, veta: true, ref: 'B806 · 2026-08-04' },
  'mel28:roble': { n: 'Melamina 28 mm Roble Mérida TX (B806)', p: 1140.0, f: H4x8, veta: true, ref: 'B806 · 2026-08-04' },
  'mel16:negro': { n: 'Melamina 16 mm Black (B721)', p: 576.72, f: H4x8, veta: false, ref: 'B721 · 2025-09-17' },
  'mel19:negro': { n: 'Melamina 19 mm Black (B721)', p: 639.91, f: H4x8, veta: false, ref: 'B721 · 2026-07-02' },
  'mel28:negro': { n: 'Melamina 28 mm Black (B721)', p: 1026.9, f: H4x8, veta: false, ref: 'B721 · 2026-07-09' },
};
const CANTO = { c22: 11.0, c32: 16.0, c22d: 4.49 }; // $/m ABS 22×2 / 32×2 / 22×1 mm (PEABS22, PEABS32, PEABS221 última compra 2026-08-10)
const CANTO_N = { c22: 'Canto ABS 22×2 mm', c32: 'Canto ABS 32×2 mm', c22d: 'Canto ABS 22×1 mm (flexible, curvas)' };
const MERMA_CANTO = 1.10;

// Herrajes / compra (ERP salvo los marcados est:true)
const H = {
  nivelador: { n: 'Nivelador 3/8" plataforma 60 mm', p: 11.55 },
  minifix: { n: 'Minifix (caja+perno+inserto) Häfele', p: 4.22 },
  union: { n: 'Unión entre módulos (tuerca inserto + tornillo)', p: 7.21, est: true },
  iman: { n: 'Imán Ø18 mm 3600 G', p: 26.08 },
  bisagra: { n: 'Bisagra cierre suave 110°', p: 20.83 },
  corredera: { n: 'Corredera ext. total cierre lento (par)', p: 191.81 },
  correderaH: { n: 'Corredera Häfele ext. total con retén 400 mm (par)', p: 42.0 },
  ledLite: { n: 'Kit LED perimetral de línea 4000K CRI90 + dimmer (PRECIO OBJETIVO, cotizar)', p: 700.0, cv: true, est: true },
  gola: { n: 'Perfil gola aluminio tipo C (m)', p: 415.4 / 3 },
  grommet: { n: 'Grommet pasacables Ø2"', p: 6.3 },
  grommetR: { n: 'Grommet rectangular', p: 33.6 },
  multi: { n: 'Multicontacto 2 contactos (LUMATESOF)', p: 352.0, cv: true },
  espejo: { n: 'Espejo 6 mm cantos pulidos ($/m²)', p: 869.0, cv: true },
  ledTocador: { n: 'Kit LED perimetral en perfil difusor (ref. ERP MDMEKT01000008)', p: 2227.4, cv: true },
  ledPiel: { n: 'Kit LED retroiluminación 4 tiras (escalado de ERP MDMEKT01000004)', p: 2567.0, cv: true, est: true },
  vinil: { n: 'Vinil impreso con marca ($/m²) — NO está en ERP', p: 300.0, cv: true, est: true },
  placa: { n: 'Placa acero negro 1/4" ($/m²)', p: 3413.25 / 3.7161 },
  pintura: { n: 'Pintura en polvo Black TX (kg)', p: 107.98 },
  ptr: { n: 'PTR 1.5" ($/m)', p: 483 / 6 },
  espuma: { n: 'Espuma poliuretano 35 kg, 60 mm ($/m²)', p: 142.59 / (0.479 * 0.508) },
  tela: { n: 'Tela tapicería ($/m)', p: 95.0 },
  escuadra: { n: 'Escuadra metálica', p: 10.0, est: true },
  fieltro: { n: 'Deslizador de fieltro adherible', p: 3.0, est: true },
  pinturaGr: { n: 'Pintura en polvo Antracita TX (kg)', p: 231.9 },
  solera: { n: 'Solera cold rolled 1/4 x 1 in ($/m)', p: 295 / 3.66 },
  tazon: { n: 'Tazón acero inoxidable (compra externa)', p: 90.0, cv: true, est: true },
  sisal: { n: 'Tapete de sisal reemplazable 300x500 (compra externa)', p: 250.0, cv: true, est: true },
  gancho: { n: 'Gancho para correa (compra externa)', p: 30.0, cv: true, est: true },
  espejoArco: { n: 'Corte en arco del espejo (cristalería, sin cotizar)', p: 200.0, cv: true, est: true },
  taquete: { n: 'Taquetes y pijas para muro', p: 20.0, est: true },
  rascador: { n: 'Repuesto rascador de cartón (compra externa)', p: 120.0, cv: true, est: true },
  filtro: { n: 'Filtro de carbón para ventila (compra externa)', p: 80.0, cv: true, est: true },
  antivuelco: { n: 'Kit antivuelco a muro (compra externa)', p: 80.0, cv: true, est: true },
  misc: { n: 'Tornillería, pegamento, misceláneos', p: 1.0, est: true },
};

// pieza: [nombre, cant, largo, ancho, material, metrosCantoPorPieza, tipoCanto]
// material con ":ACB" se resuelve al acabado elegido.
const P = (nombre, q, L, W, mat, cantoM = 0, tc = 'c22') => ({ nombre, q, L, W, mat, cantoM, tc });
const X = (k, q, extra = {}) => ({ k, q, ...extra });

const PRODUCTOS = [
  {
    id: 'NEST', linea: 'living', nombre: 'NEST · mesa de centro', medidas: '1100 × 590 × 400 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1100, 590, 'no28', 3.38, 'c32'),
      P('Pata cascada Nogal 28 (veta vertical)', 1, 372, 590, 'no28', 1.33, 'c32'),
      P('Costado de la caja', 1, 369, 470, 'gr16', 1.68, 'c22d'),
      P('Piso corrido', 1, 996, 470, 'gr16', 1.99, 'c22d'),
      P('Divisor', 1, 353, 470, 'gr16', 0.71, 'c22d'),
      P('Frente de cueva con entrada (arco o portilla)', 1, 528, 353, 'gr16', 1.19, 'c22d'),
      P('Fondo de cueva con salida Ø180', 1, 528, 353, 'gr16', 0.53, 'c22d'),
    ],
    herrajes: [X('minifix', 10), X('escuadra', 2), X('fieltro', 6), X('misc', 30)],
  },
  {
    id: 'HAVEN-C', linea: 'living', nombre: 'HAVEN Canino · mueble TV', medidas: '1800 × 450 × 560 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1800, 450, 'no28', 4.5, 'c32'),
      P('Lateral', 2, 422, 420, 'gr16', 0.84),
      P('Piso', 1, 1708, 420, 'gr16', 1.71),
      P('Divisor', 2, 406, 420, 'gr16', 0.41),
      P('Trasero con pasacables', 1, 1708, 406, 'gr16', 0),
      P('Entrepaño bahía abierta', 1, 556, 400, 'gr16', 0.56),
      P('Puerta centro (gola)', 1, 556, 404, 'gr16', 1.92),
      P('Frente de nicho con arco 380 × 330', 1, 556, 406, 'gr16', 1.6, 'c22d'),
    ],
    herrajes: [X('ptr', 0.66), X('placa', 6 * 0.06 * 0.06), X('pinturaGr', 0.3), X('nivelador', 6), X('bisagra', 2), X('grommetR', 1), X('grommet', 2), X('antivuelco', 1), X('minifix', 20), X('misc', 60)],
  },
  {
    id: 'HAVEN-C16', linea: 'living', nombre: 'HAVEN Canino 160 · mueble TV', medidas: '1600 × 450 × 540 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1600, 450, 'no28', 4.1, 'c32'),
      P('Lateral', 2, 432, 420, 'gr16', 0.85),
      P('Piso', 1, 1508, 420, 'gr16', 1.51),
      P('Divisor', 2, 416, 420, 'gr16', 0.42),
      P('Trasero con pasacables', 1, 1508, 416, 'gr16', 0),
      P('Entrepaño bahía abierta', 1, 490, 400, 'gr16', 0.49),
      P('Puerta centro (gola)', 1, 490, 414, 'gr16', 1.81),
      P('Frente de nido con arco 360 × 330', 1, 490, 416, 'gr16', 1.55, 'c22d'),
      P('Zoclo metido 50 mm (largo)', 2, 1440, 80, 'gr16', 1.44),
      P('Zoclo metido 50 mm (corto)', 2, 304, 80, 'gr16', 0),
    ],
    herrajes: [X('nivelador', 4), X('bisagra', 2), X('grommetR', 1), X('grommet', 2), X('antivuelco', 1), X('minifix', 20), X('misc', 60)],
  },
  {
    id: 'HAVEN-F', linea: 'living', nombre: 'HAVEN Felino · mueble TV con arenero', medidas: '1800 × 450 × 560 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1800, 450, 'no28', 4.5, 'c32'),
      P('Lateral (uno con portilla Ø200)', 2, 422, 420, 'gr16', 1.47),
      P('Piso', 1, 1708, 420, 'gr16', 1.71),
      P('Divisor', 2, 406, 420, 'gr16', 0.41),
      P('Trasero con pasacables y ventila', 1, 1708, 406, 'gr16', 0),
      P('Entrepaño bahía abierta', 1, 556, 400, 'gr16', 0.56),
      P('Puerta centro (gola)', 1, 556, 404, 'gr16', 1.92),
      P('Puerta arenero ranurada', 1, 556, 404, 'gr16', 1.92),
      P('Charola arenero HPL: piso', 1, 540, 390, 'mdf16hpl', 0),
      P('Charola arenero HPL: paredes largas', 2, 540, 150, 'mdf16hpl', 0),
      P('Charola arenero HPL: paredes cortas', 2, 358, 150, 'mdf16hpl', 0),
    ],
    herrajes: [X('ptr', 0.66), X('placa', 6 * 0.06 * 0.06), X('pinturaGr', 0.3), X('nivelador', 6), X('bisagra', 4), X('grommetR', 1), X('grommet', 2), X('filtro', 1), X('antivuelco', 1), X('minifix', 20), X('misc', 60)],
  },
  {
    id: 'DEN', linea: 'living', nombre: 'DEN · credenza con nido y comedero', medidas: '1200 × 450 × 650 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1200, 450, 'no28', 3.3, 'c32'),
      P('Lateral', 2, 612, 450, 'gr16', 1.06),
      P('Piso', 1, 1168, 450, 'gr16', 1.17),
      P('Divisor', 2, 596, 450, 'gr16', 0.6),
      P('Trasero', 1, 1168, 596, 'gr16', 0),
      P('Entrepaño bahía abierta', 1, 328, 430, 'gr16', 0.33),
      P('Frente cajón comedero', 1, 330, 150, 'gr16', 0.96),
      P('Costado caja comedero', 2, 400, 100, 'gr16', 0.4, 'c22d'),
      P('Frente/fondo caja comedero', 2, 266, 100, 'gr16', 0.27, 'c22d'),
      P('Charola HPL con 2 huecos para tazón', 1, 400, 290, 'mdf16hpl', 0),
      P('Frente cajón', 3, 380, 192, 'gr16', 1.14),
      P('Costado caja cajón', 6, 400, 140, 'gr16', 0.4, 'c22d'),
      P('Frente/fondo caja cajón', 6, 316, 140, 'gr16', 0.32, 'c22d'),
      P('Fondo cajón', 3, 400, 350, 'mdf55', 0),
      P('Frente de nido con arco 300 × 420', 1, 426, 596, 'gr16', 1.44, 'c22d'),
    ],
    herrajes: [X('correderaH', 4), X('gola', 1.2), X('tazon', 2), X('gancho', 1), X('nivelador', 4), X('minifix', 24), X('misc', 60)],
  },
  {
    id: 'ATELIER', linea: 'living', nombre: 'ATELIER · escritorio', medidas: '1200 × 590 × 750 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1200, 590, 'no28', 3.58, 'c32'),
      P('Pata cascada Grafito 28', 2, 722, 590, 'gr28', 2.03, 'c32'),
      P('Faldón trasero / canal de cables', 1, 1144, 300, 'gr16', 1.14),
      P('Charola de cables', 1, 1100, 120, 'gr16', 1.1, 'c22d'),
      P('Repisa de monitor Nogal 28', 1, 1000, 220, 'no28', 2.44, 'c32'),
      P('Soporte de repisa', 2, 220, 100, 'gr16', 0.64, 'c22d'),
    ],
    herrajes: [X('grommet', 2), X('escuadra', 4), X('nivelador', 4), X('minifix', 12), X('misc', 50)],
  },
  {
    id: 'MUSE', linea: 'living', nombre: 'MUSE · tocador con espejo arco', medidas: '1100 × 450 × 750 mm · espejo 700 × 900',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1100, 450, 'no28', 3.1, 'c32'),
      P('Pata cascada Grafito 28', 2, 722, 450, 'gr28', 1.89, 'c32'),
      P('Fondo de caja de cajones', 1, 1044, 420, 'gr16', 1.04),
      P('Trasero de caja de cajones', 1, 1044, 150, 'gr16', 0),
      P('Divisor de cajones', 1, 420, 134, 'gr16', 0.13),
      P('Frente cajón', 2, 520, 140, 'gr16', 1.32),
      P('Costado caja cajón', 4, 380, 100, 'gr16', 0.38, 'c22d'),
      P('Frente/fondo caja cajón', 4, 440, 100, 'gr16', 0.44, 'c22d'),
      P('Fondo cajón', 2, 470, 380, 'mdf55', 0),
      P('Respaldo del espejo en arco (rect. envolvente)', 1, 960, 760, 'gr16', 2.35, 'c22d'),
    ],
    herrajes: [X('espejo', 0.577), X('espejoArco', 1), X('ledLite', 1), X('correderaH', 2), X('gola', 1.1), X('escuadra', 2), X('antivuelco', 1), X('nivelador', 4), X('minifix', 14), X('misc', 60)],
  },
  {
    id: 'PERCH', linea: 'living', nombre: 'PERCH · repisas para gato (juego de 3)', medidas: '3 × 450 × 250 mm',
    acabados: ['gn'],
    piezas: [
      P('Repisa Nogal 28', 3, 450, 250, 'no28', 0.95, 'c32'),
    ],
    herrajes: [X('solera', 2.4), X('pinturaGr', 0.3), X('taquete', 3), X('misc', 30)],
  },
  {
    id: 'COJIN', linea: 'living', nombre: 'Cojín lavable para nido (accesorio)', medidas: '500 × 450 × 50 mm',
    acabados: ['tela'],
    piezas: [],
    herrajes: [X('espuma', 0.225), X('tela', 0.8), X('misc', 20)],
  },
];

const FACTOR_FAB = 1.8;   // MO 20% + GI 3×MO (Alba, general/madera/metal)
const FACTOR_CV = 1.06;   // compra-venta: MO 1% + GI 5%
const r2 = (x) => Math.round(x * 100) / 100;

function costear(prod, acb) {
  const piezas = prod.piezas.map((p) => ({ ...p, mat: p.mat.replace('ACB', acb) }));
  const porMat = {};
  for (const p of piezas) (porMat[p.mat] ||= []).push(p);
  const tableros = [];
  let matFab = 0, matCv = 0, cantoTot = 0;
  for (const [mat, ps] of Object.entries(porMat)) {
    const t = TAB[mat];
    if (!t) throw new Error('material ' + mat);
    const comps = ps.map((p) => ({ nombre: p.nombre, largoMM: p.L, anchoMM: p.W, piezas: p.q }));
    const res = optimizarCorte2D({ componentes: comps, formato: t.f, veta: t.veta, kerfMM: 6, recorteOrillaMM: 10, lote: LOTE });
    if (!res.completo) throw new Error(prod.id + ' ' + mat + ' ' + JSON.stringify(res.issues));
    const hojasU = res.hojas / LOTE;
    const costo = hojasU * t.p;
    tableros.push({ mat, nombre: t.n, ref: t.ref, hojasLote: res.hojas, hojasUnidad: r2(hojasU), eficiencia: Math.round(res.eficiencia_pct), costo: r2(costo) });
    matFab += costo;
  }
  const cantos = {};
  for (const p of piezas) cantos[p.tc] = (cantos[p.tc] || 0) + p.cantoM * p.q;
  const cantoLin = Object.entries(cantos).filter(([, m]) => m > 0).map(([tc, m]) => {
    const c = m * MERMA_CANTO * CANTO[tc];
    cantoTot += c;
    return { tipo: CANTO_N[tc], metros: r2(m * MERMA_CANTO), costo: r2(c) };
  });
  matFab += cantoTot;
  const herr = prod.herrajes.map((h) => {
    const d = H[h.k];
    const c = d.p * h.q;
    if (d.cv) matCv += c; else matFab += c;
    return { nombre: d.n, cant: h.q, costo: r2(c), est: !!d.est, cv: !!d.cv };
  });
  const material = matFab + matCv;
  const fab = matFab * FACTOR_FAB + matCv * FACTOR_CV;
  return {
    acabado: acb,
    tableros, cantos: cantoLin, herrajes: herr,
    material: r2(material), materialFab: r2(matFab), materialCv: r2(matCv),
    fab: r2(fab),
    maquila25: r2(fab / 0.75), maquila35: r2(fab / 0.65), maquila50: r2(fab / 0.5),
    estimados: herr.filter((h) => h.est).reduce((s, h) => s + h.costo, 0),
  };
}

const out = PRODUCTOS.map((p) => ({
  id: p.id, linea: p.linea, nombre: p.nombre, medidas: p.medidas,
  piezas: p.piezas.map((x) => ({ nombre: x.nombre, q: x.q, L: x.L, W: x.W, mat: x.mat })),
  costos: p.acabados.map((a) => costear(p, a)),
}));
writeFileSync(new URL('./bom2.json', import.meta.url), JSON.stringify(out, null, 1));
for (const p of out) for (const c of p.costos)
  console.log(p.id.padEnd(8), c.acabado.padEnd(6), 'mat', String(c.material).padStart(9), 'fab', String(c.fab).padStart(9), 'maq25', String(c.maquila25).padStart(9), 'maq35', String(c.maquila35).padStart(9), 'maq50', String(c.maquila50).padStart(9), 'est', r2(c.estimados), c.tableros.map((t) => `${t.mat}:${t.hojasUnidad}h/${t.eficiencia}%`).join(' '));
