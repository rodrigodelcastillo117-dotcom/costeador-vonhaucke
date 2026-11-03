// Despiece + costo estimado de la línea nueva, con precios de ÚLTIMA COMPRA del ERP
// Von Haucke (mp_erp_ultima_compra.csv) y la fórmula de Alba (MO 20% del material,
// GI = 3×MO → fab = material × 1.8; compra-venta: MO 1% + GI 5% → × 1.06).
// Nesting con el optimizador del propio costeador (optimizarCorte2D), lote de 10.
import { optimizarCorte2D } from '../../src/motor/optimizacionCorte.js';
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
  'mel16:roble': { n: 'Melamina 16 mm Roble Mérida TX (B806)', p: 685.0, f: H4x8, veta: true, ref: 'B806 · 2026-08-04' },
  'mel19:roble': { n: 'Melamina 19 mm Roble Mérida TX (B806)', p: 718.0, f: H4x8, veta: true, ref: 'B806 · 2026-08-04' },
  'mel28:roble': { n: 'Melamina 28 mm Roble Mérida TX (B806)', p: 1140.0, f: H4x8, veta: true, ref: 'B806 · 2026-08-04' },
  'mel16:negro': { n: 'Melamina 16 mm Black (B721)', p: 576.72, f: H4x8, veta: false, ref: 'B721 · 2025-09-17' },
  'mel19:negro': { n: 'Melamina 19 mm Black (B721)', p: 639.91, f: H4x8, veta: false, ref: 'B721 · 2026-07-02' },
  'mel28:negro': { n: 'Melamina 28 mm Black (B721)', p: 1026.9, f: H4x8, veta: false, ref: 'B721 · 2026-07-09' },
};
const CANTO = { c22: 11.0, c32: 16.0 }; // $/m ABS 2 mm (PEABS22 / PEABS32, ago-2026)
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
    id: 'BAR-118', linea: 'eventos', nombre: 'Barra Modular 118', medidas: '1180 × 590 × 1100 mm',
    acabados: ['negro'], // cuerpo siempre negro; el look lo da la piel
    piezas: [
      P('Lateral', 2, 1060, 490, 'mdf18m', 2.61),
      P('Frente estructural (porta-piel)', 1, 1144, 1060, 'mdf18m', 1.14),
      P('Entrepaño de trabajo h=850', 1, 1144, 450, 'mdf18m', 1.14),
      P('Travesaño trasero superior', 1, 1144, 100, 'mdf18m', 1.14),
      P('Listón colgador francés (cuerpo)', 1, 1144, 80, 'mdf18m', 0),
      P('Piso (agua de hielo)', 1, 1144, 472, 'trip18h', 1.14),
      P('Zoclo trasero', 1, 1144, 80, 'trip18h', 1.14),
      P('Cubierta HPL', 1, 1180, 590, 'mdf25hpl', 3.54, 'c32'),
    ],
    herrajes: [X('nivelador', 4), X('minifix', 16), X('union', 10), X('misc', 60)],
  },
  {
    id: 'PED-59', linea: 'eventos', nombre: 'Pedestal / Esquinero 59', medidas: '590 × 590 × 1100 mm',
    acabados: ['negro'],
    piezas: [
      P('Lateral', 2, 1060, 490, 'mdf18m', 2.61),
      P('Frente', 1, 1060, 454, 'mdf18m', 0.45),
      P('Tapa trasera removible (imanes)', 1, 1060, 454, 'mdf18m', 3.03),
      P('Entrepaño', 1, 454, 454, 'mdf18m', 0.45),
      P('Piso', 1, 454, 454, 'trip18h', 0),
      P('Cubierta HPL', 1, 590, 590, 'mdf25hpl', 2.36, 'c32'),
    ],
    herrajes: [X('nivelador', 4), X('minifix', 10), X('union', 8), X('iman', 4), X('misc', 40)],
  },
  {
    id: 'PIEL-R', linea: 'eventos', nombre: 'Piel Roble', medidas: '1180 × 1040 mm',
    acabados: ['roble'],
    piezas: [
      P('Piel', 1, 1180, 1040, 'mel16:ACB', 4.44),
      P('Listón colgador francés (piel)', 1, 1144, 80, 'mdf18m', 0),
    ],
    herrajes: [X('misc', 20)],
  },
  {
    id: 'PIEL-L', linea: 'eventos', nombre: 'Piel Luminosa', medidas: '1180 × 1040 × 80 mm',
    acabados: ['negro'],
    piezas: [
      P('Marco caja de luz largo', 2, 1180, 80, 'mdf18m', 0.16),
      P('Marco caja de luz corto', 2, 1004, 80, 'mdf18m', 0.16),
      P('Fondo reflejante blanco', 1, 1180, 1040, 'mdf55m', 0),
      P('Difusor acrílico opalino', 1, 1180, 1040, 'acr', 0),
      P('Listón colgador francés (piel)', 1, 1144, 80, 'mdf18m', 0),
    ],
    herrajes: [X('ledPiel', 1), X('misc', 40)],
  },
  {
    id: 'PIEL-M', linea: 'eventos', nombre: 'Piel Marca (vinil impreso)', medidas: '1180 × 1040 mm',
    acabados: ['negro'],
    piezas: [
      P('Base MDF para vinil', 1, 1180, 1040, 'mdf55', 0),
      P('Listón colgador francés (piel)', 1, 1144, 80, 'mdf18m', 0),
    ],
    herrajes: [X('vinil', 1.23), X('misc', 15)],
  },
  {
    id: 'PER-X', linea: 'eventos', nombre: 'Periquera Equis', medidas: 'Ø590 × 1100 mm',
    acabados: ['negro'],
    piezas: [
      P('Panel X trapecio 590→250 (rect. envolvente)', 2, 1075, 590, 'mdf18m', 3.02),
      P('Cubierta redonda HPL (rect. envolvente)', 1, 590, 590, 'mdf25hpl', 1.85, 'c32'),
    ],
    herrajes: [X('placa', 0.1156), X('pintura', 0.25), X('escuadra', 4), X('union', 8), X('nivelador', 4), X('misc', 30)],
  },
  {
    id: 'MESA-X', linea: 'eventos', nombre: 'Mesa Imperial Equis (10 personas)', medidas: '2400 × 1000 × 760 mm',
    acabados: ['roble', 'negro'],
    piezas: [
      P('Cubierta', 1, 2400, 1000, 'mel28:ACB', 6.8, 'c32'),
      P('Caballete X panel ancho', 2, 732, 800, 'mdf18m', 2.87),
      P('Caballete X panel corto', 2, 732, 500, 'mdf18m', 2.37),
      P('Viga central (doble)', 2, 1600, 120, 'mdf18m', 1.6),
    ],
    herrajes: [X('escuadra', 8), X('union', 8), X('nivelador', 8), X('misc', 60)],
  },
  {
    id: 'MESA-DJ', linea: 'eventos', nombre: 'Mesa DJ (va detrás de la fachada)', medidas: '2400 × 700 × 950 mm',
    acabados: ['negro'],
    piezas: [
      P('Cubierta MDF melamina negra 25 mm', 1, 2400, 700, 'mdf25m', 6.2, 'c32'),
      P('Caballete X panel ancho', 2, 925, 600, 'mdf18m', 3.05),
      P('Caballete X panel corto', 2, 925, 400, 'mdf18m', 2.65),
      P('Viga central (doble)', 2, 1600, 120, 'mdf18m', 1.6),
      P('Repisa trasera p/ multicontacto y laptop', 1, 2000, 200, 'mdf18m', 2.0),
    ],
    herrajes: [X('grommet', 2), X('grommetR', 1), X('multi', 1), X('escuadra', 8), X('union', 8), X('nivelador', 8), X('misc', 60)],
  },
  {
    id: 'TOC-01', linea: 'casa', nombre: 'Tocador Hollywood', medidas: '1100 × 450 × 760 mm · con espejo 1660',
    acabados: ['roble', 'negro'],
    piezas: [
      P('Cubierta', 1, 1100, 450, 'mel28:ACB', 3.1, 'c32'),
      P('Lateral', 2, 732, 450, 'mel16:ACB', 1.18),
      P('Divisor pedestal', 1, 732, 434, 'mel16:ACB', 0.73),
      P('Piso pedestal', 1, 434, 368, 'mel16:ACB', 0.37),
      P('Trasero pedestal', 1, 700, 368, 'mel16:ACB', 0),
      P('Travesaño trasero (hueco de rodillas)', 1, 668, 150, 'mel16:ACB', 0.67),
      P('Frente cajón pedestal', 3, 400, 230, 'mel16:ACB', 1.26),
      P('Frente cajón central (makeup)', 1, 700, 100, 'mel16:ACB', 1.6),
      P('Costado caja cajón', 6, 400, 180, 'mel16:ACB', 0.4),
      P('Frente/fondo caja cajón', 6, 300, 180, 'mel16:ACB', 0.3),
      P('Costado caja cajón central', 2, 400, 70, 'mel16:ACB', 0.4),
      P('Frente/fondo caja cajón central', 2, 600, 70, 'mel16:ACB', 0.6),
      P('Fondo cajones', 3, 400, 330, 'mdf55', 0),
      P('Fondo cajón central', 1, 630, 400, 'mdf55', 0),
      P('Respaldo de espejo', 1, 900, 900, 'mel16:ACB', 3.6),
    ],
    herrajes: [X('espejo', 0.64), X('ledTocador', 1), X('multi', 1), X('corredera', 4), X('gola', 2), X('escuadra', 2), X('antivuelco', 1), X('minifix', 12), X('nivelador', 4), X('misc', 50)],
  },
  {
    id: 'TOC-01L', linea: 'casa', nombre: 'Tocador Hollywood Lite', medidas: '1100 × 450 × 760 mm · con espejo 1660',
    acabados: ['roble', 'negro'],
    piezas: [
      P('Cubierta', 1, 1100, 450, 'mel28:ACB', 3.1, 'c32'),
      P('Lateral', 2, 732, 450, 'mel16:ACB', 1.18),
      P('Divisor pedestal', 1, 732, 434, 'mel16:ACB', 0.73),
      P('Piso pedestal', 1, 434, 368, 'mel16:ACB', 0.37),
      P('Trasero pedestal', 1, 700, 368, 'mel16:ACB', 0),
      P('Travesaño trasero (hueco de rodillas)', 1, 668, 150, 'mel16:ACB', 0.67),
      P('Frente cajón pedestal', 3, 400, 230, 'mel16:ACB', 1.26),
      P('Frente cajón central (makeup)', 1, 700, 100, 'mel16:ACB', 1.6),
      P('Costado caja cajón', 6, 400, 180, 'mel16:ACB', 0.4),
      P('Frente/fondo caja cajón', 6, 300, 180, 'mel16:ACB', 0.3),
      P('Costado caja cajón central', 2, 400, 70, 'mel16:ACB', 0.4),
      P('Frente/fondo caja cajón central', 2, 600, 70, 'mel16:ACB', 0.6),
      P('Fondo cajones', 3, 400, 330, 'mdf55', 0),
      P('Fondo cajón central', 1, 630, 400, 'mdf55', 0),
      P('Respaldo de espejo', 1, 900, 900, 'mel16:ACB', 3.6),
    ],
    herrajes: [X('espejo', 0.64), X('ledLite', 1), X('correderaH', 4), X('gola', 2), X('escuadra', 2), X('antivuelco', 1), X('minifix', 12), X('nivelador', 4), X('misc', 50)],
  },
  {
    id: 'ESC-01', linea: 'casa', nombre: 'Escritorio Compañero', medidas: '1500 × 590 × 750 mm',
    acabados: ['roble', 'negro'],
    piezas: [
      P('Cubierta', 1, 1500, 590, 'mel28:ACB', 4.18, 'c32'),
      P('Pata panel derecha', 1, 722, 590, 'mel28:ACB', 2.03, 'c32'),
      P('Lateral pedestal', 2, 722, 560, 'mel19:ACB', 1.28),
      P('Piso pedestal / nicho', 1, 560, 412, 'mel19:ACB', 0.41),
      P('Entrepaño (separa cajón y nicho)', 1, 540, 412, 'mel19:ACB', 0.41),
      P('Trasero pedestal', 1, 722, 412, 'mel19:ACB', 0),
      P('Frente cajón', 1, 450, 250, 'mel19:ACB', 1.4),
      P('Costado caja cajón', 2, 500, 180, 'mel16:ACB', 0.5),
      P('Frente/fondo caja cajón', 2, 340, 180, 'mel16:ACB', 0.34),
      P('Fondo cajón', 1, 500, 380, 'mdf55', 0),
      P('Faldón trasero / pared del canal', 1, 1012, 300, 'mel19:ACB', 1.01),
      P('Charola canal de cables', 1, 1000, 150, 'mel16:ACB', 1.0),
      P('Tapa abatible del canal', 1, 1000, 120, 'mel16:ACB', 2.24),
      P('Repisa gato: base', 1, 400, 300, 'mel19:ACB', 1.4),
      P('Repisa gato: respaldo', 1, 400, 120, 'mel19:ACB', 0.4),
      P('Repisa gato: costados', 2, 300, 120, 'mel19:ACB', 0.42),
    ],
    herrajes: [X('corredera', 1), X('bisagra', 2), X('grommet', 2), X('espuma', 0.232 + 0.106), X('tela', 1.5), X('minifix', 14), X('nivelador', 4), X('misc', 60)],
  },
  {
    id: 'MC-01', linea: 'casa', nombre: 'Mesa de Centro Guarida', medidas: '1100 × 590 × 420 mm',
    acabados: ['roble', 'negro'],
    piezas: [
      P('Cubierta (esquinas R50)', 1, 1100, 590, 'mel28:ACB', 3.38, 'c32'),
      P('Costado con arco de entrada', 2, 392, 590, 'mel28:ACB', 2.0, 'c32'),
      P('Piso', 1, 1044, 550, 'mel19:ACB', 2.09),
      P('Divisor cueva / repisa', 1, 550, 345, 'mel19:ACB', 0.35),
      P('Frente cueva con ventana ovalada', 1, 500, 345, 'mel19:ACB', 2.2),
      P('Fondo cueva', 1, 500, 345, 'mel19:ACB', 0),
      P('Rieles bolsillo rascador', 2, 380, 60, 'mel19:ACB', 0.76),
    ],
    herrajes: [X('espuma', 0.26), X('tela', 0.8), X('rascador', 1), X('minifix', 12), X('nivelador', 4), X('misc', 40)],
  },
  {
    id: 'TV-01', linea: 'casa', nombre: 'Mueble TV Arenero', medidas: '1800 × 480 × 610 mm',
    acabados: ['roble', 'negro'],
    piezas: [
      P('Cubierta', 1, 1800, 480, 'mel28:ACB', 4.56, 'c32'),
      P('Lateral (uno con arco Ø220 para el gato)', 2, 472, 480, 'mel19:ACB', 1.7),
      P('Piso', 1, 1762, 460, 'mel19:ACB', 1.76),
      P('Divisor', 2, 434, 460, 'mel19:ACB', 0.43),
      P('Entrepaño centro', 1, 562, 440, 'mel19:ACB', 0.56),
      P('Puerta (arenero ranurada / guardado)', 2, 600, 472, 'mel19:ACB', 2.14),
      P('Trasero cerrado (cables y ventila)', 1, 1762, 472, 'mel16:ACB', 0),
      P('Charola arenero HPL: piso', 1, 562, 440, 'mdf16hpl', 0),
      P('Charola arenero HPL: paredes largas', 2, 562, 150, 'mdf16hpl', 0),
      P('Charola arenero HPL: paredes cortas', 2, 408, 150, 'mdf16hpl', 0),
    ],
    herrajes: [X('bisagra', 4), X('grommetR', 1), X('grommet', 2), X('ptr', 0.66), X('placa', 6 * 0.06 * 0.06), X('pintura', 0.3), X('nivelador', 6), X('filtro', 1), X('antivuelco', 1), X('minifix', 20), X('misc', 60)],
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
    return { tipo: tc === 'c22' ? 'Canto ABS 22×2 mm' : 'Canto ABS 32×2 mm', metros: r2(m * MERMA_CANTO), costo: r2(c) };
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
writeFileSync(new URL('./bom.json', import.meta.url), JSON.stringify(out, null, 1));
for (const p of out) for (const c of p.costos)
  console.log(p.id.padEnd(8), c.acabado.padEnd(6), 'mat', String(c.material).padStart(9), 'fab', String(c.fab).padStart(9), 'maq25', String(c.maquila25).padStart(9), 'maq35', String(c.maquila35).padStart(9), 'maq50', String(c.maquila50).padStart(9), 'est', r2(c.estimados), c.tableros.map((t) => `${t.mat}:${t.hojasUnidad}h/${t.eficiencia}%`).join(' '));
