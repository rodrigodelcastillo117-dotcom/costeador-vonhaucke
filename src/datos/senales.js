// ============================================================================
//  SEÑALES · la capa determinística del "cerebro" de Voni (Fase 1 del plan
//  "Voni Cerebro"). Son cuentas sobre datos reales, no algo que un modelo
//  interprete: mismo margen por renglón que ya se ve en Cotizacion.jsx, mismo
//  sello Firme/Calibrado/Estimado que ya usa Voni. Cero riesgo de que se
//  invente una cifra de negocio, porque no hay modelo de lenguaje aquí — eso
//  es la Fase 2 (narrar estas señales con la voz de Voni), que las recibe ya
//  calculadas y nunca las recalcula por su cuenta.
// ============================================================================
import { selloPartida } from '../util.js';
import { precioDeInsumo } from '../motor/calculo.js';

// Señales de UNA cotización — el lente "auditor de este proyecto" (Voni,
// Paso 4 · Propuesta). `partidas` es `cot.partidas`; `margenMinimo` viene de
// `estado.parametros.margenMinimo` (mismo umbral que ya usa Cotizacion.jsx
// para pintar de rojo un renglón).
export function senalesCotizacion(partidas = [], margenMinimo = 25) {
  const lista = [];
  if (!partidas.length) return lista;

  const sellos = partidas.map((p) => selloPartida(p));
  const nEstimado = sellos.filter((s) => s.tipo === 'estimado').length;

  if (nEstimado > 0) {
    lista.push({
      tipo: 'ambar',
      texto: `${nEstimado} de ${partidas.length} ${nEstimado === 1 ? 'renglón trae precio' : 'renglones traen precio'} estimado (línea sin calibrar). Sirve para dar una idea; pídele a Diseño que lo confirme antes de comprometerlo con el cliente.`,
    });
  }

  // Mismo cálculo de margen por renglón que Cotizacion.jsx (margenFila,
  // línea ~384-385): (precio - costo) / precio, sobre lo que SÍ trae costo
  // real (nunca piezas de banco, que vienen de un presupuesto cerrado).
  const conCosto = partidas.filter((p) => p.costoUnitario > 0 && !p.deBanco);
  const bajoMinimo = conCosto.filter((p) => {
    const margen = ((p.precioUnitario - p.costoUnitario) / (p.precioUnitario || 1)) * 100;
    return margen < margenMinimo;
  });
  if (bajoMinimo.length) {
    lista.push({
      tipo: 'roja',
      texto: `${bajoMinimo.length} ${bajoMinimo.length === 1 ? 'renglón queda' : 'renglones quedan'} por debajo del margen mínimo de ${margenMinimo}%.`,
    });
  }

  return lista;
}

// PROBLEMAS QUE BLOQUEAN LA EMISIÓN (mandato Fase 1: "bloquea únicamente la
// emisión que dependería de inventar un número"). Un renglón que llega al PDF
// del cliente DEBE tener cantidad positiva y precio positivo; sin eso el total
// es una mentira (cantidad ausente cuenta como 0 → renglón invisible en la suma;
// precio 0 → se regala). NO se bloquea por costo desconocido: una pieza de banco
// con precio real histórico y costo desconocido SÍ es vendible (así se decidió).
// Devuelve [] cuando se puede emitir; si trae algo, la UI no debe emitir.
export function problemasDeEmision(partidas = []) {
  const problemas = [];
  partidas.forEach((p, i) => {
    const etq = p.nombre || `Renglón ${i + 1}`;
    if (!(p.cantidad > 0)) problemas.push(`"${etq}" no tiene una cantidad válida.`);
    if (!(p.precioUnitario > 0)) problemas.push(`"${etq}" no tiene un precio válido.`);
  });
  return problemas;
}

// Señales del catálogo de insumos — cuántos no traen registrado de dónde
// salió su precio. Hoy esa cuenta solo la sabía `scripts/revisa-precios.mjs`
// corriendo aparte; aquí se vuelve una señal viva dentro de la app.
export function senalesInsumos(insumos = [], par) {
  if (!insumos.length) return [];
  const sinFuente = insumos.filter((i) => !i.fuente);
  if (!sinFuente.length) return [];
  const lista = [{
    tipo: 'ambar',
    texto: `${sinFuente.length} de ${insumos.length} insumos no traen registrado de dónde salió su precio.`,
  }];
  // De esos sin fuente, cuántos además se están costeando en $0 en vivo —
  // no solo falta la procedencia del precio, falta el precio mismo.
  const enCero = sinFuente.filter((i) => precioDeInsumo(i, par) === 0);
  if (enCero.length) {
    lista.push({
      tipo: 'roja',
      texto: `${enCero.length} ${enCero.length === 1 ? 'insumo se está costeando' : 'insumos se están costeando'} en $0: sin precio capturado y sin fuente.`,
    });
  }
  return lista;
}
