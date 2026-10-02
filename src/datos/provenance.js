// ============================================================================
//  PROCEDENCIA (PROVENANCE) — Voni 2.0, capa PURA de interpretación.
//  (COTIZADOR VON HAUCKE 9.9 — N11)
//
//  Voni deja de ser calculadora y pasa a INTÉRPRETE COMERCIAL: cada renglón que
//  propone lleva de dónde salió. NO toca el edge (cotizar-texto) ni el dinero
//  (el precio sigue viniendo del servidor); sólo CLASIFICA señales que ya existen
//  en cada partida (deBanco/precioReal/producto_id/confianza/sugerido/
//  sinPrecioAutorizado/ruta) en un vocabulario estable para la UI.
//
//  NIVELES:
//   - CONFIRMADO          producto reconocido en Product Master + precio autorizado.
//   - INFERIDO            producto/config deducido con base razonable (confianza media
//                         o precio calibrado por línea), pero sin identidad firme.
//   - SUPUESTO            estimación: precio de modelo / confianza baja. Hay que validar.
//   - SUGERIDO            lo propuso Voni, el cliente no lo pidió (acompañante).
//   - REQUIERE_DESARROLLO producto desconocido: sin identidad ni precio autorizado.
//                         NUNCA se inventa SKU; se marca para que Diseño lo desarrolle.
//
//  Determinista y testeable: `procedenciaDePartida(pt)` no depende de red ni estado.
// ============================================================================

export const NIVELES = Object.freeze({
  CONFIRMADO: 'CONFIRMADO',
  INFERIDO: 'INFERIDO',
  SUPUESTO: 'SUPUESTO',
  SUGERIDO: 'SUGERIDO',
  REQUIERE_DESARROLLO: 'REQUIERE_DESARROLLO',
});

// Metadatos de presentación (color/etiqueta corta). Tono para badges de UI.
export const META_NIVEL = Object.freeze({
  CONFIRMADO: { etiqueta: 'Confirmado', tono: 'ok', orden: 0 },
  INFERIDO: { etiqueta: 'Inferido', tono: 'info', orden: 1 },
  SUPUESTO: { etiqueta: 'Supuesto', tono: 'ambar', orden: 2 },
  SUGERIDO: { etiqueta: 'Sugerido', tono: 'info', orden: 3 },
  REQUIERE_DESARROLLO: { etiqueta: 'Requiere desarrollo', tono: 'roja', orden: 4 },
});

function tieneIdentidad(pt) {
  return pt && (pt.producto_id != null || pt.lista_precio_item_id != null);
}
function esFirme(pt) {
  return !!(pt && (pt.precioReal || pt.deBanco));
}

/**
 * Clasifica la procedencia de UNA partida/renglón.
 * @param {object} pt partida costeada (seller-safe o no).
 * @returns {{nivel:string, etiqueta:string, tono:string, motivo:string}}
 */
export function procedenciaDePartida(pt) {
  const p = pt || {};
  let nivel;
  let motivo;

  if (p.sinPrecioAutorizado && !esFirme(p)) {
    // Fail-closed del vendedor: no hay precio autorizado y no es firme.
    nivel = NIVELES.REQUIERE_DESARROLLO;
    motivo = 'Sin precio autorizado en catálogo. Requiere revisión de Diseño; no se inventa SKU.';
  } else if (!tieneIdentidad(p) && !esFirme(p) && !p.ruta) {
    // Ni identidad, ni precio firme, ni ruta de catálogo → producto desconocido.
    // (Con ruta, aunque la confianza sea baja, es una línea conocida: SUPUESTO.)
    nivel = NIVELES.REQUIERE_DESARROLLO;
    motivo = 'Producto no identificado en catálogo. Se marca para desarrollo.';
  } else if (p.sugerido) {
    nivel = NIVELES.SUGERIDO;
    motivo = 'Propuesto por Von Haucke como complemento; el cliente no lo pidió explícitamente.';
  } else if (esFirme(p) && tieneIdentidad(p)) {
    nivel = NIVELES.CONFIRMADO;
    motivo = 'Producto reconocido en catálogo con precio autorizado.';
  } else if (esFirme(p)) {
    // Precio real (banco/lista) pero sin identidad V2 adjunta (p. ej. flujo no seller-safe).
    nivel = NIVELES.CONFIRMADO;
    motivo = 'Precio real de catálogo/banco.';
  } else if (p.confianza === 'media' || (p.ruta && p.confianza !== 'baja')) {
    nivel = NIVELES.INFERIDO;
    motivo = 'Producto/configuración deducido del texto con base razonable; conviene confirmarlo.';
  } else {
    nivel = NIVELES.SUPUESTO;
    motivo = 'Estimación: precio aproximado por modelo. Hay que validar producto y precio.';
  }

  const meta = META_NIVEL[nivel];
  return { nivel, etiqueta: meta.etiqueta, tono: meta.tono, motivo };
}

/** Cuenta partidas por nivel de procedencia. */
export function resumenProcedencia(partidas) {
  const lista = Array.isArray(partidas) ? partidas : [];
  const conteo = { CONFIRMADO: 0, INFERIDO: 0, SUPUESTO: 0, SUGERIDO: 0, REQUIERE_DESARROLLO: 0 };
  for (const p of lista) conteo[procedenciaDePartida(p).nivel] += 1;
  const total = lista.length;
  const firmes = conteo.CONFIRMADO;
  return {
    conteo,
    total,
    firmes,
    pctFirme: total ? Math.round((firmes / total) * 100) : 0,
    // Hay algo que exige acción humana antes de presentar/emitir.
    requiereAtencion: conteo.REQUIERE_DESARROLLO > 0 || conteo.SUPUESTO > 0,
  };
}

/**
 * Convierte los "no encontrados" que devuelve el edge (strings) en entradas
 * REQUIERE_DESARROLLO explícitas, para que la UI los muestre como pendientes de
 * desarrollo y no como simples faltantes silenciosos.
 */
export function desconocidosRequierenDesarrollo(noEncontrado) {
  return (Array.isArray(noEncontrado) ? noEncontrado : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .map((texto) => ({ texto, nivel: NIVELES.REQUIERE_DESARROLLO, etiqueta: META_NIVEL.REQUIERE_DESARROLLO.etiqueta }));
}

/**
 * Ensambla la INTERPRETACIÓN COMERCIAL de Voni 2.0 a partir de lo que ya se tiene
 * (sin tocar el edge): productos con procedencia, resumen, preguntas y pendientes
 * de desarrollo. `necesidades` se delega al intérprete existente (loQueEntendi) si
 * el llamador lo pasa; aquí sólo se adjunta la procedencia.
 */
export function interpretacionComercial({ partidas = [], preguntas = [], noEncontrado = [], necesidades = null } = {}) {
  const productos = partidas.map((p) => ({ ...p, procedencia: procedenciaDePartida(p) }));
  return {
    productos,
    necesidades,
    preguntas: Array.isArray(preguntas) ? preguntas.filter(Boolean) : [],
    requiereDesarrollo: desconocidosRequierenDesarrollo(noEncontrado),
    resumen: resumenProcedencia(partidas),
  };
}
