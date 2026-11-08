// LOOP DE APRENDIZAJE (A): convierte el despiece CONFIRMADO del motor (detalleInsumos) en un
// BOM de Producto Maestro, para guardarlo con guardar_producto_maestro() y que esa clave quede
// costeable por material (y certificable si todo viene del catálogo vigente).
//
// Regla universal y exacta: cantidad = costo/precio (la cantidad física implícita). Al reabrir,
// costearBOM hace precio_catalogo × cantidad = costo (round-trip exacto) y, si el precio cambió,
// el costo flota con la cantidad fija — justo lo que se quiere. Fail-closed: una línea sin
// insumoId o sin precio NO se guarda (se devuelve en `descartadas` para que un humano la revise);
// nunca se inventa.

export function bomDesdeDespiece(detalleInsumos = [], insumos = {}, { clave, nombre, factorMo, factorGif, dims_mm = null, fuente = null } = {}) {
  const lineas = [];
  const descartadas = [];
  let material = 0;
  for (const d of (Array.isArray(detalleInsumos) ? detalleInsumos : [])) {
    const precio = Number(d && d.precio);
    const costo = Number(d && d.costo);
    if (!d || !d.insumoId) { descartadas.push({ insumoId: (d && d.insumoId) || null, motivo: 'sin insumoId (material no mapeado al catalogo)' }); continue; }
    if (!(precio > 0) || !Number.isFinite(costo) || costo < 0) { descartadas.push({ insumoId: d.insumoId, motivo: 'sin precio/costo usable' }); continue; }
    const cantidad = +(costo / precio).toFixed(6);
    const ins = insumos[d.insumoId] || {};
    lineas.push({
      desc: String(ins.nombre || d.insumoId).slice(0, 60),
      insumoId: d.insumoId,
      cantidad,
      unidad: '', // se omite a propósito: cantidad=costo/precio ya es dimensionalmente correcta y evita bloqueo por etiqueta (pza vs pieza)
      esCompraVenta: ins.seccion === 'graficos' || ins.seccion === 'iluminacion' || !!d.esCompraVenta,
      precioConfirmado: +precio.toFixed(4),
    });
    material += costo;
  }
  material = +material.toFixed(2);
  const fm = Number(factorMo), fg = Number(factorGif);
  const cos_fab_real = (Number.isFinite(fm) && Number.isFinite(fg)) ? +(material * (1 + fm + fg)).toFixed(2) : null;
  return {
    clave: String(clave || '').trim().toUpperCase(),
    nombre: nombre || null,
    tipo_bom: 'BOM_DETALLADO_VERIFICADO',
    material_real: material,
    cos_fab_real,
    factor_mo: Number.isFinite(fm) ? fm : null,
    factor_gif: Number.isFinite(fg) ? fg : null,
    dims_mm,
    fuente,
    lineas,
    descartadas,
  };
}

// ¿Está listo para guardar? Exige clave, al menos una línea costeable y factores. Avisa (no bloquea)
// de las líneas descartadas para que la persona decida.
export function listoParaGuardar(bom = {}) {
  const errores = [];
  if (!bom.clave) errores.push('Falta la clave del producto.');
  if (!Array.isArray(bom.lineas) || !bom.lineas.length) errores.push('No hay lineas costeables para guardar.');
  if (bom.factor_mo == null || bom.factor_gif == null) errores.push('Faltan los factores (MO/GIF) de la clave.');
  const nDesc = Array.isArray(bom.descartadas) ? bom.descartadas.length : 0;
  return {
    ok: errores.length === 0,
    errores,
    aviso: nDesc ? `${nDesc} linea(s) sin mapear al catalogo NO se guardaran; revisalas antes.` : null,
  };
}
