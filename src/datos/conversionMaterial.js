// ============================================================================
//  conversionMaterial · ESTRATEGIA de conversión compra↔costeo POR FAMILIA
//  (ChatGPT P0-R9-10)
//
//  NO una sola división genérica. Cada familia industrial de Von Haucke convierte
//  el consumo (en su unidad de costeo) a la CANTIDAD DE COMPRA de forma distinta:
//
//   · TABLERO  compra HOJA → costeo m² : cantidad_hoja = m² / (m² por hoja)   [÷]
//   · LÁMINA   compra KG   → costeo m² : cantidad_kg   = m² × (kg por m²)     [×]
//              (kg por m² = densidad × espesor; es PESO, no área → se MULTIPLICA)
//   · PERFIL   compra TRAMO→ costeo m  : cantidad_tramo = m / (largo del tramo) [÷]
//   · HERRAJE  compra JUEGO→ costeo pz : cantidad_juego = pz / (pz por juego)   [÷]
//
//  Si falta el PARÁMETRO que exige la familia (área de hoja, kg/m², largo de
//  tramo, pz/juego), NO se inventa: issue FALTA_PARAM_CONVERSION → NO costable.
//  Capa PURA, sin red ni archivos. El precio/costo NO se calcula aquí.
// ============================================================================

export const FAMILIA_CONVERSION = Object.freeze({
  TABLERO: 'tablero',
  LAMINA: 'lamina',
  PERFIL: 'perfil',
  HERRAJE: 'herraje',
});

const num = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const red6 = (n) => +Number(n).toFixed(6);

/**
 * Convierte el CONSUMO (en unidad de costeo) a la CANTIDAD DE COMPRA en unidad de
 * compra, con la estrategia correcta por familia.
 * @param {{familia?:string, unidad_consumo?:string, unidad_compra?:string, consumo:number, params?:object}} arg
 * @returns {{cantidad_compra:number|null, unidad_compra:string|null, estrategia:string|null, conversion_definition:string|null, issues:string[]}}
 */
export function convertirConsumoACompra({ familia, unidad_consumo, unidad_compra, consumo, params = {} } = {}) {
  const issues = [];
  const c = num(consumo);
  const out = (extra = {}) => ({ cantidad_compra: null, unidad_compra: unidad_compra || null, estrategia: null, conversion_definition: null, issues, ...extra });
  if (c == null || c < 0) { issues.push('CONSUMO_INVALIDO'); return out(); }
  if (!unidad_compra || !unidad_consumo) { issues.push('UNIDADES_INCOMPLETAS'); return out(); }

  // Mismas unidades → 1:1, sin importar la familia.
  if (unidad_compra === unidad_consumo) {
    return out({ cantidad_compra: red6(c), estrategia: '1:1', conversion_definition: '1:1' });
  }

  const fam = String(familia || '').toLowerCase();

  // TABLERO: hoja ← m² (dividir por el área de una hoja).
  if (fam === FAMILIA_CONVERSION.TABLERO && unidad_compra === 'hoja' && unidad_consumo === 'm2') {
    const areaHoja = num(params.area_hoja_m2);
    if (!(areaHoja > 0)) { issues.push('FALTA_PARAM_CONVERSION'); return out(); }
    return out({ cantidad_compra: red6(c / areaHoja), estrategia: 'TABLERO_M2_A_HOJA', conversion_definition: `${areaHoja} m² por hoja` });
  }

  // LÁMINA: kg ← m² (MULTIPLICAR por el peso por m² = densidad × espesor).
  if (fam === FAMILIA_CONVERSION.LAMINA && unidad_compra === 'kg' && unidad_consumo === 'm2') {
    const kgPorM2 = num(params.kg_por_m2);
    if (!(kgPorM2 > 0)) { issues.push('FALTA_PARAM_CONVERSION'); return out(); }
    return out({ cantidad_compra: red6(c * kgPorM2), estrategia: 'LAMINA_M2_A_KG', conversion_definition: `${kgPorM2} kg por m²` });
  }
  // LÁMINA: kg ← hoja (peso por hoja).
  if (fam === FAMILIA_CONVERSION.LAMINA && unidad_compra === 'kg' && unidad_consumo === 'hoja') {
    const kgPorHoja = num(params.kg_por_hoja);
    if (!(kgPorHoja > 0)) { issues.push('FALTA_PARAM_CONVERSION'); return out(); }
    return out({ cantidad_compra: red6(c * kgPorHoja), estrategia: 'LAMINA_HOJA_A_KG', conversion_definition: `${kgPorHoja} kg por hoja` });
  }

  // PERFIL: tramo ← m (dividir por el largo del tramo).
  if (fam === FAMILIA_CONVERSION.PERFIL && unidad_compra === 'tramo' && unidad_consumo === 'm') {
    const largo = num(params.largo_tramo_m);
    if (!(largo > 0)) { issues.push('FALTA_PARAM_CONVERSION'); return out(); }
    return out({ cantidad_compra: red6(c / largo), estrategia: 'PERFIL_M_A_TRAMO', conversion_definition: `${largo} m por tramo` });
  }

  // HERRAJE: juego ← pz (dividir por piezas por juego).
  if (fam === FAMILIA_CONVERSION.HERRAJE && unidad_compra === 'juego' && unidad_consumo === 'pz') {
    const pzJuego = num(params.pz_por_juego);
    if (!(pzJuego > 0)) { issues.push('FALTA_PARAM_CONVERSION'); return out(); }
    return out({ cantidad_compra: red6(c / pzJuego), estrategia: 'HERRAJE_PZ_A_JUEGO', conversion_definition: `${pzJuego} pz por juego` });
  }

  // Familia/pareja de unidades no modelada → NO se inventa una división genérica.
  issues.push('CONVERSION_FAMILIA_DESCONOCIDA');
  return out();
}
