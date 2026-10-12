// ============================================================================
//  VH-093 (2026-10-12) · DIAGNÓSTICO por pieza de lo que NO se colocó.
//  Antes: "4 silla de juntass · 21 piezas · se superó la capacidad del catálogo".
//  Ahora cada instancia faltante dice QUÉ es, DÓNDE iba, qué huella tiene y de
//  dónde salió, su grupo/ancla, la RAZÓN exacta (código) y qué hacer. Puro.
//
//  Códigos: DUPLICATED_REQUIREMENT · MISSING_ANCHOR · UNKNOWN_FOOTPRINT ·
//  UNRESOLVED_PRODUCT · NO_SPACE · COLLISION · CLEARANCE · BLOCKED_DOOR ·
//  INCOMPATIBLE_ZONE · DEPENDENCY_MISMATCH · SIN_DIAGNOSTICO (el servidor no dijo).
// ============================================================================
const ACCION = {
  DUPLICATED_REQUIREMENT: 'Hay dos muebles para el mismo requerimiento: conserva uno o marca "mantener ambos".',
  MISSING_ANCHOR: 'Esta silla/guarda no tiene escritorio o mesa con lugar: agrega el mueble que la recibe o quita la de más.',
  UNKNOWN_FOOTPRINT: 'La medida es supuesta (por tipo): captura ancho × fondo reales en la partida.',
  UNRESOLVED_PRODUCT: 'Sin identidad de catálogo: elige el producto real o pide su desarrollo.',
  NO_SPACE: 'No cabe en la zona asignada: cambia la zona, reduce el mueble o quita piezas de esa zona.',
  COLLISION: 'Se encima con otro mueble: muévelo o reduce la cantidad en esa zona.',
  CLEARANCE: 'No conserva el pasillo de 1.00 m: mueve o reduce piezas en esa zona.',
  BLOCKED_DOOR: 'Bloquearía una puerta: cambia la posición o la zona.',
  INCOMPATIBLE_ZONE: 'La zona no es del tipo que admite este mueble: asígnale su zona (privado, juntas, operativa, recepción).',
  DEPENDENCY_MISMATCH: 'Su mueble receptor no quedó colocado: resuelve primero el ancla.',
  SIN_DIAGNOSTICO: 'El servidor no explicó esta pieza: vuelve a acomodar; si persiste, repórtalo con el id.',
};
const DEL_SERVIDOR = {
  NO_SPACE: 'NO_SPACE', OUT_OF_BOUNDS: 'NO_SPACE', OUT_OF_POLYGON: 'NO_SPACE', OBSTACLE: 'COLLISION', OVERLAP: 'COLLISION',
  AISLE: 'CLEARANCE', NO_SPACE_PARA_SILLAS: 'CLEARANCE', DOOR: 'BLOCKED_DOOR', NO_ZONE: 'INCOMPATIBLE_ZONE',
  ZONE_MISMATCH: 'INCOMPATIBLE_ZONE', DEPENDENT_UNASSIGNED: 'MISSING_ANCHOR', ANCHOR_UNPLACED: 'DEPENDENCY_MISMATCH',
};
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const FUENTE_TXT = { SPATIAL_SPEC: 'ficha técnica', PARTIDA: 'partida', NOMBRE: 'nombre comercial', INFERIDA: 'supuesta por tipo', ESTANDAR: 'estándar' };

/**
 * @param {{piezas:Array, plan:object|null, excluidas?:Array, areas?:Array}} x
 * @returns {Array<{id,nombre,zona,tipo,cantidad,w,d,huella_fuente,grupo,ancla,codigo,motivo,accion,secundarios:string[]}>}
 */
export function diagnosticoNoColocadas({ piezas = [], plan = null, excluidas = [], areas = [] } = {}) {
  const colocadas = new Set((plan?.colocacion || []).map((c) => String(c.id)));
  const unassigned = new Set((plan?.unassigned || []).map(String));
  const porKit = new Map();                               // id pieza → invariante del kit que no cupo
  for (const u of (plan?.no_cupieron || plan?.unplaced || [])) {
    if (!u || typeof u !== 'object') continue;
    const inv = u.invariante || u.certificado?.invariante || u.reason || null;
    for (const id of (u.piezas || [])) porKit.set(String(id), { inv, anchorId: u.anchorId });
    if (u.anchorId) porKit.set(String(u.anchorId), { inv, anchorId: u.anchorId });
  }
  const porId = new Map(piezas.map((p) => [String(p.id), p]));
  const nombreArea = (p) => {
    const z = p.zone_id ?? p.zonaSugerida ?? null;
    if (z != null) return String(z);
    const i = (plan?.colocacion || []).find((c) => String(c.id) === String(p.anchor_instance_id))?.area;
    return Number.isInteger(i) && areas[i] ? (areas[i].nombre || `área ${i + 1}`) : '—';
  };
  // Requerimientos duplicados: dos ANCLAS con el mismo requirement_id/instance_id.
  const porReq = new Map();
  for (const p of piezas) if (esAncla(p.relation_role) && (p.requirement_id || p.instance_id)) {
    const k = String(p.requirement_id || p.instance_id); porReq.set(k, (porReq.get(k) || 0) + 1);
  }
  const filas = [];
  const fila = (p, codigo, extra = {}) => ({
    id: String(p.id), nombre: p.nombre || p.id, zona: nombreArea(p), tipo: p.tipo || null, cantidad: 1,
    w: p.w ?? null, d: p.d ?? null, huella_fuente: FUENTE_TXT[p.huella_fuente] || p.huella_fuente || '—',
    grupo: p.functional_group_id || null, ancla: p.anchor_instance_id || null,
    codigo, motivo: extra.motivo || null, accion: ACCION[codigo] || ACCION.SIN_DIAGNOSTICO,
    secundarios: [...(p.huella_fuente === 'INFERIDA' && codigo !== 'UNKNOWN_FOOTPRINT' ? ['UNKNOWN_FOOTPRINT'] : []), ...(extra.secundarios || [])],
  });
  for (const e of excluidas) filas.push({ id: String(e.id), nombre: e.nombre || e.id, zona: '—', tipo: null, cantidad: 1, w: null, d: null, huella_fuente: '—', grupo: null, ancla: null, codigo: e.codigo || 'UNRESOLVED_PRODUCT', motivo: e.motivo || null, accion: ACCION[e.codigo] || ACCION.UNRESOLVED_PRODUCT, secundarios: [] });
  for (const p of piezas) {
    if (colocadas.has(String(p.id))) continue;
    const req = String(p.requirement_id || p.instance_id || '');
    if (esAncla(p.relation_role) && req && porReq.get(req) > 1) { filas.push(fila(p, 'DUPLICATED_REQUIREMENT')); continue; }
    if (unassigned.has(String(p.id)) && !esAncla(p.relation_role)) { filas.push(fila(p, 'MISSING_ANCHOR')); continue; }
    const kit = porKit.get(String(p.id));
    if (kit) {
      const anclaColocada = kit.anchorId ? colocadas.has(String(kit.anchorId)) : true;
      if (!esAncla(p.relation_role) && kit.anchorId && !anclaColocada && String(kit.anchorId) !== String(p.id)) { filas.push(fila(p, 'DEPENDENCY_MISMATCH', { motivo: `su mueble (${porId.get(String(kit.anchorId))?.nombre || kit.anchorId}) no se colocó` })); continue; }
      filas.push(fila(p, DEL_SERVIDOR[kit.inv] || (kit.inv ? 'NO_SPACE' : 'SIN_DIAGNOSTICO'), { motivo: kit.inv || null })); continue;
    }
    if (!esAncla(p.relation_role) && p.anchor_instance_id && !colocadas.has(String(p.anchor_instance_id)) && porId.has(String(p.anchor_instance_id))) { filas.push(fila(p, 'DEPENDENCY_MISMATCH')); continue; }
    if (p.huella_fuente === 'INFERIDA') { filas.push(fila(p, 'UNKNOWN_FOOTPRINT')); continue; }
    filas.push(fila(p, 'SIN_DIAGNOSTICO'));
  }
  return filas;
}

/** Resumen por código para la UI ("3 sin escritorio que las reciba · 1 no cabe en SALA"). */
export function resumenDiagnostico(filas = []) {
  const m = new Map();
  for (const f of filas) m.set(f.codigo, (m.get(f.codigo) || 0) + 1);
  return [...m.entries()].map(([codigo, n]) => ({ codigo, n }));
}
