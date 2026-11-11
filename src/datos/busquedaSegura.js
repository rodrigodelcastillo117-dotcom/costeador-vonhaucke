// ============================================================================
//  Búsqueda segura para filtros PostgREST `.or()`.
//
//  PostgREST usa coma, punto, paréntesis y dos-puntos como SINTAXIS del parámetro
//  `or=(...)`. Si el texto crudo del usuario los contiene (p.ej. "a,b" o "mesa (chica)"),
//  rompe el parseo y la consulta ENTERA falla → la pantalla mostraba "No se pudo cargar
//  el catálogo" en vez de resultados. También es una mini-inyección de filtro.
//  Aquí se neutralizan esos caracteres a comodín (%) antes de armar el filtro, conservando
//  la búsqueda difusa: "mesa (chica)" → "mesa %chica%", "a,b" → "a%b".
// ============================================================================

/** Convierte texto crudo del usuario en un valor seguro para un patrón ilike dentro de `.or()`. */
export function sanearTermino(term) {
  return String(term == null ? '' : term)
    .trim()
    .replace(/[,().:*"\\]/g, '%')   // caracteres que rompen la sintaxis/comillas de .or() → comodín
    .replace(/%{2,}/g, '%');        // colapsa comodines repetidos
}

/**
 * Arma el string de `.or()` para buscar un término (difuso, ilike) en varias columnas.
 * @returns string listo para `query.or(...)`, o null si no hay término/columnas (no filtrar).
 */
export function orIlike(term, columnas = []) {
  const s = sanearTermino(term);
  if (!s || !Array.isArray(columnas) || !columnas.length) return null;
  return columnas.map((c) => `${c}.ilike.%${s}%`).join(',');
}
