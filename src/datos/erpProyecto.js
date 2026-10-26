// ============================================================================
//  WORKBOOK DE COSTEO REAL → REGISTROS ERP USADOS EN EL PROYECTO.
//  TELCEL C-CO-320R demostró el patrón: explo_x_id contiene sólo los materiales
//  realmente consumidos y cata_mp conserva la clave comercial. Este módulo es
//  determinista: NO llama IA, NO escribe DB y NO inventa unidad/precio/clave.
// ============================================================================
import { filasAObjetos } from './xlsxMinimo.js';
import { registroDesdeFila, normalizarEncabezadoErp } from './erpCarga.js';

const canon = normalizarEncabezadoErp;

function indiceEncabezado(filas = [], { requiereClave = false } = {}) {
  for (let i = 0; i < filas.length; i++) {
    const hs = new Set((filas[i] || []).map(canon).filter(Boolean));
    if (!hs.has('articulo') || !hs.has('costo ultima compra')) continue;
    if (requiereClave && !hs.has('clave comercial')) continue;
    return i;
  }
  return -1;
}

function hojaPorNombre(hojas, re) {
  return (hojas || []).find((h) => re.test(String(h?.nombre || ''))) || null;
}

function key(r) { return `${r.articulo}|${r.opcion || ''}`; }

/**
 * Extrae materiales usados desde un workbook de costeo real.
 * - explosión: prefiere hoja explo_x_id; sólo filas con artículo.
 * - catálogo MP: recupera clave comercial por Artículo|Opción cuando existe.
 * - dedupe: mismo artículo/opción/fecha/costo = una evidencia, aunque aparezca en varios módulos.
 */
export function registrosErpDesdeWorkbookProyecto(hojas = []) {
  const exp = hojaPorNombre(hojas, /explo|explosi/i)
    || (hojas || []).find((h) => indiceEncabezado(h.filas) >= 0)
    || null;
  if (!exp) return { registros: [], hojaExplosion: null, hojaCatalogo: null, resumen: { error: 'NO_EXPLOSION_TABLE' } };

  const ixExp = indiceEncabezado(exp.filas);
  const expObjs = filasAObjetos(exp.filas, ixExp).registros;
  const crudos = expObjs.map(registroDesdeFila).filter(Boolean);

  const cat = hojaPorNombre(hojas, /cata[_ ]?mp|catalog/i)
    || (hojas || []).find((h) => indiceEncabezado(h.filas, { requiereClave: true }) >= 0)
    || null;
  const catalogo = new Map();
  if (cat) {
    const ixCat = indiceEncabezado(cat.filas, { requiereClave: true });
    for (const o of filasAObjetos(cat.filas, ixCat).registros) {
      const r = registroDesdeFila(o);
      if (!r) continue;
      const k = key(r);
      // Primera ficha completa manda; el catálogo de MP es una tabla maestra, no una sugerencia.
      if (!catalogo.has(k) || (!catalogo.get(k).clave && r.clave)) catalogo.set(k, r);
    }
  }

  const vistos = new Set();
  const registros = [];
  let recuperadas = 0, sinClave = 0, sinUnidad = 0, sinFecha = 0, sinCosto = 0;
  for (const r0 of crudos) {
    const catR = catalogo.get(key(r0));
    const r = {
      ...r0,
      clave: r0.clave || catR?.clave || '',
      desc: r0.desc || catR?.desc || '',
      opc_desc: r0.opc_desc || catR?.opc_desc || '',
      unidad: r0.unidad || catR?.unidad || '',
      fecha_uc: r0.fecha_uc || catR?.fecha_uc || null,
      costo_uc: r0.costo_uc ?? catR?.costo_uc ?? null,
    };
    if (!r0.clave && r.clave) recuperadas++;
    if (!r.clave) sinClave++;
    if (!r.unidad) sinUnidad++;
    if (!r.fecha_uc) sinFecha++;
    if (!(r.costo_uc > 0)) sinCosto++;
    const firma = [r.articulo, r.opcion, r.fecha_uc || '', r.costo_uc ?? '', r.unidad || ''].join('|');
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    registros.push(r);
  }
  return {
    registros,
    hojaExplosion: exp.nombre,
    hojaCatalogo: cat?.nombre || null,
    resumen: {
      filasExplosion: crudos.length,
      registrosUnicos: registros.length,
      clavesRecuperadas: recuperadas,
      sinClave, sinUnidad, sinFecha, sinCosto,
    },
  };
}

export const _indiceEncabezadoProyecto = indiceEncabezado;
