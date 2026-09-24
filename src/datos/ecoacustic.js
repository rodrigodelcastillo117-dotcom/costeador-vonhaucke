// ============================================================================
//  GENERADOR ECOACUSTIC — paneles acústicos de fieltro PET reciclado.
//  Von Haucke NO fabrica este panel: lo COMPRA ya terminado por SKU/tamaño a
//  Sonara (ver insumos.js, sección 'ecoacustic') y solo agrega instalación.
//  Por eso cada producto de esta línea es UN insumo comprado completo, no un
//  despiece de materia prima — muy distinto al resto de las líneas de
//  mobiliario (Eclipse, App LT, etc.), que sí fabrican desde cero.
//
//  Fuente de precios: "Lista_de_precios_Sonara_2025" (Rafa Carranza,
//  2026-08-24). Fuente de patrones/colores: catálogo "EcoAcustic VH" (70
//  pág.) y el PDF de colores del panel base. Las restricciones de color por
//  espesor/tipo (ej. 12mm solo en 3 grises) son las que documenta el propio
//  Sonara en su lista de precios — el catálogo de diseño de 70 páginas
//  muestra una regla ligeramente distinta (incluye Negro en 12mm); se siguió
//  la lista de precios por ser la fuente que de verdad se compra hoy.
//
//  factorDirecta/factorIndirecta son SOLO instalación (colgar/atornillar el
//  panel ya hecho) — no hay fabricación que costear. Son una estimación
//  conservadora; falta calibrar con horas reales de instalación.
// ============================================================================

export const COLORES_16 = [
  { id: 'gris', label: 'Gris' }, { id: 'gris-espacial', label: 'Gris Espacial' },
  { id: 'gris-plateado', label: 'Gris Plateado' }, { id: 'negro', label: 'Negro' },
  { id: 'camello', label: 'Camello' }, { id: 'amarillo', label: 'Amarillo' },
  { id: 'blanco', label: 'Blanco' }, { id: 'azul-cielo', label: 'Azul Cielo' },
  { id: 'azul-marino', label: 'Azul Marino' }, { id: 'naranja', label: 'Naranja' },
  { id: 'rojo', label: 'Rojo' }, { id: 'turquesa', label: 'Turquesa' },
  { id: 'azul-jade', label: 'Azul Jade' }, { id: 'violeta', label: 'Violeta' },
  { id: 'verde', label: 'Verde' }, { id: 'cafe', label: 'Café' },
];
const soloIds = (...ids) => COLORES_16.filter((c) => ids.includes(c.id));
const COLORES_12MM = soloIds('gris', 'gris-espacial', 'gris-plateado');
const COLORES_LINEA_12MM = soloIds('negro', 'gris', 'gris-espacial', 'gris-plateado');
const COLORES_FLEX = soloIds('negro', 'camello', 'gris', 'gris-espacial', 'gris-plateado');

const ESPESOR_9_12 = { key: 'espesor', label: 'Espesor', opciones: [{ id: '9', label: '9 mm' }, { id: '12', label: '12 mm' }] };

export const ECOACUSTIC_PRODUCTOS = [
  { id: 'panel_liso', nombre: 'Panel liso sin corte', selects: [ESPESOR_9_12], colores: COLORES_16 },
  { id: 'corte_linea', nombre: 'Panel con corte de línea (Mamparas / Celosía / Corte U / Corte V)', selects: [ESPESOR_9_12], colores: COLORES_16 },
  { id: 'shapes_30', nombre: 'Shapes 30 cm — paquete 4 (hexágono, triángulo, cuadrado, círculo)', colores: COLORES_16 },
  { id: 'shapes_60', nombre: 'Shapes 60 cm — paquete 4 (hexágono, triángulo, cuadrado, círculo)', colores: COLORES_16 },
  { id: 'shapes_rect_30', nombre: 'Shapes rectángulo 1.20 × 0.30 m — paquete de 4', colores: COLORES_16 },
  { id: 'shapes_rect_60', nombre: 'Shapes rectángulo 1.20 × 0.60 m — paquete de 4', colores: COLORES_16 },
  {
    id: 'custom', nombre: 'Custom (corte a la medida del proyecto)', colores: COLORES_16,
    selects: [
      { key: 'grado', label: 'Grado de complejidad', opciones: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C (solo 9 mm)' }, { id: 'D', label: 'D (solo 9 mm)' }] },
      ESPESOR_9_12,
    ],
  },
  { id: 'flex', nombre: 'Sonara Flex (precio por m²)', checks: [{ key: 'corte', label: 'Con corte' }], colores: COLORES_FLEX },
  { id: 'lambrin', nombre: 'Lambrín Sonara 1.20 × 2.40 m (tiras de MDF + chapa fórmica)' },
  { id: 'ranurado_v', nombre: 'Panel doble ranurado en V, cortes de línea' },
  { id: 'impreso', nombre: 'Panel con impresión 1.20 × 2.40 m, 9 mm', checks: [{ key: 'corte', label: 'Con corte recto' }] },
  {
    id: 'suspendido', nombre: 'Panel suspendido (colgante de techo, sin herrajes)',
    selects: [
      { key: 'modelo', label: 'Modelo', opciones: [{ id: 'sacc003', label: 'SACC003 (circular)' }, { id: 'sacc004', label: 'SACC004' }, { id: 'sacc005', label: 'SACC005' }, { id: 'sacc006', label: 'SACC006 (8 tiras 1.20×0.30, tamaño único)' }] },
      { key: 'tamano', label: 'Tamaño', opciones: [{ id: '120', label: '1.20 m' }, { id: '240', label: '2.40 m' }] },
    ],
    checks: [{ key: 'herraje', label: 'Agregar herraje de sujeción a techo' }],
  },
];

const PRECIO = {
  panel_liso: { 9: 'eco-panel-liso-9', 12: 'eco-panel-liso-12' },
  corte_linea: { 9: 'eco-corte-linea-9', 12: 'eco-corte-linea-12' },
  shapes_30: 'eco-shapes-30',
  shapes_60: 'eco-shapes-60',
  shapes_rect_30: 'eco-shapes-rect-30',
  shapes_rect_60: 'eco-shapes-rect-60',
  custom: {
    A: { 9: 'eco-custom-a-9', 12: 'eco-custom-a-12' },
    B: { 9: 'eco-custom-b-9', 12: 'eco-custom-b-12' },
    C: { 9: 'eco-custom-c-9' },
    D: { 9: 'eco-custom-d-9' },
  },
  lambrin: 'eco-lambrin',
  ranurado_v: 'eco-ranurado-v',
  impreso: { sinCorte: 'eco-impreso', conCorte: 'eco-impreso-corte' },
  suspendido: {
    sacc003: { 120: 'eco-susp-sacc003-120', 240: 'eco-susp-sacc003-240' },
    sacc004: { 120: 'eco-susp-sacc004-120', 240: 'eco-susp-sacc004-240' },
    sacc005: { 120: 'eco-susp-sacc005-120', 240: 'eco-susp-sacc005-240' },
    sacc006: { 120: 'eco-susp-sacc006', 240: 'eco-susp-sacc006' }, // tamaño único: 2.40 cae al mismo SKU
  },
};

// Colores permitidos por producto+variante — solo para validar/mostrar en la
// UI; el precio de Sonara NO varía por color dentro de lo permitido.
export function coloresDeEcoAcustic(prodId, config = {}) {
  if (prodId === 'flex') return COLORES_FLEX;
  const espesor = config.espesor || '9';
  if (prodId === 'panel_liso' || prodId === 'custom') return espesor === '12' ? COLORES_12MM : COLORES_16;
  if (prodId === 'corte_linea') return espesor === '12' ? COLORES_LINEA_12MM : COLORES_16;
  if (['shapes_30', 'shapes_60', 'shapes_rect_30', 'shapes_rect_60'].includes(prodId)) return COLORES_16;
  return null;
}

export function generarEcoAcustic(config) {
  const c = { producto: 'panel_liso', espesor: '9', grado: 'A', corte: false, herraje: false, modelo: 'sacc003', tamano: '120', color: 'gris', ...config };
  const comp = [];
  let nombre = '';
  let insumoId = null;

  if (c.producto === 'panel_liso') {
    insumoId = PRECIO.panel_liso[c.espesor] || PRECIO.panel_liso['9'];
    nombre = `EcoAcustic Panel liso ${c.espesor} mm · ${c.color}`;
  } else if (c.producto === 'corte_linea') {
    insumoId = PRECIO.corte_linea[c.espesor] || PRECIO.corte_linea['9'];
    nombre = `EcoAcustic Panel con corte de línea ${c.espesor} mm · ${c.color}`;
  } else if (['shapes_30', 'shapes_60', 'shapes_rect_30', 'shapes_rect_60'].includes(c.producto)) {
    insumoId = PRECIO[c.producto];
    nombre = `EcoAcustic ${ECOACUSTIC_PRODUCTOS.find((p) => p.id === c.producto).nombre} · ${c.color}`;
  } else if (c.producto === 'custom') {
    const porGrado = PRECIO.custom[c.grado] || PRECIO.custom.A;
    const espesorReal = porGrado[c.espesor] ? c.espesor : '9'; // C/D no tienen 12mm: cae a 9mm
    insumoId = porGrado[espesorReal];
    nombre = `EcoAcustic Custom grado ${c.grado}, ${espesorReal} mm · ${c.color}`;
  } else if (c.producto === 'flex') {
    insumoId = c.corte ? 'eco-flex-corte' : 'eco-flex';
    nombre = `EcoAcustic Flex${c.corte ? ' con corte' : ''} (por m²) · ${c.color}`;
  } else if (c.producto === 'lambrin') {
    insumoId = PRECIO.lambrin;
    nombre = 'EcoAcustic Lambrín 1.20 × 2.40 m';
  } else if (c.producto === 'ranurado_v') {
    insumoId = PRECIO.ranurado_v;
    nombre = 'EcoAcustic Panel doble ranurado en V';
  } else if (c.producto === 'impreso') {
    insumoId = c.corte ? PRECIO.impreso.conCorte : PRECIO.impreso.sinCorte;
    nombre = `EcoAcustic Panel impreso${c.corte ? ' con corte recto' : ''}`;
  } else if (c.producto === 'suspendido') {
    const porModelo = PRECIO.suspendido[c.modelo] || PRECIO.suspendido.sacc003;
    insumoId = porModelo[c.tamano] || porModelo['120'];
    nombre = `EcoAcustic Panel suspendido ${c.modelo.toUpperCase()} ${c.tamano === '240' ? '2.40' : '1.20'} m`;
  }

  if (!insumoId) { insumoId = PRECIO.panel_liso['9']; nombre = 'EcoAcustic Panel liso 9 mm'; }
  comp.push({ insumoId, nombre, cantidad: 1 });
  if (c.producto === 'suspendido' && c.herraje) {
    comp.push({ insumoId: 'eco-herraje-colgante', nombre: 'Herraje de sujeción a techo', cantidad: 1 });
  }

  return {
    producto: c.producto, nombre, componentes: comp, claves: [], electricos: [],
    modoManoObra: 'porcentaje', factorDirecta: 15, factorIndirecta: 8,
    nota: 'EcoAcustic: panel comprado ya terminado a Sonara (precio de lista real, 2026-08-24) — Von Haucke no lo fabrica, solo instala. factorDirecta/factorIndirecta (15%/8%) son una estimación conservadora de la instalación; falta calibrar con horas reales de instalación por tipo de panel.',
  };
}
