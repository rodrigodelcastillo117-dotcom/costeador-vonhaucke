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

// ⚠️ GATE 1 (autoridad monetaria): en RUNTIME el snapshot sólo aporta IDENTIDAD
//   (source_ref -> producto_id / version_id / lista_precio_item_id). El PRECIO del
//   snapshot (`precio_por_ref`) NO es autoridad del frontend: se usa SÓLO en pruebas
//   (productoMaestro.test.js, que importa el JSON directo). El precio de DISPLAY sale
//   del precio de lista autorizado del catálogo (preciosLinea `l` / banco.precio) y el
//   precio OFICIAL lo calcula/valida el servidor (cotizar-servidor / emitir_revision_v2).
const IDS = fixture.ids_por_ref || {};   // ref -> [producto_id, producto_version_id, lista_precio_item_id]

/** Identidad de Producto Maestro para un source_ref (SIN precio), o null si no hay match. */
export function autorizadoPorRef(ref) {
  if (ref == null) return null;
  const key = String(ref);
  const ids = IDS[key];
  if (!ids) return null;
  return {
    source_ref: key,
    producto_id: ids[0] ?? null,
    producto_version_id: ids[1] ?? null,
    lista_precio_item_id: ids[2] ?? null,
  };
}

/** ¿Existe identidad de Producto Maestro para este source_ref? */
export function hayIdentidad(ref) {
  return ref != null && IDS[String(ref)] != null;
}

/** Cuántas identidades conoce el snapshot (diagnóstico). */
export function totalAutorizados() {
  return Object.keys(IDS).length;
}
