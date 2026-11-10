// ============================================================================
//  F1 · CATALOGO DE CLASIFICACION DE TERCEROS (auditoria 01c456c).
//
//  MECANISMO para que Compras/Ingenieria declaren, por patron de nombre/seccion, si un
//  insumo que parece tercero se COMPRA terminado (compra_venta, x1.06) o se FABRICA en
//  casa (fabricado, x1.80). El productor de despiece lo consulta antes de bloquear.
//
//  POR QUE EL CATALOGO NACE VACIO (evidencia, no suposicion):
//  Se intento sembrar "vidrio/acrilico -> compra_venta" por intuicion fisica. Pero el BOM
//  REAL CERTIFICADO de la fabrica (ENTCBCALP, hoja C-CO-517R) costea el ACRILICO/CRISTAL
//  como FABRICADO x1.80 (esCompraVenta=false), y ASI reproduce su cos_fab_real $18,749.37.
//  => La clasificacion de terceros es una POLITICA de Von Haucke, NO un hecho fisico
//     universal; la intuicion "comprado => x1.06" DIVERGE del costeo real de la fabrica.
//  Por eso NO se siembra ninguna regla: cada regla la agrega Compras/Direccion con su
//  politica. Sin regla, el insumo-tercero queda PENDIENTE (fail-closed), nunca x1.80 ni
//  x1.06 en silencio. Afecta solo despieces NUEVOS; no toca BOMs certificados almacenados.
//
//  Para poblarlo, Compras agrega entradas a REGLAS_TERCERO, p.ej.:
//    { re: /cristal templado/i, clasificacion: 'compra_venta', nota: 'OC proveedor X, politica 2026' }
//    { re: /acril/i,            clasificacion: 'fabricado',    nota: 'se corta/arma en casa (hoja C-CO-517R)' }
// ============================================================================

// Reglas por patron. VACIO a proposito (ver cabecera): lo llena Compras/Direccion con su politica.
export const REGLAS_TERCERO = Object.freeze([]);

/**
 * Clasifica un insumo que parece tercero segun la politica declarada por Compras.
 * Devuelve {clasificacion, fuente, nota} o null. null = sin politica declarada:
 * el llamador BLOQUEA (fail-closed), nunca asume x1.06 ni x1.80.
 */
export function clasificarTercero(nombre = '', seccion = '') {
  const t = `${String(nombre || '')} ${String(seccion || '')}`;
  for (const r of REGLAS_TERCERO) {
    if (r.re.test(t)) return { clasificacion: r.clasificacion, fuente: 'catalogo_compras', nota: r.nota };
  }
  return null;
}
