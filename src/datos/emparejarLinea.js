// ============================================================================
//  EMPAREJAR UN DESPIECE DE IA A UN PRODUCTO DE LÍNEA (FASE 17, 2026-11-03)
//  --------------------------------------------------------------------------
//  Motivación (medida con ground truth): cuando la IA lee una FOTO/TEXTO de un
//  mueble que resulta ser de LÍNEA (p. ej. Eclipse Drift), hoy arma un despiece
//  DESDE CERO. Para un producto de línea eso es: (a) más lento, (b) expuesto al
//  error de estimar medidas desde una foto (en la prueba, el fondo salió +12.5 %),
//  cuando lo correcto es IDENTIFICAR el SKU y usar su PRECIO DE LÍNEA documentado.
//
//  Este módulo PURO toma los atributos estructurados que la IA ya devuelve (tipo,
//  nº de puertas/cajones, largo/fondo, material) y los puntúa contra los nombres
//  (estructurados) de los productos de línea del catálogo, para SUGERIR el SKU más
//  probable. Reglas de casa (misión §4/§6, FASE 17):
//    · SUGIERE, nunca auto-selecciona ni auto-aprueba (lo confirma un humano).
//    · No inventa ni cambia precios: sólo apunta a un SKU existente cuyo precio ya
//      está documentado. Si no hay match fuerte, no fuerza ninguno.
//    · Determinista y testeable sin red.
// ============================================================================

import { PRECIOS_LINEA } from './preciosLinea.js';

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Extrae {familia, puertas, cajones, largoMM, fondoMM, altoMM, material} del NOMBRE estructurado de un producto. */
export function parsearNombreProducto(prod = {}) {
  const nombre = String(prod.nombre || '');
  const t = nombre.toUpperCase();
  const num = (re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
  // "... DE 1800 X 400" o "... DE 1800 X 400 X 600" (mm). Toma el PRIMER grupo de medidas.
  const dim = t.match(/\bDE\s+(\d{2,5})\s*[X×]\s*(\d{2,4})(?:\s*[X×]\s*(\d{2,4}))?\s*(?:MM|M\b)?/);
  const material = /CHAPA\s+DE\s+MADERA/.test(t) ? 'madera'
    : /CRISTAL|VIDRIO|TEMPLADO/.test(t) ? 'cristal'
    : /MELAMINA/.test(t) ? 'melamina'
    : /ECOPIEL/.test(t) ? 'ecopiel'
    : null;
  return {
    familia: sinAcentos(prod.familia || ''),
    puertas: num(/(\d+)\s+PUERTAS?/),
    cajones: num(/(\d+)\s+CAJONES?/),
    largoMM: dim ? Number(dim[1]) : null,
    fondoMM: dim ? Number(dim[2]) : null,
    altoMM: dim && dim[3] ? Number(dim[3]) : null,
    material,
  };
}

// Palabras-número en español ("una puerta", "dos cajones") → entero.
const PAL_NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };
function contarEnTexto(txt, sustantivo) {
  // Busca "<n|palabra> <sustantivo>s?" y toma el MAYOR (evita subcontar; "2 cajones" > "cajón").
  const re = new RegExp(`(\\d+|${Object.keys(PAL_NUM).join('|')})\\s+${sustantivo}(?:es|s)?\\b`, 'gi');
  let m, best = null;
  while ((m = re.exec(sinAcentos(txt))) !== null) {
    const v = /^\d+$/.test(m[1]) ? Number(m[1]) : PAL_NUM[m[1]];
    if (Number.isFinite(v)) best = Math.max(best ?? 0, v);
  }
  return best;
}

/** Normaliza los atributos que la IA ya devuelve (propuesta de analizar-mueble) a la misma forma. */
export function atributosDeIA(propuesta = {}) {
  const piezas = Array.isArray(propuesta.piezas) ? propuesta.piezas : [];
  const rol = (r) => piezas.filter((p) => sinAcentos(p.semantic_role || p.tipo || '').includes(r));
  const sumCant = (arr) => arr.reduce((s, p) => s + (Number(p.cantidad) || 1), 0);
  // Config: PRIMERO del texto (producto/descripcionCliente) — más fiable que los roles crudos
  // (donde "puerta" puede ser "frentes" agregados y "gaveta" son cajas, no el nº de cajones).
  const texto = `${propuesta.producto || ''} ${propuesta.descripcionCliente || ''}`;
  const puertas = contarEnTexto(texto, 'puerta') ?? (rol('puerta').length ? sumCant(rol('puerta')) : null);
  const cajones = contarEnTexto(texto, 'cajon') ?? (rol('cajon').length ? sumCant(rol('cajon')) : null);
  // largo: el de la cubierta más grande.
  const cubiertas = piezas.filter((p) => sinAcentos(p.semantic_role || '').includes('cubierta'));
  const largoMM = cubiertas.reduce((mx, p) => Math.max(mx, Number(p.largoMM) || 0), 0) || null;
  const fondoMM = cubiertas.reduce((mx, p) => Math.max(mx, Number(p.anchoMM) || 0), 0) || null;
  const matTxt = sinAcentos([propuesta.producto, ...(propuesta.materiales || [])].join(' '));
  const material = /chapa|madera|nogal|roble|encino/.test(matTxt) ? 'madera'
    : /cristal|vidrio|templado/.test(matTxt) ? 'cristal'
    : /melamina/.test(matTxt) ? 'melamina' : null;
  const familiaHint = sinAcentos(`${propuesta.producto || ''} ${propuesta.tipo || ''}`);
  return { familiaHint, puertas: puertas || null, cajones, largoMM, fondoMM, material };
}

const TOL_LARGO = 60;   // mm — una foto puede fallar ~1 tablero de canto
const TOL_FONDO = 120;  // mm — el fondo es lo que peor se estima desde foto (medido: +12.5%)

/**
 * Puntúa un producto de línea contra los atributos de la IA. 0..100.
 * El PESO FUERTE es la configuración (puertas+cajones): es lo que define el SKU.
 */
export function puntuarLinea(ia, prod) {
  const p = parsearNombreProducto(prod);
  let score = 0; const razones = [];
  // Config puertas/cajones — señal primaria.
  if (ia.puertas != null && p.puertas != null) {
    if (ia.puertas === p.puertas) { score += 30; razones.push(`puertas=${p.puertas}`); }
    else score -= 15;
  }
  if (ia.cajones != null && p.cajones != null) {
    if (ia.cajones === p.cajones) { score += 30; razones.push(`cajones=${p.cajones}`); }
    else score -= 15;
  }
  // Familia (si la IA la insinúa en el texto).
  if (p.familia && ia.familiaHint && ia.familiaHint.includes(p.familia.split(' ')[0])) {
    score += 20; razones.push(`familia:${p.familia}`);
  }
  // Dimensiones.
  if (ia.largoMM && p.largoMM) {
    const d = Math.abs(ia.largoMM - p.largoMM);
    if (d <= TOL_LARGO) { score += 12; razones.push(`largo≈${p.largoMM}`); } else score -= Math.min(10, d / 100);
  }
  if (ia.fondoMM && p.fondoMM) {
    const d = Math.abs(ia.fondoMM - p.fondoMM);
    if (d <= TOL_FONDO) { score += 6; razones.push(`fondo≈${p.fondoMM}`); }
  }
  // Material.
  if (ia.material && p.material && ia.material === p.material) { score += 8; razones.push(`material:${p.material}`); }
  return { score: Math.max(0, Math.round(score)), razones, parsed: p };
}

/**
 * Sugerencia de SKU de línea para un despiece de IA. NUNCA auto-selecciona.
 * @returns {{ sugerencias: Array<{producto, score, confianza, razones}>, mejor, confianza }}
 */
export function emparejarLinea(propuesta, productos = []) {
  const ia = propuesta && propuesta.piezas ? atributosDeIA(propuesta) : (propuesta || {});
  const rank = (Array.isArray(productos) ? productos : [])
    .map((prod) => { const r = puntuarLinea(ia, prod); return { producto: prod, score: r.score, razones: r.razones }; })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  // Confianza calibrada: ALTA ("es este SKU, seguro") SÓLO si además coincide la FAMILIA.
  // Un match por forma (config+dims+material) sin familia nombrada se queda en MEDIA: coincide con
  // la silueta de un producto de línea, pero muchos custom comparten esa silueta → "podría ser, confírmalo".
  // Evita que un mueble "a la medida" se afirme como un SKU de catálogo a precio de catálogo.
  const conf = (s, famMatch) => {
    if (s >= 70 && famMatch) return 'ALTA';
    if (s >= 45) return 'MEDIA';
    return 'BAJA';
  };
  const sugerencias = rank.slice(0, 5).map((x) => ({
    ...x,
    confianza: conf(x.score, x.razones.some((r) => String(r).startsWith('familia'))),
  }));
  const mejor = sugerencias[0] || null;
  return {
    ia,
    sugerencias,
    mejor,
    confianza: mejor ? mejor.confianza : 'NINGUNA',
    // Decisión explícita: SIEMPRE requiere confirmación humana; el emparejador sólo propone.
    requiereConfirmacionHumana: true,
    autoseleccionado: null,
  };
}

// --- Segmentación multi-producto (FASE 17 #2) ---------------------------------
// Una foto/plano puede traer VARIOS muebles (p. ej. "escritorio en L con credenza").
// Para emparejar/costear bien, conviene separarlos: el fondo del escritorio (800) no
// debe mezclarse con la config de la credenza (1 puerta, 2 cajones). Agrupa las piezas
// del despiece por el MUEBLE al que pertenecen, leyendo el sustantivo en el nombre de
// cada pieza ("Cubierta escritorio", "Patas credenza"). Determinista, sin IA.

const MUEBLES_SEG = ['escritorio', 'credenza', 'mesa', 'silla', 'sillon', 'librero', 'archivero',
  'gaveta', 'pedestal', 'recepcion', 'mostrador', 'banca', 'mampara', 'biombo', 'cajonera', 'buro', 'estante'];

/** ¿A qué mueble pertenece esta pieza, por su nombre? null si no se puede decir. */
export function muebleDePieza(pieza = {}) {
  const t = sinAcentos(`${pieza.nombre || ''} ${pieza.semantic_role || ''}`);
  for (const m of MUEBLES_SEG) if (t.includes(m)) return m;
  return null;
}

/**
 * Segmenta un despiece de IA en sub-productos por mueble.
 * @returns {{ multiProducto:boolean, segmentos: Array<{ mueble:string, piezas:Array, nPiezas:number }>, sinClasificar:number }}
 * Si no logra distinguir ≥2 muebles, devuelve un solo segmento (el producto completo).
 */
export function segmentarPorProducto(propuesta = {}) {
  const piezas = Array.isArray(propuesta.piezas) ? propuesta.piezas : [];
  const grupos = new Map();
  let sinClasificar = 0;
  for (const p of piezas) {
    const m = muebleDePieza(p);
    if (!m) { sinClasificar += 1; continue; }
    if (!grupos.has(m)) grupos.set(m, []);
    grupos.get(m).push(p);
  }
  const segmentos = [...grupos.entries()].map(([mueble, ps]) => ({ mueble, piezas: ps, nPiezas: ps.length }))
    .sort((a, b) => b.nPiezas - a.nPiezas);
  // Las piezas sin clasificar (herrajes/pintura/tornillería comunes) se adjuntan al segmento mayor,
  // no se pierden. Si hay 0 ó 1 mueble distinto, no es multi-producto: un solo segmento con todo.
  if (segmentos.length <= 1) {
    return { multiProducto: false, segmentos: segmentos.length ? segmentos : [{ mueble: propuesta.tipo || 'producto', piezas, nPiezas: piezas.length }], sinClasificar };
  }
  return { multiProducto: true, segmentos, sinClasificar };
}

/** Construye una sub-propuesta costeable/emparejable para UN segmento (hereda textos para la config). */
export function propuestaDeSegmento(propuesta, segmento) {
  return {
    producto: `${propuesta.producto || ''}`,
    descripcionCliente: propuesta.descripcionCliente || '',
    tipo: segmento.mueble,
    materiales: propuesta.materiales || [],
    piezas: segmento.piezas,
  };
}

// --- Wiring a los PRECIOS DE LÍNEA del cliente (precio de lista real por SKU) ---

/** Convierte el catálogo de precios de línea (PRECIOS_LINEA) a candidatos para el emparejador. */
export function candidatosDePreciosLinea(lista = PRECIOS_LINEA) {
  return (Array.isArray(lista) ? lista : []).map((a) => ({
    id: a.c, codigo: a.c, familia: a.ln, nombre: a.d, ruta: a.ruta,
    precioLista: a.l ?? null, piso: a.m ?? null,
  }));
}

/**
 * Para COSTEAR: ante un despiece de IA, ¿se parece a un producto de LÍNEA con precio documentado?
 * Devuelve el mejor SKU, su PRECIO DE LISTA real y las alternativas (misma config, distinto material/acabado)
 * para que el humano elija. NO auto-selecciona ni cambia precios: sólo apunta a precios YA documentados.
 * El valor: evita costear a la medida un producto de línea y amarra al precio correcto por material
 * (p. ej. chapa de madera $33,270 vs melamina $19,240 — distinguir el material es $14k).
 */
export function sugerirLineaParaCosteo(propuesta, candidatos = candidatosDePreciosLinea()) {
  const r = emparejarLinea(propuesta, candidatos);
  const mejor = r.mejor;
  return {
    ...r,
    esProbableLinea: !!mejor && (mejor.confianza === 'ALTA' || mejor.confianza === 'MEDIA'),
    sku: mejor ? mejor.producto.codigo : null,
    precioLista: mejor ? (mejor.producto.precioLista ?? null) : null,
    alternativas: r.sugerencias.map((s) => ({
      codigo: s.producto.codigo, precioLista: s.producto.precioLista ?? null,
      confianza: s.confianza, razones: s.razones,
    })),
  };
}
