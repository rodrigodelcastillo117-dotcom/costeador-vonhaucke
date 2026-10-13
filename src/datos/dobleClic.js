// ============================================================================
//  SEGURO DE DOBLE CLIC al agregar a la cotización — Área J (resiliencia), defecto R-06.
//  Medido en e2e/resiliencia.e2e.js (5a/5b): un doble clic en "Agregar →" (artículo de línea) o en
//  "Agregar a la cotización" (Cotizar de línea) metía DOS partidas idénticas → el total se duplicaba sin que
//  nadie lo pidiera. Un agregado IDÉNTICO (mismo producto, configuración, cantidad y precio) dentro de la
//  ventana se ignora; un segundo clic deliberado (fuera de la ventana) o un producto distinto sí entran.
// ============================================================================
export const VENTANA_DOBLE_CLIC_MS = 800;

export function firmaAgregado(partidas) {
  return JSON.stringify((partidas || []).map((p) => [
    p?.nombre ?? null, p?.cantidad ?? null, p?.precioUnitario ?? null,
    p?.productoId ?? p?.piezaId ?? null, p?.config ?? null, p?.producto_id ?? null,
  ]));
}

/** Devuelve `esRepetido(firma)`: true si la MISMA firma se registró hace menos de `ventanaMs`. */
export function crearSeguroDobleClic({ ventanaMs = VENTANA_DOBLE_CLIC_MS, ahora = () => Date.now() } = {}) {
  let ultima = null;
  return (firma) => {
    const t = ahora();
    if (ultima && ultima.firma === firma && t - ultima.t < ventanaMs) return true;
    ultima = { firma, t };
    return false;
  };
}
