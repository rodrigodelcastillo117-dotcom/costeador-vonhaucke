// ============================================================================
//  programaBrief · CONTRATO MÍNIMO (P0.1 · #5): salida estructurada de
//  CotizadorIA/VONI → ProgramBrief que consume resolverPrograma.
//
//  NO es la inteligencia profunda de P0.7: sólo traduce los campos ESTRUCTURADOS
//  que el intérprete ya entrega (línea, modelo, dimensiones, capacidad, rol,
//  accesorios) al shape del brief. Regla dura: si el campo no viene, queda
//  AUSENTE (UNKNOWN) — jamás se inventa. Así "el usuario pidió Eclipse Drift"
//  llega al resolver y el Drift NO se sustituye por App LT en silencio.
// ============================================================================
const norm = (s = '') => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// "1200 x 1200" / "1.20 × 1.20 m" / "2420x830 mm" → {w,d} en mm, o null.
function dimsDe(it) {
  if (it && (Number(it.w) > 0 || Number(it.d) > 0)) return { w: Number(it.w) || null, d: Number(it.d) || null };
  const s = String(it?.dimensiones || it?.medidas || it?.dimensiones_mm || '');
  const m = s.match(/(\d[\d.,]*)\s*[x×]\s*(\d[\d.,]*)/i);
  if (!m) return null;
  const toMM = (t) => { const n = parseFloat(String(t).replace(/,/g, '')); return n < 100 ? Math.round(n * 1000) : Math.round(n); };
  const w = toMM(m[1]); const d = toMM(m[2]);
  return (w > 0 && d > 0) ? { w, d } : null;
}

// Clasifica el rol de un item por su campo estructural (rol/tipo/zona) y, sólo si
// falta, por palabras clave del nombre. Devuelve null si no hay señal (UNKNOWN).
function rolDeItem(it) {
  const explicito = norm(it?.rol || it?.tipo || it?.zona || '');
  const t = `${explicito} ${norm(it?.etiqueta || it?.producto || '')}`;
  if (/privad|direcc|directiv|ejecutiv|gerenc/.test(t)) return 'privado';
  if (/junta|consejo|meeting|board|sala de junta/.test(t)) return 'juntas';
  if (/recepci|lobby|mostrador/.test(t)) return 'recepcion';
  if (/gaveta|pedestal|cajonera|archiv/.test(t)) return 'guarda';
  if (/silla|asiento/.test(t)) return 'silla';
  if (/operativ|bench|banca|open|puesto|workstation|isla/.test(t)) return 'operativo';
  return null;
}

const modeloDe = (it) => (it?.modelo || it?.producto || it?.etiqueta || null) || null;
const lineaDe = (it) => it?.linea || it?.line || null;

/**
 * Construye un ProgramBrief para resolverPrograma desde los items estructurados.
 * Alineación por orden de aparición (privados[0], juntas[0], ...). Campos ausentes
 * quedan sin setear (UNKNOWN). Nunca inventa línea/modelo/dimensiones.
 */
export function briefDeItems(items = []) {
  const brief = { linea: null, operativosStorage: false, operativoSeatModel: null, privados: [], juntas: [] };
  for (const it of (Array.isArray(items) ? items : [])) {
    if (!it) continue;
    if (!brief.linea && lineaDe(it)) brief.linea = lineaDe(it);
    const rol = rolDeItem(it);
    if (rol === 'privado') {
      const entry = {};
      if (lineaDe(it)) entry.requested_line = lineaDe(it);
      const modelo = modeloDe(it);
      if (modelo) entry.requested_models = { anchor: modelo };
      const dims = dimsDe(it);
      if (dims) entry.requested_dimensions = dims;
      brief.privados.push(entry);
    } else if (rol === 'juntas') {
      const entry = {};
      if (lineaDe(it)) entry.requested_line = lineaDe(it);
      const dims = dimsDe(it);
      if (dims) entry.requested_dimensions = dims;
      brief.juntas.push(entry);
    } else if (rol === 'guarda') {
      brief.operativosStorage = true;        // el usuario pidió guardas explícitamente
    } else if (rol === 'silla' && /operativ|work|win|gamma/.test(norm(`${it.rol || ''} ${it.etiqueta || it.producto || ''}`))) {
      if (modeloDe(it)) brief.operativoSeatModel = modeloDe(it);
    }
  }
  return brief;
}

/** ¿El brief tiene alguna señal estructurada útil? (para no persistir ruido vacío) */
export function briefTieneSenal(brief) {
  if (!brief) return false;
  return !!(brief.linea || brief.operativosStorage || brief.operativoSeatModel
    || (brief.privados && brief.privados.some((p) => Object.keys(p).length))
    || (brief.juntas && brief.juntas.some((p) => Object.keys(p).length)));
}
