// ============================================================================
//  N5 / WOW — RECONCILIACIÓN DE ALCANCE (pura).
//  Por zona compara REQUERIDO (lo que pide el plano/brief) vs COTIZADO (lo que
//  está en la cotización) vs ACOMODADO (lo que el layout colocó). Marca estado
//  y la falta exacta. Sin inventar cantidades: lo que no se sabe queda null.
// ============================================================================
const n = (x) => (x == null ? null : (Number.isFinite(Number(x)) ? Number(x) : null));

/** Reconciliar una lista de zonas → cada una con estado y faltante. */
export function reconciliar(zonas) {
  return (zonas || []).map((z) => {
    const req = n(z.requerido), cot = n(z.cotizado), aco = n(z.acomodado);
    let estado = 'ok';
    if (req == null) estado = 'revisar';                       // no se sabe el requerido
    else if ((cot != null && cot < req) || (aco != null && aco < req)) estado = 'falta';
    else if ((cot != null && cot > req) || (aco != null && aco > req)) estado = 'sobra';
    const faltaCotizar = (req != null && cot != null) ? Math.max(0, req - cot) : null;
    const faltaAcomodar = (req != null && aco != null) ? Math.max(0, req - aco) : null;
    return { nombre: z.nombre, requerido: req, cotizado: cot, acomodado: aco, estado, faltaCotizar, faltaAcomodar };
  });
}

/** Resumen global de la reconciliación. */
export function resumenReconciliacion(zonas) {
  const r = reconciliar(zonas);
  return {
    zonas: r,
    totalZonas: r.length,
    ok: r.filter((z) => z.estado === 'ok').length,
    conFalta: r.filter((z) => z.estado === 'falta').length,
    conSobra: r.filter((z) => z.estado === 'sobra').length,
    porRevisar: r.filter((z) => z.estado === 'revisar').length,
    hayDiscrepancia: r.some((z) => z.estado !== 'ok'),
  };
}
