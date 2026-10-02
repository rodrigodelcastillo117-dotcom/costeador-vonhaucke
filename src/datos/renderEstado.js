// ============================================================================
//  ESTADO Y VERSIONADO DE RENDERS — N8. Capa PURA.
//  Un render se liga a lo que representa (revisión + hashes de BOM/config/layout).
//  Si algo de eso cambia, el render queda DESACTUALIZADO (no se borra el anterior:
//  se conserva el historial). El render NUNCA es autoridad geométrica; es muestra.
// ============================================================================

export const TIPOS_RENDER = Object.freeze({ PRODUCTO: 'PRODUCTO', AMBIENTE: 'AMBIENTE' });
export const ESTADOS_RENDER = Object.freeze({
  GENERAR: 'GENERAR',
  GENERANDO: 'GENERANDO',
  LISTO: 'LISTO',
  ERROR: 'ERROR',
  DESACTUALIZADO: 'DESACTUALIZADO',
});

// djb2 estable sobre JSON ordenado (no depende de orden de llaves).
function estable(obj) {
  if (obj == null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(estable).join(',') + ']';
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + estable(obj[k])).join(',') + '}';
}
export function hashContenido(obj) {
  const s = estable(obj);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

let _n = 0;
function nuevoId() {
  _n += 1;
  return `r_${Date.now().toString(36)}_${_n}`;
}

/** Crea un render en estado GENERAR, con las huellas de lo que representa. */
export function nuevoRender({ tipo = TIPOS_RENDER.AMBIENTE, revision = null, bom_hash = null, config_hash = null, layout_hash = null, ref = null } = {}) {
  return {
    render_id: nuevoId(),
    tipo: TIPOS_RENDER[tipo] ? tipo : TIPOS_RENDER.AMBIENTE,
    ref,                 // producto/expediente/cotización al que pertenece
    revision,
    bom_hash, config_hash, layout_hash,
    estado: ESTADOS_RENDER.GENERAR,
    url: null,
    error: null,
    fecha: new Date().toISOString(),
  };
}

export function marcarGenerando(r) { return { ...r, estado: ESTADOS_RENDER.GENERANDO, error: null }; }
export function marcarListo(r, url) { return { ...r, estado: ESTADOS_RENDER.LISTO, url: url || r.url, error: null, fecha: new Date().toISOString() }; }
export function marcarError(r, msg) { return { ...r, estado: ESTADOS_RENDER.ERROR, error: String(msg || 'No se pudo generar el render') }; }

/**
 * ¿El render quedó desactualizado respecto a las huellas actuales?
 * Sólo tiene sentido si está LISTO (o ya marcado DESACTUALIZADO). Compara las
 * huellas presentes (ignora las null para no marcar falso-positivo).
 */
export function estaDesactualizado(r, hashesActuales = {}) {
  if (!r || (r.estado !== ESTADOS_RENDER.LISTO && r.estado !== ESTADOS_RENDER.DESACTUALIZADO)) return false;
  const campos = ['bom_hash', 'config_hash', 'layout_hash'];
  return campos.some((k) => hashesActuales[k] != null && r[k] != null && hashesActuales[k] !== r[k]);
}

/** Devuelve el render con estado recalculado (LISTO→DESACTUALIZADO si cambió). */
export function evaluarRender(r, hashesActuales = {}) {
  if (estaDesactualizado(r, hashesActuales)) return { ...r, estado: ESTADOS_RENDER.DESACTUALIZADO };
  return r;
}

/**
 * Historial ordenado (más reciente primero) con el estado recalculado. Nunca
 * borra: conserva todos. Marca `vigente` al render LISTO más nuevo.
 */
export function historial(renders, hashesActuales = {}) {
  const lista = (renders || []).map((r) => evaluarRender(r, hashesActuales));
  lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const vigenteId = lista.find((r) => r.estado === ESTADOS_RENDER.LISTO)?.render_id || null;
  return lista.map((r) => ({ ...r, vigente: r.render_id === vigenteId }));
}

const ETIQUETA = {
  GENERAR: 'Generar', GENERANDO: 'Generando…', LISTO: 'Listo', ERROR: 'Error', DESACTUALIZADO: 'Desactualizado',
};
export function etiquetaEstado(estado) { return ETIQUETA[estado] || estado; }
