// ============================================================================
//  VONI 2.0 — PROVEEDOR REAL de tools. Envuelve crm.js + engines con los ids del
//  contexto. Cada función devuelve DATOS (la capa tools.js los sanea por rol/modo
//  antes de entregarlos; aquí no se filtra economía — eso es trabajo de tools.js).
//  Defensivo: si falta un id o falla una lectura, devuelve null, no lanza.
//
//  NOTA: get_costing/get_bom NO están cableados a un costeo de proyecto en vivo
//  (eso vive en el Costeador/edge y no se expone aquí para el vendedor). Devuelven
//  {disponible:false} — nunca números falsos. Cuando haya fuente autorizada, se
//  conectan aquí sin tocar el núcleo.
// ============================================================================
import {
  obtenerProyecto, listarCotizacionesDeProyecto, cotizacionSegura, listarEscenarios,
  listarAprobaciones, listarActividades, listarRevisionesCotizacion, listarProyectos,
  acomodosDeProyecto,
} from '../datos/crm.js';
import { hoyNecesitaAtencion, hechosDireccion } from '../datos/atencion.js';
import { diffRevisiones } from '../datos/diffRevisiones.js';

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// H3/punto 10: Voni compone de FUENTES REALES.
//  - contexto comercial → proyectos (cliente por join clientes.nombre_comercial)
//  - solución/layout/acomodo → cotizaciones.acomodo
//  - reconciliación por zonas → NO existe fuente → null (no se fabrica)
//  - renders técnicos → expediente/producto (no por proyecto) → no se expone aquí
export const proveedorReal = {
  get_project_context: async (ctx) => {
    if (ctx.project_id == null) return null;
    const { data: p } = await obtenerProyecto(ctx.project_id);
    if (!p) return null;
    const { data: cots } = await listarCotizacionesDeProyecto(ctx.project_id);
    const total_actual = (cots || []).reduce((s, c) => s + num(c.total), 0);
    return { id: p.id, nombre: p.nombre, cliente: p.clientes?.nombre_comercial || null, etapa: p.etapa,
      vendedor: p.vendedor_responsable, presupuesto: p.presupuesto, total_actual,
      proxima_accion: p.proxima_accion, fecha_proxima_accion: p.fecha_proxima_accion };
  },
  get_scope: async () => null, // sin fuente de scope por zonas (no se fabrica)
  get_reconciliation: async () => null, // sin fuente de reconciliación por zonas
  get_quote: async (ctx) => {
    if (ctx.quote_id == null) return null;
    const { data } = await cotizacionSegura(ctx.quote_id);
    const partidas = data?.partidas || data?.cotizacion?.partidas || [];
    return { partidas, sinPrecio: partidas.filter((x) => x && x.sinPrecioAutorizado) };
  },
  get_revision: async (ctx) => {
    if (ctx.quote_id == null) return null;
    const { data } = await listarRevisionesCotizacion(ctx.quote_id);
    return data || [];
  },
  compare_revisions: async (ctx) => {
    if (ctx.quote_id == null) return null;
    const { data } = await listarRevisionesCotizacion(ctx.quote_id);
    const revs = data || [];
    if (revs.length < 2) return { resumen: null, faltanRevisiones: true };
    const a = revs[revs.length - 2]; const b = revs[revs.length - 1];
    return diffRevisiones(a.snapshot, b.snapshot);
  },
  get_scenarios: async (ctx) => {
    if (ctx.project_id == null) return null;
    const { data } = await listarEscenarios(ctx.project_id);
    return data || [];
  },
  get_approvals: async (ctx) => {
    if (ctx.quote_id == null) return [];
    const { data } = await listarAprobaciones(ctx.quote_id);
    return data || [];
  },
  get_activity: async (ctx) => {
    if (ctx.project_id == null) return [];
    const { data } = await listarActividades(ctx.project_id);
    return data || [];
  },
  get_layout: async (ctx) => {
    if (ctx.project_id == null) return null;
    // Fuente real del layout: cotizaciones.acomodo (no una columna de proyectos).
    const { data } = await acomodosDeProyecto(ctx.project_id);
    const conAcomodo = (data || []).filter((c) => c.acomodo);
    return { tieneAcomodo: conAcomodo.length > 0, cotizaciones: conAcomodo.map((c) => c.folio || `Cot ${c.id}`), warnings: [] };
  },
  get_render_status: async () => [], // renders técnicos viven en expediente/producto, no por proyecto
  get_next_actions: async () => {
    const { data: proyectos } = await listarProyectos();
    return (proyectos || []).filter((p) => !p.proxima_accion).map((p) => ({ titulo: p.nombre, detalle: 'Sin próxima acción' }));
  },
  get_today_attention: async () => {
    const { data: proyectos } = await listarProyectos();
    return hoyNecesitaAtencion({ proyectos: proyectos || [], cotizaciones: [], aprobaciones: [] });
  },
  get_direction_facts: async () => {
    const { data: proyectos } = await listarProyectos();
    return hechosDireccion({ proyectos: proyectos || [], cotizaciones: [] });
  },
  // Económicas: la fuente autorizada es el Costeador (veCostos). El host inyecta
  // ctx.bom (componentes del costeo actual) / ctx.costing cuando aplica. La capa
  // tools.js ya bloquea estas tools para vendedor/cliente. Sin números inventados.
  get_bom: async (ctx) => (ctx.bom
    ? { componentes: ctx.bom, contradicciones: [] }
    : { disponible: false, nota: 'Abre el Costeador para ver el BOM certificado de una pieza.' }),
  get_costing: async (ctx) => (ctx.costing
    ? ctx.costing
    : { disponible: false, nota: 'El costo se consolida por pieza en el Costeador; no hay un total de proyecto inventado aquí.' }),
  get_product: async () => null,
  search_products: async () => [],
};
