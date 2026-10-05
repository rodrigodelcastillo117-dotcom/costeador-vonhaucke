import { interpretarIntent, DIMS_DEFAULT, FAMILIA } from './cocrear.js';

const normal = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const nPersonas = (s) => {
  const x = normal(s);
  const m = x.match(/(?:para\s*)?(\d{1,2})\s*(?:lugares|personas|usuarios|puestos|estaciones)/) || x.match(/(\d{1,2})\s*(?:pax|p)/);
  return m ? Math.max(1, Math.min(24, Number(m[1]))) : null;
};

export const FEATURES_COCREAR = [
  ['jardinera_integrada', 'Jardinera integrada'],
  ['electrificacion_integrada', 'Electrificación'],
  ['divisores', 'Divisores'],
  ['acustica', 'Acústica'],
  ['iluminacion_integrada', 'Iluminación'],
  ['cajones', 'Cajones'],
  ['cerraduras', 'Cerraduras'],
  ['ruedas', 'Ruedas'],
  ['carga_inalambrica', 'Carga inalámbrica'],
  ['electronica', 'Pantalla / electrónica'],
];

export function prepararIntentCocrear(brief, base = null) {
  const texto = String(brief || '').trim();
  const it = base ? structuredClone(base) : interpretarIntent(texto || 'producto especial');
  const x = normal(texto);
  it._brief = texto;
  it._modo_cocrear = true;

  const operativo = /operativ|workstation|bench|estacion|puesto|isla de trabajo|mesa de trabajo/.test(x);
  const capacidad = nPersonas(texto) || Number(it.capacidad_personas || it.capacidad?.personas || 0) || null;
  if (operativo) it.familia = FAMILIA.ESCRITORIO;
  if (capacidad) { it.capacidad_personas = capacidad; it.capacidad = { ...(it.capacidad || {}), personas: capacidad }; }

  const dd = DIMS_DEFAULT[it.familia] || DIMS_DEFAULT[FAMILIA.DESCONOCIDA];
  let dims = { ...dd, ...(it.dimensiones || {}) };
  if (operativo) {
    const puestosPorLado = capacidad ? Math.ceil(capacidad / 2) : 3;
    dims = {
      ...dims,
      ancho_mm: Math.max(dims.ancho_mm || 0, puestosPorLado * 1200),
      prof_mm: Math.max(dims.prof_mm || dims.fondo_mm || 0, 1400),
      fondo_mm: Math.max(dims.prof_mm || dims.fondo_mm || 0, 1400),
      alto_mm: 750,
    };
    it.tipologia_cocrear = 'operativo_colaborativo';
  }

  const features = new Set(it.caracteristicas || []);
  if (/jardinera|maceta|plantas|vegetacion|biofil/.test(x)) features.add('jardinera_integrada');
  if (/electrific|contactos|enchufe|usb|energia|cableado|cable/.test(x)) features.add('electrificacion_integrada');
  if (/divisor|privacidad|separador|panel/.test(x)) features.add('divisores');
  if (/acustic|sonido|ruido/.test(x)) features.add('acustica');
  if (/ilumin|led|luz integrada/.test(x)) features.add('iluminacion_integrada');
  if (/ruedas|movil|movible/.test(x)) features.add('ruedas');

  if (/acero/.test(x)) {
    const mats = [...(it.materiales || [])];
    if (!mats.some((m) => m?.material === 'metal')) mats.push({ material: 'metal', tono: 'oscuro', uso: 'estructura/acento' });
    it.materiales = mats.length ? mats : [{ material: 'metal', tono: 'oscuro' }];
  }

  it.dimensiones = dims;
  it.caracteristicas = [...features];
  return it;
}

export function resumenIdeaCocrear(intent, brief='') {
  const cap = intent?.capacidad_personas ? `${intent.capacidad_personas} usuarios` : 'capacidad por definir';
  const d = intent?.dimensiones || {};
  const dims = [d.ancho_mm, (d.prof_mm || d.fondo_mm), d.alto_mm].every(Number.isFinite)
    ? `${(d.ancho_mm/1000).toFixed(2)} × ${((d.prof_mm || d.fondo_mm)/1000).toFixed(2)} × ${(d.alto_mm/1000).toFixed(2)} m conceptuales`
    : 'dimensiones por desarrollar';
  const feats = (intent?.caracteristicas || []).map((f) => FEATURES_COCREAR.find(([k]) => k === f)?.[1] || f).slice(0, 5);
  return {
    necesidad: String(brief || intent?._brief || '').trim(),
    tipologia: intent?.tipologia_cocrear === 'operativo_colaborativo' ? 'Sistema operativo colaborativo' : String(intent?.familia || 'Producto especial'),
    capacidad: cap,
    envolvente: dims,
    claves: feats,
  };
}

export function conceptosCocrear(intent) {
  const operativo = intent?.tipologia_cocrear === 'operativo_colaborativo';
  const jardinera = (intent?.caracteristicas || []).includes('jardinera_integrada');
  if (operativo) {
    return [
      { id: 'A', nombre: 'Isla continua', subtitulo: 'Limpia · eficiente · fabricable', descripcion: `Una sola pieza visual para ${intent.capacidad_personas || 6} usuarios, con espina central${jardinera ? ' y jardinera longitudinal' : ''}.`, add: ['electrificacion_integrada'] },
      { id: 'B', nombre: 'Módulos dobles', subtitulo: 'Flexible · escalable · mantenible', descripcion: `Módulos de dos puestos que comparten un centro técnico${jardinera ? ' biofílico' : ''}; permite crecer o reconfigurar.`, add: ['electrificacion_integrada', 'divisores'] },
      { id: 'C', nombre: 'Hub escultórico', subtitulo: 'WOW · premium · protagonista', descripcion: `Sistema colaborativo con estructura central de acero${jardinera ? ', vegetación integrada' : ''}, cableado oculto y una presencia más arquitectónica.`, add: ['electrificacion_integrada', 'iluminacion_integrada'] },
    ];
  }
  const fam = String(intent?.familia || 'producto');
  return [
    { id: 'A', nombre: 'Esencial', subtitulo: 'Claro · funcional · directo', descripcion: `Una interpretación limpia del ${fam}, priorizando fabricación y uso.`, add: [] },
    { id: 'B', nombre: 'Integrado', subtitulo: 'Premium · resuelto · completo', descripcion: 'Integra tecnología, guardado y detalles para elevar la experiencia sin perder fabricabilidad.', add: ['electrificacion_integrada'] },
    { id: 'C', nombre: 'Signature', subtitulo: 'WOW · diferenciador · Von Haucke', descripcion: 'Una versión más expresiva del concepto, con presencia arquitectónica y detalles protagonistas.', add: ['iluminacion_integrada'] },
  ];
}

export function aplicarConceptoCocrear(intent, concepto) {
  const next = structuredClone(intent);
  const features = new Set(next.caracteristicas || []);
  for (const f of concepto?.add || []) features.add(f);
  next.caracteristicas = [...features];
  next._concepto = concepto?.id || null;
  next._concepto_nombre = concepto?.nombre || null;
  return next;
}
