// ============================================================================
//  LOOP DE APRENDIZAJE (A) — CONTRATO DE INTEGRIDAD (P0 · 2026-11-09).
//
//  Convierte el despiece CONFIRMADO del motor (detalleInsumos) en un Producto
//  Maestro. Antes este flujo DESCARTABA en silencio las líneas sin SKU/precio,
//  reconstruía la cantidad como costo/precio, omitía la unidad y etiquetaba el
//  resultado como BOM_DETALLADO_VERIFICADO — podía guardar un mueble "completo"
//  al que le faltaban piezas, y el loop aprendía de BOMs incompletos. (Auditoría
//  2026-11-08.) Este módulo lo cierra FAIL-CLOSED:
//
//   · NINGUNA PIEZA DESAPARECE. Una línea sin insumoId o sin precio se CONSERVA
//     como PENDIENTE dentro del BOM (no se descarta); al reabrir, bloquea la
//     emisión hasta que Compras/Ingeniería la resuelvan.
//   · INCOMPLETO ≠ VERIFICADO. Con una sola pendiente, o una línea sin cantidad
//     física/unidad, el BOM es BORRADOR. VERIFICADO es un acto EXPLÍCITO
//     (verificar:true) y sólo si la integridad se cumple; nunca automático.
//   · LA CANTIDAD ES FÍSICA. Viene de la física del motor (unidades/comprado/
//     neto + unidad). costo/precio SÓLO reconcilia (comprobación matemática),
//     nunca es la única fuente de la cantidad industrial.
//   · CALCULADO ≠ MEDIDO. El costo de fabricación por factores es
//     `cos_fab_calculado`; `cos_fab_real` queda null salvo que exista una
//     referencia de fábrica medida e independiente.
//   · La aprobación del PRECIO no aprueba el BOM.
// ============================================================================

import { clasificarTercero } from './clasificacionTerceros.js';

const TOL = 1e-3;
const num = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };

// TERCEROS subcontratados: un insumo que parece comprado terminado (cristal templado,
// vidrio, acrilico, termoformado, corte laser, galvanizado) NO debe costearse como
// FABRICADO x1.80 en silencio. Si no esta clasificado como compra-venta ni confirmado,
// se CONSERVA como PENDIENTE (igual que una pieza sin precio) hasta que Ingenieria/Compras
// declare su clasificacion. Fail-closed, no advertencia (bloqueo 1, auditoria cd972a1).
const TERCERO_RE = /cristal|templad|vidrio|acril|termoform|corte\s*laser|galvaniz/i;

// Procedencia del consumo (contrato del modelo: MEASURED/DERIVED/INFERRED/ASSUMED/USER_CONFIRMED).
const PROCEDENCIA = Object.freeze({
  RENDIMIENTO_GEOMETRICO: 'MEASURED',
  FRACCION_DIRECTA_RAFA: 'MEASURED',
  FORMATO_COMPLETO: 'DERIVED',
  CONSUMO_DIRECTO: 'DERIVED',
  INVENTARIO_CONTINUO: 'DERIVED',
  APROVECHAMIENTO_GENERICO: 'INFERRED',
});

// Cantidad FÍSICA que produjo el motor para esta línea (en la unidad del insumo),
// NO derivada del importe. Prefiere unidades (hojas/tramos), luego comprado, neto, cantidad.
function cantidadFisica(d) {
  for (const campo of ['unidades', 'comprado', 'neto', 'cantidad']) {
    const v = Number(d && d[campo]);
    if (Number.isFinite(v) && v > 0) return { q: v, campo };
  }
  return { q: null, campo: null };
}

export function bomDesdeDespiece(detalleInsumos = [], insumos = {}, opts = {}) {
  const {
    clave, nombre, factorMo, factorGif, dims_mm = null, fuente = null,
    verificar = false,              // VERIFICADO sólo si se pide EXPLÍCITAMENTE y la integridad lo permite
    cos_fab_real_medido = null,     // referencia de fábrica medida e independiente (si existe)
  } = opts;

  const lineas = [];
  const pendientes = [];
  const noTrazables = [];
  let materialResuelto = 0;
  let materialPendienteEstimado = 0;

  for (const d of (Array.isArray(detalleInsumos) ? detalleInsumos : [])) {
    const ins = (d && d.insumoId && insumos[d.insumoId]) || {};
    const unidad = (d && d.unidad) || ins.unidad || '';
    const unidadCompra = ins.unidad_compra || ins.unidadCompra || null;
    const precio = Number(d && d.precio);
    const costo = Number(d && d.costo);
    const descBase = String(
      (d && d.desc) || ins.nombre || (d && Array.isArray(d.nombresComponentes) && d.nombresComponentes[0]) || (d && d.insumoId) || 'Pieza'
    ).slice(0, 80);

    // --- PENDIENTE 1: sin identidad (insumoId). Se CONSERVA; no se descarta. ---
    if (!d || !d.insumoId) {
      const linea = {
        desc: descBase, insumoId: null, pendiente: true,
        motivo: 'sin insumoId (material no mapeado al catálogo) — Ingeniería/Compras',
        cantidad: null, unidad, unidad_compra: unidadCompra,
        precioConfirmado: (precio > 0 ? +precio.toFixed(4) : null),
        esCompraVenta: !!(d && d.esCompraVenta), procedencia: 'ASSUMED',
      };
      pendientes.push(linea); lineas.push(linea);
      if (Number.isFinite(costo) && costo > 0) materialPendienteEstimado += costo;
      continue;
    }
    // --- PENDIENTE 2: identidad sí, pero sin precio/costo usable. Se CONSERVA. ---
    if (!(precio > 0) || !Number.isFinite(costo) || costo < 0) {
      const linea = {
        desc: descBase, insumoId: d.insumoId, pendiente: true,
        motivo: 'sin precio/costo usable — Compras',
        cantidad: null, unidad, unidad_compra: unidadCompra,
        precioConfirmado: null, esCompraVenta: !!(d && d.esCompraVenta), procedencia: 'ASSUMED',
      };
      pendientes.push(linea); lineas.push(linea);
      continue;
    }

    // --- Línea costeable: cantidad FÍSICA del motor; costo/precio sólo RECONCILIA. ---
    const { q: qFisica, campo } = cantidadFisica(d);
    const qCosto = +(costo / precio).toFixed(6);
    const reconcilia = (qFisica != null) && Math.abs(qFisica - qCosto) <= TOL * Math.max(1, Math.abs(qCosto));
    const trazable = (qFisica != null) && !!unidad && reconcilia;
    const cantidad = (qFisica != null) ? +qFisica.toFixed(6) : qCosto; // física si existe; si no, el artefacto de importe (y NO será trazable)
    const procedencia = PROCEDENCIA[d && d.metodoConsumo] || (qFisica != null ? 'DERIVED' : 'ASSUMED');

    const linea = {
      desc: descBase,
      insumoId: d.insumoId,
      cantidad,
      unidad,                                   // ya NO se omite (trazabilidad física)
      unidad_compra: unidadCompra,
      esCompraVenta: ins.seccion === 'graficos' || ins.seccion === 'iluminacion' || !!d.esCompraVenta,
      precioConfirmado: +precio.toFixed(4),
      fisica: { valor: qFisica, campo, comprado: num(d.comprado), neto: num(d.neto), unidades: num(d.unidades) },
      cantidad_costo: qCosto,                   // SÓLO comprobación matemática (costo/precio)
      reconcilia,
      procedencia,
      trazable,
    };
    // --- FAIL-CLOSED TERCEROS (bloqueo 1) + catalogo de clasificacion (F1) ---
    if (d.clasificacionTercero === 'compra_venta') linea.esCompraVenta = true;   // declarado comprado terminado -> x1.06
    const pareceTercero = TERCERO_RE.test(descBase) || TERCERO_RE.test(String(ins.seccion || ''));
    let terceroConfirmado = d.esCompraVenta === true
      || d.clasificacionTercero === 'fabricado' || d.clasificacionTercero === 'compra_venta';
    // F1: el catalogo resuelve lo CLARO (vidrio/acrilico -> compra_venta, propuesta de Compras).
    // Lo ambiguo (galvanizado/corte laser) devuelve null y cae al bloqueo de abajo.
    if (pareceTercero && !linea.esCompraVenta && !terceroConfirmado) {
      const cat = clasificarTercero(descBase, ins.seccion);
      if (cat && cat.clasificacion === 'compra_venta') {
        linea.esCompraVenta = true; linea.clasificacion_fuente = cat.fuente; linea.clasificacion_nota = cat.nota;
        terceroConfirmado = true;   // resuelto por catalogo (propuesto; Compras valida)
      } else if (cat && cat.clasificacion === 'fabricado') {
        linea.clasificacion_fuente = cat.fuente; terceroConfirmado = true;
      }
    }
    if (pareceTercero && !linea.esCompraVenta && !terceroConfirmado) {
      linea.pendiente = true;
      linea.requiereClasificacionTercero = true;
      linea.cantidadSugerida = linea.cantidad;
      linea.costoSugerido = +costo.toFixed(2);
      linea.motivo = 'tercero sin clasificar (parece subcontratado): Ingenieria/Compras debe declarar '
        + 'compra-venta (x1.06, se compra terminado) o fabricado (x1.80, se hace en casa). '
        + 'Sin esa decision el costo NO es oficial.';
      pendientes.push(linea);
      lineas.push(linea);
      continue;                 // excluido de materialResuelto: el costo oficial no incluye el tercero sin clasificar
    }
    if (!trazable) {
      noTrazables.push({
        desc: descBase,
        motivo: qFisica == null ? 'sin cantidad física del motor (sólo importe monetario)'
          : !unidad ? 'sin unidad física'
          : 'la cantidad física no reconcilia con costo/precio',
      });
    }
    lineas.push(linea);
    materialResuelto += costo;
  }

  materialResuelto = +materialResuelto.toFixed(2);
  materialPendienteEstimado = +materialPendienteEstimado.toFixed(2);
  const fm = Number(factorMo), fg = Number(factorGif);
  // COSTO CALCULADO por factores del motor. NO es una medición de fábrica.
  const cos_fab_calculado = (Number.isFinite(fm) && Number.isFinite(fg))
    ? +(materialResuelto * (1 + fm + fg)).toFixed(2) : null;

  const nCosteables = lineas.filter((l) => !l.pendiente).length;
  const integridad = {
    completo: pendientes.length === 0 && nCosteables > 0,
    todasTrazables: noTrazables.length === 0 && nCosteables > 0,
    pendientes: pendientes.length,
    noTrazables: noTrazables.length,
    costeables: nCosteables,
  };
  const puedeVerificado = integridad.completo && integridad.todasTrazables;

  const no_verificable_por = [];
  if (!nCosteables) no_verificable_por.push('no hay ninguna línea costeable');
  if (pendientes.length) no_verificable_por.push(`${pendientes.length} pieza(s) pendiente(s) de identidad/precio`);
  if (noTrazables.length) no_verificable_por.push(`${noTrazables.length} línea(s) sin cantidad física trazable`);

  // VERIFICADO: sólo si se pidió explícitamente Y la integridad se cumple. Si no, BORRADOR.
  const tipo_bom = (verificar && puedeVerificado) ? 'BOM_DETALLADO_VERIFICADO' : 'BOM_BORRADOR';

  return {
    clave: String(clave || '').trim().toUpperCase(),
    nombre: nombre || null,
    tipo_bom,
    estado: tipo_bom === 'BOM_DETALLADO_VERIFICADO' ? 'verificado' : 'borrador',
    material_real: materialResuelto,              // suma REAL de costos de las líneas resueltas
    material_pendiente_estimado: materialPendienteEstimado,
    cos_fab_calculado,                            // CALCULADO (factores) — no es costo de fábrica medido
    cos_fab_real: cos_fab_real_medido,            // sólo si hay referencia independiente medida; si no, null
    factor_mo: Number.isFinite(fm) ? fm : null,
    factor_gif: Number.isFinite(fg) ? fg : null,
    dims_mm,
    fuente,
    lineas,                                       // incluye las pendientes (nada desaparece)
    pendientes,
    integridad,
    no_verificable_por: no_verificable_por.length ? no_verificable_por : null,
    descartadas: pendientes,                      // compat: consumidores que leían `descartadas`
  };
}

// ¿Listo para guardar? Un BOM con pendientes JAMÁS se guarda como verificado; sí se puede
// guardar como BORRADOR (preservando las pendientes) para que Compras/Ingeniería las cierren.
export function listoParaGuardar(bom = {}) {
  const errores = [];
  if (!bom.clave) errores.push('Falta la clave del producto.');
  const nCosteables = Array.isArray(bom.lineas) ? bom.lineas.filter((l) => !l.pendiente).length : 0;
  if (!nCosteables) errores.push('No hay lineas costeables para guardar.');
  if (bom.factor_mo == null || bom.factor_gif == null) errores.push('Faltan los factores (MO/GIF) de la clave.');
  // Defensa en profundidad: un payload que diga VERIFICADO sin integridad completa se rechaza aquí
  // (y también en el servidor). El cliente nunca decide la certificación por su cuenta.
  const esVerificado = bom.tipo_bom === 'BOM_DETALLADO_VERIFICADO';
  if (esVerificado && bom.integridad && !(bom.integridad.completo && bom.integridad.todasTrazables)) {
    errores.push('No se puede VERIFICAR un BOM con piezas pendientes o sin trazabilidad física; guárdalo como borrador.');
  }
  const nPend = Array.isArray(bom.pendientes) ? bom.pendientes.length : 0;
  return {
    ok: errores.length === 0,
    estado: bom.estado || (esVerificado ? 'verificado' : 'borrador'),
    errores,
    pendientes: nPend,
    aviso: nPend
      ? `${nPend} pieza(s) pendiente(s) se guardan como PENDIENTE y NO certifican; resuélvelas con Compras/Ingeniería.`
      : null,
  };
}

// ¿Este BOM es elegible para promoverse a VERIFICADO? (acto explícito de Dirección, posterior a la revisión).
export function puedeVerificarse(bom = {}) {
  return !!(bom && bom.integridad && bom.integridad.completo && bom.integridad.todasTrazables);
}
