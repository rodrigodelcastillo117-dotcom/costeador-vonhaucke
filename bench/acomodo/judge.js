// ============================================================================
//  BANCO LOCAL · JUEZ NEUTRAL (independiente del solver).
//
//  Geometría propia (no importa el solver). Distingue:
//   - physical_footprint: el rect que ocupa cada pieza.
//   - overlap LEGAL: una gaveta UNDER_DESK puede ocupar el footprint de SU
//     escritorio (mismo anchor_instance_id). Cualquier otro solape es ilegal.
//   - clearance/pasillo ≥1000 mm aplica ENTRE kits (bloques de distinto
//     anchor_instance_id), NO entre componentes del mismo kit.
//   - sillas unidas a su ancla: cada dependiente debe caer en la misma área que
//     su ancla y a ≤ ATTACH_MM de ella; si no, está DESPRENDIDA.
//
//  PASS sólo si: todo colocado, cero solape ilegal, cero fuera, cero zona-mala,
//  cero puerta/obstáculo, cero desprendidas, cero sin-dueño, cero pasillo-angosto.
// ============================================================================
const AISLE = 1000;
const ATTACH_MM = 1200;
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esGaveta = (r) => r === 'UNDERDESK_STORAGE' || r === 'SUPPORT_STORAGE';
const esDependiente = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT', 'UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);

function rectDe(c, p) {
  const g = (num(c.rot) === 90 || num(c.rot) === 270);
  return { x: num(c.x), y: num(c.y), w: g ? num(p.d) : num(p.w), h: g ? num(p.w) : num(p.d) };
}
const solapan = (a, b) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
function puntoEnPoly(px, py, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi) dentro = !dentro;
  }
  return dentro;
}
function dentroArea(r, area) {
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  if (r.x < -1 || r.y < -1 || r.x + r.w > W + 1 || r.y + r.h > H + 1) return false;
  if (Array.isArray(area.poly) && area.poly.length >= 3) {
    const esq = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
    if (!esq.every(([x, y]) => puntoEnPoly(x, y, area.poly))) return false;
  }
  return true;
}
function bloqueaPuerta(r, p) {
  const x = num(p.x), y = num(p.y), a = num(p.ancho);
  return solapan(r, { x: x - 1, y: y - 1, w: a + 2, h: a + 2 });
}
function distRects(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}
const nz = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

export function juzgar(areas = [], piezas = [], colocacion = []) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const total = piezas.length;
  const colocados = colocacion.filter((c) => byId.has(String(c.id)));
  const rectsById = new Map();
  for (const c of colocados) {
    const p = byId.get(String(c.id));
    rectsById.set(String(c.id), { ...rectDe(c, p), area: num(c.area), rol: p.relation_role, anchor: p.anchor_instance_id != null ? String(p.anchor_instance_id) : null, zone_id: p.zone_id ?? null });
  }
  const colocadas = rectsById.size;

  // Conjunto de piezas con falla FÍSICA (overlap ilegal/fuera/zona/puerta/obstáculo)
  // para medir colocadas_bien comparable entre motores (independiente de kits).
  const malasFisicas = new Set();
  let fuera = 0, puerta = 0, obstaculo = 0, zonaMala = 0;
  for (const [id, r] of rectsById) {
    const area = areas[r.area];
    if (!area) { fuera++; malasFisicas.add(id); continue; }
    if (!dentroArea(r, area)) { fuera++; malasFisicas.add(id); }
    for (const o of (area.obstaculos || [])) if (solapan(r, { x: num(o.x), y: num(o.y), w: num(o.w), h: num(o.h) })) { obstaculo++; malasFisicas.add(id); break; }
    for (const pu of (area.puertas || [])) if (bloqueaPuerta(r, pu)) { puerta++; malasFisicas.add(id); break; }
    if (r.zone_id != null && nz(area.zone_id ?? area.nombre) !== nz(r.zone_id)) { zonaMala++; malasFisicas.add(id); }
  }

  let traslapes = 0;
  const ids = [...rectsById.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = rectsById.get(ids[i]), b = rectsById.get(ids[j]);
    if (a.area !== b.area || !solapan(a, b)) continue;
    const gavetaLegal = (esGaveta(a.rol) && esAncla(b.rol) && a.anchor === ids[j])
                     || (esGaveta(b.rol) && esAncla(a.rol) && b.anchor === ids[i]);
    if (!gavetaLegal) { traslapes++; malasFisicas.add(ids[i]); malasFisicas.add(ids[j]); }
  }

  const kitDe = (r, id) => (esAncla(r.rol) ? id : (r.anchor || `__${id}`));
  let pasillo = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = rectsById.get(ids[i]), b = rectsById.get(ids[j]);
    if (a.area !== b.area) continue;
    if (kitDe(a, ids[i]) === kitDe(b, ids[j])) continue;
    const dd = distRects(a, b);
    if (dd > 1 && dd < AISLE - 1) pasillo++;
  }

  // Piezas con falla RELACIONAL (dependiente desprendido/sin dueño). Entran a
  // colocadasBien: una silla "colocada pero desprendida" NO está bien colocada.
  const malasRel = new Set();
  let desprendidas = 0, sinDueno = 0;
  for (const [id, r] of rectsById) {
    if (!esDependiente(r.rol)) continue;
    if (!r.anchor) { sinDueno++; malasRel.add(id); continue; }
    const anc = rectsById.get(r.anchor);
    if (!anc) { desprendidas++; malasRel.add(id); continue; }
    if (anc.area !== r.area || distRects(r, anc) > ATTACH_MM) { desprendidas++; malasRel.add(id); }
  }
  for (const p of piezas) {
    if (!esDependiente(p.relation_role)) continue;
    if (!rectsById.has(String(p.id)) && p.anchor_instance_id == null) sinDueno++;
  }

  const completo = colocadas === total;
  const limpio = traslapes === 0 && fuera === 0 && zonaMala === 0 && puerta === 0 && obstaculo === 0 && desprendidas === 0 && sinDueno === 0 && pasillo === 0;
  const status = (completo && limpio) ? 'PASS' : (limpio ? 'PARTIAL' : 'FAIL');
  // colocadas_bien = colocada correctamente EN SERIO: sin falla física Y (si es
  // dependiente) unida a su ancla. Así una silla desprendida del viejo motor NO
  // cuenta como "bien", que es justo el defecto que el banco debe exponer.
  const malas = new Set([...malasFisicas, ...malasRel]);
  const colocadasBien = colocadas - malas.size;

  return { total, colocadas, colocadasBien, traslapes, fuera, zonaMala, puerta, obstaculo, pasillo, desprendidas, sinDueno, status };
}
