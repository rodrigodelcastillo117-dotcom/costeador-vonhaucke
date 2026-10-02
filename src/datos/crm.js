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
export const obtenerProyecto = (id) => nube.from('proyectos').select('*').eq('id', id).maybeSingle();
export const crearProyecto = (p) => nube.from('proyectos').insert(p).select('*').maybeSingle();
export const actualizarProyecto = (id, patch) =>
  nube.from('proyectos').update({ ...patch, actualizado: new Date().toISOString() }).eq('id', id);

// ---- Actividades (timeline N17) -------------------------------------------
export const listarActividades = (proyectoId) =>
  sel(nube.from('proyecto_actividades').select('*').eq('proyecto_id', proyectoId).order('fecha', { ascending: false }));
export const agregarActividad = (a) => nube.from('proyecto_actividades').insert(a);

// ---- Cotizaciones del proyecto --------------------------------------------
export const listarCotizacionesDeProyecto = (proyectoId) =>
  sel(nube.from('cotizaciones').select('id,folio,folio_oficial,cliente,estado,total,actualizado,proyecto_id').eq('proyecto_id', proyectoId).eq('activa', true));
// Lectura seller-safe de una cotización (Dirección ve completo; vendedor sanitizado).
export const cotizacionSegura = (id) => nube.rpc('cotizacion_segura', { p_id: id });

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
export const listarRevisionesCotizacion = (cotizacionId) =>
  sel(nube.from('cotizaciones_revisiones').select('revision,total,hash,snapshot,creado,tipo').eq('cotizacion_id', cotizacionId).order('revision'));
