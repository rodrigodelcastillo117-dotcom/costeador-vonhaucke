// ============================================================================
//  PRECIO · PROVENANCE (REALITY CUTOVER, v1)
//
//  Capa PURA. Modela UNA observación de precio de un insumo con su PROCEDENCIA
//  completa, y clasifica su estado SIN inventar nada. Es el contrato que todo
//  origen de verdad económica (evidencia real ya cargada de Von Haucke hoy;
//  Intelisis mañana) debe producir — así el CanonicalPriceResolver y el motor
//  NO cambian cuando cambie la fuente.
//
//  REGLAS DURAS (de Rodrigo):
//   · Un precio que viene de una compra real NO es "ficticio".
//   · NUNCA inventar precio. NUNCA tomar $0 como "desconocido". $0 válido sólo
//     si una evidencia real dice explícitamente $0 (regalo/promoción); la
//     AUSENCIA de precio es PENDING, no cero.
//   · NUNCA usar un precio viejo como vigente "sin indicarlo".
//   · NO asumir "última compra = vigente eternamente"; pero mientras no exista
//     una observación posterior, la última compra real es la última REFERENCIA
//     REAL CONOCIDA, claramente fechada.
//   · Jamás confundir unidad de compra con unidad de costeo (kg/hoja/m²/pieza).
//
//  No lee archivos ni red. El ingestor (parser de Excel/compras, o el provider
//  de Intelisis) alimenta aquí filas ya extraídas.
// ============================================================================

// Estado FINAL de un precio (lo decide el resolver sobre el conjunto; aquí se
// expone el enum para que todos usen los MISMOS nombres).
export const ESTADO_PRECIO = Object.freeze({
  CURRENT_VERIFIED: 'CURRENT_VERIFIED',             // evidencia real + vigencia explícita que cubre hoy
  REAL_OBSERVED_DATED: 'REAL_OBSERVED_DATED',       // compra/documento real CON fecha → evidencia suficiente
  REAL_OBSERVED_UNDATED: 'REAL_OBSERVED_UNDATED',   // real pero SIN fecha (p.ej. "ERP última compra"): real-histórico, NO "vigente/fechado"
  HISTORICAL: 'HISTORICAL',                         // real pero superado por una observación posterior, o vigencia vencida
  PROVISIONAL: 'PROVISIONAL',                       // estimado/puesto a mano; NO respaldado por documento real
  PENDING: 'PENDING',                               // sin precio utilizable → bloquea costo OFICIAL
});

// Etiqueta por TIPO DE FUENTE (no por estado). ChatGPT #6: no llamar "Compra real"
// a un T.D.C. o a una lista de proveedor; mostrar el tipo verdadero.
const ETIQUETA_FUENTE = {
  [/* INTELISIS */ 'INTELISIS']: 'Intelisis',
  [/* COMPRA_REAL */ 'COMPRA_REAL']: 'Compra real',
  [/* TDC_HUMANO */ 'TDC_HUMANO']: 'T.D.C. (costeo humano)',
  [/* CATALOGO_APROBADO */ 'CATALOGO_APROBADO']: 'Lista de proveedor',
  [/* PROVISIONAL */ 'PROVISIONAL']: 'Estimado',
};
export function etiquetaFuentePrecio(fuente) {
  return ETIQUETA_FUENTE[fuente] || 'Fuente desconocida';
}

// Tipo de fuente (de más a menos autoritativa para precio de COMPRA/costo).
export const FUENTE_PRECIO = Object.freeze({
  INTELISIS: 'INTELISIS',               // ERP autoritativo (futuro)
  COMPRA_REAL: 'COMPRA_REAL',           // OC/factura/registro de compra real de VH
  TDC_HUMANO: 'TDC_HUMANO',             // tabla de costos / costeo humano real (Alba/Rafa)
  CATALOGO_APROBADO: 'CATALOGO_APROBADO', // catálogo canónico aprobado en Supabase
  PROVISIONAL: 'PROVISIONAL',           // estimado sin documento
});

// Prioridad de fuente (desempate determinista; mayor gana). No decide vigencia,
// sólo desempata entre observaciones igual de recientes y del mismo tier.
const PRIORIDAD_FUENTE = Object.freeze({
  INTELISIS: 100,
  COMPRA_REAL: 80,
  TDC_HUMANO: 60,
  CATALOGO_APROBADO: 50,
  PROVISIONAL: 10,
});

export function prioridadFuente(fuente) {
  return PRIORIDAD_FUENTE[fuente] ?? 0;
}

// Clasificación INTRÍNSECA de UNA observación, aislada (sin mirar el conjunto).
// El resolver luego decide REAL_OBSERVED vs HISTORICAL comparando fechas.
export const INTRINSECO = Object.freeze({
  VERIFIED: 'VERIFIED',       // real + vigencia explícita vigente
  REAL: 'REAL',               // respaldada por documento real, fechada
  PROVISIONAL: 'PROVISIONAL', // estimado
  PENDING: 'PENDING',         // sin precio utilizable / sin identidad
});

const txt = (v) => String(v ?? '').trim();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Fecha ISO (YYYY-MM-DD…) → epoch ms, o null si no parsea. Determinista.
export function fechaMs(v) {
  const s = txt(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/**
 * Normaliza UNA observación de precio al contrato canónico, SIN inventar huecos.
 * Marca `issues` cuando falta evidencia; nunca rellena con ceros ni con datos
 * supuestos. Devuelve también la clasificación intrínseca.
 *
 * Contrato de entrada (campos aceptados, con alias tolerantes):
 *   canonical_insumo_id | canonicalId | insumo_id
 *   precio              (number)         — ausencia ≠ 0
 *   moneda              (default MXN)
 *   unidad_compra, unidad_costeo, conversion
 *   fuente              (FUENTE_PRECIO)
 *   source_document | source | documento
 *   source_date | fecha
 *   supplier | proveedor | referencia
 *   evidence | evidencia
 *   validity | vigencia_hasta   — fecha hasta la que la fuente afirma vigencia
 *   es_cero_real        (bool)   — true si una evidencia real dice $0 explícito
 */
export function normalizarObservacionPrecio(row = {}) {
  const precioRaw = row.precio ?? row.ultimo_costo ?? row.costo;
  const precio = num(precioRaw);
  const esCeroReal = row.es_cero_real === true;
  const fuente = FUENTE_PRECIO[txt(row.fuente).toUpperCase()] || null;

  const out = {
    canonical_insumo_id: txt(row.canonical_insumo_id || row.canonicalId || row.insumo_id) || null,
    precio,                                                 // null si ausente (NO 0)
    moneda: (txt(row.moneda) || 'MXN').toUpperCase(),
    unidad_compra: txt(row.unidad_compra || row.unidad) || null,
    unidad_costeo: txt(row.unidad_costeo || row.unidad_consumo) || null,
    conversion: num(row.conversion),
    fuente,
    source_document: txt(row.source_document || row.source || row.documento || row.folio || row.oc) || null,
    source_date: txt(row.source_date || row.fecha) || null,
    supplier: txt(row.supplier || row.proveedor || row.referencia) || null,
    evidence: txt(row.evidence || row.evidencia) || null,
    validity: txt(row.validity || row.vigencia_hasta || row.vigencia) || null,
    es_cero_real: esCeroReal,
  };

  const issues = [];
  if (!out.canonical_insumo_id) issues.push('FALTA_CANONICAL_ID');
  // $0 no es "desconocido": precio ausente ⇒ PENDING; precio<0 inválido; precio 0
  // sólo válido si una evidencia real lo afirma (es_cero_real).
  if (out.precio === null) issues.push('SIN_PRECIO');
  else if (out.precio < 0) issues.push('PRECIO_NEGATIVO');
  else if (out.precio === 0 && !esCeroReal) issues.push('PRECIO_CERO_SIN_EVIDENCIA');
  if (!out.unidad_compra) issues.push('FALTA_UNIDAD_COMPRA');
  // Si compra ≠ costeo, se exige conversión positiva (no mezclar kg/hoja/m²/pieza).
  if (out.unidad_compra && out.unidad_costeo && out.unidad_compra !== out.unidad_costeo && !(out.conversion > 0)) {
    issues.push('FALTA_CONVERSION_UNIDAD');
  }
  if (!out.fuente) issues.push('FALTA_FUENTE');

  // Clasificación intrínseca.
  const precioUtilizable = out.precio !== null && out.precio >= 0
    && !(out.precio === 0 && !esCeroReal)
    && !!out.canonical_insumo_id && !!out.unidad_compra;
  let intrinseco;
  if (!precioUtilizable) {
    intrinseco = INTRINSECO.PENDING;
  } else if (out.fuente === FUENTE_PRECIO.PROVISIONAL || (!out.source_document && !out.source_date)) {
    // Estimado o sin ningún rastro documental/fechado → PROVISIONAL (no real).
    intrinseco = INTRINSECO.PROVISIONAL;
  } else {
    // Respaldada por documento/fecha reales. VERIFIED sólo si hay vigencia
    // explícita (el resolver confirma que cubre `hoy`); si no, REAL.
    intrinseco = out.validity ? INTRINSECO.VERIFIED : INTRINSECO.REAL;
  }

  return { ...out, issues, intrinseco, precioUtilizable };
}

/**
 * Confianza [0..1] de una observación ya normalizada. Determinista. Combina
 * fuente, completitud de evidencia y rastro documental. NO mira recencia (eso
 * lo pondera el resolver con las fechas).
 */
export function confianzaObservacion(obs) {
  if (!obs || obs.intrinseco === INTRINSECO.PENDING) return 0;
  let c = 0;
  c += Math.min(1, prioridadFuente(obs.fuente) / 100) * 0.5; // hasta 0.5 por fuente
  if (obs.source_document) c += 0.2;
  if (obs.source_date) c += 0.15;
  if (obs.evidence) c += 0.1;
  if (obs.supplier) c += 0.05;
  if (obs.intrinseco === INTRINSECO.PROVISIONAL) c = Math.min(c, 0.3);
  return Math.round(Math.min(1, c) * 100) / 100;
}
