// ============================================================================
//  DATOS SEMILLA - Catalogo de lineas, familias y muebles (master 8.4)
//  Tomado de vonhaucke.mx. Las lineas (confirmar) se cargaron por inferencia.
//  La estructura queda lista para agregar Via, Anteo, Flex, Gestell sin codigo.
// ============================================================================

// Familias del catalogo: cada una agrupa tipos de mueble
export const FAMILIAS = [
  { id: 'escritorios_operativos', nombre: 'Escritorios y operativos', muebles: ['escritorio', 'estacion_l', 'bench'] },
  { id: 'mesas', nombre: 'Mesas', muebles: ['mesa_trabajo', 'mesa_juntas', 'mesa_consejo', 'mesa_apoyo', 'teamspace'] },
  { id: 'guardas_archivo', nombre: 'Guardas y archivo', muebles: ['cajonera', 'credenza', 'archivero', 'archivo_lateral', 'torre'] },
  { id: 'recepciones_divisiones', nombre: 'Recepciones y divisiones', muebles: ['recepcion', 'mampara', 'divisor', 'muro', 'puerta'] },
  { id: 'lounge_asientos', nombre: 'Lounge y asientos', muebles: ['lounge', 'sillon', 'pouf'] },
];

// Nombres legibles de cada tipo de mueble
export const MUEBLES = {
  escritorio: 'Escritorio',
  estacion_l: 'Estacion en L',
  bench: 'Bench',
  mesa_trabajo: 'Mesa de trabajo',
  mesa_juntas: 'Mesa de juntas',
  mesa_consejo: 'Mesa de consejo',
  mesa_apoyo: 'Mesa de apoyo',
  teamspace: 'TeamSpace',
  cajonera: 'Cajonera',
  credenza: 'Credenza',
  archivero: 'Archivero',
  archivo_lateral: 'Archivo lateral',
  torre: 'Torre',
  recepcion: 'Recepcion',
  mampara: 'Mampara',
  divisor: 'Divisor',
  muro: 'Muro',
  puerta: 'Puerta',
  lounge: 'Lounge',
  sillon: 'Sillon',
  pouf: 'Pouf',
};

// Lineas: id, nombre, que es, y que muebles fabrica. gama para ordenar barato->caro.
export const LINEAS = [
  { id: 'app_lt', nombre: 'App LT', que: 'La mas economica', gama: 1, muebles: ['escritorio', 'estacion_l', 'bench', 'mesa_trabajo', 'cajonera'] },
  { id: 'app', nombre: 'App', que: 'Bench, escritorios y mesas', gama: 2, muebles: ['escritorio', 'estacion_l', 'bench', 'mesa_trabajo', 'mesa_juntas', 'cajonera'] },
  { id: 'feather', nombre: 'Feather', que: 'Estetica ligera', gama: 3, muebles: ['escritorio', 'estacion_l', 'bench', 'mesa_trabajo', 'mesa_juntas'] },
  { id: 'rio', nombre: 'Rio', que: 'Bench curvo con acometidas centrales', gama: 4, muebles: ['bench', 'estacion_l', 'escritorio', 'divisor'] },
  { id: 'spine_ii', nombre: 'Spine II', que: 'Ducto suspendido, altura regulable', gama: 5, muebles: ['bench', 'mesa_trabajo', 'divisor'] },
  { id: 'cirque', nombre: 'Cirque', que: '(confirmar)', gama: 5, confirmar: true, muebles: ['escritorio', 'bench', 'mesa_trabajo'] },
  { id: 'ergonova_4', nombre: 'Ergonova 4', que: 'Mamparas Sistema 4x4', gama: 4, muebles: ['mampara', 'bench', 'estacion_l', 'recepcion', 'divisor'] },
  { id: 'modulor', nombre: 'Modulor', que: 'Guardas y archivos', gama: 3, muebles: ['cajonera', 'archivero', 'archivo_lateral', 'torre', 'credenza'] },
  { id: 'alba', nombre: 'Alba', que: 'Ejecutivo, bases de metal', gama: 6, muebles: ['escritorio', 'bench', 'mesa_juntas', 'mesa_trabajo', 'credenza'] },
  { id: 'eclipse', nombre: 'Eclipse', que: 'Alta direccion, nogal y piel', gama: 9, muebles: ['escritorio', 'mesa_juntas', 'mesa_consejo', 'credenza', 'mesa_apoyo', 'sillon'] },
  { id: 'eclipse_drift', nombre: 'Eclipse Drift', que: 'Variante Eclipse', gama: 9, muebles: ['escritorio', 'mesa_juntas', 'credenza'] },
  { id: 'luna', nombre: 'Luna', que: 'Inoxidable y maderas', gama: 8, muebles: ['escritorio', 'mesa_juntas', 'mesa_consejo', 'credenza', 'mesa_apoyo'] },
  { id: 'privacy_4', nombre: 'Privacy 4', que: 'Muros de cristal', gama: 7, muebles: ['muro', 'puerta'] },
  { id: 'teamspace_ii', nombre: 'TeamSpace II', que: 'Mesa interactiva', gama: 7, muebles: ['teamspace', 'mesa_juntas'] },
  { id: 'tetris', nombre: 'Tetris', que: 'Work-lounge modular', gama: 5, muebles: ['lounge', 'pouf', 'divisor', 'mesa_apoyo'] },
  { id: 'pac', nombre: 'Pac', que: 'Sillon compacto 60 x 64', gama: 4, muebles: ['sillon'] },
  { id: 'arlequin', nombre: 'Arlequin', que: 'Descansa-pies y poufs', gama: 3, muebles: ['pouf'] },
  { id: 'pebbles', nombre: 'Pebbles', que: 'Mesas de apoyo, 3 alturas', gama: 3, muebles: ['mesa_apoyo'] },
];

// Que lineas fabrican un mueble dado, ordenadas de mas barata a mas cara (8.4 / 7.3)
export function lineasDeMueble(muebleId) {
  return LINEAS.filter((l) => l.muebles.includes(muebleId)).sort((a, b) => a.gama - b.gama);
}

// Reglas de linea (8.4): que quita o sustituye cada linea
export const REGLAS_LINEA = {
  app_lt: { quita: ['caja-electrica', 'usb-hdmi', 'ducto'], nota: 'Linea economica: sin caja electrica, USB ni ducto.' },
  eclipse: { sustituye: { 'melamina-19': 'chapa-madera' }, agrega: ['cerradura-electronica'], nota: 'Chapa de madera y cerradura electronica.' },
  eclipse_drift: { sustituye: { 'melamina-19': 'chapa-madera' }, nota: 'Chapa de madera.' },
  luna: { sustituye: { 'melamina-19': 'chapa-madera', 'lamina-20': 'inoxidable' }, nota: 'Chapa de madera y acero inoxidable.' },
};
