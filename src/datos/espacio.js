// ============================================================================
//  Helpers de ESPACIO / ACOMODO (compartidos por Acomodo, PlanoAcomodo, PDF).
//  Tipo + color + altura por mueble, huella por defecto, y expansión de las
//  partidas de la cotización a piezas individuales con su huella real.
// ============================================================================
import { topologiaDeProducto } from './placementTopologia.js';
import { capacidadDeNombre, fuenteCapacidad } from './capacidadDeclarada.js';
import { inferRole, esAncla } from './confirmarPrograma.js';
import { inferirDestinoPartida } from './destinoAcomodo.js';
import { BANCO } from './banco.js';

export const TIPOS = {
  escritorio: { label: 'Escritorios', color: '#3b6fb0', alto: 730 },
  juntas: { label: 'Juntas', color: '#0f766e', alto: 740 },
  guarda: { label: 'Guardas', color: '#8a6d3b', alto: 1100 },
  asiento: { label: 'Asientos', color: '#b8862f', alto: 450 },
  mesa: { label: 'Mesas', color: '#4b8b5a', alto: 550 },
  mampara: { label: 'Mamparas', color: '#7a7570', alto: 1500 },
  recepcion: { label: 'Recepción', color: '#7a5c9a', alto: 1100 },
  mueble: { label: 'Otros', color: '#9a908a', alto: 700 },
};

// Huella por defecto si la partida no trae medida (mm).
export const HUELLA = {
  escritorio: [1500, 750], juntas: [2400, 1200], guarda: [900, 450],
  asiento: [600, 600], mesa: [900, 900], mampara: [1600, 80],
  recepcion: [2400, 800], mueble: [800, 600],
};

// Quita acentos: los nombres reales traen "Estación", "Sofá", "Mampara…" y las
// reglas se escriben sin acento.
const sinAcento = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Una GAVETA / pedestal / cajonera rodante vive DEBAJO de la cubierta: no gasta
// piso propio. Antes caía en 'guarda' y el acomodo le apartaba su metro cuadrado,
// así que un proyecto con 20 gavetas pedía un espacio que no necesita.
// Un archivero, credenza, armario, torre o locker SÍ ocupan piso: se distinguen
// por palabra y por tamaño (una gaveta rodante mide ~0.38 × 0.58 m).
export function vaBajoEscritorio(pt) {
  const s = sinAcento((pt.ruta || '') + ' ' + (pt.nombre || ''));
  if (!/gaveta|pedestal|cajonera|buc\b/.test(s)) return false;
  if (/archivero de piso|armario|torre|locker|librero|credenza/.test(s)) return false;
  if (pt.w && pt.w > 600) return false;
  if (pt.d && pt.d > 700) return false;
  return true;
}

export function tipoDe(pt) {
  const s = sinAcento((pt.ruta || '') + ' ' + (pt.nombre || ''));
  // VH-095: "Módulo operativo App LT 8 usuarios (biombo cristal)" caía en 'mampara' por la
  // palabra "biombo" → enderezarAlto lo volvía 4800×80 y el bench se dibujaba como una LÍNEA.
  const esMueble = /escritorio|bench|banca|estacion|mesa|credenza|archiv|gaveta|librero|modulo|operativo|directivo|recepcion/.test(s);
  if (!esMueble && /mampara|privacy|muro|biombo|lambrin/.test(s)) return 'mampara';
  if (/credenza|guarda|archiv|gaveta|armario|librero|locker|torre|modulor|mox|cajon/.test(s)) return 'guarda';
  if (/soporte de pantalla|teamspace ii/.test(s)) return 'mueble';
  if (/junta|consejo|teamspace|mesa circular|circular "olga"|mesa de trabajo/.test(s)) return 'juntas';
  if (/recepcion|mostrador|lobby/.test(s)) return 'recepcion';
  if (/escritorio|bench|banca|estacion|operativo|ducto|qvadrat|cantilever/.test(s)) return 'escritorio';
  if (/mesa|pebble|accent|apoyo|centro|spoon|repisa/.test(s)) return 'mesa';
  if (/sill|pouf|sofa|taburete|lounge|pac|tetris|arlequin|bricks|ding/.test(s)) return 'asiento';
  if (/app|cirque|feather|via|drift|eclipse|luna|alba|anteo|spine|ergo|rio/.test(s)) return 'escritorio';
  return 'mueble';
}

export const colorTipo = (t) => (TIPOS[t] || TIPOS.mueble).color;
export const altoTipo = (t) => (TIPOS[t] || TIPOS.mueble).alto;

/**
 * Lee huella cuando el nombre comercial trae medidas explícitas.
 * 2 números: ancho × fondo.
 * 3 números en guardas/pedestales: ancho × alto/fondo × fondo/alto; para la
 * huella toma el menor de los dos últimos (el otro suele ser altura).
 */
export function dimensionesEnNombre(nombre='', tipo='mueble') {
  const s=String(nombre).replace(/,/g,'.');
  const m=/\(?\s*(\d{2,5}(?:\.\d+)?)\s*[x×]\s*(\d{2,5}(?:\.\d+)?)\s*(?:[x×]\s*(\d{2,5}(?:\.\d+)?)\s*)?(?:mm)?\s*\)?/i.exec(s);
  if(!m) return null;
  const a=Number(m[1]), b=Number(m[2]), cc=m[3]!=null?Number(m[3]):null;
  if(![a,b].every(Number.isFinite) || a<=0 || b<=0) return null;
  if(cc!=null && Number.isFinite(cc) && cc>0) {
    if(tipo==='guarda') return {w:a,d:Math.min(b,cc),alto:Math.max(b,cc)};
    return {w:a,d:b,alto:cc};
  }
  return {w:a,d:b,alto:null};
}

export const dimsPieza = (p, rot) => ((rot === 90 || rot === 270) ? { pw: p.d, ph: p.w } : { pw: p.w, ph: p.d });
export const frenteDe = (rot) => (rot === 90 ? 'izq' : rot === 180 ? 'arriba' : rot === 270 ? 'der' : 'abajo');

export function enderezarAlto(w, d, tipo) {
  const limite = tipo === 'mampara' ? 400 : 700;
  if (!d || d <= limite) return { w, d, alto: null };
  return { w, d: (HUELLA[tipo] || HUELLA.mueble)[1], alto: d };
}

export function huellaReal(nombre, w, d, tipo) {
  const s = sinAcento(nombre);
  if (/\bocupa\s+[\d.]+\s*[x×]\s*[\d.]+\s*m/.test(s)) return [w, d];
  const YA_BLOQUE = { escritorio: 2500, asiento: 1800 };
  if (w >= (YA_BLOQUE[tipo] || Infinity)) return [w, d];
  const m = /(\d+)\s*(?:puesto|plaza|persona|posicion|usuario)s?\b/.exec(s) || /(\d+)\s*u\b(?!\w)/.exec(s);
  if (!m) return [w, d];
  const n = Math.max(1, +m[1]);
  if (n <= 1) return [w, d];
  if (tipo === 'escritorio') {
    // ⚠️ HEURÍSTICA VISUAL NO AUTORITATIVA (#1). Sólo se usa cuando la partida NO
    // trae geometría de bloque real (la guarda w>=2500 de arriba ya respeta el
    // producto real: un bench App LT de 6000 pasa intacto). Para líneas sin
    // módulo canónico (p.ej. Cirque) estima la huella; NO define producto.
    const perW = (w && w >= 700) ? w : 1200;
    const perD = (d && d >= 500) ? d : 750;
    const doble = /doble/.test(s);
    if (!doble) return [n * perW, perD];
    return [Math.ceil(n / 2) * perW, perD >= 1000 ? perD : perD * 2];
  }
  if (tipo === 'asiento') {
    const perW = (w && w >= 500) ? w : 700;
    return [n * perW, d || 800];
  }
  return [w, d];
}

export function contarBajoEscritorio(partidas) {
  return (partidas || []).reduce((s, pt) => s + (vaBajoEscritorio(pt) ? Math.max(1, Math.min(pt.cantidad || 1, 300)) : 0), 0);
}

const TOPE_PARTIDA = 300;

// ---------------------------------------------------------------------------
//  VH-092 · ELEGIBILIDAD para el solver (tres estados, nunca mezclados):
//   A 'CONFIRMADO'  identidad de catálogo válida + precio/snapshot → mobiliario cotizado.
//   B 'PRELIMINAR'  identidad válida sin precio autorizado (programa en borrador).
//   C 'REFERENCIA'  sin identidad verificable → NO entra al solver (UNRESOLVED_PRODUCT).
//  Y la PROCEDENCIA de la huella: SPATIAL_SPEC > PARTIDA (w/d) > CATALOGO (ficha del banco, VH-A10-06) >
//  NOMBRE (medidas en el texto) > INFERIDA (huella por tipo). Un acomodo con huellas INFERIDAS es PRELIMINAR.
//  La silla sin medida de catálogo usa la ESTANDAR (600 × 600), que se dice supuesta pero no es PRELIMINAR.
// ---------------------------------------------------------------------------
const BANCO_IDS = new Set(BANCO.map((b) => b.id));
const BANCO_POR_ID = new Map(BANCO.map((b) => [String(b.id), b]));
// VH-A10-06: ficha del catálogo de la partida (por su id de banco), para tomar su medida REAL cuando la partida no
// trae ancho × fondo. Sólo ids exactos: nunca se busca "algo parecido" por nombre.
export function fichaDeCatalogo(pt = {}) {
  for (const k of [pt.piezaId, pt.bancoId, pt.source_ref]) {
    const b = k != null ? BANCO_POR_ID.get(String(k)) : null;
    if (b) return b;
  }
  return null;
}
const esGuardaDeCatalogo = (ficha) => /guarda|archivo/i.test(String(ficha?.categoria || ''));
export function identidadDePartida(pt = {}) {
  if (pt.productoId || pt.producto_id || pt.producto_version_id || pt.lista_precio_item_id) return true;
  const b = pt.bancoId || pt.piezaId;
  if (b && BANCO_IDS.has(String(b))) return true;
  if (b && /^(linea-|op-|dir-|mj-|rec-|esc-|ger-)/.test(String(b))) return true;
  return false;
}
export function elegibilidadDePartida(pt = {}) {
  if (!identidadDePartida(pt)) return 'REFERENCIA';
  const precioOk = Number(pt.precioUnitario) > 0 || Number(pt.precio_lista_snapshot) > 0 || pt.price_status === 'SNAPSHOT_DISPLAY';
  return precioOk ? 'CONFIRMADO' : 'PRELIMINAR';
}

export { capacidadDeNombre };

export function expandirPiezas(partidas, tope = 600) {
  const out = [];
  let real = 0;
  for (const pt of partidas || []) {
    if (vaBajoEscritorio(pt)) continue;
    // VH-092: el solver (kit-solver) sólo coloca piezas con ROL. Las partidas que describe
    // una persona (VONI texto / banco) no lo traen → se infiere aquí (misma regla que
    // confirmarPrograma) para que un escritorio sea ancla y una silla busque su mueble,
    // en vez de salir "sin un mueble que las reciba".
    const relInferida = pt.relation_role || inferRole(pt) || null;
    const destino = inferirDestinoPartida(pt);
    const elegibilidad = elegibilidadDePartida(pt);
    let tipo = tipoDe(pt);
    let huellaFuente = (pt.spatial_spec || pt.atributos?.spatial_spec) ? 'SPATIAL_SPEC' : (pt.w && pt.d ? 'PARTIDA' : 'INFERIDA');
    if (esAncla(relInferida) && (tipo === 'mampara' || tipo === 'mueble')) {
      tipo = ({ ANCHOR_WORKSTATION: 'escritorio', ANCHOR_DESK: 'escritorio', ANCHOR_MEETING: 'juntas', ANCHOR_RECEPTION: 'recepcion' })[relInferida] || tipo;
    }
    const ficha = fichaDeCatalogo(pt);
    if (tipo === 'mueble' && esGuardaDeCatalogo(ficha)) tipo = 'guarda';
    let w = pt.w, d = pt.d;
    // VH-A10-06 (P0-05): precedencia de la huella SPATIAL_SPEC > PARTIDA > CATALOGO (ficha del banco) > NOMBRE >
    // INFERIDA. Antes la ficha no se consultaba: una partida del banco con el nombre editado caía a la huella por
    // tipo (1.50 × 0.75 m para un bench de 4.50 × 1.20). En una guarda la ficha trae el alto (900 × 1570 × 450):
    // la huella es frente × fondo.
    if (tipo !== 'asiento' && (!w || !d) && ficha?.medidas) {
      const m = dimensionesEnNombre(ficha.medidas, esGuardaDeCatalogo(ficha) ? 'guarda' : tipo);
      if (m) { w = w || m.w; d = d || m.d; if (huellaFuente === 'INFERIDA') huellaFuente = 'CATALOGO'; }
    }
    if (tipo !== 'asiento' && (!w || !d)) {
      const explicitas = dimensionesEnNombre(pt.nombre, tipo);
      if (explicitas) { w = w || explicitas.w; d = d || explicitas.d; if (huellaFuente === 'INFERIDA') huellaFuente = 'NOMBRE'; }
    }
    if (tipo === 'asiento' || !w || !d) { [w, d] = HUELLA[tipo] || HUELLA.mueble; }
    // Una silla tiene huella ESTÁNDAR (600×600, la misma que usa el servidor): no es una
    // medida "supuesta" que vuelva PRELIMINAR el acomodo. Lo supuesto es un mueble sin medida.
    if (tipo === 'asiento') huellaFuente = 'ESTANDAR';
    if (tipo === 'guarda' || tipo === 'mampara') ({ w, d } = enderezarAlto(w, d, tipo));
    [w, d] = huellaReal(pt.nombre, w, d, tipo);
    const n = Math.max(1, Math.min(pt.cantidad || 1, TOPE_PARTIDA));
    real += Math.max(1, pt.cantidad || 1);

    // La revisión exacta viaja con CADA instancia. La edge usa este id sólo para
    // resolver un `spatial_spec` seller-safe server-side; nunca acepta costo ni
    // atributos técnicos completos del navegador. Alias camelCase/legacy para
    // que las cotizaciones previas y las nuevas entren por el mismo camino.
    const productoVersionId = pt.producto_version_id ?? pt.productoVersionId ?? pt.version_id ?? null;
    const spatialSpec = pt.spatial_spec || pt.atributos?.spatial_spec || null;

    for (let k = 0; k < n && out.length < tope; k++) {
      out.push({
        id: `${pt.id}-${k + 1}`,
        nombre: pt.nombre,
        w, d, tipo,
        ruta: pt.ruta || null,
        // VH-A10-07: la línea viaja para juzgar la banca contra su guía (APP LT); no entra al program_hash.
        ...(pt.linea ? { linea: pt.linea } : {}),
        productoId: pt.productoId || pt.producto_id || null,
        producto_version_id: productoVersionId,
        // VH-092: grupo por DESTINO cuando la partida no trae grupo (las sillas sueltas de
        // "privado" buscan el escritorio suelto de "privado"); rol explícito o inferido.
        ...(pt.functional_group_id ? { functional_group_id: pt.functional_group_id } : (relInferida ? { functional_group_id: `fg:libre:${destino || 'general'}` } : {})),
        ...(relInferida ? { relation_role: relInferida } : {}),
        ...(!pt.relation_role && relInferida ? { relation_role_inferida: true } : {}),
        ...(pt.anchor_role ? { anchor_role: pt.anchor_role } : {}),
        // P0.2 obj6: identidad estable de zona/requerimiento/ancla a NIVEL de grupo
        // (compartida por todas las instancias de la partida) — para que el
        // agregador de invariantes ate dependientes a su zona por id, no sólo por
        // índice de área. Sólo viaja si la partida la trae (aditivo).
        ...(pt.requirement_id ? { requirement_id: pt.requirement_id } : {}),
        ...(pt.zone_id ? { zone_id: pt.zone_id } : {}),
        ...(pt.anchor_instance_id ? { anchor_instance_id: pt.anchor_instance_id } : {}),
        // VH-112/VH-120: capacidad con su FUENTE (CATALOGO | USUARIO | INFERIDA). `usuarios` (lo que dijo la persona
        // o la ficha del banco) también cuenta: antes sólo se leía `user_capacity` y "3 bancas de 8" perdía el 8.
        ...(() => { const fc = fuenteCapacidad(pt, { w, rol: relInferida }); return fc.capacidad ? { user_capacity: fc.capacidad, capacity_source: fc.fuente, ...(fc.fuente === 'INFERIDA' ? { user_capacity_inferida: true } : {}) } : {}; })(),
        // P0.2c GAP6: la topología de colocación VIAJA desde la identidad del
        // producto (catálogo). Aditivo: sólo aparece si hay evidencia (p.ej. bench
        // doble). perfilDeAncla la lee server-side; ausente → UNKNOWN+fallback.
        ...((pt.placement_profile || topologiaDeProducto(pt)) ? { placement_profile: pt.placement_profile || topologiaDeProducto(pt) } : {}),
        ...(pt.zonaSugerida ? { zonaSugerida: pt.zonaSugerida } : {}),
        ...(pt.sugeridoPlano ? { sugeridoPlano: true } : {}),
        ...(pt.sugerido ? { sugerido: true } : {}),
        ...(pt.noCobrar ? { noCobrar: true } : {}),
        ...(pt.source ? { source: pt.source } : {}),
        ...(Number.isFinite(Number(pt.max_anchor_distance_mm)) ? { max_anchor_distance_mm: Number(pt.max_anchor_distance_mm) } : {}),
        relation_index: k + 1,
        elegibilidad,
        huella_fuente: huellaFuente,
        ...(spatialSpec ? { spatial_spec: spatialSpec } : {}),
      });
    }
  }
  if (real > out.length) out.truncado = { real, mostrado: out.length };
  return out;
}

export const mapaPiezas = (piezas) => Object.fromEntries(piezas.map((p) => [p.id, p]));
