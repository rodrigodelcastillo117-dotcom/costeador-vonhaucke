// ============================================================================
//  resolverPrograma · PRODUCT RESOLVER del programa (P0.1).
//  FloorSpec/ProgramRequirement → PRODUCTO REAL → dependientes reales → PROPUESTA
//  (no confirma; confirmar es acto explícito del usuario, ver confirmarPrograma).
//
//  Erradica #102: nada de `ceil(n/2)*1500` (10u → 7500). Cada requerimiento se
//  resuelve contra el CATÁLOGO CANÓNICO (catalogoCanonico.js) con composición
//  DETERMINISTA (DP: menor desperdicio, luego menos módulos — no greedy). El 10u
//  → `op-10u-6000x1200-cristal` (6000×1200).
//
//  SEMÁNTICA ESTRUCTURAL (no depende del nombre comercial):
//   · El ANCLA lleva `relation_role = ANCHOR_*` (ANCHOR_WORKSTATION/DESK/MEETING/
//     RECEPTION) y una `instance_id` ÚNICA y estable por instancia.
//   · El DEPENDIENTE lleva su `relation_role` funcional (WORK_SEAT/…), el
//     `anchor_role` del TIPO de ancla que necesita, y `anchor_instance_id`
//     apuntando a la instancia concreta de su ancla (no al bancoId, que se
//     repite entre módulos iguales).
//   · `functional_group_id` e `instance_id` se derivan de identidad estable
//     (rol + ordinal), sobreviven refresh/reordenamiento.
//
//  TRES COMPUERTAS SEPARADAS (nunca se mezclan):
//   · product_status  RESOLVED/UNRESOLVED/NEEDS_CONFIRMATION (realidad de producto)
//   · identity_status RESOLVED/MISSING (producto_id + producto_version_id)
//   · price_status    SNAPSHOT_DISPLAY/SIN_PRECIO (precio NO es autoridad; servidor)
//  Un producto RESOLVED con price SIN_PRECIO sigue siendo REAL; sólo bloquea la
//  cotización/emisión, no su existencia.
//
//  INCLUSIÓN de dependientes (no extras silenciosos, #11):
//   · 'anchor'                el ancla
//   · 'mandatory_by_rule'     asiento del puesto (regla Von Haucke validada)
//   · 'requested'             pedido explícito en el brief
//   · 'optional_recommendation' guarda/gaveta no pedida → recomendación, NO partida
// ============================================================================
import {
  modulosOperativosPorLinea, lineasOperativasDisponibles,
  ESCRITORIOS, JUNTAS, RECEPCIONES,
  vistaCanonica, identidadDe, autoridadPrecio, medidasAwd,
  asientoPara, guardaPara, buscarEnColeccion,
} from './catalogoCanonico.js';
import { placementProfileDeResolucion } from './placementTopologia.js';

export { medidasAwd };   // única fuente del parser de medidas

const LINEA_DEFAULT = 'App LT';

// --- Identidad estable (sobrevive refresh/reorden; #13/#14) ---------------
export const requirementId = (zone_id, rol, ord) => `req:${zone_id || 'z'}:${rol}:${ord}`;
export const instanceId = (requirement_id, ord) => `inst:${requirement_id}:#${ord}`;
export const groupId = (requirement_id, ord) => `fg:${requirement_id}:#${ord}`;

// ---------------------------------------------------------------------------
// Construye una RESOLUCIÓN con geometría real + compuertas SEPARADAS.
// ---------------------------------------------------------------------------
export function construirResolucion(prod, {
  requirement_id = null, zone_id = null, rol = null, evidence = null,
  relation_role, anchor_role = null,
  functional_group_id = null, instance_id = null, anchor_instance_id = null,
  cantidad = 1, inclusion = 'anchor',
}) {
  if (!prod) return null;
  const vista = vistaCanonica(prod);
  if (!vista) return null;                       // no canónico → no se resuelve
  const ident = identidadDe(prod.id);
  const precioGate = autoridadPrecio(prod);
  const snapshot = precioGate.precio_lista_snapshot;
  return {
    requirement_id, zone_id, rol, evidence,      // identidad FloorSpec (#16)
    bancoId: vista.bancoId,
    source_ref: vista.bancoId,
    source_type: 'banco',
    nombre: vista.nombre,
    linea: vista.linea,
    usuarios: vista.usuarios,
    w: vista.w,
    d: vista.d,
    // --- semántica estructural ---
    relation_role,                               // ANCHOR_* en anclas; rol funcional en dependientes
    anchor_role,                                 // tipo de ancla requerida (dependientes)
    functional_group_id,
    instance_id,
    anchor_instance_id,
    cantidad,
    inclusion,
    // --- TRES COMPUERTAS separadas ---
    product_status: 'RESOLVED',
    identity_status: ident ? 'RESOLVED' : 'MISSING',
    identidad: ident
      ? { producto_id: ident.producto_id, producto_version_id: ident.producto_version_id, lista_precio_item_id: ident.lista_precio_item_id }
      : null,
    precio_lista_snapshot: snapshot,             // display; NO autoridad
    price_status: Number(snapshot) > 0 ? 'SNAPSHOT_DISPLAY' : 'SIN_PRECIO',
    autoridad: 'SERVIDOR',                        // la cifra oficial la valida el servidor
    source: 'RESUELTO',
  };
}

// Resolución PENDIENTE: lo pedido no existe (o no cubre) en catálogo. NUNCA se
// sustituye en silencio (#7/#8/#9/#10). No entra a partidas comerciales; viaja a
// incompletos/pendientes para que el usuario confirme/ajuste.
function needsConfirm({ requirement_id = null, zone_id = null, rol = null, relation_role, anchor_role = null, functional_group_id = null, anchor_instance_id = null, cantidad = 1, inclusion = 'anchor' }, faltante) {
  return {
    requirement_id, zone_id, rol,
    bancoId: null, source_ref: null, source_type: null,
    nombre: null, linea: null, usuarios: null, w: null, d: null,
    relation_role, anchor_role, functional_group_id, instance_id: null, anchor_instance_id,
    cantidad, inclusion,
    product_status: 'NEEDS_CONFIRMATION',
    identity_status: 'MISSING', identidad: null,
    precio_lista_snapshot: null, price_status: 'SIN_PRECIO', autoridad: 'SERVIDOR',
    source: 'PENDIENTE',
    faltante,                                     // { reason, requested, ... }
  };
}

// Ancla concreta desde un producto canónico (con instance_id/group estables).
function anclaDesde(prod, rol, relation_role, { requirement_id, zone_id = null, evidence = null, ord = 0 }) {
  return construirResolucion(prod, {
    requirement_id, zone_id, rol, evidence, relation_role,
    functional_group_id: groupId(requirement_id, ord),
    instance_id: instanceId(requirement_id, ord),
    inclusion: 'anchor',
  });
}

// ---------------------------------------------------------------------------
// COMPOSICIÓN DETERMINISTA (DP, no greedy). dp[s] = mínimo nº de módulos cuya
// suma de usuarios es EXACTAMENTE s. Se elige s* ≥ n con (1) menor desperdicio,
// (2) menos módulos. Capacidad ≥ pedida, sin excedente absurdo (#7).
// ---------------------------------------------------------------------------
export function componerOperativos(n, modulos) {
  const N = Math.max(0, Math.floor(Number(n) || 0));
  if (!N) return { combo: [], total: 0, faltante: 0 };
  const us = modulos.map((m) => Number(m.usuarios) || 0).filter((u) => u > 0);
  if (!us.length) return { combo: [], total: 0, faltante: N };
  const maxU = Math.max(...us);
  const TOP = N + maxU;
  const INF = Infinity;
  const dp = new Array(TOP + 1).fill(INF);
  const from = new Array(TOP + 1).fill(-1);
  dp[0] = 0;
  for (let s = 1; s <= TOP; s++) {
    for (let i = 0; i < modulos.length; i++) {
      const u = Number(modulos[i].usuarios) || 0;
      if (u > 0 && u <= s && dp[s - u] + 1 < dp[s]) { dp[s] = dp[s - u] + 1; from[s] = i; }
    }
  }
  let best = -1;
  for (let s = N; s <= TOP; s++) {
    if (dp[s] === INF) continue;
    if (best === -1) best = s;
    else { const bw = best - N; const sw = s - N; if (sw < bw || (sw === bw && dp[s] < dp[best])) best = s; }
  }
  if (best === -1) return { combo: [], total: 0, faltante: N };
  const cuenta = new Map();
  let s = best;
  while (s > 0) { const m = modulos[from[s]]; cuenta.set(m.id, (cuenta.get(m.id) || 0) + 1); s -= Number(m.usuarios) || 0; }
  const combo = [...cuenta.entries()].map(([id, cantidad]) => ({ modulo: modulos.find((m) => m.id === id), cantidad }));
  return { combo, total: best, faltante: 0 };
}

// --- OPERATIVOS: N usuarios → módulo(s) real(es) (anclas). ---
export function resolverOperativos(nUsuarios, { linea = LINEA_DEFAULT, requirement_id = 'req:z:operativo:0', zone_id = null, evidence = null } = {}) {
  const n = Math.max(0, Math.floor(Number(nUsuarios) || 0));
  if (!n) return { resoluciones: [], faltante: 0, usuariosCubiertos: 0 };
  const modulos = modulosOperativosPorLinea(linea);
  if (!modulos.length) {
    return {
      resoluciones: [], faltante: n, usuariosCubiertos: 0,
      incompleto: { code: 'LINEA_SIN_MODULO_CANONICO', linea, disponibles: lineasOperativasDisponibles() },
    };
  }
  const orden = modulos.slice().sort((a, b) => b.usuarios - a.usuarios);
  const { combo, total, faltante } = componerOperativos(n, orden);
  // Expande cada instancia de módulo como un ancla con su propia instance_id.
  const resoluciones = [];
  let ord = 0;
  for (const { modulo, cantidad } of combo) {
    for (let k = 0; k < cantidad; k++) {
      const iid = instanceId(requirement_id, ord);
      const r = construirResolucion(modulo, {
        requirement_id, zone_id, evidence, rol: 'operativo',
        relation_role: 'ANCHOR_WORKSTATION',
        functional_group_id: groupId(requirement_id, ord),
        instance_id: iid,
        cantidad: 1,
        inclusion: 'anchor',
      });
      // P0.2c GAP10: la topología viaja desde la CONFIGURACIÓN resuelta (operativo
      // de N usuarios = bench doble, USER_CONFIRMED). Aditivo; null si no aplica.
      if (r) { const pp = placementProfileDeResolucion(r); if (pp) r.placement_profile = pp; }
      if (r) resoluciones.push(r);
      ord += 1;
    }
  }
  return { resoluciones, faltante, usuariosCubiertos: total - faltante };
}

// --- PRIVADO / CEO: escritorio directivo real, respetando lo PEDIDO (#7). ---
// req: { requirement_id, zone_id, ord, requested_models:{anchor}, requested_line, requested_dimensions }
export function resolverPrivado(req = {}) {
  const { requirement_id = 'req:z:privado:0', zone_id = null, evidence = null, ord = 0,
    requested_models = null, requested_line = null, requested_dimensions = null,
    requested_route = null, requested_product = null } = req;
  const base = { requirement_id, zone_id, evidence, ord };
  const model = requested_models && requested_models.anchor;
  if (model || requested_line || requested_dimensions) {
    // Pidieron algo específico (p.ej. "Eclipse Drift 2.10"): se busca EXACTO en
    // catálogo. Si no existe canónico → NEEDS_CONFIRMATION, jamás un dir-* en su lugar.
    const found = buscarEnColeccion(ESCRITORIOS, { model, line: requested_line, dimensions: requested_dimensions });
    if (!found.length) {
      // `route/product` = identidad de LÍNEA que pidió el intérprete (ruta/producto de
      // cotizar-texto). Viaja en el pendiente para que una partida de línea YA cotizada
      // con esa misma identidad pueda cubrirlo (cubrirPendientesConLinea), sin sustituir.
      return needsConfirm({ requirement_id, zone_id, rol: 'privado', relation_role: 'ANCHOR_DESK' },
        { reason: 'ESCRITORIO_SOLICITADO_NO_CANONICO', requested: { model, line: requested_line, dimensions: requested_dimensions, route: requested_route, product: requested_product } });
    }
    return anclaDesde(found[0], 'privado', 'ANCHOR_DESK', base);
  }
  // Sin pedido específico: directivo canónico por defecto.
  const prod = ESCRITORIOS.find((e) => /^dir-/.test(e.id))
    || ESCRITORIOS.find((e) => /directivo/i.test(e.nombre || ''))
    || ESCRITORIOS[0];
  return anclaDesde(prod, 'privado', 'ANCHOR_DESK', base);
}

// --- JUNTAS: respeta dimensiones pedidas y capacidad; nunca finge cobertura. ---
// req: { requirement_id, zone_id, ord, requested_dimensions:{w,d}, requested_line }
export function resolverJuntas(capacidad, req = {}) {
  const { requirement_id = 'req:z:juntas:0', zone_id = null, evidence = null, ord = 0,
    requested_dimensions = null, requested_line = null,
    requested_route = null, requested_product = null } = req;
  const base = { requirement_id, zone_id, evidence, ord };
  const cap = Math.max(1, Math.floor(Number(capacidad) || 0));
  const porCapacidad = JUNTAS.slice().sort((a, b) => a.usuarios - b.usuarios);

  if (requested_dimensions || requested_line) {
    // #8: respeta la medida/línea pedida. Si no existe, NEEDS_CONFIRMATION.
    const found = buscarEnColeccion(JUNTAS, { dimensions: requested_dimensions, line: requested_line });
    if (!found.length) {
      return needsConfirm({ requirement_id, zone_id, rol: 'juntas', relation_role: 'ANCHOR_MEETING' },
        { reason: 'MESA_SOLICITADA_NO_CANONICA', requested: { dimensions: requested_dimensions, line: requested_line, route: requested_route, product: requested_product } });
    }
    const mesa = found.slice().sort((a, b) => a.usuarios - b.usuarios).find((m) => m.usuarios >= cap);
    if (!mesa) {
      return needsConfirm({ requirement_id, zone_id, rol: 'juntas', relation_role: 'ANCHOR_MEETING' },
        { reason: 'DIM_NO_CUBRE_CAPACIDAD', requested: { dimensions: requested_dimensions }, capacidad: cap });
    }
    return anclaDesde(mesa, 'juntas', 'ANCHOR_MEETING', base);
  }

  // #9: sólo por capacidad. Si NINGUNA mesa cubre, NO finge con la más grande.
  const cubre = porCapacidad.find((m) => m.usuarios >= cap);
  if (!cubre) {
    const max = porCapacidad.length ? porCapacidad[porCapacidad.length - 1].usuarios : 0;
    return needsConfirm({ requirement_id, zone_id, rol: 'juntas', relation_role: 'ANCHOR_MEETING' },
      { reason: 'CAPACITY_NOT_COVERED', capacidad: cap, max });
  }
  return anclaDesde(cubre, 'juntas', 'ANCHOR_MEETING', base);
}

// --- RECEPCIÓN: módulo recepción real. ---
export function resolverRecepcion({ requirement_id = 'req:z:recepcion:0', zone_id = null, evidence = null, ord = 0 } = {}) {
  const prod = RECEPCIONES[0] || null;
  if (!prod) return needsConfirm({ requirement_id, zone_id, rol: 'recepcion', relation_role: 'ANCHOR_RECEPTION' }, { reason: 'RECEPCION_NO_CANONICA' });
  return anclaDesde(prod, 'recepcion', 'ANCHOR_RECEPTION', { requirement_id, zone_id, evidence, ord });
}

// ---------------------------------------------------------------------------
// DEPENDIENTES de un ancla ya resuelta (#2/#5/#11). Enlace por
// functional_group_id + anchor_instance_id. Asiento = mandatory_by_rule;
// guarda = optional_recommendation salvo que el brief la pida (requested).
// ---------------------------------------------------------------------------
function dependiente(prod, { ancla, relation_role, anchor_role, cantidad, inclusion }) {
  if (!prod || cantidad <= 0) return null;
  return construirResolucion(prod, {
    requirement_id: ancla.requirement_id,
    zone_id: ancla.zone_id,
    evidence: ancla.evidence,
    rol: ancla.rol,
    relation_role,
    anchor_role,                                  // tipo de ancla requerida
    functional_group_id: ancla.functional_group_id,
    anchor_instance_id: ancla.instance_id,        // instancia concreta (no bancoId)
    cantidad,
    inclusion,
  });
}

// Asiento con MODELO pedido respetado (#10): si pidieron un modelo y no existe
// canónico → NEEDS_CONFIRMATION (no se cambia por otro). El rol sólo decide dónde.
function asientoDependiente(ancla, { relation_role, anchor_role, cantidad, inclusion, requestedModel = null }) {
  const prod = asientoPara(relation_role, requestedModel);
  if (!prod) {
    if (requestedModel) {
      return needsConfirm({
        requirement_id: ancla.requirement_id, zone_id: ancla.zone_id, rol: ancla.rol,
        relation_role, anchor_role, functional_group_id: ancla.functional_group_id,
        anchor_instance_id: ancla.instance_id, cantidad, inclusion,
      }, { reason: 'ASIENTO_SOLICITADO_NO_CANONICO', requested: { model: requestedModel, relation_role } });
    }
    return null;
  }
  return dependiente(prod, { ancla, relation_role, anchor_role, cantidad, inclusion });
}

export function expandirDependientes(ancla, { capacidad = null, storageRequested = false, seatModels = {}, visitors = null } = {}) {
  if (!ancla) return [];
  const out = [];
  const push = (d) => { if (d) out.push(d); };

  if (ancla.rol === 'operativo') {
    const U = Number(ancla.usuarios) || 0;
    push(asientoDependiente(ancla, { relation_role: 'WORK_SEAT', anchor_role: 'ANCHOR_WORKSTATION', cantidad: U, inclusion: 'mandatory_by_rule', requestedModel: seatModels.work }));
    push(dependiente(guardaPara('UNDERDESK_STORAGE'), { ancla, relation_role: 'UNDERDESK_STORAGE', anchor_role: 'ANCHOR_WORKSTATION', cantidad: U, inclusion: storageRequested ? 'requested' : 'optional_recommendation' }));
  } else if (ancla.rol === 'privado') {
    push(asientoDependiente(ancla, { relation_role: 'EXECUTIVE_SEAT', anchor_role: 'ANCHOR_DESK', cantidad: 1, inclusion: 'mandatory_by_rule', requestedModel: seatModels.executive }));
    // Visitas: SÓLO si el brief las pide (no extras silenciosos).
    if (visitors && Number(visitors.cantidad) > 0) {
      push(asientoDependiente(ancla, { relation_role: 'VISITOR_SEAT', anchor_role: 'ANCHOR_DESK', cantidad: Number(visitors.cantidad), inclusion: 'requested', requestedModel: visitors.model }));
    }
  } else if (ancla.rol === 'juntas') {
    const cap = Math.max(1, Math.floor(Number(capacidad) || ancla.usuarios || 0));
    push(asientoDependiente(ancla, { relation_role: 'MEETING_SEAT', anchor_role: 'ANCHOR_MEETING', cantidad: cap, inclusion: 'mandatory_by_rule', requestedModel: seatModels.meeting }));
  }
  // recepción: sin dependientes por defecto (#11).
  return out;
}

// --- ORQUESTADOR: programa → ProgramRequirement[] + PROPUESTA. ---
// `programa`: { operativos, privados, salas:[capacidades], recepcion, brief? }.
//   brief.operativosStorage: true → gavetas pasan a 'requested' (partida comercial).
export function resolverPrograma(programa = {}, { linea = LINEA_DEFAULT } = {}) {
  const requerimientos = [];
  const anclas = [];
  const dependientes = [];
  const incompletos = [];
  const pendientes = [];        // resoluciones NEEDS_CONFIRMATION/UNRESOLVED (no comercial)
  const brief = programa.brief || {};
  const storageRequested = !!brief.operativosStorage;
  const briefPriv = Array.isArray(brief.privados) ? brief.privados : [];
  const briefJuntas = Array.isArray(brief.juntas) ? brief.juntas : [];

  // Enruta una resolución de ancla: RESUELTA → anclas+dependientes; PENDIENTE →
  // pendientes+incompletos (jamás partida comercial, jamás sustitución silenciosa).
  const integrarAncla = (r, depOpts, code) => {
    if (!r) { incompletos.push({ code }); return; }
    if (r.product_status === 'RESOLVED') {
      anclas.push(r);
      expandirDependientes(r, depOpts).forEach((d) => {
        if (d.product_status === 'RESOLVED') dependientes.push(d);
        else { pendientes.push(d); incompletos.push({ code: 'DEPENDIENTE_NEEDS_CONFIRMATION', detalle: d.faltante }); }
      });
    } else {
      pendientes.push(r);
      incompletos.push({ code: 'ANCLA_NEEDS_CONFIRMATION', rol: r.rol, detalle: r.faltante });
    }
  };

  const nOp = Math.max(0, Math.floor(Number(programa.operativos) || 0));
  if (nOp > 0) {
    const zone_id = brief.operativoZoneId || null;
    const evidence = brief.operativoEvidence || null;
    const reqId = requirementId(zone_id, 'operativo', 0);
    requerimientos.push({ requirement_id: reqId, zone_id, evidence, rol: 'operativo', anchor_role: 'ANCHOR_WORKSTATION', capacidad: nOp, preferred_line: linea });
    const op = resolverOperativos(nOp, { linea, requirement_id: reqId, zone_id, evidence });
    if (op.incompleto) incompletos.push(op.incompleto);
    op.resoluciones.forEach((ancla) => integrarAncla(ancla, { storageRequested, seatModels: { work: brief.operativoSeatModel } }, 'OPERATIVO_NO_RESUELTO'));
    if (op.faltante > 0) incompletos.push({ code: 'OPERATIVO_NO_RESUELTO', faltante: op.faltante });
  }

  const nPriv = Math.max(0, Math.floor(Number(programa.privados) || 0));
  for (let i = 0; i < nPriv; i++) {
    const b = briefPriv[i] || {};
    const zone_id = b.zone_id || null;
    const reqId = requirementId(zone_id, 'privado', i);
    requerimientos.push({ requirement_id: reqId, zone_id, evidence: b.evidence || null, rol: 'privado', anchor_role: 'ANCHOR_DESK', capacidad: 1, preferred_line: linea, ...b });
    const r = resolverPrivado({ requirement_id: reqId, zone_id, evidence: b.evidence || null, requested_models: b.requested_models, requested_line: b.requested_line, requested_dimensions: b.requested_dimensions, requested_route: b.requested_route || null, requested_product: b.requested_product || null });
    integrarAncla(r, { seatModels: { executive: b.requested_models && b.requested_models.seat }, visitors: b.requested_visitors }, 'PRIVADO_NO_RESUELTO');
  }

  const salas = Array.isArray(programa.salas) ? programa.salas : [];
  salas.forEach((cap, i) => {
    const capacidad = Number(cap) || 0;
    const b = briefJuntas[i] || {};
    const zone_id = b.zone_id || null;
    const reqId = requirementId(zone_id, 'juntas', i);
    requerimientos.push({ requirement_id: reqId, zone_id, evidence: b.evidence || null, rol: 'juntas', anchor_role: 'ANCHOR_MEETING', capacidad, preferred_line: linea, ...b });
    const r = resolverJuntas(capacidad, { requirement_id: reqId, zone_id, evidence: b.evidence || null, requested_dimensions: b.requested_dimensions, requested_line: b.requested_line, requested_route: b.requested_route || null, requested_product: b.requested_product || null });
    integrarAncla(r, { capacidad, seatModels: { meeting: b.requested_models && b.requested_models.seat } }, 'JUNTAS_NO_RESUELTO');
  });

  if (programa.recepcion) {
    const zone_id = brief.recepcionZoneId || null;
    const reqId = requirementId(zone_id, 'recepcion', 0);
    requerimientos.push({ requirement_id: reqId, zone_id, evidence: brief.recepcionEvidence || null, rol: 'recepcion', anchor_role: 'ANCHOR_RECEPTION', capacidad: 1, preferred_line: linea });
    const r = resolverRecepcion({ requirement_id: reqId, zone_id, evidence: brief.recepcionEvidence || null });
    integrarAncla(r, {}, 'RECEPCION_NO_RESUELTO');
  }

  // partidas comerciales = anclas + dependientes NO opcionales (mandatory/requested).
  const comerciales = [...anclas, ...dependientes.filter((d) => d.inclusion !== 'optional_recommendation')];
  const recomendaciones = dependientes.filter((d) => d.inclusion === 'optional_recommendation');
  const partidas = comerciales;

  // Compuertas SEPARADAS a nivel propuesta (no se mezclan).
  const productosReales = partidas.every((r) => r.product_status === 'RESOLVED');
  const identidadesValidas = partidas.every((r) => r.identity_status === 'RESOLVED');
  const preciosDisponibles = partidas.every((r) => r.price_status !== 'SIN_PRECIO');

  return {
    ok: incompletos.length === 0 && anclas.length > 0,
    requerimientos,
    resoluciones: anclas,        // anclas RESUELTAS (compat nombre)
    dependientes,                // mandatory + optional (RESUELTOS)
    recomendaciones,             // sólo optional (no entran a partidas comerciales)
    partidas,                    // propuesta comercial (anclas + mandatory/requested)
    pendientes,                  // NEEDS_CONFIRMATION/UNRESOLVED: lo pedido no existe/ no cubre
    incompletos,
    // resumen de compuertas separadas:
    productosReales,
    identidadesValidas,
    preciosDisponibles,
    cotizable: productosReales && identidadesValidas,          // puede armar cotización
    emitible: productosReales && identidadesValidas && preciosDisponibles, // servidor revalida
    // invariante anti-fantasma (producto, NO precio):
    sinSugFantasma: partidas.every((r) => r.bancoId && !String(r.bancoId).startsWith('sug-') && r.source === 'RESUELTO'),
  };
}
