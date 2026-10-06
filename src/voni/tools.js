// ============================================================================
//  VONI 2.0 — TOOL REGISTRY. Schema estable, auth + permiso + filtrado de campos.
//  Una tool NUNCA devuelve un volcado crudo de la DB: su salida SIEMPRE pasa por
//  `sanitizarPorContexto` (rol + modo cliente). Las tools económicas exigen
//  permiso económico real (rolVeEconomia && !clientSafe); si no, se bloquean.
//
//  El REGISTRO es metadata pura (sin red). La ejecución delega en un PROVEEDOR
//  inyectable (`prov[nombre](ctx, args) -> data`). En producción el proveedor
//  envuelve crm.js/nube.js; en tests se inyecta uno falso (determinista).
// ============================================================================
import { sanitizarPorContexto, puedeToolEconomica } from './permisos.js';

// name: identificador estable (contrato). economica: expone costo/margen.
// roles: null = todos los permitidos; lista = sólo esos roles.
export const TOOLS = Object.freeze([
  { nombre: 'get_project_context', economica: false, roles: null, desc: 'Datos del proyecto (cliente, etapa, budget, próxima acción).' },
  { nombre: 'get_scope', economica: false, roles: null, desc: 'Alcance por zona (ScopeModel).' },
  { nombre: 'get_quote', economica: false, roles: null, desc: 'Cotización seller-safe (precio de venta, sin costo).' },
  { nombre: 'get_revision', economica: false, roles: null, desc: 'Revisiones emitidas (sanitizadas).' },
  { nombre: 'compare_revisions', economica: false, roles: null, desc: 'Diff entre dos revisiones.' },
  { nombre: 'get_scenarios', economica: false, roles: null, desc: 'Escenarios del proyecto.' },
  { nombre: 'get_product', economica: false, roles: null, desc: 'Un producto del Producto Maestro.' },
  { nombre: 'search_products', economica: false, roles: null, desc: 'Búsqueda en Producto Maestro.' },
  { nombre: 'get_layout', economica: false, roles: null, desc: 'Estado del acomodo/layout.' },
  { nombre: 'get_reconciliation', economica: false, roles: null, desc: 'Reconciliación requerido/cotizado/acomodado.' },
  { nombre: 'get_render_status', economica: false, roles: null, desc: 'Estado/historial de renders.' },
  { nombre: 'get_approvals', economica: false, roles: null, desc: 'Aprobaciones (estado; sin montos de costo).' },
  { nombre: 'get_next_actions', economica: false, roles: null, desc: 'Próximas acciones pendientes.' },
  { nombre: 'get_activity', economica: false, roles: null, desc: 'Timeline de actividad.' },
  { nombre: 'get_today_attention', economica: false, roles: null, desc: 'Qué necesita atención hoy.' },
  { nombre: 'get_direction_facts', economica: false, roles: ['direccion', 'cfo'], desc: 'Hechos de Dirección (pipeline, ganadas/perdidas).' },
  { nombre: 'get_catalog_knowledge', economica: false, roles: null, desc: 'Conocimiento del catálogo Von Haucke (líneas, materiales, a la medida).' },
  // --- Económicas: requieren rolVeEconomia && !clientSafe ---
  { nombre: 'get_costing', economica: true, roles: ['direccion', 'diseno', 'costeador', 'cfo'], desc: 'Costeo (costo/margen). Sólo roles con economía.' },
  { nombre: 'get_bom', economica: true, roles: ['direccion', 'diseno', 'costeador'], desc: 'BOM certificado. Sólo fabricación.' },
  { nombre: 'get_industrial_analysis', economica: true, roles: ['direccion', 'diseno', 'costeador', 'cfo'], desc: 'Análisis industrial determinista: BOM, fabricabilidad, merma, corte y eficiencia. No certifica ahorros advisory.' },
]);

const PORNOMBRE = Object.freeze(Object.fromEntries(TOOLS.map((t) => [t.nombre, t])));

export function toolMeta(nombre) { return PORNOMBRE[nombre] || null; }
export function toolsParaRol(role, clientSafe = false) {
  return TOOLS.filter((t) => {
    if (t.roles && !t.roles.includes(String(role || 'ventas'))) return false;
    if (t.economica && (clientSafe || !['direccion', 'diseno', 'costeador', 'cfo'].includes(String(role)))) return false;
    return true;
  }).map((t) => t.nombre);
}

/**
 * Ejecuta una tool con todas las guardas. NUNCA lanza; devuelve un sobre estable.
 * @param {string} nombre
 * @param {{user?:any, role?:string, clientSafe?:boolean}} ctx
 * @param {object} args
 * @param {object} prov  proveedor { [nombre]: async (ctx,args)=>data }
 * @returns {Promise<{ok:boolean, tool:string, data?:any, error?:string, motivo?:string, sanitized:boolean}>}
 */
export async function ejecutarTool(nombre, ctx = {}, args = {}, prov = {}) {
  const meta = PORNOMBRE[nombre];
  if (!meta) return { ok: false, tool: nombre, error: 'tool_desconocida', sanitized: true };
  // AUTH: debe haber usuario.
  if (!ctx.user) return { ok: false, tool: nombre, error: 'no_autenticado', sanitized: true };
  // PERMISO por rol declarado en la tool.
  if (meta.roles && !meta.roles.includes(String(ctx.role || 'ventas'))) {
    return { ok: false, tool: nombre, error: 'sin_permiso', motivo: 'Tu rol no tiene acceso a esta información.', sanitized: true };
  }
  // PERMISO económico (lente != permiso: aquí manda el rol real).
  if (meta.economica && !puedeToolEconomica(ctx)) {
    return { ok: false, tool: nombre, error: 'sin_permiso', motivo: 'Esta información es económica interna; tu rol/modo no la incluye.', sanitized: true };
  }
  const fn = prov[nombre];
  if (typeof fn !== 'function') return { ok: false, tool: nombre, error: 'no_disponible', sanitized: true };
  try {
    const data = await fn(ctx, args);
    // FILTRADO DE CAMPOS: SIEMPRE, pase lo que pase (defensa en profundidad).
    const limpio = sanitizarPorContexto(data, ctx);
    return { ok: true, tool: nombre, data: limpio, sanitized: true };
  } catch (e) {
    return { ok: false, tool: nombre, error: 'fallo_tool', motivo: String(e && e.message ? e.message : e).slice(0, 140), sanitized: true };
  }
}
