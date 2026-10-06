// ============================================================================
// acomodo-core · solver + validador + repair-loop determinista de Voni.
// Puro: sin Deno, red ni LLM. La IA puede proponer; este archivo decide si el
// resultado realmente cabe, se puede usar y es publicable.
// ============================================================================

import {
  auditarPuertas,
  bloqueaPuertaEspacial,
  evaluarCalidad,
  rectUso,
  rectsSeSolapan,
  requiereClearance,
  usoDentroArea,
  usoInvadido,
} from './spatial-core.js';

export const CODIGO = Object.freeze({
  UNKNOWN_PIECE: 'UNKNOWN_PIECE',
  INVALID_AREA: 'INVALID_AREA',
  INVALID_ROTATION: 'INVALID_ROTATION',
  OUTSIDE_AREA: 'OUTSIDE_AREA',
  OUTSIDE_POLYGON: 'OUTSIDE_POLYGON',
  OVERLAP: 'OVERLAP',
  BLOCKS_DOOR: 'BLOCKS_DOOR',
  FUNCTIONAL_CLEARANCE: 'FUNCTIONAL_CLEARANCE',
  DOOR_SWING_UNKNOWN: 'DOOR_SWING_UNKNOWN',
  NO_SPACE: 'NO_SPACE',
  FUNCTIONAL_GROUP_SPLIT: 'FUNCTIONAL_GROUP_SPLIT',
  MISSING_GROUP_ANCHOR: 'MISSING_GROUP_ANCHOR',
  WRONG_GROUP_ANCHOR: 'WRONG_GROUP_ANCHOR',
  GROUP_CAPACITY_INCOMPLETE: 'GROUP_CAPACITY_INCOMPLETE',
});

export function huellaConRot(pieza, rot) {
  const w = Number(pieza?.w) || 0;
  const d = Number(pieza?.d) || 0;
  return Number(rot) === 90 ? { w: d, d: w } : { w, d };
}

function seSolapan(a, b, tol = 1) {
  return a.x + tol < b.x + b.w && a.x + a.w > b.x + tol
    && a.y + tol < b.y + b.d && a.y + a.d > b.y + tol;
}

const expandir = (r, g) => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, d: r.d + 2 * g });

function puntoEnPoligono(x, y, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const corta = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (corta) dentro = !dentro;
  }
  return dentro;
}

function rectEnPoligono(r, poly) {
  if (!Array.isArray(poly) || poly.length < 3) return true;
  const pts = [
    [r.x + 1, r.y + 1], [r.x + r.w - 1, r.y + 1],
    [r.x + 1, r.y + r.d - 1], [r.x + r.w - 1, r.y + r.d - 1],
    [r.x + r.w / 2, r.y + r.d / 2],
  ];
  return pts.every(([px, py]) => puntoEnPoligono(px, py, poly));
}

function puertasDeArea(area) {
  return area?.puertas || area?.doors || [];
}

function bloqueaPuerta(rect, puertas) {
  return Array.isArray(puertas) && puertas.some((p) => p && bloqueaPuertaEspacial(rect, p));
}

function obstaculosDeArea(area) {
  const out = [];
  for (const o of (area?.obstaculos || area?.obstacles || [])) {
    if (!o || !Number.isFinite(Number(o.x)) || !Number.isFinite(Number(o.y))) continue;
    out.push({
      id: o.id || null,
      x: Number(o.x), y: Number(o.y),
      w: Number(o.w ?? o.width) || 0,
      d: Number(o.d ?? o.h ?? o.largo ?? o.height) || 0,
    });
  }
  return out;
}

function agregarProblema(resultado, codigo, motivo) {
  if (!resultado.codigos.includes(codigo)) resultado.codigos.push(codigo);
  const prev = resultado.motivo ? resultado.motivo.split('; ').filter(Boolean) : [];
  if (!prev.includes(motivo)) prev.push(motivo);
  resultado.motivo = prev.join('; ');
  resultado.ok = false;
}


const grupoId = (p) => p?.functional_group_id || p?.functionalGroupId || null;
const relationRole = (p) => String(p?.relation_role || p?.relationRole || '');
const anchorRole = (p) => String(p?.anchor_role || p?.anchorRole || '');
const esAnchor = (p) => /^ANCHOR_/.test(relationRole(p));

function gruposFuncionales(piezas = []) {
  const grupos = new Map();
  for (const p of piezas || []) {
    const gid = grupoId(p);
    if (!gid) continue;
    if (!grupos.has(String(gid))) grupos.set(String(gid), []);
    grupos.get(String(gid)).push(p);
  }
  return grupos;
}

function anchorDelGrupo(miembros = [], esperado = '') {
  const anchors = miembros.filter(esAnchor);
  if (esperado) return anchors.find((p) => relationRole(p) === esperado) || null;
  return anchors[0] || null;
}

function interseccionAreas(miembros = [], areas = []) {
  const sets = miembros
    .map((p) => Array.isArray(p.allowedAreas)
      ? new Set(p.allowedAreas.map(Number).filter((x) => Number.isInteger(x) && areas[x]))
      : null)
    .filter(Boolean);
  if (!sets.length) return areas.map((_, i) => i);
  let out = [...sets[0]];
  for (const s of sets.slice(1)) out = out.filter((x) => s.has(x));
  return out;
}

/**
 * Un grupo funcional es indivisible por ÁREA: anchor + dependientes comparten
 * el mismo universo permitido. La posición exacta sigue siendo trabajo del solver.
 */
export function prepararGruposFuncionales(areas = [], piezas = []) {
  const grupos = gruposFuncionales(piezas);
  const byId = new Map(piezas.map((p) => [String(p.id), { ...p }]));
  const issues = [];

  for (const [gid, miembros0] of grupos) {
    const miembros = miembros0.map((p) => byId.get(String(p.id)));
    const allowed = interseccionAreas(miembros, areas);
    if (!allowed.length) {
      issues.push({ code: 'FUNCTIONAL_GROUP_NO_COMMON_AREA', group: gid });
      continue;
    }
    const anchors = miembros.filter(esAnchor);
    for (const p of miembros) {
      p.allowedAreas = allowed;
      p.functional_group_id = gid;
      if (!esAnchor(p)) {
        const esperado = anchorRole(p);
        const anchor = anchorDelGrupo(miembros, esperado);
        if (esperado && !anchor) {
          issues.push({ code: CODIGO.MISSING_GROUP_ANCHOR, group: gid, id: String(p.id), expected: esperado });
        } else if (anchor) {
          p.group_anchor_id = String(anchor.id);
        }
      }
    }
    // Anchor primero dentro del mismo grupo, sin alterar el orden relativo global
    // más allá de lo necesario para mantener la relación.
    if (!anchors.length && miembros.some((p) => anchorRole(p))) {
      issues.push({ code: CODIGO.MISSING_GROUP_ANCHOR, group: gid });
    }
  }
  return { piezas: piezas.map((p) => byId.get(String(p.id)) || p), issues };
}

export function auditarGruposFuncionales(piezas = [], colocacion = []) {
  const byCol = new Map((colocacion || []).map((x) => [String(x.id), x]));
  const issues = [];
  for (const [gid, miembros] of gruposFuncionales(piezas)) {
    const colocados = miembros.map((p) => ({ p, c: byCol.get(String(p.id)) })).filter((x) => x.c);
    if (!colocados.length) continue;
    const areas = new Set(colocados.map((x) => Number(x.c.area)));
    if (areas.size > 1) {
      for (const { p } of colocados) issues.push({ code: CODIGO.FUNCTIONAL_GROUP_SPLIT, id: String(p.id), group: gid });
    }
    for (const { p, c } of colocados) {
      if (esAnchor(p)) continue;
      const esperado = anchorRole(p);
      if (!esperado) continue;
      const anchor = anchorDelGrupo(miembros, esperado);
      if (!anchor) {
        issues.push({ code: CODIGO.MISSING_GROUP_ANCHOR, id: String(p.id), group: gid, expected: esperado });
        continue;
      }
      const ac = byCol.get(String(anchor.id));
      if (!ac || Number(ac.area) !== Number(c.area)) {
        issues.push({ code: CODIGO.WRONG_GROUP_ANCHOR, id: String(p.id), group: gid, anchor_id: String(anchor.id) });
      }
    }

    const meetingAnchor = miembros.find((p) => relationRole(p) === 'ANCHOR_MEETING');
    if (meetingAnchor) {
      const required = Number(meetingAnchor.user_capacity || meetingAnchor.capacidadUsuarios || 0);
      if (Number.isFinite(required) && required > 0) {
        const seats = miembros.filter((p) => relationRole(p) === 'MEETING_SEAT')
          .reduce((sum, p) => sum + Math.max(1, Math.round(Number(p.cantidad || p.piezas || 1))), 0);
        if (seats < required) {
          issues.push({
            code: CODIGO.GROUP_CAPACITY_INCOMPLETE,
            id: String(meetingAnchor.id), group: gid, required, seats,
          });
        }
      }
    }
  }
  return issues;
}

// --------------------------------------------------------------------------
// VALIDADOR: huella + contorno + obstáculos + puerta + espacio FUNCIONAL.
// --------------------------------------------------------------------------
export function validarColocacion(areas = [], piezas = [], colocacion = [], tolMM = 1) {
  const col = Array.isArray(colocacion) ? colocacion : [];
  const byId = new Map(col.map((c) => [String(c?.id), c]));
  const piezaPorId = new Map(piezas.map((p) => [String(p?.id), p]));
  const rectsPorArea = {};
  const porPieza = [];
  const resultadoPorId = new Map();

  for (const p of piezas) {
    const id = String(p?.id);
    const c = byId.get(id);
    const codigos = [];
    const motivos = [];
    if (!c) {
      const r = { id, ok: false, area: null, codigos: [CODIGO.UNKNOWN_PIECE], motivo: 'no colocada: la IA no devolvió posición para esta pieza' };
      porPieza.push(r); resultadoPorId.set(id, r);
      continue;
    }
    const ai = Number(c.area);
    const area = areas[ai];
    if (!area) {
      const r = { id, ok: false, area: ai, codigos: [CODIGO.INVALID_AREA], motivo: `área inválida (${c.area})` };
      porPieza.push(r); resultadoPorId.set(id, r);
      continue;
    }

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
    const poly = area.polygon || area.poly;
    if (poly && !rectEnPoligono(rect, poly)) { codigos.push(CODIGO.OUTSIDE_POLYGON); motivos.push('queda fuera del contorno real del cuarto'); }
    if (bloqueaPuerta(rect, puertasDeArea(area))) { codigos.push(CODIGO.BLOCKS_DOOR); motivos.push('bloquea una puerta / acceso'); }

    rectsPorArea[ai] = rectsPorArea[ai] || [];
    for (const otro of [...rectsPorArea[ai], ...obstaculosDeArea(area)]) {
      if (Number.isFinite(x) && Number.isFinite(y) && seSolapan(rect, otro, tolMM)) {
        codigos.push(CODIGO.OVERLAP); motivos.push(`traslapa con ${otro.id || 'un obstáculo'}`); break;
      }
    }
    rectsPorArea[ai].push(rect);
    const r = { id, ok: codigos.length === 0, area: ai, codigos, motivo: motivos.join('; ') || null };
    porPieza.push(r); resultadoPorId.set(id, r);
  }

  // Segunda pasada: el espacio de USO es distinto de la huella física. Un
  // escritorio puede no tocar a otro y aun así no permitir sentarse/abrirlo.
  for (const c of col) {
    const id = String(c?.id);
    const p = piezaPorId.get(id);
    const ai = Number(c?.area);
    const area = areas[ai];
    const res = resultadoPorId.get(id);
    if (!p || !area || !res || !requiereClearance(p)) continue;
    const rot = Number(c.rot) === 90 ? 90 : 0;
    const { w, d } = huellaConRot(p, rot);
    const rect = { id, x: Number(c.x), y: Number(c.y), w, d };
    if (![rect.x, rect.y, rect.w, rect.d].every(Number.isFinite)) continue;
    const invasion = usoInvadido({
      area,
      pieza: p,
      rot,
      rect,
      otros: rectsPorArea[ai] || [],
      obstaculos: obstaculosDeArea(area),
    });
    if (invasion) {
      const detalle = invasion.tipo === 'MUEBLE'
        ? `espacio funcional invadido por ${invasion.id}`
        : invasion.tipo === 'PUERTA'
          ? 'espacio funcional invade el barrido de una puerta'
          : invasion.tipo === 'OBSTACULO'
            ? 'espacio funcional invade un obstáculo'
            : 'espacio funcional no cabe completo dentro del área';
      agregarProblema(res, CODIGO.FUNCTIONAL_CLEARANCE, detalle);
    }
  }

  // Tercera pasada: relaciones de grupo (anchor/dependientes/capacidad).
  for (const issue of auditarGruposFuncionales(piezas, col)) {
    const res = resultadoPorId.get(String(issue.id));
    if (res) agregarProblema(res, issue.code, `grupo funcional ${issue.group || ''}: ${issue.code}`);
  }

  const colocadas = porPieza.filter((p) => p.ok).length;
  const total = piezas.length;
  const noColocadas = porPieza.filter((p) => !p.ok);
  const invariante = (colocadas + noColocadas.length) === total;
  const puertas = auditarPuertas(areas);
  const calidad = evaluarCalidad(areas, piezas, col, porPieza);
  const ok = total > 0 && colocadas === total;
  const advertencias = puertas.noVerificadas.map((p) => ({ codigo: CODIGO.DOOR_SWING_UNKNOWN, ...p }));
  return {
    ok,
    aprobable: ok && puertas.verificadas,
    colocadas, total, porPieza, noColocadas, invariante,
    puertas,
    puertasVerificadas: puertas.verificadas,
    advertencias,
    calidad,
  };
}

export function resumenViolaciones(val) {
  const piezas = (val?.noColocadas || []).map((p) => `Pieza ${p.id}: ${p.motivo || 'inválida'}${p.codigos?.length ? ` [${p.codigos.join(',')}]` : ''}`);
  const puertas = (val?.advertencias || []).map((a) => `${a.motivo} [${a.codigo}]`);
  return [...piezas, ...puertas];
}

export function recomendacionesParcial(val) {
  const cods = new Set([
    ...(val?.noColocadas || []).flatMap((p) => p.codigos || []),
    ...(val?.advertencias || []).map((a) => a.codigo),
  ]);
  const recs = [];
  if (cods.has(CODIGO.OVERLAP)) recs.push('Hay traslapes: separa las piezas o baja la densidad del área.');
  if (cods.has(CODIGO.OUTSIDE_AREA) || cods.has(CODIGO.OUTSIDE_POLYGON)) recs.push('Piezas que no caben en su área: muévelas a otra con más espacio o revisa medidas.');
  if (cods.has(CODIGO.BLOCKS_DOOR)) recs.push('Piezas que tapan una puerta/acceso: reubícalas lejos del barrido de la puerta.');
  if (cods.has(CODIGO.FUNCTIONAL_CLEARANCE)) recs.push('Hay muebles que caben físicamente pero no dejan su espacio de uso: libera frente, silla, cajones o circulación.');
  if (cods.has(CODIGO.DOOR_SWING_UNKNOWN)) recs.push('El plano detectó una puerta sin barrido verificable: confirma bisagra, sentido y ángulo antes de aprobar el layout.');
  if (cods.has(CODIGO.FUNCTIONAL_GROUP_SPLIT) || cods.has(CODIGO.WRONG_GROUP_ANCHOR) || cods.has(CODIGO.MISSING_GROUP_ANCHOR)) recs.push('Mantén cada grupo funcional completo en una sola área y junto a su anchor correcto.');
  if (cods.has(CODIGO.GROUP_CAPACITY_INCOMPLETE)) recs.push('La sala/grupo no cumple la capacidad declarada: completa sus asientos antes de aprobar.');
  if (cods.has(CODIGO.NO_SPACE) || cods.has(CODIGO.UNKNOWN_PIECE)) recs.push('No hubo superficie libre suficiente para todas las piezas.');
  recs.push('Opciones: mover a otra área · cambiar el producto por uno más chico · acomodar a mano. No se reducen cantidades ni se inventan muebles.');
  return recs;
}

function rangoScan(max, step, reverse = false) {
  const vals = [];
  for (let v = 0; v <= max + 0.5; v += step) vals.push(v);
  if (vals.length && Math.abs(vals[vals.length - 1] - max) > 0.5) vals.push(max);
  return reverse ? vals.reverse() : vals;
}

function entradaOcupada(p, c) {
  const { w, d } = huellaConRot(p, c.rot);
  const physical = { id: String(p.id), x: Number(c.x), y: Number(c.y), w, d };
  return { ...physical, use: requiereClearance(p) ? rectUso(physical, p, Number(c.rot) === 90 ? 90 : 0) : null };
}

function candidatoCompatible(area, p, rot, r, ocup, gap) {
  const poly = area.polygon || area.poly;
  if (poly && !rectEnPoligono(r, poly)) return false;
  if (bloqueaPuerta(r, puertasDeArea(area))) return false;
  if (ocup.some((o) => seSolapan(expandir(r, gap), o, 1))) return false;

  if (requiereClearance(p)) {
    const use = rectUso(r, p, rot);
    if (!usoDentroArea(area, r, p, rot)) return false;
    if (bloqueaPuerta(use, puertasDeArea(area))) return false;
    if (obstaculosDeArea(area).some((o) => rectsSeSolapan(use, o, 0))) return false;
    if (ocup.some((o) => rectsSeSolapan(use, o, 0))) return false;
  }
  if (ocup.some((o) => o.use && rectsSeSolapan(r, o.use, 0))) return false;
  return true;
}

// --------------------------------------------------------------------------
// PLANNER determinista. Estrategias distintas permiten al repair-loop explorar
// sin introducir aleatoriedad: mismo intento + mismo input = mismo resultado.
// --------------------------------------------------------------------------
export function planearDeterminista(areas = [], piezas = [], opts = {}) {
  const groupPrep = prepararGruposFuncionales(areas, piezas);
  piezas = groupPrep.piezas;
  const gap = Number(opts.gapMM) || 120;
  const step = Number(opts.stepMM) || 100;
  const reverseScan = opts.reverseScan === true;
  const reverseAreas = opts.reverseAreas === true;
  const rotations = Array.isArray(opts.rotationOrder) && opts.rotationOrder.length
    ? opts.rotationOrder.filter((r) => r === 0 || r === 90)
    : [0, 90];
  const fijas = Array.isArray(opts.fijas) ? opts.fijas : [];
  const colocacion = [...fijas.map((c) => ({ id: String(c.id), area: Number(c.area), x: Number(c.x), y: Number(c.y), rot: Number(c.rot) || 0 }))];
  const colocadoIds = new Set(colocacion.map((c) => c.id));

  const ocupadosPorArea = {};
  areas.forEach((a, ai) => { ocupadosPorArea[ai] = obstaculosDeArea(a).map((o) => ({ ...o, use: null })); });
  for (const c of colocacion) {
    const p = piezas.find((pp) => String(pp.id) === c.id);
    if (!p || !areas[c.area]) continue;
    ocupadosPorArea[c.area].push(entradaOcupada(p, c));
  }

  const pend = piezas.filter((p) => !colocadoIds.has(String(p.id)))
    .slice()
    .sort((a, b) => {
      const ga = grupoId(a), gb = grupoId(b);
      if (ga && gb && String(ga) === String(gb)) {
        const aa = esAnchor(a) ? 0 : 1, ab = esAnchor(b) ? 0 : 1;
        if (aa !== ab) return aa - ab;
      }
      return (Number(b.w) * Number(b.d)) - (Number(a.w) * Number(a.d)) || String(a.id).localeCompare(String(b.id));
    });

  const noColocadas = [];
  for (const p of pend) {
    let puesto = null;
    const permitidas = Array.isArray(p.allowedAreas)
      ? [...new Set(p.allowedAreas.map(Number).filter((ai) => Number.isInteger(ai) && areas[ai]))]
      : null;
    const anchorPlaced = p.group_anchor_id
      ? colocacion.find((cc) => String(cc.id) === String(p.group_anchor_id))
      : null;
    const universoBase = permitidas && permitidas.length ? permitidas : areas.map((_, ai) => ai);
    const universo = anchorPlaced && universoBase.includes(Number(anchorPlaced.area))
      ? [Number(anchorPlaced.area)]
      : universoBase;
    const preferida = Number.isFinite(Number(p.area)) && universo.includes(Number(p.area)) ? Number(p.area) : null;
    let resto = universo.filter((ai) => ai !== preferida);
    if (reverseAreas) resto = resto.reverse();
    const orden = preferida == null ? resto : [preferida, ...resto];

    for (const ai of orden) {
      const area = areas[ai];
      const A = Number(area.ancho); const L = Number(area.largo);
      const ocup = ocupadosPorArea[ai] || [];
      for (const rot of rotations) {
        const { w, d } = huellaConRot(p, rot);
        if (w > A || d > L) continue;
        const ys = rangoScan(Math.max(0, L - d), step, reverseScan);
        const xs = rangoScan(Math.max(0, A - w), step, reverseScan);
        for (const y of ys) {
          for (const x of xs) {
            const r = { id: String(p.id), x, y, w, d };
            if (!candidatoCompatible(area, p, rot, r, ocup, gap)) continue;
            puesto = { area: ai, x, y, rot, w, d };
            break;
          }
          if (puesto) break;
        }
        if (puesto) break;
      }
      if (puesto) break;
    }

    if (puesto) {
      const c = { id: String(p.id), area: puesto.area, x: puesto.x, y: puesto.y, rot: puesto.rot };
      ocupadosPorArea[puesto.area].push(entradaOcupada(p, c));
      colocacion.push(c);
    } else {
      noColocadas.push({ id: String(p.id), codigos: [CODIGO.NO_SPACE], motivo: 'no hay ubicación válida (cabe en ninguna área sin traslape/puerta/contorno/espacio funcional)' });
    }
  }

  return { colocacion, noColocadas };
}

function colocacionesValidas(colocacion, val) {
  const okIds = new Set((val?.porPieza || []).filter((p) => p.ok).map((p) => String(p.id)));
  return (colocacion || []).filter((c) => okIds.has(String(c?.id)));
}

function esMejor(val, mejor) {
  if (!mejor) return true;
  if (val.colocadas !== mejor.val.colocadas) return val.colocadas > mejor.val.colocadas;
  return Number(val?.calidad?.score || 0) > Number(mejor?.val?.calidad?.score || 0);
}

// --------------------------------------------------------------------------
// REPAIR-LOOP. Hasta 3 intentos; conserva lo válido y elige el mejor no sólo
// por cantidad sino por score espacial. Datos faltantes no se “reparan” a ojo.
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
    intentos.push({ intento, colocadas: val.colocadas, total: val.total, score: val.calidad.score, puertas: val.puertas.status, violaciones: resumenViolaciones(val) });

    if (esMejor(val, mejor)) mejor = { plan, colocacion, val };

    if (val.aprobable) {
      return {
        ok: true, completo: true, aprobable: true,
        plan: { ...plan, caben: true },
        colocacion, colocadas: val.colocadas, total: val.total,
        porPieza: val.porPieza, noColocadas: [], recomendaciones: [], intentos,
        calidad: val.calidad, puertas: val.puertas, advertencias: val.advertencias,
      };
    }

    if (val.ok && !val.puertasVerificadas) break;

    colocacionValidaPrevia = colocacionesValidas(colocacion, val);
    violacionesPrevias = resumenViolaciones(val);
  }

  const b = mejor || { plan: { colocacion: [] }, colocacion: [], val: validarColocacion(areas, piezas, []) };
  return {
    ok: true, completo: false, aprobable: false,
    plan: { ...b.plan, caben: false },
    colocacion: b.colocacion,
    colocadas: b.val.colocadas, total: b.val.total,
    porPieza: b.val.porPieza,
    noColocadas: b.val.noColocadas,
    recomendaciones: recomendacionesParcial(b.val),
    intentos,
    calidad: b.val.calidad,
    puertas: b.val.puertas,
    advertencias: b.val.advertencias,
  };
}
