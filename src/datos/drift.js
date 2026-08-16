// ============================================================================
//  GENERADOR ECLIPSE DRIFT · guía GE_Eclipse Drift (ESP-DCC-IDP-003, v3
//  2025-09-09). Colección EJECUTIVA (variante de Eclipse con líneas orgánicas
//  de Alba): escritorios directivos de cubierta en laminado plástico + pata
//  Alba + base metálica + credenza-pedestal, faldón y carpeta (PAD) de EcoPiel.
//  Cuerpo de credenzas SIEMPRE en melamina negra; frentes/cubierta con opción
//  (ABS / HPEL laminado / Chapa). Claves ED. Compatibles Accents / Alba / Mute.
//
//  FIDELIDAD (correcciones de auditoría):
//   · Pata Alba por FONDO: 750→ABPATT160M · 900→ABPAT75M.
//   · Bases escritorio EDBAS26M=1773 / EDBAS27M=2066 / EDBAS28M=2366 (etiqueta
//     por medida real, no 2066→26M).
//   · Faldón por ancho×fondo: 1800×900→63 · 2100×900→73 · 1800×750→67 ·
//     2100×750→7 (EDFALBAS##EP).
//   · Credenza individual fondo 399 (no 450).
//   · Familia MN (cuerpo + frentes en melamina negra, cubierta con opción):
//     EDCZAMN / EDCZALIBMN.
//   · PAD para gabinete EDCABCQ28EP (1200) / EDCABCQ22EP (2400).
//   · Carpeta escritorio EDESCQ34EP (1200×400).
// ============================================================================
const CANTO = 'tapacanto', PTR = 'ptr', LAMINA = 'lamina-20', NEGRA = 'melamina-19';
const ECOPIEL = 'ecopiel', ESPUMA = 'espuma', PINTURA = 'pintura-electrostatica', MDF = 'mdf-16';

// Acabado de cara visible (cubierta, frentes con opción) → insumo tablero.
// Drift combina laminado plástico (HPEL) con melamina/chapa.
const ACAB = {
  ABS: { insumo: 'melamina-19', suf: 'ABS', label: 'Melamina ABS' },
  HPEL: { insumo: 'laminado', suf: 'HPELABS', label: 'Laminado plástico (HPEL)' },
  chapa: { insumo: 'chapa-madera', suf: 'CH', label: 'Chapa de madera' },
};
const FINISHES = [{ id: 'HPEL', label: 'Laminado (HPEL)' }, { id: 'ABS', label: 'Melamina ABS' }, { id: 'chapa', label: 'Chapa' }];

const FONDO_CRED = 600, ALTO_CRED = 400;   // credenzas escritorio (§Componentes)
const FONDO_IND = 399;                      // credenza individual (399, no 450)

export const DRIFT_PRODUCTOS = [
  {
    id: 'escritorio', nombre: 'Escritorio ejecutivo',
    selects: [
      { key: 'cubierta', label: 'Cubierta', opciones: [
        { id: '1800x750', label: '1.80 × 0.75 m' }, { id: '2100x750', label: '2.10 × 0.75 m' },
        { id: '1800x900', label: '1.80 × 0.90 m' }, { id: '2100x900', label: '2.10 × 0.90 m' },
      ] },
      { key: 'mano', label: 'Mano', opciones: [{ id: 'derecho', label: 'Derecho' }, { id: 'izquierdo', label: 'Izquierdo' }] },
      { key: 'credenza', label: 'Credenza-pedestal', opciones: [
        { id: 'cajonera120', label: 'Cajonera 120' }, { id: 'librero120', label: 'Librero 120' },
        { id: 'cajonera90', label: 'Cajonera 90' }, { id: 'librero90', label: 'Librero 90' },
      ] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'frentesMN', label: 'Frentes en melamina negra (MN)' },
      { key: 'faldon', label: 'Faldón EcoPiel + bastidor' },
      { key: 'carpeta', label: 'Carpeta / PAD EcoPiel (EDESCQ34EP)' },
      { key: 'electrico', label: 'Caja pasacables' },
    ],
  },
  {
    id: 'credenza', nombre: 'Credenza de escritorio',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'cajonera', label: 'Cajonera' }, { id: 'librero', label: 'Librero' }] },
      { key: 'medida', label: 'Medida', opciones: [{ id: '90', label: '0.90 m' }, { id: '120', label: '1.20 m' }] },
      { key: 'mano', label: 'Mano', opciones: [{ id: 'derecho', label: 'Derecho' }, { id: 'izquierdo', label: 'Izquierdo' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'frentesMN', label: 'Frentes en melamina negra (MN)' },
      { key: 'cerradura', label: 'Cerradura Hafele' },
    ],
  },
  {
    id: 'credenza_ind', nombre: 'Credenza individual',
    selects: [
      { key: 'variante', label: 'Variante', opciones: [
        { id: 'cajonera90', label: 'Cajonera 90' }, { id: 'puertas90', label: '2 puertas 90' }, { id: 'ind120', label: 'Individual 120' },
      ] },
    ],
    finishes: FINISHES,
    checks: [{ key: 'cerradura', label: 'Cerradura Hafele' }],
  },
  {
    id: 'mesa_ajustable', nombre: 'Mesa altura ajustable (EcoPiel)',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }] }],
  },
  {
    id: 'pad_gabinete', nombre: 'PAD para gabinete (EcoPiel)',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '1200', label: '1.20 m' }, { id: '2400', label: '2.40 m' }] }],
  },
];

const mm = (v) => (v / 1000);

// ----- Claves reales -----
// Pata Alba: por FONDO de cubierta. 750→ABPATT160M · 900→ABPAT75M.
const clavePata = (f) => (f >= 900 ? 'ABPAT75M' : 'ABPATT160M');

// Base escritorio: 1800→1773→EDBAS26M · 2100→2066→EDBAS27M (2366→EDBAS28M reserva).
const baseEsc = (w) => (w >= 2100 ? { largo: 2066, clave: 'EDBAS27M' } : { largo: 1773, clave: 'EDBAS26M' });

// Faldón EcoPiel con bastidor por ancho×fondo.
function claveFaldon(w, f) {
  if (f >= 900) return w >= 2100 ? 'EDFALBAS73EP' : 'EDFALBAS63EP';
  return w >= 2100 ? 'EDFALBAS7EP' : 'EDFALBAS67EP';
}

// Cubierta rectangular EDCUBR{6/7}{75/90}{suf}: 6=1800, 7=2100; 75=750, 90=900.
function claveCubierta(w, f, suf) {
  const anc = w >= 2100 ? '7' : '6';
  const fon = f >= 900 ? '90' : '75';
  return 'EDCUBR' + anc + fon + suf;
}

// Credenza escritorio. Cajonera lleva mano D/I; librero no. MN = frentes negros.
//   Cajonera opción : EDCZA{D/I}{32/42}{suf}
//   Cajonera MN     : EDCZAMN{D/I}{32/42}{suf}
//   Librero opción  : EDCZALIB{32/42}{suf}
//   Librero MN      : EDCZALIBMN{32/42}{suf}
function claveCredenzaEsc(tipo, largo, mano, mn, suf) {
  const med = largo >= 1200 ? '42' : '32';
  if (tipo === 'librero') return 'EDCZALIB' + (mn ? 'MN' : '') + med + suf;
  const m = mano === 'izquierdo' ? 'I' : 'D';
  return 'EDCZA' + (mn ? 'MN' : '') + m + med + suf;
}

// ----- Carcasa de credenza en melamina NEGRA (cuerpo SIEMPRE negro) -----
// 2 laterales + piso + techo + respaldo + doble fondo (paso de cableado).
function carcasaNegra(comp, largo, fondo, alto) {
  comp.push({ insumoId: NEGRA, nombre: 'Laterales (melamina negra)', cantidad: 2, largoMM: fondo, anchoMM: alto });
  comp.push({ insumoId: NEGRA, nombre: 'Piso + techo (melamina negra)', cantidad: 2, largoMM: largo, anchoMM: fondo });
  comp.push({ insumoId: NEGRA, nombre: 'Respaldo + doble fondo cableado (melamina negra)', cantidad: 2, largoMM: largo, anchoMM: alto });
}

// Base metálica soldada (EDBAS..M): marco PTR + pintura electrostática charcoal.
function baseMetalica(comp, largoMM, fondoMM, nombre, clave) {
  const m = mm(largoMM), fo = mm(fondoMM);
  comp.push({ insumoId: PTR, nombre: `${nombre} (${clave})`, cantidad: 2 * m + 2 * fo + 3 * 0.2 });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática base', cantidad: m * fo, largoMM, anchoMM: fondoMM });
  comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
}

export function generarDrift(config) {
  const c = {
    producto: 'escritorio', cubierta: '2100x750', mano: 'derecho', credenza: 'cajonera120',
    tipo: 'cajonera', medida: '120', variante: 'cajonera90', largo: '1500',
    finish: 'HPEL', frentesMN: false, faldon: false, carpeta: false, electrico: false, cerradura: false, ...config,
  };
  const a = ACAB[c.finish] || ACAB.HPEL;
  const comp = [];
  const claves = [];
  const electricos = [];

  // ----- Credenza escritorio (cuerpo negro + cubierta/frentes) -----
  // tipo: cajonera (3 cajones) | librero (repisas + 1 puerta). largo 900/1200.
  // mn=true → frentes en melamina negra; false → frentes con acabado opción.
  const credenzaEsc = (largo, tipo, mano, mn, conCerradura) => {
    const frenteInsumo = mn ? NEGRA : a.insumo;
    const frenteSuf = mn ? 'MN' : a.suf;
    carcasaNegra(comp, largo, FONDO_CRED, ALTO_CRED);
    comp.push({ insumoId: a.insumo, nombre: `Cubierta credenza (${a.suf})`, cantidad: 1, largoMM: largo, anchoMM: FONDO_CRED });
    if (tipo === 'cajonera') {
      const caj = 3;
      comp.push({ insumoId: frenteInsumo, nombre: `Frentes de cajón (${frenteSuf})`, cantidad: caj, largoMM: largo, anchoMM: Math.round(ALTO_CRED / caj) });
      comp.push({ insumoId: 'corredera', nombre: 'Correderas 10" madera (CO10M)', cantidad: caj });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras Modulor (JAB801711A66)', cantidad: caj });
    } else {
      comp.push({ insumoId: NEGRA, nombre: 'Repisas (melamina negra)', cantidad: 2, largoMM: largo, anchoMM: FONDO_CRED });
      comp.push({ insumoId: frenteInsumo, nombre: `Puerta vertical (${frenteSuf})`, cantidad: 1, largoMM: Math.round(largo / 3), anchoMM: ALTO_CRED });
      comp.push({ insumoId: 'bisagra', nombre: 'Bisagras', cantidad: 2 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladera Modulor (JAB801711A66)', cantidad: 1 });
    }
    comp.push({ insumoId: CANTO, nombre: 'Canto perímetro', cantidad: 2 * (mm(largo) + mm(FONDO_CRED)) + 4 * mm(ALTO_CRED) });
    if (conCerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura Hafele (CEHCLN)', cantidad: 1 });
  };

  // ----- Faldón con bastidor tapizado EcoPiel (EDFALBAS..EP) -----
  const faldon = (w, f) => {
    comp.push({ insumoId: PTR, nombre: 'Bastidor faldón (EDFALBAS, metal 2018)', cantidad: 2 * 1.303 + 2 * 0.31 });
    comp.push({ insumoId: ECOPIEL, nombre: 'Forro EcoPiel faldón', cantidad: 0.6 });
    comp.push({ insumoId: ESPUMA, nombre: 'Espuma faldón', cantidad: 1, largoMM: 1303, anchoMM: 310 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura bastidor', cantidad: 0.4, largoMM: 1303, anchoMM: 310 });
    claves.push(claveFaldon(w, f));
  };

  // ----- Carpeta / PAD de escritorio EcoPiel EDESCQ34EP (1200×400) -----
  const carpeta = () => {
    comp.push({ insumoId: MDF, nombre: 'Base rígida carpeta PAD (MDF)', cantidad: 1, largoMM: 1200, anchoMM: 400 });
    comp.push({ insumoId: ECOPIEL, nombre: 'Forro EcoPiel carpeta PAD', cantidad: mm(1200) * 0.45 / 0.55 });
    claves.push('EDESCQ34EP');
  };

  // ----- Caja pasacables (EDCAPEP) -----
  const cajaPasacables = () => {
    comp.push({ insumoId: LAMINA, nombre: 'Caja pasacables (EDCAPEP, lámina cal.20)', cantidad: 2.2 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura caja pasacables', cantidad: 0.2, largoMM: 400, anchoMM: 434 });
    comp.push({ insumoId: 'caja-electrica', nombre: 'Contactos / cableado', cantidad: 1 });
    electricos.push('Caja eléctrica bajo cubierta + cableado (aparte)');
    claves.push('EDCAPEP');
  };

  // -------------------- Ensamble por producto --------------------
  let nombre = '';

  if (c.producto === 'escritorio') {
    const [wStr, fStr] = c.cubierta.split('x');
    const w = parseInt(wStr), f = parseInt(fStr);
    // Cubierta principal (laminado/melamina/chapa) 19 mm
    comp.push({ insumoId: a.insumo, nombre: `Cubierta rectangular (${claveCubierta(w, f, a.suf)})`, cantidad: 1, largoMM: w, anchoMM: f });
    comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubierta', cantidad: 2 * (mm(w) + mm(f)) });
    // Pata Alba (por fondo) — marco metálico
    const pata = clavePata(f);
    comp.push({ insumoId: PTR, nombre: `Pata Alba (${pata}, metal)`, cantidad: 2 * 0.72 + 0.66 + 0.34 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura pata', cantidad: 0.4, largoMM: 700, anchoMM: 340 });
    // Base metálica para credenzas
    const base = baseEsc(w);
    baseMetalica(comp, base.largo, 608, 'Base para credenzas', base.clave);
    // Credenza-pedestal (SIEMPRE bajo cubierta, 120 o 90)
    const credLargo = c.credenza.includes('120') ? 1200 : 900;
    const credTipo = c.credenza.includes('librero') ? 'librero' : 'cajonera';
    credenzaEsc(credLargo, credTipo, c.mano, c.frentesMN, true);
    // Opcionales
    if (c.faldon) faldon(w, f);
    if (c.carpeta) carpeta();
    if (c.electrico) cajaPasacables();
    claves.push(claveCubierta(w, f, a.suf), pata, base.clave, claveCredenzaEsc(credTipo, credLargo, c.mano, c.frentesMN, a.suf));
    nombre = `Eclipse Drift · Escritorio ${c.mano} ${mm(w).toFixed(2)}×${mm(f).toFixed(2)} m · ${a.label}`;
  } else if (c.producto === 'credenza') {
    const largo = c.medida === '120' ? 1200 : 900;
    credenzaEsc(largo, c.tipo, c.mano, c.frentesMN, c.cerradura);
    const base = largo >= 1200 ? { largo: 2066, clave: 'EDBAS27M' } : { largo: 1773, clave: 'EDBAS26M' };
    baseMetalica(comp, base.largo, 608, 'Base credenza escritorio', base.clave);
    claves.push(claveCredenzaEsc(c.tipo, largo, c.mano, c.frentesMN, a.suf), base.clave);
    nombre = `Eclipse Drift · Credenza ${c.tipo} ${c.medida === '120' ? '1.20' : '0.90'} m · ${a.label}`;
  } else if (c.producto === 'credenza_ind') {
    // Credenza individual: fondo 399. 90→alto 480 · 120→alto 450.
    const largo = c.variante === 'ind120' ? 1200 : 900;
    const alto = c.variante === 'ind120' ? 450 : 480;
    carcasaNegra(comp, largo, FONDO_IND, alto);
    comp.push({ insumoId: a.insumo, nombre: `Cubierta (${a.suf})`, cantidad: 1, largoMM: largo, anchoMM: FONDO_IND });
    if (c.variante === 'puertas90') {
      comp.push({ insumoId: a.insumo, nombre: `2 puertas (${a.suf})`, cantidad: 2, largoMM: Math.round(largo / 2), anchoMM: alto });
      comp.push({ insumoId: 'bisagra', nombre: 'Bisagras', cantidad: 4 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras Modulor', cantidad: 2 });
    } else {
      comp.push({ insumoId: a.insumo, nombre: `Frentes de cajón (${a.suf})`, cantidad: 3, largoMM: largo, anchoMM: Math.round(alto / 3) });
      comp.push({ insumoId: 'corredera', nombre: 'Correderas 10" madera (CO10M)', cantidad: 3 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras Modulor', cantidad: 3 });
    }
    comp.push({ insumoId: CANTO, nombre: 'Canto perímetro', cantidad: 2 * (mm(largo) + mm(FONDO_IND)) + 4 * mm(alto) });
    // Base credenza individual: 90→EDBASCZA3M (866) · 120→EDBASCZA4M (1166)
    const baseInd = largo >= 1200 ? { largo: 1166, clave: 'EDBASCZA4M' } : { largo: 866, clave: 'EDBASCZA3M' };
    baseMetalica(comp, baseInd.largo, 416, 'Base credenza individual', baseInd.clave);
    if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura Hafele (CEHCLN)', cantidad: 1 });
    const claveCzaInd = c.variante === 'puertas90' ? 'EDCZA2PT345' : c.variante === 'ind120' ? 'EDCZA445' : 'EDCZA345';
    claves.push(claveCzaInd + a.suf, baseInd.clave);
    nombre = `Eclipse Drift · Credenza individual ${c.variante === 'ind120' ? '1.20' : '0.90'} m${c.variante === 'puertas90' ? ' (2 puertas)' : ''} · ${a.label}`;
  } else if (c.producto === 'mesa_ajustable') {
    const largo = parseInt(c.largo) || 1500;
    comp.push({ insumoId: MDF, nombre: 'Base rígida cubierta (MDF)', cantidad: 1, largoMM: largo, anchoMM: 600 });
    comp.push({ insumoId: ECOPIEL, nombre: 'Forro EcoPiel cubierta (EDBUB..EP)', cantidad: mm(largo) * 0.65 / 0.55 });
    comp.push({ insumoId: ESPUMA, nombre: 'Acolchado', cantidad: 1, largoMM: largo, anchoMM: 600 });
    comp.push({ insumoId: 'base-motorizada', nombre: 'Base altura ajustable (ACBASMAJCRA, motorizada)', cantidad: 1 });
    electricos.push('Base motorizada de altura ajustable (comprada)');
    claves.push('EDBUB' + (largo >= 1800 ? '26' : '25') + 'EP', 'ACBASMAJCRA');
    nombre = `Eclipse Drift · Mesa altura ajustable ${mm(largo).toFixed(2)} m · EcoPiel`;
  } else if (c.producto === 'pad_gabinete') {
    // PAD para gabinete EcoPiel: 1200→EDCABCQ28EP · 2400→EDCABCQ22EP (fondo 401, 20mm)
    const largo = parseInt(c.largo) || 1200;
    comp.push({ insumoId: MDF, nombre: 'Base rígida PAD gabinete (MDF)', cantidad: 1, largoMM: largo, anchoMM: 401 });
    comp.push({ insumoId: ECOPIEL, nombre: 'Forro EcoPiel PAD gabinete', cantidad: mm(largo) * 0.45 / 0.55 });
    comp.push({ insumoId: ESPUMA, nombre: 'Acolchado', cantidad: 1, largoMM: largo, anchoMM: 401 });
    claves.push(largo >= 2400 ? 'EDCABCQ22EP' : 'EDCABCQ28EP');
    nombre = `Eclipse Drift · PAD para gabinete ${mm(largo).toFixed(2)} m · EcoPiel`;
  }

  return armar(nombre, comp, claves, electricos, c);
}

function armar(nombre, componentes, claves, electricos, c) {
  return {
    producto: c.producto, nombre, componentes, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 42, factorIndirecta: 15,
    nota: 'Eclipse Drift (Fase A): línea ejecutiva. Dimensiones y claves reales de la guía GE_Eclipse Drift (pata Alba por fondo, bases EDBAS26/27/28M por medida, faldón por ancho×fondo, familia MN, PAD gabinete EDCABCQ, carpeta EDESCQ34EP). MP estimada: sin insumoId exacto se usó laminado/melamina-19/chapa-madera para tableros con opción, melamina-19 para cuerpo negro, ecopiel+mdf-16+espuma para faldón/carpeta/PAD, ptr+pintura-electrostatica para pata Alba y bases metálicas (EDBAS/EDBASCZA/EDFALBAS bastidor), lamina-20 para caja pasacables (EDCAPEP), base-motorizada para ACBASMAJCRA. Falta calibrar con lista de MP real + desarrollo exacto de pata Alba y bases metálicas.',
  };
}
