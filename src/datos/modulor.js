// ============================================================================
//  GENERADOR MODULOR · guía GE_Modulor (ESP-DCC-IDP-003, v3 2025-09-09).
//  Sistema de GUARDAS, gabinetes y cajoneras (concepto 4x4). Cuerpo metálico
//  ligero (lámina cal.20 + pintura electrostática); frentes/tapas en lámina /
//  melamina canto ABS / chapa de madera / termoformado / Ecolegno (HPELABS) /
//  Walnut Burl (chapa premium, sub-línea Luna) / acero inoxidable (maceta).
//  Familias reales de la guía: Gaveta (rodante / pedestal / bajo costo),
//  Librero (MOEI/MOED 42, MOAL75, MOAE4L/MOAE5L), Archivero horizontal
//  (MOAP75, MOAC75, MOAPC4/5 corrediza, MOAHCL4 cajones, MOAPCU3),
//  Archivero Registro Lateral (MOA1CA/MOA2CA/MOA1CC1ENSP), Armario ropero
//  (MOAAP115), Torre (pedestal+nicho+armario+placa MOTO22FTF), Locker apilable,
//  Wally, Modulor Luna (chapa/Walnut Burl), Maceta (MOMA2INOX), y componentes
//  sueltos: Cubiertas/Tapas (MOGAT*, MOTO115*, MOACAL5PT*, MOLOCKCU43*),
//  Cojines (MOCCRE*/MOCCAA2/MOWACO*) y Patas MOAC75L-ES.
//  Claves MO reales de la guía. FASE A: estructura + dimensiones reales; MP est.
// ============================================================================
const CUERPO = 'lamina-20', CANTO = 'tapacanto', PINTURA = 'pintura-electrostatica';
const KG20 = 7.16;
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => (v / 1000);
const num = (v, def) => parseInt(v) || def;

// Acabado de frentes/tapas → insumo, sufijo de clave, etiqueta legible.
// metal:true → se cotiza por kg de lámina; resto por área de tablero + canto.
const ACAB = {
  lamina:   { insumo: 'lamina-20',   suf: 'L',       label: 'Lámina',                 metal: true },
  ABS:      { insumo: 'melamina-19', suf: 'ABS',     label: 'Melamina y canto ABS' },
  chapa:    { insumo: 'chapa-madera', suf: 'CH',     label: 'Chapa de madera' },
  TF:       { insumo: 'membrana-pvc', suf: 'TF',     label: 'Termoformado' },
  ecolegno: { insumo: 'laminado',    suf: 'HPELABS', label: 'Ecolegno (HPELABS)' },
  walnut:   { insumo: 'chapa-walnut', suf: 'WB',     label: 'Chapa Walnut Burl' },
  inox:     { insumo: 'inoxidable',  suf: 'INOX',    label: 'Acero inoxidable',       metal: true },
};
const mkAcab = (f) => ACAB[f] || ACAB.ABS;

const FIN_STD = [
  { id: 'ABS', label: 'Melamina ABS' }, { id: 'lamina', label: 'Lámina' },
  { id: 'chapa', label: 'Chapa' }, { id: 'TF', label: 'Termoformado' }, { id: 'ecolegno', label: 'Ecolegno' },
];
const FIN_LOCKER = [{ id: 'lamina', label: 'Lámina' }, { id: 'ABS', label: 'Melamina ABS' }, { id: 'ecolegno', label: 'Ecolegno' }];
const FIN_LUNA = [{ id: 'chapa', label: 'Chapa de madera' }, { id: 'walnut', label: 'Walnut Burl' }];

export const MODULOR_PRODUCTOS = [
  {
    id: 'gaveta', nombre: 'Gaveta',
    selects: [{ key: 'tipo', label: 'Tipo', opciones: [{ id: 'rodante', label: 'Rodante' }, { id: 'pedestal', label: 'Pedestal' }, { id: 'bajocosto', label: 'Bajo costo (frente corrido)' }] }],
    finishes: FIN_STD,
    checks: [{ key: 'tapa', label: 'Cubierta (tapa)' }, { key: 'cojin', label: 'Tapa tipo cojín (tela)' }, { key: 'cerradura', label: 'Cerradura', def: true }],
  },
  {
    id: 'librero', nombre: 'Librero',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'izq42', label: 'Bajo izq. (MOEI42)' }, { id: 'der42', label: 'Bajo der. (MOED42)' },
      { id: 'fijo75', label: 'Fijo 0.75 (MOAL75)' }, { id: 'vert120', label: 'Vertical 1.20 (MOAE4L)' },
      { id: 'vert150', label: 'Vertical 1.50 (MOAE5L)' }, { id: 'caci130', label: '1.30 c/2 entrep. (MOCACI130)' },
    ] }],
    finishes: FIN_STD,
  },
  {
    id: 'archivero_h', nombre: 'Archivero horizontal',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'puertas75', label: '0.75 · 2 puertas (MOAP75)' }, { id: 'cajones75', label: '0.75 · 2 cajones (MOAC75)' },
      { id: 'corrediza120', label: '1.20 corrediza (MOAPC4)' }, { id: 'corrediza150', label: '1.50 corrediza (MOAPC5)' },
      { id: 'cajones120der', label: '1.20 · 2 cajones der. (MOAHCL4D)' }, { id: 'cajones120izq', label: '1.20 · 2 cajones izq. (MOAHCL4I)' },
      { id: 'puertas90', label: '0.90 · 2 puertas (MOAPCU3)' },
    ] }],
    finishes: FIN_STD,
    checks: [{ key: 'cerradura', label: 'Cerradura', def: true }, { key: 'cojin', label: 'Cojín superior (tela)' }],
  },
  {
    id: 'archivero_lateral', nombre: 'Archivero registro lateral',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'MOA1CA', label: 'MOA1CA' }, { id: 'MOA2CA', label: 'MOA2CA' }, { id: 'MOA1CC1ENSP', label: 'MOA1CC1ENSP (librero)' },
    ] }],
    checks: [{ key: 'cojin', label: 'Cojín MOCCAA2 (tela)' }, { key: 'cerradura', label: 'Cerradura', def: true }],
  },
  {
    id: 'armario', nombre: 'Armario ropero',
    selects: [{ key: 'mano', label: 'Mano', opciones: [{ id: 'izquierdo', label: 'Izquierdo' }, { id: 'derecho', label: 'Derecho' }] }],
    finishes: FIN_STD,
    checks: [{ key: 'cerradura', label: 'Cerradura', def: true }],
  },
  {
    id: 'torre', nombre: 'Torre (pedestal + nicho + armario)',
    selects: [{ key: 'mano', label: 'Configuración', opciones: [{ id: 'derecha', label: 'Derecha' }, { id: 'izquierda', label: 'Izquierda' }] }],
    finishes: FIN_STD,
    checks: [{ key: 'tapa', label: 'Cubierta MOTO115 (tapa)' }, { key: 'cerradura', label: 'Cerraduras', def: true }],
  },
  {
    id: 'locker', nombre: 'Locker (apilable, 3 guardas/unidad)',
    selects: [{ key: 'niveles', label: 'Niveles', opciones: [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }] }],
    finishes: FIN_LOCKER,
    checks: [{ key: 'zoclo', label: 'Zoclo (MOLOCKC43PTF-B)', def: true }, { key: 'tapa', label: 'Cubierta (MOLOCKCU43)' }],
  },
  {
    id: 'wally', nombre: 'Wally (guarda compacta)',
    selects: [
      { key: 'tipo', label: 'Tipo', opciones: [{ id: 'individual', label: 'Individual sencilla' }, { id: 'doble', label: 'Doble' }, { id: 'nicho', label: 'Sencilla c/nicho' }] },
      { key: 'base', label: 'Base', opciones: [{ id: 'fija', label: 'Fija' }, { id: 'rodante', label: 'Rodante' }] },
    ],
    checks: [{ key: 'cojin', label: 'Cojín (textil)' }],
  },
  {
    id: 'luna', nombre: 'Modulor Luna (chapa premium)',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [
      { id: 'gaveta', label: 'Gaveta rodante (MOLUGR2)' }, { id: 'pedestal', label: 'Gaveta pedestal (MOLUGEC3)' },
      { id: 'archivero', label: 'Archivero 0.75 (MOLUAC75)' }, { id: 'armario', label: 'Armario (MOLUAAP115)' },
      { id: 'closet', label: 'Closet 1.60 (MOLUAR575)' },
    ] }],
    finishes: FIN_LUNA,
  },
  { id: 'maceta', nombre: 'Maceta (MOMA2INOX)' },
  {
    id: 'cubierta', nombre: 'Cubierta / Tapa (suelta)',
    selects: [{ key: 'tipo', label: 'Aplicación', opciones: [
      { id: 'gaveta', label: 'Gaveta (MOGAT)' }, { id: 'torre', label: 'Torre (MOTO115)' },
      { id: 'archivero', label: 'Archivero+librero (MOACAL5PT)' }, { id: 'locker', label: 'Locker (MOLOCKCU43)' },
    ] }],
    finishes: FIN_STD,
  },
  {
    id: 'cojin', nombre: 'Cojín (suelto)',
    selects: [{ key: 'tipo', label: 'Aplicación', opciones: [
      { id: 'gaveta395', label: 'Gaveta (MOCCRE395MM2)' }, { id: 'archivero760', label: 'Archivero MOAPC5 (MOCCRE760MM)' },
      { id: 'archivero750', label: 'Archivero MOAP75 (MOCCREC750MM)' }, { id: 'lateral', label: 'Registro lateral (MOCCAA2)' },
      { id: 'wallynicho', label: 'Wally nicho (MOWACOGNT)' }, { id: 'wally', label: 'Wally (MOWACOT)' },
    ] }],
  },
];

// ---------------------------------------------------------------------------
// Helpers de despiece
// ---------------------------------------------------------------------------
// Cuerpo metálico (2 laterales + piso + techo + respaldo) como lámina cal.20.
function cuerpoMetal(comp, w, d, h, etiqueta = 'Cuerpo metálico') {
  const area = 2 * mm(d) * mm(h) + 2 * mm(w) * mm(d) + mm(w) * mm(h);
  comp.push({ insumoId: CUERPO, nombre: `${etiqueta} (lámina cal.20)`, cantidad: laminaKg(area) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática cuerpo', cantidad: area, largoMM: h, anchoMM: d });
  return area;
}

// Frente/tapa/puerta en el acabado elegido. Metal (lámina/inox) → kg; tablero → área + canto.
function panel(comp, a, w, h, cant, nombre) {
  if (a.metal) {
    comp.push({ insumoId: a.insumo, nombre: `${nombre} (${a.label})`, cantidad: laminaKg(cant * mm(w) * mm(h)) });
  } else {
    comp.push({ insumoId: a.insumo, nombre: `${nombre} (${a.label})`, cantidad: cant, largoMM: w, anchoMM: h });
    comp.push({ insumoId: CANTO, nombre: 'Canto ABS', cantidad: cant * 2 * (mm(w) + mm(h)) });
  }
}

// Cajones metálicos (cajas + correderas + jaladeras). Frente en el acabado.
function cajones(comp, a, w, hFrente, n, jaladeraInox) {
  panel(comp, a, w, hFrente, n, 'Frentes de cajón');
  comp.push({ insumoId: CUERPO, nombre: 'Cajas de cajón (lámina)', cantidad: laminaKg(n * 0.35) });
  comp.push({ insumoId: 'corredera', nombre: 'Correderas', cantidad: n });
  comp.push({ insumoId: 'jaladera', nombre: `Jaladeras metálicas${jaladeraInox ? ' (inox)' : ''}`, cantidad: n });
}

function cojinTela(comp, w, d, clave) {
  comp.push({ insumoId: 'mdf-16', nombre: 'Base cojín (MDF)', cantidad: 1, largoMM: w, anchoMM: d });
  comp.push({ insumoId: 'espuma', nombre: 'Espuma cojín', cantidad: 1, largoMM: w, anchoMM: d });
  comp.push({ insumoId: 'tela', nombre: `Tela tapiz cojín${clave ? ' ' + clave : ''}`, cantidad: mm(w) * mm(d) / 0.55 });
}

// ---------------------------------------------------------------------------
export function generarModulor(config) {
  const c = {
    producto: 'gaveta', tipo: 'rodante', modelo: '', mano: 'izquierdo', niveles: '1', base: 'fija',
    finish: 'ABS', tapa: false, cojin: false, cerradura: true, zoclo: true, ...config,
  };
  const comp = [];
  const claves = [];
  let nombre = '';

  // ------------------------------------------------------------------ GAVETA
  if (c.producto === 'gaveta') {
    if (c.tipo === 'bajocosto') {
      // Gaveta frente corrido 380×584×509, 2 cajones rodante, ABS fijo.
      const a = ACAB.ABS, w = 380, d = 584, h = 509;
      cuerpoMetal(comp, w, d, h);
      cajones(comp, a, w, Math.round(h / 2), 2);
      comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
      if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
      claves.push('MOGER2FCTABSJ');
      nombre = 'Modulor · Gaveta bajo costo (frente corrido) · Melamina ABS';
    } else {
      const a = mkAcab(c.finish);
      const pedestal = c.tipo === 'pedestal';
      const w = 392, d = 570, h = pedestal ? 720 : 591;
      const nCaj = pedestal ? 3 : 2;
      cuerpoMetal(comp, w, d, h);
      cajones(comp, a, w, Math.round(h / nCaj), nCaj);
      if (c.cojin) cojinTela(comp, 558, d, 'MOCCRE395MM2');
      else if (c.tapa) panel(comp, a, 558, d, 1, 'Cubierta (tapa MOGAT)');
      comp.push({ insumoId: pedestal ? 'nivelador' : 'rodaja', nombre: pedestal ? 'Niveladores' : 'Rodajas', cantidad: 4 });
      if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
      if (pedestal) {
        claves.push(c.finish === 'ecolegno' ? 'MOGEC3HPELABS' : 'MOGEC3' + a.suf + 'J');
      } else {
        const base = c.cojin ? 'MOGRCTC2' : (c.tapa ? 'MOGRCT2' : 'MOGR2');
        claves.push(base + a.suf + 'J');
      }
      nombre = `Modulor · Gaveta ${pedestal ? 'pedestal' : 'rodante'} · ${a.label}`;
    }

  // ----------------------------------------------------------------- LIBRERO
  } else if (c.producto === 'librero') {
    const modelo = c.modelo || 'izq42';
    if (modelo === 'izq42' || modelo === 'der42') {
      const a = mkAcab(c.finish), w = 560, d = 406, h = 399;
      cuerpoMetal(comp, w, d, h);
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaño (lámina)', cantidad: laminaKg(mm(w) * mm(d)) });
      if (!a.metal) panel(comp, a, w, h, 1, 'Costado / frente visible');
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      claves.push((modelo === 'der42' ? 'MOED42' : 'MOEI42') + a.suf);
      nombre = `Modulor · Librero bajo ${modelo === 'der42' ? 'derecho' : 'izquierdo'} · ${a.label}`;
    } else if (modelo === 'fijo75') {
      const w = 430, d = 476, h = 750;
      cuerpoMetal(comp, w, d, h);
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaño (lámina)', cantidad: laminaKg(mm(w) * mm(d)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      claves.push('MOAL75LSP');
      nombre = 'Modulor · Librero fijo 0.75 · Metálico';
    } else if (modelo === 'vert120' || modelo === 'vert150') {
      const alto = modelo === 'vert150' ? 1500 : 1200;
      const w = 360, d = 580, h = alto;
      cuerpoMetal(comp, w, d, h);
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaños x2 (lámina)', cantidad: laminaKg(2 * mm(w) * mm(d)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      claves.push(modelo === 'vert150' ? 'MOAE5L' : 'MOAE4L');
      nombre = `Modulor · Archivero librero ${mm(alto).toFixed(2)} m · Metálico`;
    } else { // caci130 · 360×750×1300 · 2 entrepaños · TF o ABS
      const a = c.finish === 'ABS' ? ACAB.ABS : ACAB.TF;
      const w = 360, d = 750, h = 1300;
      cuerpoMetal(comp, w, d, h);
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaños x2 (lámina)', cantidad: laminaKg(2 * mm(w) * mm(d)) });
      panel(comp, a, w, h, 1, 'Costado / frente visible');
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      claves.push('MOCACI130LT' + a.suf);
      nombre = `Modulor · Archivero librero 1.30 · ${a.label}`;
    }

  // ------------------------------------------------------- ARCHIVERO HORIZONTAL
  } else if (c.producto === 'archivero_h') {
    const a = mkAcab(c.finish);
    const modelo = c.modelo || 'puertas75';
    if (modelo === 'puertas75' || modelo === 'cajones75') {
      const w = 450, d = 476, h = 750;
      cuerpoMetal(comp, w, d, h);
      if (modelo === 'cajones75') cajones(comp, a, w, Math.round(h / 2), 2);
      else { panel(comp, a, Math.round(w / 2), h, 2, 'Puertas verticales'); comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras metálicas', cantidad: 2 }); }
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaño (lámina)', cantidad: laminaKg(mm(w) * mm(d)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
      if (c.cojin) cojinTela(comp, w, d, modelo === 'cajones75' ? 'MOCCREC750MM' : '');
      const raiz = modelo === 'cajones75' ? 'MOAC75' : 'MOAP75';
      claves.push(c.finish === 'ecolegno' ? raiz + 'JSPHPELABS' : raiz + a.suf + 'JSP');
      nombre = `Modulor · Archivero horizontal 0.75 ${modelo === 'cajones75' ? '2 cajones' : '2 puertas'} · ${a.label}`;
    } else if (modelo === 'corrediza120' || modelo === 'corrediza150') {
      const alto = modelo === 'corrediza150' ? 1500 : 1200;
      const w = 380, d = 582, h = alto;
      cuerpoMetal(comp, w, d, h);
      panel(comp, a, w, Math.round(h * 0.5), 1, 'Puerta corrediza');
      comp.push({ insumoId: 'riel', nombre: 'Riel puerta corrediza', cantidad: 1 });
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaños x2 (lámina)', cantidad: laminaKg(2 * mm(w) * mm(d)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
      if (c.cojin) cojinTela(comp, 355, 760, 'MOCCRE760MM');
      const raiz = modelo === 'corrediza150' ? 'MOAPC5' : 'MOAPC4';
      claves.push(c.finish === 'ecolegno' ? raiz + 'HPELABS' : raiz + a.suf);
      nombre = `Modulor · Archivero horizontal ${mm(alto).toFixed(2)} corrediza · ${a.label}`;
    } else if (modelo === 'cajones120der' || modelo === 'cajones120izq') {
      // Solo Lámina y Melamina ABS. 448×582×1200, 2 cajones + entrepaño lateral.
      const aa = c.finish === 'ABS' ? ACAB.ABS : ACAB.lamina;
      const der = modelo === 'cajones120der';
      const w = 448, d = 582, h = 1200;
      cuerpoMetal(comp, w, d, h);
      cajones(comp, aa, w, 300, 2);
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaño lateral (lámina)', cantidad: laminaKg(mm(w) * mm(d)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
      claves.push('MOAHCL4' + (der ? 'D' : 'I') + aa.suf + 'J');
      nombre = `Modulor · Archivero horizontal 1.20 · 2 cajones ${der ? 'der.' : 'izq.'} · ${aa.label}`;
    } else { // puertas90 · MOAPCU3 · 425×900×749
      const w = 425, d = 900, h = 749;
      cuerpoMetal(comp, w, d, h);
      panel(comp, a, Math.round(w / 2), h, 2, 'Puertas verticales');
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras metálicas', cantidad: 2 });
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaño (lámina)', cantidad: laminaKg(mm(w) * mm(d)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
      claves.push(c.finish === 'ecolegno' ? 'MOAPCU3HPELABS' : 'MOAPCU3' + a.suf);
      nombre = `Modulor · Archivero horizontal 0.90 · 2 puertas · ${a.label}`;
    }

  // ----------------------------------------------- ARCHIVERO REGISTRO LATERAL
  } else if (c.producto === 'archivero_lateral') {
    // Lámina (metálico). 457×905×1200. MOA1CA / MOA2CA / MOA1CC1ENSP (librero c/2 entrep).
    const modelo = c.modelo || 'MOA1CA';
    const w = 457, d = 905, h = 1200;
    cuerpoMetal(comp, w, d, h);
    if (modelo === 'MOA1CC1ENSP') {
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaños graduales x2 + barrenos (lámina)', cantidad: laminaKg(2 * mm(w) * mm(d)) });
      panel(comp, ACAB.lamina, w, Math.round(h / 2), 1, 'Frente librero');
    } else {
      const nCaj = modelo === 'MOA2CA' ? 2 : 1;
      cajones(comp, ACAB.lamina, w, Math.round(h / (nCaj + 1)), nCaj);
    }
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    if (c.cerradura) { comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica (cilindro)', cantidad: 1 }); }
    if (c.cojin) cojinTela(comp, w, h, 'MOCCAA2');
    claves.push(modelo);
    nombre = `Modulor · Archivero registro lateral ${modelo} · Lámina`;

  // ---------------------------------------------------------------- ARMARIO
  } else if (c.producto === 'armario') {
    const a = mkAcab(c.finish);
    const der = c.mano === 'derecho';
    const w = 560, d = 230, h = 1130;   // armario slim compatible con torre (fondo 230)
    cuerpoMetal(comp, w, d, h);
    panel(comp, a, w, h, 1, 'Puerta vertical');
    comp.push({ insumoId: CUERPO, nombre: 'Entrepaño + tubo ropero (lámina)', cantidad: laminaKg(mm(w) * mm(d) + 0.1) });
    comp.push({ insumoId: 'bisagra', nombre: 'Bisagras', cantidad: 3 });
    comp.push({ insumoId: 'jaladera', nombre: 'Jaladera', cantidad: 1 });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
    claves.push('MOAAP115' + (der ? 'D' : 'I') + a.suf + 'J');
    nombre = `Modulor · Armario ropero ${der ? 'derecho' : 'izquierdo'} · ${a.label}`;

  // ------------------------------------------------------------------- TORRE
  } else if (c.producto === 'torre') {
    // Ensamble: gaveta pedestal + nicho librero MOED/MOEI42 + armario MOAAP115 +
    // placa de unión MOTO22FTF (x2) + cubierta MOTO115.
    const a = mkAcab(c.finish);
    const der = c.mano === 'derecha';
    // Pedestal (base)
    cuerpoMetal(comp, 392, 570, 720, 'Cuerpo pedestal');
    cajones(comp, a, 392, 240, 3);
    // Nicho (librero bajo)
    cuerpoMetal(comp, 560, 406, 399, 'Cuerpo nicho (librero)');
    if (!a.metal) panel(comp, a, 560, 399, 1, 'Frente nicho');
    // Armario superior
    cuerpoMetal(comp, 560, 230, 1130, 'Cuerpo armario');
    panel(comp, a, 560, 1130, 1, 'Puerta armario');
    comp.push({ insumoId: 'bisagra', nombre: 'Bisagras armario', cantidad: 3 });
    // Unión + herrajes
    comp.push({ insumoId: 'escuadra', nombre: 'Placas de unión MOTO22FTF', cantidad: 2 });
    comp.push({ insumoId: 'jaladera', nombre: 'Jaladeras metálicas', cantidad: 4 });
    comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    if (c.cerradura) comp.push({ insumoId: 'cerradura', nombre: 'Cerraduras metálicas', cantidad: 2 });
    if (c.tapa) panel(comp, a, 560, 628, 1, 'Cubierta torre MOTO115');
    // Claves reales del despiece de torre
    claves.push(c.finish === 'ecolegno' ? 'MOGEC3HPELABS' : 'MOGEC3' + a.suf + 'J');
    claves.push((der ? 'MOED42' : 'MOEI42') + a.suf);
    claves.push('MOAAP115' + (der ? 'D' : 'I') + a.suf + 'J');
    claves.push('MOTO22FTF');
    if (c.tapa) claves.push(c.finish === 'ecolegno' ? 'MOTO115HPELABS' : 'MOTO115' + a.suf + '-CU' + a.suf);
    nombre = `Modulor · Torre ${der ? 'derecha' : 'izquierda'} · ${a.label}`;

  // ------------------------------------------------------------------ LOCKER
  } else if (c.producto === 'locker') {
    // Unidad MOLOCKC43P 410×400×1200 con 3 guardas. Apila 1/2/3 + zoclo + tapa.
    const niveles = num(c.niveles, 1);
    const a = mkAcab(c.finish);
    const w = 410, d = 400, hU = 1200;
    for (let i = 0; i < niveles; i++) {
      cuerpoMetal(comp, w, d, hU, `Locker unidad ${i + 1} (3 guardas)`);
      panel(comp, a, w, Math.round(hU / 3), 3, `Puertas locker unidad ${i + 1}`);
      comp.push({ insumoId: 'cerradura', nombre: `Cerraduras unidad ${i + 1}`, cantidad: 3 });
      comp.push({ insumoId: 'jaladera', nombre: `Jaladeras unidad ${i + 1}`, cantidad: 3 });
    }
    if (c.zoclo) {
      comp.push({ insumoId: CUERPO, nombre: 'Zoclo metálico MOLOCKC43PTF-B (410×100)', cantidad: laminaKg(mm(410) * mm(100)) });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
    }
    const sLock = c.finish === 'lamina' ? 'TF' : (c.finish === 'ecolegno' ? 'HPABS' : 'ABS');
    if (c.tapa) { panel(comp, a, 420, 1200, 1, 'Cubierta MOLOCKCU43'); claves.push('MOLOCKCU43' + sLock); }
    if (c.zoclo) claves.push('MOLOCKC43PTF-B');
    claves.unshift('MOLOCKC43P' + sLock);
    nombre = `Modulor · Locker ${niveles} unidad${niveles > 1 ? 'es' : ''} (${niveles * 3} guardas) · ${a.label}`;

  // ------------------------------------------------------------------- WALLY
  } else if (c.producto === 'wally') {
    const rod = c.base === 'rodante';
    const tipo = c.tipo || 'individual';
    const doble = tipo === 'doble';
    const nicho = tipo === 'nicho';
    const w = 365, d = doble ? 418 : (nicho ? 417 : 415), h = (doble || nicho) ? 900 : 460;
    cuerpoMetal(comp, w, d, h, 'Cuerpo Wally (lámina)');
    comp.push({ insumoId: CUERPO, nombre: 'Utilero deslizable + tapa(s) abatible(s) (lámina)', cantidad: laminaKg((doble ? 2 : 1) * mm(w) * mm(d)) });
    comp.push({ insumoId: 'corredera', nombre: 'Correderas utilero', cantidad: doble ? 2 : 1 });
    comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
    comp.push({ insumoId: rod ? 'rodaja' : 'nivelador', nombre: rod ? 'Rodajas' : 'Niveladores', cantidad: 4 });
    if (c.cojin) cojinTela(comp, 367, nicho ? 460 : 450, nicho ? 'MOWACOGNT' : 'MOWACOT');
    const raiz = doble ? 'MOWADX' : (nicho ? 'MOWASLD' : 'MOWASX');
    claves.push(raiz + (rod ? 'R' : 'F'));
    nombre = `Modulor · Wally ${doble ? 'doble' : (nicho ? 'sencilla c/nicho' : 'individual')} ${rod ? 'rodante' : 'fija'} · Lámina`;

  // -------------------------------------------------------------- MODULOR LUNA
  } else if (c.producto === 'luna') {
    // Sub-línea premium: chapa de madera; opción Walnut Burl (sufijo WB, insumo chapa-walnut).
    const wb = c.finish === 'walnut';
    const a = wb ? ACAB.walnut : ACAB.chapa;
    const modelo = c.modelo || 'gaveta';
    let raiz = '';
    if (modelo === 'gaveta') {
      cuerpoMetal(comp, 560, 544, 392, 'Cuerpo gaveta Luna');
      cajones(comp, a, 560, 196, 2, true);
      comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 });
      raiz = 'MOLUGR2CHJ';
    } else if (modelo === 'pedestal') {
      cuerpoMetal(comp, 560, 392, 718, 'Cuerpo pedestal Luna');
      cajones(comp, a, 560, 240, 3, true);
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      raiz = 'MOLUGEC3CHJ';
    } else if (modelo === 'archivero') {
      cuerpoMetal(comp, 610, 448, 750, 'Cuerpo archivero Luna');
      cajones(comp, a, 610, 375, 2, true);
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      raiz = 'MOLUAC75CHJ';
    } else if (modelo === 'armario') {
      cuerpoMetal(comp, 560, 230, 1130, 'Cuerpo armario Luna');
      panel(comp, a, 560, 1130, 1, 'Puerta vertical');
      comp.push({ insumoId: 'bisagra', nombre: 'Bisagras', cantidad: 3 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladera (inox)', cantidad: 1 });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      raiz = 'MOLUAAP115CHJ';
    } else { // closet 500×750×1600, entrepaños móviles, zoclo inox
      cuerpoMetal(comp, 500, 750, 1600, 'Cuerpo closet Luna');
      panel(comp, a, 500, 1600, 1, 'Puerta closet');
      comp.push({ insumoId: CUERPO, nombre: 'Entrepaños móviles (lámina)', cantidad: laminaKg(2 * mm(500) * mm(750)) });
      panel(comp, ACAB.inox, 500, 100, 1, 'Zoclo inox');
      comp.push({ insumoId: 'bisagra', nombre: 'Bisagras', cantidad: 3 });
      comp.push({ insumoId: 'jaladera', nombre: 'Jaladera (inox)', cantidad: 1 });
      comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 });
      raiz = 'MOLUAR575CHJ';
    }
    comp.push({ insumoId: 'cerradura', nombre: 'Cerradura metálica', cantidad: 1 });
    claves.push(wb ? raiz + 'WB' : raiz);
    nombre = `Modulor Luna · ${modelo} · ${a.label}`;

  // ------------------------------------------------------------------ MACETA
  } else if (c.producto === 'maceta') {
    // Macetero decorativo en acero inoxidable. 457×390×1200.
    const w = 457, d = 390, h = 1200;
    const area = 2 * mm(d) * mm(h) + 2 * mm(w) * mm(d) + mm(w) * mm(h);
    comp.push({ insumoId: 'inoxidable', nombre: 'Cuerpo maceta (acero inoxidable)', cantidad: laminaKg(area) });
    comp.push({ insumoId: 'soldadura', nombre: 'Soldadura / armado inox', cantidad: 0.2 });
    comp.push({ insumoId: 'acab-satinado', nombre: 'Acabado satinado inox', cantidad: area, largoMM: h, anchoMM: d });
    claves.push('MOMA2INOX');
    nombre = 'Modulor · Maceta MOMA2INOX · Acero inoxidable';

  // ---------------------------------------------------------------- CUBIERTA
  } else if (c.producto === 'cubierta') {
    const a = mkAcab(c.finish);
    const tipo = c.tipo || 'gaveta';
    if (tipo === 'gaveta') {
      panel(comp, a, 558, 392, 1, 'Cubierta gaveta');
      claves.push('MOGAT' + a.suf);   // MOGATL/MOGATABS/MOGATCH/MOGATTF/MOGATHPELABS
      nombre = `Modulor · Cubierta gaveta (MOGAT) · ${a.label}`;
    } else if (tipo === 'torre') {
      panel(comp, a, 560, 628, 1, 'Cubierta torre');
      claves.push(c.finish === 'ecolegno' ? 'MOTO115HPELABS' : 'MOTO115' + a.suf + '-CU' + a.suf);
      nombre = `Modulor · Cubierta torre (MOTO115) · ${a.label}`;
    } else if (tipo === 'archivero') {
      panel(comp, a, 449, 1498, 1, 'Cubierta archivero+librero');
      claves.push(c.finish === 'ecolegno' ? 'MOACAL5PTHPELABS-CT' : 'MOACAL5PT' + a.suf + '-CT');
      nombre = `Modulor · Cubierta archivero+librero (MOACAL5PT) · ${a.label}`;
    } else { // locker
      panel(comp, a, 420, 1200, 1, 'Cubierta locker');
      const sLock = c.finish === 'lamina' ? 'TF' : (c.finish === 'ecolegno' ? 'HPABS' : 'ABS');
      claves.push('MOLOCKCU43' + sLock);
      nombre = `Modulor · Cubierta locker (MOLOCKCU43) · ${a.label}`;
    }

  // ------------------------------------------------------------------- COJÍN
  } else if (c.producto === 'cojin') {
    const tipo = c.tipo || 'gaveta395';
    const T = {
      gaveta395:  { w: 560, d: 395, clave: 'MOCCRE395MM2', et: 'gaveta' },
      archivero760: { w: 355, d: 760, clave: 'MOCCRE760MM', et: 'archivero MOAPC5' },
      archivero750: { w: 448, d: 750, clave: 'MOCCREC750MM', et: 'archivero MOAP75' },
      lateral:    { w: 457, d: 1200, clave: 'MOCCAA2', et: 'registro lateral' },
      wallynicho: { w: 367, d: 460, clave: 'MOWACOGNT', et: 'Wally nicho' },
      wally:      { w: 367, d: 450, clave: 'MOWACOT', et: 'Wally' },
    }[tipo];
    cojinTela(comp, T.w, T.d, T.clave);
    claves.push(T.clave);
    nombre = `Modulor · Cojín ${T.et} (${T.clave})`;
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves, electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 35, factorIndirecta: 12,
    nota: 'Modulor (Fase A): sistema de guardas metálicas concepto 4x4. Dimensiones y claves MO reales de la guía GE_Modulor v3 (2025-09-09). Cuerpo lámina cal.20 + pintura electrostática; frentes/tapas en lámina/melamina ABS/chapa/termoformado/Ecolegno(HPELABS)/Walnut Burl(chapa-walnut)/inox. MP estimada — falta calibrar con lista real y desarrollo exacto de cajones, entrepaños y herrajes por clave. Termoformado modelado con membrana-pvc; Ecolegno con laminado (HPL). Placa de unión MOTO22FTF costeada como escuadra.',
  };
}
