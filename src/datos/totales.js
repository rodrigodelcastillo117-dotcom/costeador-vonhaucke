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
//  Regla de redondeo (FIX-05 / CST-02): el cliente suma la hoja con calculadora.
//  Por eso el TOTAL que cuenta es la suma de los MISMOS renglones ya redondeados
//  al peso que se imprimen (`totalRedondeado`), no el flotante crudo. Cada peso
//  cae donde el cliente lo ve; la diferencia contra el flotante nunca pasa de un
//  peso por renglón. `total` (flotante) se conserva para cálculos internos.
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
  const precioLista = partidas.reduce((a, p) => a + linea(p), 0);

  const descuentoPct = cot.descuentoPct ?? par.descuentoPorcentaje ?? 0;
  const descuento = precioLista * (descuentoPct / 100);
  const subtotal = precioLista - descuento;

  const contingenciaPct = cot.contingenciaPct ?? par.contingenciaPorcentaje ?? 0;
  const contingencia = subtotal * (contingenciaPct / 100);
  const maniobrasPct = cot.maniobrasPct ?? par.maniobrasPorcentaje ?? 0;
  const maniobras = subtotal * (maniobrasPct / 100);
  const fletePct = cot.fletePct ?? par.fletePorcentaje ?? 0;
  const flete = subtotal * (fletePct / 100);

  const baseGravable = subtotal + contingencia + maniobras + flete;
  const ivaPct = par.ivaPorcentaje ?? 16;
  const iva = baseGravable * (ivaPct / 100);
  const total = baseGravable + iva;                 // flotante, uso interno

  // El total que se IMPRIME y se GUARDA: suma de los renglones ya redondeados.
  // Ojo: Math.round(-x) ≠ -Math.round(x) en los .5 (JS redondea hacia +∞), por
  // eso el descuento se redondea en positivo y luego se resta —igual que el PDF.
  const totalRedondeado =
    Math.round(precioLista) - Math.round(descuento) + Math.round(contingencia)
    + Math.round(maniobras) + Math.round(flete) + Math.round(iva);

  const anticipoPct = cot.anticipoPct ?? par.anticipoPorcentaje ?? 50;
  const anticipo = Math.round(totalRedondeado * (anticipoPct / 100));

  return {
    precioLista, descuentoPct, descuento, subtotal,
    contingenciaPct, contingencia, maniobrasPct, maniobras, fletePct, flete,
    ivaPct, iva, baseGravable, total, totalRedondeado,
    anticipoPct, anticipo, hayLineaInvalida,
  };
}
