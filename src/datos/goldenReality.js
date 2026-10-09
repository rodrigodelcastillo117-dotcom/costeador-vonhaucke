// ============================================================================
//  GOLDEN REALITY — comparación APP vs HUMANO (ChatGPT §13)
//
//  Capa PURA. Compara un costeo HUMANO real (T.D.C. de Alba/Alpura/etc.) contra
//  el costeo de la APP, línea por línea y rubro por rubro, y CLASIFICA cada
//  diferencia por CAUSA. El objetivo es diagnosticar, NO cuadrar: jamás se ajusta
//  una fórmula para que el número coincida — se corrige la causa raíz.
//
//  No lee archivos ni red. El ingestor (parser de T.D.C.) alimenta las dos
//  estructuras ya normalizadas.
// ============================================================================

export const CAUSA_DIFERENCIA = Object.freeze({
  IDENTIDAD_MP: 'IDENTIDAD_MP',     // distinto material canónico
  UNIDAD: 'UNIDAD',                 // unidad de compra/costeo distinta
  CONVERSION: 'CONVERSION',         // factor de conversión distinto
  CANTIDAD: 'CANTIDAD',             // nº de piezas/partes distinto
  CONSUMO: 'CONSUMO',               // consumo neto distinto
  MERMA: 'MERMA',                   // merma/aprovechamiento distinto
  PRECIO: 'PRECIO',                 // precio unitario distinto
  MONEDA_FX: 'MONEDA_FX',           // moneda o tipo de cambio distinto
  MANO_OBRA: 'MANO_OBRA',           // MO distinta
  INDIRECTOS: 'INDIRECTOS',         // GI/fábrica distinta
  FINANCIERO: 'FINANCIERO',         // costo financiero distinto
  REDONDEO: 'REDONDEO',             // diferencia dentro de tolerancia de redondeo
  DATO_FALTANTE: 'DATO_FALTANTE',   // un lado no tiene el dato
});

const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Campos de rubro (nivel total) → causa cuando difieren.
const RUBRO_CAUSA = {
  precio_unitario: CAUSA_DIFERENCIA.PRECIO,
  consumo: CAUSA_DIFERENCIA.CONSUMO,
  merma_pct: CAUSA_DIFERENCIA.MERMA,
  cantidad: CAUSA_DIFERENCIA.CANTIDAD,
  conversion: CAUSA_DIFERENCIA.CONVERSION,
  mano_obra: CAUSA_DIFERENCIA.MANO_OBRA,
  indirectos: CAUSA_DIFERENCIA.INDIRECTOS,
  financiero: CAUSA_DIFERENCIA.FINANCIERO,
  tipo_cambio: CAUSA_DIFERENCIA.MONEDA_FX,
};

// ¿Dos números difieren más que la tolerancia? Dentro de tolerancia = REDONDEO.
function difiere(a, b, tolRel, tolAbs) {
  if (a == null || b == null) return a !== b;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  const abs = Math.abs(a - b);
  return abs > tolAbs && abs / base > tolRel;
}

/**
 * Compara un rubro (objeto de campos numéricos) humano vs app.
 * @returns {Array<{campo, humano, app, delta, causa}>}
 */
function compararRubro(humano = {}, app = {}, opts = {}) {
  const tolRel = opts.tolRel ?? 0.005;   // 0.5%
  const tolAbs = opts.tolAbs ?? 0.01;    // 1 centavo
  const campos = new Set([...Object.keys(humano), ...Object.keys(app)]);
  const out = [];
  for (const campo of campos) {
    const h = num(humano[campo]);
    const a = num(app[campo]);
    if (h == null && a == null) continue;           // ninguno tiene número aquí
    if (h == null || a == null) {
      out.push({ campo, humano: humano[campo] ?? null, app: app[campo] ?? null, delta: null, causa: CAUSA_DIFERENCIA.DATO_FALTANTE });
      continue;
    }
    if (!difiere(h, a, tolRel, tolAbs)) {
      // Igual o dentro de tolerancia: si no es idéntico exacto, es redondeo.
      if (h !== a) out.push({ campo, humano: h, app: a, delta: +(a - h).toFixed(6), causa: CAUSA_DIFERENCIA.REDONDEO });
      continue;
    }
    out.push({ campo, humano: h, app: a, delta: +(a - h).toFixed(6), causa: RUBRO_CAUSA[campo] || CAUSA_DIFERENCIA.DATO_FALTANTE });
  }
  return out;
}

/**
 * Compara un golden completo: identidad de material + rubros numéricos.
 * @param {object} humano  {material_canonical_id, unidad, ...rubros}
 * @param {object} app     idem
 * @param {{tolRel?:number, tolAbs?:number}} [opts]
 * @returns {{diferencias:Array, porCausa:object, cuadra:boolean, soloRedondeo:boolean}}
 */
export function compararGolden(humano = {}, app = {}, opts = {}) {
  const diferencias = [];

  // Identidad de material (no numérica): distinto canonical → IDENTIDAD_MP.
  const hId = humano.material_canonical_id ?? null;
  const aId = app.material_canonical_id ?? null;
  if (hId !== aId) diferencias.push({ campo: 'material_canonical_id', humano: hId, app: aId, delta: null, causa: CAUSA_DIFERENCIA.IDENTIDAD_MP });

  // Unidad (no numérica).
  const hU = humano.unidad ?? null;
  const aU = app.unidad ?? null;
  if (hU !== aU) diferencias.push({ campo: 'unidad', humano: hU, app: aU, delta: null, causa: CAUSA_DIFERENCIA.UNIDAD });

  // Rubros numéricos.
  const { material_canonical_id: _h1, unidad: _h2, ...hRub } = humano;
  const { material_canonical_id: _a1, unidad: _a2, ...aRub } = app;
  diferencias.push(...compararRubro(hRub, aRub, opts));

  const porCausa = {};
  for (const d of diferencias) porCausa[d.causa] = (porCausa[d.causa] || 0) + 1;

  const soloRedondeo = diferencias.length > 0 && diferencias.every((d) => d.causa === CAUSA_DIFERENCIA.REDONDEO);
  return {
    diferencias,
    porCausa,
    cuadra: diferencias.length === 0,       // idénticos
    soloRedondeo,                           // sólo difieren por redondeo (aceptable/justificable)
  };
}
