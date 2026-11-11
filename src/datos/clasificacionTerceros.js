// ============================================================================
//  F1 · CATALOGO DE CLASIFICACION DE TERCEROS (auditoria 01c456c).
//
//  CRITERIO (razonado por como fabrica Von Haucke, validado vs BOM certificado):
//   · COMPRA-VENTA (x1.06) = componente TERMINADO que VH no puede/ no suele fabricar:
//       - vidrio/cristal TEMPLADO (requiere horno de templado que no tienen),
//       - vidrio/espejo cortado a medida (proveedor de vidrio),
//       - herrajes de movimiento/cierre (correderas, bisagras, cerraduras, niveladores...),
//       - iluminacion y electrico terminado (LED, kit, driver, multicontacto...),
//       - señalizacion terminada (logotipo, placa de identificacion).
//   · FABRICADO (x1.80) = MATERIA PRIMA que VH procesa en casa (corta/dobla/arma/pinta):
//       - acrilico/policarbonato en HOJA/lamina/placa (compran la hoja y la cortan),
//       - lamina, PTR, MDF, etc. (estos no los marca TERCERO_RE; caen a fabricado solos).
//   · AMBIGUO -> sin regla -> el productor BLOQUEA (fail-closed): galvanizado, corte laser,
//       termoformado (proceso que puede ser propio o servicio; Ingenieria/Compras decide).
//
//  VALIDADO contra el BOM certificado ENTCBCALP (hoja C-CO-517R): acrilico en hoja ->
//  fabricado; LOGOTIPO en acrilico -> compra-venta; coincide con este catalogo. El orden
//  importa: logotipo (terminado) antes que acrilico (materia prima); acrilico antes que
//  cristal (para que "ACRILICO CRISTAL" = acrilico, no vidrio).
//
//  Es un BORRADOR razonado que Compras CONFIRMA/ajusta (fuente: catalogo_vh_draft). Solo
//  afecta despieces NUEVOS; no toca precios ni BOMs certificados almacenados. Reversible.
// ============================================================================

export const REGLAS_TERCERO = Object.freeze([
  // 1) Señalizacion TERMINADA (va antes que acrilico: el logo es el producto, no la hoja).
  { re: /logotipo|\blogo\b|placa\s*(de\s*)?identificac|se[ñn]al[eé]tic/i, clasificacion: 'compra_venta', nota: 'señalizacion terminada: se compra' },
  // 2) Acrilico / policarbonato (materia prima en hoja): se corta/arma en casa.
  { re: /acril|policarbon/i, clasificacion: 'fabricado', nota: 'acrilico/policarbonato en hoja: se procesa en casa (hoja C-CO-517R)' },
  // 3) Vidrio / cristal / templado / espejo (no acrilico): proveedor de vidrio, no se fabrica.
  { re: /cristal|vidrio|templad|espejo/i, clasificacion: 'compra_venta', nota: 'vidrio/cristal/espejo: proveedor de vidrio (VH no templa ni corta vidrio)' },
  // galvanizado / corte laser / termoformado: AMBIGUO -> sin regla -> bloquea.
]);

/**
 * Clasifica un insumo que parece tercero. Devuelve {clasificacion, fuente, nota} o null.
 * null = ambiguo/sin regla: el llamador BLOQUEA (fail-closed), nunca asume.
 */
export function clasificarTercero(nombre = '', seccion = '') {
  const t = `${String(nombre || '')} ${String(seccion || '')}`;
  for (const r of REGLAS_TERCERO) {
    if (r.re.test(t)) return { clasificacion: r.clasificacion, fuente: 'catalogo_vh_draft', nota: r.nota };
  }
  return null;
}
