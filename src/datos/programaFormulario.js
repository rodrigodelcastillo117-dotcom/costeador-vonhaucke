// ============================================================================
//  CASCADA DEL FORMULARIO "Dime qué lleva" (OPERACIÓN RESCATE, E2E Dibujo/m² 2026-10-10)
//  Evidencia real: la persona corrigió Operativos 10→8 (ó 14→8) con "−" y el texto
//  enviado a Voni decía "8 lugares de trabajo repartidos en 1 bancas de 10 usuarios…
//  10 gavetas": `porIsla` y `gavetas` se sembraron del plano y NO seguían a
//  `operativos` → programa incoherente (COT-P0-013/020/031).
//  Regla: los puestos mandan. Al cambiar operativos, el reparto por banca y las
//  gavetas (1 por puesto) se recalculan — salvo que la persona haya tocado gavetas
//  a mano (entonces se respeta su número).
// ============================================================================
export function conOperativos(p = {}, n) {
  const operativos = Math.max(0, Math.round(Number(n) || 0));
  const islas = Math.max(0, Math.round(Number(p.islas) || 0));
  const porIsla = islas > 0 ? (islas === 1 ? operativos : Math.ceil(operativos / islas)) : 0;
  const gavetas = p.gavetasManual ? p.gavetas : operativos;
  return { ...p, operativos, porIsla, gavetas };
}

/** La frase sólo puede decir N puestos si el reparto y las gavetas hablan de los mismos N. */
export function programaCoherente(p = {}) {
  const n = Number(p.operativos) || 0;
  const islas = Number(p.islas) || 0;
  const reparto = islas > 0 ? islas * (Number(p.porIsla) || 0) : n;
  return reparto >= n && (p.gavetasManual || Number(p.gavetas) === n);
}
