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
const num = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

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
    //    resolverMaterial puede devolver un id (string) o {id, unidad_compra, conversion}.
    const mat = resolverMaterial(parte);
    const material_canonical_id = (typeof mat === 'string' ? mat : (mat && mat.id)) || null;
    const unidad_compra = (mat && typeof mat === 'object') ? (mat.unidad_compra || null) : null;
    const conversion = (mat && typeof mat === 'object') ? num(mat.conversion) : null;
    if (!material_canonical_id) issues.push('MATERIAL_SIN_CANONICO');

    // 3) CANTIDAD de la parte: necesaria y >0 para el consumo TOTAL (P0-8).
    const cantidad = num(parte.cantidad);
    if (cantidad == null || cantidad <= 0) issues.push('CANTIDAD_INVALIDA');

    // 4) Consumo neto GEOMÉTRICO por UNIDAD, y TOTAL = unitario × cantidad (P0-8):
    //    jamás se cobra el consumo de 1 pieza cuando hay N piezas.
    const unidad_consumo = unidadDeParte(parte);
    const consumo_neto_unitario = consumoNeto(parte, unidad_consumo);
    if (consumo_neto_unitario == null) issues.push('CONSUMO_NETO_INDETERMINADO');
    const consumo_neto_total = (consumo_neto_unitario != null && cantidad != null && cantidad > 0)
      ? +(consumo_neto_unitario * cantidad).toFixed(6) : null;

    // 5) P0-9: si la unidad de COMPRA difiere de la de CONSUMO y NO hay conversión,
    //    el BOM NO puede ser oficial (no se mezclan unidades).
    if (unidad_compra && unidad_consumo && unidad_compra !== unidad_consumo && !(conversion > 0)) {
      issues.push('CONVERSION_FALTANTE');
    }

    // 6) Merma: SÓLO por regla canónica. Sin regla → bruto PENDING (no mágica).
    //    Una merma FUERA DE RANGO (negativa o ≥100) es un dato inválido → MERMA_INVALIDA.
    const merma_pct = num(reglaMerma(parte));
    let consumo_bruto_unitario = null;
    let consumo_bruto_total = null;
    if (merma_pct != null && (merma_pct < 0 || merma_pct >= 100)) {
      issues.push('MERMA_INVALIDA');
    } else if (consumo_neto_unitario != null && merma_pct != null) {
      consumo_bruto_unitario = +(consumo_neto_unitario / (1 - merma_pct / 100)).toFixed(6);
      if (consumo_neto_total != null) consumo_bruto_total = +(consumo_neto_total / (1 - merma_pct / 100)).toFixed(6);
    } else if (consumo_neto_unitario != null && merma_pct == null) {
      issues.push('MERMA_SIN_REGLA');
    }

    // 7) APLICAR la conversión (ChatGPT P0-R8-4): producir la CANTIDAD DE COMPRA
    //    equivalente en la unidad de compra. `conversion` = unidades de CONSUMO por
    //    1 unidad de COMPRA (p.ej. 2.98 m²/hoja) → cantidad_compra = consumo / conversion.
    const unidadesCoinciden = !!unidad_compra && !!unidad_consumo && unidad_compra === unidad_consumo;
    const conversion_factor = (conversion > 0) ? conversion : null;
    const conversion_direction = conversion_factor ? `${unidad_consumo} por 1 ${unidad_compra}` : (unidadesCoinciden ? '1:1' : null);
    let cantidad_compra_equivalente = null;
    if (consumo_bruto_total != null) {
      if (unidadesCoinciden) cantidad_compra_equivalente = consumo_bruto_total;
      else if (conversion_factor) cantidad_compra_equivalente = +(consumo_bruto_total / conversion_factor).toFixed(6);
    }

    const estado = issues.length ? ESTADO_DATO.PENDING : ESTADO_DATO.OK;
    // COSTABLE/OFICIAL (ChatGPT P0-R8-6): además de estar técnicamente OK, se necesita
    // unidad de COMPRA conocida y una cantidad de compra equivalente real (misma unidad
    // o conversión aplicada). Un BOM técnico sin unidad_compra NO es costable/oficial.
    const costable = estado === ESTADO_DATO.OK
      && !!unidad_compra
      && (unidadesCoinciden || conversion_factor != null)
      && cantidad_compra_equivalente != null;

    return {
      part_id: parte.part_id || null,
      descripcion: parte.nombre || parte.part_id || null,
      cantidad,
      dimensiones_netas: parte.dimensiones || null,
      material_solicitado: parte.material_solicitado || null,
      material_canonical_id,
      espesor_mm: num(parte.espesor_mm),
      calibre: parte.calibre || null,
      unidad_consumo,
      consumo_neto_unitario,
      consumo_neto_total,            // lo que de verdad se costea (× cantidad)
      merma_pct,
      consumo_bruto_unitario,
      consumo_bruto_total,
      unidad_compra,
      conversion_factor,             // unidades de consumo por 1 de compra
      conversion_direction,
      cantidad_compra_equivalente,   // ← lo que se compra, en unidad_compra (NO se multiplica precio por m² si se compra por hoja)
      procedencia: parte.procedencia || null,
      issues,
      estado,
      costable,
    };
  });

  const pendientes = lineas.filter((l) => l.estado !== ESTADO_DATO.OK).length;
  const noCostables = lineas.filter((l) => !l.costable).length;
  return {
    lineas,
    estado: (pendientes === 0 && lineas.length > 0) ? 'COMPLETO' : 'PRELIMINAR',
    pendientes,
    // Técnicamente completo ≠ costable: estadoCosteo sólo COSTABLE si TODAS las
    // líneas pueden costearse de forma oficial (unidad/conversión resueltas).
    estadoCosteo: (noCostables === 0 && lineas.length > 0) ? 'COSTABLE' : 'NO_COSTABLE',
    noCostables,
  };
}
