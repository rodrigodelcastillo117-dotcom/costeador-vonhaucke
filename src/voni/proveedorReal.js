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
import { conocimientoDe } from './conocimiento.js';
import { analizarProductoIndustrial } from '../datos/analisisIndustrial.js';
import { buscarMaterialTecnico, describirFormatoTecnico } from '../datos/materialKnowledge.js';
import { nube, buscarProductosMaestroTexto } from '../nube.js';

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
    const cotizaciones = cots || [];
    const validas = cotizaciones.filter((c) => c?.total != null && Number.isFinite(Number(c.total)));
    const sinTotal = cotizaciones.filter((c) => !(c?.total != null && Number.isFinite(Number(c.total))));
    const total_conocido = validas.reduce((s, c) => s + Number(c.total), 0);
    // Si falta un total, la suma parcial NO se promociona a total_actual.
    const total_actual = sinTotal.length ? null : total_conocido;
    return { id: p.id, nombre: p.nombre, cliente: p.clientes?.nombre_comercial || null, etapa: p.etapa,
      vendedor: p.vendedor_responsable, presupuesto: p.presupuesto, total_actual,
      total_conocido, cotizaciones_sin_total: sinTotal.length,
      proxima_accion: p.proxima_accion, fecha_proxima_accion: p.fecha_proxima_accion };
  },
  get_scope: async () => null, // sin fuente de scope por zonas (no se fabrica)
  get_reconciliation: async () => null, // sin fuente de reconciliación por zonas
  get_quote: async (ctx) => {
    // TRABAJO VIVO primero: lo que el vendedor tiene en pantalla (el host lo
    // inyecta YA recortado a seller-safe). Así Voni analiza la cotización actual,
    // no sólo lo guardado en la BD comercial.
    if (Array.isArray(ctx.partidasLocales)) {
      const partidas = ctx.partidasLocales;
      return { partidas, sinPrecio: partidas.filter((x) => x && x.sinPrecioAutorizado) };
    }
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
    // ACOMODO VIVO: si el host inyecta el acomodo en pantalla (flujo principal),
    // se lee de ahí. Sin economía (es pura geometría).
    if (ctx.acomodoLocal != null || Array.isArray(ctx.partidasLocales)) {
      const a = ctx.acomodoLocal || {};
      const tiene = !!(a.plan && Array.isArray(a.plan.colocacion) && a.plan.colocacion.length);
      const nPart = (ctx.partidasLocales || []).length;
      const warnings = [];
      if (nPart > 0 && !tiene) warnings.push('Hay muebles en la cotización pero aún no están acomodados en un plano.');
      return { tieneAcomodo: tiene, cotizaciones: [], warnings };
    }
    if (ctx.project_id == null) return null;
    // Fuente real del layout: cotizaciones.acomodo (no una columna de proyectos).
    const { data } = await acomodosDeProyecto(ctx.project_id);
    const conAcomodo = data || []; // query ya filtra acomodo IS NOT NULL sin descargarlo
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
  get_industrial_analysis: async (ctx) => {
    const bom = Array.isArray(ctx.bom) ? ctx.bom : [];
    const costing = ctx.costing || null;
    if (!bom.length && !costing) {
      return { disponible:false, nota:'Abre o selecciona un producto con BOM/costeo para analizarlo industrialmente.' };
    }
    return { disponible:true, ...analizarProductoIndustrial({ bom, costing }) };
  },
  get_costing_precedents: async (ctx) => {
    const bom=Array.isArray(ctx.bom)?ctx.bom:[];
    if(!bom.length) return { disponible:false, precedentes:[], nota:'Sin BOM actual no hay una base honesta para medir similitud.' };

    const {data:revs,error}=await nube.from('expediente_revisiones')
      .select('id,expediente_id,rev,creado,nombre,bom,costo,producto_id,producto_version_id')
      .not('bom','is',null)
      .order('creado',{ascending:false})
      .limit(80);
    if(error) return { disponible:false, precedentes:[], nota:'No se pudo consultar la memoria técnica autorizada.' };

    const versionIds=[...new Set((revs||[]).map((x)=>Number(x.producto_version_id)).filter(Number.isFinite))];
    const ecoMap=new Map();
    if(versionIds.length){
      const {data:ecos}=await nube.from('producto_version_economia')
        .select('producto_version_id,costo_oficial_referencia,formula_version,fuente,actualizado')
        .in('producto_version_id',versionIds);
      for(const e of (ecos||[])) ecoMap.set(Number(e.producto_version_id),e);
    }

    const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const tokens=(xs)=>new Set((xs||[]).flatMap((x)=>norm(x).match(/[a-z0-9]{3,}/g)||[])
      .filter((x)=>!['para','pieza','mueble','material','cubierta','estructura'].includes(x)));
    const mats=(xs)=>new Set((xs||[]).map((x)=>String(x?.insumoId||x?.material_id||x?.material||'')).filter(Boolean));
    const t0=tokens(bom.map((x)=>x?.nombre)),m0=mats(bom);
    const inter=(a,b)=>[...a].filter((x)=>b.has(x)).length;
    const jacc=(a,b)=>a.size||b.size ? inter(a,b)/(new Set([...a,...b]).size||1) : 0;
    const countSim=(a,b)=>1-Math.min(1,Math.abs(a-b)/Math.max(1,a,b));

    const candidatos=[];
    for(const r of (revs||[])){
      const rb=Array.isArray(r.bom)?r.bom:[];
      if(!rb.length) continue;
      const eco=ecoMap.get(Number(r.producto_version_id));
      const c=r.costo&&typeof r.costo==='object'?r.costo:{};
      const rawEco=eco?.costo_oficial_referencia;
      const rawRev=c.costoTotal ?? c.costoUnitario;
      const costoEco=rawEco==null||rawEco==='' ? NaN : Number(rawEco);
      const costoRev=rawRev==null||rawRev==='' ? NaN : Number(rawRev);
      const completo=String(c.estado_costo||'').toLowerCase()==='completo' && Number.isFinite(costoRev) && costoRev>=0;
      const tieneOficial=Number.isFinite(costoEco)&&costoEco>=0;
      if(!tieneOficial&&!completo) continue; // memoria económica sólo con verdad defendible
      const mt=mats(rb),tt=tokens(rb.map((x)=>x?.nombre));
      const materialSim=jacc(m0,mt),textoSim=jacc(t0,tt),cantidadSim=countSim(bom.length,rb.length);
      const score=0.55*materialSim+0.30*textoSim+0.15*cantidadSim;
      if(score<0.12) continue;
      candidatos.push({
        revision_id:r.id,expediente_id:r.expediente_id,revision:r.rev,nombre:r.nombre||'Precedente',
        producto_id:r.producto_id||null,producto_version_id:r.producto_version_id||null,
        similitud:+score.toFixed(3),
        coincidencia_material:+materialSim.toFixed(3),
        coincidencia_texto:+textoSim.toFixed(3),
        bom_componentes:rb.length,
        costo_oficial:tieneOficial?costoEco:costoRev,
        formula:eco?.formula_version||c.formula_version||null,
        fuente:tieneOficial?(eco?.fuente||'producto_version_economia'):'expediente_revision_completa',
        fecha:eco?.actualizado||r.creado,
      });
    }
    candidatos.sort((a,b)=>b.similitud-a.similitud || String(b.fecha||'').localeCompare(String(a.fecha||'')));
    return {
      disponible:true,
      precedentes:candidatos.slice(0,6),
      politica:'Precedente = comparación, no autoridad. El costo vigente siempre lo recalcula el motor con BOM/precios actuales.',
    };
  },
  get_material_technical: async (ctx, args) => {
    const items = buscarMaterialTecnico(ctx.materialesTecnicos || [], args?.query || '');
    return {
      disponible: items.length > 0,
      items: items.map((m) => ({
        ...m,
        formato_texto: describirFormatoTecnico(m),
      })),
      nota: items.length ? null : 'No encontré un material técnico coincidente en el catálogo cargado.',
    };
  },
  // Conocimiento del catálogo Von Haucke (líneas, materiales, a la medida). Usa la
  // consulta del usuario (args.query) para recomendar/explicar. No es económico.
  get_catalog_knowledge: async (ctx, args) => conocimientoDe(args?.query || ''),

  // Producto Maestro REAL, seller-safe: identidad/taxonomía/versionado, jamás costo/margen.
  get_product: async (_ctx, args) => {
    const id=Number(args?.id);
    if(!Number.isFinite(id)) return null;
    const {data,error}=await nube.from('productos')
      .select('id,nombre,codigo,source_type,familia,estado,activo,version_tecnica_vigente_id')
      .eq('id',id).maybeSingle();
    if(error) return null;
    return data||null;
  },

  search_products: async (_ctx, args) => {
    const r=await buscarProductosMaestroTexto(args?.query||'',25);
    return r?.ok ? (r.items||[]) : [];
  },
};
