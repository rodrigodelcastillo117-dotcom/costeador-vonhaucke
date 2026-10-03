// ============================================================================
//  INSUMOS ACOMPAÑANTES (determinista). Hay materiales que SIEMPRE arrastran otro:
//  la SUPERFICIE SÓLIDA se une con adhesivo acrílico igualado (uniones invisibles),
//  así que si hay solid surface en el despiece y NO hay adhesivo, se agrega la partida
//  —editable y borrable por el usuario—. No inventa precio (ese sale del catálogo/motor)
//  ni toca las demás piezas: sólo añade la acompañante que falte. Idempotente.
// ============================================================================

const REGLAS = [
  {
    // cualquier variante de superficie sólida (solid-surface, solid-surface-azul, …)
    cuando: (id) => /^solid-surface/.test(String(id || '')),
    insumoId: 'adhesivo-solid-surface',
    pieza: { nombre: 'Adhesivo acrílico (uniones solid surface)', insumoId: 'adhesivo-solid-surface', cantidad: 1, piezas: 1, _auto: true },
  },
];

/**
 * Devuelve el despiece con sus insumos acompañantes garantizados (sin duplicar).
 * @param {Array} componentes
 * @returns {Array} nuevo arreglo (no muta el de entrada)
 */
export function conAcompanantes(componentes = []) {
  const comps = Array.isArray(componentes) ? componentes.slice() : [];
  const ids = new Set(comps.map((c) => c && c.insumoId).filter(Boolean));
  for (const r of REGLAS) {
    const disparado = comps.some((c) => c && r.cuando(c.insumoId));
    if (disparado && !ids.has(r.insumoId)) {
      comps.push({ ...r.pieza });
      ids.add(r.insumoId);
    }
  }
  return comps;
}
