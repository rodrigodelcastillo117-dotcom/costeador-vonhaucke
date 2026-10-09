// ============================================================================
//  CanonicalPriceResolver (REALITY CUTOVER, v1)
//
//  DETERMINISTA y PURO. Dada la identidad canónica de un insumo y TODAS sus
//  observaciones de precio (ya normalizadas con precioProvenance), decide qué
//  precio USAR hoy y con qué ESTADO, conservando la procedencia para que la UI
//  pueda responder "¿por qué estás usando $544?".
//
//  Selección (en este orden, SIN inventar):
//   1. Identidad EXACTA del insumo (canonical_insumo_id). Nunca fuzzy.
//   2. Sólo observaciones con precio utilizable (PENDING descartadas).
//   3. Tier por vigencia/realidad:
//        CURRENT_VERIFIED  (real + vigencia explícita que cubre `hoy`)
//        > REAL_OBSERVED   (la compra/documento real MÁS RECIENTE)
//        > HISTORICAL      (reales anteriores, o vigencia vencida)
//        > PROVISIONAL     (estimados)
//   4. Dentro de un tier: fecha más reciente; empate → mayor confianza; empate →
//      mayor prioridad de fuente; empate → id de documento (estable).
//
//  NO asume "última compra = vigente eternamente": la última compra real es
//  REAL_OBSERVED (referencia real conocida, fechada), NO CURRENT_VERIFIED. Sólo
//  es CURRENT_VERIFIED si la propia evidencia declara una vigencia que cubre hoy.
//
//  Si no hay NINGUNA observación utilizable → PENDING: bloquea costo OFICIAL
//  (nunca se inventa un número ni se usa $0 como desconocido).
// ============================================================================
import {
  ESTADO_PRECIO, INTRINSECO,
  normalizarObservacionPrecio, confianzaObservacion, prioridadFuente, fechaMs, etiquetaFuentePrecio,
} from './precioProvenance.js';

// Normaliza la entrada: acepta observaciones crudas o ya normalizadas.
function asObs(o) {
  return (o && o.intrinseco && o.issues) ? o : normalizarObservacionPrecio(o || {});
}

// ¿La vigencia explícita cubre `hoy`? Sin vigencia ⇒ no decide (false aquí).
// La vigencia cubre hasta el FIN del día indicado (ChatGPT P1-R8-5): 'YYYY-MM-DD'
// parsea a medianoche UTC; sin esto una vigencia "hasta hoy" vencía a las 00:00.
const FIN_DIA_MS = 24 * 3600 * 1000 - 1;
function vigenciaCubre(obs, hoyMs) {
  const hasta = fechaMs(obs.validity);
  if (hasta == null) return false;
  return hasta + FIN_DIA_MS >= hoyMs;
}

// Comparador determinista dentro de un tier: + reciente, + confianza, + fuente,
// id de documento estable como último desempate.
function mejorQue(a, b) {
  const fa = fechaMs(a.source_date) ?? -Infinity;
  const fb = fechaMs(b.source_date) ?? -Infinity;
  if (fa !== fb) return fa > fb ? -1 : 1;
  const ca = confianzaObservacion(a); const cb = confianzaObservacion(b);
  if (ca !== cb) return ca > cb ? -1 : 1;
  const pa = prioridadFuente(a.fuente); const pb = prioridadFuente(b.fuente);
  if (pa !== pb) return pa > pb ? -1 : 1;
  const da = String(a.source_document || ''); const db = String(b.source_document || '');
  return da < db ? -1 : da > db ? 1 : 0;
}

/**
 * Resuelve el precio canónico de UN insumo.
 * @param {string} canonicalId
 * @param {Array} observaciones  crudas o normalizadas
 * @param {{hoy?: string|number|Date}} [opts]  fecha de referencia (default: now)
 * @returns {{
 *   canonical_insumo_id:string, estado:string, precio:number|null, moneda:string|null,
 *   unidad_compra:string|null, unidad_costeo:string|null, conversion:number|null,
 *   fuente:string|null, source_document:string|null, source_date:string|null,
 *   supplier:string|null, evidence:string|null, confianza:number,
 *   bloqueaCostoOficial:boolean, elegida:object|null, descartadas:number,
 *   alternativas:Array
 * }}
 */
export function resolverPrecioCanonico(canonicalId, observaciones = [], opts = {}) {
  // `hoy` inválido NO debe degradar silenciosamente todo a HISTORICAL: si no
  // parsea, se usa ahora (red-team LOW).
  const hoyParsed = opts.hoy != null ? (fechaMs(opts.hoy) ?? new Date(opts.hoy).getTime()) : Date.now();
  const hoyMs = Number.isFinite(hoyParsed) ? hoyParsed : Date.now();
  const id = String(canonicalId ?? '').trim();

  const base = {
    canonical_insumo_id: id || null,
    estado: ESTADO_PRECIO.PENDING,
    precio: null, moneda: null, unidad_compra: null, unidad_costeo: null, conversion: null,
    fuente: null, source_document: null, source_date: null, supplier: null, evidence: null,
    confianza: 0, bloqueaCostoOficial: true, elegida: null, descartadas: 0, alternativas: [],
  };
  if (!id) return base;

  const todas = (Array.isArray(observaciones) ? observaciones : []).map(asObs);
  // 1. Identidad EXACTA.
  const mias = todas.filter((o) => o.canonical_insumo_id === id);
  // 2. Utilizables.
  const usables = mias.filter((o) => o.precioUtilizable && o.intrinseco !== INTRINSECO.PENDING);
  const descartadas = mias.length - usables.length;
  if (usables.length === 0) return { ...base, descartadas };

  // FECHA FUTURA = FAIL-CLOSED (ChatGPT P0-5): una observación con source_date en
  // el futuro es sospechosa (error de dato). NO puede ser real/verificada ni ganar
  // por "más reciente" → se trata como PROVISIONAL (bloquea costo oficial).
  const enFuturo = (o) => { const f = fechaMs(o.source_date); return f != null && f > hoyMs; };

  // 3. Clasificación por tiers sobre el conjunto (excluyendo las de fecha futura
  // de los tiers reales/verificados).
  const verified = usables.filter((o) => o.intrinseco === INTRINSECO.VERIFIED && !enFuturo(o) && vigenciaCubre(o, hoyMs));
  // VERIFIED con VIGENCIA VENCIDA → HISTORICAL (ChatGPT #4): fue válido hasta una
  // fecha que ya pasó; NO es "última referencia real conocida" ni habilita costo
  // oficial. Va a su propio tier, NO a `reales`.
  const historicosVencidos = usables.filter((o) => o.intrinseco === INTRINSECO.VERIFIED && !enFuturo(o) && !vigenciaCubre(o, hoyMs));
  const reales = usables.filter((o) => o.intrinseco === INTRINSECO.REAL && !enFuturo(o));
  // Provisionales + cualquier observación de fecha futura (fail-closed).
  const provisionales = usables.filter((o) => o.intrinseco === INTRINSECO.PROVISIONAL || enFuturo(o));

  let elegida = null;
  let estado = ESTADO_PRECIO.PENDING;
  if (verified.length) {
    elegida = [...verified].sort(mejorQue)[0];
    estado = ESTADO_PRECIO.CURRENT_VERIFIED;
  } else if (reales.length) {
    const ord = [...reales].sort(mejorQue);
    elegida = ord[0];
    // La MÁS reciente real. CON fecha → DATED (evidencia suficiente); SIN fecha →
    // UNDATED (real-histórico, no permite afirmar "fechado/vigente"). ChatGPT #6.
    estado = fechaMs(elegida.source_date) != null
      ? ESTADO_PRECIO.REAL_OBSERVED_DATED
      : ESTADO_PRECIO.REAL_OBSERVED_UNDATED;
  } else if (historicosVencidos.length) {
    // Sólo quedan precios con vigencia vencida → HISTORICAL (bloquea costo oficial).
    elegida = [...historicosVencidos].sort(mejorQue)[0];
    estado = ESTADO_PRECIO.HISTORICAL;
  } else if (provisionales.length) {
    elegida = [...provisionales].sort(mejorQue)[0];
    estado = ESTADO_PRECIO.PROVISIONAL;
  }
  if (!elegida) return { ...base, descartadas };

  // Alternativas (todo lo demás usable), clasificando reales no elegidas como HISTORICAL.
  const alternativas = usables
    .filter((o) => o !== elegida)
    .map((o) => {
      let est = ESTADO_PRECIO.PROVISIONAL;
      if (o.intrinseco === INTRINSECO.VERIFIED && vigenciaCubre(o, hoyMs)) est = ESTADO_PRECIO.CURRENT_VERIFIED;
      else if (o.intrinseco === INTRINSECO.REAL || o.intrinseco === INTRINSECO.VERIFIED) est = ESTADO_PRECIO.HISTORICAL;
      return { estado: est, precio: o.precio, source_date: o.source_date, fuente: o.fuente, source_document: o.source_document, supplier: o.supplier };
    })
    .sort((a, b) => {
      // Comparador determinista: evita NaN cuando ambas fechas son null (red-team).
      const fa = fechaMs(a.source_date); const fb = fechaMs(b.source_date);
      const va = fa == null ? -Infinity : fa; const vb = fb == null ? -Infinity : fb;
      if (va !== vb) return vb - va;
      const da = String(a.source_document || ''); const db = String(b.source_document || '');
      return da < db ? -1 : da > db ? 1 : 0;
    });

  return {
    canonical_insumo_id: id,
    estado,
    precio: elegida.precio,
    moneda: elegida.moneda,
    unidad_compra: elegida.unidad_compra,
    unidad_costeo: elegida.unidad_costeo,
    conversion: elegida.conversion,
    fuente: elegida.fuente,
    source_document: elegida.source_document,
    source_date: elegida.source_date,
    supplier: elegida.supplier,
    evidence: elegida.evidence,
    confianza: confianzaObservacion(elegida),
    // Costo OFICIAL reproducible SÓLO con evidencia real FECHADA (o vigencia
    // verificada). Un real SIN fecha (UNDATED) es real-histórico: NO autentica un
    // costo "totalmente auditado", así que bloquea lo oficial igual que provisional.
    bloqueaCostoOficial: !(estado === ESTADO_PRECIO.CURRENT_VERIFIED || estado === ESTADO_PRECIO.REAL_OBSERVED_DATED),
    elegida,
    descartadas,
    alternativas,
  };
}

// Etiqueta corta por estado (para chips de UI). Para los estados REALES, la
// etiqueta de la fuente (Compra/T.D.C./Lista) la añade el caller con
// etiquetaEstadoDeResolucion; aquí sólo el calificativo del estado.
const ETIQUETA_ESTADO = {
  [ESTADO_PRECIO.CURRENT_VERIFIED]: 'Vigente verificado',
  [ESTADO_PRECIO.REAL_OBSERVED_DATED]: 'Real fechado',
  [ESTADO_PRECIO.REAL_OBSERVED_UNDATED]: 'Real sin fecha',
  [ESTADO_PRECIO.HISTORICAL]: 'Histórico',
  [ESTADO_PRECIO.PROVISIONAL]: 'Provisional',
  [ESTADO_PRECIO.PENDING]: 'Pendiente de precio',
};

export function etiquetaEstadoPrecio(estado) {
  return ETIQUETA_ESTADO[estado] || estado || '';
}

// Etiqueta de chip combinando TIPO DE FUENTE + calificativo de estado, p.ej.
// "Compra real · fechado", "T.D.C. (costeo humano) · sin fecha", "Estimado".
export function etiquetaEstadoDeResolucion(resolucion) {
  if (!resolucion || resolucion.estado === ESTADO_PRECIO.PENDING) return 'Pendiente de precio';
  const fuenteLbl = etiquetaFuentePrecio(resolucion.fuente);
  switch (resolucion.estado) {
    case ESTADO_PRECIO.CURRENT_VERIFIED: return `${fuenteLbl} · vigente`;
    case ESTADO_PRECIO.REAL_OBSERVED_DATED: return `${fuenteLbl} · fechado`;
    case ESTADO_PRECIO.REAL_OBSERVED_UNDATED: return `${fuenteLbl} · sin fecha`;
    case ESTADO_PRECIO.HISTORICAL: return `${fuenteLbl} · histórico`;
    case ESTADO_PRECIO.PROVISIONAL: return fuenteLbl === 'Estimado' ? 'Provisional' : `${fuenteLbl} · provisional`;
    default: return etiquetaEstadoPrecio(resolucion.estado);
  }
}

/**
 * "¿Por qué estás usando $544?" → texto auditable para la UI.
 * Ej.: "Compra real · EcoLegno 19 mm · 18 de septiembre de 2026 · $544/hoja".
 * Nunca afirma vigencia que la evidencia no respalde: un histórico se muestra
 * como histórico; un pendiente explica que falta precio.
 */
export function explicarPrecio(resolucion, nombreInsumo = '') {
  if (!resolucion || resolucion.estado === ESTADO_PRECIO.PENDING) {
    return `Sin precio con evidencia suficiente${nombreInsumo ? ` para ${nombreInsumo}` : ''}. Falta fuente real; no se emite costo oficial.`;
  }
  const money = (n, m) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${m && m !== 'MXN' ? ` ${m}` : ''}`;
  // Una fecha presente pero ilegible NO debe renderizar "Invalid Date" (red-team).
  const fechaOk = resolucion.source_date != null && Number.isFinite(Date.parse(resolucion.source_date));
  const fecha = fechaOk
    ? new Date(resolucion.source_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'sin fecha';
  // Encabeza con el TIPO DE FUENTE real (no un genérico "Compra real").
  const partes = [etiquetaEstadoDeResolucion(resolucion)];
  if (resolucion.supplier) partes.push(resolucion.supplier);
  if (nombreInsumo) partes.push(nombreInsumo);
  partes.push(fecha);
  const precio = `${money(resolucion.precio, resolucion.moneda)}${resolucion.unidad_compra ? `/${resolucion.unidad_compra}` : ''}`;
  partes.push(precio);
  let s = partes.join(' · ');
  if (resolucion.estado === ESTADO_PRECIO.REAL_OBSERVED_UNDATED) s += ' (evidencia real SIN fecha; vigencia desconocida)';
  if (resolucion.estado === ESTADO_PRECIO.HISTORICAL) s += ' (precio histórico, no vigente)';
  if (resolucion.estado === ESTADO_PRECIO.PROVISIONAL) s += ' (provisional, sin documento real)';
  return s;
}

/** ¿Este precio resuelto bloquea el costo OFICIAL del BOM? */
export function bloqueaCostoOficial(resolucion) {
  return !resolucion || resolucion.bloqueaCostoOficial === true;
}

/**
 * Resuelve un CATÁLOGO completo: agrupa observaciones por canonical_insumo_id y
 * resuelve cada uno. Devuelve un mapa id→resolución. Útil para costear un BOM y
 * saber, de un golpe, cuáles insumos bloquean el costo oficial.
 */
export function resolverCatalogoPrecios(observaciones = [], opts = {}) {
  const porId = new Map();
  for (const raw of (Array.isArray(observaciones) ? observaciones : [])) {
    const o = asObs(raw);
    if (!o.canonical_insumo_id) continue;
    if (!porId.has(o.canonical_insumo_id)) porId.set(o.canonical_insumo_id, []);
    porId.get(o.canonical_insumo_id).push(o);
  }
  const out = {};
  for (const [id, obs] of porId) out[id] = resolverPrecioCanonico(id, obs, opts);
  return out;
}
