// ============================================================================
//  PRECIOS VIGENTES — de dónde saca el costeo el precio de cada insumo.
// ----------------------------------------------------------------------------
//  Antes, al entrar con usuario, la app REEMPLAZABA todo su catálogo con la
//  copia guardada en `config` (92 insumos del 2026-08-11, varios con la unidad
//  vieja: el MDF por m² y sin fracción de hoja). Así se perdían los ~170 insumos
//  restantes y se costeaba con precios viejos.
//
//  Ahora, para quien ve costos (Dirección/Diseño):
//    1. La FORMA de cada insumo (unidad, formato, fracción, merma) sale de la
//       semilla del código.
//    2. El PRECIO sale del catálogo de la base (`catalogo_vigente`, detrás de
//       RLS), siempre que la unidad de la base sea la misma que la del código.
//    3. Un precio editado en la pantalla Precios (queda en `config` con su
//       fecha) gana solo si es MÁS NUEVO que el de la base y trae la misma unidad.
//    4. Un insumo que solo existe en `config` (alta manual) se conserva tal cual.
//    5. Un insumo que solo existe en la base (alta desde compras) entra con su
//       unidad de compra. Si es tablero o lámina, toma el formato de su familia
//       en la app (ver formatoParaAlta): la melamina, el MDF y el aglomerado
//       se compran en 1.22 × 2.44 (Rodrigo, 2026-10-07) y se costean por
//       fracción de hoja, nunca por hoja completa.
//
//  Al vendedor no se le aplica nada de esto: sigue recibiendo la config
//  sanitizada del servidor, sin precios.
// ============================================================================

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const fecha = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');

/**
 * @param {Record<string, object>} semilla   mapa id -> insumo del código
 * @param {Record<string, object>} compartido  config.datos.insumos (puede venir vacío)
 * @param {Array<object>} vigentes  filas de `precios_vigentes_costeo()`:
 *   { insumo_id, nombre, seccion, precio, unidad_costeo, estado, certificable, fuente, vigente_desde }
 * @returns {{ insumos: Record<string, object>, resumen: object }}
 */
export function fusionarInsumos(semilla, compartido = {}, vigentes = []) {
  const insumos = { ...semilla };
  const resumen = { desdeBD: [], altasDesdeBD: [], unidadDistinta: [], sinFormaEnCodigo: [], editadosEnApp: [], soloEnConfig: [], formatoPorConfirmar: [] };

  for (const f of vigentes || []) {
    const id = f?.insumo_id;
    const base = id ? insumos[id] : null;
    if (!base) {
      // Alta hecha en la base (p. ej. material de compras que el código no
      // tiene): se costea por su unidad de compra, sin formato ni fracción.
      const precio = num(f?.precio);
      if (!id || !f.unidad_costeo || !(precio > 0)) { if (id) resumen.sinFormaEnCodigo.push(id); continue; }
      const fmt = formatoParaAlta(f.nombre, f.unidad_costeo, semilla);
      insumos[id] = {
        id, nombre: f.nombre || id, seccion: f.seccion || 'consumibles', unidad: f.unidad_costeo,
        clase: 'directa', mermaCorte: 0, inventario: false, veta: false, fraccion: false, proveedor: '',
        ...(fmt ? fmt.forma : {}),
        precio, precioBase: precio, actualizado: fecha(f.vigente_desde), fuente: f.fuente || '',
        estadoPrecio: f.estado || null, certificable: !!f.certificable, origenPrecio: 'catalogo_bd', altaEnBD: true,
        ...(fmt ? { formatoOrigen: fmt.origen, formatoConfirmado: fmt.confirmado } : {}),
      };
      if (fmt && !fmt.confirmado) resumen.formatoPorConfirmar.push({ id, origen: fmt.origen });
      resumen.altasDesdeBD.push(id);
      continue;
    }
    if (f.unidad_costeo && f.unidad_costeo !== base.unidad) {
      resumen.unidadDistinta.push({ id, codigo: base.unidad, bd: f.unidad_costeo });
      continue;
    }
    const precio = num(f.precio);
    if (!(precio > 0)) continue;
    insumos[id] = {
      ...base,
      precio,
      precioBase: precio,
      actualizado: fecha(f.vigente_desde) || base.actualizado,
      fuente: f.fuente || base.fuente,
      estadoPrecio: f.estado || null,
      certificable: !!f.certificable,
      origenPrecio: 'catalogo_bd',
    };
    resumen.desdeBD.push(id);
  }

  for (const [id, c] of Object.entries(compartido || {})) {
    if (!c || typeof c !== 'object') continue;
    const base = insumos[id];
    if (!base) { insumos[id] = c; resumen.soloEnConfig.push(id); continue; }
    const precio = num(c.precio);
    if (c.unidad !== base.unidad || !(precio > 0)) continue;
    if (fecha(c.actualizado) > fecha(base.actualizado)) {
      insumos[id] = { ...base, precio, precioBase: precio, actualizado: fecha(c.actualizado), origenPrecio: 'editado_en_app' };
      resumen.editadosEnApp.push(id);
    }
  }

  return { insumos, resumen };
}

const sinAcentos = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const VACIAS = new Set(['cuanto', 'cuesta', 'cuestan', 'precio', 'precios', 'costo', 'costos', 'vale', 'valen', 'del', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'que', 'hoja', 'por', 'kg', 'metro', 'materia', 'prima', 'material', 'a', 'en', 'y', 'mm']);

/** Busca filas de precios vigentes por palabras de la consulta (todas deben aparecer). */
export function buscarPreciosMaterial(filas = [], consulta = '', limite = 8) {
  const palabras = sinAcentos(consulta).split(/[^a-z0-9]+/).filter((w) => w && !VACIAS.has(w));
  if (!palabras.length) return [];
  return (filas || [])
    .filter((f) => { const t = sinAcentos(`${f?.insumo_id} ${f?.nombre}`); return palabras.every((w) => t.includes(w)); })
    .slice(0, limite)
    .map((f) => ({ id: f.insumo_id, nombre: f.nombre || f.insumo_id, unidad: f.unidad_costeo, precio: Number(f.precio),
      vigente_desde: f.vigente_desde, estado: f.estado, fuente: f.fuente }));
}

// ---------------------------------------------------------------------------
//  Formato de compra para un insumo dado de alta solo en la base. Se aprende de
//  la app: misma forma que su familia en la semilla. Devuelve null si no es
//  hoja (herrajes, cantos por metro, piezas a medida…).
// ---------------------------------------------------------------------------
const TABLERO_RX = /\b(MELAMIN\w*|MDF|MDP|AGLOMERADO|TRIPLAY|LAMINADO PLASTICO|PANEL RANURADO|ENCHAPADO|SUPERFICIE SOLIDA|ESPUMADO PVC|ACRILICO|CARTON|ESPUMA|MADERA SOLIDA)\b/;
// Piezas que ya vienen cortadas a medida: se compran y se cobran por pieza.
const A_MEDIDA_RX = /^CORTE DE|CORTADO CONFORME|PARA COJIN|PARA ARLEQUIN|MOLDEADA/;
const PULGADAS = { '1/8': 3.175, '3/16': 4.763, '1/4': 6.35, '5/16': 7.938, '3/8': 9.525, '1/2': 12.7 };
// Calibre → mm de acero (tabla estándar de lámina; la app ya usa 10, 12, 14, 18, 20 y 22).
const MM_CALIBRE = { 10: 3.416, 12: 2.657, 14: 1.897, 16: 1.519, 18: 1.214, 20: 0.912, 22: 0.759 };
const PIE = 304.8;

function medidasHoja(t) {
  // "HOJA 4 X 8", "4'' X 8''", "3 X 10" (pies) o "1220 X 2440 mm" / "2070 X 2800 mm" / "1.20 X 2.00 m".
  const mm = t.match(/(\d{3,4})\s*X\s*(\d{3,4})\s*MM/);
  if (mm) return { a: Number(mm[1]), l: Number(mm[2]), en: 'mm' };
  const m = t.match(/(\d+[.,]\d+)\s*X\s*(\d+[.,]\d+)\s*M\b/);
  if (m) return { a: Number(m[1].replace(',', '.')) * 1000, l: Number(m[2].replace(',', '.')) * 1000, en: 'm' };
  const ft = t.match(/\b(3|4)\s*(?:''|"|')?\s*X\s*(6|8|10)\s*(?:''|"|')?(?!\d)/);
  if (ft) return { a: Number(ft[1]) * PIE, l: Number(ft[2]) * PIE, en: 'ft', pies: `${ft[1]}x${ft[2]}` };
  return null;
}

export function formatoParaAlta(nombre, unidad, semilla = {}) {
  const completo = sinAcentos(nombre).toUpperCase();
  const t = completo.split(' — ')[0]; // la parte después de " — " es la opción (color, acabado)
  if (!['hoja', 'pza'].includes(unidad) || A_MEDIDA_RX.test(t)) return null;
  const dim = medidasHoja(t);
  const esLamina = /\b(LAMINA|PLACA)\b/.test(t) && !/LAMINADO/.test(t);
  const tableroApp = semilla['melamina-16']?.formato || semilla.mdf?.formato;

  if (esLamina) {
    const cal = Number((t.match(/CALIBRE\s*(\d+)/) || [])[1]);
    const pulg = (t.match(/ESPESOR\s*(\d+\/\d+)\s*(?:"|'')/) || [])[1];
    const espesor = MM_CALIBRE[cal] || PULGADAS[pulg];
    if (!dim || !espesor) return null;
    const a = Math.min(dim.a, dim.l), l = Math.max(dim.a, dim.l);
    const area = (Math.round(a) / 1000) * (Math.round(l) / 1000);
    const kg = +(area * espesor * 7.85).toFixed(2);
    // Si la app ya tiene ese calibre y tamaño, se usa su formato tal cual.
    const idApp = dim.pies === '3x10' ? `lamina-3x10-${cal}` : dim.pies === '4x8' ? `lamina-${cal}` : null;
    const fApp = idApp && semilla[idApp]?.formato;
    if (fApp) return { forma: { unidad: 'hoja', fraccion: true, mermaCorte: 8, formato: { ...fApp } }, origen: `lámina de la app (${idApp})`, confirmado: true };
    return {
      forma: { unidad: 'hoja', fraccion: true, mermaCorte: 8,
        formato: { tipo: 'lamina', nombre: `lamina ${dim.pies ? dim.pies.replace('x', ' x ') + ' ft' : `${a} x ${l} mm`}`, corto: dim.pies || 'lamina', medida: kg, largoMM: Math.round(l), anchoMM: Math.round(a) } },
      origen: `${cal ? `lámina ${dim.pies || ''} cal. ${cal}` : `placa ${dim.pies || ''} de ${pulg}"`}: ${kg} kg por hoja calculados (la app no tiene ese calibre o tamaño)`,
      confirmado: false,
    };
  }

  if (!TABLERO_RX.test(t) || !tableroApp) return null;
  if (!dim) {
    // Melamina sin medida en la descripción: estándar de compra 1.22 × 2.44.
    if (/MELAMIN/.test(t)) return { forma: { unidad: 'hoja', fraccion: true, mermaCorte: 6, formato: { ...tableroApp } }, origen: 'estándar melamina 1.22 x 2.44', confirmado: true };
    return null;
  }
  const a = Math.round(Math.min(dim.a, dim.l)), l = Math.round(Math.max(dim.a, dim.l));
  const es4x8 = Math.abs(a - 1220) <= 10 && Math.abs(l - 2440) <= 10;
  const veta = /ENCHAPADO|CHAPA DE MADERA|MADERA SOLIDA/.test(completo);
  if (es4x8) {
    return { forma: { unidad: 'hoja', fraccion: true, mermaCorte: 6, veta, formato: { ...tableroApp } }, origen: 'tablero 1.22 x 2.44 (familia de la app)', confirmado: true };
  }
  if (l < 1000) return null; // pieza chica ya cortada (cojín, respaldo): se cobra por pieza
  const medida = +((a / 1000) * (l / 1000)).toFixed(4);
  return {
    forma: { unidad: 'hoja', fraccion: true, mermaCorte: 6, veta,
      formato: { tipo: 'tablero', nombre: `tablero ${(a / 1000).toFixed(2)} x ${(l / 1000).toFixed(2)}`, corto: 'tablero', medida, largoMM: l, anchoMM: a } },
    origen: `hoja de ${a} x ${l} mm según la descripción de compra (no es 1.22 x 2.44)`,
    confirmado: false,
  };
}
