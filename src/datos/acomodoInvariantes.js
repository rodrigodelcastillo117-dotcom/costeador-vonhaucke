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
// 2026-10-17: misma geometría de puertas que el solver (una sola verdad): barrido real de una puerta
// verificada y su cuadro conservador duplicado ignorado. Precedente de import: acomodoAudit.js.
import { poligonoBarridoPuerta, bloqueaPuertaEspacial, areaSinCuadrosDuplicados } from '../../supabase/functions/acomodar-espacio-recovery/spatial-core.js';

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
    // Prueba de Rodrigo 19-oct: una pieza PEGADA al muro tiene esquinas exactamente sobre el contorno y el rayo las
    // contaba "fuera". Esquinas 1 mm hacia adentro, como el servidor (spatial-core.rectDentroPoligono).
    const esquinas = [[rect.x + EPS, rect.y + EPS], [rect.x + rect.w - EPS, rect.y + EPS], [rect.x + EPS, rect.y + rect.h - EPS], [rect.x + rect.w - EPS, rect.y + rect.h - EPS]];
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
  const colocadosValidos = coloc.filter((c) => porId.has(String(c?.id ?? '')));
  // STALE_PROGRAM (P0-05): el plan guardado pertenece a OTRA versión del programa — TODAS sus
  // colocaciones son ajenas a las piezas actuales (cambió la identidad: zona/rol/ancla/slot/
  // cantidad). La geometría puede seguir siendo válida; lo que cambió es la identidad. No son N
  // fantasmas que corregir uno por uno: es un plan viejo que hay que RECALCULAR. Se reporta UNA
  // falla clara (sigue siendo `fail`: no publica, gating idéntico) en vez de inundar con un
  // GHOST_PLACEMENT por mueble. Contaminación PARCIAL (algunas válidas y algunas ajenas) NO es
  // stale: cada ajena sigue marcándose como fantasma. `estadoHumano` ya conoce STALE_PROGRAM.
  const planTotalmenteAjeno = coloc.length > 0 && colocadosValidos.length === 0 && piezas.length > 0;
  if (planTotalmenteAjeno) {
    add('STALE_PROGRAM', 'fail', { ghosts: ghosts.length, requested });
  } else {
    for (const g of ghosts) add('GHOST_PLACEMENT', 'fail', { id: g });
  }
  const duplicates = [...vistos.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  for (const d of duplicates) add('DUPLICATE_PLACEMENT', 'fail', { id: d });
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
    const area = areas[ai] ? areaSinCuadrosDuplicados(areas[ai]) : areas[ai];
    if (!area) { add('AREA_INEXISTENTE', 'fail', { id, area: ai }); continue; }
    const rect = rectDe(pieza, c);

    if (!dentroDelArea(rect, area)) add('OUT_OF_BOUNDS', 'fail', { id, area: ai });

    for (const o of (Array.isArray(area.obstaculos) ? area.obstaculos : [])) {
      if (solapan(rect, rectObstaculo(o))) { add('HITS_OBSTACLE', 'fail', { id, area: ai }); break; }
    }
    for (const p of (Array.isArray(area.puertas) ? area.puertas : [])) {
      // Puerta con barrido verificado: su forma real (la misma que usa el solver). Sin barrido verificado:
      // la caja conservadora de siempre.
      const bloquea = poligonoBarridoPuerta(p)
        ? bloqueaPuertaEspacial({ x: rect.x, y: rect.y, w: rect.w, d: rect.h }, p)
        : solapan(rect, cajaPuerta(p));
      if (bloquea) { add('BLOCKS_DOOR', 'fail', { id, area: ai }); break; }
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

  // --- Multi-zona (obj 6/14 · audit G): identidad por IDs ESTABLES ---
  // Identidad primaria del grupo: anchor_instance_id (si existe) → functional_group_id.
  // El ancla (relation_role ANCHOR_*) fija el ÁREA y la ZONA esperadas. Validamos:
  //  (a) el ancla cae en un área cuya identidad de zona coincide con su zone_id;
  //  (b) cada dependiente cae en la MISMA área que su ancla; y si trae zone_id,
  //      que coincida con la del ancla. Todo por id/índice, nunca por nombre suelto.
  // GAP4 · Identidad de zona por IDs ESTABLES: zone_id (del FloorSpec) manda; el
  // `nombre` es SÓLO fallback legacy EXPLÍCITO (áreas viejas sin zone_id). Así dos
  // áreas con el MISMO nombre pero distinto zone_id NO se confunden.
  const zonaDeArea = (ai) => {
    const a = areas[ai];
    if (!a) return `#${ai}`;
    if (a.zone_id != null) return a.zone_id;        // identidad primaria
    return a.nombre ?? `#${ai}`;                     // fallback legacy explícito
  };
  const normZona = (z) => String(z ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
  const claveGrupo = (p) => p?.anchor_instance_id || p?.functional_group_id || null;
  const esDep = (r) => ['WORK_SEAT', 'EXECUTIVE_SEAT', 'VISITOR_SEAT', 'MEETING_SEAT', 'UNDERDESK_STORAGE', 'SUPPORT_STORAGE'].includes(r);
  const ATTACH_MM = 1200;
  const distR = (a, b) => Math.hypot(Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))), Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h))));
  const grupos = new Map(); // clave → {anchorArea, anchorZone, anchorRect, deps:[{id,area,zone,rect}]}
  for (const c of colocadosValidos) {
    const pieza = porId.get(String(c.id));
    const ai = Number(c.area);
    const r = rectDe(pieza, c);
    // D (P0.2b): dependiente SIN dueño declarado (ni anchor_instance_id ni grupo).
    if (esDep(pieza.relation_role) && !claveGrupo(pieza)) { add('DEPENDENT_UNASSIGNED', 'fail', { id: String(c.id) }); continue; }
    const gid = claveGrupo(pieza);
    if (!gid) continue;
    if (!grupos.has(gid)) grupos.set(gid, { anchorArea: null, anchorZone: null, anchorRect: null, anclas: [], deps: [] });
    const g = grupos.get(gid);
    if (esAncla(pieza.relation_role)) {
      g.anchorArea = ai; g.anchorZone = pieza.zone_id ?? null; g.anchorRect = { ...r, h: r.d };
      g.anclas.push({ area: ai, zone: pieza.zone_id ?? null, rect: { ...r, h: r.d } });
      if (pieza.zone_id != null && normZona(pieza.zone_id) !== normZona(zonaDeArea(ai))) {
        add('ANCHOR_WRONG_ZONE', 'fail', { id: String(c.id), area: ai, zoneEsperada: pieza.zone_id, zonaArea: zonaDeArea(ai) });
      }
    } else {
      g.deps.push({ id: String(c.id), area: ai, zone: pieza.zone_id ?? null, rect: { ...r, h: r.d } });
    }
  }
  for (const [gid, g] of grupos) {
    if (g.anchorArea == null) continue; // sin ancla colocada: lo cubre cobertura/missing
    for (const d of g.deps) {
      // Un grupo puede tener VARIAS anclas (cotización 4048: 54 WIN en un solo grupo libre para 5 bancas
      // repartidas en dos open spaces). Antes se comparaba contra la ÚLTIMA ancla y las sillas bien puestas
      // en la otra banca salían "en otro cuarto que su mueble". Ahora: contra las anclas de SU cuarto.
      const delCuarto = g.anclas.filter((a) => a.area === d.area);
      if (!delCuarto.length) {
        add('DEPENDENT_WRONG_ZONE', 'fail', { id: d.id, area: d.area, grupo: gid, anclaArea: g.anchorArea });
        continue;
      }
      const cercana = delCuarto.find((a) => d.zone == null || a.zone == null || normZona(a.zone) === normZona(d.zone)) || delCuarto[0];
      if (d.zone != null && cercana.zone != null && normZona(d.zone) !== normZona(cercana.zone)) {
        add('DEPENDENT_WRONG_ZONE', 'fail', { id: d.id, area: d.area, grupo: gid, zoneDep: d.zone, zoneAncla: cercana.zone });
      } else if (distR(d.rect, cercana.rect) > ATTACH_MM) {
        // D: misma zona pero DESPRENDIDO de su ancla (lejos).
        add('DEPENDENT_DETACHED', 'fail', { id: d.id, area: d.area, grupo: gid });
      }
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

/**
 * GAP 2 · AUTORIDAD ÚNICA DE VALIDEZ. Una sola función deriva todos los flags de
 * publicación desde la evaluación del agregador. La usan autosave, guardarEnPropuesta,
 * guardarStaging y layoutListo/layoutPublicable. SÓLO PASS publica: REVIEW_REQUIRED,
 * PARTIAL y NEEDS_REVIEW nunca dan publicable/validado.
 * @param {{evaluacion:object|null, programaListo:boolean}} _
 */
export function derivarValidez({ evaluacion = null, programaListo = true } = {}) {
  const status = evaluacion ? evaluacion.status : null;
  const render_ready = !!(evaluacion && evaluacion.render_ready);
  const layoutEspacialValidado = status === 'PASS';          // SÓLO PASS
  const layoutValidado = layoutEspacialValidado && !!programaListo;
  return {
    status,
    render_ready,
    layoutEspacialValidado,
    layoutValidado,
    publicable: layoutValidado,                               // alias de intención
  };
}
