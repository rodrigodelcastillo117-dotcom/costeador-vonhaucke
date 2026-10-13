// VH-162 · NINGUNA PASADA DE LA IA PUEDE ACHICAR EL BOM EN SILENCIO.
// Corrida V3 de la credenza (13-oct): la 1ª pasada de analizar-mueble trajo 12 piezas; la 2ª ("verificación
// silenciosa") devolvió un JSON degenerado (las otras 11 piezas quedaron DENTRO de un texto con comillas simples)
// con UNA pieza, el servidor lo validó ("piezas: 1") y la pantalla reemplazó el despiece: 12 → 2 renglones sin aviso.
// Regla: si una pasada posterior trae menos de la mitad de las piezas vigentes (con al menos 4 vigentes), o trae
// texto con forma de objeto JSON incrustado en un campo, se CONSERVA lo vigente y se dice por qué.

const piezasDe = (p) => (Array.isArray(p?.piezas) ? p.piezas : []);
const RE_INCRUSTADO = /['"]\s*,\s*['"]?(procedencia|evidencia|nombre|insumoId|forma)['"]?\s*:\s*['"]|\{\s*['"]nombre['"]\s*:/;

/** ¿La propuesta trae piezas cuyo texto contiene otras piezas incrustadas (salida JSON degenerada)? */
export function propuestaDegenerada(propuesta) {
  return piezasDe(propuesta).some((x) => x && Object.values(x).some((v) => typeof v === 'string' && RE_INCRUSTADO.test(v)));
}

/**
 * Decide si una pasada nueva puede reemplazar a la vigente.
 * @returns {{ usar: 'nueva'|'vigente', motivo: string }}
 */
export function decidirReemplazo(vigente, nueva, { minimo = 4, fraccion = 0.5 } = {}) {
  const nV = piezasDe(vigente).length, nN = piezasDe(nueva).length;
  if (!nueva || !nN) return { usar: 'vigente', motivo: nV ? `La nueva pasada no trajo piezas; se conservan las ${nV} vigentes.` : '' };
  if (propuestaDegenerada(nueva)) return { usar: 'vigente', motivo: `La nueva pasada llegó con una respuesta mal formada (${nN} pieza(s), con otras piezas metidas en un texto); se conservan las ${nV} vigentes.` };
  if (nV >= minimo && nN < nV * fraccion) return { usar: 'vigente', motivo: `La nueva pasada trajo ${nN} de ${nV} piezas; se conservan las vigentes. Si de verdad sobran, quítalas a mano.` };
  return { usar: 'nueva', motivo: '' };
}
