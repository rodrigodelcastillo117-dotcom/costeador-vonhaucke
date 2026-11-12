// ============================================================================
//  ESTIMADOR DE PRECIO DE COMPRA — CRISTAL CORTADO (fallback, fail-closed)
// ----------------------------------------------------------------------------
//  Problema (medido 2026-11-12, golden Telcel DAT'S R5):
//   · El catálogo ya modela el cristal como PIEZA CORTADA a medida ("CRISTAL DE
//     WxH mm ESPESOR 6 mm ..."). Cuando la medida existe, el precio es EXACTO
//     (p.ej. 573×573 5mm = $505 real = $505 catálogo).
//   · Cuando NO existe la medida, NO hay fórmula confiable: sobre (área,
//     templado, nº barrenos, saque) el PROPIO catálogo tiene ~50 % de MAPE
//     (n=462 piezas 6 mm; R² de la regresión multivariable = 0.59). El vidrio
//     cortado es un ítem COTIZADO (cada renglón del catálogo es una cotización
//     histórica del proveedor), no uno calculable al centavo.
//   · Un ajuste por mínimos cuadrados SUBCOSTEA las piezas caras (−14 % el total
//     real, −35 % la peor), y subcostear viola la regla económica de la casa.
//
//  Qué hace este módulo y qué NO:
//   · SÍ: cuando el resolvedor NO encontró pieza exacta/cercana en catálogo, da
//     un TECHO conservador por área + operaciones (barrenos/saque) calibrado para
//     NUNCA quedar por debajo del precio real observado. Es evidencia para armar
//     el borrador, NO costo certificado.
//   · SÍ: marca `requiereCotizacion:true` y `certificable:false` — Compras debe
//     confirmar el precio real antes de que sea oficial. Fail-closed, nunca silencioso.
//   · NO: inventar un número para un espesor sin datos suficientes. Espesor fuera
//     de la tabla → PENDIENTE (code ESPESOR_SIN_DATOS), el motor deja el renglón
//     por cotizar en vez de adivinar.
//   · NO: tocar el motor ni las fórmulas (calculo.js es normativo). Esto solo
//     provee el `precio` de COMPRA que el motor costea como compra-venta.
//
//  Tarifas: derivadas del catálogo vigente (p75 de $/m² por espesor) + tope de
//  operaciones observado en las piezas reales Telcel. PROVISIONALES: pendientes
//  de ratificación de Compras/Dirección, igual que politicaMerma dejó el canto
//  en pendiente por falta de cifra. Cámbialas aquí cuando Compras dé la tarifa real.
// ============================================================================

// $/m² conservador (p75 del catálogo 6 mm = $916) + topes de operación. Solo los
// espesores con datos suficientes. Lo demás es PENDIENTE (fail-closed).
export const TARIFAS_CRISTAL = Object.freeze({
  // espesorMM: { tarifaM2, costoBarreno, costoSaque, piso }  (MXN)
  6: Object.freeze({ tarifaM2: 916, costoBarreno: 70, costoSaque: 120, piso: 45 }),
});

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/**
 * Techo conservador del precio de COMPRA de un cristal cortado sin pieza exacta
 * en catálogo. Nunca subcostea las piezas reales observadas; marca requiereCotizacion.
 *
 * @param {object} p
 * @param {number} p.largoMM
 * @param {number} p.anchoMM
 * @param {number} p.espesorMM
 * @param {number} [p.barrenos=0]   nº de barrenos/perforaciones
 * @param {boolean} [p.saque=false] saque/recorte interior o redondeo especial
 * @returns {{ok:boolean, precio?:number, certificable:boolean, requiereCotizacion:boolean,
 *            fuente:string, code?:string, evidencia?:object}}
 */
export function estimaPrecioCristalCorte({ largoMM, anchoMM, espesorMM, barrenos = 0, saque = false } = {}) {
  const L = num(largoMM), A = num(anchoMM), esp = num(espesorMM);
  if (!(L > 0) || !(A > 0)) {
    return { ok: false, code: 'GEOMETRIA_INVALIDA', certificable: false, requiereCotizacion: true, fuente: 'estimado_techo' };
  }
  const t = TARIFAS_CRISTAL[esp];
  if (!t) {
    // Sin datos suficientes para este espesor → no se inventa. El renglón queda por cotizar.
    return { ok: false, code: 'ESPESOR_SIN_DATOS', certificable: false, requiereCotizacion: true, fuente: 'estimado_techo', evidencia: { espesorMM: esp } };
  }
  const areaM2 = (L / 1000) * (A / 1000);
  const nBarr = Math.max(0, Math.round(num(barrenos)));
  const base = areaM2 * t.tarifaM2;
  const ops = nBarr * t.costoBarreno + (saque ? t.costoSaque : 0);
  const precio = Math.max(t.piso, base + ops);
  return {
    ok: true,
    precio: Math.round(precio * 100) / 100,
    certificable: false,          // es un TECHO, no un costo certificado
    requiereCotizacion: true,     // Compras confirma antes de que sea oficial
    fuente: 'estimado_techo',
    evidencia: Object.freeze({
      areaM2: Math.round(areaM2 * 10000) / 10000,
      tarifaM2: t.tarifaM2,
      barrenos: nBarr,
      costoBarrenos: Math.round(nBarr * t.costoBarreno * 100) / 100,
      saque: !!saque,
      costoSaque: saque ? t.costoSaque : 0,
      piso: t.piso,
      nota: 'Tarifa p75 catálogo + tope de operaciones. Provisional, pendiente de Compras.',
    }),
  };
}
