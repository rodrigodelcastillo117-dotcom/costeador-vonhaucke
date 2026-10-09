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
import { BANCO } from './banco.js';

const norm = (s = '') => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esAncla = (rel) => typeof rel === 'string' && rel.startsWith('ANCHOR_');
const bancoDe = (it) => it.bancoId || it.piezaId || null;

// Rol por IDENTIDAD de catálogo (#3): si conocemos el id del banco, el rol sale de
// su metadata (tipo/nombre), no del texto comercial.
function rolPorId(id) {
  const p = BANCO.find((b) => b.id === id);
  if (!p) return null;
  const tipo = norm(p.tipo); const t = norm(`${p.nombre || ''} ${id}`);
  if (tipo === 'silla' || /silla|asiento/.test(t)) {
    if (/directiv|alpha|ejecutiv/.test(t)) return 'EXECUTIVE_SEAT';
    if (/junta|consejo|sonata/.test(t)) return 'MEETING_SEAT';
    if (/visit|concerto/.test(t)) return 'VISITOR_SEAT';
    return 'WORK_SEAT';
  }
  // Gaveta/pedestal rodante = UNDERDESK (aunque su nombre diga "archivero/papelero");
  // archivero/credenza de piso (tipo almacen) = SUPPORT. El orden importa.
  if (/gaveta|pedestal|cajoner/.test(t)) return 'UNDERDESK_STORAGE';
  if (tipo === 'almacen' || /archiv|credenza/.test(t)) return 'SUPPORT_STORAGE';
  if (tipo === 'guarda') return 'UNDERDESK_STORAGE';
  if (/^(op-\d+u-|esc-|ger-|dir-)/.test(String(id))) return /^dir-/.test(String(id)) ? 'ANCHOR_DESK' : 'ANCHOR_WORKSTATION';
  if (/^mj-/.test(String(id))) return 'ANCHOR_MEETING';
  if (/^rec-/.test(String(id))) return 'ANCHOR_RECEPTION';
  return null;
}

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
  const porId = rolPorId(bancoDe(item));          // #3: identidad de catálogo primero
  if (porId) return porId;
  const t = norm(`${item.nombre || ''} ${item.nota || ''}`);
  const silla = /silla|asiento/.test(t);
  if (silla && /operativ|puesto|banca|bench|open/.test(t)) return 'WORK_SEAT';
  if (silla && /directiv|ejecutiv/.test(t)) return 'EXECUTIVE_SEAT';
  if (silla && /visita|confidente/.test(t)) return 'VISITOR_SEAT';
  if (silla && /junta|consejo|meeting|board/.test(t)) return 'MEETING_SEAT';
  if (/gaveta|pedestal|cajonera/.test(t)) return 'UNDERDESK_STORAGE';
  if (/mesa|table/.test(t) && /junta|consejo|meeting|board/.test(t)) return 'ANCHOR_MEETING';
  if (/recepci|mostrador|lobby/.test(t) && !silla) return 'ANCHOR_RECEPTION';
  if (/escritorio|bench|banca|estacion|workstation/.test(t) && !silla) {
    return /privad|direccion|directiv|gerenc/.test(t) ? 'ANCHOR_DESK' : 'ANCHOR_WORKSTATION';
  }
  return null;
}

function rolDe(item) { return item.rol || rolFromRel(item.relation_role || inferRole(item)) || 'desconocido'; }

// Parche de METADATA ESTRUCTURAL (sin tocar precio/costo/descripción/revisiones).
// Al reutilizar un existente, se le injerta su relación con el ancla confirmada.
function estructuraDe(part) {
  return {
    relation_role: part.relation_role ?? null,
    anchor_role: part.anchor_role ?? null,
    anchor_instance_id: part.anchor_instance_id ?? null,
    instance_id: part.instance_id ?? null,
    functional_group_id: part.functional_group_id ?? null,
    requirement_id: part.requirement_id ?? null,
    zone_id: part.zone_id ?? null,
    // R13-5: la PROVENANCE del plano también se PARCHEA a los existentes reutilizados
    // (una partida vieja reconciliada con B-01 recupera su plan_source_ref/posición).
    ...(part.plan_source_ref != null ? { plan_source_ref: part.plan_source_ref } : {}),
    ...(part.product_source_ref != null ? { product_source_ref: part.product_source_ref } : {}),
    ...(part.plan_tag != null ? { plan_tag: part.plan_tag } : {}),
    ...(part.grouping != null ? { grouping: part.grouping } : {}),
    ...(part.evidence != null ? { evidence: part.evidence } : {}),
    ...(part.observed_position != null ? { observed_position: part.observed_position } : {}),
    ...(part.observed_orientation != null ? { observed_orientation: part.observed_orientation } : {}),
    // P0.2c GAP16: la topología confirmada (CATALOG/USER_CONFIRMED) sobrevive el
    // patch estructural de reutilización/idempotencia; NUNCA se pisa con UNKNOWN.
    ...(part.placement_profile ? { placement_profile: part.placement_profile } : {}),
    ...(Number(part.user_capacity ?? part.usuarios) > 0 ? { user_capacity: Number(part.user_capacity ?? part.usuarios) } : {}),
  };
}

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
    requirement_id: part.requirement_id ?? null,
    zone_id: part.zone_id ?? null,
    evidence: part.evidence ?? null,
    bancoId: bancoDe(part),
    source_ref: part.source_ref ?? bancoDe(part),
    // R12-5: DOS identidades separadas que SOBREVIVEN la confirmación —
    // plan_source_ref (B-01, del plano) ≠ product_source_ref (op-2u…, del catálogo).
    plan_source_ref: part.plan_source_ref ?? null,
    product_source_ref: part.product_source_ref ?? bancoDe(part),
    plan_tag: part.plan_tag ?? null,
    grouping: part.grouping ?? null,
    ...(part.observed_position != null ? { observed_position: part.observed_position } : {}),
    ...(part.observed_orientation != null ? { observed_orientation: part.observed_orientation } : {}),
    nombre: part.nombre ?? null,
    linea: part.linea ?? null,
    usuarios: part.usuarios ?? null,
    // P1-R15-H: la confirmación EXPLÍCITA de modelo de sillería (confirmado_modelo)
    // SOBREVIVE la reconciliación. Sin ella, una silla con modelo distinto al sugerido
    // reaparecería como pendiente (silleriaPendiente la ignora salvo confirmado_modelo).
    // Sólo se propaga cuando es true (acto explícito del usuario).
    ...(part.confirmado_modelo === true ? { confirmado_modelo: true } : {}),
    // P0.2c GAP16: topología + capacidad confirmadas SOBREVIVEN hasta Acomodo.
    ...(part.placement_profile ? { placement_profile: part.placement_profile } : {}),
    ...(Number(part.user_capacity ?? part.usuarios) > 0 ? { user_capacity: Number(part.user_capacity ?? part.usuarios) } : {}),
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
  const enriquecidos = [];                         // {id, patch} para existentes reutilizados (#4)
  const usados = new Set();                       // índices de existentes consumidos

  const ex = existentes.map((e, i) => ({
    _i: i, raw: e, rol: rolDe(e), rel: e.relation_role || inferRole(e),
    banco: bancoDe(e), cantidad: Math.max(1, Number(e.cantidad) || 1),
  }));

  // --- ANCLAS: CARDINALIDAD REAL + IDENTIDAD ESTABLE (ChatGPT R13-1 / R14-1 / R14-2).
  //   · Un renglón existente con cantidad=N representa N INSTANCIAS físicas: un POOL
  //     con `rem` absorbe hasta N instancias observadas (no se sobre-agrega).
  //   · Match por IDENTIDAD FÍSICA: plan_source_ref → instance_id → zone+grouping →
  //     banco+rol (NO sólo rol|rel|ordinal, que intercambiaría zonas/provenance).
  //   · Cada existente consumido se re-emite UNA vez; `usados` lo saca de intactos. ---
  const anchorSlot = (rol, rel, ord) => `${rol}|${rel}|#${ord}`;
  const existAnchors = ex.filter((e) => esAncla(e.rel));
  const poolAnchor = existAnchors.map((e) => ({ e, rem: e.cantidad }));
  // Slot posicional (rol|rel|ordinal) → poolEntry, para CONFLICTO legacy cuando no
  // hay plan_source_ref ni requirement_id pero el mismo slot está ocupado por otro producto.
  const anchorOrd = new Map();
  const anchorBySlot = new Map();
  for (const p of poolAnchor) {
    const b = `${p.e.rol}|${p.e.rel}`;
    const o = anchorOrd.get(b) || 0; anchorOrd.set(b, o + 1);
    anchorBySlot.set(anchorSlot(p.e.rol, p.e.rel, o), p);
  }
  let reutilizadasFisicas = 0;                      // unidades físicas reutilizadas
  const propAnchorOrd = new Map();
  for (const a of anchorsProp) {
    const rol = a.rol || rolFromRel(a.relation_role);
    const base = `${rol}|${a.relation_role}`;
    const ord = propAnchorOrd.get(base) || 0; propAnchorOrd.set(base, ord + 1);
    const slot = anchorSlot(rol, a.relation_role, ord);
    const banco = String(a.bancoId);
    const aPlan = String(a.plan_source_ref ?? '');
    const aZone = String(a.zone_id ?? a.zone ?? '');
    const find = (pred) => poolAnchor.find((p) => p.rem > 0 && String(p.e.banco) === banco && pred(p));
    const hit = (aPlan && find((p) => String(p.e.raw.plan_source_ref || '') === aPlan))
      || (a.instance_id && find((p) => String(p.e.raw.instance_id || '') === String(a.instance_id)))
      || (aZone && find((p) => String(p.e.raw.zone_id || p.e.raw.zone || '') === aZone && String(p.e.raw.grouping || '') === String(a.grouping || '')))
      || find((p) => p.e.rel === a.relation_role)
      || null;
    // CONFLICTO: misma identidad (plan_source_ref o requirement_id) con producto
    // DISTINTO, o el MISMO slot posicional ocupado por otro producto (legacy).
    const slotOcupado = anchorBySlot.get(slot);
    const conflict = !hit
      ? ((aPlan && poolAnchor.find((p) => String(p.e.raw.plan_source_ref || '') === aPlan && String(p.e.banco) !== banco))
         || (a.requirement_id && poolAnchor.find((p) => String(p.e.raw.requirement_id || '') === String(a.requirement_id) && String(p.e.banco) !== banco))
         || (slotOcupado && slotOcupado.rem > 0 && String(slotOcupado.e.banco) !== banco ? slotOcupado : null))
      : null;
    if (hit) {
      hit.rem -= 1; reutilizadasFisicas += 1; usados.add(hit.e._i);   // consume 1 del renglón (cantidad N)
      hit.matched = hit.matched || []; hit.matched.push({ a, slot });  // acumula para plan_instances (R15-2)
    } else if (conflict) {
      // CONFLICTO: se CONSERVA lo existente (queda en intactos), NO se sustituye.
      conflictos.push({ slot, existente: { bancoId: conflict.e.banco, nombre: conflict.e.raw.nombre ?? null }, propuesto: { bancoId: a.bancoId, nombre: a.nombre ?? null }, code: 'SLOT_OCUPADO_PRODUCTO_DISTINTO' });
    } else {
      confirmadas.push(aItemConfirmado(a, { slot, estado: 'CONFIRMADO' }));
    }
  }
  // Re-emite cada EXISTENTE reutilizado UNA vez. R15-2: si un renglón agrupado
  // (cantidad N) absorbió varias instancias físicas, conserva TODAS las provenances
  // en plan_instances[]. R15-1: lo consumido de menos queda como EXISTING_SURPLUS.
  const observedGoverned = !!(propuesta && propuesta.gobernadoPorObservado);
  for (const p of poolAnchor) {
    const matched = p.matched || [];
    if (matched.length > 0) {
      const first = matched[0];
      const planInstances = matched.map(({ a }) => ({
        instance_id: a.instance_id || null, plan_source_ref: a.plan_source_ref || null,
        zone: a.zone_id || a.zone || null, position: a.observed_position || a.position || null,
        orientation: a.observed_orientation ?? a.orientation ?? null, evidence: a.evidence || null, grouping: a.grouping || null,
      }));
      const item = aItemConfirmado({ ...first.a, cantidad: p.e.cantidad }, { slot: first.slot, estado: 'EXISTENTE' });
      if (planInstances.length > 1) item.plan_instances = planInstances;
      sinCambio.push(item);
      if (p.e.raw && p.e.raw.id != null) {
        const patch = estructuraDe(first.a);
        if (planInstances.length > 1) patch.plan_instances = planInstances;
        enriquecidos.push({ id: p.e.raw.id, patch });
      }
      if (p.rem > 0) conflictos.push({ code: 'EXISTING_SURPLUS', bancoId: p.e.banco, plan_source_ref: p.e.raw.plan_source_ref || null, sobrantes: p.rem, requeridos: matched.length });
    } else if (p.rem > 0 && observedGoverned) {
      // No consumido por el observed que gobierna su mismo producto → excedente (revisión, NO silencio).
      const mismoProducto = anchorsProp.some((a) => String(a.bancoId) === String(p.e.banco));
      const origenObservado = !!(p.e.raw && (p.e.raw.plan_source_ref || p.e.raw.product_source_ref));
      if (mismoProducto || origenObservado) conflictos.push({ code: 'EXISTING_SURPLUS', bancoId: p.e.banco, plan_source_ref: p.e.raw.plan_source_ref || null, sobrantes: p.rem, requeridos: 0 });
    }
  }

  // --- DEPENDIENTES por PRODUCTO+ROL con CANTIDAD, POR ANCLA (#8). Cada fila
  //     existente se enriquece hacia SU ancla; si una fila tendría que PARTIRSE
  //     entre dos anclas → SPLIT_REQUIRED (NEEDS_REVIEW), nunca cross-link silencioso. ---
  const poolDep = new Map();                      // `${rel}|${banco}` -> [{idx, rem}]
  for (const e of ex) {
    if (e.rel && !esAncla(e.rel)) {
      const k = `${e.rel}|${e.banco}`;
      if (!poolDep.has(k)) poolDep.set(k, []);
      poolDep.get(k).push({ idx: e._i, rem: e.cantidad });
    }
  }
  let reutilizadasDep = 0;
  const consumir = (en, dep) => {              // reutiliza fila completa + enriquece a su ancla
    usados.add(en.idx);
    reutilizadasDep += Math.max(1, Number(ex[en.idx].raw.cantidad) || 1);
    sinCambio.push(aItemConfirmado(ex[en.idx].raw, { slot: null, estado: 'EXISTENTE' }));
    if (ex[en.idx].raw.id != null) enriquecidos.push({ id: ex[en.idx].raw.id, patch: estructuraDe(dep) });
    en.rem = 0;
  };
  for (const dep of depsProp) {
    const slot = `${dep.rol || rolFromRel(dep.relation_role)}|${dep.relation_role}|${dep.anchor_instance_id || ''}`;
    const k = `${dep.relation_role}|${dep.bancoId}`;
    let need = Math.max(1, Number(dep.cantidad) || 1);
    const entries = poolDep.get(k) || [];
    // 1) EXACTO primero (estable bajo reorden: cada ancla toma la fila de su tamaño).
    const exacta = entries.find((e) => e.rem === need);
    if (exacta) { consumir(exacta, dep); need = 0; }
    // 2) filas completas que caben dentro del faltante.
    for (const en of entries) { if (need <= 0) break; if (en.rem > 0 && en.rem <= need) { need -= en.rem; consumir(en, dep); } }
    // 3) si aún falta y hay una fila MAYOR, partirla sería asignación ambigua → NEEDS_REVIEW.
    if (need > 0) {
      const mayor = entries.find((e) => e.rem > need);
      if (mayor) { conflictos.push({ code: 'SPLIT_REQUIRED', slot, relation_role: dep.relation_role, bancoId: dep.bancoId, fila_cantidad: mayor.rem, requerido: need }); need = 0; }
      else confirmadas.push(aItemConfirmado({ ...dep, cantidad: need }, { slot, estado: 'CONFIRMADO' }));
    }
  }

  // existentes que el programa no tocó: intactos (normaliza bancoId desde piezaId
  // para que la lista de items sea homogénea aguas abajo).
  const intactos = ex.filter((e) => !usados.has(e._i)).map((e) => ({ ...e.raw, bancoId: bancoDe(e.raw) }));
  const items = [...intactos, ...sinCambio, ...confirmadas];
  const propias = [...confirmadas, ...sinCambio];

  return {
    items,
    confirmadas,
    sinCambio,
    conflictos,
    enriquecidos,                                  // #4: parches estructurales para existentes reutilizados
    resumen: {
      total: items.length,
      nuevas: confirmadas.length,
      reutilizadas: sinCambio.length,                 // RENGLONES reutilizados (compat)
      // R14-1: UNIDADES físicas reutilizadas (un renglón cantidad=N cuenta N).
      reutilizadasUnidades: reutilizadasFisicas + reutilizadasDep,
      conflictos: conflictos.length,
      productosReales: propias.every((it) => it.bancoId && !String(it.bancoId).startsWith('sug-') && it.product_status === 'RESOLVED'),
      identidadesValidas: propias.every((it) => it.identity_status === 'RESOLVED'),
      preciosDisponibles: propias.every((it) => it.price_status !== 'SIN_PRECIO'),
    },
  };
}
