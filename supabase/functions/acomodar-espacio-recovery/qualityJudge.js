// ============================================================================
//  P0.2c · BLOCK 5 · QUALITY JUDGE (explicable). Puntúa SÓLO candidatos que YA
//  pasaron HARD y SEMANTIC; el score JAMÁS compensa una falla dura o semántica
//  (esos son gates, no puntos). Reutiliza `evaluarCalidad` (spatial-core) como
//  componente espacial en lugar de duplicarlo, y agrega componentes explicables.
//
//  Salida: { total_score (0..100), components:{nombre:{score0..1,weight,detail}}, reasons[] }
//  calidadAceptable(q) → { status: PASS|REVIEW_REQUIRED, provenance:'PROVISIONAL', ... }
// ============================================================================
import { evaluarCalidad, spatialSpecDe } from './spatial-core.js';

const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esDependiente = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function rectDe(c, p) {
  const g = num(c.rot) === 90;
  return { x: num(c.x), y: num(c.y), w: g ? num(p.d) : num(p.w), d: g ? num(p.w) : num(p.d) };
}

// Ponderaciones base (no todas pesan igual). HARD/SEMANTIC no están aquí: son gates.
const PESOS = {
  spatial: 0.22,
  active_side_clearance: 0.20,
  accessibility: 0.14,
  grouping: 0.12,
  orientation_consistency: 0.10,
  symmetry: 0.08,
  utilization: 0.08,
  wall_usage: 0.03,
  free_space_proxy: 0.03,
};

// GAP26: umbral PROVISIONAL de calidad aceptable (versionado, NO "regla Von Haucke").
export const QUALITY_CONTRACT = Object.freeze({ version: 'QJ_V1_PROVISIONAL', min_score: 70, provenance: 'PROVISIONAL' });

export function juzgarCalidad(areas = [], piezas = [], colocacion = [], { porPieza = [], semantic = null } = {}) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const comps = {};
  const reasons = [];
  const add = (name, score, detail, weightOverride) => { comps[name] = { score: +clamp01(score).toFixed(3), weight: weightOverride != null ? weightOverride : (PESOS[name] ?? 0), detail }; };

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

  // Mapa ancla → {rect, topology}.
  const anclas = new Map();
  for (const c of colocacion) { const p = byId.get(String(c.id)); if (p && esAncla(p.relation_role)) anclas.set(String(c.id), { rect: rectDe(c, p), topology: c.topology || null, area: num(c.area) }); }

  // 4 · GROUPING: dependientes cerca de su ancla (compacidad del grupo funcional).
  let gSum = 0, gN = 0;
  for (const c of seats) {
    const aId = c.anchor_instance_id != null ? String(c.anchor_instance_id) : null;
    const anc = aId ? anclas.get(aId) : null; if (!anc) continue;
    const p = byId.get(String(c.id)); const sr = rectDe(c, p); const ar = anc.rect;
    const dx = Math.max(0, Math.max(ar.x, sr.x) - Math.min(ar.x + ar.w, sr.x + sr.w));
    const dy = Math.max(0, Math.max(ar.y, sr.y) - Math.min(ar.y + ar.d, sr.y + sr.d));
    gSum += clamp01(1 - Math.hypot(dx, dy) / 1500); gN++;
  }
  add('grouping', gN ? gSum / gN : 1, { seats_evaluados: gN });

  // 5 · ORIENTATION_CONSISTENCY: sillas del mismo lado (side) comparten facing.
  const porAnclaLado = new Map();
  for (const c of seats) {
    const key = `${c.anchor_instance_id}#${c.side}`;
    if (!porAnclaLado.has(key)) porAnclaLado.set(key, new Set());
    porAnclaLado.get(key).add(c.facing || 'NULL');
  }
  let ladosOk = 0, ladosTot = 0;
  for (const facings of porAnclaLado.values()) { ladosTot++; if (facings.size <= 1) ladosOk++; }
  add('orientation_consistency', ladosTot ? ladosOk / ladosTot : 1, { lados: ladosTot, consistentes: ladosOk });

  // 6 · SYMMETRY por TOPOLOGÍA (GAP23): la distribución canónica NO se penaliza.
  //  DOUBLE_FACE → balancea A vs B.  MEETING_TABLE → A vs B y HEAD_A vs HEAD_B
  //  por separado (jamás cabeceras contra lados largos). Otras topologías → N/A (1).
  const bal = (x, y) => { const m = Math.max(x, y); return m ? Math.min(x, y) / m : 1; };
  const sideCount = new Map();   // anchorId → {side: n}
  for (const c of seats) {
    const a = String(c.anchor_instance_id);
    if (!sideCount.has(a)) sideCount.set(a, {});
    const m = sideCount.get(a); m[c.side] = (m[c.side] || 0) + 1;
  }
  let simSum = 0, simN = 0;
  for (const [aId, m] of sideCount) {
    const topo = anclas.get(aId)?.topology;
    if (topo === 'MEETING_TABLE') {
      const lados = bal(m.A || 0, m.B || 0);
      const heads = ((m.HEAD_A || 0) + (m.HEAD_B || 0)) ? bal(m.HEAD_A || 0, m.HEAD_B || 0) : 1;
      simSum += (lados + heads) / 2; simN++;
    } else if (topo === 'DOUBLE_FACE') {
      simSum += bal(m.A || 0, m.B || 0); simN++;
    } else {
      simSum += 1; simN++;   // SINGLE_FACE/DESK/RECEPTION: simetría no aplica
    }
  }
  add('symmetry', simN ? simSum / simN : 1, { anclas: simN });

  // 7 · UTILIZATION: huella colocada / superficie total (uso razonable del espacio).
  let used = 0, areaTot = 0;
  for (const a of areas) areaTot += (num(a.ancho) || num(a.width_mm)) * (num(a.largo) || num(a.depth_mm));
  for (const c of colocacion) { const p = byId.get(String(c.id)); if (!p) continue; const r = rectDe(c, p); used += r.w * r.d; }
  const util = areaTot ? used / areaTot : 0;
  add('utilization', util <= 0.7 ? util / 0.7 : clamp01(1 - (util - 0.7) / 0.3), { utilization: +util.toFixed(3) });

  // 8 · WALL_USAGE (GAP24): SÓLO si el PlacementProfile lo pide (prefer_wall). Sin
  // evidencia → NO se premia (peso 0): "cerca de muro" no es criterio global.
  let wallSum = 0, wallN = 0;
  for (const [id, anc] of anclas) {
    const p = byId.get(id); const spec = spatialSpecDe(p || {});
    const preferWall = spec.prefer_wall === true || spec.anchor === 'wall' || spec.ancla === 'muro';
    if (!preferWall) continue;                                  // sin evidencia → no cuenta
    const area = areas[anc.area]; if (!area) continue;
    const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
    const ar = anc.rect;
    const dMuro = Math.min(ar.x, ar.y, Math.max(0, W - (ar.x + ar.w)), Math.max(0, H - (ar.y + ar.d)));
    wallSum += clamp01(1 - dMuro / 1500); wallN++;
  }
  add('wall_usage', wallN ? wallSum / wallN : 1, { anclas_prefer_wall: wallN, evidencia: wallN > 0 }, wallN ? PESOS.wall_usage : 0);

  // 9 · FREE_SPACE_PROXY (GAP25): PROVISIONAL. Mide espacio libre, NO circulación real.
  add('free_space_proxy', clamp01(1 - util), { free_fraction: +(1 - util).toFixed(3), provenance: 'PROVISIONAL', nota: 'proxy de holgura, no circulación medida' });

  // --- total ponderado (los pesos 0 no cuentan).
  let total = 0, wsum = 0;
  for (const c of Object.values(comps)) { total += c.score * c.weight; wsum += c.weight; }
  const total_score = +(100 * (wsum ? total / wsum : 0)).toFixed(2);

  if (tight.length) reasons.push(`${tight.length} silla(s) con acceso apretado (<600 mm).`);
  if (comps.symmetry.score < 0.8) reasons.push('Distribución de sillas poco balanceada para su topología.');
  if (comps.grouping.score < 0.8) reasons.push('Dependientes alejados de su ancla.');
  if (!reasons.length) reasons.push('Layout limpio: acceso, agrupación y orientación correctos.');

  return { total_score, components: comps, reasons };
}

// GAP26 · ¿la calidad es ACEPTABLE para publicar? PROVISIONAL (versionado). Un score
// bajo o un componente crítico bajo NO puede terminar FINAL sólo porque hubo presupuesto.
export function calidadAceptable(q) {
  const c = q.components || {};
  const reasons = [];
  const crit = [];
  if ((c.active_side_clearance?.score ?? 1) < 0.5) crit.push('active_side_clearance');
  if ((c.accessibility?.score ?? 1) < 0.5) crit.push('accessibility');
  const lowScore = num(q.total_score) < QUALITY_CONTRACT.min_score;
  if (crit.length) reasons.push('componentes críticos bajos: ' + crit.join(', '));
  if (lowScore) reasons.push(`score ${q.total_score} < ${QUALITY_CONTRACT.min_score} (provisional)`);
  const status = (crit.length || lowScore) ? 'REVIEW_REQUIRED' : 'PASS';
  return { status, provenance: QUALITY_CONTRACT.provenance, version: QUALITY_CONTRACT.version, threshold: QUALITY_CONTRACT.min_score, reasons };
}
