// ============================================================================
//  CAPA DE DATOS COMERCIAL (CRM) — lee/escribe sobre las tablas de C2 y C4.
//  Todo pasa por RLS del servidor (el navegador no elige qué ve). Nunca lanza
//  para tumbar la UI: devuelve { data, error } y la pantalla decide el estado.
//  Lecturas sensibles de cotización van por `cotizacion_segura` (seller-safe).
// ============================================================================
import { nube } from '../nube.js';

async function sel(q) { const { data, error } = await q; return { data: data || [], error }; }

// ---- Clientes / Contactos --------------------------------------------------
export const listarClientes = () => sel(nube.from('clientes').select('*').eq('activo', true).order('nombre_comercial'));
export const crearCliente = (c) => nube.from('clientes').insert(c).select('id').maybeSingle();
export const listarContactos = (clienteId) => sel(nube.from('contactos').select('*').eq('cliente_id', clienteId).eq('activo', true));

// ---- Proyectos -------------------------------------------------------------
export const listarProyectos = () => sel(nube.from('proyectos').select('*').order('actualizado', { ascending: false }));
// Incluye el nombre del cliente por relación real (FK proyectos.cliente_id →
// clientes.id). NO existe columna `cliente` en proyectos: el nombre se lee de
// `proyecto.clientes?.nombre_comercial`. (H2 — fuente de verdad, sin duplicar.)
export const obtenerProyecto = (id) => nube.from('proyectos').select('*, clientes(nombre_comercial)').eq('id', id).maybeSingle();
// etapa tiene CHECK (mayúsculas); default seguro NUEVO si no se especifica.
export const crearProyecto = (p) => nube.from('proyectos').insert({ etapa: 'NUEVO', ...p }).select('*').maybeSingle();
export const actualizarProyecto = (id, patch) =>
  nube.from('proyectos').update({ ...patch, actualizado: new Date().toISOString() }).eq('id', id);

// ---- Actividades (timeline N17) -------------------------------------------
export const listarActividades = (proyectoId) =>
  sel(nube.from('proyecto_actividades').select('*').eq('proyecto_id', proyectoId).order('fecha', { ascending: false }));
// tipo tiene CHECK en MAYÚSCULAS (NOTA/LLAMADA/REUNION/EMAIL/...); se normaliza
// para que un 'nota' en minúsculas no sea rechazado silenciosamente.
export const agregarActividad = (a) =>
  nube.from('proyecto_actividades').insert({ ...a, tipo: String(a.tipo || 'NOTA').toUpperCase() });

// ---- Cotizaciones del proyecto --------------------------------------------
export const listarCotizacionesDeProyecto = (proyectoId) =>
  sel(nube.from('cotizaciones').select('id,folio,folio_oficial,cliente,estado,total,actualizado,proyecto_id').eq('proyecto_id', proyectoId).eq('activa', true));
// Lectura seller-safe de una cotización (Dirección ve completo; vendedor sanitizado).
export const cotizacionSegura = (id) => nube.rpc('cotizacion_segura', { p_id: id });
// H3 — el ACOMODO/layout vive en cotizaciones.acomodo (29/33 ya lo tienen), NO en
// proyectos. Devuelve el acomodo de las cotizaciones activas del proyecto para que
// la Solución lea su fuente real (no una columna inexistente de proyectos).
export const acomodosDeProyecto = (proyectoId) =>
  sel(nube.from('cotizaciones').select('id,folio,acomodo').eq('proyecto_id', proyectoId).eq('activa', true));

// ---- Escenarios (N12) ------------------------------------------------------
export const listarEscenarios = (proyectoId) =>
  sel(nube.from('escenarios').select('*').eq('proyecto_id', proyectoId).order('creado'));
export const crearEscenario = (e) => nube.from('escenarios').insert(e).select('*').maybeSingle();
export const renombrarEscenario = (id, nombre) => nube.from('escenarios').update({ nombre }).eq('id', id);
export async function seleccionarEscenario(proyectoId, escenarioId) {
  // Uno seleccionado por proyecto (no clona nada).
  await nube.from('escenarios').update({ seleccionado: false }).eq('proyecto_id', proyectoId);
  return nube.from('escenarios').update({ seleccionado: true }).eq('id', escenarioId);
}

// ---- Aprobaciones (N14 Deal Desk) -----------------------------------------
export const listarAprobaciones = (cotizacionId) =>
  sel(nube.from('aprobaciones').select('*').eq('cotizacion_id', cotizacionId).order('creado', { ascending: false }));
// Vendedor crea SIEMPRE en PENDIENTE (la RLS lo exige salvo Dirección).
export const solicitarAprobacion = (a) => nube.from('aprobaciones').insert({ ...a, estado: 'PENDIENTE' }).select('*').maybeSingle();
// Resolver: la RLS exige es_direccion(); si un vendedor lo intenta, falla (0 filas).
export const resolverAprobacion = (id, estado, resuelto_por) =>
  nube.from('aprobaciones').update({ estado, resuelto_por, resuelto_en: new Date().toISOString() }).eq('id', id);

// ---- Revisiones (para Diff N16) -------------------------------------------
// Seller-safe: el RPC sanitiza el snapshot por rol (vendedor sin economía) y
// aplica la misma visibilidad que la policy revisiones_lee. NO se lee la tabla
// cruda (su snapshot contiene costos). Devuelve revision/total/hash/snapshot/
// emitida_en/tipo ya filtrados.
export const listarRevisionesCotizacion = (cotizacionId) =>
  sel(nube.rpc('revisiones_seguras', { p_cotizacion_id: cotizacionId }));
