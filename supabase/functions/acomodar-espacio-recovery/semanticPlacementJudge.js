// ============================================================================
//  P0.2c · BLOCK 3 · SEMANTIC PLACEMENT JUDGE (separado del juez geométrico).
//
//  NO toca el juez geométrico congelado (bench/acomodo/judge.js). Decide si un
//  acomodo tiene SENTIDO FUNCIONAL, no sólo si es geométricamente legal.
//
//  Un layout FINAL requiere:  HARD_GEOMETRY = PASS  AND  SEMANTIC_PLACEMENT = PASS.
//  Si falta una verdad crítica (topología desconocida): REVIEW_REQUIRED.
//  Nunca UNKNOWN → PASS silencioso.
//
//  Entrada: la salida de resolverKits (colocacion con slot_id/side/facing/topology/
//  anchor_instance_id) + piezas (w/d/relation_role/anchor_instance_id) + areas.
// ============================================================================
const num = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esDependiente = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT'].includes(r);
const esPasivo = (side) => typeof side === 'string' && side.startsWith('HEAD');

// Acceso mínimo DURO para que una persona use un asiento en un lado activo (mm).
// PROVISIONAL (no hay fuente ergonómica confirmada): pull de silla + cuerpo.
export const ACTIVE_SIDE_ACCESS_MM = 600;

function rectDe(c, p) {
  const g = num(c.rot) === 90 || num(c.rot) === 270;
  return { x: num(c.x), y: num(c.y), w: g ? num(p.d) : num(p.w), d: g ? num(p.w) : num(p.d) };
}
const solapan = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
// ¿El facing apunta del asiento hacia el ancla?
function apuntaAlAncla(s, a, facing) {
  const cx = s.x + s.w / 2, cy = s.y + s.d / 2, ax = a.x + a.w / 2, ay = a.y + a.d / 2;
  if (facing === 'UP') return ay < cy;
  if (facing === 'DOWN') return ay > cy;
  if (facing === 'LEFT') return ax < cx;
  if (facing === 'RIGHT') return ax > cx;
  return false;
}
// Región de acceso (OPUESTA al facing): por ahí entra/sale la persona.
function regionAcceso(s, facing, mm) {
  if (facing === 'DOWN') return { x: s.x, y: s.y - mm, w: s.w, d: mm };   // acceso arriba
  if (facing === 'UP') return { x: s.x, y: s.y + s.d, w: s.w, d: mm };    // acceso abajo
  if (facing === 'RIGHT') return { x: s.x - mm, y: s.y, w: mm, d: s.d };  // acceso izquierda
  if (facing === 'LEFT') return { x: s.x + s.w, y: s.y, w: mm, d: s.d };  // acceso derecha
  return null;
}
const dentroArea = (r, area) => {
  const W = num(area.ancho) || num(area.width_mm), H = num(area.largo) || num(area.depth_mm);
  return r.x >= -1 && r.y >= -1 && r.x + r.w <= W + 1 && r.y + r.d <= H + 1;
};

export function juzgarSemantico(areas = [], piezas = [], colocacion = []) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const issues = [];
  const add = (code, extra = {}) => issues.push({ code, ...extra });

  // Índice de anclas colocadas.
  const anclas = new Map();   // id → { pieza, col, rect, topology }
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esAncla(p.relation_role)) continue;
    anclas.set(String(c.id), { pieza: p, col: c, rect: rectDe(c, p), topology: c.topology ?? null });
  }

  // 1 · Topología desconocida → REVIEW_REQUIRED (nunca PASS silencioso).
  for (const [id, a] of anclas) {
    if (!a.topology || a.topology === 'UNKNOWN') add('SEMANTIC_PROFILE_UNKNOWN', { anchor: id, severity: 'review' });
  }

  // 2 · Slots duplicados por ancla.
  const slotVistos = new Map();
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esDependiente(p.relation_role) || !c.slot_id) continue;
    const key = `${c.anchor_instance_id}#${c.slot_id}`;
    if (slotVistos.has(key)) add('SLOT_DOUBLE_OCCUPIED', { slot: c.slot_id, anchor: c.anchor_instance_id, ids: [slotVistos.get(key), c.id], severity: 'fail' });
    else slotVistos.set(key, c.id);
  }

  // 3 · Orientación + acceso de lados activos por dependiente colocado.
  for (const c of colocacion) {
    const p = byId.get(String(c.id)); if (!p || !esDependiente(p.relation_role)) continue;
    const anc = c.anchor_instance_id != null ? anclas.get(String(c.anchor_instance_id)) : null;
    if (!anc) continue;   // sin dueño colocado: lo cubre el juez geométrico (DETACHED)
    const sRect = rectDe(c, p);
    // 3a · facing válido y hacia la mesa.
    if (!c.facing) add('INVALID_FACING', { id: c.id, severity: 'fail' });
    else if (!apuntaAlAncla(sRect, anc.rect, c.facing)) add('DEPENDENT_WRONG_ORIENTATION', { id: c.id, facing: c.facing, severity: 'fail' });
    // 3b · lado activo (no cabecera) no puede quedar bloqueado contra muro/obstáculo.
    if (c.side && !esPasivo(c.side) && c.facing) {
      const acc = regionAcceso(sRect, c.facing, ACTIVE_SIDE_ACCESS_MM);
      const area = areas[num(c.area)] || {};
      if (acc && !dentroArea(acc, area)) add('ACTIVE_SIDE_BLOCKED_BY_WALL', { id: c.id, side: c.side, severity: 'fail' });
      else if (acc) {
        for (const o of (area.obstaculos || [])) {
          if (solapan(acc, { x: num(o.x), y: num(o.y), w: num(o.w), d: num(o.h) })) { add('ACTIVE_SIDE_BLOCKED_BY_OBSTACLE', { id: c.id, side: c.side, severity: 'fail' }); break; }
        }
      }
    }
  }

  const hayFail = issues.some((i) => i.severity === 'fail');
  const hayReview = issues.some((i) => i.severity === 'review');
  const status = hayFail ? 'FAIL' : (hayReview ? 'REVIEW_REQUIRED' : 'PASS');
  return { status, issues, access_mm: ACTIVE_SIDE_ACCESS_MM, access_provenance: 'PROVISIONAL' };
}

// Contrato final: sólo PASS si geometría dura Y semántica pasan.
export function esFinalValido(geomStatus, sem) {
  return geomStatus === 'PASS' && sem && sem.status === 'PASS';
}
