// ============================================================================
//  RENDER SPEC v1 — contrato TIPADO entre la geometría confirmada y el render IA.
//
//  Flujo canónico:  SemanticProposal → StructuralGraph → RenderSpecV1 → generar-render
//  NO:              descripción → prompt bonito → Gemini decide la geometría.
//
//  El render puede decidir iluminación, textura, profundidad, fotografía. NO puede
//  decidir cantidades (módulos, asientos, cajones, puertas, patas, pantallas): esas
//  vienen BLOQUEADAS aquí (locked_geometry) desde el grafo. Esto NO lleva dinero.
// ============================================================================
import { familiaDeMaterial } from './materialMatch.js';

export const RENDER_SPEC_VERSION = 'render_spec_v1';

// visual_profile: el "lenguaje visual" del render según el contexto REAL del
// producto, para no contaminar todo con "oak + charcoal + oficina" (ese fue un
// bug). El orden importa: lo más específico primero.
const VISUAL_PROFILES = [
  ['airport_checkin', /aeropuerto|airport|check-?in|documentaci[oó]n|mostrador de document/i],
  ['pharmacy',        /farmacia|pharmacy|botica/i],
  ['military',        /armero|militar|gobierno|defensa|rack de arma|locker de seguridad/i],
  ['kiosk',           /kiosko|kiosco|t[oó]tem|self-?service|autoservicio/i],
  ['retail',          /retail|exhibidor|isla comercial|vitrina|g[oó]ndola|anaquel|tienda|stand|punto de venta/i],
  ['hotel',           /hotel|hoteler[ií]a|recepci[oó]n|lobby|lounge|cabecera|hospitality/i],
  ['corporate',       /oficina|corporativo|escritorio|bench|estaci[oó]n de trabajo|credenza|archivero|mampara|workstation/i],
];

/**
 * Deriva el perfil visual del contexto (tipo de producto + descripción).
 * @param {string} texto
 * @returns {string} airport_checkin|pharmacy|military|kiosk|retail|hotel|corporate|product_studio
 */
export function visualProfileFromContext(texto) {
  const t = String(texto || '');
  for (const [p, re] of VISUAL_PROFILES) if (re.test(t)) return p;
  return 'product_studio';
}

const sum = (nodes, roles) =>
  nodes.filter((n) => roles.includes(n.semantic_role)).reduce((a, n) => a + (Number(n.quantity) || 1), 0);

const matchNodes = (nodes, re) =>
  nodes.filter((n) => re.test(`${n.semantic_role || ''} ${n.insumo_id || ''}`)).reduce((a, n) => a + (Number(n.quantity) || 1), 0);

/**
 * Construye un RenderSpecV1 a partir de un StructuralGraph CONFIRMADO.
 * @param {object} graph  StructuralGraph (graphFromPropuesta/graphFromBom).
 * @param {object} [opts]
 * @param {string[]} [opts.materiales]  Nombres REALES de material (del BOM/catálogo) para texturas.
 * @param {string}   [opts.descripcion] Texto del cliente (para derivar visual_profile).
 * @param {boolean}  [opts.lockedGeometry=true] Si la geometría está confirmada (el render no la cambia).
 * @returns {object|null} RenderSpecV1, o null si el grafo no es utilizable.
 */
export function renderSpecFromGraph(graph, { materiales = [], descripcion = '', lockedGeometry = true } = {}) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;
  const di = graph.design_intent || {};
  const nodes = graph.nodes;

  const counts = {
    module_count: Math.max(1, Number(di.module_count ?? di.quantity) || 1),
    seat_count: Number(di.seat_count) || sum(nodes, ['asiento']),
    user_capacity: Number(di.user_capacity) || 0,
    drawer_count: sum(nodes, ['gaveta', 'cajon']),
    door_count: sum(nodes, ['puerta']),
    support_count: sum(nodes, ['pata', 'conector', 'estructura']),
    screen_count: matchNodes(nodes, /portamonitor|pantalla|monitor|screen/i),
    electrical_module_count: matchNodes(nodes, /electric|usb|byrne|contacto|charola|\bled\b/i),
  };

  const components = nodes.map((n) => ({
    role: n.semantic_role || 'otro',
    quantity: Number(n.quantity) || 1,
    insumo_id: n.insumo_id || null,
  }));
  const relationships = (graph.relations || []).map((r) => ({ type: r.type, from: r.from, to: r.to }));

  const mats = [...new Set((materiales || []).filter(Boolean))].slice(0, 10);
  const material_families = [...new Set(mats.map(familiaDeMaterial).filter(Boolean))];

  const profile = visualProfileFromContext(`${di.product_type || ''} ${descripcion || di.description || ''}`);

  return {
    schema_version: RENDER_SPEC_VERSION,
    graph_id: graph.schema_version || null,
    product_type: di.product_type || 'unknown',
    dimensions: di.overall_dimensions || {},
    modules: counts.module_count,
    components,
    relationships,
    counts,
    materials: mats,
    material_families,
    finishes: finishesFromMaterials(mats, material_families),
    visual_profile: profile,
    locked_geometry: !!lockedGeometry,
    camera: { view: 'three_quarter', elevation: 'eye_level', lens_mm: 50 },
  };
}

// Pistas de acabado por familia, para que el render use el material correcto
// (solid surface = mineral mate sin juntas, NO madera pintada). No decide color:
// eso viene en los nombres de material.
function finishesFromMaterials(materiales, familias) {
  const f = [];
  const fam = new Set(familias);
  if (fam.has('superficie_solida')) f.push('mineral matte seamless (solid surface, no wood grain)');
  if (fam.has('acero_inoxidable')) f.push('brushed stainless steel');
  if (fam.has('aluminio')) f.push('anodized aluminum');
  if (fam.has('metal_lamina')) f.push('powder-coated steel');
  if (fam.has('cristal')) f.push('tempered glass');
  if (fam.has('pet_acustico')) f.push('acoustic PET felt');
  if (fam.has('madera_solida') || fam.has('chapa_madera')) f.push('natural wood veneer');
  if (fam.has('melamina') || fam.has('laminado_hpl')) f.push('laminate surface');
  // Color explícito mencionado en los nombres (azul, negro, blanco…) para el prompt.
  const texto = (materiales || []).join(' ').toLowerCase();
  const color = ['azul', 'negro', 'blanco', 'gris', 'verde', 'rojo', 'walnut', 'nogal', 'roble', 'antracita']
    .find((c) => texto.includes(c));
  if (color) f.push(`color: ${color}`);
  return f;
}
