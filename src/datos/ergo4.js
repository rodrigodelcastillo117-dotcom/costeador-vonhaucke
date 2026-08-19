// ============================================================================
//  GENERADOR ERGONOVA 4 · guía GE_Ergonova 4 (ESP-DCC-IDP-003, v3 2025-09-09).
//  Sistema de MAMPARAS metálicas (Sistema 4x4): puestos montados sobre mamparas
//  autosustentables. Cada puesto = CUBIERTA sobre ESTRUCTURA DE MAMPARA metálica
//  (marco tubular + lámina troquelada, pintura Cradel) vestida con GAJOS clipados
//  (corrido/superior/inferior, con grapas en troqueles) + PATAS + SEMIMAMPARA de
//  CRISTAL templado 9mm (biombo OBLIGATORIO, alto 234mm, sobre riel de aluminio).
//  Productos: banca sencilla, banca doble, estación 120° y recepción.
//  Claves REALES E4 por componente (cubierta E4MC.., mampara E4EMPI/EMNI/MNM/MNC,
//  gajo E4CACI/CACM/CACC, poste E4PO.., semimampara E4SCT.., repisa E4REP..).
//  FASE A: dimensiones reales de la guía; MP estimada (falta lista de MP real).
// ============================================================================
import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const KG20 = 7.16;                     // lámina cal.20: kg ≈ m² × 7.16
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => (v / 1000);
const num = (v, def) => parseInt(v) || def;

// --- Acabados de CUBIERTA (E4MC / E4CUTR): Melamina-ABS / Chapa / Termoformado.
const ACAB = {
  ABS: { insumo: 'melamina-28', suf: 'ABS', label: 'Melamina ABS' },
  CH: { insumo: 'chapa-madera', suf: 'CH', label: 'Chapa de madera' },
  TF: { insumo: 'membrana-pvc', suf: 'TF', label: 'Termoformado' },
};
// --- Acabados de GAJO (E4CAC..): Lámina / Termoformado / Chapa / Tela.
const GAJO_ACAB = {
  L: { insumo: 'frente-metal', suf: 'L', label: 'Lámina' },
  TF: { insumo: 'membrana-pvc', suf: 'TF', label: 'Termoformado' },
  CH: { insumo: 'chapa-madera', suf: 'CH', label: 'Chapa de madera' },
  T: { insumo: 'frente-tela', suf: 'T', label: 'Tela' },
};
// --- Semimampara / biombo = cristal templado 9mm (transparente / satinado / serigrafía).
const BIOMBO = {
  transparente: { insumo: 'cristal-templado', suf: '', label: 'Cristal transparente' },
  satinado: { insumo: 'cristal-satinado', suf: 'S', label: 'Cristal satinado' },
  serigrafia: { insumo: 'cristal-templado', suf: 'CS', label: 'Cristal serigrafía' },
};
// --- Repisa de recepción (E4REP): Mármol / Cristal / Melamina-ABS / Termoformado / Chapa.
const REP_ACAB = {
  MCA: { insumo: 'marmol', suf: 'MCA', label: 'Mármol' },
  CR: { insumo: 'cristal-templado', suf: 'CR', label: 'Cristal templado' },
  ABS: { insumo: 'melamina-28', suf: 'ABS', label: 'Melamina ABS' },
  TF: { insumo: 'membrana-pvc', suf: 'TF', label: 'Termoformado' },
  CH: { insumo: 'chapa-madera', suf: 'CH', label: 'Chapa de madera' },
};

// --- Sufijos de clave por MEDIDA (mm de frente) ---------------------------
const CUB_SUF = { 1800: '26', 1500: '25', 1200: '24', 1050: '235', 900: '23', 750: '27', 600: '22' }; // fondo 600
const CUB40_SUF = { 1200: '404', 900: '403', 600: '402' };                                             // fondo 400
const MAMP_SUF = { 1800: '6', 1500: '5', 1200: '4', 1050: '35', 900: '3', 750: '7', 600: '2' };        // estructura mampara
const GAJO_SUF = { 1800: '6', 1500: '5', 1200: '4', 1050: '35', 900: '3', 750: '75', 600: '2' };       // gajos (¡750→75!)
const REP_SUF = { 1800: '6', 1500: '5', 1200: '4' };

// --- Por ALTURA de mampara (mm): familia de estructura, familia de gajo corrido,
//     alto libre del gajo, remate lateral y clave de poste ------------------
const MAMP_FAM = { 1225: 'E4EMPI', 1000: 'E4EMNI', 750: 'E4MNM', 665: 'E4MNC' };
const GAJO_FAM = { 1225: 'E4CACI', 1000: 'E4CACI', 750: 'E4CACM', 665: 'E4CACC' };
const GAJO_H = { 1225: 970, 1000: 970, 750: 720, 665: 635 };
const REMATE = { 1225: 'E4RA1200', 1000: 'E4RA1000', 750: 'E4RA750', 665: 'E4RA665' };
const POSTE_H = { 1225: '1200', 1000: '1000', 750: '750', 665: '665' };

const FINISHES = [{ id: 'ABS', label: 'Melamina ABS' }, { id: 'CH', label: 'Chapa de madera' }, { id: 'TF', label: 'Termoformado' }];
const GAJOS = [{ id: 'L', label: 'Gajo lámina' }, { id: 'TF', label: 'Gajo termoformado' }, { id: 'CH', label: 'Gajo chapa' }, { id: 'T', label: 'Gajo tela' }];
const BIOMBOS = [{ id: 'transparente', label: 'Cristal transparente' }, { id: 'satinado', label: 'Cristal satinado' }, { id: 'serigrafia', label: 'Cristal serigrafía' }];
const ALTURAS = [{ id: '1225', label: '1.225 m (con zoclos)' }, { id: '1000', label: '1.00 m' }, { id: '750', label: '0.75 m' }, { id: '665', label: '0.665 m' }];
const LARGOS = [{ id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }];

const ERGO4_PRODUCTOS_BASE = [
  {
    id: 'banca_sencilla', nombre: 'Banca sencilla',
    selects: [
      { key: 'usuarios', label: 'Puestos', opciones: [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: LARGOS },
      { key: 'altura', label: 'Altura de mampara', opciones: ALTURAS },
      { key: 'gajo', label: 'Acabado de gajo', opciones: GAJOS },
      { key: 'biomboTipo', label: 'Semimampara (biombo)', opciones: BIOMBOS },
    ],
    fondos: [600, 400],
    finishes: FINISHES,
    checks: [{ key: 'gaveta', label: 'Gaveta' }, { key: 'electrico', label: 'Electrificación (Byrne)' }],
  },
  {
    id: 'banca_doble', nombre: 'Banca doble',
    selects: [
      { key: 'usuarios', label: 'Puestos', opciones: [{ id: '2', label: '2' }, { id: '4', label: '4' }, { id: '6', label: '6' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: LARGOS },
      { key: 'altura', label: 'Altura de mampara', opciones: ALTURAS },
      { key: 'gajo', label: 'Acabado de gajo', opciones: GAJOS },
      { key: 'biomboTipo', label: 'Semimampara (biombo)', opciones: BIOMBOS },
    ],
    fondos: [600, 400],
    finishes: FINISHES,
    checks: [{ key: 'gaveta', label: 'Gavetas' }, { key: 'electrico', label: 'Electrificación (Byrne)' }],
  },
  {
    id: 'estacion_120', nombre: 'Estación 120°',
    selects: [
      { key: 'largo', label: 'Largo por ala', opciones: [{ id: '1050', label: '1.05 m' }, { id: '1200', label: '1.20 m' }] },
      { key: 'altura', label: 'Altura de mampara', opciones: ALTURAS },
      { key: 'gajo', label: 'Acabado de gajo', opciones: GAJOS },
      { key: 'biomboTipo', label: 'Semimampara (biombo)', opciones: BIOMBOS },
    ],
    finishes: FINISHES,
    checks: [{ key: 'gaveta', label: 'Gaveta' }, { key: 'electrico', label: 'Electrificación (Byrne)' }],
  },
  {
    id: 'recepcion', nombre: 'Recepción',
    selects: [
      { key: 'largo', label: 'Largo', opciones: [{ id: '1800', label: '1.80 m' }, { id: '1500', label: '1.50 m' }, { id: '1200', label: '1.20 m' }] },
      { key: 'altura', label: 'Altura de mampara', opciones: ALTURAS },
      { key: 'gajo', label: 'Acabado de gajo', opciones: GAJOS },
      { key: 'repisa', label: 'Acabado de repisa', opciones: [{ id: 'MCA', label: 'Mármol' }, { id: 'CR', label: 'Cristal' }, { id: 'ABS', label: 'Melamina ABS' }, { id: 'TF', label: 'Termoformado' }, { id: 'CH', label: 'Chapa de madera' }] },
      { key: 'biomboTipo', label: 'Semimampara (biombo)', opciones: BIOMBOS },
    ],
    finishes: FINISHES,
    checks: [{ key: 'electrico', label: 'Electrificación (Byrne)' }],
  },
];
// Colores reales de melamina 28mm (catálogo de acabados) para el selector.
// El finish ABS de CUBIERTA (ACAB.ABS) y el de REPISA (REP_ACAB.ABS) usan
// ambos 'melamina-28' — sin ambigüedad de espesor. Los gajos (GAJO_ACAB) no
// tienen opción ABS: usan lámina/tela/chapa/termoformado, materiales aparte.
export const ERGO4_PRODUCTOS = ERGO4_PRODUCTOS_BASE.map((p) => ({ ...p, colores: coloresDe('melamina-28') }));

// --- Cubierta rectangular (con gromets e insertos) --------------------------
function cubierta(comp, claves, largo, fondo, acab, n) {
  const ai = ACAB[acab] || ACAB.ABS;
  let f = fondo, suf = (f === 400 ? CUB40_SUF[largo] : CUB_SUF[largo]);
  if (!suf) { f = 600; suf = CUB_SUF[largo]; }                 // 400 sólo existe en 120/90/60
  comp.push({ insumoId: ai.insumo, nombre: `Cubierta ${largo / 10}x${f / 10} (${ai.label})`, cantidad: n, largoMM: largo, anchoMM: f });
  comp.push({ insumoId: 'tapacanto', nombre: 'Canto perímetro cubierta', cantidad: n * 2 * (mm(largo) + mm(f)) });
  comp.push({ insumoId: 'pasacables', nombre: 'Gromet rectangular BE00612-C-X1', cantidad: n * (f === 400 ? 1 : 2) });
  claves.push('E4MC' + suf + ai.suf);
}

// --- Cubierta trapecio rincón (estación 120°) ------------------------------
function cubiertaTrapecio(comp, claves, largo, acab) {
  const ai = ACAB[acab] || ACAB.ABS;
  const suf = largo === 1050 ? '35' : '4';                     // E4CUTR4 (120) / E4CUTR35 (105)
  const lado = largo === 1050 ? 1050 : 1200;
  comp.push({ insumoId: ai.insumo, nombre: `Cubierta trapecio rincón ${lado / 10}x${lado / 10} (${ai.label})`, cantidad: 1, largoMM: lado, anchoMM: lado });
  comp.push({ insumoId: 'tapacanto', nombre: 'Canto trapecio rincón', cantidad: 4 * mm(lado) });
  comp.push({ insumoId: 'pasacables', nombre: 'Gromets trapecio rincón', cantidad: 2 });
  claves.push('E4CUTR' + suf + ai.suf);
}

// --- Estructura de mampara metálica (marco tubular + lámina troquelada) -----
//     vestida con GAJOS clipados (corrido, 2 caras) + zoclos si es 1225.
function mampara(comp, claves, largo, altura, gajoAcab) {
  const fam = MAMP_FAM[altura] || MAMP_FAM[1000];
  const msuf = MAMP_SUF[largo] || '4';
  const g = GAJO_ACAB[gajoAcab] || GAJO_ACAB.L;
  const gfam = GAJO_FAM[altura] || GAJO_FAM[1000];
  const gsuf = GAJO_SUF[largo] || '4';
  const gh = GAJO_H[altura] || 970;
  // Estructura metálica
  comp.push({ insumoId: 'ptr', nombre: 'Marco tubular estructura mampara', cantidad: 2 * mm(largo) + 2 * mm(altura) + 0.4 });
  comp.push({ insumoId: 'lamina-20', nombre: 'Lámina troquelada estructura mampara', cantidad: laminaKg(mm(largo) * mm(altura) * 0.35) });
  comp.push({ insumoId: 'pintura-electrostatica', nombre: 'Pintura Cradel estructura mampara', cantidad: 2, largoMM: largo, anchoMM: altura });
  if (altura === 1225) comp.push({ insumoId: 'lamina-20', nombre: 'Zoclos para mampara (lámina)', cantidad: laminaKg(mm(largo) * 0.188 * 2) });
  // Gajos clipados (2 caras)
  comp.push({ insumoId: g.insumo, nombre: `Gajo corrido ${gfam} (${g.label})`, cantidad: 2, largoMM: largo - 30, anchoMM: gh });
  comp.push({ insumoId: 'tornilleria', nombre: 'Grapas + tornillería gajos', cantidad: 1 });
  claves.push(fam + msuf);
  claves.push(gfam + gsuf + g.suf);
}

// --- Remate lateral de aluminio (curvo) por altura de mampara ---------------
function remate(comp, claves, altura, n) {
  comp.push({ insumoId: 'remate-aluminio', nombre: 'Remate lateral (aluminio)', cantidad: n * mm(altura) });
  claves.push(REMATE[altura] || REMATE[1000]);
}

// --- Semimampara de cristal templado 9mm + riel de aluminio (OBLIGATORIA) ---
function semimampara(comp, claves, largo, tipo, n) {
  const s = BIOMBO[tipo] || BIOMBO.transparente;
  comp.push({ insumoId: s.insumo, nombre: `Semimampara cristal templado 9mm (${s.label})`, cantidad: n, largoMM: largo, anchoMM: 234 });
  if (tipo === 'serigrafia') comp.push({ insumoId: 'serigrafia', nombre: 'Serigrafía blanca a puntos', cantidad: n, largoMM: largo, anchoMM: 234 });
  comp.push({ insumoId: 'perfil-aluminio', nombre: 'Riel + perfiles rígido/flexible semimampara', cantidad: n * mm(largo) });
  claves.push('E4SCT' + largo + s.suf);
  claves.push('E4TSMA' + largo);
}

// --- Poste de conexión (cruz / T / escuadra / triangular): tubular + lámina --
function poste(comp, claves, clave, altura, nombre) {
  comp.push({ insumoId: 'ptr', nombre: `${nombre} (tubular)`, cantidad: mm(altura) + 0.2 });
  comp.push({ insumoId: 'lamina-20', nombre: `${nombre} (lámina troquelada)`, cantidad: laminaKg(mm(altura) * 0.32) });
  comp.push({ insumoId: 'pintura-electrostatica', nombre: 'Pintura poste', cantidad: 1, largoMM: altura, anchoMM: 270 });
  claves.push(clave);
}

// --- Patas y soportes de mesa (piezas metálicas compradas/fabricadas) -------
function pata(comp, claves, insumoNombre, clave, n) {
  comp.push({ insumoId: 'pata-metalica', nombre: insumoNombre, cantidad: n });
  if (clave) claves.push(clave);
}

// --- Repisa de recepción + soportes de cristal ------------------------------
function repisa(comp, claves, largo, acab) {
  const r = REP_ACAB[acab] || REP_ACAB.ABS;
  const suf = REP_SUF[largo] || '6';
  comp.push({ insumoId: r.insumo, nombre: `Repisa ${largo / 10}x40 (${r.label})`, cantidad: 1, largoMM: largo, anchoMM: 400 });
  comp.push({ insumoId: 'perfil-aluminio', nombre: 'Soporte / chapetón de aluminio para repisa', cantidad: 2 });
  claves.push('E4REP' + suf + r.suf);
}

// --- Gaveta metálica --------------------------------------------------------
function gaveta(comp, n) {
  comp.push({ insumoId: 'lamina-20', nombre: 'Gaveta metálica (lámina)', cantidad: laminaKg(n * 0.9) });
  comp.push({ insumoId: 'corredera', nombre: 'Correderas gaveta', cantidad: n });
}

// --- Electrificación Byrne PHASE 2 (arnés dentro de la mampara) -------------
function electrico(comp, claves, electricos, largo, n) {
  comp.push({ insumoId: 'byrne-phase2', nombre: 'Arnés / extensión Byrne PHASE 2', cantidad: n });
  comp.push({ insumoId: 'contacto', nombre: 'Contactos PHASE 2 (BE52426)', cantidad: n });
  comp.push({ insumoId: 'caja-electrica', nombre: 'Caja eléctrica doble (BE52413)', cantidad: Math.max(1, Math.ceil(n / 2)) });
  comp.push({ insumoId: 'acometida', nombre: 'Acometida PHASE 2 power entry (BE52490)', cantidad: 1 });
  comp.push({ insumoId: 'pata-metalica', nombre: 'Soporte Byrne E4SOIB', cantidad: n });
  const ext = largo <= 900 ? '48" (1219 mm)' : largo <= 1200 ? '52" (1372 mm)' : '60" (1524 mm)';
  electricos.push(`${n} arnés Byrne PHASE 2 + contactos; extensión ${ext}; soporte E4SOIB; acometida BE52490 (aparte)`);
  claves.push('E4SOIB');
}

export function generarErgo4(config) {
  const c = {
    producto: 'banca_sencilla', usuarios: '2', largo: '1500', altura: '1000', finish: 'ABS',
    gajo: 'L', biomboTipo: 'transparente', repisa: 'MCA', fondoMM: 600, gaveta: false, electrico: false, ...config,
  };
  const largo = num(c.largo, 1500);
  const altura = num(c.altura, 1000);
  const fondo = num(c.fondoMM, 600) === 400 ? 400 : 600;
  const a = ACAB[c.finish] || ACAB.ABS;
  const comp = [];
  const claves = [];
  const electricos = [];
  let nombre = '';

  if (c.producto === 'estacion_120') {
    const nUs = 3;
    poste(comp, claves, 'E4PO12075T3', altura, 'Poste triangular 120°');
    cubiertaTrapecio(comp, claves, largo, c.finish);
    for (let i = 0; i < nUs; i++) cubierta(comp, claves, largo, 600, c.finish, 1);
    for (let i = 0; i < nUs; i++) mampara(comp, claves, largo, altura, c.gajo);
    remate(comp, claves, altura, nUs);
    semimampara(comp, claves, largo, c.biomboTipo, nUs);              // biombo OBLIGATORIO
    pata(comp, claves, 'Pata universal metálica', 'E4PU720ES', nUs);
    pata(comp, claves, 'Soporte mesa doble 120° (E4SOD120)', 'E4SOD120', nUs);
    if (c.gaveta) gaveta(comp, nUs);
    if (c.electrico) electrico(comp, claves, electricos, largo, nUs);
    nombre = `Ergonova 4 · Estación 120° 3 puestos ${mm(largo).toFixed(2)} m · ${a.label}`;
  } else if (c.producto === 'recepcion') {
    poste(comp, claves, 'E4PO' + (POSTE_H[altura] || '1000') + 'E', altura, 'Poste en escuadra');
    cubierta(comp, claves, largo, 600, c.finish, 1);
    mampara(comp, claves, largo, altura, c.gajo);
    repisa(comp, claves, largo, c.repisa);
    comp.push({ insumoId: 'perfil-aluminio', nombre: 'Tapa de aluminio (E4TSA) recepción', cantidad: mm(largo) });
    claves.push('E4TSA' + largo);
    remate(comp, claves, altura, 1);
    semimampara(comp, claves, largo, c.biomboTipo, 1);               // biombo OBLIGATORIO
    pata(comp, claves, 'Pata lateral izquierda (E4PLTI)', 'E4PLTI', 1);
    pata(comp, claves, 'Pata lateral derecha (E4PLTD)', 'E4PLTD', 1);
    pata(comp, claves, 'Pata universal metálica', 'E4PU720ES', 1);
    pata(comp, claves, 'Soporte para mesa (E4SOGED/E4SOGEI)', 'E4SOGED', 2);
    if (c.electrico) electrico(comp, claves, electricos, largo, 1);
    nombre = `Ergonova 4 · Recepción ${mm(largo).toFixed(2)} m · repisa ${(REP_ACAB[c.repisa] || REP_ACAB.MCA).label} · ${a.label}`;
  } else {
    const doble = c.producto === 'banca_doble';
    const filas = doble ? 2 : 1;
    const nUs = num(c.usuarios, doble ? 2 : 2);
    const nMamp = Math.max(1, Math.ceil(nUs / filas));
    cubierta(comp, claves, largo, fondo, c.finish, nUs);
    for (let i = 0; i < nMamp; i++) mampara(comp, claves, largo, altura, c.gajo);
    remate(comp, claves, altura, nMamp);
    semimampara(comp, claves, largo, c.biomboTipo, nMamp);           // biombo OBLIGATORIO en bancas
    // Patas: laterales izq/der en extremos + universales intermedias + soporte mesa por puesto.
    pata(comp, claves, 'Pata lateral izquierda (E4PLTI)', 'E4PLTI', filas);
    pata(comp, claves, 'Pata lateral derecha (E4PLTD)', 'E4PLTD', filas);
    if (nMamp > 1) pata(comp, claves, 'Pata universal metálica', 'E4PU720ES', nMamp - 1);
    pata(comp, claves, doble ? 'Soporte para mesa doble (E4SOD)' : 'Soporte para mesa (E4SOGED/E4SOGEI)', doble ? 'E4SOD' : 'E4SOGED', nUs);
    pata(comp, claves, 'Soporte manita (E4MA)', 'E4MA', nMamp);
    if (c.gaveta) gaveta(comp, nMamp);
    if (c.electrico) electrico(comp, claves, electricos, largo, nUs);
    nombre = `Ergonova 4 · Banca ${doble ? 'doble' : 'sencilla'} ${nUs} puestos ${mm(largo).toFixed(2)} m · ${a.label}`;
  }

  return aplicarColor({
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 38, factorIndirecta: 12,
    nota: 'Ergonova 4 (Fase A): sistema de mamparas metálicas (benching). Dimensiones y claves REALES por componente de la guía GE_Ergonova 4 (ESP-DCC-IDP-003 v3): cubierta E4MC.., estructura de mampara E4EMPI/EMNI/MNM/MNC (4 alturas 1225/1000/750/665), gajos clipados E4CACI/CACM/CACC por acabado L/TF/CH/T, semimampara de cristal templado 9mm E4SCT.. (biombo obligatorio, alto 234mm sobre riel E4TSMA), postes E4PO.., repisa de recepción E4REP.., remates E4RA. MP estimada: gajo lámina→frente-metal, gajo tela→frente-tela, gajo TF→membrana-pvc; estructura/postes→ptr+lamina-20+pintura Cradel; riel/tapa/soporte cristal→perfil-aluminio; patas y soportes de mesa→pata-metalica; gromets→pasacables; grapas→tornilleria. Falta calibrar con lista de MP real + desarrollo exacto de troqueles, gajos superior/inferior partidos y omegas de refuerzo por clave.',
  }, c);
}
