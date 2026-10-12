// ============================================================================
//  programaBrief · CONTRATO MÍNIMO (P0.1 · #5) contra el SCHEMA REAL de
//  cotizar-texto v10. NO inventa campos: la Edge sólo garantiza
//    items[]: { ruta, producto, cantidad, seleccion:[{clave,valor}], etiqueta,
//              confianza, nota, material_override }
//    banco[]: { id, cantidad, etiqueta, nota, sugerido }
//  (additionalProperties:false — NO hay rol/linea/dimensiones/w/d).
//
//  La LÍNEA sale de `ruta`; el MODELO de `producto`/`etiqueta`; las DIMENSIONES
//  de `seleccion` (clave ancho/largo/profundidad). El ROL de las piezas de
//  `banco` se resuelve por metadata canónica del BANCO (por id), no por texto.
//  Regla dura: lo no provisto queda UNKNOWN (null/ausente) — nunca `false`
//  (distingue "no mencionó" de "no quiere").
// ============================================================================
import { BANCO } from './banco.js';

const norm = (s = '') => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// hash corto y estable del texto fuente (para versionar la interpretación).
function hashTexto(t = '') {
  let h = 0; const s = String(t);
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return `h${(h >>> 0).toString(36)}`;
}

// Dimensiones desde `seleccion`: pares {clave:'ancho'|'largo'|'profundidad', valor:'1200'}.
function dimsDeSeleccion(seleccion = []) {
  const map = {};
  for (const p of (Array.isArray(seleccion) ? seleccion : [])) {
    const k = norm(p?.clave); const v = Number(String(p?.valor).replace(/[^\d.]/g, ''));
    if (!v) continue;
    if (/ancho|width/.test(k)) map.w = v < 100 ? Math.round(v * 1000) : Math.round(v);
    else if (/largo|fondo|profund|depth|length/.test(k)) map.d = v < 100 ? Math.round(v * 1000) : Math.round(v);
  }
  return (map.w || map.d) ? { w: map.w || null, d: map.d || null } : null;
}

function capacidadDeSeleccion(seleccion = []) {
  for (const p of (Array.isArray(seleccion) ? seleccion : [])) {
    if (/usuarios|puestos|personas|capacidad/.test(norm(p?.clave))) {
      const v = Number(String(p?.valor).replace(/[^\d]/g, ''));
      if (v > 0) return v;
    }
  }
  return null;
}

// Rol funcional de una pieza del BANCO por su metadata canónica (por id).
function rolDeBanco(id) {
  const p = BANCO.find((b) => b.id === id);
  if (!p) return null;
  const tipo = norm(p.tipo); const t = norm(`${p.nombre || ''} ${id}`);
  if (tipo === 'silla' || /silla|asiento/.test(t)) {
    if (/directiv|alpha|ejecutiv/.test(t)) return 'EXECUTIVE_SEAT';
    if (/junta|consejo|sonata/.test(t)) return 'MEETING_SEAT';
    if (/visit|concerto/.test(t)) return 'VISITOR_SEAT';
    return 'WORK_SEAT';
  }
  if (tipo === 'guarda' || tipo === 'almacen' || /gaveta|pedestal|archiv|cajoner/.test(t)) return 'STORAGE';
  return null;
}

// Clasifica un ITEM de línea por ruta/producto/etiqueta (fallback de texto: no
// hay campo de rol en el schema real).
function rolDeItem(it) {
  const t = norm(`${it?.ruta || ''} ${it?.producto || ''} ${it?.etiqueta || ''}`);
  if (/privad|direcc|directiv|ejecutiv|gerenc/.test(t)) return 'privado';
  if (/junta|consejo|meeting|board/.test(t)) return 'juntas';
  if (/recepci|lobby|mostrador/.test(t)) return 'recepcion';
  if (/operativ|bench|banca|open|puesto|workstation|isla/.test(t)) return 'operativo';
  return null;
}

/**
 * Construye el ProgramBrief VERSIONADO desde la propuesta REAL de cotizar-texto.
 * @param {{items?:Array, banco?:Array, textoOriginal?:string}} propuesta
 */
export function briefDePropuesta({ items = [], banco = [], textoOriginal = '' } = {}) {
  const requirements = {
    linea: null,
    operativosStorage: null,          // UNKNOWN hasta evidencia (no false)
    operativoSeatModel: null,
    privados: [],
    juntas: [],
    visitors: null,                   // {model, cantidad} si el banco trae visitas
  };

  // --- ITEMS de línea (ruta = línea; seleccion = dims/capacidad) ---
  for (const it of (Array.isArray(items) ? items : [])) {
    if (!it) continue;
    const rol = rolDeItem(it);
    const dims = dimsDeSeleccion(it.seleccion);
    // La línea GLOBAL (operativa) sólo se toma de un item OPERATIVO; la de un
    // privado/juntas viaja por-entrada (requested_line), no contamina la global.
    if (rol === 'operativo' && !requirements.linea && it.ruta) requirements.linea = it.ruta;
    if (rol === 'privado') {
      const e = { requested_route: it.ruta || null, requested_product: it.producto || null };
      if (it.etiqueta || it.producto) e.requested_models = { anchor: it.etiqueta || it.producto };
      if (it.ruta) e.requested_line = it.ruta;
      if (dims) e.requested_dimensions = dims;
      if (Array.isArray(it.seleccion) && it.seleccion.length) e.requested_selection = it.seleccion;
      requirements.privados.push(e);
    } else if (rol === 'juntas') {
      const e = { requested_route: it.ruta || null };
      if (it.ruta) e.requested_line = it.ruta;
      if (dims) e.requested_dimensions = dims;
      if (Array.isArray(it.seleccion) && it.seleccion.length) e.requested_selection = it.seleccion;
      requirements.juntas.push(e);
    }
  }

  // --- BANCO (sillería/guardas) por id → rol canónico. Preserva modelo+cantidad. ---
  for (const b of (Array.isArray(banco) ? banco : [])) {
    if (!b || !b.id) continue;
    const rol = rolDeBanco(b.id);
    const cant = Math.max(1, Math.round(Number(b.cantidad) || 1));
    if (rol === 'WORK_SEAT' && !requirements.operativoSeatModel) requirements.operativoSeatModel = b.id;
    else if (rol === 'STORAGE') requirements.operativosStorage = true;            // evidencia explícita
    else if (rol === 'VISITOR_SEAT') {
      requirements.visitors = { model: b.id, cantidad: cant };
      if (requirements.privados[0]) requirements.privados[0].requested_visitors = { model: b.id, cantidad: cant };
    } else if (rol === 'EXECUTIVE_SEAT' && requirements.privados[0] && !requirements.privados[0].requested_models?.seat) {
      requirements.privados[0].requested_models = { ...(requirements.privados[0].requested_models || {}), seat: b.id };
    } else if (rol === 'MEETING_SEAT' && requirements.juntas[0] && !requirements.juntas[0].requested_models?.seat) {
      requirements.juntas[0].requested_models = { ...(requirements.juntas[0].requested_models || {}), seat: b.id };
    }
  }

  return {
    version: 1,
    source: 'cotizar-texto',
    interpretation_id: `int-${Date.now()}`,
    source_text_hash: hashTexto(textoOriginal),
    interpreted_at: new Date().toISOString(),
    requirements,
  };
}

/** ¿El brief (o sus requirements) tiene alguna señal estructurada útil? */
export function briefTieneSenal(briefOrReq) {
  const r = briefOrReq && briefOrReq.requirements ? briefOrReq.requirements : briefOrReq;
  if (!r) return false;
  return !!(r.linea || r.operativosStorage === true || r.operativoSeatModel || r.visitors
    || (r.privados && r.privados.some((p) => Object.keys(p).length))
    || (r.juntas && r.juntas.some((p) => Object.keys(p).length)));
}

/** Extrae los `requirements` que consume resolverPrograma (acepta brief versionado o plano). */
export function requirementsDeBrief(brief) {
  if (!brief) return null;
  return brief.requirements ? brief.requirements : brief;
}
