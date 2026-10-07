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

  const queNoCupo = pendientes.map((p) => `• ${p.texto}`);
  const porque = motivos.map((m) => m.texto).filter(Boolean);
  const queHacer = opciones.map((o) => o.texto).filter(Boolean).slice(0, 3);

  return {
    titulo: 'No cupo todo. Esto es lo que pasó y qué puedes hacer:',
    queNoCupo,                       // lista "• 2 sillas operativas"
    porque,                          // motivos causales
    queHacer,                        // 2–3 opciones concretas
    resumen: `Quedaron pendientes: ${pendientes.map((p) => p.texto).join(', ')}.`,
  };
}
