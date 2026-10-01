// ============================================================================
//  LAS COTIZACIONES VIVEN EN LA NUBE, NO EN EL APARATO
//
//  Rodrigo (2026-08-16): "si lo hago con mi usuario en mi celular, no me lo pone
//  en la computadora, como si fueran 2 diferentes". Y tenía razón: hasta hoy la
//  cotización se guardaba en `localStorage` —el propio comentario de almacen.js
//  lo decía: "exportar/importar JSON, ÚNICA forma de compartir entre
//  computadoras"—. Lo que sí se compartía eran los precios y las recetas, no el
//  trabajo del vendedor.
//
//  Y de paso resuelve lo segundo que pidió: un archivo de presupuestos reales
//  que se guarde SIEMPRE, para poder buscarlos después y para que Voni los use
//  como referencia. "Si ya coticé esto alguna vez, lo agarro de ahí — a menos
//  que haya cambiado el precio de la materia prima."
//
//  ESA ÚLTIMA CONDICIÓN ES LA IMPORTANTE, y es la razón de `huellaMP`: cada
//  cotización guarda una huella de los precios de insumo con los que se costeó.
//  Si la huella de hoy no coincide, ese precio viejo ya no se puede reusar tal
//  cual — se enseña, pero avisando. Un precio de hace ocho meses con la melamina
//  a otro costo no es un precio: es un recuerdo.
// ============================================================================
import { nube } from '../nube.js';
import { totalesCotizacion } from './totales.js';
import { MOTOR_VERSION } from '../motor/calculo.js';

// ---------------------------------------------------------------------------
//  HUELLA DE LA MATERIA PRIMA
//  Un resumen corto y estable de TODOS los precios de insumo. Si cambia
//  cualquiera, cambia la huella. No es criptografía: es una firma para saber
//  "esto se coteó con otros precios".
// ---------------------------------------------------------------------------
// Prefijo de versión de la huella. Si el FORMATO de la huella cambia (como ahora,
// que pasó de solo `id:precio` a materia prima + parámetros + versión de motor),
// se sube: así `mpCambio` sabe que una huella vieja NO es comparable con una nueva
// y responde "no se sabe" en vez de gritar "cambió" para todo el archivo histórico.
const HUELLA_VER = 'mp2';

// Parámetros que ALTERAN EL COSTO calculado (no el precio de venta): si se mueve
// cualquiera, una cotización vieja ya no se costeó con las mismas bases. El margen
// NO entra aquí (afecta precio, no costo); la huella es sobre el costo/materia prima.
const PARAMS_COSTO = [
  'tipoCambio', 'mermaProceso', 'factorManoObraDirecta', 'factorManoObraIndirecta',
  'factorIndirectosFabrica', 'gastosOperacionPct', 'modeloCosteo',
  'kerfMM', 'recorteOrillaMM', 'aprovechamientoCorte',
];

export function huellaMP(insumos, par) {
  const lista = insumos && typeof insumos === 'object'
    ? Object.values(insumos)
    : Array.isArray(insumos) ? insumos : [];
  if (!lista.length) return '';
  const fmt = (f) => (f && typeof f === 'object' ? JSON.stringify(f) : String(f ?? ''));
  // Por insumo: NO solo el precio. Un cambio de unidad, moneda, formato de compra
  // o merma de corte mueve el costo real igual que un cambio de precio (audit
  // 2026-10-01): capturar la chapa por m² en vez de por hoja la dejaba 3× barata
  // sin que la huella se enterara. Ahora sí se entera.
  const mp = lista
    .filter((i) => i && i.id)
    .map((i) => [
      i.id,
      Number(i.precio) || 0,
      i.unidad || '',
      i.moneda || (i.usd ? 'usd' : ''),
      fmt(i.formato),
      Number(i.mermaCorte) || 0,
    ].join(':'))
    .sort()
    .join('|');
  // Parámetros de costo + versión del motor: si la FÓRMULA cambia, la huella cambia.
  const p = par && typeof par === 'object' ? par : {};
  const parTxt = PARAMS_COSTO.map((k) => `${k}=${p[k] ?? ''}`).join(',');
  const txt = `${MOTOR_VERSION}#${parTxt}#${mp}`;
  // djb2 — corto, determinista y suficiente para detectar un cambio.
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) >>> 0;
  return `${HUELLA_VER}:${h.toString(36)}-${lista.length}`;
}

/**
 * ¿La cotización se costeó con otras bases (precios/unidades/formatos/mermas/
 * parámetros/motor) que las de hoy? Devuelve true/false solo si la huella guardada
 * es del MISMO formato que la de hoy; si es de un formato viejo (no comparable) o
 * no hay huella, devuelve null = "no se sabe" (NUNCA se afirma un cambio falso, ni
 * se recalcula en silencio una cotización ya emitida — audit 2026-10-01).
 */
export function mpCambio(cot, insumosHoy, parHoy) {
  const h = cot?.huella_mp;
  if (!h) return null;                               // no se sabe
  if (!String(h).startsWith(HUELLA_VER + ':')) return null; // formato viejo: incomparable
  return h !== huellaMP(insumosHoy, parHoy);
}

// ---------------------------------------------------------------------------
//  GUARDAR / LEER
// ---------------------------------------------------------------------------

/** Lo que de verdad se guarda. Se deja fuera todo lo que no es la cotización. */
export function paraGuardar(estado, usuario) {
  const cot = estado?.cotizacion || {};
  const partidas = cot.partidas || [];
  // La MISMA escalera de dinero que ve el cliente en pantalla y firma en el PDF
  // (src/datos/totales.js), no una suma cruda aparte. Antes aquí se guardaba
  // `Math.round(Σ precio×cantidad)` —la suma de renglones SIN descuento, maniobras,
  // flete ni IVA—, así que el número del Archivo no era el total emitido. FIX-05.
  const t = totalesCotizacion(partidas, cot, estado?.parametros || {});
  return {
    folio: cot.folio || null,
    cliente: cot.cliente || null,
    usuario: usuario || null,
    estado: cot.estadoComercial || 'borrador',
    partidas,
    acomodo: cot.acomodo || null,
    // Se guarda el desglose completo, no solo los pct: así una reimpresión o el
    // Archivo reproducen el total al peso sin recalcular con parámetros de hoy.
    totales: {
      descuentoPct: t.descuentoPct,
      contingenciaPct: t.contingenciaPct,
      maniobrasPct: t.maniobrasPct,
      fletePct: t.fletePct,
      ivaPct: t.ivaPct,
      precioLista: Math.round(t.precioLista),
      descuento: Math.round(t.descuento),
      subtotal: Math.round(t.subtotal),
      contingencia: Math.round(t.contingencia),
      maniobras: Math.round(t.maniobras),
      flete: Math.round(t.flete),
      iva: Math.round(t.iva),
      total: t.totalRedondeado,
    },
    total: t.totalRedondeado,
    piezas: partidas.reduce((a, p) => a + (p.cantidad || 0), 0),
    huella_mp: huellaMP(estado?.insumos, estado?.parametros),
  };
}

/**
 * Guarda (o actualiza) la cotización. Devuelve el id.
 * Nunca tumba la app: si la nube falla, el vendedor sigue cotizando y se
 * reintenta al siguiente cambio.
 */
export async function guardarCotizacion(estado, usuario, id = null) {
  const fila = paraGuardar(estado, usuario);
  // Sin nada dentro no se guarda: no queremos el archivo lleno de borradores
  // vacíos de cada vez que alguien abre la pantalla.
  if (!fila.partidas.length) return id;
  try {
    if (id) {
      const { error } = await nube.from('cotizaciones')
        .update({ ...fila, actualizado: new Date().toISOString() }).eq('id', id);
      return error ? id : id;
    }
    const { data, error } = await nube.from('cotizaciones').insert(fila).select('id').single();
    return error ? null : data.id;
  } catch (e) {
    return id;
  }
}

/**
 * Busca en el archivo. `q` se compara contra cliente, folio y los nombres de los
 * muebles: un vendedor busca "Tradeco", "bench Cirque" o "2608-001" sin acordarse
 * de en cuál de los tres estaba.
 */
export async function listarCotizaciones({ q = '', limite = 60 } = {}) {
  let sel = nube.from('cotizaciones').select('*').eq('activa', true)
    .order('actualizado', { ascending: false }).limit(limite);
  const { data, error } = await sel;
  // ⚠️ ANTES un error de la consulta (red, RLS) devolvía `[]` igual que un
  // archivo legítimamente vacío: Archivo.jsx ya tiene su propio try/catch
  // esperando justo esto (setError('No se pudo leer el archivo.')), pero como
  // aquí nunca se lanzaba nada, esa pantalla de error jamás se veía — el
  // vendedor sólo leía "Todavía no hay presupuestos guardados", que es falso
  // cuando en realidad la consulta se cayó.
  if (error) throw error;
  const t = String(q || '').trim().toLowerCase();
  if (!t) return data || [];
  return (data || []).filter((c) => textoDe(c).includes(t));
}

/** Todo lo que se puede buscar de una cotización, en un solo texto. */
export function textoDe(c) {
  const nombres = (c.partidas || []).map((p) => p.nombre || '').join(' ');
  return `${c.cliente || ''} ${c.folio || ''} ${nombres}`.toLowerCase();
}

/** La deja fuera del archivo sin borrarla: el historial no se destruye.
 * ⚠️ EL CATCH VACÍO ESCONDÍA EL ERROR (auditoría 2026-08-19). Igual que
 * `listarCotizaciones` arriba: si el update fallaba (red, RLS), "Sacar de la
 * lista" no hacía nada y la tarjeta seguía apareciendo tras `refrescar()` —
 * parecía un bug de UI cuando era un error de base de datos escondido a
 * propósito. Ahora se propaga; Archivo.jsx ya tiene su try/catch para esto. */
export async function archivarCotizacion(id) {
  const { error } = await nube.from('cotizaciones').update({ activa: false }).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
//  LO QUE VONI USA COMO REFERENCIA
//  Un resumen corto de lo ya cotizado, para meterlo en el pedido. No van las
//  cotizaciones enteras: el prompt tiene que seguir cabiendo y lo que importa es
//  "este mueble ya se vendió a este precio, y si la MP cambió, ojo".
// ---------------------------------------------------------------------------
export function referenciasParaVoni(cotizaciones, insumosHoy, tope = 40, parHoy) {
  const vistos = new Map();
  for (const c of cotizaciones || []) {
    const viejo = mpCambio(c, insumosHoy, parHoy);
    for (const p of c.partidas || []) {
      if (!p.nombre || !p.precioUnitario) continue;
      const k = p.nombre;
      // Se queda el MÁS RECIENTE de cada mueble: la lista viene ordenada por
      // fecha, así que el primero que aparece es el bueno.
      if (!vistos.has(k)) {
        vistos.set(k, {
          nombre: p.nombre,
          precio: Math.round(p.precioUnitario),
          cliente: c.cliente || null,
          fecha: (c.actualizado || c.creado || '').slice(0, 10),
          mpCambio: viejo,
        });
      }
      if (vistos.size >= tope) break;
    }
    if (vistos.size >= tope) break;
  }
  return [...vistos.values()];
}

/** Las referencias en texto, listas para el prompt. */
export function referenciasTexto(refs) {
  return (refs || []).map((r) => {
    const aviso = r.mpCambio === true
      ? ' ⚠️ la materia prima cambió desde entonces: sirve de referencia, NO lo copies tal cual'
      : '';
    return `· "${r.nombre}" se cotizó en $${r.precio.toLocaleString('es-MX')}${r.cliente ? ` a ${r.cliente}` : ''}${r.fecha ? ` (${r.fecha})` : ''}${aviso}`;
  });
}
