// ============================================================================
//  GENERADOR VÍA · guía GE_Vía (ESP-DCC-IDP-003, v3 2025-09-09). Línea de BAJO
//  COSTO en madera y metal: módulos de trabajo que se arman sobre archiveros /
//  libreros-base con acometida, una pata marco (modelo App / Cirque) y cubierta
//  rectangular (modelo Cirque CICE). Biombos en Acrílico / Panel Acústico PET /
//  Lámina Perforada. Cajas eléctricas cableadas (VISOCAELC) o sin cablear
//  (VIMOSOCUSAC), arnés Byrne Phase 2.
//
//  ALCANCE REAL (guía §Alcance/§Componentes): la línea SOLO arma dos puestos —
//  Escritorio Sencillo y Banca Doble — más los muebles/piezas sueltos:
//  Archivero (sencillo/doble), Librero (sencillo sin/con acometida y doble),
//  Biombos (divisor / frontal banca sencilla / frontal banca doble), Caja
//  eléctrica. NO existen estaciones H / cruz / 4 / 6 puestos: son sólo
//  combinaciones de esos dos puestos (guía pg. 65-68), no productos aparte.
//  FASE A: estructura + dimensiones reales de la guía; MP estimada (calibrar).
// ============================================================================

import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const CANTO = 'tapacanto';
const LAMINA = 'lamina-20';          // lámina cal.20 (kg ≈ área_m² × 7.16)
const CARCASA = 'melamina-16';       // cuerpo oculto de cajas (guardas)
const ACRIL = 'acrilico', PET = 'pet-acustico';
const PINTURA = 'pintura-electrostatica';
const CAJA_BYRNE = 'caja-electrica'; // caja Byrne BE52413 (arnés Phase 2)
const CONTACTO = 'contacto', ARNES = 'arnes', CHICOTE = 'chicote';

// Acabado de cara visible (cubierta, frentes, puertas) → insumo tablero + sufijo
const ACAB = {
  ABS: { insumo: 'melamina-28', suf: 'ABS', label: 'Melamina ABS' },
  chapa: { insumo: 'chapa-madera', suf: 'CH', label: 'Chapa de madera' },
  termoformado: { insumo: 'membrana-pvc', suf: 'TF', label: 'Termoformado' },
};
const FINISHES = [
  { id: 'ABS', label: 'Melamina ABS' },
  { id: 'chapa', label: 'Chapa de madera' },
  { id: 'termoformado', label: 'Termoformado' },
];

// Material de biombo → insumo + sufijo de clave (guía §Biombos)
const BIOMBO_MAT = {
  pet: { insumo: PET, suf: 'PT', label: 'Panel Acústico PET', area: true },
  acrilico: { insumo: ACRIL, suf: 'AC', label: 'Acrílico', area: true },
  lamina: { insumo: LAMINA, suf: 'LP', label: 'Lámina Perforada', area: false },
};

// Medidas fijas de línea (guía, en mm)
const FONDO_ARCH = 450, ALTO_ARCH = 610;   // guarda: fondo 0.45, alto 0.61
const FONDO_CUB = 600;                       // cubierta Cirque CICE fondo 0.60
const ALTO_DIV = 430;                        // biombo divisor  alto 0.43
const ALTO_FRO_BS = 450;                     // frontal banca sencilla alto 0.45
const ALTO_FRO_BD = 240;                     // frontal banca doble    alto 0.24

const num = (v, def) => parseInt(v, 10) || def;
const mm = (v) => v / 1000;
const perim = (L, F) => 2 * (mm(L) + mm(F));         // canto perímetro en m
const kgLamina = (L, F) => mm(L) * mm(F) * 7.16;      // área_m² × 7.16

// Índices de ancho por familia (dígito de clave)
const IDX_ARCH = { 1200: '4', 1500: '5' };
const IDX_LIB_SIN = { 300: '2', 600: '3', 1200: '4' };
const IDX_LIB_CON = { 600: '2', 900: '3', 1200: '4', 1500: '5' };
const IDX_LIB_DBL = { 1200: '4', 1500: '5' };
const IDX_FRONTAL = { 880: '3', 1180: '4', 1480: '5' };
// Cubierta Cirque CICE: dígito ancho + dígito fondo (600 = "2")
const IDX_CUB = { 1200: '4', 1500: '5' };

const VIA_PRODUCTOS_BASE = [
  {
    id: 'escritorio', nombre: 'Escritorio sencillo',
    selects: [
      { key: 'largo', label: 'Ancho', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'lado', label: 'Perforación archivero', opciones: [{ id: 'C', label: 'Sin perforación' }, { id: 'I', label: 'Izquierda' }, { id: 'D', label: 'Derecha' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'biombo', label: 'Biombo divisor' },
      { key: 'electrico', label: 'Caja eléctrica' },
      { key: 'cableada', label: 'Caja cableada (VISOCAELC)' },
      { key: 'arnes', label: 'Arnés eléctrico Byrne Phase 2' },
    ],
  },
  {
    id: 'banca_doble', nombre: 'Banca doble',
    selects: [
      { key: 'largo', label: 'Ancho por puesto', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'biombo', label: 'Biombo frontal + lateral' },
      { key: 'electrico', label: 'Cajas eléctricas' },
      { key: 'cableada', label: 'Cajas cableadas (VISOCAELC)' },
      { key: 'arnes', label: 'Arnés eléctrico Byrne Phase 2' },
    ],
  },
  {
    id: 'archivero', nombre: 'Archivero (guarda con acometida)',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'sencillo', label: 'Sencillo' }, { id: 'doble', label: 'Doble' }] },
      { key: 'largo', label: 'Ancho', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'lado', label: 'Cuerpo / Perforación', opciones: [{ id: 'C', label: 'Sin perf. / Centro' }, { id: 'I', label: 'Izquierdo' }, { id: 'D', label: 'Derecho' }] },
      { key: 'perf', label: 'Perforación (doble)', opciones: [{ id: 'SP', label: 'Sin perforación' }, { id: '1P', label: 'Una perforación' }, { id: '2P', label: 'Doble perforación' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'puerta', label: 'Puerta con cerradura' },
      { key: 'metal', label: 'Puerta de lámina perforada' },
    ],
  },
  {
    id: 'librero', nombre: 'Librero',
    selects: [
      { key: 'variante', label: 'Variante', opciones: [{ id: 'sin', label: 'Sencillo sin acometida' }, { id: 'con', label: 'Sencillo con acometida' }, { id: 'doble', label: 'Doble con acometida' }] },
      { key: 'largo', label: 'Ancho', opciones: [{ id: '300', label: '0.30 m' }, { id: '600', label: '0.60 m' }, { id: '900', label: '0.90 m' }, { id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'lado', label: 'Perforación (con acometida)', opciones: [{ id: 'C', label: 'Sin perforación' }, { id: 'I', label: 'Izquierda' }, { id: 'D', label: 'Derecha' }] },
      { key: 'perf', label: 'Perforación (doble)', opciones: [{ id: 'SP', label: 'Sin perforación' }, { id: '1P', label: 'Una perforación' }, { id: '2P', label: 'Doble perforación' }] },
    ],
    finishes: FINISHES,
  },
  {
    id: 'biombo', nombre: 'Biombo',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'divisor', label: 'Divisor' }, { id: 'frontal_bs', label: 'Frontal banca sencilla' }, { id: 'frontal_bd', label: 'Frontal banca doble' }] },
      { key: 'material', label: 'Material', opciones: [{ id: 'pet', label: 'Panel Acústico PET' }, { id: 'acrilico', label: 'Acrílico' }, { id: 'lamina', label: 'Lámina Perforada' }] },
      { key: 'largo', label: 'Ancho', opciones: [{ id: '400', label: '0.40 m (divisor)' }, { id: '600', label: '0.60 m (divisor)' }, { id: '900', label: '0.90 m (divisor)' }, { id: '880', label: '0.88 m (frontal)' }, { id: '1180', label: '1.18 m (frontal)' }, { id: '1480', label: '1.48 m (frontal)' }] },
    ],
  },
  {
    id: 'caja_electrica', nombre: 'Caja eléctrica',
    selects: [],
    checks: [{ key: 'cableada', label: 'Cableada (VISOCAELC)' }],
  },
];
// Colores reales de melamina 28mm (catálogo de acabados) para el selector.
// Se usa 'melamina-28' (ACAB.ABS.insumo) porque es el insumo de TODAS las caras
// visibles con acabado seleccionable (cubierta, frentes, puertas, librero) —
// la carcasa oculta en melamina-16 (CARCASA) no lleva color, es guarda interna.
export const VIA_PRODUCTOS = VIA_PRODUCTOS_BASE.map((p) => ({ ...p, colores: coloresDe('melamina-28') }));

// ---------------------------------------------------------------------------
//  Sub-ensambles reutilizables
// ---------------------------------------------------------------------------

// Carcasa oculta (melamina 16): 2 laterales + piso/techo + respaldo (+ divisor)
function carcasa(comp, largo, fondo, alto, divisor) {
  comp.push({ insumoId: CARCASA, nombre: 'Laterales carcasa', cantidad: 2, largoMM: fondo, anchoMM: alto });
  comp.push({ insumoId: CARCASA, nombre: 'Piso + techo', cantidad: 2, largoMM: largo, anchoMM: fondo });
  comp.push({ insumoId: CARCASA, nombre: 'Respaldo', cantidad: 1, largoMM: largo, anchoMM: alto });
  if (divisor) comp.push({ insumoId: CARCASA, nombre: 'Cara divisoria central', cantidad: 1, largoMM: fondo, anchoMM: alto });
}

// Pata marco comprada (modelo App / Cirque: CIPMCBD720 escritorio, CIPMBD720 banca)
function pataMarco(comp, clave) {
  comp.push({ insumoId: 'pata-metalica', nombre: `Pata marco (${clave}, modelo App/Cirque)`, cantidad: 1 });
  comp.push({ insumoId: 'nivelador', nombre: 'Niveladores pata', cantidad: 4 });
}

// Cubierta rectangular Cirque CICE (tablero de acabado + canto perimetral)
function cubierta(comp, claves, a, L, n) {
  const clave = 'CICE' + (IDX_CUB[L] || '5') + '2' + a.suf;
  comp.push({ insumoId: a.insumo, nombre: `Cubierta rectangular (${clave}, modelo Cirque)`, cantidad: n, largoMM: L, anchoMM: FONDO_CUB });
  comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubierta', cantidad: n * perim(L, FONDO_CUB) });
  claves.push(clave);
}

// Archivero-base con acometida. sencillo → VIARCS[C/I/D][n]; doble → VIARCDG[D/I][SP/1P/2P][n]
function archivero(comp, claves, a, L, cfg) {
  const doble = cfg.tipo === 'doble';
  const w = IDX_ARCH[L] || '5';
  carcasa(comp, L, FONDO_ARCH, ALTO_ARCH, doble);
  comp.push({ insumoId: a.insumo, nombre: `Frente(s) archivero (${a.label})`, cantidad: doble ? 2 : 1, largoMM: L / (doble ? 2 : 1), anchoMM: ALTO_ARCH });
  comp.push({ insumoId: CANTO, nombre: 'Canto frentes', cantidad: 2 * perim(L, ALTO_ARCH) });
  const cajones = doble ? 6 : 3;
  comp.push({ insumoId: 'corredera', nombre: 'Correderas de cajón', cantidad: cajones });
  comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras', cantidad: cajones });
  comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
  comp.push({ insumoId: 'acometida', nombre: 'Acometida / charola del pedestal', cantidad: doble ? 2 : 1 });
  if (doble) {
    const body = cfg.lado === 'I' ? 'I' : 'D';
    const perf = ['SP', '1P', '2P'].includes(cfg.perf) ? cfg.perf : '2P';
    claves.push('VIARCDG' + body + perf + w + a.suf);
  } else {
    const lado = ['C', 'I', 'D'].includes(cfg.lado) ? cfg.lado : 'C';
    claves.push('VIARCS' + lado + w + a.suf);
  }
}

// Puerta de archivero (VIPU[4/5][ABS/TF/CH/M]) + sistema corredizo + chapa cocol
function puertaArch(comp, claves, a, L, metal) {
  const w = L >= 1500 ? '5' : '4';        // 4 → alto 0.59 m; 5 → alto 0.75 m
  const alto = L >= 1500 ? 750 : 590;
  if (metal) {
    comp.push({ insumoId: LAMINA, nombre: 'Puerta de lámina perforada (VIPU..M)', cantidad: kgLamina(540, alto) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática puerta', cantidad: 1, largoMM: 540, anchoMM: alto });
  } else {
    comp.push({ insumoId: a.insumo, nombre: `Puerta archivero (VIPU${w}${a.suf})`, cantidad: 1, largoMM: 540, anchoMM: alto });
    comp.push({ insumoId: CANTO, nombre: 'Canto puerta', cantidad: perim(540, alto) });
  }
  comp.push({ insumoId: 'riel', nombre: 'Sistema corredizo SCMD30', cantidad: 1 });
  comp.push({ insumoId: 'cerradura', nombre: 'Chapa tipo cocol (CHPM4105)', cantidad: 1 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería puerta', cantidad: 1 });
  claves.push('VIPU' + w + (metal ? 'M' : a.suf));
}

// Biombo (divisor / frontal). clave según tipo; panel por área (acrílico/PET) o kg (lámina)
function biombo(comp, claves, tipo, material, L) {
  const bm = BIOMBO_MAT[material] || BIOMBO_MAT.acrilico;
  let alto = ALTO_DIV, clave = 'VIBIODIV2' + bm.suf, label = 'divisor';
  if (tipo === 'frontal_bs') { alto = ALTO_FRO_BS; clave = 'VIBIOFROBS' + (IDX_FRONTAL[L] || '4') + bm.suf; label = 'frontal banca sencilla'; }
  else if (tipo === 'frontal_bd') { alto = ALTO_FRO_BD; clave = 'VIBIOFROBD' + (IDX_FRONTAL[L] || '4') + bm.suf; label = 'frontal banca doble'; }
  if (bm.area) comp.push({ insumoId: bm.insumo, nombre: `Biombo ${label} · ${bm.label}`, cantidad: 1, largoMM: L, anchoMM: alto });
  else {
    comp.push({ insumoId: LAMINA, nombre: `Biombo ${label} · lámina perforada`, cantidad: kgLamina(L, alto) });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática biombo', cantidad: 1, largoMM: L, anchoMM: alto });
  }
  comp.push({ insumoId: 'escuadra', nombre: 'Soporte(s) biombo (ACHERFI/D10M, modelo Accents)', cantidad: tipo === 'frontal_bs' ? 2 : 1 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería biombo (opresor + rondanas)', cantidad: 1 });
  claves.push(clave);
}

// Caja eléctrica Vía: VIMOSOCUSAC (sin cablear) / VISOCAELC (cableada, +3.60 m ext.)
function cajaElec(comp, claves, electricos, n, cableada) {
  const clave = cableada ? 'VISOCAELC' : 'VIMOSOCUSAC';
  comp.push({ insumoId: LAMINA, nombre: `Cuerpo + tapas caja eléctrica (${clave})`, cantidad: n * 3.6 });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática caja', cantidad: n, largoMM: 392, anchoMM: 190 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería caja', cantidad: n });
  if (cableada) {
    comp.push({ insumoId: CONTACTO, nombre: 'Contacto dúplex 2 USB + 2 contactos (Leviton)', cantidad: n });
    comp.push({ insumoId: CHICOTE, nombre: 'Extensión eléctrica flexible 3.60 m (uso rudo 2×16)', cantidad: n * 3.6 });
    comp.push({ insumoId: 'nivelador', nombre: 'Imanes IM175', cantidad: n * 4 });
  }
  electricos.push(`${n} × ${clave} (caja eléctrica Vía, ${cableada ? 'cableada' : 'sin cablear'})`);
  for (let i = 0; i < n; i++) claves.push(clave);
}

// Sistema de arnés Byrne Phase 2 (caja doble BE52413 + conector Y + soportes)
function arnesByrne(comp, claves, electricos, cajas, conectorY) {
  comp.push({ insumoId: CAJA_BYRNE, nombre: 'Caja eléctrica doble Phase 2 (BE52413-2-2-30)', cantidad: cajas });
  comp.push({ insumoId: ARNES, nombre: 'Arnés Byrne Phase 2 + contactos', cantidad: cajas });
  comp.push({ insumoId: LAMINA, nombre: 'Soportes conector arnés (VICOB0877 / VICOB0877M / VICOB0877BS)', cantidad: 1.5 });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática soportes arnés', cantidad: 1, largoMM: 300, anchoMM: 120 });
  comp.push({ insumoId: 'tornilleria', nombre: 'Tornillería + grapas arnés', cantidad: 1 });
  electricos.push('Arnés Byrne Phase 2: caja BE52413-2-2-30, contactos BE52426-2-C-1-C / -2-BB, acometida BE52490-2-72, extensión BE52463.');
  claves.push('BE52413-2-2-30', 'VICOB0877');
  if (conectorY) { comp.push({ insumoId: CAJA_BYRNE, nombre: 'Conector en "Y" Phase 2 (CONECY / BE52418-2)', cantidad: 1 }); claves.push('CONECY'); electricos.push('Conector en "Y" BE52418-2.'); }
}

// ---------------------------------------------------------------------------
//  Ensamble por producto
// ---------------------------------------------------------------------------
export function generarVia(config) {
  const c = {
    producto: 'escritorio', largo: '1200', lado: 'C', perf: '2P',
    tipo: 'sencillo', variante: 'sin', material: 'pet',
    finish: 'ABS', biombo: false, electrico: false, cableada: false, arnes: false, puerta: false, metal: false,
    ...config,
  };
  const largo = num(c.largo, 1200);
  const a = ACAB[c.finish] || ACAB.ABS;
  const comp = [], claves = [], electricos = [];
  let tipoRender = 'guarda', nombre = '';

  if (c.producto === 'escritorio') {
    cubierta(comp, claves, a, largo, 1);
    archivero(comp, claves, a, largo, { tipo: 'sencillo', lado: c.lado });
    pataMarco(comp, 'CIPMCBD720');
    if (c.electrico) cajaElec(comp, claves, electricos, 1, c.cableada);
    if (c.biombo) biombo(comp, claves, 'divisor', 'acrilico', 400);
    if (c.arnes) arnesByrne(comp, claves, electricos, 1, false);
    tipoRender = 'escritorio';
    nombre = `Vía · Escritorio sencillo ${mm(largo).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'banca_doble') {
    cubierta(comp, claves, a, largo, 2);
    archivero(comp, claves, a, largo, { tipo: 'sencillo', lado: 'I' });
    archivero(comp, claves, a, largo, { tipo: 'sencillo', lado: 'D' });
    pataMarco(comp, 'CIPMBD720');
    if (c.biombo) {
      biombo(comp, claves, 'divisor', 'acrilico', 600);          // biombo lateral (VIBIODIV2)
      biombo(comp, claves, 'frontal_bd', 'pet', largo >= 1500 ? 1480 : 1180); // frontal banca doble
      // Conector para banca: VICOB0877 (con arnés) o VICOBIO (sin arnés)
      comp.push({ insumoId: 'escuadra', nombre: c.arnes ? 'Conector banca VICOB0877 (recibe arnés)' : 'Conector biombo banca VICOBIO', cantidad: 1 });
      claves.push(c.arnes ? 'VICOB0877' : 'VICOBIO');
    }
    if (c.electrico) cajaElec(comp, claves, electricos, 2, c.cableada);
    if (c.arnes) arnesByrne(comp, claves, electricos, 2, true);   // + conector en "Y" CONECY
    tipoRender = 'bench';
    nombre = `Vía · Banca doble ${mm(largo).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'archivero') {
    const doble = c.tipo === 'doble';
    archivero(comp, claves, a, largo, { tipo: c.tipo, lado: c.lado, perf: c.perf });
    if (c.puerta) puertaArch(comp, claves, a, largo, c.metal);
    nombre = `Vía · Archivero ${doble ? 'doble' : 'sencillo'} ${mm(largo).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'librero') {
    const v = ['sin', 'con', 'doble'].includes(c.variante) ? c.variante : 'sin';
    // Ancho válido por variante (fallback al mayor disponible)
    let L = largo, clave;
    if (v === 'sin') {
      if (!IDX_LIB_SIN[L]) L = L >= 1200 ? 1200 : L >= 600 ? 600 : 300;
      clave = 'VILIBS' + IDX_LIB_SIN[L] + a.suf;
    } else if (v === 'con') {
      if (!IDX_LIB_CON[L]) L = L >= 1500 ? 1500 : L >= 1200 ? 1200 : L >= 900 ? 900 : 600;
      const lado = ['C', 'I', 'D'].includes(c.lado) ? c.lado : 'C';
      clave = 'VILIBS' + lado + IDX_LIB_CON[L] + a.suf;
    } else {
      if (!IDX_LIB_DBL[L]) L = L >= 1500 ? 1500 : 1200;
      const perf = ['SP', '1P', '2P'].includes(c.perf) ? c.perf : 'SP';
      clave = 'VILIBDL' + perf + IDX_LIB_DBL[L] + a.suf;
    }
    const doble = v === 'doble';
    carcasa(comp, L, FONDO_ARCH, ALTO_ARCH, doble);
    const repisas = doble ? 4 : 2;
    comp.push({ insumoId: CARCASA, nombre: 'Repisas', cantidad: repisas, largoMM: L, anchoMM: FONDO_ARCH });
    comp.push({ insumoId: a.insumo, nombre: `Costados / frente visible (${a.label})`, cantidad: 1, largoMM: L, anchoMM: ALTO_ARCH });
    comp.push({ insumoId: CANTO, nombre: 'Canto repisas + frentes', cantidad: repisas * mm(L) + perim(L, ALTO_ARCH) });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    if (v !== 'sin') comp.push({ insumoId: 'acometida', nombre: 'Acometida / charola', cantidad: doble ? 2 : 1 });
    claves.push(clave);
    nombre = `Vía · Librero ${v === 'doble' ? 'doble' : v === 'con' ? 'sencillo c/acometida' : 'sencillo s/acometida'} ${mm(L).toFixed(2)} m · ${a.label}`;

  } else if (c.producto === 'biombo') {
    const L = num(c.largo, 400);
    biombo(comp, claves, c.tipo, c.material, L);
    tipoRender = 'mampara';
    const mat = (BIOMBO_MAT[c.material] || BIOMBO_MAT.acrilico).label;
    const tl = c.tipo === 'frontal_bs' ? 'frontal banca sencilla' : c.tipo === 'frontal_bd' ? 'frontal banca doble' : 'divisor';
    nombre = `Vía · Biombo ${tl} ${mm(L).toFixed(2)} m · ${mat}`;

  } else if (c.producto === 'caja_electrica') {
    cajaElec(comp, claves, electricos, 1, c.cableada);
    nombre = `Vía · Caja eléctrica ${c.cableada ? 'cableada (VISOCAELC)' : 'sin cablear (VIMOSOCUSAC)'}`;
  }

  return aplicarColor({
    producto: c.producto, nombre, componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 38, factorIndirecta: 12,
    nota: 'Vía (Fase A): línea de bajo costo (madera + metal). Estructura y dimensiones reales de la guía GE_Vía v3. MP estimada — calibrar con lista real. Materiales sin insumoId exacto (aproximados): patas App/Cirque CIPMCBD720/CIPMBD720 → pata-metalica; cubierta Cirque CICE → tablero de acabado; soportes Accents ACHERFI/D10M y conectores VICOB0877/VICOBIO/CONECY → escuadra/lámina/caja-electrica; sistema corredizo SCMD30 → riel; chapa cocol CHPM4105 → cerradura; piezas Byrne BE52413/BE52418/BE52426/BE52463/BE52490 → caja-electrica/arnés/contacto/chicote.',
  }, c);
}
