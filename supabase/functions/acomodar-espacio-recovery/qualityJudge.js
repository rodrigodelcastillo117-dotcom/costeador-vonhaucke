// ============================================================================
//  P0.2c · BLOCK 5 · QUALITY JUDGE (explicable). Puntúa SÓLO candidatos que YA
//  pasaron HARD y SEMANTIC; el score JAMÁS compensa una falla dura o semántica
//  (esos son gates, no puntos). Reutiliza `evaluarCalidad` (spatial-core) como
//  componente espacial en lugar de duplicarlo, y agrega componentes explicables.
//
//  Salida: { total_score (0..100), components:{nombre:{score0..1,weight,detail}}, reasons[] }
// ============================================================================
import { evaluarCalidad } from './spatial-core.js';

const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esDependiente = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function rectDe(c, p) {
  const g = num(c.rot) === 90;
  return { x: num(c.x), y: num(c.y), w: g ? num(p.d) : num(p.w), d: g ? num(p.w) : num(p.d) };
}

// Ponderaciones (no todas pesan igual). HARD/SEMANTIC no están aquí: son gates.
const PESOS = {
  spatial: 0.22,
  active_side_clearance: 0.20,
  accessibility: 0.14,
  grouping: 0.12,
  orientation_consistency: 0.10,
  symmetry: 0.08,
  utilization: 0.08,
  wall_usage: 0.03,
  circulation: 0.03,
};

export function juzgarCalidad(areas = [], piezas = [], colocacion = [], { porPieza = [], semantic = null } = {}) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const comps = {};
  const reasons = [];
  const add = (name, score, detail) => { comps[name] = { score: +clamp01(score).toFixed(3), weight: PESOS[name] ?? 0, detail }; };

  // 1 · ESPACIAL (reusa evaluarCalidad: 0..100 → 0..1).
  const esp = evaluarCalidad(areas, piezas, colocacion, porPieza);
  add('spatial', num(esp.score) / 100, { score_raw: esp.score, soft_penalty: esp.soft_penalty });

  // Issues semánticos (ya pasó el gate → sin fails; puede traer 'quality'/'review').
  const issues = (semantic && Array.isArray(semantic.issues)) ? semantic.issues : [];
  const tight = issues.filter((i) => i.code === 'ACTIVE_SIDE_ACCESS_TIGHT');
  const seats = colocacion.filter((c) => esDependiente((byId.get(String(c.id)) || {}).relation_role));
  const nSeats = seats.length || 1;

  // 2 · ACCESO LADO ACTIVO: proporción de sillas SIN acceso apretado.
  add('active_side_clearance', 1 - tight.length / nSeats, { tight: tight.length, seats: nSeats });

  // 3 · ACCESSIBILITY: holgura media normalizada (600 mm objetivo) de los accesos medidos.
  if (tight.length) {
    const avg = tight.reduce((s, i) => s + num(i.clear), 0) / tight.length;
    const target = num(tight[0].target, 600);
    add('accessibility', avg / target, { avg_clear_mm: Math.round(avg), target_mm: target });
  } else {
    add('accessibility', 1, { avg_clear_mm: '>=target', target_mm: 600 });
  }

  // 4 · GROUPING: dependientes cerca de su ancla (compacidad del grupo funcional).
  const anclaRect = new Map();
  for (const c of colocacion) { const p = byId.get(String(c.id)); if (p && esAncla(p.relation_role)) anclaRect.set(String(c.id), rectDe(c, p)); }
  let gSum = 0, gN = 0;
  for (const c of seats) {
    const aId = c.anchor_instance_id != null ? String(c.anchor_instance_id) : null;
    const ar = aId ? anclaRect.get(aId) : null; if (!ar) continue;
    const p = byId.get(String(c.id)); const sr = rectDe(c, p);
    const dx = Math.max(0, Math.max(ar.x, sr.x) - Math.min(ar.x + ar.w, sr.x + sr.w));
    const dy = Math.max(0, Math.max(ar.y, sr.y) - Math.min(ar.y + ar.d, sr.y + sr.d));
    const dist = Math.hypot(dx, dy);
    gSum += clamp01(1 - dist / 1500); gN++;   // >1.5 m del ancla ya es malo
  }
  add('grouping', gN ? gSum / gN : 1, { seats_evaluados: gN });

  // 5 · ORIENTATION_CONSISTENCY: las sillas del mismo lado (side) comparten facing.
  const porAnclaLado = new Map();
  for (const c of seats) {
    const key = `${c.anchor_instance_id}#${c.side}`;
    if (!porAnclaLado.has(key)) porAnclaLado.set(key, new Set());
    porAnclaLado.get(key).add(c.facing || 'NULL');
  }
  let ladosOk = 0, ladosTot = 0;
  for (const facings of porAnclaLado.values()) { ladosTot++; if (facings.size <= 1) ladosOk++; }
  add('orientation_consistency', ladosTot ? ladosOk / ladosTot : 1, { lados: ladosTot, consistentes: ladosOk });

  // 6 · SYMMETRY: balance de sillas por lado en anclas de doble cara / mesa.
  const porAnclaSide = new Map();
  for (const c of seats) {
    const a = String(c.anchor_instance_id);
    if (!porAnclaSide.has(a)) porAnclaSide.set(a, new Map());
    const m = porAnclaSide.get(a); m.set(c.side, (m.get(c.side) || 0) + 1);
  }
  let simSum = 0, simN = 0;
  for (const m of porAnclaSide.values()) {
    const vals = [...m.values()]; if (vals.length < 2) { simSum += 1; simN++; continue; }
    const max = Math.max(...vals), min = Math.min(...vals);
    simSum += clamp01(min / max); simN++;
  }
  add('symmetry', simN ? simSum / simN : 1, { anclas: simN });

  // 7 · UTILIZATION: huella colocada / superficie total (uso razonable del espacio).
  let used = 0, areaTot = 0;
  for (const a of areas) areaTot += (num(a.ancho) || num(a.width_mm)) * (num(a.largo) || num(a.depth_mm));
  for (const c of colocacion) { const p = byId.get(String(c.id)); if (!p) continue; const r = rectDe(c, p); used += r.w * r.d; }
  const util = areaTot ? used / areaTot : 0;
  // curva: hasta 0.7 sube linealmente; por encima penaliza (saturación).
  add('utilization', util <= 0.7 ? util / 0.7 : clamp01(1 - (util - 0.7) / 0.3), { utilization: +util.toFixed(3) });

  // 8 · WALL_USAGE: anclas grandes apoyadas a un muro (estabilidad de layout).
  let wallSum = 0, wallN = 0;
  for (const [id, ar] of anclaRect) {
    const c = colocacion.find((x) => String(x.id) === id); const area = areas[num(c.area)]; if (!area) continue;
    const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
    const dMuro = Math.min(ar.x, ar.y, Math.max(0, W - (ar.x + ar.w)), Math.max(0, H - (ar.y + ar.d)));
    wallSum += clamp01(1 - dMuro / 1500); wallN++;
  }
  add('wall_usage', wallN ? wallSum / wallN : 1, { anclas: wallN });

  // 9 · CIRCULATION: proxy — queda holgura libre (no saturado) para circular.
  add('circulation', clamp01(1 - util), { free_fraction: +(1 - util).toFixed(3) });

  // --- total ponderado.
  let total = 0, wsum = 0;
  for (const c of Object.values(comps)) { total += c.score * c.weight; wsum += c.weight; }
  const total_score = +(100 * (wsum ? total / wsum : 0)).toFixed(2);

  if (tight.length) reasons.push(`${tight.length} silla(s) con acceso apretado (<600 mm).`);
  if (comps.symmetry.score < 0.8) reasons.push('Distribución de sillas poco balanceada entre lados.');
  if (comps.grouping.score < 0.8) reasons.push('Dependientes alejados de su ancla.');
  if (!reasons.length) reasons.push('Layout limpio: acceso, agrupación y orientación correctos.');

  return { total_score, components: comps, reasons };
}
