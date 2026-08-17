// ============================================================================
//  FOTOS DE SILLERÍA  ·  sacadas de los PRESUPUESTOS REALES de Von Haucke.
//
//  Rodrigo: "con las sillas, mínimo pon una foto de las sillas, en los
//  presupuestos venían". Venían, sí: los PDF traen la foto embebida en la
//  columna "Sillería" de cada módulo. Se extrajeron con pymupdf y —esto es lo
//  que importa— **se revisaron UNA POR UNA mirándolas**. La primera pasada
//  automática acertó 8 de 17: las otras 9 eran el logo de Von Haucke, mesas,
//  un archivero y hasta un plano de planta. Emparejar por posición en la página
//  NO basta, y un cuadro equivocado enfrente de un cliente es peor que un
//  cuadro vacío.
//
//  ⚠️ LA SILLERÍA NO TIENE LÍNEA: es comprada-revendida, así que no cabe en
//  `IMAGENES` (que va por línea Von Haucke). Se indexa por MODELO.
//
//  Para agregar más: `scratchpad/silleria/<MODELO>.jpg` + su nombre aquí, y
//  `bash deploy.sh sillas`.
// ============================================================================
const BASE = 'https://mtuvnbgljwbsaizjjgzs.supabase.co/storage/v1/object/public/app/silleria';

// Modelos con foto verificada a ojo. El nombre del archivo es el modelo.
export const SILLAS_CON_FOTO = new Set([
  'C4-EM-BNF', 'DELTA', 'DEX', 'ENERGY', 'GAMMA-E', 'GAMMA-TAP', 'KASIA',
  'LESSIL35001205', 'RE-NUTABA', 'RE-NUTABG', 'RE570CBT', 'RE570GT',
  'RE570RNBT', 'RE571C', 'RE571CT', 'SONATA-SB', 'WIN', 'WIN-CAB',
  // Estas dos las mandó Rodrigo a mano (2026-08-17): sus presupuestos no las
  // traían con foto clara. ALPHA es la directiva de malla con cabecera y base
  // de aluminio pulido; CONCERTO la de visita de 4 patas cromadas.
  // ⚠️ CONCERTO va por NOMBRE, no por clave: su clave es `CONCERTO-BNENRTAT`
  // —un código de variante de tapiz— y así la foto sirve para cualquier
  // CONCERTO que llegue de otro presupuesto con otra clave.
  'ALPHA', 'CONCERTO',
]);

const sinAcentos = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const GENERICAS = new Set(['SILLA', 'SILLON', 'SOFA', 'BANCO', 'BANQUETA', 'PUFF', 'VISITA', 'OPERATIVA',
  'EJECUTIVA', 'DIRECTIVA', 'PLEGABLE', 'CON', 'SIN', 'CABECERA', 'PLAZAS', 'INDIVIDUAL', 'WORK', 'LOUNGE',
  'TETRIS', 'BRAZOS', 'RODANTE', 'ALTO', 'BASE', 'PTS', 'MODELO', 'TAPIZADO']);

/**
 * El MODELO con el que se busca la foto: la clave del ERP si la hay, y si no la
 * palabra en mayúsculas del nombre (que es como vienen escritas en el banco).
 * ⚠️ El sufijo `-CAB`/`-CABF` NO se quita: la silla con cabecera es OTRA foto,
 * y se nota —WIN sale sin cabecera y WIN-CAB con ella—.
 */
export function modeloDeFoto(p) {
  if (!p) return null;
  if (p.clave && SILLAS_CON_FOTO.has(sinAcentos(p.clave))) return sinAcentos(p.clave);
  const palabras = sinAcentos(p.nombre).match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/g) || [];
  for (const v of palabras) {
    if (GENERICAS.has(v) || v.length < 3) continue;
    if (SILLAS_CON_FOTO.has(v)) return v;
  }
  return null;
}

/** La URL de la foto de esta silla, o null si todavía no tiene. */
export function fotoSilla(p) {
  const m = modeloDeFoto(p);
  return m ? `${BASE}/${m}.jpg` : null;
}
