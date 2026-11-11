// ============================================================================
//  PERSISTENCIA DEL EXPEDIENTE DE COSTEO (flujo real, Supabase) — auditoria p5.
//  Guarda/reabre el expediente via la RPC gobernada guardar_expediente_costeo /
//  reabrir_expediente_costeo (concurrencia optimista por version, RLS por usuario).
//  Sustituye localStorage en produccion. La migracion
//  (supabase/migrations/20261111_expediente_costeo.sql) esta PROPUESTA, no aplicada.
// ============================================================================

/** Guarda el expediente. `svc` = cliente Supabase; devuelve {ok, clave, version}. */
export async function guardarExpediente(svc, { clave, expediente, versionAnterior = null } = {}) {
  if (!svc || typeof svc.rpc !== 'function') throw new Error('cliente Supabase requerido');
  if (!clave) throw new Error('falta la clave');
  const { data, error } = await svc.rpc('guardar_expediente_costeo', {
    p_clave: clave, p_expediente: expediente, p_version_anterior: versionAnterior,
  });
  if (error) throw new Error(error.message || String(error));
  return data;
}

/** Reabre el expediente del usuario (o null si no existe / no es suyo). */
export async function reabrirExpediente(svc, clave) {
  if (!svc || typeof svc.rpc !== 'function') throw new Error('cliente Supabase requerido');
  const { data, error } = await svc.rpc('reabrir_expediente_costeo', { p_clave: clave });
  if (error) throw new Error(error.message || String(error));
  return data || null;
}
