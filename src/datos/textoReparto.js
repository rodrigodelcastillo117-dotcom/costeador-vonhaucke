// ============================================================================
//  Prueba de Rodrigo 19-oct: texto de la tarjeta SPLIT_REQUIRED (un renglón que el plano reparte entre varios
//  muebles del mismo tipo). Vive aquí para poder probarlo sin montar la pantalla.
// ============================================================================
const QUE_DEP = { WORK_SEAT: 'silla(s)', MEETING_SEAT: 'silla(s) de juntas', EXECUTIVE_SEAT: 'silla(s) directiva(s)', VISITOR_SEAT: 'silla(s) de visita', UNDERDESK_STORAGE: 'gaveta(s)', SUPPORT_STORAGE: 'guarda(s)' };
const QUE_ANCLA = { ANCHOR_WORKSTATION: 'estaciones operativas', ANCHOR_MEETING: 'mesas de juntas', ANCHOR_DESK: 'escritorios privados', ANCHOR_RECEPTION: 'recepciones' };
const UNA_ANCLA = { ANCHOR_WORKSTATION: 'la estación operativa', ANCHOR_MEETING: 'la mesa de juntas', ANCHOR_DESK: 'el escritorio privado', ANCHOR_RECEPTION: 'la recepción' };
export function textoReparto(grupo) {
  const c0 = grupo[0] || {};
  const pide = grupo.map((c) => Number(c.requerido) || 0);
  const total = pide.reduce((s, n) => s + n, 0);
  const que = c0.fila_nombre || QUE_DEP[c0.relation_role] || 'piezas';
  const mezclados = new Set(grupo.map((c) => c.anchor_role || '')).size > 1;
  const donde = (!mezclados && QUE_ANCLA[c0.anchor_role]) || 'muebles';
  const fila = Number(c0.fila_cantidad) || 0;
  // Lab de recorridos 19-oct: UN solo mueble pide parte del renglón (1 de 13 para la recepción). No es "repartir entre
  // 1 recepciones (1 = 1)": es usar esa parte ahí; el resto queda para los demás lugares.
  if (grupo.length === 1 && fila > total) {
    const uno = UNA_ANCLA[c0.anchor_role] || 'ese mueble';
    return {
      titulo: `Tienes ${fila} × ${que} en un solo renglón y el plano necesita ${total} para ${uno}.`,
      ayuda: `Al confirmarlo, ${total} de ese renglón van a ${uno} y las otras ${fila - total} quedan para los demás lugares: no se agregan ni se duplican piezas y el precio no cambia.`,
      boton: `Usar ${total} para ${uno}`,
    };
  }
  return {
    titulo: `Tienes ${c0.fila_cantidad} × ${que} en un solo renglón y el plano las reparte entre ${grupo.length} ${donde} (${pide.join(' + ')} = ${total}).`,
    ayuda: Number(c0.fila_cantidad) >= total
      ? 'Al repartir, el mismo renglón cubre todos esos lugares: no se agregan ni se duplican piezas y el precio no cambia.'
      : `Al repartir, el renglón cubre ${c0.fila_cantidad} lugares; los que falten se agregan como renglón nuevo.`,
    boton: `Repartir entre las ${grupo.length} ${donde}`,
  };
}
