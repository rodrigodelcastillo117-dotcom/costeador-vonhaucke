// ============================================================================
//  confirmarPrograma · PROPUESTA → PARTIDAS CONFIRMADAS (P0.1 · #3/#4/#15).
//
//  resolverPrograma devuelve una PROPUESTA; confirmar es un acto EXPLÍCITO del
//  usuario ("Aplicar programa detectado"). Reconciliación en DOS caminos:
//
//   · ANCLAS (relation_role ANCHOR_*): por POSICIÓN (rol|relation_role|#ordinal).
//     Mismo producto en la posición → reutiliza. Otro producto → CONFLICTO
//     (#4); se conserva lo existente, no se sustituye en silencio.
//   · DEPENDIENTES (WORK_SEAT/…): por PRODUCTO+ROL (relation_role|bancoId),
//     con CANTIDAD (#15). Si la cotización ya tiene el equivalente (p.ej. 10 WIN,
//     10 gavetas), se REUTILIZA y sólo se agrega el faltante; nunca se duplican
//     sillas/guardas. Reconoce partidas legacy del schema real (infiere el rol
//     por relation_role o, si falta, por el nombre).
//
//  IDEMPOTENTE (#3): aplicar el mismo programa 2+ veces no duplica.
//  Compuertas separadas (#12): el resumen distingue producto de precio.
// ============================================================================
const norm = (s = '') => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esAncla = (rel) => typeof rel === 'string' && rel.startsWith('ANCHOR_');
const bancoDe = (it) => it.bancoId || it.piezaId || null;

function rolFromRel(rel) {
  switch (rel) {
    case 'ANCHOR_WORKSTATION': case 'WORK_SEAT': case 'UNDERDESK_STORAGE': return 'operativo';
    case 'ANCHOR_DESK': case 'EXECUTIVE_SEAT': case 'VISITOR_SEAT': return 'privado';
    case 'ANCHOR_MEETING': case 'MEETING_SEAT': return 'juntas';
    case 'ANCHOR_RECEPTION': return 'recepcion';
    default: return null;
  }
}

// Rol funcional de un item existente: explícito, o inferido del nombre (legacy).
function inferRole(item) {
  if (item.relation_role) return item.relation_role;
  const t = norm(`${item.nombre || ''} ${item.nota || ''}`);
  const silla = /silla|asiento/.test(t);
  if (silla && /operativ|puesto|banca|bench|open/.test(t)) return 'WORK_SEAT';
  if (silla && /directiv|ejecutiv/.test(t)) return 'EXECUTIVE_SEAT';
  if (silla && /visita|confidente/.test(t)) return 'VISITOR_SEAT';
  if (silla && /junta|consejo|meeting|board/.test(t)) return 'MEETING_SEAT';
  if (/gaveta|pedestal|cajonera/.test(t)) return 'UNDERDESK_STORAGE';
  if (/mesa|table/.test(t) && /junta|consejo|meeting|board/.test(t)) return 'ANCHOR_MEETING';
  if (/escritorio|bench|banca|estacion|workstation/.test(t) && !silla) {
    return /privad|direccion|directiv|gerenc/.test(t) ? 'ANCHOR_DESK' : 'ANCHOR_WORKSTATION';
  }
  return null;
}

function rolDe(item) { return item.rol || rolFromRel(item.relation_role || inferRole(item)) || 'desconocido'; }

function aItemConfirmado(part, { slot = null, estado }) {
  const ident = part.identidad || null;
  const snapshot = Number(part.precio_lista_snapshot ?? part.precio) || null;
  const rel = part.relation_role ?? inferRole(part) ?? null;
  return {
    id: slot ? `${slot}::${part.bancoId ?? bancoDe(part)}` : `${rolDe(part)}|${rel}|${bancoDe(part)}`,
    slot,
    estado,                                      // 'CONFIRMADO' | 'EXISTENTE'
    rol: part.rol ?? rolDe(part),
    relation_role: rel,
    anchor_role: part.anchor_role ?? null,
    anchor_instance_id: part.anchor_instance_id ?? null,
    instance_id: part.instance_id ?? null,
    functional_group_id: part.functional_group_id ?? null,
    inclusion: part.inclusion ?? null,
    zone_id: part.zone_id ?? null,
    evidence: part.evidence ?? null,
    bancoId: bancoDe(part),
    source_ref: part.source_ref ?? bancoDe(part),
    nombre: part.nombre ?? null,
    linea: part.linea ?? null,
    usuarios: part.usuarios ?? null,
    w: part.w ?? null,
    d: part.d ?? null,
    cantidad: Number(part.cantidad) || 1,
    product_status: part.product_status ?? 'RESOLVED',
    identity_status: part.identity_status ?? (ident ? 'RESOLVED' : (part.productoId ? 'RESOLVED' : 'MISSING')),
    productoId: ident ? ident.producto_id : (part.productoId ?? null),
    producto_version_id: ident ? ident.producto_version_id : (part.producto_version_id ?? null),
    lista_precio_item_id: ident ? ident.lista_precio_item_id : (part.lista_precio_item_id ?? null),
    precio_lista_snapshot: snapshot,
    price_status: part.price_status ?? (snapshot ? 'SNAPSHOT_DISPLAY' : 'SIN_PRECIO'),
    autoridad: 'SERVIDOR',
    source: 'CONFIRMADO_PROGRAMA',
  };
}

/**
 * Confirma una propuesta de resolverPrograma contra lo ya existente.
 * @param {object} propuesta  resultado de resolverPrograma (usa `.partidas`).
 * @param {object} opts.existentes  partidas ya en la cotización (schema real o de este flujo).
 */
export function confirmarPrograma(propuesta, { existentes = [] } = {}) {
  const partidas = (propuesta && Array.isArray(propuesta.partidas)) ? propuesta.partidas : [];
  const anchorsProp = partidas.filter((p) => esAncla(p.relation_role));
  const depsProp = partidas.filter((p) => !esAncla(p.relation_role));

  const confirmadas = [];
  const sinCambio = [];
  const conflictos = [];
  const usados = new Set();                       // índices de existentes consumidos

  const ex = existentes.map((e, i) => ({
    _i: i, raw: e, rol: rolDe(e), rel: e.relation_role || inferRole(e),
    banco: bancoDe(e), cantidad: Math.max(1, Number(e.cantidad) || 1),
  }));

  // --- ANCLAS por POSICIÓN (rol|relation_role|#ordinal) ---
  const anchorSlot = (rol, rel, ord) => `${rol}|${rel}|#${ord}`;
  const existAnchors = ex.filter((e) => esAncla(e.rel));
  const anchorOrd = new Map();
  const anchorBySlot = new Map();
  for (const e of existAnchors) {
    const base = `${e.rol}|${e.rel}`;
    const ord = anchorOrd.get(base) || 0; anchorOrd.set(base, ord + 1);
    anchorBySlot.set(anchorSlot(e.rol, e.rel, ord), e);
  }
  const propAnchorOrd = new Map();
  for (const a of anchorsProp) {
    const rol = a.rol || rolFromRel(a.relation_role);
    const base = `${rol}|${a.relation_role}`;
    const ord = propAnchorOrd.get(base) || 0; propAnchorOrd.set(base, ord + 1);
    const slot = anchorSlot(rol, a.relation_role, ord);
    const prev = anchorBySlot.get(slot);
    if (prev) {
      if (String(prev.banco) === String(a.bancoId)) {
        usados.add(prev._i);                      // reutiliza: lo re-emitimos como EXISTENTE
        sinCambio.push(aItemConfirmado(a, { slot, estado: 'EXISTENTE' }));
      } else {
        // CONFLICTO: se CONSERVA lo existente (queda en intactos), NO se sustituye.
        conflictos.push({ slot, existente: { bancoId: prev.banco, nombre: prev.raw.nombre ?? null }, propuesto: { bancoId: a.bancoId, nombre: a.nombre ?? null }, code: 'SLOT_OCUPADO_PRODUCTO_DISTINTO' });
      }
    } else {
      confirmadas.push(aItemConfirmado(a, { slot, estado: 'CONFIRMADO' }));
    }
  }

  // --- DEPENDIENTES por PRODUCTO+ROL con CANTIDAD (#15) ---
  const poolDep = new Map();                      // `${rel}|${banco}` -> {total, idxs:[]}
  for (const e of ex) {
    if (e.rel && !esAncla(e.rel)) {
      const k = `${e.rel}|${e.banco}`;
      const o = poolDep.get(k) || { total: 0, idxs: [] };
      o.total += e.cantidad; o.idxs.push(e._i); poolDep.set(k, o);
    }
  }
  for (const dep of depsProp) {
    const slot = `${dep.rol || rolFromRel(dep.relation_role)}|${dep.relation_role}|${dep.anchor_instance_id || ''}`;
    const k = `${dep.relation_role}|${dep.bancoId}`;
    const pool = poolDep.get(k);
    const need = Math.max(1, Number(dep.cantidad) || 1);
    if (pool && !pool.done && pool.total > 0) {
      pool.done = true;
      pool.idxs.forEach((i) => usados.add(i));
      // reutiliza lo existente equivalente (se conserva tal cual)
      pool.idxs.forEach((i) => sinCambio.push(aItemConfirmado(ex[i].raw, { slot: null, estado: 'EXISTENTE' })));
      if (need > pool.total) confirmadas.push(aItemConfirmado({ ...dep, cantidad: need - pool.total }, { slot, estado: 'CONFIRMADO' }));
    } else {
      confirmadas.push(aItemConfirmado(dep, { slot, estado: 'CONFIRMADO' }));
    }
  }

  // existentes que el programa no tocó: intactos
  const intactos = ex.filter((e) => !usados.has(e._i)).map((e) => ({ ...e.raw }));
  const items = [...intactos, ...sinCambio, ...confirmadas];
  const propias = [...confirmadas, ...sinCambio];

  return {
    items,
    confirmadas,
    sinCambio,
    conflictos,
    resumen: {
      total: items.length,
      nuevas: confirmadas.length,
      reutilizadas: sinCambio.length,
      conflictos: conflictos.length,
      productosReales: propias.every((it) => it.bancoId && !String(it.bancoId).startsWith('sug-') && it.product_status === 'RESOLVED'),
      identidadesValidas: propias.every((it) => it.identity_status === 'RESOLVED'),
      preciosDisponibles: propias.every((it) => it.price_status !== 'SIN_PRECIO'),
    },
  };
}
