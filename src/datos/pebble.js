// ============================================================================
//  GENERADOR PEBBLE (Accents) · guía GE_Pebble. Mesas de apoyo orgánicas.
//  3 formas (Tipo Pebble, Elíptica, Ovoide) × 3 alturas (H35/45/55) × material
//  (melamina ABS, chapa CH, cristal satinado, mármol Carrara). Base metálica.
//  Claves ACCUBTP.. / ACCUBOV.. / ACBASMPTP..M.
// ============================================================================
import { aplicarColor } from './colorMelamina.js';
import { coloresDe } from './acabados.js';

const CANTO = 'tapacanto';
const PTR = 'ptr';

// Formas: dimensiones REALES de la cubierta (mm, guía p10-11) y clave base
const FORMAS = {
  pebble:   { nombre: 'Tipo Pebble', largo: 1000, ancho: 450, cvClave: 'ACCUBTP23', baseClave: 'ACBASMPTP' },
  eliptica: { nombre: 'Elíptica', largo: 1050, ancho: 350, cvClave: 'ACCUBEL35', baseClave: 'ACBASMPEL' },  // 1050×350×20, sufijo 35
  ovoide:   { nombre: 'Ovoide', largo: 600, ancho: 450, cvClave: 'ACCUBOV215', baseClave: 'ACBASMPOV' },     // sufijo 215
};
// Material de cubierta: insumo + sufijo de clave + si lleva canto (guía p11: 10 acabados)
const MATERIAL = {
  ABS:     { insumo: 'melamina-28', suf: 'ABS', canto: true, label: 'Melamina ABS' },
  TF:      { insumo: 'membrana-pvc', suf: 'TF', canto: true, label: 'Termoformado' },
  chapa:   { insumo: 'chapa-madera', suf: 'CH', canto: true, label: 'Chapa de madera' },
  walnut:  { insumo: 'chapa-walnut', suf: 'CHWB', canto: true, label: 'Chapa Walnut Burl' },
  ecolegno: { insumo: 'laminado', suf: 'HPELABS', canto: true, label: 'Ecolegno (HPL)' },
  cristal: { insumo: 'cristal-satinado', suf: 'CRS', canto: false, label: 'Cristal satinado' },
  cristalLam: { insumo: 'cristal-templado-12', suf: 'CRLB', canto: false, label: 'Cristal laminado blanco' },
  marmol:  { insumo: 'marmol', suf: 'MLC', canto: false, label: 'Mármol Carrara' },
  ecomarmol: { insumo: 'marmol', suf: 'ECM', canto: false, label: 'Ecomármol' },
  arabescato: { insumo: 'marmol-premium', suf: 'MLA', canto: false, label: 'Mármol Arabescato' },
};
// Base por altura (metal). Estimado de PTR por su geometría (guía p6).
const BASE_PTR = { H35: 2.0, H45: 2.4, H55: 2.8 };

const PEBBLE_PRODUCTOS_BASE = [
  {
    id: 'mesa', nombre: 'Mesa de apoyo',
    selects: [
      { key: 'forma', label: 'Forma', opciones: [{ id: 'pebble', label: 'Tipo Pebble' }, { id: 'eliptica', label: 'Elíptica' }, { id: 'ovoide', label: 'Ovoide' }] },
      { key: 'altura', label: 'Altura', opciones: [{ id: 'H35', label: 'H 35' }, { id: 'H45', label: 'H 45' }, { id: 'H55', label: 'H 55' }] },
    ],
    finishes: [{ id: 'ABS', label: 'Melamina ABS' }, { id: 'TF', label: 'Termoformado' }, { id: 'chapa', label: 'Chapa' }, { id: 'walnut', label: 'Walnut Burl' }, { id: 'ecolegno', label: 'Ecolegno' }, { id: 'cristal', label: 'Cristal satinado' }, { id: 'cristalLam', label: 'Cristal laminado' }, { id: 'marmol', label: 'Mármol Carrara' }, { id: 'ecomarmol', label: 'Ecomármol' }, { id: 'arabescato', label: 'Arabescato (elíptica)' }],
  },
];
// Colores reales de melamina 28mm (catálogo de acabados) para el selector —
// el finish 'ABS' (por default) usa melamina-28 como insumo base.
export const PEBBLE_PRODUCTOS = PEBBLE_PRODUCTOS_BASE.map((p) => ({ ...p, colores: coloresDe('melamina-28') }));

export function generarPebble(config) {
  const c = { forma: 'pebble', altura: 'H45', finish: 'ABS', ...config };
  const f = FORMAS[c.forma] || FORMAS.pebble;
  const m = MATERIAL[c.finish] || MATERIAL.ABS;
  const comp = [];
  const alturaNum = { H35: 35, H45: 45, H55: 55 }[c.altura] || 45;

  const cvClave = `${f.cvClave}${m.suf}`;
  comp.push({ insumoId: m.insumo, nombre: `Cubierta ${f.nombre} (${cvClave})`, cantidad: 1, largoMM: f.largo, anchoMM: f.ancho });
  if (m.canto) comp.push({ insumoId: CANTO, nombre: 'Canto perímetro', cantidad: (Math.PI * (f.largo + f.ancho) / 2) / 1000 });
  const baseClave = `${f.baseClave}${alturaNum}M`;
  comp.push({ insumoId: PTR, nombre: `Base metálica ${c.altura} (${baseClave})`, cantidad: BASE_PTR[c.altura] || 2.4 });

  return aplicarColor({
    producto: 'mesa',
    nombre: `Pebble ${f.nombre} ${c.altura} · ${m.label}`,
    componentes: comp,
    claves: [cvClave, baseClave],
    electricos: [],
    modoManoObra: 'horas',
    horas: { pm: 0.5, carpinteria: 3, pintura: 1, acabados: 2, tapiceria: 0 },
    factorDirecta: 35, factorIndirecta: 12,
    nota: 'Pebble: cubierta por forma/material + base metálica (estimada). Exacto con lista de MP (melamina/chapa/cristal/mármol) + sub-despiece de la base.',
  }, c);
}
