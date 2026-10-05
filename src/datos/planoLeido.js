// ============================================================================
// LECTURA DE PLANO -> ÁREAS CANÓNICAS DE LA APP
// Entrada: geometría absoluta en mm desde `leer-plano`.
// Salida: áreas en metros, con poly relativo y evidencia de puerta preservada.
// ============================================================================

const LADOS_CIRCULO = 24;
const PASO = 250;
const TOCA_PUERTA = 700;
const BARRIDO = 900;

export function dentroPoly(poly, x, y) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi) dentro = !dentro;
  }
  return dentro;
}

export function contornoMM(a) {
  if (a?.forma === 'circulo' && a.circulo && a.circulo.r > 0) {
    const { cx, cy, r } = a.circulo;
    const pts = [];
    for (let i = 0; i < LADOS_CIRCULO; i++) {
      const t = (i / LADOS_CIRCULO) * Math.PI * 2;
      pts.push([Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t))]);
    }
    return pts;
  }
  const pts = (a?.puntos || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (pts.length >= 3) return pts.map((p) => [Math.round(p.x), Math.round(p.y)]);
  if (Number.isFinite(a?.ancho) && Number.isFinite(a?.largo)) {
    const x = Number.isFinite(a.x) ? a.x : 0;
    const y = Number.isFinite(a.y) ? a.y : 0;
    return [[x, y], [x + a.ancho, y], [x + a.ancho, y + a.largo], [x, y + a.largo]];
  }
  return null;
}

function cercaDe(pts, x, y, tol) {
  if (dentroPoly(pts, x, y)) return true;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x1, y1] = pts[j], [x2, y2] = pts[i];
    const dx = x2 - x1, dy = y2 - y1;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= tol) return true;
  }
  return false;
}

const bbox = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
};
const m = (mm) => +(mm / 1000).toFixed(3);

export function areaM2(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(s / 2) / 1e6;
}

function comunM2(A, B) {
  const ba = bbox(A), bb = bbox(B);
  if (ba.x2 <= bb.x || bb.x2 <= ba.x || ba.y2 <= bb.y || bb.y2 <= ba.y) return 0;
  let n = 0;
  for (let y = Math.max(ba.y, bb.y); y < Math.min(ba.y2, bb.y2); y += PASO) {
    for (let x = Math.max(ba.x, bb.x); x < Math.min(ba.x2, bb.x2); x += PASO) {
      if (dentroPoly(A, x, y) && dentroPoly(B, x, y)) n++;
    }
  }
  return (n * PASO * PASO) / 1e6;
}

function anidamientos(crudas) {
  const padre = new Map();
  for (let i = 0; i < crudas.length; i++) {
    for (let j = 0; j < crudas.length; j++) {
      if (i === j) continue;
      const hijo = crudas[i], cand = crudas[j];
      const aH = areaM2(hijo.pts), aC = areaM2(cand.pts);
      if (!(aC > aH)) continue;
      const dentro = comunM2(hijo.pts, cand.pts) / (aH || 1);
      const declarado = hijo.a.dentroDe === cand.a.nombre;
      if (dentro >= (declarado ? 0.5 : 0.85)) {
        const yaP = padre.get(i);
        if (yaP == null || areaM2(crudas[yaP].pts) > aC) padre.set(i, j);
      }
    }
  }
  return padre;
}

function puertaLocal(p, b) {
  const base = {
    x: m(p.x - b.x),
    y: m(p.y - b.y),
    ancho: m(p.ancho || 900),
  };
  if (typeof p.tieneBarrido !== 'boolean') return base;
  const rich = {
    ...base,
    tieneBarrido: p.tieneBarrido,
    sentido: p.sentido || 'desconocido',
    barridoDeg: Number(p.barridoDeg) || 0,
    anguloCerradaDeg: Number(p.anguloCerradaDeg) || 0,
    confianza: p.confianza || 'baja',
  };
  if (p.tieneBarrido && Number.isFinite(p.bisagraX) && Number.isFinite(p.bisagraY)) {
    rich.bisagraX = m(p.bisagraX - b.x);
    rich.bisagraY = m(p.bisagraY - b.y);
  }
  return rich;
}

export function areasDeLectura(lectura) {
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);

  const padre = anidamientos(crudas);
  const hijos = new Map();
  for (const [h, p] of padre) {
    const n = crudas[p].a.nombre;
    if (!hijos.has(n)) hijos.set(n, []);
    hijos.get(n).push(crudas[h].pts);
  }

  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const nombreDe = (i) => crudas[i].a.nombre || 'Área';
  const padreDe = new Map();
  for (const [h, p] of padre) padreDe.set(nombreDe(h), nombreDe(p));

  const areas = crudas.map(({ a, pts }, idx) => {
    const b = bbox(pts);
    const obst = (hijos.get(a.nombre) || []).map((hp) => {
      const hb = bbox(hp);
      return { x: m(hb.x - b.x), y: m(hb.y - b.y), w: m(hb.x2 - hb.x), h: m(hb.y2 - hb.y), tipo: 'cuarto' };
    });
    const suyas = puertas.filter((p) => cercaDe(pts, p.x, p.y, TOCA_PUERTA));
    for (const p of suyas) {
      const lado = Math.max(p.ancho || 900, 900) + BARRIDO;
      obst.push({ x: m(p.x - b.x - lado / 2), y: m(p.y - b.y - lado / 2), w: m(lado), h: m(lado), tipo: 'puerta' });
    }
    return {
      nombre: a.nombre || 'Área',
      ...(a.tipo ? { tipo: a.tipo } : {}),
      ...(Number.isFinite(a.puestos) && a.puestos > 0 ? { puestos: a.puestos } : {}),
      ...(padreDe.has(nombreDe(idx)) ? { dentroDe: padreDe.get(nombreDe(idx)) } : {}),
      ...((hijos.get(a.nombre) || []).length ? { contiene: (hijos.get(a.nombre) || []).length } : {}),
      x: m(b.x), y: m(b.y),
      ancho: m(b.x2 - b.x), largo: m(b.y2 - b.y),
      poly: pts.map(([px, py]) => [m(px - b.x), m(py - b.y)]),
      ...(obst.length ? { obstaculos: obst } : {}),
      ...(suyas.length ? { puertas: suyas.map((p) => puertaLocal(p, b)) } : {}),
    };
  });

  return { areas, envolvente: lectura?.envolvente || null, puertas };
}

export function revisarAreas(lectura) {
  const problemas = [];
  const env = lectura?.envolvente;
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);
  if (!crudas.length) return ['No se reconoció ningún cuarto en el plano.'];

  if (env?.ancho > 0 && env?.largo > 0) {
    const fuera = crudas.filter(({ pts }) => pts.some(([x, y]) => x < -50 || y < -50 || x > env.ancho + 50 || y > env.largo + 50));
    if (fuera.length) problemas.push(`${fuera.length} cuarto(s) se salen del contorno del plano (${fuera.map((f) => f.a.nombre).join(', ')}).`);
  }

  const padre = anidamientos(crudas);
  const anidado = (i, j) => padre.get(i) === j || padre.get(j) === i;
  for (let i = 0; i < crudas.length; i++) {
    for (let j = i + 1; j < crudas.length; j++) {
      if (anidado(i, j)) continue;
      const A = crudas[i], B = crudas[j];
      const m2 = comunM2(A.pts, B.pts);
      const menor = Math.min(areaM2(A.pts), areaM2(B.pts));
      if (m2 > 1 && m2 > menor * 0.05) problemas.push(`"${A.a.nombre}" y "${B.a.nombre}" se enciman ${m2.toFixed(1)} m².`);
    }
  }

  if (env?.ancho > 0 && env?.largo > 0) {
    const sum = crudas.reduce((s, r, i) => s + (padre.has(i) ? 0 : areaM2(r.pts)), 0);
    const total = (env.ancho * env.largo) / 1e6;
    if (sum > total * 1.05) problemas.push(`Los cuartos suman ${sum.toFixed(0)} m² y el plano mide ${total.toFixed(0)} m².`);
  }

  for (const { a, pts } of crudas) {
    const b = bbox(pts);
    const w = (b.x2 - b.x) / 1000, h = (b.y2 - b.y) / 1000;
    const nom = a.nombre || 'Área';
    if (w < 0.5 || h < 0.5) problemas.push(`"${nom}" quedó diminuto (${w.toFixed(2)}×${h.toFixed(2)} m): puede ser un muro o una cota leída como cuarto.`);
    else if (w > 50 || h > 50) problemas.push(`"${nom}" quedó enorme (${w.toFixed(1)}×${h.toFixed(1)} m): revisa la escala del plano.`);
    else {
      const larg = Math.max(w, h), cort = Math.min(w, h);
      if (cort > 0 && larg / cort > 12 && cort < 1) problemas.push(`"${nom}" es una astilla (${w.toFixed(2)}×${h.toFixed(2)} m): probablemente un muro, no un cuarto.`);
    }
  }

  const vistos = new Set();
  const dupAvisado = new Set();
  for (const { a } of crudas) {
    const n = String(a.nombre || '').trim().toLowerCase();
    if (!n) continue;
    if (vistos.has(n) && !dupAvisado.has(n)) {
      problemas.push(`El cuarto "${a.nombre}" aparece más de una vez: puede ser una doble lectura.`);
      dupAvisado.add(n);
    }
    vistos.add(n);
  }

  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const huerfanas = puertas.filter((p) => !crudas.some(({ pts }) => cercaDe(pts, p.x, p.y, TOCA_PUERTA)));
  if (huerfanas.length) problemas.push(`${huerfanas.length} puerta(s) no caen sobre ningún cuarto: revisa dónde está el acceso.`);

  const sinBarrido = puertas.filter((p) => typeof p.tieneBarrido === 'boolean' && !p.tieneBarrido);
  if (sinBarrido.length) problemas.push(`${sinBarrido.length} puerta(s) no tienen barrido verificable: confirma bisagra y sentido antes de aprobar el acomodo.`);

  return problemas;
}

export function resumenLectura(lectura) {
  const crudas = (lectura?.areas || [])
    .map((a) => ({ a, pts: contornoMM(a) }))
    .filter((r) => r.pts && r.pts.length >= 3);
  const problemas = revisarAreas(lectura);
  const padre = anidamientos(crudas);
  const m2 = crudas.reduce((s, r, i) => s + (padre.has(i) ? 0 : areaM2(r.pts)), 0);
  const puertas = (lectura?.puertas || []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const puertasPendientes = puertas.filter((p) => typeof p.tieneBarrido === 'boolean' && !p.tieneBarrido).length;
  const nivel = !crudas.length ? 'nula' : problemas.length === 0 ? 'alta' : problemas.length <= 2 ? 'media' : 'baja';
  return {
    cuartos: crudas.length,
    m2: +m2.toFixed(1),
    puertas: puertas.length,
    puertasVerificadas: puertas.length - puertasPendientes,
    puertasPendientes,
    problemas,
    nProblemas: problemas.length,
    nivel,
    confiable: problemas.length === 0 && crudas.length > 0,
  };
}
