// ============================================================================
//  PUENTE (P1 · integracion): despiece de VONI  ->  EXPEDIENTE INDUSTRIAL.
//
//  Conecta lo que vivia separado: el despiece que produce el flujo real (VONI/ERP)
//  con el motor industrial YA EXISTENTE (costearProductoIndustrial) y los consumidores
//  del expediente (vistaIngenieria, recostearExpediente, IngenieriaExpediente). NO es un
//  segundo costeador: es un adaptador que arma el shape `inputs` que el motor espera.
//
//  Reglas (fail-closed, no inventa):
//   · FABRICADA = materia prima que VH procesa (lamina/MDF/acrilico en hoja) CON geometria.
//     Sin dims -> el motor la deja PENDIENTE (desarrollo de CAD/Ingenieria); se conserva.
//   · COMPRADA  = componente con insumoId (herraje, LED, etc.) a precio ERP.
//   · Terceros: la clasificacion compra_venta/fabricado la decide el catalogo F1
//     (clasificarTercero); lo ambiguo queda para que el motor/Ingenieria lo confirme.
//  El expediente resultante admite CUALQUIER clave (no depende de TELSVH120) y se puede
//  recostear con recostearExpediente al confirmar dims/precios/estandares.
// ============================================================================
import { costearProductoIndustrial } from './costoPropuestoProcesos.js';
import { clasificarTercero } from './clasificacionTerceros.js';

const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };

// Materia prima que VH procesa en casa (se desarrolla desde geometria), vs componente comprado.
const SECCION_PROCESABLE = /metal|lamina|l[aá]mina|acero|hierro|mdf|madera|melamina|triplay|aglomerado|tablero|acril|policarbon|pintura|\bptr\b/i;
// P1-B (auditoria e48c0c2): una pieza de material PROCESABLE es FABRICADA aunque NO traiga geometria.
// Sin dims NO se asume comprada: se conserva fabricada y el motor la deja PENDIENTE de CAD (no inventa).
// La geometria solo decide si ya se puede costear, NUNCA si es fabricada o comprada.
function esFabricada(d) {
  if (d.fabricada === true) return true;
  if (d.comprada === true || d.insumoComprado === true) return false;
  return SECCION_PROCESABLE.test(String(d.seccion || '')) || SECCION_PROCESABLE.test(String(d.desc || ''));
}

/**
 * @param {Array} despiece  lineas del despiece [{clave?, insumoId?, desc, cantidad, seccion?,
 *   largoMM?, anchoMM?, dims_mm?, fabricada?, esCompraVenta?, calibrePropuesto?, aceroPropuesto?}]
 * @param {{clave,nombre?,insumosERP?,catalogoLamina?,routing?,interpretacion?}} ctx
 * @returns expediente industrial: { clave, interpretacion, bom_canonico, routing, inputs, costo_industrial, version }
 */
export function expedienteIndustrialDesdeDespiece(despiece = [], ctx = {}) {
  const { clave = null, nombre = null, insumosERP = {}, catalogoLamina = [], routing = { operaciones: [] }, interpretacion = {} } = ctx;
  const piezasBOM = [];
  for (const d of (Array.isArray(despiece) ? despiece : [])) {
    const fab = esFabricada(d);
    const dims_mm = Array.isArray(d.dims_mm) ? d.dims_mm
      : (num(d.largoMM) > 0 ? [num(d.largoMM), num(d.anchoMM) || 0] : null);
    const cat = clasificarTercero(d.desc || d.nombre || '', d.seccion || '');
    const esCompraVenta = cat ? cat.clasificacion === 'compra_venta' : d.esCompraVenta === true;
    piezasBOM.push({
      clave: d.clave || d.insumoId || d.desc || 'pieza',
      desc: d.desc || d.nombre || d.clave,
      cantidad: d.cantidad,
      dims_mm,
      fabricada: fab,
      insumoId: fab ? undefined : (d.insumoId || undefined),
      esCompraVenta,
      clasificacion_tercero: cat ? { clasificacion: cat.clasificacion, fuente: cat.fuente } : null,
      calibrePropuesto: d.calibrePropuesto,
      aceroPropuesto: d.aceroPropuesto,
    });
  }
  const costo_industrial = costearProductoIndustrial({ piezasBOM, routing, insumosERP, catalogoLamina });
  return {
    clave, nombre,
    interpretacion,
    bom_canonico: { lineas: piezasBOM },
    routing,
    inputs: { piezasBOM, insumosERP, catalogoLamina, routing },   // lo que recostearExpediente necesita
    costo_industrial,
    version: 1,
    confirmaciones: [],
  };
}
