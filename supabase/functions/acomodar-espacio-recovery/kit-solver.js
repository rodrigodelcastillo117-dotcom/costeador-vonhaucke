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
import { juzgarSemantico } from './semanticPlacementJudge.js';
import { validarColocacion } from './acomodo-core.js';
import { juzgarCalidad, calidadAceptable } from './qualityJudge.js';
import { evaluarRecovery } from './recovery-core.js';

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

// orden === undefined → barrido ROW-MAJOR original (comportamiento por defecto
// BYTE-IDÉNTICO; el banco congelado depende de esto). Las demás estrategias son
// PERMUTACIONES del MISMO conjunto de candidatos (no "interior-first"): mismo set
// legal, distinto orden de primer-ajuste, para que BLOCK 5 explore alternativas
// sin cambiar qué posiciones son válidas.
function candidatos(area, kw, kh, orden, deadline) {
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

// Sonda contrafáctica: ¿cabe kw×kh en el área (VACÍA de otros kits) quitando las
// capas indicadas? ignore.{poly,doors,obstacles} aíslan cada restricción.
function sondearCabida(kw, kh, area, ignore, deadline) {
  const a = { ...area };
  if (ignore.doors) a.puertas = [];
  if (ignore.obstacles) a.obstaculos = [];
  if (ignore.poly) { a.poly = undefined; a.polygon = undefined; }
  for (const c of candidatos(a, kw, kh)) {
    if (Date.now() > deadline) return 'TIMEOUT';
    if (kitCabe(c.x, c.y, kw, kh, a, []) === null) return true;   // ocupados = [] (sin otros kits)
  }
  return false;
}

// Diagnóstico de un variante (full o min) en UNA área: capas BOUNDS/POLYGON y
// contrafácticos FULL / NO_DOORS / NO_OBSTACLES separados.
function diagnosticarEnArea(variantes, area, deadline) {
  let timeout = false;
  const anyOrient = (ignore) => {
    for (const v of variantes) {
      const r = sondearCabida(v.w, v.d, area, ignore, deadline);
      if (r === 'TIMEOUT') { timeout = true; return false; }
      if (r === true) return true;
    }
    return false;
  };
  const fitsBounds  = anyOrient({ poly: true, doors: true, obstacles: true });    // sólo límites
  const fitsPolygon = anyOrient({ poly: false, doors: true, obstacles: true });   // límites + contorno
  const fitsNoDoors = anyOrient({ poly: false, doors: true, obstacles: false });  // sin puertas, CON obstáculos
  const fitsNoObst  = anyOrient({ poly: false, doors: false, obstacles: true });  // CON puertas, sin obstáculos
  const fitsFull    = anyOrient({ poly: false, doors: false, obstacles: false }); // todo
  return { fitsBounds, fitsPolygon, fitsNoDoors, fitsNoObst, fitsFull, timeout };
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
  // fitsPolygon && !fitsFull → puerta / obstáculo (contrafáctico)
  const doorBlocks = dx.fitsNoDoors;                               // quitar puertas lo arregla
  const obstBlocks = dx.fitsNoObst;                                // quitar obstáculos lo arregla
  if (doorBlocks && !obstBlocks) return ['DOOR'];
  if (obstBlocks && !doorBlocks) return ['OBSTACLE'];
  return ['DOOR', 'OBSTACLE'];                                     // ambos o interacción
}

export function certificarKit(kit, areas, { budgetExhausted, nodos, deadline: extDeadline } = {}) {
  // GAP35.C: el diagnóstico respeta el deadline GLOBAL del multi si es más estricto
  // que su propio presupuesto (DIAG_MAX_MS). Nunca lo excede.
  const deadline = Number.isFinite(extDeadline) ? Math.min(Date.now() + DIAG_MAX_MS, extDeadline) : Date.now() + DIAG_MAX_MS;
  const variantesFull = [
    { rot: 0, w: kit.base.w, d: kit.base.d },
    { rot: 90, w: kit.base.d, d: kit.base.w },
  ];
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
    const vMin = [{ rot: 0, w: kit.minimo.w, d: kit.minimo.d }, { rot: 90, w: kit.minimo.d, d: kit.minimo.w }];
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

  return {
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
  const base = { budgetExhausted: ctx.budgetExhausted, nodos: ctx.nodos, deadline };
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

  const deadline = Number.isFinite(opts.deadline) ? opts.deadline : null;   // GAP27: presupuesto compartido
  function intentarKit(idx) {
    if (Date.now() - t0 > MAX_MS || nodos > MAX_NODOS || (deadline && Date.now() >= deadline)) { budgetExhausted = true; return idx >= kits.length; }
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
        for (const c of candidatos(area, k.w, k.d, opts.orden, deadline)) {
          nodos++;
          // GAP35.A: checar deadline DENTRO del barrido (no sólo al entrar a intentarKit),
          // para que una malla grande no exceda el presupuesto. Cada 512 nodos (barato).
          if (deadline && (nodos % 512 === 0) && Date.now() >= deadline) { budgetExhausted = true; return idx >= kits.length; }
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
  // GAP35.C: durante la EXPLORACIÓN multi, los certificados causales (costosos) se
  // OMITEN (certificados:false) y se calculan sólo para el GANADOR al final. El camino
  // por defecto (banco) mantiene certificados:true → salida byte-idéntica.
  const conCertificados = opts.certificados !== false;
  const certCtx = { budgetExhausted, nodos, deadline };
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
  const _cert_ctx = { kitsByAnchor, budgetExhausted, nodos };
  return { colocacion, piezas: asign, unplaced, unassigned, metodo: 'kit-solver-v1', attempts_used: 1, _nodos: nodos, _cert_ctx };
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
const ESTRATEGIAS_MULTI = [undefined, 'center', 'reverse', 'col', 'colReverse'];
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

  return {
    placed, hardOk, hard_issues: hardFails.length,
    sem_status: sem.status, semFail, semReview, semantic_pass, semRank,
    quality, quality_status, quality_components, quality_reasons,
  };
}

// Orden TOTAL en capas: HARD → SEMANTIC(rank PASS>REVIEW>FAIL) → COMPLETENESS →
// QUALITY. Empate → #0. Una solución con FAIL semántico JAMÁS gana a una PASS, y
// una PASS gana a una REVIEW_REQUIRED (GAP18), por más piezas o score que tengan.
export function mejorCandidato(a, b) {
  const x = a.eval, y = b.eval;
  if (x.hardOk !== y.hardOk) return x.hardOk ? a : b;                         // 1 HARD
  if (!x.hardOk && x.hard_issues !== y.hard_issues) return x.hard_issues < y.hard_issues ? a : b;
  if (x.semRank !== y.semRank) return x.semRank > y.semRank ? a : b;         // 2 SEMANTIC: PASS>REVIEW>FAIL
  if (x.semFail !== y.semFail) return x.semFail < y.semFail ? a : b;
  if (x.semReview !== y.semReview) return x.semReview < y.semReview ? a : b;
  if (x.placed !== y.placed) return x.placed > y.placed ? a : b;             // 3 COMPLETENESS
  if (x.quality !== y.quality) return x.quality > y.quality ? a : b;         // 4 QUALITY (score)
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
  let ganador = null;
  let budgetExhaustedMulti = false;

  for (let i = 0; i < estrategias.length; i++) {
    // GAP27: no arrancar otro candidato si ya no queda presupuesto REAL (cada solve
    // puede consumir hasta MAX_MS). El deadline se pasa al solver para que corte.
    if (i > 0 && Date.now() >= deadline) { budgetExhaustedMulti = true; break; }
    const orden = estrategias[i];
    // GAP35.C: exploración SIN certificados causales (costosos); se certifica sólo al ganador.
    const sol = resolverKits(areas, piezas, { orden, deadline, certificados: false });
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
      publicable: winnerLimpio,
      metrics: { elapsed_ms, budget_ms: budget, budget_mode: 'SOFT_MULTI_BUDGET', budget_exhausted: budgetExhaustedMulti, budget_exceeded: budgetExceeded, winner_strategy: ganador.orden, candidates_evaluated: cands.length },
      por_candidato: cands.map((c) => ({ idx: c.idx, orden: c.orden, placed: c.eval.placed, hardOk: c.eval.hardOk, hard_issues: c.eval.hard_issues, sem_status: c.eval.sem_status, semRank: c.eval.semRank, semFail: c.eval.semFail, semReview: c.eval.semReview, quality: c.eval.quality, quality_status: c.eval.quality_status })),
    },
  };
}
