// ============================================================================
//  GUARDA DE ECONOMÍA INTERNA (primitive compartido).
//  Espejo en JS de la función SQL `jsonb_sin_economia`: detecta y elimina, de
//  forma RECURSIVA, cualquier clave que represente economía interna (costo,
//  margen, utilidad, mano de obra, indirectos, precio proveedor/real, factores,
//  horas, insumos...). Lo usan: payload client-safe (WOW), pruebas seller-safe,
//  y cualquier superficie que deba garantizar 0 claves económicas.
//
//  NOTA: `precio` y `precioUnitario`/`precioLista`/`total` NO son economía interna
//  (son precio de VENTA, que el cliente sí puede ver). Lo prohibido es el COSTO y
//  sus derivados. `precioProveedor`/`precioReal` sí se bloquean.
// ============================================================================
// Coincidencia por SUBCADENA (no exacta): las auditorías mostraron que la lista
// anclada dejaba pasar variantes reales (margenPct, utilidadBruta, detalleInsumos,
// manoDeObra, componentes, factorPrecioLista, gastosOperacion…). Esto SOLO se
// aplica a salidas ya saneadas para vendedor/cliente (a Dirección/Diseño NO se le
// aplica), así que ensanchar sólo puede ocultar MÁS costo, nunca precio de venta.
// `precioUnitario`/`precioLista`/`precio`/`total` no contienen estos tokens.
const CLAVES_ECONOMIA = /(costo|cogs|margen|utilidad|markup|manoobra|manodeobra|indirecto|proveedor|insumo|despiece|componentes|factor|preparacion|desperdicio|nomina|sueldo|salario|comision|ebitda|precioreal|preciocompra|precioderivado|materialdirecto|materialindirecto|materialtotal|gastosoperacion|horas)/;

/** ¿La clave (normalizada) es economía interna? */
export function esClaveEconomia(key) {
  const norm = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return CLAVES_ECONOMIA.test(norm);
}

/** Recorre recursivamente y devuelve las rutas de claves económicas encontradas. */
export function escaneaEconomia(obj, hits = [], ruta = '') {
  if (obj == null || typeof obj !== 'object') return hits;
  if (Array.isArray(obj)) { obj.forEach((v, i) => escaneaEconomia(v, hits, `${ruta}[${i}]`)); return hits; }
  for (const [k, v] of Object.entries(obj)) {
    if (esClaveEconomia(k)) hits.push(`${ruta}.${k}`);
    escaneaEconomia(v, hits, `${ruta}.${k}`);
  }
  return hits;
}

/** Devuelve una copia profunda SIN ninguna clave de economía interna. */
export function sinEconomia(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sinEconomia(v));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (esClaveEconomia(k)) continue;
    out[k] = sinEconomia(v);
  }
  return out;
}

/** true si el objeto no tiene NINGUNA clave de economía interna (recursivo). */
export function esClientSafe(obj) {
  return escaneaEconomia(obj).length === 0;
}

// ---------------------------------------------------------------------------
//  ESPEJO EXACTO DEL SERVIDOR (public.jsonb_sin_economia) — para el ESTADO del
//  vendedor (partidas, respaldo). Quita costo/margen/utilidad/proveedor/precio real…
//  pero CONSERVA la estructura técnica (componentes, medidas, horas) que el vendedor
//  sí puede tener: no es dinero. La regla estricta de arriba (`sinEconomia`) es para
//  DOCUMENTOS al cliente (PDF/WOW), donde ni la estructura debe viajar.
// ---------------------------------------------------------------------------
const CLAVES_ECONOMIA_SERVIDOR = /^(costo.*|cost.*|margen.*|margin.*|utilidad.*|profit.*|materialtotal|manoobra.*|laborcost.*|indirectos.*|overhead.*|precioproveedor.*|supplierprice.*|suppliercost.*|proveedor.*|supplier.*|preciocompra.*|purchaseprice.*|purchasecost.*|precioreal.*|costoderivado.*|internalcost.*|internalmargin.*)$/;
export function esClaveEconomiaServidor(key) {
  return CLAVES_ECONOMIA_SERVIDOR.test(String(key).toLowerCase().replace(/[^a-z0-9]/g, ''));
}
export function sinEconomiaServidor(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(sinEconomiaServidor);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (esClaveEconomiaServidor(k)) continue;
      out[k] = sinEconomiaServidor(x);
    }
    return out;
  }
  return v;
}
