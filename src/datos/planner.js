// ============================================================================
//  MOTOR DE ACOMODO DETERMINISTA  ·  el "cerebro" espacial de Voni.
//  Toma áreas (cuartos) + muebles (con huella real) y produce un layout
//  EFICIENTE con garantías: nada se encima, pasillos reales, guardas a muro,
//  estaciones en islas alineadas, mesa de juntas centrada. Devuelve además una
//  AUDITORÍA de todo lo que revisó (para que Voni "se fije en todo").
//  Todo en mm, coordenadas LOCALES a cada área (origen arriba-izquierda).
// ============================================================================

import { acomodarEnForma } from './malla.js';
import { regla } from './reglas.js';
import { enderezarTodo } from './orientacion.js';
import { puestosDe } from './rellenar.js';
import { dimsPieza } from './espacio.js';
import { rolDePiezaAcomodo, zonaPermite, zonaSemantica } from './floorSpec.js';
import { destinoMarcado } from './destinoAcomodo.js';

const zonaAceptaPieza = (p, area) => zonaPermite(rolDePiezaAcomodo(p), zonaSemantica(area?.nombre || ''));

const PERIM = 700;
const WALL = 60;
const AISLE = 1100;
const GAP = 140;
const MEET_CLR = 950;

export function rolArea(nombre) {
  const s = (nombre || '').toLowerCase();
  if (/ba[ñn]|w\.?c|sanit|toilet|n[úu]cleo|ducto|escaler|core|cocin|kitchen/.test(s)) return 'servicio';
  if (/jun|consejo|board/.test(s)) return 'juntas';
  if (/lounge|descanso|estar|comedor|break|caf[eé]|espera/.test(s)) return 'lounge';
  if (/recep|lobby|acceso|vest[íi]b/.test(s)) return 'recepcion';
  if (/priv|direcc|gerenc|oficina/.test(s)) return 'privado';
  // APARTADO + PAX es el vocabulario real que vino del lector de planos del CEO.
  if (/open|operativ|apartado|trabajo|estaci|planta libre|bench|isla/.test(s)) return 'open';
  return 'general';
}

function empacarFilas(cola, region, { gap = GAP, rowGap = AISLE, tope = Infinity } = {}) {
  const { x0, y0, x1, y1 } = region;
  const out = []; let x = x0, y = y0, rowH = 0, n = 0;
  while (cola.length && n < tope) {
    const p = cola[0];
    let w = p.w, d = p.d, rot = 0;
    if (w > (x1 - x0) && d <= (x1 - x0)) { [w, d] = [d, w]; rot = 90; }
    if (w > (x1 - x0) || d > (y1 - y0)) break;
    if (x + w > x1 + 1) { x = x0; y += rowH + rowGap; rowH = 0; }
    if (y + d > y1 + 1) break;
    out.push({ id: p.id, x, y, rot });
    x += w + gap; rowH = Math.max(rowH, d); n++;
    cola.shift();
  }
  return { out, bottom: y + rowH };
}

function guardasAMuro(cola, W, out, { desde = PERIM } = {}) {
  if (!cola.length) return 0;
  let x = desde, maxD = 0;
  while (cola.length) {
    const p = cola[0];
    let w = p.w, d = p.d, rot = 0;
    if (x + w > W - PERIM + 1) break;
    out.push({ id: p.id, x, y: WALL, rot });
    x += w + GAP; maxD = Math.max(maxD, d);
    cola.shift();
  }
  return maxD ? WALL + maxD : 0;
}

function empacarTodoGarantizado(base, piezas, ajustar) {
  const CIRC = regla('circulacion_min') ?? 900;
  const PER = CIRC, GX = CIRC;
  const rowGap = (t) => (t === 'escritorio' ? 1100 : t === 'juntas' ? 1200 : t === 'asiento' ? 850 : 700);
  const ordenBase = ['guarda', 'juntas', 'recepcion', 'escritorio', 'mesa', 'asiento', 'mampara', 'mueble'];
  const extras = [...new Set(piezas.map((p) => p?.tipo || 'mueble'))].filter((t) => !ordenBase.includes(t));
  const orden = [...ordenBase, ...extras];
  const grupos = orden
    .map((t) => piezas.filter((p) => (p?.tipo || 'mueble') === t).sort((a, b) => (b.w * b.d) - (a.w * a.d)))
    .filter((g) => g.length);

  const minDimMax = piezas.reduce((m, p) => Math.max(m, Math.min(p.w, p.d)), 0);
  let W = Math.max(base.ancho || 0, minDimMax + 2 * PER, 6000);
  const out = [];
  let x = PER, y = PER, rowH = 0, lastT = null;
  let minEntreFilas = Infinity;
  for (const g of grupos) {
    for (const p of g) {
      let w = p.w, d = p.d, rot = 0;
      if (w > W - 2 * PER && d <= W - 2 * PER) { [w, d] = [d, w]; rot = 90; }
      const cambioTipo = lastT && lastT !== p.tipo && x > PER;
      if (cambioTipo || (x > PER && x + w > W - PER)) {
        const gap = rowGap(p.tipo);
        minEntreFilas = Math.min(minEntreFilas, gap);
        x = PER; y += rowH + gap; rowH = 0;
      }
      out.push({ id: p.id, x, y, rot });
      x += w + GX; rowH = Math.max(rowH, d); lastT = p.tipo;
    }
  }
  const fondo = y + rowH + PER;
  let L = base.largo || 0;
  if (ajustar) L = Math.max(L, fondo);
  return { out, W: Math.round(W), L: Math.round(L), minEntreFilas };
}

export function sentarSillas(colocacion, piezas, areas) {
  const byId = Object.fromEntries(piezas.map((p) => [p.id, p]));
  const yaPuesta = new Set(colocacion.map((c) => c.id));
  const sinLugar = piezas.filter((p) => !yaPuesta.has(p.id) && esSillaOperativa(p));
  const huella = (c) => {
    const p = byId[c.id]; if (!p) return null;
    const { pw, ph } = dimsPieza(p, c.rot || 0);
    return { x: c.x, y: c.y, w: pw, d: ph };
  };
  const choca = (a, b, h = 0) => (
    a.x < b.x + b.w + h && a.x + a.w + h > b.x && a.y < b.y + b.d + h && a.y + a.d + h > b.y
  );
  const out = colocacion.map((c) => ({ ...c }));

  for (let i = 0; i < areas.length; i++) {
    const A = areas[i]; if (!A) continue;
    const enArea = out.filter((c) => c.area === i);
    const sillas = enArea.filter((c) => !c.manual && (esSillaOperativa(byId[c.id]) || esSillaDirectiva(byId[c.id])));
    if (!sillas.length && !sinLugar.length) continue;
    const escritorios = enArea
      .filter((c) => byId[c.id]?.tipo === 'escritorio')
      .map((c) => ({ c, h: huella(c) })).filter((e) => e.h);
    if (!escritorios.length) continue;

    const fijas = enArea.filter((c) => !sillas.includes(c)).map(huella).filter(Boolean);
    const puestas = [];
    const libres = [...sillas];
    for (const { c, h } of escritorios) {
      const s0 = byId[libres[0]?.id] || sinLugar[0];
      if (!s0) break;
      const { pw, ph } = dimsPieza(s0, 0);
      for (const s of puestosDe(c, h, pw, ph, byId[c.id]?.nombre)) {
        if (!libres.length && !sinLugar.length) break;
        const caja = { x: s.x, y: s.y, w: pw, d: ph };
        const dentro = caja.x >= 0 && caja.y >= 0
          && caja.x + caja.w <= (A.ancho || 0) && caja.y + caja.d <= (A.largo || 0);
        if (!dentro) continue;
        if (fijas.some((v) => choca(caja, v, 0))) continue;
        if (puestas.some((v) => choca(caja, v, 40))) continue;
        if (libres.length) {
          let idx = libres.findIndex((cc) => { const d = dimsPieza(byId[cc.id], 0); return d.pw === pw && d.ph === ph; });
          if (idx === -1) idx = 0;
          const silla = libres.splice(idx, 1)[0];
          silla.x = caja.x; silla.y = caja.y; silla.rot = 0;
          silla.contra = `escritorio:${c.id}`;
          silla.anchor_id = c.id;
        } else {
          let idx = sinLugar.findIndex((cc) => { const d = dimsPieza(cc, 0); return d.pw === pw && d.ph === ph; });
          if (idx === -1) idx = 0;
          const nueva = sinLugar.splice(idx, 1)[0];
          out.push({
            id: nueva.id, area: i, x: caja.x, y: caja.y, rot: 0,
            contra: `escritorio:${c.id}`, anchor_id: c.id,
          });
        }
        puestas.push(caja);
      }
      if (!libres.length && !sinLugar.length) break;
    }
  }
  return out;
}

export function acomodarLocal(areas, piezas, opts = {}) {
  const r = acomodarLocalBase(areas, piezas, opts);
  const colocacion = sentarSillas(r.colocacion, piezas, r.areas || areas);
  if (colocacion.length === r.colocacion.length) return { ...r, colocacion };
  const caben = colocacion.length === piezas.length;
  return {
    ...r, colocacion, caben,
    auditoria: (r.auditoria || []).map((a) => (a.check === 'Todas las piezas colocadas'
      ? { ...a, ok: caben, detalle: `${colocacion.length} de ${piezas.length}` } : a)),
    notas: [
      ...(r.notas || []).filter((n) => !/no caben en el plano/i.test(n)),
      ...(caben ? [] : [`${piezas.length - colocacion.length} pieza(s) no caben en el plano. Quita muebles o usa otra área.`]),
    ],
    resumen: caben
      ? `Los ${piezas.length} muebles quedan acomodados, con cada silla en su puesto.`
      : `Caben ${colocacion.length} de ${piezas.length}.`,
  };
}

function acomodarLocalBase(areas, piezas, opts = {}) {
  if (areas.some((a) => (a.poly && a.poly.length >= 3) || (a.obstaculos && a.obstaculos.length))) {
    return acomodarPorCuartos(areas, piezas);
  }

  if (opts.ajustar && areas.length <= 1) {
    const base = areas[0] || { nombre: 'Mi espacio', ancho: 8000, largo: 6000 };
    const { out, W, L, minEntreFilas } = empacarTodoGarantizado(base, piezas, true);
    const nuevasAreas = [{ nombre: base.nombre || 'Mi espacio', ancho: W, largo: L, ...(base.puertas ? { puertas: base.puertas } : {}) }];
    const colocacion = enderezarTodo(
      out.map((o) => ({ id: o.id, area: 0, x: o.x, y: o.y, rot: o.rot })),
      Object.fromEntries(piezas.map((p) => [p.id, p])), nuevasAreas,
    );
    const todas = colocacion.length === piezas.length;
    const circulacion = regla('circulacion_min') ?? 900;
    const auditoria = [
      { check: 'Todas las piezas colocadas', ok: todas, detalle: `${colocacion.length} de ${piezas.length}` },
      { check: 'Nada encimado', ok: true, detalle: 'el motor coloca una por una sin traslape' },
      { check: 'Circulación perimetral', ok: true,
        detalle: `${(circulacion / 1000).toFixed(2)} m contra muros (la regla pide ${(circulacion / 1000).toFixed(2)} m)` },
      (minEntreFilas === Infinity || minEntreFilas >= circulacion)
        ? { check: 'Circulación entre filas', ok: true,
            detalle: `${(circulacion / 1000).toFixed(2)} m entre muebles (la regla pide ${(circulacion / 1000).toFixed(2)} m)` }
        : { check: 'Circulación entre filas', ok: false,
            detalle: `${(minEntreFilas / 1000).toFixed(2)} m entre muebles: por debajo de los ${(circulacion / 1000).toFixed(2)} m que pide la regla` },
    ];
    return { colocacion, zonas: [], caben: todas, areas: nuevasAreas, notas: todas ? [] : [`${piezas.length - colocacion.length} pieza(s) no caben en el plano.`], auditoria,
      resumen: todas
        ? `Los ${piezas.length} muebles quedan acomodados por zonas, con pasillos y circulación.`
        : `Se acomodaron ${colocacion.length} de ${piezas.length} muebles. Los demás no cupieron.` };
  }

  return acomodarPorCuartos(areas, piezas);
}

const PREFERENCIA = {
  juntas:     ['juntas', 'general', 'lounge'],
  escritorio: ['privado', 'open', 'general', 'lounge'],
  bench:      ['open', 'general', 'privado'],
  guarda:     ['open', 'general', 'privado'],
  credenza:   ['privado', 'general', 'open'],
  mampara:    ['open', 'general', 'privado'],
  recepcion:  ['recepcion', 'general'],
  silla:      ['open', 'general', 'privado', 'juntas', 'recepcion', 'lounge'],
  visita:     ['privado', 'juntas', 'recepcion', 'general', 'open', 'lounge'],
  directiva:  ['privado', 'general', 'juntas', 'open'],
  juntasSilla: ['juntas', 'general', 'privado', 'open', 'lounge'],
  asiento:    ['lounge', 'recepcion', 'general', 'open'],
  mesa:       ['lounge', 'recepcion', 'general', 'open'],
  mueble:     ['general', 'open', 'lounge', 'recepcion'],
};
const ORDEN_TIPOS = ['juntas', 'recepcion', 'escritorio', 'guarda', 'mampara', 'asiento', 'mesa', 'mueble'];

const esBench = (p) => p.tipo === 'escritorio' && Math.max(p.w, p.d) >= 2500;
const LOUNGE = /sill[oó]n|sof[aá]|puff|pouf|banqueta|\bbanco\b|otomana|love\s?seat/i;
export const esSillaDeTrabajo = (p) => (
  p?.tipo === 'asiento' && /\bsillas?\b/i.test(p.nombre || '') && !LOUNGE.test(p.nombre || '')
);
export const esSillaDeVisita = (p) => esSillaDeTrabajo(p) && /visita|espera|confidente/i.test(p.nombre || '');
export const esSillaDirectiva = (p) => esSillaDeTrabajo(p) && /directiv|ejecutiv|presiden|gerencial/i.test(p.nombre || '');
export const esSillaDeJuntas = (p) => esSillaDeTrabajo(p)
  && (/junta|consejo|board/i.test(p.nombre || '') || destinoMarcado(p) === 'juntas');
export const esSillaOperativa = (p) => esSillaDeTrabajo(p)
  && destinoMarcado(p) !== 'juntas' && destinoMarcado(p) !== 'recepcion'
  && !esSillaDeVisita(p) && !esSillaDirectiva(p) && !esSillaDeJuntas(p);

const cabeEn = (p, a) => {
  const holgura = 400;
  const entra = (w, d, hw, hd) => w + hw <= a.ancho && d + hd <= a.largo;
  if (entra(p.w, p.d, holgura, holgura) || entra(p.d, p.w, holgura, holgura)) return true;
  const largo = Math.max(p.w, p.d), corto = Math.min(p.w, p.d);
  return entra(largo, corto, 0, holgura) || entra(corto, largo, holgura, 0);
};

function rolCuarto(a, todos) {
  if (a.contiene > 0) {
    const zonas = todos.filter((x) => x !== a && x.dentroDe === a.nombre
      && rolCuartoBase(x, todos) === 'open');
    if (zonas.length) return 'servicio';
  }
  return rolCuartoBase(a, todos);
}

export function tipoAreaConfiable(a = {}) {
  if (!a.tipo) return false;
  const proc = String(a.procedencia || a.source || '').toUpperCase();
  const conf = String(a.confianza || a.confidence || '').toLowerCase();
  const debil = /INFERRED|ASSUMED|SUGGEST|ESTIMAD|AI_/.test(proc)
    || ['baja', 'low'].includes(conf);
  return !debil;
}

export function rolCuartoBase(a, todos) {
  if (tipoAreaConfiable(a)) return a.tipo;
  const porNombre = rolArea(a.nombre);
  if (porNombre !== 'general') return porNombre;
  const m2 = (a.ancho * a.largo) / 1e6;
  if (m2 <= 6) return 'servicio';
  const mayor = Math.max(...todos.map((x) => (x.ancho * x.largo) / 1e6));
  if (m2 >= mayor * 0.8) return 'open';
  if (m2 <= 16) return 'privado';
  return 'juntas';
}

const grupoFuente = (p) => String(p?.id || '').replace(/-\d+$/, '');

function capacidadMesa(p) {
  const s = String(p?.nombre || '').toLowerCase();
  const explicita = /(\d+)\s*(?:personas?|pax|usuarios?|lugares?)/i.exec(s);
  if (explicita) return Math.max(2, +explicita[1]);
  const largo = Math.max(Number(p?.w) || 0, Number(p?.d) || 0);
  if (/app\s*lt/i.test(s) && largo >= 2200) return 8;
  if (/cirque/i.test(s)) return 6; // dos módulos de 2400/1800 => 12 lugares
  if (largo >= 3600) return 12;
  if (largo >= 3000) return 10;
  if (largo >= 2200) return 8;
  if (largo >= 1600) return 6;
  return 4;
}

function acomodarPorCuartos(areas, piezas) {
  const cuartos = areas.map((a, i) => {
    const rol = rolCuarto(a, areas);
    return {
      i, a, rol, m2: (a.ancho * a.largo) / 1e6,
      servicio: rol === 'servicio',
      asignadas: [], libre: (a.ancho * a.largo) / 1e6,
    };
  });
  const utiles = cuartos.filter((c) => !c.servicio);
  const sobran = [];
  const destinoGrupoJunta = new Map();
  const hayEscritorios = piezas.some((q) => q.tipo === 'escritorio');
  const sinCuartoPropio = (p) => hayEscritorios && esSillaOperativa(p) && !destinoMarcado(p);
  const capacidadJuntas = (c) => c.asignadas.filter((q) => q.tipo === 'juntas').reduce((s, q) => s + capacidadMesa(q), 0);
  const sillasJuntasAsignadas = (c) => c.asignadas.filter((q) => q.tipo === 'asiento' && esSillaDeJuntas(q)).length;

  for (const tipo of ORDEN_TIPOS) {
    const lote = piezas.filter((p) => (p.tipo || 'mueble') === tipo).sort((a, b) => (b.w * b.d) - (a.w * a.d));
    if (!lote.length) continue;
    const ordenar = (orden, preferirConEscritorios, repartirEnPrivados) => [...utiles].sort((x, y) => {
      if (repartirEnPrivados && x.rol === y.rol) {
        const cuenta = (c) => c.asignadas.filter((q) => q.tipo === tipo).length;
        const nx = cuenta(x), ny = cuenta(y);
        if (nx !== ny) return nx - ny;
      }
      if (preferirConEscritorios) {
        const ex = x.asignadas.filter((q) => q.tipo === 'escritorio').length;
        const ey = y.asignadas.filter((q) => q.tipo === 'escritorio').length;
        if (ex !== ey) return ey - ex;
      }
      if (Number.isFinite(x.a.nivel) && Number.isFinite(y.a.nivel) && x.libre !== y.libre) return y.libre - x.libre;
      const px = orden.indexOf(x.rol), py = orden.indexOf(y.rol);
      const rx = px === -1 ? 99 : px, ry = py === -1 ? 99 : py;
      return rx !== ry ? rx - ry : y.m2 - x.m2;
    });

    for (const p of lote) {
      const silla = tipo === 'asiento' && esSillaDeTrabajo(p);
      const visita = silla && esSillaDeVisita(p);
      if (sinCuartoPropio(p)) { sobran.push(p); continue; }
      const credenza = tipo === 'guarda' && /credenza|lateral|bajo\b/i.test(p.nombre || '');
      const destino = destinoMarcado(p);
      let orden = tipo === 'escritorio' && esBench(p) ? PREFERENCIA.bench
        : silla ? (visita ? PREFERENCIA.visita
          : esSillaDirectiva(p) ? PREFERENCIA.directiva
            : esSillaDeJuntas(p) ? PREFERENCIA.juntasSilla : PREFERENCIA.silla)
          : credenza ? PREFERENCIA.credenza
            : (PREFERENCIA[tipo] || PREFERENCIA.mueble);
      if (destino) orden = [destino, ...orden.filter((r) => r !== destino)];

      let candidatos = ordenar(orden, (tipo === 'guarda' && !credenza) || (silla && !visita),
        tipo === 'escritorio' || tipo === 'juntas' || visita || credenza
        || esSillaDirectiva(p) || esSillaDeJuntas(p));

      // Dos módulos de una misma mesa (p.ej. Cirque 2×2400) deben ir JUNTOS en
      // una sala, no uno en cada sala sólo porque el reparto "equilibró" piezas.
      if (tipo === 'juntas') {
        const fijado = destinoGrupoJunta.get(grupoFuente(p));
        if (Number.isInteger(fijado)) candidatos = [...candidatos].sort((a, b) => (a.i === fijado ? -1 : b.i === fijado ? 1 : 0));
      }

      // Las sillas de junta se reparten por CAPACIDAD de las mesas ya asignadas,
      // no 10/10 por simple balance. Caso CEO: APP LT=8, 2 módulos Cirque=12.
      if (silla && esSillaDeJuntas(p)) {
        candidatos = [...candidatos].sort((a, b) => {
          const am = a.rol === 'juntas' ? 1 : 0, bm = b.rol === 'juntas' ? 1 : 0;
          if (am !== bm) return bm - am;
          if (am) {
            const ra = capacidadJuntas(a) - sillasJuntasAsignadas(a);
            const rb = capacidadJuntas(b) - sillasJuntasAsignadas(b);
            if (ra !== rb) return rb - ra;
          }
          return 0;
        });
      }

      // Si Voni ya dijo a qué TIPO de espacio pertenece, no lo dejamos escapar
      // a otro tipo sólo porque ahí había más metros libres. Si ese tipo no existe,
      // sí cae al orden heurístico como fallback seguro.
      const exactos = destino ? candidatos.filter((c) => c.rol === destino) : [];
      const pool = exactos.length ? exactos : candidatos;
      const dest = pool.find((c) => zonaAceptaPieza(p, c.a) && cabeEn(p, c.a) && c.libre > (p.w * p.d) / 1e6 * 1.35);
      if (dest) {
        dest.asignadas.push(p);
        dest.libre -= (p.w * p.d) / 1e6 * 1.35;
        if (tipo === 'juntas') destinoGrupoJunta.set(grupoFuente(p), dest.i);
      } else sobran.push(p);
    }
  }

  const colocacion = [], auditoria = [], notas = [];
  let restantes = [...sobran];
  for (const c of cuartos) {
    if (c.servicio || !c.asignadas.length) continue;
    const r = acomodarEnForma(c.a, c.asignadas);
    for (const k of r.colocacion) colocacion.push({ ...k, area: c.i });
    const puestas = new Set(r.colocacion.map((k) => k.id));
    restantes.push(...c.asignadas.filter((p) => !puestas.has(p.id)));
  }

  if (restantes.length) {
    for (const c of utiles) {
      if (!restantes.length) break;
      const yaPuestas = colocacion.filter((k) => k.area === c.i).map((k) => k.id);
      const ocupadas = c.asignadas.filter((p) => yaPuestas.includes(p.id));
      const permite = (p) => {
        if (!zonaAceptaPieza(p, c.a)) return false;
        const destino = destinoMarcado(p);
        if (destino && utiles.some((u) => u.rol === destino) && c.rol !== destino) return false;
        const pref = p.tipo === 'escritorio' && esBench(p) ? PREFERENCIA.bench
          : (PREFERENCIA[p.tipo] || PREFERENCIA.mueble);
        return destino ? c.rol === destino || pref.includes(c.rol) : pref.includes(c.rol);
      };
      let cupoGuarda = ocupadas.filter((p) => p.tipo === 'escritorio').length
        - ocupadas.filter((p) => p.tipo === 'guarda').length;
      const nuevas = restantes.filter((p) => !sinCuartoPropio(p) && permite(p) && cabeEn(p, c.a))
        .filter((p) => {
          if (p.tipo !== 'guarda') return true;
          if (destinoMarcado(p) === 'privado') return true;
          if (cupoGuarda <= 0) return false;
          cupoGuarda -= 1; return true;
        });
      const intento = [...ocupadas, ...nuevas];
      if (intento.length === ocupadas.length) continue;
      const r = acomodarEnForma(c.a, intento);
      const puestas = new Set(r.colocacion.map((k) => k.id));
      for (let k = colocacion.length - 1; k >= 0; k--) if (colocacion[k].area === c.i) colocacion.splice(k, 1);
      for (const k of r.colocacion) colocacion.push({ ...k, area: c.i });
      restantes = restantes.filter((p) => !puestas.has(p.id));
    }
  }

  const caben = restantes.length === 0;
  const porCuarto = cuartos
    .filter((c) => colocacion.some((k) => k.area === c.i))
    .map((c) => `${c.a.nombre || 'Área ' + (c.i + 1)}: ${resumenTipos(c.asignadas.filter((p) => colocacion.some((k) => k.id === p.id)))}`);

  auditoria.push({ check: 'Todas las piezas colocadas', ok: caben, detalle: `${colocacion.length} de ${piezas.length}` });
  auditoria.push({ check: 'Cada mueble dentro de su cuarto', ok: true, detalle: 'la malla sólo ocupa celdas del área' });
  auditoria.push({ check: 'Nada encimado', ok: true, detalle: 'la malla no reutiliza celdas' });
  auditoria.push({ check: 'Baños y servicios sin amueblar', ok: true, detalle: `${cuartos.filter((c) => c.servicio).length} cuarto(s) de servicio respetados` });
  auditoria.push({ check: 'Reparto por criterio', ok: true, detalle: porCuarto.join(' · ') || 'sin reparto' });
  if (!caben) notas.push(`${restantes.length} pieza(s) no caben en el plano. Quita muebles o usa otra área.`);

  return {
    colocacion, zonas: [], caben, areas, notas, auditoria,
    resumen: caben
      ? `Los ${piezas.length} muebles quedan repartidos por cuarto: ${porCuarto.join(' · ')}.`
      : `Caben ${colocacion.length} de ${piezas.length}. ${porCuarto.join(' · ')}.`,
  };
}

function resumenTipos(arr) {
  const c = {};
  for (const p of arr) c[p.tipo || 'mueble'] = (c[p.tipo || 'mueble'] || 0) + 1;
  const et = { escritorio: 'estaciones', guarda: 'guardas', juntas: 'mesas de juntas', asiento: 'asientos', mesa: 'mesas', mampara: 'mamparas', mueble: 'muebles' };
  return Object.entries(c).map(([k, v]) => `${v} ${et[k] || k}`).join(', ');
}
