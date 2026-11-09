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

/** Precio de una línea de BOM: catálogo vigente (precio > 0) si existe; si no, el confirmado. */
export function precioLineaBOM(linea = {}, insumos = {}) {
  const ins = linea.insumoId ? insumos[linea.insumoId] : null;
  if (ins && precioUsable(ins) && Number(ins.precio) > 0) return { precio: Number(ins.precio), fuente: 'catalogo' };
  if (Number(linea.precioConfirmado) > 0) return { precio: Number(linea.precioConfirmado), fuente: 'confirmado' };
  return { precio: null, fuente: 'sin_precio' };
}

const normU = (u) => String(u || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[²2]/g, '2').replace(/\s+/g, '');

/**
 * CONTRATO SEGURO DE LÍNEA (P1 2026-11-07): clasifica una línea en un estado explícito.
 * Un estado que no se puede costear BLOQUEA la emisión; nunca se cuesta en silencio.
 *   precio_vigente · precio_historico · cero_real  → no bloquean (costo definido)
 *   cantidad_invalida · unidad_incompatible · precio_faltante → bloquean
 * fuente se conserva para la UI (catalogo | confirmado | cero | sin_precio).
 */
export function clasificarLineaBOM(linea = {}, insumos = {}) {
  const excluido = linea.excluido === true || linea.suministradoCliente === true;
  const cantRaw = Number(linea.cantidad);
  const cantOk = Number.isFinite(cantRaw) && cantRaw > 0;
  // Exclusión confirmada / equipo del cliente: cuesta 0 legítimo, sin importar precio ni cantidad.
  if (excluido) {
    return { estado: 'cero_real', bloquea: false, precio: 0, cantidad: cantOk ? cantRaw : 0, costo: 0, fuente: 'cero' };
  }
  // Cantidad inválida (0, negativa, NaN, ausente): BLOQUEA. No se trata como 0 en silencio.
  if (!cantOk) {
    return { estado: 'cantidad_invalida', bloquea: true, precio: null, cantidad: 0, costo: 0, fuente: 'sin_precio' };
  }
  const ins = linea.insumoId ? insumos[linea.insumoId] : null;
  const precioCat = ins ? Number(ins.precio) : NaN;
  if (ins && precioUsable(ins) && Number.isFinite(precioCat) && precioCat > 0) {
    const uL = normU(linea.unidad), uI = normU(ins.unidad);
    if (uL && uI && uL !== uI) {
      return { estado: 'unidad_incompatible', bloquea: true, precio: null, cantidad: cantRaw, costo: 0, fuente: 'sin_precio', unidad: { linea: linea.unidad, catalogo: ins.unidad } };
    }
    // FRESCURA (honestidad motor = servidor): un precio de catálogo VENCIDO (>24 meses / sin
    // validar por Compras) lo marca el servidor con evidencia.certificable === false. Cuesta igual
    // (precio vigente usable), pero NO certifica: la línea se marca fresco:false y el BOM cae a
    // orientativo. Sólo un `false` EXPLÍCITO degrada; sin dato de evidencia se trata como fresco
    // (compatibilidad con BOMs/pruebas sin evidencia y con catálogos que no exponen la bandera).
    const fresco = !(ins && ins.evidencia && ins.evidencia.certificable === false);
    return { estado: 'precio_vigente', bloquea: false, precio: precioCat, cantidad: cantRaw, costo: precioCat * cantRaw, fuente: 'catalogo', fresco };
  }
  // Catálogo con precio 0 / no usable NO sirve: cae a histórico orientativo, o faltante.
  if (Number(linea.precioConfirmado) > 0) {
    const p = Number(linea.precioConfirmado);
    return { estado: 'precio_historico', bloquea: false, precio: p, cantidad: cantRaw, costo: p * cantRaw, fuente: 'confirmado' };
  }
  return { estado: 'precio_faltante', bloquea: true, precio: null, cantidad: cantRaw, costo: 0, fuente: 'sin_precio' };
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
  const bloqueos = [];
  let conCatalogo = 0, conConfirmado = 0, sinPrecio = 0, orientativo = false, catalogoViejo = 0;
  for (const L of lineas) {
    const c = clasificarLineaBOM(L, insumos);
    if (c.fuente === 'catalogo') conCatalogo++;
    else if (c.fuente === 'confirmado') conConfirmado++;
    else if (c.bloquea) sinPrecio++;
    if (c.estado === 'precio_historico') orientativo = true;
    // Precio de catálogo VENCIDO: cuesta (precio vigente usable) pero NO certifica (frescura = servidor).
    if (c.estado === 'precio_vigente' && c.fresco === false) catalogoViejo += 1;
    if (c.bloquea) bloqueos.push({ desc: L.desc, estado: c.estado, unidad: c.unidad });
    // La política VH clasifica por sección; compra-venta = gráficos/iluminación.
    detalle.push({ seccion: L.esCompraVenta ? 'graficos' : 'metal', costo: c.costo });
    reporte.push({ desc: L.desc, cantidad: c.cantidad, precio: c.precio, costo: c.costo, fuente: c.fuente, estado: c.estado, fresco: c.fresco !== false, bloquea: c.bloquea, esCompraVenta: !!L.esCompraVenta });
  }
  // Un BOM AGREGADO_HISTORICO no es un BOM por materiales verificado (se refina en el bloque 2).
  const bomDetallado = bom.tipo_bom === 'BOM_DETALLADO_VERIFICADO';
  const emitible = bloqueos.length === 0;
  // Certificable (honestidad = servidor): además de emitible/no-orientativo/BOM detallado, NINGUNA
  // línea de catálogo puede usar un precio VENCIDO (catalogoViejo===0). Antes el motor pintaba
  // "✓ Certificable" con precios de catálogo de hace años que el servidor marca PRELIMINAR.
  const hayPrecioViejo = catalogoViejo > 0;
  const certificable = emitible && !orientativo && !hayPrecioViejo && bomDetallado;
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
    // Contrato seguro: emitible = hay costo para cada línea (sin bloqueos); certificable = emitible,
    // sin precios históricos, sin precios de catálogo vencidos (frescura) y con BOM detallado verificado.
    emitible,
    certificable,
    orientativo,
    hayPrecioViejo,
    bloqueos,
    tipoBom: bom.tipo_bom || 'AGREGADO_HISTORICO',
    cobertura: { lineas: lineas.length, conCatalogo, conConfirmado, catalogoViejo, sinPrecio, bloqueos: bloqueos.length },
    lineas: reporte,
  };
}
