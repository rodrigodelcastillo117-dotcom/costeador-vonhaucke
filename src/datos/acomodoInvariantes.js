// ============================================================================
//  P0.2 · AGREGADOR DE INVARIANTES (VERIFY-FIRST) — dueño único de render_ready.
//
//  El edge vivo devuelve su propio `render_ready`/`status`, pero NO se cree a
//  ciegas: este módulo RE-VERIFICA la salida contra el payload CONFIRMADO y
//  decide el estado final. Regla dura (obj 11): render_ready SÓLO si TODOS los
//  invariantes pasan. El estado final nunca es más verde que el peor entre
//  (lo que calcula el cliente) y (lo que dijo el edge): si el edge dice PARTIAL,
//  jamás lo subimos a PASS (obj 7); si el cliente halla un FAIL que el edge no
//  vio, lo bajamos.
//
//  Cross-check plan↔partidas (obj 14): cero fantasmas, cero duplicados, cero
//  fuera de zona, cantidades exactas. Geometría en mm, epsilon 1 mm.
//  Puro y testeable sin deploy (CERTIFICADO AHORA).
// ============================================================================

const EPS = 1; // mm

const ORDEN = { PASS: 0, REVIEW_REQUIRED: 1, PARTIAL: 2, NEEDS_REVIEW: 3, FAIL: 4 };
const peor = (a, b) => (ORDEN[a] >= ORDEN[b] ? a : b);

// Rect de una pieza colocada, con rotación (0/90 intercambian w/d). Local al área.
function rectDe(pieza, coloc) {
  const rot = Number(coloc?.rot) || 0;
  const girado = rot === 90 || rot === 270;
  const w = girado ? Number(pieza?.d) || 0 : Number(pieza?.w) || 0;
  const h = girado ? Number(pieza?.w) || 0 : Number(pieza?.d) || 0;
  return { x: Number(coloc?.x) || 0, y: Number(coloc?.y) || 0, w, h };
}

function solapan(a, b) {
  return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS
      && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
}

function puntoEnPoligono(px, py, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const cruza = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

// ¿El rect cabe dentro del área? Rectangular por ancho/largo; si hay poly, las 4
// esquinas deben caer dentro del contorno.
function dentroDelArea(rect, area) {
  const W = Number(area?.ancho) || 0, H = Number(area?.largo) || 0;
  if (rect.x < -EPS || rect.y < -EPS || rect.x + rect.w > W + EPS || rect.y + rect.h > H + EPS) return false;
  if (Array.isArray(area?.poly) && area.poly.length >= 3) {
    const esquinas = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]];
    if (!esquinas.every(([x, y]) => puntoEnPoligono(x, y, area.poly))) return false;
  }
  return true;
}

// Caja de bloqueo de una puerta: el vano + un barrido cuadrado conservador del
// lado del ancho (si no hay bisagra conocida, se bloquea un cuadrado de lado=ancho
// hacia dentro). Determinista y conservador: prefiere marcar que ignorar.
function cajaPuerta(p) {
  const x = Number(p?.x) || 0, y = Number(p?.y) || 0, ancho = Number(p?.ancho) || 0;
  return { x: x - EPS, y: y - EPS, w: ancho + 2 * EPS, h: ancho + 2 * EPS };
}

function rectObstaculo(o) {
  return { x: Number(o?.x) || 0, y: Number(o?.y) || 0, w: Number(o?.w) || 0, h: Number(o?.h) || 0 };
}

const esAncla = (rol) => typeof rol === 'string' && rol.startsWith('ANCHOR_');

/**
 * Evalúa TODOS los invariantes de un plan contra su payload confirmado.
 * @param {{payload:object, plan:object, opts?:{repairAgotado?:boolean}}} _
 */
export function evaluarInvariantesAcomodo({ payload, plan, opts = {} } = {}) {
  const issues = [];
  const add = (code, severity, extra = {}) => issues.push({ code, severity, ...extra });

  const piezas = Array.isArray(payload?.piezas) ? payload.piezas : [];
  const areas = Array.isArray(payload?.areas) ? payload.areas : [];
  const requested = Number.isFinite(payload?.requested) ? payload.requested : piezas.length;
  const porId = new Map(piezas.map((p) => [String(p.id), p]));
  const coloc = Array.isArray(plan?.colocacion) ? plan.colocacion : [];

  // --- Cross-check de identidad (obj 14): fantasmas, duplicados, cobertura ---
  const vistos = new Map();           // id → veces
  const ghosts = [];
  for (const c of coloc) {
    const id = String(c?.id ?? '');
    vistos.set(id, (vistos.get(id) || 0) + 1);
    if (!porId.has(id)) { ghosts.push(id); }
  }
  for (const g of ghosts) add('GHOST_PLACEMENT', 'fail', { id: g });
  const duplicates = [...vistos.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  for (const d of duplicates) add('DUPLICATE_PLACEMENT', 'fail', { id: d });

  const colocadosValidos = coloc.filter((c) => porId.has(String(c?.id ?? '')));
  const idsColocados = new Set(colocadosValidos.map((c) => String(c.id)));
  const placed = idsColocados.size;
  const unplaced = piezas.map((p) => String(p.id)).filter((id) => !idsColocados.has(id));

  // Invariante de cobertura (obj 14): requested == placed + unplaced (ghosts no cuentan).
  const invariant_ok = requested === placed + unplaced.length;
  if (!invariant_ok) add('PLACEMENT_INVARIANT_BROKEN', 'fail', { requested, placed, unplaced: unplaced.length });

  // --- Geometría por colocación válida ---
  for (const c of colocadosValidos) {
    const id = String(c.id);
    const pieza = porId.get(id);
    const ai = Number(c.area);
    const area = areas[ai];
    if (!area) { add('AREA_INEXISTENTE', 'fail', { id, area: ai }); continue; }
    const rect = rectDe(pieza, c);

    if (!dentroDelArea(rect, area)) add('OUT_OF_BOUNDS', 'fail', { id, area: ai });

    for (const o of (Array.isArray(area.obstaculos) ? area.obstaculos : [])) {
      if (solapan(rect, rectObstaculo(o))) { add('HITS_OBSTACLE', 'fail', { id, area: ai }); break; }
    }
    for (const p of (Array.isArray(area.puertas) ? area.puertas : [])) {
      if (solapan(rect, cajaPuerta(p))) { add('BLOCKS_DOOR', 'fail', { id, area: ai }); break; }
    }
  }

  // No-overlap entre piezas DEL MISMO área (obj 14).
  const porArea = new Map();
  for (const c of colocadosValidos) {
    const ai = Number(c.area);
    if (!porArea.has(ai)) porArea.set(ai, []);
    porArea.get(ai).push(c);
  }
  for (const [ai, lista] of porArea) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const ra = rectDe(porId.get(String(lista[i].id)), lista[i]);
        const rb = rectDe(porId.get(String(lista[j].id)), lista[j]);
        if (solapan(ra, rb)) { add('OVERLAP', 'fail', { id: `${lista[i].id}|${lista[j].id}`, area: ai }); }
      }
    }
  }

  // --- Multi-zona (obj 6/14): dependiente en la zona de SU ancla ---
  // Agrupa por functional_group_id; el ancla del grupo (relation_role ANCHOR_*)
  // define el área; ningún dependiente colocado puede caer en otra área.
  const grupos = new Map(); // gid → {anchorArea, deps:[{id,area}]}
  for (const c of colocadosValidos) {
    const pieza = porId.get(String(c.id));
    const gid = pieza?.functional_group_id;
    if (!gid) continue;
    if (!grupos.has(gid)) grupos.set(gid, { anchorArea: null, deps: [] });
    const g = grupos.get(gid);
    if (esAncla(pieza.relation_role)) g.anchorArea = Number(c.area);
    else g.deps.push({ id: String(c.id), area: Number(c.area) });
  }
  for (const [gid, g] of grupos) {
    if (g.anchorArea == null) continue; // sin ancla colocada: lo cubre cobertura/missing
    for (const d of g.deps) {
      if (d.area !== g.anchorArea) add('DEPENDENT_WRONG_ZONE', 'fail', { id: d.id, area: d.area, grupo: gid, anclaArea: g.anchorArea });
    }
  }

  // --- Señales de REVIEW (no-fail) heredadas del edge ---
  const spec = plan?.layoutSpec || null;
  const doors = spec?.validation?.doors || plan?.puertas || null;
  if (doors && Number(doors.unverified || doors.sin_verificar || 0) > 0) add('DOOR_SWING_UNKNOWN', 'review', {});

  // --- Derivación de estado VERIFY-FIRST ---
  const hayFail = issues.some((i) => i.severity === 'fail');
  const hayReview = issues.some((i) => i.severity === 'review');
  let statusCliente;
  if (hayFail) statusCliente = opts.repairAgotado ? 'NEEDS_REVIEW' : 'FAIL';
  else if (unplaced.length > 0) statusCliente = 'PARTIAL';
  else if (hayReview) statusCliente = 'REVIEW_REQUIRED';
  else statusCliente = 'PASS';

  // Nunca más verde que el edge (obj 7): combina con su status declarado.
  const statusEdge = normalizarStatusEdge(plan);
  const status = peor(statusCliente, statusEdge);

  // render_ready SÓLO si PASS real (obj 11). Jamás confía en plan.render_ready.
  const render_ready = status === 'PASS';

  return {
    status, render_ready, invariant_ok,
    requested, placed, unplaced, ghosts, duplicates,
    issues,
    statusCliente, statusEdge,
    resumen: `${status} · ${placed}/${requested} colocadas${unplaced.length ? ` · ${unplaced.length} sin colocar` : ''}${hayFail ? ` · ${issues.filter((i) => i.severity === 'fail').length} fallas` : ''}`,
  };
}

// Mapea el status del edge a nuestra escala; si no lo declara, no empeora.
function normalizarStatusEdge(plan) {
  const s = plan?.layoutSpec?.status || plan?.status || null;
  if (s === 'PASS') return plan?.render_ready === true || plan?.layoutSpec?.validation?.render_ready === true ? 'PASS' : 'REVIEW_REQUIRED';
  if (s === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (s === 'PARTIAL') return 'PARTIAL';
  if (s === 'FAIL') return 'FAIL';
  // Sin status del edge: si marca render_ready explícito úsalo, si no, no empeora.
  if (plan?.render_ready === false) return 'REVIEW_REQUIRED';
  return 'PASS';
}

export { peor as peorStatus };
