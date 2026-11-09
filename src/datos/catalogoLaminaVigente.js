// ============================================================================
//  CATALOGO DE LAMINA desde catalogo_vigente (fuente economica autoritativa).
//  Auditoria Direccion 2caa5ee, punto 1: el flujo real debe tomar la lamina del
//  catalogo vigente (Supabase), VALIDANDO precio_id, unidad, calibre, tipo de
//  acero, acabado, formato y evidencia. Fail-closed: una fila sin estos datos NO
//  se usa para costear (se reporta el motivo). No infiere precios.
// ============================================================================

const FT_MM = 304.8;
const FORMATOS = {
  '3x10': { nombre: '3x10', largoMM: Math.round(10 * FT_MM), anchoMM: Math.round(3 * FT_MM) }, // 3048 x 914
  '4x10': { nombre: '4x10', largoMM: Math.round(10 * FT_MM), anchoMM: Math.round(4 * FT_MM) }, // 3048 x 1219
  '4x8': { nombre: '4x8', largoMM: Math.round(8 * FT_MM), anchoMM: Math.round(4 * FT_MM) },     // 2438 x 1219
};
for (const f of Object.values(FORMATOS)) f.area_m2 = +((f.largoMM * f.anchoMM) / 1e6).toFixed(4);

const up = (s) => String(s || '').toUpperCase();

/** Parsea identidad tecnica de la lamina desde su nombre. null si no es lamina reconocible. */
export function parseLaminaNombre(nombre) {
  const t = up(nombre);
  if (!/\bLAMINA\b/.test(t)) return null;
  const cal = t.match(/CALIBRE\s*(\d{1,2})|\bCAL\.?\s*(\d{1,2})\b/);
  const calibre = cal ? +(cal[1] || cal[2]) : null;
  const acero = /INOX/.test(t) ? 'inoxidable' : /GALVAN/.test(t) ? 'galvanizada' : /\bNEGRA\b/.test(t) ? 'negra' : null;
  const acab = t.match(/SATINADO(?:\s*P3)?|ESPEJO|BRILLANTE|DECAPADA|PULIDO/);
  const acabado = acab ? acab[0].replace(/\s+/g, ' ').trim() : (acero === 'negra' ? 'sin acabado' : null);
  let formato = null;
  const fm = t.match(/(\d)\s*'?\s*[Xx]\s*(\d{1,2})\s*'?/); // "3 X 10", "4' X 10'", "4 X 8"
  if (fm) {
    const a = +fm[1], b = +fm[2];
    const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
    formato = FORMATOS[key] || null;
  }
  return { calibre, acero, acabado, formato };
}

/** Valida una fila de catalogo_vigente como lamina costeable. {ok, motivos, registro?}. */
export function validarLaminaVigente(fila = {}) {
  const motivos = [];
  const precio = Number(fila.precio);
  if (!(precio > 0)) motivos.push('sin precio > 0');
  if (fila.precio_id == null) motivos.push('sin precio_id (version)');
  if (String(fila.unidad_compra || fila.unidad || '').toLowerCase() !== 'hoja') motivos.push('unidad != hoja (el costeo por fraccion exige hoja)');
  if (!fila.vigente_desde) motivos.push('sin vigente_desde (evidencia)');
  const id = parseLaminaNombre(fila.nombre);
  if (!id) motivos.push('nombre no reconocible como lamina');
  else {
    if (!id.calibre) motivos.push('sin calibre identificable');
    if (!id.acero) motivos.push('tipo de acero no identificable');
    if (!id.formato) motivos.push('formato de hoja no identificable');
  }
  if (motivos.length) return { ok: false, motivos, insumo_id: fila.insumo_id };
  return {
    ok: true, motivos: [],
    registro: {
      insumo_id: fila.insumo_id, calibre: id.calibre, acero: id.acero, acabado: id.acabado,
      formato: id.formato, precio, precio_id: fila.precio_id, unidad: 'hoja',
      certificable: !!fila.certificable, vigente_desde: fila.vigente_desde,
      estatus: fila.estatus_certificacion || fila.estatus || null, fuente: fila.fuente || null,
    },
  };
}

/**
 * Construye el catalogo autoritativo de lamina desde filas de catalogo_vigente.
 * Fail-closed: devuelve SOLO las validas; las invalidas van en `rechazadas` con motivo.
 */
export function laminaDesdeVigente(filas = []) {
  const validas = [], rechazadas = [];
  for (const f of (Array.isArray(filas) ? filas : [])) {
    const v = validarLaminaVigente(f);
    if (v.ok) validas.push(v.registro); else rechazadas.push({ insumo_id: f.insumo_id, motivos: v.motivos });
  }
  return { lamina: validas, rechazadas };
}

/**
 * FLUJO REAL: carga la lamina directamente desde catalogo_vigente (Supabase) con el
 * cliente autenticado del servidor/app. Devuelve {lamina, rechazadas}. No usa fixtures.
 * @param {{from:Function}} svc  cliente Supabase (supabase-js)
 */
export async function cargarLaminaDesdeSupabase(svc) {
  const { data, error } = await svc
    .from('catalogo_vigente')
    .select('insumo_id, nombre, precio, precio_id, unidad_compra, vigente_desde, certificable, estatus_certificacion, fuente')
    .ilike('nombre', '%LAMINA%HOJA%');
  if (error) throw new Error('catalogo_vigente: ' + error.message);
  return laminaDesdeVigente(data || []);
}
