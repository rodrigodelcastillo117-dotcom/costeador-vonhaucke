import { aCentavosEnteros, deCentavosEnteros, porcentajeCentavos } from '../motor/dinero.js';

// ============================================================================
//  TOTALES · la ÚNICA autoridad de dinero de una cotización.
//
//  Antes esta escalera —suma → descuento → subtotal → imprevistos → maniobras →
//  flete → IVA → total— vivía copiada en tres lados que NO daban el mismo número:
//    · Cotizacion.jsx  la calculaba inline para la pantalla,
//    · pdfPropuesta.js la recalculaba para el papel,
//    · cotizaciones.js guardaba en la nube `Math.round(Σ precio×cantidad)` —o sea
//      SOLO la suma de renglones, SIN descuento, maniobras, flete ni IVA.
//  Resultado: el total archivado (y el que se ve en el Archivo) NO era el total
//  que el cliente vio en pantalla ni el que firmó en el PDF. Un mismo folio con
//  15% de descuento + IVA podía mostrar tres cifras distintas según dónde lo
//  miraras. Esto lo arregla: una función pura, un solo cálculo, tres superficies.
//
//  Regla monetaria vigente (PENNIES & CENTS): todas las fronteras económicas
//  se cuantizan a centavos. El total autoritativo es la suma de renglones/cargos
//  ya expresados en centavos enteros. `total` conserva el cálculo crudo sólo
//  para diagnóstico; `totalRedondeado` mantiene el nombre histórico pero ahora
//  significa monto final a DOS decimales, no redondeo al peso.
// ============================================================================

// `partidas` = renglones de la cotización; `cot` = la cotización (para sus
// pct propios); `par` = estado.parametros (defaults de la casa). El orden de
// prioridad de cada porcentaje es el mismo que ya usaba la pantalla:
// lo capturado en la cotización → el default de parámetros → 0.
export function totalesCotizacion(partidas = [], cot = {}, par = {}) {
  // Red contra dinero no-finito (audit P1-08): una partida con precioUnitario
  // Infinity/NaN (margen inválido, costo roto) habría hecho que TODO el total saliera
  // Infinity/NaN. Aquí una línea no-finita aporta 0 a la suma y se marca en
  // `hayLineaInvalida` para que la UI/emisión la trate como "sin precio" (fail-closed),
  // nunca como un total roto en pantalla. El precio válido no cambia en nada.
  let hayLineaInvalida = false;
  const linea = (p) => {
    const pu = p.precioUnitario;
    const c = p.cantidad;
    // Un precio/cantidad PRESENTE pero no finito (NaN/Infinity) es INVÁLIDO, no 0.
    // ⚠️ `NaN || 0` da 0 (NaN es falsy): sin este chequeo sobre el valor CRUDO, un
    // precio corrupto se disfrazaba de $0 y la cotización salía artificialmente barata
    // (fail-open). Se marca y la UI/emisión bloquean. Un precio AUSENTE (null/undefined)
    // sí cuenta 0: es "sin precio" (lo atrapa problemasDeEmision), no "corrupto".
    if ((pu != null && !Number.isFinite(pu)) || (c != null && !Number.isFinite(c))) { hayLineaInvalida = true; return 0; }
    const v = (pu || 0) * (c || 0);
    if (!Number.isFinite(v)) { hayLineaInvalida = true; return 0; }
    return v;
  };
  // Cada partida cruza a dinero autoritativo en centavos antes de sumar.
  const lineaCentavos = partidas.map((p) => {
    const v = linea(p);
    const cents = aCentavosEnteros(v);
    if (cents == null) { hayLineaInvalida = true; return 0; }
    return cents;
  });
  const precioListaCentavos = lineaCentavos.reduce((a, b) => a + b, 0);
  const precioLista = deCentavosEnteros(precioListaCentavos);

  const pctCentavos = (baseCentavos, pct) => {
    const cents = porcentajeCentavos(baseCentavos, pct);
    if (cents == null) { hayLineaInvalida = true; return 0; }
    return cents;
  };

  const descuentoPct = cot.descuentoPct ?? par.descuentoPorcentaje ?? 0;
  const descuentoCentavos = pctCentavos(precioListaCentavos, descuentoPct);
  const subtotalCentavos = precioListaCentavos - descuentoCentavos;

  const contingenciaPct = cot.contingenciaPct ?? par.contingenciaPorcentaje ?? 0;
  const contingenciaCentavos = pctCentavos(subtotalCentavos, contingenciaPct);
  const maniobrasPct = cot.maniobrasPct ?? par.maniobrasPorcentaje ?? 0;
  const maniobrasCentavos = pctCentavos(subtotalCentavos, maniobrasPct);
  const fletePct = cot.fletePct ?? par.fletePorcentaje ?? 0;
  const fleteCentavos = pctCentavos(subtotalCentavos, fletePct);

  const baseGravableCentavos = subtotalCentavos + contingenciaCentavos + maniobrasCentavos + fleteCentavos;
  const ivaPct = par.ivaPorcentaje ?? 16;
  const ivaCentavos = pctCentavos(baseGravableCentavos, ivaPct);
  const totalCentavos = baseGravableCentavos + ivaCentavos;

  const descuento = deCentavosEnteros(descuentoCentavos);
  const subtotal = deCentavosEnteros(subtotalCentavos);
  const contingencia = deCentavosEnteros(contingenciaCentavos);
  const maniobras = deCentavosEnteros(maniobrasCentavos);
  const flete = deCentavosEnteros(fleteCentavos);
  const baseGravable = deCentavosEnteros(baseGravableCentavos);
  const iva = deCentavosEnteros(ivaCentavos);
  const total = baseGravable + iva; // diagnóstico matemático
  const totalRedondeado = deCentavosEnteros(totalCentavos);

  const anticipoPct = cot.anticipoPct ?? par.anticipoPorcentaje ?? 50;
  const anticipoCentavos = pctCentavos(totalCentavos, anticipoPct);
  const anticipo = deCentavosEnteros(anticipoCentavos);

  return {
    precioLista, descuentoPct, descuento, subtotal,
    contingenciaPct, contingencia, maniobrasPct, maniobras, fletePct, flete,
    ivaPct, iva, baseGravable, total, totalRedondeado, totalCentavos,
    anticipoPct, anticipo, anticipoCentavos, hayLineaInvalida,
  };
}
