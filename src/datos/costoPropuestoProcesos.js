// ============================================================================
//  COSTEO INDUSTRIAL DE UN PRODUCTO (orquestador) — directiva Direccion 2026-11-09.
//  --------------------------------------------------------------------------
//  Transforma materias primas en mueble, NO busca piezas fabricadas como SKU.
//  REUSA el motor de produccion (src/motor/calculo.js: `calcular`) y los modulos
//  fisicos; NO crea un segundo sistema de costeo. Junta:
//    · piezas FABRICADAS  -> materia prima real (costoPiezaFabricada: desarrollo
//      plano -> lamina comercial -> aprovechamiento/merma). Caja 3D sin desarrollo
//      -> PENDIENTE (no inventa).
//    · piezas COMPRADAS   -> su insumo ERP (precio valido).
//    · MO/GIF             -> POLITICA_VH autorizada (via `calcular`), modelo vigente;
//      y en paralelo la MO por ROUTING (tiempo x tarifa, costoOperacion) que queda
//      PENDIENTE hasta que Ingenieria cargue estandares. No se inventan tiempos.
//  Anti DOBLE CONTEO: la lamina cruda NO trae corte -> el corte es operacion del
//  routing, nunca se suma un corte ya incluido en el precio de una pieza cortada.
//  PREGUNTAS agrupadas por DECISION industrial (no una por pieza).
// ============================================================================
import { calcular, PARAMETROS_DEFAULT } from '../motor/calculo.js';
import { INSUMOS_SEMILLA } from './insumos.js';
import { costearMateriaPrima } from './costoPiezaFabricada.js';
import { costoManoObraRouting } from './costoOperacion.js';

const SEED = Object.fromEntries(INSUMOS_SEMILLA.map((i) => [i.id, i]));

// Agrupa preguntas por DECISION industrial (cada decision -> set de claves afectadas).
function agrupa(mapa, decision, clave) {
  if (!mapa.has(decision)) mapa.set(decision, new Set());
  if (clave) mapa.get(decision).add(clave);
}
const OPERACION_EXTERNA = /templad|termoform|cristal|vidrio|acrilico|galvan|cromad|anodiz/i;

/**
 * @param {object} p
 * @param {Array}  p.piezasBOM  [{clave, desc, cantidad, dims_mm?, fabricada?, insumoId?, esCompraVenta?, calibrePropuesto?}]
 * @param {object} p.routing    { operaciones:[{op,centro}] }
 * @param {object} p.insumosERP  mapa insumoId -> {nombre, precio, unidad, seccion}
 * @param {number} [p.lote]
 */
export function costearProductoIndustrial({ piezasBOM = [], routing = { operaciones: [] }, insumosERP = {}, lote = null, par = PARAMETROS_DEFAULT } = {}) {
  const insumos = { ...SEED, ...insumosERP };
  const componentes = [];
  const evidencia_fabricadas = [];
  const desarrollos_pendientes = [];
  const compradas_sin_precio = [];
  const doble_conteo = [];
  const decisiones = new Map();

  for (const p of piezasBOM) {
    const qty = Number(p.cantidad) || 1;
    if (p.fabricada) {
      const mp = costearMateriaPrima({ clave: p.clave, nombre: p.desc || p.clave, dims_mm: p.dims_mm, piezas: qty, desc: p.desc, calibrePropuesto: p.calibrePropuesto });
      if (mp.componente) {
        componentes.push(mp.componente);
        evidencia_fabricadas.push({ clave: p.clave, estado: mp.estado, ...mp.evidencia });
        if (mp.evidencia?.corte_incluido_en_precio === false) doble_conteo.push({ clave: p.clave, nota: mp.evidencia.nota_doble_conteo });
        if (mp.pregunta) agrupa(decisiones, 'Confirmar espesores/calibres y desarrollos', p.clave);
      } else {
        desarrollos_pendientes.push({ clave: p.clave, motivo: mp.motivo });
        agrupa(decisiones, 'Confirmar espesores/calibres y desarrollos', p.clave);
      }
    } else if (p.insumoId) {
      const seccion = insumos[p.insumoId]?.seccion || (p.esCompraVenta ? 'graficos' : 'herrajes');
      componentes.push({ nombre: p.desc || p.clave, insumoId: p.insumoId, cantidad: qty, piezas: qty, seccion });
      if (OPERACION_EXTERNA.test(p.desc || '')) agrupa(decisiones, 'Confirmar operaciones externas (terceros)', p.clave);
    } else {
      compradas_sin_precio.push({ clave: p.clave, desc: p.desc });
      agrupa(decisiones, 'Confirmar componentes comprados y su precio', p.clave);
    }
  }

  // Motor real: material + MO (POLITICA_VH por tipo de material) + GIF + pendientes.
  const motor = calcular({ nombre: 'producto', componentes }, 1, insumos, par);

  // MO por ROUTING (tiempo x tarifa) — PENDIENTE hasta estandares autorizados.
  const mo_routing = costoManoObraRouting(routing.operaciones || [], { piezas: 1, lote });
  for (const f of (mo_routing.faltantes || [])) agrupa(decisiones, 'Confirmar tiempos y tarifas por centro', f.centro);

  // Preguntas agrupadas -> lista legible.
  const preguntas_por_decision = [...decisiones.entries()].map(([decision, claves]) => ({
    decision, afecta: [...claves], n: claves.size,
  })).sort((a, b) => b.n - a.n);

  const materialFabricado = +evidencia_fabricadas.reduce((s, e) => s + (e.costo_mp_mxn || 0), 0).toFixed(2);
  const mat = motor.materialTotal;
  const cerrado = desarrollos_pendientes.length === 0 && compradas_sin_precio.length === 0 && (motor.componentesIgnorados || []).length === 0;

  return {
    certificable: false,                         // nunca certificable desde propuestas/politica; requiere validacion
    material: {
      total_mxn: +mat.toFixed(2),
      fabricado_lamina_mxn: materialFabricado,
      comprado_mxn: +(mat - materialFabricado).toFixed(2),
      piezas_fabricadas_costeadas: evidencia_fabricadas.length,
      evidencia: evidencia_fabricadas,
    },
    mano_obra: {
      politica_vh_mxn: +motor.manoObra.toFixed(2),       // modelo VIGENTE autorizado (por tipo de material)
      routing_tiempos_mxn: mo_routing.mano_obra_mxn,     // objetivo: null hasta estandares
      routing_completa: mo_routing.completa,
      nota: mo_routing.nota,
    },
    gif_mxn: +motor.indirectosFabrica.toFixed(2),
    costo_fabricacion_vh_mxn: +motor.costoFabricacion.toFixed(2),  // con MO/GIF POLITICA_VH
    cobertura: {
      cerrado,
      desarrollos_pendientes,
      compradas_sin_precio,
      pendientes_motor: motor.componentesIgnorados || [],
      doble_conteo,
    },
    preguntas_por_decision,
    advertencia: 'Costo con MP fisica real (lamina comercial ERP) y MO/GIF por POLITICA_VH autorizada. La MO por tiempos de routing queda pendiente de estandares de Ingenieria. Piezas 3D sin desarrollo de CAD quedan pendientes. No es costo oficial sin validacion.',
  };
}
