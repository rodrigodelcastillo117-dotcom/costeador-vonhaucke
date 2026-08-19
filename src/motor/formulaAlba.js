// ============================================================================
//  LA FÓRMULA DE COSTEO DE ALBA (Von Haucke, estimaciones) — 2026-08-18.
//  ---------------------------------------------------------------------------
//  Alba lo explicó por escrito y mandó un T.D.C. real ("ejemplo bench sencillo
//  con guardas"). Esta capa PURA reproduce su cuenta, verificada contra sus
//  números al centavo, para que el costeador CUADRE con el área, no se aproxime.
//
//  costo_fab = material + MO + GI, donde:
//   · MO (mano de obra) = % del MATERIAL, según el tipo de producto:
//        cubiertas 15% · metal (estructura/mampara/gaveta/pata/omega/conducto) 20%
//        · madera 20% · biombo de cristal 1% · general 20%.
//   · GI (gastos indirectos):
//        metal/madera → 3 × MO  (300% de la mano de obra)
//        cristal      → 5% del material (es compra-venta: sólo traslado/movimiento)
//
//  Verificado (T.D.C. de Alba): omega ATOM3 mat 46.67 → MO 9.33 → GI 27.99 →
//  fab 83.99; cubierta ATCUBS44ABS mat 381.84 → MO 57.28 → GI 171.84 → fab 610.96;
//  biombo cristal ATBIOCRT4 mat 717.67 → MO 7.18 → GI 35.88 → fab 760.73.
// ============================================================================

// % de mano de obra sobre el material, por tipo (criterio de Alba 2026).
export const MO_PCT = { cubierta: 15, metal: 20, madera: 20, cristal: 1, general: 20 };

// Clasifica un producto/material al tipo de Alba. `seccion`/`nombre` vienen del
// insumo o la pieza. El cristal manda (su cuenta es distinta); luego cubierta;
// luego metal; lo demás cae en 'general' (20% MO, GI 3×MO), como madera.
export function tipoAlba({ seccion, nombre, material } = {}) {
  const t = String([seccion, nombre, material].filter(Boolean).join(' ')).toLowerCase();
  if (/cristal|vidrio|templado/.test(t)) return 'cristal';
  // Las PIEZAS de metal mandan sobre la palabra "cubierta": un "omega PARA
  // cubierta" o una "pata" es metal (20% MO), no la cubierta misma (15%).
  // ⚠️ "melamina" contiene "lamina": la lámina de acero se pide con lookbehind
  // para no clasificar una cubierta de MELAMINA como metal.
  if (/estructura|mampara|gaveta|archivero|\bpata\b|omega|conducto|\briel\b|charola|\bptr\b|\btubo\b|(?<!me)l[aá]mina|\bacero\b/.test(t)) return 'metal';
  if (/cubierta/.test(t)) return 'cubierta';
  return 'general';
}

/**
 * El costo de fabricación de Alba a partir del costo de material.
 * @param {number} material  costo de la materia prima
 * @param {string} tipo      'cubierta'|'metal'|'madera'|'cristal'|'general'
 * @returns {{ material, mo, gi, fab, tipo, moPct }}
 */
export function costoAlba(material, tipo = 'general') {
  const mat = Number(material) || 0;
  const moPct = MO_PCT[tipo] != null ? MO_PCT[tipo] : MO_PCT.general;
  const mo = mat * (moPct / 100);
  // Metal/madera: los indirectos van SOBRE la mano de obra (3×). Cristal: 5% del
  // material (compra-venta, sin transformación).
  const gi = tipo === 'cristal' ? mat * 0.05 : mo * 3;
  const fab = mat + mo + gi;
  return { material: mat, mo, gi, fab, tipo, moPct };
}
