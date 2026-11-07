// Carga del BOM confirmado por CLAVE desde Supabase (tabla producto_maestro, RLS seller-safe:
// sólo roles que ven economía). Separado de productoMaestro.js para que la lógica de costeo
// (costearBOM) siga siendo pura y testeable sin la nube.
import { nube } from '../nube.js';

/** @returns {Promise<{ok:boolean, bom?:object, error?:string}>} */
export async function cargarBOMporClave(clave) {
  const c = String(clave || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'Escribe una clave.' };
  try {
    const { data, error } = await nube
      .from('producto_maestro')
      .select('clave,nombre,dims_mm,fuente,cos_fab_real,lineas,actualizado_en,factor_mo,factor_gif,material_real,tipo_bom')
      .eq('clave', c)
      .maybeSingle();
    if (error) return { ok: false, error: error.message || 'No se pudo leer el BOM.' };
    if (!data) return { ok: false, error: `No hay BOM guardado para la clave «${c}». (Si es un mueble nuevo, costéalo con VONI, confírmalo y guárdalo.)` };
    return { ok: true, bom: data };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/** Lista de claves con BOM (para sugerir/autocompletar). Mejor esfuerzo. */
export async function listarClaves(limite = 50) {
  try {
    const { data, error } = await nube
      .from('producto_maestro')
      .select('clave,nombre')
      .order('clave')
      .limit(Math.max(1, Math.min(500, limite)));
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

/** Cabeceras de BOM (clave, nombre, dims, cos_fab_real) para el benchmark por analogía del plano crudo. */
export async function listarBenchmarks(limite = 500) {
  try {
    const { data, error } = await nube
      .from('producto_maestro')
      .select('clave,nombre,dims_mm,cos_fab_real')
      .limit(Math.max(1, Math.min(2000, limite)));
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
