// ============================================================================
//  VONI 2.0 — EVIDENCE ENGINE + CONTRATO DE RESPUESTA.
//  Toda afirmación importante se clasifica (HECHO/INFERENCIA/SUPUESTO/
//  RECOMENDACIÓN) y puede cargar su fuente (source_type/id/label/timestamp/
//  confidence). La respuesta sintetizada sigue un contrato estable; la UI puede
//  simplificar, pero el contrato interno no cambia.
// ============================================================================

export const TIPO_AFIRMACION = Object.freeze({
  HECHO: 'HECHO',               // dato verificable de una fuente
  INFERENCIA: 'INFERENCIA',     // deducción con base razonable
  SUPUESTO: 'SUPUESTO',         // asunción por falta de dato
  RECOMENDACION: 'RECOMENDACION', // qué conviene hacer
});

export const URGENCIA = Object.freeze({ BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA', BLOQUEANTE: 'BLOQUEANTE' });
export const ESTADO = Object.freeze({ OK: 'OK', ATENCION: 'ATENCION', BLOQUEADO: 'BLOQUEADO', DESCONOCIDO: 'DESCONOCIDO' });

/**
 * Crea una afirmación con evidencia.
 * @param {string} texto
 * @param {string} tipo TIPO_AFIRMACION
 * @param {{source_type?:string, source_id?:any, source_label?:string, confidence?:number}} [fuente]
 */
export function afirmacion(texto, tipo = TIPO_AFIRMACION.HECHO, fuente = {}) {
  return {
    texto,
    tipo: TIPO_AFIRMACION[tipo] ? tipo : TIPO_AFIRMACION.INFERENCIA,
    fuente: {
      source_type: fuente.source_type || null,
      source_id: fuente.source_id ?? null,
      source_label: fuente.source_label || null,
      timestamp: fuente.timestamp || new Date().toISOString(),
      confidence: fuente.confidence ?? null,
    },
  };
}

/**
 * Contrato de respuesta estable. Campos opcionales según el caso; la UI simplifica.
 */
export function respuestaEstructurada(campos = {}) {
  return {
    que_paso: campos.que_paso || null,
    por_que: campos.por_que || null,
    impacto: campos.impacto || null,
    confianza: campos.confianza ?? null,            // 0..1
    accion: campos.accion || null,                  // qué hacer
    evidencia: Array.isArray(campos.evidencia) ? campos.evidencia : [], // afirmaciones[]
    fuente: campos.fuente || null,                  // fuente principal (opcional)
    urgencia: URGENCIA[campos.urgencia] ? campos.urgencia : URGENCIA.BAJA,
    estado: ESTADO[campos.estado] ? campos.estado : ESTADO.DESCONOCIDO,
    lentes: Array.isArray(campos.lentes) ? campos.lentes : [],
    bloqueos: Array.isArray(campos.bloqueos) ? campos.bloqueos : [],
    nota_permiso: campos.nota_permiso || null,      // p.ej. "lente CFO sin economía por tu rol"
  };
}

/** Confianza agregada (promedio) de un conjunto de afirmaciones con confidence. */
export function confianzaDe(afirmaciones) {
  const vs = (afirmaciones || []).map((a) => a?.fuente?.confidence).filter((c) => typeof c === 'number');
  if (!vs.length) return null;
  return Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 100) / 100;
}
