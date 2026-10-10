// Muestra sólo una referencia económica para herrajes comprados por pieza.
// NO la suma al BOM canónico ni desbloquea emisión, pues falta identidad exacta.
export function costoReferenciaHerraje(comp = {}, insumo = null, lote = 1) {
  if (!insumo || String(insumo.unidad) !== 'pza' || insumo.formato) return null;
  const precio = Number(insumo.precio ?? insumo.precioBase);
  const cantidad = Number(comp.cantidad);
  const n = Number(lote);
  if (!(Number.isFinite(precio) && precio > 0
    && Number.isFinite(cantidad) && cantidad > 0
    && Number.isFinite(n) && n >= 1)) return null;
  const total = precio * cantidad * n;
  return Number.isFinite(total) && total > 0 ? total : null;
}
