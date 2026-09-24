// ============================================================================
//  MANIFIESTO DE IMÁGENES DE CATÁLOGO  (generado automáticamente)
//  Renders reales por LÍNEA y por TIPO de producto. Se muestran dentro del
//  generador al elegir el producto; los tipos SIN render caen al isométrico.
//  Archivos en bucket público 'app', prefijo: catalogo/<ruta>/<clave>.jpg
// ============================================================================
import { fotoSilla } from './imagenesSilleria.js';

const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/catalogo';
const u = (ruta, clave) => `${BASE}/${ruta}/${clave}.jpg`;

// Líneas con render de portada (hero.jpg).
export const HERO_RUTAS = new Set([
  'accents', 'alba', 'anteo', 'app', 'applt', 'arlequin', 'cirque', 'drift', 'eclipse', 'ergo4', 'feather', 'luna', 'modulor', 'mox', 'pac', 'pebble', 'privacy4', 'rio', 'spine', 'teamspace2', 'tetris', 'via', 'worklounge',
]);
export const heroLinea = (ruta) => (HERO_RUTAS.has(ruta) ? u(ruta, 'hero') : null);

// Imagen por (línea, id de producto). Solo tipos con render real.
export const IMAGENES = {
  alba: { bench: u('alba', 'bench'), escritorio: u('alba', 'escritorio'), mesa_juntas: u('alba', 'mesa_juntas'), olga: u('alba', 'olga'), teamspace: u('alba', 'teamspace') },
  anteo: { escritorio: u('anteo', 'escritorio'), guarda: u('anteo', 'guarda'), mesa_juntas: u('anteo', 'mesa_juntas') },
  app: { banca_doble: u('app', 'banca_doble'), escritorio: u('app', 'escritorio'), mesa_juntas: u('app', 'mesa_juntas') },
  applt: { banca_doble: u('applt', 'banca_doble'), banca_sencilla: u('applt', 'banca_sencilla'), escritorio: u('applt', 'escritorio'), escritorio_l: u('applt', 'escritorio_l'), mesa_circular: u('applt', 'mesa_circular'), mesa_juntas: u('applt', 'mesa_juntas') },
  arlequin: { pouf: u('arlequin', 'pouf') },
  cirque: { escritorio: u('cirque', 'escritorio'), estacion: u('cirque', 'estacion'), mesajuntas: u('cirque', 'mesajuntas'), recepcion: u('cirque', 'recepcion') },
  drift: { credenza: u('drift', 'credenza'), escritorio: u('drift', 'escritorio') },
  eclipse: { cantilever: u('eclipse', 'cantilever'), escritorio: u('eclipse', 'escritorio'), mesa_apoyo: u('eclipse', 'mesa_apoyo'), mesa_consejo: u('eclipse', 'mesa_consejo'), mesa_juntas: u('eclipse', 'mesa_juntas'), qvadrat: u('eclipse', 'qvadrat') },
  ergo4: { banca_doble: u('ergo4', 'banca_doble'), banca_sencilla: u('ergo4', 'banca_sencilla'), estacion_120: u('ergo4', 'estacion_120'), recepcion: u('ergo4', 'recepcion') },
  feather: { bench_doble: u('feather', 'bench_doble'), bench_sencillo: u('feather', 'bench_sencillo'), escritorio: u('feather', 'escritorio') },
  luna: { escritorio: u('luna', 'escritorio'), mesa_juntas: u('luna', 'mesa_juntas'), mesa_trabajo: u('luna', 'mesa_trabajo') },
  modulor: { archivero_h: u('modulor', 'archivero_h'), archivero_lateral: u('modulor', 'archivero_lateral'), armario: u('modulor', 'armario'), gaveta: u('modulor', 'gaveta'), librero: u('modulor', 'librero'), locker: u('modulor', 'locker'), torre: u('modulor', 'torre') },
  mox: { pedestal: u('mox', 'pedestal'), rodante: u('mox', 'rodante') },
  pac: { sillon: u('pac', 'sillon') },
  pebble: { mesa: u('pebble', 'mesa') },
  privacy4: { muro: u('privacy4', 'muro') },
  rio: { bench_curvo_doble: u('rio', 'bench_curvo_doble'), bench_curvo_sencillo: u('rio', 'bench_curvo_sencillo'), bench_recto_doble: u('rio', 'bench_recto_doble'), bench_recto_sencillo: u('rio', 'bench_recto_sencillo'), estacion: u('rio', 'estacion') },
  spine: { configuracion: u('spine', 'configuracion'), ducto: u('spine', 'ducto') },
  teamspace2: { soporte: u('teamspace2', 'soporte') },
  tetris: { sofa: u('tetris', 'sofa') },
  via: { archivero: u('via', 'archivero'), banca_doble: u('via', 'banca_doble'), escritorio: u('via', 'escritorio') },
  worklounge: { bricks: u('worklounge', 'bricks'), ding: u('worklounge', 'ding'), spoon: u('worklounge', 'spoon') },
};

// La foto de catálogo original (fotografía real de producto). Se conserva
// siempre: es la referencia con la que se generó el render de catálogo.
export const fotoProducto = (linea, prodId) => IMAGENES[linea]?.[prodId] || null;

// --- RENDER DE CATÁLOGO (generado con IA desde la foto real) -----------------
// Ver el bloque RENDER_IA / FICHA_RENDER más abajo (generado por el batch).
// Con USAR_RENDER_IA en false la app vuelve a las fotos originales de un golpe.
export const USAR_RENDER_IA = true;

export const imagenProducto = (linea, prodId) =>
  (USAR_RENDER_IA && renderIA(linea, prodId)) || fotoProducto(linea, prodId);

/**
 * La imagen de UNA PARTIDA de la cotización, venga de donde venga. Es la que
 * deben usar todas las pantallas.
 * ⚠️ Existe porque la SILLERÍA no tiene línea —es comprada-revendida— y todas
 * las pantallas preguntaban `pt.ruta ? imagenProducto(...) : null`. Con eso,
 * cada silla del banco salía como un cuadro gris en la propuesta del cliente,
 * en la paleta del acomodo y en el PDF. Ahora, si no hay línea, se busca su
 * foto de presupuesto por MODELO.
 */
export const imagenPartida = (pt) => (
  pt?.render
  || (pt?.ruta ? imagenProducto(pt.ruta, pt.productoId) : null)
  || fotoSilla(pt)
  || (pt?.ruta ? heroLinea(pt.ruta) : null)
);

// <<< RENDER_IA generado por scratchpad/aplicar_manifiesto.mjs — no editar a mano
// Render de catálogo por producto: se generó con Gemini usando la FOTO REAL como
// referencia y luego se encuadró igual para todos (fondo plano, misma escala).
const RENDER_IA_BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/render-ia';

export const RENDER_IA = {
  accents: ['acrilico', 'base_ajustable', 'base_mesa', 'carpeta', 'mesa_centro', 'mesa_laptop', 'mesa_lateral', 'organizador', 'perchero', 'pizarron', 'portamonitor', 'portapantalla', 'recycle', 'semimampara'],
  alba: ['bench', 'escritorio', 'mesa_alta', 'mesa_juntas', 'olga', 'olga_ligera', 'teamspace'],
  anteo: ['escritorio', 'guarda', 'mesa_apoyo', 'mesa_centro', 'mesa_juntas', 'mesa_regulable'],
  app: ['banca_doble', 'banca_sencilla', 'escritorio', 'escritorio_l', 'mesa_circular', 'mesa_juntas'],
  applt: ['banca_doble', 'banca_sencilla', 'escritorio', 'escritorio_l', 'mesa_circular', 'mesa_juntas'],
  arlequin: ['pouf'],
  cirque: ['banca', 'barra', 'credenza', 'escritorio', 'estacion', 'mesajuntas', 'recepcion'],
  drift: ['credenza', 'credenza_ind', 'escritorio', 'mesa_ajustable', 'pad_gabinete'],
  eclipse: ['cantilever', 'credenza', 'credenza_modulable', 'credenza_vertical', 'escritorio', 'gaveta', 'mesa_apoyo', 'mesa_consejo', 'mesa_juntas', 'mesa_regulable', 'qvadrat'],
  ergo4: ['banca_doble', 'banca_sencilla', 'estacion_120', 'recepcion'],
  feather: ['bench_doble', 'bench_sencillo', 'escritorio'],
  flex: ['banca_doble', 'biombo', 'escritorio', 'faldon'],
  luna: ['credenza', 'escritorio', 'mesa_juntas', 'mesa_trabajo'],
  modulor: ['archivero_h', 'archivero_lateral', 'armario', 'cojin', 'cubierta', 'gaveta', 'librero', 'locker', 'luna', 'maceta', 'torre', 'wally'],
  mox: ['pedestal', 'rodante'],
  pac: ['sillon'],
  pebble: ['mesa'],
  privacy4: ['lambrin', 'muro'],
  rio: ['bench_curvo_doble', 'bench_curvo_sencillo', 'bench_recto_doble', 'bench_recto_sencillo', 'estacion', 'mesa_juntas'],
  spine: ['biombo', 'configuracion', 'cubierta', 'ducto'],
  teamspace2: ['soporte'],
  tetris: ['sofa'],
  via: ['archivero', 'banca_doble', 'biombo', 'caja_electrica', 'escritorio', 'librero'],
  worklounge: ['bricks', 'ding', 'spoon', 'tank'],
};

// Medidas reales del producto tal como se ve en el render (configuración
// representativa), calculadas por el mismo motor que cotiza.
export const FICHA_RENDER = {
  'alba/bench': { w: 1200, d: 720, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 0.72 m de fondo × 0.73 m de alto' },
  'alba/escritorio': { w: 1498, d: 598, alto: 730, tipo: 'escritorio', medidas: '1.50 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'alba/mesa_juntas': { w: 1800, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.80 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'alba/olga': { w: 900, d: 900, alto: 740, tipo: 'juntas', medidas: '0.90 m de largo × 0.90 m de fondo × 0.74 m de alto' },
  'alba/teamspace': { w: 2420, d: 1200, alto: 740, tipo: 'juntas', medidas: '2.42 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'anteo/escritorio': { w: 2100, d: 900, alto: 730, tipo: 'escritorio', medidas: '2.10 m de largo × 0.90 m de fondo × 0.73 m de alto' },
  'anteo/guarda': { w: 600, d: 450, alto: 1200, tipo: 'guarda', medidas: '0.60 m de largo × 0.45 m de fondo × 1.20 m de alto' },
  'anteo/mesa_juntas': { w: 1200, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.20 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'app/banca_doble': { w: 3000, d: 1200, alto: 730, tipo: 'escritorio', medidas: '3.0 m de largo × 1.20 m de fondo × 0.73 m de alto' },
  'app/escritorio': { w: 1500, d: 600, alto: 730, tipo: 'escritorio', medidas: '1.50 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'applt/banca_doble': { w: 3000, d: 1200, alto: 730, tipo: 'escritorio', medidas: '3.0 m de largo × 1.20 m de fondo × 0.73 m de alto' },
  'applt/banca_sencilla': { w: 3000, d: 600, alto: 730, tipo: 'escritorio', medidas: '3.0 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'applt/escritorio': { w: 1500, d: 600, alto: 730, tipo: 'escritorio', medidas: '1.50 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'applt/escritorio_l': { w: 1800, d: 600, alto: 730, tipo: 'escritorio', medidas: '1.80 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'applt/mesa_circular': { w: 1500, d: 1500, alto: 740, tipo: 'juntas', medidas: '1.50 m de largo × 1.50 m de fondo × 0.74 m de alto' },
  'applt/mesa_juntas': { w: 1500, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.50 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'app/mesa_juntas': { w: 1500, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.50 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'arlequin/pouf': { w: 400, d: 400, alto: 450, tipo: 'asiento', medidas: '0.40 m de largo × 0.40 m de fondo × 0.45 m de alto' },
  'cirque/escritorio': { w: 1200, d: 600, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'cirque/estacion': { w: 3150, d: 600, alto: 730, tipo: 'escritorio', medidas: '3.15 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'cirque/mesajuntas': { w: 1200, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.20 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'cirque/recepcion': { w: 1800, d: 1000, alto: 730, tipo: 'escritorio', medidas: '1.80 m de largo × 1.0 m de fondo × 0.73 m de alto' },
  'drift/credenza': { w: 1773, d: 608, alto: 1100, tipo: 'guarda', medidas: '1.77 m de largo × 0.61 m de fondo × 1.10 m de alto' },
  'drift/escritorio': { w: 1800, d: 750, alto: 730, tipo: 'escritorio', medidas: '1.80 m de largo × 0.75 m de fondo × 0.73 m de alto' },
  'eclipse/cantilever': { w: 2400, d: 900, alto: 730, tipo: 'escritorio', medidas: '2.40 m de largo × 0.90 m de fondo × 0.73 m de alto' },
  'eclipse/escritorio': { w: 2400, d: 900, alto: 730, tipo: 'escritorio', medidas: '2.40 m de largo × 0.90 m de fondo × 0.73 m de alto' },
  'eclipse/mesa_apoyo': { w: 600, d: 600, alto: 550, tipo: 'mesa', medidas: '0.60 m de largo × 0.60 m de fondo × 0.55 m de alto' },
  'eclipse/mesa_consejo': { w: 1800, d: 750, alto: 740, tipo: 'juntas', medidas: '1.80 m de largo × 0.75 m de fondo × 0.74 m de alto' },
  'eclipse/mesa_juntas': { w: 1200, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.20 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'eclipse/qvadrat': { w: 1500, d: 1500, alto: 730, tipo: 'escritorio', medidas: '1.50 m de largo × 1.50 m de fondo × 0.73 m de alto' },
  'ergo4/banca_doble': { w: 900, d: 1225, alto: 730, tipo: 'escritorio', medidas: '0.90 m de largo × 1.23 m de fondo × 0.73 m de alto' },
  'ergo4/banca_sencilla': { w: 900, d: 1225, alto: 730, tipo: 'escritorio', medidas: '0.90 m de largo × 1.23 m de fondo × 0.73 m de alto' },
  'ergo4/estacion_120': { w: 3150, d: 1225, alto: 730, tipo: 'escritorio', medidas: '3.15 m de largo × 1.23 m de fondo × 0.73 m de alto' },
  'ergo4/recepcion': { w: 1800, d: 1225, alto: 730, tipo: 'escritorio', medidas: '1.80 m de largo × 1.23 m de fondo × 0.73 m de alto' },
  'feather/bench_doble': { w: 2400, d: 1200, alto: 730, tipo: 'escritorio', medidas: '2.40 m de largo × 1.20 m de fondo × 0.73 m de alto' },
  'feather/bench_sencillo': { w: 2400, d: 600, alto: 730, tipo: 'escritorio', medidas: '2.40 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'feather/escritorio': { w: 1500, d: 600, alto: 730, tipo: 'escritorio', medidas: '1.50 m de largo × 0.60 m de fondo × 0.73 m de alto' },
  'luna/escritorio': { w: 1500, d: 900, alto: 730, tipo: 'escritorio', medidas: '1.50 m de largo × 0.90 m de fondo × 0.73 m de alto' },
  'luna/mesa_juntas': { w: 2400, d: 1200, alto: 740, tipo: 'juntas', medidas: '2.40 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'luna/mesa_trabajo': { w: 1200, d: 1200, alto: 740, tipo: 'juntas', medidas: '1.20 m de largo × 1.20 m de fondo × 0.74 m de alto' },
  'modulor/archivero_h': { w: 750, d: 476, alto: 1100, tipo: 'guarda', medidas: '0.75 m de largo × 0.48 m de fondo × 1.10 m de alto' },
  'modulor/archivero_lateral': { w: 1200, d: 450, alto: 905, tipo: 'guarda', medidas: '1.20 m de largo × 0.45 m de fondo × 0.91 m de alto' },
  'modulor/armario': { w: 560, d: 450, alto: 1130, tipo: 'guarda', medidas: '0.56 m de largo × 0.45 m de fondo × 1.13 m de alto' },
  'modulor/gaveta': { w: 591, d: 570, alto: 1100, tipo: 'guarda', medidas: '0.59 m de largo × 0.57 m de fondo × 1.10 m de alto' },
  'modulor/librero': { w: 560, d: 399, alto: 1100, tipo: 'guarda', medidas: '0.56 m de largo × 0.40 m de fondo × 1.10 m de alto' },
  'modulor/locker': { w: 1200, d: 400, alto: 1100, tipo: 'guarda', medidas: '1.20 m de largo × 0.40 m de fondo × 1.10 m de alto' },
  'modulor/torre': { w: 560, d: 450, alto: 1130, tipo: 'guarda', medidas: '0.56 m de largo × 0.45 m de fondo × 1.13 m de alto' },
  'mox/pedestal': { w: 720, d: 456, alto: 1100, tipo: 'guarda', medidas: '0.72 m de largo × 0.46 m de fondo × 1.10 m de alto' },
  'mox/rodante': { w: 580, d: 460, alto: 1100, tipo: 'guarda', medidas: '0.58 m de largo × 0.46 m de fondo × 1.10 m de alto' },
  'pac/sillon': { w: 600, d: 600, alto: 450, tipo: 'asiento', medidas: '0.60 m de largo × 0.60 m de fondo × 0.45 m de alto' },
  'pebble/mesa': { w: 1000, d: 450, alto: 550, tipo: 'mesa', medidas: '1.0 m de largo × 0.45 m de fondo × 0.55 m de alto' },
  'privacy4/muro': { w: 600, d: 80, alto: 2176, tipo: 'mampara', medidas: '0.60 m de largo × 0.08 m de fondo × 2.18 m de alto' },
  'rio/bench_curvo_doble': { w: 900, d: 1200, alto: 730, tipo: 'escritorio', medidas: '0.90 m de largo × 1.20 m de fondo × 0.73 m de alto' },
  'rio/bench_curvo_sencillo': { w: 900, d: 827, alto: 730, tipo: 'escritorio', medidas: '0.90 m de largo × 0.83 m de fondo × 0.73 m de alto' },
  'rio/bench_recto_doble': { w: 900, d: 1200, alto: 730, tipo: 'escritorio', medidas: '0.90 m de largo × 1.20 m de fondo × 0.73 m de alto' },
  'rio/bench_recto_sencillo': { w: 900, d: 827, alto: 730, tipo: 'escritorio', medidas: '0.90 m de largo × 0.83 m de fondo × 0.73 m de alto' },
  'rio/estacion': { w: 1200, d: 1200, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 1.20 m de fondo × 0.73 m de alto' },
  'spine/configuracion': { w: 1200, d: 380, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 0.38 m de fondo × 0.73 m de alto' },
  'spine/ducto': { w: 1200, d: 380, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 0.38 m de fondo × 0.73 m de alto' },
  'teamspace2/soporte': { w: 800, d: 600, alto: 700, tipo: 'mueble', medidas: '0.80 m de largo × 0.60 m de fondo × 0.70 m de alto' },
  'tetris/sofa': { w: 600, d: 600, alto: 450, tipo: 'asiento', medidas: '0.60 m de largo × 0.60 m de fondo × 0.45 m de alto' },
  'via/archivero': { w: 1200, d: 610, alto: 1100, tipo: 'guarda', medidas: '1.20 m de largo × 0.61 m de fondo × 1.10 m de alto' },
  'via/banca_doble': { w: 1200, d: 610, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 0.61 m de fondo × 0.73 m de alto' },
  'via/escritorio': { w: 1200, d: 610, alto: 730, tipo: 'escritorio', medidas: '1.20 m de largo × 0.61 m de fondo × 0.73 m de alto' },
  'worklounge/bricks': { w: 500, d: 420, alto: 450, tipo: 'asiento', medidas: '0.50 m de largo × 0.42 m de fondo × 0.45 m de alto' },
  'worklounge/ding': { w: 1700, d: 700, alto: 450, tipo: 'asiento', medidas: '1.70 m de largo × 0.70 m de fondo × 0.45 m de alto' },
  'worklounge/spoon': { w: 900, d: 900, alto: 550, tipo: 'mesa', medidas: '0.90 m de largo × 0.90 m de fondo × 0.55 m de alto' },
  'app/escritorio_l': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'app/banca_sencilla': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'app/mesa_circular': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'via/librero': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'via/biombo': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'via/caja_electrica': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'rio/mesa_juntas': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'cirque/banca': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'cirque/barra': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'cirque/credenza': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'spine/biombo': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'spine/cubierta': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'alba/olga_ligera': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'alba/mesa_alta': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'eclipse/credenza_modulable': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'eclipse/credenza': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'eclipse/credenza_vertical': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'eclipse/gaveta': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'eclipse/mesa_regulable': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'drift/credenza_ind': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'drift/mesa_ajustable': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'drift/pad_gabinete': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'luna/credenza': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'flex/escritorio': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'flex/banca_doble': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'flex/biombo': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'flex/faldon': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'anteo/mesa_apoyo': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'anteo/mesa_centro': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'anteo/mesa_regulable': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'modulor/wally': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'modulor/luna': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'modulor/maceta': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'modulor/cubierta': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'modulor/cojin': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'worklounge/tank': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/acrilico': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/carpeta': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/mesa_centro': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/mesa_lateral': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/base_mesa': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/perchero': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/mesa_laptop': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/pizarron': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/portapantalla': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/semimampara': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/recycle': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/organizador': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/base_ajustable': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'accents/portamonitor': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
  'privacy4/lambrin': { w: 0, d: 0, alto: 0, tipo: '', medidas: '' },
};

// Solo cuenta como render real el que se generó A PARTIR de la foto real de
// ESA pieza. 51 de 118 productos nunca tuvieron foto propia; para esos, el
// batch generó la imagen con la foto de OTRO mueble hermano de la línea como
// referencia de estilo y le pidió a la IA inventar la forma desde el nombre y
// las medidas — no corresponde al mueble real (hallazgo de Edgar Serna en
// Eclipse: credenza, credenza_modulable, credenza_vertical, gaveta,
// mesa_regulable). Sin foto propia de respaldo, cae a heroLinea() vía
// imagenPartida() en vez de mostrar una pieza fabricada como si fuera real.
export const renderIA = (ruta, prodId) =>
  (RENDER_IA[ruta] || []).includes(prodId) && fotoProducto(ruta, prodId) ? `${RENDER_IA_BASE}/${ruta}/${prodId}.jpg` : null;

export const fichaRender = (ruta, prodId) => FICHA_RENDER[`${ruta}/${prodId}`] || null;
// >>> fin RENDER_IA
