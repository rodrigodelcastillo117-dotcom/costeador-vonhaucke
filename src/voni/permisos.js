// ============================================================================
//  VONI 2.0 — CAPA DE PERMISOS. Regla absoluta: LENTE != PERMISO.
//  Un vendedor que pide "actúa como CFO" NO obtiene economía interna. Lo que un
//  usuario puede VER lo decide su ROL (y la RLS del servidor), nunca la lente que
//  elija ni el documento que suba. En modo cliente, se sanea SIEMPRE, sin importar
//  el rol de quien presenta.
//
//  Esta capa es la última red del lado del cliente: el dinero real ya viene
//  filtrado por el servidor (config_para_rol, cotizacion_segura, revisiones_seguras,
//  cotizar-servidor). Aquí se re-garantiza sobre cualquier objeto que una tool
//  devuelva, por si alguna trae un campo de más.
// ============================================================================
import { sinEconomia, esClientSafe } from '../datos/economia.js';

// Roles canónicos del sistema. 'ventas' es el default seguro (menos privilegio).
export const ROLES = Object.freeze(['ventas', 'diseno', 'direccion', 'proyectos', 'costeador', 'cfo']);

// ¿El rol puede ver economía interna (costo/margen/insumos/proveedor)?
// SÓLo Dirección y Diseño (== veCostos del resto de la app). Costeador se mapea a
// Diseño para economía (es quien fabrica). CFO ve economía autorizada (precio,
// descuento, margen, utilidad) PERO no costo real/Intelisis (eso aún no existe).
const VE_ECONOMIA = new Set(['direccion', 'diseno', 'costeador', 'cfo']);

export function rolVeEconomia(role) {
  return VE_ECONOMIA.has(String(role || 'ventas'));
}

// Campos que NUNCA salen en modo cliente, además de la economía interna.
// Subcadena (no exacta): cubre variantes (aprobaciones, notasInternas, riesgoX…).
// La economía ya la quita `sinEconomia` (segunda pasada en soloCliente); esto es
// la capa extra de datos internos para modo cliente.
const PROHIBIDO_CLIENTE = /(aprobaci|approval|notainterna|internal|interno|riesgo|margen|utilidad|costo|proveedor|cxp|cxc|markup|comision)/;

function esClaveProhibidaCliente(key) {
  const norm = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return PROHIBIDO_CLIENTE.test(norm);
}

/** Copia profunda quitando claves prohibidas para cliente (economía + internos). */
export function soloCliente(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(soloCliente);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (esClaveProhibidaCliente(k)) continue;
    out[k] = soloCliente(v);
  }
  // Pasa también por la guarda de economía (defensa en profundidad).
  return sinEconomia(out);
}

/**
 * Sanea un objeto según el contexto (rol + modo cliente). Es idempotente y nunca
 * lanza. SIEMPRE se aplica a lo que devuelve una tool antes de entregarlo.
 * @param {any} obj
 * @param {{role?:string, clientSafe?:boolean}} ctx
 */
export function sanitizarPorContexto(obj, ctx = {}) {
  if (ctx.clientSafe) return soloCliente(obj);
  if (rolVeEconomia(ctx.role)) return obj;        // Dirección/Diseño/Costeador/CFO
  return sinEconomia(obj);                          // vendedor/proyectos: sin economía
}

/**
 * La lente EFECTIVA que puede usar un rol. Pedir una lente NO da permisos: si un
 * vendedor pide la lente 'cfo', se le permite el ÁNGULO de análisis, pero la
 * capa de datos sigue filtrando economía por su rol real (no verá números de costo).
 * Devuelve { lente, concedeEconomia } donde concedeEconomia SIEMPRE = rolVeEconomia(role).
 */
export function lenteEfectiva(role, lenteSolicitada) {
  const lente = lenteSolicitada || lenteDefaultDeRol(role);
  return {
    lente,                                   // el ángulo de análisis solicitado
    concedeEconomia: rolVeEconomia(role),    // el PERMISO viene del rol, no de la lente
    nota: (!rolVeEconomia(role) && ['cfo', 'costeador', 'direccion', 'diseno'].includes(lente))
      ? 'Puedo analizar desde ese ángulo, pero sin mostrar costos/márgenes: tu rol no los incluye.'
      : null,
  };
}

export function lenteDefaultDeRol(role) {
  const r = String(role || 'ventas');
  if (r === 'direccion') return 'direccion';
  if (r === 'cfo') return 'cfo';
  if (r === 'diseno') return 'diseno';
  if (r === 'costeador') return 'costeador';
  if (r === 'proyectos') return 'proyectos';
  return 'ventas';
}

/**
 * ¿El rol tiene permiso económico para una tool que expone economía?
 * Las tools económicas (get_costing/get_bom) requieren rolVeEconomia Y !clientSafe.
 */
export function puedeToolEconomica(ctx = {}) {
  return !ctx.clientSafe && rolVeEconomia(ctx.role);
}

function tieneClaveProhibidaCliente(obj) {
  if (obj == null || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(tieneClaveProhibidaCliente);
  return Object.entries(obj).some(([k, v]) => esClaveProhibidaCliente(k) || tieneClaveProhibidaCliente(v));
}

/** Verificación defensiva usada por tests: ¿este objeto es seguro para el contexto? */
export function esSeguroParaContexto(obj, ctx = {}) {
  if (ctx.clientSafe) return esClientSafe(obj) && !tieneClaveProhibidaCliente(obj);
  if (rolVeEconomia(ctx.role)) return true;
  return esClientSafe(obj);
}
