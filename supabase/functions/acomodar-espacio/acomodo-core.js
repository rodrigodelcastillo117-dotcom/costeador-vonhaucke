// ============================================================================
//  acomodo-core · motor DETERMINISTA del acomodo (constraint solver + validador
//  + repair-loop). Puro: sin Deno, sin red, sin LLM → testeable y reproducible.
//
//  Principio (una sola verdad): la IA puede PROPONER estrategia, pero quien
//  decide QUÉ cabe y DÓNDE es el solver geométrico, y quien decide si un layout
//  es válido es el VALIDADOR determinista — nunca "la IA dijo que sí".
//
//  Exporta:
//   - validarColocacion(areas, piezas, colocacion) → verdad geométrica, con
//     códigos estructurados por pieza (OUTSIDE_AREA, OVERLAP, BLOCKS_DOOR, …).
//   - planearDeterminista(areas, piezas, opts) → coloca por construcción válido
//     (scan de rejilla con rotación, separación, polígono y puertas si existen).
//   - acomodarConReparacion({areas, piezas, proponer, maxIntentos}) → hasta 3
//     intentos de un `proponer` inyectable (IA o el planner), validando entre
//     cada uno; conserva lo válido, repara lo inválido, nunca completa si falta.
//   - Invariante: pedidas = colocadas_válidas + no_colocadas (ninguna desaparece).
// ============================================================================

export const CODIGO = Object.freeze({
  UNKNOWN_PIECE: 'UNKNOWN_PIECE',
  INVALID_AREA: 'INVALID_AREA',
  INVALID_ROTATION: 'INVALID_ROTATION',
  OUTSIDE_AREA: 'OUTSIDE_AREA',
  OUTSIDE_POLYGON: 'OUTSIDE_POLYGON',
  OVERLAP: 'OVERLAP',
  BLOCKS_DOOR: 'BLOCKS_DOOR',
  NO_SPACE: 'NO_SPACE',
});

// Huella efectiva según el giro (rot 90 intercambia ancho/fondo).
export function huellaConRot(pieza, rot) {
  const w = Number(pieza?.w) || 0;
  const d = Number(pieza?.d) || 0;
  return Number(rot) === 90 ? { w: d, d: w } : { w, d };
}

// Traslape de dos rectángulos (origen esquina sup-izq). Tolerancia para bordes
// que apenas se tocan (no es traslape real).
function seSolapan(a, b, tol = 1) {
  return a.x + tol < b.x + b.w && a.x + a.w > b.x + tol && a.y + tol < b.y + b.d && a.y + a.d > b.y + tol;
}

// Rectángulo expandido `g` por lado (para exigir separación/holgura).
const expandir = (r, g) => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, d: r.d + 2 * g });

// Punto dentro de polígono (ray casting). poly = [[x,y], …] en coords locales.
function puntoEnPoligono(x, y, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const corta = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (corta) dentro = !dentro;
  }
  return dentro;
}

// ¿El rectángulo cabe dentro del polígono? (sus 4 esquinas + centro dentro).
function rectEnPoligono(r, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return true; // sin polígono: no restringe
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d], [r.x + r.w / 2, r.y + r.d / 2]];
  return pts.every(([px, py]) => puntoEnPoligono(px, py, poly));
}

// Puertas como rectángulos de despeje (x,y,w,d) o punto+radio {x,y,r}. Devuelve
// true si el mueble invade el barrido/despeje de alguna puerta.
function bloqueaPuerta(rect, puertas) {
  if (!Array.isArray(puertas) || !puertas.length) return false;
  return puertas.some((p) => {
    if (p == null) return false;
    const despeje = p.r != null
      ? { x: Number(p.x) - Number(p.r), y: Number(p.y) - Number(p.r), w: 2 * Number(p.r), d: 2 * Number(p.r) }
      : { x: Number(p.x) || 0, y: Number(p.y) || 0, w: Number(p.w) || 0, d: Number(p.d ?? p.largo) || 0 };
    return seSolapan(rect, despeje, 1);
  });
}

// Obstáculos del área (columnas, áreas anidadas) como rects {x,y,w,d}.
function obstaculosDeArea(area) {
  const out = [];
  for (const o of (area?.obstaculos || area?.obstacles || [])) {
    if (o && Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y))) out.push({ x: Number(o.x), y: Number(o.y), w: Number(o.w) || 0, d: Number(o.d ?? o.largo) || 0 });
  }
  return out;
}

// --------------------------------------------------------------------------
//  VALIDADOR determinista. Verdad final del acomodo.
// --------------------------------------------------------------------------
export function validarColocacion(areas = [], piezas = [], colocacion = [], tolMM = 1) {
  const col = Array.isArray(colocacion) ? colocacion : [];
  const byId = new Map(col.map((c) => [String(c?.id), c]));
  const rectsPorArea = {};
  const porPieza = [];

  for (const p of piezas) {
    const id = String(p?.id);
    const c = byId.get(id);
    const codigos = [];
    const motivos = [];
    if (!c) {
      porPieza.push({ id, ok: false, area: null, codigos: [CODIGO.UNKNOWN_PIECE], motivo: 'no colocada: la IA no devolvió posición para esta pieza' });
      continue;
    }
    const ai = Number(c.area);
    const area = areas[ai];
    if (!area) { porPieza.push({ id, ok: false, area: ai, codigos: [CODIGO.INVALID_AREA], motivo: `área inválida (${c.area})` }); continue; }

    const rot = Number(c.rot) || 0;
    if (rot !== 0 && rot !== 90) { codigos.push(CODIGO.INVALID_ROTATION); motivos.push(`rotación inválida (${c.rot})`); }
    const { w, d } = huellaConRot(p, rot);
    const x = Number(c.x); const y = Number(c.y);
    const A = Number(area.ancho); const L = Number(area.largo);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { codigos.push(CODIGO.OUTSIDE_AREA); motivos.push('posición no numérica'); }
    if (x < -tolMM || y < -tolMM || (Number.isFinite(x) && x + w > A + tolMM) || (Number.isFinite(y) && y + d > L + tolMM)) {
      codigos.push(CODIGO.OUTSIDE_AREA);
      motivos.push(`se sale del área "${area.nombre || ai}" (${Math.round(w)}×${Math.round(d)} mm en ${Math.round(x)},${Math.round(y)} vs ${A}×${L})`);
    }
    const rect = { id, x, y, w, d };
    if (area.polygon && !rectEnPoligono(rect, area.polygon)) { codigos.push(CODIGO.OUTSIDE_POLYGON); motivos.push('queda fuera del contorno real del cuarto'); }
    if (bloqueaPuerta(rect, area.puertas || area.doors)) { codigos.push(CODIGO.BLOCKS_DOOR); motivos.push('bloquea una puerta / acceso'); }

    rectsPorArea[ai] = rectsPorArea[ai] || [];
    for (const otro of [...rectsPorArea[ai], ...obstaculosDeArea(area)]) {
      if (Number.isFinite(x) && Number.isFinite(y) && seSolapan(rect, otro, tolMM)) { codigos.push(CODIGO.OVERLAP); motivos.push(`traslapa con ${otro.id || 'un obstáculo'}`); break; }
    }
    rectsPorArea[ai].push(rect);
    porPieza.push({ id, ok: codigos.length === 0, area: ai, codigos, motivo: motivos.join('; ') || null });
  }

  const colocadas = porPieza.filter((p) => p.ok).length;
  const total = piezas.length;
  const noColocadas = porPieza.filter((p) => !p.ok);
  // Invariante: ninguna pieza desaparece.
  const invariante = (colocadas + noColocadas.length) === total;
  return { ok: total > 0 && colocadas === total, colocadas, total, porPieza, noColocadas, invariante };
}

export function resumenViolaciones(val) {
  return (val?.noColocadas || []).map((p) => `Pieza ${p.id}: ${p.motivo || 'inválida'}${p.codigos?.length ? ` [${p.codigos.join(',')}]` : ''}`);
}

export function recomendacionesParcial(val) {
  const cods = new Set((val?.noColocadas || []).flatMap((p) => p.codigos || []));
  const recs = [];
  if (cods.has(CODIGO.OVERLAP)) recs.push('Hay traslapes: separa las piezas o baja la densidad del área.');
  if (cods.has(CODIGO.OUTSIDE_AREA) || cods.has(CODIGO.OUTSIDE_POLYGON)) recs.push('Piezas que no caben en su área: muévelas a otra con más espacio o revisa medidas.');
  if (cods.has(CODIGO.BLOCKS_DOOR)) recs.push('Piezas que tapan una puerta/acceso: reubícalas lejos del barrido de la puerta.');
  if (cods.has(CODIGO.NO_SPACE) || cods.has(CODIGO.UNKNOWN_PIECE)) recs.push('No hubo superficie libre suficiente para todas las piezas.');
  recs.push('Opciones: mover a otra área · cambiar el producto por uno más chico · acomodar a mano. No se reducen cantidades ni se inventan muebles.');
  return recs;
}

// --------------------------------------------------------------------------
//  PLANNER determinista (constraint solver). Coloca por construcción válido.
//  Scan de rejilla por área (orden estable), probando rot 0/90, exigiendo
//  separación `gapMM`, dentro de polígono y sin bloquear puertas/obstáculos.
//  Reparte a varias áreas por primer ajuste. Mismo input ⇒ mismo output.
// --------------------------------------------------------------------------
export function planearDeterminista(areas = [], piezas = [], opts = {}) {
  const gap = Number(opts.gapMM) || 120;
  const step = Number(opts.stepMM) || 100;
  const fijas = Array.isArray(opts.fijas) ? opts.fijas : [];
  const colocacion = [...fijas.map((c) => ({ id: String(c.id), area: Number(c.area), x: Number(c.x), y: Number(c.y), rot: Number(c.rot) || 0 }))];
  const colocadoIds = new Set(colocacion.map((c) => c.id));

  // Ocupados por área: fijas + obstáculos.
  const ocupadosPorArea = {};
  areas.forEach((a, ai) => { ocupadosPorArea[ai] = [...obstaculosDeArea(a)]; });
  for (const c of colocacion) {
    const p = piezas.find((pp) => String(pp.id) === c.id);
    if (!p || !areas[c.area]) continue;
    const { w, d } = huellaConRot(p, c.rot);
    (ocupadosPorArea[c.area] = ocupadosPorArea[c.area] || []).push({ id: c.id, x: c.x, y: c.y, w, d });
  }

  // Pendientes: por huella descendente (estable por id) → mejor empaque.
  const pend = piezas.filter((p) => !colocadoIds.has(String(p.id)))
    .slice()
    .sort((a, b) => (Number(b.w) * Number(b.d)) - (Number(a.w) * Number(a.d)) || String(a.id).localeCompare(String(b.id)));

  const noColocadas = [];
  for (const p of pend) {
    let puesto = null;
    // Si la pieza sugiere un área (rol/índice), pruébala primero; luego todas.
    const orden = [];
    if (Number.isFinite(Number(p.area)) && areas[Number(p.area)]) orden.push(Number(p.area));
    areas.forEach((_, ai) => { if (!orden.includes(ai)) orden.push(ai); });

    for (const ai of orden) {
      const area = areas[ai];
      const A = Number(area.ancho); const L = Number(area.largo);
      const ocup = ocupadosPorArea[ai] || [];
      for (const rot of [0, 90]) {
        const { w, d } = huellaConRot(p, rot);
        if (w > A || d > L) continue;
        for (let y = 0; y + d <= L + 0.5 && !puesto; y += step) {
          for (let x = 0; x + w <= A + 0.5 && !puesto; x += step) {
            const r = { id: String(p.id), x, y, w, d };
            if (area.polygon && !rectEnPoligono(r, area.polygon)) continue;
            if (bloqueaPuerta(r, area.puertas || area.doors)) continue;
            if (ocup.some((o) => seSolapan(expandir(r, gap), o, 1))) continue;
            puesto = { area: ai, x, y, rot, w, d };
          }
        }
        if (puesto) break;
      }
      if (puesto) break;
    }

    if (puesto) {
      ocupadosPorArea[puesto.area].push({ id: String(p.id), x: puesto.x, y: puesto.y, w: puesto.w, d: puesto.d });
      colocacion.push({ id: String(p.id), area: puesto.area, x: puesto.x, y: puesto.y, rot: puesto.rot });
    } else {
      noColocadas.push({ id: String(p.id), codigos: [CODIGO.NO_SPACE], motivo: 'no hay ubicación válida (cabe en ninguna área sin traslape/puerta/contorno)' });
    }
  }

  return { colocacion, noColocadas };
}

// Preserva SOLO las colocaciones válidas del intento previo (para no moverlas).
function colocacionesValidas(colocacion, val) {
  const okIds = new Set((val?.porPieza || []).filter((p) => p.ok).map((p) => String(p.id)));
  return (colocacion || []).filter((c) => okIds.has(String(c?.id)));
}

// --------------------------------------------------------------------------
//  REPAIR-LOOP. `proponer` inyectable (IA o planner). Valida entre intentos.
// --------------------------------------------------------------------------
export async function acomodarConReparacion({ areas, piezas, proponer, maxIntentos = 3 }) {
  const intentos = [];
  let mejor = null;
  let colocacionValidaPrevia = [];
  let violacionesPrevias = [];

  for (let intento = 1; intento <= maxIntentos; intento++) {
    let plan;
    try {
      plan = await proponer({ areas, piezas, intento, violacionesPrevias, colocacionValidaPrevia });
    } catch (e) {
      intentos.push({ intento, error: String(e?.message || e), colocadas: mejor?.val.colocadas || 0, total: piezas.length, violaciones: [] });
      continue;
    }
    const colocacion = (plan && Array.isArray(plan.colocacion)) ? plan.colocacion : [];
    const val = validarColocacion(areas, piezas, colocacion);
    intentos.push({ intento, colocadas: val.colocadas, total: val.total, violaciones: resumenViolaciones(val) });

    if (!mejor || val.colocadas > mejor.val.colocadas) mejor = { plan, colocacion, val };

    if (val.ok) {
      return {
        ok: true, completo: true,
        plan: { ...plan, caben: true },
        colocacion, colocadas: val.colocadas, total: val.total,
        porPieza: val.porPieza, noColocadas: [], recomendaciones: [], intentos,
      };
    }
    colocacionValidaPrevia = colocacionesValidas(colocacion, val);
    violacionesPrevias = resumenViolaciones(val);
  }

  const b = mejor || { plan: { colocacion: [] }, colocacion: [], val: validarColocacion(areas, piezas, []) };
  return {
    ok: true, completo: false,
    plan: { ...b.plan, caben: false },
    colocacion: b.colocacion,
    colocadas: b.val.colocadas, total: b.val.total,
    porPieza: b.val.porPieza,
    noColocadas: b.val.noColocadas,
    recomendaciones: recomendacionesParcial(b.val),
    intentos,
  };
}
