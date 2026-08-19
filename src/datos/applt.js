// ============================================================================
//  GENERADOR PARAMÉTRICO APP LT  ·  fuente: guía oficial ESP-DCC-IDP-003 v3.0
//  (elaborada por Rafael Carranza / Diseño). "La verdad absoluta de APP LT".
//
//  Una sola línea, cientos de combinaciones. En vez de capturar receta por
//  receta, se ARMA el despiece con las reglas clave↔medida de la guía y las
//  DIMENSIONES REALES de cada componente (tablas "Componentes" del PDF).
//
//  Material (cantidades REALES derivadas de las medidas de la guía):
//   - CUBIERTA: melamina ABS 28 mm, medida exacta + canto ABS en los 4 lados.
//   - PATAS "U": PTR. Longitud = 2×altura(0.72) + claro. (patas 720 mm alto)
//   - OMEGAS / DUCTOS / RIELES: metal formado; se modelan por su LONGITUD real
//     (proxy PTR/metro hasta tener el sub-despiece exacto de lámina por clave).
//   - BIOMBO: cristal templado 6 mm o melamina 9 mm (400 mm de alto).
//   - FALDÓN: conducto ABS (pieza).
//   - Tornillería: incluida en la pata.
//   - ELÉCTRICO (acometida ATACM, Node, Byrne): se cotiza APARTE (no va en el
//     costo de fabricación; se lista como accesorio).
//
//  Precios: por ahora estimados; se vuelven exactos con la lista de MP.
// ============================================================================

import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const H_PATA = 0.72;   // altura de trabajo (m)

// -------- Insumos base (existen en insumos.js) --------
// 2026-08-18: verificado renglón a renglón contra el T.D.C. real de Alba
// (área de estimaciones) — melamina color IVORY, perfil de canto de aluminio
// (no tapacanto PVC genérico) y la tapa registrable metálica que trae TODA
// cubierta App LT ("CON TAPA REGISTRABLE METALICA" en el catálogo), que antes
// no se cobraba. Con esto la cubierta cuadra a -1.5% del T.D.C. real (antes
// -9.6%/+9%, según la fórmula de aprovechamiento). Ver costeador-formula-alba.
// El id BASE es 'melamina-28' (genérico, el que comparten las otras 8 líneas)
// — `generarAppLT` lo reescribe a IVORY por default vía `aplicarColor` más
// abajo, sin tocar el precio genérico compartido.
const MELAMINA = 'melamina-28';
const MELAMINA9 = 'melamina-9';
const CANTO = 'perfil-canto-applt';
const TAPA_REGISTRABLE = 'tapa-registrable-applt';
const PTR = 'ptr';                    // proxy para todo metal formado lineal
const CRISTAL6 = 'cristal-templado-6';
const PET = 'pet-acustico';
const FALDON = 'faldon-abs';
// Eléctrico (Byrne / cajas). caja-electrica = "2 contactos + USB + HDMI" (= texto de los presupuestos).
const CAJA_ELE = 'caja-electrica';
const ACOMETIDA = 'acometida';
// Guardas de gerente/ejecutivo
const PEDESTAL = 'pedestal';
const CREDENZA = 'credenza';

// ============================================================================
//  CLAVES — tablas maestras del PDF (secciones "Componentes")
// ============================================================================

// Cubiertas rectangulares (melamina ABS 28 mm). clave por [largoMM][fondoMM]
const CUBIERTA = {
  600:  { 900: 'ATCUL32ABSOPG', 1050: 'ATCUL1052ABSOPG', 1200: 'ATCE42ABSOPG', 1500: 'ATCE52ABSOPG', 1800: 'ATCE62ABSOPG', 2100: 'ATCE72ABSOPG', 2400: 'ATCE82ABSOPG' },
  750:  { 1200: 'ATCE475ABSOPG', 1500: 'ATCE575ABSOPG', 1800: 'ATCE675ABSOPG', 2100: 'ATCE775ABSOPG', 2400: 'ATCE875ABSOPG' },
  900:  { 1200: 'ATCE43ABSOPG', 1500: 'ATCE53ABSOPG' },
};
const CUBIERTA_BS = { 1200: 'ATCUBS44ABS', 1500: 'ATCUBS45ABS', 1800: 'ATCUBS46ABS' };           // banca sencilla 600
const CUBIERTA_BD = { 1200: 'ATCUBD44ABS', 1500: 'ATCUBD45ABS', 1800: 'ATCUBD46ABS' };           // banca doble 1200
const CUBIERTA_MJ = { 1200: 'ATCUMJ44ABS', 1500: 'ATCUMJ45ABS', 1800: 'ATCUMJ46ABS' };           // mesa juntas

// Patas U (metal, alto 720, sección 146). clave + claro real (mm)
const PATA = {
  600: { clave: 'ATPU2M', claro: 600 }, 750: { clave: 'ATPU75M', claro: 750 }, 900: { clave: 'ATPU3M', claro: 900 },
  1200: { clave: 'ATPU4M', claro: 1200 }, 1500: { clave: 'ATPU5M', claro: 1500 }, 1800: { clave: 'ATPU6M', claro: 1800 }, 2100: { clave: 'ATPU7M', claro: 2100 },
};
function pataPara(fondoMM) {
  const k = [600, 750, 900, 1200, 1500, 1800, 2100].find((x) => fondoMM <= x) || 1200;
  return PATA[k];
}
// Regla de patas de ESCRITORIO (guía p16): usa una pata mayor al fondo.
const PATA_ESC = { 600: PATA[750], 750: PATA[900], 900: PATA[1200], 1050: PATA[1200], 1200: PATA[1200] };
function pataEsc(fondoMM) { return PATA_ESC[fondoMM] || PATA[1200]; }
// Cubierta lateral (retorno) por largo, fondo 600
const CUBIERTA_LAT = { 900: 'ATCUL32ABSOPG', 1050: 'ATCUL1052ABSOPG', 1200: 'ATCE42ABSOPG' };

// Omega de refuerzo (metal). clave + longitud real (mm). ATOM (sencillo) / ATOMCU (doble, fondo>600)
const OMEGA = {
  simple: { 1200: { clave: 'ATOM3', len: 800 }, 1500: { clave: 'ATOM4', len: 1100 }, 1800: { clave: 'ATOM4', len: 1100 }, 2100: { clave: 'ATOM5', len: 1400 }, 2400: { clave: 'ATOM6', len: 1700 } },
  doble:  { 1200: { clave: 'ATOMCU3', len: 800 }, 1500: { clave: 'ATOMCU4', len: 1100 }, 1800: { clave: 'ATOMCU5', len: 1400 }, 2100: { clave: 'ATOMCU5', len: 1400 }, 2400: { clave: 'ATOMCU6', len: 1700 } },
};
function omegaPara(largoMM, fondoMM) {
  const t = fondoMM > 600 ? 'doble' : 'simple';
  const k = [1200, 1500, 1800, 2100, 2400].find((x) => largoMM <= x) || 2100;
  return OMEGA[t][k];
}

// Riel con ducto (metal). clave + longitud real (mm). DS sencilla / DB doble / MJ mesa juntas
// El riel mide 300 mm menos que el módulo (patrón constante en las 3 tablas).
// A 1050 la clave de fábrica no viene en ningún presupuesto, pero la LONGITUD sí
// se conoce, y es lo que cuesta: sin esta entrada el despiece perdía el riel en
// silencio y los módulos de 1.05 salían baratos de más.
const RIEL = {
  DS: { 1050: { clave: null, len: 750 }, 1200: { clave: 'ATRICDS4', len: 900 }, 1500: { clave: 'ATRICDS5', len: 1200 }, 1800: { clave: 'ATRICDS6', len: 1500 } },
  DB: { 1050: { clave: null, len: 750 }, 1200: { clave: 'ATRICDB4', len: 900 }, 1500: { clave: 'ATRICDB5', len: 1200 }, 1800: { clave: 'ATRICDB6', len: 1500 } },
  MJ: { 1200: { clave: 'ATRICMJ4', len: 900 }, 1500: { clave: 'ATRICMJ5', len: 1200 }, 1800: { clave: 'ATRICMJ6', len: 1500 } },
};

// Biombo. clave + largo real (mm), alto 400. cristal 6mm o melamina 9mm
const BIOMBO = {
  cristal: { 1050: { clave: null, len: 950 }, 1200: { clave: 'ATBIOCRT4', len: 1100 }, 1500: { clave: 'ATBIOCRT5', len: 1400 }, 1800: { clave: 'ATBIOCRT6', len: 1700 } },
  melamina: { 1050: { clave: null, len: 950 }, 1200: { clave: 'ATBIOABS4', len: 1100 }, 1500: { clave: 'ATBIOABS5', len: 1400 }, 1800: { clave: 'ATBIOABS6', len: 1700 } },
  pet: { 1050: { clave: null, len: 950 }, 1200: { clave: 'ATBIOPET4', len: 1100 }, 1500: { clave: 'ATBIOPET5', len: 1400 }, 1800: { clave: 'ATBIOPET6', len: 1700 } },
};

// Faldón (conducto ABS). clave por largo
// Faldón real por LARGO de cubierta (guía §15): 1200→12, 1500→150, 1800→18, 2100→21, 2400→24 (mín 1200).
const FALDON_CLAVE = { 1050: null, 1200: 'ATFAL12ABS', 1500: 'ATFAL150ABS', 1800: 'ATFAL18ABS', 2100: 'ATFAL21ABS', 2400: 'ATFAL24ABS' };

// ============================================================================
//  Opciones de medida disponibles (para la pantalla)
// ============================================================================
const CHK_FAL = { key: 'faldon', label: 'Faldón' };
const CHK_ELE = { key: 'electrico', label: 'Electrificación (aparte)' };
// Los módulos del papel que dicen "BIOMBO FRONTAL Y LATERALES" traen además dos
// mamparas de cierre en los extremos de la corrida. Cuestan: en el presupuesto
// de BMU el MISMO módulo de 3000×1200 4u vale $22,590 sin laterales y $25,980
// con ellos. Sin esta opción no había forma de cotizar el módulo del papel.
const CHK_LAT = { key: 'laterales', label: 'Biombos laterales (cierre de extremos)' };
// Distinto de los laterales: éstos van ENTRE puesto y puesto. Confirmado en los
// renders del presupuesto 226030018: la misma banca de 3 usuarios en 3600×600
// vale $26,760 con sólo biombo de espalda (área "OPERATIVO 3U A") y $37,960 con
// divisores perpendiculares entre puestos (área "3U B"). La descripción escrita
// es idéntica en las dos; la diferencia sólo se ve en la imagen.
const CHK_DIV = { key: 'divisores', label: 'Divisores entre puestos' };
// Colores reales de melamina 28mm (catálogo de acabados, ver colorMelamina.js)
// para el selector — todos los productos App LT tienen cubierta de melamina.
const APPLT_PRODUCTOS_BASE = [
  { id: 'escritorio', nombre: 'Escritorio', largos: [1200, 1500, 1800, 2100, 2400], fondos: [600, 750, 900], checks: [CHK_FAL, CHK_ELE] },
  { id: 'escritorio_l', nombre: 'Escritorio en L', largos: [1500, 1800, 2100, 2400], fondos: [600, 750, 900], largosLateral: [900, 1050, 1200], checks: [CHK_FAL, CHK_ELE] },
  // El largo es el MÓDULO POR USUARIO, no el largo total. 1050 existe en los
  // presupuestos reales (Unión de Crédito: 2100×1200 4u y 4200×1200 8u) y estaba
  // fuera de la lista, así que esas anclas eran inalcanzables. 2 usuarios en banca
  // doble también es real (1500×1200, dos personas de frente) y faltaba.
  { id: 'banca_sencilla', nombre: 'Banca sencilla', largos: [1050, 1200, 1500, 1800], fondos: [600], usuarios: [1, 2, 3, 4, 6, 8], biombo: true, checks: [CHK_LAT, CHK_DIV, CHK_ELE] },
  { id: 'banca_doble', nombre: 'Banca doble', largos: [1050, 1200, 1500, 1800], fondos: [1200], usuarios: [2, 4, 6, 8, 10, 12], biombo: true, checks: [CHK_LAT, CHK_DIV, CHK_ELE] },
  { id: 'mesa_juntas', nombre: 'Mesa de juntas', largos: [1200, 1500, 1800, 2100, 2400], fondos: [1200], checks: [CHK_ELE] },
  { id: 'mesa_circular', nombre: 'Mesa circular', diametros: [1200, 1500, 1800, 2100, 2400], checks: [] },
];
// IVORY primero: es el default real de generarAppLT (verificado contra el
// T.D.C. de Alba) — la UI asume "el primero de la lista = default" (mismo
// patrón que `finishes[0]`), así que el orden aquí tiene que coincidir.
const COLORES_APPLT = (() => {
  const lista = coloresDe('melamina-28') || [];
  const i = lista.findIndex((c) => c.id === 'ivory');
  return i > 0 ? [lista[i], ...lista.slice(0, i), ...lista.slice(i + 1)] : lista;
})();
export const APPLT_PRODUCTOS = APPLT_PRODUCTOS_BASE.map((p) => ({ ...p, colores: COLORES_APPLT }));

// ============================================================================
//  Helpers de despiece
// ============================================================================
const perimetro = (lMM, aMM) => (2 * (lMM + aMM)) / 1000; // m
function cubierta(nombre, insumoId, largoMM, anchoMM, cant = 1) {
  return [
    { insumoId, nombre, cantidad: cant, largoMM, anchoMM },
    { insumoId: CANTO, nombre: `Canto perfil aluminio 4 lados · ${nombre}`, cantidad: perimetro(largoMM, anchoMM) * cant },
    // Herraje fijo por cubierta (no escala con el tamaño): del T.D.C. de Alba.
    // ⚠️ el nombre NO empieza con "Tapa" a propósito: tipoComponente() (en
    // resolverComponentes.js) clasifica ese prefijo como pieza de catálogo a
    // cotizar aparte, y esto es un herraje interno ya costeado por material,
    // no una pieza del price-book.
    { insumoId: TAPA_REGISTRABLE, nombre: `Herraje de registro metalico · ${nombre}`, cantidad: cant },
  ];
}
const pataPTR = (claro) => 2 * H_PATA + claro / 1000;   // m de PTR por pata U
const metalLineal = (insumoId, nombre, lenMM, cant = 1) => ({ insumoId, nombre, cantidad: (lenMM / 1000) * cant });

// ============================================================================
//  MODELO DE HORAS (UE real por centro) — de los 15 reportes Intelisis (2026-08).
//  Centros: carpinteria(Madera) · pintura · acabados · otros · pm(metal). El
//  costo/hora por centro (MO y GIF) vive en APPLT_RATES y lo aplica el motor en
//  modo 'intelisis'. HORAS_CLAVE = valor EXACTO medido; si la clave no está,
//  se estima con fórmulas por tipo (escritorios ATCE, patas grandes, rieles).
// ============================================================================
export const APPLT_RATES = {
  // tarifas reales de planta (constantes en los 15 reportes)
  costoHoraArea: { pm: 0, carpinteria: 54.55, pintura: 394.35, acabados: 56.34, tapiceria: 0, otros: 61.98 },
  costoHoraGIF:  { pm: 0, carpinteria: 190.82, pintura: 1796.61, acabados: 193.59, tapiceria: 0, otros: 234.39 },
  gastosOperacionPct: 30, utilidadPct: 20, factorPrecioLista: 3,
};

const HORAS_CLAVE = {
  ATCUBS44ABS: { carpinteria: 0.8324, pintura: 0.0055, acabados: 0.044, otros: 0.254 },
  ATCUBS45ABS: { carpinteria: 0.9358, pintura: 0.0055, acabados: 0.044, otros: 0.254 },
  ATCUBS46ABS: { carpinteria: 1.039, pintura: 0.0055, acabados: 0.044, otros: 0.254 }, // carp modelada (dato venía en 0)
  ATCUBD44ABS: { carpinteria: 1.4068, pintura: 0.011, acabados: 0.088, otros: 0.508 },
  ATCUBD45ABS: { carpinteria: 1.4852, pintura: 0.011, acabados: 0.088, otros: 0.508 },
  ATCUBD46ABS: { carpinteria: 1.2458, pintura: 0.011, acabados: 0.088, otros: 0.508 },
  ATPU2M:  { acabados: 0.1434, pintura: 0.0066, otros: 1.4078 },
  ATPU75M: { acabados: 0.1498, pintura: 0.0099, otros: 1.5012 },
  ATPU3M:  { acabados: 0.1668, pintura: 0.0132, otros: 1.6628 },
  ATOM3: { acabados: 0.072, pintura: 0.0033, otros: 0.1116 },
  ATOM4: { acabados: 0.096, pintura: 0.0033, otros: 0.1242 },
  ATFAL12ABS:  { carpinteria: 0.295, pintura: 0.0033, acabados: 0.064, otros: 0.1198 },
  ATFAL150ABS: { carpinteria: 0.4779, pintura: 0.0033, acabados: 0.036, otros: 0.1198 },
  ATBIOCRT5: { acabados: 0.3402 },
  ATACM: { acabados: 0.108, pintura: 0.0099, otros: 0.5152 },
};
const HZERO = () => ({ pm: 0, carpinteria: 0, pintura: 0, acabados: 0, tapiceria: 0, otros: 0 });
function addH(dst, src, k = 1) { for (const a in src) dst[a] = (dst[a] || 0) + src[a] * k; return dst; }
// Fórmulas de respaldo (tamaños/claves sin medición Intelisis)
function hCubierta(largoMM, fondoMM, clave) {
  if (HORAS_CLAVE[clave]) return HORAS_CLAVE[clave];
  const A = (largoMM * fondoMM) / 1e6, doble = fondoMM > 600;
  return { carpinteria: (doble ? 0.80 : 0.95) * A, pintura: 0.0076 * A, acabados: 0.061 * A, otros: 0.353 * A };
}
function hPata(clave, claro) {
  if (HORAS_CLAVE[clave]) return HORAS_CLAVE[clave];
  return { otros: 0.90 + 0.00085 * claro, acabados: 0.15, pintura: 0.008 };
}
function hOmega(clave, len) {
  if (HORAS_CLAVE[clave]) return HORAS_CLAVE[clave];
  return { otros: 0.09 + 0.00003 * len, acabados: 0.08, pintura: 0.0033 };
}
function hRiel(len) { return { otros: 0.12 + 0.00005 * len, acabados: 0.09, pintura: 0.004 }; } // estimado (sin dato Intelisis)
function hFaldon(clave, largo) {
  if (HORAS_CLAVE[clave]) return HORAS_CLAVE[clave];
  return { carpinteria: Math.max(0.2, 0.295 + 0.00061 * (largo - 1200)), acabados: 0.05, pintura: 0.0033, otros: 0.12 };
}
function hBiombo(clave) { return HORAS_CLAVE[clave] || { acabados: 0.34 }; }

// ============================================================================
//  GENERADOR
//  config: { producto, largoMM, fondoMM, diametroMM, usuarios, faldon, biombo:'cristal'|'melamina'|null, electrico }
// ============================================================================
export function generarAppLT(config) {
  // Default 'ivory': es el color con el que Von Haucke costeó y verificó su
  // T.D.C. real (ver costeador-formula-alba, memoria) — sin color explícito,
  // App LT sigue cotizando en IVORY, no en el genérico compartido 'melamina-28'.
  const c = { fondoMM: 600, faldon: false, biombo: null, usuarios: 2, electrico: false, color: 'ivory', ...config };
  const comp = [];
  const claves = [];
  const electricos = [];
  let nombre = '';
  const H = HZERO();               // horas por centro (UE real)
  const add = (arr) => comp.push(...arr);

  // ---------------- ESCRITORIO recto ----------------
  if (c.producto === 'escritorio') {
    const { largoMM: L, fondoMM: F } = c;
    nombre = `Escritorio APP LT ${(L / 1000).toFixed(2)} × ${(F / 1000).toFixed(2)}`;
    const kc = CUBIERTA[F]?.[L] || `ATCE·${L}×${F}`;
    add(cubierta(`Cubierta (${kc})`, MELAMINA, L, F));
    const p = pataEsc(F), o = omegaPara(L, F);
    comp.push(metalLineal(PTR, `Pata U (${p.clave})`, pataPTR(p.claro) * 1000, 2));
    comp.push(metalLineal(PTR, `Refuerzo omega (${o.clave})`, o.len));
    claves.push(kc, p.clave, o.clave);
    addH(H, hCubierta(L, F, kc)); addH(H, hPata(p.clave, p.claro), 2); addH(H, hOmega(o.clave, o.len));
    if (c.faldon) { const kf = FALDON_CLAVE[L] || 'ATFAL'; comp.push({ insumoId: FALDON, nombre: `Faldón (${kf})`, cantidad: 1 }); claves.push(kf); addH(H, hFaldon(kf, L)); }
  }

  // ---------------- ESCRITORIO EN L (con lateral / retorno) ----------------
  else if (c.producto === 'escritorio_l') {
    const { largoMM: L, fondoMM: F } = c; const LL = c.largoLateralMM || 1050;
    nombre = `Escritorio L APP LT ${(L / 1000).toFixed(2)} × ${(F / 1000).toFixed(2)} + retorno ${(LL / 1000).toFixed(2)}`;
    const kc = CUBIERTA[F]?.[L] || `ATCE·${L}×${F}`, kl = CUBIERTA_LAT[LL] || `ATCUL·${LL}`;
    add(cubierta(`Cubierta principal (${kc})`, MELAMINA, L, F));
    add(cubierta(`Cubierta lateral (${kl})`, MELAMINA, LL, 600));
    const p = pataEsc(F), pl = PATA[600], o1 = omegaPara(L, F), o2 = omegaPara(LL, 600);
    comp.push(metalLineal(PTR, `Pata U principal (${p.clave})`, pataPTR(p.claro) * 1000, 2));
    comp.push(metalLineal(PTR, `Pata U retorno (${pl.clave})`, pataPTR(pl.claro) * 1000, 1));
    comp.push(metalLineal(PTR, `Refuerzo omega ppal (${o1.clave})`, o1.len));
    comp.push(metalLineal(PTR, `Refuerzo omega retorno (${o2.clave})`, o2.len));
    claves.push(kc, kl, p.clave, pl.clave, o1.clave, o2.clave);
    addH(H, hCubierta(L, F, kc)); addH(H, hCubierta(LL, 600, kl));
    addH(H, hPata(p.clave, p.claro), 2); addH(H, hPata(pl.clave, pl.claro), 1);
    addH(H, hOmega(o1.clave, o1.len)); addH(H, hOmega(o2.clave, o2.len));
    if (c.faldon) { const kf = FALDON_CLAVE[L] || 'ATFAL'; comp.push({ insumoId: FALDON, nombre: `Faldón (${kf})`, cantidad: 1 }); claves.push(kf); addH(H, hFaldon(kf, L)); }
  }

  // ---------------- BANCA SENCILLA ----------------
  else if (c.producto === 'banca_sencilla') {
    const L = c.largoMM, F = 600, n = c.usuarios || 2;
    nombre = `Banca sencilla APP LT ${(L / 1000).toFixed(2)} · ${n} usuarios`;
    const kc = CUBIERTA_BS[L] || `ATCUBS·${L}`, o = omegaPara(L, F), r = RIEL.DS[L];
    for (let i = 0; i < n; i++) add(cubierta(`Cubierta (${kc})`, MELAMINA, L, F));
    const p = PATA[600];
    comp.push(metalLineal(PTR, `Pata U (${p.clave})`, pataPTR(p.claro) * 1000, n + 1));
    comp.push(metalLineal(PTR, `Refuerzo omega (${o.clave})`, o.len, n));
    if (r) comp.push(metalLineal(PTR, `Riel con ducto (${r.clave})`, r.len, n));
    claves.push(kc, p.clave, o.clave, r?.clave);
    addH(H, hCubierta(L, F, kc), n); addH(H, hPata(p.clave, p.claro), n + 1); addH(H, hOmega(o.clave, o.len), n);
    if (r) addH(H, hRiel(r.len), n);
    if (c.biombo) { addBiombo(comp, claves, L, c.biombo, n); addH(H, hBiombo(BIOMBO[c.biombo]?.[L]?.clave), n); }
    if (c.laterales) { addLaterales(comp, claves, F, c.biombo); addH(H, hBiombo(null), 2); }
    if (c.divisores && n > 1) { addDivisores(comp, F, c.biombo, n - 1); addH(H, hBiombo(null), n - 1); }
  }

  // ---------------- BANCA DOBLE ----------------
  else if (c.producto === 'banca_doble') {
    const L = c.largoMM, n = c.usuarios || 4; const pares = Math.max(1, Math.round(n / 2));
    nombre = `Banca doble APP LT ${(L / 1000).toFixed(2)} · ${n} usuarios`;
    const kc = CUBIERTA_BD[L] || `ATCUBD·${L}`, o = omegaPara(L, 1200), r = RIEL.DB[L];
    for (let i = 0; i < pares; i++) add(cubierta(`Cubierta doble (${kc})`, MELAMINA, L, 1200));
    const p = PATA[1200];
    comp.push(metalLineal(PTR, `Pata U (${p.clave})`, pataPTR(p.claro) * 1000, pares + 1));
    comp.push(metalLineal(PTR, `Refuerzo omega (${o.clave})`, o.len, pares));
    if (r) comp.push(metalLineal(PTR, `Riel con ducto (${r.clave})`, r.len, pares));
    claves.push(kc, p.clave, o.clave, r?.clave);
    addH(H, hCubierta(L, 1200, kc), pares); addH(H, hPata(p.clave, p.claro), pares + 1); addH(H, hOmega(o.clave, o.len), pares);
    if (r) addH(H, hRiel(r.len), pares);
    if (c.biombo) { addBiombo(comp, claves, L, c.biombo, pares); addH(H, hBiombo(BIOMBO[c.biombo]?.[L]?.clave), pares); }
    if (c.laterales) { addLaterales(comp, claves, 1200, c.biombo); addH(H, hBiombo(null), 2); }
    if (c.divisores && pares > 1) { addDivisores(comp, 600, c.biombo, 2 * (pares - 1)); addH(H, hBiombo(null), 2 * (pares - 1)); }
  }

  // ---------------- MESA DE JUNTAS ----------------
  else if (c.producto === 'mesa_juntas') {
    const L = c.largoMM, F = 1200;
    nombre = `Mesa de juntas APP LT ${(L / 1000).toFixed(2)} × 1.20`;
    const kc = CUBIERTA_MJ[Math.min(L, 1800)] || `ATCUMJ·${L}`, r = RIEL.MJ[Math.min(L, 1800)];
    add(cubierta(`Cubierta (${kc})`, MELAMINA, L, F));
    const p = pataPara(L);
    comp.push(metalLineal(PTR, `Pata U (${p.clave})`, pataPTR(p.claro) * 1000, 2));
    if (r) { comp.push(metalLineal(PTR, `Ducto para cables (${r.clave})`, r.len)); claves.push(r.clave); addH(H, hRiel(r.len)); }
    comp.push(metalLineal(PTR, 'Placa unión (QCIPLAUES)', 200));
    claves.push(kc, p.clave, 'QCIPLAUES');
    addH(H, hCubierta(L, F, kc)); addH(H, hPata(p.clave, p.claro), 2);
  }

  // ---------------- MESA CIRCULAR ----------------
  else if (c.producto === 'mesa_circular') {
    const D = c.diametroMM;
    nombre = `Mesa circular APP LT Ø${(D / 1000).toFixed(2)}`;
    if (D > 1500) {
      // 2 medias cubiertas + charola + placa unión + patas intermedias
      comp.push({ insumoId: MELAMINA, nombre: 'Cubierta media círculo (CICHCE)', cantidad: 2, largoMM: D, anchoMM: Math.round(D / 2) });
      comp.push({ insumoId: CANTO, nombre: 'Canto ABS perímetro', cantidad: (Math.PI * D) / 1000 });
      comp.push(metalLineal(PTR, 'Charola + placa unión + patas intermedias', D));
      comp.push(metalLineal(PTR, 'Patas', pataPTR(600) * 1000, 4));
      claves.push('CICHCE', 'QCIPLAUES');
      addH(H, hCubierta(D, Math.round(D * 0.7854), '')); addH(H, hPata('', 600), 4);
    } else {
      comp.push({ insumoId: MELAMINA, nombre: 'Cubierta circular', cantidad: 1, largoMM: D, anchoMM: D });
      comp.push({ insumoId: CANTO, nombre: 'Canto ABS perímetro', cantidad: (Math.PI * D) / 1000 });
      comp.push(metalLineal(PTR, 'Patas', pataPTR(600) * 1000, 3));
      addH(H, hCubierta(D, Math.round(D * 0.7854), '')); addH(H, hPata('', 600), 3);
    }
  }

  return aplicarColor({
    producto: c.producto, nombre, componentes: comp,
    claves: [...new Set(claves.filter(Boolean))],
    electricos: [...new Set(electricos)],
    modeloCosteo: 'intelisis',   // cascada real Von Haucke (App LT calibrada 2026-08)
    parModelo: APPLT_RATES,      // tarifas de planta (MO/GIF por hora) para el motor
    addons: addonsAppLT(c),      // partidas separadas a precio de lista real (eléctrico, gaveta)
    modoManoObra: 'horas',       // horas reales por centro (UE Intelisis)
    horas: H,
    factorDirecta: 35, factorIndirecta: 12, // respaldo si se fuerza modo porcentaje
    nota: 'Costo REAL: material a última compra del ERP + horas medidas por centro (UE Intelisis) + cascada ×1.30 (gastos op) → ×1.20 (utilidad) → ×3 (lista). Precio de LISTA (bruto); el descuento de proyecto va aparte. Biombo PET/electrificación/pedestal ya costeados. Calibrado vs presupuestos reales (MAE ~4%).',
  }, c);
}

function addBiombo(comp, claves, L, tipo, n) {
  const b = BIOMBO[tipo]?.[L]; if (!b) return;
  if (b.clave) claves.push(b.clave);   // a 1050 la clave de fábrica no se conoce
  const marca = b.clave || `${b.len} mm`;
  for (let i = 0; i < n; i++) {
    if (tipo === 'cristal') comp.push({ insumoId: CRISTAL6, nombre: `Biombo cristal 6mm (${marca})`, cantidad: (b.len / 1000) * 0.40 });
    else if (tipo === 'pet') comp.push({ insumoId: PET, nombre: `Biombo PET acústico 9mm (${marca})`, cantidad: (b.len / 1000) * 0.40 });
    else comp.push({ insumoId: MELAMINA9, nombre: `Biombo melamina 9mm (${marca})`, cantidad: 1, largoMM: b.len, anchoMM: 400 });
  }
}

// Mamparas de cierre en los DOS extremos de la corrida. No van por usuario: son
// 2 y punto, y su largo es el FONDO del mueble (1200 en doble, 600 en sencilla),
// no el módulo. Mismo material que el biombo frontal; si no se eligió biombo, se
// cierran en melamina, que es lo que dice el papel ("laterales en melamina ABS").
function addLaterales(comp, claves, fondoMM, tipo) {
  const mat = tipo || 'melamina';
  for (let i = 0; i < 2; i++) {
    if (mat === 'cristal') comp.push({ insumoId: CRISTAL6, nombre: `Biombo lateral cristal 6mm (${fondoMM} mm)`, cantidad: (fondoMM / 1000) * 0.40 });
    else if (mat === 'pet') comp.push({ insumoId: PET, nombre: `Biombo lateral PET acústico 9mm (${fondoMM} mm)`, cantidad: (fondoMM / 1000) * 0.40 });
    else comp.push({ insumoId: MELAMINA9, nombre: `Biombo lateral melamina 9mm (${fondoMM} mm)`, cantidad: 1, largoMM: fondoMM, anchoMM: 400 });
  }
}

// Divisores perpendiculares ENTRE puestos: uno por cada frontera, o sea n−1 en
// una corrida sencilla de n usuarios y pares−1 por hilera en una doble. Miden el
// FONDO de trabajo de un puesto (600), no el módulo.
function addDivisores(comp, fondoTrabajoMM, tipo, cant) {
  const mat = tipo || 'melamina';
  for (let i = 0; i < cant; i++) {
    if (mat === 'cristal') comp.push({ insumoId: CRISTAL6, nombre: `Divisor entre puestos cristal 6mm (${fondoTrabajoMM} mm)`, cantidad: (fondoTrabajoMM / 1000) * 0.40 });
    else if (mat === 'pet') comp.push({ insumoId: PET, nombre: `Divisor entre puestos PET acústico 9mm (${fondoTrabajoMM} mm)`, cantidad: (fondoTrabajoMM / 1000) * 0.40 });
    else comp.push({ insumoId: MELAMINA9, nombre: `Divisor entre puestos melamina 9mm (${fondoTrabajoMM} mm)`, cantidad: 1, largoMM: fondoTrabajoMM, anchoMM: 400 });
  }
}

// ============================================================================
//  ADD-ONS — partidas SEPARADAS con PRECIO DE LISTA REAL (de los presupuestos).
//  En Von Haucke el módulo se cotiza por renglones: MODULO + SISTEMA ELÉCTRICO
//  + GUARDA (gaveta) + SILLA. Cada uno es su propia partida con su lista bruta
//  y su mismo descuento de proyecto. NO van dentro del costo de fabricación del
//  módulo (por eso NO pasan por la cascada). Precios calibrados vs presupuestos
//  reales (226030018, 12 may 2026).
// ============================================================================
// Sistema eléctrico: lista = base + porUsuario·usuarios. Ajuste exacto a 5 datos
// reales (1u $3,030 · 2u $4,230 · 3u $5,430 sencilla; 4u $5,230 · 8u $8,630 doble).
const ELECTRICO_LISTA = { base: 1830, sencilla: 1200, doble: 850 };
export function electricoLista(producto, usuarios) {
  const porU = producto === 'banca_doble' ? ELECTRICO_LISTA.doble : ELECTRICO_LISTA.sencilla;
  return ELECTRICO_LISTA.base + porU * Math.max(1, usuarios || 1);
}
const GAVETA_MOX_LISTA = 5350; // GUARDA gaveta rodante MOX (1 archivero + 1 papelero, cerradura)

// Devuelve las partidas de add-on activas para una config, con su lista real.
export function addonsAppLT(config) {
  const c = config || {};
  const n = c.usuarios || 1;
  const out = [];
  if (c.electrico) {
    const users = (c.producto === 'banca_sencilla' || c.producto === 'banca_doble') ? n : 1;
    out.push({ id: 'electrico', nombre: `Sistema eléctrico (${users} usuario${users > 1 ? 's' : ''}: contacto regulado + normal)`, cantidad: 1, lista: electricoLista(c.producto, users) });
  }
  const gav = c.gavetas || 0;
  if (gav > 0) out.push({ id: 'gaveta', nombre: 'Gaveta rodante MOX (archivero + papelero, cerradura)', cantidad: gav, lista: GAVETA_MOX_LISTA, ruta: 'mox', productoId: 'rodante' });
  return out;
}
