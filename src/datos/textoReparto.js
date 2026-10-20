// ============================================================================
//  Prueba de Rodrigo 19-oct: texto de la tarjeta SPLIT_REQUIRED (un renglón que el plano reparte entre varios
//  muebles del mismo tipo). Vive aquí para poder probarlo sin montar la pantalla.
// ============================================================================
const QUE_DEP = { WORK_SEAT: 'silla(s)', MEETING_SEAT: 'silla(s) de juntas', EXECUTIVE_SEAT: 'silla(s) directiva(s)', VISITOR_SEAT: 'silla(s) de visita', UNDERDESK_STORAGE: 'gaveta(s)', SUPPORT_STORAGE: 'guarda(s)' };
const QUE_ANCLA = { ANCHOR_WORKSTATION: 'estaciones operativas', ANCHOR_MEETING: 'mesas de juntas', ANCHOR_DESK: 'escritorios privados', ANCHOR_RECEPTION: 'recepciones' };
export function textoReparto(grupo) {
  const c0 = grupo[0] || {};
  const pide = grupo.map((c) => Number(c.requerido) || 0);
  const total = pide.reduce((s, n) => s + n, 0);
  const que = c0.fila_nombre || QUE_DEP[c0.relation_role] || 'piezas';
  const donde = QUE_ANCLA[c0.anchor_role] || 'muebles';
  return {
    titulo: `Tienes ${c0.fila_cantidad} × ${que} en un solo renglón y el plano las reparte entre ${grupo.length} ${donde} (${pide.join(' + ')} = ${total}).`,
    ayuda: Number(c0.fila_cantidad) >= total
      ? 'Al repartir, el mismo renglón cubre todos esos lugares: no se agregan ni se duplican piezas y el precio no cambia.'
      : `Al repartir, el renglón cubre ${c0.fila_cantidad} lugares; los que falten se agregan como renglón nuevo.`,
    boton: `Repartir entre las ${grupo.length} ${donde}`,
  };
}
