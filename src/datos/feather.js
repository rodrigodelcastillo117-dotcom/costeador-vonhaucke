// ============================================================================
//  GENERADOR FEATHER · guía GE_Feather (ESP-DCC-IDP-003, v3 2025-09-09).
//  Línea ligera de gran estabilidad: ESTRUCTURA TUBULAR CONTINUA. Configuraciones
//  de la 1a etapa: ESCRITORIO (en L: frente + retorno lateral, con lateralidad
//  izq/der), BENCH SENCILLO y BENCH DOBLE (ambos en nivel EQUIPADO o BÁSICO).
//
//  Modelado fiel a la guía:
//   · Escritorio en L = cubierta frontal FECUBESC + cubierta retorno FECUBLAT +
//     estructura frontal FEESTESC + estructura lateral FEESTLATD/I + bastidores
//     FEBASESC/FEBASLAT + pata lateral FEPATLATI/D + tensor FECON38M + faldón
//     FEFALESC + ducto FECDOESCM. Lateralidad real (D/I).
//   · Bench = ensamble de estructuras DISCRETAS por bahía: Inicio (FEESTIN*) +
//     Central con acometida (FEESTACOC* equipado / FEESTACBSC* básico) +
//     Intermedia (FEESTPIN*) + Cierre (FEESTCIE*). Cubierta FECUBBD24/25.
//   · nivel equipado vs básico = cambio ESTRUCTURAL: tapas (FEJGTAP*), ductos
//     equipados FECDOBD4/5M + biombos con soporte FEBIOBD*, vs biombo/conducto
//     básico FECDOBOBY*; la acometida lateral FEACOLAM sólo existe en bench doble.
//   · Tensor = FECON38M redondo Cold Rolled Ø3/8", único acabado EcoCrome, 45°.
//   · Acabados frentes/cubiertas: Melamina ABS (ABS) / Termoformado (TF) /
//     Ecolegno (HPELABS). Faldones/biombos de acrílico 6mm (AC).
//   · Escritorio SÓLO 1500/1800, fondo 600/750/900. Bench SÓLO 1200/1500.
//     Biombos por módulo 600×300 / 900×300 / 900×400.
//  FASE A: dimensiones reales de la guía; MP metálica estimada (PTR + pintura
//  electrostática + lámina/ducto), pendiente calibrar con lista de MP real.
// ============================================================================

// --- Insumos base (SÓLO IDs válidos del catálogo) --------------------------
const CANTO = 'tapacanto', PTR = 'ptr', PINTURA = 'pintura-electrostatica';
const LAMINA = 'lamina-20', DUCTO = 'ducto', ACRIL = 'acrilico-6';
const ACOMETIDA = 'acometida', CAJA = 'caja-electrica', START3 = 'byrne-node';
const NIVELADOR = 'nivelador', PASACABLES = 'pasacables', TAPAS = 'tapa-abatible';
const CAJON = 'cajonera-movil', TORNILLERIA = 'tornilleria', ECOCROM = 'ecocrom';
const KG20 = 7.16;
const laminaKg = (m2) => m2 * KG20;
const mm = (v) => (v / 1000);

// Acabado de cubiertas/frentes melamínicos. Feather NO usa chapa.
const ACAB = {
  ABS: { insumo: 'melamina-19', suf: 'ABS', label: 'Melamina ABS 19' },
  TF: { insumo: 'membrana-pvc', suf: 'TF', label: 'Termoformado' },
  ecolegno: { insumo: 'laminado', suf: 'HPELABS', label: 'Ecolegno (HPL)' },
};
const FINISHES = [
  { id: 'ABS', label: 'Melamina ABS' },
  { id: 'TF', label: 'Termoformado' },
  { id: 'ecolegno', label: 'Ecolegno' },
];

// --- Codificadores de clave (esquema real de la guía) -----------------------
// Cubierta / estructura / bastidor frontal escritorio: [fondo][largo]
const FONDO_ESC = { 600: '2', 750: '7', 900: '3' };   // dígito de fondo frontal
const LARGO_ESC = { 1500: '5', 1800: '6' };           // dígito de largo frontal
// Cubierta / estructura / bastidor lateral (retorno): [fondoLat][largoLat]
const FONDO_LAT = { 600: '2', 400: '40' };
const LARGO_LAT = { 900: '3', 1050: '35', 1200: '4' };
// Bench: sufijo de módulo por largo de cubierta (1200/1500)
const COD_BENCH = { 1200: '24', 1500: '25' };
const DIG_BENCH = { 1200: '4', 1500: '5' };            // ductos FECDOBD4M/5M
// Biombo/conducto por largo de módulo: 600×300 (1200) / 900×300 (1500)
const COD_BIOMBO = { 1200: '21', 1500: '31' };
const COD_FALBS = { 1200: '421', 1500: '531' };        // faldón sencillo equipado
const BIOMBO_DIM = { 1200: { l: 600, a: 300 }, 1500: { l: 900, a: 300 } };

const num = (v, def) => parseInt(v, 10) || def;

// ---------------------------------------------------------------------------
export const FEATHER_PRODUCTOS = [
  {
    id: 'escritorio', nombre: 'Escritorio (en L)',
    selects: [
      { key: 'largo', label: 'Largo frente', opciones: [{ id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }] },
      { key: 'lado', label: 'Lateralidad', opciones: [{ id: 'der', label: 'Derecho' }, { id: 'izq', label: 'Izquierdo' }] },
      { key: 'retLargo', label: 'Largo retorno', opciones: [{ id: '900', label: '0.90 m' }, { id: '1050', label: '1.05 m' }, { id: '1200', label: '1.20 m' }] },
      { key: 'retFondo', label: 'Fondo retorno', opciones: [{ id: '600', label: '0.60 m' }, { id: '400', label: '0.40 m' }] },
    ],
    fondos: [600, 750, 900],
    finishes: FINISHES,
    checks: [
      { key: 'faldon', label: 'Faldón' },
      { key: 'cajon', label: 'Cajón colgante Accents' },
      { key: 'electrico', label: 'Start3 + acometida espiral' },
    ],
  },
  {
    id: 'bench_sencillo', nombre: 'Bench sencillo',
    selects: [
      { key: 'usuarios', label: 'Puestos', opciones: [{ id: '2', label: '2' }, { id: '3', label: '3' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'nivel', label: 'Nivel', opciones: [{ id: 'equipado', label: 'Equipado' }, { id: 'basico', label: 'Básico' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'biombo', label: 'Biombo acrílico 6mm' },
      { key: 'cajon', label: 'Cajón colgante Accents' },
      { key: 'electrico', label: 'Start3 (2 power + USB)' },
    ],
  },
  {
    id: 'bench_doble', nombre: 'Bench doble',
    selects: [
      { key: 'usuarios', label: 'Puestos', opciones: [{ id: '4', label: '4' }, { id: '6', label: '6' }, { id: '8', label: '8' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
      { key: 'nivel', label: 'Nivel', opciones: [{ id: 'equipado', label: 'Equipado' }, { id: 'basico', label: 'Básico' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'biombo', label: 'Biombo acrílico 6mm' },
      { key: 'cajon', label: 'Cajón colgante Accents' },
      { key: 'electrico', label: 'Start3 (2 power + USB)' },
    ],
  },
];

// ---------------------------------------------------------------------------
export function generarFeather(config) {
  const c = {
    producto: 'escritorio', largo: '1500', fondoMM: 600, lado: 'der',
    retLargo: '900', retFondo: '600', usuarios: '2', nivel: 'equipado',
    finish: 'ABS', biombo: false, faldon: false, cajon: false, electrico: false,
    ...config,
  };
  const a = ACAB[c.finish] || ACAB.ABS;
  const comp = [];
  const claves = [];
  const electricos = [];
  let tipoRender = 'escritorio', nombre = '';

  if (c.producto === 'escritorio') {
    tipoRender = 'escritorio';
    nombre = generarEscritorio(c, a, comp, claves, electricos);
  } else {
    tipoRender = 'bench';
    nombre = generarBench(c, a, comp, claves, electricos);
  }

  return {
    producto: c.producto, nombre, tipoRender,
    componentes: comp, claves, electricos,
    modoManoObra: 'porcentaje', factorDirecta: 36, factorIndirecta: 12,
    nota: 'Feather (Fase A): claves y dimensiones REALES de la guía GE_Feather. ' +
      'Escritorio modelado en L (frente + retorno con lateralidad izq/der). ' +
      'Bench por estructuras discretas (inicio/central-acometida/intermedia/cierre), ' +
      'nivel equipado vs básico como cambio estructural (tapas, ductos, acometida lateral). ' +
      'MP metálica estimada (PTR + pintura electrostática + lámina/ducto); tensor FECON38M ' +
      'aproximado con PTR redondo + acabado EcoCrome; tapas/cajón/guarda/Start3 costeados ' +
      'con insumos genéricos (tapa-abatible, cajonera-movil, byrne-node). Pendiente ' +
      'calibrar con lista de MP real y desarrollo exacto de cada estructura.',
  };
}

// --- ESCRITORIO en L -------------------------------------------------------
function generarEscritorio(c, a, comp, claves, electricos) {
  const largo = num(c.largo, 1500);
  const fondo = num(c.fondoMM, 600);
  const retLargo = num(c.retLargo, 900);
  const retFondo = num(c.retFondo, 600);
  const D = c.lado === 'izq' ? 'I' : 'D';               // lado de la estructura lateral
  const fEsc = FONDO_ESC[fondo] || '2';
  const lEsc = LARGO_ESC[largo] || '5';
  const fLat = FONDO_LAT[retFondo] || '2';
  const lLat = LARGO_LAT[retLargo] || '3';
  const codFrente = fEsc + lEsc;                         // p.ej. 25 = 600×1500
  const codLat = fLat + lLat;                            // p.ej. 23 = 600×900

  // 1) Cubierta frontal (área) + canto
  comp.push({ insumoId: a.insumo, nombre: `Cubierta frontal ${a.suf} ${largo}×${fondo}`, cantidad: 1, largoMM: largo, anchoMM: fondo });
  comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubierta frontal', cantidad: 2 * (mm(largo) + mm(fondo)) });
  claves.push(`FECUBESC${codFrente}${a.suf}`);

  // 2) Cubierta retorno lateral (área) + canto
  comp.push({ insumoId: a.insumo, nombre: `Cubierta retorno ${a.suf} ${retLargo}×${retFondo}`, cantidad: 1, largoMM: retLargo, anchoMM: retFondo });
  comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubierta retorno', cantidad: 2 * (mm(retLargo) + mm(retFondo)) });
  claves.push(`FECUBLAT${codLat}${a.suf}`);

  // 3) Estructura frontal (metal) FEESTESC[fondo][largo]M-A
  metalEstructura(comp, 'Estructura frontal escritorio (metal)', 2 * 0.72 + mm(fondo) + mm(largo), mm(largo) * mm(fondo) * 0.5);
  claves.push(`FEESTESC${codFrente}M-A`);
  // 4) Estructura lateral (metal, izq/der) FEESTLAT[D/I][fondoLat][largoLat]M-A
  metalEstructura(comp, `Estructura lateral escritorio ${D === 'D' ? 'derecha' : 'izquierda'} (metal)`, 2 * 0.72 + mm(retFondo) + mm(retLargo), mm(retLargo) * mm(retFondo) * 0.5);
  claves.push(`FEESTLAT${D}${codLat}M-A`);

  // 5) Bastidores (marco perimetral metálico 2.5cm)
  comp.push({ insumoId: PTR, nombre: 'Bastidor frontal (perimetral)', cantidad: 2 * (mm(largo) + mm(fondo)) });
  claves.push(`FEBASESC${codFrente}M`);
  comp.push({ insumoId: PTR, nombre: 'Bastidor lateral (perimetral)', cantidad: 2 * (mm(retLargo) + mm(retFondo)) });
  claves.push(`FEBASLAT${codLat}M`);

  // 6) Pata lateral (izq/der) FEPATLAT[I/D][fondoLat]M
  comp.push({ insumoId: PTR, nombre: `Pata lateral ${D === 'D' ? 'derecha' : 'izquierda'} ${retFondo}mm`, cantidad: 2 * 0.72 + mm(retFondo) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática pata lateral', cantidad: 0.72 * mm(retFondo) });
  claves.push(`FEPATLAT${D}${retFondo === 400 ? '40' : '60'}M`);

  // 7) Tensor/conector universal FECON38M (redondo Cold Rolled, EcoCrome, 45°)
  tensor(comp, claves, 2);

  // 8) Ducto pasacables metálico FECDOESCM
  comp.push({ insumoId: DUCTO, nombre: 'Ducto pasacables escritorio (metal)', cantidad: mm(largo) });
  claves.push('FECDOESCM');

  // 9) Niveladores TO38112CINIC
  comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores cromados', cantidad: 4 });

  // 10) Faldón FEFALESC5/6 (por largo del bastidor) + acabado (incluye AC acrílico)
  if (c.faldon) {
    const codF = largo === 1800 ? '6' : '5';
    if (c.finish === 'ecolegno' || c.finish === 'ABS' || c.finish === 'TF') {
      comp.push({ insumoId: a.insumo, nombre: `Faldón ${a.suf} ${largo}mm`, cantidad: 1, largoMM: largo, anchoMM: 337 });
      claves.push(`FEFALESC${codF}${a.suf}`);
    } else {
      comp.push({ insumoId: ACRIL, nombre: `Faldón acrílico ${largo}mm`, cantidad: 1, largoMM: largo, anchoMM: 337 });
      claves.push(`FEFALESC${codF}AC`);
    }
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería faldón', cantidad: 1 });
  }

  // 11) Cajón colgante Accents ACCAJESCM (+ tubo de ajuste si fondo 750/900)
  if (c.cajon) {
    comp.push({ insumoId: CAJON, nombre: 'Cajón colgante escritorio (Accents)', cantidad: 1 });
    claves.push('ACCAJESCM');
    if (fondo >= 750) { comp.push({ insumoId: PTR, nombre: 'Tubo de ajuste cajón (750/900)', cantidad: 0.5 }); claves.push('ACCAJESCTB'); }
    comp.push({ insumoId: PASACABLES, nombre: 'Lapicera plástica F815D', cantidad: 1 });
  }

  // 12) Eléctrico: Start3 + acometida espiral Mockett
  if (c.electrico) {
    comp.push({ insumoId: START3, nombre: 'Start3 (2 power / 1 USB / 1 data)', cantidad: 1 });
    comp.push({ insumoId: PASACABLES, nombre: 'Acometida espiral Mockett MACAWM34-90', cantidad: 1 });
    electricos.push('Start3 BESMSTRT21EM (2 power + USB) + acometida espiral MACAWM34-90 (aparte)');
  }

  return `Feather · Escritorio en L ${mm(largo).toFixed(2)}×${mm(fondo).toFixed(2)} m + retorno ${mm(retLargo).toFixed(2)} m (${D === 'D' ? 'der' : 'izq'}) · ${a.label}`;
}

// --- BENCH sencillo / doble ------------------------------------------------
function generarBench(c, a, comp, claves, electricos) {
  const doble = c.producto === 'bench_doble';
  const largo = num(c.largo, 1200);
  const fondo = 600;
  const equipado = c.nivel !== 'basico';
  const SUF = doble ? 'BD' : 'BS';
  const cod = COD_BENCH[largo] || '24';                  // 24/25
  const filas = doble ? 2 : 1;
  const nUs = num(c.usuarios, doble ? 4 : 2);
  const bahias = Math.max(1, Math.round(nUs / filas));   // puestos por fila
  const intermedias = Math.max(0, bahias - 2);           // inicio+acometida+cierre+intermedias

  // 1) Cubiertas (una por puesto) + canto
  comp.push({ insumoId: a.insumo, nombre: `Cubiertas ${a.suf} ${largo}×${fondo}`, cantidad: nUs, largoMM: largo, anchoMM: fondo });
  comp.push({ insumoId: CANTO, nombre: 'Canto perímetro cubiertas', cantidad: nUs * 2 * (mm(largo) + mm(fondo)) });
  claves.push(`FECUBBD${cod}`);

  // 2) Estructuras discretas por fila -------------------------------------
  // Inicio (constante) FEESTINBS-A / FEESTINBD-A
  metalEstructura(comp, 'Estructura de inicio', filas * (2 * 0.72 + mm(fondo) * filas), filas * 0.4);
  claves.push(`FEESTIN${SUF}-A`);
  // Cierre FEESTCIE[BS/BD][24/25]-A
  metalEstructura(comp, 'Estructura de cierre', filas * (2 * 0.72 + mm(fondo) * filas), filas * 0.4);
  claves.push(`FEESTCIE${SUF}${cod}-A`);
  // Intermedias FEESTPIN[BS/BD][24/25]-A + tapas de pata intermedia
  if (intermedias > 0) {
    metalEstructura(comp, 'Estructuras intermedias', intermedias * filas * (2 * 0.72 + mm(fondo) * filas), intermedias * filas * 0.4);
    claves.push(`FEESTPIN${SUF}${cod}-A`);
    comp.push({ insumoId: TAPAS, nombre: 'Juego de tapas pata intermedia', cantidad: intermedias });
    claves.push('FEJGTAPINBSBD');
  }
  // Central con acometida: equipado FEESTACOC* / básico FEESTACBSC*
  metalEstructura(comp, `Estructura central con acometida (${equipado ? 'equipada' : 'básica'})`, filas * (2 * 0.72 + mm(fondo) * filas + 0.6), filas * 0.5);
  comp.push({ insumoId: ACOMETIDA, nombre: 'Acometida central', cantidad: 1 });
  claves.push(equipado ? `FEESTACOC${SUF}${cod}-A` : `FEESTACBSC${SUF}${cod}-A`);

  // Acometida lateral FEACOLAM — SÓLO bench doble
  if (doble) {
    comp.push({ insumoId: ACOMETIDA, nombre: 'Acometida lateral (FEACOLAM)', cantidad: 1 });
    comp.push({ insumoId: LAMINA, nombre: 'Divisor/conducto acometida lateral (lámina)', cantidad: laminaKg(0.164 * 0.629 + 0.695 * 0.298) });
    claves.push('FEACOLAM');
  }

  // Tensores FECON38M (uno por unión de estructura)
  tensor(comp, claves, (bahias + 1) * filas);

  // 3) Niveladores (2 por estructura vertical)
  comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores cromados TO38112CINIC', cantidad: (bahias + 1) * filas * 2 });

  // 4) Ductos + biombos (por bahía) ---------------------------------------
  const bio = BIOMBO_DIM[largo] || BIOMBO_DIM[1200];
  if (equipado) {
    // Ducto equipado FECDOBD4M/5M (recibe soportes de biombo)
    comp.push({ insumoId: DUCTO, nombre: `Ducto equipado (metal) ${largo}mm`, cantidad: bahias * mm(largo) });
    claves.push(`FECDOBD${DIG_BENCH[largo] || '4'}M`);
    if (c.biombo) {
      // Biombo con soportes: FEBIOBD21AC/31AC (doble) o faldón FEFALBS421/531 (sencillo)
      comp.push({ insumoId: ACRIL, nombre: `Biombo acrílico 6mm ${bio.l}×${bio.a}`, cantidad: bahias, largoMM: bio.l, anchoMM: bio.a });
      comp.push({ insumoId: PTR, nombre: 'Soportes izq/der de biombo', cantidad: bahias * 0.6 });
      claves.push(doble ? `FEBIOBD${COD_BIOMBO[largo]}AC` : `FEFALBS${COD_FALBS[largo]}MAC`);
    }
  } else {
    // Básico: biombo/conducto integrado FECDOBOBY21MAC/31MAC (recibe arnés Byrne)
    comp.push({ insumoId: DUCTO, nombre: `Biombo/conducto pasacables básico ${largo}mm`, cantidad: bahias * mm(largo) });
    if (c.biombo) comp.push({ insumoId: ACRIL, nombre: `Biombo acrílico 6mm ${bio.l}×${bio.a}`, cantidad: bahias, largoMM: bio.l, anchoMM: bio.a });
    claves.push(`FECDOBOBY${COD_BIOMBO[largo]}MAC`);
    // Tapa universal de conducto FETPACDOCC
    comp.push({ insumoId: TAPAS, nombre: 'Tapa universal conducto (FETPACDOCC)', cantidad: bahias });
    claves.push('FETPACDOCC');
  }

  // 5) Juegos de tapas de acometida (cambio estructural por nivel) --------
  if (equipado) {
    comp.push({ insumoId: TAPAS, nombre: 'Juego de tapas vista laterales', cantidad: 1 });
    comp.push({ insumoId: TAPAS, nombre: 'Juego de tapas cableado (Byrne / convencional)', cantidad: 1 });
    claves.push(`FEJGTAPV${SUF}M`, `FEJGTAPBY${SUF}M`, `FEJGTAPCC${SUF}M`);
  } else {
    comp.push({ insumoId: TAPAS, nombre: 'Juego de tapas acometida básica', cantidad: 1 });
    claves.push('FEJGTAPVBSBDM');
  }

  // 6) Cajón colgante Accents ACCAJBCM (+ guarda / lapicera)
  if (c.cajon) {
    comp.push({ insumoId: CAJON, nombre: 'Cajón colgante bench (Accents ACCAJBCM)', cantidad: 1 });
    comp.push({ insumoId: PASACABLES, nombre: 'Lapicera plástica F815D', cantidad: 1 });
    claves.push('ACCAJBCM');
  }

  // 7) Eléctrico: Start3 sobre cubierta (uno por acometida/puesto de energía)
  if (c.electrico || equipado) {
    const nStart = doble ? filas : 1;
    comp.push({ insumoId: START3, nombre: 'Start3 (2 power / 1 USB / 1 data)', cantidad: nStart });
    comp.push({ insumoId: CAJA, nombre: 'Cableado / caja acometida', cantidad: 1 });
    electricos.push(`Start3 ${doble ? 'BESMSTRT21ZM' : 'BESMSTRT21EM'} ×${nStart} (2 power + USB) (aparte)`);
  }

  return `Feather · Bench ${doble ? 'doble' : 'sencillo'} ${nUs} puestos ${mm(largo).toFixed(2)} m · ${equipado ? 'equipado' : 'básico'} · ${a.label}`;
}

// --- Helpers ---------------------------------------------------------------
// Estructura metálica fabricada: PTR (metros) + pintura electrostática (m²).
function metalEstructura(comp, nombre, metrosPtr, m2Pintura) {
  comp.push({ insumoId: PTR, nombre, cantidad: Math.max(0.5, metrosPtr) });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostática ' + nombre.toLowerCase(), cantidad: Math.max(0.2, m2Pintura) });
}

// Tensor/conector universal FECON38M: redondo Cold Rolled Ø3/8", EcoCrome, 45°.
function tensor(comp, claves, n) {
  comp.push({ insumoId: PTR, nombre: 'Tensor/conector universal redondo Ø3/8" (FECON38M)', cantidad: n * 0.9 });
  comp.push({ insumoId: ECOCROM, nombre: 'Acabado EcoCrome tensores', cantidad: n * 0.9 * 0.03 });
  claves.push('FECON38M');
}
