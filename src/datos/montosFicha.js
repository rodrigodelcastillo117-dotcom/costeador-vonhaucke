// ============================================================================
//  MONTOS DE LA FICHA PDF (lógica pura extraída de FichaPDF.jsx, 2026-10-14). Refactor puro.
//  Importe, IVA y total con las fronteras monetarias canónicas (centavos enteros). Un precio o una
//  cantidad inválidos dan null en toda la escalera — la ficha imprime "sin dato", nunca $0.00.
//  Probado por comportamiento en pdfMoneyTrust.test.js.
// ============================================================================
import { importePorCantidad, cargoPorcentaje, sumarMontos } from '../motor/comercialDinero.js';

export function montosFicha(precioUnitario, cantidad, ivaPct) {
  const importe = importePorCantidad(precioUnitario, cantidad);
  const iva = importe == null ? null : cargoPorcentaje(importe, ivaPct);
  const total = importe == null || iva == null ? null : sumarMontos([importe, iva]);
  return { importe, iva, total };
}
