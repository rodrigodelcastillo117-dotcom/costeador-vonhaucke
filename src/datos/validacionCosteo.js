// ============================================================================
//  VALIDACION DE COSTEO — la "maquina de confiabilidad" de COSTEAR.
//  Convierte "creo que es ±X%" en "esta MEDIDO en ±X%". No inventa el costo real:
//  lo recibe de afuera (contabilidad/OC). Sin costo real -> dice "sin medir",
//  nunca finge una validacion.
//
//  Dos piezas:
//   1. medirError(estimado, real): error por capa y total, con signo (sobre/sub).
//   2. clasificarConfianza(costeo): certificable | estimado | bloqueado, con motivo,
//      a partir de la PROVENIENCIA de cada dato (anclado a verificado vs estimado),
//      no del optimismo del que costea.
// ============================================================================

/** Error relativo y absoluto de un estimado contra un real conocido. */
export function medirError(estimado, real) {
  const e = Number(estimado), r = Number(real);
  if (!Number.isFinite(e) || !Number.isFinite(r) || r === 0) {
    return { medible: false, motivo: 'falta costo real o es cero' };
  }
  const abs = e - r;
  const pct = (abs / r) * 100;
  return { medible: true, estimado: e, real: r, error_abs: +abs.toFixed(2),
    error_pct: +pct.toFixed(2), signo: abs > 0 ? 'SOBRECOSTEA' : abs < 0 ? 'SUBCOSTEA' : 'EXACTO' };
}

/** Mide por capas (material/mano_obra/gif/terceros/total) contra un real por capa. */
export function medirPorCapa(estimadoCapas = {}, realCapas = {}) {
  const capas = new Set([...Object.keys(estimadoCapas), ...Object.keys(realCapas)]);
  const out = {};
  for (const k of capas) out[k] = medirError(estimadoCapas[k], realCapas[k]);
  return out;
}

/**
 * Clasifica la confianza de un costeo por la PROVENIENCIA de sus datos.
 * @param {object} c
 * @param {boolean} c.fabAncladaVerificada  la capa de fabricacion coincide (<=tol%) con un cos_fab_real verificado
 * @param {number}  [c.fabErrorPct]          % de diferencia fab vs verificado (si se midio)
 * @param {boolean} c.todosPreciosVigentes   todos los componentes tienen precio ERP vigente/certificado
 * @param {boolean} c.hayConsumoEstimado     algun consumo (lamina/MDF) va por area/analogia, sin despiece
 * @param {boolean} c.tercerosMedidos        la capa de terceros/armado fue medida contra un real
 * @param {boolean} [c.bloqueado]            el motor fallo-cerrado (dato faltante duro)
 * @param {number}  [c.tol]                  tolerancia % para "anclado" (default 2)
 */
export function clasificarConfianza(c = {}) {
  const motivos = [];
  if (c.bloqueado) return { nivel: 'bloqueado', motivos: ['el motor fallo-cerrado: falta un dato duro'] };
  const tol = Number.isFinite(c.tol) ? c.tol : 2;
  const fabOk = c.fabAncladaVerificada && (!Number.isFinite(c.fabErrorPct) || Math.abs(c.fabErrorPct) <= tol);
  if (!fabOk) motivos.push('la capa de fabricacion NO esta anclada a un costo verificado');
  if (!c.todosPreciosVigentes) motivos.push('hay componentes sin precio ERP vigente/certificado');
  if (c.hayConsumoEstimado) motivos.push('consumo de material estimado (area/analogia), sin despiece real');
  if (!c.tercerosMedidos) motivos.push('la capa de terceros/armado NO fue medida contra un costo real');

  // Certificable: fab anclada + todo con precio vigente + sin estimados + terceros MEDIDOS.
  if (fabOk && c.todosPreciosVigentes && !c.hayConsumoEstimado && c.tercerosMedidos) {
    return { nivel: 'certificable', motivos: ['fab anclada, precios vigentes y error de terceros medido'] };
  }
  // Estimado: la fab puede estar anclada, pero algo (terceros sin medir, consumo estimado) impide certificar.
  if (fabOk) return { nivel: 'estimado', motivos };
  return { nivel: 'bloqueado', motivos };
}

/** Veredicto corto para la UI. */
export function veredicto(nivel) {
  return { certificable: '🟢 CERTIFICABLE', estimado: '🟡 ESTIMADO', bloqueado: '🔴 BLOQUEADO' }[nivel] || '—';
}
