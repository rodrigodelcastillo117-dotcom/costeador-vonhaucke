// ============================================================================
//  PANTALLA DE INGENIERIA (directiva Direccion 2026-11-09) — view-model puro.
//  --------------------------------------------------------------------------
//  Un usuario no-programador termina un costeo. Toma el EXPEDIENTE existente (no
//  recalcula, no es un segundo sistema) y lo presenta en 5 secciones:
//    ESTO ENTENDI · ASI LO FABRICARIA · ESTO NECESITO CONFIRMAR · ESTE ES EL COSTO ·
//    ASI PODRIA MEJORARSE.
//  Las confirmaciones de Ingenieria se aplican sobre el MISMO expediente y
//  RECALCULAN con el motor existente (recostearExpediente), conservando evidencia
//  y versionando cada cambio. No construye otro motor.
// ============================================================================
import { costearProductoIndustrial } from './costoPropuestoProcesos.js';
import { cargarEstandar } from './costoOperacion.js';

const money = (n) => (n == null ? null : +Number(n).toFixed(2));

/** Mejoras concretas derivadas de la EVIDENCIA (propuestas, no cambios). */
export function mejorasDe(costo = {}) {
  const m = [];
  const ev = costo.material?.evidencia || [];
  for (const e of ev) {
    if (e.aprovechamiento_pct != null && e.aprovechamiento_pct < 70) {
      m.push({ tipo: 'aprovechamiento', clave: e.clave,
        propuesta: `Aprovechamiento ${e.aprovechamiento_pct}% en ${e.clave}: nestear junto con otras piezas de ${e.lamina?.insumo_id} o evaluar formato alterno para subir rendimiento.` });
    }
  }
  // Nesteo conjunto por lamina compartida
  const porLamina = {};
  for (const e of ev) if (e.lamina?.insumo_id) (porLamina[e.lamina.insumo_id] ||= []).push(e.clave);
  for (const [lam, claves] of Object.entries(porLamina)) if (claves.length >= 2) {
    m.push({ tipo: 'nesteo_conjunto', propuesta: `Cortar ${claves.join(', ')} en la misma hoja de ${lam} (nesteo conjunto) para reducir merma y hojas compradas.` });
  }
  // Make-vs-buy: piezas compradas caras que podrian fabricarse (o al reves)
  if ((costo.cobertura?.compradas_sin_precio || []).length) {
    m.push({ tipo: 'make_vs_buy', propuesta: `Definir make-vs-buy de ${costo.cobertura.compradas_sin_precio.map((c) => c.clave).join(', ')}: cotizar compra vs fabricar en casa.` });
  }
  // Calibre: donde se propuso calibre (no venia del plano), estandarizar
  const calibrePropuesto = ev.filter((e) => e.calibre?.fuente && e.calibre.fuente !== 'del plano').map((e) => e.clave);
  if (calibrePropuesto.length) m.push({ tipo: 'estandarizar_calibre', propuesta: `Estandarizar calibre de ${calibrePropuesto.join(', ')} (hoy propuesto): un solo calibre por familia simplifica compra y corte.` });
  return m;
}

/** Construye el view-model de 5 secciones desde un expediente ya costeado. */
export function vistaIngenieria(expediente = {}) {
  const it = expediente.interpretacion || {};
  const costo = expediente.costo_industrial || {};
  const routing = expediente.routing || {};
  return {
    clave: expediente.clave || null,
    esto_entendi: {
      producto: it.producto || null,
      funcion: it.funcion || null,
      dimensiones_mm: it.dimensiones_generales_mm || null,
      modulos: (it.modulos || []).map((x) => x.modulo),
      materiales: it.criterio_ingenieria || null,
    },
    asi_lo_fabricaria: {
      bom: expediente.bom_canonico || null,
      operaciones_por_centro: routing.por_centro || null,
      total_operaciones: routing.total_operaciones ?? null,
      piezas_fabricadas: (costo.material?.evidencia || []).map((e) => ({ clave: e.clave, estado: e.estado, tipo: e.desarrollo?.tipo, metodo: e.desarrollo?.metodo, lamina: e.lamina?.insumo_id, precio_id: e.lamina?.precio_id, costo_mp: money(e.costo_mp_mxn) })),
      desarrollos_pendientes: costo.cobertura?.desarrollos_pendientes || [],
    },
    esto_necesito_confirmar: (costo.preguntas_por_decision || []).map((q) => ({ decision: q.decision, afecta: q.afecta, n: q.n })),
    este_es_el_costo: {
      material_incluido: money(costo.material?.incluido_mxn ?? costo.material?.total_mxn),
      material_fabricado_verificable: money(costo.material?.fabricado_verificable_mxn),
      material_fabricado_preliminar: money(costo.material?.fabricado_preliminar_mxn),
      material_comprado: money(costo.material?.comprado_mxn),
      material_pendiente: costo.material?.pendiente || null,
      mano_obra_politica_vh: money(costo.mano_obra?.politica_vh_mxn),
      mano_obra_routing_tiempos: costo.mano_obra?.routing_tiempos_mxn ?? null,
      gif: money(costo.gif_mxn),
      terceros_pendiente: costo.terceros?.pendiente ?? null,
      total_parcial: money(costo.total?.parcial_mxn),
      total_oficial: costo.total?.oficial_mxn ?? null,
      modelo_oficial: costo.total?.modelo_oficial ?? null,
      politica_costo: costo.politica_costo ?? null,
      emitible_comercial: costo.emitible_comercial ?? false,
      estado: costo.total?.estado || (costo.cobertura?.cerrado ? 'OFICIAL' : 'PARCIAL'),
      certificable: costo.certificable ?? false,     // P4: unificado con es_oficial
    },
    asi_podria_mejorarse: mejorasDe(costo),
  };
}

/**
 * P3: una confirmacion de Ingenieria RECALCULA el expediente con el motor existente.
 * Tipos: 'calibre' {clave, calibre}, 'desarrollo' {clave, desarrollo_mm:[L,W] de CAD},
 * 'precio' {clave, insumoId, insumo}, 'estandares' {estandares:[...]} (MO por tiempos).
 * Conserva evidencia previa, versiona el cambio y re-ejecuta costearProductoIndustrial.
 * Requiere que el expediente lleve `inputs` (piezasBOM, insumosERP, catalogoLamina, routing).
 */
export function recostearExpediente(expediente = {}, confirmacion = {}, { autoridadEstandares } = {}) {
  if (!expediente.inputs) throw new Error('expediente sin inputs: no se puede recalcular');
  const inputs = JSON.parse(JSON.stringify(expediente.inputs));
  const piezas = inputs.piezasBOM || [];
  const buscar = (c) => piezas.find((p) => p.clave === c);
  switch (confirmacion.tipo) {
    case 'calibre': { const p = buscar(confirmacion.clave); if (p) p.calibreConfirmado = confirmacion.calibre; break; }
    case 'desarrollo': { const p = buscar(confirmacion.clave); if (p) {
      const [L, W] = confirmacion.desarrollo_mm || [];
      p.desarrolloConfirmado = { largoMM: L, anchoMM: W, area_m2: confirmacion.area_m2 || +((L * W) / 1e6).toFixed(4), fuente: confirmacion.fuente || 'CAD', version: confirmacion.version || `cad-${(expediente.version || 1) + 1}` };
    } break; } // geometria CAD EXPLICITA y versionada (no re-inferida)
    case 'precio': { const p = buscar(confirmacion.clave); if (p) p.insumoId = confirmacion.insumoId; inputs.insumosERP = { ...(inputs.insumosERP || {}), [confirmacion.insumoId]: confirmacion.insumo }; break; }
    // estandares de MO: SOLO con autoridad real (p3). El cliente/UI no autoriza: sin autoridad -> se rechaza.
    case 'estandares': { (confirmacion.estandares || []).forEach((e) => cargarEstandar(e, { autoridad: autoridadEstandares })); break; }
    default: throw new Error('tipo de confirmacion desconocido: ' + confirmacion.tipo);
  }
  const costo = costearProductoIndustrial({ piezasBOM: piezas, routing: inputs.routing || { operaciones: [] }, insumosERP: inputs.insumosERP || {}, catalogoLamina: inputs.catalogoLamina || [] });
  const version = (expediente.version || 1) + 1;
  return {
    ...expediente, inputs, costo_industrial: costo, version,
    confirmaciones: [...(expediente.confirmaciones || []), { ...confirmacion, fecha: confirmacion.fecha || new Date().toISOString().slice(0, 10), version }],
  };
}

/**
 * Registra una confirmacion por DECISION sin recalcular (traza ligera; para el recalculo usar recostearExpediente).
 */
export function aplicarConfirmacion(expediente = {}, { decision, respuesta, por = 'ingenieria', fecha = null } = {}) {
  if (!decision) throw new Error('falta la decision a confirmar');
  const confirmaciones = { ...(expediente.confirmaciones || {}) };
  confirmaciones[decision] = { respuesta: respuesta ?? null, por, fecha: fecha || new Date().toISOString().slice(0, 10) };
  const pendientesPrevias = (expediente.costo_industrial?.preguntas_por_decision || []);
  const resueltas = Object.keys(confirmaciones);
  return {
    ...expediente,
    confirmaciones,
    pendientes_resueltas: resueltas,
    pendientes_abiertas: pendientesPrevias.map((q) => q.decision).filter((d) => !resueltas.includes(d)),
  };
}
