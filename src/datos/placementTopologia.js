// ============================================================================
//  P0.2c · GAP6 — TOPOLOGÍA DESDE EL PRODUCTO/CONFIGURACIÓN (no inyectada a mano).
//
//  La topología de colocación debe VIAJAR desde la identidad del producto del
//  catálogo, no inferirse de la capacidad ni de d===1200 ni de regex libre sobre
//  texto del usuario. Aquí mapeamos la identidad REAL del catálogo (familia
//  "Bench doble" de App LT, con su id p9-app-lt-bench-doble-*) → DOUBLE_FACE con
//  provenance CATALOG. Un nombre que sólo "parece" doble, sin id de catálogo, es
//  INFERRED (más débil), nunca CATALOG.
//
//  Clasificación de fuentes (reemplaza el "todo SOURCE_MISSING"):
//   SOURCE_FOUND   · identidad de catálogo con topología inequívoca (bench doble).
//   SOURCE_PARTIAL · capacidad + dimensiones confirmadas, topología NO confirmada.
//   SOURCE_MISSING · sin dims o sin identidad útil.
// ============================================================================
import { BANCO } from './banco.js';
import { medidasAwd } from './catalogoCanonico.js';

const ID_BENCH_DOBLE = /bench-?doble/i;              // id de catálogo (p9-app-lt-bench-doble-*)
const NOMBRE_BENCH_DOBLE = /\bbench\s*doble\b/i;     // nombre canónico de familia

// Devuelve un placement_profile {topology, provenance, evidence} o null.
export function topologiaDeProducto(prod = {}) {
  const idStr = String(prod.productoId || prod.producto_id || prod.piezaId || prod.id || '');
  const clave = String(prod.clave || '');
  const nombre = String(prod.nombre || '');
  if (ID_BENCH_DOBLE.test(idStr) || ID_BENCH_DOBLE.test(clave)) {
    return { topology: 'DOUBLE_FACE', provenance: 'CATALOG', evidence: idStr || clave };
  }
  if (NOMBRE_BENCH_DOBLE.test(nombre)) {
    // Sólo el nombre coincide (sin id de catálogo): verdad más débil → INFERRED.
    return { topology: 'DOUBLE_FACE', provenance: 'INFERRED', confidence: 0.5, evidence: `nombre:${nombre}` };
  }
  return null;
}

// GAP10 · topología desde la CONFIGURACIÓN resuelta (no desde identidad de catálogo).
// Regla USER_CONFIRMED de Rodrigo: un operativo resuelto como UN módulo que sirve a
// N≥2 personas es bench DOUBLE_FACE (usuarios enfrentados). Esto NO es "capacity===8
// global": aplica a la configuración de un MÓDULO OPERATIVO resuelto, no a cualquier
// pieza con capacidad. Si el producto ya tiene identidad de catálogo (bench doble),
// gana ésa (CATALOG) vía topologiaDeProducto; aquí sólo cubrimos el op-* sin identidad.
export function topologiaDeConfiguracion(resolucion = {}) {
  const esOp = resolucion.relation_role === 'ANCHOR_WORKSTATION' || resolucion.rol === 'operativo';
  if (esOp && Number(resolucion.usuarios) >= 2) {
    return { topology: 'DOUBLE_FACE', provenance: 'USER_CONFIRMED', evidence: 'regla Rodrigo: 1 operativo para N personas = bench doble (4+4 enfrentados)' };
  }
  return null;
}

// Perfil de colocación para una RESOLUCIÓN del programa: identidad de catálogo primero
// (CATALOG), luego la configuración confirmada (USER_CONFIRMED). Null si no hay evidencia.
export function placementProfileDeResolucion(resolucion = {}) {
  return topologiaDeProducto(resolucion) || topologiaDeConfiguracion(resolucion) || null;
}

// Clasifica la fuente de topología de un producto del catálogo.
const esOperativo = (p) => /operativ|bench/i.test(p.categoria || '') || /ANCHOR_WORKSTATION/.test(p.relation_role || '');
const PROV_CONFIRMADA = new Set(['CATALOG', 'CURATED_RULE', 'USER_CONFIRMED']);
export function clasificarFuenteTopologia(prod = {}) {
  const t = topologiaDeProducto(prod);
  // SOURCE_FOUND SÓLO con fuente CONFIRMADA; una inferencia (INFERRED) NO basta.
  if (t && PROV_CONFIRMADA.has(t.provenance)) return 'SOURCE_FOUND';
  if (t && t.provenance === 'INFERRED') return 'SOURCE_PARTIAL';
  const { w, d } = medidasAwd(prod.medidas) || {};
  const tieneDims = Number(w) > 0 && Number(d) > 0;
  const tieneCap = Number(prod.usuarios) > 0;
  if (esOperativo(prod) && tieneDims && tieneCap) return 'SOURCE_PARTIAL'; // dims+cap, topología no confirmada
  return 'SOURCE_MISSING';
}

// Inventario (derivado del BANCO) para el reporte.
export function inventarioFuentes(lista = BANCO) {
  const acc = { SOURCE_FOUND: [], SOURCE_PARTIAL: [], SOURCE_MISSING: [] };
  for (const p of lista) acc[clasificarFuenteTopologia(p)].push(p.id);
  return acc;
}
