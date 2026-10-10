// ============================================================================
//  REQUERIMIENTO PENDIENTE (OPERACIÓN RESCATE, punto 4 del mandato):
//  lo que Voni NO pudo costear (ruta/producto inexistente, generador que falló,
//  material fuera de catálogo, producto sin precio autorizado, "no está en catálogo")
//  NO desaparece del proyecto para quedarse sólo en un aviso. Entra como PARTIDA
//  PENDIENTE: sin precio (null, nunca $0), `price_status:'SIN_PRECIO'`,
//  `requiere_costeo:true`, con el motivo y lo que la IA entendió. El total la cuenta
//  como "falta precio" (Voni #7) y la emisión la rechaza hasta resolverla.
// ============================================================================
export const PENDIENTE_TIPOS = Object.freeze({
  SIN_COSTEAR: 'SIN_COSTEAR',                       // el motor devolvió null
  SIN_PRECIO_AUTORIZADO: 'SIN_PRECIO_AUTORIZADO',   // vendedor: sólo precio de modelo
  ESPECIAL_MATERIAL: 'ESPECIAL_MATERIAL',           // material_override (fuera de catálogo)
  NO_EN_CATALOGO: 'NO_EN_CATALOGO',                 // la IA lo marcó en noEncontrado
  BANCO_DESCONOCIDO: 'BANCO_DESCONOCIDO',           // id de banco que no existe
});

/**
 * @param {object} base  lo que se sabe del requerimiento (etiqueta/nombre, cantidad,
 *   ruta, producto, seleccion, material_override, nota, confianza, w/d si los hay)
 * @param {{tipo:string, motivo:string}} pendiente
 */
export function partidaRequerimientoPendiente(base = {}, { tipo, motivo } = {}) {
  const cantidad = Math.max(1, Math.round(Number(base.cantidad) || 1));
  const nombre = String(base.nombre || base.etiqueta || base.producto || 'Requerimiento sin costear').trim();
  return {
    nombre,
    cantidad,
    precioUnitario: null,                      // DESCONOCIDO ≠ $0
    costoUnitario: null,
    price_status: 'SIN_PRECIO',
    requiere_costeo: true,
    pendiente_tipo: tipo || PENDIENTE_TIPOS.SIN_COSTEAR,
    motivoPendiente: motivo || null,
    ruta: base.ruta || null,
    producto: base.producto || null,
    seleccionIA: Array.isArray(base.seleccion) ? base.seleccion : null,
    material_override: base.material_override || null,
    nota: base.nota || null,
    confianza: base.confianza || null,
    sugerido: !!base.sugerido,
    w: base.w || null, d: base.d || null,
    precioReal: false,
    avisos: [`Pendiente de costeo (${tipo || PENDIENTE_TIPOS.SIN_COSTEAR}): ${motivo || 'sin motivo'}`],
  };
}

/** ¿Hay requerimientos pendientes de costeo en la cotización? (gate de emisión) */
export function requerimientosPendientes(partidas = []) {
  return (Array.isArray(partidas) ? partidas : []).filter((p) => p && (p.requiere_costeo === true || p.price_status === 'SIN_PRECIO'));
}
