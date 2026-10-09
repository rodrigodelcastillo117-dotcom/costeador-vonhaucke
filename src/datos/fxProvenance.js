// ============================================================================
//  FX PROVENANCE (REALITY CUTOVER · tipo de cambio con procedencia, §9)
//
//  Capa PURA. Una MP en USD no produce un costo MXN "real" con un tipo de cambio
//  mágico. Se modela cada observación de FX con par/valor/fecha/fuente/evidencia
//  y se resuelve igual que un precio: sin FX verificado y vigente, la conversión
//  es PROVISIONAL y el costo MXN NO es oficial.
//
//  No lee red ni archivos. El ingestor (Banxico/factura/política) alimenta las
//  observaciones. Reglas: no inventar FX; no usar uno viejo como vigente sin decirlo.
// ============================================================================

export const ESTADO_FX = Object.freeze({
  VERIFIED_CURRENT: 'VERIFIED_CURRENT', // fuente oficial + fecha que cubre hoy/ventana
  REAL_DATED: 'REAL_DATED',             // observado real y fechado, pero sin ventana de vigencia
  HISTORICAL: 'HISTORICAL',             // fechado pero fuera de la ventana de frescura
  PROVISIONAL: 'PROVISIONAL',           // estimado/sin documento
  PENDING: 'PENDING',                   // sin FX utilizable → conversión no permitida
});

export const FUENTE_FX = Object.freeze({
  BANXICO: 'BANXICO',           // fix oficial
  FACTURA: 'FACTURA',           // el FX de la factura real de compra
  POLITICA: 'POLITICA',         // tipo de cambio de política interna (presupuesto)
  PROVISIONAL: 'PROVISIONAL',   // estimado
});

const txt = (v) => String(v ?? '').trim();
const num = (v) => { if (typeof v !== 'number' && typeof v !== 'string') return null; if (typeof v === 'string' && v.trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const fechaMs = (v) => { const s = txt(v); if (!s) return null; const t = Date.parse(s); return Number.isFinite(t) ? t : null; };

const PRIORIDAD = { BANXICO: 100, FACTURA: 80, POLITICA: 50, PROVISIONAL: 10 };

/**
 * Normaliza UNA observación de FX. `par` como 'USD/MXN'. Ventana de frescura por
 * defecto 7 días (un FX más viejo que eso, sin vigencia explícita, es HISTORICAL).
 */
export function normalizarFx(row = {}) {
  const valor = num(row.valor ?? row.tipo_cambio ?? row.rate);
  const fuente = FUENTE_FX[txt(row.fuente).toUpperCase()] || null;
  const out = {
    par: txt(row.par || 'USD/MXN').toUpperCase(),
    valor,                               // null si ausente (NO 0)
    fecha: txt(row.fecha || row.source_date) || null,
    vigencia_hasta: txt(row.vigencia_hasta || row.validity) || null,
    fuente,
    evidencia: txt(row.evidencia || row.evidence || row.documento) || null,
  };
  const issues = [];
  if (!out.par.includes('/')) issues.push('PAR_INVALIDO');
  if (out.valor === null) issues.push('SIN_VALOR');
  else if (out.valor <= 0) issues.push('VALOR_INVALIDO');
  if (!out.fuente) issues.push('FALTA_FUENTE');
  if (!out.fecha) issues.push('SIN_FECHA');
  const utilizable = out.valor !== null && out.valor > 0 && out.par.includes('/') && !!out.fuente;
  return { ...out, issues, utilizable };
}

/**
 * Resuelve el FX de un par para `hoy`, eligiendo la observación más autoritativa/
 * vigente. Sin observación utilizable → PENDING (conversión no permitida).
 * @param {string} par  p.ej. 'USD/MXN'
 * @param {Array} observaciones
 * @param {{hoy?:string|number, ventanaDias?:number}} [opts]
 */
export function resolverFx(par, observaciones = [], opts = {}) {
  // `hoy` inválido NO debe degradar silenciosamente todo a HISTORICAL (L2): fallback a ahora.
  const hoyParsed = opts.hoy != null ? (fechaMs(opts.hoy) ?? new Date(opts.hoy).getTime()) : Date.now();
  const hoyMs = Number.isFinite(hoyParsed) ? hoyParsed : Date.now();
  const ventanaMs = (opts.ventanaDias ?? 7) * 24 * 3600 * 1000;
  const parNorm = txt(par || 'USD/MXN').toUpperCase();
  // La vigencia cubre hasta el FIN del día indicado (L1): evita marcar HISTORICAL
  // un FX "válido hasta hoy" por la hora. fechaMs de 'YYYY-MM-DD' es medianoche UTC.
  const FIN_DIA = 24 * 3600 * 1000 - 1;

  const base = { par: parNorm, valor: null, fecha: null, fuente: null, evidencia: null, estado: ESTADO_FX.PENDING, bloqueaCostoOficial: true, elegida: null };
  const mias = (Array.isArray(observaciones) ? observaciones : [])
    .map((o) => (o && o.issues ? o : normalizarFx(o)))
    .filter((o) => o.utilizable && o.par === parNorm);
  if (mias.length === 0) return base;

  // Clasifica por estado. VERIFIED_CURRENT exige FUENTE OFICIAL (Banxico) + vigencia
  // que cubre hoy (H1): una POLÍTICA/estimado con vigencia futura NO es "vigente verificado".
  const esOficial = (o) => o.fuente === FUENTE_FX.BANXICO;
  const esEstimado = (o) => o.fuente === FUENTE_FX.PROVISIONAL || o.fuente === FUENTE_FX.POLITICA;
  const estadoDe = (o) => {
    if (esEstimado(o)) return ESTADO_FX.PROVISIONAL;              // presupuesto/estimado, cualquier vigencia
    const v = fechaMs(o.vigencia_hasta);
    if (v != null) {
      if (v + FIN_DIA < hoyMs) return ESTADO_FX.HISTORICAL;       // vigencia vencida
      return esOficial(o) ? ESTADO_FX.VERIFIED_CURRENT : ESTADO_FX.REAL_DATED; // factura con vigencia = real, no "oficial vigente"
    }
    const f = fechaMs(o.fecha);
    if (f == null) return ESTADO_FX.PROVISIONAL;                 // real sin fecha ni vigencia → no se puede fechar
    return (hoyMs - f) <= ventanaMs ? ESTADO_FX.REAL_DATED : ESTADO_FX.HISTORICAL;
  };
  const rank = { VERIFIED_CURRENT: 4, REAL_DATED: 3, HISTORICAL: 2, PROVISIONAL: 1, PENDING: 0 };
  const cmp = (a, b) => {
    const ra = rank[estadoDe(a)]; const rb = rank[estadoDe(b)];
    if (ra !== rb) return rb - ra;
    const fa = fechaMs(a.fecha) ?? -Infinity; const fb = fechaMs(b.fecha) ?? -Infinity;
    if (fa !== fb) return fb - fa;
    const pa = PRIORIDAD[a.fuente] ?? 0; const pb = PRIORIDAD[b.fuente] ?? 0;
    if (pa !== pb) return pb - pa;
    // Orden TOTAL determinista (M1): evidencia, luego valor, luego 0 (empate real).
    const ea = String(a.evidencia || ''); const eb = String(b.evidencia || '');
    if (ea !== eb) return ea < eb ? -1 : 1;
    const va = a.valor ?? 0; const vb = b.valor ?? 0;
    if (va !== vb) return va - vb;
    return 0;
  };
  const elegida = [...mias].sort(cmp)[0];
  const estado = estadoDe(elegida);
  return {
    par: parNorm,
    valor: elegida.valor,
    fecha: elegida.fecha,
    fuente: elegida.fuente,
    evidencia: elegida.evidencia,
    estado,
    // Sólo un FX verificado-vigente o real-fechado-fresco habilita costo oficial.
    bloqueaCostoOficial: !(estado === ESTADO_FX.VERIFIED_CURRENT || estado === ESTADO_FX.REAL_DATED),
    elegida,
  };
}
