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

// ---------------------------------------------------------------------------
//  HUELLA DE LA MATERIA PRIMA
//  Un resumen corto y estable de TODOS los precios de insumo. Si cambia
//  cualquiera, cambia la huella. No es criptografía: es una firma para saber
//  "esto se coteó con otros precios".
// ---------------------------------------------------------------------------
export function huellaMP(insumos) {
  const lista = insumos && typeof insumos === 'object'
    ? Object.values(insumos)
    : Array.isArray(insumos) ? insumos : [];
  if (!lista.length) return '';
  const txt = lista
    .filter((i) => i && i.id)
    .map((i) => `${i.id}:${Number(i.precio) || 0}`)
    .sort()
    .join('|');
  // djb2 — corto, determinista y suficiente para detectar un cambio.
  let h = 5381;
  for (let k = 0; k < txt.length; k++) h = ((h << 5) + h + txt.charCodeAt(k)) >>> 0;
  return `mp${h.toString(36)}-${lista.length}`;
}

/** ¿La cotización se costeó con otros precios de materia prima que los de hoy? */
export function mpCambio(cot, insumosHoy) {
  if (!cot?.huella_mp) return null;          // no se sabe: no se afirma que cambió
  return cot.huella_mp !== huellaMP(insumosHoy);
}

// ---------------------------------------------------------------------------
//  GUARDAR / LEER
// ---------------------------------------------------------------------------

/** Lo que de verdad se guarda. Se deja fuera todo lo que no es la cotización. */
export function paraGuardar(estado, usuario) {
  const cot = estado?.cotizacion || {};
  const partidas = cot.partidas || [];
  const total = partidas.reduce((a, p) => a + (p.precioUnitario || 0) * (p.cantidad || 0), 0);
  return {
    folio: cot.folio || null,
    cliente: cot.cliente || null,
    usuario: usuario || null,
    estado: cot.estadoComercial || 'borrador',
    partidas,
    acomodo: cot.acomodo || null,
    totales: {
      descuentoPct: cot.descuentoPct ?? null,
      contingenciaPct: cot.contingenciaPct ?? null,
      maniobrasPct: cot.maniobrasPct ?? null,
      fletePct: cot.fletePct ?? null,
    },
    total: Math.round(total),
    piezas: partidas.reduce((a, p) => a + (p.cantidad || 0), 0),
    huella_mp: huellaMP(estado?.insumos),
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

/** La deja fuera del archivo sin borrarla: el historial no se destruye. */
export async function archivarCotizacion(id) {
  try { await nube.from('cotizaciones').update({ activa: false }).eq('id', id); } catch (e) {}
}

// ---------------------------------------------------------------------------
//  LO QUE VONI USA COMO REFERENCIA
//  Un resumen corto de lo ya cotizado, para meterlo en el pedido. No van las
//  cotizaciones enteras: el prompt tiene que seguir cabiendo y lo que importa es
//  "este mueble ya se vendió a este precio, y si la MP cambió, ojo".
// ---------------------------------------------------------------------------
export function referenciasParaVoni(cotizaciones, insumosHoy, tope = 40) {
  const vistos = new Map();
  for (const c of cotizaciones || []) {
    const viejo = mpCambio(c, insumosHoy);
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
