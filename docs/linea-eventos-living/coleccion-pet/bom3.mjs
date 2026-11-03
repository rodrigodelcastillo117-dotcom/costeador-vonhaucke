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
    id: 'NEXUS', linea: 'living', nombre: 'NEXUS · escritorio con credenza', medidas: '1600 × 500 × 750 mm',
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
      P('Cubierta escritorio en ángulo Nogal 28 (rect. envolvente)', 1, 1300, 600, 'no28', 3.9, 'c32'),
      P('Pata escritorio Grafito 28', 1, 722, 500, 'gr28', 1.94, 'c32'),
      P('Repisa elevada Nogal 28', 1, 1300, 280, 'no28', 3.16, 'c32'),
      P('Soporte de repisa', 2, 280, 120, 'gr16', 0.8, 'c22d'),
    ],
    herrajes: [X('correderaH', 4), X('gola', 1.2), X('tazon', 2), X('gancho', 1), X('nivelador', 4), X('minifix', 32), X('escuadra', 4), X('misc', 80)],
  },
  {
    id: 'MUSE-R', linea: 'living', nombre: 'MUSE · tocador con torre y nido', medidas: '1600 × 500 × 1400 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1600, 500, 'no28', 4.2, 'c32'),
      P('Lateral pedestal / nido', 4, 722, 480, 'gr16', 1.2),
      P('Piso pedestal / nido', 2, 418, 480, 'gr16', 0.42),
      P('Trasero bajo cubierta', 1, 1568, 300, 'gr16', 0),
      P('Frente cajón pedestal', 3, 450, 230, 'gr16', 1.36),
      P('Costado caja cajón', 8, 420, 140, 'gr16', 0.42, 'c22d'),
      P('Frente/fondo caja cajón', 8, 360, 140, 'gr16', 0.36, 'c22d'),
      P('Fondo cajón', 4, 380, 420, 'mdf55', 0),
      P('Frente cajón central', 1, 600, 120, 'gr16', 1.44),
      P('Frente de nido con arco', 1, 450, 722, 'gr16', 1.6, 'c22d'),
      P('Torre: laterales', 2, 800, 250, 'gr16', 1.05),
      P('Torre: tapa y base', 2, 418, 250, 'gr16', 0.42),
      P('Torre: repisas', 4, 418, 230, 'gr16', 0.42),
      P('Torre: trasero', 1, 800, 418, 'gr16', 0),
      P('Respaldo del espejo', 1, 850, 700, 'gr16', 3.1, 'c22d'),
    ],
    herrajes: [X('espejo', 0.52), X('ledLite', 2), X('correderaH', 4), X('gola', 2.0), X('antivuelco', 1), X('nivelador', 6), X('minifix', 30), X('espuma', 0.15), X('tela', 0.6), X('misc', 80)],
  },
  {
    id: 'NEST-R', linea: 'living', nombre: 'NEST · mesa de centro con nicho y cajón', medidas: '1200 × 700 × 400 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 1200, 700, 'no28', 3.8, 'c32'),
      P('Lateral', 2, 372, 680, 'gr16', 1.42),
      P('Piso', 1, 1168, 680, 'gr16', 2.34),
      P('Divisor', 1, 356, 680, 'gr16', 0.71),
      P('Fondo', 1, 1168, 356, 'gr16', 0),
      P('Repisa', 1, 560, 660, 'gr16', 0.56),
      P('Frente cajón', 1, 560, 170, 'gr16', 1.46),
      P('Costado caja cajón', 2, 600, 120, 'gr16', 0.6, 'c22d'),
      P('Frente/fondo caja cajón', 2, 500, 120, 'gr16', 0.5, 'c22d'),
      P('Fondo cajón', 1, 600, 520, 'mdf55', 0),
    ],
    herrajes: [X('correderaH', 1), X('espuma', 0.33), X('tela', 1.0), X('minifix', 14), X('nivelador', 4), X('misc', 40)],
  },
  {
    id: 'HAVEN-R', linea: 'living', nombre: 'HAVEN · mueble TV con nido', medidas: '2000 × 400 × 560 mm',
    acabados: ['gn'],
    piezas: [
      P('Cubierta Nogal 28', 1, 2000, 400, 'no28', 4.8, 'c32'),
      P('Lateral', 2, 472, 400, 'gr16', 0.87),
      P('Piso', 1, 1968, 400, 'gr16', 1.97),
      P('Trasero', 1, 1968, 456, 'gr16', 0),
      P('Divisor', 2, 456, 380, 'gr16', 0.46),
      P('Entrepaño bahía abierta', 2, 400, 370, 'gr16', 0.4),
      P('Entrepaño bahía puertas', 1, 1000, 370, 'gr16', 1.0),
      P('Puerta', 3, 330, 454, 'gr16', 1.57),
      P('Zoclo metido (largo)', 1, 1900, 60, 'gr16', 1.9),
      P('Zoclo metido (corto)', 2, 340, 60, 'gr16', 0),
    ],
    herrajes: [X('bisagra', 6), X('ledLite', 1), X('espuma', 0.2), X('tela', 0.7), X('grommetR', 1), X('grommet', 2), X('antivuelco', 1), X('nivelador', 6), X('minifix', 24), X('misc', 60)],
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
writeFileSync(new URL('./bom3.json', import.meta.url), JSON.stringify(out, null, 1));
for (const p of out) for (const c of p.costos)
  console.log(p.id.padEnd(8), c.acabado.padEnd(6), 'mat', String(c.material).padStart(9), 'fab', String(c.fab).padStart(9), 'maq25', String(c.maquila25).padStart(9), 'maq35', String(c.maquila35).padStart(9), 'maq50', String(c.maquila50).padStart(9), 'est', r2(c.estimados), c.tableros.map((t) => `${t.mat}:${t.hojasUnidad}h/${t.eficiencia}%`).join(' '));
