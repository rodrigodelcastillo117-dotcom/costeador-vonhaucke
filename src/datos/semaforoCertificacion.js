// ============================================================================
//  SEMÁFORO DE CERTIFICACIÓN — por línea, qué falta y QUIÉN lo da. Legible para el
//  vendedor/Dirección en la pantalla, sin tener que leer SQL. NO toca economía:
//  sólo clasifica el reporte que ya produjo costearBOM (productoMaestro.js).
//
//  Niveles (coinciden con la verdad del servidor, igual que el sello de estado):
//    verde  → precio de catálogo VIGENTE y fresco (≤24 meses). Certifica.
//    ambar  → precio de catálogo VENCIDO (>24 meses): cuesta, pero NO certifica → Compras refresca.
//    gris   → precio de estimaciones (histórico), el insumo no está de alta en catálogo → Compras lo da de alta.
//    rojo   → sin costo usable (sin precio / unidad incompatible / cantidad inválida) → Ingeniería/Compras.
//    (excluido/cliente = verde, cuesta 0 legítimo).
// ============================================================================

const NIVELES = Object.freeze({
  fresco:    { nivel: 'verde', etiqueta: 'Catálogo vigente', accion: '' },
  vencido:   { nivel: 'ambar', etiqueta: 'Precio de catálogo vencido (>24 meses)', accion: 'Compras: refrescar el precio en Intelisis' },
  historico: { nivel: 'gris',  etiqueta: 'Precio de estimaciones (sin alta en catálogo)', accion: 'Compras: dar de alta el insumo en catálogo' },
  excluido:  { nivel: 'verde', etiqueta: 'Excluido / lo suministra el cliente', accion: '' },
  bloquea:   { nivel: 'rojo',  etiqueta: 'Sin costo usable', accion: 'Ingeniería/Compras: falta identidad o precio' },
});

/** Clasifica UNA línea del reporte de costearBOM. No muta. */
export function semaforoLinea(l = {}) {
  if (l.bloquea) return { ...NIVELES.bloquea, motivo: l.estado || 'bloquea' };
  if (l.fuente === 'cero') return { ...NIVELES.excluido };
  if (l.fuente === 'confirmado') return { ...NIVELES.historico };
  if (l.fuente === 'catalogo') return { ...(l.fresco === false ? NIVELES.vencido : NIVELES.fresco) };
  return { ...NIVELES.bloquea, motivo: l.estado || 'sin_precio' };  // defensivo
}

/**
 * Semáforo completo de un costeo: una fila por línea + el resumen por nivel + las acciones
 * agrupadas (qué falta, por quién). @returns {{filas, resumen, acciones, certificable, emitible}}
 */
export function semaforoCertificacion(costo = {}) {
  const lineas = Array.isArray(costo.lineas) ? costo.lineas : [];
  const filas = lineas.map((l) => {
    const s = semaforoLinea(l);
    return { desc: l.desc, cantidad: l.cantidad, precio: l.precio, costo: l.costo, ...s };
  });
  const resumen = { verde: 0, ambar: 0, gris: 0, rojo: 0 };
  for (const f of filas) resumen[f.nivel] = (resumen[f.nivel] || 0) + 1;
  // Acciones únicas, en orden de severidad (rojo → gris → ambar), para una lista accionable corta.
  const orden = { rojo: 0, gris: 1, ambar: 2, verde: 3 };
  const acciones = [...new Map(
    filas.filter((f) => f.accion)
      .sort((a, b) => orden[a.nivel] - orden[b.nivel])
      .map((f) => [f.accion, { accion: f.accion, nivel: f.nivel }])
  ).values()];
  return {
    filas,
    resumen,
    acciones,
    certificable: !!costo.certificable,
    emitible: !!costo.emitible,
  };
}
