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
import { costearMateriaPrima } from './costoPiezaFabricada.js';
import { costoManoObraRouting } from './costoOperacion.js';

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
 * @param {Array}  p.catalogoLamina  filas autoritativas de lamina (catalogo_vigente) para piezas fabricadas
 * @param {number} [p.lote]
 */
export function costearProductoIndustrial({ piezasBOM = [], routing = { operaciones: [] }, insumosERP = {}, catalogoLamina = [], lote = null, par = PARAMETROS_DEFAULT } = {}) {
  const insumos = { ...insumosERP };
  const componentes = [];
  const evidencia_fabricadas = [];      // piezas fabricadas costeadas (PRELIMINAR o VERIFICABLE)
  const desarrollos_pendientes = [];    // INCOMPLETO: falta desarrollo de CAD
  const bloqueadas = [];                // BLOQUEADO: no cabe / cantidad invalida
  const compradas_sin_precio = [];
  const doble_conteo = [];
  const decisiones = new Map();
  let material_preliminar = 0, material_verificable = 0;

  for (const p of piezasBOM) {
    if (p.fabricada) {
      const mp = costearMateriaPrima({ clave: p.clave, nombre: p.desc || p.clave, dims_mm: p.dims_mm, cantidad: p.cantidad, desc: p.desc,
        calibrePropuesto: p.calibrePropuesto, calibreConfirmado: p.calibreConfirmado, aceroPropuesto: p.aceroPropuesto, desarrolloConfirmado: p.desarrolloConfirmado }, { catalogoLamina, par });
      if (mp.componente) {
        componentes.push(mp.componente);
        insumos[mp.componente.insumoId] = mp.componente.insumo;   // insumo autoritativo para el motor
        evidencia_fabricadas.push({ clave: p.clave, estado: mp.estado, ...mp.evidencia });
        if (mp.estado === 'VERIFICABLE') material_verificable += mp.evidencia.costo_mp_mxn; else material_preliminar += mp.evidencia.costo_mp_mxn;
        doble_conteo.push({ clave: p.clave, nota: mp.evidencia.nota_doble_conteo });
        if (mp.pregunta) agrupa(decisiones, 'Confirmar espesores/calibres y desarrollos', p.clave);
      } else if (mp.estado === 'BLOQUEADO') {
        bloqueadas.push({ clave: p.clave, motivo: mp.motivo });
        agrupa(decisiones, 'Confirmar espesores/calibres y desarrollos', p.clave);
      } else {
        desarrollos_pendientes.push({ clave: p.clave, motivo: mp.motivo });
        agrupa(decisiones, 'Confirmar espesores/calibres y desarrollos', p.clave);
      }
    } else if (p.insumoId) {
      const qty = Number(p.cantidad);
      if (!Number.isFinite(qty) || qty <= 0) { bloqueadas.push({ clave: p.clave, motivo: 'cantidad invalida en pieza comprada' }); continue; }
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

  const preguntas_por_decision = [...decisiones.entries()].map(([decision, claves]) => ({ decision, afecta: [...claves], n: claves.size })).sort((a, b) => b.n - a.n);

  const materialFabricado = +evidencia_fabricadas.reduce((s, e) => s + (e.costo_mp_mxn || 0), 0).toFixed(2);
  const mat = motor.materialTotal;
  // CERRADO solo si no falta material/precio/desarrollo y NINGUNA pieza quedo preliminar.
  const sinPendientes = desarrollos_pendientes.length === 0 && bloqueadas.length === 0 && compradas_sin_precio.length === 0 && (motor.componentesIgnorados || []).length === 0;
  const todasVerificables = material_preliminar === 0 && evidencia_fabricadas.every((e) => e.estado === 'VERIFICABLE');
  const cerrado = sinPendientes && todasVerificables;
  const terceros_pendiente = [...decisiones.keys()].includes('Confirmar operaciones externas (terceros)');
  // P1 ECONOMICO (fail-closed): un total es OFICIAL solo si esta cerrado, la MO por routing esta
  // completa (estandares autorizados) Y no quedan terceros pendientes. Si falta cualquiera -> null.
  const es_oficial = cerrado && mo_routing.completa === true && terceros_pendiente === false;
  const emitible_comercial = es_oficial;

  return {
    certificable: false,
    emitible_comercial,                            // P1/P2: solo cuando es OFICIAL
    material: {
      total_mxn: +mat.toFixed(2),
      incluido_mxn: +mat.toFixed(2),               // lo que SI entra al total
      fabricado_lamina_mxn: materialFabricado,
      fabricado_verificable_mxn: +material_verificable.toFixed(2),
      fabricado_preliminar_mxn: +material_preliminar.toFixed(2),
      comprado_mxn: +(mat - materialFabricado).toFixed(2),
      pendiente: {                                 // material que FALTA (no esta en el total)
        desarrollos_3d: desarrollos_pendientes.map((d) => d.clave),
        bloqueadas: bloqueadas.map((d) => d.clave),
        compradas_sin_precio: compradas_sin_precio.map((d) => d.clave),
      },
      piezas_fabricadas_costeadas: evidencia_fabricadas.length,
      evidencia: evidencia_fabricadas,
    },
    mano_obra: {
      politica_vh_mxn: +motor.manoObra.toFixed(2),       // modelo VIGENTE autorizado
      routing_tiempos_mxn: mo_routing.mano_obra_mxn,     // objetivo: null hasta estandares
      routing_completa: mo_routing.completa,
      nota: mo_routing.nota,
    },
    gif_mxn: +motor.indirectosFabrica.toFixed(2),
    terceros: { pendiente: terceros_pendiente, nota: 'Cristal templado / termoformado / galvanizado: costo externo a confirmar (no incluido).' },
    total: {
      parcial_mxn: +motor.costoFabricacion.toFixed(2),   // material incluido + MO/GIF POLITICA_VH
      oficial_mxn: es_oficial ? +motor.costoFabricacion.toFixed(2) : null,  // solo si cerrado + MO routing + sin terceros
      es_oficial,
      bloqueado_por: es_oficial ? [] : [
        ...(cerrado ? [] : ['material/precio/desarrollo pendiente o pieza preliminar']),
        ...(mo_routing.completa === true ? [] : ['MO por routing sin estandares autorizados']),
        ...(terceros_pendiente ? ['terceros pendientes (operaciones externas)'] : []),
      ],
      estado: es_oficial ? 'OFICIAL (sujeto a validacion de Direccion)' : 'PARCIAL — no emitible como costo completo',
    },
    cobertura: { cerrado, es_oficial, desarrollos_pendientes, bloqueadas, compradas_sin_precio, pendientes_motor: motor.componentesIgnorados || [], doble_conteo },
    preguntas_por_decision,
    advertencia: 'MP fisica real (lamina autoritativa del catalogo vigente, con precio_id) + MO/GIF POLITICA_VH. MO por routing pendiente de estandares. Piezas 3D sin CAD y precios faltantes NO entran al total. Total parcial: no emitible comercialmente como costo completo.',
  };
}
