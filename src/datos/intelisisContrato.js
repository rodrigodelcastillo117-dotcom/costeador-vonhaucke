// ============================================================================
//  CONTRATO CANÓNICO INTELISIS v1
//  ----------------------------------------------------------------------------
//  La app NO depende de cómo TI exponga Intelisis (API, vistas SQL o CSV).
//  Cualquier fuente se normaliza primero a este contrato y sólo después puede
//  alimentar catálogo/precios. Fail-closed: un precio ambiguo o sin evidencia
//  NUNCA se vuelve costo autorizado.
// ============================================================================

export const INTELISIS_CONTRACT_VERSION = 'intelisis-v1';

export const INTELISIS_SOURCES = Object.freeze({
  API: 'intelisis-api',
  SQL: 'intelisis-sql-readonly',
  CSV: 'intelisis-csv',
});

// El motor actual distingue MXN vs moneda extranjera con UN solo tipoCambio,
 // calibrado para USD. Aceptar EUR aquí haría que se multiplicara por TC USD.
 // Hasta que exista FX por moneda, v1 sólo permite MXN/USD (fail-closed).
const MONEDAS = new Set(['MXN', 'USD']);
const UNIDADES = new Set([
  'pza', 'juego', 'kg', 'g', 'm', 'cm', 'mm', 'm2', 'm3',
  'hoja', 'tramo', 'rollo', 'caja', 'paquete', 'lt', 'ml',
]);

const UNIDAD_ALIAS = new Map([
  ['pieza', 'pza'], ['piezas', 'pza'], ['pz', 'pza'], ['pza', 'pza'],
  ['jgo', 'juego'], ['juego', 'juego'],
  ['kilogramo', 'kg'], ['kilogramos', 'kg'], ['kilo', 'kg'], ['kg', 'kg'],
  ['gramo', 'g'], ['gramos', 'g'], ['g', 'g'],
  ['metro', 'm'], ['metros', 'm'], ['mt', 'm'], ['mts', 'm'], ['m', 'm'],
  ['cm', 'cm'], ['centimetro', 'cm'], ['centimetros', 'cm'],
  ['mm', 'mm'], ['milimetro', 'mm'], ['milimetros', 'mm'],
  ['m²', 'm2'], ['m2', 'm2'], ['metro cuadrado', 'm2'], ['metros cuadrados', 'm2'],
  ['m³', 'm3'], ['m3', 'm3'], ['metro cubico', 'm3'], ['metros cubicos', 'm3'],
  ['hoja', 'hoja'], ['hojas', 'hoja'],
  ['tramo', 'tramo'], ['tramos', 'tramo'],
  ['rollo', 'rollo'], ['rollos', 'rollo'],
  ['caja', 'caja'], ['cajas', 'caja'],
  ['paquete', 'paquete'], ['paquetes', 'paquete'],
  ['litro', 'lt'], ['litros', 'lt'], ['lt', 'lt'], ['l', 'lt'],
  ['mililitro', 'ml'], ['mililitros', 'ml'], ['ml', 'ml'],
]);

function txt(v) {
  return v == null ? '' : String(v).trim();
}

function normKey(v) {
  return txt(v)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizarUnidadIntelisis(v) {
  const n = UNIDAD_ALIAS.get(normKey(v)) || normKey(v);
  return UNIDADES.has(n) ? n : null;
}

export function normalizarMonedaIntelisis(v) {
  const n = txt(v || 'MXN').toUpperCase();
  return MONEDAS.has(n) ? n : null;
}

function numeroEstricto(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = txt(v);
  if (!s) return null;
  // Sólo quitamos símbolo/espacios, no letras. Soporta:
  //  1335.60 | 1,335.60 | 1335,60 | 1.335,60
  s = s.replace(/^[$€£]\s*/, '').replace(/\s+/g, '');
  let normal = null;
  if (/^-?\d+(\.\d+)?$/.test(s)) normal = s;
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) normal = s.replace(/,/g, '');
  else if (/^-?\d+(,\d+)$/.test(s)) normal = s.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) normal = s.replace(/\./g, '').replace(',', '.');
  if (normal == null) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function fechaISO(v) {
  const s = txt(v);
  if (!s) return null;
  // Contrato explícito: ISO calendario. No adivinamos 01/02/26 y tampoco
  // dejamos que Date "corrija" 2026-02-30 a marzo.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) return null;
  return s;
}

function primero(raw, keys) {
  for (const k of keys) {
    const v = raw?.[k];
    if (v !== undefined && v !== null && txt(v) !== '') return v;
  }
  return null;
}

export function normalizarMaterialIntelisis(raw, {
  source = INTELISIS_SOURCES.CSV,
  snapshotId = null,
} = {}) {
  const issues = [];
  if (!Object.values(INTELISIS_SOURCES).includes(source)) issues.push('SOURCE_INVALID');

  const claveERP = txt(primero(raw, ['clave_erp', 'clave', 'sku', 'articulo', 'codigo']));
  const descripcion = txt(primero(raw, ['descripcion', 'nombre', 'articulo_descripcion']));
  const unidadCompraRaw = primero(raw, ['unidad_compra', 'unidad', 'unidad_entrada']);
  const unidadConsumoRaw = primero(raw, ['unidad_consumo', 'unidad_costeo']);
  const unidadCompra = normalizarUnidadIntelisis(unidadCompraRaw);
  // Si Intelisis no manda unidad de consumo, la identidad es la única
  // interpretación segura: misma unidad de compra. Si la app interna usa otra,
  // el reconciliador ERP→insumo debe exigir conversión explícita.
  const unidadConsumo = unidadConsumoRaw ? normalizarUnidadIntelisis(unidadConsumoRaw) : unidadCompra;
  const precioCompra = numeroEstricto(primero(raw, [
    'precio_compra', 'precio', 'costo_ultima_compra', 'ultimo_costo', 'costo',
  ]));
  const monedaRaw = primero(raw, ['moneda', 'currency']);
  const moneda = normalizarMonedaIntelisis(monedaRaw);
  const costoMxnRaw = numeroEstricto(primero(raw, [
    'costo_mxn', 'precio_mxn', 'costo_moneda_local', 'importe_mxn',
  ]));
  const tipoCambioMxnRaw = numeroEstricto(primero(raw, [
    'tipo_cambio_mxn', 'tipo_cambio', 'exchange_rate_mxn',
  ]));
  const factorRaw = numeroEstricto(primero(raw, ['factor_conversion', 'conversion_factor']));
  const factorConversion = factorRaw == null && unidadCompra && unidadConsumo === unidadCompra ? 1 : factorRaw;
  const vigenteDesde = fechaISO(primero(raw, [
    'vigente_desde', 'fecha_precio', 'fecha_ultima_compra', 'ultima_compra_fecha', 'fecha',
  ]));
  const proveedor = txt(primero(raw, ['proveedor', 'proveedor_nombre']));
  const evidencia = txt(primero(raw, [
    'evidencia', 'folio_compra', 'orden_compra', 'oc', 'factura', 'movimiento_id',
  ]));

  if (!claveERP) issues.push('MISSING_ERP_KEY');
  if (!descripcion) issues.push('MISSING_DESCRIPTION');
  if (!unidadCompra) issues.push('UNKNOWN_PURCHASE_UNIT');
  if (unidadConsumoRaw && !unidadConsumo) issues.push('UNKNOWN_COST_UNIT');
  if (!(precioCompra > 0)) issues.push('INVALID_PRICE');
  if (!monedaRaw) issues.push('MISSING_CURRENCY');
  else if (!moneda) issues.push('UNSUPPORTED_CURRENCY');

  // Para USD exigimos el costo local que realmente registró el ERP o el TC
  // explícito del movimiento. Usar el TC "de hoy" rompería la reproducción al centavo.
  let tipoCambioMxn = moneda === 'MXN' ? 1 : tipoCambioMxnRaw;
  let precioMxn = moneda === 'MXN' ? precioCompra : costoMxnRaw;
  if (moneda === 'USD') {
    if (!(precioMxn > 0) && precioCompra > 0 && tipoCambioMxn > 0) {
      precioMxn = precioCompra * tipoCambioMxn;
    }
    if (!(precioMxn > 0)) issues.push('MISSING_MXN_COST_OR_FX');
    if (costoMxnRaw > 0 && tipoCambioMxnRaw > 0 && precioCompra > 0) {
      const calculado = precioCompra * tipoCambioMxnRaw;
      const delta = Math.abs(calculado - costoMxnRaw) / costoMxnRaw;
      if (delta > 0.005) issues.push('FX_COST_MISMATCH');
    }
  }

  if (!vigenteDesde) issues.push('INVALID_OR_AMBIGUOUS_DATE');
  if (!txt(snapshotId)) issues.push('MISSING_SNAPSHOT');

  // Si compra y consumo son unidades distintas, la conversión debe venir
  // explícita. Nunca inferimos hoja↔m2, kg↔hoja, tramo↔m, etc.
  if (unidadCompra && unidadConsumo && unidadCompra !== unidadConsumo && !(factorConversion > 0)) {
    issues.push('MISSING_CONVERSION');
  }
  if (factorConversion != null && !(factorConversion > 0)) issues.push('INVALID_CONVERSION');

  // Fuente técnica no equivale a evidencia comercial. Un endpoint puede ser
  // auténtico y aun así devolver un costo sin OC/factura/movimiento rastreable.
  if (!evidencia) issues.push('MISSING_EVIDENCE');

  const blocking = new Set([
    'SOURCE_INVALID', 'MISSING_ERP_KEY', 'MISSING_DESCRIPTION',
    'UNKNOWN_PURCHASE_UNIT', 'UNKNOWN_COST_UNIT', 'INVALID_PRICE',
    'MISSING_CURRENCY', 'UNSUPPORTED_CURRENCY', 'MISSING_MXN_COST_OR_FX', 'FX_COST_MISMATCH',
    'INVALID_OR_AMBIGUOUS_DATE', 'MISSING_SNAPSHOT',
    'MISSING_CONVERSION', 'INVALID_CONVERSION', 'MISSING_EVIDENCE',
  ]);
  const bloqueos = issues.filter((x) => blocking.has(x));

  return {
    contract_version: INTELISIS_CONTRACT_VERSION,
    source,
    snapshot_id: snapshotId || null,
    clave_erp: claveERP || null,
    descripcion: descripcion || null,
    proveedor: proveedor || null,
    unidad_compra: unidadCompra,
    unidad_consumo: unidadConsumo,
    factor_conversion: factorConversion,
    precio_compra: precioCompra,
    moneda,
    precio_mxn: precioMxn,
    tipo_cambio_mxn: tipoCambioMxn,
    vigente_desde: vigenteDesde,
    evidencia: evidencia || null,
    issues,
    costeable: bloqueos.length === 0,
    // Valores CANÓNICOS de la DB real (constraints de insumo_precios).
    evidence_status: evidencia ? 'documentada' : 'sin_evidencia',
    confidence: bloqueos.length === 0 ? 'alta' : 'baja',
  };
}

// Convierte un registro YA validado al formato de la tabla histórica de precios.
// Requiere un insumo_id existente/mapeado: jamás inventa una relación ERP→motor.
export function precioSupabaseDesdeIntelisis(registro, { insumoId, unidadCosteoInterna = null } = {}) {
  if (!registro?.costeable) throw new Error('INTELISIS_RECORD_NOT_COSTABLE');
  const id = txt(insumoId);
  if (!id) throw new Error('MISSING_INTERNAL_INSUMO_ID');
  const unidadInterna = unidadCosteoInterna ? normalizarUnidadIntelisis(unidadCosteoInterna) : null;
  if (unidadCosteoInterna && !unidadInterna) throw new Error('UNKNOWN_INTERNAL_COST_UNIT');
  if (unidadInterna && registro.unidad_consumo !== unidadInterna) {
    throw new Error('ERP_INTERNAL_UNIT_MISMATCH');
  }

  return {
    insumo_id: id,
    // La tabla operativa recibe costo CANÓNICO EN MXN. El precio/moneda
    // originales se preservan en propiedades para auditoría.
    precio: registro.precio_mxn,
    unidad_compra: registro.unidad_compra,
    precio_compra: registro.precio_mxn,
    factor_conversion: registro.factor_conversion,
    proveedor: registro.proveedor,
    fuente: `Intelisis · ${registro.source} · ${registro.contract_version}`,
    evidencia: registro.evidencia,
    vigente_desde: registro.vigente_desde,
    estado: 'propuesto',
    confidence: registro.confidence,
    evidence_status: registro.evidence_status,
    requiere_validacion_compras: true,
    propiedades: {
      clave_erp: registro.clave_erp,
      moneda: 'MXN',
      moneda_origen: registro.moneda,
      precio_origen: registro.precio_compra,
      tipo_cambio_mxn: registro.tipo_cambio_mxn,
      unidad_consumo: registro.unidad_consumo,
      unidad_costeo_interna: unidadInterna || registro.unidad_consumo,
      snapshot_id: registro.snapshot_id,
      contract_version: registro.contract_version,
    },
  };
}

export function resumirLoteIntelisis(registros = []) {
  const total = registros.length;
  const costeables = registros.filter((x) => x?.costeable).length;
  const porIssue = {};
  for (const r of registros) {
    for (const issue of r?.issues || []) porIssue[issue] = (porIssue[issue] || 0) + 1;
  }
  return {
    total,
    costeables,
    bloqueados: total - costeables,
    cobertura_pct: total ? Math.round((costeables / total) * 10000) / 100 : 0,
    issues: porIssue,
  };
}
