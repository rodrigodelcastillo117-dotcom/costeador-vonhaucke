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
import { capacidadDeNombre } from './capacidadDeclarada.js';

const norm = (s = '') => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const esAncla = (rel) => typeof rel === 'string' && rel.startsWith('ANCHOR_');
export const bancoDe = (it) => it.bancoId || it.piezaId || null;

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
  // VH-092: la recepción del banco (p9-recepcion-…) viene con tipo 'guarda' en su ficha y caía
  // en UNDERDESK_STORAGE; el mostrador de recepción es un ANCLA.
  if (/recepci|mostrador|lobby/.test(t)) return 'ANCHOR_RECEPTION';
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

export function rolFromRel(rel) {
  switch (rel) {
    case 'ANCHOR_WORKSTATION': case 'WORK_SEAT': case 'UNDERDESK_STORAGE': return 'operativo';
    case 'ANCHOR_DESK': case 'EXECUTIVE_SEAT': case 'VISITOR_SEAT': return 'privado';
    case 'ANCHOR_MEETING': case 'MEETING_SEAT': return 'juntas';
    case 'ANCHOR_RECEPTION': return 'recepcion';
    default: return null;
  }
}

// Rol funcional de un item existente: explícito, o inferido del nombre (legacy).
export function inferRole(item) {
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
  // VH-092: guardas de piso (credenza, archivero, librero…) son dependientes de apoyo.
  if (/credenza|archivero|librero|armario|locker|guarda de piso/.test(t)) return 'SUPPORT_STORAGE';
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
export function estructuraDe(part) {
  return {
    relation_role: part.relation_role ?? null,
    anchor_role: part.anchor_role ?? null,
    anchor_instance_id: part.anchor_instance_id ?? null,
    instance_id: part.instance_id ?? null,
    functional_group_id: part.functional_group_id ?? null,
    requirement_id: part.requirement_id ?? null,
    zone_id: part.zone_id ?? null,
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
    nombre: part.nombre ?? null,
    linea: part.linea ?? null,
    usuarios: part.usuarios ?? null,
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
// Una partida que NO vino del programa (VONI texto, banco, catálogo, especial): la
// describió una persona. Si ocupa el mismo slot funcional que el ancla propuesta, es
// el MISMO requerimiento con otro producto → se reutiliza y se enriquece (la palabra
// del usuario gana al producto genérico del programa). Sólo programa-vs-programa es
// conflicto real (p. ej. cambió el brief y el slot ya tiene otra mesa).
const esDelPrograma = (raw) => raw && raw.source === 'CONFIRMADO_PROGRAMA';
// Prueba de Rodrigo 19-oct: ¿el producto que eligió la persona ya trae SU huella (ficha del banco o medidas en el
// nombre)? Entonces el injerto VH-090 no le pone la del mueble propuesto (la Ergonova 4 de 1815 × 834 se guardaba
// con los 2420 mm del mostrador genérico y "se salía de su cuarto" en el acomodo).
const RE_DOS_MEDIDAS = /\d+(?:\.\d+)?\s*(?:mm|cm|m)?\s*[x×X]\s*\d+(?:\.\d+)?/;
function tieneHuellaPropia(raw = {}) {
  for (const k of [raw.piezaId, raw.bancoId, raw.source_ref]) {
    const b = k != null ? BANCO.find((x) => x.id === String(k)) : null;
    if (b && RE_DOS_MEDIDAS.test(String(b.medidas || ''))) return true;
  }
  return RE_DOS_MEDIDAS.test(String(raw.nombre || ''));
}

export function confirmarPrograma(propuesta, { existentes = [], sustituir = [], mantenerAmbos = [], repartir = [] } = {}) {
  const sustituirSet = new Set((Array.isArray(sustituir) ? sustituir : []).map(String));
  // Prueba de Rodrigo 19-oct: ids de renglones que la persona decidió REPARTIR entre varios muebles del mismo tipo
  // (16 WIN para dos bancos de 8). Sin esta decisión, partir un renglón sigue siendo SPLIT_REQUIRED.
  const repartirSet = new Set((Array.isArray(repartir) ? repartir : []).map(String));
  // La decisión queda guardada en el renglón (`repartido_entre`): al volver a leer el plano no se vuelve a preguntar.
  for (const e of existentes) if (e && e.id != null && Number(e.repartido_entre) > 0) repartirSet.add(String(e.id));
  const ambosSet = new Set((Array.isArray(mantenerAmbos) ? mantenerAmbos : []).map(String));
  const reemplazados = [];                        // ids de existentes sustituidos por decisión explícita
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

  // --- ANCLAS: identidad (requirement_id) PRIMERO, luego posición legacy (#9). ---
  const anchorSlot = (rol, rel, ord) => `${rol}|${rel}|#${ord}`;
  const existAnchors = ex.filter((e) => esAncla(e.rel));
  const existByReq = new Map();
  for (const e of existAnchors) { if (e.raw && e.raw.requirement_id) existByReq.set(String(e.raw.requirement_id), e); }
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
    // #9: requirement_id (estable bajo reorden) manda; posición sólo como fallback legacy.
    const prev = (a.requirement_id && existByReq.get(String(a.requirement_id))) || anchorBySlot.get(slot);
    if (prev) {
      if (String(prev.banco) === String(a.bancoId)) {
        usados.add(prev._i);                      // reutiliza: lo re-emitimos como EXISTENTE
        sinCambio.push(aItemConfirmado(a, { slot, estado: 'EXISTENTE' }));
        if (prev.raw && prev.raw.id != null) enriquecidos.push({ id: prev.raw.id, patch: estructuraDe(a) });
      } else if (!esDelPrograma(prev.raw)) {
        // VH-090: mismo slot, producto que ELIGIÓ una persona → se conserva ESE producto y
        // se le injerta la estructura del programa (rol, instancia, grupo, zona, capacidad).
        // Nunca se duplica el ancla ni se bloquea el botón por esto.
        usados.add(prev._i);
        sinCambio.push(aItemConfirmado({ ...prev.raw, ...estructuraDe(a), bancoId: prev.banco, relation_role: a.relation_role, rol: a.rol || rolFromRel(a.relation_role) }, { slot, estado: 'EXISTENTE_EQUIVALENTE' }));
        // VH-112: si la persona declaró la capacidad (explícita o en el nombre, "8 usuarios"), esa manda sobre
        // la del módulo del programa (un módulo de 12 no convierte su banca de 8 en una de 12).
        const capExplicita = Number(prev.raw?.user_capacity ?? prev.raw?.usuarios) > 0 ? Number(prev.raw.user_capacity ?? prev.raw.usuarios) : null;
        const capPersona = capExplicita ?? capacidadDeNombre(prev.raw?.nombre, { w: prev.raw?.w ?? a.w, rol: a.relation_role });
        // VH-120: la leída del nombre viaja marcada como INFERIDA (evidencia más débil); la explícita conserva su fuente.
        if (prev.raw && prev.raw.id != null) enriquecidos.push({ id: prev.raw.id, patch: { ...estructuraDe(a), relation_role: a.relation_role, ...(capPersona ? { user_capacity: capPersona, ...(capExplicita ? {} : { user_capacity_inferida: true }) } : {}), ...(prev.raw.w == null && a.w != null && !tieneHuellaPropia(prev.raw) ? { w: a.w } : {}), ...(prev.raw.d == null && a.d != null && !tieneHuellaPropia(prev.raw) ? { d: a.d } : {}) } });
      } else if (sustituirSet.has(slot)) {
        // Decisión explícita de la persona: el propuesto SUSTITUYE al existente del programa.
        usados.add(prev._i);
        if (prev.raw && prev.raw.id != null) reemplazados.push(prev.raw.id);
        confirmadas.push(aItemConfirmado(a, { slot, estado: 'CONFIRMADO' }));
      } else if (ambosSet.has(slot)) {
        // Decisión explícita: son DOS requerimientos distintos → el existente se queda y el
        // propuesto entra como ancla adicional (slot propio, misma zona/grupo).
        confirmadas.push(aItemConfirmado(a, { slot: `${slot}+`, estado: 'CONFIRMADO' }));
      } else {
        // CONFLICTO programa-vs-programa: se CONSERVA lo existente, NO se sustituye solo. Se
        // entrega TODO lo que la persona necesita ver para decidir (VH-091): cantidades, producto,
        // identidad, medidas, precio de lista y cuántos dependientes cuelgan del existente.
        const depsExistentes = ex.filter((e) => e.raw && e.raw.anchor_instance_id && prev.raw.instance_id && String(e.raw.anchor_instance_id) === String(prev.raw.instance_id));
        conflictos.push({
          slot, code: 'SLOT_OCUPADO_PRODUCTO_DISTINTO',
          existente: { id: prev.raw.id ?? null, bancoId: prev.banco, nombre: prev.raw.nombre ?? null, cantidad: prev.cantidad, w: prev.raw.w ?? null, d: prev.raw.d ?? null, precio: Number(prev.raw.precioUnitario ?? prev.raw.precio_lista_snapshot) || null, productoId: prev.raw.productoId ?? null, usuarios: prev.raw.user_capacity ?? prev.raw.usuarios ?? null },
          propuesto: { bancoId: a.bancoId, nombre: a.nombre ?? null, cantidad: Math.max(1, Number(a.cantidad) || 1), w: a.w ?? null, d: a.d ?? null, precio: Number(a.precio_lista_snapshot ?? a.precio) || null, productoId: a.identidad?.producto_id ?? a.productoId ?? null, usuarios: a.user_capacity ?? a.usuarios ?? null },
          dependientes: depsExistentes.reduce((n, e) => n + e.cantidad, 0),
          dependientesFilas: depsExistentes.length,
        });
      }
    } else {
      confirmadas.push(aItemConfirmado(a, { slot, estado: 'CONFIRMADO' }));
    }
  }

  // --- DEPENDIENTES por PRODUCTO+ROL con CANTIDAD, POR ANCLA (#8). Cada fila
  //     existente se enriquece hacia SU ancla; si una fila tendría que PARTIRSE
  //     entre dos anclas → SPLIT_REQUIRED (NEEDS_REVIEW), nunca cross-link silencioso. ---
  const poolDep = new Map();                      // `${rel}|${banco}` -> [{idx, rem}]
  // Una sola entrada por renglón (compartida con poolRol): lo que queda de un renglón repartido se lleva en un solo lugar.
  const entradaDe = new Map();                    // idx -> {idx, rem, programa, ancla}
  for (const e of ex) {
    if (e.rel && !esAncla(e.rel)) {
      const k = `${e.rel}|${e.banco}`;
      if (!poolDep.has(k)) poolDep.set(k, []);
      const en = { idx: e._i, rem: e.cantidad, programa: esDelPrograma(e.raw), ancla: e.raw.anchor_instance_id || null };
      entradaDe.set(e._i, en);
      poolDep.get(k).push(en);
    }
  }
  // Renglón repartido por decisión: se reutiliza UNA vez y su patch lleva sólo la estructura COMÚN de los
  // dependientes que cubre (rol, tipo de ancla, zona/grupo si coinciden), nunca la instancia de un solo mueble.
  const repartidos = new Map();                   // idx -> { deps: [] }
  const repartirEn = (en, dep, n) => {
    const raw = ex[en.idx].raw;
    if (!repartidos.has(en.idx)) {
      repartidos.set(en.idx, { deps: [] });
      usados.add(en.idx);
      sinCambio.push(aItemConfirmado(raw, { slot: null, estado: 'EXISTENTE' }));
    }
    repartidos.get(en.idx).deps.push(dep);
    en.rem -= n;
  };
  const consumir = (en, dep) => {              // reutiliza fila completa + enriquece a su ancla
    if (repartidos.has(en.idx)) { repartirEn(en, dep, en.rem); return; }   // lo que queda de un renglón ya repartido
    usados.add(en.idx);
    sinCambio.push(aItemConfirmado(ex[en.idx].raw, { slot: null, estado: 'EXISTENTE' }));
    if (ex[en.idx].raw.id != null) enriquecidos.push({ id: ex[en.idx].raw.id, patch: estructuraDe(dep) });
    en.rem = 0;
  };
  // VH-090: pool por ROL a secas, sólo con filas que describió una persona (no del
  // programa): "Silla · SONATA ×4" cubre el MEETING_SEAT propuesto aunque el programa
  // pida otro modelo. Se consume DESPUÉS del pool exacto.
  // También cubre una fila del PROGRAMA del mismo rol atada a la MISMA ancla (mismo kit): al
  // sustituir la mesa, las sillas ya confirmadas de esa sala no se vuelven a agregar.
  const poolRol = new Map();
  for (const e of ex) {
    if (e.rel && !esAncla(e.rel)) {
      if (!poolRol.has(e.rel)) poolRol.set(e.rel, []);
      poolRol.get(e.rel).push(entradaDe.get(e._i));
    }
  }
  // Prueba de Rodrigo 19-oct: una silla de RECEPCIÓN no se cubre con las WIN de los puestos operativos (ni al revés):
  // si la fila existente declara a qué mueble va (anchor_role, zona o nota) y no es el del dependiente, no se usa.
  const destinoFila = (raw) => rolFromRel(raw?.anchor_role) || (/\brecepci/i.test(`${raw?.zone_id || ''} ${raw?.nota || ''}`) ? 'recepcion' : null);
  const destinoDep = (dep) => rolFromRel(dep.anchor_role) || null;
  const mismoDestino = (e, dep) => { const a = destinoFila(ex[e.idx]?.raw), b = destinoDep(dep); return !a || !b || a === b || (b !== 'recepcion' && a !== 'recepcion'); };
  for (const dep of depsProp) {
    const slot = `${dep.rol || rolFromRel(dep.relation_role)}|${dep.relation_role}|${dep.anchor_instance_id || ''}`;
    const k = `${dep.relation_role}|${dep.bancoId}`;
    let need = Math.max(1, Number(dep.cantidad) || 1);
    const exactas = (poolDep.get(k) || []).filter((e) => e.rem > 0 && mismoDestino(e, dep));
    const porRol = (poolRol.get(dep.relation_role) || []).filter((e) => !exactas.includes(e) && (!usados.has(e.idx) || (repartidos.has(e.idx) && e.rem > 0)) && mismoDestino(e, dep)
      && (!e.programa || (e.ancla && dep.anchor_instance_id && String(e.ancla) === String(dep.anchor_instance_id))));
    const entries = [...exactas, ...porRol];
    // 1) EXACTO primero (estable bajo reorden: cada ancla toma la fila de su tamaño).
    const exacta = entries.find((e) => e.rem === need);
    if (exacta) { consumir(exacta, dep); need = 0; }
    // 2) filas completas que caben dentro del faltante.
    for (const en of entries) { if (need <= 0) break; if (en.rem > 0 && en.rem <= need) { need -= en.rem; consumir(en, dep); } }
    // 3) si aún falta y hay una fila MAYOR, partirla sería asignación ambigua → NEEDS_REVIEW.
    if (need > 0) {
      const mayor = entries.find((e) => e.rem > need);
      const filaId = mayor ? (ex[mayor.idx].raw.id ?? null) : null;
      if (mayor && filaId != null && repartirSet.has(String(filaId))) { repartirEn(mayor, dep, need); need = 0; }
      else if (mayor) {
        const fila = ex[mayor.idx].raw;
        conflictos.push({ code: 'SPLIT_REQUIRED', slot, relation_role: dep.relation_role, bancoId: dep.bancoId, fila_cantidad: mayor.rem, requerido: need,
          fila_id: filaId, fila_nombre: fila.nombre ?? null, anchor_role: dep.anchor_role ?? null, rol: dep.rol || rolFromRel(dep.relation_role) });
        need = 0;
      } else confirmadas.push(aItemConfirmado({ ...dep, cantidad: need }, { slot, estado: 'CONFIRMADO' }));
    }
  }
  for (const [idx, { deps }] of repartidos) {
    const raw = ex[idx].raw;
    if (raw.id == null) continue;
    const comun = (k) => { const v = deps[0]?.[k] ?? null; return deps.every((d) => (d[k] ?? null) === v) ? v : null; };
    enriquecidos.push({ id: raw.id, patch: { relation_role: comun('relation_role'), anchor_role: comun('anchor_role'), anchor_instance_id: deps.length === 1 ? (deps[0].anchor_instance_id ?? null) : null,
      functional_group_id: comun('functional_group_id'), zone_id: comun('zone_id'), repartido_entre: deps.length } });
  }

  // existentes que el programa no tocó: intactos (normaliza bancoId desde piezaId
  // para que la lista de items sea homogénea aguas abajo).
  const intactos = ex.filter((e) => !usados.has(e._i)).map((e) => ({ ...e.raw, bancoId: bancoDe(e.raw) }));
  // Los sustituidos por decisión explícita se van de `items` (no quedan en intactos: usados).

  const items = [...intactos, ...sinCambio, ...confirmadas];
  const propias = [...confirmadas, ...sinCambio];

  return {
    items,
    confirmadas,
    sinCambio,
    conflictos,
    enriquecidos,                                  // #4: parches estructurales para existentes reutilizados
    reemplazados,                                  // VH-091: ids de existentes sustituidos por decisión explícita
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
