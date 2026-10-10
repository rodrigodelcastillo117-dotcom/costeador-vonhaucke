// Vista de identidad técnica: NUNCA mezcla precios de Compras con config legacy.
// Un insumo en la base NO significa que tenga economía lista para el motor.
export function catalogoDeSugerencias(insumosCosteables = {}, referenciasCompras = []) {
  const out = { ...(insumosCosteables || {}) };
  for (const ref of Array.isArray(referenciasCompras) ? referenciasCompras : []) {
    if (!ref || !ref.activo || typeof ref.id !== 'string' || typeof ref.nombre !== 'string') continue;
    if (out[ref.id]) continue; // el artículo efectivo del motor tiene precedencia
    out[ref.id] = {
      id: ref.id, nombre: ref.nombre, seccion: ref.seccion || '',
      unidad: ref.unidad_costeo || '',
      calibre: ref.calibre ?? null, espesor_mm: ref.espesor_mm ?? null,
      disponibleCosteo: false, fuenteCatalogo: 'compras',
    };
  }
  return out;
}
