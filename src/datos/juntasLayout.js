// ============================================================================
// SALAS DE JUNTAS · post-procesador determinista del layout
//
// El planner ya reserva holgura alrededor de las mesas de juntas, pero las
// sillas se procesaban después como asientos genéricos. Resultado: una silla de
// reunión podía quedar contra un muro, junto a un bench, o incluso quedar fuera
// aunque hubiera espacio reservado alrededor de la mesa.
//
// Esta capa usa la colocación ya validada de las MESAS como ancla y sienta las
// sillas de junta alrededor. No inventa cantidades ni muebles. Si una silla no
// cabe sin salirse/traslaparse, se deja SIN COLOCAR y el plan queda incompleto.
// ============================================================================
import { dimsPieza } from './espacio.js';
import { destinoMarcado } from './destinoAcomodo.js';
import { dentroPoly } from './malla.js';

const GAP_MESA = 80;   // separación física mesa ↔ silla
const GAP_SILLA = 80;  // separación lateral entre sillas

const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function esSillaJuntasLayout(p = {}) {
  const t = norm(`${p.nombre || ''} ${p.ruta || ''}`);
  const esSilla = /silla|chair|asiento/.test(t);
  // destinoAcomodo puede retaggear `tipo` a "juntas"; por eso el nombre/rol
  // funcional decide si es SILLA, no `tipo === asiento`.
  const destino = destinoMarcado(p);
  if (destino) return destino === 'juntas' && esSilla;
  if (!esSilla && p?.tipo !== 'asiento') return false;
  return /silla.*junta|junta.*silla|consejo|board|meeting/.test(t);
}

export function esMesaJuntasLayout(p = {}) {
  const t = norm(`${p.nombre || ''} ${p.ruta || ''}`);
  // destinoAcomodo puede convertir tanto mesa como sillas a tipo='juntas'.
  // Nunca uses ese tipo por sí solo para decidir que algo ES una mesa.
  if (/silla|chair|asiento/.test(t)) return false;
  if (/mesa.*junta|junta.*mesa|mesa.*consejo|boardroom|meeting table/.test(t)) return true;
  return p?.tipo === 'juntas' && /mesa|table|consejo|board|meeting/.test(t);
}

export function capacidadMesaJuntas(p = {}) {
  for (const k of ['user_capacity', 'capacidadUsuarios', 'capacidad', 'usuarios', 'personas', 'seat_count']) {
    const n = Number(p?.[k]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const t = norm(`${p.nombre || ''} ${p.nota || ''} ${p.descripcion || ''}`);
  const m = t.match(/(?:para\s*)?(\d{1,2})\s*(?:personas|usuarios|pax|plazas)/);
  return m ? Math.max(1, Number(m[1])) : 0;
}

function caja(c, p) {
  const { pw, ph } = dimsPieza(p, c?.rot || 0);
  return { x: Number(c?.x) || 0, y: Number(c?.y) || 0, w: pw, d: ph };
}

function solapa(a, b, gap = 0) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x
    && a.y < b.y + b.d + gap && a.y + a.d + gap > b.y;
}

function dentro(area, r) {
  if (!area || r.x < 0 || r.y < 0 || r.x + r.w > Number(area.ancho || 0) || r.y + r.d > Number(area.largo || 0)) return false;
  const poly = area.poly || area.polygon;
  if (!Array.isArray(poly) || poly.length < 3) return true;
  const pts = [
    [r.x + 2, r.y + 2],
    [r.x + r.w - 2, r.y + 2],
    [r.x + 2, r.y + r.d - 2],
    [r.x + r.w - 2, r.y + r.d - 2],
  ];
  return pts.every(([x, y]) => dentroPoly(poly, x, y));
}

function chocaObstaculo(area, r) {
  return (area?.obstaculos || area?.obstacles || []).some((o) => {
    const q = { x: Number(o?.x) || 0, y: Number(o?.y) || 0, w: Number(o?.w ?? o?.width) || 0, d: Number(o?.h ?? o?.d ?? o?.height) || 0 };
    return solapa(r, q, 0);
  });
}

function posicionesAlrededor(table, chair) {
  const cw = chair.w, cd = chair.d;
  const out = [];

  const nx = Math.max(1, Math.floor((table.w + GAP_SILLA) / (cw + GAP_SILLA)));
  const totalX = nx * cw + Math.max(0, nx - 1) * GAP_SILLA;
  const sx = table.x + (table.w - totalX) / 2;
  for (let i = 0; i < nx; i++) {
    const x = sx + i * (cw + GAP_SILLA);
    out.push({ x, y: table.y - GAP_MESA - cd, w: cw, d: cd, rot: 0, lado: 'arriba' });
    out.push({ x, y: table.y + table.d + GAP_MESA, w: cw, d: cd, rot: 0, lado: 'abajo' });
  }

  const ny = Math.max(1, Math.floor((table.d + GAP_SILLA) / (cw + GAP_SILLA)));
  const totalY = ny * cw + Math.max(0, ny - 1) * GAP_SILLA;
  const sy = table.y + (table.d - totalY) / 2;
  for (let i = 0; i < ny; i++) {
    const y = sy + i * (cw + GAP_SILLA);
    out.push({ x: table.x - GAP_MESA - cd, y, w: cd, d: cw, rot: 90, lado: 'izq' });
    out.push({ x: table.x + table.w + GAP_MESA, y, w: cd, d: cw, rot: 90, lado: 'der' });
  }
  return out;
}

function actualizarAuditoria(auditoria = [], colocadas, total, sillasOk, sillasTotal) {
  const out = (auditoria || []).filter((a) => a?.check !== 'Sillas de juntas junto a su mesa').map((a) => (
    a?.check === 'Todas las piezas colocadas'
      ? { ...a, ok: colocadas === total, detalle: `${colocadas} de ${total}` }
      : a
  ));
  out.push({
    check: 'Sillas de juntas junto a su mesa',
    ok: sillasOk === sillasTotal,
    detalle: `${sillasOk} de ${sillasTotal} silla(s) de junta quedaron alrededor de una mesa de junta`,
  });
  return out;
}

export function sentarJuntas(plan = {}, piezas = [], areas = []) {
  const byId = Object.fromEntries((piezas || []).map((p) => [String(p.id), p]));
  const colocacionOriginal = Array.isArray(plan?.colocacion) ? plan.colocacion : [];
  const porId = new Map(colocacionOriginal.map((c) => [String(c.id), c]));
  const sillasTodas = (piezas || []).filter(esSillaJuntasLayout);
  if (!sillasTodas.length) return plan;

  const mesas = colocacionOriginal
    .map((c) => ({ c, p: byId[String(c.id)] }))
    .filter(({ p }) => p && esMesaJuntasLayout(p))
    .map(({ c, p }) => ({ c, p, area: Number(c.area), box: caja(c, p) }));

  if (!mesas.length) {
    const manuales = colocacionOriginal.filter((c) => !esSillaJuntasLayout(byId[String(c.id)]) || c.manual);
    const faltan = sillasTodas.filter((p) => !manuales.some((c) => String(c.id) === String(p.id))).length;
    const colocadas = manuales.length;
    const total = piezas.length;
    return {
      ...plan,
      colocacion: manuales,
      caben: faltan === 0 && colocadas === total,
      auditoria: actualizarAuditoria(plan.auditoria, colocadas, total, sillasTodas.length - faltan, sillasTodas.length),
      notas: [...(plan.notas || []), ...(faltan ? [`${faltan} silla(s) de junta quedaron sin colocar porque no hay una mesa de juntas colocada.`] : [])],
    };
  }

  const base = colocacionOriginal.filter((c) => {
    const p = byId[String(c.id)];
    return !p || !esSillaJuntasLayout(p) || c.manual;
  });
  const ocupados = base.map((c) => {
    const p = byId[String(c.id)];
    return p ? { area: Number(c.area), id: String(c.id), ...caja(c, p) } : null;
  }).filter(Boolean);

  const colocadas = [...base];
  let sentadas = sillasTodas.filter((p) => porId.get(String(p.id))?.manual).length;
  const automaticas = sillasTodas.filter((p) => !porId.get(String(p.id))?.manual);

  automaticas.forEach((p, idx) => {
    const previa = porId.get(String(p.id));
    const ordenMesas = [...mesas].sort((a, b) => {
      const pa = previa && a.area === Number(previa.area) ? -1000 : 0;
      const pb = previa && b.area === Number(previa.area) ? -1000 : 0;
      if (pa !== pb) return pa - pb;
      const ia = mesas.indexOf(a), ib = mesas.indexOf(b);
      const ra = (ia - (idx % mesas.length) + mesas.length) % mesas.length;
      const rb = (ib - (idx % mesas.length) + mesas.length) % mesas.length;
      return ra - rb;
    });

    let elegida = null;
    for (const m of ordenMesas) {
      const area = areas[m.area];
      if (!area) continue;
      const d0 = dimsPieza(p, 0);
      const candidatos = posicionesAlrededor(m.box, { w: d0.pw, d: d0.ph });
      for (const cand of candidatos) {
        const r = { x: Math.round(cand.x), y: Math.round(cand.y), w: cand.w, d: cand.d };
        if (!dentro(area, r) || chocaObstaculo(area, r)) continue;
        if (ocupados.some((o) => o.area === m.area && solapa(r, o, 25))) continue;
        elegida = { id: p.id, area: m.area, x: r.x, y: r.y, rot: cand.rot, contra: `mesa:${m.c.id}`, alrededorDe: m.c.id };
        ocupados.push({ area: m.area, id: String(p.id), ...r });
        break;
      }
      if (elegida) break;
    }
    if (elegida) { colocadas.push(elegida); sentadas += 1; }
  });

  const total = piezas.length;
  const nCol = colocadas.length;
  const faltan = sillasTodas.length - sentadas;

  // CAPACIDAD FUNCIONAL: una "mesa para 8" requiere 8 posiciones útiles ligadas
  // físicamente a ESA mesa. No basta con tener ocho sillas en el mismo cuarto.
  const capacidad = mesas
    .map((m) => ({ id: String(m.c.id), requerida: capacidadMesaJuntas(m.p) }))
    .filter((x) => x.requerida > 0)
    .map((x) => ({
      ...x,
      colocadas: colocadas.filter((cc) => String(cc.alrededorDe || '') === x.id).length,
    }));
  const deficits = capacidad.filter((x) => x.colocadas < x.requerida);
  const capacidadOk = deficits.length === 0;
  const caben = nCol === total && faltan === 0 && capacidadOk;
  const notas = (plan.notas || []).filter((n) => !/silla\(s\) de junta|sillas de junta|capacidad de junta/i.test(String(n)));
  if (faltan) notas.push(`${faltan} silla(s) de junta no cupieron alrededor de una mesa sin traslapar ni salirse del cuarto.`);
  if (deficits.length) {
    notas.push(`Capacidad de junta incompleta: ${deficits.map((x) => `${x.colocadas}/${x.requerida} posiciones en mesa ${x.id}`).join(' · ')}.`);
  }

  const auditoria = actualizarAuditoria(plan.auditoria, nCol, total, sentadas, sillasTodas.length);
  if (capacidad.length) {
    auditoria.push({
      check: 'Capacidad funcional de sala de juntas',
      ok: capacidadOk,
      detalle: capacidad.map((x) => `${x.colocadas}/${x.requerida} en ${x.id}`).join(' · '),
    });
  }

  return {
    ...plan,
    colocacion: colocadas,
    caben,
    auditoria,
    notas,
    resumen: caben
      ? `${plan.resumen || ''} Las sillas de juntas quedaron ligadas físicamente a sus mesas y la capacidad solicitada está satisfecha.`.trim()
      : `${plan.resumen || ''} La sala de juntas quedó incompleta: ${faltan} silla(s) sin posición válida${deficits.length ? ` y ${deficits.length} mesa(s) sin capacidad completa` : ''}.`.trim(),
  };
}
