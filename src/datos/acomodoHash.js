// ============================================================================
//  P0.2 · HASHES DE ESTABILIDAD DEL ACOMODO (program_hash + floor_hash).
//
//  Dos verdades independientes para detectar "stale" de forma determinista
//  (no por conteo de piezas, que no ve ediciones que conservan la cantidad):
//    - program_hash: QUÉ hay que acomodar (las partidas CONFIRMADas y su
//      geometría/semántica relevante al layout). Ignora precio/costo/notas.
//    - floor_hash:   DÓNDE se acomoda (el FloorSpec: áreas, muros vía polígono,
//      obstáculos, puertas, niveles). Conserva el ORDEN de áreas (el índice de
//      área es identidad en PlacementSpec).
//
//  Regla: si NINGUNO cambió respecto al plan guardado, el repair-loop NO debe
//  pisar lo que el humano movió a mano (precedencia de manual placement, P0.2).
//  Si CUALQUIERA cambió, el plan guardado queda STALE y se recalcula.
// ============================================================================

// Serialización ESTABLE: claves ordenadas, arreglos en orden, sin espacios.
// Determinista entre corridas y navegadores (no depende del orden de inserción).
export function serializarEstable(valor) {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : 'null';
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  if (typeof valor === 'string') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(serializarEstable).join(',')}]`;
  const claves = Object.keys(valor).filter((k) => valor[k] !== undefined).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${serializarEstable(valor[k])}`).join(',')}}`;
}

// djb2 → base36 (corto, estable, sin dependencias). No es criptográfico: sólo
// detecta cambios, no protege contra manipulación.
export function hashEstable(valor) {
  const s = typeof valor === 'string' ? valor : serializarEstable(valor);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const mm = (n) => Math.round(Number(n) || 0);

// Normaliza UNA partida a sólo lo que afecta al layout (no precio/costo/nota).
function huellaPartida(p = {}) {
  return {
    id: String(p.id ?? ''),
    pieza: String(p.piezaId ?? p.bancoId ?? p.producto_id ?? ''),
    cantidad: Math.max(1, Math.round(Number(p.cantidad) || 1)),
    w: mm(p.w), d: mm(p.d),
    ruta: p.ruta ?? null,
    relation_role: p.relation_role ?? null,
    anchor_role: p.anchor_role ?? null,
    anchor_instance_id: p.anchor_instance_id ?? null,
    instance_id: p.instance_id ?? null,
    functional_group_id: p.functional_group_id ?? null,
    requirement_id: p.requirement_id ?? null,
    zone_id: p.zone_id ?? null,
    zonaSugerida: p.zonaSugerida ?? null,
  };
}

/**
 * program_hash: identidad de layout del PROGRAMA confirmado. Estable ante
 * reordenamiento de la lista (se ordena por id) y ante cambios de precio.
 * @param {Array} partidas - cotizacion.partidas (CONFIRMADas; el caller ya filtró sug-*)
 */
export function programHash(partidas = []) {
  const huellas = (Array.isArray(partidas) ? partidas : [])
    .map(huellaPartida)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `p_${hashEstable(huellas)}`;
}

// Normaliza UNA área del FloorSpec canónico (MM) a su geometría relevante.
function huellaArea(a = {}) {
  return {
    nombre: a.nombre ?? null,
    tipo: a.tipo ?? null,
    nivel: Number.isFinite(a.nivel) ? a.nivel : null,
    dentroDe: a.dentroDe ?? null,
    x: Number.isFinite(a.x) ? mm(a.x) : null,
    y: Number.isFinite(a.y) ? mm(a.y) : null,
    ancho: mm(a.ancho), largo: mm(a.largo),
    poly: Array.isArray(a.poly) ? a.poly.map(([x, y]) => [mm(x), mm(y)]) : null,
    obstaculos: Array.isArray(a.obstaculos)
      ? a.obstaculos.map((o) => ({ x: mm(o.x), y: mm(o.y), w: mm(o.w), h: mm(o.h), tipo: o.tipo ?? null }))
      : null,
    puertas: Array.isArray(a.puertas)
      ? a.puertas.map((d) => ({
          x: mm(d.x), y: mm(d.y), ancho: mm(d.ancho),
          sentido: d.sentido ?? null,
          bisagraX: Number.isFinite(d.bisagraX) ? mm(d.bisagraX) : null,
          bisagraY: Number.isFinite(d.bisagraY) ? mm(d.bisagraY) : null,
          barridoDeg: Number.isFinite(d.barridoDeg) ? Number(d.barridoDeg) : null,
        }))
      : null,
  };
}

/**
 * floor_hash: identidad del ESPACIO. Preserva el ORDEN de áreas (el índice de
 * área es identidad en las colocaciones). Acepta áreas en metros o ya en mm.
 * @param {Array} areas - areasM (metros) o áreas canónicas (mm)
 * @param {{yaEnMM?:boolean}} opts
 */
export function floorHash(areas = [], { yaEnMM = false } = {}) {
  const base = Array.isArray(areas) ? areas : [];
  const escala = yaEnMM ? 1 : 1000;   // a mm entero sin reordenar
  const huellas = base.map((a) => huellaArea({
    ...a,
    x: a.x == null ? a.x : Number(a.x) * escala,
    y: a.y == null ? a.y : Number(a.y) * escala,
    ancho: Number(a.ancho) * escala,
    largo: Number(a.largo) * escala,
    poly: Array.isArray(a.poly) ? a.poly.map(([x, y]) => [Number(x) * escala, Number(y) * escala]) : a.poly,
    obstaculos: Array.isArray(a.obstaculos)
      ? a.obstaculos.map((o) => ({ ...o, x: Number(o.x) * escala, y: Number(o.y) * escala, w: Number(o.w) * escala, h: Number(o.h) * escala }))
      : a.obstaculos,
    puertas: Array.isArray(a.puertas)
      ? a.puertas.map((d) => ({
          ...d,
          x: Number(d.x) * escala, y: Number(d.y) * escala, ancho: Number(d.ancho) * escala,
          bisagraX: Number.isFinite(Number(d.bisagraX)) ? Number(d.bisagraX) * escala : d.bisagraX,
          bisagraY: Number.isFinite(Number(d.bisagraY)) ? Number(d.bisagraY) * escala : d.bisagraY,
        }))
      : a.puertas,
  }));
  return `f_${hashEstable(huellas)}`;
}

/** ¿El plan guardado quedó obsoleto respecto a programa/floor actuales? */
export function planEstaStale(planGuardado, programHashActual, floorHashActual) {
  if (!planGuardado) return false;
  const pg = planGuardado.program_hash ?? null;
  const fg = planGuardado.floor_hash ?? null;
  // Sin hashes previos (planes viejos): no se marca stale aquí — otros guards
  // (conteo/ids en sanearAcomodoContraPartidas) siguen aplicando.
  if (pg == null && fg == null) return false;
  return (pg != null && pg !== programHashActual) || (fg != null && fg !== floorHashActual);
}
