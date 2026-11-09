// ============================================================================
//  AUTO-SANADOR DE BOM — resuelve la CLAVE ERP embebida en la descripción de una
//  línea de BOM (p.ej. "TUBULAR CUADRADO 1 CAL 18 6000mm - TC181") a su insumoId
//  del catálogo. Determinista, sin IA, NO escribe en la nube.
//
//  Regla de oro (FAIL-CLOSED, precisa y exacta): sólo auto-mapea cuando hay
//  EXACTAMENTE UN insumo del catálogo con esa clave Y la unidad es compatible.
//    · 0 candidatos            → no está en el catálogo (lo deja; Compras/alta).
//    · ≥2 candidatos           → variantes por color/acabado (MDF16M, LP122244…):
//                                NO elige a escondidas; lo deja para una persona.
//    · unidad incompatible     → NO mapea (evita meter un bloqueo de unidad).
//  Nunca inventa, nunca adivina por "parecido". Resuelve la IDENTIDAD por la clave
//  que la propia estimación ya escribió en el texto; no toca precios.
//
//  Por qué: las claves de catálogo importadas de estimaciones viejas traían la
//  clave ERP en el texto ("... - TC181") pero sin insumoId resuelto, así que
//  costeaban con el precio histórico congelado en vez del catálogo vigente. Esto
//  las amarra al material real de forma automática y segura.
// ============================================================================

const normU = (u) => String(u || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[²2]/g, '2').replace(/\s+/g, '');

// Token con forma de clave ERP: ≥2 letras y al menos un dígito (TC181, TU14HE, LN18310,
// MDF16, MDF16M, TAMA516, LP122244, TRE14PU). Excluye palabras (ACERO, MADERA) y números
// sueltos (1008, 6000). Case-insensitive; se normaliza a MAYÚSCULAS.
const RE_CLAVE_TOKEN = /\b([A-Z]{2,}[A-Z0-9/-]*[0-9][A-Z0-9/-]*)\b/g;

/** Clave ERP al FINAL de la descripción de una línea: "… - TC181", "… -- TU14HE", '… - "MDF16"'. */
export function claveDeLinea(desc) {
  const t = String(desc || '').toUpperCase();
  const m = t.match(/[-–—]{1,2}\s*"{0,3}([A-Z]{2,}[A-Z0-9/-]*[0-9][A-Z0-9/-]*)"{0,3}\s*$/);
  return m ? m[1] : null;
}

/** Claves ERP que NOMBRA un insumo del catálogo (pueden ir entre comillas o a media cadena). */
export function clavesDeInsumo(nombre) {
  const t = String(nombre || '').toUpperCase();
  const out = new Set();
  for (const m of t.matchAll(RE_CLAVE_TOKEN)) out.add(m[1]);
  return [...out];
}

/** Índice clave → Set(insumoId). Una clave con varios insumos NO se auto-mapea (fail-closed). */
export function indicePorClave(insumos = {}) {
  const idx = new Map();
  for (const [id, ins] of Object.entries(insumos || {})) {
    for (const clave of clavesDeInsumo(ins && ins.nombre)) {
      if (!idx.has(clave)) idx.set(clave, new Set());
      idx.get(clave).add(id);
    }
  }
  return idx;
}

/**
 * Resuelve UNA línea sin insumoId por su clave embebida. No muta.
 * @returns {{insumoId:string, clave:(string|null), motivo:string}} insumoId '' si no se pudo.
 */
export function resolverLinea(linea = {}, insumos = {}, idx = null) {
  if (linea && linea.insumoId) return { insumoId: linea.insumoId, clave: null, motivo: 'ya mapeada' };
  const clave = claveDeLinea(linea && linea.desc);
  if (!clave) return { insumoId: '', clave: null, motivo: 'sin clave ERP en la descripción' };
  const index = idx || indicePorClave(insumos);
  const cands = [...(index.get(clave) || [])];
  if (cands.length === 0) return { insumoId: '', clave, motivo: 'la clave no está en el catálogo' };
  if (cands.length > 1) return { insumoId: '', clave, motivo: `${cands.length} variantes (color/acabado): requiere que una persona elija` };
  const id = cands[0];
  const ins = insumos[id] || {};
  const uL = normU(linea.unidad), uI = normU(ins.unidad);
  if (uL && uI && uL !== uI) return { insumoId: '', clave, motivo: `unidad incompatible (${linea.unidad} ≠ ${ins.unidad})` };
  return { insumoId: id, clave, motivo: '' };
}

/**
 * Sana un BOM entero (NO destructivo): devuelve una copia con los insumoId resueltos por clave,
 * y el reporte de qué se mapeó y qué quedó sin resolver (para que una persona lo cierre).
 * @returns {{bom:object, mapeadas:Array, sinResolver:Array}}
 */
export function sanarBOM(bom = {}, insumos = {}) {
  const lineas = Array.isArray(bom.lineas) ? bom.lineas : [];
  const idx = indicePorClave(insumos);
  const mapeadas = [];
  const sinResolver = [];
  const nuevas = lineas.map((L) => {
    if (L && L.insumoId) return L;
    const r = resolverLinea(L, insumos, idx);
    if (r.insumoId) {
      mapeadas.push({ desc: L.desc, clave: r.clave, insumoId: r.insumoId });
      return { ...L, insumoId: r.insumoId, _autoClave: r.clave };
    }
    if (r.clave) sinResolver.push({ desc: L.desc, clave: r.clave, motivo: r.motivo });
    return L;
  });
  return { bom: { ...bom, lineas: nuevas }, mapeadas, sinResolver };
}
