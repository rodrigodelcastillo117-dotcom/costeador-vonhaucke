// ============================================================================
//  RENDER PROMPT COMPILER (Cocrear) · un solo lugar, versionado, que convierte un
//  ProductSpec EXACTO en el input del render. NO hay "prompt libre": la geometría
//  obligatoria (tipo, medidas, forma, conteos, features) sale del ProductSpec;
//  Voni/Render Director sólo elige cámara e intención. (contrato §4,§13-16,§23)
//
//  Produce { version, descripcion, materiales, medidas, render_spec, modo, aspecto,
//  expected } donde `render_spec` es el contrato tipado que el edge `generar-render`
//  ya consume (counts + finishes + locked_geometry) y `expected` es el MANIFIESTO
//  para validar fidelidad después (GEOMETRY/FINISH/FEATURE).
// ============================================================================
import { FAMILIA, colorMaterial } from './cocrear.js';

export const RENDER_PROMPT_VERSION = 'cocrear_render_v1';

const MAT_EN = { nogal: 'walnut wood', roble: 'oak wood', encino: 'oak-like wood', maple: 'maple wood', laminado: 'high-pressure laminate', solid_surface: 'solid surface (seamless matte mineral)', cristal: 'tempered glass', metal: 'powder-coated steel', piedra: 'stone' };
const TONO_EN = { oscuro: 'dark', claro: 'light' };
const PRODUCT_TYPE = {
  [FAMILIA.RECEPCION]: 'reception desk / front counter',
  [FAMILIA.ESCRITORIO]: 'executive desk',
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
  default: { view: 'three_quarter', elevation: 'eye_level', lens_mm: 50 },
};

function lockerDoors(spec) {
  const w = spec?.dimensiones?.ancho_mm || 1800, h = spec?.dimensiones?.alto_mm || 1950;
  const cols = Math.max(2, Math.min(8, Math.round(w / 350)));
  const rows = Math.max(3, Math.min(6, Math.round(h / 420)));
  return cols * rows;
}

// Deriva el render_spec tipado + manifiesto esperado desde el ProductSpec.
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
  const forma = feats.includes('curva') ? 'curved, soft radii' : 'clean straight lines';

  const mat0 = (spec?.materiales || [])[0] || { material: 'laminado', tono: null };
  const acab = (spec?.acabados || [])[0];
  const finishes = [];
  finishes.push(`body: ${[TONO_EN[mat0.tono], MAT_EN[mat0.material] || mat0.material].filter(Boolean).join(' ')} (hex ${colorMaterial(mat0.material, mat0.tono)})`);
  if (acab) finishes.push(`top/counter: ${[TONO_EN[acab.tono], 'finish'].filter(Boolean).join(' ')} (hex ${colorMaterial(mat0.material, acab.tono)})`);

  return {
    schema_version: 'render_spec_v1',
    product_type: PRODUCT_TYPE[fam] || 'furniture piece',
    dimensions: spec?.dimensiones || {},
    modules: 1,
    counts,
    materials: (spec?.materiales || []).map((m) => `${m.material}${m.tono ? ' ' + m.tono : ''}`),
    finishes,
    locked_geometry: true,
    visual_profile: dna?.tono === 'calido' ? 'warm_premium' : (dna?.nivel === 'premium' ? 'premium' : 'neutral'),
    camera: CAMARA[fam] || CAMARA.default,
    mandatory, forbidden, forma,
  };
}

// El compilador único: ProductSpec (+DNA) → input completo de render, versionado.
export function compileRenderPrompt(spec, dna = {}) {
  const rs = renderSpecDeProducto(spec, dna);
  const fam = spec?.familia || FAMILIA.DESCONOCIDA;
  const dims = spec?.dimensiones || {};
  const medidasTxt = [dims.ancho_mm && `${(dims.ancho_mm / 1000).toFixed(2)} m wide`, dims.alto_mm && `${(dims.alto_mm / 1000).toFixed(2)} m tall`, dims.prof_mm && `${(dims.prof_mm / 1000).toFixed(2)} m deep`].filter(Boolean).join(', ');

  const partes = [];
  partes.push(`A ${rs.visual_profile.replace('_', ' ')} ${rs.product_type}.`);
  partes.push(`GEOMETRY: ${rs.forma}.${medidasTxt ? ' Proportions: ' + medidasTxt + '.' : ''}`);
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
    // Ratio válido para el modelo de imagen (Gemini): no "landscape" libre.
    aspecto: '4:3',
    expected: { geometry: { product_type: rs.product_type, forma: rs.forma, ...rs.counts }, finish: rs.finishes, features: rs.mandatory },
    specHash: spec?.hash || null,
  };
}

// ¿El render guardado quedó OBSOLETO respecto al spec actual? (stale por hash, §17,§83)
export function renderStale(renderGuardado, specActual) {
  if (!renderGuardado?.specHash || !specActual?.hash) return false;
  return renderGuardado.specHash !== specActual.hash;
}
