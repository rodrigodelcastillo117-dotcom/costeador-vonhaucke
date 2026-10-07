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
import { perfilDeAncla, layoutDeTopologia, rotarFacing, PROFILE_VERSION } from './placementProfiles.js';

export const SEAT = 600;      // huella de silla (mm)
export const PITCH = 650;     // separación entre sillas alrededor de mesa
export const AISLE = 1000;    // pasillo mínimo ENTRE kits
export const GRID = 100;      // malla de candidatos
const MAX_MS = 2000;          // presupuesto de tiempo por caso
const MAX_NODOS = 200000;     // tope de nodos de backtracking

const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esSilla = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);
const esGaveta = (r) => ['UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);
const num = (n, def = 0) => (Number.isFinite(Number(n)) ? Number(n) : def);

// Capacidad de sillas que hospeda un ancla (determinista, del catálogo/dims).
export function capacidadAncla(p = {}) {
  if (num(p.user_capacity) > 0) return Math.round(num(p.user_capacity));
  const w = num(p.w), d = num(p.d), m = Math.max(w, d);
  switch (p.relation_role) {
    case 'ANCHOR_WORKSTATION': return Math.max(1, Math.round(m / 1500));
    case 'ANCHOR_DESK':        return 1;
    case 'ANCHOR_MEETING':     return Math.max(2, 2 * Math.max(1, Math.floor(w / PITCH)) + 2 * Math.max(0, Math.floor(d / PITCH)));
    case 'ANCHOR_RECEPTION':   return Math.max(1, Math.round(w / 800));   // sillas de visita en recepción
    default:                   return 0;
  }
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

  for (const [, { anclas, deps }] of grupos) {
    if (!anclas.length) { for (const d of deps) { porId(d.id).anchor_instance_id = null; unassigned.push(String(d.id)); } continue; }
    const an = anclas.slice().sort(sortId).map((a) => ({ id: String(a.id), cap: capacidadAncla(a), seats: 0, gav: 0, rol: a.relation_role }));
    const sillas = deps.filter((d) => esSilla(d.relation_role)).sort(sortId);
    const gavetas = deps.filter((d) => esGaveta(d.relation_role)).sort(sortId);
    for (const s of sillas) {
      const a = an.find((x) => x.seats < x.cap) || an[0];
      if (a && a.seats < a.cap) { porId(s.id).anchor_instance_id = a.id; a.seats++; } else { porId(s.id).anchor_instance_id = null; unassigned.push(String(s.id)); }
    }
    for (const gv of gavetas) {
      const a = an.find((x) => x.gav < x.cap) || an[0];
      if (a && a.gav < a.cap) { porId(gv.id).anchor_instance_id = a.id; a.gav++; } else { porId(gv.id).anchor_instance_id = null; unassigned.push(String(gv.id)); }
    }
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
  const lay = layoutDeTopologia(topoGeom, aw, ad, sillas.length);
  const piezas = [{ id: String(anchor.id), dx: lay.anchor.dx, dy: lay.anchor.dy, w: aw, d: ad, rol, topology: perfil.topology, provenance: perfil.provenance, profile_version: perfil.version, fallback_layout: perfil.topology === 'UNKNOWN' ? (perfil.fallback_layout_strategy || 'LEGACY_SINGLE_FACE') : null }];
  const sinColocar = [];

  sillas.forEach((s, i) => {
    const slot = lay.seats[i];
    if (slot) piezas.push({ id: String(s.id), dx: slot.dx, dy: slot.dy, w: SEAT, d: SEAT, rol: s.relation_role, slot_id: slot.slot_id, side: slot.side, facing: slot.facing });
    else sinColocar.push(String(s.id));
  });
  gavetas.forEach((g, i) => {
    const gw = num(g.w, 400), gd = num(g.d, 500);
    piezas.push({ id: String(g.id), dx: lay.anchor.dx + Math.min(Math.max(0, aw - gw), i * (gw + 50)), dy: lay.anchor.dy + Math.max(0, ad - gd), w: gw, d: gd, rol: g.relation_role, bajoTablero: true, slot_id: `storage_${i + 1}` });
  });
  return { anchorId: String(anchor.id), w: lay.kitW, d: lay.kitD, piezas, sinColocar };
}

// Rota un kit 90° (intercambia dims; gira coords internas).
function rotarKit(kit) {
  return {
    anchorId: kit.anchorId, w: kit.d, d: kit.w, sinColocar: kit.sinColocar,
    // Conserva metadata semántica y ROTA el facing cardinal (GAP3). `side` semántico
    // (A/B/HEAD_A/HEAD_B/FRONT) se conserva; `facing` absoluto gira con el bloque.
    piezas: kit.piezas.map((p) => ({ id: p.id, rol: p.rol, bajoTablero: p.bajoTablero, w: p.d, d: p.w, dx: kit.d - (p.dy + p.d), dy: p.dx, slot_id: p.slot_id, side: p.side, facing: rotarFacing(p.facing, 90), topology: p.topology, provenance: p.provenance, profile_version: p.profile_version, fallback_layout: p.fallback_layout })),
  };
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

// ¿Cabe el kit (rect bruto w×d en (x,y))? Pasillo entre kits vs `ocupados`.
function kitCabe(x, y, kw, kh, area, ocupados) {
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  if (x < 0 || y < 0 || x + kw > W + 1 || y + kh > H + 1) return 'OUT_OF_BOUNDS';
  const rect = { x, y, w: kw, d: kh };
  if (Array.isArray(area.poly) && area.poly.length >= 3 && !rectDentroPoligono(rect, area.poly)) return 'OUT_OF_POLYGON';
  for (const o of (area.obstaculos || [])) if (rectsSeSolapan(rect, { x: num(o.x), y: num(o.y), w: num(o.w), d: num(o.h) })) return 'OBSTACLE';
  for (const p of (area.puertas || [])) if (bloqueaPuertaEspacial(rect, p)) return 'DOOR';
  for (const oc of ocupados) {
    if (rectsSeSolapan(rect, oc)) return 'OVERLAP';
    if (rectsSeSolapan({ x: x - AISLE, y: y - AISLE, w: kw + 2 * AISLE, d: kh + 2 * AISLE }, oc)) return 'AISLE';
  }
  return null;
}

function candidatos(area, kw, kh) {
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  const out = [];
  for (let y = 0; y + kh <= H + 1; y += GRID) for (let x = 0; x + kw <= W + 1; x += GRID) out.push({ x, y });
  return out;
}

const round1 = (n) => Math.round(num(n) * 10) / 10;

// --- GAP17 · CERTIFICADO DE FALLO (INSTRUMENTACIÓN PURA) ---------------------
// SÓLO describe por qué un kit no se colocó. NO cambia el orden de candidatos,
// las variantes, el backtracking, la decisión PASS/FAIL ni las colocaciones:
// corre DESPUÉS de la búsqueda y es read-only. Prueba la causa de forma
// INDEPENDIENTE del presupuesto de búsqueda (sondeo geométrico exhaustivo de UN
// kit en UNA zona), de modo que un timeout NO se disfrace de imposibilidad.
function cabeEnAlgunaParte(kw, kh, area, ignorarPuertas) {
  const a = ignorarPuertas ? { ...area, puertas: [], obstaculos: [] } : area;
  for (const c of candidatos(a, kw, kh)) {
    if (kitCabe(c.x, c.y, kw, kh, a, []) === null) return true;   // ocupados = [] (sin otros kits)
  }
  return false;
}

export function certificarKit(kit, areas, { budgetExhausted, nodos }) {
  const variantes = [
    { rot: 0, w: kit.base.w, d: kit.base.d },
    { rot: 90, w: kit.base.d, d: kit.base.w },
  ];
  const needM2 = (kit.base.w * kit.base.d) / 1e6;
  const moduloW_m = kit.base.w / 1000, moduloH_m = kit.base.d / 1000;
  const moduloLong = Math.max(moduloW_m, moduloH_m), moduloShort = Math.min(moduloW_m, moduloH_m);

  const permitted_areas = kit.zonas.map((ai) => {
    const area = areas[ai];
    const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
    let fitsDims = false, fitsWithDoors = false;
    for (const v of variantes) {
      if (!fitsDims && cabeEnAlgunaParte(v.w, v.d, area, true)) fitsDims = true;
      if (!fitsWithDoors && cabeEnAlgunaParte(v.w, v.d, area, false)) fitsWithDoors = true;
    }
    return { zone: area.zone_id ?? area.nombre ?? `area_${ai}`, area_idx: ai, areaW_m: round1(W / 1000), areaH_m: round1(H / 1000), areaM2: round1((W * H) / 1e6), fitsDims, fitsWithDoors };
  });

  const haveM2 = permitted_areas.reduce((s, a) => s + a.areaM2, 0);
  const anyFitsDims = permitted_areas.some((a) => a.fitsDims);
  const anyFitsWithDoors = permitted_areas.some((a) => a.fitsWithDoors);
  const rejected_by = kit._rej || {};

  // Causas PROBADAS por el sondeo independiente (no por la heurística de búsqueda).
  const proven = [];
  if (!anyFitsDims) {
    const excedeForma = permitted_areas.every((a) => moduloLong > Math.max(a.areaW_m, a.areaH_m) + 1e-6 || moduloShort > Math.min(a.areaW_m, a.areaH_m) + 1e-6);
    if (excedeForma) proven.push('ASPECT_RATIO');
    if (needM2 > haveM2 + 1e-6) proven.push('NO_SPACE');
    if (!proven.length) proven.push('ASPECT_RATIO');   // no cupo por dims aunque m² total alcance
  } else if (!anyFitsWithDoors) {
    proven.push((rejected_by.DOOR || 0) >= (rejected_by.OBSTACLE || 0) ? 'DOOR' : 'OBSTACLE');
  } else if (needM2 > haveM2 + 1e-6) {
    proven.push('NO_SPACE');
  } else {
    proven.push('CONTIGUOUS_SPACE');   // entra solo, pero no junto a los demás → espacio fragmentado
  }

  // Imposibilidad geométrica DURA: demostrada sin depender del presupuesto.
  const provenGeom = !anyFitsDims || !anyFitsWithDoors;
  let primary_cause;
  if (budgetExhausted && !provenGeom) primary_cause = 'SEARCH_BUDGET_EXHAUSTED';   // 17.2: NO imposibilidad falsa
  else if (proven.length > 1) primary_cause = 'MULTI_CONSTRAINT';                   // 17.3: ninguna causa domina sola
  else primary_cause = proven[0];
  const secondary_causes = proven.filter((c) => c !== primary_cause);

  return {
    permitted_areas,
    orientations: variantes.map((v) => v.rot),
    rejected_by,
    dimensional_fit: { any_fits_dims: anyFitsDims, any_fits_with_doors: anyFitsWithDoors, needM2: round1(needM2), haveM2: round1(haveM2), moduloW_m, moduloH_m },
    search_exhausted: !budgetExhausted,
    nodes_used: nodos,
    primary_cause,
    secondary_causes,
    evidence: { needM2: round1(needM2), haveM2: round1(haveM2), moduloW_m, moduloH_m, nodes_used: nodos, budget_exhausted: !!budgetExhausted },
  };
}

/**
 * C · Solver por bloques con backtracking. Determinista.
 * @returns {{colocacion, unplaced, unassigned, metodo, attempts_used, _nodos}}
 */
export function resolverKits(areas = [], piezas = [], opts = {}) {
  const t0 = Date.now();
  const { piezas: asign, unassigned } = asignarDuenos(piezas);

  const anclas = asign.filter((p) => esAncla(p.relation_role)).sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
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
    const minimoPiezas = base.piezas.filter((p) => esAncla(p.rol) || p.bajoTablero);
    const dropMin = base.piezas.filter((p) => !(esAncla(p.rol) || p.bajoTablero)).map((p) => String(p.id));
    const minW = Math.max(...minimoPiezas.map((p) => p.dx + p.w)), minH = Math.max(...minimoPiezas.map((p) => p.dy + p.d));
    const minimo = { anchorId: base.anchorId, w: minW, d: minH, piezas: minimoPiezas };
    kits.push({ anchorId: String(a.id), base, minimo, dropMin, area: num(a.w) * num(a.d), zonas: areasPermitidas(a, areas) });
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
    id: p.id, area: abs.areaIdx, x: Math.round(abs.x + p.dx), y: Math.round(abs.y + p.dy), rot: abs.rot,
    anchor_instance_id: anchorDe.get(String(p.id)) ?? null,
    slot_id: p.slot_id ?? null, side: p.side ?? null, facing: p.facing ?? null,
    topology: p.topology ?? null, provenance: p.provenance ?? null, profile_version: p.profile_version ?? PROFILE_VERSION,
  });

  function intentarKit(idx) {
    if (Date.now() - t0 > MAX_MS || nodos > MAX_NODOS) { budgetExhausted = true; return idx >= kits.length; }
    if (idx >= kits.length) return true;
    const kit = kits[idx];
    const variantes = [
      { k: kit.base, rot: 0, drop: [] }, { k: rotarKit(kit.base), rot: 90, drop: [] },
      { k: kit.minimo, rot: 0, drop: kit.dropMin }, { k: rotarKit(kit.minimo), rot: 90, drop: kit.dropMin },
    ];
    let mejorMotivo = 'NO_SPACE';
    for (const ai of kit.zonas) {
      const area = areas[ai];
      for (const { k, rot, drop } of variantes) {
        for (const c of candidatos(area, k.w, k.d)) {
          nodos++;
          const motivo = kitCabe(c.x, c.y, k.w, k.d, area, ocupadosPorArea.get(ai));
          if (motivo) {
            // GAP17: histograma de rechazos (SÓLO registra; no altera el flujo).
            kit._rej = kit._rej || {}; kit._rej[motivo] = (kit._rej[motivo] || 0) + 1;
            if (motivo !== 'AISLE') mejorMotivo = motivo; continue;
          }
          ocupadosPorArea.get(ai).push({ x: c.x, y: c.y, w: k.w, d: k.d });
          const abs = { areaIdx: ai, x: c.x, y: c.y, rot };
          const base = colocacion.length;
          k.piezas.forEach((p) => colocacion.push(colocarPieza(abs, p)));
          kitRes[idx] = { dropped: drop };
          if (intentarKit(idx + 1)) return true;
          colocacion.length = base; ocupadosPorArea.get(ai).pop(); kitRes[idx] = null;
        }
      }
    }
    kitRes[idx] = { dropped: kit.base.piezas.map((p) => String(p.id)), invariante: mejorMotivo, fail: true };
    return intentarKit(idx + 1);
  }
  intentarKit(0);

  // Ensambla faltantes: kits sin colocar (fail) + sillas que cayeron al usar la
  // variante mínima. Motivo CAUSAL del invariante limitante (no genérico).
  const unplaced = [];
  kits.forEach((kit, idx) => {
    const res = kitRes[idx] || { dropped: kit.base.piezas.map((p) => String(p.id)), invariante: 'NO_SPACE', fail: true };
    if (res.fail) {
      // GAP17: certificado adjunto (aditivo). `invariante` NO cambia (downstream intacto).
      const certificado = certificarKit(kit, areas, { budgetExhausted, nodos });
      unplaced.push({ anchorId: kit.anchorId, piezas: res.dropped, invariante: res.invariante, certificado });
    } else if (res.dropped && res.dropped.length) {
      unplaced.push({ anchorId: kit.anchorId, piezas: res.dropped, invariante: 'NO_SPACE_PARA_SILLAS' });
    }
  });

  return { colocacion, piezas: asign, unplaced, unassigned, metodo: 'kit-solver-v1', attempts_used: 1, _nodos: nodos };
}
