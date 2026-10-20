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
  // VH-AUD-202 + recorrido texto→plano: el DESTINO declarado (anchor_role o la nota "para la sala de juntas") manda
  // sobre el modelo; una CONCERTO de juntas no es "visita" sólo porque el catálogo la llame así.
  const porDestino = relDeDestino(item);
  if (porDestino) return porDestino;
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

// VH-AUD-202: modelos de asiento cuyo USO depende del destino (una CONCERTO es silla de juntas o de visita).
const ROLES_FLEX = ['MEETING_SEAT', 'VISITOR_SEAT'];
const esAsientoFlexible = (e) => /concerto/.test(norm(`${e?.nombre || ''} ${bancoDe(e || {}) || ''}`));
// Rol que se desprende del DESTINO declarado de una silla (su anchor_role), antes que de su modelo.
function relDeDestino(e) {
  const t = norm(`${e?.nombre || ''} ${bancoDe(e || {}) || ''}`);
  if (!/silla|asiento|concerto|sonata/.test(t)) return null;
  if (e.anchor_role === 'ANCHOR_MEETING') return 'MEETING_SEAT';
  if (e.anchor_role === 'ANCHOR_DESK' && /concerto|visit|delta|confident/.test(t)) return 'VISITOR_SEAT';
  // Silla cuyo uso depende del destino: lo que dice su nota/zona (cotizar por texto: "Modelo de casa para salas de
  // juntas/consejo"). Juntas primero; visita sólo si la nota habla de visitas/privados.
  if (esAsientoFlexible(e)) {
    const d = norm(`${e?.nota || ''} ${e?.zone_id || ''} ${e?.zonaSugerida || ''}`);
    if (/sala(?:s)? de junta|\bjunta(?:s)?\b|consejo|reunion|meeting|boardroom/.test(d)) return 'MEETING_SEAT';
    if (/visita|privad|direccion|oficina/.test(d)) return 'VISITOR_SEAT';
  }
  return null;
}
// VH-AUD-203: firma canónica de un reparto (renglón, rol, requerimientos y cuántas piezas van a cada mueble).
// El orden no importa; cualquier cambio de anclas, cantidades o requerimiento cambia la firma.
export function firmaReparto(filaId, deps) {
  const rel = deps[0]?.dep?.relation_role ?? null;
  const reqs = [...new Set(deps.map((x) => String(x.dep.requirement_id ?? '')))].sort();
  const porAncla = new Map();
  for (const x of deps) { const k = String(x.dep.anchor_instance_id ?? ''); porAncla.set(k, (porAncla.get(k) || 0) + x.n); }
  const destinos = [...porAncla.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({ v: 1, fila: String(filaId), rel, reqs, destinos });
}

export function confirmarPrograma(propuesta, { existentes = [], sustituir = [], mantenerAmbos = [], repartir = [], roles = {}, destinos = {} } = {}) {
  const sustituirSet = new Set((Array.isArray(sustituir) ? sustituir : []).map(String));
  // Prueba de Rodrigo 19-oct: ids de renglones que la persona decidió REPARTIR entre varios muebles del mismo tipo
  // (16 WIN para dos bancos de 8). Sin esta decisión, partir un renglón sigue siendo SPLIT_REQUIRED.
  const repartirSet = new Set((Array.isArray(repartir) ? repartir : []).map(String));
  // VH-AUD-203: la decisión guardada en el renglón (`reparto_firma`) sólo se reutiliza si el reparto de hoy tiene
  // EXACTAMENTE la misma firma; si cambió algo (anclas, cantidades, requerimiento) se vuelve a preguntar.
  const firmasGuardadas = new Map();
  for (const e of existentes) if (e && e.id != null && typeof e.reparto_firma === 'string' && e.reparto_firma) firmasGuardadas.set(String(e.id), e.reparto_firma);
  // VH-AUD-202: decisión explícita de la persona sobre el uso de una silla ambigua ({ id: 'MEETING_SEAT' | 'VISITOR_SEAT' }).
  const rolesDecididos = roles && typeof roles === 'object' ? roles : {};
  // P1-PROG-01: decisión explícita de la persona sobre la ZONA de una fila sin destino ({ id: 'SALA DE CONSEJO' }).
  const destinosDecididos = destinos && typeof destinos === 'object' ? destinos : {};
  existentes = existentes.map((e) => (e && e.id != null && typeof destinosDecididos[String(e.id)] === 'string' && !e.zone_id ? { ...e, zone_id: destinosDecididos[String(e.id)] } : e));
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

  const ex = existentes.map((e, i) => {
    const decidido = e?.id != null && ROLES_FLEX.includes(rolesDecididos[String(e.id)]) ? rolesDecididos[String(e.id)] : null;
    const porDestino = relDeDestino(e);
    const flex = !decidido && !e.relation_role && !porDestino && esAsientoFlexible(e);
    return {
      _i: i, raw: e, rol: rolDe(e), rel: decidido || e.relation_role || porDestino || inferRole(e), flex, decidido,
      banco: bancoDe(e), cantidad: Math.max(1, Number(e.cantidad) || 1),
    };
  });
  // VH-AUD-202: una silla cuyo uso depende del destino y no lo declara toma el ÚNICO uso que el programa le pide
  // (juntas o visita). Si el programa pide los dos, no se adivina: ROL_AMBIGUO y esas sillas no se agregan a ciegas.
  const rolesRetenidos = new Set();
  const excluidos = new Set();
  const usosDep = new Set(partidas.filter((p) => !esAncla(p.relation_role)).map((p) => p.relation_role).filter((r) => ROLES_FLEX.includes(r)));
  for (const e of ex) {
    if (!e.flex) continue;
    const usos = [...usosDep].sort();
    if (usos.length === 1) e.rel = usos[0];
    else if (usos.length > 1) {
      excluidos.add(e._i);
      usos.forEach((u) => rolesRetenidos.add(u));
    }
  }

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
        // Lab de recorridos 19-oct (C1): la ficha del banco del producto que eligió la persona (Ergonova 4 · Recepción:
        // usuarios 1) también es SU capacidad; antes heredaba los 2 usuarios del módulo propuesto (2 sillas en recepción).
        const fichaPersona = [prev.raw?.piezaId, prev.raw?.bancoId, prev.raw?.source_ref].map((k) => (k != null ? BANCO.find((b) => b.id === String(k)) : null)).find(Boolean);
        const capExplicita = Number(prev.raw?.user_capacity ?? prev.raw?.usuarios) > 0 ? Number(prev.raw.user_capacity ?? prev.raw.usuarios)
          : (Number(fichaPersona?.usuarios) > 0 ? Number(fichaPersona.usuarios) : null);
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
  for (const idx of excluidos) {
    const e = ex[idx];
    conflictos.push({ code: 'ROL_AMBIGUO', slot: `rol|${e.raw.id ?? idx}`, fila_id: e.raw.id ?? null, fila_nombre: e.raw.nombre ?? null, cantidad: e.cantidad, opciones: [...usosDep].sort() });
  }
  const poolDep = new Map();                      // `${rel}|${banco}` -> [{idx, rem}]
  // Una sola entrada por renglón (compartida con poolRol): lo que queda de un renglón repartido se lleva en un solo lugar.
  const entradaDe = new Map();                    // idx -> {idx, rem, programa, ancla}
  for (const e of ex) {
    if (e.rel && !esAncla(e.rel) && !excluidos.has(e._i)) {
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
  const repartirEn = (en, dep, n, slot) => {
    const raw = ex[en.idx].raw;
    if (!repartidos.has(en.idx)) {
      const item = aItemConfirmado(raw, { slot: null, estado: 'EXISTENTE' });
      repartidos.set(en.idx, { deps: [], item, rem0: en.rem });
      usados.add(en.idx);
      sinCambio.push(item);
    }
    repartidos.get(en.idx).deps.push({ dep, n, slot });
    en.rem -= n;
  };
  const consumir = (en, dep) => {              // reutiliza fila completa + enriquece a su ancla
    if (repartidos.has(en.idx)) { repartirEn(en, dep, en.rem, null); return; }   // lo que queda de un renglón ya repartido
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
    if (e.rel && !esAncla(e.rel) && !excluidos.has(e._i)) {
      if (!poolRol.has(e.rel)) poolRol.set(e.rel, []);
      poolRol.get(e.rel).push(entradaDe.get(e._i));
    }
  }
  // Prueba de Rodrigo 19-oct: una silla de RECEPCIÓN no se cubre con las WIN de los puestos operativos (ni al revés):
  // si la fila existente declara a qué mueble va (anchor_role, zona o nota) y no es el del dependiente, no se usa.
  const destinoFila = (raw) => rolFromRel(raw?.anchor_role) || (/\brecepci/i.test(`${raw?.zone_id || ''} ${raw?.nota || ''}`) ? 'recepcion' : null);
  const destinoDep = (dep) => rolFromRel(dep.anchor_role) || null;
  // VH-AUD-204 + P1-PROG-01 (cierre ChatGPT): el DESTINO es canónico — rol del ancla, ZONA y requerimiento. Cada dato que
  // las DOS filas declaran tiene que coincidir (una guarda de OFICINA CEO no cubre la de SALA DE CONSEJO aunque ninguna
  // diga anchor_role). Sólo lo que una fila NO declara queda como fallback controlado.
  const zonaNorm = (z) => (z == null || z === '' ? null : norm(String(z)));
  const canonFila = (raw) => ({ rol: destinoFila(raw), zona: zonaNorm(raw?.zone_id ?? raw?.zonaSugerida), req: raw?.requirement_id ?? null });
  const canonDep = (dep) => ({ rol: destinoDep(dep), zona: zonaNorm(dep.zone_id), req: dep.requirement_id ?? null });
  const mismoDestino = (e, dep) => {
    const a = canonFila(ex[e.idx]?.raw), b = canonDep(dep);
    for (const k of ['rol', 'zona', 'req']) if (a[k] != null && b[k] != null && String(a[k]) !== String(b[k])) return false;
    return true;
  };
  // P1-PROG-01: una fila SIN ningún destino que podría cubrir ENTERA a dependientes de DOS o más zonas distintas no se
  // asigna en silencio a la primera: DESTINO_AMBIGUO (la persona elige la zona) y esos dependientes no se agregan a ciegas.
  const zonasRetenidas = new Set();
  for (const e of ex) {
    if (!e.rel || esAncla(e.rel) || excluidos.has(e._i)) continue;
    const c = canonFila(e.raw);
    if (c.rol != null || c.zona != null || c.req != null) continue;
    const zonasQueLaToman = [...new Set(depsProp.filter((d) => d.relation_role === e.rel && Math.max(1, Number(d.cantidad) || 1) >= e.cantidad && d.zone_id != null).map((d) => String(d.zone_id)))];
    if (zonasQueLaToman.length >= 2) {
      excluidos.add(e._i);
      zonasQueLaToman.forEach((z) => zonasRetenidas.add(`${e.rel}|${zonaNorm(z)}`));
      conflictos.push({ code: 'DESTINO_AMBIGUO', slot: `destino|${e.raw.id ?? e._i}`, fila_id: e.raw.id ?? null, fila_nombre: e.raw.nombre ?? null, cantidad: e.cantidad, relation_role: e.rel, opciones: zonasQueLaToman.sort() });
    }
  }
  for (const [k, lista] of poolDep) poolDep.set(k, lista.filter((en) => !excluidos.has(en.idx)));
  for (const [k, lista] of poolRol) poolRol.set(k, lista.filter((en) => !excluidos.has(en.idx)));
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
      if (mayor && filaId != null && (repartirSet.has(String(filaId)) || firmasGuardadas.has(String(filaId)))) { repartirEn(mayor, dep, need, slot); need = 0; }
      else if (mayor) {
        const fila = ex[mayor.idx].raw;
        conflictos.push({ code: 'SPLIT_REQUIRED', slot, relation_role: dep.relation_role, bancoId: dep.bancoId, fila_cantidad: mayor.rem, requerido: need,
          fila_id: filaId, fila_nombre: fila.nombre ?? null, anchor_role: dep.anchor_role ?? null, rol: dep.rol || rolFromRel(dep.relation_role) });
        need = 0;
      } else if (!rolesRetenidos.has(dep.relation_role) && !zonasRetenidas.has(`${dep.relation_role}|${zonaNorm(dep.zone_id)}`)) confirmadas.push(aItemConfirmado({ ...dep, cantidad: need }, { slot, estado: 'CONFIRMADO' }));
    }
  }
  for (const [idx, { deps: asignados, item, rem0 }] of repartidos) {
    const raw = ex[idx].raw;
    if (raw.id == null) continue;
    const firma = firmaReparto(raw.id, asignados);
    const explicita = repartirSet.has(String(raw.id));
    if (!explicita && firma !== firmasGuardadas.get(String(raw.id))) {
      // El reparto de hoy no es el que la persona aprobó: se deshace y se vuelve a preguntar (SPLIT_REQUIRED).
      usados.delete(idx);
      const k = sinCambio.indexOf(item); if (k >= 0) sinCambio.splice(k, 1);
      for (const { dep, n, slot } of asignados) {
        conflictos.push({ code: 'SPLIT_REQUIRED', slot: slot || `${dep.rol || rolFromRel(dep.relation_role)}|${dep.relation_role}|${dep.anchor_instance_id || ''}`, relation_role: dep.relation_role, bancoId: dep.bancoId,
          fila_cantidad: rem0, requerido: n, fila_id: raw.id, fila_nombre: raw.nombre ?? null, anchor_role: dep.anchor_role ?? null, rol: dep.rol || rolFromRel(dep.relation_role) });
      }
      continue;
    }
    const deps = asignados.map((x) => x.dep);
    // Lab de recorridos 19-oct: si el reparto NO usa todo el renglón (1 de 13 para la recepción), lo que sobra no es de
    // ese mueble: no se amarra el renglón a su destino (antes las 13 quedaban "de recepción").
    const sobra = rem0 - asignados.reduce((s, x) => s + x.n, 0) > 0;
    const comun = (k) => { if (sobra) return null; const v = deps[0]?.[k] ?? null; return deps.every((d) => (d[k] ?? null) === v) ? v : null; };
    enriquecidos.push({ id: raw.id, patch: { relation_role: deps.every((d) => d.relation_role === deps[0]?.relation_role) ? (deps[0]?.relation_role ?? null) : null,
      anchor_role: comun('anchor_role'), anchor_instance_id: !sobra && deps.length === 1 ? (deps[0].anchor_instance_id ?? null) : null,
      functional_group_id: comun('functional_group_id'), zone_id: comun('zone_id'), repartido_entre: new Set(deps.map((d) => d.anchor_instance_id)).size, reparto_firma: firma } });
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
