// ============================================================================
// RENDER PROMPT COMPILER (Cocrear) · ProductSpec → render contract.
// ============================================================================
import { FAMILIA, colorMaterial } from './cocrear.js';

export const RENDER_PROMPT_VERSION = 'cocrear_render_v2_layout_locked';

const MAT_EN = { nogal: 'walnut wood', roble: 'oak wood', encino: 'oak-like wood', maple: 'maple wood', laminado: 'high-pressure laminate', solid_surface: 'solid surface (seamless matte mineral)', cristal: 'tempered glass', metal: 'powder-coated steel', piedra: 'stone' };
const TONO_EN = { oscuro: 'dark', claro: 'light' };
const PRODUCT_TYPE = {
  [FAMILIA.RECEPCION]: 'reception desk / front counter',
  [FAMILIA.ESCRITORIO]: 'workstation / desk system',
  [FAMILIA.MESA]: 'meeting / conference table',
  [FAMILIA.LOCKER]: 'smart locker cabinet',
  [FAMILIA.DISPLAY]: 'retail display shelving',
  [FAMILIA.GUARDADO]: 'storage credenza',
  [FAMILIA.DESCONOCIDA]: 'furniture piece',
};
const CAMARA = {
  [FAMILIA.RECEPCION]: { view: 'three_quarter', elevation: 'eye_level', lens_mm: 35 },
  [FAMILIA.LOCKER]: { view: 'front_three_quarter', elevation: 'eye_level', lens_mm: 50 },
  [FAMILIA.MESA]: { view: 'three_quarter', elevation: 'slightly_above', lens_mm: 50 },
  [FAMILIA.ESCRITORIO]: { view: 'three_quarter', elevation: 'slightly_above', lens_mm: 45 },
  default: { view: 'three_quarter', elevation: 'eye_level', lens_mm: 50 },
};

const LAYOUT_TEXT = {
  layout_isla_continua: 'one continuous linear collaborative island: two continuous opposing work surfaces connected by one uninterrupted central technical spine; do not split it into detached desk pods',
  layout_modulos_dobles: 'a clearly modular double-workstation system: distinct two-person modules with visible separation joints, aligned along one shared central technical/biofilic spine; modules must read as repeatable and scalable',
  layout_hub_escultorico: 'a sculptural radial hub: work positions fan around one strong central architectural core; the composition must be radial/clustered, not two ordinary parallel desk rows',
};

function lockerDoors(spec) {
  const w = spec?.dimensiones?.ancho_mm || 1800, h = spec?.dimensiones?.alto_mm || 1950;
  const cols = Math.max(2, Math.min(8, Math.round(w / 350)));
  const rows = Math.max(3, Math.min(6, Math.round(h / 420)));
  return cols * rows;
}

export function renderSpecDeProducto(spec, dna = {}) {
  const fam = spec?.familia || FAMILIA.DESCONOCIDA;
  const feats = spec?.caracteristicas || [];
  const counts = { module_count: 1 };
  const mandatory = [];
  const forbidden = ['dimension lines', 'measurement text', 'people', 'logos', 'watermark'];

  if (fam === FAMILIA.LOCKER) { counts.door_count = lockerDoors(spec); mandatory.push(`${counts.door_count} locker doors`); }
  if (spec?.capacidad?.personas) counts.user_capacity = spec.capacidad.personas;
  if (feats.includes('iluminacion_integrada')) { counts.electrical_module_count = (counts.electrical_module_count || 0) + 1; mandatory.push('integrated LED lighting strip (visible, softly glowing)'); }
  if (feats.includes('carga_inalambrica')) { counts.electrical_module_count = (counts.electrical_module_count || 0) + 1; mandatory.push('wireless charging pad on the top surface'); }
  if (feats.includes('cajones')) mandatory.push('drawers on the front');
  if (feats.includes('electronica')) { counts.screen_count = 1; mandatory.push('a control screen on the front'); }
  if (feats.includes('cerraduras')) mandatory.push('visible locks on the doors');
  if (feats.includes('ventilacion')) mandatory.push('ventilation grilles');
  if (feats.includes('flotante')) mandatory.push('recessed base so the body looks floating (no visible legs)');
  if (feats.includes('jardinera_integrada')) mandatory.push('integrated living planter with real green vegetation, structurally part of the furniture concept');
  if (feats.includes('electrificacion_integrada')) mandatory.push('fully concealed integrated power and cable management');
  if (feats.includes('divisores')) mandatory.push('removable privacy dividers at the work positions');
  if (feats.includes('acustica')) mandatory.push('acoustic divider panels with premium textile finish');

  const layout = feats.find(f => LAYOUT_TEXT[f]) || null;
  if (layout) {
    counts.layout = layout;
    mandatory.unshift(`LAYOUT LOCK: ${LAYOUT_TEXT[layout]}`);
    if (layout === 'layout_modulos_dobles' && counts.user_capacity) counts.module_count = Math.ceil(counts.user_capacity / 2);
  }

  const forma = feats.includes('curva') ? 'curved, soft radii' : 'clean straight lines';
  const mat0 = (spec?.materiales || [])[0] || { material: 'laminado', tono: null };
  const acab = (spec?.acabados || [])[0];
  const finishes = [];
  finishes.push(`body: ${[TONO_EN[mat0.tono], MAT_EN[mat0.material] || mat0.material].filter(Boolean).join(' ')} (hex ${colorMaterial(mat0.material, mat0.tono)})`);
  if (acab) finishes.push(`top/counter: ${[TONO_EN[acab.tono], 'finish'].filter(Boolean).join(' ')} (hex ${colorMaterial(mat0.material, acab.tono)})`);

  return {
    schema_version: 'render_spec_v2',
    product_type: PRODUCT_TYPE[fam] || 'furniture piece',
    dimensions: spec?.dimensiones || {},
    modules: counts.module_count,
    counts,
    layout,
    layout_instruction: layout ? LAYOUT_TEXT[layout] : null,
    materials: (spec?.materiales || []).map((m) => `${m.material}${m.tono ? ' ' + m.tono : ''}`),
    finishes,
    locked_geometry: true,
    visual_profile: dna?.tono === 'calido' ? 'warm_premium' : (dna?.nivel === 'premium' ? 'premium' : 'neutral'),
    camera: CAMARA[fam] || CAMARA.default,
    mandatory, forbidden, forma,
  };
}

export function compileRenderPrompt(spec, dna = {}) {
  const rs = renderSpecDeProducto(spec, dna);
  const fam = spec?.familia || FAMILIA.DESCONOCIDA;
  const dims = spec?.dimensiones || {};
  const medidasTxt = [dims.ancho_mm && `${(dims.ancho_mm / 1000).toFixed(2)} m wide`, dims.alto_mm && `${(dims.alto_mm / 1000).toFixed(2)} m tall`, (dims.prof_mm || dims.fondo_mm) && `${((dims.prof_mm || dims.fondo_mm) / 1000).toFixed(2)} m deep`].filter(Boolean).join(', ');

  const partes = [];
  partes.push(`A ${rs.visual_profile.replace('_', ' ')} ${rs.product_type}.`);
  partes.push(`GEOMETRY: ${rs.forma}.${medidasTxt ? ' Proportions: ' + medidasTxt + '.' : ''}`);
  if (rs.layout_instruction) partes.push(`SELECTED CONCEPT GEOMETRY — MUST MATCH: ${rs.layout_instruction}. This layout is canonical and cannot be replaced with another workstation arrangement.`);
  if (rs.materials.length) partes.push(`MATERIALS: ${rs.finishes.join('; ')}. Physically-based, realistic; do not substitute species or color.`);
  if (rs.mandatory.length) partes.push(`MANDATORY FEATURES (must appear exactly): ${rs.mandatory.join('; ')}.`);
  partes.push(`CONTEXT: ${dna?.tono === 'calido' ? 'warm, premium, architectural' : 'premium, architectural'} Von Haucke style. Editorial furniture photography.`);
  partes.push(`FORBIDDEN: ${rs.forbidden.join(', ')}.`);

  return {
    version: RENDER_PROMPT_VERSION,
    descripcion: partes.join(' '),
    materiales: rs.materials,
    medidas: medidasTxt,
    tipo: fam,
    render_spec: rs,
    modo: 'render',
    aspecto: '4:3',
    expected: { geometry: { product_type: rs.product_type, forma: rs.forma, ...rs.counts }, finish: rs.finishes, features: rs.mandatory },
    specHash: spec?.hash || null,
  };
}

export function renderStale(renderGuardado, specActual) {
  if (!renderGuardado?.specHash || !specActual?.hash) return false;
  return renderGuardado.specHash !== specActual.hash;
}

export function diffFidelidad(expViejo = {}, expNuevo = {}) {
  const cambios = [];
  const g0 = expViejo.geometry || {}, g1 = expNuevo.geometry || {};
  for (const k of new Set([...Object.keys(g0), ...Object.keys(g1)])) {
    if (String(g0[k] ?? '') !== String(g1[k] ?? '')) {
      cambios.push({ campo: k === 'product_type' ? 'tipo' : k === 'forma' ? 'forma' : k, de: g0[k], a: g1[k] });
    }
  }
  const f0 = (expViejo.finish || []).join(' | '), f1 = (expNuevo.finish || []).join(' | ');
  if (f0 !== f1) cambios.push({ campo: 'acabado', de: f0, a: f1 });
  const ft0 = [...(expViejo.features || [])].sort().join(' | ');
  const ft1 = [...(expNuevo.features || [])].sort().join(' | ');
  if (ft0 !== ft1) cambios.push({ campo: 'features', de: ft0, a: ft1 });
  return cambios;
}

export function verificarFidelidad(renderGuardado, specActual, dna = {}) {
  if (!renderGuardado?.expected) {
    return { vigente: renderStale(renderGuardado, specActual) ? false : null, cambios: [], motivo: 'sin manifiesto de fidelidad' };
  }
  const nuevo = compileRenderPrompt(specActual, dna).expected;
  const cambios = diffFidelidad(renderGuardado.expected, nuevo);
  return { vigente: cambios.length === 0, cambios, stale: renderStale(renderGuardado, specActual) };
}
