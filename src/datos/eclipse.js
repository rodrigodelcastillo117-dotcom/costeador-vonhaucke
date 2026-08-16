// ============================================================================
//  GENERADOR PARAMÉTRICO ECLIPSE  ·  guía oficial ESP-DCC-IDP-003 (Eclipse)
//  Línea ejecutiva de alto nivel: chapa de madera (y Walnut Burl c/poro sellado),
//  EcoPiel automotriz, herrajes Blum, cerradura Stealthlock. Construcción
//  DISTINTA a App LT: NO es melamina + PTR, es EBANISTERÍA (carcasas de chapa
//  sobre tablero, cajonería con correderas, puertas con bisagras).
//
//  CORRECCIÓN CLAVE (auditoría): el "Escritorio Directivo/Cantilever" NO es una
//  cubierta sobre base metálica; es una CREDENZA BAJA completa (2 archiveros +
//  2 lapiceros + 2 puertas abatibles, con laterales/respaldo/piso/techo/divisor/
//  entrepaños) + FALDÓN PEDESTAL + CUBIERTA de trabajo + CONDUCTO pasa-cables +
//  preparación para CAJA ELÉCTRICA. Ese cuerpo credenza es el grueso de la MP y
//  de la carpintería; omitirlo daba costos ~5× por debajo. Aquí se modela todo.
//
//  Motor: los componentes con largoMM+anchoMM se cobran por ÁREA (m²) × `piezas`.
//  Por eso cada panel lleva `piezas` (conteo real de tableros) además de
//  `cantidad` (para despliegue). Los herrajes/piezas van por `cantidad` en su
//  unidad. La caja eléctrica se pide/cotiza por separado → va en `electricos`.
// ============================================================================

// --- Insumos (SOLO ids válidos del catálogo) --------------------------------
const CHAPA = 'chapa-madera';          // tablero enchapado en chapa de madera
const WALNUT = 'chapa-walnut';         // opción Walnut Burl c/poro sellado
const CANTO = 'tapacanto';             // canto (m)
const ECOPIEL = 'ecopiel';             // tapicería EcoPiel automotriz (m)
const ESPUMA = 'espuma';               // espuma bajo la tapicería (m2)
const CORREDERA = 'corredera';         // correderas Blum tándem 30kg (par)
const BISAGRA = 'bisagra';             // bisagras Blum 170° Blumotion (pza)
const JALADERA = 'jaladera';           // jaladera de piel natural (pza)
const CERRADURA = 'cerradura-electronica'; // Stealthlock (pza)
const NIVELADOR = 'nivelador';         // niveladores (pza)
const CRISTAL = 'cristal-templado-12'; // refuerzos/cubierta de cristal (m2) — real 19mm
const DUCTO = 'ducto';                 // conducto pasa-cables (m)
const BASE_MOTOR = 'base-motorizada';  // base eléctrica altura regulable (pza)
const RIEL = 'riel';                   // rieles mesa regulable (juego)
const ESCUADRA = 'escuadra';           // placas de unión (pza)
const TORNILLERIA = 'tornilleria';     // tornillería incluida (juego)

// --- Horas de referencia (Eclipse = ebanistería, muy intensiva en carpintería)
const HORAS = {
  escritorio:         { pm: 4, carpinteria: 48, pintura: 8, acabados: 16, tapiceria: 8 },
  cantilever:         { pm: 4, carpinteria: 46, pintura: 8, acabados: 16, tapiceria: 8 },
  qvadrat:            { pm: 3, carpinteria: 24, pintura: 5, acabados: 9, tapiceria: 4 },
  credenza_modulable: { pm: 4, carpinteria: 44, pintura: 7, acabados: 14, tapiceria: 6 },
  credenza:           { pm: 3, carpinteria: 34, pintura: 6, acabados: 10, tapiceria: 3 },
  credenza_vertical:  { pm: 2, carpinteria: 22, pintura: 5, acabados: 8, tapiceria: 0 },
  gaveta:             { pm: 2, carpinteria: 16, pintura: 4, acabados: 6, tapiceria: 0 },
  mesa_juntas:        { pm: 3, carpinteria: 26, pintura: 5, acabados: 9, tapiceria: 4 },
  mesa_consejo:       { pm: 6, carpinteria: 48, pintura: 8, acabados: 14, tapiceria: 6 },
  mesa_regulable:     { pm: 2, carpinteria: 14, pintura: 4, acabados: 6, tapiceria: 3 },
  mesa_apoyo:         { pm: 1, carpinteria: 8, pintura: 2, acabados: 3, tapiceria: 0 },
};

// --- Selects reutilizables --------------------------------------------------
const CH_WB = [{ id: 'chapa', label: 'Chapa de madera' }, { id: 'walnut', label: 'Chapa Walnut Burl' }];
const MANO = { key: 'mano', label: 'Mano', opciones: [{ id: 'D', label: 'Derecha' }, { id: 'I', label: 'Izquierda' }] };
const EL = { key: 'electrico', label: 'Preparación caja eléctrica' };

export const ECLIPSE_PRODUCTOS = [
  { id: 'escritorio', nombre: 'Escritorio Directivo', largos: [2100, 2400], finishes: CH_WB, selects: [MANO], checks: [EL] },
  { id: 'cantilever', nombre: 'Escritorio Cantilever', largos: [2100, 2400], finishes: CH_WB, selects: [MANO], checks: [EL] },
  { id: 'qvadrat', nombre: 'Escritorio Qvadrat', largos: [1200, 1500, 1800], finishes: CH_WB, checks: [EL] },
  { id: 'credenza_modulable', nombre: 'Escritorio Credenza Modulable', largos: [1800, 2100, 2400], finishes: CH_WB, selects: [MANO] },
  { id: 'credenza', nombre: 'Credenza (baja)', largos: [2100, 2400], fondos: [600], finishes: CH_WB, selects: [MANO], checks: [EL] },
  {
    id: 'credenza_vertical', nombre: 'Credenza puertas verticales', finishes: CH_WB,
    selects: [{ key: 'puertas', label: 'Puertas', opciones: [{ id: '2', label: '2 puertas' }, { id: '3', label: '3 puertas' }, { id: '4', label: '4 puertas' }, { id: '6', label: '6 puertas' }] }],
  },
  {
    id: 'gaveta', nombre: 'Guardas / Gavetas', finishes: CH_WB,
    selects: [{ key: 'guarda', label: 'Tipo', opciones: [{ id: 'gaveta', label: 'Gaveta fija (2 cajones)' }, { id: 'guardarropa', label: 'Guardarropa' }, { id: 'armario', label: 'Armario 2 puertas' }] }],
  },
  {
    id: 'mesa_juntas', nombre: 'Mesa de juntas modular', largos: [900, 1200, 1500, 1800], finishes: CH_WB,
    selects: [{ key: 'forma', label: 'Cubierta', opciones: [{ id: 'cuadrada', label: 'Cuadrada' }, { id: 'redonda', label: 'Redonda' }] }], checks: [EL],
  },
  {
    id: 'mesa_consejo', nombre: 'Mesa de consejo modular', largos: [1500, 1800], finishes: CH_WB,
    selects: [{ key: 'consejo', label: 'Módulo', opciones: [{ id: 'recta', label: 'Recta' }, { id: 'esquinera', label: 'Esquinera' }] }], checks: [EL],
  },
  { id: 'mesa_regulable', nombre: 'Mesa de altura regulable', finishes: CH_WB },
  {
    id: 'mesa_apoyo', nombre: 'Mesa de apoyo',
    selects: [{ key: 'modelo', label: 'Modelo', opciones: [{ id: 'lateral', label: 'Lateral 60×60×60 (cristal)' }, { id: 'lateral_g', label: 'Lateral 60×90×60 (cristal)' }, { id: 'circular', label: 'Circular Ø60×60 (cristal)' }, { id: 'centro', label: 'Centro 60×60×40 (cristal)' }, { id: 'centro_g', label: 'Centro 120×120×40' }] }],
  },
];

// --- Tablas de medida/clave -------------------------------------------------
const IDX_FRONT = { 2100: '87', 2400: '88' };   // Directivo / Cantilever
const IDX_SQ = { 900: '33', 1200: '44', 1500: '55', 1800: '66' }; // Qvadrat / Juntas cuadrada
const IDX_ROUND = { 900: '3', 1200: '4', 1500: '5', 1800: '6' };  // Juntas redonda (ECMJMC)
const IDX_CONS = { 1500: '57', 1800: '67' };     // Consejo recto ECMCM
const IDX_CONS_ESQ = { 1500: '57', 1800: '86' }; // Consejo esquinera ECMC3Q

const VERT = {
  2: { L: 1500, F: 450, A: 750, clave: 'ECCR375CH', puertas: 2, entrepanos: 2 },
  3: { L: 1800, F: 450, A: 750, clave: 'ECCR475CH', puertas: 3, entrepanos: 0 },
  4: { L: 2100, F: 450, A: 750, clave: 'ECCR575CH', puertas: 4, entrepanos: 2 },
  6: { L: 2100, F: 350, A: 900, clave: 'ECCR675CH', puertas: 6, entrepanos: 3 },
};
const GUARDA = {
  gaveta:      { nombre: 'Gaveta fija 2 cajones', L: 750, F: 600, A: 750, clave: 'ECG2CA75CH', cajones: 2, puertas: 0, entrepanos: 0 },
  guardarropa: { nombre: 'Guardarropa 2 cajones', L: 750, F: 600, A: 1050, clave: 'ECGR100CH', cajones: 2, puertas: 2, entrepanos: 2 },
  armario:     { nombre: 'Armario 2 puertas 4 entrepaños', L: 750, F: 600, A: 1250, clave: 'ECGR1002ECH', cajones: 0, puertas: 2, entrepanos: 4 },
};
const APOYO = {
  lateral:   { nombre: 'Mesa lateral', L: 600, F: 600, A: 600, clave: 'ECMLR22CHV', cristal: true },
  lateral_g: { nombre: 'Mesa lateral', L: 600, F: 900, A: 600, clave: 'ECMLR32CHV', cristal: true },
  circular:  { nombre: 'Mesa circular', L: 600, F: 600, A: 600, clave: 'ECMLC2CH', cristal: true },
  centro:    { nombre: 'Mesa de centro', L: 600, F: 600, A: 400, clave: 'ECMC22CH', cristal: true },
  centro_g:  { nombre: 'Mesa de centro grande', L: 1200, F: 1200, A: 400, clave: 'ECMC44CH', cristal: false },
};

// --- Helpers de despiece ----------------------------------------------------
const perim = (l, a) => +(((2 * (l + a)) / 1000)).toFixed(3);
const r3 = (x) => +Number(x).toFixed(3);

// Panel de chapa (tablero por ÁREA) + su canto. `piezas` cuenta los tableros.
function panel(nombre, largoMM, anchoMM, cant = 1, mat = CHAPA) {
  return [
    { insumoId: mat, nombre, cantidad: cant, piezas: cant, largoMM: Math.round(largoMM), anchoMM: Math.round(anchoMM) },
    { insumoId: CANTO, nombre: `Canto · ${nombre}`, cantidad: r3(perim(largoMM, anchoMM) * cant) },
  ];
}

// Tapicería EcoPiel sobre un área (m²). EcoPiel se surte por metro lineal
// (rollo ~1.40 m) → m lineales = área / 1.40; espuma va por m².
function tapiceria(nombre, areaM2) {
  return [
    { insumoId: ECOPIEL, nombre: `${nombre} · EcoPiel`, cantidad: r3(areaM2 / 1.4) },
    { insumoId: ESPUMA, nombre: `${nombre} · espuma`, cantidad: r3(areaM2) },
  ];
}

// Carcasa (laterales + respaldo + piso + techo) de un cuerpo.
function carcasa(pfx, L, F, A, mat) {
  return [
    ...panel(`${pfx} · lateral`, F, A, 2, mat),
    ...panel(`${pfx} · respaldo`, L, A, 1, mat),
    ...panel(`${pfx} · piso/techo`, L, F, 2, mat),
  ];
}
function entrepanos(pfx, L, F, n, mat) {
  return n > 0 ? panel(`${pfx} · entrepaño`, Math.max(100, L - 30), Math.max(100, F - 30), n, mat) : [];
}
// n cajones (frente + costados + fondo + base) con correderas y jaladera.
function cajones(pfx, ancho, F, n, mat) {
  if (n <= 0) return [];
  return [
    ...panel(`${pfx} · frente de cajón`, ancho, 240, n, mat),
    ...panel(`${pfx} · costado de cajón`, F, 200, n * 2, mat),
    ...panel(`${pfx} · fondo/base de cajón`, ancho, F, n, mat),
    { insumoId: CORREDERA, nombre: `${pfx} · correderas Blum tándem 30kg`, cantidad: n },
    { insumoId: JALADERA, nombre: `${pfx} · jaladeras de piel`, cantidad: n },
  ];
}
// n puertas verticales/abatibles (ancho×alto) con bisagras Blum y jaladera.
function puertas(pfx, ancho, alto, n, mat, abatible = false) {
  if (n <= 0) return [];
  return [
    ...panel(`${pfx} · puerta ${abatible ? 'abatible' : 'vertical'}`, ancho, alto, n, mat),
    { insumoId: BISAGRA, nombre: `${pfx} · bisagras Blum 170° Blumotion`, cantidad: n * 2 },
    { insumoId: JALADERA, nombre: `${pfx} · jaladeras de piel`, cantidad: n },
  ];
}
// Pedestal-cubo de madera (base voluminosa de mesas de juntas/consejo).
function pedestalCubo(pfx, ancho, fondo, alto, mat) {
  return [
    ...carcasa(pfx, ancho, fondo, alto, mat),
    ...panel(`${pfx} · tapa`, 152, 152, 2, mat),
  ];
}

export function generarEclipse(config) {
  const c = {
    finish: 'chapa', mano: 'D', electrico: false, forma: 'cuadrada',
    consejo: 'recta', puertas: '2', guarda: 'gaveta', modelo: 'lateral',
    fondoMM: 600, ...config,
  };
  const mat = c.finish === 'walnut' ? WALNUT : CHAPA;
  const manoTxt = c.mano === 'I' ? 'Izquierda' : 'Derecha';
  const M = c.mano === 'I' ? 'I' : 'D';
  const comp = [];
  const claves = [];
  const electricos = [];
  let nombre = '';
  const L = c.largoMM;

  // Cuerpo credenza común a Directivo, Cantilever y Credenza Modulable.
  function cuerpoCredenzaEscritorio(pfx) {
    const credF = 600, credA = 750;
    comp.push(...carcasa(pfx, L, credF, credA, mat));
    comp.push(...panel(`${pfx} · divisor central`, credF, credA, 1, mat));
    comp.push(...entrepanos(pfx, L / 2, credF, 2, mat));
    comp.push(...cajones(pfx, 440, credF, 4, mat));                       // 2 archiveros + 2 lapiceros
    comp.push(...puertas(pfx, L / 2 - 15, credA - 20, 2, mat, true));     // 2 puertas abatibles
    comp.push({ insumoId: CERRADURA, nombre: `${pfx} · cerradura electrónica Stealthlock (cajón central)`, cantidad: 1 });
    // Faldón pedestal + base cubo
    comp.push(...panel('Faldón pedestal', L, 400, 1, mat));
    comp.push(...panel('Base cubo pedestal', 600, 600, 3, mat));
    // Cubierta de trabajo con 1/3–2/3 en EcoPiel
    const cubF = 900;
    comp.push(...panel('Cubierta de trabajo', L, cubF, 1, mat));
    comp.push(...tapiceria('Cubierta (sección EcoPiel)', (L / 1000) * (cubF / 1000) * 0.5));
    // Conducto pasa-cables + niveladores + tornillería
    comp.push({ insumoId: DUCTO, nombre: 'Conducto pasa-cables', cantidad: r3(L / 1000) });
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
  }

  if (c.producto === 'escritorio' || c.producto === 'cantilever') {
    const esCant = c.producto === 'cantilever';
    nombre = `Eclipse Escritorio ${esCant ? 'Cantilever' : 'Directivo'} ${(L / 1000).toFixed(2)} m · mano ${manoTxt}`;
    cuerpoCredenzaEscritorio('Credenza');
    if (c.electrico) electricos.push('Caja eléctrica BE01820M24Z01U572 (preparación incluida; accesorio por separado)', 'Acometida y cableado por proyecto');
    const idx = IDX_FRONT[L] || '88';
    const suf = c.electrico ? 'CE' : 'CC';
    claves.push(`${esCant ? 'ECESCA' : 'ECESDI'}${idx}${M}CHP${suf}`);
  }

  else if (c.producto === 'qvadrat') {
    const S = L; // base cuadrada S×S
    nombre = `Eclipse Escritorio Qvadrat ${(S / 1000).toFixed(2)} m`;
    // Base cubo con puerta frontal de acceso (jaladera integrada)
    comp.push(...carcasa('Base Qvadrat', S, S, 720, mat));
    comp.push(...panel('Base Qvadrat · divisor', S, 720, 1, mat));
    comp.push(...puertas('Base Qvadrat', S / 2 - 15, 700, 1, mat, true));
    // Cubierta con 1/3 en EcoPiel
    comp.push(...panel('Cubierta', S, S, 1, mat));
    comp.push(...tapiceria('Cubierta (1/3 EcoPiel)', (S / 1000) * (S / 1000) * 0.34));
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    if (c.electrico) electricos.push('Caja eléctrica BE02511E2X33Z0872 (preparación; accesorio por separado)');
    claves.push(`ECESQV${IDX_SQ[S] || '55'}CH${c.electrico ? 'VE2X' : 'P'}`);
  }

  else if (c.producto === 'credenza_modulable') {
    nombre = `Eclipse Escritorio Credenza Modulable ${(L / 1000).toFixed(2)} m · mano ${manoTxt}`;
    cuerpoCredenzaEscritorio('Credenza modulable');
    // bloqueo simultáneo de ambas puertas (Stealthlock ya contada)
    claves.push(`ECCRM92${M}CHEP`);
  }

  else if (c.producto === 'credenza') {
    const F = c.fondoMM || 600, A = 590;
    nombre = `Eclipse Credenza baja ${(L / 1000).toFixed(2)} × ${(F / 1000).toFixed(2)} m · mano ${manoTxt}`;
    comp.push(...carcasa('Credenza', L, F, A, mat));
    comp.push(...panel('Credenza · divisor central', F, A, 1, mat));
    comp.push(...entrepanos('Credenza', L / 2, F, 2, mat));
    comp.push(...cajones('Credenza', 440, F, 4, mat));                    // 2 archiveros + 2 papeleros
    comp.push(...puertas('Credenza', L / 2 - 15, A - 20, 2, mat, true));  // 2 puertas abatibles
    comp.push({ insumoId: CERRADURA, nombre: 'Cerradura electrónica Stealthlock', cantidad: 1 });
    // Tapa de registro tapizada en EcoPiel
    comp.push(...panel('Tapa de registro', L, 200, 1, mat));
    comp.push(...tapiceria('Tapa de registro EcoPiel', (L / 1000) * 0.2));
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    if (c.electrico) electricos.push('Caja eléctrica (preparación en tapa de registro; accesorio por separado)');
    claves.push(`ECCB82${M}CHP${c.electrico ? 'CC' : ''}`);
  }

  else if (c.producto === 'credenza_vertical') {
    const v = VERT[Number(c.puertas)] || VERT[2];
    nombre = `Eclipse Credenza ${v.puertas} puertas verticales ${(v.L / 1000).toFixed(2)} × ${(v.F / 1000).toFixed(2)} m`;
    comp.push(...carcasa('Credenza vertical', v.L, v.F, v.A, mat));
    if (v.puertas > 2) comp.push(...panel('Credenza vertical · divisor', v.F, v.A, v.puertas - 1, mat));
    comp.push(...entrepanos('Credenza vertical', v.L / v.puertas, v.F, v.entrepanos, mat));
    comp.push(...puertas('Credenza vertical', v.L / v.puertas - 10, v.A - 20, v.puertas, mat));
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    claves.push(v.clave);
  }

  else if (c.producto === 'gaveta') {
    const g = GUARDA[c.guarda] || GUARDA.gaveta;
    nombre = `Eclipse ${g.nombre} ${(g.L / 1000).toFixed(2)} × ${(g.F / 1000).toFixed(2)} × ${(g.A / 1000).toFixed(2)} m`;
    comp.push(...carcasa('Guarda', g.L, g.F, g.A, mat));
    comp.push(...entrepanos('Guarda', g.L, g.F, g.entrepanos, mat));
    comp.push(...cajones('Guarda', g.L - 40, g.F, g.cajones, mat));
    comp.push(...puertas('Guarda', g.L / Math.max(1, g.puertas) - 10, g.A - 20, g.puertas, mat));
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    claves.push(g.clave);
  }

  else if (c.producto === 'mesa_juntas') {
    const S = L; // cubierta cuadrada/redonda S×S
    const redonda = c.forma === 'redonda';
    nombre = `Eclipse Mesa de juntas ${redonda ? 'redonda' : 'cuadrada'} ${(S / 1000).toFixed(2)} m`;
    // Base = pedestal-cubo 550×550×681 con cajonería (2 archiveros + 2 lapiceros) y puerta frontal
    comp.push(...pedestalCubo('Base juntas', 550, 550, 681, mat));
    comp.push(...cajones('Base juntas', 480, 550, 4, mat));
    comp.push(...puertas('Base juntas', 500, 660, 1, mat, true));
    // Cubierta voluminosa (tablero 50mm) con sección central en EcoPiel
    comp.push(...panel('Cubierta', S, S, 1, mat));
    comp.push(...tapiceria('Cubierta (sección central EcoPiel)', (S / 1000) * (S / 1000) * 0.34));
    comp.push({ insumoId: DUCTO, nombre: 'Conducto con insertos', cantidad: 0.6 });
    comp.push({ insumoId: ESCUADRA, nombre: 'Placas de unión', cantidad: 2 });
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    if (c.electrico) electricos.push('Caja eléctrica BE02511E2X33Z0872 (preparación; accesorio por separado)');
    const suf = c.electrico ? 'PE2X' : 'P';
    if (redonda) claves.push(`ECMJMC${IDX_ROUND[S] || '4'}CH${suf}`);
    else claves.push(`ECMJM${IDX_SQ[S] || '44'}CH${suf}`);
  }

  else if (c.producto === 'mesa_consejo') {
    const F = 750; // módulo modular
    const esq = c.consejo === 'esquinera';
    nombre = `Eclipse Mesa de consejo modular ${esq ? 'esquinera' : 'recta'} ${(L / 1000).toFixed(2)} m`;
    // Pedestal lateral con paso de cables + puerta de acceso
    comp.push(...pedestalCubo('Pedestal consejo', 550, 550, 700, mat));
    comp.push(...puertas('Pedestal consejo', 500, 680, 1, mat, true));
    // Cubierta modular 1/3 chapa · 2/3 EcoPiel + placas de unión
    comp.push(...panel('Cubierta módulo', L, F, 1, mat));
    comp.push(...tapiceria('Cubierta 2/3 EcoPiel', (L / 1000) * (F / 1000) * 0.66));
    comp.push({ insumoId: ESCUADRA, nombre: 'Placas de unión (2 por conexión)', cantidad: 2 });
    comp.push({ insumoId: DUCTO, nombre: 'Refuerzos/ducto pasa-cables', cantidad: r3(F / 1000) });
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    if (c.electrico) electricos.push('Caja eléctrica BE0251122Z0872 ELLORA 2 (preparación; accesorio por separado)');
    if (esq) {
      claves.push(`ECMC3Q${IDX_CONS_ESQ[L] || '57'}CH`);
    } else {
      const suf = c.electrico ? 'E22' : '';
      claves.push(`ECMCM${IDX_CONS[L] || '57'}CHEP${suf}`);
    }
  }

  else if (c.producto === 'mesa_regulable') {
    nombre = 'Eclipse Mesa de altura regulable 1.50 m (70–114 cm)';
    comp.push({ insumoId: BASE_MOTOR, nombre: 'Base eléctrica con control digital', cantidad: 1 });
    comp.push(...panel('Lateral reforzado', 700, 600, 2, mat));
    comp.push(...panel('Cubierta', 1500, 750, 1, mat));
    comp.push(...tapiceria('Cubierta EcoPiel', (1500 / 1000) * (750 / 1000) * 0.4));
    comp.push({ insumoId: RIEL, nombre: 'Rieles', cantidad: 1 });
    comp.push({ insumoId: DUCTO, nombre: 'Bajada de cable por pedestal', cantidad: 1.2 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    electricos.push('Caja eléctrica (preparación en cubierta; accesorio por separado)');
    claves.push('ECMAR57CH1BF02');
  }

  else if (c.producto === 'mesa_apoyo') {
    const a = APOYO[c.modelo] || APOYO.lateral;
    nombre = `Eclipse ${a.nombre} ${(a.L / 1000).toFixed(2)} × ${(a.F / 1000).toFixed(2)} × ${(a.A / 1000).toFixed(2)} m`;
    comp.push(...panel('Cubierta', a.L, a.F, 1, mat));
    comp.push(...panel('Base', Math.max(200, a.L - 100), Math.max(200, a.F - 100), 2, mat));
    if (a.cristal) comp.push({ insumoId: CRISTAL, nombre: 'Refuerzos de cristal templado 19mm', cantidad: r3((a.L / 1000) * (a.F / 1000)) });
    comp.push({ insumoId: NIVELADOR, nombre: 'Niveladores', cantidad: 4 });
    comp.push({ insumoId: TORNILLERIA, nombre: 'Tornillería (incluida)', cantidad: 1 });
    claves.push(a.clave);
  }

  return {
    producto: c.producto, nombre, componentes: comp,
    claves: [...new Set(claves)], electricos: [...new Set(electricos)],
    modoManoObra: 'horas', horas: HORAS[c.producto] || HORAS.escritorio,
    factorDirecta: 35, factorIndirecta: 12,
    nota: 'Eclipse: ebanistería en chapa de madera / Walnut Burl, EcoPiel automotriz, herrajes Blum y cerradura Stealthlock. El cuerpo credenza (carcasa + 4 cajones con correderas + 2 puertas abatibles con bisagras) + faldón pedestal + cubierta + conducto se modelan completos (corrige el subcosteo ~5×). Aproximaciones: cristal 19mm se surte con cristal-templado-12 (12mm) por falta de id exacto; EcoPiel por metro lineal = área/1.40; espuma por m²; caja eléctrica va en "electricos" (se pide y cotiza por separado). Se afina con lista de MP real (chapa/EcoPiel/herrajes Blum) y tiempos por UE.',
  };
}
