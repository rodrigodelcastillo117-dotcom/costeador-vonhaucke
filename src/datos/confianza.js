// ============================================================================
//  ¿QUÉ TAN FIRME ES ESTE NÚMERO?  ·  la exactitud, medida y a la vista.
//
//  Rodrigo: "que la exactitud también esté". El problema no es que la app
//  invente: es que **no dice cuáles renglones son firmes y cuáles salen del
//  modelo**, y los dos se ven idénticos en la propuesta. El día que un cliente
//  compare contra un presupuesto viejo, la confianza se pierde en el renglón
//  flojo — y hoy nadie sabe cuál es.
//
//  Medido el 2026-08-17: de las 24 líneas, **sólo 4 tienen precio real de
//  venta** (applt, río, modulor, mox). Las otras 20 salen del modelo.
//
//  Esto NO inventa precisión: la MIDE y la reporta, para (a) que el vendedor
//  sepa qué puede defender enfrente del cliente y (b) que Rodrigo vea de un
//  vistazo de qué líneas conseguir un presupuesto cerrado — que es el trabajo
//  que de verdad sube la exactitud, y es suyo, no del código.
// ============================================================================

import { LINEAS_REG } from './lineas.js';

// El nombre que ve la gente, no la ruta interna: "App LT", no "applt".
const nombreLinea = (p) => p.linea || LINEAS_REG[p.ruta]?.titulo || p.ruta || 'sin línea';

/** Una partida es FIRME si su precio salió de un presupuesto cerrado real. */
export const esFirme = (pt) => !!(pt?.precioReal || pt?.deBanco);

/**
 * Cuánto del dinero de la propuesta está respaldado por precios reales.
 * Se pesa por IMPORTE, no por número de renglones: una banca de $40,000 pesa
 * más que un archivero de $3,000, y es la que te van a comparar.
 */
export function confianzaDe(partidas = []) {
  const importe = (p) => (p.precioUnitario || 0) * (p.cantidad || 0);
  const total = partidas.reduce((s, p) => s + importe(p), 0);
  const firmes = partidas.filter(esFirme);
  const montoFirme = firmes.reduce((s, p) => s + importe(p), 0);

  // Las líneas que hoy sostienen el número con el modelo. Son la lista de
  // compras de Rodrigo: por cada una, pedir UN presupuesto cerrado.
  const flojas = new Map();
  for (const p of partidas) {
    if (esFirme(p)) continue;
    const k = nombreLinea(p);
    flojas.set(k, (flojas.get(k) || 0) + importe(p));
  }

  return {
    total,
    montoFirme,
    pct: total > 0 ? Math.round((montoFirme / total) * 100) : 0,
    nFirmes: firmes.length,
    nPartidas: partidas.length,
    // De mayor a menor: la primera de la lista es la que más urge anclar.
    lineasFlojas: [...flojas.entries()]
      .map(([linea, monto]) => ({ linea, monto }))
      .sort((a, b) => b.monto - a.monto),
  };
}

/** Cómo se le dice al vendedor, en una frase que puede usar. */
export function textoConfianza(c) {
  if (!c || !c.nPartidas) return null;
  if (c.pct >= 90) return 'Casi todo el precio sale de proyectos ya cerrados: lo puedes defender renglón por renglón.';
  if (c.pct >= 60) return 'La mayor parte del precio sale de proyectos ya cerrados. Lo demás lo calcula el modelo.';
  if (c.pct >= 25) return 'Buena parte del precio la calcula el modelo. Antes de comprometerte, confírmalo con Dirección.';
  return 'Casi todo este precio lo calcula el modelo, no sale de un proyecto cerrado. Confírmalo antes de mandarlo.';
}
