// ============================================================================
//  GENERADOR ALBA · guia GE_Alba (ESP-DCC-IDP-003, v3.0). Escritorios y mesas
//  de inspiracion organica (segmento medio / medio-alto, entre Luna y Cirque).
//  Sistema flexible: patas + bases + guardas + cubiertas. Escritorios recta /
//  diagonal / trapecio, mesas de juntas 1800-5400, benches (5 familias),
//  Olga (multiusos ligera + circular), TeamSpace y mesa de trabajo alta.
//
//  CLAVES REALES prefijo AB + piezas Modulor (MO), Cirque (CI), Rio (RI),
//  Feather (FE), Via (VI) y Accents (AC). Sufijo de acabado por CUBIERTA:
//  ABS / TF / CH / HPELABS (Ecolegno). En FALDONES el Ecolegno es HPABS.
//  El sufijo numerico de las cubiertas es el INDICE de la guia (25=1500 recta,
//  26=1800 recta, 64/74/84 juntas, 24/25 bench por puesto), NO largo/60.
//  FASE A: dimensiones reales de la guia; MP estimada (falta lista real).
// ============================================================================

import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const CANTO = 'tapacanto';
const PATA = 'pata-metalica', PINTURA = 'pintura-electrostatica';
const CAJA = 'caja-electrica', ACOMETIDA = 'acometida';
const CHAROLA = 'charola', RIEL = 'riel', FALDON = 'faldon-abs';
const CRISTAL_BIO = 'cristal-satinado', CRISTAL_LAM = 'cristal-templado-12';
const mm = (v) => v / 1000;
const num = (v, def) => parseInt(v) || def;

// --- Acabados: insumo de cubierta por acabado + espesor -------------------
function cubInsumo(acab, thick) {
  if (acab === 'CH') return 'chapa-madera';
  if (acab === 'TF') return 'membrana-pvc';
  if (acab === 'HPELABS') return 'laminado';   // Ecolegno
  return thick <= 19 ? 'melamina-19' : 'melamina-28'; // ABS (melamina)
}
const labelAcab = { ABS: 'Melamina ABS', CH: 'Chapa', TF: 'Termoformado', HPELABS: 'Ecolegno' };
const faldonSuf = (acab) => (acab === 'HPELABS' ? 'HPABS' : acab); // faldones: Ecolegno = HPABS

const FINISHES = [
  { id: 'ABS', label: 'Melamina ABS' },
  { id: 'CH', label: 'Chapa' },
  { id: 'TF', label: 'Termoformado' },
  { id: 'HPELABS', label: 'Ecolegno' },
];

// ---------------------------------------------------------------------------
//  PRODUCTOS
// ---------------------------------------------------------------------------
const ALBA_PRODUCTOS_BASE = [
  {
    id: 'escritorio', nombre: 'Escritorio',
    selects: [
      { key: 'forma', label: 'Cubierta', opciones: [
        { id: 'recta', label: 'Recta' }, { id: 'diagonal', label: 'Diagonal' }, { id: 'trapecio', label: 'Trapecio' }] },
      { key: 'largo', label: 'Largo', opciones: [
        { id: '1500', label: '1.50 m (solo recta)' }, { id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m (diagonal/trapecio)' }] },
      { key: 'lado', label: 'Lateralidad', opciones: [{ id: 'D', label: 'Derecho' }, { id: 'I', label: 'Izquierdo' }] },
    ],
    finishes: FINISHES,
    checks: [
      { key: 'auxiliar', label: 'Cubierta auxiliar Modulor' },
      { key: 'archivero', label: 'Archivero Modulor (MOAC75)' },
      { key: 'librero', label: 'Librero Modulor (MOLIPR75)' },
      { key: 'zoclo', label: 'Zoclo Modulor' },
      { key: 'electrico', label: 'Caja electrica Via (VISOCAELC)' },
    ],
  },
  {
    id: 'mesa_juntas', nombre: 'Mesa de juntas',
    selects: [{ key: 'largo', label: 'Largo', opciones: [
      { id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m' }, { id: '2400', label: '2.40 m' },
      { id: '2700', label: '2.70 m' }, { id: '3300', label: '3.30 m' }, { id: '3600', label: '3.60 m' },
      { id: '4500', label: '4.50 m' }, { id: '5400', label: '5.40 m' }] }],
    finishes: FINISHES,
    checks: [{ key: 'electrico', label: 'Caja electrica Ellora + acometida' }],
  },
  {
    id: 'bench', nombre: 'Bench',
    selects: [
      { key: 'tipo', label: 'Familia', opciones: [
        { id: 'ind_sencillo', label: 'Individual sencillo' },
        { id: 'ind_doble', label: 'Individual doble' },
        { id: 'sencillo', label: 'Sencillo' },
        { id: 'doble', label: 'Doble' },
        { id: 'b120', label: '120 grados' }] },
      { key: 'usuarios', label: 'Puestos por hilera', opciones: [
        { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' }] },
      { key: 'largo', label: 'Largo por puesto', opciones: [{ id: '1200', label: '1.20 m' }, { id: '1500', label: '1.50 m' }] },
    ],
    finishes: FINISHES,
    checks: [{ key: 'biombo', label: 'Biombo (cristal)' }],
  },
  {
    id: 'olga_ligera', nombre: 'Mesa Multiusos Ligera "Olga"',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }] }],
    finishes: FINISHES,
    checks: [{ key: 'faldon', label: 'Faldon (uso escritorio)' }, { key: 'charola', label: 'Charola pasacables' }],
  },
  {
    id: 'olga', nombre: 'Mesa circular "Olga"',
    selects: [
      { key: 'diametro', label: 'Diametro', opciones: [{ id: '900', label: 'O 900' }, { id: '1050', label: 'O 1050' }, { id: '1200', label: 'O 1200' }] },
      { key: 'base', label: 'Base pedestal', opciones: [{ id: 'niveladores', label: 'Niveladores' }, { id: 'rodajas', label: 'Rodajas' }] },
    ],
    finishes: [...FINISHES, { id: 'CRLB', label: 'Cristal laminado (solo niveladores)' }],
  },
  {
    id: 'teamspace', nombre: 'TeamSpace Alba',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '2420', label: '2.42 m' }] }],
    finishes: FINISHES,
  },
  {
    id: 'mesa_alta', nombre: 'Mesa de trabajo alta',
    selects: [{ key: 'largo', label: 'Largo', opciones: [{ id: '1500', label: '1.50 m' }, { id: '1800', label: '1.80 m' }, { id: '2100', label: '2.10 m' }] }],
    finishes: FINISHES,
  },
];
// Colores reales de melamina para el selector. Alba varia el espesor segun
// pieza (cubInsumo(): thick<=19 -> melamina-19, si no -> melamina-28) — p.ej.
// el escritorio recta 1500mm usa melamina-19 (thick:18), mientras el resto de
// SUS PROPIAS combinaciones (1800/diagonal/trapecio) y TODOS los demas
// productos (mesa_juntas, bench, olga_ligera, olga, teamspace, mesa_alta) usan
// siempre thick:28 -> melamina-28. Espesor 28mm es el predominante en todo el
// catalogo Alba, asi que se usa como default razonable para los chips de color
// de los 7 productos (no hay por-producto exacto porque el espesor real
// depende de la combinacion de selects elegida en runtime, no del producto).
export const ALBA_PRODUCTOS = ALBA_PRODUCTOS_BASE.map((p) => ({ ...p, colores: coloresDe('melamina-28') }));

// ---------------------------------------------------------------------------
//  Helpers de despiece
// ---------------------------------------------------------------------------
function addCub(comp, claves, clave, acab, wMM, dMM, thick, nombre, cant) {
  cant = cant || 1;
  comp.push({ insumoId: cubInsumo(acab, thick), nombre: nombre + ' (' + acab + ')', cantidad: cant, largoMM: wMM, anchoMM: dMM });
  comp.push({ insumoId: CANTO, nombre: 'Canto ' + nombre, cantidad: cant * 2 * (mm(wMM) + mm(dMM)) });
  if (clave) claves.push(clave + acab);
}

function patasMetal(comp, n, nombre) {
  comp.push({ insumoId: PATA, nombre: nombre, cantidad: n });
  comp.push({ insumoId: PINTURA, nombre: 'Pintura electrostatica ' + nombre, cantidad: n, largoMM: 700, anchoMM: 660 });
  comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: n * 2 });
}

// ===========================================================================
//  ESCRITORIO
// ===========================================================================
const ESC = {
  recta: {
    pata: 'ABPATT160M', diag: false,
    med: {
      1500: { cub: 'ABCUB25', cubW: 1498, cubD: 598, thick: 18, faldW: 898, faldD: 216, faldSuf: '5' },
      1800: { cub: 'ABCUB26', cubW: 1800, cubD: 600, thick: 28, faldW: 1199, faldD: 201, faldSuf: '6' },
    },
    faldBase: 'ABFALBR', // + D/I + suf
  },
  diagonal: {
    pata: 'ABPAT75M', diag: true,
    med: {
      1800: { cubD_: 'ABCUBDD36', cubI_: 'ABCUBDI36', cubW: 1802, cubD: 983, thick: 28, faldSuf: '6', faldW: 1052, faldD: 218 },
      2100: { cubD_: 'ABCUBDD337', cubI_: 'ABCUBDI337', cubW: 2100, cubD: 1055, thick: 28, faldSuf: '7', faldW: 1357, faldD: 201 },
    },
    faldBase: 'ABFALB', // + D/I + suf
  },
  trapecio: {
    pata: 'ABPAT75M', diag: false,
    med: {
      1800: { cub: 'ABCUBTP6', cubW: 1800, cubD: 886, thick: 28, faldSuf: '6', faldW: 1052, faldD: 218 },
      2100: { cub: 'ABCUBTP7', cubW: 2100, cubD: 888, thick: 28, faldSuf: '7', faldW: 1357, faldD: 201 },
    },
    faldBase: 'ABFALB',
  },
};

function generarEscritorio(c, comp, claves, electricos) {
  const forma = ESC[c.forma] ? c.forma : 'recta';
  const spec = ESC[forma];
  // largos validos: recta 1500/1800 ; diagonal/trapecio 1800/2100
  let largo = num(c.largo, 1800);
  if (!spec.med[largo]) largo = forma === 'recta' ? 1800 : (largo === 2100 ? 2100 : 1800);
  if (!spec.med[largo]) largo = forma === 'recta' ? 1800 : 1800;
  const m = spec.med[largo];
  const acab = labelAcab[c.finish] ? c.finish : 'ABS';
  const lado = c.lado === 'I' ? 'I' : 'D';

  // Cubierta principal
  if (spec.diag) {
    const clave = lado === 'I' ? m.cubI_ : m.cubD_;
    addCub(comp, claves, clave, acab, m.cubW, m.cubD, m.thick, 'Cubierta diagonal ' + (lado === 'I' ? 'izquierda' : 'derecha') + ' Alba');
  } else {
    addCub(comp, claves, m.cub, acab, m.cubW, m.cubD, m.thick, 'Cubierta ' + forma + ' Alba');
  }

  // Cubierta auxiliar Modulor MOCUB45 I/D (1518 x 450 x 18) - opcional
  if (c.auxiliar) {
    addCub(comp, claves, null, acab, 1518, 450, 18, 'Cubierta auxiliar Modulor');
    claves.push('MOCUB45' + lado);
  }

  // Faldon con bastidor Alba (estructural) - D o I segun lateralidad
  const faldClave = spec.faldBase + lado + m.faldSuf + faldonSuf(acab);
  comp.push({ insumoId: FALDON, nombre: 'Faldon con bastidor Alba (' + (lado === 'I' ? 'izq' : 'der') + ')', cantidad: 1 });
  claves.push(faldClave);

  // Zoclo Modulor (1467 x 122 x 400 melamina) - opcional
  if (c.zoclo) {
    comp.push({ insumoId: 'melamina-19', nombre: 'Zoclo Modulor', cantidad: 1, largoMM: 1467, anchoMM: 400 });
    claves.push('MOLI75LZCLO');
  }

  // Pata Alba (recta ABPATT160M / diag-trap ABPAT75M)
  patasMetal(comp, 2, 'Pata Alba ' + spec.pata);
  claves.push(spec.pata);

  // Complementos Modulor comprados
  if (c.archivero) { comp.push({ insumoId: 'archivo-lateral', nombre: 'Archivero fijo 2 cajones Modulor', cantidad: 1 }); claves.push('MOAC75'); }
  if (c.librero) { comp.push({ insumoId: 'torre', nombre: 'Librero Modulor', cantidad: 1 }); claves.push('MOLIPR75'); }

  // Caja electrica Via
  if (c.electrico) {
    comp.push({ insumoId: CAJA, nombre: 'Caja electrica Via (400x190x165)', cantidad: 1 });
    claves.push('VISOCAELC');
    electricos.push('Caja electrica Via VISOCAELC (aparte)');
  }

  return {
    tipoRender: spec.diag || forma === 'trapecio' ? 'estacion' : 'escritorio',
    nombre: 'Alba · Escritorio ' + forma + ' ' + mm(largo).toFixed(2) + ' m (' + (lado === 'I' ? 'izq' : 'der') + ') · ' + labelAcab[acab],
  };
}

// ===========================================================================
//  MESA DE JUNTAS  (fondo 1200)
// ===========================================================================
const JUNTAS = {
  1800: { area: [1800, 1200], claves: ['ABCUB64'], patas: 2, base: 'ABACO40LP', riel: null },
  2100: { area: [2100, 1200], claves: ['ABCUB74'], patas: 2, base: 'ABACO40LP', riel: null },
  2400: { area: [2400, 1200], claves: ['ABCUB84'], patas: 2, base: 'ABACO40LP', riel: null },
  2700: { area: [2700, 1200], claves: ['ABCUB454', 'ABCUB454'], patas: 2, base: 'ABACO15M', riel: 'CITUBD' },
  3300: { area: [3300, 1200], claves: ['ABCUB440', 'ABCUB34', 'ABCUB440'], patas: 3, base: 'ABACO15M', riel: 'CIRPC4' },
  3600: { area: [3600, 1200], claves: ['ABCUB439', 'ABCUB44', 'ABCUB439'], patas: 3, base: 'ABACO15M', riel: 'CIRPC5' },
  4500: { area: [4500, 1200], claves: ['ABCUB438', 'ABCUB435', 'ABCUB435', 'ABCUB438'], patas: 4, base: 'ABACO40LP', riel: 'CIRPC4' },
  5400: { area: [5400, 1200], claves: ['ABCUB444', 'ABCUB3349', 'ABCUB335', 'ABCUB3349', 'ABCUB444'], patas: 4, base: 'ABACO15M', riel: 'CIRPC4' },
};

function generarMesaJuntas(c, comp, claves, electricos) {
  let largo = num(c.largo, 1800);
  if (!JUNTAS[largo]) largo = 1800;
  const j = JUNTAS[largo];
  const acab = labelAcab[c.finish] ? c.finish : 'ABS';
  const [w, d] = j.area;

  // Cubierta (una area total, todas las secciones al mismo acabado)
  comp.push({ insumoId: cubInsumo(acab, 28), nombre: 'Cubierta mesa de juntas (' + acab + ')', cantidad: 1, largoMM: w, anchoMM: d });
  comp.push({ insumoId: CANTO, nombre: 'Canto perimetro', cantidad: 2 * (mm(w) + mm(d)) });
  j.claves.forEach((k) => claves.push(k + acab));

  // Patas doble (ABPAT75M) + individual (ABPATIN75M)
  patasMetal(comp, j.patas, 'Pata doble Alba ABPAT75M');
  claves.push('ABPAT75M', 'ABPATIN75M');

  // Base acometida + caja Ellora
  comp.push({ insumoId: ACOMETIDA, nombre: 'Base acometida Alba (' + j.base + ')', cantidad: 1 });
  claves.push(j.base);
  if (j.riel) { comp.push({ insumoId: RIEL, nombre: 'Riel / tapa pasacables', cantidad: 1 }); claves.push(j.riel); }

  if (c.electrico) {
    comp.push({ insumoId: CAJA, nombre: 'Caja electrica Ellora', cantidad: largo >= 3300 ? 2 : 1 });
    electricos.push('Caja electrica Ellora (aparte)');
  }

  return { tipoRender: 'mesa', nombre: 'Alba · Mesa de juntas ' + mm(largo).toFixed(2) + ' m · ' + labelAcab[acab] };
}

// ===========================================================================
//  BENCH  (5 familias)
// ===========================================================================
function generarBench(c, comp, claves, electricos) {
  const tipo = ['ind_sencillo', 'ind_doble', 'sencillo', 'doble', 'b120'].includes(c.tipo) ? c.tipo : 'sencillo';
  let largo = num(c.largo, 1200);
  if (largo !== 1200 && largo !== 1500) largo = 1200;
  if (tipo === 'b120') largo = 1200;                 // 120 grados solo 1200
  const s = largo === 1500 ? '5' : '4';              // sufijo de pieza por largo (4=1200, 5=1500)
  const cs = largo === 1500 ? '25' : '24';           // sufijo de cubierta por puesto (24=1200, 25=1500)
  const N = Math.min(6, Math.max(2, num(c.usuarios, 2)));
  let acab = labelAcab[c.finish] ? c.finish : 'ABS';
  if (tipo === 'b120' && acab === 'CH') acab = 'ABS'; // 120 grados no tiene CH
  const biombo = !!c.biombo;
  const dep = 600, thick = 28;
  let nombre = '';

  if (tipo === 'ind_sencillo') {
    addCub(comp, claves, 'ABCUBINV' + cs, acab, largo, dep, thick, 'Cubierta individual sencillo');
    comp.push({ insumoId: PATA, nombre: 'Estructura con bastidor y 2 patas', cantidad: 1 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura estructura', cantidad: 1, largoMM: largo, anchoMM: 720 });
    comp.push({ insumoId: RIEL, nombre: 'Riel individual', cantidad: 1 });
    comp.push({ insumoId: CHAROLA, nombre: 'Charola / faldon pasacables', cantidad: mm(largo) });
    comp.push({ insumoId: 'pasacables', nombre: 'Espiral pasacables Mockett', cantidad: 1 });
    claves.push('ABESTBSIND' + s + '-A', 'ABRIECTBSIV' + s + 'M', 'ABFALBSIND' + s + 'M', 'FETAP91-BA');
    if (biombo) { comp.push({ insumoId: CRISTAL_BIO, nombre: 'Biombo cristal', cantidad: 1, largoMM: largo, anchoMM: 350 }); claves.push('ABBIO' + s + 'CRS'); }
    nombre = 'Bench individual sencillo ' + mm(largo).toFixed(2) + ' m';

  } else if (tipo === 'ind_doble') {
    addCub(comp, claves, 'ABCUBINV' + cs, acab, largo, dep, thick, 'Cubierta individual', 2);
    comp.push({ insumoId: PATA, nombre: 'Estructura banca doble individual', cantidad: 2 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura estructura', cantidad: 2, largoMM: largo, anchoMM: 720 });
    comp.push({ insumoId: RIEL, nombre: 'Riel individual doble', cantidad: 1 });
    comp.push({ insumoId: CHAROLA, nombre: 'Charola pasacables', cantidad: mm(largo) });
    comp.push({ insumoId: 'pasacables', nombre: 'Espiral pasacables Mockett', cantidad: 1 });
    claves.push('ABESTBDIND' + s + '-A', 'ABRIECTBDIV' + s + 'M', 'ABCHATBDBF' + s + 'M', 'FETAP91-BA', 'ABTAPBDBFM');
    if (biombo) { comp.push({ insumoId: CRISTAL_BIO, nombre: 'Biombo cristal', cantidad: 1, largoMM: largo, anchoMM: 350 }); claves.push('ABBIO' + s + 'CRS'); }
    nombre = 'Bench individual doble ' + mm(largo).toFixed(2) + ' m';

  } else if (tipo === 'sencillo' || tipo === 'doble') {
    const rows = tipo === 'doble' ? 2 : 1;
    const centrales = Math.max(0, N - 2);
    // Cubiertas segmentadas por hilera: izquierda + centrales + derecha
    addCub(comp, claves, 'ABCUBI' + cs, acab, largo, dep, thick, 'Cubierta izquierda', rows);
    if (centrales > 0) addCub(comp, claves, 'ABCUBC' + cs, acab, largo, dep, thick, 'Cubierta central', rows * centrales);
    addCub(comp, claves, 'ABCUBD' + cs, acab, largo, dep, thick, 'Cubierta derecha', rows);
    // Bastidores Feather (uno por puesto por hilera)
    comp.push({ insumoId: PATA, nombre: 'Bastidores Feather', cantidad: rows * N });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura estructura', cantidad: rows * N, largoMM: largo, anchoMM: 720 });
    claves.push('FEBAS' + cs + 'M');
    // Patas
    if (tipo === 'sencillo') {
      patasMetal(comp, N + 1, 'Patas bench sencillo');
      claves.push('ABPATBSBFI60M', 'ABPATBSBFD60M', 'ABPATINBFBS');
      comp.push({ insumoId: ACOMETIDA, nombre: 'Base acometida bench sencillo', cantidad: 1 });
      claves.push('ABACOBSBF24M');
      claves.push('ABRIECTINS' + s + 'M', 'ABRIECTCES' + s + 'M', 'ABRIECTINSD' + s + 'M');
    } else {
      patasMetal(comp, N + 1, 'Patas dobles bench');
      claves.push('ABPABD75M', 'ABPATINBFBD');
      comp.push({ insumoId: ACOMETIDA, nombre: 'Base acometida bench doble', cantidad: 1 });
      claves.push('ABACOBDBF24M');
      claves.push('ABRIECTIN' + s + 'M', 'ABRIECTCE' + s + 'M');
    }
    // Rieles + charolas pasacables
    comp.push({ insumoId: RIEL, nombre: 'Rieles pasacables', cantidad: rows * N });
    comp.push({ insumoId: CHAROLA, nombre: 'Charolas pasacables', cantidad: rows * N * mm(largo) });
    // Biombos: uno por puesto por hilera + uniones
    if (biombo) {
      comp.push({ insumoId: CRISTAL_BIO, nombre: 'Biombos cristal', cantidad: rows * N, largoMM: largo, anchoMM: 350 });
      claves.push(tipo === 'sencillo' ? 'ABBIO' + s + 'CR' : 'ABBIO' + s + 'CRS', 'ABBIOUNIM');
    }
    nombre = 'Bench ' + (tipo === 'doble' ? 'doble' : 'sencillo') + ' ' + N + ' puestos' + (tipo === 'doble' ? ' x2' : '') + ' ' + mm(largo).toFixed(2) + ' m';

  } else { // b120
    addCub(comp, claves, 'ABCUB120C2R', acab, 2075, 1095, thick, 'Cubierta 120 dos radios');
    addCub(comp, claves, 'ABCUB120RD', acab, 1095, 1095, thick, 'Cubierta 120 radio derecho');
    addCub(comp, claves, 'ABCUB120RI', acab, 1095, 1095, thick, 'Cubierta 120 radio izquierdo');
    comp.push({ insumoId: PATA, nombre: 'Bastidor 120 + patas dobles', cantidad: 3 });
    comp.push({ insumoId: PINTURA, nombre: 'Pintura estructura', cantidad: 3, largoMM: 1200, anchoMM: 720 });
    comp.push({ insumoId: ACOMETIDA, nombre: 'Pata acometida 120', cantidad: 1 });
    comp.push({ insumoId: CHAROLA, nombre: 'Charola pasacables', cantidad: 1.2 });
    claves.push('ABBAS120M', 'ABPABD75M', 'ABACOT120M', 'ABCHATBDBF4M', 'FETAP91-BA');
    if (biombo) { comp.push({ insumoId: CRISTAL_BIO, nombre: 'Biombo cristal', cantidad: 1, largoMM: 1200, anchoMM: 350 }); claves.push('ABBIO4CRS'); }
    nombre = 'Bench 120 grados 3 puestos 1.20 m';
  }

  electricos.push('Acometida bench integrada (contactos aparte)');
  return { tipoRender: 'bench', nombre: 'Alba · ' + nombre + ' · ' + labelAcab[acab] };
}

// ===========================================================================
//  OLGA LIGERA  (multiusos ligera / trabajo)
// ===========================================================================
function generarOlgaLigera(c, comp, claves, electricos) {
  let largo = num(c.largo, 1500);
  if (largo !== 1500 && largo !== 1800) largo = 1500;
  const acab = labelAcab[c.finish] ? c.finish : 'ABS';
  const s = largo === 1800 ? '6' : '5';
  // Base metalica ABPATTO5M/6M
  patasMetal(comp, 1, 'Base multiusos ligera Alba');
  claves.push('ABPATTO' + s + 'M');
  // Cubierta (mesa de trabajo Alba)
  addCub(comp, claves, 'ABCUB' + (largo === 1800 ? '64' : '54'), acab, largo, 750, 28, 'Cubierta multiusos ligera');
  if (c.faldon) { comp.push({ insumoId: FALDON, nombre: 'Faldon (uso escritorio)', cantidad: 1 }); claves.push('ABFALPTO' + s + 'EP'); }
  if (c.charola) {
    comp.push({ insumoId: CHAROLA, nombre: 'Charola pasacables', cantidad: mm(largo) });
    comp.push({ insumoId: 'pasacables', nombre: 'Espiral pasacables Mockett', cantidad: 1 });
    claves.push('ABCHAMAT');
  }
  return { tipoRender: 'mesa', nombre: 'Alba · Multiusos ligera "Olga" ' + mm(largo).toFixed(2) + ' m · ' + labelAcab[acab] };
}

// ===========================================================================
//  OLGA CIRCULAR  (pedestal central; cristal solo con niveladores)
// ===========================================================================
const OLGA_CIRC = {
  900: { melam: { ABS: 'CICUMJC3ABSOPG', TF: 'CICUMJC3TFOPG', CH: 'CICUMJC3CHOPG' }, cristal: 'CUCRC9LB', hpel: 'CICUMJC3HPELABSOPG' },
  1050: { melam: { ABS: 'ABCUBC35ABS', TF: 'ABCUBC35TF', CH: 'ABCUBC35CH' }, cristal: 'ABCUBC35CRLB', hpel: 'ABCUBC35HPELABS' },
  1200: { melam: { ABS: 'CICC4ABSOPG', TF: 'CICC4TFOPG', CH: 'CICC4CHOPG' }, cristal: 'ABCUB4CRLB', hpel: 'CICC4HPELABSOPG' },
};

function generarOlga(c, comp, claves, electricos) {
  let d = num(c.diametro, 900);
  if (![900, 1050, 1200].includes(d)) d = 900;
  const conf = OLGA_CIRC[d];
  let acab = c.finish;
  let base = c.base === 'rodajas' ? 'rodajas' : 'niveladores';
  // Restriccion: cristal laminado NUNCA con rodajas
  if (acab === 'CRLB' && base === 'rodajas') base = 'niveladores';
  if (!['ABS', 'TF', 'CH', 'HPELABS', 'CRLB'].includes(acab)) acab = 'ABS';

  // Base pedestal central Alba (645 x 715 x 645)
  comp.push({ insumoId: 'pedestal', nombre: 'Base pedestal central Alba', cantidad: 1 });
  if (base === 'rodajas') { comp.push({ insumoId: 'rodaja', nombre: 'Rodajas', cantidad: 4 }); claves.push('ALPAINME4'); }
  else { comp.push({ insumoId: 'nivelador', nombre: 'Niveladores', cantidad: 4 }); claves.push('ALPAINME4NIV'); }
  comp.push({ insumoId: PINTURA, nombre: 'Pintura base', cantidad: 1, largoMM: 645, anchoMM: 645 });

  // Cubierta circular
  const areaW = d, areaD = d; // el motor calcula area rectangular; circular ~ se ajusta en calibracion
  if (acab === 'CRLB') {
    comp.push({ insumoId: CRISTAL_LAM, nombre: 'Cubierta circular cristal laminado', cantidad: 1, largoMM: areaW, anchoMM: areaD });
    claves.push(conf.cristal);
  } else if (acab === 'HPELABS') {
    comp.push({ insumoId: 'laminado', nombre: 'Cubierta circular Ecolegno', cantidad: 1, largoMM: areaW, anchoMM: areaD });
    claves.push(conf.hpel);
  } else {
    comp.push({ insumoId: cubInsumo(acab, 28), nombre: 'Cubierta circular (' + acab + ')', cantidad: 1, largoMM: areaW, anchoMM: areaD });
    claves.push(conf.melam[acab] || conf.melam.ABS);
  }
  comp.push({ insumoId: CANTO, nombre: 'Canto perimetro circular', cantidad: Math.PI * mm(d) });

  return { tipoRender: 'mesa', nombre: 'Alba · Circular "Olga" O ' + d + ' · base ' + base + ' · ' + (labelAcab[acab] || 'Cristal laminado') };
}

// ===========================================================================
//  TEAMSPACE ALBA (Alba + Rio): mesa alta con pantalla
// ===========================================================================
function generarTeamSpace(c, comp, claves, electricos) {
  const acab = labelAcab[c.finish] ? c.finish : 'ABS';
  addCub(comp, claves, null, acab, 2420, 1200, 28, 'Cubierta TeamSpace (Rio)');
  claves.push('RIMJCUBIN');
  patasMetal(comp, 2, 'Pata alta Alba ABPATA90M');
  claves.push('ABPATA90M');
  comp.push({ insumoId: ACOMETIDA, nombre: 'Base acometida Alba', cantidad: 1 });
  claves.push('ABACOM60');
  comp.push({ insumoId: PATA, nombre: 'Soporte pantalla Accents (CPPMT55)', cantidad: 1 });
  comp.push({ insumoId: CHAROLA, nombre: 'Charola pasacables Rio', cantidad: 0.4 });
  comp.push({ insumoId: RIEL, nombre: 'Riel pasacables Rio', cantidad: 1 });
  claves.push('ACPPMT55', 'RICHA40', 'RICHPC5');
  electricos.push('Pantalla 55" + contactos (aparte, GE_Accents)');
  return { tipoRender: 'mesa', nombre: 'Alba · TeamSpace 2.42 m · ' + labelAcab[acab] };
}

// ===========================================================================
//  MESA DE TRABAJO ALTA
// ===========================================================================
const MALTA = {
  1500: { pata: 'ABPATTO90DO', cub: 'ABCUB54' },
  1800: { pata: 'ABPATTO90RE', cub: 'ABCUB46' },
  2100: { pata: 'ABPATTO90MI', cub: 'ABCUB47' },
};

function generarMesaAlta(c, comp, claves, electricos) {
  let largo = num(c.largo, 1500);
  if (!MALTA[largo]) largo = 1500;
  const m = MALTA[largo];
  const acab = labelAcab[c.finish] ? c.finish : 'ABS';
  patasMetal(comp, 2, 'Pata mesa alta Alba ' + m.pata);
  claves.push(m.pata);
  addCub(comp, claves, m.cub, acab, largo, 750, 28, 'Cubierta mesa alta Alba');
  comp.push({ insumoId: PATA, nombre: 'Porta pantalla TeamSpace (TSPTPMTA5545M)', cantidad: 1 });
  comp.push({ insumoId: 'pasacables', nombre: 'Espiral pasacables Mockett', cantidad: 1 });
  claves.push('TSPTPMTA5545M');
  electricos.push('Start Byrne BESMSTRT22 + espiral MACAWM34-90 (aparte)');
  return { tipoRender: 'mesa', nombre: 'Alba · Mesa de trabajo alta ' + mm(largo).toFixed(2) + ' m · ' + labelAcab[acab] };
}

// ===========================================================================
//  DISPATCHER
// ===========================================================================
export function generarAlba(config) {
  const c = {
    producto: 'escritorio', forma: 'recta', largo: '1800', lado: 'D',
    tipo: 'sencillo', usuarios: '2', diametro: '900', base: 'niveladores',
    finish: 'ABS', auxiliar: false, archivero: false, librero: false,
    zoclo: false, electrico: false, biombo: false, faldon: false, charola: false,
    ...config,
  };
  const comp = [], claves = [], electricos = [];
  let res;

  if (c.producto === 'mesa_juntas') res = generarMesaJuntas(c, comp, claves, electricos);
  else if (c.producto === 'bench') res = generarBench(c, comp, claves, electricos);
  else if (c.producto === 'olga_ligera') res = generarOlgaLigera(c, comp, claves, electricos);
  else if (c.producto === 'olga') res = generarOlga(c, comp, claves, electricos);
  else if (c.producto === 'teamspace') res = generarTeamSpace(c, comp, claves, electricos);
  else if (c.producto === 'mesa_alta') res = generarMesaAlta(c, comp, claves, electricos);
  else res = generarEscritorio(c, comp, claves, electricos);

  return aplicarColor({
    producto: c.producto, nombre: res.nombre, tipoRender: res.tipoRender,
    componentes: comp, claves, electricos,
    // ⚠️ 2026-08-19: aquí vivían `factorDirecta: 38, factorIndirecta: 12` — un
    // blend PLANO igual para cubierta/metal/cristal. El guardián de jerarquía
    // (scripts/revisa-jerarquia.mjs) cazó la mesa de juntas de Alba a 0.42× de
    // su objetivo: es metal/acometida en su mayoría, y el 38/12 plano la
    // subvalúa contra lo que SÍ le toca por `formulaAlba.js` (metal: 20% MO +
    // GI 3×MO = 80% de recargo, contra el 50% del blend). La fórmula de Alba
    // por tipo de material (commit 5966d59) YA estaba escrita y probada al
    // centavo (`formulaAlba.test.js`, `calculo.test.js`), pero nunca llegaba a
    // un Alba real: `calculo.js` sólo la usa cuando la pieza NO trae
    // `factorDirecta`/`factorIndirecta` fijos (`usaFactoresExplicitos`), y
    // esta función se los fijaba SIEMPRE. Se quitan para que el "enchufe" sea
    // de verdad — `modoManoObra: 'porcentaje'` basta para que
    // `manoObraGiAlba()` calcule por tipo de insumo.
    modoManoObra: 'porcentaje',
    nota: 'Alba (Fase A): dimensiones y claves reales de la guia GE_Alba (ESP-DCC-IDP-003 v3). ' +
      'Cubiertas con acabado ABS/CH/TF/HPELABS (Ecolegno=laminado); faldones Ecolegno=HPABS. ' +
      'MP estimada: faldon con bastidor -> faldon-abs; patas/estructuras/bastidores/rieles metalicos -> ' +
      'pata-metalica + pintura-electrostatica; base acometida -> acometida; biombo -> cristal-satinado; ' +
      'cristal laminado Olga -> cristal-templado-12; librero MOLIPR75 -> torre; archivero MOAC75 -> archivo-lateral; ' +
      'zoclo/cubierta auxiliar Modulor -> melamina board. Falta calibrar con lista de MP real y desarrollo exacto ' +
      'de patas Alba, cubiertas diagonal/trapecio, benches segmentados y cubiertas circulares Olga.',
  }, c);
}
