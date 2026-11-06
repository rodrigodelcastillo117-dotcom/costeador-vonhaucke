// ============================================================================
//  MEJORA DEL PLANO CRUDO · benchmark por analogía con BOMs confirmados.
//
//  El costeo automático desde un plano crudo es RUIDOSO (VONI oscila ±30-50% entre
//  lecturas: probado). No llega a ±1% solo. PERO un negocio de catálogo hace VARIANTES
//  de muebles que YA tienen BOM confirmado. Entonces: en vez de confiar ciegamente en el
//  draft de VONI, lo COMPARAMOS contra el costo/m² de los muebles similares guardados.
//  Si el draft queda muy por debajo del benchmark (el caso típico: canto/espesores/
//  consumibles faltantes → −40%), se AVISA y se bloquea cotizar hasta revisar.
//
//  No inventa el costo: acota el draft y caza el sub-conteo. Es el camino honesto para
//  que el plano crudo deje de dar números peligrosamente bajos sin que nadie lo note.
// ============================================================================

/** Superficie exterior (m²) de una caja dims=[w,h,d] en mm. Proxy del material de tablero/lámina. */
export function superficieM2(dims) {
  if (!Array.isArray(dims) || dims.length < 3) return 0;
  const [w, h, d] = dims.map(Number);
  if (!(w > 0 && h > 0 && d > 0)) return 0;
  return 2 * (w * h + w * d + h * d) / 1e6;
}

const palabrasTipo = (s) => String(s || '').toLowerCase().match(/[a-záéíóúñ]{4,}/g) || [];

/** ¿El nombre de un BOM guardado es del mismo tipo que lo pedido? (coincidencia de palabra clave). */
function mismoTipo(nombreBom, tipo) {
  if (!tipo) return false;
  const t = palabrasTipo(tipo);
  const n = new Set(palabrasTipo(nombreBom));
  return t.some((w) => n.has(w));
}

/**
 * Estima el costo de fabricación por analogía: costo/m² de los muebles guardados
 * (del mismo tipo si los hay; si no, de todos) × la superficie del mueble pedido.
 * @param {number[]} dims  [w,h,d] mm
 * @param {string} tipo    texto del producto ("exhibidor de leche", "cabecera"…)
 * @param {Array<{clave,nombre,dims_mm,cos_fab_real}>} boms  BOMs guardados
 * @returns {null | {superficieM2, estimado, banda:[lo,hi], base:string[], porM2:{min,med,max}}}
 */
export function estimarPorAnalogia(dims, tipo, boms = []) {
  const s = superficieM2(dims);
  if (!(s > 0)) return null;
  const pool = (boms || []).filter((b) => Number(b && b.cos_fab_real) > 0 && superficieM2(b.dims_mm) > 0);
  if (!pool.length) return null;
  const mismos = pool.filter((b) => mismoTipo(b.nombre, tipo));
  const base = mismos.length ? mismos : pool;
  const ratios = base.map((b) => b.cos_fab_real / superficieM2(b.dims_mm)).sort((a, b) => a - b);
  const med = ratios[Math.floor((ratios.length - 1) / 2)];
  const lo = ratios[0], hi = ratios[ratios.length - 1];
  return {
    superficieM2: s,
    estimado: med * s,
    banda: [lo * s, hi * s],
    base: base.map((b) => b.clave),
    porM2: { min: lo, med, max: hi },
    mismoTipo: mismos.length > 0,
  };
}

/**
 * Revisa un draft (costo de fabricación de VONI desde plano) contra el benchmark.
 * fuera de banda (muy bajo = sub-conteo típico, o muy alto) ⇒ avisa y pide revisar.
 */
export function revisarDraftVsAnalogia(draftCosFab, dims, tipo, boms = [], { bajo = 0.75, alto = 1.4 } = {}) {
  const a = estimarPorAnalogia(dims, tipo, boms);
  if (!a || !(Number(draftCosFab) > 0)) return { ok: true, analogia: a, ratio: null, aviso: null };
  const ratio = draftCosFab / a.estimado;
  const muyBajo = ratio < bajo, muyAlto = ratio > alto;
  const fuera = muyBajo || muyAlto;
  const aviso = !fuera ? null
    : muyBajo
      ? `El draft ($${Math.round(draftCosFab).toLocaleString('es-MX')}) está muy POR DEBAJO del benchmark de muebles similares (~$${Math.round(a.estimado).toLocaleString('es-MX')}${a.mismoTipo ? '' : ', de todo el catálogo'}). Probablemente falta material (canto, espesores o consumibles). Revisa el despiece antes de cotizar.`
      : `El draft ($${Math.round(draftCosFab).toLocaleString('es-MX')}) está muy POR ENCIMA del benchmark (~$${Math.round(a.estimado).toLocaleString('es-MX')}). Revisa cantidades/duplicados antes de cotizar.`;
  return { ok: !fuera, ratio, analogia: a, aviso };
}
