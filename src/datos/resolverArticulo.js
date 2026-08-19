// ============================================================================
//  RESOLVER un item de Voni contra el CATÁLOGO OFICIAL de precios de línea.
//  ---------------------------------------------------------------------------
//  Rodrigo (2026-08-18): "que Voni utilice esos precios para todo".
//
//  Voni interpreta el pedido y arma un item paramétrico:
//      { ruta:'eclipse', producto:'escritorio',
//        config:{ largoMM:2400, mano:'D', finish:'chapa', electrico:false } }
//  El catálogo, en cambio, son ARTÍCULOS con clave fija y precio real:
//      ECCR82DCH · "ESCRITORIO CREDENZA DE 2400 X 600 X 750 mm MODELO ECLIPSE
//                   DERECHO, BASE CUBO...; EN CHAPA DE MADERA" · Lista $27,220
//
//  El nudo (medido en datos reales): el catálogo tiene MÁS granularidad que la
//  config de Voni. Un "escritorio 2400 D chapa" casa con la base ($27,220), la
//  de ecopiel ($29,280), la de papelero ($55,880)… Voni NO distingue esos
//  extras, así que ADIVINAR una sola clave puede errar el precio 3–4×.
//
//  DECISIÓN DE RODRIGO (2026-08-18): cuando hay varios candidatos, Voni NO
//  elige — los MUESTRA con su precio y el vendedor toca el correcto. Cero
//  sorpresas. Si hay uno solo, se usa directo. Si no casa nada (benching, que
//  se arma por componentes, o un tipo no mapeado), se devuelve 'ninguno' y el
//  llamador cae al cálculo de siempre: sin regresión.
//
//  Esta capa es PURA: sin React, sin red. Se prueba 100% offline contra las
//  filas reales de `preciosLinea.js`, sin gastar un crédito de IA.
// ============================================================================
import { PRECIOS_LINEA } from './preciosLinea.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => sinAcentos(t).toUpperCase();

// --- TIPO DE MUEBLE ---------------------------------------------------------
//  Cada producto de Voni se ancla al SUSTANTIVO con el que empieza la
//  descripción del catálogo. `requiere`: palabras que además deben aparecer
//  (p.ej. cantilever). `excluye`: variantes que NO son este producto aunque
//  compartan el sustantivo (un 'escritorio' directivo no es un 'cantilever').
//
//  Solo se mapean MUEBLES COMPLETOS: lo que el catálogo vende como artículo
//  entero. Los componentes de benching (CUBIERTA, PATA, ESTRUCTURA, CONDUCTO,
//  BIOMBO, OMEGA…) se suman por separado en otro paso; aquí caen a 'ninguno'.
//  Se busca por el PRIMER TOKEN del id de producto (escritorio_l → escritorio).
const TIPOS = {
  escritorio: { sustantivo: ['ESCRITORIO'], excluye: ['CANTILEVER', 'QVADRAT'] },
  cantilever: { sustantivo: ['ESCRITORIO'], requiere: ['CANTILEVER'] },
  qvadrat:    { sustantivo: ['ESCRITORIO'], requiere: ['QVADRAT'] },
  estacion:   { sustantivo: ['ESCRITORIO', 'ESTACION'] },
  credenza:   { sustantivo: ['CREDENZA'] },
  archivero:  { sustantivo: ['ARCHIVERO'] },
  gaveta:     { sustantivo: ['GAVETA', 'PEDESTAL'] },
  pedestal:   { sustantivo: ['GAVETA', 'PEDESTAL'] },
  rodante:    { sustantivo: ['GAVETA', 'PEDESTAL'] },
  guarda:     { sustantivo: ['GAVETA', 'GUARDARROPA', 'ARMARIO', 'GABINETE', 'LOCKER'] },
  armario:    { sustantivo: ['ARMARIO', 'GUARDARROPA'] },
  torre:      { sustantivo: ['ARMARIO', 'TORRE', 'GABINETE'] },
  locker:     { sustantivo: ['LOCKER', 'CASILLERO'] },
  librero:    { sustantivo: ['LIBRERO', 'ESTANTE', 'REPISA'] },
  gabinete:   { sustantivo: ['GABINETE'] },
  mesa:       { sustantivo: ['MESA'] },
  mesajuntas: { sustantivo: ['MESA'], requiere: ['JUNTA'] },
  sofa:       { sustantivo: ['SOFA'] },
  sillon:     { sustantivo: ['SILLON'] },
  pouf:       { sustantivo: ['POUF', 'PUFF'] },
  recepcion:  { sustantivo: ['RECEPCION', 'MOSTRADOR', 'MODULO'] },
  barra:      { sustantivo: ['BARRA'] },
};

// Las mesas comparten sustantivo (MESA) y se afinan por el sub-tipo, que Voni
// trae en el id (mesa_juntas, mesa_consejo, mesa_centro, mesa_apoyo…).
const SUBMESA = {
  juntas: ['JUNTA'], consejo: ['CONSEJO'], centro: ['CENTRO'],
  apoyo: ['APOYO'], lateral: ['LATERAL'], circular: ['CIRCULAR', 'REDONDA'],
  alta: ['ALTA'], regulable: ['REGULABLE', 'AJUSTABLE'], ajustable: ['REGULABLE', 'AJUSTABLE'],
};

/** El tipo del catálogo para un producto de Voni, o null si no se mapea. */
function tipoDeProducto(producto) {
  const id = String(producto || '').toLowerCase();
  const raiz = id.split('_')[0];
  if (raiz === 'mesa' || id === 'mesajuntas') {
    const sub = id === 'mesajuntas' ? 'juntas' : id.split('_')[1];
    const requiere = SUBMESA[sub];
    return { sustantivo: ['MESA'], requiere };
  }
  return TIPOS[raiz] || TIPOS[id] || null;
}

// --- EJES DE LA DESCRIPCIÓN -------------------------------------------------
/** El primer sustantivo de la descripción (para anclar el tipo). */
function sustantivoDe(desc) {
  return norm(desc).trim().split(/\s+/)[0] || '';
}

/**
 * El largo principal en mm que trae la descripción ("... DE 2400 X 600 ...").
 * Devuelve null si no se puede leer (algunas filas no lo traen al frente).
 */
function largoDe(desc) {
  const d = norm(desc);
  // "DE 2400 X" o "DE 2400 MM" — el primer número grande tras "DE".
  const m = d.match(/\bDE\s+(\d{3,4})\s*(?:X|MM|\b)/);
  if (m) return Number(m[1]);
  const x = d.match(/\b(\d{3,4})\s*X\s*\d{2,4}/); // "2400 X 600" sin el "DE"
  return x ? Number(x[1]) : null;
}

/** Lado del artículo: 'D', 'I' o null. */
function manoDe(desc) {
  const d = norm(desc);
  if (/\bDEREC/.test(d)) return 'D';
  if (/\bIZQU|\bIZQ\b|\bIZQ\./.test(d)) return 'I';
  return null;
}

/** Material que nombra la descripción, o null. */
function materialDe(desc) {
  const d = norm(desc);
  if (/MELAMINA/.test(d)) return 'melamina';
  if (/LAMINADO/.test(d)) return 'laminado';
  if (/CHAPA|NOGAL|WALNUT|MADERA/.test(d)) return 'chapa';
  if (/CRISTAL|VIDRIO/.test(d)) return 'vidrio';
  return null;
}

// El finish de Voni (chapa/walnut/melamina/laminado/vidrio) en términos del
// catálogo. walnut y nogal son chapa de madera; por eso caen en 'chapa'.
function finishNorm(finish) {
  const f = String(finish || '').toLowerCase();
  if (/melamina/.test(f)) return 'melamina';
  if (/laminado/.test(f)) return 'laminado';
  if (/vidrio|cristal/.test(f)) return 'vidrio';
  if (/chapa|walnut|nogal|madera/.test(f)) return 'chapa';
  return null;
}

const incluyeAlguna = (d, palabras) => palabras.some((p) => d.includes(p));

// ⚠️ 2026-08-19: EL EXCEL TRAE UNA PESTAÑA "APP" QUE NO ES SÓLO APP.
// `preciosLinea.js` se autogenera por PESTAÑA del Excel (ver su encabezado):
// cada fila hereda `ruta` de en qué pestaña vivía, no de qué marca dice su
// propia descripción. Medido: de 113 filas con `ruta:"app"`, 63 (56%) son en
// realidad ALBA, CIRQUE, RÍO o PEBBLE — cayeron ahí porque esa pestaña mezcla
// varias líneas. Encontrado porque el guardián de jerarquía cazó "App
// escritorio 0.41×": el resolvedor encontró "ESCRITORIO PEBBLES... $2,470" con
// `ruta:"app"` y lo dio por el precio real de un escritorio App — un escritorio
// PEBBLE de otra marca, no de App. `preciosLinea.js` dice "NO editar a mano",
// así que el arreglo va aquí: si la descripción del artículo nombra OTRA línea
// que no es la pedida, no es candidato, sin importar qué `ruta` traiga la fila.
// Lista corta a propósito — las marcas cuyo nombre es una palabra reconocible
// que no se confunde con texto normal de una descripción (evita "vía"/"flex"
// sueltos por ahora; si aparece contaminación de esas, se añaden con cuidado).
const OTRA_MARCA = {
  app: [/\bALBA\b/, /\bCIRQUE\b/, /\bR[IÍ]O\b/, /\bPEBBLES?\b/, /\bECLIPSE\b/, /\bLUNA\b/, /\bANTEO\b/, /\bMODULOR\b/, /\bTETRIS\b/, /\bARLEQU[IÍ]N\b/],
};
export function esDeOtraMarca(desc, ruta) {
  const patrones = OTRA_MARCA[ruta];
  if (!patrones) return false;
  return patrones.some((re) => re.test(norm(desc)));
}

/**
 * El largo pedido, en mm. Las líneas no usan la misma clave (eclipse `largoMM`,
 * cirque `medida`, rio `largo`), así que se prueban todas. Un valor chico
 * (≤ 10) se lee como metros (1.5 → 1500).
 */
function largoPedidoDe(config) {
  for (const k of ['largoMM', 'largoMm', 'medida', 'largo', 'ancho']) {
    const v = Number(config[k]);
    if (Number.isFinite(v) && v > 0) return v <= 10 ? Math.round(v * 1000) : Math.round(v);
  }
  return null;
}

/** La mano pedida normalizada a 'D' | 'I' | null (acepta der/izq/derecha…). */
function manoPedidaDe(config) {
  const m = String(config.mano || '').trim().toLowerCase();
  if (!m) return null;
  if (m === 'd' || m.startsWith('der')) return 'D';
  if (m === 'i' || m.startsWith('izq')) return 'I';
  return null;
}

/**
 * ¿El sustantivo del tipo es el PRIMER token de la descripción? Estricto a
 * propósito: "ESCRITORIO CREDENZA" es un escritorio (1er token ESCRITORIO), NO
 * una credenza. Si se permitiera el 2º token, `credenza` se llevaría los
 * escritorios-credenza y el vendedor vería precios que no pidió.
 */
function sustantivoAlFrente(desc, sustantivos) {
  return sustantivos.includes(sustantivoDe(desc));
}

/** Empaca un artículo del catálogo a la forma mínima que usa la cotización. */
function articuloMin(a) {
  return { clave: a.c, claveComercial: a.cc, descripcion: a.d, lista: a.l, full: a.f, minimo: a.m, linea: a.ln, ruta: a.ruta };
}

/**
 * Casa un item de Voni con el catálogo.
 * @param {object} item  { ruta, producto, config }
 * @returns {{ estado:'unico'|'varios'|'ninguno', articulo?, candidatos? }}
 *   · 'unico'   → `articulo`: úsalo directo (precio de lista real).
 *   · 'varios'  → `candidatos` (ordenados, el más barato primero) para que el
 *                 vendedor elija; `articulo` es el base (candidatos[0]).
 *   · 'ninguno' → no hay match confiable; el llamador calcula como siempre.
 */
export function resolverArticuloCatalogo(item) {
  if (!item || !item.ruta || !item.producto) return { estado: 'ninguno' };
  const tipo = tipoDeProducto(item.producto);
  if (!tipo) return { estado: 'ninguno' };
  const config = item.config || {};
  const largoPedido = largoPedidoDe(config);
  const manoPedida = manoPedidaDe(config);
  const finPedido = finishNorm(config.finish);

  // 1) Pool de la línea, filtrado por TIPO (sustantivo al frente + requiere/excluye).
  let pool = PRECIOS_LINEA.filter((a) => {
    if (a.ruta !== item.ruta) return false;
    if (esDeOtraMarca(a.d, item.ruta)) return false;
    const d = norm(a.d);
    if (!sustantivoAlFrente(a.d, tipo.sustantivo)) return false;
    if (tipo.requiere && !incluyeAlguna(d, tipo.requiere)) return false;
    if (tipo.excluye && incluyeAlguna(d, tipo.excluye)) return false;
    return true;
  });
  if (!pool.length) return { estado: 'ninguno' };

  // 2) Descartes DUROS por ejes que Voni sí sabe: si el artículo declara una
  //    medida/mano y NO es la pedida, no es candidato. Las filas que no
  //    declaran el eje se quedan (beneficio de la duda).
  if (largoPedido) {
    const conMedida = pool.filter((a) => largoDe(a.d) != null);
    // Si NINGUNA fila trae medida legible, no se puede afinar por ahí: se deja
    // el pool tal cual. Si algunas sí, se exige coincidencia a las que la traen.
    if (conMedida.length) {
      pool = pool.filter((a) => {
        const L = largoDe(a.d);
        return L == null || L === largoPedido;
      });
    }
  }
  if (!pool.length) return { estado: 'ninguno' };

  if (manoPedida) {
    const conMano = pool.filter((a) => manoDe(a.d) != null);
    if (conMano.length) {
      pool = pool.filter((a) => {
        const m = manoDe(a.d);
        return m == null || m === manoPedida;
      });
    }
  }
  if (!pool.length) return { estado: 'ninguno' };

  // 3) Preferencia SUAVE por material: si el pedido trae finish y hay filas que
  //    lo cumplen, nos quedamos con ellas; si no, no se descarta a nadie (en
  //    varias líneas todas las filas son del mismo material y no discrimina).
  if (finPedido) {
    const conMat = pool.filter((a) => materialDe(a.d) === finPedido);
    if (conMat.length) pool = conMat;
  }

  // 4) Resolución. Ordenados por precio de lista ascendente: el base (más
  //    sencillo/barato de lo que cumple lo pedido) primero.
  const orden = pool.slice().sort((a, b) => (a.l || 0) - (b.l || 0));
  const candidatos = orden.map(articuloMin);
  if (candidatos.length === 1) return { estado: 'unico', articulo: candidatos[0], candidatos };
  return { estado: 'varios', articulo: candidatos[0], candidatos };
}
