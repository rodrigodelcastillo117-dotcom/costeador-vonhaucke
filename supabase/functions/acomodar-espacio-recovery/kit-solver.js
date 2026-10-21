// ============================================================================
//  P0.2b · KIT-SOLVER (acomodar-espacio-recovery) — PENDIENTE DE ACTIVACIÓN.
//
//  Cambio conceptual: una estación (bench + sillas + gavetas) o una mesa de
//  juntas (+ sillas) NO son N rectángulos sueltos; son UNA UNIDAD ESPACIAL (kit)
//  que se compone con geometría interna del catálogo y se coloca JUNTA.
//
//  A. Asignación de dueño: cada dependiente recibe anchor_instance_id por
//     capacidad del ancla; el sobrante queda UNASSIGNED (nunca suelto).
//  B. Kits: bloque rígido; sillas en los lados correctos; gavetas BAJO el tablero
//     (solape legal con el footprint del escritorio); clearance de silla DENTRO
//     del kit. Rotación 0/90.
//  C. Solver determinista por bloques con backtracking: bloque más grande primero
//     (MRV), malla 100 mm, pegados a muro primero, pasillo ≥1000 mm ENTRE kits (no
//     dentro). Mismo input → mismo output canónico (sin telemetría).
//
//  Todo en mm. Puro (Deno + node). Reusa helpers vendorizados de ./spatial-core.js.
// ============================================================================
import { rectsSeSolapan, rectDentroPoligono, bloqueaPuertaEspacial } from './spatial-core.js';
import { perfilDeAncla, layoutDeTopologia, rotarFacing, PROFILE_VERSION, ACCESO_EJECUTIVO } from './placementProfiles.js';
import { juzgarSemantico, HARD_ACCESS_MM, QUALITY_ACCESS_TARGET_MM, STORAGE_FRONT_MIN_MM, clearanceAcceso } from './semanticPlacementJudge.js';
import { validarColocacion } from './acomodo-core.js';
import { juzgarCalidad, calidadAceptable } from './qualityJudge.js';
import { evaluarRecovery } from './recovery-core.js';

export const SEAT = 600;      // huella de silla (mm)
export const PITCH = 650;     // separación entre sillas alrededor de mesa
export const AISLE = 1000;    // pasillo mínimo ENTRE kits
export const GRID = 100;      // malla de candidatos
export const VISITAS_POR_ESCRITORIO = 2;   // sillas de visita que recibe un escritorio privado además de su ejecutivo
const MAX_MS = 2000;          // presupuesto de tiempo por caso
const MAX_NODOS = 200000;     // tope de nodos de backtracking

const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esSilla = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);
const esGaveta = (r) => ['UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);
const num = (n, def = 0) => (Number.isFinite(Number(n)) ? Number(n) : def);

// Capacidad de sillas que hospeda un ancla (determinista, del catálogo/dims).
// VH-112: capacidad declarada en el nombre ("8 usuarios") o por topología doble (cliente viejo sin user_capacity).
function capacidadDeclarada(p = {}) {
  const t = String(p.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const m = t.match(/(\d+)\s*(usuarios?|puestos?|personas?|plazas?|lugares?|users?|seats?)\b/);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
export function capacidadAncla(p = {}) {
  const w = num(p.w), d = num(p.d), m = Math.max(w, d);
  // VH-112: tope FÍSICO de asientos de un operativo: una silla de 600 mm por cara y por cada 600 mm de
  // largo (dos caras). El bench doble de catálogo 4800×1200 para 8 cabe (16 posibles); un módulo de 12
  // sobre 6 m también (20). Lo que no cabe físicamente no se sienta: antes se encimaban.
  const topeOperativo = p.relation_role === 'ANCHOR_WORKSTATION' && m > 0 ? 2 * Math.max(1, Math.floor(m / 600)) : Infinity;
  if (num(p.user_capacity) > 0) return Math.min(Math.round(num(p.user_capacity)), topeOperativo);
  const declarada = capacidadDeclarada(p);
  if (declarada) return Math.min(declarada, topeOperativo);
  const topo = p.placement_profile?.topology || p.placement_profile || null;
  switch (p.relation_role) {
    case 'ANCHOR_WORKSTATION': return Math.max(1, Math.round(m / 1500)) * (topo === 'DOUBLE_FACE' || /\b(doble|double)\b/.test(String(p.nombre || '').toLowerCase()) ? 2 : 1);
    case 'ANCHOR_DESK':        return 1;
    case 'ANCHOR_MEETING':     return Math.max(2, 2 * Math.max(1, Math.floor(w / PITCH)) + 2 * Math.max(0, Math.floor(d / PITCH)));
    case 'ANCHOR_RECEPTION':   return Math.max(1, Math.round(w / 800));   // sillas de visita en recepción
    default:                   return 0;
  }
}

// VH-120 · la MISMA capacidad con su FUENTE y su tope geométrico, para que el cliente distinga lo declarado
// (CATALOGO/USUARIO), lo leído del nombre (INFERIDA) y lo estimado por geometría (GEOMETRICA, preliminar).
// `conflicto` cuando lo declarado supera lo que cabe (una silla cada 600 mm por cara): esas personas no se
// sientan encimadas, quedan sin lugar y se reporta.
export function capacidadConFuente(p = {}) {
  const w = num(p.w), d = num(p.d), m = Math.max(w, d);
  const topeGeometrico = p.relation_role === 'ANCHOR_WORKSTATION' && m > 0 ? 2 * Math.max(1, Math.floor(m / 600)) : null;
  const explicita = num(p.user_capacity) > 0 ? Math.round(num(p.user_capacity)) : null;
  const delNombre = explicita == null ? capacidadDeclarada(p) : null;
  const declarada = explicita ?? delNombre;
  const fuente = declarada == null ? 'GEOMETRICA'
    : (['CATALOGO', 'USUARIO', 'INFERIDA'].includes(p.capacity_source) ? p.capacity_source
      : (explicita != null && !p.user_capacity_inferida ? 'DECLARADA' : 'INFERIDA'));
  const usada = capacidadAncla(p);
  const conflicto = declarada != null && topeGeometrico != null && declarada > topeGeometrico ? 'CAPACIDAD_SUPERA_GEOMETRIA'
    : (declarada == null && esAncla(p.relation_role) && p.relation_role !== 'ANCHOR_DESK' ? 'CAPACIDAD_ESTIMADA' : null);
  return { capacidad: usada, declarada, fuente, tope_geometrico: topeGeometrico, preliminar: fuente === 'GEOMETRICA', conflicto };
}

// --- A · ASIGNACIÓN DE DUEÑO -------------------------------------------------
export function asignarDuenos(piezas = []) {
  const grupos = new Map();
  for (const p of piezas) {
    const g = p.functional_group_id || `__solo_${p.id}`;
    if (!grupos.has(g)) grupos.set(g, { anclas: [], deps: [] });
    (esAncla(p.relation_role) ? grupos.get(g).anclas : grupos.get(g).deps).push(p);
  }
  const out = piezas.map((p) => ({ ...p }));
  const byId = new Map(out.map((p) => [String(p.id), p]));
  const unassigned = [];
  const porId = (id) => byId.get(String(id));
  const sortId = (a, b) => (String(a.id) < String(b.id) ? -1 : 1);

  // VH-092 (2026-10-12): ANCLAS de todos los grupos, para adoptar dependientes HUÉRFANOS
  // (silla/gaveta sin ancla en su grupo) en un ancla compatible con cupo libre. Antes una
  // silla que describió la persona sin metadata moría como "sin un mueble que la reciba"
  // aunque hubiera un escritorio con lugar al lado.
  const todasAnclas = [];
  const huerfanos = [];
  // Sólo sillas y gavetas rodantes se adoptan (caben en el kit de su mueble). Una guarda de
  // piso (credenza/archivero: SUPPORT_STORAGE) NO va bajo ninguna cubierta: es pieza SUELTA
  // con su propia huella (abajo, `standalone`). Visita sólo junto a un escritorio privado,
  // igual que el validador semántico del cliente.
  const anclaDe = (rolDep) => ({
    WORK_SEAT: ['ANCHOR_WORKSTATION', 'ANCHOR_RECEPTION'], EXECUTIVE_SEAT: ['ANCHOR_DESK'], VISITOR_SEAT: ['ANCHOR_DESK', 'ANCHOR_RECEPTION'],
    MEETING_SEAT: ['ANCHOR_MEETING'], UNDERDESK_STORAGE: ['ANCHOR_WORKSTATION', 'ANCHOR_DESK'],
  })[rolDep] || [];

  // Guardas de piso: siempre SUELTAS (kit propio sin sillas), nunca bajo cubierta.
  for (const p of out) if (p.relation_role === 'SUPPORT_STORAGE') { p.standalone = true; p.anchor_instance_id = null; }
  // VH-120: cada ancla sale con su capacidad resuelta, su FUENTE y su tope geométrico (aditivo, serializable).
  for (const p of out) if (esAncla(p.relation_role)) { const c = capacidadConFuente(p); p.capacidad = { usada: c.capacidad, declarada: c.declarada, fuente: c.fuente, tope_geometrico: c.tope_geometrico, preliminar: c.preliminar, conflicto: c.conflicto }; }
  for (const [, { anclas, deps: deps0 }] of grupos) {
    const deps = deps0.filter((d) => d.relation_role !== 'SUPPORT_STORAGE');
    if (!anclas.length) { for (const d of deps) { porId(d.id).anchor_instance_id = null; huerfanos.push(d); } continue; }
    // VISITAS: un escritorio privado recibe su ejecutivo (cap) MÁS hasta 2 sillas de visita al
    // frente; antes competían por el mismo cupo de 1 y la visita siempre quedaba "sin mueble".
    const an = anclas.slice().sort(sortId).map((a) => ({ id: String(a.id), cap: capacidadAncla(a), seats: 0, gav: 0, vis: 0, visCap: a.relation_role === 'ANCHOR_DESK' ? VISITAS_POR_ESCRITORIO : a.relation_role === 'ANCHOR_RECEPTION' ? capacidadAncla(a) : 0, rol: a.relation_role }));
    const sillas = deps.filter((d) => esSilla(d.relation_role)).sort(sortId);
    const gavetas = deps.filter((d) => esGaveta(d.relation_role)).sort(sortId);
    for (const s of sillas) {
      if (s.relation_role === 'VISITOR_SEAT') {
        const a = an.find((x) => x.vis < x.visCap);
        if (a) { porId(s.id).anchor_instance_id = a.id; a.vis++; } else { porId(s.id).anchor_instance_id = null; huerfanos.push(s); }
        continue;
      }
      const a = an.find((x) => x.seats < x.cap) || an[0];
      if (a && a.seats < a.cap) { porId(s.id).anchor_instance_id = a.id; a.seats++; } else { porId(s.id).anchor_instance_id = null; huerfanos.push(s); }
    }
    for (const gv of gavetas) {
      const a = an.find((x) => x.gav < x.cap) || an[0];
      if (a && a.gav < a.cap) { porId(gv.id).anchor_instance_id = a.id; a.gav++; } else { porId(gv.id).anchor_instance_id = null; huerfanos.push(gv); }
    }
    todasAnclas.push(...an);
  }
  // Adopción: ancla compatible (por rol) con cupo, en orden determinista; misma zona primero.
  for (const d of huerfanos.sort(sortId)) {
    const roles = anclaDe(d.relation_role);
    const zonaDep = d.zone_id != null ? String(d.zone_id) : null;
    const cands = todasAnclas.filter((x) => roles.includes(x.rol));
    const esVis = d.relation_role === 'VISITOR_SEAT';
    const libre = (x) => (esVis ? x.vis < x.visCap : esSilla(d.relation_role) ? x.seats < x.cap : x.gav < x.cap);
    const a = cands.find((x) => libre(x) && zonaDep && String(porId(x.id)?.zone_id ?? '') === zonaDep) || cands.find(libre);
    if (a) { porId(d.id).anchor_instance_id = a.id; porId(d.id).adoptado_por = a.id; if (esVis) a.vis++; else if (esSilla(d.relation_role)) a.seats++; else a.gav++; }
    else unassigned.push(String(d.id));
  }
  return { piezas: out, unassigned };
}

// Posiciones de sillas alrededor de una mesa w×d colocada en (SEAT,SEAT) dentro
// de un kit (w+2SEAT)×(d+2SEAT). Llena lados largos primero, luego cortos.
function perimetroSillas(w, d, n) {
  const pos = [];
  const nTop = Math.max(0, Math.floor(w / PITCH));
  const nSide = Math.max(0, Math.floor(d / PITCH));
  const push = (lado, count) => {
    for (let i = 0; i < count && pos.length < n; i++) {
      if (lado === 'top')    pos.push({ x: SEAT + i * PITCH, y: 0 });
      if (lado === 'bottom') pos.push({ x: SEAT + i * PITCH, y: SEAT + d });
      if (lado === 'left')   pos.push({ x: 0, y: SEAT + i * PITCH });
      if (lado === 'right')  pos.push({ x: SEAT + w, y: SEAT + i * PITCH });
    }
  };
  push('top', nTop); push('bottom', nTop); push('left', nSide); push('right', nSide);
  return pos.slice(0, n);
}

// --- B · COMPOSICIÓN DE KIT (coords locales; origen top-left) ----------------
// P0.2c: la distribución de sillas depende de la TOPOLOGÍA del perfil del ancla
// (SINGLE_FACE / DOUBLE_FACE / MEETING_TABLE / DESK / RECEPTION), no de la geometría
// a secas. Cada silla cae en un SLOT (slot_id/side/facing). La topología NO se
// infiere de la capacidad: DOUBLE_FACE sólo si el ancla la declara.
export function componerKit(anchor, sillas = [], gavetas = []) {
  const aw = num(anchor.w, 1200), ad = num(anchor.d, 600);
  const rol = anchor.relation_role;
  const perfil = perfilDeAncla(anchor);
  // GAP4: topología UNKNOWN NO es verdad; la geometría usa el fallback LEGACY, pero
  // el ancla conserva la topología REAL (UNKNOWN) para que el Semantic Judge lo marque.
  const topoGeom = perfil.topology !== 'UNKNOWN' ? perfil.topology : 'SINGLE_FACE';
  // VH-112: tope FÍSICO de lugares por cara (una silla de 600 mm cada 600 mm). Con topología desconocida
  // (una cara) y 12 sillas en 6 m, antes se repartían a 500 mm y salían encimadas; lo que no cabe queda
  // sin colocar y se reporta, no se encima.
  const caras = topoGeom === 'DOUBLE_FACE' ? 2 : (topoGeom === 'SINGLE_FACE' ? 1 : 0);
  const topeFisico = caras ? caras * Math.max(1, Math.floor(aw / SEAT)) : Infinity;
  // VH-119: en un escritorio el ejecutivo va primero (slot BACK) y las visitas después (FRONT).
  const ordenadas = topoGeom === 'DESK' ? [...sillas.filter((s) => s.relation_role === 'EXECUTIVE_SEAT'), ...sillas.filter((s) => s.relation_role !== 'EXECUTIVE_SEAT')] : sillas;
  const lay = layoutDeTopologia(topoGeom, aw, ad, Math.min(ordenadas.length, topeFisico), ordenadas.map((s) => s.relation_role));
  // 027c: un ancla STORAGE lleva `facing` (su frente de acceso), igual que una silla.
  const piezas = [{ id: String(anchor.id), dx: lay.anchor.dx, dy: lay.anchor.dy, w: aw, d: ad, rol, facing: lay.anchor.facing || undefined, topology: perfil.topology, provenance: perfil.provenance, profile_version: perfil.version, fallback_layout: perfil.topology === 'UNKNOWN' ? (perfil.fallback_layout_strategy || 'LEGACY_SINGLE_FACE') : null }];
  const sinColocar = [];

  ordenadas.forEach((s, i) => {
    const slot = lay.seats[i];
    if (slot) piezas.push({ id: String(s.id), dx: slot.dx, dy: slot.dy, w: SEAT, d: SEAT, rol: s.relation_role, slot_id: slot.slot_id, side: slot.side, facing: slot.facing });
    else sinColocar.push(String(s.id));
  });
  gavetas.forEach((g, i) => {
    const gw = num(g.w, 400), gd = num(g.d, 500);
    piezas.push({ id: String(g.id), dx: lay.anchor.dx + Math.min(Math.max(0, aw - gw), i * (gw + 50)), dy: lay.anchor.dy + Math.max(0, ad - gd), w: gw, d: gd, rol: g.relation_role, bajoTablero: true, slot_id: `storage_${i + 1}` });
  });
  // VH-119b: la franja de acceso del ejecutivo (DESK, arriba del kit) es CIRCULACIÓN, no mueble: el pasillo
  // de 1 m entre kits se mide desde la silla, no desde la franja (una credenza detrás del ejecutivo es lo normal).
  const accesoLado = topoGeom === 'DESK' && lay.anchor.dy >= ACCESO_EJECUTIVO ? 'top' : null;
  return { anchorId: String(anchor.id), w: lay.kitW, d: lay.kitD, piezas, sinColocar, accesoLado };
}

// Rota un kit 90° (intercambia dims; gira coords internas).
function rotarKit(kit) {
  return {
    anchorId: kit.anchorId, w: kit.d, d: kit.w, sinColocar: kit.sinColocar,
    // (x,y)→(H-(y+h), x): la franja de arriba queda a la DERECHA del kit girado.
    accesoLado: kit.accesoLado === 'top' ? 'right' : (kit.accesoLado === 'right' ? 'bottom' : (kit.accesoLado === 'bottom' ? 'left' : (kit.accesoLado === 'left' ? 'top' : null))),
    // Conserva metadata semántica y ROTA el facing cardinal (GAP3). `side` semántico
    // (A/B/HEAD_A/HEAD_B/FRONT) se conserva; `facing` absoluto gira con el bloque.
    piezas: kit.piezas.map((p) => ({ id: p.id, rol: p.rol, bajoTablero: p.bajoTablero, w: p.d, d: p.w, dx: kit.d - (p.dy + p.d), dy: p.dx, slot_id: p.slot_id, side: p.side, facing: rotarFacing(p.facing, 90), topology: p.topology, provenance: p.provenance, profile_version: p.profile_version, fallback_layout: p.fallback_layout })),
  };
}

// COT-P0-027b (banco: dif05/dif08) · VARIANTES DE ORIENTACIÓN 0/90/180/270.
// Con sólo 0/90, dos filas de bench SINGLE_FACE en un cuarto de 4600 mm obligaban a
// la segunda fila a dejar sus sillas contra el muro (ahora ilegal por acceso) aunque
// la solución física es obvia: girar la segunda fila 180° (sillas hacia el pasillo,
// benches enfrentados). 180/270 son el MISMO rectángulo que 0/90 con el layout interno
// espejado; se emite `rot` 0/90 (lo que los validadores interpretan para dimensiones)
// y `kit_rot` 0/90/180/270 como metadato; la orientación de cada silla viaja en
// `facing` (ya rotado), que es lo que el juez semántico evalúa. Variantes
// geométricamente idénticas (bench DOUBLE_FACE girado 180°) se deduplican.
function variantesDe(k) {
  const r90 = rotarKit(k), r180 = rotarKit(r90), r270 = rotarKit(r180);
  const out = [], vistos = new Set();
  for (const [kk, rot] of [[k, 0], [r90, 90], [r180, 180], [r270, 270]]) {
    const sig = JSON.stringify(kk.piezas.map((p) => [p.rol, p.dx, p.dy, p.w, p.d, p.facing ?? null, !!p.bajoTablero]).sort());
    if (vistos.has(sig)) continue;
    vistos.add(sig); out.push({ k: kk, rot });
  }
  return out;
}

// --- zona destino de un kit --------------------------------------------------
const nz = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
const TIPO_DE_ROL = { ANCHOR_WORKSTATION: 'open', ANCHOR_DESK: 'privado', ANCHOR_MEETING: 'juntas', ANCHOR_RECEPTION: 'recepcion' };
function areasPermitidas(anchorPieza, areas) {
  const zid = anchorPieza?.zone_id;
  if (zid != null) {
    const i = areas.findIndex((a) => nz(a?.zone_id ?? a?.nombre) === nz(zid));
    if (i >= 0) return [i];
  }
  const tipo = TIPO_DE_ROL[anchorPieza?.relation_role];
  const porTipo = areas.map((a, i) => ({ a, i })).filter(({ a }) => !tipo || nz(a?.tipo) === nz(tipo)).map(({ i }) => i);
  return porTipo.length ? porTipo : areas.map((_, i) => i);
}

// Rect de un kit SIN su franja de acceso (para medir el pasillo entre kits). VH-119b.
function rectPasillo(x, y, kw, kh, accesoLado) {
  const a = ACCESO_EJECUTIVO;
  if (accesoLado === 'top') return { x, y: y + a, w: kw, d: Math.max(0, kh - a) };
  if (accesoLado === 'bottom') return { x, y, w: kw, d: Math.max(0, kh - a) };
  if (accesoLado === 'left') return { x: x + a, y, w: Math.max(0, kw - a), d: kh };
  if (accesoLado === 'right') return { x, y, w: Math.max(0, kw - a), d: kh };
  return { x, y, w: kw, d: kh };
}
// --- COT-P0-027b · ACCESO DE SILLAS: invariante DURO compartido con el juez ------
// Una silla cuyo lado de acceso (opuesto a su facing) queda a ≤ HARD_ACCESS_MM de un
// muro u obstáculo es INUTILIZABLE (el juez la marca ACTIVE_SIDE_BLOCKED_BY_WALL/
// OBSTACLE → FAIL). Causa demostrada (E2E Torre Sur 15:17Z, 3 rutas): el conjunto
// legal del solver aceptaba kits pegados al muro por el lado activo; las 4 estrategias
// que colocaban 22/22 caían en FAIL semántico y ganaba `center` con 15/22 PASS
// (GAP18). Ahora el MISMO umbral y la MISMA geometría del juez (clearanceAcceso)
// forman parte del conjunto legal: GAP19 aplicado al acceso. No es un margen nuevo
// ni una excepción por caso; es el invariante que ya decidía la publicación.
// 027c: el FRENTE de un ancla STORAGE (puertas/cajones) es un lado de acceso más.
const conAcceso = (p) => !!p.facing && (esSilla(p.rol) || p.topology === 'STORAGE');
function accesoBloqueado(k, x, y, area) {
  for (const p of (k.piezas || [])) {
    if (!conAcceso(p)) continue;
    const { clear } = clearanceAcceso({ x: x + p.dx, y: y + p.dy, w: p.w, d: p.d }, p.facing, area);
    // silla: inutilizable pegada (≤ HARD_ACCESS_MM). Guardado: su frente necesita abrir (STORAGE_FRONT_MIN_MM).
    if (p.topology === 'STORAGE' ? clear < STORAGE_FRONT_MIN_MM : clear <= HARD_ACCESS_MM) return true;
  }
  return false;
}
// Holgura MÍNIMA de acceso de las sillas del kit en (x,y), topada al objetivo de
// confort (QUALITY_ACCESS_TARGET_MM). Infinity si el kit no tiene sillas.
function holguraAcceso(k, x, y, area) {
  let min = Infinity;
  for (const p of (k.piezas || [])) {
    if (!conAcceso(p)) continue;
    const { clear } = clearanceAcceso({ x: x + p.dx, y: y + p.dy, w: p.w, d: p.d }, p.facing, area);
    if (clear < min) min = clear;
  }
  return Math.min(QUALITY_ACCESS_TARGET_MM, min);
}

// --- COT-P1-027c · GUARDADO ADOSADO --------------------------------------------------
// El pasillo de 1 m entre kits protege CIRCULACIÓN y FRENTES DE USO. Entre dos muebles de
// guardado sin asientos puestos lado a lado (ninguno en el frente del otro) no hay
// circulación que proteger: una credenza y un archivero sobre el mismo muro van ADOSADOS,
// como en cualquier oficina. Se aplica EXACTAMENTE el contrato del validador duro
// (recovery-core · invariantesCirculacion): sobre el eje en que se enfrentan, el hueco es 0
// (adosados) o ≥ pasillo; y además el FRENTE de cada uno conserva su metro libre. No se
// reduce ningún pasillo: se deja de exigir uno donde nadie camina. Con cualquier otro kit
// (escritorio, bench, mesa) la regla de 1 m no cambia.
function guardadoDe(k, x, y) {
  const piezas = k.piezas || [];
  if (piezas.some((p) => esSilla(p.rol))) return null;
  const g = piezas.find((p) => p.topology === 'STORAGE' && p.facing);
  if (!g) return null;
  const r = { x: x + g.dx, y: y + g.dy, w: g.w, d: g.d };
  // misma convención que clearanceAcceso: el lado de acceso es el OPUESTO al facing.
  const frente = g.facing === 'UP' ? { x: r.x, y: r.y + r.d, w: r.w, d: AISLE }
    : g.facing === 'DOWN' ? { x: r.x, y: r.y - AISLE, w: r.w, d: AISLE }
    : g.facing === 'LEFT' ? { x: r.x + r.w, y: r.y, w: AISLE, d: r.d }
    : { x: r.x - AISLE, y: r.y, w: AISLE, d: r.d };
  return { frente };
}
// Hueco entre dos rects con el criterio del validador duro: sólo cuenta si se enfrentan
// sobre UN eje (se traslapan en el otro); en diagonal no hay pasillo que medir.
function huecoEnfrentado(a, b) {
  const sy = a.y < b.y + b.d && a.y + a.d > b.y, sx = a.x < b.x + b.w && a.x + a.w > b.x;
  if (sy && !sx) return a.x < b.x ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
  if (sx && !sy) return a.y < b.y ? b.y - (a.y + a.d) : a.y - (b.y + b.d);
  return null;
}

// ¿Cabe el kit k ({w,d,piezas}) en (x,y)? Pasillo entre kits vs `ocupados`. El acceso de
// las sillas (027b) se evalúa ANTES de otros kits: es una propiedad del kit vs el cuarto.
// Se separa en dos mitades para que la búsqueda completa calcule UNA vez, por kit y cuarto, qué
// posiciones admite el cuarto (muros, contorno, columnas, puertas, acceso) y sólo combine ésas.
// kitCabe = estático || dinámico: mismo orden de comprobación y mismo resultado que antes.
// Contador de evaluaciones estáticas REALES (sin caché): mide el trabajo de forma determinista para las pruebas de
// rendimiento (un tope en ms es frágil en CI/Vercel con pruebas en paralelo). Sólo se incrementa; no altera nada.
export const metricasSolver = { estaticos: 0 };
function motivoEstatico(x, y, k, area) {
  metricasSolver.estaticos++;
  const kw = k.w, kh = k.d;
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  if (x < 0 || y < 0 || x + kw > W + 1 || y + kh > H + 1) return 'OUT_OF_BOUNDS';
  const rect = { x, y, w: kw, d: kh };
  if (Array.isArray(area.poly) && area.poly.length >= 3 && !rectDentroPoligono(rect, area.poly)) return 'OUT_OF_POLYGON';
  for (const o of (area.obstaculos || [])) if (rectsSeSolapan(rect, { x: num(o.x), y: num(o.y), w: num(o.w), d: num(o.h) })) return 'OBSTACLE';
  for (const p of (area.puertas || [])) if (bloqueaPuertaEspacial(rect, p)) return 'DOOR';
  if (accesoBloqueado(k, x, y, area)) return 'ACCESS';
  return null;
}
function kitCabe(x, y, k, area, ocupados) {
  return motivoEstatico(x, y, k, area) || motivoDinamico(x, y, k, ocupados);
}
function motivoDinamico(x, y, k, ocupados) {
  const kw = k.w, kh = k.d, accesoLado = k.accesoLado || null;   // VH-119b: la franja de acceso viaja con el kit
  const rect = { x, y, w: kw, d: kh };
  const pas = rectPasillo(x, y, kw, kh, accesoLado);
  const guardado = guardadoDe(k, x, y);
  for (const oc of ocupados) {
    if (rectsSeSolapan(rect, oc)) return 'OVERLAP';
    if (guardado && oc.guardado) {
      // 027c: guardado–guardado → frentes libres y hueco 0 (adosados) o ≥ pasillo.
      if (rectsSeSolapan(guardado.frente, oc) || rectsSeSolapan(oc.guardado.frente, rect)) return 'AISLE';
      const h = huecoEnfrentado(rect, oc);
      if (h != null && h > 0 && h < AISLE) return 'AISLE';
      continue;
    }
    // Pasillo: entre los rects SIN franja de acceso (la franja es piso libre; no se encima, pero no suma pasillo).
    if (rectsSeSolapan({ x: pas.x - AISLE, y: pas.y - AISLE, w: pas.w + 2 * AISLE, d: pas.d + 2 * AISLE }, oc.pasillo || oc)) return 'AISLE';
  }
  return null;
}

// orden === undefined → barrido ROW-MAJOR original (comportamiento por defecto
// BYTE-IDÉNTICO; el banco congelado depende de esto). Las demás estrategias son
// PERMUTACIONES del MISMO conjunto de candidatos (no "interior-first"): mismo set
// legal, distinto orden de primer-ajuste, para que BLOCK 5 explore alternativas
// sin cambiar qué posiciones son válidas.
function candidatos(area, k, orden, deadline) {
  const kw = k.w, kh = k.d;
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  const out = [];
  // GAP35.B/GAP37: la materialización respeta el deadline con un CONTADOR INDEPENDIENTE
  // en el loop INTERNO (no atado al boundary de fila `y`), de modo que una malla grande
  // no construye millones de candidatos sin poder cortar. Sin deadline → build completo
  // (camino por defecto byte-idéntico; el banco usa áreas chicas y es instantáneo).
  let n = 0, corte = false;
  for (let y = 0; y + kh <= H + 1 && !corte; y += GRID) {
    for (let x = 0; x + kw <= W + 1; x += GRID) {
      if (deadline && (++n & 4095) === 0 && Date.now() >= deadline) { corte = true; break; }
      out.push({ x, y });
    }
  }
  if (!orden || orden === 'row') return out;                                  // DEFAULT: intacto
  if (orden === 'reverse') return out.slice().reverse();
  if (orden === 'col') return out.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
  if (orden === 'colReverse') return out.slice().sort((a, b) => (b.x - a.x) || (b.y - a.y));
  if (orden === 'center') {
    // Candidato ACCESO-CONSCIENTE (uno más a juzgar, NO el orden por defecto):
    // prueba primero las posiciones con MÁS margen a los muros, para que los
    // lados activos tengan holgura. Sólo gana si el juez semántico/calidad lo
    // confirma; en empate pierde contra #0. Determinista (desempata por x,y).
    const cx = (W - kw) / 2, cy = (H - kh) / 2;
    return out.slice().sort((a, b) => {
      const da = Math.max(Math.abs(a.x - cx), Math.abs(a.y - cy));
      const db = Math.max(Math.abs(b.x - cx), Math.abs(b.y - cy));
      return (da - db) || (a.x - b.x) || (a.y - b.y);
    });
  }
  if (orden === 'access') {
    // COT-P0-027b · Candidato ACCESO-PRIMERO: prueba antes las posiciones donde la
    // silla con MENOS holgura de acceso tiene más (topada al objetivo de confort
    // 600 mm, para no premiar más allá de lo útil). Determinista (desempate x,y).
    // Un kit sin sillas (guardado, recepción) cae al orden row.
    const h = new Map(out.map((c) => [c, holguraAcceso(k, c.x, c.y, area)]));
    return out.slice().sort((a, b) => (h.get(b) - h.get(a)) || (a.x - b.x) || (a.y - b.y));
  }
  return out;
}

const round1 = (n) => Math.round(num(n) * 10) / 10;
const DIAG_MAX_MS = 1500;   // GAP17.6: presupuesto de DIAGNÓSTICO, independiente del solver

// --- GAP17 · CERTIFICADO DE FALLO (INSTRUMENTACIÓN PURA) ---------------------
// SÓLO describe por qué un kit no se colocó. NO cambia el orden de candidatos,
// las variantes, el backtracking, la decisión PASS/FAIL ni las colocaciones:
// corre DESPUÉS de la búsqueda y es read-only. La causa se prueba por CONTRAFÁCTICO
// (qué restricción, al quitarla, permite colocar), con BOUNDS y POLYGON separados,
// POR ÁREA (sin sumar superficies desconectadas) y con presupuesto de diagnóstico
// PROPIO: si el sondeo no alcanza a probar → REVIEW (nunca imposibilidad falsa).

// Sonda contrafáctica: ¿cabe el kit k en el área (VACÍA de otros kits) quitando las
// capas indicadas? ignore.{poly,doors,obstacles,access} aíslan cada restricción.
function sondearCabida(k, area, ignore, deadline) {
  const a = { ...area };
  if (ignore.doors) a.puertas = [];
  if (ignore.obstacles) a.obstaculos = [];
  if (ignore.poly) { a.poly = undefined; a.polygon = undefined; }
  const kk = ignore.access ? { w: k.w, d: k.d, piezas: [], accesoLado: k.accesoLado || null } : k;   // sin sillas → sin invariante de acceso
  for (const c of candidatos(a, kk)) {
    if (Date.now() > deadline) return 'TIMEOUT';
    if (kitCabe(c.x, c.y, kk, a, []) === null) return true;   // ocupados = [] (sin otros kits)
  }
  return false;
}

// Diagnóstico de un variante (full o min) en UNA área: capas BOUNDS/POLYGON y
// contrafácticos FULL / NO_DOORS / NO_OBSTACLES / NO_ACCESS separados.
function diagnosticarEnArea(variantes, area, deadline) {
  let timeout = false;
  const anyOrient = (ignore) => {
    for (const v of variantes) {
      const r = sondearCabida(v.k, area, ignore, deadline);
      if (r === 'TIMEOUT') { timeout = true; return false; }
      if (r === true) return true;
    }
    return false;
  };
  const fitsBounds   = anyOrient({ poly: true, doors: true, obstacles: true, access: true });    // sólo límites
  const fitsPolygon  = anyOrient({ poly: false, doors: true, obstacles: true, access: true });   // límites + contorno
  const fitsNoDoors  = anyOrient({ poly: false, doors: true, obstacles: false, access: false }); // sin puertas, CON obstáculos y acceso
  const fitsNoObst   = anyOrient({ poly: false, doors: false, obstacles: true, access: false }); // CON puertas, sin obstáculos
  const fitsNoAccess = anyOrient({ poly: false, doors: false, obstacles: false, access: true }); // 027b: CON puertas/obstáculos, sin acceso
  const fitsFull     = anyOrient({ poly: false, doors: false, obstacles: false, access: false });// todo
  return { fitsBounds, fitsPolygon, fitsNoDoors, fitsNoObst, fitsNoAccess, fitsFull, timeout };
}

// Causa PROBADA en un área donde el kit NO cabe lleno (y SÍ cabe en bounds).
function causaEnArea(dx, needM2, areaM2, moduloLong, moduloShort, areaLong, areaShort) {
  if (!dx.fitsBounds) {
    const causas = [];
    if (moduloLong > areaLong + 1e-6 || moduloShort > areaShort + 1e-6) causas.push('ASPECT_RATIO');
    if (needM2 > areaM2 + 1e-6) causas.push('NO_SPACE');            // ESTA área (no suma) es muy chica
    return causas.length ? causas : ['ASPECT_RATIO'];
  }
  if (!dx.fitsPolygon) return ['OUT_OF_POLYGON'];                   // bounds sí, contorno no
  // fitsPolygon && !fitsFull → puerta / obstáculo / acceso (contrafáctico: quitar UNA capa lo arregla)
  const causas = [];
  if (dx.fitsNoDoors) causas.push('DOOR');                          // quitar puertas lo arregla
  if (dx.fitsNoObst) causas.push('OBSTACLE');                       // quitar obstáculos lo arregla
  if (dx.fitsNoAccess) causas.push('ACCESS');                       // 027b: sin exigir acceso cabría (sillas al muro)
  return causas.length ? causas : ['DOOR', 'OBSTACLE', 'ACCESS'];   // interacción de capas
}

// COT-P0-027b (Parte XI §3) · VEREDICTO de búsqueda — tres estados NO equivalentes:
//   NO_CABE_DEMOSTRADO       · restricción física probada (sondeo exhaustivo) o búsqueda
//                              conjunta EXHAUSTIVA sin solución (dentro del modelo: malla
//                              100 mm, rot 0/90, pasillo 1000, acceso > HARD_ACCESS_MM).
//   NO_SE_ENCONTRO_SOLUCION  · el solver agotó su presupuesto sin demostrar imposibilidad.
//   INFORMACION_INSUFICIENTE · faltan dimensiones del cuarto o de alguna pieza del kit.
function veredictoDe(kit, areas, { primary_cause, proven, budgetExhausted, busqueda }) {
  const areasSinDims = kit.zonas.some((ai) => { const a = areas[ai] || {}; return !(num(a.ancho) || num(a.width_mm)) || !(num(a.largo) || num(a.depth_mm)); });
  if (areasSinDims || kit.dimsFaltantes) return 'INFORMACION_INSUFICIENTE';
  if (primary_cause === 'SEARCH_BUDGET_EXHAUSTED' || primary_cause === 'DIAGNOSTIC_BUDGET_EXHAUSTED' || budgetExhausted) return 'NO_SE_ENCONTRO_SOLUCION';
  // la exhaustividad se mira en el COMPONENTE (cuarto) de este kit, no en el proyecto entero.
  const b = (busqueda && busqueda.por_ancla && busqueda.por_ancla[kit.anchorId]) || busqueda;
  if (primary_cause === 'INTER_KIT_CONSTRAINT') return b && b.exhaustiva ? 'NO_CABE_DEMOSTRADO' : 'NO_SE_ENCONTRO_SOLUCION';
  return proven ? 'NO_CABE_DEMOSTRADO' : 'NO_SE_ENCONTRO_SOLUCION';
}

export function certificarKit(kit, areas, { budgetExhausted, nodos, deadline: extDeadline, busqueda, puertaCF } = {}) {
  // GAP35.C: el diagnóstico respeta el deadline GLOBAL del multi si es más estricto
  // que su propio presupuesto (DIAG_MAX_MS). Nunca lo excede.
  const deadline = Number.isFinite(extDeadline) ? Math.min(Date.now() + DIAG_MAX_MS, extDeadline) : Date.now() + DIAG_MAX_MS;
  const variantesFull = variantesDe(kit.base).map((v) => ({ rot: v.rot, w: v.k.w, d: v.k.d, k: v.k }));
  const needM2 = (kit.base.w * kit.base.d) / 1e6;
  const moduloW_m = kit.base.w / 1000, moduloH_m = kit.base.d / 1000;
  const moduloLong = Math.max(moduloW_m, moduloH_m), moduloShort = Math.min(moduloW_m, moduloH_m);

  // Diagnóstico POR ÁREA (sin sumar superficies desconectadas).
  const permitted_areas = kit.zonas.map((ai) => {
    const area = areas[ai];
    const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
    const dx = diagnosticarEnArea(variantesFull, area, deadline);
    const areaM2 = round1((W * H) / 1e6);
    const causas = dx.fitsFull ? [] : causaEnArea(dx, needM2, areaM2, moduloLong, moduloShort, round1(Math.max(W, H) / 1000), round1(Math.min(W, H) / 1000));
    return {
      zone: area.zone_id ?? area.nombre ?? `area_${ai}`, area_idx: ai,
      areaW_m: round1(W / 1000), areaH_m: round1(H / 1000), areaM2,
      fits_bounds: dx.fitsBounds, fits_polygon: dx.fitsPolygon, fits_full: dx.fitsFull,
      counterfactual: { no_doors: dx.fitsNoDoors, no_obstacles: dx.fitsNoObst },
      causas, timeout: dx.timeout,
    };
  });

  const anyTimeout = permitted_areas.some((a) => a.timeout);
  const anyFitsBounds = permitted_areas.some((a) => a.fits_bounds);
  const anyFitsPolygon = permitted_areas.some((a) => a.fits_polygon);
  const anyFitsFull = permitted_areas.some((a) => a.fits_full);
  const haveM2_max = permitted_areas.reduce((m, a) => Math.max(m, a.areaM2), 0);   // POR ÁREA (no suma)
  const rejected_by = kit._rej || {};

  // --- Diagnóstico de la variante MÍNIMA (anclaje+gavetas) para certificado PARCIAL.
  let partial_certificate = null;
  if (!anyFitsFull && kit.minimo) {
    const vMin = variantesDe(kit.minimo).map((v) => ({ rot: v.rot, w: v.k.w, d: v.k.d, k: v.k }));
    const minFits = kit.zonas.some((ai) => diagnosticarEnArea(vMin, areas[ai], deadline).fitsFull);
    if (minFits) {
      partial_certificate = {
        anchor_placeable: true,
        dropped: Array.isArray(kit.dropMin) ? kit.dropMin.length : null,
        note: 'El ancla (y gavetas) SÍ cabe; lo que no cabe son las sillas/dependientes del kit completo.',
      };
    }
  }

  // --- Causa PRIMARIA, PROBADA (PROVEN) o diferida a revisión (REVIEW).
  let primary_cause, proven, secondary_causes = [];
  if (anyFitsFull) {
    // El kit SÍ cabe aislado en alguna área permitida → no es imposibilidad dura.
    if (budgetExhausted) { primary_cause = 'SEARCH_BUDGET_EXHAUSTED'; proven = false; }   // 17.2
    else { primary_cause = 'INTER_KIT_CONSTRAINT'; proven = true; }                        // cabe solo, otros kits lo bloquean
  } else if (anyTimeout) {
    primary_cause = 'DIAGNOSTIC_BUDGET_EXHAUSTED'; proven = false;                          // 17.6: no se pudo probar
  } else {
    // Imposibilidad DURA probada por sondeo exhaustivo (independiente del solver).
    // Combina las causas por área; si TODAS coinciden → una sola; si difieren → MULTI.
    const porArea = permitted_areas.map((a) => a.causas);
    const union = [...new Set(porArea.flat())];
    // NO_SPACE a nivel kit sólo si NINGÚN área individual es suficiente por m².
    const noSpaceAll = permitted_areas.every((a) => needM2 > a.areaM2 + 1e-6);
    let causas = union.filter((c) => c !== 'NO_SPACE' || noSpaceAll);
    if (!causas.length) causas = ['ASPECT_RATIO'];
    proven = true;
    if (causas.length > 1) { primary_cause = 'MULTI_CONSTRAINT'; secondary_causes = causas; }   // 17.3
    else primary_cause = causas[0];
  }
  const veredicto = veredictoDe(kit, areas, { primary_cause, proven, budgetExhausted, busqueda });
  // PUERTA SIN CONFIRMAR (contrafáctico real, no texto fijo): una puerta sin giro confirmado reserva un
  // cuadro conservador frente al vano. Si el cuarto NO admite todo con esa reserva pero SÍ sin ella, la
  // salida no es quitar muebles: es confirmar hacia dónde abre la puerta (VH-136).
  let puerta_sin_confirmar = null;
  if (primary_cause === 'INTER_KIT_CONSTRAINT' && typeof puertaCF === 'function') {
    try { puerta_sin_confirmar = puertaCF(kit.anchorId); } catch { puerta_sin_confirmar = null; }
  }

  return {
    veredicto,
    puerta_sin_confirmar,
    permitted_areas,
    orientations: variantesFull.map((v) => v.rot),
    rejected_by,
    dimensional_fit: {
      any_fits_bounds: anyFitsBounds, any_fits_polygon: anyFitsPolygon, any_fits_full: anyFitsFull,
      // compat: antes `any_fits_dims`(=bounds+poly) / `any_fits_with_doors`(=full)
      any_fits_dims: anyFitsPolygon, any_fits_with_doors: anyFitsFull,
      needM2: round1(needM2), haveM2: haveM2_max, moduloW_m, moduloH_m,
    },
    search_exhausted: !budgetExhausted,
    diagnostic_timeout: anyTimeout,
    nodes_used: nodos,
    primary_cause,
    proven,
    secondary_causes,
    partial_certificate,
    evidence: { needM2: round1(needM2), haveM2: haveM2_max, moduloW_m, moduloH_m, nodes_used: nodos, budget_exhausted: !!budgetExhausted, diagnostic_timeout: anyTimeout },
  };
}

// Certificado de un kit FALLIDO completo.
function certFail(kit, areas, ctx) { return certificarKit(kit, areas, ctx); }
// Certificado PARCIAL (ancla cupo, sillas no): la causa del kit completo se prueba por
// contrafáctico (GAP21) y se CONSERVAN sus permitted_areas (GAP42) para el texto multi-área.
function certPartial(kit, areas, dropped, ctx) {
  const full = certificarKit(kit, areas, ctx);
  return {
    primary_cause: 'PARTIAL_SEATS_DROPPED',
    proven: full.proven === true,
    veredicto: full.veredicto,                      // 027b: el veredicto del kit completo (sillas)
    permitted_areas: full.permitted_areas,          // GAP42: multi-área también en el parcial
    partial_certificate: {
      anchor_placeable: true, minimum_fit: true, dropped_dependents: dropped,
      full_kit_cause: full.primary_cause, full_kit_proven: full.proven,
      full_kit_evidence: full.evidence, full_kit_secondary: full.secondary_causes,
      full_kit_permitted_areas: full.permitted_areas,
    },
  };
}

// GAP38 · Adjunta certificados causales al ganador YA FIJO, SIN re-buscar posiciones
// (usa el contexto de kits guardado en el solve). La colocación NO se toca → el layout
// retornado coincide byte a byte con el que se evaluó (winner_eval ↔ returned layout).
export function attachCertificates(sol, areas = [], { deadline } = {}) {
  const ctx = sol && sol._cert_ctx;
  if (!ctx) return sol;
  const base = { budgetExhausted: ctx.budgetExhausted, nodos: ctx.nodos, deadline, busqueda: ctx.busqueda, puertaCF: ctx.puertaCF };
  for (const u of (sol.unplaced || [])) {
    if (u.certificado != null) continue;
    const kit = ctx.kitsByAnchor.get(String(u.anchorId));
    if (!kit) continue;
    u.certificado = u.invariante === 'NO_SPACE_PARA_SILLAS'
      ? certPartial(kit, areas, u.piezas, base)
      : certFail(kit, areas, base);
  }
  return sol;
}

/**
 * C · Solver por bloques con backtracking. Determinista.
 * @returns {{colocacion, unplaced, unassigned, metodo, attempts_used, _nodos}}
 */
export function resolverKits(areas = [], piezas = [], opts = {}) {
  const t0 = Date.now();
  const { piezas: asign, unassigned } = asignarDuenos(piezas);

  // VH-096: una guarda de piso suelta (SUPPORT_STORAGE, `standalone`) forma su propio kit sin
  // sillas: se coloca con su huella real en su zona, en vez de "no tener mueble que la reciba".
  const anclas = asign.filter((p) => esAncla(p.relation_role) || p.standalone === true).sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
  const depsDe = (anchorId) => asign.filter((p) => String(p.anchor_instance_id) === String(anchorId));
  const kits = [];
  for (const a of anclas) {
    const deps = depsDe(a.id);
    const sillas = deps.filter((d) => esSilla(d.relation_role));
    const gavetas = deps.filter((d) => esGaveta(d.relation_role));
    const base = componerKit(a, sillas, gavetas);
    base.sinColocar.forEach((id) => unassigned.push(id));
    // Variante MÍNIMA (mejor parcial válido, E): ancla + gavetas bajo tablero, sin
    // sillas. Si el kit completo no cabe, al menos se coloca el ancla y las sillas
    // caen como "no cupieron" (nunca sueltas ni encimadas).
    // El ancla del kit (también una guarda suelta `standalone`) SIEMPRE forma parte del mínimo:
    // sin esto `Math.max(...[])` daba -Infinity y la malla de candidatos corría sin fin (OOM).
    const esDelMinimo = (p) => esAncla(p.rol) || p.bajoTablero || String(p.id) === String(base.anchorId);
    const minimoPiezas = base.piezas.filter(esDelMinimo);
    const dropMin = base.piezas.filter((p) => !esDelMinimo(p)).map((p) => String(p.id));
    const minW = Math.max(...minimoPiezas.map((p) => p.dx + p.w)), minH = Math.max(...minimoPiezas.map((p) => p.dy + p.d));
    const minimo = { anchorId: base.anchorId, w: minW, d: minH, piezas: minimoPiezas };
    // 027b/Parte XI: una huella que NO vino (w/d ausentes) se completó con un default
    // de composición; queda MARCADA para que el veredicto sea INFORMACION_INSUFICIENTE,
    // nunca una imposibilidad "demostrada" sobre medidas inventadas.
    const dimsFaltantes = !(num(a.w) > 0 && num(a.d) > 0);
    kits.push({ anchorId: String(a.id), base, minimo, dropMin, area: num(a.w) * num(a.d), zonas: areasPermitidas(a, areas), dimsFaltantes, variantesBase: variantesDe(base), variantesMin: variantesDe(minimo) });
  }
  kits.sort((x, y) => (y.area - x.area) || (x.anchorId < y.anchorId ? -1 : 1));

  const ocupadosPorArea = new Map(areas.map((_, i) => [i, []]));
  const colocacion = [];
  const kitRes = new Array(kits.length).fill(null);   // {dropped:[], invariante?} por kit
  let nodos = 0;
  let budgetExhausted = false;   // GAP17.2: timeout/tope de nodos ≠ imposibilidad geométrica

  // GAP2: la salida canónica conserva la metadata semántica para que el Semantic
  // Judge reconstruya silla→ancla→slot→lado→orientación. anchor_instance_id viene
  // de la asignación de dueño; slot/side/facing/topology del kit compuesto.
  const anchorDe = new Map(asign.map((x) => [String(x.id), x.anchor_instance_id ?? null]));
  const colocarPieza = (abs, p) => ({
    // `rot` 0/90 = orientación del rectángulo (lo que leen los validadores); `kit_rot`
    // conserva la vuelta completa del kit (180/270 = layout espejado, ver variantesDe).
    id: p.id, area: abs.areaIdx, x: Math.round(abs.x + p.dx), y: Math.round(abs.y + p.dy), rot: abs.rot % 180, kit_rot: abs.rot,
    anchor_instance_id: anchorDe.get(String(p.id)) ?? null,
    slot_id: p.slot_id ?? null, side: p.side ?? null, facing: p.facing ?? null,
    topology: p.topology ?? null, provenance: p.provenance ?? null, profile_version: p.profile_version ?? PROFILE_VERSION,
  });

  const deadline = Number.isFinite(opts.deadline) ? opts.deadline : null;   // GAP27: presupuesto compartido
  const registrarRechazo = (kit, motivo) => { kit._rej = kit._rej || {}; kit._rej[motivo] = (kit._rej[motivo] || 0) + 1; };
  const colocarKit = (ai, c, k, rot) => {
    ocupadosPorArea.get(ai).push({ x: c.x, y: c.y, w: k.w, d: k.d, pasillo: rectPasillo(c.x, c.y, k.w, k.d, k.accesoLado || null), guardado: guardadoDe(k, c.x, c.y) });
    const abs = { areaIdx: ai, x: c.x, y: c.y, rot };
    const base = colocacion.length;
    k.piezas.forEach((p) => colocacion.push(colocarPieza(abs, p)));
    return base;
  };
  const deshacerKit = (ai, base) => { colocacion.length = base; ocupadosPorArea.get(ai).pop(); };

  // ---------------------------------------------------------------------------
  // COT-P0-027b (Parte XI §3) · FASE 1 · BÚSQUEDA COMPLETA.
  // Causa demostrada (baseline 15:17Z, 3 rutas): la "búsqueda con backtracking" era en
  // realidad un primer-ajuste voraz: cuando un kit no cabía se marcaba como fallido y la
  // recursión seguía (siempre true), así que NUNCA se movía un kit anterior. Con el
  // orden `center`, el primer bench quedaba en medio del área operativa y el segundo
  // (3000 + pasillo 1000) ya no cabía → 15/22 "INTER_KIT_CONSTRAINT" aunque sí existía
  // acomodo conjunto. Esta fase busca una colocación de TODOS los kits COMPLETOS (sin
  // variante mínima) con backtracking real y BACKJUMPING dirigido por conflicto: si el
  // kit f no cabe con ninguna posición, sólo tiene sentido mover kits que comparten
  // zona con f; los demás propagan el fallo sin probar más posiciones. Presupuesto
  // PROPIO (nodos/ms): si se agota, NO se afirma imposibilidad (fase1Agotada) y se cae
  // a la fase 2 (el primer-ajuste de siempre, con variante mínima). Si la fase 1 termina
  // SIN solución y SIN agotarse, la infactibilidad conjunta queda DEMOSTRADA dentro del
  // modelo (malla 100 mm, rot 0/90, pasillo 1000, acceso > HARD_ACCESS_MM).
  // Cuando el primer-ajuste ya colocaba todo, el primer camino de esta DFS es EXACTAMENTE
  // ese camino (mismo orden de candidatos) → mismo resultado byte a byte.
  // ---------------------------------------------------------------------------
  const MAX_NODOS_COMPLETO = 400000, MAX_MS_COMPLETO = 1000;
  let fase1Agotada = false, nodos1 = 0, nEstaticos = 0;
  // Posiciones a probar para un grupo de variantes en un área. Orden por defecto:
  // variante por variante (byte-idéntico al camino previo). Orden `access` (027b/027c):
  // las variantes se FUSIONAN y se ordenan por holgura de acceso, para que girar el kit
  // (p.ej. credenza con el frente hacia el cuarto, 180°) compita con no girarlo; antes el
  // primer-ajuste agotaba la variante 0° y nunca llegaba a 180° aunque tuviera más holgura.
  // 027c · un mueble de guardado se arrima al muro por su RESPALDO (nadie deja una credenza flotando a
  // 30 cm de la pared). Para kits de sólo guardado las 4 orientaciones se fusionan y se prueban primero
  // las posiciones con el respaldo pegado al muro; es ORDEN de primer-ajuste, no cambia la legalidad.
  const W_ = (area) => num(area.ancho) || num(area.width_mm), H_ = (area) => num(area.largo) || num(area.depth_mm);
  const respaldoAMuro = (k, x, y, area) => {
    const g = (k.piezas || []).find((p) => p.topology === 'STORAGE' && p.facing);
    if (!g) return 0;
    const gx = x + g.dx, gy = y + g.dy;   // el respaldo es el lado hacia el que "mira" (opuesto al acceso)
    return g.facing === 'UP' ? gy : g.facing === 'DOWN' ? H_(area) - (gy + g.d) : g.facing === 'RIGHT' ? W_(area) - (gx + g.w) : gx;
  };
  const posicionesDe = (area, variantes, orden) => {
    const listas = variantes.map((v) => candidatos(area, v.k, orden, deadline).map((c) => ({ ...v, x: c.x, y: c.y })));
    const soloGuardado = variantes.length > 0 && variantes.every((v) => guardadoDe(v.k, 0, 0));
    if (soloGuardado) {
      const todas = listas.flat().map((p, i) => ({ p, i, r: Math.max(0, respaldoAMuro(p.k, p.x, p.y, area)), h: orden === 'access' ? holguraAcceso(p.k, p.x, p.y, area) : 0 }));
      todas.sort((a, b) => (a.r - b.r) || (b.h - a.h) || (a.i - b.i));
      return todas.map((t) => t.p);
    }
    if (orden !== 'access') return listas.flat();
    const todas = listas.flat().map((p, i) => ({ p, i, h: holguraAcceso(p.k, p.x, p.y, area) }));
    todas.sort((a, b) => (b.h - a.h) || (a.i - b.i));
    return todas.map((t) => t.p);
  };
  const comparteZona = (a, b) => a.zonas.some((z) => b.zonas.includes(z));
  const fase1Fuera = () => nodos1 > MAX_NODOS_COMPLETO || Date.now() - t0 > MAX_MS_COMPLETO || (deadline && Date.now() >= deadline);
  // DOMINIO de un kit en un cuarto: las posiciones que el cuarto admite por sí solo (muros, contorno,
  // columnas, puertas, acceso), en el orden de la estrategia. Se calcula UNA vez; la búsqueda sólo
  // combina dominios (encimes y pasillos entre kits). Antes cada visita re-enumeraba y re-validaba la
  // malla entera y el presupuesto se agotaba en un despacho de 3 muebles sin poder demostrar nada.
  const dominios = new Map();
  // 2026-10-19 (C2, edge 546 por CPU): el veredicto estático de una posición depende sólo del cuarto,
  // de la huella del kit y de sus lados de acceso, NO del orden de la estrategia. Con `opts.cacheEstatico`
  // (WeakMap por objeto de área, vive una petición) las 6 estrategias y las simulaciones de opciones del
  // vendedor lo calculan una vez. Mismo motivo, mismo orden de recorrido y de rechazos → misma salida.
  const cacheEst = opts.cacheEstatico instanceof WeakMap ? opts.cacheEstatico : null;
  const firmas = new Map();
  const firmaKit = (k) => {
    let f = firmas.get(k);
    if (f == null) {
      f = `${k.w}x${k.d}:${JSON.stringify((k.piezas || []).map((p) => [p.dx, p.dy, p.w, p.d, p.facing ?? null, p.rol ?? null, p.topology ?? null]))}`;
      firmas.set(k, f);
    }
    return f;
  };
  const motivoEstaticoMemo = (c, area) => {
    if (!cacheEst) return motivoEstatico(c.x, c.y, c.k, area);
    let porArea = cacheEst.get(area);
    if (!porArea) { porArea = new Map(); cacheEst.set(area, porArea); }
    const f = firmaKit(c.k);
    let porKit = porArea.get(f);
    if (!porKit) { porKit = new Map(); porArea.set(f, porKit); }
    const pos = `${c.x},${c.y}`;
    if (porKit.has(pos)) return porKit.get(pos);
    const m = motivoEstatico(c.x, c.y, c.k, area);
    porKit.set(pos, m);
    return m;
  };
  const dominioDe = (idx, ai) => {
    const key = `${idx}:${ai}`;
    if (dominios.has(key)) return dominios.get(key);
    const kit = kits[idx], area = areas[ai], out = [];
    for (const c of posicionesDe(area, kit.variantesBase, opts.orden)) {
      if ((++nEstaticos & 2047) === 0 && fase1Fuera()) { fase1Agotada = true; break; }
      const m = motivoEstaticoMemo(c, area);
      if (m) registrarRechazo(kit, m); else out.push(c);
    }
    dominios.set(key, out);
    return out;
  };
  // --- COMPONENTES: kits que comparten (transitivamente) algún cuarto. Cuartos distintos no se estorban,
  // así que cada componente se resuelve POR SEPARADO y con su propio presupuesto: un despacho que no
  // admite todo su mobiliario ya NO le quita la búsqueda completa al área operativa (antes un solo cuarto
  // infactible mandaba a TODOS al primer-ajuste y un segundo bench se quedaba fuera sin razón).
  const comp = kits.map((_, i) => i);
  const raiz = (i) => { while (comp[i] !== i) { comp[i] = comp[comp[i]]; i = comp[i]; } return i; };
  for (let i = 0; i < kits.length; i++) for (let j = i + 1; j < kits.length; j++) if (comparteZona(kits[i], kits[j])) comp[raiz(j)] = raiz(i);
  const componentes = new Map();
  kits.forEach((_, i) => { const r = raiz(i); if (!componentes.has(r)) componentes.set(r, []); componentes.get(r).push(i); });

  function buscarCompleto(lista, pos) {
    if (pos >= lista.length) return true;
    if (fase1Fuera()) { fase1Agotada = true; return { fallido: pos, agotado: true }; }
    const idx = lista[pos], kit = kits[idx];
    for (const ai of kit.zonas) {
      const dom = dominioDe(idx, ai);
      if (fase1Agotada) return { fallido: pos, agotado: true };
      for (const c of dom) {
        const { k, rot } = c;
        nodos1++;
        if ((nodos1 & 511) === 0 && fase1Fuera()) { fase1Agotada = true; return { fallido: pos, agotado: true }; }
        const motivo = motivoDinamico(c.x, c.y, k, ocupadosPorArea.get(ai));
        if (motivo) { registrarRechazo(kit, motivo); continue; }
        const base = colocarKit(ai, c, k, rot);
        kitRes[idx] = { dropped: [] };
        const r = buscarCompleto(lista, pos + 1);
        if (r === true) return true;
        deshacerKit(ai, base); kitRes[idx] = null;
        if (r.agotado) return r;                                               // presupuesto: abortar este componente
        if (!comparteZona(kit, kits[lista[r.fallido]])) return r;              // backjump: mover este kit no ayuda
      }
    }
    return { fallido: pos };
  }
  const estadoComp = [];          // {lista, completa, exhaustiva}
  let nodos1Total = 0;
  const pendientes = [];          // kits que pasan a la fase 2 (primer-ajuste)
  // Que un conjunto de kits NO quepa junto (probado exhaustivamente) no depende del ORDEN en que se
  // prueben las posiciones: el multi-candidato comparte esa prueba entre estrategias (opts.memo) en vez
  // de repetirla seis veces. Sólo se memoriza lo DEMOSTRADO; un presupuesto agotado nunca se memoriza.
  const memo = opts.memo instanceof Map ? opts.memo : null;
  const clave = (lista) => lista.map((i) => kits[i].anchorId).join('|');
  const buscarConMemo = (lista) => {
    const k = clave(lista);
    if (memo && memo.get(k) === 'INFACTIBLE') return { fallido: 0, memo: true };
    nodos1 = 0; fase1Agotada = false;
    const r = buscarCompleto(lista, 0);     // si falla, el propio DFS ya deshizo todas sus colocaciones
    nodos1Total += nodos1;
    if (memo && r !== true && !fase1Agotada) memo.set(k, 'INFACTIBLE');
    return r;
  };
  for (const lista of componentes.values()) {
    fase1Agotada = false;
    const r = buscarConMemo(lista);
    const exhaustiva = r !== true && !fase1Agotada;
    estadoComp.push({ lista, completa: r === true, exhaustiva });
    if (r === true) continue;
    // MEJOR PARCIAL DEMOSTRADO: si el cuarto no admite todo (probado), se busca COMPLETO el acomodo
    // que deja fuera UN solo kit, empezando por el que menos piezas pierde (a igualdad, el más chico).
    // Así lo que sí cabe queda bien acomodado (con la estrategia de la corrida) y sólo lo que
    // realmente no cabe se reporta; el primer-ajuste queda como último recurso.
    let fuera = null;
    if (exhaustiva && lista.length > 1) {
      const orden = lista.slice().sort((x, y) => (kits[x].base.piezas.length - kits[y].base.piezas.length) || (y - x));
      for (const j of orden) {
        fase1Agotada = false;
        const ok = buscarConMemo(lista.filter((i) => i !== j)) === true;
        if (ok) { fuera = j; break; }
        if (fase1Agotada) break;
      }
    }
    if (fuera != null) pendientes.push(fuera); else pendientes.push(...lista);
  }
  const completa = estadoComp.every((c) => c.completa);
  pendientes.sort((x, y) => x - y);

  // FASE 2 · primer-ajuste con variante mínima (mejor parcial válido). Sólo para los kits de los
  // componentes que la fase 1 no pudo completar.
  function intentarKit(pos) {
    if (Date.now() - t0 > MAX_MS || nodos > MAX_NODOS || (deadline && Date.now() >= deadline)) { budgetExhausted = true; return pos >= pendientes.length; }
    if (pos >= pendientes.length) return true;
    const idx = pendientes[pos], kit = kits[idx];
    // Variantes completas primero; la mínima (sin sillas) sólo después, NUNCA mezclada en
    // el orden `access` (un kit sin sillas tendría holgura infinita y ganaría siempre).
    const completas = kit.variantesBase.map((v) => ({ ...v, drop: [] }));
    const minimas = kit.variantesMin.map((v) => ({ ...v, drop: kit.dropMin }));
    let mejorMotivo = 'NO_SPACE';
    for (const ai of kit.zonas) {
      const area = areas[ai];
      for (const c of [...posicionesDe(area, completas, opts.orden), ...posicionesDe(area, minimas, opts.orden)]) {
        const { k, rot, drop } = c;
        nodos++;
        // GAP35.A: checar deadline DENTRO del barrido (no sólo al entrar a intentarKit),
        // para que una malla grande no exceda el presupuesto. Cada 512 nodos (barato).
        if (deadline && (nodos % 512 === 0) && Date.now() >= deadline) { budgetExhausted = true; return pos >= pendientes.length; }
        const motivo = motivoEstaticoMemo(c, area) || motivoDinamico(c.x, c.y, k, ocupadosPorArea.get(ai));   // = kitCabe
        if (motivo) {
          // GAP17: histograma de rechazos (SÓLO registra; no altera el flujo).
          registrarRechazo(kit, motivo);
          if (motivo !== 'AISLE') mejorMotivo = motivo; continue;
        }
        const base = colocarKit(ai, c, k, rot);
        kitRes[idx] = { dropped: drop };
        if (intentarKit(pos + 1)) return true;
        deshacerKit(ai, base); kitRes[idx] = null;
      }
    }
    kitRes[idx] = { dropped: kit.base.piezas.map((p) => String(p.id)), invariante: mejorMotivo, fail: true };
    return intentarKit(pos + 1);
  }
  if (pendientes.length) intentarKit(0);
  // La salida conserva el orden canónico por kit (como antes de resolver por componentes).
  {
    const kitDePieza = new Map(); kits.forEach((kit, i) => kit.base.piezas.forEach((p) => kitDePieza.set(String(p.id), i)));
    const pos0 = new Map(colocacion.map((c, i) => [c, i]));
    colocacion.sort((x, y) => ((kitDePieza.get(String(x.id)) ?? 0) - (kitDePieza.get(String(y.id)) ?? 0)) || (pos0.get(x) - pos0.get(y)));
  }
  // Registro de la búsqueda (aditivo): qué se demostró y qué no, global y por ancla.
  const por_ancla = {};
  for (const c of estadoComp) for (const i of c.lista) por_ancla[kits[i].anchorId] = { completa: c.completa, exhaustiva: c.exhaustiva };
  const busqueda = { completa, exhaustiva: !completa && estadoComp.every((c) => c.completa || c.exhaustiva), fase: completa ? 1 : 2, fase1_agotada: estadoComp.some((c) => !c.completa && !c.exhaustiva), componentes: estadoComp.length, nodos: nodos1Total + nodos, por_ancla };

  // Ensambla faltantes: kits sin colocar (fail) + sillas que cayeron al usar la
  // variante mínima. Motivo CAUSAL del invariante limitante (no genérico).
  // GAP35.C: durante la EXPLORACIÓN multi, los certificados causales (costosos) se
  // OMITEN (certificados:false) y se calculan sólo para el GANADOR al final. El camino
  // por defecto (banco) mantiene certificados:true → salida byte-idéntica.
  const conCertificados = opts.certificados !== false;
  // Contrafáctico de puertas sin giro confirmado, por componente (cuarto): ¿cabría TODO el mobiliario de
  // ese cuarto si la puerta no reservara su cuadro conservador? Se re-resuelve sólo ese componente.
  const puertaCF = opts._sinContrafactual ? null : (anchorId) => {
    const c = estadoComp.find((e) => e.lista.some((i) => kits[i].anchorId === String(anchorId)));
    if (!c) return null;
    const zonas = [...new Set(c.lista.flatMap((i) => kits[i].zonas))];
    const dudosa = (p) => p && p.tieneBarrido === false;
    const conDuda = zonas.filter((ai) => (areas[ai]?.puertas || []).some(dudosa));
    if (!conDuda.length) return null;
    const areasCF = areas.map((a, ai) => (conDuda.includes(ai) ? { ...a, puertas: (a.puertas || []).filter((p) => !dudosa(p)) } : a));
    const ids = new Set(c.lista.flatMap((i) => kits[i].base.piezas.map((p) => String(p.id))));
    const cf = resolverKits(areasCF, piezas.filter((p) => ids.has(String(p.id))), { orden: opts.orden, certificados: false, deadline, _sinContrafactual: true, cacheEstatico: cacheEst || undefined });
    return { zonas: conDuda.map((ai) => areas[ai].zone_id ?? areas[ai].nombre ?? `area_${ai}`), cabe_sin_reserva: cf.unplaced.length === 0 && cf.unassigned.length === 0 };
  };
  const certCtx = { budgetExhausted, nodos, deadline, busqueda, puertaCF };
  const kitsByAnchor = new Map(kits.map((k) => [String(k.anchorId), k]));
  const unplaced = [];
  kits.forEach((kit, idx) => {
    const res = kitRes[idx] || { dropped: kit.base.piezas.map((p) => String(p.id)), invariante: 'NO_SPACE', fail: true };
    if (res.fail) {
      // GAP17: certificado adjunto (aditivo). `invariante` NO cambia (downstream intacto).
      // GAP35.C: en exploración (certificados:false) se omite y se adjunta al ganador (attachCertificates).
      const certificado = conCertificados ? certFail(kit, areas, certCtx) : null;
      unplaced.push({ anchorId: kit.anchorId, piezas: res.dropped, invariante: res.invariante, certificado });
    } else if (res.dropped && res.dropped.length) {
      // GAP21: el ancla SÍ cupo pero las sillas no; la causa del kit completo se prueba por contrafáctico.
      const certificado = conCertificados ? certPartial(kit, areas, res.dropped, certCtx) : null;
      unplaced.push({ anchorId: kit.anchorId, piezas: res.dropped, invariante: 'NO_SPACE_PARA_SILLAS', certificado });
    }
  });

  // GAP38: contexto para certificar POST-HOC al ganador sin re-buscar (attachCertificates).
  // GAP46: `_cert_ctx` es INTERNO, NO parte de la superficie pública. Se define NO-ENUMERABLE
  // para que no aparezca en JSON.stringify ni en spreads ({...sol}); attachCertificates lo lee
  // por acceso directo. Así la forma pública del sol (colocacion/unplaced/...) queda limpia y el
  // default sigue siendo byte-idéntico también a nivel de claves enumerables.
  const sol = { colocacion, piezas: asign, unplaced, unassigned, metodo: 'kit-solver-v1', attempts_used: 1, busqueda, _nodos: nodos };
  Object.defineProperty(sol, '_cert_ctx', { value: { kitsByAnchor, budgetExhausted, nodos, busqueda, puertaCF }, enumerable: false, writable: true, configurable: true });
  return sol;
}

// ============================================================================
//  BLOCK 5 · BÚSQUEDA MULTI-CANDIDATO → PIPELINE DE JUECES EN CAPAS → GANADOR.
//
//  Cierra GAP13-A/D SIN "interior-first" ni tocar el camino determinista. El
//  candidato #0 es SIEMPRE la solución determinista (orden=undefined, byte-idéntica
//  a resolverKits por defecto). Los demás son la MISMA búsqueda con otro ORDEN de
//  barrido (permutaciones del mismo set legal); el candidato 'center' es ACCESO-
//  CONSCIENTE (uno más a juzgar, no el orden por defecto).
//
//  PIPELINE REAL por candidato (cada juez CORRE de verdad; reutiliza validadores
//  existentes; NO toca el judge congelado de bench/):
//    1. HARD VALIDITY   · validarColocacion (acomodo-core) — descarta inválidos.
//    2. SEMANTIC VALIDITY· juzgarSemantico — una solución con FAIL semántico NUNCA
//                          gana a una PASS aunque coloque más piezas.
//    3. COMPLETENESS     · más piezas colocadas.
//    4. QUALITY          · juzgarCalidad (score explicable) — sólo entre los que ya
//                          pasaron los gates anteriores; el score NO compensa gates.
//  Empate exacto → candidato de MENOR índice (el determinista). Por eso un caso
//  factible del banco sólo puede MANTENERSE o MEJORAR, nunca regresar.
// ============================================================================
// 027b: `access` (acceso-primero) se suma al final: nunca desplaza al determinista en
// empates (menor índice gana) y sólo gana si los jueces lo prefieren.
const ESTRATEGIAS_MULTI = [undefined, 'center', 'reverse', 'col', 'colReverse', 'access'];
const MAX_MULTI_MS = 4000;        // F: presupuesto TOTAL del multi (no 5× el del solver)
const QUALITY_EXCELENTE = 85;     // umbral para corte adaptativo

// Rango semántico para ORDENAR (GAP18): PASS(2) > REVIEW_REQUIRED(1) > FAIL(0).
const SEM_RANK = { PASS: 2, REVIEW_REQUIRED: 1, FAIL: 0 };

function evaluarCandidato(areas, piezas, sol) {
  const faltan = new Set();
  for (const u of (sol.unplaced || [])) for (const id of (u.piezas || [])) faltan.add(String(id));
  for (const id of (sol.unassigned || [])) faltan.add(String(id));
  const placed = piezas.length - faltan.size;

  // 1 · HARD (GAP19): el MISMO contrato duro que decide la publicación (evaluarRecovery:
  // bounds/overlap/puerta/obstáculo/muros/circulación/grupos/relacional). El selector
  // no puede usar un hard distinto al final. hard-FAIL ⇒ hard issues de severidad fail.
  const er = evaluarRecovery(areas, sol.piezas, sol.colocacion, { requested: piezas.length });
  const hardFails = (er.issues || []).filter((i) => i.severity === 'fail');
  const hardOk = hardFails.length === 0;
  // porPieza del validador espacial (insumo de QUALITY, no gate).
  const hard = validarColocacion(areas, sol.piezas, sol.colocacion);

  // 2 · SEMANTIC (GAP18): PASS es condición de publicación; REVIEW_REQUIRED NO publica.
  const sem = juzgarSemantico(areas, sol.piezas, sol.colocacion);
  const sev = (s) => (sem.issues || []).filter((i) => i.severity === s).length;
  const semFail = sev('fail'), semReview = sev('review');
  const semantic_pass = sem.status === 'PASS';          // sólo PASS habilita render_ready
  const semRank = SEM_RANK[sem.status] ?? 0;

  // 4 · QUALITY — LAZY (GAP35): el score sólo decide el orden ENTRE candidatos que ya
  // pasaron HARD y SEMANTIC; para un candidato con hard-FAIL o semantic-FAIL el quality
  // NUNCA cambia el ranking, así que se omite (ahorra presupuesto). Un candidato sin
  // quality_status NO puede ser FINAL (fail-closed en recoveryPipeline).
  let quality = 0, quality_status = undefined, quality_components, quality_reasons;
  if (hardOk && sem.status !== 'FAIL') {
    const q = juzgarCalidad(areas, sol.piezas, sol.colocacion, { porPieza: hard.porPieza, semantic: sem });
    quality = q.total_score; quality_status = calidadAceptable(q).status;
    quality_components = q.components; quality_reasons = q.reasons;
  }

  // VH-110: la lista de observaciones semánticas viaja al cliente (antes sólo los conteos),
  // para que la pantalla diga QUÉ revisar (silla sin mirar a su mesa, lugar sin silla, etc.).
  const sem_issues = (sem.issues || []).map((i) => ({
    code: i.code, severity: i.severity ?? null,
    ...(i.id != null ? { id: i.id } : {}), ...(i.anchor != null ? { anchor: i.anchor } : {}),
    ...(i.slot != null ? { slot: i.slot } : {}), ...(i.clear != null ? { clear: i.clear } : {}), ...(i.target != null ? { target: i.target } : {}),
  }));
  return {
    placed, hardOk, hard_issues: hardFails.length, geo_issues: hardFails.filter((i) => i.geo).length,
    sem_status: sem.status, semFail, semReview, semantic_pass, semRank, sem_issues,
    quality, quality_status, quality_components, quality_reasons,
  };
}

// Orden TOTAL en capas (GAP46): HARD STATUS → SEMANTIC STATUS (PASS>REVIEW>FAIL) →
// COMPLETENESS → detalle de issues semánticos → QUALITY. Empate → #0.
//  · Una PASS con menos piezas SÍ gana a una FAIL con más (cambio de STATUS, GAP18).
//  · Pero dentro del MISMO status semántico, COMPLETENESS manda sobre reducir el número
//    de issues (NO se sacrifica media oficina sólo para bajar de 2 reviews a 1).
// COT-P0-027b (3er mecanismo, baseline 15:17Z): comparar el STATUS semántico completo
// (PASS > REVIEW_REQUIRED) ANTES de la completitud premiaba al candidato que NO colocaba
// las piezas de topología desconocida (credenza/archivero → SEMANTIC_PROFILE_UNKNOWN):
// `center` con 15/22 PASS ganaba a 22/22 REVIEW_REQUIRED. Un REVIEW es una incertidumbre
// pendiente, no una falla; dejar fuera una pieza para "limpiar" el review es inventar un
// proyecto más chico. Capa 2 ahora distingue sólo FAIL (inutilizable) vs no-FAIL; los
// reviews se comparan DESPUÉS de la completitud (capa 4). GAP18 se conserva: una PASS
// con menos piezas sigue ganando a una FAIL con más.
export function mejorCandidato(a, b) {
  const x = a.eval, y = b.eval;
  if (x.hardOk !== y.hardOk) return x.hardOk ? a : b;                         // 1 HARD status
  if (!x.hardOk) {
    // Entre dos con falla dura: primero el que tiene MENOS fallas geométricas (encimados, fuera del
    // cuarto, puertas), luego el MÁS COMPLETO, y sólo al final el total de fallas. Antes ganaba el que
    // colocaba menos piezas porque así acumulaba menos fallas de grupo (4048: 49 sobre 54).
    const gx = x.geo_issues ?? x.hard_issues, gy = y.geo_issues ?? y.hard_issues;
    if (gx !== gy) return gx < gy ? a : b;
    if (x.placed !== y.placed) return x.placed > y.placed ? a : b;
    if (x.hard_issues !== y.hard_issues) return x.hard_issues < y.hard_issues ? a : b;
  }
  const xFail = x.sem_status === 'FAIL', yFail = y.sem_status === 'FAIL';
  if (xFail !== yFail) return xFail ? b : a;                                 // 2 SEMANTIC FAIL vs no-FAIL (GAP18)
  if (x.placed !== y.placed) return x.placed > y.placed ? a : b;             // 3 COMPLETENESS
  if (x.semFail !== y.semFail) return x.semFail < y.semFail ? a : b;         // 4 detalle semántico: fails, luego reviews
  if (x.semRank !== y.semRank) return x.semRank > y.semRank ? a : b;         //   (PASS > REVIEW a igual completitud)
  if (x.semReview !== y.semReview) return x.semReview < y.semReview ? a : b;
  if (x.quality !== y.quality) return x.quality > y.quality ? a : b;         // 5 QUALITY (score)
  return a.idx <= b.idx ? a : b;                                             // empate → determinista
}

// GANADOR "limpio" = publicable: HARD PASS ∧ SEMANTIC PASS ∧ QUALITY aceptable ∧ completo.
const esLimpio = (ev, total) => ev.hardOk && ev.semantic_pass && ev.quality_status === 'PASS' && ev.placed === total;
// Excelente (corte adaptativo): limpio + score alto → no vale la pena explorar más.
const esExcelente = (ev, total) => esLimpio(ev, total) && ev.quality >= QUALITY_EXCELENTE;

export function resolverKitsMulti(areas = [], piezas = [], opts = {}) {
  const t0 = Date.now();
  const budget = num(opts.maxMultiMs, MAX_MULTI_MS);
  const deadline = t0 + budget;                     // GAP27: presupuesto COMPARTIDO con el solver
  const estrategias = Array.isArray(opts.estrategias) && opts.estrategias.length ? opts.estrategias : ESTRATEGIAS_MULTI;
  const total = piezas.length;
  const cands = [];
  const memo = new Map();   // imposibilidades DEMOSTRADAS, compartidas entre estrategias (no dependen del orden)
  const cacheEstatico = opts.cacheEstatico instanceof WeakMap ? opts.cacheEstatico : new WeakMap();   // veredicto estático por posición, compartido
  let ganador = null;
  let budgetExhaustedMulti = false;

  for (let i = 0; i < estrategias.length; i++) {
    // GAP27: no arrancar otro candidato si ya no queda presupuesto REAL (cada solve
    // puede consumir hasta MAX_MS). El deadline se pasa al solver para que corte.
    if (i > 0 && Date.now() >= deadline) { budgetExhaustedMulti = true; break; }
    const orden = estrategias[i];
    // GAP35.C: exploración SIN certificados causales (costosos); se certifica sólo al ganador.
    const sol = resolverKits(areas, piezas, { orden, deadline, certificados: false, memo, cacheEstatico });
    const cand = { idx: i, orden: orden ?? 'row', ordenRaw: orden, sol, eval: evaluarCandidato(areas, piezas, sol) };
    cands.push(cand);
    ganador = ganador ? mejorCandidato(ganador, cand) : cand;
    if (esExcelente(ganador.eval, total)) break;    // corte adaptativo
  }
  if (Date.now() >= deadline) budgetExhaustedMulti = true;

  // GAP35.C/GAP38: certificados causales SÓLO para el GANADOR, adjuntados POST-HOC sobre
  // su layout YA FIJO (attachCertificates NO re-busca posiciones → la colocación retornada
  // coincide byte a byte con la que evaluó el juez; winner_eval ↔ returned layout).
  const winnerSol = ganador.sol;
  if ((winnerSol.unplaced || []).some((u) => u.certificado == null)) {
    attachCertificates(winnerSol, areas, { deadline });
  }

  const elapsed_ms = Date.now() - t0;
  // GAP37 · es un SOFT_MULTI_BUDGET honesto: el SEARCH se acota por el deadline compartido
  // (candidatos + barrido), pero el JUZGADO por candidato (evaluarRecovery/validar/semantic/
  // quality) es O(n²) y NO interrumpible, así que el total puede exceder el presupuesto.
  // CONTRATO: si se excede, SIEMPRE revisión (jamás FINAL por haber "alcanzado" el tiempo).
  const budgetExceeded = elapsed_ms > budget;
  const winnerLimpio = esLimpio(ganador.eval, total);
  const quality_review_required = budgetExceeded || (!winnerLimpio && (budgetExhaustedMulti || ganador.eval.quality_status !== 'PASS'));

  return {
    ...winnerSol,
    metodo: 'kit-solver-multi-v1',
    seleccion: {
      ganador_idx: ganador.idx,
      ganador_orden: ganador.orden,
      candidatos_evaluados: cands.length,
      estrategias_totales: estrategias.length,
      ganador_eval: ganador.eval,
      quality_review_required,
      winner_clean: winnerLimpio,
      // GAP47 · publicable es FAIL-CLOSED: incluye TODOS los gates finales, incluido el
      // soft-budget review. Jamás publicable=true con quality_review_required=true.
      publicable: winnerLimpio && !quality_review_required,
      metrics: { elapsed_ms, budget_ms: budget, budget_mode: 'SOFT_MULTI_BUDGET', budget_exhausted: budgetExhaustedMulti, budget_exceeded: budgetExceeded, winner_strategy: ganador.orden, candidates_evaluated: cands.length },
      por_candidato: cands.map((c) => ({ idx: c.idx, orden: c.orden, placed: c.eval.placed, hardOk: c.eval.hardOk, hard_issues: c.eval.hard_issues, sem_status: c.eval.sem_status, semRank: c.eval.semRank, semFail: c.eval.semFail, semReview: c.eval.semReview, quality: c.eval.quality, quality_status: c.eval.quality_status })),
    },
  };
}
