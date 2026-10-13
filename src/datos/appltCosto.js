// ============================================================================
//  COSTO OFICIAL APP LT · regla de Dirección (2026-10-13)
//
//  "El costo es el ERP de COMPRA con HORAS ESTÁNDAR, y los indirectos REALES son
//  confiables: usa el más real." Por lo tanto:
//    costo = materia prima a último costo de COMPRA (por opción de acabado)
//          + horas ESTÁNDAR por área × tarifa REAL (MO + indirectos) de planta.
//
//  Fuentes (src/datos/appltDatos.js, generado de los libros de Dirección):
//   · BOM y explosión de MP de 1 módulo: "Coste APP LT 20261002".
//   · Último costo por artículo + opción: hoja Compras (ene–oct 2026).
//   · Horas estándar por área: "Fabricar componentes" (totales por módulo).
//   · Tarifa real $/h: pedido 38247, PPyPTiempo / Fabricado Tiempo (bloque 3).
//
//  Si la opción de acabado pedida NO tiene compra en el periodo, se usa el costo
//  con el que el ERP consumió ese material en el pedido real (fuente distinta, se
//  dice). Si tampoco hay eso, el material queda PENDIENTE: nunca se inventa ni se
//  pone en $0. Las horas de ENTREGAS no tienen tarifa en ningún libro: quedan
//  listadas como pendientes, no se cobran en silencio.
// ============================================================================
import { APPLT_DATOS } from './appltDatos.js';

/** Tarifa REAL de planta ($/h), pedido 38247. MO + indirectos por área. */
export const TARIFA_REAL_APPLT = Object.freeze({
  pm: Object.freeze({ mo: 92.38, ind: 281.87 }),          // Procesos metal
  carpinteria: Object.freeze({ mo: 82.61, ind: 252.06 }),
  acabados: Object.freeze({ mo: 74.99, ind: 228.82 }),
  pintura: Object.freeze({ mo: 371.30, ind: 3930.56 }),
});

const r2 = (x) => Math.round(x * 100) / 100;

/** "A118B770C770" → { A: 'A118', B: 'B770', C: 'C770' } */
export function decodificarOpcion(opcion = '') {
  const out = {};
  for (const m of String(opcion).toUpperCase().matchAll(/([ABC])(\d+)/g)) out[m[1]] = `${m[1]}${m[2]}`;
  return out;
}

/** Precio unitario (MN) de un material de la explosión para una opción de acabado, con su fuente. */
export function precioMaterial(mat, opcion, datos = APPLT_DATOS) {
  const compras = datos.compras[mat.articulo] || {};
  if (!mat.opcionLetra) {
    const c = compras['-'];
    return c ? { precio: c.mn, fuente: 'compra', fecha: c.fecha, ref: c.movimiento } : { precio: null, fuente: 'pendiente', motivo: 'sin compra en el periodo' };
  }
  const cod = decodificarOpcion(opcion)[mat.opcionLetra];
  if (!cod) return { precio: null, fuente: 'pendiente', motivo: `la opción no define la letra ${mat.opcionLetra}` };
  const c = compras[cod];
  if (c) return { precio: c.mn, fuente: 'compra', fecha: c.fecha, ref: c.movimiento, opcion: cod };
  const consumo = datos.costoConsumoPedido[mat.articulo] || {};
  const k = Object.keys(consumo).find((x) => x.includes(cod));
  if (k) return { precio: consumo[k], fuente: 'erp_consumo_pedido', opcion: cod, motivo: `sin compra de ${cod} en el periodo: costo con que el ERP lo consumió en el pedido ${datos.fuente.pedido}` };
  return { precio: null, fuente: 'pendiente', opcion: cod, motivo: `sin compra ni consumo registrado de ${cod}` };
}

/**
 * Costo oficial de UN módulo TATO63612AB001 en la opción de acabado dada.
 * @returns {{ total:number|null, materiaPrima:number, manoObra:number, indirectos:number, porArea:object,
 *             materiales:Array, pendientes:string[], completo:boolean }}
 */
// INDIRECTOS UNA SOLA VEZ (Dirección, 2026-10-13: "los indirectos se cuentan 1 vez, nada más; si no se inflan").
// Cada tarifa "real" de indirectos por área (PPyPTiempo) reparte el gasto de TODA la planta (O) sobre las horas de
// ESA área: ind_i = O / H_i. Sumarlas por área cobra O tantas veces como áreas toque el módulo. Contado una vez,
// la tarifa de planta es O / ΣH_i = 1 / Σ(1 / ind_i), y se aplica a todas las horas del módulo. Se despeja de las
// mismas tarifas del ERP: no se inventa ningún dato. La mano de obra sí es por área (es la gente de cada área).
export function tarifaIndirectoPlanta(tarifas = TARIFA_REAL_APPLT) {
  const inv = Object.values(tarifas).reduce((s, t) => s + 1 / t.ind, 0);
  return 1 / inv;
}

/** `indirectos`: 'una_vez' (oficial) o 'por_area' (tarifa del archivo tal cual, infla el gasto; sólo para comparar). */
export function costoOficialModuloAppLT(opcion = 'A118B770C770', datos = APPLT_DATOS, { indirectos: modoInd = 'una_vez' } = {}) {
  if (modoInd !== 'una_vez' && modoInd !== 'por_area') throw new Error(`modo de indirectos desconocido: ${modoInd}`);
  const tPlanta = tarifaIndirectoPlanta();
  const materiales = datos.materialesPorModulo.map((m) => {
    const p = precioMaterial(m, opcion, datos);
    return { ...m, ...p, importe: p.precio == null ? null : r2(m.cantidad * p.precio) };
  });
  const pendientes = materiales.filter((m) => m.importe == null).map((m) => `${m.descripcion}: ${m.motivo}`);
  const materiaPrima = r2(materiales.reduce((s, m) => s + (m.importe || 0), 0));
  const h = datos.horasEstandarPorModulo;
  const porArea = {};
  let manoObra = 0, indirectos = 0;
  for (const [area, t] of Object.entries(TARIFA_REAL_APPLT)) {
    const horas = h[area] || 0;
    const ind = modoInd === 'una_vez' ? tPlanta : t.ind;
    porArea[area] = { horas, mo: r2(horas * t.mo), ind: r2(horas * ind), total: r2(horas * (t.mo + ind)) };
    manoObra += horas * t.mo; indirectos += horas * ind;
  }
  if (h.entregas > 0) pendientes.push(`Entregas: ${h.entregas} h estándar sin tarifa en ningún libro (no se cobran)`);
  manoObra = r2(manoObra); indirectos = r2(indirectos);
  const completo = materiales.every((m) => m.importe != null);
  return { opcion, modoIndirectos: modoInd, tarifaIndirectoPlanta: r2(tPlanta), total: completo ? r2(materiaPrima + manoObra + indirectos) : null, materiaPrima, manoObra, indirectos, porArea, materiales, pendientes, completo };
}

/** Costo ERP estándar de entrada de producto terminado (lo que registró el ERP) por módulo. */
export function costoErpModuloAppLT(datos = APPLT_DATOS) {
  return r2(datos.modulo.bom.reduce((s, b) => s + b.cantidad * (datos.costoErpUnitario[b.clave] ?? NaN), 0));
}

/**
 * Cotización del módulo a precio de lista del pedido real. La placa de unión CIEPLA01300778 va
 * INCLUIDA SIN CARGO dentro del módulo (decisión de Dirección 2026-10-13, como en el pedido 38247);
 * no se agrega al catálogo general en $0 (el catálogo exige lista > 0 a propósito).
 */
export function listaModuloAppLT(datos = APPLT_DATOS) {
  const renglones = datos.modulo.bom.map((b) => {
    const incluida = b.clave === 'CIEPLA01300778';
    const unit = incluida ? 0 : datos.listaPedido[b.clave];
    return { clave: b.clave, cantidad: b.cantidad, unitario: unit ?? null, importe: unit == null ? null : r2(unit * b.cantidad), incluidaSinCargo: incluida };
  });
  return { renglones, total: renglones.every((r) => r.importe != null) ? r2(renglones.reduce((s, r) => s + r.importe, 0)) : null };
}

/** Precio mínimo para respetar un margen sobre precio (p.ej. el piso de 25 %): costo / (1 − m). */
export function pisoPorMargen(costo, margenPct) {
  return Math.round((costo / (1 - margenPct / 100)) * 100) / 100;
}
