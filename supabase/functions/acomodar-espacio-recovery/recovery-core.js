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
import {
  rectsSeSolapan, rectDentroPoligono, bloqueaPuertaEspacial,
} from '../acomodar-espacio/spatial-core.js';

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

/**
 * Evaluación RECOVERY completa: base (bounds/overlap/puerta/obstáculo/ghost) +
 * MUROS + CIRCULACIÓN, con derivación de estado. `requested` para cobertura.
 */
export function evaluarRecovery(areas = [], piezas = [], colocacion = [], { minPasillo = CONTRATO.min_pasillo_mm, requested = null, repairAgotado = false } = {}) {
  const issues = [
    ...invariantesBase(areas, piezas, colocacion),
    ...invariantesMuros(areas, piezas, colocacion),
    ...invariantesCirculacion(areas, piezas, colocacion, minPasillo),
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
