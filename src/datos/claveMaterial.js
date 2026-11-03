// ============================================================================
//  CLAVE DE MEMORIA DE MATERIAL (Parte B · "confirma una vez → se reusa").
//  Normaliza el texto que pidió el usuario (material_solicitado) a una CLAVE
//  ESTABLE, para recordar el amarre aprobado y reusarlo en el próximo mueble sin
//  volver a preguntar. Determinista, sin red.
//
//  Reglas: minúsculas, sin acentos, sin medidas (mm/cm/calibre/AxB) ni claves con
//  guion, sin puntuación; tokens significativos únicos y ORDENADOS → así
//  "Remache pop AM-46 aluminio" y "aluminio remache pop" dan la MISMA clave.
//  La memoria generaliza por material pedido, no por la clave PDM exacta.
// ============================================================================

const STOP = new Set([
  'para', 'con', 'del', 'los', 'las', 'una', 'uno', 'por', 'sin', 'kit', 'juego',
  'pza', 'pieza', 'piezas', 'the', 'and', 'tipo', 'modelo', 'marca', 'color',
]);

/**
 * @param {string} solicitado  texto del material pedido (material_solicitado o nombre)
 * @returns {string} clave normalizada estable ('' si no queda nada significativo)
 */
export function normalizarClaveMaterial(solicitado = '') {
  const base = String(solicitado || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')          // sin acentos
    .toLowerCase()
    .replace(/cal(?:ibre)?\.?\s*\d+/g, ' ')                     // calibre
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm|m|kg|w|watts?|")\b/g, ' ') // medidas/unidades
    .replace(/\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\s*[x×]\s*\d+)?\b/g, ' ') // dimensiones AxB(xC)
    .replace(/[^a-z0-9\s]/g, ' ')                               // puntuacion/claves con guion
    .replace(/\s+/g, ' ').trim();
  const toks = base.split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).sort();
  return [...new Set(toks)].join(' ');
}
