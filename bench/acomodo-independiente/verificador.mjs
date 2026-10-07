// Verificador geométrico INDEPENDIENTE (no importa judge.js ni spatial-core.js).
// Unidades mm. Reglas:
//  R1 cantidades exactas: cada pieza colocada exactamente una vez; sin fantasmas.
//  R2 dentro del área: bbox y polígono (muestreo cada 50 mm dentro del rect).
//  R3 sin traslapes por huella física; única excepción: pedestal (UNDERDESK_STORAGE,
//     ≤600 de ancho) bajo el tablero de SU ancla del mismo grupo. Credenza bajo escritorio = traslape.
//  R4 obstáculos: huella no toca columna/obstáculo.
//  R5 puertas: huella no toca el barrido (puerta {x,y,ancho}: disco de radio ancho;
//     puerta con bisagra: sector circular real).
//  R6 pasillo ≥1000 mm entre bloques distintos (bloque = ancla + sus dependientes;
//     pieza suelta = su propio bloque). Tocarse (0 mm) también es violación.
//  R7 sillas pegadas: cada dependiente a ≤300 mm de la huella del ancla de SU grupo, misma área.
//  R8 zona: pieza en el área que pide (zone_id o zonaSugerida = nombre del área).
const AISLE = 1000, ATTACH = 300, ATTACH_GUARDA = 1500;
const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const esAncla = (r) => typeof r === 'string' && r.startsWith('ANCHOR_');
const esDep = (r) => /_SEAT$|_STORAGE$/.test(String(r || ''));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export function huella(c, p) {
  const r = n(c.rot) % 180 !== 0;
  return { x: n(c.x), y: n(c.y), w: r ? n(p.d) : n(p.w), h: r ? n(p.w) : n(p.d) };
}
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const seTocanInterior = (a, b) => (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) > 1 && (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) > 1;
export const dist = (a, b) => Math.hypot(Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)), Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)));

function enPoly(px, py, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function muestras(r, paso = 50) {
  const pts = [];
  const xs = []; for (let x = r.x + 1; x < r.x + r.w; x += paso) xs.push(x); xs.push(r.x + r.w - 1);
  const ys = []; for (let y = r.y + 1; y < r.y + r.h; y += paso) ys.push(y); ys.push(r.y + r.h - 1);
  for (const x of xs) for (const y of ys) pts.push([x, y]);
  return pts;
}
function dentro(r, a) {
  const W = n(a.ancho), H = n(a.largo);
  if (r.x < -1 || r.y < -1 || r.x + r.w > W + 1 || r.y + r.h > H + 1) return false;
  if (Array.isArray(a.poly) && a.poly.length >= 3) return muestras(r).every(([x, y]) => enPoly(x, y, a.poly));
  return true;
}
function tocaPuerta(r, p) {
  if (p.tieneBarrido && Number.isFinite(+p.bisagraX)) {
    const hx = +p.bisagraX, hy = +p.bisagraY, R = n(p.ancho);
    const a0 = n(p.anguloCerradaDeg) * Math.PI / 180, amp = n(p.barridoDeg, 90) * Math.PI / 180;
    const dir = String(p.sentido).toLowerCase() === 'antihorario' ? -1 : 1;
    return muestras(r, 25).some(([x, y]) => {
      const dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy);
      if (d > R) return false;
      let ang = Math.atan2(dy, dx) - a0; ang *= dir;
      ang = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return ang <= amp + 1e-9;
    });
  }
  const R = n(p.ancho), cx = n(p.x), cy = n(p.y);
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w)), ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return Math.hypot(nx - cx, ny - cy) < R - 1;
}

export function verificar(areas, piezasIn, colocacion) {
  const piezas = piezasIn;
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const fallas = [];
  const malas = new Set();
  const add = (code, ids, det = '') => { fallas.push({ code, ids, det }); ids.forEach((i) => malas.add(i)); };
  // R1
  const vistos = new Map();
  for (const c of colocacion) {
    const id = String(c.id);
    if (!byId.has(id)) { fallas.push({ code: 'FANTASMA', ids: [id] }); continue; }
    vistos.set(id, (vistos.get(id) || 0) + 1);
  }
  for (const [id, k] of vistos) if (k > 1) add('DUPLICADA', [id]);
  const faltan = piezas.filter((p) => !vistos.has(String(p.id))).map((p) => String(p.id));
  const R = new Map();
  for (const c of colocacion) { const id = String(c.id); if (byId.has(id) && !R.has(id)) R.set(id, { ...huella(c, byId.get(id)), area: n(c.area), p: byId.get(id) }); }
  // ancla por grupo
  const anclaGrupo = new Map();
  for (const p of piezas) if (esAncla(p.relation_role) && p.functional_group_id) {
    if (!anclaGrupo.has(p.functional_group_id)) anclaGrupo.set(p.functional_group_id, []);
    anclaGrupo.get(p.functional_group_id).push(String(p.id));
  }
  // dueño: si el grupo tiene 1 ancla, esa; si tiene varias, la más cercana colocada.
  const dueno = (id) => {
    const p = byId.get(id); const g = p.functional_group_id; const as = anclaGrupo.get(g) || [];
    if (!as.length) return null;
    if (as.length === 1) return as[0];
    const r = R.get(id); let best = null, bd = Infinity;
    for (const a of as) { const ra = R.get(a); if (ra && r && ra.area === r.area) { const d = dist(r, ra); if (d < bd) { bd = d; best = a; } } }
    return best || as[0];
  };
  const bloque = (id) => { const p = byId.get(id); if (esAncla(p.relation_role)) return id; if (esDep(p.relation_role)) return dueno(id) || `solo:${id}`; return `solo:${id}`; };
  // R2 R4 R5 R8
  for (const [id, r] of R) {
    const a = areas[r.area];
    if (!a) { add('AREA_INEXISTENTE', [id]); continue; }
    if (!dentro(r, a)) add('FUERA_DEL_CUARTO', [id], a.nombre);
    for (const o of a.obstaculos || []) if (seTocanInterior(r, { x: n(o.x), y: n(o.y), w: n(o.w), h: n(o.h) })) { add('OBSTACULO', [id], a.nombre); break; }
    for (const pu of a.puertas || []) if (tocaPuerta(r, pu)) { add('PUERTA', [id], a.nombre); break; }
    const pide = r.p.zone_id ?? r.p.zonaSugerida ?? null;
    if (pide != null) { const ok = norm(a.zone_id) === norm(pide) || norm(a.nombre) === norm(pide); if (!ok) add('ZONA_EQUIVOCADA', [id], `${pide}→${a.nombre}`); }
  }
  // R3 R6
  const ids = [...R.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = R.get(ids[i]), b = R.get(ids[j]);
    if (a.area !== b.area) continue;
    if (seTocanInterior(a, b)) {
      const legal = (x, y, ix, iy) => x.p.relation_role === 'UNDERDESK_STORAGE' && Math.min(x.w, x.h) <= 600 && esAncla(y.p.relation_role) && x.p.functional_group_id === y.p.functional_group_id;
      if (!(legal(a, b) || legal(b, a))) add('TRASLAPE', [ids[i], ids[j]], `${a.p.nombre || a.p.relation_role} × ${b.p.nombre || b.p.relation_role}`);
      continue;
    }
    if (bloque(ids[i]) === bloque(ids[j])) continue;
    const d = dist(a, b);
    if (d < AISLE - 1) add('PASILLO', [ids[i], ids[j]], `${Math.round(d)} mm`);
  }
  // R7
  for (const [id, r] of R) {
    if (!esDep(r.p.relation_role)) continue;
    const an = dueno(id);
    if (!an) { add('SIN_ANCLA', [id]); continue; }
    const ra = R.get(an);
    if (!ra) { add('SILLA_SIN_SU_MUEBLE', [id]); continue; }
    if (ra.area !== r.area || dist(r, ra) > (/STORAGE$/.test(r.p.relation_role) ? ATTACH_GUARDA : ATTACH)) add('DESPEGADA', [id], `${Math.round(dist(r, ra))} mm`);
  }
  const colocadas = R.size;
  const bien = [...R.keys()].filter((id) => !malas.has(id)).length;
  const codes = {}; for (const f of fallas) codes[f.code] = (codes[f.code] || 0) + 1;
  const pass = faltan.length === 0 && fallas.length === 0;
  return { total: piezas.length, colocadas, bien, faltan, fallas, codes, pass };
}

// Criterio de USO (separado del geométrico): banca doble con sillas de un solo lado.
export function revisarUso(areas, piezas, colocacion) {
  const byId = new Map(piezas.map((p) => [String(p.id), p]));
  const R = new Map(colocacion.filter((c) => byId.has(String(c.id))).map((c) => [String(c.id), { ...huella(c, byId.get(String(c.id))), area: c.area }]));
  const notas = [];
  for (const p of piezas) {
    if (p.relation_role !== 'ANCHOR_WORKSTATION' || n(p.user_capacity) < 2 || !/doble/i.test(p.nombre || '')) continue;
    const ra = R.get(String(p.id)); if (!ra) continue;
    const sillas = piezas.filter((s) => s.functional_group_id === p.functional_group_id && /SEAT$/.test(s.relation_role)).map((s) => R.get(String(s.id))).filter(Boolean);
    const largoX = ra.w >= ra.h;
    const lado = (s) => largoX ? (s.y + s.h / 2 < ra.y + ra.h / 2 ? 'A' : 'B') : (s.x + s.w / 2 < ra.x + ra.w / 2 ? 'A' : 'B');
    const A = sillas.filter((s) => lado(s) === 'A').length, B = sillas.length - A;
    if (sillas.length >= 2 && (A === 0 || B === 0)) notas.push(`${p.nombre?.split('·')[0].trim() || p.id} (${p.user_capacity} usuarios): las ${sillas.length} sillas quedan de UN solo lado`);
  }
  return notas;
}
