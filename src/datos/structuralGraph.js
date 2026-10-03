// ============================================================================
//  STRUCTURAL GRAPH v1 — representación intermedia ÚNICA del mueble.
//  La COMPRENSIÓN la hace el servicio canónico (analizar-mueble, LLM, ancla a
//  catálogo). Aquí NO se interpreta de nuevo: se LEVANTA ese BOM a un grafo con
//  rol semántico + relaciones, y se valida. Ese grafo alimenta: despiece, esquema
//  y render. NO contiene dinero (ni precio, costo, margen) — eso es del motor.
// ============================================================================
import { rolDe } from './revisionEstructural.js';

export const SCHEMA_VERSION = 'structural_graph_v1';

const SOURCES = new Set(['user', 'ai', 'catalog', 'derived']);
const RELATIONS = new Set(['attached_to', 'supports', 'contains', 'connects', 'repeats_with']);
// Roles que SOSTIENEN (para inferir relaciones de soporte) y roles "contenibles".
const ROLES_SOPORTE = new Set(['pata', 'conector']);
const ROLES_SUPERFICIE = new Set(['cubierta', 'asiento', 'respaldo']);
const finito = (x) => typeof x === 'number' && Number.isFinite(x);

// ---------------------------------------------------------------------------
//  VALIDATOR. El LLM no puede devolver cualquier JSON: esto es la frontera.
// ---------------------------------------------------------------------------
export function validateStructuralGraph(graph) {
  const issues = [];
  const bad = (path, reason) => issues.push({ path, reason });
  if (!graph || typeof graph !== 'object') return { ok: false, code: 'STRUCTURAL_GRAPH_INVALID', issues: [{ path: '(root)', reason: 'graph ausente' }] };
  if (graph.schema_version !== SCHEMA_VERSION) bad('schema_version', `esperado ${SCHEMA_VERSION}`);
  if (!graph.design_intent || typeof graph.design_intent !== 'object') bad('design_intent', 'falta');
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : null;
  if (!nodes || nodes.length === 0) { bad('nodes', 'se requiere al menos un nodo'); return { ok: false, code: 'STRUCTURAL_GRAPH_INVALID', issues }; }

  const ids = new Set();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; const at = `nodes[${i}]`;
    if (!n || typeof n !== 'object') { bad(at, 'nodo inválido'); continue; }
    if (!n.id || typeof n.id !== 'string') bad(`${at}.id`, 'id obligatorio (string)');
    else if (ids.has(n.id)) bad(`${at}.id`, `id duplicado: ${n.id}`); else ids.add(n.id);
    if (!n.semantic_role || typeof n.semantic_role !== 'string') bad(`${at}.semantic_role`, 'rol obligatorio (usa "unknown" si no se sabe)');
    if (!(Number.isInteger(n.quantity) && n.quantity > 0)) bad(`${at}.quantity`, 'quantity entero > 0');
    if (n.source != null && !SOURCES.has(n.source)) bad(`${at}.source`, `source inválido: ${n.source}`);
    if (n.confidence != null && !(finito(n.confidence) && n.confidence >= 0 && n.confidence <= 1)) bad(`${at}.confidence`, 'confidence 0..1');
    if (n.insumo_id != null && (typeof n.insumo_id !== 'string' || n.insumo_id.length === 0)) bad(`${at}.insumo_id`, 'insumo_id debe ser string o null (nunca inventado)');
    const g = n.geometry;
    if (g != null) {
      if (typeof g !== 'object') bad(`${at}.geometry`, 'geometry debe ser objeto');
      else for (const k of ['length_mm', 'width_mm', 'height_mm', 'thickness_mm']) {
        if (g[k] != null && !(finito(g[k]) && g[k] >= 0)) bad(`${at}.geometry.${k}`, `${k} finito ≥ 0`);
      }
    }
  }
  // parent_id válido + sin ciclos
  const byId = new Map(nodes.map((n) => [n && n.id, n]));
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]; if (!n) continue;
    if (n.parent_id != null) {
      if (!byId.has(n.parent_id)) { bad(`nodes[${i}].parent_id`, `parent inexistente: ${n.parent_id}`); continue; }
      let cur = n.parent_id; const visto = new Set([n.id]);
      while (cur != null) {
        if (visto.has(cur)) { bad(`nodes[${i}].parent_id`, 'ciclo en parent_id'); break; }
        visto.add(cur); cur = byId.get(cur)?.parent_id ?? null;
      }
    }
  }
  const rels = Array.isArray(graph.relations) ? graph.relations : [];
  rels.forEach((r, i) => {
    if (!r || typeof r !== 'object') { bad(`relations[${i}]`, 'relación inválida'); return; }
    if (!RELATIONS.has(r.type)) bad(`relations[${i}].type`, `tipo inválido: ${r.type}`);
    if (!byId.has(r.from)) bad(`relations[${i}].from`, `from inexistente: ${r.from}`);
    if (!byId.has(r.to)) bad(`relations[${i}].to`, `to inexistente: ${r.to}`);
  });

  if (issues.length) return { ok: false, code: 'STRUCTURAL_GRAPH_INVALID', issues };
  return { ok: true, graph };
}

// ---------------------------------------------------------------------------
//  CAMINO IDEAL: construye el grafo desde la SEMÁNTICA que ya entrega el
//  intérprete canónico (analizar-mueble v17: design_intent + piezas con
//  semantic_role/parent/relacion). NO re-interpreta con regex: usa el rol del
//  LLM y sólo cae a rolDe() cuando una pieza no trae semantic_role. Determinista.
//  `graphFromBom` (abajo) queda como PUENTE LEGACY para despieces viejos sin
//  semántica.
// ---------------------------------------------------------------------------
const CONF_A_NUM = { alta: 0.9, media: 0.6, baja: 0.3 };
const RELACION_A_TIPO = { soporta: 'supports', contiene: 'contains', conecta: 'connects', se_repite_con: 'repeats_with' };
const norm = (s) => String(s || '').trim().toLowerCase();

export function graphFromPropuesta(propuesta = {}) {
  const piezas = Array.isArray(propuesta.piezas) ? propuesta.piezas.filter((p) => p && (p.nombre || p.insumoId)) : [];
  const di = propuesta.design_intent && typeof propuesta.design_intent === 'object' ? propuesta.design_intent : {};
  const nodes = piezas.map((p, i) => {
    const role = p.semantic_role && String(p.semantic_role).trim() ? String(p.semantic_role).trim() : rolDe(p.nombre || p.insumoId || '');
    const qty = Math.max(1, Math.round(Number(p.cantidad ?? p.piezas) || 1));
    const geometry = (p.largoMM || p.anchoMM)
      ? { type: 'panel', length_mm: p.largoMM ?? null, width_mm: p.anchoMM ?? null, height_mm: null, thickness_mm: null }
      : { type: 'unknown', length_mm: null, width_mm: null, height_mm: null, thickness_mm: null };
    const conf = CONF_A_NUM[norm(p.confianza)] ?? 0.5;
    return {
      id: `n${i + 1}_${role}`,
      semantic_role: role,
      parent_id: null,                    // se resuelve abajo por nombre
      quantity: qty,
      material_intent: null,
      insumo_id: p.insumoId || null,
      geometry,
      orientation: null,
      processes: [],
      source: 'ai',
      confidence: conf,
      assumptions: [],
      // Pide confirmación si no hay material o si el LLM no está seguro.
      requires_confirmation: !p.insumoId || norm(p.confianza) === 'baja',
      _nombre: p.nombre || '',
      _parent: p.parent || '',
      _rel: norm(p.relacion),
      _relCon: p.relacion_con || '',
    };
  });
  // Índice nombre→id para resolver parent/relacion_con (que vienen como NOMBRES).
  const porNombre = new Map();
  for (const n of nodes) if (n._nombre) porNombre.set(norm(n._nombre), n.id);
  const relations = [];
  for (const n of nodes) {
    const pid = n._parent ? porNombre.get(norm(n._parent)) : null;
    if (pid && pid !== n.id) n.parent_id = pid;
    const tipo = RELACION_A_TIPO[n._rel];
    const to = n._relCon ? porNombre.get(norm(n._relCon)) : null;
    if (tipo && to && to !== n.id) relations.push({ type: tipo, from: n.id, to });
    delete n._nombre; delete n._parent; delete n._rel; delete n._relCon;
  }
  const productType = norm(di.product_type) === 'desconocido' || !di.product_type
    ? 'unknown'
    : di.product_type;
  const warnings = [];
  if (productType === 'unknown') warnings.push('Estructura ambigua: define el tipo de mueble.');
  const faltan = Array.isArray(di.missing_critical_data) ? di.missing_critical_data : [];
  return {
    schema_version: SCHEMA_VERSION,
    design_intent: {
      product_type: productType,
      description: propuesta.descripcionCliente || '',
      overall_dimensions: di.overall_dimensions ? { raw: String(di.overall_dimensions) } : {},
      quantity: Math.max(1, Number(di.module_count) || 1),
    },
    nodes,
    relations,
    missing_critical_data: faltan,
    warnings,
    assumptions: Array.isArray(di.assumptions) ? di.assumptions : [],
  };
}

// ---------------------------------------------------------------------------
//  PUENTE LEGACY: levanta un BOM SIN semántica (despieces viejos o manuales)
//  a un StructuralGraph. Determinista: NO llama al LLM. Rol vía rolDe();
//  relaciones inferidas por rol. Para despieces nuevos usa graphFromPropuesta.
// ---------------------------------------------------------------------------
export function graphFromBom(piezas = [], meta = {}) {
  const lista = (Array.isArray(piezas) ? piezas : []).filter((p) => p && (p.nombre || p.insumoId));
  const nodes = lista.map((p, i) => {
    const role = rolDe(p.nombre || p.insumoId || '');
    const qtyRaw = Number(p.piezas ?? p.cantidad) || 1;
    const qty = Math.max(1, Math.round(qtyRaw));
    const geometry = (p.largoMM || p.anchoMM)
      ? { type: 'panel', length_mm: p.largoMM ?? null, width_mm: p.anchoMM ?? null, height_mm: null, thickness_mm: null }
      : { type: 'unknown', length_mm: null, width_mm: null, height_mm: null, thickness_mm: null };
    return {
      id: `n${i + 1}_${role}`,
      semantic_role: role,
      parent_id: null,
      quantity: qty,
      material_intent: p._material || null,
      insumo_id: p.insumoId || null,
      geometry,
      orientation: null,
      processes: [],
      source: p._src || 'ai',
      confidence: p._confidence ?? 0.5,
      assumptions: [],
      requires_confirmation: !p.insumoId,
    };
  });
  const relations = [];
  const soportes = nodes.filter((n) => ROLES_SOPORTE.has(n.semantic_role));
  const superficies = nodes.filter((n) => ROLES_SUPERFICIE.has(n.semantic_role));
  for (const s of soportes) for (const sup of superficies) relations.push({ type: 'supports', from: s.id, to: sup.id });
  const cuerpo = nodes.find((n) => ['lateral', 'puerta', 'entrepano'].includes(n.semantic_role));
  if (cuerpo) for (const g of nodes.filter((n) => n.semantic_role === 'gaveta')) relations.push({ type: 'contains', from: cuerpo.id, to: g.id });

  const roles = new Set(nodes.map((n) => n.semantic_role));
  const ambiguo = !meta.descripcion && !meta.tipo && roles.has('cubierta') && roles.has('gaveta');
  return {
    schema_version: SCHEMA_VERSION,
    design_intent: {
      product_type: ambiguo ? 'unknown' : (meta.tipo || meta.producto || 'unknown'),
      description: meta.descripcion || '',
      overall_dimensions: meta.overall || {},
      quantity: Math.max(1, Number(meta.quantity) || 1),
    },
    nodes,
    relations,
    missing_critical_data: [],
    warnings: ambiguo ? ['Estructura ambigua: define el tipo de mueble (escritorio, credenza, mostrador…).'] : [],
    assumptions: [],
  };
}

// ---------------------------------------------------------------------------
//  Convierte un grafo CONFIRMADO en filas de despiece (BOM) con trazabilidad.
// ---------------------------------------------------------------------------
export function structuralGraphToBom(graph) {
  const v = validateStructuralGraph(graph);
  if (!v.ok) return { ok: false, code: v.code, issues: v.issues };
  const filas = graph.nodes.map((n) => ({
    nombre: etiqueta(n),
    insumoId: n.insumo_id || '',
    largoMM: n.geometry?.length_mm ?? null,
    anchoMM: n.geometry?.width_mm ?? null,
    piezas: n.quantity,
    graph_node_id: n.id,
    semantic_role: n.semantic_role,
    source: n.source || 'ai',
    confidence: n.confidence ?? null,
    requiere_confirmacion: !!n.requires_confirmation,
  }));
  return { ok: true, filas };
}

function etiqueta(n) {
  const r = n.semantic_role && n.semantic_role !== 'otro' ? n.semantic_role : 'pieza';
  return r.charAt(0).toUpperCase() + r.slice(1);
}
