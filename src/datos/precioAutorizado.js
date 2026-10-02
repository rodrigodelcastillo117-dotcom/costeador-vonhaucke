// ============================================================================
//  ADAPTADOR LEGACY -> PRODUCTO MAESTRO (lado cliente, SOLO precio AUTORIZADO).
//  Resuelve de forma DETERMINISTA, por `source_ref`, la identidad de Producto
//  Maestro y su PRECIO DE LISTA AUTORIZADO (NO costo), desde un snapshot generado
//  de Supabase (`fuentes/producto_maestro.json`). Sin fuzzy matching.
//
//  Identidad de source_ref (probado en productoMaestro.test.js):
//    · línea: la clave ERP `c` (= `catalogo.clave` que devuelve resolverArticulo)
//    · banco: el `id` de la pieza del banco (p.ej. "p9-app-lt-bench-doble-2120")
//
//  El PRECIO que entrega es el mismo (al peso) que resuelve cotizar-servidor
//  (regresión de centavos = 0). Es precio de VENTA autorizado, nunca costo:
//  por eso es seguro para el vendedor. La cifra OFICIAL (emisión) la revalida el
//  servidor (emitir_revision_v2 / cotizar-servidor) — esto es sólo para mostrar.
// ============================================================================
import fixture from './fuentes/producto_maestro.json';

const PRECIO = fixture.precio_por_ref || {};
const IDS = fixture.ids_por_ref || {};   // ref -> [producto_id, producto_version_id, lista_precio_item_id]

/** Precio autorizado + identidad para un source_ref, o null si no hay match único con precio. */
export function autorizadoPorRef(ref) {
  if (ref == null) return null;
  const key = String(ref);
  const precio = PRECIO[key];
  if (precio == null) return null;
  const ids = IDS[key] || [];
  return {
    source_ref: key,
    precio_lista: precio,
    producto_id: ids[0] ?? null,
    producto_version_id: ids[1] ?? null,
    lista_precio_item_id: ids[2] ?? null,
  };
}

/** ¿Existe precio autorizado para este source_ref? */
export function hayPrecioAutorizado(ref) {
  return ref != null && PRECIO[String(ref)] != null;
}

/** Cuántas identidades conoce el snapshot (diagnóstico). */
export function totalAutorizados() {
  return Object.keys(PRECIO).length;
}
