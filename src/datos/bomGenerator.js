// ============================================================================
//  BOMGenerator (PRODUCT INTELLIGENCE, v1 · despiece industrial determinista)
//
//  Capa PURA. Dado un ProductSpec, genera un BOM determinista. NO inventa:
//   · parte PENDING/CONFLICT en el spec → línea BOM PENDING (sin consumo).
//   · sin material canónico resuelto → línea PENDING (identidad es del resolver).
//   · sin regla de merma canónica → consumo_bruto PENDING (NUNCA una merma mágica).
//
//  Distingue COSTO OFICIAL (reglas canónicas) de OPORTUNIDAD INDUSTRIAL (nesting/
//  retazos/optimización). Aquí sólo el consumo NETO geométrico y el bruto cuando
//  hay regla; el nesting vive aparte y NUNCA baja el costo oficial para "eficientar".
//
//  No lee red ni archivos. `opts.resolverMaterial(parte)` y `opts.reglaMerma(parte)`
//  los inyecta el caller (resolver canónico / reglas VH); por defecto devuelven null.
// ============================================================================
import { ESTADO_DATO } from './productSpec.js';

export const UNIDAD_CONSUMO = Object.freeze({
  AREA_M2: 'm2',      // tableros/láminas por área
  LONGITUD_M: 'm',    // perfiles por longitud
  PIEZA: 'pz',        // herrajes/accesorios por pieza
  DESCONOCIDA: null,
});

// null/undefined/'' → null (NO 0; Number(null)===0 causaría una merma mágica de 0%).
const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Consumo NETO geométrico de una parte, según su unidad de consumo.
function consumoNeto(parte, unidad) {
  const { w, d } = parte.dimensiones || {};
  if (unidad === UNIDAD_CONSUMO.AREA_M2) {
    if (num(w) > 0 && num(d) > 0) return +( (w / 1000) * (d / 1000) ).toFixed(6); // mm→m, m²
    return null;
  }
  if (unidad === UNIDAD_CONSUMO.LONGITUD_M) {
    const largo = num(w) ?? num(d);
    return largo > 0 ? +(largo / 1000).toFixed(6) : null;
  }
  if (unidad === UNIDAD_CONSUMO.PIEZA) return 1;
  return null;
}

/**
 * Genera el BOM determinista de un ProductSpec normalizado.
 * @param {object} spec  salida de construirProductSpec
 * @param {{resolverMaterial?:Function, reglaMerma?:Function, unidadDeParte?:Function}} opts
 * @returns {{lineas:Array, estado:'COMPLETO'|'PRELIMINAR', pendientes:number}}
 */
export function generarBOM(spec, opts = {}) {
  const resolverMaterial = opts.resolverMaterial || (() => null);
  const reglaMerma = opts.reglaMerma || (() => null);
  // Unidad de consumo por parte (el caller puede clasificar por tipo/material);
  // por defecto: si hay espesor y 2 dims → área (tablero); si no, desconocida.
  const unidadDeParte = opts.unidadDeParte || ((p) => {
    if ((p.espesor_mm != null || p.calibre) && num(p.dimensiones?.w) > 0 && num(p.dimensiones?.d) > 0) return UNIDAD_CONSUMO.AREA_M2;
    return UNIDAD_CONSUMO.DESCONOCIDA;
  });

  const lineas = (Array.isArray(spec?.partes) ? spec.partes : []).map((parte) => {
    const issues = [];
    // 1) El spec manda: si la parte no está OK, la línea es PENDING.
    if (parte.estado && parte.estado !== ESTADO_DATO.OK) issues.push(`PARTE_${parte.estado}`);

    // 2) Identidad de material: la resuelve el resolver canónico; aquí no se inventa.
    const material_canonical_id = resolverMaterial(parte) || null;
    if (!material_canonical_id) issues.push('MATERIAL_SIN_CANONICO');

    // 3) Consumo neto geométrico.
    const unidad_consumo = unidadDeParte(parte);
    const consumo_neto = consumoNeto(parte, unidad_consumo);
    if (consumo_neto == null) issues.push('CONSUMO_NETO_INDETERMINADO');

    // 4) Merma: SÓLO por regla canónica. Sin regla → bruto PENDING (no mágica).
    const merma_pct = num(reglaMerma(parte));
    let consumo_bruto = null;
    if (consumo_neto != null && merma_pct != null && merma_pct >= 0 && merma_pct < 100) {
      consumo_bruto = +(consumo_neto / (1 - merma_pct / 100)).toFixed(6);
    } else if (consumo_neto != null && merma_pct == null) {
      issues.push('MERMA_SIN_REGLA');
    }

    const estado = issues.length ? ESTADO_DATO.PENDING : ESTADO_DATO.OK;
    return {
      part_id: parte.part_id || null,
      descripcion: parte.nombre || parte.part_id || null,
      cantidad: num(parte.cantidad),
      dimensiones_netas: parte.dimensiones || null,
      material_solicitado: parte.material_solicitado || null,
      material_canonical_id,
      espesor_mm: num(parte.espesor_mm),
      calibre: parte.calibre || null,
      unidad_consumo,
      consumo_neto,
      merma_pct,
      consumo_bruto,
      conversion: null,                 // la aporta el resolver (compra↔costeo) cuando exista
      procedencia: parte.procedencia || null,
      issues,
      estado,
    };
  });

  const pendientes = lineas.filter((l) => l.estado !== ESTADO_DATO.OK).length;
  return {
    lineas,
    estado: (pendientes === 0 && lineas.length > 0) ? 'COMPLETO' : 'PRELIMINAR',
    pendientes,
  };
}
