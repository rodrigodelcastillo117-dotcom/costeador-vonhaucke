// ============================================================================
//  catalogoCanonico · LA ÚNICA FUENTE de la regla "qué es un producto canónico"
//  y de las TRES COMPUERTAS independientes del Product Resolver (P0.1).
//
//  Por qué existe (#8): antes la regla "esto es un módulo canónico" vivía
//  dispersa como `id.startsWith('op-')` / regex sueltos en resolverPrograma y
//  otros lugares. Eso es frágil y se desincroniza. Aquí se encapsula UNA sola
//  vez. Cualquier consumidor (resolverPrograma, confirmarPrograma, acomodo)
//  pregunta aquí; nadie vuelve a escribir el prefijo del id a mano.
//
//  AUDITORÍA DE METADATA DEL BANCO (requerida por #8):
//  Revisado banco.js. El BANCO SÍ tiene `categoria`, `tipo`, `linea`, `usuarios`,
//  pero NO tiene ningún flag explícito `canonical` / `source` / `status` /
//  `producto_id` / `version`. Peor: los renglones sucios del Excel (`p9-*`)
//  comparten EXACTAMENTE la misma `categoria: 'Operativos / Bench'`,
//  `tipo: 'modulo'`, `linea: 'App LT'` y `usuarios` que los módulos limpios
//  (`op-*`). Ejemplo: `p9-app-lt-modulo-operativo-25980` (3000×1200, 4u) vs el
//  canónico `op-4u-3000x1200`. => `categoria`/`tipo`/`linea`/`usuarios` NO
//  distinguen canónico de basura. El ÚNICO discriminador real hoy es el PREFIJO
//  del id (carga limpia Tradeco/BMU) frente a `p9-*` (presupuestos Excel).
//  Por eso la regla canónica es, PROVISIONALMENTE, una ALLOWLIST por prefijo de
//  id (clasificación vigente, NO verdad eterna), centralizada aquí y marcada como
//  DEUDA revisable (ver METADATA_DEBT, #17). Si aparece otro lote sucio, se reclasifica.
//
//  LAS TRES COMPUERTAS (NUNCA se mezclan — cada bug nació de confundirlas):
//   1) PRODUCT_RESOLVED  → existe un producto REAL del catálogo canónico con
//      geometría real (vistaCanonica). Resuelto ≠ con identidad ≠ con precio.
//   2) PRODUCT_IDENTITY  → `producto_id` + `producto_version_id` (identidadDe,
//      vía producto_maestro). `source_ref` por sí solo NO es identidad.
//   3) PRICE_AUTHORITY   → el precio del banco es SNAPSHOT de DISPLAY, NUNCA
//      autoridad. La cifra oficial la valida el servidor (autoridadPrecio).
// ============================================================================
import { BANCO } from './banco.js';
import { autorizadoPorRef } from './precioAutorizado.js';

// ---------------------------------------------------------------------------
// DEUDA DE METADATA (documentada explícitamente, #8). Cuando el BANCO gane un
// campo explícito (p.ej. `canonical: true` / `source: 'tradeco'`), `esCanonico`
// debe pasar a leer ESE campo y este regex de prefijo desaparece. Hasta
// entonces, el prefijo es la autoridad — pero SÓLO desde aquí.
// ---------------------------------------------------------------------------
export const METADATA_DEBT = Object.freeze({
  clasificacion: 'CURRENT_ALLOWLIST / LEGACY_CLASSIFICATION',   // NO es verdad eterna
  problema:
    'BANCO no tiene flag canonical/source/status, así que el prefijo del id es hoy ' +
    'el único discriminador. El único lote con geometría inconsistente observado es ' +
    'p9- (≈175 renglones del presupuesto Excel). Por eso, PROVISIONALMENTE, se ' +
    'clasifica "canónico = tiene id y NO es p9-*". Es una ALLOWLIST vigente, no una ' +
    'afirmación de que todo lo demás sea perfecto para siempre: si aparece otro lote ' +
    'sucio, hay que reclasificar.',
  mitigacion:
    'Regla centralizada en esCanonico() (un solo lugar). Prohibido dispersar ' +
    'id.startsWith("op-")/id.startsWith("p9-") por la app.',
  accion_definitiva:
    'Añadir en banco.js un campo explícito por pieza (canonical:true / ' +
    'source:"tradeco"|"excel") y reescribir esCanonico() para leerlo; retirar ' +
    'RE_NO_CANONICO. Hasta entonces, tratar esta regla como clasificación revisable.',
});

// ---------------------------------------------------------------------------
// REGLA CANÓNICA ÚNICA. Provisional por deuda de metadata (arriba): el único
// lote no canónico es la importación de presupuestos Excel con prefijo `p9-`.
// Canónico = tiene id y NO es p9-*. (Los roles concretos —anclas, asientos,
// guardas— se derivan DESPUÉS con los prefijos de rol, siempre dentro de lo
// canónico.) Prohibido escribir este criterio en otra parte de la app.
// ---------------------------------------------------------------------------
const RE_NO_CANONICO = /^p9-/;

/** ¿Esta pieza del banco pertenece a la carga canónica limpia (no p9-* Excel)? */
export function esCanonico(prod) {
  if (!prod || prod.id == null) return false;
  return !RE_NO_CANONICO.test(String(prod.id));
}

// ---------------------------------------------------------------------------
// PARSER DE MEDIDAS — única fuente. "6000 × 1200 mm" / "Ø 600 × 398 mm" → {w,d}.
// (resolverPrograma re-exporta desde aquí para no duplicar la regex.)
// ---------------------------------------------------------------------------
export function medidasAwd(medidas) {
  const s = String(medidas || '').replace(/mm/gi, '').replace(/[Øø]/g, ' ');
  const m = s.match(/(\d[\d.,]*)\s*[×x]\s*(\d[\d.,]*)/);
  if (!m) return null;
  const num = (t) => Math.round(parseFloat(String(t).replace(/,/g, '')));
  const w = num(m[1]); const d = num(m[2]);
  return (Number.isFinite(w) && Number.isFinite(d) && w > 0 && d > 0) ? { w, d } : null;
}

// ---------------------------------------------------------------------------
// COLECCIONES CANÓNICAS (derivadas de la regla única; nadie filtra por su cuenta).
// Operativos: módulos con N usuarios reales. Escritorios/juntas/recepción: por rol.
// ---------------------------------------------------------------------------
export const OPERATIVOS = BANCO.filter(
  (b) => esCanonico(b) && /^op-\d+u-/.test(String(b.id)) && Number(b.usuarios) > 0,
);
export const ESCRITORIOS = BANCO.filter(
  (b) => esCanonico(b) && /^(esc|ger|dir)-/.test(String(b.id)),
);
export const JUNTAS = BANCO.filter(
  (b) => esCanonico(b) && /^mj-/.test(String(b.id)) && Number(b.usuarios) > 0,
);
export const RECEPCIONES = BANCO.filter(
  (b) => esCanonico(b) && /^rec-/.test(String(b.id)),
);

// Dependientes reales (asientos / guardas). Son productos canónicos de la carga
// limpia; se enlazan a su ancla por functional_group_id + relation_role (#2/#5).
export const SILLAS = BANCO.filter(
  (b) => esCanonico(b) && b.tipo === 'silla',
);
export const GUARDAS = BANCO.filter(
  (b) => esCanonico(b) && (b.tipo === 'guarda' || b.tipo === 'almacen'),
);

// Búsqueda por lo PEDIDO (modelo/línea/dimensiones) sobre una colección canónica.
// Devuelve coincidencias reales; vacío si lo pedido no existe en catálogo (el
// llamador decide NEEDS_CONFIRMATION — nunca sustituye en silencio, #7/#8/#10).
const normk = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function buscarEnColeccion(coleccion, { model = null, line = null, dimensions = null } = {}) {
  let xs = (coleccion || []).slice();
  // Línea tolerante a espacios: la `ruta` del intérprete ('applt') empata con la
  // `linea` canónica del banco ('App LT'). No mezcla líneas distintas (drift≠applt).
  const nl = (s) => normk(s).replace(/\s+/g, '');
  // Un producto SIN línea (p.ej. mesas mj-*) no se excluye por línea pedida; sólo
  // se descarta el que tiene OTRA línea explícita (drift ≠ applt).
  if (line) xs = xs.filter((p) => !p.linea || nl(p.linea) === nl(line));
  if (dimensions && (dimensions.w || dimensions.d)) {
    xs = xs.filter((p) => {
      const wd = medidasAwd(p.medidas);
      return wd && (!dimensions.w || wd.w === Number(dimensions.w)) && (!dimensions.d || wd.d === Number(dimensions.d));
    });
  }
  if (model) {
    const m = normk(model);
    xs = xs.filter((p) => {
      const id = normk(p.id); const nom = normk(p.nombre);
      return id.includes(m) || nom.includes(m) || m.includes(id) || m.split(/\s+/).some((tok) => tok.length > 2 && (id.includes(tok) || nom.includes(tok)));
    });
  }
  return xs;
}

// Selección determinista de asiento por rol funcional (producto REAL, no inventado).
// Si se pide un MODELO explícito, se busca ese modelo real; si no existe, devuelve
// null (el llamador emite NEEDS_CONFIRMATION, no sustituye). Sin modelo pedido,
// default por regla. El rol decide DÓNDE va, no reemplaza el modelo pedido (#10).
function porId(lista, id) { return lista.find((b) => b.id === id) || null; }
export function asientoPara(relationRole, requestedModel = null) {
  if (requestedModel) {
    const found = buscarEnColeccion(SILLAS, { model: requestedModel });
    return found[0] || null;      // null → NEEDS_CONFIRMATION en el llamador
  }
  switch (relationRole) {
    case 'WORK_SEAT':      return porId(SILLAS, 'silla-win')      || SILLAS[0] || null;
    case 'EXECUTIVE_SEAT': return porId(SILLAS, 'silla-alpha')    || porId(SILLAS, 'silla-win') || null;
    case 'MEETING_SEAT':   return porId(SILLAS, 'silla-concerto') || porId(SILLAS, 'silla-sonata') || null;
    case 'VISITOR_SEAT':   return porId(SILLAS, 'silla-sonata')   || porId(SILLAS, 'silla-concerto') || null;
    default:               return null;
  }
}
export function guardaPara(relationRole) {
  switch (relationRole) {
    case 'UNDERDESK_STORAGE': return porId(GUARDAS, 'gaveta-mox') || GUARDAS.find((g) => g.tipo === 'guarda') || null;
    case 'SUPPORT_STORAGE':   return GUARDAS.find((g) => g.tipo === 'almacen') || porId(GUARDAS, 'gaveta-mox') || null;
    default:                  return null;
  }
}

/** Módulos operativos canónicos de UNA línea (para respetar preferred_line, #12). */
export function modulosOperativosPorLinea(linea) {
  if (!linea) return OPERATIVOS.slice();
  return OPERATIVOS.filter((m) => String(m.linea || '') === String(linea));
}

/** Líneas que HOY tienen módulo operativo canónico (App LT es la única con carga limpia). */
export function lineasOperativasDisponibles() {
  return Array.from(new Set(OPERATIVOS.map((m) => String(m.linea || '')).filter(Boolean)));
}

// ===========================================================================
//  COMPUERTA 1 · PRODUCT_RESOLVED — vista canónica con geometría REAL.
//  Devuelve lo que un producto resuelto aporta por sí mismo: id, nombre, línea,
//  usuarios, geometría real. Precio como SNAPSHOT (ver compuerta 3), nunca como
//  autoridad. NO incluye identidad (compuerta 2).
// ===========================================================================
export function vistaCanonica(prod) {
  if (!esCanonico(prod)) return null;
  const wd = medidasAwd(prod.medidas);
  return {
    bancoId: prod.id,
    nombre: prod.nombre,
    linea: prod.linea || null,
    usuarios: Number(prod.usuarios) || null,
    w: wd ? wd.w : null,
    d: wd ? wd.d : null,
    source: 'CATALOGO_CANONICO',
    gate_product_resolved: true,
  };
}

// ===========================================================================
//  COMPUERTA 2 · PRODUCT_IDENTITY — producto_id + producto_version_id.
//  `source_ref` por sí solo NO es identidad: la identidad es el par versionado
//  del Producto Maestro. Sin match → null (requerimiento sin identidad real).
// ===========================================================================
export function identidadDe(ref) {
  const id = autorizadoPorRef(ref);
  if (!id || id.producto_id == null || id.producto_version_id == null) return null;
  return {
    source_ref: id.source_ref,
    producto_id: id.producto_id,
    producto_version_id: id.producto_version_id,
    lista_precio_item_id: id.lista_precio_item_id ?? null,
    gate_product_identity: true,
  };
}

// ===========================================================================
//  COMPUERTA 3 · PRICE_AUTHORITY — el precio del banco es DISPLAY, no autoridad.
//  Nunca marca el precio del banco como AUTORIZADO. La cifra oficial la revalida
//  el servidor (cotizar-servidor / emitir_revision_v2). Gate separado del resto.
// ===========================================================================
export function autoridadPrecio(prod) {
  const snapshot = Number(prod && prod.precio) || null;
  return {
    precio_lista_snapshot: snapshot,              // para mostrar; NO es oficial
    price_status: snapshot ? 'SNAPSHOT_DISPLAY' : 'SIN_PRECIO',
    autoridad: 'SERVIDOR',                         // jamás 'FRONTEND'/'BANCO'
    gate_price_authority: false,                   // nunca autorizado en cliente
  };
}
