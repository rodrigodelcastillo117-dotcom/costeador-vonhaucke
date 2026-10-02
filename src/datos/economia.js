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
const CLAVES_ECONOMIA = /^(costo.*|margen|utilidad|materialtotal|manoobra|indirectos.*|precioproveedor|precioreal|costoderivado|factordirecta|factorindirecta|factores?|horas|preparacionhoras|insumos?|costounitario|costolinea)$/;

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
