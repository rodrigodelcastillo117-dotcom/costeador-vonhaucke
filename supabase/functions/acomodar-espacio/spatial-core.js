// ============================================================================
// spatial-core · contrato espacial determinista para Voni
//
// Esta capa NO decide negocio ni inventa datos del plano. Convierte metadatos
// espaciales explícitos (clearances, preferencias y barrido de puertas) en
// geometría verificable que comparten el solver y el validador.
// ============================================================================

const EPS = 1;

const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const esFinito = (v) => Number.isFinite(Number(v));

export function spatialSpecDe(pieza = {}) {
  return pieza?.spatial_spec || pieza?.spatial || pieza?.espacial || {};
}

function ladosBase(spec = {}) {
  const c = spec.clearance_mm ?? spec.clearance ?? spec.user_envelope_mm ?? null;
  if (Number.isFinite(Number(c))) {
    const v = Math.max(0, Number(c));
    return { top: v, right: v, bottom: v, left: v };
  }
  if (c && typeof c === 'object') {
    return {
      top: Math.max(0, n(c.top ?? c.arriba ?? c.back ?? c.rear, 0)),
      right: Math.max(0, n(c.right ?? c.derecha, 0)),
      bottom: Math.max(0, n(c.bottom ?? c.abajo ?? c.front ?? c.frente, 0)),
      left: Math.max(0, n(c.left ?? c.izquierda, 0)),
    };
  }
  const side = Math.max(0, n(spec.side_clearance_mm, 0));
  return {
    top: Math.max(0, n(spec.rear_clearance_mm, 0)),
    right: side,
    bottom: Math.max(0, n(spec.front_clearance_mm, 0)),
    left: side,
  };
}

export function clearancesDe(pieza = {}, rot = 0) {
  const b = ladosBase(spatialSpecDe(pieza));
  if (rot === 90) {
    // Giro horario: top→right, right→bottom, bottom→left, left→top.
    return { top: b.left, right: b.top, bottom: b.right, left: b.bottom };
  }
  return b;
}

export function requiereClearance(pieza = {}) {
  const c = clearancesDe(pieza, 0);
  return c.top > 0 || c.right > 0 || c.bottom > 0 || c.left > 0;
}

export function rectUso(rect, pieza = {}, rot = 0) {
  if (!rect) return null;
  const c = clearancesDe(pieza, rot);
  return {
    x: rect.x - c.left,
    y: rect.y - c.top,
    w: rect.w + c.left + c.right,
    d: rect.d + c.top + c.bottom,
  };
}

export function rectsSeSolapan(a, b, tol = EPS) {
  if (!a || !b) return false;
  return a.x < b.x + b.w - tol
    && a.x + a.w > b.x + tol
    && a.y < b.y + b.d - tol
    && a.y + a.d > b.y + tol;
}

export function puntoEnPoligono([x, y], poly = []) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const cruza = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

export function rectDentroPoligono(rect, poly = []) {
  if (!rect || !Array.isArray(poly) || poly.length < 3) return true;
  const pts = [
    [rect.x + EPS, rect.y + EPS],
    [rect.x + rect.w - EPS, rect.y + EPS],
    [rect.x + rect.w - EPS, rect.y + rect.d - EPS],
    [rect.x + EPS, rect.y + rect.d - EPS],
  ];
  return pts.every((p) => puntoEnPoligono(p, poly));
}

const dentroRect = ([x, y], r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const enSegmento = (a, b, p) => (
  Math.min(a[0], b[0]) - EPS <= p[0] && p[0] <= Math.max(a[0], b[0]) + EPS
  && Math.min(a[1], b[1]) - EPS <= p[1] && p[1] <= Math.max(a[1], b[1]) + EPS
);
function segmentosCruzan(a, b, c, d) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  if (Math.abs(o1) <= EPS && enSegmento(a, b, c)) return true;
  if (Math.abs(o2) <= EPS && enSegmento(a, b, d)) return true;
  if (Math.abs(o3) <= EPS && enSegmento(c, d, a)) return true;
  if (Math.abs(o4) <= EPS && enSegmento(c, d, b)) return true;
  return false;
}

export function rectIntersecaPoligono(rect, poly = []) {
  if (!rect || !Array.isArray(poly) || poly.length < 3) return false;
  const rc = [
    [rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.d], [rect.x, rect.y + rect.d],
  ];
  if (rc.some((p) => puntoEnPoligono(p, poly))) return true;
  if (poly.some((p) => dentroRect(p, rect))) return true;
  for (let i = 0; i < rc.length; i++) {
    const a = rc[i], b = rc[(i + 1) % rc.length];
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j], d = poly[(j + 1) % poly.length];
      if (segmentosCruzan(a, b, c, d)) return true;
    }
  }
  return false;
}

function puertaLegacyRect(p = {}) {
  const w = n(p.w ?? p.width, 0);
  const d = n(p.d ?? p.h ?? p.height, 0);
  if (w > 0 && d > 0 && esFinito(p.x) && esFinito(p.y)) {
    return { x: n(p.x), y: n(p.y), w, d };
  }
  return null;
}

function puertaLegacyCirculo(p = {}) {
  const r = n(p.r ?? p.radio, 0);
  return r > 0 && esFinito(p.x) && esFinito(p.y) ? { x: n(p.x), y: n(p.y), r } : null;
}

export function puertaTieneBarridoVerificable(p = {}) {
  if (puertaLegacyRect(p) || puertaLegacyCirculo(p)) return true;
  if (p.tieneBarrido !== true) return false;
  const sentido = String(p.sentido || '').toLowerCase();
  return esFinito(p.bisagraX) && esFinito(p.bisagraY)
    && esFinito(p.anguloCerradaDeg)
    && n(p.ancho, 0) > 0
    && n(p.barridoDeg, 0) > 0
    && (sentido === 'horario' || sentido === 'antihorario');
}

export function poligonoBarridoPuerta(p = {}) {
  if (!puertaTieneBarridoVerificable(p) || puertaLegacyRect(p) || puertaLegacyCirculo(p)) return null;
  const hx = n(p.bisagraX), hy = n(p.bisagraY);
  const radio = n(p.ancho);
  const inicio = n(p.anguloCerradaDeg) * Math.PI / 180;
  const amplitud = Math.min(180, Math.max(1, n(p.barridoDeg, 90))) * Math.PI / 180;
  const dir = String(p.sentido).toLowerCase() === 'antihorario' ? -1 : 1;
  const pasos = Math.max(8, Math.ceil((amplitud * 180 / Math.PI) / 7.5));
  const pts = [[hx, hy]];
  for (let i = 0; i <= pasos; i++) {
    const a = inicio + dir * amplitud * (i / pasos);
    pts.push([hx + Math.cos(a) * radio, hy + Math.sin(a) * radio]);
  }
  return pts;
}

export function bloqueaPuertaEspacial(rect, puerta = {}) {
  const rr = puertaLegacyRect(puerta);
  if (rr) return rectsSeSolapan(rect, rr, 0);
  const cc = puertaLegacyCirculo(puerta);
  if (cc) {
    const nx = Math.max(rect.x, Math.min(cc.x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cc.y, rect.y + rect.d));
    return Math.hypot(nx - cc.x, ny - cc.y) < cc.r;
  }
  const sweep = poligonoBarridoPuerta(puerta);
  if (sweep) return rectIntersecaPoligono(rect, sweep);

  // Puerta detectada pero sin sentido de giro: NO afirmamos que el barrido está
  // validado. Para el solver usamos un resguardo conservador alrededor del vano
  // y el gate global seguirá UNVERIFIED hasta tener geometría real.
  if (esFinito(puerta.x) && esFinito(puerta.y) && n(puerta.ancho, 0) > 0) {
    const r = Math.max(n(puerta.ancho, 900), 900);
    const reserva = { x: n(puerta.x) - r, y: n(puerta.y) - r, w: r * 2, d: r * 2 };
    return rectsSeSolapan(rect, reserva, 0);
  }
  return false;
}

export function auditarPuertas(areas = []) {
  const todas = [];
  areas.forEach((a, area) => (a?.puertas || []).forEach((puerta, indice) => todas.push({ area, indice, puerta })));
  const noVerificadas = todas
    .filter(({ puerta }) => !puertaTieneBarridoVerificable(puerta))
    .map(({ area, indice, puerta }) => ({
      area, indice,
      motivo: `Puerta ${indice + 1} del área ${area + 1}: barrido no verificable`,
      confianza: puerta?.confianza || null,
    }));
  return {
    total: todas.length,
    verificadas: noVerificadas.length === 0,
    verificadasCount: todas.length - noVerificadas.length,
    noVerificadas,
    status: noVerificadas.length ? 'UNVERIFIED' : 'VERIFIED',
  };
}

export function usoDentroArea(area = {}, rect, pieza = {}, rot = 0) {
  if (!requiereClearance(pieza)) return true;
  const spec = spatialSpecDe(pieza);
  if (spec.clearance_must_be_inside === false) return true;
  const u = rectUso(rect, pieza, rot);
  const W = n(area.ancho), L = n(area.largo);
  if (u.x < -EPS || u.y < -EPS || u.x + u.w > W + EPS || u.y + u.d > L + EPS) return false;
  const poly = area.poly || area.polygon;
  return !poly || poly.length < 3 || rectDentroPoligono(u, poly);
}

export function usoInvadido({ area = {}, pieza = {}, rot = 0, rect, otros = [], obstaculos = [] } = {}) {
  if (!requiereClearance(pieza)) return null;
  const u = rectUso(rect, pieza, rot);
  if (!usoDentroArea(area, rect, pieza, rot)) return { tipo: 'FUERA_AREA', uso: u };
  const otro = otros.find((o) => o?.id !== pieza?.id && rectsSeSolapan(u, o, 0));
  if (otro) return { tipo: 'MUEBLE', id: otro.id, uso: u };
  const obs = obstaculos.find((o) => rectsSeSolapan(u, o, 0));
  if (obs) return { tipo: 'OBSTACULO', uso: u };
  const puerta = (area?.puertas || []).find((p) => bloqueaPuertaEspacial(u, p));
  if (puerta) return { tipo: 'PUERTA', uso: u };
  return null;
}

function centroRect(r) { return [r.x + r.w / 2, r.y + r.d / 2]; }

export function evaluarCalidad(areas = [], piezas = [], colocacion = [], porPieza = []) {
  const byId = Object.fromEntries(piezas.map((p) => [String(p.id), p]));
  const byCol = Object.fromEntries(colocacion.map((c) => [String(c.id), c]));
  const invalidas = porPieza.filter((p) => !p.ok).length;
  let softPenalty = 0;
  const breakdown = [];

  for (const c of colocacion) {
    const p = byId[String(c.id)];
    const a = areas[c.area];
    if (!p || !a) continue;
    const s = spatialSpecDe(p);
    const rot = c.rot === 90 ? 90 : 0;
    const w = rot === 90 ? n(p.d) : n(p.w);
    const d = rot === 90 ? n(p.w) : n(p.d);
    const r = { x: n(c.x), y: n(c.y), w, d };
    const [cx, cy] = centroRect(r);
    let pen = 0;

    if (s.prefer_center === true || s.anchor === 'center' || s.ancla === 'centro') {
      const dx = Math.abs(cx - n(a.ancho) / 2) / Math.max(1, n(a.ancho) / 2);
      const dy = Math.abs(cy - n(a.largo) / 2) / Math.max(1, n(a.largo) / 2);
      pen += Math.min(6, (dx + dy) * 3);
    }
    if (s.prefer_wall === true || s.anchor === 'wall' || s.ancla === 'muro') {
      const dist = Math.min(r.x, r.y, Math.max(0, n(a.ancho) - (r.x + r.w)), Math.max(0, n(a.largo) - (r.y + r.d)));
      pen += Math.min(6, (dist / Math.max(1, Math.min(n(a.ancho), n(a.largo)))) * 12);
    }
    const companionId = s.companion_id ?? s.companionOf ?? s.companion_of;
    if (companionId != null && byCol[String(companionId)]) {
      const cc = byCol[String(companionId)], cp = byId[String(companionId)];
      if (cp && cc.area === c.area) {
        const cr = { x: n(cc.x), y: n(cc.y), w: cc.rot === 90 ? n(cp.d) : n(cp.w), d: cc.rot === 90 ? n(cp.w) : n(cp.d) };
        const [ox, oy] = centroRect(cr);
        const max = Math.max(1, n(s.max_companion_distance_mm, 1200));
        const exceso = Math.max(0, Math.hypot(cx - ox, cy - oy) - max);
        pen += Math.min(8, (exceso / max) * 4);
      } else {
        pen += 8;
      }
    }
    if (pen > 0) breakdown.push({ id: p.id, penalty: +pen.toFixed(2) });
    softPenalty += pen;
  }

  const hardPenalty = invalidas * 40;
  const score = Math.max(0, Math.min(100, 100 - hardPenalty - softPenalty));
  return {
    score: +score.toFixed(2),
    hard_violations: invalidas,
    hard_penalty: hardPenalty,
    soft_penalty: +softPenalty.toFixed(2),
    breakdown,
  };
}
