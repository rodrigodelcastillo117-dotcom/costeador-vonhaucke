// ============================================================================
//  COTIZAR UN ARTÍCULO DE LÍNEA con los precios oficiales del Excel.
//  ---------------------------------------------------------------------------
//  Rodrigo (2026-08-18) definió las reglas del negocio:
//
//  · DOS BASES de precio, se elige UNA al inicio de la cotización (un switch):
//      - 'lista' (lo normal): se parte del PRECIO LISTA. El descuento NO puede
//        bajar del PISO —el Precio Mínimo, o la lista misma si el mínimo es 0
//        ("no se descuenta")—. Bajar del piso es decisión de Dirección.
//      - 'full'  (Gobierno y ciertos asesores, pocos en IP): se parte del
//        PRECIO 2 (FULL) y el descuento lo teclea LIBRE el vendedor. Lo pide el
//        cliente, no depende de la cantidad de material. Aquí no hay tope, pero
//        se avisa si el precio final cae por debajo del piso, para que se vea.
//
//  Esta capa es PURA (sin React): recibe una clave y las condiciones, devuelve
//  el precio y las banderas. La pantalla decide si topa o sólo avisa.
// ============================================================================
import { articuloPorClave } from './preciosLinea.js';

/** Piso de descuento de un artículo ya resuelto. */
function pisoDeArticulo(a) {
  return a.m > 0 ? a.m : a.l;   // mínimo, o la lista si el mínimo es 0
}

/**
 * Cotiza un artículo del catálogo de línea.
 * @param {string} clave  clave ERP o comercial
 * @param {object} opts
 *   @param {'lista'|'full'} opts.base   base de precio (default 'lista')
 *   @param {number} opts.descuentoPct   descuento a aplicar, 0–100
 * @returns objeto con { precio, bruto, piso, bajoPiso, ... } o null si no coincide.
 */
export function cotizarArticulo(clave, { base = 'lista', descuentoPct = 0 } = {}) {
  const a = articuloPorClave(clave);
  if (!a) return null;
  const bruto = base === 'full' ? a.f : a.l;
  const piso = pisoDeArticulo(a);
  // El descuento se acota a [0,100] SIEMPRE (un descuento negativo sería un
  // recargo escondido, y >100 daría precio negativo: los dos ya mordieron aquí).
  const dpct = Math.max(0, Math.min(100, Number(descuentoPct) || 0));
  let precio = Math.round(bruto * (1 - dpct / 100));
  // En base LISTA el piso MANDA: el descuento no puede bajar de ahí sin visto
  // bueno. La capa de datos lo TOPA y lo marca; la pantalla decide qué hacer.
  let topadoAlPiso = false;
  if (base === 'lista' && precio < piso) { precio = piso; topadoAlPiso = true; }
  return {
    clave: a.c, claveComercial: a.cc, descripcion: a.d, linea: a.ln, ruta: a.ruta,
    base, bruto, descuentoPct: dpct, precio,
    piso, topadoAlPiso, bajoPiso: precio < piso,
    full: a.f, lista: a.l, minimo: a.m,
  };
}

/**
 * Descuento máximo (%) que se puede dar sin bajar del piso, en base LISTA.
 * En base FULL el descuento es libre, así que devuelve null.
 */
export function descuentoMaximo(clave, base = 'lista') {
  const a = articuloPorClave(clave);
  if (!a) return null;
  if (base === 'full') return null;                 // libre
  const piso = pisoDeArticulo(a);
  if (!(a.l > 0)) return 0;
  return Math.max(0, Math.round((1 - piso / a.l) * 100));
}
