// ============================================================================
//  Elegir a mano el artículo exacto de una pieza (buscador ERP) lo aplica a sus HERMANAS: las demás piezas que tenían
//  EL MISMO material propuesto y que ninguna persona ha decidido todavía (lab Costear 2026-10-13, librero 5×8).
//  Antes: la persona elegía "AME28152 WALNUT 5×8" para los laterales y el piso, el techo y los 4 entrepaños —del
//  mismo tablero— se quedaban en el curado 4×8: el mismo mueble costeado con dos hojas distintas.
//  No toca piezas con decisión humana (material_confirmado), excluidas, ni piezas sin material (no son "el mismo").
// ============================================================================

/**
 * @param {object[]} comps      componentes del BOM (ya con la pieza `i` modificada o no; sólo se miran las demás)
 * @param {number}   i          índice de la pieza que la persona cambió
 * @param {string}   prevId     material que la pieza tenía ANTES del cambio
 * @param {string}   nuevoId    material elegido
 * @param {(c: object) => object} aplicar  mismo parche que recibió la pieza `i` (medidas + confirmación humana)
 * @returns {{ comps: object[], aplicadas: string[] }}
 */
export function aplicarAHermanas(comps, i, prevId, nuevoId, aplicar) {
  const lista = Array.isArray(comps) ? comps : [];
  if (!prevId || !nuevoId || prevId === nuevoId) return { comps: lista, aplicadas: [] };
  const aplicadas = [];
  const out = lista.map((c, j) => {
    if (j === i || !c || c.excluida || c.insumoId !== prevId || c.material_confirmado === true) return c;
    aplicadas.push(c.nombre || `pieza ${j + 1}`);
    return aplicar(c);
  });
  return { comps: out, aplicadas };
}
