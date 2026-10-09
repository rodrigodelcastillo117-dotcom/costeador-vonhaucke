// ============================================================================
//  precioInsumoBridge (REALITY CUTOVER, v1)
//
//  PUENTE entre el catálogo REAL de insumos que la app ya usa hoy (cada insumo
//  trae `precio` + `fuente` con procedencia real de Von Haucke: Compras, ERP,
//  T.D.C. de Alba/Rafa, listas de proveedor) y el CanonicalPriceResolver. Deja
//  que la UI responda "¿por qué estás usando $544?" con la evidencia REAL que ya
//  existe, SIN cambiar los números que calcula el motor (capa aditiva de
//  procedencia, no de cálculo).
//
//  Es PURO y determinista. NO lee red ni archivos. Mapea las cadenas `fuente`
//  conocidas (insumos.js) a procedencia estructurada (tipo + fecha). Una fuente
//  desconocida NO se inventa: queda PROVISIONAL sin fecha.
// ============================================================================
import { normalizarObservacionPrecio, FUENTE_PRECIO } from './precioProvenance.js';
import { resolverPrecioCanonico, explicarPrecio } from './canonicalPriceResolver.js';

// Extrae una fecha ISO (YYYY-MM-DD) de una cadena `fuente` libre. Soporta:
//  · ISO explícita "2026-08-24"
//  · 8 dígitos tipo nombre de archivo "10082026" (DDMMYYYY) → 2026-08-10
// Devuelve null si no hay fecha determinista (NO se inventa).
export function fechaDeFuenteTexto(fuente = '') {
  const s = String(fuente);
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ddmmyyyy = s.match(/\b(\d{2})(\d{2})(20\d{2})\b/);   // 10082026 → 2026-08-10
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

/**
 * Clasifica una cadena `fuente` REAL del catálogo → procedencia estructurada
 * {fuente(tipo), source_date, supplier}. Por PATRÓN (no por string exacto) para
 * cubrir también fuentes nuevas inline sin mantener una tabla frágil.
 * Inventario real (insumos.js, 11 fuentes/259 insumos): ERP xlsx Luis Daniel,
 * Compras, Sonara (lista), T.D.C. Alba/Alpura/banca, Loktec (proveedor),
 * Mercado estimado, Rodrigo rango, y 81 sin fuente (→ PENDING honesto).
 */
export function clasificarFuenteTexto(fuente) {
  const s = String(fuente || '').trim();
  if (!s) return { fuente: null, source_date: null, supplier: null };        // sin fuente → el resolver lo deja PENDING
  const low = s.toLowerCase();
  const source_date = fechaDeFuenteTexto(s);
  const supplier = s.split(/[—(]/)[0].trim() || null;      // etiqueta corta antes de "—" o "("

  // Estimado / rango / mercado → PROVISIONAL (no es compra ni lista confirmada).
  if (/mercado|rango|estimad|afina|aprox/.test(low)) return { fuente: FUENTE_PRECIO.PROVISIONAL, source_date, supplier };
  // T.D.C. (costeo humano real) → TDC_HUMANO.
  if (/t\.?\s*d\.?\s*c\.?|explo_mp/.test(low)) return { fuente: FUENTE_PRECIO.TDC_HUMANO, source_date, supplier };
  // Lista de precios EXPLÍCITA de proveedor → catálogo aprobado. (Sólo la frase
  // explícita; un "Compras, lista del…" es compra real, no lista de proveedor.)
  if (/lista[_ ]?de[_ ]?precios|precio de lista/.test(low)) return { fuente: FUENTE_PRECIO.CATALOGO_APROBADO, source_date, supplier };
  // Compra/ERP/materia prima/proveedor/importado → COMPRA_REAL.
  if (/compras|erp|última compra|ultima compra|materia prima|proveedor|importado|loktec/.test(low)) return { fuente: FUENTE_PRECIO.COMPRA_REAL, source_date, supplier };
  // "lista" a secas (sin contexto de compra) → catálogo aprobado.
  if (/\blista\b/.test(low)) return { fuente: FUENTE_PRECIO.CATALOGO_APROBADO, source_date, supplier };
  // Desconocida → PROVISIONAL (no se inventa realidad).
  return { fuente: FUENTE_PRECIO.PROVISIONAL, source_date, supplier };
}

/**
 * Observación de precio (contrato precioProvenance) a partir de UN insumo del
 * catálogo real. `fuente` ausente ⇒ el resolver lo deja PENDING (no se inventa).
 * @param {string} id  canonical_insumo_id (la clave del insumo en el catálogo)
 * @param {object} insumo  {precio, fuente, unidad, nombre, proveedor?, moneda?}
 */
export function observacionDeInsumo(id, insumo = {}) {
  const prov = clasificarFuenteTexto(insumo.fuente);
  return normalizarObservacionPrecio({
    canonical_insumo_id: id,
    precio: insumo.precio,
    moneda: insumo.moneda || 'MXN',
    unidad_compra: insumo.unidad,
    unidad_costeo: insumo.unidad,
    fuente: prov.fuente,
    source_document: insumo.fuente || null,   // la cadena original es el documento/rastro
    source_date: prov.source_date,
    supplier: insumo.proveedor || prov.supplier,
    evidence: insumo.fuente || null,
  });
}

/**
 * Resuelve el precio de UN insumo del catálogo con su procedencia. Una sola
 * observación (el catálogo trae una por insumo hoy); cuando se cargue la serie
 * histórica real, el mismo resolver escogerá la más autorizada/actual.
 */
export function resolverPrecioInsumo(id, insumo = {}, opts = {}) {
  return resolverPrecioCanonico(id, [observacionDeInsumo(id, insumo)], opts);
}

// ¿El precio del insumo fue CAPTURADO a mano? (difiere del estimado base).
export function precioCapturadoAMano(insumo = {}) {
  return Number(insumo.precioBase) > 0 && insumo.precio != null && insumo.precio !== insumo.precioBase;
}

/**
 * ADAPTER CANÓNICO VIVO (ChatGPT P0-PRICE-TRUST). La provenance pertenece a la
 * OBSERVACIÓN de precio, no al insumo genérico. Si Dirección captura un precio a
 * mano (precio≠precioBase), el monto nuevo NO queda autenticado por la `fuente`
 * vieja del catálogo: se emite una observación PROVISIONAL fechada con la fecha
 * de captura (`actualizado`), sin heredar el documento anterior. Lo usan Precios,
 * HojaCosto y el futuro motor — una sola verdad.
 */
export function observacionDeInsumoVivo(id, insumo = {}) {
  if (precioCapturadoAMano(insumo)) {
    return normalizarObservacionPrecio({
      canonical_insumo_id: id,
      precio: insumo.precio,
      moneda: insumo.moneda || 'MXN',
      unidad_compra: insumo.unidad,
      unidad_costeo: insumo.unidad,
      fuente: FUENTE_PRECIO.PROVISIONAL,
      source_document: null,                 // NO hereda el documento del precio anterior
      source_date: insumo.actualizado || null,
      supplier: 'Capturado a mano',
      evidence: null,
    });
  }
  return observacionDeInsumo(id, insumo);
}

/**
 * Resuelve el precio EFECTIVO de un insumo VIVO (capturado-aware). Es el único
 * punto que deben usar la UI y el futuro cutover del motor.
 */
export function resolverPrecioInsumoVivo(id, insumo = {}, opts = {}) {
  return resolverPrecioCanonico(id, [observacionDeInsumoVivo(id, insumo)], opts);
}

/** "¿Por qué $544?" para un insumo del catálogo real (capturado-aware). */
export function explicarPrecioInsumo(id, insumo = {}, opts = {}) {
  return explicarPrecio(resolverPrecioInsumoVivo(id, insumo, opts), insumo.nombre || id);
}
