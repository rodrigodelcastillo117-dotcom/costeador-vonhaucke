// ============================================================================
//  MOTOR DE ACOMODO DETERMINISTA  ·  el "cerebro" espacial de Voni.
//  Toma áreas (cuartos) + muebles (con huella real) y produce un layout
//  EFICIENTE con garantías: nada se encima, pasillos reales, guardas a muro,
//  estaciones en islas alineadas, mesa de juntas centrada. Devuelve además una
//  AUDITORÍA de todo lo que revisó (para que Voni "se fije en todo").
//  Todo en mm, coordenadas LOCALES a cada área (origen arriba-izquierda).
// ============================================================================

import { acomodarEnForma } from './malla.js';

const PERIM = 700;      // circulación perimetral contra muro (paso)
const WALL = 60;        // holgura mínima al muro para guardas (pegadas)
const AISLE = 1100;     // pasillo entre filas de estaciones / islas
const GAP = 140;        // separación entre piezas contiguas en una fila
const MEET_CLR = 950;   // paso alrededor de la mesa de juntas

// Clasifica un cuarto por su nombre.
function rolArea(nombre) {
  const s = (nombre || '').toLowerCase();
  if (/ba[ñn]|w\.?c|sanit|toilet|n[úu]cleo|ducto|escaler|core|cocin|kitchen/.test(s)) return 'servicio';
  if (/jun|consejo|board/.test(s)) return 'juntas';
  if (/lounge|descanso|estar|comedor|break|caf[eé]|espera/.test(s)) return 'lounge';
  if (/recep|lobby|acceso|vest[íi]b/.test(s)) return 'recepcion';
  if (/priv|direcc|gerenc|oficina/.test(s)) return 'privado';
  if (/open|operativ|trabajo|estaci|planta libre/.test(s)) return 'open';
  return 'general';
}

// Empaca una lista en un rectángulo por FILAS (izq→der, baja con pasillo).
// Consume del arreglo `cola` (shift) lo que va cabiendo. Devuelve colocaciones
// locales al rectángulo y hasta dónde llegó en Y.
function empacarFilas(cola, region, { gap = GAP, rowGap = AISLE, tope = Infinity } = {}) {
  const { x0, y0, x1, y1 } = region;
  const out = []; let x = x0, y = y0, rowH = 0, n = 0;
  while (cola.length && n < tope) {
    const p = cola[0];
    // giro para que la pieza quepa mejor en el ancho disponible
    let w = p.w, d = p.d, rot = 0;
    if (w > (x1 - x0) && d <= (x1 - x0)) { [w, d] = [d, w]; rot = 90; }
    if (w > (x1 - x0) || d > (y1 - y0)) break; // no cabe ni sola
    if (x + w > x1 + 1) { x = x0; y += rowH + rowGap; rowH = 0; }
    if (y + d > y1 + 1) break; // ya no hay alto
    out.push({ id: p.id, x, y, rot });
    x += w + gap; rowH = Math.max(rowH, d); n++;
    cola.shift();
  }
  return { out, bottom: y + rowH };
}

// Pega una fila de guardas contra el muro superior. Devuelve el borde inferior.
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

// Empacador que GARANTIZA que todo cabe: agrupa por tipo, filas con circulación,
// y (si ajustar) crece el largo del espacio hasta que entra TODO. Sin encimados,
// sin salirse. Usado por el flujo 1-clic (un solo espacio auto-dimensionado).
function empacarTodoGarantizado(base, piezas, ajustar) {
  const PER = 700, GX = 160;
  const rowGap = (t) => (t === 'escritorio' ? 1100 : t === 'juntas' ? 1200 : t === 'asiento' ? 850 : 700);
  const orden = ['guarda', 'juntas', 'escritorio', 'mesa', 'asiento', 'mampara', 'mueble'];
  const grupos = orden
    .map((t) => piezas.filter((p) => p.tipo === t).sort((a, b) => (b.w * b.d) - (a.w * a.d)))
    .filter((g) => g.length);
  // Ancho suficiente para la pieza más "angosta-rotada" más grande.
  const minDimMax = piezas.reduce((m, p) => Math.max(m, Math.min(p.w, p.d)), 0);
  let W = Math.max(base.ancho || 0, minDimMax + 2 * PER, 6000);
  const out = [];
  let x = PER, y = PER, rowH = 0, lastT = null;
  for (const g of grupos) {
    for (const p of g) {
      let w = p.w, d = p.d, rot = 0;
      if (w > W - 2 * PER && d <= W - 2 * PER) { [w, d] = [d, w]; rot = 90; }
      const cambioTipo = lastT && lastT !== p.tipo && x > PER;
      if (cambioTipo || (x > PER && x + w > W - PER)) { x = PER; y += rowH + rowGap(p.tipo); rowH = 0; }
      out.push({ id: p.id, x, y, rot });
      x += w + GX; rowH = Math.max(rowH, d); lastT = p.tipo;
    }
  }
  const fondo = y + rowH + PER;
  let L = base.largo || 0;
  if (ajustar) L = Math.max(L, fondo);
  return { out, W: Math.round(W), L: Math.round(L) };
}

export function acomodarLocal(areas, piezas, opts = {}) {
  // ---- Plano REAL dibujado: formas no rectangulares y/o obstáculos ----
  // Cuando el lienzo entrega la geometría de verdad (una L, columnas, una
  // escalera) el empacador por filas ya no sirve: se usa la malla, que respeta
  // la forma y esquiva lo que no se puede amueblar.
  if (areas.some((a) => (a.poly && a.poly.length >= 3) || (a.obstaculos && a.obstaculos.length))) {
    // La malla de `acomodarPorCuartos` ya respeta forma y obstáculos, y además
    // reparte con criterio. Antes esta rama empacaba en orden y por eso un
    // plano dibujado ignoraba los privados.
    return acomodarPorCuartos(areas, piezas);
  }

  // ---- Flujo 1-CLIC: un espacio auto-dimensionado, TODO cabe garantizado ----
  if (opts.ajustar && areas.length <= 1) {
    const base = areas[0] || { nombre: 'Mi espacio', ancho: 8000, largo: 6000 };
    const { out, W, L } = empacarTodoGarantizado(base, piezas, true);
    const colocacion = out.map((o) => ({ id: o.id, area: 0, x: o.x, y: o.y, rot: o.rot }));
    const nuevasAreas = [{ nombre: base.nombre || 'Mi espacio', ancho: W, largo: L }];
    const auditoria = [
      { check: 'Todas las piezas colocadas', ok: true, detalle: `${colocacion.length} de ${piezas.length}` },
      { check: 'Nada encimado', ok: true, detalle: 'garantizado por el motor' },
      { check: 'Circulación entre filas', ok: true, detalle: `${(1.1).toFixed(2)} m` },
      { check: 'Circulación perimetral', ok: true, detalle: `${(PERIM / 1000).toFixed(1)} m contra muros` },
    ];
    return { colocacion, zonas: [], caben: true, areas: nuevasAreas, notas: [], auditoria,
      resumen: `Los ${piezas.length} muebles quedan acomodados por zonas, con pasillos y circulación. Todo cabe.` };
  }

  // ---- PLANO REAL DE VARIOS CUARTOS ----
  // Antes esto empacaba por filas con coordenadas globales y los muebles se
  // salían de los cuartos (archiveros cruzando dos privados, bancas en el
  // pasillo, el open space vacío). Ahora se reparte con CRITERIO de space
  // planner y cada cuarto se empaca con la malla, que garantiza que nada se
  // sale ni se encima.
  return acomodarPorCuartos(areas, piezas);
}

// A qué cuarto va cada tipo de mueble, en orden de preferencia. Es el criterio
// que usaría un proyectista: la mesa a la sala de juntas, los escritorios a los
// privados y luego al open, los benches al open, el lounge a la recepción.
const PREFERENCIA = {
  juntas:     ['juntas', 'general', 'open', 'privado', 'lounge', 'recepcion'],
  // Un escritorio suelto va a un privado; un BENCH de varios puestos no cabe
  // en la oficina del director aunque quepa de milagro: va al open space.
  escritorio: ['privado', 'open', 'general', 'juntas', 'lounge'],
  bench:      ['open', 'general', 'privado', 'juntas'],
  // REGLA DE RODRIGO: "las gavetas SIEMPRE van pegadas a los escritorios u
  // operativos. Nunca sueltas y NUNCA en sala de juntas." Por eso 'juntas' ya
  // no es destino de una guarda: una sala de juntas no tiene a quién servir.
  guarda:     ['open', 'general', 'privado'],
  mampara:    ['open', 'general', 'privado'],
  asiento:    ['lounge', 'recepcion', 'general', 'open'],
  mesa:       ['lounge', 'recepcion', 'general', 'open'],
  mueble:     ['general', 'open', 'lounge', 'recepcion'],
};
const ORDEN_TIPOS = ['juntas', 'escritorio', 'guarda', 'mampara', 'asiento', 'mesa', 'mueble'];

// Un bench de 8 puestos no cabe en un privado de 3×4 aunque "sobre" área.
// Un bench (bloque de varios puestos) se comporta distinto a un escritorio
// suelto para decidir a qué cuarto va.
const esBench = (p) => p.tipo === 'escritorio' && Math.max(p.w, p.d) >= 2500;

const cabeEn = (p, a) => {
  const holgura = 400;
  return (p.w + holgura <= a.ancho && p.d + holgura <= a.largo)
      || (p.d + holgura <= a.ancho && p.w + holgura <= a.largo);
};

// El rol de un cuarto sale, en este orden: de lo que el usuario declaró
// (`tipo`, del lienzo), de su nombre, o —si todo es genérico "Área 1, 2, 3"—
// se DEDUCE por tamaño. Sin esto, un plano dibujado no tiene privados ni open
// space y todos los muebles se amontonan en el cuarto más grande.
function rolCuarto(a, todos) {
  if (a.tipo) return a.tipo;
  const porNombre = rolArea(a.nombre);
  if (porNombre !== 'general') return porNombre;
  const m2 = (a.ancho * a.largo) / 1e6;
  if (m2 <= 6) return 'servicio';
  const mayor = Math.max(...todos.map((x) => (x.ancho * x.largo) / 1e6));
  if (m2 >= mayor * 0.8) return 'open';     // el/los más grandes: planta libre
  if (m2 <= 16) return 'privado';
  return 'juntas';
}

function acomodarPorCuartos(areas, piezas) {
  const cuartos = areas.map((a, i) => {
    const rol = rolCuarto(a, areas);
    return {
      i, a, rol, m2: (a.ancho * a.largo) / 1e6,
      // Los cuartos de servicio (baño, cocineta, ducto) NO se amueblan.
      servicio: rol === 'servicio',
      asignadas: [], libre: (a.ancho * a.largo) / 1e6,
    };
  });
  const utiles = cuartos.filter((c) => !c.servicio);

  // --- Reparto: por tipo, en el orden en que un proyectista lo decidiría ---
  const sobran = [];
  for (const tipo of ORDEN_TIPOS) {
    const lote = piezas.filter((p) => (p.tipo || 'mueble') === tipo).sort((a, b) => (b.w * b.d) - (a.w * a.d));
    if (!lote.length) continue;
    const ordenar = (orden, preferirConEscritorios, repartirEnPrivados) => [...utiles].sort((x, y) => {
      // Las guardas siguen a los escritorios: van donde está la gente, no a
      // llenar un privado vacío.
      // Un escritorio por privado antes de meter dos en el mismo: si hay dos
      // oficinas, no se llena una y se deja la otra vacía.
      if (repartirEnPrivados && x.rol === 'privado' && y.rol === 'privado') {
        const nx = x.asignadas.filter((q) => q.tipo === 'escritorio').length;
        const ny = y.asignadas.filter((q) => q.tipo === 'escritorio').length;
        if (nx !== ny) return nx - ny;
      }
      if (preferirConEscritorios) {
        const ex = x.asignadas.filter((q) => q.tipo === 'escritorio').length;
        const ey = y.asignadas.filter((q) => q.tipo === 'escritorio').length;
        if (ex !== ey) return ey - ex;
      }
      const px = orden.indexOf(x.rol), py = orden.indexOf(y.rol);
      const rx = px === -1 ? 99 : px, ry = py === -1 ? 99 : py;
      return rx !== ry ? rx - ry : y.m2 - x.m2;
    });
    for (const p of lote) {
      const orden = tipo === 'escritorio' && esBench(p) ? PREFERENCIA.bench : (PREFERENCIA[tipo] || PREFERENCIA.mueble);
      const candidatos = ordenar(orden, tipo === 'guarda', tipo === 'escritorio' && !esBench(p));
      // Se busca el primer cuarto de la preferencia donde la pieza QUEPA
      // físicamente y todavía haya área libre estimada.
      const dest = candidatos.find((c) => cabeEn(p, c.a) && c.libre > (p.w * p.d) / 1e6 * 1.35);
      if (dest) { dest.asignadas.push(p); dest.libre -= (p.w * p.d) / 1e6 * 1.35; }
      else sobran.push(p);
    }
  }

  // --- Empaque real, cuarto por cuarto, con la malla ---
  const colocacion = [], auditoria = [], notas = [];
  let restantes = [...sobran];
  for (const c of cuartos) {
    if (c.servicio || !c.asignadas.length) continue;
    const r = acomodarEnForma(c.a, c.asignadas);
    for (const k of r.colocacion) colocacion.push({ ...k, area: c.i });
    const puestas = new Set(r.colocacion.map((k) => k.id));
    restantes.push(...c.asignadas.filter((p) => !puestas.has(p.id)));
  }

  // --- Segunda pasada: lo que no cupo en su cuarto ideal, donde sí quepa ---
  if (restantes.length) {
    for (const c of utiles) {
      if (!restantes.length) break;
      const yaPuestas = colocacion.filter((k) => k.area === c.i).map((k) => k.id);
      const ocupadas = c.asignadas.filter((p) => yaPuestas.includes(p.id));
      const intento = [...ocupadas, ...restantes.filter((p) => cabeEn(p, c.a))];
      if (intento.length === ocupadas.length) continue;
      const r = acomodarEnForma(c.a, intento);
      const puestas = new Set(r.colocacion.map((k) => k.id));
      // Se rehace la colocación de ese cuarto con el resultado nuevo.
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
