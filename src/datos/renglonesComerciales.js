// ============================================================================
//  RENGLONES COMERCIALES · fronteras de dinero a centavos (lógica pura extraída de App.jsx, 2026-10-14).
//  Refactor puro: mismas salidas que las funciones que vivían en el componente. Se prueban por
//  comportamiento en moneyBoundaries.test.js (antes: búsqueda de texto en App.jsx).
// ============================================================================
import { aCentavosEnteros, dinero } from '../motor/dinero.js';
import { costoImplicito } from './preciosVenta.js';

// Dos renglones del MISMO mueble al mismo precio son un solo renglón con más piezas. Se agrupa por lo
// que de verdad lo hace el mismo mueble —nombre, precio AL CENTAVO, producto y configuración—, nunca
// por nombre solo: dos muebles que se llaman igual con distinto acabado SÍ son renglones distintos, y
// dos precios que difieren en un centavo tampoco se funden (antes se comparaba al peso entero).
export const mismoRenglon = (a, b) =>
  a.nombre === b.nombre &&
  aCentavosEnteros(a.precioUnitario) === aCentavosEnteros(b.precioUnitario) &&
  (a.piezaId || null) === (b.piezaId || null) &&
  (a.ruta || null) === (b.ruta || null) &&
  (a.productoId || null) === (b.productoId || null) &&
  JSON.stringify(a.config || null) === JSON.stringify(b.config || null);

export function juntarIguales(lista) {
  const out = [];
  for (const p of lista) {
    const ya = out.find((q) => mismoRenglon(q, p));
    if (ya) ya.cantidad = (ya.cantidad || 0) + (p.cantidad || 0);
    else out.push({ ...p });
  }
  return out;
}

// Costo DERIVADO (no medido) de una pieza del Banco: MUEBLE → precio 2 = precio ÷ 0.60; SILLERÍA → el
// precio tal cual; costo = precio 2 ÷ 3.6 (cascada VH), redondeado a CENTAVOS con dinero() — nunca al
// peso entero. Ver la nota larga en App.jsx (agregarDeBanco).
export const costoDeBanco = (item) => {
  const p = Number(item?.precio) || 0;
  if (!p) return 0;
  const esSilleria = item?.categoria === 'Sillería';
  const precio2 = esSilleria ? p : p / 0.60;
  return dinero(costoImplicito(precio2));
};

export const margenDeBanco = (item) => {
  const c = costoDeBanco(item), p = Number(item?.precio) || 0;
  return p > 0 && c > 0 ? Math.round(((p - c) / p) * 100) : null;
};

/**
 * ¿Cambió el costo entre lo guardado y el re-costeo de hoy? Compara a CENTAVOS: un centavo SÍ es
 * diferencia; un dato desconocido (null/NaN/'') no se reporta como cambio. (Extraído de AsistenteEspecial.)
 */
export function difierenAlCentavo(a, b) {
  const ca = aCentavosEnteros(a), cb = aCentavosEnteros(b);
  return ca != null && cb != null && ca !== cb;
}
