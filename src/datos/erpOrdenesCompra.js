// ============================================================================
//  ÓRDENES DE COMPRA DEL ERP (Intelisis) → registros de última compra.
//  Desde 2026-10 Compras manda el reporte "Órdenes de Compra" (no el de "Costos de
//  Materia Prima · Última Compra"). Trae la compra REAL por renglón: Costo Unitario SIN
//  IVA (Sub Total = Cantidad × Costo Unitario; el IVA va aparte en "Impuestos (MN)"). Es
//  evidencia PRIMARIA (la orden real), así que certifica con la política normal de ≤24 meses.
//  Reglas deterministas (no inventa nada; mismo espíritu que erpProyecto.js):
//   · Una fila por Artículo+Opción: la de FECHA MÁS RECIENTE = última compra.
//   · El Estatus del renglón es de la ORDEN (CONCLUIDO/PENDIENTE), NO del material: no se
//     usa para activar/bloquear. Una compra reciente ⇒ material activo (ALTA).
//   · Toma SIEMPRE "Costo Unitario" (unitario sin IVA), nunca Sub Total / Importe Total.
//   · La OC no trae Clave Comercial: el id del insumo se arma del Artículo (idErp).
//  Lo desconocido (servicios, muebles comprados que no están en el catálogo) lo resuelve
//  la RPC: si el artículo no existe como insumo, lo reporta y lo omite — no se inventa.
// ============================================================================
import { filasAObjetos } from './xlsxMinimo.js';
import { normalizarEncabezadoErp } from './erpCarga.js';

const canon = normalizarEncabezadoErp;

function valor(o, ...aliases) {
  const wanted = new Set(aliases.map(canon));
  for (const [k, v] of Object.entries(o || {})) if (wanted.has(canon(k))) return v;
  return null;
}

function esHeaderOC(fila = []) {
  const hs = new Set((fila || []).map(canon).filter(Boolean));
  return hs.has('articulo') && hs.has('costo unitario') && hs.has('fecha emision');
}

/** Índice de la fila de encabezados de un archivo de Órdenes de Compra, o -1. */
export function indiceHeaderOrdenesCompra(filas = []) {
  for (let i = 0; i < filas.length; i++) if (esHeaderOC(filas[i])) return i;
  return -1;
}

/** 'YYYY-MM-DD' comparable desde Date, ISO ya convertido por xlsxMinimo, o texto con fecha al inicio. */
export function fechaISOorden(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).trim().match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function registroDesdeFilaOrden(o) {
  const art = String(valor(o, 'Articulo', 'Artículo') ?? '').trim();
  if (!art || canon(art) === 'articulo') return null;
  const costoRaw = valor(o, 'Costo Unitario');          // SIN IVA (jamás Sub Total / Importe Total)
  const costo = costoRaw == null || costoRaw === '' ? null : Number(costoRaw);
  return {
    articulo: art,
    opcion: String(valor(o, 'Opción', 'Opcion') ?? '').trim().replace(/^-$/, ''),
    desc: String(valor(o, 'Descripcion', 'Descripción') ?? '').replace(/\s+/g, ' ').trim(),
    opc_desc: String(valor(o, 'DescOpcion', 'Opción Descripción', 'Opcion Descripcion') ?? '').replace(/\s+/g, ' ').trim(),
    unidad: String(valor(o, 'Unidad') ?? '').trim(),
    clave: '',                   // la OC no trae Clave Comercial
    estatus: 'ALTA',             // comprado = activo (el Estatus del renglón es de la orden, no del material)
    fecha_uc: fechaISOorden(valor(o, 'Fecha Emisión', 'Fecha Emision')) || null,
    costo_uc: Number.isFinite(costo) && costo > 0 ? costo : null,
  };
}

/**
 * Extrae registros de última compra desde un archivo de Órdenes de Compra del ERP.
 * @param {Array<{nombre:string, filas:Array<Array>}>} hojas  salida de leerHojas()
 * @returns {{registros:Array, esOrdenesCompra:boolean, hoja?:string, resumen:object}}
 */
export function registrosErpDesdeOrdenesCompra(hojas = []) {
  let hoja = null, ix = -1;
  for (const h of (hojas || [])) {
    const i = indiceHeaderOrdenesCompra(h?.filas || []);
    if (i >= 0) { hoja = h; ix = i; break; }
  }
  if (!hoja) return { registros: [], esOrdenesCompra: false, resumen: { error: 'NO_OC_TABLE' } };

  const crudos = filasAObjetos(hoja.filas, ix).registros.map(registroDesdeFilaOrden).filter(Boolean);
  // ÚLTIMA COMPRA: una fila por Artículo+Opción, la de fecha más reciente (empate → la última leída).
  const porClave = new Map();
  let colapsadas = 0;
  for (const r of crudos) {
    const k = `${r.articulo}|${r.opcion || ''}`;
    const prev = porClave.get(k);
    if (!prev) { porClave.set(k, r); continue; }
    colapsadas++;
    if ((r.fecha_uc || '') >= (prev.fecha_uc || '')) porClave.set(k, r);
  }
  const registros = [...porClave.values()];
  return {
    registros,
    esOrdenesCompra: true,
    hoja: hoja.nombre,
    resumen: {
      filas: crudos.length,
      registrosUnicos: registros.length,
      colapsadas,
      sinCosto: registros.filter((r) => !(r.costo_uc > 0)).length,
      sinFecha: registros.filter((r) => !r.fecha_uc).length,
    },
  };
}
