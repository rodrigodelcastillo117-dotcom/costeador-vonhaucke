// ============================================================================
//  resolverPrograma · PRODUCT RESOLVER del programa (P0.1).
//  Cierra el cuello de botella: FloorSpec → ProgramRequirement → PRODUCTO REAL
//  → dependientes reales (asientos/guardas) → PROPUESTA confirmable (con
//  identidad) → ancla + grupo funcional → layout.
//
//  Problema que erradica (#102): el camino del programa fabricaba geometría con
//  `ceil(n/2)*1500` (10u → 7500) e inventaba partidas `sug-*` sin productoId ni
//  precio. Aquí NO se inventa nada: cada requerimiento se resuelve contra el
//  CATÁLOGO CANÓNICO (catalogoCanonico.js, única fuente de la regla), con
//  composición DETERMINISTA por programación dinámica para capacidades no
//  exactas (menor desperdicio, luego menos módulos — NO greedy accidental).
//  El 10u resuelve al módulo real `op-10u-6000x1200-cristal` (6000×1200), NUNCA
//  7500.
//
//  Tres compuertas separadas por resolución (nunca se mezclan):
//    · gate_product_resolved  → producto canónico con geometría real.
//    · gate_product_identity  → producto_id + producto_version_id (o null).
//    · precio_autoridad        → el precio es snapshot de DISPLAY; la autoridad
//                                es el SERVIDOR (gate_price_authority:false).
//
//  Reglas duras: solo productos canónicos; nunca `sug-*`; nunca $0; nunca
//  geometría inventada; respeta `preferred_line` (no hardcodea App LT); un
//  dependiente se enlaza a su ancla por functional_group_id + relation_role.
//  Funciones puras/testeables. Devuelve una PROPUESTA (no confirma nada).
// ============================================================================
import {
  modulosOperativosPorLinea, lineasOperativasDisponibles,
  ESCRITORIOS, JUNTAS, RECEPCIONES,
  vistaCanonica, identidadDe, autoridadPrecio, medidasAwd,
  asientoPara, guardaPara,
} from './catalogoCanonico.js';

export { medidasAwd };   // única fuente del parser de medidas

const LINEA_DEFAULT = 'App LT';

// ---------------------------------------------------------------------------
// Construye una RESOLUCIÓN (item de propuesta) con geometría real + las tres
// compuertas explícitas. Si el producto no es canónico, devuelve null.
// ---------------------------------------------------------------------------
function construirResolucion(prod, {
  requerimiento, anchor_role = null, relation_role = null,
  functional_group_id = null, anchor_ref = null, zona = null, cantidad = 1,
}) {
  if (!prod) return null;
  const vista = vistaCanonica(prod);
  if (!vista) return null;                       // no canónico → no se resuelve
  const ident = identidadDe(prod.id);            // compuerta 2
  const precioGate = autoridadPrecio(prod);      // compuerta 3
  return {
    requerimiento,
    bancoId: vista.bancoId,
    source_ref: vista.bancoId,                   // para conIdentidadV2 / confirmar
    source_type: 'banco',
    nombre: vista.nombre,
    linea: vista.linea,
    usuarios: vista.usuarios,
    w: vista.w,
    d: vista.d,
    precio: precioGate.precio_lista_snapshot,    // numérico de DISPLAY (no autoridad)
    anchor_role,
    relation_role,
    functional_group_id,
    anchor_ref,                                   // bancoId del ancla (dependientes)
    zona,
    cantidad,
    source: 'RESUELTO',                           // jamás 'SUGERIDO'/'sug-*'
    // --- COMPUERTAS (separadas y explícitas) ---
    gate_product_resolved: true,
    identidad: ident
      ? { producto_id: ident.producto_id, producto_version_id: ident.producto_version_id, lista_precio_item_id: ident.lista_precio_item_id }
      : null,
    gate_product_identity: !!ident,
    precio_autoridad: precioGate,                 // gate 3: nunca autorizado en cliente
  };
}

// ---------------------------------------------------------------------------
// COMPOSICIÓN DETERMINISTA (NO greedy). Programación dinámica:
//   dp[s] = mínimo nº de módulos cuya suma de usuarios es EXACTAMENTE s.
// Luego se elige s* ≥ n con: (1) menor desperdicio (s - n); (2) menos módulos.
// Garantiza capacidad ≥ pedida, sin excedente absurdo (#7). Para App LT, que
// tiene módulo de 1u, el desperdicio siempre es 0.
// ---------------------------------------------------------------------------
export function componerOperativos(n, modulos) {
  const N = Math.max(0, Math.floor(Number(n) || 0));
  if (!N) return { combo: [], total: 0, faltante: 0 };
  const us = modulos.map((m) => Number(m.usuarios) || 0).filter((u) => u > 0);
  if (!us.length) return { combo: [], total: 0, faltante: N };
  const maxU = Math.max(...us);
  const TOP = N + maxU;                           // techo para hallar menor excedente
  const INF = Infinity;
  const dp = new Array(TOP + 1).fill(INF);
  const from = new Array(TOP + 1).fill(-1);       // índice de módulo usado para llegar a s
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
    else {
      const bw = best - N; const sw = s - N;
      if (sw < bw || (sw === bw && dp[s] < dp[best])) best = s;
    }
  }
  if (best === -1) return { combo: [], total: 0, faltante: N };
  const cuenta = new Map();
  let s = best;
  while (s > 0) {
    const m = modulos[from[s]];
    cuenta.set(m.id, (cuenta.get(m.id) || 0) + 1);
    s -= Number(m.usuarios) || 0;
  }
  const combo = [...cuenta.entries()].map(([id, cantidad]) => ({
    modulo: modulos.find((m) => m.id === id), cantidad,
  }));
  return { combo, total: best, faltante: 0 };
}

// --- OPERATIVOS: N usuarios → módulo(s) real(es). Exacto o compuesto (DP). ---
// Devuelve SÓLO las anclas (los dependientes los expande el orquestador).
export function resolverOperativos(nUsuarios, { linea = LINEA_DEFAULT } = {}) {
  const n = Math.max(0, Math.floor(Number(nUsuarios) || 0));
  if (!n) return { resoluciones: [], faltante: 0, usuariosCubiertos: 0 };
  const modulos = modulosOperativosPorLinea(linea);
  if (!modulos.length) {
    // Respeta preferred_line: si esa línea no tiene módulo canónico, NO inventa.
    return {
      resoluciones: [], faltante: n, usuariosCubiertos: 0,
      incompleto: { code: 'LINEA_SIN_MODULO_CANONICO', linea, disponibles: lineasOperativasDisponibles() },
    };
  }
  const orden = modulos.slice().sort((a, b) => b.usuarios - a.usuarios);
  const { combo, total, faltante } = componerOperativos(n, orden);
  const resoluciones = combo.map(({ modulo, cantidad }) => construirResolucion(modulo, {
    requerimiento: 'operativo', anchor_role: 'ANCHOR_WORKSTATION', cantidad,
  })).filter(Boolean);
  return { resoluciones, faltante, usuariosCubiertos: total - faltante };
}

// --- PRIVADO / CEO: escritorio directivo real. ---
export function resolverPrivado() {
  const prod = ESCRITORIOS.find((e) => /^dir-/.test(e.id))
    || ESCRITORIOS.find((e) => /directivo/i.test(e.nombre || ''))
    || ESCRITORIOS.find((e) => /gerente/i.test(e.nombre || '') && /1800/.test(e.medidas || ''))
    || ESCRITORIOS[0];
  return construirResolucion(prod, { requerimiento: 'privado', anchor_role: 'ANCHOR_DESK', cantidad: 1 });
}

// --- JUNTAS: capacidad → mesa real con usuarios ≥ capacidad (la más chica que cubre). ---
export function resolverJuntas(capacidad) {
  const cap = Math.max(1, Math.floor(Number(capacidad) || 0));
  const porCapacidad = JUNTAS.slice().sort((a, b) => a.usuarios - b.usuarios);
  const prod = porCapacidad.find((m) => m.usuarios >= cap) || porCapacidad[porCapacidad.length - 1];
  return construirResolucion(prod, { requerimiento: 'juntas', anchor_role: 'ANCHOR_MEETING', cantidad: 1 });
}

// --- RECEPCIÓN: módulo recepción real. ---
export function resolverRecepcion() {
  const prod = RECEPCIONES[0] || null;
  return construirResolucion(prod, { requerimiento: 'recepcion', anchor_role: 'ANCHOR_RECEPTION', cantidad: 1 });
}

// ---------------------------------------------------------------------------
// DEPENDIENTES: a partir de un ancla ya resuelta, genera asientos/guardas REALES
// enlazados por functional_group_id + relation_role + anchor_ref (#2/#5).
//   · operativo  → por cada instancia del módulo: U asientos WORK_SEAT + (si
//                  conGuardas) U guardas UNDERDESK_STORAGE, un grupo por instancia.
//   · privado    → 1 asiento EXECUTIVE_SEAT (sin extras inventados, #11).
//   · juntas     → `capacidad` asientos MEETING_SEAT (los pedidos, no los de la mesa).
//   · recepción  → ninguno por defecto (si el brief no pide extras, #11).
// ---------------------------------------------------------------------------
function expandirDependientes(ancla, { capacidad = null, conGuardas = true } = {}, ctx) {
  if (!ancla) return [];
  const out = [];
  const grupo = `fg-${ancla.requerimiento}-${++ctx.seq}`;
  const liga = (prod, relation_role, cantidad) => {
    if (!prod || cantidad <= 0) return;
    const r = construirResolucion(prod, {
      requerimiento: `${ancla.requerimiento}:${relation_role}`,
      anchor_role: ancla.anchor_role,
      relation_role,
      functional_group_id: grupo,
      anchor_ref: ancla.bancoId,
      zona: ancla.zona,
      cantidad,
    });
    if (r) out.push(r);
  };

  if (ancla.requerimiento === 'operativo') {
    const U = Number(ancla.usuarios) || 0;
    liga(asientoPara('WORK_SEAT'), 'WORK_SEAT', U);
    if (conGuardas) liga(guardaPara('UNDERDESK_STORAGE'), 'UNDERDESK_STORAGE', U);
  } else if (ancla.requerimiento === 'privado') {
    liga(asientoPara('EXECUTIVE_SEAT'), 'EXECUTIVE_SEAT', 1);
  } else if (ancla.requerimiento === 'juntas') {
    const cap = Math.max(1, Math.floor(Number(capacidad) || ancla.usuarios || 0));
    liga(asientoPara('MEETING_SEAT'), 'MEETING_SEAT', cap);
  }
  // recepción: sin dependientes por defecto.
  // La misma etiqueta de grupo se estampa también en el ancla (enlace bidireccional).
  ancla.functional_group_id = grupo;
  return out;
}

// --- ORQUESTADOR: programa → ProgramRequirement[] + PROPUESTA (anclas+dependientes). ---
// `programa`: { operativos, privados, salas:[capacidades], recepcion:bool }.
// `opts`: { linea (preferred_line), operativosConGuardas }.
export function resolverPrograma(programa = {}, { linea = LINEA_DEFAULT, operativosConGuardas = true } = {}) {
  const requerimientos = [];
  const resoluciones = [];     // anclas
  const dependientes = [];     // asientos / guardas
  const incompletos = [];
  const ctx = { seq: 0 };      // grupos funcionales deterministas por llamada

  const nOp = Math.max(0, Math.floor(Number(programa.operativos) || 0));
  if (nOp > 0) {
    requerimientos.push({ rol: 'operativo', anchor_role: 'ANCHOR_WORKSTATION', capacidad: nOp, preferred_line: linea });
    const op = resolverOperativos(nOp, { linea });
    if (op.incompleto) incompletos.push(op.incompleto);
    op.resoluciones.forEach((ancla) => {
      // Una instancia de módulo = un grupo funcional + sus dependientes.
      for (let k = 0; k < (ancla.cantidad || 1); k++) {
        const inst = { ...ancla, cantidad: 1 };
        resoluciones.push(inst);
        expandirDependientes(inst, { conGuardas: operativosConGuardas }, ctx).forEach((d) => dependientes.push(d));
      }
    });
    if (op.faltante > 0) incompletos.push({ code: 'OPERATIVO_NO_RESUELTO', faltante: op.faltante });
  }

  const nPriv = Math.max(0, Math.floor(Number(programa.privados) || 0));
  for (let i = 0; i < nPriv; i++) {
    requerimientos.push({ rol: 'privado', anchor_role: 'ANCHOR_DESK', capacidad: 1, preferred_line: linea });
    const r = resolverPrivado();
    if (r) { resoluciones.push(r); expandirDependientes(r, {}, ctx).forEach((d) => dependientes.push(d)); }
    else incompletos.push({ code: 'PRIVADO_NO_RESUELTO' });
  }

  const salas = Array.isArray(programa.salas) ? programa.salas : [];
  for (const cap of salas) {
    const capacidad = Number(cap) || 0;
    requerimientos.push({ rol: 'juntas', anchor_role: 'ANCHOR_MEETING', capacidad, preferred_line: linea });
    const r = resolverJuntas(capacidad);
    if (r) { resoluciones.push(r); expandirDependientes(r, { capacidad }, ctx).forEach((d) => dependientes.push(d)); }
    else incompletos.push({ code: 'JUNTAS_NO_RESUELTO', capacidad });
  }

  if (programa.recepcion) {
    requerimientos.push({ rol: 'recepcion', anchor_role: 'ANCHOR_RECEPTION', capacidad: 1, preferred_line: linea });
    const r = resolverRecepcion();
    if (r) { resoluciones.push(r); expandirDependientes(r, {}, ctx).forEach((d) => dependientes.push(d)); }
    else incompletos.push({ code: 'RECEPCION_NO_RESUELTO' });
  }

  const partidas = [...resoluciones, ...dependientes];
  return {
    ok: incompletos.length === 0 && resoluciones.length > 0,
    requerimientos,
    resoluciones,       // anclas
    dependientes,       // asientos / guardas
    partidas,           // propuesta completa (anclas + dependientes) → confirmar
    incompletos,
    // Invariante: cada partida es un producto REAL (bancoId + precio > 0), nunca sug-*.
    todasReales: partidas.every((r) => r.bancoId && Number(r.precio) > 0 && r.source === 'RESUELTO'
      && !String(r.bancoId).startsWith('sug-')),
  };
}
