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
import { evaluarEmisionLocal, detalleBloqueo } from './emision.js';
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
// Además de cantidad/precio, se bloquea un COSTEO INCOMPLETO: una partida con
// piezas cuyo material no existe en el catálogo se costeó en $0 por esas piezas
// (motor: `componentesSinMaterial`), así que su costo —y por tanto su margen— es
// mentira. El borrador SÍ se puede guardar; lo que no se puede es emitirlo al
// cliente sin asignar o quitar esas piezas (audit 2026-10-01).
// FUENTE ÚNICA, ESTRUCTURADA de los bloqueos de emisión. Cada bloqueo trae por qué
// importa y cómo corregirlo, para que la UI/Voni respondan "¿por qué no puedo emitir?"
// de forma determinista (los bloqueos son dinero: NO los decide un LLM). `problemasDeEmision`
// (abajo) deriva de aquí sus textos, para no tener dos definiciones que se desincronicen.
export function bloqueosDeEmision(partidas = []) {
  // VH-047: deriva de la compuerta única (misma lectura que el servidor). Las
  // exclusiones se confirman en la pantalla, no aquí; `sin_partidas` no es bloqueo
  // de renglón.
  const g = evaluarEmisionLocal({ partidas, confirmoExcluidas: true });
  // Motivos duros + veredicto económico (costo preliminar/incompleto): ambos impiden la emisión definitiva.
  const b = [...g.motivos, ...(g.economics || [])].filter((c) => c !== 'sin_partidas').map((c) => detalleBloqueo(c, partidas));
  // Especial/nuevo sin costeo autorizado (línea viva 2026-10-08): tratarlo como $0 falsearía margen y precio.
  partidas.forEach((p, i) => {
    if (p?.costoPendiente !== true) return;
    const etq = p.nombre || `Renglón ${i + 1}`;
    b.push({ code: 'COSTO_PENDIENTE', pieza: etq, nivel: 'blocker',
      titulo: `"${etq}" todavía no tiene un costeo válido.`,
      porque: 'Es un producto especial/nuevo y no existe un resultado de costeo autorizado; tratarlo como $0 falsearía margen y precio.',
      corregir: `Vuelve a costear "${etq}" y resuelve sus datos pendientes antes de emitir.` });
  });
  return b;
}

// Lista de textos (compatibilidad): [] cuando se puede emitir; si trae algo, la UI no
// debe emitir. Deriva de `bloqueosDeEmision` para mantener una sola definición.
export function problemasDeEmision(partidas = []) {
  return bloqueosDeEmision(partidas).map((x) => x.titulo);
}

// Señales del catálogo de insumos — cuántos no traen registrado de dónde
// salió su precio. Hoy esa cuenta solo la sabía `scripts/revisa-precios.mjs`
// corriendo aparte; aquí se vuelve una señal viva dentro de la app.
// VH-143: `insumo_motor` (catalogo_motor) entrega la fuente del precio en `evidencia.fuente`, no en
// `fuente`; la semilla local la trae en `fuente`. Leer sólo una de las dos marcaba como "sin fuente"
// a TODO el catálogo certificado (ERP aprobado incluido).
export const fuenteDeInsumo = (i) => (i && (i.fuente || i.evidencia?.fuente)) || null;

export function senalesInsumos(insumos = [], par) {
  if (!insumos.length) return [];
  const sinFuente = insumos.filter((i) => !fuenteDeInsumo(i));
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
