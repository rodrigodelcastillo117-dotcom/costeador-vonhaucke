// ============================================================================
//  P0.2c · BLOCK 3 · SEMANTIC PLACEMENT JUDGE (separado del juez geométrico).
//
//  NO toca el juez geométrico congelado (bench/acomodo/judge.js). Decide si un
//  acomodo tiene SENTIDO FUNCIONAL, no sólo si es geométricamente legal.
//
//  Un layout FINAL requiere:  HARD_GEOMETRY = PASS  AND  SEMANTIC_PLACEMENT = PASS.
//  Topología desconocida → REVIEW_REQUIRED. Nunca UNKNOWN → PASS silencioso.
//
//  GAP8  · TODO MEETING_SEAT es lado ACTIVO, incl. HEAD_A/HEAD_B (hay persona).
//          PASSIVE_END es concepto del ANCLA/profile de un bench (extremo SIN silla),
//          no se infiere del nombre de un slot de silla.
//  GAP9  · slots esperados derivados de la topología confirmada (unfilled/wrong/
//          topology-broken/kit-relation).
//  GAP12 · separar IMPOSIBILIDAD FUNCIONAL DURA (acceso bloqueado por muro/obstáculo
//          = inutilizable → fail) del OBJETIVO DE CONFORT PROVISIONAL (600 mm → quality).
// ============================================================================
import { layoutDeTopologia } from './placementProfiles.js';

const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esDependiente = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);

// Umbral DURO de impossibilidad física (flush contra muro/obstáculo). PROVISIONAL.
export const HARD_ACCESS_MM = 0;        // clearance ≤ 0 = inutilizable → fail
// Objetivo de CONFORT (QualityJudge). PROVISIONAL, NO es verdad Von Haucke todavía.
export const QUALITY_ACCESS_TARGET_MM = 600;

// Roles de silla ACEPTADOS por tipo de ancla (para KIT_FUNCTIONAL_RELATION_BROKEN).
// RESCATE 2026-10-10 (E2E Torre Sur, 3 rutas): un privado real lleva la silla directiva
// Y sus sillas de visita (regla de la casa: 2 CONCERTO por privado); el juez sólo
// aceptaba EXECUTIVE_SEAT y marcaba FAIL a las visitas → NEEDS_SEMANTIC_REVIEW sin
// salida. Versión FUENTE (v+1); la edge desplegada sigue con la regla vieja hasta
// que Rodrigo autorice el despliegue.
const SEAT_ROLES_DE_ANCLA = {
  ANCHOR_WORKSTATION: ['WORK_SEAT'],
  ANCHOR_MEETING: ['MEETING_SEAT'],
  ANCHOR_DESK: ['EXECUTIVE_SEAT', 'VISITOR_SEAT'],
  ANCHOR_RECEPTION: ['VISITOR_SEAT'],
};

function rectDe(c, p) {
  const g = num(c.rot) === 90 || num(c.rot) === 270;
  return { x: num(c.x), y: num(c.y), w: g ? num(p.d) : num(p.w), d: g ? num(p.w) : num(p.d) };
}
const solapan = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
function apuntaAlAncla(s, a, facing) {
  const cx = s.x + s.w / 2, cy = s.y + s.d / 2, ax = a.x + a.w / 2, ay = a.y + a.d / 2;
  if (facing === 'UP') return ay < cy;
  if (facing === 'DOWN') return ay > cy;
  if (facing === 'LEFT') return ax < cx;
  if (facing === 'RIGHT') return ax > cx;
  return false;
}
// Clearance disponible en el lado de ACCESO (opuesto al facing): mínimo entre el
// muro y el obstáculo más cercano en esa dirección dentro del ancho del asiento.
function clearanceAcceso(s, facing, area) {
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  let cMuro, limitador = 'wall';
  if (facing === 'DOWN') cMuro = s.y;                       // acceso arriba
  else if (facing === 'UP') cMuro = H - (s.y + s.d);        // acceso abajo
  else if (facing === 'RIGHT') cMuro = s.x;                 // acceso izquierda
  else if (facing === 'LEFT') cMuro = W - (s.x + s.w);      // acceso derecha
  else return { clear: Infinity, limitador: 'none' };
  let cObs = Infinity;
  for (const o of (area.obstaculos || [])) {
    const ox = num(o.x), oy = num(o.y), ow = num(o.w), oh = num(o.h);
    if (facing === 'DOWN' && oy + oh <= s.y + 1 && ox < s.x + s.w && ox + ow > s.x) cObs = Math.min(cObs, s.y - (oy + oh));
    if (facing === 'UP' && oy >= s.y + s.d - 1 && ox < s.x + s.w && ox + ow > s.x) cObs = Math.min(cObs, oy - (s.y + s.d));
    if (facing === 'RIGHT' && ox + ow <= s.x + 1 && oy < s.y + s.d && oy + oh > s.y) cObs = Math.min(cObs, s.x - (ox + ow));
    if (facing === 'LEFT' && ox >= s.x + s.w - 1 && oy < s.y + s.d && oy + oh > s.y) cObs = Math.min(cObs, ox - (s.x + s.w));
  }
  if (cObs < cMuro) { limitador = 'obstacle'; return { clear: cObs, limitador }; }
  return { clear: cMuro, limitador };
}

// Slots esperados (slot_id + side) de un ancla, por su topología confirmada.
function slotsEsperados(anchorPieza, nDeps) {
  const topo = anchorPieza._topology;
  if (!topo || topo === 'UNKNOWN') return null;
  const lay = layoutDeTopologia(topo, num(anchorPieza.w), num(anchorPieza.d), nDeps);
  return lay.seats.map((s) => ({ slot_id: s.slot_id, side: s.side }));
}

export function juzgarSemantico(areas = [], piezas = [], colocacion = []) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const issues = [];
  const add = (code, extra = {}) => issues.push({ code, ...extra });

  const anclas = new Map();
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esAncla(p.relation_role)) continue;
    anclas.set(String(c.id), { pieza: { ...p, _topology: c.topology ?? null }, rect: rectDe(c, p), rol: p.relation_role, topology: c.topology ?? null });
  }
  const depsPorAncla = new Map();
  for (const p of piezas) {
    if (!esDependiente(p.relation_role)) continue;
    const a = p.anchor_instance_id != null ? String(p.anchor_instance_id) : null; if (!a) continue;
    if (!depsPorAncla.has(a)) depsPorAncla.set(a, []);
    depsPorAncla.get(a).push(p);
  }
  const colSeatPorAncla = new Map();
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esDependiente(p.relation_role)) continue;
    const a = c.anchor_instance_id != null ? String(c.anchor_instance_id) : null; if (!a) continue;
    if (!colSeatPorAncla.has(a)) colSeatPorAncla.set(a, []);
    colSeatPorAncla.get(a).push(c);
  }

  // 1 · Topología desconocida → REVIEW_REQUIRED.
  for (const [id, a] of anclas) if (!a.topology || a.topology === 'UNKNOWN') add('SEMANTIC_PROFILE_UNKNOWN', { anchor: id, severity: 'review' });

  // 2 · Slots requeridos / mal slot / topología rota / relación de kit (GAP9).
  for (const [id, a] of anclas) {
    if (!a.topology || a.topology === 'UNKNOWN') continue;
    const deps = depsPorAncla.get(id) || [];
    const esperados = slotsEsperados(a.pieza, deps.length);
    if (!esperados) continue;
    const esperadoSlots = new Set(esperados.map((s) => s.slot_id));
    const colocados = colSeatPorAncla.get(id) || [];
    const slotsColocados = new Set(colocados.map((c) => c.slot_id).filter(Boolean));
    for (const s of esperados) if (!slotsColocados.has(s.slot_id)) add('SLOT_UNFILLED_REQUIRED', { anchor: id, slot: s.slot_id, severity: 'fail' });
    const rolesEsperados = SEAT_ROLES_DE_ANCLA[a.rol];
    for (const c of colocados) {
      const p = byId.get(String(c.id));
      if (c.slot_id && !esperadoSlots.has(c.slot_id)) add('DEPENDENT_WRONG_SLOT', { id: c.id, slot: c.slot_id, anchor: id, severity: 'fail' });
      if (rolesEsperados && p && !rolesEsperados.includes(p.relation_role)) add('KIT_FUNCTIONAL_RELATION_BROKEN', { id: c.id, rol: p.relation_role, esperado: rolesEsperados.join('|'), anchor: id, severity: 'fail' });
    }
    const sidesEsperados = new Set(esperados.map((s) => s.side));
    const sidesColocados = new Set(colocados.map((c) => c.side).filter(Boolean));
    if (colocados.length > 0 && sidesColocados.size < sidesEsperados.size && (a.topology === 'DOUBLE_FACE' || a.topology === 'MEETING_TABLE')) {
      add('ANCHOR_TOPOLOGY_BROKEN', { anchor: id, topology: a.topology, sides: [...sidesColocados], severity: 'fail' });
    }
  }

  // 3 · Slots duplicados.
  const slotVistos = new Map();
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esDependiente(p.relation_role) || !c.slot_id) continue;
    const key = `${c.anchor_instance_id}#${c.slot_id}`;
    if (slotVistos.has(key)) add('SLOT_DOUBLE_OCCUPIED', { slot: c.slot_id, anchor: c.anchor_instance_id, ids: [slotVistos.get(key), c.id], severity: 'fail' });
    else slotVistos.set(key, c.id);
  }

  // 4 · Orientación + acceso. TODA silla (incl. HEAD de junta) es ACTIVA (GAP8).
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esDependiente(p.relation_role)) continue;
    const anc = c.anchor_instance_id != null ? anclas.get(String(c.anchor_instance_id)) : null;
    if (!anc) continue;
    const sRect = rectDe(c, p);
    if (!c.facing) { add('INVALID_FACING', { id: c.id, severity: 'fail' }); continue; }
    if (!apuntaAlAncla(sRect, anc.rect, c.facing)) add('DEPENDENT_WRONG_ORIENTATION', { id: c.id, facing: c.facing, severity: 'fail' });
    const area = areas[num(c.area)] || {};
    const { clear, limitador } = clearanceAcceso(sRect, c.facing, area);
    if (clear <= HARD_ACCESS_MM) {
      add(limitador === 'obstacle' ? 'ACTIVE_SIDE_BLOCKED_BY_OBSTACLE' : 'ACTIVE_SIDE_BLOCKED_BY_WALL', { id: c.id, side: c.side, clear, severity: 'fail' });
    } else if (clear < QUALITY_ACCESS_TARGET_MM) {
      add('ACTIVE_SIDE_ACCESS_TIGHT', { id: c.id, side: c.side, clear, target: QUALITY_ACCESS_TARGET_MM, severity: 'quality', provenance: 'PROVISIONAL' });
    }
  }

  const hayFail = issues.some((i) => i.severity === 'fail');
  const hayReview = issues.some((i) => i.severity === 'review');
  const status = hayFail ? 'FAIL' : (hayReview ? 'REVIEW_REQUIRED' : 'PASS');
  return { status, issues, hard_access_mm: HARD_ACCESS_MM, quality_access_target_mm: QUALITY_ACCESS_TARGET_MM, quality_provenance: 'PROVISIONAL' };
}

// Contrato final: sólo PASS si geometría dura Y semántica pasan.
export function esFinalValido(geomStatus, sem) {
  return geomStatus === 'PASS' && sem && sem.status === 'PASS';
}
