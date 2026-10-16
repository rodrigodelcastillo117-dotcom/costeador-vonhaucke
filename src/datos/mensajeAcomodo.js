// ============================================================================
//  P0.2b · G (cliente) · formatea el `mensaje_vendedor` del edge recovery para la
//  pantalla de acomodo: en español simple, QUÉ no cupó, POR QUÉ (causal) y QUÉ
//  hacer (2–3 opciones). Puro y defensivo: si el edge no manda el mensaje (p. ej.
//  el edge viejo desplegado), devuelve null y la UI no cambia.
// ============================================================================
export function formatearMensajeVendedor(mv) {
  if (!mv || mv.hay_pendientes !== true) return null;
  const pendientes = Array.isArray(mv.pendientes) ? mv.pendientes : [];
  const motivos = Array.isArray(mv.motivos) ? mv.motivos : [];
  const opciones = Array.isArray(mv.opciones) ? mv.opciones : [];
  if (!pendientes.length) return null;

  // El bullet lo pone el <li> de la UI; NO anteponer "• " aquí (evita "• • …").
  const queNoCupo = pendientes.map((p) => p.texto);
  // 027b/§7: zona destino + veredicto (demostrado / no encontrado / faltan datos) junto a la causa.
  const porque = motivos.map((m) => {
    if (!m.texto) return null;
    const zona = m.zona && !String(m.texto).includes(String(m.zona)) ? `[${m.zona}] ` : '';
    const ver = m.evidencia?.veredicto_texto ? ` ${m.evidencia.veredicto_texto}` : '';
    return `${zona}${m.texto}${ver}`;
  }).filter(Boolean);
  const queHacer = opciones.map((o) => o.texto).filter(Boolean).slice(0, 3);
  const sinOpcion = (!queHacer.length && mv.sin_opcion) ? mv.sin_opcion : null;

  return {
    titulo: 'No cupo todo. Esto es lo que pasó y qué puedes hacer:',
    queNoCupo,                       // lista "• 2 sillas operativas"
    porque,                          // motivos causales
    queHacer,                        // hasta 3 opciones concretas (texto verificado)
    sinOpcion,                       // mensaje claro si no hay ninguna opción verificable
    resumen: `Quedaron pendientes: ${pendientes.map((p) => p.texto).join(', ')}.`,
  };
}
