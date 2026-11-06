// ============================================================================
//  PRODUCTO MAESTRO · costeo por CLAVE desde un BOM confirmado (2026-11-06).
//
//  Un mueble de catálogo (clave ENTCBCALP, TELSVH120, …) se costea UNA vez bien —
//  el depto de estimaciones arma su BOM pieza por pieza contra el ERP. Ese BOM se
//  GUARDA por clave. A partir de ahí, costear la clave NO vuelve a depender de que
//  VONI lea el plano: se RE-COSTEA el BOM guardado con los precios VIGENTES del
//  catálogo + la política de costo VH (fabricado ×1.8, compra-venta ×1.06). Eso da
//  ±1% exacto en cada reorden y se actualiza solo cuando Compras mueve un precio.
//
//  Por qué así: VONI oscila ±30-50% entre lecturas del MISMO plano crudo (probado:
//  los cuerpos del ENTCBCALP valían $3,543 en una corrida y $0 en otra). Un BOM
//  confirmado quita ese ruido para los muebles que ya existen. VONI sólo arma el
//  BORRADOR de un mueble NUEVO; una persona lo confirma una vez y queda guardado.
//
//  Cada línea del BOM trae su `precioConfirmado` (de estimaciones) como respaldo: si
//  su `insumoId` está en el catálogo vigente con precio, se usa el del catálogo (y el
//  costo se actualiza con las compras); si no, se usa el confirmado y se REPORTA, para
//  que Compras lo dé de alta. Nunca se cuesta una línea en $0 en silencio.
// ============================================================================
import { costoFabricacionVH, precioUsable } from '../motor/calculo.js';

/** Precio de una línea de BOM: catálogo vigente si existe y es usable; si no, el confirmado. */
export function precioLineaBOM(linea = {}, insumos = {}) {
  const ins = linea.insumoId ? insumos[linea.insumoId] : null;
  if (ins && precioUsable(ins)) return { precio: Number(ins.precio), fuente: 'catalogo' };
  if (Number(linea.precioConfirmado) > 0) return { precio: Number(linea.precioConfirmado), fuente: 'confirmado' };
  return { precio: null, fuente: 'sin_precio' };
}

/**
 * Cuesta un BOM confirmado con precios vigentes + política VH. Determinista; no usa IA.
 * @returns {{material, materialFabricado, materialCompraVenta, manoObra, gif, costoFabricacion,
 *            cosFabReal, deltaPct, cobertura, lineas}}
 */
export function costearBOM(bom = {}, insumos = {}, { factores } = {}) {
  const lineas = Array.isArray(bom.lineas) ? bom.lineas : [];
  const detalle = [];
  const reporte = [];
  let conCatalogo = 0, conConfirmado = 0, sinPrecio = 0;
  for (const L of lineas) {
    const p = precioLineaBOM(L, insumos);
    const cant = Number(L.cantidad) > 0 ? Number(L.cantidad) : 0;
    const costo = p.precio != null ? p.precio * cant : 0;
    if (p.fuente === 'catalogo') conCatalogo++;
    else if (p.fuente === 'confirmado') conConfirmado++;
    else sinPrecio++;
    // La política VH clasifica por sección; compra-venta = gráficos/iluminación.
    detalle.push({ seccion: L.esCompraVenta ? 'graficos' : 'metal', costo });
    reporte.push({ desc: L.desc, cantidad: cant, precio: p.precio, costo, fuente: p.fuente, esCompraVenta: !!L.esCompraVenta });
  }
  // Factores POR CLAVE (de la hoja de estimaciones): NO son universales (Alpura 20/50, Telcel 10/25).
  // Si la clave los trae, se usan (reproduce su hoja exacto). Si no, se cae a la política por sección.
  const fm = Number(bom.factor_mo), fg = Number(bom.factor_gif);
  let vh;
  if (Number.isFinite(fm) && Number.isFinite(fg)) {
    let fabMat = 0, cvMat = 0;
    for (const d of detalle) { if (d.seccion === 'graficos' || d.seccion === 'iluminacion') cvMat += d.costo; else fabMat += d.costo; }
    const material = fabMat + cvMat;
    const manoObra = material * fm, gif = material * fg;
    vh = { materialFabricado: fabMat, materialCompraVenta: cvMat, material, manoObra, gif, costoFabricacion: material + manoObra + gif, factoresPorClave: { factor_mo: fm, factor_gif: fg } };
  } else {
    vh = costoFabricacionVH(detalle, factores || undefined);
  }
  const cosFabReal = bom.cos_fab_real != null && Number.isFinite(Number(bom.cos_fab_real)) ? Number(bom.cos_fab_real) : null;
  const deltaPct = cosFabReal ? (vh.costoFabricacion - cosFabReal) / cosFabReal * 100 : null;
  return {
    clave: bom.clave || null,
    ...vh,
    cosFabReal,
    deltaPct,
    cobertura: { lineas: lineas.length, conCatalogo, conConfirmado, sinPrecio },
    lineas: reporte,
  };
}
