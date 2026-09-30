// ============================================================================
//  POLÍTICA DE COSTEO REAL DE VONHAUCKE (T.D.C. "standard_line")
//
//  Derivada y VERIFICADA AL CENTAVO contra la T.D.C. llena que mandó Alba el
//  2026-09-30 (C-CO-516R Copete abatible ... ejercicio.xlsx). Ver la deducción
//  completa en INTAKE-Y-POLITICA-VH.md §3.
//
//  Así costea Vonhaucke de verdad (no el 34% plano que usaba la app):
//    Material   = Σ(consumo × costo última compra)         ← el despiece
//    Mano obra  = Material × factor_MO   (0.20 mueble fabricado)
//    Indirecto  = Mano de obra × factor_IND   (×3 lo fabricado)
//    Costo fab  = Material + MO + Indirecto
//  Cada renglón se redondea a centavos, igual que la T.D.C. de Alba (por eso el
//  indirecto se calcula sobre la MO YA redondeada: así da 276.33, no 276.34).
//
//  Comprobación exacta (copete id_01): material 460.57 → MO 92.11 → indirecto
//  276.33 → costo fabricación 829.01. Cuadra al centavo con Alba.
// ============================================================================

// factor MO = sobre material · factor IND = sobre la mano de obra.
// vol = factor de precio mínimo según volumen (alto/intermedio/bajo).
export const FACTORES_VH = {
  mueble_fabricado:        { mo: 0.20, ind: 3,    vol: { alto: 1.55, intermedio: 1.95, bajo: 2.35 } },
  componente_fabricado:    { mo: 0.15, ind: 3,    vol: { alto: 1.55, intermedio: 1.95, bajo: 2.35 } },
  mueble_compra_venta:     { mo: 0.01, ind: 0.05, vol: { alto: 1.40, intermedio: 1.80, bajo: 2.20 } },
  componente_compra_venta: { mo: 0.05, ind: 0.05, vol: { alto: 1.40, intermedio: 1.80, bajo: 2.20 } },
  accesorio_compra_venta:  { mo: 0.01, ind: 0.05, vol: { alto: 1.40, intermedio: 1.45, bajo: 1.50 } },
  servicio_directo:        { mo: 0.10, ind: 3,    vol: { alto: 1.20, intermedio: 1.20, bajo: 1.20 } },
};

// Divisores de nivel de precio sobre el precio mínimo (verificados: 1290 → 1850
// → 3080). No son otro costeo: son niveles de utilidad del mismo costo.
export const DIV_PRECIO_LISTA = 0.7;
export const DIV_PRECIO_2 = 0.42;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100; // a centavos

/**
 * Costo de fabricación al modo Vonhaucke, desde el material del despiece.
 * @param material total de materia prima (Σ consumo × costo última compra)
 * @param tipo una clave de FACTORES_VH (default mueble_fabricado)
 */
export function costoFabVH(material, tipo = 'mueble_fabricado') {
  const f = FACTORES_VH[tipo] || FACTORES_VH.mueble_fabricado;
  const mat = r2(Math.max(0, Number(material) || 0));
  const mo = r2(mat * f.mo);
  const indirecto = r2(mo * f.ind);          // sobre la MO ya redondeada
  const costoFab = r2(mat + mo + indirecto);
  return { material: mat, mo, indirecto, costoFab, tipo };
}

/**
 * Los tres niveles de precio sobre un costo de fabricación.
 * precio_mínimo = costo × factor_volumen; lista = mín/0.7; precio_2 = mín/0.42.
 */
export function preciosVH(costoFab, { tipo = 'mueble_fabricado', volumen = 'alto' } = {}) {
  const f = FACTORES_VH[tipo] || FACTORES_VH.mueble_fabricado;
  const factorVol = f.vol[volumen] ?? f.vol.alto;
  const precioMin = r2(costoFab * factorVol);
  return {
    precioMin,
    precioLista: r2(precioMin / DIV_PRECIO_LISTA),
    precio2: r2(precioMin / DIV_PRECIO_2),
    factorVol, volumen, tipo,
  };
}
