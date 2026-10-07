// ============================================================================
//  acomodar-espacio-RECOVERY · NÚCLEO PURO (P0.2 · PENDIENTE DE ACTIVACIÓN)
//
//  ⚠️ Esta fuente NO está desplegada. El cliente sigue invocando la función
//  `acomodar-espacio-recovery` VIVA (desplegada fuera de banda). Este archivo
//  pone esa lógica BAJO CONTROL DE CÓDIGO y agrega los invariantes que P0.2 exige
//  y que el edge productivo no modela como regla dura: MUROS (first-class) y
//  ANCHO DE CIRCULACIÓN. Reutiliza los helpers puros compartidos del lane
//  productivo (no duplica geometría de puertas/obstáculos/clearances).
//
//  Contrato VERSIONADO de entrada/salida (determinista). Todo en mm.
// ============================================================================
// Cores VENDORIZADOS en este mismo directorio (self-contained para el deploy aislado
// del Edge de Supabase; imports cruzados a ../acomodar-espacio fallaban con 500).
import {
  rectsSeSolapan, rectDentroPoligono, bloqueaPuertaEspacial,
} from './spatial-core.js';
// GAP5 · validación SEMÁNTICA (grupos/zona) del core compartido: sus fallas entran
// a issues, bajan status y ponen render_ready=false.
import { auditarGruposFuncionales } from './acomodo-core.js';

export const CONTRATO = Object.freeze({
  input_version: 'ACOMODO_INPUT_V1',
  output_version: 'PLACEMENT_SPEC_V2_RECOVERY',
  // Pasillo de circulación objetivo (regla dura en este lane, no sólo métrica).
  min_pasillo_mm: 1000,
});

const EPS = 1;

// Rect de una colocación respecto a la pieza (rot 0/90 intercambia w/d). Local al área.
export function rectDeColoc(pieza = {}, coloc = {}) {
  const rot = Number(coloc.rot) || 0;
  const girado = rot === 90 || rot === 270;
  // Convención de los helpers compartidos: rect = {x, y, w, d} (d = profundidad/alto 2D).
  return {
    x: Number(coloc.x) || 0, y: Number(coloc.y) || 0,
    w: girado ? Number(pieza.d) || 0 : Number(pieza.w) || 0,
    d: girado ? Number(pieza.w) || 0 : Number(pieza.d) || 0,
  };
}

// --- MUROS (first-class). Segmento {x1,y1,x2,y2}; ¿cruza un rect? ----------
function orient(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}
function segsIntersecan(p1, p2, p3, p4) {
  const o1 = orient(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  const o2 = orient(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1]);
  const o3 = orient(p3[0], p3[1], p4[0], p4[1], p1[0], p1[1]);
  const o4 = orient(p3[0], p3[1], p4[0], p4[1], p2[0], p2[1]);
  return o1 !== o2 && o3 !== o4;
}
export function cruzaMuro(rect, muro) {
  const x1 = Number(muro.x1) || 0, y1 = Number(muro.y1) || 0, x2 = Number(muro.x2) || 0, y2 = Number(muro.y2) || 0;
  const A = [rect.x, rect.y], B = [rect.x + rect.w, rect.y], C = [rect.x + rect.w, rect.y + rect.d], D = [rect.x, rect.y + rect.d];
  const seg = [[x1, y1], [x2, y2]];
  const lados = [[A, B], [B, C], [C, D], [D, A]];
  if (lados.some(([p, q]) => segsIntersecan(p, q, seg[0], seg[1]))) return true;
  // Muro con un extremo encerrado dentro del rect.
  const dentro = ([px, py]) => px > rect.x + EPS && px < rect.x + rect.w - EPS && py > rect.y + EPS && py < rect.y + rect.d - EPS;
  return dentro(seg[0]) || dentro(seg[1]);
}

export function invariantesMuros(areas = [], piezas = [], colocacion = []) {
  const porId = new Map(piezas.map((p) => [String(p.id), p]));
  const issues = [];
  for (const c of colocacion) {
    const pieza = porId.get(String(c.id)); if (!pieza) continue;
    const area = areas[Number(c.area)]; if (!area || !Array.isArray(area.muros)) continue;
    const rect = rectDeColoc(pieza, c);
    for (const m of area.muros) {
      if (cruzaMuro(rect, m)) { issues.push({ code: 'WALL_CROSS', severity: 'fail', id: String(c.id), area: Number(c.area) }); break; }
    }
  }
  return issues;
}

// --- CIRCULACIÓN (ancho de pasillo como regla dura, conservadora) ----------
// Marca CIRCULATION_TIGHT cuando dos piezas del mismo área se enfrentan con un
// hueco 1..min_pasillo (una persona tendría que pasar por un pasillo demasiado
// angosto). Hueco 0 (a tope) no es pasillo; hueco ≥ min es correcto.
export function invariantesCirculacion(areas = [], piezas = [], colocacion = [], minPasillo = CONTRATO.min_pasillo_mm) {
  const porId = new Map(piezas.map((p) => [String(p.id), p]));
  const porArea = new Map();
  for (const c of colocacion) {
    const pieza = porId.get(String(c.id)); if (!pieza) continue;
    const ai = Number(c.area);
    if (!porArea.has(ai)) porArea.set(ai, []);
    porArea.get(ai).push({ id: String(c.id), r: rectDeColoc(pieza, c) });
  }
  const issues = [];
  for (const [ai, lista] of porArea) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i].r, b = lista[j].r;
        const solapaY = a.y < b.y + b.d - EPS && a.y + a.d > b.y + EPS;
        const solapaX = a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS;
        if (solapaY && !solapaX) {
          const hueco = a.x < b.x ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
          if (hueco > EPS && hueco < minPasillo - EPS) issues.push({ code: 'CIRCULATION_TIGHT', severity: 'fail', id: `${lista[i].id}|${lista[j].id}`, area: ai, huecoMM: Math.round(hueco), eje: 'x' });
        } else if (solapaX && !solapaY) {
          const hueco = a.y < b.y ? b.y - (a.y + a.d) : a.y - (b.y + b.d);
          if (hueco > EPS && hueco < minPasillo - EPS) issues.push({ code: 'CIRCULATION_TIGHT', severity: 'fail', id: `${lista[i].id}|${lista[j].id}`, area: ai, huecoMM: Math.round(hueco), eje: 'y' });
        }
      }
    }
  }
  return issues;
}

// --- D · INVARIANTE RELACIONAL (dependiente unido a su ancla) ---------------
const ATTACH_MM = 1200;
const esAnclaRol = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esDepRol = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT', 'UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);
function distRects(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.d), b.y - (a.y + a.d)));
  return Math.hypot(dx, dy);
}
export function invariantesRelacionales(piezas = [], colocacion = []) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const rectById = new Map();
  for (const c of colocacion) { const p = byId.get(String(c.id)); if (p) rectById.set(String(c.id), { ...rectDeColoc(p, c), area: Number(c.area), rol: p.relation_role, anchor: p.anchor_instance_id != null ? String(p.anchor_instance_id) : null }); }
  const issues = [];
  for (const [id, r] of rectById) {
    if (!esDepRol(r.rol)) continue;
    if (!r.anchor) { issues.push({ code: 'DEPENDENT_UNASSIGNED', severity: 'fail', id }); continue; }
    const anc = rectById.get(r.anchor);
    if (!anc || !esAnclaRol(anc.rol)) { issues.push({ code: 'DEPENDENT_DETACHED', severity: 'fail', id, motivo: 'ancla no colocada' }); continue; }
    if (anc.area !== r.area || distRects(r, anc) > ATTACH_MM) issues.push({ code: 'DEPENDENT_DETACHED', severity: 'fail', id, area: r.area });
  }
  return issues;
}

// --- BOUNDS / OVERLAP / PUERTA / OBSTÁCULO (reusa helpers compartidos) ------
function invariantesBase(areas = [], piezas = [], colocacion = []) {
  const porId = new Map(piezas.map((p) => [String(p.id), p]));
  const issues = [];
  const porArea = new Map();
  for (const c of colocacion) {
    const pieza = porId.get(String(c.id));
    if (!pieza) { issues.push({ code: 'GHOST_PLACEMENT', severity: 'fail', id: String(c.id) }); continue; }
    const ai = Number(c.area); const area = areas[ai];
    if (!area) { issues.push({ code: 'AREA_INEXISTENTE', severity: 'fail', id: String(c.id), area: ai }); continue; }
    const rect = rectDeColoc(pieza, c);
    const W = Number(area.ancho) || Number(area.width_mm) || 0, H = Number(area.largo) || Number(area.depth_mm) || 0;
    const polyOk = Array.isArray(area.poly) ? rectDentroPoligono(rect, area.poly) : true;
    if (rect.x < -EPS || rect.y < -EPS || rect.x + rect.w > W + EPS || rect.y + rect.d > H + EPS || !polyOk) {
      issues.push({ code: 'OUT_OF_BOUNDS', severity: 'fail', id: String(c.id), area: ai });
    }
    for (const o of (Array.isArray(area.obstaculos) ? area.obstaculos : [])) {
      if (rectsSeSolapan(rect, { x: Number(o.x) || 0, y: Number(o.y) || 0, w: Number(o.w) || 0, h: Number(o.h) || 0 })) {
        issues.push({ code: 'HITS_OBSTACLE', severity: 'fail', id: String(c.id), area: ai }); break;
      }
    }
    for (const p of (Array.isArray(area.puertas) ? area.puertas : [])) {
      if (bloqueaPuertaEspacial(rect, p)) { issues.push({ code: 'BLOCKS_DOOR', severity: 'fail', id: String(c.id), area: ai }); break; }
    }
    if (!porArea.has(ai)) porArea.set(ai, []);
    porArea.get(ai).push({ id: String(c.id), rect });
  }
  for (const [ai, lista] of porArea) {
    for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
      if (rectsSeSolapan(lista[i].rect, lista[j].rect)) issues.push({ code: 'OVERLAP', severity: 'fail', id: `${lista[i].id}|${lista[j].id}`, area: ai });
    }
  }
  return issues;
}

// --- REPARACIÓN DETERMINISTA (audit F) --------------------------------------
// Índice de área destino de una pieza: por zone_id/nombre; si no, su área previa.
function areaDestino(areas, pieza, areaPrev) {
  const z = pieza?.zone_id;
  if (z != null) {
    const nz = String(z).toLowerCase();
    const i = areas.findIndex((a) => String(a?.zone_id ?? a?.nombre ?? '').toLowerCase() === nz);
    if (i >= 0) return i;
  }
  return Number.isFinite(areaPrev) ? areaPrev : 0;
}

// ¿Cabe `rect` en `area` sin chocar con ocupados/obstáculos/puertas/muros ni
// violar circulación? Determinista.
function cabe(rect, area, ocupados, minPasillo) {
  const W = Number(area?.ancho) || Number(area?.width_mm) || 0, H = Number(area?.largo) || Number(area?.depth_mm) || 0;
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > W + EPS || rect.y + rect.d > H + EPS) return false;
  if (Array.isArray(area?.poly) && !rectDentroPoligono(rect, area.poly)) return false;
  for (const o of (Array.isArray(area?.obstaculos) ? area.obstaculos : [])) {
    if (rectsSeSolapan(rect, { x: +o.x || 0, y: +o.y || 0, w: +o.w || 0, d: +o.h || 0 })) return false;
  }
  for (const p of (Array.isArray(area?.puertas) ? area.puertas : [])) {
    if (bloqueaPuertaEspacial(rect, p)) return false;
  }
  for (const m of (Array.isArray(area?.muros) ? area.muros : [])) {
    if (cruzaMuro(rect, m)) return false;
  }
  for (const oc of ocupados) {
    if (rectsSeSolapan(rect, oc)) return false;
    // circulación: huecos 1..minPasillo entre piezas enfrentadas quedan prohibidos.
    const solapaY = rect.y < oc.y + oc.d - EPS && rect.y + rect.d > oc.y + EPS;
    const solapaX = rect.x < oc.x + oc.w - EPS && rect.x + rect.w > oc.x + EPS;
    if (solapaY && !solapaX) { const h = rect.x < oc.x ? oc.x - (rect.x + rect.w) : rect.x - (oc.x + oc.w); if (h > EPS && h < minPasillo - EPS) return false; }
    if (solapaX && !solapaY) { const h = rect.y < oc.y ? oc.y - (rect.y + rect.d) : rect.y - (oc.y + oc.d); if (h > EPS && h < minPasillo - EPS) return false; }
  }
  return true;
}

/**
 * Reparación: conserva las colocaciones VÁLIDAS, re-coloca las inválidas/faltantes
 * en espacio libre (grid determinista) respetando zona/bounds/obstáculos/puertas/
 * muros/circulación. Devuelve { colocacion, movidas }. Si nada cambió, movidas=[].
 * @param {{areas,piezas,colocacionPrev,evalPrev,minPasillo?}} _
 */
export function proponerReparacion({ areas = [], piezas = [], colocacionPrev = [], evalPrev = null, minPasillo = CONTRATO.min_pasillo_mm }) {
  const porId = new Map(piezas.map((p) => [String(p.id), p]));
  // ids involucrados en una falla (incluye pares 'a|b').
  const malos = new Set();
  for (const is of (evalPrev?.issues || [])) {
    if (is.severity !== 'fail' || !is.id) continue;
    String(is.id).split('|').forEach((x) => malos.add(x));
  }
  const prevPorId = new Map(colocacionPrev.map((c) => [String(c.id), c]));
  // Conserva válidas (existen, no están en falla).
  const keep = colocacionPrev.filter((c) => porId.has(String(c.id)) && !malos.has(String(c.id)));
  const ocupadosPorArea = new Map();
  for (const c of keep) {
    const ai = Number(c.area);
    if (!ocupadosPorArea.has(ai)) ocupadosPorArea.set(ai, []);
    ocupadosPorArea.get(ai).push(rectDeColoc(porId.get(String(c.id)), c));
  }
  // Piezas a (re)colocar: faltantes + inválidas.
  const keepIds = new Set(keep.map((c) => String(c.id)));
  const porColocar = piezas.filter((p) => !keepIds.has(String(p.id)));
  const nuevas = [];
  const paso = Math.max(100, Math.round(minPasillo / 2));
  for (const pieza of porColocar) {
    const prev = prevPorId.get(String(pieza.id));
    const ai = areaDestino(areas, pieza, prev ? Number(prev.area) : undefined);
    const area = areas[ai]; if (!area) continue;
    const ocup = ocupadosPorArea.get(ai) || (ocupadosPorArea.set(ai, []), ocupadosPorArea.get(ai));
    const W = Number(area.ancho) || 0, H = Number(area.largo) || 0;
    let puesta = null;
    for (let y = 0; y <= H && !puesta; y += paso) {
      for (let x = 0; x <= W && !puesta; x += paso) {
        const rect = { x, y, w: Number(pieza.w) || 0, d: Number(pieza.d) || 0 };
        if (cabe(rect, area, ocup, minPasillo)) puesta = { x, y };
      }
    }
    if (puesta) {
      nuevas.push({ id: String(pieza.id), area: ai, x: puesta.x, y: puesta.y, rot: 0 });
      ocup.push({ x: puesta.x, y: puesta.y, w: Number(pieza.w) || 0, d: Number(pieza.d) || 0 });
    }
    // si no cabe, queda sin colocar (cobertura lo marcará PARTIAL).
  }
  const colocacion = [...keep, ...nuevas];
  // movidas = ids cuya posición cambió respecto a la previa.
  const clave = (c) => `${c.area}:${Math.round(c.x)},${Math.round(c.y)},${Number(c.rot) || 0}`;
  const movidas = colocacion.filter((c) => {
    const p = prevPorId.get(String(c.id));
    return !p || clave(p) !== clave(c);
  }).map((c) => String(c.id));
  return { colocacion, movidas };
}

/**
 * Evaluación RECOVERY completa: base (bounds/overlap/puerta/obstáculo/ghost) +
 * MUROS + CIRCULACIÓN, con derivación de estado. `requested` para cobertura.
 */
export function evaluarRecovery(areas = [], piezas = [], colocacion = [], { minPasillo = CONTRATO.min_pasillo_mm, requested = null, repairAgotado = false } = {}) {
  const issues = [
    ...invariantesBase(areas, piezas, colocacion),
    ...invariantesMuros(areas, piezas, colocacion),
    ...invariantesCirculacion(areas, piezas, colocacion, minPasillo),
    // GAP5: fallas semánticas (grupo funcional / dependiente fuera de la zona de su
    // ancla) — geometría perfecta NO basta para PASS si la semántica está mal.
    ...auditarGruposFuncionales(piezas, colocacion).map((i) => ({ ...i, severity: 'fail' })),
    // D (P0.2b): dependiente unido a su ancla. PASS sólo si todo colocado, en su
    // cuarto y UNIDO a su ancla.
    ...invariantesRelacionales(piezas, colocacion),
  ];
  const req = Number.isFinite(requested) ? requested : piezas.length;
  const colocados = new Set(colocacion.map((c) => String(c.id)).filter((id) => piezas.some((p) => String(p.id) === id)));
  const placed = colocados.size;
  const unplaced = piezas.map((p) => String(p.id)).filter((id) => !colocados.has(id));
  const invariant_ok = req === placed + unplaced.length;
  if (!invariant_ok) issues.push({ code: 'PLACEMENT_INVARIANT_BROKEN', severity: 'fail', requested: req, placed });

  const hayFail = issues.some((i) => i.severity === 'fail');
  let status;
  if (hayFail) status = repairAgotado ? 'NEEDS_REVIEW' : 'FAIL';
  else if (unplaced.length > 0) status = 'PARTIAL';
  else status = 'PASS';
  const render_ready = status === 'PASS';

  return {
    output_version: CONTRATO.output_version,
    status, render_ready, invariant_ok,
    requested: req, placed, unplaced, issues,
  };
}
